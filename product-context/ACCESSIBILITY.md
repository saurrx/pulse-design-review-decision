# Accessibility and Resilience

V0 targets WCAG 2.2 AA even though it is desktop/laptop only.

## Required

- Complete keyboard access
- Visible and unobscured focus
- Logical focus order
- Focus trapping and return for dialogs
- Native elements before ARIA substitutes
- Accessible names for icon-only controls
- Labels for every field
- Errors associated with fields and announced appropriately
- Async updates announced without interrupting unnecessarily
- Status never conveyed by color alone
- Sufficient text and control contrast
- Minimum pointer target sizing and adequate spacing
- Reduced-motion support
- Zoom support through at least 200%
- Semantic headings, lists, tables, and landmarks
- Long content and localization resilience
- No internal UUID or inaccessible raw status code in display copy

## Authentication

- Password managers and paste work normally.
- Authentication errors do not reveal whether an account exists.
- Domain rejection explains the legitimate next step.
- SSO, Google, Microsoft, and email choices have clear names.

## Evaluation

- Score meaning is available as text, not only color or a dial.
- Evidence cards have meaningful headings.
- Collapsible content exposes correct expanded state.
- Charts and distributions have text alternatives.

## Testing

Automated checks are necessary but insufficient. Review keyboard behavior,
screen-reader output, zoom, contrast, long text, and error recovery manually
for every major workflow.

