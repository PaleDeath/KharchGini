"use client";

import React from 'react';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/contexts/theme-context';

// This component wraps client-side context providers
// like Theme providers, React Query, etc.

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <Toaster />
    </ThemeProvider>
  );
}
