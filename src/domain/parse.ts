/**
 * The command bar grammar.
 *
 * One line of text becomes a complete entry. This is the single highest-leverage
 * thing in the application: it is the difference between logging a ₹50 chai and
 * not bothering, and "not bothering" is how every expense tracker dies.
 *
 *   280 chai                        → ₹280 out, Eating Out, today, default account
 *   2,100 groceries hdfc yesterday  → ₹2,100 out, Groceries, HDFC, 23 Aug
 *   +45000 salary                   → ₹45,000 in, Salary
 *   5000 hdfc to savings            → transfer between two accounts
 *   1.5k dinner #goa                → tagged
 *   650 medicines // for amma       → with a note
 *   ?food this month                → a question, not an entry
 *   ?can i afford 15000             → a question about the future
 *
 * Everything is parsed locally with regular expressions. No network, no API
 * key, no latency, and it works in a basement with no signal. The preview
 * always shows what was understood before anything is written, so a wrong
 * guess costs a glance rather than a bad row in the ledger.
 */

import { parseAmount, type Paise } from './money';
import {
  addDays,
  addMonthsToKey,
  endOfMonth,
  monthOf,
  startOfMonth,
  startOfWeek,
  today as todayISO,
  type ISODate,
} from './dates';
import { guessCategory, type GuessContext } from './categorize';
import { isPrimaryCard, type Account, type CategorySource, type Direction } from './types';

/* -------------------------------------------------------------------------- */
/* Result shapes                                                               */
/* -------------------------------------------------------------------------- */

export interface ParsedEntry {
  amount: Paise;
  direction: Direction;
  date: ISODate;
  description: string;
  accountId: string;
  counterAccountId?: string;
  categoryId?: string;
  merchant?: string;
  tags: string[];
  note?: string;
  categorySource: CategorySource;
  confidence: number;
}

export type QueryKind = 'afford' | 'spend';

export interface ParsedQuery {
  kind: QueryKind;
  /** Free text left after the range words were removed, e.g. "food". */
  subject: string;
  from: ISODate;
  to: ISODate;
  rangeLabel: string;
  /** Present when the question was "can I afford X". */
  affordAmount?: Paise;
}

export type ParseResult =
  | { kind: 'empty' }
  | { kind: 'entry'; entry: ParsedEntry }
  | { kind: 'query'; query: ParsedQuery }
  | { kind: 'error'; message: string };

export interface ParseContext extends GuessContext {
  accounts: Account[];
  defaultAccountId: string;
  today?: ISODate;
}

/* -------------------------------------------------------------------------- */
/* Dates in prose                                                              */
/* -------------------------------------------------------------------------- */

const MONTH_TOKENS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};

const WEEKDAY_TOKENS: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5, sat: 6, saturday: 6,
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

interface DateHit {
  date: ISODate;
  matched: string;
}

/**
 * Finds and removes a date phrase. Day-first for numeric forms, because
 * 12/8 means 12 August to everyone who will ever use this.
 */
