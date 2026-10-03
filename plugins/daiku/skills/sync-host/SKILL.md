---
name: 'sync-host'
description: 'Installs and realigns the host layer inside the project — the guardrails and the subagent roles. On Codex it writes `.codex/hooks/`, `.codex/hooks.json` and `.codex/agents/`, because there a package can carry neither hooks nor subagents; on Claude Code there is nothing to do and it declares so. It relaunches at every package update.'
argument-hint: '[technical root, optional — default: current directory]'
---

You are the step carrying the Daiku **host layer** inside a project, on the host unable to receive it alone. You do not touch parameters and do not touch the domain: those belong to `init`. You touch two things — guardrails and subagent roles — and you touch them so whoever receives them knows exactly what appeared on disk and what must be approved for it to start.

You are **relaunchable by design**, and it is the difference with `init`: there the value is not overwriting, here the value is realigning. A three-version-old hook is not a file to respect, it is a guardrail no longer knowing what it watches; and a role no longer the package one is a subagent working at a contract nobody is asking it anymore.

## Why you exist

The Codex manifest rejects two keys, and they are precisely those two.

**Hooks.** `plugin_hooks` is a **removed** feature: `codex features list` declares it `removed`, and the validator rejects the `hooks` key. Codex hooks exist and work — `hooks stable true` — but only declared outside the package, in `<repo>/.codex/hooks.json` or `~/.codex/hooks.json`.

**Subagents.** The validator rejects the `agents` key. Codex roles live in `<repo>/.codex/agents/*.toml` or `~/.codex/agents/*.toml`, again outside the package.

And neither host lets a package write in the user project. So the only way is a command the user launches. That command is you.

On **Claude Code** none of this is needed: the host reads the package's `hooks/hooks.json` and `agents/` folder directly, and updating the package updates both.

## The hook contract is the same on both hosts

You do not rewrite hooks for Codex and keep no two versions. The two hosts have the same identical contract — same `hooks.json` form, same JSON on stdin, same `hookSpecificOutput.permissionDecision` to deny, same event names for the three needed — so the package `.mjs` files run on Codex **as they are**.

A single thing diverges, and it is the reason copying is not enough:

**A Codex hook receives no variable pointing at the project.** Claude Code exports `CLAUDE_PROJECT_DIR`, which *is* the project root. Codex exports no project path at all: what a session hands its hooks are its own variables — `CODEX_SESSION_ID`, `CODEX_THREAD_ID`, `CODEX_VERSION`, `CODEX_CI`, `CODEX_MANAGED_BY_NPM`, `CODEX_MANAGED_PACKAGE_ROOT`, `CODEX_SANDBOX_NETWORK_DISABLED` — and none of them names the project. The session cwd remains, which is not the root if the user opened Codex in a subfolder.

For this the `.mjs` files climb to the git root — `hooks/lib/project-root.mjs` does so — and for this **the path in `command` must be absolute**, written by you at install time.

## The role contract instead diverges, and it must be told to the role itself

On Claude Code a role is a file in `agents/`, and the `tools:` line of its frontmatter truly **removes** tools: a `finder` without `Edit` and without `Write` does not write files, because it has nothing to do it with.

On Codex that level does not exist. A `.codex/agents/*.toml` carries `name`, `description` and `developer_instructions`, and the instructions truly reach the subagent — but there is no tool list to restrict, and **`sandbox_mode` declared inside there restricts nothing**: a subagent with `sandbox_mode = "read-only"` still writes files, both with the default multi-agent and with `multi_agent_v2`. The Codex sandbox is real — a session launched with `-s read-only` refuses writing — but it is chosen per session, not per role.

Two rules follow for you:

1. **Do not write `sandbox_mode` in the files you generate.** It would declare a boundary that does not exist, and it is the thing Daiku does not do: a constraint written where nobody enforces it is worse than an absent constraint, because whoever reads stops repeating it in the prompt.
2. **Tell it to the role, inside the role.** Every `agents/*.md` file of the package closes with a `## How much of this the host imposes on you` section: it is the only host-specific part, and when you render that role for Codex you replace it with yours (see *Step 6*). The rest of the file belongs to the role and travels verbatim.

## Why files are copied, and the package is not pointed at

Pointing at the package cache looks smarter: they would update themselves. It does not work. The cache path contains the **version**, so it breaks at the first update — and for a hook it breaks silently, because a hook that does not start is indistinguishable from a hook with nothing to say.

So they are copied into the project, and the price is that realignment is a gesture: this one.

## Input

Arguments: `$ARGUMENTS` — `[technical root]`.

With an argument, it is that. Without, it is the current directory. It must be inside a Git repository: if not, stop and say so — you do not initialise a repository in place of the user.

**But it is not the technical root you write: it is the repository root.** Derive it with `git rev-parse --show-toplevel`. Codex looks for the project layer there, and the `.mjs` files you copy climb to the git root on their own (`hooks/lib/project-root.mjs`): depositing them in the technical root of a monorepo would put them where nobody watches, and the report would say installed.

