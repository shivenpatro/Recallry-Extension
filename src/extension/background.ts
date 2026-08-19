import { DEFAULT_COLLECTION_ID } from '../shared/constants';
import type { LinkCapture, RuntimeMessage } from '../shared/types';
import { faviconForUrl, safeDomain } from '../shared/utils';
import { bootstrapRepository, saveCapturedLink } from '../data/repositories';
import { lockVault } from '../services/vault';

const QUICK_SAVE_MENU_ID = 'linkscape-save-page';
const OPEN_DASHBOARD_MENU_ID = 'linkscape-open-dashboard';

chrome.runtime.onInstalled.addListener(() => {
  void bootstrapRepository();
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: QUICK_SAVE_MENU_ID,
      title: 'Save to Linkscape',
      contexts: ['page', 'link', 'selection']
    });
    chrome.contextMenus.create({
      id: OPEN_DASHBOARD_MENU_ID,
      title: 'Open Linkscape Dashboard',
      contexts: ['action']
    });
  });
});

chrome.runtime.onStartup.addListener(() => {
  void bootstrapRepository();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === QUICK_SAVE_MENU_ID) {
    const url = info.linkUrl || tab?.url;
    if (!url) return;
    void saveCapturedLink(DEFAULT_COLLECTION_ID, {
      title: tab?.title || url,
      url,
      domain: safeDomain(url),
      faviconUrl: tab?.favIconUrl || faviconForUrl(url)
    });
  }

  if (info.menuItemId === OPEN_DASHBOARD_MENU_ID) {
    void openDashboard();
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'save-current-page') void saveActiveTab();
  if (command === 'open-search') void openDashboard('#search');
  if (command === 'lock-vault') void lockVault();
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === 'LINKSCAPE_SAVE_ACTIVE_TAB') {
    saveActiveTab()
      .then((link) => sendResponse({ ok: true, link }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Save failed' }));
    return true;
  }

  if (message.type === 'LINKSCAPE_CAPTURE_PAGE') {
    saveCapturedLink(DEFAULT_COLLECTION_ID, message.payload as LinkCapture)
      .then((link) => sendResponse({ ok: true, link }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Capture failed' }));
    return true;
  }

  if (message.type === 'LINKSCAPE_OPEN_DASHBOARD' || message.type === 'LINKSCAPE_OPEN_SEARCH') {
    void openDashboard(message.type === 'LINKSCAPE_OPEN_SEARCH' ? '#search' : undefined);
  }

  if (message.type === 'LINKSCAPE_LOCK_VAULT') {
    void lockVault().then(() => {
      void chrome.runtime.sendMessage({ type: 'LINKSCAPE_VAULT_LOCKED' }).catch(() => undefined);
    });
  }

  return false;
});

async function saveActiveTab(collectionId = DEFAULT_COLLECTION_ID) {
  await bootstrapRepository();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) throw new Error('No active tab to save');
  return saveCapturedLink(collectionId, {
    title: tab.title || tab.url,
    url: tab.url,
    domain: safeDomain(tab.url),
    faviconUrl: tab.favIconUrl || faviconForUrl(tab.url)
  });
}

async function openDashboard(hash = '') {
  const url = chrome.runtime.getURL(`dashboard.html${hash}`);
  await chrome.tabs.create({ url });
}
