'use client';

import { Banknote, CreditCard, Landmark, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { addMonths, today as todayISO, type ISODate } from '@/domain/dates';
import { formatAmount, parseAmount } from '@/domain/money';
import { FREQUENCY_LABEL, type Direction, type Frequency, type Recurring } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { CategorySelect } from '@/components/ui/category-select';
import { CustomSelect, type Option } from '@/components/ui/custom-select';
import { Field, Input, Segmented, Switch } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useLedger } from '@/lib/store';

const FREQUENCIES = Object.keys(FREQUENCY_LABEL) as Frequency[];

const FREQUENCY_OPTIONS: Option<Frequency>[] = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'yearly', label: 'Every year' },
];

const DURATION_OPTIONS: Option<'never' | 'months' | 'date'>[] = [
  { value: 'never', label: 'Runs indefinitely' },
  { value: 'months', label: 'Fixed installments (EMIs)' },
  { value: 'date', label: 'Specific end date' },
];

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: 'out', label: 'Goes out' },
  { value: 'in', label: 'Comes in' },
  { value: 'transfer', label: 'Moves' },
];

/**
 * Anything that happens on a schedule.
 *
 * The important switch here is `autoPost`. Rent is the same number every month
 * and should just appear. An electricity bill is not, and posting a guess would
 * be worse than posting nothing — so a variable bill waits in "Coming up" for
 * one tap that confirms the real amount.
 */
