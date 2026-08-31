'use client';

import { addDays, today as todayISO, type ISODate } from '@/domain/dates';
import { cn } from '@/lib/utils';

export function QuickDatePicker({
  value,
  onChange,
  maxDate,
  className,
}: {
  value: ISODate;
  onChange: (date: ISODate) => void;
  maxDate?: ISODate;
  className?: string;
}) {
  const todayDate = todayISO();
  const yesterday = addDays(todayDate, -1);
  const twoDaysAgo = addDays(todayDate, -2);
  const threeDaysAgo = addDays(todayDate, -3);

  const isToday = value === todayDate;
  const isYesterday = value === yesterday;
  const is2DaysAgo = value === twoDaysAgo;
  const is3DaysAgo = value === threeDaysAgo;
  const isCustom = !isToday && !isYesterday && !is2DaysAgo && !is3DaysAgo;

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <button
        type="button"
        onClick={() => onChange(todayDate)}
        className={cn(
          'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all shrink-0 active:scale-95',
          isToday
            ? 'border-accent bg-accent/15 text-accent font-semibold shadow-2xs'
            : 'border-line bg-surface text-muted hover:border-accent/40 hover:text-ink',
        )}
      >
        Today
      </button>

      <button
        type="button"
        onClick={() => onChange(yesterday)}
        className={cn(
          'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all shrink-0 active:scale-95',
          isYesterday
            ? 'border-accent bg-accent/15 text-accent font-semibold shadow-2xs'
            : 'border-line bg-surface text-muted hover:border-accent/40 hover:text-ink',
        )}
      >
        Yesterday
      </button>

      <button
        type="button"
        onClick={() => onChange(twoDaysAgo)}
        className={cn(
          'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all shrink-0 active:scale-95',
          is2DaysAgo
            ? 'border-accent bg-accent/15 text-accent font-semibold shadow-2xs'
            : 'border-line bg-surface text-muted hover:border-accent/40 hover:text-ink',
        )}
      >
        2d ago
      </button>

      <button
        type="button"
        onClick={() => onChange(threeDaysAgo)}
        className={cn(
          'px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all shrink-0 active:scale-95',
          is3DaysAgo
            ? 'border-accent bg-accent/15 text-accent font-semibold shadow-2xs'
            : 'border-line bg-surface text-muted hover:border-accent/40 hover:text-ink',
        )}
      >
        3d ago
      </button>

      <div className="relative min-w-[130px] flex-1">
        <input
          type="date"
          value={value}
          max={maxDate ?? todayDate}
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
          className={cn(
            'h-[30px] w-full rounded-lg border px-2 text-xs font-medium transition-all bg-surface',
            isCustom
              ? 'border-accent text-accent font-semibold bg-accent/10 shadow-2xs'
              : 'border-line text-muted hover:border-accent/40',
          )}
        />
      </div>
    </div>
  );
}
