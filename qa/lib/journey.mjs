/**
 * The journey-tier runner: sequential, outcome-asserting steps with a teardown
 * that runs even when a step fails.
 *
 * THE LAW (pulse-frontend/CLAUDE.md §6, and a real bug hid behind its
 * violation): assert OUTCOMES — the URL changed, the state changed, an element
 * appeared with specific text — never the absence of errors. Every helper here
 * takes an expectation. There is deliberately no `assertNoErrors`.
 *
 * A journey is sequential because its steps are causally linked: you cannot
 * open a draft you failed to create. So the first failure aborts the remaining
 * steps and reports them as `skip`, rather than producing a cascade of
 * secondary failures that hide which one was real. Teardown still runs.
 */
export class Journey {
  constructor(name) {
    this.name = name;
    this.results = [];
    this.aborted = false;
    console.log(`\n### ${name}`);
  }

  /** Run a step. It must RETURN a short evidence string; throwing is failure. */
  async step(label, fn) {
    if (this.aborted) { this.results.push({ label, state: 'skip' }); console.log(`  skip ${label}`); return undefined; }
    const t0 = Date.now();
    try {
      const evidence = await fn();
      this.results.push({ label, state: 'pass', evidence });
      console.log(`  PASS ${label}${evidence ? ` — ${evidence}` : ''}  (${Date.now() - t0}ms)`);
      return evidence;
    } catch (e) {
      this.aborted = true;
      const detail = (e && e.message ? e.message : String(e)).split('\n')[0].slice(0, 300);
      this.results.push({ label, state: 'fail', detail });
      console.log(`  FAIL ${label} — ${detail}`);
      return undefined;
    }
  }

  /** Teardown steps run whatever happened; a failing teardown is a failure. */
  async teardown(label, fn) {
    const t0 = Date.now();
    try {
      const evidence = await fn();
      this.results.push({ label: `teardown: ${label}`, state: 'pass', evidence });
      console.log(`  PASS teardown: ${label}${evidence ? ` — ${evidence}` : ''}  (${Date.now() - t0}ms)`);
    } catch (e) {
      const detail = (e && e.message ? e.message : String(e)).split('\n')[0].slice(0, 300);
      this.results.push({ label: `teardown: ${label}`, state: 'fail', detail });
      console.log(`  FAIL teardown: ${label} — ${detail}`);
      console.log(`       LITTER: demo carries real data — clean this up by hand.`);
    }
  }

  get failed() { return this.results.filter(r => r.state === 'fail').length; }

  summary() {
    const n = (s) => this.results.filter(r => r.state === s).length;
    console.log(`  -- ${this.name}: ${n('pass')} passed, ${n('fail')} failed, ${n('skip')} skipped`);
    return this.failed;
  }
}

/* ---------- outcome assertions ------------------------------------------- */

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** The URL is what it must be, not merely "not an error page". */
export async function assertUrl(page, re, what) {
  await page.waitForURL(re, { timeout: 20000 }).catch(() => {});
  const url = page.url();
  assert(re.test(url), `${what}: url is ${url}, expected to match ${re}`);
  return url;
}

/**
 * A specific element exists AND carries specific text.
 *
 * The `/login` check is not decoration: the access cookie lives 15 minutes and
 * a journey can outlive it. Without it, an expired session reports itself as
 * "element never became visible", which sends you hunting for a selector bug
 * that is not there.
 */
export async function assertVisibleText(locator, re, what) {
  const el = locator.first();
  await el.waitFor({ state: 'visible', timeout: 20000 })
    .catch(() => {
      const url = locator.page().url();
      throw new Error(/\/login/.test(url)
        ? `${what}: the session ended mid-journey (now at ${url})`
        : `${what}: element never became visible`);
    });
  // Poll the TEXT too, not just visibility. An element can mount with a
  // placeholder before its data arrives — the draft heading renders "Working
  // submission" until the idea query resolves — and reading innerText once
  // turns that race into an intermittent failure that looks like a real bug.
  const deadline = Date.now() + 20000;
  let text = '';
  for (;;) {
    text = (await el.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (re.test(text)) return text.slice(0, 120);
    if (Date.now() > deadline) break;
    await locator.page().waitForTimeout(400);
  }
  if (/\/login/.test(locator.page().url())) {
    throw new Error(`${what}: the session ended mid-journey (now at ${locator.page().url()})`);
  }
  throw new Error(`${what}: text "${text.slice(0, 120)}" does not match ${re}`);
}

/** Named text is present somewhere on the page. */
export async function assertPageContains(page, re, what) {
  const deadline = Date.now() + 20000;
  let text = '';
  while (Date.now() < deadline) {
    text = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
    if (re.test(text)) return re.exec(text)[0].slice(0, 120);
    await page.waitForTimeout(500);
  }
  if (/\/login/.test(page.url())) throw new Error(`${what}: the session ended mid-journey (now at ${page.url()})`);
  throw new Error(`${what}: page never contained ${re} (saw ${text.length} chars)`);
}

/** A control that a role MUST have. Absence is the failure, not an exception. */
export async function assertControl(page, name, what) {
  const loc = page.getByRole('button', { name }).first();
  const visible = await loc.isVisible({ timeout: 15000 }).catch(() => false);
  assert(visible, `${what}: control ${name} is not present`);
  return (await loc.innerText()).replace(/\s+/g, ' ').trim().slice(0, 60);
}

/** A stable run id, so anything this suite creates is identifiable and deletable. */
export const runId = () => `QA-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;
