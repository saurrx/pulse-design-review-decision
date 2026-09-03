import type { ScenarioDef } from "../../runtime/types";
import { uuid } from "../../runtime/prng";
import { clock } from "../../runtime/clock";
import { buildIdeas, emptyData, portfolio, rngFor, seedOperations, type Data, type IdeaSpec } from "../build";
import { BEACON, NORTHWIND, ORBITAL, V0_ACCESS, V0_ALL_USERS, V0_CLIENTS, V0_USERS as U } from "./personas";
import { outboxFor } from "./emails";

/**
 * V0 scenarios. Four personas, one Workspace Admin review stage, no committee,
 * no superadmin. Names start with `v0/`; the legacy six-role scenarios keep
 * their names and serve only the Legacy reference tier. Every V0 scenario sets
 * `flags.v0`, which is what lets the mock model the two founder-approved
 * behaviours the backend does not have yet (mock/proposed-fields.json):
 * Workspace Admin submission on behalf of an inventor with separate
 * attribution, and the activation email outbox.
 */
const NOW = "2026-09-03T09:00:00.000Z";

/** V0 tenants, V0 people, no legacy account anywhere in the store. */
export const emptyDataV0 = (flags: Data["flags"] = {}): Data => ({ ...emptyData({ ...flags, v0: true }), clients: V0_CLIENTS, users: V0_ALL_USERS, access: V0_ACCESS });

const SMALL = { [NORTHWIND.id]: portfolio(180, "northwind-v1", NORTHWIND), [BEACON.id]: portfolio(6, "beacon-v1", BEACON, 0.5) };
const LARGE = { [NORTHWIND.id]: portfolio(14356, "northwind-large", NORTHWIND, 0.96), [BEACON.id]: portfolio(6, "beacon-v1", BEACON, 0.5) };

/** Northwind's ideas: every V0 state, evaluation states, a low score that was submitted anyway, one submitted on behalf, one resubmitted. */
const northwind = (): IdeaSpec[] => [
  { invention: 0, author: U.inventor, coInventors: [U.coinventor], state: "LEGAL_REVIEW", ageDays: 1, evaluation: { state: "SUCCEEDED", score: 74 } },
  { invention: 1, author: U.coinventor, state: "LEGAL_REVIEW", ageDays: 3, submittedBy: U.admin, evaluation: { state: "SUCCEEDED", score: 62 } },
  { invention: 2, author: U.inventor, state: "LEGAL_REVIEW", ageDays: 6 },
  { invention: 3, author: U.coinventor, state: "LEGAL_REVIEW", ageDays: 12, evaluation: { state: "SUCCEEDED", score: 23 } },
  { invention: 4, author: U.inventor, state: "LEGAL_REVIEW", ageDays: 19, evaluation: { state: "PARTIAL", score: 58 } },
  { invention: 5, author: U.coinventor, state: "LEGAL_REVIEW", ageDays: 33, evaluation: { state: "RUNNING" } },
  { invention: 6, author: U.inventor, state: "CHANGES_REQUESTED", ageDays: 9, reviewer: U.admin, comment: "Please add the measured drift figures from the encoder test so the novelty is supported by data." },
  { invention: 7, author: U.coinventor, state: "REJECTED", ageDays: 45, reviewer: U.admin2, comment: "The mechanism was shown at a trade fair more than a year ago; the overlay alone is not distinguishing." },
  { invention: 8, author: U.inventor, state: "SENT_TO_PHOTON", ageDays: 1, reviewer: U.admin, evaluation: { state: "SUCCEEDED", score: 81 } },
  { invention: 9, author: U.coinventor, state: "SENT_TO_PHOTON", ageDays: 38, reviewer: U.admin, evaluation: { state: "SUCCEEDED", score: 69 } },
  { invention: 10, author: U.inventor, state: "FILED", ageDays: 140, reviewer: U.admin, evaluation: { state: "SUCCEEDED", score: 77 } },
  { invention: 11, author: U.inventor, state: "DRAFT", ageDays: 4, completion: 40 },
  { invention: 12, author: U.inventor, state: "DRAFT", ageDays: 2, completion: 100, evaluation: { state: "SUCCEEDED", score: 66 } },
  { invention: 13, author: U.coinventor, state: "DRAFT", ageDays: 1, completion: 0 },
  { invention: 14, author: U.inventor, state: "DRAFT", ageDays: 1, completion: 100 },
];

