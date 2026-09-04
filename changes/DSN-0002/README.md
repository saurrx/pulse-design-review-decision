# DSN-0002: Workspace Admin dashboard, stat strip and cleanup

**Status:** proposed
**Production base:** `a14da2e` (upstream/main at the sync) · **Design head:** see `classes.json` after export
**Backend impact:** conceptual (BF-5, `docs/architecture/CONTEXT-RECONCILIATION.md` R-15)
**Approvals raised by the export:** behaviour-impact (see `behaviour.md`): a role condition moves in `src/pages/Index.tsx` and `src/components/DashboardLayout.tsx`; the new `WorkspaceAdminOverview.tsx` carries the three dashboard reads, their query keys and six navigation targets (two of them new: `/patents?jurisdiction=…` and `/workspace`; `/ideas?date=quarter` is the third new target); `TopInventors` gains the `v0` props

## Intent
The Workspace Admin opens Home to see what needs a decision and to read program
and portfolio health in one glance. Today program health is spread across
three panels (pipeline bars, cumulative chart, portfolio donut) and never lands
as a single answer, and seven containers compete. This record puts five scoped
numbers in one row (awaiting review, Actions due, total, granted and pending
patents; the founder dropped the "submitted this quarter" box on 4 September
2026 after the first render), every number a link to the list it counts, drops the panel
count from seven to five, and makes **Open queue** on the Review Inventor Ideas
panel the only primary button on the page. Emotional target: focused and
decisive first, then informed. Calm, not busy.

Persona: Workspace Admin. Job: clear the review queue and know whether the
invention program is moving. Product objects: Ideas (workspace scope),
Patents (company portfolio), Actions. Consequence of the primary action: the
Ideas list filtered to pending review, oldest first. Success signal: time from
Home load to the first queue click, and the pending-review age trend.

Directions were explored and decided in the design chat before this record
(queue-first, attention rail, stat strip); the stat strip was chosen because
it answers both jobs without adding a panel.

## Founder overrides recorded for this pass
Explicit decisions that override product-context for V0. They are non-goals
here and are not defects on the scorecard. Revisit all three in a later record
once V0 usage evidence exists.
1. The patent world map stays on this dashboard as **Patents worldwide**
   (overrides AGENTS.md, SCREENS.md and the surface brief; recorded in R-07).
2. The **Top inventors** ranking stays (overrides DESIGN-PHILOSOPHY.md section 9
   and the FOUNDER-FEEDBACK.md motivation guidance).
3. The queue panel and the navigation item are labelled **Review Inventor Ideas**.

## What moved
- `src/pages/Index.tsx`: a wrapper sends a Workspace Admin (backend role
  LEGAL_COUNSEL) to the new Overview; every other role keeps the composition
  it had, so production's routes and the Legacy reference tier are untouched.
- `src/components/dashboard/WorkspaceAdminOverview.tsx` (new): the three rows.
  Row 1 the stat strip; row 2 Patents worldwide (wide) and Top inventors
  (narrow); row 3 Review Inventor Ideas (wide) and Idea pipeline (narrow). The
  due-dates timeline that ended the admin page is not rendered for this
  persona: SCREENS.md gives the Workspace Admin no due-dates destination and
  the Actions box is the sanctioned contextual alert.
- `src/components/dashboard/StatStrip.tsx` (new, dashboard-local): the box
  with a coloured top rule, metric label, metric value and one qualifier, the
  whole box a link with a visible focus ring and a spoken accessible name
  ("Awaiting review, 7, oldest 56 days"). The two groups, "Your workspace" and
  "Company portfolio", are named for assistive technology only; the founder
  dropped the visible overlines on 4 September 2026. One row of five from 1280 CSS pixels; below that (200%
  zoom) each group takes its own row. Type and colour come from the token
  source (`--pl-type-metric-*`, `--pl-type-caption`, `--pl-type-kicker`,
  `--pl-amber`, `--pl-red`, `--pl-navy-2`, `--pl-green`, `--pl-border-strong`).
  It graduates to `src/components/ui` with its own record when a second
  dashboard adopts it.
- `NeedsReview` in `DashboardStats.tsx`: a `v0` option renders the queue as a
  real table (Ideas · Inventor · Score · Age), six rows then "Review all →",
  the score as `8.1` in bold or a dash with the accessible text "Not
  evaluated", the age as `56d` and red with the word "waiting" only past the
  30-day threshold, the row link named by the idea title, the caught-up copy
  "Nothing waiting for your review." with a link to Workspace › People. The
  "1+ pending action" footer and the rainbow top rule are gone in this mode.
  The header keeps the primary **Open queue →** button.
- `IdeaPipeline`: an "All time" period label, an `h2` title, and the sublabel
  "oldest waiting 56d" under Review pending. There were no "with outside
  counsel" or "usually 1–3 months" sublabels in this component to remove.
- `TopInventors`: a `v0` option with rows per period (This quarter, the
  default, matching the strip; All time), the Ideas | Patents toggle stated by
  weight, underline and `aria-pressed`, rank badge, truncated names with the
  full name as the title, and the empty copy "No submissions this quarter yet."
  linking to Workspace › People. The Not yet active list and Nudge are not
  rendered for this persona.
