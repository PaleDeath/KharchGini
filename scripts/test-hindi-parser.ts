import { parseHindiNumbers } from '../src/lib/voice/hindi-utils';

const testCases = [
  { input: 'paanch sau', expected: '500' },
  { input: 'paanch sau pachas', expected: '550' },
  { input: 'do hazaar', expected: '2000' },
  { input: 'do hazaar paanch sau', expected: '2500' },
  { input: 'ek lakh', expected: '100000' },
  { input: 'ek lakh paanch hazaar', expected: '105000' },
  { input: 'kharcha paanch sau rupaye', expected: 'kharcha 500 rupaye' },
  { input: 'do hazaar paanch sau ka petrol', expected: '2500 ka petrol' },
  { input: 'ek sau pachas', expected: '150' },
];

console.log('Running Hindi Number Parser Tests...\n');

let passed = 0;
testCases.forEach(({ input, expected }) => {
  const result = parseHindiNumbers(input);
  if (result === expected) {
    console.log(`✅ PASS: "${input}" -> "${result}"`);
    passed++;
  } else {
    console.error(`❌ FAIL: "${input}" -> "${result}" (Expected: "${expected}")`);
  }
});

console.log(`\nPassed: ${passed}/${testCases.length}`);

if (passed === testCases.length) {
  process.exit(0);
} else {
  process.exit(1);
}
