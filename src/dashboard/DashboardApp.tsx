import { useEffect, useMemo, useState } from 'react';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { Archive, Download, Grid2X2, Link2, Upload } from 'lucide-react';
import { useRecallryStore } from '../store/recallryStore';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { COLLECTION_THEMES } from '../shared/constants';
import { cn, downloadText, faviconForUrl, safeDomain } from '../shared/utils';
import { filterLinks, matchesSmartRules } from '../services/search';
import { exportAsJson, exportLinksAsCsv, exportLinksAsHtml, importBackup, importBookmarkHtml, importCsv, previewImport } from '../services/importExport';
import { createAutomaticBackup } from '../services/backups';
import { Sidebar, MobileNavBar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { CollectionCard } from './components/CollectionCard';
import { LinkCardItem } from './components/LinkCardItem';
import { Spotlight } from './components/Spotlight';
import { BulkActionBar } from './components/BulkActionBar';
import { VaultPanel } from './components/VaultPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { isVaultUnlocked, lockVault, touchVaultSession } from '../services/vault';

type ViewMode = 'collections' | 'collection' | 'favorites' | 'archived' | 'trash' | 'vault' | 'settings';

export function DashboardApp() {
  const {
    collections,
    links,
    selectedCollectionId,
    selectedLinkIds,
    searchQuery,
    isSearchOpen,
    isLoading,
    error,
    init,
    setSelectedCollection,
    setSearchQuery,
    setSearchOpen,
    createCollection,
    saveLink,
    reorderLinks,
    reorderCollections,
    refresh
  } = useRecallryStore();
  const [viewMode, setViewMode] = useState<ViewMode>('collections');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (window.location.hash === '#search' || new URLSearchParams(window.location.search).get('search') === '1') {
      setSearchOpen(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [setSearchOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isCommand = event.metaKey || event.ctrlKey;
      if (isCommand && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (isCommand && event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        chrome?.runtime?.sendMessage?.({ type: 'RECALLRY_SAVE_ACTIVE_TAB' });
      }
      if (isCommand && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        chrome?.runtime?.sendMessage?.({ type: 'RECALLRY_LOCK_VAULT' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setSearchOpen]);

  useEffect(() => {
    const extensionApi = (globalThis as { chrome?: typeof chrome }).chrome;
    const listener = (message: { type?: string }) => {
      if (message.type === 'RECALLRY_VAULT_LOCKED') {
        useRecallryStore.getState().clearSelection();
        void lockVault().then(() => refresh());
      }
    };
    extensionApi?.runtime?.onMessage?.addListener(listener);
    return () => extensionApi?.runtime?.onMessage?.removeListener(listener);
  }, [refresh]);

  useEffect(() => {
    const onActivity = () => void touchVaultSession();
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity);
    return () => {
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, []);

  useEffect(() => {
    const handleAutoLock = () => {
      useRecallryStore.getState().clearSelection();
      void refresh();
    };
    window.addEventListener('recallry-vault-locked', handleAutoLock);
    return () => window.removeEventListener('recallry-vault-locked', handleAutoLock);
  }, [refresh]);

  const vaultUnlocked = isVaultUnlocked();
  const accessibleCollections = collections.filter((collection) => !collection.isVaultProtected || vaultUnlocked);
  const activeCollections = accessibleCollections.filter((collection) => collection.status === 'active');
  const archivedCollections = accessibleCollections.filter((collection) => collection.status === 'archived');
  const trashedCollections = accessibleCollections.filter((collection) => collection.status === 'trashed');
  const favoriteCollections = activeCollections.filter((collection) => collection.isFavorite);
  const visibleCollections = viewMode === 'favorites' ? favoriteCollections : viewMode === 'archived' ? archivedCollections : viewMode === 'trash' ? trashedCollections : activeCollections;
  const selectedCollection = collections.find((collection) => collection.id === selectedCollectionId) ?? activeCollections[0];
  const selectedCollectionLocked = Boolean(selectedCollection?.isVaultProtected && !vaultUnlocked);
  const selectedCollectionLinks = useMemo(() => {
    if (!selectedCollection) return [];
    const direct = links.filter((link) => link.collectionId === selectedCollection.id && !link.isArchived && !link.deletedAt && (!link.isVaultProtected || vaultUnlocked));
    const smart = selectedCollection.smartRules
      ? links.filter((link) => !link.isArchived && !link.deletedAt && (!link.isVaultProtected || vaultUnlocked) && matchesSmartRules(link, selectedCollection.smartRules))
      : [];
    return filterLinks([...direct, ...smart.filter((link) => !direct.some((directLink) => directLink.id === link.id))], searchQuery, tagFilter);
  }, [links, searchQuery, selectedCollection, tagFilter, vaultUnlocked]);
  const allTags = [...new Set(links.filter((link) => !link.deletedAt).flatMap((link) => link.tags))].sort();
  const archivedLinks = links.filter((link) => link.isArchived && !link.deletedAt && (!link.isVaultProtected || vaultUnlocked));
  const trashedLinks = links.filter((link) => link.deletedAt && !link.deletedWithCollectionId && (!link.isVaultProtected || vaultUnlocked));

  async function handleCreateCollection() {
    const title = prompt('Collection name');
    if (!title?.trim()) return;
    await createCollection(title.trim());
    setViewMode('collection');
  }

  async function handleOpenCollection(collectionId: string) {
    const collection = collections.find((item) => item.id === collectionId);
    if (!collection) return;
    if (collection.status === 'trashed') {
      setViewMode('trash');
      return;
    }
    if (collection.isVaultProtected && !isVaultUnlocked()) {
      setViewMode('vault');
      return;
    }
    setSelectedCollection(collectionId);
    setViewMode('collection');
  }

  async function handleAddWebsite(collectionId = selectedCollection?.id) {
    if (!collectionId) return;
    const rawUrl = prompt('Website URL');
    if (!rawUrl?.trim()) return;
    const normalizedUrl = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(normalizedUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Unsupported protocol');
    } catch {
      window.alert('Enter a valid http(s) website URL.');
      return;
    }
    const title = prompt('Card title', parsedUrl.hostname.replace(/^www\./, ''));
    if (title === null) return;
    const notes = prompt('Notes (optional)', '') ?? '';
    const tagInput = prompt('Tags separated by commas (optional)', '') ?? '';
    try {
      await saveLink(
        collectionId,
        {
          title: title.trim() || parsedUrl.href,
          url: parsedUrl.href,
          domain: safeDomain(parsedUrl.href),
          faviconUrl: faviconForUrl(parsedUrl.href)
        },
        notes,
        tagInput.split(',').map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean)
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'The website could not be saved');
    }
  }

  async function handleCollectionDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = visibleCollections.findIndex((collection) => collection.id === active.id);
    const newIndex = visibleCollections.findIndex((collection) => collection.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(visibleCollections, oldIndex, newIndex).map((collection) => collection.id);
    await reorderCollections(next);
  }

  async function handleLinkDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedCollection) return;
    const directLinks = selectedCollectionLinks.filter((link) => link.collectionId === selectedCollection.id);
    if (!directLinks.some((link) => link.id === active.id) || !directLinks.some((link) => link.id === over.id)) return;
    const oldIndex = directLinks.findIndex((link) => link.id === active.id);
    const newIndex = directLinks.findIndex((link) => link.id === over.id);
    const next = arrayMove(directLinks, oldIndex, newIndex).map((link) => link.id);
    await reorderLinks(selectedCollection.id, next);
  }

  async function handleExport(format: 'json' | 'csv' | 'html') {
    if (format === 'json') {
      downloadText('recallry-backup.json', 'application/json', await exportAsJson());
      return;
    }
    if (format === 'csv') {
      downloadText('recallry-links.csv', 'text/csv', exportLinksAsCsv(links));
      return;
    }
    downloadText('recallry-bookmarks.html', 'text/html', exportLinksAsHtml(links));
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text();
      const filename = file.name.toLocaleLowerCase();
      const preview = previewImport(file.name, text);
      const previewMessage = preview.kind === 'backup'
        ? `Restore ${preview.collections} collections and ${preview.links} cards from this backup? Your current data will be downloaded and checkpointed first.`
        : `Import ${preview.links} websites${preview.collections ? ` and ${preview.collections} folders` : ''} into the selected collection?${preview.skipped ? ` ${preview.skipped} invalid rows will be skipped.` : ''}`;
      if (!window.confirm(previewMessage)) return;
      await createAutomaticBackup('before-import');
      if (filename.endsWith('.json')) {
        downloadText(`recallry-before-restore-${new Date().toISOString().slice(0, 10)}.json`, 'application/json', await exportAsJson());
        await importBackup(text);
      } else {
        if (filename.endsWith('.csv')) await importCsv(text, selectedCollectionId);
        else await importBookmarkHtml(text, selectedCollectionId);
      }
      await refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Import failed');
    }
  }

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper">
        <motion.div
          className="paper-card px-8 py-6 font-display text-lg font-medium text-ink shadow-editorial"
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        >
          Opening Recallry
        </motion.div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper p-6 text-ink">
        <div className="paper-card max-w-lg p-8 shadow-editorial">
          <h1 className="font-display text-3xl font-medium">Recallry could not open</h1>
          <p className="mt-3 text-sm leading-6 text-ink-soft">{error}</p>
          <Button className="mt-5" onClick={() => void init()}>Try again</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-paper text-ink">
      <div className="flex min-h-screen">
        <Sidebar
          collections={activeCollections}
          selectedId={selectedCollectionId}
          viewMode={viewMode}
          onSelectCollection={(id) => void handleOpenCollection(id)}
          onSelectView={setViewMode}
        />

        <section className="flex min-w-0 flex-1 flex-col">
          <TopBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onOpenSearch={() => setSearchOpen(true)}
            onFilter={() => setSearchOpen(true)}
            onAdd={handleCreateCollection}
          />

          <div className="flex min-h-0 flex-1 flex-col px-6 pb-6">
              {viewMode === 'collections' || viewMode === 'favorites' || viewMode === 'archived' || viewMode === 'trash' ? (
                <motion.div
                  key={viewMode}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="min-h-0 flex-1 overflow-y-auto pr-2"
                >
                  <div className="mb-8 flex items-end justify-between border-b-2 border-ink pb-5">
                    <div>
                      <div className="editorial-index mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-vermillion">
                        {viewMode === 'favorites' ? 'Curated picks' : viewMode === 'archived' ? 'The stacks' : viewMode === 'trash' ? 'Recovery' : 'The archive'}
                      </div>
                      <h1 className="font-display text-6xl font-medium leading-[0.9] tracking-tightest text-ink">
                        {viewMode === 'favorites' ? 'Favorites' : viewMode === 'archived' ? 'Archived' : viewMode === 'trash' ? 'Trash' : 'Collections'}
                      </h1>
                      <p className="mt-3 max-w-md text-sm leading-6 text-ink-soft">
                        {viewMode === 'favorites'
                          ? 'The spaces you keep coming back to.'
                          : viewMode === 'archived'
                            ? 'Quietly shelved, never lost.'
                            : viewMode === 'trash'
                              ? 'Restore mistakes or permanently remove what you no longer need.'
                            : 'Visual workspaces for every corner of the web.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ImportButton onImport={handleImport} />
                      <ExportMenu onExport={handleExport} />
                    </div>
                  </div>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCollectionDragEnd}>
                     <SortableContext items={visibleCollections.map((collection) => collection.id)} strategy={rectSortingStrategy}>
                       {visibleCollections.length === 0 && !(viewMode === 'archived' && archivedLinks.length > 0) && !(viewMode === 'trash' && trashedLinks.length > 0) ? (
                         <EmptyState
                           title={viewMode === 'favorites' ? 'No favorite collections' : viewMode === 'archived' ? 'Nothing archived' : viewMode === 'trash' ? 'Trash is empty' : 'No collections yet'}
                           body={viewMode === 'favorites' ? 'Favorite a collection from its actions menu to keep it close.' : viewMode === 'archived' ? 'Archived collections will appear here.' : viewMode === 'trash' ? 'Deleted collections and cards will stay here until you remove them permanently.' : 'Create your first visual space to start saving websites.'}
                           action={viewMode === 'collections' ? 'Create collection' : undefined}
                           onAction={viewMode === 'collections' ? handleCreateCollection : undefined}
                         />
                       ) : (
                         <>
                         <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
                           {visibleCollections.map((collection, index) => (
                              <CollectionCard
                               key={collection.id}
                               collection={collection}
                               index={index}
                                count={links.filter((link) => link.collectionId === collection.id && !link.isArchived && (viewMode === 'trash' ? Boolean(link.deletedAt) : !link.deletedAt)).length}
                                onOpenVault={() => setViewMode('vault')}
                               onOpen={() => {
                               void handleOpenCollection(collection.id);
                               }}
                             />
                           ))}
                         </div>
                         {viewMode === 'archived' && archivedLinks.length > 0 ? (
                           <section className="mt-10 border-t-2 border-ink pt-6">
                             <div className="editorial-index mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-vermillion">
                               Archived cards · {archivedLinks.length}
                             </div>
                             <div className="masonry pb-24">
                               {archivedLinks.map((link) => <LinkCardItem key={link.id} link={link} selected={selectedLinkIds.includes(link.id)} />)}
                             </div>
                           </section>
                         ) : null}
                         {viewMode === 'trash' && trashedLinks.length > 0 ? (
                           <section className="mt-10 border-t-2 border-ink pt-6">
                             <div className="editorial-index mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-vermillion">
                               Deleted cards · {trashedLinks.length}
                             </div>
                             <div className="masonry pb-24">
                               {trashedLinks.map((link) => <LinkCardItem key={link.id} link={link} selected={selectedLinkIds.includes(link.id)} />)}
                             </div>
                           </section>
                         ) : null}
                         </>
                       )}
                     </SortableContext>
                  </DndContext>
                </motion.div>
              ) : null}

              {viewMode === 'collection' && selectedCollection ? (
                <motion.div
                  key="collection"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="min-h-0 flex-1 overflow-y-auto pr-2"
                >
                  {selectedCollectionLocked ? (
                    <EmptyState
                      title="Vault locked"
                      body="Unlock the Vault with your master password to view this protected collection."
                      action="Unlock collection"
                      onAction={() => setViewMode('vault')}
                    />
                  ) : (
                   <>
                   <div className="mb-8 border-b-2 border-ink pb-6">
                    <div className="mb-3 flex items-center gap-3">
                      <span className={cn('h-3 w-3', COLLECTION_THEMES[selectedCollection.theme])} aria-hidden />
                      <span className="editorial-index text-[10px] font-semibold uppercase tracking-[0.2em] text-vermillion">
                        {selectedCollectionLinks.length} {selectedCollectionLinks.length === 1 ? 'entry' : 'entries'}
                      </span>
                    </div>
                    <h1 className="font-display text-5xl font-medium leading-[0.9] tracking-tightest text-ink">{selectedCollection.title}</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">{selectedCollection.description || 'A polished space for saved links.'}</p>
                     <div className="mt-5 flex flex-wrap items-center gap-2">
                       <Button onClick={() => void handleAddWebsite()}>
                         <Link2 className="h-3.5 w-3.5" />
                         Add website
                       </Button>
                      {allTags.map((tag) => (
                        <button
                          key={tag}
                          className={cn(
                            'editorial-index border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition',
                            tagFilter.includes(tag)
                              ? 'border-ink bg-ink text-paper'
                              : 'border-ink/30 bg-transparent text-ink-soft hover:border-ink hover:text-ink'
                          )}
                          onClick={() =>
                            setTagFilter((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]))
                          }
                        >
                          {tag}
                        </button>
                      ))}
                      <Button variant="ghost" onClick={() => useRecallryStore.getState().updateCollection(selectedCollection.id, { isFavorite: !selectedCollection.isFavorite })}>
                        Favorite
                      </Button>
                    </div>
                  </div>

                   {selectedCollectionLinks.length === 0 ? (
                    <EmptyState
                      title="No cards here yet"
                      body="Save the current tab from the popup, right-click menu, or keyboard shortcut and it will appear here."
                       action="Add website"
                       onAction={() => void handleAddWebsite()}
                    />
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLinkDragEnd}>
                      <SortableContext items={selectedCollectionLinks.map((link) => link.id)} strategy={rectSortingStrategy}>
                        <div className="masonry pb-24">
                          {selectedCollectionLinks.map((link) => (
                            <LinkCardItem key={link.id} link={link} selected={selectedLinkIds.includes(link.id)} />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                   )}
                   </>
                  )}
                </motion.div>
              ) : null}

              {viewMode === 'vault' ? <VaultPanel key="vault" /> : null}
              {viewMode === 'settings' ? <SettingsPanel key="settings" onExport={handleExport} onImport={handleImport} /> : null}
          </div>
        </section>
      </div>

      <BulkActionBar />
      <Spotlight
        open={isSearchOpen}
        onClose={() => setSearchOpen(false)}
        onOpenCollection={(id) => {
          void handleOpenCollection(id);
        }}
      />
      <MobileNavBar viewMode={viewMode} onSelectView={setViewMode} />
    </main>
  );
}

function ImportButton({ onImport }: { onImport: (file: File) => Promise<void> }) {
  return (
    <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 border border-ink bg-paper-soft px-3 text-sm font-semibold text-ink transition hover:bg-ink hover:text-paper">
      <Upload className="h-4 w-4" aria-hidden />
      Import
      <input
        className="sr-only"
        type="file"
        accept=".json,.csv,.html,.htm"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void onImport(file);
          event.currentTarget.value = '';
        }}
      />
    </label>
  );
}

function ExportMenu({ onExport }: { onExport: (format: 'json' | 'csv' | 'html') => Promise<void> }) {
  return (
    <div className="flex items-center border border-ink bg-paper-soft">
      <button className="px-3 py-2.5 text-ink-soft transition hover:bg-ink hover:text-paper" title="Export JSON backup" onClick={() => void onExport('json')}>
        <Download className="h-4 w-4" aria-hidden />
      </button>
      <div className="h-5 w-px bg-ink/20" />
      <button className="px-3 py-2.5 text-ink-soft transition hover:bg-ink hover:text-paper" title="Export CSV" onClick={() => void onExport('csv')}>
        <Grid2X2 className="h-4 w-4" aria-hidden />
      </button>
      <div className="h-5 w-px bg-ink/20" />
      <button className="px-3 py-2.5 text-ink-soft transition hover:bg-ink hover:text-paper" title="Export bookmark HTML" onClick={() => void onExport('html')}>
        <Archive className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
