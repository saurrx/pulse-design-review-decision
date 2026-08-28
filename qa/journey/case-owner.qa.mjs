/**
 * Case owner loop: assigned clients only, and the Photon operations queue.
 * @tier:journey @role:CASE_OWNER @area:clients @area:actions @sec:tenant-isolation @soc2:CC6.1 @cp:smoke @cp:post-deploy
 *
 *   node qa/journey/case-owner.qa.mjs [--base https://demo.photonpulse.ai]
 *
 * READ-ONLY. The two claims are:
 *
 * 1. A case owner sees ONLY assigned clients. This is asserted against the
 *    live `assigned_client_ids` in the session, not against a hardcoded name,
 *    so it keeps meaning something when the demo's assignments change — and it
 *    fails both ways: an extra card is a leak, a missing card is a regression.
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

  await j.step('/clients shows exactly the assigned clients, no more', async () => {
    await page.goto(`${BASE}/clients`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await assertPageContains(page, /Clients/, '/clients must render for a case owner');
    // The client cards are the clickable tiles in the grid; count them rather
    // than trusting a name, and compare against the session's own list.
    const cards = page.locator('[class*="cursor-pointer"]').filter({ hasText: /Updated/ });
    const n = await cards.count();
    assert(n === assigned.length,
      `case owner is assigned ${assigned.length} client(s) but /clients rendered ${n} card(s) — ` +
      (n > assigned.length ? 'that is a cross-tenant leak' : 'an assigned client is missing'));
    return `${n} card(s) === ${assigned.length} assignment(s)`;
  });

  await j.step('opening a client card lands on an ASSIGNED client', async () => {
    await page.locator('[class*="cursor-pointer"]').filter({ hasText: /Updated/ }).first().click();
    const url = await assertUrl(page, /\/clients\/[0-9a-f-]{36}/, 'a client card must open that client');
    const id = /\/clients\/([0-9a-f-]{36})/.exec(url)[1];
    assert(assigned.includes(id),
      `opened client ${id}, which is not in the session's assigned_client_ids ${JSON.stringify(assigned)}`);
    await assertPageContains(page, /Patent portfolio|Client details/,
      'the client record must render its detail, not an empty shell');
    return `client ${id} is assigned`;
  });

  await j.step('a case owner cannot grant access', async () => {
    // Granting is PHOTON_ADMIN's; the case owner's client page must not offer
    // the case-owner reassignment control.
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
