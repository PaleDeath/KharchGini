import assert from 'node:assert';
// @ts-expect-error Node ESM execution requires file extension
import { safeCalculate, evaluateExpression, calculateEmi, calculateSip } from '../src/domain/calculator.ts';

console.log('--- Starting Expanded Calculator Test Suite ---');

// 1. Basic Arithmetic
assert.strictEqual(safeCalculate('5 + 3'), 8, '5 + 3 === 8');
assert.strictEqual(safeCalculate('10 - 4'), 6, '10 - 4 === 6');
assert.strictEqual(safeCalculate('6 * 7'), 42, '6 * 7 === 42');
assert.strictEqual(safeCalculate('20 / 4'), 5, '20 / 4 === 5');

// 2. Unicode and Display Operators
assert.strictEqual(safeCalculate('5 + 3 ='), 8, 'Trailing equals');
assert.strictEqual(safeCalculate('6 × 7'), 42, 'Unicode multiplication');
assert.strictEqual(safeCalculate('6 x 7'), 42, 'x multiplication');
assert.strictEqual(safeCalculate('6 X 7'), 42, 'X multiplication');
assert.strictEqual(safeCalculate('20 ÷ 4'), 5, 'Unicode division');
assert.strictEqual(safeCalculate('10 − 4'), 6, 'Unicode minus');
assert.strictEqual(safeCalculate('10 – 4'), 6, 'En-dash');
assert.strictEqual(safeCalculate('10 — 4'), 6, 'Em-dash');

// 3. Indian Currency Formatting, Rupee Symbols & Commas
assert.strictEqual(safeCalculate('1,000 + 2,500'), 3500, 'Commas in numbers');
assert.strictEqual(safeCalculate('10,00,000 + 50,000'), 1050000, 'Lakh grouping');
assert.strictEqual(safeCalculate('₹1,000 + ₹2,500'), 3500, 'Rupee symbol ₹ stripping');
assert.strictEqual(safeCalculate('Rs. 500 + 300'), 800, 'Rs. prefix stripping');
assert.strictEqual(safeCalculate('INR 1000 + 200'), 1200, 'INR prefix stripping');
assert.strictEqual(safeCalculate('₹\u00A01,500 + 500'), 2000, 'Non-breaking space after currency');

// 4. Operator Precedence & Parentheses
assert.strictEqual(safeCalculate('2 + 3 * 4'), 14, 'Precedence: 2 + 3 * 4 === 14');
assert.strictEqual(safeCalculate('(2 + 3) * 4'), 20, 'Parentheses: (2 + 3) * 4 === 20');
assert.strictEqual(safeCalculate('10 - 2 * 3'), 4, '10 - 2 * 3 === 4');
assert.strictEqual(safeCalculate('10 / 2 + 3'), 8, '10 / 2 + 3 === 8');
assert.strictEqual(safeCalculate('((2 + 3) * (4 + 1))'), 25, 'Nested parentheses');

// 5. Implicit Multiplication with Parentheses
assert.strictEqual(safeCalculate('5(2 + 3)'), 25, '5(2 + 3) === 25');
assert.strictEqual(safeCalculate('(2 + 3)(4 + 1)'), 25, '(2 + 3)(4 + 1) === 25');
assert.strictEqual(safeCalculate('(2 + 3)5'), 25, '(2 + 3)5 === 25');

// 6. Decimals and Precision
assert.strictEqual(safeCalculate('0.1 + 0.2'), 0.3, 'Floating point precision: 0.1 + 0.2 === 0.3');
assert.strictEqual(safeCalculate('.5 + .25'), 0.75, 'Leading decimal: .5 + .25 === 0.75');
assert.strictEqual(safeCalculate('10. + 5'), 15, 'Trailing decimal: 10. + 5 === 15');
assert.strictEqual(safeCalculate('1.25 * 1.25'), 1.5625, 'Exact decimal preserved: 1.25 * 1.25 === 1.5625');
assert.strictEqual(safeCalculate('5 / 8'), 0.625, '5 / 8 === 0.625');
assert.strictEqual(safeCalculate('10 / 3', 2), 3.33, 'Explicit 2-decimal rounding: 10 / 3 === 3.33');
assert.strictEqual(safeCalculate('10 / 3'), 3.33333333, 'Default precision 10 / 3 === 3.33333333');

// 7. Unary Operators
assert.strictEqual(safeCalculate('-5 + 8'), 3, 'Unary minus: -5 + 8 === 3');
assert.strictEqual(safeCalculate('+5 + 3'), 8, 'Unary plus: +5 + 3 === 8');
assert.strictEqual(safeCalculate('10 * -2'), -20, '10 * -2 === -20');
assert.strictEqual(safeCalculate('-(5 + 3)'), -8, '-(5 + 3) === -8');
assert.strictEqual(safeCalculate('-(-5)'), 5, '-(-5) === 5');
assert.strictEqual(safeCalculate('5 + + 3'), 8, '5 + + 3 === 8');
assert.strictEqual(safeCalculate('5 + - 3'), 2, '5 + - 3 === 2');
assert.strictEqual(safeCalculate('5 - - 3'), 8, '5 - - 3 === 8');

