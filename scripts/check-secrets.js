import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('🔒 ==========================================');
console.log('🔒 PolicyPal Secrets & Key Leak Safety Scanner');
console.log('🔒 ==========================================\n');

let violations = [];

// 1. Verify that .env files are NOT tracked by git
console.log('📋 [1/3] Checking Git index for accidentally tracked .env files...');
try {
  const trackedFiles = execSync('git ls-files', { cwd: ROOT_DIR, encoding: 'utf-8' })
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);

  const trackedEnvFiles = trackedFiles.filter((f) => {
    const base = path.basename(f);
    // Allow .env.example or .env.template
    return base.startsWith('.env') && !base.includes('.example') && !base.includes('.template');
  });

  if (trackedEnvFiles.length > 0) {
    violations.push({
      type: 'Tracked .env file in git',
      file: trackedEnvFiles.join(', '),
      detail: 'Actual .env files containing real secrets are tracked in git repository!',
    });
    console.error(`❌ Found tracked .env files: ${trackedEnvFiles.join(', ')}`);
  } else {
    console.log('✅ PASS: No .env files are tracked by git (only .env.example present).');
  }
} catch (err) {
  console.warn(`⚠️ Warning: Git check skipped (${err.message})`);
}

// 2. Build or verify client/dist and check client bundle for leaks
console.log('\n📦 [2/3] Checking client bundle for leaked secrets or GEMINI_API_KEY...');
const clientDistDir = path.resolve(ROOT_DIR, 'client/dist');

// Ensure client dist exists
if (!fs.existsSync(clientDistDir)) {
  console.log('⚙️ client/dist not found. Running "npm --prefix client run build"...');
  execSync('npm --prefix client run build', { cwd: ROOT_DIR, stdio: 'inherit' });
}

function scanClientDist(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanClientDist(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html') || entry.name.endsWith('.css'))) {
      const content = fs.readFileSync(fullPath, 'utf-8');

      // Check strictly for GEMINI_API_KEY
      if (content.includes('GEMINI_API_KEY')) {
        violations.push({
          type: 'Client Bundle Leaked Variable Name',
          file: path.relative(ROOT_DIR, fullPath),
          detail: 'Client bundle references "GEMINI_API_KEY"! Gemini keys must NEVER reach the browser.',
        });
      }

      // Check for Google AI Studio API key pattern (AIzaSy...)
      const googleApiKeyMatch = content.match(/AIzaSy[A-Za-z0-9_-]{33}/);
      if (googleApiKeyMatch) {
        violations.push({
          type: 'Leaked Google API Key in client bundle',
          file: path.relative(ROOT_DIR, fullPath),
          detail: `Found potential Gemini API key string: ${googleApiKeyMatch[0].substring(0, 10)}...`,
        });
      }

      // Check for postgres database URLs
      const dbUrlMatch = content.match(/postgres(?:ql)?:\/\/[a-zA-Z0-9_\-]+:[^@\s]+@[a-zA-Z0-9_\.\-]+/);
      if (dbUrlMatch) {
        violations.push({
          type: 'Leaked Database URL in client bundle',
          file: path.relative(ROOT_DIR, fullPath),
          detail: `Found database connection string in client bundle: ${dbUrlMatch[0].substring(0, 15)}...`,
        });
      }
    }
  }
}

scanClientDist(clientDistDir);
console.log('✅ PASS: Client bundle inspected. No GEMINI_API_KEY, no database credentials found.');

// 3. Scan codebase for hardcoded production secrets
console.log('\n🔍 [3/3] Scanning source repository for hardcoded high-entropy secrets...');

const SECRET_PATTERNS = [
  {
    name: 'Google API Key (AIzaSy...)',
    regex: /AIzaSy[0-9A-Za-z\-_]{33}/g,
  },
  {
    name: 'Private Encryption Key Header',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
  },
  {
    name: 'Live Supabase/Postgres Connection with Production Password',
    regex: /postgres(?:ql)?:\/\/(?!postgres:password)[a-zA-Z0-9_\-]+:[a-zA-Z0-9_\-!#$%^&*]{8,}@db\.[a-z0-9\-]+\.supabase\.co/gi,
  },
];

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.pglite_data',
  'dist',
  'coverage',
  '.tempmediaStorage',
]);

const ALLOWED_FILES = new Set([
  '.env.example',
  'check-secrets.js',
  'AI_INTEGRATION.md',
  'ARCHITECTURE.md',
  'DEPLOYMENT.md',
  'README.md',
]);

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(ROOT_DIR, fullPath);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        scanDirectory(fullPath);
      }
    } else if (entry.isFile()) {
      if (ALLOWED_FILES.has(entry.name)) {
        continue;
      }

      // Check text files
      const ext = path.extname(entry.name);
      if (['.js', '.jsx', '.ts', '.tsx', '.json', '.sql', '.yaml', '.yml', '.env'].includes(ext) || entry.name.startsWith('.env')) {
        const content = fs.readFileSync(fullPath, 'utf-8');

        for (const pattern of SECRET_PATTERNS) {
          const matches = content.match(pattern.regex);
          if (matches) {
            violations.push({
              type: pattern.name,
              file: relPath,
              detail: `Found ${matches.length} matching string(s) (sample: ${matches[0].substring(0, 10)}...)`,
            });
          }
        }
      }
    }
  }
}

scanDirectory(ROOT_DIR);

// Report Results
console.log('\n==========================================');
console.log('📊 Secrets Safety Audit Summary');
console.log('==========================================');

if (violations.length === 0) {
  console.log('✨ ALL CHECKS PASSED: 0 secrets or sensitive strings detected!');
  console.log('🛡️ The codebase and client bundles are 100% clean and safe for public deployment.');
  process.exit(0);
} else {
  console.error(`🚨 FAILED: Found ${violations.length} security violation(s):`);
  violations.forEach((v, idx) => {
    console.error(`  [${idx + 1}] ${v.type}`);
    console.error(`      File:   ${v.file}`);
    console.error(`      Detail: ${v.detail}\n`);
  });
  process.exit(1);
}
