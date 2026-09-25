---
name: 'review'
description: 'Review cycle on a diff — frozen baseline, rounds stopping when the code stops changing, ledger of already judged findings. Round 1 fans out the finders (bug always, arch/perf from scope), later rounds re-review only the just-written fixes. Gate once on exit, then the commit, which always closes the cycle except with --no-commit. Orchestrated by you, delegating each phase to a subagent. Same discipline that /develop-feature runs in its Review phase.'
argument-hint: '[file... | base-ref | path to "4. review-notes.md"] [--rounds N] [--effort low|medium|high] [--with arch-check,perf,test-coverage] [--no-commit] [--backend <name> if the session runs there]'
---

You are the **engine of a review cycle** on a diff. One round is scope → finders → fix application; the cycle itself decides how many rounds to run, by watching what the round just produced. Then the gate, only once. Finally the commit, which always closes the cycle except with `--no-commit`. You orchestrate, delegating each phase to a subagent per `contracts/orchestration.md`.

This file is the **single source** of the project review discipline: `develop-feature` runs it in its Review phase. If review changes, it is touched here and nowhere else.

**Why it is a cycle and not a pass.** The fixes the applier writes are new code no finder ever saw: by construction, a round applying fixes leaves behind an unreviewed perimeter, and the gate verifies it compiles, not that it is correct. It is the class of defect no single pass can find — a correction breaking another — and the only way to see it is re-reviewing the fixes.

> **Parameters.** Every key in braces in this contract resolves on the project parameter files, never from memory and never by assumption: the rules are in §5 of `contracts/project-contract.md`, which also says **in which language to write** and what to do when a key is missing.

## When to use it

- **The diff of a feature**, delivered by `execute` or hand-written, when you want only review without the whole `develop-feature` chain.
- **The one-off modifications layered in chat**, a series of requests accumulated by end of day on many files and to confirm before delivering them.

Only the width of round 1 changes, which the cycle itself decides by reading the diff. There is no mode to declare.

## Input

Arguments: `$ARGUMENTS`. **The default is the normal case, and it requires no arguments**: with nothing you review what you have in hand, those are the uncommitted modifications under `{code_root}` against `HEAD`, including the untracked ones. Arguments serve to say something different from that.

- **Empty** — the default: `git diff HEAD -- {code_root}` plus untracked files, that is the current work inside the perimeter where the application lives. Nothing else enters the scope, even if changed.
- **One or more paths** (files or folders, separated by space): the baseline stays `HEAD` and the scope is the diff **limited to those paths**, still intersected with `{code_root}`. It is the form for reviewing part of what you have in hand instead of all: a path with no modifications adds nothing to the scope, and if none of the paths has any, stop and say so instead of reviewing all the rest.
- **Base-ref** (branch, tag, SHA, for example `main`): diff base. It is recognised because `git rev-parse --verify` resolves it and on the filesystem no path with that name exists; when in doubt — a branch named like a folder — the **path** holds, and it is the case you declare in the outcome instead of silently choosing it.
- **Path to `4. review-notes.md`** (or to the folder containing it): verify it exists; the base-ref is declared by that file.
- **`--rounds N`** (optional): explicit cap, to truncate the cycle by hand. Without, the round count is decided by the trend (§ *When to run another round*) and the only cap is the guardrail at `6`.
- **`--effort low|medium|high`** (optional): finder depth. Default `medium`. On a truly one-off perimeter — a handful of files — `high` mostly produces uncertain findings to discard by hand; on a wide perimeter, dozens of files and several layers, it pays off: it is the depth at which rounds keep finding real defects instead of noise.
- **`--with arch-check,perf,test-coverage`** (optional): the **values** decide what to force. `arch-check` and `perf` force the active discipline at round 1, regardless of what scope would decide; `test-coverage` forces the Coverage phase after the cycle (§ *Coverage*), removing from the worker the faculty of skipping it. Explicit manual override, never a deactivation.
- **`--no-commit`** (optional): suppresses the closing commit, and the cycle stops at the report. It is passed by **whoever commits itself** — `develop-feature`, which has its own commit phase — not by whoever has a doubt on the diff: a cycle arriving at the end with green gate and no blocking item has already decided, and the conditions of § *Closing* are there precisely to stop everything else.
- **`--backend <name>`** (optional): the name of the backend the session runs on, to declare only if not the native one of the host; it affects only fan-out concurrency, and it is `contracts/orchestration.md` §5 saying whether that backend sequentialises it.
- If the first argument resolves to neither a base-ref nor a valid path, ask — do not guess.

**Hard scope constraint:** review always and only covers files under `{code_root}`. No external file enters finders or fixes, even if modified, untracked or cited in the review notes. Everything not standing under `{code_root}` — documentation, memory, skill contracts — belongs to `update-memory`, which the commit contract delegates itself. The changelog does not: `skills/commit/SKILL.md` claims it in its own § *Version bump and changelog* and writes it directly, without passing through `update-memory`. The PreToolUse edit guard enforces this coarse perimeter on new files; layer placement inside `{code_root}` stays with `arch`.

## Before starting

Read `contracts/orchestration.md`: roles, host, delegation, concurrency. Each phase declares its own role and you resolve the model with the rule of its §2 — never from here.

### When review runs on a worktree

When whoever invokes you passes a work root (the worktree) besides the main tree: every Git command, the diff, fixes, coverage and gate run in the work root; the ledger (`{paths.review_state}/`) and `5. review-report.md` are written in the main tree. The base-ref is the SHA `4. review-notes.md` declares: freeze it with `git rev-parse` in the work root and do not recompute it. The commit stays ruled by `--no-commit` as always.

