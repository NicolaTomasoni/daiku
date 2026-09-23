---
name: 'develop-feature'
description: 'Internal /new-feature contract — delivers a feature from the already resolved decision-doc to the commit in a single invocation: worktree, brief, execution, review rounds, decision, memory and documentation alignment, the three commits, merge and report. It orchestrates its own phases delegating each to a subagent. It is not launched by hand and does not ask anything of the owner.'
user-invocable: false
---

You are the **engine** of the delivery of a single feature: the sequence — brief → execution → review rounds → decision → memory/documentation update → commit (up to three groups: feature, then doc/memory, then version) → merge → cleanup → report — you orchestrate **it**, delegating each phase to a subagent according to `contracts/orchestration.md`. There is no script doing it in your place.

> **Parameters.** Every key in braces in this contract resolves on the project parameter files, never from memory and never by assumption: the rules are in §5 of `contracts/project-contract.md`, which also says **in which language to write** and what to do when a key is missing.

## When to use it

When you have **one** feature with `1. decision-doc.md` already resolved and you want the complete delivery (up to the conditional commit) without anybody having to chain `blueprint` → `execute` → `/review` → `/commit` in sequence. If you want to stay on the single atomic steps (to stop between one stage and the next), use those directly: this skill does not replace them, it chains them for the cases where you want the whole delivery in one shot.

## Input

**You are always a subagent: this contract is not launched by hand.** `new-feature` opens it § *Delivery*, and everything arrives resolved in the prompt — there is nobody to ask, and a question asked in here stays hanging (§ *Ask the owner* of `contracts/orchestration.md`).

- **`<folder>`** — path of the folder (relative to the repo root, or absolute), wherever it lives: `{paths.studies}/<name>` is the common case but not the only one. Verify it on the filesystem: it must exist and contain `1. decision-doc.md`. If missing, stop and return the block with the reason.
- **`<chosen solution>`** — mandatory, with id and text per decision: you pass it to the brief. If it is ambiguous against the decision-doc — it names a decision or an option that do not exist there — **do not guess and do not ask**: stop, and in the block report the options the document truly declares, so that whoever called you can bring them to the owner. If instead the solution was not passed to you at all, use for each decision the **`A`** option — which by contract is the recommended — and declare it in the outcome: it is a defensible choice written by whoever studied the problem, not your invention.

## Worktree pool

Every delivery works on a pool worktree, never on the main tree. The pool lives in `{worktree.pool}`, names reuse `{worktree.prefix}<N>` with `N` from `1` to `{worktree.max}`, the branch of each is `{worktree.branch_prefix}<name>`. Never a worktree beyond `{worktree.max}`, never a name outside convention: full means full.

Two roots, two roles, passed to every phase already resolved:

- **work root** — inside the worktree, the same relative position the technical root occupies in the main tree: code, diff, stage, commit, gate and fix run here, and from here `{code_root}` and the command cwds of `{areas}` resolve. Do not guess it: derive it from the comparison between `{repo_root}` and the root you are running from.
- **artefacts root** — the main tree: `2. blueprint.md`, `3. memory-report.md`, `4. review-notes.md` and `5. review-report.md`, plus the ledger in `{paths.review_state}/`, live here, so resumption and report do not depend on the worktree.

**A worktree is not an inert copy of the project.** If the project declares constraints on its own local environment — dependencies installed in a shared tree, links or junctions between the two copies, tools rewriting files outside the checkout — those constraints hold here and `{instructions_file}` declares them: read it before running any environment command inside the worktree. They are not rewritten here, and not guessed: an install command launched in the wrong place is the typical way a delivery breaks the main tree while believing it works on its own.

## Before starting

Read `contracts/orchestration.md`: roles, host, how a subagent launches, concurrency. Each phase below declares its own role (**judge** or **worker**) and you resolve the model with the rule of its §2 — never from here.

**And before the first phase, prove the evaluator runs.** It is the move `sync-host` already makes on the hook benches — try before hooking, not after the first fault. The proof is the first question this delivery needs anyway (`order`, in § *The evaluator*): if it comes back, the evaluator runs and the sequence is known; **if it does not, the delivery does not start**. The verdict binds, so a delivery started on an evaluator that does not answer breaks where it is least visible. The diagnosis tells two causes apart and they are not the same thing: **the environment** — `node` not on the `PATH`, the fix on the user's side — and **the package** — a malformed input, or a case the bench does not cover, which is a defect of Daiku and is declared as such.

## The evaluator

Four of the classifications below are **not read off this prose any more**: they are asked, and the
verdict binds. It is one program, and asking it is one command:

```bash
node <package root>/architect/architect.mjs <package root>
```

It reads **one JSON object on stdin** and writes **one JSON object on stdout**; it starts no
process, talks to no model and opens no file. What it answers:

| Question | Where it is used here |
|---|---|
| `order` | § *The sequence* — given the entry point and the artefacts already on disk, which phases remain |
| `decision` | § *4. Decision* — the classification of the six rows |
| `unblock` | § *Mechanical unblock* — whether only mechanical work remains |
| `propagation` | *Block validation*, below — what follows a block that did not come back |

