import { chromium } from "playwright";
const base = (process.env.SMOKE_BASE || "http://localhost:3700").replace(/\/$/, "");
const baseHost = new URL(base).host;
const shots = "/private/tmp/claude-501/-Users-saurabh-PL-pulsemain/a5b7f644-bc51-4732-ae5b-d1ba69131cab/scratchpad/shots";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const external = new Set(); const errors = []; const v1 = [];
page.on("request", (r) => { const u = new URL(r.url()); if (u.host !== baseHost) external.add(u.host); else if (u.pathname.startsWith("/v1")) v1.push(`${r.method()} ${u.pathname}${u.search}`); });
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 200)));
const step = async (name, fn) => { try { await fn(); console.log("ok  ", name); } catch (e) { console.log("FAIL", name, "-", String(e.message || e).slice(0, 300)); } };

await step("login page renders on mock", async () => {
  await page.goto(base + "/login?scenario=committee/queue", { waitUntil: "networkidle" });
  await page.waitForSelector("#design-tools", { state: "attached", timeout: 15000 });
  await page.getByRole("region", { name: "Design tools" }).waitFor();
  await page.getByRole("heading", { name: "Sign in" }).waitFor();
  await page.screenshot({ path: `${shots}/01-login.png` });
});
await step("wrong email is refused with a visible error", async () => {
  await page.locator("input[name=email]").fill("nobody@acme.test");
  await page.locator("input[name=password]").fill("x");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.getByText("Invalid email or password.").first().waitFor({ timeout: 8000 });
});
await step("committee persona logs in and lands on the dashboard", async () => {
  await page.locator("input[name=email]").fill("committee@acme.test");
  await page.locator("input[name=password]").fill("any");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(base + "/", { timeout: 15000 });
  await page.waitForLoadState("networkidle");
  await page.getByText("Tomás Ibarra").first().waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${shots}/02-dashboard-committee.png` });
});
await step("review queue renders the committee's ideas and the header portal", async () => {
  await page.getByRole("link", { name: /Review queue/ }).click();
  await page.waitForURL(base + "/ideas");
  await page.waitForLoadState("networkidle");
  await page.getByText("Self-tensioning cable harness", { exact: false }).first().waitFor({ timeout: 10000 });
  const title = await page.locator("header h1, header [class*=title], main header").first().textContent().catch(() => "");
  console.log("     header text:", (title || "").trim().slice(0, 80));
  await page.screenshot({ path: `${shots}/03-review-queue.png` });
});
await step("a decision moves the idea and the queue badge refetches", async () => {
  const badge = async () => Number(((await page.getByRole("link", { name: /Review queue/ }).textContent()) || "").replace(/\D/g, "") || 0);
  const before = await badge();
  await page.getByRole("button", { name: /Send to Legal Counsel/ }).first().click();
  await page.getByText(/Approved and sent/).first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(800);
  const after = await badge();
  console.log("     review badge before/after:", before, after);
  if (after !== before - 1) throw new Error(`badge went ${before} -> ${after}`);
});
await step("counsel persona via the chip sees the counsel queue", async () => {
  await page.goto(base + "/ideas?scenario=counsel/queue&role=LEGAL_COUNSEL", { waitUntil: "networkidle" });
  await page.getByText("Jun Sato").first().waitFor({ timeout: 10000 });
  await page.getByText("Graded-porosity ceramic filter", { exact: false }).first().waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${shots}/04-review-queue-counsel.png` });
});
console.log("external hosts contacted:", external.size ? [...external].join(", ") : "none");
console.log("v1 requests seen:", v1.length, "distinct:", [...new Set(v1.map((x) => x.split("?")[0]))].length);
console.log("console errors:", errors.length); for (const e of errors.slice(0, 12)) console.log("  -", e);
await browser.close();
