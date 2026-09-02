/**
 * Shared session handling for the browser tiers (invariant, journey).
 *
 * The login throttle on the demo API is 5 requests / 5 min / IP and there are
 * exactly 5 roles, so a naive run sits precisely on the limit and ANY re-run
 * inside the window fails every role. Sessions are therefore cached to disk as
 * Playwright storageState and reused.
 *
 * Two things this gets right that a first attempt does not:
 *
 * 1. The state is written back on close, ALWAYS — not only after a fresh
 *    login. The API rotates the refresh token on every use, so a reused
 *    session whose state is never re-saved leaves a SPENT refresh token in the
 *    file. The next run then finds a "fresh" cache, fails its refresh with a
 *    401, and has to burn a login anyway. That is exactly how the first
 *    exploration run of this tier died.
 * 2. Reuse is verified by loading a real page, not by trusting the mtime. A
 *    file can be young and the session still dead.
 *
 * qa/.sessions/ is gitignored and MUST NEVER be published as a CI artifact:
 * it holds live authentication cookies for the demo accounts.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const QA = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CONTRACT = JSON.parse(readFileSync(join(QA, 'contract.json'), 'utf8'));
/**
 * DESIGN FORK: mock mode. QA_MOCK=1 (the default here) points every tier at
 * the mock app, logs in through the real login form with the qa/full
 * scenario's personas, ignores the password and caches nothing. The demo host
 * in the shared contract is never read in this repository.
 */
export const MOCK = process.env.QA_MOCK !== '0';
export const MOCK_PERSONAS = JSON.parse(readFileSync(join(QA, 'lib', 'mock-personas.json'), 'utf8'));
export const APP = MOCK ? (process.env.QA_BASE ?? 'http://localhost:3700') : CONTRACT.environments.demo.app;

const SESSIONS = join(QA, '.sessions');
const MAX_SESSION_AGE_MS = 12 * 60 * 1000;   // the access cookie lives 15 min

/**
 * QA_TRACE_API=1 records every /v1 request a tier makes, one JSON line per
 * call, into qa/.api-trace.jsonl. It exists to answer a question the suite
 * could not previously answer about ITSELF: which of the API's routes do these
 * tests actually exercise? Coverage claimed from reading test source is a
 * guess — a tier drives a UI, and which endpoints the UI calls is the app's
 * business, not the test's.
 *
 * Off by default and free when off. The trace is gitignored: it records URLs
 * from an authenticated session against real data.
 */
const TRACE = process.env.QA_TRACE_API === '1';
const TRACE_FILE = join(QA, '.api-trace.jsonl');

function attachTrace(ctx, role) {
  if (!TRACE) return;
  ctx.on('request', (r) => {
    let path;
    try { path = new URL(r.url()).pathname; } catch { return; }
    if (!path.startsWith('/v1')) return;
    const route = path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/{id}')
      .replace(/\/\d+/g, '/{id}');
    try { appendFileSync(TRACE_FILE, JSON.stringify({ role, method: r.method(), route }) + '\n'); } catch { /* best effort */ }
  });
}

export const ACCOUNTS = {
  // The sixth role finally has an account. PHOTON_SUPERADMIN has no screens of
  // its own — it falls through to the operational UI — so it is covered by the
  // invariant and conformance tiers plus one journey asserting the thing that
  // actually distinguishes it: unbounded reach, and no client scope.
  PHOTON_SUPERADMIN: 'demo.superadmin@photonlegal.com',
  PHOTON_ADMIN:   'demo.admin@photonlegal.com',
  CASE_OWNER:     'demo.caseowner@photonlegal.com',
  LEGAL_COUNSEL:  'demo.counsel@demo.com',
  TECH_COMMITTEE: 'demo.committee@demo.com',
  INVENTOR:       'demo.inventor@demo.com',
};

/**
 * Open a logged-in context for `role`. Returns null when login fails, which
 * the caller must treat as a failure — never as "skip this role".
 */
export async function openSession(browser, role, {
  base = APP,
  password = process.env.QA_PASSWORD ?? '',
  viewport = { width: 1440, height: 900 },
} = {}) {
  if (MOCK) return openMockSession(browser, role, { base, viewport });
  mkdirSync(SESSIONS, { recursive: true });
  // Cookies are host-scoped, so a session cached against one base is useless
  // against another - and worse than useless if it is silently reused, because
  // the run then burns a login it thought it had. The default base keeps the
  // plain `<ROLE>.json` name so every existing cache file stays valid.
  const file = join(SESSIONS, base === APP
    ? `${role}.json`
    : `${role}--${new URL(base).host.replace(/[:.]/g, '_')}.json`);
  const email = ACCOUNTS[role];
  if (!email) throw new Error(`no demo account for role ${role}`);
  if (!password) throw new Error('QA_PASSWORD is required outside mock mode');

  const save = async (ctx) => {
    try { writeFileSync(file, JSON.stringify(await ctx.storageState())); } catch { /* closed */ }
  };

  if (existsSync(file) && (Date.now() - statSync(file).mtimeMs) < MAX_SESSION_AGE_MS) {
    const ctx = await browser.newContext({ viewport, storageState: file });
    attachTrace(ctx, role);
    const page = await ctx.newPage();
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1500);
    if (!/\/login/.test(page.url())) {
      return { ctx, page, role, reused: true, close: async () => { await save(ctx); await ctx.close(); } };
    }
    await ctx.close();                                  // stale after all
  }

  const ctx = await browser.newContext({ viewport });
  attachTrace(ctx, role);
  const page = await ctx.newPage();
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await Promise.all([
    page.waitForURL(u => !/\/login/.test(u.toString()), { timeout: 30000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(2500);
  if (/\/login/.test(page.url())) { await ctx.close(); return null; }
  await save(ctx);
  return { ctx, page, role, reused: false, close: async () => { await save(ctx); await ctx.close(); } };
}

/** Mock mode: the real login form against the mock, on the qa/full scenario, no throttle, no cache. */
async function openMockSession(browser, role, { base, viewport }) {
  const email = MOCK_PERSONAS[role];
  if (!email) throw new Error(`no mock persona for role ${role}`);
  const ctx = await browser.newContext({ viewport });
  attachTrace(ctx, role);
  const page = await ctx.newPage();
  await page.goto(`${base}/login?scenario=${encodeURIComponent(MOCK_PERSONAS.scenario)}`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'mock');
  await Promise.all([
    page.waitForURL(u => !/\/login/.test(u.toString()), { timeout: 30000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(800);
  if (/\/login/.test(page.url())) { await ctx.close(); return null; }
  return { ctx, page, role, reused: false, close: async () => { await ctx.close(); } };
}
