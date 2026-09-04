# V0 run — progress log

Read this file and `STEER.md` at the start of every turn. Append at the end
of every surface. Newest entry last. Keep it factual: what landed, what the
gates printed, what the evaluator said, what is next.

## Ledger

The ledger is `design/v0/coverage.json` (`dsn` per surface), rendered in
`design/v0/COVERAGE.md`. Done = `dsn` set, every intended story exists and
passes, evaluator PASS recorded in the DSN README.

## Known state on main (2026-09-04)

- Reference screens: Workspace Admin Overview (DSN-0002) and Workspace Admin
  Ideas queue (DSN-0004, in review). Not to be redesigned.
- `npm run test:v0` fails on main: "the mock accepts a complete draft for
  review without an evaluation". Fix before the first goal (RUN-GOALS.md).
- Defect: Ideas navigation badge renders for Photon Admin and Case Owner.
  Fix before the first goal.
- Defect: the draft workspace stepper shows "Submitted" on an In draft idea.
  Fixed inside DSN-0006.
- Legacy pages (Patents, Actions, Due Dates, Workspace, Clients, Login) are
  untouched production screens; full redesign per RUN-GOALS.md.

## Needs the founder

(Questions the run could not answer; each with the assumption it proceeded on.)

## Follow-ups

(Bugs and improvements noticed outside a goal's scope. Not fixed by the run.)

## Entries

<!-- DSN-NNNN · <surface> · <date> · gates: … · evaluator: PASS/NEEDS_WORK ×n · next: … -->
