/**
 * Generates qa/map/frontend.json — this repo's layer of the Atlas.
 *
 *   node qa/map/generate.mjs          # write
 *   node qa/map/generate.mjs --check  # fail if stale
 *
 * For every app route: the page component, its component import tree (walked to
 * fixpoint from the page), every API_CONFIG call those components make, and the
 * adapter rule + real backend route each call resolves to. Plus the reverse
 * index the contract tier does not keep: adapter rules matched by ZERO call
 * sites — the F1–F6 stale candidates in the Atlas register, kept mechanically
 * current here so that list cannot rot.
 *
 * The adapter-rule regex scanner must track character classes: these rules are
 * full of `[^/]+`, where a naive "first unescaped slash" parser stops early —
 * it once parsed 32 of 83 rules and reported 60 false unmapped calls. Same
 * hazard as qa/contract/adapter-coverage.qa.mjs, same fix.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'qa', 'map', 'frontend.json');

/* ---- file inventory ------------------------------------------------------- */
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = join(d, e.name);
  return e.isDirectory() ? walk(p) : (/\.(ts|tsx)$/.test(e.name) ? [p] : []);
});
const files = walk(SRC);
const body = Object.fromEntries(files.map((f) => [f, readFileSync(f, 'utf8')]));

const resolve = (from, spec) => {
  let base;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = join(dirname(from), spec);
  else return null;
  for (const c of [base + '.tsx', base + '.ts', join(base, 'index.tsx'), join(base, 'index.ts')])
    if (body[c] !== undefined) return c;
  return null;
};

