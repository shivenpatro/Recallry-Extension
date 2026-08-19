import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, ExternalLink, FolderPlus, Plus, Save, Search } from 'lucide-react';
import '../styles/global.css';
import { Button } from '../components/Button';
import { IconGlyph } from '../components/IconGlyph';
import { listCollections, saveCapturedLink, createCollection } from '../data/repositories';
import type { Collection, LinkCapture } from '../shared/types';
import { captureActiveTab } from '../services/capture';
import { safeDomain } from '../shared/utils';

export function PopupApp() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [capture, setCapture] = useState<LinkCapture | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const activeCollections = useMemo(() => collections.filter((collection) => collection.status === 'active'), [collections]);

  useEffect(() => {
    void Promise.all([listCollections(), captureActiveTab()])
      .then(([nextCollections, nextCapture]) => {
        setCollections(nextCollections);
        setCapture(nextCapture);
        setSelectedCollectionId(nextCollections[0]?.id ?? '');
      })
      .catch(() => {
        setCapture({
          title: 'Current page',
          url: 'https://example.com',
          domain: safeDomain('https://example.com')
        });
      });
  }, []);

  async function save() {
    if (!capture || !selectedCollectionId) return;
    setStatus('saving');
    try {
      await saveCapturedLink(
        selectedCollectionId,
        capture,
        notes,
        tags
          .split(',')
          .map((tag) => tag.trim().toLocaleLowerCase())
          .filter(Boolean)
      );
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  async function saveToNewCollection() {
    const title = prompt('New collection name');
    if (!title?.trim() || !capture) return;
    const collection = await createCollection({ title: title.trim() });
    setCollections(await listCollections());
    setSelectedCollectionId(collection.id);
    await saveCapturedLink(collection.id, capture, notes);
    setStatus('saved');
  }

  function openDashboard() {
    const extensionApi = (globalThis as { chrome?: typeof chrome }).chrome;
    if (extensionApi?.runtime?.sendMessage) {
      void extensionApi.runtime.sendMessage({ type: 'LINKSCAPE_OPEN_DASHBOARD' });
      window.close();
    } else {
      window.open('/dashboard.html', '_blank');
    }
  }

  return (
    <main className="min-h-[600px] w-[420px] overflow-hidden bg-paper p-4 text-ink">
      {/* Masthead */}
      <div className="mb-4 flex items-center justify-between border-b-2 border-ink pb-3">
        <div>
          <div className="editorial-index text-[9px] font-semibold uppercase tracking-[0.2em] text-vermillion">Issue 01 · 2026</div>
          <h1 className="font-display text-2xl font-medium leading-none tracking-tightest">Linkscape</h1>
        </div>
        <button className="grid h-9 w-9 place-items-center border border-ink bg-paper-soft text-ink transition hover:bg-ink hover:text-paper" onClick={openDashboard} title="Open dashboard">
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>

      {/* Capture preview card */}
      <section className="paper-card mb-4 p-4 shadow-editorial-sm">
        <div className="mb-3 flex items-center justify-between border-b border-slate-rule pb-2">
          <span className="editorial-index text-[10px] font-semibold uppercase tracking-[0.14em] text-vermillion">{capture?.domain ?? 'loading'}</span>
          {capture?.faviconUrl ? <img className="h-5 w-5" src={capture.faviconUrl} alt="" /> : null}
        </div>
        <h2 className="font-display text-lg font-semibold leading-tight tracking-tight line-clamp-2">{capture?.title ?? 'Reading current tab...'}</h2>
        <p className="mt-1 truncate text-xs text-ink-soft/50">{capture?.url}</p>
      </section>

      {/* Form fields */}
      <div className="space-y-3">
        <label className="block">
          <span className="editorial-index mb-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft/50">Collection</span>
          <select
            className="h-11 w-full border border-ink bg-paper-soft px-3 text-sm font-semibold text-ink outline-none focus:border-vermillion"
            value={selectedCollectionId}
            onChange={(event) => setSelectedCollectionId(event.target.value)}
          >
            {activeCollections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.title}
              </option>
            ))}
          </select>
        </label>

        <textarea
          className="min-h-24 w-full resize-none border border-ink bg-paper-soft px-3 py-3 text-sm text-ink outline-none placeholder:text-ink-soft/40 focus:border-vermillion"
          placeholder="Add notes…"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />

        <div className="flex items-center gap-2 border border-ink bg-paper-soft px-3">
          <Search className="h-4 w-4 text-ink-soft/50" />
          <input
            className="h-11 min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/40"
            placeholder="tags, separated, by commas"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button className="col-span-2" onClick={save} disabled={!capture || !selectedCollectionId || status === 'saving'}>
          {status === 'saved' ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save Current Page'}
        </Button>
        <Button variant="ghost" onClick={saveToNewCollection}>
          <FolderPlus className="h-4 w-4" />
          New
        </Button>
        <Button variant="ghost" onClick={openDashboard}>
          Dashboard
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Pinned spaces */}
      <div className="mt-4 space-y-1">
        <div className="flex items-center justify-between border-b border-slate-rule px-1 pb-2">
          <span className="editorial-index text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft/50">Pinned spaces</span>
          <Plus className="h-3.5 w-3.5 text-ink-soft/40" />
        </div>
        <AnimatePresence>
          {activeCollections.slice(0, 4).map((collection, i) => (
            <motion.button
              key={collection.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className={cnFlex(collection.id === selectedCollectionId)}
              onClick={() => setSelectedCollectionId(collection.id)}
            >
              <span className="editorial-index text-[10px] font-semibold text-vermillion">{String(i + 1).padStart(2, '0')}</span>
              <span className="grid h-7 w-7 place-items-center border border-ink bg-paper-soft [&_*]:h-3.5 [&_*]:w-3.5">
                <IconGlyph name={collection.icon} className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{collection.title}</span>
              {collection.id === selectedCollectionId ? <Check className="h-4 w-4 text-vermillion" /> : null}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </main>
  );
}

function cnFlex(active: boolean) {
  return [
    'flex w-full items-center gap-3 px-2 py-2.5 text-left text-sm transition',
    active ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-slate-rule/40 hover:text-ink'
  ]
    .filter(Boolean)
    .join(' ');
}
