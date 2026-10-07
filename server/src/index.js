import app from './app.js';
import { runMigrations } from './db/migrate.js';
import { runSeed } from './db/seed.js';
import { getDb } from './db/index.js';

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    console.log('🔄 Initializing database connection...');
    await getDb();

    // Run migrations on startup to guarantee schema integrity
    await runMigrations();

    // Check if schemes catalog has been seeded
    const db = await getDb();
    const schemeCount = await db.query('SELECT COUNT(*) as count FROM schemes');
    if (parseInt(schemeCount.rows[0].count, 10) === 0) {
      console.log('🌱 Schemes catalog empty. Seeding catalog and demo user...');
      await runSeed();
    }

    const server = app.listen(PORT, () => {
      console.log(`🚀 PolicyPal API server running at http://localhost:${PORT}`);
      console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(() => {
        console.log('Server HTTP connections closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

bootstrap();
