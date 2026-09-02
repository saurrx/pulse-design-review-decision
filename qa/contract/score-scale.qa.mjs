/**
 * One score scale, everywhere. @tier:contract @area:agent-eval @cp:pre-deploy
 *
 *   node qa/contract/score-scale.qa.mjs        (static; no browser needed)
 *
 * Scores are stored 0-100 and shown out of 10. They used to be shown both ways
 * at once: `ShowScoreReport` took a `displayScale` prop defaulting to 100, and
 * exactly one of its three call sites passed 10. So the same idea read "72" to
 * the inventor who wrote it and "7.2" to the legal counsel reviewing it — on
 * screens the two of them discuss with each other — while the dashboard said
 * "Scored 72/100" and the PDF's headline printed a bare "72.00" above
 * per-reference scores that were already /10.
 *
 * A scale that CAN differ per call site will differ again, so the prop is gone
 * rather than defaulted the other way, and this fails if it comes back.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'src');

const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(p)) files.push(p);
  }
})(SRC);

const failures = [];
/** Comments explain the rule; they must not trip it. */
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

for (const f of files) {
  const raw = readFileSync(f, 'utf8');
  const src = stripComments(raw);
  const where = relative(ROOT, f);

  if (/displayScale/.test(src)) {
    failures.push(`${where}: \`displayScale\` is back — one scale, no prop to get wrong`);
  }
  // "/100" as a rendered denominator. Percentages, widths and Tailwind opacity
  // values (bg-black/100) are not that, so require a digit or a brace before it.
  for (const m of src.matchAll(/[^\w/](\d|\})\s*\/\s*100\b/g)) {
    const line = src.slice(0, m.index).split('\n').length;
    const text = src.split('\n')[line - 1];
    if (/width|height|%|opacity|Math\.min|Math\.max|toFixed\(2\)/.test(text)) continue;
    failures.push(`${where}:${line}: renders a score out of 100 — ${text.trim().slice(0, 80)}`);
  }
  if (/out of 100/i.test(src)) failures.push(`${where}: says "out of 100"`);
}

console.log(`score scale — ${files.length} source files checked\n`);
if (failures.length) {
  console.error(`${failures.length} failure(s):\n`);
  failures.forEach(f => console.error('  ' + f));
  process.exit(1);
}
console.log('every score is shown out of 10');
