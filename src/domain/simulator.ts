/**
 * 'What-If' Financial Sandbox Simulator.
 *
 * Simulates hypothetical life & financial decisions (big purchases, EMI plans,
 * salary changes, rent increases, goal acceleration) against the live financial
 * state machine in memory without writing anything to the database.
 */

import { addDays, currentMonth, today as todayISO, type ISODate } from './dates';
import {
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
import type { Paise } from './money';
import { formatMoney } from './money';
import type {
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
  | 'goal_boost';

export interface SimulationParams {
  type: SimulationType;
  title: string;
  amount: Paise;
  // For purchases:
  paymentMode?: 'upfront' | 'emi';
  emiMonths?: number; // e.g. 3, 6, 9, 12, 24
  emiInterestRateAnnualPct?: number; // e.g. 0, 12, 14, 16%
  accountId?: string;
  // For goal boost:
  goalId?: string;
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
  // Summary & Health
  verdict: 'safe' | 'tight' | 'danger';
  verdictTitle: string;
  verdictDetail: string;
  keyTakeaways: string[];
  // Generated recurring rule draft (if user wants to commit it)
  committableRecurring?: Omit<Recurring, 'id' | 'createdAt' | 'updatedAt'>;
  committableEntry?: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>;
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
  const baselineMonth = monthSummary(ledger, currentMonth());

  // Create a clean synthetic copy of the ledger
  const syntheticEntries: Entry[] = [...ledger.entries];
  const syntheticRecurring: Recurring[] = [...ledger.recurring];

  let committableRecurring: Omit<Recurring, 'id' | 'createdAt' | 'updatedAt'> | undefined;
  let committableEntry: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'> | undefined;

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
      const transferRule: Omit<Recurring, 'id' | 'createdAt' | 'updatedAt'> = {
        description: `Boost: ${targetGoal.name}`,
        amount: params.amount,
        direction: 'transfer',
        accountId: primaryAccountId,
        counterAccountId: targetGoal.accountId,
        frequency: 'monthly',
        startDate: today,
        nextDueDate: addDays(today, 30),
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
  }

  const syntheticLedger: Ledger = {
    ...ledger,
    entries: syntheticEntries,
    recurring: syntheticRecurring,
  };

  // Re-derive state machine with synthetic ledger
  const simulatedSTS = safeToSpend(syntheticLedger, today);
  const simulatedProjection = projectBalance(syntheticLedger, today, 60);
  const simulatedLowest = lowestPoint(simulatedProjection);
  const simulatedGoals = goalProgresses(syntheticLedger, today);

  const stsDelta = simulatedSTS.amount - baselineSTS.amount;
  const dailyAllowanceDelta = simulatedSTS.perDay - baselineSTS.perDay;

  // Find simulated deficit crossing date
  const deficitEntry = simulatedProjection.find((p) => p.balance < 0);
  const simulatedDeficitDate = deficitEntry ? deficitEntry.date : null;

  // Compute Goal Impacts
  const goalImpacts: GoalImpact[] = baselineGoals.map((bProgress) => {
    const simProgress =
      simulatedGoals.find((s) => s.goal.id === bProgress.goal.id) ?? bProgress;

    let deltaDays: number | null = null;
    if (bProgress.projectedDate && simProgress.projectedDate) {
      const bTime = new Date(bProgress.projectedDate).getTime();
      const sTime = new Date(simProgress.projectedDate).getTime();
      deltaDays = Math.round((sTime - bTime) / (1000 * 60 * 60 * 24));
    }

    return {
      goal: bProgress.goal,
      baselineProjectedDate: bProgress.projectedDate,
      simulatedProjectedDate: simProgress.projectedDate,
      deltaDays,
      baselineSaved: bProgress.saved,
      simulatedSaved: simProgress.saved,
      onTrack: simProgress.onTrack,
    };
  });

  // Evaluate Verdict
  let verdict: 'safe' | 'tight' | 'danger' = 'safe';
  let verdictTitle = 'Safe to Proceed';
  let verdictDetail = 'This decision fits comfortably within your monthly runway and reserves.';
  const keyTakeaways: string[] = [];

  if (simulatedSTS.amount < 0 || (simulatedDeficitDate !== null && simulatedDeficitDate <= addDays(today, 20))) {
    verdict = 'danger';
    verdictTitle = 'High Deficit Risk';
    verdictDetail = `This decision causes your spendable cash to go below zero around ${simulatedDeficitDate || 'this month'}.`;
  } else if (simulatedSTS.perDay < 30_000 || simulatedDeficitDate !== null) {
    verdict = 'tight';
    verdictTitle = 'Tights Runway Pace';
    verdictDetail = 'Your Safe to Spend drops significantly. Daily allowance becomes tight.';
  }

  // Generate Key Takeaways
  keyTakeaways.push(
    `Safe to Spend changes by ${stsDelta >= 0 ? '+' : ''}${formatMoney(stsDelta)} (now ${formatMoney(simulatedSTS.amount)}).`,
  );
  keyTakeaways.push(
    `Daily discretionary allowance adjusts to ${formatMoney(simulatedSTS.perDay)}/day (delta ${dailyAllowanceDelta >= 0 ? '+' : ''}${formatMoney(dailyAllowanceDelta)}/day).`,
  );

  if (simulatedDeficitDate) {
    keyTakeaways.push(`⚠️ Balance bottoms out at ${formatMoney(simulatedLowest?.balance ?? 0)} on ${simulatedLowest?.date}.`);
  } else {
    keyTakeaways.push(`✅ Projected 60-day liquid cash reserve stays solvent above ${formatMoney(simulatedLowest?.balance ?? 0)}.`);
  }

  for (const g of goalImpacts) {
    if (g.deltaDays !== null && Math.abs(g.deltaDays) >= 3) {
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
    verdict,
    verdictTitle,
    verdictDetail,
    keyTakeaways,
    committableRecurring,
    committableEntry,
  };
}
