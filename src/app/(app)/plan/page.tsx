'use client';

import {
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  Plus,
  Repeat,
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
import { CategoryChip } from '@/components/category/category-icon';
import { EnvelopeSheet } from '@/components/plan/envelope-sheet';
import { GoalSheet } from '@/components/plan/goal-sheet';
import { RecurringSheet } from '@/components/plan/recurring-sheet';
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

  const [envelopeFor, setEnvelopeFor] = useState<{ open: boolean; categoryId: string | null }>({
    open: false,
    categoryId: null,
  });
  const [goal, setGoal] = useState<Goal | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [rule, setRule] = useState<Recurring | null>(null);
  const [ruleOpen, setRuleOpen] = useState(false);

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
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-2 px-1">
        <h1 className="text-xl font-semibold tracking-tight">Plan</h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMonth(addMonthsToKey(month, -1))}
            aria-label="Previous month"
            className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMonth(currentMonth())}
            className={cn(
              'min-w-[7.5rem] rounded-lg px-2 py-1 text-center text-[13px] font-medium',
              isCurrent ? 'text-ink' : 'text-accent hover:bg-raised',
            )}
            title={isCurrent ? undefined : 'Back to this month'}
          >
            {formatMonth(month)}
          </button>
          <button
            type="button"
            onClick={() => setMonth(addMonthsToKey(month, 1))}
            aria-label="Next month"
            className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-ink"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Budgeted versus earned, stated plainly. */}
      <Card className="px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-muted">Budgeted this month</span>
          <Money value={allocated} className="text-lg font-semibold" tone="plain" />
        </div>
        <Bar value={spentInEnvelopes} max={allocated} className="mt-2" />
        <p className="mt-2 text-[12px] leading-relaxed text-faint">
          <Money value={spentInEnvelopes} className="text-muted" tone="plain" /> spent so far.
          {summary.income > 0 ? (
            <>
              {' '}You took in <Money value={summary.income} className="text-muted" tone="plain" />
              {allocated > summary.income ? (
                <span className="text-bad"> — you have budgeted more than that.</span>
              ) : (
                <>
                  , leaving{' '}
                  <Money value={summary.income - allocated} className="text-muted" tone="plain" />{' '}
                  unplanned.
                </>
              )}
            </>
          ) : null}
        </p>
      </Card>

      <Section
        title="Envelopes"
        action={
          <div className="flex items-center gap-1">
            {envelopes.length === 0 ? (
              <Button size="sm" variant="ghost" onClick={copyForward}>
                <CopyPlus className="h-3.5 w-3.5" />
                Copy last month
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEnvelopeFor({ open: true, categoryId: null })}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        }
      >
        {envelopes.length === 0 ? (
          <Card>
            <Empty
              icon={<Wallet className="h-6 w-6" />}
              title="No budgets for this month"
              hint="Budget two or three categories that actually vary — food, transport, whatever you keep wondering about. Budgeting everything is how people quit."
            />
          </Card>
        ) : (
          <Card className="stagger divide-y divide-line overflow-hidden">
            {envelopes.map((status) => (
              <EnvelopeRow
                key={status.envelope.id}
                status={status}
                current={isCurrent}
                onOpen={() =>
                  setEnvelopeFor({ open: true, categoryId: status.envelope.categoryId })
                }
              />
            ))}
          </Card>
        )}
      </Section>

      {unbudgeted.length > 0 ? (
        <Section title="Spending with no budget">
          <Card className="divide-y divide-line overflow-hidden">
            {unbudgeted.slice(0, 6).map((row) => (
              <button
                key={row.categoryId ?? 'none'}
                type="button"
                disabled={!row.categoryId}
                onClick={() =>
                  row.categoryId
                    ? setEnvelopeFor({ open: true, categoryId: row.categoryId })
                    : undefined
                }
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors enabled:hover:bg-raised disabled:cursor-default"
              >
                <CategoryChip name={row.category?.icon} color={row.category?.color} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {row.category?.name ?? 'Uncategorised'}
                  </span>
                  <span className="block text-[12px] text-faint">
                    {row.count} {row.count === 1 ? 'entry' : 'entries'}
                  </span>
                </span>
                <Money value={row.total} className="shrink-0 text-sm" tone="plain" />
                {row.categoryId ? (
                  <Plus className="h-4 w-4 shrink-0 text-faint" />
                ) : null}
              </button>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section
        title="Goals"
        action={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setGoal(null);
              setGoalOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        }
      >
        {goals.length === 0 ? (
          <Card>
            <Empty
              icon={<Target className="h-6 w-6" />}
              title="Nothing being saved for"
              hint="A goal here points at a real account, so the bar only moves when the money does."
            />
          </Card>
        ) : (
          <div className="stagger space-y-2">
            {goals.map((progress) => (
              <button
                key={progress.goal.id}
                type="button"
                onClick={() => {
                  setGoal(progress.goal);
                  setGoalOpen(true);
                }}
                className="flex w-full items-start gap-3 rounded-card border border-line bg-surface px-4 py-3.5 text-left transition-colors hover:bg-raised"
              >
                <CategoryChip name={progress.goal.icon} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium text-ink">
                      {progress.goal.name}
                    </span>
                    <span className="shrink-0 text-[13px] text-muted">
                      <Money value={progress.saved} tone="plain" /> of{' '}
                      <Money value={progress.goal.targetAmount} tone="plain" />
                    </span>
                  </span>
                  <Bar
                    value={progress.saved}
                    max={progress.goal.targetAmount}
                    tone={progress.onTrack === false ? 'warn' : 'good'}
                    className="mt-2"
                  />
                  <span className="mt-1.5 block text-[12px] text-faint">{goalLine(progress)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Repeats"
        action={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setRule(null);
              setRuleOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        }
      >
        {ledger.recurring.length === 0 ? (
          <Card>
            <Empty
              icon={<Repeat className="h-6 w-6" />}
              title="Nothing on a schedule"
              hint="Rent, subscriptions, salary. Once these are in, the app knows what is coming and Safe to Spend stops lying to you."
            />
          </Card>
        ) : (
          <>
            <Card className="divide-y divide-line overflow-hidden">
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
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-raised"
                    >
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                          item.direction === 'in'
                            ? 'bg-good/12 text-good'
                            : 'bg-raised text-muted',
                        )}
                      >
                        <Repeat className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm text-ink">{item.description}</span>
                          {!item.isActive ? <Badge>paused</Badge> : null}
                          {item.variableAmount ? <Badge tone="warn">varies</Badge> : null}
                        </span>
                        <span className="block truncate text-[12px] text-faint">
                          {describeSchedule(item)} · next {formatDay(item.nextDueDate)}
                          {inMonth > 1 ? ` · ${inMonth}× this month` : ''}
                        </span>
                      </span>
                      <Money
                        value={item.amount}
                        className="shrink-0 text-sm"
                        tone={item.direction === 'in' ? 'good' : 'plain'}
                      />
                    </button>
                  );
                })}
            </Card>
            {committedMonthly > 0 ? (
              <p className="flex items-center gap-1.5 px-1 text-[12px] text-faint">
                <TrendingDown className="h-3.5 w-3.5" />
                {formatMoney(committedMonthly)} a month is committed before you decide anything.
              </p>
            ) : null}
          </>
        )}
      </Section>

      <EnvelopeSheet
        month={month}
        categoryId={envelopeFor.categoryId}
        open={envelopeFor.open}
        onClose={() => setEnvelopeFor({ open: false, categoryId: null })}
      />
      <GoalSheet goal={goal} open={goalOpen} onClose={() => setGoalOpen(false)} />
      <RecurringSheet recurring={rule} open={ruleOpen} onClose={() => setRuleOpen(false)} />
    </div>
  );
}

function EnvelopeRow({
  status,
  current,
  onOpen,
}: {
  status: EnvelopeStatus;
  current: boolean;
  onOpen: () => void;
}) {
  const over = status.remaining < 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-raised"
    >
      <CategoryChip name={status.category?.icon} color={status.category?.color} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm text-ink">
              {status.category?.name ?? 'Unknown category'}
            </span>
            {status.envelope.rollover && status.carriedIn !== 0 ? (
              <Badge tone={status.carriedIn > 0 ? 'good' : 'bad'}>
                {status.carriedIn > 0 ? '+' : ''}
                {formatMoney(status.carriedIn)} carried
              </Badge>
            ) : null}
          </span>
          <span className="shrink-0 text-[13px] text-muted">
            <Money value={status.spent} tone="plain" /> / <Money value={status.available} tone="plain" />
          </span>
        </span>

        <Bar
          value={status.spent}
          max={status.available}
          tone={over ? 'bad' : status.paceAhead ? 'warn' : 'good'}
          className="mt-2"
        />

        <span className="mt-1.5 block text-[12px] text-faint">
          {over ? (
            <span className="text-bad">
              {formatMoney(Math.abs(status.remaining))} over
            </span>
          ) : current && status.dailyAllowance > 0 ? (
            <>
              {formatMoney(status.remaining)} left · {formatMoney(status.dailyAllowance)} a day
              {status.paceAhead ? (
                <span className="text-warn"> · ahead of pace</span>
              ) : null}
            </>
          ) : (
            `${formatMoney(status.remaining)} left`
          )}
        </span>
      </span>
    </button>
  );
}

function goalLine(progress: GoalProgress): string {
  if (progress.remaining === 0) return 'Done. Go and spend it on the thing.';

  const need =
    progress.requiredPerWeek !== null
      ? `${formatMoney(progress.requiredPerWeek)} a week gets you there`
      : null;

  if (progress.goal.targetDate && need) {
    if (progress.onTrack === true) return `On track — ${need}.`;
    if (progress.projectedDate === null) return `Nothing has gone in yet. ${capitalise(need)}.`;
    return `At this rate you arrive ${formatDay(progress.projectedDate)}. ${capitalise(need)}.`;
  }

  if (progress.projectedDate) {
    return `${formatMoney(progress.remaining)} to go — around ${formatDay(progress.projectedDate)} at this rate.`;
  }

  return `${formatMoney(progress.remaining)} to go. Move money into the account to make this real.`;
}

function capitalise(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
