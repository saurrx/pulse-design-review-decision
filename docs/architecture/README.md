# Architecture record

`pulse-design-fork-v5.html` is the architecture this repository was built on:
the mock under the adapter, Storybook as the review surface, the QA tiers,
and — historically — the synchronisation and patch-based handoff to
`photonlegal/pulse-frontend`. In September 2026 the handoff model was retired:
this repository is the Pulse V0 codebase, the mock is its backend, and
changes are reviewed as ordinary pull requests. Sections of the document
about synchronisation, portable and protected path classes, the exporter and
the behavioural fingerprint are historical. The mock, Storybook, QA-tier and
review-width sections still describe how the repository works.

CLAUDE.md, AGENTS.md and .claude/rules are the operating rules; where they
and the document disagree, the rules win and this note is updated.

| Artifact | Note |
|---|---|
| docs/architecture/pulse-design-fork-v5.html | pinned; SHA-256 dc12a76b2a9408e3805bd57c3d4e11a92af13c32b6fe88b4d72eedcd0a84af84 |
| product-context/ | version 1.1.0 (see product-context/VALIDATION.md); the 1.0.0 package hash 700274af… no longer applies |

`CONTEXT-RECONCILIATION.md` records every place where the product context,
the mock and the code disagree, and how this repository resolves each one.
