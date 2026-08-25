import { db, ensureSeedData } from './db';
import { DEFAULT_COLLECTION_ID } from '../shared/constants';
import type { BackupEnvelope, Collection, LinkCapture, LinkCard, Tag } from '../shared/types';
import { createId, faviconForUrl, normalizeWebsiteUrl, nowIso, safeDomain } from '../shared/utils';
import { decryptCollection, decryptLink, encryptCollection, encryptLink, isVaultUnlocked, lockVault, restoreVaultSession } from '../services/vault';

const RECENT_COLLECTIONS_KEY = 'recent-collections';
const MAX_RECENT_COLLECTIONS = 6;

export async function bootstrapRepository() {
  await ensureSeedData();
}

export async function listCollections(includeArchived = false) {
  await ensureSeedData();
  await restoreVaultSession();
  let collections = await db.collections.orderBy('order').toArray();
  if (isVaultUnlocked()) {
    const migrated = await Promise.all(collections.map((collection) => collection.isVaultProtected && !collection.encryptedMetadata
      ? encryptCollection(collection)
      : collection));
    if (migrated.some((collection, index) => collection !== collections[index])) {
      await db.collections.bulkPut(migrated);
      collections = migrated;
    }
  }
  const visible = isVaultUnlocked()
    ? await Promise.all(collections.map((collection) => collection.encryptedMetadata ? decryptCollection(collection) : collection))
    : collections;
  return includeArchived ? visible : visible.filter((collection) => collection.status === 'active');
}

export async function createCollection(input: Partial<Collection> & Pick<Collection, 'title'>) {
  const createdAt = nowIso();
  const currentCount = await db.collections.count();
  const collection: Collection = {
    id: input.id ?? createId('col'),
    title: input.title,
    description: input.description ?? '',
    icon: input.icon ?? 'Folder',
    theme: input.theme ?? 'aurora',
    parentId: input.parentId,
    order: input.order ?? currentCount,
    isPinned: input.isPinned ?? false,
    isFavorite: input.isFavorite ?? false,
    isVaultProtected: input.isVaultProtected ?? false,
    status: input.status ?? 'active',
    smartRules: input.smartRules,
    createdAt,
    updatedAt: createdAt
  };
  let persisted = collection;
  if (collection.isVaultProtected) {
    await restoreVaultSession();
    if (!isVaultUnlocked()) throw new Error('Vault is locked');
    persisted = await encryptCollection(collection);
  }
  await db.collections.add(persisted);
  return collection;
}

export async function updateCollection(id: string, patch: Partial<Collection>) {
  const existing = await db.collections.get(id);
  if (!existing) throw new Error('Collection not found');
  if (existing.encryptedMetadata) {
    await restoreVaultSession();
    if (!isVaultUnlocked()) throw new Error('Vault is locked');
    const visible = await decryptCollection(existing);
    const encrypted = await encryptCollection({ ...visible, ...patch, id: existing.id, updatedAt: nowIso() });
    await db.collections.put(encrypted);
    return decryptCollection(encrypted);
  }
  await db.collections.update(id, { ...patch, updatedAt: nowIso() });
  return db.collections.get(id);
}

export async function duplicateCollection(id: string) {
  const storedSource = await db.collections.get(id);
  if (!storedSource) throw new Error('Collection not found');
  await restoreVaultSession();
  if (storedSource.isVaultProtected && !isVaultUnlocked()) throw new Error('Vault is locked');
  const source = storedSource.encryptedMetadata ? await decryptCollection(storedSource) : storedSource;
  const links = (await db.links.where({ collectionId: id }).sortBy('order')).filter((link) => !link.deletedAt);
  const clonedAt = nowIso();
  const clone: Collection = {
    ...source,
    id: createId('col'),
    title: `${source.title} Copy`,
    order: await db.collections.count(),
    isPinned: false,
    isFavorite: false,
    isVaultProtected: false,
    encryptedMetadata: undefined,
    createdAt: clonedAt,
    updatedAt: clonedAt
  };
  const cloneLinks = await Promise.all(links.map(async (link, index) => {
    const visible = link.encryptedPayload ? await decryptLink(link) : link;
    const next = { ...visible, id: createId('link'), collectionId: clone.id, order: index, createdAt: nowIso(), updatedAt: nowIso() };
    return source.isVaultProtected ? encryptLink(next) : next;
  }));
  const storedClone = source.isVaultProtected ? await encryptCollection({ ...clone, isVaultProtected: true }) : clone;
  await db.transaction('rw', db.collections, db.links, async () => {
    await db.collections.add(storedClone);
    await db.links.bulkAdd(cloneLinks);
  });
  return { ...clone, isVaultProtected: source.isVaultProtected };
}

