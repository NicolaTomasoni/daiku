---
name: 'init'
description: 'Opens Daiku on a project not having it yet, in one shot after asking the two languages: writes `.daiku/` — `project.json`, `environment.json`, `domain/`, `policies/`, `README.md` — the project instructions file and the `.gitignore` lines the method needs, starting from the package skeletons and filling them with what it reads in the repository. Idempotent: it never overwrites a file belonging to the project, and recreates whole the scripts it deposits, which carry the version of the package that wrote them. It launches once per project, and again when the package carries a new skeleton, and again after every update, to bring its own scripts up to the version in place.'
argument-hint: '[technical root, optional — default: current directory]'
---

You are the step making a project **usable by Daiku**. Neither host lets a package write inside the user project: the Parameters and Domain levels cannot be delivered by installation, they can only be **generated** by a command the user launches. That command is you, and you are the only admitted way.

**You run in one shot.** The two languages of *Step 0* are the only thing you ask; after them you ask the user nothing — not a choice, not a confirmation, not a follow-up — and you hand back nothing to do: whatever the repository lets you derive, you write; whatever it does not declare, does not exist in this project (§6 of `contracts/project-contract.md`) and the skills already know how to work without it. When the run ends the project is open, and you say so in one line (*Step 10*).

## You have no project parameters, and you are the only one

Every other contract opens `.daiku/project.json` before acting. You do not: you run **before** that file exists, and writing it is your task. Do not look for it, do not stop because it is missing, do not deduce values from another project. What you need you derive from the repository in front of you, and what the repository does not say stays undeclared.

The form of what you write is in `contracts/project-contract.md`, and the keys consumed by orchestration are in §7 of `contracts/orchestration.md`. Those two files are your specification: if they diverge from this, they prevail.

## Input: the technical root

Arguments: `$ARGUMENTS` — `[technical root]`.

The **technical root** is the directory the skills run from, the one carrying the project instructions file — `CLAUDE.md` on Claude Code, `AGENTS.md` on Codex. It is not always the repository root: a monorepo may have the code under a subfolder and the technical root inside there.

- With an argument, it is that. Without an argument, it is the current directory.
- Then run exactly `git -C "<technical root>" rev-parse --show-toplevel`, on both hosts and both shells. Do not choose another command and do not add checks around it: the exit code is the verdict, and its stdout is the repository root you reuse at *Step 2*.
- If the exit code is not `0`, stop here with exactly these two lines and nothing else: `Cannot initialise Daiku here: <technical root> is not inside a Git repository.` on the first line, `Not written: nothing was written.` on the second. You do not initialise a repository in place of the user.
## Scan first

Before reading, asking or writing anything, measure what is already there. Run exactly:

```
node "<package root>/skills/init/scan.mjs" "<technical root>" <host>
```

— `<package root>` the folder two levels above this file, `<host>` `claude` or `codex` (*Step 1*). It prints one JSON object, `{fresh, missing}`, and its answer decides the run; you do not second-guess it:

- **`fresh: true`** — the project has no `.daiku/project.json`: run the whole *Procedure*.
- **`fresh: false` and `missing` empty** — Daiku is already open here and nothing is missing. Your whole answer is one line saying so, in the `language.chat` of `project.json` — `Daiku is already set up here.` in English, `Daiku è già pronto qui.` in Italian — and the run ends: no question, no reading, no write.
- **`fresh: false` and `missing` not empty** — **completion** mode. Each entry names the step that writes it (`step`): run those steps and only those, for those pieces and only those. *Step 0* is skipped — the languages live in `project.json`, which already stands and is never rewritten — and so is *Step 2*, unless `instructions` is listed. Then run the scan again: what it still lists is a step that did not go through (*Step 10*).

The scan reads only what `init` writes. A domain role the project answered in a file written after the first run is not something it can see: whoever writes that file writes the pointer.

## Where the skeletons stand

Under `templates/`, at the package root — the folder containing `skills/`, `contracts/` and `templates/`, two levels above this file. It is a path **relative to the package**, not to the project: it holds on both hosts, while an environment path variable exists only on one of the two.

