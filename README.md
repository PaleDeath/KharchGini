# KharchGini

A personal financial interface. Not an expense tracker you feed — a place that
answers *what can I spend today*, and keeps answering it as your life changes.

Built for one person (you), on a free tier, and designed so that coming back to
it on day 200 is as cheap as day 1.

---

## The idea

Most trackers ask you to record the past and then show it back to you as a pie
chart. That is a diary, and diaries get abandoned by February, because logging
costs something every day and pays nothing back until you go looking.

KharchGini inverts it: **every entry immediately changes a number you actually
care about.** Type `280 chai` and Safe to Spend drops by ₹280 on the same
screen. The reward is instant and the loop closes itself.

Four screens, and each one answers one question:

| Tab | Question | What lives there |
| --- | --- | --- |
| **Today** | *What can I spend?* | Safe to Spend, today's entries, what's due, the nudge of the day |
| **Money** | *What actually happened?* | Accounts and balances, the full searchable ledger, transfers |
| **Plan** | *What should happen?* | Envelopes (monthly budgets), goals, recurring bills and income |
| **You** | *Everything else* | Trends, category spend, price index, categories, rules, settings, export |

Plus the **command bar** — one input, reachable from anywhere, that both records
(`450 groceries @hdfc`) and answers (`?food last month`, `?can i afford 15000`).

And the **Weekly Review** — a five-minute ritual that surfaces uncategorised
entries, unusual spending, and goals drifting off track. This is the thing that
makes people return. Not a notification: a small pile of decisions waiting to be
made, that takes five minutes and leaves the ledger clean.

---

## Four rules the code will not break

These are stated at the top of `src/domain/types.ts` and enforced all the way
down into `firestore.rules`.

**1. Money lives in accounts.**
Without accounts there is no balance, and without a balance there is no honest
answer to "what can I spend today". Every entry names an account.

**2. A movement of money has a direction, and one of them is `transfer`.**
Moving ₹10,000 into savings is not an expense. Modelling it as one inflates your
spending, corrupts every chart, and trains you to distrust the app. `in`, `out`,
`transfer` — three directions, not an income/expense binary.

**3. Nothing derived is stored.**
There is no `spentAmount` on an envelope and no `currentAmount` on a goal. Both
are computed from entries, every time, in `src/domain/derive.ts`. *A number you
can type is a number that can lie.* Goal progress **is** the balance of the
account backing the goal — the bar only moves when the money does.

**4. Categories are data.**
They are rows you own, not a constant array in a source file. This is the single
reason a spreadsheet beats a tracker: you can bend it to your life. Rename,
recolour, nest, archive — all of it without a deploy.

---

## Conventions

**Money is integer paise, everywhere.** `₹280.50` is `28050`. Rupees exist only
at the two boundaries: `parseMoney()` on the way in, `formatMoney()` on the way
out. Floats never touch a balance. The Firestore rules assert `amount is int`,
so a float literally cannot be written.

**Dates are `'YYYY-MM-DD'` strings in IST.** Sortable, comparable with `<`,
groupable by `slice(0, 7)`, and immune to the timezone bug where an entry made
at 11pm lands on tomorrow. Arithmetic goes through UTC-noon `Date` objects so
DST and offsets can't shift a day. See `src/domain/dates.ts`.

**Categorisation is a chain, most specific first:**
`Rules` → `MerchantMemory` → keyword map → nothing. Confirm a guess once and the
merchant is remembered; write a rule and it wins forever. The command bar always
shows *which* of these fired, so the app never appears to be guessing in secret.

**No optimistic-state machinery.** Firestore's `onSnapshot` fires immediately on
local writes (latency compensation), so the UI is already instant. Hand-rolling
optimistic updates on top of that is two sources of truth racing each other.

**The whole ledger is loaded once and computed in memory.** For a single
person's finances this is a few thousand documents at most — small enough that
every screen can derive from the same in-memory object, which means no screen
can disagree with another.

---

## Getting it running

You need Node 18+ and a Firebase project (the free Spark plan is enough).

### 1. Install

```powershell
npm install
```

