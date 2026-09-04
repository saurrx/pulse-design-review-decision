# Pulse V0 — agent context

This repository is the Pulse V0 codebase: a full UI and UX redesign of Pulse
for four personas (Inventor, Workspace Admin, Case Owner, Photon Admin),
running on a Mock Service Worker backend under `mock/`. The mock is the
backend for V0 design work: when a screen needs a route, field or state the
mock does not model yet, add it to the mock (declare it in
`mock/proposed-routes.json` / `mock/proposed-fields.json`) and build the
screen against it.

Read, in order: this file, `AGENTS.md`, `product-context/AGENTS.md` and the
surface brief under `product-context/surfaces/` for the screen you are on.
Before calling any screen ready, run `product-context/DESIGN-SCORECARD.md`
and `design/v0/COGNITIVE-LOAD.md` against the rendered result.

Authority, highest first:
1. The user's explicit instructions in the current task (including
   `STEER.md` during an autonomous run).
2. `product-context/` — V0 product, business, persona, workflow, screen,
   vocabulary and design truth (version 1.1.0). Never add a persona, role,
   status, screen, metric or module it does not authorise.
3. The reference screens: the Workspace Admin Overview
   (`src/components/dashboard/WorkspaceAdminOverview.tsx`) and the Workspace
   Admin Ideas queue (`src/components/review/ReviewQueueWorkspace.tsx`) as
   they render on `main`. Every other screen is redesigned to match their
   visual language: tokens, type, radius scale, 36px buttons, hairline
   separation, two-pane list/detail where a list feeds a decision.
4. `AGENTS.md` and `.claude/rules/` — how work is done in this repo.
5. Legacy Pulse (`design/stories/legacy/`, `dev.photonpulse.ai`) — reference
   only, removed as each V0 surface lands.
6. External design resources — inspiration only.

`docs/architecture/CONTEXT-RECONCILIATION.md` records where product context,
mock and code disagree and how each was resolved. Read it before touching a
surface it names.

## History (why some files look like a fork)

Until September 2026 this repository was a design fork of
`photonlegal/pulse-frontend` that exported design changes back to production
as portable patches. That model is retired: there is no upstream sync, no
patch export, no portable/protected path classes and no behavioural
fingerprint escalation. `tools/design/export.mjs`, `sync.mjs`,
`fingerprint.mjs`, `paths.mjs`, `contract/` and the patch files under
`changes/DSN-000[1-3]/` are historical and are not rules. The gates that
still matter are listed in `AGENTS.md`.

@AGENTS.md
