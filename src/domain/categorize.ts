/**
 * Categorisation.
 *
 * Three sources, checked in this order:
 *
 *   1. RULES          — the user wrote them. They always win.
 *   2. MERCHANT MEMORY — learned from the user's own corrections.
 *   3. KEYWORDS        — the shipped cold-start map.
 *
 * There is no model here, and that is the point. A language model charges per
 * call, needs a network, guesses the same way for everyone, and never gets
 * better at *your* spending. This gets measurably better every time you fix
 * something, costs nothing, and works on a train with no signal.
 *
 * The one thing it does that an LLM cannot: it is auditable. Every suggestion
 * carries the reason it was made.
 */

import { KEYWORD_MAP, STATEMENT_NOISE, TRANSFER_HINTS } from './seed';
import type {
  Category,
  CategoryGuess,
  Direction,
  MerchantMemory,
  Paise,
  Rule,
} from './types';
import { parseAmount } from './money';

/** Bank names carry no information about what was bought. */
const BANK_TOKENS = new Set([
  'hdfc', 'icici', 'sbi', 'axis', 'kotak', 'yesbank', 'idfc', 'indusind',
  'pnb', 'bob', 'canara', 'union', 'federal', 'rbl', 'idbi', 'uco', 'iob',
  'boi', 'cbi', 'dbs', 'hsbc', 'citi', 'scb', 'bandhan', 'ujjivan', 'equitas',
]);

const NOISE = new Set(STATEMENT_NOISE);

