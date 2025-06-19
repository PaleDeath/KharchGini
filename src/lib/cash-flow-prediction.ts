import type { Transaction } from '@/lib/types';
import { addMonths, format, parseISO, startOfMonth, endOfMonth, differenceInMonths } from 'date-fns';

export interface CashFlowPrediction {
  month: string;
  monthLabel: string;
  predictedIncome: number;
  predictedExpenses: number;
  predictedNet: number;
  confidence: 'low' | 'medium' | 'high';
  factors: string[];
}

export interface CashFlowAnalysis {
  currentBalance: number;
  predictions: CashFlowPrediction[];
  insights: {
    trend: 'improving' | 'declining' | 'stable';
    riskLevel: 'low' | 'medium' | 'high';
    recommendations: string[];
    keyFindings: string[];
  };
  scenarios: {
    optimistic: CashFlowPrediction[];
    pessimistic: CashFlowPrediction[];
    realistic: CashFlowPrediction[];
  };
}

export interface SeasonalPattern {
  month: number;
  incomeMultiplier: number;
  expenseMultiplier: number;
  confidence: number;
}

export class CashFlowPredictor {
  private transactions: Transaction[];
  private historicalMonths: number;
  private seasonalPatterns: Map<number, SeasonalPattern> = new Map();

  constructor(transactions: Transaction[], historicalMonths: number = 12) {
    this.transactions = transactions;
    this.historicalMonths = historicalMonths;
    this.analyzeSeasonalPatterns();
  }

  private analyzeSeasonalPatterns() {
    // Group transactions by month of year
    const monthlyData = new Map<number, { income: number[], expenses: number[] }>();
    
    for (let month = 0; month < 12; month++) {
      monthlyData.set(month, { income: [], expenses: [] });
    }

    // Collect historical data by month
    this.transactions.forEach(transaction => {
      const date = parseISO(transaction.date);
      const month = date.getMonth();
      const data = monthlyData.get(month)!;
      
      if (transaction.type === 'income') {
        data.income.push(transaction.amount);
      } else {
        data.expenses.push(transaction.amount);
      }
    });

    // Calculate seasonal patterns
    const overallIncomeAvg = this.calculateOverallAverage('income');
    const overallExpenseAvg = this.calculateOverallAverage('expense');

    monthlyData.forEach((data, month) => {
      const monthIncomeAvg = data.income.length > 0 ? 
        data.income.reduce((sum, amt) => sum + amt, 0) / data.income.length : overallIncomeAvg;
      const monthExpenseAvg = data.expenses.length > 0 ? 
        data.expenses.reduce((sum, amt) => sum + amt, 0) / data.expenses.length : overallExpenseAvg;

      const incomeMultiplier = overallIncomeAvg > 0 ? monthIncomeAvg / overallIncomeAvg : 1;
      const expenseMultiplier = overallExpenseAvg > 0 ? monthExpenseAvg / overallExpenseAvg : 1;
      
      // Confidence based on data points
      const totalDataPoints = data.income.length + data.expenses.length;
      const confidence = Math.min(totalDataPoints / 10, 1); // Max confidence at 10+ data points

      this.seasonalPatterns.set(month, {
        month,
        incomeMultiplier,
        expenseMultiplier,
        confidence
      });
    });
  }

  private calculateOverallAverage(type: 'income' | 'expense'): number {
    const relevantTransactions = this.transactions.filter(t => t.type === type);
    if (relevantTransactions.length === 0) return 0;
    
    return relevantTransactions.reduce((sum, t) => sum + t.amount, 0) / relevantTransactions.length;
  }

  private calculateTrend(): { incomeGrowth: number; expenseGrowth: number; confidence: number } {
    const monthlyTotals = this.getMonthlyTotals();
    if (monthlyTotals.length < 3) {
      return { incomeGrowth: 0, expenseGrowth: 0, confidence: 0.1 };
    }

    // Calculate linear regression for trend
    const incomeGrowth = this.calculateLinearTrend(monthlyTotals.map(m => m.income));
    const expenseGrowth = this.calculateLinearTrend(monthlyTotals.map(m => m.expenses));
    const confidence = Math.min(monthlyTotals.length / 6, 1); // Max confidence at 6+ months

    return { incomeGrowth, expenseGrowth, confidence };
  }

