# DSN-0003: Border-radius token scale

**Status:** proposed
**Production base:** `a14da2e` (upstream/main at the sync) · **Design base:** `7b775fc` (the tooling commit: gate, R-16, exporter) · **Design head:** `501c023`, see `classes.json`
**Backend impact:** none
**Approvals raised by the export:** build-impact (`tailwind.config.ts`, `tools/tokens.mjs`); behaviour-impact (`src/contexts/BackgroundAnalysisContext.tsx` is a behaviour-impact path, its change is six radius classes on the floating panel; and the fingerprint diff in `behaviour.md`, which lists lines that mention a role name and now carry a different radius class in `ClientInviteDialog.tsx` and `CaseOwnersTab.tsx`; no condition, query, payload or navigation target moved)

## Intent
Every corner in Pulse was 2px (production's Tailwind theme resolved all nine
`rounded-*` steps to `pl-radius 2`) while the pages still carried nine
different radius names and a handful of raw pixel values, so the product read
as legacy enterprise software with no consistent shape language. This record
adds a five-step radius scale to the token source and applies it once per
element class across every surface: chips and tags `xs`, controls `sm`,
cards and panels `md`, overlay surfaces `lg`, circular markers `full`. No
layout, copy, colour, spacing, shadow or behaviour changes.

Persona: all four. Job: unchanged; the record is a design-system change with
no new product behaviour. Success signal: the design scorecard's craft and
consistency rows on every following surface record, and the radius gate
staying green.

## Founder direction recorded for this pass
PL-TKN-004 defines a single 2px radius ("the squared system"). The founder's
brief of 4 September 2026 replaces it with the scale below; the token source
carries a `_note` on the `radius` block, the reconciliation record is R-16 in
`docs/architecture/CONTEXT-RECONCILIATION.md`, and the specification document
itself is untouched (its checksum still gates `qa/v0/tkn004.test.ts`).
Finding for the specification owner: PL-TKN-004 should carry the scale in
its next release.

## Tokens
`src/styles/tokens.json` → `radius` (generated into `--pl-radius-*` in
`src/styles/tokens.css`, the `radius` object in `src/styles/tokens.tailwind.ts`,
and `--radius` for the shadcn theme, which now equals `sm`):

| Token | Value | Use |
|---|---|---|
| `xs` | 4px | chips, badges and tags that are not circular, table row hover, tooltips, items inside an inset segmented control |
| `sm` | 6px | buttons, inputs, selects, textareas, comboboxes, segmented toggles, menu items |
| `md` | 8px | cards, panels, stat boxes, sidebar active item, upload dropzone, evidence cards, table container |
| `lg` | 12px | dialogs, popovers, dropdown menus, toasts |
| `full` | 9999px | avatars, count badges, status dots, circular icon buttons |

`tailwind.config.ts` sets `theme.borderRadius` to exactly this scale (each
step resolves to its `var(--pl-radius-*)`), so `rounded-xs|sm|md|lg|full|none`
and their side and corner variants are the only radius utilities that exist.
`rounded`, `rounded-xl`, `rounded-2xl`, `rounded-3xl` and arbitrary values no
longer compile to anything, and the gate below refuses them in source.

## What moved
- `src/components/ui/*` (the primitives): Button `sm` for every size (was
  `xl`, with `lg` and `xl` per size); Input, Textarea, Select trigger,
  Command input `sm`; Card `md`; Dialog, AlertDialog, Popover, Dropdown and
  Select content, Toast, Command surface `lg`; Dialog and Toast close buttons
  and Toast action `sm`; Tooltip `xs`; Badge, StatusChip and ProductChip `xs`,
  the ProductChip count variant `full`; Tabs list `sm` with triggers `xs`
  (inset control, nested rule); Checkbox `xs`; Switch, Radio, Progress,
  scroll thumb unchanged at `full`. `product-surfaces.ts`: card `md`,
  segmented control `sm` with items `xs`.
- `src/index.css`: the toolbar and table containers, auth card and product
  cards `md`; the filter button and the table-page inputs `sm`; the scrollbar
  thumb `full`; every raw `border-radius` now references `var(--pl-radius-*)`.
