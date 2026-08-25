import { create } from 'zustand';
import {
  archiveCollection,
  bootstrapRepository,
  createCollection,
  deleteCollection,
  deleteLinks,
  permanentlyDeleteCollection,
  permanentlyDeleteLinks,
  duplicateCollection,
  duplicateLink,
  listCollections,
  listLinks,
  moveLinks,
  reorderCollections,
  reorderLinks,
  saveCapturedLink,
  setCollectionProtection,
  updateCollection,
  updateLink,
  updateLinks,
  restoreCollection,
  restoreDeletedCollection,
  restoreLinks
} from '../data/repositories';
import { getVaultSettings } from '../data/db';
import { runGlobalSearch } from '../services/search';
import type { Collection, LinkCapture, LinkCard, SearchResult, VaultSettings } from '../shared/types';
import { DEFAULT_COLLECTION_ID } from '../shared/constants';

function refreshContextMenus() {
  void (globalThis as { chrome?: typeof chrome }).chrome?.runtime?.sendMessage?.({ type: 'LINKSCAPE_REFRESH_CONTEXT_MENUS' });
}

interface LinkscapeState {
  collections: Collection[];
  links: LinkCard[];
  selectedCollectionId: string;
  selectedLinkIds: string[];
  searchQuery: string;
  isSearchOpen: boolean;
  isLoading: boolean;
  error?: string;
  vault?: VaultSettings;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  setSelectedCollection: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setSearchOpen: (open: boolean) => void;
  toggleLinkSelection: (id: string) => void;
  clearSelection: () => void;
  createCollection: (title: string, parentId?: string) => Promise<Collection>;
  updateCollection: (id: string, patch: Partial<Collection>) => Promise<void>;
  archiveCollection: (id: string) => Promise<void>;
  restoreCollection: (id: string) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  restoreDeletedCollection: (id: string) => Promise<void>;
  permanentlyDeleteCollection: (id: string) => Promise<void>;
  duplicateCollection: (id: string) => Promise<void>;
  setCollectionProtection: (id: string, protectedCollection: boolean) => Promise<void>;
  saveLink: (collectionId: string, capture: LinkCapture, notes?: string, tags?: string[]) => Promise<LinkCard>;
  updateLink: (id: string, patch: Partial<LinkCard>) => Promise<void>;
  deleteLink: (id: string) => Promise<void>;
  restoreLink: (id: string) => Promise<void>;
  permanentlyDeleteLink: (id: string) => Promise<void>;
  moveLink: (id: string, collectionId: string) => Promise<void>;
  deleteSelectedLinks: () => Promise<void>;
  restoreSelectedLinks: () => Promise<void>;
  permanentlyDeleteSelectedLinks: () => Promise<void>;
  moveSelectedLinks: (collectionId: string) => Promise<void>;
  archiveSelectedLinks: () => Promise<void>;
  tagSelectedLinks: (tag: string) => Promise<void>;
  duplicateLink: (id: string) => Promise<void>;
  reorderLinks: (collectionId: string, ids: string[]) => Promise<void>;
  reorderCollections: (ids: string[]) => Promise<void>;
  searchResults: () => SearchResult[];
}

