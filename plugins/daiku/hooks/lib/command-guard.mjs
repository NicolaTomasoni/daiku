#!/usr/bin/env node
/**
 * Destructive-command guard — PreToolUse on Bash and PowerShell.
 *
 * **This file is not a security barrier, and that is worth knowing.** The policy
 * an agent cannot remove lives in the host's managed settings, which sit above
 * every other source and which an unelevated process does not write. What remains here is a guardrail
 * against **distraction**: gestures that cost lost work and that no prefix rule
 * can recognise. Whoever rewrites it gains nothing `Bash(*)` had not already given.
 *
 * **Nothing switches itself on.** This file ships inside a package installed once
 * and active on *every* repository the host opens. So the first question is not
 * "is this command dangerous?" but "did this project ask for anything?", and the
 * answer comes from `.daiku/project.json`, not from the code below:
 *
 *  - **without `.daiku/project.json` the guard allows everything**, always, without looking
 *    at the line. It is the boundary, not a degradation: see `daiku-config.mjs`;
 *  - **every branch has its own switch** in the JSON, and a missing switch is a
 *    branch switched off — §6 of `contracts/project-contract.md`, *what the JSON does not declare
 *    does not exist*.
 *
 * There are five branches, in three families.
 *
 * **An operating-system fact**, on in every Daiku project because it depends on
 * no choice of whoever works:
 *
 *  1. **Windows links.** `rm -rf`, `Remove-Item -Recurse` and `git worktree remove`
 *     recurse *inside* a junction and empty the real directory on the other
 *     side; only `rd /s` merely detaches it. True wherever a junction is, and
 *     a junction cannot be seen by reading the command line.
 *
 * **Always on**, on every Daiku project, because an agent is never left
 * any of these freedoms — never trust an LLM, see `CLAUDE.md`:
 *
 *  2. **Commits containing `.daiku/`.** The repository belongs to the client and sees
 *     nothing of the method: nothing of `.daiku/` enters a commit, in any case.
 *     `git add` and `git commit` with a pathspec under `.daiku/`, and the bare `git commit`
 *     or with `-a` when the stage — or, with `-a`, the tree — holds a change
 *     under `.daiku/`. The stage is read with a read-only `git status`, which
 *     degrades to allowed when it fails.
 *  3. **`git commit --no-verify`.** A prefix rule matches the start of the
 *     line, so `git commit -m "…" -n` walks past it: here the subcommand is
 *     really looked at, wherever the flag stands. Commit hooks must
 *     always run.
 *  4. **`git push`.** Same reason: a prefix rule does not enter `sh -c`,
 *     while here the push is recognised even inside a wrapper, behind a `sudo` or
 *     queued after another command. Push stays a manual gesture of the owner. `--dry-run`
 *     is not: it pushes nothing.
 *
 * **A project policy**, off until the JSON switches it on:
 *
 *  5. **The worktree pool** (`{worktree.pool}`). Inside a pool worktree a
 *     removal carries away uncommitted files without recovery, and `pnpm install` rewrites
 *     the shared `node_modules` `virtualStoreDir`, leaving the
 *     root installation inconsistent. No declared pool, neither check.
 *
 * Where the host has a system `deny`, that stays the real door for 3 and 4: absolute, and
 * no source below can remove it. The two branches here close the shapes prefix
 * matching does not see, and that is why they live here and not there.
 *
 * **One shape is not enough.** The shell accepts the same gesture written many ways,
 * and the guard must know them all: a leading `cd` changing the base of
 * relative paths, quotes around the program name, a wrapper (`bash -c`,
 * `powershell -Command`, `cmd /c`), PowerShell aliases, MSYS-style paths
 * (`/c/dev/…`) that Git Bash produces. The § *Shapes this guard does not cover*, at the bottom
 * of the file, lists the ones left out: declared on purpose, because a guard
 * silent about what it does not see makes readers believe it covers it.
 *
 * This file's contract: **fail-open**. Whatever goes wrong — malformed stdin,
 * unreachable filesystem, exception — is allowed and exits 0. A guard breaking
 * the turn costs more than it protects, and the risk it covers is rare.
 *
 * Test bench: `node command-guard.mjs --self-check`, from the folder it lives in. It runs on a
 * simulated filesystem and touches nothing; the total is **counted**, not hard-coded. A broken
 * fail-open hook is indistinguishable from one with nothing to say.
 */

