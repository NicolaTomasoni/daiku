# The five hooks

Daiku ships five hooks. They do two different jobs: one **stops a gesture** before it happens,
the other four never stop anything and only say what they know.

| Hook | Event | What it does |
|---|---|---|
| `lib/command-guard.mjs` | `PreToolUse` on `Bash`/`PowerShell` | denies five destructive gestures: four always, one only where the project declares it |
| `lib/contracts-post-edit.mjs` | `PostToolUse` on `Edit`/`Write` | after a write to the corpus — and to the sources a policy watches — reports faults that would not fail on their own |
| `lib/run-advice.mjs` | `UserPromptSubmit`, and `PreToolUse` on the write tools | marks the session a run was opened in and states the run's rule once; at a write that conversation makes outside the seats the run owns it repeats the rule — and blocks nothing |
| `lib/session-advice.mjs` | `SessionStart` | at startup, says whether Daiku is halfway opened and whether work was left in flight |
| `lib/stop-advice.mjs` | `Stop` | at session end, lists the review ledgers left open, so the next session resumes from them — once per session, never on a stop it caused itself |

Next to them stand two modules that are not hooks: `lib/project-root.mjs` finds the project
root on both hosts, `lib/daiku-config.mjs` reads `.daiku/project.json`. `project-root` carries a
bench of its own; `daiku-config` has none, and the benches of the hooks importing it test it.

## Not a security barrier

The policy an agent cannot remove lives in the host's **managed settings**: above
every other source, and unwritable by an unelevated process. A hook does not override them — the
documentation says so explicitly: a hook's decision does not override a permission rule.

These five sit below that line and cover something else: **distraction**. Gestures that
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
   hooks, or to sign a commit as its author:
   never trust an LLM.

| Branch | Switched on by | What it denies |
|---|---|---|
| Windows links | *no switch*: `.daiku/` is enough | a recursive removal crossing a junction and emptying the real directory on the other side |
| worktree pool | `worktree.pool` | removals inside a pool worktree, and `pnpm install` run from one |
| `--no-verify` | *no switch*: `.daiku/project.json` is enough | `git commit` with `-n` or `--no-verify`, wherever the flag stands |
| push | *no switch*: `.daiku/project.json` is enough | `git push`, even inside a wrapper or queued after another command; `--dry-run` no |
| agent attribution | *no switch*: `.daiku/project.json` is enough | `git commit` whose message credits Claude or Codex — a `Co-Authored-By` naming them or their makers, or a `Generated with` line — in `-m`, `--trailer`, a heredoc or here-string, or the file `-F` names |

**`run-advice` is not a branch of this table, because it denies nothing.** `run-advice` marks the
session whose opening prompt was `new-feature` — a switch **per session and not per project**, and the
only one a hook writes itself — and then has two things to say. At that prompt it states the run's
rule once: a turn of the owner asking for something to be made is carried out by a subagent, not in
the window that asked the questions. At a write the conversation makes outside the seats the run owns
(`{paths.features}`, `{paths.studies}`, `{write_roots}`) it repeats the rule, and **lets the write
through**: the rule is a default of a run, not a prohibition on a gesture, and the same conversation
does other jobs — `/commit` updates the changelog and the version by hand, by contract — where a flat
denial would stop the node that was asked for. What tells the conversation's write from a subagent's
is `agent_id`, a field the host fills **only** inside a subagent call: absent, the write is the
conversation's and the notice speaks; present, a child is doing the work, which is the point.

The first branch has no switch because it is not a policy: `rm -rf` entering a junction and
destroying what sits on the other side is an operating-system fact, true in every
project, and a junction cannot be seen by reading the command line. The others have none by
owner decision: an agent is never left free to `--no-verify`, to push or to sign a commit as
its author. Wherever a ban can have a deterministic seat, it always has one — never trust an
LLM.

The worktree pool is a decision of whoever keeps the repository, and Daiku does not presume it. It is §6 of
`contracts/project-contract.md` — *what the JSON does not declare does not exist* — applied to a
hook instead of a skill.

A complete example, in `.daiku/project.json`:

```json
{
  "worktree": { "pool": "../wt", "prefix": "wt-", "max": 3 }
}
```

`session-advice` follows the same rule: it looks for work left halfway only inside the folders
`paths.features` declares. No declaration, no notice.

`contracts-post-edit` does not, and the difference is deliberate: that hook **denies nothing to anybody**, and
a YAML frontmatter silently emptying is a fault even for whoever does not have Daiku.

## They degrade open, and that is why they have a bench

All five are **fail-open**: malformed stdin, missing file, unreachable disk, exception →
silent and exit `0`. A guard breaking the turn costs more than it protects.

The price is declared: **a broken hook is indistinguishable from one with nothing to say.**
That is why each carries a test bench running on a simulated filesystem, touching
nothing, and printing a counted total:

```bash
node hooks/self-check.mjs          # all ten benches at once, with the summed total
node hooks/lib/command-guard.mjs --self-check   # one only, as sync-host runs it
```

The first exits `1` on the first red: the command for a CI and to run before a
release, next to the two package validators.

They are the five above, `lib/project-root.mjs`, the two programs of `architect/` — the
evaluator and the review's ledger tool — `skills/init/scan.mjs`, and the bench of the host
manifests beside this file: the last four outside `lib/`, because that folder is copied into the
user's project and this one is not. They are the only benches here whose programs **fail loudly**: the five hooks
stay silent on a fault, so a total that drops is the only sign a bench stopped running, and that
sign is worth exactly as much for the two programs, whose silence stops a delivery. The ledger
tool's bench runs real Git on throwaway repositories under the system temp directory, so it
needs `git` on the `PATH`.

**A check nobody saw fail counts as red.** Beside its counted total a bench may report
`never_red`: the rules no fixture of its own ever turned red. `self-check.mjs` turns a
non-empty list red even when every case passed, because a rule that has only ever passed
cannot be told from one that cannot fail. The evaluator's bench reports it, for every rule
written through its `rule()`.

## What they do not do

- **They do not run anything not already running.** In particular `contracts-post-edit`
  *reminds* to run a rewritten guard's bench, and does not run it: starting a file
  because it just appeared would mean running code nobody reviewed yet,
  bypassing both the confirmation the host asks for a command and the hash approval
  Codex demands precisely for hooks.
- **They write nothing in the project.** They read, and answer the host. Two of them leave one small
  mark each, and both stay outside the repository: `stop-advice` marks what it announced, so the same
  notice is not delivered twice in a session, and `run-advice` marks the run this session opened —
  in the session's own scratch directory the host names, or in the OS temporary directory where
  there is none.
- **They do not speak just to say everything is fine.** A notice that arrives every time stops being read.
- **A notice never reads as an order.** `stop-advice` speaks in descriptive voice and says what
  it is, and leaves the subject where it was: `Stop`'s text lands on the tail of the answer, and
  one shaped like an out-of-band system instruction trips the reader's prompt-injection defences
  — a reader who takes it for the user's next message changes subject on his own.

## Node and nothing else

The five hooks are `.mjs` files run with `node`, dependency-free: no `package.json`, no
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

**Two hooks are Claude Code's alone, and they are declared rather than left to be discovered.** The run
boundary needs two things of its host — a `UserPromptSubmit` event to mark the session, and an
`agent_id` on the write event to tell a subagent's write from the conversation's — and the Codex
template wires neither; `stop-advice` needs a `Stop` event, which it does not wire either. There
nothing is marked and nothing is said, and the run's rule stands in
`skills/new-feature/SKILL.md` § *7. Decisions are asked in chat* and in the *Operational constraints*.
