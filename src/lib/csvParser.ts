import Papa from 'papaparse';
import { parse, isValid, format } from 'date-fns';
import { TransactionType } from './types';

export interface ParsedRow {
  date: string; // ISO string YYYY-MM-DD
  description: string;
  amount: number;
  type: TransactionType;
  rawDate: string;
  originalDescription: string;
  balance?: number;
}

export type BankFormat = 'HDFC' | 'ICICI' | 'SBI' | 'Axis' | 'Kotak' | 'Union' | 'Other';

interface BankConfig {
  dateCols: string[];
  descCols: string[];
  withdrawalCols: string[];
  depositCols: string[];
  balanceCols?: string[];
  dateFormats: string[];
}

const BANK_CONFIGS: Record<BankFormat, BankConfig> = {
  HDFC: {
    dateCols: ['Date'],
    descCols: ['Narration'],
    withdrawalCols: ['Withdrawal Amt'],
    depositCols: ['Deposit Amt'],
    balanceCols: ['Closing Balance'],
    dateFormats: ['dd/MM/yy', 'dd/MM/yyyy', 'dd-MM-yyyy']
  },
  ICICI: {
    dateCols: ['Transaction Date'],
    descCols: ['Transaction Remarks'],
    withdrawalCols: ['Withdrawal Amount (INR)'],
    depositCols: ['Deposit Amount (INR)'],
    balanceCols: ['Balance (INR)'],
    dateFormats: ['dd/MM/yyyy', 'dd-MM-yyyy']
  },
  SBI: {
    dateCols: ['Date'],
    descCols: ['Narration'],
    withdrawalCols: ['Debit'],
    depositCols: ['Credit'],
    balanceCols: ['Balance'],
    dateFormats: ['dd/MMM/yyyy', 'dd-MMM-yyyy', 'dd/MM/yyyy']
  },
  Axis: {
    dateCols: ['Transaction Date'],
    descCols: ['Particulars'],
    withdrawalCols: ['Debit'],
    depositCols: ['Credit'],
    balanceCols: ['Balance'],
    dateFormats: ['dd-MM-yyyy']
  },
  Kotak: {
    dateCols: ['Transaction Date'],
    descCols: ['Description'],
    withdrawalCols: ['Amount'],
    depositCols: ['Amount'],
    balanceCols: ['Balance'],
    dateFormats: ['dd/MM/yyyy']
  },
  Union: {
    dateCols: ['Date'],
    descCols: ['Remarks'],
    withdrawalCols: ['Withdrawal'],
    depositCols: ['Deposit'],
    balanceCols: ['Balance'],
    dateFormats: ['dd/MM/yyyy']
  },
  Other: {
    dateCols: ['Date', 'Transaction Date'],
    descCols: ['Description', 'Narration', 'Remarks', 'Particulars'],
    withdrawalCols: ['Debit', 'Withdrawal', 'Amount'],
    depositCols: ['Credit', 'Deposit'],
    balanceCols: ['Balance'],
    dateFormats: ['dd/MM/yyyy', 'yyyy-MM-dd', 'dd-MM-yyyy']
  }
};

function cleanAmount(amountStr: string | number | undefined): number {
  if (typeof amountStr === 'number') return amountStr;
  if (!amountStr) return 0;
  // Remove commas and handle currency symbols if present
  const cleaned = amountStr.replace(/,/g, '').replace(/[^\d.-]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function parseDateStr(dateStr: string, formats: string[]): string | null {
  if (!dateStr) return null;
  const cleanDateStr = dateStr.trim();

  for (const fmt of formats) {
    const parsedDate = parse(cleanDateStr, fmt, new Date());
    if (isValid(parsedDate)) {
      return format(parsedDate, 'yyyy-MM-dd');
    }
  }
  return null;
}

function findColumn(headers: string[], possibleNames: string[]): string | undefined {
  const normalizedHeaders = headers.map(h => h.trim().toLowerCase());
  for (const name of possibleNames) {
    const idx = normalizedHeaders.indexOf(name.toLowerCase());
    if (idx !== -1) return headers[idx];
  }
  return undefined;
}

function processResults(results: Papa.ParseResult<any>, bank: BankFormat, resolve: (rows: ParsedRow[]) => void, reject: (err: Error) => void) {
  const rows = results.data as Record<string, string>[];
  const headers = results.meta.fields || [];
  const config = BANK_CONFIGS[bank];

  const dateKey = findColumn(headers, config.dateCols);
  const descKey = findColumn(headers, config.descCols);
  const withdrawKey = findColumn(headers, config.withdrawalCols);
  const depositKey = findColumn(headers, config.depositCols);
  const balanceKey = config.balanceCols ? findColumn(headers, config.balanceCols) : undefined;

  if (!dateKey || !descKey) {
    if (bank !== 'Other') {
       reject(new Error(`Could not find required columns for ${bank}. Found: ${headers.join(', ')}`));
       return;
    }
  }

  const parsedRows: ParsedRow[] = [];

  rows.forEach((row, index) => {
    const dateStr = row[dateKey!] || row['Date'] || row['Transaction Date'];
    const descStr = row[descKey!] || row['Description'] || row['Narration'];

    if (!dateStr) return;

    const parsedDate = parseDateStr(dateStr, config.dateFormats);
    if (!parsedDate) {
      return;
    }

    let withdrawal = 0;
    let deposit = 0;

    if (withdrawKey && row[withdrawKey]) withdrawal = cleanAmount(row[withdrawKey]);
    if (depositKey && row[depositKey]) deposit = cleanAmount(row[depositKey]);

    let amount = 0;
    let type: TransactionType = 'expense';

    if (deposit > 0) {
      amount = deposit;
      type = 'income';
    } else if (withdrawal > 0) {
      amount = withdrawal;
      type = 'expense';
    } else {
       return;
    }

    const balance = balanceKey && row[balanceKey] ? cleanAmount(row[balanceKey]) : undefined;

    parsedRows.push({
      date: parsedDate,
      description: descStr?.trim() || 'No description',
      amount,
      type,
      rawDate: dateStr,
      originalDescription: descStr,
      balance
    });
  });

  resolve(parsedRows);
}

export function parseCSV(file: File, bank: BankFormat): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => processResults(results, bank, resolve, reject),
      error: (error: any) => reject(error)
    });
  });
}

export function parseCSVContent(content: string, bank: BankFormat): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => processResults(results, bank, resolve, reject),
      error: (error: any) => reject(error)
    });
  });
}
