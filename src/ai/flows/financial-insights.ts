// src/ai/flows/financial-insights.ts
'use server';

/**
 * @fileOverview AI-powered flow that provides personalized financial insights and recommendations to users.
 *
 * - generateFinancialInsights - A function that generates financial insights based on user data.
 * - FinancialInsightsInput - The input type for the generateFinancialInsights function.
 * - FinancialInsightsOutput - The return type for the generateFinancialInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FinancialInsightsInputSchema = z.object({
  income: z.number().describe('The user\u2019s total income.'),
  expenses: z.number().describe('The user\u2019s total expenses.'),
  financialGoals: z
    .string()
    .describe('The user\u2019s financial goals, e.g., saving for a house.'),
  spendingPatterns: z
    .string()
    .describe('A description of the user\u2019s spending patterns.'),
});
export type FinancialInsightsInput = z.infer<typeof FinancialInsightsInputSchema>;

const FinancialInsightsOutputSchema = z.object({
  insights: z
    .string()
    .describe(
      'Personalized financial insights and recommendations based on the user data.'
    ),
});
export type FinancialInsightsOutput = z.infer<typeof FinancialInsightsOutputSchema>;

export async function generateFinancialInsights(
  input: FinancialInsightsInput
): Promise<FinancialInsightsOutput> {
  return financialInsightsFlow(input);
}

const financialInsightsPrompt = ai.definePrompt({
  name: 'financialInsightsPrompt',
  input: {schema: FinancialInsightsInputSchema},
  output: {schema: FinancialInsightsOutputSchema},
  prompt: `You are a personal financial advisor. Analyze the user's financial situation and provide personalized insights and recommendations.

  Income: {{income}}
  Expenses: {{expenses}}
  Financial Goals: {{financialGoals}}
  Spending Patterns: {{spendingPatterns}}

  Provide actionable advice to help the user achieve their financial goals.
  `,
});

const financialInsightsFlow = ai.defineFlow(
  {name: 'financialInsightsFlow', inputSchema: FinancialInsightsInputSchema, outputSchema: FinancialInsightsOutputSchema},
  async input => {
    const {output} = await financialInsightsPrompt(input);
    return output!;
  }
);
