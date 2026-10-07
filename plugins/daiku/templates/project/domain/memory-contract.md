# Memory contract

Answers the questions `/update-memory` asks: which shapes a memory may take, how the corpus is
mutated, when the index is updated, and which artefact owns what.

**This file shipped with Daiku as a default, and from now on it is yours.** Rewrite it however you
like: no package update overwrites it. If you delete it, `/update-memory` falls back to whatever
the instructions file declares, and says so in its report.

## Where the corpus lives, and who writes it

`memory.root` in `.daiku/project.json` — a folder **inside the repository**, versioned alongside
the code. It has two writers, and they never coordinate:

- **the host**, whenever it notices mid-session something worth keeping — and at the end of every
  modification, before the work is declared done;
- **`/update-memory`**, which runs on every commit and aligns the corpus to the diff.

**The corpus is never left behind.** A modification that has made something here false is not
finished until this corpus says what is true: the pass that looks for it runs on every
modification, in the same work, and the commit is the last of its moments rather than the only one.
What the pass finds may be nothing — but that is the verdict of a pass that ran, never a reason to
skip it, and never a question to put back to the owner.

That is why the shape below matters more here than it would in a folder with a single author. Two
writers and one format make a corpus; two writers and two formats make two corpora sharing a
directory, and nobody notices until one of them is silently ignored.

On Claude Code the host writes here because `/init` pointed it here. On Codex it does not write
here at all — its own memory is a database in the user's home that cannot be relocated — so there
the corpus has one writer and the very same shape.

## The shape of a memory

One file, one fact. Frontmatter, then prose:

```markdown
---
name: <short-kebab-case slug, the same as the filename>
description: <one line, read to decide whether this memory is relevant>
metadata:
  type: user | project | feedback | reference | map
---

<the fact, in full sentences. For feedback and project, follow with **Why:** and
**How to apply:** lines. Link related memories with [[their-name]].>
```

| Type | What it holds |
|---|---|
| `user` | who works here: role, expertise, standing preferences |
| `project` | ongoing work, goals and constraints that the code and the git history do not record |
| `feedback` | guidance on how to work here — corrections and confirmed approaches, always with the reason |
| `reference` | a pointer to something outside the repository: a URL, a dashboard, a ticket |
| `map` | where something lives and what it is for, when the name alone does not say it |

**Relative dates become absolute.** "Last week" is false within a month; a date is not.

## How the corpus is mutated

1. **The pass runs, on every modification.** The corpus is checked against what just changed, in
   the same work, whatever the diff: there is no change small enough to be exempt, and the commit
   is where the pass happens again, not the only place it happens. What the pass finds may be
   nothing — that is a verdict, and it is not the same thing as not having looked.
2. **Look before writing.** Read the index in full, then the nearest existing file. A fact that
   already has a home is updated there, never filed again as a second memory.
3. **Correct in place.** A memory states what is true now, and why. It is not a log: "we used to
   do X, then moved to Y" gets rewritten as Y plus the reason. Recording what changed is the git
   history's job, and it does it better.
4. **Delete what turned out to be false.** A wrong memory is worse than a missing one, because the
   next session reads it and believes it without opening the file to check.
5. **Never revoke someone else's fact on your own.** A diff that seems to contradict a recorded
   decision is a question, not a permission: leave the memory intact and raise it.
6. **Do not record what the repository already records.** Code structure, past fixes, the contents
   of the instructions file: those are readable where they are, and a copy of them goes stale
   without anyone noticing.

## The index

`memory.index` — one line per memory, `- [Title](file.md) — hook`, and nothing else. It is the
file that gets read first, so it carries pointers, never content.

It is updated **in the same change** that creates, renames, moves or merges a memory. A lagging
index is not an untidy detail: it is how a memory stops being found, and a memory that is not
found gets written again somewhere else.

## Which artefact owns what

A fact does not belong where it happened to surface. There are four destinations, and each one
excludes the others:

| It belongs in | When |
|---|---|
| the memory corpus | a fact, a decision, a piece of feedback, or where something lives — nothing a reader could derive from the code |
| the instructions file | an invariant that holds in every session, everywhere in this project |
| `.daiku/policies/` | a rule that holds for real paths only, declared in that file's `paths` frontmatter |
| the founding documents (`.daiku/project.json` `documents.*`) | what the system does and why, for a human reader — never code or variable names |
