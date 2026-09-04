# Working rules for agents in the Pulse V0 repository

Read CLAUDE.md first, then product-context/AGENTS.md and the files it routes
for the surface you are working on. These rules apply to Codex, Claude and any
other agent.

## What this repo is
- `src/` is the V0 application. Screens are redesigned in place: keep the
  route, the data hooks and the adapter (`src/lib/realAdapter.ts`), change the
  component.
- `mock/` is the backend for V0: a Mock Service Worker layer speaking the
  backend's `/v1` vocabulary (`contract/backend.json`, `contract/enums.ts`).
  `mock/runtime/` is the engine; `mock/handlers/` and `mock/scenarios/` are the
  data. A capability V0 needs that the real backend does not grant yet is
  modelled in the mock and declared in `mock/proposed-routes.json` or
  `mock/proposed-fields.json`; it is never left out of the design because the
  backend lacks it.
- `mock/scenarios/v0/` holds the V0 scenarios (names start with `v0/`): V0
  tenants, four personas, no committee, one review stage. Every V0 story and
  every screenshot selects one of them.
- `design/` holds the harness, stories, fonts and baselines. V0 stories live
  under `design/stories/surfaces/`, titled `Surfaces/<brief name>`, one file per
  brief in product-context/surfaces, covering the states the brief lists.
- `design/stories/legacy/` is the Legacy reference tier: production's screens
  as they were, six backend roles, titled `Legacy reference/...`. It is
  regression coverage only. When a V0 surface lands, delete the legacy stories,
  QA journeys and baselines it replaces in the same change. It is never product
  authority and never a source for V0 copy.
- `design/v0/` is the V0 foundation: the coverage matrix (`coverage.json`,
  rendered as `COVERAGE.md`) with one entry per surface brief, and
  `COGNITIVE-LOAD.md`, the charter every screen is judged against.
- `product-context/` is the V0 product and design truth. Change it only
  through a recorded context update (its VALIDATION.md) with a version bump.
- `changes/DSN-*/` holds one lightweight record per change (see changes/README.md).
- `docs/architecture/` is the architecture record and the reconciliation log.
- `contract/`, `tools/design/export.mjs`, `sync.mjs`, `fingerprint.mjs` and
  `paths.mjs` are historical (see CLAUDE.md, History). Do not run or extend them.

## Personas
V0 has exactly four personas. The mock signs each one in as the backend role
that already carries its permissions; user-facing text uses the V0 names from
product-context/PRODUCT-VOCABULARY.md and the backend identifiers stay in code.

| V0 persona | Backend role in the mock | Not a V0 persona |
|---|---|---|
| Inventor | INVENTOR | |
| Workspace Admin | LEGAL_COUNSEL | TECH_COMMITTEE — V0 has one review stage; every mock client has `has_tech_committee: false` |
| Case Owner | CASE_OWNER | |
| Photon Admin | PHOTON_ADMIN | PHOTON_SUPERADMIN — not offered by the mock or the stories |

Do not add a persona, permission, workflow stage, status, screen, metric or
module that product-context/ does not authorise.

## Reference screens
The Workspace Admin Overview and the Workspace Admin Ideas queue on `main` are
the approved visual reference. They are not edited during a surface run except
to fix a defect the run uncovers. Every other screen is redesigned to their
language; see product-context/DESIGN-PHILOSOPHY.md, Brand direction.

## Directions (pre-authorised)
For a material surface, explore three meaningfully different directions
(product-context/AI-WORKFLOW.md, phase 2) as written descriptions plus one
low-fidelity render each, then select the direction with the lowest cognitive
load for that persona and screen under `design/v0/COGNITIVE-LOAD.md`, build
only that one, and record all three with the tradeoff in the DSN README. The
founder has pre-authorised this selection for the V0 run; the record is where
the choice is reviewed. Stop and ask only for a change to product behaviour,
scope, permissions, vocabulary or a reference screen.

## Always
- Start with the persona, job, product object, consequence and success signal
  (product-context/AI-WORKFLOW.md phase 1) before writing UI code. Roleplay
  the persona: what would they need to see first, and what would they never
  read?
- Start from the existing component and its props. Restyle and restructure in
  place; keep the route and the data flow.
- Colour, type, spacing, radius, borders and shadows come from the token source
  `src/styles/tokens.json` (PL-TKN-004, kept byte-exact at
  `design/v4/PL-TKN-004.html`). Edit the source, run `node tools/tokens.mjs`,
  commit the generated `src/styles/tokens.css` and `tokens.tailwind.ts`; the
  gate `node tools/tokens.mjs --check` fails on stale outputs. No new literal
  visual values in product files.
