# Change records

One folder per change, `DSN-0001` onward. A record is the audit trail for a
surface: what was intended, which directions were considered, what was built,
what it looks like, and how it scored. The branch and its pull request carry
the code; the folder carries the evidence.

## Lifecycle
`proposed` -> `in review` -> `approved` -> `merged`.

## Making one
1. `git checkout -b dsn/0007-short-name main`.
2. Work under the rules in AGENTS.md: change `src/`, extend the mock, add or
   update the V0 stories for the surface, delete the legacy stories it replaces.
3. Render the surface at the five review widths, run the scorecard and
   `design/v0/COGNITIVE-LOAD.md`, run the gates.
4. Create `changes/DSN-0007/` from TEMPLATE: README.md plus `shots/`.
5. Set the surface's `dsn` in `design/v0/coverage.json`, re-render `COVERAGE.md`.
6. Open the pull request. The README is the review surface; the reviewer
   opens Storybook for the rest.

## What a record contains
- `README.md` — intent, the three directions and the chosen one with its
  tradeoff, what moved, what stayed, story ids, scorecard, cognitive-load
  check, mock additions, known compromises.
- `shots/` — one screenshot per story per viewport that matters for the
  decision (at minimum 1280×720 and 1440×900 of the default state).

## History
DSN-0001 to DSN-0003 were made under the earlier design-fork model and carry
patch, class, drift and fingerprint files. Those files are historical; the
export machinery is retired (see CLAUDE.md, History).
