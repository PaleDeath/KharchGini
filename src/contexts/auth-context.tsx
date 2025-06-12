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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      
      // Redirect logic
      if (!user && typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (!currentPath.startsWith('/auth/')) {
          router.push('/auth/login');
        }
      }
    }, (error: any) => {
      console.error('Auth state change error:', error);
      setLoading(false);
      
      // Handle specific Firebase errors
      if (error?.code === 'auth/network-request-failed' || 
          error?.code === 'auth/too-many-requests' ||
          error?.message?.includes('503') ||
          error?.message?.includes('visibility-check-was-unavailable')) {
        // Firebase service temporarily unavailable
        console.warn('Firebase Auth temporarily unavailable, retrying...');
        // Don't redirect on service errors, keep user logged in if possible
        return;
      }
      
      // For other auth errors, redirect to login
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        if (!currentPath.startsWith('/auth/')) {
          router.push('/auth/login');
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

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
    try {
      await firebaseSignOut(auth);
      router.push('/auth/login');
    } catch (error: any) {
      console.error('Sign out error:', error);
      
      // Handle service unavailability during sign out
      if (error.code === 'auth/network-request-failed' || 
          error.message.includes('503') ||
          error.message.includes('visibility-check-was-unavailable')) {
        // Clear local state and redirect anyway
        setUser(null);
        router.push('/auth/login');
        return;
      }
      
      throw error;
    }
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
