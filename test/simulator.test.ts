import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeMonthlyCashFlow,
  calculateMonthlyEMI,
  calculateTargetAccumulation,
  estimateMonthlyFreeCashFlow,
  getDefaultTargetHorizon,
  getNovemberNextYear,
  runSimulation,
  type SimulationParams,
} from '../src/domain/simulator';
import type { Account, Goal, Ledger, Recurring, Entry } from '../src/domain/types';
import { EMPTY_LEDGER } from '../src/domain/types';
import { addMonths, today as todayISO } from '../src/domain/dates';

function makeAccount(partial: Partial<Account> & { id: string; name: string }): Account {
  return {
    type: 'bank',
    openingBalance: 0,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function createSampleLedger(): Ledger {
  const bankAcc = makeAccount({
    id: 'acc_bank',
    name: 'Primary Checking',
    type: 'bank',
    openingBalance: 150_000_00, // ₹1,50,000
  });

  const savingsAcc = makeAccount({
    id: 'acc_savings',
    name: 'Goal Savings',
    type: 'savings',
    openingBalance: 20_000_00, // ₹20,000
  });

  const salaryRecurring: Recurring = {
    id: 'rec_salary',
    description: 'Monthly Salary',
    amount: 100_000_00, // ₹1,00,000
    direction: 'in',
    accountId: 'acc_bank',
    frequency: 'monthly',
    startDate: '2026-01-01',
    nextDueDate: '2026-09-30',
    isActive: true,
    autoPost: false,
    variableAmount: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const rentRecurring: Recurring = {
    id: 'rec_rent',
    description: 'House Rent',
    amount: 30_000_00, // ₹30,000
    direction: 'out',
    accountId: 'acc_bank',
    frequency: 'monthly',
    startDate: '2026-01-05',
    nextDueDate: '2026-09-05',
    isActive: true,
    autoPost: false,
    variableAmount: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const emergencyGoal: Goal = {
    id: 'goal_emergency',
    name: 'Emergency Fund',
    targetAmount: 300_000_00, // ₹3,00,000
    targetDate: '2027-06-30',
    accountId: 'acc_savings',
    icon: 'shield',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  return {
    ...EMPTY_LEDGER,
    accounts: [bankAcc, savingsAcc],
    recurring: [salaryRecurring, rentRecurring],
    goals: [emergencyGoal],
  };
}

test('getNovemberNextYear computes correct November 30th date for next calendar year', () => {
  assert.equal(getNovemberNextYear('2026-09-05'), '2027-11-30');
  assert.equal(getNovemberNextYear('2025-01-15'), '2026-11-30');
  assert.equal(getNovemberNextYear('2026-12-31'), '2027-11-30');
});

test('calculateTargetAccumulation computes accurate monthly, weekly, daily savings for 3 Lakh by Nov next year', () => {
  const today = '2026-09-05';
  const targetDate = '2027-11-30';
  const targetAmount = 300_000_00; // ₹3,00,000 in paise

  const plan = calculateTargetAccumulation({
    targetAmount,
    currentSaved: 0,
    today,
    targetDate,
    accumulationMode: 'by_date',
    monthlyFreeCashFlow: 70_000_00, // ₹70,000 monthly surplus
  });

  assert.equal(plan.targetAmount, 300_000_00);
  assert.equal(plan.targetDate, '2027-11-30');
  assert.equal(plan.remainingAmount, 300_000_00);
  assert.equal(plan.daysRemaining, 451);
  assert.equal(plan.monthsRemaining, 15); // 15 months (451 days / 30.4375) between Sept 2026 and Nov 2027
  assert.equal(plan.requiredMonthlySavings, 20_000_00); // 3,00,000 / 15 = ₹20,000.00/mo exactly!
  assert.equal(plan.requiredWeeklySavings, 4_656_32); // ₹4,656.32/week
  assert.equal(plan.requiredDailySavings, 665_19); // ₹665.19/day
  assert.equal(plan.isOnTrack, true);
  assert.equal(plan.projectedReachDate, '2027-11-30');
  assert.equal(plan.feasibility, 'comfortable');
  assert.ok(plan.percentOfSurplus > 0 && plan.percentOfSurplus < 50);
});

test('calculateTargetAccumulation handles existing savings subtraction correctly', () => {
  const plan = calculateTargetAccumulation({
    targetAmount: 300_000_00, // ₹3,00,000
    currentSaved: 60_000_00, // ₹60,000 already saved
    today: '2026-09-05',
    targetDate: '2027-11-30',
    accumulationMode: 'by_date',
  });

  assert.equal(plan.remainingAmount, 240_000_00); // ₹2,40,000 remaining
  assert.equal(plan.requiredMonthlySavings, 16_000_00); // 2,40,000 / 15 = ₹16,000.00/mo
});

test('calculateTargetAccumulation with by_monthly mode projects reach date and flags delayed targets', () => {
  const today = '2026-09-05';
  const targetDate = '2027-11-30'; // 15 months away
  const targetAmount = 300_000_00; // ₹3,00,000

  // User can only save ₹10,000/month (needs 30 months -> will miss Nov 2027 deadline)
  const delayedPlan = calculateTargetAccumulation({
    targetAmount,
    currentSaved: 0,
    today,
    targetDate,
    accumulationMode: 'by_monthly',
    customMonthlySavings: 10_000_00, // ₹10,000/mo
    monthlyFreeCashFlow: 30_000_00,
  });

  assert.equal(delayedPlan.actualMonthlySavings, 10_000_00);
  assert.equal(delayedPlan.monthsToReach, 30);
  assert.equal(delayedPlan.isOnTrack, false);
  assert.ok(delayedPlan.projectedReachDate > targetDate);

  // User saves ₹30,000/month (needs 10 months -> reaches before Nov 2027 deadline!)
  const earlyPlan = calculateTargetAccumulation({
    targetAmount,
    currentSaved: 0,
    today,
    targetDate,
    accumulationMode: 'by_monthly',
    customMonthlySavings: 30_000_00, // ₹30,000/mo
    monthlyFreeCashFlow: 50_000_00,
  });

  assert.equal(earlyPlan.actualMonthlySavings, 30_000_00);
  assert.equal(earlyPlan.monthsToReach, 10);
  assert.equal(earlyPlan.isOnTrack, true);
  assert.ok(earlyPlan.projectedReachDate <= targetDate);
});

test('runSimulation executes target_accumulation for 3 Lakh by Nov next year for a trip', () => {
  const ledger = createSampleLedger();
  const today = '2026-09-05';
  const targetDate = '2027-11-30';

  const params: SimulationParams = {
    type: 'target_accumulation',
    title: 'Trip by November Next Year',
    amount: 300_000_00, // ₹3,00,000
    targetDate,
    accumulationMode: 'by_date',
  };

  const result = runSimulation(ledger, params, today);

  // Verify target accumulation plan is generated
  assert.ok(result.targetPlan);
  assert.equal(result.targetPlan.targetAmount, 300_000_00);
  assert.equal(result.targetPlan.targetDate, targetDate);
  assert.equal(result.targetPlan.isOnTrack, true);
  assert.ok(result.targetPlan.actualMonthlySavings > 0);

  // Safe to Spend should decrease by the monthly savings amount
  assert.equal(result.stsDelta, -result.targetPlan.actualMonthlySavings);
  assert.ok(result.dailyAllowanceDelta < 0);

  // Committable goal and committable recurring transfer should be created
  assert.ok(result.committableGoal);
  assert.equal(result.committableGoal.name, 'Trip by November Next Year');
  assert.equal(result.committableGoal.targetAmount, 300_000_00);
  assert.equal(result.committableGoal.targetDate, targetDate);

  assert.ok(result.committableRecurring);
  assert.equal(result.committableRecurring.direction, 'transfer');
  assert.equal(result.committableRecurring.amount, result.targetPlan.actualMonthlySavings);

  // Goal impacts should include the new simulated trip goal
  const tripImpact = result.goalImpacts.find((g) => g.goal.name === 'Trip by November Next Year');
  assert.ok(tripImpact);
  assert.equal(tripImpact.onTrack, true);
  assert.ok(tripImpact.simulatedProjectedDate);

  // Verdict should be safe or tight depending on cash flow, not danger
  assert.notEqual(result.verdict, 'danger');
  assert.ok(result.keyTakeaways.length >= 3);
});

test('runSimulation goal_boost accelerates existing goal projected date', () => {
  const ledger = createSampleLedger();
  const today = '2026-09-05';

  const params: SimulationParams = {
    type: 'goal_boost',
    title: 'Boost Emergency Fund',
    amount: 25_000_00, // +₹25,000/mo boost
    goalId: 'goal_emergency',
  };

  const result = runSimulation(ledger, params, today);

  const emergencyImpact = result.goalImpacts.find((g) => g.goal.id === 'goal_emergency');
  assert.ok(emergencyImpact);
  assert.ok(emergencyImpact.simulatedProjectedDate);
  // Recurring boost should provide a concrete completion date and accelerate it
  assert.ok(emergencyImpact.onTrack !== null);
  assert.ok(result.committableRecurring);
  assert.equal(result.committableRecurring.direction, 'transfer');
  assert.equal(result.committableRecurring.amount, 25_000_00);
});

test('estimateMonthlyFreeCashFlow calculates recurring net cash flow accurately', () => {
  const ledger = createSampleLedger();
  const surplus = estimateMonthlyFreeCashFlow(ledger, '2026-09-05');
  // Salary ₹1,00,000 - Rent ₹30,000 = ₹70,000 surplus
  assert.equal(surplus, 70_000_00);
});

test('edge case: target amount is 0 or negative', () => {
  const plan = calculateTargetAccumulation({
    targetAmount: 0,
    currentSaved: 0,
    today: '2026-09-05',
    targetDate: '2027-11-30',
  });

  assert.equal(plan.requiredMonthlySavings, 0);
  assert.equal(plan.requiredWeeklySavings, 0);
  assert.equal(plan.requiredDailySavings, 0);
  assert.equal(plan.isOnTrack, true);
});

test('edge case: target date is in the past', () => {
  const plan = calculateTargetAccumulation({
    targetAmount: 100_000_00,
    currentSaved: 0,
    today: '2026-09-05',
    targetDate: '2025-01-01', // Past date
  });

  assert.equal(plan.isOnTrack, false);
  assert.ok(plan.requiredMonthlySavings > 0);
});

test('calculateMonthlyEMI edge cases: 0 tenure and 0 interest', () => {
  // 0 tenure
  const zeroTenure = calculateMonthlyEMI(100_000_00, 0, 12);
  assert.equal(zeroTenure.monthlyPaise, 100_000_00);
  assert.equal(zeroTenure.totalInterest, 0);

  // 0% interest (No-Cost EMI)
  const noCost = calculateMonthlyEMI(60_000_00, 6, 0);
  assert.equal(noCost.monthlyPaise, 10_000_00);
  assert.equal(noCost.totalPayable, 60_000_00);
  assert.equal(noCost.totalInterest, 0);

  // Standard interest (12% for 12 months on ₹1,20,000)
  const withInterest = calculateMonthlyEMI(120_000_00, 12, 12);
  assert.ok(withInterest.monthlyPaise > 10_000_00);
  assert.ok(withInterest.totalInterest > 0);
});

test('target accumulation linked to existing goal updates target and computes net remaining', () => {
  const ledger = createSampleLedger();
  const today = '2026-09-05';
  const targetDate = '2027-11-30';

  const params: SimulationParams = {
    type: 'target_accumulation',
    title: 'Expanded Emergency Fund',
    amount: 500_000_00, // ₹5,00,000 (was ₹3,00,000)
    goalId: 'goal_emergency',
    targetDate,
  };

  const result = runSimulation(ledger, params, today);
  assert.ok(result.targetPlan);
  // Goal already has ₹20,000 opening balance in savings account
  assert.equal(result.targetPlan.currentSaved, 20_000_00);
  assert.equal(result.targetPlan.remainingAmount, 480_000_00); // ₹4,80,000 remaining
  assert.equal(result.targetPlan.monthsRemaining, 15);
  assert.equal(result.targetPlan.requiredMonthlySavings, 32_000_00); // 4,80,000 / 15 = ₹32,000/mo
  assert.equal(result.committableGoal, undefined); // Should not draft a new goal when existing goal is targeted
  assert.ok(result.committableRecurring);
});

test('deficit risk verdict triggered when savings pace exceeds runway', () => {
  const bankAcc = makeAccount({
    id: 'acc_bank',
    name: 'Primary Checking',
    type: 'bank',
    openingBalance: 5_000_00, // Only ₹5,000 liquid cash
  });
  const ledger: Ledger = {
    ...EMPTY_LEDGER,
    accounts: [bankAcc],
    recurring: [],
  };

  const params: SimulationParams = {
    type: 'target_accumulation',
    title: 'Ambitious Trip Fund',
    amount: 300_000_00, // ₹3,00,000 by next month
    targetDate: '2026-10-31',
  };

  const result = runSimulation(ledger, params, '2026-09-05');
  assert.equal(result.verdict, 'danger');
  assert.ok(result.verdictTitle.includes('Deficit') || result.verdictTitle.includes('Exceeds'));
});

test('target accumulation runs gracefully on completely empty ledger', () => {
  const params: SimulationParams = {
    type: 'target_accumulation',
    title: 'Trip by November Next Year',
    amount: 300_000_00,
    targetDate: '2027-11-30',
  };

  const result = runSimulation(EMPTY_LEDGER, params, '2026-09-05');
  assert.ok(result.targetPlan);
  assert.equal(result.targetPlan.targetAmount, 300_000_00);
  assert.ok(result.committableGoal);
  assert.ok(result.committableRecurring);
});

test('boundary target date: 1 day away', () => {
  const plan = calculateTargetAccumulation({
    targetAmount: 30_000_00, // ₹30,000
    currentSaved: 0,
    today: '2026-09-05',
    targetDate: '2026-09-06', // Tomorrow
  });

  assert.equal(plan.daysRemaining, 1);
  assert.equal(plan.monthsRemaining, 1);
  assert.equal(plan.requiredMonthlySavings, 30_000_00);
  assert.equal(plan.requiredWeeklySavings, 30_000_00); // Clamped, not multiplied by 7!
  assert.equal(plan.requiredDailySavings, 30_000_00);
  assert.equal(plan.isOnTrack, true);
});

test('weekly savings clamping: daysRemaining < 7 never exceeds remainingAmount', () => {
  const plan = calculateTargetAccumulation({
    targetAmount: 10_000_00, // ₹10,000
    currentSaved: 0,
    today: '2026-09-05',
    targetDate: '2026-09-07', // 2 days away
  });

  assert.equal(plan.daysRemaining, 2);
  // Without clamping, 10,000 / (2/7) would be 35,000! With clamping, it is 10,000.
  assert.equal(plan.requiredWeeklySavings, 10_000_00);
  assert.equal(plan.requiredMonthlySavings, 10_000_00);
  assert.equal(plan.requiredDailySavings, 5_000_00);
});

test('target accumulation when goal is already fully funded', () => {
  const plan = calculateTargetAccumulation({
    targetAmount: 300_000_00,
    currentSaved: 300_000_00, // Already saved ₹3 Lakh
    today: '2026-09-05',
    targetDate: '2027-11-30',
  });

  assert.equal(plan.remainingAmount, 0);
  assert.equal(plan.requiredMonthlySavings, 0);
  assert.equal(plan.requiredWeeklySavings, 0);
  assert.equal(plan.requiredDailySavings, 0);
  assert.equal(plan.actualMonthlySavings, 0);
  assert.equal(plan.projectedReachDate, '2026-09-05'); // Reached today!
  assert.equal(plan.monthsToReach, 0);
  assert.equal(plan.isOnTrack, true);
  assert.equal(plan.feasibility, 'comfortable');
});

test('estimateMonthlyFreeCashFlow clamps negative historical months to 0', () => {
  const bankAcc = makeAccount({ id: 'acc_bank', name: 'Bank', openingBalance: 100_000_00 });
  const entryIn: Entry = {
    id: 'e_in',
    date: '2026-07-10',
    amount: 20_000_00,
    direction: 'in',
    accountId: 'acc_bank',
    description: 'Income',
    tags: [],
    source: 'manual',
    createdAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
  };
  const entryOut: Entry = {
    id: 'e_out',
    date: '2026-07-15',
    amount: 50_000_00, // Out exceeds in! Deficit of ₹30,000 in July
    direction: 'out',
    accountId: 'acc_bank',
    description: 'Expense',
    tags: [],
    source: 'manual',
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  };
  const ledger: Ledger = {
    ...EMPTY_LEDGER,
    accounts: [bankAcc],
    entries: [entryIn, entryOut],
  };

  const cashFlow = estimateMonthlyFreeCashFlow(ledger, '2026-09-05');
  assert.ok(cashFlow >= 0); // Must never be negative!
});

test('dedicated savings reserve account created when ledger has only checking account', () => {
  const bankAcc = makeAccount({ id: 'acc_checking', name: 'Checking', type: 'bank', openingBalance: 100_000_00 });
  const ledger: Ledger = {
    ...EMPTY_LEDGER,
    accounts: [bankAcc],
  };

  const params: SimulationParams = {
    type: 'target_accumulation',
    title: 'Trip by November Next Year',
    amount: 300_000_00,
    targetDate: '2027-11-30',
  };

  const result = runSimulation(ledger, params, '2026-09-05');
  assert.ok(result.committableGoal);
  assert.ok(result.committableRecurring);
  // Source account should be checking, destination account should be dedicated savings reserve
  assert.equal(result.committableRecurring.accountId, 'acc_checking');
  assert.equal(result.committableRecurring.counterAccountId, 'acc_savings_reserve');
  assert.notEqual(result.committableRecurring.accountId, result.committableRecurring.counterAccountId);
});

test('getDefaultTargetHorizon calculates generic future dates accurately', () => {
  const today = '2026-09-06';
  assert.equal(getDefaultTargetHorizon(today, 12), '2027-09-06');
  assert.equal(getDefaultTargetHorizon(today, 6), '2027-03-06');
  assert.equal(getDefaultTargetHorizon(today, 3), '2026-12-06');
  assert.equal(getDefaultTargetHorizon(today, 24), '2028-09-06');
});

test('analyzeMonthlyCashFlow detects active recurring salary and calculates monthly surplus', () => {
  const ledger = createSampleLedger();
  const cf = analyzeMonthlyCashFlow(ledger, undefined, '2026-09-05');

  assert.equal(cf.isSalaryActive, true);
  assert.equal(cf.incomeSource, 'recurring_salary');
  assert.equal(cf.monthlyIncome, 100_000_00); // ₹1,00,000 salary
  assert.equal(cf.monthlyCommittedBills, 30_000_00); // ₹30,000 rent
  assert.equal(cf.monthlyTotalOutflows, 30_000_00);
  assert.equal(cf.monthlyNetSurplus, 70_000_00); // ₹70,000 surplus
  assert.ok(cf.incomeDetails.includes('Monthly Salary'));
});

test('analyzeMonthlyCashFlow respects customMonthlyIncome override', () => {
  const ledger = createSampleLedger();
  // Override salary to ₹1,50,000
  const cf = analyzeMonthlyCashFlow(ledger, 150_000_00, '2026-09-05');

  assert.equal(cf.incomeSource, 'user_specified');
  assert.equal(cf.monthlyIncome, 150_000_00);
  assert.equal(cf.monthlyNetSurplus, 120_000_00); // 1,50,000 - 30,000 = ₹1,20,000
});

test('calculateTargetAccumulation builds detailed month-by-month accumulation schedule', () => {
  const today = '2026-09-05';
  const targetDate = '2027-11-30'; // ~15 months
  const targetAmount = 300_000_00; // ₹3,00,000

  const ledger = createSampleLedger();
  const cf = analyzeMonthlyCashFlow(ledger, undefined, today);

  const plan = calculateTargetAccumulation({
    targetAmount,
    currentSaved: 0,
    today,
    targetDate,
    accumulationMode: 'by_date',
    cashFlow: cf,
  });

  assert.ok(plan.schedule.length > 0);
  assert.equal(plan.schedule.length, 15);

  // Check first month
  const month1 = plan.schedule[0]!;
  assert.equal(month1.monthKey, '2026-09');
  assert.equal(month1.expectedIncome, 100_000_00);
  assert.equal(month1.expectedOutflows, 30_000_00);
  assert.equal(month1.monthlySavings, 20_000_00);
  assert.equal(month1.cumulativeSaved, 20_000_00);
  assert.equal(month1.netCashFlowRemaining, 50_000_00); // 100k - 30k - 20k = 50k buffer
  assert.equal(month1.isTargetMet, false);

  // Check last month (month 15)
  const lastMonth = plan.schedule[14]!;
  assert.equal(lastMonth.monthKey, '2027-11');
  assert.equal(lastMonth.cumulativeSaved, 300_000_00);
  assert.equal(lastMonth.percentCompleted, 100);
  assert.equal(lastMonth.isTargetMet, true);

  // Total salary incoming over the full accumulation horizon
  assert.equal(plan.totalExpectedSalaryOverTimeline, 15 * 100_000_00); // ₹15,00,000 total salary!
  assert.equal(plan.totalExpectedSavingsOverTimeline, 300_000_00); // ₹3,00,000 saved
  assert.equal(plan.totalExpectedOutflowsOverTimeline, 15 * 30_000_00); // ₹4,50,000 living/bills
});

test('runSimulation with custom salary override accounts for salary in takeaways and runway', () => {
  const bankAcc = makeAccount({ id: 'acc_bank', name: 'Bank', openingBalance: 20_000_00 });
  const ledger: Ledger = {
    ...EMPTY_LEDGER,
    accounts: [bankAcc],
    recurring: [], // No recurring salary in ledger
  };

  const params: SimulationParams = {
    type: 'target_accumulation',
    title: 'New Emergency Fund',
    amount: 120_000_00, // ₹1,20,000
    targetDate: '2027-09-05', // 12 months
    customMonthlyIncome: 80_000_00, // User inputs ₹80,000/mo salary in simulator
  };

  const result = runSimulation(ledger, params, '2026-09-05');

  assert.equal(result.cashFlowBreakdown.incomeSource, 'user_specified');
  assert.equal(result.cashFlowBreakdown.monthlyIncome, 80_000_00);
  assert.ok(result.targetPlan);
  assert.equal(result.targetPlan.actualMonthlySavings, 10_000_00); // 1,20,000 / 12 = ₹10,000/mo
  assert.equal(result.targetPlan.feasibility, 'comfortable');

  // Verify key takeaways explicitly confirm monthly paycheck is accounted for
  const salaryTakeaway = result.keyTakeaways.find((t) => t.includes('Monthly Paycheck Accounted For'));
  assert.ok(salaryTakeaway);
  assert.ok(salaryTakeaway.includes('80,000'));
});

test('analyzeMonthlyCashFlow supports explicit 0 custom income to simulate career break / job loss', () => {
  const ledger = createSampleLedger(); // has ₹1,00,000 salary rule
  const cf = analyzeMonthlyCashFlow(ledger, 0, '2026-09-05');

  assert.equal(cf.incomeSource, 'user_specified');
  assert.equal(cf.monthlyIncome, 0);
  assert.equal(cf.isSalaryActive, false);
  // Rent is ₹30,000, so net surplus is -₹30,000 (honest deficit, not clamped to 0)
  assert.equal(cf.monthlyCommittedBills, 30_000_00);
  assert.equal(cf.monthlyNetSurplus, -30_000_00);
});

test('analyzeMonthlyCashFlow deduplicates recurring bills already assigned to need categories', () => {
  const ledger = createSampleLedger();
  // Add category 'cat_rent' of kind 'need'
  ledger.categories = [
    { id: 'cat_rent', name: 'Rent', kind: 'need', icon: 'home', color: '#6366f1', sortOrder: 1, archived: false },
    { id: 'cat_groceries', name: 'Groceries', kind: 'need', icon: 'shopping-cart', color: '#22c55e', sortOrder: 2, archived: false },
  ];
  // Assign rent recurring bill to 'cat_rent'
  ledger.recurring = ledger.recurring.map((r) =>
    r.id === 'rec_rent' ? { ...r, categoryId: 'cat_rent' } : r,
  );
  // Add envelopes for current month: Rent ₹30,000 (already covered by bill) + Groceries ₹15,000 (pure need)
  ledger.envelopes = [
    { id: 'env_rent', month: '2026-09', categoryId: 'cat_rent', allocated: 30_000_00, rollover: false, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
    { id: 'env_groceries', month: '2026-09', categoryId: 'cat_groceries', allocated: 15_000_00, rollover: false, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
  ];

  const cf = analyzeMonthlyCashFlow(ledger, undefined, '2026-09-05');

  assert.equal(cf.monthlyIncome, 100_000_00);
  assert.equal(cf.monthlyCommittedBills, 30_000_00); // House Rent
  // Groceries is ₹15,000; Rent envelope is NOT double-counted because it's already billed under committed bills
  assert.equal(cf.monthlyBudgetedNeeds, 15_000_00);
  assert.equal(cf.monthlyTotalOutflows, 45_000_00); // 30k rent + 15k groceries = 45k (NOT 75k!)
  assert.equal(cf.monthlyNetSurplus, 55_000_00); // 100k - 45k = 55k surplus
});

test('calculateTargetAccumulation honestly reports negative cash flow and unrealistic feasibility', () => {
  const ledger = createSampleLedger();
  // Expenses = 30k rent. Override income to ₹20,000 -> deficit of -₹10,000/mo
  const cf = analyzeMonthlyCashFlow(ledger, 20_000_00, '2026-09-05');
  assert.equal(cf.monthlyNetSurplus, -10_000_00);

  const plan = calculateTargetAccumulation({
    targetAmount: 120_000_00, // ₹1,20,000
    currentSaved: 0,
    today: '2026-09-05',
    targetDate: '2027-09-05', // 12 months -> requires ₹10,000/mo
    cashFlow: cf,
  });

  // Because user has negative surplus (-₹10,000/mo), saving ₹10,000/mo is unrealistic
  assert.equal(plan.feasibility, 'unrealistic');
  assert.equal(plan.percentOfSurplus, 0);

  // Month-by-month schedule shows negative buffer (-₹20,000: 20k income - 30k bills - 10k sip)
  assert.equal(plan.schedule[0]!.netCashFlowRemaining, -20_000_00);
});

test('runSimulation with custom salary override replaces existing recurring salary in projection', () => {
  const ledger = createSampleLedger(); // has ₹1,00,000 recurring salary
  const params: SimulationParams = {
    type: 'target_accumulation',
    title: 'Custom Salary Simulation',
    amount: 240_000_00, // ₹2,40,000
    targetDate: '2027-09-05', // 12 months -> ₹20,000/mo
    customMonthlyIncome: 180_000_00, // User overrides salary to ₹1,80,000
  };

  const result = runSimulation(ledger, params, '2026-09-05');

  assert.equal(result.cashFlowBreakdown.incomeSource, 'user_specified');
  assert.equal(result.cashFlowBreakdown.monthlyIncome, 180_000_00);
  assert.ok(result.targetPlan);
  assert.equal(result.targetPlan.actualMonthlySavings, 20_000_00);
  assert.equal(result.targetPlan.feasibility, 'comfortable');

  // Key takeaways explicitly reflect new salary of ₹1,80,000
  const salaryTakeaway = result.keyTakeaways.find((t) => t.includes('Monthly Paycheck Accounted For'));
  assert.ok(salaryTakeaway);
  assert.ok(salaryTakeaway.includes('1,80,000'));
});

test('runSimulation injects detected historical average salary into synthetic recurring when ledger has no recurring rule', () => {
  const bankAcc = makeAccount({ id: 'acc_bank', name: 'Checking', openingBalance: 10_000_00 });
  // Add salary entry for previous month '2026-08'
  const salaryEntry: Entry = {
    id: 'ent_salary_aug',
    date: '2026-08-01',
    amount: 85_000_00, // ₹85,000 salary
    direction: 'in',
    accountId: 'acc_bank',
    description: 'Salary Credit from Tech Corp',
    tags: ['salary'],
    source: 'import',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  const ledger: Ledger = {
    ...EMPTY_LEDGER,
    accounts: [bankAcc],
    entries: [salaryEntry],
    recurring: [], // No recurring salary configured in settings
  };

  const params: SimulationParams = {
    type: 'target_accumulation',
    title: 'Vehicle Savings',
    amount: 120_000_00,
    targetDate: '2027-09-05',
  };

  const result = runSimulation(ledger, params, '2026-09-05');

  // Detected from historical entries
  assert.equal(result.cashFlowBreakdown.incomeSource, 'historical_average');
  assert.equal(result.cashFlowBreakdown.monthlyIncome, 85_000_00);
  assert.equal(result.cashFlowBreakdown.isSalaryActive, true);

  // Takeaways confirm the detected salary
  const salaryTakeaway = result.keyTakeaways.find((t) => t.includes('Monthly Paycheck Accounted For'));
  assert.ok(salaryTakeaway);
  assert.ok(salaryTakeaway.includes('85,000'));
});


