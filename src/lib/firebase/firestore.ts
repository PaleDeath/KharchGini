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
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import type { Transaction, FinancialGoal } from '@/lib/types';

// ============ TRANSACTIONS ============

export async function addTransaction(userId: string, transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
  try {
    const docRef = await addDoc(collection(db, 'users', userId, 'transactions'), {
      ...transaction,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    
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
    const docRef = await addDoc(collection(db, 'users', userId, 'goals'), {
      ...goal,
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
    const docRef = doc(db, 'users', userId, 'goals', goalId);
    await updateDoc(docRef, {
      ...updates,
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