# Pulse backend — complete agent context

Read this file fully before changing anything. It is the condensed session
knowledge of the engineers who built and deployed this system; it exists so an
agent needs no other briefing.

## 1. What Pulse is (product context)

IP-lifecycle management for Photon Legal (an IP law firm) and its client
companies. Clients' engineers ("inventors") file invention disclosures; the
client's internal reviewers vet them; approved ideas go to Photon Legal for
patent filing; the platform then tracks the patent portfolio, deadlines and
actions. Five PRDs drive the product:

1. **Auth** — outsiders can't get in; Client A never sees Client B; a Photon
[line removed by the design-repo sync: operational credential or account reference]
   and SAML/Okta — the last three all land on ONE provisioning policy,
   `AuthService.loginWithProvider`, so an identity provider proves who someone
   is and the domain gate decides whether they get an account. The IdP config is
   global, so per-CLIENT SSO is still not built. Signup is DOMAIN-GATED: self-signup
   works only for an email whose domain matches an onboarded client; rejects
   are stored in `RejectedSignup`.
2. **Onboarding** — admins invited by Case Owners/other admins; inventors via
   bulk email lists or a SHAREABLE short link + QR (wildcard invite, domain
   gated, multi-use). Activation emails specced but the MAILER IS NOT BUILT —
   invite links are returned in API responses for copy-paste.
3. **Submission** — one required field (title) to start; questionnaire
   (background/problem/solution/novelty/application) IS the submission; AI
   scoring runs against real prior art; post-submit timeline so the inventor
   "never wonders if the idea fell into a void".
4. **Admin workspace** — reviewer screens optimized to clear the queue:
   pipeline (Submitted → Review Pending → Sent to Photon → Filed → Granted),
   oldest-first queue, one-click decisions.
5. **Trademark module — NOT BUILT** (whole PRD pending).

### The review chain (locked product decisions — do not re-litigate)
- Stages: inventor submits → TECH_REVIEW (only if client.has_tech_committee)
  → LEGAL_REVIEW → SENT_TO_PHOTON → FILED. GRANTED is NOT an idea state — it
  lives on Patent.status, reached via IdeaPatentLink (decision "D5"; two
  sources of truth for granted is drift).
- ANY change/resubmission restarts the chain at the top and bumps `revision`.
- Tech rejection is terminal for that revision; APPEAL = resubmission from
  REJECTED with a REQUIRED comment; no cap on appeals.
- A reviewer's stage is DERIVED from the idea's state server-side — the caller
  can never assert which stage they act at.
- Submit REQUIRES a questionnaire with substance (≥1 non-empty answer):
  reviewers decide on the draft, not the title.
- INVENTORSHIP: only client-side INVENTOR identities may author ideas. Photon
  staff (any role, incl. superadmin, incl. inside view-as) are refused —
  conception belongs to a person at the client (USPTO human-conception rule).
  Patent RECORDS (prosecution data) are the opposite: Photon-entered, per
  assignment — that's firm work-product, not an inventorship claim.

### Roles
Client side: INVENTOR, TECH_COMMITTEE (optional per client), LEGAL_COUNSEL
(= the workspace admin; there is no separate admin role). Photon side:
CASE_OWNER (sees only assigned clients), PHOTON_ADMIN (all clients, grants
access), PHOTON_SUPERADMIN (everything; founders tier). A client has many case
owners and a case owner many clients (via `client_access`).

## 2. Architecture

NestJS 11, single AppModule (no feature modules — everything registered in
`src/app.module.ts`), all routes under `/v1`. Prisma 6 + Postgres.

Request lifecycle: `JwtAuthGuard` (cookie `pulse_at`, HS256, alg pinned, 15min)
→ `CapabilitiesGuard` (`@RequireCaps`, any-of semantics) →
`ClientIsolationGuard` (audit-logs photon cross-tenant access) → handler

`ClientIsolationGuard` reads the target client from **params, body AND query**.
The query string is not optional: 15 routes take the tenant as `?client_id=`
(patents list/stats/tags/export, due-dates, ideas counts/colleagues/pipeline,
actions list/queue/submit-all, clients list, invites, dashboard). While it read
only params and body, all of those skipped both the 403 and the
PHOTON_ADMIN_ACCESS audit entry, leaving RLS alone — and RLS returns an empty
list, which reads as "no data" rather than "not yours" and logs nothing. Only a
uuid counts as a target, because the frontend labels Photon staff with a
`photon-legal` sentinel. Covered by client-isolation.guard.spec.ts, which runs
every case through all three carriers.
→ `PrismaService.withContext()` → RLS-fenced queries → `EntitlementFilter`
maps DB denials and Prisma codes to honest HTTP.

### 2.1 Authorization = capabilities (src/common/policy.ts)
The single source of authorization truth. Const-asserted `CAPABILITIES` tuple;
`GRANTS: Record<UserRole, Capability[]>`; `can(role, cap)`. Role NAMES never
appear in business logic — handlers say `@RequireCaps('idea:review:legal')`,
not "if counsel". Grants summary:
- INVENTOR: idea:create, idea:read:own, idea:submit, asset:read,
  user:read:colleagues, idea:inventors:manage
- TECH_COMMITTEE: idea:read:client/own, idea:review:technical, asset:read
- LEGAL_COUNSEL: idea:read:client/own, idea:review:legal, client:configure,
  user:invite, user:read:client, user:manage, asset:read/write, audit:read
- CASE_OWNER: idea:read:client, idea:file, client:read:assigned, user:invite,
  user:read:client, user:read:colleagues, asset:read/write
- PHOTON_ADMIN: idea:read:any, idea:file, client:read:any/create/configure,
  access:grant(+any), user:invite/manage/read, asset:read/write, audit:read,
  user:read:colleagues
- PHOTON_SUPERADMIN: [...CAPABILITIES] — everything, which is WHY explicit
  guards exist where capability alone is wrong (inventorship guard in
  ideas.create).