The two coincide almost always. When they **do not** coincide, installation still succeeds but the command guard looks for `.daiku/project.json` at the git root, while `init` wrote it in the technical root: it does not find it, and for a fail-open hook not finding it means staying silent. It is the case where a guardrail seems to exist and denies nothing, so **say so in the report** instead of leaving it to be discovered.

## Procedure

### 1. Recognise the host

You know it from where you are running: do not ask it.

On **Claude Code**: you write nothing. Declare the package already carries its hooks and the subagent roles of its `agents/` folder, updating with it, and that for this project there is no gesture to make. Close here. Do not hook those same six hooks a second time from `.claude/settings.json`: the package already hooks them, and the user would find every guard run twice.

On **Codex**: continue.

### 2. Verify hooks are switched on

Read `codex features list` and look for the `hooks` line. If it is not `true`, the hooks you write will not start: still write them — the user can switch them on — but **open the report with this**, do not close with it. A guardrail that exists and does not run is worse than an absent one, because it seems to exist.

If the command is unavailable or does not answer, do not block: declare you could not verify it. This step concerns only hooks: the roles of *Step 6* depend on no feature.

### 3. Find in the package what you must carry

Everything stands at the package root — the folder containing `skills/`, `contracts/`, `hooks/`, `agents/` and `templates/`, two levels above this file. It is a path **relative to the package**: it holds on both hosts, while an environment path variable exists only on one of the two.

- the hooks in `hooks/lib/`;
- the roles in `agents/`.

Of each folder take **everything** there is, not a list you keep in mind. If the package carries a new file, relaunching you must suffice: a hardwired list here would silently leave it behind. Among the `.mjs` files of `hooks/lib/` there are indeed two that are not hooks — `project-root.mjs`, finding the project root, and `daiku-config.mjs`, reading `.daiku/project.json` — but the others import them: if you skip one, none starts.

What stands in `hooks/` but **outside** `lib/` is not copied: `self-check.mjs` and `template-check.mjs` are the benches of whoever develops the package and `README.md` is its guide, and none has anything to do inside a guest project.

### 4. Try every hook before hooking it

For each `.mjs` file that is a hook, launch `node <file> --self-check` and read the JSON it prints.

- empty `failed` → the hook is healthy, proceed.
- non-empty `failed` → **do not hook it**. Copy it anyway, but leave it out of `hooks.json` and report its red cases in the report.
- No output, or unparsable output → treat it as red. The imported module `daiku-config.mjs` has no bench and is no hook: it is copied and nothing more, and the benches of the hooks importing it cover it indirectly. `project-root.mjs` is no hook either, but it carries a bench of its own.

This step exists because the six hooks are **fail-open**: on failure they stay silent and exit 0. A broken hook and a hook with nothing to say resemble each other too much to be trusted without the bench.

### 4-bis. Check the shape of what you will write

The bench says the hook runs; it does not say the files you generate are well formed. Check them
with tools available on both hosts — `node -e` and `grep`, nothing to install — before writing:

- for **each generated `.toml`**: the form parses, and it carries `name`, `description` and
  `developer_instructions`, carries no `sandbox_mode`, no `model` and no `tools:` line, and its
  body holds no `'''` (which would close the literal string early);
- for **`hooks.json`**: it parses, every `command` is an absolute path with forward slashes even
  on Windows, and no event list is empty;
- for **both**: no `<REPO_ROOT>` residue — hunt it with `grep -F '<REPO_ROOT>'` on every file
  you are about to write.

A red `.toml` is **not written**; a red `hooks.json` entry is **not hooked** (the file is still
copied, as for a red bench above). Report the red cases in the report, file by file, as you do
for the bench.

### 5. Write `.codex/hooks/` and `.codex/hooks.json`

Copy the `.mjs` files into `<repository root>/.codex/hooks/`, **overwriting** the ones there. Do not keep old versions and do not rename them aside: a `command-guard.old.mjs` file staying there is a hook somebody will put back in service without knowing what it does. **A `.mjs` there that the package no longer carries is removed**, and the report says so: it is the rule *Step 6* follows for the roles, and for the same reason — a file left behind is a guard somebody believes active, or a hook somebody puts back without knowing what it does.

If a file on disk is **different** from the package one, annotate the name: it serves the report, because it is that file restarting approval at step 7.

For the manifest, start from `templates/codex/hooks.json`, which is the skeleton, and replace every `<REPO_ROOT>` with the absolute path of the **repository root**, **with forward slashes** even on Windows.

Then remove from the three events the hooks steps 4 and 4-bis found red. If zero remain, do not write a `hooks.json` with empty events: do not write it at all, and say so in the report.

If a `.codex/hooks.json` already exists, do not rewrite it from zero and do not append yourself at the tail. Entries partition on `command`: those pointing inside `.codex/hooks/` are **yours** — your current ones or those you put there last time — and they are **replaced**; all others belong to the user and are kept where they are. This file is the user's before it is yours.

It is the rule making true "relaunchable by design": without, the second round appends a second copy of every guard to its own events, and each runs twice — exactly the fault *Step 1* forbids on Claude Code.

