export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  date: string; // ISO string date (e.g., "2023-10-26")
  description: string;
  amount: number;
  type: TransactionType;
  category?: string;
  recurringTransactionId?: string; // Link to recurring transaction if auto-generated
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string; // ISO string date (e.g., "2024-12-31")
}

export interface Budget {
  id: string;
  month: string; // Format: "2024-01" (YYYY-MM)
  category: string;
  budgetAmount: number;
  spentAmount: number;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  categoriesOverBudget: number;
  categoriesOnTrack: number;
}

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  category?: string;
  frequency: RecurringFrequency;
  startDate: string; // ISO string date
  endDate?: string; // ISO string date (optional - recurring indefinitely if not set)
  nextDueDate: string; // ISO string date - when the next transaction should be created
  isActive: boolean;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  lastExecuted?: string; // ISO string date - when last transaction was created
}