**What it reads is one JSON object whose keys are fixed**, and a caller that guesses one of them
stops the delivery. `question` is always there; then only what that question needs: `entry` (the
entry point) and `present` (the artefacts already on disk) for `order` and `resumption`, the
`review_outcome` block in full for `decision`, `closing` and `unblock`, its `commit` alone for
`resumption` (it says whether the cycle had already closed), the `ledger` (or `null`) for `order`,
`closing` and `resumption` — for `order` a ledger that exists and is not passed turns into a fork
for the owner where a verdict was due — and `step` (`{"node": …, "block": …|null, "attempt": 1|2}`)
for `propagation`. These are the six questions it answers; the two this file does not use — `closing`
and `resumption` — are the ones `skills/review/SKILL.md` § *Baseline and ledger* and § *Closing*
ask, with the same keys. A key a question needs and does not find is a loud failure, never a
guessed value.

**The root is a path relative to the package** — the folder containing `skills/`, `contracts/` and
`architect/`, **two levels above this file** — in the same form `init` and `sync-host` already use:
it holds on both hosts, while an environment path variable exists only on one of the two. The two
hosts hand it over differently and both notations are written here because of it, because it is the
most exposed assumption of this design. On **Claude Code** the host substitutes its path variables
(`${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_SKILL_DIR}`) inside the text of a `SKILL.md`, so the command can
name the root directly. On **Codex** the host hands the skill the **absolute path of its own
`SKILL.md`** and nothing else: there the climb of the two levels is done **by you**, and it is an
instruction, not a fact of the harness. Getting it wrong is contained: the command does not start
and it is visible, instead of starting and looking in the wrong place.

**The block it returns** is the one `schemas/blocks.json` § *architect* declares, and that is its
only copy: this file cites it and does not restate it. It always carries all nine fields —
`ok`, `verdict`, `remaining`, `resume_from`, `blockers`, `retry`, `fallback`, `readings`, `detail` —
with `null` or empty where the question does not use them.

**The fields it deliberately ignores** — which §4 point 2 of `contracts/orchestration.md` requires of
whoever reads only a part of a block — are declared in the head comment of `architect/architect.mjs`,
and that is their only copy: this file cites them and does not restate them. Not reading a field is
why a missing one among them changes no verdict.

**It fails loudly, and the two causes are told apart.** This is not a hook and does not degrade
open: a missing or malformed input is an error, never an implicit `false`. The diagnosis names
**the environment** — `node` not on the `PATH`, the fix on the user's side — and **the package** —
a malformed input, or a case its bench does not cover, which is a defect of Daiku and is declared
as such. **The verdict binds: if it does not run, the delivery does not continue.**

**The field that measures.** It is `architect_agreement`, and § *Outcome* is its only copy: this
section cites it and does not restate it.

## Progress and findings

**No progress log is kept on file.** Progress and findings go **in chat**, as you go: one line when a phase starts and when it returns, with the role running it, and immediately what you noticed and what needs no block — a subagent returned malformed, a phase slower than expected, evidence not adding up.

The state needed to **resume** is not that: they are the artefacts the phases deposit (`2. blueprint.md`, `3. memory-report.md`, `4. review-notes.md`, `5. review-report.md`) and `git log`. Those are verifiable, a hand-written log is not — and resumption trusting a line nobody guarantees was written restarts from the wrong phase. The 3 in 3. memory-report.md is the outcome of phase 5b — the files it touched and the items to confirm with the owner — which without an artefact would be the only phase leaving nothing behind. **It is not a journal**: it says what that phase left, never how it got there.

## The sequence

The phases are ordered and not skippable. Each is **one** subagent, with the prompt giving it the contract to read, the resolved input and the JSON block to return.

**Which phases remain is not read off this file, it is asked.** Before phase 0, ask the evaluator
(`question: "order"`), passing the entry point, the artefacts already on disk and the `ledger` (or
`null`): the verdict says where to start and what is left to do, and the sections below are its
**rendering** — the same sequence, shown to whoever reads a contract, no phase deleted and no name
changed. They no longer declare it. Two things this does not change: the phases are still ordered and
none is skippable, and the worktree lifecycle of phase 0 still belongs here.

Each block carries the field declaring the outcome of its own phase: `ok` for Brief, Execute and Report, `gate` for Review, `staged` for Stage, `updated` for Memory, `committed` for Commit. **If that field says failure, or if the block does not come back at all, the delivery stops there** (see *Early block*) — an absent block is not interpreted by feel and not rebuilt from the prose of the subagent.

**What says failure, field by field**, because not all those fields declare one: `ok: false` for Brief, Execute and Report; `staged: false` for Stage, which skips 5b and 6 and goes to the report as the phase itself prescribes; `committed: false` for Commit; and in every phase the **absent block**. For **Review** failure is **only** the absent block, not `gate`: a `gate: "red"` is a successful measurement, and the table of phase 4 classifies it `BLOCKED_NO_COMMIT` — stopping here would flatten it onto `blocked`, which means "the brief broke", and the difference between a delivery not compiling and one never started would be lost. `updated: false` is **never a failure**: `skills/update-memory/SKILL.md` declares it "the expected outcome, not a failure" when the diff justifies no writing, and phase 6 already foresees that case in writing ("If 5b wrote nothing, this commit **does not exist**").

