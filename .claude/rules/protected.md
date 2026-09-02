---
paths:
  - "mock/runtime/**"
  - ".storybook/**"
  - "design/harness/**"
  - "tools/design/**"
  - "contract/**"
  - "qa/**"
  - "vite.design.config.ts"
  - "package.json"
  - "package-lock.json"
---
Protected infrastructure. It changes only on a tooling branch with owner
approval, never on a design (DSN) branch. The exporter rejects a design branch
that touches it. contract/ is refreshed only by tools/design/sync.mjs.
