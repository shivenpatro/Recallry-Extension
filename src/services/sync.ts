import type { BackupEnvelope } from '../shared/types';
import { validateBackup } from '../data/repositories';

const SYNC_KDF_ITERATIONS = 600_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface EncryptedSyncEnvelope {
  version: 1;
  algorithm: 'AES-GCM';
  kdf: 'PBKDF2-SHA-256';
  iterations: number;
  salt: string;
  iv: string;
  data: string;
  encryptedAt: string;
}

export interface SyncRevision {
  revision: string;
  updatedAt: string;
  payload: EncryptedSyncEnvelope;
}

export interface SyncProvider {
  readonly id: string;
  pull(signal?: AbortSignal): Promise<SyncRevision | null>;
  push(revision: SyncRevision, previousRevision?: string, signal?: AbortSignal): Promise<SyncRevision>;
}

export async function encryptBackupForSync(backup: BackupEnvelope, passphrase: string): Promise<EncryptedSyncEnvelope> {
  if (passphrase.length < 12) throw new Error('Sync passphrase must be at least 12 characters');
  validateBackup(backup);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveSyncKey(passphrase, salt, SYNC_KDF_ITERATIONS);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(backup)));
  return {
    version: 1,
    algorithm: 'AES-GCM',
    kdf: 'PBKDF2-SHA-256',
    iterations: SYNC_KDF_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
    encryptedAt: new Date().toISOString()
  };
}

export async function decryptBackupFromSync(envelope: EncryptedSyncEnvelope, passphrase: string) {
  if (envelope.version !== 1 || envelope.algorithm !== 'AES-GCM' || envelope.kdf !== 'PBKDF2-SHA-256' || envelope.iterations < 100_000) {
    throw new Error('Unsupported encrypted sync envelope');
  }
  const salt = base64ToBytes(envelope.salt);
  const key = await deriveSyncKey(passphrase, salt, envelope.iterations);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: asArrayBuffer(base64ToBytes(envelope.iv)) }, key, asArrayBuffer(base64ToBytes(envelope.data)));
  const backup = JSON.parse(decoder.decode(decrypted)) as BackupEnvelope;
  validateBackup(backup);
  return backup;
}

async function deriveSyncKey(passphrase: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: asArrayBuffer(salt), iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

function asArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