function extractDate(text: string, today: ISODate): { text: string; hit?: DateHit } {
  const patterns: { re: RegExp; resolve: (m: RegExpExecArray) => ISODate | null }[] = [
    { re: /\b(today|tdy)\b/i, resolve: () => today },
    { re: /\bday before(?: yesterday)?\b/i, resolve: () => addDays(today, -2) },
    { re: /\b(yesterday|yest|ydy)\b/i, resolve: () => addDays(today, -1) },
    { re: /\b(tomorrow|tmrw|tmw)\b/i, resolve: () => addDays(today, 1) },
    {
      re: /\b(\d{1,2})\s*d(?:ays?)?\s+ago\b/i,
      resolve: (m) => addDays(today, -Number(m[1])),
    },
    {
      re: /\blast\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|weds|wed|thurs|thur|thu|fri|sat)\b/i,
      resolve: (m) => lastWeekday(WEEKDAY_TOKENS[m[1]!.toLowerCase()]!, today, true),
    },
    {
      re: /\b(\d{1,2})(?:st|nd|rd|th)?[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/,
      resolve: (m) => {
        const day = Number(m[1]);
        const month = Number(m[2]);
        if (day < 1 || day > 31 || month < 1 || month > 12) return null;
        let year = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
        if (year < 100) year += 2000;
        return `${year}-${pad(month)}-${pad(day)}`;
      },
    },
    {
      re: /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/i,
      resolve: (m) => resolveDayMonth(Number(m[1]), MONTH_TOKENS[m[2]!.toLowerCase()]!, today),
    },
    {
      re: /\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i,
      resolve: (m) => resolveDayMonth(Number(m[2]), MONTH_TOKENS[m[1]!.toLowerCase()]!, today),
    },
    {
      re: /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|weds|wed|thurs|thur|thu|fri|sat)\b/i,
      resolve: (m) => lastWeekday(WEEKDAY_TOKENS[m[1]!.toLowerCase()]!, today, false),
    },
    {
      re: /\b(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)\b/i,
      resolve: (m) => resolveBareDay(Number(m[1]), today),
    },
  ];

  for (const { re, resolve } of patterns) {
    const match = re.exec(text);
    if (!match) continue;
    const resolved = resolve(match);
    if (!resolved) continue;
    return {
      text: (text.slice(0, match.index) + ' ' + text.slice(match.index + match[0].length))
        .replace(/\s+/g, ' ')
        .trim(),
      hit: { date: resolved, matched: match[0] },
    };
  }

  return { text };
}

/** "12 aug" means the most recent 12 August, never one in the future. */
function resolveDayMonth(day: number, month: number, today: ISODate): ISODate | null {
  if (!month || day < 1 || day > 31) return null;
  const year = Number(today.slice(0, 4));
  const candidate = `${year}-${pad(month)}-${pad(day)}`;
  return candidate > today ? `${year - 1}-${pad(month)}-${pad(day)}` : candidate;
}

function resolveBareDay(day: number, today: ISODate): ISODate | null {
  if (day < 1 || day > 31) return null;
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const todayDay = Number(today.slice(8, 10));

  if (day <= todayDay) {
    return `${year}-${pad(month)}-${pad(day)}`;
  } else {
    // e.g. Today is Aug 5th and user enters 28th -> July 28th
    const prevMonth = addMonthsToKey(today.slice(0, 7), -1);
    return `${prevMonth}-${pad(day)}`;
  }
}

/** "tue" means the Tuesday just gone, or today if today is Tuesday. */
function lastWeekday(target: number, today: ISODate, forcePreviousWeek = false): ISODate {
  const current = new Date(`${today}T12:00:00Z`).getUTCDay();
  let back = (current - target + 7) % 7;
  if (forcePreviousWeek || (back === 0 && forcePreviousWeek)) {
    back = back === 0 ? 7 : back + 7;
  }
  return addDays(today, -back);
}

/* -------------------------------------------------------------------------- */
/* Account matching                                                            */
/* -------------------------------------------------------------------------- */

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Common words that must never be mistaken for a bare account token. */
const BARE_ACCOUNT_STOP_WORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'as', 'is', 'it', 'by', 'of', 'for', 'from',
  'with', 'and', 'or', 'if', 'so', 'do', 'no', 'not', 'go', 'up', 'my', 'me', 'we', 'us',
  'he', 'she', 'him', 'her', 'they', 'them', 'this', 'that', 'these', 'those', 'all',
  'day', 'today', 'yest', 'tmrw', 'pm', 'am', 'out', 'off', 'pay', 'paid', 'bill', 'fee',
  'food', 'chai', 'tea', 'cab', 'auto', 'app', 'car', 'pet', 'gas', 'oil', 'can', 'see',
  'now', 'new', 'old', 'top', 'bar', 'pub', 'spa', 'gym', 'box', 'bag', 'lot', 'set',
  'per', 'via', 'dr', 'cr', 'dr.', 'cr.', 'rs', 'inr', 'txn', 'ref', 'buy', 'get', 'got',
]);

/**
 * Finds an account from explicit syntax like `@hdfc` or `to savings`.
 * Exact name beats word match beats prefix beats substring.
 */
