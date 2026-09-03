'use client';

import {
  Check,
  CheckSquare,
  CreditCard,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  addMonthsToKey,
  currentMonth,
  endOfMonth,
  formatDay,
  formatMonthShort,
  monthOf,
  startOfMonth,
  today as todayISO,
} from '@/domain/dates';
import { accountBalances, byId, entriesBetween, totalIn, totalOut } from '@/domain/derive';
import { formatAmount, formatMoney } from '@/domain/money';
import { ACCOUNT_TYPE_LABEL, isLiability, type Direction, type Entry } from '@/domain/types';
import { getAccountBadgeColor, getAccountIcon } from '@/components/account/account-picker-modal';
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

  const day = todayISO();
  const categories = useMemo(() => byId(ledger.categories), [ledger.categories]);
  const accounts = useMemo(() => byId(ledger.accounts), [ledger.accounts]);
  const balances = useMemo(
    () => accountBalances(ledger.accounts, ledger.entries),
    [ledger.accounts, ledger.entries],
  );

  const creditCards = useMemo(
    () => ledger.accounts.filter((a) => a.type === 'card' && !a.archived),
    [ledger.accounts],
  );

  const liquidAccounts = useMemo(
    () => ledger.accounts.filter((a) => a.type !== 'card' && !a.archived),
    [ledger.accounts],
  );

  // Credit Card Metrics
  const totalCardDebt = useMemo(() => {
    return creditCards.reduce((acc, card) => {
      const bal = balances.get(card.id) ?? 0;
      return acc + (bal < 0 ? Math.abs(bal) : 0);
    }, 0);
  }, [creditCards, balances]);

  const totalCreditLimit = useMemo(() => {
    return creditCards.reduce((acc, card) => acc + (card.creditLimit ?? 0), 0);
  }, [creditCards]);

  const creditUtilization = useMemo(() => {
    if (totalCreditLimit <= 0) return 0;
    return Math.min(100, Math.round((totalCardDebt / totalCreditLimit) * 100));
  }, [totalCardDebt, totalCreditLimit]);

  const cardSpendsThisMonth = useMemo(() => {
    const cardIds = new Set(creditCards.map((c) => c.id));
    const thisMonth = currentMonth();
    return ledger.entries
      .filter(
        (e) =>
          monthOf(e.date) === thisMonth &&
          cardIds.has(e.accountId) &&
          e.direction === 'out',
      )
      .reduce((sum, e) => sum + e.amount, 0);
  }, [creditCards, ledger.entries]);

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
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3 px-1">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Money & Accounts</h1>
          <p className="text-xs text-muted">
            {ledger.accounts.filter((a) => !a.archived).length} accounts · {filtered.length} entries
          </p>
        </div>
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

      {/* Balances Carousel */}
      <div className="-mx-4 flex gap-3.5 overflow-x-auto px-4 pb-2 no-scrollbar sm:-mx-6 sm:px-6 md:-mx-8 md:px-8">
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
                    'w-48 rounded-3xl border p-4.5 text-left transition-all duration-150 active:scale-[0.97] shadow-card',
                    active
                      ? 'border-accent bg-accent/12 ring-2 ring-accent/35 shadow-elevated'
                      : 'border-line bg-surface/95 hover:border-accent/40 hover:bg-raised/60',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border shadow-2xs',
                        getAccountBadgeColor(account.type),
                      )}
                    >
                      {getAccountIcon(account.type)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingAccountId(account.id);
                      }}
                      title="Edit account"
                      className="rounded-xl p-1.5 text-muted hover:text-ink hover:bg-raised transition-all active:scale-95"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-3.5 truncate text-sm font-bold text-ink">{account.name}</p>
                  <Money
                    value={owed ? Math.abs(balance) : balance}
                    className="mt-0.5 block text-xl font-black text-ink"
                    tone={balance < 0 && !owed ? 'bad' : 'plain'}
                  />
                  <p className="mt-0.5 truncate text-[10px] uppercase font-black tracking-wider text-muted">
                    {owed ? 'owed balance' : ACCOUNT_TYPE_LABEL[account.type]}
                  </p>
                </button>
              </div>
            );
          })}

        <button
          type="button"
          onClick={() => setAddingAccount(true)}
          className="flex w-40 shrink-0 flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-line bg-raised/40 p-4 text-xs font-bold text-muted transition-all hover:border-accent hover:text-accent hover:bg-accent/5 active:scale-95 shadow-2xs"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface border border-line text-muted shadow-2xs">
            <Plus className="h-4 w-4 stroke-[2.5]" />
          </span>
          Add account
        </button>
      </div>

      {accountId ? (
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-muted">Filtered by:</span>
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/15 px-3 py-1 text-xs font-bold text-accent shadow-2xs">
            {accounts.get(accountId)?.name}
            <button
              type="button"
              onClick={() => setAccountId(null)}
              className="hover:text-ink"
              title="Clear account filter"
            >
              <X className="h-3 w-3 stroke-[2.5]" />
            </button>
          </span>
        </div>
      ) : null}

      {/* Credit Cards & Spends Manager */}
      {creditCards.length > 0 ? (
        <div className="rounded-3xl border border-line bg-gradient-to-br from-surface via-surface to-raised/90 p-5 shadow-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-500 shadow-2xs">
                <CreditCard className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-extrabold tracking-tight text-ink">
                  Credit Cards & Spends
                </h2>
                <p className="text-[11px] text-faint">Track statement limits & bill settlements</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-raised/80 border border-line/60 px-3 py-1 text-xs">
              <span className="text-faint">Monthly Card Spends:</span>
              <Money value={cardSpendsThisMonth} tone="plain" className="font-extrabold text-ink" />
            </div>
          </div>

          {/* Utilization Header Banner */}
          {totalCreditLimit > 0 ? (
            <div className="rounded-2xl border border-line/70 bg-surface/80 p-3.5 space-y-2 shadow-inner">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink">Overall Credit Utilization</span>
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider',
                      creditUtilization <= 30
                        ? 'bg-good/15 text-good'
                        : creditUtilization <= 50
                        ? 'bg-warn/15 text-warn'
                        : 'bg-bad/15 text-bad',
                    )}
                  >
                    {creditUtilization}% · {creditUtilization <= 30 ? 'Healthy (<30%)' : creditUtilization <= 50 ? 'Moderate' : 'High'}
                  </span>
                </div>
                <span className="text-faint font-medium">
                  <Money value={totalCardDebt} tone="plain" className="font-bold text-ink" /> / <Money value={totalCreditLimit} tone="plain" />
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-raised">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    creditUtilization <= 30
                      ? 'bg-gradient-to-r from-good to-emerald-400'
                      : creditUtilization <= 50
                      ? 'bg-gradient-to-r from-warn to-amber-400'
                      : 'bg-gradient-to-r from-bad to-red-500',
                  )}
                  style={{ width: `${Math.min(100, creditUtilization)}%` }}
                />
              </div>
            </div>
          ) : null}

          {/* Credit Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {creditCards.map((card) => {
              const bal = balances.get(card.id) ?? 0;
              const owed = bal < 0 ? Math.abs(bal) : 0;
              const limit = card.creditLimit ?? 0;
              const available = limit > 0 ? Math.max(0, limit - owed) : 0;
              const cardUtil = limit > 0 ? Math.min(100, Math.round((owed / limit) * 100)) : 0;
              const active = accountId === card.id;

              return (
                <div
                  key={card.id}
                  className={cn(
                    'relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200 shadow-2xs',
                    active
                      ? 'border-accent bg-accent/15 ring-2 ring-accent/30'
                      : 'border-line bg-surface/95 hover:border-accent/40 hover:bg-raised/60',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink">{card.name}</span>
                        {card.last4 ? (
                          <span className="rounded-md bg-raised px-1.5 py-0.5 text-[10px] font-mono font-bold text-faint">
                            •••• {card.last4}
                          </span>
                        ) : null}
                      </div>
                      {card.billingDueDay ? (
                        <p className="text-[11px] text-faint mt-0.5">
                          Bill Due: {card.billingDueDay}th of every month
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => setEditingAccountId(card.id)}
                      className="rounded-lg p-1 text-faint hover:text-ink hover:bg-raised transition-colors"
                      title="Edit Card"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-faint uppercase tracking-wider">Current Owed</span>
                      <Money
                        value={owed}
                        className={cn('text-xl font-black', owed > 0 ? 'text-bad' : 'text-good')}
                        tone="plain"
                      />
                    </div>

                    {limit > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-faint">
                          <span>Avail: {formatMoney(available)}</span>
                          <span>Limit: {formatMoney(limit)}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              cardUtil <= 30 ? 'bg-good' : cardUtil <= 50 ? 'bg-warn' : 'bg-bad',
                            )}
                            style={{ width: `${cardUtil}%` }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex items-center gap-2 pt-3 border-t border-line/70">
                    <button
                      type="button"
                      onClick={() => setAccountId(active ? null : card.id)}
                      className={cn(
                        'flex-1 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all text-center',
                        active
                          ? 'border-accent bg-accent text-accent-ink shadow-xs'
                          : 'border-line bg-raised/80 text-muted hover:text-ink hover:bg-raised',
                      )}
                    >
                      {active ? 'Viewing Spends' : 'Filter Card Spends'}
                    </button>

                    {owed > 0 ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const primaryBank =
                            liquidAccounts.find((a) => a.type === 'bank') ??
                            liquidAccounts[0];
                          if (!primaryBank) {
                            toast(
                              'Add a bank account first to record bill payment transfer.',
                              { tone: 'bad' },
                            );
                            return;
                          }
                          try {
                            await addEntries([
                              {
                                date: day,
                                amount: owed,
                                direction: 'transfer',
                                accountId: primaryBank.id,
                                counterAccountId: card.id,
                                description: `Pay ${card.name} Bill`,
                                tags: ['bill-payment', 'credit-card'],
                                source: 'manual',
                              },
                            ]);
                            toast(
                              `Recorded bill payment of ${formatMoney(owed)} for ${card.name}.`,
                              { tone: 'good' },
                            );
                          } catch (err) {
                            toast(
                              err instanceof Error
                                ? err.message
                                : 'Could not record payment',
                              { tone: 'bad' },
                            );
                          }
                        }}
                        className="rounded-xl border border-good/40 bg-good/15 hover:bg-good/25 text-good px-3 py-1.5 text-xs font-bold transition-all active:scale-95 flex items-center gap-1 shadow-2xs"
                      >
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                        Pay Bill
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Filter and Search Controls */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search description, tag, merchant, amount…"
            className="pl-11 pr-10 text-sm rounded-2xl bg-surface/95"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-faint hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Segmented
              options={[
                { value: 'this', label: `${formatMonthShort(currentMonth())} (Current)` },
                { value: 'last', label: `${formatMonthShort(addMonthsToKey(currentMonth(), -1))} (Last)` },
                { value: 'all', label: 'All time' },
              ]}
              value={range}
              onChange={setRange}
            />
          </div>
          <div className="flex-1">
            <Segmented
              options={[
                { value: 'all', label: 'All' },
                { value: 'out', label: 'Spends' },
                { value: 'in', label: 'Income' },
                { value: 'transfer', label: 'Moves' },
              ]}
              value={filter}
              onChange={setFilter}
            />
          </div>
        </div>
      </div>

      {/* Income / Out / Net Overview Strip */}
      <Card className="flex items-center justify-around px-6 py-4 rounded-3xl border border-line bg-surface/95 shadow-card">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-wider text-muted font-black">Money In</p>
          <Money value={moneyIn} className="text-lg sm:text-xl font-black mt-0.5" tone="good" animate />
        </div>
        <div className="h-9 w-px bg-line/80" />
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-wider text-muted font-black">Money Out</p>
          <Money value={moneyOut} className="text-lg sm:text-xl font-black text-ink mt-0.5" tone="plain" animate />
        </div>
        <div className="h-9 w-px bg-line/80" />
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-wider text-muted font-black">Net Cash Flow</p>
          <Money
            value={moneyIn - moneyOut}
            signed
            className="text-lg sm:text-xl font-black mt-0.5"
            animate
          />
        </div>
      </Card>

      {/* Transactions List */}
      {days.length === 0 ? (
        <Card className="p-8 text-center space-y-4 rounded-3xl shadow-card">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-raised border border-line text-faint shadow-2xs">
            <Search className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-ink">
              {query
                ? 'No transactions match your search'
                : range === 'this'
                ? `No transactions in ${formatMonthShort(currentMonth())} yet`
                : 'No transactions in this window'}
            </h3>
            <p className="text-xs text-muted max-w-sm mx-auto mt-1 leading-relaxed">
              {query
                ? 'Try a different search term or reset your account and direction filters.'
                : 'Adjust your time range or tap "+ Quick Add" to log your first spend.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setRange('all');
                setFilter('all');
                setAccountId(null);
                setQuery('');
              }}
              className="text-xs rounded-xl font-bold"
            >
              Reset All Filters
            </Button>
          </div>
        </Card>
      ) : (
        <Section>
          <div className="stagger space-y-4">
            {days.map((group) => (
              <div key={group.date}>
                <div className="flex items-baseline justify-between gap-3 px-1 pb-1.5">
                  <span className="text-xs font-bold text-muted uppercase tracking-wider">
                    {formatDay(group.date)}
                  </span>
                  {group.out > 0 ? (
                    <span className="text-xs font-medium text-faint">
                      Day total: <Money value={group.out} tone="plain" className="font-bold text-ink" />
                    </span>
                  ) : null}
                </div>
                <Card className="divide-y divide-line overflow-hidden shadow-card">
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
        <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3.5 rounded-2xl border border-line bg-surface/95 backdrop-blur-xl px-4 py-2.5 shadow-2xl animate-pop-in">
          <span className="text-sm font-bold text-ink whitespace-nowrap">
            {selectedIds.size} {selectedIds.size === 1 ? 'selected' : 'selected'}
          </span>
          <div className="h-4 w-px bg-line" />
          <Button
            variant="danger"
            size="sm"
            onClick={handleBulkDelete}
            className="gap-1.5 shadow-sm font-bold"
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
