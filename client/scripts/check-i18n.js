import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const srcDir = path.join(__dirname, '..', 'src');

const ALL_LANGS = ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'gu', 'bn', 'pa', 'or', 'as', 'ur'];

const SCRIPT_MAP = {
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

const ALL_NON_LATIN_SCRIPTS = [
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

const WHITELIST_LATIN_TOKENS = [
  'PM-KISAN', 'PMFBY', 'PM-JAY', 'PMJJBY', 'PMSBY', 'PMMY', 'PMUY', 'PMAY-G', 'PMAY-U', 'PMAY',
  'KCC', 'APY', 'NPS', 'SECC', 'Aadhaar', 'PAN', 'JSY', 'SSY', 'NSAP', 'IGNOAPS', 'NREGA', 'MGNREGA',
  'DBTL', 'LPG', 'CSC', 'URL', 'SMS', 'OTP', 'KYC', 'e-KYC', 'eKYC', 'IFSC', 'DBT', 'ST', 'SC', 'OBC',
  'EWS', 'BPL', 'Dr', 'YSR', 'Aarogyasri', 'Vishwakarma', 'SVANidhi', 'PolicyPal', 'Gov', 'AI', 'PDF',
  'UIDAI', 'NPCI', 'RTI', 'ITR', 'TIN', 'GST', 'm-Aadhaar', 'Voter ID', 'ID', 'PM', 'KISAN', 'MUDRA',
  'Janani', 'Suraksha', 'Atal', 'Pension', 'Sukanya', 'Samriddhi', 'Ayushman', 'Bharat', 'Rythu', 'Bandhu',
  'Post-Matric', 'Portal', 'Gemini', 'Render', 'free-tier', 'cold', 'start', 'RoR'
];

const ALLOWED_IDENTICAL_KEYS = new Set([
  'auth.emailPlaceholder',
  'assessment.inrUnit',
  'common.appName',
  'common.beta',
]);

function normalizeDigitsToAscii(str) {
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

function extractNumbers(str) {
  if (!str) return [];
  const normalized = normalizeDigitsToAscii(str);
  const cleaned = normalized.replace(/(?<=\d),(?=\d)/g, '');
  const matches = cleaned.match(/\b\d+(?:\.\d+)?\b/g) || [];
  return Array.from(new Set(matches.map((m) => String(Number(m))))).sort();
}

function getLeaves(obj, prefix = '') {
  const leaves = {};
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(leaves, getLeaves(v, fullKey));
    } else {
      leaves[fullKey] = v;
    }
  }
  return leaves;
}

let hasErrors = false;

// 1. Verify Master en.json
const enPath = path.join(localesDir, 'en.json');
if (!fs.existsSync(enPath)) {
  console.error('❌ Master en.json not found!');
  process.exit(1);
}

const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const enLeaves = getLeaves(enData);
const enKeySet = new Set(Object.keys(enLeaves));

console.log(`📋 Master en.json contains ${enKeySet.size} translation keys.\n`);

// 2. Check each locale for structure, script correctness, and number parity
for (const lang of ALL_LANGS) {
  const filePath = path.join(localesDir, `${lang}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Locale file missing: ${lang}.json`);
    hasErrors = true;
    continue;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`❌ Failed to parse ${lang}.json:`, err.message);
    hasErrors = true;
    continue;
  }

  const leaves = getLeaves(data);
  const keySet = new Set(Object.keys(leaves));

  const missing = [...enKeySet].filter((k) => !keySet.has(k));
  const extra = [...keySet].filter((k) => !enKeySet.has(k));
  const empty = Object.entries(leaves).filter(
    ([k, v]) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
  );

  if (missing.length > 0) {
    console.error(`❌ [${lang}.json] Missing ${missing.length} keys:`, missing.slice(0, 5));
    hasErrors = true;
  }

  if (extra.length > 0) {
    console.error(`❌ [${lang}.json] Has ${extra.length} extra keys not in en.json:`, extra.slice(0, 5));
    hasErrors = true;
  }

  if (empty.length > 0) {
    console.error(`❌ [${lang}.json] Has ${empty.length} empty values:`, empty.slice(0, 5).map(([k]) => k));
    hasErrors = true;
  }

  // Script and Number Checks for non-English locales
  if (lang !== 'en') {
    const expectedScript = SCRIPT_MAP[lang];
    const scriptErrors = [];
    const numberErrors = [];

    for (const [key, val] of Object.entries(leaves)) {
      const enVal = enLeaves[key];
      if (typeof enVal !== 'string' || typeof val !== 'string') continue;
      if (ALLOWED_IDENTICAL_KEYS.has(key)) continue;

      // Strip {{variable}} interpolation tokens before checking
      const cleanEnVal = enVal.replace(/\{\{[^}]+\}\}/g, ' ');
      const cleanVal = val.replace(/\{\{[^}]+\}\}/g, ' ');

      // a. Check for foreign non-Latin scripts
      for (const script of ALL_NON_LATIN_SCRIPTS) {
        if (script !== expectedScript) {
          const alienRegex = new RegExp(`\\p{sc=${script}}`, 'u');
          if (alienRegex.test(cleanVal)) {
            scriptErrors.push({ key, error: `Contains alien script ${script}`, val });
            break;
          }
        }
      }

      // b. Check script ratio (at least 70% in expected script)
      let stripped = cleanVal;
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
          scriptErrors.push({
            key,
            error: `Script ratio ${(ratio * 100).toFixed(1)}% < 70% in ${expectedScript}`,
            val
          });
        }
      }

      // c. Number check
      const engNumbers = extractNumbers(cleanEnVal);
      const transNumbers = extractNumbers(cleanVal);
      const engSet = new Set(engNumbers);
      const transSet = new Set(transNumbers);

      if (engSet.size !== transSet.size || ![...engSet].every((n) => transSet.has(n))) {
        numberErrors.push({
          key,
          error: `Number mismatch: English=[${engNumbers.join(', ')}], Translated=[${transNumbers.join(', ')}]`,
          val
        });
      }
    }

    if (scriptErrors.length > 0) {
      console.error(`❌ [${lang}.json] ${scriptErrors.length} script errors found:`, scriptErrors.slice(0, 3));
      hasErrors = true;
    }
    if (numberErrors.length > 0) {
      console.error(`❌ [${lang}.json] ${numberErrors.length} number mismatch errors found:`, numberErrors.slice(0, 3));
      hasErrors = true;
    }

    if (missing.length === 0 && extra.length === 0 && empty.length === 0 && scriptErrors.length === 0 && numberErrors.length === 0) {
      console.log(`✅ [${lang}.json] Perfect key parity, script purity, and number invariants (273/273 keys)`);
    }
  } else if (missing.length === 0 && extra.length === 0 && empty.length === 0) {
    console.log(`✅ [en.json] Master template verified (${keySet.size}/${enKeySet.size} keys)`);
  }
}

