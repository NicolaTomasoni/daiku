---
name: 'review'
description: 'Review cycle on a diff — frozen baseline, rounds stopping when the code stops changing, ledger of already judged findings. Round 1 fans out the finders (bug always; arch/perf/dead from the project key or, without it, from the scope), later rounds re-review only the just-written fixes. Gate once on exit, then the commit, which always closes the cycle except with --no-commit. Orchestrated by you, delegating each phase to a subagent. Same discipline that /ship-feature runs in its Review phase.'
argument-hint: '[file... | base-ref | commit | path to "4. review-notes.md"] [--rounds N] [--effort low|medium|high] [--with arch-check,perf,dead-code,test-coverage] [--no-commit] [--backend <name> if the session runs there]'
---

You are the **engine of a review cycle** on a diff. One round is finders → fix application → fast check; the cycle itself decides how many rounds to run, by watching what the round just produced. Then coverage and the gate, only once. Finally the commit, which always closes the cycle except with `--no-commit`. You orchestrate, delegating each phase to a subagent per `contracts/orchestration.md`; every measurement on the disk is `architect/ledger.mjs`'s, and every verdict the evaluator's.

This file is the **source of the review cycle**: `ship-feature` runs it in its Review phase, and `skills/code-review/SKILL.md` carries the same cycle **restricted to the bug discipline**, stopping before the commit. A change to the cycle is written here and in that file.

**Why it is a cycle and not a pass.** The fixes the applier writes are new code no finder ever saw: by construction, a round applying fixes leaves behind an unreviewed perimeter, and the gate verifies it compiles, not that it is correct. It is the class of defect no single pass can find — a correction breaking another — and the only way to see it is re-reviewing the fixes.

> **Parameters.** Every key in braces in this contract resolves on the project parameter files, never from memory and never by assumption: the rules are in §5 of `contracts/project-contract.md`, which also says **in which language to write** and what to do when a key is missing.

## When to use it

- **The diff of a feature**, delivered by `execute` or hand-written, when you want only review without the whole `ship-feature` chain.
- **The one-off modifications layered in chat**, a series of requests accumulated by end of day on many files and to confirm before delivering them.
- **A commit already made**, when you want it reviewed on its own rather than as the tip of a branch: `review <sha>`, before pushing or opening a pull request.

Only the width of round 1 changes, which the cycle itself decides by reading the diff. There is no mode to declare.

## Input

Arguments: `$ARGUMENTS`. **The default is the normal case, and it requires no arguments**: with nothing you review what you have in hand, those are the uncommitted modifications under `{code_root}` against `HEAD`, including the untracked ones. Arguments serve to say something different from that.

- **Empty** — the default: the diff against `HEAD` under `{code_root}`, untracked files included, that is the current work inside the perimeter where the application lives. Nothing else enters the scope, even if changed.
- **One or more paths** (files or folders, separated by space): the baseline stays `HEAD` and the scope is the diff **limited to those paths**, still intersected with `{code_root}`. It is the form for reviewing part of what you have in hand instead of all: a path with no modifications adds nothing to the scope, and if none of the paths has any, stop and say so instead of reviewing all the rest.
- **Base-ref** (branch, tag, `HEAD`, for example `main`): base of the diff. It is recognised because it **names a ref** — `git rev-parse --symbolic-full-name` prints one — and on the filesystem no path with that name exists; when in doubt — a branch named like a folder — the **path** holds, and it is the case you declare in the outcome instead of silently choosing it.
- **A commit** — a revision naming no ref, the SHA of the commit you just made: it is the **commit under review**, and the diff is that commit against its first parent. It has to be the commit the working tree holds — the diff of this cycle runs to the working tree, so one standing below the tip is not in it — and the tool refuses any other, naming the road: check it out, or pass it as a base-ref to review everything from it on. A repository's first commit has no parent, and there the base is the empty tree: the diff is the whole first commit. Never a ref: a branch, a tag and `HEAD` stay the base-ref above, and the tool refuses the two exchanged.
- **Path to `4. review-notes.md`** (or to the folder containing it): verify it exists; the base-ref is declared by that file.
- **`--rounds N`** (optional): explicit cap, to truncate the cycle by hand. Without, the round count is decided by the trend (§ *When to run another round*) and the only cap is the guardrail at `6`.
- **`--effort low|medium|high`** (optional): finder depth. Default `medium`. On a truly one-off perimeter — a handful of files — `high` mostly produces uncertain findings to discard by hand; on a wide perimeter, dozens of files and several layers, it pays off: it is the depth at which rounds keep finding real defects instead of noise.
- **`--with arch-check,perf,dead-code,test-coverage`** (optional): the **values** decide what to force. `arch-check` and `perf` force the active discipline at round 1, regardless of what scope would decide; `dead-code` forces the `dead` finder the same way; `test-coverage` forces the Coverage phase after the cycle (§ *Coverage*), removing both the skip the program measures and the one the worker decides. Explicit manual override, never a deactivation.
- **`--no-commit`** (optional): suppresses the closing commit, and the cycle stops at the report. It is passed by **whoever commits itself** — `ship-feature`, which has its own commit phase — not by whoever has a doubt on the diff: a cycle arriving at the end with green gate and no blocking item has already decided, and the conditions of § *Closing* are there precisely to stop everything else.
- **`--backend <name>`** (optional): the name of the backend the session runs on, to declare only if not the native one of the host; it affects only fan-out concurrency, and it is `contracts/orchestration.md` §5 saying whether that backend sequentialises it.
- If the first argument is neither a valid path nor a revision — a ref naming a base, or a raw one naming the commit under review — ask; do not guess.

