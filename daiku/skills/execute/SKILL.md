---
name: 'execute'
description: 'Internal ship-feature contract — autonomously executes the brief produced by blueprint, following the task plan and updating Memory and Journal inside the file; at the end it deposits the handoff file "4. review-notes.md".'
user-invocable: false
---

It is the step downstream of `blueprint`. You receive the folder containing the execution brief (`2. blueprint.md`) and you **carry it through from start to finish autonomously**. Unlike `decision-doc` and `blueprint`, here you **truly execute**: you modify the project code to implement the already decided solution.

The brief is already your complete handoff: the **Mandate** section tells you how to behave, **The chosen solution** what to do, the **Memory** the task plan to follow. This skill gives you no new instructions on the merits — it points you at the right file and locks the two disciplines an executor betrays most often: **updating the file while working** and **trusting observable verification instead of declaring yourself done**.

> **Parameters.** Every key in braces in this contract resolves on the project parameter files, never from memory and never by assumption: the rules are in §5 of `contracts/project-contract.md`, which also says **in which language to write** and what to do when a key is missing.

## Input: the brief folder

Arguments: `$ARGUMENTS`

The argument is **a single folder**, as a relative path from the repo root or absolute.

- The folder is passed to you by whoever invokes you: if it did not arrive, **stop and say so in the block**. Do not proceed blindly and do not choose it yourself.
- If the folder does not exist, report it and stop.
- Look for the brief in the folder: `2. blueprint.md`. If it is not there under that name, look for an equivalent blueprint file (for example `BLUEPRINT.md`); if you find more than one or none, **stop and declare in the block what you found**, without choosing one. It is the only case, together with the missing folder, where you do not start: from there on execution is autonomous.

With the folder you also receive `{memory.index}` and the **paths** of the memories the perimeter touches, to open before writing: it is the channel of §4.1 of `contracts/orchestration.md`. If the caller does not pass them to you, open the index and choose yourself — the constraints and decisions not deducible from the code stand there, and rediscovering them at your own expense costs rework.

## Principles

