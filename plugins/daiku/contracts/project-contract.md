# Project parameters — single contract

This file is the **single point of change** for how a skill derives the specific values of the
project it runs on. The skills in `skills/` say *what* is to be done and *in what order*;
`.daiku/project.json` says *with which values*; the files in `.daiku/domain/` carry the local
domain and judgement.

The criterion holding everything together is a single one: **a skill's file is byte-identical in every
project**. Any specific value written inside a skill destroys that atomicity and must be
moved a level down. If you find yourself customising a skill, the right place is below.

`contracts/orchestration.md` remains the contract of *who* runs a step and how it is delegated: it is
orthogonal to this file and does not touch it. The values it consumes do not live here but in
`environment.json`, the second parameter level: where that file lives, and where the boundary
between the two passes, is in §8.

## 1. The four levels

| Level | Location | Contains | Ships with the skill |
|---|---|---|---|
| **Method** | `skills/**` | what is to be done, in what order, with which constraints | yes, byte-identical |
| **Environment** | `.daiku/environment.json` | host, model per role, backend, machine paths | yes, as a **skeleton to be overwritten** (§8) |
| **Parameters** | `.daiku/project.json` | paths, literal commands, file names, existing areas | no, one per project |
| **Domain** | `.daiku/domain/*.md` | lists, taxonomies, local judgement criteria | yes, as a **skeleton to be overwritten** (§5.4) |

## 2. What may live in `project.json`

Only what a skill **substitutes inside a sentence**: a path, a literal command, the name
of a file, the presence or absence of an area. Three prohibitions, in order of severity:

- **No descriptions in place of commands.** A command is the exact string to run plus the
  cwd to run it from. "The backend's gate" is not a value; the line running it is. A
  skill receiving a description instead of a command goes vague, and this is the main
  way parameterisation can worsen the result instead of preserving it.
- **No key requiring an explanation to be understood.** If using a value requires knowing
  *why* it exists, that is domain knowledge and belongs in `.daiku/domain/`.
- **No duplication of `{hosts.<host>.instructions_file}` or `.daiku/policies/`.** The JSON holds no invariants,
  layer boundaries, style conventions or architectural criteria: they already have their home, and the
  skill reads them from there. It is how this file stops being a parameter file.

## 3. Form conventions

- **Every path is relative to the technical root** (the directory the skills run from), except
  `repo_root` which is absolute. Separators are `/`: they work in both PowerShell and POSIX
  shells, and the paths Git returns already have that form. Those pointing **outside** the
  technical root climb it with `../`, and Git accepts them in that form both as pathspecs and
  as `git add` arguments: use them as they are, without rewriting them.
- **Every command is a `{ "cwd": <path>, "run": [<line>, …] }` object**: the `run` lines
  run in order, each from the declared cwd. A line is a string executable as
  it is, not a template to complete.
- **`<FILES>` placeholder**: if a `run` line contains it, the skill replaces it with
  the list of files it is working on, separated by spaces. It is the only placeholder allowed
  inside a command.
- **An area is a part of the project with its own gate.** The area's name is its key
  under `areas`; a skill iterates over the declared ones and knows no area names a priori.

## 4. The keys