**Hard scope constraint:** review always and only covers files under `{code_root}`. No external file enters finders or fixes, even if modified, untracked or cited in the review notes. Everything not standing under `{code_root}` — documentation, memory, skill contracts — belongs to `update-memory`, which the commit contract delegates itself. The changelog does not: `skills/commit/SKILL.md` claims it in its own § *Version bump and changelog* and writes it directly, without passing through `update-memory`. This perimeter is drawn by this contract, and no hook enforces it; layer placement inside `{code_root}` stays with `arch`.

## Before starting

Read §2, §4, §5 and §6 of `contracts/orchestration.md` — how a role resolves its model, how a step is delegated and its block validated, concurrency, what no skill may do — and not the rest: who calls whom is named in this file. Each phase declares its own role and you resolve the model with the rule of its §2 — never from here.

Every child prompt carries the parameters its contract cites **already resolved**, and the state on disk **by path** (§4 point 1 of `contracts/orchestration.md`): `{code_root}`, `{hosts.<host>.instructions_file}`, `{memory.index}`, `{language.chat}` as `key = value` lines, and the ledger's path instead of its content.

### When review runs on a worktree

When whoever invokes you passes a work root (the worktree) besides the main tree: every Git command, the diff, fixes, fast checks, coverage and gate run in the work root — it is the `work_root` of every call to the ledger tool; the ledger (`{paths.review_state}/`) and `5. review-report.md` are written in the main tree. The base-ref is the SHA `4. review-notes.md` declares: freeze it in the work root and do not recompute it. The commit stays ruled by `--no-commit` as always.

## The ledger tool

`architect/ledger.mjs` is the disk side of this cycle. It reads Git, writes the ledger and asks the evaluator — the program `skills/ship-feature/SKILL.md` § *The evaluator* declares — by importing its questions. **You never write the ledger by hand and never hand it to the evaluator on stdin**: it is read and written only here, validated against `schemas/blocks.json` § *ledger* at every write. One command, run from the technical root of the main tree, with the package root written as that section says; one JSON object in, one out; it fails loudly, like the evaluator:

```bash
node <package root>/architect/ledger.mjs <package root>
```

Every tree it writes goes through a throwaway index: the working tree and the real index are never touched, and an untracked file is in the tree like any other. `work_root` is where Git runs, `code_root` is `{code_root}`, `project` is `.daiku/project.json`.

| `action` | When | Keys beside `action` | Back, beside `ok`, `ledger`, `verdict`, `detail` |
|---|---|---|---|
| `scope` | § *Scope* | `work_root`, `code_root`, `base_ref` (the base the diff runs from) **or** `commit` (the commit under review, a revision naming no ref), `paths` (the path list, or `[]`), `policies` (`.daiku/policies`), `item`, and `state_dir` (`{paths.review_state}`) for a new ledger **or** `ledger` for the handed one | `scoped` or `empty`; `base`, `tree`, `files`, `arch_active`, `arch_policies` |
| `findings` | when the finders of a round return | `ledger`, `blocks` (`{"bug": <block>, "arch": …}`, a shard as `bug2`), `closing: true` for the round on tests | `ready` or `relaunch`; `findings_file`, `count`, `finding_ids`, `relaunch`, `missing` |
| `areas` | before the fast check, the coverage and the gate | `ledger`, `work_root`, `code_root`, `project`, `from`: `"last"` or `"base"` | `touched` or `untouched`; `from`, `to`, `files`, `areas` (each `area`, `files`, `commands`), `test_targeted` |
| `round` | after the applier and its fast check | `ledger`, `work_root`, `code_root`, `project`, `applier` (its block parsed, or `null`; absent at zero findings), `check_fast`, `rounds_cap`, `merit` and `merit_why` when the applier ran, `cost` when the host reported it, `closing: true` for the round on tests | `retry`, `continue` or the exit — `recorded` for the round on tests; `n`, `from`, `to`, `touched`, `deviations`, `missing_disciplines` |
| `tail` | when coverage and the gate return | `ledger` and any of `coverage`, `gate`, `gate_detail`, `missing`, `to_confirm`; with `coverage: "no-test-command"` also `work_root`, `code_root`, `project` | `written` |
| `layers` | the `arch` finder, `skills/arch-check/SKILL.md` | `ledger`, `work_root`, `code_root`, `layers` | the evaluator's block in `answer`, the count in `added` |
| `ask` | § *Baseline and ledger*, § *Closing* | `ledger` (a path, or `null`) and `question`: the evaluator's input without its ledger | the evaluator's block in `answer` |

Its bench runs with `hooks/self-check.mjs`.

## Preparation — only once

### Scope — **worker** role

Two parts, and only one is a judgement.

**The round-1 set is written in the project when it declares `{review.disciplines}`**: those are the
disciplines, and this section has nothing left to judge — `arch` runs only if the list carries it,
whatever the scope measured, and neither worker below is launched. Without the key the two parts
below decide, and that is what they describe.

**What can be measured, the tool measures**, and you run it: `action: "scope"`. It freezes the baseline — `git rev-parse` of the base-ref, and the first parent of the commit under review when the input named one (§ *Input*) → `BASE` — photographs the tree of `{code_root}` as it stands, untracked files included and ignored ones out, lists the files that differ from `BASE` there — intersected with the path list when the invocation restricted it (§ *Input*) — and activates **arch** when the `paths` frontmatter of a policy in `.daiku/policies/` covers one of them. The rule list is the only source: keep no layer list here. `empty` means no file remains: there is nothing to review, say so and close — no ledger was opened.

