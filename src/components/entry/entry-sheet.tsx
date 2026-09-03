'use client';

import { Banknote, CreditCard, Landmark, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { addMonthsToKey, formatMonthShort, monthOf, today as todayISO } from '@/domain/dates';
import { formatAmount, parseAmount } from '@/domain/money';
import type { Direction, Entry } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { AccountPicker } from '@/components/account/account-picker-modal';
import { CategoryPicker } from '@/components/category/category-picker-modal';
import { Field, Input, Segmented, Switch, Textarea } from '@/components/ui/input';
import { QuickDatePicker } from '@/components/ui/quick-date-picker';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useLedger } from '@/lib/store';

const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: 'out', label: 'Out' },
  { value: 'in', label: 'In' },
  { value: 'transfer', label: 'Transfer' },
];

/**
 * Editing an entry.
 *
 * A correction to the category is not just saved — it is remembered, so the
 * same merchant is filed correctly next time without being asked. That single
 * behaviour is what makes categorisation improve with use instead of staying
 * exactly as dumb as the day the app was installed.
 */
export function EntrySheet({
  entry,
  onClose,
}: {
  entry: Entry | null;
  onClose: () => void;
}) {
  const { ledger, updateEntry, deleteEntry, recategorise, addEntry } = useLedger();
  const toast = useToast();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO());
  const [direction, setDirection] = useState<Direction>('out');
  const [accountId, setAccountId] = useState('');
  const [counterAccountId, setCounterAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [tags, setTags] = useState('');
  const [note, setNote] = useState('');
  const [budgetMonth, setBudgetMonth] = useState('');
  const [reimbursable, setReimbursable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setAmount(formatAmount(entry.amount));
    setDescription(entry.description);
    setDate(entry.date);
    setDirection(entry.direction);
    setAccountId(entry.accountId);
    setCounterAccountId(entry.counterAccountId ?? '');
    setCategoryId(entry.categoryId ?? '');
    setTags(entry.tags.join(' '));
    setNote(entry.note ?? '');
    setBudgetMonth(entry.budgetMonth ?? '');
    setReimbursable(entry.reimbursable === true);
  }, [entry]);

  const accounts = useMemo(
    () => ledger.accounts.filter((a) => !a.archived || a.id === entry?.accountId),
    [ledger.accounts, entry?.accountId],
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
      if (c.archived && c.id !== entry?.categoryId) return false;
      if (direction === 'in') return c.kind === 'income' || c.id === categoryId;
      return c.kind !== 'income' || c.id === categoryId;
    });
  }, [ledger.categories, entry?.categoryId, direction, categoryId]);

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

  const save = async () => {
    if (!entry) return;
    const paise = parseAmount(amount);
    if (paise === null || paise <= 0) {
      toast('That amount does not look right.', { tone: 'bad' });
      return;
    }
    if (direction === 'transfer' && (!counterAccountId || counterAccountId === accountId)) {
      toast('A transfer needs a different account to land in.', { tone: 'bad' });
      return;
    }

    setBusy(true);
    try {
      const nextCategory = direction === 'transfer' ? undefined : categoryId || undefined;

      await updateEntry(entry.id, {
        amount: paise,
        description: description.trim() || 'Untitled',
        date,
        direction,
        accountId,
        counterAccountId: direction === 'transfer' ? counterAccountId : undefined,
        categoryId: nextCategory,
        tags: tags
          .split(/[\s,]+/)
          .map((t) => t.replace(/^#/, '').toLowerCase())
          .filter(Boolean),
        note: note.trim() || undefined,
        budgetMonth: direction === 'in' ? budgetMonth || undefined : undefined,
        reimbursable: reimbursable || undefined,
      });

      // The category changed by hand: teach the categoriser.
      if (nextCategory && nextCategory !== entry.categoryId) {
        await recategorise({ ...entry, categoryId: nextCategory }, nextCategory);
      }

      onClose();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not save.', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!entry) return;
    const { id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = entry;

    setBusy(true);
    try {
      await deleteEntry(id);
      onClose();
      // No confirmation dialog, because there is a real undo. Restoring writes a
      // new row rather than resurrecting the old id, which is the honest thing:
      // it is a new entry that happens to say the same words.
      toast('Deleted.', { tone: 'info', undo: () => addEntry(draft).then(() => undefined) });
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not delete.', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };

  const isTransfer = direction === 'transfer';

  return (
    <Sheet
      open={entry !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Edit entry"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={remove}
            disabled={busy}
            className="gap-1.5 text-bad hover:bg-bad/10 hover:text-bad font-medium"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          <Button variant="primary" onClick={save} disabled={busy} className="flex-1">
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Segmented options={DIRECTIONS} value={direction} onChange={handleDirectionChange} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Amount">
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="tnum"
            />
          </Field>
          <Field label="Description">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>

        <Field label="Date" hint="Tap a quick preset or pick from calendar">
          <QuickDatePicker value={date} onChange={setDate} />
        </Field>

        <Field label={isTransfer ? 'From account' : 'Account'}>
          <AccountPicker
            value={accountId}
            onChange={setAccountId}
            accounts={accounts}
          />
        </Field>

        {isTransfer ? (
          <Field label="To account">
            <AccountPicker
              value={counterAccountId}
              onChange={setCounterAccountId}
              accounts={accounts.filter((a) => a.id !== accountId)}
              placeholder="Choose destination account…"
            />
          </Field>
        ) : (
          <Field
            label="Category"
            hint="Changing this teaches the app how to file this merchant next time."
          >
            <CategoryPicker
              value={categoryId}
              onChange={setCategoryId}
              categories={categories}
              allowClear
            />
          </Field>
        )}

        {!isTransfer && direction === 'in' ? (
          <Field
            label="Funds budget for"
            hint="Which month this income counts toward in Plan, Inflow & Sankey."
          >
            <Segmented
              options={[
                { value: 'auto', label: 'Auto (Payday)' },
                { value: monthOf(date), label: formatMonthShort(monthOf(date)) },
                {
                  value: addMonthsToKey(monthOf(date), 1),
                  label: `${formatMonthShort(addMonthsToKey(monthOf(date), 1))} (Next)`,
                },
              ]}
              value={budgetMonth || 'auto'}
              onChange={(val) => setBudgetMonth(val === 'auto' ? '' : val)}
            />
          </Field>
        ) : null}

        <Field label="Tags" hint="Space separated. Useful for a trip or a project.">
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="goa wedding"
            autoCapitalize="none"
          />
        </Field>

        <Field label="Note">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </Field>

        {!isTransfer && direction === 'out' ? (
          <div className="rounded-xl bg-raised px-3.5 py-3">
            <Switch
              checked={reimbursable}
              onChange={setReimbursable}
              label="Someone owes me this"
              hint="Shows in Owed to me until you mark it settled."
            />
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
