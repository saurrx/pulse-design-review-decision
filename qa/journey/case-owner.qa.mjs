/**
 * Case owner loop: the whole client roster, fenced on writes, plus the queue.
 * @tier:journey @role:CASE_OWNER @area:clients @area:actions @sec:tenant-isolation @soc2:CC6.1 @cp:smoke @cp:post-deploy
 *
 *   node qa/journey/case-owner.qa.mjs [--base https://demo.photonpulse.ai]
 *
 * READ-ONLY. The two claims are:
 *
 * 1. A case owner READS every client and WRITES only where assigned
 *    (pulse-backend F-079, 2026-09-03). Until then this file asserted the
 *    opposite — card count === assigned_client_ids.length, an extra card being
 *    "a cross-tenant leak". That is no longer the product, so the check moved
 *    rather than being deleted: the roster is now expected to be WIDER than the
 *    assignments, and the fence is asserted where it now lives — on an
 *    UNASSIGNED client's page, which must offer "Request access" and neither
 *    "View as client" nor "Edit client". Everything is still measured against
 *    the live session, never a hardcoded name.
 * 2. The Photon operations queue renders REAL rows. The queue's row map reads
 *    fields out of a nested shape and threw on its first real row while the
 *    table was empty; asserting a non-empty queue is what makes that
 *    detectable (CLAUDE.md §6: an empty table hides broken code).
 */
import { chromium } from 'playwright';
import { openSession, APP } from '../lib/session.mjs';
import { Journey, assert, assertUrl, assertPageContains } from '../lib/journey.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i === -1 ? d : process.argv[i + 1]; };
const BASE = arg('base', APP);

const browser = await chromium.launch();
const session = await openSession(browser, 'CASE_OWNER', { base: BASE });
if (!session) {
  console.log('### CASE_OWNER: LOGIN FAILED (throttle is 5/5min/IP — wait, or reuse qa/.sessions)');
  await browser.close();
  process.exit(1);
}
const { page } = session;
const j = new Journey('CASE_OWNER assignment + operations loop');
console.log(`  (session ${session.reused ? 'reused' : 'fresh login'})`);

