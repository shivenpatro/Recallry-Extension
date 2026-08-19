import type { LinkCapture } from '../shared/types';
import { faviconForUrl, safeDomain } from '../shared/utils';

export async function captureActiveTab(): Promise<LinkCapture> {
  const extensionApi = (globalThis as { chrome?: typeof chrome }).chrome;
  if (!extensionApi?.tabs) {
    throw new Error('Chrome tabs API is unavailable');
  }
  const [tab] = await extensionApi.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    throw new Error('No active tab URL found');
  }
  const fallback: LinkCapture = {
    title: tab.title ?? tab.url,
    url: tab.url,
    domain: safeDomain(tab.url),
    faviconUrl: tab.favIconUrl || faviconForUrl(tab.url)
  };
  if (!tab.id || !extensionApi.tabs.sendMessage) return fallback;
  try {
    const response = await extensionApi.tabs.sendMessage(tab.id, { type: 'LINKSCAPE_CAPTURE_PAGE' });
    if (response?.ok && response.capture) return { ...fallback, ...response.capture };
  } catch {
    // Restricted pages cannot be inspected; the tab metadata remains usable.
  }
  return fallback;
}

export function captureFromDocument(): LinkCapture {
  const ogImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"], meta[name="twitter:image"]');
  return {
    title: document.title || location.href,
    url: location.href,
    domain: safeDomain(location.href),
    faviconUrl: findFavicon(),
    thumbnailUrl: ogImage?.content
  };
}

function findFavicon() {
  const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
  if (!link?.href) return faviconForUrl(location.href);
  return new URL(link.href, location.origin).href;
}
