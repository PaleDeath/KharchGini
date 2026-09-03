'use client';

import { KeyRound, Loader2, Sparkles, TriangleAlert } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { BrandLogo } from '@/components/shell/brand-logo';
import { describeAuthError, useAuth } from '@/lib/auth';
import { missingFirebaseKeys } from '@/lib/firebase';
import { useLedger } from '@/lib/store';

/**
 * Everything that has to be true before a screen can show a number:
 * configuration, then a session, then a loaded ledger.
 */
export function Gate({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, configured } = useAuth();
  const { loading: dataLoading, error } = useLedger();

  if (!configured) return <SetupScreen />;
  if (authLoading) return <Splash label="Opening" />;
  if (!user) return <SignIn />;

  if (error) {
    return (
      <Centred>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bad/15 text-bad border border-bad/30 shadow-2xs">
          <TriangleAlert className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-extrabold text-ink">Could not read your ledger</h1>
        <p className="max-w-sm text-xs text-muted">{error}</p>
        <p className="max-w-sm text-xs text-faint">
          This is usually the Firestore security rules not being published yet. Run{' '}
          <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-[11px]">firebase deploy --only firestore</code>{' '}
          and reload.
        </p>
      </Centred>
    );
  }

  if (dataLoading) return <Splash label="Loading your money" />;

  return <>{children}</>;
}

function Centred({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center animate-fade-in">
      {children}
    </div>
  );
}

function Splash({ label }: { label: string }) {
  return (
    <Centred>
      <div className="relative">
        <BrandLogo size={56} className="shadow-xl shadow-accent/30" />
        <div className="pointer-events-none absolute -inset-2 rounded-full bg-accent/20 blur-xl" />
      </div>
      <p className="flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-wider">
        <Loader2 className="h-4 w-4 animate-spin text-accent" />
        {label}…
      </p>
    </Centred>
  );
}

function SetupScreen() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-6 py-12 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15 text-accent border border-accent/30 shadow-2xs">
          <KeyRound className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">One step left</h1>
          <p className="text-xs text-muted">Configure your personal Firebase connection</p>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-muted">
        KharchGini stores your ledger directly in your personal Firebase project, keeping all financial data privately in your hands. Create a project at{' '}
        <a
          href="https://console.firebase.google.com"
          target="_blank"
          rel="noreferrer"
          className="text-accent underline underline-offset-2 font-semibold"
        >
          console.firebase.google.com
        </a>
        , enable <strong>Authentication</strong> and <strong>Firestore</strong>, then add your keys to{' '}
        <code className="rounded bg-raised px-1.5 py-0.5 text-xs font-mono">.env.local</code>.
      </p>

      <div className="rounded-xl border border-line/60 bg-surface/90 p-4 shadow-xs">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Missing values</p>
        <ul className="mt-3 space-y-1.5">
          {missingFirebaseKeys.length === 0 ? (
            <li className="text-xs text-muted">
              All keys are present but incomplete. Check for typos in .env.local.
            </li>
          ) : (
            missingFirebaseKeys.map((key) => (
              <li key={key} className="font-mono text-xs text-muted flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-warn" />
                NEXT_PUBLIC_FIREBASE_{key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

type Mode = 'in' | 'up' | 'reset';

function SignIn() {
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'in') await signIn(email, password);
      else if (mode === 'up') await signUp(email, password);
      else {
        await resetPassword(email);
        setSent(true);
      }
    } catch (caught) {
      setError(describeAuthError(caught));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (caught) {
      setError(describeAuthError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-6 py-12 animate-fade-in">
      <div className="space-y-1.5 text-center">
        <div className="mx-auto flex justify-center">
          <BrandLogo size={40} className="shadow-md shadow-accent/20" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">KharchGini</h1>
        <p className="text-xs text-muted font-normal">
          {mode === 'up'
            ? 'Create your private financial ledger in seconds.'
            : mode === 'reset'
              ? 'We will send you a secure password reset link.'
              : 'Know what you can spend today.'}
        </p>
      </div>

      <div className="rounded-xl border border-line/60 bg-surface/90 p-5 shadow-xs space-y-3.5">
        <form onSubmit={submit} className="space-y-3">
          <Field label="Email Address">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              autoFocus
              placeholder="you@example.com"
            />
          </Field>

          {mode !== 'reset' ? (
            <Field label="Password" hint={mode === 'up' ? 'Minimum 6 characters.' : undefined}>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
                required
                minLength={6}
              />
            </Field>
          ) : null}

          {error ? <p className="text-xs text-bad font-medium">{error}</p> : null}
          {sent ? <p className="text-xs text-good font-semibold">Check your inbox for reset email.</p> : null}

          <Button type="submit" variant="primary" size="md" className="w-full font-semibold mt-1" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}
          </Button>
        </form>

        {mode !== 'reset' ? (
          <>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-xs text-faint font-semibold uppercase">or</span>
              <div className="h-px flex-1 bg-line" />
            </div>

            <Button variant="outline" size="lg" className="w-full gap-2.5 font-bold" onClick={google} disabled={busy}>
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continue with Google
            </Button>
          </>
        ) : null}

        <div className="flex justify-between text-xs pt-1">
          <button
            type="button"
            className="font-bold text-accent hover:underline"
            onClick={() => {
              setMode(mode === 'up' ? 'in' : 'up');
              setError(null);
            }}
          >
            {mode === 'up' ? 'Already have an account? Sign in' : 'Create an account'}
          </button>
          {mode !== 'reset' ? (
            <button
              type="button"
              className="text-muted hover:underline"
              onClick={() => {
                setMode('reset');
                setError(null);
              }}
            >
              Forgot password?
            </button>
          ) : (
            <button
              type="button"
              className="text-muted hover:underline"
              onClick={() => {
                setMode('in');
                setSent(false);
              }}
            >
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
