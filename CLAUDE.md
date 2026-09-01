# Pulse frontend — complete agent context

Read fully before changing anything; this is the condensed knowledge of the
build. Backend context lives in pulse-backend/CLAUDE.md (product rules, roles,
review chain) — read that too; this file covers what is frontend-specific.

## 1. What this app is
The saurrx/pulse-design-auto design (branch
`codex/pulse-review-workflow-consistency`, commit 3f9b2fdb) wired to the real
Pulse API. **CONSTRAINT: the design must not change** — behaviour fixes and
user-requested changes yes, visual redesign no. When something "feels wrong",
compare against the original first (clone runs standalone on mock data:
`npx vite --port 3700` in a checkout of that repo; personas switch via the
bottom-left chip there). Design flaws found and deliberately fixed here (do
not regress): reviewers were sent into the editable questionnaire (read views
now), REJECT_BY_IHC was unsendable (appeals now work), reviewer CTAs were
single-stage, score-required blocked all submission when the agent was
offline (score is advisory), no view-as exit existed (menu item added).

## 2. THE LAW: the anti-corruption adapter (src/lib/realAdapter.ts)
~150 call sites across ~48 design files speak the OLD backend's dialect. The
adapter is the only file that knows both dialects. NEVER teach a component the
new dialect; extend the adapter. New code (s3Upload.ts) bypasses it via
`rawApi` + `/v1` directly.

Dialect map (old ⇄ new):
- Paths: `/api/v1/...` → `/v1/...` via RULES regex table; rules match method
  when specified, ANY method otherwise (a POST once fell through to a GET rule
  — method-lock rules that share a path). Unmapped → named 501 + console.warn.
  `node qa/contract/adapter-coverage.qa.mjs` lists every unmapped call,
  verb included — run it after adding UI.
- Idea: state DRAFT/TECH_REVIEW/LEGAL_REVIEW/CHANGES_REQUESTED/REJECTED/
  SENT_TO_PHOTON/FILED ⇄ status IN_DRAFT/UNDER_REVIEW/SENT_TO_IHC/
  UPDATE_REQUEST/REJECT_BY_IHC/SEND_TO_OC/FILED (STATE_TO_STATUS +
  STATUS_TO_STATE). `oldIdea()` adds created_by_id(=author_id), created_by,
  summary(=body), submission_date/dateSubmitted(=submitted_at), createdAt/
  updatedAt, sent_to_ip_committee_at, IdeaInventor[] (from inventors),
  IdeaPatentLink[] (from patent_link).
- `ideaListWrap(query)` re-implements the old SERVER-side contract client-side:
  search, status CSV filter, filter_client_id, sort (createdAt/updatedAt/
  submission_date), order, page/limit + pagination envelope.
- Patent: `oldPatent()` — legal_current_status (GRANTED→ACTIVE_GRANTED etc. per
  src/utils/patentLegalStatus.ts vocabulary), publication_country
  (=jurisdiction), application_date(=filing_date), inventors[] (names via
  idea_link), IdeaPatentLink[]. Status query params translate back via
  LEGAL_TO_PSTATUS.
- Draft: the workspace autosaves {meta_data: sections→questions→answers,
  completion_percentage}; the clean API stores ONE answers object. The save
  rule flattens question ids into answers AND round-trips the full structure
  under reserved keys `__meta_data`/`__completion`; `oldDraft()` restores
  title, completion_percentage, meta_data, CheckDraftSoreLog (score+report),
  nested idea {status, clientId, created_by_id} — the reviewer disclosure
  workspace branch keys off those nested fields.
- Users/clients: asUser() gives photon roles the sentinel client_id
  "photon-legal" (the design gates queries on !!client_id); uuid-guard strips
  the sentinel from client-scoped API params. Client payload aliases
  allowed_domain, User[] (members with active/verified/suspended booleans).
- Dashboard wrap: granted_patents/pending_patents/inactive_patents/
  total_patents, weekly_series, ideas_last_30_days, patents_filed_last_90_days,
  top_clients — the design reads these flat names.
- Actions: `action_status` and `request_status` are TWO real axes now, not one
  faked field. action_status is the client's submission state (DRAFT/SUBMITTED/
  UPDATED, from the API's submission_state); request_status is Photon's queue
  (NEW/ACKNOWLEDGED/IN_PROGRESS/COMPLETED). The adapter used to hardcode
  action_status:"SUBMITTED", which made UPDATED — a client revising an
  instruction already in the queue — impossible to render. The OC queue rows
  are translated too (patent/patent_event/action_template/client are nested
  differently in the clean shape); passing them through raw crashed the screen
  the moment real actions existed. Action templates come from a 195-row
  catalogue: the event type travels as a QUERY parameter because 94% of real
  deadline names contain a slash.
- Envelope: every wrap returns {data: ...} because call sites read
  response.data.data.

