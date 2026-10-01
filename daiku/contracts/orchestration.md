# Skill orchestration — single contract

This file is the **single point of change** for how the project's skills delegate work and
which role runs on each step. The skills in `skills/` describe *what* is to be done and
*in what order*; here lives *who* does it and *how* it is launched on the current host.

## Parameters

Every key in braces in this contract resolves on the project parameter files, never from
memory and never by assumption: the rules are in §5 of `contracts/project-contract.md`, which also
says in which language to write and what to do when a key is missing. The keys this file
consumes are those of §7 below, and they live in `environment.json`, under `.daiku/` — whose
local override, and the order in which the two are looked up, are §8 of that contract.

It applies to every host declared in `{hosts}`. A skill's canonical contract always lives in
`skills/<name>/SKILL.md`; a host that requires a pointer to invoke it finds it under
`{hosts.<host>.skill_pointers}`. No skill duplicates this contract and no skill names
a model.

## 1. Roles

Two roles only, anonymous by construction. A skill declares a step's role, never its model.

| Role | When to use | Step examples |
|---|---|---|
| **judge** | the step *decides* or *synthesises*: it produces new work from heterogeneous inputs, or reconciles findings from several sources where getting it wrong is costly | execution brief, memory/documentation update, reconciliation of a corpus review |
| **worker** | the step *executes* or *inspects* an already delimited perimeter: it applies a plan, hunts for findings in a diff, runs known commands and reports the outcome | brief execution, review finder, scope, gate, inventory, Git commands, logs and reports |

A purely mechanical step (a log line, a `git add` of already listed files, appending a
report) stays a **worker**: it does not deserve a third role.

## 2. A role's model

A step's model is `{hosts.<host>.models.<role>}`, where `<host>` is the current host and
`<role>` is the one the skill declared for that step. It is the only allowed resolution, and it
happens here: the skill declares the role and stops there.

**Host resolution.** The host is the one you are running on, and you know it from where you are running: do not
ask for it. On a host that requires a pointer, it is the pointer that invoked you — the file under
`{hosts.<host>.skill_pointers}` — that names it. If you do not know it in either way, `{default_host}` applies, and none of the hosts currently declared in the skeleton requires a pointer.

**Alternative backends.** If the session runs on a switched backend — one of `{backends}` that is not
the host's native one — the model names in `{hosts.<host>.models}` remain the tier aliases
to declare: it is the switcher's env that remaps them onto the backend's real model. There is nothing to
change here, and no skill needs to know that mapping: the only thing that truly changes is
concurrency (§5).

If the host does not let you choose a subagent's model, the role is still
declared in the prompt and the step runs on the default model: the sequence and the contracts do not
change.

## 3. Invocable skills and internal contracts

Every contract under `skills/` is, first of all, a **path that a subagent receives and
reads**: it is the form that makes them work identically on every host, without one pointer per host.
Some, in addition, **are launched by hand**. The two things do not exclude each other, because they do not describe the
file but the invocation: the same contract is an **entry point** when you launch it and an
**internal contract** when a chain delegates to it. `research` is the collection that
`new-feature` procures for itself when it needs it, with reordering delegated to `study`, and at the same time the command with which you request the notes yourself.

**There are nine entry points, and it is not a number that grows on its own.** A contract is launched by
hand only if it is the **entry point of a chain**, never because it is handy to have it around:
what sits in the middle of a chain is reached by whoever opened it, and adding it here means
opening a second way to get there, with different scope and permissions to keep aligned
forever. The nine fall into two groups, which are not used at the same moments.

**The method — these seven, and they are all of everyday work:**