`policy.spec.ts` iterates Object.values(UserRole) exhaustively — extend it
with every new capability. `roles.ts#canInvite` is the invite privilege matrix
(no privilege escalation: counsel can't invite photon roles, etc.).

### 2.2 Tenancy = RLS enforced twice (src/common/prisma.service.ts + prisma/sql/rls.sql)
`withContext({userId, role, clientId}, fn)` wraps EVERY handler body in a
transaction and calls `app_begin_request(user_id, client_id)` — a SECURITY
DEFINER function that VALIDATES entitlement BEFORE setting context: it re-reads
the role from app_user (a stale JWT can't widen DB access) and checks
`client_access` liveness (revoked_at null AND expires_at future) for photon
roles. Not entitled → raises SQLSTATE 42501 → `EntitlementFilter` → clean 403.
Policies then fence rows via `app_can_access_client(client_id)`;
child tables (idea_draft, idea_transition, idea_inventor…) derive tenancy
through their parent. Notifications are person-fenced (user_id = app_user_id()).
- IMPORTANT: withContext IS the transaction — `db.$transaction` inside throws.
  Sequential writes inside it are atomic anyway.
- `unscoped(reason)` is the deliberate bypass on a SECOND connection
  (DATABASE_URL_ADMIN): reason is a CLOSED union ('login-lookup',
[line removed by the design-repo sync: operational credential or account reference]
  'audit-write', 'notify-write', 'admin-write', 'session-refresh', 'seed').
  Add a reason to the union rather than reusing a wrong one — the union is an
  audit surface.
- RLS fences CLIENTS; services additionally fence PERSONS via private
  `scopeFor(user)`: inventors see only ideas they authored OR are credited on
  (idea_inventor), and only patents linked (idea→IdeaPatentLink) to those
  ideas. Drafts inherit idea scope. Reviewers/photon get {} (client-wide,
  RLS-fenced).
- Photon callers are entitled to MANY clients, so RLS alone does not narrow
  their reads: services accept explicit `client_id` and add it to `where`.
- rls.sql is idempotent ONLY if the up-front DROP POLICY block names every
  policy — this has broken repeatedly when adding policies. Also DB-level
  invariants live there because Prisma can't express them: role↔client_id
  CHECK on app_user, deferred "every active client keeps a LEGAL_COUNSEL"
  trigger, partial uniques client_access_live_unique / invite_live_unique,
  client_access_expiry_future CHECK, comment-required CHECK on transitions.

### 2.3 Auth internals (src/auth/)
- argon2id (m=19456,t=2); constant-time dummy-hash on unknown email; identical
[line removed by the design-repo sync: operational credential or account reference]
  the account exists.
- Tokens: access JWT {sub, role, cid, email, view?} 15min in HttpOnly
  `pulse_at`; refresh = opaque token, SHA-256 hash stored in Session, rotated
[line removed by the design-repo sync: operational credential or account reference]
- Throttles: login/signup 5/5min; social 20/5min; reset 5/15min; invite-accept
  and verify 10/5min; global 100/min. **Testing gotcha: multi-login test runs
  hit the login throttle — restart the API (in-memory) between runs.**
- Google: verifies email_verified. Microsoft: tenant MUST be pinned
  (MICROSOFT_TENANT_ID; 'common' is refused), issuer + tid verified — without
  this, any Azure tenant could mint a token with a victim's unverified email
  (account takeover via email-keyed linking).
- Invites: per-email (bulk, skips dupes without failing the batch) AND
  wildcard share-links (email='*', code is the shareable identity, accept by
  CODE + accepter's email, domain-gated, multi-use, never consumed, creates
[line removed by the design-repo sync: operational credential or account reference]
  A share link is returned through ONE view (`shareLinkView`) carrying
  `active` — the invite screens gate the whole link/QR/regenerate block on it,
  and omitting it made a freshly minted link invisible (F-044). 14-day TTL, so
  never describe it as non-expiring.
- View-as-client: POST /v1/auth/view-as/:clientId (admins by client:read:any;
  case owners by live grant). Issues a 15-min token with `view:true` and
  cid=client — AUTHORITY DOES NOT CHANGE (role stays the real one; every
  action audits as the real user); only /me PRESENTS role LEGAL_COUNSEL so the
  UI renders the client view. **REACH does change: the session is PINNED to
  that one client.** `viewAsClientId()` in common/scope.ts is the single rule,
  tested by both `scopeFor`s BEFORE the capability shortcut — otherwise
  `idea:read:any` wins and the admin is served every tenant under the viewed
  client's name, which is what happened (F-062: 298 ideas across 35 clients
  where the real counsel sees 52). The guard 403s a cross-client `client_id`
  from inside the session rather than quietly answering with the pinned one.
  The returned user must be COMPLETE — the frontend writes it straight into
  `pl_user` and every screen reads it there. Exit via /v1/auth/view-as/exit — the literal
  route MUST stay declared before `view-as/:clientId` (Nest matches in order;
  ':clientId' once swallowed 'exit' → 404).
- presentUser() (login + /me payload): id/email/name/role/client_id/
  organization_name/client{id,name} + assigned_client_ids for CASE_OWNER
  (live grants — the frontend gates client pages on it).

### 2.4 Domain services
- ideas.service: list/get include author+client+inventors+patent_link (the
  frontend needs them); create seeds author as PRIMARY IdeaInventor; submit
  gates on questionnaire substance; review derives stage; transitions endpoint
  feeds activity/update-request UI; co-inventor add (author-or-admin, same
  workspace) / remove by user-id or by CREDIT-row id (the design sends the
  credit id); deleteIdea (author, DRAFT only); cloneIdea (copies latest
  questionnaire); **pipeline** — the dashboard's "Ideas by stage" card as ONE
  answer: every number counts IDEAS, `granted` included (derived from
  Patent.status through IdeaPatentLink, so D5 holds and the unit stays ideas),
  plus `byClient` for the Photon card's filter. It was assembled in the browser
  from a 100-row page for four stages and from the patent portfolio for the
  fifth — "Filed 1 · Granted 5964" (F-061). `submitted` means "has left the
  inventor's hands"; `drafts` is the complement. Notifications fire on submit
  (→stage reviewers) and review (→inventors with the comment, + next-stage
  reviewers) — see notify.service (best-effort, RLS-bypassing because the
  recipient ≠ actor; NEVER let it fail the action).
- patents.service: list/stats/tags/due-dates all merge scopeFor + optional
  explicit client_id; `dueDates` also takes **`from`/`to`** (half-open) for the
  calendar, which INTERSECTS `filter` rather than replacing it — "overdue, in
  September" is two constraints, and letting the window win answered a question
  nobody asked; stats returns per-jurisdiction granted/pending splits
  (the world map needs rows, not aggregates); exportCsv; remind
  (due-date → notify client counsel); linkIdea (same-client check) — how FILED
  ideas surface "Granted".
- **patents.service import + src/patents/import/ — the portfolio spreadsheet.**
  A client's portfolio arrives as .xlsx/.csv, is presigned to Spaces, and the API
  reads it back by `file_id` (`rows` still accepted, for tests). Read the whole
  directory before changing any of it; the ordering constraints are real:
  * **Column names differ per client**, so `column-map.ts` asks a model which
    header is which field. It sends the **header row and nothing else** — never
    a cell, so no client patent data leaves the box — validates the answer
    against a closed `CANONICAL_FIELDS` list before anything reaches Prisma, and
    caches on a hash of the headers so a recurring export costs one call ever
    and maps the same way every time. The closed list is the security boundary,
    not the prompt: a header is attacker-controlled text. With no
    `OPENROUTER_API_KEY` this **503s** rather than importing zero rows, because
    there is no offline mapper and a silent empty import looks like success.
  * **Four fields are REQUIRED** — title, application_number, filing_date,
    jurisdiction (`REQUIRED_FIELDS` in import/plan.ts). They are the previous
    product's rule, recovered from its source; its bulk path applied a weaker
    version SILENTLY (`.filter(d => d?.application_number && d?.application_date)`)
    so a sheet with twelve blank filing dates imported short and said nothing
    (F-067). A missing COLUMN is reported once, a missing cell with its row
    numbers, both in the results modal.
  * `coerce.ts` reports what it cannot read instead of defaulting. Excel serials
    → dates (`47638` is 2030-06-04, and `new Date(47638)` is 1970); `;` beats
    `,` when splitting a list, because a sheet printing "SURNAME, First" switches
    to semicolons precisely because the names contain commas; `"NA"`/`-`/`TBD`
    are ABSENCE, not broken values. An unmapped legal status is a warning, never
    a silent APPLIED — that fallback filed 54 granted patents as pending (F-060).
  * Matching is on `Patent.application_number_norm` (`normalize-appno.ts` — the
    same rules as the SQL backfill in pre-push.sql; change both together), and a
    match **UPDATES in place**. Because that can overwrite curated data, every
    update records a field-level diff on the `PatentImport` row, and only fields
    the sheet actually mapped are written — an absent column never nulls a value.
  * It writes **PatentDueDate rows**, and until this existed *nothing in the
    running system did*: the 13.7k production deadlines were a one-shot legacy
    migration, so `/due-dates` and `/actions` were permanently empty for any
    client onboarded afterwards.
  * All parsing and the model call happen **outside** `withContext`, and writes
    run in 100-row chunks each in their own transaction — `withContext` wraps
    `$transaction` with Prisma's 5s interactive timeout, and one transaction for
    a whole sheet aborts and loses everything.
  * `errors` and `warnings` are counted separately. A clean 94-row sheet
    reporting 45 "errors" is a warning list nobody reads.
- clients.service: get includes members for user:read:client holders (People
  tab); updateUser = self-profile (name) OR role/status changes under
  user:manage (never self; client roles only; status ACTIVE|SUSPENDED —
  "remove" = suspend, reactivate exists); caseOwners returns the composed
  {owners, clients} the Manage Access screen renders; setAssignments is a
  replace-diff that treats EXPIRED grants as not-possessed (counting them as
  possession once silently locked an owner out); create() accepts
  admin_emails and invites them as LEGAL_COUNSEL in the same stroke.
- files.service: DO Spaces, **same-origin**. presign writes a PENDING row
  (storage config validated FIRST, type/extension against the allowlist) →
  browser PUTs to **`PUT /v1/files/:id/content`** → the API streams the bytes
  into Spaces (`@aws-sdk/lib-storage`, 5 MB parts) and HeadObjects before
  flipping to STORED (no phantom files). The browser used to PUT the presigned
  URL directly; that is cross-origin and needs bucket CORS (unsettable with a
  scoped Spaces key — control panel only) plus a CSP `connect-src` entry, and
  neither existed, so NO upload in the product had ever worked (F-064). The
  route pins `application/octet-stream` — Nest's json parser would drain a body
  labelled application/json before the handler ran — takes the content type from
  the ROW not the request, and counts the cap on the stream, so a lying
  `content-length` cannot write an unbounded object. `put_url` and
  `confirm-upload` remain for server-side callers; the app uses neither.
  Keys are client/category/16-random-bytes/name. snake_case fields: content_type,
  put_url. MAX_UPLOAD_MB. confirmBatch HeadObjects too — it used to be a bare
  updateMany that would mark rows STORED with no bytes behind them.
  **Upload/serve safety (files.service.spec.ts):** `content_type` is checked
  against an ALLOWLIST at presign and normalised before it is stored or signed;
  the extension blocklist covers markup (html/htm/xhtml) as well as
  executables. `/raw` sets `nosniff` + a `sandbox` CSP and serves `inline` only
  for images and pdf — everything else downloads. Before this, content_type was
  an unvalidated string echoed back verbatim on a route the frontend proxies
  same-origin, i.e. stored XSS on the app's origin. **SVG stays allowed on
  purpose** — 4 client logos are image/svg+xml and render through `<img>`,
  which never executes script; the sandbox CSP covers direct navigation.
- **prisma/propose-idea-patent-links.ts** — recovers idea→patent links that were
  never recorded (83 disclosures went to Photon, 13 came back FILED) and the set
  one client lost when `DELETE FROM "Patent"` cascaded through IdeaPatentLink.
  It PROPOSES to a CSV and links only what a human ticks: naive title matching
  over this corpus produced six confident false positives. `--tick-shortlist`
  is the DEMO mode — it pairs disclosures to Photon-filed patents in the date
  window 1:1, stamps every link `linked_by_id='heuristic:prn-window'` so
  `--unlink` takes them all back out when the authoritative list arrives, and
  never ticks a GRANTED patent. A PRN means Photon handled the filing, NOT that
  it came from a disclosure (1,871 of 2,125 PRN patents predate 2025) — see
  F-072 before trusting anything it produces. `--demo-grants N` additionally
  ASSERTS N idea→granted-patent pairs (same client, best title resemblance, date
  fence dropped) so the demo's Granted stage is not empty — those pairs are not
  evidence and are removed by the same `--unlink`. The fences live in
  one tested function — same client, filed on or after the disclosure, within
  three years, neither side untitled — and the date one alone removes the 81
  granted patents in the imported back-catalogue. See F-071.
- **prisma/backfill-legacy-scores.ts** — the SAFE way to carry legacy
  evaluations onto a workspace that is already live. `migrate-legacy.ts` is
  right for a fresh import and wrong here: re-running it re-upserts patents,
  ideas and draft answers, so anything edited in Pulse since the migration is
  overwritten with its 2026-08 wording. This writes score/report/
  api_evaluation_id only, only onto drafts with no score, with the `score: null`
  condition repeated in the UPDATE's own WHERE. See F-066.
- ideas/idea-reference.ts + ideas/reference-backfill.service.ts: an idea's
  human identity. `Idea.reference` ("DEMO07") is STORED, its counter
  `reference_seq` is unique per client, and `Client.idea_reference_prefix` is
  unique per workspace (checked UNSCOPED in ClientsService.update, and the
  error never names the other workspace). The backfill runs once at boot under
  a `pg_advisory_lock` — this repo has no migration tool, `prisma db push`
  makes columns and not data (F-041), and a migration needing a human with
  psql does not happen. Nothing user-facing may fall back to a uuid: F-052/053,
  gated by pulse-frontend's `no-visible-uuid` invariant.
- **Legacy evaluations.** `translateLegacyEvaluation` (evaluation-translate.ts)
  maps the PREVIOUS product's `CheckDraftSoreLog.score_meta_data` into the same
  envelope. 325 of them, covering 212 of 283 imported ideas, were left behind by
  migrate-legacy — it never read the table — so every migrated idea showed a
  blank score (F-066). The old payload is 0-10 and this UI reads /100, which is
  the one mistake that would look like data rather than a bug. Reports carry
  `rawDialect`, and `refreshStoredReport` routes on it: re-deriving a legacy
  payload through the AGENT translator nulls every field silently.
- ideas/preliminary-signal.ts + ideas/draft-assist.ts: the draft workspace's
  three OpenRouter surfaces (GET /v1/drafts/:id/signal, POST :id/autofill,
  POST :id/suggest). Two rules hold all three together and are pinned by
  specs: **novelty is the inventor's** — autofill and Suggest refuse the
  "what makes it different" section, enforced server-side against the draft's
  own __meta_data so renaming it changes nothing (F-051) — and **no invented
  numbers**: the rail's only figure is COUNTED from this workspace at request
  time, and any number the model returns that is not in the fixed FACTS list is
  dropped (F-050). The rail reports a state, never a grade: a prior-art search
  has not run yet, so there is nothing to grade.
- services/agent.service.ts: THE ONLY file that knows the patent-agent v2
  dialect — headers x-consumer/x-api-key; POST /v1/evaluations {ideaText};
  GET /v1/evaluations/:id; retrigger must RE-SUPPLY ideaText (agent never
  persists it). Scores are 0–10; ideas.service maps to /100 and translates
  the result into the OLD report envelope {scoringResult{score, noveltyScore,
  closestMatches[], recommendations, evaluationMetrics}, priorArt[], raw} at
  the caching point — the design's viewers speak that shape. Each closestMatch
  carries the agent's PER-DOCUMENT keySimilarities / distinctDifferences /
  overlappingConcepts (RESULT_SCHEMA_VERSION 1.4.0); the result-level overlaps
  and differentiators stay at report level and are never copied onto a card.
  That envelope
  carries `shapeVersion` (REPORT_SHAPE_VERSION in evaluation-translate.ts):
  the report is CACHED on the draft, so a stale copy is re-derived from its own
  `raw` on read (refreshStoredReport) instead of being frozen at the shape it
  had when scored. **Bump the constant whenever the envelope changes** — that
  is what makes already-scored ideas pick a fix up (F-043). noveltyScore is
  deliberately set = composite score (one idea, one headline number; true
  novelty in detailedAnalysis.directNoveltyScore). Unconfigured agent → 503,
  UI degrades. States: QUEUED/RUNNING poll on; SUCCEEDED/PARTIAL cache
  score+report on IdeaDraft; FAILED/TIMED_OUT/CANCELLED/REJECTED surface
  failureReason.

### 2.5 Analytics (src/common/analytics.service.ts — LIVE, PostHog Cloud)
Product analytics on **PostHog Cloud (US region, project 492003)**, **demo-only**
and **fail-closed**: `AnalyticsService` forwards to PostHog only when
`ANALYTICS_ENV` is allowlisted (`demo`) AND `POSTHOG_API_KEY` is set — the dev
droplet (no key / `ANALYTICS_ENV=dev`) never emits (config.ts, `.optional()`,
`OPENROUTER_API_KEY` convention). The typed event catalogue lives at
`src/common/analytics/catalog.ts` — **byte-identical across all three repos**
(sha `7a60c96a`, drift-gated exactly like `qa/contract.json`). `AnalyticsService`
**dual-writes**: first a durable `product_event` row (the record of truth, written
locally even when forwarding is off), then a filtered subset to PostHog —
best-effort, never throws (mirrors `AuditService`). **No free text, no PII, no
client-prefixed `reference`** ever reaches an event: `sanitize()` (catalogue
whitelist + denylist) strips it and a no-free-text schema test asserts it — the
load-bearing control now that data reaches a subprocessor. `captureAiGeneration`
emits a content-free `$ai_generation` for the three OpenRouter egresses (the
`/signal` rail, `/autofill`, `/suggest` in ideas.service) — model/tokens/latency
only, no disclosure. **Two atlas guards, pointing opposite ways, and both are
needed**: `analytics/coverage.mjs` fails a new mutation route / trigger with no
mapped event, and `analytics/emitters.mjs` fails an event that is DECLARED and
never fired — 51 of 145 were, silently, until 2026-08-31, and a funnel step
nobody emits reads as 100% drop-off rather than as missing. See findings.md
F-058 and F-059.

## 3. Operations

### Local dev
Docker Postgres on :5433 (infra/compose.yml), API :3000, frontend :3600.
[line removed by the design-repo sync: operational credential or account reference]
[line removed by the design-repo sync: operational credential or account reference]
loudly if you omit them) +
`psql < prisma/sql/rls.sql` + `npx tsx prisma/seed.ts`. Seed creates 2
[line removed by the design-repo sync: operational credential or account reference]
[line removed by the design-repo sync: operational credential or account reference]
[line removed by the design-repo sync: operational credential or account reference]
deliberately expired grant to prove the expiry predicate.
**seed.ts prefers DATABASE_URL_ADMIN and Prisma auto-loads .env — export BOTH
URLs explicitly when seeding a non-local DB or it writes to the wrong one.**
Typecheck: `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit`
— ALWAYS gate pushes on it (unchecked pushes have shipped broken builds; the
CI catches them but don't rely on it). Tests: `npx jest` (policy/roles/chain/
tokens/invite-parse unit specs; NO integration suite yet).

### Production (live)
- API https://demo-api.photonpulse.ai = droplet 168.144.213.118, repo at
  /opt/pulse-backend, `docker compose` (api + caddy, TLS auto). `.env` on the
  droplet holds all secrets (chmod 600).
- CI/CD: push to main → **.gitlab-ci.yml** → sast + secret_detection +
  typecheck + jest (with a **postgres:16-alpine service**; DB-backed specs read
  TEST_DATABASE_URL and FAIL rather than skip when CI is set) → build the image in CI → rsync compose/Caddyfile/deploy.sh
  → ssh → infra/deploy.sh pulls the image, applies **prisma/sql/pre-push.sql**
  and then runs `prisma db push`, both as DATABASE_URL_ADMIN, then `up -d` + a
  30x2s health loop → verify job curls demo-api.
  **pre-push.sql is the escape hatch for additive DDL that `db push` refuses to
  make on its own** — it will not add a unique constraint without
  `--accept-data-loss`, and that flag is global, so switching it on would also
  wave through a genuine column drop (F-054). Statements there must be
  idempotent and additive; the push that follows still runs, so drift between
  the file and schema.prisma is still caught. Held to those rules by
  qa/behaviour/pre-push-ddl.spec.ts.
  Protected vars: DEPLOY_SSH_KEY, DEPLOY_HOST, DEPLOY_KNOWN_HOSTS,
  REGISTRY_USER, REGISTRY_TOKEN. The GitHub workflow is deleted and must not
  come back — Actions cannot run against GitLab-hosted code, and the old
  strategy built the image on the droplet, which has 1.9 GB of RAM.
- DB: DigitalOcean managed PG. **No BYPASSRLS on managed PG** (superuser-only)
  → prod uses owner `doadmin` as DATABASE_URL_ADMIN and rls.sql applied WITH
  FORCE LINES STRIPPED (`sed '/FORCE  *ROW LEVEL SECURITY/d'`): owner bypasses
  ENABLE-only RLS, `pulse_app` (the app connection) stays fully enforced.
- Env vars: DATABASE_URL, DATABASE_URL_ADMIN, JWT_SECRET, APP_URL, API_URL,
  CORS_ORIGINS, SPACES_{ENDPOINT,REGION,BUCKET,KEY,SECRET}, MAX_UPLOAD_MB,
  PATENT_AGENT_{URL,API_KEY,CONSUMER}, MICROSOFT_{CLIENT_ID,CLIENT_SECRET,
  TENANT_ID}, GOOGLE_CLIENT_ID, PORT, NODE_ENV.
- Spaces bucket needs a CORS rule (origins = app URLs, methods PUT+GET) — set
  in the DO panel; scoped keys can't PutBucketCors via API.

## 4. Hard-won pitfalls (each cost a real debugging session)
1. Login throttle 5/5min — restart API before multi-login test phases.
2. Nest route order — literal segments before `:param` routes.
3. ValidationPipe skips `dto: any` entirely (no metatype) — always real DTOs;
   never spread `...dto` into Prisma data (nested-write mass assignment).
4. withContext already IS a transaction.
5. rls.sql DROP-block completeness (see 2.2).
6. An expired grant is NOT possession (assignments diff, entitlement checks).
7. Managed-PG seeding needs explicit env URLs (see Local dev).
8. zsh: `set -- $(...)` inside for-loops clobbers positional params; prefer
   explicit vars in ops scripts.
9. Deadline names come from registry imports and 94% contain a slash ("3 1/2
   Year Maintenance Fee Due"). Anything that puts one in a URL path segment
   404s — the action-templates lookup takes a query parameter for this reason.
10. Empty tables hide broken code. The Photon actions queue read fields the
   query never selected and threw on the first real row; with an empty queue
   the map never ran. Seed or import before believing a screen works.
11. Endpoints that return a tenant's whole docket MUST page. `dueDates()` and
   the actions list both once returned everything — 13.7k rows with joins,
   ~7s, and the actions list additionally created one row per deadline inside
   the transaction until it timed out. Both page now (default 25, max 200;
   `limit=0` is the calendar/export escape hatch, capped at 5,000).

## 5. Deliberately not built (ask before building; plan refs in
~/.claude/plans/pulse-v2-current.md)
Mailer (biggest UX gap: invites/resets are copy-paste links; TWO features are
already queued against it — the `Notification` rows NotifyService writes that
nothing reads yet, and `POST /v1/patents/due-dates/:id/remind`, whose UI column
was retired 2026-09-01 because the deadline reminder is meant to become an
email trigger rather than a button in a docket table. Both are deliberate
write-ahead, not dead code: atlas stale.md B4 and F11) · deadline RULES
ENGINE (§7.4: deadlines computed from filing events; today they're typed rows)
· provenance/never-overwrite-a-human (§7.3) · GDPR retention automation ·
SSO/Okta per-client · Prisma migration history (db push only) · Testcontainers
RLS integration suite (seed data was designed for it) · trademark module
(PRD 5) · copilot endpoints (analyze-document / draft-field / generate-summary
— agent lacks them; frontend calls exist and 501 gracefully).

Added for the redesigned frontend (PR saurrx#2), all under the existing
[line removed by the design-repo sync: operational credential or account reference]
[line removed by the design-repo sync: operational credential or account reference]
v1/auth/logout-all`, `PATCH v1/due-dates/:id` {status: COMPLETED|OPEN → the
column's PENDING; MISSED is refused because the clock owns that verdict,
asset:write}, and `Client.idea_reference_prefix` carried on the existing
`PATCH v1/clients/:clientId` (client:configure, normalized to [A-Z0-9-]{1,12}).

---

# Part II — full reference (schema, APIs, journeys, plan, compliance)

## 6. The plan and how the build deviates from it
The complete rebuild plan is committed at **docs/plan.md** (1,668 lines: context,
locked decisions, access model §5, data model §6, deadlines/rules §7, compliance
§8, persona surfaces §9, parity map §10, test strategy §13, diagrams §16). Read
it for WHY; read this file for WHAT EXISTS. docs/build-status.md is the running
build log with the FINAL STATUS block. Deviations, deliberate, made during build:

| Plan said | Built | Why |
|---|---|---|
| Next.js 15 App Router frontend | Vite+React SPA (saurrx design) wired via adapter | User chose the finished saurrx design; server-side session dropped with it |
| Drizzle ORM | Prisma (+ raw SQL for RLS context) | Team familiarity; transaction control achieved via withContext wrapper |
| Server-side Redis sessions | JWT access (15m) + rotating refresh (pulse_at/pulse_rt HttpOnly cookies), Session table stores hashed refresh tokens | No Redis dependency; revocation via Session row delete |
| 4 client roles (inventor/committee/counsel/client_admin) | 3: LEGAL_COUNSEL absorbs client_admin ("one role, not two. Always present") | Simplification; committee optional per client |
| pl_user/pl_admin/pl_superadmin | CASE_OWNER / PHOTON_ADMIN / PHOTON_SUPERADMIN | Same shape, renamed |
| access_request + approval flow | NOT BUILT — grants are created directly by PHOTON_ADMIN (Manage Access drawer) | Deferred; kind ASSIGNMENT/TEMPORARY/STEP_IN + reason + expiry all live |
| Trademarks in v1 | NOT BUILT — Patent only | Demo scope cut |
| Deadline rules engine (§7.4) | NOT BUILT — PatentDueDate rows are imported from the sheet's event columns, not computed from a rule | Deferred with the catalogue |
| PostHog typed analytics | BUILT — on PostHog Cloud (US), demo-only, not self-hosted | Plan said self-host; no invention content leaves regardless (no-free-text rule), so Cloud is ~$0 at this volume with zero ops — deliberate deviation (§2.5, findings F-058) |
| MFA / per-tenant SAML / SCIM | PARTIAL — Google, Microsoft (tenant-pinned) and **SAML/Okta** are all live as of 2026-09-02; SAML is ONE global IdP, so per-tenant is still not built. MFA and SCIM not built. | Deferred |
| Hash-chained audit + pgaudit | Single append-only-by-convention audit_log table (19 actions) | Honest partial — see §10 below |
| BullMQ worker app | No worker — evaluation polling is in-process; no email sending | Mailer deliberately absent |
| Import staged preview | patents/import parses the uploaded sheet in 100-row chunks, per-row report + field-level diff of every overwrite; results modal after the fact, no preview BEFORE committing | Partial |

## 7. Data model (prisma/schema.prisma — 23 models; comments in the schema are
authoritative, read them before touching a table)

**Legacy import (Aug 2026).** The production data came from the old
photon-legal-backend on AWS RDS: 80 clients, 426 users, 286 ideas, 14.2k
patents, 13.7k patent events, 195 action templates. `prisma/migrate-legacy.ts`
is idempotent and keyed on the ORIGINAL ids, so a re-run repairs rather than
duplicates and the two systems' rows stay identifiable to each other. The
[line removed by the design-repo sync: operational credential or account reference]
@photonlegal.com cannot collide with client domains.

Three things the import forced into the schema, each because the old data
carried a vocabulary this one had dropped:
- **ActionTemplate** (195 rows, 4 categories, 95 deadline types). templatesFor()
  used to be nine hardcoded entries matched by fuzzy string guessing, which
  answered "Take action / No action required" for most real deadlines.
- **Two action axes.** ActionRequest.submission_state (DRAFT/SUBMITTED/UPDATED)
  is the CLIENT's; .status is Photon's queue (NO_ACTION/NEW/ACKNOWLEDGED/
  IN_PROGRESS/COMPLETED/DECLINED). A revision to an instruction already in the
  queue is UPDATED + IN_PROGRESS — one enum cannot say that, and it is the case
  delivery must notice. ActionRequestVersion snapshots each submission.
- **Patent bibliographic fields** (abstract, inventors, assignees, family,
  IPC, priority, notes, prn, oc, status_timeline_history) — all read by the
  patents screens and previously rendering blank. PatentStatus gained
  NONPAYMENT (487 patents; not EXPIRED, not ABANDONED, possibly revivable);
  Client gained type EXISTING/POTENTIAL (56 of 80 are prospects) and plan.

[line removed by the design-repo sync: operational credential or account reference]
the hash announces and re-hashes to argon2id in place on success, so the
bcrypt path empties itself as people sign in. Do not "clean this up" until the
$2b$ count reaches zero — a forced reset is not an option while the mailer is
unbuilt.

**Identity/tenancy cluster:** Client (allowed_domain drives signup gating;
review_chain config: has_tech_committee) · User (role: one UserRole; status
[line removed by the design-repo sync: operational credential or account reference]
[line removed by the design-repo sync: operational credential or account reference]
provider) · Session (refresh_token_hash unique — DB read can't be replayed;
rotation on every refresh) · ClientAccess (the whole Photon access model:
user_id+client_id, kind ASSIGNMENT/TEMPORARY/STEP_IN — kind is a LABEL, never
in authz; reason, expires_at NULL=until revoked, revoked_at; the entitlement
check is one EXISTS over revoked_at/expires_at) · Invite (role-scoped,
[line removed by the design-repo sync: operational credential or account reference]
RejectedSignup / PendingEmailSignup-equivalents (hashed single-use tokens).

**Roles (UserRole):** client side INVENTOR, TECH_COMMITTEE (optional per
client, reviews BEFORE legal), LEGAL_COUNSEL (also the client admin — always
present); Photon side CASE_OWNER (assigned clients only), PHOTON_ADMIN (Head
of Patents), PHOTON_SUPERADMIN (unbounded, no dedicated screens).

**Idea cluster:** Idea (state: DRAFT/TECH_REVIEW/LEGAL_REVIEW/
CHANGES_REQUESTED/REJECTED/SENT_TO_PHOTON/FILED — GRANTED deliberately absent:
grant lives on the Patent via IdeaPatentLink, two sources of truth is drift;
revision int; author_id) · IdeaInventor (PRIMARY/CO credits) · IdeaTransition
(append-only chain of ReviewStage TECHNICAL/LEGAL × ReviewDecision APPROVED/
CHANGES_REQUESTED/REJECTED + comment; stage is DERIVED from state, never
stored on Idea) · IdeaDraft (answers Json — one object; frontend round-trips
its section structure under __meta_data/__completion reserved keys;
api_evaluation_id + score + report cache the agent result).

**ONE draft per idea, enforced** (`idea_id @unique`). The legacy product let an
inventor keep several named drafts ("Draft 1", "Draft 2"…) and flagged the one
actually sent with `ihc_sent`; Pulse re-opens the SAME draft when changes are
requested, so a second row can only ever be ambiguity. The imported extras were
collapsed by `prisma/collapse-drafts.ts` (keeper: the submitted draft, else the
most complete, else the most recent; discarded rows archived to JSON first, and
the legacy dump remains the archive of record). Do NOT reintroduce a
"which draft did they mean" heuristic — both the reviewer workspace and the
disclosure pane once guessed from timestamps and each guessed wrong differently.

**Patent cluster:** Patent (status APPLIED/EXAMINATION/GRANTED/EXPIRED/
WITHDRAWN/REJECTED/ABANDONED; jurisdiction, filing_date, tags) ·
IdeaPatentLink (idea→patent, created by idea:file) · PatentDueDate (status
PENDING/COMPLETED/MISSED; reminders have a 24h cooldown) · ActionRequest
(status NO_ACTION/NEW/IN_PROGRESS/COMPLETED/DECLINED; client-side selection →
Photon queue → resolve).

**Support:** Notification (in-app; no bell UI yet) · StoredFile (S3/Spaces;
FileStatus — confirm-upload HeadObjects before flipping to STORED) · AuditLog
(19 AuditAction values covering auth, invites, role changes, access grants,
PHOTON_ADMIN_ACCESS for out-of-assignment reads, client create/update;
metadata redacted at write time; actor survives deletion via SetNull).

Every tenant-scoped table carries client_id and an RLS policy; rls.sql in
prisma/sql is the policy source (see §2.2 in Part I for the begin_request
mechanics and the FORCE-strip variance on managed PG).

## 8. API reference (/v1, all JSON; caps in parentheses = @RequireCaps any-of;
JwtAuthGuard global except @Public)

**auth:** POST login · signup (domain-gated) · refresh · logout · GET me ·
GET check-domain · POST google · GET microsoft + /callback (tenant-pinned) ·
[line removed by the design-repo sync: operational credential or account reference]
POST invite/verify-share · POST view-as/:clientId (entitlement-checked for
CASE_OWNER) · POST view-as/exit (declared BEFORE :clientId — route order
matters).
**ideas:** GET / (idea:read:own|client|any — person-fenced for inventors) ·
GET pipeline · GET colleagues (user:read:colleagues) · GET :id · POST /
(idea:create — **403 for Photon roles: inventorship guard**) · PATCH :id ·
DELETE :id · POST :id/clone · POST :id/submit (idea:submit; draft substance +
100% completion gated) · POST :id/review (idea:review:technical|legal —
decision APPROVED/CHANGES_REQUESTED/REJECTED, comment required on
reject/changes; appeal = re-submit from REJECTED) · GET :id/transitions ·
POST/DELETE :id/inventors/:inventorId · DELETE inventor-credits/:creditId ·
drafts: GET/POST :id/drafts, GET/PATCH/DELETE drafts/:id, POST
drafts/:id/evaluate | re-evaluate | GET drafts/:id/evaluation (agent proxy;
caches score+report on the draft), POST drafts/:id/submit, POST
drafts/:id/review.
**clients:** GET clients (assigned-filtered for CASE_OWNER) · POST clients
(client:create; invites admin_emails as LEGAL_COUNSEL) · GET/PATCH
clients/:clientId · GET clients/:clientId/members · GET case-owners +
PUT case-owners/:userId/assignments (access:grant; expiry-aware diff) ·
PATCH/DELETE users/:userId (user:manage).
**patents:** GET patents (filter/sort/paginate) · stats · tags · export (CSV)
· GET patents/:id · POST patents · PATCH patents/:id · POST patents/import
(transactional, per-row report) · POST patents/:id/link-idea/:ideaId
(idea:file → sets Idea FILED) · GET due-dates · POST due-dates/:id/remind
(24h cooldown).
**actions:** GET / · PATCH :id · POST submit-all · GET templates/:eventType ·
GET queue (idea:file — Photon view) · POST :id/resolve.
**files:** POST presign-upload → PUT to Spaces → POST confirm-upload
(HeadObject-verified) · confirm-upload-batch · GET :id/download · DELETE :id.
**invites:** POST / · GET share-link · GET :code/qr · DELETE :id.
**misc:** GET dashboard (role-shaped payload) · GET notifications · POST
notifications/:id/read.

## 9. User journeys (end-to-end, as built — these are the outcomes the
Playwright harnesses assert)

**Inventor:** domain-gated signup or invite → lands on "Your invention
workspace" dashboard (pipeline counts exclude drafts) → My disclosures →
new idea → questionnaire draft (5 sections, autosave, co-inventor picker,
completion %) → optional evaluate (agent scores async; pulsing "Scoring in
progress…" chip until score lands) → Send (needs 100%; from REJECTED it is an
appeal and requires a reason) → watches status timeline: TECH_REVIEW (if the
client has a committee) → LEGAL_REVIEW → SENT_TO_PHOTON → FILED; on
CHANGES_REQUESTED they edit and resubmit (revision bumps).

**Tech committee:** /ideas is the Review queue (UNDER_REVIEW bucket) → open
idea → read-only Disclosure pane + Patent Analysis rail (score, prior art;
"Evaluation in progress…" card while the agent runs) + co-inventors + inventor
context → Approve ("Send to Legal Counsel") / Request changes / Reject
(type-REJECT confirm, comment required).

**Legal counsel (= client admin):** same review surface at the LEGAL stage;
approve = Send to Photon. Plus: Workspace (People tab — invite, role change
incl. IP Committee, suspend/reactivate; Org details; Business scope),
dashboard with Ideas-and-filings chart, portfolio pages, actions selection.

**Case owner (Photon delivery):** sees ONLY assigned clients (live
assigned_client_ids in session) → Clients page cards → open client → "View
as client" (entitlement-checked; presentation-only — real identity kept,
audit unchanged, exit via user menu) → can upload/import patent data and
prosecution due-dates for assigned clients (prosecution data ≠ inventorship)
→ Actions queue → resolve → CANNOT create ideas anywhere (403 guard) and
CANNOT grant access.

**Photon admin (Head of Patents):** everything above across ALL clients +
Onboard Client + Case owners tab (Manage Access drawer: Permanent/Temporary/
Step-in + reason + expiry) + audit read. Out-of-assignment reads are logged
as PHOTON_ADMIN_ACCESS.

**Superadmin:** every capability, no dedicated screens; the inventorship
guard is the ONE place capability alone is deliberately overridden.

## 10. Compliance posture (SOC 2 / GDPR / ISO 27001 / EU AI Act) — honest
status vs docs/plan.md §8. Do not claim more than this in any customer doc.

Built now: append-only audit_log with redacted metadata and 19 action types;
full logging of access grants/revocations/expiry and out-of-assignment admin
reads; view-as keeps the REAL actor in the trail (never the impersonated
name); hashed tokens everywhere (refresh, reset, invite) so a DB read is not
credential theft; argon2id; login/social/upload throttles; RLS as a real
second enforcement layer with a 42501→403 filter; soft-failure entitlement
checks BEFORE context is set; TLS 1.3 via Caddy; Spaces private bucket with
presigned, verified uploads; AI transparency partially honoured — the score
renders with prior-art context and review stages mean a human always decides
(never advance-on-score).
NOT built (plan §8 items — required before any real SOC2/GDPR claim):
hash-chained + off-box audit shipping, pgaudit, per-resource read logging
tiers, DSAR export, erasure-by-anonymisation, retention sweeps + legal hold,
backup-erasure procedure, application-level encryption of disclosure bodies,
key-rotation docs, quarterly access-review export,
Sentry, dependency scanning gate, AI-generated-text labelling (no copilot
built), DPIA/RoPA docs. Treat every one as a deliberate gap with a plan
reference, not an oversight.

## QA — the test corpus and how to run only what matters

`qa/` holds one tagged corpus, sliced by filter. There is no separate "security
suite" or "journey suite" to keep in step — they are views over the same tests.

    node qa/cli.mjs affected          # areas touched by your diff, and their tests
    node qa/cli.mjs run --tier security --area ideas
    node qa/cli.mjs checkpoint smoke
    node qa/cli.mjs contract          # the shared contract has not drifted
    node qa/cli.mjs exceptions        # the exception register is still honest
    node qa/cli.mjs list              # every test and its tags

`run` and `checkpoint` **select and then execute**; add `--list` to only print
the selection. Each repo declares its stance on every shared checkpoint in
`qa/areas.json` under `checkpoints` — `"tagged"` (select by `@cp:` tag),
`"all"` (every test here, which is what `nightly` means), or `"n/a: <reason>"`
for a checkpoint with no surface in this repo (a repo with no UI has no journey
to smoke-test). A contract checkpoint left undeclared is an **error**, so adding
one forces all three repos to say what they do about it. They exit non-zero if any selected file fails, if a selected file
matches no runner, or if the filter selected **nothing** — an empty checkpoint is
a broken filter, and reporting "ok" for it is how a suite rots. HOW each kind of
file runs (vitest / jest / plain `node`) is declared per repo in `qa/areas.json`
under `runners`, which is what lets `cli.mjs` stay byte-identical across the
three repos alongside `contract.json`.

**Tags** live in a test's doc comment: `@tier:` `@area:` `@role:` `@sec:`
`@soc2:` `@gdpr:` `@cp:`. An **untagged test always runs** — absence of a tag
must never mean "skip", or a test silently stops being selected the day someone
forgets the annotation.

**`qa/contract.json` is byte-identical in all three repos** and `qa/cli.mjs
contract` fails if it drifts. Edit it in one repo and you must copy it to the
other two and update `contractSha256` in each `areas.json`. That duplication is
the price of three separate git repos; the gate is what makes it safe. Same
pattern as patent-agent's `env-drift.test.ts`.

**`qa/areas.json`** maps source globs to feature areas. A path matching **no**
glob escalates to a full run — "I don't know what this affects" must never mean
"run less". Add new top-level paths to the map.

**`qa/exceptions.json`** suppresses a known test failure, and requires a reason,
an owner and an expiry. An expired or incomplete entry **fails the build**.

`qa exceptions --strict` additionally fails a suppression that matched nothing,
using the per-tier hit files the tiers write to `qa/.exception-hits/`. Run it
AFTER a tier, never before — with no hit files there is nothing to judge. An
exception is judged only when a **complete** run of its own tier is on record,
and baseline-comparison tiers are exempt because their exceptions go dormant by
construction. See findings.md F-018.

**`docs/qa/findings.md`** is different — it tracks *design* questions where
intent and code disagree, each to a resolution (fix code / fix doc / accept).
Read it before concluding something is a bug; twelve are already recorded.

### The rule that makes any of this worth having
**Every gate must be proved to bite.** Plant the violation, watch the test fail,
restore. patent-agent has done this since day one via
`tools/gates/redaction-bites.mjs`, and every gate added here was checked the
same way — the authz coverage guard against a route stripped of `@RequireCaps`,
the state model against an invented enum value, the semgrep rules against a
planted `unscoped()`. A green test that cannot fail is worse than no test,
because it is believed.

### The contract tier
`openapi/spec.yaml` is **generated from the code**, never hand-edited:

    npx ts-node -P tsconfig.json qa/contract/generate-openapi.ts          # write
    npx ts-node -P tsconfig.json qa/contract/generate-openapi.ts --check  # CI

ts-node and **not tsx**: the generator reads `design:paramtypes`, which only
exists when the compiler emits decorator metadata. esbuild — and therefore tsx —
does not, so under tsx every handler reports no parameter types and the
generator silently produces a spec with zero request schemas. It did exactly
that on the first run.

No `@nestjs/swagger`: its CLI plugin needs a build-time transform and only reads
files named `*.dto.ts` (ours are `dto.ts`). The generator reads the same route
metadata Nest dispatches on, plus the `class-validator` metadata already on the
DTOs. No new dependency, no build step.

**It is honest about the gap.** 85 routes, 18 with a real request schema, 26
write routes with an untyped body (`any` or an inline object). Those are marked
`x-undocumented-body: true` rather than emitted as a permissive `{}` — the count
is the backlog, and printing it is the point, because it was invisible before.

CI regenerates and diffs, so a controller change without a spec change fails the
pipeline. `oasdiff breaking` runs on merge requests against the target branch's
spec.

**Route ordering is now a test, not a comment.** NestJS resolves in declaration
order, and 22 same-method pairs depend on it — `/v1/ideas/counts` works only
because `counts` is declared above `:id`. `qa/contract/route-order.spec.ts`
computes every shadowing pair and fails if a parameterised route is declared
first. See findings.md F-013.

### Request bodies
Every `@Body()` is a validated DTO class — `qa/contract/validated-bodies.spec.ts`
fails if that ever stops being true, reading the count straight out of the
generated spec.

Two validation modes, and the difference is deliberate:

- **Global pipe** (`whitelist + forbidNonWhitelisted`) — an unknown property is
  a 400. Right for routes whose body the app constructs.
- **`@Body(LegacyBody)`** (`src/common/legacy-body.ts`, whitelist WITHOUT
  forbid) — unknown properties are stripped. Used only where pulse-frontend's
  adapter forwards an old-dialect payload verbatim (`body: b`): patents
  create/update/import, fileIdea, `PATCH /v1/users/:userId`, and the draft
  autosave. ProfileTab posts a whole form object to update-profile, and the
  draft PATCH forwards the raw body when `meta_data` is absent — under the
  strict pipe both would be a 400 on a screen nobody has touched.

The security property is identical either way: no unknown field reaches a
service or a Prisma call. Only the failure mode differs. Do not "tidy" a
LegacyBody route back to the strict pipe without checking what the adapter
sends it.

### The Atlas (cross-repo map)

`~/workspace/photonlegal/atlas` joins the three repos into one map: role
journeys traced through frontend route → components → API call → adapter rule
→ backend route → service → capabilities → Prisma models, plus the
triggers/schedulers register (code no user journey drives) and the stale-code
register (evidence-backed, delete only on approval). This repo's layer is
generated into `qa/map/` and **drift-gated in CI** — change a route without
regenerating and the pipeline fails, exactly like the OpenAPI spec. Regenerate
locally, commit the JSON, and re-run `node join.mjs` in atlas when the joined
view matters.

Regenerate this repo's layer: `npx ts-node -P tsconfig.json qa/map/generate.ts`

### Working alongside another agent in this checkout
**Never `git add -A` here.** Stage explicit paths, or take a `git worktree`:

    git worktree add ../pulse-backend-<task> -b <branch>
    git worktree remove ../pulse-backend-<task>

A pre-commit hook catches the shape of the failure. Enable it once per clone —
cloning does not install hooks:

    git config core.hooksPath .githooks

It refuses a commit of more than 15 files unless `ALLOW_BIG_COMMIT=1`, printing
the list first, and warns when other worktrees exist. Large commits stay
legitimate; the hook makes them deliberate.
A commit that says "de-flake one test step" and carries thirty-seven files —
including someone else's half-finished work and four unreviewed src changes —
has already reached production once (findings.md F-017, the fourth collision of
its kind). `git status` before staging, and read what you are about to commit.

### Rate limiting, and turning it off
`THROTTLE_DISABLED=true` skips every throttler — the global 100/min and all
nine per-route limits. It exists because the login limit (5 per 5 min per IP)
and the QA suite's five roles sit exactly on the ceiling, so any re-run inside
the window 429s every role.

**It removes a real control.** Brute force is the entire threat model on
`POST /v1/auth/login`, demo is publicly reachable, and its credentials are
written down in this file. Set it for a testing window and unset it afterwards.
The default is ON, so a missing variable protects rather than exposes, and the
API logs a warning on every boot while it is off:

    RATE LIMITING IS DISABLED (THROTTLE_DISABLED=true) — login is unthrottled.

If you find that line in a log you did not expect, that is the bug.

### CI budget — two modes, 400 minutes a month
GitLab Free gives **400 compute minutes per month**. A one-off top-up exists for
a single exhaustive pass; it does not come back, so nothing recurring is planned
against it.

**A docs-only merge does not deploy.** `build`, `deploy`, `spec-conformance`
and `verify` carry the `.affects-behaviour` rule, so a commit touching only
`docs/**` and `*.md` stops after the test stage. Measured 2026-09-01: a
comments-only merge ran the full main pipeline and redeployed the droplet with a
byte-identical image for **5.8 minutes**. `rules:changes` is an ANY-match, so
this can only be written as an allowlist of behavioural paths — which rots in
the dangerous direction, silently, the day someone adds a top-level directory.
`qa/behaviour/ci-deploy-scope.spec.ts` is what makes it safe: every tracked path
must be claimed by the allowlist or by documentation, and the four jobs must
agree (they skip together, or `deploy` chases an image `build` never pushed).
`test` is deliberately NOT gated — it is the job that runs that guard.

**Mode 1 — basic, every push.** Measured, not estimated:

    pulse-backend    ~2.4 min   test + semgrep + gitleaks + osv
    pulse-frontend   ~2.3 min   build + semgrep + gitleaks + osv
    patent-agent     ~3.8 min   build + gates + privacy semgrep + gitleaks

A push touches one repo, so ~2–4 min each. A merge adds build + deploy + verify
+ spec-conformance: backend ~6.3, frontend ~2.3, patent-agent ~10.4. At roughly
50 pushes and 10 releases a month that is ~340 minutes — room, not slack.

Two things were removed to make it fit, both because they could not change their
answer on most pushes:
- The GitLab SAST and Secret-Detection templates — a second copy of scans we
  already run, gating nothing on Free.
- `retrieval-quality` now runs only when retrieval, scoring, the harness or the
  CI file changes (`rules:changes` + `compare_to: main`), plus the weekly
  schedule. It was 56s on every push measuring a number that only moves when
  those move.

**Mode 2 — exhaustive, on demand.** `when: manual` on main, never on a push and
never on the schedule. Run these deliberately, with the top-up:

    dast-api              ZAP api-scan driven by openapi/spec.yaml
    trivy-image           the deployed image, HIGH/CRITICAL, --ignore-unfixed
    trufflehog-verified   full history, --only-verified
    browser-tiers         invariant + conformance + journeys (pulse-frontend)

`dast-api` is why generating the spec was worth it. A ZAP **baseline** scan
against a JSON API finds nothing — it is passive, and the spider can neither
execute a React bundle nor guess authenticated routes. api-scan driven by the
spec exercises all 86. Set `DAST_TOKEN` to a throwaway session cookie first, or
every authenticated route answers 401 and the scan proves only that the guards
are on, which the authz matrix already proves in two seconds.

**Weekly schedules** cover what changes without a commit: a new advisory against
an unchanged lockfile, drift no deploy caused. ~60 min/month for the browser
tiers, ~32 for the backend.
