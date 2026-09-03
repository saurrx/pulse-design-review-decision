# Architecture record

`pulse-design-fork-v5.html` is the pinned architecture of this repository: how
the fork relates to production, the mock under the adapter, Storybook as the
review surface, the QA tiers, synchronisation and the patch-based handoff.
It is authority number 3 in CLAUDE.md. CLAUDE.md, AGENTS.md and .claude/rules
are its operating summary; when they disagree with it, the document wins and
the summary is corrected in a tooling PR.

| Artifact | SHA-256 |
|---|---|
| docs/architecture/pulse-design-fork-v5.html | dc12a76b2a9408e3805bd57c3d4e11a92af13c32b6fe88b4d72eedcd0a84af84 |
| product-context/ (installed from pulse-design-context-v0.zip, version 1.0.0) | 700274af864765165f0d48ed8bfd9505b8a1d59516314d88233bb89d21d3c9aa |

Later revisions of the published proposal (v6 to v9) added the spike results,
the public preview deployments and the scaffold outcome. They did not change
the architecture; this copy is the one that was verified.

`CONTEXT-RECONCILIATION.md` records every place where the product context and
the architecture or the production base disagree, and how this repository
resolves each one. Neither `docs/` nor `product-context/` ever enters a
handoff patch; both are protected paths (tools/design/paths.mjs).
