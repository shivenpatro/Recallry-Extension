import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const edgeCandidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];
const requestedBrowser = 'Edge';
const browserExecutable = edgeCandidates.find(existsSync);
if (!browserExecutable) throw new Error(`${requestedBrowser} was not found`);

const extensionPath = resolve('dist');
const profilePath = join(tmpdir(), `recallry-browser-smoke-${globalThis.process.pid}`);
const port = 9333 + Math.floor(Math.random() * 300);
const browser = spawn(browserExecutable, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profilePath}`,
  `--disable-extensions-except=${extensionPath}`,
  `--load-extension=${extensionPath}`,
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank'
], { stdio: 'ignore', windowsHide: true });

try {
  const version = await pollJson(`http://127.0.0.1:${port}/json/version`);
  const cdp = await connectCdp(version.webSocketDebuggerUrl);
  let worker;
  for (let attempt = 0; attempt < 40 && !worker; attempt += 1) {
    const targets = await cdp.send('Target.getTargets');
    worker = targets.targetInfos.find((target) => target.type === 'service_worker' && target.url.startsWith('chrome-extension://') && target.url.endsWith('/background.js'));
    if (!worker) await delay(250);
  }
  if (!worker) throw new Error('Recallry service worker did not start');
  const extensionId = new globalThis.URL(worker.url).hostname;
  const workerSession = await cdp.send('Target.attachToTarget', { targetId: worker.targetId, flatten: true });
  await cdp.send('Runtime.enable', {}, workerSession.sessionId);
  await cdp.send('Log.enable', {}, workerSession.sessionId);

  const dashboard = await openTarget(cdp, `chrome-extension://${extensionId}/dashboard.html`);
  await waitForText(cdp, dashboard, 'Collections');
  const initialText = await bodyText(cdp, dashboard);
  for (const label of ['Collections', 'Favorites', 'Archived', 'Trash', 'Vault', 'Settings']) {
    if (!initialText.includes(label)) throw new Error(`Dashboard is missing ${label}`);
  }

  await clickButton(cdp, dashboard, 'Collection');
  await waitForText(cdp, dashboard, 'New collection');
  const dialogState = await cdp.send('Runtime.evaluate', {
    expression: '({modal:document.querySelector(`[role="dialog"]`)?.getAttribute("aria-modal"),focused:document.activeElement?.tagName})',
    returnByValue: true
  }, dashboard);
  if (dialogState.result.value.modal !== 'true' || dialogState.result.value.focused !== 'INPUT') throw new Error('Collection dialog is not accessible or did not focus its input');
  await cdp.send('Runtime.evaluate', {
    expression: "window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))"
  }, dashboard);
  await waitForTextGone(cdp, dashboard, 'New collection');

  await clickButton(cdp, dashboard, 'Trash');
  await waitForText(cdp, dashboard, 'Trash is empty');
  await clickButton(cdp, dashboard, 'Settings');
  await waitForText(cdp, dashboard, 'Recovery Points');
  const settingsText = await bodyText(cdp, dashboard);
  for (const label of ['Link Health', 'Privacy', 'Recovery Points']) {
    if (!settingsText.includes(label)) throw new Error(`Settings is missing ${label}`);
  }

  await cdp.send('Runtime.evaluate', {
    expression: "window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}))"
  }, dashboard);
  await waitForText(cdp, dashboard, 'Everything');

  const snapshot = await openTarget(cdp, `chrome-extension://${extensionId}/snapshot.html`);
  await waitForText(cdp, snapshot, 'Snapshot link is missing.');

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, dashboard);
  await delay(250);
  const mobileLayout = await cdp.send('Runtime.evaluate', {
    expression: '({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,text:document.body.innerText})',
    returnByValue: true
  }, dashboard);
  if (mobileLayout.result.value.scrollWidth > mobileLayout.result.value.viewport + 1) throw new Error('Dashboard overflows horizontally at 390px');
  if (!mobileLayout.result.value.text.includes('Settings')) throw new Error('Mobile navigation did not render');

  const targets = await cdp.send('Target.getTargets');
  const errors = targets.targetInfos.filter((target) => target.type === 'page' && target.url.startsWith('chrome-extension://') && target.title.toLocaleLowerCase().includes('error'));
  if (errors.length) throw new Error(`${requestedBrowser} reported ${errors.length} extension error page(s)`);
  const runtimeErrors = cdp.events.filter((event) => event.method === 'Runtime.exceptionThrown' || (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error'));
  if (runtimeErrors.length) throw new Error(`${requestedBrowser} captured ${runtimeErrors.length} extension runtime error(s): ${JSON.stringify(runtimeErrors.slice(0, 3))}`);
  globalThis.console.log(JSON.stringify({ ok: true, browser: requestedBrowser, extensionId, checks: ['service-worker', 'dashboard', 'dialogs', 'trash', 'settings', 'spotlight', 'snapshot', 'mobile-390px', 'runtime-errors'] }));
  await cdp.send('Browser.close');
} finally {
  if (!browser.killed) browser.kill();
  if (profilePath.startsWith(tmpdir()) && profilePath.includes('recallry-browser-smoke-')) await rm(profilePath, { recursive: true, force: true }).catch(() => undefined);
}

async function openTarget(cdp, url) {
  const { targetId } = await cdp.send('Target.createTarget', { url });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Log.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  return sessionId;
}

async function clickButton(cdp, sessionId, label) {
  const expression = `(() => { const button = [...document.querySelectorAll('button')].find((element) => element.textContent.trim() === ${JSON.stringify(label)}); if (!button) return false; button.click(); return true; })()`;
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true }, sessionId);
  if (!result.result.value) throw new Error(`Could not click ${label}`);
  await delay(250);
}

