import type { ScenarioDef } from "../runtime/types";
import { ACME, GLOBEX, HELIX, USERS } from "./personas";
import { buildIdeas, emptyData, portfolio, rngFor, seedOperations, type IdeaSpec } from "./build";
import { V0_SCENARIOS, DEFAULT_V0_SCENARIO } from "./v0";

/**
 * Named scenarios. A story or the chip selects one; the store is rebuilt from
 * it. Personas mirror the backend seed; portfolios are generated on demand.
 */
const NOW = "2026-09-03T09:00:00.000Z";

const acmeQueue = (): IdeaSpec[] => [
  { invention: 0, author: USERS.inventor, coInventors: [USERS.coinv], state: "TECH_REVIEW", ageDays: 1, evaluation: { state: "SUCCEEDED", score: 74 } },
  { invention: 1, author: USERS.coinv, state: "TECH_REVIEW", ageDays: 4, evaluation: { state: "RUNNING" } },
  { invention: 2, author: USERS.inventor, state: "TECH_REVIEW", ageDays: 9, evaluation: { state: "PARTIAL", score: 58 } },
  { invention: 3, author: USERS.newdev, state: "TECH_REVIEW", ageDays: 23 },
  { invention: 4, author: USERS.inventor, state: "TECH_REVIEW", ageDays: 31, evaluation: { state: "FAILED" } },
  { invention: 5, author: USERS.coinv, state: "TECH_REVIEW", ageDays: 2, evaluation: { state: "SUCCEEDED", score: 41 } },
  { invention: 6, author: USERS.inventor, state: "CHANGES_REQUESTED", ageDays: 12, reviewer: USERS.committee, comment: "Please add the measured drift figures for the encoder test." },
  { invention: 7, author: USERS.coinv, state: "SENT_TO_PHOTON", ageDays: 40, reviewer: USERS.counsel, evaluation: { state: "SUCCEEDED", score: 81 } },
  { invention: 8, author: USERS.inventor, state: "FILED", ageDays: 120, reviewer: USERS.counsel, evaluation: { state: "SUCCEEDED", score: 77 } },
  { invention: 9, author: USERS.newdev, state: "DRAFT", ageDays: 3, completion: 40 },
  { invention: 10, author: USERS.inventor, state: "LEGAL_REVIEW", ageDays: 6, reviewer: USERS.committee, evaluation: { state: "SUCCEEDED", score: 66 } },
  { invention: 11, author: USERS.coinv, state: "REJECTED", ageDays: 50, reviewer: USERS.committee, comment: "The gesture vocabulary is disclosed in the 2019 literature; the overlay alone is not distinguishing." },
];
const globexQueue = (): IdeaSpec[] => [
  { invention: 8, author: USERS.globexInventor, state: "LEGAL_REVIEW", ageDays: 2, evaluation: { state: "SUCCEEDED", score: 69 } },
  { invention: 9, author: USERS.globexInventor2, state: "LEGAL_REVIEW", ageDays: 6, evaluation: { state: "SUCCEEDED", score: 88 } },
  { invention: 10, author: USERS.globexInventor, state: "LEGAL_REVIEW", ageDays: 15, evaluation: { state: "RUNNING" } },
  { invention: 11, author: USERS.globexInventor2, state: "LEGAL_REVIEW", ageDays: 27, evaluation: { state: "TIMED_OUT" } },
  { invention: 7, author: USERS.globexInventor, state: "LEGAL_REVIEW", ageDays: 44 },
  { invention: 5, author: USERS.globexInventor, state: "REJECTED", ageDays: 30, reviewer: USERS.globexCounsel, comment: "Published by the applicant at a trade show more than a year ago." },
  { invention: 3, author: USERS.globexInventor2, state: "SENT_TO_PHOTON", ageDays: 60, reviewer: USERS.globexCounsel, evaluation: { state: "SUCCEEDED", score: 79 } },
  { invention: 4, author: USERS.globexInventor, state: "FILED", ageDays: 150, reviewer: USERS.globexCounsel, evaluation: { state: "SUCCEEDED", score: 83 } },
];
const helixQueue = (): IdeaSpec[] => [
  { invention: 2, author: USERS.helixInventor, state: "TECH_REVIEW", ageDays: 3, evaluation: { state: "SUCCEEDED", score: 71 } },
  { invention: 6, author: USERS.helixInventor, state: "DRAFT", ageDays: 1, completion: 60 },
];

