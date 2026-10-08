/**
 * Sensitive Data Redaction Utility for PolicyPal
 *
 * Automatically redacts Indian PII and financial credentials:
 * 1. 12-digit Aadhaar numbers (continuous or spaced/hyphenated: 1234 5678 9012)
 * 2. Permanent Account Number (PAN): [A-Z]{5}[0-9]{4}[A-Z]
 * 3. OTP codes (4-8 digits) following keywords like 'otp', 'code', 'verification code'
 * 4. Bank account numbers (9-18 continuous digits)
 *
 * Audio and messages are scrubbed in memory before reaching AI models or database storage.
 */

const REDACTION_PLACEHOLDER = '[REDACTED]';

// 1. Aadhaar: 12 digits, continuous or 4-4-4 separated with space or hyphen
const AADHAAR_REGEX = /\b(?:\d{4}[ -]\d{4}[ -]\d{4}|\d{12})\b/g;

// 2. PAN: 5 uppercase letters, 4 digits, 1 uppercase letter
const PAN_REGEX = /\b[A-Za-z]{5}[0-9]{4}[A-Za-z]\b/g;

// 3. OTP: 4-8 digits appearing after 'otp' or 'code' (with optional separator : - is =)
const OTP_REGEX = /(?<=\b(?:otp|code|one[- ]time[- ]password|verification[- ]code)(?:[:\s=-]+|\s+is\s+))([0-9]{4,8})\b/gi;

// 4. Bank Account Number: 9 to 18 contiguous digits (not already matched or preceded by text)
const BANK_ACCOUNT_REGEX = /\b\d{9,18}\b/g;

/**
 * Redacts all sensitive PII and financial information from the input text.
 * @param {string} text - Raw input text
 * @returns {{ text: string, redacted: boolean, counts: { aadhaar: number, pan: number, otp: number, bank: number } }}
 */
export function redactSensitiveInfo(text) {
  if (!text || typeof text !== 'string') {
    return { text: text || '', redacted: false, counts: { aadhaar: 0, pan: 0, otp: 0, bank: 0 } };
  }

  let result = text;
  let aadhaarCount = 0;
  let panCount = 0;
  let otpCount = 0;
  let bankCount = 0;

  // 1. Redact OTPs first so keyword-associated 4-8 digits are caught before generic numbers
  result = result.replace(OTP_REGEX, (match) => {
    otpCount++;
    return REDACTION_PLACEHOLDER;
  });

  // 2. Redact PAN patterns
  result = result.replace(PAN_REGEX, (match) => {
    panCount++;
    return REDACTION_PLACEHOLDER;
  });

  // 3. Redact spaced/hyphenated Aadhaar (e.g. 1234 5678 9012 or 1234-5678-9012)
  const SPACED_AADHAAR_REGEX = /\b\d{4}[ -]\d{4}[ -]\d{4}\b/g;
  result = result.replace(SPACED_AADHAAR_REGEX, (match) => {
    aadhaarCount++;
    return REDACTION_PLACEHOLDER;
  });

  // 4. Redact 9-18 digit numbers (covers continuous 12-digit Aadhaar as well as Bank Account numbers)
  result = result.replace(BANK_ACCOUNT_REGEX, (match) => {
    if (match.length === 12) {
      aadhaarCount++;
    } else {
      bankCount++;
    }
    return REDACTION_PLACEHOLDER;
  });

  const totalRedactions = aadhaarCount + panCount + otpCount + bankCount;

  return {
    text: result,
    redacted: totalRedactions > 0,
    counts: {
      aadhaar: aadhaarCount,
      pan: panCount,
      otp: otpCount,
      bank: bankCount,
    },
  };
}

/**
 * Convenience helper returning just the redacted string.
 * @param {string} text
 * @returns {string}
 */
export function redact(text) {
  return redactSensitiveInfo(text).text;
}

export default redact;
