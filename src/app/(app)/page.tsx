'use client';

import {
  ChevronDown,
  Flame,
  HelpCircle,
  ListChecks,
  Receipt,
  TrendingDown,
  TriangleAlert,
  Wallet,
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
import type { Entry } from '@/domain/types';
import { EntryRow } from '@/components/entry/entry-row';
import { EntrySheet } from '@/components/entry/entry-sheet';
import { RecurringSheet } from '@/components/plan/recurring-sheet';
import { ReviewSheet } from '@/components/review/review-sheet';
import { GettingStartedCard } from '@/components/shell/getting-started-card';
import { RunwayChart } from '@/components/shell/runway-chart';
import { WalkthroughDialog } from '@/components/shell/walkthrough-dialog';
import { Card, Divider, Empty, Section } from '@/components/ui/card';
import { Money, Badge } from '@/components/ui/money';
import { useLedger } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { Recurring } from '@/domain/types';

export default function TodayPage() {
  const { ledger, postRecurring } = useLedger();
  const [editing, setEditing] = useState<Entry | null>(null);
  const [editingRecurring, setEditingRecurring] = useState<Recurring | null>(null);
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [showMath, setShowMath] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showRunway, setShowRunway] = useState(false);

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

  /*
   * The dip.
   *
   * Only recurring events are modelled, so this is the optimistic version of
   * the future — day-to-day spending is not in it. That error runs one way,
   * which happens to be the useful way: if even the optimistic line goes under,
   * it really does go under. The warning has no false alarms, only silences.
   */
  const dip = useMemo(() => {
    const worst = lowestPoint(projection);
    if (!worst || worst.balance >= 0) return null;

    const crossing = projection.find((entry) => entry.balance < 0);
    // Being underwater today is not a forecast, and Safe to Spend has already
    // said so a few inches above this, in much larger type.
    if (!crossing || crossing.date === day) return null;

    return { crossing, worst };
  }, [projection, day]);

  // Said once, quietly, and never as a number large enough to feel like an
  // accusation. Null when there is nothing logged at all — that is the empty
  // state's job, not a nudge's.
  const quiet = useMemo(() => daysSinceLastEntry(ledger.entries, day), [ledger.entries, day]);

  const recent = useMemo(
    () =>
      [...ledger.entries]
        .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)))
        .slice(0, 8),
    [ledger.entries],
  );

  const name = ledger.prefs.displayName?.split(' ')[0];

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[13px] text-faint">{formatDayFull(day)}</p>
          <h1 className="text-xl font-semibold tracking-tight">
            {greeting()}
            {name ? `, ${name}` : ''}
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          {streak > 1 ? (
            <span className="flex items-center gap-1 rounded-full bg-raised px-2.5 py-1 text-[12px] font-medium text-muted">
              <Flame className="h-3.5 w-3.5 text-warn" />
              {streak} days
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setShowTour(true)}
            aria-label="How KharchGini works"
            title="How KharchGini works"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-ink transition-colors"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Quick-start checklist for new accounts */}
      <GettingStartedCard
        onOpenTour={() => setShowTour(true)}
        onOpenAdd={() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));
        }}
      />

      {/* The hero. Everything else on this screen exists to explain it. */}
      <div
        className={cn(
          'relative overflow-hidden rounded-3xl border bg-gradient-to-br from-surface via-surface to-raised/90 p-5 shadow-sm transition-all',
          sts.negative ? 'border-bad/40 bg-bad/5' : 'border-line hover:border-accent/30',
        )}
      >
        {/* Subtle Ambient Radial Glow */}
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full blur-3xl opacity-30"
          style={{
            background: sts.negative
              ? 'radial-gradient(circle, rgba(239,68,68,0.5) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(16,185,129,0.5) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Safe to Spend
            </span>
            {sts.negative ? (
              <Badge tone="bad" className="font-semibold shadow-xs">Deficit Risk</Badge>
            ) : sts.perDay >= 50_000 ? (
              <Badge tone="good" className="font-semibold shadow-xs">Healthy Runway</Badge>
            ) : (
              <Badge tone="warn" className="font-semibold shadow-xs">Tight Pace</Badge>
            )}
          </div>

          <div className="mt-2.5 flex items-baseline gap-2">
            <Money
              value={sts.amount}
              className={cn(
                'text-3xl sm:text-4xl font-extrabold tracking-tight',
                sts.negative ? 'text-bad' : 'text-ink',
              )}
              tone="plain"
              animate
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg bg-raised/90 border border-line/60 px-2.5 py-1 text-xs text-ink font-semibold">
              <Money value={sts.perDay} tone="plain" /> / day
            </span>
            <span className="text-xs text-muted">
              for {sts.daysLeft} {sts.daysLeft === 1 ? 'day' : 'days'} (until {formatDay(sts.until)})
            </span>
          </div>

          {/* Action pills row */}
          <div className="mt-4 flex items-center gap-2 pt-2 border-t border-line/60">
            <button
              type="button"
              onClick={() => setShowMath((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-line/80 bg-raised/70 px-3 py-1.5 text-xs font-medium text-muted hover:border-accent/40 hover:bg-surface hover:text-ink transition-all active:scale-95"
            >
              {showMath ? 'Hide breakdown' : 'Why this number?'}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', showMath && 'rotate-180')} />
            </button>
            <button
              type="button"
              onClick={() => setShowRunway((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-line/80 bg-raised/70 px-3 py-1.5 text-xs font-medium text-accent hover:border-accent/50 hover:bg-accent/10 transition-all active:scale-95 ml-auto"
            >
              {showRunway ? 'Hide graph' : 'Runway graph 📈'}
            </button>
          </div>

          {showMath ? (
            <dl className="mt-3 space-y-1.5 rounded-2xl bg-surface/90 border border-line/70 p-3.5 text-[13px] animate-in fade-in zoom-in-95 duration-150">
              <MathRow label="In spendable accounts" value={sts.liquid} />
              <MathRow label="Bills due before then" value={-sts.committedBills} />
              <MathRow label="Reserved for needs you budgeted" value={-sts.reservedNeeds} />
              <MathRow label="Going to goals" value={-sts.goalFunding} />
              <Divider className="my-1.5" />
              <MathRow label="Safe to spend" value={sts.amount} strong />
              <p className="pt-1 text-[12px] leading-relaxed text-faint">
                Savings accounts and anything marked as set aside are not counted here, even though they are yours.
              </p>
            </dl>
          ) : null}
        </div>
      </div>

      {/* Runway Graph */}
      {showRunway ? (
        <RunwayChart
          projection={projection}
          today={day}
          until={sts.until}
        />
      ) : null}

      {/*
       * Directly under the hero, because it qualifies the hero: Safe to Spend
       * answers "today", and this answers "and then what". A tracker never
       * gets to this question; it is the whole reason people keep spreadsheets.
       */}
      {dip ? (
        <Card className="border-warn/40 bg-warn/8 px-4 py-3.5">
          <div className="flex items-start gap-3">
            <TrendingDown className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                You go below zero on {formatDayFull(dip.crossing.date)}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Counting only the bills and income you have told the app about, your spendable
                money bottoms out at{' '}
                <Money value={dip.worst.balance} signed className="font-medium" /> around{' '}
                {formatDay(dip.worst.date)}. Everyday spending is not in that figure, so this is
                the optimistic version.
              </p>
              {dip.crossing.events.length > 0 ? (
                <p className="mt-1.5 text-[12px] text-faint">
                  Due that day: {dip.crossing.events.map((event) => event.label).join(' · ')}
                </p>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {needsReview ? (
        <button
          type="button"
          onClick={() => setReviewing(true)}
          className="flex w-full items-center gap-3 rounded-card border border-accent/30 bg-accent/8 px-4 py-3 text-left transition-colors hover:bg-accent/12"
        >
          <ListChecks className="h-5 w-5 shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-ink">Your weekly five minutes</span>
            <span className="block text-[13px] text-muted">
              {pending.length} {pending.length === 1 ? 'thing needs' : 'things need'} a decision
            </span>
          </span>
        </button>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="group relative overflow-hidden rounded-2xl border border-line bg-surface/90 p-4 transition-all duration-200 hover:border-line/80 hover:bg-raised/50 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">Spent today</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
              <Flame className="h-3.5 w-3.5" />
            </span>
          </div>
          <Money
            value={spentToday}
            className="mt-2 block text-xl font-bold text-ink"
            tone="plain"
            animate
          />
        </div>
        <div className="group relative overflow-hidden rounded-2xl border border-line bg-surface/90 p-4 transition-all duration-200 hover:border-line/80 hover:bg-raised/50 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">This week</span>
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-500/10 text-teal-500">
              <TrendingDown className="h-3.5 w-3.5" />
            </span>
          </div>
          <Money
            value={spentThisWeek}
            className="mt-2 block text-xl font-bold text-ink"
            tone="plain"
            animate
          />
        </div>
      </div>

      {bills.length > 0 ? (
        <Section title="Next seven days">
          <Card className="stagger divide-y divide-line overflow-hidden">
            {bills.map((bill) => (
              <div
                key={`${bill.recurring.id}-${bill.dueDate}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-raised/50 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setEditingRecurring(bill.recurring)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                      bill.overdue ? 'bg-bad/12 text-bad' : 'bg-raised text-muted',
                    )}
                  >
                    {bill.overdue ? (
                      <TriangleAlert className="h-4 w-4" />
                    ) : (
                      <Receipt className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink font-medium">
                      {bill.recurring.description}
                    </span>
                    <span className="block text-[12px] text-faint">
                      {formatDueIn(bill.dueDate, day)}
                      {bill.recurring.variableAmount ? ' · amount varies' : ''}
                    </span>
                  </span>
                </button>
                <span className="flex shrink-0 items-center gap-2">
                  <Money value={bill.amount} className="text-sm" tone="plain" />
                  {!bill.recurring.autoPost ? (
                    <button
                      type="button"
                      onClick={() => void postRecurring(bill.recurring)}
                      className="rounded-lg bg-raised px-2.5 py-1 text-[12px] font-medium text-ink hover:bg-line transition-colors active:scale-95"
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

      <Section title="Latest">
        {quiet !== null && quiet >= 3 ? (
          <p className="px-1 text-[12px] text-faint">
            Nothing logged for {quiet} days. Even adding the one big thing you remember keeps the
            rest of this screen honest.
          </p>
        ) : null}
        <Card className="stagger divide-y divide-line overflow-hidden">
          {recent.length === 0 ? (
            <Empty
              icon={<Wallet className="h-6 w-6" />}
              title="Nothing here yet"
              hint="Tap the + and type it the way you would say it — “280 chai”. That is the whole interface."
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
        <p className="px-1 text-[12px] text-faint">
          Across all accounts you hold{' '}
          <Money
            value={liquidBalance(ledger.accounts, ledger.entries)}
            className="text-muted"
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
      <dt className={cn('text-muted', strong && 'font-medium text-ink')}>{label}</dt>
      <dd>
        <Money
          value={value}
          signed={!strong}
          tone={strong ? 'plain' : 'auto'}
          className={cn(strong && 'font-semibold')}
        />
      </dd>
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}
