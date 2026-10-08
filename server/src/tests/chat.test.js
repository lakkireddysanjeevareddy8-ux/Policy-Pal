import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../app.js';
import { runMigrations } from '../db/migrate.js';
import { runSeed } from '../db/seed.js';
import { query } from '../db/index.js';
import {
  SendMessageRequestSchema,
  UpdateConversationSchema,
  GeminiChatOutputSchema,
} from '../schemas/chat.schema.js';
import { redactSensitiveInfo, redact } from '../utils/redact.js';
import { buildChatContext } from '../services/ai/chat.service.js';

// HTTP test helper
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
            resolve({ status: res.status, ok: res.ok, data, headers: res.headers });
          })
          .catch((err) => {
            server.close();
            reject(err);
          });
      });
    });
  });
}

test('PolicyPal Chatbot & Security Test Suite', async (t) => {
  await runMigrations();
  await runSeed();

  let userAToken;
  let userBToken;
  let userAId;
  let userBId;
  let userAConvId;

  // Setup: Register User A and User B
  await t.test('Setup: Create User A and User B', async () => {
    const emailA = `chattest_a_${Date.now()}@example.com`;
    const regA = await request('/api/auth/register', {
      method: 'POST',
      body: { email: emailA, password: 'Password@123', full_name: 'Chat User A' },
    });
    assert.equal(regA.status, 201);
    userAToken = regA.data.data.token;
    userAId = regA.data.data.user.id;

    const emailB = `chattest_b_${Date.now()}@example.com`;
    const regB = await request('/api/auth/register', {
      method: 'POST',
      body: { email: emailB, password: 'Password@123', full_name: 'Chat User B' },
    });
    assert.equal(regB.status, 201);
    userBToken = regB.data.data.token;
    userBId = regB.data.data.user.id;
  });

  // 1. Zod Schema Validation
  await t.test('1. Zod Schemas enforce message bounds, language enum, and payload constraints', () => {
    // Valid message
    const valid = SendMessageRequestSchema.safeParse({
      message: 'Hello, which schemes can I apply for?',
      ui_language: 'te',
      input_mode: 'voice',
    });
    assert.equal(valid.success, true);
    assert.equal(valid.data.ui_language, 'te');
    assert.equal(valid.data.input_mode, 'voice');

    // Rejects empty message
    const empty = SendMessageRequestSchema.safeParse({ message: '   ' });
    assert.equal(empty.success, false);

    // Rejects message exceeding 1000 characters
    const tooLong = SendMessageRequestSchema.safeParse({ message: 'a'.repeat(1001) });
    assert.equal(tooLong.success, false);

    // Rejects unsupported language
    const badLang = SendMessageRequestSchema.safeParse({
      message: 'Hello',
      ui_language: 'fr',
    });
    assert.equal(badLang.success, false);

    // Validates GeminiChatOutputSchema
    const aiOutput = GeminiChatOutputSchema.safeParse({
      reply: 'You are eligible for PM-KISAN.',
      language: 'en',
      followups: ['How do I apply?', 'What documents do I need?'],
      actions: [{ type: 'open_scheme', slug: 'pm-kisan', label: 'View Scheme' }],
    });
    assert.equal(aiOutput.success, true);

    // Enforces max 3 followups
    const tooManyFollowups = GeminiChatOutputSchema.safeParse({
      reply: 'Hi',
      language: 'en',
      followups: ['1', '2', '3', '4'],
      actions: [],
    });
    assert.equal(tooManyFollowups.success, false);
  });

  // 2. Redaction Unit Verification
  await t.test('2. Redaction correctly replaces Aadhaar, PAN, OTP, and bank accounts', () => {
    const sample = 'My Aadhaar is 1234 5678 9012, PAN is ABCDE1234F, otp is 884920, and account 987654321098.';
    const res = redactSensitiveInfo(sample);
    assert.equal(res.redacted, true);
    assert.ok(!res.text.includes('1234 5678 9012'));
    assert.ok(!res.text.includes('ABCDE1234F'));
    assert.ok(!res.text.includes('884920'));
    assert.ok(!res.text.includes('987654321098'));
    assert.ok(res.text.includes('[REDACTED]'));
  });

  // 3. Auth required
  await t.test('3. Chat endpoints reject unauthenticated access with 401', async () => {
    const noAuthGet = await request('/api/chat/conversations');
    assert.equal(noAuthGet.status, 401);

    const noAuthPost = await request('/api/chat', {
      method: 'POST',
      body: { message: 'Hello' },
    });
    assert.equal(noAuthPost.status, 401);
  });

  // 4. Message length limit (HTTP validation)
  await t.test('4. POST /api/chat rejects messages exceeding 1000 characters with 400', async () => {
    const longMsgRes = await request('/api/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: { message: 'A'.repeat(1001) },
    });
    assert.equal(longMsgRes.status, 400);
    assert.equal(longMsgRes.data.success, false);
    assert.equal(longMsgRes.data.error.code, 'VALIDATION_ERROR');
  });

  // 5. Database setup of conversation for cross-user tests
  await t.test('5. User A creates a conversation in the database', async () => {
    const convRes = await query(
      `INSERT INTO chat_conversations (user_id, title, language)
       VALUES ($1, 'Farmer Assistance Inquiry', 'en')
       RETURNING id`,
      [userAId]
    );
    userAConvId = convRes.rows[0].id;

    // Add 10 dummy messages to test 8-message history truncation
    for (let i = 1; i <= 10; i++) {
      await query(
        `INSERT INTO chat_messages (conversation_id, user_id, role, content, detected_language, created_at)
         VALUES ($1, $2, $3, $4, 'en', NOW() - (($5 || ' seconds')::interval))`,
        [userAConvId, userAId, i % 2 === 1 ? 'user' : 'assistant', `Message ${i}`, 100 - (i * 5)]
      );
    }

    assert.ok(userAConvId);
  });

  // 6. History truncation (max 8 messages)
  await t.test('6. buildChatContext limits history to strictly the last 8 messages', async () => {
    const context = await buildChatContext(userAId, userAConvId);
    assert.equal(context.recentMessages.length, 8);
    // Chronologically oldest of the 8 should be "Message 3", newest "Message 10"
    assert.equal(context.recentMessages[0].content, 'Message 3');
    assert.equal(context.recentMessages[7].content, 'Message 10');
  });

  // 7. Catalog slug validation
  await t.test('7. buildChatContext loads valid catalog slugs', async () => {
    const context = await buildChatContext(userAId, userAConvId);
    assert.ok(context.validSlugs.has('pm-kisan'));
    assert.ok(context.validSlugs.has('ayushman-bharat-pmjay'));
    assert.ok(!context.validSlugs.has('invented-fake-scheme-slug'));
  });

  // 8. Cross-User Isolation: User B cannot access User A's conversation
  await t.test("8. Cross-user isolation: User B receives 404 for User A's conversation", async () => {
    // User B attempts to read User A's conversation
    const readRes = await request(`/api/chat/conversations/${userAConvId}`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.equal(readRes.status, 404);
    assert.equal(readRes.data.error.code, 'NOT_FOUND');

    // User B attempts to post message to User A's conversation
    const postRes = await request('/api/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userBToken}` },
      body: { conversation_id: userAConvId, message: 'Malicious injection' },
    });
    assert.equal(postRes.status, 404);
    assert.equal(postRes.data.error.code, 'NOT_FOUND');

    // User B attempts to update User A's conversation
    const patchRes = await request(`/api/chat/conversations/${userAConvId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userBToken}` },
      body: { title: 'Hacked Title' },
    });
    assert.equal(patchRes.status, 404);
    assert.equal(patchRes.data.error.code, 'NOT_FOUND');

    // User B attempts to delete User A's conversation
    const deleteRes = await request(`/api/chat/conversations/${userAConvId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.equal(deleteRes.status, 404);
    assert.equal(deleteRes.data.error.code, 'NOT_FOUND');

    // Verify User A's conversation was NOT deleted
    const checkStillExists = await query(
      `SELECT id FROM chat_conversations WHERE id = $1`,
      [userAConvId]
    );
    assert.equal(checkStillExists.rows.length, 1);
  });

  // 9. Conversation Management by Owner
  await t.test('9. User A can list, read, patch, and delete their own conversation', async () => {
    // List
    const listRes = await request('/api/chat/conversations', {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.equal(listRes.status, 200);
    assert.ok(listRes.data.data.conversations.length >= 1);

    // Read
    const getRes = await request(`/api/chat/conversations/${userAConvId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.equal(getRes.status, 200);
    assert.equal(getRes.data.data.conversation.id, userAConvId);
    assert.equal(getRes.data.data.messages.length, 10);

    // Patch
    const patchRes = await request(`/api/chat/conversations/${userAConvId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: { title: 'Renamed Inquiry', archived: true },
    });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.data.data.conversation.title, 'Renamed Inquiry');
    assert.equal(patchRes.data.data.conversation.archived, true);

    // Delete
    const delRes = await request(`/api/chat/conversations/${userAConvId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.equal(delRes.status, 200);

    // Confirm deletion
    const verifyDel = await request(`/api/chat/conversations/${userAConvId}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.equal(verifyDel.status, 404);
  });
});
