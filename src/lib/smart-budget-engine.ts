import type { Transaction, Budget } from '@/lib/types';
import { addMonths, subMonths, format, parseISO } from 'date-fns';

export interface BudgetSuggestion {
  category: string;
  suggestedAmount: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
  historicalData: {
    monthsAnalyzed: number;
    averageSpending: number;
    medianSpending: number;
    minSpending: number;
    maxSpending: number;
    variance: number;
  };
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface SmartBudgetRecommendation {
  targetMonth: string;
  suggestions: BudgetSuggestion[];
  totalSuggestedBudget: number;
  analysisMetadata: {
    monthsAnalyzed: number;
    totalTransactions: number;
    categoriesFound: number;
    overallConfidence: 'low' | 'medium' | 'high';
  };
}

/**
 * Generate smart budget suggestions based on historical spending patterns
 */
export function generateSmartBudgetSuggestions(
  transactions: Transaction[], 
  targetMonth: string,
  monthsToAnalyze: number = 6
): SmartBudgetRecommendation {
  
  // Filter to only expense transactions for budget analysis
  const expenseTransactions = transactions.filter(t => t.type === 'expense');
  
  // Get date range for analysis
  const targetDate = parseISO(targetMonth + '-01');
  const startDate = subMonths(targetDate, monthsToAnalyze);
  const endDate = subMonths(targetDate, 1); // Exclude target month
  
  // Filter transactions to analysis period
  const analysisTransactions = expenseTransactions.filter(t => {
    const transactionDate = parseISO(t.date + 'T00:00:00');
    return transactionDate >= startDate && transactionDate <= endDate;
  });
  
  if (analysisTransactions.length === 0) {
    return {
      targetMonth,
      suggestions: [],
      totalSuggestedBudget: 0,
      analysisMetadata: {
        monthsAnalyzed: 0,
        totalTransactions: 0,
        categoriesFound: 0,
        overallConfidence: 'low'
      }
    };
  }
  
  // Group transactions by category and month
  const categoryMonthlySpending = new Map<string, Map<string, number>>();
  
  analysisTransactions.forEach(t => {
    const category = t.category || 'Uncategorized';
    const month = t.date.slice(0, 7); // YYYY-MM
    
    if (!categoryMonthlySpending.has(category)) {
      categoryMonthlySpending.set(category, new Map());
    }
    
    const monthlyData = categoryMonthlySpending.get(category)!;
    monthlyData.set(month, (monthlyData.get(month) || 0) + t.amount);
  });
  
  // Generate suggestions for each category
  const suggestions: BudgetSuggestion[] = [];
  
  categoryMonthlySpending.forEach((monthlyData, category) => {
    const monthlyAmounts = Array.from(monthlyData.values());
    
    if (monthlyAmounts.length === 0) return;
    
    // Calculate statistics
    const sortedAmounts = [...monthlyAmounts].sort((a, b) => a - b);
    const average = monthlyAmounts.reduce((sum, amt) => sum + amt, 0) / monthlyAmounts.length;
    const median = sortedAmounts.length % 2 === 0
      ? (sortedAmounts[sortedAmounts.length / 2 - 1] + sortedAmounts[sortedAmounts.length / 2]) / 2
      : sortedAmounts[Math.floor(sortedAmounts.length / 2)];
    const min = Math.min(...monthlyAmounts);
    const max = Math.max(...monthlyAmounts);
    
    // Calculate variance for confidence scoring
    const variance = monthlyAmounts.reduce((sum, amt) => sum + Math.pow(amt - average, 2), 0) / monthlyAmounts.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / average;
    
    // Determine trend
    const firstHalf = monthlyAmounts.slice(0, Math.ceil(monthlyAmounts.length / 2));
    const secondHalf = monthlyAmounts.slice(Math.floor(monthlyAmounts.length / 2));
    const firstHalfAvg = firstHalf.reduce((sum, amt) => sum + amt, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, amt) => sum + amt, 0) / secondHalf.length;
    const trendChangePercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
    
    let trend: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(trendChangePercent) < 10) {
      trend = 'stable';
    } else if (trendChangePercent > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }
    
    // Calculate confidence based on data consistency
    let confidence: 'low' | 'medium' | 'high';
    if (monthlyAmounts.length >= 4 && coefficientOfVariation < 0.3) {
      confidence = 'high';
    } else if (monthlyAmounts.length >= 3 && coefficientOfVariation < 0.5) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }
    
    // Base suggested amount on median (more robust than average)
    let suggestedAmount = median;
    
    // Adjust based on trend
    if (trend === 'increasing') {
      suggestedAmount = Math.max(median, average * 1.05); // 5% buffer for increasing trend
    } else if (trend === 'decreasing') {
      suggestedAmount = Math.min(median, average * 0.95); // 5% reduction for decreasing trend
    }
    
    // Add buffer for low confidence categories
    if (confidence === 'low') {
      suggestedAmount *= 1.15; // 15% buffer for uncertainty
    } else if (confidence === 'medium') {
      suggestedAmount *= 1.08; // 8% buffer for medium confidence
    }
    
