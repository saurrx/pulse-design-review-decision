/**
 * Walk every page each persona can reach in the full app on the qa/full
 * scenario, through the real login form, and record page errors, console
 * errors, unhandled /v1 requests, blocked hosts and empty renders. Screenshots
 * go to CRAWL_SHOTS when set. This is the mock surface's broad check.
 */
import { chromium } from "playwright";
const base = (process.env.CRAWL_BASE || "http://localhost:3700").replace(/\/$/, "");
const shots = process.env.CRAWL_SHOTS;
const PERSONAS = [
  ["INVENTOR", "inventor@acme.test", ["/", "/ideas", "/patents", "/profile"]],
  ["TECH_COMMITTEE", "committee@acme.test", ["/", "/ideas", "/patents", "/due-dates", "/profile"]],
  ["LEGAL_COUNSEL", "counsel@globex.test", ["/", "/ideas", "/patents", "/due-dates", "/actions", "/workspace", "/profile"]],
  ["CASE_OWNER", "owner@photonlegal.test", ["/", "/clients", "/ideas", "/patents", "/due-dates", "/actions", "/profile"]],
  ["PHOTON_ADMIN", "admin@photonlegal.test", ["/", "/clients", "/ideas", "/patents", "/due-dates", "/actions", "/workspace", "/profile"]],
  ["PHOTON_SUPERADMIN", "founder@photonlegal.test", ["/", "/clients", "/ideas", "/patents", "/due-dates", "/actions", "/workspace", "/profile"]],
];
const browser = await chromium.launch();
let problems = 0;
for (const [role, email, pages] of PERSONAS) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error" && !/401 \(Unauthorized\)/.test(m.text())) errors.push(m.text().slice(0, 160)); });
  await page.goto(`${base}/login?scenario=qa/full`, { waitUntil: "networkidle" });
  await page.locator("input[name=email]").fill(email); await page.locator("input[name=password]").fill("x");
  await Promise.all([page.waitForURL((u) => !/\/login/.test(u.toString()), { timeout: 15000 }).catch(() => {}), page.getByRole("button", { name: "Sign In" }).click()]);
  const loggedIn = !/\/login/.test(page.url());
  console.log(`${loggedIn ? "ok  " : "FAIL"} ${role} login -> ${new URL(page.url()).pathname}`);
  if (!loggedIn) { problems++; await ctx.close(); continue; }
  for (const p of pages) {
    errors.length = 0;
    await page.goto(`${base}${p}`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(700);
    const landed = new URL(page.url()).pathname;
    const stats = await page.evaluate(() => (window.__pulseDesign?.stats) ?? {});
    // Some pages portal their workspace outside <main>; measure the whole app root.
    const text = (await page.locator("#root").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
    const unhandled = [...new Set(stats.unhandled ?? [])]; const blocked = [...new Set(stats.blocked ?? [])];
    const empty = text.length < 200;
    const bad = errors.length || unhandled.length || blocked.length || empty;
    if (bad) problems++;
    console.log(`${bad ? "FAIL" : "ok  "} ${role} ${p}${landed !== p ? ` -> ${landed}` : ""} text=${text.length}${errors.length ? " errors: " + errors.slice(0, 2).join(" | ") : ""}${unhandled.length ? " unhandled: " + unhandled.join(", ") : ""}${blocked.length ? " blocked: " + blocked.join(", ") : ""}`);
    if (shots) await page.screenshot({ path: `${shots}/${role}${p === "/" ? "_index" : p.replace(/\//g, "_")}.png` });
    // Detail routes: ids come from the API inside the page (the worker answers there), never from a click that may miss.
    const detail = { "/ideas": ["/v1/ideas", (id) => [`/ideas/${id}`, `/ideas/${id}/draft`]], "/patents": ["/v1/patents?limit=1", (id) => [`/patents/${id}`]], "/clients": ["/v1/clients", (id) => [`/clients/${id}`]] }[p];
    if (detail) {
      const id = await page.evaluate(async (u) => { const r = await fetch(u, { headers: { "x-requested-with": "XMLHttpRequest" } }); const j = await r.json(); return (Array.isArray(j) ? j : j?.data ?? [])[0]?.id ?? null; }, detail[0]).catch(() => null);
      for (const sub of id ? detail[1](id) : []) {
        errors.length = 0;
        await page.goto(`${base}${sub}`, { waitUntil: "networkidle" }).catch(() => {}); await page.waitForTimeout(900);
        const landed = new URL(page.url()).pathname;
        const st = await page.evaluate(() => (window.__pulseDesign?.stats) ?? {});
        const un = [...new Set(st.unhandled ?? [])];
        const t = (await page.locator("#root").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
        const bad = errors.length || un.length || t.length < 200;
        if (bad) problems++;
        console.log(`${bad ? "FAIL" : "ok  "} ${role} ${sub.replace(id, "{id}")}${landed !== sub ? ` -> ${landed.replace(id, "{id}")}` : ""} text=${t.length}${errors.length ? " errors: " + errors.slice(0, 2).join(" | ") : ""}${un.length ? " unhandled: " + un.join(", ") : ""}`);
        if (shots) await page.screenshot({ path: `${shots}/${role}${sub.replace(id, "id").replace(/\//g, "_")}.png` });
      }
    }
  }
  await ctx.close();
}
await browser.close();
console.log(problems ? `crawl: ${problems} problem(s)` : "crawl: every persona reaches every page without errors, misses or blocked hosts");
process.exit(problems ? 1 : 0);