/** Lowercase, separators to spaces, whitespace collapsed. */
export function cleanDescription(description: string): string {
  return description
    .toLowerCase()
    .replace(/[/\\\-_@*|.,:;()[\]{}#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Everything non-alphanumeric removed, so "HDFC ERGO" and "hdfc-ergo" agree. */
function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

interface KeywordEntry {
  raw: string;
  squashed: string;
  categoryId: string;
}

/**
 * Longest first, so "amazon prime" beats "amazon" and "prime video" beats a
 * bare token. Short keys are matched on whole words only — a three-letter
 * substring match would put half the ledger in the wrong category.
 */
const KEYWORD_ENTRIES: KeywordEntry[] = Object.entries(KEYWORD_MAP)
  .map(([raw, categoryId]) => ({ raw, squashed: squash(raw), categoryId }))
  .sort((a, b) => b.squashed.length - a.squashed.length);

const MIN_SQUASH_MATCH = 5;

interface KeywordHit {
  categoryId: string;
  keyword: string;
}

export function matchKeyword(description: string): KeywordHit | undefined {
  const cleaned = cleanDescription(description);
  if (!cleaned) return undefined;

  const squashedDescription = squash(cleaned);
  const words = new Set(cleaned.split(' '));

  for (const entry of KEYWORD_ENTRIES) {
    const hit =
      entry.squashed.length >= MIN_SQUASH_MATCH
        ? squashedDescription.includes(entry.squashed)
        : words.has(entry.raw);

    if (hit) return { categoryId: entry.categoryId, keyword: entry.raw };
  }

  return undefined;
}

/**
 * Collapses a bank description to a stable payee key.
 *
 *   "UPI/DR/402913/SWIGGY/HDFC/swiggyupi"     → "swiggy"
 *   "POS 4523XXXXXX1234 DMART BANGALORE"      → "dmart"
 *   "NEFT CR-RAHUL SHARMA"                    → "rahul"
 *
 * Tokens containing digits are reference numbers, not names. Bank names and
 * rail words ("upi", "neft", "pos") say how the money moved, not to whom.
 */
export function merchantKey(description: string): string | undefined {
  const keyword = matchKeyword(description);
  // A recognised brand is a better key than whatever token happens to be first.
  if (keyword) return keyword.keyword;

  const tokens = cleanDescription(description)
    .split(' ')
    .filter(
      (token) =>
        token.length >= 3 &&
        !/\d/.test(token) &&
        !NOISE.has(token) &&
        !BANK_TOKENS.has(token),
    );

  return tokens[0];
}

/** Title-cased merchant for display: "swiggy" → "Swiggy". */
export function displayMerchant(key: string): string {
  return key
    .split(' ')
    .map((part) => (part.length ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join(' ');
}

/** Looks like money moving between the user's own accounts. */
export function looksLikeTransfer(description: string): boolean {
  const cleaned = cleanDescription(description);
  return TRANSFER_HINTS.some((hint) => cleaned.includes(hint));
}

/* -------------------------------------------------------------------------- */
/* Rules                                                                       */
/* -------------------------------------------------------------------------- */

export function matchesRule(
  rule: Rule,
  description: string,
  merchant: string | undefined,
  amount: Paise,
): boolean {
  if (rule.field === 'amount') {
    const threshold = parseAmount(rule.value);
    if (threshold === null) return false;
    if (rule.op === 'gt') return amount > threshold;
    if (rule.op === 'lt') return amount < threshold;
    if (rule.op === 'equals') return amount === threshold;
    return false;
  }

  const haystack = cleanDescription(
    rule.field === 'merchant' ? merchant ?? '' : description,
  );
  const needle = cleanDescription(rule.value);
  if (!needle) return false;

  switch (rule.op) {
    case 'contains':
      return haystack.includes(needle);
    case 'equals':
      return haystack === needle;
    case 'startsWith':
      return haystack.startsWith(needle);
    default:
      return false;
  }
}

/** Higher `priority` wins. Ties fall back to the order rules were created. */
export function sortRules(rules: Rule[]): Rule[] {
  return [...rules].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/* -------------------------------------------------------------------------- */
/* The guess                                                                   */
/* -------------------------------------------------------------------------- */

export interface GuessContext {
  rules: Rule[];
  merchants: MerchantMemory[];
  categories: Category[];
}

const NO_GUESS: CategoryGuess = {
  categoryId: undefined,
  merchant: undefined,
  tags: [],
  source: 'none',
  confidence: 0,
};

/**
 * Income and spending do not share a vocabulary. A keyword that resolves to
 * "Salary" on an outgoing payment is a wrong answer stated confidently, which
 * is worse than no answer — so a candidate whose kind contradicts the direction
 * is discarded and the next source is tried.
 */
function acceptableFor(direction: Direction, category: Category | undefined): boolean {
  if (!category) return false;
  if (direction === 'in') return category.kind === 'income';
  return category.kind !== 'income';
}

export function guessCategory(
  description: string,
  amount: Paise,
  direction: Direction,
  ctx: GuessContext,
): CategoryGuess {
  if (direction === 'transfer') return NO_GUESS;

  const byId = new Map(ctx.categories.filter((c) => !c.archived).map((c) => [c.id, c]));
  const merchant = merchantKey(description);

  // 1. Rules.
  for (const rule of sortRules(ctx.rules)) {
    if (!matchesRule(rule, description, merchant, amount)) continue;
    const category = rule.setCategoryId ? byId.get(rule.setCategoryId) : undefined;
    if (rule.setCategoryId && !acceptableFor(direction, category)) continue;

    return {
      categoryId: rule.setCategoryId,
      merchant: rule.setMerchant ?? merchant,
      tags: rule.setTags ?? [],
      source: 'rule',
      confidence: 1,
    };
  }

  // 2. What this user has taught us.
  if (merchant) {
    const memory = ctx.merchants.find((m) => m.id === merchant);
    const category = memory ? byId.get(memory.categoryId) : undefined;
    if (memory && acceptableFor(direction, category)) {
      return {
        categoryId: memory.categoryId,
        merchant,
        tags: [],
        source: 'memory',
        // Three consistent confirmations is as certain as this ever needs to be.
        confidence: Math.min(0.95, 0.65 + memory.confirmations * 0.1),
      };
    }
  }

  // 3. The shipped map.
  const keyword = matchKeyword(description);
  if (keyword) {
    const category = byId.get(keyword.categoryId);
    if (acceptableFor(direction, category)) {
      return {
        categoryId: keyword.categoryId,
        merchant: merchant ?? keyword.keyword,
        tags: [],
        source: 'keyword',
        confidence: 0.7,
      };
    }
  }

  return { ...NO_GUESS, merchant };
}

/**
 * Folds a correction back into memory. Called whenever the user changes a
 * category by hand — this is the entire learning loop, and it is four lines.
 */
export function reinforce(
  existing: MerchantMemory | undefined,
  merchant: string,
  categoryId: string,
  today: string,
): MerchantMemory {
  const agreed = existing !== undefined && existing.categoryId === categoryId;
  return {
    id: merchant,
    categoryId,
    // A changed mind resets the count; it does not inherit the old confidence.
    confirmations: agreed && existing ? existing.confirmations + 1 : 1,
    lastConfirmed: today,
  };
}

export const CATEGORY_SOURCE_LABEL: Record<CategoryGuess['source'], string> = {
  rule: 'your rule',
  memory: 'learned',
  keyword: 'guessed',
  none: 'needs a category',
};
