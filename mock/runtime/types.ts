import type { IdeaState, ReviewDecision, ReviewStage } from "../../contract/enums";

export type RoleName = "INVENTOR" | "TECH_COMMITTEE" | "LEGAL_COUNSEL" | "CASE_OWNER" | "PHOTON_ADMIN" | "PHOTON_SUPERADMIN";

export type Client = { id: string; name: string; domain: string; has_tech_committee: boolean; idea_reference_prefix: string; type: "EXISTING" | "POTENTIAL"; plan: "FREE" | "ENTERPRISE" | "PRODUCT_OWNER"; is_active: boolean; logo_file: null; created_at: string; updated_at: string };
export type User = { id: string; email: string; name: string; role: RoleName; status: "INVITED" | "ACTIVE" | "SUSPENDED"; client_id: string | null; assigned_client_ids: string[]; last_login_at: string | null; created_at: string; updated_at: string };
export type Inventor = { id: string; idea_id: string; inventor_id: string; role: "PRIMARY" | "CO"; added_at: string };
export type Idea = { id: string; client_id: string; author_id: string; title: string; body: string | null; reference: string; reference_seq: number; state: IdeaState; revision: number; submitted_at: string | null; created_at: string; updated_at: string };
export type Transition = { id: string; idea_id: string; from_state: IdeaState | null; to_state: IdeaState; stage: ReviewStage | null; decision: ReviewDecision | null; actor_id: string; revision: number; comment: string | null; is_appeal: boolean; created_at: string };
export type Draft = { id: string; idea_id: string; answers: Record<string, unknown>; status: "DRAFT" | "SUBMITTED"; api_evaluation_id: string | null; score: number | null; report: unknown | null; brief_summary: string | null; brief_problem: string | null; created_at: string; updated_at: string };
export type EvalState = "QUEUED" | "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED" | "TIMED_OUT";
export type Evaluation = { id: string; draft_id: string; mode: "fixed" | "progress"; state: EvalState; final_state?: EvalState; started_at: string; score: number | null; report: unknown | null; failure_reason: string | null };

export type Db = {
  scenario: string;
  seedVersion: number;
  clients: Client[];
  users: User[];
  ideas: Idea[];
  inventors: Inventor[];
  drafts: Draft[];
  transitions: Transition[];
  evaluations: Evaluation[];
};

export type ScenarioDef = {
  name: string;
  title: string;
  description: string;
  clock: string;
  defaultPersona: string;
  personas: string[];
  build: () => Omit<Db, "scenario" | "seedVersion">;
};
