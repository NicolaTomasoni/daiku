---
name: 'new-feature'
description: 'Opens a feature from a natural-language description and carries it to the commit in a single run: code investigation, study of the technologies you do not know well enough, decision document, decisions asked in chat, and from there the whole delivery delegated to develop-feature'
argument-hint: '<feature or problem description>'
---

You are the node **opening** a work and not leaving it halfway. You receive a natural-language description, you investigate the code, you procure the missing knowledge, you have the decisions studied, you bring them to the owner in chat — and with their answers in hand you continue to the commit without them having to relaunch anything.

**The owner intervenes only once**, when answering the decisions. Before that you ask them nothing, because there is still nothing to ask; after that you ask them nothing, because they already decided, and one more confirmation is a step that costs them effort and adds no information.

> **Parameters.** Every key in braces in this contract resolves on the project parameter files, never from memory and never by assumption: the rules are in §5 of `contracts/project-contract.md`, which also says **in which language to write** and what to do when a key is missing.

## When to use it

Use it when you start from an idea or a problem and there is nothing on disk yet. It is the only entry point that starts from the **code** instead of a document, and the only one that opens the folder; `decision-doc` and `develop-feature` are its internal phases, never launched on their own.

## Before starting

Read `contracts/orchestration.md`: roles, host, how to launch a subagent, how a question is asked of the owner, concurrency. Each step below declares its own role (**judge** or **worker**) and you resolve the model with the rule of its §2 — never from here.

## Input

Arguments: `$ARGUMENTS` — the work description in natural language. It can be a feature to make, a question on how to do something the system does not do yet, a gap ("the wiring between X and Y is missing"), an architectural tension ("two components do the same thing").

If `$ARGUMENTS` is empty, **ask** what is worked on and wait until it arrives. It is the only question admitted before the decisions.

## The sequence

The phases are ordered and not skippable. Each declares its own role, and every delegated step is **one subagent in a fresh context** with the prompt giving it the contract to read, the resolved input and the block to return (§4 of `contracts/orchestration.md`).

Progress and findings go **in chat**, as you go: one line when a phase starts and when it returns, and immediately what you noticed and what needs no block. Keep no log on file: the state needed to resume is the documents the phases deposit in the folder.

### 1. Open the folder, and the memory

From the description derive a kebab-case **slug** saying the *problem*, not the solution — you have not chosen the solution yet, and a slug naming it orients everything coming after. The folder is `{paths.studies}/<slug>/`: create it. If it already exists, ask confirmation before working inside it — it is the only other question admitted before the decisions.

Open `{memory.index}` and the memories the problem area touches: it is the channel of §4.1 of `contracts/orchestration.md`. A gap a memory already closed is not a gap, and a trade-off the owner already decided is not reopened here. The paths you choose now you will pass to every step deciding or writing.

### 2. Code investigation — **worker** role

Understand how the system works today in the problem area. Launch **worker subagents in parallel**, **one per investigation front**. You derive the fronts from the problem, not from a list: typically one for each `{areas}` area the problem touches, plus two cross-cutting ones almost always needed — **configuration and startup** (settings, environment, what the system reads when starting) and **architecture** (flows, invariants, boundaries between layers).

For each agent, in the prompt: the files to read (concrete paths), the goal of the analysis, and the handoff — a markdown section ready to paste. Launch them in a single tool-call block.

Ask each to also report **which third-party technologies** govern its front and in which version the project uses them, read from the dependency manifest and not from memory. It is what you will decide on at point 4, and a front not telling you forces you to reopen those files alone.

If a front stays uncovered or doubtful, do a targeted reading yourself before closing the step, and declare it in the document.

### 3. First draft of `0. problem.md`

Write `{paths.studies}/<slug>/0. problem.md`: it describes the problem, documents how it works today, identifies the concrete gaps, highlights trade-offs and doubts, delimits the boundary. **It does not propose solutions** — those arrive from the study of the decisions.

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

It is a **first** draft: it is written with the knowledge you have now, and point 5 puts it back in discussion on what the sources will say.

### 4. The missing knowledge — `research`, **worker** role

Look at the third-party technologies the investigation named and ask yourself, for each, whether you know it well enough to *decide* on it. **Study it if at least one** of these holds:

- the project uses it in a version you do not know whether you know, or newer than your cutoff;
- it releases often, and what you know could be two versions old;
- it is young or niche;
- the work will require you to write its signatures, decorators, imports or configuration files, and in the project there is no example to copy them from.

