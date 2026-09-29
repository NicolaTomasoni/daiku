---
name: 'study'
description: 'Reorders the dirty notes file collected by research without losing a single verbatim fact — internal contract, opened only by research'
user-invocable: false
---

Reorder the dirty file that `research` collected in `{paths.lib_notes}/`, in the same path, without losing a single verbatim fact. Do not collect, do not fan out, do not open new files: your job is ordering and deduplication.

> Every path below is **relative to the technical root** you execute from (`contracts/project-contract.md` §3).

> **Parameters.** Every key in braces in this contract resolves on the project parameter files, never from memory and never by assumption: the rules are in §5 of `contracts/project-contract.md`, which also says **in which language to write** and what to do when a key is missing.

## Invocation modes

This contract has a single mode: you are always a subagent in a fresh context, opened by `research`. Do not launch it by hand and it has no other callers.

- **Do not ask the owner anything**: you have no channel to them. If the entry is incomplete, declare it in the block instead of stopping to wait.
- **Rewrite only the received file.** Do not commit and do not push.
- **Do not delegate: you are a leaf.** You do all the work yourself, inline.
- **Always close with the § *The block you return* block**, in full. No field is omitted: the list of points to verify, if empty, is written as an empty list.

## Input: dirty file + resolved references

`research` passes you in the prompt, already resolved:

- the **dirty file path** (`{paths.lib_notes}/<slug>.md`) — the only file you touch;
- the **slug** and the **technology** as it received them;
- the **studied version** and the **latest version**, with release date and today's collection date.

If the file is missing or empty, it is a failed entry: declare it in the block with `ok: false` and do not rebuild it with your own collection — collection is `research`'s job.

## Objective and accuracy

The notes stay **operational for development**, not marketing; the collection priorities (verbatim signatures, snippets, setup, mental model, gotchas, changelog) live in the `research` file and are not copied here.

A single rule applies here: the facts are already in the file — **do not add any from memory** (see Preserving below).

## Reorganization

Goal: make the file clear, ordered, without duplicates — without losing a single verbatim fact.

1. **Reread** the whole file.
2. **Reorder by logical groups**, not by collection order. Use these groups in the stated order, adapting them to the library and skipping only what does not exist: *Fundamentals* (meta/sources · concepts & mental model · setup & quickstart) → *Core primitives* (the main APIs) → *Infrastructure/extension* → *Config & lifecycle* → *Operations* (management, CLI, recovery) → *Changelog/news* → (if relevant) *Integration notes for the project*. Add an **index** at the top and number the sections.
3. **Deduplicate.** Every signature/snippet must have **a single source** in the document; the other points citing it become **cross-references** to the canonical section, with title and number as numbered in the index. Merge repeated concepts into a single list recalled by reference. Remove textual repetitions.
4. **Improve readability without inventing:** tables for parameter lists and for the changelog; a name map (for every name imported from the library, the section where the full signature lives) if names are scattered; flag breaking changes with ⚠️.
5. **Preserve** in full: all verbatim signatures, parameter defaults, `[to verify]` markers, source URLs. Reorganization touches *order and duplication*, never *facts*.

## Operational constraints

- Respect the runtime constraints that `{hosts.<host>.instructions_file}` declares, and in any case: **no whole-filesystem searches**; every file access stays inside the project and the `{paths.lib_notes}/` folder.
- **Do not commit** and do not push: the command produces only the received file, reordered.
- Work autonomously end to end on the received file, without asking for confirmation.

## The block you return

```json
{
  "ok": true,
  "technology": "<name as you received it>",
  "file": "<path of the produced or updated md>",
  "studied_version": "<the version you collected on>",
  "latest_version": "<the latest release found, same as the previous one if the project is up to date>",
  "date": "<collection date>",
  "to_verify": ["<the points marked [to verify] in the md>"],
  "detail": "<if ok=false, why: missing or empty file, incomplete input — never collection causes>"
}
```

`to_verify` is the inventory of the gaps the sources did not close: whoever opens the file finds them there, marked `[to verify]`.

## Final output

No summary in your own chat: the block above is the outcome for `research`, which reads it and returns only the file's path.
