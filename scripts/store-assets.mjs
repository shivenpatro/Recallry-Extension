import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const edgeCandidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];
const edge = edgeCandidates.find(existsSync);
if (!edge) throw new Error('Microsoft Edge was not found');

const extensionPath = resolve('dist');
const outputPath = resolve('store-assets', 'screenshots');
const profilePath = join(tmpdir(), `linkscape-store-assets-${globalThis.process.pid}`);
const port = 9633 + Math.floor(Math.random() * 250);
await mkdir(outputPath, { recursive: true });

const browser = spawn(edge, [
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
  const extensionId = await findExtensionId(cdp);
  const dashboard = await openTarget(cdp, `chrome-extension://${extensionId}/dashboard.html`);
  await waitForText(cdp, dashboard, 'Collections');
  await seedShowcaseData(cdp, dashboard);
  await waitForText(cdp, dashboard, 'Design Systems');
  await delay(900);

  await capture(cdp, dashboard, '01-collections.png');

  await clickButtonContaining(cdp, dashboard, 'Design Systems');
  await waitForText(cdp, dashboard, 'Component Gallery');
  await delay(700);
  await capture(cdp, dashboard, '02-visual-collection.png');

  await cdp.send('Runtime.evaluate', {
    expression: "window.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}))"
  }, dashboard);
  await waitForText(cdp, dashboard, 'Everything');
  await setSearchValue(cdp, dashboard, 'design');
  await waitForText(cdp, dashboard, 'Design token systems');
  await delay(500);
  await capture(cdp, dashboard, '03-spotlight-search.png');

  await setSearchValue(cdp, dashboard, '');
  await cdp.send('Runtime.evaluate', {
    expression: "document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))"
  }, dashboard);
  await delay(300);
  await clickExactButton(cdp, dashboard, 'Vault');
  await waitForText(cdp, dashboard, 'Vault Mode');
  await delay(600);
  await capture(cdp, dashboard, '04-vault-privacy.png');

  await clickExactButton(cdp, dashboard, 'Settings');
  await waitForText(cdp, dashboard, 'Recovery Points');
  await delay(600);
  await capture(cdp, dashboard, '05-local-backup-settings.png');

  const runtimeErrors = cdp.events.filter((event) => event.method === 'Runtime.exceptionThrown' || (event.method === 'Log.entryAdded' && event.params?.entry?.level === 'error'));
  if (runtimeErrors.length) throw new Error(`Edge captured runtime errors: ${JSON.stringify(runtimeErrors.slice(0, 3))}`);

  globalThis.console.log(JSON.stringify({ ok: true, extensionId, outputPath, screenshots: 5 }));
  await cdp.send('Browser.close');
} finally {
  if (!browser.killed) browser.kill();
  if (profilePath.startsWith(tmpdir()) && profilePath.includes('linkscape-store-assets-')) {
    await rm(profilePath, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function findExtensionId(cdp) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const targets = await cdp.send('Target.getTargets');
    const worker = targets.targetInfos.find((target) => target.type === 'service_worker' && target.url.startsWith('chrome-extension://') && target.url.endsWith('/background.js'));
    if (worker) return new globalThis.URL(worker.url).hostname;
    await delay(200);
  }
  throw new Error('Linkscape service worker did not start in Edge');
}

async function openTarget(cdp, url) {
  const { targetId } = await cdp.send('Target.createTarget', { url });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Log.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);
  return sessionId;
}

async function seedShowcaseData(cdp, sessionId) {
  const collections = [
    collection('inbox', 'Inbox', 'Quick saves waiting to be shaped.', 'Inbox', 'aurora', 0, true, false),
    collection('design', 'Design Systems', 'Interfaces, patterns, and product details worth keeping.', 'Palette', 'ember', 1, true, true),
    collection('research', 'Product Research', 'Deep reads, references, and useful evidence.', 'Atom', 'glacier', 2, false, true),
    collection('travel', 'Weekend Travel', 'Places, stays, food, maps, and itinerary sparks.', 'Plane', 'sunset', 3, false, false),
    collection('reading', 'Reading Queue', 'Long-form ideas for a quieter moment.', 'BookOpen', 'forest', 0, false, false, 'research')
  ];
  const links = [
    link('design-1', 'design', 'Component Gallery', 'https://component.gallery/', 'component.gallery', 'A practical index of interface components and conventions.', ['design', 'reference'], ['ui'], 0, 'healthy'),
    link('design-2', 'design', 'Design token systems', 'https://web.dev/articles/design-system', 'web.dev', 'Notes on building consistent systems that scale with a product.', ['design', 'systems'], ['read'], 1, 'healthy'),
    link('design-3', 'design', 'Accessible interface patterns', 'https://www.w3.org/WAI/ARIA/apg/patterns/', 'w3.org', 'Keyboard and interaction patterns for production interfaces.', ['accessibility', 'design'], ['important'], 2, 'healthy'),
    link('design-4', 'design', 'Motion for product interfaces', 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_animations', 'developer.mozilla.org', 'Animation references for purposeful microinteractions.', ['motion', 'design'], ['reference'], 3, 'healthy'),
    link('research-1', 'research', 'Offline-first web architecture', 'https://web.dev/learn/pwa/offline-data', 'web.dev', 'Patterns for resilient local data and graceful network boundaries.', ['research', 'offline'], ['architecture'], 0, 'healthy'),
    link('research-2', 'research', 'IndexedDB fundamentals', 'https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API', 'developer.mozilla.org', 'Primary reference for structured browser storage.', ['research', 'storage'], ['reference'], 1, 'healthy'),
    link('research-3', 'research', 'Web cryptography API', 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API', 'developer.mozilla.org', 'Cryptographic primitives available to browser extensions.', ['research', 'security'], ['vault'], 2, 'healthy'),
    link('travel-1', 'travel', 'Kyoto weekend notebook', 'https://www.japan.travel/en/destinations/kansai/kyoto/', 'japan.travel', 'Temples, neighborhoods, and a compact two-day route.', ['travel', 'japan'], ['weekend'], 0, 'healthy'),
    link('travel-2', 'travel', 'Rail journey planner', 'https://www.japan.travel/en/plan/getting-around/', 'japan.travel', 'Transit reference for the itinerary.', ['travel', 'planning'], ['transport'], 1, 'healthy'),
    link('inbox-1', 'inbox', 'Chrome extension quality guidelines', 'https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines-faq/', 'developer.chrome.com', 'Launch checklist for a focused, trustworthy extension.', ['launch', 'reference'], ['important'], 0, 'healthy'),
    link('inbox-2', 'inbox', 'Local-first software principles', 'https://www.inkandswitch.com/local-first/', 'inkandswitch.com', 'A useful framing for ownership, resilience, and collaboration.', ['local-first', 'research'], ['read'], 1, 'healthy'),
    link('reading-1', 'reading', 'Designing for trust', 'https://www.nngroup.com/articles/trustworthy-design/', 'nngroup.com', 'How clear expectations make products feel dependable.', ['research', 'design'], ['later'], 0, 'healthy'),
    link('reading-2', 'reading', 'Building a second brain', 'https://fortelabs.com/blog/basboverview/', 'fortelabs.com', 'Ideas for turning captured references into useful knowledge.', ['research', 'organization'], ['later'], 1, 'unknown')
  ];

  const expression = `(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('linkscape');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(['collections', 'links'], 'readwrite');
      const collectionStore = transaction.objectStore('collections');
      const linkStore = transaction.objectStore('links');
      collectionStore.clear();
      linkStore.clear();
      for (const item of ${JSON.stringify(collections)}) collectionStore.put(item);
      for (const item of ${JSON.stringify(links)}) linkStore.put(item);
      transaction.oncomplete = () => { database.close(); location.reload(); resolve(true); };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    };
  }))()`;
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (result.exceptionDetails) throw new Error(`Could not seed screenshot data: ${JSON.stringify(result.exceptionDetails)}`);
}

function collection(id, title, description, icon, theme, order, isPinned, isFavorite, parentId) {
  return {
    id,
    title,
    description,
    icon,
    theme,
    ...(parentId ? { parentId } : {}),
    order,
    isPinned,
    isFavorite,
    isVaultProtected: false,
    status: 'active',
    createdAt: '2026-08-21T09:00:00.000Z',
    updatedAt: '2026-08-30T10:30:00.000Z'
  };
}

function link(id, collectionId, title, url, domain, notes, tags, labels, order, healthStatus) {
  return {
    id,
    collectionId,
    title,
    url,
    domain,
    notes,
    tags,
    labels,
    order,
    isArchived: false,
    isVaultProtected: false,
    healthStatus,
    healthCheckedAt: '2026-08-30T10:30:00.000Z',
    createdAt: `2026-08-${String(29 - order).padStart(2, '0')}T10:30:00.000Z`,
    updatedAt: '2026-08-30T10:30:00.000Z'
  };
}

async function setSearchValue(cdp, sessionId, value) {
  const expression = `(() => {
    const input = [...document.querySelectorAll('input')].find((element) => element.placeholder.includes('Search the archive'));
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`;
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true }, sessionId);
  if (!result.result.value) throw new Error('Could not enter the Spotlight query');
}

async function clickExactButton(cdp, sessionId, label) {
  return clickMatchingButton(cdp, sessionId, label, true);
}

async function clickButtonContaining(cdp, sessionId, label) {
  return clickMatchingButton(cdp, sessionId, label, false);
}

async function clickMatchingButton(cdp, sessionId, label, exact) {
  const expression = `(() => {
    const button = [...document.querySelectorAll('button')].find((element) => ${exact ? `element.textContent.trim() === ${JSON.stringify(label)}` : `element.textContent.includes(${JSON.stringify(label)})`});
    if (!button) return false;
    button.click();
    return true;
  })()`;
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true }, sessionId);
  if (!result.result.value) throw new Error(`Could not click ${label}`);
  await delay(300);
}

