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

/** Floating glassmorphic dock on mobile devices with thumb-friendly haptics. */
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
          'flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-accent to-emerald-400 text-white',
          'shadow-lg shadow-accent/35 transition-transform duration-200 hover:scale-105 active:scale-95 border border-white/25',
        )}
      >
        <Plus className="h-6 w-6 stroke-[2.4]" />
      </button>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 px-3 pb-2 pt-1 md:hidden">
        <div className="grid grid-cols-4 rounded-3xl border border-line/80 bg-surface/85 px-1.5 py-1.5 backdrop-blur-xl shadow-xl">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-1 rounded-2xl py-2 px-1 text-[11px] font-semibold transition-all duration-200 active:scale-95',
                  active
                    ? 'text-accent bg-accent/10 shadow-2xs ring-1 ring-accent/25 font-bold'
                    : 'text-faint hover:text-ink',
                )}
              >
                <tab.icon
                  className={cn(
                    'h-5 w-5 transition-transform duration-200',
                    active ? 'scale-110 stroke-[2.2]' : 'stroke-[1.7]',
                  )}
                />
                <span className="leading-none tracking-tight">{tab.label}</span>
                {active ? (
                  <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-accent animate-pulse" />
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

/** Executive sidebar rail on desktop. */
export function SideNav({ onAdd, onOpenTour }: { onAdd: () => void; onOpenTour?: () => void }) {
  const pathname = usePathname();
  const { theme, setTheme, resolved } = useTheme();
  const { ledger, updatePrefs } = useLedger();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface/95 backdrop-blur-md px-3.5 py-6 md:flex">
      <div className="flex items-center gap-3 px-2 pb-6">
        <BrandLogo size={32} />
        <div>
          <span className="block text-base font-extrabold tracking-tight text-ink leading-tight">
            KharchGini
          </span>
          <span className="block text-[11px] font-medium text-faint">
            Financial state machine
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="mb-5 flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-accent to-emerald-600 px-3.5 py-3 text-sm font-semibold text-accent-ink transition-all hover:opacity-95 hover:shadow-md hover:shadow-accent/25 active:scale-[0.98] border border-white/20"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-white/20">
          <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
        </span>
        <span>Quick Add</span>
        <kbd className="ml-auto rounded-md border border-accent-ink/30 bg-black/10 px-1.5 py-0.5 text-[10px] font-mono opacity-80">
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
                'group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-150',
                active
                  ? 'bg-accent/12 text-accent shadow-2xs ring-1 ring-accent/25'
                  : 'text-muted hover:bg-raised/70 hover:text-ink',
              )}
            >
              <tab.icon
                className={cn(
                  'h-4 w-4 transition-transform duration-150',
                  active ? 'text-accent stroke-[2.2] scale-105' : 'stroke-[1.8] group-hover:scale-105',
                )}
              />
              <span className="tracking-tight">{tab.label}</span>
              {active ? (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="mt-auto space-y-2 pt-4 border-t border-line/70">
        {/* Quick Keyboard shortcuts summary */}
        <div className="rounded-xl border border-line/50 bg-raised/40 p-2 text-[11px] text-faint space-y-1">
          <div className="flex items-center justify-between">
            <span>Command palette</span>
            <kbd className="rounded border border-line bg-surface px-1 text-[10px]">⌘K</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span>Toggle Privacy</span>
            <kbd className="rounded border border-line bg-surface px-1 text-[10px]">⇧P</kbd>
          </div>
        </div>

        {/* Bottom utility controls */}
        <div className="flex items-center justify-between pt-1">
          {onOpenTour ? (
            <button
              type="button"
              onClick={onOpenTour}
              className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-raised hover:text-ink transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5 text-accent" />
              Guide
            </button>
          ) : <span />}

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void updatePrefs({ privacyMode: !ledger.prefs.privacyMode })}
              title="Toggle Privacy Mode (Shift+P)"
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-xl border transition-colors',
                ledger.prefs.privacyMode
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-line bg-surface text-muted hover:bg-raised hover:text-ink',
              )}
            >
              <Shield className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
              title={`Switch to ${resolved === 'dark' ? 'Light' : 'Dark'} mode`}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-surface text-muted hover:bg-raised hover:text-ink transition-colors"
            >
              {resolved === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
