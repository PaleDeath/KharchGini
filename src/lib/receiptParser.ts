

interface ReceiptData {
  amount: number | null;
  date: Date | null;
  merchant: string | null;
  confidence: number;
}

export function extractReceiptData(text: string): ReceiptData {
  const data: ReceiptData = {
    amount: null,
    date: null,
    merchant: null,
    confidence: 0,
  };

  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

  // --- 1. Amount Extraction ---
  // Look for "Total", "Grand Total", "Amount", "Rs", "₹"
  // Regex: /(?:total|amount).*?(?:₹|rs\.?)\s*([\d,]+(?:\.\d{2})?)/i
  // Handle "1,234.56" and "1234.56" formats

  // Strategy:
  // 1. Prioritize lines containing "Total", "Grand Total", "Amount Payable", etc.
  // 2. If found, look for currency symbols or numbers at the end of the line.
  // 3. Fallback: look for currency symbols anywhere.

  // Regex for Amount:
  // Matches "Total: Rs 1,234.56", "Amount ₹ 500", "Total 1234.56"
  // Group 1: The number part
  const amountRegex = /(?:total|amount|grand total|payable|net).*?(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{2})?)/i;

  // Regex for just currency symbol + amount
  const currencyAmountRegex = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{2})?)/i;

  let amountFound = false;

  // First pass: look for explicit "Total" keywords
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (/(?:total|amount|payable|net)/i.test(line)) {
      const match = line.match(amountRegex);
      if (match && match[1]) {
        const cleanAmount = match[1].replace(/,/g, '');
        const amount = parseFloat(cleanAmount);
        if (!isNaN(amount)) {
          data.amount = amount;
          amountFound = true;
          break; // Assume the last "Total" line is the correct one
        }
      }
    }
  }

  // Second pass: if no explicit total found, look for currency symbols
  if (!amountFound) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const match = line.match(currencyAmountRegex);
      if (match && match[1]) {
        const cleanAmount = match[1].replace(/,/g, '');
        const amount = parseFloat(cleanAmount);
        if (!isNaN(amount)) {
          data.amount = amount;
          amountFound = true;
          break;
        }
      }
    }
  }

  // --- 2. Date Extraction ---
  // DD/MM/YYYY, DD-MM-YY, "25 Feb 2026" patterns

  // Regex for DD/MM/YYYY or DD-MM-YY or DD.MM.YYYY
  // separators: / - .
  const dateRegex1 = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/;

  // Regex for "25 Feb 2026" or "25-Feb-2026"
  const dateRegex2 = /\b(\d{1,2})[\s-]*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s-]*(\d{4})\b/i;

  // Regex for YYYY-MM-DD (ISO)
  const dateRegex3 = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/;

  for (const line of lines) {
    if (data.date) break;

    let match = line.match(dateRegex1);
    if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // 0-indexed
        let year = parseInt(match[3], 10);
        if (year < 100) year += 2000; // simplistic assumption

        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) {
            data.date = d;
            break;
        }
    }

    match = line.match(dateRegex2);
    if (match) {
        const day = parseInt(match[1], 10);
        const monthStr = match[2];
        const year = parseInt(match[3], 10);

        // Use Date.parse for "25 Feb 2026"
        const dateString = `${day} ${monthStr} ${year}`;
        const d = new Date(dateString);
         if (!isNaN(d.getTime())) {
            data.date = d;
            break;
        }
    }

    match = line.match(dateRegex3);
    if (match) {
        const d = new Date(match[0]);
        if (!isNaN(d.getTime())) {
            data.date = d;
            break;
        }
    }
  }


  // --- 3. Merchant Extraction ---
  // Text before/after amount, look for capitalized words.
  // Heuristic: The merchant name is often the first significant line of text.
  // Ignore lines that look like addresses, phone numbers, or common receipt headers (Tax Invoice, etc.)

  const ignoreRegex = /tax invoice|bill of supply|cash memo|gst|ph:|tel:|date:|time:|total|amount/i;

  for (const line of lines) {
      if (ignoreRegex.test(line)) continue;

      // Look for lines that start with a capital letter and have at least 3 chars
      if (/^[A-Z][a-zA-Z0-9\s'&.]+$/.test(line) && line.length > 3) {
          // Additional check: exclude if it looks like a date
          if (dateRegex1.test(line) || dateRegex2.test(line) || dateRegex3.test(line)) continue;

          data.merchant = line;
          break; // Take the first likely candidate
      }
  }

  // --- 4. Confidence Scoring ---
  let score = 0;
  if (data.amount !== null) score += 0.4;
  if (data.date !== null) score += 0.3;
  if (data.merchant !== null) score += 0.3;

  // Round to 1 decimal place
  data.confidence = Math.round(score * 10) / 10;

  return data;
}
