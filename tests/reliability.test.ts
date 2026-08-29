import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/data/db';
import { bootstrapRepository, createBackup, createCollection } from '../src/data/repositories';
import { createAutomaticBackup, getBackupHealth, listAutomaticBackups } from '../src/services/backups';
import { decryptBackupFromSync, encryptBackupForSync } from '../src/services/sync';
import { getLinkHealthOriginPatterns, removeLinkHealthPermissions } from '../src/services/linkHealth';
import type { LinkCard } from '../src/shared/types';

describe('local recovery points', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await bootstrapRepository();
  });

  it('keeps the five newest rolling backups', async () => {
    for (let index = 0; index < 6; index += 1) {
      await createCollection({ title: `Checkpoint ${index}` });
      await createAutomaticBackup('manual');
    }
    expect(await listAutomaticBackups()).toHaveLength(5);
    await expect(getBackupHealth()).resolves.toMatchObject({ count: 5, status: 'healthy' });
  });

  it('encrypts and validates a future sync envelope end to end', async () => {
    const backup = await createBackup();
    const encrypted = await encryptBackupForSync(backup, 'correct horse battery staple');
    expect(encrypted.data).not.toContain('Inbox');
    await expect(decryptBackupFromSync(encrypted, 'correct horse battery staple')).resolves.toMatchObject({ version: 1 });
    await expect(decryptBackupFromSync(encrypted, 'wrong password value')).rejects.toThrow();
  });
});

describe('least-privilege link health', () => {
  const baseLink = {
    collectionId: 'inbox',
    title: 'Example',
    domain: 'example.com',
    notes: '',
    tags: [],
    labels: [],
    order: 0,
    isArchived: false,
    isVaultProtected: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  } satisfies Omit<LinkCard, 'id' | 'url'>;

  it('requests only unique origins represented by saved, non-trashed links', () => {
    const links: LinkCard[] = [
      { ...baseLink, id: 'one', url: 'https://example.com/article' },
      { ...baseLink, id: 'two', url: 'https://example.com/another' },
      { ...baseLink, id: 'three', url: 'http://docs.example.net/start' },
      { ...baseLink, id: 'deleted', url: 'https://deleted.example/', deletedAt: '2026-01-02T00:00:00.000Z' },
      { ...baseLink, id: 'protected', url: 'linkscape://vault' }
    ];
    expect(getLinkHealthOriginPatterns(links)).toEqual(['http://docs.example.net/*', 'https://example.com/*']);
  });

  it('removes previously granted website access even after its cards are gone', async () => {
    const remove = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('chrome', {
      permissions: {
        getAll: vi.fn().mockResolvedValue({ permissions: [], origins: ['https://old.example/*'] }),
        remove
      }
    });
    try {
      await expect(removeLinkHealthPermissions([])).resolves.toBe(true);
      expect(remove).toHaveBeenCalledWith({ origins: ['https://old.example/*'] });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