## Preparation — only once

### Scope — **worker** role

Subagent computing the scope with real Git. It has no contract of its own to read: everything it must do stands in the prompt, and in the prompt you put the **base-ref** of this run, the mandatory `{code_root}` pathspec, the three commands below, the criterion of the two conditional disciplines and the block to return — plus the **read-only** constraint, which no harness layer imposes on whoever has `Bash` (§4 of `contracts/orchestration.md`).

The commands: `git status --porcelain -- {code_root}`, `git diff --stat <base> -- {code_root}`, `git ls-files --others --exclude-standard -- {code_root}`. Never include files external to `{code_root}`.

If the invocation restricted the scope to a **path list** (§ *Input*), those paths enter the three commands as pathspecs **after** `{code_root}`, not in its place: the application perimeter stays the outer boundary, and the restriction works inside it.

It also decides the two conditional disciplines:

- **arch-check** active if the diff touches a file covered by the architectural rules: list `.daiku/policies/`, read the `paths` frontmatter of each file and verify whether at least one pattern covers a scope file. The rule list is the only source: keep no layer list here;
- **perf** active if the diff touches a hot path (rendering, polling, loop, query, serialisation, high-frequency flow).

```json
{"base_ref": "<ref>", "files": ["<path>"], "arch_active": false, "perf_active": false}
```

Normalise paths with `/` slashes and discard everything not starting with `{code_root}`. Then apply the `--with` overrides. **If no file remains, stop**: there is nothing to review, say so and close.

### Baseline and ledger

1. **Freeze the baseline**: `git rev-parse <base-ref>` → `BASE`. All rounds use this SHA, not a recomputed `HEAD`. The fixes you apply enter the diff: if you recomputed the base every round, the scope would move under the feet of the cycle.
2. **Open the ledger**: `{paths.review_state}/review-ledger-<short BASE>-<start HHMMSS>.json` (the first seven digits of the SHA, the review start time). It is the file making later rounds cheap. The name carries baseline and time because several reviews can run in the same session — and a resumed delivery restarts from the same commit — and because a ledger of a previous review on the same baseline would carry to the finders the discarded of another diff. Location: `{paths.review_state}/` under the technical root — outside the versioned repository — if `.gitignore` does not cover it, say so in closing instead of writing inside it anyway — but **stable**, not at session expiry.

**The ledger declares whose it is.** Next to the `base` line stands `item`: the identity of the work this review is reviewing — the **work folder**, normalised with `/` slashes, when the input was `4. review-notes.md` or the folder containing it; `null` on a review launched by hand on a naked base-ref. Writing it costs one line and serves the next step: the baseline **alone does not identify a review** — a resumed delivery restarts from the same commit, and two different reviews can share the same `base`.

**Never reopen a ledger you found alone.** Only the one whose path was handed to you in the prompt by whoever invokes you is reopened, and only if **both** fields coincide: `base` with the `BASE` of this run, and `item` with the work you are reviewing. It is the resumption of the **same** interrupted review, not the ledger of another. In that case restart from the round after the last recorded, with its applied and discarded already in hand. Without that path, new ledger.

**Which road to take is asked, not felt.** Call `architect/architect.mjs` — the evaluator that `skills/develop-feature/SKILL.md` § *The evaluator* declares — with `question: "resumption"`, the ledger you were handed (or `null`), the artefacts present and the entry point: `resume` from a phase or from a round, `restart` when the ledger does not identify this review, `stop` when the input and the artefacts contradict each other. The **safety consequence stays here** and is not a classification: a ledger found by yourself is never reopened, and when the candidates remain more than one you pass none of them.

**If the candidates remain more than one, do not choose**: new ledger, and you declare it in closing. Valid also when the handed ledger carries no `item`: you do not know whose it is. Opening a new one costs a triage; taking the wrong one carries to the finders the `discarded` of another diff, to the applier `applied` whose `anchor` does not exist in its code, and makes `on_previous_fix` and `oscillation` run against another feature's strings — that is it silently breaks the two signals the cycle decides on.

So it serves something, the ledger must be **reachable**: its path enters the return block (§ *Outcome*), and without it a review interrupted at the fourth round restarts from zero — the whole triage must be run again and, above all, the `anchor` of the applied disappears, so `on_previous_fix` and `oscillation` can no longer trigger on the already written fixes. They are the two signals the whole iteration criterion is built on.

```json
{"base": "<sha>", "item": "<work folder, or null>", "rounds": [{"n": 1, "disciplines": ["bug"], "missing_disciplines": [], "applied": [{"file": "", "symbol": "", "anchor": "", "line": 0, "what": "", "severe": true, "on_previous_fix": false}], "discarded": [{"file": "", "symbol": "", "line": 0, "why": ""}], "to_confirm": [], "oscillation": [{"file": "", "symbol": "", "current_anchor": "", "previous_anchor": ""}], "verdict": "continue|stop", "why": ""}], "outcome": null, "coverage": null, "gate": null, "gate_detail": null}
```

### The ledger also keeps what blocks, not only what restarts

The `rounds` restart the cycle; the four tail fields — `outcome`, `coverage`, `gate`, `gate_detail` — and `missing_disciplines` inside each round are what the **commit** stops on. Without them a resumption loses them all, and loses them silently: in the ledger a discipline never returned and a discipline never activated produce the same identical line.

