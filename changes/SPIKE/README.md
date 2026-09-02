# Two-screen spike, 3 September 2026

Repository: gitlab.com/saurabh189/pulse-design, a private fork of photonlegal/pulse-frontend at 6d10ae9.
Branch: tooling/spike. Run `node tools/design/gates.mjs` to reproduce the checklist.

## Exit criteria

| Criterion | Result | Evidence |
|---|---|---|
| Full app and Storybook both render login and the review queue | met | tools/design/smoke.mjs (six steps), design/stories/screens/*.stories.tsx (eight stories) |
| Portal header actions settle reliably | met | the review queue's title slot shows the client name; the harness ready marker waits two frames after fonts |
| Google and every outside request blocked | met | inert @react-oauth/google shim via vite.design.config.ts; fonts vendored; egress catch-all in the worker; browser-level route abort in the runners; smoke and shots report no host contacted |
| Two personas cannot contaminate each other | proven NOT safe in parallel | tools/design/isolation.mjs: concurrent frames on one origin leak identity through the shared cookie, and data is not reliably isolated either; story tests run serially (vitest fileParallelism false) |
| Fixed evaluation states stay fixed | met | scenario evaluations are fixed snapshots; only the full app progresses on the mock clock |
| Error stories deterministic | met | harness query client retries off; the unknown-account story asserts the toast |
| Screenshots stable across two clean runs | met | shots.mjs --twice, eight stories identical, baselines in qa/visual/baselines |
| Accessibility failures block correctly | met | a11y.mjs: 105 inherited fingerprints on the ratchet; a planted violation in a redesign-tagged story exits 1; unplanted exits 0 |
| Portable patch excludes every design-support file | met | export.mjs probe: 1 portable file in the patch, story file excluded, protected changes refused |
| Patch applies in a disposable production worktree | met | export.mjs dry run at the recorded base and the latest head; typecheck, lint:roles, build green; worktree removed |
| Sync preserves design instructions and reports a new rule | met | sync.mjs --dry-run against a simulated upstream change: preamble intact, probe text absent from the root file, rule diff in the report. It also caught a stale contract copy, since fixed |
| Augmented lockfile installs reproducibly with one React runtime | met | npm ci in a clean directory; react, react-dom and vite one copy each |
| App and Storybook previews deploy independently | met | two Vercel projects deployed prebuilt; public at https://pulse-design-s-5ecc81c4.vercel.app and https://pulse-design-storybook.vercel.app; the smoke test passes against the public app |

## Decisions the spike forced
- Story tests are serial. Parallelism is not a configuration flag to flip later; it needs a different session mechanism the app does not have.
- Instruction copies under contract/ come from the pinned fork commit, never from a sibling checkout.
- The story-level a11y check reports by default; the ratchet runner is the gate. Stories tagged `redesign` are held to zero violations inside `main`.
- The egress rule needs no exception: the current typeface is vendored under design/fonts until DSN-0001 moves the product's fonts into public/fonts.

## Not built in the spike
The remaining reachable routes and scenarios, the behavioural-fingerprint gate, the adapter-boundary fidelity tests, the handler report, the CI pipeline, the conformance seam and the preview deployments.
