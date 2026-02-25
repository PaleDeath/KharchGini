export interface ParsedTransaction {
  amount: number | null;
  category: string | null;
  type: 'income' | 'expense';
  description: string;
  confidence: number;
}

const EXPENSE_KEYWORDS = ['spent', 'paid', 'bought', 'purchased', 'cost', 'expense', 'bill', 'charged', 'debit', 'deducted'];
const INCOME_KEYWORDS = ['received', 'salary', 'credited', 'income', 'earned', 'got', 'deposit', 'added'];

const CATEGORY_MAP: Record<string, string> = {
  // Food & Dining
  'food': 'Food & Dining',
  'lunch': 'Food & Dining',
  'dinner': 'Food & Dining',
  'breakfast': 'Food & Dining',
  'snack': 'Food & Dining',
  'snacks': 'Food & Dining',
  'restaurant': 'Food & Dining',
  'zomato': 'Food & Dining',
  'swiggy': 'Food & Dining',
  'cafe': 'Food & Dining',
  'coffee': 'Food & Dining',
  'tea': 'Food & Dining',

  // Transportation (Fuel)
  'petrol': 'Transportation',
  'fuel': 'Transportation',
  'diesel': 'Transportation',
  'gas': 'Transportation',
  'uber': 'Transportation',
  'ola': 'Transportation',
  'taxi': 'Transportation',
  'cab': 'Transportation',
  'bus': 'Transportation',
  'train': 'Transportation',
  'flight': 'Transportation',

  // Bills & Utilities (Housing/Rent)
  'rent': 'Bills & Utilities',
  'housing': 'Bills & Utilities',
  'bill': 'Bills & Utilities',
  'utility': 'Bills & Utilities',
  'electricity': 'Bills & Utilities',
  'water': 'Bills & Utilities',
  'internet': 'Bills & Utilities',
  'wifi': 'Bills & Utilities',
  'recharge': 'Bills & Utilities',
  'mobile': 'Bills & Utilities',

  // Shopping
  'shopping': 'Shopping',
  'clothes': 'Shopping',
  'amazon': 'Shopping',
  'flipkart': 'Shopping',
  'myntra': 'Shopping',
  'grocery': 'Shopping',
  'groceries': 'Shopping',

  // Entertainment
  'movie': 'Entertainment',
  'cinema': 'Entertainment',
  'netflix': 'Entertainment',

  // Healthcare
  'medicine': 'Healthcare',
  'doctor': 'Healthcare',
  'hospital': 'Healthcare',
  'pharmacy': 'Healthcare',

  // Income specific
  'salary': 'Salary',
};

const NUMBER_WORDS: Record<string, number> = {
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
  'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
  'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
  'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
  'hundred': 100, 'thousand': 1000, 'lakh': 100000, 'crore': 10000000,
  'k': 1000, 'm': 1000000
};

const MULTIPLIERS = ['hundred', 'thousand', 'lakh', 'crore', 'k', 'm'];

function convertWordsToNumbers(text: string): string {
  const words = text.toLowerCase().split(/(\s+)/);
  let result: string[] = [];
  let currentNumber = 0;
  let currentSegment = 0;
  let isBuildingNumber = false;

  const flushNumber = () => {
    if (isBuildingNumber) {
      currentNumber += currentSegment;
      result.push(' ' + currentNumber.toString() + ' '); // Ensure spaces around number
      currentNumber = 0;
      currentSegment = 0;
      isBuildingNumber = false;
    }
  };

  for (let i = 0; i < words.length; i++) {
    const rawWord = words[i];
    const word = rawWord.toLowerCase().trim().replace(/,/g, '');

    if (!word && rawWord.length > 0) {
        // preserve whitespace if not building number
        if (!isBuildingNumber) result.push(rawWord);
        continue;
    }
    if (!word) continue;

    const val = NUMBER_WORDS[word];

    if (val !== undefined) {
      if (!isBuildingNumber) {
          isBuildingNumber = true;
          currentNumber = 0;
          currentSegment = 0;
      }

      if (MULTIPLIERS.includes(word)) {
        if (currentSegment === 0) currentSegment = 1;
        currentSegment *= val;

        if (val >= 1000) {
          currentNumber += currentSegment;
          currentSegment = 0;
        }
      } else {
        currentSegment += val;
      }
    } else if (word === 'and' && isBuildingNumber) {
      continue;
    } else {
      flushNumber();
      result.push(rawWord);
    }
  }
  flushNumber();

  return result.join('').replace(/\s+/g, ' ').trim();
}

export function parseCommand(transcript: string): ParsedTransaction {
  // Convert number words to digits first
  const normalizedTranscript = convertWordsToNumbers(transcript);
  const lowerTranscript = normalizedTranscript.toLowerCase();

  // Extract Amount using Regex
  // Matches: 500, 1,000, 10.50
  const amountRegex = /(\d+(?:,\d+)*(?:\.\d{1,2})?)/g;
  const numberMatches = Array.from(lowerTranscript.matchAll(amountRegex));

  let bestAmount: number | null = null;
  let bestConfidence = 0;

  for (const match of numberMatches) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      // Basic confidence starts at 0.5 (found a number)
      let confidence = 0.5;

      const index = match.index || 0;
      const before = lowerTranscript.substring(Math.max(0, index - 20), index); // Increased context window
      const after = lowerTranscript.substring(index + match[0].length, index + match[0].length + 20);

      // Check context for currency symbols/words
      if (/(rs|inr|rupees?|₹)/.test(before) || /(rs|inr|rupees?|₹)/.test(after)) {
          confidence += 0.4;
      }

      // If it's the only number, boost confidence
      if (numberMatches.length === 1) {
          confidence += 0.2;
      }

      if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestAmount = val;
      }
  }

  // Detect Type
  let type: 'income' | 'expense' = 'expense'; // Default to expense
  let typeDetected = false;

  if (INCOME_KEYWORDS.some(k => lowerTranscript.includes(k))) {
    type = 'income';
    typeDetected = true;
  } else if (EXPENSE_KEYWORDS.some(k => lowerTranscript.includes(k))) {
    type = 'expense';
    typeDetected = true;
  }

  // Detect Category
  let category: string | null = null;
  const categoryKeys = Object.keys(CATEGORY_MAP).sort((a, b) => b.length - a.length); // Match longest keywords first

  for (const key of categoryKeys) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escapedKey}\\b`, 'i').test(lowerTranscript)) {
      category = CATEGORY_MAP[key];

      // Auto-switch type based on specific categories if type wasn't explicitly stated
      if (!typeDetected) {
        if (['Salary', 'Business Income', 'Investment Returns', 'Rental Income'].includes(category)) {
          type = 'income';
        } else {
          type = 'expense';
        }
      }
      break;
    }
  }

  // Calculate Final Confidence
  let confidence = 0;
  if (bestAmount !== null && category !== null) {
      confidence = 1.0;
  } else if (bestAmount !== null || category !== null) {
      confidence = 0.5;
  } else {
      confidence = 0;
  }

  // Clean description
  let description = transcript.trim();
  // Capitalize first letter
  if (description.length > 0) {
      description = description.charAt(0).toUpperCase() + description.slice(1);
  }

  return {
    amount: bestAmount,
    category,
    type,
    description,
    confidence
  };
}
