import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getJwtSecret } from '../utils/jwt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('JWT Secret Handling & Security Test Suite', async (t) => {
  const originalSecret = process.env.JWT_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  t.afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
    process.env.NODE_ENV = originalNodeEnv;
  });

  await t.test('1. getJwtSecret returns the environment-provided JWT_SECRET when configured', () => {
    process.env.JWT_SECRET = 'test_secure_random_key_for_unit_tests_1234567890';
    const secret = getJwtSecret();
    assert.equal(secret, 'test_secure_random_key_for_unit_tests_1234567890');
  });

  await t.test('2. getJwtSecret fails clearly in production when JWT_SECRET is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;

    assert.throws(
      () => getJwtSecret(),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /FATAL: JWT_SECRET environment variable is missing in production/);
        return true;
      }
    );
  });

  await t.test('3. getJwtSecret fails clearly in production when JWT_SECRET is empty string', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = '   ';

    assert.throws(
      () => getJwtSecret(),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /FATAL: JWT_SECRET environment variable is missing in production/);
        return true;
      }
    );
  });

  await t.test('4. getJwtSecret requires JWT_SECRET in local development rather than falling back to hardcoded secret', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;

    assert.throws(
      () => getJwtSecret(),
      (err) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Please define JWT_SECRET in server\/\.env/);
        return true;
      }
    );
  });

  await t.test('5. Both signing and verification use the same environment-provided secret', () => {
    process.env.JWT_SECRET = 'env_provided_symmetric_key_policypal_test';
    const secret = getJwtSecret();

    const payload = { userId: '13b6e8e6-3b74-461e-ab31-fefe0d80687d' };
    const token = jwt.sign(payload, secret, { expiresIn: '1h' });

    // Verification with the same getJwtSecret() succeeds
    const decoded = jwt.verify(token, getJwtSecret());
    assert.equal(decoded.userId, payload.userId);

    // Verification with another secret fails
    assert.throws(() => {
      jwt.verify(token, 'different_attacker_secret_key');
    }, /invalid signature/);
  });

  await t.test('6. No hard-coded fallback strings remain in auth controller or middleware source files', () => {
    const controllerPath = path.resolve(__dirname, '../controllers/auth.controller.js');
    const middlewarePath = path.resolve(__dirname, '../middleware/auth.middleware.js');
    const jwtUtilPath = path.resolve(__dirname, '../utils/jwt.js');

    const controllerCode = fs.readFileSync(controllerPath, 'utf-8');
    const middlewareCode = fs.readFileSync(middlewarePath, 'utf-8');
    const jwtUtilCode = fs.readFileSync(jwtUtilPath, 'utf-8');

    assert.doesNotMatch(controllerCode, /fallback_development_secret/i);
    assert.doesNotMatch(middlewareCode, /fallback_development_secret/i);
    assert.doesNotMatch(jwtUtilCode, /fallback_development_secret/i);
  });
});
