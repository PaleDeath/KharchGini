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
  limit,
  Timestamp,
  writeBatch,
  startAfter,
  DocumentSnapshot,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type { Transaction } from '@/lib/types';

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

export async function getTransactions(
  userId: string,
  limitCount: number = 100,
  lastDoc: DocumentSnapshot | null = null
): Promise<{ transactions: Transaction[], lastDoc: DocumentSnapshot | null }> {
  try {
    let q = query(
      collection(db, 'users', userId, 'transactions'),
      orderBy('date', 'desc'),
      limit(limitCount)
    );

    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const querySnapshot = await getDocs(q);
    const transactions = querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Remove Firestore Timestamp objects that can't be serialized to client
      const { createdAt, updatedAt, ...cleanData } = data;
      return {
        id: doc.id,
        ...cleanData
      } as Transaction;
    });

    const newLastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;

    return { transactions, lastDoc: newLastDoc };
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
