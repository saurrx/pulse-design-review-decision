/**
 * The auth token never touches JS storage. @tier:security @sec:secrets @soc2:CC6.7 @cp:pre-deploy
 *
 *   node qa/security/no-token-in-storage.qa.mjs
 *
 * The access and refresh tokens (`pulse_at` / `pulse_rt`) are HttpOnly cookies,
 * set and cleared by the backend, and are never meant to be readable by page
 * JavaScript — that HttpOnly property is what stops an XSS from exfiltrating the
 * session. The browser-side half of that invariant is: the frontend must never
 * copy a credential token into localStorage/sessionStorage, and must never read
 * it out of document.cookie. Phase-2 confirmed neither happens; this gate pins
 * it, so a "let me just cache the token in localStorage" change reddens here.
 *
 * (The full "document.cookie cannot see pulse_at" proof needs a live browser and
 * is exercised in phase-2; this static gate guards the code half that a
 * regression would land in.)
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'src');
const SKIP = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);
const CODE = /\.(m|c)?[jt]sx?$/;

// A credential token by any of the names this system uses. NOT ms_oauth_state
// (an OAuth CSRF nonce, not a credential) nor app keys like analysisDraftID.
const CREDENTIAL = /(pulse_at|pulse_rt|access[_-]?token|accesstoken|refresh[_-]?token|refreshtoken|\bid_token\b|\bbearer\b|\bjwt\b|authorization)/i;
const STORAGE = /(local|session)Storage\s*\.\s*(set|get|remove)Item\s*\(/i;
const COOKIE = /document\s*\.\s*cookie/i;

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (SKIP.has(e)) continue;
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (CODE.test(e)) out.push(p);
  }
  return out;
}

if (!existsSync(SRC)) { console.log(`no-token-in-storage: src/ not found at ${SRC}`); process.exit(1); }
const files = walk(SRC);
if (!files.length) { console.log('no-token-in-storage: scanned 0 source files — the walker is blind, fix it'); process.exit(1); }

const offenders = [];
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const stores = STORAGE.test(line) && CREDENTIAL.test(line);
    const reads = COOKIE.test(line) && CREDENTIAL.test(line);
    if (stores || reads) offenders.push(`${relative(ROOT, f)}:${i + 1}: ${line.trim()}`);
  });
}

console.log(`no-token-in-storage: scanned ${files.length} source file(s) for a credential token in localStorage/sessionStorage/document.cookie`);
if (offenders.length) {
  console.log(`\n${offenders.length} place(s) put a credential token where JS (and an XSS) can read it:`);
  offenders.forEach(o => console.log('  ' + o));
  console.log('\nThe session lives in HttpOnly cookies the server owns — never mirror it into JS storage.');
  process.exit(1);
}
console.log('\nno credential token in JS storage — the session stays in HttpOnly cookies');
