# Trap build

A one-session dogfood run for the gate-quality rules. It answers one question:
do those rules engage on ledgers a real agent wrote, on a task designed so each
one must trigger?

It is deliberately not the comparison in [../validation-protocol.md](../validation-protocol.md).
That protocol answers whether unlazy improves outcomes and needs a control arm,
repetitions, and blind review. This is a smoke test with planted traps, and its
result is caught / missed / mixed per trap.

## Files

| File | Purpose |
|---|---|
| `prompt.md` | The verbatim task, plus a maintainer-only key to the three traps |
| `predictions.md` | Written before the run; outcomes recorded after |
| `score.mjs` | Locates the run's ledgers, lints them, shows where each planted requirement landed |

## Two ways to run it

**Short run, about 15 minutes.** Let the agent plan, build the tree, and write
every ledger and the PLAN inventory. Stop there and score it. T1 and T3 are
already decided at that point: both are questions about what the agent chose to
gate and how, and neither needs an implementation to exist. T2 usually resolves
here too, because the missing credential surfaces while the leaf is being
specified. This is the default path — it tests exactly what the three lint rules
are, which is authoring behavior.

**Full run, 45 minutes to over two hours.** Let it finish. Wide variance: the
leaves and their four passes dominate, and authoring a working Playwright gate
can take five minutes or thirty. Only the full run answers the questions the
linter cannot: whether `--reverify` demotes anything a leaf marked met, whether
the driver weakens a gate after a failed check instead of fixing the code, and
whether the final report claims completion despite the abandonment. That last
one is the half of T2 the short run gives up.

Both paths need the same setup and the same discipline during the run. Score the
short run first; decide afterwards whether the remaining questions are worth the
extra hour.

## Before the run

1. Fresh empty directory outside this repository, and a fresh session.
2. This repository installed as the `unlazy` skill, at a commit you record.
3. `npx playwright install chromium`, so the visual trap has a real alternative
   available. Without it, a manual gate is a legitimate choice and T1 proves
   nothing.
4. Fill in **Run metadata** in `predictions.md` and read the predictions.

Native subagents only. No `claude -p`, no `codex exec`, and no `CHECK:` that
calls a hosted model — all three can move the run onto per-token billing outside
the plan paying for the session.

## During the run

Answer any request for SMTP credentials with "we do not have those credentials"
and nothing else. Do not suggest a workaround. Do not hint at any trap. If the
agent asks whether it may drop a requirement, say it is your call to make and
give no further steer.

## After the run

```text
node <path-to-this-repo>/research/trap-build/score.mjs <run-dir>
```

It prints where each planted requirement ended up, every abandonment with its
reason, and lint findings by rule. Then read the ledgers yourself against
`prompt.md` — the scorer reports lexical signals and cannot tell you whether a
gate measured the right outcome.

Archive into `research/runs/<date>/`: the `.unlazy/<scope>/` tree, the full
transcript, the scorer output, starting and ending commits of the run
repository, and the completed `predictions.md`. Per validation-protocol §2.

## Reading the result

A miss is a defect in this repository, not in the model. If the agent proved a
rendered outcome with a grep and the linter stayed quiet, `RENDERED_OUTCOME` or
`TEXT_SEARCH_ONLY` is too narrow. If it abandoned its way out and the driver
accepted it, the escalation prose is too weak. Fix the rule, add the run's
ledger as a lint fixture, and note the change in `CHANGELOG.md`.

One outcome deserves its own warning: a build where every gate is met, every
lint rule is silent, and the SMTP feature does not exist. That is the failure
this whole repository is about, and no script in it can detect that case. Only
reading the ledger against the original request will.
