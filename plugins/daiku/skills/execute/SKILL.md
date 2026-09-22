---
name: 'execute'
description: 'Internal develop-feature contract — autonomously executes the brief produced by blueprint, following the task plan and updating Memory and Journal inside the file; at the end it deposits "4. review-notes.md" for /review.'
user-invocable: false
---

It is the step downstream of `blueprint`. You receive the folder containing the execution brief (`2. blueprint.md`) and you **carry it through from start to finish autonomously**. Unlike `decision-doc` and `blueprint`, here you **truly execute**: you modify the project code to implement the already decided solution.

The brief is already your complete handoff: the **Mandate** section tells you how to behave, **The chosen solution** what to do, the **Memory** the task plan to follow. This skill gives you no new instructions on the merits — it points you at the right file and locks the two disciplines an executor betrays most often: **updating the file while working** and **trusting observable verification instead of declaring yourself done**.

> **Parameters.** Every key in braces in this contract resolves on the project parameter files, never from memory and never by assumption: the rules are in §5 of `contracts/project-contract.md`, which also says **in which language to write** and what to do when a key is missing.

## Input: the brief folder

Arguments: `$ARGUMENTS`

The argument is **a single folder**, as a relative path from the repo root or absolute.

- The folder is passed to you by whoever invokes you, and this contract is not launched by hand: if it did not arrive, **stop and say so in the block**. Do not proceed blindly and do not choose it yourself.
- If the folder does not exist, report it and stop.
- Look for the brief in the folder: `2. blueprint.md`. If it is not there under that name, look for an equivalent blueprint file (for example `BLUEPRINT.md`); if you find more than one or none, **stop and declare in the block what you found**, without choosing one. It is the only case, together with the missing folder, where you do not start: from there on execution is autonomous.

With the folder you also receive `{memory.index}` and the **paths** of the memories the perimeter touches, to open before writing: it is the channel of §4.1 of `contracts/orchestration.md`. If the caller does not pass them to you, open the index and choose yourself — the constraints and decisions not deducible from the code stand there, and rediscovering them at your own expense costs a review round.

## Principles

1. **The brief is the source of truth, and it commands.** Read `2. blueprint.md` **in full** before touching anything: Mandate, Constraints, The chosen solution, all the tasks, the Journal. The Mandate written in the file prevails over any inclination of yours. If you resume after an interruption or a context compaction, **reread the file from the top**: the work state lives there (checked tasks + Journal), not in session memory.
2. **Real autonomy.** Run all tasks **in the given order**, without asking anything of anybody: every specification is already in the brief and the choice has already been made, and anyway you have no channel to the owner. If a detail seems missing, deduce it from the brief and the reference files it cites — do not interrupt. Stop and return the block **only** before a true obstacle: a destructive or irreversible action unjustified by the brief, or an irreconcilable internal contradiction.
3. **Respect the perimeter.** Apply the Constraints and non-goals of the brief to the letter, and the architectural rules of the project (`{instructions_file}`): load it and keep it in mind. Surgical modifications, no out-of-scope refactoring, no destructive or remote Git operations except on explicit request in the brief.
4. **Verification belongs to the check, not to you.** Every task carries an **executable** verification criterion *targeted at the task*: only the tests covering what you just changed, the import of the touched module, a `grep`, a command. Never the whole suite, never the package gate — they belong to `/review`, which always runs them on your diff. **Truly run it** and consider the task complete only if the check passes. Never "done when it looks done": if verification fails, the task is not finished — correct and retry. Report the real output, not an optimistic summary.
5. **Update the file while working, not at the end.** As you proceed, inside `2. blueprint.md`: check the tasks (`[ ]` → `[~]` → `[x]`) and **append to the Journal** what you did, the decisions taken, the hitches. If execution brings up new facts making it necessary to adapt the plan (adding, reordering or replacing tasks), do so — but **write in the Journal why**. Do not skip the order for comfort. The file must let another executor resume the work at any moment.
6. **The closing verification is mandatory, the gate is not yours.** The last task is always the self-review of the result against the completion criteria of the brief, plus the observable check that what you wrote runs: import the touched modules to catch load-time errors, run the tests of the perimeter you changed. **Do not launch the full suite nor the package gate**: `/review` runs them right after you, and repeating them here costs minutes and adds nothing. Do not declare the work complete until every criterion is satisfied.
7. **Deliver the review pass.** When finished, before closing, deposit in the brief folder the file `4. review-notes.md`: it is the bridge to `/review`, which the user will launch by hand pointing it at that file. It is not a summary for the user — it is an operational input for whoever will run the review: you give it the base-ref and what you noticed, **not** the list of skills to launch (that is decided by `/review` from the diff). See *The handoff file* below. You do not run `/review` yourself: you only prepare its handoff.

## Self-deceptions (stop them before they stop you)

You are an autonomous executor: nobody checks you while working, so the only way to err is **absolving yourself**. If you catch yourself thinking one of these sentences, the right column is the truth.

