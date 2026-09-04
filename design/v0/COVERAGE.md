# V0 coverage matrix

Generated from `design/v0/coverage.json` by `tools/design/v0-coverage.mjs`; do not edit by hand. Product context version 1.0.0. One section per brief in product-context/surfaces. A story id is an intention: the story exists only when its DSN record creates the production-shaped component, and the `dsn` column stays empty until then.

## Personas and navigation

| Persona | Backend role | Navigation | Badge |
|---|---|---|---|
| Inventor | INVENTOR | Home · Ideas · Patents · Profile | none |
| Workspace Admin | LEGAL_COUNSEL | Home · Ideas · Patents · Actions · Workspace · Profile | Ideas: pending-review |
| Case Owner | CASE_OWNER | My Work · Clients · Ideas · Patents · Due Dates · Actions · Profile | none |
| Photon Admin | PHOTON_ADMIN | Dashboard · Clients · Ideas · Patents · Due Dates · Actions · Workspace · Profile | none |

Excluded from V0 everywhere: checkout, purchasing, billing, price selection, invoice, notification centre, notification bell, general assistant, trademark, cost visibility, score cutoff.

## Summary

| Surface | Personas | Routes | Scenarios | Story ids | Backend impact | DSN |
|---|---|---|---|---|---|---|
| Inventor home | Inventor | `/` | 4 | 10 | unwired |  |
| Start an idea | Inventor, Workspace Admin | `/ideas`, `/ideas/:id/draft` | 5 | 11 | conceptual |  |
| Invention disclosure workspace | Inventor, Workspace Admin | `/ideas/:id/draft` | 4 | 15 | unwired |  |
| Evaluation result | Inventor, Workspace Admin | `/ideas/:id/draft`, `/ideas/:id` | 4 | 12 | none |  |
| Ideas list | Inventor, Workspace Admin, Case Owner, Photon Admin | `/ideas` | 8 | 11 | none |  |
| Idea detail and status | Inventor, Workspace Admin, Case Owner, Photon Admin | `/ideas/:id` | 6 | 17 | conceptual |  |
| Review decision | Workspace Admin | `/ideas/:id` | 3 | 12 | none |  |
| Workspace Admin dashboard | Workspace Admin | `/` | 10 | 17 | conceptual | DSN-0002 |
| Patent portfolio | Inventor, Workspace Admin, Case Owner, Photon Admin | `/patents` | 7 | 12 | none |  |
| Patent detail | Inventor, Workspace Admin, Case Owner, Photon Admin | `/patents/:patentId` | 6 | 15 | unwired |  |
| Actions | Workspace Admin, Case Owner, Photon Admin | `/due-dates`, `/actions` | 5 | 14 | none |  |
| Photon due dates | Case Owner, Photon Admin | `/due-dates` | 5 | 10 | none |  |
| Workspace, people and profile | Workspace Admin, Inventor, Case Owner, Photon Admin | `/workspace`, `/profile` | 6 | 12 | unwired |  |
| Case Owner my work | Case Owner | `/` | 3 | 9 | unwired |  |
| Clients and onboarding | Case Owner, Photon Admin | `/clients` | 4 | 12 | none |  |
| Photon Admin dashboard | Photon Admin | `/` | 3 | 9 | unwired |  |
| Authentication and access | Inventor, Workspace Admin, Case Owner, Photon Admin | `/login`, `/signup`, `/i/:inviteCode`, `/invite`, `/forgot-password`, `/reset-password`, `/auth/saml/callback` | 3 | 11 | none |  |

17 surfaces, 209 intended stories, 17 V0 scenarios; backend impact conceptual on 3, unwired on 6, none on 8.

## Inventor home

Brief: `product-context/surfaces/inventor-home.md` · Storybook title: `Surfaces/Inventor home` · DSN: none yet

- **Personas:** Inventor
- **User goal:** Start an idea or understand what happened to existing ideas.
- **Business goal:** Increase submission starts and inventor participation.
- **Routes:** `/` (Inventor) — production's inventor dashboard route
- **Required scenarios:** `v0/inventor/first-run`, `v0/inventor/portfolio`, `v0/shape/slow`, `v0/shape/failure`
- **States:** loading — skeleton that resembles the final composition; empty — no ideas yet: Submit an idea leads, momentum shows the workspace; success — ideas with statuses and next steps, one active draft to continue; error — ideas unavailable, Submit an idea still works; permission — not applicable: every inventor reaches home
- **Surface-specific states:** first-run, invited-inactive, no-ideas, active-draft, several-statuses, requested-changes, recent-submission, evaluation-available
- **Navigation badge:** none
- **Backend impact:** unwired — Collective momentum (submissions this quarter, ideas that reached filing) needs workspace counts by period; GET /v1/dashboard-style aggregates exist for pipeline counts, a period breakdown is not exposed today.
- **Intended story ids:** `surfaces-inventor-home--first-run`, `surfaces-inventor-home--invited-inactive`, `surfaces-inventor-home--no-ideas`, `surfaces-inventor-home--active-draft`, `surfaces-inventor-home--several-statuses`, `surfaces-inventor-home--requested-changes`, `surfaces-inventor-home--recent-submission`, `surfaces-inventor-home--evaluation-available`, `surfaces-inventor-home--loading`, `surfaces-inventor-home--error`
- **Excluded here:** due dates, Actions, firm administration, generic patent totals, equal-weight card grid, named inventor ranking

