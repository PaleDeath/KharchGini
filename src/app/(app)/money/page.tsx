'use client';

import { CheckSquare, Download, Pencil, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  addMonthsToKey,
  currentMonth,
  endOfMonth,
  formatDay,
  formatMonthShort,
  startOfMonth,
  today as todayISO,
} from '@/domain/dates';
import { accountBalances, byId, entriesBetween, totalIn, totalOut } from '@/domain/derive';
import { formatAmount } from '@/domain/money';
import { ACCOUNT_TYPE_LABEL, isLiability, type Direction, type Entry } from '@/domain/types';
import { AccountSheet } from '@/components/account/account-sheet';
import { EntryRow } from '@/components/entry/entry-row';
import { EntrySheet } from '@/components/entry/entry-sheet';
import { Button } from '@/components/ui/button';
import { Card, Empty, Section } from '@/components/ui/card';
import { Input, Segmented } from '@/components/ui/input';
import { Money } from '@/components/ui/money';
import { useToast } from '@/components/ui/toast';
import { useLedger } from '@/lib/store';
import { cn, download, toCSV } from '@/lib/utils';

type Range = 'this' | 'last' | 'all';
type Filter = 'all' | Direction;

export default function MoneyPage() {
  const { ledger, deleteEntries, addEntries } = useLedger();
  const toast = useToast();

  const [editing, setEditing] = useState<Entry | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [addingAccount, setAddingAccount] = useState(false);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [range, setRange] = useState<Range>('this');
  const [filter, setFilter] = useState<Filter>('all');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const day = todayISO();
  const categories = useMemo(() => byId(ledger.categories), [ledger.categories]);
  const accounts = useMemo(() => byId(ledger.accounts), [ledger.accounts]);
  const balances = useMemo(
    () => accountBalances(ledger.accounts, ledger.entries),
    [ledger.accounts, ledger.entries],
  );

  const window = useMemo(() => {
    if (range === 'all') return ledger.entries;
    const month = range === 'this' ? currentMonth() : addMonthsToKey(currentMonth(), -1);
    return entriesBetween(ledger.entries, startOfMonth(month), endOfMonth(month));
  }, [ledger.entries, range]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return window.filter((entry) => {
      if (filter !== 'all' && entry.direction !== filter) return false;
      if (accountId && entry.accountId !== accountId && entry.counterAccountId !== accountId) {
        return false;
      }
      if (!needle) return true;

      const category = entry.categoryId ? categories.get(entry.categoryId) : undefined;
      const haystack = [
        entry.description,
        entry.merchant ?? '',
        entry.note ?? '',
        category?.name ?? '',
        entry.tags.join(' '),
        formatAmount(entry.amount),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [window, filter, accountId, query, categories]);

  const days = useMemo(() => {
    const grouped = new Map<string, Entry[]>();
    for (const entry of filtered) {
      const bucket = grouped.get(entry.date);
      if (bucket) bucket.push(entry);
      else grouped.set(entry.date, [entry]);
    }
    return [...grouped.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, rows]) => ({
        date,
        rows: rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        out: totalOut(rows),
      }));
  }, [filtered]);

  const moneyIn = totalIn(filtered);
  const moneyOut = totalOut(filtered);

  const exportCSV = () => {
    const rows = filtered.map((entry) => [
      entry.date,
      entry.direction,
      formatAmount(entry.amount),
      entry.description,
      entry.categoryId ? (categories.get(entry.categoryId)?.name ?? '') : '',
      accounts.get(entry.accountId)?.name ?? '',
      entry.counterAccountId ? (accounts.get(entry.counterAccountId)?.name ?? '') : '',
      entry.tags.join(' '),
      entry.note ?? '',
    ]);

    download(
      `kharchgini-${day}.csv`,
      toCSV(
        ['Date', 'Direction', 'Amount', 'Description', 'Category', 'Account', 'To', 'Tags', 'Note'],
        rows,
      ),
    );
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((e) => e.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const toRestore = ledger.entries
      .filter((e) => selectedIds.has(e.id))
      .map(({ id: _id, createdAt: _c, updatedAt: _u, ...draft }) => draft);

    try {
      await deleteEntries(ids);
      setSelectedIds(new Set());
      setSelectionMode(false);
      toast(
        `Deleted ${ids.length} ${ids.length === 1 ? 'entry' : 'entries'}.`,
        {
          tone: 'info',
          undo: () => addEntries(toRestore).then(() => undefined),
        },
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete entries', { tone: 'bad' });
    }
  };

  const editingAccount = editingAccountId ? (ledger.accounts.find((a) => a.id === editingAccountId) ?? null) : null;

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3 px-1">
        <h1 className="text-xl font-semibold tracking-tight">Money</h1>
        <div className="flex items-center gap-1.5">
          {selectionMode ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSelectAll}
                className="text-xs"
              >
                {selectedIds.size === filtered.length ? 'Deselect all' : 'Select all'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedIds(new Set());
                }}
                className="text-xs"
              >
                Done
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectionMode(true)}
                disabled={filtered.length === 0}
                className="text-xs gap-1"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Select
              </Button>
              <Button size="sm" variant="ghost" onClick={exportCSV} disabled={filtered.length === 0}>
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Balances first: this is where the money actually is. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar md:-mx-8 md:px-8">
        {ledger.accounts
          .filter((account) => !account.archived)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((account) => {
            const balance = balances.get(account.id) ?? 0;
            const owed = isLiability(account);
            const active = accountId === account.id;
            return (
              <div key={account.id} className="relative group shrink-0">
                <button
                  type="button"
                  onClick={() => setAccountId(active ? null : account.id)}
                  onDoubleClick={() => setEditingAccountId(account.id)}
                  className={cn(
                    'w-36 rounded-card border px-3.5 py-3 text-left transition-colors',
                    active ? 'border-accent bg-accent/8' : 'border-line bg-surface hover:bg-raised',
                  )}
                >
                  <p className="truncate text-[12px] text-faint pr-5">{account.name}</p>
                  <Money
                    value={owed ? Math.abs(balance) : balance}
                    className="mt-0.5 block text-[15px] font-semibold"
                    tone={balance < 0 && !owed ? 'bad' : 'plain'}
                  />
                  <p className="mt-0.5 truncate text-[11px] text-faint">
                    {owed ? 'owed' : ACCOUNT_TYPE_LABEL[account.type].toLowerCase()}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingAccountId(account.id);
                  }}
                  title="Edit account"
                  className="absolute top-2 right-2 rounded-md p-1 text-faint hover:text-ink hover:bg-raised transition-all md:opacity-0 md:group-hover:opacity-100"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            );
          })}

        <button
          type="button"
          onClick={() => setAddingAccount(true)}
          className="flex w-36 shrink-0 flex-col items-center justify-center gap-1 rounded-card border border-dashed border-line px-3.5 py-3 text-[12px] text-faint transition-colors hover:border-accent hover:text-accent"
        >
          <Plus className="h-4 w-4" />
          Add account
        </button>
      </div>

      {ledger.accounts.filter((a) => !a.archived).length > 0 ? (
        <p className="-mt-3 px-1 text-[11px] text-faint">
          Tap to filter, tap ✏️ or double-tap to edit.
          {accountId ? (
            <button
              type="button"
              className="ml-2 text-accent hover:underline"
              onClick={() => setAccountId(null)}
            >
              Clear filter
            </button>
          ) : null}
        </p>
      ) : null}

      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search description, tag, amount…"
              className="pl-9 pr-9 text-sm"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-faint hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            size="icon"
            className="h-11 w-11"
            onClick={() => setShowFilters((v) => !v)}
            aria-label="Filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {showFilters ? (
          <div className="space-y-2 rounded-card border border-line bg-surface p-3">
            <Segmented
              options={[
                { value: 'this', label: formatMonthShort(currentMonth()) },
                { value: 'last', label: formatMonthShort(addMonthsToKey(currentMonth(), -1)) },
                { value: 'all', label: 'All time' },
              ]}
              value={range}
              onChange={setRange}
            />
            <Segmented
              options={[
                { value: 'all', label: 'Everything' },
                { value: 'out', label: 'Out' },
                { value: 'in', label: 'In' },
                { value: 'transfer', label: 'Moves' },
              ]}
              value={filter}
              onChange={setFilter}
            />
          </div>
        ) : null}
      </div>

      <Card className="flex items-center justify-around px-4 py-3">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-wide text-faint">In</p>
          <Money value={moneyIn} className="text-sm font-semibold" tone="good" animate />
        </div>
        <div className="h-8 w-px bg-line" />
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-wide text-faint">Out</p>
          <Money value={moneyOut} className="text-sm font-semibold" tone="plain" animate />
        </div>
        <div className="h-8 w-px bg-line" />
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-wide text-faint">Net</p>
          <Money
            value={moneyIn - moneyOut}
            signed
            className="text-sm font-semibold"
            animate
          />
        </div>
      </Card>

      {days.length === 0 ? (
        <Card>
          <Empty
            icon={<Search className="h-6 w-6" />}
            title={query ? 'Nothing matches' : 'Nothing in this window'}
            hint={
              query
                ? 'Try fewer words, or widen the range in the filters.'
                : 'Change the range, or add something with the + button.'
            }
          />
        </Card>
      ) : (
        <Section>
          <div className="stagger space-y-3">
            {days.map((group) => (
              <div key={group.date}>
                <div className="flex items-baseline justify-between gap-3 px-1 pb-1">
                  <span className="text-[12px] font-medium text-muted">
                    {formatDay(group.date)}
                  </span>
                  {group.out > 0 ? (
                    <Money value={group.out} className="text-[12px] text-faint" tone="plain" />
                  ) : null}
                </div>
                <Card className="divide-y divide-line overflow-hidden">
                  {group.rows.map((entry) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      categories={categories}
                      accounts={accounts}
                      selectable={selectionMode}
                      selected={selectedIds.has(entry.id)}
                      onOpen={selectionMode ? () => toggleSelect(entry.id) : setEditing}
                    />
                  ))}
                </Card>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Floating Multi-Select Action Bar */}
      {selectionMode && selectedIds.size > 0 ? (
        <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl border border-line bg-surface/95 backdrop-blur-md px-4 py-2.5 shadow-2xl animate-pop-in">
          <span className="text-sm font-semibold text-ink whitespace-nowrap">
            {selectedIds.size} {selectedIds.size === 1 ? 'selected' : 'selected'}
          </span>
          <div className="h-4 w-px bg-line" />
          <Button
            variant="danger"
            size="sm"
            onClick={handleBulkDelete}
            className="gap-1.5 shadow-sm"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete ({selectedIds.size})
          </Button>
        </div>
      ) : null}

      <EntrySheet entry={editing} onClose={() => setEditing(null)} />
      <AccountSheet
        account={editingAccount}
        open={addingAccount || editingAccountId !== null}
        onClose={() => {
          setAddingAccount(false);
          setEditingAccountId(null);
        }}
      />
    </div>
  );
}
