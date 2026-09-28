# Changelog

## 1.0.0 — 2026-09-28

Daiku 1.0: autonomous development contracts for Claude Code and Codex. AI agents work fast and autonomously, inside the architectural constraints you decide — enforced by checks that really fire, not by advice.

- Full agent loop, from idea to commit. `/new-feature` investigates the code, studies the options and asks with a recommended answer, then delivers: work plan, execution, multi-round review, memory alignment, commit — always in a separate worktree, merged and cleaned at the end.
- Review that prunes. Independent reviewers read the same diff without seeing each other — bugs always, architecture and performance when touched. Fixes get applied and re-checked until nothing is left to find; missing tests get written; one full compile-and-test verification closes the cycle.
- A verdict that binds. A deterministic evaluator owns the chain order and answers mechanical questions; when it says stop, the delivery stops instead of degrading.
- Hooks that deny. Guards block only what the project declares and never execute a freshly written file; on a project not using Daiku they stay silent.
- Knowledge on demand. `/research` studies a young library from the real sources; `/code-review` and `/commit` stand alone for everyday work.
- State in files, not in chat. Every job lives in a folder of files: interrupt it, close everything, resume in a week — it re-reads and restarts where it left off. What is learned stays versioned with the code.
- Behaviour-only skills. Skills say what is done and in what order, never with which values: project paths, environment, domain judgement and architectural policies live one level down, and a missing key makes a skill do less — never do wrong.
- Same method on both hosts. One identical skill corpus on Claude Code and Codex, with per-host wiring deposited in the project.
