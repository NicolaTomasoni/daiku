---
name: 'blueprint'
description: 'From the decision document and the chosen solution it produces an autonomous execution brief (2. blueprint.md) and stops there, without executing — launched by hand to stop at the brief, by `ship-feature` as its phase 1, or by `new-feature` for the brief stop.'
argument-hint: '<folder with 1. decision-doc.md> + chosen solution (one option id and text per decision)'
---

It is the step downstream of `decision-doc`. You receive the folder containing the decision document (`1. decision-doc.md`) and the indication of the **chosen solution** by the user. You produce **a single file**, `2. blueprint.md`, which is an **autonomous execution brief**: it contains **only** the information needed for the chosen solution, and a **Memory section** with a **ready-made implementation plan, split into ordered tasks**. You **stop at the brief**: you do not execute the plan and you do not launch any executor. Execution is a separate and atomic step (`execute`).

The generated file serves a *future* executor, who knows nothing of how it came to be: it must instruct it to carry the work through **from start to finish autonomously, without asking anything else of the user** — because every specification is already defined in the document and the user preference has already been expressed — and to **fill in the Memory as it goes** while executing the tasks, taking notes and respecting the established order.

You, here, **do not execute** the plan: you only **prepare** it. The file remains the source of truth — precisely because it is self-sufficient it is the perfect handoff for an executor (`execute`) starting from zero and knowing nothing of how it came to be.

> **Parameters.** Every key in braces in this contract resolves on the project parameter files, never from memory and never by assumption: the rules are in §5 of `contracts/project-contract.md`, which also says **in which language to write** and what to do when a key is missing.

## Invocation modes

**You are launched by hand, by `ship-feature` phase 1, or by `new-feature` for the brief stop.** The brief is the same either way; what changes is where the input comes from and where the block goes.

- **By hand (`owner`).** `$ARGUMENTS` carries the folder and, for each decision of `1. decision-doc.md`, the id and text of the chosen option. If the solution is missing or ambiguous against the document, do not ask and do not guess: stop, and list the decisions and options the document truly declares, so the owner relaunches you with the choice. Close with the block of § *What you return* in chat, and stop there: carrying the folder wherever its execution runs is the owner's manual act, no automated flow performs it.
- **From `ship-feature` phase 1.** Folder, chosen solution and memories arrive resolved in the prompt, and the block returns to the caller. The constraints below hold unchanged, and they are not rewritten in the caller prompt.
- **From `new-feature` (brief stop).** Folder and chosen solution arrive resolved in the prompt — with the **`A`** option for a card the owner did not answer — and the block returns to the caller, which reports it and stops: the folder is carried no further. The constraints below hold unchanged, and they are not rewritten in the caller prompt.

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
4. **Observable verification that can fail, not self-declared.** Every task has an **executable verification criterion**: the strongest observable check available for that kind of work — build, test, a command for code; a concrete equivalent check when the work is not code (a file produced in the expected form, a comparable output). Next to it the task names **the state that turns it red** (`Red if:`): the wrong result the check catches. A check no wrong state can fail is not a verification — a `grep` finding a name proves the name is there, not that it is right, and it is admitted only for a task whose whole goal is that presence, which then says so. **On a set that can be enumerated** — rules, checks, table rows, branches, enum values, entry points, call sites, the members of a registry — the check covers **every** element, never an example: a minimum written in the brief becomes the ceiling the executor stops at. Never "done when it looks done": the verdict belongs to the check, not to the executor. No vague tasks.
5. **Map who reads what you change.** For every interface the solution touches — a signature, a field of a block, a JSON key, an argument, a prose instruction naming the inputs of a call, a registry listing the members of a set — the brief declares its **single seat** and its **consumers**, each with the `path:line` that `git grep -n -F '<literal string>'` returned. Every consumer becomes a task or a check: the executor stays inside the brief's perimeter, so a consumer the brief does not map is one nobody verifies. Name each interface by that literal string, specific enough that the search returns its readers and nothing else: the caller runs the same search again before the review, and every file it finds must be one you mapped or one the executor checked. And the check of a call is **running it as written** — the compilation or type-check of the calling file, or, for a call written in prose to a program, the very input the prose describes handed to that program, which refuses a missing key — never a `grep` that the name is there.
6. **Say which facts the change retires.** A renamed thing, a changed count, a reversed rule: the old wording survives in a sentence, a table or a comment nobody reopened. For each, the brief carries the old wording and the fixed string `git grep -F` finds it with; the executor searches it and answers for every hit.
7. **Tests first, where behaviour changes.** A task that changes what the code does carries a **cases table**: one row per element the change enumerates — table row, prose item, branch, enum value, input, boundary case — with the input and the expected outcome. The executor writes those tests first and sees them red before writing the code. The table is written here because this context does not yet know how the code will look, and a case derived from the code already written confirms it instead of testing it.
8. **Mandatory closing verification.** The last tasks of the plan are always a closing verification: **every check of the plan rerun on the final tree** — a later task can break an earlier one — plus the quick checks of the touched areas `skills/execute/SKILL.md` declares for its closing, and a self-review of the result against the initial completion criteria. Without this, autonomy produces wrong results with confidence. The package gate — full suite, lint, type-check, build — **does not enter the plan**: it belongs to `/review`, which always runs it on the diff.
9. **Anchored to the inputs.** Do not invent specifications, constraints or tasks that the document, the reference files and the code do not justify. If an operational detail is truly missing, write it as an **explicit assumption** inside the brief, so the executor proceeds knowingly instead of stopping.
10. **You prepare, you do not execute.** Do not modify the project code. You can and must **read it** to anchor the plan (principle 3), but your only written output is `2. blueprint.md`.
11. **You are the last step to look at the code.** The maps of principles 5 and 6 are built here,
    by reading the code, and never remeasured downstream: from here on nobody searches the
    repository to check completeness — the executor works only on the files this brief cites,
    and if one it needs is missing the brief was imprecise, not the execution timid. So the
    brief carries **everything** the executor needs: every file it must touch or check is
    cited, every integration point is described by role (which part of the system it is,
    what it owes the solution) beside its concrete path here, and every point where a
    different project may diverge is an explicit assumption.
