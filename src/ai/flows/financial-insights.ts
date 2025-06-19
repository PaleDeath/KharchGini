// Type definitions for Financial Insights AI Flow
// This module is temporarily disabled due to Genkit Node.js module conflicts

export interface FinancialInsightsInput {
  // Financial data
  income: number;
  expenses: number;
  
  // Personal context
  userType: 'student' | 'professional' | 'freelancer' | 'business_owner' | 'retired' | 'other';
  age: number;
  dependents: number;
  
  // Financial situation
  currentSavings: number;
  monthlyFixedExpenses: number;
  
  // Goals and patterns
  financialGoals: string;
  spendingPatterns: string;
  
  // Optional context
  location?: 'metro' | 'tier2' | 'tier3' | 'rural';
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
}

export interface PrioritizedRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  timeframe: string;
}

export interface MonthlyBudgetSuggestion {
  needs: number;
  wants: number;
  savings: number;
  reasoning: string;
}

export interface FinancialInsightsOutput {
  personalizedGreeting: string;
  financialHealthScore: number;
  keyInsights: string[];
  prioritizedRecommendations: PrioritizedRecommendation[];
  monthlyBudgetSuggestion: MonthlyBudgetSuggestion;
  specificTips: string[];
  warningSignals?: string[];
  encouragement: string;
}

// Temporarily disabled function - will be implemented when Genkit issues are resolved
export async function generateFinancialInsights(input: FinancialInsightsInput): Promise<FinancialInsightsOutput> {
  // This function is temporarily disabled due to Genkit Node.js module conflicts
  // Return a placeholder response
  return {
    personalizedGreeting: "Financial insights are temporarily unavailable due to system maintenance.",
    financialHealthScore: 0,
    keyInsights: ["AI insights are currently being updated for better performance."],
    prioritizedRecommendations: [],
    monthlyBudgetSuggestion: {
      needs: 50,
      wants: 30,
      savings: 20,
      reasoning: "Standard 50/30/20 budget allocation."
    },
    specificTips: ["Please check back later for personalized financial advice."],
    warningSignals: [],
    encouragement: "Your financial journey is important to us. We're working to provide better insights soon!"
  };
}
