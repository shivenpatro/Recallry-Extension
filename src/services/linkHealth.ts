import { updateLink } from '../data/repositories';
import type { LinkCard } from '../shared/types';

export interface LinkHealthSummary {
  checked: number;
  healthy: number;
  broken: number;
  unknown: number;
}

type LinkHealthStatus = NonNullable<LinkCard['healthStatus']>;

export async function requestLinkHealthPermission() {
  const extensionApi = (globalThis as { chrome?: typeof chrome }).chrome;
  if (!extensionApi?.permissions?.request) return true;
  return extensionApi.permissions.request({ origins: ['http://*/*', 'https://*/*'] });
}

export async function checkLinksHealth(links: LinkCard[], onProgress?: (summary: LinkHealthSummary) => void) {
  const summary: LinkHealthSummary = { checked: 0, healthy: 0, broken: 0, unknown: 0 };
  const queue = links.filter((link) => !link.deletedAt && /^https?:\/\//i.test(link.url));
  let cursor = 0;

  async function worker() {
    while (cursor < queue.length) {
      const link = queue[cursor++];
      if (!link) return;
      const result = await checkOneLink(link.url);
      await updateLink(link.id, {
        healthStatus: result.status,
        healthHttpStatus: result.httpStatus,
        healthCheckedAt: new Date().toISOString()
      });
      summary.checked += 1;
      summary[result.status] += 1;
      onProgress?.({ ...summary });
    }
  }

  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, () => worker()));
  return summary;
}

async function checkOneLink(url: string): Promise<{ status: LinkHealthStatus; httpStatus?: number }> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 8_000);
  try {
    let response = await globalThis.fetch(url, { method: 'HEAD', credentials: 'omit', redirect: 'follow', cache: 'no-store', signal: controller.signal });
    if (response.status === 405) response = await globalThis.fetch(url, { method: 'GET', credentials: 'omit', redirect: 'follow', cache: 'no-store', signal: controller.signal });
    if (response.status >= 200 && response.status < 400) return { status: 'healthy', httpStatus: response.status };
    if (response.status === 404 || response.status === 410) return { status: 'broken', httpStatus: response.status };
    return { status: 'unknown', httpStatus: response.status };
  } catch {
    return { status: 'unknown' };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
