/** Open one story from the static build and print what it renders, requests and logs. `node tools/design/story-debug.mjs <story-id>` */
import path from "node:path";
import { chromium } from "playwright";
import { serveStatic } from "./lib/serve.mjs";
const id = process.argv[2]; if (!id) { console.error("story id required"); process.exit(2); }
const close = await serveStatic(path.resolve("storybook-static"), 6031);
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const reqs = []; const errors = [];
page.on("request", (r) => { const u = new URL(r.url()); if (u.pathname.startsWith("/v1")) reqs.push(`${r.method()} ${u.pathname}${u.search}`); });
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("pageerror " + e.message.slice(0, 200)));
await page.goto(`http://localhost:6031/iframe.html?id=${id}&viewMode=story`);
await page.waitForSelector('body[data-story-ready="1"]', { timeout: 20000 }).catch(() => console.log("no ready marker"));
await page.waitForTimeout(Number(process.env.WAIT_MS ?? 2500));
console.log("TEXT:", (await page.locator("#storybook-root").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 700));
console.log("REQUESTS:", reqs.join(" | ") || "none");
console.log("CONSOLE:", errors.slice(0, 6).join(" || ") || "none");
if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
await browser.close(); await close();
