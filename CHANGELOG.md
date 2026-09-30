# Changelog

### 1.0.3
<sub>2026-09-30</sub>

- `init` runs in one shot after the two language questions: no further question, and a report with nothing left for you to do.
- `init` points the domain roles and area policies at the rule files your project already keeps, instead of listing them for you to write.
- `init` adds to your `.gitignore` the lines Daiku needs, and keeps `.daiku/` and the memory folder versioned.
- On Codex, `init` installs guardrails and subagent roles itself by running `sync-host`.
- A machine can declare in `environment.local.json` the folders outside the repository where agents may create files (`write_roots`).

### 1.0.2
<sub>2026-09-30</sub>

- `init` now points Claude Code's memory into the repository instead of being stopped by its own write guard.
- `init` leaves out commands whose tool no dependency manifest declares.
- `init` no longer repeats in the stack section what the project's own lines already say.

### 1.0.1
<sub>2026-09-30</sub>

- Project parameters, domain and policies now travel with the repository: `.daiku/` is versioned, only the machine's override stays out, and the guard that blocked those commits is gone.
- The end-of-session notice no longer mistakes unrelated files in the review state folder for open cycles.

## $\color{#3b82f6}{\textsf{1.0.0}}$
<sub>2026-09-28</sub>

Daiku 1.0: autonomous development contracts for Claude Code and Codex. AI agents work fast and autonomously, inside the architectural constraints you decide — enforced by checks that really fire, not by advice.

- Full agent loop, from idea to commit. `/new-feature` investigates the code, studies the options and asks with a recommended answer, then delivers: work plan, execution, multi-round review, memory alignment, commit — always in a separate worktree, merged and cleaned at the end.
- Review that prunes. Independent reviewers read the same diff without seeing each other — bugs always, architecture and performance when touched. Fixes get applied and re-checked until nothing is left to find; missing tests get written; one full compile-and-test verification closes the cycle.
- A verdict that binds. A deterministic evaluator owns the chain order and answers mechanical questions; when it says stop, the delivery stops instead of degrading.
- Hooks that deny. Guards block only what the project declares and never execute a freshly written file; on a project not using Daiku they stay silent.
- Knowledge on demand. `/research` studies a young library from the real sources; `/code-review` and `/commit` stand alone for everyday work.
- State in files, not in chat. Every job lives in a folder of files: interrupt it, close everything, resume in a week — it re-reads and restarts where it left off. What is learned stays versioned with the code.
- Behaviour-only skills. Skills say what is done and in what order, never with which values: project paths, environment, domain judgement and architectural policies live one level down, and a missing key makes a skill do less — never do wrong.
- Same method on both hosts. One identical skill corpus on Claude Code and Codex, with per-host wiring deposited in the project.
