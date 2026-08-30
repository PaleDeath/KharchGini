/**
 * The domain model.
 *
 * This file is the whole product argument in one place. Four things are true
 * here that were not true of the app this replaces:
 *
 *  1. Money lives in ACCOUNTS. Without accounts there is no balance, and
 *     without a balance there is no answer to "what can I spend today".
 *
 *  2. A movement of money has a DIRECTION, and one of those directions is
 *     `transfer`. Moving ₹10,000 into savings is not an expense. Modelling it
 *     as one inflates spending, corrupts every chart, and trains the user to
 *     distrust the app.
 *
 *  3. Nothing derived is stored. There is no `spentAmount` on an envelope and
 *     no `currentAmount` on a goal. Both are computed from entries, every time.
 *     A number you can type is a number that can lie.
 *
 *  4. CATEGORIES ARE DATA. They are rows the user owns, not a constant array
 *     in a source file. This is the single reason a spreadsheet beats a
 *     tracker: you can bend it to your life.
 */

import type { Paise } from './money';
import type { ISODate, MonthKey } from './dates';

export type { Paise } from './money';
export type { ISODate, MonthKey } from './dates';

/* -------------------------------------------------------------------------- */
/* Accounts                                                                    */
/* -------------------------------------------------------------------------- */

export type AccountType = 'cash' | 'bank' | 'wallet' | 'card' | 'savings';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /**
   * Balance before the first recorded entry. May be negative for a credit card
   * that already carries a balance.
   */
  openingBalance: Paise;
  /**
   * Money that is real but not available — a goal's backing account, a fixed
   * deposit. Counts toward net worth, never toward Safe to Spend.
   */
  excludeFromSafeToSpend?: boolean;
  archived?: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Cards are a liability: a positive balance means money owed, not money held. */
export const LIABILITY_ACCOUNT_TYPES: readonly AccountType[] = ['card'];

export function isLiability(account: Account): boolean {
  return LIABILITY_ACCOUNT_TYPES.includes(account.type);
}

/** Cash, bank and wallet money is spendable today. Savings is not, by default. */
export const LIQUID_ACCOUNT_TYPES: readonly AccountType[] = ['cash', 'bank', 'wallet'];

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  cash: 'Cash',
  bank: 'Bank',
  wallet: 'Wallet / UPI',
  card: 'Credit card',
  savings: 'Savings',
};

/* -------------------------------------------------------------------------- */
/* Entries — the one primitive                                                 */
/* -------------------------------------------------------------------------- */

/**
 * `in`       money arrives      → accountId is the destination
 * `out`      money leaves       → accountId is the source
 * `transfer` money moves        → accountId is the source, counterAccountId the destination
 */
export type Direction = 'in' | 'out' | 'transfer';

export type EntrySource = 'manual' | 'import' | 'recurring' | 'rule';

export interface Entry {
  id: string;
  date: ISODate;
  /** Always positive. The sign lives in `direction`, never in the amount. */
  amount: Paise;
  direction: Direction;
  accountId: string;
  counterAccountId?: string;
  categoryId?: string;
  description: string;
  /** Normalised payee, extracted from the description or set by a rule. */
  merchant?: string;
  note?: string;
  tags: string[];
  /** Someone owes this back. Shows in "Owed to me" until settled. */
  reimbursable?: boolean;
  settledAt?: ISODate;
  source: EntrySource;
  recurringId?: string;
  /** Stable key from an imported file, used to never import the same row twice. */
  externalId?: string;
  createdAt: string;
  updatedAt: string;
}

export type EntryDraft = Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>;

/** A transfer moves money between the user's own accounts; it is not spending. */
export function isSpending(entry: Entry): boolean {
  return entry.direction === 'out';
}

