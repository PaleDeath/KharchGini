'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Compass, Plus, Sparkles, UserRound, WalletCards } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Four tabs, and only ever four.
 *
 * Today is what you can spend. Money is what happened. Plan is what should
 * happen. You is everything else. A person opening this app three times a day
 * should never have to think about where something lives.
 */
export const TABS: Tab[] = [
  { href: '/', label: 'Today', icon: Compass },
  { href: '/money', label: 'Money', icon: WalletCards },
  { href: '/plan', label: 'Plan', icon: CalendarDays },
  { href: '/you', label: 'You', icon: UserRound },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

/** Bottom bar on a phone, because that is where the thumb already is. */
export function BottomNav({ onAdd }: { onAdd: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        onClick={onAdd}
        aria-label="Add entry"
        className={cn(
          'fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-4 z-30 md:hidden',
          'flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-accent to-emerald-500 text-white',
          'shadow-xl shadow-accent/30 transition-all hover:scale-105 active:scale-95 border border-white/20',
        )}
      >
        <Plus className="h-6 w-6 stroke-[2.25]" />
      </button>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-surface/90 backdrop-blur-xl md:hidden shadow-lg">
        <div className="grid grid-cols-4 px-2 py-1.5">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-[11px] font-medium transition-all duration-200 active:scale-95',
                  active
                    ? 'text-accent font-semibold bg-accent/10 shadow-xs ring-1 ring-accent/20'
                    : 'text-faint hover:text-ink',
                )}
              >
                <tab.icon
                  className={cn(
                    'h-5 w-5 transition-transform duration-200',
                    active ? 'scale-110 stroke-[2]' : 'stroke-[1.65]',
                  )}
                />
                <span className="leading-none">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

/** Rail on a desktop, where vertical space is cheap and horizontal space is not. */
export function SideNav({ onAdd, onOpenTour }: { onAdd: () => void; onOpenTour?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-line bg-surface px-3 py-5 md:flex">
      <div className="flex items-center gap-2.5 px-2 pb-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-accent to-emerald-400 text-white shadow-md shadow-accent/25">
          <Sparkles className="h-4 w-4 stroke-[2.2]" />
        </div>
        <span className="text-[15px] font-bold tracking-tight text-ink">KharchGini</span>
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="mb-4 flex items-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-medium text-accent-ink transition hover:opacity-90 active:scale-[0.98] shadow-sm shadow-accent/20"
      >
        <Plus className="h-4 w-4 stroke-[2.2]" />
        Add
        <kbd className="ml-auto rounded border border-accent-ink/25 px-1 text-[10px] opacity-70">
          /
        </kbd>
      </button>

      <div className="space-y-1">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all',
                active
                  ? 'bg-accent/12 text-accent font-semibold ring-1 ring-accent/20'
                  : 'text-muted hover:bg-raised hover:text-ink',
              )}
            >
              <tab.icon className={cn('h-4 w-4 transition-transform', active ? 'text-accent stroke-[2]' : 'stroke-[1.65]')} />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {onOpenTour ? (
        <div className="mt-auto pt-4 border-t border-line">
          <button
            type="button"
            onClick={onOpenTour}
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-muted hover:bg-raised hover:text-ink transition-colors"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-accent/15 text-accent text-xs font-semibold">
              ?
            </span>
            How it works
          </button>
        </div>
      ) : null}
    </aside>
  );
}
