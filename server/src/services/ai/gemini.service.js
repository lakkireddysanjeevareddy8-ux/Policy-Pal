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

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

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
    throw new Error('NO_API_KEY');
  }

  let attempts = 0;
  let lastError = null;

  while (attempts < 2) {
    attempts++;
    try {
      const generatePromise = ai.models.generateContent({
        model: GEMINI_MODEL,
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

      // Validate with Zod
      const validationResult = zodSchema.safeParse(parsedJson);
      if (!validationResult.success) {
        throw new Error(
          `Zod validation failed for ${description}: ${validationResult.error.message}`
        );
      }

      return validationResult.data;
    } catch (err) {
      console.warn(`⚠️ [Gemini AI] Attempt ${attempts} failed for ${description}:`, err.message);
      lastError = err;

      if (attempts < 2) {
        // Backoff with extra delay on 429 (rate limit) or 503 (service unavailable)
        const isRateLimitOrUnavailable =
          err.status === 429 ||
          err.status === 503 ||
          err.message?.includes('429') ||
          err.message?.includes('503') ||
          err.message?.includes('RESOURCE_EXHAUSTED');

        const delay = isRateLimitOrUnavailable ? attempts * 2500 : 1000;
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

// 1. extractProfile
export async function extractProfile(situationText, language = 'en') {
  const prompt = getProfileExtractionPrompt(situationText, language);

  try {
    return await callGeminiWithRetry({
      prompt,
      zodSchema: ProfileExtractionSchema,
      description: 'extractProfile',
    });
  } catch (err) {
    if (err.message === 'NO_API_KEY') {
      console.log('ℹ️ GEMINI_API_KEY not configured. Using rule-based extraction fallback...');
      return fallbackExtractProfile(situationText, language);
    }
    throw err;
  }
}

// 2. matchSchemes
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

  let rawMatches;
  try {
    rawMatches = await callGeminiWithRetry({
      prompt,
      zodSchema: SchemeMatchOutputSchema,
      description: 'matchSchemes',
    });
  } catch (err) {
    if (err.message === 'NO_API_KEY') {
      console.log('ℹ️ GEMINI_API_KEY not configured. Using rule-based matching fallback...');
      rawMatches = fallbackMatchSchemes(profile, catalog, language);
    } else {
      throw err;
    }
  }

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

// 3. buildChecklist
export async function buildChecklist(profile, scheme, language = 'en') {
  const prompt = getChecklistPrompt(profile, scheme, language);

  try {
    const checklist = await callGeminiWithRetry({
      prompt,
      zodSchema: ChecklistOutputSchema,
      description: `buildChecklist(${scheme.slug})`,
    });
    return checklist.map((item) => ({ ...item, done: false }));
  } catch (err) {
    if (err.message === 'NO_API_KEY') {
      return fallbackBuildChecklist(profile, scheme, language);
    }
    throw err;
  }
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
      console.error(`Error generating checklist for ${scheme.slug}:`, err.message);
      // Fallback to official scheme application steps if AI fails
      const fallbackList = (scheme.application_steps || []).map((s) => ({
        step: s.title,
        detail: s.detail,
        done: false,
      }));
      return { ...match, checklist: fallbackList };
    }
  });
}

// -------------------------------------------------------------
// Deterministic rule-based fallbacks for offline dev & test suites
// -------------------------------------------------------------
function fallbackExtractProfile(text, language) {
  const lower = text.toLowerCase();

  const isFarmer =
    lower.includes('farmer') ||
    lower.includes('agriculture') ||
    lower.includes('crop') ||
    lower.includes('land') ||
    lower.includes('రైతు') ||
    lower.includes('किसान');

  const isStudent =
    lower.includes('student') ||
    lower.includes('college') ||
    lower.includes('school') ||
    lower.includes('scholarship') ||
    lower.includes('విద్యార్థి') ||
    lower.includes('छात्र');

  const isBusinessOwner =
    lower.includes('business') ||
    lower.includes('shop') ||
    lower.includes('vendor') ||
    lower.includes('enterprise') ||
    lower.includes('వ్యాపారం') ||
    lower.includes('दुकान');

  // Age extraction heuristic
  const ageMatch = text.match(/(\d{1,2})\s*(?:years old|year old|yo|years|వయస్సు|साल)/i);
  const age = ageMatch ? parseInt(ageMatch[1], 10) : null;

  // Land acres extraction heuristic
  const landMatch = text.match(/([\d.]+)\s*(?:acres?|ఎకరాలు|एकड़)/i);
  const landHolding = landMatch ? parseFloat(landMatch[1]) : (isFarmer ? 2.5 : null);

  // Income heuristic
  let annualIncome = null;
  const incomeMatch = text.match(/(?:₹|rs\.?|inr)?\s*([\d.]+)\s*(?:lakhs?|lakh|లక్షలు|लाख)/i);
  if (incomeMatch) {
    annualIncome = Math.round(parseFloat(incomeMatch[1]) * 100000);
  } else if (lower.includes('poor') || lower.includes('bpl') || lower.includes('పేద')) {
    annualIncome = 120000;
  }

  // State detection
  let state = null;
  if (lower.includes('telangana') || lower.includes('తెలంగాణ')) state = 'Telangana';
  else if (lower.includes('andhra') || lower.includes('ఆంధ్ర')) state = 'Andhra Pradesh';
  else if (lower.includes('karnataka')) state = 'Karnataka';
  else if (lower.includes('maharashtra')) state = 'Maharashtra';

  // Category detection
  let socialCategory = null;
  if (lower.includes('sc') || lower.includes('scheduled caste')) socialCategory = 'SC';
  else if (lower.includes('st') || lower.includes('scheduled tribe')) socialCategory = 'ST';
  else if (lower.includes('obc') || lower.includes('backward')) socialCategory = 'OBC';
  else if (lower.includes('ews')) socialCategory = 'EWS';

  const gender = lower.includes('woman') || lower.includes('female') || lower.includes('ఆమె') || lower.includes('महिला')
    ? 'female'
    : lower.includes('man') || lower.includes('male') || lower.includes('అతను') || lower.includes('पुरुष')
    ? 'male'
    : null;

  const summaries = {
    en: `Identified profile as a citizen interested in welfare opportunities with an estimated income of ${annualIncome ? '₹' + annualIncome.toLocaleString('en-IN') : 'low-to-middle income'}. Based on your background, we have matched relevant government assistance and credit schemes.`,
    te: `మీ పరిస్థితి వివరాల ఆధారంగా ఆదాయం మరియు వృత్తి వర్గాన్ని గుర్తించాము. మీ ప్రొఫైల్‌కు అనువైన ప్రభుత్వ పథకాలు మరియు ఆర్థిక సహాయ కార్యక్రమాలు జతచేయబడ్డాయి.`,
    hi: `आपकी स्थिति के आधार पर आय और व्यवसाय की जानकारी का विश्लेषण किया गया है। आपकी पात्रता के अनुसार सरकारी योजनाओं और सहायता कार्यक्रमों का मिलान किया गया है।`,
  };

  const missingQuestions = {
    en: [
      'Do you possess an active BPL or White Food Security Ration Card?',
      'Is your bank account seeded with your Aadhaar for Direct Benefit Transfer (DBT)?',
      'Do you have documented proof of land records or tenancy agreement?',
    ],
    te: [
      'మీ వద్ద తెల్ల రేషన్ కార్డు (ఆహార భద్రత కార్డు) ఉందా?',
      'మీ బ్యాంక్ ఖాతాకు ఆధార్ లింక్ (DBT) అయ్యిందా?',
      'మీ భూమి లేదా వ్యాపార ధ్రువీకరణ పత్రాలు అందుబాటులో ఉన్నాయా?',
    ],
    hi: [
      'क्या आपके पास बीपीएल या राशन कार्ड उपलब्ध है?',
      'क्या आपका बैंक खाता आधार से डीबीटी हेतु लिंक है?',
      'क्या आपके पास भूमि या व्यवसाय का वैध प्रमाण पत्र है?',
    ],
  };

  return {
    profile: {
      age,
      gender,
      state,
      district: null,
      occupation: isFarmer ? 'Farmer' : isBusinessOwner ? 'Small Business Owner' : isStudent ? 'Student' : 'General Citizen',
      annual_income: annualIncome,
      social_category: socialCategory,
      land_holding_acres: landHolding,
      education_level: isStudent ? 'Higher Secondary' : null,
      is_student: isStudent,
      is_farmer: isFarmer,
      is_business_owner: isBusinessOwner,
      family_size: 4,
    },
    summary: summaries[language] || summaries.en,
    missing_info: missingQuestions[language] || missingQuestions.en,
  };
}

function fallbackMatchSchemes(profile, catalog, language) {
  const matches = [];

  for (const s of catalog) {
    let score = 50;
    let reason = '';

    if (profile.is_farmer && s.category === 'agriculture') {
      score = 90;
      reason = language === 'te'
        ? 'మీరు వ్యవసాయదారుడిగా ఉన్నందున ఈ పథకానికి అర్హులు.'
        : language === 'hi'
        ? 'आप एक किसान हैं, इसलिए इस कृषि योजना के पात्र हैं।'
        : 'You are engaged in agriculture, making you directly eligible for farmer welfare assistance.';
    } else if (profile.is_farmer && s.slug === 'kisan-credit-card') {
      score = 88;
      reason = language === 'te'
        ? 'రైతులకు సబ్సిడీ వడ్డీ రేటుతో రుణ సహాయం లభిస్తుంది.'
        : language === 'hi'
        ? 'किसानों को रियायती ब्याज दर पर कृषि ऋण मिलता है।'
        : 'Concessional agricultural credit is available for landholding farmers.';
    } else if (profile.annual_income && profile.annual_income <= 500000 && s.category === 'health') {
      score = 85;
      reason = language === 'te'
        ? 'మీ కుటుంబ వార్షిక ఆదాయం పరిమితి లోపు ఉన్నందున ఉచిత వైద్య చికిత్స లభిస్తుంది.'
        : language === 'hi'
        ? 'आपकी पारिवारिक आय सीमा के अंतर्गत होने के कारण आपको कैशलेस इलाज की सुविधा मिलेगी।'
        : 'Your annual family income falls within the threshold for cashless health coverage.';
    } else if (profile.is_student && s.category === 'education') {
      score = 92;
      reason = language === 'te'
        ? 'విద్యార్థుల ఉన్నత చదువుల కొరకు స్కాలర్‌షిప్ లభిస్తుంది.'
        : language === 'hi'
        ? 'उच्च शिक्षा प्राप्त कर रहे विद्यार्थियों के लिए छात्रवृत्ति सहायता उपलब्ध है।'
        : 'Eligible for post-matric tuition fee support and maintenance allowance.';
    } else if (profile.is_business_owner && s.category === 'employment') {
      score = 86;
      reason = language === 'te'
        ? 'సూక్ష్మ వ్యాపారులు మరియు చేతివృత్తుల వారికి ఆర్థిక సహాయం అందుతుంది.'
        : language === 'hi'
        ? 'सूक्ष्म उद्यमियों और कारीगरों के लिए रियायती वित्तीय सहायता उपलब्ध है।'
        : 'Collateral-free working capital loan and credit guarantee for small business owners.';
    } else if (s.category === 'social_security') {
      score = 75;
      reason = language === 'te'
        ? 'తక్కువ ప్రీమియంతో సామాజిక భద్రత మరియు జీవిత బీమా రక్షణ లభిస్తుంది.'
        : language === 'hi'
        ? 'किफायती प्रीमियम पर सामाजिक सुरक्षा और जीवन बीमा का लाभ उपलब्ध है।'
        : 'Affordable universal social security and pension protection available to all eligible adults.';
    }

    if (score >= 50) {
      matches.push({
        scheme_id: s.id,
        match_score: score,
        eligibility_reason: reason || 'Matches demographic and citizen welfare criteria.',
        caution: null,
      });
    }
  }

  matches.sort((a, b) => b.match_score - a.match_score);
  return matches.slice(0, 8);
}

function fallbackBuildChecklist(profile, scheme, language) {
  if (scheme.application_steps && scheme.application_steps.length > 0) {
    return scheme.application_steps.map((st) => ({
      step: st.title,
      detail: st.detail,
      done: false,
    }));
  }

  const defaultSteps = {
    en: [
      { step: 'Gather Required Documents', detail: 'Collect Aadhaar card, bank passbook, and proof of address.' },
      { step: 'Check Official Portal', detail: `Visit ${scheme.official_url} to verify the application guidelines.` },
      { step: 'Submit Application Form', detail: 'Fill the official form online or at the local designated service office.' },
      { step: 'Track Sanction & Payment', detail: 'Note down reference number and monitor status updates via SMS.' },
    ],
    te: [
      { step: 'కావలసిన పత్రాలు సేకరించండి', detail: 'ఆధార్ కార్డు, బ్యాంక్ పాస్‌బుక్ మరియు నివాస ధ్రువీకరణ పత్రాలు సిద్ధం చేయండి.' },
      { step: 'అధికారిక పోర్టల్ తనిఖీ చేయండి', detail: `${scheme.official_url} సందర్శించి తాజా మార్గదర్శకాలను తెలుసుకోండి.` },
      { step: 'దరఖాస్తు సమర్పించండి', detail: 'ఆన్‌లైన్ లేదా మీసేవా కేంద్రంలో వివరాలు నమోదు చేయండి.' },
      { step: 'స్థితిని ట్రాక్ చేయండి', detail: 'దరఖాస్తు రసీదు సంఖ్యను భద్రపరుచుకుని స్థితిని గమనించండి.' },
    ],
    hi: [
      { step: 'आवश्यक दस्तावेज एकत्र करें', detail: 'आधार कार्ड, बैंक पासबुक और निवास प्रमाण पत्र तैयार रखें।' },
      { step: 'आधिकारिक पोर्टल देखें', detail: `${scheme.official_url} पर जाकर आवेदन प्रक्रिया की जानकारी लें।` },
      { step: 'आवेदन पत्र जमा करें', detail: 'ऑनलाइन पोर्टल या जन सेवा केंद्र (सीएससी) पर फॉर्म भरें।' },
      { step: 'आवेदन की स्थिति ट्रैक करें', detail: 'पंजीकरण संख्या सुरक्षित रखें और स्टेटस चेक करते रहें।' },
    ],
  };

  const steps = defaultSteps[language] || defaultSteps.en;
  return steps.map((s) => ({ ...s, done: false }));
}
