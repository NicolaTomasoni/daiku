---
name: 'ship-feature'
description: 'Delivers a feature from the already resolved decision-doc to the commit in a single invocation: worktree, brief, execution, review rounds, decision, memory and documentation alignment, the three commits, merge and report. It orchestrates its own phases delegating each to a subagent. Launched by hand on an existing folder, or by new-feature as its delivery.'
argument-hint: '<folder with 1. decision-doc.md> [+ chosen solution, one option id and text per decision, if 2. blueprint.md is absent]'
---

You are the **engine** of the delivery of a single feature: the sequence — brief → execution → review rounds → decision → memory/documentation update → commit (up to three groups: feature, then doc/memory, then version) → merge → cleanup → report — you orchestrate **it**, delegating each phase to a subagent according to `contracts/orchestration.md`. There is no script doing it in your place.

> **Parameters.** Every key in braces in this contract resolves on the project parameter files, never from memory and never by assumption: the rules are in §5 of `contracts/project-contract.md`, which also says **in which language to write** and what to do when a key is missing.

## When to use it

When you have **one** feature with `1. decision-doc.md` already resolved and you want the complete delivery (up to the conditional commit) without anybody having to chain `blueprint` → `execute` → `/review` → `/commit` in sequence. If you want to stay on the single atomic steps (to stop between one stage and the next), use those directly: this skill does not replace them, it chains them for the cases where you want the whole delivery in one shot.

## Invocation modes

**You are launched by hand or by `new-feature` § *Delivery*.** The sequence is the same either way; what changes is where the input comes from and where the outcome goes.

- **By hand (`owner`).** `$ARGUMENTS` carries the folder; the chosen solution only if `<folder>/2. blueprint.md` is absent and the brief still has to be produced — one option id and text per decision, as written. If the folder does not exist or holds no `1. decision-doc.md`, stop and say so. If the brief is absent and the solution is **ambiguous** against the decision-doc — it names a decision or an option that do not exist there — do not guess and do not ask: stop, and report the options the document truly declares, so the owner relaunches you with the choice. If instead the solution was **not passed at all** and no brief exists, use for each decision the **`A`** option — which by contract is the recommended — and declare it in the outcome. Close with the contract block in chat. You never push: the push stays a manual act of the owner.
- **From `new-feature` § *Delivery*.** Folder and chosen solution arrive resolved in the prompt — there is nobody to ask, and a question asked in here stays hanging (§ *Ask the owner* of `contracts/orchestration.md`). The constraints below hold unchanged, and they are not rewritten in the caller prompt.

## Input

- **`<folder>`** — path of the folder (relative to the repo root, or absolute), wherever it lives: `{paths.features}/<name>` is the common case but not the only one. Verify it on the filesystem: it must exist and contain `1. decision-doc.md`. If missing, stop and return the block with the reason.
- **`<chosen solution>`** — with id and text per decision: you pass it to the brief, and only to the brief — if `<folder>/2. blueprint.md` already exists the solution is not needed and is ignored. If it is ambiguous against the decision-doc — it names a decision or an option that do not exist there — **do not guess and do not ask**: stop, and in the block report the options the document truly declares, so that whoever called you can bring them to the owner. If instead the solution was not passed to you at all and no brief exists, use for each decision the **`A`** option — which by contract is the recommended — and declare it in the outcome: it is a defensible choice written by whoever studied the problem, not your invention.

## Worktree pool

Every delivery works on a pool worktree, never on the main tree. The pool lives in `{worktree.pool}`, names reuse `{worktree.prefix}<N>` with `N` from `1` to `{worktree.max}`, the branch of each is `{worktree.branch_prefix}<name>`. Never a worktree beyond `{worktree.max}`, never a name outside convention: full means full.

**The cap is a knob: `{worktree.max}` in `.daiku/project.json`, and it counts the deliveries in flight.** Raise it to run more in parallel. Lower it and the slots numbered above the new cap leave the pool — nothing standing on them is touched, and acquisition neither reuses nor counts them.

**The pool is run by `architect/pool.mjs`, its disk side**, never by hand: the same root and the same invocation shape as the evaluator (§ *The evaluator*), one JSON object on stdin and one on stdout. Two actions, and together they are the whole lifecycle:

- **`acquire`** (§ *0. Acquisition*) — given `work_root`, `pool`, `prefix`, `branch_prefix`, `max`, the `delivery` folder and `registry`, it measures the registered slots, asks the evaluator which slot the delivery takes, resets, creates or takes back that slot and records the row. It returns `{ok, worktree, branch, worktree_root, detail}`.
- **`release`** (§ *6c. Cleanup* and the blocked branches) — `state: "free"` resets the slot to the merge SHA and cleans it; `state: "blocked"` leaves the tree as the delivery left it and records it. It returns `{ok, worktree, state, detail}`.

**One acquisition at a time.** Both actions run their whole read-measure-choose-write under an exclusive lock file beside the registry, created at the start and removed when the action ends however it ends: a second acquisition waits for it and then chooses on what the first one wrote, instead of on the same reading. Without it two acquisitions that read the registry before either writes choose the same slot, and the hold below has nothing to weigh. A lock left behind by a process that is gone is stolen; one whose process is alive stops the acquisition loudly after a minute, writing nothing.

**A slot is reusable when its tree is clean, its branch holds nothing the integration branch lacks, and no delivery holds it.** The slot's HEAD is deliberately not part of the test: `acquire` resets a reused slot to the integration branch, so a slot standing a commit behind is reusable **whatever commit it stands on** — requiring its HEAD to equal the integration branch's was the condition no slot ever met, and it is what filled the pool with clean, unusable slots until the cap stopped every delivery. What the test keeps is the **containment**: a slot whose branch carries commits the integration branch does not, with a clean tree because the delivery committed them, is the merge gone into conflict — reusing it would `reset --hard` those commits away. The cap counts the slots **in flight**, not the deliveries accumulated.

