import { GoogleGenAI } from '@google/genai';
import {
  SYSTEM_INSTRUCTION,
  getProfileExtractionPrompt,
  getSchemeMatchingPrompt,
  getChecklistPrompt,
} from './prompts.js';
import {
  ProfileExtractionSchema,
  SchemeMatchOutputSchema,
  ChecklistOutputSchema,
} from '../../schemas/ai.schema.js';

export function getGeminiModel(isFallback = false) {
  if (isFallback) {
    return process.env.GEMINI_FALLBACK_MODEL || process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  }
  return process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
}

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

// Concurrency helper for running tasks in parallel with a concurrency cap
async function mapConcurrent(items, limit, asyncFn) {
  const results = [];
  const executing = [];

  for (const item of items) {
    const p = Promise.resolve().then(() => asyncFn(item));
    results.push(p);

    if (limit <= items.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(results);
}

// Generic Gemini caller with 25s timeout, exponential backoff on 429/503, JSON mode, and Zod validation
async function callGeminiWithRetry({ prompt, zodSchema, jsonSchema, description }) {
  const ai = getAiClient();
  if (!ai) {
    const keyError = new Error('GEMINI_API_KEY is not configured on the server. A valid Gemini API key is required.');
    keyError.status = 502;
    keyError.code = 'GEMINI_KEY_MISSING';
    throw keyError;
  }

  let attempts = 0;
  let lastError = null;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    const isRetryDueToHttpError =
      lastError &&
      (lastError.status === 429 ||
        lastError.status === 503 ||
        lastError.message?.includes('429') ||
        lastError.message?.includes('503') ||
        lastError.message?.includes('high demand') ||
        lastError.message?.includes('RESOURCE_EXHAUSTED'));

    const currentModel = getGeminiModel(isRetryDueToHttpError);
    console.log(`🤖 Using Gemini AI model: ${currentModel} (${description}, attempt ${attempts})`);

    try {
      const generatePromise = ai.models.generateContent({
        model: currentModel,
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          ...(jsonSchema ? { responseSchema: jsonSchema } : {}),
          temperature: 0.2,
        },
      });

      // 25-second timeout protection
      const timeoutPromise = new Promise((_, reject) => {
        const id = setTimeout(() => {
          clearTimeout(id);
          reject(new Error('AI request timed out after 25 seconds'));
        }, 25000);
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);

      const responseText = response.text || '';
      let parsedJson;
      try {
        parsedJson = JSON.parse(responseText.trim());
      } catch (parseErr) {
        throw new Error(`Invalid JSON returned from Gemini: ${parseErr.message}`);
      }

      // Auto-wrap flat profile output if model returns fields at root level
      if (
        description === 'extractProfile' &&
        !parsedJson.profile &&
        (parsedJson.state !== undefined || parsedJson.age !== undefined || parsedJson.occupation !== undefined)
      ) {
        const { summary, missing_info, ...profileFields } = parsedJson;
        parsedJson = {
          profile: profileFields,
          summary: summary || '',
          missing_info: missing_info || [],
        };
      }

      // Auto-unwrap array if returned inside an object wrapper (e.g. { matches: [...] })
      if (
        (description.startsWith('matchSchemes') || description.startsWith('buildChecklist')) &&
        !Array.isArray(parsedJson) &&
        typeof parsedJson === 'object' &&
        parsedJson !== null
      ) {
        const commonKeys = [
          'matches',
          'schemes',
          'results',
          'checklist',
          'steps',
          'data',
          'items',
          'scheme_matches',
          'eligible_schemes',
        ];
        let foundArray = null;
        for (const key of commonKeys) {
          if (Array.isArray(parsedJson[key])) {
            foundArray = parsedJson[key];
            break;
          }
        }
        if (!foundArray) {
          for (const key of Object.keys(parsedJson)) {
            if (Array.isArray(parsedJson[key])) {
              foundArray = parsedJson[key];
              break;
            }
          }
        }
        if (foundArray) {
          parsedJson = foundArray;
        }
      }

      // Normalize checklist items if keys differ (e.g. title/description -> step/detail)
      if (description.startsWith('buildChecklist') && Array.isArray(parsedJson)) {
        parsedJson = parsedJson.map((item, idx) => {
          if (typeof item === 'string') {
            return { step: `Step ${idx + 1}`, detail: item };
          }
          if (typeof item === 'object' && item !== null) {
            const step = item.step || item.title || item.name || item.action || item.stage || `Step ${idx + 1}`;
            const detail = item.detail || item.description || item.details || item.instructions || item.instruction || item.text || step;
            return { step: String(step), detail: String(detail) };
          }
          return item;
        });
      }

      // Validate with Zod
      const validationResult = zodSchema.safeParse(parsedJson);
      if (!validationResult.success) {
        const keys = typeof parsedJson === 'object' && parsedJson !== null ? Object.keys(parsedJson) : [];
        console.warn(`[Gemini AI] Validation failed. parsedJson keys: ${keys.join(', ')}`);
        throw new Error(
          `Zod validation failed for ${description}: ${validationResult.error.message}`
        );
      }

      return validationResult.data;
    } catch (err) {
      console.warn(`⚠️ [Gemini AI] Attempt ${attempts} failed for ${description}:`, err.message);
      lastError = err;

      if (attempts < maxAttempts) {
        // Backoff with extra delay on 429 (rate limit) or 503 (service unavailable)
        const isRateLimitOrUnavailable =
          err.status === 429 ||
          err.status === 503 ||
          err.message?.includes('429') ||
          err.message?.includes('503') ||
          err.message?.includes('high demand') ||
          err.message?.includes('RESOURCE_EXHAUSTED');

        const delay = isRateLimitOrUnavailable ? attempts * 2000 : 800;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  const error502 = new Error(
    'Our AI scheme evaluation service is currently experiencing high demand. Please try again in a few moments.'
  );
  error502.status = 502;
  error502.code = 'AI_SERVICE_UNAVAILABLE';
  error502.details = lastError?.message;
  throw error502;
}

// Indian States and Canonical Normalization
const INDIAN_STATES_NORMALIZED = {
  // Telugu
  'తెలంగాణ': 'Telangana',
  'ఆంధ్రప్రదేశ్': 'Andhra Pradesh',
  'ఆంధ్ర ప్రదేశ్': 'Andhra Pradesh',
  'కర్ణాటక': 'Karnataka',
  'తమిళనాడు': 'Tamil Nadu',
  'మహారాష్ట్ర': 'Maharashtra',
  'కేరళ': 'Kerala',
  'ఉత్తర ప్రదేశ్': 'Uttar Pradesh',
  'బీహార్': 'Bihar',
  'రాజస్థాన్': 'Rajasthan',
  'గుజరాత్': 'Gujarat',
  'పంజాబ్': 'Punjab',
  'ఒడిశా': 'Odisha',
  'పశ్చిమ బెంగాల్': 'West Bengal',
  // Hindi
  'तेलंगाना': 'Telangana',
  'आंध्र प्रदेश': 'Andhra Pradesh',
  'कर्नाटक': 'Karnataka',
  'तमिलनाडु': 'Tamil Nadu',
  'महाराष्ट्र': 'Maharashtra',
  'केरल': 'Kerala',
  'उत्तर प्रदेश': 'Uttar Pradesh',
  'बिहार': 'Bihar',
  'राजस्थान': 'Rajasthan',
  'मध्य प्रदेश': 'Madhya Pradesh',
  'गुजरात': 'Gujarat',
  'पश्चिम बंगाल': 'West Bengal',
  'ओडिशा': 'Odisha',
  'पंजाब': 'Punjab',
  'हरियाणा': 'Haryana',
};

const CANONICAL_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh'
];

export function normalizeProfileFields(profile) {
  if (!profile) return profile;

  // 1. State normalization
  if (profile.state) {
    const rawState = profile.state.trim();
    if (INDIAN_STATES_NORMALIZED[rawState]) {
      profile.state = INDIAN_STATES_NORMALIZED[rawState];
    } else {
      const match = CANONICAL_STATES.find(
        (s) => s.toLowerCase() === rawState.toLowerCase()
      );
      if (match) profile.state = match;
    }
  }

  // 2. District normalization
  if (profile.district) {
    const rawDist = profile.district.trim();
    const districtMap = {
      'వరంగల్': 'Warangal',
      'రంగారెడ్డి': 'Rangareddy',
      'కరీంనగర్': 'Karimnagar',
      'హైదరాబాద్': 'Hyderabad',
      'నల్గొండ': 'Nalgonda',
      'ఖమ్మం': 'Khammam',
      'वारंगल': 'Warangal',
      'हैदराबाद': 'Hyderabad',
      'पटना': 'Patna',
      'जयपुर': 'Jaipur',
      'लखनऊ': 'Lucknow',
    };
    if (districtMap[rawDist]) {
      profile.district = districtMap[rawDist];
    }
  }

  // 3. Occupation normalization
  if (profile.occupation) {
    const rawOcc = profile.occupation.trim().toLowerCase();
    if (rawOcc.includes('వ్యవసాయ') || rawOcc.includes('రైతు') || rawOcc.includes('किसान') || rawOcc.includes('खेती') || rawOcc.includes('farm')) {
      profile.occupation = 'farmer';
      profile.is_farmer = true;
    } else if (rawOcc.includes('విద్యార్థి') || rawOcc.includes('छात्र') || rawOcc.includes('student')) {
      profile.occupation = 'student';
      profile.is_student = true;
    } else if (rawOcc.includes('వ్యాపార') || rawOcc.includes('व्यापार') || rawOcc.includes('business') || rawOcc.includes('दुकान')) {
      profile.occupation = 'business_owner';
      profile.is_business_owner = true;
    } else if (rawOcc.includes('కూలీ') || rawOcc.includes('मजदूर') || rawOcc.includes('labor')) {
      profile.occupation = 'daily_wage_laborer';
    }
  }

  // 4. Gender normalization
  if (profile.gender) {
    const rawGender = profile.gender.trim().toLowerCase();
    if (rawGender.includes('female') || rawGender.includes('మహిళ') || rawGender.includes('స్త్రీ') || rawGender.includes('महिला') || rawGender.includes('स्त्री')) {
      profile.gender = 'female';
    } else if (rawGender.includes('male') || rawGender.includes('పురుష') || rawGender.includes('पुरुष')) {
      profile.gender = 'male';
    } else {
      profile.gender = 'other';
    }
  }

  return profile;
}

// 1. extractProfile - Real Gemini AI only (NO silent fallbacks)
export async function extractProfile(situationText, language = 'en') {
  const prompt = getProfileExtractionPrompt(situationText, language);

  const rawResult = await callGeminiWithRetry({
    prompt,
    zodSchema: ProfileExtractionSchema,
    description: 'extractProfile',
  });

  // Apply canonical English normalization
  const normalizedProfile = normalizeProfileFields(rawResult.profile);

  return {
    profile: normalizedProfile,
    summary: rawResult.summary,
    missing_info: rawResult.missing_info || [],
    ai_source: 'gemini',
  };
}

// 2. matchSchemes - Real Gemini AI only (NO silent fallbacks)
export async function matchSchemes(profile, catalog, language = 'en') {
  // Pass compact catalog representation to conserve tokens and enforce strict ID matching
  const compactCatalog = catalog.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    category: s.category,
    level: s.level,
    eligibility_summary: s.eligibility_summary,
    required_doc_keys: s.required_doc_keys,
  }));

  const prompt = getSchemeMatchingPrompt(profile, compactCatalog, language);

  const rawMatches = await callGeminiWithRetry({
    prompt,
    zodSchema: SchemeMatchOutputSchema,
    description: 'matchSchemes',
  });

  // Server-side validation: Gemini may ONLY return scheme IDs that exist in the catalog
  const catalogIdSet = new Set(catalog.map((s) => s.id));
  const validatedMatches = rawMatches.filter((m) => {
    if (!catalogIdSet.has(m.scheme_id)) {
      console.warn(`Dropped unrecognized scheme_id from AI response: ${m.scheme_id}`);
      return false;
    }
    return m.match_score >= 50;
  });

  // Sort descending by score, max 8
  validatedMatches.sort((a, b) => b.match_score - a.match_score);
  return validatedMatches.slice(0, 8);
}