export async function deleteCollection(id: string) {
  if (id === DEFAULT_COLLECTION_ID) throw new Error('Inbox cannot be deleted');
  const deletedAt = nowIso();
  await db.transaction('rw', db.collections, db.links, async () => {
    await db.collections.update(id, { status: 'trashed', deletedAt, updatedAt: deletedAt });
    await db.links.where({ collectionId: id }).and((link) => !link.deletedAt).modify({ deletedAt, deletedWithCollectionId: id, updatedAt: deletedAt });
  });
}

export async function restoreDeletedCollection(id: string) {
  const restoredAt = nowIso();
  await db.transaction('rw', db.collections, db.links, async () => {
    await db.collections.update(id, { status: 'active', deletedAt: undefined, updatedAt: restoredAt });
    await db.links.where({ collectionId: id }).and((link) => link.deletedWithCollectionId === id).modify({ deletedAt: undefined, deletedWithCollectionId: undefined, updatedAt: restoredAt });
  });
}

export async function permanentlyDeleteCollection(id: string) {
  if (id === DEFAULT_COLLECTION_ID) throw new Error('Inbox cannot be deleted');
  const collection = await db.collections.get(id);
  if (!collection || collection.status !== 'trashed') throw new Error('Move the collection to Trash before deleting it permanently');
  await db.transaction('rw', db.collections, db.links, async () => {
    await db.links.where({ collectionId: id }).delete();
    await db.collections.where({ parentId: id }).modify({ parentId: undefined });
    await db.collections.delete(id);
  });
}

export async function archiveCollection(id: string) {
  return updateCollection(id, { status: 'archived' });
}

export async function restoreCollection(id: string) {
  return updateCollection(id, { status: 'active' });
}

export async function listLinks(collectionId?: string) {
  await ensureSeedData();
  await restoreVaultSession();
  const links = collectionId ? await db.links.where({ collectionId }).sortBy('order') : await db.links.orderBy('updatedAt').reverse().toArray();
  if (!isVaultUnlocked()) return links;
  const visible = await Promise.all(links.map((link) => (link.encryptedPayload ? decryptLink(link) : link)));
  const migrated = await Promise.all(links.map((link, index) => link.encryptedPayload && link.domain !== 'protected' ? encryptLink(visible[index]!) : link));
  if (migrated.some((link, index) => link !== links[index])) await db.links.bulkPut(migrated);
  return visible;
}

export async function saveCapturedLink(collectionId: string, capture: LinkCapture, notes = '', tags: string[] = []) {
  const collection = await db.collections.get(collectionId);
  if (!collection) throw new Error('Collection not found');
  const url = normalizeWebsiteUrl(capture.url);
  await restoreVaultSession();
  if (collection.isVaultProtected && !isVaultUnlocked()) throw new Error('Vault is locked');
  const duplicate = await findDuplicateLink(collectionId, url);
  if (duplicate) throw new Error(`This website is already saved as "${duplicate.title}" in this collection`);
  const createdAt = nowIso();
  const currentCount = await db.links.where({ collectionId }).count();
  const link: LinkCard = {
    id: createId('link'),
    collectionId,
    title: capture.title || url,
    url,
    domain: capture.domain || safeDomain(url),
    faviconUrl: capture.faviconUrl || faviconForUrl(url),
    thumbnailUrl: capture.thumbnailUrl,
    snapshotHtml: capture.snapshotHtml,
    snapshotCapturedAt: capture.snapshotCapturedAt,
    notes,
    tags,
    labels: [],
    order: currentCount,
    isArchived: false,
    isVaultProtected: false,
    createdAt,
    updatedAt: createdAt
  };
  const persisted = collection.isVaultProtected ? await encryptLink(link) : link;
  await db.links.add(persisted);
  await recordRecentCollection(collectionId);
  return link;
}

