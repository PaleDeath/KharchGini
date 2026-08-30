'use client';

import type { ReactNode } from 'react';

import { formatCompact, formatMoney, formatSigned, type Paise } from '@/domain/money';
import { useCountUp } from '@/lib/use-count-up';
import { cn } from '@/lib/utils';

/**
 * Every amount on screen goes through here.
 *
 * Two things this buys, neither of which is cosmetic:
 *
 *  1. The `money` class, which privacy mode blurs. One switch hides every figure
 *     in the app without a single screen knowing privacy mode exists.
 *  2. Tabular figures, so a column of amounts lines up on the decimal instead of
 *     shimmering as the digits change.
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
  /**
   * Count to the new figure rather than swapping to it. Reserve this for the
   * few numbers a user actually watches — the hero, a balance — because a
   * screen where everything is in motion is a screen where nothing is.
   */
  animate?: boolean;
}) {
  // The hook is called unconditionally, as hooks must be, and does nothing at
  // all when `animate` is absent.
  const counted = useCountUp(value, animate === true);
  const display = animate ? counted : value;

  const text = compact
    ? formatCompact(display)
    : signed
      ? formatSigned(display)
      : formatMoney(display);

  // Colour follows the real value, never the one mid-flight: a figure crossing
  // zero on its way down should not flicker red and back again.
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
      className={cn('money tnum', colour, className)}
      // The exact figure is always one hover away from a compact one.
      title={title ?? (compact ? formatMoney(value) : undefined)}
    >
      {text}
    </span>
  );
}

/**
 * A progress bar that can exceed 100%. Overspending is a fact; a bar that
 * silently stops at full hides the one thing worth seeing.
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
      ? 'bg-bad'
      : tone === 'warn'
        ? 'bg-warn'
        : tone === 'good'
          ? 'bg-good'
          : 'bg-accent';

  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-line', className)}
      role="progressbar"
      aria-valuenow={Math.round(filled)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', colour)}
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
    neutral: 'bg-raised text-muted',
    good: 'bg-good/12 text-good',
    warn: 'bg-warn/12 text-warn',
    bad: 'bg-bad/12 text-bad',
    accent: 'bg-accent/12 text-accent',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
