import bcrypt from 'bcryptjs';
import { getDb, closeDb } from './index.js';
import { runMigrations } from './migrate.js';
import { documentTypesData, schemesData, demoUserData } from './seedData.js';

export async function runSeed() {
  console.log('🌱 Starting database seed...');
  await runMigrations();

  const db = await getDb();

  // 1. Seed Document Types
  console.log(`📄 Seeding ${documentTypesData.length} document types...`);
  for (const doc of documentTypesData) {
    await db.query(
      `INSERT INTO document_types (key, label, label_te, label_hi, where_to_get, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (key) DO UPDATE SET
         label = EXCLUDED.label,
         label_te = EXCLUDED.label_te,
         label_hi = EXCLUDED.label_hi,
         where_to_get = EXCLUDED.where_to_get,
         updated_at = NOW()`,
      [doc.key, doc.label, doc.label_te, doc.label_hi, doc.where_to_get]
    );
  }

  // 2. Seed Schemes Catalog
  console.log(`🏛️ Seeding ${schemesData.length} schemes...`);
  for (const s of schemesData) {
    await db.query(
      `INSERT INTO schemes (
        slug, name, name_te, name_hi, ministry, level, state,
        category, benefit_summary, eligibility_summary,
        required_doc_keys, application_steps, official_url, last_verified, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         name_te = EXCLUDED.name_te,
         name_hi = EXCLUDED.name_hi,
         ministry = EXCLUDED.ministry,
         level = EXCLUDED.level,
         state = EXCLUDED.state,
         category = EXCLUDED.category,
         benefit_summary = EXCLUDED.benefit_summary,
         eligibility_summary = EXCLUDED.eligibility_summary,
         required_doc_keys = EXCLUDED.required_doc_keys,
         application_steps = EXCLUDED.application_steps,
         official_url = EXCLUDED.official_url,
         last_verified = EXCLUDED.last_verified,
         updated_at = NOW()`,
      [
        s.slug,
        s.name,
        s.name_te,
        s.name_hi,
        s.ministry,
        s.level,
        s.state,
        s.category,
        s.benefit_summary,
        s.eligibility_summary,
        s.required_doc_keys,
        JSON.stringify(s.application_steps),
        s.official_url,
        s.last_verified,
      ]
    );
  }

  // 3. Seed Demo User
  console.log('👤 Seeding demo user (demo@policypal.app)...');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(demoUserData.password, salt);

  const userRes = await db.query(
    `INSERT INTO users (email, password_hash, full_name, preferred_language, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       full_name = EXCLUDED.full_name,
       preferred_language = EXCLUDED.preferred_language,
       updated_at = NOW()
     RETURNING id, email`,
    [demoUserData.email, passwordHash, demoUserData.full_name, demoUserData.preferred_language]
  );
  const demoUserId = userRes.rows[0].id;

  // 4. Seed Demo User Profile
  const p = demoUserData.profile;
  await db.query(
    `INSERT INTO profiles (
      user_id, age, gender, state, district, occupation, annual_income,
      social_category, land_holding_acres, education_level,
      is_student, is_farmer, is_business_owner, family_size, notes, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       age = EXCLUDED.age,
       gender = EXCLUDED.gender,
       state = EXCLUDED.state,
       district = EXCLUDED.district,
       occupation = EXCLUDED.occupation,
       annual_income = EXCLUDED.annual_income,
       social_category = EXCLUDED.social_category,
       land_holding_acres = EXCLUDED.land_holding_acres,
       education_level = EXCLUDED.education_level,
       is_student = EXCLUDED.is_student,
       is_farmer = EXCLUDED.is_farmer,
       is_business_owner = EXCLUDED.is_business_owner,
       family_size = EXCLUDED.family_size,
       notes = EXCLUDED.notes,
       updated_at = NOW()`,
    [
      demoUserId,
      p.age,
      p.gender,
      p.state,
      p.district,
      p.occupation,
      p.annual_income,
      p.social_category,
      p.land_holding_acres,
      p.education_level,
      p.is_student,
      p.is_farmer,
      p.is_business_owner,
      p.family_size,
      p.notes,
    ]
  );

  // 5. Seed Demo User Documents
  console.log('📑 Seeding demo user document readiness...');
  for (const doc of demoUserData.documents) {
    await db.query(
      `INSERT INTO user_documents (user_id, doc_key, is_ready, notes, ready_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, doc_key) DO UPDATE SET
         is_ready = EXCLUDED.is_ready,
         notes = EXCLUDED.notes,
         ready_at = EXCLUDED.ready_at,
         updated_at = NOW()`,
      [demoUserId, doc.doc_key, doc.is_ready, doc.notes, doc.is_ready ? new Date() : null]
    );
  }

  // 6. Seed Sample Assessment & Matches for Demo User
  console.log('🔍 Seeding sample assessment and matches...');
  const existingAssessment = await db.query(
    'SELECT id FROM assessments WHERE user_id = $1 LIMIT 1',
    [demoUserId]
  );

  let assessmentId;
  if (existingAssessment.rows.length === 0) {
    const a = demoUserData.sampleAssessment;
    const aRes = await db.query(
      `INSERT INTO assessments (user_id, situation_text, language, extracted_profile, ai_summary)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        demoUserId,
        a.situation_text,
        a.language,
        JSON.stringify(a.extracted_profile),
        a.ai_summary,
      ]
    );
    assessmentId = aRes.rows[0].id;
  } else {
    assessmentId = existingAssessment.rows[0].id;
  }

  // Fetch schemes to attach to the sample assessment
  const targetSchemes = await db.query(
    `SELECT id, slug, name, required_doc_keys FROM schemes WHERE slug IN (
      'pm-kisan', 'rythu-bandhu', 'kisan-credit-card', 'aarogyasri', 'pm-fasal-bima-yojana'
    )`
  );

  const matchDetails = {
    'pm-kisan': {
      score: 95,
      reason: 'You own 2.5 acres of agricultural land and your family derives income from farming. You satisfy all landholding criteria for the ₹6,000 annual direct benefit transfer.',
      checklist: [
        { step: 'Check Land Record Registration', detail: 'Ensure your Pattadar passbook details match your Aadhaar name exactly.', done: true },
        { step: 'Aadhaar e-KYC Verification', detail: 'Complete OTP or biometric e-KYC on the PM-KISAN portal.', done: true },
        { step: 'Submit Bank Account for DBT', detail: 'Verify that your Aadhaar is linked to your State Bank of India account.', done: true },
        { step: 'Confirm with Local Village Revenue Officer', detail: 'Ensure your survey number is verified in the state revenue records.', done: false },
      ],
    },
    'rythu-bandhu': {
      score: 95,
      reason: 'As a resident farmer of Telangana with 2.5 acres of land registered on Dharani, you are directly eligible for ₹12,500/year (₹5,000/acre per season) investment support.',
      checklist: [
        { step: 'Verify Dharani Portal RoR', detail: 'Download and inspect your updated Record of Rights (1B) from Dharani.', done: true },
        { step: 'Submit Passbook Copy to AEO', detail: 'Hand over self-attested bank passbook and Pattadar book copies to the village Agricultural Extension Officer.', done: true },
        { step: 'Confirm DBT Credit during Kharif/Rabi', detail: 'Monitor direct credit SMS notification from the Treasury department.', done: false },
      ],
    },
    'kisan-credit-card': {
      score: 88,
      reason: 'You cultivate cotton and maize on 2.5 acres and maintain dairy cows. KCC gives you institutional crop and dairy credit at an effective 4% interest rate.',
      checklist: [
        { step: 'Fill 1-Page KCC Application Form', detail: 'Obtain KCC form from your local bank branch.', done: false },
        { step: 'Attach Dharani Passbook & Cropping Plan', detail: 'Attach copies of Pattadar passbook and declaration of cotton/maize crops.', done: false },
        { step: 'Submit Aadhaar and PAN Card Copies', detail: 'Provide identity proof for KYC completion.', done: false },
        { step: 'Receive RuPay KCC Debit Card', detail: 'Collect revolving card limit sanctioned by the branch manager.', done: false },
      ],
    },
    'aarogyasri': {
      score: 85,
      reason: 'Your annual income of ₹1.8 Lakhs falls well within the ₹5 Lakh threshold for Telangana families, qualifying you for up to ₹5,00,000 cashless medical care.',
      checklist: [
        { step: 'Check White Ration / Food Security Card', detail: 'Confirm all 4 family members are listed on your Food Security Card.', done: false },
        { step: 'Locate Nearest Network Hospital', detail: 'Identify empaneled public or private hospitals in Rangareddy district.', done: false },
        { step: 'Meet Aarogya Mithra at Helpdesk', detail: 'Present Aadhaar and Ration Card whenever medical treatment is needed.', done: false },
      ],
    },
    'pm-fasal-bima-yojana': {
      score: 82,
      reason: 'You cultivate notified seasonal crops (cotton and maize). PMFBY provides comprehensive insurance protection against drought, pests, and unseasonal rainfall.',
      checklist: [
        { step: 'Check Seasonal Enrollment Deadline', detail: 'Review Kharif cut-off date on pmfby.gov.in.', done: false },
        { step: 'Obtain Sowing Certificate from VRO', detail: 'Get sowing certificate confirming crops planted on your 2.5 acres.', done: false },
        { step: 'Pay Subsidized Premium at CSC/Bank', detail: 'Pay the nominal 2% premium before the cut-off date.', done: false },
      ],
    },
  };

  for (const s of targetSchemes.rows) {
    const details = matchDetails[s.slug] || {
      score: 75,
      reason: 'Eligible based on your occupation and family profile.',
      checklist: [{ step: 'Apply online', detail: 'Visit the official portal', done: false }],
    };

    await db.query(
      `INSERT INTO scheme_matches (
        assessment_id, user_id, scheme_id, match_score, eligibility_reason,
        missing_info, status, ai_checklist, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (assessment_id, scheme_id) DO UPDATE SET
         match_score = EXCLUDED.match_score,
         eligibility_reason = EXCLUDED.eligibility_reason,
         status = EXCLUDED.status,
         ai_checklist = EXCLUDED.ai_checklist,
         updated_at = NOW()`,
      [
        assessmentId,
        demoUserId,
        s.id,
        details.score,
        details.reason,
        JSON.stringify([]),
        s.slug === 'pm-kisan' ? 'applying' : 'saved',
        JSON.stringify(details.checklist),
      ]
    );
  }

  console.log('✅ Seed completed successfully!');
  console.log('🔑 Demo User: demo@policypal.app / Demo@12345');
}

// Allow direct CLI execution
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  runSeed()
    .then(async () => {
      await closeDb();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Seed failed:', err);
      await closeDb();
      process.exit(1);
    });
}
