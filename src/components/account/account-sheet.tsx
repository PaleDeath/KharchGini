'use client';

import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { formatAmount, formatMoney, parseAmount } from '@/domain/money';
import { accountBalance } from '@/domain/derive';
import { ACCOUNT_TYPE_LABEL, type Account, type AccountType } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Switch } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useLedger } from '@/lib/store';

const TYPES = Object.keys(ACCOUNT_TYPE_LABEL) as AccountType[];

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

    setBusy(true);
    try {
      if (account) {
        // Target current balance after reconciliation
        const targetBalance = type === 'card' ? -Math.abs(parsed) : parsed;
        // Adjusted opening balance: targetBalance = openingBalance + entriesDelta => openingBalance = targetBalance - entriesDelta
        const openingBalance = targetBalance - entriesDelta;

        await updateAccount(account.id, {
          name: trimmed,
          type,
          openingBalance,
          excludeFromSafeToSpend: excluded || undefined,
        });
      } else {
        const openingBalance = type === 'card' ? -Math.abs(parsed) : parsed;
        await addAccount({
          name: trimmed,
          type,
          openingBalance,
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

        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {TYPES.map((option) => (
              <option key={option} value={option}>
                {ACCOUNT_TYPE_LABEL[option]}
              </option>
            ))}
          </Select>
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

        {type !== 'card' ? (
          <div className="rounded-xl bg-raised px-3.5 py-3">
            <Switch
              checked={excluded}
              onChange={setExcluded}
              label="Money I have set aside"
              hint="Counts towards net worth, never towards Safe to Spend."
            />
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
