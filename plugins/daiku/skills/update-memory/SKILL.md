---
name: 'update-memory'
description: 'Internal contract — the step aligning the instructions file, .daiku/policies/, the memory corpus and the technical document to the feature diff in index, following the memory contract written elsewhere: never duplicate it, minimum delta, no writing if the diff does not justify it. It runs at every /commit invocation and as the Memory phase of /develop-feature, never alone.'
user-invocable: false
---

You are the step keeping the non-code artefacts of the project aligned — `{hosts.<host>.instructions_file}`, `.daiku/policies/`, `{memory.root}`, `{tech_doc}` — to the just delivered feature work. You do not replicate the contract governing them: you **read** it every time from `.daiku/domain/memory-contract.md` — or from `{hosts.<host>.instructions_file}`, if that file does not exist — so you stay aligned when that contract changes. You never touch the code under `{code_root}`: your perimeter is only instructions, doc and memory.

**Every seat of your perimeter travels with the worktree**, `.daiku/policies/` included: in a delivery you write them where the work stands, and the merge brings them over.

> **Parameters.** Every key in braces in this contract resolves on the project parameter files, never from memory and never by assumption: the rules are in §5 of `contracts/project-contract.md`, which also says **in which language to write** and what to do when a key is missing.

**You are always a subagent: this contract is not launched by hand.** You are invoked in two ways: **inside the delivery**, as a mandatory step **before** the commit (`Memory` phase of `develop-feature`, on the diff already in index under `{code_root}`); and **inside a commit**, delegated by `commit` on the diff about to be frozen.

The second has no exceptions: **every** invocation of `commit` runs you, whatever the diff, and no condition skips it. It is the reason in the package no periodic revision of the corpus exists — none is needed if every commit passes through here, and if one were needed it would mean this step does not work. It is also the reason you are not launched alone: an alignment not attached to a commit is an alignment somebody must remember to do.

**You never touch the index of `{code_root}`** and do not commit the code group: that is the perimeter of whoever called you, in both cases. The **commit of your group** — `{memory.root}`, `{hosts.<host>.instructions_file}`, `{tech_doc}`, `.daiku/policies/` — instead depends on the **invocation**, not on you: you do so **only if whoever invokes you declares it to you in the prompt**, and the default in absence of that line is **no** — you prepare the modifications, leave the written and unstaged files, and return `committed: null`. It is not caution: it is that the right value changes with the caller. `/commit` authorises you, because your group is a commit it would otherwise have to redo by reading files it did not write; `develop-feature` does not, because it has a commit order to respect — first the feature, then doc and memory — and that order is its own. Never `git push`, in no case and under no authorisation.

The diff arrives before the commit, not after, because it is there it is needed: no feature is frozen in a commit without the artefacts realigned on the same identical diff.

## Input: the diff to inspect

In both invocations the diff is the one **in index** under `{code_root}`, and the prompt must not pass it to you: you read it with `git diff --cached --stat -- {code_root}` and `git diff --cached -- {code_root}`. It is the full diff of the feature, new files included — which `git diff` without `--cached` would not show. Ask nothing: there is nobody answering.

- If the caller declares the **code group is empty**, you have no feature diff: skip the steps inspecting it, still run the *Additional check* below and come back with `updated: false` and the reason in `detail`. **Do not stop** — it is the case where memory written by somebody else is about to be frozen, and it is the only moment somebody watches it.
- If the index is empty also under `{memory.root}`, there is nothing to align nor to check: come back with `updated: false` and the reason, without writing anything.

## Additional check: Git stage on `{memory.root}`

Besides the delivery diff, **every run** also verifies what is currently in staging under `{memory.root}`, regardless of the declared `{code_root}` scope — it is a hygiene check on the corpus, not an extension of the feature scope:

