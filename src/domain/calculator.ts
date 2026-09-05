/**
 * Domain calculator for KharchGini.
 * 
 * Provides safe, CSP-compliant mathematical expression evaluation
 * without eval() or new Function(), along with EMI and SIP financial planners.
 */

export interface EmiResult {
  emi: number;
  totalInterest: number;
  totalAmount: number;
  principalPct: number;
  interestPct: number;
}

export interface SipResult {
  totalInvested: number;
  wealthGain: number;
  totalValue: number;
  investedPct: number;
  gainPct: number;
}

export type CalcError = 'DIV_ZERO' | 'INVALID_SYNTAX';

export type EvaluationResult =
  | { ok: true; value: number }
  | { ok: false; error: CalcError };

type TokenType = 'NUMBER' | 'OP' | 'LPAREN' | 'RPAREN';

interface Token {
  type: TokenType;
  value?: number;
  isPercent?: boolean;
  op?: '+' | '-' | '*' | '/';
}

interface ParsedValue {
  value: number;
  isPercent?: boolean;
  percentRate?: number;
}

/**
 * Tokenize a sanitized arithmetic expression string.
 */
function tokenize(raw: string): Token[] | null {
  // Normalize symbols and currency formats
  let expr = raw
    .replace(/\u00A0/g, ' ') // Non-breaking space
    .replace(/[₹]|(?:rs|inr)\.?/gi, '') // Strip currency symbols/prefixes
    .replace(/×/g, '*')
    .replace(/x/gi, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-') // Unicode minus U+2212
    .replace(/[–—]/g, '-') // En-dash & em-dash
    .replace(/,/g, '') // Strip thousands separators
    .trim();

  // If expression contains equals sign (e.g. user pasted "5 + 3 = 8" or trailing "5 + 3 =")
  if (expr.includes('=')) {
    const parts = expr.split('=');
    expr = (parts[0]?.trim() || parts[1]?.trim() || '').trim();
  }

  // Strip trailing operators gracefully (e.g. "5 + - " -> "5")
  expr = expr.replace(/(?:[\+\-\*\/]\s*)+$/, '').trim();

  if (!expr) return null;

  const rawTokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Number or decimal (e.g. "42", "3.14", ".5")
    if (/\d/.test(ch) || (ch === '.' && i + 1 < expr.length && /\d/.test(expr[i + 1]))) {
      let numStr = '';
      while (i < expr.length && /[\d.]/.test(expr[i])) {
        if (expr[i] === '.' && numStr.includes('.')) {
          // Double decimal point in single number is invalid
          return null;
        }
        numStr += expr[i];
        i++;
      }

      // Check if immediately followed by %
      let isPercent = false;
      let peek = i;
      while (peek < expr.length && /\s/.test(expr[peek])) {
        peek++;
      }
      if (peek < expr.length && expr[peek] === '%') {
        isPercent = true;
        i = peek + 1;
      }

      const val = parseFloat(numStr);
      if (Number.isNaN(val)) return null;

      rawTokens.push({
        type: 'NUMBER',
        value: val,
        isPercent,
      });
      continue;
    }

    // Operators
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      rawTokens.push({
        type: 'OP',
        op: ch,
      });
      i++;
      continue;
    }

    // Parentheses
    if (ch === '(') {
      rawTokens.push({ type: 'LPAREN' });
      i++;
      continue;
    }
    if (ch === ')') {
      rawTokens.push({ type: 'RPAREN' });
      i++;
      continue;
    }

    // Stray percent without preceding number is invalid
    if (ch === '%') {
      return null;
    }

    // Any other character is invalid
    return null;
  }

  if (rawTokens.length === 0) return null;

  // Insert implicit multiplication tokens:
  // e.g. "5(2 + 3)" -> "5 * (2 + 3)", "(2 + 3)(4 + 1)" -> "(2 + 3) * (4 + 1)", "(2 + 3)5" -> "(2 + 3) * 5"
  const tokens: Token[] = [];
  for (let t = 0; t < rawTokens.length; t++) {
    const current = rawTokens[t];
    const prev = rawTokens[t - 1];

    if (prev) {
      if (
        (prev.type === 'NUMBER' && current.type === 'LPAREN') ||
        (prev.type === 'RPAREN' && current.type === 'LPAREN') ||
        (prev.type === 'RPAREN' && current.type === 'NUMBER')
      ) {
        tokens.push({ type: 'OP', op: '*' });
      }
    }
    tokens.push(current);
  }

  return tokens;
}

/**
 * Recursive descent parser and evaluator for arithmetic tokens.
 * Handles operator precedence, parentheses, unary operators, and percentages.
 */
