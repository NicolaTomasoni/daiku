---
name: 'init'
description: 'Opens Daiku on a project not having it yet: writes `.daiku/` — `project.json`, `domain/`, `policies/` — the owner `environment.json` and the project instructions file, starting from the package skeletons and filling them with what it reads in the repository. Idempotent: it never overwrites an existing file. It launches once per project, and again when the package carries a new skeleton.'
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
- If the exit code is not `0`, stop here with exactly these two lines and nothing else: `Cannot initialise Daiku here: <technical root> is not inside a Git repository.` on the first line, `Not written: nothing was written.` on the second. No check line, no `fatal:` output, no how-to-`git init`, no relaunch instructions: you do not initialise a repository in place of the user.
- If `.daiku/` already exists, it is not an error: continue in **completion** mode (see *Idempotence*).

## Where the skeletons stand

Under `templates/`, at the package root — the folder containing `skills/`, `contracts/` and `templates/`, two levels above this file. It is a path **relative to the package**, not to the project: it holds on both hosts, while an environment path variable exists only on one of the two.

| Skeleton | Where you write it | What you do with it |
|---|---|---|
| `templates/project/project.json` | `.daiku/project.json` | you **fill it in**: see *Step 3* |
| `templates/project/domain/` | `.daiku/domain/` | you copy **all** its files as they are: see *Step 5* |
| `templates/project/policies/` | `.daiku/policies/` | you copy **all** its files as they are: see *Step 5* |
| `templates/project/instructions.md` | the instructions file, in the technical root | you **fill it**: see *Step 6* |
| `templates/owner/environment.json` | `~/.daiku/environment.json` | you **empty and refill it**: see *Step 4* |

**Everything you write is in English**, whatever language the user chose at *Step 0*. Those two keys say in which language the skills will talk to the user and write commits; they do not say in which language Daiku is made. The skeletons arrive in English and you fill them in English: a half-translated instructions file is the worst of the two forms, and a corpus in a single language is the only thing staying readable when the project changes hands.

The skeletons are read on every run, and **you copy all the ones you find**, not a list you keep in mind: if the package carries a new one, relaunching you must suffice. Do not keep their content in mind: if the package updates, the content changes under you and it is the new one that must come out.

## Procedure

### 0. Ask the two languages

It is **the only thing you ask**, and you ask it because it is the only thing the repository cannot tell you with certainty: two identical projects may want different languages, and erring here shows in every line the skills will write from now on.

They are two questions, not one, because they are two different audiences (§5.5 of `contracts/project-contract.md`):

1. **the chat language** — answers, summaries, reports and the documents the method produces;
2. **the commit language** — commit messages and changelog entries, that is what remains in the shared history of the repository.

They concern **the future**, not this run: neither changes one line of what you are about to write, which is in English however they answer. Ask them just the same, and before everything else, because they end up in `project.json` and because the report you close with is the first text they apply to.

**Ask bare, with no preamble.** Use `AskUserQuestion` with two questions: `Chat language` — `Which language for chat replies, summaries, reports and method documents?` — and `Commit language` — `Which language for commit messages and changelog entries?` Options in both: Italiano, English, Other. You may mark one option as recommended from what you read (`README.md` and the instructions file for chat, `git log --oneline -30` for commits), but do not write why: no observed sources, no empty-repo explanation, no note about which `.md` files are not source. The question text stays as above, nothing else.

If the user does not answer — because you are running inside a chain, or because the session has no interactive channel — **do not invent**: leave the two keys out of `project.json` and list them among the things to fill in. §5.5 already declares what happens without them, and a silent default here is worse than their absence.

### 1. Recognise the host

On **Claude Code** hooks and subagents are carried by the package and update themselves: do **not** hook those three hooks a second time from `.claude/settings.json`, because the package already hooks them and every guard would run twice. The only thing you write under `.claude/` is a single key in `settings.local.json`, and it is at *Step 7*: it serves to carry the host memory inside the repository, and there is no other way to tell the host.

