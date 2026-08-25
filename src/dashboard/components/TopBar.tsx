import { Filter, Plus, Search } from 'lucide-react';
import { Button } from '../../components/Button';

interface TopBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onOpenSearch: () => void;
  onFilter: () => void;
  onAdd: () => void;
}

export function TopBar({ query, onQueryChange, onOpenSearch, onFilter, onAdd }: TopBarProps) {
  return (
    <header className="flex items-center gap-3 border-b border-slate-rule px-6 py-4">
      <button
        className="group flex h-12 min-w-0 flex-1 items-center gap-3 border border-ink bg-paper-soft px-4 text-left transition hover:border-vermillion hover:shadow-editorial-sm"
        onClick={onOpenSearch}
      >
        <Search className="h-4 w-4 text-ink-soft transition group-hover:text-vermillion" aria-hidden />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/40"
          value={query}
          placeholder="Search the archive…"
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={onOpenSearch}
          onClick={(event) => event.stopPropagation()}
        />
        <span className="editorial-index border border-ink bg-paper px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
          ⌘K
        </span>
      </button>
      <Button variant="ghost" title="Search and filters" onClick={onFilter}>
        <Filter className="h-4 w-4" aria-hidden />
      </Button>
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4" aria-hidden />
        Collection
      </Button>
    </header>
  );
}
