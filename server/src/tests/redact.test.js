import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { redact, redactSensitiveInfo } from '../utils/redact.js';

describe('PII and Credentials Redaction Utility (redact.js)', () => {
  it('should redact 12-digit continuous Aadhaar number', () => {
    const input = 'My Aadhaar number is 987654321098 please check.';
    const output = redact(input);
    assert.strictEqual(output, 'My Aadhaar number is [REDACTED] please check.');
  });

  it('should redact 12-digit spaced Aadhaar number', () => {
    const input = 'Aadhaar: 1234 5678 9012 for verification.';
    const output = redact(input);
    assert.strictEqual(output, 'Aadhaar: [REDACTED] for verification.');
  });

  it('should redact 12-digit hyphenated Aadhaar number', () => {
    const input = 'My ID is 1234-5678-9012.';
    const output = redact(input);
    assert.strictEqual(output, 'My ID is [REDACTED].');
  });

  it('should redact PAN card patterns', () => {
    const input = 'My PAN number is ABCDE1234F and my spouse is FGHIJ5678K.';
    const output = redact(input);
    assert.strictEqual(output, 'My PAN number is [REDACTED] and my spouse is [REDACTED].');
  });

  it('should redact OTP codes following otp or code keywords', () => {
    const testCases = [
      { input: 'Your otp is 482910.', expected: 'Your otp is [REDACTED].' },
      { input: 'Enter the code: 849201 right now.', expected: 'Enter the code: [REDACTED] right now.' },
      { input: 'My OTP-4829 for verification.', expected: 'My OTP-[REDACTED] for verification.' },
      { input: 'Verification code 789234.', expected: 'Verification code [REDACTED].' },
    ];

    for (const { input, expected } of testCases) {
      assert.strictEqual(redact(input), expected);
    }
  });

  it('should redact long bank account numbers (9 to 18 digits)', () => {
    const input = 'Please deposit to account 1234567890123456 at SBI.';
    const output = redact(input);
    assert.strictEqual(output, 'Please deposit to account [REDACTED] at SBI.');
  });

  it('should preserve standard short numbers like age, years, and dates', () => {
    const input = 'I am 45 years old born in 1978 and have 2 children, income ₹50000.';
    const output = redact(input);
    assert.strictEqual(output, input);
  });

  it('should return detailed redaction counts and flag', () => {
    const input = 'Aadhaar: 1234 5678 9012, PAN: ABCDE1234F, OTP is 123456, Bank: 98765432101234.';
    const info = redactSensitiveInfo(input);
    assert.strictEqual(info.redacted, true);
    assert.strictEqual(info.counts.aadhaar, 1);
    assert.strictEqual(info.counts.pan, 1);
    assert.strictEqual(info.counts.otp, 1);
    assert.strictEqual(info.counts.bank, 1);
    assert.ok(info.text.includes('[REDACTED]'));
  });

  it('handles empty or non-string inputs safely', () => {
    assert.strictEqual(redact(''), '');
    assert.strictEqual(redact(null), '');
    assert.strictEqual(redact(undefined), '');
  });
});