## Start an idea

Brief: `product-context/surfaces/start-idea.md` · Storybook title: `Surfaces/Start an idea` · DSN: none yet

- **Personas:** Inventor, Workspace Admin
- **User goal:** Move from 'I may have an invention' to a useful starting disclosure with almost no blank-page friction.
- **Business goal:** Increase submission-start rate.
- **Routes:** `/ideas` (Inventor, Workspace Admin) — production starts an idea from the ideas page; the V0 entry point is the Submit an idea action; `/ideas/:id/draft` (Inventor, Workspace Admin) — the transition target once material is organised
- **Required scenarios:** `v0/inventor/first-run`, `v0/inventor/portfolio`, `v0/workspace-admin/queue`, `v0/shape/slow`, `v0/shape/failure`
- **States:** loading — parsing pasted or uploaded material with visible progress; empty — plain invitation to describe or bring the idea; paste and upload lead; success — material organised into a structured disclosure with continuity from source to prefilled answers; error — extraction failure or unsupported file with the material preserved; permission — Workspace Admin on behalf of an inventor is conceptual until the backend grants creation and submission to LEGAL_COUNSEL
- **Surface-specific states:** empty, dragging-file, parsing, partial-extraction, unsupported-file, extraction-failure, duplicate-warning, transition-to-disclosure, on-behalf-inventor-selection
- **Navigation badge:** none
- **Backend impact:** conceptual — Prefill from source material uses POST /v1/drafts/:id/autofill and file upload (exists). Workspace Admin submitting on behalf of a selected inventor needs idea:create and idea:submit for LEGAL_COUNSEL plus a submitter identity on the idea (BF-1); the mock models it behind mock/proposed-fields.json.
- **Intended story ids:** `surfaces-start-an-idea--empty`, `surfaces-start-an-idea--dragging-file`, `surfaces-start-an-idea--parsing`, `surfaces-start-an-idea--partial-extraction`, `surfaces-start-an-idea--unsupported-file`, `surfaces-start-an-idea--extraction-failure`, `surfaces-start-an-idea--duplicate-warning`, `surfaces-start-an-idea--transition-to-disclosure`, `surfaces-start-an-idea--on-behalf`, `surfaces-start-an-idea--loading`, `surfaces-start-an-idea--error`
- **Excluded here:** long questionnaire first, patent jargon, mandatory evaluation language, decorative upload animation, AI inventing missing facts

## Invention disclosure workspace

Brief: `product-context/surfaces/disclosure-workspace.md` · Storybook title: `Surfaces/Invention disclosure workspace` · DSN: none yet

- **Personas:** Inventor, Workspace Admin
- **User goal:** Complete a credible invention disclosure without needing patent expertise.
- **Business goal:** Increase draft completion and completed-to-submitted conversion.
- **Routes:** `/ideas/:id/draft` (Inventor, Workspace Admin) — production's draft workspace route
- **Required scenarios:** `v0/inventor/first-run`, `v0/inventor/portfolio`, `v0/shape/slow`, `v0/shape/failure`
- **States:** loading — draft loading; sections keep their shape; empty — new disclosure with no prefilled answer; success — complete disclosure ready to submit; Submit for review leads, Evaluate idea visibly optional; error — save failed with entered work preserved; evaluation failed; permission — a Workspace Admin editing an inventor's submitted content is refused; on-behalf drafting is conceptual
- **Surface-specific states:** empty, partially-prefilled, unsupported-gaps, saving, saved, offline, conflict, complete, evaluation-running, evaluation-result, evaluation-stale, requested-changes, resubmission
- **Navigation badge:** none
- **Backend impact:** unwired — Drafts, autosave, evaluate, re-evaluate, autofill and suggest exist. Per-answer provenance (AI-drafted, edited, human) and a version history that freezes the reviewed revision are not stored today; the mock keeps revision numbers on transitions only.
- **Intended story ids:** `surfaces-invention-disclosure-workspace--empty`, `surfaces-invention-disclosure-workspace--partially-prefilled`, `surfaces-invention-disclosure-workspace--unsupported-gaps`, `surfaces-invention-disclosure-workspace--saving`, `surfaces-invention-disclosure-workspace--saved`, `surfaces-invention-disclosure-workspace--offline`, `surfaces-invention-disclosure-workspace--conflict`, `surfaces-invention-disclosure-workspace--complete`, `surfaces-invention-disclosure-workspace--evaluation-running`, `surfaces-invention-disclosure-workspace--evaluation-result`, `surfaces-invention-disclosure-workspace--evaluation-stale`, `surfaces-invention-disclosure-workspace--requested-changes`, `surfaces-invention-disclosure-workspace--resubmission`, `surfaces-invention-disclosure-workspace--loading`, `surfaces-invention-disclosure-workspace--error`
- **Excluded here:** evaluation as a gate, nagging when submitting without evaluation, AI-authored novelty

