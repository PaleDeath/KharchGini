/**
 * Recurring money.
 *
 * Rent, salary, the SIP, the phone bill. These are the most predictable events
 * in a person's finances and the ones they most want credit for having handled.
 *
 * Two design decisions worth stating:
 *
 *  1. Occurrences are computed as an OFFSET FROM `startDate`, never by walking
 *     forward from the last one. Walking forward and clamping is the classic
 *     recurring-date bug: a rent due on the 31st becomes 28 Feb, then 28 March,
 *     then 28 April, and drifts permanently. Anchoring on the start date means
 *     31 Jan → 28 Feb → 31 Mar, which is what a landlord means.
 *
 *  2. `autoPost` is opt-in per rule. A fixed rent can post itself. A utility
 *     bill whose amount changes every month must not — it waits in "Coming up"
 *     for a real number. An app that invents amounts is an app whose balances
 *     are fiction.
 */

import {
  addDays,
  addMonths,
  addYears,
  dayOfWeek,
  daysBetween,
  endOfMonth,
  monthOf,
  today as todayISO,
  type ISODate,
  type MonthKey,
} from './dates';
import { formatMoney, type Paise } from './money';
import type { EntryDraft, Frequency, Recurring, UpcomingBill } from './types';

/** How far ahead "Coming up" looks by default. */
export const DEFAULT_HORIZON_DAYS = 30;

/** How far back an unposted occurrence still counts as "overdue" rather than lost. */
export const OVERDUE_WINDOW_DAYS = 60;

/** Safety bound; a schedule should never need this many steps to resolve. */
const MAX_STEPS = 500;

/* -------------------------------------------------------------------------- */
/* Occurrences                                                                 */
/* -------------------------------------------------------------------------- */

/** The nth occurrence, counted from `startDate` as n = 0. */
export function occurrenceAt(recurring: Recurring, n: number): ISODate {
  switch (recurring.frequency) {
    case 'daily':
      return addDays(recurring.startDate, n);
    case 'weekly':
      return addDays(recurring.startDate, n * 7);
    case 'monthly':
      return addMonths(recurring.startDate, n);
    case 'yearly':
      return addYears(recurring.startDate, n);
  }
}

/** A close-enough starting guess, refined by the short walk in `nextDueOnOrAfter`. */
function estimateIndex(recurring: Recurring, from: ISODate): number {
  const days = daysBetween(recurring.startDate, from);
  switch (recurring.frequency) {
    case 'daily':
      return days;
    case 'weekly':
      return Math.floor(days / 7);
    case 'monthly':
      return monthsBetween(recurring.startDate, from);
    case 'yearly':
      return Number(from.slice(0, 4)) - Number(recurring.startDate.slice(0, 4));
  }
}

function monthsBetween(a: ISODate, b: ISODate): number {
  const [ay, am] = a.split('-').map(Number) as [number, number, number];
  const [by, bm] = b.split('-').map(Number) as [number, number, number];
  return (by - ay) * 12 + (bm - am);
}

/**
 * The first occurrence on or after `from`, or null once the schedule has ended.
 */
export function nextDueOnOrAfter(recurring: Recurring, from: ISODate): ISODate | null {
  if (from <= recurring.startDate) {
    return recurring.endDate && recurring.startDate > recurring.endDate
      ? null
      : recurring.startDate;
  }

  let n = Math.max(0, estimateIndex(recurring, from));

  // The estimate can land on either side; correct in both directions, bounded.
  let steps = 0;
  while (n > 0 && occurrenceAt(recurring, n - 1) >= from && steps++ < MAX_STEPS) n--;
  steps = 0;
  while (occurrenceAt(recurring, n) < from && steps++ < MAX_STEPS) n++;

  const date = occurrenceAt(recurring, n);
  if (date < from) return null;
  if (recurring.endDate && date > recurring.endDate) return null;
  return date;
}

