import type { Transaction } from '@/lib/types';
import { subMonths, format, parseISO, differenceInMonths } from 'date-fns';

export interface SpendingAnomaly {
  category: string;
  currentAmount: number;
  historicalAverage: number;
  standardDeviation: number;
  zScore: number;
  severity: 'moderate' | 'high' | 'extreme';
  description: string;
  recommendation: string;
  period: string; // Current period being analyzed
  historicalData: {
    monthsAnalyzed: number;
    minSpending: number;
    maxSpending: number;
    recentTrend: 'increasing' | 'decreasing' | 'stable';
  };
}

export interface AnomalyDetectionReport {
  analysisDate: string;
  period: string;
  anomalies: SpendingAnomaly[];
  summary: {
    totalAnomalies: number;
    highSeverityCount: number;
    moderateSeverityCount: number;
    totalExcessSpending: number;
    categoriesAffected: number;
  };
  overallAssessment: 'normal' | 'caution' | 'alert';
}

/**
 * Detect spending anomalies for the current month based on historical patterns
 */
export function detectSpendingAnomalies(
  transactions: Transaction[],
  analysisMonth: string = new Date().toISOString().slice(0, 7),
  historicalMonths: number = 6
): AnomalyDetectionReport {
  const analysisDate = parseISO(analysisMonth + '-01');
  
  // Get historical transactions (excluding current month)
  const historicalTransactions = transactions.filter(t => {
    const transactionDate = parseISO(t.date);
    const monthsDiff = differenceInMonths(analysisDate, transactionDate);
    return monthsDiff > 0 && monthsDiff <= historicalMonths && t.type === 'expense';
  });
  
  // Get current month transactions
  const currentTransactions = transactions.filter(t => 
    t.date.startsWith(analysisMonth) && t.type === 'expense'
  );
  
  if (historicalTransactions.length === 0 || currentTransactions.length === 0) {
    return {
      analysisDate: new Date().toISOString(),
      period: analysisMonth,
      anomalies: [],
      summary: {
        totalAnomalies: 0,
        highSeverityCount: 0,
        moderateSeverityCount: 0,
        totalExcessSpending: 0,
        categoriesAffected: 0
      },
      overallAssessment: 'normal'
    };
  }
  
  // Group historical spending by category and month
  const historicalSpendingByCategory = new Map<string, number[]>();
  
  // Create monthly spending data for each category
  for (let i = 0; i < historicalMonths; i++) {
    const monthDate = subMonths(analysisDate, historicalMonths - i);
    const monthString = format(monthDate, 'yyyy-MM');
    
    // Skip if this is the analysis month
    if (monthString === analysisMonth) continue;
    
    const monthTransactions = historicalTransactions.filter(t => 
      t.date.startsWith(monthString)
    );
    
    // Group by category for this month
    const categorySpending = new Map<string, number>();
    monthTransactions.forEach(t => {
      const category = t.category || 'Uncategorized';
      categorySpending.set(category, (categorySpending.get(category) || 0) + t.amount);
    });
    
    // Add to historical data
    categorySpending.forEach((amount, category) => {
      if (!historicalSpendingByCategory.has(category)) {
        historicalSpendingByCategory.set(category, []);
      }
      historicalSpendingByCategory.get(category)!.push(amount);
    });
    
    // Add zeros for categories that didn't have spending this month
    historicalSpendingByCategory.forEach((amounts, category) => {
      if (!categorySpending.has(category)) {
        amounts.push(0);
      }
    });
  }
  
  // Get current month spending by category
  const currentSpendingByCategory = new Map<string, number>();
  currentTransactions.forEach(t => {
    const category = t.category || 'Uncategorized';
    currentSpendingByCategory.set(category, (currentSpendingByCategory.get(category) || 0) + t.amount);
  });
  
  // Detect anomalies using percentage-based thresholds
  const anomalies: SpendingAnomaly[] = [];
  
  currentSpendingByCategory.forEach((currentAmount, category) => {
    const historicalAmounts = historicalSpendingByCategory.get(category) || [];
    
    // Need at least 3 months of data for meaningful analysis
    if (historicalAmounts.length < 3) return;
    
    // Calculate average historical spending
    const average = historicalAmounts.reduce((sum, amt) => sum + amt, 0) / historicalAmounts.length;
    
    // Skip if average is too low to be meaningful
    if (average < 100) return;
    
    // Calculate percentage increase
    const percentageIncrease = ((currentAmount - average) / average) * 100;
    
    // Use simple percentage-based thresholds instead of z-score
    let isAnomaly = false;
    let severity: 'moderate' | 'high' | 'extreme' = 'moderate'; // Initialize with default value
    
    if (percentageIncrease >= 300) { // 3x or more than average
      isAnomaly = true;
      severity = 'extreme';
    } else if (percentageIncrease >= 150) { // 2.5x or more than average
      isAnomaly = true;
      severity = 'high';
    } else if (percentageIncrease >= 100) { // 2x or more than average
      isAnomaly = true;
      severity = 'moderate';
    }
    
    if (isAnomaly) {
      const minSpending = Math.min(...historicalAmounts);
      const maxSpending = Math.max(...historicalAmounts);
      
      // Calculate trend
      const firstHalf = historicalAmounts.slice(0, Math.ceil(historicalAmounts.length / 2));
      const secondHalf = historicalAmounts.slice(Math.floor(historicalAmounts.length / 2));
      const firstHalfAvg = firstHalf.reduce((sum, amt) => sum + amt, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, amt) => sum + amt, 0) / secondHalf.length;
      const trendChangePercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
      
      let recentTrend: 'increasing' | 'decreasing' | 'stable';
      if (Math.abs(trendChangePercent) < 10) {
        recentTrend = 'stable';
      } else if (trendChangePercent > 0) {
        recentTrend = 'increasing';
      } else {
        recentTrend = 'decreasing';
      }
      
      // Generate description
      let description = `Spending in ${category} is ${percentageIncrease.toFixed(0)}% higher than usual. `;
      description += `Current: ₹${currentAmount.toLocaleString('en-IN')}, `;
      description += `Average: ₹${Math.round(average).toLocaleString('en-IN')}`;
      
      // Generate recommendation
      let recommendation = '';
      if (severity === 'extreme') {
        recommendation = `⚠️ URGENT: Review all ${category} transactions immediately. This is extremely high spending.`;
      } else if (severity === 'high') {
        recommendation = `⚡ HIGH ALERT: Check recent ${category} purchases. Consider if this spending was planned.`;
      } else {
        recommendation = `💡 NOTICE: ${category} spending is significantly higher than usual. Review recent purchases.`;
      }
      
      if (recentTrend === 'increasing') {
        recommendation += ` Note: This category has been trending upward recently.`;
      }
      
      anomalies.push({
        category,
        currentAmount,
        historicalAverage: Math.round(average),
        standardDeviation: 0, // Not used in simplified version
        zScore: percentageIncrease / 100, // Store percentage as ratio for compatibility
        severity,
        description,
        recommendation,
        period: analysisMonth,
        historicalData: {
          monthsAnalyzed: historicalAmounts.length,
          minSpending: Math.round(minSpending),
          maxSpending: Math.round(maxSpending),
          recentTrend
        }
      });
    }
  });

  // Sort anomalies by severity and percentage increase
  anomalies.sort((a, b) => {
    const severityOrder = { extreme: 3, high: 2, moderate: 1 };
    const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.zScore - a.zScore; // zScore now contains percentage ratio
  });
  
  // Calculate summary
  const highSeverityCount = anomalies.filter(a => a.severity === 'high' || a.severity === 'extreme').length;
  const moderateSeverityCount = anomalies.filter(a => a.severity === 'moderate').length;
  const totalExcessSpending = anomalies.reduce((sum, a) => sum + (a.currentAmount - a.historicalAverage), 0);
  
  // Determine overall assessment
  let overallAssessment: 'normal' | 'caution' | 'alert';
  if (anomalies.some(a => a.severity === 'extreme') || highSeverityCount >= 3) {
    overallAssessment = 'alert';
  } else if (highSeverityCount > 0 || moderateSeverityCount >= 2) {
    overallAssessment = 'caution';
  } else {
    overallAssessment = 'normal';
  }
  
  return {
    analysisDate: new Date().toISOString(),
    period: analysisMonth,
    anomalies,
    summary: {
      totalAnomalies: anomalies.length,
      highSeverityCount,
      moderateSeverityCount,
      totalExcessSpending: Math.round(totalExcessSpending),
      categoriesAffected: anomalies.length
    },
    overallAssessment
  };
}

