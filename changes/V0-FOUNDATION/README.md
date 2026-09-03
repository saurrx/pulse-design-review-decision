# V0 foundation, 3 September 2026

Branch: tooling/v0-foundation, from main at cf51067. Tooling only: no screen was
redesigned, no DSN record was started. Run `node tools/design/gates.mjs` to
reproduce the checklist; the run recorded for this branch is `gates-2026-09-03.txt`.

## What this branch adds
- **Four personas, one review stage.** `mock/scenarios/v0/personas.ts` defines
  three V0 tenants (Northwind Instruments, Beacon Health Systems, Orbital Foods)
  and eleven accounts across exactly four personas: Inventor, Workspace Admin
  (signed in as LEGAL_COUNSEL, named Workspace Admin wherever a person reads it),
  Case Owner, Photon Admin. No committee, no superadmin, every client
  `has_tech_committee: false`.
- **Ten V0 scenarios** under `v0/`: inventor first run and portfolio, Workspace
  Admin queue and empty workspace, Case Owner my work, Photon Admin firm, large,
  failure, slow, authentication failures. Every V0 idea goes straight to the
  Workspace Admin stage; a resubmission carries its changes-requested round;
  submitted ideas exist with no evaluation and with a low score.
- **Legacy scenarios kept** for the Legacy reference tier only, as
  `LEGACY_SCENARIOS`; the registry lists V0 first.
- **Coverage matrix** `design/v0/coverage.json` (rendered as `COVERAGE.md`): the
  seventeen briefs with personas, user goal, business goal, routes, required
  scenarios, the five common states and the brief's own, backend impact and
  200 intended story ids. No V0 story exists; the ids are intentions.
- **V0 semantic gate** `qa/v0/semantic.test.ts` (`npm run test:v0`, in the gate
  runner): twenty checks for the four personas, no committee or superadmin,
  no technical stage, matrix completeness, Inventor refused on Actions and due
  dates in the mock and in the matrix, excluded features, optional evaluation,
  badges, and declared contracts.
- **Conceptual UX modelled without a backend change**, declared in
  `mock/proposed-fields.json` and `mock/proposed-routes.json`:
  - BF-1: a Workspace Admin starts and submits an idea on behalf of an inventor
    (`POST /v1/ideas` with `inventor_id`); the idea carries `submitted_by_id` and
    the hydrated idea shows `submitted_by` beside `author`. V0 scenarios only.
  - BF-3: the activation and reminder outbox (`GET /v1/emails/outbox`), derived
    from each scenario's state: fifteen email kinds from WORKFLOWS.md section 9.
- **BF-4, a declared V0 policy**: in V0 scenarios an Inventor gets 403 on due
  dates, Actions and action templates. The backend serves both to any
  authenticated role scoped to its client (its instruction copy lists no
  capability on those reads) and production's dashboard shows upcoming due
  dates to inventors, so the Legacy reference tier keeps serving them and the
  crawl of production's screens stays clean. The policy is declared in
  `mock/proposed-fields.json` and in R-08 of the reconciliation record.
- **Review widths**: harness viewports 1280×720, 1366×768, 1440×900, 1920×1080
  and 200% zoom (640×360 at device scale 2); a story's `viewport:WxH[@scale]` tag
  drives its screenshot size.
- The design-tools chip groups scenarios into V0 and Legacy reference, names
  V0 personas by their V0 names, and starts collapsed. Production's conformance
  tier snapshots the accessibility tree, and the open chip had put every
  scenario and persona name into all 31 baseline files; with the chip collapsed
  the tree holds one "Open design tools" button. The mock conformance baseline
  was re-recorded and the diff read: the removed keys are the chip's region,
  its two comboboxes, its buttons and every option; the added key is that one
  button; three product keys appear on both sides because they moved position.

## Found while building, and how it was settled
- First run: the crawl failed on the Inventor home because the mock refused
  due dates unconditionally; the backend does not. Settled as BF-4 above.
- First run: conformance reported 372 deviations, all chip options. Settled by
  the collapsed chip and the re-recorded baseline above.
- A shadow root for the chip was tried and reverted: the accessibility
  snapshot pierces it, and the chip lost the page's base styles.

## Remaining conceptual backend contracts
| Finding | Contract | Where it is needed |
|---|---|---|
| BF-1 | `idea:create` and `idea:submit` for LEGAL_COUNSEL; `inventor_id` on idea creation; `submitted_by_id` on the idea | Start an idea (on behalf), Idea detail attribution |
| BF-2 | Per-reference differences in the evaluation envelope for "What appears different", if `closestMatches` does not carry them | Evaluation result; verified in that record |
| BF-3 | Activation and reminder email sequences; email preference categories beyond the three stored flags | Workspace and profile, and every activation state |
| unwired | Period breakdowns for momentum and trends; per-answer provenance and a frozen reviewed revision; patent documents | Dashboards, disclosure workspace, patent detail |

## Not done here, by instruction
DSN-0001 (tokens), DSN-0002, the golden invention flow, any V0 story or
full-screen redesign.
