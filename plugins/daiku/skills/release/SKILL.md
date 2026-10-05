---
name: 'release'
description: 'Promotes the development branch onto production, once per release: the version lives on production and never on development, the release writes it there with the changelog section built from the block of commits accumulated since the last published release, and replaces the release standing on production for as long as nothing has pushed it. It never pushes — the push stays a manual gesture of the owner. On a project that declared no channels it has nothing to promote and says so.'
argument-hint: '[technical root, optional — default: current directory]'
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

**Development carries a beta of the next release, and no changelog.** `{version.file}` stands there
holding the number production carries now with its patch raised by one, marked as a beta with a
counter — `1.1.4-b.7`. The counter goes **after a dot and is numeric**: `b.7`, never `b7`, which as
an alphanumeric identifier semver orders `b10` before `b9`. The beta is not a release, and no
release ever reads it: a release derives its number from production's own and writes it on
production, overwriting this one there. It is there because a package installed from its own
development tree must declare a version, and because that declaration is what moves the installed
copy. It moves when the shape of the product moves — a commit `init` would carry into the projects
that use it. `{changelog}` is not a file on development: a released section is born on production,
at the release, and it is not written back.

**Production is a line of releases.** It does not fast-forward onto development and it is not
development's ancestor: each release is a commit of its own, carrying the development tree as it
stood at that moment plus the version and the changelog. What makes a release true is therefore not
a merge but the fact that it was built here, and nothing of it reaches development.

**Production is the product, and the workshop is not the product.** What reaches it is the product
of the project, never the seats the method deposited there: `.daiku/`, the instructions file, the
folders `sync-host` writes, the memory root. That is not the project's to decide and this node does
not decide it either — the program holds the list and takes the paths off the tree — but the
project **can extend it**, and `{release.never}` is where its own answer lives, the one
`new-project` asked it for. Where the project declared a `{release.source}` the question is mostly
moot, because nothing outside that folder is read; where it did not — the ordinary project, whose
product is the whole tree — the footprint is the whole difference between publishing a product and
publishing the workshop. Read `never` in the status before releasing: it is what stays behind.

## When to use it

You run it by hand, on the main tree, when you decide to release. It is not part of any chain and
no other node launches it: `ship-feature` ends by merging the delivery **onto the development
branch** — the branch the main tree stands on — and the release is a separate, deliberate gesture.
A project that did not declare `channels.production` has no release at all, and this node says so
and stops.

## Input

The **technical root** — the directory the skills run from, carrying `.daiku/project.json`. With an
argument, it is that; without one, it is the current directory. From it you resolve every key, and
run every command with `git -C "<technical root>"`.

**The release runs from a copy standing on `{channels.development}`.** It never checks production
out, and it refuses to run while a working copy holds it — a copy holding a branch this node moves
would be left describing a commit that is no longer there. Close that copy and relaunch.

## The step

**Applies only if `{channels.development}` and `{channels.production}` are declared.** Where either
is absent the project did not adopt the two channels: return `released: false` and the `detail`
saying so, and stop — §6 of `contracts/project-contract.md`, no fallback and no guessed branch.

1. **Read the ground.** `git -C "<root>" rev-parse --abbrev-ref HEAD` must be
   `{channels.development}`; otherwise the main tree is not standing where the work lives and
   nothing is released: return `released: false` with that in `detail`. `git status --porcelain`
   must be empty: a dirty tree is not a release state, and you do not commit somebody else's
   uncommitted work.

2. **Measure.** Run `architect/release.mjs` with `action: "status"`, passing the root, the two
   branches and the release's own keys — `{release.source}`, `{version.file}`,
   `{version.field}`, `{version.replicated_in}`, `{changelog}`, `{hosts.<host>.instructions_file}`
   and the paths that never reach production: `{release.never}` where declared, plus
   `{memory.root}`. It answers with the development tip,
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

4. **Ask the version, once, on the block.** From `current_version`, ask the owner **major**,
   **minor** or **patch** with `AskUserQuestion` — one question, three options, in the chat
   language, the recommended first. The answer is the increment; the new number is derived from
   `current_version`. Because this node runs in the conversation, the channel to the owner exists —
   it is the whole reason the question lives here and not inside a subagent.

5. **Write the changelog section.** In `{language.commit}`, in the style `{changelog}` already
   uses, with the entries the convention admits: which commit types produce an entry is not decided
   here but by `.daiku/domain/commit-convention.md`, and where that file is absent by the sections
   already present in `{changelog}`. The section's own prose is yours — the heading with the new
   number and the date of the day, the bullets, the rule that closes it. What you do **not** do is
   place it: the program places it, below the changelog's title, deterministically.

6. **Release.** Run `architect/release.mjs` with `action: "release"`, the same keys as step 2, the
   `version`, the `from_sha` the status returned, the `section` you just wrote and the `message` —
   `release <version>`, plus ` — <the first line of the notes>` where there are notes.

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

   **`action: "dry"` runs all of it and moves no ref.** Same keys, same answer, plus `would_be` —
   the commit it would write — where `release` gives `production_sha`. Use it when the owner wants
   to see the release before it exists, and when in doubt about which case you are in: the dry run
   says `amended`, and the dry run is the release itself up to the one irreversible line.

   Never `git push`, in none of these steps: the release stops at the local ref, and the push stays
   the manual gesture of the owner. **A release is closed by the push, not by this node.**

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
  a dirty tree, or nothing to release.
