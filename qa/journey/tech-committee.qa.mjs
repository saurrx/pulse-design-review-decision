/**
 * IP Committee review loop against the DEPLOYED demo.
 * @tier:journey @role:TECH_COMMITTEE @area:review @area:ideas @cp:smoke @cp:post-deploy
 *
 *   node qa/journey/tech-committee.qa.mjs [--base https://demo.photonpulse.ai]
 *
 * READ-ONLY BY CONSTRUCTION. A committee decision (approve / request update /
 * decline) is an append-only transition on somebody's real disclosure and
 * there is no undo, so this journey exercises everything up to the decision
 * and asserts the decision controls are present and correctly labelled — it
 * never clicks one. The dropdown is opened and dismissed with Escape.
 *
 * The outcome that matters here is not "the page loaded": it is that selecting
 * a different item in the queue actually SWITCHES the disclosure pane. That is
 * asserted through the "Full record" link's aria-label, which names the
 * currently selected idea, so a pane that silently kept showing item 1 fails.
 */
import { chromium } from 'playwright';
import { openSession, APP } from '../lib/session.mjs';
import { Journey, assert, assertUrl, assertPageContains } from '../lib/journey.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i === -1 ? d : process.argv[i + 1]; };
const BASE = arg('base', APP);

const browser = await chromium.launch();
const session = await openSession(browser, 'TECH_COMMITTEE', { base: BASE });
if (!session) {
  console.log('### TECH_COMMITTEE: LOGIN FAILED (throttle is 5/5min/IP — wait, or reuse qa/.sessions)');
  await browser.close();
  process.exit(1);
}
const { page } = session;
const j = new Journey('TECH_COMMITTEE review loop');
console.log(`  (session ${session.reused ? 'reused' : 'fresh login'})`);

/** Queue rows are the only buttons with an <h2> child (the idea title). */
const rows = () => page.locator('button:has(> h2)');
const selectedTitle = () => page.locator('[aria-label^="Open full record for"]').getAttribute('aria-label');

try {
  await j.step('/ideas is the review queue, with the decision buckets', async () => {
    await page.goto(`${BASE}/ideas`, { waitUntil: 'networkidle' });
    await assertPageContains(page, /Review queue/, '/ideas must render the review queue for a committee member');
    for (const bucket of [/Review \d+/, /With inventor \d+/, /With Photon Legal \d+/, /All \d+/]) {
      await assertPageContains(page, bucket, `the queue must show the ${bucket} bucket with a count`);
    }
    return 'Review / With inventor / With Photon Legal / All, each with a count';
  });

  let secondTitle = null;
  await j.step('the queue holds real disclosures, oldest first', async () => {
    await page.waitForTimeout(1500);
    const n = await rows().count();
    // An empty table hides broken code (CLAUDE.md §6): the row map only runs
    // when there are rows, so "0 rows and no error" is not a pass.
    assert(n > 0, 'the review queue rendered zero disclosures — nothing here is actually being tested');
    const ages = [];
    for (let i = 0; i < n; i++) {
      const t = (await rows().nth(i).innerText()).replace(/\s+/g, ' ');
      const age = /(\d+)d/.exec(t);
      assert(age, `queue row ${i} shows no day-age: "${t.slice(0, 80)}"`);
      ages.push(Number(age[1]));
    }
    for (let i = 1; i < ages.length; i++) {
      assert(ages[i] <= ages[i - 1], `queue is not oldest-first: row ${i - 1} is ${ages[i - 1]}d, row ${i} is ${ages[i]}d`);
    }
    if (n > 1) secondTitle = (await rows().nth(1).locator('h2').innerText()).trim();
    return `${n} disclosure(s), ages ${ages.join('d, ')}d`;
  });

  await j.step('opening a different disclosure switches the pane', async () => {
    if (!secondTitle) return 'only one disclosure in the queue — nothing to switch to';
    const before = await selectedTitle();
    await rows().nth(1).click();
    await page.waitForTimeout(2000);
    const after = await selectedTitle();
    assert(after !== before, `the pane still shows "${before}" after selecting a different queue item`);
    assert(after === `Open full record for ${secondTitle}`,
      `the pane shows "${after}", expected the selected idea "${secondTitle}"`);
    return `pane switched to "${secondTitle}"`;
  });

  await j.step('the disclosure pane renders the inventor submission', async () => {
    await page.getByRole('button', { name: 'Submission', exact: true }).click();
    await page.waitForTimeout(1500);
    await assertPageContains(page, /Inventor submission/, 'the Submission tab must render the inventor submission');
    // The questionnaire itself, not just a heading — a reviewer decides on the
    // draft, and an empty pane is the failure this asserts against.
    for (const section of [/Background/, /Problem/, /Solution/, /Advantages|Novelty/]) {
      await assertPageContains(page, section, `the submission must show the ${section} section`);
    }
    return 'Background / Problem / Solution / Advantages rendered';
  });

  await j.step('the activity tab carries the lifecycle and audit trail', async () => {
    await page.getByRole('button', { name: 'Activity', exact: true }).click();
    await page.waitForTimeout(1500);
    await assertPageContains(page, /Review progress/, 'Activity must show the lifecycle');
    await assertPageContains(page, /Disclosure submitted/, 'Activity must show the recorded submission event');
    return 'Review progress + Disclosure submitted';
  });

  await j.step('the committee decision controls are present and correctly labelled', async () => {
    await page.getByRole('button', { name: 'Summary', exact: true }).click();
    await page.waitForTimeout(1200);
    // The committee approves TO legal counsel. Counsel approves to Photon —
    // getting these two the wrong way round is the exact mistake the rename
    // regression made, so assert the label, not just a button.
    const approve = page.getByRole('button', { name: /^Send to Legal Counsel$/ });
    assert(await approve.isVisible(), 'the committee approve control "Send to Legal Counsel" is missing');
    assert(!(await page.getByRole('button', { name: /^Send to Photon Legal$/ }).count()),
      'the committee is being offered "Send to Photon Legal" — that is the counsel stage, not this one');
    assert(await page.getByRole('button', { name: /Request Update from Inventor/ }).isVisible(),
      '"Request Update from Inventor" is missing');

    await page.locator('[aria-label="More decision actions"]').click();
    await page.waitForTimeout(1000);
    const items = await page.getByRole('menuitem').allInnerTexts();
    assert(items.some(t => /Decline idea/i.test(t)),
      `the decline action is missing from the overflow menu (saw ${JSON.stringify(items)})`);
    await page.keyboard.press('Escape');                  // dismissed, never clicked
    await page.waitForTimeout(500);
    return 'Send to Legal Counsel · Request Update from Inventor · ⋯ Decline idea';
  });

  await j.step('"Full record" opens the idea record', async () => {
    const title = (await selectedTitle()).replace('Open full record for ', '');
    await page.getByRole('link', { name: /Open full record for/ }).click();
    await assertUrl(page, /\/ideas\/[0-9a-f-]{36}$/, 'Full record must navigate to the idea record');
    await assertPageContains(page, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      'the idea record must be the disclosure that was selected in the queue');
    return `/ideas/:id for "${title}"`;
  });
} finally {
  await session.close();
  await browser.close();
}

const failed = j.summary();
process.exit(failed ? 1 : 0);
