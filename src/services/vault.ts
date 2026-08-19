import { db, getVaultSettings, setVaultSettings } from '../data/db';
import type { EncryptedPayload, LinkCard, VaultSettings } from '../shared/types';
import { nowIso } from '../shared/utils';
import { VAULT_ITERATIONS } from '../shared/constants';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let activeVaultKey: CryptoKey | null = null;
let autoLockTimer: ReturnType<typeof setTimeout> | null = null;

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function asArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function sha256Base64(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

async function pbkdf2Verifier(password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: asArrayBuffer(salt),
      iterations,
      hash: 'SHA-256'
    },
    material,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

function normalizeRecoveryAnswer(value: string) {
  return value.trim().toLocaleLowerCase();
}

async function deriveKey(password: string, salt: Uint8Array, iterations = VAULT_ITERATIONS, extractable = false) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: asArrayBuffer(salt),
      iterations,
      hash: 'SHA-256'
    },
    material,
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['encrypt', 'decrypt']
  );
}

async function generateVaultDataKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

async function exportVaultDataKey(key: CryptoKey) {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key));
}

async function importVaultDataKey(value: Uint8Array) {
  return crypto.subtle.importKey('raw', asArrayBuffer(value), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function encryptWithKey(value: string, key: CryptoKey): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asArrayBuffer(iv) }, key, encoder.encode(value));
  return { iv: bytesToBase64(iv), salt: '', data: bytesToBase64(new Uint8Array(encrypted)) };
}

async function decryptWithKey(payload: EncryptedPayload, key: CryptoKey) {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: asArrayBuffer(base64ToBytes(payload.iv)) },
    key,
    base64ToBytes(payload.data)
  );
  return decoder.decode(decrypted);
}

function scheduleAutoLock(minutes: number) {
  if (autoLockTimer) globalThis.clearTimeout(autoLockTimer);
  if (minutes <= 0) return;
  autoLockTimer = setTimeout(() => {
    void lockVault();
  }, minutes * 60 * 1000);
}

function validateAutoLockMinutes(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 120) {
    throw new Error('Auto-lock must be between 1 and 120 minutes');
  }
}

