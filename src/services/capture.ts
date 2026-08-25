import type { LinkCapture } from '../shared/types';
import { faviconForUrl, normalizeWebsiteUrl, safeDomain } from '../shared/utils';
import { cacheCaptureMedia } from './mediaCache';

export async function captureActiveTab(includeSnapshot = false): Promise<LinkCapture> {
  const extensionApi = (globalThis as { chrome?: typeof chrome }).chrome;
  if (!extensionApi?.tabs) {
    throw new Error('Chrome tabs API is unavailable');
  }
  const [tab] = await extensionApi.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    throw new Error('No active tab URL found');
  }
  const url = normalizeWebsiteUrl(tab.url);
  const fallback: LinkCapture = {
    title: tab.title ?? url,
    url,
    domain: safeDomain(url),
    faviconUrl: tab.favIconUrl || faviconForUrl(url)
  };
  if (!tab.id || !extensionApi.scripting?.executeScript) return fallback;
  try {
    const [result] = await extensionApi.scripting.executeScript({
      target: { tabId: tab.id },
      args: [includeSnapshot],
      func: (shouldCaptureSnapshot) => {
        const favicon = document.querySelector<HTMLLinkElement>('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')?.href;
        const preview = document.querySelector<HTMLMetaElement>('meta[property="og:image"], meta[name="twitter:image"]')?.content;
        let snapshotHtml: string | undefined;
        if (shouldCaptureSnapshot) {
          const snapshot = document.body.cloneNode(true) as HTMLElement;
          snapshot.querySelectorAll('script, style, link, iframe, object, embed, form, input, textarea, select, button, video, audio, canvas, svg, picture, source, img').forEach((element) => element.remove());
          snapshot.querySelectorAll<HTMLElement>('*').forEach((element) => {
            for (const attribute of [...element.attributes]) {
              if (element instanceof HTMLAnchorElement && attribute.name === 'href') continue;
              element.removeAttribute(attribute.name);
            }
            if (element instanceof HTMLAnchorElement) {
              try {
                const href = new URL(element.href, location.href);
                if (!['http:', 'https:'].includes(href.protocol)) element.removeAttribute('href');
                else element.href = href.href;
              } catch {
                element.removeAttribute('href');
              }
              element.target = '_blank';
              element.rel = 'noopener noreferrer nofollow';
            }
          });
          snapshotHtml = snapshot.innerHTML.slice(0, 750_000);
        }
        return {
          title: document.title || location.href,
          url: location.href,
          faviconUrl: favicon ? new URL(favicon, location.href).href : undefined,
          thumbnailUrl: preview ? new URL(preview, location.href).href : undefined,
          snapshotHtml,
          snapshotCapturedAt: snapshotHtml ? new Date().toISOString() : undefined
        };
      }
    });
    if (result?.result) return cacheCaptureMedia({ ...fallback, ...result.result, domain: safeDomain(result.result.url) });
  } catch {
    // Restricted pages cannot be inspected; the tab metadata remains usable.
  }
  return cacheCaptureMedia(fallback);
}

export function captureFromDocument(): LinkCapture {
  const ogImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"], meta[name="twitter:image"]');
  return {
    title: document.title || location.href,
    url: location.href,
    domain: safeDomain(location.href),
    faviconUrl: findFavicon(),
    thumbnailUrl: ogImage?.content ? new URL(ogImage.content, location.href).href : undefined
  };
}

function findFavicon() {
  const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
  if (!link?.href) return faviconForUrl(location.href);
  return new URL(link.href, location.origin).href;
}
