import { route } from "../runtime/registry";
import { getDb, touched } from "../runtime/db";
import { clock } from "../runtime/clock";
import { uuid, mulberry32, seedFrom } from "../runtime/prng";
import type { Draft, Evaluation, Idea, User } from "../runtime/types";
import type { IdeaState } from "../../contract/enums";
import { currentUser, hydrateIdea, visibleIdeas } from "./scope";
import { makeReport } from "../scenarios/reports";

const STATES: IdeaState[] = ["DRAFT", "TECH_REVIEW", "LEGAL_REVIEW", "CHANGES_REQUESTED", "REJECTED", "SENT_TO_PHOTON", "FILED"];

/** GET /v1/drafts/:id/evaluation as pulse-backend answers it. Progressing evaluations move on the mock clock. */
function evaluationView(ev: Evaluation | undefined, draft: Draft | undefined) {
  if (!ev) return { status: "NONE", score: null, report: null };
  let state = ev.state;
  if (ev.mode === "progress") {
    const elapsed = clock.now() - Date.parse(ev.started_at);
    state = elapsed < 4_000 ? "QUEUED" : elapsed < 20_000 ? "RUNNING" : (ev.final_state ?? "SUCCEEDED");
    if (state !== ev.state) {
      ev.state = state;
      if ((state === "SUCCEEDED" || state === "PARTIAL") && !ev.report && draft) {
        const rng = mulberry32(seedFrom(ev.id));
        const idea = getDb().ideas.find((i) => i.id === draft.idea_id);
        ev.score = 72; ev.report = makeReport(rng, ev.id, idea?.title ?? "Untitled", 72, { partial: state === "PARTIAL" });
        draft.score = ev.score; draft.report = ev.report;
      }
      touched();
    }
  }
  if (state === "QUEUED" || state === "RUNNING") return { status: "RUNNING", state, score: null, report: null };
  if (state === "SUCCEEDED" || state === "PARTIAL") return { status: "COMPLETE", state, score: ev.score, report: ev.report };
  return { status: "FAILED", state, score: null, report: null, failureReason: ev.failure_reason };
}

const hydrateDraft = (d: Draft) => {
  const db = getDb();
  const idea = db.ideas.find((i) => i.id === d.idea_id);
  return { ...d, idea: idea ? { id: idea.id, title: idea.title, state: idea.state, client_id: idea.client_id, author_id: idea.author_id } : null };
};

/** The review chain (pulse-backend review-chain.ts): the stage is derived from the idea's state, never asserted by the caller. */
function review(idea: Idea, actor: User, decision: string, comment: string | undefined) {
  const db = getDb();
  const stage = idea.state === "TECH_REVIEW" ? "TECHNICAL" : idea.state === "LEGAL_REVIEW" ? "LEGAL" : null;
  if (!stage) return { status: 409, body: { message: `This idea is not under review (state ${idea.state}).` } };
  const allowed = stage === "TECHNICAL" ? actor.role === "TECH_COMMITTEE" : actor.role === "LEGAL_COUNSEL";
  if (!allowed) return { status: 403, body: { message: "You cannot review at this stage." } };
  if ((decision === "CHANGES_REQUESTED" || decision === "REJECTED") && !comment?.trim()) return { status: 400, body: { message: "A comment is required for this decision." } };
  const to: IdeaState = decision === "APPROVED" ? (stage === "TECHNICAL" ? "LEGAL_REVIEW" : "SENT_TO_PHOTON") : decision === "CHANGES_REQUESTED" ? "CHANGES_REQUESTED" : decision === "REJECTED" ? "REJECTED" : idea.state;
  if (to === idea.state) return { status: 400, body: { message: `Unknown decision ${decision}.` } };
  const rng = mulberry32(seedFrom(idea.id + to + clock.now()));
  db.transitions.push({ id: uuid(rng), idea_id: idea.id, from_state: idea.state, to_state: to, stage, decision: decision as never, actor_id: actor.id, revision: idea.revision, comment: comment?.trim() || null, is_appeal: false, created_at: clock.iso() });
  idea.state = to; idea.updated_at = clock.iso();
  touched();
  return hydrateIdea(db, idea, clock.now());
}