- Use the primitives under `src/components/ui` first. A new primitive is its
  own record.
- Keep every route and redirect working for every backend role. What each
  persona is offered follows product-context/SCREENS.md; a page V0 removes is
  hidden by design and recorded, never silently deleted.
- Select scenarios; never build ad-hoc fixture objects. Add a scenario or a
  story only for a state nothing covers yet.
- Use the vocabulary table in product-context/PRODUCT-VOCABULARY.md in every
  label, story name and scenario name.
- Render and inspect the real result at 1280×720, 1366×768, 1440×900,
  1920×1080 and 200% zoom (the harness viewports `pulse1280`, `pulse1366`,
  `pulse1440`, `pulse1920`, `pulseZoom200`; a story tags `viewport:1366x768` or
  `viewport:640x360@2` for its screenshot), then run
  product-context/DESIGN-SCORECARD.md and design/v0/COGNITIVE-LOAD.md before
  calling work ready. Code inspection is not visual review.
- A V0 story is titled `Surfaces/<brief title>` with the id the coverage matrix
  intends and selects a `v0/` scenario. When the surface lands, set its `dsn`
  in `design/v0/coverage.json` and re-render `COVERAGE.md`.
- Before a PR: `npm run typecheck`, `npm run lint:roles`,
  `node tools/tokens.mjs --check`, `npm run build:design`,
  `npm run storybook:build`, `npm run test:stories`, `npm run test:v0`,
  `node tools/design/shots.mjs --update` for the stories you changed, then
  `node tools/design/gates.mjs`. The V0 semantic gate fails on a fifth persona,
  a committee or superadmin persona, a technical review stage, a brief missing
  from the matrix, an Inventor reaching Actions or due dates, an excluded
  feature, an evaluation that gates submission, or a badge outside Workspace
  Admin review.
- Write the record: intent, three directions and the choice, what moved, what
  stayed, story ids, screenshots per persona and viewport, the scorecard and
  the cognitive-load check.

## Never
- Touch the adapter, auth, analytics or the query hooks to make a design fit.
  A behaviour change is its own change with its own record.
- Add a dependency, or upgrade Tailwind, React, Vite, Radix, TypeScript or
  Playwright.
- Invent an endpoint, a status value or a role label. A route the backend
  lacks is added to the mock and declared in `mock/proposed-routes.json`.
- Render an internal identifier to a reader. Reference numbers (`NWI-0001`)
  only.
- Remove an affordance that authorization depends on to simplify a layout.
- Add a notification bell, a cost or trademark module, a purchase flow, a
  general chat assistant, or a score cutoff.
- Rank named inventors anywhere an Inventor can see it. The Workspace Admin
  Overview's Top inventors list is the one authorised ranking.
- Put a navigation badge on anything but the Workspace Admin's pending reviews.
- Use a real invention, customer name, email, patent record, credential or
  call transcript in a fixture, a screenshot or a prompt. Fixtures are
  synthetic and deterministic (mock/runtime/prng.ts, .test domains).
- Call a demo or production host, or put a credential anywhere in the tree.
- Re-litigate locked technical decisions: inventorship, one-click view-as, the
  desktop gate, same-origin uploads, content-free analytics. The V0 review
  chain is one Workspace Admin stage (product-context/WORKFLOWS.md).

## Running things
- Full app on mock data: `npm run dev:design` (port 3700). Persona and scenario
  from the chip at the bottom-left, or `?scenario=<name>&role=<ROLE>`.
- Storybook: `npm run storybook` (port 6006). Story tests: `npm run test:stories`.
  V0 semantic gate: `npm run test:v0`. Coverage matrix:
  `node tools/design/v0-coverage.mjs --write` after editing
  `design/v0/coverage.json`. V0 scenarios: `?scenario=v0/workspace-admin/queue`.
- Screenshots of every story: `npm run storybook:build` then
  `node tools/design/shots.mjs` (`--update` to re-baseline, `--only <regex>`).
- Every gate: `node tools/design/gates.mjs` (15–25 min); a subset:
  `node tools/design/gates.mjs --only typecheck --only v0`.
- Autonomous runs: see `RUN-GOALS.md`, `ROUTINE-PROMPT.md`, `PROGRESS.md`,
  `STEER.md`, `.claude/rules/autonomous-run.md` and the hooks in
  `.claude/settings.json` (completion gate, evidence gate, kill switch).
