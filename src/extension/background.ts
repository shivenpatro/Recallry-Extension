import { DEFAULT_COLLECTION_ID } from '../shared/constants';
import type { LinkCapture, RuntimeMessage } from '../shared/types';
import { faviconForUrl, safeDomain } from '../shared/utils';
import { bootstrapRepository, listCollections, saveCapturedLink } from '../data/repositories';
import { captureActiveTab } from '../services/capture';
import { isVaultUnlocked, lockVault, restoreVaultSession } from '../services/vault';
import { ensureFreshAutomaticBackup } from '../services/backups';

const QUICK_SAVE_MENU_ID = 'recallry-save-page';
const SAVE_TO_MENU_PREFIX = 'recallry-save-to:';
const OPEN_DASHBOARD_MENU_ID = 'recallry-open-dashboard';
const AUTOMATIC_BACKUP_ALARM = 'recallry-automatic-backup';
const LEGACY_AUTOMATIC_BACKUP_ALARM = 'linkscape-automatic-backup';

chrome.runtime.onInstalled.addListener(() => {
  void initializeExtension();
});

chrome.runtime.onStartup.addListener(() => {
  void initializeExtension();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === AUTOMATIC_BACKUP_ALARM) void ensureFreshAutomaticBackup();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (typeof info.menuItemId === 'string' && info.menuItemId.startsWith(SAVE_TO_MENU_PREFIX)) {
    const collectionId = decodeURIComponent(info.menuItemId.slice(SAVE_TO_MENU_PREFIX.length));
    const url = info.linkUrl || info.pageUrl || tab?.url;
    if (!url) return;
    const capture: LinkCapture = {
      title: info.selectionText?.trim() || tab?.title || url,
      url,
      domain: safeDomain(url),
      faviconUrl: tab?.favIconUrl || faviconForUrl(url)
    };
    void saveCapturedLink(collectionId, capture).then(() => showSaveResult(true)).catch(() => showSaveResult(false));
  }

  if (info.menuItemId === OPEN_DASHBOARD_MENU_ID) void openDashboard();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'save-current-page') void saveActiveTab().then(() => showSaveResult(true)).catch(() => showSaveResult(false));
  if (command === 'open-search') void openDashboard('?search=1');
  if (command === 'lock-vault') void lockEverywhere();
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === 'RECALLRY_SAVE_ACTIVE_TAB') {
    saveActiveTab()
      .then((link) => sendResponse({ ok: true, link }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Save failed' }));
    return true;
  }

  if (message.type === 'RECALLRY_CAPTURE_PAGE') {
    saveCapturedLink(DEFAULT_COLLECTION_ID, message.payload as LinkCapture)
      .then((link) => sendResponse({ ok: true, link }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Capture failed' }));
    return true;
  }

  if (message.type === 'RECALLRY_OPEN_DASHBOARD' || message.type === 'RECALLRY_OPEN_SEARCH') {
    void openDashboard(message.type === 'RECALLRY_OPEN_SEARCH' ? '?search=1' : undefined);
  }

  if (message.type === 'RECALLRY_LOCK_VAULT') void lockEverywhere();
  if (message.type === 'RECALLRY_REFRESH_CONTEXT_MENUS') void rebuildContextMenus();
  return false;
});

async function initializeExtension() {
  await chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  await chrome.alarms.clear(LEGACY_AUTOMATIC_BACKUP_ALARM);
  await bootstrapRepository();
  await restoreVaultSession();
  await rebuildContextMenus();
  await ensureFreshAutomaticBackup();
  await chrome.alarms.create(AUTOMATIC_BACKUP_ALARM, { periodInMinutes: 24 * 60 });
}

async function rebuildContextMenus() {
  const collections = (await listCollections()).filter((collection) => collection.status === 'active' && (!collection.isVaultProtected || isVaultUnlocked()));
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: QUICK_SAVE_MENU_ID,
    title: 'Save to Recallry',
    contexts: ['page', 'link', 'selection']
  });
  for (const collection of collections.slice(0, 20)) {
    chrome.contextMenus.create({
      id: `${SAVE_TO_MENU_PREFIX}${encodeURIComponent(collection.id)}`,
      parentId: QUICK_SAVE_MENU_ID,
      title: collection.title,
      contexts: ['page', 'link', 'selection']
    });
  }
  chrome.contextMenus.create({
    id: OPEN_DASHBOARD_MENU_ID,
    title: 'Open Recallry Dashboard',
    contexts: ['action']
  });
}

async function saveActiveTab(collectionId = DEFAULT_COLLECTION_ID) {
  await bootstrapRepository();
  return saveCapturedLink(collectionId, await captureActiveTab());
}

async function lockEverywhere() {
  await lockVault();
  await rebuildContextMenus();
  await chrome.runtime.sendMessage({ type: 'RECALLRY_VAULT_LOCKED' }).catch(() => undefined);
}

async function openDashboard(suffix = '') {
  await chrome.tabs.create({ url: chrome.runtime.getURL(`dashboard.html${suffix}`) });
}

async function showSaveResult(success: boolean) {
  await chrome.action.setBadgeBackgroundColor({ color: success ? '#1a1714' : '#e63946' });
  await chrome.action.setBadgeText({ text: success ? 'OK' : '!' });
  globalThis.setTimeout(() => void chrome.action.setBadgeText({ text: '' }), 1800);
}
