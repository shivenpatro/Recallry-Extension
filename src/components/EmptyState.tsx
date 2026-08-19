import { Sparkles } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}

export function EmptyState({ title, body, action, onAction }: EmptyStateProps) {
  return (
    <div className="paper-card mx-auto mt-16 max-w-xl p-12 text-center shadow-editorial">
      <div className="mx-auto mb-5 grid h-14 w-14 place-items-center bg-ink text-vermillion">
        <Sparkles aria-hidden />
      </div>
      <h2 className="font-display text-3xl font-medium leading-tight tracking-tight text-ink">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-ink-soft">{body}</p>
      {action ? (
        <Button className="mt-7" onClick={onAction}>
          {action}
        </Button>
      ) : null}
    </div>
  );
}
