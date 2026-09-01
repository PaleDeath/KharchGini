/**
 * Intelligent Bank & Credit Card Statement Parser.
 *
 * Supports CSV and Excel (.xlsx, .xls) files from all major Indian and international
 * banks (HDFC, ICICI, SBI, Axis, Kotak, Chase, Amex, etc.).
 *
 * Handles:
 * 1. Metadata preamble rows (auto-detects real table header row).
 * 2. Mixed date formats (DD/MM/YYYY, DD-MMM-YYYY, ISO, Excel serial dates).
 * 3. Split debit/credit columns, single amount columns with Dr/Cr or sign, and transaction type indicators.
 * 4. Automatic merchant extraction, auto-categorisation, and deduplication via externalId.
 */

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { isValidISODate, type ISODate } from './dates';
import { guessCategory } from './categorize';
import { parseAmount } from './money';
import type { Direction, EntryDraft, Ledger } from './types';

export interface StatementMapping {
  date: string;
  description: string;
  amount: string;
  debit: string;
  credit: string;
  typeIndicator: string;
  refNo: string;
}

export const EMPTY_MAPPING: StatementMapping = {
  date: '',
  description: '',
  amount: '',
  debit: '',
  credit: '',
  typeIndicator: '',
  refNo: '',
};

export interface ParsedStatement {
  fileName: string;
  fields: string[];
  rows: Record<string, string>[];
  detectedMapping: StatementMapping;
  confidence: number;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Normalises a header string to alphanumeric lowercase for fuzzy column matching.
 */
export function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Parses diverse bank statement date strings into a clean YYYY-MM-DD ISODate.
 */
export function parseStatementDate(value: string | number): ISODate | null {
  if (value === undefined || value === null) return null;

  // 1. Excel numeric date serials (e.g. 45536)
  if (typeof value === 'number' || (/^\d{5}(\.\d+)?$/.test(String(value).trim()) && !value.toString().includes('/'))) {
    const num = Number(value);
    if (!isNaN(num) && num > 20000 && num < 70000) {
      const dateObj = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(dateObj.getTime())) {
        const y = dateObj.getUTCFullYear();
        const m = pad(dateObj.getUTCMonth() + 1);
        const d = pad(dateObj.getUTCDate());
        const candidate = `${y}-${m}-${d}`;
        if (isValidISODate(candidate)) return candidate;
      }
    }
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // Clean time components if present (e.g., "31/08/2026 14:30:00" -> "31/08/2026")
  const datePart = raw.split(/[T\s]/)[0] || raw;

  // 2. Direct ISO Format (YYYY-MM-DD)
  if (isValidISODate(datePart)) return datePart;

  // 3. Day-first numeric format (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD/MM/YY)
  const dmyMatch = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(datePart);
  if (dmyMatch) {
    const d = Number(dmyMatch[1]);
    const m = Number(dmyMatch[2]);
    let y = Number(dmyMatch[3]);
    if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      const iso = `${y}-${pad(m)}-${pad(d)}`;
      if (isValidISODate(iso)) return iso;
    }
  }

  // 4. Day-MonthName-Year (e.g. 31-Aug-2026, 31-AUG-26, 31 Aug 2026, 01/Sep/2026)
  const textMonthMatch = /^(\d{1,2})[/\-\s]([A-Za-z]{3,9})[/\-\s](\d{2,4})$/.exec(raw);
  if (textMonthMatch) {
    const d = Number(textMonthMatch[1]);
    const mStr = textMonthMatch[2]!.toLowerCase();
    const m = MONTH_NAMES[mStr];
    let y = Number(textMonthMatch[3]);
    if (y < 100) y += 2000;
    if (m && d >= 1 && d <= 31) {
      const iso = `${y}-${pad(m)}-${pad(d)}`;
      if (isValidISODate(iso)) return iso;
    }
  }

  // 5. MonthName-Day-Year (e.g. Aug 31, 2026, August 31 2026)
  const usTextMonthMatch = /^([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})$/.exec(raw);
  if (usTextMonthMatch) {
    const mStr = usTextMonthMatch[1]!.toLowerCase();
    const m = MONTH_NAMES[mStr];
    const d = Number(usTextMonthMatch[2]);
    let y = Number(usTextMonthMatch[3]);
    if (y < 100) y += 2000;
    if (m && d >= 1 && d <= 31) {
      const iso = `${y}-${pad(m)}-${pad(d)}`;
      if (isValidISODate(iso)) return iso;
    }
  }

  return null;
}

/**
 * Parses statement amount and determines if it represents an expense (out) or income (in).
 */