try {
  let assigned = [];

  await j.step('the session carries a bounded client assignment', async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    const r = await page.request.get(`${BASE}/v1/auth/me`, { headers: { 'x-requested-with': 'XMLHttpRequest' } });
    assert(r.status() === 200, `GET /v1/auth/me returned ${r.status()}`);
    const me = await r.json();
    assert(me.role === 'CASE_OWNER', `expected CASE_OWNER, session says ${me.role}`);
    assigned = me.assigned_client_ids ?? [];
    assert(assigned.length > 0,
      'this case owner is assigned no clients — the isolation claim below would be vacuously true');
    return `${assigned.length} assigned client id(s)`;
  });

  let roster = [];

  await j.step('/clients shows the whole roster, wider than the assignments', async () => {
    await page.goto(`${BASE}/clients`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await assertPageContains(page, /Clients/, '/clients must render for a case owner');
    // Read the ids off the cards rather than counting tiles: the next two steps
    // need to pick an assigned and an unassigned one, and a count cannot.
    roster = await page.evaluate(() =>
      [...document.querySelectorAll('[class*="cursor-pointer"]')]
        .map(el => /\/clients\/([0-9a-f-]{36})/.exec(el.getAttribute('href') || el.dataset.href || '')?.[1])
        .filter(Boolean));
    if (!roster.length) {
      // The cards carry no href — they are divs with an onClick — so fall back
      // to the API the page renders from. `/v1`, NOT `/api/v1`: the `/api`
      // prefix is the legacy dialect that realAdapter rewrites in the browser,
      // so a raw fetch to it lands on the SPA's index.html and parses as
      // "Unexpected token '<'". Same session and same fence either way, so this
      // still measures the server rather than the DOM.
      roster = await page.evaluate(async () => {
        const r = await fetch('/v1/clients?limit=0', { credentials: 'include' });
        if (!r.ok) return [];
        const j = await r.json();
        const rows = Array.isArray(j) ? j : (j?.clients ?? j?.data?.clients ?? j?.data ?? []);
        return (Array.isArray(rows) ? rows : []).map(c => c.id).filter(Boolean);
      });
    }
    assert(roster.length > 0, '/clients rendered no clients at all for a case owner');
    // The widening itself. If the demo ever assigns this case owner EVERY
    // client the claim becomes vacuous, so say so rather than passing.
    assert(roster.length > assigned.length,
      `case owner sees ${roster.length} client(s) and is assigned ${assigned.length} — ` +
      (roster.length === assigned.length
        ? 'the roster is not wider than the assignments, so either the F-079 widening regressed ' +
          'or this demo case owner is assigned every client and the check below proves nothing'
        : 'fewer clients than assignments, which is a regression'));
    return `${roster.length} client(s) visible, ${assigned.length} assigned`;
  });

  await j.step('an ASSIGNED client opens with the full controls', async () => {
    await page.goto(`${BASE}/clients/${assigned[0]}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await assertUrl(page, /\/clients\/[0-9a-f-]{36}/, 'an assigned client must not redirect');
    await assertPageContains(page, /Patent portfolio|Client details/,
      'the client record must render its detail, not an empty shell');
    const viewAs = await page.getByRole('button', { name: /View as client/i }).count();
    assert(viewAs > 0, 'an ASSIGNED client offers no "View as client" — the assignment buys nothing');
    return `client ${assigned[0]} opens with View as client`;
  });

  await j.step('an UNASSIGNED client opens READ-ONLY — the write fence', async () => {
    const other = roster.find(id => !assigned.includes(id));
    assert(other,
      'every visible client is assigned to this case owner, so the read/write split cannot be ' +
      'measured here — assign fewer clients to the demo case owner');
    await page.goto(`${BASE}/clients/${other}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    // It must ARRIVE. Before F-079 this redirected to /clients.
    await assertUrl(page, new RegExp(`/clients/${other}`),
      'an unassigned client redirected away — the F-079 read widening has regressed');
    await assertPageContains(page, /Patent portfolio|Client details/,
      'the unassigned client record rendered an empty shell rather than its detail');
    // And it must be READ-ONLY. These three are the fence; any one of them
    // appearing means the assignment has stopped meaning anything.
    const request = await page.getByRole('button', { name: /Request access/i }).count();
    assert(request > 0, 'an unassigned client offers no "Request access" — the audited grant flow is gone');
    for (const [name, re] of [['View as client', /View as client/i], ['Edit client', /Edit client/i]]) {
      const n = await page.getByRole('button', { name: re }).count();
      assert(n === 0, `an UNASSIGNED client offers "${name}" — the write fence is open`);
    }
    return `client ${other} is read-only, with Request access`;
  });

  await j.step('a case owner cannot grant access', async () => {
    // Granting is PHOTON_ADMIN's; the case owner's client page must not offer
    // the case-owner reassignment control. Still true on either kind of client.
    const change = await page.getByRole('button', { name: /^Change$/ }).count();
    assert(change === 0, 'the client page offers a case owner the "Change" (reassign case owner) control');
    return 'no reassignment control';
  });

  await j.step('the operations queue renders real instructions', async () => {
    await page.goto(`${BASE}/actions`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const table = page.locator('table').first();
    for (const header of [/Application No\./, /Client/, /Action Selected/, /Request Status/]) {
      await assertPageContains(page, header, `the operations queue must have a ${header} column`);
    }
    const n = await table.locator('tbody tr').count();
    assert(n > 0,
      'the Photon operations queue rendered zero rows — the row map never ran, which is exactly how ' +
      'it shipped broken before');
    const first = (await table.locator('tbody tr').first().innerText()).replace(/\s+/g, ' ');
    assert(/\d{6,}/.test(first), `queue row shows no application number: "${first.slice(0, 140)}"`);
    assert(/(New|Acknowledged|In Progress|Completed|Declined)/i.test(first),
      `queue row shows no request status: "${first.slice(0, 140)}"`);
    return `${n} instruction(s), first row: "${first.slice(0, 90)}"`;
  });
} finally {
  await session.close();
  await browser.close();
}

const failed = j.summary();
process.exit(failed ? 1 : 0);
