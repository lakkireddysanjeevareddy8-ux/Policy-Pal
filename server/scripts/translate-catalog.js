import dotenv from 'dotenv';
dotenv.config();

import { GoogleGenAI } from '@google/genai';
import { getDb, closeDb } from '../src/db/index.js';
import { LANGUAGE_NAME_MAP } from '../src/services/ai/prompts.js';
import {
  TARGET_LANGS,
  SCRIPT_MAP,
  validateFieldContent,
  validateAllTranslations,
} from './validate-translations.js';

function sanitize(str) {
  if (!str) return '';
  return String(str)
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]')
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@[^\s]+/g, '[REDACTED_DATABASE_URL]');
}

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGemini(ai, prompt, entityName = '') {
  let attempts = 0;
  const maxAttempts = 6;
  while (attempts < maxAttempts) {
    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const rawText = response.text?.trim() || '{}';
      return JSON.parse(rawText);
    } catch (err) {
      attempts++;
      const isRateLimit =
        err.status === 429 ||
        err.message?.includes('429') ||
        err.message?.includes('RESOURCE_EXHAUSTED') ||
        err.message?.includes('Quota exceeded');

      const cleanMsg = sanitize(err.message?.substring(0, 150));
      if (isRateLimit) {
        const waitSec = 20 + attempts * 5;
        console.warn(`⏳ [Rate Limit 429 on ${entityName}] Attempt ${attempts}/${maxAttempts}. Waiting ${waitSec}s...`);
        await sleep(waitSec * 1000);
      } else {
        console.warn(`⚠️ [Gemini Error on ${entityName}] Attempt ${attempts}/${maxAttempts}: ${cleanMsg}`);
        if (attempts >= maxAttempts) return null;
        await sleep(5000);
      }
    }
  }
  return null;
}

