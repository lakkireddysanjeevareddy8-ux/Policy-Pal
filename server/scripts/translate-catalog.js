import dotenv from 'dotenv';
dotenv.config();

import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { getDb, closeDb } from '../src/db/index.js';
import { LANGUAGE_NAME_MAP } from '../src/services/ai/prompts.js';

const MultiLangSchemeSchema = z.record(
  z.string(),
  z.object({
    name: z.string().min(1),
    benefit_summary: z.string().min(1),
    eligibility_summary: z.string().min(1),
  })
);

const MultiLangDocSchema = z.record(
  z.string(),
  z.object({
    label: z.string().min(1),
    where_to_get: z.string().min(1),
  })
);

const TARGET_LANGS = ['hi', 'te', 'ta', 'kn', 'ml', 'mr', 'gu', 'bn', 'pa', 'or', 'as', 'ur'];

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGeminiBatch(ai, prompt, zodSchema) {
  let attempts = 0;
  while (attempts < 3) {
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
      const parsed = JSON.parse(rawText);
      return zodSchema.parse(parsed);
    } catch (err) {
      attempts++;
      console.warn(`[Gemini Batch Attempt ${attempts}]`, err.message?.substring(0, 120));
      if (attempts >= 3) return null;
      await sleep(15000); // Wait on rate limits
    }
  }
  return null;
}

export async function translateCatalog() {
  console.log('🌐 Starting Idempotent Batched Catalog Translation Script...');
  const db = await getDb();
  const ai = getAiClient();

  // 1. Schemes Translation
  const schemesRes = await db.query('SELECT * FROM schemes ORDER BY name ASC');
  const schemes = schemesRes.rows;
  console.log(`Found ${schemes.length} schemes in catalog.`);

  for (const s of schemes) {
    let translations = s.translations || {};
    let needsUpdate = false;

    // Seed legacy
    if (!translations.te && s.name_te) {
      translations.te = {
        name: s.name_te,
        benefit_summary: s.benefit_summary,
        eligibility_summary: s.eligibility_summary,
      };
      needsUpdate = true;
    }
    if (!translations.hi && s.name_hi) {
      translations.hi = {
        name: s.name_hi,
        benefit_summary: s.benefit_summary,
        eligibility_summary: s.eligibility_summary,
      };
      needsUpdate = true;
    }

    const missingLangs = TARGET_LANGS.filter((l) => !translations[l] || !translations[l].name);

    if (missingLangs.length > 0) {
      console.log(`Translating scheme "${s.name}" for missing languages: ${missingLangs.join(', ')}...`);

      if (ai) {
        const langDescriptions = missingLangs
          .map((code) => `${code}: ${LANGUAGE_NAME_MAP[code] || code}`)
          .join('\n');

        const prompt = `Translate this Indian welfare scheme into each of the following languages:
${langDescriptions}

Scheme English Details:
Name: ${s.name}
Benefit Summary: ${s.benefit_summary}
Eligibility Summary: ${s.eligibility_summary}

Rules:
1. Keep proper noun scheme names (like PM-KISAN, Ayushman Bharat, PMAY) recognizable.
2. Return JSON object mapping each language code to its translated object:
{
  "${missingLangs[0]}": {
    "name": "...",
    "benefit_summary": "...",
    "eligibility_summary": "..."
  }
}`;

        const batchRes = await callGeminiBatch(ai, prompt, MultiLangSchemeSchema);
        if (batchRes) {
          for (const lang of missingLangs) {
            if (batchRes[lang]) {
              translations[lang] = batchRes[lang];
              needsUpdate = true;
            }
          }
        }
        await sleep(2000); // 2 second pause between schemes
      }

      // Fallback for any remaining missing languages
      for (const lang of missingLangs) {
        if (!translations[lang]) {
          translations[lang] = {
            name: s.name,
            benefit_summary: s.benefit_summary,
            eligibility_summary: s.eligibility_summary,
          };
          needsUpdate = true;
        }
      }
    }

    if (needsUpdate) {
      await db.query('UPDATE schemes SET translations = $1 WHERE id = $2', [
        JSON.stringify(translations),
        s.id,
      ]);
    }
  }

  // 2. Document Types Translation
  const docsRes = await db.query('SELECT * FROM document_types ORDER BY key ASC');
  const docs = docsRes.rows;
  console.log(`Found ${docs.length} document types.`);

  for (const d of docs) {
    let translations = d.translations || {};
    let needsUpdate = false;

    if (!translations.te && d.label_te) {
      translations.te = { label: d.label_te, where_to_get: d.where_to_get || '' };
      needsUpdate = true;
    }
    if (!translations.hi && d.label_hi) {
      translations.hi = { label: d.label_hi, where_to_get: d.where_to_get || '' };
      needsUpdate = true;
    }

    const missingLangs = TARGET_LANGS.filter((l) => !translations[l] || !translations[l].label);

    if (missingLangs.length > 0) {
      for (const lang of missingLangs) {
        translations[lang] = {
          label: d.label,
          where_to_get: d.where_to_get || '',
        };
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await db.query('UPDATE document_types SET translations = $1 WHERE key = $2', [
        JSON.stringify(translations),
        d.key,
      ]);
    }
  }

  console.log('🎉 Catalog translations stored and validated in database!');
}

if (process.argv[1] && process.argv[1].endsWith('translate-catalog.js')) {
  translateCatalog()
    .then(async () => {
      await closeDb();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Catalog translation error:', err);
      await closeDb();
      process.exit(1);
    });
}
