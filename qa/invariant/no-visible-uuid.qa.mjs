/**
 * No screen shows the reader a UUID. @tier:invariant @cp:post-deploy
 * @area:ideas @area:patents @area:clients @area:actions @area:duedates
 * @role:PHOTON_ADMIN @role:CASE_OWNER @role:LEGAL_COUNSEL @role:TECH_COMMITTEE @role:INVENTOR
 *
 *   node qa/invariant/no-visible-uuid.qa.mjs [--base https://demo.photonpulse.ai]
 *
 * A uuid is a database key. It cannot be read down a phone, quoted in an
 * email, matched against a paper file, or recognised twice in a list — and it
 * leaks the shape of the system to whoever is looking over the reader's
 * shoulder. Every record a person talks about needs a name a person can say:
 * an idea has its workspace reference (DEMO07), a patent its application
 * number, a person their name.
 *
 * This walks the real screens as each role and fails on any VISIBLE text node
 * containing a uuid. It runs against the deployed app for the same reason the
 * other browser tiers do: an MR's code is not deployed anywhere.
 *
 * Deliberately not a source grep. The uuid never appears in the source — it
 * arrives at runtime as a fallback when a field the screen expected is empty,
 * which is exactly how this shipped in the first place.
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSession, APP } from '../lib/session.mjs';
import { recordHits } from '../lib/exception-hits.mjs';

const QA = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i === -1 ? d : process.argv[i + 1]; };
const BASE = arg('base', APP);

const exceptionsFile = join(QA, 'exceptions.json');
const EXCEPTIONS = existsSync(exceptionsFile)
  ? JSON.parse(readFileSync(exceptionsFile, 'utf8')).exceptions ?? [] : [];

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** The screens a person actually reads. */
const SURFACES = [
  { role: 'PHOTON_ADMIN', paths: ['/', '/clients', '/ideas', '/patents', '/due-dates', '/actions', '/workspace', '/profile'] },
  { role: 'CASE_OWNER', paths: ['/', '/clients', '/ideas', '/patents', '/due-dates', '/actions', '/profile'] },
  { role: 'LEGAL_COUNSEL', paths: ['/', '/ideas', '/patents', '/due-dates', '/workspace', '/profile'] },
  { role: 'TECH_COMMITTEE', paths: ['/', '/ideas', '/patents', '/due-dates', '/profile'] },
  { role: 'INVENTOR', paths: ['/', '/ideas', '/patents', '/profile'] },
];

/** Runs in the page: every visible text node carrying a uuid, with its owner. */
const COLLECT = (uuidSource) => {
  const re = new RegExp(uuidSource, 'i');
  const out = [];
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        const text = (child.textContent ?? '').trim();
        if (text && re.test(text)) {
          const el = child.parentElement;
          const cls = el && el.getAttribute('class');
          out.push({
            where: el ? `${el.tagName.toLowerCase()}${cls ? '.' + String(cls).split(/\s+/)[0] : ''}` : '?',
            text: text.slice(0, 120),
          });
        }
      } else if (child.nodeType === 1) {
        // A uuid in a hidden node is not shown to anybody.
        const st = getComputedStyle(child);
        if (st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0') walk(child);
      }
    }
  };
  walk(document.body);
  return out;
};

const suppressed = (role, path, hit) => EXCEPTIONS.find(e =>
  e.match?.tier === 'invariant' && e.match?.rule === 'visible-uuid' &&
  (!e.match.role || e.match.role === role) &&
  (!e.match.page || e.match.page === path) &&
  (!e.match.selContains || hit.where.includes(e.match.selContains)));

const browser = await chromium.launch();
let checked = 0, failures = 0, loginFailures = 0;
const hits = new Set();

for (const { role, paths } of SURFACES) {
  const session = await openSession(browser, role, { base: BASE, viewport: { width: 1440, height: 900 } });
  if (!session) {
    console.log(`### ${role}: LOGIN FAILED (throttle is 5/5min/IP — wait, or reuse qa/.sessions)`);
    loginFailures++;
    continue;
  }
  const { page } = session;
  console.log(`\n### ${role}${session.reused ? ' (cached session)' : ''}`);
  for (const path of paths) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    // The lists this is about arrive after their fetch resolves.
    await page.waitForTimeout(6000);
    if (/\/login$/.test(new URL(page.url()).pathname)) {
      console.log(`  FAIL ${path} — bounced to /login mid-run`);
      failures++; continue;
    }
    checked++;
    const found = await page.evaluate(COLLECT, UUID);
    const real = [], hushed = [];
    for (const hit of found) {
      const ex = suppressed(role, path, hit);
      if (ex) { hushed.push(ex.id); hits.add(ex.id); } else real.push(hit);
    }
    if (real.length) {
      failures += real.length;
      console.log(`  FAIL ${path} — ${real.length} uuid(s) on screen`);
      for (const h of real.slice(0, 5)) console.log(`       ${h.where}: ${h.text}`);
    } else {
      console.log(`  ok   ${path}${hushed.length ? `  (${hushed.length} suppressed)` : ''}`);
    }
  }
  await session.close();
}
await browser.close();

recordHits('invariant-uuid', [...hits], { complete: loginFailures === 0 });
console.log(`\n${checked} surface(s) checked — ${failures} uuid(s) shown to a reader`);
if (loginFailures) {
  console.error(`${loginFailures} role(s) could not sign in — that is a failed run, not a pass`);
  process.exit(2);
}
process.exit(failures ? 1 : 0);
