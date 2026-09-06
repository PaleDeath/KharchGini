/**
 * 'What-If' Financial Sandbox Simulator.
 *
 * Simulates hypothetical life & financial decisions (big purchases, EMI plans,
 * salary changes, rent increases, goal acceleration) against the live financial
 * state machine in memory without writing anything to the database.
 */

import {
  addDays,
  addMonths,
  addMonthsToKey,
  currentMonth,
  daysBetween,
  monthOf,
  startOfMonth,
  today as todayISO,
  type ISODate,
  type MonthKey,
} from './dates';
import {
  accountBalance,
  accountBalances,
  byId,
  goalProgress,
  goalProgresses,
  liquidBalance,
  lowestPoint,
  monthSummary,
  netWorth,
  nextPayday,
  projectBalance,
  safeToSpend,
} from './derive';
import { monthlyEquivalent } from './recurring';

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
import type { Paise } from './money';
import { formatMoney } from './money';
import type {
  Account,
  DayBalance,
  Entry,
  Goal,
  GoalProgress,
  Ledger,
  Recurring,
  SafeToSpend,
} from './types';

export type SimulationType =
  | 'purchase'
  | 'income_change'
  | 'recurring_expense'
  | 'goal_boost'
  | 'target_accumulation';

export interface SimulationParams {
  type: SimulationType;
  title: string;
  amount: Paise; // Purchase amount, income delta, expense amount, or target accumulation amount
  // For purchases:
  paymentMode?: 'upfront' | 'emi';
  emiMonths?: number; // e.g. 3, 6, 9, 12, 24
  emiInterestRateAnnualPct?: number; // e.g. 0, 12, 14, 16%
  accountId?: string;
  // For goal boost & target accumulation:
  goalId?: string; // If targeting an existing goal
  targetDate?: ISODate; // e.g. '2027-11-30'
  accumulationMode?: 'by_date' | 'by_monthly'; // Target date driven vs custom monthly contribution driven
  monthlyContribution?: Paise; // Custom monthly savings amount if accumulationMode === 'by_monthly'
  targetAccountId?: string; // Backing account for the goal
  initialSavedPaise?: Paise; // Starting savings balance if new goal (default: 0)
  // Optional monthly income / salary override:
  customMonthlyIncome?: Paise; // If user wants to simulate with a specific monthly salary
}

export interface CashFlowBreakdown {
  monthlyIncome: Paise;
  incomeSource: 'recurring_salary' | 'historical_average' | 'user_specified' | 'sts_projection' | 'none';
  incomeDetails: string;
  monthlyCommittedBills: Paise;
  monthlyBudgetedNeeds: Paise;
  monthlyTotalOutflows: Paise;
  monthlyNetSurplus: Paise;
  isSalaryActive: boolean;
}

export interface AccumulationMonthSchedule {
  monthKey: MonthKey;
  monthLabel: string;
  expectedIncome: Paise;
  expectedOutflows: Paise;
  monthlySavings: Paise;
  cumulativeSaved: Paise;
  targetAmount: Paise;
  percentCompleted: number;
  netCashFlowRemaining: Paise;
  isTargetMet: boolean;
}

export interface GoalImpact {
  goal: Goal;
  baselineProjectedDate: ISODate | null;
  simulatedProjectedDate: ISODate | null;
  deltaDays: number | null; // negative = accelerated, positive = delayed
  baselineSaved: Paise;
  simulatedSaved: Paise;
  onTrack: boolean | null;
}

export interface TargetAccumulationPlan {
  targetAmount: Paise;
  targetDate: ISODate;
  currentSaved: Paise;
  remainingAmount: Paise;
  monthsRemaining: number;
  daysRemaining: number;
  requiredMonthlySavings: Paise;
  requiredWeeklySavings: Paise;
  requiredDailySavings: Paise;
  actualMonthlySavings: Paise;
  projectedReachDate: ISODate;
  monthsToReach: number;
  isOnTrack: boolean;
  feasibility: 'comfortable' | 'tight' | 'unrealistic';
  monthlyFreeCashFlow: Paise;
  percentOfSurplus: number;
  cashFlowBreakdown: CashFlowBreakdown;
  schedule: AccumulationMonthSchedule[];
  totalExpectedSalaryOverTimeline: Paise;
  totalExpectedSavingsOverTimeline: Paise;
  totalExpectedOutflowsOverTimeline: Paise;
}

export interface SimulationResult {
  params: SimulationParams;
  today: ISODate;
  // Hero safe to spend comparison
  baselineSTS: SafeToSpend;
  simulatedSTS: SafeToSpend;
  stsDelta: Paise;
  dailyAllowanceDelta: Paise;
  // Monthly cash flow impact
  monthlyNetDelta: Paise;
  monthlyOutDelta: Paise;
  cashFlowBreakdown: CashFlowBreakdown;
  // Runway & Deficit Risk
  baselineLowestPoint?: DayBalance;
  simulatedLowestPoint?: DayBalance;
  simulatedDeficitDate: ISODate | null;
  // Goals impact
  goalImpacts: GoalImpact[];
  // Target accumulation plan blueprint
  targetPlan?: TargetAccumulationPlan;
  // Summary & Health
  verdict: 'safe' | 'tight' | 'danger';
  verdictTitle: string;
  verdictDetail: string;
  keyTakeaways: string[];
  // Generated recurring rule draft (if user wants to commit it)
  committableRecurring?: Omit<Recurring, 'id' | 'createdAt' | 'updatedAt'>;
  committableEntry?: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>;
  committableGoal?: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>;
}