**The hold is what keeps two deliveries off one tree, and it is the registry's `in-use`.** A slot that has just been acquired is clean — nothing has been written in it yet — and its branch holds nothing the integration branch lacks, so it has exactly the shape of a reusable one: a choice reading only the tree resets it and works on the first delivery's tree. That is not an unlikely interleaving, it is what happens every time two deliveries are launched together. A slot marked `in-use` is therefore **never offered to another delivery**, and a slot held by the delivery asking — a resumption, or the same folder launched again — is taken back **as it stands**: no reset, no second slot, and what that delivery left in the slot survives. An acquisition that neither reuses, creates nor takes back returns `ok: false`, and `detail` names every occupied slot with its state and its delivery.

**The registry is the attribution git cannot give.** `{paths.review_state}/worktree-pool.json`, written only by `pool.mjs`, one row per slot: `n`, `name`, `branch`, `state` (`in-use` while a delivery holds it, `free` after its merge and cleanup, `blocked` when it stopped with the tree dirty), `delivery` (the folder that took it) and `updated`. It is what lets a full pool say **whose** each occupied slot is instead of facing anonymous dirt: a slot marked `in-use` is a delivery holding it, and if that delivery is gone the slot still leaves the pool — the acquisition stops and names it, and the owner releases it — because the alternative is offering a tree that another run may still be writing. It lives beside the review ledger, in the same folder out of version control.

**A delivery that does not merge records its slot `blocked`.** On `BLOCKED_NO_COMMIT`, on a conflicting merge and on an early block after acquisition, run `release` with `state: "blocked"`: it writes no Git and cleans nothing — the tree is left exactly as the delivery left it — and the registry then names the folder that left it. The blocked paragraphs below already say the tree stays dirty and declared; this is the one line that also records the slot.

Two roots, two roles, passed to every phase already resolved:

- **work root** — inside the worktree, the same relative position the technical root occupies in the main tree: code, diff, stage, commit, gate and fix run here, and from here `{code_root}` and the command cwds of `{areas}` resolve. Do not guess it: `architect/pool.mjs` reads it out of Git — the position this tree's technical root holds inside the worktree, `git rev-parse --show-prefix` — and returns it in `worktree_root` (§ *0. Acquisition*).
- **artefacts root** — the main tree: `2. blueprint.md`, `3. memory-report.md`, `4. review-notes.md` and `5. review-report.md`, plus the ledger in `{paths.review_state}/`, live here, so resumption and report do not depend on the worktree.

**A worktree is not an inert copy of the project.** If the project declares constraints on its own local environment — dependencies installed in a shared tree, links or junctions between the two copies, tools rewriting files outside the checkout — those constraints hold here and `{hosts.<host>.instructions_file}` declares them: read it before running any environment command inside the worktree. They are not rewritten here, and not guessed: an install command launched in the wrong place is the typical way a delivery breaks the main tree while believing it works on its own.

## Before starting

Read `contracts/orchestration.md`: roles, host, how a subagent launches, concurrency. Each phase below declares its own role (**judge** or **worker**) and you resolve the model with the rule of its §2 — never from here.

**And before the first phase, prove the evaluator runs.** It is the move `sync-host` already makes on the hook benches — try before hooking, not after the first fault. The proof is the first question this delivery needs anyway (`order`, in § *The evaluator*): if it comes back, the evaluator runs and the sequence is known; **if it does not, the delivery does not start**. The verdict binds, so a delivery started on an evaluator that does not answer breaks where it is least visible. The diagnosis tells two causes apart and they are not the same thing: **the environment** — `node` not on the `PATH`, the fix on the user's side — and **the package** — a malformed input, or a case the bench does not cover, which is a defect of Daiku and is declared as such.

## The evaluator

Five of the classifications below are **asked, not read off this prose**, and the
verdict binds. It is one program, and asking it is one command:

```bash
node <package root>/architect/architect.mjs <package root>
```

It reads **one JSON object on stdin** and writes **one JSON object on stdout**; it starts no
process, talks to no model and opens no file of the project — only the package's own
`schemas/blocks.json`, for the `block` question. What it answers here:

| Question | Where it is used here |
|---|---|
| `order` | § *The sequence* — given the entry point and the artefacts already on disk, which phases remain |
| `block` | § *1. Brief* and § *2. Execute* — whether the block of the phase has the form its node declares |
| `decision` | § *4. Decision* — the classification of the six rows |
| `unblock` | § *Mechanical unblock* — whether only mechanical work remains |
| `propagation` | *Block validation*, below — what becomes of a step whose block did not come back or came back refused |
| `pool` | § *0. Acquisition* — which worktree a delivery takes, asked by `architect/pool.mjs`, the pool's disk side |
| `reconcile` | § *6b-bis. Reconcile* — whether the obstructed merge's two sides are disjoint line by line, asked by `architect/reconcile.mjs`, the node's disk side |

