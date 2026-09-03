'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  Compass,
  HelpCircle,
  Plus,
  Shield,
  Sun,
  Moon,
  UserRound,
  WalletCards,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/shell/brand-logo';
import { useTheme } from '@/components/shell/theme';
import { useLedger } from '@/lib/store';

export interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Four tabs, and only ever four.
 *
 * Today is what you can spend. Money is what happened. Plan is what should
 * happen. You is everything else.
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

/** Floating glassmorphic dock on mobile devices with thumb-friendly center action. */
export function BottomNav({ onAdd }: { onAdd: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 px-3 pb-2 pt-1 md:hidden">
      <div className="grid grid-cols-5 items-center rounded-3xl border border-line/80 bg-surface/90 px-1.5 py-1.5 backdrop-blur-xl shadow-xl">
        {/* Tab 1: Today */}
        <Link
          href="/"
          className={cn(
            'relative flex flex-col items-center justify-center gap-1 rounded-2xl py-2 px-1 text-[11px] font-bold transition-all duration-150 active:scale-95',
            isActive(pathname, '/')
              ? 'text-accent bg-accent/12 shadow-2xs ring-1 ring-accent/25'
              : 'text-faint hover:text-ink',
          )}
        >
          <Compass className={cn('h-5 w-5', isActive(pathname, '/') ? 'stroke-[2.3]' : 'stroke-[1.8]')} />
          <span className="leading-none tracking-tight">Today</span>
        </Link>

        {/* Tab 2: Money */}
        <Link
          href="/money"
          className={cn(
            'relative flex flex-col items-center justify-center gap-1 rounded-2xl py-2 px-1 text-[11px] font-bold transition-all duration-150 active:scale-95',
            isActive(pathname, '/money')
              ? 'text-accent bg-accent/12 shadow-2xs ring-1 ring-accent/25'
              : 'text-faint hover:text-ink',
          )}
        >
          <WalletCards className={cn('h-5 w-5', isActive(pathname, '/money') ? 'stroke-[2.3]' : 'stroke-[1.8]')} />
          <span className="leading-none tracking-tight">Money</span>
        </Link>

        {/* Center: Quick Add Hero Button */}
        <button
          type="button"
          onClick={onAdd}
          aria-label="Quick Add Spend or SMS"
          className="group relative flex flex-col items-center justify-center -my-1"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-accent via-emerald-500 to-emerald-400 text-accent-ink shadow-md shadow-accent/30 border border-white/30 transition-transform duration-150 active:scale-90">
            <Plus className="h-6 w-6 stroke-[2.8]" />
          </span>
          <span className="text-[10px] font-extrabold text-accent mt-0.5 tracking-tight">Add</span>
        </button>

        {/* Tab 4: Plan */}
        <Link
          href="/plan"
          className={cn(
            'relative flex flex-col items-center justify-center gap-1 rounded-2xl py-2 px-1 text-[11px] font-bold transition-all duration-150 active:scale-95',
            isActive(pathname, '/plan')
              ? 'text-accent bg-accent/12 shadow-2xs ring-1 ring-accent/25'
              : 'text-faint hover:text-ink',
          )}
        >
          <CalendarDays className={cn('h-5 w-5', isActive(pathname, '/plan') ? 'stroke-[2.3]' : 'stroke-[1.8]')} />
          <span className="leading-none tracking-tight">Plan</span>
        </Link>

        {/* Tab 5: You */}
        <Link
          href="/you"
          className={cn(
            'relative flex flex-col items-center justify-center gap-1 rounded-2xl py-2 px-1 text-[11px] font-bold transition-all duration-150 active:scale-95',
            isActive(pathname, '/you')
              ? 'text-accent bg-accent/12 shadow-2xs ring-1 ring-accent/25'
              : 'text-faint hover:text-ink',
          )}
        >
          <UserRound className={cn('h-5 w-5', isActive(pathname, '/you') ? 'stroke-[2.3]' : 'stroke-[1.8]')} />
          <span className="leading-none tracking-tight">You</span>
        </Link>
      </div>
    </nav>
  );
}

/** Executive sidebar rail on desktop. */
export function SideNav({ onAdd, onOpenTour }: { onAdd: () => void; onOpenTour?: () => void }) {
  const pathname = usePathname();
  const { setTheme, resolved } = useTheme();
  const { ledger, updatePrefs } = useLedger();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface/95 backdrop-blur-md px-4 py-6 md:flex select-none">
      <div className="flex items-center gap-3 px-2 pb-6">
        <BrandLogo size={34} />
        <div>
          <span className="block text-base font-black tracking-tight text-ink leading-tight">
            KharchGini
          </span>
          <span className="block text-[11px] font-semibold text-faint">
            Financial state machine
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="mb-5 flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-accent to-emerald-600 px-4 py-3 text-sm font-bold text-accent-ink transition-all hover:opacity-95 hover:shadow-md hover:shadow-accent/25 active:scale-[0.97] border border-white/20"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-white/25">
          <Plus className="h-3.5 w-3.5 stroke-[2.8]" />
        </span>
        <span>Quick Add</span>
        <kbd className="ml-auto rounded-md border border-accent-ink/30 bg-black/10 px-1.5 py-0.5 text-[10px] font-mono font-bold opacity-90">
          /
        </kbd>
      </button>

      <div className="space-y-1.5">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-bold transition-all duration-150',
                active
                  ? 'bg-accent/12 text-accent shadow-2xs ring-1 ring-accent/25'
                  : 'text-muted hover:bg-raised/80 hover:text-ink',
              )}
            >
              <tab.icon
                className={cn(
                  'h-4.5 w-4.5 transition-transform duration-150',
                  active ? 'text-accent stroke-[2.2] scale-105' : 'stroke-[1.8] group-hover:scale-105',
                )}
              />
              <span className="tracking-tight">{tab.label}</span>
              {active ? (
                <span className="ml-auto h-2 w-2 rounded-full bg-accent" />
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="mt-auto space-y-2.5 pt-4 border-t border-line/70">
        {/* Quick Keyboard shortcuts summary */}
        <div className="rounded-2xl border border-line bg-raised/50 p-2.5 text-[11px] text-faint space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-muted">Command palette</span>
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-mono font-bold text-ink">⌘K</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-muted">Privacy mode</span>
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-mono font-bold text-ink">⇧P</kbd>
          </div>
        </div>

        {/* Bottom utility controls */}
        <div className="flex items-center justify-between pt-1">
          {onOpenTour ? (
            <button
              type="button"
              onClick={onOpenTour}
              className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold text-muted hover:bg-raised hover:text-ink transition-colors active:scale-95"
            >
              <HelpCircle className="h-3.5 w-3.5 text-accent" />
              Guide
            </button>
          ) : <span />}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void updatePrefs({ privacyMode: !ledger.prefs.privacyMode })}
              title="Toggle Privacy Mode (Shift+P)"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl border transition-all active:scale-95',
                ledger.prefs.privacyMode
                  ? 'border-accent bg-accent/15 text-accent shadow-2xs'
                  : 'border-line bg-surface text-muted hover:bg-raised hover:text-ink',
              )}
            >
              <Shield className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
              title={`Switch to ${resolved === 'dark' ? 'Light' : 'Dark'} mode`}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-surface text-muted hover:bg-raised hover:text-ink transition-all active:scale-95 shadow-2xs"
            >
              {resolved === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
