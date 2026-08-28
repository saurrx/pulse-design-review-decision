/**
 * Full-app journey audit. For each persona: real UI login, walk every nav
 * page, run the key interactions, and record every signal of breakage —
 * JS crashes, console errors, HTTP >= 400 (501 = unmapped adapter route),
 * blank screens. Screenshots at every step for visual review.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'http://localhost:3600';
const OUT = process.argv[2] || '/tmp/pulse-journeys';
const PW = 'pulse-dev-password';
mkdirSync(OUT, { recursive: true });

const PERSONAS = [
  { key: 'inventor',  email: 'inventor@acme.test',     pages: ['/', '/ideas', '/patents', '/workspace?tab=profile'] },
  { key: 'committee', email: 'committee@acme.test',    pages: ['/', '/ideas', '/patents'] },
  { key: 'counsel',   email: 'counsel@acme.test',      pages: ['/', '/ideas', '/patents', '/due-dates', '/workspace'] },
  { key: 'caseowner', email: 'owner@photonlegal.com',  pages: ['/', '/clients', '/ideas', '/patents', '/due-dates', '/actions', '/workspace'] },
  { key: 'admin',     email: 'admin@photonlegal.com',  pages: ['/', '/clients', '/ideas', '/patents', '/due-dates', '/actions', '/workspace'] },
];

const IGNORE_CONSOLE = [
  /React DevTools/, /\[vite\]/, /Download the React DevTools/,
  /net::ERR_/, // paired with the response listener already
];
const findings = [];
const note = (persona, page, kind, detail) => {
  findings.push({ persona, page, kind, detail: String(detail).slice(0, 300) });
  console.log(`  [${kind}] ${persona} ${page}: ${String(detail).slice(0, 140)}`);
};

const settle = async (page) => {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1800); // let queries + transitions finish
};

const shoot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });

const browser = await chromium.launch();
for (const persona of PERSONAS) {
  console.log(`\n=== ${persona.key} (${persona.email}) ===`);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let current = '/login';

  page.on('pageerror', (e) => note(persona.key, current, 'JS-CRASH', e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (IGNORE_CONSOLE.some((r) => r.test(t))) return;
    // axios logs failed requests as console errors too; the response hook has them
    if (/the server responded with a status/.test(t)) return;
    note(persona.key, current, 'CONSOLE', t);
  });
  page.on('response', (r) => {
    const s = r.status();
    if (s < 400) return;
    const u = r.url().replace(BASE, '');
    if (s === 401 && /\/v1\/auth\/me/.test(u)) return; // expected pre-login
    note(persona.key, current, s === 501 ? 'UNMAPPED-501' : `HTTP-${s}`, `${r.request().method()} ${u}`);
  });

  // -- login through the real form --
  await page.goto(`${BASE}/login`);
  await settle(page);
  await shoot(page, `${persona.key}-00-login`);
  await page.fill('#email', persona.email);
  await page.fill('#password', PW);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 12000 });
  } catch {
    note(persona.key, '/login', 'LOGIN-STUCK', 'still on /login 12s after submit');
    await shoot(page, `${persona.key}-00-login-stuck`);
    await ctx.close();
    continue;
  }
  await settle(page);

  // -- walk every nav page --
  let i = 1;
  for (const path of persona.pages) {
    current = path;
    await page.goto(`${BASE}${path}`);
    await settle(page);
    const name = `${persona.key}-${String(i).padStart(2, '0')}-${path.replace(/[/?=]+/g, '_') || 'home'}`;
    await shoot(page, name);
    const rootText = await page.locator('#root').innerText().catch(() => '');
    if (rootText.trim().length < 40) note(persona.key, path, 'BLANK', `root has ${rootText.trim().length} chars of text`);
    i++;
  }

  // -- persona-specific interactions --
  try {
    if (persona.key === 'inventor') {
      current = '/ideas:new-idea';
      await page.goto(`${BASE}/ideas`);
      await settle(page);
      const cta = page.getByRole('button', { name: /new idea|submit.*idea|add idea/i }).first();
      if (await cta.count()) {
        await cta.click();
        await page.waitForTimeout(1200);
        await shoot(page, `${persona.key}-90-new-idea-modal`);
        const title = page.locator('input[name="title"], input[placeholder*="title" i]').first();
        if (await title.count()) {
          await title.fill('Journey-test disclosure');
          const go = page.getByRole('button', { name: /create|continue|start|next/i }).first();
          if (await go.count()) { await go.click(); await page.waitForTimeout(2500); await shoot(page, `${persona.key}-91-draft-workspace`); }
        }
      } else note(persona.key, '/ideas', 'MISSING-CTA', 'no New idea button found');
      // open the first idea row if any
      current = '/ideas:open-first';
      await page.goto(`${BASE}/ideas`); await settle(page);
      const row = page.locator('table tbody tr, [class*="cursor-pointer"]').first();
      if (await row.count()) { await row.click(); await page.waitForTimeout(2000); await shoot(page, `${persona.key}-92-idea-detail`); }
    }
    if (persona.key === 'counsel') {
      current = '/ideas:review-first';
      await page.goto(`${BASE}/ideas`); await settle(page);
      await shoot(page, `${persona.key}-90-review-queue`);
      const row = page.locator('table tbody tr, [role="button"], [class*="cursor-pointer"]').first();
      if (await row.count()) { await row.click(); await page.waitForTimeout(2000); await shoot(page, `${persona.key}-91-review-detail`); }
    }
    if (persona.key === 'admin' || persona.key === 'caseowner') {
      current = '/clients:open-first';
      await page.goto(`${BASE}/clients`); await settle(page);
      const row = page.locator('table tbody tr, a[href^="/clients/"], [class*="cursor-pointer"]').first();
      if (await row.count()) { await row.click(); await page.waitForTimeout(2200); await shoot(page, `${persona.key}-90-client-detail`); }
      else note(persona.key, '/clients', 'MISSING-ROW', 'no client row to open');
    }
  } catch (e) {
    note(persona.key, current, 'INTERACTION-FAIL', e.message);
  }

  await ctx.close();
}
await browser.close();

writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 2));
const counts = {};
for (const f of findings) counts[f.kind] = (counts[f.kind] || 0) + 1;
console.log('\n=== SUMMARY ===');
console.log(`findings: ${findings.length}`, counts);
console.log(`screenshots + findings.json in ${OUT}`);
