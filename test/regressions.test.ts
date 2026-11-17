import test from 'node:test';
import assert from 'node:assert/strict';

import { safeCalculate } from '../src/domain/calculator';
import { ordinal } from '../src/domain/dates';
import { parseCommand, type ParseContext } from '../src/domain/parse';
import {
  duePostings,
  initialNextDue,
  nextDueAfterReschedule,
  occurrenceAt,
  occurrencesBetween,
  upcoming,
} from '../src/domain/recurring';
import { autoMapColumns, buildStatementDrafts } from '../src/domain/statement';
import { EMPTY_LEDGER, type Account, type Recurring } from '../src/domain/types';

const STAMP = '2026-01-01T00:00:00.000Z';

function makeRule(partial: Partial<Recurring>): Recurring {
  return {
    id: 'rule',
    description: 'Rent',
    amount: 10_000_00,
    direction: 'out',
    accountId: 'bank',
    frequency: 'monthly',
    startDate: '2026-01-05',
    nextDueDate: '2026-01-05',
    isActive: true,
    autoPost: true,
    variableAmount: false,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...partial,
  };
}

const BANK: Account = {
  id: 'bank',
  name: 'HDFC Bank',
  type: 'bank',
  openingBalance: 0,
  sortOrder: 0,
  createdAt: STAMP,
  updatedAt: STAMP,
};

const CTX: ParseContext = {
  accounts: [BANK],
  defaultAccountId: 'bank',
  rules: [],
  merchants: [],
  categories: [],
  today: '2026-09-10',
};

/* -------------------------------------------------------------------------- */
/* Recurring: nextDueDate is the cursor                                        */
/* -------------------------------------------------------------------------- */

test('a rule created with a past start date does not backfill or appear overdue', () => {
  const today = '2026-11-17';
  const rule = makeRule({
    startDate: '2026-01-05',
    nextDueDate: initialNextDue('2026-01-05', 'monthly', today),
  });
  assert.equal(rule.nextDueDate, '2026-12-05');

  assert.deepEqual(duePostings([rule], today), []);
  const bills = upcoming([rule], today, 30);
  assert.deepEqual(
    bills.map((b) => b.dueDate),
    ['2026-12-05'],
  );
  assert.equal(bills[0]?.overdue, false);
  // The first row shown is the occurrence that "Paid" will post.
  assert.equal(bills[0]?.dueDate, rule.nextDueDate);
});

test('a rule left unposted still shows as overdue and still auto-posts', () => {
  const today = '2026-11-17';
  const rule = makeRule({ startDate: '2026-01-05', nextDueDate: '2026-10-05' });

  assert.deepEqual(
    duePostings([rule], today).map((p) => p.date),
    ['2026-10-05', '2026-11-05'],
  );
  const bills = upcoming([rule], today, 30);
  assert.deepEqual(
    bills.map((b) => [b.dueDate, b.overdue]),
    [
      ['2026-10-05', true],
      ['2026-11-05', true],
      ['2026-12-05', false],
    ],
  );
});

test('posting history is honoured when lastPostedDate is set', () => {
  const today = '2026-11-17';
  const rule = makeRule({
    startDate: '2026-01-05',
    lastPostedDate: '2026-10-05',
    nextDueDate: '2026-11-05',
  });
  assert.deepEqual(
    duePostings([rule], today).map((p) => p.date),
    ['2026-11-05'],
  );
});

test('editing the schedule re-anchors nextDueDate onto the new schedule', () => {
  const today = '2026-11-17';
  // Was monthly on the 5th (next due 5 Dec); the start date moves to the 20th.
  assert.equal(
    nextDueAfterReschedule({ startDate: '2026-01-20', frequency: 'monthly' }, today),
    '2026-11-20',
  );
  // Never before the day after the last posting.
  assert.equal(
    nextDueAfterReschedule(
      { startDate: '2026-01-20', frequency: 'monthly', lastPostedDate: '2026-11-20' },
      today,
    ),
    '2026-12-20',
  );
});

