import { db, ensureSeedData } from './db';
import { DEFAULT_COLLECTION_ID } from '../shared/constants';
import type { BackupEnvelope, Collection, LinkCapture, LinkCard, Tag } from '../shared/types';
import { createId, faviconForUrl, nowIso, safeDomain } from '../shared/utils';
import { decryptLink, encryptLink, isVaultUnlocked, lockVault } from '../services/vault';

export async function bootstrapRepository() {
  await ensureSeedData();
}

export async function listCollections(includeArchived = false) {
  await ensureSeedData();
  const collections = await db.collections.orderBy('order').toArray();
  return includeArchived ? collections : collections.filter((collection) => collection.status !== 'archived');
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
  await db.collections.add(collection);
  return collection;
}

export async function updateCollection(id: string, patch: Partial<Collection>) {
  await db.collections.update(id, { ...patch, updatedAt: nowIso() });
  return db.collections.get(id);
}

export async function duplicateCollection(id: string) {
  const source = await db.collections.get(id);
  if (!source) throw new Error('Collection not found');
  const links = await db.links.where({ collectionId: id }).sortBy('order');
  const clone = await createCollection({
    ...source,
    id: createId('col'),
    title: `${source.title} Copy`,
    isPinned: false,
    isFavorite: false,
    createdAt: undefined,
    updatedAt: undefined
  });
  await db.links.bulkAdd(
    links.map((link, index) => ({
      ...link,
      id: createId('link'),
      collectionId: clone.id,
      order: index,
      createdAt: nowIso(),
      updatedAt: nowIso()
    }))
  );
  return clone;
}

export async function deleteCollection(id: string) {
  if (id === DEFAULT_COLLECTION_ID) throw new Error('Inbox cannot be deleted');
  await db.transaction('rw', db.collections, db.links, db.meta, async () => {
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
  const links = collectionId ? await db.links.where({ collectionId }).sortBy('order') : await db.links.orderBy('updatedAt').reverse().toArray();
  if (!isVaultUnlocked()) return links;
  return Promise.all(links.map((link) => (link.encryptedPayload ? decryptLink(link) : link)));
}

export async function saveCapturedLink(collectionId: string, capture: LinkCapture, notes = '', tags: string[] = []) {
  const collection = await db.collections.get(collectionId);
  if (!collection) throw new Error('Collection not found');
  let url: string;
  try {
    url = new URL(capture.url).href;
  } catch {
    throw new Error('Invalid website URL');
  }
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
  if (collection.isVaultProtected && !isVaultUnlocked()) throw new Error('Vault is locked');
  await db.links.add(persisted);
  return persisted;
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

export async function deleteLinks(ids: string[]) {
  await db.links.bulkDelete(ids);
}

export async function moveLinks(ids: string[], collectionId: string) {
  const destination = await db.collections.get(collectionId);
  if (!destination) throw new Error('Collection not found');
  const existingCount = await db.links.where({ collectionId }).count();
  const links = await db.links.bulkGet(ids);
  if (links.some((link) => !link)) throw new Error('Link not found');
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

  await db.transaction('rw', db.collections, db.links, async () => {
    await db.links.bulkPut(nextLinks);
    await db.collections.update(id, { isVaultProtected: protectedCollection, updatedAt: nowIso() });
  });
  return db.collections.get(id);
}

export async function reorderLinks(collectionId: string, orderedIds: string[]) {
  await db.transaction('rw', db.links, async () => {
    await Promise.all(orderedIds.map((id, order) => db.links.update(id, { collectionId, order, updatedAt: nowIso() })));
  });
}

export async function reorderCollections(orderedIds: string[]) {
  await db.transaction('rw', db.collections, async () => {
    await Promise.all(orderedIds.map((id, order) => db.collections.update(id, { order, updatedAt: nowIso() })));
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
  if (!backup.vault || !Array.isArray(backup.collections) || !Array.isArray(backup.links) || !Array.isArray(backup.tags)) {
    throw new Error('Invalid Linkscape backup');
  }
  await db.transaction('rw', db.collections, db.links, db.tags, db.meta, async () => {
    await db.collections.clear();
    await db.links.clear();
    await db.tags.clear();
    await db.collections.bulkPut(backup.collections);
    await db.links.bulkPut(backup.links);
    await db.tags.bulkPut(backup.tags);
    await db.meta.put({ key: 'vault', value: backup.vault });
  });
  await lockVault();
}
