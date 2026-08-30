'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarRange, Plus, Sunrise, User, Wallet } from 'lucide-react';
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
  { href: '/', label: 'Today', icon: Sunrise },
  { href: '/money', label: 'Money', icon: Wallet },
  { href: '/plan', label: 'Plan', icon: CalendarRange },
  { href: '/you', label: 'You', icon: User },
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
          'flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-ink',
          'shadow-lg shadow-accent/25 transition-transform active:scale-95',
        )}
      >
        <Plus className="h-6 w-6" />
      </button>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-4">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium',
                  'transition active:scale-95',
                  active ? 'text-accent' : 'text-faint',
                )}
              >
                {/* The icon swells slightly as the tab takes over, so the
                    change of screen is announced by the control you touched. */}
                <tab.icon
                  className={cn(
                    'h-5 w-5 transition-transform duration-300 ease-soft',
                    active && 'scale-110 stroke-[2.25]',
                  )}
                />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

/** Rail on a desktop, where vertical space is cheap and horizontal space is not. */
export function SideNav({ onAdd }: { onAdd: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-line bg-surface px-3 py-5 md:flex">
      <div className="flex items-center gap-2 px-2 pb-5">
        <Wallet className="h-5 w-5 text-accent" />
        <span className="text-[15px] font-semibold tracking-tight">KharchGini</span>
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="mb-4 flex items-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-medium text-accent-ink transition hover:opacity-90 active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        Add
        <kbd className="ml-auto rounded border border-accent-ink/25 px-1 text-[10px] opacity-70">
          /
        </kbd>
      </button>

      <div className="space-y-0.5">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                active ? 'bg-raised text-ink' : 'text-muted hover:bg-raised hover:text-ink',
              )}
            >
              <tab.icon className={cn('h-4 w-4', active && 'text-accent')} />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
