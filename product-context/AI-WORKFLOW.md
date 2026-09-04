# One-Agent Design Workflow

One capable coding agent is sufficient when it receives strong context and is
used in distinct phases. Additional AI products are optional, not required.

## Phase 1: Understand

The agent reads core context and the active surface brief, then writes:

- Persona and job
- Current problem
- Desired outcome
- Business signal
- Product object and state
- Primary action and consequence
- Required states
- Constraints and open questions

It must not write UI code before this is coherent.

## Phase 2: Explore

For a material surface, produce three meaningfully different directions. Each
must preserve product truth while differing in hierarchy, composition, and
interaction strategy.

For each direction explain:

- What leads
- What recedes or disappears
- How the task flows
- Emotional character
- Business hypothesis
- Main risk

In the V0 run the agent selects the direction with the lowest cognitive load
for the persona and screen (design/v0/COGNITIVE-LOAD.md) and records all
three with the tradeoff in the change record; the founder has pre-authorised
this and reviews the record. The agent stops for human direction only when a
direction would change product behaviour, scope, permissions, vocabulary or a
reference screen.

## Phase 3: Build

- Implement the selected direction with the real design-repository stack.
- Reuse existing components and tokens before adding new ones.
- Add or update realistic states in Storybook/mock scenarios.
- Do not change product behavior unless the brief explicitly authorizes it.
- Render at supported laptop sizes.

## Phase 4: Critique

Use the same agent in a fresh context where practical. Give it the screenshot,
brief, design principles, scorecard, and a small reference set. Do not lead with
implementation rationale.

Ask for:

1. The three largest hierarchy/usability gaps
2. Anything generic or obviously AI-generated
3. Unnecessary elements
4. Inconsistency or weak craft
5. Whether the primary task is obvious
6. Whether the intended emotion is achieved
7. The single highest-leverage improvement

Run one or two critique iterations. Do not optimize endlessly for an arbitrary
AI rating.

## Phase 5: Validate

- Run accessibility, interaction, visual, and responsive checks.
- Test with representative users performing tasks, not reviewing aesthetics.
- Capture completion, time, hesitation, errors, and confidence.
- Compare the result with the business metric and guardrails.

## Phase 6: Handoff

Document intent, changed stories/screens, before/after evidence, interaction
changes, unchanged behavior, metrics, and any unresolved assumptions. The
developer remains responsible for production implementation and verification.

## Prompt starter

```text
Read product-context/AGENTS.md and the files it routes for this surface.

Before writing code, state the persona, job, stakes, primary object, current
problem, desired outcome, primary action, consequence, success signal,
guardrails, and required states.

Then propose three coherent design directions, select the one with the lowest
cognitive load under design/v0/COGNITIVE-LOAD.md, and record the tradeoff.
After implementation, render the result, inspect it, and review it against
product-context/DESIGN-SCORECARD.md and design/v0/COGNITIVE-LOAD.md.
```

