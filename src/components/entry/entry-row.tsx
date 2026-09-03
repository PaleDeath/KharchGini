'use client';

import { ArrowRight, Check, Repeat } from 'lucide-react';
import { useMemo } from 'react';

import { formatDay } from '@/domain/dates';
import type { Account, Category, Entry } from '@/domain/types';
import { CategoryChip } from '@/components/category/category-icon';
import { Money } from '@/components/ui/money';
import { cn } from '@/lib/utils';

/**
 * One line of the ledger with high-contrast description and tabular money alignment.
 */
export function EntryRow({
  entry,
  categories,
  accounts,
  onOpen,
  showDate,
  selected,
  selectable,
}: {
  entry: Entry;
  categories: Map<string, Category>;
  accounts: Map<string, Account>;
  onOpen?: (entry: Entry) => void;
  showDate?: boolean;
  selected?: boolean;
  selectable?: boolean;
}) {
  const category = entry.categoryId ? categories.get(entry.categoryId) : undefined;
  const account = accounts.get(entry.accountId);
  const counter = entry.counterAccountId ? accounts.get(entry.counterAccountId) : undefined;
  const isTransfer = entry.direction === 'transfer';

  const context = useMemo(() => {
    const parts: string[] = [];
    if (showDate) parts.push(formatDay(entry.date));
    if (isTransfer) parts.push(`${account?.name ?? '—'} → ${counter?.name ?? '—'}`);
    else {
      parts.push(category?.name ?? 'Uncategorised');
      if (account) parts.push(account.name);
    }
    for (const tag of entry.tags) parts.push(`#${tag}`);
    return parts.join(' · ');
  }, [showDate, entry.date, entry.tags, isTransfer, account, counter, category]);

  const inner = (
    <>
      {selectable ? (
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition-all',
            selected
              ? 'border-accent bg-accent text-accent-ink shadow-xs'
              : 'border-line bg-surface hover:border-muted',
          )}
        >
          {selected ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : null}
        </span>
      ) : null}

      {isTransfer ? (
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-raised/80 text-muted shadow-2xs"
          aria-hidden
        >
          <ArrowRight className="h-4 w-4 stroke-[2]" />
        </span>
      ) : (
        <CategoryChip name={category?.icon} color={category?.color} />
      )}

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-bold text-ink">{entry.description}</span>
          {entry.source === 'recurring' ? (
            <Repeat className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="Recurring" />
          ) : null}
          {entry.reimbursable && !entry.settledAt ? (
            <span className="shrink-0 rounded-md bg-warn/15 border border-warn/30 px-1.5 text-[10px] font-black text-warn shadow-2xs">
              owed
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted font-medium">{context}</span>
      </span>

      <Money
        value={entry.amount}
        tone={entry.direction === 'in' ? 'good' : isTransfer ? 'muted' : 'plain'}
        className={cn('shrink-0 text-sm font-extrabold', entry.direction === 'in' && 'font-black')}
      />
    </>
  );

  const shared = cn(
    'flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-all duration-150',
    selected && 'bg-accent/10',
  );

  if (!onOpen) return <div className={shared}>{inner}</div>;

  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className={cn(shared, 'hover:bg-raised/60 active:bg-raised/80 active:scale-[0.99]')}
    >
      {inner}
    </button>
  );
}
