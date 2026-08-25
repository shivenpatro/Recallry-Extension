import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/data/db';
import {
  bootstrapRepository,
  createCollection,
  deleteCollection,
  deleteLinks,
  duplicateCollection,
  listCollections,
  listRecentCollectionIds,
  listLinks,
  saveCapturedLink,
  moveLinks,
  reorderCollections,
  restoreBackup,
  restoreDeletedCollection,
  restoreLinks,
  setCollectionProtection,
  updateLinks
} from '../src/data/repositories';
import { createVault, lockVault, unlockVault } from '../src/services/vault';

describe('repository layer', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('seeds starter collections', async () => {
    await Promise.all([bootstrapRepository(), bootstrapRepository()]);
    const collections = await listCollections(true);
    expect(collections.map((collection) => collection.id)).toContain('inbox');
    expect(collections).toHaveLength(3);
  });

  it('saves captured links into a collection', async () => {
    const collection = await createCollection({ title: 'Shopping' });
    const link = await saveCapturedLink(collection.id, {
      title: 'Example',
      url: 'https://example.com/product',
      domain: 'example.com'
    });
    expect(link.collectionId).toBe(collection.id);
    expect(link.domain).toBe('example.com');
    expect(await listRecentCollectionIds()).toEqual([collection.id]);
  });

  it('moves cards to Trash and restores them without data loss', async () => {
    const collection = await createCollection({ title: 'Recoverable' });
    const link = await saveCapturedLink(collection.id, { title: 'Keep me', url: 'https://example.com/keep', domain: 'example.com' });
    await deleteLinks([link.id]);
    await expect(db.links.get(link.id)).resolves.toMatchObject({ id: link.id, deletedAt: expect.any(String) });
    await restoreLinks([link.id]);
    expect((await db.links.get(link.id))?.deletedAt).toBeUndefined();

    await deleteCollection(collection.id);
    await expect(db.collections.get(collection.id)).resolves.toMatchObject({ status: 'trashed', deletedAt: expect.any(String) });
    await expect(db.links.get(link.id)).resolves.toMatchObject({ deletedWithCollectionId: collection.id });
    await restoreDeletedCollection(collection.id);
    await expect(db.collections.get(collection.id)).resolves.toMatchObject({ status: 'active' });
    expect((await db.links.get(link.id))?.deletedAt).toBeUndefined();
  });

  it('rejects unsafe URLs at the repository boundary', async () => {
    const collection = await createCollection({ title: 'Safe imports' });
    await expect(saveCapturedLink(collection.id, {
      title: 'Unsafe',
      url: 'javascript:alert(1)',
      domain: ''
    })).rejects.toThrow('Only http(s)');
    await expect(db.links.count()).resolves.toBe(0);
  });

  it('validates backups before replacing existing data', async () => {
    await bootstrapRepository();
    await createCollection({ title: 'Keep me' });
    await expect(restoreBackup({ version: 1, exportedAt: '', collections: [], links: [], tags: [], vault: null } as never))
      .rejects.toThrow('Invalid Linkscape backup');
    await expect(db.collections.count()).resolves.toBe(4);
  });

  it('rejects cyclic collection hierarchies in backups', async () => {
    await bootstrapRepository();
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      collections: [
        { ...(await db.collections.get('inbox'))!, parentId: undefined },
        { ...(await db.collections.get('research'))!, parentId: 'travel' },
        { ...(await db.collections.get('travel'))!, parentId: 'research' }
      ],
      links: [],
      tags: [],
      vault: (await db.meta.get('vault'))!.value
    };
    await expect(restoreBackup(backup as never)).rejects.toThrow('cyclic collection hierarchy');
  });

  it('preserves unique global order values when reordering a filtered subset', async () => {
    await bootstrapRepository();
    const first = await createCollection({ title: 'First', isFavorite: true });
    const second = await createCollection({ title: 'Second', isFavorite: true });
    await reorderCollections([second.id, first.id]);
    const collections = await listCollections(true);
    expect(new Set(collections.map((collection) => collection.order)).size).toBe(collections.length);
    expect(collections.filter((collection) => [first.id, second.id].includes(collection.id)).map((collection) => collection.id))
      .toEqual([second.id, first.id]);
  });

  it('encrypts protected collection links and hides them while locked', async () => {
    await bootstrapRepository();
    const collection = await createCollection({ title: 'Private' });
    await createVault('secret password', 5);
    await saveCapturedLink(collection.id, {
      title: 'Private page',
      url: 'https://example.com/private',
      domain: 'example.com'
    });
    await setCollectionProtection(collection.id, true);

    const rawCollection = await db.collections.get(collection.id);
    expect(rawCollection).toMatchObject({ title: 'Locked Collection', description: '', isVaultProtected: true });
    expect(rawCollection?.encryptedMetadata).toBeDefined();
    await expect(saveCapturedLink(collection.id, {
      title: 'Duplicate private page',
      url: 'https://example.com/private',
      domain: 'example.com'
    })).rejects.toThrow('already saved');

    const unlocked = await listLinks(collection.id);
    expect(unlocked[0]?.title).toBe('Private page');
    expect(unlocked[0]?.encryptedPayload).toBeDefined();

    await lockVault();
    const locked = await listLinks(collection.id);
    expect(locked[0]?.title).toBe('Protected Link');
    expect(locked[0]?.url).toBe('linkscape://vault');

    await unlockVault('secret password');
    expect((await listLinks(collection.id))[0]?.title).toBe('Private page');
  });

  it('re-encrypts links when moving across a protected collection boundary', async () => {
    await bootstrapRepository();
    const privateCollection = await createCollection({ title: 'Private' });
    const publicCollection = await createCollection({ title: 'Public' });
    await createVault('move password', 5);
    await setCollectionProtection(privateCollection.id, true);

    const link = await saveCapturedLink(publicCollection.id, {
      title: 'Boundary test',
      url: 'https://example.com/boundary',
      domain: 'example.com'
    });
    await moveLinks([link.id], privateCollection.id);

    await expect(db.links.get(link.id)).resolves.toMatchObject({
      collectionId: privateCollection.id,
      isVaultProtected: true
    });
    await lockVault();
    await expect(listLinks(privateCollection.id)).resolves.toMatchObject([{ title: 'Protected Link', url: 'linkscape://vault' }]);

    await unlockVault('move password');
    await moveLinks([link.id], publicCollection.id);
    await expect(db.links.get(link.id)).resolves.toMatchObject({
      collectionId: publicCollection.id,
      isVaultProtected: false,
      encryptedPayload: undefined
    });
  });

  it('duplicates protected collections without exposing stored metadata', async () => {
    const collection = await createCollection({ title: 'Private research', description: 'Confidential notes' });
    await createVault('duplicate password', 5);
    await saveCapturedLink(collection.id, { title: 'Secret page', url: 'https://example.com/secret', domain: 'example.com' });
    await setCollectionProtection(collection.id, true);

    const duplicate = await duplicateCollection(collection.id);
    await expect(db.collections.get(duplicate.id)).resolves.toMatchObject({ title: 'Locked Collection', isVaultProtected: true });
    await expect(listLinks(duplicate.id)).resolves.toMatchObject([{ title: 'Secret page', isVaultProtected: true }]);
  });

  it('archives and restores cards in one batch operation', async () => {
    const collection = await createCollection({ title: 'Archive test' });
    const link = await saveCapturedLink(collection.id, { title: 'Archive me', url: 'https://example.com/archive', domain: 'example.com' });
    await updateLinks([link.id], { isArchived: true });
    await expect(db.links.get(link.id)).resolves.toMatchObject({ isArchived: true });
    await updateLinks([link.id], { isArchived: false });
    await expect(db.links.get(link.id)).resolves.toMatchObject({ isArchived: false });
  });
});