export async function findDuplicateLink(collectionId: string, value: string) {
  const collection = await db.collections.get(collectionId);
  if (!collection) return undefined;
  const url = normalizeWebsiteUrl(value);
  await restoreVaultSession();
  if (collection.isVaultProtected && !isVaultUnlocked()) return undefined;
  const existingLinks = await db.links.where({ collectionId }).toArray();
  const visibleLinks = collection.isVaultProtected
    ? await Promise.all(existingLinks.map((candidate) => candidate.encryptedPayload ? decryptLink(candidate) : candidate))
    : existingLinks;
  return visibleLinks.find((candidate) => !candidate.deletedAt && candidate.url === url);
}

export async function listRecentCollectionIds() {
  const record = await db.meta.get(RECENT_COLLECTIONS_KEY);
  return Array.isArray(record?.value)
    ? record.value.filter((value): value is string => typeof value === 'string').slice(0, MAX_RECENT_COLLECTIONS)
    : [];
}

export async function recordRecentCollection(collectionId: string) {
  const current = await listRecentCollectionIds();
  const next = [collectionId, ...current.filter((id) => id !== collectionId)].slice(0, MAX_RECENT_COLLECTIONS);
  await db.meta.put({ key: RECENT_COLLECTIONS_KEY, value: next });
  return next;
}

export async function undoRecentlySavedLink(id: string) {
  const link = await db.links.get(id);
  if (!link) return false;
  await db.links.delete(id);
  return true;
}

export async function updateLink(id: string, patch: Partial<LinkCard>) {
  const existing = await db.links.get(id);
  if (!existing) throw new Error('Link not found');
  const updatedAt = nowIso();
  if (existing.isVaultProtected || existing.encryptedPayload) {
    if (!isVaultUnlocked()) throw new Error('Vault is locked');
    const visible = await decryptLink(existing);
    const next = await encryptLink({ ...visible, ...patch, id: existing.id, collectionId: existing.collectionId, updatedAt });
    await db.links.put(next);
    return next;
  }
  await db.links.update(id, { ...patch, updatedAt });
  return db.links.get(id);
}

export async function updateLinks(ids: string[], patch: Partial<LinkCard>) {
  const existing = await db.links.bulkGet(ids);
  if (existing.some((link) => !link)) throw new Error('Link not found');
  await restoreVaultSession();
  const updatedAt = nowIso();
  const nextLinks = await Promise.all(existing.map(async (link) => {
    if (!link) throw new Error('Link not found');
    if (!link.encryptedPayload) return { ...link, ...patch, id: link.id, collectionId: link.collectionId, updatedAt };
    if (!isVaultUnlocked()) throw new Error('Vault is locked');
    const visible = await decryptLink(link);
    return encryptLink({ ...visible, ...patch, id: link.id, collectionId: link.collectionId, updatedAt });
  }));
  await db.links.bulkPut(nextLinks);
  return nextLinks;
}

export async function deleteLinks(ids: string[]) {
  const deletedAt = nowIso();
  await updateLinks(ids, { deletedAt });
}

export async function restoreLinks(ids: string[]) {
  await updateLinks(ids, { deletedAt: undefined, deletedWithCollectionId: undefined });
}

export async function permanentlyDeleteLinks(ids: string[]) {
  const links = await db.links.bulkGet(ids);
  if (links.some((link) => link && !link.deletedAt)) throw new Error('Move cards to Trash before deleting them permanently');
  await db.links.bulkDelete(ids);
}

export async function moveLinks(ids: string[], collectionId: string) {
  const destination = await db.collections.get(collectionId);
  if (!destination) throw new Error('Collection not found');
  const existingCount = await db.links.where({ collectionId }).count();
  const links = await db.links.bulkGet(ids);
  if (links.some((link) => !link || link.deletedAt)) throw new Error('Restore cards from Trash before moving them');
  const nextLinks = await Promise.all(
    links.map(async (link, index) => {
      if (!link) throw new Error('Link not found');
      const visible = link.encryptedPayload ? await decryptLink(link) : link;
      const next = {
        ...visible,
        collectionId,
        order: existingCount + index,
        updatedAt: nowIso()
      };
      return destination.isVaultProtected
        ? encryptLink(next)
        : { ...next, isVaultProtected: false, encryptedPayload: undefined };
    })
  );
  await db.transaction('rw', db.links, async () => {
    await db.links.bulkPut(nextLinks);
  });
}