## 3. Auth & session
HttpOnly cookies pulse_at/pulse_rt from the API; readable `pl_user` cookie =
display state only (written from login response, cleared by apiConfig when a
refresh fails so a dead session can't masquerade as "data never loads").
apiConfig: axios, withCredentials, x-requested-with CSRF header, single-flight
401→refresh→retry interceptor. Cookies stay FIRST-PARTY by proxying:
- dev: vite.config.ts proxies /v1 → localhost:3000 (app on :3600)
- prod: vercel.json rewrites /v1 → demo-api.photonpulse.ai AND supplies the
  SPA fallback `/((?!v1/).*) → /index.html` — custom rewrites REPLACE Vercel's
  default fallback; removing that line 404s every deep link.
- `VITE_API_URL` stays EMPTY everywhere, by design.
View-as-client: ClientDetailPage stores the admin identity in sessionStorage
(pl_original_admin_user, pl_client_mode) and swaps pl_user; "Exit client view"
lives in the Sidebar user menu (calls /v1/auth/view-as/exit, restores, reloads).
Case owners gate client pages on user.assigned_client_ids from the session.

## 4. Role model (renames from the design)
OC_ADMIN→PHOTON_ADMIN, IHC_ADMIN→LEGAL_COUNSEL; TECH_COMMITTEE is NEW here
(no design equivalent): nav mirrors counsel but Profile instead of Settings;
/ideas renders ReviewQueueWorkspace; Review bucket counts UNDER_REVIEW only;
approve button reads "Send to Legal Counsel". Labels: src/lib/roles.ts
ROLE_LABEL; photon-side check = isOutsideCounselRole (roleAccess.ts) — note
the name means PHOTON side (historical). `npm run lint:roles`
(tools/no-substring-roles.mjs) FAILS the build on role.includes() — substring
checks silently broke during the rename once.

## 5. Component map (the big ones are 2000+ lines — grep, don't read whole)
- pages/Index.tsx — role-branched dashboard. **Every stage number comes from
  `/v1/ideas/pipeline`** (one call, `byClient` for the Photon filter); it used
  to be counted in the browser from a 100-row PAGE, with Granted taken from the
  patent portfolio instead — "Filed 1 · Granted 5964" — and switching definition
  the moment a client filter was applied (pulse-backend F-061). Granted counts
  ideas whose linked patent is GRANTED, never an idea status; the firm's whole
  granted count is the Patent portfolio card on the same screen, and they are
  different populations on purpose. **No queryFn may swallow its own error**:
  they all did, returning `undefined`, so React Query cached a failure as a
  success and the cards rendered zeros — one failed /v1/dashboard showed "0 Total
  patents" for a portfolio of 14,260. Errors propagate, the cards take
  `hasError`/`onRetry`, and every key carries the viewer (`scope`), because
  `["dashboard"]` is the same key for every identity the app can hold.
- components/review/ReviewQueueWorkspace.tsx — committee/counsel queue; role-
  aware reviewStatuses; Full record → /ideas/:id
- components/ideas/IdeaDetailsContent.tsx — THE monster. Branches:
  `useDisclosureWorkspace` (reviewers: Disclosure pane + Patent Analysis rail
  + Co-inventors + role CTAs incl. ⋯ Reject with type-REJECT confirm; OC gets
  the workflow-status dropdown) vs inventor draft-card layout. In-flight
  scoring shows "Evaluation in progress…" rail card / card chip keyed on
  api_evaluation_id-without-score.
- components/ideas/DraftWorkspace.tsx — inventor questionnaire (autosave,
  co-inventor picker); DraftListView — draft cards; Edit/Resume + Send are
  INVENTOR-only affordances; Send requires 100% completion; REJECT_BY_IHC is
  sendable (appeal) and the send mutation collects the required reason via
  prompt (covers the "Skip & submit" co-inventor path too).
- workspace/: WorkspaceTabs — NO LONGER TABS (saurrx#2): a client identity
  card whose "Edit workspace" opens OrganizationDetails in a dialog, then
  PeopleTab; PHOTON_ADMIN still short-circuits to CaseOwnersTab. Profile left
  the workspace entirely — /profile (pages/ProfilePage.tsx) is its own route
  and /workspace redirects every non-admin there. PeopleTab (role select incl.
  Tech Committee — the OPTIONAL pre-counsel stage, never "IP Committee";
  suspended→"Disabled"+Reactivate; invite link block renders on `active` and
  carries Regenerate/Deactivate — F-044), CaseOwnersTab (Manage Access: composed {owners, clients}
  payload; drawer has Access type Permanent/Temporary/Step-in + reason+expiry)
- clients/: ClientsPage (cards navigate via handleClientClick), OnboardClientModal
  (submit label "Onboard Client"; domain field name=allowed_domain, validated
  as "@domain.com", a bare domain or a full address — the adapter keeps the
  domain either way, and READS it back bare, not as a fabricated "x@…"),
  OverviewTab (defensive prop defaults — undefined team/history once crashed
  the page; Import history is always offered and says so when empty, because
  hiding it made every pre-tracking client look unsupported. **Upload portfolio**
  presigns the .xlsx/.csv to Spaces and then POSTs `{file_id, client_id}` — the
  API parses the sheet server-side. It used to POST `{key, originalName, size,
  contentType}`, none of which the endpoint declares, so LegacyBody stripped the
  body and every upload 400'd on a missing `rows`: no portfolio import had ever
  succeeded (F-060). `s3UploadForImport` takes the **clientId explicitly** and
  passes it to presign, because the API otherwise falls back to the CALLER's
  client — null for a Photon user — and the file landed under `photon/`, fenced
  to nobody. Results land in DuplicatePatentsModal, which reports added/updated/
  deadlines/errors plus a field-level diff of anything the sheet overwrote)
- DesktopOnlyGate.tsx — overlay for phones and tablets (pure CSS visibility,
  app stays mounted: cannot cause state bugs). It gates on the DEVICE
  (`pointer: coarse` and `hover: none`) plus a 640px hard floor, NOT on width:
  it was `lg:hidden`, and CSS pixels shrink with zoom, so a 1440px laptop at
  150% reported 960px and desktop users were told to find a desktop — an
  accessibility failure, since zoom is the first thing low vision reaches for
  (pulse-backend F-069). The condition lives in index.css and is shared with the
  body scroll lock and the 1024px floor; `qa/invariant/desktop-gate.qa.mjs`
  fails if the three drift apart. Mobile layout is NOT built, but the gate
  itself now fits: `body{min-width:1024px}` is scoped to `@media(min-width:
  1024px)` and html/body scroll-lock below it (index.css). Unscoped, that
  floor inflated the mobile LAYOUT VIEWPORT to 1024px x full-doc-height —
  which is what a `fixed inset-0` element sizes against — so the gate became
  a ~1024x2200 box centring its message off-screen (the old "634px overflow";
  users had to pan right and down to read it). The gate is its own scroll
  container (min-h-full inner flex) so the message stays reachable on short
  landscape viewports. Keep the floor desktop-only.

## 6. Harnesses & testing law
The four root-level `.mjs` harnesses are **gone**, replaced by `qa/`:

| was | now | why the replacement is better |
|---|---|---|
| `journeys.mjs` | `qa/journey/*.qa.mjs` | asserts outcomes per role, not absence-of-errors |
| `route-sweep.mjs` | `qa/contract/adapter-coverage.qa.mjs` | matches the VERB too — the old one passed a rule locked to POST while every call site sent GET, which was a P0 |
| `baseline.mjs` + `compare.mjs` | `qa/invariant/` + `qa/conformance/` | a pixel baseline records whatever it first sees, so a page that was wrong on day one is defended forever; these assert rules and structure instead |

**LAW (a real bug hid behind its violation): assert OUTCOMES per role — URL
changed, state changed, element appeared — never just absence of errors.**
**Corollary: an empty table hides broken code.** The Photon actions queue read
fields nothing selected and threw on its first real row; with no rows the map
never ran. Test against imported data, not a bare seed — and see
pulse-backend `prisma/seed-demo-inventor.ts`, which exists because the inventor
account had no ideas and three tiers were passing without checking anything.

Playwright scripts must live where module resolution finds `playwright` —
repo root or `qa/`. Login throttle is 5/5min/IP: reuse `qa/.sessions/`, never
run two browser tiers concurrently, and see `THROTTLE_DISABLED` in
pulse-backend if you need it off for a testing window.
Playwright `prompt()`/`confirm()` need `page.once('dialog')` BEFORE the click.

## 7. Workflows
dev `npm run dev` (:3600; API must run on :3000) · typecheck (strict, keep 0)
· lint:roles · build · deploy = push main → Vercel auto → verify
https://demo.photonpulse.ai. Demo accounts: see pulse-backend/CLAUDE.md
(password pulse-dev-password).

## 8. Known-not-built (ask before "fixing")
Mobile layout · notification bell (backend emits; no UI surface — product
decision pending) · copilot trio analyze-document/draft-field/generate-summary
(+ upload-idea-file multipart path, update-requested-change) — 501 by design
until agent support exists · SSO.

(The patent import path is no longer untested against a real XLSX: the actual
94-row client file is a fixture at pulse-backend `qa/fixtures/`, imported end to
end by `qa/behaviour/patent-import.spec.ts`.)

---

# Part II — screens, journeys, features, plan

## 9. Plan lineage
The full product plan (personas, features, parity map, compliance) is
committed in the sibling repo at **pulse-backend/docs/plan.md** (§9 persona
surfaces and §10 feature parity are the frontend-relevant sections);
pulse-backend/docs/build-status.md is the build log. This app implements the
plan's persona surfaces ON the saurrx design instead of the planned Next.js
build — the design swap is a locked decision, see backend CLAUDE.md §6 for
the full deviation table.

## 10. Route → page → component map
Public: /login (Login.tsx; OCLogin.tsx is deleted. IHCLogin.tsx is NOT dead —
ResetPassword.tsx imports its `iIHCLoginForm` type, so it stays) · /signup (domain-gated; NotOnboarded.tsx when domain unknown) ·
/invite (accept + share-link path) · /forgot-password · /reset-password.
Protected routes sit under ONE layout route (`<Route element={<DashboardLayout/>}>`
in App.tsx) so Sidebar + Header mount once per session. Each page used to wrap
ITSELF in `<DashboardLayout>`, so every navigation tore the chrome down and
rebuilt it — measured, the sidebar DOM node was replaced on four routes out of
four (pulse-backend F-068). A page that needs its own header controls renders
`<PageHeader title=… actions=… primaryAction=…/>` from `components/DashboardChrome`,
which PORTALS them into the header's slot; `<MainClass/>` does the same for
per-page classes on `<main>`. Portals rather than context because the controls
are live JSX bound to page state, and an effect keyed on JSX re-fires every
render and loops. Title logic stays in DashboardLayout.defaultHeaderForRoute:
- **/** Index.tsx — role-branched dashboard. Inventor: pipeline tiles (drafts
  excluded) + my disclosures. Counsel/committee: DashboardStats 6 tiles,
  Ideas-and-filings chart, PatentWorldMap, TopInventors, TimelineAndEvents.
  Photon: cross-client variants. TimelineAndEvents' calendar asks the server for
  ONE month (`month`/`year` → `from`/`to`); it used to filter page 1 of 13,672
  deadlines in the browser, so most months rendered empty and paging changed
  nothing. A day cell is `min-h-[84px]`, not `h-`: measured, 84px holds exactly
  ONE chip, so the old fixed height did not contain two — it drew them over the
  week below. Event detail is a Popover (floats, Escape closes, per-chip state);
  it was an inline panel keyed on the APPLICATION NUMBER, so one click opened
  every event of that patent across the month.
- **/ideas** IdeasPage → role branch: INVENTOR = DraftListView/EmptyDraftsView
  cards; TECH_COMMITTEE + LEGAL_COUNSEL = review/ReviewQueueWorkspace;
  photon roles = IdeasContent table. Every row is named by its **reference**
  (`reference_number`, e.g. DEMO07 — pulse-backend F-052), never by an id: the
  fallback is an em dash, because a screen with nothing to show should say so
  rather than print a database key. `qa/invariant/no-visible-uuid.qa.mjs`
  fails the build if any screen renders a uuid to a reader.
- **/ideas/:id** IdeaDetailsPage → IdeaDetailsContent (the monster; branch
  `useDisclosureWorkspace` for reviewers vs inventor card layout; rail =
  score + prior art + StatusTimeline; modals: RejectIdeaModal, SendToOCModal,
  FileIdeaModal, RequestUpdate/ViewRequestUpdate, IdeaSubmissionModal,
  ShowScoreReport/DownloadReport/PatentReportDocument). A prior-art card shows
  the five things the design shows — abstract (clamped at 320 chars with Read
  more; patent abstracts run past 1,500), key similarities, distinct
  differences, a novelty bar, overlapping concepts — all PER DOCUMENT, from the
  agent's per-document analysis. The whole-search overlaps/differentiators are
  a separate "What the search found" block; they are one set per evaluation and
  are never copied onto a card. **Stage gate:** counsel
  acts at SENT_TO_IHC only, the committee at UNDER_REVIEW; a counsel looking at
  a committee-stage idea gets the same "Under Tech Committee review" banner the
  queue shows. Reaching UNDER_REVIEW already proves the client runs a
  committee, so there is no "no committee" exception to make (F-045). The
  inventor's rail reads the report cached on the draft, the reviewer's view
  reads the live evaluation — they must render the same evidence, which is what
  pulse-backend's REPORT_SHAPE_VERSION keeps true (F-043).
- **/ideas/:id/draft** IdeaDraftPage → DraftWorkspace (5-section
  questionnaire, autosave, CoInventorsField, AudioInput dictation) /
  DraftCreationContent; reviewer read view = IHCAdminDraftView/OCDraftView/
  PatentPaperView. Three AI surfaces, all server-enforced (pulse-backend
  draft-assist.ts + preliminary-signal.ts): **autofill** from pasted text or an
  uploaded file — the file is parsed HERE, in the browser (lib/documentText.ts,
  pdf.js and mammoth both lazily imported), so the document never leaves the
  machine; **Review this** beside each field, returning unusable / improve
  (with a rewrite to accept) / good; and the **rail**, which follows the
  writing through a debounced content digest rather than a section count.
  NEITHER aid touches the Novelty section — that is the inventor's claim, and
  the refusal is enforced on the server, not here.
- **/patents** PatentsPage → PatentsContent (14-col table, URL-synced filters,
  PatentTagsCell, CSV export); **/patents/:id** PatentDetailsContent (events,
  timeline, documents, next steps). The toolbar carries `pulse-toolbar-tight`
  (index.css): the Photon side's Clients filter pushed Sort onto a second line
  at 1280, so the controls are narrower rather than fewer, and the search field
  gives up width first. It still wraps below ~1100px — a safety valve, not the
  normal state.
- **/due-dates** DueDatesPage → DueDatesContent list + DueDatesCalendar +
  RemindButton (24h cooldown — kept, and NOT dead: the deadline reminder is
  queued to become an email trigger when the mailer lands, so its route, its
  cooldown and its render branch stay put; atlas stale.md F11). The **Action**
  column is CLIENT-side only —
  counsel and the committee have no /actions nav item, so it is their only
  surface for choosing an instruction, and dropping it globally is the exact
  regression the conformance tier exists to catch. Photon roles work the other
  axis at /actions and now carry neither Action nor Remind (pulse-backend
  F-063). Columns lead with Application No., then Title,
  **Next Event**, **Deadline** — the Photon Operations table's order and
  vocabulary, one table's worth of words for the whole product. No row-number
  column: it numbered the current page of a sorted, filtered list. Search,
  window filter and sort are the SERVER's (`search`/`filter`/`sort`/`order` on
  /v1/due-dates): the list is paginated, so a browser-side sort would only
  order the rows the server already picked. See pulse-backend F-047 — every
  control here was decoration until the adapter stopped dropping them.
- **/actions** ActionsPage → IHCActionsContent (client selects actions;
  CountrySelector, SubmitActionsDialog) vs OCActionsContent (Photon queue,
  RequestStatusBadge, resolve). Titled "Actions" for both, and that is not a
  collision: no role has both /actions and /due-dates in its nav, and each is
  the action list of whoever arrives there. RequestStatusBadge disables the
  stages behind the current one — the queue is forward-only server-side.
- **/clients** (photon only) ClientsPage cards → **/clients/:clientId**
  ClientDetailPage (ClientTabs: OverviewTab, PatentsTab + AddPatentModal +
  DuplicatePatentsModal import, people via ClientInviteDialog;
  "View as client" button top-right) · OnboardClientModal from the list page.
  (BusinessScopeTab existed in two copies and neither was reachable from
  ClientTabs, which only renders overview + patents. Both deleted.)
- **/workspace** WorkspacePage → WorkspaceTabs: PeopleTab, CaseOwnersTab
  (photon admin: Manage Access drawer), OrganizationDetails, ProfileTab.
- **/assistant** AssistantPage — placeholder surface (copilot not built).
Dead design files are now DELETED, not kept — 48 of them, ~230 KB, including
the whole never-imported half of components/ui/. If you need one back it is in
git history; do not re-add it speculatively.

**How that list was produced, because two cheaper methods both got it wrong:**
grepping for the filename missed relative imports and reported live files as
dead; grepping for the bare identifier matched ordinary words ("chart",
"alert", "types") and reported dead files as live. The only reliable answer was
to parse every import specifier, resolve it against the alias and extension
rules, and iterate to a fixpoint so cascades are caught — deleting
BusinessScopeTab orphaned businessScopeQuestion, skeleton and aspect-ratio in
turn. PatentReportModal, TechBackground, BannerAnimation and IHCLogin all
survived that pass and are LIVE; the earlier audits had all four listed as
dead. src/vite-env.d.ts is never imported by design (ambient declaration) and
must not be swept.

## 11. Per-role journeys (what the harness asserts, in UI terms)
- **Inventor:** signup/login → dashboard → My disclosures → New idea →
  questionnaire to 100% (autosave visible) → optional Evaluate → pulsing
  "Scoring in progress…" chip → score appears → Send → StatusTimeline
  advances TECH_REVIEW→LEGAL_REVIEW→SENT_TO_PHOTON→FILED; CHANGES_REQUESTED
  reopens editing; REJECTED shows appeal path (reason prompt).
- **IP Committee:** login → Review queue (UNDER_REVIEW bucket, day-age) →
  open → one-screen decision: Disclosure pane + Patent Analysis rail +
  co-inventors → "Send to Legal Counsel" / Request changes / ⋯ Reject
  (type-REJECT confirm).
- **Legal counsel:** same at LEGAL stage, approve = "Send to Photon"; plus
  Workspace people management, dashboard chart, patents, actions selection.
- **Case owner:** login → sees ONLY assigned clients → client card → open →
  View as client (menu shows "Exit client view") → upload patents/due-dates →
  Actions queue → resolve. Never a "new idea" affordance; idea create = 403.
- **Photon admin:** all clients + Onboard Client + Case owners tab access
  drawer.
- Mobile/tablet (<1024px): DesktopOnlyGate overlay, app mounted underneath.

## 12. Feature inventory (parity status vs plan §10)
Shipped: email/Google/Microsoft auth, invites + share-link + QR, forgot/reset,
role-shaped dashboards, multi-draft questionnaire with autosave + dictation,
real agent scoring with in-flight indicators + report download, two-stage
configurable review (committee optional per client), appeals, clone,
supporting files (presigned Spaces uploads), patent portfolio table + detail +
CSV export + import, due dates list/calendar + reminders, actions
selection/queue/resolve, client onboarding + business scope, people/roles/
suspend, case-owner assignments, view-as-client, desktop gate.
Landed with the saurrx#2 design port, backend built to match (see
pulse-backend §5): change password + sign out everywhere on /profile,
per-client idea reference prefix, and ticking a docket event done/reopen
(hooks/usePatentEventCompletion.ts → adapter → PATCH /v1/due-dates/:id).
Not built (do not fake): copilot auto-fill trio, notification bell UI,
comments/version-history timeline, per-client feature toggles, trademarks,
mailer-driven email notifications, mobile layout, SSO, access-request flow.

