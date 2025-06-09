"use client";

import React from 'react';

// This component can be used to wrap any client-side context providers
// that might be needed, e.g., React Query, Theme providers, etc.
// For now, it's minimal.

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
