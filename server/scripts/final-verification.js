import 'dotenv/config';
import http from 'http';
import { getDb, closeDb } from '../src/db/index.js';

const BASE_URL = 'http://127.0.0.1:5000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runFinalVerification() {
  console.log('================================================================');
  console.log('🚀 PolicyPal End-to-End System & Security Verification Suite');
  console.log('================================================================\n');

  const results = [];
  const runTag = `[run-${Date.now()}]`;

  function record(checkName, passed, detail) {
    results.push({ checkName, passed, detail });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} | ${checkName}: ${detail}`);
  }

  // 1. Health Endpoint
  const health = await request('/health');
  record(
    'GET /health',
    health.status === 200 && health.data?.data?.status === 'ok',
    `Status: ${health.status}, Service: "${health.data?.data?.service}", Uptime: ${Math.round(health.data?.data?.uptime)}s`
  );

  // 2. Demo User Authentication
  const demoLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { email: 'demo@policypal.app', password: 'Demo@12345' },
  });
  const userAToken = demoLogin.data?.data?.token;
  const userAId = demoLogin.data?.data?.user?.id;
  record(
    'Demo Login (demo@policypal.app)',
    demoLogin.status === 200 && Boolean(userAToken),
    `Status: ${demoLogin.status}, User: "${demoLogin.data?.data?.user?.full_name}", ID: ${userAId}`
  );

  // 3. User A Profile Preload
  const profileRes = await request('/api/profile', {
    headers: { Authorization: `Bearer ${userAToken}` },
  });
  const prof = profileRes.data?.data?.profile;
  record(
    'Profile Fetch',
    profileRes.status === 200 && Boolean(prof?.is_farmer) && prof?.state === 'Telangana',
    `State: ${prof?.state}, Land: ${prof?.land_holding_acres} acres, Occupation: "${prof?.occupation}", is_farmer: ${prof?.is_farmer}`
  );

  // 4. Create New AI Assessment (English with unique run tag)
  const situationText = `I am a 48-year-old small farmer in Telangana with 2 acres land, cultivating cotton and maize ${runTag}`;
  const assess1 = await request('/api/assessments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userAToken}` },
    body: { situation_text: situationText, language: 'en' },
  });
  const assessId = assess1.data?.data?.assessment?.id;
  const matchCount = assess1.data?.data?.matches?.length || 0;
  record(
    'AI Assessment Creation',
    (assess1.status === 201 || assess1.status === 200) && Boolean(assessId),
    `Status: ${assess1.status}, Assessment ID: ${assessId}, Matched Schemes: ${matchCount}, Cached: ${assess1.data?.cached}`
  );

  // 5. 24-Hour AI Caching Check (Identical Submission within same run)
  const assessCached = await request('/api/assessments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${userAToken}` },
    body: { situation_text: situationText, language: 'en' },
  });
  record(
    '24-Hour AI Caching',
    assessCached.status === 200 && assessCached.data?.cached === true && assessCached.data?.data?.assessment?.id === assessId,
    `Status: ${assessCached.status}, Cached Flag: ${assessCached.data?.cached}, Reused Assessment ID: ${assessCached.data?.data?.assessment?.id}`
  );

  // 6. User B Registration & Multi-Tenant Isolation
  const userBEmail = `citizen_b_${Date.now()}@example.com`;
  const regB = await request('/api/auth/register', {
    method: 'POST',
    body: { email: userBEmail, password: 'SecurePassword@123', full_name: 'Citizen B' },
  });
  const userBToken = regB.data?.data?.token;
  const userBId = regB.data?.data?.user?.id;
  record(
    'User B Registration',
    regB.status === 201 && Boolean(userBToken),
    `Status: ${regB.status}, Registered: ${userBEmail}`
  );

  // 7. Cross-User Data Isolation (User B attempts to read User A assessment)
  const crossAccess = await request(`/api/assessments/${assessId}`, {
    headers: { Authorization: `Bearer ${userBToken}` },
  });
  record(
    'Cross-User Access Isolation',
    crossAccess.status === 404,
    `Status: ${crossAccess.status} (Isolated by user_id scoping, direct IDOR prevented)`
  );

  // 8. Shared Document Readiness Cross-Scheme Sync
  // Toggle land_records to ready
  const toggleDoc = await request('/api/documents/land_records', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${userAToken}` },
    body: { is_ready: true },
  });
  record(
    'Document Readiness Toggle',
    toggleDoc.status === 200 && toggleDoc.data?.data?.document?.is_ready === true,
    `Status: ${toggleDoc.status}, land_records is_ready: ${toggleDoc.data?.data?.document?.is_ready}`
  );

  // Check that PM-KISAN and Rythu Bandhu both reflect the updated document
  const matchesRes = await request('/api/matches', {
    headers: { Authorization: `Bearer ${userAToken}` },
  });
  const pmKisan = matchesRes.data?.data?.matches?.find((m) => m.scheme_slug === 'pm-kisan');
  const rythu = matchesRes.data?.data?.matches?.find((m) => m.scheme_slug === 'rythu-bandhu');
  const isSyncWorking = pmKisan && rythu && pmKisan.ready_docs_count > 0 && rythu.ready_docs_count > 0;
  record(
    'Cross-Scheme Document Readiness Sync',
    Boolean(isSyncWorking),
    `PM-KISAN: ${pmKisan?.readiness_percent}% (${pmKisan?.ready_docs_count}/${pmKisan?.total_docs_count} docs), Rythu Bandhu: ${rythu?.readiness_percent}% (${rythu?.ready_docs_count}/${rythu?.total_docs_count} docs)`
  );

  // 9. Recharts Dashboard Data Payload
  const dashRes = await request('/api/dashboard', {
    headers: { Authorization: `Bearer ${userAToken}` },
  });
  const charts = dashRes.data?.data?.charts;
  const chartsValid = charts && Array.isArray(charts.category_distribution) && Array.isArray(charts.status_funnel) && typeof charts.readiness_ring?.ready_percent === 'number';
  record(
    'Dashboard Charts Payload (Recharts)',
    Boolean(chartsValid),
    `Categories: ${charts?.category_distribution?.length}, Funnel Stages: ${charts?.status_funnel?.map((f) => `${f.status}:${f.count}`).join(', ')}, Overall Readiness: ${charts?.readiness_ring?.ready_percent}%`
  );

  // 10. Multi-Field Search (GET /matches?q=)
  const searchRes = await request('/api/matches?q=farmer', {
    headers: { Authorization: `Bearer ${userAToken}` },
  });
  record(
    'Deep Match Search (q=farmer)',
    searchRes.status === 200 && searchRes.data?.data?.matches?.length > 0,
    `Status: ${searchRes.status}, Found: ${searchRes.data?.data?.matches?.length} schemes matching query in eligibility reasons / checklist`
  );

  // 11. Self-Cleaning: Delete created test assessment, revert doc state, and clean temporary user B
  console.log('\n🧹 Running automated test self-cleaning...');
  let cleanSuccess = true;

  if (assessId) {
    const delAssess = await request(`/api/assessments/${assessId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    if (delAssess.status !== 200) {
      console.warn('⚠️ Assessment deletion returned status:', delAssess.status);
      cleanSuccess = false;
    }
  }

  // Revert land_records back to unready
  await request('/api/documents/land_records', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${userAToken}` },
    body: { is_ready: false },
  });

  // Clean user B via authenticated API
  if (userBToken) {
    const delUserB = await request('/api/auth/me', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    if (delUserB.status !== 200) {
      console.warn('⚠️ User B account deletion returned status:', delUserB.status);
      cleanSuccess = false;
    }
  }

  record(
    'Verification Self-Cleaning',
    cleanSuccess,
    `Test assessment ${assessId} deleted, document readiness state reverted, temporary User B purged`
  );

  console.log('\n================================================================');
  console.log(`📊 Final Verification Summary: ${results.filter((r) => r.passed).length}/${results.length} Checks Passed`);
  console.log('================================================================\n');

  if (results.some((r) => !r.passed)) {
    process.exit(1);
  }
}

runFinalVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
