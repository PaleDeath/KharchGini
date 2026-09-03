'use client';

import { Check, CreditCard, Landmark } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { today as todayISO } from '@/domain/dates';
import { formatAmount, formatMoney, parseAmount, type Paise } from '@/domain/money';
import type { Account } from '@/domain/types';
import { AccountPicker } from '@/components/account/account-picker-modal';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { QuickDatePicker } from '@/components/ui/quick-date-picker';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useLedger } from '@/lib/store';

export function PayBillSheet({
  card,
  owed,
  open,
  onClose,
}: {
  card: Account | null;
  owed: Paise;
  open: boolean;
  onClose: () => void;
}) {
  const { ledger, addEntries } = useLedger();
  const toast = useToast();

  const liquidAccounts = useMemo(
    () => ledger.accounts.filter((a) => a.type !== 'card' && !a.archived),
    [ledger.accounts],
  );

  const [fromAccountId, setFromAccountId] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !card) return;
    const defaultBank =
      liquidAccounts.find((a) => a.type === 'bank') ?? liquidAccounts[0];
    setFromAccountId(defaultBank?.id ?? '');
    setAmountInput(owed > 0 ? formatAmount(owed) : '0');
    setDate(todayISO());
  }, [open, card, owed, liquidAccounts]);

  const handlePay = async () => {
    if (!card) return;
    if (!fromAccountId) {
      toast('Please select which bank account you are paying from.', { tone: 'bad' });
      return;
    }

    const parsed = parseAmount(amountInput);
    if (parsed === null || parsed <= 0) {
      toast('Please enter a valid payment amount.', { tone: 'bad' });
      return;
    }

    const sourceAccount = ledger.accounts.find((a) => a.id === fromAccountId);

    setBusy(true);
    try {
      await addEntries([
        {
          date,
          amount: parsed,
          direction: 'transfer',
          accountId: fromAccountId,
          counterAccountId: card.id,
          description: `Pay ${card.name} Bill`,
          tags: ['bill-payment', 'credit-card'],
          source: 'manual',
        },
      ]);

      toast(
        `Recorded payment of ${formatMoney(parsed)} from ${sourceAccount?.name ?? 'Account'} for ${card.name}.`,
        { tone: 'good' },
      );
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not record payment', {
        tone: 'bad',
      });
    } finally {
      setBusy(false);
    }
  };

  if (!card) return null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={`Pay ${card.name} Bill`}
      description="Record a bill payment transfer to clear or reduce your card balance."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy} className="font-semibold">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handlePay}
            disabled={busy || !fromAccountId}
            className="flex-1 font-semibold gap-1.5 shadow-xs"
          >
            <Check className="h-4 w-4 stroke-[2.5]" />
            Record Payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Card Summary Banner */}
        <div className="rounded-xl border border-line/70 bg-raised/50 p-4 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Current Owed
            </span>
            <span className="text-lg font-bold text-bad tnum">
              {formatMoney(owed)}
            </span>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            This records an internal transfer moving money from your chosen bank account directly to <span className="font-medium text-ink">{card.name}</span>.
          </p>
        </div>

        {/* Source Account Selector */}
        <Field
          label="Paid from account"
          hint="Select the bank or liquid account used to pay this credit card bill."
        >
          <AccountPicker
            value={fromAccountId}
            onChange={setFromAccountId}
            accounts={liquidAccounts}
            placeholder="Select payment source account…"
          />
        </Field>

        {/* Amount */}
        <Field label="Payment amount" hint="Pay the full statement balance or enter a custom amount.">
          <div className="space-y-1.5">
            <Input
              inputMode="decimal"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="tnum font-bold text-base"
              placeholder="0"
            />
            {owed > 0 && parseAmount(amountInput) !== owed ? (
              <button
                type="button"
                onClick={() => setAmountInput(formatAmount(owed))}
                className="text-xs font-semibold text-accent hover:underline inline-block pt-0.5"
              >
                Pay full balance ({formatMoney(owed)})
              </button>
            ) : null}
          </div>
        </Field>

        {/* Date */}
        <Field label="Payment date" hint="The day the money left your bank account.">
          <QuickDatePicker value={date} onChange={setDate} />
        </Field>
      </div>
    </Sheet>
  );
}