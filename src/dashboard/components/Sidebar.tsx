import type { ReactNode } from 'react';
import { Archive, Boxes, Heart, Lock, Plus, Settings } from 'lucide-react';
import type { Collection } from '../../shared/types';
import { cn } from '../../shared/utils';
import { IconGlyph } from '../../components/IconGlyph';
import { useLinkscapeStore } from '../../store/linkscapeStore';

interface SidebarProps {
  collections: Collection[];
  selectedId: string;
  viewMode: string;
  onSelectCollection: (id: string) => void;
  onSelectView: (view: 'collections' | 'favorites' | 'archived' | 'vault' | 'settings') => void;
}

export function Sidebar({ collections, selectedId, viewMode, onSelectCollection, onSelectView }: SidebarProps) {
  const createCollection = useLinkscapeStore((state) => state.createCollection);
  const moveLink = useLinkscapeStore((state) => state.moveLink);

  async function addNestedCollection() {
    const title = prompt('Nested collection name');
    if (!title?.trim()) return;
    await createCollection(title.trim(), selectedId);
  }

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r-2 border-ink bg-paper-soft lg:flex">
      {/* Masthead */}
      <div className="border-b-2 border-ink px-6 py-6">
        <div className="editorial-index text-[10px] font-semibold uppercase tracking-[0.2em] text-vermillion">
          Issue 01 · 2026
        </div>
        <div className="mt-1 font-display text-3xl font-medium leading-none tracking-tightest text-ink">Linkscape</div>
        <div className="mt-1.5 text-xs italic text-ink-soft">A private archive</div>
      </div>

      {/* Primary nav */}
      <nav className="border-b border-slate-rule px-3 py-4">
        <div className="mb-2 px-3 editorial-index text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft/50">
          Sections
        </div>
        <NavButton active={viewMode === 'collections' || viewMode === 'collection'} icon={<Boxes className="h-4 w-4" />} label="Collections" onClick={() => onSelectView('collections')} />
        <NavButton active={viewMode === 'favorites'} icon={<Heart className="h-4 w-4" />} label="Favorites" onClick={() => onSelectView('favorites')} />
        <NavButton active={viewMode === 'archived'} icon={<Archive className="h-4 w-4" />} label="Archived" onClick={() => onSelectView('archived')} />
        <NavButton active={viewMode === 'vault'} icon={<Lock className="h-4 w-4" />} label="Vault" onClick={() => onSelectView('vault')} />
        <NavButton active={viewMode === 'settings'} icon={<Settings className="h-4 w-4" />} label="Settings" onClick={() => onSelectView('settings')} />
      </nav>

      {/* Spaces (collections list) */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">
        <div className="mb-2 flex items-center justify-between px-3">
          <span className="editorial-index text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft/50">Spaces</span>
          <button className="grid h-5 w-5 place-items-center text-ink-soft/60 transition hover:bg-ink hover:text-paper" onClick={addNestedCollection} title="Add nested collection">
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        <div className="space-y-0.5">
          {collections.map((collection, i) => (
            <button
              key={collection.id}
              className={cn(
                'flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium transition',
                selectedId === collection.id && viewMode === 'collection' ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-slate-rule/40 hover:text-ink'
              )}
              onClick={() => onSelectCollection(collection.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const linkId = event.dataTransfer.getData('application/x-linkscape-link');
                if (linkId) void moveLink(linkId, collection.id);
              }}
            >
              <span className="editorial-index text-[10px] font-semibold text-vermillion">{String(i + 1).padStart(2, '0')}</span>
              <span className="grid h-5 w-5 place-items-center text-ink-soft [&_*]:h-3.5 [&_*]:w-3.5">
                <IconGlyph name={collection.icon} className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate font-display">{collection.title}</span>
              {collection.isPinned ? <span className="h-1.5 w-1.5 bg-vermillion" aria-hidden /> : null}
            </button>
          ))}
        </div>
      </div>

      {/* Footer colophon */}
      <div className="border-t border-slate-rule px-6 py-4">
        <p className="editorial-index text-[9px] font-medium uppercase tracking-[0.16em] leading-relaxed text-ink-soft/40">
          Set in Fraunces &amp; Inter · Local-first · No cloud
        </p>
      </div>
    </aside>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      className={cn(
        'group flex w-full items-center gap-3 px-3 py-2 text-sm font-medium transition',
        active ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-slate-rule/40 hover:text-ink'
      )}
      onClick={onClick}
    >
      <span className={cn('transition', active ? 'text-vermillion' : 'text-ink-soft/50 group-hover:text-ink')}>{icon}</span>
      <span className="font-display">{label}</span>
    </button>
  );
}

interface MobileNavBarProps {
  viewMode: string;
  onSelectView: (view: 'collections' | 'favorites' | 'archived' | 'vault' | 'settings') => void;
}

export function MobileNavBar({ viewMode, onSelectView }: MobileNavBarProps) {
  return (
    <nav className="flex items-stretch justify-around border-t-2 border-ink bg-paper-soft lg:hidden">
      <MobileTab active={viewMode === 'collections' || viewMode === 'collection'} icon={<Boxes className="h-4 w-4" />} label="Collections" onClick={() => onSelectView('collections')} />
      <MobileTab active={viewMode === 'favorites'} icon={<Heart className="h-4 w-4" />} label="Favorites" onClick={() => onSelectView('favorites')} />
      <MobileTab active={viewMode === 'archived'} icon={<Archive className="h-4 w-4" />} label="Archived" onClick={() => onSelectView('archived')} />
      <MobileTab active={viewMode === 'vault'} icon={<Lock className="h-4 w-4" />} label="Vault" onClick={() => onSelectView('vault')} />
      <MobileTab active={viewMode === 'settings'} icon={<Settings className="h-4 w-4" />} label="Settings" onClick={() => onSelectView('settings')} />
    </nav>
  );
}

function MobileTab({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      className={cn(
        'flex flex-1 flex-col items-center gap-1 py-2.5 text-[9px] font-semibold uppercase tracking-wider transition',
        active ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
      )}
      onClick={onClick}
    >
      <span className={cn(active && 'text-vermillion')}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