## 13. Removed leftovers (don't reintroduce)
The saurrx design repo shipped a Docker/nginx deploy path (nginx.conf,
Dockerfile.dev/.prod, .dockerignore) — deleted; this app deploys on Vercel
and vercel.json owns the SPA fallback + /v1 proxy. Also deleted: bun.lockb
(npm is the package manager), sketch-preview/, .cursor rules, and all
unreferenced public assets (scraped "Photon Pulse - OC_files" page, spare
world geojsons — the map uses world-india-pov.json — placeholder/6sense
svgs). lovable-uploads and public/fonts are now deleted — the fonts had a
single consumer, the dead pdfGenerator.ts.

## 14. Analytics (PostHog — product events, autocapture + heatmaps, NO session replay)

Events go to PostHog Cloud (US) only on **demo.photonpulse.ai**. The catalogue is
`src/lib/analytics/catalog.ts` — **byte-identical across the three repos**, sha256
drift-gated (`qa/security/analytics-guard.qa.mjs`); edit it in atlas and copy to all
three, never one. `src/lib/analytics/index.ts` wraps `posthog-js`: `track(event,
props)` no-ops unless `analyticsEnabled()` (env `VITE_ANALYTICS_ENV=demo` ∧
`VITE_POSTHOG_KEY` set ∧ hostname in `ANALYTICS_HOST_ALLOWLIST`) and `sanitize()`s
first. Init is in `App.tsx` (`disable_session_recording:true`, `autocapture`,
`enable_heatmaps`, `capture_pageview:'history_change'`). identify/reset in
`use-auth.tsx`/`auth.ts`; view-as re-identify in `Sidebar.tsx`. **Never send
content/PII/`reference`** — only ids/enums/counts (the denylist + gate enforce it);
mask rendered disclosure with `ph-no-capture`.

