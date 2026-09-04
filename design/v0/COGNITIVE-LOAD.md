# Cognitive-load charter

Every V0 screen is judged by one question: **how much does this persona have
to read, compare and remember before they can do the one thing they came
here to do?** The answer depends on the persona and the screen, so the check
is a roleplay, not a number. The agent and the evaluator both run it; a
screen ships only when both pass it.

## The roleplay (run it before designing and again on the render)

Become the persona. Use the scenario's name, their job, and the moment that
brought them here (the surface brief's *Job* and the persona's *triggering
situation* in PERSONAS.md). Then answer, in writing, in the change record:

1. **First glance (3 seconds).** What did I see first? Is it the thing I came
   for? If my eye landed on a metric, a map, a card border or a label before
   the task, the hierarchy is wrong.
2. **The one thing.** What is the single action this screen exists for, for
   me, now? Is it the most visually dominant control? Is its consequence
   obvious from its label?
3. **What I had to read to get there.** List every element I read or skipped
   before acting. Each one is a cost. Which could be removed, merged, moved
   below the fold, or shown only on demand without losing anything I needed?
4. **What I had to remember.** Did I have to hold a number, a status or a
   name in my head while moving between two places on the screen (or two
   screens)? Put those side by side or remove one.
5. **What I never need here.** Name the elements that serve another persona,
   another moment, or nobody. They go.
6. **What I'd be anxious about.** Anything unclear about what happens next,
   who owns it, or whether my work is saved? That gets one plain sentence,
   not a warning box.

## Persona defaults (starting assumptions, overridden by the brief)

- **Inventor** — occasional user, no patent vocabulary, often arriving with
  material already written. Wants: where is my idea, what happens next, how
  do I start one. Never needs: firm metrics, due dates, Actions, rankings of
  colleagues, evaluation evidence before the conclusion. Tolerates the least
  density of the four.
- **Workspace Admin** — decision-maker, scans daily. Wants: what needs my
  decision, how old is it, is the programme moving. Reads tables well but
  decides from a brief, not a questionnaire. Tolerates a dense overview
  (the reference screen) because every tile answers "so what do I do".
- **Case Owner** — operator with several clients. Wants: which client needs
  me today, the next date, the next action. Needs client scope visible at all
  times; everything else can be one click away.
- **Photon Admin** — controller. Wants exceptions, ownership gaps and incoming
  work. Reads dense lists if grouped; never needs vanity totals.

## Hard rules (fail regardless of persona)

- One primary action per screen, visually dominant. Destructive actions live
  behind a menu or a confirmation.
- No element exists only because the data exists. A metric without a next
  step, comparison or consequence is decoration.
- Conclusion before evidence: score → meaning → what differs → evidence on
  demand. This order holds on every surface that shows an evaluation.
- No card around a grouping that whitespace, a rule or a heading can hold.
  The reference screens use cards for tiles that are read as units; copy
  that, not a card per block.
- No horizontal scroll at the five review widths. A table that needs it has
  too many default columns.
- No lifecycle stage shown as reached when it is not (a draft is not
  "Submitted").
- No repeated score, status or title on the same screen.
- Progressive disclosure for anything longer than a paragraph that is not the
  task: disclosure sections, prior art, history, attachments.
- Copy names the object and the consequence (`Send to Photon Legal`, not
  `Approve`); no boilerplate repeated per block; the advisory note appears once.
- The Inventor sees no ranking of named people, no due dates, no Actions.
- A navigation badge exists only for the Workspace Admin's pending reviews.

## Direction selection

When three directions are on the table, the one with the lowest cognitive
load for **this persona on this screen** wins unless it fails the brief's
hierarchy or a product boundary. "Lowest load" means: fewest elements read
before the primary action, fewest things to remember, fewest decisions the
persona has to make that Pulse could make for them. Write the comparison in
the change record as a table; the evaluator reads that table.

## Evaluator verdict

PASS only when the roleplay answers are written, the six answers show nothing
the persona had to read or remember that the screen could have spared them,
and every hard rule holds on the rendered screenshots at 1280×720 and
1440×900. Otherwise NEEDS_WORK with the specific element and the specific
persona cost.
