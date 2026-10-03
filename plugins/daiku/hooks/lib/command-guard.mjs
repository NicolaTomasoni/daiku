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
 *  - **two switches in the whole file**: the worktree pool, `{worktree.pool}`, and the project's
 *    channels, `channels.production`. Every other branch denies on every project that has opened
 *    Daiku, with no key — §6 of `contracts/project-contract.md`, *what the JSON does not declare
 *    does not exist*.
 *
 * There are six branches, in three families.
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
 *  2. **`git commit --no-verify`.** A prefix rule matches the start of the
 *     line, so `git commit -m "…" -n` walks past it: here the subcommand is
 *     really looked at, wherever the flag stands. Commit hooks must
 *     always run.
 *  3. **`git push`.** Same reason: a prefix rule does not enter `sh -c`,
 *     while here the push is recognised even inside a wrapper, behind a `sudo` or
 *     queued after another command. Push stays a manual gesture of the owner. `--dry-run`
 *     is not: it pushes nothing.
 *  4. **A commit crediting the agent.** A `Co-Authored-By` trailer naming Claude or
 *     Codex, or a `Generated with` line, in the message — `-m`, `--trailer`, a heredoc
 *     feeding `-F -`, or the file `-F` names. The history carries only whoever owns the work.
 *
 * **A project policy**, off until the JSON switches it on:
 *
 *  5. **The worktree pool** (`{worktree.pool}`). Inside a pool worktree a
 *     removal carries away uncommitted files without recovery, and `pnpm install` rewrites
 *     the shared `node_modules` `virtualStoreDir`, leaving the
 *     root installation inconsistent. No declared pool, neither check.
 *  6. **The channels** (`channels.production`). The work lives on the development branch and
 *     production advances only by a release: while the production branch is active, `git commit`
 *     and `git merge` are denied, and `git checkout`/`git switch` towards it are denied too — so
 *     one never arrives there to commit. The branch is read only on a line naming `git`, and only
 *     here: no declared production branch, no branch read and no check.
 *
 * Where the host has a system `deny`, that stays the real door for 2 and 3: absolute, and
 * no source below can remove it. The two branches here close the shapes prefix
 * matching does not see, and that is why they live here and not there. Branch 4 has no
 * host rule at all: a permission rule matches the command, never the message inside it.
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
import { lstatSync, readFileSync } from 'node:fs';
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
  'nice',
  'timeout',
  'setsid',
  'ionice',
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

/**
 * The options of a neutral prefix that take a **separate value**, so the scan steps over the value
 * too (`sudo -u root`, `env -u NAME`, `xargs -I {{}}`, `timeout -s KILL`). A prefix absent from this
 * map still has its own options skipped — the generic rule — but no value is consumed.
 * `positional` marks the prefixes that also consume one positional argument before the real command:
 * `timeout` takes a duration (`timeout 5 git push`).
 */
