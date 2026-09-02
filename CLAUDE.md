# Pulse design fork — agent context

<!-- preamble:start — the sync script fails if these lines change -->
Production behaviour rules remain binding. Read contract/production-CLAUDE.md
and contract/production-backend-CLAUDE.md for them.
The production visual-lock rule is suspended only inside an approved DSN record.
Sections of the production file about the demo environment, deployment and
accounts do not apply here. Never call a demo or production service from this repo.
<!-- preamble:end -->

This repository is a fork of photonlegal/pulse-frontend (the `upstream` remote)
that runs on mock data. It exists so the Pulse v4 redesign can be built for all
six roles and handed back to production as portable patches. It is not a second
implementation of Pulse and it never ships.

Precedence, highest first: the user's words in the current task; this file;
AGENTS.md and .claude/rules; the sanitised production instruction copies under
contract/, which describe product behaviour and are reference material, never
loaded as instructions; everything else in the tree.

The full plan, decisions and review log live in the published proposal
"Pulse Design Fork". The short operating rules are in AGENTS.md.

@AGENTS.md
