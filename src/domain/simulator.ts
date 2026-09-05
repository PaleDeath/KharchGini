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
} from './dates';
import {
  accountBalance,
  accountBalances,
  goalProgress,
  goalProgresses,
  liquidBalance,
  lowestPoint,
  monthSummary,
  netWorth,
  projectBalance,
  safeToSpend,
} from './derive';

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
 * Returns default target date for "November Next Year" (e.g. '2027-11-30').
 */
export function getNovemberNextYear(from: ISODate = todayISO()): ISODate {
  const currentYear = Number(from.slice(0, 4));
  const nextYear = currentYear + 1;
  return `${nextYear}-11-30`;
}

/**
 * Robustly estimates average monthly net free cash flow (surplus) from the ledger.
 */
export function estimateMonthlyFreeCashFlow(ledger: Ledger, today: ISODate = todayISO()): Paise {
  const currentMonthKey = monthOf(today);
  const prevMonthKey1 = addMonthsToKey(currentMonthKey, -1);
  const prevMonthKey2 = addMonthsToKey(currentMonthKey, -2);
  const pastSummaries = [prevMonthKey2, prevMonthKey1]
    .map((m) => monthSummary(ledger, m))
    .filter((s) => s.income > 0);

  if (pastSummaries.length > 0) {
    const avgSurplus = sum(pastSummaries.map((s) => s.saved)) / pastSummaries.length;
    return Math.max(0, Math.round(avgSurplus));
  }

  // Fallback to active recurring income minus active recurring out
  const recurringIn = sum(
    ledger.recurring
      .filter((r) => r.isActive && r.direction === 'in')
      .map((r) => {
        if (r.frequency === 'yearly') return Math.round(r.amount / 12);
        if (r.frequency === 'weekly') return Math.round((r.amount * 52) / 12);
        return r.amount;
      }),
  );
  const recurringOut = sum(
    ledger.recurring
      .filter((r) => r.isActive && r.direction === 'out')
      .map((r) => {
        if (r.frequency === 'yearly') return Math.round(r.amount / 12);
        if (r.frequency === 'weekly') return Math.round((r.amount * 52) / 12);
        return r.amount;
      }),
  );

  if (recurringIn > 0) {
    return Math.max(0, recurringIn - recurringOut);
  }

  const sts = safeToSpend(ledger, today);
  if (sts.perDay > 0) {
    return Math.round(sts.perDay * 30.4375);
  }
  return Math.max(0, sts.amount);
}

/**
 * Calculates target accumulation plan metrics: required savings, projected reach, and feasibility.
 */
export function calculateTargetAccumulation({
  targetAmount,
  currentSaved = 0,
  today = todayISO(),
  targetDate,
  accumulationMode = 'by_date',
  customMonthlySavings,
  monthlyFreeCashFlow = 0,
}: {
  targetAmount: Paise;
  currentSaved?: Paise;
  today?: ISODate;
  targetDate?: ISODate;
  accumulationMode?: 'by_date' | 'by_monthly';
  customMonthlySavings?: Paise;
  monthlyFreeCashFlow?: Paise;
}): TargetAccumulationPlan {
  const effectiveTargetDate = targetDate || getNovemberNextYear(today);
  const remainingAmount = Math.max(0, targetAmount - currentSaved);
  const rawDays = daysBetween(today, effectiveTargetDate);
  const daysRemaining = Math.max(0, rawDays);

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
      monthlyFreeCashFlow,
      percentOfSurplus: 0,
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
  } else if (monthlyFreeCashFlow > 0) {
    percentOfSurplus = Math.round((actualMonthlySavings / monthlyFreeCashFlow) * 100);
    if (actualMonthlySavings > monthlyFreeCashFlow) {
      feasibility = 'unrealistic';
    } else if (percentOfSurplus > 70) {
      feasibility = 'tight';
    } else {
      feasibility = 'comfortable';
    }
  } else {
    feasibility = actualMonthlySavings > 50_000_00 ? 'unrealistic' : 'tight';
  }

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
    monthlyFreeCashFlow,
    percentOfSurplus,
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
    const freeCashFlow = estimateMonthlyFreeCashFlow(ledger, today);
    const targetDate = params.targetDate || getNovemberNextYear(today);
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
      monthlyFreeCashFlow: freeCashFlow,
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
      nextDueDate: today,
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
      )}/mo easily hits your ${formatMoney(params.amount)} target by ${
        targetPlan.targetDate
      } without compromising runway.`;
    }
  } else if (simulatedSTS.perDay < 30_000 || simulatedDeficitDate !== null) {
    verdict = 'tight';
    verdictTitle = 'Tight Runway Pace';
    verdictDetail = 'Your Safe to Spend drops significantly. Daily allowance becomes tight.';
  }

  // Generate Key Takeaways
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
        keyTakeaways.push(
          `📊 Uses ${targetPlan.percentOfSurplus}% of your ~${formatMoney(
            targetPlan.monthlyFreeCashFlow,
          )}/mo monthly cash surplus.`,
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
