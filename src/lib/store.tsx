'use client';

/**
 * The ledger store.
 *
 * Load everything once, compute everything in memory, write straight through.
 *
 * There is no pagination and no query layer, and that is a deliberate trade.
 * The moment data arrives in pages, no screen can state a true total — and a
 * finance app whose totals are approximate is a finance app nobody believes. A
 * year of entries is roughly 200KB; Firestore's persistent cache means that on
 * every visit after the first it is read from local disk.
 *
 * Derived numbers are not stored here either. Components call the functions in
 * `@/domain/derive` inside a `useMemo`. One source of truth, recomputed.
 */

import type { Unsubscribe } from 'firebase/firestore';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { nowStamp, today as todayISO, weekKey } from '@/domain/dates';
import { reinforce } from '@/domain/categorize';
import {
  advanceAfterPosting,
  duePostings,
  initialNextDue,
  toEntryDraft,
} from '@/domain/recurring';
import type {
  Account,
  Category,
  Entry,
  EntryDraft,
  Envelope,
  Goal,
  Ledger,
  MerchantMemory,
  MonthKey,
  Paise,
  Recurring,
  Review,
  Rule,
  UserPrefs,
} from '@/domain/types';

import { useAuth } from './auth';
import {
  COLLECTIONS,
  newId,
  patch,
  put,
  putMany,
  remove,
  removeMany,
  savePrefs,
  seedNewUser,
  subscribe,
  subscribePrefs,
  wipeUser,
  type CollectionName,
  type CollectionShapes,
} from './db';

/* -------------------------------------------------------------------------- */
/* Shape of the value                                                          */
/* -------------------------------------------------------------------------- */

export interface LedgerValue {
  ledger: Ledger;
  loading: boolean;
  error: string | null;
  uid: string | null;

