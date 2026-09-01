/**
 * Sankey Cash Flow Domain Logic.
 *
 * Transforms ledger entries and envelope budgets into a balanced 3-tier Sankey graph:
 * [ Income Sources / Reserves ] -> [ Total Monthly Inflow ] -> [ Needs / Wants / Savings / Debt ]
 *
 * Pure TypeScript. Recomputed in-memory with zero stored state.
 */

import { monthOf, type ISODate, type MonthKey } from './dates';
import type { Paise } from './money';
import { byId, entriesInMonth, totalIn, totalOut } from './derive';
import type { Category, CategoryKind, Entry, Ledger } from './types';

export interface SankeyNode {
  id: string;
  name: string;
  value: Paise;
  color: string;
  column: 0 | 1 | 2; // 0 = Inflow Sources, 1 = Central Hub, 2 = Destinations
  categoryKind?: CategoryKind | 'savings' | 'debt' | 'reserves' | 'hub';
  subtext?: string;
  pctOfTotal: number;
}

export interface SankeyLink {
  id: string;
  sourceId: string;
  targetId: string;
  value: Paise;
  color: string;
  sourceName: string;
  targetName: string;
  pctOfTotal: number;
}

export interface SankeyData {
  month: MonthKey;
  nodes: SankeyNode[];
  links: SankeyLink[];
  totalInflow: Paise;
  totalOutflow: Paise;
  netSaved: Paise;
  savingsRatePct: number;
  isEmpty: boolean;
}

const DEFAULT_INCOME_COLOR = '#10b981'; // Emerald
const DEFAULT_RESERVES_COLOR = '#0ea5e9'; // Sky blue
const DEFAULT_HUB_COLOR = '#0d9488'; // Teal
const DEFAULT_NEED_COLOR = '#3b82f6'; // Blue
const DEFAULT_WANT_COLOR = '#f59e0b'; // Amber
const DEFAULT_SAVE_COLOR = '#10b981'; // Green
const DEFAULT_DEBT_COLOR = '#f97316'; // Orange
const DEFAULT_UNSORTED_COLOR = '#94a3b8'; // Slate

/**
 * Computes a balanced Sankey cash-flow graph from actual transactions in a given month.
 */
