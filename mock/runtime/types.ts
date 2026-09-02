import type { IdeaState, ReviewDecision, ReviewStage, PatentStatus, DueDateStatus, ActionStatus, ActionSubmissionState, InviteStatus, FileStatus, ImportStatus } from "../../contract/enums";

export type RoleName = "INVENTOR" | "TECH_COMMITTEE" | "LEGAL_COUNSEL" | "CASE_OWNER" | "PHOTON_ADMIN" | "PHOTON_SUPERADMIN";

export type Client = { id: string; name: string; domain: string; has_tech_committee: boolean; idea_reference_prefix: string; type: "EXISTING" | "POTENTIAL"; plan: "FREE" | "ENTERPRISE" | "PRODUCT_OWNER"; is_active: boolean; about: string | null; logo_file_id: string | null; created_at: string; updated_at: string };
export type User = { id: string; email: string; name: string; role: RoleName; status: "INVITED" | "ACTIVE" | "SUSPENDED"; client_id: string | null; assigned_client_ids: string[]; phone: string | null; country_code: string | null; country_name: string | null; address: string | null; notification_prefs: { reviewDecisions: boolean; informationRequests: boolean; filingUpdates: boolean }; last_login_at: string | null; created_at: string; updated_at: string };
export type ClientAccess = { id: string; user_id: string; client_id: string; kind: "ASSIGNMENT" | "TEMPORARY" | "STEP_IN"; is_primary: boolean; reason: string | null; expires_at: string | null; granted_at: string; revoked_at: string | null };
export type Inventor = { id: string; idea_id: string; inventor_id: string; role: "PRIMARY" | "CO"; added_at: string };
export type Idea = { id: string; client_id: string; author_id: string; title: string; body: string | null; reference: string; reference_seq: number; state: IdeaState; revision: number; submitted_at: string | null; created_at: string; updated_at: string };
export type Transition = { id: string; idea_id: string; from_state: IdeaState | null; to_state: IdeaState; stage: ReviewStage | null; decision: ReviewDecision | null; actor_id: string; revision: number; comment: string | null; is_appeal: boolean; created_at: string };
export type Draft = { id: string; idea_id: string; answers: Record<string, unknown>; status: "DRAFT" | "SUBMITTED"; api_evaluation_id: string | null; score: number | null; report: unknown | null; brief_summary: string | null; brief_problem: string | null; created_at: string; updated_at: string };
export type EvalState = "QUEUED" | "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED" | "TIMED_OUT";
export type Evaluation = { id: string; draft_id: string; mode: "fixed" | "progress"; state: EvalState; final_state?: EvalState; started_at: string; score: number | null; report: unknown | null; failure_reason: string | null };

export type Patent = { id: string; client_id: string; title: string; application_number: string | null; jurisdiction: string; status: PatentStatus; filing_date: string | null; grant_date: string | null; tags: string[]; abstract: string | null; assignee_original: string | null; current_assignee: string | null; inventors: string[]; simple_family_members: string[]; ipc_all_versions: string[]; priority_details: string | null; additional_notes: string | null; current_status: string | null; prn: string | null; oc: string | null; next_steps_gpo: string[]; next_steps_legal: string[]; status_timeline_history: Array<{ status: string; date: string }>; deleted_at: string | null; created_at: string; updated_at: string };
export type DueDate = { id: string; patent_id: string; client_id: string; event_type: string; title: string; due_at: string; status: DueDateStatus; created_at: string; updated_at: string };
export type ActionTemplate = { id: string; label: string; description: string; category: string; event_types: string[]; requires_countries: boolean; requires_note: boolean; rank_default: number; is_recommended: boolean; enabled: boolean };
export type ActionRequest = { id: string; client_id: string; due_date_id: string; template_id: string | null; instruction: string | null; selected_countries: string[]; status: ActionStatus; submission_state: ActionSubmissionState; version: number; note: string | null; requested_by_id: string; requested_at: string; updated_at: string };
export type Invite = { id: string; email: string; role: RoleName; client_id: string | null; code: string; status: InviteStatus; invited_by_id: string; expires_at: string; accepted_at: string | null; revoked_at: string | null; created_at: string };
export type StoredFile = { id: string; client_id: string | null; original_name: string; file_name: string; content_type: string; size_bytes: number; status: FileStatus; category: string; uploaded_by_id: string; created_at: string };
export type PatentImport = { id: string; client_id: string; file_id: string; status: ImportStatus; rows_total: number; created_count: number; updated_count: number; unchanged_count: number; failed_count: number; due_dates_created: number; duplicate_in_file: number; unmapped_columns: string[]; errors: Array<{ row: number; message: string }>; completed_at: string | null; created_at: string; imported_by_id: string };

/** Generator config for a tenant's portfolio; rows are generated on demand, never persisted. */
export type PortfolioSpec = { count: number; seed: string; dueDatesPerPatent: number; assignee: string };

export type Flags = {
  /** Every mutation answers 400 with a message, for failure-state design. */
  mutationsFail?: boolean;
  /** The login endpoint refuses every account; /me and refresh answer 401. */
  authFails?: boolean;
  /** Imports report duplicates and row errors. */
  importTrouble?: boolean;
  /** Extra latency in ms on every response, for loading states. */
  latencyMs?: number;
};

export type Db = {
  scenario: string;
  seedVersion: number;
  flags: Flags;
  clients: Client[];
  users: User[];
  access: ClientAccess[];
  ideas: Idea[];
  inventors: Inventor[];
  drafts: Draft[];
  transitions: Transition[];
  evaluations: Evaluation[];
  portfolios: Record<string, PortfolioSpec>;
  /** Patents created at runtime (filed ideas, imports, manual adds). Generated ones live in the memo, not here. */
  patents: Patent[];
  patentOverrides: Record<string, Partial<Patent>>;
  dueDates: DueDate[];
  dueDateOverrides: Record<string, Partial<DueDate>>;
  remindersAt: Record<string, string>;
  actionTemplates: ActionTemplate[];
  actionRequests: ActionRequest[];
  invites: Invite[];
  files: StoredFile[];
  imports: PatentImport[];
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
