# DSN-0000: Title

**Status:** proposed | in review | approved | ported | verified
**Production base:** `<commit>` (from classes.json) · **Design head:** `<commit>`
**Backend impact:** none | unwired (developer approval needed) | conceptual (cannot port while the backend is frozen)
**Approvals raised by the export:** none | build-impact | behaviour-impact (fingerprint differences listed in behaviour.md)

## Intent
What changes for the user, in two or three sentences. Why now.

## What moved
- Component or screen: what changed, and what deliberately stayed.

## Review surfaces
Before: the Storybook deployment of the design main at the recorded base.
After: this branch's deployment.
- `screens-review-queue--committee`
- `screens-review-queue--counsel`

## Scenarios and handlers
- Scenarios added or changed, and why.
- Handlers added or changed (see handlers.md): routes already wired / present but unwired / absent.

## Evidence
- `dsn-0000.patch`, `classes.json`, `drift.txt`, `structure-diff.md`, `shots/`, `stories.json`.

## Known compromises
What the design could not do without a behaviour or backend change, and what was done instead.
