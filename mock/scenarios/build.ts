import { mulberry32, seedFrom, uuid, type Rng } from "../runtime/prng";
import { clock } from "../runtime/clock";
import type { Client, Db, Draft, EvalState, Evaluation, Idea, Transition, User, Flags, PortfolioSpec } from "../runtime/types";
import type { IdeaState } from "../../contract/enums";
import { INVENTIONS, answersFor } from "./content";
import { makeReport } from "./reports";
import { ACCESS, ALL_USERS, CLIENTS } from "./personas";
import { ACTION_TEMPLATES } from "./templates";

export type IdeaSpec = {
  invention: number;
  author: User;
  coInventors?: User[];
  state: IdeaState;
  ageDays: number;
  evaluation?: { state: EvalState; score?: number; progress?: boolean };
  comment?: string;
  reviewer?: User;
  completion?: number;       // for drafts: 0..100
  /** V0: the Workspace Admin who submitted on behalf of the author (proposed field submitted_by_id). */
  submittedBy?: User;
};

export type Data = Omit<Db, "scenario" | "seedVersion">;

export const emptyData = (flags: Flags = {}): Data => ({
  flags, clients: CLIENTS, users: ALL_USERS, access: ACCESS,
  ideas: [], inventors: [], drafts: [], transitions: [], evaluations: [],
  portfolios: {}, patents: [], patentOverrides: {}, dueDates: [], dueDateOverrides: {}, remindersAt: {},
  actionTemplates: ACTION_TEMPLATES, actionRequests: [], invites: [], files: [], imports: [],
});

export const rngFor = (name: string) => mulberry32(seedFrom(`pulse-design.scenario.${name}`));