- **`missing_disciplines` is written in the round where the discipline did not come back**, immediately, with the same name the final block will use. It is the field distinguishing the two resembling outcomes (§ *Finder*). On resumption, `missing_disciplines` of the final block is the **union** of those of all recorded rounds: an `arch` missed at round 1 blocks the commit even if the session fell at round 3 and resumption closed at `fixed-point`. `arch` and `perf` are done only once at round 1: what they did not see then nobody will ever see, ever.
- **`outcome`, `coverage`, `gate` and `gate_detail` are written as soon as you have them**, not at the end together with the report: `outcome` when you exit the cycle, `coverage` when the Coverage phase returns, `gate` and `gate_detail` when the gate returns. They stay `null` until that step ran, and it is that distinction making resumption possible.
- **On resumption do not redo what the ledger already declares done.** If the last recorded round carries `verdict: "stop"`, the cycle already exited: do not open another round — skip to the first step still `null` in the ledger, in the order coverage → gate → closing. Re-running an already green gate costs the whole suite, that is precisely the resource the gate, running only once, exists not to spend twice.

### How a fix is identified, between one round and the next

**Never by line number.** A fix moves everything standing below it: at round 3 "the line 88 I corrected" is no longer line 88, and the two signals this cycle decides on — `on_previous_fix` and the `oscillation` exit — would trigger at random or never trigger.

Every fix is recorded with two anchors surviving later rounds:

- **`anchor`** — the text of the corrected line after the fix, normalised to spaces, truncated at ~80 characters. It is the **identity of the fix**: two fixes with the same `anchor` in the same file are the same fix.
- **`symbol`** — the qualified name of the container the fix stands in: `Class.method`, `function`, `ReactComponent`, or the module constant/block name for code outside a function. It serves to **orient** and to **group** — it is the criterion with which the `oscillation` exit (§ *Exits*) locates two fixes bouncing the same area — but alone it does not identify a fix.

`line` stays in the ledger as an **indication for the human reader**, never as identity: never compare it across different rounds.

### The two signals are verified, not accepted

`severe` is a merit judgement and stays with the applier: nobody else has in hand the context to give it. `on_previous_fix` and `oscillation` do not — they are **measurements on strings**, and you do them after every round, before emitting the verdict. It is the same asymmetry holding the cycle: whoever wrote the fixes is not the source of the signal deciding whether somebody will reread them.

With the ledger in hand, both cost one command:

- **`oscillation`**: for each new fix, does `anchor` coincide with one already recorded for the same `file` and `symbol` in a round **earlier than the one of the last fix**? It is a string comparison on the ledger, and the identity of a fix is already defined so (§ *How a fix is identified*). The comparison also runs on the items of the applier `oscillation` field, carrying the two anchors of every fix it suppressed: those fixes are not among `applied` precisely because they were not applied, and without their anchors the only stop condition of the cycle would stay a self-declaration of the step you verify. Its items enter the round ledger like the others.
- **`on_previous_fix`**: does the `anchor` of a fix of a previous round no longer appear in its file (`git grep -F '<anchor>' -- <file>` empty), or does it fall among the lines the new fix touched. Both cases say one correction rewrote another.

If your verification and the applier block diverge, **yours holds**: annotate the deviation in the ledger next to the fix, because an applier systematically not seeing them is itself a finding. Rule 2 of § *When to run another round* reads the verified values, not the declared ones.

## The cycle

### Block validation

Every block this cycle consumes is validated under the Validation clause of §4 of
`contracts/orchestration.md`: a missing or malformed block relaunches the step exactly once
with the identical prompt, and a malformed intermediate block counts as missing. On second
failure the outcome is the one each phase already declares below: a finder enters
`missing_disciplines` in the round ledger; the applier closes the round with
`verdict: "stop"` and a blocking `to_confirm` item; coverage enters `missing_disciplines` as
`test-coverage` with `coverage` staying `null`; the gate reports `gate: "red"` with the
silence as detail. The expected form of each block is cited from the file declaring it —
never recopied here — and mirrored in `schemas/blocks.json`, where the prose of the node
stays normative on divergence.

### Which disciplines run, at which round

It is the rule holding together fan-out and iteration, and it is worth understanding before running it.

| Round | Active disciplines | Round scope |
|---|---|---|
| **1** | `bug` always; `arch` and `perf` if scope activated them | whole diff: `git diff <BASE> -- {code_root}` |
| **≥2** | `bug` only | only the files touched by the applier in the previous round |

Two reasons, both structural.

`arch` and `perf` judge a **form on the whole diff**: where a layer stands, which path is hot, which abstraction was already available elsewhere. Rerunning them at round 4 on the two files touched by the fixes is not a more accurate review, it is an ill-asked question. They are done once, on the complete diff, when the form is still all visible.

`bug` judges **lines**, and lines change every round. It is the only discipline making sense to carry back onto the delta, and it is also the only one whose missed finding costs a regression.

Effect on cost: round 1 costs as much as a complete pass, later rounds as much as a single finder on a handful of files. The iterative part stays lean by construction, with no need to switch anything off.

### Finder — **worker** role, in parallel

One subagent per active discipline of the round. Each receives as contract to read `skills/finder-prompt/SKILL.md`, which declares what it reads, on which scope, with which reading perimeter and in which form it returns findings: **do not recopy it in the prompt** — a recopied contract erodes round by round, and the lines lost first are those holding the cycle together.

In each finder prompt put **only what changes**, already resolved:

