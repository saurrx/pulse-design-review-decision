# Pulse — frontend

The Pulse IP-lifecycle web app: the saurrx design system wired to the real
Pulse API. Production: https://demo.photonpulse.ai (Vercel; `/v1` is rewritten
to the API so auth cookies stay first-party).

- Dev: `npm run dev` → http://localhost:3600 (proxies `/v1` to localhost:3000)
- Checks: `npm run typecheck && npm run lint:roles && npm run build`
- QA: `node qa/cli.mjs affected` selects the tests for your diff.
  Adapter coverage: `node qa/contract/adapter-coverage.qa.mjs`.
  Browser tiers (invariant / conformance / journey) run against the deployed
  demo — see CLAUDE.md §6, and run them one at a time, never concurrently.

Read `CLAUDE.md` before changing anything — especially the adapter section.