## Evaluation result

Brief: `product-context/surfaces/evaluation.md` · Storybook title: `Surfaces/Evaluation result` · DSN: none yet

- **Personas:** Inventor, Workspace Admin
- **User goal:** Understand the advisory novelty assessment and strengthen the disclosure.
- **Business goal:** Help inventors submit stronger disclosures without reducing submission volume.
- **Routes:** `/ideas/:id/draft` (Inventor) — evaluation is opened from the disclosure workspace; `/ideas/:id` (Inventor, Workspace Admin) — the summary and detailed evidence on the idea
- **Required scenarios:** `v0/inventor/first-run`, `v0/inventor/portfolio`, `v0/shape/failure`, `v0/shape/slow`
- **States:** loading — queued and running with progress; empty — not run: Evaluate idea offered, never required; success — assessment, what appears different, how to strengthen; detailed prior art collapsed; error — failed or timed out with a retry that keeps the disclosure; permission — not applicable inside the inventor's own idea
- **Surface-specific states:** not-run, queued, running, succeeded, partial, no-close-prior-art, failed, timed-out, stale-after-edits, re-evaluating
- **Navigation badge:** none
- **Backend impact:** none — POST evaluate, POST re-evaluate and GET evaluation exist; the envelope carries score, noveltyScore, closestMatches, recommendations, priorArt. Whether closestMatches carries per-reference differences for 'What appears different' is verified in the evaluation record (BF-2 if not).
- **Intended story ids:** `surfaces-evaluation-result--not-run`, `surfaces-evaluation-result--queued`, `surfaces-evaluation-result--running`, `surfaces-evaluation-result--succeeded`, `surfaces-evaluation-result--partial`, `surfaces-evaluation-result--no-close-prior-art`, `surfaces-evaluation-result--failed`, `surfaces-evaluation-result--timed-out`, `surfaces-evaluation-result--stale-after-edits`, `surfaces-evaluation-result--re-evaluating`, `surfaces-evaluation-result--loading`, `surfaces-evaluation-result--error`
- **Excluded here:** score cutoff, probability language, repeated disclaimers, detailed evidence before the conclusion

## Ideas list

Brief: `product-context/surfaces/ideas.md` · Storybook title: `Surfaces/Ideas list` · DSN: none yet

- **Personas:** Inventor, Workspace Admin, Case Owner, Photon Admin
- **User goal:** Inventor: find own drafts and submissions and their next step. Workspace Admin: clear pending reviews. Case Owner: find approved ideas from assigned clients. Photon Admin: oversee ideas sent to Photon across clients.
- **Business goal:** Faster review and a clear next step for every idea.
- **Routes:** `/ideas` (Inventor, Workspace Admin, Case Owner, Photon Admin)
- **Required scenarios:** `v0/inventor/portfolio`, `v0/workspace-admin/queue`, `v0/workspace-admin/empty`, `v0/case-owner/my-work`, `v0/photon-admin/firm`, `v0/shape/large`, `v0/shape/slow`, `v0/shape/failure`
- **States:** loading — table skeleton with the persona's columns; empty — no ideas, drafts only, or a filter that matches nothing; success — mixed statuses sorted by the persona's job; pending review oldest first with days waiting; error — list unavailable with retry; permission — inventors see own and credited ideas only; case owners assigned clients only
- **Surface-specific states:** empty, drafts-only, mixed-statuses, long-titles, large-queue, filtered-empty, requested-changes, evaluation-running
- **Navigation badge:** pending-review for Workspace Admin
- **Backend impact:** none — GET /v1/ideas with state filters and paging exists.
- **Intended story ids:** `surfaces-ideas-list--inventor-empty`, `surfaces-ideas-list--inventor-drafts-only`, `surfaces-ideas-list--inventor-mixed`, `surfaces-ideas-list--workspace-admin-pending`, `surfaces-ideas-list--workspace-admin-large-queue`, `surfaces-ideas-list--workspace-admin-filtered-empty`, `surfaces-ideas-list--case-owner`, `surfaces-ideas-list--photon-admin`, `surfaces-ideas-list--long-titles`, `surfaces-ideas-list--loading`, `surfaces-ideas-list--error`
- **Excluded here:** preview step before opening a record, badges for any persona but Workspace Admin

## Idea detail and status

Brief: `product-context/surfaces/idea-detail.md` · Storybook title: `Surfaces/Idea detail and status` · DSN: none yet

