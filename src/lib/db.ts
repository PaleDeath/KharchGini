/**
 * Firestore adapter.
 *
 * Everything a user owns lives under `users/{uid}/…` in per-collection
 * subcollections. There is no shared top-level collection, so a security rule
 * failure cannot leak one person's ledger into another's — the isolation is
 * structural, not a filter someone could forget to apply.
 *
 * This module knows about documents. It knows nothing about what the numbers
 * mean; that is `src/domain`.
 */

import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  type CollectionReference,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';

import { getDb } from './firebase';
import { nowStamp } from '@/domain/dates';
import { buildSeedCategories, SEED_ACCOUNT } from '@/domain/seed';
import type {
  Account,
  Category,
  Entry,
  Envelope,
  Goal,
  Ledger,
  MerchantMemory,
  Recurring,
  Review,
  Rule,
  UserPrefs,
} from '@/domain/types';

export type CollectionName =
  | 'accounts'
  | 'entries'
  | 'categories'
  | 'envelopes'
  | 'goals'
  | 'rules'
  | 'merchants'
  | 'recurring'
  | 'reviews';

export const COLLECTIONS: CollectionName[] = [
  'accounts',
  'entries',
  'categories',
  'envelopes',
  'goals',
  'rules',
  'merchants',
  'recurring',
  'reviews',
];

/** Maps a collection name to the shape its documents hold. */
export interface CollectionShapes {
  accounts: Account;
  entries: Entry;
  categories: Category;
  envelopes: Envelope;
  goals: Goal;
  rules: Rule;
  merchants: MerchantMemory;
  recurring: Recurring;
  reviews: Review;
}

function col(uid: string, name: CollectionName): CollectionReference<DocumentData> {
  return collection(getDb(), 'users', uid, name);
}

function userDoc(uid: string) {
  return doc(getDb(), 'users', uid);
}

/**
 * Firestore rejects `undefined`. The domain model uses optional fields freely,
 * so every write is filtered rather than every call site remembering to.
 */
function clean<T extends object>(value: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) out[key] = entry;
  }
  return out;
}

/**
 * The update flavour. Here `undefined` means "the user cleared this field", so
 * it becomes an explicit delete rather than being dropped — otherwise removing a
 * category would appear to work and then silently revert on the next snapshot.
 */
function cleanForUpdate<T extends object>(value: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    out[key] = entry === undefined ? deleteField() : entry;
  }
  return out;
}

/** A document id generated client-side, so the UI has it before the write lands. */
export function newId(uid: string, name: CollectionName): string {
  return doc(col(uid, name)).id;
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Live subscription to a whole collection.
 *
 * No pagination, no query cursors, no `limit`. A person records on the order of
 * 2,000 entries a year — roughly 200KB — and the local cache means this is read
 * from disk on every visit after the first. Paginating would buy nothing and
 * cost the ability to compute a correct total, which is the entire product.
 */
export function subscribe<K extends CollectionName>(
  uid: string,
  name: K,
  onData: (rows: CollectionShapes[K][]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    col(uid, name),
    (snapshot) => {
      const rows = snapshot.docs.map(
        (d) => ({ ...d.data(), id: d.id }) as CollectionShapes[K],
      );
      onData(rows);
    },
    onError,
  );
}

export function subscribePrefs(
  uid: string,
  onData: (prefs: UserPrefs) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    userDoc(uid),
    (snapshot) => onData((snapshot.data() as UserPrefs | undefined) ?? {}),
    onError,
  );
}

/* -------------------------------------------------------------------------- */
/* Writing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Creates or overwrites a document at a known id. `createdAt`/`updatedAt` are
 * stamped here so no caller can forget, and the id is written into the body as
 * well as being the document key — the domain model reads `id` off the object.
 */
export async function put<K extends CollectionName>(
  uid: string,
  name: K,
  id: string,
  data: Omit<CollectionShapes[K], 'id'>,
): Promise<void> {
  await setDoc(doc(col(uid, name), id), clean({ ...data, id }));
}

export async function patch<K extends CollectionName>(
  uid: string,
  name: K,
  id: string,
  changes: Partial<CollectionShapes[K]>,
): Promise<void> {
  await setDoc(
    doc(col(uid, name), id),
    cleanForUpdate({ ...changes, id, updatedAt: nowStamp() }),
    { merge: true },
  );
}

export async function remove(uid: string, name: CollectionName, id: string): Promise<void> {
  await deleteDoc(doc(col(uid, name), id));
}

export async function savePrefs(uid: string, prefs: Partial<UserPrefs>): Promise<void> {
  await setDoc(userDoc(uid), clean({ ...prefs, updatedAt: nowStamp() }), { merge: true });
}

