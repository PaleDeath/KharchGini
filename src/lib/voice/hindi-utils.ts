export const hindiNumberMap: Record<string, number> = {
  // 0-9
  'shunya': 0, 'zero': 0,
  'ek': 1, 'ik': 1, 'one': 1,
  'do': 2, 'two': 2,
  'teen': 3, 'tin': 3, 'three': 3,
  'chaar': 4, 'char': 4, 'four': 4,
  'paanch': 5, 'panch': 5, 'five': 5,
  'che': 6, 'chah': 6, 'six': 6,
  'saat': 7, 'sat': 7, 'seven': 7,
  'aath': 8, 'ath': 8, 'eight': 8,
  'nau': 9, 'no': 9, 'nine': 9,
  'das': 10, 'ten': 10,

  // 11-19
  'gyarah': 11, 'eleven': 11,
  'barah': 12, 'twelve': 12,
  'terah': 13, 'thirteen': 13,
  'chaudah': 14, 'fourteen': 14,
  'pandrah': 15, 'fifteen': 15,
  'solah': 16, 'sixteen': 16,
  'satrah': 17, 'seventeen': 17,
  'atharah': 18, 'eighteen': 18,
  'unnis': 19, 'nineteen': 19,

  // 20-29
  'bees': 20, 'twenty': 20,
  'ikkis': 21,
  'baees': 22,
  'teees': 23,
  'chaubis': 24,
  'pachees': 25,
  'chabbees': 26,
  'sattaees': 27,
  'atthaees': 28,
  'unatis': 29,

  // 30-39
  'tees': 30, 'thirty': 30,
  'ikatis': 31,
  'battis': 32,
  'tentis': 33,
  'chauntis': 34,
  'paintis': 35,
  'chhattis': 36,
  'saintis': 37,
  'adatis': 38,
  'unchalis': 39,

  // 40-49
  'chalis': 40, 'forty': 40,
  'iktalis': 41,
  'bayalis': 42,
  'taitalis': 43,
  'chawalis': 44,
  'paintalis': 45,
  'chhiyalis': 46,
  'saintalis': 47,
  'adtalis': 48,
  'unchas': 49,

  // 50-59
  'pachas': 50, 'fifty': 50,
  'ikyanwan': 51,
  'bawan': 52,
  'tirepan': 53,
  'chauwan': 54,
  'pachpan': 55,
  'chhappan': 56,
  'sattawan': 57,
  'atthawan': 58,
  'unsath': 59,

  // 60-69
  'saath': 60, 'sixty': 60,
  'iksath': 61,
  'basath': 62,
  'tirsath': 63,
  'chaunsath': 64,
  'painsath': 65,
  'chiyasath': 66,
  'sadsath': 67,
  'adsath': 68,
  'unhattar': 69,

  // 70-79
  'sattar': 70, 'seventy': 70,
  'ikhattar': 71,
  'bahattar': 72,
  'tihattar': 73,
  'chauhattar': 74,
  'pachhattar': 75,
  'chhihattar': 76,
  'sathattar': 77,
  'athhattar': 78,
  'unasi': 79,

  // 80-89
  'assi': 80, 'eighty': 80,
  'ikyasi': 81,
  'bayasi': 82,
  'tirasi': 83,
  'chaurasi': 84,
  'pachasi': 85,
  'chhiyasi': 86,
  'sataasi': 87,
  'athasi': 88,
  'navasi': 89,

  // 90-99
  'nabbe': 90, 'ninety': 90,
  'ikyanve': 91, 'banve': 92, 'tiranve': 93, 'chauranve': 94, 'pachanve': 95,
  'chhiyanve': 96, 'sattanve': 97, 'atthanve': 98, 'ninnanve': 99,

  // Multipliers
  'sau': 100, 'hundred': 100,
  'hazaar': 1000, 'hazar': 1000, 'thousand': 1000, 'k': 1000,
  'lakh': 100000, 'lac': 100000,
  'crore': 10000000, 'kror': 10000000,
};

export const parseHindiNumbers = (text: string): string => {
  if (!text) return text;

  const words = text.toLowerCase().split(/\s+/);
  const result: string[] = [];

  let currentTotal = 0;
  let currentSegment = 0;
  let isParsingNumber = false;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    // Remove punctuation but keep decimal points for digits
    const cleanWord = word.replace(/[^a-z0-9.]/g, '');

    // Check if word is a number word or a digit
    const isNumberWord = Object.prototype.hasOwnProperty.call(hindiNumberMap, cleanWord);
    const isDigit = /^\d+(\.\d+)?$/.test(cleanWord);

    if (isNumberWord || isDigit) {
      isParsingNumber = true;
      let value = 0;

      if (isDigit) {
        value = parseFloat(cleanWord);
      } else {
        value = hindiNumberMap[cleanWord];
      }

      if (value >= 1000) {
        // Multiplier >= 1000 (hazaar, lakh, crore)
        const multiplier = Math.max(currentSegment, 1);
        currentTotal += multiplier * value;
        currentSegment = 0;
      } else if (value === 100) {
        // Multiplier 100 (sau)
        const multiplier = Math.max(currentSegment, 1);
        currentSegment = multiplier * 100;
      } else {
        // Number < 100
        currentSegment += value;
      }
    } else {
      // Not a number word.
      if (isParsingNumber) {
        // Flush the current number
        currentTotal += currentSegment;
        if (currentTotal > 0) {
          result.push(currentTotal.toString());
        }
        // Reset
        currentTotal = 0;
        currentSegment = 0;
        isParsingNumber = false;
      }

      // Push the current non-number word
      result.push(word);
    }
  }

  // Handle if the string ended with a number
  if (isParsingNumber) {
    currentTotal += currentSegment;
    if (currentTotal > 0) {
      result.push(currentTotal.toString());
    }
  }

  return result.join(' ');
};

export const containsHindiCurrency = (text: string): boolean => {
  const patterns = [
    /rupaye/i, /rupees/i, /rs/i, /₹/i,
    /paise/i, /paisa/i,
    /ka/i, /ke/i
  ];
  return patterns.some(p => p.test(text));
};
