---
name: 'new-feature'
description: 'Opens a feature from a natural-language description — or resumes a folder already opened, reading what it carries and picking the chain up where its documents stop — and carries it to the commit in a single run: code investigation, study of the technologies you do not know well enough, decision document, decisions asked in chat, and from there the whole delivery delegated to ship-feature'
argument-hint: '<feature or problem description, or a folder already opened> [--stop-at-brief] [--no-ask]'
---

You are the node **opening** a work and not leaving it halfway. You receive a natural-language description, you investigate the code, you procure the missing knowledge, you have the decisions studied, you bring them to the owner in chat — and with their answers in hand you continue to the commit without them having to relaunch anything.

**The owner intervenes only once**, when answering the decisions. Before that you ask them nothing, because there is still nothing to ask; after that you ask them nothing, because they already decided, and one more confirmation is a step that costs them effort and adds no information. With `--no-ask` they do not intervene at all: the run never asks, takes the recommended option for every decision, produces the document of the stage it reached, and stops there — without delivering.

> **Parameters.** Every key in braces in this contract resolves on the project parameter files, never from memory and never by assumption: the rules are in §5 of `contracts/project-contract.md`, which also says **in which language to write** and what to do when a key is missing.

## When to use it

Use it when you start from an idea or a problem and there is nothing on disk yet — or when the folder is already there and the work has to be **resumed**: given a folder under `{paths.features}/` instead of a description, the run reads what that folder carries and starts where its documents stop, asking no confirmation of its own (point 1). It is the only entry point that starts from the **code** instead of a document, and the only one that opens the folder; `decision-doc` is its internal phase, never launched on its own, while `ship-feature` is its delivery and can also be launched by hand on the folder.

## Before starting

Read `contracts/orchestration.md`: roles, host, how to launch a subagent, how a question is asked of the owner, concurrency. Each step below declares its own role (**judge** or **worker**) and you resolve the model with the rule of its §2 — never from here.

## Input

Arguments: `$ARGUMENTS` — the work description in natural language. It can be a feature to make, a question on how to do something the system does not do yet, a gap ("the wiring between X and Y is missing"), an architectural tension ("two components do the same thing"). A trailing `--stop-at-brief` stops the run at the execution brief instead of delivering (point 10): the folder with problem, decision-doc and blueprint, and nothing else.

**Or it can be a folder already opened** — the slug under `{paths.features}/`, or its path. The run is then a **resume**: the folder is the one named, and what it does next comes from the documents inside it (point 1). The flags below compose the same way, and the description is not asked for: a resume that carries one is a resume with a problem statement in hand.

A trailing `--no-ask` stops the run at the **document** instead: the decisions are never asked — the run takes the recommended option (`A`) for every card, which on a resume are the cards the document left open — and the folder is left with the document of the stage the run reached (`0.5. strategic-study.md` or `1. decision-doc.md`), for someone to implement later. It never reaches the brief or the delivery, so it does not compose with `--stop-at-brief`: there is no brief for that flag to stop at.

If `$ARGUMENTS` is empty, **ask** what is worked on and wait until it arrives. It is the only question admitted before the decisions. With `--no-ask` there is nobody to answer: report that the description is missing and stop, opening nothing.

## The sequence

The phases are ordered and not skippable. Each declares its own role, and every delegated step is **one subagent in a fresh context** with the prompt giving it the contract to read, the resolved input and the block to return (§4 of `contracts/orchestration.md`).

Progress and findings go **in chat**, as you go: one line when a phase starts and when it returns, and immediately what you noticed and what needs no block. Keep no log on file: the state needed to resume is the documents the phases deposit in the folder.

### 1. Open the folder, and the memory

From the description derive a kebab-case **slug** saying the *problem*, not the solution — you have not chosen the solution yet, and a slug naming it orients everything coming after. The folder is `{paths.features}/<slug>/`: create it. If it already exists, ask confirmation before working inside it — it is the only other question admitted before the decisions. With `--no-ask` that confirmation is not asked either: the run works inside the folder, where the study updates in place what it finds still valid.

**When the argument names a folder already there, the run resumes — and it starts from what it finds, not from the code.** The folder is that one: no slug is derived from prose, and **no confirmation is asked**, because pointing at it is the confirmation. Two things are read, and nothing is judged by feel:

- **The verdict.** Call `architect/architect.mjs` with `question: "order"`, `entry: "new-feature"`, `present` (the documents the folder carries) and `ledger` (this folder's review ledger in `{paths.review_state}/`, or `null`) — the input § *The evaluator* of `skills/ship-feature/SKILL.md` declares. It binds: `stop` stops the run here, reported; `remaining` names the phases left, and **the phases before them are not re-run** — a phase whose document is already there is not written again, so `0. problem.md` present means no investigation fan-out and no new first draft, only the surgical corrections point 5 justifies.
- **The ask first, whatever phase the verdict names.** `1. decision-doc.md` present proves the decisions **studied**, not answered: before anything else, read the folder's decision documents (`0.5. strategic-study.md`, `1. decision-doc.md`) and, if any card lacks its `Choice:` line, the phase is **point 7** — the cards left open, and point 6 does not run. A brief or a review report standing above an unanswered document is the one exception, and it is not a reading to pick: it is an incoherence to **report**, because answering those cards under it would leave a plan written on decisions that have changed.

Then the phase the verdict names: no decision document at all, **point 6** (nothing was studied yet); a document with every card answered and the technical stage not on disk, **point 8** (incorporation: the answers are already in the document); `acquisition` or later, **point 10**, the delivery. A folder carrying a decision document under a name this chain does not know is a fault to **report**, not a document to ignore: the numbers and the answers live in the declared names, and the run stops there rather than studying the same problem a second time.

Open `{memory.index}` and the memories the problem area touches: it is the channel of §4.1 of `contracts/orchestration.md`. A gap a memory already closed is not a gap, and a trade-off the owner already decided is not reopened here. The paths you choose now you will pass to every step deciding or writing.

### 2. Code investigation — **worker** role

Understand how the system works today in the problem area. **Before fanning out, read the ground the project already declared**: resolve `documents.domain`, `documents.stack` and `documents.architecture` in `.daiku/project.json` — the entities and the vocabulary, the technologies in use with their versions, the structure and the boundaries already decided. The fronts start from those documents and use the code to **verify** what they say, not to re-derive it: an investigation that rediscovers the layers the architecture document already names has spent a front and gained nothing. If a key or its file is missing, proceed without it and invent none (§6 of `contracts/project-contract.md`). Launch **worker subagents in parallel**, **one per investigation front**. You derive the fronts from the problem, not from a list: typically one for each `{areas}` area the problem touches, plus two cross-cutting ones almost always needed — **configuration and startup** (settings, environment, what the system reads when starting) and **architecture** (flows, invariants, boundaries between layers).

For each agent, in the prompt: the files to read (concrete paths), the goal of the analysis, and the handoff — a markdown section ready to paste. Launch them in a single tool-call block.

Ask each to also report **which third-party technologies** govern its front and in which version the project uses them, read from the dependency manifest and not from memory. It is what you will decide on at point 4, and a front not telling you forces you to reopen those files alone.

If a front stays uncovered or doubtful, do a targeted reading yourself before closing the step, and declare it in the document.

### 3. First draft of `0. problem.md`

Write `{paths.features}/<slug>/0. problem.md`: it describes the problem, documents how it works today, identifies the concrete gaps, highlights trade-offs and doubts, delimits the boundary. **It does not propose solutions** — those arrive from the study of the decisions. **On a resume, when it is already there, it is not written again**: it is the document the run corrects on what the notes and the decisions contradict, and everything else in it stands.

```markdown
# <Problem title> — the problem

> Problem description, without solution. Code-based analysis.
> **Status:** code-based analysis at <date>.

## In one line
[what does not work, what is missing, why it is a problem now — 2-3 sentences]

## How level "X" looks today
[for each involved area: how it works, which components, which patterns,
 with cited files and lines]

## Why this becomes a problem (the gaps)
[numbered, concrete]

## Trade-offs and open doubts
[the tensions the design will have to resolve, with the options at stake]

## Problem boundary (what is NOT in scope here)
[what is not decided and not proposed here]
```

Every statement is anchored to the code (file + lines), with paths relative to the repo root.

**No data, no code excerpts.** This document is pushed and travels beyond this machine: it carries
behaviour, never data. No real data of any kind — no query results, no record contents, no
credentials, no personal names, no business figures — and no code excerpts: cite `file:line` for
the mechanism without quoting what stands there. A literal string from the code enters only when
it is the behaviour's own name (an interface, a state, an error code), never a value it carried.

**A family, not a snapshot.** Describe the problem as the instance of a family of similar problems:
generalise the mechanism (which class of defect, debt or gap this is) while keeping the concrete
facts needed to act (where it bites here, under which conditions, with which observable effect).
The document must let an executor who never saw this program solve this instance — and recognise
the next one.

It is a **first** draft: it is written with the knowledge you have now, and point 5 puts it back in discussion on what the sources will say.

### 4. The missing knowledge — `research`, **worker** role

Look at the third-party technologies the investigation named and ask yourself, for each, whether you know it well enough to *decide* on it. **Study it if at least one** of these holds:

- the project uses it in a version you do not know whether you know, or newer than your cutoff;
- it releases often, and what you know could be two versions old;
- it is young or niche;
- the work will require you to write its signatures, decorators, imports or configuration files, and in the project there is no example to copy them from.

Do not study it if it stands still for years and the feature does not touch its public surface. And if `{paths.studies}/<technology-slug>.md` already exists, **read it before deciding**: if it covers the version in use and is recent, that is the study — reuse it and relaunch nothing. If it covers an older version, launch `research`, which collects and then has `study` reorder them instead of restarting from zero.

**The decision is yours and it is not asked.** The owner asked for a feature, not a study plan. And it is not a choice by feel: the model "feeling confident" on a young library is exactly the case where it invents plausible and wrong signatures. When in doubt study — it costs a fan-out, while an invented API costs a review round, and sometimes passes.

One subagent per technology, all in the same tool-call block. In the prompt:

- the **contract to read**: `skills/research/SKILL.md`, in full, `from-new-feature` invocation — the constraints of that mode stay there and are not recopied here;
- the **resolved input** of that invocation: the `technology` and the `in_use_version` in the project, as the investigation read it from the manifest, and the `questions` the notes must answer — three to six, concrete, derived from the gaps and doubts you just wrote. They are what distinguishes a targeted study from an encyclopedia nobody rereads;
- the **return format**: what the invocation declares (only the file path in `{paths.studies}/`). The notes are read by opening that file, not by reading fields.

If no technology deserves it, say so in one line in chat and move to point 6: point 5 has nothing to re-examine.

### 5. Re-examine, and rewrite the problem

The notes came back, and `0. problem.md` is written on what you knew **before**. Reread it against them and correct what they contradict. What typically emerges:

- a gap that **does not exist**: the library already covers it, with the API the notes carry verbatim;
- a gap existing, but for a different reason than you wrote;
- a trade-off the version in use already closed — or a new one you did not see;
- an API you named and which in that version is not called so, or exists no more.

Corrections are **surgical**: you touch the lines the notes contradict, you do not rewrite the document. Every statement now resting on the notes cites the file and section it comes from.

Add at the tail a **What it rests on** section: the consulted notes with version and date, and the remaining `[to verify]` markers. Those markers are the points where not even the sources answered, and whoever decides must know they are there instead of discovering them while choosing.

**If the notes contradict nothing, write it in one line** and move on: a re-examination finding nothing is a successful re-examination, not a skipped one.

This step is yours and is not delegated: you wrote the document, and you are the only one knowing which statements rested on knowledge you had not verified.

### 6. The study of decisions — `decision-doc`, **judge** role

A subagent in a fresh context. In the prompt:

- the **contract to read**: `skills/decision-doc/SKILL.md`, in full, before acting, in the *From `new-feature` — study* mode that file declares. **On a resume this point runs only when the folder carries no decision document** — nothing was studied yet; a document already there is not studied again, it is asked at point 7, and if a reopened problem puts the study back in discussion, that contract updates it in place;
- the **resolved input**: the `{paths.features}/<slug>/` folder and, inside, `0. problem.md` — it is already the base document of the problem, there is nothing to concatenate;
- the **material the request came with**: a brief, an analysis, a plan, when they exist outside that folder. They travel as material **to interrogate**, never as a direction already settled — and an implementation plan or a list of open decisions among them is the first thing the stage judgement has to face, not the frame it inherits: a direction resting on them is `material` in the block, and the stage that follows is `strategic`;
- the **note paths** point 4 produced or reused, with the instruction to open them before studying the options. They are the reason you spent that fan-out: a technical option motivated on model memory, when the source is on disk, is the defect this chain exists to avoid;
- the **pertinent memory**: `{memory.index}` and the paths you opened at point 1;
- the **perimeter constraint**: it writes only inside that folder, does not commit and does not push;
- the **return format**: the block that contract declares in its own § *The block you return*, in full.

### 7. Decisions are asked in chat

**With `--no-ask` this point does not run at all.** No question is asked: for every card the run takes the recommended option (`A`), the one the study marked as such, and the document of the stage reached is produced and left in the folder. The run stops there, and the delivery (point 10) does not run either: `--no-ask` produces a document and sets it aside for another moment, never executing without the owner's consent. A `strategic` stage stops at `0.5. strategic-study.md` and does not cross to the technical one — the crossing is the incorporation of the owner's direction, and there is no direction here — by the rule of `skills/decision-doc/SKILL.md` § *The two stages*.

Otherwise, the block came back and carries **structured** `decisions`, and the phase that produced it is closed: every subagent of this run has returned, and nothing is still in flight. You ask them of the owner as a structured question, per § *Ask the owner* of `contracts/orchestration.md`, which says what precedes the ask, how that form renders on the current host, and what interrupts it.

**On a resume the list does not come from a block.** It is what the folder's decision document carries **without an answer** — the cards without their `Choice:` line, read from the document itself, same titles and same options in the same order, nothing summarised and nothing added — and each question carries **the card's own number in that document's list**: the numbering the owner rereads, and the only place a resumed list opens that is not `1/N`. There is no block to validate with the evaluator here: the document was validated when it was written, and this is its ask.

**The list is asked whole, and its place is written in the question.** Each question opens with `k/N` — its own place and the length of the list — and the calls follow one another **in this same turn** until `N/N` has been asked: four is the ceiling of the tool, never the end of the list, and the cards after the ceiling are not a second thought but the same act. `hooks/lib/ask-guard.mjs` is the seat that holds the run to it: it refuses a batch that does not continue its list, and it refuses the launch of a subagent while the ask stands open — so the run cannot reach the incorporation, the brief or the delivery with cards the owner has not seen. An owner's message closes the ask as it closes everything, and their free answer prevails.

**An instruction covers the list it was given on, and that list alone.** When the owner answers — "{A}" on three cards, or "use the recommended ones" over a block laid in front of them — that answer is theirs **on that list**, and it is not a preference standing for decisions that did not exist when they spoke. A list they have never seen is asked, always: the answers already in hand do not reach it, and reading a general instruction as permission to decide the rest is exactly the inference this point exists to forbid. A run that has already asked once is where the temptation arrives, and a run that has already asked once is where it must not land. The only lists not asked are the ones `--no-ask` suppresses, and the one the owner covers by naming it: they must say so — the stage, or a scope reaching it ("from now on the recommended ones", "the technical ones too"). Failing that, ask.

**Before the question, the message.** In chat, decision by decision and in the block's own order, you report what it carries as it came back: the title, the problem, each option with its letter and with what it entails and costs, the recommended one with its why. It is the functional content of the document hosting them — `1. decision-doc.md` at the technical stage, `0.5. strategic-study.md` at the strategic one — the same cards, nothing summarised and nothing reordered — and it is what the owner reads before choosing: the chat goes quiet, they read the problems and the proposed solutions, and only then the options appear.

**Before it, two declarations.** The block carries whose direction this stage executes (`direction`, with the owner's words) and the claims it rests on (`premises`, with the source of each): report both as they came back, in two lines. They are what the owner checks fastest, and the only place where a direction that is not theirs — one the material proposed, that nobody confirmed — is seen by them before it becomes an answer.

From each block item you derive a single question, **opening with its place in the list** — `k/N`, its own place and the length of the list — then the title and the problem in question form, its 2-4 options **in the same order of the block** (by contract the recommended is always `A` and already stands first), each with one line on what it entails, and `A` declared as recommended. The recommended is said by `recommended_id`, never by bold in the document: you do not infer it, you read it.

- **Do not summarise and do not reorder** what the subagent wrote, and add no options. A summarised list is a list to which the owner answers with less than was studied.
- **On a resume, do not re-ask what the document already answers and do not renumber.** Only the cards without their `Choice:` line are asked, and they keep the place they have in the document: renumbered from `1`, the chat and the document would count different things — and the document is what the owner rereads when deciding.
- **Whether the block has its shape is asked, not eyeballed.** Call `architect/architect.mjs` — the evaluator that `skills/ship-feature/SKILL.md` § *The evaluator* declares — with `question: "block"`, `name: "decision-doc"` and `block` (what came back, parsed, or `null`). It checks the fields and domains `schemas/blocks.json` declares, and the rules of `skills/decision-doc/SKILL.md` § *The block you return*: `decisions` an array or `null`, `recommended_id` always `"A"`, options `A`, `B` (, `C`, `D`) in order, 2 to 4 of them, and `crossed_stages` in agreement with the stage, the incorporated answers and the list returned. **A block that did not come back and a block that came back `invalid` fail differently**, and one relaunch each (§4.2 of `contracts/orchestration.md`):
  - **nothing came back** — no block at all, or prose instead of one — the step did not return. Relaunch it once with the **identical prompt**: it has to produce the same work again.
  - **a block came back and the evaluator called it `invalid`** — a required field absent, malformed, or a field outside its domain. It came back, and this is a form defect, deterministic by nature: the identical prompt reproduces it, so relaunch the **same** subagent with the same prompt **plus `blockers`**, declaring that what is asked is the encoding and not a second thought on the substance: fixing the field is not re-deciding.
  `blockers` carries the faults the validation named, and is empty when nothing came back; if the second relaunch fails too, what follows is the table of § *If a step fails*.
- **Do not add a "decide yourself" option**: the recommended is already that, and the owner with no preferences confirms it in one gesture.
- **Do not turn into a question what is not a decision.** The verdict, the already applied fixes and the findings judged legitimate choices stand in the block for you to **report** them, not to ask them.
- If the owner answers **outside** the options, that answer prevails and passes verbatim to incorporation.

**It is the only point where you stop.** When the answers arrive you do not ask confirmation to continue: continue. **An answer that asks is not an answer**: if the owner's reply carries a question, you answer it in chat and the run stops there — no second question, the decisions stay open — and it is the owner who asks to resume the chain, launching this node again **naming the folder** — which is the resume of point 1: the folder is the confirmation, and the chain picks up where its documents say.

**A turn that asks for work is neither an answer nor a question.** A reply asking for something to be **made** — a correction to `0. problem.md`, another technology to study, a decision reconsidered, and code as well, once the delivery has run — is work, and work is not done here. You **delegate it**: one subagent in a fresh context, on the **worker** role where the work applies a delimited change and on the **judge** role where it decides, with the contract of the step of this sequence that owns the artefact it touches, and the owner's request **verbatim** as its resolved input. What comes back is its block, and you report that. Writing it here is what fills this window with the work itself, and the window is the thing the run exists to keep small: it is the same rule by which no phase of the sequence is done in here (§4 of `contracts/orchestration.md`), applied to the turns that arrive from outside it.

**This holds inside this run, and only inside it.** The rule is the run's, not the method's: a conversation that did not open this node — the owner working on his own, a feature delivered in another session — owes it nothing, and there the work is done where it arrives. And when the request is not a change to what this run produced but a **different problem**, you do not improvise a step for it: you say so, and the owner opens it as its own run with its own folder.

### 8. Incorporation — `decision-doc`, **judge** role

A second subagent, fresh context. Same contract, *From `new-feature` — incorporation* mode. In the prompt, besides folder, notes and memory as at point 6: the **owner answers**, decision by decision, **verbatim**, including the free ones — and on a resume that found them already written in the document, the answers are the document's, cited as such.

### 9. If the stage was strategic, return to 7

The point-6 block declares the `stage`. If it was `strategic`, incorporation closes the decisions in `0.5. strategic-study.md` and **continues to the technical stage in the same run on its own**, as its contract prescribes: the returning block then carries `stage: technical`, `crossed_stages: true` and a new decision list. **Return to point 7 and ask them.** That list is the case the scope rule of point 7 names: it did not exist when the owner answered the strategic one, so nothing they said then covers it. `crossed_stages` is what says the block was produced by crossing — and it is not your judgement to make: the evaluator refuses a block where the flag and `stage`, `incorporated` and `decisions` disagree, so a crossing that returns the new list together with the answers it has just incorporated is caught there, by construction, before you read it.

**Only one extra round.** If the second block also comes back `strategic`, the problem is not ready to be executed: stop, report to the owner the verdict and what remains open, and leave the folder as it is. There is no third round, and one does not move to delivery with the direction still under discussion.

### 10. Delivery — `ship-feature`, **worker** role — or stop at the brief

**Brief stop — judge role.** If `$ARGUMENTS` carries `--stop-at-brief`, do not open the delivery: delegate instead a subagent running `skills/blueprint/SKILL.md`, on the **judge** role — the brief is a decision on the plan, and `skills/ship-feature/SKILL.md` § *1. Brief* runs it on that role — with the folder and the **chosen solution** (for each decision the id and text of the option the owner chose, as they wrote them; `A` where they did not answer). The expected outcome is the block `skills/blueprint/SKILL.md` declares in its own § *What you return*, in full: report it, and stop here. The run delivers the folder with `0. problem.md`, `1. decision-doc.md` and `2. blueprint.md` — no execution, no commit, no push: carrying the folder wherever its execution runs is the owner's manual act.

Otherwise, the delivery. The technical decisions are closed: `1. decision-doc.md` exists and its cards have an answer. Delegate the whole delivery to a subagent running `skills/ship-feature/SKILL.md`, on the **worker** role — its order, its decision and its unblock are verdicts of the evaluator, and the judging phases it launches declare their own role — with the folder and the **chosen solution** — for each decision the id and text of the option the owner chose, as they wrote them. For a card they did not answer, `A` holds, which by contract is the recommended one, without asking.

From there on the sequence is its own and you do not rewrite it here — and it is not recited here either: **it is asked**. Call `architect/architect.mjs` — the evaluator that `skills/ship-feature/SKILL.md` § *The evaluator* declares — with `question: "order"`, `entry: "new-feature"`, `present` (the artefacts already on disk) and `ledger` (the review ledger of this folder in `{paths.review_state}/`, or `null`), the input that section declares, and its verdict says which phases remain. **Do not launch yourself `execute`, `/review` or `/commit`, and do not launch `blueprint` except for the brief stop above**: they are the phases of `ship-feature`, and chaining them from here means keeping two copies diverging at the first modification.

The expected outcome is the block that contract declares in its own § *Outcome*, in full. Report it: its `status` is yours.

## If a step fails

A step has failed when the block does not come back, comes back incomplete or comes back in prose. It is relaunched **only once**, and how depends on the failure (§4.2 of `contracts/orchestration.md`): the **identical prompt** when nothing came back, the same prompt **plus `blockers`** when the block came back and the evaluator called it `invalid` — a form defect the identical prompt would reproduce. If the second attempt fails too:

| Step | What follows |
|---|---|
| an investigation front | you cover it with a targeted reading and declare it in the document |
| `research` | proceed **without** those notes, and in the document mark `[to verify]` the points they had to cover. Do not write from memory the facts the study had to carry: it is exactly what was being avoided |
| `decision-doc` (point 6) | the chain stops. `0. problem.md` stays delivered, and you say so with the command to launch by hand on the folder. **Do not write the decisions yourself**: asking them here means writing them outside the document hosting them |
| incorporation (point 8) | it is the worst case, because the owner answers exist only in chat. Report them **verbatim** in the outcome, together with the command to incorporate them with, and stop |
| `ship-feature` (point 10) | its block already declares its own failures: report it as it is, without reinterpreting it |
| `blueprint` (point 10, brief stop) | its block already declares its own failures: report it as it is, without reinterpreting it |

## Operational constraints

- Respect the runtime constraints `{hosts.<host>.instructions_file}` declares, and in any case: **no searches on the whole filesystem**.
- **Do not commit** and do not push: commit belongs to delivery, which runs on its own worktree.
- Outside the problem folder one writes only in `{paths.studies}/`, and `research` (collection) and `study` only via `research` (reordering) write there. **A notice repeats the rule where a write would break it**: while the run it opened is open, a write made from here outside those seats and the `{write_roots}` the machine declares is where the reminder arrives — it is work, and work is a subagent, whose own write passes. Nothing is blocked, and no file is an exception for existing: the reminder says the rule, and the judgement stays here.
- **Always use paths relative to the repo root** for file links.
- Save in the project encoding, without degrading non-ASCII characters.

## Outcome

In chat, a few lines:

- the path of the opened folder and the documents it carries;
- the analysed areas and the identified gaps;
- the produced or reused notes, with version and date, and what the recomparison changed in the problem (or that it changed nothing);
- the crossed stages, the decisions asked and the answer received for each;
- the delivery outcome: `status`, commit and merge SHA, and the report path — the detail is already inside there, **do not repeat it**. With `--stop-at-brief` there is no delivery outcome: report the brief path instead, and that carrying the folder on is the owner's manual act. With `--no-ask` there is no delivery outcome: report the stage reached and the document the folder carries — produced with the recommended option for every card — and that the run stops there without asking and without delivering, with the command that resumes the chain — the same one point 7 declares for a run stopped at the ask.

If the chain stopped before delivery, say so with the point where it stopped and the command the owner resumes it with — **this node, naming the folder** — and with what the resume will find there: the card left open, or the phase its documents reach.

## Self-deceptions (stop them before they stop you)

| If you are telling yourself… | The truth |
|---|---|
| "The folder is already there, so I redo the investigation and write the problem again" | The documents are the state the chain keeps: the verdict says where it resumes, and a phase whose document is present is not written again. |
| "The cards are in the document, so I ask them all again" | Only the cards without their `Choice:` line are asked: re-asking a closed one makes the owner decide it twice. |
| "I renumber the cards left open from 1" | The document's numbering is the card's identity, in the chat and in the document alike: the open cards keep the place they have in it. |
| "I know this library, I skip the study" | It is the sentence preceding an invented signature. The point-4 criterion is a list of conditions, not a feel. |
| "The notes came back, I pass them downstream and go" | Point 5 is not a handoff: it is you putting back in discussion what you wrote before knowing them. |
| "I summarise the decisions, so the owner reads less" | Decisions are asked verbatim. What you cut is exactly what you are not letting them choose on. |
| "They said 'use the recommended ones', so it covers these too" | That answer was given on a list they read. A list that did not exist when they spoke — above all the technical one the crossing produces — is asked: a general instruction is not a permission to decide in their place, and `crossed_stages` exists to make the run stop there by construction instead of by judgement. |
| "I ask confirmation before launching delivery" | They already answered. The extra confirmation is the gesture this skill exists to spare them. |
| "Nobody is here to choose, so I take the recommended option and deliver" | `--no-ask` does take the recommended option (`A`) for every card and produces the document of the stage reached — but it stops there: it never proceeds to the delivery. The document is set aside for another moment; nothing is executed without the owner's consent. |
| "I ask the decisions while a fan-out is still running, so they answer sooner" | The answer lands on a state the work in flight can still change. The ask is the last act and it is emitted alone (§ *Ask the owner* of `contracts/orchestration.md`). |
| "They asked me something, so I explain and re-ask the options" | A reply carrying a question is a discussion, not an answer: you answer and the run stops. Re-asking makes them choose before they have finished asking. |
| "I do the brief myself, since I have everything in mind" | Having it in mind is the problem: every phase is a subagent in a fresh context, and delivery belongs to `ship-feature`. |
| "The owner asked me for one small change, I make it here" | It is work, and work is a subagent: one fresh context, the contract of the step that owns what it touches. Made here it fills the window with the work itself, which is what the run exists to prevent — and a notice repeats the rule at that very write. |
| "The decision-doc I write here, it is faster" | The document is written by the node hosting it. Written here, it originates inside the context that just investigated — that is already convinced. |
| "The stage is still strategic but the direction is clear to me: I proceed" | If it were clear, the `judge` step would not have stopped it there. Two rounds, and then one stops. |
| "I use the biggest model, this step looks hard to me" | The model comes from the role declared by the step, resolved with §2 of `contracts/orchestration.md`. |

## Cut rule

This skill owns **the opening of the work**: the folder, the code investigation, the decision of what to study, the recomparison, and the channel to the owner for the decisions. It does not own the *content* of what it delegates: how a technology is studied, how decisions are studied, how a feature is delivered — all of it lives in their files, read by the subagents on every run. If you catch yourself rewriting here *how* a brief is made or *how* to choose between two libraries, you strayed from the purpose.