Three emitters, and no fourth: `track(event, props)` for an action;
`useTrackOnce(event, props, when)` for anything "opened" — it guards the
strict-mode double-invoke and RE-ARMS on the falling edge, so a screen fires once
per mount and a dialog once per opening; and `src/lib/toast.ts`, the app's ONLY
toast import (`import { toast } from "@/lib/toast"`, never from `"sonner"`),
which counts `ui_error_toast_shown` centrally rather than at 153 call sites. It
sends the toast VARIANT and never the message — a message is free text and
routinely an API error echoing what the user typed.

**A new user-facing feature needs a catalogue event**, and two atlas guards
enforce it from opposite directions: `analytics/coverage.mjs` (a route with no
event) and `analytics/emitters.mjs` (an event with no emitter — 51 of 145 were
in that state until 2026-08-31; a funnel step nobody fires reads as 100%
drop-off, see findings F-059). Env vars live in Vercel (production target only,
so preview/dev never fire). See the analytics plan + atlas `analytics/`.

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
the price of three separate git repos; the gate is what makes it safe. Same pattern as patent-agent's
`env-drift.test.ts`.

**`qa/areas.json`** maps source globs to feature areas. A path matching **no**
glob escalates to a full run — "I don't know what this affects" must never mean
"run less". Add new top-level paths to the map.

