'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Option<T extends string = string> {
  value: T;
  label: string;
  icon?: ReactNode;
  hint?: string;
}

export function CustomSelect<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  );

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
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption?.icon ? (
            <span className="shrink-0">{selectedOption.icon}</span>
          ) : null}
          <span className={cn('truncate text-sm', selectedOption ? 'font-medium text-ink' : 'text-faint')}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
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
          <div className="max-h-56 overflow-y-auto no-scrollbar space-y-0.5">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-all text-left',
                    isSelected
                      ? 'bg-accent/12 text-accent font-semibold ring-1 ring-accent/20'
                      : 'text-ink hover:bg-raised',
                  )}
                >
                  {option.icon ? <span className="shrink-0">{option.icon}</span> : null}
                  <div className="flex-1 min-w-0">
                    <span className="block truncate text-[13px]">{option.label}</span>
                    {option.hint ? <span className="block text-[11px] text-faint">{option.hint}</span> : null}
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-accent shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