export async function duplicateLink(id: string) {
  const link = await db.links.get(id);
  if (!link) throw new Error('Link not found');
  const source = link.encryptedPayload ? await decryptLink(link) : link;
  const createdAt = nowIso();
  const clone: LinkCard = {
    ...source,
    id: createId('link'),
    title: `${source.title} Copy`,
    order: source.order + 1,
    createdAt,
    updatedAt: createdAt
  };
  const collection = await db.collections.get(source.collectionId);
  const persisted = collection?.isVaultProtected ? await encryptLink(clone) : clone;
  if (collection?.isVaultProtected && !isVaultUnlocked()) throw new Error('Vault is locked');
  await db.links.add(persisted);
  return persisted;
}

export async function setCollectionProtection(id: string, protectedCollection: boolean) {
  const collection = await db.collections.get(id);
  if (!collection) throw new Error('Collection not found');
  await restoreVaultSession();
  if (protectedCollection && !isVaultUnlocked()) throw new Error('Unlock the vault before protecting a collection');

  const links = await db.links.where({ collectionId: id }).toArray();
  const nextLinks = protectedCollection
    ? await Promise.all(links.map((link) => (link.encryptedPayload ? link : encryptLink(link))))
    : await Promise.all(
        links.map(async (link) => {
          if (!link.encryptedPayload) return link;
          const visible = await decryptLink(link);
          return { ...visible, isVaultProtected: false, encryptedPayload: undefined, updatedAt: nowIso() };
        })
      );

  const nextCollection = protectedCollection
    ? await encryptCollection({ ...collection, isVaultProtected: true, updatedAt: nowIso() })
    : { ...(collection.encryptedMetadata ? await decryptCollection(collection) : collection), isVaultProtected: false, encryptedMetadata: undefined, updatedAt: nowIso() };

  await db.transaction('rw', db.collections, db.links, async () => {
    await db.links.bulkPut(nextLinks);
    await db.collections.put(nextCollection);
  });
  return db.collections.get(id);
}

export async function reorderLinks(collectionId: string, orderedIds: string[]) {
  await db.transaction('rw', db.links, async () => {
    await Promise.all(orderedIds.map((id, order) => db.links.update(id, { collectionId, order, updatedAt: nowIso() })));
  });
}

export async function reorderCollections(orderedIds: string[]) {
  const current = await db.collections.orderBy('order').toArray();
  const requested = new Set(orderedIds);
  const existingRequested = orderedIds.filter((id) => current.some((collection) => collection.id === id));
  let requestedIndex = 0;
  const merged = current.map((collection) => requested.has(collection.id)
    ? existingRequested[requestedIndex++] ?? collection.id
    : collection.id);
  await db.transaction('rw', db.collections, async () => {
    await Promise.all(merged.map((id, order) => db.collections.update(id, { order, updatedAt: nowIso() })));
  });
}

export async function upsertTag(name: string, color: string): Promise<Tag> {
  const normalized = name.trim().toLocaleLowerCase();
  const existing = await db.tags.where({ name: normalized }).first();
  if (existing) return existing;
  const tag: Tag = { id: createId('tag'), name: normalized, color, createdAt: nowIso() };
  await db.tags.add(tag);
  return tag;
}

export async function createBackup(): Promise<BackupEnvelope> {
  await ensureSeedData();
  const [collections, links, tags, vaultRecord] = await Promise.all([
    db.collections.toArray(),
    db.links.toArray(),
    db.tags.toArray(),
    db.meta.get('vault')
  ]);
  const vault = vaultRecord?.value as BackupEnvelope['vault'];
  return {
    version: 1,
    exportedAt: nowIso(),
    collections,
    links,
    tags,
    vault
  };
}