**`qa/exceptions.json`** suppresses a known test failure, and requires a reason,
an owner and an expiry. An expired or incomplete entry **fails the build**.

`qa exceptions --strict` additionally fails a suppression that matched nothing
— the thing the register exists to prevent. It works because the tiers now
record which exception ids actually fired, per tier, into `qa/.exception-hits/`
(gitignored). Run it AFTER the tiers, which is why it lives at the end of the
`browser-tiers` job rather than in `build`: with no hit files there is nothing
to judge.

Two deliberate refusals to guess:
- An exception is judged only when a **complete** run of its own tier is on
  record. A throttled login skips a role, and a partial run is not evidence.
- **Conformance exceptions are never judged dead.** Their findings are diffs
  against a committed baseline, so re-recording the baseline leaves nothing to
  suppress and they go dormant by construction, waking when reality drifts
  again. Calling those dead would report eleven good suppressions as failures
  after every `--update` — which is how a strict check teaches people to turn
  it off.

**`docs/qa/findings.md`** is different — it tracks *design* questions where
intent and code disagree, each to a resolution (fix code / fix doc / accept).
It lives in `pulse-backend/docs/qa/findings.md` (cross-repo by nature). Read it
before concluding something is a bug; twelve are already recorded.

### Uploads are same-origin
`s3Upload.ts` presigns, then PUTs the bytes to **`/v1/files/:id/content`** on
this origin. It used to PUT the presigned DigitalOcean Spaces URL directly,
which needs a bucket CORS rule (settable only from the DO control panel — a
scoped Spaces key cannot) AND a `connect-src` entry in vercel.json's CSP.
Neither existed, so no upload in the product had ever succeeded, and every one
surfaced as the generic "An error occurred while uploading the file" because a
CSP block yields an Error with no `.response` (pulse-backend F-064). Do not
reintroduce an external storage host in `connect-src` —
`qa/security/upload-same-origin.qa.mjs` fails on that AND on any direct storage
PUT, and either one alone reopens the hole.