| Key | Purpose |
|---|---|
| `contract` | integer of this file's form (see §7) |
| `name` | project name, as it appears in user-facing texts |
| `repo_root` | absolute path of the repository root |
| `code_root` | application code root, with trailing slash; it is also the Git pathspec delimiting every code perimeter |
| `language.chat` | language of what is written for a person: chat replies, summaries, reports and the method's documents (§5.5) |
| `language.commit` | language of what ends up in the repository's history: commit messages and changelog entries (§5.5) |
| `documents` | the group of the founding documents, one entry per role — the roles are `product`, `brand`, `domain`, `stack`, `architecture`, fixed by the method |
| `documents.<role>` | path, relative to the technical root, of the founding document answering that role; absent if the project declares none |
| `changelog` | path of the released-versions log |
| `version.file` | file carrying the application's canonical version |
| `version.field` | exact spot in the file where that version lives |
| `version.replicated_in` | other files carrying the same version and updated together; empty or absent list if there are none |
| `paths.studies` | folder of the notes on a studied technology, one file per technology; it stands **under `.daiku/`**, like the key below it |
| `paths.features` | folder hosting the working folders, one per problem, with the method's numbered files inside — and, beside them, the feature catalogue: one folder per feature, one file per study contributing to it; under `.daiku/` |
| `paths.review_state` | folder of the run's out-of-version-control state: a review's ledger, and the worktree pool's registry (`worktree-pool.json`, written by `architect/pool.mjs`); it stands **inside the repository tree**, under the technical root, but **outside version control** — a `.gitignore` line excludes it — and it is **never under `.daiku/`**, which is versioned (§8); stable, not session-scoped |
| `memory.root` | root of the persistent memory corpus, inside the repository (§8); on Claude Code it is also the folder where the host writes its own memory (§4.2) |
| `memory.index` | index file of the corpus, the one read first |
| `commit.memory_prefix` | prefix of the memory-and-documentation commit message |
| `worktree.pool` | delivery-worktree pool directory, relative to the technical root |
| `worktree.prefix` | prefix of the pool worktrees' names, followed by the number (`1`..`worktree.max`) |
| `worktree.max` | maximum number of pool worktrees: never one more, never an off-convention name |
| `worktree.branch_prefix` | branch prefix of each worktree, followed by its name |
| `areas` | the set of declared areas; cited thus when a skill **enumerates** them instead of naming one (§5.3) |
| `areas.<area>.paths` | the paths belonging to the area, each usable as a Git pathspec |
| `areas.<area>.gate` | the area's gate command: lint, format, type-check, test and package build |
| `areas.<area>.check_fast` | command checking the given files without writing anything and without running tests — compilation, type-check or lint in read-only mode — fast enough to run after every task and every applied fix |
| `areas.<area>.lint_fix` | command applying only safe lint fixes to the given files |
| `areas.<area>.test_targeted` | command running only the given tests |
| `areas.<area>.coverage` | commands producing the area's coverage measure |

No key is mandatory besides `contract`: everything else is subject to §6.

**The two keys of the method's own documents — `paths.studies` and `paths.features` — stand under
`.daiku/`.** What they host is Daiku's corpus and not the project's documentation: `0. problem.md`,
`1. decision-doc.md`, the notes and the catalogue are written by the method, read by the method, and
seated among the project's own files they would be a second documentation tree that nobody chose and
that the project is expected to keep. `.daiku/` is versioned (§8), so they enter the history like any
other source file, and `init` **assigns** those two seats rather than adopting a folder the project
already keeps.

**Which file covers a path that stays out of version control.** `paths.review_state`
stands outside what Git versions, and "is this path ignored?" is answered by the repository's own
`.gitignore`: a **machine's global excludes file** (`core.excludesFile`) covers a path for that
machine alone and is never the project's line, so a clone carries none of it.
`git check-ignore -v <path>` names the file that covers it, and that is what `init` and `review`
run before declaring a path covered or uncovered.

### 4.1 The key a hook reads

The command guard reads one key, `worktree.pool`, which lights its worktree branch: a declared pool
*is* the declaration that those directories belong to Daiku. The guard's other four branches
(junction, `--no-verify`, push, agent attribution) deny on
every project that opened Daiku, with no switch. `hooks/README.md` carries the full branch table.

### 4.2 The key the host reads

`memory.root` has a second reader that is neither a skill nor a hook: it is **the host**, on Claude
Code, where the memory the agent writes for itself is a folder of files and its location is declared
with `autoMemoryDirectory`. `init` points it there, and from that moment that corpus has two writers
— the host on its own initiative, `update-memory` on every commit's diff — and a single location,
**versioned together with the code**. It is why this folder sits inside the repository and not
beside it: a memory that does not enter a diff is re-read by nobody, corrected by nobody and dies
with the laptop it was born on.

Two consequences, and neither is an installation detail.

**The pointing is not committed.** That key lives in `.claude/settings.local.json`, which belongs
to that machine and stays out of the repository: a versioned file carrying it would declare one
machine's seat as the project's, and the error would show only in silence, on whoever clones. The
memory files are committed; the line telling the host to write them there is not. On a clone the memory falls back to the default **silently**, and no skill notices:
`{memory.root}` is opened by path and found where it was. The remedy is to re-run `/init`
on that machine.

**On Codex there is nothing to declare.** There the agent's memory is not made of files but of a
database in the home directory (`~/.codex/memories_1.sqlite`), consolidated from past sessions, and there is no
key moving its location. `memory.root` remains the method's corpus, written by the
skills and readable by anyone: it loses the second writer, not the job.

It is also why `memory.root` and `memory.index` are the only keys `init` **always**
writes, even on a project that had no corpus. §6 applies to everything else: here
the folder is not detected, it is assigned.

## 5. How a skill consumes it

### 5.1 The opening line — one only, identical in every parameterised skill

It goes at the top of the skill's body, right after the paragraph declaring its job, and is
copied verbatim:

```markdown
> **Parameters.** Every key in braces in this contract resolves on the project parameter
> files, never from memory and never by assumption: the rules are in §5 of
> `contracts/project-contract.md`, which also says **in which language to write** and what to do
> when a key is missing.
```