export async function restoreBackup(backup: BackupEnvelope) {
  validateBackup(backup);
  const previousBackup = await createBackup();
  await db.transaction('rw', db.collections, db.links, db.tags, db.meta, async () => {
    await db.collections.clear();
    await db.links.clear();
    await db.tags.clear();
    await db.collections.bulkPut(backup.collections);
    await db.links.bulkPut(backup.links);
    await db.tags.bulkPut(backup.tags);
    await db.meta.put({ key: 'pre-restore-backup', value: previousBackup });
    await db.meta.put({ key: 'vault', value: backup.vault });
  });
  await lockVault();
}

export function validateBackup(backup: BackupEnvelope) {
  if (!backup || backup.version !== 1 || !backup.vault || !Array.isArray(backup.collections) || !Array.isArray(backup.links) || !Array.isArray(backup.tags)) {
    throw new Error('Invalid Linkscape backup');
  }
  if (backup.collections.length > 100_000 || backup.links.length > 1_000_000 || backup.tags.length > 100_000) {
    throw new Error('Backup exceeds supported limits');
  }
  const collectionIds = new Set<string>();
  for (const collection of backup.collections) {
    if (!collection || typeof collection.id !== 'string' || !collection.id || typeof collection.title !== 'string' || !Number.isInteger(collection.order) || !['active', 'archived', 'trashed'].includes(collection.status)) {
      throw new Error('Backup contains an invalid collection');
    }
    if (collectionIds.has(collection.id)) throw new Error('Backup contains duplicate collection IDs');
    collectionIds.add(collection.id);
  }
  const collectionsById = new Map(backup.collections.map((collection) => [collection.id, collection]));
  for (const collection of backup.collections) {
    const lineage = new Set<string>();
    let current: Collection | undefined = collection;
    while (current?.parentId) {
      if (lineage.has(current.id)) throw new Error('Backup contains a cyclic collection hierarchy');
      lineage.add(current.id);
      current = collectionsById.get(current.parentId);
    }
  }
  if (!collectionIds.has(DEFAULT_COLLECTION_ID)) throw new Error('Backup is missing the Inbox collection');
  for (const collection of backup.collections) {
    if (collection.parentId && (!collectionIds.has(collection.parentId) || collection.parentId === collection.id)) {
      throw new Error('Backup contains an invalid collection hierarchy');
    }
    if (collection.encryptedMetadata) validateEncryptedPayload(collection.encryptedMetadata);
  }
  const linkIds = new Set<string>();
  for (const link of backup.links) {
    if (!link || typeof link.id !== 'string' || !link.id || linkIds.has(link.id) || !collectionIds.has(link.collectionId) || !Array.isArray(link.tags) || !Array.isArray(link.labels) || !Number.isInteger(link.order)) {
      throw new Error('Backup contains an invalid link');
    }
    linkIds.add(link.id);
    if (link.encryptedPayload) validateEncryptedPayload(link.encryptedPayload);
    else normalizeWebsiteUrl(link.url);
  }
  const tagIds = new Set<string>();
  const tagNames = new Set<string>();
  for (const tag of backup.tags) {
    if (!tag || typeof tag.id !== 'string' || !tag.id || typeof tag.name !== 'string' || !tag.name || tagIds.has(tag.id) || tagNames.has(tag.name)) throw new Error('Backup contains an invalid tag');
    tagIds.add(tag.id);
    tagNames.add(tag.name);
  }
  if (typeof backup.vault.enabled !== 'boolean' || !Number.isInteger(backup.vault.autoLockMinutes) || backup.vault.autoLockMinutes < 1 || backup.vault.autoLockMinutes > 120 || !Number.isInteger(backup.vault.iterations) || backup.vault.iterations < 100_000) {
    throw new Error('Backup contains invalid Vault settings');
  }
  if (backup.vault.enabled && (!backup.vault.passwordHash || !backup.vault.salt)) throw new Error('Backup contains incomplete Vault settings');
  if (backup.vault.passwordWrappedKey) validateEncryptedPayload(backup.vault.passwordWrappedKey);
  if (backup.vault.recoveryWrappedKey) validateEncryptedPayload(backup.vault.recoveryWrappedKey);
  return backup;
}

function validateEncryptedPayload(payload: { iv: string; salt: string; data: string }) {
  if (!payload || typeof payload.iv !== 'string' || typeof payload.salt !== 'string' || typeof payload.data !== 'string' || !payload.iv || !payload.data) {
    throw new Error('Backup contains an invalid encrypted payload');
  }
}