/** The idea at index `at` becomes a resubmission: a changes-requested round before the current review, revision 2. */
function resubmitted(name: string, d: Data, at: number) {
  const rng = rngFor(`${name}.resubmission`);
  const idea = d.ideas[at];
  if (!idea || idea.state !== "LEGAL_REVIEW") return;
  const first = d.transitions.find((t) => t.idea_id === idea.id && t.to_state === "LEGAL_REVIEW");
  const when = clock.daysAgo(Math.max(1, Math.round((Date.now() - Date.parse(idea.submitted_at ?? clock.iso())) / 86_400_000) + 8));
  d.transitions.push({ id: uuid(rng), idea_id: idea.id, from_state: null, to_state: "LEGAL_REVIEW", stage: null, decision: null, actor_id: idea.author_id, revision: 1, comment: null, is_appeal: false, created_at: when });
  d.transitions.push({ id: uuid(rng), idea_id: idea.id, from_state: "LEGAL_REVIEW", to_state: "CHANGES_REQUESTED", stage: "LEGAL", decision: "CHANGES_REQUESTED", actor_id: U.admin.id, revision: 1, comment: "Please describe the calibration step in enough detail for a reader to repeat it.", is_appeal: false, created_at: when });
  if (first) { first.from_state = "CHANGES_REQUESTED"; first.revision = 2; }
  idea.revision = 2;
}

function northwindBuild(name: string, portfolios: Record<string, ReturnType<typeof portfolio>> = SMALL): Data {
  const rng = rngFor(name);
  const d = emptyDataV0();
  buildIdeas(rng, NORTHWIND, northwind(), d, 1);
  resubmitted(name, d, 2);
  d.portfolios = portfolios;
  seedOperations(rng, d);
  // A failed import in Northwind's history, for the Photon exception states.
  d.imports.push({ id: uuid(rng), client_id: NORTHWIND.id, file_id: d.files[0]?.id ?? uuid(rng), status: "FAILED", rows_total: 41, created_count: 0, updated_count: 0, unchanged_count: 0, failed_count: 41, due_dates_created: 0, duplicate_in_file: 3, unmapped_columns: ["Renewal owner"], errors: [{ row: 2, message: "Jurisdiction column is empty." }], completed_at: clock.daysAgo(2), created_at: clock.daysAgo(2), imported_by_id: U.caseOwner.id });
  return d;
}

const v0 = (name: string, title: string, description: string, defaultPersona: string, personas: string[], build: () => Data): ScenarioDef => ({
  name, title, description, clock: NOW, defaultPersona, personas,
  build: () => { const d = build(); d.emails = outboxFor(rngFor(`${name}.emails`), d); return d; },
});

const inventorFirstRun = v0("v0/inventor/first-run", "New inventor at Northwind, nothing yet",
  "Ines Duarte activated yesterday and has no idea: first run, the invitation and reminder emails, colleagues' momentum, Submit an idea leading.",
  U.newInventor.email, [U.newInventor.email, U.invitedInventor.email, U.admin.email], () => northwindBuild("v0/inventor/first-run"));

const inventorPortfolio = v0("v0/inventor/portfolio", "Inventor with ideas in every V0 state",
  "Anika Sharma's ideas: drafts at three completions including one evaluated and not submitted, awaiting review, changes requested, resubmitted, rejected, sent to Photon Legal, filed. Evaluations not run, running, partial, succeeded, and a low score that was submitted.",
  U.inventor.email, [U.inventor.email, U.coinventor.email, U.admin.email], () => northwindBuild("v0/inventor/portfolio"));

