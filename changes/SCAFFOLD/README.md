# Scaffold, 3 September 2026

Repository: gitlab.com/saurabh189/pulse-design, a private fork of photonlegal/pulse-frontend at 6d10ae9.
Branch: tooling/scaffold, fast-forwarded into main. Run `node tools/design/gates.mjs` to reproduce the checklist.

## What the scaffold added on top of the spike
- The full mock surface: 81 handlers over the backend's own /v1 vocabulary, every reachable production route served for every backend role, twelve scenarios, a mock clock, deterministic data, frame-local personas.
- The QA tiers in mock mode: layout invariants, the uuid invariant, structure conformance against a mock baseline, adapter-boundary fidelity tests.
- The gate runner with 22 gates, the GitLab pipeline, the export dry run in disposable production worktrees, the sync script as the control for instruction files.
- A catalogue of production's screens as they are today: 108 stories, screenshot baselines, an a11y ratchet baseline of 821 inherited fingerprints.

## Product authority, installed the same day
`product-context/` (Pulse V0 design context 1.0.0) became the product authority after the catalogue was built. The catalogue therefore documents production, not V0:
six backend roles, a committee stage, an assistant page, a world map on the dashboard. It was moved to `design/stories/legacy/` and retitled `Legacy reference/...`.
It stays as technical regression coverage for the harness until the V0 catalogue under `design/stories/surfaces/` covers the same technical states, then it is removed.
Screenshot and a11y baselines were renamed to the new story ids, not re-recorded. Conflicts between the product context and the base are in `docs/architecture/CONTEXT-RECONCILIATION.md`.

## Decisions recorded
- Story tests stay serial (isolation probe: chrome identity leaks through the shared cookie in parallel frames).
- yaml@2.9.0 is a documented manifest exception (optional peer of postcss-load-config under tailwindcss).
- Screenshot stability is judged within a 40-pixel tolerance for sub-pixel text after a settle loop of two identical frames.
- The four V0 personas sign in as INVENTOR, LEGAL_COUNSEL, CASE_OWNER and PHOTON_ADMIN; TECH_COMMITTEE and PHOTON_SUPERADMIN are not personas.

## Not built yet
- The V0 catalogue per surface brief (seventeen briefs, four personas, the states each brief lists).
- The four-persona scenario layer (every client without a committee; no superadmin persona).
- Harness viewports 1366 and 1920 and a 200% zoom parameter.
- DSN-0001, the token record from PL-TKN-004.
