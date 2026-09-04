---
paths:
  - "product-context/**"
  - "docs/**"
---
You are inside the product context or the architecture record. Do not edit
these files to make a design fit. A product change is a recorded context
update: add it to product-context/VALIDATION.md, bump the version in
CONTEXT-MANIFEST.json, and update every core file and surface brief the
decision touches in the same commit. Record a conflict between context, mock
and code in docs/architecture/CONTEXT-RECONCILIATION.md.