**Whether `perf` runs is a judgement**, and a **worker** subagent makes it: in its prompt `BASE`, the `tree` and the `files` the tool returned, the question — does the diff touch a hot path: rendering, polling, loop, query, serialisation, high-frequency flow? — and the **read-only** constraint, which no harness layer imposes on whoever has `Bash` (§4 of `contracts/orchestration.md`). It returns `{"perf_active": false, "why": "<one line>"}`. `--with perf` skips it; `--with arch-check` forces `arch` whatever the tool said.

**Whether `dead` runs is a judgement too**, by the same worker shape: in its prompt `BASE`, the `tree` and the `files`, the question — does the diff add modules or exports, or remove callers a callee could survive: the places dead code hides — and the **read-only** constraint. It returns `{"dead_active": false, "why": "<one line>"}`. `--with dead-code` forces `dead` whatever it said.

### Baseline and ledger

The `scope` action did both halves. **The baseline is frozen**: every round uses that `BASE`, not a recomputed `HEAD` — the fixes you apply enter the diff, and a base recomputed each round would move the scope under the feet of the cycle. **The ledger is open**: `{paths.review_state}/review-ledger-<first seven digits of BASE>-<HHMMSS>.json`, under the technical root and outside the versioned repository — if no `.gitignore` of the repository covers it, say so in closing instead of writing inside it anyway: `git check-ignore -v` names the file that covers it, and a machine's global excludes file is not the project's (§4 of `contracts/project-contract.md`) — but **stable**, not at session expiry. It is the file making later rounds cheap. The name carries baseline and time because several reviews can run in the same session and a resumed delivery restarts from the same commit.

**The ledger declares whose it is.** Next to `base` stands `item`: the **work folder**, normalised with `/` slashes, when the input was `4. review-notes.md` or the folder containing it; `null` on a review launched by hand on a naked base-ref or on a commit. The baseline **alone does not identify a review**: two different reviews can share the same `base` — and a commit under review shares its `base`, its first parent, with the base-ref spelling of the same range.

**A `null` item does not stop the commit.** `item` serves the **resumption**, which recognises the same interrupted review by `base` and `item` together; the commit does not read it — it aligns the diff under `{code_root}`, and belonging to a folder changes nothing it does. So the closing of a review on a naked base-ref runs like any other: green gate, no blocking item, and the commit follows.

**Never reopen a ledger you found alone.** Only the one whose path was handed to you in the prompt by whoever invokes you is reopened, and only if **both** `base` and `item` coincide with this run: it is the resumption of the **same** interrupted review. **Which road to take is asked, not felt**: `action: "ask"` with that `ledger` path (or `null`) and, as its `question`, `question: "resumption"` with the `entry` point and the artefacts `present` — `resume` from a phase or a round, `restart` when the ledger does not identify this review, `stop` when the input and the artefacts contradict each other. On `resume` at `scope` the `scope` action takes the handed ledger in place of `state_dir`, and refuses it if `base` or `item` differ; from a later phase restart at the first step the ledger does not declare done. **If the candidates remain more than one, or the handed ledger carries no `item`, do not choose**: new ledger, declared in closing. Opening one costs a triage; taking the wrong one carries to the finders the `discarded` of another diff and makes `on_previous_fix` and `oscillation` run against another feature's anchors — it silently breaks the two signals the cycle decides on.

So it serves something, the ledger must be **reachable**: its path enters the return block (§ *Outcome*), and without it a review interrupted at the fourth round restarts from zero, with the anchors of the applied — what both signals are measured on — gone.

Its form is `schemas/blocks.json` § *ledger*, and the tool writes nothing that form refuses: `base`, `item`, `scope_tree`, `scope_files`, the `rounds` — each with its two trees around the applier, disciplines, applied, discarded, open items, oscillations, fast check, verdict and why, plus the `cost` the host reported and the `deviations` the tool measured — and the four tail fields.

### The ledger also keeps what blocks, not only what restarts

The `rounds` restart the cycle; the four tail fields — `outcome`, `coverage`, `gate`, `gate_detail` — and `missing_disciplines` inside each round are what the **commit** stops on. Without them a resumption loses them all, and silently: in the ledger a discipline never returned and a discipline never activated produce the same identical line.

- **`missing_disciplines` is written in the round where the discipline did not come back**: the `round` action takes it from the findings file. On resumption, `missing_disciplines` of the final block is the **union** of those of all recorded rounds: an `arch` missed at round 1 blocks the commit even if the session fell at round 3 and resumption closed at `fixed-point`. `arch` and `perf` are done only once at round 1: what they did not see then nobody will ever see.
- **`outcome` is written by the `round` action on exit, `coverage`, `gate` and `gate_detail` by `tail` as soon as their step returns**, not at the end together with the report. They stay `null` until that step ran — the tool refuses them before the cycle exits — and it is that distinction making resumption possible.
- A ledger is **open** while `outcome` is `null` and no `.abandoned` stands beside it: the cycle left it before the exit. **A dead ledger is set aside, never deleted**: an empty file named `<ledger>.abandoned` in the state folder takes it off the open roll and leaves the file readable as evidence, the anchors included, which deleting it would throw away. The Stop hook reads this definition, the ledger's form (§ *ledger* of `schemas/blocks.json`) and the last write of the ledger and of the round files beside it; it speaks only of a ledger **this session has touched** — `item`, or `scope_files` where `item` is `null` — and only once nothing has written to it for two hours, and it stays silent where the host hands it no trace of the session. A file of the state folder carrying another shape, a findings file or another tool's ledger, it skips in silence; a ledger it lists is one this section would resume, never a file it guessed.
- **On resumption do not redo what the ledger already declares done.** If the last round carries `verdict: "stop"`, the cycle already exited: skip to the first step still `null`, in the order coverage → gate → closing. Rerunning an already green gate costs the whole suite, that is precisely the resource the gate, running only once, exists not to spend twice.