import { spawnSync } from 'node:child_process';
import { lstatSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { invokedDirectly, projectRoot } from './project-root.mjs';
import { REAL_READS, loadContext, fakeContext, isInside } from './daiku-config.mjs';

const ROOT = projectRoot();

function allow() {
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const pieces = [];
  for await (const piece of process.stdin) pieces.push(piece);
  return Buffer.concat(pieces).toString('utf-8');
}

// --- tokenization -----------------------------------------------------------
//
// Everything below reasons on **tokens**, not on one regex pass over the raw
// line: the lesson of the round where `"git" push` slipped past all three layers
// defending push, because the pass blanked quoted strings before
// looking for the `git` token. Here quotes are **removed** — quoting
// the program name gains nothing — but each token remembers whether it was quoted,
// so a `-n` inside a commit message is not mistaken for the flag.

/** Splits a segment into tokens, honouring quotes. */
function tokenize(segment) {
  const tokens = [];
  let current = '';
  let quoted = false;
  let open = null;
  let full = false;
  const close = () => {
    if (full) tokens.push({ t: current, q: quoted });
    current = '';
    quoted = false;
    full = false;
  };
  for (const ch of segment) {
    if (open) {
      if (ch === open) open = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      open = ch;
      quoted = true;
      full = true;
      continue;
    }
    if (/\s/.test(ch)) {
      close();
      continue;
    }
    current += ch;
    full = true;
  }
  close();
  return tokens;
}

/** Splits a line into its command segments, honouring quotes. */
function splitSegments(line) {
  const segments = [];
  let current = '';
  let open = null;
  for (const ch of line) {
    if (open) {
      current += ch;
      if (ch === open) open = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      open = ch;
      current += ch;
      continue;
    }
    if (ch === ';' || ch === '|' || ch === '&' || ch === '\n') {
      segments.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  segments.push(current);
  return segments.filter((s) => s.trim());
}

/** Tokens before the real command that do not change it: just skipped. */
const NEUTRAL_PREFIXES = new Set([
  'sudo',
  'env',
  'time',
  'nohup',
  'winpty',
  'stdbuf',
  'xargs',
  'exec',
  'command',
  'builtin',
  'do',
  'then',
  'else',
  'elif',
  'if',
  'while',
  'for',
  'until',
  '!',
  '{',
  '(',
  '&&',
  '||',
]);

const WRAPPER = /^(?:bash|sh|zsh|dash|ash|powershell|pwsh|cmd|wsl|busybox)(?:\.exe)?$/i;
const GIT = /(?:^|[\\/])git(?:\.exe)?$/i;

/** The first token that counts, skipping neutral prefixes, assignments and parens. */
function head(tokens) {
  let i = 0;
  while (i < tokens.length) {
    let t = tokens[i].t;
    if (!tokens[i].q) t = t.replace(/^[({]+/, '');
    if (!t) {
      i += 1;
      continue;
    }
    if (NEUTRAL_PREFIXES.has(t) || (!tokens[i].q && /^[A-Za-z_][A-Za-z0-9_]*=/.test(t))) {
      i += 1;
      continue;
    }
    return { index: i, name: t };
  }
  return null;
}

/** Is it an option, not a target?
 *
 * cmd's `/s` and `/q` are options; `/c/dev/project-wt/src` is the path **Git Bash**
 * produces, and the shape agents use for absolute paths on this
 * machine. Mistaking it for an option means not seeing it: only one or two
 * letters after the slash make an option.
 */
function isFlag(piece) {
  if (piece.q) return false;
  if (piece.t.startsWith('-')) return true;
  return /^\/[A-Za-z]{1,3}$/.test(piece.t);
}

/** A wrapper's payload: `bash -c "<line>"`, `cmd /c "<line>"`, `-Command "<line>"`. */
function wrapperPayload(tokens, index) {
  for (let j = index + 1; j < tokens.length; j += 1) {
    if (isFlag(tokens[j])) continue;
    // **All** of the rest of the segment, not just the first piece. Quotes around the
    // payload are the writer's convention, not a shell requirement: `cmd /c del
    // c:\dev\project-wt\src\node_modules` passes loose arguments, and stopping at the first
    // token would mean judging `del` without its target — i.e. allowing every
    // gesture written without quotes. The quoted shape is already a single token and behaves
    // exactly as before.
    return tokens
      .slice(j)
      .map((x) => x.t)
      .join(' ');
  }
  return null;
}

/** The command following a `find` `-exec`: a line of its own. */
function execPayload(tokens, index) {
  for (let j = index; j < tokens.length; j += 1) {
    if (tokens[j].t === '-exec' || tokens[j].t === '-execdir') {
      return tokens
        .slice(j + 1)
        .map((x) => x.t)
        .filter((x) => x !== ';' && x !== '\\;' && x !== '+')
        .join(' ');
    }
  }
  return null;
}

// --- path ---------------------------------------------------------------------

/** `/c/dev/x` is the path Git Bash produces and Windows `resolve` gets wrong. */
function normalizeMsys(path) {
  const match = /^\/([A-Za-z])(\/.*)?$/.exec(path);
  return match ? `${match[1]}:${match[2] || '/'}` : path;
}

/** The environment variables the hook **knows** expand before judgement:
 * `%APPDATA%\x`, `$APPDATA/x`, `${APPDATA}/x`, `$env:APPDATA\x`. Without this step the
 * same target has two outcomes depending on how it is written.
 *
 * Only those present in `process.env`: a shell variable (`$DIR`, `%MINE%`) the
 * hook cannot know stays as it is and falls under the declared limit in "Shapes
 * this guard does NOT cover" — allowed, and not coverage. Order matters:
 * PowerShell's `$env:NAME` is tried before `$NAME`, or `:NAME` would dangle. */
function expandVars(path) {
  const value = (name) => process.env[name] ?? process.env[name.toUpperCase()];
  return String(path)
    .replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (whole, name) => value(name) ?? whole)
    .replace(/\$env:([A-Za-z_][A-Za-z0-9_]*)/gi, (whole, name) => value(name) ?? whole)
    .replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (whole, name) => value(name) ?? whole)
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (whole, name) => value(name) ?? whole);
}

function resolveTarget(target, base) {
  const cleaned = normalizeMsys(expandVars(target));
  if (isAbsolute(cleaned) || /^[A-Za-z]:/.test(cleaned)) return resolve(cleaned);
  if (!base) return null; // unknown base: no verdict invented
  return resolve(base, cleaned);
}

/** The pool worktree `absolute` falls into, or `null` when it falls outside.
 *
 * The pool is what the project declared in `{worktree.pool}`, and its worktrees
 * are its top-level directories. Reasoning is by **path prefix**, not by
 * climbing to find a `.git`: the perimeter must match what the JSON
 * declares, and a worktree outside the pool belongs to somebody else — Daiku did not
 * create it and does not know what is inside.
 */
function poolWorktree(absolute, ctx) {
  if (!ctx || !ctx.pool || !isInside(absolute, ctx.pool)) return null;
  const pool = resolve(ctx.pool).replace(/\\/g, '/').replace(/\/+$/, '');
  const full = resolve(absolute).replace(/\\/g, '/');
  const rest = full.slice(pool.length).replace(/^\/+/, '');
  const first = rest.split('/')[0];
  return first ? `${pool}/${first}` : pool;
}

/** Is any path component a link (symlink or Windows junction)? */
function crossesLink(absolute, env) {
  const pieces = absolute.split(/[\\/]/);
  let current = pieces[0] + '/';
  for (const piece of pieces.slice(1)) {
    if (!piece) continue;
    current = join(current, piece);
    const link = env.isLink(current);
    if (link === null) return null; // does not exist yet: nothing to protect
    if (link) return current;
  }
  return null;
}

/** The paths a destructive command aims at, as raw strings.
 *
 * Each target carries whether the naming command is the link **detach**
 * (`rd /s`, which does not recurse into the junction) or a recursing removal. In
 * PowerShell `rmdir`, `del`, `ri` and `erase` are `Remove-Item` aliases: without
 * them the same deletion slips past simply by being rewritten. The cmd `rmdir /s` shape is the
 * detach instead, which is why the presence of `/s` is checked.
 *
 * The command must be at the segment **head** (neutral prefixes skipped): that way
 * `npm rm <package>` and `pnpm remove` are not mistaken for a path removal,
 * the false positive this shape avoids.
 */
function targets(tokens) {
  const first = head(tokens);
  if (!first) return [];
  const name = first.name.replace(/\.exe$/i, '').toLowerCase();
  const rest = tokens.slice(first.index + 1);
  const collect = (args, detach) =>
    args
      .filter((x) => !isFlag(x))
      .map((x) => ({ target: x.t.replace(/;$/, ''), detach }))
      .filter((x) => x.target);

  if (name === 'rd' || name === 'rmdir') {
    // `rd`/`rmdir` with `/s` is the cmd shape: detaches the link without recursing into it.
    const detach = rest.some((x) => !x.q && /^\/s$/i.test(x.t));
    return collect(rest, detach);
  }
  if (name === 'rm' || /^(?:remove-item|erase|del|ri)$/i.test(name)) {
    return collect(rest, false);
  }
  if (GIT.test(first.name)) {
    let j = first.index + 1;
    while (j < tokens.length && !tokens[j].q && tokens[j].t.startsWith('-')) {
      if (tokens[j].t === '-C' || tokens[j].t === '-c') j += 1;
      j += 1;
    }
    if (tokens[j] && tokens[j].t === 'worktree' && tokens[j + 1] && tokens[j + 1].t === 'remove') {
      return collect(tokens.slice(j + 2), false);
    }
  }
  return [];
}

/** `pnpm install` and its equivalents: all rewrite `virtualStoreDir`. */
function isPnpmInstall(tokens) {
  const first = head(tokens);
  if (!first || first.name.replace(/\.(?:exe|cmd)$/i, '').toLowerCase() !== 'pnpm') return false;
  const sub = tokens.slice(first.index + 1).find((x) => !isFlag(x));
  return !!sub && /^(?:install|i|add|update|up|dedupe)$/i.test(sub.t);
}

/** A `cd` changing the base relative paths of the rest of the line resolve from. */
function dirChange(tokens) {
  const first = head(tokens);
  if (!first) return null;
  if (!/^(?:cd|chdir|set-location|sl|pushd)$/i.test(first.name)) return null;
  const args = tokens.slice(first.index + 1).filter((x) => !isFlag(x));
  if (!args.length) return { unknown: true }; // bare `cd`: home, which is not guessed
  // Expanded before testing: when the variable is in the hook's environment the `cd`
  // resolves and the base stays known; when it is not, the marker survives and the
  // earlier verdict holds — unknown base, relative targets not judged.
  const dir = expandVars(args[0].t);
  if (dir === '-' || /[$%`]/.test(dir)) return { unknown: true }; // unknown variable: unresolvable
  return { dir };
}

// --- path guard ---------------------------------------------------------

function pathGuard(line, cwd, env, ctx, depth = 0) {
  let base = cwd;
  for (const segment of splitSegments(line)) {
    const tokens = tokenize(segment);
    if (!tokens.length) continue;
    const first = head(tokens);
    if (!first) continue;

    // A wrapper carries a whole line inside the quotes: it is judged as one,
    // with the current base, instead of passing because it is an argument.
    if (WRAPPER.test(first.name) && depth < 3) {
      const payload = wrapperPayload(tokens, first.index);
      if (payload) {
        const outcome = pathGuard(payload, base, env, ctx, depth + 1);
        if (outcome) return outcome;
      }
      continue;
    }
    const executed = execPayload(tokens, first.index);
    if (executed && depth < 3) {
      const outcome = pathGuard(executed, base, env, ctx, depth + 1);
      if (outcome) return outcome;
    }

    const change = dirChange(tokens);
    if (change) {
      base = change.unknown ? null : resolveTarget(change.dir, base);
      continue;
    }

    for (const { target, detach } of targets(tokens)) {
      const absolute = resolveTarget(target, base);
      if (!absolute) continue; // relative target with unknown base: see § Uncovered shapes
      // The disk is the only thing this guard asks of the world, and also the only
      // one that may not answer. When it does not answer it is unknown whether a link is
      // there — but the pool branch, which reads only paths and parameters, must still decide:
      // that is why the exception stops here instead of switching off the whole evaluation.
      let link = null;
      try {
        link = crossesLink(absolute, env);
      } catch {
        link = null;
      }
      // Detaching the link, when the link **is** the target, is the remedy this
      // same guard prescribes: denying it would leave whoever unmounts a worktree without step 1.
      if (detach && link && resolve(link) === resolve(absolute)) continue;
      if (link) {
        return {
          reason:
            `\`${target}\` crosses a Windows link (\`${link}\`): a recursive removal ` +
            `enters the junction and empties the real directory on the other side, not the ` +
            `link. Detach the link first with \`rd\` (on the link alone), then remove what remains.`,
        };
      }
      const worktree = poolWorktree(absolute, ctx);
      if (worktree) {
        return {
          reason:
            `\`${target}\` sits in worktree \`${worktree}\` of the pool this project ` +
            `declares in \`{worktree.pool}\`. Before removing it: list **all** junctions ` +
            `(\`Get-ChildItem -Recurse -Force -Attributes ReparsePoint\`), detach them with \`rd\` on the ` +
            `link alone, and save uncommitted files — \`git worktree remove --force\` ` +
            `deletes them without recovery.`,
        };
      }
    }

    if (isPnpmInstall(tokens) && base) {
      const worktree = poolWorktree(resolve(base), ctx);
      if (worktree) {
        return {
          reason:
            `\`pnpm install\` inside worktree \`${worktree}\` of the pool: it rewrites ` +
            `\`virtualStoreDir\` in the shared \`node_modules\`, and back at the root pnpm ` +
            `treats the installation as inconsistent and asks to recreate it from scratch. Install from the ` +
            `technical root, not from here.`,
        };
      }
    }
  }
  return null;
}

