import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

/**
 * Pixel baseline, per role.
 *
 * The point of this file is to prove the DESIGN does not move while the role
 * model and API layer are replaced underneath it. That proof is only worth
 * anything if each role genuinely renders — an earlier version logged in once
 * and captured the same session four times, which looked like a pass and
 * proved nothing. Hence the assertion below: if the signed-in identity does not
 * match who we asked for, the run fails loudly rather than quietly agreeing.
 */
const dir = process.argv[2];
mkdirSync(dir, { recursive: true });

const USERS = [
  ['photonadmin', 'admin@photonlegal.com'],
  ['caseowner',   'owner@photonlegal.com'],
  ['counsel',     'counsel@acme.test'],
  ['inventor',    'inventor@acme.test'],
];
const ROUTES = [['dashboard','/'],['ideas','/ideas'],['patents','/patents'],
                ['workspace','/workspace'],['duedates','/due-dates'],['actions','/actions']];


const b = await chromium.launch();
const hashes = {};
const failures = [];

for (const [who, email] of USERS) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => {
    const FIXED = new Date('2026-08-25T12:00:00Z').getTime();
    const R = Date; class F extends R { constructor(...a){ super(...(a.length?a:[FIXED])); } static now(){ return FIXED; } }
    globalThis.Date = F;
  });
  const p = await ctx.newPage();
  await ctx.clearCookies();
  // Real login — the session is an HttpOnly cookie the API sets.
  await p.goto('http://localhost:5200/login', { waitUntil: 'networkidle' });
  await p.fill('input[type="email"]', email);
  await p.fill('input[type="password"]', 'pulse-dev-password');
  await p.click('button[type="submit"]');
  await p.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(2000);

  const signedIn = await p.evaluate(() => {
    try {
      const c = document.cookie.split('; ').find(x => x.startsWith('pl_user='));
      return c ? JSON.parse(decodeURIComponent(c.split('=').slice(1).join('='))).email : null;
    } catch { return null; }
  });
  if (signedIn !== email) { failures.push(`${who}: expected ${email}, session is ${signedIn ?? 'none'}`); await ctx.close(); continue; }

  for (const [name, route] of ROUTES) {
    await p.goto('http://localhost:5200' + route, { waitUntil: 'networkidle' }).catch(() => {});
    await p.addStyleTag({ content: '*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important;}' }).catch(() => {});
    await p.waitForTimeout(1600);
    const file = `${dir}/${who}-${name}.png`;
    await p.screenshot({ path: file, fullPage: true });
    hashes[`${who}-${name}`] = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16);
  }
  await ctx.close();
}
await b.close();

writeFileSync(`${dir}/hashes.json`, JSON.stringify(hashes, null, 1));
if (failures.length) {
  console.log('  SESSION ASSERTION FAILED:');
  failures.forEach(f => console.log('    ' + f));
  process.exit(1);
}
// Distinct renders per screen — if a screen looks the same for every role, the
// harness is not exercising role-dependent UI and the baseline is weak.
const byScreen = {};
for (const [k, v] of Object.entries(hashes)) {
  const [, scr] = [k.split('-')[0], k.split('-').slice(1).join('-')];
  (byScreen[scr] ??= new Set()).add(v);
}
console.log(`  captured ${Object.keys(hashes).length} screens across ${USERS.length} roles -> ${dir}`);
for (const [scr, set] of Object.entries(byScreen)) {
  console.log(`    ${scr.padEnd(11)} ${set.size}/${USERS.length} distinct renders${set.size === 1 ? '  <-- role-independent' : ''}`);
}