| Entry point | Why |
|---|---|
| `new-feature` | you start from an idea and there is nothing on disk yet: from the description to the commit, in a single run. Inside live the study, the decisions and the delivery, which is why they are not launched on their own |
| `research` | notes on a technology are also valuable on their own, before any delivery consumes them. Launched this way it **deposits the reordered file and stops**: it opens nothing downstream |
| `review` | the review also lives on its own, on a hand-written diff |
| `code-review` | a bugs-only pass over the scope you tell it, with no rounds and no fixes: eyes on the code without opening a cycle |
| `commit` | it closes a review launched with `--no-commit`, or a diff written outside a review |
| `blueprint` | you already have a resolved decision-doc and stop at the brief: from the chosen solution it produces `2. blueprint.md` and stops there — the hand-off that travels to where the execution runs |
| `ship-feature` | you already have the folder, with or without the brief, and want the whole delivery to the commit in a single run, without reopening the study |

**Installation — two commands that are launched once per project**, and that no chain
can reach because they run *before* there is a chain:

| Entry point | Why |
|---|---|
| `init` | it is the first of all: it opens `.daiku/` on a project that does not have it, and until it runs no other contract has the values to work with |
| `sync-host` | it carries guardrails and subagent roles into the host layer that cannot receive them from the package; `init` launches it on Codex as its last step, and it is re-launched on every update |

Everything else — `decision-doc`, `update-memory`, `execute`,
`finder-prompt`, `applier`, `arch-check`, `perf`, `dead-code`, `test-coverage`, `study` — is an **internal contract**: a
subagent receives it as a *path to read*, not as a skill to invoke. `decision-doc`
is opened by `new-feature`, `update-memory` by `commit` on every invocation, and
`study` by `research` on every invocation, for reordering. An internal contract
**asks the owner nothing** and has no `argument-hint`: it returns a genuine choice in its own
block, and whoever called it carries it into the chat (§ *Ask the owner*).

That a host also exposes by name a contract not declared here is a convenience of that host,
not a declared invocability: what is declared is this section.

On a host declaring `{hosts.<host>.skill_pointers}` a skill from these two tables is launched
only if it has its own pointer there, and not all have one: those that do not remain
reachable from hosts not declaring that key, which load the contracts
directly from `skills/`. Adding the missing pointer, or that of an internal
contract needed by hand, is twelve lines — not another copy of the contract.

### A contract reachable in more than one way declares its modes at home

The same file is both entry point and internal contract, and the two invocations do not have the same scope
or the same permissions: `research` deposits the notes and stops when you launch it, and
feeds the chain when it is `new-feature` that procures it. That difference **is declared in the node**, one section per
mode, with scope, write permissions and return block. Whoever invokes **chooses** the mode
and does not rewrite the constraints: an exemption list written in the caller erodes with every change to the
node, and nobody notices until the node does, in finder mode, something that list
had forgotten to disable.

It applies to every node reachable in more than one way, including those that will arrive from outside: an
imported contract arrives without modes, and the short road for whoever invokes it is always the same.
The modes section is written **before** connecting it, not after the first incident.

### The topology: what is connected to what

The delegation rules of §4 say *how* a step is launched. This table says *what is
connected to what*: who may invoke a node, with which already-resolved input, with which expected
return, and whether that node may re-delegate. **Read it before delegating**, and every cell is a
**reference**, never a copy: the content lives in the node's file, which remains the only place where it is
changed. It is not an engine — orchestration stays with the agent (§6) — it is the map that spares it
rebuilding the graph from the caller's prose.

