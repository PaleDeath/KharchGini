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
  'w-full rounded-xl border border-line bg-surface px-3 text-ink placeholder:text-faint ' +
  'transition-colors focus:border-accent focus:outline-none disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(BASE, 'h-11', className)} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(BASE, 'min-h-20 py-2.5', className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    // A native select on a phone gives the OS picker, which is faster and more
    // accessible than anything reimplemented in a div.
    return <select ref={ref} className={cn(BASE, 'h-11 pr-8', className)} {...props} />;
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
  // Wrapping the control implicitly associates it with the label, which is more
  // robust than an id that has to stay unique across a dynamically built form.
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {error ? (
        <span className="block text-[12px] text-bad">{error}</span>
      ) : hint ? (
        <span className="block text-[12px] text-faint">{hint}</span>
      ) : null}
    </label>
  );
}

/** A row of mutually exclusive options. Used for direction, ranges, filters. */
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
      className={cn('flex gap-1 rounded-xl bg-raised p-1', className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
            value === option.value
              ? 'bg-surface text-ink shadow-sm'
              : 'text-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
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
      className="flex w-full items-center justify-between gap-4 text-left"
    >
      <span className="min-w-0">
        <span className="block text-sm text-ink">{label}</span>
        {hint ? <span className="block text-[12px] text-faint">{hint}</span> : null}
      </span>
      <span
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-line',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all',
            checked ? 'left-[18px]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}