// 8. Percentages
assert.strictEqual(safeCalculate('50%'), 0.5, 'Standalone 50%');
assert.strictEqual(safeCalculate('100 + 10%'), 110, '100 + 10% (GST/markup)');
assert.strictEqual(safeCalculate('2000 + 18%'), 2360, '2000 + 18% GST');
assert.strictEqual(safeCalculate('100 - 20%'), 80, '100 - 20% (discount)');
assert.strictEqual(safeCalculate('5000 - 15%'), 4250, '5000 - 15% discount');
assert.strictEqual(safeCalculate('500 * 20%'), 100, '500 * 20%');
assert.strictEqual(safeCalculate('500 / 50%'), 1000, '500 / 50%');
assert.strictEqual(safeCalculate('100 + 18% + 5%'), 123.9, 'Chained percentage: 118 + 5% = 123.9');
assert.strictEqual(safeCalculate('100 - 10% - 10%'), 81, 'Chained discount: 90 - 10% = 81');
assert.strictEqual(safeCalculate('(100 + 50) * 2'), 300, '(100 + 50) * 2');
assert.strictEqual(safeCalculate('50% * 200'), 100, '50% * 200');
assert.strictEqual(safeCalculate('200 * 50%'), 100, '200 * 50%');
assert.strictEqual(safeCalculate('50% + 10'), 10.5, '50% + 10');

// 9. Edge cases, Paste strings with equals signs, Incomplete expressions
assert.strictEqual(safeCalculate('5 +'), 5, 'Trailing operator ignored gracefully');
assert.strictEqual(safeCalculate('5 -'), 5, 'Trailing minus ignored gracefully');
assert.strictEqual(safeCalculate('5 *'), 5, 'Trailing multiply ignored gracefully');
assert.strictEqual(safeCalculate('5 + -'), 5, 'Multiple trailing operators stripped');
assert.strictEqual(safeCalculate('5 + 3 = 8'), 8, 'Pasted equation with answer evaluates LHS');
assert.strictEqual(safeCalculate('5 + 3 =8'), 8, 'Equation with glued answer evaluates LHS');
assert.strictEqual(safeCalculate('500 + 500 = 1000'), 1000, 'Pasted 500 + 500 = 1000');
assert.strictEqual(safeCalculate('   42   '), 42, 'Whitespace trimmed');
assert.strictEqual(safeCalculate('0'), 0, 'Zero');
assert.strictEqual(safeCalculate('-0'), 0, 'Negative zero cleaned to zero');

// 10. Division by zero discrimination
const divZeroRes = evaluateExpression('5 / 0');
assert.strictEqual(divZeroRes.ok, false, 'Division by zero is not ok');
if (!divZeroRes.ok) {
  assert.strictEqual(divZeroRes.error, 'DIV_ZERO', 'Error code is DIV_ZERO');
}
assert.strictEqual(safeCalculate('5 / 0'), null, 'safeCalculate returns null for div zero');
assert.strictEqual(safeCalculate('5 / (2 - 2)'), null, 'Division by zero in parens returns null');

// 11. Malformed syntax error handling (returns null)
assert.strictEqual(safeCalculate(''), null, 'Empty string returns null');
assert.strictEqual(safeCalculate('   '), null, 'Whitespace returns null');
assert.strictEqual(safeCalculate('abc'), null, 'Invalid text returns null');
assert.strictEqual(safeCalculate('5 + * 3'), null, 'Malformed operators return null');
assert.strictEqual(safeCalculate('5 * * 3'), null, '5 * * 3 returns null');
assert.strictEqual(safeCalculate('((5 + 3)'), null, 'Unmatched paren returns null');
assert.strictEqual(safeCalculate('5 + 3)'), null, 'Unmatched closing paren returns null');
assert.strictEqual(safeCalculate('%'), null, 'Stray % returns null');
assert.strictEqual(safeCalculate('5.5.5 + 1'), null, 'Multiple dots return null');

// 12. EMI calculations
const emiStandard = calculateEmi(1000000, 8.5, 5);
assert.strictEqual(emiStandard.emi, 20517, 'EMI on 10L @ 8.5% for 5y is ~20517');
assert.strictEqual(emiStandard.totalAmount, 1230992, 'Total repayment on 10L');
assert.strictEqual(emiStandard.totalInterest, 230992, 'Total interest on 10L');

const emiZeroRate = calculateEmi(120000, 0, 1);
assert.strictEqual(emiZeroRate.emi, 10000, 'No-cost EMI on 1.2L for 1y is 10000/mo');
assert.strictEqual(emiZeroRate.totalInterest, 0, 'No interest on No-Cost EMI');
assert.strictEqual(emiZeroRate.principalPct, 100, '100% principal on No-Cost EMI');

const emiInvalid = calculateEmi(-1000, 8, 5);
assert.strictEqual(emiInvalid.emi, 0, 'Invalid principal returns 0');

// 13. SIP calculations
const sipStandard = calculateSip(10000, 12, 10);
assert.strictEqual(sipStandard.totalInvested, 1200000, '10k/mo for 10y is 12L invested');
assert(sipStandard.totalValue > 2300000, 'Total value should be > 23L');
assert(sipStandard.wealthGain > 1100000, 'Wealth gain should be > 11L');

const sipZeroRate = calculateSip(10000, 0, 5);
assert.strictEqual(sipZeroRate.totalInvested, 600000, '0% rate returns invested amount');
assert.strictEqual(sipZeroRate.totalValue, 600000, '0% rate totalValue equals invested');
assert.strictEqual(sipZeroRate.wealthGain, 0, '0% rate wealth gain is 0');

console.log('--- All 75+ tests passed successfully! ---');
