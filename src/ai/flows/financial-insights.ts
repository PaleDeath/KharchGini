import { z } from 'zod';
import { ai } from '../genkit';

export const FinancialInsightsInputSchema = z.object({
  income: z.number(),
  expenses: z.number(),
  userType: z.enum(['student', 'professional', 'freelancer', 'business_owner', 'retired', 'other']),
  age: z.number(),
  dependents: z.number(),
  currentSavings: z.number(),
  monthlyFixedExpenses: z.number(),
  financialGoals: z.string(),
  spendingPatterns: z.string(),
  location: z.enum(['metro', 'tier2', 'tier3', 'rural']).optional(),
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
});

export const PrioritizedRecommendationSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  timeframe: z.string(),
});

export const MonthlyBudgetSuggestionSchema = z.object({
  needs: z.number(),
  wants: z.number(),
  savings: z.number(),
  reasoning: z.string(),
});

export const FinancialInsightsOutputSchema = z.object({
  personalizedGreeting: z.string(),
  financialHealthScore: z.number().min(0).max(100),
  keyInsights: z.array(z.string()),
  prioritizedRecommendations: z.array(PrioritizedRecommendationSchema),
  monthlyBudgetSuggestion: MonthlyBudgetSuggestionSchema,
  specificTips: z.array(z.string()),
  warningSignals: z.array(z.string()).optional(),
  encouragement: z.string(),
});

export type FinancialInsightsInput = z.infer<typeof FinancialInsightsInputSchema>;
export type FinancialInsightsOutput = z.infer<typeof FinancialInsightsOutputSchema>;

export const financialInsightsFlow = ai.defineFlow({
  name: 'financialInsights',
  inputSchema: FinancialInsightsInputSchema,
  outputSchema: FinancialInsightsOutputSchema,
}, async (input) => {
  const prompt = `
    Analyze the financial situation for a ${input.age}-year-old ${input.userType} with ${input.dependents} dependents.
    Income: ${input.income}, Expenses: ${input.expenses}, Savings: ${input.currentSavings}.
    Fixed Expenses: ${input.monthlyFixedExpenses}.
    Goals: ${input.financialGoals}.
    Spending Patterns: ${input.spendingPatterns}.
    Location: ${input.location || 'Unknown'}, Risk Tolerance: ${input.riskTolerance || 'Unknown'}.

    Provide a personalized financial health assessment, including a score (0-100), key insights, prioritized recommendations,
    a suggested monthly budget allocation (needs/wants/savings percentages), specific tips, any warning signals, and encouragement.
  `;

  const { output } = await ai.generate({
    prompt,
    output: { schema: FinancialInsightsOutputSchema },
  });

  if (!output) {
    throw new Error('Failed to generate financial insights');
  }

  return output;
});

export async function generateFinancialInsights(input: FinancialInsightsInput): Promise<FinancialInsightsOutput> {
  return await financialInsightsFlow(input);
}
