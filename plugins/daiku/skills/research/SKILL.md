---
name: 'research'
description: 'Collects operational development notes on a library or technology from real sources and delegates reordering to study — launched by hand, and invoked by new-feature when model knowledge is not enough to decide'
argument-hint: '[library/technology name]'
---

Collect a library or technology autonomously from **real sources** (official docs, repo, package registry, tutorials) and produce a **single markdown file of operational development notes** in `{paths.lib_notes}/`. Work in **two stages**: first collect in append mode with fan-out, then delegate reordering to `study` on the same file.

> Every path below is **relative to the technical root** you execute from (`contracts/project-contract.md` §3). It fills the model's knowledge gaps (cutoff, young/niche libraries, evolving APIs) with verifiable facts, not memory.

> **Parameters.** Every brace-enclosed key in this contract resolves against the project's parameter files, never from memory and never by assumption: the rules are in §5 of
> `contracts/project-contract.md`, which also says what to do when
> a key is missing.

## Invocation modes

```yaml
invocations:
  - id: owner
    caller: owner
    args: $ARGUMENTS = "<technology> [language] [version]"
    asks_owner: true
    returns: path del file riordinato (§ Output finale), niente altro
  - id: from-new-feature
    caller: new-feature § La conoscenza che ti manca
    args:
      technology: stringa, come l'indagine l'ha letta
      in_use_version: letta dal manifest, non a memoria
      questions: 3-6, concrete, verbatim dai gap
    asks_owner: false
    returns: path del file riordinato (§ Output finale), niente altro
```

You reach the same contract in two ways. Your caller **chooses** the mode by citing its
`id`; the constraints stay written here, and are not rewritten in the caller's prompt. The job
— real sources, append-mode collection, a single md per technology — is identical in both.

**Dispatch.** Before doing anything else, recognize your invocation from the parameters
received, not from your caller's narrative: if the prompt carries `in_use_version` and
`questions`, you are in `from-new-feature`; if you only have `$ARGUMENTS`, you are in `owner`. If neither matches, it is a failed entry: declare it and stop instead of guessing. The other mode's section never executes — skip it, do not interpret it.

### From owner — default

> Applies only in `owner`.

In `owner` start from `$ARGUMENTS` alone: resolve the technology, ask when it is missing,
cover the technology's full surface. Once collection is complete call `study` for reordering
and then deliver the file per § *Final output*. No chat, no summary.

**Your outcome is only the reordered file's path, nothing else**: do not open a working folder, do not propose a feature. The notes stand alone, and whoever asked for them decides if and when they will become something — if needed, `new-feature` will find them again, rereading them from `{paths.lib_notes}/` without repeating the collection.

### From `new-feature`

> Applies only in `from-new-feature`.

You are a subagent in a fresh context, launched while a feature is being defined.
Four differences apply, and nothing else changes:

- **Input arrives resolved** — technology, version in use in the project, and open questions are
  in the prompt. Ask nothing and never stop waiting, because there is nobody to answer.
- **Collection is targeted.** The questions you receive come from the gaps and doubts of a real problem:
  the fan-out's thematic blocks are chosen **first** to answer those, and only afterwards to
  cover the rest. A question with no answer is declared as such — it is more useful than a generic
  section that sidesteps it.
- **The version in use wins over the latest.** If the project lags behind the latest release,
  the notes cover **the one in use** and declare at the top what changes when moving to the latest, with
  breaking changes in between. Your caller must write code that runs on what is
  installed, not on what is published.
- **Write only `{paths.lib_notes}/<slug>.md`.**

**Close by returning only the file's path**, nothing else. Do not forward the `study` block:
you need it only to know whether reordering succeeded.

## Input: technology to study

Arguments: `$ARGUMENTS`

The argument is the **library/technology name** (e.g. `DBOS`, `LangGraph`, `Tauri v2`, `TanStack Query`). It may include a language or a version (e.g. `dbos python`, `pydantic v2`).

- If `$ARGUMENTS` is empty, **ask** which technology to study and stop until you receive it.
  Applies only in `owner`: in `from-new-feature` this case never exists, because the input arrives
  resolved in the prompt.
- Derive a kebab-case **slug** from the technology name — by hand it is the resolved `$ARGUMENTS`, from `new-feature` it is `technology` — (e.g. `TanStack Query` → `tanstack-query`, `dbos python` → `dbos-python`). The target file is `{paths.lib_notes}/<slug>.md`. **One md per technology.**
- If `{paths.lib_notes}/<slug>.md` **already exists**, do not start from scratch: read it, treat the work as an **update/extension** (fill the gaps, update the version, add what is missing) and then move to `study`. Do not duplicate what is already there.
- Create the `{paths.lib_notes}/` folder if it does not exist.
- The file's resolved path is the **handoff to `study`**: no intermediate file, `study` reorders in place.

## Content objective

Notes **operational for development**, not marketing. Priorities, in order:

