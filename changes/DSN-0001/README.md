# DSN-0001: Tokens and foundations

**Status:** in review, awaiting the founder's visual approval of the rendered foundations
**Production base:** `6d10ae9` (upstream/main at the fork point) · **Design head:** see `classes.json` after export
**Backend impact:** none
**Approvals raised by the export:** build-impact (`index.html`, `tailwind.config.ts`, `tools/tokens.mjs`)

## Intent
Make PL-TKN-004 the single token source of the product: colour, type, spacing,
radius, borders and the absence of shadows defined once in a portable path,
generated into what the existing components already read (the `pl.*` and
`photon.*` Tailwind colours, the `--pulse-*` variables and the shadcn theme),
and rendered as V0 Foundations stories at the five review widths. No screen
composition changes in this record. This is the pilot of the export, the port
recipe and the re-record.

## Binding visual source
`design/v4/PL-TKN-004.html` is a byte-exact copy of the approved specification
(Pulse Product Tokens, v4 Photon Brand, release v4.0 of 2026-08-18, status
Approved), SHA-256
`548cc532b4d974d996f5ffe5b5c1556b19d24c1fd73e2947b6e315a12bb10a75`, supplied
by the founder on 3 September 2026. The checksum is recorded in
`src/styles/tokens.json` (`$source`) and verified by `qa/v0/tkn004.test.ts` on
every run. The token sheet in `pulse-redesign/tokens/tokens.css` was the first
reading; where the two differ the specification wins (display weight 600, H3
line 24, no shadows, the tag treatment).

## Authority and reconciliation with product-context
PL-TKN-004 controls colour, typography, spacing, radius, borders, shadows and
visual component treatment. product-context controls personas, workflows,
statuses, vocabulary, scope and business claims. Where the specification's
example content conflicts with product-context, the visual treatment is kept
and the language replaced:

| In the specification | Not carried into V0 because | V0 language used instead |
|---|---|---|
| "patent-management platform", "from invention disclosure to granted patent in 11 months", "Grant rate 97%", "Avg. time to grant 11 mo" | positioning and unverified claims; Pulse is not a patent-management system and makes no grant or timing promise | none; the specimens describe the invention program |
| "Sent to IP Committee", "Rejected by QC", "Cleared for filing", "In review", "Pending", "Review pending", "Update requested" | the six-role committee model and QC do not exist in V0 | Draft, Awaiting review, Changes requested, Rejected, Sent to Photon Legal, Filed, Granted, Closed |
| "Open docket", "Office action response due", "Docket 4,182 ideas", "Pending Office Actions", "§103 references", "NON-FINAL REJECTION · ART UNIT 2145" | drafting, filing and prosecution happen outside Pulse; docketing is not V0 | Actions vocabulary: "Instruction needed: renewal due in 12 days", "Open Actions" |
| "File provisional", "recommend provisional within 30 days" | Pulse gives no legal recommendation; the evaluation is advisory | "Approve & send", "Save draft", "every score can be submitted for review" |
| "94 / 100" novelty scores | the score is 0 to 10 | "6.8 / 10" |
| "Ideas screened", "IDEA-2618", "Dr. A. Venkatesan" | vocabulary and fixture rules | "Ideas submitted this quarter", "NWI-0042", the V0 personas |

Semantic rules 3.1.1 to 3.1.5 of the specification are applied to the V0
vocabulary: green is terminal success only (Granted, Completed); blue is
informational and in flight (Sent to Photon Legal, Filed, Submitted,
Acknowledged, In progress, Upcoming); amber is attention with an action pending
(Awaiting review, Changes requested, Action required, Due soon); red is blocking
or failed and always paired with a recovery action (Rejected with resubmission,
Overdue, Declined); slate carries no judgment (Draft, Closed, Saved draft).

## What moved
- `src/styles/tokens.json` (new): the canonical machine-readable source: the
  32 specification tokens (28 colours, three families, the radius), the type
  scale and the component styles the specimens use, the spacing scale, component
  paddings and sizes, the three inset outlines, shadows resolved to none, and
  the aliases and shadcn mappings the existing components read. Values not on
  the specification carry a `_note` (text-4, the two chart colours).
- `tools/tokens.mjs` (new): generates `src/styles/tokens.css` and
  `src/styles/tokens.tailwind.ts`; `--check` fails when they are stale.
- `src/index.css`: the literal `:root` block is gone; it imports `fonts.css` and
  `tokens.css`; table rules read `--pl-font-ui`. `tailwind.config.ts`: the
  `photon` and `pl` colour objects and `fontFamily` come from the generated
  module. Component class names and variable names are unchanged, so no
  component file changed.
- `public/fonts/`: Newsreader, Schibsted Grotesk and IBM Plex Mono, upright
  faces, latin and latin-ext, 340 KB in eight WOFF2 files, each family with its
  SIL Open Font License text; `src/styles/fonts.css` declares them.
  `index.html` loads nothing from Google Fonts and preloads the two faces the
  first paint needs.