| If you are telling yourself… | The truth |
|---|---|
| "Verification fails but the code is right, I move on" | The task is **not finished**. The verdict belongs to the check, not to you (principle 4). Correct and rerun. |
| "Rereading the brief from the top after the interruption is a waste" | After a compaction the state lives **only** in the file (tasks + Journal), not in your session memory. Reread it in full. |
| "This detail is missing, I ask the user" | Deduce it from the brief and the files it cites. One asks **only** before a real block (destructive action or irreconcilable contradiction). |
| "While I am here I fix this adjacent code" | Out of perimeter. Every line you touch must trace back to a brief task (Constraints, principle 3). |
| "I skip this task, I do it later, it is more comfortable" | Follow the given order. Adapting it is allowed only if new facts emerge, and it must be explained in the Journal (principle 5). |
| "I skip verification, I already saw it works" | "I saw" is not observable evidence: the closing verification is mandatory (principle 6). |
| "I launch the full suite, so I am sure" | It is not yours: `/review` always runs it on your diff, right after. Here you verify the perimeter you touched, not the repository. |
| "I update the Journal at the end, now I run" | If you interrupt now, the work restarts from zero. Update the file **while** working. |

## Alarm signals (red flags)

If you notice one of these while running, you have already headed in the wrong direction — stop and correct course:

- You are modifying a file **no task** of the brief mentions.
- You are halfway through and the **Journal is still empty** or stuck at the first task.
- You marked a task `[x]` **without** having run its verification check.
- You are about to declare the work finished **without** having run the targeted checks of the perimeter you touched (imports of the modules, only the tests covering what changed).
- You are preparing to `git commit`/`git push` (not your task: commit is a user step after review).
- You are rewriting or summarising the decision instead of **executing** it (the brief already chose).

## Procedure

1. **Resolve the folder** from `$ARGUMENTS` and find the brief (`2. blueprint.md`, see *Input*).

2. **Read the brief in full** and load `{instructions_file}`. Reconstruct: what the solution to implement is, the constraints and non-goals, the completion criteria, and the **current task state** (if some are already `[x]`, restart from the first undone — do not redo already verified work).

3. **Run the tasks in order.** For each: do the step, then **run the verification check**. Green → mark `[x]` and annotate in the Journal. Red → stay on the task, correct, rerun; if a fact emerges imposing adaptation of the plan, update the tasks and explain why in the Journal. Do not move to the next task with the previous verification still red.

4. **Close with the closing verification.** Self-review against the completion criteria of the brief, plus the observable proof of the touched perimeter (imports of the modules, tests of that perimeter). The build and test gate is run by `/review`: do not launch it here. If something does not add up, go back and fix before declaring done.

5. **Deposit `4. review-notes.md`** in the brief folder (see *The handoff file*).

6. **Summarise in chat** in a few lines: what you implemented, the outcome of the checks (with their real output), any deviations from the plan and why, and that you left `4. review-notes.md` for review. The detail stays in the Journal of the file.

## Evidence required to say "done"

Do not declare the work completed until you can **exhibit** — in the summary and in the Journal — all this concrete evidence. It is what distinguishes "done" from "looks done":

- **Every `[x]` task** has next to it, in the Journal, the real outcome of its verification check (not "ok", but what you ran and what came back).
- **Closing verification**: the real output of the targeted checks you ran on the touched perimeter (imports of the modules, tests of that perimeter). If you could not run them, declare it as an explicit limit. The package gate — `{areas.<area>.gate}` of the touched areas — **is not run here**: it belongs to `/review`.
- **Self-review** against the completion criteria of the brief: each checked, with the code/behaviour line satisfying it.
- **`4. review-notes.md` deposited** with a real base-ref from Git.

If one of these is missing, the work is not finished: go back and complete it before closing.

## The handoff file (`4. review-notes.md`)

The last step when finished. Written **addressing whoever will run `/review`**, not the user. It serves to give it the **point from which to compute the diff** and to **flag what to watch with care**. You do not decide which skills it will launch: `/review` establishes its own phases by inspecting the diff. Your task is to provide the base-ref and the context; it trusts but verifies. If it already exists (re-run), overwrite it with the updated state.

Content:

- **Base-ref**: the baseline commit/ref you worked against, so review computes the exact diff of the feature without guessing (e.g. the commit the branch started from, or the `HEAD` of work start). Report the real value from Git, not from memory.
- **Considerations**: what you *noticed but it was not your task to resolve* — perf-sensitive points touched, zones where the expected behaviour was ambiguous, coverage gaps, decisions taken under uncertainty. It is the material orienting the review phases; anchor it to the files (`path:line`), not generic. Describe *what you touched and where* (e.g. "touched polling in `X:42`", "new uncovered branch in `Y:88`"), not *which skill must run*: the choice of phases belongs to `/review`.

```markdown
# Notes for review

> Origin: 2. blueprint.md · Generated: <date> · Base-ref: <commit/ref>

## Considerations
- <fact anchored to file:line orienting a review phase>
- ...
```

## What you return

Invoked by hand, the chat summary suffices. **Invoked inside a chain** — the Execute phase of `develop-feature` — close with this block, which is the only format on which the caller decides whether to continue:

```json
{"ok": true, "note_review_path": "<path of 4. review-notes.md>", "verify_detail": "<actual outcome of the targeted checks on the touched perimeter>", "detail": "<if ok=false, the reason>"}
```

`verify_detail` carries the **real** outcome of the checks you ran on the perimeter you touched, not their intention: the full suite and the package gate are not yours, `/review` owns them, so this field is the only proof something was observed before review.

The schema lives here, in the file of the node producing it, and whoever invokes you cites it instead of copying it (§4.2 of `contracts/orchestration.md`).

## Cut rule

You **execute**, you do not rediscuss the decision. The brief already chose what to do and why: your task is to implement it faithfully, verify it with observable checks and leave in the file a trace letting anybody resume. If the brief is truly incomplete or contradictory to the point of being unable to proceed, stop and say so — but it is the exception, not the norm.