/** Build a tenant's ideas with the transition chain each state requires (mirrors pulse-backend seed-demo-inventor PLANS). */
export function buildIdeas(rng: Rng, client: Client, specs: IdeaSpec[], data: Data, startSeq = 1) {
  specs.forEach((spec, i) => {
    const inv = INVENTIONS[spec.invention % INVENTIONS.length];
    const seq = startSeq + i;
    const ideaId = uuid(rng);
    const created = clock.daysAgo(spec.ageDays + 2);
    const submitted = spec.state === "DRAFT" ? null : clock.daysAgo(spec.ageDays);
    const idea: Idea = {
      id: ideaId, client_id: client.id, author_id: spec.author.id, submitted_by_id: spec.submittedBy?.id ?? null, title: inv.title,
      body: i % 3 === 0 ? `A short inventor-written summary of ${inv.title.toLowerCase()}.` : null,
      reference: `${client.idea_reference_prefix}-${String(seq).padStart(4, "0")}`, reference_seq: seq,
      state: spec.state, revision: 1, submitted_at: submitted, created_at: created, updated_at: clock.daysAgo(Math.max(0, spec.ageDays - 1)),
    };
    data.ideas.push(idea);
    data.inventors.push({ id: uuid(rng), idea_id: ideaId, inventor_id: spec.author.id, role: "PRIMARY", added_at: created });
    for (const co of spec.coInventors ?? []) data.inventors.push({ id: uuid(rng), idea_id: ideaId, inventor_id: co.id, role: "CO", added_at: created });

    const evalId = spec.evaluation ? uuid(rng) : null;
    const complete = spec.state !== "DRAFT";
    const terminal = spec.evaluation && ["SUCCEEDED", "PARTIAL"].includes(spec.evaluation.state) && !spec.evaluation.progress;
    const score = terminal ? spec.evaluation!.score ?? 70 : null;
    const report = terminal ? makeReport(rng, evalId!, inv.title, score!, { partial: spec.evaluation!.state === "PARTIAL" }) : null;
    const answers = answersFor(inv.title, inv.area, complete);
    if (!complete && spec.completion !== undefined) {
      // A partial draft: blank the trailing sections to match the requested completion.
      const keys = ["background", "problem", "solution", "novelty", "application"];
      const keep = Math.round((spec.completion / 100) * keys.length);
      keys.slice(keep).forEach((k) => { (answers as Record<string, unknown>)[k] = ""; });
      (answers as Record<string, unknown>).__completion = spec.completion;
      (answers as { __meta_data: Array<{ id: string; questions: Array<{ answer: string }> }> }).__meta_data.forEach((s, idx) => { if (idx >= keep) s.questions[0].answer = ""; });
    }
    const draft: Draft = {
      id: uuid(rng), idea_id: ideaId, answers, status: complete ? "SUBMITTED" : "DRAFT",
      api_evaluation_id: evalId, score, report,
      brief_summary: complete ? `${inv.title}: a ${inv.area.toLowerCase()} improvement that removes manual recalibration.` : null,
      brief_problem: complete ? "Current approaches need periodic manual adjustment and degrade under sustained load." : null,
      created_at: created, updated_at: submitted ?? clock.daysAgo(spec.ageDays),
    };
    data.drafts.push(draft);
    if (spec.evaluation && evalId) {
      data.evaluations.push({
        id: evalId, draft_id: draft.id,
        mode: spec.evaluation.progress ? "progress" : "fixed",
        state: spec.evaluation.progress ? "QUEUED" : spec.evaluation.state,
        final_state: spec.evaluation.progress ? spec.evaluation.state : undefined,
        started_at: spec.evaluation.progress ? clock.iso() : clock.daysAgo(spec.ageDays),
        score, report, failure_reason: spec.evaluation.state === "FAILED" ? "The evaluation provider returned an error." : spec.evaluation.state === "TIMED_OUT" ? "The evaluation exceeded its time budget." : null,
      });
    }

    const chain: Array<[IdeaState | null, IdeaState, Transition["stage"], Transition["decision"], User, string | null]> = [];
    const firstStage: IdeaState = client.has_tech_committee ? "TECH_REVIEW" : "LEGAL_REVIEW";
    const reviewer = spec.reviewer ?? spec.author;
    if (spec.state !== "DRAFT") chain.push([null, firstStage, null, null, spec.submittedBy ?? spec.author, null]);
    if (spec.state === "LEGAL_REVIEW" && client.has_tech_committee) chain.push(["TECH_REVIEW", "LEGAL_REVIEW", "TECHNICAL", "APPROVED", reviewer, null]);
    if (spec.state === "CHANGES_REQUESTED") chain.push([firstStage, "CHANGES_REQUESTED", client.has_tech_committee ? "TECHNICAL" : "LEGAL", "CHANGES_REQUESTED", reviewer, spec.comment ?? "Please add test data for the novelty claim."]);
    if (spec.state === "REJECTED") chain.push([firstStage, "REJECTED", client.has_tech_committee ? "TECHNICAL" : "LEGAL", "REJECTED", reviewer, spec.comment ?? "Overlaps a filed application."]);
    if (spec.state === "SENT_TO_PHOTON" || spec.state === "FILED") {
      if (client.has_tech_committee) chain.push(["TECH_REVIEW", "LEGAL_REVIEW", "TECHNICAL", "APPROVED", reviewer, null]);
      chain.push(["LEGAL_REVIEW", "SENT_TO_PHOTON", "LEGAL", "APPROVED", reviewer, null]);
    }
    if (spec.state === "FILED") chain.push(["SENT_TO_PHOTON", "FILED", null, null, reviewer, null]);
    chain.forEach(([from, to, stage, decision, actor, comment], k) => {
      data.transitions.push({ id: uuid(rng), idea_id: ideaId, from_state: from, to_state: to, stage, decision, actor_id: actor.id, revision: 1, comment, is_appeal: false, created_at: clock.daysAgo(Math.max(0, spec.ageDays - k)) });
    });
  });
}

export const portfolio = (count: number, seed: string, client: Client, dueDatesPerPatent = 0.95): PortfolioSpec => ({ count, seed, dueDatesPerPatent, assignee: client.name });

