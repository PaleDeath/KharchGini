'use server';

import { categorizeTransaction } from '@/ai/flows/categorize-transaction';
import type { Transaction } from '@/lib/types';

// Simple rule-based categorization fallback
function categorizeTransactionFallback(description: string): { category: string; confidence: number; reasoning: string } {
  const desc = description.toLowerCase();

  // Food & Dining
  if (desc.includes('zomato') || desc.includes('swiggy') || desc.includes('restaurant') ||
      desc.includes('food') || desc.includes('cafe') || desc.includes('grocery') ||
      desc.includes('supermarket') || desc.includes('dining')) {
    return { category: 'Food & Dining', confidence: 0.85, reasoning: 'Matched keywords for food/dining' };
  }

  // Transportation
  if (desc.includes('uber') || desc.includes('ola') || desc.includes('petrol') ||
      desc.includes('fuel') || desc.includes('metro') || desc.includes('bus') ||
      desc.includes('auto') || desc.includes('taxi') || desc.includes('transport')) {
    return { category: 'Transportation', confidence: 0.85, reasoning: 'Matched keywords for transportation' };
  }

  // Shopping
  if (desc.includes('amazon') || desc.includes('flipkart') || desc.includes('myntra') ||
      desc.includes('shopping') || desc.includes('clothes') || desc.includes('electronics')) {
    return { category: 'Shopping', confidence: 0.85, reasoning: 'Matched keywords for shopping' };
  }

  // Bills & Utilities
  if (desc.includes('electricity') || desc.includes('water') || desc.includes('gas') ||
      desc.includes('mobile') || desc.includes('internet') || desc.includes('recharge') ||
      desc.includes('bill') || desc.includes('utility')) {
    return { category: 'Bills & Utilities', confidence: 0.85, reasoning: 'Matched keywords for utilities' };
  }

  // Healthcare
  if (desc.includes('hospital') || desc.includes('doctor') || desc.includes('medicine') ||
      desc.includes('pharmacy') || desc.includes('health') || desc.includes('medical')) {
    return { category: 'Healthcare', confidence: 0.85, reasoning: 'Matched keywords for healthcare' };
  }

  // Entertainment
  if (desc.includes('movie') || desc.includes('netflix') || desc.includes('hotstar') ||
      desc.includes('entertainment') || desc.includes('game') || desc.includes('subscription')) {
    return { category: 'Entertainment', confidence: 0.85, reasoning: 'Matched keywords for entertainment' };
  }

  // ATM/Cash
  if (desc.includes('atm') || desc.includes('cash') || desc.includes('withdrawal')) {
    return { category: 'Miscellaneous', confidence: 0.7, reasoning: 'Matched keywords for cash' };
  }

  // Default
  return { category: 'Miscellaneous', confidence: 0.5, reasoning: 'Default fallback' };
}

// Server action for AI categorization
export async function categorizeTransactionAction(
  description: string,
  amount: number = 0,
  date: string = new Date().toISOString()
): Promise<{ success: boolean; category: string; confidence: number; reasoning?: string; error?: string }> {
  try {
    // Try AI first
    try {
      const result = await categorizeTransaction({
        description,
        amount,
        date
      });
      return {
        success: true,
        category: result.category,
        confidence: result.confidence,
        reasoning: result.reasoning
      };
    } catch (aiError) {
      console.warn("AI categorization failed, falling back to rules:", aiError);
      // Fallback to rules
      const fallbackResult = categorizeTransactionFallback(description);
      return {
        success: true,
        category: fallbackResult.category,
        confidence: fallbackResult.confidence,
        reasoning: fallbackResult.reasoning
      };
    }
  } catch (error) {
    console.error("Error categorizing transaction:", error);
    return {
      success: false,
      category: 'Miscellaneous',
      confidence: 0,
      error: error instanceof Error ? error.message : "Failed to categorize transaction"
    };
  }
}

// Server action for bulk AI categorization of uncategorized transactions
export async function bulkCategorizeUncategorizedAction(
  uncategorizedTransactions: Transaction[]
): Promise<{
  success: boolean;
  categorizedCount: number;
  categorizedTransactions: { id: string; category: string }[];
  error?: string
}> {
  try {
    if (uncategorizedTransactions.length === 0) {
      return { success: true, categorizedCount: 0, categorizedTransactions: [] };
    }

    const categorizedTransactions: { id: string; category: string }[] = [];

    // Process in parallel with concurrency limit (e.g. 5) to avoid rate limits
    const BATCH_SIZE = 5;
    for (let i = 0; i < uncategorizedTransactions.length; i += BATCH_SIZE) {
      const batch = uncategorizedTransactions.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (transaction) => {
        try {
          // We can use the single categorization action for consistency
          const result = await categorizeTransactionAction(
            transaction.description,
            transaction.amount,
            transaction.date
          );

          if (result.success && result.category && result.confidence >= 0.5) {
            categorizedTransactions.push({
              id: transaction.id,
              category: result.category
            });
          }
        } catch (e) {
          console.error(`Failed to categorize transaction ${transaction.id}:`, e);
        }
      }));
    }

    return {
      success: true,
      categorizedCount: categorizedTransactions.length,
      categorizedTransactions
    };
  } catch (error) {
    console.error("Error bulk categorizing transactions:", error);
    return { success: false, categorizedCount: 0, categorizedTransactions: [], error: error instanceof Error ? error.message : "Failed to bulk categorize transactions" };
  }
}