1. **The brief is the source of truth, and it commands.** Read `2. blueprint.md` **in full** before touching anything: Mandate, Constraints, The chosen solution, all the tasks, the Journal. The Mandate written in the file prevails over any inclination of yours. If you resume after an interruption or a context compaction, **reread the file from the top**: the work state lives there (checked tasks + Journal), not in session memory.
2. **Real autonomy.** Run all tasks **in the given order**, without asking anything of anybody: every specification is already in the brief and the choice has already been made, and anyway you have no channel to the owner. If a detail seems missing, deduce it from the brief and the reference files it cites — do not interrupt. Stop and return the block **only** before a true obstacle: a destructive or irreversible action unjustified by the brief, or an irreconcilable internal contradiction.
3. **Respect the perimeter, and open only what the brief cites.** Apply the Constraints and non-goals of the brief to the letter, and the architectural rules of the project (`{hosts.<host>.instructions_file}`): load it and keep it in mind. Surgical modifications, no out-of-scope refactoring, no destructive or remote Git operations except on explicit request in the brief. Open only the files the brief cites — its Target paths, its reference files, the consumers its *Interfaces* section maps. If the work needs a file the brief does not cite, **stop and say so**: the brief was imprecise, and exploring the repository to complete it is not your task. From here on nobody searches the repository to check completeness.
4. **Verification belongs to the check, not to you.** Every task carries an **executable** verification criterion *targeted at the task*: only the tests covering what you just changed — run with `{areas.<area>.test_targeted}` on those test files — the import of the touched module, a command. After every task, run also `{areas.<area>.check_fast}` on the files that task touched, for each area they stand in: a compile or type error found at the task that made it costs one line, found at the gate it costs the delivery. Never the whole suite, never the package gate: they are outside this contract. **Truly run it** and consider the task complete only if the check passes. Never "done when it looks done": if verification fails, the task is not finished — correct and retry. Report the real output, not an optimistic summary.
5. **A test you never saw red proves nothing.** Every test or check you write — a test case, a bench case, a rule of a validator — counts only once you saw it **fail** on the wrong state. The preferred proof is against the base: put the production change aside (`git stash push -- <the production files>`, or `git show <base-ref>:<file>` written in place of the file), run the test with `{areas.<area>.test_targeted}`, see it red, restore the change and see it green. Where the base cannot run it, a one-line mutation of the production code the test covers, reverted right after. A red caused by the test itself — it does not load, it does not parse, a misspelt name — is not a proof. The red exit and the lines showing it go in the Journal and in `red_proofs`. It is the rule `skills/test-coverage/SKILL.md` § *3.4 What makes a test "quality" here* sets for the coverage phase, brought to the moment the test is written.
6. **Check what the brief maps, and nothing beyond it.** For every consumer the brief maps in its *Interfaces touched and their consumers* section, run its check as the brief wrote it — the call executed as written, never a `grep` that the name is there — and record it in `consumers_checked`. For each fact of the brief's *Facts this change retires* section, search its fixed string in the files you touched and those the brief maps; the count goes in `absence`, with a why for every hit left. Do not search the repository beyond that: a reader the brief does not map, or a surviving wording outside the files above, means the brief's maps were incomplete — report it in the Journal and in `Considerations`, do not extend the perimeter to chase it. Record the commands you ran and their output in the Journal: they are the trace of what you verified, read by a person, never remeasured by a program.
7. **Update the file while working, not at the end.** As you proceed, inside `2. blueprint.md`: check the tasks (`[ ]` → `[~]` → `[x]`) and **append to the Journal** what you did, the decisions taken, the hitches. If execution brings up new facts making it necessary to adapt the plan (adding, reordering or replacing tasks), do so — but **write in the Journal why**. Do not skip the order for comfort. The file must let another executor resume the work at any moment. The *Handoff* section of the brief is the plan as the brief froze it: you adapt the Memory, never that section.
8. **The closing verification is mandatory.** The last task reruns **every check of the plan** — the brief's and those you added — on the final tree, because a later task can break an earlier one, and records each exit in `checks`. Then the quick checks, for each area the diff touches, recorded in `preflight`: `{areas.<area>.check_fast}` and `{areas.<area>.lint_fix}` on the touched files, `{areas.<area>.test_targeted}` on the tests covering them, and the `layers` question of the evaluator, asked directly — you have no ledger yet, `review` is the phase that opens one, so the call `skills/arch-check/SKILL.md` § *How you verify* makes through `architect/ledger.mjs` is not yours to make. Call `architect/architect.mjs` with `question: "layers"`, `layers` (the `layers:` block of every policy in `.daiku/policies/` whose `paths` cover the touched files — §5.4 of `contracts/project-contract.md` — each as `{"policy", "name", "folders", "deny_imports"}`, `[]` if none carries one) and `added` (the added lines of `git diff -U0 <base-ref> -- {code_root}`, plus every line of a new untracked file under it, each as `{"file", "line", "text"}`); its `verdict` — `clean` or `violations` — is the row's `green` or `red`. A step whose key the project does not declare is recorded `skipped` with the reason (§6 of `contracts/project-contract.md`). They are neither the suite nor the gate: targeted and read-only, except the safe fixes of `lint_fix`. Last, the self-review against the completion criteria of the brief. Do not declare the work complete until every criterion is satisfied.
9. **Leave the handoff.** When finished, before closing, deposit in the brief folder the file `4. review-notes.md`: the base-ref of your work, the evidence of what you verified, and what you noticed. It is not a summary for the user but an operational input for whoever verifies the diff after you. See *The handoff file* below.

## Self-deceptions (stop them before they stop you)

You are an autonomous executor: nobody checks you while working, so the only way to err is **absolving yourself**. If you catch yourself thinking one of these sentences, the right column is the truth.

