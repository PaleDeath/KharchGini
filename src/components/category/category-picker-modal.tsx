'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronRight, CircleDashed, Plus, Search, Sparkles, X } from 'lucide-react';
import { CategoryChip } from '@/components/category/category-icon';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { Category, CategoryKind } from '@/domain/types';

const KIND_FILTERS: { key: 'all' | CategoryKind; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'need', label: 'Needs' },
  { key: 'want', label: 'Wants' },
  { key: 'save', label: 'Savings' },
  { key: 'income', label: 'Income' },
];

export interface CategoryPickerProps {
  value: string;
  onChange: (categoryId: string) => void;
  categories: Category[];
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
  label?: string;
}

export function CategoryPicker({
  value,
  onChange,
  categories,
  placeholder = 'Select a category…',
  disabled = false,
  allowClear = false,
  className,
}: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | CategoryKind>('all');

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === value),
    [categories, value],
  );

  const filtered = useMemo(() => {
    return categories.filter((category) => {
      if (activeTab !== 'all' && category.kind !== activeTab) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      return category.name.toLowerCase().includes(q);
    });
  }, [categories, activeTab, search]);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <>
      {/* The Tactile Visual Trigger Card */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          'group relative flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface/90 p-2.5 sm:p-3 text-left transition-all duration-200 shadow-xs hover:border-accent/40 hover:bg-raised/40 active:scale-[0.99]',
          open && 'border-accent ring-2 ring-accent/15',
          disabled && 'opacity-60 cursor-not-allowed',
          className,
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {selectedCategory ? (
            <>
              <CategoryChip
                name={selectedCategory.icon}
                color={selectedCategory.color}
                className="h-10 w-10 rounded-xl text-base shadow-sm"
              />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  {selectedCategory.name}
                </span>
                <span className="block text-[11px] font-medium uppercase tracking-wider text-faint">
                  {selectedCategory.kind === 'need'
                    ? 'Need'
                    : selectedCategory.kind === 'want'
                    ? 'Want'
                    : selectedCategory.kind === 'save'
                    ? 'Saving'
                    : 'Income'}
                </span>
              </div>
            </>
          ) : (
            <>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-dashed border-line bg-raised/50 text-faint">
                <CircleDashed className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-muted">{placeholder}</span>
                <span className="block text-[11px] text-faint">Tap to select category</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="rounded-lg bg-raised px-2 py-1 text-[11px] font-medium text-muted group-hover:text-ink transition-colors">
            {selectedCategory ? 'Change' : 'Choose'}
          </span>
          <ChevronRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5" />
        </div>
      </button>

      {/* The Visual Category Picker Sheet */}
      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSearch('');
        }}
        title="Select Category"
        description="Choose a category to accurately track budgets and analytics"
      >
        <div className="space-y-4 pb-2">
          {/* Live Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-faint" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by category name…"
              className="h-10 w-full rounded-xl border border-line bg-raised/50 pl-10 pr-9 text-sm text-ink placeholder:text-faint focus:border-accent focus:bg-surface focus:outline-none transition-colors"
              autoFocus
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-3 text-faint hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {/* Kind Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {KIND_FILTERS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'rounded-xl px-3 py-1.5 text-xs font-medium transition-all shrink-0 active:scale-95',
                  activeTab === tab.key
                    ? 'bg-ink text-surface font-semibold shadow-sm'
                    : 'bg-raised/70 text-muted hover:bg-raised hover:text-ink',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Category Visual Grid */}
          <div className="max-h-[50vh] overflow-y-auto no-scrollbar pr-0.5">
            {allowClear && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={cn(
                  'mb-2 flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all',
                  !value
                    ? 'border-accent bg-accent/10 shadow-xs ring-1 ring-accent/30'
                    : 'border-line/70 bg-surface/60 hover:border-line hover:bg-raised/60',
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-raised text-faint">
                  <CircleDashed className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">Uncategorised</span>
                  <span className="block text-[11px] text-faint">Leave without a category</span>
                </div>
                {!value && <Check className="h-4 w-4 text-accent shrink-0" />}
              </button>
            )}

            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-muted">No categories found</p>
                <p className="text-xs text-faint mt-1">Try a different search term or tab</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                {filtered.map((category) => {
                  const isSelected = category.id === value;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleSelect(category.id)}
                      className={cn(
                        'group relative flex items-center gap-2.5 rounded-2xl border p-2.5 sm:p-3 text-left transition-all duration-150 active:scale-[0.97]',
                        isSelected
                          ? 'border-accent bg-accent/12 shadow-xs ring-1.5 ring-accent/40'
                          : 'border-line/70 bg-surface/70 hover:border-line hover:bg-raised/80 hover:shadow-xs',
                      )}
                    >
                      <CategoryChip
                        name={category.icon}
                        color={category.color}
                        className="h-9 w-9 rounded-xl text-sm shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs sm:text-[13px] font-semibold text-ink">
                          {category.name}
                        </span>
                        <span className="block text-[10px] uppercase tracking-wider text-faint truncate">
                          {category.kind}
                        </span>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-accent shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Sheet>
    </>
  );
}
