---
name: 'blueprint'
description: 'Internal develop-feature contract — from the decision document and the chosen solution it produces an autonomous execution brief (2. blueprint.md) and stops there, without executing.'
user-invocable: false
---

It is the step downstream of `decision-doc`. You receive the folder containing the decision document (`1. decision-doc.md`) and the indication of the **chosen solution** by the user. You produce **a single file**, `2. blueprint.md`, which is an **autonomous execution brief**: it contains **only** the information needed for the chosen solution, and a **Memory section** with a **ready-made implementation plan, split into ordered tasks**. You **stop at the brief**: you do not execute the plan and you do not launch any executor. Execution is a separate and atomic step (`execute`).

The generated file serves a *future* executor, who knows nothing of how it came to be: it must instruct it to carry the work through **from start to finish autonomously, without asking anything else of the user** — because every specification is already defined in the document and the user preference has already been expressed — and to **fill in the Memory as it goes** while executing the tasks, taking notes and respecting the established order.

You, here, **do not execute** the plan: you only **prepare** it. The file remains the source of truth — precisely because it is self-sufficient it is the perfect handoff for an executor (`execute`) starting from zero and knowing nothing of how it came to be.

> **Parameters.** Every key in braces in this contract resolves on the project parameter files, never from memory and never by assumption: the rules are in §5 of `contracts/project-contract.md`, which also says **in which language to write** and what to do when a key is missing.

## Input: folder and chosen solution

Arguments: `$ARGUMENTS`

The argument indicates the **folder** (where `1. decision-doc.md` lives) and **which solution** was chosen.

- If the folder was not passed to you, or does not exist, **stop and say so in the block**: there is nobody to ask for it.
- Look for `1. decision-doc.md` in the folder. If it is not there but `0.5. strategic-study.md` is, **stop**: decisions are not closed, and a brief built on the strategic study would freeze a plan on options nobody chose. If neither one nor the other is there, stop just the same and declare what you found in the folder.
- **Identify the chosen solution** by comparing the indication you received with the decisions of the document. If it is ambiguous or absent, **do not ask and do not guess**: stop, and in the block list the decisions and options the document truly declares, so that whoever invoked you can bring them to whoever decides. It is the same rule as the three cases above and the one below, and it has no exceptions — you have no channel to the owner (§ *Ask the owner* of `contracts/orchestration.md`). The brief you produce, in turn, must make the later execution autonomous.
- If the decisions in the document are more than one, collect **all** the user choices (one per decision) before generating the brief.
- With the folder you also receive `{memory.index}` and the **paths** of the memories the perimeter touches, to open before deciding: it is the channel of §4.1 of `contracts/orchestration.md`. If the caller does not pass them to you, open the index and choose yourself — a brief that ignores a decision already taken makes the executor rediscover it at its own expense.
- With several choices, **verify that they are mutually coherent** (the option chosen for one decision must not contradict that of another). If they are incompatible, stop and report in the block which ones contradict each other and why, without generating the brief.

## Principles

1. **Only what is needed.** The brief includes only the information needed to realise the chosen solution: the relevant decision, the chosen option, its rationale, the relevant constraints and specifications, the completion criteria. **Discard** the unchosen options and the unrelated decisions — they must not distract the executor.
2. **No loss of specifications.** Everything needed to execute must be *inside* `2. blueprint.md` (or explicitly point to a reference file in the folder). The executor must not return to the decision document nor to the user to recover a detail.
3. **Anchor the plan to the real code, not only to the document.** The decision document is highly abstract and may not reflect the current state of the code. Before freezing the plan, **read the code and the files involved** and verify that the assumptions hold (the files exist, the signatures are as expected, the integration point is where you believe). If reality diverges from the document, **adapt the tasks** and annotate the divergence. A plan built without looking at the ground is the first cause of error.
4. **Observable verification, not self-declared.** Every task has an **executable verification criterion**: the strongest observable check available for that kind of work — build, test, `grep`, a command for code; a concrete equivalent check when the work is not code (a file produced in the expected form, a comparable output). Never "done when it looks done": the verdict belongs to the check, not to the executor. No vague tasks.
5. **Mandatory closing verification.** The last tasks of the plan are always a closing verification: the strongest check **targeted at the touched perimeter** (for code: imports of the touched modules and only the tests covering what changed; otherwise the concrete equivalent check) and a self-review of the result against the initial completion criteria. Without this, autonomy produces wrong results with confidence. The package gate — full suite, lint, type-check, build — **does not enter the plan**: it belongs to `/review`, which always runs it on the diff.
6. **Anchored to the inputs.** Do not invent specifications, constraints or tasks that the document, the reference files and the code do not justify. If an operational detail is truly missing, write it as an **explicit assumption** inside the brief, so the executor proceeds knowingly instead of stopping.
7. **You prepare, you do not execute.** Do not modify the project code. You can and must **read it** to anchor the plan (principle 3), but your only written output is `2. blueprint.md`.

## Procedure

1. **Resolve the folder** and open `1. decision-doc.md`. Locate the decisions and the options.

2. **Pin down the choice(s)** of the user from `$ARGUMENTS`.

3. **Distill the chosen solution**: from what must be done and why, to the constraints and specifications, to the completion criteria. Keep only the material of the chosen option.