The phases having their own contract declare the block **at home**, and here it is cited: every local rewrite shrinks at the first modification of the node (§4.2 of `contracts/orchestration.md`).

**Block validation.** Every phase block is validated under the Validation clause of §4 of
`contracts/orchestration.md`: a missing or malformed block relaunches the phase exactly once
with the identical prompt, and a malformed block counts as missing. **What follows a failure is asked, not judged here**: call the evaluator with `question: "propagation"` and `step` set to `{"node": <the phase>, "block": <what came back>|null, "attempt": 1|2}` — `retry` is the relaunch with the identical prompt, `fallback` the outcome the skill hosting that phase declares for the case. The **ceiling** stays written here because it is a consequence and not a classification: **exactly one** relaunch, never a third attempt. On second failure the
delivery stops at that phase (see *Early block*) with the `detail` of its block — for Review,
failure is only the absent block, never a measured `gate: "red"`. The expected form of each
block is cited from the file declaring it, never recopied here, and mirrored in
`schemas/blocks.json`, where the prose of the node stays normative on divergence.

### 0. Acquisition — **worker** role

A subagent assigning the worktree. In the prompt: the pool `{worktree.pool}`, the prefix `{worktree.prefix}`, the cap `{worktree.max}`, the branch prefix `{worktree.branch_prefix}`, and the block to return. It runs only these Git commands, in order, without asking confirmation.

The **integration branch** is the one the main tree is currently positioned on — `git rev-parse --abbrev-ref HEAD` from there, only once — and in the commands below it is written `<INT>`. It is not assumed: a delivery integrates where the owner is working, and a hardwired name would make it end up elsewhere in the project not using that name.

1. `git worktree list --porcelain` and `git rev-parse <INT>` from the main tree: the registered worktrees and the reference HEAD.
2. Free = registered, with `git -C <pool>/<name> status --porcelain` empty and `git -C <pool>/<name> rev-parse HEAD` equal to the HEAD of `<INT>`. The first free one in number order is yours.
3. If there is one: `git -C <pool>/<name> reset --hard <INT>` (clean tree: safe) and use it.
4. If there is none and the registered are fewer than `{worktree.max}`: `git worktree add <pool>/{worktree.prefix}<M> -b {worktree.branch_prefix}{worktree.prefix}<M> <INT>`, with the smallest free `M`.
5. If there is none and they are already `{worktree.max}`: create nothing and do not reuse a dirty one — return `ok: false`.

```json
{"ok": true, "worktree": "<name>", "worktree_root": "<path of <pool>/<name>/src>", "detail": "<if ok=false, why>"}
```

`ok: false` stops the delivery (see *Early block*): `blocked` report, no stage, no commit. A dirty one is not your residue to clean: it is work of another delivery nobody registered. From here on every phase already receives resolved the `<name>`, the work root and the artefacts root.

### 1. Brief — **judge** role

Subagent producing the brief. In the prompt:

- read in full `skills/blueprint/SKILL.md` and follow that contract to the letter;
- folder `<folder>` (contains `1. decision-doc.md`), chosen solution `<verbatim>`;
- load `{instructions_file}` and, for each area the brief touches, open the pertinent rule in `.daiku/policies/` reading their `paths`: decide the layer placement **before** opening code, do not rely on automatic loading of the rules, and declare it as Target paths in the brief;
- `{memory.index}` and the paths of the memories the perimeter touches, to open before deciding (§4.1 of `contracts/orchestration.md`): the already taken decisions and the constraints not deducible from the code stand there, and a brief ignoring them makes the executor rediscover them at its own expense;
- the brief reads `1. decision-doc.md` and writes `2. blueprint.md` in the **artefacts root** (the main tree): it anchors the code by reading it there — the worktree is a copy synchronised at acquisition;
- if `<folder>/2. blueprint.md` already exists, do **not** rerun the brief: return `ok: true` with the existing path;
- ask nothing of the user: folder, decision-doc and solution already exist.

The expected outcome is the block `skills/blueprint/SKILL.md` declares in its own § *What you return*, in full and with those field names.

### 2. Execute — **worker** role

Executor subagent. In the prompt:

- read in full `skills/execute/SKILL.md` and follow that contract to the letter (real autonomy, observable verification, update the file while working, mandatory closing verification — **without** launching the suite or the package gate, which belong to phase 3 — deposit `4. review-notes.md` with the real base-ref);
- apply it to folder `<folder>`; load `{instructions_file}`; area rules enter alone when you open the files they cover, but if you touch an area without having read one of its files, open it yourself; stay inside the brief's Target paths — a needed excursion updates the brief Journal first;
- code and Git commands in the **work root** of the worktree; `4. review-notes.md` in the **artefacts root**, and the base-ref you deposit there is the SHA of the work-root HEAD at execution start (`git -C <worktree_root> rev-parse HEAD`);
- `{memory.index}` and the paths of the memories pertinent to the perimeter, to open before writing (§4.1 of `contracts/orchestration.md`);
- ask nothing of the user; stop only before a real block (unjustified destructive action or irreconcilable contradiction).

The expected outcome is the block `skills/execute/SKILL.md` declares in its own § *What you return*, in full and with those field names.

