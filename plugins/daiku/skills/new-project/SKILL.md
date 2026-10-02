---
name: 'new-project'
description: 'Writes the five founding documents on a project already opened with Daiku — PRODUCT, BRAND, DOMAIN, STACK and ARCHITECTURE — resolving each role''s path from the `documents` group in `.daiku/project.json`, reading the package skeletons and filling them with what the project declares and with what the owner answers. Re-runnable: it realigns the documents when the project changes without overwriting manual work, and it degrades when a role is not declared.'
argument-hint: '[technical root, optional — default: current directory]'
---

You are the step writing a project's **founding documents**: the five documents a reader opens to learn what the system does, for whom, why, and with what it is built. `init` assigns their seats in `.daiku/project.json`, but it does not write them; you do. You are launched by hand, **after `init`**, on a project that is being born.

The five roles and the question each document answers:

| Role | Document (H1) | The question it answers |
|---|---|---|
| `product` | `PRODUCT.md` | the offer: what it does, for whom, why, and what it is not |
| `brand` | `BRAND.md` | identity and market: name, positioning, competition, channels |
| `domain` | `DOMAIN.md` | entities, data, interfaces and the vocabulary of the project |
| `stack` | `STACK.md` | what it is built with: languages, frameworks, tooling, hosting |
| `architecture` | `ARCHITECTURE.md` | structure, boundaries and the key technical decisions with their why |

> **Parameters.** Every key in braces in this contract resolves on the project parameter files, never from memory and never by assumption: the rules are in §5 of `contracts/project-contract.md`, which also says **in which language to write** and what to do when a key is missing.

## Input: the technical root

Arguments: `$ARGUMENTS` — `[technical root]`.

The **technical root** is the directory the skills run from, the one carrying the project instructions file and `.daiku/`. With an argument, it is that; without an argument, it is the current directory. `.daiku/project.json` must stand there: if it does not, the project has not been opened with Daiku — **stop and say so**, do not run `init` in its place.

## The five documents and where they stand

**The path comes from the project, the shape from the package.** For each role you resolve its path in `.daiku/project.json` under the `documents` group — `documents.product`, `documents.brand`, `documents.domain`, `documents.stack`, `documents.architecture` — and you read the skeleton of the same role from the package, at `<package root>/templates/project/documents/<ROLE>.md`: `<ROLE>` is the role's name in uppercase (`product` → `PRODUCT.md`). `<package root>` is the folder containing `skills/`, `contracts/` and `templates/`, two levels above this file.

The skeleton carries the **frame**, which never changes: the `H1` equal to the document's name in uppercase, a numbered index of contents, the numbered sections, and a closing section saying what the document rests on. What you write is the **content** the project fills those sections with, in `{language.chat}` — **but the file name and the `H1` stay English and uppercase**, whatever the chat language, because they are the identity of the document and the consumers resolve it by name.

**What the project does not declare does not exist.** For each role, if the key `documents.<role>` is absent, that document is **not** produced: skip it, invent none, and declare it in the report (§6 of `contracts/project-contract.md`). The same when the skeleton for a role is missing from the package: no skeleton, no document, declared. Never write a document at a guessed path and never reuse another role's path.

## Procedure

1. **Resolve the technical root** (*Input*) and read `.daiku/project.json` there.

2. **Read the ground before asking.** Open the project's own material — the instructions file, the README, any document the project already keeps — and take from it what the five documents must carry. This is reconnaissance, not an interview: you ask the owner only what the repository cannot tell you.

3. **For each declared role, resolve the pair** — the destination path (`documents.<role>`) and the skeleton (`templates/project/documents/<ROLE>.md`). A role whose key is absent is skipped and declared; a role whose skeleton is missing is skipped and declared.

4. **Ask the owner what the skeletons need.** Ask in one question each only where the material of step 2 leaves a real gap, with `AskUserQuestion`: what the project does and for whom, why it exists, what it is not; the identity and the market; the entities, the interfaces and the vocabulary; what it is built with; the structure and the decisions behind it. Do not ask what a file already answers, and do not turn the interview into a form: the owner's answers fill the sections, the project's files fill the rest.

5. **Write each document** at its declared path, compiling the skeleton of its role: keep the frame (H1, index, numbered sections, closing section) and fill the sections in `{language.chat}` with the material of steps 2 and 4. A section the material does not reach stays a declared gap in the document, never an invention.

6. **Report** (*Report*).

## Re-run: realign, do not overwrite

You are **re-runnable by design**. On a re-run, a document you find is the project's: read it in full and bring it up to date with what changed — the material and the answers of this run — with **surgical edits only**. You never recompose a document whole and never overwrite a section the project rewrote by hand: a founding document lives in the repository and is edited by whoever works there, exactly as the package's other deposited files are. Where what changed is a whole section, update that section and leave the rest; where a document no longer matches its role's path in `project.json`, write it at the new path and say so.

It is the idempotence of `init` applied to these files: the first run creates, the later ones align, and a document a person curated is never flattened back to a skeleton.

## What you do not do

- **You do not touch `.daiku/`**: `project.json`, `environment.json`, `domain/` and `policies/` belong to `init`. You **read** `project.json` for the paths, and you write nothing there.
- **You do not touch the code**, ever: you write the five documents and nothing else.
- **You do not write a document a role does not declare.** An absent key means that document does not exist in this project, not that you pick a path.
- **You do not invent the content.** What the repository and the owner do not say stays a declared gap inside the document, not a plausible sentence: a founding document that invents the offer is worse than a missing one.
- **You do not commit** and do not stage what you wrote: whoever launched you watches what appeared before versioning it.
- **You do not launch `new-feature`** nor any other node: you produce the documents and stop.

## Report

Close in prose, in `{language.chat}`, with one line per document: **created**, **realigned**, or **skipped** with its reason (the key `documents.<role>` is absent, or the package carries no skeleton for that role). Nothing before, nothing after: no list of what you read, no narration of how you worked. On a re-run where nothing changed, a single line saying so.