/** Firestore caps a batch at 500 operations; imports routinely exceed that. */
const BATCH_LIMIT = 450;

export async function putMany<K extends CollectionName>(
  uid: string,
  name: K,
  rows: CollectionShapes[K][],
): Promise<void> {
  const reference = col(uid, name);

  for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
    const batch = writeBatch(getDb());
    const chunk = rows.slice(i, i + BATCH_LIMIT);
    for (const row of chunk) {
      batch.set(doc(reference, row.id), clean(row));
    }
    await batch.commit();
  }
}

export async function removeMany(
  uid: string,
  name: CollectionName,
  ids: string[],
): Promise<void> {
  const reference = col(uid, name);

  for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
    const batch = writeBatch(getDb());
    for (const id of ids.slice(i, i + BATCH_LIMIT)) {
      batch.delete(doc(reference, id));
    }
    await batch.commit();
  }
}

/* -------------------------------------------------------------------------- */
/* First run                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Written once, silently, on first login: default categories and a starting
 * cash account, so the very first thing a person does can be recording a ₹50
 * chai rather than configuring a taxonomy.
 *
 * These categories become the user's own rows immediately — renameable,
 * deletable, theirs. Nothing at runtime reads the seed list again.
 */
export async function seedNewUser(uid: string): Promise<void> {
  const stamp = nowStamp();

  const existingAccounts = await loadOnce(uid, 'accounts');
  const existingCategories = await loadOnce(uid, 'categories');

  if (existingCategories.length === 0) {
    await putMany(uid, 'categories', buildSeedCategories());
  }
  if (existingAccounts.length === 0) {
    await put(uid, 'accounts', SEED_ACCOUNT.id, {
      name: SEED_ACCOUNT.name,
      type: SEED_ACCOUNT.type,
      openingBalance: SEED_ACCOUNT.openingBalance,
      sortOrder: SEED_ACCOUNT.sortOrder,
      createdAt: stamp,
      updatedAt: stamp,
    });
  }
  await savePrefs(uid, { onboardedAt: stamp, createdAt: stamp });
}

/** A one-shot read. Used by export and by "delete everything", not by the UI. */
export async function loadOnce<K extends CollectionName>(
  uid: string,
  name: K,
): Promise<CollectionShapes[K][]> {
  const snapshot = await getDocs(col(uid, name));
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as CollectionShapes[K]);
}

/**
 * Deletes every document this user owns. Used by "Delete my data" in settings.
 * Kept in one place so there is exactly one implementation of "gone".
 */
export async function wipeUser(uid: string): Promise<void> {
  for (const name of COLLECTIONS) {
    const rows = await loadOnce(uid, name);
    await removeMany(
      uid,
      name,
      rows.map((row) => row.id),
    );
  }
  await setDoc(userDoc(uid), {});
}

/**
 * Restores a full ledger backup JSON payload into the user's Firestore document tree.
 */
export async function restoreBackup(
  uid: string,
  backup: Partial<Ledger>,
): Promise<{ totalRestored: number }> {
  let count = 0;
  if (Array.isArray(backup.accounts) && backup.accounts.length > 0) {
    await putMany(uid, 'accounts', backup.accounts);
    count += backup.accounts.length;
  }
  if (Array.isArray(backup.entries) && backup.entries.length > 0) {
    await putMany(uid, 'entries', backup.entries);
    count += backup.entries.length;
  }
  if (Array.isArray(backup.categories) && backup.categories.length > 0) {
    await putMany(uid, 'categories', backup.categories);
    count += backup.categories.length;
  }
  if (Array.isArray(backup.envelopes) && backup.envelopes.length > 0) {
    await putMany(uid, 'envelopes', backup.envelopes);
    count += backup.envelopes.length;
  }
  if (Array.isArray(backup.goals) && backup.goals.length > 0) {
    await putMany(uid, 'goals', backup.goals);
    count += backup.goals.length;
  }
  if (Array.isArray(backup.rules) && backup.rules.length > 0) {
    await putMany(uid, 'rules', backup.rules);
    count += backup.rules.length;
  }
  if (Array.isArray(backup.merchants) && backup.merchants.length > 0) {
    await putMany(uid, 'merchants', backup.merchants);
    count += backup.merchants.length;
  }
  if (Array.isArray(backup.recurring) && backup.recurring.length > 0) {
    await putMany(uid, 'recurring', backup.recurring);
    count += backup.recurring.length;
  }
  if (Array.isArray(backup.reviews) && backup.reviews.length > 0) {
    await putMany(uid, 'reviews', backup.reviews);
    count += backup.reviews.length;
  }
  if (backup.prefs && typeof backup.prefs === 'object') {
    await savePrefs(uid, backup.prefs);
  }
  return { totalRestored: count };
}

