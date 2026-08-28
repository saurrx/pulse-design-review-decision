/**
 * Inventor disclosure loop, end to end against the DEPLOYED demo.
 * @tier:journey @role:INVENTOR @area:ideas @area:drafts @area:agent-eval @cp:smoke @cp:post-deploy
 *
 *   node qa/journey/inventor.qa.mjs [--base https://demo.photonpulse.ai] [--submit]
 *
 * The loop: create an idea → land in the draft workspace → answer the
 * questionnaire and let autosave run → prove the answers reached the SERVER by
 * reloading → reach the point where the product offers submission → (opt-in)
 * submit and watch the state change. The idea is deleted in teardown whatever
 * happened.
 *
 * WHY `--submit` IS OPT-IN AND OFF BY DEFAULT
 * `DELETE /v1/ideas/:id` refuses a non-DRAFT idea on purpose — "a submitted
 * idea cannot be deleted, its review history must survive"
 * (pulse-backend ideas.service.ts:426). So a journey that submits CANNOT clean
 * up after itself, and demo carries real imported data. The default run
 * therefore stops at the submit gate — it asserts that the product offers the
 * submit affordance, which is the outcome that matters and the one that is
 * currently broken — and `--submit` is there for a run against a throwaway
 * environment where litter is acceptable.
 *
 * Everything created is prefixed with a run id so anything a crashed run left
 * behind is identifiable by eye.
 */
import { chromium } from 'playwright';
import { openSession, APP } from '../lib/session.mjs';
import { Journey, assert, assertUrl, assertVisibleText, runId } from '../lib/journey.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i === -1 ? d : process.argv[i + 1]; };
const BASE = arg('base', APP);
const SUBMIT = process.argv.includes('--submit');

const RUN = runId();
const TITLE = `${RUN} phase-change lattice battery cooling`;

/** The five questionnaire sections, by the field ids DraftWorkspace renders. */
const ANSWERS = {
  'f-bg1':   'Thermal management for lithium-ion battery packs in electric vehicles.',
  'f-bg2':   'Existing packs use liquid cold plates and forced-air convection.',
  'f-prob1': 'Cells at the pack centre run 12C hotter than edge cells, which caps the fast-charge rate.',
  'f-prob2': 'A cold plate only reaches one face and cannot equalise the interior cells.',
  'f-sol1':  'A phase-change lattice cast between the cells conducts heat radially outward.',
  'f-sol2':  'A printed lattice former, a paraffin composite, and a wick returning condensate to the core.',
  'f-adv1':  'The lattice is printed as one piece with the cell holder, so no assembly step adds contact resistance.',
  'f-adv2':  'Bench tests show a 9C reduction in peak spread and 18 percent faster charging.',
  'f-imp1':  'Cast into EV pack modules at the cell-holder moulding stage.',
  'f-imp2':  'One printer, a paraffin blender and two process engineers.',
};
const SECTION_OF = {
  'f-prob1': 'Problem', 'f-prob2': 'Problem',
  'f-sol1': 'Solution', 'f-sol2': 'Solution',
  'f-adv1': 'Novelty',  'f-adv2': 'Novelty',
  'f-imp1': 'Application', 'f-imp2': 'Application',
};

const browser = await chromium.launch();
const session = await openSession(browser, 'INVENTOR', { base: BASE });
if (!session) {
  console.log('### INVENTOR: LOGIN FAILED (throttle is 5/5min/IP — wait, or reuse qa/.sessions)');
  await browser.close();
  process.exit(1);
}
const { page } = session;
const j = new Journey(`INVENTOR disclosure loop  [${RUN}]`);
console.log(`  (session ${session.reused ? 'reused' : 'fresh login'})`);

let ideaId = null;
let recovery = null;          // a re-login, only ever opened to finish teardown

/** The draft heading. The page carries three h1s — the hidden desktop-only
 *  gate, the layout header ("Working submission") and the idea title last. */
const heading = () => page.locator('h1').last();
/** The readiness figure in the right rail. Two monospaced percentages exist in
 *  the DOM and one of them is not rendered, so match on visibility — `.first()`
 *  silently picked the hidden one and reported a selector bug that was not one. */
const readinessPct = () => page.locator('span.font-mono:visible').filter({ hasText: /^\d+%$/ }).last();