**It is one line, not a restatement of this section,** because identical copies in every skill
diverge at the first change: a reference reaches the rules without duplicating them. Whoever reads the skill opens one more file; whoever changes the rule opens only one.

**Which of the two files a key resolves from** need not be said by the skill:

- a path appearing in the §4 table → `.daiku/project.json`;
- a path appearing in §7 of `contracts/orchestration.md` — `hosts`, `backends`,
  `default_host`, `temp_dir`, `write_roots` → `environment.json`, whose §8 says where to look.

No key lives in both (§8), so the cited path is enough to say where to look.

**What to do when the key is missing** is §6, and applies without the skill repeating it: that thing
does not exist in this project or in this environment — skip the part using it, declare it
in the outcome, do not invent it and do not ask for it.

### 5.2 Citing a key in prose

It is cited with the **dotted path from the JSON root, in braces, inside a code span**:
`` `{code_root}` ``, `` `{version.file}` ``, `` `{areas.<area>.gate}` ``. In an area, `<area>` is
the name of the area being iterated over.

The form applies **only** inside a code span: bare braces in plain prose, or inside a skill-output
JSON example, are not citations. The cited path must exist in the §4 table: if
a value is needed that is not there, add the key here — do not write the value into the skill.

A sentence with a key reads as if the value were already inside:

> Compute the scope with `git diff <BASE> -- {code_root}`, then run `{areas.<area>.gate}`.

### 5.3 A part applying only to certain areas

**The normal form is iteration, not the conditional section.** A skill knows no area
names: it enumerates them from `{areas}`, filters on `{areas.<area>.paths}` and works on those that
remain. Thus the same sentence covers a single-area project and a five-area one:

> For each area declared in `{areas}` touched by the perimeter, run `{areas.<area>.gate}` and
> report the commands' real outcome. An area untouched by the perimeter is not run.

When a part truly depends on a **key's existence** and cannot be written by
iteration, open the section with a guard, first line, in bold:

> **Applies only if `{areas.<area>.coverage}` is declared.**

The guard does not explain what to do if the key is missing: the §5.1 block already says it, once for
the whole skill. Naming a specific area inside a skill is instead an exception to justify:
an area's name is a value, and a value inside a skill breaks atomicity.

### 5.4 Referring to a domain file

A domain file is found by **role**, with the `.daiku/domain/<role>.md` convention. The
skill declares **which question that file answers**, never the answer: if it writes what it will
find there, it has reported back inside itself the domain it was moving out.

Form:

> Read `.daiku/domain/<role>.md`: it carries <the question it answers>. If it does not exist,
> <behaviour without it>, and declare it in the outcome.

For example, a coverage skill writes "it carries this project's macrocategories and from which
strength each layer is tested", not the macrocategories' list.

#### A role may travel with a pre-written skeleton

The package **may** carry a default domain file, under
`templates/project/domain/<role>.md`. `init` deposits it in `.daiku/domain/<role>.md`
the first time and **never touches it again**: from then on it belongs to the user, who rewrites it as they
please without any update taking it away. Where the project already answers that role in a file of
its own, `init` writes there a pointer to that file instead of the default: the project's answer
wins, and its single text stays the one that is changed.

It is the opposite choice to the obvious one, and the reason is practical: a role without a default forces every
project to write one from scratch before getting full behaviour, and meanwhile the skill
degrades silently. Better a declared default answer, visible and changeable, than an
absent file nobody knows they must write.

**The default stays domain, it does not become method.** The skill keeps asking the question and not
knowing the answer: if you delete the file, the §6 degradation applies exactly as if no default had ever existed.
What travels is a *plausible* answer, not a *binding* one.

**A default exists only where it makes sense.** A role whose answer depends on the stack or
the architecture — the test macrocategories, the performance hot spots — has none and must have
none: there a default is an invention disguised as a rule. A role whose answer is a
convention, fine until it bothers you, does.

And there is a second, narrower case: a role whose answer **must exist from day one
because more than one writer already writes on the same thing**. That is `memory-contract.md`: on Claude Code
the `{memory.root}` corpus has two writers as soon as `init` finishes — the host on its own initiative and
`update-memory` on every commit (§4.2) — and an undeclared form does not stay indeterminate, it becomes
two forms in the same folder. There the default does not anticipate a user choice: it spares them
having to make it before writing their first memory.

#### Area policies are found by paths, and may carry layers

An area policy (`.daiku/policies/*.md`) is found by **match**, not by role: a skill lists
the folder, reads the `paths` frontmatter of each file, and opens those whose patterns cover
the files it works on. A policy without `paths` is never opened by anyone.

