import type { ScenarioDef } from "../runtime/types";
import { ACME, GLOBEX, CLIENTS, ALL_USERS, USERS } from "./personas";
import { buildTenant, emptyData, rngFor } from "./build";

/**
 * Named scenarios. A story or the chip selects one; the store is rebuilt from it.
 * committee/queue and counsel/queue are the spike's two; the rest arrive with
 * the scaffold.
 */
const committeeQueue: ScenarioDef = {
  name: "committee/queue",
  title: "Tech committee queue at Acme",
  description: "Six ideas at technical review with a spread of ages, one waiting on the inventor, one sent on, one filed. Evaluations complete, partial, running and failed.",
  clock: "2026-09-03T09:00:00.000Z",
  defaultPersona: USERS.committee.email,
  personas: [USERS.committee.email, USERS.counsel.email, USERS.inventor.email],
  build: () => {
    const rng = rngFor("committee/queue");
    const data = emptyData();
    buildTenant(rng, ACME, [
      { invention: 0, author: USERS.inventor, coInventors: [USERS.coinv], state: "TECH_REVIEW", ageDays: 1, evaluation: { state: "SUCCEEDED", score: 74 } },
      { invention: 1, author: USERS.coinv, state: "TECH_REVIEW", ageDays: 4, evaluation: { state: "RUNNING" } },
      { invention: 2, author: USERS.inventor, state: "TECH_REVIEW", ageDays: 9, evaluation: { state: "PARTIAL", score: 58 } },
      { invention: 3, author: USERS.newdev, state: "TECH_REVIEW", ageDays: 23 },
      { invention: 4, author: USERS.inventor, state: "TECH_REVIEW", ageDays: 31, evaluation: { state: "FAILED" } },
      { invention: 5, author: USERS.coinv, state: "TECH_REVIEW", ageDays: 2, evaluation: { state: "SUCCEEDED", score: 41 } },
      { invention: 6, author: USERS.inventor, state: "CHANGES_REQUESTED", ageDays: 12, reviewer: USERS.committee, comment: "Please add the measured drift figures for the encoder test." },
      { invention: 7, author: USERS.coinv, state: "SENT_TO_PHOTON", ageDays: 40, reviewer: USERS.counsel, evaluation: { state: "SUCCEEDED", score: 81 } },
      { invention: 8, author: USERS.inventor, state: "FILED", ageDays: 120, reviewer: USERS.counsel, evaluation: { state: "SUCCEEDED", score: 77 } },
      { invention: 9, author: USERS.newdev, state: "DRAFT", ageDays: 3 },
    ], data);
    return { clients: CLIENTS, users: ALL_USERS, ...data };
  },
};

const counselQueue: ScenarioDef = {
  name: "counsel/queue",
  title: "Legal counsel queue at Globex, no committee",
  description: "Ideas arrive straight at legal review. Five waiting, one declined, one sent to Photon Legal.",
  clock: "2026-09-03T09:00:00.000Z",
  defaultPersona: USERS.globexCounsel.email,
  personas: [USERS.globexCounsel.email, USERS.globexInventor.email],
  build: () => {
    const rng = rngFor("counsel/queue");
    const data = emptyData();
    buildTenant(rng, GLOBEX, [
      { invention: 8, author: USERS.globexInventor, state: "LEGAL_REVIEW", ageDays: 2, evaluation: { state: "SUCCEEDED", score: 69 } },
      { invention: 9, author: USERS.globexInventor, state: "LEGAL_REVIEW", ageDays: 6, evaluation: { state: "SUCCEEDED", score: 88 } },
      { invention: 10, author: USERS.globexInventor, state: "LEGAL_REVIEW", ageDays: 15, evaluation: { state: "RUNNING" } },
      { invention: 11, author: USERS.globexInventor, state: "LEGAL_REVIEW", ageDays: 27, evaluation: { state: "TIMED_OUT" } },
      { invention: 7, author: USERS.globexInventor, state: "LEGAL_REVIEW", ageDays: 44 },
      { invention: 5, author: USERS.globexInventor, state: "REJECTED", ageDays: 30, reviewer: USERS.globexCounsel, comment: "Published by the applicant at a trade show more than a year ago." },
      { invention: 3, author: USERS.globexInventor, state: "SENT_TO_PHOTON", ageDays: 60, reviewer: USERS.globexCounsel, evaluation: { state: "SUCCEEDED", score: 79 } },
    ], data, 30);
    return { clients: CLIENTS, users: ALL_USERS, ...data };
  },
};

export const SCENARIOS: Record<string, ScenarioDef> = {
  [committeeQueue.name]: committeeQueue,
  [counselQueue.name]: counselQueue,
};
export const DEFAULT_SCENARIO = committeeQueue.name;
