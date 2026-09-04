# Validation Record

## Status

Version 1.1.0 (2026-09-04). Founder review of the rendered product against
the 1.0.0 package changed the decisions listed under "1.1.0 changes"; every
core file and surface brief was updated to match. Future product changes
require a recorded context update and a version bump.

## 1.1.0 changes (founder decisions, 2026-09-04)

- The repository is the Pulse V0 codebase, not a design fork; the mock is the
  backend for V0 work and is extended when a screen needs what the API lacks.
- The Workspace Admin Overview and the Workspace Admin Ideas queue, as built,
  are the approved visual reference. Every other screen is redesigned to
  their language.
- The patent world map returns to every dashboard, including Inventor home,
  below the persona's work; it never leads.
- The Workspace Admin Overview keeps a Top inventors ranked list. Inventors
  never see a ranking of named colleagues.
- Navigation badge: Workspace Admin pending reviews only. The Ideas badge
  shown to Photon Admin and Case Owner is a defect to remove.
- Evaluation vocabulary follows the screens: patentability score (0–10) with
  band labels, and a live patentability signal inside the draft. Evaluation is
  still started by the inventor with a button, advisory, and never a gate.
- Review actions follow the reference screen: Send to Photon Legal / Request
  changes / Reject.
- Inventor home hierarchy: my ideas with their next step lead, Submit an idea
  is the primary action, the map sits below.
- Idea detail and the disclosure workspace need substantial cleaning; the
  upload-or-paste prompt is the first thing a draft shows.
- Actions, Due Dates, Patents, Workspace, Clients and Login are full redesigns
  to the reference language, not restyles.
- For the V0 run the agent selects among its three directions by cognitive
  load per persona and screen and records the tradeoff; the founder reviews
  the record rather than choosing per screen.
- Cognitive-load rules are judged by roleplaying the persona on that screen,
  not by fixed numeric limits (design/v0/COGNITIVE-LOAD.md).
- Legacy reference stories and six-role QA journeys are removed as each V0
  surface lands.

## Confirmed decisions

- V0 is the first production release of a clean rebuild.
- The legacy product is reference, not design authority.
- Pulse is free with Photon Legal services, not a SaaS product.
- Primary ICP: legal leadership without a dedicated internal IP counsel team.
- Primary commercial loop: more ideas reaching paid patent matters.
- Four personas: Inventor, Workspace Admin, Case Owner, Photon Admin.
- Invention capture, upload/paste, prefill, evaluation, review, portfolio,
  Actions, lifecycle, onboarding, access, and activation email are V0.
- Evaluation is optional, button-triggered, advisory, repeatable after edits,
  a numeric 0–10 patentability score with a band label, and never a
  submission gate.
- General chat, trademark, cost visibility, purchasing, full docketing,
  notification center, document management, and mobile/tablet are excluded.
- One Workspace Admin review stage; multiple Workspace Admins allowed.
- Workspace Admin may submit on behalf with separate inventor/submitter identity.
- Approve means send to Photon Legal for filing.
- Post-approval V0 states move directly from Sent to Photon Legal to Filed.
- Inventors see the full company patent portfolio but no Actions/due dates.
- Workspace Admin sees dates only in Actions and patent detail.
- Case Owner and Photon Admin maintain patent/due-date data.
- Only Workspace Admin pending reviews receive a navigation badge.
- All PRD activation-email sequences are V0 requirements.
- Full visual and UX redesign is authorized across all V0 screens.
- PL-TKN-004 and Photon Legal core colors are the visual baseline.
- Typography/token structure may improve; color changes require approval.
- Desired character: calm, credible, premium, intelligent, human, precise,
  encouraging, professionally expressive.
- Motion is noticeable but professional; no sound.
- (superseded in 1.1.0) World maps are not part of V0 dashboards.
- Collective innovation momentum is what Inventors see; the Workspace Admin
  sees a Top inventors list (1.1.0).
- WCAG 2.2 AA, keyboard, reduced motion, 200% zoom, and laptop layouts are the
  baseline quality target.

## Reconciled contradictions

- “Invention capture is not core” was a speech-transcription error.
- “Project” in the decision list meant Reject.
- “Several Workspace Admins” replaced a transcription error.
- The earlier score threshold above 6 is explicitly discarded.
- The temporary call compromise to preserve the old UI is superseded.
- Trademark PRD is later roadmap, not V0.
- “AI systems excluded” means no general assistant; the copilot and evaluation
  functions listed in PRODUCT.md remain included.