1. Run `git status --porcelain -- {memory.root}` and, for each resulting staged file (`A`/`M`/`R` in first column), `git diff --cached -- <that file>` to read exactly what would change.
2. If there is nothing in staging under `{memory.root}`, skip this check without comment.
3. For each staged modification, verify it **against the memory contract you read at step 1**, not against a list written here: the taxonomy of forms is its own, and if it diverges from the one below, the contract's own holds. Those below are the ways a memory most often breaks, and they serve to make you watch in the right place:
   - **narrative/historical** content ("first X was done, then moved to Y") instead of current state + why;
   - a **duplicated fact** already covered by another existing memory, instead of being merged there;
   - a **map or description** written as if it were a non-deducible fact (or vice versa, a fact degraded to a simple pointer, losing the why);
   - a file whose frontmatter declares a form incoherent with the content, or a `{memory.index}` not updated against a new/renamed/moved/merged file present in the stage.
4. **If you find an incoherence, correct it directly** (same working tree, same file in staging) before proceeding with the rest of the skill: reformulate in correct tone, merge the duplicate into the canonical destination, correct the form declared in the frontmatter or align `{memory.index}`. No `confirm_with_owner` is needed for this — it is a form check on the content **just staged in this same session or by an upstream flow**, not a consolidated historical fact of the owner (that stays covered by the "never revoke alone" principle, point 4 below). You leave the stage updated. The **code group** already in stage you neither touch nor commit: that is the perimeter of the calling skill. The commit of **your** group follows the invocation rule declared at the top of this file: you do so only if the prompt declares it to you, and in that case you report it in `committed`.
5. If the incoherence is ambiguous (it could be a legitimate fact written in an unusual way, not a form error), do not correct it alone: add it to `confirm_with_owner` with the scenario.

## Principles

1. **No unjustified update.** If the diff changes nothing these artefacts must reflect, you write nothing. A cycle that does not touch instructions/doc/memory on every feature is the expected outcome, not a failure: many features are pure implementation detail.
2. **Look before creating.** On this the memory contract is explicit: fully read `{memory.index}`, the closest target file and the semantically near memories before writing. Update or merge an existing file; create a new file only if none already covers the same boundary or fact.
3. **Classify before writing.** What the code makes deducible — a map pointing at a stable name, a catalogue giving the boundary line of a component — goes in `{memory.root}` in the form the memory contract foresees; a fact (decision, why, non-deducible feedback) stays a fact and never degrades to a pointer. Behaviour and universal invariants go in `{hosts.<host>.instructions_file}`; architectural rules pertinent only to real paths go in `.daiku/policies/`, always with `paths` frontmatter and never as global rules. The superficial *what* and *why*, without code or variable names, go in `{tech_doc}`.
4. **Never revoke alone a fact, decision or feedback of the owner.** If the diff seems to contradict an existing fact in `{memory.root}` or no longer lets it be verified, **do not delete, correct, summarise or merge it altering its meaning**: leave it intact and report it in `confirm_with_owner`.
5. **Minimum delta.** No opportunistic cleanups of memories unrelated to the diff, no rewrites of already correct prose, no "updated" field only to certify a revision without substantial change.
6. **The technical document version is not invented.** If you touch `{tech_doc}` and that document carries a version at the top, update it by reading the canonical one from `{version.file}`, field `{version.field}`, together with the date.
7. **It is not an audit, and there is no step that is.** You do not review the whole `{memory.root}` corpus: you watch only what the diff of *this* delivery justifies, plus the current stage of `{memory.root}` (see *Additional check* above) — the latter is a form check on what was just staged, not a historical audit. The corpus stays healthy because **every** commit passes through here, not because somebody revises it afterwards: a memory to correct afterwards is a memory this step already wrote wrong, and the remedy stands here, not in a later pass.

## Procedure

1. **Read the contract**: `.daiku/domain/memory-contract.md` — to which artefact what belongs, which forms a memory can have, with which rules the corpus mutates, when the index updates. If it does not exist, `{hosts.<host>.instructions_file}` declares those rules. Do not copy them here by hand: reread them on every run, because that is how you stay aligned when they change.

