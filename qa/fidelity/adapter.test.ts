/**
 * Adapter-boundary fidelity. Every mock response is driven through
 * production's real adapter (src/lib/realAdapter.ts) exactly as the screens
 * call it, and the result is asserted against the fields the screens read.
 * Request bodies the adapter produces are checked against the pinned OpenAPI
 * schemas; the review chain is checked against the declared state machine.
 * @tier:fidelity
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import YAML from "yaml";
import { readFileSync } from "node:fs";
import { handlers } from "../../mock/handlers";
import { SCENARIOS } from "../../mock/scenarios";
import { resetDb, getDb } from "../../mock/runtime/db";
import { clock } from "../../mock/runtime/clock";
import { setFramePersona } from "../../mock/runtime/session";
import { makeRealAdapter } from "@/lib/realAdapter";
import { PATENT_LEGAL_STATUS_VALUES } from "@/utils/patentLegalStatus";

const server = setupServer(...handlers);
const calls: Array<{ method: string; url: string; body: unknown }> = [];
type Res = { status: number; data: unknown };
const err = (status: number, data: unknown) => Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });
async function call(method: string, url: string, body?: unknown): Promise<Res> {
  calls.push({ method: method.toUpperCase(), url, body });
  const r = await fetch(`http://localhost${url}`, { method: method.toUpperCase(), headers: { "content-type": "application/json", "x-requested-with": "XMLHttpRequest" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let data: unknown = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (r.status >= 400) throw err(r.status, data);
  return { status: r.status, data };
}
// The adapter dispatches through `real.request({ url, method, data })`, exactly as with axios.
const stubAxios = { defaults: { baseURL: "" }, interceptors: {}, request: (cfg: { url: string; method?: string; data?: unknown }) => call(cfg.method ?? "get", cfg.url, cfg.data) };
const API = makeRealAdapter(stubAxios as never) as unknown as typeof stubAxios;
const spec = YAML.parse(readFileSync("contract/openapi.yaml", "utf8")) as { paths: Record<string, Record<string, { requestBody?: { content?: Record<string, { schema?: { required?: string[]; properties?: Record<string, unknown> } }> } }>> };

const as = (email: string) => setFramePersona(email);
const seed = (name: string) => { const s = SCENARIOS[name]; clock.set(s.clock); resetDb(s, { persist: false, fresh: true }); return getDb(); };
const body = (r: Res) => (r.data as { data: never }).data;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe("session", () => {
  beforeEach(() => seed("qa/full"));
  it("login gives client roles a real client id and Photon roles the sentinel", async () => {
    const inv = body(await API.post("/api/v1/auth/login", { email: "inventor@acme.test", password: "x" })) as { user: { client_id: string; client: { name: string }; role: string } };
    expect(inv.user.client_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(inv.user.client.name).toBe("Acme Robotics");
    const admin = body(await API.post("/api/v1/auth/login", { email: "admin@photonlegal.test", password: "x" })) as { user: { client_id: string } };
    expect(admin.user.client_id).toBe("photon-legal");
  });
  it("an unknown account is refused with a message the screen shows", async () => {
    await expect(API.post("/api/v1/auth/login", { email: "nobody@acme.test", password: "x" })).rejects.toMatchObject({ response: { status: 401, data: { message: "Invalid email or password." } } });
  });
});

describe("ideas and drafts, as the screens read them", () => {
  beforeEach(() => { seed("committee/queue"); as("committee@acme.test"); });
  it("the review queue rows carry the old dialect the screen reads", async () => {
    const r = body(await API.get("/api/v1/idea/fetch-by-user?page=1&limit=100&sort=submission_date&order=asc&status=UNDER_REVIEW")) as Array<Record<string, unknown>>;
    expect(r.length).toBeGreaterThan(0);
    for (const i of r) {
      expect(i.status).toBe("UNDER_REVIEW");
      expect(i.reference_number).toMatch(/^ACME-\d{4}$/);
      expect(i.submission_date).toBeTruthy();
      expect(Array.isArray(i.IdeaInventor)).toBe(true);
      expect((i.client as { name: string }).name).toBe("Acme Robotics");
      expect((i.created_by as { name: string }).name).toBeTruthy();
    }
  });
  it("drafts carry the score log, sections and completion", async () => {
    const ideas = body(await API.get("/api/v1/idea/fetch-by-user?limit=100&status=UNDER_REVIEW")) as Array<{ id: string }>;
    const drafts = body(await API.get(`/api/v1/idea/fetch-drafts/${ideas[0].id}`)) as Array<Record<string, unknown>>;
    expect(drafts.length).toBe(1);
    const d = drafts[0];
    expect(d.completion_percentage).toBe(100);
    expect((d.meta_data as Array<{ questions: Array<{ answer: string }> }>)[0].questions[0].answer).toBeTruthy();
    expect((d.CheckDraftSoreLog as Array<{ score: number }>)[0].score).toBeGreaterThan(0);
    expect((d.idea as { status: string }).status).toBe("UNDER_REVIEW");
  });
  it("the evaluation read carries the report under the old name", async () => {
    const ideas = body(await API.get("/api/v1/idea/fetch-by-user?limit=100&status=UNDER_REVIEW")) as Array<{ id: string }>;
    const drafts = body(await API.get(`/api/v1/idea/fetch-drafts/${ideas[0].id}`)) as Array<{ id: string }>;
    const ev = body(await API.get(`/api/v1/idea/fetch-score/${drafts[0].id}`)) as { status: string; score_meta_data: { scoringResult: { closestMatches: unknown[]; summary: string } } };
    expect(ev.status).toBe("COMPLETE");
    expect(ev.score_meta_data.scoringResult.closestMatches.length).toBeGreaterThan(0);
    expect(ev.score_meta_data.scoringResult.summary).toBeTruthy();
  });
  it("counts come back keyed by the old status vocabulary", async () => {
    const c = body(await API.get("/api/v1/idea/counts")) as Record<string, number>;
    expect(c.UNDER_REVIEW).toBe(6);
    expect(c.UPDATE_REQUEST).toBe(1);
  });
});

describe("the review chain, per the declared state machine", () => {
  beforeEach(() => seed("committee/queue"));
  const ideaIn = (state: string) => getDb().ideas.find((i) => i.state === state)!;
  it("counsel cannot act at the committee stage, and the committee cannot act at legal", async () => {
    as("counsel@acme.test");
    await expect(API.post(`/api/v1/idea/reject-from-ihc/${ideaIn("TECH_REVIEW").id}`, { reject_reason: "no" })).rejects.toMatchObject({ response: { status: 403 } });
    as("committee@acme.test");
    await expect(API.post(`/api/v1/idea/add-update-request/${ideaIn("LEGAL_REVIEW").id}`, { note: "x" })).rejects.toMatchObject({ response: { status: 403 } });
  });
  it("a rejection or a change request needs a comment", async () => {
    as("committee@acme.test");
    await expect(API.post(`/api/v1/idea/reject-from-ihc/${ideaIn("TECH_REVIEW").id}`, {})).rejects.toMatchObject({ response: { status: 400 } });
  });
  it("approvals walk the chain to filing", async () => {
    const idea = ideaIn("TECH_REVIEW");
    const draft = getDb().drafts.find((d) => d.idea_id === idea.id)!;
    as("committee@acme.test");
    expect((body(await API.post(`/api/v1/idea/send-to-oc/${draft.id}/oc`, {})) as { state: string }).state).toBe("LEGAL_REVIEW");
    as("counsel@acme.test");
    expect((body(await API.post(`/api/v1/idea/send-to-oc/${draft.id}/oc`, {})) as { state: string }).state).toBe("SENT_TO_PHOTON");
    as("admin@photonlegal.test");
    const filed = body(await API.post(`/api/v1/idea/${idea.id}/file`, { application_number: "US 18/000,001", jurisdiction: "US" })) as { idea: { state: string }; patent: { id: string } };
    expect(filed.idea.state).toBe("FILED");
    expect(filed.patent.id).toBeTruthy();
  });
  it("an appeal from rejected needs a comment; a resubmission bumps the revision", async () => {
    const idea = ideaIn("REJECTED");
    const draft = getDb().drafts.find((d) => d.idea_id === idea.id)!;
    as("coinv@acme.test");
    await expect(API.post(`/api/v1/idea/send-to-ihc/${draft.id}/x`, {})).rejects.toMatchObject({ response: { status: 400 } });
    const r = body(await API.post(`/api/v1/idea/send-to-ihc/${draft.id}/x`, { comment: "Added the test data." })) as { state: string; revision: number };
    expect(r.state).toBe("TECH_REVIEW");
    expect(r.revision).toBe(2);
  });
});

describe("portfolio, docket, actions, clients and invites", () => {
  it("patent rows carry the legal status vocabulary and the aliases the table reads", async () => {
    const db = seed("counsel/queue"); as("counsel@globex.test");
    const cid = db.users.find((u) => u.email === "counsel@globex.test")!.client_id!;
    const r = body(await API.get(`/api/v1/patent/fetch-lastet/client/${cid}?page=1&limit=5`)) as Array<Record<string, unknown>>;
    const page = (await API.get(`/api/v1/patent/fetch-lastet/client/${cid}?page=1&limit=5`)).data as { pagination: { total: number } };
    expect(r.length).toBe(5);
    expect(page.pagination.total).toBe(60);
    for (const p of r) {
      expect(PATENT_LEGAL_STATUS_VALUES).toContain(p.legal_current_status);
      expect(p.publication_country).toBeTruthy();
      expect(p.application_date).toBeTruthy();
      expect(Array.isArray(p.IdeaPatentLink)).toBe(true);
      expect(Array.isArray(p.inventors)).toBe(true);
    }
  });
  it("the docket month window returns rows with the old event names", async () => {
    seed("counsel/queue"); as("counsel@globex.test");
    const r = (await API.get("/api/v1/patent/fetch/upcoming-due-dates?month=9&year=2026&limit=0")).data as { data: Array<Record<string, unknown>>; pagination: { total: number } };
    expect(r.pagination.total).toBeGreaterThan(0);
    for (const d of r.data) { expect(d.event_date).toBeTruthy(); expect(d.event_name).toBeTruthy(); expect((d.patent as { legal_current_status: string }).legal_current_status).toBeTruthy(); }
  });
  it("the client action list and the Photon queue speak their old dialects", async () => {
    const db = seed("photon-admin/firm"); as("counsel@acme.test");
    const acme = db.clients[0].id;
    const rows = (await API.get(`/api/v1/actions/ihc/client/${acme}?page=1&limit=25`)).data as { data: Array<Record<string, unknown>> };
    expect(rows.data.length).toBeGreaterThan(0);
    const withAction = rows.data.find((x) => x.patent_action) as { patent_action: Record<string, unknown> } | undefined;
    expect(withAction?.patent_action.request_status).toBeTruthy();
    expect(withAction?.patent_action.action_status).toBeTruthy();
    as("admin@photonlegal.test");
    const queue = (await API.get("/api/v1/actions/oc/queue?page=1&limit=50")).data as { data: Array<Record<string, unknown>> };
    expect(queue.data.length).toBeGreaterThan(0);
    const q = queue.data[0];
    expect((q.patent as { application_number: string }).application_number).toBeTruthy();
    expect((q.patent_event as { event_name: string }).event_name).toBeTruthy();
    expect((q.client as { name: string }).name).toBeTruthy();
    expect(q.request_status).toBeTruthy();
  });
  it("clients list paginates with the old count names, and detail carries the old member shape", async () => {
    const db = seed("photon-admin/firm"); as("admin@photonlegal.test");
    const list = (await API.get("/api/v1/clients?page=1&limit=2")).data as { data: Array<Record<string, unknown>>; pagination: { total: number } };
    expect(list.pagination.total).toBe(3);
    expect(typeof (list.data[0]._count as { Patent: number }).Patent).toBe("number");
    const detail = body(await API.get(`/api/v1/clients/${db.clients[0].id}`)) as { allowed_domain: string; User: Array<{ active: boolean; suspended: boolean }> };
    expect(detail.allowed_domain).toBe("acme.test");
    expect(detail.User.some((u) => u.active)).toBe(true);
    expect(detail.User.some((u) => u.suspended)).toBe(true);
  });
  it("the share link exposes token, link and active", async () => {
    const db = seed("counsel/queue"); as("counsel@globex.test");
    const cid = db.clients[1].id;
    const link = body(await API.get(`/api/v1/clients/${cid}/invite-link`)) as { token: string; link: string; active: boolean };
    expect(link.token).toHaveLength(10);
    expect(link.link).toContain(`/i/${link.token}`);
    expect(link.active).toBe(true);
  });
});

describe("request bodies against the pinned OpenAPI schemas", () => {
  it("every body the adapter produced carries the schema's required keys", () => {
    const seen = calls.filter((c) => c.body !== undefined && ["POST", "PATCH", "PUT"].includes(c.method) && c.url.startsWith("/v1"));
    expect(seen.length).toBeGreaterThan(5);
    const missing: string[] = [];
    for (const c of seen) {
      const specPath = Object.keys(spec.paths).find((p) => new RegExp("^" + p.replace(/\{[^}]+\}/g, "[^/]+") + "$").test(c.url.split("?")[0]));
      const op = specPath && spec.paths[specPath][c.method.toLowerCase()];
      const schema = op?.requestBody?.content?.["application/json"]?.schema;
      for (const k of schema?.required ?? []) if (!(k in (c.body as Record<string, unknown>))) missing.push(`${c.method} ${c.url}: ${k}`);
    }
    expect(missing).toEqual([]);
  });
});
