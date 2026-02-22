'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getTransactions } from '@/services/transactions';
import { getGoals } from '@/services/goals';
import { getBudgets, getBudgetSummary, updateBudgetSpending } from '@/services/budgets';
import { getRecurringTransactions, processRecurringTransactions } from '@/services/recurring';
import type { Transaction, FinancialGoal, Budget, BudgetSummary, RecurringTransaction } from '@/lib/types';
import type { DocumentSnapshot } from 'firebase/firestore';

// Hook for loading transactions with pagination
export function useTransactions(initialLimit = 20) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
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
        const result = await getTransactions(user!.uid, initialLimit);
        setTransactions(result.transactions);
        setLastDoc(result.lastDoc);
        setHasMore(result.transactions.length === initialLimit);
      } catch (err) {
        console.error('Error loading transactions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load transactions');
      } finally {
        setLoading(false);
      }
    }

    loadTransactions();
  }, [user?.uid, initialLimit]);

  const loadMore = async () => {
    if (!user?.uid || !lastDoc || loadingMore) return;

    try {
      setLoadingMore(true);
      const result = await getTransactions(user.uid, initialLimit, lastDoc);

      if (result.transactions.length > 0) {
        setTransactions(prev => [...prev, ...result.transactions]);
        setLastDoc(result.lastDoc);
        setHasMore(result.transactions.length === initialLimit);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more transactions:', err);
      // Don't set main error, just log or maybe show toast
    } finally {
      setLoadingMore(false);
    }
  };

  const refreshTransactions = async () => {
    if (!user?.uid) return;
    
    try {
      setError(null);
      // Reset to initial state
      const result = await getTransactions(user.uid, initialLimit);
      setTransactions(result.transactions);
      setLastDoc(result.lastDoc);
      setHasMore(result.transactions.length === initialLimit);
    } catch (err) {
      console.error('Error refreshing transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh transactions');
    }
  };

  return {
    transactions,
    loading,
    loadingMore,
    hasMore,
    error,
    refreshTransactions,
    loadMore,
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
