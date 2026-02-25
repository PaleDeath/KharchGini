import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from './firebase/firebase';
import { differenceInDays, parseISO, subDays, addDays, format } from 'date-fns';
import { Transaction } from './types';
import { ParsedRow } from './csvParser';

export interface DuplicateResult {
  row: ParsedRow;
  isDuplicate: boolean;
  match?: Transaction;
}

export async function getExistingTransactions(userId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
  try {
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');

    const q = query(
      collection(db, 'users', userId, 'transactions'),
      where('date', '>=', startStr),
      where('date', '<=', endStr)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Transaction));
  } catch (error) {
    console.error("Error fetching existing transactions:", error);
    return [];
  }
}

export function isDuplicate(row: ParsedRow, existing: Transaction): boolean {
  // 1. Amount Check (Exact or close enough?)
  // Floating point comparison
  if (Math.abs(row.amount - existing.amount) > 0.01) return false;

  // 2. Date Check (±1 day)
  const rowDate = parseISO(row.date);
  const existingDate = parseISO(existing.date);
  const diff = Math.abs(differenceInDays(rowDate, existingDate));
  if (diff > 1) return false;

  // 3. Description Fuzzy Check
  // Normalize strings: remove special chars, lowercase
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const rowDesc = normalize(row.description);
  const existingDesc = normalize(existing.description);

  // If one contains the other, or similarity is high
  if (rowDesc.includes(existingDesc) || existingDesc.includes(rowDesc)) return true;

  // Simple token overlap?
  // "UPI-ZOMATO" vs "Zomato Order" -> "zomato" overlap
  // This might be too aggressive.
  // Sticking to "contains" or "levenshtein" if possible.
  // Since we don't have levenshtein lib, use simple inclusion.

  return false;
}

export async function checkForDuplicates(userId: string, newRows: ParsedRow[]): Promise<{
  duplicates: Transaction[],
  unique: ParsedRow[],
  all: DuplicateResult[]
}> {
  if (newRows.length === 0) return { duplicates: [], unique: [], all: [] };

  // Determine date range
  const dates = newRows.map(r => parseISO(r.date));
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

  // Add buffer
  const queryStart = subDays(minDate, 2);
  const queryEnd = addDays(maxDate, 2);

  const existing = await getExistingTransactions(userId, queryStart, queryEnd);

  const duplicates: Transaction[] = [];
  const unique: ParsedRow[] = [];
  const all: DuplicateResult[] = [];

  for (const row of newRows) {
    const match = existing.find(ex => isDuplicate(row, ex));
    if (match) {
      duplicates.push(match);
      all.push({ row, isDuplicate: true, match });
    } else {
      unique.push(row);
      all.push({ row, isDuplicate: false });
    }
  }

  return { duplicates, unique, all };
}
