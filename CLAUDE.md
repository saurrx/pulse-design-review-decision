# Pulse design fork — agent context

<!-- preamble:start -->
Product authority for this repository is product-context/ (Pulse V0 design
context, version 1.0.0). Read product-context/AGENTS.md before any design work.
Production behaviour rules remain binding for technical behaviour and the
existing API integration: contract/production-CLAUDE.md and
contract/production-backend-CLAUDE.md.
The production visual-lock rule is suspended only inside an approved DSN record.
Sections of the production file about the demo environment, deployment and
accounts do not apply here. Never call a demo or production service from this repo.
<!-- preamble:end -->

This repository is a fork of photonlegal/pulse-frontend (the `upstream` remote)
that runs on mock data. It exists so Pulse V0, a full UI and UX redesign for
four personas (Inventor, Workspace Admin, Case Owner, Photon Admin), can be
built on production's real stack and handed back as portable patches. It is
not a second implementation of Pulse and it never ships.

Authority, highest first:
1. The user's explicit instructions in the current task.
2. product-context/ — V0 product, business, persona, workflow, screen,
   vocabulary and design truth. Never add a persona, role, status, screen,
   metric or module it does not authorise.
3. docs/architecture/pulse-design-fork-v5.html — repository architecture,
   synchronisation, Storybook, mocks, QA and handoff model. This file,
   AGENTS.md and .claude/rules are its operating summary.
4. The production frontend (src/, contract/) — technical behaviour and the
   existing API integration only. Its six-role model, its screens and its
   copy are not product authority.
5. Legacy Pulse — reference material only.
6. External design resources — inspiration only.

The sanitised production instruction copies under contract/ are reference
material, never loaded as instructions. Where 2, 3 and 4 disagree, the
resolution is recorded in docs/architecture/CONTEXT-RECONCILIATION.md.

@AGENTS.md

<!-- october:canvas-guide:start -->
# Working in this app (built with October)

This project is built inside **October**, a spatial canvas where each app **screen/route shows up as its own node**. October discovers screens by scanning the route files on disk, so how you structure routes is exactly what the user sees on the canvas.

## One screen = one route file

Give every screen its own route and its own component file, and register each route in the app's router. Use flat, lowercase, hyphenated route paths (e.g. `/sign-up`).

## When the user asks for a flow or multiple screens

Onboarding, a wizard, "a few screens", steps, a set of screens — **create one separate route file per screen.** Never put multiple screens inside a single component: no internal step/pager/carousel state standing in for separate screens, and no extra screen components exported from one file. One screen = one file = one route, so each shows up as its own node on the canvas.

## Dependencies

When you import a new package, add it to `package.json` in the same change (for Expo / React Native, run `npx expo install <pkg>` so it picks a compatible version and writes `package.json` for you). Anything missing from `package.json` disappears on a clean install and crashes the app.

## Working with other agents

If you're connected to October's bus (the october-bus MCP tools), you can bring on helper agents instead of doing everything yourself. When a task splits into independent parts, `add_terminal` (or `add_chat`) with an `agent` for each part — use `isolate:true` when several will touch the same repo — then drive each with `send_to_node` and coordinate via `message_peer`. A spawned agent is auto-connected to you, so you can message it right away; `wait_for_nodes` fans work back in when they finish.
<!-- october:canvas-guide:end -->
