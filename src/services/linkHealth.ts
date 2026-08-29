import { updateLink } from '../data/repositories';
import type { LinkCard } from '../shared/types';

export interface LinkHealthSummary {
  checked: number;
  healthy: number;
  broken: number;
  unknown: number;
  skipped: number;
}

type LinkHealthStatus = NonNullable<LinkCard['healthStatus']>;

export function getLinkHealthOriginPatterns(links: LinkCard[]) {
  const origins = new Set<string>();
  for (const link of links) {
    if (link.deletedAt) continue;
    try {
      const url = new URL(link.url);
      if (url.protocol === 'http:' || url.protocol === 'https:') origins.add(`${url.origin}/*`);
    } catch {
      // Invalid and protected placeholder URLs cannot be checked.
    }
  }
  return [...origins].sort();
}

export async function requestLinkHealthPermission(links: LinkCard[]) {
  const extensionApi = (globalThis as { chrome?: typeof chrome }).chrome;
  const origins = getLinkHealthOriginPatterns(links);
  if (!extensionApi?.permissions?.request || !extensionApi.permissions.contains) return origins;
  const existing = await filterGrantedOrigins(extensionApi, origins);
  const existingSet = new Set(existing);
  const missing = origins.filter((origin) => !existingSet.has(origin));
  if (missing.length === 0) return existing;
  const granted = await extensionApi.permissions.request({ origins: missing });
  return granted ? origins : existing;
}

export async function removeLinkHealthPermissions(links: LinkCard[]) {
  const extensionApi = (globalThis as { chrome?: typeof chrome }).chrome;
  if (!extensionApi?.permissions?.remove) return false;
  const granted = extensionApi.permissions.getAll
    ? await extensionApi.permissions.getAll()
    : { origins: getLinkHealthOriginPatterns(links) };
  const origins = (granted.origins ?? []).filter((origin) => origin.startsWith('http://') || origin.startsWith('https://'));
  if (origins.length === 0) return false;
  return extensionApi.permissions.remove({ origins });
}

export async function checkLinksHealth(links: LinkCard[], permittedOrigins: string[], onProgress?: (summary: LinkHealthSummary) => void) {
  const allowed = new Set(permittedOrigins);
  const eligible = links.filter((link) => !link.deletedAt && /^https?:\/\//i.test(link.url));
  const queue = eligible.filter((link) => {
    try {
      return allowed.has(`${new URL(link.url).origin}/*`);
    } catch {
      return false;
    }
  });
  const summary: LinkHealthSummary = { checked: 0, healthy: 0, broken: 0, unknown: 0, skipped: eligible.length - queue.length };
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

async function filterGrantedOrigins(extensionApi: typeof chrome, origins: string[]) {
  const checks = await Promise.all(origins.map(async (origin) => ({
    origin,
    granted: await extensionApi.permissions.contains({ origins: [origin] })
  })));
  return checks.filter((check) => check.granted).map((check) => check.origin);
}

async function checkOneLink(url: string): Promise<{ status: LinkHealthStatus; httpStatus?: number }> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 8_000);
  try {
    let response = await globalThis.fetch(url, { method: 'HEAD', credentials: 'omit', redirect: 'follow', cache: 'no-store', signal: controller.signal });
    if (response.status === 405) {
      response = await globalThis.fetch(url, {
        method: 'GET',
        credentials: 'omit',
        redirect: 'follow',
        cache: 'no-store',
        headers: { Range: 'bytes=0-0' },
        signal: controller.signal
      });
    }
    if (response.status >= 200 && response.status < 400) return { status: 'healthy', httpStatus: response.status };
    if (response.status === 404 || response.status === 410) return { status: 'broken', httpStatus: response.status };
    return { status: 'unknown', httpStatus: response.status };
  } catch {
    return { status: 'unknown' };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
