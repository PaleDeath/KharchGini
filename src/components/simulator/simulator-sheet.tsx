'use client';

import {
  ArrowRight,
  Calculator,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Flame,
  HelpCircle,
  Plus,
  RefreshCw,
  Sliders,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wand2,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { formatDay, today as todayISO } from '@/domain/dates';
import { formatMoney, parseAmount } from '@/domain/money';
import {
  calculateMonthlyEMI,
  runSimulation,
  type SimulationParams,
  type SimulationResult,
  type SimulationType,
} from '@/domain/simulator';
import { Badge, Money } from '@/components/ui/money';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CustomSelect } from '@/components/ui/custom-select';
import { Field, Input, Segmented } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useLedger } from '@/lib/store';
import { cn } from '@/lib/utils';

export interface SimulatorPreset {
  id: string;
  name: string;
  type: SimulationType;
  title: string;
  amountPaise: number;
  paymentMode?: 'upfront' | 'emi';
  emiMonths?: number;
  interestPct?: number;
  icon: string;
}

const PRESETS: SimulatorPreset[] = [
  {
    id: 'laptop_emi',
    name: '💻 Laptop / Phone',
    type: 'purchase',
    title: 'New MacBook Pro',
    amountPaise: 1_20_000_00, // ₹1,20,000
    paymentMode: 'emi',
    emiMonths: 12,
    interestPct: 0,
    icon: '💻',
  },
  {
    id: 'salary_hike',
    name: '💼 Salary Hike',
    type: 'income_change',
    title: 'Promotion / Raise',
    amountPaise: 25_000_00, // +₹25,000/mo
    icon: '💼',
  },
  {
    id: 'rent_hike',
    name: '🏠 Rent Hike',
    type: 'recurring_expense',
    title: 'Apartment Rent Increment',
    amountPaise: 4_000_00, // +₹4,000/mo
    icon: '🏠',
  },
  {
    id: 'vacation_trip',
    name: '🏖️ Vacation Trip',
    type: 'purchase',
    title: 'Goa / International Trip',
    amountPaise: 45_000_00, // ₹45,000
    paymentMode: 'upfront',
    icon: '🏖️',
  },
  {
    id: 'boost_emergency',
    name: '🎯 Boost Savings',
    type: 'goal_boost',
    title: 'Boost Goal Funding',
    amountPaise: 10_000_00, // +₹10,000/mo
    icon: '🎯',
  },
];

const SIM_TYPES: { value: SimulationType; label: string }[] = [
  { value: 'purchase', label: 'Big Purchase' },
  { value: 'income_change', label: 'Income Change' },
  { value: 'recurring_expense', label: 'New Bill / Rent' },
  { value: 'goal_boost', label: 'Boost Goal' },
];