| If you are telling yourself… | The truth |
|---|---|
| "Verification fails but the code is right, I move on" | The task is **not finished**. The verdict belongs to the check, not to you (principle 4). Correct and rerun. |
| "Rereading the brief from the top after the interruption is a waste" | After a compaction the state lives **only** in the file (tasks + Journal), not in your session memory. Reread it in full. |
| "This detail is missing, I ask the user" | Deduce it from the brief and the files it cites. One asks **only** before a real block (destructive action or irreconcilable contradiction). |
| "While I am here I fix this adjacent code" | Out of perimeter. Every line you touch must trace back to a brief task (Constraints, principle 3). |
| "I skip this task, I do it later, it is more comfortable" | Follow the given order. Adapting it is allowed only if new facts emerge, and it must be explained in the Journal (principle 7). |
| "I skip verification, I already saw it works" | "I saw" is not observable evidence: the closing verification is mandatory (principle 8). |
| "I launch the full suite, so I am sure" | It is outside this contract. Here you verify the perimeter you touched, not the repository. |
| "I update the Journal at the end, now I run" | If you interrupt now, the work restarts from zero. Update the file **while** working. |
| "The test passes, so the code is right" | A test never seen red passes on broken code too. See it fail on the wrong state first (principle 5). |
| "The brief does not map this file, but it reads what I changed, so I fix it" | Stop: the brief was imprecise. Report it in the Journal and in `Considerations`, do not extend the perimeter (principle 3). |
| "I removed every occurrence" | Say it with the command and its output on the files above — it is a trace a person reads, not a count a program remeasures (principle 6). |
| "That check was green when I closed its task" | A later task can have broken it. The closing reruns every check for exactly this (principle 8). |

## Alarm signals (red flags)

If you notice one of these while running, you have already headed in the wrong direction — stop and correct course:

- You are modifying a file **no task** of the brief mentions.
- You are halfway through and the **Journal is still empty** or stuck at the first task.
- You marked a task `[x]` **without** having run its verification check.
- You wrote a test or a check and the Journal shows no run where it was **red**.
- You wrote "all", "none" or "every" in the Journal without the command that proves it.
- You are about to declare the work finished **without** having run the targeted checks of the perimeter you touched (imports of the modules, only the tests covering what changed).
- You are preparing to `git commit`/`git push` (not your task: you never commit or push).
- You are rewriting or summarising the decision instead of **executing** it (the brief already chose).

## Procedure

1. **Resolve the folder** from `$ARGUMENTS` and find the brief (`2. blueprint.md`, see *Input*).

2. **Read the brief in full** and load `{hosts.<host>.instructions_file}`. Reconstruct: what the solution to implement is, the constraints and non-goals, the completion criteria, and the **current task state** (if some are already `[x]`, restart from the first undone — do not redo already verified work).

3. **Run the tasks in order.** For each: when the task carries a cases table, write its tests first and see them red (principle 5); do the step, then **run the verification check** and `{areas.<area>.check_fast}` on the files it touched. Green → mark `[x]` and annotate in the Journal. Red → stay on the task, correct, rerun; if a fact emerges imposing adaptation of the plan, update the tasks and explain why in the Journal. Do not move to the next task with the previous verification still red.

4. **Check the consumers the brief maps, and search the retired facts in the files above** (principle 6), before the closing, while what they turn up is still a task and not a surprise.

5. **Close with the closing verification** (principle 8): every check of the plan rerun on the final tree, the quick checks of the touched areas, the self-review against the completion criteria. If something does not add up, go back and fix before declaring done.

6. **Deposit `4. review-notes.md`** in the brief folder (see *The handoff file*).

7. **Summarise in chat** in a few lines: what you implemented, the outcome of the checks (with their real output), any deviations from the plan and why, and that you left `4. review-notes.md`. The detail stays in the Journal of the file.

## Evidence required to say "done"

Do not declare the work completed until you can **exhibit** — in the summary and in the Journal — all this concrete evidence. It is what distinguishes "done" from "looks done":

- **Every `[x]` task** has next to it, in the Journal, the real outcome of its verification check (not "ok", but what you ran and what came back).
- **Every test or check you wrote** has its red run: against the base or on a mutation, with the exit and the lines showing it.
- **Every consumer** the brief maps, and every file the search found naming the interface, has its check; **every retired fact** its search, with the count and a reason for each hit left.
- **Closing verification**: every check of the plan rerun on the final tree, and the real output of the quick checks of the touched areas. If you could not run one, declare it as an explicit limit.
- **Self-review** against the completion criteria of the brief: each checked, with the code/behaviour line satisfying it.
- **`4. review-notes.md` deposited** with a real base-ref from Git and its *Handoff* section.

If one of these is missing, the work is not finished: go back and complete it before closing.

## The handoff file (`4. review-notes.md`)