On **Codex** the manifest rejects `agents` and `hooks`, and `plugin_hooks` is a removed feature: that layer must be written inside the project, under `.codex/`. **You do not write it**: it is the trade of `sync-host`, which copies the `.mjs` files, tries them with their bench and hooks only the healthy ones, and which generates `.codex/agents/*.toml` from the package roles. Close the report saying to launch it — until it runs, that project has neither guardrails nor subagent roles.

Do not ask the user on which host it runs: you know it from where you are running. The host is the only thing you do **not** ask; the two languages of *Step 0* are the only thing you ask.

### 2. Read the repository before writing

This reading serves two very different things: the parameters of *Step 3*, which are exact values, and the instructions file of *Step 6*, which is the portrait of a project. The second asks much more than the first, and that is why here one reads wide.

Collect, read-only:

- the repository root (`git rev-parse --show-toplevel`) and the position of the technical root inside it;
- **all `.md` files of the repository**, excluding those under dependency and build directories (`node_modules/`, `venv/`, `target/`, `dist/` and similar). README, technical document, architectural decisions, changelog, notes: it is there the project already wrote of itself, and there is nothing you can deduce in half an hour worth as much as a sentence written by whoever was there;
- **the repository structure in full** — the directory tree, not only the first level. You need it to recognise the areas, to propose the `paths`, and because the form of a project declares its architecture before any document;
- **the technological inventory**: the build manifests present (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml` and similar) with the dependencies and scripts they declare, the lock files for the truly installed versions, and the configuration files of runners, linters, type-checkers, formatters, CI, containers and orchestration. From them you derive languages and versions, package manager, frameworks, databases and storage, build and test chain, and how the thing starts locally — ports included;
- the project instructions file, if any, and every other file the host loads itself.

The limit is only one, and it is where the boundary between reading and guessing passes: **collect what the repository declares of itself.** A `package.json` says which test runner there is, and that you write; it does not say how much that runner covers, and that you do not write. No need to open the application code file by file — you are not doing a review, you are filling in a card — but opening the source of an entry point to understand how a thing starts is legitimate reading, not analysis.

### 3. Write `.daiku/project.json`

Start from the skeleton, **empty it of every value not concerning this project** and refill it key by key with table §4 of `contracts/project-contract.md` under your eyes. Three rules, and they are the same holding all the rest of the method:

- **A command is the exact line to run plus the cwd to run it from.** If in the repository that line is declared nowhere, the key **is not written**. A guessed gate is worse than an absent gate: absent skips a step and declares it, guessed fails a step and looks like a problem of the project.
- **What is not declared does not exist.** A project without frontend has no empty frontend area: it has no key. Valid for `worktree`, for `coverage`, for `tech_doc`, for everything.
- **`memory.root` and `memory.index` are the exception, and they are always written.** They are not the finding of something the repository already has: they are the seat you are assigning to a corpus the method will write anyway, because `update-memory` runs at **every** commit. If the repository already has a memory folder, it is that; if it does not, propose `.daiku/memory/` with `MEMORY.md` inside, and say so in the report. On Claude Code that folder also becomes where the host writes its own memory (*Step 7*), and then declaring it is no longer a choice: it is the presupposition of the step.
- **`contract` is copied from the skeleton**, you do not invent it and do not increment it.

For areas: the area name is your naming choice, its `paths` are not — they are the real paths belonging to them, usable as Git pathspecs. Declare an area only if it truly has its own gate; two folders passing through the same command are a single area.

The two **language** keys are the exception to the first rule, and only because you asked them: you write them with the answers of *Step 0*, verbatim. If you had no answer, you do not write them.

The three `paths` keys — where the work folders, notes and review ledger live — you **propose** by watching what the repository already has: an existing studies folder is worth more than an invented name. If there is nothing similar, choose yourself a path coherent with the structure in front of you and **say so in the report**, because those folders the skills will create at first use and the user should know where.

When a value is derivable but not certain — a plausible `tech_doc`, a `changelog` that could be the one — **do not write it secretly**: either you confirm it with what you read, or you leave it out and list it in the report among the things to fill in.

### 4. Write `~/.daiku/environment.json` if missing

It is the **owner** file, not the project one: default host, model per role, available backends, machine paths. It changes from person to person and from machine to machine, not from project to project — and for this it **does not stand in the project**: it stands in the home, only one per machine, and holds for all projects the owner works on.

Look in the two seats §8 of `contracts/project-contract.md` declares, in its order: first `.daiku/environment.json` in the technical root, then `~/.daiku/environment.json`. **If you find one, do not touch it**: it is the thing least belonging to you of all, and a project override somebody wrote on purpose is respected like the home file.

If there is neither one nor the other, write the one in the **home** — never the project one, which is an exception and the user chooses it. Start from the skeleton emptied of every alien value — no base URL of another owner, no `temp_dir` of another machine — keeping only the form, `contract`, and the host you are running from as `default_host`. The rest is filled in by the user.

**"Alien" means of another person or another machine, not "already written".** The tier aliases the skeleton carries filled in, and the configuration paths of a host, hold for anybody: those stay. What identifies somebody is removed.

Declare in the report the **absolute path** of what you wrote: it stands outside the repository, it will not see it in the diff, and until it fills it in no step knows with which model to run.

If the skeleton still contains values recognisably of another project or another machine, do not propagate them: remove them and report it in the report.

### 5. Create `domain/` and `policies/`

Copy **all** files of each skeleton, without modifying them: `templates/project/domain/` into `.daiku/domain/`, `templates/project/policies/` into `.daiku/policies/`. They are the only two folders born not empty, and the only two things you lay down without writing a line.

Inside there are two different things, and distinguishing them is worth it:

- **The README of each** is the convention of the folder: how a domain file is named, what a policy file must have in the frontmatter. It is not merit content.
- **The already written domain skeletons** — today `commit-convention.md`, tomorrow perhaps others — are **defaults**, not package rules. You lay them down and it ends there: from that moment they belong to the user, and your idempotence guarantees no relaunch ever rewrites them (§5.4 of `contracts/project-contract.md`).

**Do not invent a domain file the package does not carry**, and do not deduce policies from the architecture you glimpsed. A default written by whoever built Daiku is a declared proposal, which is seen and changed; a file you write now is your ten-minute impression disguised as a rule, and nobody would ever know how to distinguish the two things.

### 6. Write the instructions file

It is the file the host loads on every session — `CLAUDE.md` on Claude Code, `AGENTS.md` on Codex — and it goes in the technical root, with the name you declared in `instructions_file`. Start from `templates/project/instructions.md`, which carries the canonical structure and, inside, two materials not to be confused.

- **The already written prose is a package default**, like `commit-convention.md`: the *Behaviour* and *Git and commits* sections, and the four stock hard rules, hold for anybody working with Daiku and do not depend on this repository. They are copied as they are. Do not rewrite them in your own words: they were written once to be the same everywhere.
- **The placeholders in angle brackets are your work**, and they fill in with what you read at *Step 2* — not with what would make sense.

#### What goes in the placeholders

The *Documentation map* lists the artefacts existing **in this project**, with the trade of each: one line per real artefact, and the line of one missing is removed instead of staying with an invented path inside.

The *Stack and local environment* is the technological inventory of *Step 2*, written in full. It is the section making that file useful from the first minute, and it is also the only one you can fill in without risking anything, because every line has a manifest behind.

The **hard rules beyond the four standard ones** are the delicate part, and they have a single rule: **write an invariant only where you saw it stated** — in an instructions file already there, in a repository document, or in a rule the structure respects without visible exceptions. An invariant deduced from a glimpsed architecture is a half-hour impression disguised as a rule, and its trouble is that it does not distinguish itself from the others: in six months nobody will ever know which line was observed and which invented, and nobody will trust deleting one. When in doubt you do not write it and you list it among the things to fill in.

What belongs to this project but holds for **only one of its parts** is not an invariant and does not go there: it goes in a `.daiku/policies/` file, which however **you do not write**. You leave it among the things to fill in, with the convention already laid at *Step 5* saying how it is done.

#### If the file already exists

You **rewrite** it, only once, after having read it all.

What was inside is the best source you have: it carries true invariants, taken decisions and motivations no manifest declares. **Everything substantive is kept, and it is kept verbatim** — moved into the competent canonical section, never summarised: a rule rewritten tighter is a changed rule, and changing it is not your task. Only matters of form are discarded: a different section order, repetitions, and the indications the package now carries.

If you do not know where to place a line, keep it. A section at the end with what you could not place is better than a lost line, and in the report you declare it.

#### And then you do not touch it again

At the bottom of the skeleton there is a comment line declaring that file passed through here. **If you find it, the file was already structured: leave it alone** and list it among the things left as they were.

It is what makes safe this exception to idempotence. A relaunch serves to pick up a skeleton previously missing, not to restructure a file the user meanwhile rewrote by hand — and it is likely it did, because of everything you write it is the file touched most often. Whoever wants restructuring removes that line, or asks you.

### 7. Carry the host memory into the repository — only on Claude Code

On **Codex this step does not exist**, and not because nobody got there yet: there the agent memory is not made of files but of a database in the user home (`~/.codex/memories_1.sqlite`), built by consolidating past sessions, and there is no key moving its seat. Do not try, write nothing under `.codex/` for this reason, and do not report it as something missing from that project: it is a difference between the two hosts. The corpus of `{memory.root}` exists there just the same and `update-memory` writes it at every commit; only the host does not put anything of its own in.

On **Claude Code**, instead, the memory the agent writes itself ends up by default in `~/.claude/projects/<project>/memory/`: outside the repository, invisible in a `git diff`, shared with nobody and lost at the first machine change. Your task is to carry it inside, where it is seen — and committed together with the rest, except when it stands under `.daiku/` (point 5). Five things, in this order:

1. **Create the folder** `{memory.root}` if missing, and inside `{memory.index}` if missing: a title, a line declaring that it is the corpus index, and nothing else. Empty is fine; absent is not, because it is the first file whoever reads that corpus opens.

2. **Move what is already there.** Look for this project folder under `~/.claude/projects/` — it is named like the absolute path of the technical root with separators reduced to dashes, but do not rebuild it by mind: list that directory and recognise it. If inside there is a `memory/` with files, **move them** into `{memory.root}`. It is the only thing you do outside the repository in the whole run, and that is why in the report you declare it file by file. If a name already exists at destination do not overwrite it: leave the original where it is and put it among the things to fill in, because they are two different memories called the same and merging them is a merit judgement, not an opening job.

3. **Hook the memory**: in `.claude/settings.local.json`, in the technical root, set `autoMemoryEnabled` to `true` and `autoMemoryDirectory` with the **absolute path** of `{memory.root}`, forward slashes. If the file is missing you create it with only those two keys; if it is there, you **add** them without touching anything it already carries. One of the two already there you leave as it is, even if pointing elsewhere: it is a choice of whoever works on this machine, and you do not overturn it — you only flag it.

4. **Verify it is truly committable**: open `.gitignore` and check no rule excludes `{memory.root}`. If one excludes it **do not touch `.gitignore`**: say so in the report. That line somebody wrote on purpose, and removing it is theirs to decide.

5. **Keep `.daiku/` out of git.** Nothing standing under `.daiku/` is ever committed: the repository belongs to the client and sees nothing of the method, Daiku is secret. If `.gitignore` does not exclude `.daiku/`, **do not add it yourself** — this step does not touch `.gitignore` — but put it among the things to fill in, in one line. If `{memory.root}` stands under `.daiku/`, the corpus stays local by consequence: say so in the report in one line, because whoever expected versioned memory must know it.

#### Why that key goes in `settings.local.json` and not in the committed file

It is not a style preference: Claude Code **ignores** `autoMemoryDirectory` when finding it in a versioned `.claude/settings.json`. It is a host defence — a cloned repository must not be able to divert where the agent writes — and it holds also when the repository is one's own.

The consequence is told to the user, not hidden: **memories are committed, the pointing is not.** Whoever clones the repository on another machine finds the versioned corpus and the host restarting to write in the default, silently. The Daiku skills do not notice, because `{memory.root}` they open by path and find where it was; it is the host going its own way, and stopping reading what the repository knows. The remedy is relaunching `/init` on that machine, and *Step 8* writes it in black and white.

For the same reason `.claude/settings.local.json` is **not committed**. If `.gitignore` does not already exclude it, put it among the things to fill in: of everything you write it is the only file having to stay outside the repository, and it is the exact contrary of all the rest.

### 8. Report

Close with the list, in three blocks, without embellishments:

- **Written** — every created file, with its path.
- **Left as it was** — every file already existing and which you did not touch.
- **To fill in** — every key you could not declare, with in one line *why* you did not declare it. This block is the most important of the three: it is the only place where the user discovers that a skill, on this project, will do less.

If the host layer was not written (see *Step 1*), say so here.

On **memory** dedicate two fixed lines, because *Step 7* does a thing seen nowhere: which files you moved inside the repository and from where, and — if you ran on Claude Code — that the pointing in `.claude/settings.local.json` **holds on this machine only**, and that on a clone memory returns to the default until somebody relaunches `/init` there. On Codex a single line: the host memory does not move, the repository corpus is there anyway.

If you **rewrote an existing instructions file**, dedicate two separate lines to it: what you kept, what you removed because it was form, and where what you could not place ended up. It is the most invasive thing you do in the whole run, and it is the only one the user must be able to watch immediately — `git diff` tells them that everything changed, it does not tell them what was saved.

## Idempotence

**You do not overwrite an existing file**, except the two exceptions at the bottom. Neither `project.json`, nor the READMEs, nor anything you find under `.daiku/` — and it holds also for `~/.daiku/environment.json`, which is of home and not of this project. If it is there, you leave it and list it among the things left as they were.

This makes you relaunchable: when the package updates and carries a skeleton previously missing, you are relaunched and write only the missing piece. An already initialised project loses nothing.

**And it is what makes safe letting the domain defaults travel.** A skeleton like `commit-convention.md` arrives already written, but it arrives **only once**: if the user rewrote it, a relaunch sees it and leaves it alone. Without this rule the default would stop being a proposal and become a package rule returning at every update — which is exactly the thing the Domain level exists not to be.

**Adding a key is not overwriting a file.** The `settings.local.json` of *Step 7* is the only file you touch without having written it yourself, and you touch it by addition: the keys you find there stay as they were, including the two concerning you if already there. A relaunch on a new machine writes the pointing missing there, and on a machine where it is there changes nothing — which is exactly the trade for which you are relaunched.

The exceptions are two, and neither loosens the rule.

The first is the **instructions file**, which you rewrite also where it exists — but only once, and what guarantees it is at *Step 6*: the comment line you leave inside it. Without that line it would not be an exception but a hole, because every relaunch would return to restructuring the file the user curates more than any other. It is the only already-written thing you are allowed to overwrite, and it is so because it is the only one on many repositories already existing: leaving it as it was would mean, there, never writing it.

The second is the **explicit request** of the user on a precise file: then you rewrite it, and in the report you declare what was there before.

## What you do not do

- **You do not touch the code**, ever, for any reason.
- **You do not create a Git repository**, you do not commit and do not stage what you wrote: whoever launched `init` watches what appeared before versioning it.
- **You do not write the area policies.** The instructions file you write, because its structure is the same everywhere and what belongs to this project you read; an area policy is instead an architectural judgement on only one part, and that is written by whoever knows the project. You lay the convention and list it among the things to fill in.
- **You install nothing** and do not modify the host configuration outside the two keys of *Step 7*, which are the entire licence you have on `.claude/`.
- **You do not touch `.gitignore`**, neither to bring memory into the repository nor to take `settings.local.json` out of it: you watch how it is and declare it.
