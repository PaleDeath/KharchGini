'use client';

import { useEffect, type ReactNode } from 'react';

import { AuthProvider } from '@/lib/auth';
import { LedgerProvider, useLedger } from '@/lib/store';
import { ToastProvider } from '@/components/ui/toast';

import { ServiceWorker } from './service-worker';
import { ThemeProvider } from './theme';

/**
 * Privacy mode lives on the <html> element, so a single class hides every amount
 * in the application at once. Screens do not opt in and cannot forget.
 */
function PrivacyClass({ children }: { children: ReactNode }) {
  const { ledger } = useLedger();
  const on = ledger.prefs.privacyMode === true;

  useEffect(() => {
    document.documentElement.classList.toggle('privacy', on);
  }, [on]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LedgerProvider>
          <ToastProvider>
            <ServiceWorker />
            <PrivacyClass>{children}</PrivacyClass>
          </ToastProvider>
        </LedgerProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