Do not study it if it stands still for years and the feature does not touch its public surface. And if `{paths.lib_notes}/<technology-slug>.md` already exists, **read it before deciding**: if it covers the version in use and is recent, that is the study — reuse it and relaunch nothing. If it covers an older version, launch `research`, which collects and then has `study` reorder them instead of restarting from zero.

**The decision is yours and it is not asked.** The owner asked for a feature, not a study plan. And it is not a choice by feel: the model "feeling confident" on a young library is exactly the case where it invents plausible and wrong signatures. When in doubt study — it costs a fan-out, while an invented API costs a review round, and sometimes passes.

One subagent per technology, all in the same tool-call block. In the prompt:

- the **contract to read**: `skills/research/SKILL.md`, in full, `from-new-feature` invocation — the constraints of that mode stay there and are not recopied here;
- the **resolved input** of that invocation: the `technology` and the `in_use_version` in the project, as the investigation read it from the manifest, and the `questions` the notes must answer — three to six, concrete, derived from the gaps and doubts you just wrote. They are what distinguishes a targeted study from an encyclopedia nobody rereads;
- the **return format**: what the invocation declares (only the file path in `{paths.lib_notes}/`). The notes are read by opening that file, not by reading fields.

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

- the **contract to read**: `skills/decision-doc/SKILL.md`, in full, before acting, in the *From `new-feature` — study* mode that file declares;
- the **resolved input**: the `{paths.studies}/<slug>/` folder and, inside, `0. problem.md` — it is already the base document of the problem, there is nothing to concatenate;
- the **note paths** point 4 produced or reused, with the instruction to open them before studying the options. They are the reason you spent that fan-out: a technical option motivated on model memory, when the source is on disk, is the defect this chain exists to avoid;
- the **pertinent memory**: `{memory.index}` and the paths you opened at point 1;
- the **perimeter constraint**: it writes only inside that folder, does not commit and does not push;
- the **return format**: the block that contract declares in its own § *The block you return*, in full.

### 7. Decisions are asked in chat

The block came back and carries **structured** `decisions`. You ask them of the owner as a structured question, per § *Ask the owner* of `contracts/orchestration.md`, which says how that form renders on the current host.

From each block item you derive a single question: the title and the problem in question form, its 2-4 options **in the same order of the block** (by contract the recommended is always `A` and already stands first), each with one line on what it entails, and `A` declared as recommended. The recommended is said by `recommended_id`, never by bold in the document: you do not infer it, you read it.

- **Do not summarise and do not reorder** what the subagent wrote, and add no options. A summarised list is a list to which the owner answers with less than was studied.
- **Whether the block has its shape is asked, not eyeballed.** Call `architect/architect.mjs` — the evaluator that `skills/develop-feature/SKILL.md` § *The evaluator* declares — with `question: "block"`, `name: "decision-doc"` and `block` (what came back, parsed, or `null`). It checks the fields and domains `schemas/blocks.json` declares, and the rules of `skills/decision-doc/SKILL.md` § *The block you return*: `decisions` an array or `null`, `recommended_id` always `"A"`, options `A`, `B` (, `C`, `D`) in order, 2 to 4 of them. On `invalid` the step has failed (§4.2 of `contracts/orchestration.md`): relaunch it only once with the identical prompt, and `blockers` says what was wrong.
- **Do not add a "decide yourself" option**: the recommended is already that, and the owner with no preferences confirms it in one gesture.
- **Do not turn into a question what is not a decision.** The verdict, the already applied fixes and the findings judged legitimate choices stand in the block for you to **report** them, not to ask them.
- If the owner answers **outside** the options, that answer prevails and passes verbatim to incorporation.

**It is the only point where you stop.** When the answers arrive you do not ask confirmation to continue: continue.

### 8. Incorporation — `decision-doc`, **judge** role

A second subagent, fresh context. Same contract, *From `new-feature` — incorporation* mode. In the prompt, besides folder, notes and memory as at point 6: the **owner answers**, decision by decision, **verbatim**, including the free ones.

### 9. If the stage was strategic, return to 7

The point-6 block declares the `stage`. If it was `strategic`, incorporation closes the decisions in `0.5. strategic-study.md` and **continues to the technical stage in the same run on its own**, as its contract prescribes: the returning block then carries `stage: technical` and a new decision list. Return to point 7 and ask them.

**Only one extra round.** If the second block also comes back `strategic`, the problem is not ready to be executed: stop, report to the owner the verdict and what remains open, and leave the folder as it is. There is no third round, and one does not move to delivery with the direction still under discussion.

