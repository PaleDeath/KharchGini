'use client';

import {
  ArrowRight,
  CornerDownLeft,
  Loader2,
  Sparkles,
  TriangleAlert,
  Wand2,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CATEGORY_SOURCE_LABEL } from '@/domain/categorize';
import { formatDayFull, formatRelativeDay, today as todayISO } from '@/domain/dates';
import {
  byId,
  canAfford,
  categoryFamily,
  entriesBetween,
  spendByCategory,
  totalOut,
} from '@/domain/derive';
import { formatMoney } from '@/domain/money';
import {
  COMMAND_EXAMPLES,
  QUICK_PRESETS,
  parseCommand,
  type ParsedEntry,
  type ParsedQuery,
  type ParseResult,
} from '@/domain/parse';
import type { Account, Category, Direction, EntryDraft } from '@/domain/types';
import { useLedger } from '@/lib/store';
import { cn } from '@/lib/utils';
import { AccountPicker } from '@/components/account/account-picker-modal';
import { CategoryIcon } from '@/components/category/category-icon';
import { CategoryPicker } from '@/components/category/category-picker-modal';
import { Button } from '@/components/ui/button';
import { Input, Segmented } from '@/components/ui/input';
import { Money, Badge } from '@/components/ui/money';
import { QuickDatePicker } from '@/components/ui/quick-date-picker';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: 'out', label: 'Out' },
  { value: 'in', label: 'In' },
  { value: 'transfer', label: 'Transfer' },
];

/**
 * One input for everything: natural language, quick presets & bank SMS parse.
 */