- **Personas:** Inventor, Workspace Admin, Case Owner, Photon Admin
- **User goal:** Understand the invention disclosure, its evidence, history, ownership and current next step.
- **Business goal:** Confidence after submission and review; a usable filing brief for Photon.
- **Routes:** `/ideas/:id` (Inventor, Workspace Admin, Case Owner, Photon Admin)
- **Required scenarios:** `v0/inventor/portfolio`, `v0/workspace-admin/queue`, `v0/case-owner/my-work`, `v0/photon-admin/firm`, `v0/shape/slow`, `v0/shape/failure`
- **States:** loading — reference and title first, sections follow; empty — no evaluation yet; no attachments; success — every state of the V0 lifecycle with the next step named; error — record unavailable; attachment download failed; permission — an idea outside the caller's scope is refused; role-specific actions hidden
- **Surface-specific states:** draft, evaluated, submitted, under-review, changes-requested, rejected, resubmitted, sent-to-photon, filed, granted, closed, missing-evaluation, partial-evaluation, on-behalf-attribution
- **Navigation badge:** none
- **Backend impact:** conceptual — Separate Inventor and Submitted by attribution needs a submitter identity on the idea (BF-1, modelled as submitted_by_id in mock/proposed-fields.json). Granted and Closed render from the linked patent (POST /v1/patents/:id/link-idea exists).
- **Intended story ids:** `surfaces-idea-detail-and-status--draft`, `surfaces-idea-detail-and-status--evaluated`, `surfaces-idea-detail-and-status--submitted`, `surfaces-idea-detail-and-status--under-review`, `surfaces-idea-detail-and-status--changes-requested`, `surfaces-idea-detail-and-status--rejected`, `surfaces-idea-detail-and-status--resubmitted`, `surfaces-idea-detail-and-status--sent-to-photon`, `surfaces-idea-detail-and-status--filed`, `surfaces-idea-detail-and-status--granted`, `surfaces-idea-detail-and-status--closed`, `surfaces-idea-detail-and-status--missing-evaluation`, `surfaces-idea-detail-and-status--partial-evaluation`, `surfaces-idea-detail-and-status--on-behalf-attribution`, `surfaces-idea-detail-and-status--loading`, `surfaces-idea-detail-and-status--error`, `surfaces-idea-detail-and-status--permission-denied`
- **Excluded here:** questionnaire as one wall, repeated score, internal ids, actions unavailable to the role

## Review decision

Brief: `product-context/surfaces/review-decision.md` · Storybook title: `Surfaces/Review decision` · DSN: none yet

- **Personas:** Workspace Admin
- **User goal:** Understand an invention quickly enough to make a defensible client decision.
- **Business goal:** Faster review and more suitable ideas sent to Photon Legal.
- **Routes:** `/ideas/:id` (Workspace Admin) — one decision workspace on the idea; no preview screen
- **Required scenarios:** `v0/workspace-admin/queue`, `v0/shape/slow`, `v0/shape/failure`
- **States:** loading — decision in progress keeps the button label and shows activity; empty — no evaluation: decide from the disclosure; success — Approve & send confirmed; status Sent to Photon Legal; error — decision failed with retry, reason preserved; permission — a second Workspace Admin sees the recorded outcome and actor
- **Surface-specific states:** typical, no-evaluation, partial-evaluation, long-disclosure, missing-detail, decision-in-progress, concurrent-decision-completed, approve-confirmation, request-changes, reject
- **Navigation badge:** none
- **Backend impact:** none — POST /v1/drafts/:id/review with APPROVED, CHANGES_REQUESTED or REJECTED exists; APPROVED at the legal stage moves the idea to SENT_TO_PHOTON. Transitions carry the actor for the concurrent-decision state.
- **Intended story ids:** `surfaces-review-decision--typical`, `surfaces-review-decision--no-evaluation`, `surfaces-review-decision--partial-evaluation`, `surfaces-review-decision--long-disclosure`, `surfaces-review-decision--missing-detail`, `surfaces-review-decision--decision-in-progress`, `surfaces-review-decision--concurrent-decision-completed`, `surfaces-review-decision--approve-confirmation`, `surfaces-review-decision--request-changes`, `surfaces-review-decision--reject`, `surfaces-review-decision--success`, `surfaces-review-decision--failure-retry`
- **Excluded here:** preview screen, silent edits to inventor content, technical and legal review stages

## Workspace Admin dashboard

Brief: `product-context/surfaces/workspace-admin-dashboard.md` · Storybook title: `Surfaces/Workspace Admin dashboard` · DSN: DSN-0002

