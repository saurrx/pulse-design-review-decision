/**
 * The two-persona isolation test. Two stories with different personas render
 * CONCURRENTLY in the same browser context, so they share the session cookie
 * and both storages exactly as Storybook frames do. Each is then forced to
 * refetch, and each must still show its own tenant's queue and navigation.
 */
import path from "node:path";
import { chromium } from "playwright";
import { serveStatic, blockEgress } from "./lib/serve.mjs";

const dir = path.resolve("storybook-static"); const port = 6022;
const close = await serveStatic(dir, port);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await blockEgress(context);
const open = async (id) => { const p = await context.newPage(); await p.goto(`http://localhost:${port}/iframe.html?id=${id}&viewMode=story`); await p.waitForSelector('body[data-story-ready="1"]', { timeout: 20_000 }); return p; };
const [committee, counsel] = await Promise.all([open("screens-review-queue--committee"), open("screens-review-queue--counsel")]);

// Force refetches in both frames after the other frame has written its cookie: click the "All" queue filter, then wait past a poll interval.
for (const p of [committee, counsel]) { await p.getByRole("button", { name: /^All/ }).click().catch(() => {}); }
await committee.waitForTimeout(6000);

const shots = process.env.ISOLATION_SHOTS;
// Data isolation: reference prefixes are tenant-specific (ACME- vs GLX-). Chrome isolation: the sidebar's persona name.
const check = async (page, who, ownPrefix, otherPrefix, personaName) => {
  const own = await page.getByText(new RegExp(`^${ownPrefix}-\\d{4}$`)).count();
  const other = await page.getByText(new RegExp(`^${otherPrefix}-\\d{4}$`)).count();
  const persona = await page.getByText(personaName).count();
  const data = own > 0 && other === 0;
  const chrome = persona > 0;
  console.log(`${data ? "ok  " : "FAIL"} ${who} data: ${own} own references, ${other} from the other tenant`);
  console.log(`${chrome ? "ok  " : "FAIL"} ${who} chrome: persona ${personaName} shown ${persona} time(s)`);
  if (shots) await page.screenshot({ path: `${shots}/isolation-${who.split(" ")[0]}.png` });
  return { data, chrome };
};
const a = await check(committee, "committee frame", "ACME", "GLX", "Tomás Ibarra");
const b = await check(counsel, "counsel frame", "GLX", "ACME", "Jun Sato");
await browser.close(); await close();
const dataOk = a.data && b.data, chromeOk = a.chrome && b.chrome;
console.log(`isolation: data ${dataOk ? "isolated (frame-local persona holds)" : "CONTAMINATED"}; chrome identity ${chromeOk ? "isolated" : "CONTAMINATED through the shared cookie"}`);
console.log(dataOk && chromeOk ? "isolation: parallel story tests would be safe" : "isolation: keep story tests serial");
process.exit(dataOk && chromeOk ? 0 : 1);
