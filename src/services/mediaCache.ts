import type { LinkCapture } from '../shared/types';

export async function cacheCaptureMedia(capture: LinkCapture): Promise<LinkCapture> {
  const [faviconUrl, thumbnailUrl] = await Promise.all([
    cacheRemoteImage(capture.faviconUrl, 256_000),
    cacheRemoteImage(capture.thumbnailUrl, 2_000_000)
  ]);
  return { ...capture, faviconUrl, thumbnailUrl };
}

async function cacheRemoteImage(url: string | undefined, maxBytes: number) {
  if (!url || url.startsWith('data:') || typeof fetch !== 'function') return url;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 2_500);
  try {
    const response = await globalThis.fetch(url, { credentials: 'omit', signal: controller.signal });
    if (!response.ok) return url;
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim();
    if (!contentType?.startsWith('image/')) return url;
    const declaredSize = Number(response.headers.get('content-length') ?? 0);
    if (declaredSize > maxBytes) return url;
    const blob = await response.blob();
    if (blob.size > maxBytes) return url;
    return await blobToDataUrl(blob, contentType);
  } catch {
    return url;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

async function blobToDataUrl(blob: Blob, contentType: string) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}