A policy **may** also carry an optional `layers:` frontmatter block restating an invariant
in machine-readable form — `name`, the `folders` it applies to, and the `deny_imports`
fragments forbidden there. When the block is present and its folders cover the scope, readers
verify the block instead of interpreting the prose; when absent or malformed, they verify the
prose. The block is a convention, never an obligation: a policy without it stays a
fully valid policy, and no check reports a missing block.

### 5.5 The language — read here once, not repeated in every skill

The skills of this package are written in English, but **the language a skill writes in is not
the one it is written in**: it is the one the project declares. There are two keys because there are two
different audiences, and on many projects they do not coincide.

- **`{language.chat}`** — everything a person reads: the chat reply, the end-of-skill summary, the report, and the documents the method produces (`0. problem.md`,
  `1. decision-doc.md`, `2. blueprint.md`, the review notes, the delivery report).
- **`{language.commit}`** — everything staying in the repository's shared history: the
  commit message and the changelog entry. It is separate because a project with an interface in
  one language often has a Git history in another, and whoever reads `git log` in two years is not who
  is watching this chat right now.

**It applies to every contract in the package, without anyone repeating it.** Every parameterised skill
carries at the top the §5.1 line, which refers to this §5: that line is enough, and a skill
rewriting the rule above would make it diverge at the first change.

If one of the two keys is missing, §6 says that thing does not exist — and here it means one specific
thing: **mirror the language of what is in front of you**. For chat, the language the user wrote
to you in; for a commit, that of the messages already in the history. It is not an elegant fallback, but it is
the only one that imposes no choice nobody made.

### 5.6 What `init` deposits is in English, and the two keys do not concern it

The two keys of §5.5 say how the skills speak to a person and what they leave in the repository's
history. **They do not say in which language Daiku is made.** The skeletons the package carries —
`project.json`, `environment.json`, the instructions file, the `domain/` and `policies/` READMEs,
the domain defaults — arrive in English, and `init` compiles them in English whatever the user
answered.

**One exception, and it concerns the instructions file alone.** Where that file already exists and
is written in another language, **its language is the file's**: `init` keeps the project's own
lines verbatim in the language they were written in, and carries the skeleton's prose and section
titles into that same language. Everything else it deposits stays English either way, and a file
created from scratch is English.

The exception is the rule below applied rather than stated: what must not exist is a
**half-translated file**. English headings over the project's own prose is two languages in one
file — worse than either, and it doubles what a session loads on every opening.

The corpus lives in a single language because the skills re-read it on every run, because a
project changes hands, and because a half-translated instructions file is the worst of both forms.
From then on those files belong to the user, who rewrites them in whatever language they prefer: the rule
binds what Daiku writes, not what is written into them afterwards.

## 6. Degradation — what the JSON does not declare does not exist

An absent key is neither an error to report to the user nor a question to ask: it is
the statement that that thing, in this project, is not there.

- **A key needed by a step is missing**: the step is skipped, and the outcome declares it in one
  line. No fallback value, no heuristics, no guessed command.
- **An area is missing**: the work concerning it does not exist. A project without a frontend
  does not produce a red frontend gate: it produces nothing, and says so.
- **`.daiku/project.json` is missing**: the skill cannot be parameterised on this project. Stop and
  say so, instead of falling back on another project's values.
- **A declared command fails**: it is a real outcome, not a missing key. Report
  the output, do not look for an alternative command.

The price of this rule is declared: an incomplete JSON produces a skill that does less, not
a skill that gets it wrong. It is the intended direction.

## 7. Contract version

`contract` is an integer identifying the **form** of the file, not its content.

- **It is incremented** only when the form changes so that a skill written on the
  previous form would read badly: a renamed or removed key, a changing type, a
  shifting meaning.
- **It is not incremented** for a new optional key: a skill not knowing it ignores it,
  a skill wanting it and not finding it falls back on §6. It is the normal case.
- **Skills do not branch on `contract`**: §6 already covers every missing key. The number
  exists to make a lagging JSON recognisable, so a skill degrading on an
  absent key also reports the `contract` it read.
- **It is not incremented for a removed key no skill read.** It is the only exception
  to the first rule, and it stands on its own: the number exists to make recognisable a JSON
  that a skill **would read badly**, and a key nobody opened cannot be read badly by
  anyone. A `project.json` still carrying it has one extra line nobody looks at,
  not a defect. The condition is strict and must be verified, not assumed: *no* skill in the
  package cites it.