const workspaceAdminQueue = v0("v0/workspace-admin/queue", "Workspace Admin queue at Northwind",
  "Six ideas awaiting the one review stage, oldest 33 days, one without an evaluation, one submitted on behalf of an inventor by the admin, one resubmitted after changes. Two Workspace Admins. Actions with contextual dates.",
  U.admin.email, [U.admin.email, U.admin2.email, U.inventor.email, U.caseOwner.email], () => northwindBuild("v0/workspace-admin/queue"));

const workspaceAdminEmpty = v0("v0/workspace-admin/empty", "New workspace at Beacon, no inventors yet",
  "Elin Sørensen's workspace six weeks in: no inventors, no ideas, a small imported portfolio, the activation emails that follow from that state.",
  U.beaconAdmin.email, [U.beaconAdmin.email, U.caseOwner.email], () => { const d = emptyDataV0(); d.portfolios = SMALL; seedOperations(rngFor("v0/workspace-admin/empty"), d, { requestsPerClient: 2 }); return d; });

const caseOwnerMyWork = v0("v0/case-owner/my-work", "Case Owner with two assigned clients",
  "Devika Nair covers Northwind and, since five days, Beacon: an idea newly sent to Photon Legal, urgent Actions and dates, Beacon's onboarding incomplete. Jonas Weber has no assigned client yet.",
  U.caseOwner.email, [U.caseOwner.email, U.caseOwner2.email, U.photonAdmin.email], () => northwindBuild("v0/case-owner/my-work"));

const photonAdminFirm = v0("v0/photon-admin/firm", "Photon Admin across the firm",
  "Orbital Foods has no Case Owner and no Workspace Admin, Northwind has a failed import and ideas aging after approval, Beacon is mid-onboarding.",
  U.photonAdmin.email, [U.photonAdmin.email, U.caseOwner.email], () => northwindBuild("v0/photon-admin/firm"));

const large = v0("v0/shape/large", "A large Northwind portfolio",
  "About 14,000 patents and 13,000 dates through server-style paging, generated per request.",
  U.admin.email, [U.admin.email, U.inventor.email, U.photonAdmin.email], () => northwindBuild("v0/shape/large", LARGE));

const failure = v0("v0/shape/failure", "Every write fails",
  "Mutations answer 400 with a message, evaluations fail or time out, an import reports duplicates and errors.",
  U.admin.email, [U.admin.email, U.inventor.email, U.caseOwner.email, U.photonAdmin.email], () => {
    const d = northwindBuild("v0/shape/failure");
    d.flags = { ...d.flags, mutationsFail: true, importTrouble: true };
    d.evaluations.forEach((e) => { if (e.state === "RUNNING" || e.state === "QUEUED") { e.state = "TIMED_OUT"; e.failure_reason = "The evaluation exceeded its time budget."; } });
    return d;
  });

const slow = v0("v0/shape/slow", "Slow network",
  "Every response takes two seconds, for loading and saving states.",
  U.admin.email, [U.admin.email, U.inventor.email, U.caseOwner.email, U.photonAdmin.email], () => { const d = northwindBuild("v0/shape/slow"); d.flags = { ...d.flags, latencyMs: 2000 }; return d; });

const authFailures = v0("v0/auth/failures", "Authentication failures",
  "The only V0 scenario that returns 401 on purpose: invalid login, expired session with a failed refresh, revoked access, SSO failure, unknown domain at signup.",
  U.admin.email, [U.admin.email], () => { const d = emptyDataV0({ authFails: true }); d.portfolios = SMALL; return d; });

export const V0_SCENARIOS: Record<string, ScenarioDef> = Object.fromEntries([inventorFirstRun, inventorPortfolio, workspaceAdminQueue, workspaceAdminEmpty, caseOwnerMyWork, photonAdminFirm, large, failure, slow, authFailures].map((s) => [s.name, s]));
export const DEFAULT_V0_SCENARIO = workspaceAdminQueue.name;
export { ORBITAL };
