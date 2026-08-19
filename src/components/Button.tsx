import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../shared/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  children: ReactNode;
}

export function Button({ className, variant = 'primary', children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 px-4 text-xs font-semibold uppercase tracking-wider transition duration-150 disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary' && 'bg-ink text-paper hover:bg-vermillion hover:shadow-editorial-vermillion active:translate-x-0.5 active:translate-y-0.5',
        variant === 'ghost' && 'border border-ink bg-transparent text-ink hover:bg-ink hover:text-paper',
        variant === 'danger' && 'border border-vermillion bg-vermillion/10 text-vermillion hover:bg-vermillion hover:text-paper',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
