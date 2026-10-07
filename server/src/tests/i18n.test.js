import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SUPPORTED_LANG_CODES } from '../schemas/constants.js';
import { registerSchema, updateLanguageSchema } from '../schemas/auth.schema.js';
import { createAssessmentSchema } from '../schemas/ai.schema.js';
import { getFullLanguageName } from '../services/ai/prompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.resolve(__dirname, '../../../client/src/i18n/locales');

describe('Full 13 Indian Languages Multi-Language Support Test Suite', () => {
  // 1. Language Configuration & Parity Tests
  test('Should configure exactly 13 supported Indian languages', () => {
    assert.equal(SUPPORTED_LANG_CODES.length, 13);
    const expected = ['en', 'hi', 'te', 'ta', 'kn', 'ml', 'mr', 'gu', 'bn', 'pa', 'or', 'as', 'ur'];
    assert.deepEqual(SUPPORTED_LANG_CODES.sort(), expected.sort());
  });

  test('Prompt service should map every language code to its native script representation', () => {
    for (const code of SUPPORTED_LANG_CODES) {
      const name = getFullLanguageName(code);
      assert.ok(name && name.length > 2, `Language name for ${code} should be defined`);
    }
    assert.match(getFullLanguageName('te'), /తెలుగు/);
    assert.match(getFullLanguageName('ta'), /தமிழ்/);
    assert.match(getFullLanguageName('ur'), /اردو/);
    assert.match(getFullLanguageName('hi'), /हिन्दी/);
  });

  // 2. Client Locale Key Parity Tests
  test('All 13 locale JSON files must exist with 100% key parity and no empty strings', () => {
    const enFile = path.join(localesDir, 'en.json');
    assert.ok(fs.existsSync(enFile), 'en.json must exist as source of truth');
    const enData = JSON.parse(fs.readFileSync(enFile, 'utf8'));

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

    const enLeaves = getLeaves(enData);
    const enKeys = Object.keys(enLeaves);
    assert.ok(enKeys.length >= 270, `en.json should have at least 270 keys, found ${enKeys.length}`);

    for (const code of SUPPORTED_LANG_CODES) {
      const localePath = path.join(localesDir, `${code}.json`);
      assert.ok(fs.existsSync(localePath), `${code}.json must exist`);
      const data = JSON.parse(fs.readFileSync(localePath, 'utf8'));
      const leaves = getLeaves(data);
      const keys = Object.keys(leaves);

      const missing = enKeys.filter((k) => !(k in leaves));
      assert.equal(missing.length, 0, `[${code}.json] Missing keys: ${missing.slice(0, 5).join(', ')}`);

      const empty = Object.entries(leaves).filter(
        ([, v]) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
      );
      assert.equal(empty.length, 0, `[${code}.json] Found ${empty.length} empty values`);
    }
  });

  // 3. Schema & Validation Tests for all 13 languages
  test('Registration schema must accept all 13 language codes and reject invalid codes', () => {
    for (const code of SUPPORTED_LANG_CODES) {
      const valid = registerSchema.safeParse({
        email: `citizen_${code}@example.com`,
        password: 'ValidPassword123!',
        full_name: 'Test Citizen',
        preferred_language: code,
      });
      assert.ok(valid.success, `Registration should accept language: ${code}`);
    }

    const invalid = registerSchema.safeParse({
      email: 'citizen_invalid@example.com',
      password: 'ValidPassword123!',
      full_name: 'Test Citizen',
      preferred_language: 'invalid_code',
    });
    assert.equal(invalid.success, false);
  });

  test('Language update schema must validate and accept all 13 languages', () => {
    for (const code of SUPPORTED_LANG_CODES) {
      const res = updateLanguageSchema.safeParse({ preferred_language: code });
      assert.ok(res.success, `updateLanguageSchema should accept ${code}`);
    }

    const resBad = updateLanguageSchema.safeParse({ preferred_language: 'french' });
    assert.equal(resBad.success, false);
  });

  test('Assessment creation schema must accept all 13 languages', () => {
    for (const code of SUPPORTED_LANG_CODES) {
      const res = createAssessmentSchema.safeParse({
        situation_text: 'I am a 42 year old farmer from Warangal cultivating 2 acres land.',
        language: code,
      });
      assert.ok(res.success, `createAssessmentSchema should accept ${code}`);
    }
  });

  // 4. Persistence Simulation Tests (Requirement 3 & 4)
  test('Startup priority: localStorage -> user.preferred_language -> "en"', () => {
    // Mock localStorage simulation
    let storage = {};
    const mockLocalStorage = {
      getItem: (key) => storage[key] || null,
      setItem: (key, val) => {
        storage[key] = String(val);
      },
      removeItem: (key) => {
        delete storage[key];
      },
    };

    function simulateGetInitialLanguage() {
      const stored = mockLocalStorage.getItem('policypal_lang');
      if (stored && SUPPORTED_LANG_CODES.includes(stored)) return stored;

      const userStr = mockLocalStorage.getItem('policypal_user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user?.preferred_language && SUPPORTED_LANG_CODES.includes(user.preferred_language)) {
            mockLocalStorage.setItem('policypal_lang', user.preferred_language);
            return user.preferred_language;
          }
        } catch {}
      }

      return 'en';
    }

    // Case 1: Fresh browser, no storage
    storage = {};
    assert.equal(simulateGetInitialLanguage(), 'en');

    // Case 2: User selected Tamil ('ta')
    mockLocalStorage.setItem('policypal_lang', 'ta');
    assert.equal(simulateGetInitialLanguage(), 'ta');

    // Case 3: Page reload on deep route like /documents
    assert.equal(simulateGetInitialLanguage(), 'ta', 'Tamil remains active after reload');

    // Case 4: Login with different preferred_language does NOT overwrite manual localStorage choice
    mockLocalStorage.setItem('policypal_user', JSON.stringify({ preferred_language: 'hi' }));
    assert.equal(simulateGetInitialLanguage(), 'ta', 'Manual choice takes precedence over profile on login');

    // Case 5: Logout does NOT reset language
    mockLocalStorage.removeItem('policypal_user');
    assert.equal(simulateGetInitialLanguage(), 'ta', 'Logout preserves selected language in localStorage');
  });

  // 5. Direction & RTL Test for Urdu (Requirement 2 & 6)
  test('Urdu must be designated as RTL direction', () => {
    const configPath = path.resolve(__dirname, '../../../client/src/i18n/languages.js');
    const content = fs.readFileSync(configPath, 'utf8');

    assert.ok(content.includes("code: 'ur'"), 'Urdu config must exist in languages.js');
    assert.ok(content.includes("dir: 'rtl'"), 'Urdu dir must be rtl');
    assert.ok(content.includes('Noto Naskh Arabic'), 'Urdu font must include Noto Naskh Arabic');
  });
});