    // Round to nearest 100
    suggestedAmount = Math.round(suggestedAmount / 100) * 100;
    
    // Generate reasoning
    let reasoning = `Based on ${monthlyAmounts.length} months of data, `;
    reasoning += `your median spending is ₹${Math.round(median).toLocaleString('en-IN')}. `;
    
    if (trend === 'increasing') {
      reasoning += `Spending is trending upward (+${Math.abs(trendChangePercent).toFixed(1)}%), so we've added a buffer. `;
    } else if (trend === 'decreasing') {
      reasoning += `Spending is trending downward (-${Math.abs(trendChangePercent).toFixed(1)}%), so we've adjusted accordingly. `;
    } else {
      reasoning += `Spending is stable, `;
    }
    
    if (confidence === 'high') {
      reasoning += `High confidence due to consistent spending pattern.`;
    } else if (confidence === 'medium') {
      reasoning += `Medium confidence - some variation in spending.`;
    } else {
      reasoning += `Low confidence due to limited data or high variation - added extra buffer.`;
    }
    
    suggestions.push({
      category,
      suggestedAmount,
      confidence,
      reasoning,
      historicalData: {
        monthsAnalyzed: monthlyAmounts.length,
        averageSpending: Math.round(average),
        medianSpending: Math.round(median),
        minSpending: Math.round(min),
        maxSpending: Math.round(max),
        variance: Math.round(variance)
      },
      trend
    });
  });
  
  // Sort by suggested amount (highest first)
  suggestions.sort((a, b) => b.suggestedAmount - a.suggestedAmount);
  
  // Calculate overall confidence
  const highConfidenceCount = suggestions.filter(s => s.confidence === 'high').length;
  const mediumConfidenceCount = suggestions.filter(s => s.confidence === 'medium').length;
  
  let overallConfidence: 'low' | 'medium' | 'high';
  if (suggestions.length > 0) {
    const highRatio = highConfidenceCount / suggestions.length;
    const mediumRatio = mediumConfidenceCount / suggestions.length;
    
    if (highRatio >= 0.6) {
      overallConfidence = 'high';
    } else if (highRatio + mediumRatio >= 0.7) {
      overallConfidence = 'medium';
    } else {
      overallConfidence = 'low';
    }
  } else {
    overallConfidence = 'low';
  }
  
  const totalSuggestedBudget = suggestions.reduce((sum, s) => sum + s.suggestedAmount, 0);
  
  return {
    targetMonth,
    suggestions,
    totalSuggestedBudget,
    analysisMetadata: {
      monthsAnalyzed: monthsToAnalyze,
      totalTransactions: analysisTransactions.length,
      categoriesFound: suggestions.length,
      overallConfidence
    }
  };
}

/**
 * Generate quick budget recommendations for common scenarios
 */
export function generateQuickBudgetTemplates(): BudgetSuggestion[] {
  return [
    {
      category: 'Food & Dining',
      suggestedAmount: 8000,
      confidence: 'medium',
      reasoning: 'Typical Indian household spending on food and dining out.',
      historicalData: {
        monthsAnalyzed: 0,
        averageSpending: 8000,
        medianSpending: 8000,
        minSpending: 8000,
        maxSpending: 8000,
        variance: 0
      },
      trend: 'stable'
    },
    {
      category: 'Transportation',
      suggestedAmount: 3000,
      confidence: 'medium',
      reasoning: 'Average transportation costs including fuel, public transport.',
      historicalData: {
        monthsAnalyzed: 0,
        averageSpending: 3000,
        medianSpending: 3000,
        minSpending: 3000,
        maxSpending: 3000,
        variance: 0
      },
      trend: 'stable'
    },
    {
      category: 'Bills & Utilities',
      suggestedAmount: 2500,
      confidence: 'medium',
      reasoning: 'Typical utilities including electricity, mobile, internet.',
      historicalData: {
        monthsAnalyzed: 0,
        averageSpending: 2500,
        medianSpending: 2500,
        minSpending: 2500,
        maxSpending: 2500,
        variance: 0
      },
      trend: 'stable'
    },
    {
      category: 'Shopping',
      suggestedAmount: 4000,
      confidence: 'medium',
      reasoning: 'General shopping including clothes, household items.',
      historicalData: {
        monthsAnalyzed: 0,
        averageSpending: 4000,
        medianSpending: 4000,
        minSpending: 4000,
        maxSpending: 4000,
        variance: 0
      },
      trend: 'stable'
    },
    {
      category: 'Entertainment',
      suggestedAmount: 2000,
      confidence: 'medium',
      reasoning: 'Entertainment including movies, subscriptions, outings.',
      historicalData: {
        monthsAnalyzed: 0,
        averageSpending: 2000,
        medianSpending: 2000,
        minSpending: 2000,
        maxSpending: 2000,
        variance: 0
      },
      trend: 'stable'
    }
  ];
} 