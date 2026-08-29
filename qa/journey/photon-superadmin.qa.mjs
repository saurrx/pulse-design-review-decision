/**
 * Superadmin loop: unbounded reach, and no client scope.
 * @tier:journey @role:PHOTON_SUPERADMIN @area:clients @area:patents @area:actions @sec:authz @sec:tenant-isolation @soc2:CC6.1 @cp:smoke @cp:post-deploy
 *
 *   node qa/journey/photon-superadmin.qa.mjs [--base https://demo.photonpulse.ai]
 *
 * READ-ONLY.
 *
 * The sixth role was declared in qa/contract.json from day one and had no
 * account and no test — so "6 roles" was a claim the suite never checked. It
 * has no screens of its own (the schema says so outright: "Founders / S-team.
 * Unbounded. No screens yet"), which is exactly why it needs a tier: a role
 * with no bespoke UI falls through to somebody else's, and the interesting
 * question is whether the *data* boundary follows it there.
 *
 * What is asserted is the thing that distinguishes the tier, not the pixels:
 *
 * 1. The session carries NO client scope. A Photon-side user with a client_id
 *    would quietly gain that client's rows — the `user_client_matches_role`
 *    CHECK in rls.sql exists for this, and this is its end-to-end witness.
 * 2. Reach is unbounded and strictly a superset of a scoped role's. Asserted
 *    against a live comparison with LEGAL_COUNSEL rather than a hardcoded
 *    count, so it keeps meaning something as demo data changes.
 * 3. The docket is readable — the capability F-026 introduced (`docket:read`)
 *    must not have locked out the one role that holds every capability.
 */
import { chromium } from 'playwright';
import { openSession, APP } from '../lib/session.mjs';
import { Journey, assert, assertPageContains } from '../lib/journey.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i === -1 ? d : process.argv[i + 1]; };
const BASE = arg('base', APP);

const browser = await chromium.launch();
const session = await openSession(browser, 'PHOTON_SUPERADMIN', { base: BASE });
if (!session) {
  console.log('### PHOTON_SUPERADMIN: LOGIN FAILED (throttle is 5/5min/IP — wait, or reuse qa/.sessions)');
  await browser.close();
  process.exit(1);
}
const { page } = session;
const j = new Journey('PHOTON_SUPERADMIN unbounded reach');
console.log(`  (session ${session.reused ? 'reused' : 'fresh login'})`);

const totalOf = (body) =>
  body?.pagination?.total ?? (Array.isArray(body) ? body.length : null);

try {
  let clients = 0;
  let patents = 0;

  await j.step('the session is Photon-side and carries no client scope', async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    const r = await page.request.get(`${BASE}/v1/auth/me`, { headers: { 'x-requested-with': 'XMLHttpRequest' } });
    assert(r.status() === 200, `GET /v1/auth/me returned ${r.status()}`);
    const me = await r.json();
    assert(me.role === 'PHOTON_SUPERADMIN', `expected PHOTON_SUPERADMIN, session says ${me.role}`);
    const scope = me.client_id ?? me.clientId ?? null;
    assert(scope === null,
      `a Photon-side session must carry no client_id — this one carries ${scope}, ` +
      'which would silently grant that client\'s rows');
    assert((me.assigned_client_ids ?? []).length === 0,
      'a superadmin reaches every client by role, not by assignment rows');
    return 'role PHOTON_SUPERADMIN, client_id null, no assignments';
  });

  await j.step('reach spans every client, not one tenant', async () => {
    const r = await page.request.get(`${BASE}/v1/clients`, { headers: { 'x-requested-with': 'XMLHttpRequest' } });
    assert(r.status() === 200, `GET /v1/clients returned ${r.status()}`);
    clients = totalOf(await r.json());
    assert(clients > 1,
      `a superadmin saw ${clients} client(s) — unbounded reach cannot be demonstrated against one tenant`);
    return `${clients} clients`;
  });

  await j.step('the portfolio is the whole corpus', async () => {
    const r = await page.request.get(`${BASE}/v1/patents?limit=1`, { headers: { 'x-requested-with': 'XMLHttpRequest' } });
    assert(r.status() === 200, `GET /v1/patents returned ${r.status()}`);
    patents = totalOf(await r.json());
    assert(patents > 0, 'an empty portfolio would make the superset claim below vacuous');
    return `${patents} patents`;
  });

  await j.step('the docket is readable — docket:read did not lock out the founder', async () => {
    // F-026 introduced `docket:read` and withheld it from INVENTOR. The role
    // that holds EVERY capability must still be able to read the docket; this
    // is the other side of that change.
    const r = await page.request.get(`${BASE}/v1/actions?limit=1`, { headers: { 'x-requested-with': 'XMLHttpRequest' } });
    assert(r.status() === 200,
      `GET /v1/actions returned ${r.status()} for a role holding every capability`);
    const n = totalOf(await r.json());
    assert(n > 0, 'an empty docket hides a broken row map (CLAUDE.md §6)');
    return `${n} docket rows`;
  });

  await j.step('reach is a strict superset of a client-scoped role', async () => {
    // Compared live rather than against a constant: the claim is "more than a
    // tenant sees", which stays true as the demo data moves.
    const scoped = await openSession(browser, 'LEGAL_COUNSEL', { base: BASE });
    assert(scoped, 'could not open a LEGAL_COUNSEL session to compare against');
    try {
      const r = await scoped.page.request.get(`${BASE}/v1/patents?limit=1`, { headers: { 'x-requested-with': 'XMLHttpRequest' } });
      assert(r.status() === 200, `scoped GET /v1/patents returned ${r.status()}`);
      const theirs = totalOf(await r.json());
      assert(patents > theirs,
        `superadmin saw ${patents} patents and a client-scoped role saw ${theirs} — ` +
        'the superadmin must see strictly more, or the tenant fence is leaking the other way');
      return `${patents} > ${theirs}`;
    } finally {
      await scoped.close();
    }
  });

  await j.step('the client book actually opens — no silent redirect', async () => {
    // Asserting page TEXT here is not enough and the first version of this
    // step proved it: the dashboard also contains the word "Clients", so a
    // redirect to / passed a /Clients/ check while the role never reached the
    // screen. The landed URL is the only honest evidence.
    await page.goto(`${BASE}/clients`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    const landed = new URL(page.url()).pathname;
    assert(landed === '/clients',
      `/clients redirected to ${landed} for a role holding EVERY capability. The API serves it ` +
      '82 clients; the UI gates on an allow-list naming PHOTON_ADMIN and drops the founder into ' +
      'the deny branch (F-028)');
    await assertPageContains(page, /Clients/, 'the client book must render once it opens');
    return `landed on ${landed}`;
  });

} finally {
  await session.close();
  await browser.close();
}

const failed = j.summary();
process.exit(failed ? 1 : 0);