// --- git guard -----------------------------------------------------------
//
// Four branches behind the project gate, and a single switch in the whole file.
// The gate stays: without `.daiku/project.json` this project has not opened Daiku, and the
// guard does not even read the line. Behind the gate, push, `--no-verify` and `.daiku/`
// commits are denied **always** — an agent is never left any of these
// freedoms, and never trusting an LLM is the rule saying so (see `CLAUDE.md`). The only
// thing the project declares is the worktree pool.
//
// The reason for reading the line instead of relying on a host rule is that a
// rule matches by **prefix** and does not enter `sh -c`, so it sees neither a
// flag moved to the tail nor a wrapper.

/** The `git` invocations in the line, each as `[subcommand, …args]` tokens.
 *
 * `git` is recognised at the segment **head** (neutral prefixes skipped) or inside
 * a known wrapper's payload, never in an arbitrary position: that way
 * `echo "git push"` and `grep -rn "git push" .claude/` stay allowed, while a
 * real Git invocation may have quotes around the executable or sit in the payload
 * of a known wrapper.
 *
 * Global options are skipped, including `-C` and `-c` taking a separate value.
 */
function gitInvocations(line, depth = 0) {
  const found = [];
  for (const segment of splitSegments(line)) {
    const tokens = tokenize(segment);
    const first = head(tokens);
    if (!first) continue;
    if (WRAPPER.test(first.name) && depth < 3) {
      const payload = wrapperPayload(tokens, first.index);
      if (payload) found.push(...gitInvocations(payload, depth + 1));
      continue;
    }
    if (!GIT.test(first.name)) continue;
    let j = first.index + 1;
    while (j < tokens.length && !tokens[j].q && tokens[j].t.startsWith('-')) {
      if (tokens[j].t === '-C' || tokens[j].t === '-c') j += 1;
      j += 1;
    }
    if (j < tokens.length) found.push(tokens.slice(j));
  }
  return found;
}

