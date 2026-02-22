import { z } from 'zod';
import { ai } from '../genkit';

export const CategorizeTransactionInputSchema = z.object({
  description: z.string(),
  amount: z.number(),
  date: z.string(),
});

export const CategorizeTransactionOutputSchema = z.object({
  category: z.string(),
  confidence: z.number(),
  reasoning: z.string(),
});

export type CategorizeTransactionInput = z.infer<typeof CategorizeTransactionInputSchema>;
export type CategorizeTransactionOutput = z.infer<typeof CategorizeTransactionOutputSchema>;

export const categorizeTransactionFlow = ai.defineFlow({
  name: 'categorizeTransaction',
  inputSchema: CategorizeTransactionInputSchema,
  outputSchema: CategorizeTransactionOutputSchema,
}, async (input) => {
  const prompt = `
    Categorize the following transaction:
    Description: "${input.description}"
    Amount: ${input.amount}
    Date: ${input.date}

    Suggest a standard personal finance category (e.g., Groceries, Rent, Utilities, Entertainment, Dining Out, Transportation, Health, Shopping, Income, Transfer, etc.).
    Provide a confidence score (0-1) and brief reasoning.
  `;

  const { output } = await ai.generate({
    prompt,
    output: { schema: CategorizeTransactionOutputSchema },
  });

  if (!output) {
    throw new Error('Failed to categorize transaction');
  }

  return output;
});

export async function categorizeTransaction(input: CategorizeTransactionInput): Promise<CategorizeTransactionOutput> {
  return await categorizeTransactionFlow(input);
}
