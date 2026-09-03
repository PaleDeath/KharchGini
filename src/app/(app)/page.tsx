'use client';

import {
  ArrowUpRight,
  ChevronDown,
  Flame,
  HelpCircle,
  ListChecks,
  Plus,
  Receipt,
  Sparkles,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wallet,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  formatDay,
  formatDayFull,
  formatDueIn,
  startOfWeek,
  today as todayISO,
  weekKey,
} from '@/domain/dates';
import {
  byId,
  daysSinceLastEntry,
  entriesBetween,
  liquidBalance,
  loggingStreak,
  lowestPoint,
  projectBalance,
  reviewDue,
  reviewItems,
  safeToSpend,
  totalOut,
} from '@/domain/derive';
import { upcoming } from '@/domain/recurring';
import type { Entry, Recurring } from '@/domain/types';
import { EntryRow } from '@/components/entry/entry-row';
import { EntrySheet } from '@/components/entry/entry-sheet';
import { RecurringSheet } from '@/components/plan/recurring-sheet';
import { ReviewSheet } from '@/components/review/review-sheet';
import { GettingStartedCard } from '@/components/shell/getting-started-card';
import { RunwayChart } from '@/components/shell/runway-chart';
import { WalkthroughDialog } from '@/components/shell/walkthrough-dialog';
import { SimulatorSheet } from '@/components/simulator/simulator-sheet';
import { Card, Divider, Empty, Section } from '@/components/ui/card';
import { Money, Badge } from '@/components/ui/money';
import { useLedger } from '@/lib/store';
import { cn } from '@/lib/utils';

