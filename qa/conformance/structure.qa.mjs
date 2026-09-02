/**
 * Structural conformance against the committed baseline. @tier:conformance @cp:post-deploy
 * @area:dashboard @area:ideas @area:patents @area:duedates @area:actions @area:clients @area:workspace
 * @role:PHOTON_ADMIN @role:CASE_OWNER @role:LEGAL_COUNSEL @role:TECH_COMMITTEE @role:INVENTOR
 *
 *   node qa/conformance/structure.qa.mjs                 # check
 *   node qa/conformance/structure.qa.mjs --update        # re-record the baseline
 *   node qa/conformance/structure.qa.mjs --role INVENTOR --path /ideas
 *
 * Runs against the DEPLOYED environment for the same reason the invariant tier
 * does: an MR's code is not deployed anywhere.
 *
 * WHAT THIS IS NOT: a screenshot baseline. It records roles, accessible names,
 * heading levels, table columns, section order and a curated computed-style
 * projection - never pixels, never data. A row count changing, a client being
 * renamed or a new patent landing on demo must NOT move this file; a dropped
 * column, a vanished button or a heading demoted from h1 to h3 must.
 *
 * The baseline was seeded from a one-time reconciliation against the
 * designer's reference implementation (design-diff.mjs, since removed —
 * stale.md F7). That
 * repo is retired; this baseline is what survives it.
 *
 * `--update` is the whole risk here: it will happily record a bug as the new
 * truth. Read the diff before you run it, the same way you would read a
 * snapshot test's diff.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSession, APP } from '../lib/session.mjs';
import { diff } from '../lib/conformance.mjs';
import { captureStructure, serialise } from './capture.mjs';
import { recordHits } from '../lib/exception-hits.mjs';
import { SURFACES, VIEWPORT, key } from './surfaces.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const QA = join(HERE, '..');
// DESIGN FORK: the mock baseline lives beside production's, which stays untouched and merges cleanly.
const BASELINE = join(HERE, process.env.QA_MOCK !== '0' ? 'baseline-mock' : 'baseline');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i === -1 ? d : process.argv[i + 1]; };
const has = (n) => process.argv.includes('--' + n);

const BASE = arg('base', APP);
const UPDATE = has('update');
const ONLY_ROLE = arg('role', null);
const ONLY_PATH = arg('path', null);

const exceptionsFile = join(QA, 'exceptions.json');
const EXCEPTIONS = existsSync(exceptionsFile)
  ? JSON.parse(readFileSync(exceptionsFile, 'utf8')).exceptions ?? [] : [];

/** As narrow as the thing it suppresses - `selContains` matches inside the
 * finding's detail so one accepted deviation cannot silence a whole page.
 *
 * Entries carrying a `source` are skipped outright. They belong to the
 * one-time design reconciliation, and one of them pins `table-columns` on
 * /due-dates: honouring it here would silence a genuine future column drop on
 * the exact page whose dropped Action column is why this tier exists. */
const suppressed = (role, path, f) => EXCEPTIONS.find((e) =>
  e.match?.tier === 'conformance' && !e.match?.source &&
  (!e.match.rule || e.match.rule === f.rule) &&
  (!e.match.page || e.match.page === path) &&
  (!e.match.role || e.match.role === role) &&
  (!e.match.selContains || f.detail.includes(e.match.selContains)));

/* Group the work by ROLE, not by page: one session per role, every page inside
 * it. The login throttle is 5/5min/IP and there are exactly 5 roles here. */
const byRole = new Map();
for (const s of SURFACES) {
  for (const role of s.roles) {
    if (ONLY_ROLE && role !== ONLY_ROLE) continue;
    if (ONLY_PATH && s.path !== ONLY_PATH) continue;
    if (!byRole.has(role)) byRole.set(role, []);
    byRole.get(role).push(s.path);
  }
}

if (!byRole.size) {
  console.log(`qa: no surfaces selected (role=${ONLY_ROLE} path=${ONLY_PATH}).`);
  process.exit(2);
}

mkdirSync(BASELINE, { recursive: true });

const browser = await chromium.launch();
let failures = 0, hushedTotal = 0, checked = 0, written = 0, infra = 0;
// Which exceptions actually fired — see qa/lib/exception-hits.mjs.
const hits = [];
let loginFailures = 0;
const seen = new Set();