### 3. Review — `/review`, always, inside the delivery

Review **is part of the delivery**: it is not an optional step, it is not postponed to the user, and it is not skipped — it is the only point of the chain running the build and test gate, so without it nobody has proven the feature compiles. Without it the decision of phase 4 does not exist, so the commit does not exist.

Fully run `skills/review/SKILL.md` — scope → finder and fix rounds, until the cycle converges → gate — on file `<folder>/4. review-notes.md` in the **artefacts root** (fixed name by `execute` contract: do not concatenate the returned path, its format is not guaranteed). It is the same discipline running from standalone `/review`: a single source, no copy — **do not rewrite it here**. In the prompt also pass it the worktree work root and the artefacts root: diff, fix, coverage and gate run in the first, ledger and `5. review-report.md` in the second (`skills/review/SKILL.md`, § *When review runs on a worktree*).

**Delegate it to a subagent** executing that contract: do not orchestrate its phases yourself. The yield of its round 1 stands in the independence of the finders, and orchestrating it from here — where you have in mind the brief, the execution and what you expect — is the already self-convinced pass the fan-out exists to avoid (§4 of `contracts/orchestration.md`, *Depth and degradation*). If you are **resuming** a delivery whose review had already started, pass it the ledger path you find in `{paths.review_state}/` with the `base` of this delivery **and** with `item` equal to `<folder>`: it restarts from the next round instead of running the whole triage again. The two fields are watched together because the baseline alone does not identify a review — a resumed delivery restarts from the same commit — and **if the candidates remain more than one, or if the ledger carries no `item`, you pass none of them**: the triage is run again, while the ledger of another feature silently switches off `on_previous_fix` and `oscillation`. `--with` is not used here: the conditional disciplines are decided by the scope from the diff.

**Instead always pass it `--no-commit`**, and it is mandatory: `/review` closes with the commit by its own setting (§ *Closing* of its file), and the commit of this delivery is **phase 6**, after the decision of phase 4 and the alignment of 5b. Without that flag review would commit the code before you evaluated its open items, phase 6 would find the tree already clean, and `update-memory` would run twice — once from `/commit` inside review, once as phase 5b — on a diff meanwhile already entered.

The expected outcome is the block `skills/review/SKILL.md` declares in its own § *Outcome*, **in full and with those field names**: read it from there, do not redeclare it here. You need them all — `outcome`, `missing_disciplines` and `independence` decide how much `gate` and `to_confirm` (phase 4), and a recopied narrower block is exactly how they stop arriving.

If review finds no file under `{code_root}` to review, stop: there is no delivery to evaluate.

### 4. Decision — you decide it **yourself**, in chat, without subagent

It is a deterministic classification on already structured data: no second judge is needed to re-judge. **And it is not redone here — it is asked.** Call the evaluator with `question: "decision"` and the `review_outcome` block in full; the verdict is `GREEN_COMMITTED`, `GREEN_WITH_POST_DECISIONS` or `BLOCKED_NO_COMMIT`, and `blockers` lists **every** condition that blocks, not the first. The table below is that rule shown to whoever reads it, and it no longer declares it: what remains here is the **consequences**, which are ours and are not a classification — on `BLOCKED_NO_COMMIT` one does not stage, does not align memory, does not commit, and the worktree stays dirty on purpose.

The review applier already marked each `to_confirm` item with `blocking`, because it had the finding in hand.

Describe each open item as `<file>[:<line>] [<class>] <scenario>`, then:

| Condition | Outcome |
|---|---|
| `gate` ≠ `green` | `BLOCKED_NO_COMMIT` — blocker: `gate red: <gate_detail>` plus all blocking items |
| `outcome` is `oscillation` or `rounds-exhausted` | `BLOCKED_NO_COMMIT` — blocker: the cycle did not converge, with the exit and the severe findings of the last round |
| `missing_disciplines` is not empty | `BLOCKED_NO_COMMIT` — blocker: the disciplines that did not run on this diff |
| gate green, at least one `blocking: true` item | `BLOCKED_NO_COMMIT` — blocker: those items |
| gate green, no blocking, non-blocking items remain | `GREEN_WITH_POST_DECISIONS` |
| gate green, no open item | `GREEN_COMMITTED` |

The blocking conditions are **all** evaluated: an outcome satisfying more than one reports them all as blockers, and the first occurring does not close the evaluation.

The three lines at the top are the same with which `/review` stops alone before committing (§ *Closing* of its file), and they hold here for the same reason: `rounds-exhausted` is an exit by exhaustion, not by convergence — the cycle was still correcting defects when it ran out of room; `oscillation` means two rounds bouncing the same line; a missed discipline did not run on this diff and **will never run again**, because `arch` and `perf` are done only once on the complete diff. Without these lines the same identical review outcome would block the commit if launched by hand and let it pass inside the delivery — while this skill declares it runs "the same discipline".

`independence: "lost"` **does not** block: it says round 1 was evaluated in a single context because delegation was unavailable, and a host without delegation stays a host on which one delivers. But it enters the report and the chat summary as a declared limit of that review, because a green delivery with degraded fan-out is not the same thing as a green delivery.

