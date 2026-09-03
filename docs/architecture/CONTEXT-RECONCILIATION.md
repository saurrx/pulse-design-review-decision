# Context reconciliation

Where `product-context/` (authority 2), the architecture record (authority 3)
and the production base (authority 4) disagree, and how this repository
resolves it. Product truth wins; the repository adapts; a capability the
backend does not have is recorded as a backend finding, never faked.

Backend impact vocabulary: `none` (portable design change), `unwired` (the
backend has it, the frontend does not use it yet), `conceptual` (the backend
must change; the record ships as a proposal).

## R-01 Six backend roles, four V0 personas
- Product: exactly four personas (PERSONAS.md).
- Base: `UserRole` has six values; the fork's original wording said "all six roles".
- Resolution: the mock offers four personas signed in as INVENTOR,
  LEGAL_COUNSEL (Workspace Admin), CASE_OWNER and PHOTON_ADMIN. TECH_COMMITTEE
  and PHOTON_SUPERADMIN are not personas, scenarios or story subjects. Production
  routes for all six roles keep working (technical parity, crawled by the gates)
  because the redesign must not break a role the backend still issues.
- Impact: `none` for the design; a production finding that the two unused
  roles are candidates for retirement.

## R-02 One review stage
- Product: one Workspace Admin review; no technical/legal split (WORKFLOWS.md).
- Base: the backend runs TECH_REVIEW only when `client.has_tech_committee` is
  true; production UI still carries committee routes and "committee" copy.
