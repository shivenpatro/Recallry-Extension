import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { listLinks } from '../data/repositories';
import type { LinkCard } from '../shared/types';

export function SnapshotApp() {
  const [link, setLink] = useState<LinkCard>();
  const [error, setError] = useState('');
  const linkId = new URLSearchParams(window.location.search).get('id');

  useEffect(() => {
    if (!linkId) {
      setError('Snapshot link is missing.');
      return;
    }
    void listLinks().then((links) => {
      const found = links.find((item) => item.id === linkId);
      if (!found?.snapshotHtml) setError(found?.isVaultProtected ? 'Unlock the Vault to read this snapshot.' : 'This card has no saved snapshot.');
      else setLink(found);
    }).catch(() => setError('This snapshot could not be opened.'));
  }, [linkId]);

  const documentHtml = useMemo(() => link?.snapshotHtml ? `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{max-width:760px;margin:48px auto;padding:0 24px;font:17px/1.7 Georgia,serif;color:#1a1714}h1,h2,h3{line-height:1.15}a{color:#c72f3d}pre{white-space:pre-wrap}table{max-width:100%;overflow:auto}</style></head><body>${link.snapshotHtml}</body></html>` : '', [link]);

  return (
    <main className="min-h-screen bg-paper p-6 text-ink">
      <header className="mx-auto mb-5 flex max-w-5xl items-center justify-between border-b-2 border-ink pb-4">
        <button className="grid h-10 w-10 place-items-center border border-ink bg-paper-soft transition hover:bg-ink hover:text-paper" onClick={() => globalThis.history.back()} title="Back"><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1 px-4">
          <div className="editorial-index text-[10px] uppercase tracking-wider text-vermillion">Offline snapshot</div>
          <h1 className="truncate font-display text-2xl font-semibold">{link?.title ?? 'Linkscape'}</h1>
        </div>
        {link ? <a className="grid h-10 w-10 place-items-center border border-ink bg-paper-soft transition hover:bg-ink hover:text-paper" href={link.url} target="_blank" rel="noreferrer" title="Open live page"><ExternalLink className="h-4 w-4" /></a> : null}
      </header>
      {error ? <p className="mx-auto max-w-5xl border border-ink bg-paper-soft p-6 text-sm">{error}</p> : null}
      {link ? <iframe className="mx-auto min-h-[calc(100vh-130px)] w-full max-w-5xl border border-ink bg-white" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={documentHtml} title={`Saved snapshot of ${link.title}`} /> : null}
    </main>
  );
}
