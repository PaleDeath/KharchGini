/**
 * Derivations.
 *
 * Every number the interface shows is computed here, from entries, every time.
 * Nothing in this file is ever written back to the database.
 *
 * That constraint is the reason this app can be trusted. The version it replaces
 * stored `spentAmount` on a budget and `currentAmount` on a goal, which meant a
 * failed write, a deleted transaction or an edited amount left a stored total
 * disagreeing with the ledger it claimed to summarise — and a progress bar over
 * a number nobody verified is worse than no progress bar at all.
 *
 * The cost of recomputing is nothing. A person records perhaps 2,000 entries a
 * year; summing them is measured in microseconds and happens once per render.
 */

import {
  addDays,
  addMonths,
  addMonthsToKey,
  currentMonth,
  daysBetween,
  daysInMonth,
  eachDay,
  endOfMonth,
  isWithin,
  monthOf,
  startOfMonth,
  today as todayISO,
  type ISODate,
  type MonthKey,
} from './dates';
import type { Paise } from './money';
import {
  committedBefore,
  expectedIncomeBetween,
  occurrencesBetween,
  upcoming,
} from './recurring';
import {
  isAddOnCard,
  isPrimaryCard,
  LIQUID_ACCOUNT_TYPES,
  type Account,
  type Anomaly,
  type Category,
  type CategorySpend,
  type DayBalance,
  type Entry,
  type Envelope,
  type EnvelopeStatus,
  type Goal,
  type GoalProgress,
  type Ledger,
  type MonthSummary,
  type PriceObservation,
  type Review,
  type ReviewItem,
  type SafeToSpend,
  type UserPrefs,
} from './types';

/* -------------------------------------------------------------------------- */
/* Small helpers                                                               */
/* -------------------------------------------------------------------------- */

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
    : sorted[mid] ?? 0;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

export function entriesBetween(entries: Entry[], from: ISODate, to: ISODate): Entry[] {
  return entries.filter((e) => isWithin(e.date, from, to));
}

/**
 * Detects if an entry represents salary or primary paycheck income.
 */
export function isSalaryEntry(
  entry: Entry,
  categories?: Map<string, Category>,
): boolean {
  if (entry.direction !== 'in') return false;
  if (entry.tags.some((t) => t.toLowerCase() === 'salary' || t.toLowerCase() === 'payroll')) {
    return true;
  }
  const cat = entry.categoryId && categories ? categories.get(entry.categoryId) : undefined;
  if (cat && (cat.id === 'salary' || cat.name.toLowerCase().includes('salary'))) {
    return true;
  }
  const desc = entry.description.toLowerCase();
  return (
    desc.includes('salary') ||
    desc.includes('payroll') ||
    desc.includes('stipend') ||
    desc.includes('monthly pay')
  );
}

/**
 * Returns the effective budget month ('YYYY-MM') for an entry.
 *
 * For income: If the user configured a late-month payday (>= 20) or enabled
 * salaryFundsNextMonth, credit arriving on or after payday (e.g. 28 Aug)
 * is attributed to the upcoming month (September) where the money will be spent.
 * Can be explicitly overridden per-entry via `entry.budgetMonth`.
 */
export function effectiveMonthOf(
  entry: Entry,
  prefs?: UserPrefs,
  categories?: Map<string, Category>,
): MonthKey {
  if (entry.budgetMonth) {
    return entry.budgetMonth;
  }

  if (entry.direction !== 'in') {
    return monthOf(entry.date);
  }

  const payday = prefs?.payday;
  const fundsNext =
    prefs?.salaryFundsNextMonth ?? (payday !== undefined && payday >= 20);

  if (!fundsNext) {
    return monthOf(entry.date);
  }

  const dayOfMonth = Number(entry.date.slice(8, 10));
  const thresholdDay = payday ? Math.min(payday, 25) : 25;
  const isSalary = isSalaryEntry(entry, categories);

  if (isSalary || dayOfMonth >= thresholdDay) {
    return addMonthsToKey(monthOf(entry.date), 1);
  }

  return monthOf(entry.date);
}

export function entriesInMonth(
  entries: Entry[],
  month: MonthKey,
  prefs?: UserPrefs,
  categories?: Map<string, Category>,
): Entry[] {
  return entries.filter((e) => effectiveMonthOf(e, prefs, categories) === month);
}

/** A category and its direct children. One level of nesting, as the model allows. */
export function categoryFamily(categoryId: string, categories: Category[]): Set<string> {
  const family = new Set<string>([categoryId]);
  for (const c of categories) {
    if (c.parentId === categoryId) family.add(c.id);
  }
  return family;
}

export function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/* -------------------------------------------------------------------------- */
/* Balances                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * One formula, no special cases:
 *
 *   opening + (money in) − (money out) − (transfers away) + (transfers arriving)
 *
 * A credit card is not a special case, it is an account whose balance is
 * negative. Spending on it makes the balance more negative; paying it off is a
 * transfer that moves the balance toward zero. `isLiability` only changes how
 * the number is *worded*, never how it is computed.
 */
