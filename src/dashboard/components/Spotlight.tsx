import { Fragment, useEffect, useMemo, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Archive, ExternalLink, Folder, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLinkscapeStore } from '../../store/linkscapeStore';
import { runGlobalSearch } from '../../services/search';
import { isVaultUnlocked } from '../../services/vault';

interface SpotlightProps {
  open: boolean;
  onClose: () => void;
  onOpenCollection?: (id: string) => void;
}

export function Spotlight({ open, onClose, onOpenCollection }: SpotlightProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const query = useLinkscapeStore((state) => state.searchQuery);
  const collections = useLinkscapeStore((state) => state.collections);
  const links = useLinkscapeStore((state) => state.links);
  const setQuery = useLinkscapeStore((state) => state.setSearchQuery);
  const setSelectedCollection = useLinkscapeStore((state) => state.setSelectedCollection);
  const results = useMemo(() => {
    const unlocked = isVaultUnlocked();
    return runGlobalSearch(
      query,
      collections.filter((collection) => !collection.isVaultProtected || unlocked),
      links.filter((link) => !link.isVaultProtected || unlocked)
    );
  }, [collections, links, query]);
  const topResults = useMemo(() => results.slice(0, 12), [results]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  function openResult(result: (typeof topResults)[number]) {
    if (result.type === 'collection') {
      if (onOpenCollection) onOpenCollection(result.id);
      else setSelectedCollection(result.id);
      onClose();
      return;
    }
    if (result.url) {
      const extensionApi = (globalThis as { chrome?: typeof chrome }).chrome;
      if (extensionApi?.tabs?.create) void extensionApi.tabs.create({ url: result.url });
      else window.open(result.url, '_blank', 'noopener,noreferrer');
    }
    onClose();
  }

  return (
    <Transition show={open} as={Fragment}>
      <Dialog className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-ink/70 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 flex items-start justify-center px-4 pt-[12vh]">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 -translate-y-4"
            enterTo="opacity-100 translate-y-0"
            leave="ease-in duration-120"
            leaveFrom="opacity-100"
            leaveTo="opacity-0 -translate-y-2"
          >
            <Dialog.Panel className="w-full max-w-2xl overflow-hidden border-2 border-ink bg-paper-soft shadow-editorial">
              <div className="flex items-center gap-3 border-b-2 border-ink px-5 py-4">
                <Search className="h-5 w-5 text-vermillion" aria-hidden />
                <input
                  ref={inputRef}
                  className="h-10 min-w-0 flex-1 bg-transparent font-display text-2xl font-medium text-ink outline-none placeholder:text-ink-soft/35"
                  placeholder="Search the archive…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <kbd className="editorial-index border border-ink px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-soft">Esc</kbd>
              </div>
              <div className="max-h-[56vh] overflow-y-auto">
                {topResults.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm italic text-ink-soft/60">Type to search collections, URLs, notes, and tags.</div>
                ) : (
                  topResults.map((result, index) => (
                    <motion.button
                      key={`${result.type}-${result.id}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="flex w-full items-center gap-3 border-b border-slate-rule px-5 py-3 text-left transition hover:bg-ink hover:text-paper"
                      onClick={() => openResult(result)}
                    >
                      <span className="editorial-index w-6 text-[10px] font-semibold text-vermillion">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="grid h-8 w-8 place-items-center border border-ink text-ink group-hover:border-paper">
                        {result.type === 'collection' ? <Folder className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-sm font-semibold">{result.title}</span>
                        <span className="block truncate text-xs opacity-60">{result.subtitle}</span>
                      </span>
                      {result.url ? <ExternalLink className="h-4 w-4 opacity-50" /> : null}
                    </motion.button>
                  ))
                )}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
