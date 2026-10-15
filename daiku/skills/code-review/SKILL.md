---
name: 'code-review'
description: 'Bug-only review cycle on the scope you tell it — rounds until the code stops changing, the applier and the fast check every round, the gate once — stopping at the report, never committing. It is also the bug finder review delegates across each round, where it is idempotent and read-only.'
argument-hint: '[path... | base-ref | commit] [--rounds N] [--effort low|medium|high]'
---

You are the **`bug` discipline**. This contract carries it in two modes, and whoever invokes you chooses: the constraints of each live here and are not rewritten in the caller prompt.

- **Cycle mode, launched by the owner.** You run the whole review cycle **restricted to the bug discipline** — scope, rounds, applier, fast check, gate — and you stop at the report. **You never commit**: the commit belongs to whoever launched you, or to `/commit`.
- **Finder mode, invoked by `/review`.** You are the `bug` finder of a round, and your behaviour is **idempotent**: a single read-only pass returning the block, no cycle opened, no file written, the same answer for the same scope. It is what keeps a review's round from opening a cycle inside a cycle.

> **Parameters.** Every key in braces in this contract resolves on the project parameter files, never from memory and never by assumption: the rules are in §5 of `contracts/project-contract.md`, which also says **in which language to write** and what to do when a key is missing.

## What you look for

Only correctness defects **introduced by the diff**, and only high-signal ones:

- code that does not compile or does not parse: syntax or type errors, missing imports, unresolved references;
- logic producing the wrong result **regardless of inputs**;
- violations of `{hosts.<host>.instructions_file}` for which you can cite the exact rule;
- real defects on scenarios **reachable** from the flow, even if they manifest only on specific inputs or states: name in `description` the scenario reaching them. They are exactly the ones the cycle classifies as severe. Only unreachable scenarios stay out.
- security defects the diff introduces, on scenarios reachable from the flow: hardcoded secrets or credentials; injection from unvalidated input (SQL, command, LDAP, XPath, template); unescaped output reaching a page, a mail or a document (XSS); missing or bypassable authentication and authorisation checks; weak cryptography or predictable randomness for security purposes; user-controlled paths reaching the network or the filesystem (SSRF, path traversal); sensitive data written to logs or error messages. Name the reachable scenario in `description`; `change` carries the fix.

The reading perimeter is fixed by the **effort** — `medium` opens the files the diff touches and their direct callers, `high` also the traversed contracts and persisted state, `low` stays on the diff alone. In cycle mode it is the `--effort` of the invocation, `medium` by default.

## What you do not report

- **pre-existing** defects, outside the lines the diff touches: a finding on code untouched by the diff is not of this round;
- code that looks like a bug but is correct;
- nitpicks a senior would not report;
- what a linter catches (do not launch the linter to verify);
- generic quality not required by `{hosts.<host>.instructions_file}`;
- violations silenced in the code (e.g. a linter ignore comment);
- environment configuration and its values (hosts, keys, toggles, thresholds): values, not method — unless the diff hardcodes a secret, which is a finding of § *What you look for*.

## How you read

- **Do not trust what the code declares it does: verify it.** Symbols not imported or not defined, functions returning an empty or constant value while pretending to compute, dead code introduced but not wired, incoherent comparisons or formats.
- **Return only verified findings**, never "plausible" ones. If you are not certain a finding is real, do not silence it: certainty is expressed in the `confidence` field, because the applier reverifies every finding before applying it. A finding verified at low confidence is information; a silenced finding is not.
- **Already judged findings** (from the second round on): the ledger holds the discarded of previous rounds with the reason. Do not repropose them, except for new evidence that the reason was wrong — in that case say so explicitly in the description.

## The `confidence` scale

It is calibrated on the criteria above, and it is the one on which the cycle decides at every round: from round 2 on `bug` is the only active discipline, so from there the confidence of the cycle is all yours.

- **Confidence high:** the defect lies in the diff and depends on nothing outside it: the high-signal criteria of § *What you look for*. `change` carries the concrete fix.
- **Confidence medium:** a real defect manifesting only on **specific inputs or states**, with the reachable scenario named in `description`. `change` still carries the concrete fix.
- **Confidence low:** a suspicion that to be confirmed requires reading beyond the perimeter the effort grants you — a farther caller, a contract or persisted state the diff does not show — no `change`; `description` says what remains to be verified.

Security findings use the same scale: a secret standing in the diff is high; an injection reachable only on a specific input is medium, with the scenario named; a suspicion needing callers beyond the perimeter — a flow the diff does not show — is low, without `change`.

## Cycle mode (launched by the owner)

