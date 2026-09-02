/**
 * Screenshot every story from the static Storybook build, one fresh browser
 * context per story, egress blocked at the browser, after the harness ready
 * marker. `--update` writes baselines under qa/visual/baselines; otherwise
 * compares pixel-for-pixel and fails on any difference. `--twice` renders each
 * story twice in two contexts and fails if the two renders differ, which is
 * the stability proof the spike requires.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { serveStatic, storiesFrom, blockEgress } from "./lib/serve.mjs";

const args = new Set(process.argv.slice(2));
const dir = path.resolve("storybook-static");
const out = path.resolve("qa/visual/baselines");
const port = 6021;
if (!fs.existsSync(path.join(dir, "index.json"))) { console.error("build Storybook first: npm run storybook:build"); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const close = await serveStatic(dir, port);
const browser = await chromium.launch();
let failures = 0; const blockedAll = new Set();

async function render(id) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-GB", timezoneId: "UTC", reducedMotion: "reduce", deviceScaleFactor: 1 });
  const blocked = await blockEgress(context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/iframe.html?id=${id}&viewMode=story`, { waitUntil: "load" });
  await page.waitForSelector('body[data-story-ready="1"]', { timeout: 20_000 });
  await page.waitForTimeout(250);
  const png = await page.screenshot({ animations: "disabled", caret: "hide" });
  await context.close();
  blocked.forEach((h) => blockedAll.add(h));
  return { png, errors };
}

for (const s of storiesFrom(dir)) {
  const file = path.join(out, `${s.id}.png`);
  try {
    const a = await render(s.id);
    if (args.has("--twice")) {
      const b = await render(s.id);
      if (!a.png.equals(b.png)) { failures++; console.log(`UNSTABLE ${s.id}: two clean renders differ`); continue; }
    }
    if (a.errors.length) console.log(`   note ${s.id}: page errors ${a.errors.slice(0, 2).join(" | ")}`);
    if (args.has("--update") || !fs.existsSync(file)) { fs.writeFileSync(file, a.png); console.log(`wrote  ${s.id}`); continue; }
    const base = fs.readFileSync(file);
    if (base.equals(a.png)) console.log(`same   ${s.id}`);
    else { failures++; fs.writeFileSync(path.join(out, `${s.id}.actual.png`), a.png); console.log(`DIFF   ${s.id} (actual saved beside the baseline)`); }
  } catch (e) { failures++; console.log(`FAIL   ${s.id}: ${String(e.message || e).slice(0, 200)}`); }
}
await browser.close(); await close();
if (blockedAll.size) { failures++; console.log(`EGRESS blocked hosts were attempted: ${[...blockedAll].join(", ")}`); }
console.log(failures ? `shots: ${failures} failure(s)` : "shots: all stories rendered, stable, no egress");
process.exit(failures ? 1 : 0);