/** Every occurrence in an inclusive window. */
export function occurrencesBetween(
  recurring: Recurring,
  from: ISODate,
  to: ISODate,
): ISODate[] {
  const out: ISODate[] = [];
  let cursor = nextDueOnOrAfter(recurring, from);
  let steps = 0;

  while (cursor && cursor <= to && steps++ < MAX_STEPS) {
    out.push(cursor);
    cursor = nextDueOnOrAfter(recurring, addDays(cursor, 1));
  }

  return out;
}

/**
 * Recomputes `nextDueDate` after an occurrence has been posted. Returns the rule
 * with `isActive` flipped off once the schedule has run out.
 */
export function advanceAfterPosting(
  recurring: Recurring,
  postedDate: ISODate,
  stamp: string,
): Recurring {
  const next = nextDueOnOrAfter(recurring, addDays(postedDate, 1));
  return {
    ...recurring,
    lastPostedDate: postedDate,
    nextDueDate: next ?? postedDate,
    isActive: next !== null,
    updatedAt: stamp,
  };
}

/* -------------------------------------------------------------------------- */
/* What is due                                                                 */
/* -------------------------------------------------------------------------- */

export interface DuePosting {
  recurring: Recurring;
  date: ISODate;
}

/**
 * Occurrences that have come due and should be written without asking. Only
 * `autoPost` rules with a fixed amount qualify; everything else surfaces as a
 * confirmation instead.
 *
 * Bounded to 90 days of catch-up so that opening the app after a long gap does
 * not silently generate a year of entries.
 */
