/**
 * Every call the app makes must resolve to an adapter rule — for the VERB it
 * actually uses. @tier:contract @cp:pre-deploy
 *
 *   node qa/contract/adapter-coverage.qa.mjs
 *
 * The old route-sweep.mjs checked that every `/api/v1` path matched some rule.
 * That is not enough, and the gap was not theoretical: the check-score rule was
 * locked to POST while all three call sites issue a GET, so the path matched, a
 * sweep would have passed, and the adapter returned a synthetic 501 with no
 * network traffic at all. For an inventor that broke submission entirely —
 * "Send for review" only appears once scoring has succeeded.
 *
 * So this pairs each call site's HTTP VERB with its path and resolves both
 * through the real RULES table.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordHits } from '../lib/exception-hits.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'src');

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

/* ---- what the app calls -------------------------------------------------- */
/**
 * A call site: API_CONFIG.<verb>(<url>), where the url may be a literal OR a
 * ternary choosing between several.
 *
 * The delimiter is captured and back-referenced so the match ends at the
 * MATCHING quote. A non-greedy `[\\s\\S]*?` up to any quote instead ran across
 * whole files and produced paths containing half a component.
 *
 * The optional non-quote prefix is the second lesson, and it is the same one
 * qa/map/generate.mjs learned: `API_CONFIG.get(cond ? "a" : \`b\`)` starts with
 * an identifier, so the strict form matched nothing at all and the call site
 * vanished from coverage — the failure mode this gate exists to prevent, in
 * the gate itself. Brackets are excluded from the prefix so a match cannot run
 * past its own call, and EVERY literal in the argument list is taken, because
 * a ternary's branches can resolve to different rules.
 */
const CALL = /API_CONFIG\s*\.\s*(get|post|put|patch|delete)\s*\(\s*(?:[^'"`()]*?)?(['"`])((?:(?!\2)[\s\S])*?)\2([\s\S]{0,400}?)\)/g;
const LITERALS = /(['"`])((?:(?!\1)[\s\S])*?)\1/g;
// Interpolations stand in for a real id. A uuid, not "X": one rule is
// /clients\/([0-9a-f-]{36})$/ and a short placeholder fails it for the wrong
// reason — the call site does pass a uuid.
const ID = '00000000-0000-4000-8000-000000000000';

const calls = [];
for (const f of walk(SRC)) {
  if (f.endsWith('realAdapter.ts')) continue;
  for (const m of readFileSync(f, 'utf8').matchAll(CALL)) {
    for (const url of [m[3], ...[...(m[4] ?? '').matchAll(LITERALS)].map(x => x[2])]) {
      if (!url.includes('/api/v1/')) continue;
      // `${expr}` becomes a placeholder segment so the path matches structurally.
      calls.push({
        method: m[1].toUpperCase(),
        // Collapse an interpolation — possibly spanning lines and containing
        // nested braces — down to one id-shaped segment.
        path: url.replace(/\$\{[^{}]*\}/g, ID).replace(/\s+/g, ''),
        file: f.replace(ROOT + '/', ''),
      });
    }
  }
}

/* ---- what the adapter accepts -------------------------------------------- */
const adapter = readFileSync(join(SRC, 'lib', 'realAdapter.ts'), 'utf8');

/**
 * Find the end of a regex literal, tracking character classes.
 *
 * A naive /\/((?:[^/\\]|\\.)+)\// stops at the first unescaped slash — and
 * these rules are full of `[^/]+`, where that slash is inside a class and does
 * NOT end the literal. The naive version parsed 32 of 83 rules and reported 60
 * false unmapped calls.
 */
function endOfRegex(text, start) {
  let inClass = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') { i++; continue; }
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) return i;
  }
  return -1;
}

const rules = [];
for (const m of adapter.matchAll(/\{\s*m:\s*\//g)) {
  const start = m.index + m[0].length;
  const end = endOfRegex(adapter, start);
  if (end === -1) continue;
  const body = adapter.slice(start, end);
  const after = adapter.slice(end + 1, end + 60);
  const meth = after.match(/^\s*,\s*method:\s*"([A-Z]+)"/);
  try { rules.push({ re: new RegExp(body), method: meth ? meth[1] : null }); }
  catch { /* not a rule literal */ }
}

const declared = (adapter.match(/\{\s*m:\s*\//g) ?? []).length;
if (rules.length !== declared) {
  console.error(`parsed ${rules.length} of ${declared} rule literals — the parser is blind to some. Fix it rather than trusting the pass.`);
  process.exit(2);
}

const resolves = c => rules.some(r => r.re.test(c.path) && (!r.method || r.method === c.method));

/**
 * Deliberately-unmapped routes, from qa/exceptions.json.
 *
 * Listed ONE BY ONE rather than as a pattern, so a sixth unmapped call fails
 * this check instead of hiding among the five that are unmapped on purpose.
 */
const exFile = join(ROOT, 'qa', 'exceptions.json');
const allowed = !existsSync(exFile) ? [] :
  (JSON.parse(readFileSync(exFile, 'utf8')).exceptions ?? [])
    .filter(e => e.match?.tier === 'contract' && e.match?.rule === 'adapter-coverage')
    .flatMap(e => e.match.paths ?? []);
const byDesign = c => allowed.some(a => c.path.startsWith(a));

// Which exception ids actually covered something on this run.
const firedIds = new Set(
  (JSON.parse(readFileSync(exFile, 'utf8')).exceptions ?? [])
    .filter(e => e.match?.tier === 'contract' && e.match?.rule === 'adapter-coverage')
    .filter(e => calls.some(c => !resolves(c) && (e.match.paths ?? []).some(a => c.path.startsWith(a))))
    .map(e => e.id));

const seen = new Set();
const suppressed = calls.filter(c => !resolves(c) && byDesign(c)).length;
const unmapped = calls.filter(c => !resolves(c) && !byDesign(c)).filter(c => {
  const k = `${c.method} ${c.path}`;
  if (seen.has(k)) return false;
  seen.add(k); return true;
});

console.log(`${calls.length} call sites · ${rules.length} adapter rules · ${suppressed} unmapped by design`);
if (unmapped.length) {
  recordHits('contract', [...firedIds]);
  console.log(`\n${unmapped.length} call(s) resolve to NO rule for their verb — each returns a synthetic 501:`);
  for (const c of unmapped) {
    console.log(`  ${c.method} ${c.path}\n      ${c.file}`);
    if (rules.some(r => r.re.test(c.path))) {
      console.log('      the PATH matches a rule; the rule is locked to a different method');
    }
  }
  process.exit(1);
}
recordHits('contract', [...firedIds]);
console.log('\nevery call resolves, verb included (except the ones unmapped on purpose)');
