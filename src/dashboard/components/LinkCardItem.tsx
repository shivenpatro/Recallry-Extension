import { useState, type DragEvent as ReactDragEvent, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { Menu } from '@headlessui/react';
import { Copy, ExternalLink, GripVertical, MoreHorizontal, Pencil, Tags, Trash2 } from 'lucide-react';
import type { LinkCard } from '../../shared/types';
import { cn } from '../../shared/utils';
import { useLinkscapeStore } from '../../store/linkscapeStore';
import { isVaultUnlocked } from '../../services/vault';

interface LinkCardItemProps {
  link: LinkCard;
  selected: boolean;
}

export function LinkCardItem({ link, selected }: LinkCardItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id });
  const [expanded, setExpanded] = useState(false);
  const toggle = useLinkscapeStore((state) => state.toggleLinkSelection);
  const updateLink = useLinkscapeStore((state) => state.updateLink);
  const duplicateLink = useLinkscapeStore((state) => state.duplicateLink);
  const deleteLink = useLinkscapeStore((state) => state.deleteLink);
  const style = { transform: CSS.Transform.toString(transform), transition };

  function openLink() {
    if (link.isVaultProtected && !isVaultUnlocked()) {
      window.alert('Unlock Vault before opening this protected link.');
      return;
    }
    const extensionApi = (globalThis as { chrome?: typeof chrome }).chrome;
    if (extensionApi?.tabs?.create) {
      void extensionApi.tabs.create({ url: link.url });
    } else {
      window.open(link.url, '_blank', 'noopener,noreferrer');
    }
  }

  async function editNotes() {
    const notes = prompt('Notes', link.notes);
    if (notes === null) return;
    await updateLink(link.id, { notes });
  }

  async function editTags() {
    const tags = prompt('Tags separated by commas', link.tags.join(', '));
    if (tags === null) return;
    await updateLink(link.id, { tags: tags.split(',').map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean) });
  }

  return (
    <motion.article
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0, scale: isDragging ? 1.02 : 1 }}
      className={cn(
        'paper-card group block w-full break-inside-avoid',
        selected ? 'border-vermillion shadow-editorial-vermillion' : 'shadow-editorial-sm hover:shadow-editorial',
        isDragging && 'z-30'
      )}
      draggable
      onDragStart={(event) => {
        const dragEvent = event as unknown as ReactDragEvent<HTMLElement>;
        dragEvent.dataTransfer.setData('application/x-linkscape-link', link.id);
        dragEvent.dataTransfer.effectAllowed = 'move';
      }}
      {...attributes}
    >
      {/* Thumbnail — sharp, no rounding, with ink border */}
      {link.thumbnailUrl ? (
        <div className="relative aspect-[16/10] overflow-hidden border-b border-ink">
          <img className="h-full w-full object-cover" src={link.thumbnailUrl} alt="" loading="lazy" />
          <button
            className="absolute left-2 top-2 grid h-7 w-7 place-items-center bg-paper text-ink-soft shadow-editorial-sm transition hover:bg-vermillion hover:text-paper"
            {...listeners}
            title="Drag"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          <input
            className="absolute right-2 top-2 h-4 w-4 accent-vermillion"
            type="checkbox"
            checked={selected}
            onChange={() => toggle(link.id)}
            aria-label={`Select ${link.title}`}
          />
        </div>
      ) : null}

      <div className="p-5">
        {/* Running head: domain */}
        <div className="flex items-center gap-2 border-b border-slate-rule pb-2">
          {link.faviconUrl ? <img className="h-4 w-4" src={link.faviconUrl} alt="" loading="lazy" /> : null}
          <span className="editorial-index truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-vermillion">
            {link.domain}
          </span>
        </div>

        <button className="mt-3 block w-full text-left" onClick={() => setExpanded((value) => !value)}>
          <h3 className="font-display text-lg font-semibold leading-tight tracking-tight text-ink line-clamp-2">{link.title}</h3>
        </button>

        <a className="mt-2 block truncate text-xs text-ink-soft/70 underline-offset-2 hover:text-vermillion hover:underline" href={link.url} target="_blank" rel="noreferrer">
          {link.url}
        </a>

        {link.notes || expanded ? (
          <p className="mt-2 text-sm leading-6 text-ink-soft">{link.notes || 'No notes yet.'}</p>
        ) : null}

        {link.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1">
            {link.tags.map((tag) => (
              <span key={tag} className="editorial-index bg-ink px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-paper">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {/* Footer: date + actions */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-rule pt-3">
          <span className="editorial-index text-[10px] font-medium uppercase tracking-[0.12em] text-ink-soft/60">
            {new Date(link.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
          </span>
          <div className="flex items-center gap-0.5 transition">
            <Action title="Open" onClick={openLink}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Action>
            <Action title="Notes" onClick={editNotes}>
              <Pencil className="h-3.5 w-3.5" />
            </Action>
            <Action title="Tags" onClick={editTags}>
              <Tags className="h-3.5 w-3.5" />
            </Action>
            <Action title="Duplicate" onClick={() => void duplicateLink(link.id)}>
              <Copy className="h-3.5 w-3.5" />
            </Action>
            <Action
              title="Delete"
              onClick={() => void deleteLink(link.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Action>

            {/* Triple-dots dropdown */}
            <Menu as="div" className="relative">
              <Menu.Button aria-label={`Actions for ${link.title}`} className="grid h-7 w-7 place-items-center text-ink-soft/50 transition hover:bg-ink hover:text-paper">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Menu.Button>
              <Menu.Items className="absolute right-0 top-full z-50 mt-1 w-40 border border-ink bg-paper-soft shadow-editorial-sm">
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition', active ? 'bg-ink text-paper' : 'text-ink')}
                      onClick={openLink}
                    >
                      <ExternalLink className="h-3 w-3" /> Open
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition', active ? 'bg-ink text-paper' : 'text-ink')}
                      onClick={editNotes}
                    >
                      <Pencil className="h-3 w-3" /> Notes
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition', active ? 'bg-ink text-paper' : 'text-ink')}
                      onClick={editTags}
                    >
                      <Tags className="h-3 w-3" /> Tags
                    </button>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition', active ? 'bg-ink text-paper' : 'text-ink')}
                      onClick={() => void duplicateLink(link.id)}
                    >
                      <Copy className="h-3 w-3" /> Duplicate
                    </button>
                  )}
                </Menu.Item>
                <div className="my-0.5 h-px bg-ink/10" />
                <Menu.Item>
                  {({ active }) => (
                    <button
                      className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition', active ? 'bg-vermillion text-paper' : 'text-vermillion')}
                      onClick={() => {
                        void deleteLink(link.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Menu>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function Action({ children, title, onClick }: { children: ReactNode; title: string; onClick: () => void }) {
  return (
    <button className="grid h-7 w-7 place-items-center text-ink-soft/60 transition hover:bg-ink hover:text-paper" title={title} onClick={onClick}>
      {children}
    </button>
  );
}