export function duePostings(
  recurring: Recurring[],
  today: ISODate = todayISO(),
): DuePosting[] {
  const floor = addDays(today, -90);
  const out: DuePosting[] = [];

  for (const rule of recurring) {
    if (!rule.isActive || !rule.autoPost || rule.variableAmount) continue;

    const from = rule.lastPostedDate
      ? addDays(rule.lastPostedDate, 1)
      : rule.startDate;

    for (const date of occurrencesBetween(rule, from > floor ? from : floor, today)) {
      out.push({ recurring: rule, date });
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Everything expected in the next `horizonDays`, plus anything already overdue. */
export function upcoming(
  recurring: Recurring[],
  today: ISODate = todayISO(),
  horizonDays: number = DEFAULT_HORIZON_DAYS,
): UpcomingBill[] {
  const horizon = addDays(today, horizonDays);
  const floor = addDays(today, -OVERDUE_WINDOW_DAYS);
  const out: UpcomingBill[] = [];

  for (const rule of recurring) {
    if (!rule.isActive) continue;

    // Start from whichever is earlier: the stored next due date, or the first
    // unposted occurrence. A rule left unposted for weeks must still show — but
    // a rule that started three years ago must not emit three years of history.
    const unposted = rule.lastPostedDate ? addDays(rule.lastPostedDate, 1) : rule.startDate;
    const earliest = unposted < rule.nextDueDate ? unposted : rule.nextDueDate;
    const searchFrom = earliest > floor ? earliest : floor;

    for (const date of occurrencesBetween(rule, searchFrom, horizon)) {
      const daysAway = daysBetween(today, date);
      out.push({
        recurring: rule,
        dueDate: date,
        amount: rule.amount,
        daysAway,
        overdue: daysAway < 0,
      });
    }
  }

  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Money that must leave before `until`. Feeds the Safe to Spend subtraction. */
export function committedBefore(
  recurring: Recurring[],
  from: ISODate,
  until: ISODate,
): Paise {
  return upcoming(recurring, from, Math.max(0, daysBetween(from, until)))
    .filter((bill) => bill.recurring.direction === 'out' && bill.dueDate <= until)
    .reduce((sum, bill) => sum + bill.amount, 0);
}

/** Income expected between two days — used to find the real end of the runway. */
export function expectedIncomeBetween(
  recurring: Recurring[],
  from: ISODate,
  to: ISODate,
): { date: ISODate; amount: Paise }[] {
  const out: { date: ISODate; amount: Paise }[] = [];

  for (const rule of recurring) {
    if (!rule.isActive || rule.direction !== 'in') continue;
    for (const date of occurrencesBetween(rule, from, to)) {
      out.push({ date, amount: rule.amount });
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/* -------------------------------------------------------------------------- */
/* Turning a rule into an entry                                                */
/* -------------------------------------------------------------------------- */

export function toEntryDraft(recurring: Recurring, date: ISODate): EntryDraft {
  return {
    date,
    amount: recurring.amount,
    direction: recurring.direction,
    accountId: recurring.accountId,
    ...(recurring.counterAccountId ? { counterAccountId: recurring.counterAccountId } : {}),
    ...(recurring.categoryId ? { categoryId: recurring.categoryId } : {}),
    description: recurring.description,
    tags: [],
    source: 'recurring',
    recurringId: recurring.id,
    // Stable, so the same occurrence can never be posted twice.
    externalId: `recurring:${recurring.id}:${date}`,
  };
}

/**
 * Builds the first `nextDueDate` when a rule is created, so a schedule starting
 * in the past does not immediately appear a year overdue.
 */
export function initialNextDue(
  startDate: ISODate,
  frequency: Frequency,
  today: ISODate = todayISO(),
): ISODate {
  const stub: Recurring = {
    id: '', description: '', amount: 0, direction: 'out', accountId: '',
    frequency, startDate, nextDueDate: startDate, isActive: true,
    autoPost: false, variableAmount: false, createdAt: '', updatedAt: '',
  };
  return nextDueOnOrAfter(stub, today) ?? startDate;
}

/* -------------------------------------------------------------------------- */
/* Words                                                                       */
/* -------------------------------------------------------------------------- */

const ORDINALS = ['th', 'st', 'nd', 'rd'];

function ordinal(n: number): string {
  const rem = n % 100;
  const suffix = ORDINALS[(rem - 20) % 10] ?? ORDINALS[rem] ?? ORDINALS[0];
  return `${n}${suffix}`;
}

const WEEKDAY_LONG = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

/** "Every month on the 5th" — schedules read as sentences, not as config. */
export function describeSchedule(recurring: Recurring): string {
  const day = Number(recurring.startDate.slice(8, 10));
  let base = '';

  switch (recurring.frequency) {
    case 'daily':
      base = 'Every day';
      break;
    case 'weekly':
      base = `Every ${WEEKDAY_LONG[dayOfWeek(recurring.startDate)] ?? 'week'}`;
      break;
    case 'monthly':
      base = `Every month on the ${ordinal(day)}`;
      break;
    case 'yearly':
      base = `Every year on ${recurring.startDate.slice(8, 10)}/${recurring.startDate.slice(5, 7)}`;
      break;
  }

  if (recurring.endDate) {
    base += ` · until ${recurring.endDate.slice(8, 10)}/${recurring.endDate.slice(5, 7)}/${recurring.endDate.slice(2, 4)}`;
  }

  return base;
}

/** "₹28,000 · Every month on the 5th" for a one-line summary. */
export function describeRecurring(recurring: Recurring): string {
  const amount = recurring.variableAmount
    ? `~${formatMoney(recurring.amount)}`
    : formatMoney(recurring.amount);
  return `${amount} · ${describeSchedule(recurring)}`;
}

/** Total per month, normalised across frequencies. Used for "committed monthly". */
export function monthlyEquivalent(recurring: Recurring): number {
  switch (recurring.frequency) {
    case 'daily':
      return Math.round(recurring.amount * 30.44);
    case 'weekly':
      return Math.round(recurring.amount * 4.348);
    case 'monthly':
      return recurring.amount;
    case 'yearly':
      return Math.round(recurring.amount / 12);
  }
}

/** Rules whose next occurrence falls inside a given month. */
export function dueInMonth(recurring: Recurring[], month: MonthKey): UpcomingBill[] {
  const from = `${month}-01`;
  const to = endOfMonth(month);
  const out: UpcomingBill[] = [];

  for (const rule of recurring) {
    if (!rule.isActive) continue;
    for (const date of occurrencesBetween(rule, from, to)) {
      if (monthOf(date) !== month) continue;
      out.push({
        recurring: rule,
        dueDate: date,
        amount: rule.amount,
        daysAway: daysBetween(from, date),
        overdue: false,
      });
    }
  }

  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