- the contract path (`skills/finder-prompt/SKILL.md`);
- the assigned **discipline**;
- `BASE`, and from rounds ≥2 the list of files touched by the applier in the previous round;
- the **effort** level of the cycle;
- from round 2: **applied** and **discarded** of previous rounds, read from the ledger;
- the **read-only** constraint, with these words: it modifies no files and runs no commands that write. Its contract already declares it, but §4 of `contracts/orchestration.md` asks to repeat it here just the same: the `finder` role has whole `Bash`, the specifiers of its toolset do not restrict the content of a command, and a finder "correcting while there" does not appear among the applied and no later round reviews it.

Finders do not see each other: it is deliberate, and it is the separation producing different findings instead of a single already self-convinced pass. Launch them in the **same** tool-call block to truly run them in parallel — in sequence only on backends `contracts/orchestration.md` §5 sequentialises.

**Sharding of large diffs.** At round 1, above an indicative threshold — more than two thousand added lines or more than thirty files — the `bug` finder splits into several subagents for coherent file groups (by layer or by flow), same prompt, each with its own subset, launched together; findings merge before the applier. `arch` and `perf` do not split: they judge the whole form. It is the reason the closing review of an autonomous cycle, arriving with the diff of a whole run, can still respect "read every added line in full".

Each discipline has its own contract, which `skills/finder-prompt/SKILL.md` indicates and which declares **at home** its own finder mode — scope, read-only, confidence scale, and which parts of the file are not run here. No native skill of the host is needed for the cycle to exist.

When this review runs on a work item — the input was `4. review-notes.md` or the folder containing it, so `item` is known — the `arch` finder also opens `<folder>/2. blueprint.md` and reads its Target paths line if present: a scope file under `{code_root}` standing outside the declared targets is an `arch` finding at medium confidence, with `change` carrying either the move into a declared area or the brief update justifying the excursion. No blueprint, no Target paths line, or a review launched by hand on a naked base-ref: skip this check silently. It never creates a new finding class, and it enters `to_confirm` only as a true fork.

**A finder not returning is a missed discipline, not an empty discipline.** They are two outcomes resembling each other — fewer findings — and they can no longer be distinguished downstream, because `arch` and `perf` are done **only once** on the complete diff and never rerun: if it did not run here, nobody ran on that diff. The rule is deterministic, and you do not decide it round by round:

1. A finder not returning the block — prose instead of JSON, incomplete block, subagent not returning — **is relaunched only once**, with the identical prompt.
2. If it does not come back even then, its discipline enters `missing_disciplines` — **in the ledger, in the round where it happened**, and from there in the final block. It does not enter `disciplines_round_1`, which lists who **returned**, and it is not compensated by launching another discipline in its place. Writing it only in the final block makes it disappear at the first interruption, and it is the least noticed loss: on resumption the cycle exits clean and the commit runs on a diff that discipline never saw.
3. A round with a missed discipline **continues** — the findings of the other finders hold — but the cycle cannot close silently: non-empty `missing_disciplines` blocks the commit like `rounds-exhausted` (§ *Closing*), and the delivery hosting it does the same.

The place where that loss deposits is the final block. Valid for every blind fan-out: one not returning in full is a partial fan-out, and without a field saying so it comes out identical to a complete one.

### Applier — **worker** role, skipped at zero findings

If no finder produced findings the round is empty: at round 1 it means the diff was correct at first shot, at later rounds that you reached fixed point. In both cases say so in one line and do not launch it.

Otherwise **a single** subagent, with `skills/applier/SKILL.md` as contract to read: it declares how it decides each finding, how it classifies what it applies and what it returns. **Do not recopy it in the prompt.**

In the prompt put **only what changes**, already resolved:

- the contract path (`skills/applier/SKILL.md`);
- the **findings of all finders** of the round, grouped by discipline;
- the **applied of previous rounds** from the ledger (`file`, `symbol`, `anchor`, `what`): they serve for `on_previous_fix` and for oscillation;
- the round scope and `BASE`;
- `{memory.index}` and the paths of the memories the scope touches, to open before deciding (§4.1 of `contracts/orchestration.md`).

It is the **only** step of the cycle writing, and it is what makes a round readable: the scope of rounds ≥2 is the files it touched, and the identity of a fix is the `anchor` it records. Write applied, discarded and open items in the ledger before the next round.

### A step not returning, when it is not a finder

The three-point rule of § *Finder* is the general form: **every** delegated step of this cycle not returning its own block — prose instead of JSON, incomplete block, subagent not returning — is relaunched **only once**, with the identical prompt. Never a third attempt: a cycle relaunching until it gets an answer is not iterating, it is waiting.

**Scope** is the first, and the driest: if it does not come back even at relaunch, **stop and say so**. Without scope there is no round to run, and rebuilding it by feel means reviewing a perimeter nobody delimited.

For the others only where the second failure ends changes, because the three steps are not interchangeable — and each uses a field already existing, so the commit stops by the rule already there:

- **applier**: the round produced no fixes and nobody decided the findings. Record it in the ledger with `verdict: "stop"` and the reason, exit the cycle, and open a `to_confirm` item with `blocking: true` listing the findings left without decision. `git status` says whether it managed to write something: if so, those files enter the gate perimeter like the others.
- **coverage**: it enters `missing_disciplines` as `test-coverage`, and it is true to the letter — on that diff coverage was evaluated by nobody, and the phase runs only once after the cycle. `coverage` stays `null` in the ledger.
- **gate**: `gate: "red"` with `gate_detail` saying the gate did not come back, not that it failed. It is not a technicality: the field is the only thing whoever reads has, and a red by silence is investigated differently from a red by test.

