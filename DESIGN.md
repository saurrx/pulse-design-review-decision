# Pulse V0

The Pulse V0 codebase: a full UI and UX redesign for four personas, running
on a mock backend. Product truth lives in `product-context/` (read its
AGENTS.md first), the rules in AGENTS.md, the cognitive-load charter in
`design/v0/COGNITIVE-LOAD.md`.

## Run
| What | Command | Where |
|---|---|---|
| Full app on mock data | `npm run dev:design` | http://localhost:3700 |
| Storybook | `npm run storybook` | http://localhost:6006 |
| Story tests (serial, real browser) | `npm run test:stories` | |
| V0 semantic gate | `npm run test:v0` | |
| Screenshots of every story | `node tools/design/shots.mjs` | after `npm run storybook:build` |
| Every gate the CI runs | `node tools/design/gates.mjs` | |
| Crawl every page as every persona | `node tools/design/crawl.mjs` | needs the preview on 3700 |
| Preview deployments | `node tools/design/deploy.mjs --prod` | Vercel |

Personas: any email in `mock/scenarios/v0/personas.ts` with any password.
Scenarios: `?scenario=<name>&role=<ROLE>` on any URL, or the chip at the bottom left.

## Layout
- `src/` the application. Redesigned in place, surface by surface.
- `mock/` the backend: `runtime/` (engine), `handlers/` and `scenarios/` (data),
  `proposed-routes.json` / `proposed-fields.json` (what V0 needs beyond today's API).
- `design/` harness, stories, fonts, the a11y baseline, the v4 token reference,
  `v0/` coverage matrix and cognitive-load charter.
- `qa/` invariant, security, contract and visual checks; `qa/v0/` the V0 gates.
- `tools/design/` gates, shots, crawl, coverage renderer.
- `changes/` one lightweight record per change.
- `contract/` historical backend contract pins (reference only).

## History
This repository began as a design fork of `photonlegal/pulse-frontend` that
exported patches back to production. That model was retired in September
2026; CLAUDE.md explains what is historical.
