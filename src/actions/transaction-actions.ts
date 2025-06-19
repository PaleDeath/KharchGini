'use server';

// Temporarily disabled due to Genkit Node.js module conflicts
// import { categorizeTransaction as categorizeTransactionAI } from '@/ai/flows/categorize-transaction';
import type { Transaction } from '@/lib/types';

// Server action for AI categorization only (temporarily using fallback)
export async function categorizeTransactionAction(description: string): Promise<{ success: boolean; category?: string; confidence?: number; error?: string }> {
  try {
    // Temporarily using fallback categorization due to Genkit Node.js module conflicts
    const result = categorizeTransactionFallback(description);
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

// Simple rule-based categorization fallback
function categorizeTransactionFallback(description: string): { category: string; confidence: number } {
  const desc = description.toLowerCase();

  // Food & Dining
  if (desc.includes('zomato') || desc.includes('swiggy') || desc.includes('restaurant') ||
      desc.includes('food') || desc.includes('cafe') || desc.includes('grocery') ||
      desc.includes('supermarket') || desc.includes('dining')) {
    return { category: 'Food & Dining', confidence: 0.85 };
  }

  // Transportation
  if (desc.includes('uber') || desc.includes('ola') || desc.includes('petrol') ||
      desc.includes('fuel') || desc.includes('metro') || desc.includes('bus') ||
      desc.includes('auto') || desc.includes('taxi') || desc.includes('transport')) {
    return { category: 'Transportation', confidence: 0.85 };
  }

  // Shopping
  if (desc.includes('amazon') || desc.includes('flipkart') || desc.includes('myntra') ||
      desc.includes('shopping') || desc.includes('clothes') || desc.includes('electronics')) {
    return { category: 'Shopping', confidence: 0.85 };
  }

  // Bills & Utilities
  if (desc.includes('electricity') || desc.includes('water') || desc.includes('gas') ||
      desc.includes('mobile') || desc.includes('internet') || desc.includes('recharge') ||
      desc.includes('bill') || desc.includes('utility')) {
    return { category: 'Bills & Utilities', confidence: 0.85 };
  }

  // Healthcare
  if (desc.includes('hospital') || desc.includes('doctor') || desc.includes('medicine') ||
      desc.includes('pharmacy') || desc.includes('health') || desc.includes('medical')) {
    return { category: 'Healthcare', confidence: 0.85 };
  }

  // Entertainment
  if (desc.includes('movie') || desc.includes('netflix') || desc.includes('hotstar') ||
      desc.includes('entertainment') || desc.includes('game') || desc.includes('subscription')) {
    return { category: 'Entertainment', confidence: 0.85 };
  }

  // ATM/Cash
  if (desc.includes('atm') || desc.includes('cash') || desc.includes('withdrawal')) {
    return { category: 'Miscellaneous', confidence: 0.7 };
  }

  // Default
  return { category: 'Miscellaneous', confidence: 0.5 };
}

// Server action for bulk AI categorization of uncategorized transactions
export async function bulkCategorizeUncategorizedAction(uncategorizedTransactions: Transaction[]): Promise<{ success: boolean; categorizedCount?: number; categorizedTransactions?: { id: string; category: string }[]; error?: string }> {
  try {
    if (uncategorizedTransactions.length === 0) {
      return { success: true, categorizedCount: 0 };
    }

    const categorizedTransactions: { id: string; category: string }[] = [];

    // Process in parallel
    await Promise.all(uncategorizedTransactions.map(async (transaction) => {
      try {
        const result = categorizeTransactionFallback(transaction.description);
        // Only update if confidence is medium or high
        if (result.category && result.confidence && result.confidence >= 0.5) {
          categorizedTransactions.push({
            id: transaction.id,
            category: result.category
          });
        }
      } catch (e) {
        console.error(`Failed to categorize transaction ${transaction.id}:`, e);
        // Continue even if one fails
      }
    }));

    return { success: true, categorizedCount: categorizedTransactions.length, categorizedTransactions };
  } catch (error) {
    console.error("Error bulk categorizing transactions:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to bulk categorize transactions" };
  }
}