### The rule that makes any of this worth having
**Every gate must be proved to bite.** Plant the violation, watch the test fail,
restore. patent-agent has done this since day one via
`tools/gates/redaction-bites.mjs`. The layout invariants were checked the same
way: a clean /patents reports 0, and injecting `overflow-x: hidden` on the
table's container makes the rule name that exact element. A green test that cannot fail is worse than no test,
because it is believed.

### The invariant tier, and why it is not a screenshot diff
`qa/invariant/layout.qa.mjs` walks every page as every role at 1280x720 and
1440x900 and asserts rules that are true of any correct page — no reference
image anywhere.

That is deliberate. A pixel baseline tells you a page *changed*; every layout
bug this project actually shipped — the 64px overhang, the patents table wider
than the viewport, the unbounded awaiting-action list — was wrong the day it
was written. A baseline would have captured the bug and then defended it.

The rule that matters is **clipped-horizontal**: `overflow-x: hidden` with
`scrollWidth > clientWidth`, i.e. content that is cut off and unreachable. The
first version fired on any overflow at all and produced 402 violations across
62 pages, which is worse than useless. `overflow-x: visible` paints outside the
box and loses nothing; `auto`/`scroll` can be scrolled to; `text-overflow:
ellipsis` and `line-clamp` are deliberate truncation. Only `hidden` hides.

