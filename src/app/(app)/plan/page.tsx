'use client';

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  Plus,
  Repeat,
  Sparkles,
  Target,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  addMonthsToKey,
  currentMonth,
  formatDay,
  formatMonth,
  monthOf,
  today as todayISO,
  type MonthKey,
} from '@/domain/dates';
import {
  envelopeStatuses,
  goalProgresses,
  monthSummary,
  unbudgetedSpend,
} from '@/domain/derive';
import { formatMoney } from '@/domain/money';
import { describeSchedule, dueInMonth, monthlyEquivalent } from '@/domain/recurring';
import type { EnvelopeStatus, Goal, GoalProgress, Recurring } from '@/domain/types';
import { CategoryChip, CategoryIcon } from '@/components/category/category-icon';
import { CategoryEntriesSheet } from '@/components/category/category-entries-sheet';
import { EnvelopeSheet } from '@/components/plan/envelope-sheet';
import { GoalSheet } from '@/components/plan/goal-sheet';
import { RecurringSheet } from '@/components/plan/recurring-sheet';
import { SimulatorSheet } from '@/components/simulator/simulator-sheet';
import { Button } from '@/components/ui/button';
import { Card, Empty, Section } from '@/components/ui/card';
import { Bar, Badge, Money } from '@/components/ui/money';
import { useToast } from '@/components/ui/toast';
import { useLedger } from '@/lib/store';
import { cn } from '@/lib/utils';

