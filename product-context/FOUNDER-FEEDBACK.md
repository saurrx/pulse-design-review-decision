# Sanitized Founder Feedback

This document records product/design findings from the founder feedback call.
It intentionally omits names, client information, raw transcript, and internal
operational details.

## Core finding

The product problem is not simply visual polish. Pulse lacks clear prioritization
and explanation, causing product value and important actions to compete with
available data.

## Evaluation credibility

- Repeated similar scores make the system appear artificial or rigged.
- A number without meaning is not valuable.
- Probability-style labels sound falsely objective.
- The useful question is what meaningfully differs from prior art.
- Per-reference analysis should vary with the actual evidence.
- Inventors need an actionable summary before detailed analysis.

Design response: Assessment → What appears different → How to strengthen →
Detailed prior art on demand.

## Inventor overload

The existing evaluation exposes too many concepts, detailed comparisons, and
scores at once. An inventor can miss the conclusion and next action.

Design response: progressive disclosure, plain meaning, and concrete prompts.

## Dashboard rationale

The call questioned why maps, pipelines, portfolios, and personal/company
metrics occupied particular locations. The top-left and primary real estate
must reflect the persona's most important task, not the availability of data.

Design response (1.0.0): remove world maps from dashboards; separate metric
scope; lead with submission, pending review, assigned work, or firm exceptions.
Superseded (1.1.0): the world map returns to every dashboard, below the
persona's work, never leading. The placement rationale still stands.

## Motivation

Company patent activity can show that invention is normal and valued. Collective
peer momentum may encourage participation more effectively than a geographic
portfolio visualization.

Design response (1.0.0): show collective submissions and progress without
default individual ranking. Superseded (1.1.0): the Workspace Admin Overview
keeps a Top inventors list; Inventors still see no named ranking.

## Product value

The interface must make visible what is happening, what needs attention, what
has been achieved, and what happens next. Architecture and security are vital
but do not replace the visible customer value story.

## Familiarity and redesign

Users should not be forced to relearn the product repeatedly. However, the
temporary call compromise to retain the legacy UI was later explicitly
superseded. V0 is authorized as a full UI/UX redesign while retaining familiar
objects and terms where they aid comprehension.

## Quality expectation

The interface should be built properly once, with clear rationale for hierarchy,
placement, and interaction. It should look and behave like a polished product,
not an engineering prototype awaiting a future design pass.