export function CommandBar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { ledger, addEntry, deleteEntry, learnMerchant } = useLedger();
  const toast = useToast();

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [overrides, setOverrides] = useState<Partial<ParsedEntry>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const liveAccounts = useMemo(
    () => ledger.accounts.filter((a) => !a.archived),
    [ledger.accounts],
  );
  const liveCategories = useMemo(
    () => ledger.categories.filter((c) => !c.archived),
    [ledger.categories],
  );

  const defaultAccountId = liveAccounts[0]?.id ?? '';

  const result = useMemo<ParseResult>(
    () =>
      parseCommand(text, {
        accounts: ledger.accounts,
        defaultAccountId,
        rules: ledger.rules,
        merchants: ledger.merchants,
        categories: ledger.categories,
      }),
    [text, ledger.accounts, ledger.rules, ledger.merchants, ledger.categories, defaultAccountId],
  );

  useEffect(() => {
    if (!open) {
      setText('');
      setOverrides({});
      setBusy(false);
    }
  }, [open]);

  const entry: ParsedEntry | null =
    result.kind === 'entry' ? { ...result.entry, ...overrides } : null;

  const save = useCallback(async () => {
    if (!entry || busy) return;
    if (!entry.accountId) {
      toast('Add an account first, over in Money.', { tone: 'bad' });
      return;
    }
    if (entry.direction === 'transfer' && !entry.counterAccountId) {
      toast('A transfer needs somewhere to go.', { tone: 'bad' });
      return;
    }

    setBusy(true);
    try {
      const draft: EntryDraft = {
        date: entry.date,
        amount: entry.amount,
        direction: entry.direction,
        accountId: entry.accountId,
        description: entry.description,
        tags: entry.tags,
        source: 'manual',
        ...(entry.direction === 'transfer' && entry.counterAccountId
          ? { counterAccountId: entry.counterAccountId }
          : {}),
        ...(entry.direction !== 'transfer' && entry.categoryId
          ? { categoryId: entry.categoryId }
          : {}),
        ...(entry.merchant ? { merchant: entry.merchant } : {}),
        ...(entry.note ? { note: entry.note } : {}),
      };

      const id = await addEntry(draft);

      // Learn merchant memory when user manually set or confirmed a category
      if (entry.direction !== 'transfer' && entry.categoryId) {
        const merchantToLearn = entry.merchant || entry.description.trim().toLowerCase();
        if (merchantToLearn) {
          void learnMerchant(merchantToLearn, entry.categoryId);
        }
      }

      toast(`${formatMoney(entry.amount)} · ${entry.description}`, {
        tone: 'good',
        undo: () => deleteEntry(id),
      });

      setText('');
      setOverrides({});
      inputRef.current?.focus();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not save.', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  }, [entry, busy, addEntry, deleteEntry, learnMerchant, toast]);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Quick Add & Smart Paste"
      description="Type naturally or paste any UPI/bank debit SMS."
      wide
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 font-bold">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={save}
            disabled={!entry || busy}
            className="flex-[2] font-extrabold gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {entry ? `Save ${formatMoney(entry.amount)}` : 'Save'}
            <CornerDownLeft className="h-3.5 w-3.5 opacity-70" />
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void save();
            }
          }}
          placeholder="e.g. 280 chai or paste bank SMS"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 text-base font-medium rounded-2xl"
        />

        {/* Quick Presets Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar select-none">
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset.command}
              type="button"
              onClick={() => {
                setText(preset.command);
                setOverrides({});
                inputRef.current?.focus();
              }}
              className="flex items-center gap-1.5 shrink-0 rounded-2xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-ink hover:border-accent/50 hover:bg-raised shadow-2xs transition-all active:scale-95"
            >
              <CategoryIcon
                name={preset.iconName}
                color={preset.iconColor}
                className="h-3.5 w-3.5"
              />
              <span>{preset.name}</span>
            </button>
          ))}
        </div>

        {result.kind === 'empty' ? (
          <Examples
            onPick={(val) => {
              setText(val);
              setOverrides({});
            }}
          />
        ) : null}

        {result.kind === 'error' ? (
          <p className="flex items-start gap-2 rounded-2xl border border-warn/30 bg-warn/10 p-3 text-xs font-medium text-ink">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
            {result.message}
          </p>
        ) : null}

        {result.kind === 'query' ? <Answer query={result.query} /> : null}

        {entry ? (
          <Preview
            entry={entry}
            accounts={liveAccounts}
            categories={liveCategories}
            onChange={(changes) => setOverrides((current) => ({ ...current, ...changes }))}
          />
        ) : null}
      </div>
    </Sheet>
  );
}

function Examples({ onPick }: { onPick: (value: string) => void }) {
  return (
    <div className="space-y-2.5 pt-1">
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-faint">
          Natural Language & SMS
        </p>
        <span className="text-xs text-accent font-bold flex items-center gap-1">
          <Zap className="h-3 w-3" />
          Instant Parser
        </span>
      </div>

      <div className="rounded-2xl border border-line/70 bg-raised/50 p-3 text-xs text-muted space-y-1">
        <p className="font-bold text-ink flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-accent" /> Smart Paste Supported
        </p>
        <p className="text-faint leading-relaxed text-[11px]">
          Copy any UPI or Bank debit SMS from your phone and paste it directly above. KharchGini extracts the amount, merchant, and bank account automatically.
        </p>
      </div>

      <div className="space-y-1">
        {COMMAND_EXAMPLES.map((example) => (
          <button
            key={example.input}
            type="button"
            onClick={() => onPick(example.input)}
            className="flex w-full items-baseline gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-raised/70 active:scale-[0.99]"
          >
            <code className="shrink-0 text-xs font-bold text-ink font-mono">{example.input}</code>
            <span className="min-w-0 flex-1 truncate text-xs text-faint">{example.means}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Preview({
  entry,
  accounts,
  categories,
  onChange,
}: {
  entry: ParsedEntry;
  accounts: Account[];
  categories: Category[];
  onChange: (changes: Partial<ParsedEntry>) => void;
}) {
  const isTransfer = entry.direction === 'transfer';
  const isSMS = entry.note?.includes('Ref') || entry.note?.includes('Card');

  return (
    <div className="space-y-4 rounded-3xl border border-line bg-surface/95 p-4 sm:p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-extrabold text-ink">{entry.description}</p>
            {isSMS ? (
              <Badge tone="good" className="text-[10px] py-0.5 px-2 font-bold">
                Bank SMS
              </Badge>
            ) : null}
          </div>
          {entry.note ? (
            <p className="text-xs text-faint truncate mt-0.5">{entry.note}</p>
          ) : null}
        </div>
        <Money
          value={entry.amount}
          className="shrink-0 text-2xl font-black"
          tone={entry.direction === 'in' ? 'good' : 'plain'}
        />
      </div>

      <Segmented
        options={DIRECTIONS}
        value={entry.direction}
        onChange={(direction) => {
          let nextCategory = entry.categoryId;
          if (nextCategory) {
            const currentCat = categories.find((c) => c.id === nextCategory);
            if (direction === 'in' && currentCat && currentCat.kind !== 'income') {
              nextCategory = undefined;
            } else if (direction === 'out' && currentCat && currentCat.kind === 'income') {
              nextCategory = undefined;
            }
          }
          onChange({ direction, categoryId: nextCategory });
        }}
      />

      <div className="space-y-3">
        <div>
          <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-muted">
            Date
          </span>
          <QuickDatePicker
            value={entry.date}
            onChange={(date) => onChange({ date })}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-muted">
              {isTransfer ? 'From' : 'Account'}
            </span>
            <AccountPicker
              value={entry.accountId}
              onChange={(accountId) => onChange({ accountId })}
              accounts={accounts}
            />
          </div>

          <div>
            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-muted">
              {isTransfer ? 'To' : 'Category'}
            </span>
            {isTransfer ? (
              <AccountPicker
                value={entry.counterAccountId ?? ''}
                onChange={(counterAccountId) => onChange({ counterAccountId })}
                accounts={accounts.filter((a) => a.id !== entry.accountId)}
                placeholder="Choose account…"
              />
            ) : (
              <CategoryPicker
                value={entry.categoryId ?? ''}
                onChange={(categoryId) => onChange({ categoryId: categoryId || undefined })}
                categories={categories.filter((category) => {
                  if (entry.direction === 'in') {
                    return category.kind === 'income' || category.id === entry.categoryId;
                  }
                  return category.kind !== 'income' || category.id === entry.categoryId;
                })}
                allowClear
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted pt-2.5 border-t border-line/60 font-semibold">
        <span className="inline-flex items-center gap-1 text-ink">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          {formatRelativeDay(entry.date)} · {formatDayFull(entry.date)}
        </span>
        {!isTransfer && entry.categorySource !== 'none' ? (
          <span className="inline-flex items-center gap-1 text-accent font-bold">
            <Wand2 className="h-3.5 w-3.5 text-accent" />
            {CATEGORY_SOURCE_LABEL[entry.categorySource]}
          </span>
        ) : null}
        {entry.tags.map((tag) => (
          <span key={tag} className="rounded-md bg-raised border border-line px-1.5 py-0.5 text-ink font-bold">
            #{tag}
          </span>
        ))}
        {entry.note ? <span className="italic text-muted">“{entry.note}”</span> : null}
      </div>
    </div>
  );
}

function Answer({ query }: { query: ParsedQuery }) {
  const { ledger } = useLedger();

  if (query.kind === 'afford') {
    if (query.affordAmount === undefined) {
      return (
        <p className="rounded-2xl bg-raised p-3 text-xs text-muted">
          How much? Try “?can i afford 15000”.
        </p>
      );
    }

    const { yes, after, sts } = canAfford(ledger, query.affordAmount);
    return (
      <div className="space-y-2 rounded-2xl border border-line bg-raised/70 p-4 shadow-card">
        <p className={cn('text-lg font-extrabold', yes ? 'text-good' : 'text-bad')}>
          {yes ? 'Yes.' : 'Not comfortably.'}
        </p>
        <p className="text-xs leading-relaxed text-muted">
          You have <Money value={sts.amount} className="font-bold text-ink" /> safe to spend
          until {formatDayFull(sts.until)}. Spending{' '}
          <Money value={query.affordAmount} className="font-bold text-ink" /> leaves{' '}
          <Money value={after} className="font-bold" tone={after < 0 ? 'bad' : 'good'} /> for{' '}
          {sts.daysLeft} {sts.daysLeft === 1 ? 'day' : 'days'}.
        </p>
      </div>
    );
  }

  const subject = query.subject.trim().toLowerCase();
  const matched = subject
    ? ledger.categories.find((c) => c.name.toLowerCase().includes(subject))
    : undefined;

  const window = entriesBetween(ledger.entries, query.from, query.to).filter(
    (e) => e.direction === 'out',
  );

  const family = matched ? categoryFamily(matched.id, ledger.categories) : null;
  const filtered = !subject
    ? window
    : family
      ? window.filter((e) => e.categoryId && family.has(e.categoryId))
      : window.filter(
          (e) =>
            e.description.toLowerCase().includes(subject) ||
            (e.merchant ?? '').toLowerCase().includes(subject),
        );

  const total = totalOut(filtered);
  const top = matched
    ? []
    : spendByCategory(filtered, ledger.categories, query.from, query.to).slice(0, 4);
  const lookup = byId(ledger.categories);

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-raised/70 p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-bold text-muted uppercase tracking-wider">
          {matched ? matched.name : subject || 'Everything'} · {query.rangeLabel}
        </p>
        <Money value={total} className="text-lg font-black text-ink" />
      </div>
      <p className="text-xs text-faint">
        {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
      </p>

      {top.length > 0 ? (
        <div className="space-y-2 border-t border-line/70 pt-2.5">
          {top.map((row) => (
            <div key={row.categoryId ?? 'none'} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                {row.categoryId ? (
                  <CategoryIcon
                    name={lookup.get(row.categoryId)?.icon}
                    color={lookup.get(row.categoryId)?.color}
                    className="h-4 w-4 shrink-0"
                  />
                ) : null}
                <span className="min-w-0 truncate text-xs font-bold text-ink">
                  {row.categoryId
                    ? (lookup.get(row.categoryId)?.name ?? 'Unknown')
                    : 'Uncategorised'}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-faint font-semibold">{Math.round(row.pctOfTotal)}%</span>
                <Money value={row.total} className="text-xs font-bold text-ink" />
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-faint">
          <ArrowRight className="h-3 w-3" />
          Nothing recorded in that window.
        </p>
      ) : null}
    </div>
  );
}
