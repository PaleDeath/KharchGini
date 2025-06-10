'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getTransactions, getGoals } from '@/lib/firebase/firestore';
import type { Transaction, FinancialGoal } from '@/lib/types';

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
    if (!user?.uid) {
      setGoals([]);
      setLoading(false);
      return;
    }

    async function loadGoals() {
      try {
        setLoading(true);
        setError(null);
        const data = await getGoals(user!.uid);
        setGoals(data);
      } catch (err) {
        console.error('Error loading goals:', err);
        setError(err instanceof Error ? err.message : 'Failed to load goals');
      } finally {
        setLoading(false);
      }
    }

    loadGoals();
  }, [user?.uid]);

  const refreshGoals = async () => {
    if (!user?.uid) return;
    
    try {
      setError(null);
      const data = await getGoals(user.uid);
      setGoals(data);
    } catch (err) {
      console.error('Error refreshing goals:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh goals');
    }
  };

  return {
    goals,
    loading,
    error,
    refreshGoals,
    setGoals // For optimistic updates
  };
} 