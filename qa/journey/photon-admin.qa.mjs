/**
 * Photon admin loop: the whole client book, a client record, and view-as.
 * @tier:journey @role:PHOTON_ADMIN @area:clients @area:workspace @sec:authz @soc2:CC6.1 @soc2:CC6.3 @cp:smoke @cp:post-deploy
 *
 *   node qa/journey/photon-admin.qa.mjs [--base https://demo.photonpulse.ai]
 *
 * View-as IS a write in one sense — it swaps the session's identity server
 * side and is audit-logged — but it is reversible, and leaving it half-done is
 * the real hazard: the cached storageState in qa/.sessions would then hold a
 * CLIENT session under the admin's filename and every later run would quietly
 * test the wrong role. So the teardown exits client view whatever happened,
 * and if it cannot, it DELETES the cached session so the next run is forced to
 * log in fresh rather than inherit a poisoned identity.
 *
 * Nothing else here mutates: the clients list, the client record and the
 * onboarding affordance are asserted, never submitted.
 */
import { chromium } from 'playwright';
import { unlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSession, APP } from '../lib/session.mjs';
import { Journey, assert, assertUrl, assertPageContains } from '../lib/journey.mjs';

const QA = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i === -1 ? d : process.argv[i + 1]; };
const BASE = arg('base', APP);

const browser = await chromium.launch();
const session = await openSession(browser, 'PHOTON_ADMIN', { base: BASE });
if (!session) {
  console.log('### PHOTON_ADMIN: LOGIN FAILED (throttle is 5/5min/IP — wait, or reuse qa/.sessions)');
  await browser.close();
  process.exit(1);
}
const { page } = session;
const j = new Journey('PHOTON_ADMIN client book + view-as loop');
console.log(`  (session ${session.reused ? 'reused' : 'fresh login'})`);

const plUser = async () => {
  const raw = await page.evaluate(() => document.cookie.match(/pl_user=([^;]+)/)?.[1] ?? '');
  return raw ? JSON.parse(decodeURIComponent(raw)) : {};
};
const cards = () => page.locator('[class*="cursor-pointer"]').filter({ hasText: /Updated/ });

let enteredClientMode = false;
let clientName = null;

try {
  await j.step('/clients is the whole client book, with onboarding', async () => {
    await page.goto(`${BASE}/clients`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const n = await cards().count();
    assert(n > 1, `the admin client book rendered ${n} card(s) — an admin sees every client, not an assignment`);
    assert(await page.getByRole('button', { name: /Onboard a client/i }).isVisible(),
      'the admin client book does not offer "Onboard a client"');
    return `${n} clients + Onboard a client`;
  });

  let clientId = null;
  await j.step('a client record opens with its portfolio and its team', async () => {
    clientName = (await cards().first().locator('h3, h2, [class*="font-semibold"]').first().innerText()).trim();
    await cards().first().click();
    const url = await assertUrl(page, /\/clients\/[0-9a-f-]{36}/, 'a client card must open that client record');
    clientId = /\/clients\/([0-9a-f-]{36})/.exec(url)[1];
    await assertPageContains(page, /Patent portfolio/, 'the client record must show the portfolio');
    await assertPageContains(page, /Client details/, 'the client record must show the client details block');
    await assertPageContains(page, /Client team/, 'the client record must show the client team');
    // Admin-only affordance: reassigning the case owner.
    assert(await page.getByRole('button', { name: /^Change$/ }).count() > 0,
      'the admin is not offered the case-owner reassignment control');
    return `${clientId} (${clientName})`;
  });

  await j.step('view-as asks before switching identity', async () => {
    await page.getByRole('button', { name: /View as client/i }).click();
    await page.waitForTimeout(1500);
    const dialog = page.locator('[role="alertdialog"], [role="dialog"]').first();
    assert(await dialog.isVisible().catch(() => false),
      'View as client switched identity with no confirmation at all');
    const text = (await dialog.innerText()).replace(/\s+/g, ' ');
    assert(/Enter Client Mode/i.test(text), `the confirmation is not the client-mode dialog: "${text.slice(0, 120)}"`);
    assert(/logged for audit/i.test(text), 'the client-mode dialog does not state that actions are audit-logged');
    return 'Enter Client Mode dialog, audit notice present';
  });

  await j.step('proceeding puts the admin inside the client workspace', async () => {
    await page.getByRole('button', { name: /^Proceed$/ }).click();
    enteredClientMode = true;
    await assertUrl(page, new RegExp(`^${BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/$`),
      'entering client mode must land on the client dashboard');
    await page.waitForTimeout(3000);
    const u = await plUser();
    assert(u.view_as === true, `pl_user.view_as is ${JSON.stringify(u.view_as)}, expected true`);
    assert(u.actual_role === 'PHOTON_ADMIN',
      `the real actor was lost: actual_role is ${u.actual_role}, expected PHOTON_ADMIN`);
    assert(u.role !== 'PHOTON_ADMIN', 'inside client mode the presented role is still PHOTON_ADMIN');
    const mode = await page.evaluate(() => sessionStorage.getItem('pl_client_mode'));
    assert(mode === 'true', `sessionStorage pl_client_mode is ${mode}, expected "true"`);
    await assertPageContains(page, new RegExp(u.organization_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      'the client workspace does not name the client being viewed');
    return `presenting as ${u.role} at ${u.organization_name}, real actor kept`;
  });

  await j.step('the user menu offers the way back out', async () => {
    await page.locator('button[aria-haspopup="menu"]').last().click();
    await page.waitForTimeout(1200);
    const items = await page.getByRole('menuitem').allInnerTexts();
    assert(items.some(t => /Exit client view/i.test(t)),
      `no exit from client view in the user menu (saw ${JSON.stringify(items)})`);
    return `menu: ${items.map(t => t.trim()).join(' · ')}`;
  });

  await j.step('exiting restores the admin identity', async () => {
    await page.getByRole('menuitem', { name: /Exit client view/i }).click();
    await assertUrl(page, /\/clients$/, 'exiting client view must land back on the client book');
    await page.waitForTimeout(2500);
    const u = await plUser();
    assert(u.role === 'PHOTON_ADMIN', `after exit pl_user.role is ${u.role}, expected PHOTON_ADMIN`);
    assert(!u.view_as, 'after exit pl_user still carries view_as');
    const mode = await page.evaluate(() => sessionStorage.getItem('pl_client_mode'));
    assert(mode === null, `after exit sessionStorage pl_client_mode is ${mode}, expected null`);
    enteredClientMode = false;
    const n = await cards().count();
    assert(n > 1, `after exit the client book shows ${n} card(s) — the admin scope did not come back`);
    return `back to PHOTON_ADMIN over ${n} clients`;
  });
} finally {
  await j.teardown('leave client view', async () => {
    if (!enteredClientMode) return 'not in client view';
    const r = await page.request.post(`${BASE}/v1/auth/view-as/exit`,
      { headers: { 'x-requested-with': 'XMLHttpRequest' } });
    // A cached session file holding a CLIENT identity under the admin's name
    // would silently mis-test every later run, so drop it rather than keep it.
    const file = join(QA, '.sessions', 'PHOTON_ADMIN.json');
    if (existsSync(file)) unlinkSync(file);
    assert(r.status() === 200, `POST /v1/auth/view-as/exit returned ${r.status()}; cached session discarded`);
    return 'exited via API, cached session discarded';
  });
  await session.close();
  await browser.close();
}

const failed = j.summary();
process.exit(failed ? 1 : 0);
