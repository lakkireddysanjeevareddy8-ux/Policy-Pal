import 'dotenv/config';
import { extractProfile, matchSchemes } from '../src/services/ai/gemini.service.js';
import { getDb, closeDb } from '../src/db/index.js';

const testCases = [
  {
    lang: 'en',
    label: 'English (Ramesh - Small Farmer in Karnataka)',
    text: 'My name is Ramesh, 42 years old male from Mandya, Karnataka. I own 1.5 acres of agricultural land and cultivate sugarcane. Annual income is 75000 rupees. My family has 3 members.',
  },
  {
    lang: 'hi',
    label: 'Hindi (सुनीता - महिला उद्यमी उत्तर प्रदेश)',
    text: 'मेरा नाम सुनीता देवी है, उम्र 35 वर्ष। मैं लखनऊ, उत्तर प्रदेश में रहती हूँ। मैं घर से सिलाई का काम करती हूँ और अपना छोटा व्यवसाय शुरू करना चाहती हूँ। मेरी पारिवारिक वार्षिक आय ₹95,000 है।',
  },
];

async function runMultilingualTests() {
  console.log('🌐 =======================================================');
  console.log('🌐 PolicyPal Multilingual Live AI Assessments (EN & HI)');
  console.log('🌐 =======================================================\n');

  const db = await getDb();
  const catalogRes = await db.query(
    'SELECT id, slug, name, name_hi, name_te, category, eligibility_summary FROM schemes'
  );
  const catalog = catalogRes.rows;

  for (const tc of testCases) {
    console.log(`\n===========================================================`);
    console.log(`🌍 Testing Language: ${tc.label}`);
    console.log(`===========================================================`);
    console.log(`📝 Citizen Input: "${tc.text}"\n`);

    console.log(`🤖 Step 1: Extracting demographic profile & AI summary...`);
    const extraction = await extractProfile(tc.text, tc.lang);

    console.log('\n✅ Canonical Extracted Profile:');
    console.log(JSON.stringify(extraction.profile, null, 2));

    console.log(`\n📋 AI Summary (${tc.lang.toUpperCase()}):`);
    console.log(extraction.summary);

    console.log(`\n🏛️ Step 2: Matching schemes against catalog...`);
    const matches = await matchSchemes(extraction.profile, catalog, tc.lang);

    console.log(`\n🎯 Matched ${matches.length} schemes.`);
    console.log('-----------------------------------------------------------');
    console.log('🥇 Top 2 Matched Schemes:');
    console.log('-----------------------------------------------------------');

    const topTwo = matches.slice(0, 2);
    topTwo.forEach((m, idx) => {
      const scheme = catalog.find((s) => s.id === m.scheme_id);
      const name =
        tc.lang === 'hi' && scheme?.name_hi
          ? scheme.name_hi
          : tc.lang === 'te' && scheme?.name_te
          ? scheme.name_te
          : scheme?.name || m.scheme_id;

      console.log(`\n[${idx + 1}] ${name}`);
      console.log(`    Slug:   ${scheme?.slug}`);
      console.log(`    Score:  ${m.match_score}/100`);
      console.log(`    Reason: ${m.eligibility_reason}`);
      if (m.assumptions_to_confirm?.length) {
        console.log(`    Please confirm (Assumptions): ${JSON.stringify(m.assumptions_to_confirm)}`);
      }
    });
  }

  await closeDb();
  console.log('\n===========================================================');
  console.log('✨ All Multilingual Assessments Completed Successfully!');
  console.log('===========================================================');
}

runMultilingualTests().catch((err) => {
  console.error('❌ Multilingual assessment test failed:', err);
  process.exit(1);
});
