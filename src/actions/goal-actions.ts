'use server';

import { revalidatePath } from 'next/cache';
import type { FinancialGoal } from '@/lib/types';

export interface AddGoalInput {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: string;
}

// In a real app, this would interact with a database.
export async function addGoalAction(input: AddGoalInput): Promise<{ success: boolean; goal?: FinancialGoal; error?: string }> {
  try {
    const newGoal: FinancialGoal = {
      id: Date.now().toString(), // Simple ID generation
      ...input,
      currentAmount: input.currentAmount || 0,
    };
    // console.log('Goal added (simulated):', newGoal);
    revalidatePath('/goals');
    revalidatePath('/dashboard');
    return { success: true, goal: newGoal };
  } catch (error) {
    console.error("Error adding goal:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to add goal" };
  }
}

export async function updateGoalAction(goal: FinancialGoal): Promise<{ success: boolean; error?: string }> {
  // console.log('Goal updated (simulated):', goal);
  revalidatePath('/goals');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function deleteGoalAction(goalId: string): Promise<{ success: boolean; error?: string }> {
  // console.log('Goal deleted (simulated):', goalId);
  revalidatePath('/goals');
  revalidatePath('/dashboard');
  return { success: true };
}
