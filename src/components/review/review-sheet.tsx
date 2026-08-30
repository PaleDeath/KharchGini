'use client';

import { Check, ChevronRight, PartyPopper } from 'lucide-react';
import { useMemo, useState } from 'react';

import { addMonthsToKey, currentMonth, formatMonthShort } from '@/domain/dates';
import { byId, reviewItems } from '@/domain/derive';
import { formatMoney } from '@/domain/money';
import type { ReviewItem } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useLedger } from '@/lib/store';

const KIND_LABEL: Record<ReviewItem['kind'], string> = {
  uncategorised: 'Needs a category',
  anomaly: 'Unusual',
  bill: 'Due',
  overspend: 'Over',
  unsettled: 'Owed to you',
  rule: 'Suggestion',
};

/**
 * The weekly review.
 *
 * This is the ritual the whole app is built around. Five minutes on a Sunday
 * where every loose end is presented with the one tap that closes it — not a
 * dashboard to admire, a queue to empty. Software that asks for attention every
 * day gets ignored; software that asks for five minutes a week gets used for
 * years.
 */
export function ReviewSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { ledger, recategorise, settle, setAllocation, postRecurring, addRule, completeReview } =
    useLedger();
  const toast = useToast();

  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => reviewItems(ledger), [ledger]);
  const remaining = items.filter((item) => !resolved.has(item.id));
  const categories = useMemo(() => byId(ledger.categories), [ledger.categories]);
  const entries = useMemo(() => byId(ledger.entries), [ledger.entries]);

  const markDone = (id: string) =>
    setResolved((current) => new Set(current).add(id));

  const finish = async () => {
    setBusy(true);
    try {
      await completeReview(resolved.size);
      toast('Review done. See you next week.', { tone: 'good' });
      setResolved(new Set());
      onClose();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not save.', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };

  const act = async (item: ReviewItem) => {
    const action = item.action;
    if (!action) {
      markDone(item.id);
      return;
    }

    try {
      switch (action.type) {
        case 'settle':
          await settle(action.entryIds);
          break;
        case 'cap-envelope': {
          const next = addMonthsToKey(currentMonth(), 1);
          await setAllocation(next, action.categoryId, action.suggested, false);
          toast(
            `${formatMoney(action.suggested)} set aside for ${formatMonthShort(next)}.`,
            { tone: 'good' },
          );
          break;
        }
        case 'mark-paid': {
          const rule = ledger.recurring.find((r) => r.id === action.recurringId);
          if (rule) await postRecurring(rule);
          break;
        }
        case 'create-rule':
          await addRule({
            field: 'merchant',
            op: 'equals',
            value: action.merchant,
            setCategoryId: action.categoryId,
            priority: 100,
          });
          toast('Rule saved. That merchant files itself now.', { tone: 'good' });
          break;
        default:
          break;
      }
      markDone(item.id);
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not do that.', { tone: 'bad' });
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="This week"
      description={
        remaining.length > 0
          ? `${remaining.length} ${remaining.length === 1 ? 'thing' : 'things'} to look at`
          : 'Nothing needs you'
      }
      wide
      footer={
        <Button variant="primary" onClick={finish} disabled={busy} className="w-full">
          {remaining.length === 0 ? 'Done' : 'Finish for now'}
        </Button>
      }
    >
      {remaining.length === 0 ? (
        <Empty
          icon={<PartyPopper className="h-7 w-7" />}
          title="All clear"
          hint="Every entry is filed, nothing is overdue, and no budget is blown. Close this and go do something else."
        />
      ) : (
        <div className="space-y-2">
          {remaining.map((item) => (
            <div key={item.id} className="rounded-card border border-line bg-surface p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-faint">
                    {KIND_LABEL[item.kind]}
                  </span>
                  <p className="text-sm font-medium text-ink">{item.title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{item.detail}</p>
                </div>
                <button
                  type="button"
                  onClick={() => markDone(item.id)}
                  aria-label="Skip"
                  className="shrink-0 rounded-lg p-1.5 text-faint hover:bg-raised hover:text-ink"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Uncategorised entries get a picker each, inline. */}
              {item.action?.type === 'categorise' ? (
                <div className="mt-3 space-y-1.5">
                  {item.action.entryIds.slice(0, 8).map((entryId) => {
                    const entry = entries.get(entryId);
                    if (!entry) return null;
                    return (
                      <div key={entryId} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                          {entry.description}
                        </span>
                        <span className="tnum shrink-0 text-[13px] text-muted">
                          {formatMoney(entry.amount)}
                        </span>
                        <Select
                          value=""
                          className="h-9 w-36 shrink-0 text-[13px]"
                          onChange={(event) => {
                            const categoryId = event.target.value;
                            if (categoryId) void recategorise(entry, categoryId);
                          }}
                        >
                          <option value="">File as…</option>
                          {[...categories.values()]
                            .filter((c) => !c.archived && c.kind !== 'income')
                            .map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                        </Select>
                      </div>
                    );
                  })}
                  <Button size="sm" variant="ghost" onClick={() => markDone(item.id)}>
                    <Check className="h-3.5 w-3.5" />
                    Done with these
                  </Button>
                </div>
              ) : item.action ? (
                <Button size="sm" variant="secondary" className="mt-3" onClick={() => act(item)}>
                  {actionLabel(item)}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

function actionLabel(item: ReviewItem): string {
  switch (item.action?.type) {
    case 'settle':
      return 'Mark settled';
    case 'cap-envelope':
      return `Set aside ${formatMoney(item.action.suggested)} next month`;
    case 'mark-paid':
      return 'Record it as paid';
    case 'create-rule':
      return 'Always file it there';
    default:
      return 'Done';
  }
}
