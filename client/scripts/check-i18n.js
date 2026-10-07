import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const srcDir = path.join(__dirname, '..', 'src');

const ALL_LANGS = ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'gu', 'bn', 'pa', 'or', 'as', 'ur'];

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

// 2. Check each locale
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

  if (missing.length === 0 && extra.length === 0 && empty.length === 0) {
    console.log(`✅ [${lang}.json] Perfect key parity (${keySet.size}/${enKeySet.size} keys, 0 empty values)`);
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

  // Match text between > and <
  const regex = />([^<>{}]+)</g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const text = match[1].trim();
    if (!text) continue;
    // Check if contains alphabet words of length > 2
    const words = text.match(/[A-Za-z]{3,}/g);
    if (!words) continue;

    // Check if it's all whitelisted
    const nonWhitelisted = words.filter((w) => !WHITELIST_WORDS.has(w) && !WHITELIST_WORDS.has(text));
    if (nonWhitelisted.length > 0 && !text.startsWith('/*') && !text.includes('className')) {
      // Calculate line number
      const line = content.substring(0, match.index).split('\n').length;
      hardcodedFound.push({ file: relPath, line, text });
    }
  }
}

if (hardcodedFound.length > 0) {
  console.warn(`\n⚠️  Found ${hardcodedFound.length} potential hardcoded text instances in JSX:`);
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
  console.log('\n🎉 Quality Gate Passed: All 13 locale files verified with 100% key parity and 0 empty values!');
}
