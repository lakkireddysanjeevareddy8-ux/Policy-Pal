import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pg;

let pool = null;
let pgliteInstance = null;

export async function getDb() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
    if (!pool) {
      const isLocalhost = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: isLocalhost ? false : { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      pool.on('error', (err) => {
        console.error('Unexpected database client error:', err);
      });
    }

    return {
      query: (text, params) => pool.query(text, params),
      exec: (text) => pool.query(text),
      getClient: () => pool.connect(),
      isPglite: false,
    };
  }

  // Fallback to PGlite (WASM Postgres) for zero-config testing & offline verification
  if (!pgliteInstance) {
    console.log('ℹ️ DATABASE_URL not set. Initializing embedded Postgres (PGlite) for local development...');
    const { PGlite } = await import('@electric-sql/pglite');
    // Store in server/.pglite_data for persistence
    const dataDir = path.resolve(__dirname, '../../.pglite_data');
    pgliteInstance = new PGlite(dataDir);
    await pgliteInstance.waitReady;
    console.log('✅ Embedded Postgres (PGlite) ready at:', dataDir);
  }

  return {
    query: async (text, params = []) => {
      const res = await pgliteInstance.query(text, params);
      return {
        rows: res.rows || [],
        rowCount: res.affectedRows ?? (res.rows ? res.rows.length : 0),
        command: res.command || '',
      };
    },
    exec: async (text) => {
      return pgliteInstance.exec(text);
    },
    getClient: async () => {
      return {
        query: async (text, params = []) => {
          const res = await pgliteInstance.query(text, params);
          return {
            rows: res.rows || [],
            rowCount: res.affectedRows ?? (res.rows ? res.rows.length : 0),
            command: res.command || '',
          };
        },
        release: () => {},
      };
    },
    isPglite: true,
  };
}

export async function exec(text) {
  const db = await getDb();
  return db.exec ? db.exec(text) : db.query(text);
}

export async function query(text, params = []) {
  const db = await getDb();
  return db.query(text, params);
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
  if (pgliteInstance) {
    await pgliteInstance.close();
    pgliteInstance = null;
  }
}

export default {
  query,
  getDb,
  closeDb,
};
