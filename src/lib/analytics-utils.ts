import type { Transaction, Budget } from '@/lib/types';
import { subMonths, format, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO } from 'date-fns';

export interface MonthlyData {
  month: string; // YYYY-MM format
  monthLabel: string; // "Jan 2024" format
  income: number;
  expenses: number;
  net: number;
  transactions: number;
}

export interface CategorySpending {
  category: string;
  amount: number;
  percentage: number;
  transactions: number;
  avgTransactionAmount: number;
}

export interface TrendAnalysis {
  monthlyData: MonthlyData[];
  totalIncome: number;
  totalExpenses: number;
  avgMonthlyIncome: number;
  avgMonthlyExpenses: number;
  incomeGrowth: number; // percentage change from first to last month
  expenseGrowth: number; // percentage change from first to last month
  bestMonth: MonthlyData;
  worstMonth: MonthlyData;
}

export interface SpendingInsights {
  topCategories: CategorySpending[];
  totalCategorizedSpending: number;
  uncategorizedSpending: number;
  categoryCount: number;
  avgCategorySpending: number;
  topCategory: CategorySpending | null;
}

export interface FinancialForecast {
  nextMonthIncome: number;
  nextMonthExpenses: number;
  nextMonthNet: number;
  confidence: 'low' | 'medium' | 'high';
  yearEndProjection: {
    totalIncome: number;
    totalExpenses: number;
    totalNet: number;
  };
}

export interface ComparativeAnalysis {
  currentVsPrevious: {
    incomeChange: number;
    expenseChange: number;
    netChange: number;
    period: string;
  };
  budgetPerformance: {
    categoriesOnTrack: number;
    categoriesOverBudget: number;
    totalBudgetUtilization: number; // percentage
    avgCategoryPerformance: number; // percentage
  } | null;
}

/**
 * Generates comprehensive trend analysis from transactions
 */
export function generateTrendAnalysis(transactions: Transaction[], monthsBack: number = 6): TrendAnalysis {
  const now = new Date();
  const startDate = subMonths(startOfMonth(now), monthsBack - 1);
  const endDate = endOfMonth(now);
  
  // Generate months array
  const months = eachMonthOfInterval({ start: startDate, end: endDate });
  
  const monthlyData: MonthlyData[] = months.map(month => {
    const monthStr = format(month, 'yyyy-MM');
    const monthLabel = format(month, 'MMM yyyy');
    
    // Filter transactions for this month
    const monthTransactions = transactions.filter(t => t.date.startsWith(monthStr));
    
    const income = monthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = monthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    return {
      month: monthStr,
      monthLabel,
      income,
      expenses,
      net: income - expenses,
      transactions: monthTransactions.length,
    };
  });

  const totalIncome = monthlyData.reduce((sum, m) => sum + m.income, 0);
  const totalExpenses = monthlyData.reduce((sum, m) => sum + m.expenses, 0);
  const avgMonthlyIncome = totalIncome / monthlyData.length;
  const avgMonthlyExpenses = totalExpenses / monthlyData.length;

  // Calculate growth rates
  const firstMonth = monthlyData[0];
  const lastMonth = monthlyData[monthlyData.length - 1];
  const incomeGrowth = firstMonth.income > 0 
    ? ((lastMonth.income - firstMonth.income) / firstMonth.income) * 100 
    : 0;
  const expenseGrowth = firstMonth.expenses > 0 
    ? ((lastMonth.expenses - firstMonth.expenses) / firstMonth.expenses) * 100 
    : 0;

  // Find best and worst months by net
  const bestMonth = monthlyData.reduce((best, current) => 
    current.net > best.net ? current : best, monthlyData[0]);
  const worstMonth = monthlyData.reduce((worst, current) => 
    current.net < worst.net ? current : worst, monthlyData[0]);

  return {
    monthlyData,
    totalIncome,
    totalExpenses,
    avgMonthlyIncome,
    avgMonthlyExpenses,
    incomeGrowth,
    expenseGrowth,
    bestMonth,
    worstMonth,
  };
}

/**
 * Analyzes spending patterns by category
 */
export function generateSpendingInsights(transactions: Transaction[]): SpendingInsights {
  const expenseTransactions = transactions.filter(t => t.type === 'expense');
  const totalSpending = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
  
  // Group by category
  const categoryData: Record<string, { amount: number; transactions: number }> = {};
  let uncategorizedSpending = 0;
  
  expenseTransactions.forEach(transaction => {
    const category = transaction.category || 'Uncategorized';
    if (category === 'Uncategorized' || !transaction.category) {
      uncategorizedSpending += transaction.amount;
    } else {
      if (!categoryData[category]) {
        categoryData[category] = { amount: 0, transactions: 0 };
      }
      categoryData[category].amount += transaction.amount;
      categoryData[category].transactions += 1;
    }
  });

  const totalCategorizedSpending = Object.values(categoryData).reduce((sum, data) => sum + data.amount, 0);

  // Convert to CategorySpending array and sort
  const topCategories: CategorySpending[] = Object.entries(categoryData)
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      percentage: totalSpending > 0 ? (data.amount / totalSpending) * 100 : 0,
      transactions: data.transactions,
      avgTransactionAmount: data.transactions > 0 ? data.amount / data.transactions : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const categoryCount = topCategories.length;
  const avgCategorySpending = categoryCount > 0 ? totalCategorizedSpending / categoryCount : 0;
  const topCategory = topCategories.length > 0 ? topCategories[0] : null;

  return {
    topCategories,
    totalCategorizedSpending,
    uncategorizedSpending,
    categoryCount,
    avgCategorySpending,
    topCategory,
  };
}