### How a fix is identified, between one round and the next

**Never by line number.** A fix moves everything standing below it: at round 3 "the line 88 I corrected" is no longer line 88, and the two signals this cycle decides on would trigger at random or never trigger. A fix is its `file` plus its **`anchor`** — the text of the corrected line after the fix, as `skills/applier/SKILL.md` § *The block you return* defines it — and two fixes with the same `anchor` in the same file are the same fix. **`symbol`**, the container the fix stands in, serves to **orient** and to **group** — it is the criterion with which the `oscillation` exit locates two fixes bouncing the same area — but alone it does not identify a fix. `line` stays for the human reader, never compared across rounds.

### The two signals are verified, not accepted

`severe` is a merit judgement and stays with the applier: nobody else has in hand the context to give it. `on_previous_fix` and `oscillation` are **measurements**, made after every round before the verdict. It is the same asymmetry holding the cycle: whoever wrote the fixes is not the source of the signal deciding whether somebody will reread them.

- **`on_previous_fix`** is measured by the `round` action on the two trees around the applier: a fix rewrites a previous one when the anchor of a fix recorded in an earlier round for the same file stands among the lines this round removed — in a tracked file or an untracked one, the anchor compared with whitespace collapsed on both sides.
- **`oscillation`** is measured by the evaluator on the ledger: does a fix of the round — applied, or suppressed by the applier and listed in its `oscillation` field — carry an `anchor` already recorded for the same `file` and `symbol` in a round **earlier than the one of the last fix** on that site?

If a measurement and the applier block diverge, **the measurement holds**: the tool writes the measured value and records the deviation in the round's `deviations`, because an applier systematically not seeing them is itself a finding. They go in the report.

## The cycle

### Block validation

Every block this cycle consumes is validated under the Validation clause of §4 of `contracts/orchestration.md`: a block that does not come back relaunches the step exactly once with the identical prompt, and a block that comes back and the validation refuses relaunches it once with what the validation said — the two failures are not the same relaunch. Finder and applier blocks are validated **by the tool**, which also counts the attempts and refuses a third: `findings` answers `relaunch` for a finder to launch again, `round` answers `retry` for the applier. On second failure the outcome is the one each phase declares below. The expected form of each block is cited from the file declaring it — never recopied here — and mirrored in `schemas/blocks.json`, where the prose of the node stays normative on divergence.

### Which disciplines run, at which round

It is the rule holding together fan-out and iteration.

**`{review.disciplines}` writes the round-1 set when the project declares it.** Declared, those are
the disciplines and nothing else runs: the `arch` the scope measured, the `perf` judgement and the
`dead` judgement are all skipped, and `--with` stays the explicit manual override of § *Input*. `bug`
is the engine of the cycle and is carried to every round whatever the list says: a list omitting it
does not remove it, and the outcome declares the reading. Absent, the set is the one the table's
first row describes.

| Round | Active disciplines | Round range: `git diff <from> <to> -- <files>` |
|---|---|---|
| **1** | `bug` always; `arch`, `perf` and `dead` if scope activated them | `BASE` → the scope's `tree`, on its `files`: the whole diff, untracked files included |
| **≥2** | `bug` only | the previous round's `pre_apply_tree` → `post_apply_tree`, on its `touched` files: only what its applier wrote |

`arch`, `perf` and `dead` judge a **form on the whole diff**: where a layer stands, which path is hot, which abstraction was already available elsewhere, which symbol nobody calls. Rerunning them on the lines a fix touched is not a more accurate review, it is an ill-asked question: they are done once, on the complete diff, when the form is still all visible. `bug` judges **lines**, and lines change every round: it is the only discipline carried back onto the delta, and the only one whose missed finding costs a regression. From round 2 the range is tree against tree, so the finder's target is what the fixes changed and nothing else; the whole files stay open to it as context. Round 1 costs as much as a complete pass, later rounds as much as a single finder on a handful of lines.

### Finder — **worker** role, in parallel

One subagent per active discipline of the round. Each receives as contract to read `skills/finder-prompt/SKILL.md`, which declares what it reads, with which reading perimeter and in which form it returns findings: **do not recopy it in the prompt** — a recopied contract erodes round by round, and the lines lost first are those holding the cycle together.

In each finder prompt put **only what changes**, already resolved:

- the contract path (`skills/finder-prompt/SKILL.md`) and the assigned **discipline**;
- the **round range** — `from`, `to` and the files, per the table above: `scope` returned them for round 1, the `round` action of the previous round for the others;
- `work_root`, the resolved parameters, and the **effort** level of the cycle;
- the **ledger path**: from round 2 the finder reads there the applied and discarded of previous rounds, and the `arch` finder hands it to the `layers` action;
- for `arch`, the `arch_policies` the scope matched;
- the **read-only** constraint, with these words: it modifies no files and runs no commands that write. Its contract already declares it, but §4 of `contracts/orchestration.md` asks to repeat it here: the `finder` role has whole `Bash`, the specifiers of its toolset do not restrict the content of a command, and a finder "correcting while there" does not appear among the applied and no later round reviews it.