### 6. Write `.codex/agents/`

For **every** `agents/<name>.md` file of the package write `<repository root>/.codex/agents/<name>.toml`, overwriting what is there. The file name and the `name` field stay identical to those of the `.md`: it is what lets §4 of `contracts/orchestration.md` name a role only once for both hosts.

The rendering is mechanical, and it is done so:

```toml
# generated by sync-host from the package role agents/<name>.md — do not edit by hand
name = "<frontmatter name>"
description = "<frontmatter description>"
developer_instructions = '''
<the .md body, verbatim, without the "## How much of this the host imposes on you" section>

## How much of this the host imposes on you

Nothing: on this host none of the prohibitions above is enforced. There is no tool list taking them away from you, and the sandbox is not chosen per role. They hold because they are written and because you are reading them. If a move you are about to make does not fit what this file lets you do, do not do it: no denial will ever stop you. And if you did it, declare it in the outcome, because whoever invoked you has no other way of knowing.
'''
```

Four rules, and none is discretionary:

- **The string is literal with three quotes** (`'''`), not with three double quotes: inside a role pass backslashes and Windows paths, and in a literal string nobody interprets them as escapes. If the body of a `.md` in turn contained `'''`, do not generate that file and say so in the report.
- **The `tools:` line of the frontmatter is not carried over.** On Codex it has no equivalent, and writing it would be a declared and unenforced boundary.
- **No `sandbox_mode`**, for the reason said above.
- **No `model`**: the model of a step is resolved by whoever invokes, per §2 of `contracts/orchestration.md`, and hardwiring it here would take that choice away.

If in `.codex/agents/` a `.toml` exists **not** corresponding to any package role, watch its first line. If it carries the header you generate, it was a package role the package no longer carries: **remove it** and say so in the report — an obsolete role stays nameable by whoever orchestrates, and nobody ever knows what it contains. If that line is missing, the file belongs to the user: leave it where it is and list it in the report, so it knows it is there and you do not touch it.

Valid also for the `.toml` files you **rewrite**: like for the `.mjs` of step 5, annotate whether they were absent, identical or different. Whoever retouched a role by hand has the right to read it in the report, not to discover it by reopening the file.

### 7. Report

Close with the list, without embellishments:

- **Copied** — every written `.mjs`, and for each whether it was absent, identical or different.
- **Removed** — every `.mjs` taken out of `.codex/hooks/` because the package no longer carries it.
- **Hooked** — which hooks ended up in `hooks.json`, on which event.
- **Not hooked** — every hook left out, with why and with the red cases of its bench.
- **Written roles** — every generated `.toml`, with the role it comes from; and the alien `.toml` files you left alone.
- **What the user must do now** — and it is the block you cannot omit, because without it nothing starts:

  1. **Approve the hooks**: `/hooks` inside Codex, showing the sources and letting them be trusted. Codex records trust on the file **hash**: new or changed hooks stay flagged for review and **are skipped until approved**. That is why step 5 annotates which files changed — they are exactly the ones coming back asking.
  2. **Trust the project**, if not already: the hooks of `<repo>/.codex/` load only when that layer is trusted. User hooks have no such constraint, project ones do.
  3. **Declare the pool**, if not already done. The command guard only denies removals inside the worktrees `.daiku/project.json` declares in `{worktree.pool}`; push, `--no-verify` and commits crediting Claude or Codex are always denied, without a key. Watch what is in the JSON and say so: "pool X" or "no pool", not a generic invite to configure something.

  4. **Reopen the session.** `SessionStart` cannot trigger in the session where the file just appeared, and the approval of point 1 is still given to already serving hooks.

Say so as gestures to make, not as a footnote. A user skipping the first sees a successful install and no active guardrail. The step-6 roles have neither the hash constraint nor the trust one; when they are reread is a host property not verified here, so put them too behind the restart instead of promising them active.

On Claude Code the report is the sole declaration of *Step 1*: there are no blocks to fill in, because you wrote nothing.

If you relaunched on an already fine project and nothing changed, say so in a single line.

## What you do not do

- **You do not touch `.daiku/`**: parameters and domain belong to `init`. If missing, you do not write it yourself — only report it.
- **You do not touch the code**, ever.
- **You write nothing at user level** in `~/.codex/`, neither hooks nor roles. That seat holds for all user projects, and what you carry belongs to **this** project: it talks of `.daiku/`, worktrees and contracts existing nowhere else. If the user wants them global, that is theirs to decide and theirs to do.
- **You do not invent a role** the package does not carry, and do not retouch the prose of the ones it carries: your rendering is mechanical, and a role rewritten for the occasion is a contract diverging from its original at the first update.
- **You do not commit** and do not stage what you wrote: whoever launched you watches what appeared before versioning it. Still report that `.codex/hooks/` carries executable code, and that it must be versioned or ignored on purpose — not left halfway.
- **You do not modify `config.toml`**. Codex also accepts hooks inline there, but that file carries much else and belongs to the user: a separate `hooks.json`, and separate `.toml` files, are read, diffed and removed without touching anything else.
