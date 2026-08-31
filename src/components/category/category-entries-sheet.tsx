'use client';

import { useMemo, useState } from 'react';
import { Layers, Plus } from 'lucide-react';

import {
  endOfMonth,
  formatMonth,
  monthOf,
  startOfMonth,
  today as todayISO,
  type ISODate,
  type MonthKey,
} from '@/domain/dates';
import { byId, categoryFamily, entriesBetween, envelopeStatus, totalOut } from '@/domain/derive';
import type { Entry } from '@/domain/types';
import { CategoryIcon } from '@/components/category/category-icon';
import { EntryRow } from '@/components/entry/entry-row';
import { EntrySheet } from '@/components/entry/entry-sheet';
import { Button } from '@/components/ui/button';
import { Card, Empty } from '@/components/ui/card';
import { Bar, Money } from '@/components/ui/money';
import { Sheet } from '@/components/ui/sheet';
import { useLedger } from '@/lib/store';

export function CategoryEntriesSheet({
  categoryId,
  month,
  from,
  to,
  open,
  onClose,
  onAddEntry,
}: {
  categoryId: string | null;
  month?: MonthKey;
  from?: ISODate;
  to?: ISODate;
  open: boolean;
  onClose: () => void;
  onAddEntry?: () => void;
}) {
  const { ledger } = useLedger();
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);

  const categories = useMemo(() => byId(ledger.categories), [ledger.categories]);
  const accounts = useMemo(() => byId(ledger.accounts), [ledger.accounts]);

  const activeCategory = categoryId ? categories.get(categoryId) : undefined;
  const isUncategorised = categoryId === null || categoryId === 'none' || categoryId === '';

  const activeMonth = month ?? monthOf(todayISO());
  const rangeFrom = from ?? startOfMonth(activeMonth);
  const rangeTo = to ?? endOfMonth(activeMonth);

  const family = useMemo(() => {
    if (!categoryId || isUncategorised) return null;
    return categoryFamily(categoryId, ledger.categories);
  }, [categoryId, isUncategorised, ledger.categories]);

  const matchingEntries = useMemo(() => {
    const window = entriesBetween(ledger.entries, rangeFrom, rangeTo);
    return window
      .filter((e) => {
        if (isUncategorised) return !e.categoryId && e.direction === 'out';
        if (!family) return false;
        return e.categoryId && family.has(e.categoryId) && e.direction === 'out';
      })
      .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
  }, [ledger.entries, rangeFrom, rangeTo, isUncategorised, family]);

  const totalSpent = useMemo(() => totalOut(matchingEntries), [matchingEntries]);

  // Envelope for this category and month (if budgeted)
  const envelope = useMemo(() => {
    if (!categoryId || isUncategorised) return undefined;
    const found = ledger.envelopes.find((e) => e.month === activeMonth && e.categoryId === categoryId);
    return found ? envelopeStatus(ledger, found) : undefined;
  }, [ledger, categoryId, isUncategorised, activeMonth]);

  const title = isUncategorised
    ? 'Uncategorised Spending'
    : activeCategory?.name ?? 'Category Spending';

  const subtitle = month ? formatMonth(activeMonth) : `${rangeFrom} to ${rangeTo}`;

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        title={title}
        description={subtitle}
        wide
        footer={
          onAddEntry ? (
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                onAddEntry();
              }}
              className="w-full gap-2"
            >
              <Plus className="h-4 w-4" /> Add entry in {title}
            </Button>
          ) : undefined
        }
      >
        <div className="space-y-4">
          {/* Header Metric Card */}
          <Card className="p-4 bg-gradient-to-br from-surface to-raised">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {isUncategorised ? (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-warn/15 text-warn">
                    <Layers className="h-5 w-5" />
                  </span>
                ) : (
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: `${activeCategory?.color ?? '#6366f1'}1f` }}
                  >
                    <CategoryIcon
                      name={activeCategory?.icon}
                      color={activeCategory?.color}
                      className="h-5 w-5"
                    />
                  </span>
                )}
                <div>
                  <p className="text-[12px] font-medium text-muted">Total Spent</p>
                  <Money
                    value={totalSpent}
                    className="text-2xl font-bold text-ink"
                    tone="plain"
                  />
                </div>
              </div>

              <div className="text-right">
                <p className="text-[12px] text-faint">Transactions</p>
                <p className="text-lg font-semibold tnum text-ink">{matchingEntries.length}</p>
              </div>
            </div>

            {/* Budget status if envelope exists */}
            {envelope ? (
              <div className="mt-3.5 pt-3 border-t border-line space-y-1.5">
                <div className="flex items-baseline justify-between text-[12px]">
                  <span className="text-muted">
                    Budget: <Money value={envelope.available} tone="plain" className="font-medium" />
                  </span>
                  <span className={envelope.remaining < 0 ? 'text-bad font-medium' : 'text-muted'}>
                    {envelope.remaining < 0 ? (
                      <>Over by <Money value={Math.abs(envelope.remaining)} tone="bad" /></>
                    ) : (
                      <><Money value={envelope.remaining} tone="good" /> remaining</>
                    )}
                  </span>
                </div>
                <Bar
                  value={envelope.spent}
                  max={envelope.available}
                  tone={envelope.remaining < 0 ? 'bad' : envelope.paceAhead ? 'warn' : 'good'}
                />
              </div>
            ) : null}
          </Card>

          {/* Entries list */}
          <div className="space-y-2">
            <h3 className="px-1 text-[12px] font-semibold uppercase tracking-wider text-faint">
              Entries ({matchingEntries.length})
            </h3>

            {matchingEntries.length === 0 ? (
              <Card>
                <Empty
                  title="No entries found"
                  hint={`No spending recorded under ${title} in this time window.`}
                />
              </Card>
            ) : (
              <Card className="stagger divide-y divide-line overflow-hidden">
                {matchingEntries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    categories={categories}
                    accounts={accounts}
                    onOpen={setEditingEntry}
                    showDate
                  />
                ))}
              </Card>
            )}
          </div>
        </div>
      </Sheet>

      {/* Direct Edit from Drilldown */}
      <EntrySheet entry={editingEntry} onClose={() => setEditingEntry(null)} />
    </>
  );
}
