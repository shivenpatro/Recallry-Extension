import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { Menu } from '@headlessui/react';
import { Archive, Copy, GripVertical, Lock, MoreHorizontal, Palette, Pencil, Pin, RotateCcw, Star, Trash2, Unlock } from 'lucide-react';
import type { Collection } from '../../shared/types';
import { COLLECTION_THEMES } from '../../shared/constants';
import { cn } from '../../shared/utils';
import { useRecallryStore } from '../../store/recallryStore';
import { isVaultUnlocked } from '../../services/vault';
import { DEFAULT_COLLECTION_ID } from '../../shared/constants';
import { useDialog } from '../../components/DialogProvider';

interface CollectionCardProps {
  collection: Collection;
  count: number;
  index: number;
  onOpen: () => void;
  onOpenVault: () => void;
}

export function CollectionCard({ collection, count, index, onOpen, onOpenVault }: CollectionCardProps) {
  const { alert, confirm, prompt: promptDialog } = useDialog();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: collection.id });
  const updateCollection = useRecallryStore((state) => state.updateCollection);
  const duplicateCollection = useRecallryStore((state) => state.duplicateCollection);
  const archiveCollection = useRecallryStore((state) => state.archiveCollection);
  const restoreCollection = useRecallryStore((state) => state.restoreCollection);
  const setCollectionProtection = useRecallryStore((state) => state.setCollectionProtection);
  const deleteCollection = useRecallryStore((state) => state.deleteCollection);
  const restoreDeletedCollection = useRecallryStore((state) => state.restoreDeletedCollection);
  const permanentlyDeleteCollection = useRecallryStore((state) => state.permanentlyDeleteCollection);
  const isTrashed = collection.status === 'trashed';
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  async function editDetails() {
    const description = await promptDialog({ title: 'Edit collection details', inputLabel: 'Description', initialValue: collection.description, multiline: true, confirmLabel: 'Continue' });
    if (description === null) return;
    const icon = await promptDialog({ title: 'Choose an icon', inputLabel: 'Icon name', initialValue: collection.icon, placeholder: 'Folder', confirmLabel: 'Continue' });
    if (icon === null) return;
    const theme = await promptDialog({ title: 'Choose a color theme', message: Object.keys(COLLECTION_THEMES).join(', '), inputLabel: 'Theme', initialValue: collection.theme, required: true, confirmLabel: 'Save details' });
    if (theme === null) return;
    if (!(theme in COLLECTION_THEMES)) {
      await alert({ title: 'Unknown color theme', message: 'Choose one of the listed color themes.' });
      return;
    }
    await updateCollection(collection.id, { description: description.trim(), icon: icon.trim() || 'Folder', theme: theme as Collection['theme'] });
  }

  return (
    <motion.article
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, scale: isDragging ? 1.01 : 1 }}
      whileHover={{ y: -2 }}
      className={cn(
        'paper-card group relative flex flex-col p-0 transition-shadow duration-200 hover:shadow-editorial-vermillion focus-within:z-40',
        isDragging && 'z-20 shadow-editorial'
      )}
      {...attributes}
    >
      {/* Top color bar — the one accent swatch per collection */}
      <div className={cn('h-1.5 w-full', COLLECTION_THEMES[collection.theme])} />

      <div className="flex flex-1 flex-col p-6">
        {/* Running head: index + drag handle + status */}
        <div className="flex items-center justify-between border-b border-slate-rule pb-3">
          <span className="editorial-index text-xs font-medium uppercase tracking-[0.18em] text-ink-soft">
            no. {String(index + 1).padStart(2, '0')}
          </span>
          <div className="flex items-center gap-1">
            {collection.isPinned ? <span className="text-[10px] font-bold uppercase tracking-wider text-vermillion">Pinned</span> : null}
            {collection.isFavorite ? <Star className="h-3 w-3 fill-vermillion text-vermillion" /> : null}
            <button
              className="cursor-grab p-1 text-ink-soft/40 transition hover:text-ink active:cursor-grabbing"
              {...listeners}
              title="Drag"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Title block — oversized editorial serif */}
        <button className="mt-5 block flex-1 text-left" onClick={onOpen} disabled={isTrashed}>
          <h2 className="font-display text-3xl font-medium leading-[0.95] tracking-tightest text-ink">
            {collection.title}
          </h2>
          <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-6 text-ink-soft">
            {collection.description || 'A curated visual space.'}
          </p>
        </button>

        {/* Footer meta — monospace readout */}
        <div className="mt-5 flex items-center justify-between">
          <button
            className="editorial-index text-xs font-medium uppercase tracking-[0.12em] text-ink transition hover:text-vermillion"
            onClick={onOpen}
            disabled={isTrashed}
          >
            <span className="text-vermillion">{String(count).padStart(2, '0')}</span> cards →
          </button>
          <span className="editorial-index text-xs text-ink-soft/50">
            {new Date(collection.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Triple-dots dropdown — now a working editorial menu */}
      <Menu as="div" className="absolute right-3 top-7 z-10">
        <Menu.Button aria-label={`Actions for ${collection.title}`} className="rounded-none p-1 text-ink-soft/40 transition hover:bg-ink hover:text-paper">
          <MoreHorizontal className="h-4 w-4" />
        </Menu.Button>
        <Menu.Items className="absolute right-0 top-full z-50 mt-1 w-44 border border-ink bg-paper-soft shadow-editorial-sm">
          <Menu.Item>
            {({ active }) => (
              <button
                className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition', active ? 'bg-ink text-paper' : 'text-ink')}
                onClick={async () => {
                  const title = await promptDialog({ title: 'Rename collection', inputLabel: 'Collection name', initialValue: collection.title, required: true, confirmLabel: 'Rename' });
                  if (title?.trim()) await updateCollection(collection.id, { title: title.trim() });
                }}
              >
                <Pencil className="h-3.5 w-3.5" /> Rename
              </button>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <button
                className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition', active ? 'bg-ink text-paper' : 'text-ink')}
                onClick={() => void editDetails()}
              >
                <Palette className="h-3.5 w-3.5" /> Details
              </button>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <button
                className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition', active ? 'bg-ink text-paper' : 'text-ink')}
                onClick={() => void updateCollection(collection.id, { isPinned: !collection.isPinned })}
              >
                <Pin className="h-3.5 w-3.5" /> {collection.isPinned ? 'Unpin' : 'Pin'}
              </button>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <button
                className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition', active ? 'bg-ink text-paper' : 'text-ink')}
                onClick={() => void updateCollection(collection.id, { isFavorite: !collection.isFavorite })}
              >
                <Star className="h-3.5 w-3.5" /> {collection.isFavorite ? 'Unfavorite' : 'Favorite'}
              </button>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <button
                className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition', active ? 'bg-ink text-paper' : 'text-ink')}
                onClick={() => void duplicateCollection(collection.id)}
              >
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </button>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <button
                className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition', active ? 'bg-ink text-paper' : 'text-ink')}
                onClick={() => void (isTrashed ? restoreDeletedCollection(collection.id) : collection.status === 'archived' ? restoreCollection(collection.id) : archiveCollection(collection.id))}
              >
                {isTrashed ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />} {collection.status === 'archived' || isTrashed ? 'Restore' : 'Archive'}
              </button>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <button
                className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition', active ? 'bg-ink text-paper' : 'text-ink')}
                onClick={() => {
                  if (!isVaultUnlocked()) {
                    onOpenVault();
                    return;
                  }
                  void setCollectionProtection(collection.id, !collection.isVaultProtected);
                }}
              >
                {collection.isVaultProtected ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                {collection.isVaultProtected ? 'Unlock' : 'Lock'}
              </button>
            )}
          </Menu.Item>
          <div className="my-1 h-px bg-ink/10" />
          {collection.id !== DEFAULT_COLLECTION_ID ? <Menu.Item>
            {({ active }) => (
              <button
                className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition', active ? 'bg-vermillion text-paper' : 'text-vermillion')}
                onClick={async () => {
                  if (isTrashed) {
                    const approved = await confirm({ title: `Delete “${collection.title}” forever?`, message: 'The collection and every card inside it will be permanently deleted. This cannot be undone.', confirmLabel: 'Delete forever', tone: 'danger' });
                    if (approved) await permanentlyDeleteCollection(collection.id);
                  } else {
                    const approved = await confirm({ title: `Move “${collection.title}” to Trash?`, message: 'Every card inside this collection will move with it.', confirmLabel: 'Move to Trash', tone: 'danger' });
                    if (approved) await deleteCollection(collection.id);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> {isTrashed ? 'Delete forever' : 'Move to Trash'}
              </button>
            )}
          </Menu.Item> : null}
        </Menu.Items>
      </Menu>
    </motion.article>
  );
}
