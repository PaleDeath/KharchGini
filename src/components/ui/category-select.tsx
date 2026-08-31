'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, CircleDashed, Search } from 'lucide-react';
import { CategoryChip } from '@/components/category/category-icon';
import { cn } from '@/lib/utils';
import type { Category } from '@/domain/types';

export interface CategorySelectProps {
  value: string;
  onChange: (categoryId: string) => void;
  categories: Category[];
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
}

export function CategorySelect({
  value,
  onChange,
  categories,
  placeholder = 'Choose category…',
  disabled = false,
  allowClear = false,
  className,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === value),
    [categories, value],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase().trim();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, search]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2.5 rounded-xl border border-line bg-surface px-3 text-left transition-all',
          open ? 'border-accent ring-2 ring-accent/15' : 'hover:border-line/80 hover:bg-raised/40',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {selectedCategory ? (
            <>
              <CategoryChip
                name={selectedCategory.icon}
                color={selectedCategory.color}
                className="h-6 w-6 rounded-lg text-xs shrink-0"
              />
              <span className="truncate text-sm font-medium text-ink">
                {selectedCategory.name}
              </span>
            </>
          ) : (
            <>
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-raised text-faint shrink-0">
                <CircleDashed className="h-3.5 w-3.5" />
              </span>
              <span className="truncate text-sm text-faint">{placeholder}</span>
            </>
          )}
        </div>

        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-faint transition-transform duration-200',
            open && 'rotate-180 text-accent',
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 rounded-2xl border border-line bg-surface/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          {categories.length > 6 && (
            <div className="relative mb-1.5 px-1 pt-1">
              <Search className="absolute left-3 top-3.5 h-3.5 w-3.5 text-faint" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories..."
                className="h-8 w-full rounded-lg border border-line/80 bg-raised/60 pl-8 pr-3 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none"
              />
            </div>
          )}

          <div className="max-h-56 overflow-y-auto no-scrollbar space-y-0.5">
            {allowClear && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-all text-left',
                  !value ? 'bg-accent/12 text-accent font-semibold' : 'text-muted hover:bg-raised hover:text-ink',
                )}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-raised text-faint">
                  <CircleDashed className="h-3.5 w-3.5" />
                </span>
                <span className="flex-1 truncate">Uncategorised</span>
                {!value && <Check className="h-3.5 w-3.5 text-accent" />}
              </button>
            )}

            {filtered.length === 0 ? (
              <p className="py-4 text-center text-xs text-faint">No matching categories</p>
            ) : (
              filtered.map((category) => {
                const isSelected = category.id === value;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      onChange(category.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-all text-left',
                      isSelected
                        ? 'bg-accent/12 text-accent font-semibold ring-1 ring-accent/20'
                        : 'text-ink hover:bg-raised',
                    )}
                  >
                    <CategoryChip
                      name={category.icon}
                      color={category.color}
                      className="h-6 w-6 rounded-lg text-xs shrink-0"
                    />
                    <span className="flex-1 truncate text-[13px]">{category.name}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-accent shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
