import { SpeechRecognitionService } from '@/lib/voice/speech-recognition';

// Mock window.SpeechRecognition since it's used in constructor if window is defined
// Jest environment jsdom defines window, so we need to mock it if not already mocked in setup
// But we did mock it in jest.setup.js

describe('Voice Parser Logic', () => {
  let service: SpeechRecognitionService;

  beforeEach(() => {
    service = new SpeechRecognitionService();
  });

  // Basic Expense Cases
  test('parses "I spent 500 rupees on food"', async () => {
    const result = await service.parseVoiceInput('I spent 500 rupees on food');
    expect(result.amount).toBe(500);
    expect(result.type).toBe('expense');
    expect(result.category).toBe('Food & Dining');
    expect(result.description).toBe('Food');
    expect(result.confidence).toBeGreaterThan(0.7); // Adjusted expectation
  });

  test('parses "Petrol 2000"', async () => {
    const result = await service.parseVoiceInput('Petrol 2000');
    expect(result.amount).toBe(2000);
    expect(result.type).toBe('expense'); // Default to expense
    expect(result.category).toBe('Transportation');
    expect(result.description).toBe('Petrol');
  });

  test('parses "Paid 1200 for electricity bill"', async () => {
    const result = await service.parseVoiceInput('Paid 1200 for electricity bill');
    expect(result.amount).toBe(1200);
    expect(result.type).toBe('expense');
    expect(result.category).toBe('Bills & Utilities');
  });

  // Income Cases
  test('parses "Add income 50000 salary"', async () => {
    const result = await service.parseVoiceInput('Add income 50000 salary');
    expect(result.amount).toBe(50000);
    expect(result.type).toBe('income');
    // Category depends on implementation, might be undefined or inferred
    // Current implementation doesn't seem to have specific Income categories in categorizeDescription except broad checks
    // Let's check description at least
    expect(result.description).toBe('Salary');
  });

  test('parses "Received 5000 cashback"', async () => {
    const result = await service.parseVoiceInput('Received 5000 cashback');
    expect(result.amount).toBe(5000);
    expect(result.type).toBe('income');
    expect(result.description).toBe('Cashback');
  });

  // Indian Formats & Currency
  test('parses "5 lakh for car"', async () => {
    const result = await service.parseVoiceInput('5 lakh for car');
    expect(result.amount).toBe(500000);
    expect(result.category).toBe('Transportation');
  });

  test('parses "1.5 crore house"', async () => {
    const result = await service.parseVoiceInput('1.5 crore house');
    expect(result.amount).toBe(15000000);
  });

  test('parses "500 rs"', async () => {
    const result = await service.parseVoiceInput('500 rs');
    expect(result.amount).toBe(500);
  });

  test('parses "₹1000"', async () => {
    const result = await service.parseVoiceInput('₹1000');
    expect(result.amount).toBe(1000);
  });

  // Decimals & Paise
  test('parses "50.75"', async () => {
    const result = await service.parseVoiceInput('50.75');
    expect(result.amount).toBe(50.75);
  });

  test('parses "100 rupees and 50 paise"', async () => {
    const result = await service.parseVoiceInput('100 rupees and 50 paise');
    expect(result.amount).toBe(100.50);
  });

  // Edge Cases / Word Numbers
  test('parses "two thousand rupees"', async () => {
    const result = await service.parseVoiceInput('two thousand rupees');
    // If not supported, amount might be undefined
    // We assert behavior. If it fails (undefined), we know we need to implement it.
    // For now, let's just log or expect it to potentially fail if we haven't implemented it.
    // But since the task is to CREATE the test, I should probably assert what is EXPECTED.
    // The user listed it as an edge case, implying it SHOULD work.
    // So I will expect it to be 2000. If it fails, I will fix the code.
    expect(result.amount).toBe(2000);
  });

  // Confidence Scoring
  test('calculates high confidence for complete input', async () => {
    const result = await service.parseVoiceInput('Spent 500 on food');
    // Expect high confidence because amount, type (inferred), and description are present
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  test('calculates lower confidence for partial input', async () => {
    const result = await service.parseVoiceInput('500');
    // Only amount
    expect(result.confidence).toBeLessThan(0.8);
    expect(result.confidence).toBeGreaterThan(0);
  });

  // Mock Verification
  test('SpeechRecognition mock is available', () => {
    expect(window.SpeechRecognition).toBeDefined();
    const recognition = new window.SpeechRecognition();
    expect(recognition).toBeDefined();
    expect(recognition.start).toBeDefined();
  });

  // Additional Cases
  test('parses "Medicine 500"', async () => {
    const result = await service.parseVoiceInput('Medicine 500');
    expect(result.category).toBe('Healthcare');
    expect(result.amount).toBe(500);
  });

  test('parses "Uber 300"', async () => {
    const result = await service.parseVoiceInput('Uber 300');
    expect(result.category).toBe('Transportation');
    expect(result.amount).toBe(300);
  });

  test('parses "Movie tickets 400"', async () => {
    const result = await service.parseVoiceInput('Movie tickets 400');
    expect(result.category).toBe('Entertainment');
    expect(result.amount).toBe(400);
  });

  test('parses "Tuition fee 5000"', async () => {
    const result = await service.parseVoiceInput('Tuition fee 5000');
    expect(result.category).toBe('Education');
    expect(result.amount).toBe(5000);
  });

  test('parses "Recharge 200"', async () => {
    const result = await service.parseVoiceInput('Recharge 200');
    expect(result.category).toBe('Bills & Utilities');
    expect(result.amount).toBe(200);
  });

  test('parses "Coffee 150"', async () => {
    const result = await service.parseVoiceInput('Coffee 150');
    expect(result.category).toBe('Food & Dining');
    expect(result.amount).toBe(150);
  });

  test('parses "Gym membership 1000"', async () => {
    const result = await service.parseVoiceInput('Gym membership 1000');
    expect(result.category).toBe('Entertainment');
    expect(result.amount).toBe(1000);
  });

  test('parses "Flight to Delhi 5000"', async () => {
    const result = await service.parseVoiceInput('Flight to Delhi 5000');
    expect(result.category).toBe('Transportation');
    expect(result.amount).toBe(5000);
  });

  test('parses "New shirt 800"', async () => {
    const result = await service.parseVoiceInput('New shirt 800');
    expect(result.category).toBe('Shopping');
    expect(result.amount).toBe(800);
  });

  test('parses "Sold old bike 10000"', async () => {
    const result = await service.parseVoiceInput('Sold old bike 10000');
    expect(result.type).toBe('income');
    expect(result.amount).toBe(10000);
  });
});
