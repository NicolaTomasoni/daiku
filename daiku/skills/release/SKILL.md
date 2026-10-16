---
name: 'release'
description: 'Promotes the development branch onto production, once per release: the version lives on production and never on development, the release writes it there with the changelog section built from the block of commits accumulated since the last published release, and replaces the release standing on production for as long as nothing has pushed it. On its first run it asks which paths never reach production with proposed lists and records them in `.daiku/project.json`. A working tree that is not empty is the first question of the run — the release flushes it through the review cycle and its closing commit, or the owner commits it — because a release carries the development tree as its commits hold it. With `--with-commit` that question is not asked: the tree is flushed through the cycle and its closing commit as if the owner had chosen it. It never pushes — the push stays a manual gesture of the owner. On a project that declared no channels it has nothing to promote and says so.'
argument-hint: '[technical root, optional — default: current directory] [--with-commit]'
---

You are the **release** of a project that declared its two channels: the work lives on the
development branch, and production is where releases live. You do three things and stop: you read
the block of commits accumulated since the last published release, you ask the owner the version
**once** on that whole block — major, minor or patch — and you write the release on production
with its own changelog section. The number moves here and only here; `commit` is not touched and
keeps its own life.

> **Parameters.** Every key in braces in this contract resolves on the project parameter
> files, never from memory and never by assumption: the rules are in §5 of
> `contracts/project-contract.md`, which also says **in which language to write** and what to do
> when a key is missing.

## The two sides

**Development carries a beta, and no changelog.** `{version.file}` stands there holding the number
production carries now, marked as a beta with a counter — `1.2.3-b.1`. The counter goes **after a
dot and is numeric**: `b.7`, never `b7`, which as
an alphanumeric identifier semver orders `b10` before `b9`. The beta is not a release, and no
release ever reads it: a release derives its number from production's own and writes it on
production, overwriting this one there. It is there because a package installed from its own
development tree must declare a version, and because that declaration is what moves the installed
copy. It moves two ways: the release realigns it to the number just published, counter fresh at
`1` (§ *The step*, step 6), and a development commit raises the counter when the shape of the
product moves — a commit `init` would carry into the projects that use it. `{changelog}` is not a
file on development: a released section is born on production,
at the release, and it is not written back.

**Production is a line of releases.** It does not fast-forward onto development and it is not
development's ancestor: each release is a commit of its own, carrying the development tree as it
stood at that moment plus the version and the changelog. What makes a release true is therefore not
a merge but the fact that it was built here, and nothing of it reaches development.

**Production is the product, and the workshop is not the product.** What reaches it is the product
of the project, never the seats the method deposited there: `.daiku/`, `CLAUDE.md` and `AGENTS.md`
under either name, the memory root. That is not the project's to decide and this node does
not decide it either — the program holds the list and takes the paths off the tree — but the
project **can extend it**, and `{release.never}` is where its own answer lives, the one
this node asks for on its first run (§ *First run*). Where the project declared a `{release.source}` the question is mostly
moot, because nothing outside that folder is read; where it did not — the ordinary project, whose
product is the whole tree — the footprint is the whole difference between publishing a product and
publishing the workshop. Read `never` in the status before releasing: it is what stays behind.

## When to use it

You run it by hand, on the main tree, when you decide to release. It is not part of any chain and
no other node launches it: `ship-feature` ends by merging the delivery **onto the development
branch** — the branch the main tree stands on — and the release is a separate, deliberate gesture.
It is the one node that launches the review cycle from outside a delivery, and only for this:
taking an unclean working tree to a clean one before anything is written.
A project that did not declare `channels.production` has no release at all, and this node says so
and stops.

## Input

The **technical root** — the directory the skills run from, carrying `.daiku/project.json`. With an
argument, it is that; without one, it is the current directory. From it you resolve every key, and
run every command with `git -C "<technical root>"`.

**`--with-commit`** — the one flag, read as a whitespace-separated token in `$ARGUMENTS` and never
inferred from prose: where it stands, step 1 of § *The step* has no question to ask, and an unclean
working tree is flushed before the release without the owner being asked anything. It suppresses
that question alone: the version of step 4 is still theirs, and the flush is still the whole of
§ *Flushing the working tree*.

**The release runs from a copy standing on `{channels.development}`.** It never checks production
out, and it refuses to run while a working copy holds it — a copy holding a branch this node moves
would be left describing a commit that is no longer there. Close that copy and relaunch.

## First run

**Applies only where `{release.never}` is absent.** A present key — even an empty list — means
this question was already asked: never ask it again. An absent key means the first run has not
asked yet, and this run asks.