| Skeleton | Where you write it | What you do with it |
|---|---|---|
| `templates/project/project.json` | `.daiku/project.json` | you **fill it in**: see *Step 3* |
| `templates/project/environment.json` | `.daiku/environment.json` | you **empty and refill it**: see *Step 4* |
| `templates/project/domain/` | `.daiku/domain/` | you copy its README, and each role's default unless the project already answers that role: see *Step 5* |
| `templates/project/policies/` | `.daiku/policies/` | you copy its README, and write one policy per area the project already keeps rules for: see *Step 5* |
| `templates/project/README.md` | `.daiku/README.md` | you copy it as it is: Daiku's own documentation: see *Step 5* |
| `templates/project/instructions.md` | the instructions file, in the technical root | you **fill it**: see *Step 6* |
| `templates/project/update.mjs` | `.daiku/update.mjs` | you copy it filling its version marker: see *Step 5-bis* |
| `templates/vscode/tasks.json` | `.vscode/tasks.json`, in the technical root | you copy it, or add its task to the file already there: see *Step 5-bis* |

**Everything you write is in English**, whatever language the user chose at *Step 0*. Those two keys say in which language the skills will talk to the user and write commits; they do not say in which language Daiku is made. The skeletons arrive in English and you fill them in English: a half-translated instructions file is the worst of the two forms, and a corpus in a single language is the only thing staying readable when the project changes hands.

**The instructions file is the one exception, and only when it already exists in another language**: then its language is the file's, and you carry the skeleton into it instead. *Step 6* says how — the point of the exception is that the file ends in **one** language, which English headings over an Italian file are not.

The skeletons are read on every run, and **you lay down all the ones you find**, not a list you keep in mind: if the package carries a new one, relaunching you must suffice. Do not keep their content in mind: if the package updates, the content changes under you and it is the new one that must come out.

## Procedure

### 0. Ask the two languages

Only on a `fresh` run (*Scan first*). It is **the only thing you ask**, and you ask it because it is the only thing the repository cannot tell you with certainty: two identical projects may want different languages, and erring here shows in every line the skills will write from now on.

They are two questions, not one, because they are two different audiences (§5.5 of `contracts/project-contract.md`):

1. **the chat language** — answers, summaries, reports and the documents the method produces;
2. **the commit language** — commit messages and changelog entries, that is what remains in the shared history of the repository.

They concern **the future**, not this run: neither changes one line of what you are about to write, which is in English however they answer. Ask them just the same, and before everything else, because they end up in `project.json`.

**Ask bare, with no preamble.** Use `AskUserQuestion` with two questions: `Chat language` — `Which language for chat replies, summaries, reports and method documents?` — and `Commit language` — `Which language for commit messages and changelog entries?` Options in both: Italiano, English. Do not add `Other`: the tool appends it by itself, and listing it again shows it twice. You may mark one option as recommended from what you read (`README.md` and the instructions file for chat, `git log --oneline -30` for commits); the question text stays exactly as above, with nothing added.

If the user does not answer — because you are running inside a chain, or because the session has no interactive channel — **do not invent**: leave the two keys out of `project.json`. §5.5 already declares what happens without them, and a silent default here is worse than their absence.

**From the answer on, you run in one shot**: nothing else is asked.

### 1. Recognise the host

On **Claude Code** hooks and subagents are carried by the package and update themselves: do **not** hook those five hooks a second time from `.claude/settings.json`, because the package already hooks them and every guard would run twice. The only thing you write under `.claude/` is two keys in `settings.local.json`, and they are at *Step 7*: together they turn the host's own memory on and point it inside the repository, and there is no other way to tell the host.

On **Codex** the manifest rejects `agents` and `hooks`, and `plugin_hooks` is a removed feature: that layer must be written inside the project, under `.codex/`. **You do not write it yourself**: it is the trade of `sync-host`, which copies the `.mjs` files, tries them with their bench and hooks only the healthy ones, and which generates `.codex/agents/*.toml` from the package roles. You launch it as your last step (*Step 9*), so the project closes the run with its guardrails and roles in place.

Do not ask the user on which host it runs: you know it from where you are running. The host is the only thing you do **not** ask; the two languages of *Step 0* are the only thing you ask.

### 2. Read the repository before writing

This reading serves two very different things: the parameters of *Step 3*, which are exact values, and the instructions file of *Step 6*, which is the portrait of a project. The second asks much more than the first, and that is why here one reads wide.

Collect, read-only:

