import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, ExternalLink, FolderPlus, Plus, RotateCcw, Save, Search } from 'lucide-react';
import '../styles/global.css';
import { Button } from '../components/Button';
import { IconGlyph } from '../components/IconGlyph';
import {
  createCollection,
  findDuplicateLink,
  listCollections,
  listRecentCollectionIds,
  saveCapturedLink,
  undoRecentlySavedLink
} from '../data/repositories';
import type { Collection, LinkCapture } from '../shared/types';
import { captureActiveTab } from '../services/capture';
import { isVaultUnlocked, restoreVaultSession } from '../services/vault';

export function PopupApp() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [capture, setCapture] = useState<LinkCapture | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [duplicateTitle, setDuplicateTitle] = useState('');
  const [recentCollectionIds, setRecentCollectionIds] = useState<string[]>([]);
  const [lastSavedLinkId, setLastSavedLinkId] = useState('');
  const [saveSnapshot, setSaveSnapshot] = useState(false);
  const activeCollections = useMemo(() => collections.filter((collection) => collection.status === 'active' && (!collection.isVaultProtected || isVaultUnlocked())), [collections]);
  const orderedCollections = useMemo(() => {
    const recentOrder = new Map(recentCollectionIds.map((id, index) => [id, index]));
    return [...activeCollections].sort((left, right) => {
      const leftRecent = recentOrder.get(left.id);
      const rightRecent = recentOrder.get(right.id);
      if (leftRecent !== undefined || rightRecent !== undefined) return (leftRecent ?? Number.MAX_SAFE_INTEGER) - (rightRecent ?? Number.MAX_SAFE_INTEGER);
      if (left.isPinned !== right.isPinned) return left.isPinned ? -1 : 1;
      return left.order - right.order;
    });
  }, [activeCollections, recentCollectionIds]);
  const parsedTags = useMemo(() => tags.split(',').map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean), [tags]);

  useEffect(() => {
    void restoreVaultSession().then(() => Promise.all([listCollections(), captureActiveTab(), listRecentCollectionIds()]))
      .then(([nextCollections, nextCapture, nextRecentIds]) => {
        setCollections(nextCollections);
        setCapture(nextCapture);
        setRecentCollectionIds(nextRecentIds);
        setSelectedCollectionId(nextRecentIds.find((id) => nextCollections.some((collection) => collection.id === id)) ?? nextCollections[0]?.id ?? '');
      })
      .catch((error) => {
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'The current page cannot be captured');
      });
  }, []);

  useEffect(() => {
    let active = true;
    if (!capture || !selectedCollectionId || lastSavedLinkId) {
      setDuplicateTitle('');
      return () => { active = false; };
    }
    void findDuplicateLink(selectedCollectionId, capture.url)
      .then((duplicate) => {
        if (active) setDuplicateTitle(duplicate?.title ?? '');
      })
      .catch(() => {
        if (active) setDuplicateTitle('');
      });
    return () => { active = false; };
  }, [capture, lastSavedLinkId, selectedCollectionId]);

  async function save() {
    if (!capture || !selectedCollectionId) return;
    setStatus('saving');
    setErrorMessage('');
    try {
      const captureToSave = saveSnapshot ? await captureActiveTab(true) : capture;
      const link = await saveCapturedLink(selectedCollectionId, captureToSave, notes, parsedTags);
      setLastSavedLinkId(link.id);
      setRecentCollectionIds(await listRecentCollectionIds());
      setStatus('saved');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'The page could not be saved');
    }
  }

  async function saveToNewCollection() {
    const title = prompt('New collection name');
    if (!title?.trim() || !capture) return;
    setStatus('saving');
    setErrorMessage('');
    try {
      const collection = await createCollection({ title: title.trim() });
      const captureToSave = saveSnapshot ? await captureActiveTab(true) : capture;
      const link = await saveCapturedLink(collection.id, captureToSave, notes, parsedTags);
      setCollections(await listCollections());
      setSelectedCollectionId(collection.id);
      setLastSavedLinkId(link.id);
      setRecentCollectionIds(await listRecentCollectionIds());
      setStatus('saved');
      void chrome?.runtime?.sendMessage?.({ type: 'RECALLRY_REFRESH_CONTEXT_MENUS' });
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'The collection could not be created');
    }
  }

  async function undoSave() {
    if (!lastSavedLinkId) return;
    await undoRecentlySavedLink(lastSavedLinkId);
    setLastSavedLinkId('');
    setStatus('idle');
  }

  function openDashboard() {
    const extensionApi = (globalThis as { chrome?: typeof chrome }).chrome;
    if (extensionApi?.runtime?.sendMessage) {
      void extensionApi.runtime.sendMessage({ type: 'RECALLRY_OPEN_DASHBOARD' });
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
          <h1 className="font-display text-2xl font-medium leading-none tracking-tightest">Recallry</h1>
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
            {orderedCollections.map((collection) => (
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
        <label className="flex items-center gap-3 border border-ink bg-paper-soft px-3 py-2.5 text-xs font-semibold text-ink">
          <input className="h-4 w-4 accent-vermillion" type="checkbox" checked={saveSnapshot} onChange={(event) => setSaveSnapshot(event.target.checked)} />
          Save a private offline reading snapshot
        </label>
      </div>

      {/* Actions */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button className="col-span-2" onClick={save} disabled={!capture || !selectedCollectionId || status === 'saving' || Boolean(duplicateTitle)}>
          {status === 'saved' ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : duplicateTitle ? 'Already Saved' : 'Save Current Page'}
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
      {duplicateTitle ? <p className="mt-3 border-l-2 border-ink pl-3 text-xs leading-5 text-ink-soft" role="status">Already saved as <strong>{duplicateTitle}</strong> in this collection.</p> : null}
      {errorMessage ? <p className="mt-3 border-l-2 border-vermillion pl-3 text-xs leading-5 text-vermillion" role="alert">{errorMessage}</p> : null}
      {status === 'saved' && lastSavedLinkId ? (
        <button className="mt-3 flex items-center gap-2 text-xs font-semibold uppercase text-ink underline-offset-4 hover:underline" onClick={undoSave}>
          <RotateCcw className="h-3.5 w-3.5" /> Undo save
        </button>
      ) : null}

      {/* Pinned spaces */}
      <div className="mt-4 space-y-1">
        <div className="flex items-center justify-between border-b border-slate-rule px-1 pb-2">
          <span className="editorial-index text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft/50">Recent &amp; pinned</span>
          <Plus className="h-3.5 w-3.5 text-ink-soft/40" />
        </div>
        <AnimatePresence>
          {orderedCollections.filter((collection) => collection.isPinned || recentCollectionIds.includes(collection.id)).slice(0, 4).map((collection, i) => (
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
