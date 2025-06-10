'use server';

import { categorizeTransaction as categorizeTransactionAI } from '@/ai/flows/categorize-transaction';

// Server action for AI categorization only
export async function categorizeTransactionAction(description: string): Promise<{ success: boolean; category?: string; confidence?: number; error?: string }> {
  try {
    const result = await categorizeTransactionAI({ transactionDescription: description });
    return { 
      success: true, 
      category: result.category,
      confidence: result.confidence 
    };
  } catch (error) {
    console.error("Error categorizing transaction:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to categorize transaction" };
  }
}