export function isIncome(entry: Entry): boolean {
  return entry.direction === 'in';
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * `kind` exists so the app can compute a needs/wants/savings split without ever
 * asking the user a single extra question at entry time. It is the cheapest
 * possible source of real insight.
 */
export type CategoryKind = 'need' | 'want' | 'save' | 'income';

export interface Category {
  id: string;
  name: string;
  /** One level of nesting only. Food → Delivery. Not a tree, a list with parents. */
  parentId?: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  archived?: boolean;
  sortOrder: number;
}

export const CATEGORY_KIND_LABEL: Record<CategoryKind, string> = {
  need: 'Need',
  want: 'Want',
  save: 'Save',
  income: 'Income',
};

/* -------------------------------------------------------------------------- */
/* Envelopes — what replaced "Budget"                                          */
/* -------------------------------------------------------------------------- */

/**
 * An envelope is an allocation, not a ceiling with a stored counter. What was
 * spent against it is derived from entries at read time, so it is never stale
 * and there is no "Sync Spending" button to forget to press.
 */
export interface Envelope {
  id: string;
  month: MonthKey;
  categoryId: string;
  allocated: Paise;
  /** Carry an unspent remainder (or an overspend) into next month. */
  rollover: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EnvelopeStatus {
  envelope: Envelope;
  category: Category | undefined;
  allocated: Paise;
  carriedIn: Paise;
  available: Paise;
  spent: Paise;
  remaining: Paise;
  /** 0–100, clamped. */
  usedPct: number;
  /** Spending is ahead of the calendar for this month. */
  paceAhead: boolean;
  /** What the remaining days allow, if the remainder is spread evenly. */
  dailyAllowance: Paise;
}

/* -------------------------------------------------------------------------- */
/* Goals — funded by real money or not at all                                  */
/* -------------------------------------------------------------------------- */

/**
 * A goal points at a real account. Progress is the balance of that account.
 * There is deliberately no `currentAmount` field: if the money did not move,
 * the bar does not move.
 */
export interface Goal {
  id: string;
  name: string;
  targetAmount: Paise;
  targetDate?: ISODate;
  accountId: string;
  icon: string;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GoalProgress {
  goal: Goal;
  saved: Paise;
  remaining: Paise;
  pct: number;
  /** Null when the goal has no target date. */
  requiredPerWeek: Paise | null;
  /** Based on the last 90 days of actual funding. Null when there is none. */
  projectedDate: ISODate | null;
  onTrack: boolean | null;
  daysLeft: number | null;
}

/* -------------------------------------------------------------------------- */
/* Rules and merchant memory — the free, offline, improving categoriser        */
/* -------------------------------------------------------------------------- */

export type RuleField = 'description' | 'merchant' | 'amount';
export type RuleOp = 'contains' | 'equals' | 'startsWith' | 'gt' | 'lt';

export interface Rule {
  id: string;
  field: RuleField;
  op: RuleOp;
  value: string;
  setCategoryId?: string;
  setTags?: string[];
  setMerchant?: string;
  priority: number;
  hitCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Learned from corrections. Every time the user recategorises something, the
 * merchant key is remembered. After a few weeks this beats any language model
 * at this specific user's spending, costs nothing, and works on a train.
 */
export interface MerchantMemory {
  /** Document id is the normalised merchant key. */
  id: string;
  categoryId: string;
  confirmations: number;
  lastConfirmed: ISODate;
}

export type CategorySource = 'rule' | 'memory' | 'keyword' | 'none';

export interface CategoryGuess {
  categoryId: string | undefined;
  merchant: string | undefined;
  tags: string[];
  source: CategorySource;
  /** 0–1. Drives whether the UI asks or just proceeds. */
  confidence: number;
}

/* -------------------------------------------------------------------------- */
/* Recurring                                                                   */
/* -------------------------------------------------------------------------- */

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

export interface Recurring {
  id: string;
  description: string;
  amount: Paise;
  direction: Direction;
  accountId: string;
  counterAccountId?: string;
  categoryId?: string;
  frequency: Frequency;
  startDate: ISODate;
  endDate?: ISODate;
  nextDueDate: ISODate;
  isActive: boolean;
  /**
   * When true the entry is written automatically once due. When false it waits
   * in "Coming up" for a confirmation — correct for anything whose amount
   * varies, like a utility bill.
   */
  autoPost: boolean;
  variableAmount: boolean;
  lastPostedDate?: ISODate;
  createdAt: string;
  updatedAt: string;
}

export interface UpcomingBill {
  recurring: Recurring;
  dueDate: ISODate;
  amount: Paise;
  daysAway: number;
  overdue: boolean;
}

/* -------------------------------------------------------------------------- */
/* The weekly ritual                                                           */
/* -------------------------------------------------------------------------- */

export interface Review {
  /** Document id is the week key, e.g. '2026-W35'. */
  id: string;
  weekOf: ISODate;
  completedAt: string;
  itemsResolved: number;
}

export type ReviewItemKind =
  | 'uncategorised'
  | 'anomaly'
  | 'bill'
  | 'overspend'
  | 'unsettled'
  | 'rule';

export interface ReviewItem {
  id: string;
  kind: ReviewItemKind;
  title: string;
  detail: string;
  entryIds: string[];
  /** Present when the item can be resolved by changing app state in one tap. */
  action?: ReviewAction;
}

export type ReviewAction =
  | { type: 'categorise'; entryIds: string[] }
  | { type: 'cap-envelope'; categoryId: string; suggested: Paise }
  | { type: 'mark-paid'; recurringId: string }
  | { type: 'settle'; entryIds: string[] }
  | { type: 'create-rule'; merchant: string; categoryId: string };

/* -------------------------------------------------------------------------- */
/* Derived views                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The hero number, with its own arithmetic attached. The breakdown is not
 * decoration: an unexplained number at the top of a finance app is not
 * trusted, and an untrusted number is not used.
 */
export interface SafeToSpend {
  amount: Paise;
  liquid: Paise;
  committedBills: Paise;
  reservedNeeds: Paise;
  goalFunding: Paise;
  /** The date the runway is measured to — next payday, or end of month. */
  until: ISODate;
  daysLeft: number;
  perDay: Paise;
  /** True when there is not enough to cover what is already committed. */
  negative: boolean;
}

export interface CategorySpend {
  categoryId: string | undefined;
  category: Category | undefined;
  total: Paise;
  count: number;
  pctOfTotal: number;
}

export interface DayBalance {
  date: ISODate;
  balance: Paise;
  events: { label: string; amount: Paise; direction: Direction }[];
}

export interface Anomaly {
  categoryId: string;
  category: Category | undefined;
  thisPeriod: Paise;
  typical: Paise;
  ratio: number;
  entryIds: string[];
}

export interface MonthSummary {
  month: MonthKey;
  income: Paise;
  spending: Paise;
  saved: Paise;
  savingsRate: number;
  needs: Paise;
  wants: Paise;
  /**
   * Spending with no category yet. Kept as its own number rather than folded
   * into `wants`, so `needs + wants + unsorted === spending` and the split never
   * claims to know something it does not.
   */
  unsorted: Paise;
  transfers: Paise;
  entryCount: number;
}

export interface PriceObservation {
  merchant: string;
  first: { date: ISODate; amount: Paise };
  latest: { date: ISODate; amount: Paise };
  changePct: number;
  observations: number;
}

/* -------------------------------------------------------------------------- */
/* User preferences                                                            */
/* -------------------------------------------------------------------------- */

export interface UserPrefs {
  displayName?: string;
  /** Day of month salary usually lands. Drives the Safe to Spend horizon. */
  payday?: number;
  privacyMode?: boolean;
  onboardedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Everything the app holds in memory. Loaded once, never paginated. */
export interface Ledger {
  accounts: Account[];
  entries: Entry[];
  categories: Category[];
  envelopes: Envelope[];
  goals: Goal[];
  rules: Rule[];
  merchants: MerchantMemory[];
  recurring: Recurring[];
  reviews: Review[];
  prefs: UserPrefs;
}

export const EMPTY_LEDGER: Ledger = {
  accounts: [],
  entries: [],
  categories: [],
  envelopes: [],
  goals: [],
  rules: [],
  merchants: [],
  recurring: [],
  reviews: [],
  prefs: {},
};
