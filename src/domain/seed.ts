/**
 * Seed data.
 *
 * These categories are written into the user's own `categories` collection on
 * first sign-in and are theirs from that moment: renameable, recolourable,
 * nestable, deletable. Nothing in the app imports this list at runtime to
 * decide what a category *is* — that would be the hardcoded taxonomy all over
 * again.
 *
 * The keyword map below points at these same ids. In the previous version the
 * importer invented categories ("Fuel", "Cash Withdrawal", "Transfer") that the
 * category dropdown could not produce and budgets could not target, so imported
 * rows landed in a taxonomy nothing else could see. One vocabulary, defined once.
 */

import type { Category, CategoryKind } from './types';

interface SeedCategory {
  id: string;
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  parentId?: string;
}

export const SEED_CATEGORIES: SeedCategory[] = [
  // ---- Needs -------------------------------------------------------------
  { id: 'rent', name: 'Rent & Home', kind: 'need', icon: 'home', color: '#6366f1' },
  { id: 'groceries', name: 'Groceries', kind: 'need', icon: 'shopping-basket', color: '#22c55e' },
  { id: 'utilities', name: 'Utilities', kind: 'need', icon: 'zap', color: '#eab308' },
  { id: 'phone-internet', name: 'Phone & Internet', kind: 'need', icon: 'wifi', color: '#0ea5e9' },
  { id: 'transport', name: 'Transport', kind: 'need', icon: 'bus', color: '#14b8a6' },
  { id: 'fuel', name: 'Fuel', kind: 'need', icon: 'fuel', color: '#f97316' },
  { id: 'health', name: 'Health', kind: 'need', icon: 'heart-pulse', color: '#ef4444' },
  { id: 'insurance', name: 'Insurance', kind: 'need', icon: 'shield', color: '#64748b' },
  { id: 'charges', name: 'Fees & Charges', kind: 'need', icon: 'receipt', color: '#f59e0b' },
  { id: 'education', name: 'Education', kind: 'need', icon: 'graduation-cap', color: '#8b5cf6' },
  { id: 'household', name: 'Household', kind: 'need', icon: 'wrench', color: '#a16207' },

  // ---- Wants -------------------------------------------------------------
  { id: 'dining', name: 'Eating Out', kind: 'want', icon: 'utensils', color: '#f43f5e' },
  { id: 'delivery', name: 'Food Delivery', kind: 'want', icon: 'bike', color: '#fb7185', parentId: 'dining' },
  { id: 'shopping', name: 'Shopping', kind: 'want', icon: 'shopping-bag', color: '#d946ef' },
  { id: 'entertainment', name: 'Entertainment', kind: 'want', icon: 'clapperboard', color: '#a855f7' },
  { id: 'subscriptions', name: 'Subscriptions', kind: 'want', icon: 'repeat', color: '#7c3aed' },
  { id: 'travel', name: 'Travel', kind: 'want', icon: 'plane', color: '#06b6d4' },
  { id: 'personal-care', name: 'Personal Care', kind: 'want', icon: 'scissors', color: '#ec4899' },
  { id: 'gifts', name: 'Gifts & Giving', kind: 'want', icon: 'gift', color: '#f59e0b' },
  { id: 'misc', name: 'Miscellaneous', kind: 'want', icon: 'circle-dashed', color: '#94a3b8' },

  // ---- Saving ------------------------------------------------------------
  { id: 'savings', name: 'Savings', kind: 'save', icon: 'piggy-bank', color: '#10b981' },
  { id: 'investments', name: 'Investments', kind: 'save', icon: 'trending-up', color: '#059669' },

  // ---- Income ------------------------------------------------------------
  { id: 'salary', name: 'Salary', kind: 'income', icon: 'wallet', color: '#16a34a' },
  { id: 'freelance', name: 'Freelance', kind: 'income', icon: 'laptop', color: '#65a30d' },
  { id: 'business', name: 'Business', kind: 'income', icon: 'briefcase', color: '#0d9488' },
  { id: 'interest', name: 'Interest & Dividends', kind: 'income', icon: 'percent', color: '#0891b2' },
  { id: 'refunds', name: 'Refunds & Cashback', kind: 'income', icon: 'undo-2', color: '#84cc16' },
  { id: 'money-in', name: 'Money Received', kind: 'income', icon: 'hand-coins', color: '#4ade80' },
  { id: 'other-income', name: 'Other Income', kind: 'income', icon: 'plus-circle', color: '#86efac' },
];