/** Operations data on top of a tenant's generated portfolio: action requests along the queue, invites, an import, files. */
export function seedOperations(rng: Rng, data: Data, opts: { requestsPerClient?: number } = {}) {
  const { generatePortfolio } = portfolioModule();
  const perClient = opts.requestsPerClient ?? 6;
  const statuses: Array<[ActionStatusName, SubmissionName]> = [["NEW", "SUBMITTED"], ["ACKNOWLEDGED", "SUBMITTED"], ["IN_PROGRESS", "SUBMITTED"], ["COMPLETED", "SUBMITTED"], ["NEW", "UPDATED"], ["DECLINED", "SUBMITTED"], ["NO_ACTION", "DRAFT"]];
  for (const client of data.clients) {
    const spec = data.portfolios[client.id];
    if (!spec) continue;
    const g = generatePortfolio(client, spec);
    const counsel = data.users.find((u) => u.client_id === client.id && u.role === "LEGAL_COUNSEL");
    if (!counsel) continue;
    const pending = g.dueDates.filter((d) => d.status === "PENDING" && Date.parse(d.due_at) > clock.now()).sort((a, b) => a.due_at.localeCompare(b.due_at)).slice(0, perClient);
    pending.forEach((dd, k) => {
      const [status, submission] = statuses[k % statuses.length];
      const tpl = data.actionTemplates.find((t) => t.event_types.includes(dd.event_type)) ?? data.actionTemplates[0];
      data.actionRequests.push({ id: uuid(rng), client_id: client.id, due_date_id: dd.id, template_id: tpl.id, instruction: tpl.label, selected_countries: tpl.requires_countries ? ["US", "EP", "JP"] : [], status, submission_state: submission, version: submission === "UPDATED" ? 2 : 1, note: status === "DECLINED" ? "Client withdrew the instruction after a budget review." : tpl.requires_note ? "Confirmed with the inventor." : null, requested_by_id: counsel.id, requested_at: clock.daysAgo(3 + k * 2), updated_at: clock.daysAgo(k) });
    });
    // A pending share link and one per-email invite per tenant.
    data.invites.push({ id: uuid(rng), email: "*", role: "INVENTOR", client_id: client.id, code: Array.from({ length: 10 }, () => "0123456789ABCDEFGHJKMNPQRSTVWXYZ"[Math.floor(rng() * 32)]).join(""), status: "PENDING", invited_by_id: counsel.id, expires_at: clock.daysAhead(300), accepted_at: null, revoked_at: null, created_at: clock.daysAgo(40) });
    data.invites.push({ id: uuid(rng), email: `newhire@${client.domain}`, role: "INVENTOR", client_id: client.id, code: Array.from({ length: 10 }, () => "0123456789ABCDEFGHJKMNPQRSTVWXYZ"[Math.floor(rng() * 32)]).join(""), status: "PENDING", invited_by_id: counsel.id, expires_at: clock.daysAhead(12), accepted_at: null, revoked_at: null, created_at: clock.daysAgo(2) });
    // One completed import with its sheet.
    const fileId = uuid(rng);
    data.files.push({ id: fileId, client_id: client.id, original_name: `${client.name.split(" ")[0].toLowerCase()}-portfolio-2026.xlsx`, file_name: `${fileId}.xlsx`, content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size_bytes: 48213, status: "STORED", category: "import", uploaded_by_id: counsel.id, created_at: clock.daysAgo(21) });
    data.imports.push({ id: uuid(rng), client_id: client.id, file_id: fileId, status: "COMPLETED", rows_total: Math.min(spec.count, 94), created_count: Math.min(spec.count, 90), updated_count: 3, unchanged_count: 1, failed_count: 0, due_dates_created: Math.min(spec.count, 80), duplicate_in_file: 0, unmapped_columns: [], errors: [], completed_at: clock.daysAgo(21), created_at: clock.daysAgo(21), imported_by_id: counsel.id });
  }
}
type ActionStatusName = "NO_ACTION" | "NEW" | "ACKNOWLEDGED" | "IN_PROGRESS" | "COMPLETED" | "DECLINED";
type SubmissionName = "DRAFT" | "SUBMITTED" | "UPDATED";
// Lazy import keeps build.ts free of a static cycle with the portfolio generator's clock use.
import * as portfolioMod from "./portfolio";
const portfolioModule = () => portfolioMod;
