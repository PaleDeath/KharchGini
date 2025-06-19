'use client';

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  onSnapshot,
  writeBatch,
  getFirestore
} from 'firebase/firestore';
import { db } from './firebase';
import type { Transaction, FinancialGoal, Budget, BudgetSummary, RecurringTransaction, RecurringFrequency } from '@/lib/types';

// ============ TRANSACTIONS ============

export async function addTransaction(userId: string, transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
  try {
    const docRef = await addDoc(collection(db, 'users', userId, 'transactions'), transaction);
    
    return {
      id: docRef.id,
      ...transaction
    };
  } catch (error) {
    console.error('Error adding transaction:', error);
    throw new Error('Failed to add transaction');
  }
}

export async function getTransactions(userId: string): Promise<Transaction[]> {
  try {
    const q = query(
      collection(db, 'users', userId, 'transactions'),
      orderBy('date', 'desc'),
      limit(100) // Limit to recent 100 transactions
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Remove Firestore Timestamp objects that can't be serialized to client
      const { createdAt, updatedAt, ...cleanData } = data;
      return {
        id: doc.id,
        ...cleanData
      } as Transaction;
    });
  } catch (error) {
    console.error('Error getting transactions:', error);
    throw new Error('Failed to get transactions');
  }
}

export async function updateTransaction(userId: string, transactionId: string, updates: Partial<Transaction>): Promise<void> {
  try {
    const docRef = doc(db, 'users', userId, 'transactions', transactionId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    throw new Error('Failed to update transaction');
  }
}

export async function deleteTransaction(userId: string, transactionId: string): Promise<void> {
  try {
    const docRef = doc(db, 'users', userId, 'transactions', transactionId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting transaction:', error);
    throw new Error('Failed to delete transaction');
  }
}

// ============ FINANCIAL GOALS ============

export async function addGoal(userId: string, goal: Omit<FinancialGoal, 'id'>): Promise<FinancialGoal> {
  try {
    // Filter out undefined values to prevent Firebase errors
    const cleanGoalData = Object.fromEntries(
      Object.entries(goal).filter(([_, value]) => value !== undefined)
    );

    const docRef = await addDoc(collection(db, 'users', userId, 'goals'), {
      ...cleanGoalData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    return {
      id: docRef.id,
      ...goal
    };
  } catch (error) {
    console.error('Error adding goal:', error);
    throw new Error('Failed to add goal');
  }
}

export async function getGoals(userId: string): Promise<FinancialGoal[]> {
  try {
    const q = query(
      collection(db, 'users', userId, 'goals'),
      orderBy('createdAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Remove Firestore Timestamp objects that can't be serialized to client
      const { createdAt, updatedAt, ...cleanData } = data;
      return {
        id: doc.id,
        ...cleanData
      } as FinancialGoal;
    });
  } catch (error) {
    console.error('Error getting goals:', error);
    throw new Error('Failed to get goals');
  }
}

export async function updateGoal(userId: string, goalId: string, updates: Partial<FinancialGoal>): Promise<void> {
  try {
    // Filter out undefined values to prevent Firebase errors
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );

    const docRef = doc(db, 'users', userId, 'goals', goalId);
    await updateDoc(docRef, {
      ...cleanUpdates,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating goal:', error);
    throw new Error('Failed to update goal');
  }
}

export async function deleteGoal(userId: string, goalId: string): Promise<void> {
  try {
    const docRef = doc(db, 'users', userId, 'goals', goalId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting goal:', error);
    throw new Error('Failed to delete goal');
  }
}

// ============ ANALYTICS HELPERS ============

export async function getTransactionsByType(userId: string, type: 'income' | 'expense'): Promise<Transaction[]> {
  try {
    const q = query(
      collection(db, 'users', userId, 'transactions'),
      where('type', '==', type),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Remove Firestore Timestamp objects that can't be serialized to client
      const { createdAt, updatedAt, ...cleanData } = data;
      return {
        id: doc.id,
        ...cleanData
      } as Transaction;
    });
  } catch (error) {
    console.error('Error getting transactions by type:', error);
    throw new Error('Failed to get transactions by type');
  }
}

export async function getTransactionsByCategory(userId: string, category: string): Promise<Transaction[]> {
  try {
    const q = query(
      collection(db, 'users', userId, 'transactions'),
      where('category', '==', category),
      orderBy('date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Remove Firestore Timestamp objects that can't be serialized to client
      const { createdAt, updatedAt, ...cleanData } = data;
      return {
        id: doc.id,
        ...cleanData
      } as Transaction;
    });
  } catch (error) {
    console.error('Error getting transactions by category:', error);
    throw new Error('Failed to get transactions by category');
  }
}

// BUDGET FUNCTIONS

export async function addBudget(userId: string, budget: Omit<Budget, 'id' | 'spentAmount' | 'createdAt' | 'updatedAt'>): Promise<Budget> {
  try {
    const budgetsRef = collection(db, 'users', userId, 'budgets');
    const now = new Date().toISOString();
    
    const budgetData = {
      ...budget,
      spentAmount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(budgetsRef, budgetData);
    
    return {
      id: docRef.id,
      ...budgetData,
    };
  } catch (error) {
    console.error('Error adding budget:', error);
    throw new Error('Failed to add budget');
  }
}

export async function getBudgets(userId: string, month?: string): Promise<Budget[]> {
  try {
    const budgetsRef = collection(db, 'users', userId, 'budgets');
    let q = query(budgetsRef, orderBy('category', 'asc'));
    
    if (month) {
      q = query(budgetsRef, where('month', '==', month), orderBy('category', 'asc'));
    }

    const querySnapshot = await getDocs(q);
    const budgets: Budget[] = [];

    querySnapshot.forEach((doc) => {
      budgets.push({
        id: doc.id,
        ...doc.data(),
      } as Budget);
    });

    return budgets;
  } catch (error) {
    console.error('Error getting budgets:', error);
    throw new Error('Failed to get budgets');
  }
}

export async function updateBudget(userId: string, budgetId: string, updates: Partial<Budget>): Promise<void> {
  try {
    const budgetRef = doc(db, 'users', userId, 'budgets', budgetId);
    await updateDoc(budgetRef, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating budget:', error);
    throw new Error('Failed to update budget');
  }
}

export async function deleteBudget(userId: string, budgetId: string): Promise<void> {
  try {
    const budgetRef = doc(db, 'users', userId, 'budgets', budgetId);
    await deleteDoc(budgetRef);
  } catch (error) {
    console.error('Error deleting budget:', error);
    throw new Error('Failed to delete budget');
  }
}

export async function updateBudgetSpending(userId: string, month: string): Promise<void> {
  try {
    // Get all transactions for the month
    const transactions = await getTransactionsByMonth(userId, month);
    const expenseTransactions = transactions.filter(t => t.type === 'expense');

    // Get all budgets for the month
    const budgets = await getBudgets(userId, month);

    // Calculate spending by category
    const spendingByCategory: Record<string, number> = {};
    expenseTransactions.forEach(transaction => {
      const category = transaction.category || 'Uncategorized';
      spendingByCategory[category] = (spendingByCategory[category] || 0) + transaction.amount;
    });

    // Update budget spent amounts
    const batch = writeBatch(db);
    budgets.forEach(budget => {
      const spentAmount = spendingByCategory[budget.category] || 0;
      const budgetRef = doc(db, 'users', userId, 'budgets', budget.id);
      batch.update(budgetRef, {
        spentAmount,
        updatedAt: new Date().toISOString(),
      });
    });

    await batch.commit();
  } catch (error) {
    console.error('Error updating budget spending:', error);
    throw new Error('Failed to update budget spending');
  }
}

export async function getBudgetSummary(userId: string, month: string): Promise<BudgetSummary> {
  try {
    const budgets = await getBudgets(userId, month);
    
    const totalBudget = budgets.reduce((sum, budget) => sum + budget.budgetAmount, 0);
    const totalSpent = budgets.reduce((sum, budget) => sum + budget.spentAmount, 0);
    const totalRemaining = totalBudget - totalSpent;
    
    const categoriesOverBudget = budgets.filter(budget => budget.spentAmount > budget.budgetAmount).length;
    const categoriesOnTrack = budgets.filter(budget => budget.spentAmount <= budget.budgetAmount).length;

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      categoriesOverBudget,
      categoriesOnTrack,
    };
  } catch (error) {
    console.error('Error getting budget summary:', error);
    throw new Error('Failed to get budget summary');
  }
}

// Helper function to get transactions by month
export async function getTransactionsByMonth(userId: string, month: string): Promise<Transaction[]> {
  try {
    const transactionsRef = collection(db, 'users', userId, 'transactions');
    const startDate = `${month}-01`;
    const endDate = `${month}-31`; // Simple approach, good enough for filtering

    const q = query(
      transactionsRef,
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const transactions: Transaction[] = [];

    querySnapshot.forEach((doc) => {
      transactions.push({
        id: doc.id,
        ...doc.data(),
      } as Transaction);
    });

    return transactions;
  } catch (error) {
    console.error('Error getting transactions by month:', error);
    throw new Error('Failed to get transactions by month');
  }
}

// ============ RECURRING TRANSACTIONS ============

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

// ============ BULK OPERATIONS ============

export async function bulkDeleteTransactions(userId: string, transactionIds: string[]): Promise<void> {
  if (transactionIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const transactionId of transactionIds) {
      const transactionRef = doc(db, 'users', userId, 'transactions', transactionId);
      batch.delete(transactionRef);
    }
    await batch.commit();
  } catch (error) {
    console.error('Error bulk deleting transactions:', error);
    throw new Error('Failed to bulk delete transactions');
  }
}

export async function bulkUpdateTransactionCategory(userId: string, transactionIds: string[], category: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    
    for (const transactionId of transactionIds) {
      const transactionRef = doc(db, 'users', userId, 'transactions', transactionId);
      batch.update(transactionRef, { 
        category,
        updatedAt: Timestamp.now()
      });
    }
    
    await batch.commit();
  } catch (error) {
    console.error('Error bulk updating transaction categories:', error);
    throw new Error('Failed to bulk update transaction categories');
  }
}

/**
 * Performs a bulk update on multiple transactions with different data for each.
 * @param userId - The ID of the user.
 * @param updates - An array of objects, each with a transaction ID and the data to update.
 */
export async function bulkUpdateTransactions(userId: string, updates: { id: string; data: Partial<Transaction> }[]): Promise<void> {
  if (updates.length === 0) return;
  try {
    const batch = writeBatch(db);
    updates.forEach(update => {
      const docRef = doc(db, 'users', userId, 'transactions', update.id);
      batch.update(docRef, update.data);
    });
    await batch.commit();
  } catch (error) {
    console.error('Error bulk updating transactions:', error);
    throw new Error('Failed to bulk update transactions');
  }
} 