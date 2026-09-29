---
name: 'init'
description: 'Opens Daiku on a project not having it yet: writes `.daiku/` — `project.json`, `environment.json`, `domain/`, `policies/` — and the project instructions file, starting from the package skeletons and filling them with what it reads in the repository. Idempotent: it never overwrites an existing file. It launches once per project, and again when the package carries a new skeleton.'
argument-hint: '[technical root, optional — default: current directory]'
---

You are the step making a project **usable by Daiku**. Neither host lets a package write inside the user project: the Parameters and Domain levels cannot be delivered by installation, they can only be **generated** by a command the user launches. That command is you, and you are the only admitted way.

You write little and declare much. Your outcome is not "done": it is the list of what you wrote, what you left empty because you had no right to guess it, and what remains to fill in by hand before the skills truly work.

## You have no project parameters, and you are the only one

Every other contract opens `.daiku/project.json` before acting. You do not: you run **before** that file exists, and writing it is your task. Do not look for it, do not stop because it is missing, do not deduce values from another project. What you need you derive from the repository in front of you, and what the repository does not say stays undeclared.

The form of what you write is in `contracts/project-contract.md`, and the keys consumed by orchestration are in §7 of `contracts/orchestration.md`. Those two files are your specification: if they diverge from this, they prevail.

## Input: the technical root

Arguments: `$ARGUMENTS` — `[technical root]`.

The **technical root** is the directory the skills run from, the one carrying the project instructions file — `CLAUDE.md` on Claude Code, `AGENTS.md` on Codex. It is not always the repository root: a monorepo may have the code under a subfolder and the technical root inside there.

- With an argument, it is that. Without an argument, it is the current directory.
- Then run exactly `git -C "<technical root>" rev-parse --show-toplevel`, on both hosts and both shells. Do not choose another command and do not add checks around it: the exit code is the verdict, and its stdout is the repository root you reuse at *Step 2*.
- If the exit code is not `0`, stop here with exactly these two lines and nothing else: `Cannot initialise Daiku here: <technical root> is not inside a Git repository.` on the first line, `Not written: nothing was written.` on the second. You do not initialise a repository in place of the user.
- If `.daiku/` already exists, it is not an error: continue in **completion** mode (see *Idempotence*).

## Where the skeletons stand

Under `templates/`, at the package root — the folder containing `skills/`, `contracts/` and `templates/`, two levels above this file. It is a path **relative to the package**, not to the project: it holds on both hosts, while an environment path variable exists only on one of the two.

| Skeleton | Where you write it | What you do with it |
|---|---|---|
| `templates/project/project.json` | `.daiku/project.json` | you **fill it in**: see *Step 3* |
| `templates/project/environment.json` | `.daiku/environment.json` | you **empty and refill it**: see *Step 4* |
| `templates/project/domain/` | `.daiku/domain/` | you copy **all** its files as they are: see *Step 5* |
| `templates/project/policies/` | `.daiku/policies/` | you copy **all** its files as they are: see *Step 5* |
| `templates/project/instructions.md` | the instructions file, in the technical root | you **fill it**: see *Step 6* |

**Everything you write is in English**, whatever language the user chose at *Step 0*. Those two keys say in which language the skills will talk to the user and write commits; they do not say in which language Daiku is made. The skeletons arrive in English and you fill them in English: a half-translated instructions file is the worst of the two forms, and a corpus in a single language is the only thing staying readable when the project changes hands.

**The instructions file is the one exception, and only when it already exists in another language**: then its language is the file's, and you carry the skeleton into it instead. *Step 6* says how — the point of the exception is that the file ends in **one** language, which English headings over an Italian file are not.

The skeletons are read on every run, and **you copy all the ones you find**, not a list you keep in mind: if the package carries a new one, relaunching you must suffice. Do not keep their content in mind: if the package updates, the content changes under you and it is the new one that must come out.

## Procedure

### 0. Ask the two languages

It is **the only thing you ask**, and you ask it because it is the only thing the repository cannot tell you with certainty: two identical projects may want different languages, and erring here shows in every line the skills will write from now on.

They are two questions, not one, because they are two different audiences (§5.5 of `contracts/project-contract.md`):

1. **the chat language** — answers, summaries, reports and the documents the method produces;
2. **the commit language** — commit messages and changelog entries, that is what remains in the shared history of the repository.

They concern **the future**, not this run: neither changes one line of what you are about to write, which is in English however they answer. Ask them just the same, and before everything else, because they end up in `project.json` and because the report you close with is the first text they apply to.

**Ask bare, with no preamble.** Use `AskUserQuestion` with two questions: `Chat language` — `Which language for chat replies, summaries, reports and method documents?` — and `Commit language` — `Which language for commit messages and changelog entries?` Options in both: Italiano, English, Other. You may mark one option as recommended from what you read (`README.md` and the instructions file for chat, `git log --oneline -30` for commits); the question text stays exactly as above, with nothing added.

