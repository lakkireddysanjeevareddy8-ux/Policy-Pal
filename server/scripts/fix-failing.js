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
  extractNumbers,
} from './validate-translations.js';

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGeminiSingle(ai, prompt) {
  let attempts = 0;
  while (attempts < 5) {
    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });
      return JSON.parse(response.text?.trim() || '{}');
    } catch (err) {
      attempts++;
      const is429 = err.status === 429 || err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED');
      const wait = is429 ? 20000 : 5000;
      console.warn(`⏳ [Gemini Retry ${attempts}/5] Waiting ${wait / 1000}s...`);
      await sleep(wait);
    }
  }
  return null;
}

async function fixFailingTranslations() {
  console.log('🔧 Starting Precision Fixer for Failing Translations...');
  const db = await getDb();
  const ai = getAiClient();

  if (!ai) {
    console.error('No GEMINI_API_KEY');
    return;
  }

  // 1. Initial quick database alignment for Hindi and Telugu scheme names
  const allSchemes = (await db.query('SELECT * FROM schemes ORDER BY id ASC')).rows;
  for (const s of allSchemes) {
    let trans = s.translations || {};
    let changed = false;

    // Use s.name_hi if hi.name is English or invalid
    if (s.name_hi) {
      const vHi = validateFieldContent({ lang: 'hi', translatedVal: trans.hi?.name, englishVal: s.name });
      if (!vHi.pass) {
        if (!trans.hi) trans.hi = {};
        trans.hi.name = s.name_hi;
        changed = true;
      }
    }

    // Use s.name_te if te.name is English or invalid
    if (s.name_te) {
      let teName = s.name_te;
      if (s.name.includes('2.0') && !teName.includes('2')) {
        teName = teName + ' 2.0';
      }
      const vTe = validateFieldContent({ lang: 'te', translatedVal: trans.te?.name, englishVal: s.name });
      if (!vTe.pass) {
        if (!trans.te) trans.te = {};
        trans.te.name = teName;
        changed = true;
      }
    }

    if (changed) {
      await db.query('UPDATE schemes SET translations = $1 WHERE id = $2', [JSON.stringify(trans), s.id]);
    }
  }

  // 2. Batch-translate scheme names for other languages that are still English
  const schemeNamesNeedingTranslation = [];
  const refreshedSchemes = (await db.query('SELECT * FROM schemes ORDER BY id ASC')).rows;
  for (const s of refreshedSchemes) {
    for (const lang of TARGET_LANGS) {
      const val = s.translations?.[lang]?.name;
      const res = validateFieldContent({ lang, translatedVal: val, englishVal: s.name });
      if (!res.pass) {
        schemeNamesNeedingTranslation.push({ id: s.id, name: s.name, lang });
      }
    }
  }

  if (schemeNamesNeedingTranslation.length > 0) {
    console.log(`Translating ${schemeNamesNeedingTranslation.length} scheme names...`);
    // Group by scheme
    const byScheme = {};
    for (const item of schemeNamesNeedingTranslation) {
      if (!byScheme[item.id]) byScheme[item.id] = { name: item.name, langs: [] };
      byScheme[item.id].langs.push(item.lang);
    }

    for (const [id, info] of Object.entries(byScheme)) {
      const prompt = `Translate the Indian government scheme name "${info.name}" into each of the following languages:
${info.langs.map((l) => `${l}: ${LANGUAGE_NAME_MAP[l]} (Script: ${SCRIPT_MAP[l]})`).join('\n')}

Rules:
1. Write the title in the native script of each language.
2. Keep acronyms like (PM-KISAN, PMSBY, APY, etc.) in Latin letters.
3. Keep Western numbers (0-9).
Return JSON mapping each language code to {"name": "..."}:
{
  "${info.langs[0]}": { "name": "..." }
}`;

      const res = await callGeminiSingle(ai, prompt);
      if (res) {
        const sRow = (await db.query('SELECT translations FROM schemes WHERE id = $1', [id])).rows[0];
        let trans = sRow.translations || {};
        for (const lang of info.langs) {
          if (res[lang]?.name) {
            const cand = res[lang].name;
            const valid = validateFieldContent({ lang, translatedVal: cand, englishVal: info.name });
            if (valid.pass) {
              if (!trans[lang]) trans[lang] = {};
              trans[lang].name = cand;
            }
          }
        }
        await db.query('UPDATE schemes SET translations = $1 WHERE id = $2', [JSON.stringify(trans), id]);
      }
      await sleep(10000);
    }
  }

  // 3. Fix any remaining scheme benefit/eligibility or doc errors one by one with targeted single-language prompts
  let { failures } = await validateAllTranslations();
  console.log(`\nRemaining failures to fix one-by-one: ${failures.length}`);

  for (const f of failures) {
    console.log(`Fixing [${f.lang}.${f.field}] on ${f.type} "${f.name || f.key}" (error: ${f.error})...`);
    let engText = '';
    let targetObj = null;

    if (f.type === 'scheme') {
      const row = (await db.query('SELECT * FROM schemes WHERE id = $1', [f.id])).rows[0];
      engText = row[f.field];
      targetObj = row.translations || {};
    } else {
      const row = (await db.query('SELECT * FROM document_types WHERE key = $1', [f.key])).rows[0];
      engText = row[f.field];
      targetObj = row.translations || {};
    }

    const numbers = extractNumbers(engText);
    const expectedScript = SCRIPT_MAP[f.lang];
    const langName = LANGUAGE_NAME_MAP[f.lang];

    const prompt = `You are a professional government scheme translator for Indian languages.
Translate the following English government welfare text into pure ${langName} (${expectedScript} script).

English text:
"${engText}"

CRITICAL RULES:
1. Use 100% pure ${expectedScript} script. Do NOT include ANY words or letters from other non-Latin scripts (no Devanagari, no Tamil, no Telugu, no Bengali, no Arabic unless it is the expected script!).
2. Keep every number and percentage exactly as in English, written with Western digits (0-9). Numbers required: [${numbers.join(', ')}].
3. Keep proper nouns and acronyms (like PM-KISAN, APY, Aadhaar, PAN, RoR 1-B, UIDAI) in Latin letters.
4. Translate the entire text. Do not leave English sentences.

Return JSON:
{
  "translated": "..."
}`;

    const res = await callGeminiSingle(ai, prompt);
    if (res?.translated) {
      const cand = res.translated;
      const v = validateFieldContent({ lang: f.lang, translatedVal: cand, englishVal: engText });
      if (v.pass) {
        if (!targetObj[f.lang]) targetObj[f.lang] = {};
        targetObj[f.lang][f.field] = cand;

        if (f.type === 'scheme') {
          await db.query('UPDATE schemes SET translations = $1 WHERE id = $2', [JSON.stringify(targetObj), f.id]);
        } else {
          await db.query('UPDATE document_types SET translations = $1 WHERE key = $2', [JSON.stringify(targetObj), f.key]);
        }
        console.log(`  ✅ Fixed!`);
      } else {
        console.warn(`  ⚠️ Still invalid: ${v.error}`);
      }
    }
    await sleep(10000);
  }

  console.log('\n==========================================');
  console.log('Final Validation Audit');
  console.log('==========================================');
  const finalVal = await validateAllTranslations();
  if (finalVal.failures.length === 0) {
    console.log('🎉 100% of all translations passed content, script, and number validation!');
  } else {
    console.warn(`⚠️ Remaining failing field entries: ${finalVal.failures.length}`);
    finalVal.failures.forEach((x) => console.warn(`- ${x.type} "${x.name || x.key}" [${x.lang}.${x.field}]: ${x.error}`));
  }
}

fixFailingTranslations()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Fixer error:', err);
    await closeDb();
    process.exit(1);
  });