export function findAccount(accounts: Account[], token: string): Account | undefined {
  const needle = normalise(token);
  if (needle.length < 2) return undefined;

  const live = accounts.filter((a) => !a.archived);

  // 1. Exact full-name match
  const exact = live.find((a) => normalise(a.name) === needle);
  if (exact) return exact;

  // 2. Exact word match in account name (e.g. "hdfc" in "HDFC Bank")
  const wordMatch = live.find((a) =>
    a.name
      .toLowerCase()
      .split(/\s+/)
      .some((w) => normalise(w) === needle),
  );
  if (wordMatch) return wordMatch;

  // 3. Prefix match (require >= 3 characters)
  if (needle.length >= 3) {
    const prefix = live.find((a) => normalise(a.name).startsWith(needle));
    if (prefix) return prefix;
  }

  // 4. Substring match (require >= 4 characters to prevent loose collisions)
  if (needle.length >= 4) {
    const substring = live.find((a) => normalise(a.name).includes(needle));
    if (substring) return substring;
  }

  return undefined;
}

/**
 * Finds an account from a bare token at the end of a command (e.g. `280 chai hdfc`).
 * Strict: Never matches stop-words and never uses arbitrary substring matching.
 */
export function findBareAccount(accounts: Account[], token: string): Account | undefined {
  const needle = normalise(token);
  if (needle.length < 2) return undefined;
  if (BARE_ACCOUNT_STOP_WORDS.has(needle)) return undefined;

  const live = accounts.filter((a) => !a.archived);

  // 1. Exact full-name match (e.g. "Cash", "Savings", "HDFC")
  const exact = live.find((a) => normalise(a.name) === needle);
  if (exact) return exact;

  // 2. Distinct word match in account name (e.g. "hdfc" in "HDFC Bank")
  const wordMatch = live.find((a) =>
    a.name
      .toLowerCase()
      .split(/\s+/)
      .some((w) => {
        const nw = normalise(w);
        // Generic words like 'bank', 'card', 'account' shouldn't loosely steal tokens
        if (['bank', 'card', 'account', 'pay', 'my'].includes(nw)) return false;
        return nw === needle;
      }),
  );
  if (wordMatch) return wordMatch;

  // 3. Prefix match only if token is at least 4 characters long (e.g. "savi" -> "Savings")
  if (needle.length >= 4) {
    const prefix = live.find((a) => normalise(a.name).startsWith(needle));
    if (prefix) return prefix;
  }

  return undefined;
}

/* -------------------------------------------------------------------------- */
/* The parser                                                                  */
/* -------------------------------------------------------------------------- */

export interface QuickPreset {
  id: string;
  name: string;
  command: string;
  categoryHint?: string;
  iconName: string;
  iconColor: string;
}

export const QUICK_PRESETS: QuickPreset[] = [
  { id: 'chai', name: 'Chai', command: '20 chai', categoryHint: 'dining', iconName: 'coffee', iconColor: '#d97706' },
  { id: 'lunch', name: 'Lunch', command: '250 lunch', categoryHint: 'dining', iconName: 'utensils', iconColor: '#f43f5e' },
  { id: 'auto', name: 'Auto / Cab', command: '120 auto', categoryHint: 'transport', iconName: 'car', iconColor: '#0d9488' },
  { id: 'groceries', name: 'Groceries', command: '850 groceries', categoryHint: 'groceries', iconName: 'shopping-bag', iconColor: '#16a34a' },
  { id: 'coffee', name: 'Coffee', command: '160 cold brew', categoryHint: 'dining', iconName: 'coffee', iconColor: '#ea580c' },
  { id: 'pharmacy', name: 'Pharmacy', command: '320 medicines', categoryHint: 'health', iconName: 'pill', iconColor: '#ef4444' },
  { id: 'petrol', name: 'Petrol', command: '1500 petrol', categoryHint: 'transport', iconName: 'fuel', iconColor: '#f97316' },
  { id: 'dinner', name: 'Dinner', command: '1200 dinner with friends', categoryHint: 'dining', iconName: 'utensils', iconColor: '#6366f1' },
];

/**
 * Intelligent parser for Indian Bank & UPI transaction SMS notifications.
 * Examples:
 * - "Paid Rs.350 to SWIGGY via UPI on 31-Aug-26 txn 402913"
 * - "Your A/C XX1234 debited by INR 1,200.00 on 31/08/2026 to DMART"
 * - "INR 45000.00 credited to A/C 4567 by SALARY on 31-08-2026"
 */