The **non**-blocking items are `post_commit_decisions`: they do not stop the commit, they stay in the report. They are **true forks** — two defensible options where the choice changes the result in a material way — because everything else review already resolved itself (`skills/applier/SKILL.md`, § *The block you return*). Do not promote to post-commit decision what is not a fork: work left halfway, optional cleanup, already resolved doubts or things outside the brief perimeter do not enter here, and `GREEN_COMMITTED` stays the normal outcome of a healthy delivery. The remaining forks you neither resolve nor rejudge: you report them.

### Mechanical unblock — when the only blocker is the red gate

**Whether the block is only the red gate is asked, not judged here.** Call the evaluator with `question: "unblock"` and the same `review_outcome` block: `unblock` or `blocked`, and on `blocked` the reasons. It unblocks only when the cycle already said everything it knew how to say — converged exit (`fixed-point`), empty `missing_disciplines`, no `blocking: true` item and empty `to_confirm` — and **on `blocked` the three consequences below hold unchanged**: they are ours, not a classification.

If the verdict is `unblock`, delegate **one** worker subagent which, in the work root, corrects only the gate findings on the diff lines with an obvious single-solution fix (mechanical lint, format, types), relaunches the gate of the touched area and returns `gate`/`gate_detail`/`needs_tradeoff`. Constraints: no behaviour change, no file outside the reported ones, never stage/commit, and if even a single fix admits two defensible options the subagent leaves it alone and declares it in `needs_tradeoff` instead of guessing.

- If `gate: green` and empty `needs_tradeoff` come back: reclassify with the table (the typical outcome is `GREEN_COMMITTED`) and continue from phase 5 on; the report tells the unblock in a paragraph.
- Otherwise (if `gate` is still `red`, or `needs_tradeoff` is non-empty): `BLOCKED_NO_COMMIT` stays with those blockers, and from here on the paragraph below holds (no stage/memory/commit, dirty and declared worktree).

A single attempt per delivery: if the gate stays red do not relaunch the fix — the second pass is oscillating work, and oscillation is declared, not repeated. This is the only road reopening a `BLOCKED_NO_COMMIT` inside the same delivery: blocking items, forks and missed disciplines are never unblocked this way.

On `BLOCKED_NO_COMMIT` one does not stage, does not update memory and does not commit — and **the worktree stays dirty on purpose**: the delivery never creates `blocked.patch` nor parks in any form; modifications remain visible on the worktree branch, the main tree is not touched. Before the report list the dirty (`git -C <worktree_root> status --porcelain -- {code_root}`) and declare its paths in the report and in the chat summary.

The worst case is confined instead of prevented: the blocked dirty stays on the branch of its worktree and never enters the integration branch. The price is the shrinking pool: every blocked worktree is one fewer until the owner cleans or hand-commits it, and with an exhausted pool phase 0 stops the delivery.

### 5. Memory — only if the outcome is **not** `BLOCKED_NO_COMMIT`

Two subagents in sequence, **both before the commit**.

**5a. Stage — worker role.** Stage is separate from commit because step 5b must read the **full** diff of the feature — new files included, which `git diff` does not show until they are in index. In the prompt: the worktree work root, and run only these Git commands with `git -C <worktree_root>`, in order, without asking confirmation — `git status --porcelain -- {code_root}` to locate the touched files (always ignore any file external to `{code_root}`, even if modified — the edit guard denies creating such files), `git add <the identified files, listed singly>` (never `-A`, never `.`), again `git status --porcelain -- {code_root}` to confirm the index. Never `git commit`, never `git push` in this step.

```json
{"staged": true, "files": ["<path>"], "detail": "<if staged=false, why>"}
```

If `staged` is `false`, there is nothing to deliver: skip 5b and 6, go to the report.

**5b. Memory/documentation update — judge role.** In the prompt:

- read in full `skills/update-memory/SKILL.md` and follow that contract to the letter;
- the diff to inspect is the one **in index** under `{code_root}` in the **work root** of the worktree: `git -C <worktree_root> diff --cached --stat -- {code_root}` and `git -C <worktree_root> diff --cached -- {code_root}`; it is the full diff of the feature, the same the commit will produce. Also the files you write (`{instructions_file}`, `.daiku/policies/`, `{memory.root}`, `{tech_doc}`) stand in the work root: merge will carry them onto the main tree together with the code;
- the **feature folder** is `<folder>` in the **artefacts root**: deposit there your return block as `3. memory-report.md`, as described in point 7 of its § *Procedure*. It is the phase closest to the context limit — it reads the full diff — and it is the only one whose outcome, without that file, does not survive interruption: on resumption memory is already aligned, `files` comes back empty and commit 2 has no more scope;
- **you are not authorised to commit your group**: run no Git writing command and do not touch the index of `{code_root}`; you limit yourself to modifying `{instructions_file}`, `.daiku/policies/`, `{memory.root}` and `{tech_doc}` — plus the artefact above, which is the trace of the phase and not a memory update — and return `committed: null`. Commits are phase 6, which makes them in the declared order — first the feature, then doc and memory — and that order is the reason permission is not granted here.

