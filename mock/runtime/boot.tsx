/**
 * The design fork's entry. Selected by vite.design.config.ts in place of
 * /src/main.tsx. Order matters: seed the store, install the mock clock, start
 * the worker, write the persona cookie if asked, mount the chip, and only then
 * import the production entry so its first request is already intercepted.
 */
import { SCENARIOS, DEFAULT_SCENARIO } from "../scenarios";
import { resetDb, getDb } from "./db";
import { clock, installFakeDate } from "./clock";
import { createWorker, WORKER_OPTIONS } from "./worker";
import { readSelection, writeSessionCookie, readSessionUser } from "./session";
import { mountChip } from "./chip";
// The vendored typeface. Bundled here so the build emits the font files as assets; the design Vite config strips the Google Fonts links from index.html.
import "../../design/fonts/fonts.css";

async function main() {
  const sel = readSelection(DEFAULT_SCENARIO);
  const scenario = SCENARIOS[sel.scenario] ?? SCENARIOS[DEFAULT_SCENARIO];
  clock.set(scenario.clock);
  installFakeDate();
  resetDb(scenario, { persist: true });

  const worker = createWorker();
  await worker.start(WORKER_OPTIONS);

  // A deep link may name a persona (?persona=email or ?role=ROLE); otherwise the session cookie decides, as in production.
  if (sel.persona) {
    const db = getDb();
    // By email, else by role, preferring the scenario's own personas so a tenant-scoped role resolves inside the right tenant.
    const byRole = (list: typeof db.users) => list.find((x) => x.role === sel.persona);
    const u = db.users.find((x) => x.email === sel.persona)
      ?? byRole(db.users.filter((x) => scenario.personas.includes(x.email)))
      ?? byRole(db.users);
    if (u && readSessionUser()?.email !== u.email) writeSessionCookie(u, db);
    const url = new URL(location.href); url.searchParams.delete("scenario"); url.searchParams.delete("persona"); url.searchParams.delete("role");
    history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  mountChip(scenario.name);
  await import("../../src/main.tsx");
}

main().catch((err) => {
  console.error("[pulse-design] boot failed", err);
  document.body.innerHTML = `<pre style="padding:16px;font:12px ui-monospace,monospace">pulse-design boot failed:\n${String(err)}</pre>`;
});
