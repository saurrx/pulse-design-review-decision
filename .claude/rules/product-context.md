---
paths:
  - "product-context/**"
  - "docs/**"
---
You are inside the product context or the architecture record. Both are
read-only in design branches and never enter a handoff patch. A product change
needs a recorded context update (product-context/VALIDATION.md) and a new
package version; an architecture change needs a tooling PR and a new pinned
document with its SHA-256 in docs/architecture/README.md. Do not edit these
files to make a design fit; record the conflict in
docs/architecture/CONTEXT-RECONCILIATION.md instead.
