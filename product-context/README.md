# Pulse V0 Design Context

This package is the authoritative product and design context for designing
Pulse V0 with a coding agent. It contains no application code, customer data,
credentials, or backend specification.

Pulse V0 is the first production release of a clean rebuild. The legacy
product at `dev.photonpulse.ai` is reference material only. V0 is a full UI/UX
redesign, not a visual reskin of the legacy interface.

## Product in one sentence

Pulse is one place for intellectual property where employees can turn material
they already have into invention disclosures, have those ideas evaluated and
reviewed, send approved ideas to Photon Legal for filing, and see the resulting
company patent portfolio.

## Commercial purpose

Pulse is free with Photon Legal services. It is not sold as SaaS. Its primary
commercial purpose is to help more inventors start, complete, and submit good
ideas so that more approved ideas become paid patent matters for Photon Legal.

## Where this lives

This directory is `product-context/` in the Pulse V0 repository. The
repository's `CLAUDE.md` routes agents here. Every product decision that
changes is recorded in `VALIDATION.md` with a version bump in
`CONTEXT-MANIFEST.json`; the same text is mirrored in the PL-Pulse-Design
Claude Project.

## Required reading order for an agent

1. `AGENTS.md`
2. `PRODUCT.md`
3. `BUSINESS.md`
4. `PERSONAS.md`
5. `DESIGN-PHILOSOPHY.md`
6. `INTERFACE-QUALITY.md`
7. The relevant file under `surfaces/`
8. `DESIGN-SCORECARD.md` before declaring work complete

Read `COPY-VOICE.md` for copy changes, `MOTION.md` for motion, and
`ACCESSIBILITY.md` for every new component or flow.

## Authority order

When guidance conflicts, use this order:

1. The active design brief and explicit founder decision
2. The product truths in this package
3. The relevant surface brief
4. Accepted design principles and vocabulary
5. The reference screens (Workspace Admin Overview and Ideas queue) and
   existing V0 component constraints
6. External references
7. General model preferences

Repository code proves what exists. Except for the two reference screens, it
does not prove that the existing design is correct.

## Source basis

This package was prepared from founder validation, five Pulse PRDs, a founder
feedback call, a read-only audit of the legacy Photon and client-mode product,
and external design research. Raw customer and call material is intentionally
not included. `FOUNDER-FEEDBACK.md` contains the sanitized findings.