export function parseBankSMS(text: string, ctx: ParseContext): ParsedEntry | null {
  const lower = text.toLowerCase();

  const isSMS =
    /(?:debited|credited|paid|spent|sent|deposited|withdrawn|vpa|upi\s+ref|txn\s+id|a\/c|acct|transfer\s+to|trf\s+to)/i.test(
      text,
    );
  if (!isSMS) return null;

  // 1. Direction
  const isCredit = /(?:credited|deposited|received|refund|cashback)/i.test(text);
  const direction: Direction = isCredit ? 'in' : 'out';

  // 2. Amount extraction
  let amountPaise: Paise | null = null;
  const amountMatch =
    /(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i.exec(text) ??
    /(?:debited(?:\s+by)?|credited(?:\s+by)?|paid|spent|sent)\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i.exec(
      text,
    ) ??
    /([\d,]+(?:\.\d{1,2})?)\s*(?:rs|inr)/i.exec(text);

  if (amountMatch && amountMatch[1]) {
    amountPaise = parseAmount(amountMatch[1].replace(/,/g, ''));
  }

  if (!amountPaise || amountPaise <= 0) return null;

  // 3. Date extraction
  const today = ctx.today ?? todayISO();
  const dateRes = extractDate(text, today);
  let date = dateRes.hit?.date ?? today;

  // Additional SMS date patterns (e.g. 31-Aug-26, 31/08/2026)
  if (!dateRes.hit) {
    const rawDateMatch = /\b(\d{1,2})[-/](\d{1,2}|[A-Za-z]{3,9})[-/](\d{2,4})\b/i.exec(text);
    if (rawDateMatch) {
      const d = Number(rawDateMatch[1]);
      const mStr = rawDateMatch[2]!.toLowerCase();
      let m = MONTH_TOKENS[mStr] ?? Number(mStr);
      let y = Number(rawDateMatch[3]);
      if (y < 100) y += 2000;
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
        const candidate = `${y}-${pad(m)}-${pad(d)}`;
        if (candidate <= today) date = candidate;
      }
    }
  }

  // 4. Payee / Merchant / Description extraction
  let description = '';
  const payeeMatch =
    /(?:to\s+vpa|to|at|towards|trf\s+to|transfer\s+to|payee|info)\s+([A-Za-z0-9\s._&-]{2,35})(?:\s+on|\s+via|\s+ref|\s+txn|\s+using|\s+avl|\s+bal|\.|$|\n)/i.exec(
      text,
    );

  if (payeeMatch && payeeMatch[1]) {
    let rawPayee = payeeMatch[1].trim();
    if (rawPayee.includes('@')) {
      rawPayee = rawPayee.split('@')[0]!.replace(/[^a-zA-Z0-9]/g, ' ');
    }
    description = rawPayee.replace(/\b(a\/c|bank|card|ending|xx\d+|ref\w*)\b/gi, '').trim();
  }

  if (!description) {
    description = isCredit ? 'Income' : 'Card / UPI Expense';
  }

  // 5. Account matching
  let matchedAccount: Account | undefined;

  // 5a. Match by 4 digits (card or A/C number in SMS against account.last4 or name)
  const last4Match = /(?:card\s*(?:ending)?\s*(?:xx|x)?\s*(\d{4})|a\/c\s*(?:no\.?)?\s*(?:xx|x)?\s*(\d{4})|account\s*(?:ending)?\s*(?:xx|x)?\s*(\d{4}))/i.exec(text);
  const detectedDigits = last4Match ? (last4Match[1] || last4Match[2] || last4Match[3]) : undefined;
  if (detectedDigits) {
    matchedAccount = ctx.accounts.find(
      (a) => !a.archived && (a.last4 === detectedDigits || a.name.includes(detectedDigits)),
    );
  }

  // 5b. Match by bank brand keywords
  if (!matchedAccount) {
    const BANK_NAMES = [
      'hdfc', 'icici', 'sbi', 'axis', 'kotak', 'idfc', 'indusind', 'pnb', 'bob',
      'canara', 'union', 'rbl', 'federal', 'amex', 'citi', 'hsbc', 'scb', 'dbs',
      'yesbank', 'jupiter', 'slice', 'onecard', 'amazon pay', 'paytm',
    ];
    const isCreditMentioned = /(?:credit\s+card|card\s*(?:ending|xx))/i.test(text);
    for (const bank of BANK_NAMES) {
      if (lower.includes(bank)) {
        if (isCreditMentioned) {
          // When credit card is mentioned, prefer primary card accounts under this bank first
          const cardFound =
            ctx.accounts.find((a) => !a.archived && isPrimaryCard(a) && normalise(a.name).includes(normalise(bank))) ??
            ctx.accounts.find((a) => !a.archived && a.type === 'card' && normalise(a.name).includes(normalise(bank)));
          if (cardFound) {
            matchedAccount = cardFound;
            break;
          }
        }
        const found = ctx.accounts.find(
          (a) => !a.archived && normalise(a.name).includes(normalise(bank)),
        );
        if (found) {
          matchedAccount = found;
          break;
        }
      }
    }
  }

  // 5c. If credit card mentioned and no account matched yet, prefer primary card account
  if (!matchedAccount && /(?:credit\s+card|card\s*(?:ending|xx))/i.test(text)) {
    matchedAccount =
      ctx.accounts.find((a) => !a.archived && isPrimaryCard(a)) ??
      ctx.accounts.find((a) => !a.archived && a.type === 'card');
  }

  // 5d. Match non-generic account names
  if (!matchedAccount) {
    for (const acc of ctx.accounts) {
      if (acc.archived) continue;
      const clean = normalise(acc.name);
      if (clean.length >= 4 && !['cash', 'bank', 'card', 'wallet', 'savings', 'account'].includes(clean)) {
        if (lower.includes(clean)) {
          matchedAccount = acc;
          break;
        }
      }
    }
  }

  // 6. Note extraction (UPI reference number or Card ref)
  const refMatch = /(?:ref(?:erence)?(?:\s+no)?|txn(?:\s+id)?|utr)\s*(?:is|:)?\s*([A-Za-z0-9]{6,16})/i.exec(
    text,
  );
  const cardMatch = /(?:card\s*(?:ending)?\s*(?:xx|x)?\s*(\d{4}))/i.exec(text);
  const noteParts: string[] = [];
  if (refMatch && refMatch[1]) noteParts.push(`Ref ${refMatch[1]}`);
  if (cardMatch && cardMatch[1]) noteParts.push(`Card **${cardMatch[1]}`);

  const guess = guessCategory(description, amountPaise, direction, ctx);

  return {
    amount: amountPaise,
    direction,
    date,
    description: description.slice(0, 50),
    accountId: matchedAccount?.id ?? ctx.defaultAccountId,
    ...(guess.categoryId ? { categoryId: guess.categoryId } : {}),
    ...(guess.merchant ? { merchant: guess.merchant } : {}),
    tags: guess.tags,
    ...(noteParts.length > 0 ? { note: noteParts.join(' · ') } : {}),
    categorySource: guess.source,
    confidence: guess.confidence,
  };
}