async function waitForText(cdp, sessionId, expected) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if ((await bodyText(cdp, sessionId)).includes(expected)) return;
    await delay(200);
  }
  const state = await cdp.send('Runtime.evaluate', {
    expression: '({url:location.href,readyState:document.readyState,title:document.title,text:document.body?.innerText ?? "",html:document.documentElement?.outerHTML?.slice(0,1200) ?? ""})',
    returnByValue: true
  }, sessionId);
  globalThis.console.error(JSON.stringify({ expected, state: state.result.value, events: cdp.events.slice(-20) }, null, 2));
  throw new Error(`Timed out waiting for ${expected}`);
}

async function waitForTextGone(cdp, sessionId, expected) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (!(await bodyText(cdp, sessionId)).includes(expected)) return;
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${expected} to close`);
}

async function bodyText(cdp, sessionId) {
  const response = await cdp.send('Runtime.evaluate', { expression: 'document.body?.innerText ?? ""', returnByValue: true }, sessionId);
  return response.result.value ?? '';
}

async function pollJson(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await globalThis.fetch(url);
      if (response.ok) return response.json();
    } catch {
      // Edge is still starting.
    }
    await delay(250);
  }
  throw new Error(`${requestedBrowser} DevTools endpoint did not start`);
}

function connectCdp(url) {
  return new Promise((resolveConnection, rejectConnection) => {
    const socket = new globalThis.WebSocket(url);
    const pending = new Map();
    const events = [];
    let nextId = 1;
    socket.onerror = () => rejectConnection(new Error(`Could not connect to ${requestedBrowser} DevTools`));
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) {
        if (message.method === 'Runtime.exceptionThrown' || message.method === 'Runtime.consoleAPICalled' || message.method === 'Log.entryAdded') events.push(message);
        return;
      }
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    };
    socket.onopen = () => resolveConnection({
      events,
      send(method, params = {}, sessionId) {
        return new Promise((resolveRequest, rejectRequest) => {
          const id = nextId++;
          pending.set(id, { resolve: resolveRequest, reject: rejectRequest });
          socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
        });
      }
    });
  });
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => globalThis.setTimeout(resolveDelay, milliseconds));
}
