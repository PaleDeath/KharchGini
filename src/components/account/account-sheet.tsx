'use client';

import { Banknote, CreditCard, Landmark, Trash2, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { formatAmount, formatMoney, parseAmount } from '@/domain/money';
import { accountBalance } from '@/domain/derive';
import { ACCOUNT_TYPE_LABEL, type Account, type AccountType } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { CustomSelect, type Option } from '@/components/ui/custom-select';
import { Field, Input, Switch } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useLedger } from '@/lib/store';

const TYPES = Object.keys(ACCOUNT_TYPE_LABEL) as AccountType[];

const ACCOUNT_TYPE_OPTIONS: Option<AccountType>[] = [
  {
    value: 'bank',
    label: 'Bank Account (Current/Salary)',
    icon: <Landmark className="h-4 w-4 text-accent" />,
  },
  {
    value: 'savings',
    label: 'Savings / Fixed Deposit',
    icon: <Landmark className="h-4 w-4 text-teal-500" />,
  },
  {
    value: 'card',
    label: 'Credit Card',
    icon: <CreditCard className="h-4 w-4 text-orange-500" />,
  },
  {
    value: 'cash',
    label: 'Cash in Hand',
    icon: <Banknote className="h-4 w-4 text-emerald-500" />,
  },
  {
    value: 'wallet',
    label: 'Wallet / UPI Balance',
    icon: <Wallet className="h-4 w-4 text-blue-500" />,
  },
];

/**
 * Accounts are the reason this app can answer "what can I spend".
 *
 * For new accounts, the user enters the starting balance.
 * For existing accounts, it shows the live current balance (including transactions),
 * and adjusting it reconciles the starting balance cleanly without double-counting.
 */
