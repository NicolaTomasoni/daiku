---
name: 'release'
description: 'Promotes the development branch onto production, once per release: it asks the version on the whole block of commits accumulated since the last release, writes the version and the changelog on the development branch, and fast-forwards production onto that tip. It never pushes — the push stays a manual gesture of the owner. On a project that declared no channels it has nothing to promote and says so.'
argument-hint: '[technical root, optional — default: current directory]'
---

You are the **promotion** of a project that declared its two channels: the work lives on the
development branch, production advances only here. You do three things and stop: you read the block
of commits the development branch carries past production, you ask the owner the version **once** on
that whole block — major, minor or patch — and you write version and changelog as the last commit on
development, then you move production onto that tip. The number moves here and only here; `commit`
is not touched and keeps its own life.

> **Parameters.** Every key in braces in this contract resolves on the project parameter
> files, never from memory and never by assumption: the rules are in §5 of
> `contracts/project-contract.md`, which also says **in which language to write** and what to do
> when a key is missing.

## When to use it

You run it by hand, on the main tree, when you decide to release. It is not part of any chain and
no other node launches it: `ship-feature` ends by merging the delivery **onto the development
branch** — the branch the main tree stands on — and the release is a separate, deliberate gesture.
A project that did not declare `channels.production` has no promotion at all, and this node says so
and stops.

## Input

The **technical root** — the directory the skills run from, carrying `.daiku/project.json`. With an
argument, it is that; without one, it is the current directory. From it you resolve every key, and
run every Git command with `git -C "<technical root>"`.

## The step

**Applies only if `{channels.development}` and `{channels.production}` are declared.** Where either
is absent the project did not adopt the two channels: return `released: false` and the `detail`
saying so, and stop — §6 of `contracts/project-contract.md`, no fallback and no guessed branch.

1. **Read the ground.** `git -C "<root>" rev-parse --abbrev-ref HEAD` must be
   `{channels.development}`; otherwise the main tree is not standing where the work lives and
   nothing is promoted: return `released: false` with that in `detail`. `git status --porcelain`
   must be empty: a dirty tree is not a release state, and you do not commit somebody else's
   uncommitted work.
2. **Close the fast-forward's precondition.** Let `<dev>` be `{channels.development}` and `<prod>`
   `{channels.production}`. Run `git -C "<root>" merge-base --is-ancestor <prod> <dev>`. If it
   **fails**, production carries commits development does not have — the state the branch guard
   exists to prevent — and you **stop loudly** with `released: false` and that in `detail`: it is
   not fused, it is resolved by hand. Where the production ref does not exist yet, there is nothing
   it carries and the promotion simply creates it.
3. **Read the block.** `git -C "<root>" log --oneline <prod>..<dev>` (or the whole history where
   `<prod>` does not exist) is the block of commits the release promotes. If it is **empty**,
   development equals production: return `released: false` with `detail` saying there is nothing to
   promote, and stop.
4. **Ask the version, once, on the block.** Read the current version at `{version.field}` of
   `{version.file}` and ask the owner **major**, **minor** or **patch** with `AskUserQuestion` —
   one question, three options, in the chat language, the recommended first. The answer is the
   increment; the new number is derived from the current one. Because this node runs in the
   conversation, the channel to the owner exists — it is the whole reason the question lives here
   and not inside a subagent.
   **Where `{version.file}` or `{version.field}` is not declared**, there is no version to move:
   skip this and the next step, keep the promotion, and declare it in `detail` — §6.
5. **Write version and changelog on the development branch, as the last commit before the
   promotion.** In one coherent modification:
   - the new number at `{version.field}` of `{version.file}`, and in every file of
     `{version.replicated_in}` — where those keys are declared;
   - in `{changelog}`, where that key is declared: the section of the not-yet-released entries
     becomes the section of the new version — the date of the day and a summary line naming the
     theme — **reconstructed from the block's own messages**, `git log <prod>..<dev>`, with the
     style the file already uses and the entries the convention admits; which commit types produce
     an entry is not decided here but by `.daiku/domain/commit-convention.md`, and where that file
     is absent by the sections already present in `{changelog}`. **The development branch carries
     no changelog between two releases**: the section is born here, at the release, not commit by
     commit.
   Then commit it on `<dev>`, with a message in `{language.commit}` conforming to the project's
   commit convention — `.daiku/domain/commit-convention.md` — and **never** a `Co-Authored-By`
   trailer nor a mention of the agent that wrote the work. Never `git push`.
6. **Promote.** Verify once more that `<dev>` is a descendant of `<prod>` and run
   `git -C "<root>" branch -f <prod> <dev>`: production now points at the tip of development, and
   the two branches coincide. This is a **local ref move**: it never touches a remote. Where
   `<prod>` does not exist, `git branch -f` creates it.

Never `git push`, in none of these steps: the promotion stops at the local ref, and the push stays
the manual gesture of the owner.

## What you return

One JSON block, in chat, at the end — and it is the block `schemas/blocks.json` § *release*
mirrors, where this file stays normative on divergence:

```json
{"ok": true, "released": false, "version": null, "development_sha": null, "production_sha": null, "changelog": null, "detail": "<why nothing was promoted, or what the release wrote>"}
```

- `ok` is `true` when the node ran to its end — including when it correctly found nothing to
  promote — and `false` only when it could not proceed at all;
- `released` is `true` only when production was moved; on `true`, `version` is the number the
  release wrote (or `null` where no `{version.file}` was declared), `development_sha` the tip of
  the development branch after the version commit, `production_sha` where production now stands —
  the same tip, because the promotion is a fast-forward — and `changelog` the path whose section
  was written (or `null`);
- `detail` always says what happened, and on `released: false` says which of the cases it was:
  no channels declared, the copy not on the development branch, production carrying commits
  development lacks, or nothing to promote.