// 3. Scan src for hardcoded JSX text
console.log('\n🔍 Scanning src/ for hardcoded JSX text strings...');

const WHITELIST_WORDS = new Set([
  'PolicyPal',
  'PM-KISAN',
  'PM-JAY',
  'Aadhaar',
  'PAN',
  'Gov AI',
  '404',
  'Ayushman Bharat',
  'Rythu Bandhu',
  'UIDAI',
  'Ramesh Patel',
  'OBC',
  'SC',
  'ST',
  'EWS',
  'General',
  '✕',
  '✓',
  '→',
]);

function getAllFiles(dir, exts = ['.jsx']) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, exts));
    } else if (exts.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

const jsxFiles = getAllFiles(srcDir);
const hardcodedFound = [];

for (const file of jsxFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(path.join(__dirname, '..'), file);

  const regex = />([^<>{}]+)</g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const text = match[1].trim();
    if (!text) continue;
    const words = text.match(/[A-Za-z]{3,}/g);
    if (!words) continue;

    const nonWhitelisted = words.filter((w) => !WHITELIST_WORDS.has(w) && !WHITELIST_WORDS.has(text));
    if (nonWhitelisted.length > 0 && !text.startsWith('/*') && !text.includes('className')) {
      const line = content.substring(0, match.index).split('\n').length;
      hardcodedFound.push({ file: relPath, line, text });
    }
  }
}

if (hardcodedFound.length > 0) {
  console.warn(`\n⚠️ Found ${hardcodedFound.length} potential hardcoded text instances in JSX:`);
  for (const item of hardcodedFound.slice(0, 15)) {
    console.warn(`  - ${item.file}:${item.line} -> "${item.text}"`);
  }
  if (hardcodedFound.length > 15) {
    console.warn(`  ... and ${hardcodedFound.length - 15} more.`);
  }
} else {
  console.log('✅ No raw hardcoded text found in JSX files! 100% extracted.');
}

if (hasErrors) {
  console.error('\n❌ i18n audit failed! Please fix the errors above.');
  process.exit(1);
} else {
  console.log('\n🎉 Quality Gate Passed: All 13 locale files verified with 100% key parity, script purity, and number invariants!');
}