**What it reads is one JSON object whose keys are fixed**, and a caller that guesses one of them
stops the delivery. `question` is always there; **which other keys each question requires is
declared once**, in `REQUIRES` of `architect/architect.mjs`: the program refuses an input missing
one of them, and its bench reads every call to the evaluator in the contracts of `skills/` and
refuses one whose paragraph does not name them all — so the keys are named where each call is
made, and not listed again here. Three of them carry a meaning their name does not say: `ledger`
is `null` when there is none, and for `order` a ledger that exists and is not passed turns into a
fork for the owner where a verdict was due; `step` is `{"node": …, "block": …|null, "attempt": 1|2, "invalid": […]}`, where `invalid` is what the `block` question said of that block — its `blockers`, or `[]` when no question judged it.
These are the eleven questions it answers. The five this file does not use directly are asked by the contracts that need them:
`closing`, `resumption` and `round` by `skills/review/SKILL.md` (§ *Closing*, § *Baseline and ledger*, § *When to run another round*), through
`architect/ledger.mjs`, the review's disk side, which imports these questions and hands them the ledger and the added lines it read from disk
(`skills/review/SKILL.md` § *The ledger tool*), and which asks `block` too, on the finder and applier blocks; `layers` by
`skills/arch-check/SKILL.md` § *How you verify*, the same way, and again by `skills/execute/SKILL.md` § *Principles* point 8, which calls
`architect/architect.mjs` directly — execute runs before a ledger exists, so it reads the added lines from Git itself; `pool` by
`architect/pool.mjs`, the pool's disk side, which is what § *0. Acquisition* runs; `reconcile` by `architect/reconcile.mjs`, the
reconciliation's disk side, which is what § *6b-bis. Reconcile* runs; and `block` is asked also
by `skills/new-feature/SKILL.md` § *7. Decisions are asked in chat*.
A key a question needs and does not find is a loud failure, never a guessed value.

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
only copy: this file cites it and does not restate it. It always carries all eleven fields —
`ok`, `verdict`, `remaining`, `resume_from`, `slot`, `blockers`, `retry`, `fallback`, `readings`,
`violations`, `detail` —
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
(`question: "order"`), passing the entry point (`entry`), the artefacts already on disk (`present`)
and the `ledger` (or `null`): the verdict says where to start and what is left to do, and the sections below are its
**rendering** for whoever reads a contract; the evaluator owns the order. Two things stay here:
the phases are ordered and
none is skippable, and the worktree lifecycle of phase 0 still belongs here.

Each block carries the field declaring the outcome of its own phase: `ok` for Brief, Execute and Report, `gate` for Review, `staged` for Stage, `updated` for Memory, `committed` for Commit. **If that field says failure, or if the block does not come back at all, the delivery stops there** (see *Early block*) — an absent block is not interpreted by feel and not rebuilt from the prose of the subagent.

**What says failure, field by field**, because not all those fields declare one: `ok: false` for Brief, Execute and Report; `staged: false` for Stage, which skips 5b and 6 and goes to the report as the phase itself prescribes; `committed: false` for Commit; and in every phase the **absent block**. For **Review** failure is **only** the absent block, not `gate`: a `gate: "red"` is a successful measurement, and the table of phase 4 classifies it `BLOCKED_NO_COMMIT` — stopping here would flatten it onto `blocked`, which means "the brief broke", and the difference between a delivery not compiling and one never started would be lost. `updated: false` is **never a failure**: `skills/update-memory/SKILL.md` declares it "the expected outcome, not a failure" when the diff justifies no writing, and phase 6 already foresees that case in writing ("If 5b wrote nothing, this commit **does not exist**").

The phases having their own contract declare the block **at home**, and here it is cited: every local rewrite shrinks at the first modification of the node (§4.2 of `contracts/orchestration.md`).

**Block validation.** Every phase block is validated under the Validation clause of §4 of
`contracts/orchestration.md`, which separates two failures: a block that does not come back
relaunches the phase exactly once **with the identical prompt**, a block that comes back and the
validation refuses relaunches it once **with what the validation said** — the two relaunches are not
the same act, and the refused block came back. **What follows a failure is asked, not judged here**: call the evaluator with `question: "propagation"` and `step` set to `{"node": <the phase>, "block": <what came back>|null, "attempt": 1|2, "invalid": <the blockers the `block` question returned, or []>}` — `retry` is the relaunch, its `detail` says in which of the two forms, `fallback` the outcome the skill hosting that phase declares for the case. The **ceiling** stays written here because it is a consequence and not a classification: **exactly one** relaunch, never a third attempt. On second failure the
delivery stops at that phase (see *Early block*) with the `detail` of its block — for Review,
failure is only the absent block, never a measured `gate: "red"`. The expected form of each
block is cited from the file declaring it, never recopied here, and mirrored in
`schemas/blocks.json`, where the prose of the node stays normative on divergence.

### 0. Acquisition — **worker** role

A subagent assigning the worktree. In the prompt: `work_root` (the technical root you run from), `{worktree.pool}`, `{worktree.prefix}`, `{worktree.max}`, `{worktree.branch_prefix}`, the delivery `<folder>`, the registry `{paths.review_state}/worktree-pool.json`, the invocation of `architect/pool.mjs` with the same root as the evaluator (§ *The evaluator*), and the block to return. It runs **one** command, without asking confirmation:

```bash
node <package root>/architect/pool.mjs <package root>      # with this object on stdin
{"action": "acquire", "work_root": "<the technical root here>", "pool": "{worktree.pool}", "prefix": "{worktree.prefix}", "branch_prefix": "{worktree.branch_prefix}", "max": {worktree.max}, "delivery": "<folder>", "registry": "{paths.review_state}/worktree-pool.json"}
```

The **integration branch** is the one the main tree is currently positioned on: `pool.mjs` reads it itself. The program is the one that decides **which slot the delivery takes** — the rule the prose used to carry by hand, with a second «free» condition (`HEAD == HEAD(<INT>)`) no slot ever met. It takes back the slot this very delivery already holds, else reuses the first slot that is clean, holds nothing the integration branch lacks and no delivery holds — whatever its HEAD — else creates the smallest free number when none is reusable, and returns `ok: false` when all `{worktree.max}` slots are registered and none is reusable, naming in `detail` each occupied slot with the delivery the registry attributes it to. The row it writes (`in-use`, with the delivery) is the attribution git cannot give, and it is also the hold that keeps the next acquisition off this slot.

```json
{"ok": true, "worktree": "<name>", "branch": "<{worktree.branch_prefix}<name>>", "worktree_root": "<the pool worktree's path, with the technical root's position inside it as Git reports it>", "detail": "<if ok=false, why>"}
```

`ok: false` stops the delivery (see *Early block*): `blocked` report, no stage, no commit. A dirty slot, or one another delivery holds, is not your residue to take: the registry names whoever left it. From here on every phase already receives resolved the `<name>`, the work root and the artefacts root.

### 1. Brief — **judge** role

