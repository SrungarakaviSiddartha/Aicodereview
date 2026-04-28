/**
 * Local Simulation Script for AI Code Review Action
 * 
 * This script mocks the GitHub Actions environment and runs dist/out.js locally.
 * It simulates a fake PR with sample changed files.
 * 
 * Usage: node simulate-local.mjs
 * 
 * Required env vars (set in .env or system):
 *   GEMINI_API_KEY  - Your Gemini API key
 *   GITHUB_TOKEN    - Your GitHub personal access token (needs repo:read, pull-requests:write)
 *   GITHUB_REPO     - Target repo in format owner/repo (e.g., zxcloli666/AI-Code-Review)
 *   GITHUB_PR       - PR number to review (e.g., 1)
 */

import { readFileSync, existsSync } from 'fs';
import { createRequire } from 'module';

// ─── Load .env ──────────────────────────────────────────────────────────────
if (existsSync('.env')) {
  const envContent = readFileSync('.env', 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
  console.log('✅ Loaded .env');
} else {
  console.warn('⚠️  No .env file found – using system environment variables only');
}

// ─── Configuration ──────────────────────────────────────────────────────────
const GROQ_API_KEY   = process.env.GROQ_API_KEY;
const GITHUB_TOKEN   = process.env.GITHUB_TOKEN;
const GITHUB_REPO    = process.env.GITHUB_REPO    || 'zxcloli666/AI-Code-Review';
const GITHUB_PR      = process.env.GITHUB_PR      || '1';

if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN is required. Add it to .env or set it as env var.');
  console.error('   Get one at: https://github.com/settings/tokens');
  process.exit(1);
}

if (!GROQ_API_KEY) {
  console.error('❌ GROQ_API_KEY is required. Add it to .env');
  console.error('   Get one at: https://console.groq.com');
  process.exit(1);
}

const [OWNER, REPO] = GITHUB_REPO.split('/');
console.log(`\n🚀 AI Code Review – Local Simulation`);
console.log(`   Repo:  ${GITHUB_REPO}`);
console.log(`   PR:    #${GITHUB_PR}`);
console.log(`   Model: llama-3.3-70b-versatile (via Groq API)\n`);
console.log('─'.repeat(60));

// ─── Mock GitHub Actions environment ────────────────────────────────────────
// The @actions/core package reads INPUT_* env vars for getInput()
process.env['INPUT_GITHUB_TOKEN']            = GITHUB_TOKEN;
process.env['INPUT_OPENAI_API_KEY']          = GROQ_API_KEY;
process.env['INPUT_OPENAI_API_MODEL']        = 'llama-3.3-70b-versatile';
process.env['INPUT_OPENAI_API_BASE_URL']     = 'https://api.groq.com/openai/v1';
process.env['INPUT_REVIEW_LANGUAGE']         = 'en';
process.env['INPUT_SILENT_MODE']             = 'true'; // avoids PR review API (blocked on Dependabot PRs)
process.env['INPUT_MAX_CHUNK_SIZE']          = '6000';
process.env['INPUT_ENABLE_LINTERS']         = 'true';
process.env['INPUT_ENABLE_AST']              = 'true';
process.env['INPUT_ENABLE_DEPENDENCY_ANALYSIS'] = 'true';
process.env['INPUT_SEVERITY_THRESHOLD']      = 'warning';

// Mock the GitHub context that @actions/github reads
process.env['GITHUB_EVENT_NAME']  = 'pull_request';
process.env['GITHUB_REPOSITORY']  = GITHUB_REPO;
process.env['GITHUB_SHA']         = 'abc1234def5678';
process.env['GITHUB_REF']         = 'refs/pull/' + GITHUB_PR + '/merge';
process.env['GITHUB_WORKFLOW']    = 'AI Code Review Local Simulation';
process.env['GITHUB_ACTION']      = 'ai-code-review';
process.env['GITHUB_ACTOR']       = OWNER;
process.env['GITHUB_WORKSPACE']   = process.cwd();
process.env['GITHUB_SERVER_URL']  = 'https://github.com';
process.env['GITHUB_API_URL']     = 'https://api.github.com';

// Write the GitHub event payload file so @actions/github can parse it
import { writeFileSync } from 'fs';
import { join } from 'path';

const eventPayload = {
  action: 'opened',
  number: parseInt(GITHUB_PR),
  pull_request: {
    number: parseInt(GITHUB_PR),
    title: '[Simulation] Local test PR',
    body: 'This is a local simulation of the AI Code Review action.',
    state: 'open',
    head: { ref: 'feature/test', sha: 'abc1234def5678' },
    base: { ref: 'main', sha: 'fedcba987654321' },
    user: { login: OWNER },
    additions: 50,
    deletions: 10,
    changed_files: 3,
  },
  repository: {
    name: REPO,
    full_name: GITHUB_REPO,
    owner: { login: OWNER },
  },
  sender: { login: OWNER },
};

const eventPath = join(process.cwd(), '.github-event-payload.json');
writeFileSync(eventPath, JSON.stringify(eventPayload, null, 2));
process.env['GITHUB_EVENT_PATH'] = eventPath;

console.log('✅ Mocked GitHub Actions environment');
console.log('✅ Written event payload to .github-event-payload.json');
console.log('\n📦 Running dist/out.js...\n');
console.log('─'.repeat(60));

// ─── Run the action with auto-retry on 429 ──────────────────────────────────
const MAX_ATTEMPTS = 3;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  try {
    // We need to clear the module cache between retries
    if (attempt > 1) {
      console.log(`\n⏳ Waiting 65 seconds for rate limit to reset...\n`);
      await new Promise(r => setTimeout(r, 65000));
      console.log(`\n🔄 Retry attempt ${attempt}/${MAX_ATTEMPTS}...\n`);
      console.log('─'.repeat(60));
    }

    // Dynamically import the built action
    // Add a cache-busting query to force re-import on retries
    await import(`./dist/out.js?attempt=${attempt}`);
    break; // Success

  } catch (err) {
    const msg = err?.message || '';
    if (msg.includes('429') && attempt < MAX_ATTEMPTS) {
      console.warn(`\n⚠️  Rate limited (429). Will retry automatically...`);
    } else if (msg.includes('::error') || msg.includes('setFailed')) {
      console.error('\n❌ Action ended with failure.');
      break;
    } else {
      throw err;
    }
  }
}

