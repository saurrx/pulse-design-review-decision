---
paths:
  - "mock/runtime/**"
  - ".storybook/**"
  - "design/harness/**"
  - "tools/design/**"
  - "qa/**"
  - "vite.design.config.ts"
  - "package.json"
  - "package-lock.json"
---
Infrastructure. Change it in its own commit with a one-line reason in the
message, never silently inside a surface change. Do not add dependencies or
upgrade Tailwind, React, Vite, Radix, TypeScript or Playwright. When a gate
in qa/ or tools/design/ contradicts a decision recorded in
product-context/VALIDATION.md, the decision wins: update the gate and say so.
