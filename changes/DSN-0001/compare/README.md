# Rendered implementation beside the specification

Left column: the approved PL-TKN-004 page rendered in Chromium at its own 1240 px width (`spec-*.png`). Right column: the V0 Foundations story at 1440×900 (`impl-*.png`), rendered from the token source. The product language differs by design (product-context wins on words); the visual treatment must not.

| Specification section | Implementation story |
|---|---|
| `spec-sec-1-color-system.png` | `impl-color.png` (`foundations-tokens--color`) |
| `spec-sec-2-typography.png` | `impl-typography.png` (`foundations-tokens--typography`) |
| `spec-sec-3-status-semantic-system.png` | `impl-status-semantics.png` (`foundations-tokens--status-semantics`) |
| `spec-sec-4-components-in-context.png` | `impl-buttons-and-inputs.png` (`foundations-tokens--buttons-and-inputs`) |
| `spec-sec-5-data-table-application.png` | `impl-dense-tables.png` (`foundations-tokens--dense-tables`) |

Token-by-token equality with the specification is asserted by `qa/v0/tkn004.test.ts` on every run: the 28 colour cards, the three families, every colour the specification draws with, and every product type style in its specimens.