Subagent producing the brief. In the prompt:

- read in full `skills/blueprint/SKILL.md` and follow that contract to the letter;
- folder `<folder>` (contains `1. decision-doc.md`), chosen solution `<verbatim>`;
- load `{hosts.<host>.instructions_file}` and, for each area the brief touches, open the pertinent rule in `.daiku/policies/` reading their `paths`: decide the layer placement **before** opening code, do not rely on automatic loading of the rules, and declare it as Target paths in the brief;
- `{memory.index}` and the paths of the memories the perimeter touches, to open before deciding (§4.1 of `contracts/orchestration.md`): the already taken decisions and the constraints not deducible from the code stand there, and a brief ignoring them makes the executor rediscover them at its own expense;
- the brief reads `1. decision-doc.md` and writes `2. blueprint.md` in the **artefacts root** (the main tree): it anchors the code by reading it there — the worktree is a copy synchronised at acquisition;
- if `<folder>/2. blueprint.md` already exists, do **not** rerun the brief: return `ok: true` with the existing path;
- ask nothing of the user: folder, decision-doc and solution already exist.

The expected outcome is the block `skills/blueprint/SKILL.md` declares in its own § *What you return*, in full and with those field names.

**Whether it has that form is asked, not eyeballed.** Call the evaluator with `question: "block"`, `name: "blueprint"` and `block` (what came back, parsed, or `null`): on `invalid` the phase has failed, `blockers` says what was wrong, and *Block validation* above holds — one relaunch, then the delivery stops. It checks the form, and the block says so of itself: a plan whose every task carries a `red_if` can still carry banal ones.

### 2. Execute — **worker** role

Executor subagent. In the prompt:

- read in full `skills/execute/SKILL.md` and follow that contract to the letter (real autonomy, observable verification, update the file while working, mandatory closing verification — **without** launching the suite or the package gate, which belong to phase 3 — deposit `4. review-notes.md` with the real base-ref);
- apply it to folder `<folder>`; load `{hosts.<host>.instructions_file}`; area rules enter alone when you open the files they cover, but if you touch an area without having read one of its files, open it yourself; stay inside the brief's Target paths — a needed excursion updates the brief Journal first;
- code and Git commands in the **work root** of the worktree; `4. review-notes.md` in the **artefacts root**, and the base-ref you deposit there is the SHA of the work-root HEAD at execution start (`git -C <worktree_root> rev-parse HEAD`);
- `{memory.index}` and the paths of the memories pertinent to the perimeter, to open before writing (§4.1 of `contracts/orchestration.md`);
- ask nothing of the user; stop only before a real block (unjustified destructive action or irreconcilable contradiction).

The expected outcome is the block `skills/execute/SKILL.md` declares in its own § *What you return*, in full and with those field names. Its form is asked like the brief's — `question: "block"`, `name: "execute"`, `block` — and an `invalid` is a failed phase under *Block validation*. On `valid` the phase is over and the delivery goes to phase 3: nothing remeasures the evidence against the disk — the maps the brief built are the last measurement, and the executor worked only on the files they cite.

### 3. Review — **worker** role, `/review`, always, inside the delivery

Review **is part of the delivery**: it is not an optional step, it is not postponed to the user, and it is not skipped — it is the only point of the chain running the build and test gate, so without it nobody has proven the feature compiles. Without it the decision of phase 4 does not exist, so the commit does not exist.

Fully run `skills/review/SKILL.md` — scope → finder and fix rounds, until the cycle converges → gate — on file `<folder>/4. review-notes.md` in the **artefacts root** (fixed name by `execute` contract: do not concatenate the returned path, its format is not guaranteed). It is the same discipline running from standalone `/review`: a single source, no copy — **do not rewrite it here**. In the prompt also pass it the worktree work root and the artefacts root: diff, fix, coverage and gate run in the first, ledger and `5. review-report.md` in the second (`skills/review/SKILL.md`, § *When review runs on a worktree*).

**Delegate it to a subagent** executing that contract, on the **worker** role: its exits, its rounds and its closing are verdicts of the evaluator and of `architect/ledger.mjs`, and what stays with it is bookkeeping plus the merit verdict of rule 3, taken on criteria its contract writes down. Do not orchestrate its phases yourself. The yield of its round 1 stands in the independence of the finders, and orchestrating it from here — where you have in mind the brief, the execution and what you expect — is the already self-convinced pass the fan-out exists to avoid (§4 of `contracts/orchestration.md`, *Depth and degradation*). If you are **resuming** a delivery whose review had already started, pass it the ledger path you find in `{paths.review_state}/` with the `base` of this delivery **and** with `item` equal to `<folder>`: it restarts from the next round instead of running the whole triage again. The two fields are watched together because the baseline alone does not identify a review — a resumed delivery restarts from the same commit — and **if the candidates remain more than one, or if the ledger carries no `item`, you pass none of them**: the triage is run again, while the ledger of another feature silently switches off `on_previous_fix` and `oscillation`. `--with` is not used here: the disciplines are decided by the project (`{review.disciplines}`) or, without that key, by the scope from the diff.

**Instead always pass it `--no-commit`**, and it is mandatory: `/review` closes with the commit by its own setting (§ *Closing* of its file), and the commit of this delivery is **phase 6**, after the decision of phase 4 and the alignment of 5b. Without that flag review would commit the code before you evaluated its open items, phase 6 would find the tree already clean, and `update-memory` would run twice — once from `/commit` inside review, once as phase 5b — on a diff meanwhile already entered.

The expected outcome is the block `skills/review/SKILL.md` declares in its own § *Outcome*, **in full and with those field names**: read it from there, do not redeclare it here. You need them all — `outcome`, `missing_disciplines` and `independence` decide how much `gate` and `to_confirm` (phase 4), and a recopied narrower block is exactly how they stop arriving.

If review finds no file under `{code_root}` to review, stop: there is no delivery to evaluate.

