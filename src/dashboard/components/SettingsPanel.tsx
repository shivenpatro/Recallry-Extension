import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Activity, Database, Download, History, Network, Shield, ShieldCheck, Upload } from 'lucide-react';
import { Button } from '../../components/Button';
import { createAutomaticBackup, getBackupHealth, restoreAutomaticBackup, type AutomaticBackupRecord } from '../../services/backups';
import { useRecallryStore } from '../../store/recallryStore';
import { checkLinksHealth, removeLinkHealthPermissions, requestLinkHealthPermission, type LinkHealthSummary } from '../../services/linkHealth';
import { useDialog } from '../../components/DialogProvider';

interface SettingsPanelProps {
  onExport: (format: 'json' | 'csv' | 'html') => Promise<void>;
  onImport: (file: File) => Promise<void>;
}

export function SettingsPanel({ onExport, onImport }: SettingsPanelProps) {
  const { alert, confirm } = useDialog();
  const refresh = useRecallryStore((state) => state.refresh);
  const links = useRecallryStore((state) => state.links);
  const [backupStatus, setBackupStatus] = useState<'loading' | 'healthy' | 'stale' | 'missing'>('loading');
  const [latestBackup, setLatestBackup] = useState<AutomaticBackupRecord>();
  const [backupCount, setBackupCount] = useState(0);
  const [healthSummary, setHealthSummary] = useState<LinkHealthSummary>();
  const [checkingLinks, setCheckingLinks] = useState(false);

  async function refreshBackupHealth() {
    const health = await getBackupHealth();
    setBackupStatus(health.status);
    setLatestBackup(health.latest);
    setBackupCount(health.count);
  }

  useEffect(() => {
    void refreshBackupHealth();
  }, []);

  async function createRecoveryPoint() {
    await createAutomaticBackup('manual');
    await refreshBackupHealth();
  }

  async function restoreLatest() {
    if (!latestBackup) return;
    const approved = await confirm({ title: 'Restore this recovery point?', message: `Restore the checkpoint from ${new Date(latestBackup.createdAt).toLocaleString()}? Recallry will create a new checkpoint first.`, confirmLabel: 'Restore checkpoint' });
    if (!approved) return;
    await createAutomaticBackup('manual');
    await restoreAutomaticBackup(latestBackup.id);
    await refresh();
    await refreshBackupHealth();
  }

  async function runLinkCheck() {
    const permittedOrigins = await requestLinkHealthPermission(links);
    if (permittedOrigins.length === 0) {
      await alert({ title: 'Website access not granted', message: 'Recallry did not check any saved links. You can try again and approve access only to the listed saved sites.' });
      return;
    }
    setCheckingLinks(true);
    try {
      const summary = await checkLinksHealth(links, permittedOrigins, setHealthSummary);
      setHealthSummary(summary);
      await refresh();
    } finally {
      setCheckingLinks(false);
    }
  }

  async function removeLinkCheckAccess() {
    const removed = await removeLinkHealthPermissions(links);
    await alert({ title: removed ? 'Website access removed' : 'No website access to remove', message: removed ? 'Recallry can no longer check the previously approved saved sites.' : 'Recallry does not currently have saved-site access.' });
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="min-h-0 flex-1 overflow-y-auto pr-2"
    >
      <div className="mb-8 border-b-2 border-ink pb-5">
        <div className="editorial-index mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-vermillion">Controls</div>
        <h1 className="font-display text-6xl font-medium leading-[0.9] tracking-tightest text-ink">Settings</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-ink-soft">Privacy-first controls, portability, and future sync architecture.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel icon={<Database />} index="01" title="Local Data">
          <p className="text-sm leading-6 text-ink-soft">Collections, cards, tags, and vault metadata live in IndexedDB. Recallry works offline by default.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => void onExport('json')}>
              <Download className="h-3.5 w-3.5" />
              Backup JSON
            </Button>
            <Button variant="ghost" onClick={() => void onExport('html')}>
              HTML
            </Button>
            <Button variant="ghost" onClick={() => void onExport('csv')}>
              CSV
            </Button>
          </div>
        </Panel>

        <Panel icon={<Upload />} index="02" title="Import">
          <p className="text-sm leading-6 text-ink-soft">Restore a Recallry backup or import Chrome, Edge, Firefox, CSV, and bookmark HTML exports.</p>
          <label className="mt-5 inline-flex h-10 cursor-pointer items-center justify-center gap-2 bg-ink px-4 text-xs font-semibold uppercase tracking-wider text-paper transition hover:bg-vermillion">
            <Upload className="h-3.5 w-3.5" />
            Choose File
            <input
              className="sr-only"
              type="file"
              accept=".json,.csv,.html,.htm"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void onImport(file);
                event.currentTarget.value = '';
              }}
            />
          </label>
        </Panel>

        <Panel icon={<History />} index="03" title="Recovery Points">
          <p className="text-sm leading-6 text-ink-soft">
            {backupStatus === 'healthy' && latestBackup ? `Protected. Latest local checkpoint: ${new Date(latestBackup.createdAt).toLocaleString()}.` : null}
            {backupStatus === 'stale' ? 'Your latest local checkpoint is more than two days old.' : null}
            {backupStatus === 'missing' ? 'No automatic recovery point exists yet.' : null}
            {backupStatus === 'loading' ? 'Checking local backup health…' : null}
          </p>
          <p className="mt-2 editorial-index text-[10px] uppercase tracking-wider text-ink-soft/50">{backupCount} of 5 rolling checkpoints</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => void createRecoveryPoint()}><ShieldCheck className="h-3.5 w-3.5" /> Back up now</Button>
            <Button variant="ghost" disabled={!latestBackup} onClick={() => void restoreLatest()}>Restore latest</Button>
          </div>
        </Panel>

        <Panel icon={<Activity />} index="04" title="Link Health">
          <p className="text-sm leading-6 text-ink-soft">Check saved pages on demand. Recallry requests access only to saved domains included in the scan and never reads browsing history.</p>
          {healthSummary ? <p className="mt-3 editorial-index text-[10px] uppercase tracking-wider text-ink-soft">{healthSummary.checked} checked · {healthSummary.healthy} healthy · {healthSummary.broken} broken · {healthSummary.unknown} unknown · {healthSummary.skipped} skipped</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button disabled={checkingLinks} onClick={() => void runLinkCheck()}>{checkingLinks ? 'Checking…' : 'Check saved links'}</Button>
            <Button variant="ghost" disabled={checkingLinks} onClick={() => void removeLinkCheckAccess()}>Remove access</Button>
          </div>
        </Panel>

        <Panel icon={<Shield />} index="05" title="Privacy">
          <p className="text-sm leading-6 text-ink-soft">Local-first storage. No analytics, advertising trackers, or sale of personal data. Vault content is encrypted on this device before it can leave it.</p>
        </Panel>

        <Panel icon={<Network />} index="06" title="Future Sync Contract">
          <p className="text-sm leading-6 text-ink-soft">
            Sync adapters can consume the same backup envelope, encrypt payloads before transport, resolve conflicts by updated timestamps, and support teams later.
          </p>
        </Panel>
      </div>
    </motion.section>
  );
}

function Panel({ icon, index, title, children }: { icon: ReactNode; index: string; title: string; children: ReactNode }) {
  return (
    <article className="paper-card p-6 shadow-editorial-sm transition hover:shadow-editorial">
      <div className="flex items-center justify-between border-b border-slate-rule pb-3">
        <div className="grid h-10 w-10 place-items-center bg-ink text-vermillion [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
        <span className="editorial-index text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft/50">{index}</span>
      </div>
      <h2 className="mt-4 font-display text-2xl font-medium tracking-tight text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </article>
  );
}
