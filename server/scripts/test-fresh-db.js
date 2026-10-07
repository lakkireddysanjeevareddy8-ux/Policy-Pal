import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_DIR = path.resolve(__dirname, '..');

async function testFreshDatabase() {
  console.log('🔄 Initializing clean in-memory PostgreSQL database...');
  const pglite = new PGlite();

  console.log('⚙️ Applying 001_initial_schema.sql...');
  const sql1 = fs.readFileSync(path.join(SERVER_DIR, 'src/db/migrations/001_initial_schema.sql'), 'utf-8');
  await pglite.exec(sql1);
  console.log('✅ Applied 001_initial_schema.sql');

  console.log('⚙️ Applying 002_add_updated_at_triggers.sql...');
  const sql2 = fs.readFileSync(path.join(SERVER_DIR, 'src/db/migrations/002_add_updated_at_triggers.sql'), 'utf-8');
  await pglite.exec(sql2);
  console.log('✅ Applied 002_add_updated_at_triggers.sql');

  const tables = await pglite.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  console.log('📋 Public tables created in fresh DB:');
  tables.rows.map((r) => r.table_name).sort().forEach(t => console.log('   - ' + t));

  await pglite.close();
  console.log('🎉 Fresh database migration verified successfully!');
}

testFreshDatabase().catch((err) => {
  console.error('❌ Fresh DB test error:', err);
  process.exit(1);
});
