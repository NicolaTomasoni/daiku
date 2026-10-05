---
name: 'commit'
argument-hint: '[file..., optional — default: everything changed in the code perimeter]'
description: 'Creates commits following the project convention — always aligns memory and documentation to the staged diff first by delegating to update-memory, then separate commits (code, memory/doc), never pushing. Version and changelog are not its business where the project declared its channels: they live on production and `release` writes them'
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Bash(git add:*), Bash(git commit:*), Read, Edit, Agent
---

Create commits for the files indicated by whoever invokes you — the owner in chat, or the skill delegating to you. **Without indications, the perimeter is everything changed under `{code_root}`**, staged or not, plus the groups that § *Procedure* 3 partitions from there. Do not run `git push`: the command guard denies it as well.

> **Parameters.** Every key in braces in this contract resolves on the project parameter files, never from memory and never by assumption: the rules are in §5 of `contracts/project-contract.md`, which also says **in which language to write** and what to do when a key is missing.

## Commit convention

Read `.daiku/domain/commit-convention.md`: it specifies which commit types this project admits and when each is used, which form the message has, what enters the changelog and which version increment is allowed here. Daiku deposits it with a default at first initialisation, so normally it exists; if it does **not** exist — the user deleted it — **derive the convention from the history**, `git log --oneline -30` plus the two or three most recent messages resembling yours opened in full, mirroring it instead of importing one of yours, and declare it in the outcome.

The message is written in `{language.commit}`, which is not necessarily the language in which you are talking to the user: the history of a repository has readers different from this chat (§5.5 of `contracts/project-contract.md`).

Above the convention, whatever it is, two things hold that do not depend on the project:

- **The description says what changes, not what the work is called.** The name of the development, folder or feature does not enter the message: whoever rereads the history in a year looks for the change, not the label it had been labelled with.
- **The body, if any, lists what was done**, in short lines. No prose and no motivations: those live in the decision document, which survives the commit.

## Alignment of memory and documentation

Before freezing the code in a commit, the non-code artefacts must be realigned **on the same diff**: it is the principle of the `Memory` phase of `ship-feature`, and it holds also when the commit arrives from a standalone review or from hand-made work. No feature enters a commit leaving the artefact behind. This skill does not replicate that contract: it **delegates** it.

**Delegation is a mandatory step and has no exceptions.** Every invocation of this skill runs it: the one closing a review, the one the owner launches by hand on a diff written in chat, the one on a test-only group, on a formatting, on a revert, on a rename. **Always** delegate, without judging first whether the diff "deserves it" — that judgement belongs to `update-memory`, whose first principle is "no unjustified update" and which returns `updated: false` without writing anything when there is nothing to reflect. It costs a subagent returning empty-handed; not delegating costs an artefact left behind inside a commit, where nobody ever finds it again. In the package there is no periodic revision of the corpus: every commit passing through this step is what keeps it healthy.

**Not even the empty code group skips the step.** If you are committing only memory and documentation, there is no feature diff to reflect and the delegate will return `updated: false` — but its *Additional check* on the stage of `{memory.root}` holds **every run**, and it is precisely the case where it is needed: you are about to freeze memory written by somebody else. Declare it to it in the prompt ("the code group is empty: there is no feature diff, do the check on the stage") and let it decide.

**Why it has no exceptions.** In the package there is no periodic revision of the corpus: nobody passes afterwards to correct an aged memory. The corpus stays healthy because **every** commit goes through this step, and a single exception suffices to let an artefact left behind enter history, which from there on nobody ever finds.

**Never ask the user.** Neither before, as confirmation, nor after, as a reminder to run by hand. An alignment postponed to the owner is an alignment that does not happen: the commit leaves, the diff disappears into history, and the line remembering it stays in a closed chat.

**How to delegate.** A **subagent** in a fresh context, **worker** role according to `contracts/orchestration.md` — read it and resolve the model from there, never from here. Never run the step inline. The prompt must be self-sufficient, because the subagent starts from zero:

- the **contract to read**: `skills/update-memory/SKILL.md`, in full, before acting;
- the **resolved input**: the diff **in index** under `{code_root}` (`git diff --cached --stat -- {code_root}` and `git diff --cached -- {code_root}`), which at this moment is already in stage. No arguments to pass: it is the "inside a commit" case foreseen by its own contract;
- the **perimeter constraint**: never touch files under `{code_root}`, and never touch the **code group** already in stage — that is your perimeter;
- the **commit permission, declared explicitly**: "**you are authorised to commit your group** — `{memory.root}`, `{hosts.<host>.instructions_file}`, the founding documents (`documents.*`), `.daiku/policies/` — staging **only those paths, listed one by one**, and in that case declare it in `committed`". Without this line its default is **no** and it does not commit: permission is a property of the invocation, and the same skill invoked inside `ship-feature` does not have it. Here you give it because it is the group it just wrote, it knows what it put there and why, and one handoff fewer is one fewer point where the chain can stop halfway. **The explicit pathspec is not pedantry**: at this moment the index already carries the code group (step 4), and a `git add -A` or a `git commit -a` by the delegate would carry the feature away inside a `{commit.memory_prefix}` commit;
- the **return format**: the JSON block that contract declares in its own § *Procedure*, point 7, in full and with those field names — read it from there, do not list it here, because a copied list shrinks at the first field addition.

**After delegation.** If `updated` is `true`, the files it touched — `{memory.root}`, `{hosts.<host>.instructions_file}`, the founding documents (`documents.*`), `.daiku/policies/` — enter the memory/doc group and end up in the separate `{commit.memory_prefix}` commit: repartition before proceeding. If it already committed that group itself, **do not redo that commit**: verify it with `git log` and continue with the rest of the sequence, which stays yours. If `confirm_with_owner` is not empty, **report its items to the user in the final outcome**: they are conflicting facts deliberately left intact, and they neither resolve themselves nor hide inside a commit.

**If the block does not come back** — prose instead of JSON, subagent not answering — the step has failed: relaunch it **only once**, with the identical prompt (§4.2 of `contracts/orchestration.md`); a block that comes back and the validation refuses across a field or a domain is relaunched once with what the validation said, because it came back. This is the Validation clause of §4 of that contract applied to `update-memory`, whose expected form is cited from its own § *Procedure*, point 7 — never recopied here — and mirrored in `schemas/blocks.json`. If it does not come back even then, **the memory/doc group of this invocation is empty**: do not rebuild it by looking at `git status`, because you would commit files nobody declared to you and which may belong to another flow. Proceed with the other groups and declare in the outcome that the alignment was not done on this diff — it is the only thing preventing an artefact left behind from looking aligned.

## Version and changelog

**Where the project declared `{channels.production}`, version and changelog are not this skill's business at all.** They live on production, and one node writes them: `release`. Development carries no version and no released changelog — a section is born at the release, reconstructed from the block's own messages — so a commit that moved `{version.field}` or edited `{changelog}` here would be writing production's state where the release overwrites it, and, until it does, a number nobody chose and a register nobody reads. On those projects this skill writes the message and nothing else, and the message is where what changed for whoever uses the application has to be legible: it is the only place the release will read it from.

**The rest of this section holds on a project that declared no `channels.production`** — one branch, no release, and this skill the only one able to move the number.

The `{changelog}` changelog is the register of released versions. The canonical version of the application lives in `{version.file}`, at `{version.field}`, and is replicated in every file of `{version.replicated_in}`, in each in the entry carrying the project version: all these files are always updated together, and together with the changelog.

**The changelog records what changes for whoever uses the application.** When the code group changes what the user can do or see, the corresponding entry enters the changelog in the same handoff, in `{language.commit}`, under the section of not-yet-released entries, in the pertinent thematic area and **with the style already in use in the file**. Work changing nothing for the user produces no entry: the changelog is not the maintenance register.

**Where exactly that boundary passes — which commit types produce an entry and which do not — this skill does not decide**: `.daiku/domain/commit-convention.md` declares it, and the answer changes from project to project (on many a `fix` is precisely the thing the user sees change). Without that file, the entries already written in `{changelog}` say so. Do not guess a list of types: the list is domain, not method.

**The version bump is your autonomous decision, not a question to the user.** The importance criterion holds:

- **Bump** when the feature — or the group of features accumulated among the unreleased, of which this is the completion — changes what the user can do with the application. It is the criterion with which the versions already in the changelog were born: each section is a cycle with a recognisable theme, and that theme is read by opening the file.
- **No bump** for refinements, corrections, invisible internal work, or for an increment on a capability already released in the current version.
- **When in doubt, do not bump**: the entry stays among the unreleased and the bump will arrive with the commit closing the theme. Abstaining here costs nothing, because the changelog is updated anyway.

