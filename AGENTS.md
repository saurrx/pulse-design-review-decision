# Working rules for agents in the Pulse design fork

Read CLAUDE.md first. These rules apply to Codex, Claude and any other agent.

## What this repo is
- `src/` is production's tree. It changes only through design records (DSN branches).
- `mock/` is a Mock Service Worker layer under the adapter: handlers speak the
  backend's own `/v1` vocabulary from `contract/backend.json` and `contract/enums.ts`.
- `design/` holds the harness, stories, fonts and the v4 reference material.
- `changes/DSN-*/` holds one folder per design record.
- `contract/` holds pinned copies of the backend contract and sanitised production
  instructions. Protected; refreshed only by the sync script.

## Path classes (the exporter enforces these)
- Normally portable: `src/components/**`, `src/pages/**`, `src/index.css`,
  `src/style.css`, `src/styles/**`, `public/assets/**`, `public/fonts/**`.
- Portable with build-impact approval: `index.html`, `vite.config.ts`,
  `tailwind.config.ts`, `postcss.config.js`, `tools/tokens.mjs`.
- Portable with behaviour-impact approval: `src/lib/roles.ts` labels,
  `src/utils/patentLegalStatus.ts`, `src/contexts/**` while UI lives there, `src/hooks/**`.
- Review support, never in a patch: `design/stories/**`, `mock/scenarios/**`,
  `mock/handlers/**`, `changes/DSN-*/**`, `qa/conformance/baseline-mock/**`, screenshot baselines.
- Protected infrastructure, tooling PRs only: `mock/runtime/**`, `.storybook/**`,
  `design/harness/**`, `tools/design/**`, `qa/**` except baselines, `contract/**`,
  `vite.design.config.ts`, `CLAUDE.md`, `AGENTS.md`, `.claude/**`, `CODEOWNERS`,
  `vercel.json`, `package.json`, `package-lock.json`.

## Always
- Start from the existing component and its props. Restyle in place; rewrite only
  with a design record that says so.
- Put colour, type, spacing, radius and shadow decisions in the token source once
  DSN-0001 lands. No new literal visual values in product files.
- Use the primitives under `src/components/ui` first. A new primitive is its own record.
- Keep every role's routes, redirects and affordances.
- Select scenarios; never build ad-hoc fixture objects. Add a scenario or a story
  only for a state nothing covers yet. Reference the stories that cover every
  component you change.
- Expect a behavioural-fingerprint escalation when a restyle touches a query, a
  payload, a navigation target or a role condition, and say in the record why.
- Before a PR: `npm run typecheck`, `npm run lint:roles`, `npm run build:design`,
  `npm run storybook:build`, `npm run test:stories`, `node tools/design/gates.mjs`.
- Write the record: intent, what moved, what stayed, story ids, screenshots per
  role, backend impact (`none`, `unwired` or `conceptual`).

## Never
- Touch the adapter (`src/lib/realAdapter.ts`), auth, analytics or the query hooks
  from a design branch. Behaviour changes go to production as findings.
- Change protected infrastructure from a design branch.
- Add a dependency, or upgrade Tailwind, React, Vite, Radix, TypeScript or Playwright.
- Invent an endpoint, a status value or a role label. A route the backend lacks is
  declared in `mock/proposed-routes.json` and the record becomes conceptual.
- Render an identifier to a reader. Reference numbers only.
- Remove an affordance that authorization depends on to simplify a layout.
- Call a demo or production host, or put a credential anywhere in the tree.
- Re-litigate locked product decisions: the review chain, inventorship, stage gates,
  one-click view-as, the desktop gate, same-origin uploads, content-free analytics.

## Running things
- Full app on mock data: `npm run dev:design` (port 3700). Persona and scenario
  from the chip at the bottom-left, or `?scenario=<name>&role=<ROLE>`.
- Storybook: `npm run storybook` (port 6006). Story tests: `npm run test:stories`.
- Sync from production: `node tools/design/sync.mjs`. Export a record:
  `node tools/design/export.mjs DSN-0007`.
