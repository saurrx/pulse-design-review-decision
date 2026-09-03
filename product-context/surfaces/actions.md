# Actions

## Personas

Workspace Admin, Case Owner, Photon Admin. Never Inventor.

## Job

- Workspace Admin: decide and submit the client's instruction for an upcoming
  patent event.
- Case Owner/Photon Admin: receive, process, and update client requests.

## Client-side hierarchy

- Patent/application
- Upcoming event and deadline
- Days remaining
- Allowed action options
- Country selection when relevant
- Saved/submitted state
- Photon request status

## Photon-side hierarchy

- Urgency and deadline
- Client and patent
- Submitted instruction and countries
- Submitter
- Request status and next operational action

## Rules

- Due dates live here and in patent detail for Workspace Admin.
- No separate client Due Dates navigation.
- No navigation badge; use contextual alerts on relevant dashboards.
- No purchasing, checkout, pricing, or invoice controls.
- Do not expose Actions to Inventors.
- Every status update clearly states who owns the next step.

## States

No action, action required, saved draft, submitted, updated, acknowledged,
in progress, completed, declined, overdue, missing template/configuration,
submission error.

