import { route } from "../runtime/registry";
import { getDb, touched } from "../runtime/db";
import { clock } from "../runtime/clock";
import { uuid, mulberry32, seedFrom } from "../runtime/prng";
import type { Draft, Evaluation, Idea, User } from "../runtime/types";
import type { IdeaState } from "../../contract/enums";
import { currentUser, hydrateIdea, visibleIdeas } from "./scope";
import { makeReport } from "../scenarios/reports";
import { answersFor, SECTIONS, SECTION_TITLES } from "../scenarios/content";

const STATES: IdeaState[] = ["DRAFT", "TECH_REVIEW", "LEGAL_REVIEW", "CHANGES_REQUESTED", "REJECTED", "SENT_TO_PHOTON", "FILED"];
const rngNow = (salt: string) => mulberry32(seedFrom(salt + clock.now()));

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
  const to: IdeaState | null = decision === "APPROVED" ? (stage === "TECHNICAL" ? "LEGAL_REVIEW" : "SENT_TO_PHOTON") : decision === "CHANGES_REQUESTED" ? "CHANGES_REQUESTED" : decision === "REJECTED" ? "REJECTED" : null;
  if (!to) return { status: 400, body: { message: `Unknown decision ${decision}.` } };
  db.transitions.push({ id: uuid(rngNow(idea.id + to)), idea_id: idea.id, from_state: idea.state, to_state: to, stage, decision: decision as never, actor_id: actor.id, revision: idea.revision, comment: comment?.trim() || null, is_appeal: false, created_at: clock.iso() });
  idea.state = to; idea.updated_at = clock.iso();
  touched();
  return hydrateIdea(db, idea, clock.now());
}

/** Submit or resubmit: restarts the chain at the top and bumps the revision; an appeal from REJECTED needs a comment. */
function submit(idea: Idea, actor: User, comment: string | undefined) {
  const db = getDb();
  const client = db.clients.find((c) => c.id === idea.client_id)!;
  const from = idea.state;
  if (!["DRAFT", "CHANGES_REQUESTED", "REJECTED"].includes(from)) return { status: 409, body: { message: `An idea in state ${from} cannot be submitted.` } };
  const onBehalf = !!db.flags.v0 && actor.role === "LEGAL_COUNSEL" && idea.submitted_by_id === actor.id;
  if (actor.role !== "INVENTOR" && !onBehalf) return { status: 403, body: { message: "Only an inventor can submit a disclosure." } };
  if (from === "REJECTED" && !comment?.trim()) return { status: 400, body: { message: "An appeal needs a comment explaining what changed." } };
  const draft = db.drafts.filter((d) => d.idea_id === idea.id).sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const answers = (draft?.answers ?? {}) as Record<string, unknown>;
  if (!Object.entries(answers).some(([k, v]) => !k.startsWith("__") && typeof v === "string" && v.trim())) return { status: 400, body: { message: "The questionnaire needs at least one answer before submission." } };
  const to: IdeaState = client.has_tech_committee ? "TECH_REVIEW" : "LEGAL_REVIEW";
  if (from !== "DRAFT") idea.revision += 1;
  db.transitions.push({ id: uuid(rngNow(idea.id + "submit")), idea_id: idea.id, from_state: from === "DRAFT" ? null : from, to_state: to, stage: null, decision: null, actor_id: actor.id, revision: idea.revision, comment: comment?.trim() || null, is_appeal: from === "REJECTED", created_at: clock.iso() });
  idea.state = to; idea.submitted_at = clock.iso(); idea.updated_at = clock.iso();
  if (draft) { draft.status = "SUBMITTED"; draft.updated_at = clock.iso(); }
  touched();
  return hydrateIdea(db, idea, clock.now());
}

