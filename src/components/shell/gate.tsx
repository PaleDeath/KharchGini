'use client';

import { KeyRound, Loader2, TriangleAlert, Wallet } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { describeAuthError, useAuth } from '@/lib/auth';
import { missingFirebaseKeys } from '@/lib/firebase';
import { useLedger } from '@/lib/store';

/**
 * Everything that has to be true before a screen can show a number:
 * configuration, then a session, then a loaded ledger. Each failure gets its own
 * honest screen rather than a spinner that never resolves.
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
        <TriangleAlert className="h-7 w-7 text-bad" />
        <h1 className="text-lg font-semibold">Could not read your ledger</h1>
        <p className="max-w-sm text-sm text-muted">{error}</p>
        <p className="max-w-sm text-[13px] text-faint">
          This is usually the Firestore security rules not being published yet. Run{' '}
          <code className="rounded bg-raised px-1 py-0.5">firebase deploy --only firestore</code>{' '}
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
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      {children}
    </div>
  );
}

function Splash({ label }: { label: string }) {
  return (
    <Centred>
      <Wallet className="h-8 w-8 text-accent" />
      <p className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {label}…
      </p>
    </Centred>
  );
}

/**
 * Shown when `.env.local` has not been filled in. It names the missing keys and
 * nothing else — a screen that printed the values would be a screen that leaks
 * them into a screenshot.
 */
function SetupScreen() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-6 py-12">
      <div className="flex items-center gap-2.5">
        <KeyRound className="h-6 w-6 text-accent" />
        <h1 className="text-xl font-semibold">One step left</h1>
      </div>

      <p className="text-sm leading-relaxed text-muted">
        KharchGini stores your ledger in your own Firebase project, so the data is yours and
        reachable from any device. Create a project at{' '}
        <a
          href="https://console.firebase.google.com"
          target="_blank"
          rel="noreferrer"
          className="text-accent underline underline-offset-2"
        >
          console.firebase.google.com
        </a>
        , enable <strong>Authentication → Email/Password</strong> and{' '}
        <strong>Firestore Database</strong>, then copy the web app config into{' '}
        <code className="rounded bg-raised px-1 py-0.5 text-[13px]">.env.local</code>.
      </p>

      <div className="rounded-card border border-line bg-surface p-4">
        <p className="text-[13px] font-medium text-ink">Missing values</p>
        <ul className="mt-2 space-y-1">
          {missingFirebaseKeys.length === 0 ? (
            <li className="text-[13px] text-muted">
              All keys are present but incomplete. Check for typos.
            </li>
          ) : (
            missingFirebaseKeys.map((key) => (
              <li key={key} className="font-mono text-[12px] text-muted">
                NEXT_PUBLIC_FIREBASE_{key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}
              </li>
            ))
          )}
        </ul>
      </div>

      <p className="text-[13px] text-faint">
        Restart the dev server after editing <code>.env.local</code> — Next.js reads it once at
        startup.
      </p>
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
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="space-y-1.5">
        <Wallet className="h-7 w-7 text-accent" />
        <h1 className="text-2xl font-semibold tracking-tight">KharchGini</h1>
        <p className="text-sm text-muted">
          {mode === 'up'
            ? 'Set up an account. It takes about ten seconds.'
            : mode === 'reset'
              ? 'We will email you a link to set a new password.'
              : 'Know what you can spend today.'}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <Field label="Email">
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
          <Field label="Password" hint={mode === 'up' ? 'At least six characters.' : undefined}>
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

        {error ? <p className="text-[13px] text-bad">{error}</p> : null}
        {sent ? <p className="text-[13px] text-good">Check your inbox.</p> : null}

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === 'in' ? 'Sign in' : mode === 'up' ? 'Create account' : 'Send reset link'}
        </Button>
      </form>

      {mode !== 'reset' ? (
        <>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-[12px] text-faint">or</span>
            <div className="h-px flex-1 bg-line" />
          </div>
          <Button variant="outline" size="lg" className="w-full gap-2.5" onClick={google} disabled={busy}>
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

      <div className="flex justify-between text-[13px]">
        <button
          type="button"
          className="text-accent hover:underline"
          onClick={() => {
            setMode(mode === 'up' ? 'in' : 'up');
            setError(null);
          }}
        >
          {mode === 'up' ? 'I already have an account' : 'Create an account'}
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
            Forgot password
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
  );
}
