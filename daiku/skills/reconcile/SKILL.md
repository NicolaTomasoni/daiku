---
name: 'reconcile'
description: 'Internal contract of ship-feature — the reconciliation of a merge obstructed by uncommitted work or by a content conflict: it saves the working tree work as an artefact, measures whether the two sides are disjoint line by line, and either merges keeping both or stops and asks the owner.'
user-invocable: false
---

You are a worker of `ship-feature` § *6b-bis. Reconcile*, opened when § *6b. Merge* of `ship-feature` returned `merged: false` with a non-empty `dirty_paths` or `conflicts`. Your job is to **keep both sides together** where they do not touch the same lines, and to **stop and ask the owner** — through the block, never in here — where they do. The judgement of the threshold belongs to the evaluator's `reconcile` question; your job is to run the plan it returns.

> **Parameters.** Every key in braces in this contract resolves on the project parameter files, never from memory and never by assumption: the rules are in §5 of `contracts/project-contract.md`, which also says **in which language to write** and what to do when a key is missing.

## Invocation modes

**You are launched by `ship-feature`, as a worker role.** Two modes, and the caller chooses one:

- **Measure mode.** The ordinary case: the 6b left the merge obstructed. You write the patch artefact, measure the overlap and act on the verdict — merging on `reconcile`, stopping on `stop`.
- **Resolved mode.** The run stopped on an overlap and the owner has since answered. `ship-feature` re-opens you with the answer; you complete the merge keeping both sides as the owner directed, and you do not re-ask. The structured question lives in your block also in this mode, with the answer already carried in `detail` by the caller.

## Input

The caller passes these already resolved, and you use them as they come (§4.1 of `contracts/orchestration.md`):

- **`work_root`** — the technical root of the tree the merge lands on: the integration worktree, where the Git commands run;
- **`branch`** — the branch of the delivery being merged;
- **`patch`** — the path of the artefact you write, `<folder>/main-tree.patch`, in the artefacts root;
- **the block of 6b** — its `merged: false` and which of `conflicts` and `dirty_paths` is populated, so you know whether the merge is already in progress (`MERGE_HEAD` present) or the working tree is merely dirty.

If one of them did not reach you, **do not guess it and do not ask for it**: return the block with `ok: false` and the missing key named in `detail`. A guessed root or branch is the only thing that makes the measure meaningless.

## The evaluator

The threshold is not read off this prose: it is **asked**, and the verdict binds. Call the node's disk side, which measures Git and asks the evaluator in-process through the same entry the evaluator's own command uses, importing it instead of copying it:

```bash
node <package root>/architect/reconcile.mjs <package root>      # with this object on stdin
{"action": "measure", "work_root": "<work_root>", "branch": "<branch>", "patch": "<patch>"}
```

The program reads `HEAD` (the integration commit), the merge-base with `branch`, and the obstructed set; writes the patch artefact; computes, per obstructed path, the lines the working tree changes (`ours`) and the lines the branch changes (`theirs`) in the frame of the merge base; and asks the evaluator `question: "reconcile"` with `paths`, one entry per obstructed path as `{"file", "ours", "theirs"}`, each side a list of `[from, to]` intervals. The evaluator answers `stop` when in at least one path an interval of `ours` intersects an interval of `theirs`, `reconcile` otherwise. The keys the evaluator requires are declared once, in `REQUIRES` of `architect/architect.mjs`; the paragraph above from which the call is read names them all.

## How you verify

Run `measure` and read its verdict; the rule it applies is the one below, written where whoever reads it can check it, never interpreted here:

- an interval of `ours` intersects an interval of `theirs` when `a <= d && c <= b` for `[a, b]` in `ours` and `[c, d]` in `theirs` — **touching on a shared line is overlap**;
- **pure adjacency is not overlap**: `[1, 3]` and `[4, 5]` leave the two sides disjoint;
- a side that changes nothing (`[]`) never overlaps.

The measure is per path and the answer is per path: one obstructed path in overlap is enough for `stop`, and `blockers` names each such path. A run that stops keeps the patch artefact and the two sides as they are — it writes no Git of substance.

## What it does

- **On `reconcile`.** Call the disk side again, in the same invocation, with `{"action": "merge", "work_root": "<work_root>", "branch": "<branch>", "message": "merge: <folder>"}`. It lands the merge: on a dirty working tree with `git merge --no-ff --autostash`, on a merge in progress by composing each conflicted file as the **union** of the disjoint sides and completing with `git add` and `git commit --no-edit`. It fails loudly if the measure does not hold — a file it was asked to keep together and cannot. Then return the block with `merged: true` and the `merge_sha`.
- **On `stop`.** Do not merge. Return the block with `merged: false`, `overlap` naming the paths in overlap, `patch`, `dirty_paths`, and the structured `question` for the owner. `ship-feature` carries the question into the chat, the run stops, and it resumes in resolved mode with the answer.

## What it writes

- the **patch artefact** at `<patch>`, holding the uncommitted work of the working tree — tracked modifications and untracked files, written through a throwaway index (`GIT_INDEX_FILE`) seeded from the real one, so the **real index and the working tree are never touched**: it is the recoverable copy of the other session's work, not a park.
- **nothing else but Git objects**, and on a successful merge the merge commit. You never commit the uncommitted work of the working tree: `--autostash` reapplies it, the union keeps it, and it stays uncommitted.

## The block you return

You return the block declared by this file, in full and with these field names — it is its only seat, mirrored in `schemas/blocks.json` § *reconcile*:

```json
{"ok": true, "merged": false, "merge_sha": null, "overlap": [], "patch": "<patch>", "dirty_paths": [], "question": null, "detail": "<what the verdict was>"}
```

- `ok` is true when the node ran to its verdict, false when it could not proceed (a missing input, a measure that does not hold);
- `merged` and `merge_sha` say whether the merge landed, and where;
- `overlap` names the paths the two sides change on the same lines — empty when disjoint;
- `patch` is the path of the artefact;
- `dirty_paths` are the paths the merge would touch that the working tree holds uncommitted;
- `question` is the structured question for the owner when `overlap` is not empty, `null` otherwise.

## Ask the owner

**You ask nothing.** You start from zero and die: a question asked in here turns into an assumption taken in silence. When the verdict is `stop`, you put the overlap into `question` — a title and two-to-four mutually exclusive options with stable ids, the recommended one first (§ *Ask the owner* of `contracts/orchestration.md`) — and whoever holds the conversation carries it into the chat. The answer returns to you inside the same run, in resolved mode.
