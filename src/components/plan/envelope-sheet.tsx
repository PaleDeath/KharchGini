'use client';

import { Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { formatMonth, type MonthKey } from '@/domain/dates';
import { suggestAllocation } from '@/domain/derive';
import { formatAmount, formatMoney, parseAmount } from '@/domain/money';
import { Button } from '@/components/ui/button';
import { CategorySelect } from '@/components/ui/category-select';
import { Field, Input, Switch } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useLedger } from '@/lib/store';

/**
 * Setting aside money for a category, one month at a time.
 *
 * The suggestion is the median of the last three months of real spending, not a
 * percentage from a magazine. A budget you have already disproved three times
 * is not a plan, it is a source of guilt.
 */
export function EnvelopeSheet({
  month,
  categoryId,
  open,
  onClose,
}: {
  month: MonthKey;
  /** Null means "choose a category". */
  categoryId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { ledger, setAllocation, deleteEnvelope } = useLedger();
  const toast = useToast();

  const [selected, setSelected] = useState('');
  const [amount, setAmount] = useState('');
  const [rollover, setRollover] = useState(false);
  const [busy, setBusy] = useState(false);

  const spendable = useMemo(
    () => ledger.categories.filter((c) => !c.archived && c.kind !== 'income'),
    [ledger.categories],
  );

  const existing = useMemo(
    () => ledger.envelopes.find((e) => e.month === month && e.categoryId === selected),
    [ledger.envelopes, month, selected],
  );

  const suggested = useMemo(
    () => (selected ? suggestAllocation(ledger, selected, month) : 0),
    [ledger, selected, month],
  );

  useEffect(() => {
    if (!open) return;
    const initial = categoryId ?? spendable[0]?.id ?? '';
    setSelected(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, categoryId]);

  // Following the selection keeps the amount honest when the category changes.
  useEffect(() => {
    if (!open || !selected) return;
    const envelope = ledger.envelopes.find(
      (e) => e.month === month && e.categoryId === selected,
    );
    setAmount(envelope ? formatAmount(envelope.allocated) : '');
    setRollover(envelope?.rollover ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selected, month]);

  const save = async () => {
    if (!selected) {
      toast('Pick a category.', { tone: 'bad' });
      return;
    }
    const paise = parseAmount(amount || '0');
    if (paise === null || paise < 0) {
      toast('That amount does not look right.', { tone: 'bad' });
      return;
    }

    setBusy(true);
    try {
      await setAllocation(month, selected, paise, rollover);
      onClose();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not save.', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    setBusy(true);
    try {
      await deleteEnvelope(existing.id);
      onClose();
      toast('Budget removed. Spending in it still counts.', { tone: 'info' });
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
      title={existing ? 'Adjust budget' : 'Set a budget'}
      description={formatMonth(month)}
      footer={
        <>
          {existing ? (
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
        <Field label="Category">
          <CategorySelect
            value={selected}
            onChange={setSelected}
            categories={spendable}
            disabled={categoryId !== null}
          />
        </Field>

        <Field label="Amount for the month">
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="tnum"
            autoFocus
          />
        </Field>

        {suggested > 0 ? (
          <button
            type="button"
            onClick={() => setAmount(formatAmount(suggested))}
            className="flex w-full items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 text-left text-[13px] transition-colors hover:bg-raised"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-accent" />
            <span className="min-w-0 flex-1 text-muted">
              You usually spend about{' '}
              <span className="font-medium text-ink">{formatMoney(suggested)}</span> here.
            </span>
            <span className="shrink-0 text-[12px] font-medium text-accent">Use it</span>
          </button>
        ) : null}

        <div className="rounded-xl bg-raised px-3.5 py-3">
          <Switch
            checked={rollover}
            onChange={setRollover}
            label="Carry the remainder forward"
            hint="Anything left over is added to next month. So is anything overspent."
          />
        </div>
      </div>
    </Sheet>
  );
}