const PREFIX_OPTIONS = new Map([
  ['sudo', { values: new Set(['-u', '-g', '-p', '-h', '-C', '-T', '--user', '--group', '--prompt', '--host', '--chdir', '--command-timeout']) }],
  ['env', { values: new Set(['-u', '--unset', '-C', '--chdir', '-S', '--split-string']) }],
  ['xargs', { values: new Set(['-n', '-I', '-L', '-P', '-a', '-d', '-s', '-E', '--max-args', '--replace', '--max-lines', '--max-procs', '--arg-file', '--delimiter', '--max-chars', '--eof']) }],
  ['time', { values: new Set(['-o', '--output']) }],
  ['nice', { values: new Set(['-n', '--adjustment']) }],
  ['timeout', { values: new Set(['-s', '--signal', '-k', '--kill-after']), positional: true }],
  ['ionice', { values: new Set(['-c', '-n', '-p', '-P']) }],
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
      // A neutral prefix carries its own options, and an option may take a value
      // (`sudo -u root git push`, `env -i git push`, `timeout 5 git push`): without stepping
      // over them the option — or its value — becomes the head, and the real command walks
      // past every branch that reads the head. A prefix with no entry still has its options
      // skipped; only the value-taking ones are named above.
      if (NEUTRAL_PREFIXES.has(t)) {
        const opts = PREFIX_OPTIONS.get(t) || { values: new Set() };
        while (i < tokens.length && !tokens[i].q && tokens[i].t.startsWith('-')) {
          const raw = tokens[i].t;
          const name = raw.split('=')[0];
          i += 1;
          if (opts.values.has(name) && !raw.includes('=') && i < tokens.length && !tokens[i].q) i += 1;
        }
        if (opts.positional && i < tokens.length && !tokens[i].q && !tokens[i].t.startsWith('-')) i += 1;
      }
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
// Four branches behind the project gate, and two switches in the whole file. The gate stays:
// without `.daiku/project.json` this project has not opened Daiku, and the guard does not even
// read the line. Behind the gate, push, `--no-verify` and commits crediting the agent are denied
// **always** — an agent is never left any of these freedoms, and never trusting an LLM is the
// rule saying so (see `CLAUDE.md`). The two things the project declares are the worktree pool and
// the channels' production branch.
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
    // The command of a `find -exec` is a line of its own, exactly as `pathGuard` reads it:
    // `find . -exec git push ;` carries its Git invocation there and nowhere else.
    const executed = execPayload(tokens, first.index);
    if (executed && depth < 3) found.push(...gitInvocations(executed, depth + 1));
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

/** The branch guard: the project's work lives on the development branch, never on production.
 *
 * It is the one branch that **reads the world** — the current branch — and it reads it only when
 * the line names a `git` invocation, so an ordinary command pays nothing. It is switched on by
 * `channels.production`: where the project declares no production branch, the guard is off and
 * nothing changes. Three gestures are denied while the production branch is active or aimed at:
 * `git commit` and `git merge` **on** it, and `git checkout`/`git switch` **towards** it — so one
 * never arrives there to commit. Every other branch — the development one and the pool's
 * `{worktree.branch_prefix}*` — stays legitimate, and the delivery is untouched.
 *
 * The branch is asked of Git **through `env`**, like every other reading of the world, so the
 * bench can answer without a repository; a Git that does not answer reads `null` and the guard
 * allows — the fail-open contract, proved by the bench.
 */
function branchGuard(line, cwd, env, ctx) {
  const production = ctx && ctx.channels && ctx.channels.production;
  if (!production) return null;
  const invocations = gitInvocations(line);
  if (!invocations.length) return null; // not a Git line: the branch is never read
  let branch = null;
  try {
    branch = env.branch(cwd || process.cwd());
  } catch {
    branch = null;
  }
  if (!branch) return null; // Git did not answer: allow
  for (const invocation of invocations) {
    if (!invocation.length) continue;
    const sub = invocation[0].t;
    const args = invocation.slice(1);
    // `git merge --abort`/`--continue`/`--quit` are recovery, not work landing on production:
    // denying them would trap a merge already in progress. Only the merge itself is denied.
    const recovery = args.some((x) => !x.q && (x.t === '--abort' || x.t === '--continue' || x.t === '--quit'));
    if ((sub === 'commit' || sub === 'merge') && !recovery && branch === production) {
      return {
        reason:
          `\`git ${sub}\` while the production branch \`${production}\` is active: the work lives on ` +
          `the development branch \`{channels.development}\`, and production advances only by a ` +
          'release. Switch to the development branch before committing or merging.',
      };
    }
    if (sub === 'checkout' || sub === 'switch') {
      const target = args.find((x) => !isFlag(x));
      if (target && target.t === production) {
        return {
          reason:
            `\`git ${sub} ${production}\` would put the production branch active: the work lives on ` +
            `the development branch \`{channels.development}\`. Production advances only by a ` +
            'release, which moves the branch without checking it out.',
        };
      }
    }
  }
  return null;
}

/** A line of a commit message attributing the work to the agent that wrote it: a
 * `Co-Authored-By` trailer naming Claude or Codex — or their makers, which is how the
 * hosts sign it (`noreply@anthropic.com`) — and the `Generated with …` line they append.
 * The `=` shape is the one `--trailer` accepts. */
const AGENT_ATTRIBUTION = [
  /co-authored-by\s*[:=][^\n]*\b(?:claude|codex|anthropic|openai|chatgpt)\b/i,
  /generated (?:with|by)[^\n]*\b(?:claude|codex)\b/i,
];

/** The `-F`/`--file` values of a `git commit`: the message read from a file. `-` is
 * stdin, i.e. the heredoc already in the line. */
function messageFiles(args) {
  const files = [];
  for (let k = 0; k < args.length; k += 1) {
    const x = args[k];
    if (x.q) continue;
    if ((x.t === '-F' || x.t === '--file') && args[k + 1]) {
      files.push(args[k + 1].t);
      k += 1;
    } else if (x.t.startsWith('--file=')) {
      files.push(x.t.slice('--file='.length));
    }
  }
  return files.filter((f) => f && f !== '-');
}

/** `git commit` whose message credits Claude or Codex, with no switch.
 *
 * The message is read where it stands. The **whole line** is searched, not only the `-m`
 * values: a heredoc feeding `-F -` and a PowerShell here-string are part of the line and
 * of no token the tokenizer would recognise as the message, and `--trailer` writes the same
 * trailer by another road. A message in a file (`-F <file>`) is read from disk, relative to
 * the session cwd; when the file does not answer, that source is skipped and the line
 * alone decides — the fail-open contract, proved by the bench.
 */
function attributionGuard(line, cwd, env) {
  const commits = gitInvocations(line).filter((inv) => inv.length && inv[0].t === 'commit');
  if (!commits.length) return null;
  const texts = [line];
  for (const invocation of commits) {
    for (const file of messageFiles(invocation.slice(1))) {
      const absolute = resolveTarget(file, cwd);
      if (!absolute) continue;
      try {
        const text = env.readMessage(absolute);
        if (typeof text === 'string') texts.push(text);
      } catch {
        // unreadable file: the line alone decides
      }
    }
  }
  if (!texts.some((text) => AGENT_ATTRIBUTION.some((pattern) => pattern.test(text)))) return null;
  return {
    reason:
      'the commit message credits the agent that wrote the work — a `Co-Authored-By` ' +
      'naming Claude or Codex, or a `Generated with` line: the history carries only ' +
      'whoever owns the work. Drop that line from the message and commit again. See ' +
      '`skills/commit/SKILL.md`, last paragraph.',
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
  /** The text of a commit-message file; `null` when it does not answer. */
  readMessage: (path) => {
    try {
      return readFileSync(path, 'utf-8');
    } catch {
      return null;
    }
  },
  /** The branch active where `cwd` stands, or `null` when Git does not answer (no repository,
   * no commit yet, a detached HEAD reads `HEAD` — none of them is production, and none stops a
   * gesture). The only reading of the world the branch guard pays for, and only on a Git line. */
  branch: (cwd) => {
    try {
      const run = spawnSync('git', ['-C', cwd, 'rev-parse', '--abbrev-ref', 'HEAD'], {
        encoding: 'utf-8',
      });
      if (run.error || run.status !== 0) return null;
      const name = (run.stdout || '').trim();
      return name || null;
    } catch {
      return null;
    }
  },
};

/** The decision, without leaving the process: what the test bench calls.
 *
 * The disk is questioned by two branches — the link one and the commit-message
 * file one — and their exception stays inside them: the others decide on paths
 * and parameters, so they hold even with an unreachable filesystem. Proved by the
 * bench, not declared here.
 */
function evaluate(line, cwd, env, ctx) {
  // The gate, before everything else: without `.daiku/project.json` this project has not
  // opened Daiku, and the guard has nothing to watch. The line is not even read.
  if (!ctx || !ctx.present) return null;
  return (
    pathGuard(line, cwd, env, ctx) ||
    commitGuard(line) ||
    attributionGuard(line, cwd, env) ||
    pushGuard(line) ||
    branchGuard(line, cwd, env, ctx)
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
function fakeEnv(branch = 'main') {
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
    // Two commit-message files next to the root, one clean and one signed by the agent.
    readMessage: (p) =>
      ({
        'c:/dev/project/msg-clean.txt': 'feat: add the parser\n',
        'c:/dev/project/msg-signed.txt':
          'feat: add the parser\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n',
      })[key(p)] ?? null,
    // The branch the simulated session is on. The real environment asks Git; here it is the
    // fixture's choice, so a case can stand on production, on development or on a pool branch.
    branch: () => branch,
  };
}

const ROOT_CWD = 'C:/dev/project';
const WT_CWD = 'C:/dev/wt/wt-1';

/** A project that opened Daiku and declares the pool: everything left to switch on. */
const CTX_FULL = fakeContext({ pool: 'C:/dev/wt' });

/** A project that opened Daiku and declared neither pool nor guardrails. */
const CTX_BARE = fakeContext({});

/** A project that declared the two channels: the branch guard is on, and its production is `main`. */
const CTX_CHANNELS = fakeContext({ channels: { development: 'develop', production: 'main' } });

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

  // --- the only switch left is the pool: push and --no-verify always deny, with no key,
  // and the cases below prove it with switches off -----
  ['undeclared push is still denied', 'git push', ROOT_CWD, 'deny', 'manual gesture', CTX_BARE],
  ['undeclared --no-verify is still denied', 'git commit --no-verify -m wip', ROOT_CWD, 'deny', 'is not allowed', CTX_BARE],
  ['explicitly switched-off keys switch nothing off', 'git push', ROOT_CWD, 'deny', 'manual gesture', fakeContext({ guardrails: { deny_push: false, deny_no_verify: false } })],
  ['no pool declared: someone else\'s worktree is left alone', 'rm -rf c:/dev/wt/wt-1/docs', ROOT_CWD, 'allow', '', CTX_BARE],
  ['no pool declared: not even pnpm install', 'pnpm install', WT_CWD, 'allow', '', CTX_BARE],
  ['the link stays protected all the same: a system fact, not a policy', 'rm -rf c:/dev/wt/wt-1/node_modules', ROOT_CWD, 'deny', 'crosses a Windows link', CTX_BARE],
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

  // --- normal commits that must stay allowed ------------------------------------------
  ['clean git commit -a', 'git commit -a -m "x"', ROOT_CWD, 'allow', ''],
  ['git add -A passes here: the commit decides', 'git add -A', ROOT_CWD, 'allow', ''],
  ['clean bare git commit', 'git commit -m "docs: x"', ROOT_CWD, 'allow', ''],
  ['git add of a policy and the parameters together', 'git add .daiku/policies/area.md .daiku/project.json', ROOT_CWD, 'allow', ''],

  // --- attribution: no commit credits Claude or Codex, in any shape of the message ----
  ['undeclared attribution is still denied', 'git commit -m "feat: x" -m "Co-Authored-By: Claude <noreply@anthropic.com>"', ROOT_CWD, 'deny', 'credits the agent', CTX_BARE],
  ['Co-Authored-By Codex in -m', 'git commit -m "fix: y" -m "Co-authored-by: Codex <codex@openai.com>"', ROOT_CWD, 'deny', 'credits the agent'],
  ['trailer in a Bash heredoc', "git commit -F - <<'EOF'\nfeat: x\n\n- one\n\nCo-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>\nEOF", ROOT_CWD, 'deny', 'credits the agent'],
  ['trailer in a PowerShell here-string', "git commit -m @'\nfeat: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n'@", ROOT_CWD, 'deny', 'credits the agent'],
  ['--trailer with the = shape', 'git commit -m "x" --trailer "Co-authored-by=Claude <noreply@anthropic.com>"', ROOT_CWD, 'deny', 'credits the agent'],
  ['Generated with Claude Code', 'git commit -m "feat: x" -m "🤖 Generated with [Claude Code](https://claude.com/claude-code)"', ROOT_CWD, 'deny', 'credits the agent'],
  ['the signature inside a wrapper', 'bash -c "git commit -m \'x\' -m \'Co-Authored-By: Codex\'"', ROOT_CWD, 'deny', 'credits the agent'],
  ['the signature in the -F file', 'git commit -F msg-signed.txt', ROOT_CWD, 'deny', 'credits the agent'],
  ['the signature in the --file= file', 'git commit --file=c:/dev/project/msg-signed.txt', ROOT_CWD, 'deny', 'credits the agent'],
  ['a clean -F file', 'git commit -F msg-clean.txt', ROOT_CWD, 'allow', ''],
  ['an -F file that does not exist', 'git commit -F missing.txt', ROOT_CWD, 'allow', ''],
  ['a human co-author stays allowed', 'git commit -m "x" -m "Co-Authored-By: Mario Rossi <mario@example.com>"', ROOT_CWD, 'allow', ''],
  ['a message about Claude without a trailer', 'git commit -m "feat: add the Claude hook adapter"', ROOT_CWD, 'allow', ''],
  ['searching history for the trailer is not a commit', 'git log --grep "Co-Authored-By: Claude"', ROOT_CWD, 'allow', ''],

  // --- push: denied where declared, and the shapes that stay allowed -----
  ['bare git push', 'git push', ROOT_CWD, 'deny', 'manual gesture'],
  ['git -C with another tree', 'git -C c:/dev/wt/wt-1 push origin main', ROOT_CWD, 'deny', 'manual gesture'],
  ['powershell -Command "git push"', 'powershell -NoProfile -Command "git push"', ROOT_CWD, 'deny', 'manual gesture'],
  ['bash -lc "git push"', 'bash -lc "git push --force"', ROOT_CWD, 'deny', 'manual gesture'],
  ['cmd /c "git push"', 'cmd /c "git push"', ROOT_CWD, 'deny', 'manual gesture'],
  ['git.exe with quoted path and spaces', '"C:\\Program Files\\Git\\cmd\\git.exe" push', ROOT_CWD, 'deny', 'manual gesture'],
  ['sudo in front of git push', 'sudo git push', ROOT_CWD, 'deny', 'manual gesture'],
  ['git push chained after another command', 'npm test && git push', ROOT_CWD, 'deny', 'manual gesture'],

  // --- a neutral prefix that carries its own option: the option is not the command ------
  ['sudo with its own option, then git push', 'sudo -u root git push', ROOT_CWD, 'deny', 'manual gesture'],
  ['sudo -E, then git push', 'sudo -E git push', ROOT_CWD, 'deny', 'manual gesture'],
  ['env -i, then git push', 'env -i git push', ROOT_CWD, 'deny', 'manual gesture'],
  ['xargs -0, then git push', 'xargs -0 git push', ROOT_CWD, 'deny', 'manual gesture'],
  ['time -p, then git push', 'time -p git push', ROOT_CWD, 'deny', 'manual gesture'],
  ['nice -n 19, then git push', 'nice -n 19 git push', ROOT_CWD, 'deny', 'manual gesture'],
  ['timeout 5, then git push', 'timeout 5 git push', ROOT_CWD, 'deny', 'manual gesture'],
  ['sudo -u root, then rm on the junction', 'sudo -u root rm -rf c:/dev/wt/wt-1/node_modules', ROOT_CWD, 'deny', 'crosses a Windows link'],
  ['env -i, then rm in a pooled worktree', 'env -i rm -rf c:/dev/wt/wt-1/docs', ROOT_CWD, 'deny', 'of the pool'],
  ['sudo -u root, then commit --no-verify', 'sudo -u root git commit --no-verify -m x', ROOT_CWD, 'deny', 'is not allowed'],
  ['a neutral prefix with an option, on a command that is not its business', 'nice -n 5 echo hi', ROOT_CWD, 'allow', ''],

  // --- find -exec carries a line of its own, for the git branches too -------------------
  ['find -exec git push', 'find . -exec git push ;', ROOT_CWD, 'deny', 'manual gesture'],
  ['find -exec git commit --no-verify', 'find . -exec git commit --no-verify -m x ;', ROOT_CWD, 'deny', 'is not allowed'],
  ['git push --dry-run pushes nothing', 'git push --dry-run', ROOT_CWD, 'allow', ''],
  ['git fetch is not a push', 'git fetch origin main', ROOT_CWD, 'allow', ''],
  ['echo of a sentence talking about git push', 'echo "git push is forbidden"', ROOT_CWD, 'allow', ''],
  ['grep for git push in the corpus', 'grep -rn "git push" .claude/', ROOT_CWD, 'allow', ''],

  // --- the branch guard: off without `channels`, on with it --------------------------------
  ['branch project: commit on production is denied', 'git commit -m "x"', ROOT_CWD, 'deny', 'production branch', CTX_CHANNELS, 'main'],
  ['commit on development passes', 'git commit -m "x"', ROOT_CWD, 'allow', '', CTX_CHANNELS, 'develop'],
  ['commit on a pool branch passes', 'git commit -m "x"', WT_CWD, 'allow', '', CTX_CHANNELS, 'worktree-agent-tree-1'],
  ['merge on production is denied', 'git merge feature -m x', ROOT_CWD, 'deny', 'production branch', CTX_CHANNELS, 'main'],
  ['merge on development passes', 'git merge feature -m x', ROOT_CWD, 'allow', '', CTX_CHANNELS, 'develop'],
  ['git merge --abort on production is recovery, not denied', 'git merge --abort', ROOT_CWD, 'allow', '', CTX_CHANNELS, 'main'],
  ['checkout towards production is denied', 'git checkout main', ROOT_CWD, 'deny', 'production branch', CTX_CHANNELS, 'develop'],
  ['switch towards production is denied', 'git switch main', ROOT_CWD, 'deny', 'production branch', CTX_CHANNELS, 'develop'],
  ['checkout of the development branch passes', 'git checkout develop', ROOT_CWD, 'allow', '', CTX_CHANNELS, 'main'],
  ['creating the development branch from production passes', 'git checkout -b develop', ROOT_CWD, 'allow', '', CTX_CHANNELS, 'main'],
  ['without channels the branch guard is off: commit on production passes', 'git commit -m "x"', ROOT_CWD, 'allow', '', CTX_FULL, 'main'],
  ['without channels a checkout of production passes', 'git checkout main', ROOT_CWD, 'allow', '', CTX_BARE, 'develop'],
  ['a non-git command never reads the branch', 'rm -rf build', ROOT_CWD, 'allow', '', CTX_CHANNELS, 'main'],

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

  for (const [name, line, cwd, expected, contains, ctx, branch] of CASES) {
    ran += 1;
    let outcome;
    try {
      outcome = evaluate(line, cwd, branch ? fakeEnv(branch) : env, ctx || CTX_FULL);
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
    readMessage: () => {
      throw new Error('filesystem unreachable');
    },
    branch: () => {
      throw new Error('git unreachable');
    },
  };
  // The link branch is the one interrogating the disk, and it allows when the disk does not
  // answer. The commit-message file is the other disk read, and a message it cannot open is
  // skipped, leaving the line alone to decide. The branch read is the third: a Git that does not
  // answer lets the gesture through. The others decide on paths and parameters, which need no
  // disk to read, and stay denied.
  const brokenEnv = [
    ['rm -rf c:/dev/wt/wt-1/node_modules', ROOT_CWD, 'deny'],
    ['rm -rf c:/dev/project/node_modules', ROOT_CWD, 'allow'],
    ['pnpm install', WT_CWD, 'deny'],
    ['git push', ROOT_CWD, 'deny'],
    ['git commit -n -m x', ROOT_CWD, 'deny'],
    ['git commit -m x', ROOT_CWD, 'allow'],
    ['git commit -F msg-signed.txt', ROOT_CWD, 'allow'],
    ['git commit -m x -m "Co-Authored-By: Claude"', ROOT_CWD, 'deny'],
    ['git commit -m x', ROOT_CWD, 'allow', CTX_CHANNELS],
  ];
  for (const [line, cwd, expected, ctx] of brokenEnv) {
    ran += 1;
    let decision;
    try {
      decision = safeDecide(line, cwd, broken, ctx || CTX_FULL);
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
    ['broken JSON: context absent', { 'C:/dev/project/.daiku/project.json': '{"contract": 1,}' }, false],
    ['valid JSON: context present', { 'C:/dev/project/.daiku/project.json': '{"contract": 1}' }, true],
  ];
  for (const [name, file, expected] of fromJson) {
    ran += 1;
    const read = loadContext('C:/dev/project', readers(file));
    if (read.present !== expected) failed.push(`${name}: expected present=${expected}`);
  }

  ran += 1;
  const withDeadKeys = loadContext('C:/dev/project', readers({
    'C:/dev/project/.daiku/project.json':
      '{"contract": 1, "worktree": {"pool": "../wt"}, "guardrails": {"deny_push": false, "deny_no_verify": false}}',
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
//    judged at all — allowed, and not coverage.
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
//    a fault wearing a protection's looks. Whoever wants coverage declares it.
//  - **A signature the line does not carry**: `git commit --amend --no-edit` or `-C <commit>`
//    reusing a message that already holds it, `-t <template>`, the editor opened by a
//    commit without a message, an `-F` file after a `cd` on the same line (it is read
//    from the session cwd), and `git merge`/`git tag -m`, which are not commits. The
//    attribution branch reads the message where the line names it, nowhere else.
//  - **A false positive of the attribution branch**: it searches the whole line, so a
//    `git commit` chained with an `echo "Co-Authored-By: Claude"` is denied. The remedy
//    is splitting the line.

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