### When to run another round

The round count is not decided before starting — it is decided by watching what the round just produced. After each round, in order:

0. **Detected oscillation** → exit, and the exit is `oscillation`. It comes before all because it is the only one able to hide behind another: the applier suppresses the oscillating fix, the round applied drop to zero, and rule 1 would declare `fixed-point` — that is the clean exit — on a cycle bouncing the same line. Its block `oscillation` field reports it, and you verify it on the ledger like the other two signals (§ *The two signals are verified, not accepted*).
1. **Zero applied fixes** → fixed point, exit. It is the clean exit.
2. **At least three severe fixes** → another round, without discussing. A perimeter containing three real defects contained enough to still contain more, and you just wrote the code correcting them.
3. **Otherwise, merit verdict** — you emit it, in one motivated line in the ledger, and it weighs **what** was applied, never how much:
   - **continue** if even a single fix has `on_previous_fix: true`: your corrections are regressing, and a round stopping here delivers precisely that defect;
   - **continue** if the severe — one or two — stand on just rewritten code or touch a flow the round modified in several points: it is still a hot area;
   - **stop** if the round produced only refinements, or isolated severe in areas it otherwise did not touch. `diminishing-returns` exit: declare which fixes convinced you to stop.

The criterion is **not** "fewer than N findings": the findings finders *find* do not drop below threshold alone — below a certain threshold you keep finding different ones every pass. What is counted at rule 2 is another thing: the **applied** and **severe** fixes, that is defects already verified on the code and already corrected. Counting reports makes you exit at random; counting severe corrections tells you how dirty the perimeter you just rewrote was.

### Exits

Exit at the **first** occurring, and declare which:

1. **`fixed-point`** — the round applied zero fixes.
2. **`diminishing-returns`** — negative merit verdict at rule 3.
3. **`oscillation`** — the applier detected, before applying (the criterion is in its contract), that the outgoing `anchor` for a fix coincides with one already recorded in the ledger for the same `file` and `symbol` in a round earlier than the one of the last fix: its JSON `oscillation` field reports it with the two anchors, and **you verify it on the ledger** like the other two signals (§ *The two signals are verified, not accepted*) — if your verification and its block diverge, yours holds. Do not apply further: two rounds bouncing the same line are not converging. Stop and report both versions. Be careful not to confuse it with `on_previous_fix`, which is the healthy and frequent case — a fix correcting another *moving forward*; here instead one goes back.
4. **`rounds-truncated`** — you reached the explicit `--rounds N` cap passed by hand. You truncate: you know what you are delivering, it is not an anomaly.
5. **`rounds-exhausted`** — you reached, without an explicit `--rounds N`, the guardrail at **6**. It is not a budget to spend: getting there is an anomaly, because it means you are still far from fixed point on code you wrote yourself. Report it as such, with the list of the severe of the last round.

A diff correct at first shot exits at `fixed-point` after a single round: the cycle imposes no second round on whoever has nothing to correct.

**The exit says why the cycle stopped, not that the delivery is healthy.** If `to_confirm` items with `blocking: true` remain, the code has open forks on its own correctness even at `fixed-point`: report them together with the exit, in prose and in the `blocking` field of the final block, and do not call that exit "clean". The commit, when requested, does not run anyway (§ *Closing*).

## After the cycle

### Coverage — **worker** role

It **always** runs, on cycle exit, never inside a round: the worker itself decides whether there is something to write. It receives the final `<BASE>..now` diff under `{code_root}`, `{memory.index}` and the paths of the memories that diff touches (§4.1 of `contracts/orchestration.md`), and it runs `skills/test-coverage/SKILL.md` in `--auto` mode. Tests must cover the **final** code, not the intermediate one: writing them at round 1 would mean covering lines later rounds rewrite, and redoing them every round is thrown work.

**It decides whether the diff introduces new uncovered logic.** If not, it comes back without writing anything, declaring it in its own block, which has two fields for this and not one. `--with test-coverage` removes this faculty: it forces the phase even if it would otherwise have skipped it (§ *Input*).

It returns the block that contract declares in its own § *Automatic mode*, **in full and with those field names**: read it from there, do not redeclare it here.

Its `to_confirm` items enter the ledger and the final block like the others: it is the only way the `test-coverage` class can appear there.

**If it wrote tests, do a closing round on them**: a `bug` finder on only the produced test files, and the applier on its findings. It is the same principle holding the whole cycle — the just written tests are code no finder ever saw — and it costs one finder on a few files. A passing test is not a correct test: it can assert the wrong thing, or not exercise at all the branch it claims to cover.

Here the applier runs in its own § *Closing round on tests mode*, which declares at home the scope restricted to the test files and what to do with the production defect a test reveals: **declare the mode to it and do not rewrite the constraints in the prompt** — a list of derogations written here erodes at the first modification of that contract, and the first line to fall is the one turning a real defect into a blocking item instead of a discarded finding (§3 of `contracts/orchestration.md`). This round does not count in `rounds` nor in the `applied`/`severe`/`discarded` counters of the final block: it is reported in prose.

### Gate — **worker** role, always

It **always** runs, even at zero findings, and **only once** on exit: it is the real verification that the delivered diff compiles and passes the tests, not a check to repeat every round. A subagent, which does not apply functional modifications and touches no files outside the scope.