export const ideaHandlers = [
  route("get", "/v1/ideas/counts", () => {
    const db = getDb(); const u = currentUser();
    const counts = Object.fromEntries(STATES.map((s) => [s, 0])) as Record<IdeaState, number>;
    for (const i of visibleIdeas(db, u)) counts[i.state]++;
    return counts;
  }),
  route("get", "/v1/ideas/pipeline", ({ url }) => {
    const db = getDb(); const u = currentUser();
    const cid = url.searchParams.get("client_id");
    const ideas = visibleIdeas(db, u).filter((i) => !cid || i.client_id === cid);
    const n = (...s: IdeaState[]) => ideas.filter((i) => s.includes(i.state)).length;
    return { submitted: n("TECH_REVIEW", "LEGAL_REVIEW", "CHANGES_REQUESTED", "REJECTED", "SENT_TO_PHOTON", "FILED"), reviewPending: n("TECH_REVIEW", "LEGAL_REVIEW"), sentToPhoton: n("SENT_TO_PHOTON"), filed: n("FILED"), granted: 0, byClient: [] };
  }),
  route("get", "/v1/ideas/colleagues", ({ url }) => {
    const db = getDb();
    const cid = url.searchParams.get("client_id");
    return db.users.filter((x) => x.client_id === cid && x.role === "INVENTOR").map((x) => ({ id: x.id, name: x.name, email: x.email, role: x.role }));
  }),
  route("get", "/v1/ideas", ({ url }) => {
    const db = getDb(); const u = currentUser();
    const states = (url.searchParams.get("state") ?? "").split(",").filter(Boolean);
    return visibleIdeas(db, u).filter((i) => !states.length || states.includes(i.state)).map((i) => hydrateIdea(db, i, clock.now()));
  }),
  route("get", "/v1/ideas/:id", ({ params }) => {
    const db = getDb();
    const i = db.ideas.find((x) => x.id === params.id);
    return i ? hydrateIdea(db, i, clock.now()) : { status: 404, body: { message: "Idea not found." } };
  }),
  route("get", "/v1/ideas/:id/drafts", ({ params }) => getDb().drafts.filter((d) => d.idea_id === params.id).map(hydrateDraft)),
  route("get", "/v1/ideas/:id/transitions", ({ params }) => {
    const db = getDb();
    return db.transitions.filter((t) => t.idea_id === params.id).map((t) => ({ ...t, actor: (() => { const a = db.users.find((x) => x.id === t.actor_id); return a ? { id: a.id, name: a.name, email: a.email } : null; })() }));
  }),
  route("post", "/v1/ideas/:id/review", async ({ params, body }) => {
    const b = (await body()) as { decision?: string; comment?: string };
    const db = getDb(); const u = currentUser();
    const idea = db.ideas.find((x) => x.id === params.id);
    if (!idea) return { status: 404, body: { message: "Idea not found." } };
    if (!u) return { status: 401, body: { message: "Not signed in." } };
    return review(idea, u, String(b.decision ?? ""), b.comment);
  }),
  route("post", "/v1/ideas/:id/submit", ({ params }) => {
    const db = getDb();
    const idea = db.ideas.find((x) => x.id === params.id);
    if (!idea) return { status: 404, body: { message: "Idea not found." } };
    const client = db.clients.find((c) => c.id === idea.client_id)!;
    idea.state = client.has_tech_committee ? "TECH_REVIEW" : "LEGAL_REVIEW"; idea.submitted_at = clock.iso(); idea.updated_at = clock.iso();
    touched();
    return hydrateIdea(db, idea, clock.now());
  }),
  route("get", "/v1/drafts/:id", ({ params }) => {
    const d = getDb().drafts.find((x) => x.id === params.id);
    return d ? hydrateDraft(d) : { status: 404, body: { message: "Draft not found." } };
  }),
  route("get", "/v1/drafts/:id/evaluation", ({ params }) => {
    const db = getDb();
    const d = db.drafts.find((x) => x.id === params.id);
    return evaluationView(db.evaluations.find((e) => e.draft_id === params.id), d);
  }),
  route("post", "/v1/drafts/:id/evaluate", ({ params }) => {
    const db = getDb();
    const d = db.drafts.find((x) => x.id === params.id);
    if (!d) return { status: 404, body: { message: "Draft not found." } };
    const rng = mulberry32(seedFrom(d.id + clock.now()));
    const ev: Evaluation = { id: uuid(rng), draft_id: d.id, mode: "progress", state: "QUEUED", final_state: "SUCCEEDED", started_at: clock.iso(), score: null, report: null, failure_reason: null };
    db.evaluations = db.evaluations.filter((e) => e.draft_id !== d.id).concat(ev);
    d.api_evaluation_id = ev.id; d.score = null; d.report = null; d.updated_at = clock.iso();
    touched();
    return { evaluationId: ev.id };
  }),
  route("post", "/v1/drafts/:id/review", async ({ params, body }) => {
    const b = (await body()) as { decision?: string; comment?: string };
    const db = getDb(); const u = currentUser();
    const d = db.drafts.find((x) => x.id === params.id);
    const idea = d && db.ideas.find((x) => x.id === d.idea_id);
    if (!d || !idea) return { status: 404, body: { message: "Draft not found." } };
    if (!u) return { status: 401, body: { message: "Not signed in." } };
    return review(idea, u, String(b.decision ?? ""), b.comment);
  }),
  route("post", "/v1/drafts/:id/submit", ({ params }) => {
    const db = getDb();
    const d = db.drafts.find((x) => x.id === params.id);
    const idea = d && db.ideas.find((x) => x.id === d.idea_id);
    if (!d || !idea) return { status: 404, body: { message: "Draft not found." } };
    const client = db.clients.find((c) => c.id === idea.client_id)!;
    d.status = "SUBMITTED"; idea.state = client.has_tech_committee ? "TECH_REVIEW" : "LEGAL_REVIEW"; idea.submitted_at = clock.iso(); idea.updated_at = clock.iso();
    touched();
    return hydrateIdea(db, idea, clock.now());
  }),
];
