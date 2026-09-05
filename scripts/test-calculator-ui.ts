import assert from 'node:assert';
// @ts-expect-error Node ESM execution requires file extension
import { evaluateExpression, safeCalculate } from '../src/domain/calculator.ts';

console.log('--- Testing Calculator UI State Machine Transitions ---');

/**
 * Pure state machine simulator matching CalculatorSheet logic.
 */
class CalculatorSimulator {
  display = '0';
  equation = '';
  hasCalculated = false;
  waitingForOperand = false;
  lastToast: string | null = null;

  toast(msg: string) {
    this.lastToast = msg;
  }

  handleDigit(digit: string) {
    if (this.hasCalculated || this.waitingForOperand) {
      if (this.hasCalculated) {
        this.equation = '';
      }
      this.display = digit === '00' ? '0' : digit;
      this.hasCalculated = false;
      this.waitingForOperand = false;
      return;
    }

    if (this.display === '0' || this.display === '-0' || this.display === 'Cannot divide by zero' || this.display === 'Error') {
      this.display = digit === '00' ? '0' : digit;
    } else {
      if (this.display.length < 15) {
        this.display += digit;
      }
    }
  }

  handleDecimal() {
    if (this.hasCalculated || this.waitingForOperand) {
      if (this.hasCalculated) {
        this.equation = '';
      }
      this.display = '0.';
      this.hasCalculated = false;
      this.waitingForOperand = false;
      return;
    }

    if (this.display === 'Cannot divide by zero' || this.display === 'Error') {
      this.display = '0.';
      return;
    }

    if (!this.display.includes('.')) {
      this.display += '.';
    }
  }

  handleOperator(op: string) {
    if (this.display === 'Cannot divide by zero' || this.display === 'Error') {
      this.display = '0';
      this.equation = '';
      this.hasCalculated = false;
      this.waitingForOperand = false;
      return;
    }

    if (this.hasCalculated || this.equation.includes('=')) {
      this.equation = `${this.display} ${op} `;
      this.hasCalculated = false;
      this.waitingForOperand = true;
      return;
    }

    if (this.waitingForOperand) {
      this.equation = this.equation.replace(/[\+\-\−\×\÷\*/]\s*$/, `${op} `);
      return;
    }

    if (this.equation) {
      const fullExpr = this.equation + this.display;
      const evalRes = evaluateExpression(fullExpr);
      if (evalRes.ok) {
        this.display = String(evalRes.value);
        this.equation = `${evalRes.value} ${op} `;
      } else {
        this.equation = `${this.equation}${this.display} ${op} `;
      }
    } else {
      this.equation = `${this.display} ${op} `;
    }

    this.waitingForOperand = true;
  }

  handlePercent() {
    if (this.waitingForOperand) return;
    if (this.display === 'Cannot divide by zero' || this.display === 'Error') return;

    if (this.hasCalculated || this.equation.includes('=') || !this.equation) {
      const val = parseFloat(this.display) || 0;
      const res = Math.round((val / 100) * 100000000) / 100000000;
      this.equation = `${this.display}% =`;
      this.display = String(res);
      this.hasCalculated = true;
      this.waitingForOperand = false;
      return;
    }

    const fullExpr = `${this.equation}${this.display}%`;
    const evalRes = evaluateExpression(fullExpr);
    if (evalRes.ok) {
      this.equation = `${fullExpr} =`;
      this.display = String(evalRes.value);
      this.hasCalculated = true;
      this.waitingForOperand = false;
    } else {
      if (evalRes.error === 'DIV_ZERO') {
        this.toast('Cannot divide by zero');
        this.display = 'Cannot divide by zero';
        this.hasCalculated = true;
        this.waitingForOperand = false;
      } else {
        this.toast('Invalid calculation');
      }
    }
  }

  handleEqual() {
    if (this.hasCalculated) return;

    if (this.display === 'Cannot divide by zero' || this.display === 'Error') {
      this.display = '0';
      this.equation = '';
      this.hasCalculated = false;
      this.waitingForOperand = false;
      return;
    }

    let fullExpr: string;
    if (this.waitingForOperand) {
      fullExpr = this.equation.replace(/[\+\-\−\×\÷\*/]\s*$/, '');
    } else if (this.equation.includes('=')) {
      fullExpr = this.display;
    } else {
      fullExpr = this.equation ? `${this.equation}${this.display}` : this.display;
    }

    const evalRes = evaluateExpression(fullExpr);
    if (evalRes.ok) {
      this.equation = `${fullExpr} =`;
      this.display = String(evalRes.value);
      this.hasCalculated = true;
      this.waitingForOperand = false;
    } else {
      if (evalRes.error === 'DIV_ZERO') {
        this.toast('Cannot divide by zero');
        this.display = 'Cannot divide by zero';
        this.hasCalculated = true;
        this.waitingForOperand = false;
      } else {
        this.toast('Invalid calculation');
      }
    }
  }

