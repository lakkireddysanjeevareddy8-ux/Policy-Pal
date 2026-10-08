import dotenv from 'dotenv';
dotenv.config();

import { getDb, closeDb } from '../src/db/index.js';

export const TARGET_LANGS = ['hi', 'te', 'ta', 'kn', 'ml', 'mr', 'gu', 'bn', 'pa', 'or', 'as', 'ur'];

export const SCRIPT_MAP = {
  hi: 'Devanagari',
  mr: 'Devanagari',
  te: 'Telugu',
  ta: 'Tamil',
  kn: 'Kannada',
  ml: 'Malayalam',
  gu: 'Gujarati',
  bn: 'Bengali',
  as: 'Bengali',
  pa: 'Gurmukhi',
  or: 'Oriya',
  ur: 'Arabic',
};

export const ALL_NON_LATIN_SCRIPTS = [
  'Devanagari',
  'Telugu',
  'Tamil',
  'Kannada',
  'Malayalam',
  'Gujarati',
  'Bengali',
  'Gurmukhi',
  'Oriya',
  'Arabic',
];

export const WHITELIST_LATIN_TOKENS = [
  'PM-KISAN', 'PMFBY', 'PM-JAY', 'PMJJBY', 'PMSBY', 'PMMY', 'PMUY', 'PMAY-G', 'PMAY-U', 'PMAY',
  'KCC', 'APY', 'NPS', 'SECC', 'Aadhaar', 'PAN', 'JSY', 'SSY', 'NSAP', 'IGNOAPS', 'NREGA', 'MGNREGA',
  'DBTL', 'LPG', 'CSC', 'URL', 'SMS', 'OTP', 'KYC', 'e-KYC', 'eKYC', 'IFSC', 'DBT', 'ST', 'SC', 'OBC',
  'EWS', 'BPL', 'Dr', 'YSR', 'Aarogyasri', 'Vishwakarma', 'SVANidhi', 'PolicyPal', 'Gov', 'AI', 'PDF',
  'UIDAI', 'NPCI', 'RTI', 'ITR', 'TIN', 'GST', 'm-Aadhaar', 'Voter ID', 'ID', 'PM', 'KISAN', 'MUDRA',
  'Janani', 'Suraksha', 'Atal', 'Pension', 'Sukanya', 'Samriddhi', 'Ayushman', 'Bharat', 'Rythu', 'Bandhu',
  'Post-Matric', 'Portal', 'Gemini', 'Render', 'free-tier', 'cold', 'start', 'RoR', 'Stand-Up', 'India'
];

export const BRAND_TERMS = new Set([
  'PAN', 'Aadhaar', 'PM-KISAN', 'APY', 'NPS', 'CSC', 'UIDAI', 'NPCI', 'GST', 'OTP', 'SMS', 'URL'
]);

export function normalizeDigitsToAscii(str) {
  if (!str) return '';
  return str.replace(/[\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0BE6-\u0BEF\u0C66-\u0C6F\u0CE6-\u0CEF\u0D66-\u0D6F\u0660-\u0669\u06F0-\u06F9]/g, (ch) => {
    const code = ch.charCodeAt(0);
    if (code >= 0x0966 && code <= 0x096F) return String.fromCharCode(code - 0x0966 + 48);
    if (code >= 0x09E6 && code <= 0x09EF) return String.fromCharCode(code - 0x09E6 + 48);
    if (code >= 0x0A66 && code <= 0x0A6F) return String.fromCharCode(code - 0x0A66 + 48);
    if (code >= 0x0AE6 && code <= 0x0AEF) return String.fromCharCode(code - 0x0AE6 + 48);
    if (code >= 0x0B66 && code <= 0x0B6F) return String.fromCharCode(code - 0x0B66 + 48);
    if (code >= 0x0BE6 && code <= 0x0BEF) return String.fromCharCode(code - 0x0BE6 + 48);
    if (code >= 0x0C66 && code <= 0x0C6F) return String.fromCharCode(code - 0x0C66 + 48);
    if (code >= 0x0CE6 && code <= 0x0CEF) return String.fromCharCode(code - 0x0CE6 + 48);
    if (code >= 0x0D66 && code <= 0x0D6F) return String.fromCharCode(code - 0x0D66 + 48);
    if (code >= 0x0660 && code <= 0x0669) return String.fromCharCode(code - 0x0660 + 48);
    if (code >= 0x06F0 && code <= 0x06F9) return String.fromCharCode(code - 0x06F0 + 48);
    return ch;
  });
}

