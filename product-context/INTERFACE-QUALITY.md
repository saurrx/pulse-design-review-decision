# Interface Quality Standard

## Hierarchy

- A user can identify the screen, primary object, current state, and next action
  within five seconds.
- One element leads; secondary elements do not compete for equal attention.
- Prime top-left space is earned by the persona's highest-value task.
- Personal, workspace, and company-level metrics are labelled and visually
  separated so their scope is never ambiguous.
- Dashboards begin with actionable work or motivating progress, not decorative
  analytics.

## Composition

- Use a consistent grid and spacing scale.
- Align controls optically as well as mathematically.
- Avoid a card for every grouping; use whitespace, rules, type, and alignment.
- Use progressive disclosure for complex evidence and secondary controls.
- Support long idea titles, names, jurisdictions, and translated content.
- Tables prioritize the fields needed for the current decision.
- Dense administrative surfaces remain scannable through grouping and contrast.

## Interaction

- Every control looks and behaves like its semantic role.
- Links support normal browser navigation behavior.
- Buttons name actions and consequences.
- Loading actions preserve their label and show activity.
- Successful mutations acknowledge what changed and what happens next.
- Errors explain how to recover without clearing entered work.
- Destructive actions require appropriate confirmation.
- Autosave shows last-saved state without becoming noisy.
- URL state is preferred for shareable filters, tabs, and pagination where the
  application architecture supports it.

## Product states

Every relevant surface covers:

- First use
- Empty
- Sparse
- Typical
- Dense
- Loading
- Saving
- Success
- Partial result
- Error and retry
- Permission denied
- Long content
- Stale or superseded evaluation
- Requested changes
- Offline/network unavailable where useful

## Performance perception

- Controls acknowledge interaction immediately.
- Avoid spinner flicker for very short operations.
- Skeletons resemble final content and do not create layout jumps.
- Search, filtering, and table interaction remain responsive with realistic totals.
- Heavy patent reports, maps, and document tools never block primary navigation.
- Motion uses compositor-friendly properties and remains interruptible.

## Desktop support

V0 supports desktop and laptop, not tablet or mobile layouts. Verify at:

- 1280×720
- 1366×768
- 1440×900
- 1920×1080
- 200% browser zoom

No essential action may disappear below a fixed panel or require accidental
horizontal scrolling at supported sizes.

## Craft review

Inspect typography, icon weight, hit targets, borders, alignment, copy rhythm,
focus, hover, active, disabled, loading, and error behavior. Quality is the sum
of these details, not a final decorative pass.