- Resolution: every V0 scenario client has `has_tech_committee: false`; the
  review chain is LEGAL_REVIEW only; copy follows PRODUCT-VOCABULARY.md
  ("Submit for review", "Approve for filing", "Send to Photon Legal for
  filing?", "Approve & send", "Sent to Photon Legal").
- Impact: `none`. Committee code paths remain in `src/` untouched.

## R-03 Workspace Admin submits ideas, including on behalf of an inventor
- Product: Workspace Admin may submit own ideas and on behalf of a selected
  inventor, with Inventor and Submitted by shown separately.
- Base: `GRANTS.LEGAL_COUNSEL` has neither `idea:create` nor `idea:submit`,
  and no submitted-by attribution exists in the idea contract.
- Resolution: the Submit an idea surface for Workspace Admin is designed as a
  `conceptual` record. The mock does not grant what the backend does not grant.
- Impact: `conceptual`. Backend finding BF-1: grant creation and submission to
  LEGAL_COUNSEL with a separate submitter identity on the idea.

## R-04 Evaluation result shape
- Product: Assessment (0–10 plus meaning) → What appears different → How to
  strengthen → detailed prior art on demand; repeatable after edits; every
  score submittable; no cutoff (surfaces/evaluation.md).
- Base: `POST /v1/drafts/:id/evaluate`, `re-evaluate`, `GET evaluation` exist;
  the report envelope carries `scoringResult{score, noveltyScore,
  closestMatches[], recommendations, evaluationMetrics}` and `priorArt[]`. The
  preliminary `/signal` rail reports a state, never a grade, which is a
  different object from the evaluation and stays that way.
- Resolution: Assessment maps to `score`/`noveltyScore`, How to strengthen to
  `recommendations`, detailed prior art to `priorArt` and `closestMatches`.
  "What appears different" must come from per-reference differences; whether
  the envelope carries them per reference is verified in the evaluation
  record before the surface is called `none`.
- Impact: `none` if per-reference differences exist; otherwise `conceptual`
  (backend finding BF-2).

## R-05 General assistant page
- Product: a general-purpose AI chat assistant is not V0.
- Base: production routes `/assistant` to an assistant page; the fork's
  catalogue has "Screens/Assistant".
- Resolution: not a V0 surface. The story leaves the V0 catalogue; the route
  stays in `src/App.tsx` (off-limits path) and is a production finding to
  remove or gate.
- Impact: production finding, no design record.

## R-06 Navigation badges and labels
- Product: only the Workspace Admin pending-review count carries a badge;
  Actions get contextual alerts, never a badge; no notification bell.
- Base: production's Photon navigation puts a review-count badge on Ideas;
  first entries are labelled "Overview" for every role.
- Resolution: badge only for Workspace Admin; labels per SCREENS.md (Home,
  My Work, Dashboard). Portable change in the sidebar.
- Impact: `none`, with a fingerprint escalation because a role condition moves.

## R-07 World map on dashboards
- Product: no world map on any V0 dashboard; jurisdiction summaries and
  filters live in the Patent Portfolio.
- Base: the production dashboard renders a patent world map.
- Resolution: removed from every dashboard composition. The component stays
  in `src/` until the developer deletes it (production finding: dead code).
- Impact: `none`.

## R-08 Due dates by persona
- Product: Inventor never sees due dates or Actions; Workspace Admin sees dates
  inside Actions and patent detail and has no Due Dates destination; Case Owner
  and Photon Admin have Due Dates.
- Base: production's counsel navigation already labels `/due-dates` as
  "Actions"; whether patent detail shows dates to inventors is decided per
  component.
- Resolution: patent detail, dashboards and Actions hide date data by persona;
  the `/due-dates` path stays as a technical route for Workspace Admin. The
  backend serves scoped due dates and Actions to every authenticated role
  (section 8 of its instruction copy lists no capability on those reads) and
  production's dashboard shows upcoming due dates to inventors; the V0 mock
  refuses inventors under `flags.v0` as the declared policy BF-4, the legacy
  tier keeps serving them.
- Impact: `none` for the interface, fingerprint escalation on the role
  condition; backend finding BF-4: refuse due-date and Action reads to
  INVENTOR so the interface is not the only barrier.

## R-09 Client plans and pricing
- Product: no purchasing, checkout, billing or price selection.
- Base: `ClientPlan` (FREE, ENTERPRISE, PRODUCT_OWNER) exists and production
  client forms may expose it.
- Resolution: never surfaced in V0 screens; payloads keep the field untouched.
- Impact: `none`.

## R-10 Lifecycle states
- Product: Sent to Photon Legal → Filed → Granted or Closed; "Filing in
  progress" is not a state.
- Base: `IdeaState` ends at FILED; grant and closure live on the linked patent
  (`PatentStatus`).
- Resolution: Granted and Closed render from the linked patent; no new idea
  state. TECH_REVIEW is unused in V0 scenarios.
- Impact: `none`.

## R-11 Action statuses
- Product: Submitted / Acknowledged / In progress / Completed / Declined.
- Base: `ActionStatus` NEW, ACKNOWLEDGED, IN_PROGRESS, COMPLETED, DECLINED,
  NO_ACTION; `ActionSubmissionState` DRAFT, SUBMITTED, UPDATED.
- Resolution: label map only (NEW → Submitted). No conflict.
- Impact: `none`.

## R-12 Activation and reminder emails
- Product: the full email sequences are V0 requirements; preferences and
  unsubscribe controls where required.
- Base: the backend has no mailer ("deliberately absent").
- Resolution: the design repository covers the in-product preference
  controls on Profile only. Email sequences are backend finding BF-3.
- Impact: `conceptual` for preferences; email delivery is outside this repo.

## R-13 Supported widths
- Product: 1280×720, 1366×768, 1440×900, 1920×1080 and 200% zoom; desktop and
  laptop only.
- Base: the harness carries 1024 (production's desktop floor), 1280 and 1440.
- Resolution: keep 1024 for the technical desktop gate; add 1366 and 1920 and
  a 200% zoom parameter to the harness in a tooling PR.
- Impact: tooling.

## R-14 Story catalogue organisation
- Product: stories are defined by the surface briefs and their listed states.
- Architecture: the scaffold catalogue is organised by production screens for
  six roles (108 stories).
- Resolution: the V0 catalogue is built per surface brief under
  `design/stories/surfaces/`, four personas, states from each brief. The
  existing catalogue is retitled "Legacy reference" and kept only as the
  technical regression tier for the harness (screenshot, a11y and story-test
  baselines) until the V0 catalogue covers the same technical states, then
  removed. Decision pending in the report.
- Impact: review support only.

## Agreements worth naming
- Copilot rules match: production's autofill and Suggest refuse to author
  novelty and report a state, not a grade; V0 says never invent technical
  facts and keep human conception human.
- Inventors already see the Patents navigation in production.
- One-click view-as satisfies "Enter client view when authorized".
- Reference numbers only, never identifiers, in both rule sets.
- Fixtures are synthetic and deterministic in both rule sets.
