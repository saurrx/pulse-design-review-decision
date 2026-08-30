import type { AxiosInstance } from "axios";
import Cookies from "js-cookie";

/**
 * ANTI-CORRUPTION LAYER between the design's screens and the Pulse API.
 *
 * This is a deliberate architectural boundary, not temporary scaffolding. The
 * 152 call sites across 48 files speak the previous backend's dialect —
 * `/api/v1/...` paths and a `{ data, message, pagination }` envelope — and many
 * sit inside 2,000-to-2,600-line components. The new API is clean `/v1/...`
 * with plain payloads.
 *
 * Rewriting every call site would mean changing 152 paths AND ~60 response-shape
 * reads inside those giant components, under a hard constraint that the design
 * must not change. That is the high-risk path. Isolating the two dialects behind
 * one translation table is the low-risk one, and it is the textbook use of an
 * anti-corruption layer: the legacy client and the clean core each keep their
 * own vocabulary, and exactly one file knows both.
 *
 * The boundary is one-directional. NEW code (e.g. real file upload in
 * s3Upload.ts) talks to `/v1` directly via `rawApi` and never passes through
 * here — there is nothing to translate. Only the inherited screens sit behind
 * the adapter.
 *
 * Unmapped routes fail with a named 501 and a console.warn: a silent
 * passthrough would turn every unported screen into a mystery bug, whereas a
 * named failure is a to-do list that writes itself.
 */

type Rule = {
  m: RegExp;
  method?: string;
  to: (match: RegExpMatchArray, body: any) => {
    url: string; method: string; body?: any;
    /** Reshape the new API's payload into what the screen expects. */
    wrap?: (payload: any) => any;
    /**
     * Answer locally, without a request. For old-dialect endpoints whose whole
     * response is derivable from what the caller already sent — the clean API
     * has no equivalent to call, and inventing a round trip to a route that
     * returns the wrong shape is worse than answering honestly here.
     */
    synth?: () => any;
  };
};

/**
 * The share link as the invite screens read it.
 *
 * Both screens render the link, the QR and the Regenerate/Deactivate controls
 * only when `active` is true. The API now says so itself; the fallback keeps
 * this build honest against an API that predates that field, because the
 * failure it caused was invisible — a link was minted and the page went on
 * saying there was none. See pulse-backend docs/qa/findings.md F-044.
 */
const shareLinkView = (p: any) => ({
  ...p,
  token: p?.code,
  link: p?.url,
  invite_link: p?.url,
  active: p?.active ?? (!!p?.code &&
    (!p?.expires_at || new Date(p.expires_at).getTime() > Date.now())),
});

const PHOTON_SENTINEL = "photon-legal";
export const isUuid = (v: unknown) =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
/** Photon roles have no tenant; the design's queries gate on client_id, so
 *  they get the same sentinel the original app used. Real ids pass through. */
const asUser = (p: any) => {
  const u = p?.user ?? {};
  const cid = u.client_id ?? u.clientId ?? null;
  const photon = ["PHOTON_ADMIN", "PHOTON_SUPERADMIN", "CASE_OWNER"].includes(u.role);
  return { data: { user: {
    ...u,
    client_id: cid ?? (photon ? PHOTON_SENTINEL : null),
    // The sidebar renders the workspace mark straight off the session user.
    client: withLogo(u.client),
  } } };
};
const list = (p: any) => ({ data: p?.data ?? p, pagination: p?.pagination });

// -- idea dialect translation ------------------------------------------------
// The design was written against the old API's idea shape: `status` codes like
// IN_DRAFT/UNDER_REVIEW, `created_by_id`, `submission_date`. The clean API
// speaks `state`, `author_id`, `submitted_at`. Every idea that crosses the
// boundary gets BOTH dialects, so no component needs to know which era its
// field names came from.
const STATE_TO_STATUS: Record<string, string> = {
  DRAFT: "IN_DRAFT",
  TECH_REVIEW: "UNDER_REVIEW",
  LEGAL_REVIEW: "SENT_TO_IHC",
  CHANGES_REQUESTED: "UPDATE_REQUEST",
  REJECTED: "REJECT_BY_IHC",
  SENT_TO_PHOTON: "SEND_TO_OC",
  FILED: "FILED",
};
const STATUS_TO_STATE: Record<string, string[]> = {
  IN_DRAFT: ["DRAFT"],
  UNDER_REVIEW: ["TECH_REVIEW"],
  SENT_TO_IHC: ["LEGAL_REVIEW"],
  UPDATE_REQUEST: ["CHANGES_REQUESTED"],
  REJECT_BY_IHC: ["REJECTED"],
  REJECT_BY_OC: ["REJECTED"],
  SEND_TO_OC: ["SENT_TO_PHOTON"],
  FILED: ["FILED"],
};

const oldIdea = (i: any) => i && ({
  ...i,
  status: STATE_TO_STATUS[i.state] ?? i.state,
  created_by_id: i.author_id,
  created_by: i.author,
  summary: i.body,
  submission_date: i.submitted_at ?? i.created_at,
  dateSubmitted: i.submitted_at ?? i.created_at,
  sent_to_ip_committee_at: i.submitted_at,
  createdAt: i.created_at,
  updatedAt: i.updated_at,
  IdeaInventor: (i.inventors ?? []).map((r: any) => ({
    id: r.id, role: r.role, inventor: r.inventor,
  })),
  IdeaPatentLink: i.patent_link ? [i.patent_link] : (i.IdeaPatentLink ?? []),
});

// -- patent dialect translation ---------------------------------------------
// Every PatentStatus the API can emit must appear here, and every value here
// must be one the screens know (src/utils/patentLegalStatus.ts). NONPAYMENT was
// missing: `PSTATUS_TO_LEGAL[r.status] ?? r.status` passed it through raw, so
// 487 production patents arrived carrying "NONPAYMENT" — a value absent from
// PATENT_LEGAL_STATUS_VALUES, so it had no label, no chip colour, and could not
// be selected in the status filter. The screens already had
// INACTIVE_NONPAYMENT defined and waiting.
// qa/contract/status-parity.qa.mjs now fails if either side gains a value the
// other lacks.
const PSTATUS_TO_LEGAL: Record<string, string> = {
  GRANTED: "ACTIVE_GRANTED", APPLIED: "ACTIVE_APPLIED", EXAMINATION: "ACTIVE_EXAMINATION",
  EXPIRED: "INACTIVE_EXPIRED", WITHDRAWN: "INACTIVE_WITHDRAWN",
  REJECTED: "INACTIVE_REJECTED", ABANDONED: "INACTIVE_ABANDONED",
  NONPAYMENT: "INACTIVE_NONPAYMENT",
};
const LEGAL_TO_PSTATUS: Record<string, string> = Object.fromEntries(
  Object.entries(PSTATUS_TO_LEGAL).map(([k, v]) => [v, k]));

