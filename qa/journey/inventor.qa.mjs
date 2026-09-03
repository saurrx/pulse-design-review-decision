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
let draftId = null;
let recovery = null;          // a re-login, only ever opened to finish teardown

/** The draft heading. The page carries three h1s — the hidden desktop-only
 *  gate, the layout header ("Working submission") and the idea title last. */
const heading = () => page.locator('h1').last();
/** The readiness figure in the right rail. Two monospaced percentages exist in
 *  the DOM and one of them is not rendered, so match on visibility — `.first()`
 *  silently picked the hidden one and reported a selector bug that was not one. */
const readinessPct = () => page.locator('span.font-mono:visible').filter({ hasText: /^\d+%$/ }).last();

try {
  /**
   * The dashboard's own submit affordance, for an inventor who HAS ideas.
   *
   * This step exists because that button was removed by mistake and shipped.
   * The instruction was one bullet under a heading that read "The Screen where
   * Inventor has NOT submitted any ideas"; it was applied unconditionally, so
   * an inventor with ideas lost the only way to start another from that card —
   * the large "Submit your first idea" call to action renders in the EMPTY
   * state and not for them. Nothing failed, because nothing asserted it.
   *
   * The demo inventor always has ideas, so this asserts the state that exists
   * here. The empty state is not reachable on demo without deleting their whole
   * corpus, and a journey that did that would be worse than the gap it closes.
   */
  await j.step('the dashboard offers an inventor with ideas a way to start one', async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    const card = page.locator('div').filter({ hasText: /^My ideas/ }).last();
    const recent = await page.getByText(/^My ideas$/).count();
    assert(recent > 0, 'the inventor dashboard has no "My ideas" card at all');
    const submit = page.getByRole('button', { name: /Submit Idea/i });
    assert(await submit.count() > 0,
      'the inventor dashboard offers no "Submit Idea" button — it was removed once ' +
      'by applying an empty-state instruction to every state');
    return `${await submit.count()} submit affordance(s) on the dashboard`;
  });

  await j.step('create idea from the ideas page', async () => {
    await page.goto(`${BASE}/ideas`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Submit an Idea|Submit your first idea/i }).first().click();
    await page.fill('#idea-title', TITLE);
    // "Save Idea" since 2026-09-03. The modal's button was a three-way ternary
    // — "Start draft" / "Start with context" / "Starting…" — collapsed to
    // "Save Idea" / "Saving…" when the submit-modal copy was rewritten. This
    // line still said "Start draft" and timed out, and nothing caught it,
    // because browser-tiers is manual/scheduled: a copy change and the journey
    // that names that copy live in the same MR and only one of them is checked.
    await page.getByRole('button', { name: /^Save Idea$/ }).click();
    const url = await assertUrl(page, /\/ideas\/[0-9a-f-]{36}\/draft\?draftId=[0-9a-f-]{36}/,
      'creating an idea must open its draft workspace');
    ideaId = /\/ideas\/([0-9a-f-]{36})\//.exec(url)[1];
    draftId = /draftId=([0-9a-f-]{36})/.exec(url)[1];
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

  /**
   * The pre-fill card holds the full-width row the "Keep building" banner used
   * to occupy — asserted on an UNTOUCHED draft here, and again after the
   * questionnaire is answered, because those are two different code paths and
   * only the second one regressed.
   */
  await j.step('an untouched draft shows the full-width pre-fill card', async () => {
    const rich = page.getByText('Start from what you already have', { exact: true });
    assert(await rich.count() > 0,
      'the "Start from what you already have" card is missing on a new draft');
    // Full width means WIDER than <main>, which is capped at 64%. Measuring is
    // the point: the card was moved out of <main> correctly once and a class
    // change could put it back without any text changing.
    const cardBox = await rich.locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]').boundingBox();
    // The QUESTIONNAIRE column specifically — `main[class*="64%"]` — not the
    // layout's outer <main>, which is the full content width and against which
    // any card looks full width. Measured the outer one first and it "passed"
    // at 1104px vs 1152px, which proves nothing at all.
    const col = page.locator('main[class*="64%"]').first();
    assert(await col.count() > 0,
      'no lg:w-[64%] column on the draft page — this assertion has lost its reference point');
    const colBox = await col.boundingBox();
    assert(cardBox && colBox && cardBox.width > colBox.width * 1.2,
      `the pre-fill card is ${Math.round(cardBox?.width)}px against a ` +
      `${Math.round(colBox?.width)}px questionnaire column — it is back inside that ` +
      'column instead of the full-width row the "Keep building" banner vacated');
    // And the things that row replaced must be gone.
    for (const gone of ['Keep building', 'usually 5 to 10 days', 'in draft 0d']) {
      assert(!(await page.getByText(gone, { exact: false }).count()),
        `"${gone}" is still on the draft page`);
    }
    // "Working submission" was asked to be removed FROM THE CHIP, and that is
    // what is asserted — scoped to the chip row beside the heading. The string
    // also survives as the DashboardLayout page-header title and as the <h1>
    // fallback for an untitled idea, neither of which was in scope; a
    // whole-page search for it fails on those and would have been a test
    // asserting more than was asked.
    const chips = await page.locator('h1 + div').first().innerText();
    assert(!/Working submission/i.test(chips),
      `the chip row still carries "Working submission": "${chips.replace(/\s+/g, ' ')}"`);
    return `card ${Math.round(cardBox.width)}px > column ${Math.round(colBox.width)}px`;
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

  /**
   * THE regression, asserted directly.
   *
   * The card was hoisted into the full-width row correctly, but the collapse
   * condition was `autofillRan || anyContent` — so the moment a draft had a
   * single character in it the card became a one-line bar, and on every real
   * draft nothing prominent stood where the banner had been. The move was in
   * the diff; the outcome was not. It now collapses only once pre-fill has
   * actually RUN, which this journey never does.
   */
  await j.step('a draft WITH content still shows the card, not a one-line bar', async () => {
    assert(await page.getByText('Start from what you already have', { exact: true }).count() > 0,
      'the pre-fill card collapsed once the draft had content — the full-width row is empty again');
    assert(!(await page.getByText('Have a write-up? Pre-fill the rest of this draft.', { exact: true }).count()),
      'the draft shows the collapsed one-line pre-fill bar even though pre-fill never ran');
    return 'still the full card after answering every section';
  });

  await j.step('autosave persisted the answers on the SERVER', async () => {
    // Poll the SERVER until it actually holds the last answer, rather than
    // guessing at the autosave debounce. Reloading on a timer raced the final
    // field and failed once at 82%; a flaky test is a defect in the test, and
    // "it passed on the re-run" is not a diagnosis. This also happens to be a
    // more honest form of the assertion the step is making.
    // The DOM id is `f-${q.id}` (DraftWorkspace.tsx), so the key the API
    // stores is the id WITHOUT that prefix. Checking for "f-bg1" server-side
    // finds nothing and looks exactly like autosave never firing.
    const field = 'f-bg1';
    const last = field.replace(/^f-/, '');
    const deadline = Date.now() + 20000;
    let stored = null;
    while (Date.now() < deadline) {
      const r = await page.request.get(`${BASE}/v1/drafts/${draftId}`,
        { headers: { 'x-requested-with': 'XMLHttpRequest' } });
      if (r.ok()) {
        stored = ((await r.json()) ?? {}).answers ?? {};
        if (stored[last] === ANSWERS[field]) break;
      }
      await page.waitForTimeout(1000);
    }
    assert(stored && stored[last] === ANSWERS[field],
      `the server never received the last answer within 20s — autosave did not flush`);

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
