import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/data/db';
import {
  bootstrapRepository,
  createCollection,
  listCollections,
  listLinks,
  saveCapturedLink,
  moveLinks,
  setCollectionProtection
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
  });

  it('encrypts protected collection links and hides them while locked', async () => {
    await bootstrapRepository();
    const collection = await createCollection({ title: 'Private' });
    await createVault('secret', 5);
    await saveCapturedLink(collection.id, {
      title: 'Private page',
      url: 'https://example.com/private',
      domain: 'example.com'
    });
    await setCollectionProtection(collection.id, true);

    const unlocked = await listLinks(collection.id);
    expect(unlocked[0]?.title).toBe('Private page');
    expect(unlocked[0]?.encryptedPayload).toBeDefined();

    await lockVault();
    const locked = await listLinks(collection.id);
    expect(locked[0]?.title).toBe('Protected Link');
    expect(locked[0]?.url).toBe('linkscape://vault');

    await unlockVault('secret');
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
});