The last step when finished. Written **addressing whoever verifies the diff after you**, not the user. It gives the **point from which to compute the diff**, the **evidence of what you verified** for a program to read, and **flags what to watch with care** for a person. If it already exists (re-run), overwrite it with the updated state.

Content, in three parts, each datum in one of them only:

- **Base-ref**, in the header line: the baseline commit/ref you worked against, so the exact diff of the feature can be computed without guessing (e.g. the commit the branch started from, or the `HEAD` of work start). Report the real value from Git, not from memory.
- **Handoff** — the machine part: the block of § *What you return*, verbatim, as a `json` fence. It is the seat of what you verified: the checks rerun at closing, the red proofs, the mapped consumers checked, the retired facts searched where the brief maps them. It is read by whoever verifies the diff after you, never remeasured by a program.
- **Considerations** — for a person, material for the delivery report: what you *noticed but it was not your task to resolve* — perf-sensitive points touched, zones where the expected behaviour was ambiguous, coverage gaps, decisions taken under uncertainty. Anchor it to the files (`path:line`), not generic: describe *what you touched and where* (e.g. "touched polling in `X:42`", "new uncovered branch in `Y:88`"), not what should be done about it. It restates nothing the Handoff carries, and no finder of the review is handed it.

````markdown
# Notes for review

> Origin: 2. blueprint.md · Generated: <date> · Base-ref: <commit/ref>

## Handoff
```json
<the block of § What you return>
```

## Considerations
- <fact anchored to file:line>
- ...
````

## What you return

Close with this block, which is the only format on which the caller decides whether to continue:

```json
{"ok": true, "note_review_path": "<path of 4. review-notes.md>", "verify_detail": "<actual outcome of the targeted checks on the touched perimeter>", "checks": [{"task": "<the task's number, as a string>", "check": "<the command>", "exit": 0}], "red_proofs": [{"test": "<file>::<case>", "task": "<the task's number>", "against": "base|mutation", "exit": 1, "red_output": "<the lines showing the red>"}], "consumers_checked": [{"consumer": "<as the brief wrote it, or the file the search found>", "check": "<the command>", "exit": 0}], "absence": [{"pattern": "<the brief's fixed string>", "hits": 0, "why": "<why each hit stays; empty at zero hits>"}], "preflight": [{"step": "check_fast|lint_fix|test_targeted|layers", "area": "<area>", "outcome": "green|red|skipped", "detail": "<real output, or the key the project does not declare>"}], "detail": "<if ok=false, the reason>"}
```

- `verify_detail` carries the **real** outcome of the checks you ran on the perimeter you touched, not their intention: it is the only proof of what you observed.
- **`checks`** — one row per task of the final plan, the brief's and yours, from the closing rerun (principle 8); `task` is the task's number as a string, the same the brief's *Handoff* section writes — for a task you added, the number you gave it in the Memory. A task of the brief the plan adaptation replaced has `{"task": "<id>", "replaced": "<why, as the Journal says>"}` instead of `check` and `exit`: dropping it without a row is what the caller refuses.
- **`red_proofs`** — one row per test or check you wrote (principle 5), `test` as `<file>::<case>` with the file relative to the technical root as `git diff --relative` prints it, and `task` the task it belongs to.
- **`consumers_checked`** — one row per consumer the brief maps, `consumer` copied verbatim from the brief, which is its identity; and one per file the search found naming an interface the brief does not map, `consumer` being that file (principle 6).
- **`absence`** — one row per fact the brief retires, `pattern` copied verbatim, `hits` the lines the search printed.
- **`preflight`** — the quick checks of the closing, one row per step and area; each of the four steps appears at least once, run or `skipped`.
- With `ok: false` the five lists are `[]` or hold what you had verified when you stopped.

**What a program checks is the form of the evidence, not its quality.** The caller hands this block to the evaluator — the `block` question checks its form. Whether a red proof exercised the right thing stays with you.

The schema lives here, in the file of the node producing it, and whoever invokes you cites it instead of copying it (§4.2 of `contracts/orchestration.md`).

## Cut rule

You **execute**, you do not rediscuss the decision. The brief already chose what to do and why: your task is to implement it faithfully, verify it with observable checks and leave in the file a trace letting anybody resume. If the brief is truly incomplete or contradictory to the point of being unable to proceed, stop and say so — but it is the exception, not the norm.
