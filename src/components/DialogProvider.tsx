import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';
import { Button } from './Button';

type DialogTone = 'default' | 'danger';

interface BaseDialogOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
}

interface PromptDialogOptions extends BaseDialogOptions {
  inputLabel?: string;
  initialValue?: string;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  validate?: (value: string) => string | undefined;
}

interface DialogApi {
  alert: (options: BaseDialogOptions) => Promise<void>;
  confirm: (options: BaseDialogOptions) => Promise<boolean>;
  prompt: (options: PromptDialogOptions) => Promise<string | null>;
}

type ActiveDialog =
  | ({ kind: 'alert' } & BaseDialogOptions & { resolve: () => void })
  | ({ kind: 'confirm' } & BaseDialogOptions & { resolve: (confirmed: boolean) => void })
  | ({ kind: 'prompt' } & PromptDialogOptions & { resolve: (value: string | null) => void });

const DialogContext = createContext<DialogApi | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<ActiveDialog | null>(null);
  const activeDialogRef = useRef<ActiveDialog | null>(null);

  const open = useCallback((next: ActiveDialog) => {
    const current = activeDialogRef.current;
    if (current?.kind === 'alert') current.resolve();
    if (current?.kind === 'confirm') current.resolve(false);
    if (current?.kind === 'prompt') current.resolve(null);
    activeDialogRef.current = next;
    setDialog(next);
  }, []);

  const alert = useCallback<DialogApi['alert']>((options) => new Promise((resolve) => {
    open({ kind: 'alert', confirmLabel: 'Got it', ...options, resolve });
  }), [open]);

  const confirm = useCallback<DialogApi['confirm']>((options) => new Promise((resolve) => {
    open({ kind: 'confirm', confirmLabel: 'Continue', cancelLabel: 'Cancel', ...options, resolve });
  }), [open]);

  const prompt = useCallback<DialogApi['prompt']>((options) => new Promise((resolve) => {
    open({ kind: 'prompt', confirmLabel: 'Save', cancelLabel: 'Cancel', ...options, resolve });
  }), [open]);

  const close = useCallback((value?: boolean | string | null) => {
    const current = activeDialogRef.current;
    if (!current) return;
    activeDialogRef.current = null;
    setDialog(null);
    if (current.kind === 'alert') current.resolve();
    if (current.kind === 'confirm') current.resolve(value === true);
    if (current.kind === 'prompt') current.resolve(typeof value === 'string' ? value : null);
  }, []);

  return (
    <DialogContext.Provider value={{ alert, confirm, prompt }}>
      {children}
      {dialog ? <DialogSurface dialog={dialog} onClose={close} /> : null}
    </DialogContext.Provider>
  );
}

function DialogSurface({ dialog, onClose }: { dialog: ActiveDialog; onClose: (value?: boolean | string | null) => void }) {
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const [value, setValue] = useState(dialog.kind === 'prompt' ? dialog.initialValue ?? '' : '');
  const [error, setError] = useState<string>();
  const surfaceRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose(dialog.kind === 'alert' ? undefined : null);
        return;
      }
      if (event.key === 'Tab') {
        const focusable = [...(surfaceRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])];
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [dialog.kind, onClose]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (dialog.kind === 'alert') {
      onClose();
      return;
    }
    if (dialog.kind === 'confirm') {
      onClose(true);
      return;
    }
    const validationError = dialog.required && !value.trim()
      ? 'This field is required.'
      : dialog.validate?.(value);
    if (validationError) {
      setError(validationError);
      return;
    }
    onClose(value);
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-ink/55 p-4 backdrop-blur-[2px]" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose(dialog.kind === 'alert' ? undefined : null);
    }}>
      <form ref={surfaceRef} className="paper-card w-full max-w-lg border-2 border-ink bg-paper p-0 shadow-editorial" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={dialog.message ? descriptionId : undefined} onSubmit={submit}>
        <div className="flex items-start gap-4 border-b border-ink px-6 py-5">
          <span className={dialog.tone === 'danger' ? 'text-vermillion' : 'text-ink'}>
            {dialog.tone === 'danger' ? <AlertTriangle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-2xl font-semibold leading-tight text-ink">{dialog.title}</h2>
            {dialog.message ? <p id={descriptionId} className="mt-2 whitespace-pre-line text-sm leading-6 text-ink-soft">{dialog.message}</p> : null}
          </div>
          <button type="button" className="grid h-8 w-8 place-items-center text-ink-soft transition hover:bg-ink hover:text-paper" aria-label="Close dialog" onClick={() => onClose(dialog.kind === 'alert' ? undefined : null)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {dialog.kind === 'prompt' ? (
          <div className="px-6 py-5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink" htmlFor={inputId}>{dialog.inputLabel ?? dialog.title}</label>
            {dialog.multiline ? (
              <textarea id={inputId} className="mt-2 min-h-28 w-full resize-y border border-ink bg-paper-soft px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-vermillion" value={value} placeholder={dialog.placeholder} autoFocus onChange={(event) => { setValue(event.target.value); setError(undefined); }} />
            ) : (
              <input id={inputId} className="mt-2 h-11 w-full border border-ink bg-paper-soft px-3 text-sm outline-none focus:ring-2 focus:ring-vermillion" value={value} placeholder={dialog.placeholder} autoFocus onChange={(event) => { setValue(event.target.value); setError(undefined); }} />
            )}
            {error ? <p className="mt-2 text-sm font-medium text-vermillion" role="alert">{error}</p> : null}
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3 border-t border-ink bg-paper-soft px-6 py-4">
          {dialog.kind !== 'alert' ? <Button type="button" variant="ghost" onClick={() => onClose(null)}>{dialog.cancelLabel ?? 'Cancel'}</Button> : null}
          <Button type="submit" autoFocus={dialog.kind !== 'prompt'} variant={dialog.tone === 'danger' ? 'danger' : 'primary'}>{dialog.confirmLabel ?? 'Continue'}</Button>
        </div>
      </form>
    </div>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) throw new Error('useDialog must be used inside DialogProvider');
  return context;
}