Commit permission is a property **of the invocation**, not of the node: the same contract, invoked by `/commit`, receives it. Telling it explicitly in the prompt is not a repetition — without that line its default is "no", and it is the right default, but it is the line that makes clear why it is so here.

The expected outcome is the block `skills/update-memory/SKILL.md` declares in its own § *Procedure*, point 7, in full: `updated`, `files`, `confirm_with_owner`, `detail`, `committed`. The latter must be `null`, as the ban above imposes; if it comes back with a SHA, the subagent committed against the prompt — **do not redo that commit** in phase 6, verify it with `git log`, report it as an anomaly in chat and continue with the rest.

### 6. Commit — **worker** role

A single subagent, up to three distinct commits and in the declared order, on the worktree branch (`{worktree.branch_prefix}<name>`). In the prompt: the work root, and run Git commands with `git -C <worktree_root>`, in order, without asking confirmation.

**It writes on three paths only, and they are those of commit 3.** The bump touches `{changelog}`, `{version.file}` and the files of `{version.replicated_in}`: the subagent modifies them, and outside those three pathspecs it writes nothing — it touches no code, no memory, no documentation. Everything else of this phase is Git commands.

**Commit 1 — the feature.** The files under `{code_root}` are **already** in index: do not run `git add`, you commit exactly what is there. Message conforming to § *Commit convention* of `skills/commit/SKILL.md`, which resolves it on the project. **Never** co-authorship trailers nor mentions of the agent generating the work. Then `git log --oneline -1` to read its SHA.

**Commit 2 — doc and memory.** Only if step 5b truly wrote something outside `.daiku/` and only if the first commit succeeded. **Exclusive** scope the files listed by 5b **outside `.daiku/`**: `git status --porcelain -- <each one>` to confirm they are modified, `git add <the same ones, listed singly>` (never `-A`, never `.`, never files under `{code_root}`, never paths under `.daiku/`), commit with message opening with `{commit.memory_prefix}`, for the rest according to the same convention, `git log --oneline -1` for the SHA. What 5b wrote under `.daiku/` stays in the working tree, not staged: list it in `detail` as local undelivered work. If outside `.daiku/` nothing remains — or if 5b wrote nothing — this commit **does not exist**: do not touch files outside `{code_root}`. If 5b came back with `committed` set — that is it committed its own group while not authorised — this commit **does not exist just the same**: report that SHA in `memory_commit_sha` with `memory_committed: true`, and do not attempt an empty commit on files nobody modified anymore.

**Commit 3 — version and changelog.** Third group: `{changelog}`, `{version.file}` and the files of `{version.replicated_in}`. **If one of these falls under `{code_root}`** — a `package.json`, a `pyproject.toml` — step 5a already put it in index and commit 1 carried it away as it was, without the new number: that file is modified now and re-enters **here**, in the third group, which is not empty only because one of its paths had already been committed once. Declare it in `detail`, because it is the only case where a path appears in two of the three commits. When the changelog entry is written, when the bump is done and what it entails is declared in `skills/commit/SKILL.md`, § *Version bump and changelog*: the subagent reads it **from there** and executes it, **do not rewrite it here** — it is the same form with which phase 3 refers to `skills/review/SKILL.md` instead of rewriting its discipline. A single source for the changelog, otherwise features delivered from here never arrive in the version register, while the same ones delivered by the closing commit of `/review` get there. Message and order are those that section declares; the commit goes **after** the first two and does not exist if the group is empty. Then `git log --oneline -1` for the SHA.

**Never `git push`**, in none of the three.

**Why this phase is not an invocation of `skills/commit/SKILL.md`**, since the three groups and their order are its own: because that contract **always** delegates alignment to `update-memory` as its own mandatory step, and here alignment already ran at phase 5b, on the diff in index and with commit permission denied. Invoking it would run it twice, and the second with a permission the commit order of this skill does not admit. What remains of its own — the message convention and the version and changelog discipline — is read from there, as commit 1 and commit 3 do.

**If the sequence stops between one group and the next, say so with the paths.** A failed commit 1 leaves in the tree the memory/doc group 5b just wrote, and — if the bump had touched it — also version and changelog: two groups that **are not parked**, because they are artefacts to reconcile by hand, not code to reapply with `git apply`. List them in `detail` and in the report with their paths. They stay in the **worktree**: **phase 0** sees them, which considers free only a worktree with empty `git status --porcelain`, and that worktree leaves the pool until the owner treats it. Declaring them is what lets whoever reads know whose they are, instead of facing a worktree occupied by anonymous dirt.

```json
{"committed": true, "commit_sha": "<sha>", "memory_committed": false, "memory_commit_sha": "<sha if it exists>", "version_commit_sha": "<sha if it exists>", "detail": "<...>"}
```

### 6b. Merge — **worker** role, only if the outcome is not `BLOCKED_NO_COMMIT`

A subagent, Git commands in the main tree, in order, without asking confirmation. Merge is the only step writing on the main tree.

1. Cleanup of commit groups on the main tree: `git status --porcelain` on the pathspecs of the three groups `skills/commit/SKILL.md` § *Procedure* 3 enumerates — code, memory/doc, version/changelog — must be empty. The uncommitted artefacts of the delivery (`2./3./4./5.` and ledger) stand outside those pathspecs and do not count.
2. `git merge --no-ff {worktree.branch_prefix}<name> -m "merge: <folder>"`. Never `git push`.
3. If the merge goes into conflict: `git merge --abort` and no manual resolution — a conflict resolved here is code no finder ever saw — and close with `merged: false` and the conflicting paths in `conflicts`.