- 66 component and page files under `src/components/**` and `src/pages/**`:
  every radius utility re-assigned by element class (543 lines touched, only
  the radius token on each). Inline `<style>` strings in `PatentsPage.tsx`
  and `DueDatesCalendar.tsx` now use the token variables.
- Rule 3 (top rules clip): the `StatStrip` box and the legacy NeedsReview
  panel give their coloured rule `rounded-t-md` inside an `overflow-hidden`
  `md` container. Rule 4 (grouped controls): the world-map zoom group and the
  invite-link + Copy group round their container only. Rule 5: no cell
  carried a radius; row-hover surfaces are `xs`. Rule 8: skeletons take the
  radius of what they stand for (row lines `xs`, buttons `sm`, cards `md`,
  avatars `full`).
- Pill-shaped text chips (`rounded-full` with horizontal padding: status
  pills, client and role tags, co-inventor chips, filter chips) become `xs`;
  count badges, status dots, avatars and circular icon buttons stay `full`.

## What stayed, deliberately
- `src/components/ideas/PatentReportDocument.tsx`: react-pdf styles render a
  PDF and cannot read a CSS variable; its two numeric radii stay and the gate
  lists the file as the one exception.
- Colour, type, spacing, borders, shadows (none) and every layout.
- Focus rings: Tailwind `ring-*` and `outline` already follow the element's
  border-radius, so no ring needed a change; the Radius story asserts the
  primitives' computed radii.

## Gate
`qa/v0/radius.test.ts` (runs in `npm run test:v0`, in the gate runner):
the scale has the five steps; Tailwind's `borderRadius` theme is exactly the
scale; no product file uses a legacy or arbitrary `rounded` utility; no
product file writes a raw `border-radius` or inline `borderRadius`; the
generated css carries every step.

## Stories
- `design/stories/foundations/Radius.stories.tsx`, title `Foundations/Radius`,
  story `scale`, tagged `redesign` and the five review widths: every token as a
  labelled swatch, then the nested rule on a real Card with Input, Button and
  Badge, three top-rule stat boxes, a joined button group and an input + button
  group, a table with a square-celled hovered row, and a skeleton set. The play
  function reads computed styles: card `md`, input and button `sm`, badge `xs`,
  the control tighter than its card, top-rule containers `overflow: hidden`,
  grouped controls rounded on the outer corners only, cells `0px`.
- `Foundations/Tokens` re-rendered: its radius section shows the element
  classes and points to `Foundations/Radius`; its buttons, tags, cards and
  banners read `radius.sm|xs|md`.
- Every existing primitive story (Button, Input, Card, Badge, Dialog, Tabs,
  Checkbox, ...) and every Legacy reference screen re-rendered; 197 story
  tests pass. `PatentFieldsForm.stories.tsx` selects the inventor chip by
  `rounded-xs` now.

## Evidence
- `dsn-0003.patch`, `classes.json`, `drift.txt`, `behaviour.md`, `gates.txt`.
- `shots/before/`: the committed baselines at `2c49326` for the Workspace
  Admin dashboard (typical), the disclosure workspace (inventor nearly done),
  the review decision (counsel review queue), the Ideas table (case owner)
  and the Patents table (counsel), plus the two foundations pages at 1440.
- `shots/after/`: the same stories from this branch's re-recorded baselines.
- Screenshot baselines under `qa/visual/baselines` re-recorded for every
  story (each corner changed), review support only.

## Rendered inspection
From the re-recorded baselines (`Foundations/Radius` at 1280, 1366, 1440,
1920 and 200% zoom; the five evidence surfaces at 1440×900).
- Foundations/Radius: the five swatches read as five distinct steps at every
  width; at 200% zoom the grid reflows to two columns and nothing clips.
  The button inside the card is visibly tighter than the card; the three
  top rules end inside the corner; the joined group shows square inner joins
  and rounded outer corners; the hovered table row has square cells.
- Workspace Admin dashboard: the five stat boxes carry their rule inside the
  8px corner, the sidebar's active item is 8px, the map zoom group rounds its
  container only, the Ideas | Patents toggle sits inset with 4px items, the
  count badge stays circular, the queue's primary button is 6px.
- Ideas list (Case Owner): search, filter and sort controls 6px; idea cards
  8px; score and status chips 4px; the pagination page button 6px.