| Node | Invoked by | Receives already resolved | Returns | Re-delegates |
|---|---|---|---|---|
| `init` | owner | technical root, or nothing and the current directory applies | § *Report* of its file: one line saying the project is all set, or the steps that did not go through; one line saying it already was when § *Scan first* finds nothing missing — in the chat language | yes — `sync-host` on Codex, as its last step |
| `sync-host` | owner, `init` on Codex | technical root, or nothing and the current directory applies | the report of § *Report* in its file: copied, hooked, not hooked, roles written, and the gestures left to the user | no |
| `new-feature` | owner | description of the feature or problem, in natural language | § *Outcome* of its file: the opened folder, the documents the chain produced and the delivery outcome | yes — per-area investigation, `research`, `decision-doc` twice, and `ship-feature` as orchestrating child |
| `decision-doc` | `new-feature` § *The study of decisions* and § *Incorporation* | problem folder, optional subset to analyse, the already written document, the material the request came with, the paths of the `research` notes and of the relevant memories, and on receiving the owner's answers by number | `0.5. strategic-study.md` or `1. decision-doc.md` on disk, with `0. problem.md` refined, and the block of § *The block you return* of its file | no |
| `research` | owner, `new-feature` § *The missing knowledge* | name of the technology; from `new-feature` also the version in use in the project and the questions the notes must answer | path of the file in `{paths.studies}/`, in both modes, nothing else | yes — fan-out per thematic block (leaves) + `study` as leaf child |
| `study` | `research` § *Step 2* only | path of the dirty file, studied technology, studied and latest versions with dates | reordered file in `{paths.studies}/` + the block of § *The block you return* of its file | no — leaf |
| `blueprint` | `owner`, `ship-feature` phase 1 | folder with `1. decision-doc.md`, chosen solution verbatim, relevant memories | § *What you return* of its file | no |
| `execute` | `ship-feature` phase 2 | folder with `2. blueprint.md`, relevant memories; on a relaunch, the `handoff` blockers or the round-0 findings | § *What you return* of its file | no |
| `ship-feature` | `owner`, `new-feature` § *Delivery* | folder and chosen solution | § *Outcome* of its file | yes — its phases, and `review` as orchestrating child |
| `review` | owner, `ship-feature` phase 3 | base-ref, the commit under review, or path of `4. review-notes.md`, ledger to reopen (chosen on `base` **and** `item`), `--no-commit` from whoever commits on their own, effort, `--backend` when the session runs there, work roots and artefacts when running on a worktree | § *Outcome* of its file | yes — finder, applier, coverage, gate, `commit` |
| a round's finder (`finder-prompt`) | `review` § *Finder* | discipline and contract, the round range (`from`, `to`, files), effort, the ledger path, the resolved parameters | § *The block you return* of its file | no |
| `code-review` | owner, `review` as `bug` finder | hand-told scope **or** round scope | report in chat **or** § *The block you return* of `finder-prompt`, with the `confidence` scale its file declares | **no** |
| `arch-check` | `review` as `arch` finder | round scope | the block of `finder-prompt` § *The block you return*; its file declares scope and permissions | no |
| `dead-code` | `review` as `dead` finder | round scope | the block of `finder-prompt` § *The block you return*; its file declares scope and permissions | no |
| `perf` | `review` as `perf` finder | scope **or** round scope | the block of `finder-prompt` § *The block you return*; its § *Finder mode* declares scope and permissions | no |
| `test-coverage` | `review` § *Coverage* with `--auto` | macro-category **or** final cycle diff and relevant memories | § *Automatic mode* of its file | no |
| `applier` | `review` § *Applier* | the path of the round's numbered findings file, the ledger path, the round range, relevant memories, the resolved parameters, and the **mode** when it is the closing round on tests | § *The block you return* of its file | no |
| `commit` | owner, `review` § *Closing* (always, except `--no-commit`) | code-group perimeter; it partitions memory/docs and version/changelog itself (§ *Procedure* 3 of its file) | § *Procedure* 8 of its file, in chat | yes — `update-memory`, **always and without exceptions** |
| `update-memory` | `ship-feature` phase 5b, `commit` § *Alignment* (**always**, on every `commit` invocation) | diff in index, feature folder where to deposit its own artefact (from `ship-feature`), **commit permission for its own group** | § *Procedure* 7 of its file | no |

**A new arc is declared in the program, and its row here follows it.** Connecting a node to a
caller that did not have it means declaring the arc in `GRAPH` of
`architect/architect.mjs` and updating its row — the callers, the input it now
receives resolved, the permission that the invocation passes it — in the same change that writes
the arc. A row left un-updated is an
arc that exists in the prompts' code and exists nowhere readable: it is the form in which a node's permission ends up depending on who calls it without anyone
having decided so.

**This table reflects a program; it is not the program's seat.** The order lives in
`architect/architect.mjs`: that program carries the graph above as its own data and
answers, given the entry point and the artefacts already on disk, which phases remain. The table
**shows** the graph to whoever reads a contract, but does not **declare** it: a skill that needs
the sequence asks the evaluator and follows the verdict.

