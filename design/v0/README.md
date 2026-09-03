# V0 layer

This directory and `mock/scenarios/v0/` are the V0 foundation: what the design
work for Pulse V0 stands on before any screen is redesigned. It changes only in
tooling PRs. Product truth is `product-context/`; this layer restates none of
it, it operationalises it.

## What is here
- `coverage.json` — the V0 coverage matrix: one entry per brief in
  `product-context/surfaces`, with permitted personas, user and business goal,
  routes, required scenarios, the five common states plus the brief's own,
  backend impact and the intended story ids. `COVERAGE.md` is its rendered
  form (`node tools/design/v0-coverage.mjs --write`).
- `mock/scenarios/v0/` — ten V0 scenarios on V0 tenants (Northwind
  Instruments, Beacon Health Systems, Orbital Foods) with four personas:
  Inventor, Workspace Admin (signed in as LEGAL_COUNSEL), Case Owner, Photon
  Admin. No client has a committee; every review is one Workspace Admin stage.
- `mock/proposed-fields.json` — the future backend contracts the V0 mock
  models: the submitter identity for on-behalf submission (BF-1) and the
  activation email outbox (BF-3). The Legacy reference tier keeps refusing
  what the backend refuses today.
- `qa/v0/semantic.test.ts` — the V0 semantic gate, run by
  `node tools/design/gates.mjs` and by `npm run test:v0`.

## What is not here
No V0 story exists yet. A story under `Surfaces/...` is approved only when
its DSN record creates the production-shaped component; the story ids in the
matrix are intentions. The 108 stories under `Legacy reference/...` describe
Legacy Pulse and are never cited as V0.

## Review widths
Every V0 surface is inspected at 1280×720, 1366×768, 1440×900, 1920×1080 and
at 200% browser zoom (emulated as a 640×360 CSS viewport at device scale 2).
The harness exposes them as Storybook viewports; `parameters.pulse.viewport`
selects one for screenshots.
