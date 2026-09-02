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
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
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


// ---------------------------------------------------------------------------
// The screens' half: HOW they start a social sign-in, asserted statically.
//
// Microsoft on this API is a server-side redirect flow — GET /v1/auth/microsoft
// sets the state cookie, redirects, and exchanges the code with the client
// secret. The screens used to run their OWN authorize flow in the browser
// against the **/common** tenant and POST the result to social-login. Two
// problems, both of which the adapter half above cannot see: /common accepts an
// assertion from ANY Microsoft directory (the exact posture microsoft.service.ts
// refuses server-side), and a browser cannot hold a client secret, so the
// exchange could never have completed anyway.
import { readdirSync as rd } from 'node:fs';
const AUTH = join(ROOT, 'src', 'pages', 'auth');
for (const f of rd(AUTH).filter(x => x.endsWith('.tsx') && x !== 'AuthField.tsx')) {
  const src = readFileSync(join(AUTH, f), 'utf8');
  check(`${f}: no browser-side Microsoft authorize flow`, () => {
    if (/login\.microsoftonline\.com/.test(src)) {
      throw new Error('runs its own authorize flow instead of GET /v1/auth/microsoft');
    }
    if (/VITE_MS_CLIENT_ID/.test(src)) {
      throw new Error('reads VITE_MS_CLIENT_ID — the browser has no business holding the client id for this flow');
    }
  });
  if (/microsoftLogin/.test(src)) {
    check(`${f}: the Microsoft button hands off to the API`, () => {
      if (!/["'`]\/v1\/auth\/microsoft["'`]/.test(src)) {
        throw new Error('does not navigate to /v1/auth/microsoft');
      }
    });
    check(`${f}: the callback's ?error= is surfaced`, () => {
      if (!/searchParams\.get\("error"\)/.test(src)) {
        throw new Error('ignores ?error= — a failed sign-in returns to a silent login form');
      }
    });
  }
}


// ---------------------------------------------------------------------------
// SSO. The hand-off must be a NAVIGATION to the API's own route, and the round
// trip must land on a route that actually exists — a SAML callback the router
// does not know about is a 404 holding a valid session nobody reads.
{
  const app = readFileSync(join(ROOT, 'src', 'App.tsx'), 'utf8');
  const panel = readFileSync(join(AUTH, 'SsoPanel.tsx'), 'utf8');
  const cb = readFileSync(join(AUTH, 'SamlCallback.tsx'), 'utf8');
  const access = readFileSync(join(AUTH, 'ssoAccess.ts'), 'utf8');

  check('sso: the hand-off is a full-page navigation to the API route', () => {
    if (!/window\.location\.href\s*=\s*SSO_START_URL/.test(panel)) {
      throw new Error('does not navigate; an XHR cannot follow the IdP redirect or receive the state cookie');
    }
    if (!/["']\/v1\/auth\/saml\/login["']/.test(access)) {
      throw new Error('SSO_START_URL is not /v1/auth/saml/login');
    }
  });

  check('sso: the same-origin path is preserved', () => {
    // An absolute API URL here would set the session cookie on the API host,
    // where the app cannot read it. Same constraint as the ACS URL.
    if (/https?:\/\//.test(/SSO_START_URL\s*=\s*"([^"]*)"/.exec(access)?.[1] ?? '')) {
      throw new Error('SSO_START_URL is absolute — the session cookie would land on the wrong origin');
    }
  });

  check('sso: the callback route exists', () => {
    if (!/path="\/auth\/saml\/callback"/.test(app)) {
      throw new Error('no /auth/saml/callback route — the IdP round trip would 404');
    }
  });

  check('sso: the callback writes the readable session cookie', () => {
    if (!/Cookies\.set\("pl_user"/.test(cb)) {
      throw new Error('does not write pl_user — the app would not know who signed in');
    }
    if (!/\/api\/v1\/auth\/session/.test(cb)) {
      throw new Error('does not read the session back; SAML has no login response to read it from');
    }
  });

  check('sso: the failure redirect lands on a param Login actually reads', () => {
    const login = readFileSync(join(AUTH, 'Login.tsx'), 'utf8');
    // Collect every ?param= the SSO code redirects to /login with, and require
    // Login to read each one. The callback used ?sso_error=1 while Login read
    // only ?error= — a failed sign-in returned to a silent form.
    const params = new Set();
    for (const src of [cb, access, panel]) {
      for (const m of src.matchAll(/\/login\?([a-z_]+)=/g)) params.add(m[1]);
    }
    for (const p of params) {
      if (!new RegExp(`searchParams\\.get\\("${p}"\\)`).test(login)) {
        throw new Error(`redirects to /login?${p}= but Login never reads it`);
      }
    }
  });

  check('sso: the allowlist is not treated as authorisation', () => {
    if (!/UX guardrail/i.test(access)) {
      throw new Error('ssoAccess.ts must say plainly that it authorises nobody');
    }
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
