'use client';

import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Circle,
  HelpCircle,
  Plus,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLedger } from '@/lib/store';
import { cn } from '@/lib/utils';

export function GettingStartedCard({
  onOpenTour,
  onOpenAdd,
}: {
  onOpenTour: () => void;
  onOpenAdd: () => void;
}) {
  const { ledger } = useLedger();
  const [dismissed, setDismissed] = useState(false);

  // Derive setup milestones
  const hasAccountsSetup = ledger.accounts.some((a) => a.openingBalance !== 0 || a.name !== 'Cash') || ledger.accounts.length > 1;
  const hasRecurringOrPayday = ledger.recurring.length > 0 || !!ledger.prefs.payday;
  const hasLoggedEntry = ledger.entries.length > 0;

  const completedSteps = [hasAccountsSetup, hasRecurringOrPayday, hasLoggedEntry].filter(Boolean).length;
  const allDone = completedSteps === 3;

  if (dismissed || (allDone && ledger.entries.length >= 3)) {
    return null;
  }

  return (
    <Card className="relative overflow-hidden border-accent/30 bg-gradient-to-br from-surface to-accent/5 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink">Getting Started with KharchGini</h2>
            <p className="text-[12px] text-muted">
              {completedSteps}/3 setup steps completed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenTour}
            className="h-8 gap-1.5 px-2.5 text-[12px] text-accent hover:text-accent font-medium"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            1-min guide
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss checklist"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-faint hover:bg-raised hover:text-muted transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full bg-accent transition-all duration-500 ease-out"
          style={{ width: `${(completedSteps / 3) * 100}%` }}
        />
      </div>

      {/* Steps List */}
      <div className="mt-4 space-y-2.5">
        {/* Step 1 */}
        <Link
          href="/money"
          className={cn(
            'flex items-center justify-between rounded-xl border p-2.5 transition-all text-[13px]',
            hasAccountsSetup
              ? 'border-good/20 bg-good/5 text-ink'
              : 'border-line bg-surface hover:border-accent/40 hover:bg-raised/60 text-ink'
          )}
        >
          <div className="flex items-center gap-2.5">
            {hasAccountsSetup ? (
              <CheckCircle2 className="h-4 w-4 text-good shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-faint shrink-0" />
            )}
            <span className={cn(hasAccountsSetup && 'line-through text-muted')}>
              1. Add your bank accounts & opening balances
            </span>
          </div>
          <span className="flex items-center gap-1 text-[11px] font-medium text-muted">
            <Wallet className="h-3.5 w-3.5" /> Money tab <ArrowRight className="h-3 w-3" />
          </span>
        </Link>

        {/* Step 2 */}
        <Link
          href="/plan"
          className={cn(
            'flex items-center justify-between rounded-xl border p-2.5 transition-all text-[13px]',
            hasRecurringOrPayday
              ? 'border-good/20 bg-good/5 text-ink'
              : 'border-line bg-surface hover:border-accent/40 hover:bg-raised/60 text-ink'
          )}
        >
          <div className="flex items-center gap-2.5">
            {hasRecurringOrPayday ? (
              <CheckCircle2 className="h-4 w-4 text-good shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-faint shrink-0" />
            )}
            <span className={cn(hasRecurringOrPayday && 'line-through text-muted')}>
              2. Add regular bills (Rent, EMIs, Salary)
            </span>
          </div>
          <span className="flex items-center gap-1 text-[11px] font-medium text-muted">
            <CalendarCheck className="h-3.5 w-3.5" /> Plan tab <ArrowRight className="h-3 w-3" />
          </span>
        </Link>

        {/* Step 3 */}
        <button
          type="button"
          onClick={onOpenAdd}
          className={cn(
            'w-full flex items-center justify-between rounded-xl border p-2.5 transition-all text-[13px] text-left',
            hasLoggedEntry
              ? 'border-good/20 bg-good/5 text-ink'
              : 'border-line bg-surface hover:border-accent/40 hover:bg-raised/60 text-ink'
          )}
        >
          <div className="flex items-center gap-2.5">
            {hasLoggedEntry ? (
              <CheckCircle2 className="h-4 w-4 text-good shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-faint shrink-0" />
            )}
            <span className={cn(hasLoggedEntry && 'line-through text-muted')}>
              3. Log your first expense (e.g. &ldquo;250 lunch&rdquo;)
            </span>
          </div>
          <span className="flex items-center gap-1 text-[11px] font-medium text-accent">
            <Plus className="h-3.5 w-3.5" /> Quick log
          </span>
        </button>
      </div>
    </Card>
  );
}
