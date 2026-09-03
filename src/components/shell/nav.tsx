'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calculator,
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

/** Clean mobile bottom dock. */
export function BottomNav({ onAdd, onOpenCalc }: { onAdd: () => void; onOpenCalc?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 px-3 pb-2 pt-1 md:hidden">
      <div className="flex items-center justify-around rounded-2xl border border-line/60 bg-surface/90 px-2 py-1.5 backdrop-blur-xl shadow-lg">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors',
                active ? 'text-accent font-semibold' : 'text-muted hover:text-ink',
              )}
            >
              <tab.icon className={cn('h-5 w-5', active ? 'stroke-[2.2]' : 'stroke-[1.7]')} />
              <span className="leading-none tracking-tight">{tab.label}</span>
              {active ? <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-accent" /> : null}
            </Link>
          );
        })}

        {onOpenCalc ? (
          <button
            type="button"
            onClick={onOpenCalc}
            aria-label="Financial Calculator"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line/60 bg-surface/80 text-muted hover:text-accent shadow-2xs hover:bg-raised active:scale-95 transition-all"
            title="Calculator"
          >
            <Calculator className="h-4 w-4" />
          </button>
        ) : null}

        {/* Quick Add action in bottom bar */}
        <button
          type="button"
          onClick={onAdd}
          aria-label="Quick Add Spend"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-2xs hover:opacity-90 active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
        </button>
      </div>
    </nav>
  );
}

/** Executive sidebar rail on desktop. */
export function SideNav({
  onAdd,
  onOpenTour,
  onOpenCalc,
}: {
  onAdd: () => void;
  onOpenTour?: () => void;
  onOpenCalc?: () => void;
}) {
  const pathname = usePathname();
  const { setTheme, resolved } = useTheme();
  const { ledger, updatePrefs } = useLedger();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line/60 bg-surface/90 backdrop-blur-md px-3 py-5 md:flex select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-2 pb-5">
        <div className="flex items-center gap-2.5">
          <BrandLogo size={28} />
          <div>
            <span className="block text-sm font-semibold tracking-tight text-ink leading-none">
              KharchGini
            </span>
            <span className="block text-[10px] text-muted mt-0.5 font-normal">
              State machine
            </span>
          </div>
        </div>
        <span className="rounded bg-raised px-1.5 py-0.5 text-[10px] font-medium text-muted border border-line/50">
          v2.0
        </span>
      </div>

      {/* Quick Search / Command bar trigger */}
      <button
        type="button"
        onClick={onAdd}
        className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-line/60 bg-raised/40 px-2.5 py-1.5 text-xs text-muted hover:border-line hover:text-ink hover:bg-raised/70 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5 text-accent" />
          <span>Quick log…</span>
        </span>
        <kbd className="rounded border border-line/60 bg-surface px-1.5 py-0.2 text-[10px] font-mono text-muted">
          /
        </kbd>
      </button>

      {/* Navigation Tabs */}
      <div className="space-y-0.5">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors',
                active
                  ? 'bg-raised text-ink font-semibold shadow-2xs'
                  : 'text-muted hover:bg-raised/50 hover:text-ink',
              )}
            >
              <tab.icon
                className={cn(
                  'h-4 w-4',
                  active ? 'text-accent stroke-[2.2]' : 'stroke-[1.8] group-hover:text-ink',
                )}
              />
              <span>{tab.label}</span>
              {active ? (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />
              ) : null}
            </Link>
          );
        })}
      </div>

      {/* Footer controls */}
      <div className="mt-auto space-y-3 pt-4 border-t border-line/50">
        {/* Keyboard shortcut hint */}
        <div className="space-y-1 px-2 text-[11px] text-muted">
          <div className="flex items-center justify-between">
            <span>Command menu</span>
            <kbd className="rounded border border-line/50 bg-raised/50 px-1 text-[10px] font-mono">⌘K</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span>Calculator</span>
            <kbd className="rounded border border-line/50 bg-raised/50 px-1 text-[10px] font-mono">C</kbd>
          </div>
        </div>

        {/* Bottom utility controls */}
        <div className="flex items-center justify-between px-1 pt-1">
          {onOpenTour ? (
            <button
              type="button"
              onClick={onOpenTour}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-raised hover:text-ink transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5 text-muted" />
              Guide
            </button>
          ) : <span />}

          <div className="flex items-center gap-1">
            {onOpenCalc ? (
              <button
                type="button"
                onClick={onOpenCalc}
                title="Financial Calculator (C)"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-line/60 bg-surface/50 text-muted hover:bg-raised hover:text-accent transition-colors"
              >
                <Calculator className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void updatePrefs({ privacyMode: !ledger.prefs.privacyMode })}
              title="Toggle Privacy Mode (Shift+P)"
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md border transition-colors',
                ledger.prefs.privacyMode
                  ? 'border-accent/40 bg-accent/15 text-accent'
                  : 'border-line/60 bg-surface/50 text-muted hover:bg-raised hover:text-ink',
              )}
            >
              <Shield className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
              title={`Switch to ${resolved === 'dark' ? 'Light' : 'Dark'} mode`}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-line/60 bg-surface/50 text-muted hover:bg-raised hover:text-ink transition-colors"
            >
              {resolved === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
