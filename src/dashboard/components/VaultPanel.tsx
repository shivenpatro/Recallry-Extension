import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Lock, ShieldCheck, Timer, Unlock } from 'lucide-react';
import { Button } from '../../components/Button';
import { configureVaultRecovery, createVault, isVaultUnlocked, lockVault, resetVault, resetVaultPassword, unlockVault, updateVaultAutoLock } from '../../services/vault';
import { useLinkscapeStore } from '../../store/linkscapeStore';

export function VaultPanel() {
  const vault = useLinkscapeStore((state) => state.vault);
  const refresh = useLinkscapeStore((state) => state.refresh);
  const [password, setPassword] = useState('');
  const [autoLock, setAutoLock] = useState(15);
  const [recoveryQuestion, setRecoveryQuestion] = useState('');
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [resetAnswer, setResetAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [message, setMessage] = useState('');
  const unlocked = isVaultUnlocked();

  useEffect(() => {
    if (vault?.autoLockMinutes) setAutoLock(vault.autoLockMinutes);
  }, [vault?.autoLockMinutes]);

  async function setupOrUnlock() {
    try {
      if (!password) return;
      if (vault?.enabled) await unlockVault(password);
      else await createVault(password, autoLock, recoveryQuestion, recoveryAnswer);
      setPassword('');
      setMessage('Vault ready');
      await refresh();
      void chrome?.runtime?.sendMessage?.({ type: 'LINKSCAPE_REFRESH_CONTEXT_MENUS' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Vault action failed');
    }
  }

  async function handleLock() {
    await lockVault();
    setMessage('Vault locked');
    await refresh();
    void chrome?.runtime?.sendMessage?.({ type: 'LINKSCAPE_REFRESH_CONTEXT_MENUS' });
  }

  async function handleAutoLockBlur() {
    if (!vault?.enabled || !unlocked || autoLock === vault.autoLockMinutes) return;
    try {
      await updateVaultAutoLock(autoLock);
      setMessage(`Auto-lock set to ${autoLock} minutes`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Auto-lock update failed');
    }
  }

  async function handlePasswordReset() {
    try {
      await resetVaultPassword(resetAnswer, newPassword);
      setResetAnswer('');
      setNewPassword('');
      setShowRecovery(false);
      setMessage('Password reset. Vault unlocked.');
      await refresh();
      void chrome?.runtime?.sendMessage?.({ type: 'LINKSCAPE_REFRESH_CONTEXT_MENUS' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Password reset failed');
    }
  }

  async function handleRecoverySetup() {
    try {
      await configureVaultRecovery(password, recoveryQuestion, recoveryAnswer);
      setPassword('');
      setRecoveryQuestion('');
      setRecoveryAnswer('');
      setMessage('Recovery configured');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Recovery setup failed');
    }
  }

  async function handleResetVault() {
    const confirmed = window.confirm('Reset Vault? Locked or encrypted collections cannot be recovered without the old password and will be permanently deleted. Unprotected collections will remain.');
    if (!confirmed) return;
    const confirmation = window.prompt('Type RESET VAULT to continue');
    if (confirmation !== 'RESET VAULT') {
      setMessage('Vault reset cancelled');
      return;
    }
    const removedCount = await resetVault();
    setMessage(`Vault reset. ${removedCount} locked collection${removedCount === 1 ? '' : 's'} removed.`);
    await refresh();
    void chrome?.runtime?.sendMessage?.({ type: 'LINKSCAPE_REFRESH_CONTEXT_MENUS' });
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="min-h-0 flex-1 overflow-y-auto pr-2"
    >
      <div className="grid min-h-[70vh] place-items-center">
        <div className="paper-card w-full max-w-2xl shadow-editorial">
          {/* Masthead */}
          <div className="border-b-2 border-ink bg-ink px-8 py-5">
            <div className="editorial-index text-[10px] font-semibold uppercase tracking-[0.2em] text-vermillion">
              Secure section
            </div>
            <h1 className="mt-1 font-display text-3xl font-medium leading-none tracking-tight text-paper">Vault Mode</h1>
          </div>

          <div className="p-8">
            <div className="mb-6 grid h-16 w-16 place-items-center bg-ink text-vermillion">
              {unlocked ? <Unlock className="h-7 w-7" /> : <Lock className="h-7 w-7" />}
            </div>
            <p className="max-w-xl text-sm leading-7 text-ink-soft">
              Lock sensitive collections locally with PBKDF2 password hashing and AES-GCM encryption. Cloud sync hooks can later encrypt before upload.
            </p>

            <div className="mt-8 grid gap-px overflow-hidden border-2 border-ink sm:grid-cols-3">
              <Metric icon={<ShieldCheck />} label="Encryption" value="AES-GCM" />
              <Metric icon={<KeyRound />} label="Hashing" value="PBKDF2" />
              <Metric icon={<Timer />} label="Auto lock" value={`${vault?.enabled ? vault.autoLockMinutes : autoLock} min`} />
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <input
                className="h-12 min-w-0 flex-1 border border-ink bg-paper px-4 text-ink outline-none placeholder:text-ink-soft/40 focus:border-vermillion"
                type="password"
                placeholder={vault?.enabled ? 'Master password' : 'Create master password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <input
                className="h-12 w-28 border border-ink bg-paper px-4 text-ink outline-none disabled:cursor-not-allowed disabled:opacity-50"
                type="number"
                min={1}
                max={120}
                value={autoLock}
                disabled={Boolean(vault?.enabled && !unlocked)}
                onChange={(event) => setAutoLock(Number(event.target.value))}
                onBlur={() => void handleAutoLockBlur()}
                title="Auto-lock minutes"
              />
              {!vault?.enabled ? (
                <>
                  <input
                    className="h-12 min-w-0 flex-1 border border-ink bg-paper px-4 text-ink outline-none placeholder:text-ink-soft/40"
                    type="text"
                    placeholder="Recovery question"
                    value={recoveryQuestion}
                    onChange={(event) => setRecoveryQuestion(event.target.value)}
                  />
                  <input
                    className="h-12 min-w-0 flex-1 border border-ink bg-paper px-4 text-ink outline-none placeholder:text-ink-soft/40"
                    type="password"
                    placeholder="Recovery answer"
                    value={recoveryAnswer}
                    onChange={(event) => setRecoveryAnswer(event.target.value)}
                  />
                </>
              ) : null}
              <Button onClick={setupOrUnlock}>{vault?.enabled ? 'Unlock' : 'Enable Vault'}</Button>
              {vault?.enabled ? (
                <Button variant="ghost" onClick={handleLock}>
                  Lock
                </Button>
              ) : null}
            </div>
            {vault?.enabled && vault.recoveryQuestion ? (
              <div className="mt-4">
                <button
                  className="text-xs font-semibold uppercase tracking-wider text-vermillion underline-offset-2 hover:underline"
                  onClick={() => setShowRecovery((value) => !value)}
                >
                  {showRecovery ? 'Close password recovery' : 'Forgot password?'}
                </button>
                {showRecovery ? (
                  <div className="mt-3 grid gap-3 border-t border-slate-rule pt-4 sm:grid-cols-[1fr_1fr_auto]">
                    <div className="text-sm text-ink-soft">{vault.recoveryQuestion}</div>
                    <input
                      className="h-10 border border-ink bg-paper px-3 text-sm text-ink outline-none placeholder:text-ink-soft/40"
                      type="password"
                      placeholder="Recovery answer"
                      value={resetAnswer}
                      onChange={(event) => setResetAnswer(event.target.value)}
                    />
                    <input
                      className="h-10 border border-ink bg-paper px-3 text-sm text-ink outline-none placeholder:text-ink-soft/40"
                      type="password"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                    <Button onClick={() => void handlePasswordReset()}>Reset password</Button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {vault?.enabled && !vault.recoveryQuestion && !unlocked ? (
              <p className="mt-4 border-t border-slate-rule pt-4 text-sm text-ink-soft">
                No recovery question is configured for this Vault. Unlock it once to add recovery, then you can reset a forgotten password safely.
              </p>
            ) : null}
            {vault?.enabled && unlocked && !vault.recoveryQuestion ? (
              <div className="mt-4 border-t border-slate-rule pt-4">
                <p className="text-sm text-ink-soft">Add a recovery question so you can reset the master password without losing encrypted collections.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input
                    className="h-10 border border-ink bg-paper px-3 text-sm text-ink outline-none placeholder:text-ink-soft/40"
                    type="text"
                    placeholder="Recovery question"
                    value={recoveryQuestion}
                    onChange={(event) => setRecoveryQuestion(event.target.value)}
                  />
                  <input
                    className="h-10 border border-ink bg-paper px-3 text-sm text-ink outline-none placeholder:text-ink-soft/40"
                    type="password"
                    placeholder="Recovery answer"
                    value={recoveryAnswer}
                    onChange={(event) => setRecoveryAnswer(event.target.value)}
                  />
                </div>
                <Button className="mt-3" variant="ghost" onClick={() => void handleRecoverySetup()}>
                  Save recovery question
                </Button>
              </div>
            ) : null}
            {vault?.enabled ? (
              <div className="mt-5 border-t border-slate-rule pt-4">
                <Button variant="danger" onClick={() => void handleResetVault()}>
                  Reset Vault
                </Button>
                <p className="mt-2 text-xs text-ink-soft/70">Removes encrypted collections that cannot be opened without the old password.</p>
              </div>
            ) : null}
            {message ? <p className="mt-4 editorial-index text-xs font-semibold uppercase tracking-wider text-vermillion">{message}</p> : null}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="bg-paper-soft p-4">
      <div className="mb-3 text-vermillion [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
      <div className="editorial-index text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft/50">{label}</div>
      <div className="editorial-index mt-1 text-sm font-bold text-ink">{value}</div>
    </div>
  );
}