export async function createVault(password: string, autoLockMinutes = 15, recoveryQuestion = '', recoveryAnswer = ''): Promise<VaultSettings> {
  if (!password.trim()) throw new Error('Master password is required');
  validateAutoLockMinutes(autoLockMinutes);
  if ((recoveryQuestion.trim() && !recoveryAnswer.trim()) || (!recoveryQuestion.trim() && recoveryAnswer.trim())) {
    throw new Error('Enter both a recovery question and answer');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await pbkdf2Verifier(password, salt, VAULT_ITERATIONS);
  const hasRecovery = Boolean(recoveryQuestion.trim() && recoveryAnswer.trim());
  const dataKey = hasRecovery ? await generateVaultDataKey() : await deriveKey(password, salt, VAULT_ITERATIONS, true);
  activeVaultKey = dataKey;
  const settings: VaultSettings = {
    enabled: true,
    passwordHash,
    passwordKdf: 'pbkdf2',
    salt: bytesToBase64(salt),
    iterations: VAULT_ITERATIONS,
    autoLockMinutes,
    updatedAt: nowIso(),
    ...(hasRecovery
      ? {
          version: 2 as const,
          recoveryQuestion: recoveryQuestion.trim(),
          recoverySalt: bytesToBase64(crypto.getRandomValues(new Uint8Array(16))),
          recoveryAnswerHash: '',
          passwordWrappedKey: undefined,
          recoveryWrappedKey: undefined
        }
      : {})
  };
  if (hasRecovery && settings.recoverySalt) {
    const rawDataKey = bytesToBase64(await exportVaultDataKey(dataKey));
    const passwordKey = await deriveKey(password, salt, settings.iterations);
    const normalizedAnswer = normalizeRecoveryAnswer(recoveryAnswer);
    const recoveryKey = await deriveKey(normalizedAnswer, base64ToBytes(settings.recoverySalt), settings.iterations);
    settings.recoveryAnswerHash = await sha256Base64(`${normalizedAnswer}:${settings.recoverySalt}`);
    settings.passwordWrappedKey = await encryptWithKey(rawDataKey, passwordKey);
    settings.recoveryWrappedKey = await encryptWithKey(rawDataKey, recoveryKey);
  }
  await setVaultSettings(settings);
  scheduleAutoLock(autoLockMinutes);
  return settings;
}

export async function unlockVault(password: string) {
  const settings = await getVaultSettings();
  if (!settings.enabled || !settings.salt || !settings.passwordHash) {
    throw new Error('Vault is not configured');
  }
  const attemptedHash = settings.passwordKdf === 'pbkdf2'
    ? await pbkdf2Verifier(password, base64ToBytes(settings.salt), settings.iterations)
    : await sha256Base64(`${password}:${settings.salt}`);
  if (attemptedHash !== settings.passwordHash) {
    throw new Error('Incorrect master password');
  }
  if (settings.version === 2 && settings.passwordWrappedKey) {
    const passwordKey = await deriveKey(password, base64ToBytes(settings.salt), settings.iterations);
    const rawDataKey = await decryptWithKey(settings.passwordWrappedKey, passwordKey);
    activeVaultKey = await importVaultDataKey(base64ToBytes(rawDataKey));
  } else {
    activeVaultKey = await deriveKey(password, base64ToBytes(settings.salt), settings.iterations, true);
  }
  await setVaultSettings({ ...settings, lockedAt: undefined, updatedAt: nowIso() });
  scheduleAutoLock(settings.autoLockMinutes);
  return true;
}

export async function updateVaultAutoLock(autoLockMinutes: number) {
  validateAutoLockMinutes(autoLockMinutes);
  const settings = await getVaultSettings();
  if (!settings.enabled) throw new Error('Vault is not configured');

  const nextSettings = { ...settings, autoLockMinutes, updatedAt: nowIso() };
  await setVaultSettings(nextSettings);
  if (activeVaultKey) scheduleAutoLock(autoLockMinutes);
  return nextSettings;
}

export async function configureVaultRecovery(currentPassword: string, recoveryQuestion: string, recoveryAnswer: string) {
  if (!recoveryQuestion.trim() || !recoveryAnswer.trim()) throw new Error('Enter both a recovery question and answer');
  const settings = await getVaultSettings();
  if (!settings.enabled || !settings.salt || !settings.passwordHash) throw new Error('Vault is not configured');
  await unlockVault(currentPassword);
  if (!activeVaultKey) throw new Error('Vault is locked');

  const recoverySalt = crypto.getRandomValues(new Uint8Array(16));
  const normalizedAnswer = normalizeRecoveryAnswer(recoveryAnswer);
  const rawDataKey = bytesToBase64(await exportVaultDataKey(activeVaultKey));
  const passwordKey = await deriveKey(currentPassword, base64ToBytes(settings.salt), settings.iterations);
  const recoveryKey = await deriveKey(normalizedAnswer, recoverySalt, settings.iterations);
  await setVaultSettings({
    ...settings,
    version: 2,
    passwordHash: await pbkdf2Verifier(currentPassword, base64ToBytes(settings.salt), settings.iterations),
    passwordKdf: 'pbkdf2',
    recoveryQuestion: recoveryQuestion.trim(),
    recoverySalt: bytesToBase64(recoverySalt),
    recoveryAnswerHash: await sha256Base64(`${normalizedAnswer}:${bytesToBase64(recoverySalt)}`),
    passwordWrappedKey: await encryptWithKey(rawDataKey, passwordKey),
    recoveryWrappedKey: await encryptWithKey(rawDataKey, recoveryKey),
    lockedAt: undefined,
    updatedAt: nowIso()
  });
}

export async function resetVaultPassword(recoveryAnswer: string, newPassword: string) {
  if (!newPassword.trim()) throw new Error('New master password is required');
  const settings = await getVaultSettings();
  if (!settings.enabled || settings.version !== 2 || !settings.recoverySalt || !settings.recoveryAnswerHash || !settings.recoveryWrappedKey) {
    throw new Error('Recovery is not configured for this Vault');
  }
  const normalizedAnswer = normalizeRecoveryAnswer(recoveryAnswer);
  const attemptedHash = await sha256Base64(`${normalizedAnswer}:${settings.recoverySalt}`);
  if (attemptedHash !== settings.recoveryAnswerHash) throw new Error('Incorrect recovery answer');

  const recoveryKey = await deriveKey(normalizedAnswer, base64ToBytes(settings.recoverySalt), settings.iterations);
  const rawDataKey = await decryptWithKey(settings.recoveryWrappedKey, recoveryKey);
  const dataKey = await importVaultDataKey(base64ToBytes(rawDataKey));
  const newSalt = crypto.getRandomValues(new Uint8Array(16));
  const passwordKey = await deriveKey(newPassword, newSalt, settings.iterations);
  const passwordWrappedKey = await encryptWithKey(rawDataKey, passwordKey);
  const nextSettings: VaultSettings = {
    ...settings,
    passwordHash: await pbkdf2Verifier(newPassword, newSalt, settings.iterations),
    passwordKdf: 'pbkdf2',
    salt: bytesToBase64(newSalt),
    passwordWrappedKey,
    lockedAt: undefined,
    updatedAt: nowIso()
  };
  await setVaultSettings(nextSettings);
  activeVaultKey = dataKey;
  scheduleAutoLock(settings.autoLockMinutes);
}

export async function lockVault() {
  activeVaultKey = null;
  if (autoLockTimer) globalThis.clearTimeout(autoLockTimer);
  autoLockTimer = null;
  const settings = await getVaultSettings();
  if (settings.enabled) {
    await setVaultSettings({ ...settings, lockedAt: nowIso(), updatedAt: nowIso() });
  }
  if (typeof globalThis.dispatchEvent === 'function') globalThis.dispatchEvent(new Event('linkscape-vault-locked'));
}

export async function resetVault() {
  const protectedCollections = (await db.collections.toArray()).filter((collection) => collection.isVaultProtected);
  const protectedIds = protectedCollections.map((collection) => collection.id);
  const resetSettings: VaultSettings = {
    enabled: false,
    iterations: VAULT_ITERATIONS,
    autoLockMinutes: 15,
    updatedAt: nowIso()
  };

  await db.transaction('rw', db.collections, db.links, db.meta, async () => {
    for (const collectionId of protectedIds) {
      await db.links.where({ collectionId }).delete();
      await db.collections.delete(collectionId);
    }
    await db.meta.put({ key: 'vault', value: resetSettings });
  });

  activeVaultKey = null;
  if (autoLockTimer) globalThis.clearTimeout(autoLockTimer);
  autoLockTimer = null;
  if (typeof globalThis.dispatchEvent === 'function') globalThis.dispatchEvent(new Event('linkscape-vault-locked'));
  return protectedCollections.length;
}

export function isVaultUnlocked() {
  return Boolean(activeVaultKey);
}

export async function encryptText(value: string): Promise<EncryptedPayload> {
  if (!activeVaultKey) throw new Error('Vault is locked');
  const settings = await getVaultSettings();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asArrayBuffer(iv) }, activeVaultKey, encoder.encode(value));
  scheduleAutoLock(settings.autoLockMinutes);
  return {
    iv: bytesToBase64(iv),
    salt: settings.salt ?? '',
    data: bytesToBase64(new Uint8Array(encrypted))
  };
}