const firm = (name: string, title: string, description: string, defaultPersona: string, personas: string[], portfolios: Record<string, ReturnType<typeof portfolio>>, extra?: Partial<ScenarioDef>): ScenarioDef => ({
  name, title, description, clock: NOW, defaultPersona, personas,
  build: () => {
    const rng = rngFor(name);
    const data = emptyData();
    buildIdeas(rng, ACME, acmeQueue(), data, 1);
    buildIdeas(rng, GLOBEX, globexQueue(), data, 30);
    buildIdeas(rng, HELIX, helixQueue(), data, 1);
    data.portfolios = portfolios;
    seedOperations(rng, data);
    return data;
  },
  ...extra,
});

const SMALL = { [ACME.id]: portfolio(120, "acme-v1", ACME), [GLOBEX.id]: portfolio(60, "globex-v1", GLOBEX), [HELIX.id]: portfolio(14, "helix-v1", HELIX) };
const MID = { [ACME.id]: portfolio(320, "acme-v1", ACME), [GLOBEX.id]: portfolio(140, "globex-v1", GLOBEX), [HELIX.id]: portfolio(45, "helix-v1", HELIX) };

const inventorFirstRun: ScenarioDef = {
  name: "inventor/first-run", title: "New inventor at Acme, nothing yet", description: "An inventor who has never submitted: empty home, first draft, autosave, evaluation from queued to complete on the mock clock.",
  clock: NOW, defaultPersona: USERS.newdev.email, personas: [USERS.newdev.email, USERS.committee.email, USERS.counsel.email],
  build: () => { const d = emptyData(); d.portfolios = SMALL; return d; },
};
const inventorPortfolio: ScenarioDef = {
  name: "inventor/portfolio", title: "Inventor with ideas in every state", description: "Priya Raman's disclosures: drafts at several completions, under review, changes requested, rejected with an appeal path, sent to Photon, filed.",
  clock: NOW, defaultPersona: USERS.inventor.email, personas: [USERS.inventor.email, USERS.coinv.email, USERS.committee.email, USERS.counsel.email],
  build: () => {
    const rng = rngFor("inventor/portfolio"); const d = emptyData();
    buildIdeas(rng, ACME, [
      { invention: 0, author: USERS.inventor, state: "DRAFT", ageDays: 1, completion: 20 },
      { invention: 1, author: USERS.inventor, coInventors: [USERS.coinv], state: "DRAFT", ageDays: 5, completion: 80 },
      { invention: 2, author: USERS.inventor, state: "TECH_REVIEW", ageDays: 3, evaluation: { state: "SUCCEEDED", score: 74 } },
      { invention: 3, author: USERS.inventor, state: "TECH_REVIEW", ageDays: 8, evaluation: { state: "RUNNING" } },
      { invention: 4, author: USERS.inventor, state: "LEGAL_REVIEW", ageDays: 14, reviewer: USERS.committee, evaluation: { state: "SUCCEEDED", score: 66 } },
      { invention: 5, author: USERS.inventor, state: "CHANGES_REQUESTED", ageDays: 11, reviewer: USERS.committee, comment: "Please add the measured drift figures for the encoder test." },
      { invention: 6, author: USERS.inventor, state: "REJECTED", ageDays: 40, reviewer: USERS.committee, comment: "Overlaps the 2023 application already filed by the group." },
      { invention: 7, author: USERS.inventor, state: "SENT_TO_PHOTON", ageDays: 60, reviewer: USERS.counsel, evaluation: { state: "SUCCEEDED", score: 81 } },
      { invention: 8, author: USERS.inventor, state: "FILED", ageDays: 200, reviewer: USERS.counsel, evaluation: { state: "SUCCEEDED", score: 77 } },
    ], d, 1);
    d.portfolios = SMALL; seedOperations(rng, d); return d;
  },
};
const committeeQueue = firm("committee/queue", "Tech committee queue at Acme", "Six ideas at technical review with a spread of ages, one waiting on the inventor, one sent on, one filed. Evaluations complete, partial, running and failed.", USERS.committee.email, [USERS.committee.email, USERS.committee2.email, USERS.counsel.email, USERS.inventor.email], SMALL);
const counselQueue = firm("counsel/queue", "Legal counsel queue at Globex, no committee", "Ideas arrive straight at legal review. Five waiting, one declined, one sent to Photon Legal, one filed. Workspace people, invites and share link.", USERS.globexCounsel.email, [USERS.globexCounsel.email, USERS.globexInventor.email], SMALL);
const caseOwner = firm("case-owner/assigned", "Case owner with two of three clients", "Ravi Menon covers Acme and Globex but not Helix: scoped client list, view-as and exit, portfolio upload, actions queue.", USERS.owner.email, [USERS.owner.email, USERS.cover.email, USERS.admin.email], MID);
const photonAdmin = firm("photon-admin/firm", "Photon admin across the firm", "All three clients, onboarding, case-owner access drawer, operations queue, due dates across clients.", USERS.admin.email, [USERS.admin.email, USERS.owner.email, USERS.cover.email, USERS.founder.email], MID);
const superadmin = firm("superadmin/firm", "Founder tier", "Everything the admin sees, plus the two places production short-changes this role.", USERS.founder.email, [USERS.founder.email, USERS.admin.email], MID);
const large = firm("shape/large", "A large single-tenant portfolio", "About 14,000 patents and 13,000 deadlines at Acme through server-style paging, generated per request; long titles, many countries, many events on one day.", USERS.counsel.email, [USERS.counsel.email, USERS.committee.email, USERS.admin.email], { [ACME.id]: portfolio(14356, "acme-large", ACME, 0.96), [GLOBEX.id]: portfolio(60, "globex-v1", GLOBEX), [HELIX.id]: portfolio(14, "helix-v1", HELIX) });
const failure = firm("shape/failure", "Every write fails", "Mutations answer 400 with a message, evaluations time out or fail, and an import reports duplicates and errors.", USERS.counsel.email, [USERS.counsel.email, USERS.committee.email, USERS.admin.email, USERS.inventor.email], SMALL, {
  build: () => { const d = firmBuild("shape/failure"); d.flags = { mutationsFail: true, importTrouble: true }; d.evaluations.forEach((e) => { if (e.state === "RUNNING" || e.state === "QUEUED") { e.state = "TIMED_OUT"; e.failure_reason = "The evaluation exceeded its time budget."; } }); return d; },
});
const slow = firm("shape/slow", "Slow network", "Every response takes two seconds, for loading states.", USERS.counsel.email, [USERS.counsel.email, USERS.inventor.email, USERS.admin.email], SMALL, {
  build: () => { const d = firmBuild("shape/slow"); d.flags = { latencyMs: 2000 }; return d; },
});
const authFailures: ScenarioDef = {
  name: "auth/failures", title: "Authentication failures", description: "The only scenario that returns 401 on purpose: invalid login, an expired session with a failed refresh, revoked access, SSO failure.",
  clock: NOW, defaultPersona: USERS.counsel.email, personas: [USERS.counsel.email],
  build: () => { const d = emptyData({ authFails: true }); d.portfolios = SMALL; return d; },
};
const qaFull = firm("qa/full", "Everything populated for the QA tiers", "All three tenants with ideas in every state and mid-size portfolios; every persona logs in.", USERS.admin.email, Object.values(USERS).map((u) => u.email), MID);

function firmBuild(name: string) { return firm(name, "", "", USERS.counsel.email, [], SMALL).build(); }

/** Legacy reference scenarios: production's six roles as they are today. Technical regression only; never V0. */
export const LEGACY_SCENARIOS: Record<string, ScenarioDef> = Object.fromEntries([inventorFirstRun, inventorPortfolio, committeeQueue, counselQueue, caseOwner, photonAdmin, superadmin, large, failure, slow, authFailures, qaFull].map((s) => [s.name, s]));
/** V0 first, then the Legacy reference tier. */
export const SCENARIOS: Record<string, ScenarioDef> = { ...V0_SCENARIOS, ...LEGACY_SCENARIOS };
export { V0_SCENARIOS, DEFAULT_V0_SCENARIO };
export const DEFAULT_SCENARIO = committeeQueue.name;