/**
 * The workspace mark. The API holds it as a StoredFile; the screens read
 * `logo_file.file_path` and pass it through assetUrl(), so point that at the
 * redirect route an <img> can follow. Bytes stay behind the API's own auth
 * rather than being served from a public bucket URL.
 */
const withLogo = (c: any) => c && ({
  ...c,
  logo_file: c.logo_file?.id
    ? { ...c.logo_file, file_path: `v1/files/${c.logo_file.id}/raw` }
    : c.logo_file ?? null,
});

const oldPatent = (r: any) => r && ({
  ...r,
  legal_current_status: PSTATUS_TO_LEGAL[r.status] ?? r.status,
  publication_country: r.jurisdiction,
  application_date: r.filing_date ?? r.created_at,
  IdeaPatentLink: r.idea_link ? [r.idea_link] : [],
  inventors: (r.idea_link?.idea?.inventors ?? []).map((x: any) =>
    x?.inventor?.name || x?.inventor?.email?.split("@")[0]).filter(Boolean),
});
// -- draft dialect translation ----------------------------------------------
// The design's draft cards read title, completion and score-log fields the
// clean API does not store. Derive them from the questionnaire itself.
const DRAFT_SECTIONS = ["background", "problem", "solution", "novelty", "application"];
const oldDraft = (d: any, idx = 0) => {
  if (!d) return d;
  const a = (d.answers ?? {}) as Record<string, unknown>;
  const stored = (a as any).__meta_data;
  const storedPct = (a as any).__completion;
  const plain = Object.entries(a).filter(([k]) => !k.startsWith("__"));
  const filled = plain.filter(([, v]) =>
    typeof v === "string" ? v.trim().length > 0 : v != null).length;
  return {
    ...d,
    title: d.title ?? d.idea?.title ?? `Draft ${idx + 1}`,
    completion_percentage: d.completion_percentage ?? storedPct ??
      (plain.length ? Math.round((filled / plain.length) * 100) : 0),
    meta_data: d.meta_data ?? stored ?? plain.map(([k, v]) => ({
      id: k,
      title: k.charAt(0).toUpperCase() + k.slice(1),
      questions: [{ id: k, question: k.charAt(0).toUpperCase() + k.slice(1),
        answer: typeof v === "string" ? v : JSON.stringify(v) }],
    })),
    CheckDraftSoreLog: d.CheckDraftSoreLog ??
      (d.score != null ? [{ score: d.score, score_meta_data: d.report ?? null }] : []),
    // The reviewer workspace branch keys off the draft's parent idea.
    idea: d.idea ? {
      ...d.idea,
      status: STATE_TO_STATUS[d.idea.state] ?? d.idea.state,
      clientId: d.idea.client_id,
      created_by_id: d.idea.author_id,
    } : d.idea,
  };
};

const patentList = (p: any) => ({
  data: (Array.isArray(p) ? p : p?.data ?? []).map(oldPatent),
  pagination: p?.pagination,
});

/**
 * fetch-by-user carried search/status/sort/pagination as query params that the
 * old backend applied server-side. The clean /v1/ideas returns the caller's
 * full scope; the old contract is honoured here so the design's search box,
 * status filter and pager keep working unchanged.
 */
