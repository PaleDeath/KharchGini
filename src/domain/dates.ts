/**
 * Dates.
 *
 * A date in this application is the string 'YYYY-MM-DD' representing a calendar
 * day in India (Asia/Kolkata). Not a Date, not a Timestamp, not an epoch.
 *
 * The reason: an expense belongs to a *day*, not to an instant. "24 August"
 * must stay 24 August whether the app is opened in Pune or on a laptop still
 * set to US Pacific. Storing instants and formatting them per-device is how
 * a transaction ends up in the wrong month, and therefore the wrong budget.
 *
 * All arithmetic below goes through UTC noon, which puts every operation a full
 * 12 hours from a date boundary — so no host timezone or DST rule can push a
 * result onto the wrong day.
 */

export type ISODate = string; // 'YYYY-MM-DD'
export type MonthKey = string; // 'YYYY-MM'

export const IST_TIMEZONE = 'Asia/Kolkata';

// en-CA formats as YYYY-MM-DD, which is exactly the shape we store.
const istDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: IST_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const istTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST_TIMEZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** Today's calendar day in India, regardless of where the device thinks it is. */
export function today(): ISODate {
  return istDayFormatter.format(new Date());
}

/** An ISO timestamp for createdAt/updatedAt. Instants stay instants. */
export function nowStamp(): string {
  return new Date().toISOString();
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = toUTC(value);
  return fromUTC(d) === value;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** ISO day → a Date fixed at UTC noon on that day. */
export function toUTC(iso: ISODate): Date {
  const parts = iso.split('-');
  return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12));
}

export function fromUTC(d: Date): ISODate {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

export function addMonths(iso: ISODate, months: number): ISODate {
  const d = toUTC(iso);
  const targetDay = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  // Clamp: 31 Jan + 1 month is 28/29 Feb, not 3 March.
  const lastDay = daysInMonth(d.getUTCFullYear(), d.getUTCMonth());
  d.setUTCDate(Math.min(targetDay, lastDay));
  return fromUTC(d);
}

export function addYears(iso: ISODate, years: number): ISODate {
  return addMonths(iso, years * 12);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Positive when `b` is later than `a`. */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000);
}

export function monthOf(iso: ISODate): MonthKey {
  return iso.slice(0, 7);
}

export function currentMonth(): MonthKey {
  return monthOf(today());
}

export function startOfMonth(month: MonthKey): ISODate {
  return `${month}-01`;
}

export function endOfMonth(month: MonthKey): ISODate {
  const parts = month.split('-');
  const year = Number(parts[0]);
  const monthIndex = Number(parts[1]) - 1;
  return `${month}-${pad(daysInMonth(year, monthIndex))}`;
}

export function addMonthsToKey(month: MonthKey, delta: number): MonthKey {
  return monthOf(addMonths(startOfMonth(month), delta));
}

/** 0 = Sunday … 6 = Saturday, for the given calendar day. */
export function dayOfWeek(iso: ISODate): number {
  return toUTC(iso).getUTCDay();
}

/** Monday-based week start, which is how an Indian work/pay week actually runs. */
export function startOfWeek(iso: ISODate): ISODate {
  const dow = dayOfWeek(iso);
  const back = dow === 0 ? 6 : dow - 1;
  return addDays(iso, -back);
}

export function endOfWeek(iso: ISODate): ISODate {
  return addDays(startOfWeek(iso), 6);
}

/** Stable key for a week, e.g. '2026-W35'. Used to record completed reviews. */
export function weekKey(iso: ISODate): string {
  const monday = startOfWeek(iso);
  const d = toUTC(monday);
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() + 3); // ISO weeks are numbered by their Thursday
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1, 12));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${pad(week)}`;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTH_NAMES_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDay(iso: ISODate): string {
  const d = toUTC(iso);
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`;
}

export function formatDayFull(iso: ISODate): string {
  const d = toUTC(iso);
  return `${DAY_NAMES[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatMonth(month: MonthKey): string {
  const parts = month.split('-');
  return `${MONTH_NAMES_LONG[Number(parts[1]) - 1]} ${parts[0]}`;
}

export function formatMonthShort(month: MonthKey): string {
  const parts = month.split('-');
  return `${MONTH_NAMES[Number(parts[1]) - 1]} ${String(parts[0]).slice(2)}`;
}

export function formatWeekday(iso: ISODate): string {
  return DAY_NAMES[dayOfWeek(iso)] ?? '';
}

export function formatTime(stamp: string): string {
  return istTimeFormatter.format(new Date(stamp));
}

/**
 * "Today" / "Yesterday" / "Tue" for the last week / "24 Aug" beyond that.
 * Relative labels only where they are unambiguous — past a week, "3 Tuesdays
 * ago" is worse than a date.
 */
export function formatRelativeDay(iso: ISODate, from: ISODate = today()): string {
  const delta = daysBetween(from, iso);
  if (delta === 0) return 'Today';
  if (delta === -1) return 'Yesterday';
  if (delta === 1) return 'Tomorrow';
  if (delta < 0 && delta > -7) return formatWeekday(iso);
  if (delta > 0 && delta < 7) return formatWeekday(iso);
  return formatDay(iso);
}

/** "in 3 days" / "3 days ago" / "today" — for bills and goal deadlines. */
export function formatDueIn(iso: ISODate, from: ISODate = today()): string {
  const delta = daysBetween(from, iso);
  if (delta === 0) return 'today';
  if (delta === 1) return 'tomorrow';
  if (delta === -1) return 'yesterday';
  if (delta > 0) return delta < 14 ? `in ${delta} days` : `in ${Math.round(delta / 7)} weeks`;
  const ago = -delta;
  return ago < 14 ? `${ago} days ago` : `${Math.round(ago / 7)} weeks ago`;
}

/** Inclusive list of every day from `from` to `to`. */
export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const total = daysBetween(from, to);
  for (let i = 0; i <= total; i++) out.push(addDays(from, i));
  return out;
}

/** The last `count` month keys, oldest first, ending at `end`. */
export function recentMonths(count: number, end: MonthKey = currentMonth()): MonthKey[] {
  const out: MonthKey[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(addMonthsToKey(end, -i));
  return out;
}

export function isWithin(iso: ISODate, from: ISODate, to: ISODate): boolean {
  return iso >= from && iso <= to;
}

export { MONTH_NAMES, MONTH_NAMES_LONG, DAY_NAMES };
