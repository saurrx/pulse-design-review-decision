/**
 * File uploads leave the browser SAME-ORIGIN. @area:files @tier:security @sec:upload @soc2:CC6.6 @cp:pre-deploy
 *
 *   node qa/security/upload-same-origin.qa.mjs
 *
 * The app used to PUT file bytes straight at a presigned DigitalOcean Spaces
 * URL. That is cross-origin, and it needs two things this deployment has never
 * had:
 *
 *   1. a CORS rule on the bucket. Measured 2026-09-01: an OPTIONS preflight
 *      from https://demo.photonpulse.ai returned 403 AccessDenied with no
 *      Access-Control-Allow-Origin, for every origin tried. Nothing in these
 *      repos can fix that — a scoped Spaces key cannot call PutBucketCors, so
 *      it needs the DigitalOcean control panel.
 *   2. a `connect-src` entry for the bucket host in vercel.json's CSP, which
 *      did not exist, so the browser refused the connection before it could
 *      even discover (1).
 *
 * Every upload in the product therefore failed — portfolio imports, idea
 * attachments, client logos — surfacing as the generic "An error occurred while
 * uploading the file", because a CSP block yields an Error with no HTTP
 * response for onError to read. See pulse-backend docs/qa/findings.md F-062.
 *
 * The transport is now `PUT /v1/files/:id/content`, proxied on this origin like
 * every other /v1 call. This gate pins BOTH halves of that, because either one
 * alone silently reopens the hole:
 *
 *   (a) no upload path dials an absolute storage URL, and
 *   (b) the CSP still needs no storage host — if a connect-src entry for one
 *       appears, something went back to uploading cross-origin.
 *
 * Proved to bite: restoring `fetch(p.put_url, { method: "PUT" })` fails (a), and
 * adding the bucket host to connect-src fails (b).
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'src');
const SKIP = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);
const CODE = /\.(m|c)?[jt]sx?$/;

/** Object-storage hosts, by the shapes their URLs actually take. */
const STORAGE_HOST =
  /(digitaloceanspaces\.com|\.s3[.-][a-z0-9-]*\.amazonaws\.com|\bs3\.amazonaws\.com|blob\.core\.windows\.net|storage\.googleapis\.com)/i;

/**
 * The presigned URL, referenced at all.
 *
 * Deliberately not "fetch(...put_url)": the first version of this gate matched
 * the call shape and missed `fetch((p as any).put_url, …)` because the cast's
 * own bracket broke the pattern — a planted violation walked straight past it.
 * The frontend has no legitimate use for a presigned storage URL any more, so
 * the name itself is the signal, and there is nothing left for a regex to get
 * subtly wrong.
 */
const DIRECT_PUT = /\bput_url\b/;

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

if (!existsSync(SRC)) { console.log(`upload-same-origin: src/ not found at ${SRC}`); process.exit(1); }
const files = walk(SRC);
if (!files.length) { console.log('upload-same-origin: scanned 0 source files — the walker is blind, fix it'); process.exit(1); }

const offenders = [];
for (const f of files) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (line.trim().startsWith('*') || line.trim().startsWith('//')) return;   // prose about the bug
    if (STORAGE_HOST.test(line) || DIRECT_PUT.test(line)) {
      offenders.push(`${relative(ROOT, f)}:${i + 1}: ${line.trim()}`);
    }
  });
}

// (b) the CSP must still not need a storage host.
const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
const csp = vercel.headers
  ?.flatMap(h => h.headers ?? [])
  ?.find(h => h.key?.toLowerCase() === 'content-security-policy')?.value ?? '';
if (!csp) { console.log('upload-same-origin: no Content-Security-Policy in vercel.json — nothing to check, fix that first'); process.exit(1); }
const connectSrc = (csp.split(';').map(s => s.trim()).find(s => s.startsWith('connect-src')) ?? '');
const cspOffender = STORAGE_HOST.test(connectSrc) ? connectSrc : null;

// The upload helper must actually name the same-origin route, or this gate
// passes vacuously the day someone deletes the upload entirely.
const helper = readFileSync(join(ROOT, 'src/lib/api-service/s3Upload.ts'), 'utf8');
const usesRoute = /\/v1\/files\/\$\{[^}]+\}\/content/.test(helper);

console.log(`upload-same-origin: scanned ${files.length} source file(s); connect-src has ${connectSrc.split(/\s+/).length - 1} source(s)`);

let failed = false;
if (offenders.length) {
  failed = true;
  console.log(`\n${offenders.length} place(s) send bytes to object storage directly:`);
  offenders.forEach(o => console.log('  ' + o));
}
if (cspOffender) {
  failed = true;
  console.log(`\nconnect-src names an object-storage host:\n  ${cspOffender}`);
  console.log('An upload that needs one is cross-origin again, and needs bucket CORS nobody here can set.');
}
if (!usesRoute) {
  failed = true;
  console.log('\ns3Upload.ts no longer PUTs to /v1/files/:id/content — the same-origin transport is gone.');
}
if (failed) {
  console.log('\nUploads go through the API on this origin. See pulse-backend findings.md F-062.');
  process.exit(1);
}
console.log('\nuploads stay on this origin — no bucket CORS and no CSP exception needed');
