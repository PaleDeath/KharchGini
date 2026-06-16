import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import type { FinancialGoal } from '@/lib/types';

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