export function parseCommand(input: string, ctx: ParseContext): ParseResult {
  const today = ctx.today ?? todayISO();
  const raw = input.trim();
  if (!raw) return { kind: 'empty' };

  if (raw.startsWith('?')) {
    return { kind: 'query', query: parseQuery(raw.slice(1).trim(), today) };
  }

  // Check if pasted text is a bank / UPI SMS notification
  const smsParsed = parseBankSMS(raw, ctx);
  if (smsParsed) {
    return { kind: 'entry', entry: smsParsed };
  }

  let text = raw;
  const tags: string[] = [];
  let note: string | undefined;

  // A note is everything after "//" — taken first so its contents are never
  // mistaken for tags, dates or amounts.
  const noteAt = text.indexOf('//');
  if (noteAt >= 0) {
    note = text.slice(noteAt + 2).trim() || undefined;
    text = text.slice(0, noteAt).trim();
  }

  // #tags
  text = text
    .replace(/#([\p{L}\p{N}_-]+)/gu, (_full, tag: string) => {
      tags.push(tag.toLowerCase());
      return ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();

  // @account — explicit, so it wins over any bare-token guess later.
  let explicitAccount: Account | undefined;
  text = text
    .replace(/@([\p{L}\p{N}_-]+)/gu, (full, name: string) => {
      const found = findAccount(ctx.accounts, name);
      if (found) {
        explicitAccount = found;
        return ' ';
      }
      return full;
    })
    .replace(/\s+/g, ' ')
    .trim();

  // Dates before amounts, so "12/8" is not read as the number 12.
  const dateResult = extractDate(text, today);
  text = dateResult.text;
  const date = dateResult.hit?.date ?? today;

  // Amount: leading token first, trailing token as a fallback.
  const amountResult = extractAmount(text);
  if (!amountResult) {
    return {
      kind: 'error',
      message: 'Start with an amount — try “280 chai”, or “?” to ask a question.',
    };
  }

  const { amount } = amountResult;
  let direction = amountResult.direction;
  text = amountResult.rest;

  if (amount <= 0) return { kind: 'error', message: 'Amount must be more than zero.' };

  // Transfers: "… to <account>" or "… > <account>".
  let counterAccountId: string | undefined;
  let sourceAccount = explicitAccount;

  const transferMatch = /(?:^|\s)(?:to|>|→)\s+(.+)$/i.exec(text);
  if (transferMatch) {
    const destination = findAccount(ctx.accounts, transferMatch[1]!.trim());
    if (destination) {
      counterAccountId = destination.id;
      direction = 'transfer';
      text = text.slice(0, transferMatch.index).trim();

      // Whatever is left may name the source: "5000 hdfc to savings".
      const remainingTokens = text.split(' ').filter(Boolean);
      const lastToken = remainingTokens[remainingTokens.length - 1];
      if (!sourceAccount && lastToken) {
        const found = findBareAccount(ctx.accounts, lastToken);
        if (found && found.id !== destination.id) {
          sourceAccount = found;
          remainingTokens.pop();
          text = remainingTokens.join(' ');
        }
      }
    }
  }

  // A bare account name, but only when the description survives it and is not a stop-word.
  if (!sourceAccount) {
    const tokens = text.split(' ').filter(Boolean);
    if (tokens.length >= 2) {
      const last = tokens[tokens.length - 1]!;
      const found = findBareAccount(ctx.accounts, last);
      if (found) {
        sourceAccount = found;
        tokens.pop();
        text = tokens.join(' ');
      }
    }
  }

  let finalAccountId = sourceAccount?.id ?? ctx.defaultAccountId;

  // Prevent From and To accounts from being identical in a transfer
  if (direction === 'transfer' && counterAccountId && finalAccountId === counterAccountId) {
    const alternate = ctx.accounts.find((a) => !a.archived && a.id !== counterAccountId);
    if (alternate) {
      finalAccountId = alternate.id;
    }
  }

  const description = text.trim() || (direction === 'transfer' ? 'Transfer' : 'Untitled');
  const guess = guessCategory(description, amount, direction, ctx);

  return {
    kind: 'entry',
    entry: {
      amount,
      direction,
      date,
      description,
      accountId: finalAccountId,
      ...(counterAccountId ? { counterAccountId } : {}),
      ...(guess.categoryId ? { categoryId: guess.categoryId } : {}),
      ...(guess.merchant ? { merchant: guess.merchant } : {}),
      tags: [...tags, ...guess.tags],
      ...(note ? { note } : {}),
      categorySource: guess.source,
      confidence: guess.confidence,
    },
  };
}

interface AmountHit {
  amount: Paise;
  direction: Direction;
  rest: string;
}

function extractAmount(text: string): AmountHit | null {
  const tokens = text.split(' ').filter(Boolean);
  if (tokens.length === 0) return null;

  const tryToken = (index: number): AmountHit | null => {
    const token = tokens[index];
    if (!token) return null;

    let direction: Direction = 'out';
    let body = token;
    if (body.startsWith('+')) {
      direction = 'in';
      body = body.slice(1);
    } else if (body.startsWith('-') || body.startsWith('−')) {
      body = body.slice(1);
    }

    const amount = parseAmount(body);
    if (amount === null) return null;

    const rest = tokens.filter((_, i) => i !== index).join(' ');
    return { amount: Math.abs(amount), direction, rest };
  };

  return tryToken(0) ?? tryToken(tokens.length - 1);
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

interface Range {
  from: ISODate;
  to: ISODate;
  label: string;
}

function extractRange(text: string, today: ISODate): { text: string; range: Range } {
  // "last 30 days" is handled first: it is the only form carrying a number, and
  // the generic table below cannot express it.
  const lastN = /\blast (\d{1,3}) days\b/i.exec(text);
  if (lastN) {
    const days = Number(lastN[1]);
    return {
      text: text.replace(lastN[0], ' ').replace(/\s+/g, ' ').trim(),
      range: { from: addDays(today, -days), to: today, label: `last ${days} days` },
    };
  }

  const month = monthOf(today);
  const options: { re: RegExp; make: () => Range }[] = [
    {
      re: /\bthis month\b/i,
      make: () => ({ from: startOfMonth(month), to: endOfMonth(month), label: 'this month' }),
    },
    {
      re: /\blast month\b/i,
      make: () => {
        const prev = addMonthsToKey(month, -1);
        return { from: startOfMonth(prev), to: endOfMonth(prev), label: 'last month' };
      },
    },
    {
      re: /\bthis week\b/i,
      make: () => ({ from: startOfWeek(today), to: today, label: 'this week' }),
    },
    {
      re: /\blast week\b/i,
      make: () => {
        const start = addDays(startOfWeek(today), -7);
        return { from: start, to: addDays(start, 6), label: 'last week' };
      },
    },
    {
      re: /\bthis year\b/i,
      make: () => ({
        from: `${today.slice(0, 4)}-01-01`,
        to: `${today.slice(0, 4)}-12-31`,
        label: 'this year',
      }),
    },
    {
      re: /\btoday\b/i,
      make: () => ({ from: today, to: today, label: 'today' }),
    },
    {
      re: /\byesterday\b/i,
      make: () => {
        const day = addDays(today, -1);
        return { from: day, to: day, label: 'yesterday' };
      },
    },
  ];

  for (const option of options) {
    const match = option.re.exec(text);
    if (!match) continue;
    return {
      text: text.replace(match[0], ' ').replace(/\s+/g, ' ').trim(),
      range: option.make(),
    };
  }

  // Default horizon: the month you are living in.
  return {
    text,
    range: { from: startOfMonth(month), to: endOfMonth(month), label: 'this month' },
  };
}

function parseQuery(input: string, today: ISODate): ParsedQuery {
  const affordMatch = /(?:can i afford|afford)\s+(.+)$/i.exec(input);
  if (affordMatch) {
    const amount = parseAmount(affordMatch[1]!.trim().split(' ')[0] ?? '');
    const { range } = extractRange(input, today);
    return {
      kind: 'afford',
      subject: affordMatch[1]!.trim(),
      from: range.from,
      to: range.to,
      rangeLabel: range.label,
      ...(amount !== null ? { affordAmount: amount } : {}),
    };
  }

  const { text, range } = extractRange(input, today);
  return {
    kind: 'spend',
    subject: text.replace(/\b(on|for|in|spent|spend)\b/gi, ' ').replace(/\s+/g, ' ').trim(),
    from: range.from,
    to: range.to,
    rangeLabel: range.label,
  };
}

/* -------------------------------------------------------------------------- */
/* Help text — shown in the empty command bar                                  */
/* -------------------------------------------------------------------------- */

export const COMMAND_EXAMPLES: { input: string; means: string }[] = [
  { input: '280 chai', means: '₹280 spent today' },
  { input: '2100 groceries hdfc yesterday', means: 'from a named account, on a past day' },
  { input: '+45000 salary', means: 'money in' },
  { input: '5000 hdfc to savings', means: 'a transfer, not an expense' },
  { input: '1.5k dinner #goa', means: 'tagged for a trip' },
  { input: '650 medicines // for amma', means: 'with a note' },
  { input: '?food this month', means: 'ask a question' },
  { input: '?can i afford 15000', means: 'check before you buy' },
];
