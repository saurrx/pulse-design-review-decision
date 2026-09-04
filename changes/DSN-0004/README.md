# DSN-0004: Ideas follows Overview's visual conventions

Status: in review. Backend impact: none for this incremental change.

## Intent and authority
The founder explicitly selected Overview as the fixed reference and asked to update Ideas. Workspace Admins need to scan submitted inventions and reach a defensible review decision. Intended outcome: easier scanning and shorter submission-to-decision time; no change to decision eligibility or payloads.

## Changes
Restyled the existing ReviewQueueWorkspace in place on top of the existing uncommitted rewrite. Reused Overview's shared section-title primitive, navy metric color, token typography, 36px action buttons and small corner radius. Reduced score size and section padding. Aligned detail content to its header at wide widths. Narrowed the score column to give titles more space. Preserved internal disclosure scrolling and allowed footer controls to wrap.

Review remains a visible counted filter. Other views use a labelled native selector with the existing status labels and filtering logic, following Overview's period-selector convention. No query, mutation, route, role, fixture, global token, Overview or sidebar changes in this increment.

## Verification
- Typecheck, role lint, token freshness and design build passed. Build reports PostCSS source-option and bundle-size warnings.
- Browser inspected at 1280x720, 1366x768, 1440x900 and 1920x1080 using the existing `reviewStory=typical` development preview.
- At settled 1280x720, collapsed disclosure bottom is 611.5px and footer top is 659px. Filters share one row; no document horizontal overflow.
- Existing long-title, not-evaluated, empty-queue and error previews inspected at 1280x720. Long titles remain readable; the scrollable detail pane accommodates extra content.
- Switching to Changes requested, returning to Review, and expanding disclosure verified. No decision mutation submitted.
- Existing stories: Workspace admin/Review queue (Typical, NotEvaluated, LongTitle, AlreadyDecided, EmptyQueue, Error). Story fixtures already existed; not created by this change.
- 200% browser zoom, full Storybook suite, export gates and production-data behavior are not verified. This is a local design update, not a release/PR certification.

## Scorecard
Product fit 4; hierarchy 4; craft 4; business 4 (intended metric only, not measured). Usability 3 and accessibility/resilience 3: zoom and complete state/keyboard coverage remain unverified. Trust 3: the pre-existing rewrite contains fallback assessment text and hardcoded decided-state attribution, which this visual-only increment does not change. These prevent claiming the overall review workflow is production ready.
