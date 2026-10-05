<p align="center">
  <img src="daiku/icon.png" alt="Daiku icon: a bonsai" width="200" />
</p>

<h1 align="center">Daiku</h1>

<p align="center">
  <i>Growing a project in the right direction.</i>
</p>

<p align="center">
  <img alt="version 1.1.3" src="https://img.shields.io/badge/version-1.1.3-3b82f6?style=flat" /> <br>
  <a href="https://code.claude.com"><img alt="Claude Code" src="https://img.shields.io/badge/Claude_Code-D97757?style=flat&logo=claude&logoColor=white" /></a>
  <a href="https://developers.openai.com/codex"><img alt="OpenAI Codex" src="https://img.shields.io/badge/OpenAI_Codex-000000?style=flat&logo=openai&logoColor=white" /></a>
</p>

> A bonsai does not grow at random: it grows in the right direction because somebody decided
> the shape, guides the branches and prunes where needed — patiently, one intervention
> after another.
>
> Daiku does the same with your software. AI agents work fast and autonomously, but
> **inside the architectural constraints you decided** — and Daiku forces them to respect
> those constraints. Every contribution is checked, pruned,
> re-checked. That way the project grows, feature after feature, **without losing its
> shape**. Available for **Claude Code** and **Codex**.

## Why you will like it

- **The workflow has an engine, not a prompt.** A program — the evaluator — owns the order of the
  chain: given the entry point and what already exists on disk it answers which steps remain, and
  **its verdict binds**. No phase gets skipped, reordered or declared finished by the agent itself:
  if the evaluator does not answer, the delivery stops instead of quietly degrading.
- **Review is a cycle that converges, and it keeps a ledger.** Round one fans out independent
  reviewers who read the same diff without seeing each other — bugs always, architecture, performance
  and dead code only where the diff calls for them. Their fixes are new code nobody has read, so the
  next round re-reviews exactly those, and so on until the code stops changing. Every finding already
  judged sits in a ledger and is never raised twice; one full compile-and-test gate runs a single
  time, at the end.
- **Skills are behaviour only.** The method's files are byte-identical on every project: they say
  *what* is done and *in what order*, never with which values. Paths, gates and commands live one
  level down in `.daiku/` — a gate is the exact line plus the directory to run it from, never a
  description — so the same Daiku works on your stack without a single skill edited.
- **Decisions come to you already studied.** At a real fork it asks, with two to four mutually
  exclusive options and one of them recommended, and nothing else moves while it waits — no subagent
  is still in flight when the question reaches you. You answer, and the chain resumes alone from there
  down to the commit.

## How to start

**1. Install it** — once, on your host:

```text
# Claude Code
claude plugin marketplace add NicolaTomasoni/daiku
claude plugin install daiku@daiku

# Codex
codex plugin marketplace add NicolaTomasoni/daiku
codex plugin add daiku@daiku
```

It needs **Node.js 18 or later**. Without it the six hooks stay silent and the evaluator does not
start at all: since its verdict binds, a delivery stops instead of degrading.

**2. Open it on a project** — once per project, from the project's **technical root**: the folder
carrying your instructions file, which is the repository root unless the code lives in a subfolder.

```text
/init
```

It asks three things — the language for the chat, the one for commits, and the name of the development branch the work will live on — then writes
everything in one run and answers `You're all set.` What your repository does not declare it leaves
out, and the skills know how to work without it. On Codex it also installs protections and roles by
itself. On Claude Code it leaves updates in place too: an update script and a VS Code task,
`daiku: update` — run it from the editor and it shows you the version in place and asks before
moving on.

**3. On Codex only**, re-run after every update:

```text
/sync-host
```

It realigns protections and roles inside the project (on Claude Code there is nothing to do). Its
last block is the one you must not skip: four gestures Codex asks of you — approve the changed
hooks, trust the project, declare the pool, reopen the session. Skip them and Codex reports a clean
install while no guardrail is active.