export async function decryptText(payload: EncryptedPayload) {
  if (!activeVaultKey) throw new Error('Vault is locked');
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: asArrayBuffer(base64ToBytes(payload.iv)) },
    activeVaultKey,
    base64ToBytes(payload.data)
  );
  const settings = await getVaultSettings();
  scheduleAutoLock(settings.autoLockMinutes);
  return decoder.decode(decrypted);
}

export async function encryptLink(link: LinkCard): Promise<LinkCard> {
  const protectedFields = JSON.stringify({
    title: link.title,
    url: link.url,
    notes: link.notes,
    tags: link.tags,
    labels: link.labels,
    thumbnailUrl: link.thumbnailUrl
  });
  const encryptedPayload = await encryptText(protectedFields);
  return {
    ...link,
    title: 'Protected Link',
    url: 'linkscape://vault',
    notes: '',
    tags: [],
    labels: [],
    thumbnailUrl: undefined,
    isVaultProtected: true,
    encryptedPayload
  };
}

export async function decryptLink(link: LinkCard): Promise<LinkCard> {
  if (!link.encryptedPayload) return link;
  const decrypted = JSON.parse(await decryptText(link.encryptedPayload)) as Partial<LinkCard>;
  return {
    ...link,
    ...decrypted,
    isVaultProtected: true
  };
}
