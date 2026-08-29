/**
 * ONE-TIME reconciliation against the designer's reference implementation.
 * Deliberately NOT a `.qa.mjs` file, so `qa/cli.mjs` never selects it and no
 * checkpoint can come to depend on a repo we do not own.
 *
 *   # 1. record our side (one login per role, throttle-friendly)
 *   node qa/conformance/structure.qa.mjs --update
 *   # 2. run the design app on 3700, then:
 *   node qa/conformance/design-diff.mjs [--design http://localhost:3700]
 *
 * The design repo is saurrx/pulse-design-auto @3f9b2fdb, branch
 * codex/pulse-review-workflow-consistency. It is self-contained: apiConfig
 * points at an in-browser mock router, so no backend is involved and personas
 * are selected by writing the `pl_user` cookie the mock store reads.
 *
 * The user's instruction was explicit - the design was given once, for this
 * exercise, and is then retired. So this script is a SOURCE, not a gate:
 * nothing in CI may ever invoke it. What survives the design repo is
 * qa/conformance/baseline/, recorded from OUR app once the deviations found
 * here were fixed or accepted.
 *
 * Direction of the diff: the design is `expected`, we are `actual`. So
 * "missing-signature" means the design has something we do not - the
 * interesting direction, and the direction the dropped-Action-column bug
 * points in. "extra-signature" is usually intentional (six roles vs four, real
 * data vs mock, features built after the design) and is reported separately so
 * it does not drown the real list.
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diff } from '../lib/conformance.mjs';
import { captureStructure, serialise } from './capture.mjs';
import { SURFACES, DESIGN_PERSONA, COMPARABLE_ROLES, VIEWPORT, key } from './surfaces.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(HERE, 'baseline');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i === -1 ? d : process.argv[i + 1]; };
const DESIGN = arg('design', 'http://localhost:3700');
// Gitignored: these captures describe someone else's repo and must never be
// committed here.
const OUT = arg('out', join(HERE, '..', '.conformance-design'));

/* Deviations already triaged and accepted. They stay visible - printed under
 * "settled" rather than deleted - so a re-run of this reconciliation does not
 * re-raise questions that have an owner, a reason and an expiry against them
 * in qa/exceptions.json. */
const QA = join(HERE, '..');
const EXCEPTIONS = (existsSync(join(QA, 'exceptions.json'))
  ? JSON.parse(readFileSync(join(QA, 'exceptions.json'), 'utf8')).exceptions ?? []
  : []).filter((e) => e.match?.tier === 'conformance' && e.match?.source === 'design-reconciliation');

const settledBy = (role, path, f) => EXCEPTIONS.find((e) =>
  (!e.match.rule || e.match.rule === f.rule) &&
  (!e.match.page || e.match.page === path) &&
  (!e.match.role || e.match.role === role) &&
  (!e.match.selContains || f.detail.includes(e.match.selContains)));

const probe = await fetch(DESIGN).then((r) => r.ok).catch(() => false);
if (!probe) {
  console.log(`qa: the design app is not answering at ${DESIGN}.`);
  console.log('    Start it in a checkout of pulse-design-auto: npx vite --port 3700');
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const origin = new URL(DESIGN);
const report = [];
let compared = 0, missingBaseline = 0;

for (const role of COMPARABLE_ROLES) {
  const persona = DESIGN_PERSONA[role];
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  await ctx.addCookies([{
    name: 'pl_user',
    value: encodeURIComponent(JSON.stringify(persona)),
    domain: origin.hostname,
    path: '/',
  }]);
  const page = await ctx.newPage();
  console.log(`\n### ${role}  (design persona ${persona.role} / ${persona.email})`);

  for (const s of SURFACES) {
    if (s.design === false) continue;
    if (!s.roles.includes(role)) continue;

    await page.goto(`${DESIGN}${s.path}`, { waitUntil: 'networkidle' }).catch(() => {});
    const landed = new URL(page.url()).pathname;
    const designStructure = await captureStructure(page, { path: s.path, role });
    designStructure.landedOn = landed === s.path ? undefined : landed;
    writeFileSync(join(OUT, `${key(role, s.path)}.json`), serialise(designStructure));

    const ourFile = join(BASELINE, `${key(role, s.path)}.json`);
    if (!existsSync(ourFile)) {
      console.log(`  ??   ${s.path} - our side not recorded. Run structure.qa.mjs --update first.`);
      missingBaseline++; continue;
    }
    const ours = JSON.parse(readFileSync(ourFile, 'utf8'));
    const all = diff(designStructure, ours);
    compared++;

    const settled = [], findings = [];
    for (const f of all) (settledBy(role, s.path, f) ? settled : findings).push(f);

    const missing = findings.filter((f) => f.rule === 'missing-signature');
    const extra = findings.filter((f) => f.rule === 'extra-signature');
    const hard = findings.filter((f) => !['missing-signature', 'extra-signature', 'style-drift'].includes(f.rule));
    const style = findings.filter((f) => f.rule === 'style-drift');

    console.log(`  ---  ${s.path}${designStructure.landedOn ? ` (design landed on ${designStructure.landedOn})` : ''}${ours.landedOn ? ` (ours landed on ${ours.landedOn})` : ''}${settled.length ? `  [${settled.length} settled]` : ''}`);
    for (const f of hard) console.log(`       [${f.rule}] ${f.detail}`);
    if (missing.length) {
      console.log(`       ONLY IN DESIGN (${missing.length}):`);
      missing.forEach((f) => console.log(`         - ${f.detail}`));
    }
    if (style.length) {
      console.log(`       STYLE DRIFT (${style.length}):`);
      style.forEach((f) => console.log(`         ~ ${f.detail}`));
    }
    if (extra.length) console.log(`       only in ours (${extra.length}): ${extra.map((f) => f.detail).join(' | ')}`);

    report.push({ role, path: s.path, hard, missing, style, extra, settled });
  }
  await ctx.close();
}
await browser.close();

writeFileSync(join(OUT, '_findings.json'), `${JSON.stringify(report, null, 2)}\n`);

const n = (k) => report.reduce((a, r) => a + r[k].length, 0);
console.log(`\n${compared} surface(s) compared across ${COMPARABLE_ROLES.length} of 6 roles.`);
console.log('TECH_COMMITTEE and PHOTON_SUPERADMIN have no design counterpart and were not compared.');
console.log(`structural-in-design-only ${n('missing')} · only-in-ours ${n('extra')} · table/order ${n('hard')} · style ${n('style')} · already settled ${n('settled')}`);
if (missingBaseline) console.log(`${missingBaseline} surface(s) skipped for want of a recorded baseline.`);
console.log(`raw captures + _findings.json in ${OUT}`);
// Reporting tool, not a gate: a deviation is an input to triage, not a build
// failure. Only an inability to compare is a non-zero exit.
process.exit(probe ? 0 : 2);
