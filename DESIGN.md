# Pulse design fork

A private fork of `photonlegal/pulse-frontend` on mock data. Production stays
untouched; this repository exists so the v4 redesign can be built for all six
roles and handed back as portable patches. The plan, decisions and review log
live in the published proposal "Pulse Design Fork"; the rules in AGENTS.md.

## Run
| What | Command | Where |
|---|---|---|
| Full app on mock data | `npm run dev:design` | http://localhost:3700 |
| Storybook | `npm run storybook` | http://localhost:6006 |
| Story tests (serial, real browser) | `npm run test:stories` | |
| Adapter-boundary fidelity tests | `npm run test:fidelity` | |
| Every gate the CI runs | `node tools/design/gates.mjs` | |
| Crawl every page as every persona | `node tools/design/crawl.mjs` | needs the preview on 3700 |
| Preview deployments | `node tools/design/deploy.mjs --prod` | two Vercel projects |

Personas: any email in `mock/scenarios/personas.ts` with any password.
Scenarios: `?scenario=<name>&role=<ROLE>` on any URL, or the chip at the bottom left.

## Layout
- `src/` production's tree. Changes only through design records.
- `mock/` the worker under the adapter: `runtime/` (protected), `handlers/` and `scenarios/` (review support).
- `design/` harness (protected), stories, fonts, the a11y baseline, the v4 reference material.
- `contract/` pinned backend contract and sanitised production instructions (protected).
- `qa/` production's corpus with a mock-mode seam; `qa/conformance/baseline-mock/` is ours.
- `tools/design/` sync, export, gates, runners.
- `changes/` design records.

## Sync from production
`node tools/design/sync.mjs` merges `upstream/main`, keeps the design-owned
instruction files, refreshes the sanitised production copy under `contract/`
and records its diff in the sync commit. Run it daily while production moves fast.