Finders do not see each other: it is deliberate, and it is the separation producing different findings instead of a single already self-convinced pass. Launch them in the **same** tool-call block to truly run them in parallel — in sequence only on backends `contracts/orchestration.md` §5 sequentialises.

**Sharding of large diffs.** At round 1, above an indicative threshold — more than two thousand added lines or more than thirty files — the `bug` finder splits into several subagents for coherent file groups (by layer or by flow), same prompt, each with its own subset of the files, launched together; their blocks reach the tool as `bug1`, `bug2`, …, and their findings merge before the applier. `arch`, `perf` and `dead` do not split: they judge the whole form. It is the reason the closing review of an autonomous cycle, arriving with the diff of a whole run, can still respect "read every added line in full".

Each discipline has its own contract, which `skills/finder-prompt/SKILL.md` indicates and which declares **at home** its own finder mode. No native skill of the host is needed for the cycle to exist.

When this review runs on a work item — `item` is known — the `arch` finder also opens `<folder>/2. blueprint.md` and reads its Target paths line if present: a scope file under `{code_root}` standing outside the declared targets is an `arch` finding at medium confidence, with `change` carrying either the move into a declared area or the brief update justifying the excursion. No blueprint, no Target paths line, or a naked argument — a base-ref or a commit under review: skip this check silently. It never creates a new finding class, and it enters `to_confirm` only as a true fork.

**When the finders return, their blocks go to the tool**: `action: "findings"`, each block under its discipline. It validates every block, numbers every finding — `r<round>-<discipline>-<k>`, and `r<round>-check-<k>` for a fast check the previous round left red — and writes them in the round's findings file. **A finder not returning is a missed discipline, not an empty discipline**: two outcomes resembling each other — fewer findings — that nothing downstream can tell apart, because `arch` and `perf` never rerun. The rule is deterministic:

1. `relaunch` names a finder whose block did not come back or came back malformed: relaunch it **only once** — with the identical prompt when it did not come back, with what the tool said when it came back malformed — and hand its new block to the same action.
2. If it does not come back even then, its discipline is in `missing`, and the `round` action writes it **in the round where it happened**. It does not enter `disciplines_round_1`, which lists who **returned**, and it is not compensated by launching another discipline in its place.
3. A round with a missed discipline **continues** — the findings of the other finders hold — but non-empty `missing_disciplines` blocks the commit like `rounds-exhausted` (§ *Closing*), and the delivery hosting it does the same.

Valid for every blind fan-out: one not returning in full is a partial fan-out, and without a field saying so it comes out identical to a complete one.

### Applier — **worker** role, skipped at zero findings

If the findings file counts zero findings the round is empty: at round 1 the diff was correct at first shot, at later rounds you reached fixed point. Say so in one line, do not launch the applier, and close the round with `round` without an `applier` key.

Otherwise **a single** subagent, with `skills/applier/SKILL.md` as contract to read: it declares how it decides each finding, how it classifies what it applies and what it returns. **Do not recopy it in the prompt.** In the prompt, already resolved:

- the contract path (`skills/applier/SKILL.md`);
- the **path of the round's findings file**: every finding of every finder, numbered;
- the **ledger path**: the applied of previous rounds are there, for `on_previous_fix` and for oscillation;
- the round range, `BASE`, `work_root` and the resolved parameters;
- `{memory.index}` and the paths of the memories the scope touches, to open before deciding (§4 point 1 of `contracts/orchestration.md`).

It is the **only** step of the cycle writing.

**Then the fast check, deterministic.** `action: "areas"` with `from: "last"` lists the areas the applier touched, each with its files and the commands it declares. For each area declaring `{areas.<area>.check_fast}`, run it yourself as declared, from its `cwd`, `<FILES>` replaced by that area's files, and read its exit: `green` or `red`, with the output as `detail`. It writes nothing and runs no tests. An area without `{areas.<area>.check_fast}` has no step here, and the tool records it `skipped`. A fix that does not compile otherwise surfaces only at the gate, which does not reopen the cycle: a red here imposes another round, and its output reaches the next applier as a finding of discipline `check`.

**Then close the round**: `action: "round"` with the applier block as it came back, the `check_fast` outcomes, `rounds_cap` and your merit verdict — `merit` and a one-line `merit_why`, weighed per rule 3 below; the evaluator reads it only if no mechanical rule decides, and asking it up front spares handing the applier block over twice. Pass `cost` when the host reported the numbers of the round's subagents — `{"step", "tokens", "tool_uses", "seconds"}`, only what the host printed, never an estimate. The tool photographs the tree after the applier, measures `on_previous_fix`, writes the round and returns its verdict together with the next round's range.

### A step not returning, when it is not a finder

The three-point rule of § *Finder* is the general form: **every** delegated step of this cycle not returning its own block is relaunched **only once** — with the identical prompt when the block did not come back, with what the validation said when it came back refused — and never a third attempt: a cycle relaunching until it gets an answer is not iterating, it is waiting.

**Scope** is the first, and the driest: if the `perf` worker does not come back even at relaunch, or the `scope` action fails, **stop and say so**. Without scope there is no round to run, and rebuilding it by feel means reviewing a perimeter nobody delimited.

For the others only where the second failure ends changes, and each uses a field already existing, so the commit stops by the rule already there:

- **applier**: `round` answers `retry` at the first failure; at the second the tool records the round with `verdict: "stop"`, no applied fix, and a `to_confirm` item with `blocking: true` listing the findings left without decision. Whatever it managed to write is in the gate perimeter like the rest.
- **coverage**: `tail` with `missing: ["test-coverage"]` — on that diff coverage was evaluated by nobody, and the phase runs only once. `coverage` stays `null` in the ledger.
- **gate**: `gate: "red"` with `gate_detail` saying the gate did not come back, not that it failed: a red by silence is investigated differently from a red by test.

### When to run another round

The round count is not decided before starting — it is decided by watching what the round just produced, and **it is asked, not judged here**: the `round` action asks the evaluator `question: "round"` on the `ledger` it just wrote, with your `rounds_cap`. The verdict is `continue` or one of the exits below; the evaluator owns the order and the arithmetic of these rules, and the merit verdict alone is yours:

0. **Detected oscillation** → exit `oscillation`. It comes first because it is the only one able to hide behind another: the applier suppresses the oscillating fix, the applied drop to zero, and rule 1 would call a bouncing cycle a fixed point.
1. **Zero applied fixes** → exit `fixed-point`, the clean exit.
2. **At least three severe fixes, or a red fast check** → another round, without discussing. A perimeter containing three real defects contained enough to still contain more, and you just rewrote it; a fix that does not pass the fast check is not delivered.
3. **Otherwise, merit verdict** — yours, in `merit_why`, and it weighs **what** was applied, never how much:
   - **continue** if even a single fix has `on_previous_fix: true` — the evaluator applies this one itself, on the measured value: your corrections are regressing;
   - **continue** if the severe — one or two — stand on just rewritten code or touch a flow the round modified in several points: it is still a hot area;
   - **stop** if the round produced only refinements, or isolated severe in areas it otherwise did not touch: exit `diminishing-returns`, and `merit_why` names the fixes that convinced you.

The criterion is **not** "fewer than N findings": below a certain threshold finders keep finding different ones every pass. What rule 2 counts is another thing: **applied** and **severe** fixes, defects already verified on the code and corrected. Counting reports makes you exit at random; counting severe corrections tells you how dirty the perimeter you just rewrote was.

### Exits

The first occurring holds, and you declare which:

| Exit | When | In closing |
|---|---|---|
| `fixed-point` | the round applied zero fixes | — |
| `diminishing-returns` | merit verdict `stop` at rule 3 | the fixes that convinced you |
| `oscillation` | a fix brings back an anchor a later fix on the same site had replaced — not `on_previous_fix`, the healthy case of a fix correcting another *moving forward* | both versions; nothing more is applied |
| `rounds-truncated` | the explicit `--rounds N` cap | — you truncated by hand, it is not an anomaly |
| `rounds-exhausted` | the guardrail of **6**, without `--rounds N` | the severe of the last round: an anomaly, not a budget |

A diff correct at first shot exits at `fixed-point` after a single round. **The exit says why the cycle stopped, not that the delivery is healthy**: if `to_confirm` items with `blocking: true` remain, report them together with the exit, in prose and in the `blocking` field of the final block, and do not call that exit "clean". The commit does not run anyway (§ *Closing*).

## After the cycle

### Coverage — **worker** role

It runs on cycle exit, never inside a round: tests must cover the **final** code, not the intermediate one.

**Whether it can run at all is measured first.** `action: "areas"` with `from: "base"`: if no touched area declares `{areas.<area>.test_targeted}`, no area of this diff can run a targeted test, and the phase has no step (§6 of `contracts/project-contract.md`) — record it with `tail` and `coverage: "no-test-command"`, which the tool refuses when a touched area does declare the command. `--with test-coverage` runs the phase anyway.

Otherwise a subagent running `skills/test-coverage/SKILL.md` in `--auto` mode, with the final `<BASE>..now` diff under `{code_root}`, `{memory.index}` and the paths of the memories that diff touches (§4 point 1 of `contracts/orchestration.md`), and the resolved parameters. **It decides whether the diff introduces new uncovered logic**: if not, it comes back without writing anything, declaring it in its own block. `--with test-coverage` removes this faculty too (§ *Input*). It returns the block that contract declares in its own § *Automatic mode*, **in full and with those field names**: read it from there, do not redeclare it here. Write `coverage` with `tail` — `tests-written` or `no-tests-needed` — together with its `to_confirm` items: it is the only way the `test-coverage` class reaches the ledger and the final block.

**If it wrote tests, do a closing round on them**: the just written tests are code no finder ever saw, and a passing test can assert the wrong thing, or not exercise at all the branch it claims to cover. `action: "areas"` with `from: "last"` gives its range — the tree the last round left, against now — and the files coverage wrote; a `bug` finder on only those, `findings` with `closing: true`, then the applier in its own § *Closing round on tests mode*, which declares at home the scope restricted to the test files and what to do with a production defect a test reveals: **declare the mode to it and do not rewrite the constraints in the prompt** — the first line to fall would be the one turning a real defect into a blocking item instead of a discarded finding (§3 of `contracts/orchestration.md`). Close it with `round` and `closing: true`: the tool validates the block like any other, adds its open items to the last round, and counts it in no round, since it is reported in prose, outside the `rounds` and the `applied`/`severe`/`discarded` counters. No fast check follows it: the gate runs right after.

### Gate — **worker** role, always

