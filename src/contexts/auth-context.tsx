
"use client";

import type { User } from 'firebase/auth';
import { auth } from '@/lib/firebase/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';


interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    const isAuthPage = pathname.startsWith('/auth');

    if (!user && !isAuthPage) {
      router.push('/auth/login');
    } else if (user && isAuthPage) {
      router.push('/dashboard');
    }
  }, [user, loading, router, pathname]);

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    router.push('/auth/login');
  };
  
  if (loading && !pathname.startsWith('/auth')) {
    // Basic full-page loading skeleton for initial auth check on protected routes
    return (
      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
           <Skeleton className="h-8 w-32" />
           <Skeleton className="h-8 w-8 rounded-full" />
        </header>
        <main className="flex-1 overflow-auto p-4 sm:px-6 sm:py-0">
          <Skeleton className="h-12 w-1/4 mb-6" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
          </div>
          <Skeleton className="h-64 rounded-lg" />
        </main>
      </div>
    );
  }


  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