/**
 * Computes monthly EMI in paise given Principal (paise), annual interest %, and tenure in months.
 */
export function calculateMonthlyEMI(
  principal: Paise,
  tenureMonths: number,
  annualInterestPct = 0,
): { monthlyPaise: Paise; totalPayable: Paise; totalInterest: Paise } {
  if (tenureMonths <= 0) {
    return { monthlyPaise: principal, totalPayable: principal, totalInterest: 0 };
  }

  if (annualInterestPct <= 0) {
    const monthly = Math.ceil(principal / tenureMonths);
    return { monthlyPaise: monthly, totalPayable: monthly * tenureMonths, totalInterest: 0 };
  }

  const r = annualInterestPct / (12 * 100);
  const n = tenureMonths;
  const emiFloat = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const monthlyPaise = Math.round(emiFloat);
  const totalPayable = monthlyPaise * tenureMonths;
  const totalInterest = Math.max(0, totalPayable - principal);

  return { monthlyPaise, totalPayable, totalInterest };
}

/**
 * Returns default target date for a generic 1-year horizon (or optional custom months ahead).
 */
export function getDefaultTargetHorizon(from: ISODate = todayISO(), months = 12): ISODate {
  return addMonths(from, months);
}

/**
 * Returns default target date for "November Next Year" (e.g. '2027-11-30').
 * Kept for backwards compatibility.
 */
export function getNovemberNextYear(from: ISODate = todayISO()): ISODate {
  const currentYear = Number(from.slice(0, 4));
  const nextYear = currentYear + 1;
  return `${nextYear}-11-30`;
}

/**
 * Rigorously analyzes monthly cash flow: monthly recurring salary / income,
 * committed recurring bills, and budgeted living needs to determine true
 * monthly free cash flow (surplus).
 */
export function analyzeMonthlyCashFlow(
  ledger: Ledger,
  customMonthlyIncome?: Paise,
  today: ISODate = todayISO(),
): CashFlowBreakdown {
  const recurringIncomeRules = ledger.recurring.filter((r) => r.isActive && r.direction === 'in');
  const recurringInMonthly = sum(recurringIncomeRules.map((r) => monthlyEquivalent(r)));

  let monthlyIncome = 0;
  let incomeSource: CashFlowBreakdown['incomeSource'] = 'none';
  let incomeDetails = 'No recurring salary or recorded income found.';
  let isSalaryActive = false;

  if (customMonthlyIncome !== undefined && customMonthlyIncome >= 0) {
    monthlyIncome = customMonthlyIncome;
    incomeSource = 'user_specified';
    incomeDetails =
      customMonthlyIncome === 0
        ? 'Simulated ₹0/mo income (zero paycheck / career break)'
        : `Custom simulated salary: ${formatMoney(customMonthlyIncome)}/mo`;
    isSalaryActive = customMonthlyIncome > 0;
  } else if (recurringInMonthly > 0) {
    monthlyIncome = recurringInMonthly;
    incomeSource = 'recurring_salary';
    const names = recurringIncomeRules.map((r) => r.description).join(', ');
    incomeDetails = `Active recurring rule (${names}): ${formatMoney(recurringInMonthly)}/mo`;
    isSalaryActive = true;
  } else {
    // Check recent months' income from entries (past 2 completed months, then current month)
    const currentMonthKey = monthOf(today);
    const prevMonthKey1 = addMonthsToKey(currentMonthKey, -1);
    const prevMonthKey2 = addMonthsToKey(currentMonthKey, -2);
    const pastSummaries = [prevMonthKey2, prevMonthKey1]
      .map((m) => monthSummary(ledger, m))
      .filter((s) => s.income > 0);

    if (pastSummaries.length > 0) {
      const avgIncome = sum(pastSummaries.map((s) => s.income)) / pastSummaries.length;
      monthlyIncome = Math.round(avgIncome);
      incomeSource = 'historical_average';
      incomeDetails = `Historical average income: ${formatMoney(monthlyIncome)}/mo`;
      isSalaryActive = true;
    } else {
      const curSummary = monthSummary(ledger, currentMonthKey);
      if (curSummary.income > 0) {
        monthlyIncome = curSummary.income;
        incomeSource = 'historical_average';
        incomeDetails = `Current month salary deposit: ${formatMoney(monthlyIncome)}/mo`;
        isSalaryActive = true;
      } else {
        const sts = safeToSpend(ledger, today);
        if (sts.perDay > 0) {
          monthlyIncome = Math.round(sts.perDay * 30.4375);
          incomeSource = 'sts_projection';
          incomeDetails = `Estimated from daily discretionary runway (~${formatMoney(monthlyIncome)}/mo)`;
          isSalaryActive = false;
        } else {
          monthlyIncome = 0;
          incomeSource = 'none';
          incomeDetails = 'No regular salary or income recorded in ledger';
          isSalaryActive = false;
        }
      }
    }
  }

  // Active recurring bills (rent, utilities, subscriptions, EMIs)
  const recurringOutRules = ledger.recurring.filter((r) => r.isActive && r.direction === 'out');
  const monthlyCommittedBills = sum(recurringOutRules.map((r) => monthlyEquivalent(r)));

  // Map committed recurring bills by category to avoid double-counting with envelopes
  const billedByCategory = new Map<string, number>();
  for (const r of recurringOutRules) {
    if (r.categoryId) {
      billedByCategory.set(
        r.categoryId,
        (billedByCategory.get(r.categoryId) ?? 0) + monthlyEquivalent(r),
      );
    }
  }

  // Budgeted needs (envelopes for groceries, essentials, etc.)
  const currentMonthKey = monthOf(today);
  const categoriesMap = byId(ledger.categories);
  let currentEnvelopes = ledger.envelopes.filter((e) => e.month === currentMonthKey);
  if (currentEnvelopes.length === 0) {
    const prevMonthKey = addMonthsToKey(currentMonthKey, -1);
    currentEnvelopes = ledger.envelopes.filter((e) => e.month === prevMonthKey);
  }

  let monthlyBudgetedNeeds = 0;
  for (const env of currentEnvelopes) {
    const cat = categoriesMap.get(env.categoryId);
    if (cat && cat.kind === 'need') {
      const alreadyBilled = billedByCategory.get(env.categoryId) ?? 0;
      monthlyBudgetedNeeds += Math.max(0, env.allocated - alreadyBilled);
    }
  }

  const monthlyTotalOutflows = monthlyCommittedBills + monthlyBudgetedNeeds;
  const monthlyNetSurplus = monthlyIncome - monthlyTotalOutflows;

  return {
    monthlyIncome,
    incomeSource,
    incomeDetails,
    monthlyCommittedBills,
    monthlyBudgetedNeeds,
    monthlyTotalOutflows,
    monthlyNetSurplus,
    isSalaryActive,
  };
}