/** `git commit` with `-n`/`--no-verify`, wherever the flag stands.
 *
 * A **quoted** `-n` is not the flag: it sits inside the commit message. That is the only
 * reason tokens remember having been quoted.
 */
function commitGuard(line) {
  for (const invocation of gitInvocations(line)) {
    if (!invocation.length || invocation[0].t !== 'commit') continue;
    const args = invocation.slice(1);
    if (args.some((x) => !x.q && (x.t === '--no-verify' || /^-[a-z]*n/i.test(x.t)))) {
      return {
        reason:
          '`git commit` with `-n`/`--no-verify` is not allowed: use a normal commit ' +
          'and let the hooks run. If a commit hook is broken, fix that one ' +
          '— skipping it leaves the defect in history.',
      };
    }
  }
  return null;
}

/** `git push`, which stays a manual gesture of the owner. */
function pushGuard(line) {
  for (const invocation of gitInvocations(line)) {
    if (!invocation.length || invocation[0].t !== 'push') continue;
    const args = invocation.slice(1);
    // `--dry-run` (and its `-n`) pushes nothing: denying it would be a false positive.
    if (args.some((x) => !x.q && (x.t === '--dry-run' || /^-[a-zA-Z]*n/.test(x.t)))) continue;
    return {
      reason:
        '`git push` is not allowed: pushing stays a manual gesture ' +
        'of the owner. If the work is ready, stop and say so: whoever holds the ' +
        'credentials launches it.',
    };
  }
  return null;
}

/** A pathspec naming `.daiku/`, in whatever shape the shell writes it.
 *
 * Comparison is on the token text, not the disk: whoever explicitly names
 * `.daiku/` in an `add` or a `commit` is making the forbidden gesture, in whatever
 * directory they do it. Quotes do not change a pathspec's meaning —
 * `"..."` around a path stays that path — so quoted tokens
 * are watched too. Only a whole segment counts: `.daiku.md` or `x.daiku/y` are not
 * `.daiku/`, and stay allowed.
 */
