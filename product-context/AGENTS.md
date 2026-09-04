# Instructions for AI Design Work

You are designing Pulse V0, a high-trust B2B intellectual-property workflow
product. Read the required context before producing visual output or code.

## Operating contract

- Start with the persona, job, product object, consequence, and success metric.
- Roleplay the persona before laying out the screen: what do they need to see
  first, what do they decide here, what would they never read on this screen?
- Resolve information architecture before styling.
- Produce three meaningfully different directions for material new surfaces,
  select the one with the lowest cognitive load for that persona and screen
  (design/v0/COGNITIVE-LOAD.md), and record all three with the tradeoff. The
  founder has pre-authorised this selection for the V0 run; stop and ask only
  when a direction would change product behaviour, scope, permissions,
  vocabulary or a reference screen.
- Explain the hierarchy, tradeoffs, and elements deliberately omitted.
- Build using the repository's real components, tokens, and supported stack.
  The mock is the backend: extend it when a screen needs what the API lacks.
- Render and inspect the real result. Code inspection is not visual review.
- Cover every reachable state relevant to the active surface.
- Run the design scorecard and the cognitive-load check after rendering and
  address the largest gaps.
- Prefer reduction and hierarchy over adding cards, labels, and decoration.

## Product boundaries

- There are four V0 personas: Inventor, Workspace Admin, Case Owner, Photon Admin.
- Evaluation is optional, started by the inventor with a button, and advisory.
  No score blocks submission.
- Workspace Admin approval sends the idea to Photon Legal for filing.
- Pulse contains no purchasing, checkout, billing, or service-price selection.
- Drafting and filing legal work occur outside Pulse.
- Inventors see the full company patent portfolio but no due dates or Actions.
- Workspace Admins see Actions and dates but cannot import or edit patent data.
- Case Owners and Photon Admins maintain patent and due-date data.
- Trademark is later roadmap, not V0.
- A general-purpose AI chat assistant is not V0.
- There is no notification center or bell in V0; email is the durable channel.

## Design rules

- Pulse must feel calm, credible, premium, intelligent, human, precise,
  encouraging, and professionally expressive.
- The Workspace Admin Overview and the Workspace Admin Ideas queue are the
  approved visual reference. Match their tokens, type, radius scale, button
  sizes, hairline separation and two-pane list/detail pattern on every other
  screen. Preserve Photon Legal's core brand colors.
- Avoid old enterprise software, spreadsheet decoration, aqua/glass styling,
  generic AI dashboards, loud color, childish illustration, and excessive motion.
- One task leads on every screen. Supporting UI recedes.
- Do not put data on a dashboard merely because it exists.
- The patent world map is part of every V0 dashboard (all four home screens)
  as the portfolio's geographic view. It never leads: work and next steps
  come first, the map sits below them. Jurisdiction counts and filters also
  belong in the Patent Portfolio.
- Use noticeable but professional motion only to explain change, progress, or
  successful completion.
- Desktop and laptop only, but support common laptop widths and 200% browser zoom.

## Evaluation rules

- Use the term `prior art`, never `prior arts`.
- Retain a numeric 0–10 patentability score. The score may carry one band
  label (Highly novel, Moderately novel, Marginally novel, Closely matched,
  Not evaluated) and, inside the draft, a live patentability signal that
  reads the sections back before the full score exists.
- Never communicate an approval cutoff or imply that a score guarantees a patent.
- Present inventor results in this order: Assessment, What appears different,
  How to strengthen. Put detailed prior art behind progressive disclosure.
- State once that the result is AI-assisted and advisory. Present the substance
  confidently, directly, and with evidence rather than timid repeated warnings.

## Never

- Invent a persona, permission, workflow stage, product module, or legal promise.
- Turn an external reference into a copied visual system.
- Optimize for visual novelty at the expense of task completion or trust.
- Add a full-screen chatbot as a shortcut for designing the product.
- Add a notification bell, cost module, trademark module, docketing
  integration, or purchase flow to V0.
- Put a navigation badge on anything but the Workspace Admin's pending reviews.
- Rank named inventors where an Inventor can see it. The Workspace Admin
  Overview's Top inventors list is the one authorised ranking.
- Use real inventions, customer names, emails, patent data, credentials, or
  call transcripts in fixtures, screenshots, or prompts.
- Declare a design successful based only on an AI critic's score.

## Completion requirements

Before presenting a design as ready, verify it against
`DESIGN-SCORECARD.md`, `design/v0/COGNITIVE-LOAD.md`, the relevant surface
brief, accessibility requirements, all supported laptop widths, long content,
empty/loading/error states, and the named business outcome.
