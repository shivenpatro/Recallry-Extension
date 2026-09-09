import Dexie, { type EntityTable } from 'dexie';
import { DEFAULT_COLLECTION_ID, VAULT_ITERATIONS } from '../shared/constants';
import type { Collection, LinkCard, Tag, VaultSettings } from '../shared/types';
import { nowIso } from '../shared/utils';

interface MetaRecord {
  key: string;
  value: unknown;
}

export class RecallryDatabase extends Dexie {
  collections!: EntityTable<Collection, 'id'>;
  links!: EntityTable<LinkCard, 'id'>;
  tags!: EntityTable<Tag, 'id'>;
  meta!: EntityTable<MetaRecord, 'key'>;

  constructor() {
    // This is a permanent storage identifier, not a visible brand. Renaming it would orphan existing user data.
    super('linkscape');

    this.version(1).stores({
      collections: '&id, parentId, order, isPinned, isFavorite, status, updatedAt',
      links: '&id, collectionId, domain, *tags, order, isArchived, createdAt, updatedAt',
      tags: '&id, &name, createdAt',
      meta: '&key'
    });

    this.version(2)
      .stores({
        collections: '&id, parentId, order, isPinned, isFavorite, status, updatedAt',
        links: '&id, collectionId, domain, *tags, order, isArchived, createdAt, updatedAt',
        tags: '&id, &name, createdAt',
        meta: '&key'
      })
      .upgrade(async (transaction) => {
        await transaction.table<LinkCard, string>('links').toCollection().modify((link) => {
          link.tags = Array.isArray(link.tags) ? link.tags : [];
          link.labels = Array.isArray(link.labels) ? link.labels : [];
          link.isArchived = Boolean(link.isArchived);
        });
      });

    this.version(3)
      .stores({
        collections: '&id, parentId, order, isPinned, isFavorite, status, deletedAt, updatedAt',
        links: '&id, collectionId, domain, *tags, order, isArchived, deletedAt, createdAt, updatedAt',
        tags: '&id, &name, createdAt',
        meta: '&key'
      });
  }
}

export const db = new RecallryDatabase();
let seedPromise: Promise<void> | null = null;

export async function ensureSeedData() {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const collectionCount = await db.collections.count();
    if (collectionCount > 0) return;

    const createdAt = nowIso();
    const starterCollections: Collection[] = [
    {
      id: DEFAULT_COLLECTION_ID,
      title: 'Inbox',
      description: 'Quick saves waiting to be shaped.',
      icon: 'Inbox',
      theme: 'aurora',
      order: 0,
      isPinned: true,
      isFavorite: false,
      isVaultProtected: false,
      status: 'active',
      createdAt,
      updatedAt: createdAt
    },
    {
      id: 'research',
      title: 'Research',
      description: 'Deep reads, references, and rabbit holes worth revisiting.',
      icon: 'Atom',
      theme: 'glacier',
      order: 1,
      isPinned: false,
      isFavorite: true,
      isVaultProtected: false,
      status: 'active',
      smartRules: [
        {
          id: 'rule_research_tag',
          field: 'tags',
          operator: 'contains',
          value: 'research'
        }
      ],
      createdAt,
      updatedAt: createdAt
    },
    {
      id: 'travel',
      title: 'Travel',
      description: 'Places, stays, food, maps, and itinerary sparks.',
      icon: 'Plane',
      theme: 'sunset',
      order: 2,
      isPinned: false,
      isFavorite: false,
      isVaultProtected: false,
      status: 'active',
      createdAt,
      updatedAt: createdAt
    }
    ];

    await db.transaction('rw', db.collections, db.meta, async () => {
      await db.collections.bulkAdd(starterCollections);
      await db.meta.put({
        key: 'vault',
        value: {
          enabled: false,
          iterations: VAULT_ITERATIONS,
          autoLockMinutes: 15,
          updatedAt: createdAt
        } satisfies VaultSettings
      });
    });
  })().finally(() => {
    seedPromise = null;
  });
  return seedPromise;
}

export async function getVaultSettings(): Promise<VaultSettings> {
  const record = await db.meta.get('vault');
  if (record?.value) return record.value as VaultSettings;
  const fallback: VaultSettings = {
    enabled: false,
    iterations: VAULT_ITERATIONS,
    autoLockMinutes: 15,
    updatedAt: nowIso()
  };
  await db.meta.put({ key: 'vault', value: fallback });
  return fallback;
}

export async function setVaultSettings(value: VaultSettings) {
  await db.meta.put({ key: 'vault', value });
}