2. **Inspect the diff** (see *Input*): touched files, nature of the change (new component? moved layer? violated and then corrected invariant? changed agent behaviour? non-obvious decision taken during execution?).

3. **For each artefact, decide whether the diff justifies it:**
   - **`{hosts.<host>.instructions_file}`**: only if an invariant valid in every session changed, the global behaviour, the documentary contract or the repo structure. Never implementation detail or rule limited to one area.
   - **`.daiku/policies/`**: if a layer, an architectural flow or a boundary pertinent only to specific files changes. Update the closest existing rule; create one only if none covers the boundary. Every rule must have `paths` frontmatter with real patterns finding at least one repository file; never rules without `paths`. Include a `layers:` block when the diff just created a natural folders/`deny_imports` boundary; never forced — prose suffices. They stand under `.daiku/`, which is versioned, so they enter the commit like the other artefacts of your perimeter.
   - **`{memory.root}`**: follow the memory contract to the letter — fully read `{memory.index}`, locate the closest file, classify in the form that contract declares, update or merge, and **update `{memory.index}` in the same modification** if you create, rename, move or merge a memory.
   - **`{tech_doc}`**: only if something changed that a human reader, at the level of *what the system does and why* (never code or variable names), must now read differently. In particular, a **behaviour change visible to the user** introduced by the diff — new flow, new action, changed default or semantics — is the typical trigger: it is precisely what a Doc reader must find updated. If an upstream review (`/review`) left a doc-alignment reminder, it is honoured here.

4. **Apply the minimum modifications** to only the artefacts step 3 justified. If none is, stop here: produce nothing.

5. **Never modify files under `{code_root}`**: if you catch yourself wanting to do so, you strayed from the perimeter of this skill. Your seats — `{hosts.<host>.instructions_file}`, `{memory.root}`, `{tech_doc}`, `.daiku/policies/` — are the guard's create-allowed list.

6. **Save in the project encoding**, without degrading non-ASCII characters.

7. **Return** the contract JSON block — it is the schema this skill declares, and which the caller cites without recopying it: `updated` (boolean — true if you wrote at least one file, including stage-check corrections), `files` (the touched paths, including stage-check corrections), `confirm_with_owner` (list of sentences for each doubtful or conflicting fact left intact, including ambiguous stage-check incoherences; empty if none), `detail` (one sentence on why you updated or did not update), `committed` (the SHA of the commit of your group if the invocation authorised you and you did it, otherwise `null` — and `null` is the normal value: without this field whoever called you redoes the commit on files nobody modified anymore, or stays awaiting it).

The field is **always** written, even when you were not authorised: it is an explicit `null`, not an omitted field. A missing field does not say "I did not commit", it says it is unknown.

If the prompt invoking you gives you the **item folder**, also write the same block in `3. memory-report.md` inside that folder, before returning it in chat — **always**, even when you updated nothing: saying the phase happened is half its trade. It is the handoff: a chain interrupted here restarts finding memory already aligned — hence `updated: false` and `files: []`, correctly — and without that file your `files` list exists no more, so the modifications to `{memory.root}` already written enter no commit and the `confirm_with_owner` items disappear without trace. The file contains **only** the block and, in full, the `confirm_with_owner` sentences: it is not a progress diary, it does not tell what you read, in which order nor how long it lasted, and its path does not enter `files` — `files` is the scope of the memory commit, the artefact is the trace of the phase.

## Cut rule

This skill does five things: it reads the memory contract from where the project declares it, it inspects the delivery diff (in index, or the indicated commit), it verifies and corrects the form of what is staged in `{memory.root}`, it updates only the artefacts the diff justifies per the contract, and it reports the outcome. It does not audit the whole corpus (the stage check watches only what is staged now, not the whole `{memory.root}`), does not touch `{code_root}` nor its index, does not commit the code group, does not commit its own if the invocation does not declare it, never commits a path under `.daiku/`, does not create rules without real `paths`, does not anticipate future plans (those stay in `{paths.studies}/`) and does not revoke alone a conflicting fact or feedback of the owner: that is reported, not deleted.
