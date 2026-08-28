/**
 * Layout invariants across every role and page. @tier:invariant @cp:post-deploy
 *
 * Runs against the DEPLOYED environment, by decision: an MR's code is not
 * deployed anywhere, so running this on an MR would assert things about the
 * previous release.
 *
 *   node qa/invariant/layout.qa.mjs [--base https://demo.photonpulse.ai]
 *
 * Login throttle is 5/5min/IP, so this logs in ONCE per role and reuses the
 * context for every page. Do not add a login per page.
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLLECT, evaluate } from '../lib/invariants.mjs';

const QA = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i === -1 ? d : process.argv[i + 1]; };
const contract = JSON.parse(readFileSync(join(QA, 'contract.json'), 'utf8'));
const BASE = arg('base', contract.environments.demo.app);
const PW = process.env.QA_PASSWORD ?? 'PulseDemo!2026';

const exceptionsFile = join(QA, 'exceptions.json');
const EXCEPTIONS = existsSync(exceptionsFile)
  ? JSON.parse(readFileSync(exceptionsFile, 'utf8')).exceptions ?? [] : [];

const ROLES = [
  { role: 'PHOTON_ADMIN',   email: 'demo.admin@photonlegal.com',     pages: ['/', '/clients', '/ideas', '/patents', '/due-dates', '/actions', '/workspace', '/profile'] },
  { role: 'CASE_OWNER',     email: 'demo.caseowner@photonlegal.com', pages: ['/', '/clients', '/ideas', '/patents', '/due-dates', '/actions', '/profile'] },
  { role: 'LEGAL_COUNSEL',  email: 'demo.counsel@demo.com',          pages: ['/', '/ideas', '/patents', '/due-dates', '/actions', '/workspace', '/profile'] },
  { role: 'TECH_COMMITTEE', email: 'demo.committee@demo.com',        pages: ['/', '/ideas', '/patents', '/due-dates', '/profile'] },
  { role: 'INVENTOR',       email: 'demo.inventor@demo.com',         pages: ['/', '/ideas', '/patents', '/profile'] },
];

// The app is desktop-only by design (DesktopOnlyGate below 1024px), so these
// are the two real viewports, not an arbitrary matrix.
const VIEWPORTS = [{ width: 1280, height: 720 }, { width: 1440, height: 900 }];

/**
 * A suppression must be as narrow as the thing it suppresses. `selContains`
 * exists so "the world map is pannable" does not also silence every other
 * clipped element on the dashboard.
 */
const suppressed = (role, page, v) => EXCEPTIONS.find(e =>
  e.match?.tier === 'invariant' && e.match?.rule === v.rule &&
  (!e.match.page || e.match.page === page) &&
  (!e.match.role || e.match.role === role) &&
  (!e.match.selContains || v.detail.includes(e.match.selContains)));

/**
 * Sessions are cached to disk and reused.
 *
 * The throttle is 5 logins / 5 min / IP and there are exactly 5 roles, so a
 * naive run sits precisely on the limit and ANY re-run inside the window fails
 * every role — which is how the first version of this file behaved. Caching
 * storageState makes a repeat run cost zero logins, which matters most when
 * you are iterating on a rule and running this ten times in an hour.
 *
 * The cache is short-lived because the access cookie is 15 minutes.
 */
const SESSIONS = join(QA, '.sessions');
mkdirSync(SESSIONS, { recursive: true });
const MAX_SESSION_AGE_MS = 12 * 60 * 1000;

async function contextFor(browser, r) {
  const file = join(SESSIONS, `${r.role}.json`);
  const fresh = existsSync(file) && (Date.now() - statSync(file).mtimeMs) < MAX_SESSION_AGE_MS;
  if (fresh) {
    const ctx = await browser.newContext({ viewport: VIEWPORTS[0], storageState: file });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    if (!/\/login/.test(page.url())) return { ctx, page, reused: true };
    await ctx.close();                       // stale after all; fall through
  }
  const ctx = await browser.newContext({ viewport: VIEWPORTS[0] });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', r.email);
  await page.fill('input[type="password"]', PW);
  await Promise.all([
    page.waitForURL(u => !/\/login/.test(u.toString()), { timeout: 30000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(2500);
  if (/\/login/.test(page.url())) { await ctx.close(); return null; }
  writeFileSync(file, JSON.stringify(await ctx.storageState()));
  return { ctx, page, reused: false };
}

const browser = await chromium.launch();
let failures = 0, suppressedCount = 0, checked = 0;

for (const r of ROLES) {
  const session = await contextFor(browser, r);
  if (!session) {
    console.log(`### ${r.role}: LOGIN FAILED (throttle is 5/5min/IP — wait, or reuse qa/.sessions)`);
    failures++; continue;
  }
  const { ctx, page, reused } = session;
  console.log(`\n### ${r.role}${reused ? ' (cached session)' : ''}`);
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp);
    for (const p of r.pages) {
      await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(900);
      const raw = await page.evaluate(COLLECT);
      const violations = evaluate(raw);
      checked++;
      const real = [], hushed = [];
      for (const v of violations) (suppressed(r.role, p, v) ? hushed : real).push(v);
      suppressedCount += hushed.length;
      if (real.length) {
        failures += real.length;
        console.log(`  FAIL ${p} @${vp.width}x${vp.height}`);
        real.slice(0, 6).forEach(v => console.log(`       ${v.rule}: ${v.detail}`));
        if (real.length > 6) console.log(`       …and ${real.length - 6} more`);
      } else {
        console.log(`  ok   ${p} @${vp.width}x${vp.height}${hushed.length ? `  (${hushed.length} suppressed)` : ''}`);
      }
    }
  }
  // Write the session back before closing, even when it was reused. The API
  // rotates the refresh token on every use, so a reused session that is never
  // re-saved leaves a SPENT token in the cache: the next run — this tier's or
  // the journey tier's — finds a "fresh" file, fails its refresh with a 401,
  // and has to burn a login it should not have needed.
  try { writeFileSync(join(SESSIONS, `${r.role}.json`), JSON.stringify(await ctx.storageState())); } catch { /* closed */ }
  await ctx.close();
}
await browser.close();
console.log(`\n${checked} page-viewport combinations · ${failures} violation(s) · ${suppressedCount} suppressed`);
process.exit(failures ? 1 : 0);
