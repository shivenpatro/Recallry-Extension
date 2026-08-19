import { db } from '../data/db';
import type { Collection, LinkCard } from '../shared/types';
import { createId, nowIso } from '../shared/utils';

export interface CollectionSharePackage {
  version: 1;
  mode: 'offline-package';
  exportedAt: string;
  collection: Collection;
  links: LinkCard[];
}

export interface ReadOnlyShareDescriptor {
  version: 1;
  mode: 'read-only-link';
  shareId: string;
  createdAt: string;
  collectionId: string;
  collectionTitle: string;
  expiresAt?: string;
  transport: {
    adapter: 'future-cloud-sync';
    requiresEncryptionAtRest: true;
    permissions: ['read'];
  };
}

export async function createCollectionPackage(collectionId: string): Promise<CollectionSharePackage> {
  const collection = await db.collections.get(collectionId);
  if (!collection) throw new Error('Collection not found');
  const links = await db.links.where({ collectionId }).sortBy('order');
  return {
    version: 1,
    mode: 'offline-package',
    exportedAt: nowIso(),
    collection,
    links
  };
}

export async function createReadOnlyShareDescriptor(collectionId: string, expiresAt?: string): Promise<ReadOnlyShareDescriptor> {
  const collection = await db.collections.get(collectionId);
  if (!collection) throw new Error('Collection not found');
  return {
    version: 1,
    mode: 'read-only-link',
    shareId: createId('share'),
    createdAt: nowIso(),
    collectionId,
    collectionTitle: collection.title,
    expiresAt,
    transport: {
      adapter: 'future-cloud-sync',
      requiresEncryptionAtRest: true,
      permissions: ['read']
    }
  };
}