- **Personas:** Workspace Admin
- **User goal:** Clear the review queue and understand whether the invention program is moving.
- **Business goal:** Reduce submission-to-decision time and increase ideas sent to Photon.
- **Routes:** `/` (Workspace Admin)
- **Required scenarios:** `v0/workspace-admin/queue`, `v0/workspace-admin/empty`, `v0/workspace-admin/one-urgent-review`, `v0/workspace-admin/large-aging-queue`, `v0/workspace-admin/no-actions-due`, `v0/workspace-admin/quiet-quarter`, `v0/workspace-admin/empty-portfolio`, `v0/workspace-admin/single-inventor`, `v0/workspace-admin/long-titles`, `v0/shape/slow`
- **States:** loading — stat strip skeleton at final size, then the queue; the map loads last; empty — no pending reviews; no Actions due; no submissions this quarter in Top inventors; empty portfolio; one inventor; success — five scoped stat boxes (awaiting review with oldest wait, Actions due in 30 days, total patents, granted, pending patents), Patents worldwide, Top inventors by period, Review Inventor Ideas oldest first, Idea pipeline; error — overview numbers unavailable with retry; the queue still loads independently; permission — Workspace Admin only; dates appear only in the Actions box
- **Surface-specific states:** typical, no-pending-reviews, one-urgent-review, large-aging-queue, no-actions-due, no-submissions-this-quarter, empty-portfolio, single-inventor, long-titles, loading, data-unavailable, widths, zoom-200, reduced-motion
- **Navigation badge:** none
- **Backend impact:** conceptual — BF-5: GET /v1/dashboard needs workspace-scoped aggregates (awaiting review and oldest wait, Actions due in 30 days and next date, submissions per calendar quarter with the prior-quarter delta, patents filed this quarter, patents by jurisdiction, top inventors per period), each exposing the filter its number links to. Pipeline counts and patent totals exist today.
- **Intended story ids:** `surfaces-workspace-admin-dashboard--typical`, `surfaces-workspace-admin-dashboard--no-pending-reviews`, `surfaces-workspace-admin-dashboard--one-urgent-review`, `surfaces-workspace-admin-dashboard--large-aging-queue`, `surfaces-workspace-admin-dashboard--no-actions-due`, `surfaces-workspace-admin-dashboard--no-submissions-this-quarter`, `surfaces-workspace-admin-dashboard--empty-portfolio`, `surfaces-workspace-admin-dashboard--single-inventor`, `surfaces-workspace-admin-dashboard--long-titles`, `surfaces-workspace-admin-dashboard--loading`, `surfaces-workspace-admin-dashboard--data-unavailable`, `surfaces-workspace-admin-dashboard--width-1280`, `surfaces-workspace-admin-dashboard--width-1366`, `surfaces-workspace-admin-dashboard--width-1440`, `surfaces-workspace-admin-dashboard--width-1920`, `surfaces-workspace-admin-dashboard--zoom-200`, `surfaces-workspace-admin-dashboard--reduced-motion`
- **Excluded here:** cost analytics, aggregate metrics before pending reviews, cumulative ideas and filings chart, portfolio donut, not-yet-active list and nudge, due-dates timeline

## Patent portfolio

Brief: `product-context/surfaces/patent-portfolio.md` · Storybook title: `Surfaces/Patent portfolio` · DSN: none yet

- **Personas:** Inventor, Workspace Admin, Case Owner, Photon Admin
- **User goal:** Understand the company's patent assets and find a specific record quickly.
- **Business goal:** Portfolio visibility that supports the service relationship and shows inventors that invention is valued.
- **Routes:** `/patents` (Inventor, Workspace Admin, Case Owner, Photon Admin)
- **Required scenarios:** `v0/inventor/portfolio`, `v0/workspace-admin/queue`, `v0/case-owner/my-work`, `v0/photon-admin/firm`, `v0/shape/large`, `v0/shape/slow`, `v0/shape/failure`
- **States:** loading — table and summary skeletons; empty — empty imported portfolio; filter matches nothing; success — typical and thousands of records, jurisdiction distribution as counts and filters; error — list unavailable; import reported errors; permission — Inventor and Workspace Admin read-only, no import; upcoming-date indicator hidden from Inventor
- **Surface-specific states:** empty-imported-portfolio, typical, thousands-of-records, long-titles, multiple-jurisdictions, filtered-empty, import-result
- **Navigation badge:** none
- **Backend impact:** none — GET /v1/patents with paging, stats, tags, export and import exist.
- **Intended story ids:** `surfaces-patent-portfolio--inventor`, `surfaces-patent-portfolio--workspace-admin`, `surfaces-patent-portfolio--case-owner`, `surfaces-patent-portfolio--photon-admin`, `surfaces-patent-portfolio--empty-imported-portfolio`, `surfaces-patent-portfolio--thousands-of-records`, `surfaces-patent-portfolio--long-titles`, `surfaces-patent-portfolio--multiple-jurisdictions`, `surfaces-patent-portfolio--filtered-empty`, `surfaces-patent-portfolio--import-result`, `surfaces-patent-portfolio--loading`, `surfaces-patent-portfolio--error`
- **Excluded here:** every field at once, import for client personas

## Patent detail

Brief: `product-context/surfaces/patent-detail.md` · Storybook title: `Surfaces/Patent detail` · DSN: none yet

