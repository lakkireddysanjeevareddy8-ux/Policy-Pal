import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure server/.env and root .env are loaded
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Retrieves the environment-provided JWT secret.
 * Throws a descriptive fatal error if JWT_SECRET is missing or empty.
 * Never falls back to a hardcoded secret in any environment.
 *
 * @returns {string} The secret string from process.env.JWT_SECRET
 */
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL: JWT_SECRET environment variable is missing in production. Server startup aborted.'
      );
    }
    throw new Error(
      'FATAL: JWT_SECRET environment variable is missing. Please define JWT_SECRET in server/.env for local development.'
    );
  }
  return secret;
}