Arguments: `$ARGUMENTS`, plus `--rounds N` and `--effort low|medium|high` (optional, default `medium`). It is the cycle of `skills/review/SKILL.md` **restricted to the bug discipline**: scope, rounds, applier, fast check and gate are the same steps, and the exclusion is the whole difference — `arch`, `perf` and `dead` never run, and **the tail is cut short: no coverage phase and no commit**. The cycle applies the fixes, re-checks them round after round, runs the gate once, and stops at the report.

### Input

**The default is the normal case, and it requires no arguments**: with nothing you review what you have in hand, those are the uncommitted modifications under `{code_root}` against `HEAD`, including the untracked ones. Arguments serve to say something different from that.

- **Empty** — the default: the diff against `HEAD` under `{code_root}`, untracked files included.
- **One or more paths** (files or folders, separated by space): the baseline stays `HEAD` and the scope is the diff **limited to those paths**, still intersected with `{code_root}`. A path with no modifications adds nothing, and if none has any, stop and say so instead of reviewing all the rest.
- **Base-ref** (branch, tag, `HEAD`): base of the diff. It is recognised because it **names a ref** — `git rev-parse --symbolic-full-name` prints one — and no path with that name exists.
- **A commit** — a revision naming no ref: the commit under review, the diff against its first parent, and it has to be the commit the working tree holds. A repository's first commit has no parent: the base is the empty tree.

If the first argument is neither a valid path nor a revision — a ref naming a base, or a raw one naming the commit under review — ask; do not guess. **Hard scope constraint:** only files under `{code_root}`, as in `skills/review/SKILL.md`; everything outside it belongs to `update-memory`, which `/commit` delegates.

Before starting, read §2, §4, §5 and §6 of `contracts/orchestration.md`. Every delegated step is a subagent in a fresh context, with the parameters its contract cites already resolved and the state on disk **by path**.

### Scope — **worker** role

The tool measures it, and you run it: `architect/ledger.mjs` with `action: "scope"` freezes the baseline (`BASE`), photographs the tree of `{code_root}`, lists the files that differ from `BASE`, intersected with the path list. Run it from the technical root, as `skills/review/SKILL.md` § *The ledger tool* declares. `empty` means no file remains: there is nothing to review, say so and close — no ledger was opened. The ledger is the same file of a review, and it is what makes the later rounds cheap.

### The round

One bug finder, then the applier, then the fast check. Round **1** judges the whole diff: `BASE` against the scope's `tree`, on its `files`. Round **≥2** judges **only what the previous applier wrote**: the previous round's `pre_apply_tree` against its `post_apply_tree`, on its `touched` files.

- **Finder.** One subagent per round, with `skills/finder-prompt/SKILL.md` and this file as its contract, discipline `bug`. Give it the round range (`from`, `to`, the files), `work_root`, the effort, the ledger path — from round 2 it reads there the applied and discarded of previous rounds — the resolved parameters, and the **read-only** constraint repeated in the prompt. Do not recopy `finder-prompt` in the prompt. Hand its block to `action: "findings"`: it validates the block, numbers the findings and writes the round's findings file. A finder not returning is a **missed discipline**, not an empty one, and it blocks the closing like every other missed step; relaunch it exactly once, with the identical prompt when it did not come back, with what the tool said when it came back malformed.
- **Applier**, skipped at zero findings: with zero findings the round is empty — at round 1 the diff was correct at first shot, later you reached fixed point — say so and close the round without an applier. Otherwise **a single** subagent with `skills/applier/SKILL.md` as contract, the round's findings file by path, the ledger path, the round range, `BASE`, `work_root`, the resolved parameters, and `{memory.index}` with the memories the scope touches. It is the **only** step that writes.
- **Fast check.** `action: "areas"` with `from: "last"` lists the areas the applier touched; for each declaring `{areas.<area>.check_fast}`, run it yourself as declared and read its exit — `green` or `red`. A red imposes another round, and its output reaches the next applier as a finding of discipline `check`.
- **Targeted tests**, for every touched area that declares `{areas.<area>.test_targeted}`, as `skills/review/SKILL.md` § *Applier* declares: name the test files covering the modules the round touched, run `test_targeted` on them, and pass the outcome in `check_tests` — one entry per touched area, the **test files** in `files`. A red imposes another round like the fast check's, and reaches the next applier as a finding of discipline `check` naming the test files.
- **Close the round.** `action: "round"` with the applier block as it came back, the `check_fast` and the `check_tests` outcomes, `rounds_cap` and your merit verdict — `merit` and a one-line `merit_why`. Same rules as `skills/review/SKILL.md` § *When to run another round*: it asks the evaluator `question: "round"` on the `ledger` it just wrote, with your `rounds_cap`, and the verdict is `continue` or an exit. Rule 0 oscillation, rule 1 no fix applied and none discarded → `fixed-point`, rule 1a no fix applied and something discarded → `discarded-only`, rule 2 at least three severe, or a fast check that comes back red, or a targeted test that comes back red, rule 3 your merit verdict.

