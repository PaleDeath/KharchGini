// src/ai/flows/financial-insights.ts
'use server';

/**
 * @fileOverview Enhanced AI-powered financial advisor that provides personalized insights and recommendations.
 * 
 * This advisor considers user context, spending patterns, financial goals, and provides actionable advice
 * tailored to different life situations (students, professionals, families, etc.)
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FinancialInsightsInputSchema = z.object({
  // Financial data
  income: z.number().describe('The user\'s total money coming in (salary, allowance, freelancing, etc.)'),
  expenses: z.number().describe('The user\'s total expenses'),
  
  // Personal context
  userType: z.enum(['student', 'professional', 'freelancer', 'business_owner', 'retired', 'other'])
    .describe('The user\'s primary role/situation'),
  age: z.number().min(16).max(100).describe('User\'s age for context-appropriate advice'),
  dependents: z.number().min(0).describe('Number of people financially dependent on the user'),
  
  // Financial situation
  currentSavings: z.number().min(0).describe('Current savings/emergency fund amount'),
  monthlyFixedExpenses: z.number().min(0).describe('Fixed monthly expenses (rent, EMIs, subscriptions)'),
  
  // Goals and patterns
  financialGoals: z.string().min(10).describe('User\'s specific financial goals and timeframes'),
  spendingPatterns: z.string().min(10).describe('Description of spending habits and patterns'),
  
  // Optional context
  location: z.enum(['metro', 'tier2', 'tier3', 'rural']).optional()
    .describe('Living location type for cost-appropriate advice'),
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).optional()
    .describe('Investment risk preference'),
});

export type FinancialInsightsInput = z.infer<typeof FinancialInsightsInputSchema>;

const FinancialInsightsOutputSchema = z.object({
  personalizedGreeting: z.string().describe('Personalized greeting based on user context'),
  financialHealthScore: z.number().min(0).max(100).describe('Overall financial health score'),
  keyInsights: z.array(z.string()).describe('3-5 key insights about the user\'s financial situation'),
  prioritizedRecommendations: z.array(z.object({
    category: z.string().describe('Category: emergency_fund, budgeting, saving, investing, debt, etc.'),
    title: z.string().describe('Short action title'),
    description: z.string().describe('Detailed actionable recommendation'),
    priority: z.enum(['high', 'medium', 'low']).describe('Priority level'),
    timeframe: z.string().describe('When to implement this (immediate, 1-3 months, 6+ months)')
  })).describe('Prioritized action items'),
  monthlyBudgetSuggestion: z.object({
    needs: z.number().describe('Suggested % for needs (rent, food, utilities)'),
    wants: z.number().describe('Suggested % for wants (entertainment, dining out)'),
    savings: z.number().describe('Suggested % for savings and investments'),
    reasoning: z.string().describe('Why this allocation makes sense for the user')
  }).describe('Personalized budget allocation suggestion'),
  specificTips: z.array(z.string()).describe('3-4 specific, actionable tips for the user\'s situation'),
  warningSignals: z.array(z.string()).optional().describe('Financial red flags to watch out for'),
  encouragement: z.string().describe('Motivational message tailored to user\'s situation')
});

export type FinancialInsightsOutput = z.infer<typeof FinancialInsightsOutputSchema>;

export async function generateFinancialInsights(
  input: FinancialInsightsInput
): Promise<FinancialInsightsOutput> {
  return financialInsightsFlow(input);
}

const financialInsightsPrompt = ai.definePrompt({
  name: 'enhancedFinancialInsightsPrompt',
  input: {schema: FinancialInsightsInputSchema},
  output: {schema: FinancialInsightsOutputSchema},
  prompt: `You are a highly experienced and empathetic financial advisor specializing in Indian personal finance. Your goal is to provide personalized, actionable, and encouraging financial advice.

**USER PROFILE:**
- Type: {{userType}}
- Age: {{age}}
- Dependents: {{dependents}}
- Monthly Money In: ₹{{income}}
- Monthly Expenses: ₹{{expenses}}
- Current Savings: ₹{{currentSavings}}
- Fixed Expenses: ₹{{monthlyFixedExpenses}}
- Location: {{location}}
- Risk Tolerance: {{riskTolerance}}

**FINANCIAL GOALS:**
{{financialGoals}}

**SPENDING PATTERNS:**
{{spendingPatterns}}

**INSTRUCTIONS FOR PERSONALIZED ADVICE:**

1. **Context-Aware Approach:**
   - For STUDENTS: Focus on budgeting basics, building good habits, managing irregular income (pocket money, part-time work), and preparing for future career
   - For PROFESSIONALS: Emphasize career growth investments, tax planning, systematic investments, emergency funds
   - For FREELANCERS: Address income volatility, business expenses, tax planning, irregular income management
   - For BUSINESS OWNERS: Consider business vs personal finances, growth investments, risk management
   - For RETIRED: Focus on preservation, regular income, healthcare costs, legacy planning

2. **Indian Context:**
   - Consider Indian investment options (SIP, PPF, ELSS, FD, etc.)
   - Factor in Indian cost structures and lifestyle
   - Include festival/wedding expenses in planning
   - Consider joint family obligations where relevant
   - Address inflation impact on Indian economy

3. **Age-Appropriate Advice:**
   - Under 25: Focus on learning, emergency fund, avoiding debt, building credit
   - 25-35: Career investments, marriage/home planning, systematic investing
   - 35-50: Peak earning optimization, children's education, retirement planning
   - 50+: Risk reduction, healthcare planning, retirement preparation

4. **Financial Health Scoring (0-100):**
   - Emergency fund adequacy (0-25 points)
   - Expense-to-income ratio (0-25 points)
   - Savings rate (0-25 points)
   - Financial goal clarity and progress (0-25 points)

5. **Prioritized Recommendations:**
   - HIGH priority: Emergency fund, debt clearance, basic insurance
   - MEDIUM priority: Systematic investing, tax optimization, skill development
   - LOW priority: Advanced investments, lifestyle upgrades

6. **Budget Suggestions (50/30/20 rule adaptation):**
   - Adjust percentages based on user type, age, and location
   - Students might need 60/20/20 (needs/wants/savings)
   - Young professionals: 50/30/20 (standard)
   - High earners: 45/25/30 (higher savings)

7. **Tone and Communication:**
   - Be encouraging and non-judgmental
   - Use simple, actionable language
   - Avoid financial jargon
   - Focus on progress, not perfection
   - Acknowledge the user's current efforts

8. **Specific, Actionable Tips:**
   - Include specific Indian apps, websites, or services
   - Mention exact investment amounts or percentages
   - Provide timeline-based action items
   - Include both short-term and long-term strategies

**IMPORTANT NOTES:**
- If savings rate is below 10%, focus heavily on expense optimization
- If no emergency fund exists, make this the top priority
- For students with irregular income, emphasize budgeting over investing
- For high earners, include tax-saving strategies
- Always consider the user's risk tolerance and goals
- Be realistic about Indian salary and cost structures

Provide comprehensive, personalized advice that the user can implement immediately.`,
});

const financialInsightsFlow = ai.defineFlow(
  {
    name: 'enhancedFinancialInsightsFlow',
    inputSchema: FinancialInsightsInputSchema,
    outputSchema: FinancialInsightsOutputSchema
  },
  async input => {
    const {output} = await financialInsightsPrompt(input);
    return output!;
  }
);