Ask the owner with the structured question of § *Ask the owner* of `contracts/orchestration.md`
— one question, `1/1`, in `{language.chat}`, options `A` first and recommended — and make proposals. Before asking, derive up to two proposed lists from the tree in
front of you, leading with notes folders that are actually there — `docs/` and its subfolders,
or similar — and then top-level folders reading as internal (drafts, local tooling): only paths
that exist. Never the method's own footprint (`.daiku/`, `CLAUDE.md` and `AGENTS.md`, the host's
own configuration folder, `{memory.root}`), which the program keeps back without being told and
the proposals do not repeat. Where the project declared a
`{release.source}`, say so in one line in the message above the question: nothing outside that
folder is published anyway, and the answer only matters inside it.

The options carry the proposals: `A` the recommended list (the internal seats you found, or none
where the tree shows none), `B` the other side (none where `A` lists paths, your second list
where it does not) — two options, three where two genuinely different lists stand. The message
above the question names the footprint and what each option keeps back; the question itself stays
bare. The owner may always answer outside the options, in prose with their own folders, and that
free answer prevails.

What the owner chose or wrote you normalise to paths, deterministically: `/` separators, no leading
`./`, no trailing `/`, empty and `.` dropped; absolute paths dropped and declared; entries the
method footprint already covers dropped, because storing them would duplicate what the program
already does; duplicates dropped and the rest sorted. Where there is nobody to ask — a chained
run, a session with no interactive channel — invent nothing and write nothing: proceed with the
method footprint alone, declare it in `detail`, and the next run asks again.

The normalised list is used for **this** release — passed as `never` to `architect/release.mjs`
in steps 2 and 6 of § *The step* — and recorded for every later one: after the release step, write it
into `.daiku/project.json` under `release.never`, creating the `release` object where missing and
touching no other key, in the file's own indentation with its trailing newline. An answer of
nothing to keep back is recorded as `[]`, which is what stops the next run asking again. Then run
`architect/release.mjs` with `action: "record"`, `path` at that file and a `message` in
`{language.commit}`: **the node commits the record itself**, on `{channels.development}`, the way it
writes production — a throwaway index, `write-tree`, `commit-tree`, `update-ref`, no `git commit` —
so the working tree is left clean and `detail` says what was recorded. Leaving the file uncommitted
is not a state the tree survives: a working tree carrying that one file opens no review cycle,
because nothing under `{code_root}` differs and the scope comes back empty, no ledger exists and the
command guard denies the commit that would close it — so the next release would stop at step 1, and
the one after it too. The enforcement stays the program's — `architect/release.mjs` takes those
paths off the tree — and this section is the prose seat of that ban.

## The step

**Applies only if `{channels.development}` and `{channels.production}` are declared.** Where either
is absent the project did not adopt the two channels: return `released: false` and the `detail`
saying so, and stop — §6 of `contracts/project-contract.md`, no fallback and no guessed branch.

1. **Read the ground.** `git -C "<root>" rev-parse --abbrev-ref HEAD` must be
   `{channels.development}`; otherwise the main tree is not standing where the work lives and
   nothing is released: return `released: false` with that in `detail`.

   `git status --porcelain` must then be empty, and a release never starts from a tree that is not:
   it carries the development tree **as its commits hold it**, so work standing in the tree and in
   no commit would be left out of the release without anybody noticing. **Where it is not empty you
   ask the owner, and you ask before anything else runs** — the paths one by one, and the two roads
   with what each costs — because the flush below is a whole review cycle, and the work standing in
   the tree is what pays for it. The question is the **first act** of the run: put after the chain
   has started, it asks about a cost already paid.

   - **`A` — flush it here.** The release makes the tree clean itself, as § *Flushing the working
     tree* says, and goes on. This is the recommended road: the work standing in the tree is work
     this project already decided to keep, the cycle is the only door a commit has here, and the
     clean tree is what the release was waiting for anyway.
   - **`B` — stop, and the owner commits.** Return `released: false` with the paths named in
     `detail`, and the run is relaunched once they are committed. The work is theirs and they know
     what it is, and their terminal is behind no guard — but the release then waits on a gesture of
     theirs.

   **Where the invocation carries `--with-commit` the question does not exist**: road `A` is taken
   as if the owner had chosen it — that is the whole of what the flag does — and `detail` says the
   flush was taken by the flag. It removes the question and nothing else: what a clean tree is worth
   is unchanged, and the program refuses a working tree that is not clean, so a release arrived at
   the write without flushing writes nothing at all.

   Where there is nobody to ask — a chained run, a session with no interactive channel — road `A`
   is taken too, and `detail` says the question was not asked. A tree still not empty after the flush
   is `released: false`, with the paths left standing named in `detail`.