Sessions are cached in `qa/.sessions/` (gitignored, never artifacted — they are
live cookies). The login throttle is 5/5min/IP and there are exactly 5 roles,
so without caching any re-run inside the window fails every role.

### The journey tier, and what it refuses to do
`qa/journey/*.qa.mjs` is one file per role — the feature loops, against the
deployed demo, asserting state transitions rather than page loads. Shared
machinery is `qa/lib/session.mjs` (cached logins) and `qa/lib/journey.mjs` (the
step runner and the outcome assertions; there is deliberately no
`assertNoErrors`). A step returns a short evidence string or throws; the first
failure aborts the rest as `skip`, because the steps are causally linked and a
cascade of secondary failures hides which one was real. Teardown always runs.

**Writes are constrained by what the product can undo, not by what would be
convenient to test.** Three things on demo have no inverse and are therefore
asserted up to the point of commitment and no further: a submitted idea (the
backend refuses to delete one — review history must survive, so
`inventor.qa.mjs --submit` is opt-in and off by default), an instruction
submitted to Photon (no DELETE on actions, and the dialog says so itself), and a
committee/counsel decision (append-only). Everything the tier does create is
prefixed `QA-<timestamp>` and deleted in teardown — including after a failure,
and including a re-login if the 15-minute access cookie expired mid-run.

Both gates here were proved to bite by planting a violation: pointing the
inventor journey at a selector that does not exist, and asserting a state the
idea has not reached. The second one is why the status assertions are scoped to
named elements — the draft page's status timeline contains the words "Under
review" and "Filed" as *future* stages, so a whole-page text search cheerfully
"proved" a state the idea was nowhere near.

### The conformance tier, and the design repo it outlived
`qa/conformance/structure.qa.mjs` walks every role over every page and asserts
the page's **shape** against a committed snapshot in `qa/conformance/baseline/`:
ARIA roles, accessible names, heading levels, table column headers, section
order, and a curated computed-style projection (type scale, weight, colour,
radius, spacing, display/flex/grid) over the nodes that matched.

    node qa/conformance/structure.qa.mjs                    # check (exit 1 on drift)
    node qa/conformance/structure.qa.mjs --role INVENTOR --path /ideas
    node qa/conformance/structure.qa.mjs --update           # re-record, AFTER reading the diff
    node qa/conformance/structure.qa.mjs --base http://localhost:3800

