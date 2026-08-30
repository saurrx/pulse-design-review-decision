/**
 * Analytics privacy guard. @tier:security @sec:privacy @soc2:CC6.1 @gdpr:minimisation @cp:pre-deploy
 *
 *   node qa/security/analytics-guard.qa.mjs
 *
 * Pulse handles UNFILED invention disclosures, and every analytics event now
 * reaches a third-party subprocessor (PostHog). The no-free-text rule is the
 * load-bearing control (plan §8, patent-agent §12.4 rule 7): events carry only
 * ids / enums / counts / timings — never disclosure text, notes, reasons,
 * emails, names, file contents, or the client `reference`.
 *
 * Two static tripwires, both fail-closed:
 *
 *  1. DRIFT — the canonical event catalogue `src/lib/analytics/catalog.ts` is
 *     byte-identical to the sha pinned here (it is shared with pulse-backend and
 *     patent-agent). A silent edit that widens the vocabulary, weakens the
 *     denylist, or loosens `sanitize()` reddens here.
 *
 *  2. NO RAW CONTENT IN EMITTERS — walk src/, find every `track(` and
 *     `.capture(` call, and fail if its props carry a denylisted KEY
 *     (`note:`, `reason:`, `email:` …) or SPREAD a variable whose name reads as
 *     raw content (`...disclosure`, `...answer`, `...ideaText` …). Heuristic and
 *     conservative — a tripwire, not a type system. The `*_len` / `*_count`
 *     shape (`reason_len`, `char_count`) is explicitly allowed: it is a count.
 *
 * Static — no build, no browser. That is the point of a pre-deploy gate.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'src');
const CATALOG = join(SRC, 'lib', 'analytics', 'catalog.ts');

// The pinned sha of the shared catalogue. Re-pin ONLY when the catalogue is
// deliberately changed in all three repos together (see the cross-repo drift note).
const PINNED_SHA = '9590b13361b9b5e1b80bc21a00da421829f033076db89e0667ec61fff4b14548';

// Denylisted property KEYS — content, PII, the client-identifying reference, and
// secrets. Mirrors PROPERTY_DENYLIST in the catalogue. Matched EXACTLY against an
// object key, so `reason_len` / `char_count` (a count) are allowed through.
const DENY_KEYS = new Set([
  'ideatext', 'idea_text', 'abstract', 'title', 'claims', 'description', 'text',
  'content', 'prompt', 'completion', 'message', 'messages', 'query', 'queries',
  'document', 'documents', 'answer', 'answers', 'note', 'notes', 'reason', 'body',
  'summary', 'headline', 'report', 'evidence', 'disclosure', 'rewrite',
  'email', 'name', 'first_name', 'last_name', 'full_name', 'phone', 'address',
  'reference',
  'apikey', 'api_key', 'key', 'token', 'access_token', 'refresh_token', 'secret',
  'password', 'authorization', 'cookie',
]);

// Substrings that make a SPREAD variable name read as raw content. Spreading a
// disclosure/answer/note object into an event is the exact leak this catches.
const SPREAD_DENY = [
  'disclosure', 'ideatext', 'idea_text', 'answer', 'note', 'reason', 'email',
  'body', 'abstract', 'claims',
];

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

/** Read the balanced-paren argument text of every `track(` / `.capture(` call. */
function callArgs(txt) {
  const calls = [];
  const re = /(?:\btrack|\.capture)\s*\(/g;
  let m;
  while ((m = re.exec(txt))) {
    let depth = 1;
    let i = re.lastIndex;
    const start = i;
    while (i < txt.length && depth > 0) {
      const c = txt[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      i++;
    }
    calls.push({ index: m.index, args: txt.slice(start, i - 1) });
  }
  return calls;
}

/** Line number of a character offset (1-based). */
function lineAt(txt, offset) {
  return txt.slice(0, offset).split('\n').length;
}

let failed = false;
const problems = [];

// ---- assertion 1: catalogue drift ----
if (!existsSync(CATALOG)) {
  console.log(`analytics-guard: catalogue not found at ${CATALOG} — cannot verify drift`);
  process.exit(1);
}
const actualSha = createHash('sha256').update(readFileSync(CATALOG)).digest('hex');
if (actualSha !== PINNED_SHA) {
  failed = true;
  problems.push(
    `DRIFT: ${relative(ROOT, CATALOG)} sha256 is ${actualSha}\n` +
    `        expected ${PINNED_SHA}\n` +
    `        The shared catalogue changed. If deliberate, edit all three repos and re-pin the sha.`,
  );
}

// ---- assertion 2: no raw content in emitters ----
if (!existsSync(SRC)) {
  console.log(`analytics-guard: src/ not found at ${SRC} — cannot scan`);
  process.exit(1);
}
const files = walk(SRC);
if (!files.length) {
  console.log('analytics-guard: scanned 0 source files — the walker is blind, fix it');
  process.exit(1);
}

let callSites = 0;
for (const f of files) {
  const txt = readFileSync(f, 'utf8');
  for (const call of callArgs(txt)) {
    callSites++;
    const a = call.args;
    const where = `${relative(ROOT, f)}:${lineAt(txt, call.index)}`;

    // Denylisted object KEY: `key:` or shorthand/spread — matched exactly.
    const keyRe = /(?:[{,]\s*|\.\.\.)\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1\s*(:|,|\}|$)/g;
    let km;
    while ((km = keyRe.exec(a))) {
      const key = km[2].toLowerCase();
      const isSpread = a.slice(Math.max(0, km.index), km.index + 3).includes('...');
      if (!isSpread && km[3] && (km[3] === ':' || km[3] === ',' || km[3] === '}') && DENY_KEYS.has(key)) {
        failed = true;
        problems.push(`${where}: emitter carries denylisted property "${km[2]}" — send an id/enum/count, never content`);
      }
    }

    // Denylisted SPREAD variable: `...someDisclosure` reads as raw content.
    const spreadRe = /\.\.\.\s*([A-Za-z_][A-Za-z0-9_.]*)/g;
    let sm;
    while ((sm = spreadRe.exec(a))) {
      const v = sm[1].toLowerCase();
      if (SPREAD_DENY.some((s) => v.includes(s))) {
        failed = true;
        problems.push(`${where}: emitter spreads "${sm[1]}" whose name reads as raw content — spread only sanitised ids/enums`);
      }
    }
  }
}

console.log(
  `analytics-guard: catalogue sha ${actualSha === PINNED_SHA ? 'OK' : 'DRIFTED'}; ` +
  `scanned ${files.length} file(s), ${callSites} emitter call site(s)`,
);

if (failed) {
  console.log(`\n${problems.length} problem(s):`);
  problems.forEach((p) => console.log('  ' + p));
  console.log('\nEvents carry ids / enums / counts / timings only — never disclosure text or PII.');
  process.exit(1);
}
console.log('\ncatalogue intact and no emitter carries raw content — analytics privacy holds');
