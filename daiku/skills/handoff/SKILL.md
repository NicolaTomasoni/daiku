---
name: 'handoff'
description: 'Writes, from the conversation it runs in, the document that hands a job stopped halfway to another agent: the problem, what was done, what is missing and the evidence inlined, because whoever receives it reaches neither this conversation nor the project where the behaviour was observed. It deposits the file and stops.'
argument-hint: '[slug]'
---

You write **one document** and stop: the handoff of a job that is standing halfway. You are the node that runs **in the conversation**, and that is the only place you can run — the problem, the work done and what remains live in the chat you are in, and a step launched as a subagent starts from zero and cannot see it. What you deposit is `{paths.handoffs}/<slug>.md`, and its reader is **another agent, in a fresh context, who knows nothing**: not this conversation, not the case that shows the problem, not the project where it was observed. Everything it needs is written in the file, or the file is useless.

> **Parameters.** Every key in braces in this contract resolves on the project parameter
> files, never from memory and never by assumption: the rules are in §5 of
> `contracts/project-contract.md`, which also says **in which language to write** and what to do
> when a key is missing.

## What the document carries

Five parts, and every datum stands in one of them only.

1. **The problem.** What is wrong, how it shows, and the case that shows it: the exact reproduction — the command, the input, the expected result and the observed one. **The case is written so the reader can run it from here.** Where it can be rebuilt in this repository, the handoff says how; where it cannot, because it was observed in another project, everything it needs travels with it — the input, the configuration, the versions, the code around it — and that project is named, with what of the observation is evidence and what is only context.
2. **What was done.** The work already standing, file by file as `path:line`, with the why of every choice the code does not explain by itself, and the base-ref it started from so the diff can be computed. A decision taken whose alternative is still open is written with that alternative.
3. **What is missing.** The remaining work, in the order it must happen, each item with the verification that will tell it is done. A hypothesis still to be confirmed is declared as one, and never written as a task.
4. **The evidence.** The raw material, inlined: command outputs, traces, logs, version numbers, the environment, and the excerpts of the code that carries the behaviour — **including the ones from the project the reader cannot open**. A fact the reader cannot re-run is quoted with the command that produced it and with its output, verbatim.
5. **Where to work.** The files to touch, the commands to run, the branch, and the repository the reader stands in. Paths are **relative to the technical root**; an absolute path of this machine is not a path for the reader.

## What makes it a handoff, and not a summary

- **The reader starts from zero and cannot ask.** Nothing is left by reference: a file, a folder, a decision or a behaviour named without being quoted is a hole the reader has no way to fill. What you cannot quote, you describe in full — and where the material is out of reach, say which part is missing rather than pointing at where it lives.
- **Only what was verified enters the evidence.** An output you did not run, a line you did not read, a version you took from memory: all of it is declared as unverified or it is not written. A handoff that lies about its evidence is worse than one that declares a gap, because the reader has nothing against which to check it.
- **Secrets do not enter the file.** Logs and traces carry tokens, keys, passwords, personal data and paths of a machine. Redact them where they appear, and say in the file that you did: what the reader needs is the shape of the output, never the credential inside it.
- **The chat is not copied into the file.** The transcript, the attempts that went nowhere and the reasoning already spent do not belong here: what belongs is their outcome — what was tried, what it taught, and what stands.

## Harvesting the evidence — **worker** role

The material the conversation does not hold — the diff standing on disk, the outputs of the commands, the excerpts of the reference project — is collected by **worker subagents** (role and model from `contracts/orchestration.md` §2), launched in a single tool-call block, each of them a **leaf**: they read, run the read-only commands, and return a paste-ready markdown section, one front each. They write no file: **you append**, so two of them never race on the same document.

Give each one the resolved input, the paths it reads, the read-only constraint repeated in its prompt, and the instruction to quote outputs verbatim and to mark with `[not verified]` what it could not reach. A worker that did not come back is relaunched **once** with the identical prompt; on the second failure the section is declared missing in the file, and the handoff says which part of the evidence is absent.

**The perimeter is the host's, and it is not yours to widen.** Where the reference project stands outside the folders this machine admits, the worker does not reach around the refusal: what it cannot read is written in the file as a gap, with what was needed and why. Never a copy of the material through another road.

## Input

Arguments: `$ARGUMENTS`

The argument is an optional short name of the job, in natural language. From it derive a kebab-case **slug**, as `new-feature` does with a problem; with no argument, derive the slug from the problem itself. The target file is `{paths.handoffs}/<slug>.md` — create the folder if it does not exist. **One file per job**, and a relaunch on the same slug **overwrites it** with the updated state: the file is the state, and two versions of it would leave the reader choosing.

**With no work in the conversation there is no handoff.** If this session did not carry the job — a cold launch, a conversation about something else — you have no problem, no work done and no evidence, and nothing is written: say so and stop. Do not reconstruct a handoff from the repository alone and do not ask the owner to describe what the conversation did.

## Procedure

1. **Read the material the conversation holds.** The problem as it was stated and then refined, what was actually done, what was decided and what stayed open, the commands run and their outcomes. **What the conversation states is a claim, not yet evidence**: every fact that can be re-established is re-established before it enters the file.
2. **Measure the ground.** `git rev-parse HEAD` for the base-ref, `git status --porcelain` and `git diff --stat` against it for what stands modified, `git log --oneline` for the commits already made. These values come from Git, never from memory.
3. **Harvest** the evidence the conversation does not hold, as § *Harvesting the evidence* declares.
4. **Write the file**, in `{language.chat}`, in the five parts of § *What the document carries*, and open it with a header line carrying the origin, the date, the base-ref and the repository. Append each harvested section as it returns, checking that its code fences are well formed.
5. **Reread it against the reader.** One question, over the whole file: *what does this text assume that a fresh agent does not have?* Every answer is a hole — close it, or declare it as a gap in the evidence. The file is finished when that question returns nothing.

## Operational constraints

- **You write `{paths.handoffs}/<slug>.md` and nothing else.** Not the code, not a feature folder, not a memory: this node deposits one document.
- **You do not commit and you do not push.** The file is left in the working tree; whether it enters history is the owner's gesture, not yours.
- **You do not resolve the job.** The problem stays open and the tasks stay undone: you describe them, you do not do them, and the temptation to fix one thing on the way is exactly what the handoff exists to prevent.
- Work autonomously end to end without asking confirmation: the material is in front of you, and a question to the owner would be about work you can read.

## Outcome

Report in chat, short: the file's path, the problem in one line, how much of the job it hands over and what the reader is expected to finish — and, where it applies, which part of the evidence is a declared gap. Then end with the file's path alone, on its own line: it is the whole outcome, and whoever resumes reads the file, not a block.