**A machine compares the two.** `node hooks/self-check.mjs` launches the evaluator's bench, in
`architect/`, together with the other benches, and that bench reads this file, extracts
the rows above, and refuses a divergence in either direction — a node the program does not carry, a
row with no node on disk, a caller on one side and not on the other. The evaluator takes its root
as an argument, never by position on disk, so a reorganised tree cannot silently lose the corpus.

## 4. Delegation

An orchestrating skill launches every step as a **subagent in a fresh context**, never running it
inline in the conversation: that is what keeps the long chain inside a healthy context and what
makes a step repeatable.

How to launch, per host:

- **`claude`** — `Agent` tool, with `model` resolved per §2 and `subagent_type` chosen thus:
  `finder` for analysis-only steps that report findings (a review's finders), `Explore`
  for search only, `general-purpose` for everything else — that is, for steps that must
  write. Several independent subagents are launched in the **same** tool-call block to make them
  truly run in parallel.

  `finder` is the package's only **role**, defined in `agents/` at its root, and there it has a
  **restricted toolset**: no `Edit`, no `Write`, no delegation to other agents. It is the
  difference between a constraint declared in the prompt and a real one: a finder that "fixes while it is
  at it" does not appear among the applied, has no `anchor` in the ledger, and no later round
  re-sees it.

  **The real boundary is which tool is there, not what you write inside it** — and on this role it holds
  halfway. The absence of `Edit` and `Write` is truly enforced. `Bash`, instead, is there, with specifiers
  `Bash(git diff:*)`, `Bash(git log:*)`, `Bash(git grep:*)`, which **restrict** nothing: a
  finder runs `ls`, `cat`, `grep -rn` and any other line without a denial, and it has been seen
  happening. For that half, read-only rests on the prompt as on a `prose` host, so **repeat the read-only constraint
  in the prompt** — on every host, not only on those without a harness.
- **`codex`** — the host's native subagent, with the model resolved per §2.

  **The role is called here as there.** `finder` also exists on Codex, as
  `.codex/agents/finder.toml`, if `sync-host` has run on this project: same name, same
  contract, different rendering. If it has not run, there is no role to name — the step starts
  without one, and you declare it in the outcome.

  **Naming it enforces nothing, though.** On this host there is no tool list to restrict, and
  `sandbox_mode` inside a role file **restricts nothing**: a subagent carrying it writes
  just the same. The role exists to get the contract to the child without you recopying it, not to
  close it a door. The host's only real boundary is the **session** sandbox, which whoever launches
  Codex chooses at startup and is not yours to choose.

  The runtime wants the model in two different gestures, and it is a property of the host, not of the skill
  that meets it: a step resolved to `{hosts.<host>.models.worker}` is launched **without passing
  `model`**, so it inherits that model from the parent; a step resolved to
  `{hosts.<host>.models.judge}` passes that model explicitly. For inheritance to hold, **the parent must already run on
  `{hosts.<host>.models.worker}`**: if it does not, stop and ask to select it for this
  session, with no fallback — an inherited judge in place of a worker exits with a contract identical to
  a step run as it should be, and nothing downstream distinguishes the two.

**The harness does not have the same depth on both hosts, and `{hosts.<host>.enforcement}` says which.**
`harness` means three things are active and enforce on their own: the `deny` of the permission rules,
the hooks, and the **list** of tools an agent declares — an absent tool is a real boundary. It does not
cover the **content** of a Bash command: a specifier such as `Bash(git diff:*)` describes
an intention and does not enforce it, and an agent that has `Bash` has all of `Bash`. `prose` means that
none of the three layers exists, and the invariants hold only because they are written — there nothing stops
a `git push`, a removal crossing a junction or a finder that writes.

A single rule follows, valid everywhere: **a constraint that is not a tool's absence is repeated
in the subagent's prompt** — on a `prose` host all of them, on a `harness` host those none of the
three layers covers, starting with the read-only of whoever has `Bash`. And **you declare it in the outcome**:
same contract and same words are not the same guarantees, and without that field nothing downstream can
distinguish the two cases.

Rules valid on every host:

1. **Self-sufficient prompt.** The subagent starts from zero: in the prompt you give it the contract to
   read (the skill's path), the resolved input (folder, scope, base-ref) and the return
   format. Do not count on anything that lives only in your conversation.

   **Relevant memory.** To a step that writes code, or decides what to write, you also pass
   `{memory.index}` and the **paths** of the memories its perimeter touches — those you already
   hold, chosen on the index — with the instruction to open them before working. Do not summarise them
   in the prompt: a summarised fact is a fact that diverges from its file at the first update. If
   no memory is relevant, pass only the index. It is the channel through which facts not deducible
   from the code reach whoever starts from zero: without it, they end up recopied inside the contracts, and it is
   the copy that the subagents read.

   **Resolved parameters, and state by path.** The keys in braces the child's contract cites and
   that you already hold resolved — `{code_root}`, `{hosts.<host>.instructions_file}`, `{memory.index}`,
   `{language.chat}`, an area's commands — go in the prompt as `key = value` lines, copied from the
   parameter file and never paraphrased. The child uses a passed value as it is and resolves on §5
   of `contracts/project-contract.md` only a key it was not passed: a value resolved once is not
   resolved again by every child, and a key left out still resolves, one file later. What already
   lives in a file — a ledger, a list a program numbered — goes as its **path**, not as a
   transcription: a copy drifts from its file at the first write, and it is paid twice, by whoever
   writes it into the prompt and by whoever reads it there.
2. **Return by contract.** Every step that feeds a downstream decision returns a JSON block
   with the fields the skill declares: read that, not the prose. If the block is missing or
   incomplete, the step has failed — do not interpret it by feel.

   **And a failed step has a ceiling.** It is relaunched **exactly once**, with the same identical
   prompt; if it still does not come back, what follows is declared by the skill hosting it, and it must
   declare it in writing. Without that ceiling the same silence produces behaviours that are all
   defensible and incomparable across runs — relaunching indefinitely, skipping the step, closing
   the cycle — and in the report the three runs read the same. An orchestrator that relaunches
   until it gets the answer it wants is not orchestrating.

   **The schema is declared by the node, exactly once.** A step's return block is written
   in the file of the node that produces it. Whoever consumes it **cites** it — "the block that *that file*
   declares, in full" — and does not recopy it; if it deliberately reads only a subset,
   it declares which fields it ignores and why. A schema recopied by the caller shrinks
   crossing the arc: it is born identical, then the node adds a field and the caller does not, and that
   field simply does not reach the decider — who keeps deciding, with less information than
   exists, with nothing signalling the loss.

   **Validation.** A step's return block is validated before use against the fields its node
   declares: a required field absent or malformed counts as a missing block, and a
   string that is not the expected block is a block that did not come back. The machine-readable
   form of every block lives in `schemas/blocks.json`, which declares required and optional
   fields: the prose of the node stays the normative schema, the JSON file is its checkable
   mirror, and on divergence the prose holds.
3. **One step, one subagent.** Do not merge two phases into a single subagent to save a
   round: the sequence the skill declares is the contract.
4. **If delegation is unavailable** on the current host, run the step inline while still respecting
   order, perimeter and return format, and declare it in the outcome. But first read the
   subsection below: for steps that stand on the children's independence, *inline* is the
   second rung, not the first.
5. **An orchestrator waits for what it launched.** A step that fans out closes when **every**
   subagent it launched has returned its block: the sequence does not move on a fan-out still in
   flight, and a question to the owner never shares its tool-call block with a launch. For the
   question of § *Ask the owner* this is not tidiness: asked while a step is still writing, it
   reaches the owner on a state that is still moving, and the answer describes a list the work in
   flight can still change.

### Depth and degradation

**Who may re-delegate.** A delegated step **executes**: it does not delegate in turn. The only exceptions
are the orchestrating nodes that §3 declares also reachable as children — `ship-feature`
(which orchestrates its own phases), `review` (finder, applier, gate, commit) and `commit` (which
delegates alignment to `update-memory`) — **plus `research`, which as a child of `new-feature`
orchestrates its own collection fan-out and delegates reordering to `study`, a leaf**. Every other
delegated step is a **leaf**, and the longest path in the graph stays four levels,
`new-feature → ship-feature → review → finder`, with the collection chain at three levels
`new-feature → research → study`. A node that realises it wants to delegate, and is not one of the four, is doing
someone else's work: return to contract and let whoever called it decide.

**Degradation has two rungs, not one.** A step whose yield depends on the children's **independence**
— the finders of a `/review` round — does not degrade to
*inline*: it degrades first to **sequential subagents**, which is already the normal case on backends with
`{backends.<backend>.sequential_fanout}` (§5) and in which mutual blindness stays intact because
each context is still fresh. Only if even that is impossible do you run inline.

And then **you declare it in the return block** (`"independence": "lost"`, or among the
`limitations` if the block has them), because order, perimeter and format survive
degradation but blindness does not: three disciplines evaluated in the same context *are* the single
pass already convinced of itself that fan-out exists to avoid. Without that field the outcome exits
identical to that of a blind fan-out, and nothing downstream can distinguish them.

### Ask the owner

**A subagent has no channel to the owner.** It starts from zero, writes its block and dies:
nobody reads its question, and a question asked in there turns into an assumption taken
in silence or a step left hanging. So **only whoever runs in the conversation asks** —
the node the owner invoked — and a delegated step facing a genuine choice
**returns** it in its own block instead of resolving it: it is whoever called it that carries it into the chat.

Decisions are asked as a **structured question**: a title, two-to-four mutually exclusive
options with stable `A`, `B` (, `C`, `D`) ids, each with one line on what it entails, and the
recommended one first and declared as such. Which one is recommended is not inferred from the prose:
`recommended_id` in the block carrying it says so — by `decision-doc` contract it is always `"A"`,
already first — and whoever asks reports it without reordering. How that form is rendered is a property of the host, not of the skill — which declares it wants
to ask and stops there, as it declares a role without naming a model:

- **`claude`** — `AskUserQuestion` tool, one question per decision, **at most four per
  call**: if there are more decisions, make more calls in sequence, in order of severity.
  Option `A` goes first, **every label opens with its id** — `A — <text>` — and `(recommended)`
  closes the label of `A`; the description line carries what the option entails. The letter is
  what makes an option referable in the message above and in the discussion that may follow, and
  on a host where the answer is typed it is what the owner types. The owner may always
  answer outside the options, and that free answer **prevails**.
- **`codex`**, and every host without a structured-question tool — the same list, numbered, in
  chat, with the options as letters (`A` first, declared recommended) and the invitation to answer compactly (`1A, 2B, …`). The
  content is identical: only the delivery changes.

**The question is bare; the message above it is not.** The ask renders a title and one line per
option, and context does not go in there: what the owner reads before choosing is the **chat
message immediately preceding it**, where the decision arrives whole — decision by decision, the
problem, each option with its letter and what it entails and costs, and the recommended one with
why it is recommended. That message is written from the block, without summarising it and without
reordering it, and it is written every time, even when the document hosting the decisions is on
disk and can be linked: the owner decides from what they read, not from a file they have to open
first.

**The ask is the last act, and it is emitted alone.** Every subagent the run launched has returned
its block and nothing is still in flight (§4 point 5): asked while a step is writing, the question
reaches the owner on a state that is still moving, and the answer describes a list the work in
flight can still change.

**Whoever asks does not stop at asking.** A skill that poses decisions and then leaves the owner
the job of relaunching it by hand with the answers is asking him to be the orchestrator in its
place. The answers return inside the same run, and the chain continues from there to wherever its
contract declares it goes.

**An answer that asks is not an answer.** When the owner's reply carries a question — a doubt, a
clarification, "why this option" — the run **stops**: you answer it and nothing else, the turn ends
there, and the decisions stay open. While the discussion is going the channel is the conversation
and not the form, and a form emitted into it asks the owner to choose before they have finished
asking. Resuming is their act: they request it, on the same folder, and the node's outcome says
where the run stopped and what resumes it.

## 5. Concurrency

**Parallel** fan-out is the default: independent steps (a review's finders, the auditors
of an audit) run together.

Exception: backends declaring `{backends.<backend>.sequential_fanout}` run independent steps
**in sequence**. If the invocation declares one of those backends (`review` with
`--backend`), it sequentialises the fan-out; in every other case it stays parallel.

Steps touching the same working tree (build, test, commit, computing a base-ref) are
**always** sequential, on every host: they are not otherwise serialisable.

## 6. Prohibitions

- No skill names a model: it names a role, and this file resolves the model
  on the environment. The role is the only thing a skill has the right to write.
- No skill duplicates this contract, nor the values it reads from
  `environment.json`, not even "for convenience".
- No skill introduces a third role or a model profile of its own.
- The `Workflow` tool is no skill's engine: orchestration belongs to the agent, which delegates
  to subagents per this file. Do not invoke it.

## 7. The `environment.json` keys

The file lives in `.daiku/environment.json` in the technical root; a machine may override it
wholesale with `.daiku/environment.local.json`. The two seats, and the order in which they are
looked up, are §8 of `contracts/project-contract.md`.

| Key | Purpose |
|---|---|
| `contract` | integer of the file's form, with the rules of §7 of `contracts/project-contract.md` |
| `default_host` | host to assume when nothing declares it |
| `hosts` | the set of declared hosts; cited thus when a skill **enumerates** them instead of naming one |
| `backends` | the set of declared backends; cited thus when a skill validates one against the list |
| `hosts.<host>.models` | the models declared for that host; cited thus when the set counts and not the single role |
| `hosts.<host>.models.<role>` | the model of the role the skill declared for that step (§2) |
| `hosts.<host>.models.judge` | model the judge role runs on for that host |
| `hosts.<host>.models.worker` | model the worker role runs on for that host |
| `hosts.<host>.instructions_file` | instructions file that host loads on every session — `CLAUDE.md` on Claude Code, `AGENTS.md` on Codex — at the technical root; a project carrying both declares both, and each skill reads the one of the host it runs on |
| `hosts.<host>.skill_pointers` | folder where the host looks for the invocable skills' pointers; absent if the host requires none |
| `hosts.<host>.enforcement` | `harness` if the host enforces with `deny`, hooks and a tool's **absence** — never a Bash command's content; `prose` if the invariants hold only because they are written (§4) |
| `hosts.<host>.settings_file` | file where the host keeps the session's environment configuration |
| `hosts.<host>.base_url_env` | name of the variable with which, in that file, the host points at the active backend; absent if the host does not switch |
| `hosts.<host>.native_backend` | backend active when the host is not switched |
| `backends.<backend>` | an existing LLM backend; the key is the name used to declare it to a skill |
| `backends.<backend>.base_url` | URL the environment points at when that backend is active; absent on the host's native backend |
| `backends.<backend>.sequential_fanout` | declared only on backends whose fan-out must be sequentialised (§5) |
| `backends.<backend>.caveats` | that backend's warnings to report in summary, one per line; absent if there are none |
| `temp_dir` | machine's temporary directory, for artefacts that must not end up in the repository; **absent is the normal case** — the operating system's temporary directory is the right answer on every machine |
| `write_roots` | folders the machine admits, where **a write made from the conversation is not the run's own violation**: `run-advice` measures the run's seats (`{paths.features}`, `{paths.studies}`) and adds these, so the reminder does not speak where the machine already declared the folder writable — a machine's own paths, so they belong in `environment.local.json`, and the folder is named, not the side it stands on; **absent is the normal case**, and the reminder then knows only the run's seats |

No key is mandatory besides `contract`: for everything else the degradation of
§6 of `contracts/project-contract.md` applies.

**The current form is 1.**
