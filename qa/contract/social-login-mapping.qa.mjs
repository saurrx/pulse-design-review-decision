/**
 * The social-login rule must forward the credential the screens actually send,
 * and must not route one provider's secret to another provider's verifier.
 * @tier:contract @area:auth @sec:authn @cp:pre-deploy
 *
 *   node qa/contract/social-login-mapping.qa.mjs
 *
 * Named after a real, shipped bug. Both auth screens post the OLD API's shape,
 * `{platform_type, code}`, where `code` is polymorphic — a Google ACCESS token,
 * or a Microsoft authorization code the old server exchanged. The adapter rule
 * read `access_token ?? googleAccessToken ?? token` and never `code`, so it
 * forwarded `{access_token: undefined}` and every Google sign-in came back 400
 * "A Google credential or access token is required". It also ignored
 * `platform_type` completely, which handed a Microsoft authorization code to
 * the GOOGLE token verifier.
 *
 * Neither `adapter-coverage` nor the generated map could see any of this: both
 * ask "is this rule reached?", and it was — with an empty body.
 *
 * This drives the REAL adapter rather than grepping it: esbuild transpiles
 * realAdapter.ts (its only runtime import is js-cookie) and the rule is
 * exercised through a stub axios that records the outgoing request. A
 * source-text assertion would pass against a rule that reads the right key and
 * still sends the wrong thing.
 */
import { build } from 'esbuild';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'qa', '.adapter-build');

// js-cookie touches document at call time; the login rules write pl_user.
globalThis.document = { cookie: '' };

mkdirSync(OUT, { recursive: true });
await build({
  entryPoints: [join(ROOT, 'src', 'lib', 'realAdapter.ts')],
  outfile: join(OUT, 'realAdapter.mjs'),
  format: 'esm',
  platform: 'node',
  target: 'node20',
  bundle: true,
  packages: 'external',
  logLevel: 'silent',
});
const { makeRealAdapter } = await import(pathToFileURL(join(OUT, 'realAdapter.mjs')).href);

/** A stub axios that records what the adapter tried to send. */
function stub(response = { user: { id: 'u1', email: 'a@b.c', role: 'INVENTOR' } }) {
  const sent = [];
  const real = {
    request: async (cfg) => { sent.push(cfg); return { status: 200, data: response }; },
    interceptors: { request: { use() {} }, response: { use() {} } },
    defaults: {},
  };
  return { api: makeRealAdapter(real), sent };
}

const failures = [];
const check = (name, fn) => {
  try { fn(); console.log(`  ok   ${name}`); }
  catch (e) { failures.push(`${name}: ${e.message}`); console.log(`  FAIL ${name} — ${e.message}`); }
};
const eq = (actual, expected, what) => {
  if (actual !== expected) throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

console.log('social-login mapping\n');

// 1. THE BUG. The screens send the Google access token under `code`.
{
  const { api, sent } = stub();
  const res = await api.post('/api/v1/auth/social-login', {
    platform_type: 'google',
    code: 'ya29.a0-google-access-token',
  });
  check('google: the credential reaches the API', () => {
    eq(sent.length, 1, 'requests issued');
    eq(sent[0].url, '/v1/auth/google', 'target');
    eq(sent[0].method, 'POST', 'method');
    eq(sent[0].data?.access_token, 'ya29.a0-google-access-token', 'access_token');
  });
  check('google: the response is wrapped as call sites read it', () => {
    eq(res.data?.data?.user?.email, 'a@b.c', 'data.data.user.email');
  });
}

// 2. The older explicit shapes must keep working.
for (const key of ['access_token', 'googleAccessToken', 'token']) {
  const { api, sent } = stub();
  await api.post('/api/v1/auth/social-login', { platform_type: 'google', [key]: 'T-' + key });
  check(`google: \`${key}\` still forwarded`, () => {
    eq(sent[0].data?.access_token, 'T-' + key, 'access_token');
  });
}

// 3. A Microsoft code must never reach the Google verifier.
{
  const { api, sent } = stub();
  let threw = null;
  try {
    await api.post('/api/v1/auth/social-login', { platform_type: 'microsoft', code: 'ms-auth-code' });
  } catch (e) { threw = e; }
  check('microsoft: not routed to the google verifier', () => {
    const hitGoogle = sent.some(r => r.url === '/v1/auth/google');
    if (hitGoogle) throw new Error('a microsoft authorization code was POSTed to /v1/auth/google');
    if (!threw) throw new Error('expected a named failure, got a silent pass');
  });
}

rmSync(OUT, { recursive: true, force: true });

console.log();
if (failures.length) {
  console.error(`social-login mapping: ${failures.length} failure(s)\n`);
  failures.forEach(f => console.error('  ' + f));
  process.exit(1);
}
console.log('the credential the screens send is the credential the API receives');
