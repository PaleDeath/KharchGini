/**
 * Money.
 *
 * Every amount in this application is an INTEGER NUMBER OF PAISE. Never a float,
 * never a rupee-denominated decimal, never a string.
 *
 * The reason is not pedantry. A tracker sums thousands of amounts, and
 * 0.1 + 0.2 === 0.30000000000000004. Once a fraction of a paisa enters the
 * ledger it never leaves, and every derived number — balances, budget
 * remainders, goal progress — inherits the drift. Integers cannot drift.
 *
 * Rupees exist only at two boundaries: the input field (parse) and the screen
 * (format). In between, it is paise.
 */

/** An integer count of paise. 100 paise = ₹1. */
export type Paise = number;

export const PAISE_PER_RUPEE = 100;

/** Largest amount the app will accept: ₹10,00,00,000. Also enforced in firestore.rules. */
export const MAX_PAISE = 100_000_000_000;

export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * PAISE_PER_RUPEE);
}

export function paiseToRupees(paise: Paise): number {
  return paise / PAISE_PER_RUPEE;
}

const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const inrExact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const plainWhole = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * "₹1,24,500" — Indian digit grouping, paise hidden when they are zero.
 * Amounts with real paise render them, because silently rounding a receipt to
 * the rupee is exactly how a ledger stops matching a bank statement.
 */
export function formatMoney(paise: Paise): string {
  const rupees = paiseToRupees(paise);
  return paise % PAISE_PER_RUPEE === 0 ? inrWhole.format(rupees) : inrExact.format(rupees);
}

/** Same, without the currency symbol. For dense table columns. */
export function formatAmount(paise: Paise): string {
  const rupees = paiseToRupees(paise);
  return paise % PAISE_PER_RUPEE === 0
    ? plainWhole.format(rupees)
    : rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * "₹1.2L", "₹84.5k", "₹2.4Cr" — for hero numbers and chart axes, where the
 * exact rupee is noise. Always pair with the exact value on hover/tap.
 */
export function formatCompact(paise: Paise): string {
  const abs = Math.abs(paise);
  const sign = paise < 0 ? '-' : '';
  const r = paiseToRupees(abs);

  if (r >= 10_000_000) return `${sign}₹${trim(r / 10_000_000)}Cr`;
  if (r >= 100_000) return `${sign}₹${trim(r / 100_000)}L`;
  if (r >= 1_000) return `${sign}₹${trim(r / 1_000)}k`;
  return `${sign}${inrWhole.format(r)}`;
}

function trim(n: number): string {
  // 1.0 → "1", 1.25 → "1.3", 12.4 → "12"
  const decimals = n >= 10 ? 0 : 1;
  return n.toFixed(decimals).replace(/\.0$/, '');
}

/** "+₹4,500" / "−₹280". Uses a real minus sign so columns align. */
export function formatSigned(paise: Paise): string {
  if (paise === 0) return formatMoney(0);
  return paise > 0 ? `+${formatMoney(paise)}` : `−${formatMoney(-paise)}`;
}

/**
 * Parses what a person actually types into an amount field or the command bar.
 *
 *   "280"      → 28000        "2,100"   → 210000
 *   "280.50"   → 28050        "₹1,999"  → 199900
 *   "2k"       → 200000       "2.5k"    → 250000
 *   "1.5l"     → 15000000     "1cr"     → 1000000000
 *
 * Returns null for anything it cannot read, so callers must handle failure
 * rather than silently receiving NaN.
 */
export function parseAmount(input: string): Paise | null {
  const cleaned = input
    .trim()
    .replace(/[₹\s,]/g, '')
    .toLowerCase();

  if (!cleaned) return null;

  const match = /^(-?\d*\.?\d+)(k|l|lakh|lac|cr|crore)?$/.exec(cleaned);
  if (!match) return null;

  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;

  let multiplier = 1;
  switch (match[2]) {
    case 'k':
      multiplier = 1_000;
      break;
    case 'l':
    case 'lakh':
    case 'lac':
      multiplier = 100_000;
      break;
    case 'cr':
    case 'crore':
      multiplier = 10_000_000;
      break;
  }

  const paise = Math.round(base * multiplier * PAISE_PER_RUPEE);
  if (!Number.isSafeInteger(paise)) return null;
  if (Math.abs(paise) > MAX_PAISE) return null;

  return paise;
}

/** Percentage of `part` within `whole`, clamped to [0, 100]. Safe when whole is 0. */
export function pct(part: Paise, whole: Paise): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}