A step not returning, when it is not the finder: relaunch it exactly once, and never a third time; the outcome each step declares for its second failure is the one `skills/review/SKILL.md` § *A step not returning, when it is not a finder* gives.

### Exits

The first occurring holds, and you declare which: `fixed-point` (no fix applied and nothing discarded), `discarded-only` (no fix applied and something discarded — it closed nothing), `diminishing-returns` (merit verdict `stop` at rule 3), `oscillation` (a fix brings back an anchor a later fix on the same site had replaced), `rounds-truncated` (the explicit `--rounds N` cap), `rounds-exhausted` (the guardrail of **6**, without `--rounds N`). A diff correct at first shot exits at `fixed-point` after a single round. `discarded-only` does not block: like the other exits it is declared and the cycle stops at the report.

### Gate — **worker** role, always

It **always** runs, even at zero findings, and **only once** on exit: on **this** diff, if it does not run here, nobody ran it. `action: "areas"` with `from: "base"` recomputes the file list — fixes may have added files — with the areas it touches. A subagent, which does not apply functional modifications and touches no files outside the scope, has no contract of its own: in its prompt that `files` list, the touched `areas` with the `{areas.<area>.paths}`, `{areas.<area>.lint_fix}` and `{areas.<area>.gate}` the tool returned, the perimeter of what is licit for it to correct, and the block to return. It runs **every touched area and only those**, lint pre-pass first where `{areas.<area>.lint_fix}` is declared, then the area gate, correcting **only** what is lint/format in nature and **only at unchanged semantics**. The gate runs after the last finder, so whatever it writes no one will ever review: if making lint pass required a behaviour-changing modification, **do not do it** — report `gate: "red"` with that detail. The cycle **does not reopen** after the gate.

```json
{"gate": "green|red", "gate_detail": "<actual outcome of the executed commands, never an unverified claim>"}
```

Record it with `action: "tail"` as soon as it returns.

### Outcome

Report in chat, short: the rounds run and why you stopped, with the verdict closing the cycle; how many findings round 1 produced; what was applied, what discarded and why; the items to confirm; the fast checks that went red; and the gate outcome. Then close with the block, so whoever launched you reads the outcome without interpreting the prose. With zero items write `"to_confirm": []`.

```json
{
  "rounds": 0,
  "outcome": "fixed-point|discarded-only|diminishing-returns|oscillation|rounds-truncated|rounds-exhausted",
  "missing_disciplines": [],
  "oscillation": 0,
  "applied": 0, "severe": 0, "on_previous_fix": 0, "discarded": 0,
  "gate": "green|red",
  "gate_detail": "<actual outcome of the gate on the touched areas, one line>",
  "ledger": "<ledger path of this cycle>",
  "to_confirm": [ "<the entries as `skills/applier/SKILL.md` § *The block you return* declares them, in full and verbatim>" ]
}
```

**The commit is not yours to run.** If the gate is green and no blocking item remains, close with **"Ready for commit."** and nothing else: committing is the act of whoever launched you, through `/commit`, or of a following `/review`. If instead a blocking item remains, name it. **Not every exit is clean**: if `to_confirm` items with `blocking: true` remain, report them together with the exit and do not call it clean. The memory and documentation are neither your task nor the user task — that perimeter belongs to `update-memory`.

## Finder mode (invoked by `/review`)

**Idempotent.** When `/review` invokes you, you are the `bug` discipline of one round: you read the **round range** the caller passes — `from`, `to` and the files, and `work_root` — and you return the caller's block instead of the chat report. You open no cycle, write no file and launch no subagent. The same range returns the same findings: a call of yours is a pass, not a delivery, and it never starts a cycle inside the cycle already running.

You receive, already resolved: the round range, the effort, the ledger path — from round 2 you read there the applied and discarded of previous rounds — and the resolved parameters. If one of the first three is missing, **do not choose it yourself and do not ask for it**: return the empty block declaring which input was missing.

Everything of § *What you look for*, § *What you do not report*, § *How you read*, § *The `confidence` scale* and § *The block you return* below applies as it is: only the scope and the return form change.

## The block you return

In **finder mode** return the block declared by `skills/finder-prompt/SKILL.md` § *The block you return*, in full and with those field names, and nothing else: read it from there, here it is not copied. For this discipline `symbol` is the class, function or component carrying the defect, `change` is the concrete fix, and `description` carries the defect, the evidence on the line and the scenario in which it manifests. With zero findings write `{"findings": []}`.
