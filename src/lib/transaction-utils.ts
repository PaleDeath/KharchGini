import type { Transaction } from '@/lib/types';
import type { TransactionFilters, TransactionSort, SortField } from '@/components/transaction-filters';

/**
 * Filters transactions based on search, type, and category filters
 */
export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters
): Transaction[] {
  return transactions.filter((transaction) => {
    // Search filter - checks description
    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase().trim();
      const description = transaction.description.toLowerCase();
      const category = (transaction.category || '').toLowerCase();
      const amount = transaction.amount.toString();
      
      if (!description.includes(searchTerm) && 
          !category.includes(searchTerm) && 
          !amount.includes(searchTerm)) {
        return false;
      }
    }

    // Type filter
    if (filters.type !== 'all' && transaction.type !== filters.type) {
      return false;
    }

    // Category filter
    if (filters.category && transaction.category !== filters.category) {
      return false;
    }

    return true;
  });
}

/**
 * Sorts transactions based on the specified field and order
 */
export function sortTransactions(
  transactions: Transaction[],
  sort: TransactionSort
): Transaction[] {
  return [...transactions].sort((a, b) => {
    let comparison = 0;

    switch (sort.field) {
      case 'date':
        // Compare dates as ISO strings (works for YYYY-MM-DD format)
        comparison = a.date.localeCompare(b.date);
        break;

      case 'amount':
        comparison = a.amount - b.amount;
        break;

      case 'type':
        // Income first, then expense (alphabetical)
        comparison = a.type.localeCompare(b.type);
        break;



      default:
        return 0;
    }

    // Apply sort order
    return sort.order === 'asc' ? comparison : -comparison;
  });
}

/**
 * Applies both filtering and sorting to transactions
 */
export function processTransactions(
  transactions: Transaction[],
  filters: TransactionFilters,
  sort: TransactionSort
): Transaction[] {
  const filtered = filterTransactions(transactions, filters);
  return sortTransactions(filtered, sort);
}

/**
 * Gets summary statistics for filtered transactions
 */
export function getTransactionStats(transactions: Transaction[]) {
  const stats = {
    total: transactions.length,
    income: 0,
    expense: 0,
    totalIncome: 0,
    totalExpenses: 0,
    categories: new Set<string>(),
  };

  transactions.forEach((transaction) => {
    if (transaction.type === 'income') {
      stats.income++;
      stats.totalIncome += transaction.amount;
    } else {
      stats.expense++;
      stats.totalExpenses += transaction.amount;
    }

    if (transaction.category) {
      stats.categories.add(transaction.category);
    }
  });

  return {
    ...stats,
    categoriesCount: stats.categories.size,
    netAmount: stats.totalIncome - stats.totalExpenses,
  };
} 