/**
 * Check for simple threshold-based alerts (budget overruns, large single transactions)
 */
export function detectSimpleAlerts(
  transactions: Transaction[],
  month: string,
  thresholds: {
    largeSingleTransaction?: number;
    dailySpendingLimit?: number;
  } = {}
): {
  largeTransactions: Transaction[];
  highDailySpending: { date: string; amount: number; transactions: number }[];
} {
  const {
    largeSingleTransaction = 10000, // ₹10,000 threshold
    dailySpendingLimit = 5000 // ₹5,000 per day threshold
  } = thresholds;
  
  const monthTransactions = transactions.filter(t => 
    t.type === 'expense' && t.date.startsWith(month)
  );
  
  // Find unusually large single transactions
  const largeTransactions = monthTransactions.filter(t => t.amount >= largeSingleTransaction);
  
  // Group by date and find high daily spending
  const dailySpending = new Map<string, { amount: number; transactions: number }>();
  
  monthTransactions.forEach(t => {
    const existing = dailySpending.get(t.date) || { amount: 0, transactions: 0 };
    existing.amount += t.amount;
    existing.transactions += 1;
    dailySpending.set(t.date, existing);
  });
  
  const highDailySpending = Array.from(dailySpending.entries())
    .filter(([_, data]) => data.amount >= dailySpendingLimit)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => b.amount - a.amount);
  
  return {
    largeTransactions,
    highDailySpending
  };
} 