/**
 * Generates financial forecast based on historical data
 */
export function generateFinancialForecast(trendAnalysis: TrendAnalysis): FinancialForecast {
  const { monthlyData } = trendAnalysis;
  
  if (monthlyData.length < 3) {
    return {
      nextMonthIncome: trendAnalysis.avgMonthlyIncome,
      nextMonthExpenses: trendAnalysis.avgMonthlyExpenses,
      nextMonthNet: trendAnalysis.avgMonthlyIncome - trendAnalysis.avgMonthlyExpenses,
      confidence: 'low',
      yearEndProjection: {
        totalIncome: trendAnalysis.avgMonthlyIncome * 12,
        totalExpenses: trendAnalysis.avgMonthlyExpenses * 12,
        totalNet: (trendAnalysis.avgMonthlyIncome - trendAnalysis.avgMonthlyExpenses) * 12,
      },
    };
  }

  // Use weighted average with more weight on recent months
  const weights = monthlyData.map((_, index) => index + 1); // 1, 2, 3, 4, 5, 6
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const weightedAvgIncome = monthlyData.reduce((sum, month, index) => 
    sum + (month.income * weights[index]), 0) / totalWeight;
  
  const weightedAvgExpenses = monthlyData.reduce((sum, month, index) => 
    sum + (month.expenses * weights[index]), 0) / totalWeight;

  // Determine confidence based on data consistency
  const incomeVariance = calculateVariance(monthlyData.map(m => m.income));
  const expenseVariance = calculateVariance(monthlyData.map(m => m.expenses));
  const avgIncome = trendAnalysis.avgMonthlyIncome;
  const avgExpenses = trendAnalysis.avgMonthlyExpenses;
  
  let confidence: 'low' | 'medium' | 'high' = 'medium';
  
  if (monthlyData.length >= 6) {
    const incomeCV = avgIncome > 0 ? Math.sqrt(incomeVariance) / avgIncome : 1;
    const expenseCV = avgExpenses > 0 ? Math.sqrt(expenseVariance) / avgExpenses : 1;
    
    if (incomeCV < 0.2 && expenseCV < 0.2) confidence = 'high';
    else if (incomeCV > 0.5 || expenseCV > 0.5) confidence = 'low';
  }

  return {
    nextMonthIncome: weightedAvgIncome,
    nextMonthExpenses: weightedAvgExpenses,
    nextMonthNet: weightedAvgIncome - weightedAvgExpenses,
    confidence,
    yearEndProjection: {
      totalIncome: weightedAvgIncome * 12,
      totalExpenses: weightedAvgExpenses * 12,
      totalNet: (weightedAvgIncome - weightedAvgExpenses) * 12,
    },
  };
}

/**
 * Generates comparative analysis with previous period and budget performance
 */
export function generateComparativeAnalysis(
  transactions: Transaction[], 
  budgets: Budget[] = [],
  currentMonth: string
): ComparativeAnalysis {
  // Calculate previous month
  const currentDate = parseISO(currentMonth + '-01');
  const prevDate = subMonths(currentDate, 1);
  const prevMonth = format(prevDate, 'yyyy-MM');

  // Current month data
  const currentTransactions = transactions.filter(t => t.date.startsWith(currentMonth));
  const currentIncome = currentTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const currentExpenses = currentTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  // Previous month data
  const prevTransactions = transactions.filter(t => t.date.startsWith(prevMonth));
  const prevIncome = prevTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const prevExpenses = prevTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  // Calculate changes
  const incomeChange = prevIncome > 0 ? ((currentIncome - prevIncome) / prevIncome) * 100 : 0;
  const expenseChange = prevExpenses > 0 ? ((currentExpenses - prevExpenses) / prevExpenses) * 100 : 0;
  const netChange = ((currentIncome - currentExpenses) - (prevIncome - prevExpenses));

  // Budget performance analysis
  let budgetPerformance = null;
  if (budgets.length > 0) {
    const currentBudgets = budgets.filter(b => b.month === currentMonth);
    if (currentBudgets.length > 0) {
      const categoriesOnTrack = currentBudgets.filter(b => b.spentAmount <= b.budgetAmount).length;
      const categoriesOverBudget = currentBudgets.filter(b => b.spentAmount > b.budgetAmount).length;
      const totalBudget = currentBudgets.reduce((sum, b) => sum + b.budgetAmount, 0);
      const totalSpent = currentBudgets.reduce((sum, b) => sum + b.spentAmount, 0);
      const totalBudgetUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
      
      const categoryPerformances = currentBudgets.map(b => 
        b.budgetAmount > 0 ? (b.spentAmount / b.budgetAmount) * 100 : 0
      );
      const avgCategoryPerformance = categoryPerformances.length > 0 
        ? categoryPerformances.reduce((sum, p) => sum + p, 0) / categoryPerformances.length 
        : 0;

      budgetPerformance = {
        categoriesOnTrack,
        categoriesOverBudget,
        totalBudgetUtilization,
        avgCategoryPerformance,
      };
    }
  }

  return {
    currentVsPrevious: {
      incomeChange,
      expenseChange,
      netChange,
      period: `${format(prevDate, 'MMM')} vs ${format(currentDate, 'MMM')}`,
    },
    budgetPerformance,
  };
}

// Helper function to calculate variance
function calculateVariance(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  
  const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
  return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
}

/**
 * Formats currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', { 
    style: 'currency', 
    currency: 'INR', 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  }).format(amount);
}

/**
 * Formats percentage for display
 */
export function formatPercentage(percentage: number, decimals: number = 1): string {
  return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(decimals)}%`;
} 