### 10. Delivery — `develop-feature`

The technical decisions are closed: `1. decision-doc.md` exists and its cards have an answer. Delegate the whole delivery to a subagent running `skills/develop-feature/SKILL.md`, with the folder and the **chosen solution** — for each decision the id and text of the option the owner chose, as they wrote them. For a card they did not answer, `A` holds, which by contract is the recommended one, without asking.

From there on the sequence is its own and you do not rewrite it here — and it is not recited here either: **it is asked**. Call `architect/architect.mjs` — the evaluator that `skills/develop-feature/SKILL.md` § *The evaluator* declares — with `question: "order"`, `entry: "new-feature"` and `present` (the artefacts already on disk), the input that section declares, and its verdict says which phases remain. **Do not launch yourself `blueprint`, `execute`, `/review` or `/commit`**: they are the phases of `develop-feature`, and chaining them from here means keeping two copies diverging at the first modification.

The expected outcome is the block that contract declares in its own § *Outcome*, in full. Report it: its `status` is yours.

## If a step fails

A step has failed when the block does not come back, comes back incomplete or comes back in prose. It is relaunched **only once**, with the identical prompt (§4.2 of `contracts/orchestration.md`). If it does not come back even then:

| Step | What follows |
|---|---|
| an investigation front | you cover it with a targeted reading and declare it in the document |
| `research` | proceed **without** those notes, and in the document mark `[to verify]` the points they had to cover. Do not write from memory the facts the study had to carry: it is exactly what was being avoided |
| `decision-doc` (point 6) | the chain stops. `0. problem.md` stays delivered, and you say so with the command to launch by hand on the folder. **Do not write the decisions yourself**: asking them here means writing them outside the document hosting them |
| incorporation (point 8) | it is the worst case, because the owner answers exist only in chat. Report them **verbatim** in the outcome, together with the command to incorporate them with, and stop |
| `develop-feature` (point 10) | its block already declares its own failures: report it as it is, without reinterpreting it |

## Operational constraints

- Respect the runtime constraints `{instructions_file}` declares, and in any case: **no searches on the whole filesystem**.
- **Do not commit** and do not push: commit belongs to delivery, which runs on its own worktree.
- Outside the problem folder one writes only in `{paths.lib_notes}/`, and `research` (collection) and `study` only via `research` (reordering) write there.
- **Always use paths relative to the repo root** for file links.
- Save in the project encoding, without degrading non-ASCII characters.

## Outcome

In chat, a few lines:

- the path of the opened folder and the documents it carries;
- the analysed areas and the identified gaps;
- the produced or reused notes, with version and date, and what the recomparison changed in the problem (or that it changed nothing);
- the crossed stages, the decisions asked and the answer received for each;
- the delivery outcome: `status`, commit and merge SHA, and the report path — the detail is already inside there, **do not repeat it**.

If the chain stopped before delivery, say so with the point where it stopped and the command the owner resumes it with.

## Self-deceptions (stop them before they stop you)

| If you are telling yourself… | The truth |
|---|---|
| "I know this library, I skip the study" | It is the sentence preceding an invented signature. The point-4 criterion is a list of conditions, not a feel. |
| "The notes came back, I pass them downstream and go" | Point 5 is not a handoff: it is you putting back in discussion what you wrote before knowing them. |
| "I summarise the decisions, so the owner reads less" | Decisions are asked verbatim. What you cut is exactly what you are not letting them choose on. |
| "I ask confirmation before launching delivery" | They already answered. The extra confirmation is the gesture this skill exists to spare them. |
| "I do the brief myself, since I have everything in mind" | Having it in mind is the problem: every phase is a subagent in a fresh context, and delivery belongs to `develop-feature`. |
| "The decision-doc I write here, it is faster" | The document is written by the node hosting it. Written here, it originates inside the context that just investigated — that is already convinced. |
| "The stage is still strategic but the direction is clear to me: I proceed" | If it were clear, the `judge` step would not have stopped it there. Two rounds, and then one stops. |
| "I use the biggest model, this step looks hard to me" | The model comes from the role declared by the step, resolved with §2 of `contracts/orchestration.md`. |

## Cut rule

This skill owns **the opening of the work**: the folder, the code investigation, the decision of what to study, the recomparison, and the channel to the owner for the decisions. It does not own the *content* of what it delegates: how a technology is studied, how decisions are studied, how a feature is delivered — all of it lives in their files, read by the subagents on every run. If you catch yourself rewriting here *how* a brief is made or *how* to choose between two libraries, you strayed from the purpose.