4. **Anchor to the real code.** Read the files and the code locations the solution touches. Verify that the assumptions of the document hold and collect the concrete paths and details the executor will need. Where reality diverges from the document, adapt the plan of the next step accordingly.

5. **Build the implementation plan**: break the solution into ordered and verifiable tasks. Each task = one executable step + one **observable check** declaring it complete. If one task presupposes another, put it after. **Open** the plan with a reconnaissance task (verify in the field the remaining assumptions of the brief) and **close it** with the mandatory closing verification (the strongest check targeted at the perimeter — imports and tests of the touched code — + self-review against the completion criteria).

6. **Write `2. blueprint.md`** in the input folder, with the structure below. Include the **provenance** line (from which document and version/date the brief originates). If it already exists, do **not** rerun the brief and do not write a second one: report it and close with the existing path (see § *What you return*). Save in the project encoding, without degrading non-ASCII characters.

7. **Summarise in chat** in a few lines: the chosen solution and the tasks of the plan in order. The detail lives in the file.

8. **Stop here.** Do not execute the plan and do not launch any executor: whoever invoked you opens `execute` on the same folder, and it is the next phase of its sequence, not a command somebody must remember to type.

## Structure of the produced file (`2. blueprint.md`)

The file is written **addressing the executor** (second person, operational imperative).

```text
# Execution: <chosen solution name>

> Source: <document, version/date> · Generated: <date>

## Mandate                          ← autonomy instructions for the executor
- Execute this plan from start to finish **autonomously**.
- **Do not ask the user for information**: every specification is already here and the
  choice has already been made. If a detail seems missing, derive it from this
  brief and the cited reference files, do not stop.
- Stop and return the block **only** in front of a true obstacle (destructive or
  irreversible action not justified by the brief, or unresolvable internal contradiction).
- **This file is the source of truth.** If you resume after an interruption or a
  context compaction, **reread it in full** (task state + Journal)
  before continuing: the state of the work lives here, not in session memory.
- Follow the tasks **in the given order**. You may **adapt the plan** (add,
  reorder or replace tasks) only when execution surfaces new facts
  that make it necessary: in that case update the tasks and **write in the Journal
  why**. Do not skip the order for convenience.
- Update the **Memory** as you proceed: tick off tasks, note decisions,
  results and problems.

## Constraints and perimeter        ← guardrails for autonomous execution
- Surgical changes: touch only what the solution needs. No
  refactoring or improvements out of scope.
- Respect the project's architectural rules (`{instructions_file}` and
  `.daiku/policies/`).
- No destructive or remote Git operations (no unjustified reset --hard,
  no push, no PR) unless explicitly requested in the brief.
- Do not do (non-goals): <list what is explicitly out of this solution>

## The chosen solution              ← only the needed info, distilled
- What to do and why (the decision and the chosen option)
- Relevant constraints and specifications
- Completion criteria / quality gate
- Explicit assumptions (if some operational detail was not in the document)
- Reference files and useful code locations (paths in the folder and in the repo)

## Memory — plan and journal        ← ready-made plan, to fill in
   State: [ ] to do · [~] in progress · [x] done

   - [ ] Task 0 — Reconnaissance: verify in the field the remaining assumptions of the
         brief (files/signatures/integration point exist as expected).
         Check: <observable check; if it diverges, adapt the plan and note it>
         Notes:
   - [ ] Task 1: <executable step>
         Check: <observable check: build/test/grep/command>
         Notes: (fill in during execution)
   - [ ] Task 2: ...
         Check: ...
         Notes:
   ...
   - [ ] Task N — Closing verification: the strongest check targeted at the perimeter
         (code: imports of the touched modules and only the tests covering them; otherwise
         the concrete equivalent check) and self-review of the result against the
         completion criteria. The package gate does not go here: it belongs to `/review`.
         Check: the check passes; every completion criterion satisfied.
         Notes:

   ### Journal
   (Append here, in order, what you did, the decisions taken, the deviations from the
   plan and why, the hitches. Keep the task state above aligned.)
```

Cut rule: whoever reads `2. blueprint.md` must be able to execute the whole solution **without** opening other documents except the explicitly cited reference files, and **without** asking anything of the user.

## After the brief

Finish here: your only output is `2. blueprint.md` and the return block. Do not execute the plan in your context and do not launch executors. Execution is `execute`, a separate step that whoever invoked you opens in a **fresh context** — never in yours, because a brief written and then executed by the same context was never put to the test of being self-sufficient, which is the only property asked of it.

## What you return

Summarise in chat (Procedure point 7) and **close with this block — you are the Brief phase of `develop-feature`** — which is the only format on which the caller decides whether to continue:

```json
{"ok": true, "brief_path": "<path of 2. blueprint.md>", "detail": "<if ok=false, the exact reason>"}
```

If `2. blueprint.md` already existed, do **not** rerun the brief: `ok: true` with the existing path.

The schema lives here, in the file of the node that produces it, and whoever invokes you cites it instead of copying it (§4.2 of `contracts/orchestration.md`): a block rewritten in the caller diverges from this one at the first modification, and the first to diverge is always the line somebody added afterwards.