- `design/stories/foundations/Tokens.stories.tsx` (new, review support): eight
  V0 Foundations stories rendered from the token source: Color, Typography,
  Spacing, Radius and borders, Status semantics, Buttons and inputs, Dense
  tables and tabular figures, Focus, disabled, loading and error states. Each
  is tagged for 1280×720, 1366×768, 1440×900, 1920×1080 and 200% zoom, and
  `redesign`, so the accessibility ratchet holds it to zero violations. The
  Typography and Dense tables stories assert in the browser that both the
  interface and the mono face set tabular digits and that the three vendored
  faces are the ones rendering.
- The 108 Legacy reference stories are unchanged as source. They render on the
  new foundations, so their screenshot baselines and the mock conformance
  baseline were re-recorded; four before/after pairs are kept under `shots/`.

## What stayed, deliberately (technical deviations)
1. **Body size.** The specification's body is 14/22 and production's is 15px
   with Tailwind's size utilities at 13/14/15/18/22/28. The tokens carry the
   specification's scale (`--pl-type-*`); the utilities and the body size are
   not changed in this record because a base-size change moves every screen's
   composition, which belongs to the screen records. The Foundations stories
   render the specification's scale exactly.
2. **Navy ground.** The specification's `pl-navy` is #040410 with `pl-navy-2`
   #11103C. Production's `--pulse-navy` alias resolves to `navy-2` as it did,
   and the sidebar composition is untouched; the token source carries both
   values for the screen records.
3. **Shadows.** Resolved to `none` because the specification separates every
   surface with an inset hairline. Overlays that relied on elevation keep their
   hairline; if a screen record needs elevation it adds it there.
4. **Chart colours.** `data-cyan` and `data-ai` are not on the specification
   and are kept for chart series only, marked in the source.
5. **Italic faces** are not vendored; the specification uses none.

## Review surfaces
Before: the Storybook deployment of the design main at `db73cd8`
(https://pulse-design-storybook.vercel.app, Legacy reference on production's
foundations). After: this branch's preview deployments, recorded in
`previews.json`: Storybook at
https://pulse-design-storybook-gy9dnz47o-s-5ecc81c4.vercel.app (start at
Foundations/Tokens) and the full app on mock data at
https://pulse-design-1pnwr07wn-s-5ecc81c4.vercel.app. The production URLs
still serve main; nothing is merged.
- `foundations-tokens--color`, `foundations-tokens--typography`,
  `foundations-tokens--spacing`, `foundations-tokens--radius-and-borders`,
  `foundations-tokens--status-semantics`, `foundations-tokens--buttons-and-inputs`,
  `foundations-tokens--dense-tables`, `foundations-tokens--states`, each at the
  five widths (`--at-1280x720` … `--at-640x360@2` in the baselines).
- Every `legacy-reference-*` story, as the restyled-by-tokens view of production.

## Scenarios and handlers
None. Tokens need no data.

## What the re-record showed
- Screenshots: all 108 Legacy reference baselines changed (the family, the ink,
  the borders and the status colours moved on every screen); 40 new foundations
  baselines were recorded, eight stories at five widths; every render was
  stable across two clean passes with no egress.
- Conformance: 1,532 style deviations across the 31 surfaces before the
  re-record, every one a `style-drift` and none a missing or added signature.
  The re-recorded baseline differs from the committed one only in
  `fontFamily` (Instrument Sans to Schibsted Grotesk), `color` (the navy ink
  to the specification's ink and text greys, the old danger red to the
  specification's red) and `borderColor` (the old hairline to `pl-border`).
- Accessibility: zero violations in the foundations stories. On the Legacy
  reference stories the tokens removed 613 inherited colour-contrast
  fingerprints; the ratchet baseline shrank from 821 to 208 and was re-recorded
  so those cannot return.
- Layout invariants: 76 page and viewport combinations, 0 violations.

## Evidence
`gates.txt` (the full run), `shots/` (before and after pairs), the export's
`dsn-0001.patch`, `classes.json`, `drift.txt`, `fingerprint.txt`, and
`previews.json`.

## Corrections after the first visual review
- **Blank colour swatches (blocking, found by the founder).** The Color story
  composed each swatch as `{ background: token, ...hairline }`, and the
  `hairline` surface style carried `background: pl-bg`, so every swatch was
  painted white after its colour. Fixed by separating outline-only styles
  (`edgeHairline`, `edgeStrong`: outline, offset, radius, no background) from
  surface styles (`hairline`, `strong`: the edge plus the white ground); a
  swatch takes the edge and its own colour. No token, type or layout value
  changed. The Color story now carries a play function that reads every
  swatch's computed background and compares it with the hex it displays, and
  names pl-brand #F9B418, pl-navy #040410, pl-green #1E7B4D, pl-red #B3362F and
  pl-bg #FFFFFF explicitly; 31 of 31 swatches match. Only the five Color
  screenshots were re-recorded; no other baseline changed.

## Known compromises
The Legacy reference stories now show production's components on the new
foundations, which is the honest state of a token change: the components were
not redesigned, so tinted status pills and the old compositions remain until
their screen records. Nothing in `src/components` or `src/pages` changed.