class ExpressionEvaluator {
  private tokens: Token[];
  private pos = 0;
  public divZero = false;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  evaluate(precision = 8): EvaluationResult {
    if (this.tokens.length === 0) {
      return { ok: false, error: 'INVALID_SYNTAX' };
    }

    const result = this.parseAdditive();
    if (this.divZero) {
      return { ok: false, error: 'DIV_ZERO' };
    }
    if (result === null) {
      return { ok: false, error: 'INVALID_SYNTAX' };
    }
    // If not all tokens were consumed, expression is malformed
    if (this.pos < this.tokens.length) {
      return { ok: false, error: 'INVALID_SYNTAX' };
    }
    if (!Number.isFinite(result.value) || Number.isNaN(result.value)) {
      return { ok: false, error: 'INVALID_SYNTAX' };
    }

    // Clean rounding: eliminate IEEE-754 precision artifacts while preserving exact values
    const factor = Math.pow(10, Math.min(12, Math.max(0, precision)));
    const rounded = Math.round((result.value + Number.EPSILON) * factor) / factor;
    const finalVal = Object.is(rounded, -0) ? 0 : rounded;

    return { ok: true, value: finalVal };
  }

  // Additive: + and -
  private parseAdditive(): ParsedValue | null {
    let left = this.parseMultiplicative();
    if (left === null) return null;

    while (this.pos < this.tokens.length) {
      const token = this.peek();
      if (!token || token.type !== 'OP' || (token.op !== '+' && token.op !== '-')) {
        break;
      }

      const op = token.op;
      this.consume(); // eat operator

      const right = this.parseMultiplicative();
      if (right === null) return null;

      let rightVal = right.value;
      // Contextual percentage handling:
      // "100 + 10%" => 100 + (100 * 0.10) = 110
      // "100 - 10%" => 100 - (100 * 0.10) = 90
      if (right.isPercent) {
        const rate = right.percentRate ?? right.value;
        rightVal = left.value * (rate / 100);
      }

      if (op === '+') {
        left = { value: left.value + rightVal };
      } else {
        left = { value: left.value - rightVal };
      }
    }

    return left;
  }

  // Multiplicative: * and /
  private parseMultiplicative(): ParsedValue | null {
    let left = this.parseUnary();
    if (left === null) return null;

    while (this.pos < this.tokens.length) {
      const token = this.peek();
      if (!token || token.type !== 'OP' || (token.op !== '*' && token.op !== '/')) {
        break;
      }

      const op = token.op;
      this.consume(); // eat operator

      const right = this.parseUnary();
      if (right === null) return null;

      let rightVal = right.value;
      if (right.isPercent) {
        // "500 * 20%" => 500 * 0.20 = 100
        // "500 / 50%" => 500 / 0.50 = 1000
        const rate = right.percentRate ?? right.value;
        rightVal = rate / 100;
      }

      if (op === '*') {
        left = { value: left.value * rightVal };
      } else {
        // Division by zero
        if (rightVal === 0) {
          this.divZero = true;
          return null;
        }
        left = { value: left.value / rightVal };
      }
    }

    return left;
  }

  // Unary: + and -
  private parseUnary(): ParsedValue | null {
    const token = this.peek();
    if (!token) return null;

    if (token.type === 'OP' && (token.op === '+' || token.op === '-')) {
      const op = token.op;
      this.consume();
      const operand = this.parseUnary();
      if (operand === null) return null;
      return {
        value: op === '-' ? -operand.value : operand.value,
        isPercent: operand.isPercent,
        percentRate: operand.percentRate,
      };
    }

    return this.parsePrimary();
  }

  // Primary: Number or ( Expression )
  private parsePrimary(): ParsedValue | null {
    const token = this.peek();
    if (!token) return null;

    if (token.type === 'NUMBER') {
      this.consume();
      const val = token.value ?? 0;
      if (token.isPercent) {
        return {
          value: val / 100,
          isPercent: true,
          percentRate: val,
        };
      }
      return { value: val };
    }

    if (token.type === 'LPAREN') {
      this.consume(); // eat '('
      const expr = this.parseAdditive();
      if (expr === null) return null;

      const closing = this.peek();
      if (!closing || closing.type !== 'RPAREN') {
        // Missing closing parenthesis
        return null;
      }
      this.consume(); // eat ')'
      return expr;
    }

    return null;
  }
}

/**
 * Detailed expression evaluator that discriminates between syntax errors and division by zero.
 */