- `PatentWorldMap`: a `v0` option with the title "Patents worldwide", the
  subtitle "23 patents · 2 jurisdictions", a visually hidden jurisdiction list
  as the text alternative, and a country click that opens the Patent Portfolio
  for that jurisdiction. Zoom in, zoom out and expand keep their accessible
  names. The map is the last panel to load; the strip and the queue never
  wait for it.
- `Sidebar.tsx`: the Workspace Admin's queue item reads "Review Inventor Ideas".
- `DashboardLayout.tsx`: the Workspace Admin's page title is "Overview"; the
  header already carries the workspace name as its eyebrow.

## What stayed, deliberately
- The Inventor, Case Owner and Photon Admin dashboards, unchanged.
- The cumulative chart, the donut, the Nudge control and the due-dates
  timeline stay in the codebase for the other roles; nothing is deleted.
- Existing navigation targets: the awaiting box, the queue button and the
  footer all go to `/ideas?status=UNDER_REVIEW,SENT_TO_IHC`, the granted box
  and the granted stage to `/patents?status=ACTIVE_GRANTED`, Actions to
  `/due-dates` (the Workspace Admin's Actions destination, R-08).

## Copy
Overview · Awaiting review · Actions due ·
30 days · Total patents · Granted (of N patents) · Pending patents (applied or
in examination) · Patents worldwide
· Top inventors · Review Inventor Ideas · Open queue → · Review all → · Idea
pipeline · Nothing waiting for your review. · None due in 30 days · No
submissions yet this quarter · No patents added yet. Trend reads `+4 vs last
quarter`, `−4 vs last quarter` or `no change vs last quarter`. No identifier
is rendered; references and names only.

## Scenarios and handlers
- `mock/handlers/dashboard.ts`: under `flags.v0` the `/v1/dashboard` answer
  carries `workspace` (awaiting review, oldest wait, Actions due in 30 days
  with the next date, submissions this and last calendar quarter, patents
  filed this quarter), `top_inventors` per period and
  `patents_by_jurisdiction`. Declared in `mock/proposed-fields.json` as BF-5.
  The existing adapter rule passes the extra fields through unchanged; the
  adapter itself is untouched. Nothing is counted in the browser from a paged
  list; a missing aggregate renders as a dash and "not available".
- `mock/scenarios/v0/index.ts`: the queue scenario gains one idea waiting 56
  days (seven awaiting, oldest past the threshold). New Workspace Admin
  scenarios: `one-urgent-review`, `large-aging-queue` (40 waiting),
  `no-actions-due`, `quiet-quarter` (none this quarter, four last quarter),
  `empty-portfolio`, `single-inventor`, `long-titles`. `IdeaSpec` gains a
  `title` override; `personas.ts` gains an inventor with a long name.
- No-pending-reviews uses `v0/workspace-admin/empty`; loading uses
  `v0/shape/slow`; data-unavailable overrides `/v1/dashboard` with a 500 in
  the story.

## Stories
`design/stories/surfaces/WorkspaceAdminDashboard.stories.tsx`, title
`Surfaces/Workspace Admin dashboard`, tagged `redesign`:
`typical`, `no-pending-reviews`, `one-urgent-review`, `large-aging-queue`,
`no-actions-due`, `no-submissions-this-quarter`, `empty-portfolio`,
`single-inventor`, `long-titles`, `loading`, `data-unavailable`,
`width-1280`, `width-1366`, `width-1440`, `width-1920`, `zoom-200`,
`reduced-motion`. The play functions assert both queue controls, the spoken
names of the five boxes, the six-row cap, the overdue marker and the absence
of the removed panels.

## Known compromises
- **Pending link.** The Patent Portfolio takes one `status` value; the
  pending box links to `ACTIVE_APPLIED,ACTIVE_EXAMINATION` and lands on the
  unfiltered list until the page accepts a list. The quarter aggregates
  (`submitted_this_quarter`, `submitted_last_quarter`) stay in BF-5 for the
  Top inventors period selector; the strip no longer shows them.
- **Jurisdiction link.** The Patent Portfolio has no jurisdiction filter
  parameter yet; `/patents?jurisdiction=US` lands on the full portfolio. The
  portfolio brief already places jurisdiction filters there; the parameter is
  the contract this record proposes.
- **Actions box.** The Workspace Admin's Actions destination is `/due-dates`
  (R-08); it has no 30-day window parameter, so the link lands on the full
  list.
- **Legacy tier.** A LEGAL_COUNSEL viewer in a legacy scenario now gets the
  Overview too, with dashes where the V0 aggregates are absent. The Legacy
  reference dashboard story for counsel and the `LEGAL_COUNSEL_index`
  conformance baseline are re-recorded.
- **First paint.** The user cookie resolves in an effect, so the role branch
  renders the legacy shell for one frame before the Overview; nothing has
  loaded by then.

## Assumptions accepted
- The aging threshold for a red age is 30 days.
- "Pending" in the Granted box means applied or in examination (the adapter's
  `pending_patents`), not closed.
- Quarters are calendar quarters, not trailing 90 days.

## Business measurement
Goal: faster review decisions and visible program health. Signal: time from
Home load to the first queue or row click; pending-review age trend. Metric:
median submission-to-decision time; share of pending reviews older than 30
days; Actions submitted before the due date. Guardrail: approval and
request-changes rates stay in their normal range; submission count must not
rise from empty drafts.

## Rendered inspection
Inspected at 1280×720, 1366×768, 1440×900, 1920×1080 and 200% zoom (640×360
at scale 2), from the story screenshots under `shots/`.
- 1280: five boxes in one row; the Top inventors header
  first wrapped to three lines, so the period selector moved under the
  subtitle and the header wraps cleanly. The map, the queue and the pipeline
  hold their grid.
- 200% zoom: production's desktop floor (`body { min-width: 1024px }` above
  639 CSS pixels, a locked decision) makes the page pan sideways at 640 CSS
  pixels; within the 1024-pixel layout the strip stacks into its two groups
  and nothing inside the strip overflows. The brief's "no horizontal scroll at
  1280+" is therefore met by the strip, not by the page, which pans by
  production's own rule.