  handleAddAmount(addVal: number) {
    if (this.hasCalculated || this.equation.includes('=')) {
      this.equation = '';
      const cur = parseFloat(this.display) || 0;
      this.display = String(cur + addVal);
      this.hasCalculated = false;
      this.waitingForOperand = false;
      return;
    }

    if (this.waitingForOperand) {
      this.display = String(addVal);
      this.waitingForOperand = false;
      return;
    }

    const current = parseFloat(this.display) || 0;
    this.display = String(current + addVal);
    this.hasCalculated = false;
    this.waitingForOperand = false;
  }
}

// Scenario 1: Simple addition 5 + 3 = 8
const s1 = new CalculatorSimulator();
s1.handleDigit('5');
s1.handleOperator('+');
s1.handleDigit('3');
s1.handleEqual();
assert.strictEqual(s1.display, '8', '5 + 3 === 8');
assert.strictEqual(s1.equation, '5 + 3 =');
assert.strictEqual(s1.hasCalculated, true);
assert.strictEqual(s1.lastToast, null, 'No error toast on simple addition');

// Pressing '=' repeatedly does nothing and never produces Invalid calculation
s1.handleEqual();
s1.handleEqual();
assert.strictEqual(s1.display, '8');
assert.strictEqual(s1.lastToast, null);

// Scenario 2: Quick multiplier after calculation: 500 + 500 = 1000, then +₹1k
const s2 = new CalculatorSimulator();
s2.handleDigit('5');
s2.handleDigit('0');
s2.handleDigit('0');
s2.handleOperator('+');
s2.handleDigit('5');
s2.handleDigit('0');
s2.handleDigit('0');
s2.handleEqual();
assert.strictEqual(s2.display, '1000');
s2.handleAddAmount(1000); // clicks +₹1k
assert.strictEqual(s2.display, '2000');
assert.strictEqual(s2.equation, '', 'Equation is cleared after quick add');
s2.handleEqual();
assert.strictEqual(s2.display, '2000');
assert.strictEqual(s2.lastToast, null, 'No error on equal after +₹1k');

// Scenario 3: Contextual percentage: 1000 + 18% = 1180, then press % on result
const s3 = new CalculatorSimulator();
s3.handleDigit('1');
s3.handleDigit('0');
s3.handleDigit('0');
s3.handleDigit('0');
s3.handleOperator('+');
s3.handleDigit('1');
s3.handleDigit('8');
s3.handlePercent();
assert.strictEqual(s3.display, '1180');
assert.strictEqual(s3.equation, '1000 + 18% =');
assert.strictEqual(s3.lastToast, null);

// Now user presses % again on 1180
s3.handlePercent();
assert.strictEqual(s3.display, '11.8', '1180% = 11.8');
assert.strictEqual(s3.equation, '1180% =');
assert.strictEqual(s3.lastToast, null, 'No error on percentage of calculated result');

// Scenario 4: Standalone percentage: 50% -> 0.5, then typing 2 starts fresh number
const s4 = new CalculatorSimulator();
s4.handleDigit('5');
s4.handleDigit('0');
s4.handlePercent();
assert.strictEqual(s4.display, '0.5');
assert.strictEqual(s4.equation, '50% =');
s4.handleDigit('2');
assert.strictEqual(s4.display, '2', 'Typing digit after standalone percent starts new number');
assert.strictEqual(s4.equation, '');

// Scenario 5: 1000 + , then clicks +₹1k
const s5 = new CalculatorSimulator();
s5.handleDigit('1');
s5.handleDigit('0');
s5.handleDigit('0');
s5.handleDigit('0');
s5.handleOperator('+');
assert.strictEqual(s5.waitingForOperand, true);
s5.handleAddAmount(1000);
assert.strictEqual(s5.display, '1000', 'New operand is set to 1000');
assert.strictEqual(s5.waitingForOperand, false);
s5.handleEqual();
assert.strictEqual(s5.display, '2000', '1000 + 1000 = 2000');
assert.strictEqual(s5.lastToast, null);

// Scenario 6: Division by zero shows "Cannot divide by zero"
const s6 = new CalculatorSimulator();
s6.handleDigit('5');
s6.handleOperator('÷');
s6.handleDigit('0');
s6.handleEqual();
assert.strictEqual(s6.display, 'Cannot divide by zero');
assert.strictEqual(s6.lastToast, 'Cannot divide by zero');

// Next digit starts fresh
s6.handleDigit('7');
assert.strictEqual(s6.display, '7');

// Scenario 7: Operator replacement: 5 + × 3 = 15
const s7 = new CalculatorSimulator();
s7.handleDigit('5');
s7.handleOperator('+');
s7.handleOperator('×');
s7.handleDigit('3');
s7.handleEqual();
assert.strictEqual(s7.display, '15');
assert.strictEqual(s7.lastToast, null);

// Scenario 8: Decimal handling
const s8 = new CalculatorSimulator();
s8.handleDigit('0');
s8.handleDecimal();
s8.handleDigit('5');
s8.handleOperator('+');
s8.handleDecimal();
s8.handleDigit('2');
s8.handleDigit('5');
s8.handleEqual();
assert.strictEqual(s8.display, '0.75');

console.log('--- All UI State Machine Scenarios Passed! ---');
