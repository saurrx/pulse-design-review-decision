/**
 * The accessibility ratchet. Runs axe on every story from the static build and
 * fingerprints each violation by story id, rule id, impact and a normalised
 * element context (tag, role, accessible text), never by selector. Inherited
 * fingerprints live in design/a11y-baseline.json; a new fingerprint fails, a
 * fixed one is reported so the baseline can shrink. Stories tagged "redesign"
 * must have zero violations inside their content root (<main>, else the story
 * root); chrome violations there are ratcheted, not blocking.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import { serveStatic, storiesFrom, blockEgress } from "./lib/serve.mjs";

const require = createRequire(import.meta.url);
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const args = new Set(process.argv.slice(2));
const dir = path.resolve("storybook-static"); const baselineFile = path.resolve("design/a11y-baseline.json"); const port = 6023;
const baseline = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, "utf8")) : { fingerprints: [] };
const known = new Set(baseline.fingerprints);
const close = await serveStatic(dir, port);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await blockEgress(context);
const page = await context.newPage();
const seen = new Set(); const fresh = []; let redesignBlocking = 0;

let broken = 0;
for (const s of storiesFrom(dir)) {
  try {
    await page.goto(`http://localhost:${port}/iframe.html?id=${s.id}&viewMode=story`);
    await page.waitForSelector('body[data-story-ready="1"]', { timeout: 20_000 });
  } catch (e) { broken++; console.log(`FAIL  ${s.id}: did not become ready (${String(e.message || e).slice(0, 80)})`); continue; }
  await page.addScriptTag({ content: axeSource });
  const result = await page.evaluate(async () => {
    const res = await window.axe.run(document.getElementById("storybook-root") ?? document.body, { resultTypes: ["violations"] });
    const norm = (el) => { const e = document.querySelector(el); if (!e) return "?"; const text = (e.getAttribute("aria-label") || e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40); return `${e.tagName.toLowerCase()}[${e.getAttribute("role") || ""}]:${text}`; };
    const main = document.querySelector("main");
    return res.violations.flatMap((v) => v.nodes.map((n) => ({ rule: v.id, impact: v.impact, context: norm(n.target[0]), inContent: main ? !!document.querySelector(n.target[0])?.closest("main") : true })));
  });
  for (const v of result) {
    const fp = `${s.id}|${v.rule}|${v.impact}|${v.context}`;
    seen.add(fp);
    if (s.tags.includes("redesign") && v.inContent) { redesignBlocking++; console.log(`BLOCK ${s.id}: ${v.rule} (${v.impact}) at ${v.context} inside redesigned content`); continue; }
    if (!known.has(fp)) fresh.push(fp);
  }
}
await browser.close(); await close();
const fixed = [...known].filter((fp) => !seen.has(fp));
if (args.has("--update")) { fs.writeFileSync(baselineFile, JSON.stringify({ recorded: new Date().toISOString(), fingerprints: [...seen].sort() }, null, 2) + "\n"); console.log(`a11y: baseline written with ${seen.size} inherited fingerprint(s)`); process.exit(0); }
for (const fp of fresh) console.log(`NEW   ${fp}`);
for (const fp of fixed) console.log(`fixed ${fp} (remove it from the baseline)`);
const failures = fresh.length + redesignBlocking + broken;
console.log(failures ? `a11y: ${fresh.length} new fingerprint(s), ${redesignBlocking} blocking in redesigned content` : `a11y: no new violations (${known.size} inherited on the ratchet)`);
process.exit(failures ? 1 : 0);