export function SimulatorSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { ledger, addEntry, addRecurring } = useLedger();
  const toast = useToast();
  const today = todayISO();

  const [type, setType] = useState<SimulationType>('purchase');
  const [title, setTitle] = useState('New Purchase');
  const [amountInput, setAmountInput] = useState('50000');
  const [paymentMode, setPaymentMode] = useState<'upfront' | 'emi'>('upfront');
  const [emiMonths, setEmiMonths] = useState(6);
  const [interestPct, setInterestPct] = useState(0);
  const [goalId, setGoalId] = useState(ledger.goals[0]?.id ?? '');
  const [busy, setBusy] = useState(false);

  const amountPaise = useMemo(() => parseAmount(amountInput) ?? 0, [amountInput]);

  const params: SimulationParams = useMemo(
    () => ({
      type,
      title: title.trim() || 'Simulated Decision',
      amount: amountPaise,
      paymentMode,
      emiMonths,
      emiInterestRateAnnualPct: interestPct,
      goalId,
    }),
    [type, title, amountPaise, paymentMode, emiMonths, interestPct, goalId],
  );

  const result: SimulationResult = useMemo(
    () => runSimulation(ledger, params, today),
    [ledger, params, today],
  );

  const applyPreset = (preset: SimulatorPreset) => {
    setType(preset.type);
    setTitle(preset.title);
    setAmountInput(String(preset.amountPaise / 100));
    if (preset.paymentMode) setPaymentMode(preset.paymentMode);
    if (preset.emiMonths) setEmiMonths(preset.emiMonths);
    if (preset.interestPct !== undefined) setInterestPct(preset.interestPct);
  };

  const handleCommit = async () => {
    setBusy(true);
    try {
      if (result.committableRecurring) {
        await addRecurring(result.committableRecurring);
        toast(`Added recurring commitment "${result.params.title}"!`, { tone: 'good' });
      } else if (result.committableEntry) {
        await addEntry(result.committableEntry);
        toast(`Recorded transaction "${result.params.title}"!`, { tone: 'good' });
      }
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };

  const emiBreakdown = useMemo(() => {
    if (type !== 'purchase' || paymentMode !== 'emi') return null;
    return calculateMonthlyEMI(amountPaise, emiMonths, interestPct);
  }, [type, paymentMode, amountPaise, emiMonths, interestPct]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="‘What-If’ Sandbox Simulator"
      description="Simulate financial decisions in-memory to test their impact on your runway and goals."
      wide
      footer={
        <div className="flex w-full items-center gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1 font-bold">
            Close
          </Button>
          {(result.committableRecurring || result.committableEntry) && (
            <Button
              variant="primary"
              onClick={handleCommit}
              disabled={busy || amountPaise <= 0}
              className="flex-[2] font-extrabold gap-1.5 shadow-sm"
            >
              <Zap className="h-4 w-4" />
              {result.committableRecurring
                ? 'Save as Recurring Rule'
                : 'Log as Real Transaction'}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        {/* Preset Pills */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-faint block">
            Popular Life Decisions
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar select-none">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className="flex items-center gap-1.5 shrink-0 rounded-2xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-ink hover:border-accent hover:bg-raised shadow-2xs transition-all active:scale-95"
              >
                <span>{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Input Form Controls */}
        <div className="rounded-xl border border-line/60 bg-surface/90 p-4 space-y-3.5 shadow-xs">
          <Segmented
            options={SIM_TYPES}
            value={type}
            onChange={(val) => {
              setType(val);
              if (val === 'income_change') setTitle('Salary Hike / Promotion');
              else if (val === 'recurring_expense') setTitle('Rent Increase / New Bill');
              else if (val === 'goal_boost') setTitle('Boost Goal Funding');
              else if (val === 'purchase') setTitle('New Purchase');
            }}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Description / Decision Name">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. MacBook Pro or Promotion"
                className="font-medium"
              />
            </Field>

            <Field
              label={
                type === 'purchase'
                  ? 'Total Purchase Price (₹)'
                  : type === 'income_change'
                  ? 'Monthly Income Increase / Delta (₹)'
                  : type === 'recurring_expense'
                  ? 'Monthly Expense Increase (₹)'
                  : 'Monthly Goal Funding Boost (₹)'
              }
            >
              <Input
                type="number"
                min="1"
                step="100"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="e.g. 50000"
                className="font-mono font-bold"
              />
            </Field>
          </div>

          {/* Type-Specific Options */}
          {type === 'purchase' && (
            <div className="space-y-3 pt-2 border-t border-line/70">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted uppercase tracking-wider">
                  Payment Method
                </span>
                <div className="w-48">
                  <Segmented
                    options={[
                      { value: 'upfront', label: 'Upfront Cash' },
                      { value: 'emi', label: 'Monthly EMI' },
                    ]}
                    value={paymentMode}
                    onChange={setPaymentMode}
                  />
                </div>
              </div>

              {paymentMode === 'emi' && (
                <div className="grid gap-3 sm:grid-cols-2 rounded-2xl bg-raised/60 p-3.5 border border-line/70">
                  <Field label="Tenure (Months)">
                    <CustomSelect
                      value={String(emiMonths)}
                      onChange={(val) => setEmiMonths(Number(val))}
                      options={[
                        { value: '3', label: '3 Months' },
                        { value: '6', label: '6 Months' },
                        { value: '9', label: '9 Months' },
                        { value: '12', label: '12 Months (1 Year)' },
                        { value: '18', label: '18 Months' },
                        { value: '24', label: '24 Months (2 Years)' },
                      ]}
                    />
                  </Field>

                  <Field label="Annual Interest Rate (%)">
                    <CustomSelect
                      value={String(interestPct)}
                      onChange={(val) => setInterestPct(Number(val))}
                      options={[
                        { value: '0', label: '0% (No-Cost EMI)' },
                        { value: '12', label: '12% Annual Interest' },
                        { value: '14', label: '14% Annual Interest' },
                        { value: '16', label: '16% Annual Interest' },
                        { value: '18', label: '18% Annual Interest' },
                      ]}
                    />
                  </Field>

                  {emiBreakdown && (
                    <div className="sm:col-span-2 flex items-center justify-between text-xs pt-2 border-t border-line/60">
                      <span className="font-medium text-muted">
                        Monthly EMI: <Money value={emiBreakdown.monthlyPaise} tone="plain" className="font-bold text-ink tnum" /> / mo
                      </span>
                      <span className="text-faint">
                        Total Interest: {formatMoney(emiBreakdown.totalInterest)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {type === 'goal_boost' && ledger.goals.length > 0 && (
            <Field label="Target Savings Goal">
              <CustomSelect
                value={goalId}
                onChange={setGoalId}
                options={ledger.goals
                  .filter((g) => !g.archived)
                  .map((g) => ({ value: g.id, label: `${g.name} (Target: ${formatMoney(g.targetAmount)})` }))}
              />
            </Field>
          )}
        </div>

        {/* Dynamic Simulation Verdict Card */}
        <div
          className={cn(
            'rounded-xl border p-4 shadow-xs transition-colors',
            result.verdict === 'safe'
              ? 'border-good/40 bg-good/10'
              : result.verdict === 'tight'
              ? 'border-warn/40 bg-warn/10'
              : 'border-bad/40 bg-bad/10',
          )}
        >
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-2xs',
                result.verdict === 'safe'
                  ? 'border-good/30 bg-good/20 text-good'
                  : result.verdict === 'tight'
                  ? 'border-warn/30 bg-warn/20 text-warn'
                  : 'border-bad/30 bg-bad/20 text-bad',
              )}
            >
              {result.verdict === 'safe' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : result.verdict === 'tight' ? (
                <TriangleAlert className="h-5 w-5" />
              ) : (
                <Flame className="h-5 w-5" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-ink">{result.verdictTitle}</h4>
                <Badge
                  tone={
                    result.verdict === 'safe'
                      ? 'good'
                      : result.verdict === 'tight'
                      ? 'warn'
                      : 'bad'
                  }
                >
                  {result.verdict === 'safe'
                    ? 'Recommended'
                    : result.verdict === 'tight'
                    ? 'Caution'
                    : 'Deficit Alert'}
                </Badge>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {result.verdictDetail}
              </p>
            </div>
          </div>

          {/* Comparative Metrics Grid */}
          <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3 border-t border-line/50 text-xs">
            <div className="rounded-lg bg-surface/90 border border-line/60 p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">
                Safe to Spend
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <Money
                  value={result.simulatedSTS.amount}
                  className="font-bold text-sm sm:text-base tnum"
                  tone={result.simulatedSTS.amount < 0 ? 'bad' : 'plain'}
                />
              </div>
              <span className={cn('text-[11px] font-medium mt-0.5 block tnum', result.stsDelta >= 0 ? 'text-good' : 'text-bad')}>
                {result.stsDelta >= 0 ? '+' : ''}{formatMoney(result.stsDelta)} delta
              </span>
            </div>

            <div className="rounded-lg bg-surface/90 border border-line/60 p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">
                Daily Allowance
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <Money
                  value={result.simulatedSTS.perDay}
                  className="font-bold text-sm sm:text-base tnum"
                  tone="plain"
                />
                <span className="text-muted text-[10px]">/ day</span>
              </div>
              <span className={cn('text-[11px] font-medium mt-0.5 block tnum', result.dailyAllowanceDelta >= 0 ? 'text-good' : 'text-bad')}>
                {result.dailyAllowanceDelta >= 0 ? '+' : ''}{formatMoney(result.dailyAllowanceDelta)}/day
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1 rounded-lg bg-surface/90 border border-line/60 p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">
                60-Day Runway Floor
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <Money
                  value={result.simulatedLowestPoint?.balance ?? 0}
                  className="font-bold text-sm sm:text-base tnum"
                  tone={(result.simulatedLowestPoint?.balance ?? 0) < 0 ? 'bad' : 'plain'}
                />
              </div>
              <span className="text-[11px] text-muted mt-0.5 block">
                {result.simulatedDeficitDate
                  ? `Deficit on ${formatDay(result.simulatedDeficitDate)}`
                  : `Floor on ${formatDay(result.simulatedLowestPoint?.date ?? today)}`}
              </span>
            </div>
          </div>
        </div>

        {/* Goal Impacts Section */}
        {result.goalImpacts.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-accent" />
                Goal Milestone Shifts
              </span>
              <span className="text-xs text-faint">
                {result.goalImpacts.length} active {result.goalImpacts.length === 1 ? 'goal' : 'goals'}
              </span>
            </div>

            <div className="stagger space-y-2">
              {result.goalImpacts.map((g) => (
                <div
                  key={g.goal.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line/60 bg-surface/90 px-3.5 py-2.5 text-xs shadow-xs"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-extrabold text-ink block truncate">{g.goal.name}</span>
                    <span className="text-faint text-[11px] block mt-0.5">
                      Target: {formatMoney(g.goal.targetAmount)}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    {g.deltaDays !== null ? (
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[11px] font-semibold',
                          g.deltaDays < 0
                            ? 'bg-good/15 text-good'
                            : g.deltaDays > 0
                            ? 'bg-warn/15 text-warn'
                            : 'bg-raised text-muted',
                        )}
                      >
                        {g.deltaDays < 0
                          ? `⚡ ${Math.abs(g.deltaDays)} days earlier`
                          : g.deltaDays > 0
                          ? `⏳ ${g.deltaDays} days delayed`
                          : 'No change'}
                      </span>
                    ) : (
                      <span className="text-faint text-[11px]">Ongoing funding</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key Takeaways List */}
        <div className="rounded-xl border border-line/60 bg-raised/40 p-3.5 space-y-2 shadow-2xs">
          <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Key Strategic Takeaways
          </span>
          <ul className="space-y-1.5 text-xs text-muted leading-relaxed list-disc list-inside">
            {result.keyTakeaways.map((item, idx) => (
              <li key={idx} className="font-medium">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Sheet>
  );
}