- the repository root (`git rev-parse --show-toplevel`) and the position of the technical root inside it;
- **all `.md` files of the repository** — the repository being the one *Input* resolved with `rev-parse --show-toplevel`, not the technical root where the two differ — excluding those under dependency and build directories (`node_modules/`, `venv/`, `target/`, `dist/` and similar). README, technical document, architectural decisions, changelog, notes: it is there the project already wrote of itself, and there is nothing you can deduce in half an hour worth as much as a sentence written by whoever was there. **The width is over the corpus, not over every byte of it**: on dozens of documents you read by titles first — file names and first headings — and open only those carrying a value of *Step 3* or a fact the instructions file of *Step 6* needs;
- **the repository structure in full** — the directory tree, not only the first level. You need it to recognise the areas, to propose `paths.review_state`, and because the form of a project declares its architecture before any document;
- **the technological inventory**: the build manifests present (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml` and similar) with the dependencies and scripts they declare, the lock files for the truly installed versions, and the configuration files of runners, linters, type-checkers, formatters, CI, containers and orchestration. From them you derive languages and versions, package manager, frameworks, databases and storage, build and test chain, and how the thing starts locally — ports included;
- the project instructions file, if any, and every other file the host loads itself;
- **the project's parameter files, whatever they are called**, if the project already ran Daiku or kept a corpus of its own: they are where the five commands and `{worktree.*}` are declared, and *Step 3* reads them;
- **the project's rule and convention files, wherever they live** — area rules (`.claude/rules/`, `.cursor/rules/`, an `adr/` or `docs/architecture/` folder), context documents (`.claude/context/`), a commit convention, a changelog format, a memory contract, whether a file of its own or a section of the instructions file. For each one, its path, its scope (the `paths` its frontmatter declares, or the folders it names) and the question it answers: *Step 5* writes the domain and the policies from them.

**A project file carrying the name of a package file is the project's.** A `project.json`, an
`environment.json`, a `project-contract.md` sitting in the project's tree were written by whoever
works there; they are reconnaissance like any other document. Read them as such, and take from
them only what *Step 3* says they declare: what they assert beyond that is a claim, not a fact.

The limit is only one, and it is where the boundary between reading and guessing passes: **collect what the repository declares of itself.** A `package.json` says which test runner there is, and that you write; it does not say how much that runner covers, and that you do not write. No need to open the application code file by file — you are not doing a review, you are filling in a card — but opening the source of an entry point to understand how a thing starts is legitimate reading, not analysis.

### 3. Write `.daiku/project.json`

Start from the skeleton, **empty it of every value not concerning this project** and refill it key by key with table §4 of `contracts/project-contract.md` under your eyes. Three rules, and they are the same holding all the rest of the method:

- **A command is the exact line to run plus the cwd to run it from.** If in the repository that line is declared nowhere, the key **is not written**. A guessed gate is worse than an absent gate: absent skips a step and declares it, guessed fails a step and looks like a problem of the project.
- **What is not declared does not exist.** A project without frontend has no empty frontend area: it has no key. Valid for `worktree`, for `coverage`, for `tech_doc`, for everything.
- **`memory.root` and `memory.index` are the exception, and they are always written.** They are not the finding of something the repository already has: they are the seat you are assigning to a corpus the method will write anyway, because `update-memory` runs at **every** commit. If the repository already has a memory folder, it is that; if it does not, propose `memory/` at the technical root, with `MEMORY.md` inside. On Claude Code that folder also becomes where the host writes its own memory (*Step 7*), and then proposing it at the technical root is what the step presupposes.
- **`contract` is copied from the skeleton**, you do not invent it and do not increment it.

For areas: the area name is your naming choice, its `paths` are not — they are the real paths belonging to them, usable as Git pathspecs. Declare an area only if it truly has its own gate; two folders passing through the same command are a single area. A command at the workspace root that only calls the areas' gates is no area: it has no gate of its own, and declaring it would run every gate twice, over paths the areas already cover.

The two **language** keys are the exception to the first rule, and only because you asked them: you write them with the answers of *Step 0*, verbatim. If you had no answer, you do not write them.

The two `paths` keys of the method's own documents — the notes on a technology and the working folders — are **not a finding of yours**: §4 of `contracts/project-contract.md` assigns their seat under `.daiku/`, and you write them as they are — `paths.studies` is `.daiku/studies`, `paths.features` is `.daiku/features`. A folder of the project's carrying a similar name is **not** adopted for them: those documents are Daiku's corpus, and seated among the project's files they would be documentation the project never asked for. The skills create the folders at first use, and `project.json` is where the user sees them.

**`paths.review_state` is looked for on a different terrain.** It stands inside the tree but outside version control (§4 of `contracts/project-contract.md`), so *Step 2*'s reading — which takes what the repository versions — does not reach it: look too among the folders **present on disk but ignored by Git**, where a ledger a project already keeps would sit. Where no ignored folder resembles a ledger, propose one inside the tree, excluded from version control and **never under `.daiku/`** — that folder is versioned (§8 of `contracts/project-contract.md`). Its `.gitignore` line, where no line of the repository covers it yet, you write at *Step 8*.

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
  the meaning the same; where it is not, the name stays out, because a value
  put under the wrong key is read as a value and nobody notices. **Where that file and a manifest
  disagree, the project's file wins**: it is a declaration written by whoever knows the project, and
  a command the project already runs is not a claim to verify against a script. **That precedence
  stops at the package's own contract**: where the project's file declares a key the package forbids
  — `backends.<backend>.base_url` on the host's native backend, which §7 of
  `contracts/orchestration.md` wants absent — the contract wins, and you leave the key out. A project's file overrules a manifest, never the form the package fixed. The
  manifest is what you fall back on for the keys that file does not carry. **Precedence chooses
  between two lines; it does not vouch that the one it picks runs.** A line whose tool is declared
  in no dependency manifest or lock file of its area — the module after `-m`, the binary after
  `exec`, the runner called bare — fails on the first skill that runs it, and a key that fails is
  what the first rule of this step forbids: it stays out. The check is on what the repository **declares**, like every other
  read here: a tool listed in `requirements-dev.txt` or `devDependencies` passes, whether or not it
  is installed on this machine. **A file of an older form, or one that
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
  | `coverage` | a declared script producing the measure — `test:coverage`, `coverage`, `cov` — in a manifest, the workspace file, the CI job or the project's parameter files. **It is often declared nowhere**: then it stays out |

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
Where you propose, keep the `<prefix><N>` naming with a small `{worktree.max}` — a proposed seat is
seen in `project.json` and changeable, an omitted one is a delivery without isolation, silently.

When a value is derivable but not certain — a plausible `tech_doc`, a `changelog` that could be the one — either you confirm it with what you read, or you leave it out.

**Create the seat those two keys name.** `{memory.root}` and `{memory.index}` are not a seat the repository already has: they are the seat you are assigning, and creating it is your act. Make `{memory.root}` if it is missing, and inside it `{memory.index}` if it is missing — a title, a line declaring that it is the corpus index, and nothing else. Empty is fine; absent is not, because it is the first file whoever reads that corpus opens. This runs on **both hosts**: the corpus belongs to the method, and `update-memory` writes it at every commit whether or not a host points its own memory at it.

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
user a card half filled for nothing. Only what no file declares stays out: normally a
seat of a machine the repository knows nothing about. What you carry
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
answer on every machine. Write it only where that fallback is wrong.

**`write_roots` you do not write either**: it lists one machine's folders, and it belongs in the
`environment.local.json` the user creates.

If the skeleton still contains values recognisably of another project or another machine, do not propagate them: remove them.

### 5. Write `domain/` and `policies/`

**The README of each skeleton folder** is copied as it is: it is the convention of the folder — how a domain file is named, what a policy file must have in the frontmatter — not merit content.

**Daiku's own documentation** — `templates/project/README.md` — is copied as it is to `.daiku/README.md`, and it is the one file of this step that is not the project's: it says what Daiku is, the commands it offers and where the values live, and it is what whoever asks about Daiku reads to answer. Copied once, it belongs to the user from then on, like every other skeleton.

**A domain or a policy the project already wrote is pointed at, never copied.** The project's own file stays where it is and stays the only place the rule is changed; what you write under `.daiku/` is the address the skills use to reach it. A copy would be a second text of the same rule — translated into English on top (§5.6 of `contracts/project-contract.md`), and drifting from the original at the first edit, with nobody knowing which one holds.

A pointer file is short and always has the same form: the heading of its role or area, one line saying that this project declares that answer in its own files and that they are to be read in full as if written here, and the list of those files — one per line, path relative to the technical root, and the section when the answer is only one section of a larger file (the memory contract inside the instructions file, the commit convention inside a command file).

#### Domain — one file per role

The roles are the rows of the table in `templates/project/domain/README.md`, read on every run. For each role, in this order:

1. **The project already answers it** — a file or a section of *Step 2* answers that role's question (a context document on the changelog format, on the test strategy, on the performance levels; a commit convention; a memory contract): write `.daiku/domain/<role>.md` as a pointer to it. It wins over the package's default, because the default is a proposal made for a project that has none, and two answers to the same question are two writers diverging in the same corpus.
2. **The package carries a default for it** — a file of the same name in `templates/project/domain/`: copy it as it is. From that moment it belongs to the user, and your idempotence guarantees no relaunch ever rewrites it (§5.4 of `contracts/project-contract.md`).
3. **Neither**: nothing is written. The skill asking that question does less and says so (§6).

**Do not invent a domain answer.** A pointer carries what the project wrote, a default what whoever built Daiku wrote: both are declared and both are seen. An answer you compose now from what you glimpsed is a ten-minute impression disguised as a rule, and nobody would ever know how to tell it from the others.

#### Policies — one file per area

For each area of *Step 3*, gather the project's rule files of *Step 2* whose scope falls inside that area's `paths`. Where there is at least one, write `.daiku/policies/<area>.md` as a pointer: its frontmatter carries `paths` — the area's `paths` as patterns covering the area's sources and tests — and its body lists those rule files. No `layers:` and no `hygiene:` block: they would restate a rule in your words, and that is the copy the pointer exists to avoid.

A rule file spanning several areas is listed in the policy of each. A rule file covering the whole project is not an area's: it is an invariant, and *Step 6* makes sure the instructions file cites it. An area with no rule file of its own gets no policy — the finders fall back on the instructions file.

### 5-bis. Write the update task

Daiku updates with two commands — `claude plugin marketplace update daiku`, then `claude plugin update daiku@daiku` — and the project gets them as one VS Code task, `daiku: update`, running a script under `.daiku/`
that shows the version in place and asks before running them.

- **The script**: copy `templates/project/update.mjs` into `.daiku/update.mjs`, **filling the
  marker line it carries at the top** — `daiku:script <version>` — with the `version` of
  `<package root>/.claude-plugin/plugin.json`. Where the file already stands, read that line
  instead of copying: **if it carries the version this package carries, leave the file as it is;
  otherwise rewrite it whole from the skeleton**, marker filled — and that holds where the line is
  not there at all, which is how a script deposited by an earlier Daiku reads. The script is not
  the project's file: it is a package artefact deposited under `.daiku/` so that the package can
  update itself, and the marker is what lets a later package recognise the one on disk as old.
  **Every script `init` deposits carries that marker**, for the same reason; no other file does,
  and no other file is ever rewritten for it.
- **The task**: if `.vscode/tasks.json` does not exist in the technical root, copy `templates/vscode/tasks.json` there as it is. If it exists and already carries a task labelled `daiku: update`, leave it. If it exists without that task, **add** the skeleton's task object as the last element of its `tasks` array, and touch nothing else: the file is JSON with comments, so edit it as text — its comments, its order and its line ending stay as they were. A file with no `tasks` array gets one, beside its `version`.

Both are written on either host: the task belongs to the editor, not to the host you are running on.

### 6. Write the instructions file

It is the file the host loads on every session — `CLAUDE.md` on Claude Code, `AGENTS.md` on Codex — and it goes in the technical root, with the name declared in `{hosts.<host>.instructions_file}` for the host you are running on. Start from `templates/project/instructions.md`, which carries the canonical structure and, inside, two materials not to be confused.

- **The already written prose is a package default**, like `commit-convention.md`: the *Behaviour* and *Git and commits* sections, and the four stock hard rules, hold for anybody working with Daiku and do not depend on this repository. They are copied as they are. Do not rewrite them in your own words: they were written once to be the same everywhere.
- **The placeholders in angle brackets are your work**, and they fill in with what you read at *Step 2* — not with what would make sense.

#### What goes in the placeholders

The *Documentation map* lists the artefacts existing **in this project**, with the trade of each: one line per real artefact, and the line of one missing is removed instead of staying with an invented path inside. **The work-folder line is the exception, and it is not hunted**: it names `{paths.features}`, the seat *Step 3* assigned — the folder appears at the first work folder, and the line is where whoever reads the file has to look. The other artefacts you hunt through the README's links, the root documents and `docs/` — notes folders, queues, technical documents, changelogs — and give each its trade in one line.

The *Stack and local environment* is the technological inventory of *Step 2*, written in full: **one line per package of the workspace** — the folder, its runtime and versions, its framework, its data stores, its build and test chain, how it starts — plus the shared toolchain and the environment variables that must stay consistent. A package the file does not name is a part of the project the file does not declare, and it is the section making the file useful from the first minute. **It is added, not substituted**: where the project already wrote lines in that section, they stay whole and the inventory goes beside them, even where a line of theirs says less than the manifest does. Filling a placeholder never licenses rewriting a line that was there, and the section's title stays the project's. **Beside is not again**: a fact a kept line already states — a port, a start command, a URL — is not repeated in the inventory line of the same package, which carries only what the kept lines do not say (*One rule, one line* holds here too). It is also the only placeholder you can fill in without risking anything, because every line has a manifest behind.

The **hard rules beyond the four standard ones** are the delicate part, and they have a single rule: **write an invariant only where you saw it stated** — in an instructions file already there, in a repository document, or in a rule the structure respects without visible exceptions. **The numbering is the project's, and you never restart it**: where the file you found carried numbered rules, the ones you add take the next free numbers, because the project cites them by number in its own documents and memories, and renumbering makes those citations lie. A project without numbers gets the ones the skeleton proposes. Conventions visible only in history — commit grouping, message prefixes — do not go here: they are `{commit.*}` values and domain answers, already seated elsewhere. An invariant deduced from a glimpsed architecture is a half-hour impression disguised as a rule, and its trouble is that it does not distinguish itself from the others: in six months nobody will ever know which line was observed and which invented, and nobody will trust deleting one. When in doubt you do not write it.

What belongs to this project but holds for **only one of its parts** is not an invariant and does not go there: it is reached through the area's policy of *Step 5*. A project-wide rule file of *Step 5* the file does not cite yet gets one line of yours in the competent section, naming its path — the rule stays in its file, the instructions file only makes it reachable.

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
file states something the repository contradicts, that is not a licence to correct it: the line
stays.

**The line ending is part of the line, not a matter of form.** A kept line keeps the ending it had,
and the file keeps the one it always wrote: recomposing it — CRLF normalised to LF, or the reverse —
rewrites every line and `git diff` shows the whole file as changed, hiding what really moved, which
is the one thing whoever reads the diff needs to see. A file created from scratch takes the ending the
repository uses in majority.

**The other host's file is not yours.** Where the project carries the instructions file of the host
you are **not** running on — `AGENTS.md` while you are on Claude Code — you do not touch it and do
not park it: its key of *Step 4* declares it as it stands, and the file itself is compiled by an
`init` launched there. Read it if it says something about this project worth carrying over; it stays
where it is either way.

**A path or a seat named inside a kept line is part of the line.** Where the project writes that its area rules live in a folder of its own — `.claude/rules/` on Claude Code, or another one — and the skeleton writes `.daiku/policies/`, the project's line stays exactly as it is. The rules the project already wrote stay where they are, and `.daiku/policies/` points at them (*Step 5*). Renaming the project's seat in a line of theirs does not tidy the form: it asserts something untrue, and it loses a rule that was real.

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

If you do not know where to place a line, keep it. A section at the end with what you could not place is better than a lost line.

#### And then you do not touch it again

At the bottom of the skeleton there is a comment line declaring that file passed through here. You
leave it in the file you write, and it is what the next run reads: **if you find it in the
instructions file, that file was already structured — leave it alone**, parked copy included. Only a file without it is read, parked and rewritten.

It is what makes safe this exception to idempotence. A relaunch serves to pick up a skeleton previously missing, not to restructure a file the user meanwhile rewrote by hand — and it is likely it did, because of everything you write it is the file touched most often. Whoever wants restructuring removes that line, or asks you.

**The price is declared.** A section the project already covers in its own words makes the skeleton's
prose fall as a *translated twin* (*You merge, you do not append*), and from then on an improvement
to the skeleton will not enter that project: nothing distinguishes a section already stated from one
not yet stated.

### 6-bis. Recheck every file you wrote

What you just wrote is read by skills and hooks that trust its form: recheck it now, with tools
needing nothing to install — `node -e` and `grep` — before closing:

- for **each `project.json` / `environment.json` you wrote**: it parses, its keys are among those
  `contracts/project-contract.md` §4 (`project.json`) and `contracts/orchestration.md` §7
  (`environment.json`) declare — as mirrored in `schemas/blocks.json` § *params* — and no
  `<...>` placeholder residue remains (hunt it against `templates/`, which is where every
  placeholder comes from). **The one exception is `<FILES>` in `project.json`**: §3 of
  `contracts/project-contract.md` admits it inside a command and it is written there on purpose.
  The residue to hunt is every other `<...>`, not the one placeholder that must stay; and every
  command's tool is declared in a dependency manifest or lock file of its area (*Where each value
  is read*) — `grep` the module or binary name there;
- for **the instructions file**: no `<...>` residue remains;
- for **each pointer of `domain/` and `policies/`** (*Step 5*): every path it lists exists, and a
  policy's frontmatter carries a non-empty `paths`;
- for **`.daiku/update.mjs` and `.vscode/tasks.json`** (*Step 5-bis*): the script's marker line
  carries the `version` of `<package root>/.claude-plugin/plugin.json`, with no `<version>`
  residue left in it, and `.vscode/tasks.json` carries exactly one task labelled `daiku: update`
  running that script.

A file failing the recheck is fixed now, not left as done: a placeholder surviving in a
parameter file degrades every skill silently, which is exactly the failure this step exists to
catch.

### 7. Carry the host memory into the repository — only on Claude Code

On **Codex this step does not exist**: there the agent memory is not made of files but of a database in the user home (`~/.codex/memories_1.sqlite`), built by consolidating past sessions, and there is no key moving its seat. Do not try, and write nothing under `.codex/` for this reason: it is a difference between the two hosts, not something missing from that project. The corpus of `{memory.root}` exists there just the same and `update-memory` writes it at every commit; only the host does not put anything of its own in.

On **Claude Code**, instead, the memory the agent writes itself ends up by default in `~/.claude/projects/<project>/memory/`: outside the repository, invisible in a `git diff`, shared with nobody and lost at the first machine change. Your task is to carry it inside, where it is seen — and committed together with the rest. Two things, in this order:

1. **Move what is already there.** It is the only step of the run reading outside the repository, and the step a sandbox is most likely to deny: if the fence refuses it, **do not look for another way** — leave it undone: it is a step that did not go through (*Step 10*). Look for this project folder under `~/.claude/projects/` — it is named like the absolute path of the technical root with separators reduced to dashes, but do not rebuild it by mind: list that directory and recognise it. If inside there is a `memory/` with files, **move them** into `{memory.root}`. It is the only thing you do outside the repository in the whole run. If a name already exists at destination do not overwrite it: where the two files are identical, the one already in the repository stands and the source is removed; where they differ, the source moves beside it with `-host` before the extension, and gets its line in `{memory.index}` in the form the index already uses. Two different memories called the same are both kept — merging them is a merit judgement, and `update-memory` meets them at the first commit.

2. **Hook the memory**: in `.claude/settings.local.json`, in the technical root, set `autoMemoryEnabled` to `true` and `autoMemoryDirectory` with the **absolute path** of `{memory.root}`, forward slashes. If the file is missing you create it with only those two keys; if it is there, you **add** them without touching anything it already carries. One of the two already there you leave as it is, even if pointing elsewhere: it is a choice of whoever works on this machine, and you do not overturn it.

#### Why those keys go in `settings.local.json` and not in the committed file

It is not a style preference: the pointing belongs to **that one machine**, and `.claude/settings.local.json` is the machine's file — the one nobody clones and nothing carries. A versioned file carrying it would declare one machine's seat as the project's, and the error would show only in silence, on whoever clones.

**Memories are committed, the pointing is not.** Whoever clones the repository on another machine finds the versioned corpus and the host restarting to write in the default, silently. The Daiku skills do not notice, because `{memory.root}` they open by path and find where it was; it is the host going its own way, and stopping reading what the repository knows. The remedy is relaunching `/init` on that machine.

`.claude/settings.local.json` is **not committed** either, and for the same reason: it belongs to that machine. *Step 8* makes sure the repository says so.

### 8. Align the repository's `.gitignore`

What the method needs versioned must be versioned, and what belongs to one machine must stay out — on every clone, not only on this one. So the answer comes from **the repository's own** ignore files: §4 of `contracts/project-contract.md` says which file makes a path covered, and `git check-ignore -v <path>` names it. A path covered only by the machine's global excludes file counts as **uncovered**: a clone carries none of it.

The file you edit is the `.gitignore` at the repository root — the one *Input* resolved with `git rev-parse --show-toplevel`, not a folder's — with every path written relative to that root. If it does not exist, you create it. You edit by addition, and nothing you did not write is removed but for the one case below.

1. **Must stay out**: `.daiku/environment.local.json` under the technical root, `{paths.review_state}`, and on Claude Code `.claude/settings.local.json` under the technical root. Every one of them the repository's ignore files do not cover gets its line, grouped at the bottom of the file under a `# Daiku` comment line.
2. **Must stay in**: `.daiku/` minus its local override, and `{memory.root}`. Where a line of the repository covers one of them, append its negation (`!<path>/`) under the same comment and check again: Git cannot re-include a path whose parent directory is excluded. Where the path is still covered and the covering line names exactly that path, remove that line — the project asked Daiku to version it by opening it, and the two cannot both hold. Where it is still covered by a broader line, leave the file as it is: that folder is a step that did not go through (*Step 10*).

Keep the file's line ending (*If the file already exists* of *Step 6*), and finish with `git check-ignore -v` on every path of the two lists: a path still on the wrong side is a step that did not go through.

### 9. Launch `sync-host` — only on Codex

On **Claude Code this step does not exist**: the package carries its hooks and subagents, and there is nothing to install.

On **Codex** the project has neither guardrails nor subagent roles until `sync-host` writes them under `.codex/`. Delegate it to a subagent on the **worker** role, with `skills/sync-host/SKILL.md` as the contract to read and the technical root as its argument, after every write of yours is done: it reads `.daiku/`, which must already stand. Of its report you keep only the gestures it hands to the user — approving the hooks, trusting the project, reopening the session — because Codex reserves them to a person and no agent can make them.

### 10. Report

Run the scan of *Scan first* once more before answering, on every run: an empty `missing` is what
the closing line means, and each entry it still lists is a step that did not go through.

**When every step went through, your whole answer is one line saying the project is all set**, in
`{language.chat}` — `You're all set.` in English, `Tutto pronto.` in Italian. On a `fresh` run the
language is the answer of *Step 0*; with no answer, the one the user wrote to you in (§5.5 of
`contracts/project-contract.md`). Nothing before it and nothing after it: no preamble, no line naming who it is written for, no list of what
you wrote or read, no question, no offer to continue.

Everything else stays out, because somebody already carries it: what you wrote and parked is in
`git status` and `git diff`; what the repository does not declare, the skills handle on their own
(§6 of `contracts/project-contract.md`); how you worked — what you read, a command a fence refused
and the way you took instead — concerns nobody.

Two things only are written, one line per item, in `{language.chat}`:

- **A step that did not go through** — a write denied or failed, a move refused, a folder still on
  the wrong side of `.gitignore` after *Step 8*: the file, and what it still lacks. The project is
  then not all set, and the closing line is **not** written.
- **On Codex, the gestures `sync-host` hands to the user** (*Step 9*): they go above the closing line,
  because without them no guardrail is active and only a person can make them.

## Idempotence

**You do not overwrite an existing file**, except the three exceptions at the bottom. Neither `project.json`, nor the READMEs, nor anything you find under `.daiku/` — `environment.json` included, whose values a person chose and which you leave exactly where they are.

This makes you relaunchable: when the package updates and carries a skeleton previously missing, you are relaunched and write only the missing piece. An already initialised project loses nothing.

**And it is what makes safe letting the domain defaults travel.** A skeleton like `commit-convention.md` arrives already written, but it arrives **only once**: if the user rewrote it, a relaunch sees it and leaves it alone. Without this rule the default would stop being a proposal and become a package rule returning at every update — which is exactly the thing the Domain level exists not to be.

**Adding a key is not overwriting a file.** The `.vscode/tasks.json` of *Step 5-bis*, the `settings.local.json` of *Step 7* and the `.gitignore` of *Step 8* are the only files you touch without having written them yourself, and you touch them by addition: the keys and lines you find there stay as they were, including the ones concerning you if already there — the one line *Step 8* may remove is the one excluding, by name, a folder the method versions. A relaunch on a new machine writes the pointing missing there, and on a machine where it is there changes nothing — which is exactly the trade for which you are relaunched.

The exceptions are three, and none loosens the rule.

The first is the **versioned script** of *Step 5-bis*: where its marker does not carry the version of this package, you rewrite the file whole. It is the only thing you deposit that stays the package's — an artefact the package updates itself through — and the marker is what keeps the rule readable: a script carrying the version of this package is a script you leave alone like any other.

The second is the **instructions file**, which you write also where one exists — parking the one you found under `.old` — but only once, and what guarantees it is at *Step 6*: the comment line you leave inside the new one. Without that line it would not be an exception but a hole, because every relaunch would return to restructuring the file the user curates more than any other. It is the only file of the project's you are allowed to rewrite, and it is so because it is the one on many repositories already existing: leaving it as it was would mean, there, never writing it.

The third is the **explicit request** of the user on a precise file: then you rewrite it.

## What you do not do

- **You ask nothing beyond the two languages.** No other question, no confirmation, no proposal waiting for a yes: what the repository declares you write, what it does not stays out.
- **You do not touch the code**, ever, for any reason — dependency manifests included: a command whose tool no manifest declares stays out, it is not made to run by adding the tool.
- **You do not create a Git repository**, you do not commit and do not stage what you wrote: whoever launched `init` watches what appeared before versioning it.
- **You do not compose rules.** A domain answer or an area policy you write points at what the project already wrote (*Step 5*); where the project wrote nothing, nothing is written in its place.
- **You install nothing** and do not modify the host configuration outside the two keys of *Step 7*, which are the entire licence you have on `.claude/`.