export default function PlanPage() {
  const { ledger, copyEnvelopes } = useLedger();
  const toast = useToast();

  const day = todayISO();
  const [month, setMonth] = useState<MonthKey>(currentMonth());

  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(null);
  const [envelopeFor, setEnvelopeFor] = useState<{ open: boolean; categoryId: string | null }>({
    open: false,
    categoryId: null,
  });
  const [goal, setGoal] = useState<Goal | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [rule, setRule] = useState<Recurring | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  const envelopes = useMemo(() => envelopeStatuses(ledger, month, day), [ledger, month, day]);
  const unbudgeted = useMemo(() => unbudgetedSpend(ledger, month), [ledger, month]);
  const summary = useMemo(() => monthSummary(ledger, month), [ledger, month]);
  const goals = useMemo(() => goalProgresses(ledger, day), [ledger, day]);
  const bills = useMemo(() => dueInMonth(ledger.recurring, month), [ledger.recurring, month]);

  const allocated = envelopes.reduce((total, status) => total + status.allocated, 0);
  const spentInEnvelopes = envelopes.reduce((total, status) => total + status.spent, 0);
  const committedMonthly = ledger.recurring
    .filter((r) => r.isActive && r.direction === 'out')
    .reduce((total, r) => total + monthlyEquivalent(r), 0);

  const isCurrent = month === monthOf(day);
  const previous = addMonthsToKey(month, -1);

  const copyForward = async () => {
    try {
      const count = await copyEnvelopes(previous, month);
      toast(
        count > 0
          ? `${count} ${count === 1 ? 'budget' : 'budgets'} carried over.`
          : 'Nothing to copy from last month.',
        { tone: count > 0 ? 'good' : 'info' },
      );
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not copy.', { tone: 'bad' });
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-2 px-1">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Plan & Budgets</h1>
          <p className="text-xs text-muted">Envelopes, recurring commitments & saving goals</p>
        </div>
        <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface/90 p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setMonth(addMonthsToKey(month, -1))}
            aria-label="Previous month"
            className="rounded-xl p-1.5 text-muted hover:bg-raised hover:text-ink transition-colors active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMonth(currentMonth())}
            className={cn(
              'min-w-[7.5rem] rounded-xl px-2.5 py-1 text-center text-xs font-bold transition-all active:scale-95',
              isCurrent ? 'bg-raised text-ink' : 'text-accent hover:bg-raised',
            )}
            title={isCurrent ? undefined : 'Back to current month'}
          >
            {formatMonth(month)}
          </button>
          <button
            type="button"
            onClick={() => setMonth(addMonthsToKey(month, 1))}
            aria-label="Next month"
            className="rounded-xl p-1.5 text-muted hover:bg-raised hover:text-ink transition-colors active:scale-95"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Budgeted vs Spent Overview */}
      <Card className="p-5 shadow-card space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <CalendarDays className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-muted">
              Monthly Budgeted
            </span>
          </div>
          <Money value={allocated} className="text-xl font-black text-ink" tone="plain" />
        </div>

        <Bar value={spentInEnvelopes} max={allocated} className="h-2.5" />

        <div className="flex flex-wrap items-center justify-between text-xs text-muted pt-1">
          <span className="font-semibold text-ink">
            <Money value={spentInEnvelopes} tone="plain" /> spent in envelopes
          </span>
          {summary.income > 0 ? (
            <span>
              {allocated > summary.income ? (
                <span className="text-bad font-semibold">Over-allocated vs income</span>
              ) : (
                <span>
                  <Money value={summary.income - allocated} tone="plain" className="font-bold text-ink" /> unallocated
                </span>
              )}
            </span>
          ) : (
            <span className="text-faint">Income not recorded yet</span>
          )}
        </div>
      </Card>

      {/* ‘What-If’ Sandbox Simulator Banner */}
      <div className="rounded-3xl border border-accent/40 bg-gradient-to-br from-accent/10 via-surface to-raised/90 p-5 shadow-card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/20 text-accent shadow-2xs">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight text-ink">
                  ‘What-If’ Sandbox Simulator
                </h3>
                <Badge tone="good">In-Memory</Badge>
              </div>
              <p className="text-xs text-muted mt-0.5 max-w-md leading-relaxed">
                Test major life decisions (gadgets, EMI plans, salary hikes, rent increases) and instantly see how your Safe to Spend runway & goal timelines adapt.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setSimulatorOpen(true)}
            className="font-extrabold gap-1.5 shadow-sm active:scale-95"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Launch Simulator
          </Button>
        </div>
      </div>

      {/* Envelopes Section */}
      <Section
        title="Envelopes"
        action={
          <div className="flex items-center gap-1.5">
            {envelopes.length === 0 ? (
              <Button size="sm" variant="ghost" onClick={copyForward} className="text-xs">
                <CopyPlus className="h-3.5 w-3.5" />
                Copy last month
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEnvelopeFor({ open: true, categoryId: null })}
              className="text-xs font-bold gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add budget
            </Button>
          </div>
        }
      >
        {envelopes.length === 0 ? (
          <Card className="shadow-card">
            <Empty
              icon={<Wallet className="h-6 w-6" />}
              title="No budgets for this month"
              hint="Budget 2 or 3 flexible categories that matter — dining, groceries, shopping. Keep it simple and maintainable."
            />
          </Card>
        ) : (
          <Card className="stagger divide-y divide-line overflow-hidden shadow-card">
            {envelopes.map((status) => (
              <EnvelopeRow
                key={status.envelope.id}
                status={status}
                current={isCurrent}
                onOpen={() => setDrilldownCategory(status.envelope.categoryId)}
                onEditBudget={() =>
                  setEnvelopeFor({ open: true, categoryId: status.envelope.categoryId })
                }
              />
            ))}
          </Card>
        )}
      </Section>

      {/* Unbudgeted Spending Callout */}
      {unbudgeted.length > 0 ? (
        <Section title="Spending with no budget">
          <Card className="divide-y divide-line overflow-hidden shadow-card">
            {unbudgeted.slice(0, 6).map((row) => (
              <div
                key={row.categoryId ?? 'none'}
                className="flex w-full items-center gap-3 px-4 py-3 hover:bg-raised/60 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setDrilldownCategory(row.categoryId ?? '')}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <CategoryChip name={row.category?.icon} color={row.category?.color} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {row.category?.name ?? 'Uncategorised'}
                    </span>
                    <span className="block text-xs text-faint">
                      {row.count} {row.count === 1 ? 'entry' : 'entries'} · tap to view
                    </span>
                  </span>
                </button>
                <Money value={row.total} className="shrink-0 text-sm font-bold text-ink" tone="plain" />
                {row.categoryId ? (
                  <button
                    type="button"
                    onClick={() =>
                      setEnvelopeFor({ open: true, categoryId: row.categoryId ?? null })
                    }
                    title="Set budget"
                    className="flex h-8 items-center gap-1 rounded-xl border border-line bg-surface px-2.5 text-xs font-bold text-muted hover:border-accent hover:text-accent transition-all active:scale-95 shadow-2xs"
                  >
                    <Plus className="h-3 w-3" /> Budget
                  </button>
                ) : null}
              </div>
            ))}
          </Card>
        </Section>
      ) : null}

      {/* Goals Section */}
      <Section
        title="Goals & Funds"
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setGoal(null);
              setGoalOpen(true);
            }}
            className="text-xs font-bold gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add goal
          </Button>
        }
      >
        {goals.length === 0 ? (
          <Card className="shadow-card">
            <Empty
              icon={<Target className="h-6 w-6" />}
              title="Nothing being saved for"
              hint="A goal here connects to a dedicated savings or liquid account so your progress updates in real time."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {goals.map((progress) => {
              const pct =
                Math.min(100, Math.round((progress.saved / progress.goal.targetAmount) * 100)) || 0;
              return (
                <button
                  key={progress.goal.id}
                  type="button"
                  onClick={() => {
                    setGoal(progress.goal);
                    setGoalOpen(true);
                  }}
                  className="group relative flex flex-col justify-between rounded-3xl border border-line bg-surface/95 p-4 sm:p-5 text-left transition-all duration-200 hover:border-accent/50 hover:bg-raised/60 hover:shadow-card active:scale-[0.98] shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/25 text-amber-500 shadow-2xs">
                      <CategoryIcon name={progress.goal.icon} color="#f59e0b" className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-raised border border-line/70 px-2.5 py-1 text-xs font-black text-ink group-hover:text-accent transition-colors shadow-2xs">
                      {pct}%
                    </span>
                  </div>

                  <div className="mt-3.5">
                    <h4 className="truncate text-base font-extrabold text-ink">
                      {progress.goal.name}
                    </h4>
                    {progress.goal.targetDate ? (
                      <p className="text-xs text-faint mt-0.5">
                        Target: {formatDay(progress.goal.targetDate)}
                      </p>
                    ) : (
                      <p className="text-xs text-faint mt-0.5">Ongoing fund</p>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-extrabold text-ink">
                        {formatMoney(progress.saved)}
                      </span>
                      <span className="text-faint font-medium">
                        of {formatMoney(progress.goal.targetAmount)}
                      </span>
                    </div>
                    <Bar
                      value={progress.saved}
                      max={progress.goal.targetAmount}
                      tone={progress.onTrack === false ? 'warn' : 'good'}
                      className="h-2 rounded-full"
                    />
                    <p className="text-[11px] text-faint truncate pt-0.5 font-medium">
                      {goalLine(progress)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Section>

      {/* Repeats & Scheduled Rules */}
      <Section
        title="Repeats & Recurring"
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setRule(null);
              setRuleOpen(true);
            }}
            className="text-xs font-bold gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            Add rule
          </Button>
        }
      >
        {ledger.recurring.length === 0 ? (
          <Card className="shadow-card">
            <Empty
              icon={<Repeat className="h-6 w-6" />}
              title="Nothing on a schedule"
              hint="Rent, EMIs, SIPs, salary, OTT subscriptions. Adding them models your runway forecast accurately."
            />
          </Card>
        ) : (
          <>
            <Card className="divide-y divide-line overflow-hidden shadow-card">
              {[...ledger.recurring]
                .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate))
                .map((item) => {
                  const inMonth = bills.filter((b) => b.recurring.id === item.id).length;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setRule(item);
                        setRuleOpen(true);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-raised/60"
                    >
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-2xs',
                          item.direction === 'in'
                            ? 'border-good/30 bg-good/15 text-good'
                            : 'border-line bg-raised/80 text-muted',
                        )}
                      >
                        <Repeat className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold text-ink">{item.description}</span>
                          {!item.isActive ? <Badge>paused</Badge> : null}
                          {item.variableAmount ? <Badge tone="warn">varies</Badge> : null}
                        </span>
                        <span className="block truncate text-xs text-faint mt-0.5">
                          {describeSchedule(item)} · next {formatDay(item.nextDueDate)}
                          {inMonth > 1 ? ` · ${inMonth}× this month` : ''}
                        </span>
                      </span>
                      <Money
                        value={item.amount}
                        className="shrink-0 text-sm font-bold"
                        tone={item.direction === 'in' ? 'good' : 'plain'}
                      />
                    </button>
                  );
                })}
            </Card>
            {committedMonthly > 0 ? (
              <p className="flex items-center gap-1.5 px-1 text-xs text-faint">
                <TrendingDown className="h-3.5 w-3.5" />
                {formatMoney(committedMonthly)} a month is committed before discretionary decisions.
              </p>
            ) : null}
          </>
        )}
      </Section>

      <CategoryEntriesSheet
        categoryId={drilldownCategory}
        month={month}
        open={drilldownCategory !== null}
        onClose={() => setDrilldownCategory(null)}
        onAddEntry={() => {
          window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));
        }}
      />
      <EnvelopeSheet
        month={month}
        categoryId={envelopeFor.categoryId}
        open={envelopeFor.open}
        onClose={() => setEnvelopeFor({ open: false, categoryId: null })}
      />
      <GoalSheet goal={goal} open={goalOpen} onClose={() => setGoalOpen(false)} />
      <RecurringSheet recurring={rule} open={ruleOpen} onClose={() => setRuleOpen(false)} />
      <SimulatorSheet open={simulatorOpen} onClose={() => setSimulatorOpen(false)} />
    </div>
  );
}