Neither does it have a contract of its own: what it knows it knows from the prompt, and in the prompt you pass it `BASE`, `{code_root}`, the way it **recomputes** itself the file list (below), the `{areas}` areas with the respective `{areas.<area>.paths}`, `{areas.<area>.lint_fix}` and `{areas.<area>.gate}`, the perimeter of what is licit for it to correct, and the block to return.

**It is the only point of the delivery chain launching the suite**: `execute` and chat sessions do not run it because you run it. On **this** diff, if it does not run here, nobody ran it. So never skip it and do not delegate it to whoever invoked you.

**The gate subagent runs in foreground and to the end.** You do not put it in background, do not watch it from another subagent, do not interpose active waits (sleep, polling) between you and it: the suite lasts minutes, and nested levels waiting on each other stall the chain. Valid for every delegation of this contract: the child return is awaited as the host does, without active waits.

**The file list is not the initial scope**: recompute it here from `git diff <BASE> --name-only -- {code_root}` plus `git ls-files --others --exclude-standard -- {code_root}`, because fixes and coverage may have added files.

Then run **every area declared in `{areas}` the perimeter touches**, and only those: you touch an area if at least one file of the recomputed list stands under one of its `{areas.<area>.paths}`. Valid also if those files are not sources — configuration, dependencies, behaviour: the area gate still runs. An area the perimeter does not touch is not run. For each, in this order:

1. **Valid only if `{areas.<area>.lint_fix}` is declared.** Lint pre-pass on only the recomputed files: run `{areas.<area>.lint_fix}` replacing `<FILES>` with only the list files standing under `{areas.<area>.paths}`. Run it **as declared**, without adding flags: what that command does not apply itself is not safe here. Resolve the residual findings staying inside the list, with the usual correction-vs-motivated-local-suppression judgement.
2. Then the area gate: run `{areas.<area>.gate}` and report the real outcome of the commands, loading the touched modules to catch the errors manifesting only at import.

Correct yourself **only** what is lint/format in nature inside the list, and **only at unchanged semantics**: what `{areas.<area>.lint_fix}` applies itself, plus a motivated local suppression. The gate runs after the last finder, so whatever it writes here no one will ever review: if making lint pass required a behaviour-changing modification, **do not do it** — report `gate: "red"` with that detail. The cycle **does not reopen** after the gate, which runs only once: a red, here, blocks the commit.

If the red comes from failed tests or a compile/import error, **do not invent a fix**: report `gate: "red"` with the real output.

```json
{"gate": "green|red", "gate_detail": "<actual outcome of the executed commands, never an unverified claim>"}
```

### Closing — the commit closes the cycle

**The commit is the last step of the cycle, not an option.** A review arriving here with green gate and no blocking item has already decided: the work is deliverable, and leaving it uncommitted does not make it safer — it only makes it a dirty tree somebody else will have to interpret. Whoever commits itself suppresses it with `--no-commit` (§ *Input*); in every other case it runs.

**Whether the commit may run is asked, not judged here.** Call `architect/architect.mjs` — the evaluator that `skills/develop-feature/SKILL.md` § *The evaluator* declares — with `question: "closing"`, the `review_outcome` block in full and the ledger: `commit`, or `stop` with `blockers` naming **which** of the six conditions stopped it. The six conditions are listed below for whoever reads this contract; the evaluator owns their classification, and the **consequences** written under them stay here, because they are ours and not a classification.

The commit runs **only** if all hold: no `to_confirm` item with `blocking: true`, no detected oscillation, exit different from `rounds-exhausted`, empty `missing_disciplines`, **green gate**, and a ledger the commit can read — it opens (`JSON.parse` succeeds with `base` and `item` present) and the tail fields the commit reads (`outcome`, `coverage`, `gate`, `gate_detail`, and `missing_disciplines` as the union of the rounds) have the expected form against `schemas/blocks.json`. An unreadable ledger counts as `rounds-exhausted` for commit purposes: stopped, declared. Malformed intermediate blocks reuse the missing-block rules of § *Block validation* above: a string that is not the expected block is a block that did not come back. Otherwise close with the report and stop.

These six conditions are what makes the automatic commit defensible, and it is why they are never loosened "because by now the commit always": they are the **only** door before the commit. A cycle respecting them delivers code that crossed every foreseen discipline; a cycle skipping one delivers a diff nobody watched in full, and does so without anybody having pressed anything.

`rounds-exhausted` blocks the commit because it is an exit by exhaustion, not by convergence: the cycle was still correcting defects when it ran out of room. `rounds-truncated` does not: there you truncate with `--rounds N`, and you know what you are delivering — the commit can proceed.

`missing_disciplines` blocks for the same argument with which the gate blocks: if a discipline did not run here, nobody ran on that diff, and it will not run again. An `independence: "lost"` instead **does not** block — the review was still done, only without blind fan-out — but it must be said in closing, because the block otherwise comes out identical to that of a round 1 with three independent finders.

When it runs, delegate it to a **judge** subagent fully reading `skills/commit/SKILL.md` and running that contract on the `{code_root}` perimeter. Committing by hand from here would skip the memory and documentation alignment, the version bump and the changelog, which live there — together with the permission that node in turn passes to its own child, and which is not yours to give. No `git push`, ever.

**If its block does not come back**, the general rule of § *A step not returning, when it is not a finder* holds: you relaunch it **only once**, with the identical prompt. If it does not come back even then, `commit` is `skipped` with the reason, `commit_sha` is `null`, and **you do not commit yourself** to close the hole: `git log` says what already entered, never what is missing, and a commit made here would skip the memory and documentation alignment and the bump living in that contract.