- **Personas:** Inventor, Workspace Admin, Case Owner, Photon Admin
- **User goal:** Understand one patent's identity, legal and lifecycle state, family, documents and relationship to the originating idea.
- **Business goal:** Lifecycle visibility without an internal IP operations team.
- **Routes:** `/patents/:patentId` (Inventor, Workspace Admin, Case Owner, Photon Admin)
- **Required scenarios:** `v0/inventor/portfolio`, `v0/workspace-admin/queue`, `v0/case-owner/my-work`, `v0/photon-admin/firm`, `v0/shape/slow`, `v0/shape/failure`
- **States:** loading — identity first, sections follow; empty — incomplete imported record; no originating idea; no documents; success — pending, filed, granted, inactive, closed with the lifecycle timeline; error — record unavailable; permission — Inventor read-only with no dates; Workspace Admin read-only with contextual dates and Actions; Photon roles edit
- **Surface-specific states:** pending, filed, granted, inactive, closed, incomplete-imported-record, multiple-family-members, no-originating-idea, many-documents, upcoming-event
- **Navigation badge:** none
- **Backend impact:** unwired — GET and PATCH /v1/patents/:id exist with family and timeline fields; documents attached to a patent are not modelled beyond import files today.
- **Intended story ids:** `surfaces-patent-detail--inventor`, `surfaces-patent-detail--workspace-admin-upcoming-event`, `surfaces-patent-detail--case-owner-editor`, `surfaces-patent-detail--photon-admin-editor`, `surfaces-patent-detail--pending`, `surfaces-patent-detail--filed`, `surfaces-patent-detail--granted`, `surfaces-patent-detail--inactive`, `surfaces-patent-detail--closed`, `surfaces-patent-detail--incomplete-imported-record`, `surfaces-patent-detail--multiple-family-members`, `surfaces-patent-detail--no-originating-idea`, `surfaces-patent-detail--many-documents`, `surfaces-patent-detail--loading`, `surfaces-patent-detail--error`
- **Excluded here:** due dates shown to Inventors, equal-weight sections, raw database fields, duplicated status

## Actions

Brief: `product-context/surfaces/actions.md` · Storybook title: `Surfaces/Actions` · DSN: none yet

- **Personas:** Workspace Admin, Case Owner, Photon Admin
- **User goal:** Workspace Admin: decide and submit the client's instruction for an upcoming patent event. Case Owner and Photon Admin: receive, process and update client requests.
- **Business goal:** Reduce coordination delay between the client's instruction and Photon's operational response.
- **Routes:** `/due-dates` (Workspace Admin) — production's client Actions page lives on this path; V0 offers it as Actions and adds no Due Dates destination; `/actions` (Case Owner, Photon Admin)
- **Required scenarios:** `v0/workspace-admin/queue`, `v0/case-owner/my-work`, `v0/photon-admin/firm`, `v0/shape/slow`, `v0/shape/failure`
- **States:** loading — queue skeleton ordered by urgency; empty — no upcoming event needing an instruction; success — saved draft, submitted, updated; Photon side acknowledged, in progress, completed, declined; error — submission error with the instruction preserved; missing template or configuration; permission — Inventor is refused; every status names who owns the next step
- **Surface-specific states:** no-action, action-required, saved-draft, submitted, updated, acknowledged, in-progress, completed, declined, overdue, missing-template
- **Navigation badge:** none
- **Backend impact:** none — Templates, queue, submit-all, decide, request-status and resolve exist.
- **Intended story ids:** `surfaces-actions--workspace-admin-action-required`, `surfaces-actions--workspace-admin-saved-draft`, `surfaces-actions--workspace-admin-submitted`, `surfaces-actions--workspace-admin-updated`, `surfaces-actions--workspace-admin-no-action`, `surfaces-actions--photon-acknowledged`, `surfaces-actions--photon-in-progress`, `surfaces-actions--photon-completed`, `surfaces-actions--photon-declined`, `surfaces-actions--photon-overdue`, `surfaces-actions--missing-template`, `surfaces-actions--submission-error`, `surfaces-actions--loading`, `surfaces-actions--inventor-refused`
- **Excluded here:** purchasing, checkout, pricing, invoice controls, navigation badge, client Due Dates navigation

## Photon due dates

Brief: `product-context/surfaces/due-dates.md` · Storybook title: `Surfaces/Photon due dates` · DSN: none yet

- **Personas:** Case Owner, Photon Admin
- **User goal:** Find upcoming or overdue client patent events and maintain accurate visibility.
- **Business goal:** Nothing is missed across assigned or all clients.
- **Routes:** `/due-dates` (Case Owner, Photon Admin)
- **Required scenarios:** `v0/case-owner/my-work`, `v0/photon-admin/firm`, `v0/shape/large`, `v0/shape/slow`, `v0/shape/failure`
- **States:** loading — urgency list skeleton; empty — no upcoming dates; success — upcoming, due soon, overdue, completed, large same-day groups; calendar secondary; error — list unavailable; import problem flagged on a row; permission — Workspace Admin sees dates only in Actions and patent detail; Inventor never
- **Surface-specific states:** upcoming, due-soon, overdue, completed, missing-date, import-problem, large-same-day-group, no-upcoming-dates
- **Navigation badge:** none
- **Backend impact:** none — GET /v1/due-dates with filters, PATCH status and remind exist. Data comes from manual update and spreadsheet import only.
- **Intended story ids:** `surfaces-photon-due-dates--upcoming`, `surfaces-photon-due-dates--due-soon`, `surfaces-photon-due-dates--overdue`, `surfaces-photon-due-dates--completed`, `surfaces-photon-due-dates--missing-date`, `surfaces-photon-due-dates--import-problem`, `surfaces-photon-due-dates--large-same-day-group`, `surfaces-photon-due-dates--no-upcoming-dates`, `surfaces-photon-due-dates--loading`, `surfaces-photon-due-dates--error`
- **Excluded here:** docketing integration, calendar hiding the actionable queue

