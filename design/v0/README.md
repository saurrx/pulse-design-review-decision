# V0 layer

This directory and `mock/scenarios/v0/` are the V0 foundation: what the design
work stands on. Product truth is `product-context/`; this layer restates none
of it, it operationalises it.

## What is here
- `coverage.json` — the V0 coverage matrix: one entry per brief in
  `product-context/surfaces`, with permitted personas, user and business goal,
  routes, required scenarios, the five common states plus the brief's own,
  mock impact and the intended story ids. `COVERAGE.md` is its rendered form
  (`node tools/design/v0-coverage.mjs --write`). The `dsn` column is the
  ledger of the V0 run: a surface is done when its `dsn` is set and every
  intended story exists and passes.
- `COGNITIVE-LOAD.md` — the charter every screen is judged against, by persona.
- `mock/scenarios/v0/` — the V0 scenarios on V0 tenants (Northwind
  Instruments, Beacon Health Systems, Orbital Foods) with four personas:
  Inventor, Workspace Admin (signed in as LEGAL_COUNSEL), Case Owner, Photon
  Admin. No client has a committee; every review is one Workspace Admin stage.
- `mock/proposed-fields.json`, `mock/proposed-routes.json` — what V0 needs
  beyond today's backend API, modelled in the mock and declared here.
- `qa/v0/semantic.test.ts` — the V0 semantic gate, run by
  `node tools/design/gates.mjs` and by `npm run test:v0`.

## Stories
A story under `Surfaces/...` exists when its surface has landed. The story ids
in the matrix are the intended ids. The stories under `Legacy reference/...`
describe Legacy Pulse, are never cited as V0, and are deleted surface by
surface as V0 replaces them.

## Review widths
Every V0 surface is inspected at 1280×720, 1366×768, 1440×900, 1920×1080 and
at 200% browser zoom (emulated as a 640×360 CSS viewport at device scale 2).
The harness exposes them as Storybook viewports; `parameters.pulse.viewport`
selects one for screenshots.
