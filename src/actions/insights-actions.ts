'use server';

// Temporarily disabled due to Genkit Node.js module conflicts
// import { generateFinancialInsights as generateFinancialInsightsAI, type FinancialInsightsInput, type FinancialInsightsOutput } from '@/ai/flows/financial-insights';

// Temporarily disabled due to Genkit Node.js module conflicts
export async function getFinancialInsightsAction(input: any): Promise<{ success: boolean; insights?: any; error?: string }> {
  try {
    // Return fallback insights
    return {
      success: true,
      insights: {
        summary: "Financial insights temporarily unavailable due to system maintenance.",
        recommendations: [],
        alerts: [],
        trends: []
      }
    };
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