## Workspace, people and profile

Brief: `product-context/surfaces/workspace.md` · Storybook title: `Surfaces/Workspace, people and profile` · DSN: none yet

- **Personas:** Workspace Admin, Inventor, Case Owner, Photon Admin
- **User goal:** Configure the organization and get inventors participating; keep personal profile and preferences distinct.
- **Business goal:** More eligible inventors enter the workspace and begin submissions.
- **Routes:** `/workspace` (Workspace Admin, Photon Admin); `/profile` (Inventor, Workspace Admin, Case Owner, Photon Admin)
- **Required scenarios:** `v0/workspace-admin/empty`, `v0/workspace-admin/queue`, `v0/inventor/portfolio`, `v0/photon-admin/firm`, `v0/shape/failure`, `v0/shape/slow`
- **States:** loading — people list skeleton; empty — new workspace; no inventors; success — active team, invitations pending, share link and QR, bulk email paste, CSV import result; error — save error; CSV errors; domain conflict; permission — Inventor sees Profile only; Case Owner adds Workspace Admins and invites inventors on assigned clients
- **Surface-specific states:** new-workspace, no-inventors, invitations-pending, active-team, expired-link, csv-errors, suspended-user, domain-conflict, save-error, profile, email-preferences
- **Navigation badge:** none
- **Backend impact:** unwired — Invites, share link, users, client configuration and notification preferences exist; bulk email paste and inventor CSV import compose the existing invite API; email preference categories beyond the three stored flags are conceptual (BF-3).
- **Intended story ids:** `surfaces-workspace-people-and-profile--new-workspace`, `surfaces-workspace-people-and-profile--no-inventors`, `surfaces-workspace-people-and-profile--invitations-pending`, `surfaces-workspace-people-and-profile--active-team`, `surfaces-workspace-people-and-profile--expired-link`, `surfaces-workspace-people-and-profile--csv-errors`, `surfaces-workspace-people-and-profile--suspended-user`, `surfaces-workspace-people-and-profile--domain-conflict`, `surfaces-workspace-people-and-profile--save-error`, `surfaces-workspace-people-and-profile--profile`, `surfaces-workspace-people-and-profile--email-preferences`, `surfaces-workspace-people-and-profile--loading`
- **Excluded here:** notification centre, plan or price selection

## Case Owner my work

Brief: `product-context/surfaces/case-owner-my-work.md` · Storybook title: `Surfaces/Case Owner my work` · DSN: none yet

- **Personas:** Case Owner
- **User goal:** Know which assigned client needs attention and move approved work forward.
- **Business goal:** Reduce coordination delay between client approval and Photon service delivery.
- **Routes:** `/` (Case Owner) — production's Photon overview route
- **Required scenarios:** `v0/case-owner/my-work`, `v0/shape/slow`, `v0/shape/failure`
- **States:** loading — work list first; empty — no assigned clients; success — approved ideas newly sent to Photon, urgent Actions and dates, onboarding tasks, client health; error — data error with scope still visible; permission — assigned clients only; client view visibly distinct and easy to exit
- **Surface-specific states:** no-assigned-clients, newly-assigned-client, new-approved-idea, urgent-action, overdue-date, onboarding-incomplete, access-expired, data-error
- **Navigation badge:** none
- **Backend impact:** unwired — Composed from ideas, actions, due dates and clients lists that exist; no dedicated aggregate.
- **Intended story ids:** `surfaces-case-owner-my-work--no-assigned-clients`, `surfaces-case-owner-my-work--newly-assigned-client`, `surfaces-case-owner-my-work--new-approved-idea`, `surfaces-case-owner-my-work--urgent-action`, `surfaces-case-owner-my-work--overdue-date`, `surfaces-case-owner-my-work--onboarding-incomplete`, `surfaces-case-owner-my-work--access-expired`, `surfaces-case-owner-my-work--data-error`, `surfaces-case-owner-my-work--loading`
- **Excluded here:** global client ranking

## Clients and onboarding

Brief: `product-context/surfaces/clients-and-onboarding.md` · Storybook title: `Surfaces/Clients and onboarding` · DSN: none yet

