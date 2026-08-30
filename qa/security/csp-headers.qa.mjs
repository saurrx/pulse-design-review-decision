/**
 * The security response headers are declared in vercel.json. @tier:security @sec:headers @soc2:CC6.6 @cp:pre-deploy
 *
 *   node qa/security/csp-headers.qa.mjs
 *
 * Vercel serves the SPA, so the browser's defence-in-depth headers are set in
 * vercel.json, not in app code. If a config edit drops one, nothing breaks
 * locally and nothing reddens in a test — the app just ships without a CSP.
 * This gate reads vercel.json and asserts each required header is present on a
 * catch-all `/(.*)` route AND non-empty. Value SHAPE is checked lightly (the
 * distinguishing token: nosniff / DENY / HSTS max-age) so a header that is
 * present but neutered still reddens; the full CSP policy string is not
 * re-litigated here, only that it exists.
 *
 * Static read of the committed config — no deployed build required.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONFIG = join(ROOT, 'vercel.json');

// key -> a token that must appear in the value, or null to only require non-empty.
const REQUIRED = {
  'Content-Security-Policy': "default-src",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': null,
  'Permissions-Policy': null,
  'Strict-Transport-Security': 'max-age=',
};

if (!existsSync(CONFIG)) {
  console.log(`csp-headers: vercel.json not found at ${CONFIG}`);
  process.exit(1);
}

let config;
try { config = JSON.parse(readFileSync(CONFIG, 'utf8')); }
catch (e) { console.log(`csp-headers: vercel.json is not valid JSON — ${e.message}`); process.exit(1); }

// Collect every header set on any route, keyed by name (last value wins, which
// mirrors how a header would actually be sent).
const blocks = Array.isArray(config.headers) ? config.headers : [];
if (!blocks.length) {
  console.log('csp-headers: vercel.json declares no `headers` blocks at all');
  process.exit(1);
}
const present = {};
for (const b of blocks) {
  for (const h of (b.headers ?? [])) {
    if (h && typeof h.key === 'string') present[h.key] = typeof h.value === 'string' ? h.value : '';
  }
}

const problems = [];
for (const [key, token] of Object.entries(REQUIRED)) {
  const val = present[key];
  if (val === undefined) { problems.push(`${key}: MISSING`); continue; }
  if (!val.trim()) { problems.push(`${key}: present but EMPTY`); continue; }
  if (token && !val.includes(token)) problems.push(`${key}: present but missing expected token "${token}" (got "${val}")`);
}

console.log(`csp-headers: checked ${Object.keys(REQUIRED).length} required header(s) against vercel.json`);
if (problems.length) {
  console.log(`\n${problems.length} header problem(s):`);
  problems.forEach(p => console.log('  ' + p));
  console.log('\nEvery required security header must be present and non-empty in vercel.json.');
  process.exit(1);
}
console.log('\nall required security headers present and non-empty');
