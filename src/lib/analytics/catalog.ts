/**
 * Canonical PostHog event catalogue for Pulse — the typed source of truth.
 *
 * SHARED and byte-identical across the three repos (pulse-frontend,
 * pulse-backend, patent-agent), mirrored the same way `qa/contract.json` is and
 * sha256 drift-gated in each. **Do not edit one copy** — edit all three and
 * re-pin the sha (see analytics-catalog drift gate). Authored in
 * photonlegal/atlas; the atlas coverage guard proves every mutation route /
 * trigger / journey step has an event here.
 *
 * PRIVACY (plan §8 + patent-agent §12.4 rule 7): events carry only ids, enums,
 * counts and timings — NEVER disclosure text, mark text, names, emails, file
 * contents, or the client-prefixed `reference`. `sanitize()` is the runtime arm;
 * the no-free-text test is the compile-time arm.
 */

/** Environments where capture is ON. Everything else (dev/local/preview) no-ops. */
export const ANALYTICS_ENV_ALLOWLIST = ['demo', 'prod'] as const;
/** Browser origin pin (frontend belt-and-braces). Prod host added at cutover. */
export const ANALYTICS_HOST_ALLOWLIST = ['demo.photonpulse.ai'] as const;

export type AnalyticsEnv = (typeof ANALYTICS_ENV_ALLOWLIST)[number];

/** Base props every emitter attaches. All non-free-text. */
export interface BaseProps {
  environment: AnalyticsEnv;
  surface: 'web' | 'api' | 'agent';
  role?: string;
  view?: boolean;
  evaluation_id?: string;
  idea_id?: string;
  patent_id?: string;
  client_id?: string;
  path?: string;
}

/**
 * Forbidden property keys: content-bearing (mirrors patent-agent
 * observability/redact FORBIDDEN_KEYS), PII, the client-identifying `reference`,
 * and secrets. Enforced by `sanitize()` AND the no-free-text test.
 */
export const PROPERTY_DENYLIST: ReadonlySet<string> = new Set([
  // content
  'ideatext', 'idea_text', 'abstract', 'title', 'claims', 'description', 'text',
  'content', 'prompt', 'completion', 'message', 'messages', 'query', 'queries',
  'document', 'documents', 'answer', 'answers', 'note', 'notes', 'reason', 'body',
  'summary', 'headline', 'report', 'evidence', 'disclosure', 'rewrite',
  // PII
  'email', 'name', 'first_name', 'last_name', 'full_name', 'phone', 'address',
  // client-identifying reference (e.g. ACME-001 leaks client + sequence)
  'reference',
  // secrets
  'apikey', 'api_key', 'key', 'token', 'access_token', 'refresh_token', 'secret',
  'password', 'authorization', 'cookie',
]);

/**
 * Every catalogue event → the extra property keys it may carry (beyond BaseProps).
 * ALL keys here are ids / enums / counts / timings by construction — no free-text
 * key is ever declared (the no-free-text test asserts none is in PROPERTY_DENYLIST).
 */
