'use client';

import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { formatAmount, parseAmount } from '@/domain/money';
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
 * The opening balance is asked for once, plainly, because a balance that starts
 * at zero when the bank says ₹42,000 makes every derived number wrong and there
 * is no way for the app to discover that on its own.
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
  const [opening, setOpening] = useState('0');
  const [excluded, setExcluded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(account?.name ?? '');
    setType(account?.type ?? 'bank');
    setOpening(account ? formatAmount(Math.abs(account.openingBalance)) : '0');
    setExcluded(account?.excludeFromSafeToSpend === true);
  }, [open, account]);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast('Give it a name.', { tone: 'bad' });
      return;
    }

    const parsed = parseAmount(opening || '0');
    if (parsed === null) {
      toast('That opening balance does not look right.', { tone: 'bad' });
      return;
    }

    // A card's balance is money owed, so it is stored negative and typed positive.
    const openingBalance = type === 'card' ? -Math.abs(parsed) : parsed;

    setBusy(true);
    try {
      if (account) {
        await updateAccount(account.id, {
          name: trimmed,
          type,
          openingBalance,
          excludeFromSafeToSpend: excluded || undefined,
        });
      } else {
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
          label={type === 'card' ? 'Amount currently owed' : 'Balance right now'}
          hint={
            type === 'card'
              ? 'What the statement says you owe. Entered as a positive number.'
              : 'Open your banking app and copy the figure. Everything downstream depends on this being real.'
          }
        >
          <Input
            inputMode="decimal"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
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
