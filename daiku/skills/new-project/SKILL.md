---
name: 'new-project'
description: 'Writes the five founding documents on a project already opened with Daiku — PRODUCT, BRAND, DOMAIN, STACK and ARCHITECTURE — resolving each role''s path from the `documents` group in `.daiku/project.json`, reading the package skeletons and filling them with what the project declares and with what the owner answers. Re-runnable: it realigns the documents when the project changes without overwriting manual work, closes into a git stash a file of the project''s standing at a seat, and it degrades when a role is not declared.'
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

The skeleton carries the **frame**, whose structure never changes: the `H1` equal to the document's name in uppercase, a guide paragraph under it saying what the document must contain and what does not belong there, a numbered index of contents, the numbered sections, and a closing section saying what the document rests on. **Only the file name and the `H1` stay English and uppercase**, whatever the chat language, because they are the identity of the document and the consumers resolve it by name: the guide, the index line, the numbered section titles and the content are all written in `{language.chat}`. What you write is the **content** the project fills those sections with.

**What the project does not declare does not exist.** For each role, if the key `documents.<role>` is absent, that document is **not** produced: skip it, invent none, and declare it in the report (§6 of `contracts/project-contract.md`). The same when the skeleton for a role is missing from the package: no skeleton, no document, declared. Never write a document at a guessed path and never reuse another role's path.

**A document the project already keeps for a role is that role's predecessor, and it does not stay beside yours.** While reading the ground you see what the project already wrote to answer these questions — a note of branding beside `BRAND.md`, a `TECH-STACK.md` beside `STACK.md`. Where the project keeps a document whose name carries the role's own — the role's name inside it, separators and case aside — that document is the role's predecessor, and you do three things with it and no fourth:

- your document **absorbs it in full**: that is what your document is for, and one that leaves out what the project already knew is worse than one that repeats it;
- the file is **closed into a git stash and removed from the working tree**: nothing of it stands on disk — not beside your document and not under any other name — and what survives is its content, which the repository keeps;
- the document's closing section names it **as it stood when you closed it**, saying where it went — `BRANDING.md`, closed into the stash by this document. It is not a path: the file is gone, and a source line citing a path that does not stand is a lie the next reader acts on.

The entry is made with the pathspec, and never with a bare `git stash`:

```
git stash push -u -m "daiku: <role> — <path> superseded by <documents.<role>>" -- "<path>"
```

Without the pathspec it would take the whole working tree, and what else is in progress there is not yours to move. You never `pop` it and never `drop` it: the stash is a place of deposit. Where the file is tracked and clean, Git has nothing to save and says so — the content is in the history already, and removing the file is what closes it. You read it **before** closing it; after, it comes back with `git stash show -p stash@{n} -- "<path>"` (`git show stash@{n}^3:"<path>"` for a file that was untracked), `n` being the entry you just made.

**The instructions file and the `README` are never predecessors**, whatever they carry: they stay where they are, feeding your documents and being the first thing whoever arrives reads. You do not restructure that file, and a name that has moved for reasons other than this run is reported in your outcome for the next `update-memory` to realign. The line this run has just made dead — the predecessor you closed into a stash, named there — is repaired in the same work: a dead reference is corrected where it stands, never listed.

## Procedure

1. **Resolve the technical root** (*Input*) and read `.daiku/project.json` there.

2. **Read the ground before asking.** Open the project's own material — the instructions file, the README, any document the project already keeps — and take from it what the five documents must carry. This is reconnaissance, not an interview: you ask the owner only what the repository cannot tell you.

3. **For each declared role, resolve the pair** — the destination path (`documents.<role>`) and the skeleton (`templates/project/documents/<ROLE>.md`). A role whose key is absent is skipped and declared; a role whose skeleton is missing is skipped and declared.

4. **Ask the owner what the skeletons need.** Ask in one question each only where the material of step 2 leaves a real gap, with `AskUserQuestion`: what the project does and for whom, why it exists, what it is not; the identity and the market; the entities, the interfaces and the vocabulary; what it is built with; the structure and the decisions behind it. Do not ask what a file already answers, and do not turn the interview into a form: the owner's answers fill the sections, the project's files fill the rest. **Where there is nobody to ask** — a chained run, a session with no interactive channel — do not invent and do not stop: the sections your questions concerned stay declared gaps, exactly like the ones no file answers.

5. **Write each document** at its declared path — opening first whatever stands there, as *A file found at the declared path is the project's* says — compiling the skeleton of its role: keep the frame (H1, index, numbered sections, closing section) and fill the sections in `{language.chat}` with the material of steps 2 and 4. A section the material does not reach stays a **declared gap**, never an invention: the skeleton's placeholder is left **verbatim**, in English, exactly as the package carries it, and nothing is written in its place. That line is the gap's form — what tells a reader, and a later run, which parts the project has not yet answered — and a plausible sentence in its place is the one thing worse than leaving it. Where the material reaches the section but leaves part of it open, the section is written and that part is declared in `{language.chat}`, in one line that says so; the placeholder is for what the material does not reach at all.

6. **Report** (*Report*).

## A file found at the declared path is the project's

You are **re-runnable by design**, and the rule holds on the first run too: before writing at a role's path, open the file standing there, if any, and read it in full. What you do next depends on what you found.

**It carries the role's frame** — the `H1` of the role in uppercase and the numbered sections of the skeleton: it is a document of this kind, produced by an earlier run or rewritten by hand over one. Bring it up to date with what changed — the material and the answers of this run — with **surgical edits only**. You never recompose it whole and never overwrite a section the project rewrote by hand: a founding document lives in the repository and is edited by whoever works there, exactly as the package's other deposited files are. Where what changed is a whole section, update that section and leave the rest.

**It does not carry the frame** — a file of the project's own, shaped differently, standing at the seat: it is not yours to rewrite, and it is not yours to throw away. You read it in full, **close it into the git stash** by the same rule, remove it, and then write the document at the declared name. It is the best source you have for the sections it answers, it survives as it was, and the seat holds one document instead of two.

Where a document no longer matches its role's path in `project.json`, write it at the new path and say so.

It is the idempotence of `init` applied to these files: the first run creates, the later ones align, a document a person curated is never flattened back to a skeleton, and a file the project wrote is never destroyed: it is closed into the stash, where it can be read again.

## What you do not do

- **You do not touch `.daiku/`**: `project.json`, `environment.json`, `domain/` and `policies/` belong to `init`. You **read** `project.json` for the paths, and you write nothing there.
- **You do not touch the code**, ever: you write the five documents and nothing else.
- **You do not write a document a role does not declare.** An absent key means that document does not exist in this project, not that you pick a path.
- **You do not invent the content.** What the repository and the owner do not say stays a declared gap inside the document, not a plausible sentence: a founding document that invents the offer is worse than a missing one.
- **You do not overwrite a file of the project's.** A file standing at a seat that is not a document of this kind, and a predecessor a role's document absorbs, are read in full and closed into the git stash before you write — never rewritten in place, never left standing beside your document (*A file found at the declared path is the project's*).
- **You do not commit** and do not stage what you wrote: whoever launched you watches what appeared before versioning it.
- **You do not launch `new-feature`** nor any other node: you produce the documents and stop.

## Report

Close in prose, in `{language.chat}`, with one line per document: **created**, **realigned**, or **skipped** with its reason (the key `documents.<role>` is absent, or the package carries no skeleton for that role) — and, where a file of the project's was closed into the stash, its name. Nothing before, nothing after: no list of what you read, no narration of how you worked. On a re-run where nothing changed, a single line saying so.
