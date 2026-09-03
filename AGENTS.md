# Working rules for agents in the Pulse design fork

Read CLAUDE.md first, then product-context/AGENTS.md and the files it routes
for the surface you are working on. These rules apply to Codex, Claude and any
other agent.

## What this repo is
- `src/` is production's tree. It changes only through design records (DSN branches).
- `mock/` is a Mock Service Worker layer under the adapter: handlers speak the
  backend's own `/v1` vocabulary from `contract/backend.json` and `contract/enums.ts`.
- `design/` holds the harness, stories, fonts and baselines. V0 stories live under
  `design/stories/surfaces/` titled `Surfaces/<brief name>`, one file per brief in
  product-context/surfaces, covering the states the brief lists.
- `design/stories/legacy/` is the Legacy reference tier: production's screens as
  they are today, six backend roles, titled `Legacy reference/...`. It is kept as
  technical regression coverage for the harness (screenshot, a11y and story-test
  baselines) until the V0 catalogue covers the same technical states, then
  removed. It is never product authority and never a source for V0 copy.
- `product-context/` is the V0 product and design truth. Read-only in design
  branches; a product change needs a recorded context update (its VALIDATION.md).
- `docs/architecture/` is the pinned architecture and the reconciliation record.
- `design/v0/` is the V0 foundation: the coverage matrix (`coverage.json`, rendered
  as `COVERAGE.md`), one entry per brief in product-context/surfaces with personas,
  goals, routes, required scenarios, states, backend impact and intended story ids.
- `mock/scenarios/v0/` holds the ten V0 scenarios (names start with `v0/`): V0
  tenants, four personas, no committee, one review stage. The legacy scenarios
  (`committee/queue`, `counsel/queue`, ...) serve the Legacy reference tier only.
- `mock/proposed-fields.json` and `mock/proposed-routes.json` declare the future
  backend contracts the V0 mock models (BF-1 on-behalf submission with separate
  attribution, BF-3 the activation email outbox). They answer only when a scenario
  sets `flags.v0`; the legacy tier keeps refusing what the backend refuses.
- `changes/DSN-*/` holds one folder per design record.
- `contract/` holds pinned copies of the backend contract and sanitised production
  instructions. Protected; refreshed only by the sync script.

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
module that product-context/ does not authorise. A V0 capability the backend
does not grant today is recorded as a backend finding in
docs/architecture/CONTEXT-RECONCILIATION.md and the design record is
`conceptual`; it is never faked in the mock as if it existed.

## Path classes (the exporter enforces these)
- Normally portable: `src/components/**`, `src/pages/**`, `src/index.css`,
  `src/style.css`, `src/styles/**`, `public/assets/**`, `public/fonts/**`.
- Portable with build-impact approval: `index.html`, `vite.config.ts`,
  `tailwind.config.ts`, `postcss.config.js`, `tools/tokens.mjs`.
- Portable with behaviour-impact approval: `src/lib/roles.ts` labels,
  `src/utils/patentLegalStatus.ts`, `src/contexts/**` while UI lives there, `src/hooks/**`.
- Review support, never in a patch: `design/stories/**`, `mock/scenarios/**`,
  `mock/handlers/**`, `changes/DSN-*/**`, `qa/conformance/baseline-mock/**`, screenshot baselines.
- Protected infrastructure, tooling PRs only, never in a patch: `mock/runtime/**`,
  `.storybook/**`, `design/harness/**`, `tools/design/**`, `qa/**` except baselines,
  `contract/**`, `product-context/**`, `docs/**`, `vite.design.config.ts`,
  `CLAUDE.md`, `AGENTS.md`, `.claude/**`, `CODEOWNERS`, `vercel.json`,
  `package.json`, `package-lock.json`.

## Always
- Start with the persona, job, product object, consequence and success signal
  (product-context/AI-WORKFLOW.md phase 1) before writing UI code. For a
  material surface, propose three directions and wait for human direction.
- Start from the existing component and its props. Restyle in place; rewrite only
  with a design record that says so.
