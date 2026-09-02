import { mulberry32, seedFrom, uuid, type Rng } from "../runtime/prng";
import { clock } from "../runtime/clock";
import type { Client, Db, Draft, EvalState, Evaluation, Idea, Inventor, Transition, User } from "../runtime/types";
import type { IdeaState } from "../../contract/enums";
import { INVENTIONS, answersFor } from "./content";
import { makeReport } from "./reports";

export type IdeaSpec = {
  invention: number;
  author: User;
  coInventors?: User[];
  state: IdeaState;
  ageDays: number;            // days since submission (or creation for drafts)
  evaluation?: { state: EvalState; score?: number; progress?: boolean };
  comment?: string;           // the reviewer's comment for CHANGES_REQUESTED / REJECTED
  reviewer?: User;
};

/** Build a tenant's ideas with the transition chain each state requires (mirrors pulse-backend seed-demo-inventor PLANS). */
export function buildTenant(rng: Rng, client: Client, specs: IdeaSpec[], data: Pick<Db, "ideas" | "inventors" | "drafts" | "transitions" | "evaluations">, startSeq = 1) {
  specs.forEach((spec, i) => {
    const inv = INVENTIONS[spec.invention % INVENTIONS.length];
    const seq = startSeq + i;
    const ideaId = uuid(rng);
    const created = clock.daysAgo(spec.ageDays + 2);
    const submitted = spec.state === "DRAFT" ? null : clock.daysAgo(spec.ageDays);
    const idea: Idea = {
      id: ideaId, client_id: client.id, author_id: spec.author.id, title: inv.title,
      body: i % 3 === 0 ? `A short inventor-written summary of ${inv.title.toLowerCase()}.` : null,
      reference: `${client.idea_reference_prefix}-${String(seq).padStart(4, "0")}`, reference_seq: seq,
      state: spec.state, revision: spec.state === "REJECTED" ? 1 : 1, submitted_at: submitted, created_at: created, updated_at: clock.daysAgo(Math.max(0, spec.ageDays - 1)),
    };
    data.ideas.push(idea);
    data.inventors.push({ id: uuid(rng), idea_id: ideaId, inventor_id: spec.author.id, role: "PRIMARY", added_at: created });
    for (const co of spec.coInventors ?? []) data.inventors.push({ id: uuid(rng), idea_id: ideaId, inventor_id: co.id, role: "CO", added_at: created });

    const evalId = spec.evaluation ? uuid(rng) : null;
    const complete = spec.state !== "DRAFT";
    const terminal = spec.evaluation && ["SUCCEEDED", "PARTIAL"].includes(spec.evaluation.state) && !spec.evaluation.progress;
    const score = terminal ? spec.evaluation!.score ?? 70 : null;
    const report = terminal ? makeReport(rng, evalId!, inv.title, score!, { partial: spec.evaluation!.state === "PARTIAL" }) : null;
    const draft: Draft = {
      id: uuid(rng), idea_id: ideaId, answers: answersFor(inv.title, inv.area, complete), status: complete ? "SUBMITTED" : "DRAFT",
      api_evaluation_id: evalId, score, report,
      brief_summary: `${inv.title}: a ${inv.area.toLowerCase()} improvement that removes manual recalibration.`,
      brief_problem: "Current approaches need periodic manual adjustment and degrade under sustained load.",
      created_at: created, updated_at: submitted ?? created,
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

    // Transition chain per state (review-chain.ts): submit -> TECH_REVIEW (committee) or LEGAL_REVIEW.
    const chain: Array<[IdeaState | null, IdeaState, Transition["stage"], Transition["decision"], User, string | null]> = [];
    const firstStage: IdeaState = client.has_tech_committee ? "TECH_REVIEW" : "LEGAL_REVIEW";
    const reviewer = spec.reviewer ?? spec.author;
    if (spec.state !== "DRAFT") chain.push([null, firstStage, null, null, spec.author, null]);
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

export const rngFor = (name: string) => mulberry32(seedFrom(`pulse-design.scenario.${name}`));
export const emptyData = (): Pick<Db, "ideas" | "inventors" | "drafts" | "transitions" | "evaluations"> => ({ ideas: [], inventors: [], drafts: [], transitions: [], evaluations: [] });
