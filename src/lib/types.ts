export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  date: string; // ISO string date (e.g., "2023-10-26")
  description: string;
  amount: number;
  type: TransactionType;
  category?: string;
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string; // ISO string date (e.g., "2024-12-31")
}
