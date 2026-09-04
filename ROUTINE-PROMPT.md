# Routine: Pulse V0 screen run

Create this as a Claude Code routine (cloud): from a terminal in the repo run
`/schedule`, or on claude.ai/code choose the repository, branch `main`,
model Fable, effort high, permission mode auto, and paste the prompt below.
Fire every 30 minutes if the plan allows it (`*/30 * * * *`); if the
scheduler refuses, hourly (`0 * * * *`). Turn push notifications on. The
cloud environment must have the setup script and Trusted network from
RUN-GOALS.md. Run `.claude/settings.json` hooks are committed, so every
firing gets the completion gate, the evidence gate and the kill switch.

Stop the run by creating a file named `AGENT_STOP` on `main` (every session
halts on its next tool call) or by pausing the routine.

## Prompt (paste verbatim)

```
You are one firing of the Pulse V0 autonomous screen run. Read CLAUDE.md, AGENTS.md, .claude/rules/autonomous-run.md, RUN-GOALS.md, PROGRESS.md and STEER.md first. Then:

1. Concurrency: run `git fetch --all` and `git log --all --since='25 minutes ago' --format='%h %cr %s'`. If any commit in the last 25 minutes came from another run session (a dsn/ branch or main with a DSN-numbered message you did not write), another firing is working: append one line to PROGRESS.md saying you yielded, commit, push, and stop. Otherwise continue.

2. Pick the surface: if STEER.md names a DSN to reopen, do that first on its branch (delete the STEER line when acted on, say so in PROGRESS.md). Else if PROGRESS.md names a surface in progress on a dsn/ branch, check that branch out and resume from its last entry and its changes/DSN-NNNN/README.md. Otherwise take the first surface in RUN-GOALS.md lane A whose dsn in design/v0/coverage.json is null (lane B surfaces after lane A is done), create branch dsn/NNNN-<slug> from main, and write the persona frame into PROGRESS.md before touching code.

3. Complete that surface exactly as the condition template in RUN-GOALS.md defines complete: three directions and the chosen one by cognitive load recorded in the DSN README; built in place to the reference screens' language; every intended story id present and passing; legacy stories, journeys and baselines it replaces deleted; screenshots re-baselined and copied into changes/DSN-NNNN/shots/ and opened with the Read tool; typecheck, lint:roles, tokens check, test:v0 and test:stories shown green; the evaluator subagent (.claude/agents/evaluator.md) run in a fresh context until VERDICT: PASS, at most three rounds, then mark needs-founder in PROGRESS.md and move on; dsn set in coverage.json and COVERAGE.md re-rendered; scorecard and cognitive-load check in the README.

4. Commit at every checkpoint on the dsn/ branch and push it (so the next firing can resume if this one is cut off). When the surface is complete, merge the branch into main with --no-ff, push main, append the recap to PROGRESS.md naming the next surface, and continue immediately with the next surface in the same session until you are stopped.

5. If every surface has a dsn, run the sweep: for each surface marked needs-founder in PROGRESS.md, re-run the evaluator with its findings, fix what can be fixed without a founder decision, and record the rest under "Needs the founder". Then write "RUN COMPLETE" at the end of PROGRESS.md, push, and stop.

Rules that override anything else: never edit product-context/; never edit the two reference screens except to fix a defect this surface exposes, and say so; never add a dependency; never touch the adapter, auth or analytics; unrelated bugs go under Follow-ups; questions only the founder can answer go under "Needs the founder" with the assumption you proceeded on; no destructive git operations on main (no force-push, no history rewrite). Work is demonstrated by tool output in this transcript, never by describing it.
```