Exception to point 3: the conflict on `{changelog}` alone resolves itself by union, and it is the only one resolved inside the delivery. Valid only if purely additive — both parts add distinct entries in the unreleased section, without overlapping on the same lines nor touching version headers: keep both entries, remove the markers, do `git add` of the changelog alone and close with `git commit --no-edit`, verifying the diff contains both entries and nothing else unexpected. Any other conflict, or a non-purely-additive changelog, stays point 3 as is (abort + `BLOCKED_NO_COMMIT`): an invented union on overlapping lines is a decision with tradeoff, and those are not taken here.

```json
{"merged": true, "merge_sha": "<HEAD sha after the merge>", "conflicts": [], "detail": "<...>"}
```

A conflicting merge classifies the delivery `BLOCKED_NO_COMMIT` (blocker: the conflicting paths, branch kept on the worktree): committed on the branch, not integrated. The worktree stays as it is — no cleanup — and the report says branch and conflicts.

### 6c. Cleanup — **worker** role, only if the merge succeeded

A subagent: `git -C <pool>/<name> reset --hard <merge_sha>` and `git -C <pool>/<name> clean -fd` — without `-x`: the ignored, where the heavy junctions live, are not touched — then `git -C <pool>/<name> status --porcelain` empty for confirmation. The worktree stays registered with its name and its branch: it is ready for the next delivery. On `BLOCKED_NO_COMMIT` or `blocked` this phase does not exist: the worktree stays dirty and declared.

### 7. Report — **worker** role

Subagent appending **at the tail** of `<folder>/5. review-report.md` — the file phase 3 already wrote — never overwrite or reformat what is already there.

It is the only phase having to report fields produced by **six others**, and a subagent in a fresh context derives none of them alone. In the prompt they therefore go **already resolved**, one by one (§4.1 of `contracts/orchestration.md`): rebuilding them from memory drops first precisely the lines saying what the delivery did **not** do — and a poor report is never reopened. In the prompt:

- the path to append on, `<folder>/5. review-report.md`, and the tail-append constraint;
- `<folder>` and the **delivered solution**, verbatim: it is the one distilling it, not you;
- from the **phase 3** block: `gate` and `gate_detail`, `outcome`, `missing_disciplines` and `independence`;
- from **phase 4**: the classified `status` and the remaining `to_confirm` items, with their `scenario`;
- from the **phase 5b** block: `updated` and the `confirm_with_owner` items;
- from the **phase 6** block: `committed` and the three SHAs — `commit_sha`, `memory_commit_sha`, `version_commit_sha` — plus the dirty paths declared by phase 4 (no parking: the worktree stays dirty and declared);
- from **phase 6b**: `merged`, `merge_sha` and possible `conflicts`; from **phase 0**: the `<name>` of the worktree and its branch;
- the form of the block to write and the JSON block to return, which are those below.

A single block, at the tail of the review report:

- title `## Delivery`;
- below, **continuous prose in paragraphs** (never bullet lists, never sub-titles): 2-3 sentences on what was delivered (distill the chosen solution to its essence, do not paste it verbatim); a paragraph on the review outcome (gate and its synthesis in one sentence, plus the limits review declared on itself — missed disciplines, lost independence — if any); a paragraph with final state and commits; if open items remain — blockers, post-commit forks, memory facts to confirm with the owner — a last paragraph summarising them grouped by theme and written **in a simple way**: what is at stake, which are the options and what changes by choosing one or the other, understandable without opening the code. If none remain — the normal case, because review and delivery resolve alone what they know how to resolve — omit that paragraph.

Paragraphs separated by an empty line. Clear and synthetic: the state must be understood in 30 seconds.

```json
{"ok": true, "report_path": "<folder>/5. review-report.md", "detail": "<if ok=false, why/reason: file not writable, append failed>"}
```

It is the last phase and nobody decides anything more on its outcome, but the block is still needed: a report not written is the only trace of the delivery disappearing, and without this field its absence is discovered by opening the file. If `ok` is `false`, report it in chat with the reason — the work is committed and not undone, but the delivery is not documented.

## Early block

If Acquisition, Brief or Execute fail, the delivery stops: say so in chat, have the report write a block saying what had to be delivered, at which phase it stopped and why, and close with `status: "blocked"`. No stage, no memory, no commit, no merge.

**Also here the report is a subagent, and also here the prompt is the only channel.** You pass it only the fields of phase 7 existing at that point — file path and tail append, `<folder>` and solution, **which phase stopped** and the `detail` of its block, `status: "blocked"`, the dirty paths under `{code_root}` — and you explicitly tell it the others **do not exist**: gate, commit and memory never ran. Without that line the report tells them anyway, and it is how a delivery never started reads like a delivery arrived badly at the end.