export function accountBalances(accounts: Account[], entries: Entry[]): Map<string, Paise> {
  const balances = new Map<string, Paise>();
  for (const account of accounts) {
    balances.set(account.id, account.openingBalance);
  }

  for (const entry of entries) {
    const current = balances.get(entry.accountId);
    if (current !== undefined) {
      const delta = entry.direction === 'in' ? entry.amount : -entry.amount;
      balances.set(entry.accountId, current + delta);
    }

    if (entry.direction === 'transfer' && entry.counterAccountId) {
      const counter = balances.get(entry.counterAccountId);
      if (counter !== undefined) {
        balances.set(entry.counterAccountId, counter + entry.amount);
      }
    }
  }

  return balances;
}

export function accountBalance(
  accountId: string,
  accounts: Account[],
  entries: Entry[],
): Paise {
  return accountBalances(accounts, entries).get(accountId) ?? 0;
}

/** Everything owned minus everything owed. Cards net themselves out. */
export function netWorth(accounts: Account[], entries: Entry[]): Paise {
  const balances = accountBalances(accounts, entries);
  return sum(
    accounts.filter((a) => !a.archived).map((a) => balances.get(a.id) ?? 0),
  );
}

/** Money that could actually be spent today. Excludes cards, savings, reserved accounts. */
export function liquidBalance(accounts: Account[], entries: Entry[]): Paise {
  const balances = accountBalances(accounts, entries);
  return sum(
    accounts
      .filter(
        (a) =>
          !a.archived &&
          !a.excludeFromSafeToSpend &&
          LIQUID_ACCOUNT_TYPES.includes(a.type),
      )
      .map((a) => balances.get(a.id) ?? 0),
  );
}

/* -------------------------------------------------------------------------- */
/* Safe to Spend — the hero number                                             */
/* -------------------------------------------------------------------------- */

/**
 * The end of the current runway: the next payday if one is known, otherwise the
 * end of the month. "What can I spend" is meaningless without "before when".
 */
export function nextPayday(
  prefs: UserPrefs,
  ledger: Pick<Ledger, 'recurring'>,
  today: ISODate = todayISO(),
): ISODate {
  if (prefs.payday && prefs.payday >= 1 && prefs.payday <= 31) {
    const year = Number(today.slice(0, 4));
    const monthIndex = Number(today.slice(5, 7)) - 1;
    const thisMonth = `${today.slice(0, 7)}-${String(
      Math.min(prefs.payday, daysInMonth(year, monthIndex)),
    ).padStart(2, '0')}`;

    if (thisMonth > today) return thisMonth;

    const next = addMonths(startOfMonth(monthOf(today)), 1);
    const nextKey = monthOf(next);
    const nextYear = Number(nextKey.slice(0, 4));
    const nextIndex = Number(nextKey.slice(5, 7)) - 1;
    return `${nextKey}-${String(
      Math.min(prefs.payday, daysInMonth(nextYear, nextIndex)),
    ).padStart(2, '0')}`;
  }

  // No payday configured: believe the recurring income rules instead.
  const horizon = addDays(today, 60);
  const income = expectedIncomeBetween(ledger.recurring, addDays(today, 1), horizon);
  if (income.length > 0 && income[0]) return income[0].date;

  return endOfMonth(monthOf(today));
}

/**
 * Returns all active primary credit cards.
 * Excludes add-on cards as they do not constitute separate primary credit lines.
 */
export function primaryCreditCards(accounts: Account[]): Account[] {
  return accounts.filter((a) => a.type === 'card' && !a.archived && isPrimaryCard(a));
}

/**
 * Returns all active add-on cards, optionally filtered to those linked to a specific primary card.
 */
export function addOnCards(accounts: Account[], primaryCardId?: string): Account[] {
  return accounts.filter((a) => {
    if (a.type !== 'card' || a.archived || !isAddOnCard(a)) return false;
    if (primaryCardId !== undefined) return a.primaryCardId === primaryCardId;
    return true;
  });
}

/**
 * Total credit limit across all active PRIMARY credit card accounts.
 *
 * Add-on cards share the credit line and limit of their primary card and
 * are NOT recognized as primary credit lines or limits to prevent double counting.
 */
export function totalCreditLimit(accounts: Account[]): Paise {
  return primaryCreditCards(accounts).reduce(
    (sum, card) => sum + (card.creditLimit ?? 0),
    0,
  );
}

/**
 * Returns the combined debt attributed to a primary credit line.
 * This combines the balance on the primary card itself PLUS the balances
 * on any active add-on cards linked to it.
 *
 * In credit card banking, bill payments for the entire facility are typically made
 * to the primary card account. Therefore, net line balance is computed by pooling
 * the primary card balance with linked add-on cards, so that payments made on the primary
 * card properly net against add-on card spends.
 */
