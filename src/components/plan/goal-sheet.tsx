'use client';

import { Banknote, Landmark, Trash2, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { formatAmount, parseAmount } from '@/domain/money';
import type { Goal } from '@/domain/types';
import { CategoryIcon } from '@/components/category/category-icon';
import { Button } from '@/components/ui/button';
import { AccountPicker } from '@/components/account/account-picker-modal';
import { Field, Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useLedger } from '@/lib/store';
import { cn } from '@/lib/utils';

const ICONS = [
  'target',
  'plane',
  'home',
  'car',
  'laptop',
  'camera',
  'graduation-cap',
  'heart',
  'stethoscope',
  'shield',
  'music',
  'gift',
  'rocket',
  'trophy',
  'globe',
  'piggy-bank',
];

/**
 * A goal is a name attached to an account, nothing more.
 *
 * Most apps let you type a target and then watch a bar that you also have to
 * move by hand — a progress bar powered by wishful thinking. Here the bar is
 * the balance of a real account, so it moves when money moves and at no other
 * time. It is less satisfying and completely honest.
 */
export function GoalSheet({
  goal,
  open,
  onClose,
}: {
  goal: Goal | null;
  open: boolean;
  onClose: () => void;
}) {
  const { ledger, addGoal, updateGoal, deleteGoal } = useLedger();
  const toast = useToast();

  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [icon, setIcon] = useState('target');
  const [busy, setBusy] = useState(false);

  const candidates = useMemo(
    () => ledger.accounts.filter((account) => !account.archived && account.type !== 'card'),
    [ledger.accounts],
  );

  const accountOptions = useMemo(
    () =>
      candidates.map((acc) => ({
        value: acc.id,
        label: acc.name,
        icon:
          acc.type === 'cash' ? (
            <Banknote className="h-4 w-4 text-emerald-500" />
          ) : acc.type === 'savings' ? (
            <Landmark className="h-4 w-4 text-teal-500" />
          ) : (
            <Landmark className="h-4 w-4 text-accent" />
          ),
      })),
    [candidates],
  );

  useEffect(() => {
    if (!open) return;
    setName(goal?.name ?? '');
    setTarget(goal ? formatAmount(goal.targetAmount) : '');
    setTargetDate(goal?.targetDate ?? '');
    setAccountId(goal?.accountId ?? candidates.find((a) => a.type === 'savings')?.id ?? candidates[0]?.id ?? '');
    setIcon(goal?.icon ?? 'target');
    // Candidate list is derived from the ledger; re-running on every change would
    // fight the user's own selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goal]);

  const save = async () => {
    const trimmed = name.trim();
    const paise = parseAmount(target);

    if (!trimmed) {
      toast('Give the goal a name.', { tone: 'bad' });
      return;
    }
    if (paise === null || paise <= 0) {
      toast('How much are you aiming for?', { tone: 'bad' });
      return;
    }
    if (!accountId) {
      toast('A goal needs an account to live in. Add one in Money first.', { tone: 'bad' });
      return;
    }

    setBusy(true);
    try {
      const draft = {
        name: trimmed,
        targetAmount: paise,
        targetDate: targetDate || undefined,
        accountId,
        icon,
      };
      if (goal) await updateGoal(goal.id, draft);
      else await addGoal(draft);
      onClose();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not save.', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!goal) return;
    setBusy(true);
    try {
      await deleteGoal(goal.id);
      onClose();
      toast('Goal removed. The money stays where it is.', { tone: 'info' });
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
      title={goal ? 'Edit goal' : 'New goal'}
      footer={
        <>
          {goal ? (
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
        <div className="flex flex-wrap gap-1.5">
          {ICONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setIcon(option)}
              aria-label={option}
              aria-pressed={icon === option}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl border transition-colors',
                icon === option
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-line text-muted hover:bg-raised',
              )}
            >
              <CategoryIcon name={option} className="h-[18px] w-[18px]" />
            </button>
          ))}
        </div>

        <Field label="What for">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Japan, laptop, six months of rent…"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Target">
            <Input
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="150000"
              className="tnum"
            />
          </Field>
          <Field label="By when" hint="Optional.">
            <Input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Money lives in"
          hint="Progress is this account's balance. Move money there and the bar moves; nothing else will."
        >
          <AccountPicker
            value={accountId}
            onChange={setAccountId}
            accounts={candidates}
            placeholder="Choose an account…"
          />
        </Field>
      </div>
    </Sheet>
  );
}