export function extractNumbers(str) {
  if (!str) return [];
  const normalized = normalizeDigitsToAscii(str);
  // Remove commas inside numbers (e.g. 5,000 -> 5000)
  const cleaned = normalized.replace(/(?<=\d),(?=\d)/g, '');
  const matches = cleaned.match(/\d+(?:\.\d+)?/g) || [];
  return Array.from(new Set(matches.map((m) => String(Number(m))))).sort();
}

export function validateFieldContent({ lang, translatedVal, englishVal }) {
  if (!translatedVal || typeof translatedVal !== 'string' || translatedVal.trim() === '') {
    return { pass: false, error: 'Empty value' };
  }

  const tVal = translatedVal.trim();
  const eVal = (englishVal || '').trim();

  // a. Value must differ from English (unless allowed brand term)
  if (tVal.toLowerCase() === eVal.toLowerCase() && !BRAND_TERMS.has(eVal)) {
    return { pass: false, error: 'Value identical to English' };
  }

  // b. Script check
  const expectedScript = SCRIPT_MAP[lang];
  if (!expectedScript) {
    return { pass: false, error: `Unknown script for language ${lang}` };
  }

  // Check for foreign non-Latin scripts
  for (const script of ALL_NON_LATIN_SCRIPTS) {
    if (script !== expectedScript) {
      const alienRegex = new RegExp(`\\p{sc=${script}}`, 'u');
      if (alienRegex.test(tVal)) {
        return { pass: false, error: `Contains alien script: ${script}` };
      }
    }
  }

  // Strip whitelisted Latin tokens before computing letter ratio
  let stripped = tVal;
  // Sort whitelist by length descending so longer tokens match first
  const sortedTokens = [...WHITELIST_LATIN_TOKENS].sort((a, b) => b.length - a.length);
  for (const token of sortedTokens) {
    const esc = token.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    stripped = stripped.replace(new RegExp(`\\b${esc}\\b`, 'gi'), ' ');
  }

  const targetLetters = (stripped.match(new RegExp(`\\p{sc=${expectedScript}}`, 'gu')) || []).length;
  const allLetters = (stripped.match(/\p{L}/gu) || []).length;

  if (allLetters > 0) {
    const ratio = targetLetters / allLetters;
    if (ratio < 0.70) {
      return {
        pass: false,
        error: `Script ratio ${(ratio * 100).toFixed(1)}% < 70% in expected ${expectedScript}`
      };
    }
  } else {
    // If no letters left after stripping, check if original had letters
    const origTarget = (tVal.match(new RegExp(`\\p{sc=${expectedScript}}`, 'gu')) || []).length;
    const origAll = (tVal.match(/\p{L}/gu) || []).length;
    if (origAll > 0 && origTarget === 0 && !BRAND_TERMS.has(eVal)) {
      return { pass: false, error: `No letters in expected script ${expectedScript}` };
    }
  }

  // c. Number check
  const engNumbers = extractNumbers(eVal);
  const transNumbers = extractNumbers(tVal);

  const engSet = new Set(engNumbers);
  const transSet = new Set(transNumbers);

  if (engSet.size !== transSet.size || ![...engSet].every((n) => transSet.has(n))) {
    return {
      pass: false,
      error: `Number mismatch: English=[${engNumbers.join(', ')}], Translated=[${transNumbers.join(', ')}]`
    };
  }

  return { pass: true };
}

