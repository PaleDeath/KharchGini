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
          <Button variant="outline" size="lg" className="w-full" onClick={google} disabled={busy}>
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
