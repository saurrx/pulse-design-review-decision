# V0 screen run — conditions, order and how it runs unattended

The run is unattended and merges into `main` (founder decision, 2026-09-04:
this repository exists only to run to completion). Three committed pieces
make it not stop:

- `.claude/settings.json` **Stop hook** — the completion gate. Every session
  on this repository, web or routine, is held in the turn until the current
  surface is complete (the condition below), the run is finished, `AGENT_STOP`
  exists, another session holds the surface, or the session is blocked after
  retries. No one needs to type `/goal`; the goal is in the repo.
- **verify-gate** — `design/v0/coverage.json` (the ledger) cannot be edited
  until the session has opened at least two screenshots of the surface with
  the Read tool.
- **The routine** (`ROUTINE-PROMPT.md`) — a Claude Code cloud routine firing
  every 30 minutes (hourly if the plan refuses) on `main`. Each firing is a
  fresh VM and a fresh context: it yields if another firing committed in the
  last 25 minutes, otherwise resumes the in-progress surface or starts the
  next one, and keeps going surface after surface until stopped. Expiry,
  crashes, compaction, rate limits and the Stop hook's 8-block cap all just
  mean "the next firing continues".

## Before the first firing

1. Merge `chore/v0-context-refresh` to `main` and push. Cloud sessions clone
   from GitHub.
2. Goal 0, in one web session on `main` (or as the routine's first firing,
   which will do it because `test:v0` is red): fix `npm run test:v0` on
   `main` — the `v0/inventor/portfolio` scenario no longer contains a
   complete (100%), unevaluated DRAFT owned by `inventor@northwind.test`; add
   one in `mock/scenarios/v0/`. Remove the Ideas navigation badge for Photon
   Admin and Case Owner (Workspace Admin only). Run `npm run storybook:build`
   and `node tools/design/shots.mjs --twice` once so the baselines are trusted.
3. Cloud environment (claude.ai/code → environment settings): setup script
   `npm ci --no-audit --no-fund && npx playwright install chromium`;
   network access **Trusted**; `CI=1`. Default permission mode **auto**.
   Model Fable, effort **high** (raise to xhigh only if a surface scores
   below 4 on hierarchy twice).
4. Create the routine from `ROUTINE-PROMPT.md`. Turn push notifications on.
5. Steering: commit a line to `STEER.md` on `main` (read at the start of
   every turn). Pause: commit a file named `AGENT_STOP` at the repo root.

## The condition template

This is what "complete" means for one surface. The Stop hook and the routine
prompt both refer to it. It also works as a manual `/goal` argument for a
single surface in an interactive web session (under 4,000 characters).

```
/goal Surface "<BRIEF TITLE>" (product-context/surfaces/<brief>.md) is complete on branch dsn/<NNNN>-<slug>. Complete means, all demonstrated in this transcript: (1) PROGRESS.md and STEER.md were read at the start and PROGRESS.md carries the persona frame (persona, situation, job, primary action, consequence) and the cognitive-load roleplay answers from design/v0/COGNITIVE-LOAD.md; (2) three directions were written with one low-fi render each and one was chosen by lowest cognitive load, recorded as a table in changes/DSN-<NNNN>/README.md; (3) the chosen direction is built in place in src/ to the visual language of the reference screens, using tokens and src/components/ui primitives, extending mock/ where the screen needs a route or field (declared in mock/proposed-*.json); (4) every intended story id for the surface in design/v0/coverage.json exists under design/stories/surfaces/, selects a v0/ scenario, and `npm run test:stories` passes with its output shown; (5) the legacy stories, QA journeys and visual baselines this surface replaces are deleted; (6) screenshots of every story at 1280x720 and 1440x900, and of the default state at 1366x768, 1920x1080 and 640x360@2, are re-baselined with `node tools/design/shots.mjs --update --only <regex>` and copied into changes/DSN-<NNNN>/shots/, and the default-state shots were opened with the Read tool and inspected; (7) `npm run typecheck`, `npm run lint:roles`, `node tools/tokens.mjs --check`, `npm run test:v0` and `node tools/design/gates.mjs --only typecheck --only v0 --only tokens --only stories` all pass with output shown; (8) the evaluator subagent (.claude/agents/evaluator.md) was run in a fresh context on the record and screenshots and returned VERDICT: PASS, pasted verbatim, after at most three NEEDS_WORK rounds; (9) design/v0/coverage.json has dsn "DSN-<NNNN>" for this surface, COVERAGE.md is re-rendered, and the DSN README carries scorecard scores all >= 4 or an explained exception, the cognitive-load check, what moved, what stayed, mock additions and known compromises; (10) everything is committed on the branch with messages naming DSN-<NNNN>, the branch is merged into main with --no-ff and pushed, `git status` is clean, and PROGRESS.md ends with a recap and the next surface. Constraints: do not edit the two reference screens (WorkspaceAdminOverview, ReviewQueueWorkspace) except to fix a defect this surface exposes, and say so; do not edit product-context/; do not add dependencies; do not touch src/lib/realAdapter.ts, auth or analytics; do not fix unrelated bugs, list them under Follow-ups in PROGRESS.md; questions only the founder can answer go under "Needs the founder" in PROGRESS.md with the assumption you proceeded on. Or stop after 80 turns and report what is complete and what is not.
```