export function RecurringSheet({
  recurring,
  open,
  onClose,
}: {
  recurring: Recurring | null;
  open: boolean;
  onClose: () => void;
}) {
  const { ledger, addRecurring, updateRecurring, deleteRecurring } = useLedger();
  const toast = useToast();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<Direction>('out');
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [startDate, setStartDate] = useState(todayISO());
  const [endMode, setEndMode] = useState<'never' | 'months' | 'date'>('never');
  const [installments, setInstallments] = useState('12');
  const [customEndDate, setCustomEndDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [counterAccountId, setCounterAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [autoPost, setAutoPost] = useState(true);
  const [variableAmount, setVariableAmount] = useState(false);
  const [busy, setBusy] = useState(false);

  const accounts = useMemo(
    () => ledger.accounts.filter((a) => !a.archived || a.id === recurring?.accountId),
    [ledger.accounts, recurring?.accountId],
  );

  const accountOptions = useMemo(
    () =>
      accounts.map((acc) => ({
        value: acc.id,
        label: acc.name,
        icon:
          acc.type === 'card' ? (
            <CreditCard className="h-4 w-4 text-orange-500" />
          ) : acc.type === 'cash' ? (
            <Banknote className="h-4 w-4 text-emerald-500" />
          ) : (
            <Landmark className="h-4 w-4 text-accent" />
          ),
      })),
    [accounts],
  );

  const counterAccountOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.id !== accountId)
        .map((acc) => ({
          value: acc.id,
          label: acc.name,
          icon:
            acc.type === 'card' ? (
              <CreditCard className="h-4 w-4 text-orange-500" />
            ) : acc.type === 'cash' ? (
              <Banknote className="h-4 w-4 text-emerald-500" />
            ) : (
              <Landmark className="h-4 w-4 text-accent" />
            ),
        })),
    [accounts, accountId],
  );

  const categories = useMemo(() => {
    return ledger.categories.filter((c) => {
      if (c.archived && c.id !== recurring?.categoryId) return false;
      if (direction === 'in') return c.kind === 'income' || c.id === categoryId;
      return c.kind !== 'income' || c.id === categoryId;
    });
  }, [ledger.categories, recurring?.categoryId, direction, categoryId]);

  const handleDirectionChange = (nextDir: Direction) => {
    setDirection(nextDir);
    if (categoryId) {
      const currentCat = ledger.categories.find((c) => c.id === categoryId);
      if (nextDir === 'in' && currentCat && currentCat.kind !== 'income') {
        setCategoryId('');
      } else if (nextDir === 'out' && currentCat && currentCat.kind === 'income') {
        setCategoryId('');
      }
    }
  };

  useEffect(() => {
    if (!open) return;
    setDescription(recurring?.description ?? '');
    setAmount(recurring ? formatAmount(recurring.amount) : '');
    setDirection(recurring?.direction ?? 'out');
    setFrequency(recurring?.frequency ?? 'monthly');
    setStartDate(recurring?.startDate ?? todayISO());
    if (recurring?.endDate) {
      setEndMode('date');
      setCustomEndDate(recurring.endDate);
    } else {
      setEndMode('never');
      setCustomEndDate('');
    }
    setAccountId(recurring?.accountId ?? ledger.accounts[0]?.id ?? '');
    setCounterAccountId(recurring?.counterAccountId ?? '');
    setCategoryId(recurring?.categoryId ?? '');
    setAutoPost(recurring?.autoPost ?? true);
    setVariableAmount(recurring?.variableAmount ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recurring]);

  const save = async () => {
    const trimmed = description.trim();
    const paise = parseAmount(amount);

    if (!trimmed) {
      toast('What is it called?', { tone: 'bad' });
      return;
    }
    if (paise === null || paise <= 0) {
      toast('That amount does not look right.', { tone: 'bad' });
      return;
    }
    if (!accountId) {
      toast('Which account does it hit?', { tone: 'bad' });
      return;
    }
    if (direction === 'transfer' && (!counterAccountId || counterAccountId === accountId)) {
      toast('A move needs somewhere to land.', { tone: 'bad' });
      return;
    }

    setBusy(true);
    try {
      let finalEndDate: ISODate | undefined = undefined;
      if (endMode === 'date' && customEndDate) {
        finalEndDate = customEndDate;
      } else if (endMode === 'months') {
        const count = parseInt(installments, 10);
        if (!isNaN(count) && count > 0) {
          finalEndDate = addMonths(startDate, count);
        }
      }

      const shared = {
        description: trimmed,
        amount: paise,
        direction,
        accountId,
        counterAccountId: direction === 'transfer' ? counterAccountId : undefined,
        categoryId: direction === 'transfer' ? undefined : categoryId || undefined,
        frequency,
        startDate,
        endDate: finalEndDate,
        isActive: true,
        // A varying amount can never be posted unattended: the number would be a
        // guess, and a guess written into the ledger stops being a guess.
        autoPost: variableAmount ? false : autoPost,
        variableAmount,
      };

      if (recurring) await updateRecurring(recurring.id, shared);
      else await addRecurring(shared);
      onClose();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not save.', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!recurring) return;
    setBusy(true);
    try {
      await deleteRecurring(recurring.id);
      onClose();
      toast('Schedule removed. Entries it already wrote are kept.', { tone: 'info' });
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not remove.', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };

  const isTransfer = direction === 'transfer';

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={recurring ? 'Edit schedule' : 'Something that repeats'}
      footer={
        <>
          {recurring ? (
            <Button variant="ghost" size="icon" onClick={remove} disabled={busy} aria-label="Remove">
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
        <Segmented options={DIRECTIONS} value={direction} onChange={handleDirectionChange} />

        <Field label="What is it">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Rent, Netflix, salary…"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={variableAmount ? 'Typical amount' : 'Amount'}>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="tnum"
            />
          </Field>
          <Field label="How often">
            <CustomSelect
              value={frequency}
              onChange={setFrequency}
              options={FREQUENCY_OPTIONS}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Starting" hint="First payment date">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Duration" hint="When it stops repeating">
            <CustomSelect
              value={endMode}
              onChange={setEndMode}
              options={DURATION_OPTIONS}
            />
          </Field>
        </div>

        {endMode === 'months' ? (
          <Field label="Number of installments / months" hint="e.g. 6, 12, 24, 36 months for loans or EMIs">
            <Input
              type="number"
              min="1"
              max="240"
              value={installments}
              onChange={(e) => setInstallments(e.target.value)}
              placeholder="12"
            />
          </Field>
        ) : null}

        {endMode === 'date' ? (
          <Field label="End date" hint="Stops repeating after this date">
            <Input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
          </Field>
        ) : null}

        <Field label={isTransfer ? 'From account' : 'Account'}>
          <CustomSelect
            value={accountId}
            onChange={setAccountId}
            options={accountOptions}
          />
        </Field>

        {isTransfer ? (
          <Field label="To account">
            <CustomSelect
              value={counterAccountId}
              onChange={setCounterAccountId}
              options={counterAccountOptions}
              placeholder="Choose destination account…"
            />
          </Field>
        ) : (
          <Field label="Category">
            <CategorySelect
              value={categoryId}
              onChange={setCategoryId}
              categories={categories}
              allowClear
            />
          </Field>
        )}

        <div className="space-y-3 rounded-xl bg-raised px-3.5 py-3">
          <Switch
            checked={variableAmount}
            onChange={setVariableAmount}
            label="The amount changes"
            hint="Electricity, phone bills. It will wait for you to confirm the real figure."
          />
          {!variableAmount ? (
            <Switch
              checked={autoPost}
              onChange={setAutoPost}
              label="Record it automatically"
              hint="Off means it sits in Coming up until you tap Paid."
            />
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}
