# Changelog

### 1.1.1 — 2026-10-03

- A new environment key `prompt_dump_chars` declares the size past which the prompt opening a run is called a raw dump: the notice that marks the run then names the size, the threshold and the seats that exist for a payload that large — the text in a file with its path passed, or `research` — while truncating nothing and blocking nothing, because moving a dump is the owner's gesture and not the hook's.
- The finders of `/review` receive the diff shaped before it reaches them, and the same way in every round: one command per file with the four file headers filtered out, and the context width adapting to the payload — two lines below a hundred, three from there up.
- The product gains the concept of a channel: a `channels` group in `.daiku/project.json` — `channels.development` and `channels.production` — asked by `/init` as a third question (the name of the development branch, `develop` proposed) and made true by a deterministic step that creates that branch and moves to it, idempotent, failing on a dirty tree at the creation alone. A new branch guard, switched on by `channels.production`, denies `git commit` and `git merge` while the production branch is active and `git checkout`/`git switch` towards it, reads the branch only on the lines naming `git`, and stays off where the key is not declared.
- `/release` is the new entry point that promotes: it asks the version **once**, on the block of commits accumulated on the development branch, writes version and changelog as the last commit on that branch and moves production to its tip with a local fast-forward, never pushing. `commit` stays untouched: the `channels` key changes nothing of what it does.
- The reconciliation of an obstructed merge composes whatever the working tree brought on top of it, not only a merge in progress: a working tree that is dirty on work the delivery did not write is never a reason to stop the delivery or to ask the owner. Two sides that add distinct lines — including two additions at the same boundary, which the measure used to read as an overlap — are both kept; the other session's work stays uncommitted. Only two sides that change the same lines still stop and ask.
- `/init` also derives the formatter's writing line from the format check the gate declares, appending it to `lint_fix` after the lint fix, so a formatting-only failure is repairable before the gate — `lint_fix` now applies safe lint and format fixes.
- `/review` and `/code-review` run the targeted tests of every touched area at every round, not only at the gate: a test the diff brings down — in a file the diff did not touch — becomes a `check` finding the applier repairs, naming the test files, instead of surviving every round green and dying at the gate where the cycle no longer reopens. The outcome is recorded in the round's `check_tests` field, and `/init` signals in one line beside the area where the `check_fast` it derived covers a weaker class than the gate.

---

### 1.1.0 — 2026-10-03

- `/init` closes the instructions file it finds at the project's root into a git stash instead of renaming it to `.old`: the original survives intact and the host stops loading it. It also ignores the delivery-worktree pool when that falls inside the repository.
- `/new-project` closes into the stash a file of the project's found at a founding document's seat instead of overwriting it, and leaves the skeleton's placeholder verbatim where the project has not answered — a declared gap, not an invented sentence. The five document skeletons now carry a guide paragraph saying what belongs in each.
- `/new-feature` and `/research` read the ground the project already declared — `documents.domain`, `documents.stack`, `documents.architecture` — before fanning out or writing notes, so the work verifies what is declared instead of re-deriving it.
- The environment pair resolves the same way in every reader: `.daiku/environment.local.json` still wins whole over `.daiku/environment.json`, and now a local file that does not parse is skipped so the shared one is read; a path declared there that is not on disk is read as an absent key — a `write_root` that does not exist no longer keeps the guard silent.
- `temp_dir` is gone from the parameters: an artefact that must not enter the repository goes to the operating system's temporary directory, which was already what the readers did with no key declared.

---

### 1.0.11 — 2026-10-03

- The ask of a run is kept whole: every question of a decision ask carries its place in the list — `k/N` — and a new guard refuses an ask that carries no place, a batch that does not continue its list, and the launch of a subagent while the ask is open. A list longer than the four questions one call carries can no longer lose the cards that come after the ceiling.
- `/new-feature` accepts a folder already opened and resumes from it: the documents it finds are the state, the phases already on disk are not re-run, and a decision document whose cards are still unanswered comes back to ask — only the cards left open, each with the place it has in that document's list.
- `/new-project` writes a project's five founding documents — `PRODUCT`, `BRAND`, `DOMAIN`, `STACK` and `ARCHITECTURE` — from the package skeletons to the paths `.daiku/project.json` declares; re-runnable, it realigns them without overwriting the work done by hand.
- `/ship-feature` reconciles a merge obstructed by another session's uncommitted work or by a conflicting merge: it keeps both sides where they do not touch the same lines and stops to ask the owner where they do, saving the other session's work as a recoverable patch instead of leaving it behind.

---

### 1.0.10 — 2026-10-02

- The worktree pool recycles: a slot whose tree is clean and whose branch holds nothing the integration branch lacks is reset and reused, whatever its HEAD, so a full pool no longer stops every run; a slot holding an unmerged delivery is left alone.
- `/code-review` becomes a full bug-only cycle on the scope you name — rounds, fixes and the gate, then the report; the commit stays yours.
- `/new-feature --no-ask` produces the documents and stops, without ever executing.
- Various fixes.

---

### 1.0.9 — 2026-10-01

