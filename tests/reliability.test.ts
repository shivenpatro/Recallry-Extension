import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/data/db';
import { bootstrapRepository, createBackup, createCollection } from '../src/data/repositories';
import { createAutomaticBackup, getBackupHealth, listAutomaticBackups } from '../src/services/backups';
import { decryptBackupFromSync, encryptBackupForSync } from '../src/services/sync';

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