// 3. buildChecklist - Real Gemini AI only (NO silent fallbacks)
export async function buildChecklist(profile, scheme, language = 'en') {
  const prompt = getChecklistPrompt(profile, scheme, language);

  const checklist = await callGeminiWithRetry({
    prompt,
    zodSchema: ChecklistOutputSchema,
    description: `buildChecklist(${scheme.slug})`,
  });

  return checklist.map((item) => ({ ...item, done: false }));
}

// Batch build checklists with concurrency cap (limit = 3)
export async function buildChecklistsForMatches(profile, matches, catalogMap, language = 'en') {
  return mapConcurrent(matches, 3, async (match) => {
    const scheme = catalogMap.get(match.scheme_id);
    if (!scheme) return { ...match, checklist: [] };

    try {
      const checklist = await buildChecklist(profile, scheme, language);
      return { ...match, checklist };
    } catch (err) {
      console.error(`Checklist generation error for scheme ${scheme.slug}:`, err.message);
      return {
        ...match,
        checklist: (scheme.application_steps || []).map((step, idx) => ({
          step: typeof step === 'string' ? step : step.step || `Step ${idx + 1}`,
          detail: typeof step === 'string' ? step : step.detail || 'Follow official scheme guidelines',
          done: false,
        })),
      };
    }
  });
}
