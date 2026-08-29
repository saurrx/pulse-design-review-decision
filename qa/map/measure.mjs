/**
 * Measures qa/map/measured.json — the Atlas's observed layer.
 *
 *   node qa/map/measure.mjs [--base https://demo.photonpulse.ai]
 *
 * For every role × screen: the URL actually landed on (a redirect IS the
 * app's answer to "may I see this?") and every /v1 API call the screen fired.
 * This is recorded from a real browser against the deployed app, not inferred
 * from source — the static map says what a screen COULD call; this says what
 * it DID.
 *
 * NOT drift-gated: the output depends on deployed code and live data, so it is
 * stamped with when/where it was measured and regenerated on demand. Compare
 * runs, don't diff them in CI.
 *
 * The static/measured split caught F-028: the static map showed /clients
 * wired for every Photon role, while measurement showed the superadmin
 * silently redirected off it.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSession, ACCOUNTS, APP } from '../lib/session.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'measured.json');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i === -1 ? d : process.argv[i + 1]; };
const BASE = arg('base', APP);

const SCREENS = ['/', '/ideas', '/patents', '/due-dates', '/actions', '/clients', '/workspace', '/profile', '/assistant'];

/** Normalise ids so runs are comparable across data changes. */
const norm = (u) => {
  let path;
  try { path = new URL(u).pathname; } catch { return null; }
  if (!path.startsWith('/v1')) return null;
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/{id}')
    .replace(/\/\d+/g, '/{id}');
};

const out = { _measured: new Date().toISOString().slice(0, 10), _against: BASE, roles: {} };
const browser = await chromium.launch();
let failures = 0;

for (const role of Object.keys(ACCOUNTS)) {
  const s = await openSession(browser, role, { base: BASE });
  if (!s) {
    // A role that cannot log in is a FAILURE, never a skip — a measured layer
    // missing a role would silently claim that role calls nothing.
    console.error(`${role}: LOGIN FAILED`);
    failures++;
    continue;
  }
  out.roles[role] = {};
  for (const path of SCREENS) {
    const seen = new Set();
    const onReq = (r) => { const n = norm(r.url()); if (n) seen.add(`${r.method()} ${n}`); };
    s.page.on('request', onReq);
    await s.page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await s.page.waitForTimeout(3500);
    s.page.off('request', onReq);
    const landed = new URL(s.page.url()).pathname;
    out.roles[role][path] = { landed, reachable: landed === path, calls: [...seen].sort() };
    console.log(`${role.padEnd(18)} ${path.padEnd(11)} -> ${landed.padEnd(11)} ${seen.size} call(s)`);
  }
  await s.close();
}
await browser.close();

if (failures) { console.error(`${failures} role(s) unmeasured — refusing to write a partial layer.`); process.exit(1); }
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`\nwrote measured.json — ${Object.keys(out.roles).length} roles × ${SCREENS.length} screens, ${out._measured} against ${BASE}`);
