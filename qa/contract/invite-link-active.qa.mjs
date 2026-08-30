/**
 * A field the screens gate on must be a field the adapter produces.
 * @tier:contract @area:clients @cp:pre-deploy
 *
 *   node qa/contract/invite-link-active.qa.mjs
 *
 * Named after the bug it would have caught. Both invite screens render the
 * link, the QR code and the Regenerate/Deactivate controls only when
 * `inviteLinkData.active` is true. The API answers a share link with
 * {id, code, url, expires_at} and the adapter's wrap forwarded exactly that —
 * so `active` was always undefined, the "no link yet" branch was the only one
 * that could ever render, and a link the API had just minted was invisible.
 * Nothing threw; an optional-chained miss is a silent false.
 * See pulse-backend docs/qa/findings.md F-044.
 *
 * The check is deliberately narrow: it does not know what a share link is, only
 * that a gate reading `X.active` needs a producer that writes `active`. It runs
 * with no browser and no network, so it can gate a merge request.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const failures = [];

/* ---- 1. who gates on it -------------------------------------------------- */
const consumers = [];
for (const f of walk(SRC)) {
  if (f.endsWith('realAdapter.ts')) continue;
  const text = readFileSync(f, 'utf8');
  if (/inviteLinkData\??\.\s*active\b/.test(text)) consumers.push(f.replace(ROOT + '/', ''));
}

// A gate that matches nothing is not a passing gate — it is a dead one. If the
// screens stop reading `active`, this file has to be re-aimed or deleted, and
// saying so beats reporting a green.
if (consumers.length === 0) {
  console.error('No screen reads inviteLinkData.active any more — re-aim or delete this check.');
  process.exit(2);
}

/* ---- 2. who produces it -------------------------------------------------- */
const adapter = readFileSync(join(SRC, 'lib', 'realAdapter.ts'), 'utf8');

/**
 * The source text of every adapter rule whose target is the share link.
 *
 * Rules are `{ m: /…/, method: "…", to: … }` objects; slicing from the rule's
 * opening brace to the start of the next one is enough to read a rule's wrap
 * without parsing TypeScript.
 */
const ruleStarts = [...adapter.matchAll(/\{\s*m:\s*\//g)].map(m => m.index);
const ruleBodies = ruleStarts.map((start, i) =>
  adapter.slice(start, ruleStarts[i + 1] ?? adapter.length));
const inviteRules = ruleBodies.filter(b => /invite-link/.test(b) && /share-link/.test(b));

if (inviteRules.length < 2) {
  console.error(`expected the GET and POST share-link rules, found ${inviteRules.length}.`);
  process.exit(2);
}

/**
 * Resolve one level of helper indirection: a wrap may build the view inline or
 * call a named helper defined in the same file. Anything deeper than that is
 * not worth guessing at — it would be guessing.
 */
const helperBody = (name) => {
  const m = adapter.match(new RegExp(`const ${name} = \\([\\s\\S]*?\\n\\}\\);`));
  return m ? m[0] : '';
};

for (const rule of inviteRules) {
  const wrap = rule.slice(rule.indexOf('wrap:'));
  const helpers = [...wrap.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]);
  const resolved = wrap + helpers.map(helperBody).join('\n');
  if (!/\bactive\s*:/.test(resolved)) {
    const which = /method:\s*"POST"/.test(rule) ? 'POST' : 'GET';
    failures.push(
      `the ${which} share-link rule's wrap does not produce \`active\`, which ` +
      `${consumers.join(', ')} gate the whole link and QR block on.`);
  }
}

/* ---- report -------------------------------------------------------------- */
if (failures.length) {
  console.error('invite-link-active: FAIL');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`invite-link-active: ok — ${inviteRules.length} share-link rules produce \`active\`; ` +
  `${consumers.length} screen(s) gate on it`);