export function buildSeedCategories(): Category[] {
  return SEED_CATEGORIES.map((c, index) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    icon: c.icon,
    color: c.color,
    ...(c.parentId ? { parentId: c.parentId } : {}),
    sortOrder: index,
  }));
}

/**
 * A starting account so the very first entry has somewhere to land. Asking a
 * new user to configure accounts before they can record a ₹50 chai is how you
 * lose them in the first thirty seconds.
 */
export const SEED_ACCOUNT = {
  id: 'cash',
  name: 'Cash',
  type: 'cash' as const,
  openingBalance: 0,
  sortOrder: 0,
};

/* -------------------------------------------------------------------------- */
/* Keyword map                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Substring → category id. Matched case-insensitively against the description
 * after UPI/POS noise is stripped.
 *
 * This is the cold-start categoriser only. It is the *lowest* priority source:
 * a user-defined rule beats it, and the merchant memory learned from the user's
 * own corrections beats it. It exists so the first week is not all manual, then
 * it quietly stops mattering.
 */
export const KEYWORD_MAP: Record<string, string> = {
  // Food delivery & Dining
  swiggy: 'delivery',
  zomato: 'delivery',
  zepto: 'groceries',
  blinkit: 'groceries',
  instamart: 'groceries',
  dunzo: 'delivery',
  eatsure: 'delivery',
  faasos: 'delivery',
  behrouz: 'delivery',
  dominos: 'dining',
  pizzahut: 'dining',
  mcdonald: 'dining',
  kfc: 'dining',
  burgerking: 'dining',
  subway: 'dining',
  starbucks: 'dining',
  chaayos: 'dining',
  chaipoint: 'dining',
  barista: 'dining',
  ccd: 'dining',
  haldiram: 'dining',
  bikanervala: 'dining',
  restaurant: 'dining',
  cafe: 'dining',
  dhaba: 'dining',
  bakery: 'dining',
  canteen: 'dining',
  chai: 'dining',
  tea: 'dining',
  coffee: 'dining',
  lunch: 'dining',
  dinner: 'dining',
  breakfast: 'dining',
  snack: 'dining',
  snacks: 'dining',
  food: 'dining',
  eat: 'dining',
  eating: 'dining',
  meal: 'dining',
  meals: 'dining',
  biryani: 'dining',
  pizza: 'dining',
  burger: 'dining',
  sweets: 'dining',
  mithai: 'dining',

  // Groceries
  bigbasket: 'groceries',
  dmart: 'groceries',
  'd-mart': 'groceries',
  reliancefresh: 'groceries',
  reliancesmart: 'groceries',
  spencer: 'groceries',
  naturebasket: 'groceries',
  grofers: 'groceries',
  jiomart: 'groceries',
  kirana: 'groceries',
  supermarket: 'groceries',
  grocery: 'groceries',
  groceries: 'groceries',
  vegetable: 'groceries',
  vegetables: 'groceries',
  fruits: 'groceries',
  fruit: 'groceries',
  sabzi: 'groceries',
  amul: 'groceries',
  'mother dairy': 'groceries',
  milk: 'groceries',
  bread: 'groceries',
  eggs: 'groceries',
  ration: 'groceries',

  // Transport
  ola: 'transport',
  uber: 'transport',
  rapido: 'transport',
  bluesmart: 'transport',
  meru: 'transport',
  irctc: 'transport',
  redbus: 'transport',
  abhibus: 'transport',
  metro: 'transport',
  dmrc: 'transport',
  bmtc: 'transport',
  msrtc: 'transport',
  rickshaw: 'transport',
  auto: 'transport',
  cab: 'transport',
  taxi: 'transport',
  toll: 'transport',
  fastag: 'transport',
  parking: 'transport',
  railway: 'transport',
  train: 'transport',
  flight: 'transport',
  airfare: 'transport',

  // Fuel
  hpcl: 'fuel',
  bpcl: 'fuel',
  iocl: 'fuel',
  indianoil: 'fuel',
  'hp petrol': 'fuel',
  bharatpetroleum: 'fuel',
  shell: 'fuel',
  nayara: 'fuel',
  petrol: 'fuel',
  diesel: 'fuel',
  cng: 'fuel',
  'fuel station': 'fuel',
  'filling station': 'fuel',

  // Shopping
  amazon: 'shopping',
  flipkart: 'shopping',
  myntra: 'shopping',
  ajio: 'shopping',
  meesho: 'shopping',
  nykaa: 'personal-care',
  tatacliq: 'shopping',
  snapdeal: 'shopping',
  decathlon: 'shopping',
  ikea: 'household',
  croma: 'shopping',
  reliancedigital: 'shopping',
  vijaysales: 'shopping',
  lifestyle: 'shopping',
  pantaloons: 'shopping',
  westside: 'shopping',
  zara: 'shopping',
  hnm: 'shopping',
  uniqlo: 'shopping',
  bata: 'shopping',
  puma: 'shopping',
  adidas: 'shopping',
  nike: 'shopping',
  clothes: 'shopping',
  shoes: 'shopping',

  // Entertainment & subscriptions
  netflix: 'subscriptions',
  'amazon prime': 'subscriptions',
  'prime video': 'subscriptions',
  hotstar: 'subscriptions',
  jiocinema: 'subscriptions',
  sonyliv: 'subscriptions',
  zee5: 'subscriptions',
  spotify: 'subscriptions',
  gaana: 'subscriptions',
  wynk: 'subscriptions',
  youtube: 'subscriptions',
  audible: 'subscriptions',
  kindle: 'subscriptions',
  icloud: 'subscriptions',
  'google one': 'subscriptions',
  dropbox: 'subscriptions',
  notion: 'subscriptions',
  canva: 'subscriptions',
  chatgpt: 'subscriptions',
  openai: 'subscriptions',
  bookmyshow: 'entertainment',
  pvr: 'entertainment',
  inox: 'entertainment',
  cinepolis: 'entertainment',
  cinema: 'entertainment',
  gaming: 'entertainment',
  steam: 'entertainment',
  playstation: 'entertainment',

  // Bills & utilities
  electricity: 'utilities',
  bescom: 'utilities',
  mseb: 'utilities',
  tneb: 'utilities',
  'adani electricity': 'utilities',
  tatapower: 'utilities',
  torrentpower: 'utilities',
  bses: 'utilities',
  'water bill': 'utilities',
  'gas bill': 'utilities',
  'gas cylinder': 'utilities',
  'piped gas': 'utilities',
  indane: 'utilities',
  hpgas: 'utilities',
  bharatgas: 'utilities',
  bill: 'utilities',
  dth: 'utilities',

  // Phone & internet
  jio: 'phone-internet',
  airtel: 'phone-internet',
  vodafone: 'phone-internet',
  bsnl: 'phone-internet',
  'act fibernet': 'phone-internet',
  hathway: 'phone-internet',
  excitel: 'phone-internet',
  tikona: 'phone-internet',
  broadband: 'phone-internet',
  wifi: 'phone-internet',
  recharge: 'phone-internet',

  // Health
  apollo: 'health',
  pharmeasy: 'health',
  netmeds: 'health',
  '1mg': 'health',
  medplus: 'health',
  practo: 'health',
  cultfit: 'health',
  fortis: 'health',
  manipal: 'health',
  'max healthcare': 'health',
  pharmacy: 'health',
  chemist: 'health',
  hospital: 'health',
  clinic: 'health',
  diagnostic: 'health',
  doctor: 'health',
  dental: 'health',
  gym: 'health',
  medicine: 'health',
  medicines: 'health',
  meds: 'health',
  consultation: 'health',

  // Fees & Charges
  'credit card fee': 'charges',
  'card fee': 'charges',
  'annual fee': 'charges',
  'joining fee': 'charges',
  'renewal fee': 'charges',
  'late fee': 'charges',
  'late payment fee': 'charges',
  'finance charge': 'charges',
  'finance charges': 'charges',
  'interest charge': 'charges',
  'bank charges': 'charges',
  'bank fee': 'charges',
  'atm fee': 'charges',
  'atm charge': 'charges',
  'processing fee': 'charges',
  'forex fee': 'charges',
  'overlimit fee': 'charges',
  'gst charge': 'charges',
  'maintenance fee': 'charges',
  penalty: 'charges',
  fee: 'charges',
  fees: 'charges',
  charges: 'charges',
  charge: 'charges',

  // Insurance & finance
  lic: 'insurance',
  policybazaar: 'insurance',
  'hdfc ergo': 'insurance',
  'icici lombard': 'insurance',
  starhealth: 'insurance',
  insurance: 'insurance',

  // Education
  udemy: 'education',
  coursera: 'education',
  unacademy: 'education',
  byjus: 'education',
  vedantu: 'education',
  upgrad: 'education',
  school: 'education',
  college: 'education',
  tuition: 'education',
  'course fee': 'education',

  // Personal care
  urbanclap: 'personal-care',
  urbancompany: 'personal-care',
  salon: 'personal-care',
  spa: 'personal-care',
  barber: 'personal-care',
  parlour: 'personal-care',

  // Travel
  makemytrip: 'travel',
  goibibo: 'travel',
  cleartrip: 'travel',
  yatra: 'travel',
  ixigo: 'travel',
  oyo: 'travel',
  airbnb: 'travel',
  'booking.com': 'travel',
  indigo: 'travel',
  vistara: 'travel',
  spicejet: 'travel',
  airindia: 'travel',
  akasa: 'travel',

  // Investments
  zerodha: 'investments',
  groww: 'investments',
  upstox: 'investments',
  kuvera: 'investments',
  smallcase: 'investments',
  'mutual fund': 'investments',
  nps: 'investments',
  ppf: 'investments',
  elss: 'investments',

  // Income
  salary: 'salary',
  payroll: 'salary',
  stipend: 'salary',
  cashback: 'refunds',
  refund: 'refunds',
  reversal: 'refunds',
  interest: 'interest',
  dividend: 'interest',

  // Household
  rent: 'rent',
  maintenance: 'household',
  society: 'household',
  plumber: 'household',
  electrician: 'household',
  carpenter: 'household',
  maid: 'household',
};

