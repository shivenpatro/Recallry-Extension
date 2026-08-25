import { db } from '../data/db';
import { createBackup, restoreBackup } from '../data/repositories';
import type { BackupEnvelope } from '../shared/types';
import { createId, nowIso } from '../shared/utils';

const AUTOMATIC_BACKUPS_KEY = 'automatic-backups';
const MAX_AUTOMATIC_BACKUPS = 5;

export interface AutomaticBackupRecord {
  id: string;
  createdAt: string;
  reason: 'scheduled' | 'before-import' | 'manual';
  backup: BackupEnvelope;
}

export async function listAutomaticBackups() {
  const record = await db.meta.get(AUTOMATIC_BACKUPS_KEY);
  return Array.isArray(record?.value) ? record.value as AutomaticBackupRecord[] : [];
}

export async function createAutomaticBackup(reason: AutomaticBackupRecord['reason']) {
  const current = await listAutomaticBackups();
  const record: AutomaticBackupRecord = {
    id: createId('backup'),
    createdAt: nowIso(),
    reason,
    backup: await createBackup()
  };
  await db.meta.put({ key: AUTOMATIC_BACKUPS_KEY, value: [record, ...current].slice(0, MAX_AUTOMATIC_BACKUPS) });
  return record;
}

export async function ensureFreshAutomaticBackup() {
  const latest = (await listAutomaticBackups())[0];
  if (!latest || Date.now() - new Date(latest.createdAt).getTime() >= 24 * 60 * 60 * 1000) {
    return createAutomaticBackup('scheduled');
  }
  return latest;
}

export async function restoreAutomaticBackup(id: string) {
  const record = (await listAutomaticBackups()).find((backup) => backup.id === id);
  if (!record) throw new Error('Recovery point not found');
  await restoreBackup(record.backup);
  return record;
}

export async function getBackupHealth() {
  const backups = await listAutomaticBackups();
  const latest = backups[0];
  const ageHours = latest ? (Date.now() - new Date(latest.createdAt).getTime()) / 3_600_000 : Number.POSITIVE_INFINITY;
  return {
    count: backups.length,
    latest,
    status: !latest ? 'missing' as const : ageHours > 48 ? 'stale' as const : 'healthy' as const
  };
}
