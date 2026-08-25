import { beforeEach, describe, expect, it } from 'vitest';
import { exportLinksAsCsv, importBookmarkHtml, previewImport } from '../src/services/importExport';
import type { LinkCard } from '../src/shared/types';
import { db } from '../src/data/db';
import { bootstrapRepository, listCollections, listLinks } from '../src/data/repositories';

describe('CSV export', () => {
  it('neutralizes spreadsheet formulas in user-controlled fields', () => {
    const link: LinkCard = {
      id: 'formula',
      collectionId: 'inbox',
      title: '=HYPERLINK("https://bad.example")',
      url: 'https://example.com',
      domain: 'example.com',
      notes: '@SUM(1+1)',
      tags: [],
      labels: [],
      order: 0,
      isArchived: false,
      isVaultProtected: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    };
    const csv = exportLinksAsCsv([link]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'@SUM");
  });
});

describe('bookmark import', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await bootstrapRepository();
  });

  it('preserves browser bookmark folder hierarchy', async () => {
    const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
      <DT><H3>Design</H3>
      <DL><p><DT><A HREF="https://example.com/design">Design reference</A></DL><p>
    </DL><p>`;
    await expect(importBookmarkHtml(html)).resolves.toBe(1);
    const folder = (await listCollections(true)).find((collection) => collection.title === 'Design');
    expect(folder).toMatchObject({ parentId: 'inbox' });
    await expect(listLinks(folder?.id)).resolves.toMatchObject([{ title: 'Design reference' }]);
  });

  it('previews browser bookmark imports before writing data', () => {
    const html = '<DL><DT><H3>Reading</H3><DL><DT><A HREF="https://example.com/read">Read</A></DL></DL>';
    expect(previewImport('bookmarks.html', html)).toEqual({ kind: 'bookmarks', collections: 1, links: 1, tags: 0, skipped: 0 });
  });

  it('reports invalid CSV rows in the preview', () => {
    expect(previewImport('links.csv', 'title,url\nValid,https://example.com\nMissing,')).toEqual({ kind: 'csv', collections: 0, links: 1, tags: 0, skipped: 1 });
  });
});
