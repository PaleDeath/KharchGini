'use server';

import { revalidatePath } from 'next/cache';
import { categorizeTransaction as categorizeTransactionAI } from '@/ai/flows/categorize-transaction';
import type { Transaction, TransactionType } from '@/lib/types';

// In a real app, this would interact with a database.
// For this prototype, we'll simulate actions.

export interface AddTransactionInput {
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
}

export async function addTransactionAction(input: AddTransactionInput): Promise<{ success: boolean; transaction?: Transaction; error?: string }> {
  try {
    // Simulate AI categorization
    const categorizationResult = await categorizeTransactionAI({ transactionDescription: input.description });
    
    const newTransaction: Transaction = {
      id: Date.now().toString(), // Simple ID generation
      ...input,
      category: categorizationResult.category,
    };

    // console.log('Transaction added (simulated):', newTransaction);
    revalidatePath('/transactions'); // Revalidate to update the list on the client
    revalidatePath('/dashboard');
    return { success: true, transaction: newTransaction };
  } catch (error) {
    console.error("Error adding transaction:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to add transaction" };
  }
}

export async function categorizeTransactionAction(transactionId: string, description: string): Promise<{ success: boolean; category?: string; error?: string }> {
  try {
    const result = await categorizeTransactionAI({ transactionDescription: description });
    // In a real app, update the transaction with transactionId in the DB here.
    // console.log(`Transaction ${transactionId} category updated to ${result.category} (simulated)`);
    revalidatePath('/transactions');
    return { success: true, category: result.category };
  } catch (error) {
    console.error("Error categorizing transaction:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to categorize transaction" };
  }
}

// Placeholder for future actions
export async function updateTransactionAction(transaction: Transaction): Promise<{ success: boolean; error?: string }> {
  // console.log('Transaction updated (simulated):', transaction);
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function deleteTransactionAction(transactionId: string): Promise<{ success: boolean; error?: string }> {
  // console.log('Transaction deleted (simulated):', transactionId);
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  return { success: true };
}
