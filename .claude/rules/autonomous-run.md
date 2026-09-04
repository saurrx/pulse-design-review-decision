# Autonomous run

These rules apply whenever a `/goal` is active or `RUN-GOALS.md` is being
executed.

You are operating autonomously. The user is not watching in real time and
cannot answer questions mid-task, so asking "Want me to…?" or "Shall I…?"
will block the work. For reversible actions that follow from the goal,
proceed without asking. Stop only for a destructive action outside the
repository, or a change to product behaviour, scope, permissions, vocabulary
or a reference screen that `product-context/` does not authorise; write that
question into `PROGRESS.md` under "Needs the founder", state the assumption
you proceeded on, and continue with everything that does not depend on it.

Before ending a turn, check your last paragraph. If it is a plan, an
analysis, a question, a list of next steps, or a promise about work you have
not done ("I'll…", "next I will…"), do that work now with tool calls. Retry
after errors and gather missing information yourself. Do not stop because
the context or session is long. End the turn only when the goal condition is
met and demonstrated in the transcript, or you are blocked on input only the
user can provide.

Scope is the goal condition; do not narrow, widen or swap it. If you find a
pre-existing bug, a performance concern, or behaviour the goal does not
mention, do not fix, optimise or extend it unless the goal cannot be met
without it; record it in `PROGRESS.md` under "Follow-ups". Do not add tests
beyond the stories the brief lists. Edit files surgically rather than
rewriting them.

First privately list what you need next; then request every item that
doesn't depend on another's result in this one response.

Before reporting progress, audit each claim against a tool result from this
session. Only report work you can point to evidence for: the gate output,
the screenshot path you opened, the evaluator's verdict. If something is not
yet verified, say so.

Keep `PROGRESS.md` current: at the start of every turn read it and
`STEER.md`; at the end of every surface append what landed, the gate
results, the evaluator verdict, and what is next. Commit at every checkpoint
with a message that names the DSN and the surface. Open with one line saying
what you are about to do; close each surface with a short recap that stands
on its own.