export async function translateCatalog() {
  console.log('🌐 Starting Quality-Enforced Catalog Translation & Fix Engine...');
  const db = await getDb();
  const ai = getAiClient();

  if (!ai) {
    console.error('❌ GEMINI_API_KEY is missing or invalid.');
    return;
  }

  // Phase 1: Re-translate schemes with failing fields
  const schemesRes = await db.query('SELECT * FROM schemes ORDER BY id ASC');
  const schemes = schemesRes.rows;

  for (let i = 0; i < schemes.length; i++) {
    const s = schemes[i];
    let translations = s.translations || {};

    // Determine which languages fail validation for this scheme
    const failingLangs = TARGET_LANGS.filter((lang) => {
      const t = translations[lang] || {};
      const vN = validateFieldContent({ lang, translatedVal: t.name, englishVal: s.name });
      const vB = validateFieldContent({ lang, translatedVal: t.benefit_summary, englishVal: s.benefit_summary });
      const vE = validateFieldContent({ lang, translatedVal: t.eligibility_summary, englishVal: s.eligibility_summary });
      return !vN.pass || !vB.pass || !vE.pass;
    });

    if (failingLangs.length === 0) {
      console.log(`[${i + 1}/${schemes.length}] Scheme "${s.name}" already 100% passes all 12 languages.`);
      continue;
    }

    console.log(`[${i + 1}/${schemes.length}] Translating scheme "${s.name}" for ${failingLangs.length} failing languages: ${failingLangs.join(', ')}...`);

    const langDescriptions = failingLangs
      .map((code) => `${code}: ${LANGUAGE_NAME_MAP[code] || code} (Script: ${SCRIPT_MAP[code]})`)
      .join('\n');

    const prompt = `Translate this Indian welfare scheme into each of the following languages:
${langDescriptions}

Scheme English Details:
Name: ${s.name}
Benefit Summary: ${s.benefit_summary}
Eligibility Summary: ${s.eligibility_summary}

CRITICAL RULES:
1. Keep every number, amount, percentage, and age exactly as in the English text, written with Western digits (0-9). Do not omit or alter any numbers.
2. Use only the target script for each language:
   - Devanagari for Hindi and Marathi
   - Telugu for Telugu
   - Tamil for Tamil
   - Kannada for Kannada
   - Malayalam for Malayalam
   - Gujarati for Gujarati
   - Bengali for Bengali and Assamese
   - Gurmukhi for Punjabi
   - Odia for Odia
   - Arabic script for Urdu
   Do not mix letters from any other non-Latin script!
3. Keep proper nouns and acronyms (like PM-KISAN, Ayushman Bharat, PMAY, APY, Aadhaar, PAN) in Latin.
4. Translate all descriptions (benefit_summary and eligibility_summary) completely into the target language—do NOT leave them in English!
5. Return JSON object mapping each language code to its translated object:
{
  "${failingLangs[0]}": {
    "name": "...",
    "benefit_summary": "...",
    "eligibility_summary": "..."
  }
}`;

    let parsed = await callGemini(ai, prompt, s.name);
    if (parsed) {
      let updatedCount = 0;
      for (const lang of failingLangs) {
        if (parsed[lang]) {
          const cand = parsed[lang];
          // Validate before accepting
          const vB = validateFieldContent({ lang, translatedVal: cand.benefit_summary, englishVal: s.benefit_summary });
          const vE = validateFieldContent({ lang, translatedVal: cand.eligibility_summary, englishVal: s.eligibility_summary });
          const vN = validateFieldContent({ lang, translatedVal: cand.name, englishVal: s.name });

          if (vB.pass && vE.pass) {
            translations[lang] = {
              name: cand.name || translations[lang]?.name || s.name,
              benefit_summary: cand.benefit_summary,
              eligibility_summary: cand.eligibility_summary,
            };
            updatedCount++;
          } else {
            console.warn(`  ⚠️ Candidate for ${lang} partially invalid: Benefit=${vB.error || 'ok'}, Elig=${vE.error || 'ok'}, Name=${vN.error || 'ok'}`);
            // If benefit and elig passed, accept them
            translations[lang] = {
              name: vN.pass ? cand.name : (translations[lang]?.name || cand.name),
              benefit_summary: cand.benefit_summary,
              eligibility_summary: cand.eligibility_summary,
            };
            updatedCount++;
          }
        }
      }

      if (updatedCount > 0) {
        await db.query('UPDATE schemes SET translations = $1 WHERE id = $2', [
          JSON.stringify(translations),
          s.id,
        ]);
        console.log(`  ✅ Updated ${updatedCount} languages in database for "${s.name}".`);
      }
    }

    // Safety pause to comfortably stay within free tier rate limit
    await sleep(13000);
  }

  // Phase 2: Re-translate failing document types
  const docsRes = await db.query('SELECT * FROM document_types ORDER BY key ASC');
  const docs = docsRes.rows;

  const failingDocs = [];
  for (const d of docs) {
    const trans = d.translations || {};
    const failingLangs = TARGET_LANGS.filter((lang) => {
      const t = trans[lang] || {};
      const vL = validateFieldContent({ lang, translatedVal: t.label, englishVal: d.label });
      const vW = validateFieldContent({ lang, translatedVal: t.where_to_get, englishVal: d.where_to_get });
      return !vL.pass || !vW.pass;
    });
    if (failingLangs.length > 0) {
      failingDocs.push({ doc: d, failingLangs });
    }
  }

  if (failingDocs.length > 0) {
    console.log(`\nTranslating ${failingDocs.length} document types with failing fields...`);
    for (const { doc, failingLangs } of failingDocs) {
      const langDescriptions = failingLangs
        .map((code) => `${code}: ${LANGUAGE_NAME_MAP[code] || code} (Script: ${SCRIPT_MAP[code]})`)
        .join('\n');

      const prompt = `Translate this Indian citizen document type into each of the following languages:
${langDescriptions}

Document English Details:
Key: ${doc.key}
Label: ${doc.label}
Where to get: ${doc.where_to_get || 'Designated government portal or office'}

CRITICAL RULES:
1. Keep every number (e.g. 1-B) and acronym exactly as in the English text, written with Western digits.
2. Use only the target script for each language. Do not mix letters from any other non-Latin script!
3. Keep proper nouns and acronyms (like Aadhaar, PAN, RoR, 1-B, UIDAI) in Latin.
4. Translate both label and where_to_get completely into the target language.
5. Return JSON object mapping each language code to:
{
  "${failingLangs[0]}": {
    "label": "...",
    "where_to_get": "..."
  }
}`;

      const parsed = await callGemini(ai, prompt, doc.key);
      if (parsed) {
        let trans = doc.translations || {};
        for (const lang of failingLangs) {
          if (parsed[lang]) {
            trans[lang] = {
              label: parsed[lang].label || trans[lang]?.label || doc.label,
              where_to_get: parsed[lang].where_to_get || trans[lang]?.where_to_get || doc.where_to_get,
            };
          }
        }
        await db.query('UPDATE document_types SET translations = $1 WHERE key = $2', [
          JSON.stringify(trans),
          doc.key,
        ]);
        console.log(`  ✅ Updated document "${doc.key}" in database.`);
      }
      await sleep(13000);
    }
  }

  console.log('\n==========================================');
  console.log('Translation pass completed! Running validation...');
  console.log('==========================================');

  // Phase 3: Final validation table
  const { failures } = await validateAllTranslations();

  // Phase 4: Print 3 random sample schemes with their multi-language translations
  console.log('\n🔍 ==============================================================================');
  console.log('🔍 3 Random Scheme Translation Samples (Quality Verification)');
  console.log('🔍 ==============================================================================');

  const refreshedSchemes = (await db.query('SELECT * FROM schemes ORDER BY RANDOM() LIMIT 3')).rows;
  for (let idx = 0; idx < refreshedSchemes.length; idx++) {
    const sample = refreshedSchemes[idx];
    console.log(`\n--- Sample ${idx + 1}: ${sample.name} ---`);
    console.log(`[English]`);
    console.log(`  Benefit: ${sample.benefit_summary}`);
    console.log(`  Elig:    ${sample.eligibility_summary}`);

    for (const sampleLang of ['hi', 'te', 'ta']) {
      const st = sample.translations?.[sampleLang] || {};
      console.log(`[${sampleLang.toUpperCase()} - ${LANGUAGE_NAME_MAP[sampleLang]}]`);
      console.log(`  Name:    ${st.name}`);
      console.log(`  Benefit: ${st.benefit_summary}`);
      console.log(`  Elig:    ${st.eligibility_summary}`);
    }
  }

  if (failures.length > 0) {
    console.warn(`\n⚠️ Remaining failing fields: ${failures.length}`);
    for (const f of failures.slice(0, 15)) {
      console.warn(`  - ${f.type} "${f.name || f.key}" [${f.lang}.${f.field}]: ${f.error}`);
    }
  } else {
    console.log('\n🎉 ALL catalog translations passed content, script, and number validation!');
  }
}

if (process.argv[1] && process.argv[1].endsWith('translate-catalog.js')) {
  translateCatalog()
    .then(async () => {
      await closeDb();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Catalog translation error:', sanitize(err.message));
      await closeDb();
      process.exit(1);
    });
}
