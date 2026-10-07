import { extractProfile, matchSchemes } from '../src/services/ai/gemini.service.js';
import { getDb, closeDb } from '../src/db/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runTeluguAssessment() {
  console.log('🌐 =======================================================');
  console.log('🌐 PolicyPal Telugu (తెలుగు) Live Scheme Assessment Test');
  console.log('🌐 =======================================================\n');

  const teluguInput = 'నా పేరు లక్ష్మి, వయస్సు 38 సంవత్సరాలు. నేను తెలంగాణలోని వరంగల్ జిల్లాలో 2 ఎకరాల భూమిలో వ్యవసాయం చేస్తున్నాను. మా కుటుంబంలో నలుగురు సభ్యులు ఉన్నారు. మా వార్షిక ఆదాయం ₹80,000.';

  console.log('📝 Citizen Input (తెలుగు):');
  console.log(`"${teluguInput}"\n`);

  console.log('🤖 Step 1: Extracting demographic profile & AI summary...');
  const extraction = await extractProfile(teluguInput, 'te');
  console.log('\n✅ Extracted Profile (JSON):');
  console.log(JSON.stringify(extraction.profile, null, 2));

  console.log('\n📋 AI Summary (తెలుగు):');
  console.log(extraction.summary);

  console.log('\n🏛️ Step 2: Fetching scheme catalog from database and matching...');
  const db = await getDb();
  const catalogRes = await db.query('SELECT id, slug, name, name_te, category, eligibility_summary FROM schemes');
  const catalog = catalogRes.rows;

  const matches = await matchSchemes(extraction.profile, catalog, 'te');
  console.log(`\n🎯 Matched ${matches.length} schemes.`);
  console.log('\n-----------------------------------------------------------');
  console.log('🥇 Top 2 Matched Schemes:');
  console.log('-----------------------------------------------------------');

  const topTwo = matches.slice(0, 2);
  topTwo.forEach((m, idx) => {
    const scheme = catalog.find((s) => s.id === m.scheme_id);
    console.log(`\n[${idx + 1}] ${scheme ? (scheme.name_te || scheme.name) : m.scheme_id}`);
    console.log(`    Slug:   ${scheme?.slug}`);
    console.log(`    Score:  ${m.match_score}/100`);
    console.log(`    Reason: ${m.eligibility_reason}`);
    if (m.assumptions_to_confirm?.length) {
      console.log(`    Please confirm (Assumptions): ${JSON.stringify(m.assumptions_to_confirm)}`);
    }
  });

  await closeDb();
  console.log('\n===========================================================');
  console.log('✨ Telugu Scheme Assessment completed successfully!');
  console.log('===========================================================');
}

runTeluguAssessment().catch((err) => {
  console.error('❌ Assessment test failed:', err);
  process.exit(1);
});