function EnvelopeRow({
  status,
  current,
  onOpen,
  onEditBudget,
}: {
  status: EnvelopeStatus;
  current: boolean;
  onOpen: () => void;
  onEditBudget?: () => void;
}) {
  const over = status.remaining < 0;

  return (
    <div className="flex w-full items-start gap-3.5 px-4 py-3.5 hover:bg-raised/60 transition-colors group">
      <button
        type="button"
        onClick={onOpen}
        className="flex items-start gap-3.5 min-w-0 flex-1 text-left"
      >
        <CategoryChip name={status.category?.icon} color={status.category?.color} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-bold text-ink">
                {status.category?.name ?? 'Unknown category'}
              </span>
              {status.envelope.rollover && status.carriedIn !== 0 ? (
                <Badge tone={status.carriedIn > 0 ? 'good' : 'bad'}>
                  {status.carriedIn > 0 ? '+' : ''}
                  {formatMoney(status.carriedIn)} carried
                </Badge>
              ) : null}
            </span>
            <span className="shrink-0 text-xs font-semibold text-muted">
              <Money value={status.spent} tone="plain" /> / <Money value={status.available} tone="plain" />
            </span>
          </span>

          <Bar
            value={status.spent}
            max={status.available}
            tone={over ? 'bad' : status.paceAhead ? 'warn' : 'good'}
            className="mt-2.5"
          />

          <span className="mt-2 flex items-center justify-between text-xs text-muted">
            <span>
              {over ? (
                <span className="text-bad font-black">
                  {formatMoney(Math.abs(status.remaining))} over budget
                </span>
              ) : current && status.dailyAllowance > 0 ? (
                <>
                  <span className="font-bold text-ink">{formatMoney(status.remaining)}</span> left · {formatMoney(status.dailyAllowance)} a day
                  {status.paceAhead ? (
                    <span className="text-warn font-black"> · ahead of pace</span>
                  ) : null}
                </>
              ) : (
                <span className="font-semibold">{formatMoney(status.remaining)} left</span>
              )}
            </span>
            <span className="text-accent opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold">
              View entries →
            </span>
          </span>
        </span>
      </button>

      {onEditBudget ? (
        <button
          type="button"
          onClick={onEditBudget}
          title="Adjust monthly allocation"
          className="mt-0.5 rounded-xl border border-line bg-surface px-2.5 py-1 text-xs font-bold text-muted hover:border-accent hover:text-accent transition-all shadow-2xs active:scale-95"
        >
          Edit
        </button>
      ) : null}
    </div>
  );
}

function goalLine(progress: GoalProgress): string {
  if (progress.remaining === 0) return 'Done! Target reached.';

  const need =
    progress.requiredPerWeek !== null
      ? `${formatMoney(progress.requiredPerWeek)} a week gets you there`
      : null;

  if (progress.goal.targetDate && need) {
    if (progress.onTrack === true) return `On track — ${need}.`;
    if (progress.projectedDate === null) return `Nothing has gone in yet. ${capitalise(need)}.`;
    return `Arrives ${formatDay(progress.projectedDate)} at this rate. ${capitalise(need)}.`;
  }

  if (progress.projectedDate) {
    return `${formatMoney(progress.remaining)} to go — around ${formatDay(progress.projectedDate)} at this pace.`;
  }

  return `${formatMoney(progress.remaining)} to go.`;
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
