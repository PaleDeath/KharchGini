'use client';

import {
  Calculator as CalcIcon,
  Copy,
  Delete,
  Landmark,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { formatMoney, rupeesToPaise } from '@/domain/money';
import {
  calculateEmi,
  calculateSip,
  evaluateExpression,
  safeCalculate,
} from '@/domain/calculator';
import { Field, Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

type CalcTab = 'standard' | 'emi' | 'sip';

/**
 * Format calculator display string to Indian currency style
 * while preserving decimals and trailing dots while typing.
 */
function formatCalculatorDisplay(display: string): string {
  if (!display || display === '0' || display === '-0') return '₹0';
  if (display.endsWith('%')) return display;
  if (display === 'Error' || display === 'Cannot divide by zero') return display;

  const isNegative = display.startsWith('-');
  const clean = isNegative ? display.slice(1) : display;

  // Handle scientific notation or non-numeric tokens cleanly
  if (/[eE]/.test(clean)) {
    const n = Number(display);
    if (!Number.isFinite(n)) return 'Error';
    return `${isNegative ? '−' : ''}₹${clean}`;
  }

  const parts = clean.split('.');
  const intPart = parts[0] || '0';
  const decPart = parts.length > 1 ? parts[1] : null;

  const num = parseInt(intPart, 10);
  const formattedInt = Number.isNaN(num) ? '0' : num.toLocaleString('en-IN');
  const sign = isNegative ? '−' : '';

  if (decPart !== null) {
    return `${sign}₹${formattedInt}.${decPart}`;
  }
  return `${sign}₹${formattedInt}`;
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
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  // --- EMI Calculator State ---
  const [loanPrincipal, setLoanPrincipal] = useState('1000000'); // ₹10,00,000
  const [loanInterestRate, setLoanInterestRate] = useState('8.5'); // 8.5%
  const [loanTenureYears, setLoanTenureYears] = useState('5'); // 5 years

  // --- SIP Calculator State ---
  const [sipMonthly, setSipMonthly] = useState('10000'); // ₹10,00,000/mo
  const [sipReturnRate, setSipReturnRate] = useState('12'); // 12%
  const [sipYears, setSipYears] = useState('10'); // 10 years

  const copyToClipboard = useCallback(
    (textToCopy: string, label = 'Copied to clipboard') => {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(textToCopy)
          .then(() => toast(label, { tone: 'good' }))
          .catch(() => toast('Could not copy to clipboard', { tone: 'bad' }));
      } else {
        toast('Clipboard not available', { tone: 'bad' });
      }
    },
    [toast],
  );

  // Handle digit inputs ('0'-'9', '00')
  const handleDigit = useCallback(
    (digit: string) => {
      if (hasCalculated || waitingForOperand) {
        if (hasCalculated) {
          setEquation('');
        }
        setDisplay(digit === '00' ? '0' : digit);
        setHasCalculated(false);
        setWaitingForOperand(false);
        return;
      }

      setDisplay((prev) => {
        if (prev === '0' || prev === '-0' || prev === 'Cannot divide by zero' || prev === 'Error') {
          return digit === '00' ? '0' : digit;
        }
        // Limit digit input length to avoid layout overflow
        if (prev.length >= 15) return prev;
        return prev + digit;
      });
    },
    [hasCalculated, waitingForOperand],
  );

  // Handle decimal point input
  const handleDecimal = useCallback(() => {
    if (hasCalculated || waitingForOperand) {
      if (hasCalculated) {
        setEquation('');
      }
      setDisplay('0.');
      setHasCalculated(false);
      setWaitingForOperand(false);
      return;
    }

    setDisplay((prev) => {
      if (prev === 'Cannot divide by zero' || prev === 'Error') return '0.';
      return prev.includes('.') ? prev : prev + '.';
    });
  }, [hasCalculated, waitingForOperand]);

  // Handle operators (+, −, ×, ÷)
  const handleOperator = useCallback(
    (op: string) => {
      if (display === 'Cannot divide by zero' || display === 'Error') {
        setDisplay('0');
        setEquation('');
        setHasCalculated(false);
        setWaitingForOperand(false);
        return;
      }

      if (hasCalculated || equation.includes('=')) {
        setEquation(`${display} ${op} `);
        setHasCalculated(false);
        setWaitingForOperand(true);
        return;
      }

      if (waitingForOperand) {
        // User is replacing the operator (e.g. + changed to ×)
        setEquation((prev) => prev.replace(/[\+\-\−\×\÷\*/]\s*$/, `${op} `));
        return;
      }

      if (equation) {
        // Evaluate running intermediate calculation
        const fullExpr = equation + display;
        const evalRes = evaluateExpression(fullExpr);
        if (evalRes.ok) {
          setDisplay(String(evalRes.value));
          setEquation(`${evalRes.value} ${op} `);
        } else {
          setEquation(`${equation}${display} ${op} `);
        }
      } else {
        setEquation(`${display} ${op} `);
      }

      setWaitingForOperand(true);
    },
    [display, equation, hasCalculated, waitingForOperand],
  );

  // Handle percentage calculation
  const handlePercent = useCallback(() => {
    if (waitingForOperand) return;

    if (display === 'Cannot divide by zero' || display === 'Error') return;

    // If already calculated, has '=', or equation is empty: calculate standalone percent
    if (hasCalculated || equation.includes('=') || !equation) {
      const val = parseFloat(display) || 0;
      const res = Math.round((val / 100) * 100000000) / 100000000;
      setEquation(`${display}% =`);
      setDisplay(String(res));
      setHasCalculated(true);
      setWaitingForOperand(false);
      return;
    }

    // Contextual percentage calculation within pending expression (e.g. 1000 + 18%)
    const fullExpr = `${equation}${display}%`;
    const evalRes = evaluateExpression(fullExpr);
    if (evalRes.ok) {
      setEquation(`${fullExpr} =`);
      setDisplay(String(evalRes.value));
      setHasCalculated(true);
      setWaitingForOperand(false);
    } else {
      if (evalRes.error === 'DIV_ZERO') {
        toast('Cannot divide by zero', { tone: 'bad' });
        setDisplay('Cannot divide by zero');
        setHasCalculated(true);
        setWaitingForOperand(false);
      } else {
        toast('Invalid calculation', { tone: 'bad' });
      }
    }
  }, [display, equation, hasCalculated, toast, waitingForOperand]);

  // Handle clear (AC)
  const handleClear = useCallback(() => {
    setDisplay('0');
    setEquation('');
    setHasCalculated(false);
    setWaitingForOperand(false);
  }, []);

  // Handle delete (Backspace)
  const handleDelete = useCallback(() => {
    if (hasCalculated) {
      handleClear();
      return;
    }

    if (waitingForOperand) {
      // User entered an operator and wants to undo it
      setEquation('');
      setWaitingForOperand(false);
      return;
    }

    setDisplay((prev) => {
      if (prev === 'Cannot divide by zero' || prev === 'Error') {
        return '0';
      }
      if (prev.length <= 1 || prev === '-0' || (prev.length === 2 && prev.startsWith('-'))) {
        if (equation && prev === '0') {
          const trimmed = equation.replace(/[\+\-\−\×\÷\*/]\s*$/, '').trim();
          setEquation('');
          return trimmed || '0';
        }
        return '0';
      }
      return prev.slice(0, -1);
    });
  }, [hasCalculated, handleClear, waitingForOperand, equation]);

  // Handle equal (=)
  const handleEqual = useCallback(() => {
    // Avoid re-calculating if already completed
    if (hasCalculated) return;

    if (display === 'Cannot divide by zero' || display === 'Error') {
      handleClear();
      return;
    }

    let fullExpr: string;
    if (waitingForOperand) {
      // Trailing operator before '=': evaluate expression up to the operator
      fullExpr = equation.replace(/[\+\-\−\×\÷\*/]\s*$/, '');
    } else if (equation.includes('=')) {
      fullExpr = display;
    } else {
      fullExpr = equation ? `${equation}${display}` : display;
    }

    const evalRes = evaluateExpression(fullExpr);
    if (evalRes.ok) {
      setEquation(`${fullExpr} =`);
      setDisplay(String(evalRes.value));
      setHasCalculated(true);
      setWaitingForOperand(false);
    } else {
      if (evalRes.error === 'DIV_ZERO') {
        toast('Cannot divide by zero', { tone: 'bad' });
        setDisplay('Cannot divide by zero');
        setHasCalculated(true);
        setWaitingForOperand(false);
      } else {
        toast('Invalid calculation', { tone: 'bad' });
      }
    }
  }, [display, equation, hasCalculated, handleClear, toast, waitingForOperand]);

  // Quick Multipliers
  const handleMultiplyAnnual = useCallback(() => {
    const current = parseFloat(display) || 0;
    const res = Math.round(current * 12);
    setEquation(`${current} × 12 =`);
    setDisplay(String(res));
    setHasCalculated(true);
    setWaitingForOperand(false);
  }, [display]);

  const handleDivideDaily = useCallback(() => {
    const current = parseFloat(display) || 0;
    const res = Math.round((current / 30) * 100) / 100;
    setEquation(`${current} ÷ 30 =`);
    setDisplay(String(res));
    setHasCalculated(true);
    setWaitingForOperand(false);
  }, [display]);

  const handleAddAmount = useCallback((addVal: number) => {
    if (hasCalculated || equation.includes('=')) {
      setEquation('');
      setDisplay((prev) => {
        const cur = parseFloat(prev) || 0;
        return String(cur + addVal);
      });
      setHasCalculated(false);
      setWaitingForOperand(false);
      return;
    }

    if (waitingForOperand) {
      setDisplay(String(addVal));
      setWaitingForOperand(false);
      return;
    }

    setDisplay((prev) => {
      const current = parseFloat(prev) || 0;
      return String(current + addVal);
    });
    setHasCalculated(false);
    setWaitingForOperand(false);
  }, [equation, hasCalculated, waitingForOperand]);

  // Keyboard shortcut listener for active calculator
  useEffect(() => {
    if (!open || activeTab !== 'standard') return;

    const onKey = (e: KeyboardEvent) => {
      // Don't intercept when typing in form inputs
      if (
        e.target instanceof HTMLElement &&
        (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        e.stopPropagation();
        handleDigit(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        e.stopPropagation();
        handleDecimal();
      } else if (e.key === '+') {
        e.preventDefault();
        e.stopPropagation();
        handleOperator('+');
      } else if (e.key === '-') {
        e.preventDefault();
        e.stopPropagation();
        handleOperator('−');
      } else if (e.key === '*' || e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        e.stopPropagation();
        handleOperator('×');
      } else if (e.key === '/') {
        e.preventDefault();
        e.stopPropagation();
        handleOperator('÷');
      } else if (e.key === '%') {
        e.preventDefault();
        e.stopPropagation();
        handlePercent();
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        e.stopPropagation();
        handleEqual();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        e.stopPropagation();
        handleDelete();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        handleClear();
      } else if ((e.key === 'c' || e.key === 'C') && (e.metaKey || e.ctrlKey)) {
        // If no text is selected by user, copy the display amount
        if (!window.getSelection()?.toString()) {
          copyToClipboard(display, 'Amount copied!');
        }
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')
      ) {
        return;
      }

      const pastedText = e.clipboardData?.getData('text')?.trim();
      if (!pastedText) return;

      const evalRes = evaluateExpression(pastedText);
      if (evalRes.ok) {
        e.preventDefault();
        setEquation(`${pastedText} =`);
        setDisplay(String(evalRes.value));
        setHasCalculated(true);
        setWaitingForOperand(false);
      }
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
  }, [
    open,
    activeTab,
    display,
    onClose,
    copyToClipboard,
    handleDigit,
    handleDecimal,
    handleOperator,
    handlePercent,
    handleEqual,
    handleDelete,
    handleClear,
  ]);

  // --- EMI Calculation Logic ---
  const emiResults = useMemo(() => {
    const cleanPrincipal = parseFloat(loanPrincipal.replace(/,/g, '')) || 0;
    const cleanRate = parseFloat(loanInterestRate.replace(/,/g, '')) || 0;
    const cleanTenure = parseFloat(loanTenureYears.replace(/,/g, '')) || 0;
    return calculateEmi(cleanPrincipal, cleanRate, cleanTenure);
  }, [loanPrincipal, loanInterestRate, loanTenureYears]);

  // --- SIP Calculation Logic ---
  const sipResults = useMemo(() => {
    const cleanMonthly = parseFloat(sipMonthly.replace(/,/g, '')) || 0;
    const cleanRate = parseFloat(sipReturnRate.replace(/,/g, '')) || 0;
    const cleanYears = parseFloat(sipYears.replace(/,/g, '')) || 0;
    return calculateSip(cleanMonthly, cleanRate, cleanYears);
  }, [sipMonthly, sipReturnRate, sipYears]);

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
                {formatCalculatorDisplay(display)}
              </div>

              {/* Copy / Quick Actions */}
              <div className="flex items-center justify-between pt-1 border-t border-line/40">
                <span className="text-[10px] text-faint font-mono">
                  {currentDisplayNumber !== 0
                    ? currentDisplayNumber < 0
                      ? `-₹${Math.abs(currentDisplayNumber).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                      : `₹${currentDisplayNumber.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
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
                onClick={handlePercent}
                className="rounded-xl border border-line/70 bg-raised/60 text-muted font-bold text-sm py-3 hover:bg-raised hover:text-ink active:scale-95 transition-all shadow-2xs"
              >
                %
              </button>
              <button
                type="button"
                onClick={() => handleOperator('÷')}
                className="rounded-xl border border-accent/40 bg-accent/15 text-accent font-bold text-base py-3 hover:bg-accent/25 active:scale-95 transition-all shadow-2xs"
              >
                ÷
              </button>

              {/* Row 2 */}
              <button
                type="button"
                onClick={() => handleDigit('7')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                7
              </button>
              <button
                type="button"
                onClick={() => handleDigit('8')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                8
              </button>
              <button
                type="button"
                onClick={() => handleDigit('9')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                9
              </button>
              <button
                type="button"
                onClick={() => handleOperator('×')}
                className="rounded-xl border border-accent/40 bg-accent/15 text-accent font-bold text-base py-3 hover:bg-accent/25 active:scale-95 transition-all shadow-2xs"
              >
                ×
              </button>

              {/* Row 3 */}
              <button
                type="button"
                onClick={() => handleDigit('4')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                4
              </button>
              <button
                type="button"
                onClick={() => handleDigit('5')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                5
              </button>
              <button
                type="button"
                onClick={() => handleDigit('6')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                6
              </button>
              <button
                type="button"
                onClick={() => handleOperator('−')}
                className="rounded-xl border border-accent/40 bg-accent/15 text-accent font-bold text-base py-3 hover:bg-accent/25 active:scale-95 transition-all shadow-2xs"
              >
                −
              </button>

              {/* Row 4 */}
              <button
                type="button"
                onClick={() => handleDigit('1')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => handleDigit('2')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                2
              </button>
              <button
                type="button"
                onClick={() => handleDigit('3')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                3
              </button>
              <button
                type="button"
                onClick={() => handleOperator('+')}
                className="rounded-xl border border-accent/40 bg-accent/15 text-accent font-bold text-base py-3 hover:bg-accent/25 active:scale-95 transition-all shadow-2xs"
              >
                +
              </button>

              {/* Row 5 */}
              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="rounded-xl border border-line/70 bg-surface text-ink font-semibold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleDecimal}
                className="rounded-xl border border-line/70 bg-surface text-ink font-bold text-base py-3 hover:bg-raised active:scale-95 transition-all shadow-2xs font-mono"
              >
                .
              </button>
              <button
                type="button"
                onClick={() => handleDigit('00')}
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
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
                  Monthly Repayment (EMI)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(String(emiResults.emi), 'EMI amount copied!')}
                    className="p-1 text-muted hover:text-ink rounded hover:bg-raised transition-colors"
                    title="Copy EMI"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  {onLogSpend && emiResults.emi > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        onLogSpend(emiResults.emi);
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
                    Principal: {formatMoney(rupeesToPaise(parseFloat(loanPrincipal.replace(/,/g, '')) || 0))}
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
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
                  Estimated Future Value
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(String(sipResults.totalValue), 'Future value copied!')}
                  className="p-1 text-muted hover:text-ink rounded hover:bg-raised transition-colors"
                  title="Copy future value"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
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