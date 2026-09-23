# The four guardrails

Daiku ships four hooks. They do two different jobs: two **stop a gesture** before it happens, the
other two never stop anything and only say what they know.

| Hook | Event | What it does |
|---|---|---|
| `lib/command-guard.mjs` | `PreToolUse` on `Bash`/`PowerShell` | denies five destructive gestures: four always, one only where the project declares it |
| `lib/edit-guard.mjs` | `PreToolUse` on `Edit`/`Write`/`MultiEdit` (`apply_patch` too on Codex) | denies new files outside the declared seats; edits to existing files always pass |
| `lib/contracts-post-edit.mjs` | `PostToolUse` on `Edit`/`Write` | after a write to the corpus, reports faults that would not fail on their own |
| `lib/session-advice.mjs` | `SessionStart` | at startup, says whether Daiku is halfway opened and whether work was left in flight |

Next to them stand two modules that are not hooks: `lib/project-root.mjs` finds the project
root on both hosts, `lib/daiku-config.mjs` reads `.daiku/project.json`. They have no bench of
their own: the benches of the three importing them test them.

## Not a security barrier

The policy an agent cannot remove lives in the host's **managed settings**: above
every other source, and unwritable by an unelevated process. A hook does not override them — the
documentation says so explicitly: a hook's decision does not override a permission rule.

These three sit below that line and cover something else: **distraction**. Gestures that
cost lost work and that no prefix rule can recognise, because that rule
matches the start of a line and does not enter `sh -c`.

The split must be kept: **permissions live in managed settings, domain guardrails live
here.** That these files stay writable takes nothing away from the policy.

## Nothing switches itself on

A package installs once and is active on **every** repository the host opens, including
ones that never saw Daiku. So `command-guard`'s first question is not "is this
command dangerous?" but "did this project ask for anything?".

1. **Without `.daiku/project.json` it denies nothing**, ever, without even reading the line.
2. **Only one branch has its own switch**: `{worktree.pool}`. The other four deny
   always — an agent is never left free to push, to skip commit
   hooks, or to commit `.daiku/`: never trust an LLM.

| Branch | Switched on by | What it denies |
|---|---|---|
| Windows links | *no switch*: `.daiku/` is enough | a recursive removal crossing a junction and emptying the real directory on the other side |
| `.daiku/` commits | *no switch*: `.daiku/project.json` is enough | every commit containing `.daiku/` — an explicit pathspec in `add`/`commit`, or already in the stage (read with a read-only `git status`, degrading to allowed when it fails) |
| worktree pool | `worktree.pool` | removals inside a pool worktree, and `pnpm install` run from one |
| `--no-verify` | *no switch*: `.daiku/project.json` is enough | `git commit` with `-n` or `--no-verify`, wherever the flag stands |
| push | *no switch*: `.daiku/project.json` is enough | `git push`, even inside a wrapper or queued after another command; `--dry-run` no |
| new-file spill | *no switch*: `.daiku/project.json` is enough | creating a file outside the declared seats — `{code_root}`, the single-file seats, the folder seats, `.daiku/` conventions, review state, temp; editing an existing file is always allowed |

The first branch has no switch because it is not a policy: `rm -rf` entering a junction and
destroying what sits on the other side is an operating-system fact, true in every
project, and a junction cannot be seen by reading the command line. The second has none by
owner decision, not by system fact: the repository belongs to the client, Daiku is secret,
and the ban holds in any case — which is why it is not declared. Same for
`--no-verify` and push, by owner decision: an agent is never left either
freedom. Wherever a ban can have a deterministic seat, it always has one — never trust an
LLM.

The other three are decisions of whoever keeps the repository, and Daiku does not presume them. It is §6 of
`contracts/project-contract.md` — *what the JSON does not declare does not exist* — applied to a
hook instead of a skill.

A complete example, in `.daiku/project.json`:

```json
{
  "worktree": { "pool": "../wt", "prefix": "wt-", "max": 3 }
}
```

`session-advice` follows the same rule: it looks for work left halfway only inside the folder
`paths.studies` declares. No declaration, no notice.

`contracts-post-edit` does not, and the difference is deliberate: that hook **denies nothing to anybody**, and
a YAML frontmatter silently emptying is a fault even for whoever does not have Daiku.

## They degrade open, and that is why they have a bench

All four are **fail-open**: malformed stdin, missing file, unreachable disk, exception →
silent and exit `0`. A guard breaking the turn costs more than it protects.

The price is declared: **a broken hook is indistinguishable from one with nothing to say.**
That is why each carries a test bench running on a simulated filesystem, touching
nothing, and printing a counted total:

```bash
node hooks/self-check.mjs          # all four benches at once, with the summed total
node hooks/lib/command-guard.mjs --self-check   # one only, as sync-host runs it
node hooks/lib/edit-guard.mjs --self-check      # the coarse edit perimeter, alone
```

The first exits `1` on the first red: the command for a CI and to run before a
release, next to the two package validators.

## What they do not do

- **They do not run anything not already running.** In particular `contracts-post-edit`
  *reminds* to run a rewritten guard's bench, and does not run it: starting a file
  because it just appeared would mean running code nobody reviewed yet,
  bypassing both the confirmation the host asks for a command and the hash approval
  Codex demands precisely for hooks.
- **They never write to disk.** They read, and answer the host.
- **They do not speak just to say everything is fine.** A notice that arrives every time stops being read.

## Node and nothing else

The four hooks are `.mjs` files run with `node`, dependency-free: no `package.json`, no
module to install. On a project where `node` is not on the `PATH` they do not start — and since
the host does not stop a turn for a failing hook, the result is silence. When a project
has no Node, these guardrails are absent: a requirement, not a graceful degradation.

## They do not reach both hosts the same way

On **Claude Code** the package carries them: `plugin.json` declares `hooks`, and `hooks/hooks.json`
hooks them up with `${CLAUDE_PLUGIN_ROOT}`. They update when the package updates, and nothing
appears in the project.

On **Codex** no: `plugin_hooks` is a **removed** feature and the validator rejects the
`hooks` key in the manifest. There the hooks live in `<repo>/.codex/hooks.json`, outside the package, and
`/sync-host` carries them there by copying `lib/` into `.codex/hooks/` and writing the manifest from the template
in `templates/codex/hooks.json`. The paths inside are **absolute**, because a Codex hook gets
no variable pointing at the project; they must be rewritten when the repository moves, and
re-running `/sync-host` rewrites them.

After every update, on Codex, changed hooks ask for approval again with
`/hooks`: trust is recorded on the file hash, and until granted they are skipped.