2. **Measure.** Run `architect/release.mjs` with `action: "status"`, passing the root, the two
   branches and the release's own keys — `{release.source}`, `{version.file}`,
   `{version.field}`, `{version.replicated_in}`, `{changelog}`, `{hosts.<host>.instructions_file}`
   and the paths that never reach production: `{release.never}` where declared, plus the list
   § *First run* just collected where it asked, plus `{memory.root}`. It answers with the development tip,
   where production stands, `current_version` — the number production carries now — `never`, the
   paths it will keep back, and the three things you need:
   - **`anchor`** — the development sha the last *published* release carried, or `null` where there
     is none. It is where the block starts.
   - **`pending`** — production's tip is a release nothing has pushed: a **draft**.
   - **`checked_out`** — the working copies holding production. Not empty means nothing was
     written: report it and stop.

   Where `{version.file}` or `{version.field}` is not declared there is no number to move: skip
   steps 4 and 6's version, keep the release, and declare it in `detail` — §6.

3. **Read the block.** `git -C "<root>" log --oneline <anchor>..{channels.development}`, or the
   whole `git log` where `anchor` is `null`. This is what the release promotes, and what the notes
   are built from. If it is **empty**, development has not moved since the last published release:
   return `released: false` with `detail` saying there is nothing to release, and stop.

   **While production's tip is a draft (`pending`), the new notes cover only what the draft does
   not carry yet.** Read the draft's own trailer from `git -C "<root>" log -1 --format=%B
   {channels.production}` (`Development: <sha>`) and take `log --oneline
   <trailer>..{channels.development}` as the block the added bullets are built from. If that range
   is **empty**, the draft already carries everything development holds: return `released: false`
   with `detail` saying the unpushed draft is current and there is nothing to join it, and stop.

4. **Ask the version, once, on the block.** From `current_version`, ask the owner **major**,
   **minor** or **patch** with the structured question of § *Ask the owner* of `contracts/orchestration.md` — one question, three options, in the chat
   language, the recommended first. The answer is the increment; the new number is derived from
   `current_version`. Because this node runs in the conversation, the channel to the owner exists —
   it is the whole reason the question lives here and not inside a subagent.

   **Where `pending` is true there is no version to ask.** The draft was never pushed, so its number
   is not a rung of any public ladder: the release keeps `current_version` — the draft's own — and
   the commits that arrived while it sat there join it instead of opening a version of their own.
   `detail` says the number was kept from the draft. To open a new number instead, push the draft
   first — closing it — and then release.

5. **Write the changelog section.** In `{language.commit}`, in the style `{changelog}` already
   uses, with the entries the convention admits: which commit types produce an entry is not decided
   here but by `.daiku/domain/commit-convention.md`, and where that file is absent by the sections
   already present in `{changelog}`. The section's own prose is yours — the heading with the new
   number and the date of the day, the bullets, the rule that closes it. What you do **not** do is
   place it: the program places it, below the changelog's title, deterministically.

   **Where `pending` is true the section is the draft's own, grown by the new bullets.** Read it
   from the production tip — `git -C "<root>" show {channels.production}:<path>`, where `<path>` is
   `{changelog}` with the `{release.source}` prefix taken off where one is declared — keep its
   heading, version and date untouched, and append the bullets for the block step 3 just measured
   after the ones already there, before the rule closing the section. The heading stays the draft's
   because the release is still the same unpublished one.

6. **Release.** Run `architect/release.mjs` with `action: "release"`, the same keys as step 2, the
   `version`, the `from_sha` the status returned, the `section` you just wrote and the `message` —
   `release <version>`, plus ` — <the first line of the notes>` where there are notes. Where the
   number was kept from a draft, that first line is the first bullet this run adds, not the draft's
   heading.

   It builds the production tree out of the development one — re-rooted at `{release.source}` where
   the project declares it — written with the version in `{version.file}` and in every file of
   `{version.replicated_in}`, and the changelog with your section on top. It writes the commit on
   production **without ever standing on it**: a throwaway index, `write-tree`, `commit-tree`,
   `update-ref`. The branch guard denies `git commit` and `git merge` on production, and this node
   never reaches them — the mechanism is not there.

   **While production's tip is a draft, the release replaces it**: same parent, new tree, new
   message. An unpushed release is a version the owner has not decided exists yet, so it is not a
   rung of the ladder but the current draft of one, and the commits that arrived while it sat there
   join it instead of opening a version of their own. The block in step 3 already covers them,
   because `anchor` reaches back past the draft to what was published.

   It records the development sha it carried in the commit itself, as a `Development:` trailer:
   that is where the next release's block starts.

   **Where § *First run* asked, this is also where the answer is recorded.** The normalised list
   goes into `.daiku/project.json` under `release.never`, and `architect/release.mjs` runs again
   with `action: "record"` — which commits that file on `{channels.development}` with the plumbing,
   as the release writes production. It is a step of its own and not a `git commit`: the node's own
   write, and the tree is left clean.

   **Then the beta follows the release.** Where `{version.file}` is declared, development is advanced
   to `<version>-b.1` — the number just published, counter fresh — so the tree the release leaves
   behind already declares what production carries, and no `version: update` lingers in the tree for
   the next release to trip on. First write the beta into the working-tree files yourself:
   `{version.file}`, every file of `{version.replicated_in}`, and the prose seats quoting the old
   beta you find with a search — a badge quotes it URL-escaped, which the program converts — each
   holding exactly the replacement and nothing else. Then run `architect/release.mjs` with
   `action: "beta"`, the same version keys, the `beta`, the `prose_paths` you wrote and a `message`
   in `{language.commit}`: it checks each file holds exactly the beta transform of what development
   carries — any other difference fails the call instead of smuggling a change into the beta commit —
   and commits the group on `{channels.development}` with the plumbing, as the release writes
   production. It is a step of its own and not a `git commit`: the node's own write, and the tree is
   left clean. A rerun finding the beta already there writes nothing. Where no `{version.file}` is
   declared there is no beta to advance: skip it and declare it in `detail`.

   **`action: "dry"` runs all of it and moves no ref.** Same keys, same answer, plus `would_be` —
   the commit it would write — where `release` gives `production_sha`. Use it when the owner wants
   to see the release before it exists, and when in doubt about which case you are in: the dry run
   says `amended`, and the dry run is the release itself up to the one irreversible line.

   Never `git push`, in none of these steps: the release stops at the local ref, and the push stays
   the manual gesture of the owner. **A release is closed by the push, not by this node.**

## Flushing the working tree — **worker** role

**Road `A` of step 1, and the whole of it.** Where the owner chose to have the release make the
tree clean — or where there was nobody to ask, which takes the same road — this is how.
The work is not discarded and not stashed: it enters history through the cycle that reads it, which
is the only door a commit has here — the command guard denies `git commit` outside a review cycle.
And the release does not trust this step to have happened: `architect/release.mjs` refuses a working
tree that is not clean, so a release that arrived here without flushing writes nothing at all.

- **the work the cycle reads.** Delegate it to a subagent fully running `skills/review/SKILL.md` —
  scope, rounds, gate, and the commit that closes it green — on what stands under `{code_root}`,
  which is the whole perimeter its finders read. That commit is the one the cycle would make anyway:
  do not pass `--no-commit`.
- **the work it does not reach.** The cycle does not close at `{code_root}`: its closing commit runs
  `skills/commit/SKILL.md`, which always delegates `skills/update-memory/SKILL.md`, authorised to
  stage and commit the memory and the workshop's own documents the diff made stale — `{memory.root}`,
  `{hosts.<host>.instructions_file}`, the founding documents (`documents.*`) and `.daiku/policies/`.
  What neither the cycle nor its closing commit reaches is delegated to a second subagent fully
  running `skills/commit/SKILL.md`, with those paths named one by one. It commits in the window the
  first has just opened — the guard leaves the commit open for an hour after a cycle closes
  green, and the two run one after the other. Where the cycle opened no ledger — nothing under
  `{code_root}` differs from the base — there is no window at all, and this work stays where it is:
  it is then the tree that decides, and the release stops.

Read `git status --porcelain` again once both have returned. A path still standing there is one
neither the cycle nor `commit` could take: it is said in `detail`, and nothing is released.

## What you return

One JSON block, in chat, at the end — and it is the block `schemas/blocks.json` § *release*
mirrors, where this file stays normative on divergence:

```json
{"ok": true, "released": false, "version": null, "development_sha": null, "production_sha": null, "amended": false, "changelog": null, "detail": "<why nothing was released, or what the release wrote>"}
```

- `ok` is `true` when the node ran to its end — including when it correctly found nothing to release
  — and `false` only when it could not proceed at all;
- `released` is `true` only when production was moved; on `true`, `version` is the number the
  release wrote (or `null` where no `{version.file}` was declared), `development_sha` the
  development tip it carried, `production_sha` where production now stands, `amended` whether it
  replaced a draft or opened a new release, and `changelog` the path whose section was written
  (or `null`);
- `detail` always says what happened, and on `released: false` says which of the cases it was:
  no channels declared, the copy not on the development branch, a working copy holding production,
  uncommitted work left to the owner's own commit, uncommitted work the cycle could not flush, or
  nothing to release. The one where the work is left to the owner's own commit is not a case a run
  carrying `--with-commit` can return: road `B` is not reachable there, and `detail` says the flush
  was the flag's. Where § *First run* asked,
  it also says which exclusions were recorded in `.daiku/project.json` — or that there was nobody
  to ask and the next run asks again. On `released: true` it also says which beta development was
  advanced to — or, where no `{version.file}` is declared, that there was no beta to advance.
  Where the release replaced a draft keeping its number, it says so and names the bullets that
  joined it.
