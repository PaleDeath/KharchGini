import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isAddOnCard,
  isPrimaryCard,
  type Account,
  type Entry,
} from '../src/domain/types';
import {
  primaryCreditCards,
  addOnCards,
  totalCreditLimit,
  creditLineDebt,
  creditLineAvailable,
  creditUtilization,
  totalCreditCardDebt,
  accountBalances,
} from '../src/domain/derive';
import { parseCommand } from '../src/domain/parse';

// Helper to construct test accounts
function makeAccount(partial: Partial<Account> & { id: string; name: string }): Account {
  return {
    type: 'card',
    openingBalance: 0,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

test('isAddOnCard and isPrimaryCard identify card classifications correctly', () => {
  const primaryCard = makeAccount({ id: 'prim1', name: 'HDFC Regalia' });
  const addOnWithFlag = makeAccount({ id: 'add1', name: 'Regalia Add-on', isAddOn: true });
  const addOnWithParent = makeAccount({ id: 'add2', name: 'Regalia Add-on 2', primaryCardId: 'prim1' });
  const addOnWithBoth = makeAccount({ id: 'add3', name: 'Regalia Add-on 3', isAddOn: true, primaryCardId: 'prim1' });
  const bankAcc = makeAccount({ id: 'bank1', name: 'Salary Bank', type: 'bank' });

  // Primary card checks
  assert.equal(isAddOnCard(primaryCard), false);
  assert.equal(isPrimaryCard(primaryCard), true);

  // Add-on card checks
  assert.equal(isAddOnCard(addOnWithFlag), true);
  assert.equal(isPrimaryCard(addOnWithFlag), false);

  assert.equal(isAddOnCard(addOnWithParent), true);
  assert.equal(isPrimaryCard(addOnWithParent), false);

  assert.equal(isAddOnCard(addOnWithBoth), true);
  assert.equal(isPrimaryCard(addOnWithBoth), false);

  // Non-card accounts
  assert.equal(isAddOnCard(bankAcc), false);
  assert.equal(isPrimaryCard(bankAcc), false);
});

test('totalCreditLimit sums only primary credit lines and excludes add-on cards', () => {
  const accounts: Account[] = [
    makeAccount({ id: 'prim1', name: 'HDFC Infinia', creditLimit: 500000 }), // 5,000.00
    makeAccount({ id: 'add1', name: 'Infinia Add-on', isAddOn: true, primaryCardId: 'prim1', creditLimit: 100000 }), // 1,000.00 sub-limit
    makeAccount({ id: 'prim2', name: 'ICICI Sapphiro', creditLimit: 300000 }), // 3,000.00
    makeAccount({ id: 'add2', name: 'Sapphiro Add-on', isAddOn: true, primaryCardId: 'prim2' }), // no sub-limit
    makeAccount({ id: 'standalone_addon', name: 'Generic Add-on', isAddOn: true, creditLimit: 50000 }),
    makeAccount({ id: 'archived_prim', name: 'Old Card', creditLimit: 200000, archived: true }),
    makeAccount({ id: 'bank1', name: 'Bank', type: 'bank' }),
  ];

  // Total primary credit limit must be prim1 (500,000) + prim2 (300,000) = 800,000
  // Add-on cards (add1, add2, standalone_addon) must NOT be recognized as primary credit lines or limits
  const total = totalCreditLimit(accounts);
  assert.equal(total, 800000);
});

test('creditLineDebt attributes both primary card debt and linked add-on cards debt', () => {
  const accounts: Account[] = [
    makeAccount({ id: 'prim1', name: 'HDFC Regalia', creditLimit: 200000 }),
    makeAccount({ id: 'add1', name: 'Regalia Add-on 1', isAddOn: true, primaryCardId: 'prim1' }),
    makeAccount({ id: 'add2', name: 'Regalia Add-on 2', isAddOn: true, primaryCardId: 'prim1' }),
    makeAccount({ id: 'other_prim', name: 'Axis Atlas', creditLimit: 150000 }),
    makeAccount({ id: 'other_add', name: 'Atlas Add-on', isAddOn: true, primaryCardId: 'other_prim' }),
  ];

  const entries: Entry[] = [
    {
      id: 'e1',
      date: '2026-09-01',
      amount: 25000,
      direction: 'out',
      accountId: 'prim1',
      description: 'Flight',
      tags: [],
      source: 'manual',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'e2',
      date: '2026-09-02',
      amount: 15000,
      direction: 'out',
      accountId: 'add1',
      description: 'Hotel on Addon 1',
      tags: [],
      source: 'manual',
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    },
    {
      id: 'e3',
      date: '2026-09-03',
      amount: 10000,
      direction: 'out',
      accountId: 'add2',
      description: 'Dining on Addon 2',
      tags: [],
      source: 'manual',
      createdAt: '2026-09-03T00:00:00.000Z',
      updatedAt: '2026-09-03T00:00:00.000Z',
    },
    {
      id: 'e4',
      date: '2026-09-04',
      amount: 40000,
      direction: 'out',
      accountId: 'other_prim',
      description: 'Electronics on Atlas',
      tags: [],
      source: 'manual',
      createdAt: '2026-09-04T00:00:00.000Z',
      updatedAt: '2026-09-04T00:00:00.000Z',
    },
  ];

  // Regalia line debt = prim1 (25,000) + add1 (15,000) + add2 (10,000) = 50,000
  const regaliaLineDebt = creditLineDebt('prim1', accounts, entries);
  assert.equal(regaliaLineDebt, 50000);

  // Available on Regalia line = 200,000 - 50,000 = 150,000
  const regaliaCard = accounts.find((a) => a.id === 'prim1')!;
  const available = creditLineAvailable(regaliaCard, accounts, entries);
  assert.equal(available, 150000);

  // Atlas line debt = 40,000
  const atlasLineDebt = creditLineDebt('other_prim', accounts, entries);
  assert.equal(atlasLineDebt, 40000);

  // Total debt across all cards = 50,000 + 40,000 = 90,000
  assert.equal(totalCreditCardDebt(accounts, entries), 90000);

  // Overall credit utilization: 90,000 / (200,000 + 150,000) = 90,000 / 350,000 = 25.71% -> 26%
  const util = creditUtilization(accounts, entries);
  assert.equal(util, 26);
});

test('creditLineAvailable handles over-limit debt correctly (clamps to 0)', () => {
  const accounts: Account[] = [
    makeAccount({ id: 'prim1', name: 'SBI SimplyCLICK', creditLimit: 50000 }),
    makeAccount({ id: 'add1', name: 'SBI Add-on', isAddOn: true, primaryCardId: 'prim1' }),
  ];

  const entries: Entry[] = [
    {
      id: 'e1',
      date: '2026-09-01',
      amount: 40000,
      direction: 'out',
      accountId: 'prim1',
      description: 'Spent on primary',
      tags: [],
      source: 'manual',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'e2',
      date: '2026-09-02',
      amount: 25000,
      direction: 'out',
      accountId: 'add1',
      description: 'Spent on add-on',
      tags: [],
      source: 'manual',
      createdAt: '2026-09-02T00:00:00.000Z',
      updatedAt: '2026-09-02T00:00:00.000Z',
    },
  ];

  const primary = accounts[0];
  // Debt is 65,000 against a 50,000 limit
  const debt = creditLineDebt(primary.id, accounts, entries);
  assert.equal(debt, 65000);
  // Available should be 0, not negative
  const avail = creditLineAvailable(primary, accounts, entries);
  assert.equal(avail, 0);
  // Utilization should cap at 100%
  const util = creditUtilization(accounts, entries);
  assert.equal(util, 100);
});

test('primaryCreditCards and addOnCards filtering helpers work accurately', () => {
  const accounts: Account[] = [
    makeAccount({ id: 'p1', name: 'Primary 1' }),
    makeAccount({ id: 'a1', name: 'Addon 1', isAddOn: true, primaryCardId: 'p1' }),
    makeAccount({ id: 'p2', name: 'Primary 2' }),
    makeAccount({ id: 'a2', name: 'Addon 2', isAddOn: true, primaryCardId: 'p2' }),
    makeAccount({ id: 'a3', name: 'Addon 3', isAddOn: true }), // unlinked
    makeAccount({ id: 'p_archived', name: 'Archived Primary', archived: true }),
    makeAccount({ id: 'a_archived', name: 'Archived Addon', isAddOn: true, archived: true }),
  ];

  const primaries = primaryCreditCards(accounts);
  assert.deepEqual(primaries.map((c) => c.id), ['p1', 'p2']);

  const allAddOns = addOnCards(accounts);
  assert.deepEqual(allAddOns.map((c) => c.id), ['a1', 'a2', 'a3']);

  const p1AddOns = addOnCards(accounts, 'p1');
  assert.deepEqual(p1AddOns.map((c) => c.id), ['a1']);
});

test('parseCommand account matching matches specific add-on card by last4 and prefers primary card on generic mentions', () => {
  const accounts: Account[] = [
    makeAccount({ id: 'prim1', name: 'HDFC Regalia', last4: '1111' }),
    makeAccount({ id: 'add1', name: 'Regalia Add-on Card', isAddOn: true, primaryCardId: 'prim1', last4: '2222' }),
  ];

  const ctx = {
    accounts,
    defaultAccountId: 'prim1',
    categories: [],
    rules: [],
    merchants: [],
  };

  // Case 1: SMS mentioning add-on card's last4 matches the add-on card directly
  const parsedAddon = parseCommand('Spent Rs 1500 on card ending 2222 at Starbucks', ctx);
  assert.equal(parsedAddon?.kind, 'entry');
  if (parsedAddon?.kind === 'entry') {
    assert.equal(parsedAddon.entry.accountId, 'add1');
    assert.equal(parsedAddon.entry.amount, 150000); // 1500 Rs = 150,000 paise
  }

  // Case 2: SMS mentioning primary card's last4 matches the primary card
  const parsedPrimary = parseCommand('Spent Rs 3000 on card ending 1111 at Apple', ctx);
  assert.equal(parsedPrimary?.kind, 'entry');
  if (parsedPrimary?.kind === 'entry') {
    assert.equal(parsedPrimary.entry.accountId, 'prim1');
    assert.equal(parsedPrimary.entry.amount, 300000); // 3000 Rs = 300,000 paise
  }

  // Case 3: Generic credit card SMS without card number prefers primary card over add-on card
  const parsedGeneric = parseCommand('Spent Rs 500 on credit card at Grocery', ctx);
  assert.equal(parsedGeneric?.kind, 'entry');
  if (parsedGeneric?.kind === 'entry') {
    assert.equal(parsedGeneric.entry.accountId, 'prim1');
    assert.equal(parsedGeneric.entry.amount, 50000); // 500 Rs = 50,000 paise
  }
});

test('edge case: empty accounts list or no primary cards', () => {
  assert.equal(totalCreditLimit([]), 0);
  assert.equal(creditUtilization([], []), 0);
  assert.deepEqual(primaryCreditCards([]), []);
  assert.deepEqual(addOnCards([]), []);

  // Only add-on cards exist (e.g. user only tracks their add-on card)
  const onlyAddOn = [
    makeAccount({ id: 'addon_only', name: 'Add-on Only', isAddOn: true, creditLimit: 50000 }),
  ];
  assert.equal(totalCreditLimit(onlyAddOn), 0); // Must be 0 because it's not a primary credit line!
  assert.deepEqual(primaryCreditCards(onlyAddOn), []);
  assert.equal(addOnCards(onlyAddOn).length, 1);
});

test('edge case: positive balances (refund / surplus) do not create debt or distort limit', () => {
  const accounts: Account[] = [
    makeAccount({ id: 'prim1', name: 'Primary Card', creditLimit: 100000, openingBalance: 10000 }), // positive surplus
    makeAccount({ id: 'add1', name: 'Add-on Card', isAddOn: true, primaryCardId: 'prim1', openingBalance: 5000 }), // positive surplus
  ];

  // No negative balance = 0 debt
  assert.equal(creditLineDebt('prim1', accounts, []), 0);
  assert.equal(totalCreditCardDebt(accounts, []), 0);
  // Full limit is available
  assert.equal(creditLineAvailable(accounts[0], accounts, []), 100000);
  assert.equal(creditUtilization(accounts, []), 0);
});

test('edge case: bill payment transfer to add-on card clears add-on debt and restores line availability', () => {
  const accounts: Account[] = [
    makeAccount({ id: 'bank1', name: 'HDFC Bank', type: 'bank', openingBalance: 100000 }),
    makeAccount({ id: 'prim1', name: 'Primary Card', creditLimit: 100000 }),
    makeAccount({ id: 'add1', name: 'Add-on Card', isAddOn: true, primaryCardId: 'prim1' }),
  ];

  // Spend 20,000 on add-on card
  const spendEntry: Entry = {
    id: 'e1',
    date: '2026-09-01',
    amount: 20000,
    direction: 'out',
    accountId: 'add1',
    description: 'Shopping',
    tags: [],
    source: 'manual',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };

  assert.equal(creditLineDebt('prim1', accounts, [spendEntry]), 20000);
  assert.equal(creditLineAvailable(accounts[1], accounts, [spendEntry]), 80000);

  // Pay 20,000 bill from bank to add-on card
  const paymentEntry: Entry = {
    id: 'e2',
    date: '2026-09-02',
    amount: 20000,
    direction: 'transfer',
    accountId: 'bank1',
    counterAccountId: 'add1',
    description: 'Pay Add-on Bill',
    tags: ['bill-payment'],
    source: 'manual',
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
  };

  const allEntries = [spendEntry, paymentEntry];
  const balances = accountBalances(accounts, allEntries);
  assert.equal(balances.get('add1'), 0);
  assert.equal(creditLineDebt('prim1', accounts, allEntries), 0);
  assert.equal(creditLineAvailable(accounts[1], accounts, allEntries), 100000);
  assert.equal(totalCreditCardDebt(accounts, allEntries), 0);
});

test('consolidated bill payment to PRIMARY card clears entire credit line debt (including add-on card spends)', () => {
  const accounts: Account[] = [
    makeAccount({ id: 'bank1', name: 'HDFC Bank', type: 'bank', openingBalance: 200000 }),
    makeAccount({ id: 'prim1', name: 'Primary Card', creditLimit: 100000 }),
    makeAccount({ id: 'add1', name: 'Add-on Card', isAddOn: true, primaryCardId: 'prim1' }),
  ];

  // Primary spends 15,000, Add-on spends 10,000 -> Total line debt = 25,000
  const spend1: Entry = {
    id: 's1',
    date: '2026-09-01',
    amount: 15000,
    direction: 'out',
    accountId: 'prim1',
    description: 'Primary Card Spend',
    tags: [],
    source: 'manual',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
  const spend2: Entry = {
    id: 's2',
    date: '2026-09-02',
    amount: 10000,
    direction: 'out',
    accountId: 'add1',
    description: 'Add-on Card Spend',
    tags: [],
    source: 'manual',
    createdAt: '2026-09-02T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
  };

  assert.equal(creditLineDebt('prim1', accounts, [spend1, spend2]), 25000);
  assert.equal(totalCreditCardDebt(accounts, [spend1, spend2]), 25000);
  assert.equal(creditLineAvailable(accounts[1], accounts, [spend1, spend2]), 75000);
  assert.equal(creditUtilization(accounts, [spend1, spend2]), 25);

  // User pays 25,000 consolidated bill by transferring to PRIMARY card
  const payBill: Entry = {
    id: 'p1',
    date: '2026-09-05',
    amount: 25000,
    direction: 'transfer',
    accountId: 'bank1',
    counterAccountId: 'prim1', // Bank to PRIMARY card
    description: 'Pay HDFC Consolidated CC Bill',
    tags: ['bill-payment'],
    source: 'manual',
    createdAt: '2026-09-05T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z',
  };

  const entriesWithPayment = [spend1, spend2, payBill];
  const balances = accountBalances(accounts, entriesWithPayment);
  // prim1 balance is +10,000, add1 balance is -10,000
  assert.equal(balances.get('prim1'), 10000);
  assert.equal(balances.get('add1'), -10000);

  // Line debt must be 0! The primary payment fully netted against the add-on spend!
  assert.equal(creditLineDebt('prim1', accounts, entriesWithPayment), 0);
  // Available limit on the line must be fully restored to 100,000
  assert.equal(creditLineAvailable(accounts[1], accounts, entriesWithPayment), 100000);
  // Total credit card debt must be 0
  assert.equal(totalCreditCardDebt(accounts, entriesWithPayment), 0);
  // Credit utilization must be 0
  assert.equal(creditUtilization(accounts, entriesWithPayment), 0);
});

test('partial bill payment to primary card nets proportionally across credit line', () => {
  const accounts: Account[] = [
    makeAccount({ id: 'bank1', name: 'Bank', type: 'bank' }),
    makeAccount({ id: 'prim1', name: 'Primary Card', creditLimit: 100000 }),
    makeAccount({ id: 'add1', name: 'Add-on Card', isAddOn: true, primaryCardId: 'prim1' }),
  ];

  // Spend 10,000 on primary, 10,000 on add-on (Total 20,000)
  const entries: Entry[] = [
    { id: 's1', date: '2026-09-01', amount: 10000, direction: 'out', accountId: 'prim1', description: '', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
    { id: 's2', date: '2026-09-02', amount: 10000, direction: 'out', accountId: 'add1', description: '', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
    // Pay 15,000 to primary card
    { id: 'p1', date: '2026-09-05', amount: 15000, direction: 'transfer', accountId: 'bank1', counterAccountId: 'prim1', description: '', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
  ];

  // Remaining line debt is 20,000 - 15,000 = 5,000
  assert.equal(creditLineDebt('prim1', accounts, entries), 5000);
  assert.equal(totalCreditCardDebt(accounts, entries), 5000);
  assert.equal(creditLineAvailable(accounts[1], accounts, entries), 95000);
  assert.equal(creditUtilization(accounts, entries), 5);
});

test('surplus on one primary line does NOT offset debt on an unrelated primary line', () => {
  const accounts: Account[] = [
    makeAccount({ id: 'prim1', name: 'HDFC Regalia', creditLimit: 100000, openingBalance: 10000 }), // 10,000 surplus
    makeAccount({ id: 'prim2', name: 'ICICI Sapphiro', creditLimit: 100000 }),
  ];

  const entries: Entry[] = [
    // Spend 20,000 on Sapphiro
    { id: 's1', date: '2026-09-01', amount: 20000, direction: 'out', accountId: 'prim2', description: '', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
  ];

  // Regalia has surplus, so 0 debt
  assert.equal(creditLineDebt('prim1', accounts, entries), 0);
  // Sapphiro has 20,000 debt
  assert.equal(creditLineDebt('prim2', accounts, entries), 20000);

  // Total debt must be 20,000, NOT 10,000 (Regalia surplus cannot reduce Sapphiro debt)
  assert.equal(totalCreditCardDebt(accounts, entries), 20000);
  // Overall utilization = 20,000 / 200,000 = 10%
  assert.equal(creditUtilization(accounts, entries), 10);
});

test('archiving a primary card preserves orphaned add-on card debt but excludes limit', () => {
  const accounts: Account[] = [
    makeAccount({ id: 'prim1', name: 'Old Card', creditLimit: 100000, archived: true }),
    makeAccount({ id: 'add1', name: 'Active Addon', isAddOn: true, primaryCardId: 'prim1' }),
    makeAccount({ id: 'prim2', name: 'New Card', creditLimit: 50000 }),
  ];

  const entries: Entry[] = [
    // 15,000 spend on orphaned add-on card
    { id: 's1', date: '2026-09-01', amount: 15000, direction: 'out', accountId: 'add1', description: '', tags: [], source: 'manual', createdAt: '', updatedAt: '' },
  ];

  // Only prim2's limit is recognized as active primary credit limit (50,000)
  assert.equal(totalCreditLimit(accounts), 50000);
  // The orphaned add-on card debt is NOT lost
  assert.equal(totalCreditCardDebt(accounts, entries), 15000);
  // Overall utilization: 15,000 / 50,000 = 30%
  assert.equal(creditUtilization(accounts, entries), 30);
});

test('parseCommand prioritizes primary credit card when SMS mentions bank keyword and credit card', () => {
  const accounts: Account[] = [
    makeAccount({ id: 'b1', name: 'HDFC Bank Account', type: 'bank' }),
    makeAccount({ id: 'prim1', name: 'HDFC Regalia Credit Card', type: 'card' }),
    makeAccount({ id: 'add1', name: 'HDFC Regalia Add-on Card', type: 'card', isAddOn: true, primaryCardId: 'prim1' }),
  ];

  const ctx = {
    accounts,
    defaultAccountId: 'b1',
    categories: [],
    rules: [],
    merchants: [],
  };

  const parsed = parseCommand('Spent Rs 1200 on HDFC credit card at Swiggy', ctx);
  assert.equal(parsed?.kind, 'entry');
  if (parsed?.kind === 'entry') {
    // Should match the primary credit card, NOT the deposit bank account
    assert.equal(parsed.entry.accountId, 'prim1');
    assert.equal(parsed.entry.amount, 120000);
  }
});
