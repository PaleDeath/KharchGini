import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type { Budget, BudgetSummary } from '@/lib/types';
import { getTransactionsByMonth } from './transactions';

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
