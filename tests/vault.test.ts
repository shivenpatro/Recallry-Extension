import { beforeEach, describe, expect, it } from 'vitest';
import { db, getVaultSettings } from '../src/data/db';
import { bootstrapRepository, createCollection, saveCapturedLink, setCollectionProtection } from '../src/data/repositories';
import { configureVaultRecovery, createVault, decryptText, encryptText, lockVault, resetVault, resetVaultPassword, unlockVault, updateVaultAutoLock } from '../src/services/vault';

describe('vault service', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('encrypts and decrypts text after unlocking', async () => {
    await expect(createVault('correct horse battery staple', 5)).resolves.toMatchObject({ passwordKdf: 'pbkdf2' });
    const encrypted = await encryptText('private note');
    await lockVault();
    await expect(decryptText(encrypted)).rejects.toThrow('Vault is locked');
    await unlockVault('correct horse battery staple');
    await expect(decryptText(encrypted)).resolves.toBe('private note');
  });

  it('resets a recovery-enabled password without losing encrypted data', async () => {
    await createVault('old password', 5, 'First school?', 'blue sky');
    const encrypted = await encryptText('still private');
    await lockVault();

    await resetVaultPassword('blue sky', 'new password');
    await expect(decryptText(encrypted)).resolves.toBe('still private');

    await lockVault();
    await expect(unlockVault('old password')).rejects.toThrow('Incorrect master password');
    await expect(unlockVault('new password')).resolves.toBe(true);
  });

  it('adds recovery to a legacy vault without re-encrypting existing data', async () => {
    await createVault('legacy password', 5);
    const encrypted = await encryptText('legacy private');
    await configureVaultRecovery('legacy password', 'Favorite color?', 'green');
    await lockVault();

    await resetVaultPassword('green', 'replacement password');
    await expect(decryptText(encrypted)).resolves.toBe('legacy private');
  });

  it('supports an explicit clean reset for an unrecoverable Vault', async () => {
    await bootstrapRepository();
    const collection = await createCollection({ title: 'Locked collection' });
    await createVault('forgotten password', 5);
    await saveCapturedLink(collection.id, { title: 'Private', url: 'https://example.com/private', domain: 'example.com' });
    await setCollectionProtection(collection.id, true);

    await resetVault();

    await expect(db.collections.get(collection.id)).resolves.toBeUndefined();
    await expect(db.collections.get('inbox')).resolves.toBeDefined();
    await expect(getVaultSettings()).resolves.toMatchObject({ enabled: false });
  });

  it('persists a changed auto-lock duration', async () => {
    await createVault('duration password', 15);

    await updateVaultAutoLock(10);

    await expect(getVaultSettings()).resolves.toMatchObject({ autoLockMinutes: 10 });
  });
});
