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
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const QA = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CONTRACT = JSON.parse(readFileSync(join(QA, 'contract.json'), 'utf8'));
export const APP = CONTRACT.environments.demo.app;

const SESSIONS = join(QA, '.sessions');
const MAX_SESSION_AGE_MS = 12 * 60 * 1000;   // the access cookie lives 15 min

export const ACCOUNTS = {
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
  password = process.env.QA_PASSWORD ?? 'PulseDemo!2026',
  viewport = { width: 1440, height: 900 },
} = {}) {
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

  const save = async (ctx) => {
    try { writeFileSync(file, JSON.stringify(await ctx.storageState())); } catch { /* closed */ }
  };

  if (existsSync(file) && (Date.now() - statSync(file).mtimeMs) < MAX_SESSION_AGE_MS) {
    const ctx = await browser.newContext({ viewport, storageState: file });
    const page = await ctx.newPage();
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1500);
    if (!/\/login/.test(page.url())) {
      return { ctx, page, role, reused: true, close: async () => { await save(ctx); await ctx.close(); } };
    }
    await ctx.close();                                  // stale after all
  }

  const ctx = await browser.newContext({ viewport });
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