It **always** runs, even at zero findings, and **only once** on exit: it is the real verification that the delivered diff compiles and passes the tests, not a check to repeat every round. **It is the only point of the delivery chain launching the suite**: `execute` and chat sessions do not run it because you run it. On **this** diff, if it does not run here, nobody ran it. So never skip it and do not delegate it to whoever invoked you.

**The file list is not the initial scope**: fixes and coverage may have added files. After coverage and its closing round, `action: "areas"` with `from: "base"` recomputes it, with the areas it touches — configuration, dependencies and behaviour files touch an area too. A subagent, which does not apply functional modifications and touches no files outside the scope, has no contract of its own: in its prompt that `files` list, the touched `areas` with the `{areas.<area>.paths}`, `{areas.<area>.lint_fix}` and `{areas.<area>.gate}` the tool returned, the perimeter of what is licit for it to correct, and the block to return.

**The gate subagent runs in foreground and to the end.** You do not put it in background, do not watch it from another subagent, do not interpose active waits (sleep, polling) between you and it: the suite lasts minutes, and nested levels waiting on each other stall the chain. Valid for every delegation of this contract: the child return is awaited as the host does, without active waits.

It runs **every touched area**, and only those. For each, in this order:

1. **Valid only if `{areas.<area>.lint_fix}` is declared.** Lint pre-pass on only that area's files: run `{areas.<area>.lint_fix}` with `<FILES>` replaced, **as declared**, without adding flags — what that command does not apply itself is not safe here. Resolve the residual findings staying inside the list, with the usual correction-vs-motivated-local-suppression judgement.
2. Then the area gate: run `{areas.<area>.gate}` and report the real outcome of the commands, loading the touched modules to catch the errors manifesting only at import.

Correct **only** what is lint/format in nature inside the list, and **only at unchanged semantics**: what `{areas.<area>.lint_fix}` applies itself, plus a motivated local suppression. The gate runs after the last finder, so whatever it writes here no one will ever review: if making lint pass required a behaviour-changing modification, **do not do it** — report `gate: "red"` with that detail. The cycle **does not reopen** after the gate: a red blocks the commit. If the red comes from failed tests or a compile/import error, **do not invent a fix**: report `gate: "red"` with the real output.

```json
{"gate": "green|red", "gate_detail": "<actual outcome of the executed commands, never an unverified claim>"}
```

Write both with `tail` as soon as it returns.

### Closing — the commit closes the cycle

**The commit is the last step of the cycle, not an option.** A review arriving here with green gate and no blocking item has already decided: the work is deliverable, and leaving it uncommitted does not make it safer — it only makes it a dirty tree somebody else will have to interpret. Whoever commits itself suppresses it with `--no-commit` (§ *Input*); in every other case it runs.

**Whether the commit may run is asked, not judged here**: `action: "ask"` with the `ledger` path and, as its `question`, `question: "closing"` with the `review_outcome` block of § *Outcome*, in full. The answer is `commit`, or `stop` with `blockers` naming which of the six conditions stopped it: a `to_confirm` item with `blocking: true`, a detected oscillation, the `rounds-exhausted` exit, non-empty `missing_disciplines`, a gate that is not green, a ledger the commit cannot read. They are the **only** door before the commit, and they are never loosened "because by now the commit always runs": a cycle skipping one delivers a diff nobody watched in full, and does so without anybody having pressed anything. `rounds-truncated` does not block — you truncated with `--rounds N` and know what you are delivering. An `independence: "lost"` does not block either — the review was still done, only without blind fan-out — but it must be said in closing, because the block otherwise comes out identical to that of a round 1 with independent finders.

When it runs, delegate it to a **judge** subagent fully reading `skills/commit/SKILL.md` and running that contract on the `{code_root}` perimeter. Committing by hand from here would skip the memory and documentation alignment, the version bump and the changelog, which live there — together with the permission that node in turn passes to its own child, and which is not yours to give. No `git push`, ever.

**If its block does not come back**, relaunch it **only once**, with the identical prompt. If it does not come back even then, `commit` is `skipped` with the reason, `commit_sha` is `null`, and **you do not commit yourself** to close the hole: `git log` says what already entered, never what is missing.

**The block comes back with it.** The subagent reports the block § *Procedure* 8 of `skills/commit/SKILL.md` declares: `commits[group=code].sha` ends up verbatim in `commit_sha`. Do not derive it from `git log -1` — after `/commit` the working tree carries two or three distinct commits and the last is not the code one. If the sequence stops between one group and the next, `commit` is `partial`, `commit_sha` carries what truly exists, and you say so in closing.

## Outcome

1. **Report in chat**, short: run rounds and why you stopped — with the verdict closing the cycle — which disciplines ran at round 1 and how many findings they produced, what was applied, what discarded and with which reason, the items to confirm, the fast checks that went red, the deviations the tool measured, the gate outcome and the commit one. If some fix had `on_previous_fix: true`, say so: it is the part of the work a single round would not have found. And if round 1 was less than it had to be — a missed discipline, the fan-out degraded to inline — say so first: it is the only thing the reader cannot derive from the rest of the summary.