export async function validateAllTranslations() {
  const db = await getDb();
  const schemes = (await db.query('SELECT id, name, benefit_summary, eligibility_summary, translations FROM schemes ORDER BY id ASC')).rows;
  const docs = (await db.query('SELECT key, label, where_to_get, translations FROM document_types ORDER BY key ASC')).rows;

  const summary = [];
  const failures = [];

  for (const lang of TARGET_LANGS) {
    let schemeNamePass = 0;
    let schemeBenefitPass = 0;
    let schemeEligPass = 0;
    let docLabelPass = 0;
    let docWherePass = 0;

    for (const s of schemes) {
      const trans = s.translations?.[lang] || {};

      const vName = validateFieldContent({ lang, translatedVal: trans.name, englishVal: s.name });
      if (vName.pass) schemeNamePass++;
      else failures.push({ type: 'scheme', id: s.id, name: s.name, lang, field: 'name', error: vName.error });

      const vBenefit = validateFieldContent({ lang, translatedVal: trans.benefit_summary, englishVal: s.benefit_summary });
      if (vBenefit.pass) schemeBenefitPass++;
      else failures.push({ type: 'scheme', id: s.id, name: s.name, lang, field: 'benefit_summary', error: vBenefit.error });

      const vElig = validateFieldContent({ lang, translatedVal: trans.eligibility_summary, englishVal: s.eligibility_summary });
      if (vElig.pass) schemeEligPass++;
      else failures.push({ type: 'scheme', id: s.id, name: s.name, lang, field: 'eligibility_summary', error: vElig.error });
    }

    for (const d of docs) {
      const trans = d.translations?.[lang] || {};

      const vLabel = validateFieldContent({ lang, translatedVal: trans.label, englishVal: d.label });
      if (vLabel.pass) docLabelPass++;
      else failures.push({ type: 'doc', key: d.key, lang, field: 'label', error: vLabel.error });

      const vWhere = validateFieldContent({ lang, translatedVal: trans.where_to_get, englishVal: d.where_to_get });
      if (vWhere.pass) docWherePass++;
      else failures.push({ type: 'doc', key: d.key, lang, field: 'where_to_get', error: vWhere.error });
    }

    const allPassed =
      schemeNamePass === schemes.length &&
      schemeBenefitPass === schemes.length &&
      schemeEligPass === schemes.length &&
      docLabelPass === docs.length &&
      docWherePass === docs.length;

    summary.push({
      Lang: lang,
      'Scheme Name': `${schemeNamePass}/${schemes.length}`,
      'Scheme Benefit': `${schemeBenefitPass}/${schemes.length}`,
      'Scheme Elig': `${schemeEligPass}/${schemes.length}`,
      'Doc Label': `${docLabelPass}/${docs.length}`,
      'Doc Where': `${docWherePass}/${docs.length}`,
      Status: allPassed ? '✅ PASS' : '❌ FAIL',
    });
  }

  console.log('\n📊 ==============================================================================');
  console.log('📊 Content Validation Table per Language & Field (Scripts, Numbers & Non-English)');
  console.log('📊 ==============================================================================');
  console.table(summary);

  return { summary, failures, schemes, docs };
}

if (process.argv[1] && process.argv[1].endsWith('validate-translations.js')) {
  validateAllTranslations()
    .then(async ({ failures }) => {
      if (failures.length === 0) {
        console.log('🎉 100% of all translations passed content, script, and number validation!');
        await closeDb();
        process.exit(0);
      } else {
        console.warn(`⚠️ Total failing field entries: ${failures.length}`);
        console.warn('Sample failures:', failures.slice(0, 10));
        await closeDb();
        process.exit(1);
      }
    })
    .catch(async (err) => {
      console.error('Validation error:', err);
      await closeDb();
      process.exit(1);
    });
}