- **Personas:** Case Owner, Photon Admin
- **User goal:** Find an assigned or any client, understand its setup, and complete onboarding.
- **Business goal:** Clients become ready faster: admin invited, inventors invited, portfolio imported.
- **Routes:** `/clients` (Case Owner, Photon Admin) — client detail and onboarding open from the list in production
- **Required scenarios:** `v0/case-owner/my-work`, `v0/photon-admin/firm`, `v0/shape/failure`, `v0/shape/slow`
- **States:** loading — compact client list skeleton; empty — no clients assigned; potential client without a workspace; success — ready client workspace with admins, participation, portfolio summary, import history, assignments; error — import duplicates or errors; save failed; permission — Case Owner assigned clients only; enter client view when authorized
- **Surface-specific states:** potential-client, new-client, no-admin, no-inventors, no-portfolio, import-in-progress, import-errors, ready, disabled, access-request
- **Navigation badge:** none
- **Backend impact:** none — Clients, case-owner assignments, users, invites and import exist. The plan field is never surfaced.
- **Intended story ids:** `surfaces-clients-and-onboarding--potential-client`, `surfaces-clients-and-onboarding--new-client`, `surfaces-clients-and-onboarding--no-admin`, `surfaces-clients-and-onboarding--no-inventors`, `surfaces-clients-and-onboarding--no-portfolio`, `surfaces-clients-and-onboarding--import-in-progress`, `surfaces-clients-and-onboarding--import-errors`, `surfaces-clients-and-onboarding--ready`, `surfaces-clients-and-onboarding--disabled`, `surfaces-clients-and-onboarding--access-request`, `surfaces-clients-and-onboarding--loading`, `surfaces-clients-and-onboarding--error`
- **Excluded here:** decorative client cards, plan or price selection

## Photon Admin dashboard

Brief: `product-context/surfaces/photon-admin-dashboard.md` · Storybook title: `Surfaces/Photon Admin dashboard` · DSN: none yet

- **Personas:** Photon Admin
- **User goal:** Ensure clients, ownership, incoming work and operational exceptions are under control across Photon Legal.
- **Business goal:** Convert more approved ideas into well-managed patent work without losing client ownership or data quality.
- **Routes:** `/` (Photon Admin)
- **Required scenarios:** `v0/photon-admin/firm`, `v0/shape/slow`, `v0/shape/failure`
- **States:** loading — exceptions first; empty — no exceptions; success — unassigned clients, newly approved ideas, urgent Actions and dates, configuration exceptions, compact totals; error — partial data with the missing source named; permission — not applicable
- **Surface-specific states:** healthy-operations, unassigned-client, aging-approved-ideas, urgent-actions, failed-import, missing-client-configuration, no-exceptions, partial-data
- **Navigation badge:** none
- **Backend impact:** unwired — Composed from lists that exist; firm totals and trends have no dedicated aggregate.
- **Intended story ids:** `surfaces-photon-admin-dashboard--healthy-operations`, `surfaces-photon-admin-dashboard--unassigned-client`, `surfaces-photon-admin-dashboard--aging-approved-ideas`, `surfaces-photon-admin-dashboard--urgent-actions`, `surfaces-photon-admin-dashboard--failed-import`, `surfaces-photon-admin-dashboard--missing-client-configuration`, `surfaces-photon-admin-dashboard--no-exceptions`, `surfaces-photon-admin-dashboard--partial-data`, `surfaces-photon-admin-dashboard--loading`
- **Excluded here:** cost or revenue analytics, vanity totals before work

## Authentication and access

Brief: `product-context/surfaces/authentication.md` · Storybook title: `Surfaces/Authentication and access` · DSN: none yet

- **Personas:** Inventor, Workspace Admin, Case Owner, Photon Admin
- **User goal:** Enter the correct workspace securely with minimal uncertainty.
- **Business goal:** More invited and domain-eligible inventors activate successfully.
- **Routes:** `/login` (Inventor, Workspace Admin, Case Owner, Photon Admin); `/signup` (Inventor, Workspace Admin) — domain-gated self-signup; `/i/:inviteCode` (Inventor, Workspace Admin) — invitation acceptance; `/invite` (Inventor, Workspace Admin); `/forgot-password` (Inventor, Workspace Admin, Case Owner, Photon Admin); `/reset-password` (Inventor, Workspace Admin, Case Owner, Photon Admin); `/auth/saml/callback` (Inventor, Workspace Admin, Case Owner, Photon Admin) — SSO return and failure
- **Required scenarios:** `v0/auth/failures`, `v0/inventor/first-run`, `v0/shape/slow`
- **States:** loading — authenticating with the chosen method; empty — default login with recommended methods and the email fallback; success — successful invitation acceptance; reset complete; error — invalid credentials, unknown domain, expired invitation, SSO unavailable or failed, with entered values preserved; permission — access denied and session expired explain the next step
- **Surface-specific states:** default, invalid-credentials, unknown-domain, expired-invitation, successful-invitation, sso-unavailable, sso-failure, reset-requested, reset-complete, session-expired
- **Navigation badge:** none
- **Backend impact:** none — Password, Google, Microsoft and SAML providers, signup with domain check, invites, forgot and reset exist. Authentication errors never reveal whether an account exists.
- **Intended story ids:** `surfaces-authentication-and-access--default`, `surfaces-authentication-and-access--loading`, `surfaces-authentication-and-access--invalid-credentials`, `surfaces-authentication-and-access--unknown-domain`, `surfaces-authentication-and-access--expired-invitation`, `surfaces-authentication-and-access--successful-invitation`, `surfaces-authentication-and-access--sso-unavailable`, `surfaces-authentication-and-access--sso-failure`, `surfaces-authentication-and-access--reset-requested`, `surfaces-authentication-and-access--reset-complete`, `surfaces-authentication-and-access--session-expired`
- **Excluded here:** empty half-page where a brand panel was, four actions with equal weight