/* ---- routes from App.tsx -------------------------------------------------- */
const app = body[join(SRC, 'App.tsx')];
const lazyOf = Object.fromEntries(
  [...app.matchAll(/const (\w+) = lazy\(\(\) => import\("([^"]+)"\)\)/g)]
    .map((m) => [m[1], m[2]]),
);
const importOf = Object.fromEntries(
  [...app.matchAll(/import (\w+) from "([^"]+)"/g)].map((m) => [m[1], m[2]]),
);
const routes = [...app.matchAll(/<Route\s+path="([^"]+)"\s+element={<(\w+)/g)]
  .map((m) => ({ path: m[1], page: m[2] }))
  .filter((r) => r.path !== '*');

/* ---- adapter rules (character-class-aware) -------------------------------- */
const adapterFile = join(SRC, 'lib', 'realAdapter.ts');
const adapter = body[adapterFile];
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
  const src = adapter.slice(start, end);
  const after = adapter.slice(end + 1, end + 80);
  const meth = after.match(/^\s*,\s*method:\s*"([A-Z]+)"/);
  // The rule's `to:` body runs until the next rule literal; the /v1 string
  // literals inside it are the real backend route(s) this rule translates to.
  // A rule whose body builds its URL dynamically contributes what it can.
  const nextRule = adapter.indexOf('{ m: /', end);
  const toBody = adapter.slice(end, nextRule === -1 ? end + 2000 : nextRule);
  // Templates nest (`${qs ? `?${qs}` : ""}`), so a regex substitution is
  // unreliable. Walk the string tracking `${…}` nesting depth: each top-level
  // placeholder collapses to one token — `{id}` in path position, dropped in
  // query position — and the static suffix after it survives, so
  // `/v1/actions/${b.id}/request-status` maps to `/v1/actions/{id}/request-status`.
  const collapse = (t) => {
    let out = '', depth = 0;
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '$' && t[i + 1] === '{') {
        if (depth === 0) out += '\u0000';
        depth++; i++; continue;
      }
      if (depth > 0) { if (t[i] === '{') depth++; else if (t[i] === '}') depth--; continue; }
      out += t[i];
    }
    out = out.split('?')[0];
    return out
      .replace(/\/\u0000/g, '/{id}')
      .replace(/\u0000/g, '')
      .replace(/\/$/, '');
  };
  const v1 = [...new Set(
    [...toBody.matchAll(/[\`](\/v1\/[^\`]*)\`|["'](\/v1\/[^"']*)["']/g)]
      .map((x) => collapse(x[1] ?? x[2])),
  )];
  try { rules.push({ src, re: new RegExp(src), method: meth ? meth[1] : null, v1 }); }
  catch { /* not a rule literal */ }
}
const declared = (adapter.match(/\{\s*m:\s*\//g) ?? []).length;
if (rules.length !== declared) {
  console.error(`parsed ${rules.length} of ${declared} adapter rules — fix the parser, do not trust this run.`);
  process.exit(2);
}

/* ---- per-route component tree + API calls --------------------------------- */
// `${…}` placeholders become a UUID-shaped value so id-pattern rules match.
const PLACEHOLDER = '0f0e0d0c-0b0a-4908-8706-050403020100';
const callsOf = (f) =>
  [...body[f].matchAll(/API_CONFIG\.(get|post|put|patch|delete)\s*\(\s*[`'"]([^`'"]+)/g)]
    .map((m) => ({
      method: m[1].toUpperCase(),
      path: m[2].replace(/\$\{[^}]*\}/g, PLACEHOLDER),
      raw: m[2],
    }));

const ruleFor = (c) => rules.findIndex((r) => r.re.test(c.path) && (!r.method || r.method === c.method));

const usedRules = new Set();
const routeRows = routes.map((r) => {
  const entrySpec = lazyOf[r.page] ?? importOf[r.page];
  const entry = entrySpec ? resolve(join(SRC, 'App.tsx'), entrySpec) : null;
  const tree = new Set(entry ? [entry] : []);
  const stack = [...tree];
  while (stack.length) {
    const f = stack.pop();
    for (const m of body[f].matchAll(/(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
      const t = resolve(f, m[1]);
      if (t && !tree.has(t)) { tree.add(t); stack.push(t); }
    }
  }
  const seen = new Set();
  const calls = [];
  for (const f of tree) {
    for (const c of callsOf(f)) {
      const i = ruleFor(c);
      if (i >= 0) usedRules.add(i);
      const key = `${c.method} ${c.raw}`;
      if (seen.has(key)) continue;
      seen.add(key);
      calls.push({
        method: c.method,
        call: c.raw,
        rule: i >= 0 ? rules[i].src : null,
        v1: i >= 0 ? rules[i].v1 : [],
        from: relative(ROOT, f),
      });
    }
  }
  calls.sort((a, b) => (a.call + a.method).localeCompare(b.call + b.method));
  return {
    route: r.path,
    page: r.page,
    entry: entry ? relative(ROOT, entry) : null,
    components: tree.size,
    calls,
  };
});

// Calls made outside any page tree (hooks/libs imported only by App itself)
// are attributed via the routes that reach them, so nothing extra needed here.

const unusedRules = rules
  .map((r, i) => ({ src: r.src, method: r.method, i }))
  .filter((r) => {
    if (usedRules.has(r.i)) return false;
    // A rule only counts as used if SOME call in the whole repo matches it —
    // check repo-wide, not just page trees, so shared hooks count.
    for (const f of files) {
      if (f === adapterFile) continue;
      for (const c of callsOf(f)) {
        if (rules[r.i].re.test(c.path) && (!rules[r.i].method || rules[r.i].method === c.method)) return false;
      }
    }
    return true;
  })
  .map(({ src, method, v1 }) => ({ src, method, v1 }));

const doc = {
  _generated: 'qa/map/generate.mjs — do not edit by hand; CI fails if stale',
  routes: routeRows,
  adapterRules: rules.length,
  unusedAdapterRules: unusedRules,
};
const text = JSON.stringify(doc, null, 1) + '\n';

if (process.argv.includes('--check')) {
  const current = readFileSync(OUT, 'utf8');
  if (current !== text) {
    console.error('qa/map/frontend.json is STALE — regenerate and commit it.');
    process.exit(1);
  }
  console.log(`frontend.json current — ${routeRows.length} routes, ${rules.length} rules, ${unusedRules.length} unused`);
} else {
  writeFileSync(OUT, text);
  console.log(`wrote frontend.json — ${routeRows.length} routes, ${rules.length} rules, ${unusedRules.length} unused rules`);
}