export function parseStatementAmount(
  amountStr: string,
  typeIndicator?: string,
): { amount: number; direction: Direction } | null {
  if (!amountStr) return null;
  const raw = amountStr.trim();
  if (!raw || raw === '-' || raw === '—') return null;

  const isExplicitDr = /\b(dr|debit|withdrawal|spent|paid)\b/i.test(raw) || (typeIndicator && /\b(dr|debit|withdrawal|d)\b/i.test(typeIndicator));
  const isExplicitCr = /\b(cr|credit|deposit|received)\b/i.test(raw) || (typeIndicator && /\b(cr|credit|deposit|c)\b/i.test(typeIndicator));
  const hasParentheses = /^\(.*\)$/.test(raw);

  // Extract the numeric portion (e.g., "1,450.00" from "Rs. 1,450.00 Dr")
  const numMatch = /[-+]?\d[\d,]*(\.\d+)?/.exec(raw);
  if (!numMatch) return null;

  const cleanNum = numMatch[0].replace(/,/g, '');
  const parsedFloat = parseFloat(cleanNum);
  if (isNaN(parsedFloat) || parsedFloat === 0) return null;

  const absAmount = Math.round(Math.abs(parsedFloat) * 100);
  let direction: Direction = 'out';

  if (isExplicitCr) {
    direction = 'in';
  } else if (isExplicitDr || hasParentheses || raw.includes('-') || parsedFloat < 0) {
    direction = 'out';
  } else {
    direction = parsedFloat < 0 ? 'out' : 'out';
  }

  return { amount: absAmount, direction };
}

/**
 * Candidate keyword sets for intelligent column detection.
 */
const COLUMN_CANDIDATES = {
  date: [
    'transaction date', 'txn date', 'trans date', 'booking date', 'value date',
    'post date', 'posting date', 'payment date', 'date', 'trade date',
  ],
  description: [
    'narration', 'particulars', 'transaction details', 'transaction remarks',
    'description', 'details', 'remarks', 'payee', 'merchant', 'reference',
    'memo', 'party name', 'name', 'account name',
  ],
  debit: [
    'withdrawal amount', 'withdrawal amt', 'withdrawal', 'debit amount', 'debit amt',
    'debit', 'dr amount', 'dr amt', 'dr', 'paid out', 'spent', 'expense', 'debits',
  ],
  credit: [
    'deposit amount', 'deposit amt', 'deposit', 'credit amount', 'credit amt',
    'credit', 'cr amount', 'cr amt', 'cr', 'paid in', 'received', 'income', 'credits',
  ],
  amount: [
    'transaction amount', 'net amount', 'amount', 'amt', 'value', 'total',
  ],
  typeIndicator: [
    'txn type', 'transaction type', 'cr dr', 'dr cr', 'type', 'd c', 'c d',
    'indicator', 'type of transaction',
  ],
  refNo: [
    'chq ref no', 'cheque no', 'ref no', 'reference number', 'utr', 'txn id',
    'transaction id', 'reference', 'ref', 'chq no',
  ],
};

export function autoMapColumns(fields: string[]): StatementMapping {
  const mapping: StatementMapping = { ...EMPTY_MAPPING };
  const normalisedFields = fields.map((f) => ({ original: f, norm: normaliseHeader(f) }));

  for (const [key, candidates] of Object.entries(COLUMN_CANDIDATES)) {
    for (const candidate of candidates) {
      const match = normalisedFields.find((f) => f.norm === candidate || f.norm.includes(candidate));
      if (match) {
        mapping[key as keyof StatementMapping] = match.original;
        break;
      }
    }
  }

  return mapping;
}

/**
 * Finds the actual table header row in 2D array of spreadsheet data by scoring rows
 * against financial column keywords.
 */
export function findHeaderRow(rows: string[][]): { headerIndex: number; fields: string[] } {
  if (rows.length === 0) return { headerIndex: 0, fields: [] };

  let bestIndex = 0;
  let bestScore = -1;
  let bestFields: string[] = [];

  const KEYWORDS = [
    'date', 'txn', 'narration', 'description', 'particulars', 'details',
    'withdrawal', 'debit', 'deposit', 'credit', 'amount', 'balance', 'ref', 'chq',
  ];

  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i] || [];
    const nonBlank = row.map((cell) => String(cell || '').trim()).filter(Boolean);
    if (nonBlank.length < 2) continue;

    let score = 0;
    for (const cell of nonBlank) {
      const lower = cell.toLowerCase().replace(/[^a-z0-9]/g, ' ');
      for (const kw of KEYWORDS) {
        if (lower === kw || lower.includes(kw)) {
          score += 1;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
      bestFields = nonBlank;
    }
  }

  // If no obvious header was detected, default to row 0
  if (bestScore <= 0 && rows[0]) {
    bestIndex = 0;
    bestFields = rows[0].map((c, idx) => String(c || '').trim() || `Column ${idx + 1}`);
  } else if (rows[bestIndex]) {
    // Fill in empty column names
    bestFields = rows[bestIndex].map((c, idx) => String(c || '').trim() || `Column ${idx + 1}`);
  }

  return { headerIndex: bestIndex, fields: bestFields };
}