- Loading: the strip, the queue, the pipeline and the ranking all show
  skeletons at final size; the first render showed zeros and the caught-up
  copy, which is fixed. The map loads last and says so.
- Data unavailable: five dashes with "not available", one status line with
  Retry, "Not loaded" on the map subtitle, "Could not load top inventors."
  with Retry; the queue loads on its own.
- A first version faded the boxes in with an opacity animation; the a11y run
  sampled the strip mid-fade and reported contrast failures on every box. The
  entrance is now a transform-only rise of six pixels over 240 ms, staggered
  40 ms per box, static under reduced motion, so contrast is final from the
  first frame.

## Scorecard (product-context/DESIGN-SCORECARD.md)
| Category | Score | Note |
|---|---|---|
| Product fit | 4 | Persona, job and business behaviour named; V0 permissions preserved (dates only in the Actions box, no import or edit on the portfolio). The map and the ranking score as recorded founder decisions, not as defects. |
| Hierarchy | 4 | One primary button; the strip answers both jobs in one row; scope is stated by the two overlines. The map still takes the widest slot in row 2 by the founder's decision, which keeps the queue in row 3. |
| Usability | 4 | Every number is a link; loading, empty, error, dense and long-content states rendered and asserted. Three links land on lists that cannot yet filter to the number (quarter, jurisdiction, 30-day window), recorded as compromises. |
| Trust | 4 | No guarantee or service promise; the score keeps its /10 scale; an unevaluated idea reads as "Not evaluated", never as zero; a failed load is a stated failure, never a zero. |
| Craft | 4 | Type, colour and spacing from the token source; the legacy rainbow rule and the "1+ pending action" footer are gone; the segmented toggle and the native select are the two control styles on the page. |
| Accessibility and resilience | 4 | Landmarks per panel with `h2`s, a real table with headers, spoken names on every box, the age and the rule colours have text equivalents, zero axe violations in the redesigned content at all five widths. The 200% case is governed by production's desktop floor. |
| Business | 4 | Faster decisions are measured by time to first queue click and by the age trend; the guardrail is the approval and request-changes rates. |

Largest remaining gaps: the three list links that cannot filter yet (BF-5),
and the sidebar's role caption "In-house counsel" under the user's name,
which is production's role label in `src/lib/roles.ts` (behaviour-impact
class) and belongs to a navigation record, not this one.

## Findings for production
- The role caption under the user's name still reads "In-house counsel";
  the V0 persona name is Workspace Admin (PRODUCT-VOCABULARY.md). Label
  change in `src/lib/roles.ts`, behaviour-impact class.
- The Workspace Admin's first navigation item reads "Overview"; SCREENS.md
  lists it as "Home". Not changed here because the brief fixed the page
  title as Overview; a navigation record should settle the pair.

## What the re-record showed
- Screenshots: 17 new baselines for this surface; the two Legacy reference
  counsel dashboards (`legal-counsel`, `large-portfolio`) changed because a
  LEGAL_COUNSEL viewer now gets the Overview; before and after pairs are in
  `shots/`. No other baseline moved.
- Conformance: the seven LEGAL_COUNSEL surfaces re-recorded (the navigation
  label moved on every page, the dashboard's structure changed) and the
  TECH_COMMITTEE dashboard (the Top inventors toggle now carries
  `aria-pressed`, which the signature records as `button:ideas+pressed`). The
  `/patents`, `/due-dates` and `/actions` style drift reported for every role
  comes from the upstream toolbar change in the a14da2e sync, not from this
  record, and is left for the sync's own re-record.
- Accessibility: zero violations in the redesigned content. The ratchet
  baseline was re-recorded: one fingerprint moved because the sidebar label
  changed; the other 32 moved because the sync changed copy on the draft
  workspace and idea details screens.

## Evidence
`shots/`, `gates.txt`, and the export's `dsn-0002.patch`, `classes.json`,
`drift.txt`, `behaviour.md`.
