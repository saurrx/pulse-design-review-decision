# DSN-0001: Tokens and foundations

**Status:** proposed, awaiting three confirmations before any token changes
**Production base:** `6d10ae9` (upstream/main at the fork point) · **Design head:** `db73cd8` (main at branch creation)
**Backend impact:** none
**Approvals raised by the export:** build-impact expected (index.html font link, tailwind.config.ts, tools/tokens.mjs)

## Intent
Make PL-TKN-004 the single token source of the product: colour, type, spacing,
radius and shadow defined once in a portable path, generated into what the
existing components already read (the `pl.*` Tailwind colours and the
`--pulse-*` variables), and rendered as Foundations stories at the five review
widths. No screen composition changes in this record. This is the pilot of the
export, the port recipe and the re-record.

## Scope
- Token source under `src/styles/` with a generator at `tools/tokens.mjs`
  (both new; production has neither), outputs consumed by `tailwind.config.ts`
  and `src/index.css`. Existing component classes and variables keep their
  names, so no component file changes.
- Fonts vendored under `public/fonts/` with their licence files; the Google
  Fonts link in `index.html` removed.
- Foundations stories (`Foundations/...`) that render colour, type, spacing and
  status vocabulary from the token source, with V0 review-width tags.
- Out of scope: any page, primitive restyle beyond what the tokens imply,
  dark mode, DSN-0002 chrome.

## The three confirmations, with evidence (3 September 2026)

### 1. Green and red: the sheet beats the shipped values
WCAG contrast on white, ratio to one:

| Colour | Value | On white | White text on it |
|---|---|---|---|
| Sheet green | #1E7B4D | 5.26 | 5.26 |
| Shipped green (`--pulse-success`, `pl.green`) | #2F8D70 | 4.07 | 4.07 |
| Sheet red | #B3362F | 6.03 | 6.03 |
| Shipped UI red (`--pulse-danger`) | #A5443C | 6.01 | 6.01 |
| Shipped chart red (`--pulse-data-risk`, `pl.red`) | #C96558 | 3.83 | 3.83 |

The sheet's green passes AA for normal text and as a fill with white text;
the shipped green fails both (4.07 against 4.5). The sheet's red and the
shipped UI red are equivalent; the shipped #C96558 is a chart colour and
fails as text. Tints and the `-text` variants are identical in the sheet and
in production. Production uses the shipped colours mostly as borders and
fills, where either set passes. Recommendation: adopt the sheet's green and
red; keep #C96558 only as a data-series colour if the charts still need it.
The brand amber #F9B418 is 1.82 on white and stays a mark, never text; the
sheet's amber-text #7E5A00 is 6.27.

### 2. Fonts: vendor them
Production loads Instrument Sans from Google Fonts at runtime. The fork
already serves it from vendored WOFF2 (176 KB for four weights, two subsets)
so screenshots are deterministic and the egress rule stays strict. In
production, vendoring removes a third-party request from every user's
browser (a privacy exposure European courts have treated as a GDPR issue),
removes two CSP hosts, and makes the page's first paint independent of Google.
Every face involved (Instrument Sans, Newsreader, Schibsted Grotesk, IBM Plex
Mono) is SIL Open Font License 1.1, which permits self-hosting; the licence
text must ship beside the files (the fork's `design/fonts` lacks it today and
this record adds it). Recommendation: yes, inside this record.

### 3. Typography: keep the sheet's system, compare only on a found defect
PL-TKN-004 specifies three families: Newsreader (serif display for headlines
and human prose), Schibsted Grotesk (interface), IBM Plex Mono (references,
dates, citations). Production ships Instrument Sans alone. The sheet's pairing
already expresses the V0 character in product-context (human, precise,
credible, professionally expressive) and it is the founder-validated binding
starting point; an open comparison would re-litigate a made decision.
Recommendation: keep the sheet's three families as the V0 baseline. This
record renders them in the Foundations stories at 1280, 1366, 1440, 1920 and
200% zoom and checks the two things that could justify a change: tabular
figures in dense tables and the serif's fit on legal surfaces. Only if one of
those fails does the record compare exactly two alternatives for that one
role (for the interface face, IBM Plex Sans, which pairs natively with the
mono, and Source Sans 3), rendered in the same specimen, with the founder
choosing.

## What moved
Nothing yet.

## Review surfaces
Before: the Storybook deployment of the design main at `db73cd8`.
After: this branch's deployment.
- `foundations-tokens--colors`, `foundations-tokens--typography`,
  `foundations-tokens--spacing`, `foundations-tokens--status-vocabulary`
  (new V0 Foundations stories; the Legacy reference foundations stay as they are)

## Scenarios and handlers
None. Tokens need no data.

## Evidence
To be produced by the export: `dsn-0001.patch`, `classes.json`, `drift.txt`,
`shots/`, `stories.json`, the fingerprint report.

## Known compromises
None yet.
