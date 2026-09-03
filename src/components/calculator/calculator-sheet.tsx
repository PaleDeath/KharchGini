'use client';

import {
  Calculator as CalcIcon,
  Check,
  Coins,
  Copy,
  Delete,
  Equal,
  Landmark,
  Percent,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { formatMoney, parseAmount, rupeesToPaise } from '@/domain/money';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

type CalcTab = 'standard' | 'emi' | 'sip';

/**
 * Safe expression evaluator for basic arithmetic (+, -, *, /, %).
 * Avoids eval() and handles floating-point rounding gracefully.
 */
function safeCalculate(expression: string): number | null {
  try {
    const sanitized = expression.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    // Only allow digits, operators, decimal point, parentheses
    if (!/^[0-9+\-*/.()%\s]+$/.test(sanitized)) return null;

    // Evaluate basic math tokens safely
    const func = new Function(`"use strict"; return (${sanitized})`);
    const res = Number(func());
    if (!Number.isFinite(res) || Number.isNaN(res)) return null;
    return Math.round(res * 100) / 100;
  } catch {
    return null;
  }
}

export function CalculatorSheet({
  open,
  onClose,
  onLogSpend,
}: {
  open: boolean;
  onClose: () => void;
  /** Optional callback to prefill command bar or quick log with the calculated amount in Rupees */
  onLogSpend?: (rupees: number) => void;
}) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<CalcTab>('standard');

  // --- Standard Calculator State ---
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [hasCalculated, setHasCalculated] = useState(false);

  // --- EMI Calculator State ---
  const [loanPrincipal, setLoanPrincipal] = useState('1000000'); // ₹10,00,000
  const [loanInterestRate, setLoanInterestRate] = useState('8.5'); // 8.5%
  const [loanTenureYears, setLoanTenureYears] = useState('5'); // 5 years

  // --- SIP Calculator State ---
  const [sipMonthly, setSipMonthly] = useState('10000'); // ₹10,000/mo
  const [sipReturnRate, setSipReturnRate] = useState('12'); // 12%
  const [sipYears, setSipYears] = useState('10'); // 10 years

  // Handle number and operator input
  const handleInput = useCallback(
    (val: string) => {
      if (hasCalculated) {
        if (['+', '−', '×', '÷'].includes(val)) {
          setEquation(display + ' ' + val + ' ');
          setDisplay('0');
          setHasCalculated(false);
          return;
        } else {
          setEquation('');
          setDisplay(val === '.' ? '0.' : val);
          setHasCalculated(false);
          return;
        }
      }

      if (val === '.') {
        if (!display.includes('.')) {
          setDisplay((prev) => prev + '.');
        }
        return;
      }

      if (['+', '−', '×', '÷'].includes(val)) {
        setEquation((prev) => prev + display + ' ' + val + ' ');
        setDisplay('0');
        return;
      }

      setDisplay((prev) => (prev === '0' ? val : prev + val));
    },
    [display, hasCalculated],
  );

  const handleClear = useCallback(() => {
    setDisplay('0');
    setEquation('');
    setHasCalculated(false);
  }, []);

  const handleDelete = useCallback(() => {
    if (hasCalculated) {
      handleClear();
      return;
    }
    setDisplay((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
  }, [hasCalculated, handleClear]);

  const handleEqual = useCallback(() => {
    const fullExpr = equation + display;
    const result = safeCalculate(fullExpr);
    if (result !== null) {
      setEquation(fullExpr + ' =');
      setDisplay(String(result));
      setHasCalculated(true);
    } else {
      toast('Invalid calculation', { tone: 'bad' });
    }
  }, [equation, display, toast]);

  // Quick Multipliers
  const handleMultiplyAnnual = useCallback(() => {
    const current = parseFloat(display) || 0;
    const res = Math.round(current * 12);
    setEquation(`${current} × 12 (Annual) =`);
    setDisplay(String(res));
    setHasCalculated(true);
  }, [display]);

  const handleDivideDaily = useCallback(() => {
    const current = parseFloat(display) || 0;
    const res = Math.round(current / 30);
    setEquation(`${current} ÷ 30 (Daily) =`);
    setDisplay(String(res));
    setHasCalculated(true);
  }, [display]);

  const handleAddAmount = useCallback((addVal: number) => {
    setDisplay((prev) => {
      const current = parseFloat(prev) || 0;
      return String(current + addVal);
    });
  }, []);

  // Keyboard shortcut listener for active calculator
  useEffect(() => {
    if (!open || activeTab !== 'standard') return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleInput(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        handleInput('.');
      } else if (e.key === '+') {
        e.preventDefault();
        handleInput('+');
      } else if (e.key === '-') {
        e.preventDefault();
        handleInput('−');
      } else if (e.key === '*' || e.key === 'x') {
        e.preventDefault();
        handleInput('×');
      } else if (e.key === '/') {
        e.preventDefault();
        handleInput('÷');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEqual();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, activeTab, handleInput, handleEqual, handleDelete, handleClear]);

  // --- EMI Calculation Logic ---
  const emiResults = useMemo(() => {
    const p = parseFloat(loanPrincipal) || 0;
    const annualRate = parseFloat(loanInterestRate) || 0;
    const years = parseFloat(loanTenureYears) || 0;

    if (p <= 0 || annualRate <= 0 || years <= 0) {
      return { emi: 0, totalInterest: 0, totalAmount: 0, principalPct: 100, interestPct: 0 };
    }

    const r = annualRate / 12 / 100;
    const n = years * 12;
    const emi = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const totalAmount = emi * n;
    const totalInterest = totalAmount - p;

    const principalPct = Math.round((p / totalAmount) * 100);
    const interestPct = 100 - principalPct;

    return {
      emi: Math.round(emi),
      totalInterest: Math.round(totalInterest),
      totalAmount: Math.round(totalAmount),
      principalPct,
      interestPct,
    };
  }, [loanPrincipal, loanInterestRate, loanTenureYears]);

  // --- SIP Calculation Logic ---
  const sipResults = useMemo(() => {
    const p = parseFloat(sipMonthly) || 0;
    const annualRate = parseFloat(sipReturnRate) || 0;
    const years = parseFloat(sipYears) || 0;

    if (p <= 0 || annualRate <= 0 || years <= 0) {
      return { totalInvested: 0, wealthGain: 0, totalValue: 0, investedPct: 100, gainPct: 0 };
    }

    const i = annualRate / 12 / 100;
    const n = years * 12;
    // FV = P * [((1 + i)^n - 1) / i] * (1 + i)
    const totalValue = p * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
    const totalInvested = p * n;
    const wealthGain = totalValue - totalInvested;

    const investedPct = Math.round((totalInvested / totalValue) * 100);
    const gainPct = 100 - investedPct;

    return {
      totalInvested: Math.round(totalInvested),
      wealthGain: Math.round(wealthGain),
      totalValue: Math.round(totalValue),
      investedPct,
      gainPct,
    };
  }, [sipMonthly, sipReturnRate, sipYears]);

  const copyToClipboard = (textToCopy: string, label = 'Copied to clipboard') => {
    void navigator.clipboard.writeText(textToCopy);
    toast(label, { tone: 'good' });
  };

  const currentDisplayNumber = parseFloat(display) || 0;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Financial Calculator"
      description="Tactile math, smart multipliers, and wealth planning aligned to your finances."
    >
      <div className="space-y-4">
        {/* Tab Navigation */}
        <div className="flex items-center rounded-xl border border-line/60 bg-raised/70 p-1 text-xs font-semibold shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('standard')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all',
              activeTab === 'standard'
                ? 'bg-surface text-ink font-bold shadow-xs'
                : 'text-muted hover:text-ink',
            )}
          >
            <CalcIcon className="h-3.5 w-3.5 text-accent" />
            <span>Standard</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('emi')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all',
              activeTab === 'emi'
                ? 'bg-surface text-ink font-bold shadow-xs'
                : 'text-muted hover:text-ink',
            )}
          >
            <Landmark className="h-3.5 w-3.5 text-orange-500" />
            <span>EMI / Loan</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sip')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all',
              activeTab === 'sip'
                ? 'bg-surface text-ink font-bold shadow-xs'
                : 'text-muted hover:text-ink',
            )}
          >
            <TrendingUp className="h-3.5 w-3.5 text-teal-500" />
            <span>SIP & Growth</span>
          </button>
        </div>

        {/* --- STANDARD CALCULATOR TAB --- */}
        {activeTab === 'standard' ? (
          <div className="space-y-3">
            {/* Calculator Display Screen */}
            <div className="rounded-2xl border border-line/70 bg-surface/95 p-4 text-right shadow-inner space-y-1 relative overflow-hidden group">
              <div className="text-xs font-mono text-muted h-5 truncate tracking-wider">
                {equation || '0'}
              </div>
              <div className="text-3xl sm:text-4xl font-mono font-bold text-ink tracking-tight truncate select-all">
                {formatMoney(rupeesToPaise(currentDisplayNumber))}
              </div>

              {/* Copy / Quick Actions */}
              <div className="flex items-center justify-between pt-1 border-t border-line/40">
                <span className="text-[10px] text-faint font-mono">
                  {currentDisplayNumber > 0
                    ? `₹${currentDisplayNumber.toLocaleString('en-IN')}`
                    : 'Ready'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(String(currentDisplayNumber), 'Amount copied!')}
                    className="p-1 text-muted hover:text-ink rounded hover:bg-raised transition-colors"
                    title="Copy amount"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  {onLogSpend && currentDisplayNumber > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        onLogSpend(currentDisplayNumber);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:bg-accent/15 rounded px-2 py-0.5 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Log as spend</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Smart Financial Multipliers Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={handleMultiplyAnnual}
                className="shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent/20 active:scale-95 transition-all"
                title="Multiply by 12 to annualize monthly spend"
              >
                ×12 (Annual)
              </button>
              <button
                type="button"
                onClick={handleDivideDaily}
                className="shrink-0 rounded-lg border border-line/60 bg-raised/60 px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-raised active:scale-95 transition-all"
                title="Divide by 30 to get daily cost"
              >
                ÷30 (Daily)
              </button>
              <button
                type="button"
                onClick={() => handleAddAmount(1000)}
                className="shrink-0 rounded-lg border border-line/60 bg-raised/60 px-2 py-1 text-[11px] font-medium text-muted hover:text-ink hover:bg-raised active:scale-95 transition-all"
              >
                +₹1k
              </button>
              <button
                type="button"
                onClick={() => handleAddAmount(5000)}
                className="shrink-0 rounded-lg border border-line/60 bg-raised/60 px-2 py-1 text-[11px] font-medium text-muted hover:text-ink hover:bg-raised active:scale-95 transition-all"
              >
                +₹5k
              </button>
              <button
                type="button"
                onClick={() => handleAddAmount(100000)}
                className="shrink-0 rounded-lg border border-line/60 bg-raised/60 px-2 py-1 text-[11px] font-medium text-muted hover:text-ink hover:bg-raised active:scale-95 transition-all"
              >
                +₹1L
              </button>
            </div>

            {/* Tactile Numpad Grid */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              {/* Row 1 */}
              <button
                type="button"
                onClick={handleClear}
                className="rounded-xl border border-line/70 bg-bad/10 text-bad font-bold text-sm py-3 hover:bg-bad/20 active:scale-95 transition-all shadow-2xs"
              >
                AC
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-xl border border-line/70 bg-raised/60 text-muted font-bold text-sm py-3 hover:bg-raised hover:text-ink active:scale-95 transition-all shadow-2xs flex items-center justify-center"
              >
                <Delete className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleInput('%')}
                className="rounded-xl border border-line/70 bg-raised/60 text-muted font-bold text-sm py-3 hover:bg-raised hover:text-ink active:scale-95 transition-all shadow-2xs"
              >
                %
              </button>
              <button
                type="button"
                onClick={() => handleInput('÷')}
                className="rounded-xl border border-accent/40 bg-accent/15 text-accent font-bold text-base py-3 hover:bg-accent/25 active:scale-95 transition-all shadow-2xs"
              >
                ÷
              </button>

              {/* Row 2 */}
              <button
                type="button"
                onClick={() => handleInput('7')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                7
              </button>
              <button
                type="button"
                onClick={() => handleInput('8')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                8
              </button>
              <button
                type="button"
                onClick={() => handleInput('9')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                9
              </button>
              <button
                type="button"
                onClick={() => handleInput('×')}
                className="rounded-xl border border-accent/40 bg-accent/15 text-accent font-bold text-base py-3 hover:bg-accent/25 active:scale-95 transition-all shadow-2xs"
              >
                ×
              </button>

              {/* Row 3 */}
              <button
                type="button"
                onClick={() => handleInput('4')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                4
              </button>
              <button
                type="button"
                onClick={() => handleInput('5')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                5
              </button>
              <button
                type="button"
                onClick={() => handleInput('6')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                6
              </button>
              <button
                type="button"
                onClick={() => handleInput('−')}
                className="rounded-xl border border-accent/40 bg-accent/15 text-accent font-bold text-base py-3 hover:bg-accent/25 active:scale-95 transition-all shadow-2xs"
              >
                −
              </button>

              {/* Row 4 */}
              <button
                type="button"
                onClick={() => handleInput('1')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => handleInput('2')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                2
              </button>
              <button
                type="button"
                onClick={() => handleInput('3')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                3
              </button>
              <button
                type="button"
                onClick={() => handleInput('+')}
                className="rounded-xl border border-accent/40 bg-accent/15 text-accent font-bold text-base py-3 hover:bg-accent/25 active:scale-95 transition-all shadow-2xs"
              >
                +
              </button>

              {/* Row 5 */}
              <button
                type="button"
                onClick={() => handleInput('0')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleInput('.')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-bold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                .
              </button>
              <button
                type="button"
                onClick={() => handleInput('00')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-sm py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                00
              </button>
              <button
                type="button"
                onClick={handleEqual}
                className="rounded-xl bg-accent text-accent-ink font-bold text-lg py-3 hover:opacity-90 active:scale-95 transition-all shadow-sm flex items-center justify-center"
              >
                =
              </button>
            </div>
          </div>
        ) : null}

        {/* --- EMI / LOAN PLANNER TAB --- */}
        {activeTab === 'emi' ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-line/70 bg-surface/95 p-4 space-y-3 shadow-inner">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
                Monthly Repayment (EMI)
              </span>
              <div className="text-3xl font-bold text-orange-500 font-mono tracking-tight">
                {formatMoney(rupeesToPaise(emiResults.emi))}
                <span className="text-xs text-muted font-normal ml-1">/ month</span>
              </div>

              {/* Split Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="h-2 w-full rounded-full bg-raised overflow-hidden flex">
                  <div
                    style={{ width: `${emiResults.principalPct}%` }}
                    className="bg-accent h-full transition-all duration-300"
                    title={`Principal: ${emiResults.principalPct}%`}
                  />
                  <div
                    style={{ width: `${emiResults.interestPct}%` }}
                    className="bg-orange-500 h-full transition-all duration-300"
                    title={`Interest: ${emiResults.interestPct}%`}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted font-medium">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-accent" />
                    Principal: {formatMoney(rupeesToPaise(parseFloat(loanPrincipal) || 0))}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                    Interest: {formatMoney(rupeesToPaise(emiResults.totalInterest))}
                  </span>
                </div>
              </div>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Loan Amount (₹)" hint="Total principal">
                <Input
                  inputMode="decimal"
                  value={loanPrincipal}
                  onChange={(e) => setLoanPrincipal(e.target.value)}
                  className="font-mono font-semibold"
                />
              </Field>

              <Field label="Interest Rate (%)" hint="Annual percentage">
                <Input
                  inputMode="decimal"
                  value={loanInterestRate}
                  onChange={(e) => setLoanInterestRate(e.target.value)}
                  className="font-mono font-semibold"
                />
              </Field>

              <Field label="Tenure (Years)" hint="Duration of loan">
                <Input
                  inputMode="decimal"
                  value={loanTenureYears}
                  onChange={(e) => setLoanTenureYears(e.target.value)}
                  className="font-mono font-semibold"
                />
              </Field>
            </div>

            <div className="rounded-xl border border-line/60 bg-raised/40 p-3 text-xs flex items-center justify-between text-muted">
              <span>Total Repayable (Principal + Interest):</span>
              <span className="font-bold text-ink font-mono text-sm">
                {formatMoney(rupeesToPaise(emiResults.totalAmount))}
              </span>
            </div>
          </div>
        ) : null}

        {/* --- SIP / WEALTH GROWTH TAB --- */}
        {activeTab === 'sip' ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-line/70 bg-surface/95 p-4 space-y-3 shadow-inner">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
                Estimated Future Value
              </span>
              <div className="text-3xl font-bold text-teal-500 font-mono tracking-tight">
                {formatMoney(rupeesToPaise(sipResults.totalValue))}
              </div>

              {/* Split Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="h-2 w-full rounded-full bg-raised overflow-hidden flex">
                  <div
                    style={{ width: `${sipResults.investedPct}%` }}
                    className="bg-accent h-full transition-all duration-300"
                    title={`Invested: ${sipResults.investedPct}%`}
                  />
                  <div
                    style={{ width: `${sipResults.gainPct}%` }}
                    className="bg-teal-500 h-full transition-all duration-300"
                    title={`Gain: ${sipResults.gainPct}%`}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted font-medium">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-accent" />
                    Invested: {formatMoney(rupeesToPaise(sipResults.totalInvested))}
                  </span>
                  <span className="flex items-center gap-1 text-good">
                    <span className="h-2 w-2 rounded-full bg-teal-500" />
                    Est. Gain: +{formatMoney(rupeesToPaise(sipResults.wealthGain))}
                  </span>
                </div>
              </div>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Monthly SIP (₹)" hint="Monthly contribution">
                <Input
                  inputMode="decimal"
                  value={sipMonthly}
                  onChange={(e) => setSipMonthly(e.target.value)}
                  className="font-mono font-semibold"
                />
              </Field>

              <Field label="Expected Return (%)" hint="Annual CAGR">
                <Input
                  inputMode="decimal"
                  value={sipReturnRate}
                  onChange={(e) => setSipReturnRate(e.target.value)}
                  className="font-mono font-semibold"
                />
              </Field>

              <Field label="Time Horizon (Years)" hint="Investment duration">
                <Input
                  inputMode="decimal"
                  value={sipYears}
                  onChange={(e) => setSipYears(e.target.value)}
                  className="font-mono font-semibold"
                />
              </Field>
            </div>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}