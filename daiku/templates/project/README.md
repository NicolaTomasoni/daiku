# Daiku

Daiku is the method this project is built with. It is not a library and not a service: it is a
corpus of **contracts** telling the agents working here *what* to do, in *what order*, inside the
constraints this project declared. It runs on **Claude Code** and on **Codex**, and everything it
needs lives in this folder.

This file is Daiku's own documentation, and it travels with the project: whoever is asked what
Daiku is, what it can do or how to use it reads it here and answers from it, without leaving the
repository.

## What it does

An agent writes fast and in whichever direction it happens to take. Daiku keeps it writing in **the
direction this project chose**. Three promises, each with a mechanism behind it.

- **The shape is yours, and it is declared once.** Architecture, conventions and criteria live in
  `.daiku/project.json`, `.daiku/domain/`, `.daiku/policies/` and the instructions file. Agents read
  them before changing anything, and the guardrail refuses the gestures that would break them — a
  push fired by mistake, a commit signed as somebody else.
- **Nothing enters without being pruned.** Every job goes through a review cycle: independent
  reviewers read the same diff without seeing each other — bugs always, architecture and performance
  where the diff touches them — then what they found is applied and **re-checked**, round after
  round, until nothing is left to find.
- **Nothing is lost between sessions.** A job lives in a folder of files, not in the chat's memory:
  you can interrupt, close everything and resume a week later, and the chain re-reads its files and
  restarts where it stopped. What the work teaches is versioned together with the code.

## The commands

| Command | What it does |
|---|---|
| `/new-feature` | the one every job starts with: from the idea in natural language to the commit, orchestrating the whole chain below |
| `/review` | the quality cycle on a diff: reviewers, fixes, re-checks, then the commit |
| `/code-review` | the bug-only review cycle on the scope you name: rounds, fixes and the gate, stopping at the report with no commit |
| `/research` | notes on a library or a technology, gathered from the real sources and tidied into a file |
| `/commit` | closes a diff written outside a review: it aligns memory and documentation, then commits in separate groups |
| `/ship-feature` | carries an already studied folder through delivery to the commit, without reopening the study |
| `/release` | for a project that declared its two channels: it asks the version once on the block of commits accumulated on the development branch and moves production onto it, without pushing |
| `/init` | opens Daiku on a project: it writes this folder and the instructions file. Once per project, and again when the package carries a new skeleton |
| `/new-project` | after `/init`, it writes the project's five founding documents — the offer, the identity, the domain, the stack, the architecture — from the package skeletons, at the paths the project declares |
| `/sync-host` | on Codex only: it installs guardrails and roles inside the project, and it is re-run after every package update |

## How a job travels

`/new-feature` investigates the code and writes the problem down in black and white; when knowledge
is missing it procures it with `/research`; it then asks the decisions in chat, each with its
options studied and one recommended. From the answers it hands the whole delivery over:
`blueprint` writes the plan, `execute` runs it, `/review` checks it, `update-memory` aligns memory
and documentation, `/commit` closes. Delivery always happens in a separate worktree, merged and
cleaned at the end.

## Where the values live

Four levels, and one question draws the boundary between them: does that value describe this
codebase, or the machine and the person running it?

- **The method** — the contracts of the package, byte-identical in every project. They say what is
  done and in what order; they never carry a value of this project.
- **`.daiku/project.json`** — the project's own values: paths, the literal commands of each area, the
  memory root, the commit convention.
- **`.daiku/environment.json`** — the machine and the host: default host, model per role, backends.
  One machine may replace it whole with `.daiku/environment.local.json`, which stays out of version
  control. To override it on one machine, copy the shared file whole to `.daiku/environment.local.json`
  and change there only the values of that machine and not of the project — `write_roots`, the folders
  it admits writes in, is one. It is a complete alternative, not a list of differences: whatever it
  does not repeat is not read from the shared file.
- **`.daiku/domain/` and `.daiku/policies/`** — local judgement: conventions and criteria needing a
  *why*, and architectural rules valid only for certain paths.

**A key that is not declared is not invented.** The step that needed it is skipped and says so in
its outcome: an incomplete `project.json` makes a skill do less, never do wrong. That is also why
what this project does not have — an area, a test command, a coverage command — is simply absent.

## What stays in the repository

- **The memory corpus** — the operational map and the facts recalled by relevance, written at every
  commit. On Claude Code it is also the folder where the host writes the memory of the session.
- **The work folders** — one per problem, carrying the method's numbered documents: the problem, the
  decision document, the brief, the review notes.
- **The review ledger** — where a cycle records the findings it already judged. It stays inside the
  repository tree but outside version control.
- **`.daiku/update.mjs`** and the `daiku: update` task in your editor, which updates the package.
  The script is a package artefact and not yours: it carries the Daiku version that wrote it, and
  `/init` recreates it whole when a newer one arrives.

The folder `.daiku/` is versioned: it is the configuration the project wrote for itself, and a clone
finds it there without running `/init` again.

## Updating Daiku

From the editor, run the task `daiku: update`: it refreshes the marketplace catalogue, shows the
version in place beside the one that is arriving, asks, and on a yes updates the package. The same
thing by hand:

```text
claude plugin marketplace update daiku
claude plugin update daiku@daiku
```

On Codex, re-run `/sync-host` after every update: there the guardrails and the roles live inside the
project, and only that command realigns them.

The package, the full documentation and the released versions are in
[`NicolaTomasoni/daiku`](https://github.com/NicolaTomasoni/daiku).

---

Copied here by Daiku's `/init`. It is yours now: `init` never rewrites a file of the project's.
The one exception is the update script beside it, which carries the Daiku version that wrote it and
is recreated whole when a newer Daiku arrives.