export function evaluateExpression(expression: string, precision = 8): EvaluationResult {
  try {
    const tokens = tokenize(expression);
    if (!tokens || tokens.length === 0) {
      return { ok: false, error: 'INVALID_SYNTAX' };
    }

    const evaluator = new ExpressionEvaluator(tokens);
    return evaluator.evaluate(precision);
  } catch {
    return { ok: false, error: 'INVALID_SYNTAX' };
  }
}

/**
 * Safe expression evaluator for arithmetic (+, -, *, /, %, parentheses).
 * Pure TS implementation: zero eval(), zero new Function().
 * 100% compliant with strict Content-Security-Policy.
 */
export function safeCalculate(expression: string, precision = 8): number | null {
  const result = evaluateExpression(expression, precision);
  return result.ok ? result.value : null;
}

/**
 * Calculate Monthly EMI for loan planning.
 * Standard formula: P * r * (1+r)^n / ((1+r)^n - 1)
 * Handles 0% interest (No-Cost EMI) cleanly.
 */
export function calculateEmi(
  principal: number,
  annualRate: number,
  tenureYears: number,
): EmiResult {
  if (
    !Number.isFinite(principal) ||
    !Number.isFinite(annualRate) ||
    !Number.isFinite(tenureYears) ||
    principal <= 0 ||
    tenureYears <= 0
  ) {
    return { emi: 0, totalInterest: 0, totalAmount: 0, principalPct: 100, interestPct: 0 };
  }

  const months = Math.round(tenureYears * 12);
  if (months <= 0) {
    return { emi: 0, totalInterest: 0, totalAmount: 0, principalPct: 100, interestPct: 0 };
  }

  // No-Cost EMI (0% interest)
  if (annualRate <= 0) {
    const emi = Math.round(principal / months);
    return {
      emi,
      totalInterest: 0,
      totalAmount: principal,
      principalPct: 100,
      interestPct: 0,
    };
  }

  const r = annualRate / 12 / 100;
  const n = months;
  const factor = Math.pow(1 + r, n);

  if (!Number.isFinite(factor) || factor <= 1) {
    const emi = Math.round(principal / months);
    return {
      emi,
      totalInterest: 0,
      totalAmount: principal,
      principalPct: 100,
      interestPct: 0,
    };
  }

  const emi = (principal * r * factor) / (factor - 1);
  const totalAmount = emi * n;
  const totalInterest = Math.max(0, totalAmount - principal);

  const principalPct = Math.min(100, Math.max(0, Math.round((principal / totalAmount) * 100)));
  const interestPct = 100 - principalPct;

  return {
    emi: Math.round(emi),
    totalInterest: Math.round(totalInterest),
    totalAmount: Math.round(totalAmount),
    principalPct,
    interestPct,
  };
}

/**
 * Calculate SIP Future Value and Wealth Growth.
 * Standard formula: P * [((1 + i)^n - 1) / i] * (1 + i)
 * Handles 0% return cleanly.
 */
export function calculateSip(
  monthlyAmount: number,
  annualRate: number,
  tenureYears: number,
): SipResult {
  if (
    !Number.isFinite(monthlyAmount) ||
    !Number.isFinite(annualRate) ||
    !Number.isFinite(tenureYears) ||
    monthlyAmount <= 0 ||
    tenureYears <= 0
  ) {
    return { totalInvested: 0, wealthGain: 0, totalValue: 0, investedPct: 100, gainPct: 0 };
  }

  const n = Math.round(tenureYears * 12);
  const totalInvested = monthlyAmount * n;

  if (annualRate <= 0) {
    return {
      totalInvested: Math.round(totalInvested),
      wealthGain: 0,
      totalValue: Math.round(totalInvested),
      investedPct: 100,
      gainPct: 0,
    };
  }

  const i = annualRate / 12 / 100;
  const factor = Math.pow(1 + i, n);
  if (!Number.isFinite(factor)) {
    return { totalInvested: Math.round(totalInvested), wealthGain: 0, totalValue: Math.round(totalInvested), investedPct: 100, gainPct: 0 };
  }

  const totalValue = monthlyAmount * ((factor - 1) / i) * (1 + i);
  if (!Number.isFinite(totalValue) || totalValue <= 0) {
    return { totalInvested: Math.round(totalInvested), wealthGain: 0, totalValue: Math.round(totalInvested), investedPct: 100, gainPct: 0 };
  }

  const wealthGain = Math.max(0, totalValue - totalInvested);
  const investedPct = Math.min(100, Math.max(0, Math.round((totalInvested / totalValue) * 100)));
  const gainPct = 100 - investedPct;

  return {
    totalInvested: Math.round(totalInvested),
    wealthGain: Math.round(wealthGain),
    totalValue: Math.round(totalValue),
    investedPct,
    gainPct,
  };
}
