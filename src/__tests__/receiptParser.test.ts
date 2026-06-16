import { extractReceiptData } from '../lib/receiptParser';

describe('extractReceiptData', () => {
  test('extracts basic receipt data correctly', () => {
    const text = `
      BIG BAZAAR
      Store #1234
      Date: 25/02/2026

      Item 1    100.00
      Item 2    200.00

      Total Amount: ₹ 300.00
      GST Included
    `;
    const result = extractReceiptData(text);
    expect(result.amount).toBe(300);
    expect(result.merchant).toBe('BIG BAZAAR');
    expect(result.date?.getDate()).toBe(25);
    expect(result.date?.getMonth()).toBe(1); // February is 1
    expect(result.date?.getFullYear()).toBe(2026);
    expect(result.confidence).toBe(1);
  });

  test('handles different currency formats (Rs, INR, ₹)', () => {
    const rsText = 'Total: Rs. 450.50';
    const inrText = 'Amount Payable: 1,200 INR';
    const symbolText = 'Net Amount: ₹500';

    expect(extractReceiptData(rsText).amount).toBe(450.5);
    expect(extractReceiptData(inrText).amount).toBe(1200);
    expect(extractReceiptData(symbolText).amount).toBe(500);
  });

  test('handles various date formats', () => {
    const formats = [
      { text: 'Date: 25-02-2026', expected: [2026, 1, 25] },
      { text: '25 Feb 2026', expected: [2026, 1, 25] },
      { text: '2026-02-25', expected: [2026, 1, 25] },
      { text: '25.02.26', expected: [2026, 1, 25] },
    ];

    formats.forEach(({ text, expected }) => {
      const result = extractReceiptData(text);
      expect(result.date?.getFullYear()).toBe(expected[0]);
      expect(result.date?.getMonth()).toBe(expected[1]);
      expect(result.date?.getDate()).toBe(expected[2]);
    });
  });

  test('extracts merchant using heuristics', () => {
    const text = `
      STARBUCKS COFFEE
      Terminal 3, IGI Airport
      New Delhi
      GSTIN: 07AAACT1234L1Z1

      Total: 550.00
    `;
    const result = extractReceiptData(text);
    expect(result.merchant).toBe('STARBUCKS COFFEE');
  });

  test('ignores common headers when searching for merchant', () => {
    const text = `
      TAX INVOICE
      RELIANCE FRESH
      Sector 15, Gurgaon

      Amount: 150
    `;
    const result = extractReceiptData(text);
    expect(result.merchant).toBe('RELIANCE FRESH');
  });

  test('handles multiple total-like lines (takes the last one)', () => {
    const text = `
      Subtotal: 1000.00
      Discount: 100.00
      Total: 900.00
      Cash: 1000.00
    `;
    // The current implementation looks for "Total" and breaks at the first one from the bottom
    // So "Total: 900.00" should be preferred over "Subtotal" or "Cash" (if it matches the regex)
    const result = extractReceiptData(text);
    expect(result.amount).toBe(900);
  });

  test('handles missing information gracefully', () => {
    const result = extractReceiptData('no data here 123');
    expect(result.amount).toBeNull();
    expect(result.date).toBeNull();
    expect(result.merchant).toBeNull();
    expect(result.confidence).toBe(0);
  });

  test('calculates confidence correctly', () => {
    const textOnlyAmount = 'Total: 500';
    const textAmountDate = 'Total: 500\nDate: 25/02/2026';

    expect(extractReceiptData(textOnlyAmount).confidence).toBe(0.4);
    expect(extractReceiptData(textAmountDate).confidence).toBe(0.7);
  });

  test('handles comma in amounts', () => {
    const text = 'Total: Rs. 1,23,456.78';
    const result = extractReceiptData(text);
    expect(result.amount).toBe(123456.78);
  });
});