export const useLinkscapeStore = create<LinkscapeState>((set, get) => ({
  collections: [],
  links: [],
  selectedCollectionId: DEFAULT_COLLECTION_ID,
  selectedLinkIds: [],
  searchQuery: '',
  isSearchOpen: false,
  isLoading: true,

  async init() {
    set({ isLoading: true, error: undefined });
    try {
      await bootstrapRepository();
      const [collections, links, vault] = await Promise.all([listCollections(true), listLinks(), getVaultSettings()]);
      set({ collections, links, vault, selectedCollectionId: collections[0]?.id ?? DEFAULT_COLLECTION_ID, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: error instanceof Error ? error.message : 'Linkscape could not open its local database' });
    }
  },

  async refresh() {
    const [collections, links, vault] = await Promise.all([listCollections(true), listLinks(), getVaultSettings()]);
    set({ collections, links, vault });
  },

  setSelectedCollection(id) {
    set({ selectedCollectionId: id, selectedLinkIds: [] });
  },

  setSearchQuery(query) {
    set({ searchQuery: query });
  },

  setSearchOpen(open) {
    set({ isSearchOpen: open });
  },

  toggleLinkSelection(id) {
    const selected = get().selectedLinkIds;
    set({ selectedLinkIds: selected.includes(id) ? selected.filter((selectedId) => selectedId !== id) : [...selected, id] });
  },

  clearSelection() {
    set({ selectedLinkIds: [] });
  },

  async createCollection(title, parentId) {
    const collection = await createCollection({ title, parentId });
    await get().refresh();
    set({ selectedCollectionId: collection.id });
    refreshContextMenus();
    return collection;
  },

  async updateCollection(id, patch) {
    await updateCollection(id, patch);
    await get().refresh();
    refreshContextMenus();
  },

  async archiveCollection(id) {
    await archiveCollection(id);
    await get().refresh();
    refreshContextMenus();
  },

  async restoreCollection(id) {
    await restoreCollection(id);
    await get().refresh();
    refreshContextMenus();
  },

  async deleteCollection(id) {
    await deleteCollection(id);
    await get().refresh();
    set({ selectedCollectionId: DEFAULT_COLLECTION_ID });
    refreshContextMenus();
  },

  async restoreDeletedCollection(id) {
    await restoreDeletedCollection(id);
    await get().refresh();
    refreshContextMenus();
  },

  async permanentlyDeleteCollection(id) {
    await permanentlyDeleteCollection(id);
    await get().refresh();
    set({ selectedCollectionId: DEFAULT_COLLECTION_ID });
    refreshContextMenus();
  },

  async duplicateCollection(id) {
    const duplicate = await duplicateCollection(id);
    await get().refresh();
    set({ selectedCollectionId: duplicate.id });
    refreshContextMenus();
  },

  async setCollectionProtection(id, protectedCollection) {
    await setCollectionProtection(id, protectedCollection);
    await get().refresh();
    refreshContextMenus();
  },

  async saveLink(collectionId, capture, notes, tags) {
    const link = await saveCapturedLink(collectionId, capture, notes, tags);
    await get().refresh();
    return link;
  },

  async updateLink(id, patch) {
    await updateLink(id, patch);
    await get().refresh();
  },

  async deleteLink(id) {
    await deleteLinks([id]);
    set((state) => ({ selectedLinkIds: state.selectedLinkIds.filter((selectedId) => selectedId !== id) }));
    await get().refresh();
  },

  async restoreLink(id) {
    await restoreLinks([id]);
    await get().refresh();
  },

  async permanentlyDeleteLink(id) {
    await permanentlyDeleteLinks([id]);
    set((state) => ({ selectedLinkIds: state.selectedLinkIds.filter((selectedId) => selectedId !== id) }));
    await get().refresh();
  },

  async moveLink(id, collectionId) {
    await moveLinks([id], collectionId);
    await get().refresh();
  },

  async deleteSelectedLinks() {
    await deleteLinks(get().selectedLinkIds);
    set({ selectedLinkIds: [] });
    await get().refresh();
  },

  async restoreSelectedLinks() {
    await restoreLinks(get().selectedLinkIds);
    set({ selectedLinkIds: [] });
    await get().refresh();
  },

  async permanentlyDeleteSelectedLinks() {
    await permanentlyDeleteLinks(get().selectedLinkIds);
    set({ selectedLinkIds: [] });
    await get().refresh();
  },

  async moveSelectedLinks(collectionId) {
    await moveLinks(get().selectedLinkIds, collectionId);
    set({ selectedLinkIds: [] });
    await get().refresh();
  },

  async archiveSelectedLinks() {
    await updateLinks(get().selectedLinkIds, { isArchived: true });
    set({ selectedLinkIds: [] });
    await get().refresh();
  },

  async tagSelectedLinks(tag) {
    const normalizedTag = tag.trim().toLocaleLowerCase();
    const { selectedLinkIds, links } = get();
    await Promise.all(selectedLinkIds.map((id) => {
      const link = links.find((item) => item.id === id);
      return link ? updateLink(id, { tags: [...new Set([...link.tags, normalizedTag])] }) : Promise.resolve(undefined);
    }));
    await get().refresh();
  },

  async duplicateLink(id) {
    await duplicateLink(id);
    await get().refresh();
  },

  async reorderLinks(collectionId, ids) {
    await reorderLinks(collectionId, ids);
    await get().refresh();
  },

  async reorderCollections(ids) {
    await reorderCollections(ids);
    await get().refresh();
  },

  searchResults() {
    const { searchQuery, collections, links } = get();
    return runGlobalSearch(searchQuery, collections, links);
  }
}));
