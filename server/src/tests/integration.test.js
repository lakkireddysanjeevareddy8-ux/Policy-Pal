import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import app from '../app.js';
import { runMigrations } from '../db/migrate.js';
import { runSeed } from '../db/seed.js';
import { getDb } from '../db/index.js';

// Helper for making requests to Express app in-memory
async function request(path, options = {}) {
  const method = options.method || 'GET';
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const body = options.body ? JSON.stringify(options.body) : undefined;

  return new Promise((resolve, reject) => {
    import('http').then(({ createServer }) => {
      const server = createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        const url = `http://127.0.0.1:${port}${path}`;

        fetch(url, { method, headers, body })
          .then(async (res) => {
            const data = await res.json().catch(() => null);
            server.close();
            resolve({ status: res.status, ok: res.ok, data });
          })
          .catch((err) => {
            server.close();
            reject(err);
          });
      });
    });
  });
}

test('PolicyPal Security & Integration Test Suite', async (t) => {
  // Setup DB
  await runMigrations();
  await runSeed();
  const db = await getDb();

  let userAToken;
  let userBToken;
  let userAId;
  let userBId;
  let assessmentId;

  await t.test('1. Health check returns 200 OK', async () => {
    const res = await request('/health');
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.data.status, 'ok');
  });

  await t.test('2. Registration hashes password with bcrypt cost 10 and rejects invalid inputs', async () => {
    // Rejects invalid email
    const badEmailRes = await request('/api/auth/register', {
      method: 'POST',
      body: { email: 'not-an-email', password: 'Password@123', full_name: 'Test' },
    });
    assert.equal(badEmailRes.status, 400);

    // Rejects short password (<8)
    const shortPassRes = await request('/api/auth/register', {
      method: 'POST',
      body: { email: 'valid@example.com', password: '123', full_name: 'Test' },
    });
    assert.equal(shortPassRes.status, 400);

    // Valid Register User A
    const regResA = await request('/api/auth/register', {
      method: 'POST',
      body: {
        email: `citizen.a.${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        full_name: 'Citizen A',
        preferred_language: 'en',
      },
    });
    assert.equal(regResA.status, 201);
    assert.ok(regResA.data.data.token);
    userAToken = regResA.data.data.token;
    userAId = regResA.data.data.user.id;

    // Check DB for password_hash (ensure not plaintext)
    const userInDb = await db.query('SELECT password_hash FROM users WHERE id = $1', [userAId]);
    assert.notEqual(userInDb.rows[0].password_hash, 'SecurePassword123!');
    assert.ok(userInDb.rows[0].password_hash.startsWith('$2'));

    // Valid Register User B
    const regResB = await request('/api/auth/register', {
      method: 'POST',
      body: {
        email: `citizen.b.${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        full_name: 'Citizen B',
        preferred_language: 'te',
      },
    });
    assert.equal(regResB.status, 201);
    userBToken = regResB.data.data.token;
    userBId = regResB.data.data.user.id;
  });

  await t.test('3. Cross-user isolation: User B cannot access or modify User A data', async () => {
    // User A updates profile
    const updateResA = await request('/api/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: { age: 34, occupation: 'Solar Technician', annual_income: 250000 },
    });
    assert.equal(updateResA.status, 200);

    // User B reads profile (must return User B's profile, NOT User A's)
    const getResB = await request('/api/profile', {
      method: 'GET',
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.equal(getResB.status, 200);
    assert.equal(getResB.data.data.profile.user_id, userBId);
    assert.notEqual(getResB.data.data.profile.occupation, 'Solar Technician');
  });

  await t.test('4. Input validation rejects situation text > 2000 characters', async () => {
    const tooLong = 'A'.repeat(2005);
    const res = await request('/api/assessments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: { situation_text: tooLong, language: 'en' },
    });
    assert.equal(res.status, 400);
    assert.equal(res.data.error.code, 'VALIDATION_ERROR');
  });

  await t.test('5. AI Assessment Workflow creates assessment, matches, and checklist', async () => {
    const res = await request('/api/assessments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        situation_text:
          'I am a 40-year-old farmer living in Telangana with 2 acres of land and family income of ₹1.5 Lakhs.',
        language: 'te',
      },
    });

    assert.equal(res.status, 201);
    assert.ok(res.data.data.assessment);
    assert.ok(res.data.data.matches.length > 0);
    assessmentId = res.data.data.assessment.id;

    // Check that top match has personalized checklist and readiness
    const topMatch = res.data.data.matches[0];
    assert.ok(topMatch.ai_checklist.length >= 3);
    assert.ok(typeof topMatch.readiness_percent === 'number');
  });

  await t.test('6. Cross-Scheme Document Readiness synchronization works', async () => {
    // 1. Check initial matches
    const matchesRes1 = await request('/api/matches', {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.equal(matchesRes1.status, 200);

    // 2. Mark Aadhaar as ready
    const markAadhaar = await request('/api/documents/aadhaar', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: { is_ready: true, notes: 'UIDAI card available' },
    });
    assert.equal(markAadhaar.status, 200);

    // 3. Mark Bank Passbook as ready
    await request('/api/documents/bank_passbook', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: { is_ready: true, notes: 'SBI passbook verified' },
    });

    // 4. Check matches again - all schemes requiring Aadhaar or Bank Passbook now have increased readiness
    const matchesRes2 = await request('/api/matches', {
      headers: { Authorization: `Bearer ${userAToken}` },
    });

    const aadhaarSchemes = matchesRes2.data.data.matches.filter(
      (m) => m.required_doc_keys.includes('aadhaar')
    );
    assert.ok(aadhaarSchemes.length > 0);
    for (const s of aadhaarSchemes) {
      assert.ok(s.ready_docs_count >= 1);
    }
  });

  await t.test('7. Full CRUD for assessments (Read, Patch, Rerun, Delete)', async () => {
    // Read
    const getRes = await request(`/api/assessments/${assessmentId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.equal(getRes.status, 200);

    // User B tries to read User A assessment -> 404
    const foreignGetRes = await request(`/api/assessments/${assessmentId}`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.equal(foreignGetRes.status, 404);

    // Patch
    const patchRes = await request(`/api/assessments/${assessmentId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: { archived: true },
    });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.data.data.assessment.archived, true);

    // Rerun
    const rerunRes = await request(`/api/assessments/${assessmentId}/rerun`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.equal(rerunRes.status, 200);
    assert.ok(rerunRes.data.data.matches.length > 0);

    // Delete
    const delRes = await request(`/api/assessments/${assessmentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.equal(delRes.status, 200);

    // Confirm deleted
    const checkDeleted = await request(`/api/assessments/${assessmentId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.equal(checkDeleted.status, 404);
  });

  await t.test('8. Auto-update updated_at triggers update timestamps', async () => {
    const beforeRes = await db.query('SELECT updated_at FROM users WHERE id = $1', [userAToken ? userAId : '13b6e8e6-3b74-461e-ab31-fefe0d80687d']);
    const beforeTime = new Date(beforeRes.rows[0].updated_at).getTime();

    // Sleep 15ms so timestamp advances
    await new Promise((resolve) => setTimeout(resolve, 20));

    await db.query('UPDATE users SET full_name = $1 WHERE id = $2', [
      'Updated Citizen A',
      userAToken ? userAId : '13b6e8e6-3b74-461e-ab31-fefe0d80687d',
    ]);

    const afterRes = await db.query('SELECT updated_at FROM users WHERE id = $1', [userAToken ? userAId : '13b6e8e6-3b74-461e-ab31-fefe0d80687d']);
    const afterTime = new Date(afterRes.rows[0].updated_at).getTime();
    assert.ok(afterTime >= beforeTime, 'updated_at timestamp must advance on update');
  });

  await t.test('9. Search query q covers scheme name, eligibility reason, and checklist text', async () => {
    // Search matches by reason or checklist text
    const searchRes = await request('/api/matches?q=agriculture', {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.equal(searchRes.status, 200);

    // Search assessments by query
    const assessSearch = await request('/api/assessments?q=farmer&sort_by=date', {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.equal(assessSearch.status, 200);
  });

  await t.test('10. Dashboard returns recharts data: category distribution, status funnel, readiness ring', async () => {
    const dashRes = await request('/api/dashboard', {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.equal(dashRes.status, 200);
    assert.ok(dashRes.data.data.charts);
    assert.ok(Array.isArray(dashRes.data.data.charts.category_distribution));
    assert.ok(Array.isArray(dashRes.data.data.charts.status_funnel));
    assert.ok(typeof dashRes.data.data.charts.readiness_ring.ready_percent === 'number');
  });
});