12. **Behaviour in, behaviour out.** The brief carries no real data — no query results, no
    record contents, no credentials, no personal names, no business figures — and no code
    excerpts: paths, interface names and error codes are structure and may stay, values
    never enter. The solution is described so that it solves this instance **and** the same
    problem on a different project: the mechanism in general terms, the completion criteria
    as observable behaviour, the cases tables with abstract inputs — the concrete paths of
    this project only where the executor must put its hands.

## Procedure

1. **Resolve the folder** and open `1. decision-doc.md`. Locate the decisions and the options.

2. **Pin down the choice(s)** of the user from `$ARGUMENTS`.

3. **Distill the chosen solution**: from what must be done and why, to the constraints and specifications, to the completion criteria. Keep only the material of the chosen option.

4. **Anchor to the real code.** Read the files and the code locations the solution touches. Verify that the assumptions of the document hold and collect the concrete paths and details the executor will need. Derive the **target paths** — the `{code_root}`-relative paths and areas the solution will touch, read from the policies `paths`/`layers` before opening code. For each interface the solution touches, `git grep -n -F` its literal string and keep every consumer it returns (principle 5); for each fact it retires, the fixed string finding the old wording (principle 6). Where reality diverges from the document, adapt the plan of the next step accordingly.

5. **Build the implementation plan**: break the solution into ordered and verifiable tasks. Each task = one executable step + one **observable check** declaring it complete + the **state that turns it red** (principle 4); a task changing behaviour also carries its cases table (principle 7). If one task presupposes another, put it after. **Open** the plan with a reconnaissance task (verify in the field the remaining assumptions of the brief) and **close it** with the mandatory closing verification (principle 8).

6. **Write `2. blueprint.md`** in the input folder, with the structure below, ending with the *Handoff* section — the block of § *What you return*. Include the **provenance** line (from which document and version/date the brief originates). If it already exists, do **not** rerun the brief and do not write a second one: close with the block its *Handoff* section carries (see § *What you return*). Save in the project encoding, without degrading non-ASCII characters.

7. **Summarise in chat** in a few lines: the chosen solution and the tasks of the plan in order. The detail lives in the file.

8. **Stop here.** Do not execute the plan and do not launch any executor: whoever invoked you opens `execute` on the same folder as the next phase of its sequence.

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
- Respect the project's architectural rules (`{hosts.<host>.instructions_file}` and
  `.daiku/policies/`).
- Target paths: <the `{code_root}`-relative paths and areas the solution will touch,
  derived from the policies `paths`/`layers` before opening code>
- No destructive or remote Git operations (no unjustified reset --hard,
  no push, no PR) unless explicitly requested in the brief.
- Do not do (non-goals): <list what is explicitly out of this solution>

## The chosen solution              ← only the needed info, distilled
- What to do and why (the decision and the chosen option), in behavioural terms: the mechanism
  in general, not the code that implements it here
- Relevant constraints and specifications
- Completion criteria / quality gate, as observable behaviour
- Explicit assumptions (if some operational detail was not in the document), including where a
  different project may diverge and what the executor must re-derive there
- Reference files and useful code locations (paths in the folder and in the repo): every file
  the executor must touch or check is cited here — what is not cited is not opened downstream
- For each integration point, its role (which part of the system it is, what it owes the
  solution) beside its concrete path in this project