async function capture(cdp, sessionId, filename) {
  const layout = await cdp.send('Runtime.evaluate', {
    expression: '({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight})',
    returnByValue: true
  }, sessionId);
  if (layout.result.value.width !== 1280 || layout.result.value.height !== 800) throw new Error(`Unexpected viewport for ${filename}`);
  if (layout.result.value.scrollWidth > 1281) throw new Error(`Horizontal overflow in ${filename}`);
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true }, sessionId);
  await writeFile(join(outputPath, filename), globalThis.Buffer.from(screenshot.data, 'base64'));
}

async function waitForText(cdp, sessionId, expected) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const text = await cdp.send('Runtime.evaluate', { expression: 'document.body?.innerText ?? ""', returnByValue: true }, sessionId);
    if ((text.result.value ?? '').includes(expected)) return;
    await delay(200);
  }
  const state = await cdp.send('Runtime.evaluate', {
    expression: '({url:location.href,title:document.title,readyState:document.readyState,text:document.body?.innerText ?? "",html:document.documentElement?.outerHTML?.slice(0,1200) ?? ""})',
    returnByValue: true
  }, sessionId);
  throw new Error(`Timed out waiting for ${expected}: ${JSON.stringify(state.result.value)}`);
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
  throw new Error('Edge DevTools endpoint did not start');
}

function connectCdp(url) {
  return new Promise((resolveConnection, rejectConnection) => {
    const socket = new globalThis.WebSocket(url);
    const pending = new Map();
    const events = [];
    let nextId = 1;
    socket.onerror = () => rejectConnection(new Error('Could not connect to Edge DevTools'));
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