  // Entries
  addEntry: (draft: EntryDraft) => Promise<string>;
  addEntries: (drafts: EntryDraft[]) => Promise<void>;
  updateEntry: (id: string, changes: Partial<Entry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  deleteEntries: (ids: string[]) => Promise<void>;
  /** Changes a category AND teaches the categoriser. The whole learning loop. */
  recategorise: (entry: Entry, categoryId: string) => Promise<void>;
  settle: (ids: string[]) => Promise<void>;

  // Accounts
  addAccount: (draft: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateAccount: (id: string, changes: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;

  // Categories
  addCategory: (draft: Omit<Category, 'id'>) => Promise<string>;
  updateCategory: (id: string, changes: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // Envelopes
  setAllocation: (
    month: MonthKey,
    categoryId: string,
    allocated: Paise,
    rollover?: boolean,
  ) => Promise<void>;
  deleteEnvelope: (id: string) => Promise<void>;
  /** Copies last month's allocations forward, so budgeting is one tap in month two. */
  copyEnvelopes: (from: MonthKey, to: MonthKey) => Promise<number>;

  // Goals
  addGoal: (draft: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateGoal: (id: string, changes: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;

  // Rules
  addRule: (draft: Omit<Rule, 'id' | 'createdAt' | 'updatedAt' | 'hitCount'>) => Promise<string>;
  deleteRule: (id: string) => Promise<void>;

  // Recurring
  addRecurring: (
    draft: Omit<Recurring, 'id' | 'createdAt' | 'updatedAt' | 'nextDueDate'>,
  ) => Promise<string>;
  updateRecurring: (id: string, changes: Partial<Recurring>) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;
  /** Writes the entry for a due occurrence and moves the schedule on. */
  postRecurring: (recurring: Recurring, amount?: Paise) => Promise<void>;
  skipRecurring: (recurring: Recurring) => Promise<void>;

  // Review
  completeReview: (itemsResolved: number) => Promise<void>;

  // Preferences and the nuclear option
  updatePrefs: (changes: Partial<UserPrefs>) => Promise<void>;
  deleteEverything: () => Promise<void>;
}

const LedgerContext = createContext<LedgerValue | null>(null);

/* -------------------------------------------------------------------------- */
/* Provider                                                                    */
/* -------------------------------------------------------------------------- */

export function LedgerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [merchants, setMerchants] = useState<MerchantMemory[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [prefs, setPrefs] = useState<UserPrefs>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const seeded = useRef(false);
  const posted = useRef(false);

  useEffect(() => {
    if (!uid) {
      setAccounts([]); setEntries([]); setCategories([]); setEnvelopes([]);
      setGoals([]); setRules([]); setMerchants([]); setRecurring([]);
      setReviews([]); setPrefs({});
      setLoading(false);
      seeded.current = false;
      posted.current = false;
      return;
    }

    const activeUid = uid;
    setLoading(true);
    setError(null);

    // Loading ends only when every collection has reported once — a screen that
    // renders a total before all the entries have arrived shows a wrong total.
    const pending = new Set<string>([...COLLECTIONS, 'prefs']);
    const arrived = (key: string) => {
      pending.delete(key);
      if (pending.size === 0) setLoading(false);
    };

    const fail = (e: Error) => {
      setError(e.message);
      setLoading(false);
    };

    const watch = <K extends CollectionName>(
      name: K,
      apply: (rows: CollectionShapes[K][]) => void,
    ): Unsubscribe =>
      subscribe(
        activeUid,
        name,
        (rows) => {
          apply(rows);
          arrived(name);
        },
        fail,
      );

    const stops: Unsubscribe[] = [
      watch('accounts', setAccounts),
      watch('entries', setEntries),
      watch('categories', setCategories),
      watch('envelopes', setEnvelopes),
      watch('goals', setGoals),
      watch('rules', setRules),
      watch('merchants', setMerchants),
      watch('recurring', setRecurring),
      watch('reviews', setReviews),
      subscribePrefs(
        activeUid,
        (next) => {
          setPrefs(next);
          arrived('prefs');
        },
        fail,
      ),
    ];

    return () => {
      for (const stop of stops) stop();
    };
  }, [uid]);

  // First run: give the account a category list and one cash account.
  useEffect(() => {
    if (!uid || loading || seeded.current) return;
    if (categories.length > 0 || prefs.onboardedAt) return;
    seeded.current = true;
    seedNewUser(uid).catch((e: Error) => setError(e.message));
  }, [uid, loading, categories.length, prefs.onboardedAt]);

  const ledger = useMemo<Ledger>(
    () => ({ accounts, entries, categories, envelopes, goals, rules, merchants, recurring, reviews, prefs }),
    [accounts, entries, categories, envelopes, goals, rules, merchants, recurring, reviews, prefs],
  );

  /* ---------------------------------------------------------------------- */
  /* Writes                                                                  */
  /* ---------------------------------------------------------------------- */

  const requireUid = useCallback((): string => {
    if (!uid) throw new Error('Not signed in.');
    return uid;
  }, [uid]);

  const addEntry = useCallback(
    async (draft: EntryDraft): Promise<string> => {
      const id = requireUid();
      const entryId = newId(id, 'entries');
      const stamp = nowStamp();
      await put(id, 'entries', entryId, { ...draft, createdAt: stamp, updatedAt: stamp });
      return entryId;
    },
    [requireUid],
  );

  const addEntries = useCallback(
    async (drafts: EntryDraft[]): Promise<void> => {
      const id = requireUid();
      const stamp = nowStamp();
      await putMany(
        id,
        'entries',
        drafts.map((draft) => ({
          ...draft,
          id: newId(id, 'entries'),
          createdAt: stamp,
          updatedAt: stamp,
        })),
      );
    },
    [requireUid],
  );

  const updateEntry = useCallback(
    async (entryId: string, changes: Partial<Entry>) => {
      await patch(requireUid(), 'entries', entryId, changes);
    },
    [requireUid],
  );

  const deleteEntry = useCallback(
    async (entryId: string) => {
      await remove(requireUid(), 'entries', entryId);
    },
    [requireUid],
  );

  const deleteEntries = useCallback(
    async (ids: string[]) => {
      await removeMany(requireUid(), 'entries', ids);
    },
    [requireUid],
  );

  /**
   * A correction is the most valuable signal in the app. Recording it against
   * the merchant is what makes categorisation improve without a model, a key or
   * a network call.
   */
  const recategorise = useCallback(
    async (entry: Entry, categoryId: string) => {
      const id = requireUid();
      await patch(id, 'entries', entry.id, { categoryId });

      if (entry.merchant) {
        const existing = merchants.find((m) => m.id === entry.merchant);
        const next = reinforce(existing, entry.merchant, categoryId, todayISO());
        await put(id, 'merchants', next.id, {
          categoryId: next.categoryId,
          confirmations: next.confirmations,
          lastConfirmed: next.lastConfirmed,
        });
      }
    },
    [requireUid, merchants],
  );

  const settle = useCallback(
    async (ids: string[]) => {
      const id = requireUid();
      const stamp = todayISO();
      await Promise.all(ids.map((entryId) => patch(id, 'entries', entryId, { settledAt: stamp })));
    },
    [requireUid],
  );

  const addAccount = useCallback(
    async (draft: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
      const id = requireUid();
      const accountId = newId(id, 'accounts');
      const stamp = nowStamp();
      await put(id, 'accounts', accountId, { ...draft, createdAt: stamp, updatedAt: stamp });
      return accountId;
    },
    [requireUid],
  );

  const updateAccount = useCallback(
    async (accountId: string, changes: Partial<Account>) => {
      await patch(requireUid(), 'accounts', accountId, changes);
    },
    [requireUid],
  );

  /**
   * Archives rather than deletes when the account has history. Removing an
   * account that entries point at would orphan them and silently change every
   * balance that came before.
   */
  const deleteAccount = useCallback(
    async (accountId: string) => {
      const id = requireUid();
      const used = entries.some(
        (e) => e.accountId === accountId || e.counterAccountId === accountId,
      );
      if (used) {
        await patch(id, 'accounts', accountId, { archived: true });
      } else {
        await remove(id, 'accounts', accountId);
      }
    },
    [requireUid, entries],
  );

  const addCategory = useCallback(
    async (draft: Omit<Category, 'id'>): Promise<string> => {
      const id = requireUid();
      const categoryId = newId(id, 'categories');
      await put(id, 'categories', categoryId, draft);
      return categoryId;
    },
    [requireUid],
  );

  const updateCategory = useCallback(
    async (categoryId: string, changes: Partial<Category>) => {
      await patch(requireUid(), 'categories', categoryId, changes);
    },
    [requireUid],
  );

  /** Same reasoning as accounts: history keeps a category alive, archived. */
  const deleteCategory = useCallback(
    async (categoryId: string) => {
      const id = requireUid();
      const used = entries.some((e) => e.categoryId === categoryId);
      if (used) {
        await patch(id, 'categories', categoryId, { archived: true });
      } else {
        await remove(id, 'categories', categoryId);
      }
    },
    [requireUid, entries],
  );

  /** One envelope per category per month; the id encodes that so it cannot duplicate. */
  const setAllocation = useCallback(
    async (month: MonthKey, categoryId: string, allocated: Paise, rollover = false) => {
      const id = requireUid();
      const envelopeId = `${month}_${categoryId}`;
      const existing = envelopes.find((e) => e.id === envelopeId);
      const stamp = nowStamp();

      await put(id, 'envelopes', envelopeId, {
        month,
        categoryId,
        allocated,
        rollover,
        createdAt: existing?.createdAt ?? stamp,
        updatedAt: stamp,
      });
    },
    [requireUid, envelopes],
  );

  const deleteEnvelope = useCallback(
    async (envelopeId: string) => {
      await remove(requireUid(), 'envelopes', envelopeId);
    },
    [requireUid],
  );

  const copyEnvelopes = useCallback(
    async (from: MonthKey, to: MonthKey): Promise<number> => {
      const id = requireUid();
      const source = envelopes.filter((e) => e.month === from);
      if (source.length === 0) return 0;

      const stamp = nowStamp();
      await putMany(
        id,
        'envelopes',
        source.map((e) => ({
          id: `${to}_${e.categoryId}`,
          month: to,
          categoryId: e.categoryId,
          allocated: e.allocated,
          rollover: e.rollover,
          createdAt: stamp,
          updatedAt: stamp,
        })),
      );
      return source.length;
    },
    [requireUid, envelopes],
  );

  const addGoal = useCallback(
    async (draft: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
      const id = requireUid();
      const goalId = newId(id, 'goals');
      const stamp = nowStamp();
      await put(id, 'goals', goalId, { ...draft, createdAt: stamp, updatedAt: stamp });
      return goalId;
    },
    [requireUid],
  );

  const updateGoal = useCallback(
    async (goalId: string, changes: Partial<Goal>) => {
      await patch(requireUid(), 'goals', goalId, changes);
    },
    [requireUid],
  );

  const deleteGoal = useCallback(
    async (goalId: string) => {
      await remove(requireUid(), 'goals', goalId);
    },
    [requireUid],
  );

  const addRule = useCallback(
    async (
      draft: Omit<Rule, 'id' | 'createdAt' | 'updatedAt' | 'hitCount'>,
    ): Promise<string> => {
      const id = requireUid();
      const ruleId = newId(id, 'rules');
      const stamp = nowStamp();
      await put(id, 'rules', ruleId, {
        ...draft,
        hitCount: 0,
        createdAt: stamp,
        updatedAt: stamp,
      });
      return ruleId;
    },
    [requireUid],
  );

  const deleteRule = useCallback(
    async (ruleId: string) => {
      await remove(requireUid(), 'rules', ruleId);
    },
    [requireUid],
  );

  const addRecurring = useCallback(
    async (
      draft: Omit<Recurring, 'id' | 'createdAt' | 'updatedAt' | 'nextDueDate'>,
    ): Promise<string> => {
      const id = requireUid();
      const recurringId = newId(id, 'recurring');
      const stamp = nowStamp();
      await put(id, 'recurring', recurringId, {
        ...draft,
        nextDueDate: initialNextDue(draft.startDate, draft.frequency),
        createdAt: stamp,
        updatedAt: stamp,
      });
      return recurringId;
    },
    [requireUid],
  );

  const updateRecurring = useCallback(
    async (recurringId: string, changes: Partial<Recurring>) => {
      await patch(requireUid(), 'recurring', recurringId, changes);
    },
    [requireUid],
  );

  const deleteRecurring = useCallback(
    async (recurringId: string) => {
      await remove(requireUid(), 'recurring', recurringId);
    },
    [requireUid],
  );

  /**
   * Writes the entry for a due occurrence. `amount` overrides the scheduled
   * figure, which is the whole point for a bill that changes every month — the
   * app never invents a number it was not given.
   */
  const postRecurring = useCallback(
    async (rule: Recurring, amount?: Paise) => {
      const id = requireUid();
      const date = rule.nextDueDate;
      const draft = toEntryDraft(rule, date);

      // `externalId` makes this idempotent: the same occurrence cannot post twice.
      if (entries.some((e) => e.externalId === draft.externalId)) return;

      const stamp = nowStamp();
      await put(id, 'entries', newId(id, 'entries'), {
        ...draft,
        amount: amount ?? draft.amount,
        createdAt: stamp,
        updatedAt: stamp,
      });

      const next = advanceAfterPosting(rule, date, stamp);
      await patch(id, 'recurring', rule.id, {
        lastPostedDate: next.lastPostedDate,
        nextDueDate: next.nextDueDate,
        isActive: next.isActive,
      });
    },
    [requireUid, entries],
  );

  /** Moves the schedule on without writing an entry — the bill did not happen. */
  const skipRecurring = useCallback(
    async (rule: Recurring) => {
      const id = requireUid();
      const next = advanceAfterPosting(rule, rule.nextDueDate, nowStamp());
      await patch(id, 'recurring', rule.id, {
        lastPostedDate: next.lastPostedDate,
        nextDueDate: next.nextDueDate,
        isActive: next.isActive,
      });
    },
    [requireUid],
  );

  const completeReview = useCallback(
    async (itemsResolved: number) => {
      const id = requireUid();
      const day = todayISO();
      const key = weekKey(day);
      await put(id, 'reviews', key, {
        weekOf: day,
        completedAt: nowStamp(),
        itemsResolved,
      });
    },
    [requireUid],
  );

  const updatePrefs = useCallback(
    async (changes: Partial<UserPrefs>) => {
      await savePrefs(requireUid(), changes);
    },
    [requireUid],
  );

  const deleteEverything = useCallback(async () => {
    await wipeUser(requireUid());
  }, [requireUid]);

  /**
   * Fixed-amount recurring entries post themselves once, on load. Anything with
   * a variable amount waits for a person, because a guessed rent is a wrong
   * balance and a wrong balance is worse than a missing one.
   */
  useEffect(() => {
    if (!uid || loading || posted.current || recurring.length === 0) return;
    posted.current = true;

    const run = async () => {
      for (const { recurring: rule, date } of duePostings(recurring)) {
        const draft = toEntryDraft(rule, date);
        if (entries.some((e) => e.externalId === draft.externalId)) continue;

        const stamp = nowStamp();
        await put(uid, 'entries', newId(uid, 'entries'), {
          ...draft,
          createdAt: stamp,
          updatedAt: stamp,
        });

        const next = advanceAfterPosting(rule, date, stamp);
        await patch(uid, 'recurring', rule.id, {
          lastPostedDate: next.lastPostedDate,
          nextDueDate: next.nextDueDate,
          isActive: next.isActive,
        });
      }
    };

    run().catch((e: Error) => setError(e.message));
    // `entries` is intentionally excluded: this runs once per session, and
    // including it would restart the loop on every write it makes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, loading, recurring]);

  const value = useMemo<LedgerValue>(
    () => ({
      ledger, loading, error, uid,
      addEntry, addEntries, updateEntry, deleteEntry, deleteEntries, recategorise, settle,
      addAccount, updateAccount, deleteAccount,
      addCategory, updateCategory, deleteCategory,
      setAllocation, deleteEnvelope, copyEnvelopes,
      addGoal, updateGoal, deleteGoal,
      addRule, deleteRule,
      addRecurring, updateRecurring, deleteRecurring, postRecurring, skipRecurring,
      completeReview, updatePrefs, deleteEverything,
    }),
    [
      ledger, loading, error, uid,
      addEntry, addEntries, updateEntry, deleteEntry, deleteEntries, recategorise, settle,
      addAccount, updateAccount, deleteAccount,
      addCategory, updateCategory, deleteCategory,
      setAllocation, deleteEnvelope, copyEnvelopes,
      addGoal, updateGoal, deleteGoal,
      addRule, deleteRule,
      addRecurring, updateRecurring, deleteRecurring, postRecurring, skipRecurring,
      completeReview, updatePrefs, deleteEverything,
    ],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerValue {
  const value = useContext(LedgerContext);
  if (!value) throw new Error('useLedger must be used inside <LedgerProvider>');
  return value;
}

/** Convenience for the many components that only need the data. */
export function useData(): Ledger {
  return useLedger().ledger;
}
