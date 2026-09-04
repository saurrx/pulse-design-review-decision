# DSN-0000: Title

**Status:** proposed | in review | approved | merged
**Surface:** `product-context/surfaces/<brief>.md` · **Personas:** …
**Base:** `<commit on main>` · **Head:** `<commit>`
**Mock additions:** none | routes/fields added (list them; declared in `mock/proposed-*.json`)

## Intent
What changes for the persona, in two or three sentences. Which funnel step it
serves (product-context/METRICS.md) and the intended emotion.

## Persona frame
Persona, triggering situation, job, current friction, desired outcome,
primary action and its consequence, what the persona never needs to read here.

## Directions considered
| | Direction | What leads | What recedes | Cognitive-load verdict | Risk |
|---|---|---|---|---|---|
| A | familiar | … | … | … | … |
| B | bolder | … | … | … | … |
| C | simplest | … | … | … | … |

**Chosen:** X — why it carries the least load for this persona on this screen,
and what was given up.

## What moved
- Component or screen: what changed, and what deliberately stayed.

## Stories
- `surfaces-<brief>--<state>` … (every state the brief lists; legacy stories removed: …)

## Evidence
`shots/` per viewport; gate log summary (`node tools/design/gates.mjs`).

## Scorecard
Product fit · Hierarchy · Usability · Trust · Craft · Accessibility · Business — score
each 1–5 and explain anything below 4. Cognitive-load check: pass/fail per
`design/v0/COGNITIVE-LOAD.md` with the persona roleplay notes.

## Known compromises
What the design could not do without a decision the founder must make, and
what was done instead.