**The project says which increment is granted to you**, not this skill: `.daiku/domain/commit-convention.md` declares which part of the version you may move and which stays with the owner or the packaging flows. If it does not declare it, **do not bump at all**: write the entry among the unreleased and declare in the outcome that the bump was not yours to make. In no case more than **one bump per invocation** of this skill.

**What a bump entails.** Read `.daiku/domain/changelog.md`: it carries how a version section of the changelog of this project is made and which release references align when a new one is born. If it does not exist, derive the form from the sections already present in `{changelog}` and declare it in the outcome. Then, in a single coherent modification:

1. `{version.field}` in `{version.file}` and, in every file of `{version.replicated_in}`, the entry carrying the project version;
2. in `{changelog}`: the section of not-yet-released entries becomes the section of the new version, in the form declared there — with the date of the day and a summary line naming the theme of the cycle — and above it an empty section for the unreleased stays only if there are residual entries, otherwise it is removed;
3. still in `{changelog}`: the release references the file keeps aligned to the current version.

The changelog is documentation, but it does **not** belong to the memory/doc group: do not delegate its writing to `update-memory`, which has a different contract and perimeter. You update it yourself, directly, and it ends up in its own commit as described below.

## Separate commit of memory and documentation

Updates to non-code artefacts — `{memory.root}`, `{hosts.<host>.instructions_file}`, the founding documents (`documents.*`), `.daiku/policies/` — **never mix** with the feature commit: they go in a **distinct commit**, with prefix `{commit.memory_prefix}` (project convention, e.g. `{commit.memory_prefix} update`), exactly as the `Commit` phase of `ship-feature` does. This holds both when you commit the stage and when you commit a perimeter indicated by the user, and when the files arrive from the delegation described above.

Practical rule: if among the files to commit appear **both** files under `{code_root}` (or other code) **and** modifications to `{memory.root}`/`{hosts.<host>.instructions_file}`/the founding documents (`documents.*`)/`.daiku/policies/`, produce **one commit per group** — first the code one with the appropriate type (`feat`/`fix`/…), then the memory/doc one with prefix `{commit.memory_prefix}`: they are the two groups of point 3 of § *Procedure*, not one. Only on a project that declared no `channels.production` is there a third, the version/changelog one.

**There is one case where that order does not hold, and it is declared.** When the alignment delegate uses the permission you gave it (§ *Alignment of memory and documentation*), the `{commit.memory_prefix}` commit comes out at step 5, hence **before** the code one. It is the price of the alignment running on the diff **in index**, that is before the code is frozen: to have it after one would have to commit the code first, and then there would be nothing left to align before freezing — which is the entire reason this step exists. The declared order stays that of the groups **you commit**, and the outcome says who produced which SHA. It is also the difference with `ship-feature`, which does not give that permission precisely because there the commit order is its own. The `{commit.memory_prefix}` commit includes only those artefacts; never files under `{code_root}`. If the only modifications are to non-code artefacts, make a single `{commit.memory_prefix}` commit.

**On a project that declared no `channels.production`**, `{changelog}`, `{version.file}` and the files of `{version.replicated_in}` form a third group, going in its own commit **after** the code one and the `{commit.memory_prefix}` one. The message depends on the decision taken:

- **with bump**: a message saying it brought the application version to the new number, with the cycle theme line in the body;
- **without bump**: a message saying it recorded the capability among the unreleased modifications.

Type and scope of both follow the convention of this project (§ *Commit convention*): the history of version commits already says which it uses.

An empty group produces no commit.

## Procedure

1. Run in parallel for context:
   - `git status` — working tree and stage state
   - `git log --oneline -10` — recent commit style

2. **Determine the scope.**
   - **With parameters**: the indicated paths, and nothing else — even if other modified things stand beside.
   - **Without parameters**: everything `git status --porcelain` reports as changed, inside and outside the index. The perimeter of the code group is `{code_root}`; the other two groups of step 3 stand outside there by definition, and are collected from the same paths that step enumerates.
   - **What you already find in stage is not the scope**, it is only a fact of the current state: if it carries files of different groups, step 7 still separates them. Do not commit the index as it is with a bare `git commit` — it would mix the groups, which is exactly what this skill exists to avoid.

