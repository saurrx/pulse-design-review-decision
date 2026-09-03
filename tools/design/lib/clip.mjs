/** Render one story twice in fresh contexts and save a scaled clip of a region from each. Debugging aid for unstable screenshots. */
import path from "node:path";
import { chromium } from "playwright";
import { serveStatic } from "./serve.mjs";
const [id, x, y, w, h, outDir] = process.argv.slice(2);
const close = await serveStatic(path.resolve("storybook-static"), 6041);
const browser = await chromium.launch();
for (const tag of ["a", "b"]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 4, locale: "en-GB", timezoneId: "UTC", reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`http://localhost:6041/iframe.html?id=${id}&viewMode=story`);
  await page.waitForSelector('body[data-story-ready="1"]', { timeout: 20000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, `${id}.${tag}.clip.png`), clip: { x: Number(x), y: Number(y), width: Number(w), height: Number(h) }, animations: "disabled" });
  const html = await page.evaluate(([cx, cy]) => { const el = document.elementFromPoint(cx, cy); return el ? el.outerHTML.slice(0, 300) : "none"; }, [Number(x) + Number(w) / 2, Number(y) + Number(h) / 2]);
  console.log(tag, "element at centre:", html.replace(/\s+/g, " "));
  await context.close();
}
await browser.close(); await close();
