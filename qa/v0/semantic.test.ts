/**
 * The V0 semantic gate. Fails when the V0 layer drifts from product-context:
 * more or fewer than four personas, a committee or superadmin persona, a
 * technical review stage, a surface brief missing from the coverage matrix,
 * an Inventor who can reach Actions or due dates, an excluded feature, an
 * evaluation that gates submission, or a badge outside Workspace Admin review.
 * Conceptual behaviours the mock models must be declared as future contracts.
 * @tier:v0
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { setupServer } from "msw/node";
import { handlers } from "../../mock/handlers";
import { SCENARIOS } from "../../mock/scenarios";
import { V0_SCENARIOS } from "../../mock/scenarios/v0";
import { V0_PERSONA_LABELS } from "../../mock/scenarios/v0/personas";
import { resetDb, getDb } from "../../mock/runtime/db";
import { clock } from "../../mock/runtime/clock";
import { setFramePersona } from "../../mock/runtime/session";
import { render } from "../../tools/design/v0-coverage.mjs";

const FOUR = ["INVENTOR", "LEGAL_COUNSEL", "CASE_OWNER", "PHOTON_ADMIN"].sort();
const LABELS = ["Inventor", "Workspace Admin", "Case Owner", "Photon Admin"].sort();
const PERSONA_KEYS = ["INVENTOR", "WORKSPACE_ADMIN", "CASE_OWNER", "PHOTON_ADMIN"].sort();
const EXCLUDED = /assistant|world[ -]?map|checkout|billing|purchas|pricing|price[ -]selection|invoice|notification[ -](center|centre)|notification[ -]bell|trademark|cost[ -]visibility|leaderboard|score[ -]cutoff/i;
const IMPACT = ["none", "unwired", "conceptual"];

type Coverage = {
  personas: Record<string, { label: string; backendRole: string }>;
  navigation: Record<string, string[]>;
  badges: Record<string, Record<string, string>>;
  surfaces: Array<{ brief: string; title: string; storyTitle: string; personas: string[]; userGoal: string; businessGoal: string; routes: Array<{ path: string; personas: string[]; exists: boolean }>; scenarios: string[]; states: Record<string, unknown> & { specific: string[] }; badge: string; badgePersonas?: string[]; backendImpact: string; backendNotes: string; storyIds: string[]; excludes: string[]; dsn: string | null }>;
};
const coverage = JSON.parse(readFileSync("design/v0/coverage.json", "utf8")) as Coverage;
const proposed = JSON.parse(readFileSync("mock/proposed-fields.json", "utf8")) as { fields: Array<{ entity: string; field: string; finding: string; reason: string }>; collections: Array<{ name: string; finding: string; reason: string }>; policies: Array<{ name: string; routes: string[]; finding: string; reason: string }> };
const V0 = Object.values(V0_SCENARIOS);

const seed = (name: string) => { const s = V0_SCENARIOS[name] ?? SCENARIOS[name]; clock.set(s.clock); resetDb(s, { persist: false, fresh: true }); return getDb(); };
const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => setFramePersona(null));
const req = async (method: string, url: string, body?: unknown) => {
  const r = await fetch(`http://localhost${url}`, { method, headers: { "content-type": "application/json", "x-requested-with": "XMLHttpRequest" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let data: unknown = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: r.status, data: data as { data?: Record<string, unknown>; message?: string } };
};

describe("four personas, one review stage", () => {
  it("the V0 scenarios expose exactly the four personas and every named persona exists", () => {
    const roles = new Set<string>();
    for (const s of V0) {
      const db = seed(s.name);
      expect(s.name.startsWith("v0/"), s.name).toBe(true);
      expect(db.flags.v0, `${s.name} flags.v0`).toBe(true);
      for (const email of [s.defaultPersona, ...s.personas]) { const u = db.users.find((x) => x.email === email); expect(u, `${s.name}: ${email}`).toBeTruthy(); roles.add(u!.role); }
    }
    expect([...roles].sort()).toEqual(FOUR);
  });
  it("no committee or superadmin account exists in any V0 store", () => {
    for (const s of V0) { const db = seed(s.name); for (const u of db.users) expect(FOUR, `${s.name}: ${u.email} is ${u.role}`).toContain(u.role); }
  });
  it("the persona labels are the four V0 names, in the matrix and in the mock", () => {
    expect(Object.values(V0_PERSONA_LABELS).sort()).toEqual(LABELS);
    expect(Object.keys(coverage.personas).sort()).toEqual(PERSONA_KEYS);
    expect(Object.values(coverage.personas).map((p) => p.label).sort()).toEqual(LABELS);
    expect(Object.values(coverage.personas).map((p) => p.backendRole).sort()).toEqual(FOUR);
    for (const label of Object.values(V0_PERSONA_LABELS)) expect(label).not.toMatch(/committee|superadmin|counsel/i);
  });
  it("every V0 client has no technical committee", () => {
    for (const s of V0) { const db = seed(s.name); expect(db.clients.length).toBeGreaterThan(0); for (const c of db.clients) expect(c.has_tech_committee, `${s.name}: ${c.name}`).toBe(false); }
  });
  it("no V0 idea passes through a technical review stage", () => {
    for (const s of V0) {
      const db = seed(s.name);
      for (const i of db.ideas) expect(i.state, `${s.name}: ${i.reference}`).not.toBe("TECH_REVIEW");
      for (const t of db.transitions) expect(t.stage, `${s.name}: transition ${t.to_state}`).not.toBe("TECHNICAL");
      for (const i of db.ideas.filter((x) => x.state !== "DRAFT")) {
        const first = db.transitions.filter((t) => t.idea_id === i.id && t.from_state === null).sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
        expect(first?.to_state, `${s.name}: ${i.reference} first stage`).toBe("LEGAL_REVIEW");
      }
    }
  });
});

describe("coverage matrix", () => {
  const briefs = readdirSync("product-context/surfaces").filter((f) => f.endsWith(".md")).map((f) => `surfaces/${f}`).sort();
  it("covers every surface brief exactly once", () => {
    expect(coverage.surfaces.map((s) => s.brief).sort()).toEqual(briefs);
    for (const s of coverage.surfaces) expect(existsSync(path.join("product-context", s.brief)), s.brief).toBe(true);
  });
  it("every surface records personas, goals, routes, scenarios, states, impact and story ids", () => {
    for (const s of coverage.surfaces) {
      const at = s.brief;
      expect(s.personas.length, at).toBeGreaterThan(0);
      for (const p of s.personas) expect(PERSONA_KEYS, `${at}: ${p}`).toContain(p);
      expect(s.userGoal.length, at).toBeGreaterThan(10);
      expect(s.businessGoal.length, at).toBeGreaterThan(10);
      expect(s.routes.length, at).toBeGreaterThan(0);
      for (const r of s.routes) { expect(r.path.startsWith("/"), `${at}: ${r.path}`).toBe(true); for (const p of r.personas) expect(s.personas, `${at}: route ${r.path} persona ${p}`).toContain(p); }
      expect(s.scenarios.length, at).toBeGreaterThan(0);
      for (const name of s.scenarios) expect(V0_SCENARIOS[name], `${at}: scenario ${name}`).toBeTruthy();
      for (const k of ["loading", "empty", "success", "error", "permission"]) expect(typeof s.states[k], `${at}: state ${k}`).toBe("string");
      expect(s.states.specific.length, at).toBeGreaterThan(0);
      expect(IMPACT, `${at}: ${s.backendImpact}`).toContain(s.backendImpact);
      expect(s.backendNotes.length, at).toBeGreaterThan(0);
      expect(s.storyIds.length, at).toBeGreaterThan(0);
      for (const id of s.storyIds) { expect(id.startsWith("surfaces-"), `${at}: ${id}`).toBe(true); expect(id.startsWith("legacy-reference-"), `${at}: ${id}`).toBe(false); }
      expect(s.storyTitle.startsWith("Surfaces/"), at).toBe(true);
    }
  });
  it("no legacy story is presented as a V0 story", () => {
    const legacyIds = new Set<string>();
    if (existsSync("storybook-static/index.json")) for (const e of Object.values(JSON.parse(readFileSync("storybook-static/index.json", "utf8")).entries as Record<string, { id: string }>)) if (e.id.startsWith("legacy-reference-")) legacyIds.add(e.id);
    for (const s of coverage.surfaces) { for (const id of s.storyIds) expect(legacyIds.has(id), id).toBe(false); expect(s.dsn === null || typeof s.dsn === "string", s.brief).toBe(true); }
  });
  it("the rendered COVERAGE.md is current", () => {
    expect(readFileSync("design/v0/COVERAGE.md", "utf8")).toBe(render(coverage));
  });
});

describe("Inventors never see Actions or due dates", () => {
  it("the matrix offers no Actions or due-dates route to the Inventor and no such navigation entry", () => {
    for (const s of coverage.surfaces) for (const r of s.routes) if (/^\/(actions|due-dates)/.test(r.path)) expect(r.personas, `${s.brief}: ${r.path}`).not.toContain("INVENTOR");
    for (const item of coverage.navigation.INVENTOR) expect(item).not.toMatch(/actions|due dates/i);
  });
  it("the mock refuses due dates and Actions to an Inventor in every V0 scenario", async () => {
    for (const s of V0) {
      const db = seed(s.name);
      db.flags.latencyMs = 0; // authorization is under test, not the slow scenario's delay
      const inventor = db.users.find((u) => u.role === "INVENTOR" && u.status === "ACTIVE");
      if (!inventor) continue;
      setFramePersona(inventor.email);
      for (const url of ["/v1/due-dates", "/v1/actions", "/v1/actions/queue", "/v1/actions/templates"]) {
        const r = await req("GET", url);
        expect(r.status, `${s.name}: ${inventor.email} GET ${url}`).toBe(403);
      }
      setFramePersona(null);
    }
  }, 30_000);
});

describe("excluded features stay out", () => {
  it("no route, navigation entry, story id, state or scenario in the matrix names an excluded feature", () => {
    for (const [persona, items] of Object.entries(coverage.navigation)) for (const item of items) expect(item, `${persona} navigation`).not.toMatch(EXCLUDED);
    for (const s of coverage.surfaces) {
      for (const r of s.routes) expect(r.path, s.brief).not.toMatch(EXCLUDED);
      for (const id of s.storyIds) expect(id, s.brief).not.toMatch(EXCLUDED);
      for (const st of s.states.specific) expect(st, s.brief).not.toMatch(EXCLUDED);
      for (const name of s.scenarios) expect(name, s.brief).not.toMatch(EXCLUDED);
      expect(s.title, s.brief).not.toMatch(EXCLUDED);
    }
  });
  it("the V0 scenario sources and any V0 story implement none of them", () => {
    const files: string[] = [];
    const walk = (dir: string) => { if (!existsSync(dir)) return; for (const f of readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, f.name); if (f.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(f.name)) files.push(p); } };
    walk("mock/scenarios/v0"); walk("design/stories/surfaces");
    const CODE = /worldMap|WorldMap|checkout|billing|invoice|priceSelection|pricing|notificationCenter|NotificationBell|AssistantPage|assistant|trademark|leaderboard/;
    for (const f of files) {
      const code = readFileSync(f, "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
      expect(code, f).not.toMatch(CODE);
    }
  });
});

describe("evaluation is optional and never a gate", () => {
  it("submitted ideas exist without an evaluation and with a low score", () => {
    const db = seed("v0/inventor/portfolio");
    const submitted = db.ideas.filter((i) => i.state !== "DRAFT");
    const withoutEvaluation = submitted.filter((i) => !db.evaluations.some((e) => db.drafts.some((d) => d.id === e.draft_id && d.idea_id === i.id)));
    const lowScore = submitted.filter((i) => db.drafts.some((d) => d.idea_id === i.id && d.score !== null && d.score <= 30));
    expect(withoutEvaluation.length).toBeGreaterThan(0);
    expect(lowScore.length).toBeGreaterThan(0);
  });
  it("the mock accepts a complete draft for review without an evaluation", async () => {
    const db = seed("v0/inventor/portfolio");
    const inventor = db.users.find((u) => u.email === "inventor@northwind.test")!;
    const draft = db.drafts.find((d) => d.status === "DRAFT" && d.api_evaluation_id === null && Number((d.answers as { __completion?: number }).__completion ?? 0) === 100 && db.ideas.some((i) => i.id === d.idea_id && i.author_id === inventor.id));
    expect(draft, "a complete, unevaluated draft by the inventor").toBeTruthy();
    setFramePersona(inventor.email);
    const r = await req("POST", `/v1/drafts/${draft!.id}/submit`, {});
    expect(r.status, r.data?.message).toBeLessThan(300);
    expect(getDb().ideas.find((i) => i.id === draft!.idea_id)?.state).toBe("LEGAL_REVIEW");
  });
});

describe("badges", () => {
  it("only Workspace Admin review carries a navigation badge", () => {
    expect(Object.keys(coverage.badges)).toEqual(["WORKSPACE_ADMIN"]);
    expect(coverage.badges.WORKSPACE_ADMIN).toEqual({ Ideas: "pending-review" });
    for (const s of coverage.surfaces) {
      if (s.badge === "none") { expect(s.badgePersonas ?? []).toEqual([]); continue; }
      expect(s.badge, s.brief).toBe("pending-review");
      expect(s.badgePersonas, s.brief).toEqual(["WORKSPACE_ADMIN"]);
      expect(s.brief).toBe("surfaces/ideas.md");
    }
  });
});

describe("conceptual contracts are declared, modelled in V0 and refused in the legacy tier", () => {
  it("the submitter identity and the email outbox are declared as future backend contracts", () => {
    expect(proposed.fields.find((f) => f.entity === "Idea" && f.field === "submitted_by_id")?.finding).toMatch(/BF-1/);
    expect(proposed.fields.find((f) => f.entity === "Idea" && f.field === "inventor_id")?.finding).toMatch(/BF-1/);
    expect(proposed.collections.find((c) => c.name === "emails")?.finding).toMatch(/BF-3/);
    expect(proposed.policies.find((p) => p.name === "inventor-no-docket")?.finding).toMatch(/BF-4/);
  });
  it("a Workspace Admin submits on behalf of an inventor in a V0 scenario, attributed separately", async () => {
    const db = seed("v0/workspace-admin/queue");
    const admin = db.users.find((u) => u.email === "admin@northwind.test")!;
    const inventor = db.users.find((u) => u.email === "coinventor@northwind.test")!;
    setFramePersona(admin.email);
    const r = await req("POST", "/v1/ideas", { title: "Sealed bearing with in-situ wear sensing", inventor_id: inventor.id });
    expect(r.status, r.data?.message).toBe(201);
    const idea = getDb().ideas.find((i) => i.title === "Sealed bearing with in-situ wear sensing")!;
    expect(idea.author_id).toBe(inventor.id);
    expect(idea.submitted_by_id).toBe(admin.id);
    expect(getDb().inventors.find((x) => x.idea_id === idea.id && x.role === "PRIMARY")?.inventor_id).toBe(inventor.id);
    const seeded = db.ideas.find((i) => i.submitted_by_id && i.submitted_by_id !== i.author_id);
    expect(seeded, "a seeded on-behalf idea").toBeTruthy();
  });
  it("every V0 scenario carries the activation outbox its state implies", () => {
    for (const s of V0) { const db = seed(s.name); expect(Array.isArray(db.emails), s.name).toBe(true); }
    const empty = seed("v0/workspace-admin/empty");
    expect(empty.emails!.some((e) => e.kind === "admin-no-inventors")).toBe(true);
    const first = seed("v0/inventor/first-run");
    expect(first.emails!.some((e) => e.kind === "inventor-login-reminder-24h")).toBe(true);
    expect(first.emails!.some((e) => e.kind === "inventor-browsed-no-start")).toBe(true);
    const queue = seed("v0/workspace-admin/queue");
    expect(queue.emails!.some((e) => e.kind === "admin-weekly-pending-digest" && /^\d+ ideas? waiting/.test(e.subject))).toBe(true);
  });
  it("the legacy tier still serves what the backend serves: an inventor can list due dates there", async () => {
    const db = seed("qa/full");
    const inventor = db.users.find((u) => u.role === "INVENTOR" && u.status === "ACTIVE")!;
    setFramePersona(inventor.email);
    expect((await req("GET", "/v1/due-dates")).status).toBe(200);
  });
  it("the legacy tier still refuses what the backend refuses", async () => {
    const db = seed("counsel/queue");
    const counsel = db.users.find((u) => u.role === "LEGAL_COUNSEL")!;
    setFramePersona(counsel.email);
    const r = await req("POST", "/v1/ideas", { title: "Not allowed here", inventor_id: db.users.find((u) => u.role === "INVENTOR")!.id });
    expect(r.status).toBe(403);
    expect(db.emails).toBeUndefined();
  });
});