test('N installments means exactly N occurrences, at any frequency', () => {
  for (const frequency of ['weekly', 'monthly'] as const) {
    const startDate = '2026-01-31';
    const endDate = occurrenceAt({ startDate, frequency }, 12 - 1);
    const rule = makeRule({ startDate, frequency, endDate, nextDueDate: startDate });
    assert.equal(occurrencesBetween(rule, startDate, '2030-01-01').length, 12, frequency);
  }
});

test('ordinal suffixes', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 30, 31].map(ordinal),
    ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '30th', '31st'],
  );
});

/* -------------------------------------------------------------------------- */
/* Statement import                                                            */
/* -------------------------------------------------------------------------- */

test('"Description" is not mistaken for the credit column', () => {
  const mapping = autoMapColumns(['Date', 'Description', 'Amount']);
  assert.equal(mapping.date, 'Date');
  assert.equal(mapping.description, 'Description');
  assert.equal(mapping.amount, 'Amount');
  assert.equal(mapping.credit, '');
  assert.equal(mapping.debit, '');

  const drafts = buildStatementDrafts(
    [{ Date: '31/08/2026', Description: 'SWIGGY ORDER 1234', Amount: '350.00' }],
    mapping,
    'bank',
    EMPTY_LEDGER,
  );
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0]?.amount, 350_00);
  assert.equal(drafts[0]?.direction, 'out');
});

test('split debit/credit headers still map, including short Dr/Cr forms', () => {
  const hdfc = autoMapColumns([
    'Date', 'Narration', 'Chq./Ref.No.', 'Value Dt', 'Withdrawal Amt.', 'Deposit Amt.', 'Closing Balance',
  ]);
  assert.equal(hdfc.description, 'Narration');
  assert.equal(hdfc.debit, 'Withdrawal Amt.');
  assert.equal(hdfc.credit, 'Deposit Amt.');

  const short = autoMapColumns(['Txn Date', 'Particulars', 'Dr', 'Cr', 'Balance']);
  assert.equal(short.debit, 'Dr');
  assert.equal(short.credit, 'Cr');
});

test('a "0.00" in the debit column does not hide the credit', () => {
  const mapping = autoMapColumns(['Date', 'Narration', 'Debit', 'Credit']);
  const drafts = buildStatementDrafts(
    [
      { Date: '01/09/2026', Narration: 'SALARY', Debit: '0.00', Credit: '45,000.00' },
      { Date: '02/09/2026', Narration: 'RENT', Debit: '18,000.00', Credit: '0.00' },
    ],
    mapping,
    'bank',
    EMPTY_LEDGER,
  );
  assert.deepEqual(
    drafts.map((d) => [d.direction, d.amount]),
    [
      ['in', 45_000_00],
      ['out', 18_000_00],
    ],
  );
});

/* -------------------------------------------------------------------------- */
/* Command bar                                                                 */
/* -------------------------------------------------------------------------- */

test('a debit SMS that says "credited to <payee>" is still money out', () => {
  const result = parseCommand(
    'ICICI Bank Acct XX123 debited for Rs 350.00 on 31-Aug-26; SWIGGY credited. UPI:402913',
    CTX,
  );
  assert.equal(result.kind, 'entry');
  if (result.kind !== 'entry') return;
  assert.equal(result.entry.direction, 'out');
  assert.equal(result.entry.amount, 350_00);
});

test('a credit SMS is still money in', () => {
  const result = parseCommand('INR 45000.00 credited to A/C 4567 by SALARY on 31-08-2026', CTX);
  assert.equal(result.kind, 'entry');
  if (result.kind !== 'entry') return;
  assert.equal(result.entry.direction, 'in');
  assert.equal(result.entry.amount, 45_000_00);
});

test('a date that does not exist is not accepted as the entry date', () => {
  const result = parseCommand('280 chai 31/2', CTX);
  assert.equal(result.kind, 'entry');
  if (result.kind !== 'entry') return;
  assert.equal(result.entry.date, '2026-09-10');
});

/* -------------------------------------------------------------------------- */
/* Calculator                                                                  */
/* -------------------------------------------------------------------------- */

test('a negated percentage keeps its sign', () => {
  assert.equal(safeCalculate('500 * -10%'), -50);
  assert.equal(safeCalculate('100 + -10%'), 90);
  assert.equal(safeCalculate('100 + 10%'), 110);
  assert.equal(safeCalculate('100 - 10%'), 90);
});
