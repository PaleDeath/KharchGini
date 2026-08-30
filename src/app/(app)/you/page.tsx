'use client';

import {
  Download,
  FileUp,
  LogOut,
  Plus,
  Shapes,
  Sparkles,
  Trash2,
  TrendingUp,
  Wand2,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  currentMonth,
  formatDay,
  formatMonthShort,
  recentMonths,
  startOfMonth,
  endOfMonth,
  today as todayISO,
} from '@/domain/dates';
import {
  byId,
  monthSummaries,
  monthSummary,
  netWorth,
  owedToMe,
  priceIndex,
  spendByCategory,
} from '@/domain/derive';
import { formatAmount, formatMoney } from '@/domain/money';
import { CATEGORY_KIND_LABEL, type Category, type UserPrefs } from '@/domain/types';
import { CategoryIcon } from '@/components/category/category-icon';
import { CategorySheet } from '@/components/category/category-sheet';
import { ImportSheet } from '@/components/settings/import-sheet';
import { Button } from '@/components/ui/button';
import { Card, Empty, Section } from '@/components/ui/card';
import { Field, Input, Segmented, Switch } from '@/components/ui/input';
import { Bar, Badge, Money } from '@/components/ui/money';
import { useToast } from '@/components/ui/toast';
import { useTheme, type Theme } from '@/components/shell/theme';
import { useAuth } from '@/lib/auth';
import { useLedger } from '@/lib/store';
import { cn, download, toCSV } from '@/lib/utils';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export default function YouPage() {
  const { ledger, updatePrefs, settle, deleteRule, deleteEverything } = useLedger();
  const { user, leave } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();

  const day = todayISO();
  const month = currentMonth();

  const [category, setCategory] = useState<Category | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState('');
  const [name, setName] = useState(ledger.prefs.displayName ?? '');
  const [payday, setPayday] = useState(
    ledger.prefs.payday ? String(ledger.prefs.payday) : '',
  );

  const months = useMemo(() => recentMonths(6, month), [month]);
  const trend = useMemo(() => monthSummaries(ledger, months), [ledger, months]);
  const summary = useMemo(() => monthSummary(ledger, month), [ledger, month]);
  const categories = useMemo(() => byId(ledger.categories), [ledger.categories]);

  const spend = useMemo(
    () =>
      spendByCategory(
        ledger.entries,
        ledger.categories,
        startOfMonth(month),
        endOfMonth(month),
      ).slice(0, 6),
    [ledger.entries, ledger.categories, month],
  );

  const prices = useMemo(() => priceIndex(ledger.entries), [ledger.entries]);
  const owed = useMemo(() => owedToMe(ledger.entries), [ledger.entries]);
  const owedTotal = owed.reduce((total, entry) => total + entry.amount, 0);

  const worth = useMemo(
    () => netWorth(ledger.accounts, ledger.entries),
    [ledger.accounts, ledger.entries],
  );
  const liveAccounts = ledger.accounts.filter((account) => !account.archived).length;

  const peak = Math.max(1, ...trend.map((row) => Math.max(row.income, row.spending)));
  const splitTotal = summary.needs + summary.wants + summary.unsorted;

  const visibleCategories = useMemo(() => {
    const live = ledger.categories.filter((c) => !c.archived);
    return showAllCategories ? live : live.slice(0, 8);
  }, [ledger.categories, showAllCategories]);

  const savePrefs = async (changes: Partial<UserPrefs>) => {
    try {
      await updatePrefs(changes);
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not save.', { tone: 'bad' });
    }
  };

  const exportEverything = () => {
    download(
      `kharchgini-backup-${day}.json`,
      JSON.stringify(ledger, null, 2),
      'application/json',
    );
  };

  const exportEntries = () => {
    const accounts = byId(ledger.accounts);
    download(
      `kharchgini-entries-${day}.csv`,
      toCSV(
        ['Date', 'Direction', 'Amount', 'Description', 'Category', 'Account', 'Tags', 'Note'],
        ledger.entries.map((entry) => [
          entry.date,
          entry.direction,
          formatAmount(entry.amount),
          entry.description,
          entry.categoryId ? (categories.get(entry.categoryId)?.name ?? '') : '',
          accounts.get(entry.accountId)?.name ?? '',
          entry.tags.join(' '),
          entry.note ?? '',
        ]),
      ),
    );
  };

  const wipe = async () => {
    try {
      await deleteEverything();
      setConfirmWipe('');
      toast('Everything is gone.', { tone: 'info' });
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not delete.', { tone: 'bad' });
    }
  };

  return (
    <div className="space-y-5">
      <header className="px-1">
        <h1 className="text-xl font-semibold tracking-tight">You</h1>
        <p className="text-[13px] text-faint">{user?.email}</p>
      </header>

      {/*
       * The one number in the app that counts everything: savings, cards, the
       * lot. It is deliberately not on the home screen — "what am I worth" is a
       * question for a quiet moment, not for the second before buying lunch.
       */}
      {liveAccounts > 0 ? (
        <Card className="px-4 py-3.5">
          <p className="text-[13px] text-muted">Net worth</p>
          <Money
            value={worth}
            className="mt-0.5 block text-2xl font-semibold"
            tone={worth < 0 ? 'bad' : 'plain'}
            animate
          />
          <p className="mt-1 text-[12px] leading-relaxed text-faint">
            Everything you hold minus everything you owe, across {liveAccounts}{' '}
            {liveAccounts === 1 ? 'account' : 'accounts'}. Savings and credit cards are both in
            here, which is what makes this different from Safe to Spend.
          </p>
        </Card>
      ) : null}

      {/* Six months, side by side. Trend beats any single month's number. */}
      <Section title="Six months">
        <Card className="px-4 py-4">
          <div className="flex items-end justify-between gap-2">
            {trend.map((row) => (
              <div key={row.month} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <div className="flex h-24 w-full items-end justify-center gap-[3px]">
                  <div
                    className="w-2.5 rounded-t bg-good/70"
                    style={{ height: `${(row.income / peak) * 100}%` }}
                    title={`In ${formatMoney(row.income)}`}
                  />
                  <div
                    className="w-2.5 rounded-t bg-accent/70"
                    style={{ height: `${(row.spending / peak) * 100}%` }}
                    title={`Out ${formatMoney(row.spending)}`}
                  />
                </div>
                <span className="truncate text-[10px] text-faint">
                  {formatMonthShort(row.month).slice(0, 3)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-center gap-4 border-t border-line pt-2.5 text-[11px] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-good/70" /> money in
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent/70" /> money out
            </span>
          </div>
        </Card>
      </Section>

      <div className="grid grid-cols-2 gap-3">
        <Card className="px-4 py-3">
          <p className="text-[12px] text-faint">Kept this month</p>
          <Money
            value={summary.saved}
            signed
            className="mt-0.5 block text-lg font-semibold"
          />
          <p className="mt-0.5 text-[11px] text-faint">
            {summary.income > 0
              ? `${Math.round(summary.savingsRate)}% of what came in`
              : 'No income recorded yet'}
          </p>
        </Card>
        <Card className="px-4 py-3">
          <p className="text-[12px] text-faint">Needs vs wants</p>
          <p className="mt-0.5 text-lg font-semibold tnum">
            {splitTotal > 0 ? `${Math.round((summary.needs / splitTotal) * 100)}%` : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-faint">
            {splitTotal > 0
              ? `needs · ${formatMoney(summary.wants)} on wants`
              : 'Nothing spent yet'}
          </p>
        </Card>
      </div>

      {spend.length > 0 ? (
        <Section title={`Where it went in ${formatMonthShort(month)}`}>
          <Card className="space-y-2.5 px-4 py-3.5">
            {spend.map((row) => (
              <div key={row.categoryId ?? 'none'}>
                <div className="flex items-center gap-2">
                  <CategoryIcon
                    name={row.category?.icon}
                    color={row.category?.color}
                    className="h-3.5 w-3.5 shrink-0"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                    {row.category?.name ?? 'Uncategorised'}
                  </span>
                  <span className="shrink-0 text-[11px] text-faint">
                    {Math.round(row.pctOfTotal)}%
                  </span>
                  <Money value={row.total} className="shrink-0 text-[13px]" tone="plain" />
                </div>
                <Bar value={row.total} max={spend[0]?.total ?? row.total} className="mt-1.5" />
              </div>
            ))}
          </Card>
        </Section>
      ) : null}

      {prices.length > 0 ? (
        <Section title="What quietly got more expensive">
          <Card className="divide-y divide-line overflow-hidden">
            {prices.slice(0, 5).map((observation) => (
              <div
                key={observation.merchant}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <TrendingUp
                  className={cn(
                    'h-4 w-4 shrink-0',
                    observation.changePct > 0 ? 'text-warn' : 'rotate-180 text-good',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm capitalize text-ink">
                    {observation.merchant}
                  </span>
                  <span className="block text-[12px] text-faint">
                    {formatMoney(observation.first.amount)} → {formatMoney(observation.latest.amount)}{' '}
                    since {formatDay(observation.first.date)}
                  </span>
                </span>
                <Badge tone={observation.changePct > 0 ? 'warn' : 'good'}>
                  {observation.changePct > 0 ? '+' : ''}
                  {Math.round(observation.changePct)}%
                </Badge>
              </div>
            ))}
          </Card>
        </Section>
      ) : null}

      {owed.length > 0 ? (
        <Section
          title="Owed to you"
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void settle(owed.map((entry) => entry.id))}
            >
              Settle all
            </Button>
          }
        >
          <Card className="px-4 py-3">
            <p className="text-[13px] text-muted">
              <Money value={owedTotal} className="font-semibold text-ink" tone="plain" /> across{' '}
              {owed.length} {owed.length === 1 ? 'entry' : 'entries'}. It is real money and it is
              not in Safe to Spend.
            </p>
          </Card>
        </Section>
      ) : null}

      <Section
        title="Categories"
        action={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCategory(null);
              setCategoryOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        }
      >
        <Card className="divide-y divide-line overflow-hidden">
          {visibleCategories.length === 0 ? (
            <Empty
              icon={<Shapes className="h-6 w-6" />}
              title="No categories"
              hint="Odd — the app seeds a starter set. Add one and carry on."
            />
          ) : (
            visibleCategories.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  setCategory(row);
                  setCategoryOpen(true);
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-raised"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${row.color}1f` }}
                >
                  <CategoryIcon name={row.icon} color={row.color} className="h-[15px] w-[15px]" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {row.parentId ? `${categories.get(row.parentId)?.name ?? '?'} → ` : ''}
                  {row.name}
                </span>
                <Badge>{CATEGORY_KIND_LABEL[row.kind]}</Badge>
              </button>
            ))
          )}
        </Card>
        {ledger.categories.filter((c) => !c.archived).length > 8 ? (
          <button
            type="button"
            onClick={() => setShowAllCategories((v) => !v)}
            className="px-1 text-[12px] text-accent hover:underline"
          >
            {showAllCategories
              ? 'Show fewer'
              : `Show all ${ledger.categories.filter((c) => !c.archived).length}`}
          </button>
        ) : null}
      </Section>

      {ledger.rules.length > 0 ? (
        <Section title="Rules you taught it">
          <Card className="divide-y divide-line overflow-hidden">
            {ledger.rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-3 px-4 py-2.5">
                <Wand2 className="h-4 w-4 shrink-0 text-faint" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">
                    {rule.field} {rule.op} “{rule.value}”
                  </span>
                  <span className="block truncate text-[12px] text-faint">
                    files as{' '}
                    {rule.setCategoryId
                      ? (categories.get(rule.setCategoryId)?.name ?? 'unknown')
                      : 'nothing'}{' '}
                    · used {rule.hitCount} {rule.hitCount === 1 ? 'time' : 'times'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void deleteRule(rule.id)}
                  aria-label="Delete rule"
                  className="shrink-0 rounded-lg p-1.5 text-faint hover:bg-raised hover:text-bad"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </Card>
          <p className="flex items-center gap-1.5 px-1 text-[12px] text-faint">
            <Sparkles className="h-3.5 w-3.5" />
            It has also learned {ledger.merchants.length}{' '}
            {ledger.merchants.length === 1 ? 'merchant' : 'merchants'} from your corrections.
          </p>
        </Section>
      ) : null}

      <Section title="Settings">
        <Card className="space-y-4 px-4 py-4">
          <Field label="What should it call you">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => void savePrefs({ displayName: name.trim() || undefined })}
              placeholder="Your name"
            />
          </Field>

          <Field
            label="Payday"
            hint="The day your salary usually lands. Safe to Spend measures the runway to it."
          >
            <Input
              type="number"
              min={1}
              max={31}
              inputMode="numeric"
              value={payday}
              onChange={(e) => setPayday(e.target.value)}
              onBlur={() => {
                const parsed = Number(payday);
                void savePrefs({
                  payday:
                    Number.isInteger(parsed) && parsed >= 1 && parsed <= 31 ? parsed : undefined,
                });
              }}
              placeholder="e.g. 1"
            />
          </Field>

          <div className="space-y-1.5">
            <span className="block text-[13px] font-medium text-muted">Appearance</span>
            <Segmented options={THEMES} value={theme} onChange={setTheme} />
          </div>

          <div className="border-t border-line pt-3.5">
            <Switch
              checked={ledger.prefs.privacyMode === true}
              onChange={(next) => void savePrefs({ privacyMode: next })}
              label="Blur every amount"
              hint="For the metro. Hover or tap a figure to read it."
            />
          </div>
        </Card>
      </Section>

      <Section title="Your data">
        <Card className="space-y-2 px-4 py-4">
          <p className="text-[13px] leading-relaxed text-muted">
            {ledger.entries.length} entries, {ledger.accounts.length} accounts. It is yours: take it
            out whenever you like, in a format any spreadsheet opens.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <FileUp className="h-3.5 w-3.5" />
              Import CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportEntries}
              disabled={ledger.entries.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Entries as CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportEverything}>
              <Download className="h-3.5 w-3.5" />
              Full backup
            </Button>
          </div>
        </Card>
      </Section>

      <Section title="Account">
        <Card className="space-y-3 px-4 py-4">
          <Button variant="secondary" onClick={() => void leave()} className="w-full">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>

          <div className="space-y-2 border-t border-line pt-3">
            <p className="text-[13px] font-medium text-ink">Delete everything</p>
            <p className="text-[12px] leading-relaxed text-faint">
              Every entry, account, budget and goal, permanently. Take a backup first — this cannot
              be undone and there is no copy anywhere else. Type <strong>DELETE</strong> to confirm.
            </p>
            <div className="flex gap-2">
              <Input
                value={confirmWipe}
                onChange={(e) => setConfirmWipe(e.target.value)}
                placeholder="DELETE"
                autoCapitalize="characters"
                className="h-10 text-sm"
              />
              <Button
                variant="danger"
                onClick={wipe}
                disabled={confirmWipe !== 'DELETE'}
                className="shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </Section>

      <CategorySheet
        category={category}
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
      />
      <ImportSheet open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