### 4. Decision — you decide it **yourself**, in chat, without subagent

It is a deterministic classification on already structured data: no second judge is needed to re-judge. **It is asked, not computed here.** Call the evaluator with `question: "decision"` and the `review_outcome` block in full; the verdict is `GREEN_COMMITTED`, `GREEN_WITH_POST_DECISIONS` or `BLOCKED_NO_COMMIT`, and `blockers` lists **every** condition that blocks, not the first. The table below shows that rule to whoever reads it; the evaluator owns it, and what remains here is the **consequences**, which are ours and are not a classification — on `BLOCKED_NO_COMMIT` one does not stage, does not align memory, does not commit, and the worktree stays dirty on purpose.

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

- If `gate: green` and empty `needs_tradeoff` come back: ask the evaluator again with `question: "decision"` on the updated `review_outcome` block, and continue from phase 5 on unless it returns `BLOCKED_NO_COMMIT`; the report tells the unblock in a paragraph.
- Otherwise (if `gate` is still `red`, or `needs_tradeoff` is non-empty): `BLOCKED_NO_COMMIT` stays with those blockers, and from here on the paragraph below holds (no stage/memory/commit, dirty and declared worktree).

A single attempt per delivery: if the gate stays red do not relaunch the fix — the second pass is oscillating work, and oscillation is declared, not repeated. This is the only road reopening a `BLOCKED_NO_COMMIT` inside the same delivery: blocking items, forks and missed disciplines are never unblocked this way.

On `BLOCKED_NO_COMMIT` one does not stage, does not update memory and does not commit — and **the worktree stays dirty on purpose**: the delivery never parks the worktree's own work as a patch, and modifications remain visible on the worktree branch. The one patch the delivery writes is § *6b-bis*'s `main-tree.patch`, which holds the **main tree's** uncommitted work — another session's, kept recoverable — and never the delivery's own blocked work. Before the report list the dirty (`git -C <worktree_root> status --porcelain -- {code_root}`) and declare its paths in the report and in the chat summary.

The worst case is confined instead of prevented: the blocked dirty stays on the branch of its worktree and never enters the integration branch. The registry marks the slot `blocked` and names the delivery that left it, so whoever reads the pool knows whose it is; the slot returns to the pool once the owner has resolved it — its tree clean and nothing left on its branch that the integration branch lacks. A pool of blocked slots is a pool of declared work, not of anonymous dirt: with every slot occupied and none reusable, acquisition stops the delivery and its `detail` names each one with its delivery.

### 5. Memory — only if the outcome is **not** `BLOCKED_NO_COMMIT`

Two subagents in sequence, **both before the commit**.

