'use server';

import { financialInsightsFlow } from '@/ai/flows/financial-insights';
import { categorizeTransactionFlow } from '@/ai/flows/categorize-transaction';
import type { FinancialInsightsInput, FinancialInsightsOutput } from '@/ai/flows/financial-insights';
import type { CategorizeTransactionInput, CategorizeTransactionOutput } from '@/ai/flows/categorize-transaction';

export async function getFinancialInsights(input: FinancialInsightsInput): Promise<FinancialInsightsOutput> {
  try {
    const result = await financialInsightsFlow(input);
    return result;
  } catch (error) {
    console.error('Error generating financial insights:', error);
    throw new Error('Failed to generate financial insights');
  }
}

export async function getTransactionCategory(input: CategorizeTransactionInput): Promise<CategorizeTransactionOutput> {
  try {
    const result = await categorizeTransactionFlow(input);
    return result;
  } catch (error) {
    console.error('Error categorizing transaction:', error);
    throw new Error('Failed to categorize transaction');
  }
}