/**
 * Robustly estimates average monthly net free cash flow (surplus) from the ledger.
 */
export function estimateMonthlyFreeCashFlow(
  ledger: Ledger,
  today: ISODate = todayISO(),
  customMonthlyIncome?: Paise,
): Paise {
  return analyzeMonthlyCashFlow(ledger, customMonthlyIncome, today).monthlyNetSurplus;
}

/**
 * Calculates target accumulation plan metrics: required savings, projected reach,
 * cash flow feasibility, and month-by-month salary & savings schedule.
 */
export function calculateTargetAccumulation({
  targetAmount,
  currentSaved = 0,
  today = todayISO(),
  targetDate,
  accumulationMode = 'by_date',
  customMonthlySavings,
  monthlyFreeCashFlow = 0,
  cashFlow,
}: {
  targetAmount: Paise;
  currentSaved?: Paise;
  today?: ISODate;
  targetDate?: ISODate;
  accumulationMode?: 'by_date' | 'by_monthly';
  customMonthlySavings?: Paise;
  monthlyFreeCashFlow?: Paise;
  cashFlow?: CashFlowBreakdown;
}): TargetAccumulationPlan {
  const effectiveTargetDate = targetDate || getDefaultTargetHorizon(today, 12);
  const remainingAmount = Math.max(0, targetAmount - currentSaved);
  const rawDays = daysBetween(today, effectiveTargetDate);
  const daysRemaining = Math.max(0, rawDays);

  const effectiveCashFlow: CashFlowBreakdown = cashFlow ?? {
    monthlyIncome: monthlyFreeCashFlow || 0,
    incomeSource: 'sts_projection',
    incomeDetails: 'Estimated monthly cash surplus',
    monthlyCommittedBills: 0,
    monthlyBudgetedNeeds: 0,
    monthlyTotalOutflows: 0,
    monthlyNetSurplus: monthlyFreeCashFlow || 0,
    isSalaryActive: (monthlyFreeCashFlow || 0) > 0,
  };

  const freeCashFlow = effectiveCashFlow.monthlyNetSurplus;

  // Measure months accurately from calendar days (30.4375 average days per month)
  const monthsRemaining = daysRemaining > 0 ? Math.max(1, Math.round(daysRemaining / 30.4375)) : 1;

  if (remainingAmount === 0) {
    return {
      targetAmount,
      targetDate: effectiveTargetDate,
      currentSaved,
      remainingAmount: 0,
      monthsRemaining: daysRemaining > 0 ? monthsRemaining : 0,
      daysRemaining,
      requiredMonthlySavings: 0,
      requiredWeeklySavings: 0,
      requiredDailySavings: 0,
      actualMonthlySavings: 0,
      projectedReachDate: today,
      monthsToReach: 0,
      isOnTrack: true,
      feasibility: 'comfortable',
      monthlyFreeCashFlow: freeCashFlow,
      percentOfSurplus: 0,
      cashFlowBreakdown: effectiveCashFlow,
      schedule: [],
      totalExpectedSalaryOverTimeline: 0,
      totalExpectedSavingsOverTimeline: 0,
      totalExpectedOutflowsOverTimeline: 0,
    };
  }

  const requiredMonthlySavings = Math.min(
    remainingAmount,
    Math.ceil(remainingAmount / monthsRemaining),
  );
  const weeksRemaining = Math.max(1, daysRemaining / 7);
  const requiredWeeklySavings = Math.min(
    remainingAmount,
    Math.ceil(remainingAmount / weeksRemaining),
  );
  const requiredDailySavings = Math.min(
    remainingAmount,
    Math.ceil(remainingAmount / Math.max(1, daysRemaining)),
  );

  let actualMonthlySavings = requiredMonthlySavings;
  let monthsToReach = monthsRemaining;
  let projectedReachDate = effectiveTargetDate;
  let isOnTrack = rawDays >= 0;

  if (accumulationMode === 'by_monthly' && customMonthlySavings && customMonthlySavings > 0) {
    actualMonthlySavings = customMonthlySavings;
    monthsToReach = Math.ceil(remainingAmount / customMonthlySavings);
    projectedReachDate = addMonths(today, monthsToReach);
    isOnTrack = rawDays >= 0 && projectedReachDate <= effectiveTargetDate;
  }

  let feasibility: 'comfortable' | 'tight' | 'unrealistic' = 'comfortable';
  let percentOfSurplus = 0;
  if (actualMonthlySavings === 0) {
    feasibility = 'comfortable';
    percentOfSurplus = 0;
  } else if (freeCashFlow > 0) {
    percentOfSurplus = Math.round((actualMonthlySavings / freeCashFlow) * 100);
    if (actualMonthlySavings > freeCashFlow) {
      feasibility = 'unrealistic';
    } else if (percentOfSurplus > 70) {
      feasibility = 'tight';
    } else {
      feasibility = 'comfortable';
    }
  } else {
    feasibility = actualMonthlySavings > 0 ? 'unrealistic' : 'comfortable';
  }

  // Generate month-by-month accumulation schedule over the horizon
  const schedule: AccumulationMonthSchedule[] = [];
  const scheduleMonths = Math.min(60, Math.max(1, monthsToReach));
  let accumulated = currentSaved;

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  for (let m = 0; m < scheduleMonths; m++) {
    const monthDate = addMonths(today, m);
    const monthKey = monthOf(monthDate);
    const year = monthKey.slice(0, 4);
    const monthNum = Number(monthKey.slice(5, 7));
    const monthLabel = `${monthNames[monthNum - 1]} ${year}`;

    const savingsThisMonth = Math.min(
      actualMonthlySavings,
      Math.max(0, targetAmount - accumulated),
    );
    accumulated += savingsThisMonth;
    const isTargetMet = accumulated >= targetAmount;
    const percentCompleted = targetAmount > 0
      ? Math.min(100, Math.round((accumulated / targetAmount) * 100))
      : 100;

    const netRemaining =
      effectiveCashFlow.monthlyIncome - effectiveCashFlow.monthlyTotalOutflows - savingsThisMonth;

    schedule.push({
      monthKey,
      monthLabel,
      expectedIncome: effectiveCashFlow.monthlyIncome,
      expectedOutflows: effectiveCashFlow.monthlyTotalOutflows,
      monthlySavings: savingsThisMonth,
      cumulativeSaved: accumulated,
      targetAmount,
      percentCompleted,
      netCashFlowRemaining: netRemaining,
      isTargetMet,
    });
  }

  const totalExpectedSalaryOverTimeline = effectiveCashFlow.monthlyIncome * scheduleMonths;
  const totalExpectedSavingsOverTimeline = Math.min(remainingAmount, actualMonthlySavings * scheduleMonths);
  const totalExpectedOutflowsOverTimeline = effectiveCashFlow.monthlyTotalOutflows * scheduleMonths;

  return {
    targetAmount,
    targetDate: effectiveTargetDate,
    currentSaved,
    remainingAmount,
    monthsRemaining,
    daysRemaining,
    requiredMonthlySavings,
    requiredWeeklySavings,
    requiredDailySavings,
    actualMonthlySavings,
    projectedReachDate,
    monthsToReach,
    isOnTrack,
    feasibility,
    monthlyFreeCashFlow: freeCashFlow,
    percentOfSurplus,
    cashFlowBreakdown: effectiveCashFlow,
    schedule,
    totalExpectedSalaryOverTimeline,
    totalExpectedSavingsOverTimeline,
    totalExpectedOutflowsOverTimeline,
  };
}