for (const [role, paths] of byRole) {
  const session = await openSession(browser, role, { base: BASE, viewport: VIEWPORT });
  if (!session) {
    console.log(`### ${role}: LOGIN FAILED (throttle is 5/5min/IP - wait, or reuse qa/.sessions)`);
    loginFailures++;
    infra++; continue;
  }
  const { page } = session;
  console.log(`\n### ${role}${session.reused ? ' (cached session)' : ''}`);
  await page.setViewportSize(VIEWPORT);

  for (const path of paths) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' }).catch(() => {});
    const landed = new URL(page.url()).pathname;
    if (/\/login$/.test(landed)) {
      console.log(`  FAIL ${path} - bounced to /login mid-run`);
      infra++; continue;
    }
    const structure = await captureStructure(page, { path, role });
    const file = join(BASELINE, `${key(role, path)}.json`);
    seen.add(`${key(role, path)}.json`);
    checked++;

    // A redirect is structure too: /workspace sends every non-admin to
    // /profile, and the capture must say so rather than quietly recording the
    // profile page under the workspace's name.
    structure.landedOn = landed === path ? undefined : landed;

    if (UPDATE) {
      writeFileSync(file, serialise(structure));
      written++;
      console.log(`  rec  ${path}  (${structure.signatures.length} signatures, ${Object.keys(structure.styles).length} styled, ${structure.tables.length} table(s))`);
      continue;
    }

    if (!existsSync(file)) {
      console.log(`  FAIL ${path} - no baseline recorded. Run with --update after reviewing.`);
      failures++; continue;
    }
    const expected = JSON.parse(readFileSync(file, 'utf8'));
    const findings = diff(expected, structure);
    const real = [], hushed = [];
    for (const f of findings) {
      const ex = suppressed(role, path, f);
      if (ex) { hushed.push(f); hits.push(ex.id); } else real.push(f);
    }
    hushedTotal += hushed.length;
    if (real.length) {
      failures += real.length;
      console.log(`  FAIL ${path}`);
      real.slice(0, 10).forEach((f) => console.log(`       ${f.rule}: ${f.detail}`));
      if (real.length > 10) console.log(`       ...and ${real.length - 10} more`);
    } else {
      console.log(`  ok   ${path}${hushed.length ? `  (${hushed.length} suppressed)` : ''}`);
    }
  }
  await session.close();
}
await browser.close();
if (!ONLY_ROLE && !ONLY_PATH && loginFailures > 0) {
  console.log(`\nqa: orphan-baseline check skipped — ${loginFailures} role(s) never logged in, so their baselines were never visited.`);
}
// Not recorded on a --update run: re-recording the baseline suppresses nothing,
// so treating that as evidence would mark every exception dead.
if (!UPDATE) recordHits('conformance', hits, { complete: loginFailures === 0 });

/* A baseline file for a surface nobody captures any more is a test that
 * stopped running without anyone deciding it should. Only meaningful on a full
 * run - a filtered run legitimately touches a subset.
 *
 * And only when every role got in. A throttled login skips that role's whole
 * surface set, and calling those baselines orphans told the reader to delete 23
 * perfectly good files because the API said 429. An orphan is a CONFIG
 * question; a skipped role is an INFRASTRUCTURE one, and conflating them turns
 * a rate limit into data loss. */
if (!ONLY_ROLE && !ONLY_PATH && loginFailures === 0) {
  const orphans = readdirSync(BASELINE).filter((f) => f.endsWith('.json') && !seen.has(f));
  if (orphans.length) {
    console.log(`\nqa: ${orphans.length} baseline file(s) match no surface in surfaces.mjs:`);
    orphans.forEach((f) => console.log(`    ${f}`));
    console.log('    Delete them, or add the surface back.');
    if (!UPDATE) failures += orphans.length;
  }
}

console.log(UPDATE
  ? `\n${written} baseline snapshot(s) recorded from ${BASE}. READ THE DIFF before committing.`
  : `\n${checked} surface(s) checked - ${failures} deviation(s) - ${hushedTotal} suppressed`);
process.exit(infra ? 2 : (failures ? 1 : 0));
