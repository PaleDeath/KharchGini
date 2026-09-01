'use client';

import type { ReactNode } from 'react';

import { formatCompact, formatMoney, formatSigned, type Paise } from '@/domain/money';
import { useCountUp } from '@/lib/use-count-up';
import { cn } from '@/lib/utils';

/**
 * Every amount on screen goes through here.
 *
 *  1. The `money` class, which privacy mode blurs.
 *  2. Tabular figures with JetBrains Mono, lining up on decimals with high contrast.
 */
export function Money({
  value,
  signed,
  compact,
  tone = 'auto',
  className,
  title,
  animate,
}: {
  value: Paise;
  /** Show an explicit + or −. For deltas, never for balances. */
  signed?: boolean;
  compact?: boolean;
  /** `auto` colours by sign; `plain` never colours. */
  tone?: 'auto' | 'plain' | 'good' | 'bad' | 'muted';
  className?: string;
  title?: string;
  animate?: boolean;
}) {
  const counted = useCountUp(value, animate === true);
  const display = animate ? counted : value;

  const text = compact
    ? formatCompact(display)
    : signed
      ? formatSigned(display)
      : formatMoney(display);

  const colour =
    tone === 'auto'
      ? value > 0 && signed
        ? 'text-good'
        : value < 0
          ? 'text-bad'
          : undefined
      : tone === 'good'
        ? 'text-good'
        : tone === 'bad'
          ? 'text-bad'
          : tone === 'muted'
            ? 'text-muted'
            : undefined;

  return (
    <span
      className={cn('money tnum inline-block', colour, className)}
      title={title ?? (compact ? formatMoney(value) : undefined)}
    >
      {text}
    </span>
  );
}

/**
 * A progress bar that can exceed 100% with smooth gradient fills.
 */
export function Bar({
  value,
  max,
  tone,
  className,
}: {
  value: number;
  max: number;
  tone?: 'good' | 'warn' | 'bad' | 'accent';
  className?: string;
}) {
  const ratio = max > 0 ? value / max : 0;
  const filled = Math.min(100, Math.max(0, ratio * 100));
  const over = ratio > 1;

  const colour =
    tone === 'bad' || over
      ? 'bg-gradient-to-r from-bad to-red-600'
      : tone === 'warn'
        ? 'bg-gradient-to-r from-warn to-amber-500'
        : tone === 'good'
          ? 'bg-gradient-to-r from-good to-emerald-500'
          : 'bg-gradient-to-r from-accent to-emerald-500';

  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-raised border border-line/60', className)}
      role="progressbar"
      aria-valuenow={Math.round(filled)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-300 ease-out', colour)}
        style={{ width: `${filled}%` }}
      />
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent';
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-raised/90 text-muted border-line/80',
    good: 'bg-good/15 text-good border-good/30',
    warn: 'bg-warn/15 text-warn border-warn/30',
    bad: 'bg-bad/15 text-bad border-bad/30',
    accent: 'bg-accent/15 text-accent border-accent/30',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-bold tracking-tight shadow-2xs',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