export default function TodayPage() {
  const { ledger, postRecurring } = useLedger();
  const [editing, setEditing] = useState<Entry | null>(null);
  const [editingRecurring, setEditingRecurring] = useState<Recurring | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [showMath, setShowMath] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showRunway, setShowRunway] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);

  const day = todayISO();

  const sts = useMemo(() => safeToSpend(ledger, day), [ledger, day]);
  const categories = useMemo(() => byId(ledger.categories), [ledger.categories]);
  const accounts = useMemo(() => byId(ledger.accounts), [ledger.accounts]);

  const spentToday = useMemo(
    () => totalOut(entriesBetween(ledger.entries, day, day)),
    [ledger.entries, day],
  );
  const spentThisWeek = useMemo(
    () => totalOut(entriesBetween(ledger.entries, startOfWeek(day), day)),
    [ledger.entries, day],
  );

  const bills = useMemo(() => upcoming(ledger.recurring, day, 7), [ledger.recurring, day]);
  const streak = useMemo(() => loggingStreak(ledger.entries, day), [ledger.entries, day]);

  const pending = useMemo(() => reviewItems(ledger, day), [ledger, day]);
  const needsReview = reviewDue(ledger.reviews, weekKey(day)) && pending.length > 0;

  const projection = useMemo(() => projectBalance(ledger, day, 45), [ledger, day]);

  const dip = useMemo(() => {
    const worst = lowestPoint(projection);
    if (!worst || worst.balance >= 0) return null;

    const crossing = projection.find((entry) => entry.balance < 0);
    if (!crossing || crossing.date === day) return null;

    return { crossing, worst };
  }, [projection, day]);

  const quiet = useMemo(() => daysSinceLastEntry(ledger.entries, day), [ledger.entries, day]);

  const recent = useMemo(
    () =>
      [...ledger.entries]
        .sort((a, b) =>
          a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
        )
        .slice(0, 8),
    [ledger.entries],
  );

  const name = ledger.prefs.displayName?.split(' ')[0];

  const handleQuickAdd = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));
  };

  return (
    <div className="space-y-6">
      {/* Header with greeting, streak, and quick guide */}
      <header className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-bold text-muted uppercase tracking-wider">
            {formatDayFull(day)}
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-ink flex items-center gap-2">
            <span>
              {greetingText()}
              {name ? `, ${name}` : ''}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {streak > 1 ? (
            <span className="flex items-center gap-1.5 rounded-full border border-warn/30 bg-warn/15 px-3 py-1 text-xs font-black text-warn shadow-2xs">
              <Flame className="h-3.5 w-3.5 fill-warn text-warn" />
              {streak} day streak
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setShowTour(true)}
            aria-label="How KharchGini works"
            title="How KharchGini works"
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-line bg-surface text-muted hover:bg-raised hover:text-ink transition-all active:scale-95 shadow-2xs"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Getting started checklist for onboarding */}
      <GettingStartedCard
        onOpenTour={() => setShowTour(true)}
        onOpenAdd={handleQuickAdd}
      />

      {/* Hero Financial Cockpit: Safe to Spend */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border p-6 shadow-xs transition-all',
          sts.negative
            ? 'border-bad/40 bg-gradient-to-br from-bad/10 to-surface'
            : 'border-line/60 bg-gradient-to-br from-surface to-raised/40 hover:border-line/80',
        )}
      >
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/15 text-accent">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Safe to Spend
              </span>
            </div>
            {sts.negative ? (
              <Badge tone="bad" className="px-2 py-0.5 text-xs font-semibold">Deficit Risk</Badge>
            ) : sts.perDay >= 50_000 ? (
              <Badge tone="good" className="px-2 py-0.5 text-xs font-semibold">Healthy Runway</Badge>
            ) : (
              <Badge tone="warn" className="px-2 py-0.5 text-xs font-semibold">Tight Pace</Badge>
            )}
          </div>

          <div className="mt-4 flex items-baseline gap-2">
            <Money
              value={sts.amount}
              className={cn(
                'text-4xl sm:text-5xl font-bold tracking-tight leading-none tnum',
                sts.negative ? 'text-bad' : 'text-ink',
              )}
              tone="plain"
              animate
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg bg-raised border border-line/60 px-2.5 py-1 text-xs text-ink font-semibold shadow-2xs">
              <Money value={sts.perDay} tone="plain" /> / day
            </span>
            <span className="text-xs font-normal text-muted">
              for {sts.daysLeft} {sts.daysLeft === 1 ? 'day' : 'days'} (until {formatDay(sts.until)})
            </span>
          </div>

          {/* Action pills row */}
          <div className="mt-5 flex flex-wrap items-center gap-2 pt-3.5 border-t border-line/50">
            <button
              type="button"
              onClick={() => setShowMath((v) => !v)}
              className="flex items-center gap-1 rounded-lg border border-line/50 bg-raised/40 px-2.5 py-1 text-xs font-medium text-muted hover:border-line hover:text-ink transition-colors active:scale-[0.98]"
            >
              <span>{showMath ? 'Hide math' : 'Breakdown'}</span>
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', showMath && 'rotate-180')} />
            </button>

            <button
              type="button"
              onClick={() => setShowRunway((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors active:scale-[0.98]',
                showRunway
                  ? 'border-accent/50 bg-accent/10 text-accent font-semibold'
                  : 'border-line/50 bg-raised/40 text-muted hover:border-line hover:text-ink',
              )}
            >
              <TrendingUp className="h-3.5 w-3.5 text-accent" />
              <span>{showRunway ? 'Hide forecast' : 'Runway forecast'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSimulator(true)}
              className="flex items-center gap-1.5 rounded-lg border border-line/50 bg-raised/40 px-2.5 py-1 text-xs font-medium text-muted hover:border-line hover:text-ink transition-colors active:scale-[0.98]"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>What-If simulator</span>
            </button>

            <button
              type="button"
              onClick={handleQuickAdd}
              className="ml-auto flex items-center gap-1 rounded-lg bg-accent text-accent-ink px-3 py-1 text-xs font-semibold shadow-xs hover:opacity-95 active:scale-[0.98] transition-all"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              Quick Log
            </button>
          </div>

          {showMath ? (
            <dl className="mt-3.5 space-y-2 rounded-xl bg-surface/90 border border-line/60 p-3.5 text-xs font-medium animate-in fade-in zoom-in-95 duration-150">
              <MathRow label="In spendable accounts" value={sts.liquid} />
              <MathRow label="Bills due before then" value={-sts.committedBills} />
              <MathRow label="Reserved for needs you budgeted" value={-sts.reservedNeeds} />
              <MathRow label="Going to savings goals" value={-sts.goalFunding} />
              <Divider className="my-2" />
              <MathRow label="Safe to spend" value={sts.amount} strong />
              <p className="pt-1 text-[11px] leading-relaxed text-muted font-normal">
                Savings accounts and reserved funds are excluded to protect your daily runway pace.
              </p>
            </dl>
          ) : null}
        </div>
      </div>

      {/* Runway Graph Drawer */}
      {showRunway ? (
        <RunwayChart
          projection={projection}
          today={day}
          until={sts.until}
        />
      ) : null}

      {/* Bento Metric Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="group relative overflow-hidden rounded-xl border border-line/60 bg-surface/80 p-4 transition-all duration-200 hover:border-line shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted">Spent today</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-orange-500/10 text-orange-500 shadow-2xs">
              <Flame className="h-3.5 w-3.5" />
            </span>
          </div>
          <Money
            value={spentToday}
            className="mt-2.5 block text-2xl font-bold text-ink tnum"
            tone="plain"
            animate
          />
          <p className="mt-1 text-[11px] text-muted">
            {sts.perDay > 0
              ? spentToday > sts.perDay
                ? 'Above daily allowance pace'
                : 'Within daily allowance pace'
              : 'Discretionary spend'}
          </p>
        </div>

        <div className="group relative overflow-hidden rounded-xl border border-line/60 bg-surface/80 p-4 transition-all duration-200 hover:border-line shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted">This week</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-500/10 text-teal-500 shadow-2xs">
              <TrendingDown className="h-3.5 w-3.5" />
            </span>
          </div>
          <Money
            value={spentThisWeek}
            className="mt-2.5 block text-2xl font-bold text-ink tnum"
            tone="plain"
            animate
          />
          <p className="mt-1 text-[11px] text-muted">Cumulative 7-day outgo</p>
        </div>
      </div>

      {/* Dip Warning if forecast drops underwater */}
      {dip ? (
        <Card className="border-warn/40 bg-warn/10 p-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-warn/20 text-warn">
              <TrendingDown className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">
                You go below zero on {formatDayFull(dip.crossing.date)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Counting only recurring bills and scheduled income, your spendable
                money bottoms out at{' '}
                <Money value={dip.worst.balance} signed className="font-bold text-ink" /> around{' '}
                {formatDay(dip.worst.date)}.
              </p>
              {dip.crossing.events.length > 0 ? (
                <p className="mt-1.5 text-[11px] font-medium text-faint">
                  Due that day: {dip.crossing.events.map((event) => event.label).join(' · ')}
                </p>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {/* Weekly Review Callout */}
      {needsReview ? (
        <button
          type="button"
          onClick={() => setReviewing(true)}
          className="group flex w-full items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3.5 text-left transition-all hover:bg-accent/15 hover:shadow-xs active:scale-[0.99]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent">
            <ListChecks className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-ink">Your weekly five minutes</span>
            <span className="block text-xs text-muted">
              {pending.length} {pending.length === 1 ? 'transaction needs' : 'transactions need'} a review
            </span>
          </span>
          <ArrowUpRight className="h-4 w-4 text-accent transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
      ) : null}

      {/* Upcoming Bills */}
      {bills.length > 0 ? (
        <Section title="Next seven days">
          <Card className="stagger divide-y divide-line/50 overflow-hidden rounded-xl border border-line/60 bg-surface/60 shadow-xs">
            {bills.map((bill) => (
              <div
                key={`${bill.recurring.id}-${bill.dueDate}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-raised/50 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setEditingRecurring(bill.recurring)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left active:scale-[0.99] transition-transform"
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-2xs',
                      bill.overdue
                        ? 'border-bad/30 bg-bad/15 text-bad'
                        : 'border-line/60 bg-raised text-muted',
                    )}
                  >
                    {bill.overdue ? (
                      <TriangleAlert className="h-4 w-4" />
                    ) : (
                      <Receipt className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {bill.recurring.description}
                    </span>
                    <span className="block text-xs text-muted">
                      {formatDueIn(bill.dueDate, day)}
                      {bill.recurring.variableAmount ? ' · amount varies' : ''}
                    </span>
                  </span>
                </button>
                <span className="flex shrink-0 items-center gap-2.5">
                  <span className="text-sm font-semibold text-ink tnum">
                    <Money value={bill.amount} tone="plain" />
                  </span>
                  {!bill.recurring.autoPost ? (
                    <button
                      type="button"
                      onClick={() => void postRecurring(bill.recurring)}
                      className="rounded-lg border border-line/60 bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:border-accent hover:text-accent transition-all active:scale-95 shadow-2xs"
                    >
                      Paid
                    </button>
                  ) : null}
                </span>
              </div>
            ))}
          </Card>
        </Section>
      ) : null}

      {/* Latest Entries List */}
      <Section
        title="Latest Spends"
        action={
          recent.length > 0 ? (
            <button
              type="button"
              onClick={handleQuickAdd}
              className="text-xs font-semibold text-accent hover:underline flex items-center gap-1 active:scale-95"
            >
              <Plus className="h-3 w-3" /> Add spend
            </button>
          ) : undefined
        }
      >
        {quiet !== null && quiet >= 3 ? (
          <p className="px-1 text-xs text-muted">
            Nothing logged for {quiet} days. Logging the big spends keeps your Safe to Spend honest.
          </p>
        ) : null}
        <Card className="stagger divide-y divide-line/50 overflow-hidden rounded-xl border border-line/60 bg-surface/60 shadow-xs">
          {recent.length === 0 ? (
            <Empty
              icon={<Wallet className="h-6 w-6" />}
              title="Nothing logged yet"
              hint="Tap '+ Quick Log' and type naturally — '280 chai' or paste your bank debit SMS."
              action={
                <button
                  type="button"
                  onClick={handleQuickAdd}
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-black text-accent-ink shadow-xs transition-all active:scale-95"
                >
                  Log first entry
                </button>
              }
            />
          ) : (
            recent.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                categories={categories}
                accounts={accounts}
                onOpen={setEditing}
                showDate
              />
            ))
          )}
        </Card>
      </Section>

      {ledger.accounts.length > 0 ? (
        <p className="px-1 text-xs text-faint">
          Across all accounts you hold{' '}
          <Money
            value={liquidBalance(ledger.accounts, ledger.entries)}
            className="text-muted font-semibold"
            tone="plain"
          />{' '}
          in spendable money.
        </p>
      ) : null}

      <EntrySheet entry={editing} onClose={() => setEditing(null)} />
      <RecurringSheet
        recurring={editingRecurring}
        open={editingRecurring !== null}
        onClose={() => setEditingRecurring(null)}
      />
      <ReviewSheet open={reviewing} onClose={() => setReviewing(false)} />
      <WalkthroughDialog open={showTour} onClose={() => setShowTour(false)} />
      <SimulatorSheet open={showSimulator} onClose={() => setShowSimulator(false)} />
    </div>
  );
}

function MathRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn('text-muted', strong && 'font-bold text-ink')}>{label}</dt>
      <dd>
        <Money
          value={value}
          signed={!strong}
          tone={strong ? 'plain' : 'auto'}
          className={cn(strong && 'font-extrabold')}
        />
      </dd>
    </div>
  );
}

function greetingText(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}