try {
  await j.step('create idea from the ideas page', async () => {
    await page.goto(`${BASE}/ideas`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Submit an Idea|Submit your first idea/i }).first().click();
    await page.fill('#idea-title', TITLE);
    await page.getByRole('button', { name: /^Start draft$/ }).click();
    const url = await assertUrl(page, /\/ideas\/[0-9a-f-]{36}\/draft\?draftId=[0-9a-f-]{36}/,
      'creating an idea must open its draft workspace');
    ideaId = /\/ideas\/([0-9a-f-]{36})\//.exec(url)[1];
    return `idea ${ideaId}`;
  });

  await j.step('the draft workspace is the new idea, in draft', async () => {
    // The URL changes before the workspace mounts, so wait for the
    // questionnaire itself; asserting on `h1` too early reads the previous
    // page's heading and reports a confusing mismatch instead of a wait.
    await page.locator('#f-bg1').waitFor({ state: 'visible', timeout: 30000 });
    // Named elements, not page text. The status TIMELINE on this page also
    // contains the words "Under review" and "Filed" as future stages, so a
    // whole-page text search would happily "prove" any state at all — the
    // negative control that planted `/Under review/` here passed until this
    // was scoped to the chip.
    await assertVisibleText(heading(), new RegExp('^' + TITLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'),
      'the workspace heading must be the title just entered');
    await assertVisibleText(page.locator('h1 + div > span').first(), /^In draft$/,
      'a new idea must carry the "In draft" status chip');
    return 'h1 = title, chip = In draft';
  });

  await j.step('answering the questionnaire drives readiness to 100%', async () => {
    for (const [id, value] of Object.entries(ANSWERS)) {
      if (!(await page.locator('#' + id).count())) {
        await page.getByRole('button', { name: new RegExp(`^${SECTION_OF[id]}$`) }).first().click();
        await page.waitForTimeout(600);
      }
      await page.locator('#' + id).fill(value);
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(2500);                 // autosave debounce is 800ms
    await assertVisibleText(page.getByText('Ready for evaluation', { exact: true }), /^Ready for evaluation$/,
      'with every required field answered the rail must say Ready for evaluation');
    await assertVisibleText(readinessPct(), /^100%$/, 'the readiness figure must reach 100%');
    return 'Ready for evaluation · 100%';
  });

  await j.step('autosave persisted the answers on the SERVER', async () => {
    // Reloading is the point: it proves the answers came back from the API and
    // not from a component that never lost them.
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const bg1 = await page.locator('#f-bg1').inputValue();
    assert(bg1 === ANSWERS['f-bg1'], `after reload f-bg1 is "${bg1.slice(0, 60)}", expected the answer typed`);
    await assertVisibleText(readinessPct(), /^100%$/, 'readiness must still be 100% after reload');
    return 'answers survived a full reload';
  });

  await j.step('the product offers submission once the draft is complete', async () => {
    await page.getByRole('button', { name: /^Evaluate submission$/ }).click();
    // Either the evaluation runs and the send affordance appears, or the
    // evaluation itself reports progress. Both are outcomes; neither appearing
    // inside two minutes is the failure.
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      if (await page.getByRole('button', { name: /^Send for review$/ }).count()) {
        return 'Send for review is offered';
      }
      await page.waitForTimeout(2000);
    }
    throw new Error(
      'no "Send for review" control appeared within 120s of Evaluate submission — ' +
      'the inventor cannot submit this disclosure');
  });

  if (SUBMIT) {
    await j.step('sending moves the idea out of draft', async () => {
      await page.getByRole('button', { name: /^Send for review$/ }).click();
      await page.waitForTimeout(1200);
      // No co-inventors were added, so the workspace asks once before sending.
      const skip = page.getByRole('button', { name: /^Skip$/ });
      if (await skip.count()) await skip.click();
      await assertUrl(page, new RegExp(`/ideas/${ideaId}$`), 'sending must return to the idea record');
      const state = await page.request.get(`${BASE}/v1/ideas/${ideaId}`,
        { headers: { 'x-requested-with': 'XMLHttpRequest' } }).then(r => r.json());
      assert(state.state && state.state !== 'DRAFT',
        `after sending, the server still reports state ${state.state}`);
      return `idea left DRAFT (now ${state.state})`;
    });
  } else {
    console.log('  note --submit not given: stopping at the submit gate, because a submitted');
    console.log('       idea cannot be deleted (backend refuses non-DRAFT deletes by design).');
  }
} finally {
  await j.teardown('delete the created idea', async () => {
    if (!ideaId) return 'nothing was created';
    const del = (p) => p.request.delete(`${BASE}/v1/ideas/${ideaId}`,
      { headers: { 'x-requested-with': 'XMLHttpRequest' } });
    let r = await del(page);
    if (r.status() === 401) {
      // The access cookie lives 15 minutes and a slow journey can outlive it.
      // Cleanup is not optional, so spend one more login rather than leave a
      // record behind on an environment that carries real data.
      console.log('       session expired before teardown — logging in again to clean up');
      recovery = await openSession(browser, 'INVENTOR', { base: BASE });
      if (recovery) r = await del(recovery.page);
    }
    assert(r.status() === 200, `DELETE /v1/ideas/${ideaId} returned ${r.status()} — ${(await r.text()).slice(0, 160)}`);
    // Prove the deletion, do not trust the 200.
    const check = await (recovery ?? session).page.request.get(`${BASE}/v1/ideas/${ideaId}`,
      { headers: { 'x-requested-with': 'XMLHttpRequest' } });
    assert(check.status() === 404, `idea ${ideaId} still readable after delete (${check.status()})`);
    return `${ideaId} gone (404)`;
  });
  if (recovery) await recovery.close();
  await session.close();
  await browser.close();
}

const failed = j.summary();
process.exit(failed ? 1 : 0);