export function computeActualSankey(ledger: Ledger, month: MonthKey): SankeyData {
  const monthEntries = entriesInMonth(ledger.entries, month);
  const categories = byId(ledger.categories);
  const accounts = byId(ledger.accounts);

  const incomeEntries = monthEntries.filter((e) => e.direction === 'in');
  const expenseEntries = monthEntries.filter((e) => e.direction === 'out');
  const transferEntries = monthEntries.filter((e) => e.direction === 'transfer');

  const totalIncome = totalIn(incomeEntries);
  const totalExpense = totalOut(expenseEntries);

  // Group Income by Category or Payee/Source
  const incomeBySource = new Map<string, { name: string; amount: Paise; color: string }>();
  for (const entry of incomeEntries) {
    const cat = entry.categoryId ? categories.get(entry.categoryId) : undefined;
    const key = cat?.id ?? 'general_income';
    const name = cat?.name ?? entry.description ?? 'Income';
    const color = cat?.color ?? DEFAULT_INCOME_COLOR;
    const current = incomeBySource.get(key) ?? { name, amount: 0, color };
    incomeBySource.set(key, { ...current, amount: current.amount + entry.amount });
  }

  // Group Spending by Category
  const expenseByCategory = new Map<
    string,
    { name: string; amount: Paise; kind: CategoryKind | 'unsorted'; color: string }
  >();
  for (const entry of expenseEntries) {
    const cat = entry.categoryId ? categories.get(entry.categoryId) : undefined;
    const key = cat?.id ?? 'unsorted';
    const name = cat?.name ?? 'Uncategorised';
    const kind = cat?.kind ?? 'unsorted';
    const color = cat?.color ?? (kind === 'need' ? DEFAULT_NEED_COLOR : kind === 'want' ? DEFAULT_WANT_COLOR : DEFAULT_UNSORTED_COLOR);

    const current = expenseByCategory.get(key) ?? { name, amount: 0, kind, color };
    expenseByCategory.set(key, { ...current, amount: current.amount + entry.amount });
  }

  // Transfers into Savings accounts or Goal backing accounts
  const goalAccountIds = new Set(ledger.goals.filter((g) => !g.archived).map((g) => g.accountId));
  let savingsTransfers = 0;
  let debtPayments = 0;

  for (const entry of transferEntries) {
    if (!entry.counterAccountId) continue;
    const destAcc = accounts.get(entry.counterAccountId);
    if (!destAcc) continue;

    if (destAcc.type === 'savings' || goalAccountIds.has(destAcc.id)) {
      savingsTransfers += entry.amount;
    } else if (destAcc.type === 'card') {
      debtPayments += entry.amount;
    }
  }

  const rawNetSaved = totalIncome - totalExpense;
  const netSaved = Math.max(0, rawNetSaved);
  const totalFlow = Math.max(totalIncome, totalExpense + savingsTransfers + debtPayments);

  if (totalFlow === 0) {
    return {
      month,
      nodes: [],
      links: [],
      totalInflow: 0,
      totalOutflow: 0,
      netSaved: 0,
      savingsRatePct: 0,
      isEmpty: true,
    };
  }

  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];

  // Hub Node ID
  const HUB_ID = 'hub_cash_pool';

  // 1. Column 0: Inflow Sources
  let incomeAssigned = 0;
  for (const [key, item] of incomeBySource) {
    const nodeId = `in_${key}`;
    incomeAssigned += item.amount;
    nodes.push({
      id: nodeId,
      name: item.name,
      value: item.amount,
      color: item.color,
      column: 0,
      categoryKind: 'income',
      pctOfTotal: (item.amount / totalFlow) * 100,
    });

    links.push({
      id: `link_${nodeId}_${HUB_ID}`,
      sourceId: nodeId,
      targetId: HUB_ID,
      value: item.amount,
      color: item.color,
      sourceName: item.name,
      targetName: 'Cash Inflow',
      pctOfTotal: (item.amount / totalFlow) * 100,
    });
  }

  // If income was zero or expenses exceed income, add liquid reserve draw
  const deficitFromReserves = Math.max(0, (totalExpense + savingsTransfers + debtPayments) - totalIncome);
  if (deficitFromReserves > 0 || incomeBySource.size === 0) {
    const reserveAmount = deficitFromReserves > 0 ? deficitFromReserves : (totalFlow === 0 ? 0 : totalFlow);
    if (reserveAmount > 0) {
      const reserveId = 'in_reserves';
      nodes.push({
        id: reserveId,
        name: 'Liquid Account Draw',
        value: reserveAmount,
        color: DEFAULT_RESERVES_COLOR,
        column: 0,
        categoryKind: 'reserves',
        subtext: 'From bank balance',
        pctOfTotal: (reserveAmount / totalFlow) * 100,
      });

      links.push({
        id: `link_${reserveId}_${HUB_ID}`,
        sourceId: reserveId,
        targetId: HUB_ID,
        value: reserveAmount,
        color: DEFAULT_RESERVES_COLOR,
        sourceName: 'Liquid Reserves',
        targetName: 'Cash Inflow',
        pctOfTotal: (reserveAmount / totalFlow) * 100,
      });
    }
  }

  // 2. Column 1: Central Hub
  nodes.push({
    id: HUB_ID,
    name: 'Spendable Inflow Pool',
    value: totalFlow,
    color: DEFAULT_HUB_COLOR,
    column: 1,
    categoryKind: 'hub',
    pctOfTotal: 100,
  });

  // 3. Column 2: Outflow Destinations
  // Needs vs Wants vs Unsorted
  for (const [key, item] of expenseByCategory) {
    if (item.amount <= 0) continue;
    const nodeId = `out_${key}`;
    nodes.push({
      id: nodeId,
      name: item.name,
      value: item.amount,
      color: item.color,
      column: 2,
      categoryKind: item.kind === 'unsorted' ? undefined : item.kind,
      pctOfTotal: (item.amount / totalFlow) * 100,
    });

    links.push({
      id: `link_${HUB_ID}_${nodeId}`,
      sourceId: HUB_ID,
      targetId: nodeId,
      value: item.amount,
      color: item.color,
      sourceName: 'Cash Inflow',
      targetName: item.name,
      pctOfTotal: (item.amount / totalFlow) * 100,
    });
  }

  // Savings / Goal funding
  const totalSavingsOut = savingsTransfers + (rawNetSaved > 0 && savingsTransfers === 0 ? rawNetSaved : 0);
  if (totalSavingsOut > 0) {
    const savingsId = 'out_savings';
    nodes.push({
      id: savingsId,
      name: 'Retained / Savings',
      value: totalSavingsOut,
      color: DEFAULT_SAVE_COLOR,
      column: 2,
      categoryKind: 'savings',
      pctOfTotal: (totalSavingsOut / totalFlow) * 100,
    });

    links.push({
      id: `link_${HUB_ID}_${savingsId}`,
      sourceId: HUB_ID,
      targetId: savingsId,
      value: totalSavingsOut,
      color: DEFAULT_SAVE_COLOR,
      sourceName: 'Cash Inflow',
      targetName: 'Retained / Savings',
      pctOfTotal: (totalSavingsOut / totalFlow) * 100,
    });
  }

  // Debt Payments
  if (debtPayments > 0) {
    const debtId = 'out_debt';
    nodes.push({
      id: debtId,
      name: 'Credit Card Settlements',
      value: debtPayments,
      color: DEFAULT_DEBT_COLOR,
      column: 2,
      categoryKind: 'debt',
      pctOfTotal: (debtPayments / totalFlow) * 100,
    });

    links.push({
      id: `link_${HUB_ID}_${debtId}`,
      sourceId: HUB_ID,
      targetId: debtId,
      value: debtPayments,
      color: DEFAULT_DEBT_COLOR,
      sourceName: 'Cash Inflow',
      targetName: 'Credit Card Settlements',
      pctOfTotal: (debtPayments / totalFlow) * 100,
    });
  }

  const savingsRatePct = totalIncome > 0 ? (totalSavingsOut / totalIncome) * 100 : 0;

  return {
    month,
    nodes,
    links,
    totalInflow: totalFlow,
    totalOutflow: totalExpense,
    netSaved: totalSavingsOut,
    savingsRatePct,
    isEmpty: nodes.length <= 1,
  };
}