## Interfaces touched and their consumers   ← principle 5; "none" if the change touches none
- <literal string> — seat: <path:line> — consumers: <path:line>, <path:line>
  (from `git grep -n -F '<literal string>'`; each consumer is a task or a check below)

## Facts this change retires        ← principle 6; "none" if it retires none
- "<old wording>" — search: `git grep -n -F '<fixed string>'`

## Memory — plan and journal        ← ready-made plan, to fill in
   State: [ ] to do · [~] in progress · [x] done

   - [ ] Task 0 — Reconnaissance: verify in the field the remaining assumptions of the
         brief (files/signatures/integration point exist as expected).
         Check: <observable check; if it diverges, adapt the plan and note it>
         Red if: <the divergence that makes you adapt the plan>
         Notes:
   - [ ] Task 1: <executable step>
         Check: <observable check: build/test/command — on every element when the task
                works on a set>
         Red if: <the wrong state this check catches>
         Cases: (only when the task changes behaviour: write these tests first, see them red)
           | Input | Expected |
           |---|---|
           | <input> | <expected outcome> |
         Notes: (fill in during execution)
   - [ ] Task 2: ...
         Check: ...
         Red if: ...
         Notes:
   ...
   - [ ] Task N — Closing verification: rerun every Check above on the final tree, run the
         quick checks of the touched areas the execute contract declares for its closing,
         and self-review the result against the completion criteria. The package gate
         does not go here: it belongs to `/review`.
         Check: every check of the plan green on the final tree; every criterion satisfied.
         Red if: an earlier task's check fails after the later ones, or a criterion is unmet.
         Notes:

   ### Journal
   (Append here, in order, what you did, the decisions taken, the deviations from the
   plan and why, the hitches. Keep the task state above aligned.)

## Handoff                          ← the block of § What you return, as a json fence;
                                      the executor never edits it
```

Cut rule: whoever reads `2. blueprint.md` must be able to execute the whole solution **without** opening other documents except the explicitly cited reference files, and **without** asking anything of the user.

## After the brief

Finish here: your only output is `2. blueprint.md` and the return block. Do not execute the plan in your context and do not launch executors. Execution is `execute`, a separate step that whoever invoked you opens in a **fresh context** — never in yours, because a brief written and then executed by the same context was never put to the test of being self-sufficient, which is the only property asked of it.

## What you return

Summarise in chat (Procedure point 7) and **close with this block — you are the Brief phase of `ship-feature`** — which is the only format on which the caller decides whether to continue:

```json
{"ok": true, "brief_path": "<path of 2. blueprint.md>", "plan": [{"task": "<the task's number, as a string>", "check": "<the Check line>", "red_if": "<the Red if line>", "cases": [{"input": "<input>", "expected": "<expected outcome>"}]}], "interfaces": [{"symbol": "<literal string>", "declared_in": "<path:line>", "consumers": ["<path:line>"]}], "retired": [{"fact": "<old wording>", "pattern": "<fixed string>"}], "detail": "<if ok=false, the exact reason>"}
```

- **`plan`** is the task list of the Memory as you froze it, one item per task; `task` is the number the Memory gives it, as a string (`"0"`, `"1"`, … up to the closing task's), and it is the identity the executor answers with; `cases` is the task's cases table, `[]` for a task that changes no behaviour.
- **`interfaces`** and **`retired`** are the two sections of the same name, item by item. An empty list says the change touches no interface, or retires no fact: the key is never omitted.
- With `ok: false` the three lists are `[]`.

**The block stands in the file, and that is its seat.** Write it verbatim in the *Handoff* section of `2. blueprint.md` and return that same object: a delivery resumed after this phase reads it there (`skills/ship-feature/SKILL.md` § *Progress and findings*), because the chat that carried it is gone. It is the plan **as you froze it**: the executor adapts the Memory, never the *Handoff* section, and answers for every task of it in its own block — which is how a task dropped along the way stays visible.

If `2. blueprint.md` already existed, do **not** rerun the brief: `ok: true` and the block its *Handoff* section carries. If that section is missing or does not have this form — a brief written before it existed, or a relaunch after the caller found it malformed — rewrite that section alone from the file's own tasks and sections, completing there what they lack (a `red_if`, a consumer map, a search for a retired fact) as principles 4 to 7 ask: it is the only change you make to an existing brief.

**Whoever receives it checks its form, not its quality.** The caller hands it to the `block` question of the evaluator (`skills/ship-feature/SKILL.md` § *1. Brief*), which refuses an empty `check` or `red_if`, a behaviour table without input or expected outcome, a consumer that is not a string: a `Red if` it finds non-empty can still be banal, and whether it catches a real wrong state stays with you.

The schema lives here, in the file of the node that produces it, and whoever invokes you cites it instead of copying it (§4.2 of `contracts/orchestration.md`): a block rewritten in the caller diverges from this one at the first modification, and the first to diverge is always the line somebody added afterwards.
