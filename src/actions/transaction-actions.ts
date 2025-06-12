'use server';

import { categorizeTransaction as categorizeTransactionAI } from '@/ai/flows/categorize-transaction';
import { getTransactions, bulkUpdateTransactions } from '@/lib/firebase/firestore';
import type { Transaction } from '@/lib/types';

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

// Server action for bulk AI categorization of uncategorized transactions
export async function bulkCategorizeUncategorizedAction(userId: string): Promise<{ success: boolean; categorizedCount?: number; error?: string }> {
  try {
    const allTransactions = await getTransactions(userId);
    const uncategorized = allTransactions.filter(t => !t.category);

    if (uncategorized.length === 0) {
      return { success: true, categorizedCount: 0 };
    }

    const updates: { id: string; data: Partial<Transaction> }[] = [];
    
    // Process in parallel
    await Promise.all(uncategorized.map(async (transaction) => {
      try {
        const result = await categorizeTransactionAI({ transactionDescription: transaction.description });
        // Only update if confidence is medium or high
        if (result.category && result.confidence && result.confidence >= 0.5) {
          updates.push({
            id: transaction.id,
            data: { category: result.category }
          });
        }
      } catch (e) {
        console.error(`Failed to categorize transaction ${transaction.id}:`, e);
        // Continue even if one fails
      }
    }));

    if (updates.length > 0) {
      await bulkUpdateTransactions(userId, updates);
    }

    return { success: true, categorizedCount: updates.length };
  } catch (error) {
    console.error("Error bulk categorizing transactions:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to bulk categorize transactions" };
  }
}
