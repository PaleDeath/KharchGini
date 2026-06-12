'use client';

import { writeBatch, doc, collection, serverTimestamp, increment, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { Transaction } from '@/lib/types';
import { ParsedRow } from '@/lib/csvParser';
import { z } from 'zod';

// Define schema for validation
const TransactionSchema = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.number(),
  type: z.enum(['income', 'expense']),
  category: z.string(),
});

type ImportInput = ParsedRow & { category: string };

export async function importTransactions(userId: string, transactions: ImportInput[]): Promise<{ success: number; failed: number; errors: string[] }> {
  if (!userId) return { success: 0, failed: transactions.length, errors: ['User ID required'] };
  if (transactions.length === 0) return { success: 0, failed: 0, errors: [] };

  const errors: string[] = [];
  let successCount = 0;
  let failedCount = 0;

  // Validate transactions
  const validTransactions: ImportInput[] = [];
  transactions.forEach((tx, idx) => {
    const result = TransactionSchema.safeParse({
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      category: tx.category
    });

    if (result.success) {
      validTransactions.push(tx);
    } else {
      failedCount++;
      errors.push(`Row ${idx + 1}: Invalid data - ${result.error.message}`);
    }
  });

  if (validTransactions.length === 0) {
    return { success: 0, failed: failedCount, errors };
  }

  // Batch writes
  const BATCH_SIZE = 450; // Safety margin below 500
  const chunks = [];
  for (let i = 0; i < validTransactions.length; i += BATCH_SIZE) {
    chunks.push(validTransactions.slice(i, i + BATCH_SIZE));
  }

  try {
    for (const chunk of chunks) {
      const batch = writeBatch(db);

      chunk.forEach(tx => {
        const ref = doc(collection(db, 'users', userId, 'transactions'));
        batch.set(ref, {
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          category: tx.category,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          // Store original data as separate fields or map?
          // Firestore allows dynamic fields.
          source: 'csv_import',
          originalDescription: tx.originalDescription,
          rawDate: tx.rawDate,
          balance: tx.balance
        });
      });

      await batch.commit();
      successCount += chunk.length;
    }

    // Update user stats
    const userRef = doc(db, 'users', userId);
    try {
      await updateDoc(userRef, {
        lastImportAt: serverTimestamp(),
        totalImported: increment(successCount)
      });
    } catch (e) {
      console.warn("Failed to update user stats (doc might not exist):", e);
    }

  } catch (error) {
    console.error("Import error:", error);
    return {
      success: successCount,
      failed: failedCount + (validTransactions.length - successCount),
      errors: [...errors, error instanceof Error ? error.message : "Batch write error"]
    };
  }

  return { success: successCount, failed: failedCount, errors };
}