/**
 * Reads a File (.csv, .xlsx, .xls) and parses it into clean structured rows with auto-detected columns.
 */
export async function parseStatementFile(file: File): Promise<ParsedStatement> {
  const fileName = file.name;
  const isExcel = /\.(xlsx|xls)$/i.test(fileName);

  let raw2D: string[][] = [];

  if (isExcel) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error('Excel workbook contains no sheets.');

    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) throw new Error('Empty Excel sheet.');

    const sheetData: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
    });
    raw2D = sheetData.map((row) => row.map((cell) => String(cell ?? '').trim()));
  } else {
    // CSV file: Parse raw text with PapaParse
    const text = await file.text();
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
    raw2D = (parsed.data || []).map((row) => row.map((cell) => String(cell ?? '').trim()));
  }

  if (raw2D.length === 0) {
    throw new Error('The selected file is empty.');
  }

  const { headerIndex, fields } = findHeaderRow(raw2D);
  const dataRows2D = raw2D.slice(headerIndex + 1);

  // Convert to object rows keyed by column headers
  const rows: Record<string, string>[] = [];
  for (const row of dataRows2D) {
    if (!row || row.every((c) => !c)) continue;
    const obj: Record<string, string> = {};
    for (let col = 0; col < fields.length; col++) {
      const colName = fields[col]!;
      obj[colName] = row[col] || '';
    }
    rows.push(obj);
  }

  const detectedMapping = autoMapColumns(fields);

  // Compute confidence score
  let detectedKeys = 0;
  if (detectedMapping.date) detectedKeys++;
  if (detectedMapping.description) detectedKeys++;
  if (detectedMapping.debit || detectedMapping.credit || detectedMapping.amount) detectedKeys++;
  const confidence = detectedKeys >= 3 ? 1 : detectedKeys === 2 ? 0.7 : 0.4;

  return {
    fileName,
    fields,
    rows,
    detectedMapping,
    confidence,
  };
}

/**
 * Converts mapped table rows into validated ledger entry drafts.
 */
export function buildStatementDrafts(
  rows: Record<string, string>[],
  map: StatementMapping,
  accountId: string,
  ledger: Ledger,
): EntryDraft[] {
  const seen = new Set(
    ledger.entries.map((entry) => entry.externalId).filter((key): key is string => Boolean(key)),
  );
  const out: EntryDraft[] = [];

  for (const row of rows) {
    const date = map.date ? parseStatementDate(row[map.date] ?? '') : null;
    if (!date) continue;

    const description = (map.description ? (row[map.description] ?? '') : '').trim();
    const typeInd = map.typeIndicator ? (row[map.typeIndicator] ?? '') : undefined;
    const refNo = map.refNo ? (row[map.refNo] ?? '').trim() : undefined;

    let amount: number | null = null;
    let direction: Direction = 'out';

    // 1. Separate Debit & Credit columns
    const debitVal = map.debit ? (row[map.debit] ?? '').trim() : '';
    const creditVal = map.credit ? (row[map.credit] ?? '').trim() : '';

    if (debitVal && debitVal !== '-' && debitVal !== '0') {
      const parsedDebit = parseStatementAmount(debitVal, 'DR');
      if (parsedDebit && parsedDebit.amount > 0) {
        amount = parsedDebit.amount;
        direction = 'out';
      }
    } else if (creditVal && creditVal !== '-' && creditVal !== '0') {
      const parsedCredit = parseStatementAmount(creditVal, 'CR');
      if (parsedCredit && parsedCredit.amount > 0) {
        amount = parsedCredit.amount;
        direction = 'in';
      }
    }

    // 2. Single Amount column
    if (amount === null && map.amount) {
      const singleVal = (row[map.amount] ?? '').trim();
      const parsedSingle = parseStatementAmount(singleVal, typeInd);
      if (parsedSingle && parsedSingle.amount > 0) {
        amount = parsedSingle.amount;
        direction = parsedSingle.direction;
      }
    }

    if (amount === null || amount <= 0) continue;

    const label = description || (direction === 'in' ? 'Imported Income' : 'Imported Expense');
    const externalId = `${accountId}:${date}:${direction}:${amount}:${label.toLowerCase().slice(0, 40)}`;
    if (seen.has(externalId)) continue;
    seen.add(externalId);

    const guess = guessCategory(label, amount, direction, ledger);

    out.push({
      amount,
      description: label,
      date,
      direction,
      accountId,
      ...(guess.categoryId ? { categoryId: guess.categoryId } : {}),
      ...(guess.merchant ? { merchant: guess.merchant } : {}),
      tags: guess.tags,
      ...(refNo ? { note: `Ref ${refNo}` } : {}),
      source: 'import',
      externalId,
    });
  }

  return out;
}