export function creditLineDebt(
  primaryCardId: string,
  accounts: Account[],
  entries: Entry[],
): Paise {
  const balances = accountBalances(accounts, entries);
  const primary = accounts.find((a) => a.id === primaryCardId);
  if (!primary || primary.archived) return 0;

  let netBalance = balances.get(primary.id) ?? 0;
  for (const a of accounts) {
    if (a.type === 'card' && !a.archived && a.primaryCardId === primaryCardId) {
      netBalance += balances.get(a.id) ?? 0;
    }
  }

  return netBalance < 0 ? Math.abs(netBalance) : 0;
}

/**
 * Calculates the available credit on a primary card's credit line,
 * taking into account both the primary card's debt and any linked add-on cards' debt.
 */
export function creditLineAvailable(
  primaryCard: Account,
  accounts: Account[],
  entries: Entry[],
): Paise {
  const limit = primaryCard.creditLimit ?? 0;
  if (limit <= 0) return 0;
  const debt = creditLineDebt(primaryCard.id, accounts, entries);
  return Math.max(0, limit - debt);
}

/**
 * Total debt owed across all credit card lines (both primary and add-on cards).
 *
 * Each active primary credit line pools its balance with its linked add-on cards.
 * Any standalone or unlinked add-on cards (e.g., parent archived or untracked)
 * are accounted for individually.
 */
export function totalCreditCardDebt(accounts: Account[], entries: Entry[]): Paise {
  const balances = accountBalances(accounts, entries);
  const activePrimaries = primaryCreditCards(accounts);
  const activePrimaryIds = new Set(activePrimaries.map((a) => a.id));

  let totalDebt = 0;
  for (const primary of activePrimaries) {
    totalDebt += creditLineDebt(primary.id, accounts, entries);
  }

  // Standalone or unlinked add-on cards (parent missing or archived)
  for (const a of accounts) {
    if (a.type === 'card' && !a.archived && isAddOnCard(a)) {
      if (!a.primaryCardId || !activePrimaryIds.has(a.primaryCardId)) {
        const bal = balances.get(a.id) ?? 0;
        if (bal < 0) totalDebt += Math.abs(bal);
      }
    }
  }

  return totalDebt;
}

/**
 * Overall credit utilization percentage (0-100) across all primary credit lines.
 * Debt across all active cards (including add-on cards) is divided by the
 * total primary credit limit.
 */
export function creditUtilization(accounts: Account[], entries: Entry[]): number {
  const limit = totalCreditLimit(accounts);
  if (limit <= 0) return 0;
  const debt = totalCreditCardDebt(accounts, entries);
  return Math.min(100, Math.round((debt / limit) * 100));
}

/**
 * Safe to Spend = liquid money
 *               − bills committed before the next payday
 *               − what is still earmarked for essentials this month
 *               − scheduled funding for goals
 *               − reserved for credit card bills (when opted in)
 *
 * The breakdown travels with the number because an unexplained figure at the top
 * of a finance app is not trusted, and an untrusted number is not used.
 */
export function safeToSpend(ledger: Ledger, today: ISODate = todayISO()): SafeToSpend {
  const until = nextPayday(ledger.prefs, ledger, today);
  const liquid = liquidBalance(ledger.accounts, ledger.entries);
  const committedBills = committedBefore(ledger.recurring, today, until);

  // Which categories are already covered by a committed bill — so an envelope
  // for the same category is not subtracted a second time.
  const billedByCategory = new Map<string, Paise>();
  for (const bill of upcoming(ledger.recurring, today, Math.max(0, daysBetween(today, until)))) {
    if (bill.recurring.direction !== 'out') continue;
    if (bill.dueDate > until) continue;
    const key = bill.recurring.categoryId;
    if (!key) continue;
    billedByCategory.set(key, (billedByCategory.get(key) ?? 0) + bill.amount);
  }

  const month = monthOf(today);
  const categories = byId(ledger.categories);
  let reservedNeeds = 0;

  for (const status of envelopeStatuses(ledger, month, today)) {
    const category = categories.get(status.envelope.categoryId);
    if (!category || category.kind !== 'need') continue;
    const alreadyBilled = billedByCategory.get(category.id) ?? 0;
    reservedNeeds += Math.max(0, status.remaining - alreadyBilled);
  }

  // Transfers into a goal's backing account that are scheduled before payday.
  const goalAccounts = new Set(ledger.goals.filter((g) => !g.archived).map((g) => g.accountId));
  let goalFunding = 0;
  for (const rule of ledger.recurring) {
    if (!rule.isActive || rule.direction !== 'transfer') continue;
    if (!rule.counterAccountId || !goalAccounts.has(rule.counterAccountId)) continue;
    goalFunding += sum(
      occurrencesBetween(rule, today, until).map(() => rule.amount),
    );
  }

  // Credit card bill payoff reserve:
  // If the user has chosen to block their budget for credit card debt,
  // money owed across all active credit cards is kept aside from liquid cash.
  let reservedCardBills = 0;
  let reserveAccountShortfall: Paise | undefined = undefined;
  const reserveAccountId = ledger.prefs.reserveAccountId;

  if (ledger.prefs.reserveCreditCardBills) {
    reservedCardBills = totalCreditCardDebt(ledger.accounts, ledger.entries);

    if (reserveAccountId) {
      const balances = accountBalances(ledger.accounts, ledger.entries);
      const accBal = balances.get(reserveAccountId) ?? 0;
      if (accBal < reservedCardBills) {
        reserveAccountShortfall = reservedCardBills - Math.max(0, accBal);
      }
    }
  }

  const amount = liquid - committedBills - reservedNeeds - goalFunding - reservedCardBills;
  const daysLeft = Math.max(1, daysBetween(today, until) + 1);

  return {
    amount,
    liquid,
    committedBills,
    reservedNeeds,
    goalFunding,
    reservedCardBills,
    reserveAccountId,
    reserveAccountShortfall,
    until,
    daysLeft,
    perDay: amount > 0 ? Math.floor(amount / daysLeft) : 0,
    negative: amount < 0,
  };
}