const ideaListWrap = (query: string) => (p: any) => {
  const q = new URLSearchParams(query);
  let ideas: any[] = (Array.isArray(p) ? p : p?.data ?? []).map(oldIdea);

  const search = (q.get("search") ?? "").trim().toLowerCase();
  if (search) {
    ideas = ideas.filter(i =>
      `${i.title ?? ""} ${i.summary ?? ""}`.toLowerCase().includes(search));
  }
  const status = (q.get("status") ?? "").split(",").filter(Boolean);
  if (status.length) {
    const states = new Set(status.flatMap(s => STATUS_TO_STATE[s] ?? [s]));
    ideas = ideas.filter(i => states.has(i.state));
  }
  const clientIds = (q.get("filter_client_id") ?? "").split(",").filter(Boolean);
  if (clientIds.length) ideas = ideas.filter(i => clientIds.includes(i.client_id));

  const sort = q.get("sort") ?? "createdAt";
  const order = q.get("order") === "asc" ? 1 : -1;
  const key = sort === "submission_date" ? "submission_date"
    : sort === "updatedAt" ? "updatedAt" : "createdAt";
  ideas.sort((a, b) => order * (new Date(a[key] ?? 0).getTime() - new Date(b[key] ?? 0).getTime()));

  const limit = Math.max(1, Number(q.get("limit")) || 10);
  const page = Math.max(1, Number(q.get("page")) || 1);
  const total = ideas.length;
  return {
    data: ideas.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
};

const RULES: Rule[] = [
  // -- auth -----------------------------------------------------------------
  { m: /^\/api\/v1\/auth\/(?:ihc\/)?login$/, method: "POST",
    to: (_m, b) => ({ url: "/v1/auth/login", method: "POST", body: b, wrap: asUser }) },
  { m: /^\/api\/v1\/auth\/social-login$/, method: "POST",
    to: (_m, b) => ({
      url: "/v1/auth/google", method: "POST",
      body: { access_token: b?.access_token ?? b?.googleAccessToken ?? b?.token },
      wrap: asUser,
    }) },
  { m: /^\/api\/v1\/auth\/email-signup$/, method: "POST",
    to: (_m, b) => ({ url: "/v1/auth/signup", method: "POST",
      body: { email: b?.email, password: b?.password, name: b?.name }, wrap: asUser }) },
  { m: /^\/api\/v1\/auth\/logout$/, method: "POST",
    to: () => ({ url: "/v1/auth/logout", method: "POST" }) },
  { m: /^\/api\/v1\/auth\/forgot-password$/, method: "POST",
    to: (_m, b) => ({ url: "/v1/auth/password-reset/request", method: "POST", body: b }) },
  { m: /^\/api\/v1\/auth\/ihc\/invite-user$/, method: "POST",
    to: (_m, b) => ({ url: "/v1/invites", method: "POST",
      body: { role: b?.role ?? "INVENTOR", emails: b?.email ?? b?.emails } }) },
  { m: /^\/api\/v1\/auth\/change-password$/, method: "POST",
    to: (_m, b) => ({ url: "/v1/auth/change-password", method: "POST",
      body: { current_password: b?.current_password, new_password: b?.new_password } }) },

  // -- ideas ----------------------------------------------------------------
  // State counts for the sidebar badge. Keyed by the OLD status vocabulary the
  // sidebar speaks, so it needs no knowledge of IdeaState.
  { m: /^\/api\/v1\/idea\/counts$/,
    to: () => ({ url: "/v1/ideas/counts", method: "GET",
      wrap: (p: any) => ({ data: Object.fromEntries(
        Object.entries(p ?? {}).map(([state, n]) => [STATE_TO_STATUS[state] ?? state, n]),
      ) }) }) },
  { m: /^\/api\/v1\/idea\/fetch-by-user(?:\?(.*))?$/,
    to: m => ({ url: "/v1/ideas", method: "GET", wrap: ideaListWrap(m[1] ?? "") }) },
  { m: /^\/api\/v1\/idea\/fetch\/([^/]+)$/,
    to: m => ({ url: `/v1/ideas/${m[1]}`, method: "GET",
      wrap: (idea: any) => ({ data: oldIdea(idea) }) }) },
  { m: /^\/api\/v1\/idea\/create$/, method: "POST",
    to: (_m, b) => ({ url: "/v1/ideas", method: "POST",
      body: { title: b?.title, body: b?.description ?? b?.body }, wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/idea\/update-idea\/([^/]+)$/,
    to: (m, b) => ({ url: `/v1/ideas/${m[1]}`, method: "PATCH",
      body: { title: b?.title, body: b?.description ?? b?.body }, wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/idea\/fetch-drafts\/([^/]+)$/,
    to: m => ({ url: `/v1/ideas/${m[1]}/drafts`, method: "GET",
      wrap: (p: any) => ({ data: (Array.isArray(p) ? p : p?.data ?? []).map(oldDraft) }) }) },
  { m: /^\/api\/v1\/idea\/create-new\/draft$/, method: "POST",
    to: (_m, b) => ({ url: `/v1/ideas/${b?.idea_id ?? b?.ideaId}/drafts`, method: "POST",
      body: { answers: b?.answers }, wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/idea\/single-draft\/([^/]+)$/,
    to: m => ({ url: `/v1/drafts/${m[1]}`, method: "GET", wrap: p => ({ data: oldDraft(p) }) }) },
  { m: /^\/api\/v1\/idea\/update\/draft\/([^/]+)$/, method: "POST",
    // The workspace speaks meta_data (sections -> questions -> answers); the
    // clean API stores one answers object. Flatten for storage and keep the
    // full structure under a reserved key so the workspace round-trips.
    to: (m, b) => {
      let body: any = b;
      if (b?.meta_data) {
        const flat: Record<string, unknown> = {};
        for (const s of b.meta_data ?? []) for (const q of s?.questions ?? []) {
          if (q?.id != null) flat[q.id] = q.answer ?? "";
        }
        body = { answers: { ...flat, __meta_data: b.meta_data,
          __completion: b.completion_percentage ?? null } };
      }
      return { url: `/v1/drafts/${m[1]}`, method: "PATCH", body, wrap: p => ({ data: p }) };
    } },
  { m: /^\/api\/v1\/idea\/draft\/([^/]+)$/, method: "DELETE",
    to: m => ({ url: `/v1/drafts/${m[1]}`, method: "DELETE" }) },
  { m: /^\/api\/v1\/idea\/send-to-ihc\/([^/]+)\//, method: "POST",
    to: (m, b) => ({ url: `/v1/drafts/${m[1]}/submit`, method: "POST",
      body: { comment: b?.comment ?? undefined } }) },
  { m: /^\/api\/v1\/idea\/send-latest-draft-to-ihc\/([^/]+)$/, method: "POST",
    to: m => ({ url: `/v1/ideas/${m[1]}/submit`, method: "POST", body: {} }) },
  { m: /^\/api\/v1\/idea\/send-to-oc\/([^/]+)\/oc$/, method: "POST",
    to: m => ({ url: `/v1/drafts/${m[1]}/review`, method: "POST",
      body: { decision: "APPROVED" } }) },
  // The comment is forwarded EXACTLY as the reviewer wrote it — no fallback.
  //
  // These two rules used to substitute "Rejected" and "Changes requested" when
  // the body carried nothing. The backend requires a comment on both decisions
  // (a service guard and a DB CHECK constraint), so the default meant that
  // guard could never fire through the UI, and the append-only transition
  // history recorded words the reviewer never wrote, attributed to them, on the
  // permanent record of someone's rejected disclosure.
  //
  // Now an empty comment reaches the backend empty and is refused there, which
  // is where the rule lives. See pulse-backend/docs/qa/findings.md F-007.
  { m: /^\/api\/v1\/idea\/reject-from-ihc\/([^/]+)$/, method: "POST",
    to: (m, b) => ({ url: `/v1/ideas/${m[1]}/review`, method: "POST",
      body: { decision: "REJECTED", comment: b?.reject_reason ?? b?.reason ?? b?.comment } }) },
  { m: /^\/api\/v1\/idea\/add-update-request\/([^/]+)$/, method: "POST",
    to: (m, b) => ({ url: `/v1/ideas/${m[1]}/review`, method: "POST",
      body: { decision: "CHANGES_REQUESTED", comment: b?.note ?? b?.message ?? b?.comment } }) },

  // -- patents / due dates --------------------------------------------------
  { m: /^\/api\/v1\/patent\/(?:fetch-all-patents\/)?client\/([^/?]+)(\?.*)?$/,
    to: (m) => ({ url: `/v1/patents?${isUuid(m[1]) ? `client_id=${m[1]}` : ""}${(m[2] ?? "").replace("?", "&")
      .replace(/status=([A-Z_]+)/g, (_s: string, v: string) => `status=${LEGAL_TO_PSTATUS[v] ?? v}`)}`,
      method: "GET", wrap: patentList }) },
  { m: /^\/api\/v1\/patent\/distinct-tags\/client\/([^/?]+)/,
    to: m => ({ url: `/v1/patents/tags${isUuid(m[1]) ? `?client_id=${m[1]}` : ""}`, method: "GET", wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/patent\/all-stats\/client/,
    // The world map wants per-country rows in the old shape.
    to: () => ({ url: "/v1/patents/stats", method: "GET", wrap: (p: any) => ({ data:
      (p?.byJurisdiction ?? []).map((r: any) => ({
        publication_country: r.jurisdiction,
        granted_patents: r.granted ?? 0,
        pending_patents: r.pending ?? 0,
        total: r.count,
      })) }) }) },
  // The screen has always sent page/limit and read a pagination envelope; this
  // rule used to drop the query string, so the API returned every row — 13.7k
  // of them after the legacy import, ~7s to render. Pass the paging through and
  // return the envelope the screen already expects.
  //
  // The calendar and export ask for everything with limit=0, which the API caps.
  { m: /^\/api\/v1\/patent\/fetch\/(upcoming-due-dates|all-due-dates)(?:\?(.*))?$/,
    to: m => {
      const q = new URLSearchParams(m[2] ?? "");
      const out = new URLSearchParams();
      const page = q.get("page"); const limit = q.get("limit");
      if (page) out.set("page", page);
      if (limit !== null) out.set("limit", limit);
      if (q.get("filter_client_id")) out.set("client_id", q.get("filter_client_id")!);
      // The screen has always sent a window, a search and a sort; this rule
      // dropped all three, so every control on the deadline page was
      // decoration — the list never changed. See pulse-backend F-047.
      const search = q.get("search"); if (search) out.set("search", search);
      const filter = q.get("filter"); if (filter && filter !== "all") out.set("filter", filter);
      // The screen sorts by deadline or by event name; `sort` names the field
      // and `order` the direction, which is what the API takes.
      const sort = q.get("sort"); if (sort) out.set("sort", sort);
      const order = q.get("order"); if (order) out.set("order", order);
      const qs = out.toString();
      return {
        url: `/v1/due-dates${qs ? `?${qs}` : ""}`, method: "GET",
        wrap: (p: any) => {
          const rows = Array.isArray(p) ? p : p?.data ?? [];
          return {
            data: rows.map((r: any) => ({
              ...r,
              event_date: r.due_at,
              event_name: r.title,
              patent: r.patent
                ? { ...oldPatent(r.patent), assignee_original: r.patent?.client?.name ?? null }
                : r.patent,
            })),
            pagination: p?.pagination ?? {
              total: rows.length, page: 1, limit: rows.length,
              totalPages: 1,
            },
          };
        },
      };
    } },
  { m: /^\/api\/v1\/patent\/fetch\/([^/]+)$/,
    to: m => ({ url: `/v1/patents/${m[1]}`, method: "GET", wrap: p => ({ data: oldPatent(p) }) }) },
  { m: /^\/api\/v1\/patent\/update(?:-single)?\/([^/]+)$/,
    to: (m, b) => ({ url: `/v1/patents/${m[1]}`, method: "PATCH", body: b, wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/patent\/import$/, method: "POST",
    to: (_m, b) => ({ url: "/v1/patents/import", method: "POST", body: b, wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/patent\/client\/([^/]+)$/, method: "POST",
    to: (m, b) => ({ url: "/v1/patents", method: "POST",
      body: { ...b, client_id: m[1] }, wrap: p => ({ data: p }) }) },

  // -- actions ----------------------------------------------------------------
  // The screen sends page/limit and reads a pagination envelope; this used to
  // drop the whole query string, so the API returned every pending deadline and
  // the pager underneath was permanently dead.
  { m: /^\/api\/v1\/actions\/ihc\/client\/([^/?]+)(?:\?(.*))?$/,
    to: m => {
      const q = new URLSearchParams(m[2] ?? "");
      const out = new URLSearchParams();
      if (isUuid(m[1])) out.set("client_id", m[1]);
      if (q.get("page")) out.set("page", q.get("page")!);
      if (q.get("limit")) out.set("limit", q.get("limit")!);
      // The docket search box sends ?search= and this dropped it, so typing
      // filtered nothing and the row count never moved. The backend ignored it
      // too — the box was dead at BOTH layers, which is why it looked like a
      // debounce problem rather than a missing feature.
      //
      // `filter`, `status` and `sort` are still dropped: the API has no
      // equivalent yet, and forwarding a parameter nothing honours would only
      // move the silence one layer down.
      if (q.get("search")) out.set("search", q.get("search")!);
      return ({ url: `/v1/actions?${out.toString()}`, method: "GET",
      // The screen was written against the old event-row dialect
      // (event_name / event_date / days_to_deadline / patent_action) — translate
      // rather than teach the screen a second vocabulary.
      wrap: (p: any) => ({ data: (Array.isArray(p) ? p : p?.data ?? []).map((r: any) => ({
        id: r.due_date_id,
        event_name: r.title,
        event_date: r.due_at,
        days_to_deadline: r.daysRemaining,
        patent: r.patent,
        // action_status and request_status are two real axes now (the client's
        // submission state and Photon's queue position), so both come from the
        // API. This used to hardcode "SUBMITTED", which made UPDATED — a client
        // revising an instruction already in the queue — impossible to render.
        patent_action: r.instruction ? {
          id: r.id,
          // The saved text, verbatim. The template id also rides along, but
          // display must come from THIS field: rendering the template's
          // CURRENT label rewrites history whenever a template is relabeled.
          instruction: r.instruction,
          action_template: r.template_id
            ? { id: r.template_id, label: r.instruction }
            : { id: r.id, label: r.instruction },
          action_status: r.submission_state ?? null,
          request_status: r.status,
          selected_countries: r.selected_countries ?? [],
          version: r.version ?? 1,
          notes: r.note ?? "",
          submitted_at: r.requested_at,
        } : null,
        action_request_id: r.id,
      })), pagination: p?.pagination }) });
    } },
  // Photon moving an action along its queue. This previously mapped onto the
  // instruction PATCH, so changing a status rewrote the instruction text.
  { m: /^\/api\/v1\/actions\/request-status$/, method: "PUT",
    // OCActionsContent has always sent `patent_action_id`; reading only
    // id/action_id produced PATCH /v1/actions/undefined/... -> 404 'Action
    // not found' on every status change.
    to: (_m, b) => ({ url: `/v1/actions/${b?.patent_action_id ?? b?.id ?? b?.action_id}/request-status`, method: "PATCH",
      body: { status: b?.request_status ?? b?.status }, wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/actions\/submit-all$/, method: "POST",
    to: () => ({ url: "/v1/actions/submit-all", method: "POST", wrap: p => ({ data: p }) }) },
  // The Photon queue was passing the clean shape through untranslated, so the
  // screen read patent.application_number off an object that is nested under
  // due_date. It never showed because the queue was empty until real actions
  // existed — the row map simply never ran.
  { m: /^\/api\/v1\/actions\/oc\/queue(?:\?(.*))?$/,
    to: m => {
      const q = new URLSearchParams(m[1] ?? "");
      const out = new URLSearchParams();
      if (q.get("page")) out.set("page", q.get("page")!);
      if (q.get("limit")) out.set("limit", q.get("limit")!);
      const qs = out.toString();
      return ({ url: `/v1/actions/queue${qs ? `?${qs}` : ""}`, method: "GET",
      wrap: (rows: any[]) => ({ data: (rows ?? []).map(r => ({
        id: r.id,
        action_status: r.submission_state ?? null,
        request_status: r.status,
        selected_countries: r.selected_countries ?? [],
        notes: r.note ?? "",
        submitted_at: r.requested_at,
        days_to_deadline: r.due_date?.due_at
          ? Math.ceil((new Date(r.due_date.due_at).getTime() - Date.now()) / 86400000)
          : null,
        patent: {
          id: r.due_date?.patent?.id ?? "",
          application_number: r.due_date?.patent?.application_number ?? "",
          title: r.due_date?.patent?.title ?? "",
        },
        patent_event: {
          id: r.due_date?.id ?? "",
          event_name: r.due_date?.title ?? r.due_date?.event_type ?? "",
          event_date: r.due_date?.due_at ?? null,
        },
        action_template: {
          id: r.template?.id ?? r.template_id ?? r.id,
          label: r.template?.label ?? r.instruction ?? "",
          category: r.template?.category ?? "",
        },
        submitted_by: null,
        client_id: r.client_id,
        // The screen groups the queue by client and reads client.name.
        client: { id: r.client?.id ?? r.client_id, name: r.client?.name ?? "" },
      })) }) });
    } },
  // 94% of real deadline names contain a slash ("3 1/2 Year Maintenance Fee
  // Due"), so the event type travels as a query parameter — in a path segment
  // it splits the route and 404s.
  { m: /^\/api\/v1\/actions\/templates\/event\/(.+)$/,
    to: m => ({
      url: `/v1/actions/templates?event_type=${encodeURIComponent(decodeURIComponent(m[1]))}`,
      method: "GET", wrap: p => ({ data: p }),
    }) },

  // -- clients / workspace -----------------------------------------------------
  { m: /^\/api\/v1\/clients$/, method: "POST",
    // Onboarding: create the workspace, then the admins are invited server-side.
    to: (_m, b) => ({ url: "/v1/clients", method: "POST",
      body: { name: b?.name, domain: String(b?.allowed_domain ?? "").replace(/^@/, "") || undefined,
        admin_emails: (b?.admin_users ?? []).filter(Boolean) },
      wrap: p => ({ data: p }) }) },
  // The clients screen filters by name; the rule used to drop the query string,
  // so every keystroke re-fetched all 82 workspaces and nothing narrowed.
  { m: /^\/api\/v1\/clients(?:\?(.*))?$/, method: "GET",
    to: m => {
      const q = new URLSearchParams(m[1] ?? "");
      const page = Math.max(1, Number(q.get("page")) || 1);
      const limit = Math.max(1, Number(q.get("limit")) || 0);
      const search = (q.get("search") ?? "").trim().toLowerCase();
      return {
        // The API returns the caller's whole client list as an ARRAY, with no
        // pagination envelope — which is why the clients page's fully-built
        // pagination bar never rendered (its guard reads pagination.total).
        // Slice here: 82 rows is nothing over the wire, and every other
        // consumer of this rule still gets the plain array when it asks for
        // no page.
        url: "/v1/clients", method: "GET",
        wrap: (p: any) => {
          if (!Array.isArray(p)) return { data: withLogo(p) };
          let rows = p.map(withLogo);
          if (search) rows = rows.filter((c: any) =>
            String(c?.name ?? "").toLowerCase().includes(search) ||
            String(c?.domain ?? "").toLowerCase().includes(search));
          if (!limit) return { data: rows };
          const total = rows.length;
          const start = (page - 1) * limit;
          return { data: rows.slice(start, start + limit),
            pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
        },
      };
    } },
  // The Patents table. This hardcoded limit=5 and dropped the query string, so
  // the screen showed five of 14,260 patents — unsearched, unfiltered and
  // unsorted — while its own pager reported the real total. The name says
  // "latest" but this is the only caller, and it is the full table.
  { m: /^\/api\/v1\/patent\/fetch-lastet\/client\/([^/?]+)(?:\?(.*))?$/,
    to: m => {
      const q = new URLSearchParams(m[2] ?? "");
      const out = new URLSearchParams();
      // filter_client_id (the photon-side client picker) wins over the path id,
      // which is the caller's own workspace.
      const explicit = q.get("filter_client_id");
      const cid = explicit && isUuid(explicit) ? explicit : (isUuid(m[1]) ? m[1] : null);
      if (cid) out.set("client_id", cid);
      if (q.get("page")) out.set("page", q.get("page")!);
      if (q.get("limit")) out.set("limit", q.get("limit")!);
      if (q.get("search")) out.set("search", q.get("search")!);
      // The screen sends a CSV of legal statuses; the API takes one PatentStatus.
      const status = (q.get("filter_status") ?? "").split(",").filter(Boolean)[0];
      if (status) out.set("status", LEGAL_TO_PSTATUS[status] ?? status);
      if (q.get("tag")) out.set("tag", q.get("tag")!);
      const qs = out.toString();
      return { url: `/v1/patents${qs ? `?${qs}` : ""}`, method: "GET", wrap: patentList };
    } },
  { m: /^\/api\/v1\/clients\/lookup/, to: () => ({ url: "/v1/clients", method: "GET", wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/case-owners$/, to: () => ({ url: "/v1/case-owners", method: "GET", wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/case-owners\/([^/]+)\/assignments$/, method: "PUT",
    to: (m, b) => ({ url: `/v1/case-owners/${m[1]}/assignments`, method: "PUT",
      // The screen speaks camelCase; the API validates snake_case and rejects
      // unknown keys — translate rather than loosen the validator.
      body: {
        client_ids: b?.client_ids ?? b?.clientIds ?? [],
        ...(b?.kind ? { kind: b.kind } : {}),
        ...(b?.reason ? { reason: b.reason } : {}),
        ...(b?.expires_at ?? b?.expiresAt ? { expires_at: b?.expires_at ?? b?.expiresAt } : {}),
      },
      wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/clients\/fetch-all-inventors\/([^/?]+)/,
    // The co-inventor picker needs a minimal roster, not the admin member list.
    to: m => ({ url: `/v1/ideas/colleagues?client_id=${m[1]}`, method: "GET", wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/idea\/add\/inventor\/([^/]+)\/([^/]+)$/, method: "POST",
    to: m => ({ url: `/v1/ideas/${m[1]}/inventors/${m[2]}`, method: "POST", wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/idea\/remove\/inventor\/([^/]+)$/, method: "DELETE",
    // The old path carries the IdeaInventor CREDIT id, not the user id — the
    // clean API has a credit-addressed route for exactly this shape.
    to: m => ({ url: `/v1/ideas/inventor-credits/${m[1]}`, method: "DELETE",
      wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/clients\/([0-9a-f-]{36})$/,
    to: m => ({ url: `/v1/clients/${m[1]}`, method: "GET", wrap: (c: any) => ({ data: {
      ...withLogo(c),
      // The screen speaks the old field names; translate rather than teach it
      // new ones. The value is the DOMAIN — this used to hand back a fabricated
      // "x@" local part, so the edit field showed "x@acme.com" as though a
      // mailbox called x were the client's setting, and the reader could not
      // tell the invention from the data. The writer strips a local part
      // either way, so a bare domain round-trips.
      allowed_domain: c?.domain ?? "",
      about: c?.about ?? "",
      plan: c?.plan ?? "STANDARD",
      logo: c?.logo ?? null,
      logo_file: c?.logo_file ?? null,
      // Old dialect: members ride as `User` with active/verified booleans.
      User: (c?.users ?? []).map((u: any) => ({
        ...u, active: u.status === "ACTIVE", verified: u.status === "ACTIVE",
        suspended: u.status === "SUSPENDED",
      })),
    } }) }) },
  { m: /^\/api\/v1\/clients\/([^/]+)\/invite-user$/, method: "POST",
    to: (m, b) => ({ url: "/v1/invites", method: "POST",
      body: { role: b?.role ?? "INVENTOR", emails: b?.email ?? b?.emails, client_id: m[1] },
      wrap: p => ({ data: p }) }) },

  // -- misc ---------------------------------------------------------------------
  { m: /^\/api\/v1\/dashboard/, to: () => ({ url: "/v1/dashboard", method: "GET",
    wrap: (p: any) => ({ data: {
      ...p,
      // Old dialect: flat counters. Granted comes from PATENTS (D5) — an idea
      // never carries it; the link makes it a dashboard number.
      granted_patents: p?.patents?.granted ?? 0,
      pending_patents: (p?.patents?.applied ?? 0) + (p?.patents?.examination ?? 0),
      inactive_patents: p?.patents?.inactive ?? 0,
      total_patents: p?.patents?.total ?? 0,
    } }) }) },
  // -- idea lifecycle actions ----------------------------------------------
  { m: /^\/api\/v1\/idea\/remove\/([^/]+)$/, method: "DELETE",
    to: m => ({ url: `/v1/ideas/${m[1]}`, method: "DELETE", wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/idea\/clone\/([^/]+)$/, method: "POST",
    to: m => ({ url: `/v1/ideas/${m[1]}/clone`, method: "POST", wrap: p => ({ data: oldIdea(p) }) }) },
  { m: /^\/api\/v1\/idea\/clone-draft\/([^/]+)$/, method: "POST",
    to: m => ({ url: `/v1/ideas/${m[1]}/clone`, method: "POST", wrap: p => ({ data: oldIdea(p) }) }) },
  // The update-request views are the CHANGES_REQUESTED slice of the history.
  { m: /^\/api\/v1\/idea\/fetch-update-requests\/([^/]+)$/,
    to: m => ({ url: `/v1/ideas/${m[1]}/transitions`, method: "GET", wrap: (ts: any[]) => ({ data: (ts ?? [])
      .filter((t: any) => t.decision === "CHANGES_REQUESTED")
      .map((t: any) => ({ id: t.id, message: t.comment, comment: t.comment,
        created_at: t.created_at, createdAt: t.created_at,
        requested_by: t.actor, User: t.actor, status: "PENDING" })) }) }) },
  { m: /^\/api\/v1\/idea\/fetch-recent-update-request\/([^/]+)$/,
    to: m => ({ url: `/v1/ideas/${m[1]}/transitions`, method: "GET", wrap: (ts: any[]) => {
      const t = (ts ?? []).find((x: any) => x.decision === "CHANGES_REQUESTED");
      return { data: t ? { id: t.id, message: t.comment, comment: t.comment,
        created_at: t.created_at, requested_by: t.actor, User: t.actor } : null };
    } }) },
  { m: /^\/api\/v1\/idea\/([^/]+)\/oc-workflow-status$/,
    to: m => ({ url: `/v1/ideas/${m[1]}`, method: "GET",
      wrap: (i: any) => ({ data: { status: oldIdea(i)?.status, state: i?.state } }) }) },

  // -- scoring (agent behind the API; 503 when not configured) --------------
  // NO method lock. All three call sites — DraftWorkspace, DraftCreationContent
  // and IdeaDetailsContent — issue a GET, and so does the design reference
  // (`route("GET", "/api/v1/idea/check-score/:draftId")`). GET is simply this
  // dialect's verb for "start scoring"; translating it to the POST the clean
  // API wants is precisely this file's job.
  //
  // Locked to POST, the GET matched no rule and the adapter returned a
  // synthetic 501 with no network traffic at all. That broke scoring from every
  // entry point, and for an inventor it broke submission itself: "Send for
  // review" renders only once `scored` is true, and an IN_DRAFT idea renders
  // DraftWorkspace rather than DraftListView, so the other submit button was
  // unreachable. A 100%-complete disclosure had no way out of DRAFT.
  // Filing: one call, one transaction on the API side (patent + link +
  // transition + state). The screen has always posted this path; until
  // POST /v1/ideas/:ideaId/file existed there was nothing to map it to, so
  // clicking "Filed" produced a 501 and nothing else.
  { m: /^\/api\/v1\/idea\/([^/]+)\/file$/, method: "POST",
    to: (m, b) => ({ url: `/v1/ideas/${m[1]}/file`, method: "POST", body: b,
      wrap: p => ({ data: p }) }) },

  { m: /^\/api\/v1\/idea\/check-score\/([^/]+)$/,
    to: m => ({ url: `/v1/drafts/${m[1]}/evaluate`, method: "POST", wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/idea\/fetch-score\/([^/]+)$/,
    // score_meta_data mirrors the list wrap (report under the old name) so the
    // workspace and the reviewer read the same field; status/state pass
    // through so a REOPENED tab can tell "still running" from "never ran" —
    // the pre-F-029 UI kept that in component state and lost it on unmount.
    to: m => ({ url: `/v1/drafts/${m[1]}/evaluation`, method: "GET",
      wrap: p => ({ data: { ...p, score_meta_data: p?.report ?? null } }) }) },
  /**
   * The early patentability read, answered locally.
   *
   * This pointed at /v1/drafts/:id/evaluation, which returns the AGENT's
   * evaluation — state, score, report — and carries no `band`,
   * `sections_with_content` or `total_sections`. All three read undefined, so
   * the card rendered the literal text "based on of sections" under a blank
   * heading, on every draft, at every completion level.
   *
   * The old contract took the count from the CALLER (`?sections=N`) and
   * returned a band over six sections — DraftWorkspace's five questionnaire
   * sections plus attachments, which is exactly what it still sends. So the
   * whole response is derivable here and needs no request at all; the previous
   * mapping was a network round trip that could only ever return the wrong
   * shape.
   *
   * Thresholds are the original contract's, not invented.
   */
  // Was answered locally from the section COUNT alone; now the backend reads
  // the actual content (OpenRouter behind it, heuristic when unconfigured) —
  // so the rail can tell a genuine disclosure from spam and say something
  // worth reading. The old ?sections= is ignored: the server counts for
  // itself from the autosaved answers.
  { m: /^\/api\/v1\/idea\/preliminary-signal\/([^/?]+)(?:\?(.*))?$/,
    to: m => ({ url: `/v1/drafts/${m[1]}/signal`, method: "GET", wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/idea\/re-evaluate\/([^/]+)$/, method: "POST",
    to: m => ({ url: `/v1/drafts/${m[1]}/re-evaluate`, method: "POST", wrap: p => ({ data: p }) }) },

  // -- people management ----------------------------------------------------
  { m: /^\/api\/v1\/users\/([^/]+)$/, method: "DELETE",
    to: m => ({ url: `/v1/users/${m[1]}`, method: "DELETE", wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/auth\/update-profile\/([^/]+)$/,
    to: (m, b) => ({ url: `/v1/users/${m[1]}`, method: "PATCH", body: b, wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/auth\/user\/([^/]+)$/,
    to: () => ({ url: "/v1/auth/me", method: "GET", wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/case-owners\/invite$/, method: "POST",
    to: (_m, b) => ({ url: "/v1/invites", method: "POST",
      body: { role: "CASE_OWNER", emails: b?.email ?? b?.emails }, wrap: p => ({ data: p }) }) },

  // -- shareable invite links ----------------------------------------------
  // The wrap exposes BOTH identities on purpose: `token` is the short CODE
  // (what the /i/:code URL and the QR encode), `id` is what DELETE revokes.
  // The old shape conflated them, so Deactivate sent the code where the API
  // wanted the id and died with 'Invite not found'.
  { m: /^\/api\/v1\/clients\/([^/]+)\/invite-link\/([^/]+)$/, method: "DELETE",
    to: m => ({ url: `/v1/invites/${m[2]}`, method: "DELETE", wrap: p => ({ data: p }) }) },
  // Regenerate. This rule was method-unlocked and forced GET, so every
  // "Generate link" click was silently downgraded to a read of the existing
  // link: the toast said generated, nothing was, and the old URL kept working.
  { m: /^\/api\/v1\/clients\/([^/]+)\/invite-link/, method: "POST",
    to: m => ({
      url: `/v1/invites/share-link/regenerate${isUuid(m[1]) ? `?client_id=${m[1]}` : ""}`, method: "POST",
      wrap: (p: any) => ({ data: shareLinkView(p) }),
    }) },
  // Photon roles carry the "photon-legal" sentinel as their client_id; sending
  // it as a real client reference 400s. isUuid drops it, and the API then falls
  // back to the caller's own workspace — the same guard every other
  // client-scoped rule here already applies.
  { m: /^\/api\/v1\/clients\/([^/]+)\/invite-link/, method: "GET",
    to: m => ({
      url: `/v1/invites/share-link${isUuid(m[1]) ? `?client_id=${m[1]}` : ""}`, method: "GET",
      wrap: (p: any) => ({ data: shareLinkView(p) }),
    }) },

  { m: /^\/api\/v1\/clients\/([^/]+)\/request-access$/, method: "POST",
    to: m => ({ url: `/v1/clients/${m[1]}/request-access`, method: "POST", wrap: p => ({ data: p }) }) },

  { m: /^\/api\/v1\/clients\/([^/]+)\/import-history$/,
    to: m => ({ url: `/v1/patents/import-history?client_id=${m[1]}`, method: "GET", wrap: p => ({ data: p }) }) },

  // -- client detail extras -------------------------------------------------
  // Old dialect: allowed_domain (with a leading @, sometimes a full email —
  // the edit screen's field has taught both), admin_users (no backend concept;
  // members are managed through invites), logo (a file id). Translate; the
  // create path at /clients already strips the @ the same way.
  { m: /^\/api\/v1\/clients\/personal-info\/([^/]+)$/,
    to: (m, b) => {
      const body: any = {};
      if (b?.name !== undefined) body.name = b.name;
      if (b?.about !== undefined) body.about = b.about;
      if (b?.logo !== undefined) body.logo_file_id = b.logo;
      if (b?.allowed_domain !== undefined) {
        const raw = String(b.allowed_domain).trim();
        // "x@6sense.com" and "@6sense.com" both mean the 6sense.com domain.
        body.domain = raw.includes("@") ? raw.slice(raw.lastIndexOf("@") + 1) : raw;
      }
      return { url: `/v1/clients/${m[1]}`, method: "PATCH", body, wrap: p => ({ data: p }) };
    } },
  { m: /^\/api\/v1\/clients\/patent-metrics\/([^/]+)/,
    to: m => ({ url: `/v1/patents/stats${isUuid(m[1]) ? `?client_id=${m[1]}` : ""}`, method: "GET",
      wrap: (p: any) => ({ data: {
        ...p,
        total_patents: p?.total ?? 0,
        granted_patents: p?.granted ?? 0,
        pending_patents: (p?.applied ?? 0) + (p?.examination ?? 0),
        inactive_patents: p?.inactive ?? 0,
      } }) }) },

  // -- files ----------------------------------------------------------------
  { m: /^\/api\/v1\/idea\/remove-idea-file\/([^/]+)$/, method: "DELETE",
    to: m => ({ url: `/v1/files/${m[1]}`, method: "DELETE", wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/patent\/delete-doc\/([^/]+)$/, method: "DELETE",
    to: m => ({ url: `/v1/files/${m[1]}`, method: "DELETE", wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/remove-file\/([^/]+)$/, method: "DELETE",
    to: m => ({ url: `/v1/files/${m[1]}`, method: "DELETE", wrap: p => ({ data: p }) }) },

  // The design gives the idea-reference prefix its own endpoint; the API keeps
  // it with the rest of the client configuration. Call sites read
  // data.data.idea_reference_prefix back, so the wrap must surface it.
  { m: /^\/api\/v1\/clients\/([^/?]+)\/reference-settings$/, method: "PUT",
    to: (m, b) => ({ url: `/v1/clients/${m[1]}`, method: "PATCH",
      body: { idea_reference_prefix: b?.prefix },
      wrap: (c: any) => ({ data: { idea_reference_prefix: c?.idea_reference_prefix } }) }) },

  // -- patents extras -------------------------------------------------------
  { m: /^\/api\/v1\/patent\/export\/client\/([^/?]+)(\?.*)?$/,
    to: m => ({ url: `/v1/patents/export${isUuid(m[1]) ? `?client_id=${m[1]}` : ""}`, method: "GET", wrap: p => ({ data: p }) }) },
  { m: /^\/api\/v1\/patent\/events\/([^/]+)\/remind$/, method: "POST",
    to: m => ({ url: `/v1/due-dates/${m[1]}/remind`, method: "POST", wrap: p => ({ data: p }) }) },
  // A "patent event" in the design is a docket due date here. The design says
  // OPEN for the un-ticked state; the API calls it PENDING and translates.
  { m: /^\/api\/v1\/patent\/events\/([^/]+)$/, method: "PATCH",
    to: (m, b) => ({ url: `/v1/due-dates/${m[1]}`, method: "PATCH",
      body: { status: b?.status }, wrap: p => ({ data: p }) }) },

  // A "removed" client is deactivated, never deleted — its portfolio and
  // review history must survive (the schema restricts hard deletes anyway).
  { m: /^\/api\/v1\/clients\/remove\/([^/]+)$/, method: "DELETE",
    to: m => ({ url: `/v1/clients/${m[1]}`, method: "PATCH",
      body: { is_active: false }, wrap: p => ({ data: p }) }) },

  // -- view as client -------------------------------------------------------
  { m: /^\/api\/v1\/auth\/login-as-client\/([^/]+)$/, method: "POST",
    to: m => ({ url: `/v1/auth/view-as/${m[1]}`, method: "POST", wrap: asUser }) },
  { m: /^\/api\/v1\/auth\/exit-client-view$/, method: "POST",
    to: () => ({ url: "/v1/auth/view-as/exit", method: "POST", wrap: asUser }) },

  // -- password / signup completion -----------------------------------------
  { m: /^\/api\/v1\/auth\/reset-password$/, method: "POST",
    to: (_m, b) => ({ url: "/v1/auth/password-reset/complete", method: "POST",
      body: { token: b?.token, password: b?.password ?? b?.new_password } }) },
  { m: /^\/api\/v1\/auth\/(?:complete-signup|ihc\/set-password)$/, method: "POST",
    to: (_m, b) => ({ url: "/v1/auth/password-reset/complete", method: "POST",
      body: { token: b?.token, password: b?.password ?? b?.new_password } }) },
  { m: /^\/api\/v1\/auth\/ihc\/verify(?:\?(.*))?$/, method: "POST",
    // The page carries the code in the QUERY; the accepter's email in the body.
    to: (m, b) => {
      const code = new URLSearchParams(m[1] ?? "").get("code") ?? b?.code ?? "";
      return { url: "/v1/auth/invite/verify-share", method: "POST",
        body: { code, email: b?.email }, wrap: p => ({ data: p }) };
    } },

];

export function makeRealAdapter(real: AxiosInstance) {
  const dispatch = async (method: string, url: string, body?: any) => {
    const path = url.split("#")[0];
    for (const r of RULES) {
      if (r.method && r.method !== method) continue;
      const match = path.match(r.m);
      if (!match) continue;
      const t = r.to(match, body);
      if (t.synth) return { status: 200, data: t.synth() };
      const res = await real.request({ url: t.url, method: t.method as any, data: t.body });
      // The old envelope, so 152 call sites reading response.data.data keep
      // working. Sessions: the new API authenticates with HttpOnly cookies;
      // the readable pl_user cookie is display state, refreshed on login here.
      const payload = t.wrap ? t.wrap(res.data) : { data: res.data };
      if (t.url === "/v1/auth/login" || t.url === "/v1/auth/google" || t.url === "/v1/auth/signup") {
        const u = (payload as any)?.data?.user ?? (payload as any)?.user;
        if (u) Cookies.set("pl_user", JSON.stringify({ ...u, client_id: u.clientId ?? u.client_id }),
                           { sameSite: "lax", path: "/" });
      }
      return { status: res.status, data: payload };
    }
    console.warn(`[realAdapter] UNMAPPED ${method} ${path} — returning 501`);
    const err: any = new Error(`Not yet wired to the real API: ${method} ${path}`);
    err.response = { status: 501, data: { message: err.message } };
    throw err;
  };

  return {
    get: (u: string, _c?: any) => dispatch("GET", u),
    delete: (u: string, _c?: any) => dispatch("DELETE", u),
    post: (u: string, b?: any, _c?: any) => dispatch("POST", u, b),
    put: (u: string, b?: any, _c?: any) => dispatch("PUT", u, b),
    patch: (u: string, b?: any, _c?: any) => dispatch("PATCH", u, b),
    interceptors: real.interceptors,
    defaults: real.defaults,
  };
}