## Order and per-goal fill-ins

Sequential lane A (they share routes and components; do not run in parallel):

| # | DSN | Brief title | brief file | slug | Notes |
|---|---|---|---|---|---|
| 1 | DSN-0005 | Inventor home | inventor-home | inventor-home | My ideas + next step lead; Submit an idea primary; map below. Replaces the legacy Dashboard story for INVENTOR. |
| 2 | DSN-0006 | Start an idea + Invention disclosure workspace | start-idea, disclosure-workspace | disclosure-workspace | One goal, two briefs, one component (DraftWorkspace). Upload/paste prompt first. Fix the stepper showing Submitted on a draft. Include both briefs' story ids. |
| 3 | DSN-0007 | Evaluation result | evaluation | evaluation | Score → band → meaning → what differs → strengthen → prior art on demand. Live patentability signal in the draft. |
| 4 | DSN-0008 | Idea detail and status | idea-detail | idea-detail | Substantial cleaning; score once; sections collapsible; on-behalf attribution. All four personas. |
| 5 | DSN-0009 | Ideas list | ideas | ideas-list | Inventor, Case Owner and Photon Admin variants; Workspace Admin variant is the reference and is only given its stories. |
| 6 | DSN-0010 | Review decision | review-decision | review-decision | Reference screen: stories and state coverage only (no-evaluation, partial, long, concurrent, confirmation, request-changes, reject, failure). |
| 7 | DSN-0011 | Workspace Admin dashboard | workspace-admin-dashboard | wa-dashboard-states | Reference screen: state stories only (no pending, one urgent, large aging, empty portfolio, quiet quarter, single inventor, long titles, error). |
| 8 | DSN-0012 | Patent portfolio | patent-portfolio | patent-portfolio | Full redesign: no S.No, no flags-as-data, ≤ the decision's columns by default, no horizontal scroll, jurisdiction summary. |
| 9 | DSN-0013 | Patent detail | patent-detail | patent-detail | Read-only for Inventor (no dates); contextual dates for Workspace Admin; editor for Photon roles. |
| 10 | DSN-0014 | Actions | actions | actions | Full redesign: next event, date and the one allowed action per row; no `Select action…`. |
| 11 | DSN-0015 | Photon due dates | due-dates | due-dates | Case Owner and Photon Admin only. |
| 12 | DSN-0016 | Case Owner my work | case-owner-my-work | case-owner-my-work | Work leads; map below, assigned-client scope; no badge. |
| 13 | DSN-0017 | Photon Admin dashboard | photon-admin-dashboard | photon-admin-dashboard | Exceptions lead; map below, firm scope; no badge. |
| 14 | DSN-0018 | Clients and onboarding | clients-and-onboarding | clients | |

Parallel lane B (independent routes; may run alongside lane A on its own branch):

| # | DSN | Brief title | brief file | slug | Notes |
|---|---|---|---|---|---|
| B1 | DSN-0019 | Authentication and access | authentication | auth | Login, domain-gated signup, invitation, forgot/reset, SSO return, access denied. |
| B2 | DSN-0020 | Workspace, people and profile | workspace | workspace-profile | Workspace organisation, people and invitations, business scope, profile. |

## While it runs (you, whenever)

Nothing waits for you. Read `PROGRESS.md` and each `changes/DSN-<NNNN>/README.md`
as they land; if a chosen direction is wrong, commit a line to `STEER.md`
("DSN-0006: reopen, put the paste field above upload") and the next firing
re-opens that surface before taking a new one. At the end, review `main`
once and the "Needs the founder" list.

## Budget expectations

A surface with 10–17 stories is 30–60 turns at effort high. Lane A is 14
goals; expect several days of sessions and shared rate limits with the rest
of your Max plan. The full `gates.mjs` run (15–25 min) is not in the goal
condition; run it once per merged surface from CI or by hand.