### 2. Create the Firebase project

In the [Firebase console](https://console.firebase.google.com):

1. Create a project. Google Analytics is unnecessary — skip it.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.**
   Set a support email. Add your domain under *Authorized domains* when you
   deploy (`localhost` is already allowed).
3. **Build → Firestore Database → Create database.** Start in **production
   mode** — the rules in this repo replace the defaults. Pick the region closest
   to you (`asia-south1` for India).
4. **Project settings → General → Your apps → Web (`</>`)**. Register the app.
   Copy the six config values it shows you.

### 3. Fill in `.env.local`

Copy `.env.example` to `.env.local` and paste in the six values:

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

These are public-by-design client keys — your data is protected by the security
rules, not by hiding them. If any are missing the app renders a setup screen
naming the absent keys instead of crashing.

### 4. Deploy the security rules

```powershell
npm install -g firebase-tools
firebase login
firebase use --add          # pick the project you just created
firebase deploy --only firestore:rules,firestore:indexes
```

Do not skip this. Without it, Firestore is either wide open or fully closed.

### 5. Run

```powershell
npm run typecheck   # tsc --noEmit
npm run dev         # http://localhost:9002
```

Sign in with Google. On first run the app seeds ~28 categories and one cash
account so you can record something in the first ten seconds.

### 6. Deploy (optional, free)

Vercel is the path of least resistance: import the repo, paste the same six env
vars, deploy. Then add the resulting `*.vercel.app` domain to Firebase's
*Authorized domains* list, or Google sign-in will refuse it.

On your phone, open the deployed URL and **Add to Home Screen**. It installs as
a standalone app with a working offline shell, and the long-press shortcut goes
straight to the add sheet.

---

## Layout

```
src/
  domain/          Pure TypeScript. No React, no Firebase. Testable in isolation.
    types.ts       The model, and the argument for it.
    money.ts       Paise. Parsing, formatting, arithmetic.
    dates.ts       ISO day strings, month keys, IST-safe arithmetic.
    derive.ts      Every number on every screen. Safe to Spend lives here.
    categorize.ts  Rules > merchant memory > keywords.
    parse.ts       The command-bar grammar, for entries and for questions.
    recurring.ts   Schedules, next-due, monthly equivalents.
    seed.ts        The starting categories and account.

  lib/
    firebase.ts    App init + persistent offline cache. Names missing env keys.
    auth.tsx       Google sign-in, one context.
    db.ts          Firestore reads/writes. The only file that knows collection paths.
    store.tsx      Loads the whole ledger, exposes it and every mutation.
    utils.ts       cn(), and little else.

  app/
    (app)/         The four tabs.
    layout.tsx     Fonts, metadata, providers.

  components/
    command/       The one input.
    review/        The weekly ritual.
    entry|account|category|plan|settings/   Sheets, one per thing you can edit.
    ui/            Button, Card, Input, Sheet, Toast, Money. Small and boring.
    shell/         Nav, theme, providers, service worker.

public/            manifest, icon, service worker, offline page.
firestore.rules    Ownership + shape validation. Read it; it documents the model.
```

---

## Things worth knowing

**Privacy mode** toggles a class on `<html>`, which blurs every amount in the
app at once. Screens don't opt in and can't forget.

**The service worker never caches Firebase.** Two caches disagreeing about the
same money is worse than no cache. Your data is already offline — Firestore's
persistent cache holds the whole ledger and queues writes until you're back.

**Undo is a toast, not a dialog.** Confirmation dialogs train people to click
through them. The one exception is wiping all data, which requires typing
`DELETE`, because that one genuinely cannot be undone.

**Export is one tap, in You → Data.** Full JSON backup, or CSV of every entry.
Your data leaves as easily as it arrived; that's the deal.

---

## Status

Written in one pass. `npm install`, `npm run typecheck` and `npm run build` have
**not** been run against this tree — the environment it was authored in could
not execute Node. Verification was a by-hand audit of every import against every
export across all 41 source files, which came back clean, but that is not a
compiler. Expect to fix a small thing or two on first build.
