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
  // Food
  'food': 'Food & Dining',
  'lunch': 'Food & Dining',
  'dinner': 'Food & Dining',
  'breakfast': 'Food & Dining',
  'snack': 'Food & Dining',
  'snacks': 'Food & Dining',
  'restaurant': 'Food & Dining',
  'dining': 'Food & Dining',
  'grocery': 'Food & Dining',
  'groceries': 'Food & Dining',
  'zomato': 'Food & Dining',
  'swiggy': 'Food & Dining',

  // Transportation
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
  'transport': 'Transportation',
  'commute': 'Transportation',

  // Shopping
  'shopping': 'Shopping',
  'clothes': 'Shopping',
  'clothing': 'Shopping',
  'amazon': 'Shopping',
  'flipkart': 'Shopping',
  'myntra': 'Shopping',

  // Bills & Utilities
  'rent': 'Bills & Utilities',
  'bill': 'Bills & Utilities',
  'utility': 'Bills & Utilities',
  'electricity': 'Bills & Utilities',
  'water': 'Bills & Utilities',
  'internet': 'Bills & Utilities',
  'wifi': 'Bills & Utilities',
  'phone': 'Bills & Utilities',
  'mobile': 'Bills & Utilities',
  'recharge': 'Bills & Utilities',

  // Entertainment
  'movie': 'Entertainment',
  'cinema': 'Entertainment',
  'netflix': 'Entertainment',
  'prime': 'Entertainment',
  'hotstar': 'Entertainment',
  'game': 'Entertainment',

  // Healthcare
  'medicine': 'Healthcare',
  'doctor': 'Healthcare',
  'hospital': 'Healthcare',
  'pharmacy': 'Healthcare',
  'health': 'Healthcare',

  // Income
  'salary': 'Salary',
  'wages': 'Salary',
  'paycheck': 'Salary',
  'freelance': 'Business Income',
  'business': 'Business Income',
  'dividend': 'Investment Returns',
  'interest': 'Investment Returns',
  'rent received': 'Rental Income',
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

export function parseVoiceCommand(transcript: string): ParsedTransaction {
  const normalizedTranscript = convertWordsToNumbers(transcript);
  const lowerTranscript = normalizedTranscript.toLowerCase();

  // Extract Amount
  const numberMatches = lowerTranscript.matchAll(/(\d+(?:,\d+)*(?:\.\d{1,2})?)/g);
  let bestAmount: number | null = null;
  let bestConfidence = 0;

  for (const match of numberMatches) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      let confidence = 0.5;

      const index = match.index || 0;
      const before = lowerTranscript.substring(Math.max(0, index - 10), index);
      const after = lowerTranscript.substring(index + match[0].length, index + match[0].length + 10);

      if (/(rs|inr|rupees?|₹)/.test(before) || /(rs|inr|rupees?|₹)/.test(after)) {
          confidence += 0.4;
      }

      if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestAmount = val;
      }
  }

  // Detect Type
  let type: 'income' | 'expense' = 'expense';
  let typeConfidence = 0;

  if (INCOME_KEYWORDS.some(k => lowerTranscript.includes(k))) {
    type = 'income';
    typeConfidence = 0.8;
  } else if (EXPENSE_KEYWORDS.some(k => lowerTranscript.includes(k))) {
    type = 'expense';
    typeConfidence = 0.8;
  }

  // Detect Category
  let category: string | null = null;
  const categoryKeys = Object.keys(CATEGORY_MAP).sort((a, b) => b.length - a.length);

  for (const key of categoryKeys) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Use \\b for word boundary in RegExp string
    if (new RegExp(`\\b${escapedKey}\\b`, 'i').test(lowerTranscript)) {
      category = CATEGORY_MAP[key];

      if (typeConfidence < 0.8) {
        if (['Salary', 'Business Income', 'Investment Returns', 'Rental Income', 'Other Income'].includes(category)) {
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
  if (bestAmount !== null) confidence += 0.4;
  if (category !== null) confidence += 0.3;
  if (typeConfidence > 0) confidence += 0.2;
  if (bestAmount !== null && category !== null) confidence += 0.1;

  confidence = Math.min(confidence, 1.0);
  if (bestAmount === null) confidence = 0;

  return {
    amount: bestAmount,
    category,
    type,
    description: transcript.trim(),
    confidence
  };
}
