import Papa from 'papaparse';
import type { BackupEnvelope, LinkCapture, LinkCard } from '../shared/types';
import { createBackup, restoreBackup, saveCapturedLink } from '../data/repositories';
import { DEFAULT_COLLECTION_ID } from '../shared/constants';
import { safeDomain } from '../shared/utils';

export async function exportAsJson() {
  const backup = await createBackup();
  return JSON.stringify(backup, null, 2);
}

export function exportLinksAsCsv(links: LinkCard[]) {
  return Papa.unparse(
    links.map((link) => ({
      title: link.title,
      url: link.url,
      domain: link.domain,
      notes: link.notes,
      tags: link.tags.join('|'),
      labels: link.labels.join('|'),
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

export async function importBookmarkHtml(html: string, collectionId = DEFAULT_COLLECTION_ID) {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');
  const anchors = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')];
  const captures: LinkCapture[] = anchors.map((anchor) => ({
    title: anchor.textContent?.trim() || anchor.href,
    url: anchor.href,
    domain: safeDomain(anchor.href)
  }));

  for (const capture of captures) {
    await saveCapturedLink(collectionId, capture);
  }

  return captures.length;
}

export async function importCsv(csv: string, collectionId = DEFAULT_COLLECTION_ID) {
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message ?? 'CSV import failed');
  }
  for (const row of parsed.data) {
    const url = row.url || row.URL || row.href;
    if (!url) continue;
    await saveCapturedLink(
      collectionId,
      {
        title: row.title || row.Title || url,
        url,
        domain: row.domain || safeDomain(url)
      },
      row.notes || '',
      (row.tags || '').split('|').filter(Boolean)
    );
  }
  return parsed.data.length;
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