**The block comes back with it.** The subagent reports the block § *Procedure* 8 of `skills/commit/SKILL.md` declares: `commits[group=code].sha` ends up verbatim in `commit_sha` — the same value, read from its declared seat instead of the prose. Do not derive it from `git log -1` — after `/commit` the working tree carries two or three distinct commits and the last is not the code one. If the sequence stops between one group and the next, `commit` is `partial`, `commit_sha` carries what truly exists, and you say so in closing.

## Outcome

1. **Report in chat**, short: run rounds and why you stopped — with the verdict closing the cycle — which disciplines ran at round 1 and how many findings they produced, what was applied, what discarded and with which reason, the items to confirm, the gate outcome and the commit one. If some fix had `on_previous_fix: true`, say so: it is the part of the work a single round would not have found. And if round 1 was less than it had to be — a missed discipline, the fan-out degraded to inline — say so first: it is the only thing the reader cannot derive from the rest of the summary.

2. **Always close with the contract block**, so whoever invoked you — the user or `develop-feature` — reads it without interpreting the prose. No field is omitted: with zero items write `"to_confirm": []`. In `rounds` and in the `applied`/`severe`/`discarded` counters count **only** the cycle rounds: the closing round on tests of the Coverage phase is not one of them, and it is reported in prose. In `disciplines_round_1` list the disciplines that **returned** the block, not those you launched: a discipline launched and never returned did not run on that diff, and writing it there would declare it done — it goes in `missing_disciplines`, which is its counterpart and without which that loss is no longer seen.

   ```json
   {
     "rounds": 0,
     "outcome": "fixed-point|diminishing-returns|oscillation|rounds-truncated|rounds-exhausted",
     "disciplines_round_1": ["bug"],
     "missing_disciplines": [],
     "independence": "intact|lost",
     "oscillation": 0,
     "applied": 0, "severe": 0, "on_previous_fix": 0, "discarded": 0,
     "gate": "green|red",
     "gate_detail": "<actual outcome of the check on the touched areas, one line>",
     "commit": "done|partial|not-requested|skipped",
     "commit_sha": "<sha of the code commit, or null>",
     "blocking": 0,
     "coverage": "tests-written|no-tests-needed",
     "ledger": "<ledger path of this review>",
     "report": "<path of 5. review-report.md, or null if the review does not run on a folder>",
     "to_confirm": [ "<the entries as `skills/applier/SKILL.md` § *The block you return* and `skills/test-coverage/SKILL.md` § *Automatic mode* declare them, in full and verbatim>" ]
   }
   ```

`oscillation` counts the items the applier recorded in that field along the whole cycle, and it is **not** redundant with `outcome`: an oscillation detected at the last round exits with that name, but one detected earlier — and suppressed — lets the cycle continue, and at that point `outcome` carries the name of how the cycle ended, not of what it met. It is one of the six conditions stopping the commit (§ *Closing*), so whoever decides downstream must be able to read it also when it is not the exit.

`independence` is `lost` **only** if the round-1 fan-out did not run on independent subagents: delegation was unavailable and you evaluated the disciplines inline, in the same context. A sequential fan-out on a backend imposing it stays `intact` — contexts are still fresh and blind to each other (§4 of `contracts/orchestration.md`, *Depth and degradation*). It is not a modesty field: it is what distinguishes, downstream, a review from a single pass.

3. **Memory and documentation are neither your task nor the user task.** The "only `{code_root}`" constraint stays: `{instructions_file}`, `.daiku/policies/`, `{memory.root}` and `{tech_doc}` belong to `update-memory`, which `/commit` **always** delegates, as a mandatory step and not as a judgement on the diff. So **never close with a reminder to the user** like "remember to realign the technical document": what comes out of here with green gate is decided, and a decided work carries its own artefacts itself. A line turning that work over to whoever reads does not make it safer — it only makes it likely not to happen, because the commit runs anyway and the line stays in a closed chat.

If in the cycle you saw a **behaviour change visible to the user** (new flow, action, default or semantics a human reader should now read differently), name it in the report as a **fact on the diff**, like the others: it serves whoever reads to understand what is being delivered, not to engage it. It is not a code finding and it **does not** enter `to_confirm`.

4. **If the commit did not run, close by saying in one line why**, and distinguish the two cases, because they read the same and they are not. With `--no-commit` the commit belongs to whoever invoked you: if the gate is green and no blocking items remain, close with **"Ready for commit."** and nothing else — inside `develop-feature` not even that, there the commit is a later phase of the delivery. If instead one of the § *Closing* conditions stopped it, name it: the red gate with its detail, the remaining blocking items, the `rounds-exhausted` exit, oscillation, or the missed disciplines.

5. **Deposit the report**, if review runs on a work folder (the input was `4. review-notes.md`): write `5. review-report.md` next to it, with the contract block above and, in prose, what you reported at point 1. It is the only artefact surviving the session: without, the outcome of the longest phase of the delivery lives only in chat, and whoever resumes does not know whether review was done nor what it discarded. On a review launched by hand on a naked base-ref there is no folder to write it in: then `report` is `null` and the chat block suffices.

## Self-deceptions (stop them before they stop you)

