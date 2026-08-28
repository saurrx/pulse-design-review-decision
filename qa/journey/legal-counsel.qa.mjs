/**
 * Legal counsel loop: the legal review stage and the actions screen.
 * @tier:journey @role:LEGAL_COUNSEL @area:review @area:ideas @area:actions @area:duedates @cp:smoke @cp:post-deploy
 *
 *   node qa/journey/legal-counsel.qa.mjs [--base https://demo.photonpulse.ai]
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * The actions screen's confirm dialog says, in the product's own words, "This
 * action cannot be undone" — and it is right: `POST /v1/actions/submit-all`
 * has no inverse. There is no DELETE on actions and `decide` cannot clear an
 * instruction (`dto.instruction ?? action.instruction`), so an instruction
 * submitted here would sit in Photon's live queue forever. Demo carries real
 * data, so this journey picks the instruction, asserts the product bound it to
 * the right deadline, and CANCELS — then proves separately that an instruction
 * already on a deadline survives a reload. That is the persistence claim this
 * environment can honestly make.
 */
import { chromium } from 'playwright';
import { openSession, APP } from '../lib/session.mjs';
import { Journey, assert, assertPageContains } from '../lib/journey.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i === -1 ? d : process.argv[i + 1]; };
const BASE = arg('base', APP);

const browser = await chromium.launch();
const session = await openSession(browser, 'LEGAL_COUNSEL', { base: BASE });
if (!session) {
  console.log('### LEGAL_COUNSEL: LOGIN FAILED (throttle is 5/5min/IP — wait, or reuse qa/.sessions)');
  await browser.close();
  process.exit(1);
}
const { page } = session;
const j = new Journey('LEGAL_COUNSEL review + actions loop');
console.log(`  (session ${session.reused ? 'reused' : 'fresh login'})`);

const rows = () => page.locator('button:has(> h2)');

try {
  /* ---------------------------------------------------------------- review */

  await j.step('/ideas is the review queue at the LEGAL stage', async () => {
    await page.goto(`${BASE}/ideas`, { waitUntil: 'networkidle' });
    await assertPageContains(page, /Review queue/, '/ideas must render the review queue for counsel');
    await page.waitForTimeout(1500);
    const n = await rows().count();
    assert(n > 0, 'the counsel review queue rendered zero disclosures — nothing here is actually being tested');
    return `${n} disclosure(s) awaiting a legal decision`;
  });

  await j.step('counsel approves TO PHOTON, not to itself', async () => {
    // The committee's approve is "Send to Legal Counsel"; counsel's is "Send
    // to Photon Legal". Offering counsel the committee's label would send an
    // idea back into the stage it just left.
    const approve = page.getByRole('button', { name: /^Send to Photon Legal$/ });
    assert(await approve.isVisible({ timeout: 15000 }).catch(() => false),
      'the counsel approve control "Send to Photon Legal" is missing');
    assert(!(await page.getByRole('button', { name: /^Send to Legal Counsel$/ }).count()),
      'counsel is being offered "Send to Legal Counsel" — that is the committee stage');
    assert(await page.getByRole('button', { name: /Request Update from Inventor/ }).isVisible(),
      '"Request Update from Inventor" is missing');
    return 'Send to Photon Legal · Request Update from Inventor';
  });

  /* --------------------------------------------------------------- actions */

  let instructedRow = null;

  await j.step('/actions lists the client docket with a decision per deadline', async () => {
    await page.goto(`${BASE}/actions`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    const table = page.locator('table').first();
    await assertPageContains(page, /Application No\./, 'the actions table header must render');
    const n = await table.locator('tbody tr').count();
    assert(n > 0, 'the actions table rendered zero deadlines — the row map never ran');
    const combos = await page.getByRole('combobox').count();
    assert(combos > 0, 'no deadline offers an instruction control');
    return `${n} deadline(s), ${combos} instruction control(s)`;
  });

  await j.step('picking an instruction binds it to that exact deadline', async () => {
    const row = page.locator('tbody tr').filter({ hasText: /Select action\.\.\./ }).first();
    const appNo = (await row.locator('td').first().innerText()).trim();
    assert(/^\w?\d{6,}/.test(appNo) || appNo.length > 4, `could not read an application number from the row: "${appNo}"`);
    await row.getByRole('combobox').first().click();
    await page.waitForTimeout(1200);
    const options = await page.getByRole('option').allInnerTexts();
    assert(options.length > 0, 'the instruction dropdown offered no options for this deadline');
    const chosen = options.map(o => o.trim()).find(o => /^Instruct OC/i.test(o)) ?? options[0].trim();
    await page.getByRole('option', { name: chosen, exact: true }).click();
    await page.waitForTimeout(2500);

    // radix AlertDialog, not Dialog: the role is `alertdialog`.
    const dialog = page.locator('[role="alertdialog"], [role="dialog"]').first();
    assert(await dialog.isVisible().catch(() => false),
      'choosing an instruction produced no confirmation — the client would submit to Photon by accident');
    const text = (await dialog.innerText()).replace(/\s+/g, ' ');
    assert(text.includes(chosen), `the confirmation names "${text.slice(0, 120)}", not the chosen instruction "${chosen}"`);
    assert(text.includes(appNo), `the confirmation does not name the deadline's application ${appNo}`);
    instructedRow = { appNo, chosen };
    return `"${chosen}" bound to ${appNo}`;
  });

  await j.step('cancelling leaves the deadline untouched', async () => {
    await page.getByRole('button', { name: /^Cancel$/ }).click();
    await page.waitForTimeout(2000);
    const row = page.locator('tbody tr').filter({ hasText: instructedRow.appNo }).first();
    const text = (await row.innerText()).replace(/\s+/g, ' ');
    assert(text.includes('Select action...'),
      `after cancelling, ${instructedRow.appNo} reads "${text.slice(0, 140)}" — the instruction was written anyway`);
    assert(text.includes('No Action'), `after cancelling, ${instructedRow.appNo} does not read "No Action"`);
    return `${instructedRow.appNo} still unassigned`;
  });

  await j.step('an instruction already given persists across a reload', async () => {
    // Read the truth from the API, then require the UI to agree with it after
    // a full reload. Asserting only the UI would pass on a value the page
    // never let go of.
    const r = await page.request.get(`${BASE}/v1/actions?limit=200&page=1`,
      { headers: { 'x-requested-with': 'XMLHttpRequest' } });
    assert(r.status() === 200, `GET /v1/actions returned ${r.status()}`);
    const decided = ((await r.json()).data ?? []).filter(a => a.instruction);
    if (!decided.length) return 'no deadline on this client carries an instruction yet — nothing to verify';
    const a = decided[0];
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const shown = (await page.locator('table').first().innerText()).replace(/\s+/g, ' ');
    assert(shown.includes(a.instruction),
      `the API holds instruction "${a.instruction}" but the reloaded table does not show it`);
    return `"${a.instruction}" (${a.submission_state}) still rendered after reload`;
  });
} finally {
  await session.close();
  await browser.close();
}

const failed = j.summary();
process.exit(failed ? 1 : 0);