/**
 * Runs a complete sandbox simulation against the ledger state machine.
 */
export function runSimulation(
  ledger: Ledger,
  params: SimulationParams,
  today: ISODate = todayISO(),
): SimulationResult {
  const cashFlowBreakdown = analyzeMonthlyCashFlow(ledger, params.customMonthlyIncome, today);
  const baselineSTS = safeToSpend(ledger, today);
  const baselineGoals = goalProgresses(ledger, today);
  const baselineProjection = projectBalance(ledger, today, 60);
  const baselineLowest = lowestPoint(baselineProjection);

  // Create clean synthetic copies
  const syntheticEntries: Entry[] = [...ledger.entries];
  const syntheticRecurring: Recurring[] = [...ledger.recurring];
  const syntheticAccounts: Account[] = [...ledger.accounts];
  const syntheticGoals: Goal[] = [...ledger.goals];

  let committableRecurring: Omit<Recurring, 'id' | 'createdAt' | 'updatedAt'> | undefined;
  let committableEntry: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'> | undefined;
  let committableGoal: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'> | undefined;
  let targetPlan: TargetAccumulationPlan | undefined;

  const defaultAccount =
    ledger.accounts.find((a) => !a.archived && !a.excludeFromSafeToSpend && a.type !== 'card') ??
    ledger.accounts[0];

  const primaryAccountId = params.accountId || defaultAccount?.id || 'acc_primary';
  const payday = nextPayday(ledger.prefs, ledger, today);

  // Synchronize monthly salary in synthetic recurring rules
  if (params.customMonthlyIncome !== undefined && params.customMonthlyIncome >= 0) {
    // User explicitly customized or tested an assumed salary
    const existingSalary = syntheticRecurring.find((r) => r.isActive && r.direction === 'in');
    const salaryDueDate = existingSalary?.nextDueDate || payday;
    const salaryAccId = existingSalary?.accountId || primaryAccountId;

    // Remove old recurring income rules so old salary doesn't linger
    for (let i = syntheticRecurring.length - 1; i >= 0; i--) {
      if (syntheticRecurring[i]!.isActive && syntheticRecurring[i]!.direction === 'in') {
        syntheticRecurring.splice(i, 1);
      }
    }

    if (params.customMonthlyIncome > 0) {
      syntheticRecurring.push({
        id: 'sim_assumed_salary',
        description: 'Assumed Monthly Salary',
        amount: params.customMonthlyIncome,
        direction: 'in',
        accountId: salaryAccId,
        frequency: 'monthly',
        startDate: today,
        nextDueDate: salaryDueDate,
        isActive: true,
        autoPost: false,
        variableAmount: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  } else if (!ledger.recurring.some((r) => r.isActive && r.direction === 'in')) {
    // No recurring salary rule in ledger, but historical average income was detected
    if (cashFlowBreakdown.incomeSource === 'historical_average' && cashFlowBreakdown.monthlyIncome > 0) {
      syntheticRecurring.push({
        id: 'sim_detected_salary',
        description: 'Detected Monthly Salary',
        amount: cashFlowBreakdown.monthlyIncome,
        direction: 'in',
        accountId: primaryAccountId,
        frequency: 'monthly',
        startDate: today,
        nextDueDate: payday,
        isActive: true,
        autoPost: false,
        variableAmount: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  let simulatedMonthlyNetDelta = 0;
  let simulatedMonthlyOutDelta = 0;

  if (params.type === 'purchase') {
    if (params.paymentMode === 'emi' && (params.emiMonths ?? 1) > 1) {
      const months = params.emiMonths ?? 12;
      const rate = params.emiInterestRateAnnualPct ?? 0;
      const emiCalc = calculateMonthlyEMI(params.amount, months, rate);

      simulatedMonthlyNetDelta = -emiCalc.monthlyPaise;
      simulatedMonthlyOutDelta = emiCalc.monthlyPaise;

      const emiRule: Omit<Recurring, 'id' | 'createdAt' | 'updatedAt'> = {
        description: `EMI: ${params.title || 'Purchase'} (${months} mos)`,
        amount: emiCalc.monthlyPaise,
        direction: 'out',
        accountId: primaryAccountId,
        frequency: 'monthly',
        startDate: today,
        nextDueDate: addDays(today, 30),
        isActive: true,
        autoPost: false,
        variableAmount: false,
      };
      committableRecurring = emiRule;
      syntheticRecurring.push({
        ...emiRule,
        id: 'sim_emi_rule',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Upfront one-time expense today
      const upfrontEntry: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'> = {
        date: today,
        amount: params.amount,
        direction: 'out',
        accountId: primaryAccountId,
        description: params.title || 'Simulated Purchase',
        tags: ['simulated', 'what-if'],
        source: 'manual',
      };
      committableEntry = upfrontEntry;
      syntheticEntries.push({
        ...upfrontEntry,
        id: 'sim_upfront_entry',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  } else if (params.type === 'income_change') {
    simulatedMonthlyNetDelta = params.amount;
    const incRule: Omit<Recurring, 'id' | 'createdAt' | 'updatedAt'> = {
      description: params.title || 'Income Change',
      amount: Math.abs(params.amount),
      direction: params.amount >= 0 ? 'in' : 'out',
      accountId: primaryAccountId,
      frequency: 'monthly',
      startDate: today,
      nextDueDate: addDays(today, 30),
      isActive: true,
      autoPost: false,
      variableAmount: false,
    };
    committableRecurring = incRule;
    syntheticRecurring.push({
      ...incRule,
      id: 'sim_inc_rule',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } else if (params.type === 'recurring_expense') {
    simulatedMonthlyNetDelta = -params.amount;
    simulatedMonthlyOutDelta = params.amount;
    const expRule: Omit<Recurring, 'id' | 'createdAt' | 'updatedAt'> = {
      description: params.title || 'New Recurring Expense',
      amount: params.amount,
      direction: 'out',
      accountId: primaryAccountId,
      frequency: 'monthly',
      startDate: today,
      nextDueDate: addDays(today, 30),
      isActive: true,
      autoPost: false,
      variableAmount: false,
    };
    committableRecurring = expRule;
    syntheticRecurring.push({
      ...expRule,
      id: 'sim_exp_rule',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } else if (params.type === 'goal_boost') {
    const targetGoal = ledger.goals.find((g) => g.id === params.goalId) ?? ledger.goals[0];
    if (targetGoal) {
      simulatedMonthlyNetDelta = -params.amount;
      simulatedMonthlyOutDelta = params.amount;
      const transferRule: Omit<Recurring, 'id' | 'createdAt' | 'updatedAt'> = {
        description: `Boost: ${targetGoal.name}`,
        amount: params.amount,
        direction: 'transfer',
        accountId: primaryAccountId,
        counterAccountId: targetGoal.accountId,
        frequency: 'monthly',
        startDate: today,
        nextDueDate: today,
        isActive: true,
        autoPost: false,
        variableAmount: false,
      };
      committableRecurring = transferRule;
      syntheticRecurring.push({
        ...transferRule,
        id: 'sim_goal_rule',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  } else if (params.type === 'target_accumulation') {
    const targetDate = params.targetDate || getDefaultTargetHorizon(today, 12);
    const existingGoal = params.goalId
      ? ledger.goals.find((g) => g.id === params.goalId)
      : undefined;

    const currentSaved = existingGoal
      ? Math.max(0, accountBalance(existingGoal.accountId, ledger.accounts, ledger.entries))
      : (params.initialSavedPaise ?? 0);

    const plan = calculateTargetAccumulation({
      targetAmount: params.amount,
      currentSaved,
      today,
      targetDate,
      accumulationMode: params.accumulationMode,
      customMonthlySavings: params.monthlyContribution,
      cashFlow: cashFlowBreakdown,
    });
    targetPlan = plan;

    const monthlySavings = plan.actualMonthlySavings;
    simulatedMonthlyNetDelta = -monthlySavings;
    simulatedMonthlyOutDelta = monthlySavings;

    // Determine destination savings account
    const dedicatedSavingsAccount = ledger.accounts.find(
      (a) => !a.archived && a.type === 'savings' && a.id !== primaryAccountId,
    );

    const destAccountId =
      existingGoal?.accountId ||
      (params.targetAccountId && params.targetAccountId !== primaryAccountId
        ? params.targetAccountId
        : undefined) ||
      dedicatedSavingsAccount?.id ||
      'acc_savings_reserve';

    // Ensure destination account exists in synthetic accounts
    if (!syntheticAccounts.some((a) => a.id === destAccountId)) {
      syntheticAccounts.push({
        id: destAccountId,
        name: `${params.title || 'Goal'} Reserve`,
        type: 'savings',
        openingBalance: 0,
        sortOrder: 999,
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    if (existingGoal) {
      const gIdx = syntheticGoals.findIndex((g) => g.id === existingGoal.id);
      if (gIdx >= 0) {
        syntheticGoals[gIdx] = {
          ...syntheticGoals[gIdx],
          targetAmount: params.amount,
          targetDate,
        };
      }
    } else {
      const newGoalDraft: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'> = {
        name: params.title || 'Goal Accumulation',
        targetAmount: params.amount,
        targetDate,
        accountId: destAccountId,
        icon: 'target',
      };
      committableGoal = newGoalDraft;
      syntheticGoals.push({
        ...newGoalDraft,
        id: 'sim_new_goal',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Add recurring monthly SIP transfer rule
    const sipRule: Omit<Recurring, 'id' | 'createdAt' | 'updatedAt'> = {
      description: `SIP: ${params.title || 'Goal Savings'}`,
      amount: monthlySavings,
      direction: 'transfer',
      accountId: primaryAccountId,
      counterAccountId: destAccountId,
      frequency: 'monthly',
      startDate: today,
      nextDueDate: payday,
      isActive: true,
      autoPost: false,
      variableAmount: false,
    };
    committableRecurring = sipRule;
    syntheticRecurring.push({
      ...sipRule,
      id: 'sim_goal_accum_rule',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const syntheticLedger: Ledger = {
    ...ledger,
    accounts: syntheticAccounts,
    goals: syntheticGoals,
    entries: syntheticEntries,
    recurring: syntheticRecurring,
  };

  // Re-derive state machine with synthetic ledger
  const simulatedSTS = safeToSpend(syntheticLedger, today);
  const simulatedProjection = projectBalance(syntheticLedger, today, 60);
  const simulatedLowest = lowestPoint(simulatedProjection);

  const stsDelta = simulatedSTS.amount - baselineSTS.amount;
  const dailyAllowanceDelta = simulatedSTS.perDay - baselineSTS.perDay;

  // Find simulated deficit crossing date
  const deficitEntry = simulatedProjection.find((p) => p.balance < 0);
  const simulatedDeficitDate = deficitEntry ? deficitEntry.date : null;

  // Compute Goal Impacts with simulated recurring funding taken into account
  const goalImpacts: GoalImpact[] = syntheticGoals.map((goal) => {
    const isNewGoal = !ledger.goals.some((g) => g.id === goal.id);
    const bProgress = baselineGoals.find((b) => b.goal.id === goal.id);

    const saved = isNewGoal
      ? (params.initialSavedPaise ?? 0)
      : Math.max(0, accountBalance(goal.accountId, ledger.accounts, ledger.entries));
    const remaining = Math.max(0, goal.targetAmount - saved);

    // Baseline funding rate per week from historical entries
    let baselinePerWeek = 0;
    if (bProgress && bProgress.remaining > 0 && bProgress.projectedDate) {
      const bDays = daysBetween(today, bProgress.projectedDate);
      if (bDays > 0) {
        baselinePerWeek = bProgress.remaining / (bDays / 7);
      }
    }

    // Active recurring funding to this goal in synthetic ledger
    const recurringTransfers = syntheticRecurring.filter(
      (r) => r.isActive && r.direction === 'transfer' && r.counterAccountId === goal.accountId,
    );
    const simulatedMonthlyFunding = sum(
      recurringTransfers.map((r) => {
        if (r.frequency === 'yearly') return Math.round(r.amount / 12);
        if (r.frequency === 'weekly') return Math.round((r.amount * 52) / 12);
        return r.amount;
      }),
    );
    const simulatedWeeklyFunding = (simulatedMonthlyFunding * 7) / 30.4375;
    const totalWeeklyFunding = baselinePerWeek + simulatedWeeklyFunding;

    let simulatedProjectedDate: ISODate | null = null;
    let onTrack: boolean | null = null;

    if ((isNewGoal || goal.id === params.goalId) && targetPlan) {
      simulatedProjectedDate = targetPlan.projectedReachDate;
      onTrack = targetPlan.isOnTrack;
    } else if (remaining === 0) {
      simulatedProjectedDate = today;
      onTrack = true;
    } else if (totalWeeklyFunding > 0) {
      const daysToComplete = Math.ceil((remaining / totalWeeklyFunding) * 7);
      simulatedProjectedDate = addDays(today, daysToComplete);
      onTrack = goal.targetDate ? simulatedProjectedDate <= goal.targetDate : true;
    } else {
      onTrack = goal.targetDate ? false : null;
    }

    let deltaDays: number | null = null;
    if (bProgress?.projectedDate && simulatedProjectedDate) {
      deltaDays =
        daysBetween(today, simulatedProjectedDate) - daysBetween(today, bProgress.projectedDate);
    } else if (!bProgress?.projectedDate && simulatedProjectedDate && !isNewGoal) {
      deltaDays = -daysBetween(today, simulatedProjectedDate);
    }

    return {
      goal,
      baselineProjectedDate: bProgress?.projectedDate ?? null,
      simulatedProjectedDate,
      deltaDays,
      baselineSaved: bProgress?.saved ?? 0,
      simulatedSaved: saved,
      onTrack,
    };
  });

  // Evaluate Verdict
  let verdict: 'safe' | 'tight' | 'danger' = 'safe';
  let verdictTitle = 'Safe to Proceed';
  let verdictDetail = 'This decision fits comfortably within your monthly runway and reserves.';
  const keyTakeaways: string[] = [];

  if (
    simulatedSTS.amount < 0 ||
    (simulatedDeficitDate !== null && simulatedDeficitDate <= addDays(today, 20))
  ) {
    verdict = 'danger';
    verdictTitle = 'High Deficit Risk';
    verdictDetail = `This decision causes your spendable cash to go below zero around ${
      simulatedDeficitDate || 'this month'
    }.`;
  } else if (params.type === 'target_accumulation' && targetPlan) {
    if (targetPlan.remainingAmount === 0) {
      verdict = 'safe';
      verdictTitle = 'Goal Already Fully Funded!';
      verdictDetail = `You already have ${formatMoney(
        targetPlan.currentSaved,
      )} saved, meeting your ${formatMoney(params.amount)} target. No additional monthly savings required.`;
    } else if (targetPlan.feasibility === 'unrealistic') {
      verdict = 'danger';
      verdictTitle = 'Exceeds Monthly Free Cash Flow';
      verdictDetail = `Saving ${formatMoney(
        targetPlan.actualMonthlySavings,
      )}/mo exceeds your average monthly cash surplus (~${formatMoney(
        targetPlan.monthlyFreeCashFlow,
      )}/mo). You risk running short each month.`;
    } else if (!targetPlan.isOnTrack) {
      const delayMonths = Math.max(1, targetPlan.monthsToReach - targetPlan.monthsRemaining);
      verdict = 'tight';
      verdictTitle = 'Behind Target Deadline';
      verdictDetail = `At ${formatMoney(
        targetPlan.actualMonthlySavings,
      )}/mo, you will accumulate ${formatMoney(params.amount)} by ${
        targetPlan.projectedReachDate
      } (${delayMonths} ${delayMonths === 1 ? 'month' : 'months'} after your target deadline).`;
    } else if (targetPlan.feasibility === 'tight' || simulatedSTS.perDay < 30_000) {
      verdict = 'tight';
      verdictTitle = 'Feasible with Tightened Runway';
      verdictDetail = `Achievable! Saving ${formatMoney(
        targetPlan.actualMonthlySavings,
      )}/mo consumes ${
        targetPlan.percentOfSurplus
      }% of your cash surplus. Daily allowance adjusts to ${formatMoney(
        simulatedSTS.perDay,
      )}/day.`;
    } else {
      verdict = 'safe';
      verdictTitle = 'Goal is On Track & Achievable';
      verdictDetail = `Saving ${formatMoney(
        targetPlan.actualMonthlySavings,
      )}/mo from your monthly paycheck easily hits your ${formatMoney(params.amount)} target by ${
        targetPlan.targetDate
      } while leaving a comfortable cash buffer.`;
    }
  } else if (simulatedSTS.perDay < 30_000 || simulatedDeficitDate !== null) {
    verdict = 'tight';
    verdictTitle = 'Tight Runway Pace';
    verdictDetail = 'Your Safe to Spend drops significantly. Daily allowance becomes tight.';
  }

  // Generate Key Takeaways
  if (cashFlowBreakdown.monthlyIncome > 0) {
    keyTakeaways.push(
      `💼 Monthly Paycheck Accounted For: ~${formatMoney(cashFlowBreakdown.monthlyIncome)}/mo incoming (${cashFlowBreakdown.incomeDetails}). Over the full accumulation timeline, ~${formatMoney(targetPlan?.totalExpectedSalaryOverTimeline ?? cashFlowBreakdown.monthlyIncome * 12)} in total salary is projected to arrive.`,
    );
  } else {
    keyTakeaways.push(
      '⚠️ No regular monthly salary or recurring income detected. Calculations rely solely on existing cash reserves.',
    );
  }

  if (params.type === 'target_accumulation' && targetPlan) {
    if (targetPlan.remainingAmount === 0) {
      keyTakeaways.push(
        `🎯 Target of ${formatMoney(targetPlan.targetAmount)} is already fully met by current savings (${formatMoney(targetPlan.currentSaved)}).`,
      );
    } else {
      keyTakeaways.push(
        `🎯 Accumulate ${formatMoney(targetPlan.targetAmount)}: save ${formatMoney(
          targetPlan.actualMonthlySavings,
        )}/month (${formatMoney(targetPlan.requiredWeeklySavings)}/week) to hit deadline ${
          targetPlan.targetDate
        }.`,
      );
      if (targetPlan.isOnTrack) {
        keyTakeaways.push(
          `✅ On track! Projected to reach ${formatMoney(targetPlan.targetAmount)} by ${
            targetPlan.projectedReachDate
          } (${targetPlan.monthsRemaining} months).`,
        );
      } else {
        keyTakeaways.push(
          `⏳ Saving ${formatMoney(targetPlan.actualMonthlySavings)}/mo reaches ${formatMoney(
            targetPlan.targetAmount,
          )} by ${targetPlan.projectedReachDate} (${
            targetPlan.monthsToReach
          } months). Increase to ${formatMoney(
            targetPlan.requiredMonthlySavings,
          )}/mo to hit the deadline.`,
        );
      }
      if (targetPlan.monthlyFreeCashFlow > 0) {
        const remainingBuffer =
          targetPlan.monthlyFreeCashFlow - targetPlan.actualMonthlySavings;
        if (remainingBuffer >= 0) {
          keyTakeaways.push(
            `📊 Uses ${targetPlan.percentOfSurplus}% of your ~${formatMoney(
              targetPlan.monthlyFreeCashFlow,
            )}/mo monthly cash surplus, leaving ~${formatMoney(remainingBuffer)}/mo uncommitted discretionary buffer.`,
          );
        } else {
          keyTakeaways.push(
            `⚠️ Monthly savings pace exceeds your surplus by ~${formatMoney(
              Math.abs(remainingBuffer),
            )}/mo. Consider extending the horizon or adjusting your savings amount.`,
          );
        }
      } else {
        keyTakeaways.push(
          `⚠️ Monthly net cash flow is in deficit by ~${formatMoney(
            Math.abs(targetPlan.monthlyFreeCashFlow),
          )}/mo. Any savings commitment will deplete existing cash reserves.`,
        );
      }
    }
  }

  if (stsDelta === 0) {
    keyTakeaways.push(`Safe to Spend remains unchanged at ${formatMoney(simulatedSTS.amount)}.`);
  } else {
    keyTakeaways.push(
      `Safe to Spend changes by ${stsDelta > 0 ? '+' : ''}${formatMoney(stsDelta)} (now ${formatMoney(
        simulatedSTS.amount,
      )}).`,
    );
  }
  keyTakeaways.push(
    `Daily discretionary allowance adjusts to ${formatMoney(simulatedSTS.perDay)}/day (delta ${
      dailyAllowanceDelta >= 0 ? '+' : ''
    }${formatMoney(dailyAllowanceDelta)}/day).`,
  );

  if (simulatedDeficitDate) {
    keyTakeaways.push(
      `⚠️ Balance bottoms out at ${formatMoney(simulatedLowest?.balance ?? 0)} on ${
        simulatedLowest?.date
      }.`,
    );
  } else {
    keyTakeaways.push(
      `✅ Projected 60-day liquid cash reserve stays solvent above ${formatMoney(
        simulatedLowest?.balance ?? 0,
      )}.`,
    );
  }

  for (const g of goalImpacts) {
    if (g.goal.id !== 'sim_new_goal' && g.deltaDays !== null && Math.abs(g.deltaDays) >= 3) {
      if (g.deltaDays < 0) {
        keyTakeaways.push(`🎯 Goal "${g.goal.name}" accelerates by ${Math.abs(g.deltaDays)} days!`);
      } else {
        keyTakeaways.push(`⏳ Goal "${g.goal.name}" delayed by ${g.deltaDays} days.`);
      }
    }
  }

  return {
    params,
    today,
    baselineSTS,
    simulatedSTS,
    stsDelta,
    dailyAllowanceDelta,
    monthlyNetDelta: simulatedMonthlyNetDelta,
    monthlyOutDelta: simulatedMonthlyOutDelta,
    cashFlowBreakdown,
    baselineLowestPoint: baselineLowest,
    simulatedLowestPoint: simulatedLowest,
    simulatedDeficitDate,
    goalImpacts,
    targetPlan,
    verdict,
    verdictTitle,
    verdictDetail,
    keyTakeaways,
    committableRecurring,
    committableEntry,
    committableGoal,
  };
}
