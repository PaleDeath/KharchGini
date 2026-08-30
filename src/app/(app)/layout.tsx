'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { CommandBar } from '@/components/command/command-bar';
import { Gate } from '@/components/shell/gate';
import { BottomNav, SideNav } from '@/components/shell/nav';
import { WalkthroughDialog } from '@/components/shell/walkthrough-dialog';

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
  const [adding, setAdding] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const pathname = usePathname();

  // The home-screen shortcut lands on `/?add=1`. Read straight from the URL
  // rather than useSearchParams(): that hook forces the whole page into a
  // Suspense boundary at build time, which is a lot of machinery for one flag.
  // The param is stripped afterwards so a refresh does not reopen the sheet.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('add') === null) return;
    setAdding(true);
    url.searchParams.delete('add');
    window.history.replaceState({}, '', url.pathname + url.search);
  }, []);

  // "/" to add, the way every text editor and chat client already works, plus
  // ⌘K for people whose hands expect it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setAdding(true);
        return;
      }
      if (event.key === '/' && !isTyping(event.target) && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setAdding(true);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Gate>
      <SideNav onAdd={() => setAdding(true)} onOpenTour={() => setTourOpen(true)} />
      <BottomNav onAdd={() => setAdding(true)} />

      <main className="md:pl-56">
        <div
          key={pathname}
          className="mx-auto max-w-2xl animate-fade-in px-4 pb-32 pt-5 md:px-8 md:pb-16 md:pt-8"
        >
          {children}
        </div>
      </main>

      <CommandBar open={adding} onOpenChange={setAdding} />
      <WalkthroughDialog open={tourOpen} onClose={() => setTourOpen(false)} />
    </Gate>
  );
}
