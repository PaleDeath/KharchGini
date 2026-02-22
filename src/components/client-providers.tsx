"use client";

import React from 'react';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/contexts/theme-context';
import { PWAInstallBanner, PWAUpdateBanner, PWAStatusIndicator } from '@/components/pwa/install-banner';

// This component wraps client-side context providers
// like Theme providers, React Query, etc.

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <Toaster />
      <PWAInstallBanner />
      <PWAUpdateBanner />
      <PWAStatusIndicator />
    </ThemeProvider>
  );
}