## The commands, from simplest to largest

Three commands for everyday work, ordered by size: `/research` procures
knowledge, `/review` checks a diff, `/new-feature` goes from an idea to the commit by orchestrating
everything else. Beside them, `/new-project` is launched once, on a project that has just run
`/init`: it writes the five founding documents — `PRODUCT.md`, `BRAND.md`, `DOMAIN.md`, `STACK.md`
and `ARCHITECTURE.md` — from the package skeletons, at the paths `.daiku/project.json` declares.

### `/research`

When the model lacks knowledge — a young library, a version released after its
cutoff — it studies it from the real sources: documentation, repositories, registries. Collection
runs on several fronts in parallel; then `study` tidies the notes and deposits them in a file.
Run by hand, the file is the delivery; inside a feature it is invoked as needed.

### `/new-feature` — from description to commit

The command every job starts with. You tell it the idea in natural language — or hand it a folder already opened, and it resumes from there: the documents it finds are the state, so nothing already written is written again, and the decisions left unanswered come back to ask, each with the place it has in that document's list. Starting from a description, it first investigates the code and puts the problem down in black and white; when knowledge is missing, it relies on `/research`.

Then `decision-doc` studies the options and comes to ask its questions, with a recommended answer: you answer and it records, until every decision is closed.

At that point, `ship-feature` takes over delivery: `blueprint` writes the work plan, `execute` runs it, `/review` checks it, `update-memory` aligns memory and documentation, and `commit` closes the feature. It always works in a separate worktree, merged and cleaned at the end.

```mermaid
flowchart TD
    RS["research"] --> DD["decision-doc"]
    DD --> SF["ship-feature"]
    SF --> BP["blueprint"]
    BP --> EX["execute"]
    EX --> RV["review"]
    RV --> UM["update-memory"]
    UM --> CM["commit"]

    style RS fill:#10b98112,stroke:#10b981
    style RV fill:#a855f712,stroke:#a855f7
```

### `/review`

You hand it hand-written code and the quality check starts. First it looks at what
changed and re-reads findings discarded in the past, so as not to raise them again. Then round one:
three independent reviewers read the same code without seeing each other — bugs always,
architecture and performance only when the diff touches them. Then `applier` applies the
fixes; and since those are code nobody read yet, the next round re-checks only the
touched files, until nothing is left to find. At that point `test-coverage` writes the missing
tests, one full compile-and-test verification runs a single time, and `commit`
closes. If you prefer committing yourself, the cycle stops at the report.

```mermaid
flowchart TD
    CR["code-review"] --> AP["applier"]
    AC["arch-check"] --> AP
    PF["perf"] --> AP
    AP --> CR
    AP --> TC["test-coverage"]
    TC --> CM["commit"]

    style CR fill:#a855f712,stroke:#a855f7
```

Two pieces also stand alone: `/code-review` runs the bug-only cycle on the scope you name —
fixes, re-checks and the gate — and stops at the report, leaving the commit to you; `/commit`
tidies memory and documents and closes in separate commits.

### `/release` — the promotion

For a project that declared its **two channels**. Every commit lands on the **development branch**;
production advances only when you say so. `/release` reads the block of commits accumulated since
the last release, asks you the version **once** on that whole block — major, minor or patch — writes
version and changelog as the last commit on the development branch, and **fast-forwards** production
onto that tip. It never pushes: the promotion stops at the local ref, and the push stays your
gesture. A branch guard, switched on by `channels.production`, keeps the work off production in the
meantime: it reads the branch only on a line naming `git`, and on a project that declared no
channels it is off and nothing changes.

## About me

I am one developer. I build software in the industry, and I spend my days inside very large
codebases: corporate projects that reach millions of lines, that were not written yesterday and
that cannot be stopped.

Daiku is not a method designed at a desk and then tried somewhere: it grew, one intervention after
another, out of successive refinements on those projects. That is where every rule in it comes from,
and why it assumes from the first minute a codebase far larger than a demo — and already running.
It is meant to be adopted the way it was born: gradually, feature after feature, without ever
stopping the project.

