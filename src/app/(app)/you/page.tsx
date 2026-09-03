'use client';

import {
  Calculator,
  Download,
  FileUp,
  HelpCircle,
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
import { CalculatorSheet } from '@/components/calculator/calculator-sheet';
import { CategoryIcon } from '@/components/category/category-icon';
import { CategoryEntriesSheet } from '@/components/category/category-entries-sheet';
import { CategorySheet } from '@/components/category/category-sheet';
import { ImportSheet } from '@/components/settings/import-sheet';
import { SankeyChart } from '@/components/shell/sankey-chart';
import { WalkthroughDialog } from '@/components/shell/walkthrough-dialog';
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
  const { ledger, updatePrefs, settle, deleteRule, deleteEverything, restoreLedger } = useLedger();
  const { user, leave } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();

  const day = todayISO();
  const month = currentMonth();

  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
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
    <div className="space-y-6">
      <header className="px-1">
        <h1 className="text-2xl font-bold tracking-tight text-ink">You & Insights</h1>
        <p className="text-xs text-muted mt-0.5">{user?.email}</p>
      </header>

      {/* Net Worth Summary Card */}
      {liveAccounts > 0 ? (
        <Card className="relative overflow-hidden rounded-2xl p-5 shadow-xs bg-surface/80 border border-line/60">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Total Net Worth</p>
          <Money
            value={worth}
            className="mt-1.5 block text-3xl sm:text-4xl font-bold tracking-tight tnum"
            tone={worth < 0 ? 'bad' : 'plain'}
            animate
          />
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Assets minus liabilities across all {liveAccounts}{' '}
            {liveAccounts === 1 ? 'account' : 'accounts'}. Includes spendable money, savings & liabilities.
          </p>
        </Card>
      ) : null}

      {/* Six months trend */}
      <Section title="Six months trend">
        <Card className="p-4 sm:p-5 rounded-xl shadow-xs space-y-3.5 border border-line/60 bg-surface/80">
          <div className="flex items-end justify-between gap-3 pt-2">
            {trend.map((row) => (
              <div key={row.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-24 w-full items-end justify-center gap-1">
                  <div
                    className="w-2.5 rounded-t-sm bg-good/80 transition-all duration-300"
                    style={{ height: `${Math.max(4, (row.income / peak) * 100)}%` }}
                    title={`In: ${formatMoney(row.income)}`}
                  />
                  <div
                    className="w-2.5 rounded-t-sm bg-ink/70 transition-all duration-300"
                    style={{ height: `${Math.max(4, (row.spending / peak) * 100)}%` }}
                    title={`Out: ${formatMoney(row.spending)}`}
                  />
                </div>
                <span className="truncate text-[11px] font-medium text-muted">
                  {formatMonthShort(row.month).slice(0, 3)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-6 border-t border-line/50 pt-2.5 text-xs font-medium text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-good" /> Money In
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-ink/70" /> Money Out
            </span>
          </div>
        </Card>
      </Section>

      {/* Monthly Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 rounded-xl shadow-xs border border-line/60 bg-surface/80">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Kept this month</p>
          <Money
            value={summary.saved}
            signed
            className="mt-1.5 block text-xl sm:text-2xl font-bold text-ink tnum"
          />
          <p className="mt-1 text-xs font-normal text-muted">
            {summary.income > 0
              ? `${Math.round(summary.savingsRate)}% savings rate`
              : 'No income recorded'}
          </p>
        </Card>

        <Card className="p-4 rounded-xl shadow-xs border border-line/60 bg-surface/80">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Needs vs wants</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold text-ink tnum">
            {splitTotal > 0 ? `${Math.round((summary.needs / splitTotal) * 100)}%` : '—'}
          </p>
          <p className="mt-1 text-xs font-normal text-muted truncate">
            {splitTotal > 0
              ? `Needs · ${formatMoney(summary.wants)} wants`
              : 'Nothing spent yet'}
          </p>
        </Card>
      </div>

      {/* Interactive Cash Flow Sankey Visualizer */}
      <SankeyChart initialMonth={month} />

      {/* Spending Distribution */}
      {spend.length > 0 ? (
        <Section title={`Where it went in ${formatMonthShort(month)}`}>
          <Card className="divide-y divide-line/50 overflow-hidden shadow-xs">
            {spend.map((row) => (
              <button
                key={row.categoryId ?? 'none'}
                type="button"
                onClick={() => setDrilldownCategory(row.categoryId ?? '')}
                className="flex w-full flex-col px-4 py-3 text-left hover:bg-raised/50 transition-colors group"
              >
                <div className="flex items-center gap-2.5 w-full">
                  <CategoryIcon
                    name={row.category?.icon}
                    color={row.category?.color}
                    className="h-4 w-4 shrink-0"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                    {row.category?.name ?? 'Uncategorised'}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-muted tnum">
                    {Math.round(row.pctOfTotal)}%
                  </span>
                  <Money value={row.total} className="shrink-0 text-sm font-semibold text-ink tnum" tone="plain" />
                </div>
                <Bar value={row.total} max={spend[0]?.total ?? row.total} className="mt-2 w-full h-1.5" />
              </button>
            ))}
          </Card>
        </Section>
      ) : null}

      {/* Merchant Inflation Index */}
      {prices.length > 0 ? (
        <Section title="What quietly got more expensive">
          <Card className="divide-y divide-line/50 overflow-hidden shadow-xs">
            {prices.slice(0, 5).map((observation) => (
              <div
                key={observation.merchant}
                className="flex items-center gap-3 px-4 py-3"
              >
                <TrendingUp
                  className={cn(
                    'h-4 w-4 shrink-0',
                    observation.changePct > 0 ? 'text-warn' : 'rotate-180 text-good',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {observation.merchant}
                  </span>
                  <span className="block text-xs text-muted">
                    {formatMoney(observation.first.amount)} → {formatMoney(observation.latest.amount)}{' '}
                    since {formatDay(observation.first.date)}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 text-xs font-semibold tnum',
                    observation.changePct > 0 ? 'text-warn' : 'text-good',
                  )}
                >
                  {observation.changePct > 0 ? '+' : ''}
                  {Math.round(observation.changePct * 100)}%
                </span>
              </div>
            ))}
          </Card>
        </Section>
      ) : null}

      {/* Reimbursable / Owed */}
      {owedTotal > 0 ? (
        <Section
          title="Money owed to you"
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void settle(owed.map((entry) => entry.id))}
              className="text-xs font-semibold h-7 px-2"
            >
              Settle all
            </Button>
          }
        >
          <Card className="p-3.5 shadow-xs">
            <p className="text-xs text-muted">
              <Money value={owedTotal} className="font-semibold text-ink" tone="plain" /> across{' '}
              {owed.length} {owed.length === 1 ? 'entry' : 'entries'}.
            </p>
          </Card>
        </Section>
      ) : null}

      {/* Categories */}
      <Section
        title="Categories"
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setCategory(null);
              setCategoryOpen(true);
            }}
            className="text-xs font-semibold gap-1 h-7 px-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Add category
          </Button>
        }
      >
        <Card className="divide-y divide-line/50 overflow-hidden shadow-xs">
          {visibleCategories.length === 0 ? (
            <Empty
              icon={<Shapes className="h-5 w-5" />}
              title="No categories"
              hint="Add categories to organize your expenses."
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
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-raised/50"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-2xs"
                  style={{ backgroundColor: `${row.color}20`, border: `1px solid ${row.color}35` }}
                >
                  <CategoryIcon name={row.icon} color={row.color} className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
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
            className="px-1 text-xs font-semibold text-accent hover:underline"
          >
            {showAllCategories
              ? 'Show fewer'
              : `Show all ${ledger.categories.filter((c) => !c.archived).length} categories`}
          </button>
        ) : null}
      </Section>

      {/* Learned Rules */}
      {ledger.rules.length > 0 ? (
        <Section title="Rules you taught it">
          <Card className="divide-y divide-line/50 overflow-hidden shadow-xs">
            {ledger.rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-3 px-4 py-3">
                <Wand2 className="h-4 w-4 shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">
                    {rule.field} {rule.op} “{rule.value}”
                  </span>
                  <span className="block truncate text-xs text-faint">
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
                  className="shrink-0 rounded-xl p-1.5 text-faint hover:bg-raised hover:text-bad transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </Card>
        </Section>
      ) : null}

      {/* Settings Section */}
      <Section title="Settings & Appearance">
        <Card className="space-y-4 p-5 rounded-xl shadow-xs border border-line/60 bg-surface/80">
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
            hint="The day your salary lands. Safe to Spend calculates your daily runway until this date."
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

          <div className="border-t border-line/50 pt-3.5">
            <Switch
              checked={
                ledger.prefs.salaryFundsNextMonth ??
                (ledger.prefs.payday !== undefined && ledger.prefs.payday >= 20)
              }
              onChange={(next) => void savePrefs({ salaryFundsNextMonth: next })}
              label="Salary funds next month"
              hint="Credit received on or after payday (e.g. 28 Aug) counts as inflow for the upcoming month (September)."
            />
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted">Appearance</span>
            <Segmented options={THEMES} value={theme} onChange={setTheme} />
          </div>

          <div className="border-t border-line/50 pt-3.5">
            <Switch
              checked={ledger.prefs.privacyMode === true}
              onChange={(next) => void savePrefs({ privacyMode: next })}
              label="Privacy Blur Mode"
              hint="Blurs numbers for public commute. Hover or tap to view."
            />
          </div>

          <div className="border-t border-line/50 pt-3.5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink flex items-center gap-1.5">
                <Calculator className="h-4 w-4 text-accent" />
                <span>Financial Calculator & Tools</span>
              </p>
              <p className="text-xs text-muted">Tactile math, smart multipliers, EMI loan planner, and SIP growth</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCalcOpen(true)}
              className="gap-1.5 text-xs font-semibold shrink-0 h-8"
            >
              <Calculator className="h-3.5 w-3.5 text-accent" />
              Open calc
            </Button>
          </div>

          <div className="border-t border-line/50 pt-3.5 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">How KharchGini works</p>
              <p className="text-xs text-muted">Review philosophy and runway mechanics</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTourOpen(true)}
              className="gap-1.5 text-xs font-semibold shrink-0 h-8"
            >
              <HelpCircle className="h-3.5 w-3.5 text-accent" />
              View guide
            </Button>
          </div>
        </Card>
      </Section>

      {/* Data Backup & Restore */}
      <Section title="Your Data">
        <Card className="space-y-3 p-5 rounded-xl shadow-xs border border-line/60 bg-surface/80">
          <p className="text-xs leading-relaxed text-muted">
            {ledger.entries.length} entries, {ledger.accounts.length} accounts. Fully stored in your personal Firebase database.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="font-bold">
              <FileUp className="h-3.5 w-3.5 text-accent" />
              Import Statement (Excel / CSV)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportEntries}
              disabled={ledger.entries.length === 0}
              className="font-bold"
            >
              <Download className="h-3.5 w-3.5" />
              Entries CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportEverything} className="font-bold">
              <Download className="h-3.5 w-3.5" />
              Full backup JSON
            </Button>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                disabled={restoring}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setRestoring(true);
                  try {
                    const text = await file.text();
                    const json = JSON.parse(text);
                    const count = await restoreLedger(json);
                    toast(`Restored ${count} items from backup.`, { tone: 'good' });
                  } catch (err) {
                    toast(err instanceof Error ? err.message : 'Invalid backup JSON file', { tone: 'bad' });
                  } finally {
                    setRestoring(false);
                    e.target.value = '';
                  }
                }}
              />
              <span className="inline-flex h-9 items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface px-3.5 text-xs font-bold text-ink hover:bg-raised transition-all active:scale-95 shadow-2xs">
                <FileUp className="h-3.5 w-3.5 text-accent" />
                {restoring ? 'Restoring...' : 'Restore JSON'}
              </span>
            </label>
          </div>
        </Card>
      </Section>

      {/* Account actions */}
      <Section title="Account">
        <Card className="space-y-3.5 p-4 shadow-xs">
          <Button variant="secondary" onClick={() => void leave()} className="w-full font-medium">
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>

          <div className="space-y-2 border-t border-line/50 pt-3.5">
            <p className="text-sm font-semibold text-ink">Delete everything</p>
            <p className="text-xs leading-relaxed text-muted">
              Permanently delete all entries, accounts, budgets, and rules. Type <strong>DELETE</strong> to confirm.
            </p>
            <div className="flex gap-2">
              <Input
                value={confirmWipe}
                onChange={(e) => setConfirmWipe(e.target.value)}
                placeholder="DELETE"
                autoCapitalize="characters"
                className="h-10 text-sm font-mono"
              />
              <Button
                variant="danger"
                onClick={wipe}
                disabled={confirmWipe !== 'DELETE'}
                className="shrink-0 font-bold"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </Section>

      <CategoryEntriesSheet
        categoryId={drilldownCategory}
        month={month}
        open={drilldownCategory !== null}
        onClose={() => setDrilldownCategory(null)}
      />
      <CategorySheet
        category={category}
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
      />
      <ImportSheet open={importOpen} onClose={() => setImportOpen(false)} />
      <CalculatorSheet open={calcOpen} onClose={() => setCalcOpen(false)} />
      <WalkthroughDialog open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
}
