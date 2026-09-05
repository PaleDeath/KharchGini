'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { CalculatorSheet } from '@/components/calculator/calculator-sheet';
import { CommandBar } from '@/components/command/command-bar';
import { Gate } from '@/components/shell/gate';
import { BottomNav, SideNav } from '@/components/shell/nav';
import { WalkthroughDialog } from '@/components/shell/walkthrough-dialog';
import { useLedger } from '@/lib/store';

/** True when a keystroke belongs to something the user is typing into. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { ledger, updatePrefs } = useLedger();
  const [adding, setAdding] = useState(false);
  const [initialCommandText, setInitialCommandText] = useState('');
  const [calcOpen, setCalcOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const pathname = usePathname();

  // The home-screen shortcut lands on `/?add=1`.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('add') === null) return;
    setAdding(true);
    url.searchParams.delete('add');
    window.history.replaceState({}, '', url.pathname + url.search);
  }, []);

  // "/" to add, ⌘K for palette, "C" for calculator, Shift+P for privacy mode toggle
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setAdding(true);
        return;
      }
      if (event.key === '/' && !isTyping(event.target) && !event.metaKey && !event.ctrlKey) {
        if (calcOpen) return;
        event.preventDefault();
        setAdding(true);
        return;
      }
      if ((event.key === 'c' || event.key === 'C') && !isTyping(event.target) && !event.metaKey && !event.ctrlKey) {
        if (calcOpen) return;
        event.preventDefault();
        setCalcOpen(true);
        return;
      }
      if ((event.key === 'P' || event.key === 'p') && event.shiftKey && !isTyping(event.target)) {
        event.preventDefault();
        void updatePrefs({ privacyMode: !ledger.prefs.privacyMode });
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ledger.prefs.privacyMode, updatePrefs, calcOpen]);

  return (
    <Gate>
      <SideNav
        onAdd={() => setAdding(true)}
        onOpenTour={() => setTourOpen(true)}
        onOpenCalc={() => setCalcOpen(true)}
      />
      <BottomNav
        onAdd={() => setAdding(true)}
        onOpenCalc={() => setCalcOpen(true)}
      />

      <main className="md:pl-60 transition-[padding] duration-200 min-h-dvh">
        <div
          key={pathname}
          className="mx-auto max-w-4xl animate-fade-in px-4 pb-28 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 md:px-8 md:pb-16 md:pt-8"
        >
          {children}
        </div>
      </main>

      <CommandBar
        open={adding}
        onOpenChange={(next) => {
          setAdding(next);
          if (!next) setInitialCommandText('');
        }}
        initialText={initialCommandText}
      />
      <CalculatorSheet
        open={calcOpen}
        onClose={() => setCalcOpen(false)}
        onLogSpend={(rupees) => {
          setInitialCommandText(String(rupees) + ' ');
          setCalcOpen(false);
          setAdding(true);
        }}
      />
      <WalkthroughDialog open={tourOpen} onClose={() => setTourOpen(false)} />
    </Gate>
  );
}