It defaults to the deployed demo, like the other browser tiers. To check a
branch before it ships, run the app locally against the demo API and point the
tier at it — `VITE_PROXY_TARGET=https://demo-api.photonpulse.ai npx vite --port
3800`, then `--base http://localhost:3800`. Sessions are cached per base host,
so this does not poison the demo cache with cookies that cannot work there.
That is also how the committed baseline was recorded, and a local run against a
demo-recorded baseline differed by exactly the one intended change — the two
environments are structurally identical.

**Where the baseline came from.** A one-time reconciliation against the
designer's reference implementation (saurrx/pulse-design-auto @3f9b2fdb), which
was given for that exercise only and is now retired. The tool that did it
(`design-diff.mjs`) and its raw captures were removed once the reconciliation
was complete and its accepted deviations recorded in `qa/exceptions.json`
(atlas stale.md F7) — the committed conformance baseline is the ongoing truth,
and nothing in CI ever depended on the design repo.
Four of our six roles had a counterpart there (OC_ADMIN→PHOTON_ADMIN,
IHC_ADMIN→LEGAL_COUNSEL, CASE_OWNER, INVENTOR); TECH_COMMITTEE and
PHOTON_SUPERADMIN have none and were never compared.

**Why structure and not a screenshot.** The two apps shared no data, so a pixel
diff between them was 100% noise; and a pixel baseline of our own would capture
whatever is on screen and then defend it. Data is normalised away (dates,
numbers, ids, emails) and repeated record blocks are detected and anonymised, so
a new idea on demo does not move the file but a dropped column does. The rules
that keep that honest are commented in `qa/lib/conformance.mjs`: a
`columnheader` is never treated as row data, nothing inside a nav landmark is
anonymised, and a repeated block must start and end on content rather than on a
control — that last one because a "Review all" button next to a card list was
being swallowed, and the tier silently stopped asserting it.

**`--update` is the risk.** It will record a bug as the new truth. Read the diff
first, exactly as you would a snapshot test's. Legitimate reasons to re-record:
a deliberate UI change, or demo data changing shape. If a *name* moved and you
did not intend it, that is the finding.

**Proved to bite:** deleting the Due Dates `Action` column (the real bug this
tier exists for) and the Patents `Export CSV` button produced 17 failures across
9 surfaces — `table-columns … dropped=[action]`, `missing-signature:
columnheader:action`, `missing-signature: button:export csv` — exit 1; restoring
both returned it to 0.

### Running the browser tiers
All three — invariants, conformance, journeys — run in ONE CI job, in sequence,
and that is not tidiness. The login throttle is 5 requests / 5 min / IP. Two
parallel jobs on one runner, each logging in as five roles, is ten logins from
one address in about three minutes: the first tier passes and everything after
it gets a 429. That is exactly how the first scheduled run failed.

One job means one `qa/.sessions/` directory on one filesystem, so five logins
happen once and every tier after the first reuses them. Do not "parallelise"
them, and do not pass the cache between jobs as an artifact — those files are
live authentication cookies for the demo accounts and a CI artifact is
downloadable.

Locally the same applies: run them one after another, not concurrently.

### The lockfile trap (has bitten three times — now gated)
`npm install` can leave package.json and package-lock.json out of sync here, and
only `npm ci` notices — so it passes locally and fails in CI with
`Missing: yaml@2.9.0 from lock file`.

It is not random. `tailwindcss -> postcss-load-config` wants `yaml@^2` while
`cosmiconfig` (via react-select -> emotion -> babel-plugin-macros) wants
`yaml@^1`. npm hoists a single `yaml@1.10.3`, marks the tailwind branch invalid
— `npm ls yaml` exits ELSPROBLEMS — and a plain `npm install` does not always
record the nested v2 entry that `npm ci` then demands.

**After ANY dependency change:**

    rm -rf node_modules package-lock.json && npm install
    # then verify the way CI will, against COPIES of the manifests:
    mkdir /tmp/v && cp package.json package-lock.json /tmp/v && cd /tmp/v
    docker run --rm -v "$PWD:/w" -w /w node:22-slim npm ci

Copies, not the working tree: `npm ci` inside a Linux container against the
mounted tree installs Linux rollup binaries over the macOS ones and breaks your
local build. That has also happened.

Writing that procedure down did not stop the third occurrence, because nothing
ran it. `.githooks/pre-commit` now does, automatically and only when
`package.json` or `package-lock.json` is staged: it copies the **staged**
manifests out of the index and runs the real `npm ci` in `node:22-slim`. Enable
it per clone with `git config core.hooksPath .githooks`; `ALLOW_LOCK_UNVERIFIED=1`
skips it, and it also refuses (rather than passing quietly) when Docker is not
running.

**`npm ci --dry-run` is not a substitute** — measured, not assumed: on a lock
with the nested yaml entry deleted it exits 0 on macOS while `node:22-slim`
exits 1. It has to be the real command in the real image. See
pulse-backend/docs/qa/findings.md F-055.

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

Regenerate this repo's layer: `node qa/map/generate.mjs   (and qa/map/measure.mjs for the measured layer)`
