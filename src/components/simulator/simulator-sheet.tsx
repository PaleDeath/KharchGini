'use client';

import {
  ArrowRight,
  Briefcase,
  Calculator,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  HelpCircle,
  Info,
  Layers,
  PiggyBank,
  Plane,
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

import { addMonths, formatDay, today as todayISO } from '@/domain/dates';
import { formatMoney, parseAmount } from '@/domain/money';
import {
  calculateMonthlyEMI,
  getDefaultTargetHorizon,
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
  targetDate?: string;
  accumulationMode?: 'by_date' | 'by_monthly';
  monthlyContribution?: number;
  icon: string;
}

const PRESETS: SimulatorPreset[] = [
  {
    id: 'savings_target',
    name: '🎯 Savings Target (1 Year)',
    type: 'target_accumulation',
    title: '1-Year Savings Target',
    amountPaise: 1_00_000_00, // ₹1,00,000
    targetDate: addMonths(todayISO(), 12),
    accumulationMode: 'by_date',
    icon: '🎯',
  },
  {
    id: 'emergency_corpus',
    name: '🛡️ Emergency Fund (6 Mos)',
    type: 'target_accumulation',
    title: '6-Month Emergency Corpus',
    amountPaise: 1_50_000_00, // ₹1,50,000
    targetDate: addMonths(todayISO(), 6),
    accumulationMode: 'by_date',
    icon: '🛡️',
  },
  {
    id: 'gadget_emi',
    name: '💻 Tech / Appliance (EMI)',
    type: 'purchase',
    title: 'Laptop / Appliance',
    amountPaise: 60_000_00, // ₹60,000
    paymentMode: 'emi',
    emiMonths: 6,
    interestPct: 0,
    icon: '💻',
  },
  {
    id: 'salary_hike',
    name: '💼 Salary Hike / Raise',
    type: 'income_change',
    title: 'Salary Hike / Promotion',
    amountPaise: 20_000_00, // +₹20,000/mo
    icon: '💼',
  },
  {
    id: 'rent_hike',
    name: '🏠 Rent / Expense Increase',
    type: 'recurring_expense',
    title: 'Rent / Expense Increment',
    amountPaise: 3_000_00, // +₹3,000/mo
    icon: '🏠',
  },
  {
    id: 'boost_existing',
    name: '🚀 Boost Existing Goal',
    type: 'goal_boost',
    title: 'Boost Goal Funding',
    amountPaise: 10_000_00, // +₹10,000/mo
    icon: '🚀',
  },
];

const SIM_TYPES: { value: SimulationType; label: string }[] = [
  { value: 'target_accumulation', label: '🎯 Savings Target' },
  { value: 'purchase', label: '🛍️ Big Purchase' },
  { value: 'income_change', label: '💼 Income Change' },
  { value: 'recurring_expense', label: '📄 Bill / Rent' },
  { value: 'goal_boost', label: '🚀 Boost Existing' },
];

export function SimulatorSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { ledger, addEntry, addRecurring, addGoal, updateGoal, addAccount } = useLedger();
  const toast = useToast();
  const today = todayISO();

  const accountCandidates = useMemo(
    () => ledger.accounts.filter((account) => !account.archived && account.type !== 'card'),
    [ledger.accounts],
  );

  const defaultSourceAccount = useMemo(
    () =>
      accountCandidates.find((a) => !a.excludeFromSafeToSpend && a.type === 'bank') ??
      accountCandidates[0],
    [accountCandidates],
  );

  const savingsCandidates = useMemo(
    () => accountCandidates.filter((a) => a.type === 'savings'),
    [accountCandidates],
  );

  const [type, setType] = useState<SimulationType>('target_accumulation');
  const [title, setTitle] = useState('Savings Target');
  const [amountInput, setAmountInput] = useState('100000');
  const [paymentMode, setPaymentMode] = useState<'upfront' | 'emi'>('upfront');
  const [emiMonths, setEmiMonths] = useState(6);
  const [interestPct, setInterestPct] = useState(0);
  const [targetDate, setTargetDate] = useState(getDefaultTargetHorizon(today, 12));
  const [accumulationMode, setAccumulationMode] = useState<'by_date' | 'by_monthly'>('by_date');
  const [customMonthlyInput, setCustomMonthlyInput] = useState('10000');
  const [goalId, setGoalId] = useState(ledger.goals[0]?.id ?? '');
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [targetAccountId, setTargetAccountId] = useState<string>(() => {
    return savingsCandidates[0]?.id ?? '__new_reserve__';
  });
  const [linkMode, setLinkMode] = useState<'new' | 'existing'>('new');
  const [customSalaryInput, setCustomSalaryInput] = useState<string>('');
  const [showSalaryAdjust, setShowSalaryAdjust] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [busy, setBusy] = useState(false);

  const amountPaise = useMemo(() => parseAmount(amountInput) ?? 0, [amountInput]);
  const customMonthlyPaise = useMemo(() => parseAmount(customMonthlyInput) ?? 0, [customMonthlyInput]);
  const customSalaryPaise = useMemo(
    () => (customSalaryInput.trim() ? parseAmount(customSalaryInput) ?? undefined : undefined),
    [customSalaryInput],
  );

  const effectiveSourceAccountId = sourceAccountId || defaultSourceAccount?.id || 'acc_primary';

  const params: SimulationParams = useMemo(
    () => ({
      type,
      title: title.trim() || 'Simulated Decision',
      amount: amountPaise,
      paymentMode,
      emiMonths,
      emiInterestRateAnnualPct: interestPct,
      accountId: effectiveSourceAccountId,
      goalId:
        type === 'goal_boost' || (type === 'target_accumulation' && linkMode === 'existing')
          ? goalId
          : undefined,
      targetDate: type === 'target_accumulation' ? targetDate : undefined,
      accumulationMode,
      monthlyContribution: customMonthlyPaise,
      targetAccountId:
        targetAccountId && targetAccountId !== '__new_reserve__' ? targetAccountId : undefined,
      customMonthlyIncome: customSalaryPaise,
    }),
    [
      type,
      title,
      amountPaise,
      paymentMode,
      emiMonths,
      interestPct,
      effectiveSourceAccountId,
      goalId,
      linkMode,
      targetDate,
      accumulationMode,
      customMonthlyPaise,
      targetAccountId,
      customSalaryPaise,
    ],
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
    if (preset.id === 'savings_target') {
      setTargetDate(getDefaultTargetHorizon(today, 12));
    } else if (preset.id === 'emergency_corpus') {
      setTargetDate(getDefaultTargetHorizon(today, 6));
    } else if (preset.targetDate) {
      setTargetDate(preset.targetDate);
    }
    if (preset.accumulationMode) setAccumulationMode(preset.accumulationMode);
    if (preset.monthlyContribution) setCustomMonthlyInput(String(preset.monthlyContribution / 100));
  };

  const handleCommit = async () => {
    setBusy(true);
    try {
      if (result.committableGoal) {
        let accountId = result.committableGoal.accountId;
        const accExists = ledger.accounts.some((a) => a.id === accountId);
        let createdNewReserve = false;
        if (!accExists || accountId === '__new_reserve__' || accountId === 'acc_savings_reserve') {
          accountId = await addAccount({
            name: `${result.params.title} Reserve`,
            type: 'savings',
            openingBalance: 0,
            sortOrder: 100,
            archived: false,
          });
          createdNewReserve = true;
        }

        await addGoal({
          ...result.committableGoal,
          accountId,
        });

        if (result.committableRecurring) {
          await addRecurring({
            ...result.committableRecurring,
            accountId: effectiveSourceAccountId,
            counterAccountId: accountId,
          });
        }
        toast(
          `Created goal "${result.params.title}"${
            createdNewReserve ? ' with dedicated reserve account' : ''
          } and scheduled ${formatMoney(
            result.targetPlan?.actualMonthlySavings ?? result.committableRecurring?.amount ?? 0,
          )}/mo savings!`,
          { tone: 'good' },
        );
      } else if (result.params.type === 'target_accumulation' && result.params.goalId) {
        await updateGoal(result.params.goalId, {
          targetAmount: result.params.amount,
          targetDate: result.params.targetDate,
        });
        if (result.committableRecurring) {
          await addRecurring({
            ...result.committableRecurring,
            accountId: effectiveSourceAccountId,
          });
        }
        toast(
          `Updated goal "${result.params.title}" and scheduled ${formatMoney(
            result.targetPlan?.actualMonthlySavings ?? result.committableRecurring?.amount ?? 0,
          )}/mo savings!`,
          { tone: 'good' },
        );
      } else if (result.committableRecurring) {
        await addRecurring({
          ...result.committableRecurring,
          accountId: effectiveSourceAccountId,
        });
        toast(`Added recurring commitment "${result.params.title}"!`, { tone: 'good' });
      } else if (result.committableEntry) {
        await addEntry({
          ...result.committableEntry,
          accountId: effectiveSourceAccountId,
        });
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
      description="Simulate financial decisions in-memory to test their impact on your runway, goals, and savings targets."
      wide
      footer={
        <div className="flex w-full items-center gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1 font-bold">
            Close
          </Button>
          {(result.committableGoal ||
            result.committableRecurring ||
            result.committableEntry ||
            (result.params.type === 'target_accumulation' && result.params.goalId)) && (
            <Button
              variant="primary"
              onClick={handleCommit}
              disabled={busy || amountPaise <= 0}
              className="flex-[2] font-extrabold gap-1.5 shadow-sm truncate"
            >
              <Zap className="h-4 w-4 shrink-0" />
              {result.committableGoal
                ? `Save Goal & Setup ${formatMoney(
                    result.targetPlan?.actualMonthlySavings ?? 0,
                  )}/mo SIP`
                : result.params.type === 'target_accumulation' && result.params.goalId
                ? `Update Goal & Setup ${formatMoney(
                    result.targetPlan?.actualMonthlySavings ?? 0,
                  )}/mo SIP`
                : result.committableRecurring
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
              const defaultTitles = [
                'Savings Target',
                'Salary Hike / Promotion',
                'Rent Increase / New Bill',
                'Boost Goal Funding',
                'New Purchase',
              ];
              const isDefaultTitle = !title.trim() || defaultTitles.includes(title);
              if (val === 'target_accumulation') {
                if (isDefaultTitle) setTitle('Savings Target');
                if (!amountInput || ['50000', '25000', '4000', '10000', '300000'].includes(amountInput)) {
                  setAmountInput('100000');
                }
                if (!targetDate) setTargetDate(getDefaultTargetHorizon(today, 12));
              } else if (val === 'income_change') {
                if (isDefaultTitle) setTitle('Salary Hike / Promotion');
                if (!amountInput || ['300000', '100000', '50000'].includes(amountInput)) {
                  setAmountInput('20000');
                }
              } else if (val === 'recurring_expense') {
                if (isDefaultTitle) setTitle('Rent Increase / New Bill');
                if (!amountInput || ['300000', '100000', '50000'].includes(amountInput)) {
                  setAmountInput('3000');
                }
              } else if (val === 'goal_boost') {
                if (isDefaultTitle) setTitle('Boost Goal Funding');
                if (!amountInput || ['300000', '100000', '50000'].includes(amountInput)) {
                  setAmountInput('10000');
                }
              } else if (val === 'purchase') {
                if (isDefaultTitle) setTitle('New Purchase');
                if (!amountInput || ['300000', '100000', '25000'].includes(amountInput)) {
                  setAmountInput('50000');
                }
              }
            }}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Description / Goal Name">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Emergency Corpus, Vacation, Down Payment"
                className="font-medium"
              />
            </Field>

            <Field
              label={
                type === 'target_accumulation'
                  ? 'Target Accumulation Goal (₹)'
                  : type === 'purchase'
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
                placeholder="e.g. 100000"
                className="font-mono font-bold"
              />
              {type === 'target_accumulation' && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                  {[
                    { label: '₹25k', value: '25000' },
                    { label: '₹50k', value: '50000' },
                    { label: '₹1 Lakh', value: '100000' },
                    { label: '₹2 Lakh', value: '200000' },
                    { label: '₹5 Lakh', value: '500000' },
                  ].map((chip) => (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => setAmountInput(chip.value)}
                      className={cn(
                        'rounded-md px-2 py-0.5 text-[11px] font-semibold border transition-all active:scale-95',
                        amountInput === chip.value
                          ? 'border-accent bg-accent/15 text-accent shadow-2xs font-bold'
                          : 'border-line bg-surface text-muted hover:border-accent hover:text-ink',
                      )}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}
            </Field>
          </div>

          {/* Type-Specific Options */}
          {type === 'target_accumulation' && (
            <div className="space-y-3.5 pt-2 border-t border-line/70">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Target Deadline Date">
                  <Input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="font-medium"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                    {[
                      { label: '3 Mos', value: addMonths(today, 3) },
                      { label: '6 Mos', value: addMonths(today, 6) },
                      { label: '1 Year', value: addMonths(today, 12) },
                      { label: '2 Years', value: addMonths(today, 24) },
                    ].map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => setTargetDate(chip.value)}
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[11px] font-semibold border transition-all active:scale-95',
                          targetDate === chip.value
                            ? 'border-accent bg-accent/15 text-accent shadow-2xs font-bold'
                            : 'border-line bg-surface text-muted hover:border-accent hover:text-ink',
                        )}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Accumulation Mode">
                  <Segmented
                    options={[
                      { value: 'by_date', label: '🎯 Target Date' },
                      { value: 'by_monthly', label: '💵 Monthly Savings' },
                    ]}
                    value={accumulationMode}
                    onChange={setAccumulationMode}
                  />
                  <span className="text-[11px] text-muted block mt-1.5">
                    {accumulationMode === 'by_date'
                      ? 'Auto-calculates monthly savings needed to hit deadline.'
                      : 'Calculates projected reach date from your savings pace.'}
                  </span>
                </Field>
              </div>

              {accumulationMode === 'by_monthly' && (
                <div className="rounded-xl bg-raised/50 p-3 border border-line/70 space-y-2">
                  <Field label="Custom Monthly Savings Contribution (₹)">
                    <Input
                      type="number"
                      min="100"
                      step="500"
                      value={customMonthlyInput}
                      onChange={(e) => setCustomMonthlyInput(e.target.value)}
                      placeholder="e.g. 10000"
                      className="font-mono font-bold"
                    />
                  </Field>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { label: '₹5,000/mo', value: '5000' },
                      { label: '₹10,000/mo', value: '10000' },
                      { label: '₹15,000/mo', value: '15000' },
                      { label: '₹20,000/mo', value: '20000' },
                      { label: '₹25,000/mo', value: '25000' },
                    ].map((chip) => (
                      <button
                        key={chip.value}
                        type="button"
                        onClick={() => setCustomMonthlyInput(chip.value)}
                        className={cn(
                          'rounded-md px-2 py-0.5 text-[11px] font-semibold border transition-all active:scale-95',
                          customMonthlyInput === chip.value
                            ? 'border-accent bg-accent/15 text-accent shadow-2xs font-bold'
                            : 'border-line bg-surface text-muted hover:border-accent hover:text-ink',
                        )}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 pt-1">
                {ledger.goals.length > 0 ? (
                  <Field label="Goal Association">
                    <Segmented
                      options={[
                        { value: 'new', label: 'Create New Goal' },
                        { value: 'existing', label: 'Link Existing Goal' },
                      ]}
                      value={linkMode}
                      onChange={setLinkMode}
                    />
                  </Field>
                ) : null}

                {linkMode === 'existing' && ledger.goals.length > 0 ? (
                  <Field label="Select Existing Goal">
                    <CustomSelect
                      value={goalId}
                      onChange={setGoalId}
                      options={ledger.goals
                        .filter((g) => !g.archived)
                        .map((g) => ({
                          value: g.id,
                          label: `${g.name} (Target: ${formatMoney(g.targetAmount)})`,
                        }))}
                    />
                  </Field>
                ) : (
                  <Field label="Destination Savings Reserve">
                    <CustomSelect
                      value={targetAccountId}
                      onChange={setTargetAccountId}
                      options={[
                        {
                          value: '__new_reserve__',
                          label: '✨ + Create Dedicated Goal Savings Reserve',
                        },
                        ...accountCandidates.map((acc) => ({
                          value: acc.id,
                          label: `${acc.name} (${acc.type})`,
                        })),
                      ]}
                    />
                    <span className="text-[11px] text-muted block mt-1">
                      {targetAccountId === '__new_reserve__'
                        ? 'A separate savings reserve will be automatically created to isolate your goal savings.'
                        : 'Monthly savings will be transferred into this account.'}
                    </span>
                  </Field>
                )}

                {accountCandidates.length > 0 && (
                  <Field label="Deduct Monthly SIP From">
                    <CustomSelect
                      value={sourceAccountId || defaultSourceAccount?.id || ''}
                      onChange={setSourceAccountId}
                      options={accountCandidates.map((acc) => ({
                        value: acc.id,
                        label: `${acc.name} (${acc.type})`,
                      }))}
                    />
                    <span className="text-[11px] text-muted block mt-1">
                      Checking / salary account from which monthly savings will be deducted.
                    </span>
                  </Field>
                )}
              </div>
            </div>
          )}

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

        {/* Monthly Cash Flow & Salary Transparency Card */}
        <div className="rounded-xl border border-line/70 bg-raised/40 p-4 space-y-3 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <Briefcase className="h-4 w-4" />
              </span>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-ink block">
                  Monthly Cash Flow & Salary Accounting
                </span>
                <span className="text-[11px] text-muted">
                  How KharchGini factors recurring income and expenses into this simulation
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge tone={result.cashFlowBreakdown.isSalaryActive ? 'good' : 'warn'}>
                {result.cashFlowBreakdown.isSalaryActive ? '✓ Salary Accounted For' : 'Estimated Cash Flow'}
              </Badge>
              <button
                type="button"
                onClick={() => setShowSalaryAdjust(!showSalaryAdjust)}
                className="rounded-md border border-line bg-surface px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-raised transition-colors shadow-2xs active:scale-95"
              >
                {showSalaryAdjust ? 'Hide Adjuster' : '⚙️ Adjust Assumed Salary'}
              </button>
            </div>
          </div>

          {/* 4-Part Cash Flow Equation Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
            <div className="rounded-lg bg-surface/90 border border-line/60 p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-good block">
                + Monthly Salary / Income
              </span>
              <Money
                value={result.cashFlowBreakdown.monthlyIncome}
                className="font-extrabold text-sm sm:text-base text-good tnum block mt-0.5"
                tone="plain"
              />
              <span className="text-[10px] text-muted truncate block mt-0.5" title={result.cashFlowBreakdown.incomeDetails}>
                {result.cashFlowBreakdown.incomeSource === 'user_specified'
                  ? 'Custom specified'
                  : result.cashFlowBreakdown.incomeSource === 'recurring_salary'
                  ? 'Active recurring salary'
                  : result.cashFlowBreakdown.incomeSource === 'historical_average'
                  ? 'Historical average'
                  : 'Runway estimated'}
              </span>
            </div>

            <div className="rounded-lg bg-surface/90 border border-line/60 p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">
                − Fixed Recurring Bills
              </span>
              <Money
                value={result.cashFlowBreakdown.monthlyCommittedBills}
                className="font-extrabold text-sm sm:text-base text-ink tnum block mt-0.5"
                tone="plain"
              />
              <span className="text-[10px] text-muted block mt-0.5">Rent, EMIs & utilities</span>
            </div>

            <div className="rounded-lg bg-surface/90 border border-line/60 p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">
                − Budgeted Living Needs
              </span>
              <Money
                value={result.cashFlowBreakdown.monthlyBudgetedNeeds}
                className="font-extrabold text-sm sm:text-base text-ink tnum block mt-0.5"
                tone="plain"
              />
              <span className="text-[10px] text-muted block mt-0.5">Envelopes for essentials</span>
            </div>

            <div
              className={cn(
                'rounded-lg border p-2.5',
                result.cashFlowBreakdown.monthlyNetSurplus < 0
                  ? 'border-bad/40 bg-bad/10'
                  : 'border-accent/40 bg-accent/10',
              )}
            >
              <span
                className={cn(
                  'text-[10px] font-semibold uppercase tracking-wider block',
                  result.cashFlowBreakdown.monthlyNetSurplus < 0 ? 'text-bad' : 'text-accent',
                )}
              >
                = Net Monthly Free Cash Flow
              </span>
              <Money
                value={result.cashFlowBreakdown.monthlyNetSurplus}
                className={cn(
                  'font-extrabold text-sm sm:text-base tnum block mt-0.5',
                  result.cashFlowBreakdown.monthlyNetSurplus < 0 ? 'text-bad' : 'text-accent',
                )}
                tone="plain"
              />
              <span
                className={cn(
                  'text-[10px] block mt-0.5',
                  result.cashFlowBreakdown.monthlyNetSurplus < 0 ? 'text-bad font-medium' : 'text-accent/80',
                )}
              >
                {result.cashFlowBreakdown.monthlyNetSurplus < 0
                  ? '⚠️ Monthly deficit / burn'
                  : 'Discretionary surplus/mo'}
              </span>
            </div>
          </div>

          {/* Salary Adjustment Drawer */}
          {showSalaryAdjust && (
            <div className="rounded-xl border border-accent/30 bg-surface p-3.5 space-y-2.5 text-xs animate-in fade-in-50">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-accent" />
                  Assumed Monthly Salary / Take-Home Paycheck (₹)
                </span>
                {customSalaryInput && (
                  <button
                    type="button"
                    onClick={() => setCustomSalaryInput('')}
                    className="text-[11px] font-semibold text-accent hover:underline"
                  >
                    Reset to Ledger Detected
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted leading-relaxed">
                Verify or test how your savings timeline responds if your salary changes or if your paycheck is not yet recorded as a recurring rule.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  step="1000"
                  value={customSalaryInput}
                  onChange={(e) => setCustomSalaryInput(e.target.value)}
                  placeholder={String(result.cashFlowBreakdown.monthlyIncome / 100 || 100000)}
                  className="font-mono font-bold"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: '₹0 (Break)', value: '0' },
                  { label: '₹50k/mo', value: '50000' },
                  { label: '₹75k/mo', value: '75000' },
                  { label: '₹1 Lakh/mo', value: '100000' },
                  { label: '₹1.5 Lakh/mo', value: '150000' },
                  { label: '₹2 Lakh/mo', value: '200000' },
                ].map((chip) => (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => setCustomSalaryInput(chip.value)}
                    className={cn(
                      'rounded-md px-2 py-0.5 text-[11px] font-semibold border transition-all active:scale-95',
                      customSalaryInput === chip.value
                        ? 'border-accent bg-accent/15 text-accent shadow-2xs font-bold'
                        : 'border-line bg-surface text-muted hover:border-accent hover:text-ink',
                    )}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Accumulation Blueprint Card */}
        {result.targetPlan && type === 'target_accumulation' && (
          <div className="rounded-2xl border border-accent/40 bg-accent/5 p-4 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                <Target className="h-4 w-4" />
                Accumulation Blueprint ({result.params.title})
              </span>
              <Badge
                tone={
                  result.targetPlan.isOnTrack && result.targetPlan.feasibility === 'comfortable'
                    ? 'good'
                    : result.targetPlan.feasibility === 'unrealistic'
                    ? 'bad'
                    : 'warn'
                }
              >
                {result.targetPlan.isOnTrack
                  ? result.targetPlan.feasibility === 'comfortable'
                    ? '✅ Fully Achievable'
                    : '⚠️ Tight Runway'
                  : '⏳ Deadline Missed'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-xl bg-surface/90 border border-line/60 p-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">
                  Required Monthly
                </span>
                <Money
                  value={result.targetPlan.actualMonthlySavings}
                  className="font-extrabold text-base sm:text-lg text-ink tnum block mt-0.5"
                  tone="plain"
                />
                <span className="text-[10px] text-faint block mt-0.5">
                  {formatMoney(result.targetPlan.requiredWeeklySavings)} / week
                </span>
              </div>

              <div className="rounded-xl bg-surface/90 border border-line/60 p-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">
                  Target Deadline
                </span>
                <span className="font-bold text-sm sm:text-base text-ink block mt-0.5">
                  {formatDay(result.targetPlan.targetDate)}
                </span>
                <span className="text-[10px] text-muted block mt-0.5">
                  {result.targetPlan.monthsRemaining} mos ({result.targetPlan.daysRemaining} days)
                </span>
              </div>

              <div className="rounded-xl bg-surface/90 border border-line/60 p-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">
                  Projected Reach
                </span>
                <span className="font-bold text-sm sm:text-base text-ink block mt-0.5">
                  {formatDay(result.targetPlan.projectedReachDate)}
                </span>
                <span
                  className={cn(
                    'text-[10px] font-semibold block mt-0.5',
                    result.targetPlan.isOnTrack ? 'text-good' : 'text-warn',
                  )}
                >
                  {result.targetPlan.isOnTrack
                    ? '🎯 On Schedule'
                    : `Delayed by ${Math.max(
                        1,
                        result.targetPlan.monthsToReach - result.targetPlan.monthsRemaining,
                      )} ${
                        result.targetPlan.monthsToReach - result.targetPlan.monthsRemaining === 1
                          ? 'month'
                          : 'months'
                      }`}
                </span>
              </div>

              <div className="rounded-xl bg-surface/90 border border-line/60 p-2.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted block">
                  Surplus Usage
                </span>
                <span className="font-bold text-sm sm:text-base text-ink block mt-0.5">
                  {result.targetPlan.percentOfSurplus > 0
                    ? `${result.targetPlan.percentOfSurplus}%`
                    : 'N/A'}
                </span>
                <span className="text-[10px] text-faint block mt-0.5">
                  {result.targetPlan.monthlyFreeCashFlow > 0
                    ? `of ~${formatMoney(result.targetPlan.monthlyFreeCashFlow)}/mo surplus`
                    : 'Discretionary runway basis'}
                </span>
              </div>
            </div>

            {/* Total Salary & Savings Overview Bar */}
            {result.targetPlan.totalExpectedSalaryOverTimeline > 0 && (
              <div className="rounded-xl bg-surface/90 border border-line/60 p-3 text-xs flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-good/15 text-good shrink-0">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <span className="font-bold text-ink block">
                      ~{formatMoney(result.targetPlan.totalExpectedSalaryOverTimeline)} total salary incoming
                    </span>
                    <span className="text-[11px] text-muted">
                      Across {result.targetPlan.monthsRemaining} monthly paychecks until your target deadline
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-muted text-[11px] block">Discretionary buffer remaining:</span>
                  <span
                    className={cn(
                      'font-bold tnum',
                      result.targetPlan.monthlyFreeCashFlow - result.targetPlan.actualMonthlySavings >= 0
                        ? 'text-good'
                        : 'text-bad',
                    )}
                  >
                    ~{formatMoney(
                      result.targetPlan.monthlyFreeCashFlow - result.targetPlan.actualMonthlySavings,
                    )}/mo
                  </span>
                </div>
              </div>
            )}

            {/* Multi-Month Salary & Savings Schedule Accordion */}
            {result.targetPlan.schedule.length > 0 && (
              <div className="pt-2 border-t border-accent/20 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowSchedule(!showSchedule)}
                  className="flex w-full items-center justify-between rounded-xl bg-surface/80 border border-line/60 px-3.5 py-2 text-xs font-bold text-ink hover:bg-surface transition-colors shadow-2xs active:scale-[0.99]"
                >
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5 text-accent" />
                    <span>Month-by-Month Salary & Savings Timeline ({result.targetPlan.schedule.length} Months)</span>
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-accent font-semibold">
                    {showSchedule ? 'Collapse' : 'Expand Timeline'}
                    {showSchedule ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                </button>

                {showSchedule && (
                  <div className="rounded-xl border border-line/60 bg-surface/95 overflow-hidden shadow-xs animate-in fade-in-50">
                    <div className="overflow-x-auto">
                      <div className="min-w-[560px] max-h-72 overflow-y-auto divide-y divide-line/40 text-xs">
                        <div className="grid grid-cols-6 bg-raised/70 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted sticky top-0 backdrop-blur-xs z-10">
                          <span>Month</span>
                          <span className="text-right">Salary In</span>
                          <span className="text-right">Outflows</span>
                          <span className="text-right">Goal SIP</span>
                          <span className="text-right">Buffer Left</span>
                          <span className="text-right">Total Saved</span>
                        </div>
                        {result.targetPlan.schedule.map((row) => (
                          <div
                            key={row.monthKey}
                            className={cn(
                              'grid grid-cols-6 items-center px-3 py-2 transition-colors',
                              row.isTargetMet
                                ? 'bg-good/10 font-semibold'
                                : 'hover:bg-raised/40',
                            )}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-semibold text-ink">{row.monthLabel}</span>
                              {row.isTargetMet && (
                                <span className="rounded bg-good/20 text-good px-1 py-0.2 text-[9px] font-bold shrink-0">
                                  🎯 Met
                                </span>
                              )}
                            </div>
                            <span className="text-right font-medium text-good tnum">
                              +{formatMoney(row.expectedIncome)}
                            </span>
                            <span className="text-right text-muted tnum">
                              -{formatMoney(row.expectedOutflows)}
                            </span>
                            <span className="text-right font-bold text-accent tnum">
                              {formatMoney(row.monthlySavings)}
                            </span>
                            <span
                              className={cn(
                                'text-right font-semibold tnum',
                                row.netCashFlowRemaining >= 0 ? 'text-good' : 'text-bad',
                              )}
                            >
                              {row.netCashFlowRemaining >= 0 ? '+' : ''}{formatMoney(row.netCashFlowRemaining)}
                            </span>
                            <div className="text-right">
                              <span className="font-bold text-ink tnum block">
                                {formatMoney(row.cumulativeSaved)}
                              </span>
                              <span className="text-[9px] text-muted block">
                                {row.percentCompleted}% of target
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-raised/60 p-2.5 border-t border-line/60 text-[11px] flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted">
                        Total Salary: <span className="font-bold text-ink">{formatMoney(result.targetPlan.totalExpectedSalaryOverTimeline)}</span>
                      </span>
                      <span className="text-muted">
                        Total Living & Bills: <span className="font-bold text-ink">{formatMoney(result.targetPlan.totalExpectedOutflowsOverTimeline)}</span>
                      </span>
                      <span className="text-muted">
                        Total Target Accumulated: <span className="font-bold text-accent">{formatMoney(result.targetPlan.totalExpectedSavingsOverTimeline)}</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
