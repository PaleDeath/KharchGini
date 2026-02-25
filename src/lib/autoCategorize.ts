interface CategorizationResult {
  category: string;
  merchant: string;
  confidence: number;
}

const KEYWORD_MAP: Record<string, string[]> = {
  "Food & Dining": ["SWIGGY", "ZOMATO", "UBER EATS", "FOODPANDA", "RESTAURANT", "CAFE", "DINING", "BURGER", "PIZZA"],
  "Shopping": ["AMAZON", "FLIPKART", "MYNTRA", "AJIO", "RELIANCE", "SHOPPING", "CLOTHES", "ELECTRONICS"],
  "Fuel": ["PETROL", "FUEL", "SHELL", "INDIAN OIL", "HPCL", "BPCL"],
  "Cash Withdrawal": ["ATM", "CASH WITHDRAWAL", "NFS"],
  "Transfer": ["NEFT", "IMPS", "RTGS", "UPI-TRANSFER", "TRANSFER"],
  "Income": ["INTEREST", "CASHBACK", "SALARY", "CREDIT", "REFUND", "DIVIDEND"],
  "Transportation": ["UBER", "OLA", "RAPIDO", "METRO", "BUS", "TAXI"],
  "Bills & Utilities": ["ELECTRICITY", "WATER", "GAS", "MOBILE", "INTERNET", "BROADBAND", "RECHARGE", "BILL"],
  "Healthcare": ["HOSPITAL", "PHARMACY", "DOCTOR", "MEDICAL", "CLINIC"],
  "Entertainment": ["MOVIE", "NETFLIX", "HOTSTAR", "PRIME VIDEO", "CINEMA", "THEATRE"]
};

// Invert the map for faster lookup
const CATEGORY_KEYWORDS: Record<string, string> = {};
Object.entries(KEYWORD_MAP).forEach(([category, keywords]) => {
  keywords.forEach(keyword => {
    CATEGORY_KEYWORDS[keyword] = category;
  });
});

export function extractMerchant(description: string): string {
  if (!description) return "";

  // Clean description
  let cleanDesc = description.toUpperCase();

  // Try to extract from UPI format: "UPI-MERCHANT-..." or "MERCHANT@BANK"
  // Common patterns in statements:
  // "UPI-ZOMATO-123456" -> ZOMATO
  // "VINAY KUMAR/8904..." -> VINAY KUMAR
  // "POS 123456 FLIPKART" -> FLIPKART

  // 1. UPI ID simple extraction
  // Often format is "UPI/12345/MERCHANT/..." or "UPI-MERCHANT-..."
  if (cleanDesc.includes('UPI')) {
    const parts = cleanDesc.split(/[-/ ]/);
    // Filter out numbers and common words
    const potentialMerchants = parts.filter(p =>
      !p.match(/^\d+$/) &&
      p !== 'UPI' &&
      p.length > 2
    );
    if (potentialMerchants.length > 0) {
      // Heuristic: usually the first non-numeric non-UPI part
      return potentialMerchants[0];
    }
  }

  // 2. Remove common prefixes
  const prefixes = ['POS', 'ECOM', 'PUR', 'ACH', 'NEFT', 'IMPS', 'ATM', 'CASH WDL', 'WDL'];
  for (const prefix of prefixes) {
    if (cleanDesc.startsWith(prefix)) {
      cleanDesc = cleanDesc.substring(prefix.length).trim();
    }
  }

  // Remove numbers and special chars at the end
  cleanDesc = cleanDesc.replace(/[\d\W]+$/, '').trim();

  // If we extracted something reasonably short, return it
  if (cleanDesc.length > 1 && cleanDesc.length < 30) {
    return cleanDesc;
  }

  return description;
}

export function categorizeTransaction(description: string, amount: number, type: string): CategorizationResult {
  const merchant = extractMerchant(description);
  const upperDesc = description.toUpperCase();

  // 1. Exact/Strong Keyword Match
  for (const [keyword, category] of Object.entries(CATEGORY_KEYWORDS)) {
    if (upperDesc.includes(keyword)) {
      return {
        category,
        merchant,
        confidence: 0.9 // High confidence
      };
    }
  }

  // 2. Type-based default
  if (type === 'income') {
    return {
      category: 'Income',
      merchant,
      confidence: 0.5
    };
  }

  // 3. Amount-based heuristics (very weak, mostly for "Transfer" vs "Expense")
  // Could be added here but unreliable without context.

  return {
    category: 'Uncategorized', // Or 'Miscellaneous'
    merchant,
    confidence: 0
  };
}