- Colour, type, spacing, radius, borders and shadows come from the token source
  `src/styles/tokens.json` (PL-TKN-004, the approved specification kept byte-exact
  at `design/v4/PL-TKN-004.html`). Edit the source, run `node tools/tokens.mjs`,
  commit the generated `src/styles/tokens.css` and `tokens.tailwind.ts`; the
  gate `node tools/tokens.mjs --check` fails on stale outputs. No new literal
  visual values in product files. A value that is not the specification's needs
  the founder's approval and a `_note` in the source.
- Use the primitives under `src/components/ui` first. A new primitive is its own record.
- Keep production's routes and redirects working for every backend role. What
  each persona is offered follows product-context/SCREENS.md; a page V0 removes
  is hidden by design and recorded as a production finding, never silently deleted.
- Select scenarios; never build ad-hoc fixture objects. Add a scenario or a story
  only for a state nothing covers yet. Stories are organised by the surface
  briefs under product-context/surfaces and cover the states each brief lists.
- Use the vocabulary table in product-context/PRODUCT-VOCABULARY.md in every
  label, story name and scenario name.
- Expect a behavioural-fingerprint escalation when a restyle touches a query, a
  payload, a navigation target or a role condition, and say in the record why.
- Render and inspect the real result at 1280×720, 1366×768, 1440×900, 1920×1080
  and 200% zoom (the harness viewports `pulse1280`, `pulse1366`, `pulse1440`,
  `pulse1920`, `pulseZoom200`; a story tags `viewport:1366x768` or
  `viewport:640x360@2` for its screenshot), then run
  product-context/DESIGN-SCORECARD.md before calling work ready.
- A V0 story is titled `Surfaces/<brief title>` with the id the coverage matrix
  intends, selects a `v0/` scenario, and exists only when its DSN record creates
  the production-shaped component. Never present a Legacy reference story as V0.
- Before a PR: `npm run typecheck`, `npm run lint:roles`, `npm run build:design`,
  `npm run storybook:build`, `npm run test:stories`, `npm run test:v0`,
  `node tools/design/gates.mjs`. The V0 semantic gate fails on a fifth persona,
  a committee or superadmin persona, a technical review stage, a brief missing
  from the matrix, an Inventor reaching Actions or due dates, an excluded
  feature, an evaluation that gates submission, or a badge outside Workspace
  Admin review.
- Write the record: intent, what moved, what stayed, story ids, screenshots per
  persona, backend impact (`none`, `unwired` or `conceptual`), the scorecard.

## Never
- Touch the adapter (`src/lib/realAdapter.ts`), auth, analytics or the query hooks
  from a design branch. Behaviour changes go to production as findings.
- Change protected infrastructure or product-context/ from a design branch.
- Add a dependency, or upgrade Tailwind, React, Vite, Radix, TypeScript or Playwright.
- Invent an endpoint, a status value or a role label. A route the backend lacks is
  declared in `mock/proposed-routes.json` and the record becomes conceptual.
- Render an identifier to a reader. Reference numbers only.
- Remove an affordance that authorization depends on to simplify a layout.
- Add a notification bell, a world map, a cost or trademark module, a purchase
  flow, a general chat assistant, a leaderboard of named people, or a score cutoff.
- Use a real invention, customer name, email, patent record, credential or call
  transcript in a fixture, a screenshot or a prompt. Fixtures are synthetic and
  deterministic (mock/runtime/prng.ts, .test domains).
- Call a demo or production host, or put a credential anywhere in the tree.
- Re-litigate locked technical decisions: inventorship, one-click view-as, the
  desktop gate, same-origin uploads, content-free analytics. The V0 review chain
  is one Workspace Admin stage (product-context/WORKFLOWS.md).

## Running things
- Full app on mock data: `npm run dev:design` (port 3700). Persona and scenario
  from the chip at the bottom-left, or `?scenario=<name>&role=<ROLE>`.
- Storybook: `npm run storybook` (port 6006). Story tests: `npm run test:stories`.
  V0 semantic gate: `npm run test:v0`. Coverage matrix: `node tools/design/v0-coverage.mjs --write`
  after editing `design/v0/coverage.json`. V0 scenarios: `?scenario=v0/workspace-admin/queue`.
- Sync from production: `node tools/design/sync.mjs`. Export a record:
  `node tools/design/export.mjs DSN-0007`.
