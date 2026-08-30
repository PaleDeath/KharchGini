'use client';

/**
 * Authentication.
 *
 * Email and password, plus Google. Nothing else — this is one person's money,
 * not a social product, and every extra provider is another thing that can
 * break on a Tuesday.
 *
 * Errors are translated into sentences a person can act on. "auth/wrong-password"
 * is a debugging string, not a message.
 */

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { firebaseReady, getFirebaseAuth } from './firebase';

interface AuthValue {
  user: User | null;
  /** True until Firebase has told us whether a session exists. */
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  leave: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That does not look like an email address.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'No account with that email. Create one instead?',
  'auth/wrong-password': 'Wrong password.',
  'auth/invalid-credential': 'That email and password do not match.',
  'auth/email-already-in-use': 'There is already an account with that email.',
  'auth/weak-password': 'Use at least six characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/popup-closed-by-user': 'Sign-in window was closed.',
  'auth/popup-blocked': 'Your browser blocked the popup. Allow it and try again.',
  'auth/network-request-failed': 'No connection. Check your network.',
  'auth/operation-not-allowed':
    'This sign-in method is switched off in the Firebase console.',
};

export function describeAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  return MESSAGES[code] ?? 'Something went wrong. Try again.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseReady) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(getFirebaseAuth(), (next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
  }, []);

  const leave = useCallback(async () => {
    await signOut(getFirebaseAuth());
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      configured: firebaseReady,
      signIn,
      signUp,
      signInWithGoogle,
      resetPassword,
      leave,
    }),
    [user, loading, signIn, signUp, signInWithGoogle, resetPassword, leave],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
