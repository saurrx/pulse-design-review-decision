# Design records

One folder per design change, `DSN-0001` onward. A record is the unit of handoff:
the branch is the source, the folder is the intent and the evidence, and the
exported patch is what the developer applies. The full contract is in the
published proposal "Pulse Design Fork"; this file is the working summary.

## Lifecycle
`proposed` -> `in review` -> `approved` -> `ported` -> `verified`.
A record that declares a route the backend lacks (`backendImpact: conceptual`)
stops at `approved` while the backend is frozen. A record that uses a backend
route the frontend never wired (`unwired`) needs the developer's approval.

## Making one
1. `git checkout -b dsn/0007-short-name main` (the design main: production plus tooling).
2. Work under the rules in AGENTS.md. Change portable product files; add or
   extend scenarios, handlers and stories as review support.
3. `node tools/design/export.mjs DSN-0007` writes the folder: the patch built
   from portable paths only, the class report, the behavioural fingerprint diff,
   the drift check in a disposable production worktree.
4. Fill README.md from TEMPLATE. Record the story ids, the before and after
   commits, and the approval flags the export raised.
5. Open the merge request. CI runs the gates; the previews are the review surface.

## What travels and what does not
- In the patch: `src/components`, `src/pages`, the stylesheets, `src/styles`, `public/assets`, `public/fonts`;
  `index.html`, the Vite, Tailwind and PostCSS configs and the token generator only with build-impact approval;
  role labels, the status map, context UI and hooks only with behaviour-impact approval.
- Beside the patch, never inside it: stories, scenarios, handlers, screenshots, baselines, this folder.
- Never on a design branch: the mock runtime, the harness, Storybook config, the QA corpus,
  the contract pins, the instruction files, the manifest and lockfile.
