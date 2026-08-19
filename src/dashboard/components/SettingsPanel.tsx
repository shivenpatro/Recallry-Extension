import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Database, Download, Network, Upload } from 'lucide-react';
import { Button } from '../../components/Button';

interface SettingsPanelProps {
  onExport: (format: 'json' | 'csv' | 'html') => Promise<void>;
  onImport: (file: File) => Promise<void>;
}

export function SettingsPanel({ onExport, onImport }: SettingsPanelProps) {
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
          <p className="text-sm leading-6 text-ink-soft">Collections, cards, tags, and vault metadata live in IndexedDB. Linkscape works offline by default.</p>
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
          <p className="text-sm leading-6 text-ink-soft">Restore a Linkscape backup or import Chrome, Edge, Firefox, CSV, and bookmark HTML exports.</p>
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

        <Panel icon={<Network />} index="03" title="Future Sync Contract">
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