**And also here the worktree stays dirty.** If Execute wrote something under `{code_root}`, before the report you list its paths (`git -C <worktree_root> status --porcelain -- {code_root}`) and declare them in the report and in `reason`; no parking: the worktree stays dirty and declared. The dirt stays confined to its worktree and its branch — but that worktree leaves the pool until the owner cleans or hand-commits it: say so in the report with its name.

## Outcome

1. **In chat, a few lines**: final state (`GREEN_COMMITTED` | `GREEN_WITH_POST_DECISIONS` | `BLOCKED_NO_COMMIT` | `blocked`), used worktree, SHA if committed and merge SHA, whether memory was updated and its SHA (absent if there was nothing to update). The detail — gate, to-confirm, remaining decisions — is already in `<folder>/5. review-report.md`: **do not repeat it**, refer to the file.

2. **Always close with the contract block**, so whoever invoked you — `new-feature` — reads it without interpreting the prose. No field is omitted: with absent value write `null`.

   ```json
   {
     "folder": "<the folder>",
     "status": "GREEN_COMMITTED|GREEN_WITH_POST_DECISIONS|BLOCKED_NO_COMMIT|blocked",
     "worktree": "<worktree name, or null if acquisition failed>",
     "commit_sha": "<sha or null>",
     "merge_sha": "<merge sha in the integration branch, or null>",
     "memory_updated": false,
     "memory_committed": false,
     "memory_commit_sha": "<sha or null>",
     "version_commit_sha": "<sha or null>",
     "architect_agreement": "match|divergence|null",
     "report_path": "<report path, <folder>/5. review-report.md>",
     "reason": "<only if blocked: the exact reason>"
   }
   ```

Every field comes from a phase, and is reported **verbatim** from there — not recomputed from memory: `status` from phase 4 (a conflicting merge of phase 6b reclassifies it `BLOCKED_NO_COMMIT`); `worktree` from phase 0 (`null` if it acquired nothing); `commit_sha` from `committed`/`commit_sha` of phase 6; `merge_sha` from phase 6b (`null` if merge did not start or went into conflict); `memory_updated` from the `updated` field of phase 5b (`false` if the phase was not run); `memory_committed` and `memory_commit_sha` and `version_commit_sha` from phase 6; `reason` from the `detail` of the blocking phase. The delivery does not park — on `BLOCKED_NO_COMMIT` and on `blocked` the worktree stays dirty and the paths are declared in the report and in `reason`.

**`architect_agreement` is the one field that measures the delivery instead of reporting it.** It says whether your own reading of the four asked classifications coincided with the verdict of § *The evaluator*: `match` when they agreed, `divergence` when they did not — and on a divergence the verdict held, which is the case worth reading. It is `null` when the evaluator never ran, and a `null` there is not a fault but a fact to declare. It is the first use of the evaluator to measure Daiku itself: if the two readings always coincide, the evaluator bought little, and knowing that is worth the whole delivery.

## Self-deceptions (stop them before they stop you)

| If you are telling yourself… | The truth |
|---|---|
| "I do the brief/execution here in chat, it is faster" | Every phase is a subagent in a fresh context (`contracts/orchestration.md` §4). In chat you carry behind all the context of previous phases and the chain degenerates. |
| "I rewrite the review discipline here, so everything is in one place" | No: the source is `skills/review/SKILL.md`. Copying it here makes it diverge at the first modification. |
| "The gate is red but the code is clearly right, I commit" | Red gate = `BLOCKED_NO_COMMIT`. Classification is deterministic, not a judgement. |
| "I leave this as a post-commit decision, so the user decides" | Post-commit decisions are true forks, not what nobody wanted to resolve. If one road is clearly the right one, it is resolved where the finding originates. |
| "I commit first and update memory after" | The order is declared: stage → memory → feature commit → doc/memory commit → version/changelog commit. No feature freezes without the artefacts realigned on the **same** diff. |
| "I add `-A` to the stage, it is more comfortable" | Never: the scope is `{code_root}` and files are listed singly. The second commit has the opposite scope and is exclusive. |
| "I work on the main tree, it is already there" | Code lives in the worktree acquired at phase 0. On the main tree only merge (6b) and delivery artefacts write. |
| "The pool is full, I create a sixth / reuse a dirty one" | No: `{worktree.max}` is a cap, not a suggestion. A dirty one is work of another delivery: exit `blocked` and say so. |
| "The merge is in conflict, I resolve it by hand" | No: `abort` and `BLOCKED_NO_COMMIT`. A conflict resolved here is code no finder ever saw. The only additive changelog union excepted (6b). |
| "I use the biggest model, this step looks hard to me" | The model comes from the role declared by the phase, resolved with the rule of §2 of `contracts/orchestration.md`. It is not chosen by feel. |
| "I summarise gate and to-confirm myself in chat" | They are already in the report. Your summary is state + commits, not a duplicate. |

## Cut rule

This skill owns **the sequence**: phases, order, contracts, classification, commits, report. It does not own the *content* of the phases: brief, execution, review, memory and commit convention live in their files, read by the subagents on every run. If you catch yourself rewriting here *how* a brief is made or *how* a bug is found, you strayed from the purpose. It also owns the **worktree lifecycle** — acquisition from the pool, work on its branch, merge into the integration branch, cleanup with reuse: no other skill creates, chooses or cleans a delivery worktree.