const nextReference = (clientId: string) => {
  const db = getDb(); const client = db.clients.find((c) => c.id === clientId)!;
  const seq = Math.max(0, ...db.ideas.filter((i) => i.client_id === clientId).map((i) => i.reference_seq)) + 1;
  return { reference: `${client.idea_reference_prefix}-${String(seq).padStart(4, "0")}`, seq };
};

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
    const byClient = db.clients.filter((c) => !cid || c.id === cid).map((c) => { const rows = ideas.filter((i) => i.client_id === c.id); const k = (...s: IdeaState[]) => rows.filter((i) => s.includes(i.state)).length; return { client_id: c.id, name: c.name, submitted: k("TECH_REVIEW", "LEGAL_REVIEW", "CHANGES_REQUESTED", "REJECTED", "SENT_TO_PHOTON", "FILED"), reviewPending: k("TECH_REVIEW", "LEGAL_REVIEW"), sentToPhoton: k("SENT_TO_PHOTON"), filed: k("FILED"), granted: 0 }; });
    return { submitted: n("TECH_REVIEW", "LEGAL_REVIEW", "CHANGES_REQUESTED", "REJECTED", "SENT_TO_PHOTON", "FILED"), reviewPending: n("TECH_REVIEW", "LEGAL_REVIEW"), sentToPhoton: n("SENT_TO_PHOTON"), filed: n("FILED"), granted: 0, byClient };
  }),
  route("get", "/v1/ideas/colleagues", ({ url }) => {
    const db = getDb(); const u = currentUser();
    const cid = url.searchParams.get("client_id") ?? u?.client_id;
    return db.users.filter((x) => x.client_id === cid && x.role === "INVENTOR" && x.status !== "SUSPENDED").map((x) => ({ id: x.id, name: x.name, email: x.email, role: x.role, status: x.status }));
  }),
  route("delete", "/v1/ideas/inventor-credits/:id", ({ params }) => {
    const db = getDb();
    const before = db.inventors.length;
    db.inventors = db.inventors.filter((x) => x.id !== params.id || x.role === "PRIMARY");
    if (db.inventors.length === before) return { status: 404, body: { message: "Co-inventor credit not found, or it is the primary inventor." } };
    touched(); return { ok: true };
  }),
  route("get", "/v1/ideas", ({ url }) => {
    const db = getDb(); const u = currentUser();
    const states = (url.searchParams.get("state") ?? "").split(",").filter(Boolean);
    const cid = url.searchParams.get("client_id");
    return visibleIdeas(db, u).filter((i) => (!states.length || states.includes(i.state)) && (!cid || i.client_id === cid)).map((i) => hydrateIdea(db, i, clock.now()));
  }),
  route("post", "/v1/ideas", async ({ body }) => {
    const b = (await body()) as { title?: string; body?: string; inventor_id?: string };
    const db = getDb(); const u = currentUser();
    if (!u) return { status: 401, body: { message: "Not signed in." } };
    // BF-1 (V0 scenarios only): a Workspace Admin starts an idea on behalf of a real inventor in the same workspace; the inventor stays the author, the admin is recorded as the submitter.
    const onBehalf = !!db.flags.v0 && u.role === "LEGAL_COUNSEL" && !!b.inventor_id;
    const author = onBehalf ? db.users.find((x) => x.id === b.inventor_id && x.role === "INVENTOR" && x.client_id === u.client_id) : u;
    if (onBehalf && !author) return { status: 400, body: { message: "Choose an inventor from your workspace." } };
    if (!author || author.role !== "INVENTOR" || !author.client_id) return { status: 403, body: { message: "Only an inventor at a client can author a disclosure." } };
    if (!b.title?.trim()) return { status: 400, body: { message: "A title is required." } };
    const { reference, seq } = nextReference(author.client_id);
    const rng = rngNow(u.id + b.title);
    const idea: Idea = { id: uuid(rng), client_id: author.client_id, author_id: author.id, submitted_by_id: onBehalf ? u.id : null, title: b.title.trim(), body: b.body?.trim() || null, reference, reference_seq: seq, state: "DRAFT", revision: 1, submitted_at: null, created_at: clock.iso(), updated_at: clock.iso() };
    db.ideas.push(idea);
    db.inventors.push({ id: uuid(rng), idea_id: idea.id, inventor_id: author.id, role: "PRIMARY", added_at: clock.iso() });
    db.transitions.push({ id: uuid(rng), idea_id: idea.id, from_state: null, to_state: "DRAFT", stage: null, decision: null, actor_id: u.id, revision: 1, comment: null, is_appeal: false, created_at: clock.iso() });
    touched();
    return { status: 201, body: hydrateIdea(db, idea, clock.now()) };
  }),
  route("get", "/v1/ideas/:id", ({ params }) => {
    const db = getDb();
    const i = db.ideas.find((x) => x.id === params.id);
    return i ? hydrateIdea(db, i, clock.now()) : { status: 404, body: { message: "Idea not found." } };
  }),
  route("patch", "/v1/ideas/:id", async ({ params, body }) => {
    const b = (await body()) as { title?: string; body?: string };
    const db = getDb();
    const i = db.ideas.find((x) => x.id === params.id);
    if (!i) return { status: 404, body: { message: "Idea not found." } };
    if (b.title !== undefined) i.title = String(b.title);
    if (b.body !== undefined) i.body = b.body ? String(b.body) : null;
    i.updated_at = clock.iso(); touched();
    return hydrateIdea(db, i, clock.now());
  }),
  route("delete", "/v1/ideas/:id", ({ params }) => {
    const db = getDb(); const u = currentUser();
    const i = db.ideas.find((x) => x.id === params.id);
    if (!i) return { status: 404, body: { message: "Idea not found." } };
    if (i.state !== "DRAFT" || i.author_id !== u?.id) return { status: 403, body: { message: "Only the author can delete an idea, and only while it is a draft." } };
    db.ideas = db.ideas.filter((x) => x.id !== i.id); db.drafts = db.drafts.filter((d) => d.idea_id !== i.id); db.inventors = db.inventors.filter((x) => x.idea_id !== i.id);
    touched(); return { ok: true };
  }),
  route("get", "/v1/ideas/:id/drafts", ({ params }) => getDb().drafts.filter((d) => d.idea_id === params.id).map(hydrateDraft)),
  route("post", "/v1/ideas/:id/drafts", async ({ params, body }) => {
    const b = (await body()) as { answers?: Record<string, unknown> };
    const db = getDb();
    const idea = db.ideas.find((x) => x.id === params.id);
    if (!idea) return { status: 404, body: { message: "Idea not found." } };
    const d: Draft = { id: uuid(rngNow(idea.id + "draft")), idea_id: idea.id, answers: b.answers ?? {}, status: "DRAFT", api_evaluation_id: null, score: null, report: null, brief_summary: null, brief_problem: null, created_at: clock.iso(), updated_at: clock.iso() };
    db.drafts.push(d); touched();
    return { status: 201, body: hydrateDraft(d) };
  }),
  route("post", "/v1/ideas/:id/submit", async ({ params, body }) => {
    const b = (await body()) as { comment?: string };
    const db = getDb(); const u = currentUser();
    const idea = db.ideas.find((x) => x.id === params.id);
    if (!idea) return { status: 404, body: { message: "Idea not found." } };
    if (!u) return { status: 401, body: { message: "Not signed in." } };
    return submit(idea, u, b.comment);
  }),
  route("post", "/v1/ideas/:id/review", async ({ params, body }) => {
    const b = (await body()) as { decision?: string; comment?: string };
    const db = getDb(); const u = currentUser();
    const idea = db.ideas.find((x) => x.id === params.id);
    if (!idea) return { status: 404, body: { message: "Idea not found." } };
    if (!u) return { status: 401, body: { message: "Not signed in." } };
    return review(idea, u, String(b.decision ?? ""), b.comment);
  }),
  route("post", "/v1/ideas/:id/clone", ({ params }) => {
    const db = getDb(); const u = currentUser();
    const src = db.ideas.find((x) => x.id === params.id);
    if (!src || !u) return { status: 404, body: { message: "Idea not found." } };
    const { reference, seq } = nextReference(src.client_id);
    const rng = rngNow(src.id + "clone");
    const idea: Idea = { ...src, id: uuid(rng), title: `${src.title} (copy)`, reference, reference_seq: seq, state: "DRAFT", revision: 1, submitted_at: null, created_at: clock.iso(), updated_at: clock.iso(), author_id: u.id };
    db.ideas.push(idea);
    db.inventors.push({ id: uuid(rng), idea_id: idea.id, inventor_id: u.id, role: "PRIMARY", added_at: clock.iso() });
    const d = db.drafts.filter((x) => x.idea_id === src.id).sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    db.drafts.push({ id: uuid(rng), idea_id: idea.id, answers: d ? JSON.parse(JSON.stringify(d.answers)) : {}, status: "DRAFT", api_evaluation_id: null, score: null, report: null, brief_summary: null, brief_problem: null, created_at: clock.iso(), updated_at: clock.iso() });
    touched();
    return hydrateIdea(db, idea, clock.now());
  }),
  route("get", "/v1/ideas/:id/transitions", ({ params }) => {
    const db = getDb();
    return db.transitions.filter((t) => t.idea_id === params.id).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((t) => ({ ...t, actor: (() => { const a = db.users.find((x) => x.id === t.actor_id); return a ? { id: a.id, name: a.name, email: a.email } : null; })() }));
  }),
  route("post", "/v1/ideas/:id/file", async ({ params, body }) => {
    const b = (await body()) as { application_number?: string; jurisdiction?: string; filing_date?: string; title?: string };
    const db = getDb(); const u = currentUser();
    const idea = db.ideas.find((x) => x.id === params.id);
    if (!idea) return { status: 404, body: { message: "Idea not found." } };
    if (!u || !["CASE_OWNER", "PHOTON_ADMIN", "PHOTON_SUPERADMIN"].includes(u.role)) return { status: 403, body: { message: "Only Photon Legal can file." } };
    if (idea.state !== "SENT_TO_PHOTON") return { status: 409, body: { message: "Only an idea sent to Photon Legal can be filed." } };
    if (!b.application_number?.trim()) return { status: 400, body: { message: "An application number is required." } };
    const rng = rngNow(idea.id + "file");
    const client = db.clients.find((c) => c.id === idea.client_id)!;
    const patent = { id: uuid(rng), client_id: idea.client_id, title: b.title?.trim() || idea.title, application_number: b.application_number.trim(), jurisdiction: b.jurisdiction ?? "US", status: "APPLIED" as const, filing_date: b.filing_date ?? clock.iso(), grant_date: null, tags: [], abstract: idea.body, assignee_original: client.name, current_assignee: client.name, inventors: db.inventors.filter((x) => x.idea_id === idea.id).map((x) => db.users.find((y) => y.id === x.inventor_id)?.name ?? "").filter(Boolean), simple_family_members: [], ipc_all_versions: [], priority_details: null, additional_notes: null, current_status: "APPLIED", prn: null, oc: "Photon Legal", next_steps_gpo: [], next_steps_legal: ["Await examination report"], status_timeline_history: [{ status: "APPLIED", date: clock.iso() }], deleted_at: null, created_at: clock.iso(), updated_at: clock.iso() };
    db.patents.push(patent);
    db.transitions.push({ id: uuid(rng), idea_id: idea.id, from_state: "SENT_TO_PHOTON", to_state: "FILED", stage: null, decision: null, actor_id: u.id, revision: idea.revision, comment: null, is_appeal: false, created_at: clock.iso() });
    idea.state = "FILED"; idea.updated_at = clock.iso();
    (db as unknown as { links?: Array<{ idea_id: string; patent_id: string }> }).links = [...((db as unknown as { links?: Array<{ idea_id: string; patent_id: string }> }).links ?? []), { idea_id: idea.id, patent_id: patent.id }];
    touched();
    return { idea: hydrateIdea(db, idea, clock.now()), patent };
  }),
  route("post", "/v1/ideas/:id/inventors/:userId", ({ params }) => {
    const db = getDb(); const u = currentUser();
    const idea = db.ideas.find((x) => x.id === params.id); const who = db.users.find((x) => x.id === params.userId);
    if (!idea || !who) return { status: 404, body: { message: "Idea or inventor not found." } };
    if (who.client_id !== idea.client_id || who.role !== "INVENTOR") return { status: 400, body: { message: "Co-inventors must be inventors at the same client." } };
    if (db.inventors.some((x) => x.idea_id === idea.id && x.inventor_id === who.id)) return { status: 409, body: { message: "Already credited on this idea." } };
    const credit = { id: uuid(rngNow(idea.id + who.id)), idea_id: idea.id, inventor_id: who.id, role: "CO" as const, added_at: clock.iso(), added_by_id: u?.id };
    db.inventors.push(credit); touched();
    return { ...credit, inventor: { id: who.id, name: who.name, email: who.email } };
  }),
  route("get", "/v1/drafts/:id", ({ params }) => {
    const d = getDb().drafts.find((x) => x.id === params.id);
    return d ? hydrateDraft(d) : { status: 404, body: { message: "Draft not found." } };
  }),
  route("patch", "/v1/drafts/:id", async ({ params, body }) => {
    const b = (await body()) as { answers?: Record<string, unknown>; status?: string };
    const db = getDb();
    const d = db.drafts.find((x) => x.id === params.id);
    if (!d) return { status: 404, body: { message: "Draft not found." } };
    if (b.answers) d.answers = b.answers;
    if (b.status === "SUBMITTED" || b.status === "DRAFT") d.status = b.status;
    d.updated_at = clock.iso(); touched();
    // The idea-details autosave path expects 201 on this route (frontend CLAUDE.md).
    return { status: 201, body: hydrateDraft(d) };
  }),
  route("delete", "/v1/drafts/:id", ({ params }) => {
    const db = getDb();
    const d = db.drafts.find((x) => x.id === params.id);
    if (!d) return { status: 404, body: { message: "Draft not found." } };
    db.drafts = db.drafts.filter((x) => x.id !== d.id); touched();
    return { ok: true };
  }),
  route("post", "/v1/drafts/:id/submit", async ({ params, body }) => {
    const b = (await body()) as { comment?: string };
    const db = getDb(); const u = currentUser();
    const d = db.drafts.find((x) => x.id === params.id);
    const idea = d && db.ideas.find((x) => x.id === d.idea_id);
    if (!d || !idea) return { status: 404, body: { message: "Draft not found." } };
    if (!u) return { status: 401, body: { message: "Not signed in." } };
    return submit(idea, u, b.comment);
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
  route("get", "/v1/drafts/:id/evaluation", ({ params }) => {
    const db = getDb();
    const d = db.drafts.find((x) => x.id === params.id);
    return evaluationView(db.evaluations.find((e) => e.draft_id === params.id), d);
  }),
  route("post", "/v1/drafts/:id/evaluate", ({ params }) => {
    const db = getDb();
    const d = db.drafts.find((x) => x.id === params.id);
    if (!d) return { status: 404, body: { message: "Draft not found." } };
    const ev: Evaluation = { id: uuid(rngNow(d.id + "eval")), draft_id: d.id, mode: "progress", state: "QUEUED", final_state: "SUCCEEDED", started_at: clock.iso(), score: null, report: null, failure_reason: null };
    db.evaluations = db.evaluations.filter((e) => e.draft_id !== d.id).concat(ev);
    d.api_evaluation_id = ev.id; d.score = null; d.report = null; d.updated_at = clock.iso();
    touched();
    return { evaluationId: ev.id };
  }),
  route("post", "/v1/drafts/:id/re-evaluate", ({ params }) => {
    const db = getDb();
    const d = db.drafts.find((x) => x.id === params.id) ?? db.drafts.find((x) => x.api_evaluation_id === params.id);
    if (!d) return { status: 404, body: { message: "Draft not found." } };
    const ev: Evaluation = { id: uuid(rngNow(d.id + "re")), draft_id: d.id, mode: "progress", state: "QUEUED", final_state: "SUCCEEDED", started_at: clock.iso(), score: null, report: null, failure_reason: null };
    db.evaluations = db.evaluations.filter((e) => e.draft_id !== d.id).concat(ev);
    d.api_evaluation_id = ev.id; d.score = null; d.report = null; d.updated_at = clock.iso(); touched();
    return { evaluationId: ev.id };
  }),
  route("get", "/v1/drafts/:id/signal", ({ params }) => {
    const d = getDb().drafts.find((x) => x.id === params.id);
    if (!d) return { status: 404, body: { message: "Draft not found." } };
    const a = d.answers as Record<string, unknown>;
    const filled = SECTIONS.filter((s) => typeof a[s] === "string" && (a[s] as string).trim().length > 40).length;
    const band = filled >= 5 ? "STRONG" : filled >= 3 ? "PROMISING" : filled >= 1 ? "EARLY" : "EMPTY";
    return { state: band, source: "heuristic", sections_with_content: filled, total_sections: SECTIONS.length, message: band === "STRONG" ? "Every section carries substance; ready for evaluation." : band === "PROMISING" ? "The solution reads well; the novelty section is where reviewers will look next." : band === "EARLY" ? "Start with the problem and the solution; the rest follows." : "Nothing written yet." };
  }),
  route("post", "/v1/drafts/:id/autofill", async ({ params, body }) => {
    const b = (await body()) as { text?: string };
    const db = getDb();
    const d = db.drafts.find((x) => x.id === params.id);
    const idea = d && db.ideas.find((x) => x.id === d.idea_id);
    if (!d || !idea) return { status: 404, body: { message: "Draft not found." } };
    const text = String(b.text ?? "").trim();
    if (text.length < 40) return { status: 400, body: { message: "Paste at least a paragraph to draft from." } };
    const filled = answersFor(idea.title, "the described field", true) as Record<string, unknown>;
    // Never the novelty section: that is the inventor's claim (enforced server-side in production).
    const answers = Object.fromEntries(SECTIONS.filter((s) => s !== "novelty").map((s) => [s, `${filled[s]} (drafted from your text)`]));
    return { answers, sections: Object.keys(answers), skipped: ["novelty"] };
  }),
  route("post", "/v1/drafts/:id/suggest", async ({ params, body }) => {
    const b = (await body()) as { question_id?: string; answer?: string };
    if (!getDb().drafts.some((x) => x.id === params.id)) return { status: 404, body: { message: "Draft not found." } };
    if (b.question_id === "novelty") return { status: 422, body: { message: "The novelty section is the inventor's claim and is not reviewed by the assistant." } };
    const len = String(b.answer ?? "").trim().length;
    const verdict = len < 30 ? "unusable" : len < 160 ? "improve" : "good";
    return { question_id: b.question_id, verdict, rewrite: verdict === "improve" ? `${String(b.answer).trim()} In practice this means the operator no longer has to intervene between shifts.` : null, reason: verdict === "unusable" ? "Too short to review." : verdict === "improve" ? "Say what changes for the user, not only what the mechanism does." : "Reads clearly and states a concrete effect.", label: SECTION_TITLES[(b.question_id as keyof typeof SECTION_TITLES)] ?? b.question_id };
  }),
];