function isDaikuPath(text) {
  const normalised = String(text).replace(/\\/g, '/').replace(/^\.\//, '');
  return /(^|\/)\.daiku(\/|$)/.test(normalised);
}

/** The `git commit` options eating the token after them: that token is a
 * value (a message, an author, a date), not a pathspec. The compact shape
 * (`-am`, `-sm`) counts like the loose one: the `m` inside a short-flag group still
 * wants its message after it. */
const VALUE_OPTIONS = new Set([
  '-m',
  '--message',
  '--author',
  '--date',
  '--cleanup',
  '--untracked-files',
  '--template',
  '--fixup',
  '--squash',
]);

function takesValue(piece) {
  if (piece.q) return false;
  if (VALUE_OPTIONS.has(piece.t)) return true;
  return /^-[a-z]*m[a-z]*$/i.test(piece.t);
}

/** A `git status --porcelain` line with something staged (first column):
 * what a bare `git commit` would freeze. `??` and `!!` are not staged. */
function isStaged(line) {
  const x = line[0];
  return !!x && x !== ' ' && x !== '?' && x !== '!';
}

/** A line with a tracked change, staged or in the tree: what
 * `git commit -a` would carry inside. */
function isTracked(line) {
  return isStaged(line) || (line.length > 1 && line[1] !== ' ' && line[1] !== '?' && line[1] !== '!');
}

/** `git add` and `git commit` touching `.daiku/`, with no switch.
 *
 * Two layers, so the ban holds in any case while reading no more than
 * necessary:
 *
 *  1. **the explicit pathspec** — `add` or `commit` naming `.daiku/` — is denied
 *     on the line text, without touching the disk;
 *  2. **the stage** — a bare `commit` freezes the whole index, and `commit -a` widens
 *     the stage to the tracked tree — is read with a read-only `git status`
 *     confined to `.daiku/`. When git does not answer, it degrades to allowed: the fail-open
 *     contract, proved by the bench.
 *
 * A `commit` limited by pathspec to paths outside `.daiku/` does not freeze what
 * stays in the stage, and stays allowed: the shape skills use to deliver the other
 * groups while leaving `.daiku/` where it is.
 */
function daikuGuard(line, cwd, env, depth = 0) {
  let base = cwd;
  for (const segment of splitSegments(line)) {
    const tokens = tokenize(segment);
    if (!tokens.length) continue;
    const first = head(tokens);
    if (!first) continue;

    if (WRAPPER.test(first.name) && depth < 3) {
      const payload = wrapperPayload(tokens, first.index);
      if (payload) {
        const outcome = daikuGuard(payload, base, env, depth + 1);
        if (outcome) return outcome;
      }
      continue;
    }
    const executed = execPayload(tokens, first.index);
    if (executed && depth < 3) {
      const outcome = daikuGuard(executed, base, env, depth + 1);
      if (outcome) return outcome;
    }

    const change = dirChange(tokens);
    if (change) {
      base = change.unknown ? null : resolveTarget(change.dir, base);
      continue;
    }

    const outcome = judgeDaikuSegment(tokens, base, env);
    if (outcome) return outcome;
  }
  return null;
}

function judgeDaikuSegment(tokens, base, env) {
  const first = head(tokens);
  if (!first || !GIT.test(first.name)) return null;

  // Global options are skipped the way `gitInvocations` does, but `-C` is remembered:
  // the directory where the stage is read.
  let j = first.index + 1;
  let cDir = null;
  while (j < tokens.length && !tokens[j].q && tokens[j].t.startsWith('-')) {
    if ((tokens[j].t === '-C' || tokens[j].t === '-c') && j + 1 < tokens.length) {
      if (tokens[j].t === '-C') cDir = tokens[j + 1].t;
      j += 2;
      continue;
    }
    j += 1;
  }
  if (j >= tokens.length) return null;
  const subcommand = tokens[j].t;
  if (subcommand !== 'add' && subcommand !== 'commit') return null;

  let all = false; // `commit` `-a`/`--all`
  const targetList = [];
  let skipNext = false;
  let afterSep = false;
  for (const x of tokens.slice(j + 1)) {
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (!afterSep && !x.q && x.t === '--') {
      afterSep = true;
      continue;
    }
    if (!afterSep && !x.q && x.t.startsWith('-')) {
      if (subcommand === 'commit' && takesValue(x)) skipNext = true;
      if (subcommand === 'commit' && (x.t === '-a' || x.t === '--all')) all = true;
      continue;
    }
    targetList.push(x.t);
  }

  if (targetList.some(isDaikuPath)) {
    return {
      reason:
        'this command names `.daiku/`: nothing of Daiku enters a commit, in ' +
        'any case — the repository belongs to the client and sees nothing of the method. ' +
        'Drop that path from the command. See `skills/commit/SKILL.md`, "Daiku is never committed".',
    };
  }

  // An `add` without an explicit pathspec is decided at commit time, not here.
  if (subcommand === 'add') return null;
  // A `commit` limited to other paths does not freeze the remaining stage.
  if (targetList.length) return null;

  const gitDir = cDir ? (base ? resolveTarget(cDir, base) : null) : base;
  if (!gitDir) return null; // unknown base: see § Uncovered shapes
  // The exception stays inside this branch: when git does not answer, this branch allows
  // and the others decide — the `evaluate` contract, proved by the bench.
  let lines;
  try {
    lines = env.daikuStatus(gitDir);
  } catch {
    return null; // git unreachable: fail-open
  }
  if (!lines) return null; // git unreachable: fail-open
  const touches = all ? lines.some(isTracked) : lines.some(isStaged);
  if (!touches) return null;
  return {
    reason: all
      ? '`git commit -a` widens the stage to the whole tracked tree, and under `.daiku/` ' +
        'there is a change: nothing of Daiku enters a commit, in any case. ' +
        'Take `.daiku/` off the stage (`git restore --staged -- .daiku/`) or commit ' +
        'only files outside `.daiku/` by pathspec.'
      : 'the stage holds changes under `.daiku/`, and a bare `git commit` would ' +
        'freeze them: nothing of Daiku enters a commit, in any case. Take them ' +
        'off the stage (`git restore --staged -- .daiku/`) or commit ' +
        'only files outside `.daiku/` by pathspec.',
  };
}

// --- environment ---------------------------------------------------------------
//
// Everything the guard knows about the world passes through here, so the test bench can
// swap in a simulated filesystem and run without touching anything.

const REAL_ENV = {
  isLink: (path) => {
    try {
      // A Windows junction is not a symlink to the POSIX API, yet `lstat` still marks
      // it as a symbolic link: the only way to see it without crossing it.
      return lstatSync(path).isSymbolicLink();
    } catch {
      return null; // does not exist
    }
  },
  /** The `git status --porcelain` lines confined to `.daiku/`, from the given
   * directory. Read-only: `[]` is clean, `null` is unreachable git — and `null`
   * degrades to allowed, by the fail-open contract. */
  daikuStatus: (dir) => {
    try {
      const outcome = spawnSync('git', ['status', '--porcelain', '--', '.daiku'], {
        cwd: dir,
        encoding: 'utf-8',
        timeout: 10000,
      });
      if (outcome.error || outcome.status !== 0 || typeof outcome.stdout !== 'string') return null;
      return outcome.stdout
        .split('\n')
        .map((l) => l.trimEnd())
        .filter((l) => l);
    } catch {
      return null;
    }
  },
};

/** The decision, without leaving the process: what the test bench calls.
 *
 * The disk is questioned by two branches — the link one and the `.daiku/`
 * stage one — and their exception stays inside them: the others decide on paths
 * and parameters, so they hold even with an unreachable filesystem. Proved by the
 * bench, not declared here.
 */
function evaluate(line, cwd, env, ctx) {
  // The gate, before everything else: without `.daiku/project.json` this project has not
  // opened Daiku, and the guard has nothing to watch. The line is not even read.
  if (!ctx || !ctx.present) return null;
  return (
    pathGuard(line, cwd, env, ctx) ||
    daikuGuard(line, cwd, env) ||
    commitGuard(line) ||
    pushGuard(line)
  );
}

/** The same decision, wearing the **fail-open** contract: any exception
 * becomes an allowance. It is the only shape `main` uses, and it is verifiable by the
 * test bench — because "silently allows" and "protects" can only be told apart
 * by trying. */
function safeDecide(line, cwd, env, ctx) {
  try {
    return evaluate(line, cwd, env, ctx);
  } catch {
    return null;
  }
}

// --- test bench -----------------------------------------------------------

/** A simulated filesystem: the project's technical root, and next to it a worktree pool
 * where `node_modules` and the venv are junctions — the layout this guard watches
 * when a project declares `{worktree.pool}`. */
function fakeEnv() {
  const key = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const tree = new Map(
    Object.entries({
      'c:/dev/project/.git': { type: 'dir' },
      'c:/dev/project/node_modules': { type: 'dir' },
      'c:/dev/project/backend': { type: 'dir' },
      'c:/dev/project/backend/.venv': { type: 'dir' },
      'c:/dev/project/docs': { type: 'dir' },
      // The pool sits outside the technical root, the real case: a worktree is not
      // nested inside the repository it was born from.
      'c:/dev/wt': { type: 'dir' },
      'c:/dev/wt/wt-1': { type: 'dir' },
      'c:/dev/wt/wt-1/.git': { type: 'file' },
      'c:/dev/wt/wt-1/node_modules': { type: 'link' },
      'c:/dev/wt/wt-1/backend': { type: 'dir' },
      'c:/dev/wt/wt-1/backend/.venv': { type: 'link' },
      'c:/dev/wt/wt-1/docs': { type: 'dir' },
      // Somebody else's worktree, outside the declared pool: the guard does not touch it.
      'c:/dev/elsewhere/.git': { type: 'file' },
      'c:/dev/elsewhere/docs': { type: 'dir' },
    })
  );
  // A node's ancestors exist as plain directories: `crossesLink`
  // walks the path component by component, and without them it would stop at the first
  // unknown piece — i.e. allow, and the bench would prove the wrong thing.
  const ancestors = new Set();
  for (const path of tree.keys()) {
    const pieces = path.split('/');
    for (let i = 1; i < pieces.length; i += 1) ancestors.add(pieces.slice(0, i).join('/'));
  }
  const entry = (p) => tree.get(key(p)) || (ancestors.has(key(p)) ? { type: 'dir' } : undefined);
  return {
    isLink: (p) => (entry(p) ? entry(p).type === 'link' : null),
    // By default the `.daiku/` stage is clean: cases proving a dirty stage
    // pass their own seventh element and the loop grafts it below.
    daikuStatus: () => [],
  };
}

const ROOT_CWD = 'C:/dev/project';
const WT_CWD = 'C:/dev/wt/wt-1';

/** A project that opened Daiku and declares the pool: everything left to switch on. */
const CTX_FULL = fakeContext({ pool: 'C:/dev/wt' });

/** A project that opened Daiku and declared neither pool nor guardrails. */
const CTX_BARE = fakeContext({});

/** A repository Daiku never opened: the guard does not exist here. */
const CTX_ABSENT = fakeContext({ present: false });

/** Command lines with the expected decision. `contains` is a piece of the reason.
 *
 * Three things are tested together, and the list is ordered so: that **the gate holds** —
 * a project that has not opened Daiku receives no denial — that **each switch lights only
 * its own branch**, and that the known shapes of each move are recognised. The legitimate
 * moves that must stay allowed are half the list, and that is the half that counts: a guard
 * denying everything would pass the other half.
 */
const CASES = [
  // --- the gate: without `.daiku/project.json` nothing is denied ----------------
  ['project without Daiku: push passes', 'git push', ROOT_CWD, 'allow', '', CTX_ABSENT],
  ['project without Daiku: the junction is not its business', 'rm -rf c:/dev/wt/wt-1/node_modules', ROOT_CWD, 'allow', '', CTX_ABSENT],
  ['project without Daiku: not even --no-verify', 'git commit -n -m wip', ROOT_CWD, 'allow', '', CTX_ABSENT],
  ['project without Daiku: not even .daiku/', 'git add .daiku/project.json', ROOT_CWD, 'allow', '', CTX_ABSENT],

  // --- the only switch left is the pool: push, --no-verify and .daiku/ always deny,
  // with no key, and the cases below prove it with switches off -----
  ['undeclared push is still denied', 'git push', ROOT_CWD, 'deny', 'manual gesture', CTX_BARE],
  ['undeclared --no-verify is still denied', 'git commit --no-verify -m wip', ROOT_CWD, 'deny', 'is not allowed', CTX_BARE],
  ['explicitly switched-off keys switch nothing off', 'git push', ROOT_CWD, 'deny', 'manual gesture', fakeContext({ guardrails: { deny_push: false, deny_no_verify: false } })],
  ['no pool declared: someone else\'s worktree is left alone', 'rm -rf c:/dev/wt/wt-1/docs', ROOT_CWD, 'allow', '', CTX_BARE],
  ['no pool declared: not even pnpm install', 'pnpm install', WT_CWD, 'allow', '', CTX_BARE],
  ['the link stays protected all the same: a system fact, not a policy', 'rm -rf c:/dev/wt/wt-1/node_modules', ROOT_CWD, 'deny', 'crosses a Windows link', CTX_BARE],
  ['.daiku/ denies with no switches all the same: it has none', 'git add .daiku/project.json', ROOT_CWD, 'deny', '.daiku/', CTX_BARE],
  ['a worktree outside the declared pool is not watched', 'rm -rf c:/dev/elsewhere/docs', ROOT_CWD, 'allow', '', CTX_FULL],

  // --- the cd that moves the base on the same line ------------------------------------
  ['cd on the same line, then rm on a junction', 'cd /c/dev/wt/wt-1 && rm -rf node_modules', ROOT_CWD, 'deny', 'crosses a Windows link'],
  ['cd on the same line, then pnpm install in the worktree', 'cd /c/dev/wt/wt-1 && pnpm install', ROOT_CWD, 'deny', 'virtualStoreDir'],
  ['cd via Set-Location, then Remove-Item on the junction', 'Set-Location C:/dev/wt/wt-1; Remove-Item -Recurse -Force node_modules', ROOT_CWD, 'deny', 'crosses a Windows link'],
  ['relative cd descending into the pool', 'cd ../wt/wt-1 && rm -rf backend/.venv', ROOT_CWD, 'deny', 'crosses a Windows link'],
  ['bash -c wrapper with cd inside the quotes', 'bash -c "cd /c/dev/wt/wt-1 && rm -rf node_modules"', ROOT_CWD, 'deny', 'crosses a Windows link'],
  ['cd to a variable: unknown base, no invented verdict', 'cd $OTHER && rm -rf node_modules', ROOT_CWD, 'allow', ''],
  ['the cd back restores the base to the root', 'cd /c/dev/wt/wt-1; cd /c/dev/project; rm -rf node_modules', ROOT_CWD, 'allow', ''],
  ['find -exec rm on the junction', 'find /c/dev/wt/wt-1 -name x -exec rm -rf /c/dev/wt/wt-1/node_modules ;', ROOT_CWD, 'deny', 'crosses a Windows link'],
  ['pnpm i is pnpm install', 'cd /c/dev/wt/wt-1 && pnpm i', ROOT_CWD, 'deny', 'virtualStoreDir'],

  // --- junctions and the pool, shape by shape --------------------------------
  ['rm -rf on the junction, absolute path', 'rm -rf /c/dev/wt/wt-1/node_modules', ROOT_CWD, 'deny', 'crosses a Windows link'],
  ['rm -rf on the junction, Windows path', 'rm -rf "C:\\dev\\wt\\wt-1\\node_modules"', ROOT_CWD, 'deny', 'crosses a Windows link'],
  ['rm -rf inside the junction', 'rm -rf c:/dev/wt/wt-1/node_modules/.pnpm', ROOT_CWD, 'deny', 'crosses a Windows link'],
  ['Remove-Item with alias ri', 'ri -Recurse -Force c:/dev/wt/wt-1/node_modules', ROOT_CWD, 'deny', 'crosses a Windows link'],
  ['Remove-Item with alias del', 'del c:/dev/wt/wt-1/backend/.venv', ROOT_CWD, 'deny', 'crosses a Windows link'],
  ['git worktree remove on a pooled worktree', 'git worktree remove c:/dev/wt/wt-1', ROOT_CWD, 'deny', 'of the pool'],
  ['rm inside the worktree but outside the junctions', 'rm -rf c:/dev/wt/wt-1/docs', ROOT_CWD, 'deny', 'of the pool'],
  ['rd /s on the link is the detach this guard itself prescribes', 'rd /s /q c:\\dev\\wt\\wt-1\\node_modules', ROOT_CWD, 'allow', ''],
  ['rd /s inside the junction is not a detach', 'rd /s /q c:\\dev\\wt\\wt-1\\node_modules\\.pnpm', ROOT_CWD, 'deny', 'crosses a Windows link'],
  ['rm in the technical root, which is the real repo', 'rm -rf c:/dev/project/node_modules', ROOT_CWD, 'allow', ''],
  ['rm of a path that does not exist', 'rm -rf c:/dev/project/missing-build', ROOT_CWD, 'allow', ''],
  ['pnpm install in the technical root', 'pnpm install', ROOT_CWD, 'allow', ''],
  ['pnpm install in the worktree, session cwd', 'pnpm install', WT_CWD, 'deny', 'virtualStoreDir'],
  ['npm rm <package> is not a path removal', 'npm rm left-pad', WT_CWD, 'allow', ''],
  ['pnpm remove <package> is not a path removal', 'pnpm remove left-pad', WT_CWD, 'allow', ''],

  // --- the commit branch: the shapes a prefix rule cannot see ---------
  ['git commit --no-verify', 'git commit --no-verify -m "wip"', ROOT_CWD, 'deny', 'is not allowed'],
  ['git commit -n at the end', 'git commit -m "wip" -n', ROOT_CWD, 'deny', 'is not allowed'],
  ['git commit -n inside a wrapper', 'bash -lc "git commit -n -m wip"', ROOT_CWD, 'deny', 'is not allowed'],
  ['git commit with -n inside the message is not the flag', 'git commit -m "fix -n of the parser"', ROOT_CWD, 'allow', ''],
  ['normal git commit', 'git commit -m "feat: something"', ROOT_CWD, 'allow', ''],

  // --- the .daiku/ branch: no commit contains `.daiku/`, in any case ----
  ['git add with .daiku/ pathspec', 'git add .daiku/policies/area.md', ROOT_CWD, 'deny', '.daiku/'],
  ['mixed git add, code + .daiku/', 'git add apps/x.py .daiku/project.json', ROOT_CWD, 'deny', '.daiku/'],
  ['git add .daiku/ inside a wrapper', 'bash -c "git add .daiku/project.json"', ROOT_CWD, 'deny', '.daiku/'],
  ['git commit with .daiku/ pathspec after --', 'git commit -m "x" -- .daiku/domain/commit-convention.md', ROOT_CWD, 'deny', '.daiku/'],
  ['cd + commit with .daiku/ pathspec', 'cd /c/dev/project && git commit -- .daiku/project.json', ROOT_CWD, 'deny', '.daiku/'],
  ['a message naming .daiku/ is not a pathspec', 'git commit -m "fix .daiku loader"', ROOT_CWD, 'allow', ''],
  ['bare git commit with .daiku/ staged', 'git commit -m "feat: x"', ROOT_CWD, 'deny', 'stage', CTX_FULL, ['M  .daiku/project.json']],
  ['git commit -a with .daiku/ modified', 'git commit -a -m "x"', ROOT_CWD, 'deny', '.daiku/', CTX_FULL, [' M .daiku/policies/area.md']],
  ['clean git commit -a', 'git commit -a -m "x"', ROOT_CWD, 'allow', '', CTX_FULL, []],
  ['commit limited to other paths with .daiku/ staged', 'git commit -- docs/x.md', ROOT_CWD, 'allow', '', CTX_FULL, ['M  .daiku/project.json']],
  ['git add -A passes here: the commit decides', 'git add -A', ROOT_CWD, 'allow', ''],
  ['clean bare git commit', 'git commit -m "docs: x"', ROOT_CWD, 'allow', ''],

  // --- push: denied where declared, and the shapes that stay allowed -----
  ['bare git push', 'git push', ROOT_CWD, 'deny', 'manual gesture'],
  ['git -C with another tree', 'git -C c:/dev/wt/wt-1 push origin main', ROOT_CWD, 'deny', 'manual gesture'],
  ['powershell -Command "git push"', 'powershell -NoProfile -Command "git push"', ROOT_CWD, 'deny', 'manual gesture'],
  ['bash -lc "git push"', 'bash -lc "git push --force"', ROOT_CWD, 'deny', 'manual gesture'],
  ['cmd /c "git push"', 'cmd /c "git push"', ROOT_CWD, 'deny', 'manual gesture'],
  ['git.exe with quoted path and spaces', '"C:\\Program Files\\Git\\cmd\\git.exe" push', ROOT_CWD, 'deny', 'manual gesture'],
  ['sudo in front of git push', 'sudo git push', ROOT_CWD, 'deny', 'manual gesture'],
  ['git push chained after another command', 'npm test && git push', ROOT_CWD, 'deny', 'manual gesture'],
  ['git push --dry-run pushes nothing', 'git push --dry-run', ROOT_CWD, 'allow', ''],
  ['git fetch is not a push', 'git fetch origin main', ROOT_CWD, 'allow', ''],
  ['echo of a sentence talking about git push', 'echo "git push is forbidden"', ROOT_CWD, 'allow', ''],
  ['grep for git push in the corpus', 'grep -rn "git push" .daiku/', ROOT_CWD, 'allow', ''],

  // --- what is not this guard's business --------------------------------
  // They stay here as explicit proof: readers must see that the read perimeter,
  // the enforcement surface and the Git gestures towards HEAD belong to the host
  // policy, not that they were forgotten here.
  ['the read perimeter belongs to the host policy', 'cat C:\\Windows\\System32\\drivers\\etc\\hosts', ROOT_CWD, 'allow', ''],
  ['the hook surface belongs to system ACLs', 'echo x > .codex/hooks/command-guard.mjs', ROOT_CWD, 'allow', ''],
  ['git clean is not its business', 'git clean -fd', ROOT_CWD, 'allow', ''],
  ['git reset --hard is not its business', 'git reset --hard HEAD', ROOT_CWD, 'allow', ''],

  // --- malformed lines: they must never throw ---------------------------
  ['empty line', '   ', ROOT_CWD, 'allow', ''],
  ['unterminated quote: the target still reads the same', 'rm -rf "c:/dev/wt/wt-1', ROOT_CWD, 'deny', 'of the pool'],
  ['separators only', '&& || ; | &', ROOT_CWD, 'allow', ''],
  ['bare parens and braces', '( { rm } )', ROOT_CWD, 'allow', ''],
  ['wrapper without payload', 'bash -c', ROOT_CWD, 'allow', ''],
  ['missing cwd', 'rm -rf node_modules', null, 'allow', ''],
  ['any other command', 'git status --short', ROOT_CWD, 'allow', ''],
  ['a read of the corpus', 'cat .daiku/project.json', ROOT_CWD, 'allow', ''],
];

function selfCheck() {
  const env = fakeEnv();
  const failed = [];
  let ran = 0;

  for (const [name, line, cwd, expected, contains, ctx, state] of CASES) {
    ran += 1;
    let outcome;
    try {
      const caseEnv = state === undefined ? env : { ...env, daikuStatus: () => state };
      outcome = evaluate(line, cwd, caseEnv, ctx || CTX_FULL);
    } catch (error) {
      failed.push(`${name}: exception ${error && error.message}`);
      continue;
    }
    const decision = outcome ? 'deny' : 'allow';
    if (decision !== expected) {
      failed.push(`${name}: expected ${expected}, got ${decision}${outcome ? ` (${outcome.reason.slice(0, 120)})` : ''}`);
      continue;
    }
    if (expected === 'deny' && contains && !outcome.reason.includes(contains)) {
      failed.push(`${name}: deny, but reason does not contain "${contains}"`);
    }
  }

  // The fail-open contract, proved instead of declared: faced with an environment that
  // throws on every question, the decision must be a permission, not an exception.
  const broken = {
    isLink: () => {
      throw new Error('filesystem unreachable');
    },
    daikuStatus: () => {
      throw new Error('git unreachable');
    },
  };
  // The link and `.daiku/`-stage branches are the ones interrogating disk and git: without
  // those, they allow. The others decide on paths and parameters, which need no disk
  // to read, and stay denied — including the `.daiku/` pathspec, which asks nothing
  // of anyone.
  const brokenEnv = [
    ['rm -rf c:/dev/wt/wt-1/node_modules', ROOT_CWD, 'deny'],
    ['rm -rf c:/dev/project/node_modules', ROOT_CWD, 'allow'],
    ['pnpm install', WT_CWD, 'deny'],
    ['git push', ROOT_CWD, 'deny'],
    ['git commit -n -m x', ROOT_CWD, 'deny'],
    ['git add .daiku/project.json', ROOT_CWD, 'deny'],
    ['git commit -m x', ROOT_CWD, 'allow'],
  ];
  for (const [line, cwd, expected] of brokenEnv) {
    ran += 1;
    let decision;
    try {
      decision = safeDecide(line, cwd, broken, CTX_FULL);
    } catch (error) {
      failed.push(`fail-open on \`${line}\`: threw ${error && error.message}`);
      continue;
    }
    const read = decision ? 'deny' : 'allow';
    if (read !== expected) failed.push(`broken environment on \`${line}\`: expected ${expected}, got ${read}`);
  }

  // The context is really read from a `project.json`, and the gate holds even when that
  // file is unreadable: that degradation matters most, because it is the one that
  // would turn the guard into a random denial.
  const readers = (file) => ({
    exists: (p) => Object.prototype.hasOwnProperty.call(file, String(p).replace(/\\/g, '/')),
    read: (p) => {
      const key = String(p).replace(/\\/g, '/');
      if (!Object.prototype.hasOwnProperty.call(file, key)) throw new Error('ENOENT');
      return file[key];
    },
  });
  const fromJson = [
    ['no file: context absent', {}, false],
    ['broken JSON: context absent', { 'C:/dev/project/.daiku/project.json': '{"contract": 2,}' }, false],
    ['valid JSON: context present', { 'C:/dev/project/.daiku/project.json': '{"contract": 2}' }, true],
  ];
  for (const [name, file, expected] of fromJson) {
    ran += 1;
    const read = loadContext('C:/dev/project', readers(file));
    if (read.present !== expected) failed.push(`${name}: expected present=${expected}`);
  }

  ran += 1;
  const withDeadKeys = loadContext('C:/dev/project', readers({
    'C:/dev/project/.daiku/project.json':
      '{"contract": 2, "worktree": {"pool": "../wt"}, "guardrails": {"deny_push": false, "deny_no_verify": false}}',
  }));
  if (!withDeadKeys.present || !isInside('C:/dev/wt/wt-1', withDeadKeys.pool)) {
    failed.push('a project.json with pool and legacy keys is not read as declared');
  }

  process.stdout.write(
    JSON.stringify({ checks: ran, passed: ran - failed.length, failed }, null, 2) + '\n'
  );
  return failed.length ? 1 : 0;
}

// --- Shapes this guard does NOT cover ---------------------------------------
//
// Declared on purpose: a guard silent about what it does not see makes readers believe it covers it,
// and file readers stop paying attention exactly where they should. Every entry below
// is the same family — a target unreadable in the line — and none
// is closed by patching this file: closing by effect instead of by text belongs to the
// sandbox, which does not exist on native Windows, and to the system policy.
//
//  - **A target built from a shell variable** (`rm -rf "$DIR"`,
//    `cd $OTHER && rm -rf node_modules`). The guard sees the text, not the value: after
//    an unresolvable `cd` the base becomes *unknown* and **relative** targets are not
//    judged at all — allowed, and not coverage. Same for the `.daiku/`
//    stage: without a base no `git status` runs.
//  - **A target arriving from a pipeline** (`Get-ChildItem x | Remove-Item -Recurse`,
//    `find … -print0 | xargs -0 rm -rf`): the line carries no path to read.
//  - **`powershell -EncodedCommand <base64>`** and every other obfuscated shape.
//  - **An already-written script** (`bash cleanup.sh`, `python cleanup.py`): the
//    destructive gesture lives in the file, not the line. `PreToolUse` sees only the line.
//  - **Other tools that delete**: `robocopy /MIR`, `git rm -r`. They are not
//    *equivalent* shapes of the gestures above: they are different gestures, and adding them is a
//    decision, not maintenance.
//  - **A heredoc body** counts as a command, on purpose: `bash <<'EOF'` really
//    runs it. Whoever writes a heredoc *quoting* `rm -rf` in a text may see
//    the write denied — a known false positive, and the remedy is a file-writing
//    tool instead of the shell.
//  - **Subagents launched outside this harness**, which this guard does not see at all.
//  - **Every project that has not opened Daiku**, and every branch its `project.json` does
//    not switch on. Not a technical limit but the wanted boundary: a package installed once
//    is active everywhere, and denying a command to whoever declared nothing would be
//    a fault wearing a protection's looks. Whoever wants coverage declares it. The
//    `.daiku/` branch is the exception proving the boundary: it has no switch, but it has
//    the gate — without `.daiku/project.json` it stays off too.
//  - **The owner's terminal**, where this hook does not run at all: there the ban on
//    `.daiku/` lives in the commit skill text, and no denial enforces it. When a
//    manual command stages `.daiku/`, an agent's bare `commit` after it
//    stays denied by the stage read here — a manual commit is not.

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) allow();
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    allow();
  }
  const input = (event && event.tool_input) || {};
  const cwd = (event && event.cwd) || ROOT;
  const line = input.command || '';
  if (!line.trim()) allow();
  // The root resolves from the event cwd when the host does not declare it: on Codex it is
  // the only handle, and a session opened in a subfolder must not lose its
  // own `.daiku/` — see `project-root.mjs`.
  const root = projectRoot({ cwd });
  const outcome = safeDecide(line, cwd, REAL_ENV, loadContext(root, REAL_READS));
  if (outcome) deny(outcome.reason);
  allow();
}

if (invokedDirectly(import.meta.url)) {
  if (process.argv.includes('--self-check')) {
    process.exit(selfCheck());
  }
  main().catch(() => process.exit(0));
}
