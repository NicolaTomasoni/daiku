---
name: 'commit'
argument-hint: '[path..., optional — default: everything changed and untracked]'
description: 'Commits the working tree as it stands: stages what is changed, writes one message describing the change from the file list and the diff stat, and commits. No review, no questions, no memory, version or changelog alignment: whoever invokes it has already read the diff. Never pushes.'
# Claude Code's permission surface for this skill, ignored where the host reads no such key.
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(printf:*), Bash(mkdir:*), Bash(rm:*), Read
---

You commit. You do not review, you do not ask, you do not align anything. Whoever invokes you has
already read the diff, in this session or in another one.

## Scope

- **With paths**: only those paths.
- **Without paths**: everything `git status --porcelain` reports, staged, unstaged or untracked.

## Procedure

1. Run `git status --porcelain` and `git diff --stat HEAD -- <scope>`. Open the content of a file only
   as far as the description of the change needs it.
2. **Leave the mark.** Read `paths.review_state` from `.daiku/project.json`. Where it is declared, write
   the mark the review guard reads as the owner's own commit:
   `mkdir -p "<review_state>" && printf '{"by": "commit", "at": "%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "<review_state>/commit-alone.json"`.
   Where it is not declared, there is no review guard and no mark to leave.
3. Stage the scope: `git add -A -- <scope>`.
4. Write the message in `language.commit` of `.daiku/project.json`, in the form of the recent history
   (`git log --oneline -5`): `type(scope): description`, one line. The description says **what changes**,
   not the name of the feature or of the session that made it. Below it, if useful, a few short lines
   saying what was done — no prose, no motivations.
5. Commit with the message on stdin: `git commit -F -`, fed by a quoted heredoc. Never add a trailer,
   never a `Co-Authored-By`, never a line naming the agent.
6. **Remove the mark**, whether the commit passed or was refused: `rm -f "<review_state>/commit-alone.json"`.
   A mark left behind expires on its own after a quarter of an hour, but it is not left behind.
7. Show `git log -1 --format='%h %s'`.

## Rules

- One commit for the whole scope.
- Never `git push`, never `--no-verify`, never amend a commit already pushed.
- If the commit is refused, say so with the message the tool gave, remove the mark, and stop. Do not
  work around it.

## Outcome

Report the sha and the subject, then emit the machine-readable block:

```json
{"commits": [{"group": "code", "sha": "<sha>"}], "version_decision": "not applicable: this skill does not touch version or changelog"}
```
