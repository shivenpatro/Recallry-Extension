import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, RotateCcw, Tags, Trash2, X } from 'lucide-react';
import { useLinkscapeStore } from '../../store/linkscapeStore';
import { Button } from '../../components/Button';
import { exportLinksAsCsv } from '../../services/importExport';
import { downloadText } from '../../shared/utils';
import { isVaultUnlocked } from '../../services/vault';

export function BulkActionBar() {
  const selected = useLinkscapeStore((state) => state.selectedLinkIds);
  const allCollections = useLinkscapeStore((state) => state.collections);
  const allLinks = useLinkscapeStore((state) => state.links);
  const clearSelection = useLinkscapeStore((state) => state.clearSelection);
  const deleteSelectedLinks = useLinkscapeStore((state) => state.deleteSelectedLinks);
  const restoreSelectedLinks = useLinkscapeStore((state) => state.restoreSelectedLinks);
  const permanentlyDeleteSelectedLinks = useLinkscapeStore((state) => state.permanentlyDeleteSelectedLinks);
  const moveSelectedLinks = useLinkscapeStore((state) => state.moveSelectedLinks);
  const archiveSelectedLinks = useLinkscapeStore((state) => state.archiveSelectedLinks);
  const tagSelectedLinks = useLinkscapeStore((state) => state.tagSelectedLinks);
  const collections = useMemo(() => allCollections.filter((collection) => collection.status === 'active' && (!collection.isVaultProtected || isVaultUnlocked())), [allCollections]);
  const selectedLinks = useMemo(() => allLinks.filter((link) => selected.includes(link.id)), [allLinks, selected]);
  const selectedAreTrashed = selectedLinks.length > 0 && selectedLinks.every((link) => Boolean(link.deletedAt));

  async function tagSelected() {
    const tag = prompt('Tag selected cards');
    if (!tag?.trim()) return;
    await tagSelectedLinks(tag);
  }

  function exportSelected() {
    downloadText('linkscape-selected-links.csv', 'text/csv', exportLinksAsCsv(selectedLinks));
  }

  return (
    <AnimatePresence>
      {selected.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 24, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 20, x: '-50%' }}
          className="fixed bottom-6 left-1/2 z-40 flex items-center gap-1 border-2 border-ink bg-paper-soft px-2 py-2 shadow-editorial"
        >
          <span className="editorial-index px-3 text-xs font-bold uppercase tracking-wider text-ink">
            <span className="text-vermillion">{selected.length}</span> selected
          </span>
          <div className="mx-1 h-6 w-px bg-ink/20" />
          {!selectedAreTrashed ? <select
            className="h-9 border border-ink bg-paper px-3 text-xs font-semibold uppercase tracking-wider text-ink outline-none"
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) void moveSelectedLinks(event.target.value);
            }}
            title="Move selected"
          >
            <option value="" disabled>
              Move to…
            </option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.title}
              </option>
            ))}
          </select> : null}
          {!selectedAreTrashed ? <Button variant="ghost" onClick={tagSelected}>
            <Tags className="h-3.5 w-3.5" />
            Tag
          </Button> : null}
          {!selectedAreTrashed ? <Button variant="ghost" onClick={exportSelected}>
            Export
          </Button> : null}
          {!selectedAreTrashed ? <Button variant="ghost" onClick={() => void archiveSelectedLinks()}>
            <Archive className="h-3.5 w-3.5" />
            Archive
          </Button> : null}
          {selectedAreTrashed ? <Button variant="ghost" onClick={() => void restoreSelectedLinks()}><RotateCcw className="h-3.5 w-3.5" /> Restore</Button> : null}
          <Button variant="danger" onClick={() => {
            if (selectedAreTrashed) {
              if (window.confirm(`Permanently delete ${selected.length} selected ${selected.length === 1 ? 'card' : 'cards'}? This cannot be undone.`)) void permanentlyDeleteSelectedLinks();
            } else if (window.confirm(`Move ${selected.length} selected ${selected.length === 1 ? 'card' : 'cards'} to Trash?`)) {
              void deleteSelectedLinks();
            }
          }}>
            <Trash2 className="h-3.5 w-3.5" />
            {selectedAreTrashed ? 'Delete forever' : 'Trash'}
          </Button>
          <button className="grid h-9 w-9 place-items-center text-ink-soft transition hover:bg-ink hover:text-paper" onClick={clearSelection} title="Clear selection">
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
