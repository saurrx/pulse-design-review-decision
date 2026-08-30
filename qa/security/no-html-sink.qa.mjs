/**
 * No raw-HTML sink anywhere in src/. @tier:security @sec:xss @soc2:CC6.1 @cp:pre-deploy
 *
 *   node qa/security/no-html-sink.qa.mjs
 *
 * React's `dangerouslySetInnerHTML` is the one built-in door that turns a
 * string into live DOM without escaping — the direct path to stored/reflected
 * XSS in a React app. Phase-2 verified the app has ZERO of them and renders
 * every value as text. This gate pins that property: the count must stay 0, so
 * a future PR that introduces the first sink reddens here and has to argue for
 * it (with sanitisation) rather than slip in unnoticed.
 *
 * Static grep, no build required — that is the point of a pre-deploy gate.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'src');
const SINK = 'dangerouslySetInnerHTML';
// Only source we author. dist/build/node_modules are not ours to police here.
const SKIP = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);
const CODE = /\.(m|c)?[jt]sx?$/;

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (SKIP.has(e)) continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (CODE.test(e)) out.push(p);
  }
  return out;
}

if (!existsSync(SRC)) {
  console.log(`no-html-sink: src/ not found at ${SRC} — cannot scan`);
  process.exit(1);
}

const files = walk(SRC);
// Guard the scanner itself: a walk that finds no files would report "clean"
// forever. If src/ has no source, the gate is blind, not passing.
if (!files.length) {
  console.log('no-html-sink: scanned 0 source files — the walker is blind, fix it');
  process.exit(1);
}

const offenders = [];
for (const f of files) {
  const txt = readFileSync(f, 'utf8');
  const lines = txt.split('\n');
  lines.forEach((line, i) => {
    if (line.includes(SINK)) offenders.push(`${relative(ROOT, f)}:${i + 1}: ${line.trim()}`);
  });
}

console.log(`no-html-sink: scanned ${files.length} source file(s) for ${SINK}`);
if (offenders.length) {
  console.log(`\n${offenders.length} HTML sink(s) found — every one is a potential XSS door:`);
  offenders.forEach(o => console.log('  ' + o));
  console.log('\nRender values as text, or sanitise before injecting. The count must be 0.');
  process.exit(1);
}
console.log('\nno raw-HTML sink in src/ — count is 0');
