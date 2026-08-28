/**
 * Sweep: every /api/v1 URL the design can send vs the adapter's RULES.
 * Anything unmatched throws a 501 at runtime — i.e. dead UI waiting to happen.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const src = 'src';
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); const s = statSync(p);
  s.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) && !p.includes('realAdapter') && files.push(p); } };
walk(src);

// collect literal + template /api/v1 urls; normalize ${...} -> :x
const calls = new Map();
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/["'`](\/api\/v1\/[^"'`\s]+)["'`]/g)) {
    const raw = m[1].replace(/\$\{[^}]+\}/g, 'XVARX').replace(/\?.*$/, '');
    if (!calls.has(raw)) calls.set(raw, []);
    calls.get(raw).push(f.replace('src/', ''));
  }
}

// extract RULES regexes from the adapter source
const adapter = readFileSync('src/lib/realAdapter.ts', 'utf8');
const rules = [...adapter.matchAll(/m: (\/\^.*?\/)(?:,|\s*$)/gm)].map((m) => {
  const lit = m[1];
  const body = lit.slice(2, lit.lastIndexOf('/'));
  return new RegExp('^' + body);
});
console.log(`${calls.size} distinct /api/v1 urls in components, ${rules.length} adapter rules\n`);

const misses = [];
for (const [url, where] of [...calls.entries()].sort()) {
  // try with a plausible substitution for template vars
  const candidates = [url, url.replaceAll('XVARX', '123e4567-e89b-42d3-a456-426614174000'), url.replaceAll('XVARX', 'abc')];
  const hit = candidates.some((c) => rules.some((r) => r.test(c)));
  if (!hit) misses.push({ url, where: [...new Set(where)] });
}
if (!misses.length) console.log('ALL MAPPED — no 501 risks.');
for (const miss of misses) {
  console.log(`UNMAPPED  ${miss.url}`);
  for (const w of miss.where.slice(0, 3)) console.log(`          ${w}`);
}
