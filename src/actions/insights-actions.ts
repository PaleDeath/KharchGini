'use server';

import { generateFinancialInsights as generateFinancialInsightsAI, type FinancialInsightsInput, type FinancialInsightsOutput } from '@/ai/flows/financial-insights';

export async function getFinancialInsightsAction(input: FinancialInsightsInput): Promise<{ success: boolean; insights?: FinancialInsightsOutput; error?: string }> {
  try {
    const insights = await generateFinancialInsightsAI(input);
    return { success: true, insights };
  } catch (error) {
    console.error("Error generating financial insights:", error);
    
    let errorMessage = "Failed to generate financial insights.";
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }

    return { success: false, error: errorMessage };
  }
}