If the user does not answer — because you are running inside a chain, or because the session has no interactive channel — **do not invent**: leave the two keys out of `project.json` and list them among the things to fill in. §5.5 already declares what happens without them, and a silent default here is worse than their absence.

### 1. Recognise the host

On **Claude Code** hooks and subagents are carried by the package and update themselves: do **not** hook those five hooks a second time from `.claude/settings.json`, because the package already hooks them and every guard would run twice. The only thing you write under `.claude/` is two keys in `settings.local.json`, and they are at *Step 7*: together they turn the host's own memory on and point it inside the repository, and there is no other way to tell the host.

On **Codex** the manifest rejects `agents` and `hooks`, and `plugin_hooks` is a removed feature: that layer must be written inside the project, under `.codex/`. **You do not write it**: it is the trade of `sync-host`, which copies the `.mjs` files, tries them with their bench and hooks only the healthy ones, and which generates `.codex/agents/*.toml` from the package roles. Close the report saying to launch it — until it runs, that project has neither guardrails nor subagent roles.

Do not ask the user on which host it runs: you know it from where you are running. The host is the only thing you do **not** ask; the two languages of *Step 0* are the only thing you ask.

### 2. Read the repository before writing

This reading serves two very different things: the parameters of *Step 3*, which are exact values, and the instructions file of *Step 6*, which is the portrait of a project. The second asks much more than the first, and that is why here one reads wide.

Collect, read-only:

- the repository root (`git rev-parse --show-toplevel`) and the position of the technical root inside it;
- **all `.md` files of the repository** — the repository being the one *Input* resolved with `rev-parse --show-toplevel`, not the technical root where the two differ — excluding those under dependency and build directories (`node_modules/`, `venv/`, `target/`, `dist/` and similar). README, technical document, architectural decisions, changelog, notes: it is there the project already wrote of itself, and there is nothing you can deduce in half an hour worth as much as a sentence written by whoever was there. **The width is over the corpus, not over every byte of it**: on dozens of documents you read by titles first — file names and first headings — and open only those carrying a value of *Step 3* or a fact the instructions file of *Step 6* needs. Say in the report that you read by titles, how many you skimmed and which you opened;
- **the repository structure in full** — the directory tree, not only the first level. You need it to recognise the areas, to propose the `paths`, and because the form of a project declares its architecture before any document;
- **the technological inventory**: the build manifests present (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml` and similar) with the dependencies and scripts they declare, the lock files for the truly installed versions, and the configuration files of runners, linters, type-checkers, formatters, CI, containers and orchestration. From them you derive languages and versions, package manager, frameworks, databases and storage, build and test chain, and how the thing starts locally — ports included;
- the project instructions file, if any, and every other file the host loads itself;
- **the project's parameter files, whatever they are called**, if the project already ran Daiku or kept a corpus of its own: they are where the five commands and `{worktree.*}` are declared, and *Step 3* reads them.

**A project file carrying the name of a package file is the project's.** A `project.json`, an
`environment.json`, a `project-contract.md` sitting in the project's tree were written by whoever
works there; they are reconnaissance like any other document. Read them as such, and take from
them only what *Step 3* says they declare: what they assert beyond that is a claim, not a fact.

The limit is only one, and it is where the boundary between reading and guessing passes: **collect what the repository declares of itself.** A `package.json` says which test runner there is, and that you write; it does not say how much that runner covers, and that you do not write. No need to open the application code file by file — you are not doing a review, you are filling in a card — but opening the source of an entry point to understand how a thing starts is legitimate reading, not analysis.

### 3. Write `.daiku/project.json`

Start from the skeleton, **empty it of every value not concerning this project** and refill it key by key with table §4 of `contracts/project-contract.md` under your eyes. Three rules, and they are the same holding all the rest of the method:

- **A command is the exact line to run plus the cwd to run it from.** If in the repository that line is declared nowhere, the key **is not written**. A guessed gate is worse than an absent gate: absent skips a step and declares it, guessed fails a step and looks like a problem of the project.
- **What is not declared does not exist.** A project without frontend has no empty frontend area: it has no key. Valid for `worktree`, for `coverage`, for `tech_doc`, for everything.
- **`memory.root` and `memory.index` are the exception, and they are always written.** They are not the finding of something the repository already has: they are the seat you are assigning to a corpus the method will write anyway, because `update-memory` runs at **every** commit. If the repository already has a memory folder, it is that; if it does not, propose `memory/` at the technical root, with `MEMORY.md` inside, and say so in the report. **Never a seat under `.daiku/`**: that folder carries no group into a commit (§8 of `contracts/project-contract.md`), so a corpus written there could never be committed and the guard would deny the memory group of `commit`. On Claude Code that folder also becomes where the host writes its own memory (*Step 7*), and then declaring it is no longer a choice: it is the presupposition of the step.
- **`contract` is copied from the skeleton**, you do not invent it and do not increment it.

For areas: the area name is your naming choice, its `paths` are not — they are the real paths belonging to them, usable as Git pathspecs. Declare an area only if it truly has its own gate; two folders passing through the same command are a single area. A command at the workspace root that only calls the areas' gates is no area: it has no gate of its own, and declaring it would run every gate twice, over paths the areas already cover.

The two **language** keys are the exception to the first rule, and only because you asked them: you write them with the answers of *Step 0*, verbatim. If you had no answer, you do not write them.

The three `paths` keys — where the work folders, notes and review ledger live — you **propose** by watching what the repository already has: an existing studies folder is worth more than an invented name. If there is nothing similar, choose yourself a path coherent with the structure in front of you and **say so in the report**, because those folders the skills will create at first use and the user should know where.

**`paths.review_state` is looked for on a different terrain.** It stands inside the tree but outside version control (§4 of `contracts/project-contract.md`), so *Step 2*'s reading — which takes what the repository versions — does not reach it: look too among the folders **present on disk but ignored by Git**, where a ledger a project already keeps would sit. `paths.studies` and `paths.lib_notes` instead carry method documents and are versioned, so an existing folder of either is one the repository already shows you. Where no ignored folder resembles a ledger, propose one inside the tree, excluded from version control, **never under `.daiku/`** — that folder is the machine's working state and `init` regenerates it (§8 of `contracts/project-contract.md`) — and declare it in the report together with its `.gitignore` line, which you do not write (*Step 7*).

#### Where each value is read

Deriving is hunting, not inventing: each key family has seats where the project already
declared it, and they are checked before the key is left out.

- **History for conventions.** `git log --oneline -30` shows the grouping the project
  already uses: a stable `xxx:` prefix is `{commit.memory_prefix}` declared, not guessed.
  What the history does not show stays undeclared.
- **Documents and links for the human artefacts.** The README, the root documents and
  `docs/` show what a reader opens: a technical document the README points at is
  `{tech_doc}` confirmed; a released-versions log at the root is `{changelog}` confirmed.
  A plausible file nobody points at is not confirmed.
- **The project's own parameter files for the area commands and the worktree.** A project that
  already ran Daiku carries its own `project.json` and `environment.json` somewhere in its tree —
  `.claude/`, `.codex/`, a folder of its own — and they are the project's declaration, written by
  whoever works there. Read them **before** anything is proposed, for the five area keys and for
  `{worktree.*}`. You take the values, never the file's shape: a key the schema does not declare
  stays out, and `contract` always comes from the skeleton. **A key name written in another language
  is mapped to the canonical one only where the correspondence is certain** — the value the same and
  the meaning the same; where it is not, the name stays out and goes in the report, because a value
  put under the wrong key is read as a value and nobody notices. **Where that file and a manifest
  disagree, the project's file wins**: it is a declaration written by whoever knows the project, and
  a command the project already runs is not a claim to verify against a script. **That precedence
  stops at the package's own contract**: where the project's file declares a key the package forbids
  — `backends.<backend>.base_url` on the host's native backend, which §7 of
  `contracts/orchestration.md` wants absent — the contract wins, you leave the key out and declare
  it in the report. A project's file overrules a manifest, never the form the package fixed. The
  manifest is what you fall back on for the keys that file does not carry. **A file of an older form, or one that
  is missing keys, is no reason to take nothing**: you read the values it does declare and derive
  the rest as below, instead of copying it as it is and leaving the project with the holes of a
  form it has outgrown.
- **Manifests and runners for areas.** The build manifests, the workspace file and the CI
  configuration show the areas and their commands. **Five keys can be derived, and leaving one out
  that was there costs every skill that reads it** — `execute` runs four of them as its closing
  preflight and `test-coverage` runs the fifth. **Each key is searched on its own**, in
  this order: one that does not resolve is left out and the search goes on, because a project can
  declare the last without the first:

  | Key | Where it is read |
  |---|---|
  | `gate` | the manifest's own full command: a `check`, `verify`, `ci` or `test` script, or the aggregate one the CI job calls |
  | `check_fast` | a declared script checking **without writing and without running tests** — `typecheck`, `lint` without `--fix`, `format:check`, `tsc --noEmit` — with the file argument opened as `<FILES>` **only where opening it leaves the check unchanged**, and **called by name** through the package manager where it does not; where several declared scripts qualify, the one checking the **types** wins, then the one checking the **lint**, then the one checking the **format** — the ladder ranks **declared scripts** and nothing else: a type-checker present only as configuration (`mypy.ini`, `pyrightconfig.json`) that no script runs is not on a rung, and the search falls through to the lint |
  | `lint_fix` | a declared script that **applies the safe lint fixes** — often `lint:fix` — or the **linter's own runner with its unambiguous fix flag**, taken from a declared lint script and written as every opened line (`lint: eslint .` → `pnpm exec eslint --fix <FILES>`, `ruff check` → `ruff check --fix <FILES>`). A formatter (`format`, `prettier --write`) is **not** one: the key is a lint fix, and what a formatter writes is the formatting the gate checks. Where no declared lint runner has a fix flag, the key is not written |
  | `test_targeted` | the test script with the runner's own **file-argument** form: `<runner> <FILES>`, keeping every other flag the declared script carries |
  | `coverage` | a declared script producing the measure — `test:coverage`, `coverage`, `cov` — in a manifest, the workspace file, the CI job or the project's parameter files. **It is often declared nowhere**: then it stays out and the report says so, because no manifest declares it |

  `check_fast`, `lint_fix` and `test_targeted` are the **same line as a declared script, with its
  file argument opened**: the `<FILES>` placeholder of §3 exists for exactly this, and it is a
  substitution, not an invention: it **replaces the file argument the declared script already
  carries**, and is never added beside it — added, the script's own scope would stay in the line and
  the files given would be checked with all the others. **The substitution must leave the check the
  same.** A runner that
  with explicit files stops reading its configuration — `tsc --noEmit`, which ignores
  `tsconfig.json` and its path aliases as soon as it is handed a file list, a bundler driven by a
  config file — would check a different world from the gate and fail where the gate passes: there
  the file argument is **not** opened. A declared script is therefore written in one of two forms,
  and never in a third: **the script's body with `<FILES>` opened**, where the check survives the
  substitution — and then it **names the executor the declared package manager provides** (`pnpm
  exec`, `npx`, `uv run`, `poetry run`, `bundle exec`), because a body called by a bare runner name
  would not run as it is; or **the script's name through the package manager** (`pnpm run
  typecheck`, `npm run lint`), where it does not. The name and not the bare body, because §3 wants a
  line running exactly as written, and a body is a line the package manager runs with its own
  `PATH`. Where the runner's file-argument form is not certain — an unnamed wrapper, a Makefile
  target, a task runner whose CLI you have not read — **do not write the key**: §6 already covers its
  absence, and a guessed command fails a step instead of skipping it. One command seen is one key
  written; the others stay out.

  **The gate is the whole command, not one of the five things it covers.** §4 says the gate covers
  lint, format, type-check, test and package build; it does not say that any one of them, declared
  alone, is a gate. A manifest carrying only a package build, or only `lint`, or only `type-check`,
  carries no gate — so it is **no area**, and declaring one for it hands `review` a gate that is not
  the gate. §4's list is read as what the area's command runs, the way a manifest's own `check`
  script runs them all.

The `{worktree.*}` keys are read where the project declares them — its own parameter files, first
of all — and are **proposed** only where nothing declares them: no repository invents a pool
convention, but a project that already ran Daiku has one, and its values are the seat it chose.
Where you propose, keep the `<prefix><N>` naming with a small `{worktree.max}` and declare in the
report that the convention is yours — a proposed seat is seen and changeable, an omitted one is a
delivery without isolation, silently.

When a value is derivable but not certain — a plausible `tech_doc`, a `changelog` that could be the one — **do not write it secretly**: either you confirm it with what you read, or you leave it out and list it in the report among the things to fill in.

### 4. Write `.daiku/environment.json` if missing

It is the **environment** file, not the project one: default host, model per role, available
backends, machine paths. It describes the machine, the host and the owner rather than the codebase
— and it stands **in the project all the same**, because nothing of Daiku lives outside the
repository (§8 of `contracts/project-contract.md`).

Look in the two seats §8 declares, in its order: first `.daiku/environment.local.json` in the
technical root, then `.daiku/environment.json`. **If either is there, do not touch it** — the first
is one machine's own file, the second the project's, and both belong to whoever wrote them.

If neither exists, write `.daiku/environment.json` from the skeleton, emptied of every **alien**
value: no base URL of another owner, no path of another machine. Keep the form, `contract`, the
tier aliases the skeleton carries already filled in, and the host you are running from as
`default_host`. **Then write every value the repository or the project's own parameter files
declare** — the host's settings file, the variable pointing at the active backend, the folder a host
looks for its skill pointers, the model aliases of the host you are not running on, the backends
with their caveats — because a value you read is a value, and leaving it as a placeholder hands the
user a card half filled for nothing. Only what no file declares stays out and is listed: normally a
seat of a machine the repository knows nothing about. The rest the user fills in. What you carry
over is written in **English** (§5.6) — the prose of a backend's caveats is translated, not copied —
and a path **absolute inside somebody's home** is an alien value like any other: it is dropped, even
when the project's own file still carries it.

**The two `instructions_file` keys are one per host, and each is kept only if its file is there.**
The skeleton carries both filled in; you keep the key of every host whose instructions file really
stands in the technical root, and you drop the whole key of a host that has none — a project with
one host has no second file to declare, and §6 of `contracts/project-contract.md` already says what
that absence means. The file of the host you are running on is the one *Step 6* writes; the other
stays as it is.

**"Alien" means of another person or another machine, not "already written".** The tier aliases and
a host's configuration paths hold for anybody: those stay. What identifies somebody is removed.

**You never write `.daiku/environment.local.json`.** It is the machine's override and the user
creates it; one written by you would declare this machine's values as the project's.

**`temp_dir` you do not write.** An absent `temp_dir` is the normal case and not a key you failed
to find: the readers fall back on the operating system's temporary directory, which is the right
answer on every machine. Write it only where that fallback is wrong, and say why in the report.

Declare in the report the path of what you wrote, relative to the technical root, and in one line
that **nothing under `.daiku/` is versioned**: `.gitignore` excludes the folder, no group of
`commit` carries it, and the command guard denies the gesture. Whoever clones the repository runs
`/init` again, and that is the trade — the parameters come back, the file without which no skill
runs comes back, and one machine's answer does not enter another machine's history.

If the skeleton still contains values recognisably of another project or another machine, do not propagate them: remove them and report it in the report.

### 5. Create `domain/` and `policies/`

Copy **all** files of each skeleton, without modifying them: `templates/project/domain/` into `.daiku/domain/`, `templates/project/policies/` into `.daiku/policies/`. They are the only two folders born not empty, and the only two things you lay down without writing a line.

Inside there are two different things, and distinguishing them is worth it:

- **The README of each** is the convention of the folder: how a domain file is named, what a policy file must have in the frontmatter. It is not merit content.
- **The domain skeletons that arrive already written** — every file of `templates/project/domain/` other than its README — are **defaults**, not package rules. You lay them down and it ends there: from that moment they belong to the user, and your idempotence guarantees no relaunch ever rewrites them (§5.4 of `contracts/project-contract.md`).

**Do not invent a domain file the package does not carry**, and do not deduce policies from the architecture you glimpsed. A default written by whoever built Daiku is a declared proposal, which is seen and changed; a file you write now is your ten-minute impression disguised as a rule, and nobody would ever know how to distinguish the two things.

### 6. Write the instructions file

It is the file the host loads on every session — `CLAUDE.md` on Claude Code, `AGENTS.md` on Codex — and it goes in the technical root, with the name declared in `{hosts.<host>.instructions_file}` for the host you are running on. Start from `templates/project/instructions.md`, which carries the canonical structure and, inside, two materials not to be confused.

- **The already written prose is a package default**, like `commit-convention.md`: the *Behaviour* and *Git and commits* sections, and the four stock hard rules, hold for anybody working with Daiku and do not depend on this repository. They are copied as they are. Do not rewrite them in your own words: they were written once to be the same everywhere.
- **The placeholders in angle brackets are your work**, and they fill in with what you read at *Step 2* — not with what would make sense.

#### What goes in the placeholders

The *Documentation map* lists the artefacts existing **in this project**, with the trade of each: one line per real artefact, and the line of one missing is removed instead of staying with an invented path inside. Hunt them through the README's links, the root documents and `docs/` — studies folders, library notes, queues, technical documents, changelogs — and give each its trade in one line.

The *Stack and local environment* is the technological inventory of *Step 2*, written in full: **one line per package of the workspace** — the folder, its runtime and versions, its framework, its data stores, its build and test chain, how it starts — plus the shared toolchain and the environment variables that must stay consistent. A package the file does not name is a part of the project the file does not declare, and it is the section making the file useful from the first minute. **It is added, not substituted**: where the project already wrote lines in that section, they stay whole and the inventory goes beside them, even where a line of theirs says less than the manifest does. Filling a placeholder never licenses rewriting a line that was there, and the section's title stays the project's. It is also the only placeholder you can fill in without risking anything, because every line has a manifest behind.

The **hard rules beyond the four standard ones** are the delicate part, and they have a single rule: **write an invariant only where you saw it stated** — in an instructions file already there, in a repository document, or in a rule the structure respects without visible exceptions. **The numbering is the project's, and you never restart it**: where the file you found carried numbered rules, the ones you add take the next free numbers, because the project cites them by number in its own documents and memories, and renumbering makes those citations lie. A project without numbers gets the ones the skeleton proposes. Conventions visible only in history — commit grouping, message prefixes — do not go here: they are `{commit.*}` values and domain answers, already seated elsewhere. An invariant deduced from a glimpsed architecture is a half-hour impression disguised as a rule, and its trouble is that it does not distinguish itself from the others: in six months nobody will ever know which line was observed and which invented, and nobody will trust deleting one. When in doubt you do not write it and you list it among the things to fill in.

What belongs to this project but holds for **only one of its parts** is not an invariant and does not go there: it goes in a `.daiku/policies/` file, which however **you do not write**. You leave it among the things to fill in, naming each one: for every area of *Step 3* without a policy file, the report carries `policies/<area>.md` with the `paths` it must cover — with the convention already laid at *Step 5* saying how it is done. **A policy is born from the rule files the project already keeps** — wherever they live — and those files enter the report with their path. Reducing them to one `policies/<area>.md` is the writer's judgement — which files hold an invariant of that area, how they merge — and it is not yours: `init` collects and names, it never merges.

#### If the file already exists

**You park it and write the new one beside it.** You read it in full, **rename it** so that its
extension becomes `.old` — `CLAUDE.md` becomes `CLAUDE.old`, `AGENTS.md` becomes `AGENTS.old`, and
never `CLAUDE.md.old` — and then you write the new instructions file at the name the key declares.
Two things are bought, and both matter: the host stops loading the old one, because `.old` is not a
file it reads; and the file you found survives **as it was**, which is the one thing a rewrite
cannot give back. A parked copy already standing there is overwritten — it is the previous version
of this same file, and two of them would be one file with two names.

**The parked file is the best source you have.** It carries true invariants, taken decisions and
motivations no manifest declares. **Everything substantive is kept, and it is kept verbatim** —
moved into the competent canonical section of the new file, never summarised: a rule rewritten
tighter is a changed rule, and changing it is not your task. Only matters of form are discarded: a
different section order, repetitions, and the indications the package now carries. Where the parked
file states something the repository contradicts, that is not a licence to correct it: it is
declared in the report, and the line stays.

**The line ending is part of the line, not a matter of form.** A kept line keeps the ending it had,
and the file keeps the one it always wrote: recomposing it — CRLF normalised to LF, or the reverse —
rewrites every line and `git diff` shows the whole file as changed, hiding what really moved, which
is the one thing *Step 8* exists to show. A file created from scratch takes the ending the
repository uses in majority.

**The other host's file is not yours.** Where the project carries the instructions file of the host
you are **not** running on — `AGENTS.md` while you are on Claude Code — you do not touch it and do
not park it: its key of *Step 4* declares it as it stands, and the file itself is compiled by an
`init` launched there. Read it if it says something about this project worth carrying over; it stays
where it is either way.

**A path or a seat named inside a kept line is part of the line.** Where the project writes that its area rules live in a folder of its own — `.claude/rules/` on Claude Code, or another one — and the skeleton writes `.daiku/policies/`, the project's line stays exactly as it is. `.daiku/policies/` is a seat you lay down empty and the user fills; the rules the project already wrote stay where they are, and are listed among the things to fill in as the material a policy is written from. Renaming the project's seat in a line of theirs does not tidy the form: it asserts something untrue, and it loses a rule that was real.

#### You merge, you do not append

The file you are rewriting is **one file in one language, stating each rule once**. Both halves of
that are your work, and the second is the one that goes wrong.

- **One rule, one line.** Before adding anything, read what is already there and ask whether that
  rule is already written, in another section or in another wording. If it is, you move the
  existing line into the competent section — you do not write a second one beside it. A file
  carrying the same invariant twice is worse than the file you found, because the two copies will
  drift and nobody will know which one holds.
- **A line you keep stays whole.** Not a word of it is added, removed or moved: no clause, no
  qualifier, no adjective taken from the skeleton is inserted inside it. Where the skeleton states a
  clause the project's line lacks — *for every agent, whatever files are open* — it does not go
  inside that line: the kept line is copied exactly, and the clause either takes a line of its own or
  is dropped when the project's line already states the rule. Splicing produces a sentence that is
  neither the project's nor the package's, and nobody can tell any more which half was observed and
  which was a default.
- **The titles are the file's, where the file has them.** The sections the project already
  structured keep their own headings, in its own words — including a title in another language that
  became the project's lexicon, cited in its own prose. The skeleton's titles serve the sections the
  file does not have, and only those: renaming a heading that was already there changes the form
  without gaining anything, and breaks every reference made to it.
- **The language is the one the file already speaks.** An instructions file written in Italian
  stays Italian: **the existing file's language is the file's language**, and the skeleton's prose
  is carried into it. Your own new lines are written in that same language. The one line that stays
  in English is the **marker comment at the bottom**, which is the package's and not the file's: it
  is the thing making the exception to idempotence safe, and translating it would risk the
  recognition it serves.
  The file ends in **one** language — a half-translated file, English headings over the project's
  own prose, is the worst of the two forms and the one thing here that is never acceptable.
  Only a file you **create from scratch** is English (§5.6 of `contracts/project-contract.md`).
- **A translated twin is a repetition.** The case to watch for, because it does not look like a
  duplication: the project already wrote a rule in its language, the skeleton states the same rule
  in English, and both end up in the file. It is one rule written twice. Keep the project's line —
  theirs is real and the skeleton's is a default — and drop the skeleton's.

When you have finished, the file must not contain two lines saying the same thing, and must not
contain one paragraph in English and the next in another language.

If you do not know where to place a line, keep it. A section at the end with what you could not place is better than a lost line, and in the report you declare it.

#### And then you do not touch it again

At the bottom of the skeleton there is a comment line declaring that file passed through here. You
leave it in the file you write, and it is what the next run reads: **if you find it in the
instructions file, that file was already structured — leave it alone**, parked copy included, and
list it among the things left as they were. Only a file without it is read, parked and rewritten.

It is what makes safe this exception to idempotence. A relaunch serves to pick up a skeleton previously missing, not to restructure a file the user meanwhile rewrote by hand — and it is likely it did, because of everything you write it is the file touched most often. Whoever wants restructuring removes that line, or asks you.

**The price is declared.** A section the project already covers in its own words makes the skeleton's
prose fall as a *translated twin* (*You merge, you do not append*), and from then on an improvement
to the skeleton will not enter that project: nothing distinguishes a section already stated from one
not yet stated.

So a relaunch is not idle even here. It does not restructure the file — but it **compares the file
with the current `templates/project/instructions.md`** and reports, without touching a line, the
skeleton's sections the file does not cover and the skeleton's rules the file does not state. The
file stays as it is, and stands in the report under *Left as it was*, with what the comparison found
beside it.

### 6-bis. Recheck every file you wrote

What you just wrote is read by skills and hooks that trust its form: recheck it now, with tools
needing nothing to install — `node -e` and `grep` — before the report:

- for **each `project.json` / `environment.json` you wrote**: it parses, its keys are among those
  `contracts/project-contract.md` §4 (`project.json`) and `contracts/orchestration.md` §7
  (`environment.json`) declare — as mirrored in `schemas/blocks.json` § *params* — and no
  `<...>` placeholder residue remains (hunt it against `templates/`, which is where every
  placeholder comes from). **The one exception is `<FILES>` in `project.json`**: §3 of
  `contracts/project-contract.md` admits it inside a command and it is written there on purpose.
  The residue to hunt is every other `<...>`, not the one placeholder that must stay;
- for **the instructions file**: no `<...>` residue remains.

A file failing the recheck is fixed now, not reported as done: a placeholder surviving in a
parameter file degrades every skill silently, which is exactly the failure this step exists to
catch. Report the recheck file by file, in one line each.

### 7. Carry the host memory into the repository — only on Claude Code

On **Codex this step does not exist**: there the agent memory is not made of files but of a database in the user home (`~/.codex/memories_1.sqlite`), built by consolidating past sessions, and there is no key moving its seat. Do not try, write nothing under `.codex/` for this reason, and do not report it as something missing from that project: it is a difference between the two hosts. The corpus of `{memory.root}` exists there just the same and `update-memory` writes it at every commit; only the host does not put anything of its own in.

On **Claude Code**, instead, the memory the agent writes itself ends up by default in `~/.claude/projects/<project>/memory/`: outside the repository, invisible in a `git diff`, shared with nobody and lost at the first machine change. Your task is to carry it inside, where it is seen — and committed together with the rest. Five things, in this order:

1. **Create the folder** `{memory.root}` if missing, and inside `{memory.index}` if missing: a title, a line declaring that it is the corpus index, and nothing else. Empty is fine; absent is not, because it is the first file whoever reads that corpus opens.

2. **Move what is already there.** It is the only step of the run reading outside the repository, and the step a sandbox is most likely to deny: if the fence refuses it, **do not look for another way** — leave it undone, and put it among the things to fill in, saying which read was denied. Look for this project folder under `~/.claude/projects/` — it is named like the absolute path of the technical root with separators reduced to dashes, but do not rebuild it by mind: list that directory and recognise it. If inside there is a `memory/` with files, **move them** into `{memory.root}`. It is the only thing you do outside the repository in the whole run, and that is why in the report you declare it file by file. If a name already exists at destination do not overwrite it: leave the original where it is and put it among the things to fill in, because they are two different memories called the same and merging them is a merit judgement, not an opening job.

3. **Hook the memory**: in `.claude/settings.local.json`, in the technical root, set `autoMemoryEnabled` to `true` and `autoMemoryDirectory` with the **absolute path** of `{memory.root}`, forward slashes. If the file is missing you create it with only those two keys; if it is there, you **add** them without touching anything it already carries. One of the two already there you leave as it is, even if pointing elsewhere: it is a choice of whoever works on this machine, and you do not overturn it — you only flag it.

4. **Verify the corpus is truly committable**: `{memory.root}` stands **outside `.daiku/`** — the folder carries no group into a commit (§8), so a corpus inside it could never be committed. Then open the repository's `.gitignore` — the one at the root *Step 2* read with `git rev-parse --show-toplevel`, not a folder's — and check no rule excludes `{memory.root}`. If one does, **do not touch `.gitignore`**: say so in the report. That line somebody wrote on purpose, and removing it is theirs to decide. **And the repository's `.gitignore` is not the only pattern source**: §4 of `contracts/project-contract.md` says which file makes a path covered. Whenever in this step you judge a path covered or uncovered, ask *which* file covers it — `git check-ignore -v <path>` names the source — and where the only covering file is the machine's global one, declare it in the report **as the machine's, not the repository's**: do not take it as the project's line, and do not rely on it in place of a line the repository lacks.

5. **Check the line `.daiku/` is present in `.gitignore`.** Nothing under that folder enters the shared history (§8 of `contracts/project-contract.md`): it is the machine's working state — the parameters, the environment, the domain defaults, the policies — and you regenerate it per machine. If the line is missing, **do not add it yourself** (this step does not touch `.gitignore`): put it among the things to fill in, with the exact line to write. The command guard denies a commit carrying the folder in any case, so a missing line is a hole and not a licence.

#### Why those keys go in `settings.local.json` and not in the committed file

It is not a style preference: the pointing belongs to **that one machine**, and `.claude/settings.local.json` is the machine's file — the one nobody clones and nothing carries. A versioned file carrying it would declare one machine's seat as the project's, and the error would show only in silence, on whoever clones.

The consequence is told to the user, not hidden: **memories are committed, the pointing is not.** Whoever clones the repository on another machine finds the versioned corpus and the host restarting to write in the default, silently. The Daiku skills do not notice, because `{memory.root}` they open by path and find where it was; it is the host going its own way, and stopping reading what the repository knows. The remedy is relaunching `/init` on that machine, and *Step 8* writes it in black and white.

`.claude/settings.local.json` is **not committed** either, and for the same reason: it belongs to that machine. It stands outside `.daiku/`, so the folder's line does not cover it — if `.gitignore` carries no rule for it, put it among the things to fill in.

### 8. Report

Close with the list, in three blocks, without embellishments. **The three names are the package's and stay in English whatever the chat language** — `Written`, `Left as it was`, `To fill in`: they are the machine-readable form of the report, like the field names of an agent's block, and a translated name is a block nobody finds. The prose **inside** them is in `{language.chat}`, like the rest of what you say to the user.

- **Written** — every created file, with its path.
- **Left as it was** — every file already existing and which you did not touch.
- **To fill in** — every key you could not declare, with in one line *why* you did not declare it and *where* the material declaring it sits — the folder, the manifest, the document you read — so filling it in is mechanical. This block is the most important of the three: it is the only place where the user discovers that a skill, on this project, will do less. Unwritten domain roles and area policies are listed here the same way: the role and the question it answers (per `templates/project/domain/README.md`), or the policy file with the `paths` it must cover (per the areas of *Step 3*), each with the evidence you already found for it.

If the host layer was not written (see *Step 1*), say so here.

On **memory** dedicate two fixed lines, because *Step 7* does a thing seen nowhere: which files you moved inside the repository and from where, and — if you ran on Claude Code — that the pointing in `.claude/settings.local.json` **holds on this machine only**, and that on a clone memory returns to the default until somebody relaunches `/init` there. On Codex a single line: the host memory does not move, the repository corpus is there anyway.

If you **parked an existing instructions file**, dedicate three separate lines to it: the name it
was parked under, what you kept, what you removed because it was form, and where what you could not
place ended up. It is the most invasive thing you do in the whole run, and the only one the user
must be able to watch immediately — `git diff` tells them that everything changed, it does not tell
them what was saved. If the other host's file is there too, that is a fourth line: it exists, it was
not touched, and it is the file an `init` launched on that host compiles.

## Idempotence

**You do not overwrite an existing file**, except the two exceptions at the bottom. Neither `project.json`, nor the READMEs, nor anything you find under `.daiku/` — `environment.json` included, whose values a person chose and which you leave exactly where they are.

This makes you relaunchable: when the package updates and carries a skeleton previously missing, you are relaunched and write only the missing piece. An already initialised project loses nothing.

**And it is what makes safe letting the domain defaults travel.** A skeleton like `commit-convention.md` arrives already written, but it arrives **only once**: if the user rewrote it, a relaunch sees it and leaves it alone. Without this rule the default would stop being a proposal and become a package rule returning at every update — which is exactly the thing the Domain level exists not to be.

**Adding a key is not overwriting a file.** The `settings.local.json` of *Step 7* is the only file you touch without having written it yourself, and you touch it by addition: the keys you find there stay as they were, including the two concerning you if already there. A relaunch on a new machine writes the pointing missing there, and on a machine where it is there changes nothing — which is exactly the trade for which you are relaunched.

The exceptions are two, and neither loosens the rule.

The first is the **instructions file**, which you write also where one exists — parking the one you found under `.old` — but only once, and what guarantees it is at *Step 6*: the comment line you leave inside the new one. Without that line it would not be an exception but a hole, because every relaunch would return to restructuring the file the user curates more than any other. It is the only already-written thing you are allowed to rewrite, and it is so because it is the only one on many repositories already existing: leaving it as it was would mean, there, never writing it.

The second is the **explicit request** of the user on a precise file: then you rewrite it, and in the report you declare what was there before.

## What you do not do

- **You do not touch the code**, ever, for any reason.
- **You do not create a Git repository**, you do not commit and do not stage what you wrote: whoever launched `init` watches what appeared before versioning it.
- **You do not write the area policies.** The instructions file you write, because its structure is the same everywhere and what belongs to this project you read; an area policy is instead an architectural judgement on only one part, and that is written by whoever knows the project. You lay the convention and list it among the things to fill in.
- **You install nothing** and do not modify the host configuration outside the two keys of *Step 7*, which are the entire licence you have on `.claude/`.
- **You do not touch `.gitignore`**, neither to keep `.daiku/` out of the history nor to add the line for `settings.local.json`: you watch how it is and declare it.