- The project's seats move to new `paths` keys: `studies` holds the notes on a technology, `features` the working folders — `lib_notes` is gone.
- `/init` refreshes the update script it deposited when it comes from an older Daiku, and reports it as missing until then.
- A review launched by hand on a bare base-ref can be closed with its commit: the item the ledger carries no longer blocks it.
- A review accepts a commit already made as its input: `review <sha>` reviews that commit alone, against its first parent.

---

### 1.0.8 — 2026-10-01

- The `daiku: update` task shows the version arriving beside the one in place — `1.0.7 >>> 1.0.8` — and asks before installing it: the catalogue is refreshed first, so the delta is real, and both commands answer as JSON, so the host's own output stays off the screen.
- The task is a copy inside the project: a project set up before this release keeps the script it already has.

---

### 1.0.7 — 2026-10-01

- The write guard is gone: a file creation is never denied, and the package ships five hooks instead of six.
- On Codex, `/sync-host` removes the hooks the package no longer carries, instead of leaving them behind in the project.

---

### 1.0.6 — 2026-10-01

- The `daiku: update` task shows the version in place and asks before updating: nothing is refreshed on an answer nobody gave.
- `init` deposits `.daiku/README.md`, Daiku's own documentation, so what Daiku is and how it is used is answered from inside the project.
- `/new-feature` accepts `--no-ask`: the run stops at the documents, the decisions left open with their recommended option marked.
- Various fixes.

---

### 1.0.5 — 2026-09-30

- A conversation that opened a run no longer does the work itself: a turn of yours asking for something to be made is delegated to a subagent, and a notice repeats the rule at the one write that would break it — nothing is blocked.
- A study no longer settles a direction nobody chose: before it goes technical, `decision-doc` says whose direction it is and what it rests on, and the study stage follows.
- The end-of-session notice about open review ledgers arrives once per session, instead of restarting the turn at every stop.
- When the write guard denies a new file, it now names the key that admits it — and a folder you declare in `write_roots` is a seat inside the repository and outside it alike.
- `develop-feature` is now `ship-feature`.
- The three folders of the method's own documents — work folders, technology notes, feature catalogue — stand under `.daiku/`, and `init` assigns them instead of adopting a folder of yours that looks like them.
- Various fixes.

---

### 1.0.4 — 2026-09-30

- `init` checks what is already in place before doing anything: on a project already set up it answers `Daiku is already set up here.` without asking anything, and otherwise adds only the missing pieces.
- `init` ends with a single line, `You're all set.`, and lists only the steps that did not go through.
- `init` adds a `daiku: update` VS Code task that refreshes the marketplace and updates Daiku in one click.
- In a monorepo, the write guard no longer blocks the root `.gitignore` or a changelog above the folder where Daiku runs.

---

### 1.0.3 — 2026-09-30

- `init` runs in one shot after the two language questions: no further question, and a report with nothing left for you to do.
- `init` points the domain roles and area policies at the rule files your project already keeps, instead of listing them for you to write.
- `init` adds to your `.gitignore` the lines Daiku needs, and keeps `.daiku/` and the memory folder versioned.
- On Codex, `init` installs guardrails and subagent roles itself by running `sync-host`.
- A machine can declare in `environment.local.json` the folders outside the repository where agents may create files (`write_roots`).

---

### 1.0.2 — 2026-09-30

- `init` now points Claude Code's memory into the repository instead of being stopped by its own write guard.
- `init` leaves out commands whose tool no dependency manifest declares.
- `init` no longer repeats in the stack section what the project's own lines already say.

---

### 1.0.1 — 2026-09-30

- Project parameters, domain and policies now travel with the repository: `.daiku/` is versioned, only the machine's override stays out, and the guard that blocked those commits is gone.
- The end-of-session notice no longer mistakes unrelated files in the review state folder for open cycles.

---

### 1.0.0 — 2026-09-28

Daiku 1.0: autonomous development contracts for Claude Code and Codex. AI agents work fast and autonomously, inside the architectural constraints you decide — enforced by checks that really fire, not by advice.

- Full agent loop, from idea to commit. `/new-feature` investigates the code, studies the options and asks with a recommended answer, then delivers: work plan, execution, multi-round review, memory alignment, commit — always in a separate worktree, merged and cleaned at the end.
- Review that prunes. Independent reviewers read the same diff without seeing each other — bugs always, architecture and performance when touched. Fixes get applied and re-checked until nothing is left to find; missing tests get written; one full compile-and-test verification closes the cycle.
- A verdict that binds. A deterministic evaluator owns the chain order and answers mechanical questions; when it says stop, the delivery stops instead of degrading.
- Hooks that deny. Guards block only what the project declares and never execute a freshly written file; on a project not using Daiku they stay silent.
- Knowledge on demand. `/research` studies a young library from the real sources; `/code-review` and `/commit` stand alone for everyday work.
- State in files, not in chat. Every job lives in a folder of files: interrupt it, close everything, resume in a week — it re-reads and restarts where it left off. What is learned stays versioned with the code.
- Behaviour-only skills. Skills say what is done and in what order, never with which values: project paths, environment, domain judgement and architectural policies live one level down, and a missing key makes a skill do less — never do wrong.
- Same method on both hosts. One identical skill corpus on Claude Code and Codex, with per-host wiring deposited in the project.