**5a. Stage — worker role.** Stage is separate from commit because step 5b must read the **full** diff of the feature — new files included, which `git diff` does not show until they are in index. In the prompt: the worktree work root, and run only these Git commands with `git -C <worktree_root>`, in order, without asking confirmation — `git status --porcelain -- {code_root}` to locate the touched files (always ignore any file external to `{code_root}`, even if modified: the feature's perimeter is `{code_root}`, and nothing else enters the index here), `git add <the identified files, listed singly>` (never `-A`, never `.`), again `git status --porcelain -- {code_root}` to confirm the index. Never `git commit`, never `git push` in this step.

```json
{"staged": true, "files": ["<path>"], "detail": "<if staged=false, why>"}
```

If `staged` is `false`, there is nothing to deliver: skip 5b and 6, go to the report.

**5b. Memory/documentation update — judge role.** In the prompt:

- read in full `skills/update-memory/SKILL.md` and follow that contract to the letter;
- the diff to inspect is the one **in index** under `{code_root}` in the **work root** of the worktree: `git -C <worktree_root> diff --cached --stat -- {code_root}` and `git -C <worktree_root> diff --cached -- {code_root}`; it is the full diff of the feature, the same the commit will produce;
- **every seat of your perimeter stands in the work root.** `{hosts.<host>.instructions_file}`, `{memory.root}`, the founding documents (`documents.*`) and `.daiku/policies/` are versioned: the commit of phase 6 carries them, and the merge of 6b brings them onto the main tree together with the code. Nothing of your perimeter stays behind — a policy written in the work root is a policy the merge carries over like the rest;
- the **feature folder** is `<folder>` in the **artefacts root**: deposit there your return block as `3. memory-report.md`, as described in point 7 of its § *Procedure*. It is the phase closest to the context limit — it reads the full diff — and it is the only one whose outcome, without that file, does not survive interruption: on resumption memory is already aligned, `files` comes back empty and commit 2 has no more scope;
- **you are not authorised to commit your group**: run no Git writing command and do not touch the index of `{code_root}`; you limit yourself to modifying `{hosts.<host>.instructions_file}`, `.daiku/policies/`, `{memory.root}` and the founding documents (`documents.*`) — plus the artefact above, which is the trace of the phase and not a memory update — and return `committed: null`. Commits are phase 6, which makes them in the declared order — first the feature, then doc and memory — and that order is the reason permission is not granted here.

Commit permission is a property **of the invocation**, not of the node: the same contract, invoked by `/commit`, receives it. Telling it explicitly in the prompt is not a repetition — without that line its default is "no", and it is the right default, but it is the line that makes clear why it is so here.

The expected outcome is the block `skills/update-memory/SKILL.md` declares in its own § *Procedure*, point 7, in full: `updated`, `files`, `confirm_with_owner`, `detail`, `committed`. The latter must be `null`, as the ban above imposes; if it comes back with a SHA, the subagent committed against the prompt — **do not redo that commit** in phase 6, verify it with `git log`, report it as an anomaly in chat and continue with the rest.

### 6. Commit — **worker** role

A single subagent, up to three distinct commits and in the declared order, on the worktree branch (`{worktree.branch_prefix}<name>`). In the prompt: the work root, and run Git commands with `git -C <worktree_root>`, in order, without asking confirmation.

**It writes on three paths only, and they are those of commit 3.** The bump touches `{changelog}`, `{version.file}` and the files of `{version.replicated_in}`: the subagent modifies them, and outside those three pathspecs it writes nothing — it touches no code, no memory, no documentation. Everything else of this phase is Git commands.

**Commit 1 — the feature.** The files under `{code_root}` are **already** in index: do not run `git add`, you commit exactly what is there. Message conforming to § *Commit convention* of `skills/commit/SKILL.md`, which resolves it on the project. **Never** co-authorship trailers nor mentions of the agent generating the work. Then `git log --oneline -1` to read its SHA.

**Commit 2 — doc and memory.** Only if step 5b truly wrote something and only if the first commit succeeded. **Exclusive** scope the files listed by 5b: `git status --porcelain -- <each one>` to confirm they are modified, `git add <the same ones, listed singly>` (never `-A`, never `.`, never files under `{code_root}`), commit with message opening with `{commit.memory_prefix}`, for the rest according to the same convention, `git log --oneline -1` for the SHA. If 5b wrote nothing, this commit **does not exist**: do not touch files outside `{code_root}`. If 5b came back with `committed` set — that is it committed its own group while not authorised — this commit **does not exist just the same**: report that SHA in `memory_commit_sha` with `memory_committed: true`, and do not attempt an empty commit on files nobody modified anymore.

**Commit 3 — version and changelog.** Third group: `{changelog}`, `{version.file}` and the files of `{version.replicated_in}`. **If one of these falls under `{code_root}`** — a `package.json`, a `pyproject.toml` — step 5a already put it in index and commit 1 carried it away as it was, without the new number: that file is modified now and re-enters **here**, in the third group, which is not empty only because one of its paths had already been committed once. Declare it in `detail`, because it is the only case where a path appears in two of the three commits. When the changelog entry is written, when the bump is done and what it entails is declared in `skills/commit/SKILL.md`, § *Version bump and changelog*: the subagent reads it **from there** and executes it, **do not rewrite it here** — it is the same form with which phase 3 refers to `skills/review/SKILL.md` instead of rewriting its discipline. A single source for the changelog, otherwise features delivered from here never arrive in the version register, while the same ones delivered by the closing commit of `/review` get there. Message and order are those that section declares; the commit goes **after** the first two and does not exist if the group is empty. Then `git log --oneline -1` for the SHA.

**Never `git push`**, in none of the three.

**Why this phase is not an invocation of `skills/commit/SKILL.md`**, since the three groups and their order are its own: because that contract **always** delegates alignment to `update-memory` as its own mandatory step, and here alignment already ran at phase 5b, on the diff in index and with commit permission denied. Invoking it would run it twice, and the second with a permission the commit order of this skill does not admit. What remains of its own — the message convention and the version and changelog discipline — is read from there, as commit 1 and commit 3 do.

**If the sequence stops between one group and the next, say so with the paths.** A failed commit 1 leaves in the tree the memory/doc group 5b just wrote, and — if the bump had touched it — also version and changelog: two groups that **are not parked**, because they are artefacts to reconcile by hand, not code to reapply with `git apply`. List them in `detail` and in the report with their paths. They stay in the **worktree**: **phase 0** sees them, which considers reusable only a slot whose `git status --porcelain` is empty and whose branch holds nothing the integration branch lacks, and that slot leaves the pool until the owner treats it. Declaring them is what lets whoever reads know whose they are, instead of facing a worktree occupied by anonymous dirt.

```json
{"committed": true, "commit_sha": "<sha>", "memory_committed": false, "memory_commit_sha": "<sha if it exists>", "version_commit_sha": "<sha if it exists>", "detail": "<...>"}
```

### 6b. Merge — **worker** role, only if the outcome is not `BLOCKED_NO_COMMIT`

A subagent, Git commands in the main tree, in order, without asking confirmation. Merge is the only step writing on the main tree besides § *6b-bis*.

1. Cleanup of commit groups on the main tree: `git status --porcelain` on the pathspecs of the three groups `skills/commit/SKILL.md` § *Procedure* 3 enumerates — code, memory/doc, version/changelog — **holds none of the delivery's own work**. If the working tree holds uncommitted work on a path the merge would touch — another session's, the delivery never commits it — do **not** abort and do **not** merge: close with `merged: false`, `conflicts: []`, `dirty_paths: [<the dirty paths>]`, and the delivery goes on to § *6b-bis*, which keeps both sides and reports it. The paths to weigh are **every path the branch changes, wherever in the tree it stands**, not only those under the three pathspecs: a dirty file elsewhere that the merge would overwrite is the same obstruction and takes the same road. The uncommitted artefacts of the delivery (`2./3./4./5.` and ledger) stand outside those pathspecs and do not count.
2. `git merge --no-ff {worktree.branch_prefix}<name> -m "merge: <folder>"`. Never `git push`.
3. If the merge goes into conflict: do **not** abort and do not resolve by hand — leave the merge **in progress** (`MERGE_HEAD` present) so § *6b-bis* can measure the three stages — and close with `merged: false`, `conflicts` holding the conflicting paths, `dirty_paths: []`.
4. **A refusal is an obstruction, not a failure.** If `git merge` refuses and leaves no merge in progress, the paths it names in its error are the dirty ones: close with `merged: false`, `conflicts: []`, `dirty_paths: [<those paths>]`, and § *6b-bis* reconciles them. A working tree that is dirty on work the delivery did not write is **never** a reason to stop the delivery and never reaches the owner: when the two sides are disjoint — including two sides that both add lines, which are both kept — the node merges by itself, and only a genuine overlap on the same lines is asked.

```json
{"merged": false, "merge_sha": null, "conflicts": [], "dirty_paths": [], "detail": "<...>"}
```

On a successful merge the block carries `merged: true`, the `merge_sha`, `conflicts: []` and `dirty_paths: []`.

**A purely additive changelog is the reconciliation's ordinary case.** Two sides that add distinct entries in the unreleased section, without overlapping lines nor touching version headers, are disjoint line by line, and § *6b-bis* keeps both. Where the two sides touch the same lines, the node stops and the owner decides: an invented union on overlapping lines is a decision with tradeoff, and it is not taken here.

When 6b returns `merged: false` with a non-empty `conflicts` or `dirty_paths`, the delivery does not stop and does not classify: it goes to § *6b-bis*, which reconciles or asks. Only a reconciliation that cannot proceed, or an owner who chooses to abort, closes the delivery `BLOCKED_NO_COMMIT`.

### 6b-bis. Reconcile — **worker** role, only if § *6b. Merge* returned `merged: false` with non-empty `conflicts` or `dirty_paths`

One subagent running the node `reconcile`: read in full `skills/reconcile/SKILL.md` and follow that contract to the letter. In the prompt, already resolved: the **work root** (the main tree, where the Git commands run), the delivery `<folder>`, the branch `{worktree.branch_prefix}<name>`, and the block § *6b. Merge* returned with its `dirty_paths` or `conflicts`, so the node knows whether the merge is in progress or the tree is merely dirty. The node runs `architect/reconcile.mjs` with `action: "measure"` — the same root as the evaluator — writing the patch artefact at `<folder>/main-tree.patch`: the recoverable copy of the other session's uncommitted work, kept while the working tree stays untouched.

The node asks the evaluator `question: "reconcile"` — through `architect/reconcile.mjs`, which names the `paths`, one entry per obstructed path — and reads the verdict:

- **`reconcile`** — the two sides are disjoint line by line. The node runs `architect/reconcile.mjs` with `action: "merge"`, which lands the merge keeping both — `git merge --no-ff --autostash` on a dirty tree, the union of the disjoint sides on a merge in progress — and returns `merged: true` with the `merge_sha`. The delivery goes on to § *6c. Cleanup*, and the slot is `free`.
- **`stop`** — at least one path is changed on the same lines by both sides. The node merges nothing and returns `merged: false` with `overlap` naming those paths, `patch`, `dirty_paths` and the structured `question`. Carry the question into the chat as § *Ask the owner* of `contracts/orchestration.md` prescribes, and **stop**: the run resumes on the same folder and re-opens this node in **resolved mode** — the class of § *Invocation modes* of `skills/reconcile/SKILL.md` — with the owner's answer, which completes the merge. Until then the slot is `blocked`.

The node fails loudly if it cannot proceed — a missing input, or an overlap that a union would have to invent — and on that, or on an owner who chooses to abort, the delivery closes `BLOCKED_NO_COMMIT` (slot `blocked`): no stage, no memory, no commit beyond what the branch already holds, the worktree left as it is, and the `reason` names the overlap. In no case does the reconciliation commit the other session's uncommitted work: the working tree stays as it was, `main-tree.patch` is the declared recoverable copy.

### 6c. Cleanup — **worker** role, only if the merge succeeded

A subagent: `node <package root>/architect/pool.mjs <package root>` with `{"action": "release", "work_root": "<the main technical root>", "pool": "{worktree.pool}", "name": "<name>", "registry": "{paths.review_state}/worktree-pool.json", "state": "free", "ref": "<merge_sha>", "delivery": "<folder>"}`. It resets the slot to `<merge_sha>` and cleans it (`clean -fd`, without `-x`: the ignored, where the heavy junctions live, are not touched), verifies the tree is empty and records the row `free`. The worktree stays registered with its name and its branch: it is ready for the next delivery, which `acquire` will reuse **whatever the integration branch does next**. On `BLOCKED_NO_COMMIT` or `blocked` — including when § *6b-bis* stopped on an overlap and is waiting for the owner — this phase does not exist: the worktree stays dirty, and the slot is recorded blocked (§ *Worktree pool*).

### 7. Report — **worker** role

Subagent appending **at the tail** of `<folder>/5. review-report.md` — the file phase 3 already wrote — never overwrite or reformat what is already there.

It is the only phase having to report fields produced by **seven others**, and a subagent in a fresh context derives none of them alone. In the prompt they therefore go **already resolved**, one by one (§4.1 of `contracts/orchestration.md`): rebuilding them from memory drops first precisely the lines saying what the delivery did **not** do — and a poor report is never reopened. In the prompt:

- the path to append on, `<folder>/5. review-report.md`, and the tail-append constraint;
- `<folder>` and the **delivered solution**, verbatim: it is the one distilling it, not you;
- from **phase 2**: the path of `<folder>/4. review-notes.md`, whose *Considerations* section is material for the open-items paragraph where a point is still open — its *Handoff* section is evidence for a program, not for the report;
- from the **phase 3** block: `gate` and `gate_detail`, `outcome`, `missing_disciplines` and `independence`;
- from **phase 4**: the classified `status` and the remaining `to_confirm` items, with their `scenario`;
- from the **phase 5b** block: `updated` and the `confirm_with_owner` items;
- from the **phase 6** block: `committed` and the three SHAs — `commit_sha`, `memory_commit_sha`, `version_commit_sha` — plus the dirty paths declared by phase 4 (no parking: the worktree stays dirty and declared);
- from **phase 6b**: `merged`, `merge_sha`, possible `conflicts` and `dirty_paths`; and when § *6b-bis* stopped on an overlap, its `overlap`, its `patch` and the question put to the owner — the artefact `<folder>/main-tree.patch` holds the other session's uncommitted work and is the recoverable copy; from **phase 0**: the `<name>` of the worktree and its branch;
- the form of the block to write and the JSON block to return, which are those below.

A single block, at the tail of the review report:

- title `## Delivery`;
- below, **continuous prose in paragraphs**: what was delivered (distill the chosen solution to its essence, do not paste it verbatim); a paragraph on the review outcome (gate and its synthesis in one sentence, plus the limits review declared on itself — missed disciplines, lost independence — if any); a paragraph with final state and commits, and — when the merge needed § *6b-bis* — how the reconciliation ended and where `main-tree.patch` was left; if open items remain — blockers, post-commit forks, memory facts to confirm with the owner — a last paragraph summarising them grouped by theme and written **in a simple way**: what is at stake, which are the options and what changes by choosing one or the other, understandable without opening the code. If none remain — the normal case, because review and delivery resolve alone what they know how to resolve — omit that paragraph.

Paragraphs separated by an empty line, readable at a glance.

```json
{"ok": true, "report_path": "<folder>/5. review-report.md", "detail": "<if ok=false, why/reason: file not writable, append failed>"}
```

It is the last phase and nobody decides anything more on its outcome, but the block is still needed: a report not written is the only trace of the delivery disappearing, and without this field its absence is discovered by opening the file. If `ok` is `false`, report it in chat with the reason — the work is committed and not undone, but the delivery is not documented.

## Early block

If Acquisition, Brief or Execute fail, the delivery stops — say so in chat, have the report write a block saying what had to be delivered, at which phase it stopped and why, and close with `status: "blocked"`. No stage, no memory, no commit, no merge.

**Also here the report is a subagent, and also here the prompt is the only channel.** You pass it only the fields of phase 7 existing at that point — file path and tail append, `<folder>` and solution, **which phase stopped** and the `detail` of its block, `status: "blocked"`, the dirty paths under `{code_root}` — and you explicitly tell it the others **do not exist**: gate, commit and memory never ran. Without that line the report tells them anyway, and it is how a delivery never started reads like a delivery arrived badly at the end.

**And also here the worktree stays dirty.** If Execute wrote something under `{code_root}`, before the report you list its paths (`git -C <worktree_root> status --porcelain -- {code_root}`) and declare them in the report and in `reason`; no parking: the worktree stays dirty and declared. The dirt stays confined to its worktree and its branch — but that slot leaves the pool until the owner cleans it: say so in the report with its name.

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

**`architect_agreement` is the one field that measures the delivery instead of reporting it.** It says whether your own reading of the five asked classifications coincided with the verdict of § *The evaluator*: `match` when they agreed, `divergence` when they did not — and on a divergence the verdict held, which is the case worth reading. It is `null` when the evaluator never ran, and a `null` there is not a fault but a fact to declare. It exists to measure the evaluator's value: if the two readings always coincide, the evaluator bought little.

## Self-deceptions (stop them before they stop you)

| If you are telling yourself… | The truth |
|---|---|
| "I do the brief/execution here in chat, it is faster" | Every phase is a subagent in a fresh context (`contracts/orchestration.md` §4). In chat you carry behind all the context of previous phases and the chain degenerates. |
| "I rewrite the review discipline here, so everything is in one place" | No: the source is `skills/review/SKILL.md`. Copying it here makes it diverge at the first modification. |
| "Execute returned `ok: true`, I go to the review" | `ok` is the executor's word on itself, and the phase closes on a `valid` form asked via `block` — but the evidence it carries is never remeasured against the disk here. |
| "The gate is red but the code is clearly right, I commit" | Red gate = `BLOCKED_NO_COMMIT`. Classification is deterministic, not a judgement. |
| "I leave this as a post-commit decision, so the user decides" | Post-commit decisions are true forks, not what nobody wanted to resolve. If one road is clearly the right one, it is resolved where the finding originates. |
| "I commit first and update memory after" | The order is declared: stage → memory → feature commit → doc/memory commit → version/changelog commit. No feature freezes without the artefacts realigned on the **same** diff. |
| "I add `-A` to the stage, it is more comfortable" | Never: the scope is `{code_root}` and files are listed singly. The second commit has the opposite scope and is exclusive. |
| "I work on the main tree, it is already there" | Code lives in the worktree acquired at phase 0. On the main tree only merge (6b), the reconciliation (§ *6b-bis*) and delivery artefacts write. |
| "The pool is full, I create one more / reuse a dirty one" | No: `{worktree.max}` is a cap, not a suggestion. A slot that is clean, holds nothing unmerged **and is not held by another delivery** is reused whatever its HEAD — that is what the pool is for, and `acquire` resets it — but a dirty one, one with a delivery nobody merged, or one a delivery is working in, is not: exit `blocked`, and the registry names whose it is. |
| "The slot looks free, I take it — its tree is clean" | The tree of a slot acquired a minute ago is clean too: that is exactly what a slot in use looks like. `state` is what says whether a delivery holds it, and the hold is part of reusability, not a gloss on it. |
| "I pick the pool slot by hand, it is only a couple of git commands" | No: `architect/pool.mjs` owns acquisition and release, and the `pool` question owns the choice. The hand-made version is exactly the one that carried `HEAD == HEAD(<INT>)` and never recycled a slot. |
| "The merge is in conflict, I resolve it by hand" | No: § *6b-bis* measures the three stages and keeps both sides only where they are disjoint, and stops to ask where they touch on the same lines. A conflict resolved by hand is code no finder ever saw, and a union invented on shared lines is a decision with tradeoff. |
| "I use the biggest model, this step looks hard to me" | The model comes from the role declared by the phase, resolved with the rule of §2 of `contracts/orchestration.md`. It is not chosen by feel. |
| "I summarise gate and to-confirm myself in chat" | They are already in the report. Your summary is state + commits, not a duplicate. |

## Cut rule

This skill owns **the sequence**: phases, order, contracts, classification, commits, report. It does not own the *content* of the phases: brief, execution, review, memory and commit convention live in their files, read by the subagents on every run. If you catch yourself rewriting here *how* a brief is made or *how* a bug is found, you strayed from the purpose. It also owns the **worktree lifecycle** — acquisition from the pool, work on its branch, merge into the integration branch, cleanup with reuse: no other skill creates, chooses or cleans a delivery worktree. That lifecycle is executed by `architect/pool.mjs`, its disk side, which owns the slot's registry and asks the `pool` question for the choice: this file names the actions, and does not re-derive the rule.