export function AccountSheet({
  account,
  open,
  onClose,
}: {
  /** Null means "new account". */
  account: Account | null;
  open: boolean;
  onClose: () => void;
}) {
  const { ledger, addAccount, updateAccount, deleteAccount } = useLedger();
  const toast = useToast();

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [balanceInput, setBalanceInput] = useState('0');
  const [creditLimitInput, setCreditLimitInput] = useState('');
  const [dueDayInput, setDueDayInput] = useState('');
  const [last4Input, setLast4Input] = useState('');
  const [excluded, setExcluded] = useState(false);
  const [busy, setBusy] = useState(false);

  // Live balance from opening + all recorded transactions
  const liveBalance = useMemo(() => {
    if (!account) return 0;
    return accountBalance(account.id, ledger.accounts, ledger.entries);
  }, [account, ledger.accounts, ledger.entries]);

  // Net delta contributed purely by transactions (entries)
  const entriesDelta = useMemo(() => {
    if (!account) return 0;
    return liveBalance - account.openingBalance;
  }, [account, liveBalance]);

  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? '');
    setType(account?.type ?? 'bank');
    setBalanceInput(account ? formatAmount(Math.abs(liveBalance)) : '0');
    setCreditLimitInput(account?.creditLimit ? formatAmount(account.creditLimit) : '');
    setDueDayInput(account?.billingDueDay ? String(account.billingDueDay) : '');
    setLast4Input(account?.last4 ?? '');
    setExcluded(account?.excludeFromSafeToSpend === true);
  }, [open, account, liveBalance]);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast('Give it a name.', { tone: 'bad' });
      return;
    }

    const parsed = parseAmount(balanceInput || '0');
    if (parsed === null) {
      toast('That balance does not look right.', { tone: 'bad' });
      return;
    }

    const parsedLimit = creditLimitInput.trim() ? (parseAmount(creditLimitInput) ?? undefined) : undefined;
    const parsedDueDay = dueDayInput.trim() ? parseInt(dueDayInput, 10) : undefined;
    const cleanedLast4 = last4Input.trim().slice(-4);

    setBusy(true);
    try {
      if (account) {
        // Target current balance after reconciliation. Normalize zero to prevent -0 IEEE 754 float representation.
        const targetBalance = (type === 'card' ? (parsed === 0 ? 0 : -Math.abs(parsed)) : parsed) || 0;
        // Adjusted opening balance: targetBalance = openingBalance + entriesDelta => openingBalance = targetBalance - entriesDelta
        const openingBalance = (targetBalance - entriesDelta) || 0;

        await updateAccount(account.id, {
          name: trimmed,
          type,
          openingBalance,
          creditLimit: type === 'card' ? parsedLimit : undefined,
          billingDueDay: type === 'card' && parsedDueDay && parsedDueDay >= 1 && parsedDueDay <= 31 ? parsedDueDay : undefined,
          last4: type === 'card' && cleanedLast4 ? cleanedLast4 : undefined,
          excludeFromSafeToSpend: excluded || undefined,
        });
      } else {
        const openingBalance = (type === 'card' ? (parsed === 0 ? 0 : -Math.abs(parsed)) : parsed) || 0;
        await addAccount({
          name: trimmed,
          type,
          openingBalance,
          creditLimit: type === 'card' ? parsedLimit : undefined,
          billingDueDay: type === 'card' && parsedDueDay && parsedDueDay >= 1 && parsedDueDay <= 31 ? parsedDueDay : undefined,
          last4: type === 'card' && cleanedLast4 ? cleanedLast4 : undefined,
          sortOrder: ledger.accounts.length,
          ...(excluded ? { excludeFromSafeToSpend: true } : {}),
        });
      }
      onClose();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not save.', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!account) return;
    setBusy(true);
    try {
      await deleteAccount(account.id);
      onClose();
      toast('Account removed. Any entries it had are kept.', { tone: 'info' });
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not remove.', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={account ? 'Edit account' : 'New account'}
      footer={
        <>
          {account ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={remove}
              disabled={busy}
              aria-label="Remove"
            >
              <Trash2 className="h-4 w-4 text-bad" />
            </Button>
          ) : null}
          <Button variant="primary" onClick={save} disabled={busy} className="flex-1">
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="HDFC, Cash, GPay…"
            autoFocus
          />
        </Field>

        <Field label="Account Type">
          <CustomSelect
            value={type}
            onChange={setType}
            options={ACCOUNT_TYPE_OPTIONS}
          />
        </Field>

        <Field
          label={
            account
              ? type === 'card'
                ? 'Current amount owed'
                : 'Current balance'
              : type === 'card'
                ? 'Amount currently owed'
                : 'Starting balance'
          }
          hint={
            account
              ? entriesDelta !== 0
                ? `Includes ${entriesDelta > 0 ? '+' : ''}${formatMoney(entriesDelta)} from transactions. Adjusting this reconciles your starting balance to match your bank.`
                : type === 'card'
                  ? 'What the statement currently says you owe.'
                  : 'Open your banking app and verify the figure.'
              : type === 'card'
                ? 'What the statement says you owe. Entered as a positive number.'
                : 'What is currently in this account before any entries you record.'
          }
        >
          <Input
            inputMode="decimal"
            value={balanceInput}
            onChange={(e) => setBalanceInput(e.target.value)}
            className="tnum"
          />
        </Field>

        {type === 'card' ? (
          <div className="space-y-3.5 rounded-2xl border border-line bg-raised/40 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-faint">
              Credit Card Details
            </p>

            <Field
              label="Credit Limit"
              hint="Total approved credit limit. Used to calculate credit utilization ratio."
            >
              <Input
                inputMode="decimal"
                value={creditLimitInput}
                onChange={(e) => setCreditLimitInput(e.target.value)}
                placeholder="e.g. 150000"
                className="tnum"
              />
            </Field>

            <div className="grid grid-cols-2 gap-2.5">
              <Field
                label="Bill Due Day"
                hint="Day of month (1-31)"
              >
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={dueDayInput}
                  onChange={(e) => setDueDayInput(e.target.value)}
                  placeholder="e.g. 5"
                />
              </Field>

              <Field
                label="Last 4 Digits"
                hint="For SMS matching"
              >
                <Input
                  maxLength={4}
                  value={last4Input}
                  onChange={(e) => setLast4Input(e.target.value)}
                  placeholder="e.g. 4567"
                />
              </Field>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-raised px-3.5 py-3">
            <Switch
              checked={excluded}
              onChange={setExcluded}
              label="Money I have set aside"
              hint="Counts towards net worth, never towards Safe to Spend."
            />
          </div>
        )}
      </div>
    </Sheet>
  );
}
