import Papa from 'papaparse';
import type { BackupEnvelope, LinkCapture, LinkCard } from '../shared/types';
import { createBackup, createCollection, restoreBackup, saveCapturedLink, validateBackup } from '../data/repositories';
import { DEFAULT_COLLECTION_ID } from '../shared/constants';
import { normalizeWebsiteUrl, safeDomain } from '../shared/utils';

export async function exportAsJson() {
  const backup = await createBackup();
  return JSON.stringify(backup, null, 2);
}

export function exportLinksAsCsv(links: LinkCard[]) {
  return Papa.unparse(
    links.map((link) => ({
      title: spreadsheetSafe(link.title),
      url: spreadsheetSafe(link.url),
      domain: spreadsheetSafe(link.domain),
      notes: spreadsheetSafe(link.notes),
      tags: spreadsheetSafe(link.tags.join('|')),
      labels: spreadsheetSafe(link.labels.join('|')),
      dateSaved: link.createdAt
    }))
  );
}

export function exportLinksAsHtml(links: LinkCard[]) {
  const rows = links
    .map(
      (link) =>
        `<DT><A HREF="${escapeHtml(link.url)}" ADD_DATE="${Math.floor(new Date(link.createdAt).getTime() / 1000)}" TAGS="${escapeHtml(
          link.tags.join(',')
        )}">${escapeHtml(link.title)}</A>`
    )
    .join('\n');
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Linkscape Export</TITLE>
<H1>Linkscape Export</H1>
<DL><p>
${rows}
</DL><p>`;
}

export async function importBackup(json: string) {
  const parsed = JSON.parse(json) as BackupEnvelope;
  if (!parsed.version || !Array.isArray(parsed.collections) || !Array.isArray(parsed.links)) {
    throw new Error('Invalid Linkscape backup');
  }
  await restoreBackup(parsed);
  return parsed;
}

export interface ImportPreview {
  kind: 'backup' | 'bookmarks' | 'csv';
  collections: number;
  links: number;
  tags: number;
  skipped: number;
}

export function previewImport(filename: string, text: string): ImportPreview {
  const normalizedName = filename.toLocaleLowerCase();
  if (normalizedName.endsWith('.json')) {
    const backup = JSON.parse(text) as BackupEnvelope;
    validateBackup(backup);
    return { kind: 'backup', collections: backup.collections.length, links: backup.links.length, tags: backup.tags.length, skipped: 0 };
  }
  if (normalizedName.endsWith('.csv')) {
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    if (parsed.errors.length > 0) throw new Error(parsed.errors[0]?.message ?? 'CSV import failed');
    const valid = parsed.data.filter((row) => Boolean(row.url || row.URL || row.href)).length;
    return { kind: 'csv', collections: 0, links: valid, tags: 0, skipped: parsed.data.length - valid };
  }
  const document = new DOMParser().parseFromString(text, 'text/html');
  const anchors = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')];
  let valid = 0;
  for (const anchor of anchors) {
    try {
      normalizeWebsiteUrl(anchor.href);
      valid += 1;
    } catch {
      // Invalid bookmark URLs are reported before import and skipped by the source exporter.
    }
  }
  return {
    kind: 'bookmarks',
    collections: document.querySelectorAll('h3').length,
    links: valid,
    tags: 0,
    skipped: anchors.length - valid
  };
}

export async function importBookmarkHtml(html: string, collectionId = DEFAULT_COLLECTION_ID) {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');
  const anchors = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')];
  const captures = new Map<HTMLAnchorElement, LinkCapture>();
  for (const anchor of anchors) {
    try {
      const url = normalizeWebsiteUrl(anchor.href);
      captures.set(anchor, { title: anchor.textContent?.trim() || url, url, domain: safeDomain(url) });
    } catch {
      // Browser bookmark exports can contain internal URLs that extensions cannot open.
    }
  }

  let imported = 0;
  async function saveAnchor(anchor: HTMLAnchorElement, destinationId: string) {
    const capture = captures.get(anchor);
    if (!capture) return;
    try {
      await saveCapturedLink(destinationId, capture);
      imported += 1;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('already saved')) throw error;
    }
  }

  async function importList(list: Element, parentId: string) {
    const children = [...list.children];
    for (let index = 0; index < children.length; index += 1) {
      const item = children[index];
      if (item.tagName === 'DT') {
        const heading = [...item.children].find((child) => child.tagName === 'H3');
        const anchor = [...item.children].find((child): child is HTMLAnchorElement => child.tagName === 'A');
        if (heading) {
          const folder = await createCollection({ title: heading.textContent?.trim() || 'Imported folder', parentId });
          const nested = [...item.children].find((child) => child.tagName === 'DL')
            ?? (children[index + 1]?.tagName === 'DL' ? children[++index] : undefined);
          if (nested) await importList(nested, folder.id);
        } else if (anchor) {
          await saveAnchor(anchor, parentId);
        }
      }
    }
  }

  const rootList = document.querySelector('dl');
  if (rootList) await importList(rootList, collectionId);
  else for (const anchor of anchors) await saveAnchor(anchor, collectionId);
  return imported;
}

export async function importCsv(csv: string, collectionId = DEFAULT_COLLECTION_ID) {
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message ?? 'CSV import failed');
  }
  const rows = parsed.data.flatMap((row) => {
    const url = row.url || row.URL || row.href;
    if (!url) return [];
    const normalizedUrl = normalizeWebsiteUrl(url);
    return [{ row, normalizedUrl }];
  });
  let imported = 0;
  for (const { row, normalizedUrl } of rows) {
    try {
      await saveCapturedLink(collectionId, { title: row.title || row.Title || normalizedUrl, url: normalizedUrl, domain: row.domain || safeDomain(normalizedUrl) }, row.notes || '', (row.tags || '').split('|').filter(Boolean));
      imported += 1;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('already saved')) throw error;
    }
  }
  return imported;
}

function spreadsheetSafe(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return entities[char] ?? char;
  });
}
