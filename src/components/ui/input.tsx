'use client';

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import { cn } from '@/lib/utils';

const BASE =
  'w-full rounded-2xl border border-line bg-surface/95 px-3.5 text-ink placeholder:text-faint ' +
  'transition-all duration-150 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none disabled:opacity-50 shadow-2xs';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(BASE, 'h-11 text-sm', className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(BASE, 'min-h-20 py-2.5 text-sm', className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return <select ref={ref} className={cn(BASE, 'h-11 pr-8 text-sm', className)} {...props} />;
  },
);

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="block text-xs font-bold text-muted uppercase tracking-wider">{label}</span>
      {children}
      {error ? (
        <span className="block text-xs text-bad font-semibold">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

/** A row of mutually exclusive options with tactile active tab styling. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn('flex gap-1 rounded-2xl bg-raised/90 p-1 border border-line/60', className)}
    >
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex-1 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150 active:scale-95 text-center',
              isSelected
                ? 'bg-surface text-ink shadow-xs border border-line/70 font-extrabold'
                : 'text-muted hover:text-ink hover:bg-surface/50',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 text-left transition-opacity hover:opacity-90 active:scale-[0.99]"
    >
      <span className="min-w-0">
        <span className="block text-sm font-bold text-ink">{label}</span>
        {hint ? <span className="block text-xs text-muted mt-0.5">{hint}</span> : null}
      </span>
      <span
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 border',
          checked ? 'bg-accent border-accent/40 shadow-xs' : 'bg-raised border-line',
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-all duration-200',
            checked ? 'left-[22px]' : 'left-[3px]',
          )}
        />
      </span>
    </button>
  );
}