## Inspirations

Daiku stands on the shoulders of public work that explored the same space before it:

- [everything-claude-code](https://github.com/WorldFlowAI/everything-claude-code) — a Claude Code toolkit of agents, commands, skills, rules and hooks, studied in a full repo confrontation: E2E journeys with flaky quarantine, security defect classes, the dead-code discipline, policy-guided source hygiene, open-ledger reminders and the host-manifest bench all came from there.
- [superpowers](https://github.com/obra/superpowers) — an agentic skills framework and software development methodology.
- [ponytail](https://github.com/DietrichGebert/ponytail) — a minimal-code ruleset pushing agents toward the smallest change that works.
- [agent-skills](https://github.com/addyosmani/agent-skills) — a production-grade pack of twenty-five skills spanning the whole DEFINE→SHIP cycle across a dozen agents, studied in a full repo confrontation: a deterministic eval of skill routing with a ratchet, a linter over the skill corpus and a diff-scoped floor-guard against a lowered quality bar are its most transferable mechanisms.
- [andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) — a single-file behavioural preamble for coding agents, from Andrej Karpathy's notes on how LLM agents write code: studied in a full repo confrontation, its four conduct rules turned out to be, in substance, the ones Daiku already carries in the project instructions file.
- [token-optimizer](https://github.com/alexgreensh/token-optimizer) — a model-free context optimizer for coding hosts: compression functions, fill-threshold checkpoints and post-compact restore from a local SQLite state, with no network calls.
- [compaction](https://github.com/philipppohlmann/compaction) — a local token-reduction layer under Claude Code, Codex and Cursor: output shaping before generation, byte-exact recovery of every mutated request, and a boundary that fails open on any error.
- [rtk](https://github.com/rtk-ai/rtk) — a single-binary Rust proxy between the agent and the shell: it rewrites a command into its filtered equivalent, or runs it and compresses the output before the agent reads it, with a three-level filter lookup a project can extend.
- [headroom](https://github.com/headroomlabs-ai/headroom) — a context-compression layer for coding agents, usable as a library, a local proxy, an MCP server or an agent wrapper: a staged pipeline over tool output, logs, files and RAG chunks, with the original recoverable from disk.
- [squeez](https://github.com/claudioemmanuel/squeez) — a Rust hook compressor across seven hosts: it strips ANSI, folds repeats into a count, groups and truncates tool output, and rewrites safe Bash commands in PreToolUse — a transparent optimiser rather than a method.
- [token-savior](https://github.com/Mibayy/token-savior) — an MCP server, with a CLI for hosts without one, that navigates code by symbol, keeps a persistent SQLite memory and rewrites Bash commands in PreToolUse; the savings it advertises are declared unverified by the project itself.
- [context-mode](https://github.com/mksglu/context-mode) — an MCP server with hooks that keeps raw tool bytes out of the context, indexes them in FTS5 and rebuilds the session after compaction, routed across seventeen client platforms.
- [token-reducer](https://github.com/Madhan230205/token-reducer) — a local, API-free Claude Code plugin that compresses context before the model: hybrid BM25-and-vector retrieval, AST chunking and reranking, all on the machine.
- [semantic-cache-mcp](https://github.com/CoderDayton/semantic-cache-mcp) — a Python MCP server that puts every file operation behind one cache: fourteen tools over vendored SQLite, with semantic diffs and content-defined chunking.
- [toon](https://github.com/toon-format/toon) — Token-Oriented Object Notation: a lossless, compact recoding of the JSON data model for prompts, with SDKs, a CLI and a benchmark harness.
- [LLMLingua](https://github.com/microsoft/LLMLingua) — a Microsoft research library that drops non-essential tokens from a prompt, or from a JSON key by key, before it reaches the model, returning the compression ratio alongside the compressed text.