1. **Exact signatures and APIs** — decorators, classes, functions, named parameters with their defaults, exact imports (`from x import y`), types. Copied **verbatim** from sources (see § Accuracy rules).
2. **Complete** working snippets (imports included), in ` ```<lang> ` blocks.
3. **Setup**: install, current package version, requirements (runtime/language version), configuration, connections.
4. **Mental model**: what it does, how, what it guarantees and what it does **not**; when to use it and when not.
5. **Documented gotchas and limits**; typical errors/exceptions.
6. **News beyond the cutoff**: recent changelog with **breaking changes** explicitly flagged.

## Accuracy rules (binding)

- **Real sources only.** Never write anything from model memory: every fact must come from a fetched page. Young/niche library APIs are where the model hallucinates plausible but wrong signatures — never do that.
- What sources do not confirm is marked **`[da verificare]`** with what is missing, instead of inventing.
- "verbatim" = copied from the source. Never rewrite signatures "by feel".
- Report version and date as stated in Step 1.

---

## Step 1 — Research with append

Goal: accumulate all useful knowledge in the target file, in append mode, without worrying about order yet.

1. **Orient yourself and anchor freshness.** Run 1–2 `WebSearch` queries to locate the canonical sources: official site/docs, GitHub repo, package registry page (PyPI/npm/crates/pkg.go.dev), "getting started" guide, API reference, changelog/releases, possible "what's new" blog. Include the current year in queries (e.g. "library X changelog 2026") to avoid stale results.

   Freshness is a **requirement, not a detail**: the docs must reflect the **latest release**, except in `from-new-feature` where the version in use wins. The version must be taken from the **authoritative, non-indexed** source, not from WebSearch (US-only, depends on indexing: a release from a few days ago may not surface).

   - **Primary version source: the official GitHub repo.** Locate `owner/repo` (from the registry page or an orientation WebSearch) and query **releases/tags directly with the `gh` CLI**, which is deterministic and always current (no cache, no indexing):
     - `gh release list -R <owner>/<repo> -L 5`
     - if the project does not use GitHub Releases, the tags: `gh api repos/<owner>/<repo>/tags --jq '.[0:5][].name'`
     - for the date: `gh release view -R <owner>/<repo> --json tagName,publishedAt` (or the tags API).
     Take **version number + release date** from here.
   - **Cross-check on the registry** (`WebFetch` of `pypi.org/project/<pkg>/`, `npmjs.com/package/<pkg>`, etc.): the published version must match the latest release/tag. The registry also gives the requirements (runtime/language version).
   - **Use the versioned/"latest" docs**: if the site exposes per-version URLs or a selector, use the latest release's; avoid archived pages or mirrors.
   - **Consistency sanity check**: if the docs pages report an older version/date than the latest GitHub release, **trust GitHub** and flag the misalignment in the file (the docs lag behind). Mark APIs not confirmable on the newest version with `[da verificare]`.
   - Record in the file **exact version + release date + today's collection date**, so whoever rereads knows how fresh the source is.

   Note: if the `gh` CLI is unavailable or the repo is not on GitHub, fall back to `WebFetch` of the repo's and registry's releases/tags page — but the preferred path stays `gh`.

2. **Create (or open) the file** `{paths.lib_notes}/<slug>.md`. If new, write a minimal header: title, line with primary source + version + date, note on the model's cutoff, and a "Meta and sources" section with the URLs found and the conventions (`[da verificare]`, "verbatim").

3. **Fan out the research.** Split the technology's surface into **thematic blocks** (as a guide: concepts/mental model · setup & quickstart · core APIs/primitives · configuration & runtime · integration/extension · management/operations/CLI · changelog & recent news — adapt the blocks to the specific library). **If you were invoked with questions**, the first blocks are the questions themselves — one per question, or one per group of related questions — and the general surface comes afterwards, with what remains. Launch **worker subagents in parallel** (role and model from `contracts/orchestration.md`; they are **leaves**: they never delegate further), **one per block**, each with:
   - the official pages to `WebFetch` for that block (and freedom to follow useful links);
   - the instruction to **preserve signatures, imports, and snippets verbatim** and to mark with `[da verificare]` what they do not find;
   - the delivery of returning as a **final message** a **paste-ready markdown section**, with a section title, no preambles.

   Launch the agents in a single message (they run concurrently). Do not let the agents write the file: **append** their results yourself as they complete, so you avoid races on the file.

4. **Append** each received section at the end of the file, only checking that code blocks are well formed. If a block stays uncovered or doubtful, run a targeted `WebFetch`/`WebSearch` yourself to fill it before closing the step.

At the end of step 1 the file holds all the material, possibly redundant and disordered: that is fine, `study` will fix it in step 2.

## Step 2 — Reordering delegated to `study`

Goal: a fresh eye reorders what you collected, without anchoring to the collection order.

Launch a subagent with a self-contained prompt holding:

- the **contract to read**: `skills/study/SKILL.md`, in full, before acting;
- the **resolved input**: dirty file path, slug, technology as you received it, studied version and latest version with their dates, today's collection date;
- the **step role**: **worker**, model resolved per §2 of `contracts/orchestration.md`;
- the **scope constraint**: it rewrites and reorders **only** that file, never opens new files, never commits and never pushes, **never delegates** (it is a leaf);
- the `study` **block stays internal**: read it to know whether reordering succeeded, never forward it and never copy it;
- the **cap**: a failed step is retried **only once**, with the very same prompt (§4.2 of `contracts/orchestration.md`).

If `study` fails twice, § *If `study` fails* below applies.

## If `study` fails

After the second failure, still return only the file's path. Deliver a single thing:

1. leave the dirty file on disk as it is — it stays useful for manual reading;
2. return the file's path in its collected state. Build no block: your caller opens the file and finds it raw by itself.

Your caller opens the file you give: if it is still raw they see it by themselves, with no need for a block declaring it.

## Operational constraints

- Respect the runtime constraints that `{instructions_file}` declares, and in any case: **no whole-filesystem searches**; every file access stays inside the project and the `{paths.lib_notes}/` folder.
- **Never commit** and never push: the command produces only the file (collected by you, reordered by `study`).
- Work autonomously end to end without asking for confirmation, except when `$ARGUMENTS` is empty.

## Final output

> Applies only in `owner`.

**From owner**, return only the reordered file's path in `{paths.lib_notes}/<slug>.md`. No chat, no summary, no block.

> Applies only in `from-new-feature`.

**From `new-feature`**, return only the reordered file's path and terminate. Add no prose and do not forward the `study` block — your caller opens the file, it never reads fields.