2. **Always close with the contract block**, so whoever invoked you — the user or `ship-feature` — reads it without interpreting the prose. No field is omitted: with zero items write `"to_confirm": []`. In `rounds` and in the `applied`/`severe`/`discarded` counters count **only** the cycle rounds, not the closing round on tests. In `disciplines_round_1` list the disciplines that **returned** the block, not those you launched: a discipline launched and never returned goes in `missing_disciplines`, its counterpart.

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
     "coverage": "tests-written|no-tests-needed|no-test-command",
     "ledger": "<ledger path of this review>",
     "report": "<path of 5. review-report.md, or null if the review does not run on a folder>",
     "to_confirm": [ "<the entries as `skills/applier/SKILL.md` § *The block you return* and `skills/test-coverage/SKILL.md` § *Automatic mode* declare them, in full and verbatim>" ]
   }
   ```

`oscillation` counts the items the applier recorded in that field along the whole cycle, and it is **not** redundant with `outcome`: an oscillation detected earlier — and suppressed — lets the cycle continue, and `outcome` then carries the name of how the cycle ended, not of what it met. It is one of the six conditions stopping the commit, so whoever decides downstream must be able to read it also when it is not the exit.

`independence` is `lost` **only** if the round-1 fan-out did not run on independent subagents: delegation was unavailable and you evaluated the disciplines inline, in the same context. A sequential fan-out on a backend imposing it stays `intact` — contexts are still fresh and blind to each other (§4 of `contracts/orchestration.md`, *Depth and degradation*). It is what distinguishes, downstream, a review from a single pass.

3. **Memory and documentation are neither your task nor the user task.** The "only `{code_root}`" constraint stays: `{hosts.<host>.instructions_file}`, `.daiku/policies/`, `{memory.root}` and `{tech_doc}` belong to `update-memory`, which `/commit` **always** delegates. So **never close with a reminder to the user** like "remember to realign the technical document": what comes out of here with green gate is decided, and a decided work carries its own artefacts itself — a line turning it over to whoever reads only makes it likely not to happen.

   If in the cycle you saw a **behaviour change visible to the user** (new flow, action, default or semantics a human reader should now read differently), name it in the report as a **fact on the diff**: it serves whoever reads to understand what is being delivered. It is not a code finding and it **does not** enter `to_confirm`.

4. **If the commit did not run, close by saying in one line why**, and distinguish the two cases, because they read the same and they are not. With `--no-commit` the commit belongs to whoever invoked you: if the gate is green and no blocking items remain, close with **"Ready for commit."** and nothing else — inside `ship-feature` not even that, there the commit is a later phase of the delivery. If instead one of the § *Closing* conditions stopped it, name it: the red gate with its detail, the remaining blocking items, the `rounds-exhausted` exit, oscillation, or the missed disciplines.

5. **Deposit the report**, if review runs on a work folder (the input was `4. review-notes.md`): write `5. review-report.md` next to it, with the contract block above and, in prose, what you reported at point 1. It is the only artefact surviving the session: without, the outcome of the longest phase of the delivery lives only in chat. On a review launched by hand on a naked base-ref or on a commit there is no folder to write it in: then `report` is `null` and the chat block suffices.

## Self-deceptions (stop them before they stop you)

| If you are telling yourself… | The truth |
|---|---|
| "I applied the fixes, the gate is green, I finished" | The gate says it compiles, not that it is correct. Fixes are code no finder read: it is exactly the perimeter the next round exists to re-review. |
| "I inspect the diff myself, so I save the finders" | Finders are independent subagents blind to each other: it is the separation producing different findings instead of a single already self-convinced pass. |
| "The finders I ran myself in sequence in the same context, the outcome is the same" | It is not the same: mutual blindness was the value. If delegation is missing, degrade first to sequential subagents; if not even those, `independence: "lost"` in the block. An indistinguishable outcome is worse than a worse outcome. |
| "I write the round in the ledger myself, it is one JSON object" | A hand-written round carries the applier's word for `on_previous_fix`, no trees for the next range and no check against the schema. The ledger is the tool's. |
| "Round 2 I give the finder the whole diff, so I am sure" | Files and lines the fixes did not touch were already judged: rereading them costs and finds nothing new. The range is the tree pair the tool returned. |
| "No findings at round 1: I also skip the gate" | The gate **always** runs. It is the only real verification the diff compiles and passes the tests. Skip round 2, not the gate. |
| "The fix is proven: I wrote the test and it passes" | If the code transforms data arriving from outside — client sources, imported files, tool outputs — an input written by you proves the mechanism does what you had in mind, not that it **still fires** on the real ones. The real case has comments, strings and forms you would not have invented. Take one and pass it inside: a fix round all green on synthetic cases can leave the function inert on real code. |

## Cut rule

**The criterion, valid for every orchestrating skill:** an orchestrating contract only keeps what serves to **decide the sequence** — when one delegates, to whom, with which scope, and when one stops. Everything a delegated step must read to do its own work stands in a file of its own, and the domain — lists, taxonomies, semantics — stands in `{memory.root}` or in `.daiku/domain/`. A text ending up in a child prompt does not belong to this file: it belongs to the contract that child reads.

Applied here: this skill owns **the review discipline and the iteration criterion** — scope, fan-out, which disciplines at which round, when to run another round, exits, coverage, gate, closing. It does not own the merit of the disciplines, which have a contract of their own (`skills/code-review/SKILL.md`, `skills/arch-check/SKILL.md`, `skills/perf/SKILL.md`, `skills/dead-code/SKILL.md`, `skills/test-coverage/SKILL.md`); it does not own the prompt of its own children (`skills/finder-prompt/SKILL.md`, `skills/applier/SKILL.md`), which they read themselves; it does not own the commit discipline (`skills/commit/SKILL.md`), which it delegates; it does not own the arithmetic of its rules, which is the evaluator's, nor the measurements on the disk, which are `architect/ledger.mjs`'s. If the cycle changes, it is touched here and in `skills/code-review/SKILL.md`, which carries it restricted to the bug discipline.
