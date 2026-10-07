import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, closeDb } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  console.log('🚀 Running database migrations...');
  const db = await getDb();

  // Create migrations tracking table
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Migration directories to check
  const migrationDirs = [
    path.resolve(__dirname, '../../db/migrations'),
    path.resolve(__dirname, './migrations'),
  ];

  let migrationsPath = migrationDirs.find((dir) => fs.existsSync(dir));

  if (!migrationsPath) {
    throw new Error('Migrations directory not found!');
  }

  const files = fs
    .readdirSync(migrationsPath)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const checkRes = await db.query('SELECT name FROM schema_migrations WHERE name = $1', [file]);
    if (checkRes.rows.length > 0) {
      console.log(`⏩ Migration already applied: ${file}`);
      continue;
    }

    console.log(`⚙️ Applying migration: ${file}...`);
    const filePath = path.join(migrationsPath, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    // Run statements via exec
    if (db.exec) {
      await db.exec(sql);
    } else {
      await db.query(sql);
    }
    await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    console.log(`✅ Applied migration: ${file}`);
  }

  console.log('🎉 All migrations completed successfully.');
}

// Allow direct CLI execution
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigrations()
    .then(async () => {
      await closeDb();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Migration failed:', err);
      await closeDb();
      process.exit(1);
    });
}
