import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type { RecurringTransaction, RecurringFrequency } from '@/lib/types';

export async function addRecurringTransaction(userId: string, recurringTransaction: Omit<RecurringTransaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<RecurringTransaction> {
  try {
    const now = new Date().toISOString();

    // Filter out undefined values for Firebase
    const cleanData = Object.fromEntries(
      Object.entries(recurringTransaction).filter(([_, value]) => value !== undefined)
    );

    const docRef = await addDoc(collection(db, 'users', userId, 'recurringTransactions'), {
      ...cleanData,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: docRef.id,
      ...recurringTransaction,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    console.error('Error adding recurring transaction:', error);
    throw new Error('Failed to add recurring transaction');
  }
}

export async function getRecurringTransactions(userId: string): Promise<RecurringTransaction[]> {
  try {
    const q = query(
      collection(db, 'users', userId, 'recurringTransactions'),
      orderBy('nextDueDate', 'asc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      const { createdAt, updatedAt, ...cleanData } = data;
      return {
        id: doc.id,
        ...cleanData
      } as RecurringTransaction;
    });
  } catch (error) {
    console.error('Error getting recurring transactions:', error);
    throw new Error('Failed to get recurring transactions');
  }
}

export async function updateRecurringTransaction(userId: string, recurringTransactionId: string, updates: Partial<RecurringTransaction>): Promise<void> {
  try {
    const docRef = doc(db, 'users', userId, 'recurringTransactions', recurringTransactionId);

    // Filter out undefined values for Firebase
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    await updateDoc(docRef, {
      ...cleanUpdates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating recurring transaction:', error);
    throw new Error('Failed to update recurring transaction');
  }
}

export async function deleteRecurringTransaction(userId: string, recurringTransactionId: string): Promise<void> {
  try {
    const docRef = doc(db, 'users', userId, 'recurringTransactions', recurringTransactionId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting recurring transaction:', error);
    throw new Error('Failed to delete recurring transaction');
  }
}

// Helper function to calculate next due date based on frequency
export function calculateNextDueDate(currentDate: string, frequency: RecurringFrequency): string {
  const date = new Date(currentDate);

  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
}

// Process recurring transactions and create new transactions
export async function processRecurringTransactions(userId: string): Promise<number> {
  try {
    const recurringTransactions = await getRecurringTransactions(userId);
    const today = new Date().toISOString().split('T')[0];
    const batch = writeBatch(db);
    let processedCount = 0;

    for (const recurring of recurringTransactions) {
      if (!recurring.isActive) continue;

      // Check if transaction is due
      if (recurring.nextDueDate <= today) {
        // Check if we've reached the end date
        if (recurring.endDate && recurring.nextDueDate > recurring.endDate) {
          // Deactivate recurring transaction
          const recurringRef = doc(db, 'users', userId, 'recurringTransactions', recurring.id);
          batch.update(recurringRef, {
            isActive: false,
            updatedAt: new Date().toISOString(),
          });
          continue;
        }

        // Create new transaction
        const newTransactionRef = doc(collection(db, 'users', userId, 'transactions'));
        batch.set(newTransactionRef, {
          date: recurring.nextDueDate,
          description: recurring.description,
          amount: recurring.amount,
          type: recurring.type,
          category: recurring.category,
          recurringTransactionId: recurring.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Update recurring transaction with next due date
        const nextDueDate = calculateNextDueDate(recurring.nextDueDate, recurring.frequency);
        const recurringRef = doc(db, 'users', userId, 'recurringTransactions', recurring.id);
        batch.update(recurringRef, {
          nextDueDate,
          lastExecuted: recurring.nextDueDate,
          updatedAt: new Date().toISOString(),
        });

        processedCount++;
      }
    }

    if (processedCount > 0) {
      await batch.commit();
    }

    return processedCount;
  } catch (error) {
    console.error('Error processing recurring transactions:', error);
    throw new Error('Failed to process recurring transactions');
  }
}
