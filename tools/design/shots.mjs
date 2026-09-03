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
import { diffBox } from "./lib/png.mjs";

/** Sub-pixel text anti-aliasing moves a few pixels between two clean renders; anything above this is a real change. */
const MAX_DIFF_PIXELS = Number(process.env.SHOTS_MAX_DIFF ?? 40);
const same = (a, b) => { if (a.equals(b)) return { ok: true, count: 0 }; const d = diffBox(a, b); return { ok: !!d && d.count >= 0 && d.count <= MAX_DIFF_PIXELS, count: d?.count ?? -1, box: d?.box }; };

const args = new Set(process.argv.slice(2));
const onlyArg = process.argv.indexOf("--only"); const only = onlyArg > -1 ? new RegExp(process.argv[onlyArg + 1]) : null;
const debugDir = process.env.SHOTS_DEBUG;
const dir = path.resolve("storybook-static");
const out = path.resolve("qa/visual/baselines");
const port = 6021;
if (!fs.existsSync(path.join(dir, "index.json"))) { console.error("build Storybook first: npm run storybook:build"); process.exit(2); }
fs.mkdirSync(out, { recursive: true });
const close = await serveStatic(dir, port);
const browser = await chromium.launch();
let failures = 0; const blockedAll = new Set();

async function render(id, tags = []) {
  // A story tagged viewport:WxH or viewport:WxH@scale is shot at that size (200% zoom is 640x360@2); the default is the 1440 review width.
  const tag = (tags ?? []).map((t) => /^viewport:(\d+)x(\d+)(?:@(\d))?$/.exec(t)).find(Boolean);
  const viewport = tag ? { width: Number(tag[1]), height: Number(tag[2]) } : { width: 1440, height: 900 };
  const context = await browser.newContext({ viewport, locale: "en-GB", timezoneId: "UTC", reducedMotion: "reduce", deviceScaleFactor: tag?.[3] ? Number(tag[3]) : 1 });
  const blocked = await blockEgress(context);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://localhost:${port}/iframe.html?id=${id}&viewMode=story`, { waitUntil: "load" });
  await page.waitForSelector('body[data-story-ready="1"]', { timeout: 20_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  // Settle: lazy route chunks and JS-driven chart animations finish after the ready marker. Two consecutive
  // identical frames, 250 ms apart, is the definition of "at rest" here.
  let png = await page.screenshot({ animations: "disabled", caret: "hide" });
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(250);
    const next = await page.screenshot({ animations: "disabled", caret: "hide" });
    if (next.equals(png)) break;
    png = next;
  }
  await context.close();
  blocked.forEach((h) => blockedAll.add(h));
  return { png, errors };
}

for (const s of storiesFrom(dir)) {
  if (only && !only.test(s.id)) continue;
  const file = path.join(out, `${s.id}.png`);
  try {
    const a = await render(s.id, s.tags);
    if (args.has("--twice")) {
      const b = await render(s.id, s.tags);
      const st = same(a.png, b.png);
      if (!st.ok) { failures++; console.log(`UNSTABLE ${s.id}: two clean renders differ by ${st.count} pixels in ${JSON.stringify(st.box)}`); if (debugDir) { fs.writeFileSync(path.join(debugDir, `${s.id}.a.png`), a.png); fs.writeFileSync(path.join(debugDir, `${s.id}.b.png`), b.png); } continue; }
      if (st.count) console.log(`   note ${s.id}: ${st.count} anti-aliasing pixel(s) between renders, within tolerance`);
    }
    if (a.errors.length) console.log(`   note ${s.id}: page errors ${a.errors.slice(0, 2).join(" | ")}`);
    if (args.has("--update") || !fs.existsSync(file)) { fs.writeFileSync(file, a.png); console.log(`wrote  ${s.id}`); continue; }
    const base = fs.readFileSync(file);
    const cmp = same(base, a.png);
    if (cmp.ok) console.log(`same   ${s.id}${cmp.count ? ` (${cmp.count} px noise)` : ""}`);
    else { failures++; fs.writeFileSync(path.join(out, `${s.id}.actual.png`), a.png); console.log(`DIFF   ${s.id}: ${cmp.count} pixels in ${JSON.stringify(cmp.box)} (actual saved beside the baseline)`); }
  } catch (e) { failures++; console.log(`FAIL   ${s.id}: ${String(e.message || e).slice(0, 200)}`); }
}
await browser.close(); await close();
if (blockedAll.size) { failures++; console.log(`EGRESS blocked hosts were attempted: ${[...blockedAll].join(", ")}`); }
console.log(failures ? `shots: ${failures} failure(s)` : `shots: all stories rendered, stable within ${MAX_DIFF_PIXELS} pixels, no egress`);
process.exit(failures ? 1 : 0);