- Disclosure workspace (Inventor): prefill banner and side panels 8px, both
  buttons 6px, the "In draft" chip 4px, the readiness bar circular.
- Review queue (Workspace Admin): both panels 8px, the "Review 5" filter
  chips 4px, the keyboard hints 4px, the footer actions 6px, the empty
  evidence box 8px inside its 8px card (rule 2 over rule 1 for panels).
- Focus: Tailwind rings follow the new corners everywhere they were checked
  (Radius story play, primitive focus stories); no square ring remains.
- Nothing else moved: pixel diffs against the previous baselines are corners
  only, which is why every baseline was re-recorded rather than a subset.

## Scorecard (product-context/DESIGN-SCORECARD.md)
| Category | Score | Note |
|---|---|---|
| Product fit | 4 | No persona, permission or screen changes; V0 boundaries untouched. Scored as a system record, not a surface. |
| Hierarchy | 4 | One task per screen unchanged; radius no longer competes for attention (nine steps became five, one per class). |
| Craft | 4 | Every corner references a token; nested, top-rule, grouped, cell and skeleton rules hold in the rendered result and are asserted by the story. |
| Trust and credibility | 4 | Calmer, more current shape language without loud curvature; the 12px overlay step is the largest and is reserved for overlays. |
| Accessibility | 4 | No new axe violations (ratchet: 209 inherited, 0 new); focus rings follow the corners. |
| Motion | n/a | None added. |
| Copy | 4 | Story labels use product vocabulary and product objects only. |
| Largest gap | | PL-TKN-004 itself still says 2px; the specification owner should carry the scale in the next release (finding, R-16). |

## Porting order
This record stacks on DSN-0001 (tokens) and DSN-0002 (Workspace Admin
dashboard): it edits `src/styles/tokens.json`, `StatStrip.tsx`,
`WorkspaceAdminOverview.tsx`, `TopInventors.tsx` and `DashboardStats.tsx` in
the shape those records left them. The exporter's dry run on bare production
(`drift.txt`) therefore reports conflicts in exactly those files; the patch
applies cleanly after DSN-0001 and DSN-0002 are ported, in that order.

## Gate run
`gates.txt`. Green: typecheck, lint:roles, routes, credentials, manifest,
fingerprint self-test, tokens check, fidelity, V0 semantic gate (33 tests
including the new radius gate), coverage matrix, build:design,
storybook:build, test:stories (197), shots twice-stable against the
re-recorded baselines, a11y ratchet (0 new, 209 inherited), smoke, crawl,
desktop gate, no visible uuid. Two gates carry findings that are not this
record's: the layout invariant flags 14 sr-only clippings on the Workspace
Admin dashboard (DSN-0002 content at the base), and the conformance
structure baseline was re-recorded, absorbing 244 radius deviations (this
record) together with ~55 toolbar padding, colour and weight drifts and the
stat-strip link signatures that were already present at the base with zero
radius deviations. Listed here so the next reviewer of DSN-0002 knows the
baseline moved under it.

## Known compromises
- The brief's rule 1 (nested = outer − padding) and rule 4 (grouped controls
  square inside) meet in inset segmented controls (container with padding,
  items that do not touch): items take `xs`, the floor, rather than square
  joins. Joined groups (items touching) use side variants.
- Legacy reference screens are restyled too, because the primitives and the
  shared css are theirs as well. They remain reference material; nothing in
  them is V0 copy.
- A `.actual.png` set of 46 files was already tracked under
  `qa/visual/baselines` before this record; they are not touched here.

- `src/App.tsx` is off-limits for a design branch; its chunk-reload fallback
  button keeps `rounded`, which no longer resolves, so it renders square until
  production changes it to `rounded-sm` (production finding). The gate exempts
  the file for that reason.
- `NotFound.tsx` had no story; `Legacy reference/Screens/Not found` is added so
  the exporter's reach check sees the page (review support).

## Assumptions accepted
- The founder's table wins over PL-TKN-004's 2px where they conflict, per the
  brief's own instruction; the specification's other values are untouched.
- A pill-shaped text chip is a chip (`xs`), not a circular marker.
- Icon tiles (square icon boxes inside cards) are controls-sized nested
  elements (`sm`), not image frames.