  private calculateLinearTrend(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;

    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * values[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope || 0;
  }

  private getMonthlyTotals(): Array<{ month: string; income: number; expenses: number }> {
    const monthlyTotals = new Map<string, { income: number; expenses: number }>();

    this.transactions.forEach(transaction => {
      const month = transaction.date.slice(0, 7); // YYYY-MM
      if (!monthlyTotals.has(month)) {
        monthlyTotals.set(month, { income: 0, expenses: 0 });
      }

      const totals = monthlyTotals.get(month)!;
      if (transaction.type === 'income') {
        totals.income += transaction.amount;
      } else {
        totals.expenses += transaction.amount;
      }
    });

    return Array.from(monthlyTotals.entries())
      .map(([month, totals]) => ({ month, ...totals }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  public predictCashFlow(monthsAhead: number = 6): CashFlowAnalysis {
    const trend = this.calculateTrend();
    const monthlyTotals = this.getMonthlyTotals();
    const currentDate = new Date();
    
    // Calculate baseline averages
    const recentMonths = monthlyTotals.slice(-3); // Last 3 months
    const baselineIncome = recentMonths.length > 0 ? 
      recentMonths.reduce((sum, m) => sum + m.income, 0) / recentMonths.length : 0;
    const baselineExpenses = recentMonths.length > 0 ? 
      recentMonths.reduce((sum, m) => sum + m.expenses, 0) / recentMonths.length : 0;

    // Generate predictions
    const predictions: CashFlowPrediction[] = [];
    
    for (let i = 1; i <= monthsAhead; i++) {
      const futureDate = addMonths(currentDate, i);
      const month = format(futureDate, 'yyyy-MM');
      const monthLabel = format(futureDate, 'MMM yyyy');
      const seasonalMonth = futureDate.getMonth();
      
      const seasonalPattern = this.seasonalPatterns.get(seasonalMonth);
      const seasonalIncomeMultiplier = seasonalPattern?.incomeMultiplier || 1;
      const seasonalExpenseMultiplier = seasonalPattern?.expenseMultiplier || 1;
      
      // Apply trend and seasonal adjustments
      const trendAdjustedIncome = baselineIncome + (trend.incomeGrowth * i);
      const trendAdjustedExpenses = baselineExpenses + (trend.expenseGrowth * i);
      
      const predictedIncome = Math.max(0, trendAdjustedIncome * seasonalIncomeMultiplier);
      const predictedExpenses = Math.max(0, trendAdjustedExpenses * seasonalExpenseMultiplier);
      const predictedNet = predictedIncome - predictedExpenses;

      // Calculate confidence
      const dataConfidence = Math.min(monthlyTotals.length / 6, 1);
      const seasonalConfidence = seasonalPattern?.confidence || 0.3;
      const overallConfidence = (dataConfidence + seasonalConfidence) / 2;
      
      let confidence: 'low' | 'medium' | 'high';
      if (overallConfidence >= 0.7) confidence = 'high';
      else if (overallConfidence >= 0.4) confidence = 'medium';
      else confidence = 'low';

      // Generate factors affecting prediction
      const factors: string[] = [];
      if (Math.abs(seasonalIncomeMultiplier - 1) > 0.1) {
        factors.push(`Seasonal income ${seasonalIncomeMultiplier > 1 ? 'increase' : 'decrease'}`);
      }
      if (Math.abs(seasonalExpenseMultiplier - 1) > 0.1) {
        factors.push(`Seasonal expense ${seasonalExpenseMultiplier > 1 ? 'increase' : 'decrease'}`);
      }
      if (Math.abs(trend.incomeGrowth) > 100) {
        factors.push(`Income ${trend.incomeGrowth > 0 ? 'growth' : 'decline'} trend`);
      }
      if (Math.abs(trend.expenseGrowth) > 100) {
        factors.push(`Expense ${trend.expenseGrowth > 0 ? 'growth' : 'decline'} trend`);
      }

      predictions.push({
        month,
        monthLabel,
        predictedIncome,
        predictedExpenses,
        predictedNet,
        confidence,
        factors
      });
    }

    // Generate scenarios
    const scenarios = this.generateScenarios(predictions);

    // Analyze trends and generate insights
    const insights = this.generateInsights(predictions, trend);

    // Calculate current balance (simplified)
    const currentBalance = monthlyTotals.length > 0 ? 
      monthlyTotals[monthlyTotals.length - 1].income - monthlyTotals[monthlyTotals.length - 1].expenses : 0;

    return {
      currentBalance,
      predictions,
      insights,
      scenarios
    };
  }

  private generateScenarios(basePredictions: CashFlowPrediction[]): {
    optimistic: CashFlowPrediction[];
    pessimistic: CashFlowPrediction[];
    realistic: CashFlowPrediction[];
  } {
    const optimisticMultiplier = { income: 1.15, expenses: 0.9 }; // 15% more income, 10% less expenses
    const pessimisticMultiplier = { income: 0.85, expenses: 1.1 }; // 15% less income, 10% more expenses

    const optimistic = basePredictions.map(pred => ({
      ...pred,
      predictedIncome: pred.predictedIncome * optimisticMultiplier.income,
      predictedExpenses: pred.predictedExpenses * optimisticMultiplier.expenses,
      predictedNet: (pred.predictedIncome * optimisticMultiplier.income) - (pred.predictedExpenses * optimisticMultiplier.expenses),
      factors: [...pred.factors, 'Optimistic scenario']
    }));

    const pessimistic = basePredictions.map(pred => ({
      ...pred,
      predictedIncome: pred.predictedIncome * pessimisticMultiplier.income,
      predictedExpenses: pred.predictedExpenses * pessimisticMultiplier.expenses,
      predictedNet: (pred.predictedIncome * pessimisticMultiplier.income) - (pred.predictedExpenses * pessimisticMultiplier.expenses),
      factors: [...pred.factors, 'Pessimistic scenario']
    }));

    return {
      optimistic,
      pessimistic,
      realistic: basePredictions
    };
  }

  private generateInsights(predictions: CashFlowPrediction[], trend: any): CashFlowAnalysis['insights'] {
    const netTrend = predictions.map(p => p.predictedNet);
    const avgNet = netTrend.reduce((sum, net) => sum + net, 0) / netTrend.length;
    
    // Determine overall trend
    let trendDirection: 'improving' | 'declining' | 'stable';
    if (netTrend[netTrend.length - 1] > netTrend[0] + 1000) {
      trendDirection = 'improving';
    } else if (netTrend[netTrend.length - 1] < netTrend[0] - 1000) {
      trendDirection = 'declining';
    } else {
      trendDirection = 'stable';
    }

    // Determine risk level
    const negativeMonths = predictions.filter(p => p.predictedNet < 0).length;
    let riskLevel: 'low' | 'medium' | 'high';
    if (negativeMonths >= predictions.length * 0.5) {
      riskLevel = 'high';
    } else if (negativeMonths >= predictions.length * 0.25) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (riskLevel === 'high') {
      recommendations.push('Consider reducing discretionary expenses immediately');
      recommendations.push('Look for additional income sources');
      recommendations.push('Build an emergency fund as priority');
    } else if (riskLevel === 'medium') {
      recommendations.push('Monitor spending closely in the coming months');
      recommendations.push('Consider setting aside extra savings');
    } else {
      recommendations.push('Maintain current financial habits');
      recommendations.push('Consider increasing investments or savings');
    }

    if (trend.expenseGrowth > trend.incomeGrowth) {
      recommendations.push('Focus on controlling expense growth');
    }

    // Generate key findings
    const keyFindings: string[] = [];
    keyFindings.push(`Average monthly net cash flow: ₹${avgNet.toFixed(0)}`);
    
    if (negativeMonths > 0) {
      keyFindings.push(`${negativeMonths} months predicted to have negative cash flow`);
    }
    
    const highConfidenceMonths = predictions.filter(p => p.confidence === 'high').length;
    keyFindings.push(`${highConfidenceMonths} months have high prediction confidence`);

    return {
      trend: trendDirection,
      riskLevel,
      recommendations,
      keyFindings
    };
  }
}

export function generateCashFlowPrediction(
  transactions: Transaction[],
  monthsAhead: number = 6
): CashFlowAnalysis {
  const predictor = new CashFlowPredictor(transactions);
  return predictor.predictCashFlow(monthsAhead);
}
