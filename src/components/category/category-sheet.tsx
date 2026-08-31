'use client';

import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { CATEGORY_KIND_LABEL, type Category, type CategoryKind } from '@/domain/types';
import { CategoryIcon, ICON_NAMES } from '@/components/category/category-icon';
import { Button } from '@/components/ui/button';
import { CategoryPicker } from '@/components/category/category-picker-modal';
import { Field, Input, Segmented } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { useLedger } from '@/lib/store';
import { cn } from '@/lib/utils';

const KINDS: { value: CategoryKind; label: string }[] = (
  Object.keys(CATEGORY_KIND_LABEL) as CategoryKind[]
).map((kind) => ({ value: kind, label: CATEGORY_KIND_LABEL[kind] }));

const COLORS = [
  '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e', '#ef4444',
  '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#64748b', '#a16207',
];

/**
 * Categories are data, not a constant array in the source.
 *
 * `kind` is the field that earns its keep: it turns every entry into part of a
 * needs / wants / saving split without asking one extra question at the moment
 * of recording, which is the only moment where friction actually costs you.
 */
export function CategorySheet({
  category,
  open,
  onClose,
}: {
  category: Category | null;
  open: boolean;
  onClose: () => void;
}) {
  const { ledger, addCategory, updateCategory, deleteCategory } = useLedger();
  const toast = useToast();

  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>('want');
  const [icon, setIcon] = useState('circle-dashed');
  const [color, setColor] = useState('#6366f1');
  const [parentId, setParentId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setKind(category?.kind ?? 'want');
    setIcon(category?.icon ?? 'circle-dashed');
    setColor(category?.color ?? '#6366f1');
    setParentId(category?.parentId ?? '');
  }, [open, category]);

  // One level of nesting only, so a category with children cannot itself be a child.
  const hasChildren = category
    ? ledger.categories.some((c) => c.parentId === category.id)
    : false;

  const parents = ledger.categories.filter(
    (c) =>
      !c.archived &&
      c.kind === kind &&
      c.parentId === undefined &&
      c.id !== category?.id,
  );

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast('Give it a name.', { tone: 'bad' });
      return;
    }

    setBusy(true);
    try {
      const shared = {
        name: trimmed,
        kind,
        icon,
        color,
        parentId: hasChildren ? undefined : parentId || undefined,
      };
      if (category) {
        await updateCategory(category.id, shared);
      } else {
        await addCategory({ ...shared, sortOrder: ledger.categories.length });
      }
      onClose();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not save.', { tone: 'bad' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!category) return;
    setBusy(true);
    try {
      await deleteCategory(category.id);
      onClose();
      toast('Category gone. Entries filed under it keep their history.', { tone: 'info' });
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
      title={category ? 'Edit category' : 'New category'}
      footer={
        <>
          {category ? (
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
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${color}1f` }}
          >
            <CategoryIcon name={icon} color={color} className="h-5 w-5" />
          </span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            autoFocus
          />
        </div>

        {/* Not wrapped in <Field>: a <label> must not contain a row of buttons. */}
        <div className="space-y-1.5">
          <span className="block text-[13px] font-medium text-muted">
            What kind of spending
          </span>
          <Segmented options={KINDS} value={kind} onChange={setKind} />
          <span className="block text-[12px] text-faint">
            Drives the needs / wants split. Nothing else.
          </span>
        </div>

        {!hasChildren && parents.length > 0 ? (
          <Field label="Sits under" hint="Optional. One level deep — Food → Delivery.">
            <CategoryPicker
              value={parentId}
              onChange={setParentId}
              categories={parents}
              placeholder="Nothing, it stands alone"
              allowClear
            />
          </Field>
        ) : null}

        <div className="space-y-1.5">
          <span className="block text-[13px] font-medium text-muted">Colour</span>
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setColor(option)}
                aria-label={option}
                aria-pressed={color === option}
                className={cn(
                  'h-7 w-7 rounded-full ring-offset-2 ring-offset-surface transition-shadow',
                  color === option && 'ring-2 ring-ink',
                )}
                style={{ backgroundColor: option }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="block text-[13px] font-medium text-muted">Icon</span>
          <div className="grid max-h-52 grid-cols-8 gap-1 overflow-y-auto rounded-xl border border-line p-2">
            {ICON_NAMES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setIcon(option)}
                aria-label={option}
                aria-pressed={icon === option}
                className={cn(
                  'flex h-9 items-center justify-center rounded-lg transition-colors',
                  icon === option ? 'bg-accent/12 text-accent' : 'text-muted hover:bg-raised',
                )}
              >
                <CategoryIcon name={option} className="h-[18px] w-[18px]" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