| If you are telling yourself… | The truth |
|---|---|
| "I applied the fixes, the gate is green, I finished" | The gate says it compiles, not that it is correct. Fixes are code no finder read: it is exactly the perimeter the next round exists to re-review. |
| "I inspect the diff myself, so I save the finders" | Finders are independent subagents blind to each other: it is the separation producing different findings instead of a single already self-convinced pass. |
| "Round 2 I redo on the whole diff, so I am sure" | It is the waste the cycle avoids. Files untouched by fixes were already judged: rereading them costs and finds nothing new. |
| "I also relaunch `arch` and `perf` at round 3, no harm" | They judge a form on the whole diff, not lines. On the two files touched by fixes it is an ill-asked question, and the cycle becomes costly for nothing. They run at round 1. |
| "The round applied few fixes, I finished" | Watch **which**, not how many. Three severe impose another round; a fix on code born from the previous round says your corrections are regressing. The naked count of findings decides nothing. |
| "The first round found much, the second surely closes" | The cycle does not assume it. On a wide perimeter the second and third rounds find as much as the first, and partly inside the corrections of the first. |
| "I am at round 5, I stop since it is already much" | The cap is a guardrail, not a budget. If round 5 applies three severe the perimeter is still dirty: the problem is not how many rounds you did, it is the code you are about to deliver. |
| "No findings at round 1: I also skip the gate" | The gate **always** runs. It is the only real verification the diff compiles and passes the tests. Skip round 2, not the gate. |
| "`arch` did not come back, but the other two did: I move on" | Move on, but **declare it**. Relaunch it once; if it does not come back, `missing_disciplines` records it and the commit does not run. `arch` runs only once on the whole diff: what it did not see now nobody will ever see, ever. |
| "The finders I ran myself in sequence in the same context, the outcome is the same" | It is not the same: mutual blindness was the value. If delegation is missing, degrade first to sequential subagents; if not even those, `independence: "lost"` in the block. An indistinguishable outcome is worse than a worse outcome. |
| "The ledger says line 88, I go look at line 88" | Between one round and the next lines move: the number in the ledger is for you reading, not for comparing. The identity of a fix is `file` + `anchor`; `symbol` only serves to orient and group. |
| "The tests were written by the coverage phase, those are right by definition" | A passing test can assert the wrong thing or not exercise the branch it claims to cover — and no finder read them. That is why after coverage there is a closing round on only the test files. |
| "Lint does not pass, I rewrite two lines and it goes" | The gate runs after the last finder: what you write there nobody ever reviews. At unchanged semantics yes; if it changes behaviour, report `gate: "red"` — the cycle does not reopen for the gate, and a red blocks the commit. |
| "The gate I put in background and meanwhile I write the report" | The gate is the last real verification, and whoever invokes it awaits its return. In background there is nobody reading the red. |
| "Fixed-point exit, clean delivery" | The exit says why the cycle stopped. If blocking items remain, the code has open forks on its own correctness: they are reported, and the delivery is not clean. |
| "This finding I discarded at round 1, but reproposed it looks sensible" | The ledger says why you discarded it. Reopen it only with new evidence, otherwise you pay the same triage twice. |
| "This finding is low confidence: I mark it to confirm" | Confidence is the finder estimate, not a permission. You verify and decide yourself: applying it, or discarding it declaring why. |
| "When in doubt I leave it open, then the user decides" | The user decides forks, not your doubts. If you know which road is right, that is already the decision: take it. |
| "This file outside `{code_root}` should be fixed while there" | Hard scope constraint. Outside `{code_root}` nothing is read as a finding and nothing is touched. |
| "The gate is red for a test, I patch it" | Only lint and format are corrected here. A red test is `gate: "red"` with the real output, and the commit does not run. |
| "The fix is proven: I wrote the test and it passes" | If the code transforms data arriving from outside — client sources, imported files, tool outputs — an input written by you proves the mechanism does what you had in mind, not that it **still fires** on the real ones. The real case has comments, strings and forms you would not have invented. Take one and pass it inside: a fix round all green on synthetic cases can leave the function inert on real code. |
| "I commit myself with `git commit`, the contract is long" | The commit contract holds together memory, documentation, changelog and version. Skipping it leaves the repo misaligned without anybody noticing. The commit is delegated to `/commit`, always. |
| "The commit by now always runs, those six conditions are bureaucracy" | They are the only door before the commit. A red gate, a blocking item, `rounds-exhausted`, an oscillation, a missed discipline or an unreadable ledger stop the commit — and if you skip one you deliver a diff nobody watched in full, without anybody having pressed anything. |

## Cut rule

**The criterion, valid for every orchestrating skill:** an orchestrating contract only keeps what serves to **decide the sequence** — when one delegates, to whom, with which scope, and when one stops. Everything a delegated step must read to do its own work stands in a file of its own, and the domain — lists, taxonomies, semantics — stands in `{memory.root}` or in `.daiku/domain/`. A text ending up in a child prompt does not belong to this file: it belongs to the contract that child reads.

Applied here: this skill owns **the review discipline and the iteration criterion** — scope, fan-out, which disciplines at which round, when to run another round, exits, coverage, gate, closing. It does not own the merit of the disciplines, which have a contract of their own (`skills/code-review/SKILL.md`, `skills/arch-check/SKILL.md`, `skills/perf/SKILL.md`, `skills/test-coverage/SKILL.md`); it does not own the prompt of its own children (`skills/finder-prompt/SKILL.md`, `skills/applier/SKILL.md`), which they read themselves; it does not own the commit discipline (`skills/commit/SKILL.md`), which it delegates. If review changes, it is touched here and in no other place.
