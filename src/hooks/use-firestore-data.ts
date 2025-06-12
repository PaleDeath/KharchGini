'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getTransactions, getGoals, getBudgets, getBudgetSummary, updateBudgetSpending, getRecurringTransactions, processRecurringTransactions } from '@/lib/firebase/firestore';
import type { Transaction, FinancialGoal, Budget, BudgetSummary, RecurringTransaction } from '@/lib/types';

// Hook for loading transactions
export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    async function loadTransactions() {
      try {
        setLoading(true);
        setError(null);
        const data = await getTransactions(user!.uid);
        setTransactions(data);
      } catch (err) {
        console.error('Error loading transactions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load transactions');
      } finally {
        setLoading(false);
      }
    }

    loadTransactions();
  }, [user?.uid]);

  const refreshTransactions = async () => {
    if (!user?.uid) return;
    
    try {
      setError(null);
      const data = await getTransactions(user.uid);
      setTransactions(data);
    } catch (err) {
      console.error('Error refreshing transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh transactions');
    }
  };

  return {
    transactions,
    loading,
    error,
    refreshTransactions,
    setTransactions // For optimistic updates
  };
}

// Hook for loading financial goals
export function useGoals() {
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.uid) {
      loadGoals();
    } else {
      setGoals([]);
      setLoading(false);
      setError(null);
    }
  }, [user?.uid]);

  async function loadGoals() {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      setError(null);
      const goalsData = await getGoals(user.uid);
      setGoals(goalsData);
    } catch (err) {
      console.error('Error loading goals:', err);
      setError('Failed to load goals');
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }

  const refreshGoals = async () => {
    if (user?.uid) {
      await loadGoals();
    }
  };

  return {
    goals,
    loading,
    error,
    refreshGoals,
  };
}

export function useBudgets(month?: string) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user?.uid) {
      loadBudgets();
    } else {
      setBudgets([]);
      setLoading(false);
      setError(null);
    }
  }, [user?.uid, month]);

  async function loadBudgets() {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      setError(null);
      const budgetsData = await getBudgets(user.uid, month);
      setBudgets(budgetsData);
    } catch (err) {
      console.error('Error loading budgets:', err);
      setError('Failed to load budgets');
      setBudgets([]);
    } finally {
      setLoading(false);
    }
  }

  const refreshBudgets = async () => {
    if (user?.uid) {
      await loadBudgets();
    }
  };

  const updateBudgetsWithSpending = async (targetMonth: string) => {
    if (user?.uid) {
      try {
        await updateBudgetSpending(user.uid, targetMonth);
        await loadBudgets(); // Refresh after update
      } catch (err) {
        console.error('Error updating budget spending:', err);
        setError('Failed to update budget spending');
      }
    }
  };

  return {
    budgets,
    loading,
    error,
    refreshBudgets,
    updateBudgetsWithSpending,
  };
}

export function useBudgetSummary(month: string) {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid || !month) {
      setSummary(null);
      setLoading(false);
      return;
    }

    async function loadBudgetSummary() {
      try {
        setLoading(true);
        setError(null);
        const data = await getBudgetSummary(user!.uid, month);
        setSummary(data);
      } catch (err) {
        console.error('Error loading budget summary:', err);
        setError(err instanceof Error ? err.message : 'Failed to load budget summary');
      } finally {
        setLoading(false);
      }
    }

    loadBudgetSummary();
  }, [user?.uid, month]);

  const refreshSummary = async () => {
    if (!user?.uid || !month) return;
    
    try {
      setError(null);
      const data = await getBudgetSummary(user.uid, month);
      setSummary(data);
    } catch (err) {
      console.error('Error refreshing budget summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh budget summary');
    }
  };

  return {
    summary,
    loading,
    error,
    refreshSummary,
  };
}

// Hook for loading recurring transactions
export function useRecurringTransactions() {
  const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid) {
      setRecurringTransactions([]);
      setLoading(false);
      return;
    }

    async function loadRecurringTransactions() {
      try {
        setLoading(true);
        setError(null);
        const data = await getRecurringTransactions(user!.uid);
        setRecurringTransactions(data);
      } catch (err) {
        console.error('Error loading recurring transactions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load recurring transactions');
      } finally {
        setLoading(false);
      }
    }

    loadRecurringTransactions();
  }, [user?.uid]);

  const refreshRecurringTransactions = async () => {
    if (!user?.uid) return;
    
    try {
      setError(null);
      const data = await getRecurringTransactions(user.uid);
      setRecurringTransactions(data);
    } catch (err) {
      console.error('Error refreshing recurring transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh recurring transactions');
    }
  };

  const processRecurringTransactionsNow = async () => {
    if (!user?.uid) return 0;
    
    try {
      const processedCount = await processRecurringTransactions(user.uid);
      if (processedCount > 0) {
        // Refresh both recurring transactions and regular transactions
        await refreshRecurringTransactions();
      }
      return processedCount;
    } catch (err) {
      console.error('Error processing recurring transactions:', err);
      throw err;
    }
  };

  return {
    recurringTransactions,
    loading,
    error,
    refreshRecurringTransactions,
    processRecurringTransactionsNow,
  };
} 