- **Incrementing it is a coordinated job**: update this file, then the `project.json` of
  every project, then the skills reading the new form. Until that round is closed,
  updating the skills is no longer atomic — which is why the number exists.

The current form is **1**.

## 8. Project or environment — in which of the two files

There are two parameter files, and a single question separates them: **does that value describe the
codebase in front of you, or the machine, the host and the owner running it?**

- **Describes the project** → `.daiku/project.json`, with the §4 keys.
- **Describes the machine, the host or the owner** → `.daiku/environment.json`, with the keys
  declared in `contracts/orchestration.md` §7, which is their main consumer.

The two files have the **same form**: leading `contract` (§7), literal values and never
descriptions (§2), same brace-citation convention inside a code span (§5.2), same
opening line (§5.1, covering both) and same degradation (§6). Those rules are
read here once and apply to both: they are not rewritten elsewhere. Only the cited path's root
changes, and the file the skill opens.

### Where each of the two lives

Both live **in the project**, under `.daiku/`, and the folder **is versioned**: `project.json`,
`environment.json`, `domain/` and `policies/` are the configuration the project wrote for itself,
part of it by hand, and a clone must find it without running `/init` again. The folder stands inside
the repository and enters a diff like any other source file.

Beside them stand the **scripts `init` deposits**, `update.mjs` first: it is copied from
`templates/project/` together with the `daiku: update` task of `.vscode/tasks.json` that runs it —
it reads the version in place, refreshes the `daiku` marketplace, shows the version in place beside
the one the catalogue is carrying, asks whether to update, and on a yes updates the package on
Claude Code. It is no parameter — no skill and no hook reads it.

And it is **not the project's file**, which is why it is the one thing under `.daiku/` that `init`
rewrites. Each script carries the marker `daiku:script <version>` at its top, holding the version of
the package that deposited it; where the marker names another version, or is absent, the file on
disk was written by a Daiku older than the one in place, and `init` **recreates it whole** from the
skeleton. Without the marker an update would stop at the package and leave the project running the
script of a Daiku it no longer has — and the marker is the only thing distinguishing the two
readings of the same file: a script this package wrote, which stays, and a script it did not, which
goes.

And beside it lands `README.md`, copied from the same folder as `.daiku/README.md`: it is Daiku's
own documentation — what the method is, the commands it offers, where the values live — and it
stands inside the project so that whoever asks about Daiku, user or agent, finds the answer where
the rest of Daiku already is. It is not a parameter either: no skill and no hook reads it, and
nothing cites it. It is read when the question is asked.

**Nothing of Daiku stands outside the repository.** A folder in the user home is a seat no clone
carries, no `git diff` shows and no reviewer corrects — and it is the first thing a guardrail
loses, because a perimeter drawn around the working roots does not reach it. What a project needs
to run is inside the project, and inside its history as well.

**One path under `.daiku/` stays out, and it is the machine's override**: the `.gitignore` line
excluding `.daiku/environment.local.json`. `init` writes it in the repository's `.gitignore` when
no line of the repository covers it yet.

`environment.json` standing in every project has a price, and it is declared: the same change to a
model's alias is repeated in N projects. It is paid knowingly, because the alternatives are worse —
the home folder above, or a value that lives nowhere and is guessed every time.

**A machine may still override it, and the override stands beside it.** Whoever reads it looks in
this order:

1. `.daiku/environment.local.json` in the technical root, if it exists;
2. `.daiku/environment.json`.

**The first one found wins, and is taken whole**: the two are not merged. The local file is a
complete alternative file, not a list of differences — so what is read stays a single file, and
nobody must reconstruct in their head which of the two each key comes from. It is the same pair as
`settings.json` and `settings.local.json` (§4.2): the shared file is versioned, the local one is
not, and the local one is the only path under `.daiku/` staying out of the history.

**One thing the file does not carry: `temp_dir`.** An absent `temp_dir` is not a degradation, it is
the normal case: the operating system's temporary directory is the correct answer on every machine
anyway. Write it only where that answer is wrong.

**Nor does it carry `write_roots`**: the folders a machine lets its agents write in are that
machine's, and they go in `environment.local.json`. The folder is named, not the side it stands on,
so the seat holds **inside the repository and outside it** alike — and that is what makes the key
the answer for a folder of yours that is no seat of the method: a write the conversation makes
there is the machine's own, and `run-advice` says nothing about it. Absent, the reminder knows
only the run's own seats.

**When a value seems to belong in both**, whoever would update it at the next
change decides: if putting it in `project.json` forced repeating the same identical change in
N projects, it belongs to the environment. An environment value is never duplicated in `project.json`, not even
"to have it at hand": duplication recreates one level further exactly the problem that
atomicity closes.