/** "Can I afford ₹15,000?" answered against the same arithmetic as the hero number. */
export function canAfford(
  ledger: Ledger,
  amount: Paise,
  today: ISODate = todayISO(),
): { yes: boolean; after: Paise; sts: SafeToSpend } {
  const sts = safeToSpend(ledger, today);
  return { yes: sts.amount >= amount, after: sts.amount - amount, sts };
}

/* -------------------------------------------------------------------------- */
/* Spending breakdowns                                                         */
/* -------------------------------------------------------------------------- */

export function totalOut(entries: Entry[]): Paise {
  return sum(entries.filter((e) => e.direction === 'out').map((e) => e.amount));
}

export function totalIn(entries: Entry[]): Paise {
  return sum(entries.filter((e) => e.direction === 'in').map((e) => e.amount));
}

/**
 * Spending per category, largest first. Uncategorised spending gets its own row
 * rather than being hidden — a chart that quietly drops 15% of the money is a
 * chart that lies.
 */
export function spendByCategory(
  entries: Entry[],
  categories: Category[],
  from: ISODate,
  to: ISODate,
): CategorySpend[] {
  const window = entriesBetween(entries, from, to).filter((e) => e.direction === 'out');
  const lookup = byId(categories);
  const totals = new Map<string, { total: Paise; count: number }>();

  for (const entry of window) {
    const key = entry.categoryId ?? '';
    const current = totals.get(key) ?? { total: 0, count: 0 };
    totals.set(key, { total: current.total + entry.amount, count: current.count + 1 });
  }

  const grand = sum([...totals.values()].map((t) => t.total));

  return [...totals.entries()]
    .map(([key, value]) => ({
      categoryId: key || undefined,
      category: key ? lookup.get(key) : undefined,
      total: value.total,
      count: value.count,
      pctOfTotal: grand > 0 ? (value.total / grand) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export function monthSummary(ledger: Ledger, month: MonthKey): MonthSummary {
  const categories = byId(ledger.categories);
  const entries = entriesInMonth(ledger.entries, month, ledger.prefs, categories);

  const income = totalIn(entries);
  const spending = totalOut(entries);

  let needs = 0;
  let wants = 0;
  let unsorted = 0;
  for (const entry of entries) {
    if (entry.direction !== 'out') continue;
    const kind = entry.categoryId ? categories.get(entry.categoryId)?.kind : undefined;
    if (kind === 'need') needs += entry.amount;
    else if (kind === 'want' || kind === 'save') wants += entry.amount;
    else unsorted += entry.amount;
  }

  const transfers = sum(
    entries.filter((e) => e.direction === 'transfer').map((e) => e.amount),
  );

  const saved = income - spending;

  return {
    month,
    income,
    spending,
    saved,
    savingsRate: income > 0 ? (saved / income) * 100 : 0,
    needs,
    wants,
    unsorted,
    transfers,
    entryCount: entries.length,
  };
}

/** The last `count` months, oldest first. Feeds the trend chart. */
export function monthSummaries(ledger: Ledger, months: MonthKey[]): MonthSummary[] {
  return months.map((month) => monthSummary(ledger, month));
}

/* -------------------------------------------------------------------------- */
/* Envelopes                                                                   */
/* -------------------------------------------------------------------------- */

/** Spending in one month against a category and its children. */
function spentOnCategory(
  entries: Entry[],
  month: MonthKey,
  family: Set<string>,
): Paise {
  return sum(
    entries
      .filter(
        (e) =>
          e.direction === 'out' &&
          monthOf(e.date) === month &&
          e.categoryId !== undefined &&
          family.has(e.categoryId),
      )
      .map((e) => e.amount),
  );
}

const ROLLOVER_LOOKBACK_MONTHS = 24;

/**
 * What an earlier month handed forward. Rollover chains: an envelope with
 * `rollover: false` stops the chain, because that month's leftover was not meant
 * to survive.
 */
function carriedInto(
  ledger: Ledger,
  month: MonthKey,
  categoryId: string,
  family: Set<string>,
): Paise {
  const floor = monthOf(addMonths(startOfMonth(month), -ROLLOVER_LOOKBACK_MONTHS));

  const chain = ledger.envelopes
    .filter((e) => e.categoryId === categoryId && e.month < month && e.month >= floor)
    .sort((a, b) => a.month.localeCompare(b.month));

  let carry = 0;
  for (const envelope of chain) {
    const available = carry + envelope.allocated;
    const spent = spentOnCategory(ledger.entries, envelope.month, family);
    carry = envelope.rollover ? available - spent : 0;
  }

  return carry;
}

export function envelopeStatus(
  ledger: Ledger,
  envelope: Envelope,
  today: ISODate = todayISO(),
): EnvelopeStatus {
  const category = byId(ledger.categories).get(envelope.categoryId);
  const family = categoryFamily(envelope.categoryId, ledger.categories);

  // Carry-in is decided by the *previous* envelopes' rollover flags, which the
  // chain below already honours. This month's flag governs what leaves it, not
  // what arrives.
  const carriedIn = carriedInto(ledger, envelope.month, envelope.categoryId, family);
  const available = envelope.allocated + carriedIn;
  const spent = spentOnCategory(ledger.entries, envelope.month, family);
  const remaining = available - spent;

  // Pace only means something inside the month you are living in.
  const isCurrent = envelope.month === monthOf(today);
  const total = daysInMonth(
    Number(envelope.month.slice(0, 4)),
    Number(envelope.month.slice(5, 7)) - 1,
  );
  const elapsed = isCurrent ? Number(today.slice(8, 10)) : total;
  const daysRemaining = Math.max(1, total - elapsed + 1);

  return {
    envelope,
    category,
    allocated: envelope.allocated,
    carriedIn,
    available,
    spent,
    remaining,
    usedPct: available > 0 ? clamp((spent / available) * 100, 0, 999) : spent > 0 ? 100 : 0,
    paceAhead:
      isCurrent && available > 0 ? spent / available > elapsed / total : remaining < 0,
    dailyAllowance: isCurrent && remaining > 0 ? Math.floor(remaining / daysRemaining) : 0,
  };
}

export function envelopeStatuses(
  ledger: Ledger,
  month: MonthKey = currentMonth(),
  today: ISODate = todayISO(),
): EnvelopeStatus[] {
  const order = byId(ledger.categories);
  return ledger.envelopes
    .filter((e) => e.month === month)
    .map((envelope) => envelopeStatus(ledger, envelope, today))
    .sort((a, b) => {
      const ao = order.get(a.envelope.categoryId)?.sortOrder ?? 999;
      const bo = order.get(b.envelope.categoryId)?.sortOrder ?? 999;
      return ao - bo;
    });
}

/** Spending this month in categories with no envelope at all. */
export function unbudgetedSpend(
  ledger: Ledger,
  month: MonthKey = currentMonth(),
): CategorySpend[] {
  const budgeted = new Set<string>();
  for (const envelope of ledger.envelopes) {
    if (envelope.month !== month) continue;
    for (const id of categoryFamily(envelope.categoryId, ledger.categories)) {
      budgeted.add(id);
    }
  }

  return spendByCategory(
    ledger.entries,
    ledger.categories,
    startOfMonth(month),
    endOfMonth(month),
  ).filter((row) => !row.categoryId || !budgeted.has(row.categoryId));
}

/**
 * A starting allocation suggested from what the user actually spent, not from a
 * generic rule of thumb. Median of the last three months, so one bad month does
 * not set the budget.
 */
export function suggestAllocation(
  ledger: Ledger,
  categoryId: string,
  month: MonthKey = currentMonth(),
): Paise {
  const family = categoryFamily(categoryId, ledger.categories);
  const history: Paise[] = [];

  for (let i = 1; i <= 3; i++) {
    const past = monthOf(addMonths(startOfMonth(month), -i));
    history.push(spentOnCategory(ledger.entries, past, family));
  }

  const value = median(history.filter((v) => v > 0));
  // Round up to the nearest ₹100 so budgets are numbers a person would choose.
  return value > 0 ? Math.ceil(value / 10_000) * 10_000 : 0;
}

/* -------------------------------------------------------------------------- */
/* Goals                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Progress is the balance of the goal's backing account. There is no stored
 * `currentAmount` to disagree with it: if the money did not move, the bar does
 * not move. That is the entire point.
 */
export function goalProgress(
  ledger: Ledger,
  goal: Goal,
  today: ISODate = todayISO(),
): GoalProgress {
  const saved = Math.max(0, accountBalance(goal.accountId, ledger.accounts, ledger.entries));
  const remaining = Math.max(0, goal.targetAmount - saved);
  const pct = goal.targetAmount > 0 ? clamp((saved / goal.targetAmount) * 100, 0, 100) : 0;

  const daysLeft = goal.targetDate ? daysBetween(today, goal.targetDate) : null;
  const requiredPerWeek =
    goal.targetDate && daysLeft !== null && daysLeft > 0
      ? Math.ceil(remaining / (daysLeft / 7))
      : goal.targetDate
        ? remaining
        : null;

  // Observed funding rate: money that actually arrived in the last 90 days.
  const since = addDays(today, -90);
  const funded = sum(
    ledger.entries
      .filter(
        (e) =>
          e.date >= since &&
          e.date <= today &&
          ((e.direction === 'transfer' && e.counterAccountId === goal.accountId) ||
            (e.direction === 'in' && e.accountId === goal.accountId)),
      )
      .map((e) => e.amount),
  );

  const perWeek = funded > 0 ? funded / (90 / 7) : 0;
  const projectedDate =
    remaining === 0
      ? today
      : perWeek > 0
        ? addDays(today, Math.ceil((remaining / perWeek) * 7))
        : null;

  const onTrack =
    goal.targetDate === undefined
      ? null
      : projectedDate === null
        ? false
        : projectedDate <= goal.targetDate;

  return {
    goal,
    saved,
    remaining,
    pct,
    requiredPerWeek,
    projectedDate,
    onTrack,
    daysLeft,
  };
}

export function goalProgresses(ledger: Ledger, today: ISODate = todayISO()): GoalProgress[] {
  return ledger.goals
    .filter((g) => !g.archived)
    .map((goal) => goalProgress(ledger, goal, today))
    .sort((a, b) => b.pct - a.pct);
}

/* -------------------------------------------------------------------------- */
/* Looking forward — the cash-flow calendar                                    */
/* -------------------------------------------------------------------------- */

/**
 * Projects the liquid balance day by day using known recurring events.
 *
 * This is the question a spreadsheet answers and a tracker never does: not
 * "what did I spend" but "will I still be solvent on the 28th". The dip before
 * payday is visible before it happens, which is the only time it is useful.
 */
export function projectBalance(
  ledger: Ledger,
  from: ISODate = todayISO(),
  days = 45,
): DayBalance[] {
  const to = addDays(from, days);
  let balance = liquidBalance(ledger.accounts, ledger.entries);

  const eventsByDay = new Map<ISODate, DayBalance['events']>();
  const push = (date: ISODate, event: DayBalance['events'][number]) => {
    const list = eventsByDay.get(date) ?? [];
    list.push(event);
    eventsByDay.set(date, list);
  };

  for (const rule of ledger.recurring) {
    if (!rule.isActive) continue;
    for (const date of occurrencesBetween(rule, addDays(from, 1), to)) {
      push(date, {
        label: rule.description,
        amount: rule.amount,
        direction: rule.direction,
      });
    }
  }

  return eachDay(from, to).map((date) => {
    const events = eventsByDay.get(date) ?? [];
    for (const event of events) {
      // A transfer out of a liquid account into savings still reduces what is
      // spendable, so it counts against the projection exactly like an expense.
      balance += event.direction === 'in' ? event.amount : -event.amount;
    }
    return { date, balance, events };
  });
}

/** The worst day in the projection — the one worth warning about. */
export function lowestPoint(projection: DayBalance[]): DayBalance | undefined {
  return projection.reduce<DayBalance | undefined>(
    (worst, day) => (!worst || day.balance < worst.balance ? day : worst),
    undefined,
  );
}

/* -------------------------------------------------------------------------- */
/* Noticing things                                                             */
/* -------------------------------------------------------------------------- */

/** Below this, a "spike" is just noise and not worth interrupting anyone over. */
const ANOMALY_FLOOR: Paise = 50_000; // ₹500
const ANOMALY_RATIO = 1.5;

/**
 * Categories where this month is materially out of line with the median of the
 * three before it. Median, not mean — one Diwali should not permanently raise
 * the bar for what counts as normal.
 */
export function anomalies(
  ledger: Ledger,
  month: MonthKey = currentMonth(),
  lookback = 3,
): Anomaly[] {
  const categories = byId(ledger.categories);
  const out: Anomaly[] = [];

  const active = new Set(
    entriesInMonth(ledger.entries, month, ledger.prefs, categories)
      .filter((e) => e.direction === 'out' && e.categoryId)
      .map((e) => e.categoryId as string),
  );

  for (const categoryId of active) {
    const family = categoryFamily(categoryId, ledger.categories);
    const thisPeriod = spentOnCategory(ledger.entries, month, family);

    const history: Paise[] = [];
    for (let i = 1; i <= lookback; i++) {
      const past = monthOf(addMonths(startOfMonth(month), -i));
      history.push(spentOnCategory(ledger.entries, past, family));
    }

    // No history means no baseline, and no baseline means no claim.
    if (history.every((v) => v === 0)) continue;

    const typical = median(history);
    if (typical === 0) continue;

    const ratio = thisPeriod / typical;
    if (ratio < ANOMALY_RATIO) continue;
    if (thisPeriod - typical < ANOMALY_FLOOR) continue;

    out.push({
      categoryId,
      category: categories.get(categoryId),
      thisPeriod,
      typical,
      ratio,
      entryIds: entriesInMonth(ledger.entries, month, ledger.prefs, categories)
        .filter((e) => e.direction === 'out' && e.categoryId && family.has(e.categoryId))
        .map((e) => e.id),
    });
  }

  return out.sort((a, b) => b.ratio - a.ratio);
}

const PRICE_MIN_OBSERVATIONS = 4;

/**
 * A personal price index.
 *
 * Not the national inflation number — what *your* haircut, *your* groceries and
 * *your* usual restaurant now cost versus what they used to. Three amounts at
 * each end are averaged so a single odd bill does not read as a trend.
 */
export function priceIndex(entries: Entry[], minObservations = PRICE_MIN_OBSERVATIONS): PriceObservation[] {
  const byMerchant = new Map<string, Entry[]>();

  for (const entry of entries) {
    if (entry.direction !== 'out' || !entry.merchant) continue;
    const list = byMerchant.get(entry.merchant) ?? [];
    list.push(entry);
    byMerchant.set(entry.merchant, list);
  }

  const out: PriceObservation[] = [];

  for (const [merchant, list] of byMerchant) {
    if (list.length < minObservations) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));

    const window = Math.max(1, Math.min(3, Math.floor(sorted.length / 2)));
    const early = sorted.slice(0, window);
    const late = sorted.slice(-window);

    const firstAmount = Math.round(sum(early.map((e) => e.amount)) / early.length);
    const latestAmount = Math.round(sum(late.map((e) => e.amount)) / late.length);
    if (firstAmount === 0) continue;

    out.push({
      merchant,
      first: { date: sorted[0]?.date ?? '', amount: firstAmount },
      latest: { date: sorted[sorted.length - 1]?.date ?? '', amount: latestAmount },
      changePct: ((latestAmount - firstAmount) / firstAmount) * 100,
      observations: sorted.length,
    });
  }

  return out.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
}

/** Reimbursable spending nobody has paid back yet. */
export function owedToMe(entries: Entry[]): Entry[] {
  return entries
    .filter((e) => e.reimbursable && !e.settledAt)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* -------------------------------------------------------------------------- */
/* The weekly review                                                           */
/* -------------------------------------------------------------------------- */

const UNSETTLED_AFTER_DAYS = 14;

/**
 * Builds the review list — the one screen the whole app is designed around.
 *
 * A tracker asks you to visit it. A ritual gives you a reason to. Everything
 * here is either a decision only a person can make, or a mistake worth catching
 * while it is still small. When this list is empty, the app says so and gets out
 * of the way; there is no busywork invented to fill it.
 */
export function reviewItems(ledger: Ledger, today: ISODate = todayISO()): ReviewItem[] {
  const items: ReviewItem[] = [];
  const weekAgo = addDays(today, -7);
  const categories = byId(ledger.categories);

  // 1. Spending with no category — the only thing that actively degrades the data.
  const uncategorised = ledger.entries.filter(
    (e) => e.direction === 'out' && !e.categoryId && e.date >= addDays(today, -30),
  );
  if (uncategorised.length > 0) {
    items.push({
      id: 'uncategorised',
      kind: 'uncategorised',
      title: `${uncategorised.length} ${uncategorised.length === 1 ? 'entry needs' : 'entries need'} a category`,
      detail: 'Categorise once and the app will remember the merchant next time.',
      entryIds: uncategorised.map((e) => e.id),
      action: { type: 'categorise', entryIds: uncategorised.map((e) => e.id) },
    });
  }

  // 2. Bills that came and went unrecorded.
  for (const bill of upcoming(ledger.recurring, today, 0)) {
    if (!bill.overdue) continue;
    items.push({
      id: `bill:${bill.recurring.id}:${bill.dueDate}`,
      kind: 'bill',
      title: `${bill.recurring.description} was due`,
      detail: `Expected on ${bill.dueDate}. Mark it paid, or skip it if it did not happen.`,
      entryIds: [],
      action: { type: 'mark-paid', recurringId: bill.recurring.id },
    });
  }

  // 3. Categories running materially hot this month.
  for (const anomaly of anomalies(ledger, monthOf(today))) {
    items.push({
      id: `anomaly:${anomaly.categoryId}`,
      kind: 'anomaly',
      title: `${anomaly.category?.name ?? 'Spending'} is ${anomaly.ratio.toFixed(1)}× your usual`,
      detail: 'Worth a look — set a cap if this is the new normal.',
      entryIds: anomaly.entryIds,
      action: {
        type: 'cap-envelope',
        categoryId: anomaly.categoryId,
        suggested: Math.ceil(anomaly.thisPeriod / 10_000) * 10_000,
      },
    });
  }

  // 4. Envelopes already over for the month.
  for (const status of envelopeStatuses(ledger, monthOf(today), today)) {
    if (status.remaining >= 0) continue;
    items.push({
      id: `overspend:${status.envelope.id}`,
      kind: 'overspend',
      title: `${status.category?.name ?? 'An envelope'} is over`,
      detail: 'Move money from another envelope, or raise the allocation honestly.',
      entryIds: [],
    });
  }

  // 5. Money other people still owe.
  const unsettled = owedToMe(ledger.entries).filter(
    (e) => daysBetween(e.date, today) >= UNSETTLED_AFTER_DAYS,
  );
  if (unsettled.length > 0) {
    items.push({
      id: 'unsettled',
      kind: 'unsettled',
      title: `${unsettled.length} unsettled ${unsettled.length === 1 ? 'reimbursement' : 'reimbursements'}`,
      detail: 'Older than two weeks. Chase, or write them off.',
      entryIds: unsettled.map((e) => e.id),
      action: { type: 'settle', entryIds: unsettled.map((e) => e.id) },
    });
  }

  // 6. A merchant filed the same way often enough to deserve a permanent rule.
  //    Only suggested when the learned memory does not already cover it —
  //    otherwise this is busywork dressed up as a task.
  const seenPairs = new Map<string, Map<string, number>>();
  for (const entry of entriesBetween(ledger.entries, weekAgo, today)) {
    if (entry.direction !== 'out' || !entry.merchant || !entry.categoryId) continue;
    const perCategory = seenPairs.get(entry.merchant) ?? new Map<string, number>();
    perCategory.set(entry.categoryId, (perCategory.get(entry.categoryId) ?? 0) + 1);
    seenPairs.set(entry.merchant, perCategory);
  }

  const bestPerMerchant = new Map<string, { categoryId: string; count: number }>();
  for (const [merchant, perCategory] of seenPairs) {
    for (const [categoryId, count] of perCategory) {
      const current = bestPerMerchant.get(merchant);
      if (!current || count > current.count) {
        bestPerMerchant.set(merchant, { categoryId, count });
      }
    }
  }

  for (const [merchant, info] of bestPerMerchant) {
    if (info.count < 3) continue;
    if (ledger.rules.some((r) => r.value.toLowerCase() === merchant.toLowerCase())) continue;
    if (
      ledger.merchants.some(
        (m) => m.id === merchant && m.categoryId === info.categoryId && m.confirmations >= 3,
      )
    ) {
      continue;
    }

    items.push({
      id: `rule:${merchant}`,
      kind: 'rule',
      title: `Always file ${merchant} under ${categories.get(info.categoryId)?.name ?? 'this category'}?`,
      detail: `Seen ${info.count} times this week. One rule and you never touch it again.`,
      entryIds: [],
      action: { type: 'create-rule', merchant, categoryId: info.categoryId },
    });
  }

  return items;
}

/** True when this week's review has not been done yet. */
export function reviewDue(reviews: Review[], weekId: string): boolean {
  return !reviews.some((r) => r.id === weekId);
}

/* -------------------------------------------------------------------------- */
/* Streaks — the only gamification worth having                                */
/* -------------------------------------------------------------------------- */

/**
 * Consecutive days ending today on which something was recorded.
 *
 * Deliberately not a badge, a level or a trophy. It is a single honest number
 * that answers "am I keeping this up", and it breaks when you stop, which is the
 * only reason a streak means anything.
 */
export function loggingStreak(entries: Entry[], today: ISODate = todayISO()): number {
  const days = new Set(entries.map((e) => e.date));
  // Today not being logged yet does not break yesterday's streak.
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;

  while (days.has(cursor) && streak < 3650) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

/** Days since the last entry — drives the gentle "catch up" prompt. */
export function daysSinceLastEntry(entries: Entry[], today: ISODate = todayISO()): number | null {
  if (entries.length === 0) return null;
  const latest = entries.reduce((max, e) => (e.date > max ? e.date : max), entries[0]!.date);
  return Math.max(0, daysBetween(latest, today));
}
