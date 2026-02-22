import { z } from 'zod';

// Transaction validation schema
export const transactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  description: z.string().min(1, 'Description is required').max(500, 'Description must be 500 characters or less'),
  amount: z.number().positive('Amount must be positive').max(10000000, 'Amount cannot exceed 1 crore'),
  type: z.enum(['income', 'expense'], { errorMap: () => ({ message: 'Type must be either income or expense' }) }),
  category: z.string().max(100, 'Category must be 100 characters or less').optional(),
  recurringTransactionId: z.string().optional(),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

// Partial transaction schema for updates
export const partialTransactionSchema = transactionSchema.partial();

// Goal validation schema
export const goalSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  targetAmount: z.number().positive('Target amount must be positive').max(100000000, 'Target amount cannot exceed 10 crore'),
  currentAmount: z.number().nonnegative('Current amount must be non-negative'),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
}).refine(data => data.currentAmount <= data.targetAmount, {
  message: 'Current amount cannot exceed target amount',
  path: ['currentAmount'],
});

export type GoalInput = z.infer<typeof goalSchema>;

export const partialGoalSchema = goalSchema.partial();

// Budget validation schema
export const budgetSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
  category: z.string().min(1, 'Category is required').max(100, 'Category must be 100 characters or less'),
  budgetAmount: z.number().positive('Budget amount must be positive').max(10000000, 'Budget amount cannot exceed 1 crore'),
  spentAmount: z.number().nonnegative('Spent amount must be non-negative').default(0),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type BudgetInput = z.infer<typeof budgetSchema>;

export const partialBudgetSchema = budgetSchema.partial();

// Recurring transaction validation schema
export const recurringTransactionSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500, 'Description must be 500 characters or less'),
  amount: z.number().positive('Amount must be positive').max(10000000, 'Amount cannot exceed 1 crore'),
  type: z.enum(['income', 'expense']),
  category: z.string().max(100, 'Category must be 100 characters or less').optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  isActive: z.boolean().default(true),
  lastExecuted: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type RecurringTransactionInput = z.infer<typeof recurringTransactionSchema>;

export const partialRecurringTransactionSchema = recurringTransactionSchema.partial();

// Bulk operations schema
export const bulkCategorizeSchema = z.array(
  z.object({
    id: z.string(),
    description: z.string(),
    amount: z.number().optional(),
    type: z.enum(['income', 'expense']).optional(),
  })
).max(100, 'Cannot categorize more than 100 transactions at once');

export type BulkCategorizeInput = z.infer<typeof bulkCategorizeSchema>;

// Financial insights input schema
export const financialInsightsSchema = z.object({
  income: z.number().nonnegative('Income must be non-negative'),
  expenses: z.number().nonnegative('Expenses must be non-negative'),
  userType: z.enum(['student', 'professional', 'freelancer', 'business_owner', 'retired', 'other']),
  age: z.number().int().min(13, 'Age must be at least 13').max(120, 'Age must be valid'),
  dependents: z.number().int().nonnegative('Dependents must be non-negative').max(20, 'Dependents must be valid'),
  currentSavings: z.number().nonnegative('Current savings must be non-negative'),
  monthlyFixedExpenses: z.number().nonnegative('Monthly fixed expenses must be non-negative'),
  financialGoals: z.string().max(1000, 'Financial goals description too long'),
  spendingPatterns: z.string().max(2000, 'Spending patterns description too long'),
  location: z.enum(['metro', 'tier2', 'tier3', 'rural']).optional(),
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
});

export type FinancialInsightsInput = z.infer<typeof financialInsightsSchema>;

// Speech-to-text API request schema
export const speechToTextSchema = z.object({
  audioData: z.string().min(1, 'Audio data is required'),
  config: z.record(z.any()).optional(),
  audioFormat: z.string().optional(),
  audioSize: z.number().optional(),
});

export type SpeechToTextInput = z.infer<typeof speechToTextSchema>;

// User profile schema (for future use)
export const userProfileSchema = z.object({
  displayName: z.string().max(100, 'Display name must be 100 characters or less').optional(),
  email: z.string().email('Invalid email address'),
  photoURL: z.string().url('Invalid photo URL').optional(),
  currency: z.string().length(3, 'Currency must be 3-letter ISO code').default('INR'),
  locale: z.string().max(10, 'Invalid locale').default('en-IN'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type UserProfileInput = z.infer<typeof userProfileSchema>;

// Helper function to safely parse and return typed errors
export function safeParseWithErrors<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error.errors.map(err => {
    const path = err.path.join('.');
    return path ? `${path}: ${err.message}` : err.message;
  });
  
  return { success: false, errors };
}

// Helper to validate and throw descriptive errors
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown, context?: string): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(err => {
        const path = err.path.join('.');
        return path ? `${path}: ${err.message}` : err.message;
      }).join(', ');
      
      const contextMsg = context ? `${context}: ` : '';
      throw new Error(`${contextMsg}Validation failed: ${messages}`);
    }
    throw error;
  }
}
