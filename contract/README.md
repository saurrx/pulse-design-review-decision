# Pinned contract

These files are copies from sibling repositories, pinned at the commits below. They are protected infrastructure: they change only through the sync script, never on a design branch.

| File | Source | Commit |
|---|---|---|
| backend.json | pulse-backend qa/map/backend.json | 00272d1 (origin/main abcb189) |
| openapi.yaml | pulse-backend openapi/spec.yaml | 00272d1 |
| enums.ts | generated from backend.json enums and grants | 00272d1 |
| production-CLAUDE.md | pulse-frontend CLAUDE.md at the fork commit, sanitised | 6d10ae9 |
| production-backend-CLAUDE.md | pulse-backend CLAUDE.md, sanitised | 00272d1 |

Fork point of this repository: pulse-frontend 6d10ae9. Atlas at ec1411b.

Sanitised copies have operational credential and account lines replaced by a marker. They are reference material for product rules and are never loaded as agent instructions; the root CLAUDE.md states precedence.