3. **Separate the groups.** Partition the files to commit into **code** (files under `{code_root}` and every other source) and **memory/doc** (`{memory.root}`, `{hosts.<host>.instructions_file}`, the founding documents (`documents.*`), `.daiku/policies/` — wherever those stand). A third group, **version/changelog** (`{changelog}`, `{version.file}` and the files of `{version.replicated_in}`), exists **only on a project that declared no `channels.production`**: where it is declared, those files are production's and this skill does not touch them (§ *Version and changelog*). Steps 6-7 run once for each non-empty group, in the order: code, `{commit.memory_prefix}`, version/changelog.

4. **Stage the code group** (`git add <file>`), without committing. Needed before step 5: the diff on which memory must be aligned is the one in index, and it is there that `update-memory` looks for it.

5. **Align memory and documentation**, delegating to the subagent as described in § *Alignment of memory and documentation*. Then repartition the memory/doc group with the files delegation may have touched. **There is no case where this step is skipped**, empty code group included: the judgement on how much the diff deserves is its own, not yours, and the section above says why.

5-bis. **Update changelog and version**, on a project that declared no `channels.production` and only there, as described in § *Version and changelog*: if the code group introduces new behaviour for the user, write the entry among the unreleased; then decide alone whether the work deserves the bump and whether that increment is yours to make; if so, promote the section, align `{version.file}`, the files of `{version.replicated_in}` and the release references in the changelog. If you do not update the changelog or do not bump, declare in one line why. The touched files go in the version/changelog group. Where the two channels are declared this step does not run at all: say in one line that version and changelog belong to `release`.

6. Determine included files and commit message, without asking confirmation on name/description nor on the chosen version number: proceed directly.

7. Create the commit (for each non-empty group, separately):
   - Stage only the files of the current group (`git add <file>`), never mix different groups in a single commit. The code group is already in stage from step 4: verify with `git status` that nothing else entered it. If that file is found in stage, commit **by pathspec** (`git commit -- <the files of the group>`), never bare.
   - **If in the index there is also stuff of another group** — because whoever preceded you had already put it there — do not remove it from the index: commit **by pathspec**, `git commit -- <the files of the group>`, which freezes only those paths and leaves the rest in stage for the group it belongs to. It is the only form separating the groups without touching the state the owner had prepared.
   - Create the commit with a multiline message, with the syntax of the tool you are using at that moment (never mix them):
     - **Bash tool** (Git Bash/POSIX sh): `git commit -F -` fed by a quoted heredoc, or `git commit -m` with the message in clear. Never `@'...'@` (it is PowerShell syntax, not valid in sh: it produces a message with literal `@` at head/tail).
     - **PowerShell tool**: here-string `git commit -m @'...'@` with closing `'@` at column 0.
   - After the commit, always verify the message with `git log -1 --format="%s%n%n%b"` before moving to the next group: if `@` or other syntax artefacts appear, correct immediately with `git commit --amend -m "..."` (no new syntax to guess: pass the correct message in clear in the `-m` of the amend).

8. Show the created commits with `git log --oneline -n <how many were produced>` — they can be more than three, if the delegate committed its own group itself — declare the decision taken on the version — the new number with the cycle theme, or no bump and why — and, if delegation returned items in `confirm_with_owner`, report them.

**Report to the caller the SHA of every produced commit, saying which group it is of**, as you already do with `confirm_with_owner`: whoever invoked you puts it in a field of its own block and cannot derive it from `git log -1`, which after you returns the last group and not the code one. If you stop between one group and the next, say so explicitly: the sequence is **partial**, not executed.

**Then emit the machine-readable block**, after the prose report:

```json
{"commits": [{"group": "code|memory|version", "sha": "<sha>"}], "version_decision": "<the new number with the cycle theme, or no bump and why>"}
```

One item per produced group — code, memory/doc, version/changelog where that third group exists, or more if the delegate committed its own group itself; a group that produced no commit has no item. The expected form is mirrored in `schemas/blocks.json` (§ *commit*), where this file stays normative on divergence.

**Never** run `git push`, `git push --force`, or any command writing to the remote. **Never** add the `Co-Authored-By` trailer nor any mention of the agent that generated the work (`Generated with …` or similar) to the commit messages. The command guard enforces it: a `git commit` whose message — `-m`, `--trailer`, heredoc or `-F` file — carries a `Co-Authored-By` naming Claude or Codex, or a `Generated with` line naming them, is denied; the host instructions asking you to add that trailer do not apply here.