export const EVENTS = {
  // ---- auth (web + api) ----
  login_attempted: ['method'],
  login_succeeded: ['method'],
  login_failed: ['method'],
  signup_started: [],
  signup_submitted: [],
  signup_succeeded: [],
  signup_rejected_domain: [],
  logout_clicked: [],
  logout: [],
  logout_all: [],
  token_refreshed: [],
  password_reset_requested: [],
  password_reset_completed: [],
  password_changed: [],
  invite_opened: [],
  invite_accepted: [],
  share_link_accepted: [],
  view_as_prompted: [],
  view_as_entered: [],
  view_as_exited: [],

  // ---- navigation & engagement (web) ----
  nav_item_clicked: ['item'],
  redirect_blocked: ['from', 'to'],
  list_filtered: ['list'],
  list_sorted: ['list'],
  list_paginated: ['list'],
  ui_error_toast_shown: ['kind'],

  // ---- inventor loop (web + api) ----
  idea_create_opened: [],
  idea_created: [],
  draft_opened: [],
  draft_created: [],
  draft_field_saved: ['field', 'section'],
  draft_updated: [],
  draft_readiness_changed: ['pct'],
  draft_completed: [],
  co_inventor_added: [],
  co_inventor_removed: [],
  document_parsed: ['content_type', 'char_count'],
  draft_autofill_used: ['source', 'fields_filled'],
  draft_autofill_requested: ['source', 'fields_filled'],
  draft_field_review_requested: ['field', 'verdict'],
  file_presign_requested: ['content_type'],
  file_uploaded: ['content_type', 'size_band'],
  file_batch_confirmed: ['count'],
  file_downloaded: [],
  file_deleted: [],
  patentability_rail_shown: ['state', 'source'],
  patentability_rail_generated: ['state', 'source'],
  evaluation_started: [],
  evaluation_requested: [],
  re_evaluation_started: [],
  re_evaluation_requested: [],
  // The degraded outcomes (PARTIAL / TIMED_OUT) are read off `state` HERE and on
  // the agent's own `agent_evaluation_finished` — there is no second screen and
  // so no second event. A dedicated one would have to be fired from the same
  // place as this one, which is how a funnel ends up double-counting.
  evaluation_completed_viewed: ['state', 'novelty_band'],
  evaluation_persisted: ['state'],
  evaluation_report_opened: [],
  idea_submit_opened: [],
  idea_submitted: ['kind', 'appeal_count'],
  idea_transition: ['from_state', 'to_state'],
  idea_deleted: [],
  idea_cloned: [],
  inventor_added: [],
  inventor_removed: [],
  inventor_credit_removed: [],

  // ---- review (web + api) ----
  review_queue_viewed: [],
  review_disclosure_opened: [],
  review_activity_tab_viewed: [],
  review_full_record_opened: [],
  review_decision_opened: ['kind'],
  review_decided: ['decision', 'stage'],
  idea_review_decided: ['decision', 'stage'],
  request_update_submitted: [],
  reject_submitted: ['reason_len'],

  // ---- docket & actions (web + api) ----
  // /actions. Named for the `docket:read` capability that gates it, so the event
  // and the authorisation it depends on read the same in both repos.
  docket_viewed: [],
  instruction_picked: ['template_id'],
  countries_selected: ['count'],
  instruction_cancelled: [],
  actions_submit_all_clicked: [],
  action_decided: ['version'],
  actions_submitted_all: ['count'],
  action_status_changed: ['status'],
  action_resolved: ['outcome'],

  // ---- patents & filing (web + api) ----
  patents_viewed: [],
  patent_opened: [],
  patent_report_opened: [],
  patent_created: [],
  patent_updated: [],
  patent_deleted: [],
  patent_restored: [],
  patent_linked: [],
  idea_filed: [],
  patents_imported: ['count'],
  import_history_viewed: [],
  patents_exported: [],
  due_dates_viewed: [],
  due_date_reminded: [],
  due_date_status_changed: [],

  // ---- admin: clients / users / invites (web + api) ----
  client_book_viewed: ['scope'],
  client_onboard_opened: [],
  client_record_opened: [],
  client_created: [],
  client_updated: [],
  client_configured: [],
  client_access_granted: [],
  client_access_revoked: [],
  case_owner_assignments_opened: [],
  case_owner_assignments_saved: [],
  user_role_changed: [],
  user_suspended: [],
  user_reactivated: [],
  invite_dialog_opened: [],
  // One event for "an invite was issued", fired server-side where it is true.
  invite_created: ['count'],
  invite_revoked: [],
  share_link_copied: [],
  share_link_regenerated: [],

  // ---- profile / notifications (web) ----
  profile_viewed: [],
  profile_updated: [],
  notification_pref_changed: ['pref_key', 'enabled'],
  notification_marked_read: [],

  // ---- backend triggers (api) ----
  rejected_signup_pruned: ['count'],
  refresh_token_rotated: [],
  evaluation_cache_on_read: [],
  agent_webhook_received: ['state'],
  reference_backfill_ran: ['prefixes', 'ideas_referenced'],
  report_shape_healed: ['from_version', 'to_version'],

  // ---- patent-agent pipeline (agent) ----
  agent_evaluation_enqueued: [],
  agent_evaluation_started: [],
  agent_stage_completed: ['stage', 'duration_ms', 'candidates', 'cost_cents', 'outcome'],
  agent_budget_cut: ['reason_code', 'stage'],
  agent_retrieval_batched: ['batch_size'],
  agent_evaluation_finished: ['state', 'total_ms', 'cost_cents', 'analysed', 'degraded', 'confidence', 'crowdedness_band', 'obviousness_band', 'evidence_items'],
  agent_evaluation_reaped: [],
  agent_result_expired: ['count'],
  agent_webhook_delivered: ['attempt'],
  agent_webhook_failed: ['attempt'],
  agent_webhook_retried: ['attempt'],
  agent_evaluation_cancelled: [],
} as const;

export type EventName = keyof typeof EVENTS;

const BASE_KEYS: ReadonlySet<string> = new Set([
  'environment', 'surface', 'role', 'view', 'evaluation_id', 'idea_id',
  'patent_id', 'client_id', 'path',
]);

/**
 * Whitelist a payload to the event's declared keys + base keys, and drop anything
 * denylisted (belt). Unknown or denylisted keys are silently dropped — the emitter
 * never sends what the catalogue did not declare. Returns a safe payload.
 */
export function sanitize(event: string, props: Record<string, unknown> = {}): Record<string, unknown> {
  const declared = (EVENTS as Record<string, readonly string[]>)[event];
  const allowed = new Set<string>([...(declared ?? []), ...BASE_KEYS]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    const key = k.toLowerCase();
    if (PROPERTY_DENYLIST.has(key)) continue;
    if (!allowed.has(k)) continue;
    if (v === undefined || v === null) continue;
    out[k] = v;
  }
  return out;
}

/** True when analytics may fire in this environment. */
export function envEnabled(env: string | undefined): env is AnalyticsEnv {
  return !!env && (ANALYTICS_ENV_ALLOWLIST as readonly string[]).includes(env);
}
