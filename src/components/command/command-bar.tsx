'use client';

import {
  ArrowRight,
  CornerDownLeft,
  Loader2,
  Sparkles,
  TriangleAlert,
  Wand2,
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
import type { Direction, EntryDraft } from '@/domain/types';
import { useLedger } from '@/lib/store';
import { cn } from '@/lib/utils';
import { CategoryIcon } from '@/components/category/category-icon';
import { Button } from '@/components/ui/button';
import { Input, Segmented, Select } from '@/components/ui/input';
import { Money, Badge } from '@/components/ui/money';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: 'out', label: 'Out' },
  { value: 'in', label: 'In' },
  { value: 'transfer', label: 'Transfer' },
];

/**
 * One input for everything.
 *
 * The rest of this application is a place to look at money. This is the place to
 * record it, and recording has to be faster than not recording — otherwise the
 * ledger goes stale and every number downstream becomes a lie about a life
 * somebody stopped describing.
 *
 * What was understood is always shown before anything is written, and every part
 * of it can be corrected in one tap without retyping the line.
 */
export function CommandBar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { ledger, addEntry, deleteEntry } = useLedger();
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

  // A correction applies to the line as typed; changing the line starts over.
  useEffect(() => {
    setOverrides({});
  }, [text]);

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
  }, [entry, busy, addEntry, deleteEntry, toast]);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add"
      description="Type it the way you would say it."
      wide
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={save}
            disabled={!entry || busy}
            className="flex-[2]"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {entry ? `Save ${formatMoney(entry.amount)}` : 'Save'}
            <CornerDownLeft className="h-3.5 w-3.5 opacity-60" />
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
          placeholder="280 chai or paste bank SMS"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="h-12 text-[17px]"
        />

        {/* Quick Presets Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar select-none">
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset.command}
              type="button"
              onClick={() => {
                setText(preset.command);
                inputRef.current?.focus();
              }}
              className="shrink-0 rounded-full border border-line bg-surface/80 px-2.5 py-1 text-[12px] font-medium text-ink hover:border-accent hover:bg-raised transition-all active:scale-95"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {result.kind === 'empty' ? <Examples onPick={setText} /> : null}

        {result.kind === 'error' ? (
          <p className="flex items-start gap-2 rounded-xl bg-raised px-3 py-2.5 text-[13px] text-muted">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
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

/* -------------------------------------------------------------------------- */

function Examples({ onPick }: { onPick: (value: string) => void }) {
  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">
          Natural Language & SMS
        </p>
        <span className="text-[11px] text-accent font-medium">⚡ Instant parse</span>
      </div>

      <div className="rounded-xl border border-line/60 bg-raised/40 p-2.5 text-[12px] text-muted space-y-1">
        <p className="font-medium text-ink flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-accent" /> Smart Paste Supported
        </p>
        <p className="text-faint leading-relaxed">
          Copy any UPI or Bank debit SMS from your phone and paste it directly above. KharchGini extracts the amount, merchant, and bank account automatically.
        </p>
      </div>

      <div className="space-y-0.5">
        {COMMAND_EXAMPLES.map((example) => (
          <button
            key={example.input}
            type="button"
            onClick={() => onPick(example.input)}
            className="flex w-full items-baseline gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-raised"
          >
            <code className="shrink-0 text-[13px] text-ink">{example.input}</code>
            <span className="min-w-0 flex-1 truncate text-[12px] text-faint">{example.means}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The preview is not a confirmation step; it is the entry. Every field the
 * parser guessed is a control, so a wrong guess is a tap to fix rather than a
 * line to retype.
 */
function Preview({
  entry,
  accounts,
  categories,
  onChange,
}: {
  entry: ParsedEntry;
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; icon: string }[];
  onChange: (changes: Partial<ParsedEntry>) => void;
}) {
  const isTransfer = entry.direction === 'transfer';
  const isSMS = entry.note?.includes('Ref') || entry.note?.includes('Card');

  return (
    <div className="space-y-3 rounded-card border border-line bg-raised/60 p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[15px] font-semibold text-ink">{entry.description}</p>
            {isSMS ? (
              <Badge tone="good" className="text-[10px] py-0 px-1.5">
                Bank SMS
              </Badge>
            ) : null}
          </div>
          {entry.note ? (
            <p className="text-[11px] text-faint truncate mt-0.5">{entry.note}</p>
          ) : null}
        </div>
        <Money
          value={entry.amount}
          className="shrink-0 text-lg font-bold"
          tone={entry.direction === 'in' ? 'good' : 'plain'}
        />
      </div>

      <Segmented
        options={DIRECTIONS}
        value={entry.direction}
        onChange={(direction) => onChange({ direction })}
      />

      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-1">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
            Date
          </span>
          <Input
            type="date"
            value={entry.date}
            max={todayISO()}
            onChange={(e) => onChange({ date: e.target.value })}
            className="h-10 text-[13px]"
          />
        </label>

        <label className="col-span-1">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
            {isTransfer ? 'From' : 'Account'}
          </span>
          <Select
            value={entry.accountId}
            onChange={(e) => onChange({ accountId: e.target.value })}
            className="h-10 text-[13px]"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="col-span-2">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">
            {isTransfer ? 'To' : 'Category'}
          </span>
          {isTransfer ? (
            <Select
              value={entry.counterAccountId ?? ''}
              onChange={(e) => onChange({ counterAccountId: e.target.value })}
              className="h-10 text-[13px]"
            >
              <option value="">Choose an account…</option>
              {accounts
                .filter((account) => account.id !== entry.accountId)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
            </Select>
          ) : (
            <Select
              value={entry.categoryId ?? ''}
              onChange={(e) => onChange({ categoryId: e.target.value || undefined })}
              className="h-10 text-[13px]"
            >
              <option value="">Uncategorised</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          )}
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-faint">
        <span className="inline-flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          {formatRelativeDay(entry.date)} · {formatDayFull(entry.date)}
        </span>
        {!isTransfer && entry.categorySource !== 'none' ? (
          <span className="inline-flex items-center gap-1">
            <Wand2 className="h-3 w-3" />
            {CATEGORY_SOURCE_LABEL[entry.categorySource]}
          </span>
        ) : null}
        {entry.tags.map((tag) => (
          <span key={tag} className="rounded bg-surface px-1.5 py-0.5 text-ink">
            #{tag}
          </span>
        ))}
        {entry.note ? <span className="italic">“{entry.note}”</span> : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Questions are answered from the same functions that draw the screens, so the
 * command bar can never disagree with the rest of the app.
 */
function Answer({ query }: { query: ParsedQuery }) {
  const { ledger } = useLedger();

  if (query.kind === 'afford') {
    if (query.affordAmount === undefined) {
      return (
        <p className="rounded-xl bg-raised px-3 py-2.5 text-[13px] text-muted">
          How much? Try “?can i afford 15000”.
        </p>
      );
    }

    const { yes, after, sts } = canAfford(ledger, query.affordAmount);
    return (
      <div className="space-y-2 rounded-card border border-line bg-raised/60 p-3.5">
        <p className={cn('text-lg font-semibold', yes ? 'text-good' : 'text-bad')}>
          {yes ? 'Yes.' : 'Not comfortably.'}
        </p>
        <p className="text-[13px] leading-relaxed text-muted">
          You have <Money value={sts.amount} className="font-medium text-ink" /> safe to spend
          until {formatDayFull(sts.until)}. Spending{' '}
          <Money value={query.affordAmount} className="font-medium text-ink" /> leaves{' '}
          <Money value={after} className="font-medium" tone={after < 0 ? 'bad' : 'good'} /> for{' '}
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
    <div className="space-y-2.5 rounded-card border border-line bg-raised/60 p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-muted">
          {matched ? matched.name : subject || 'Everything'} · {query.rangeLabel}
        </p>
        <Money value={total} className="text-lg font-semibold" />
      </div>
      <p className="text-[12px] text-faint">
        {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
      </p>

      {top.length > 0 ? (
        <div className="space-y-1 border-t border-line pt-2">
          {top.map((row) => (
            <div key={row.categoryId ?? 'none'} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5">
                {row.categoryId ? (
                  <CategoryIcon
                    name={lookup.get(row.categoryId)?.icon}
                    color={lookup.get(row.categoryId)?.color}
                    className="h-3.5 w-3.5 shrink-0"
                  />
                ) : null}
                <span className="min-w-0 truncate text-[13px] text-ink">
                  {row.categoryId
                    ? (lookup.get(row.categoryId)?.name ?? 'Unknown')
                    : 'Uncategorised'}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-[11px] text-faint">{Math.round(row.pctOfTotal)}%</span>
                <Money value={row.total} className="text-[13px]" />
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="flex items-center gap-1.5 text-[12px] text-faint">
          <ArrowRight className="h-3 w-3" />
          Nothing recorded in that window.
        </p>
      ) : null}
    </div>
  );
}