/**
 * Bank-statement noise. Stripped before keyword matching and before a merchant
 * key is derived, so "UPI/DR/402913/SWIGGY/HDFC/swiggyupi" and "SWIGGY LIMITED"
 * collapse to the same merchant.
 */
export const STATEMENT_NOISE = [
  'upi', 'imps', 'neft', 'rtgs', 'ach', 'ecs', 'nach', 'pos', 'atm', 'chq', 'cheque',
  'txn', 'trf', 'ref', 'dr', 'cr', 'debit', 'credit', 'payment', 'paytm', 'phonepe',
  'gpay', 'googlepay', 'bhim', 'razorpay', 'billdesk', 'ccavenue', 'payu',
  'limited', 'ltd', 'pvt', 'private', 'india', 'services', 'technologies',
];

/**
 * Descriptions that mean "money moved between my own accounts". Surfaced as a
 * transfer suggestion rather than silently applied, because guessing wrong here
 * hides a real expense.
 */
export const TRANSFER_HINTS = [
  'self', 'own account', 'transfer to', 'transfer from', 'acct transfer',
  'fund transfer', 'atm withdrawal', 'cash withdrawal', 'cash wdl',
];

/** Colours for charts, in the order categories are first encountered. */
export const CHART_PALETTE = [
  '#6366f1', '#22c55e', '#f43f5e', '#eab308', '#0ea5e9',
  '#a855f7', '#f97316', '#14b8a6', '#ec4899', '#84cc16',
  '#64748b', '#d946ef',
];
