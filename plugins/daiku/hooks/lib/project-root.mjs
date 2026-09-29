/**
 * The project root, for a hook running on Claude Code **or** on Codex.
 *
 * The root is not a name: it is **the directory carrying `.daiku/project.json`**, which the
 * contract puts in the *technical root* — and the technical root is not the git root. A
 * monorepo may keep the code under a subfolder and the technical root inside there, and then
 * the two differ; a hook looking at the git root finds no parameters, stays silent, and a
 * fail-open guard that stays silent is indistinguishable from one that works.
 *
 * So the parameters are looked for, in this order:
 *
 *  1. **the directory the host declares**, when it carries them — on Claude Code
 *     `CLAUDE_PROJECT_DIR` is the session's root, and asking further would be second-guessing
 *     the host;
 *  2. **the closest ancestor of the cwd that carries them**, climbing and stopping at the git
 *     root: that is where the command runs, and a nested project's parameters are nearer than
 *     an outer project's;
 *  3. **the main tree, when the cwd stands in a linked worktree.** A worktree carries no
 *     `.daiku/` — the folder is not versioned, so `git worktree add` does not bring it — and the
 *     delivery runs *inside* a worktree. The parameters are then read from the main tree, at the
 *     same relative position the command occupies here: the worktree is a copy, and the technical
 *     root sits in the same place in both. Leaving this to the caller would make a fail-open
 *     guard depend on a prose step of another skill, which is the one thing it cannot do;
 *  4. **the directory the host declares**, even without parameters, then the git root, then the
 *     cwd — the degradation ladder. A project that never opened Daiku reaches `loadContext`
 *     with a root that has no parameters, which is exactly the answer it expects.
 *
 * None of the steps throws: a wrong root degrades, an exception here would switch the hook off.
 *
 * The git root is still read, but for what it is — the outermost directory that can belong to
 * this repository, the point where the climb stops. On Codex, which exports no project
 * variable (`CODEX_SESSION_ID`, `CODEX_THREAD_ID`, `CODEX_VERSION` and the rest name nothing of
 * the sort), the climb is the whole answer.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Was this module launched as a program, or imported by someone else?
 *
 * Needed because the hooks **export** the functions their test bench checks,
 * and a module reading stdin and exiting `0` on load alone cannot be imported:
 * anyone trying to call one of its functions from outside would see the process die in silence, which is
 * the worst way to fail in a file whose contract is "stay silent when you have nothing to
 * say".
 *
 * The comparison is between resolved paths with no case distinction, because on Windows the
 * same file is spelled several ways. If anything goes wrong the answer is **yes**: in
 * doubt a hook does its job, instead of staying silent over a string comparison.
 */
export function invokedDirectly(metaUrl) {
  try {
    const launched = process.argv[1];
    if (!launched) return true;
    return resolve(fileURLToPath(metaUrl)).toLowerCase() === resolve(launched).toLowerCase();
  } catch {
    return true;
  }
}

/** Two directories, compared as the same file: on Windows they are spelled several ways. */
const sameDir = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/** The real filesystem, without ever throwing: an unreadable path is not a seat. */
const REAL_EXISTS = (path) => {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
};

/** Is this the technical root of a project Daiku opened? The parameters, not the name. */
function carriesDaiku(dir, exists) {
  if (!dir) return false;
  try {
    return !!exists(join(dir, '.daiku', 'project.json'));
  } catch {
    return false;
  }
}

/**
 * The closest ancestor of `from` carrying the parameters, `from` included, climbing up and
 * stopping at `stop` — the git root, which is checked like every other step and is the
 * outermost directory the climb may reach. `null` when there is none.
 */
function closestDaiku(from, stop, exists) {
  let dir = resolve(from);
  const last = stop ? resolve(stop) : null;
  for (;;) {
    if (carriesDaiku(dir, exists)) return dir;
    if (last && sameDir(dir, last)) return null;
    const up = dirname(dir);
    if (up === dir) return null; // the filesystem root
    dir = up;
  }
}

/** The git root starting from `from`, or `null` when git does not answer or we are outside a repo. */
export function gitRoot(from, run = spawnSync) {
  try {
    const result = run('git', ['rev-parse', '--show-toplevel'], {
      cwd: from,
      encoding: 'utf-8',
      timeout: 5000,
    });
    if (!result || result.status !== 0 || !result.stdout) return null;
    const line = String(result.stdout).trim();
    return line || null;
  } catch {
    return null;
  }
}

/**
 * The root of the **main tree**, when `cwd` stands in a linked worktree, or `null` when it does
 * not. `git rev-parse --git-common-dir` is the one question that tells them apart: in a normal
 * repository it answers the repository's own `.git`, and in a worktree it answers the `.git` of
 * the tree that owns it — whose parent is the main tree. The answer may be relative, so it is
 * resolved against the directory git was run from.
 */
function mainTreeRoot(cwd, run) {
  try {
    const result = run('git', ['rev-parse', '--git-common-dir'], {
      cwd,
      encoding: 'utf-8',
      timeout: 5000,
    });
    if (!result || result.status !== 0 || !result.stdout) return null;
    const line = String(result.stdout).trim();
    if (!line) return null;
    return dirname(resolve(cwd, line));
  } catch {
    return null;
  }
}

/**
 * The root, with the full chain. `overrides` exists for the test bench: it carries the
 * environment variables, the cwd, the git runner and the filesystem, keeping the function
 * pure.
 */
export function projectRoot(overrides = {}) {
  const env = overrides.env || process.env;
  const cwd = overrides.cwd || process.cwd();
  const run = overrides.run || spawnSync;
  const exists = overrides.exists || REAL_EXISTS;

  // The host declares the root, and when the parameters stand there the question is closed.
  const declared = env.CLAUDE_PROJECT_DIR || null;
  if (declared && carriesDaiku(declared, exists)) return resolve(declared);

  // Everywhere else — Codex, which declares nothing — the root is not the git root.
  const git = gitRoot(cwd, run);
  const found = closestDaiku(cwd, git, exists);
  if (found) return found;

  // A linked worktree: the same place, in the tree that owns it. Only when this really is a
  // worktree — in a normal repository the main tree is the tree we already climbed.
  const main = mainTreeRoot(cwd, run);
  if (main && git && !sameDir(main, git)) {
    const here = relative(resolve(git), resolve(cwd));
    // `..` would leave the main tree: a cwd outside the repository has no position to carry.
    // An empty position is the worktree's own root, and its place in the main tree is the main
    // tree's root — the right answer when the technical root *is* the repository root.
    if (!here.startsWith('..')) {
      const mapped = closestDaiku(join(main, here), main, exists);
      if (mapped) return mapped;
    }
  }

  // No parameters anywhere: the ladder, and each step is a declared degradation. What comes
  // out is always resolved, whichever step answered: one spelling for the caller, and a
  // comparison between two roots means the same thing whoever wrote them.
  return resolve(declared || git || cwd);
}

// --- bench ----------------------------------------------------------------------
//
// `node project-root.mjs --self-check`, the form `hooks/self-check.mjs` discovers in `lib/`.
// Every case fixes the environment, the cwd, the git answer and the filesystem: the function
// is pure, so the whole chain is provable without touching disk or spawning anything.

function selfCheck() {
  const failed = [];
  let ran = 0;
  const check = (name, condition) => {
    ran += 1;
    if (!condition) failed.push(name);
  };

  /** A filesystem holding exactly the given `.daiku/project.json` paths. */
  const fs = (...withParameters) => {
    const held = new Set(withParameters.map((p) => resolve(p).toLowerCase()));
    return (path) => held.has(resolve(path).toLowerCase());
  };
  /**
   * A git answering both questions: the git root of the cwd, and the common directory of the
   * repository owning it. By default the second is the first's own `.git` — a normal
   * repository — and passing `commonDir` turns it into a linked worktree.
   */
  const git = (root, commonDir = root ? `${root}/.git` : null) => (_command, args) => {
    if (args.includes('--git-common-dir')) {
      return commonDir === null ? { status: 128, stdout: '' } : { status: 0, stdout: `${commonDir}\n` };
    }
    return root === null ? { status: 128, stdout: '' } : { status: 0, stdout: `${root}\n` };
  };

  const TECH = 'C:/dev/project/src';
  const REPO = 'C:/dev/project';
  const TECH_DAIKU = `${TECH}/.daiku/project.json`;

  // --- the host's word wins when it carries the parameters ---------------------
  check(
    'Claude Code: the declared root, when it carries the parameters',
    projectRoot({ env: { CLAUDE_PROJECT_DIR: TECH }, cwd: TECH, run: git(REPO), exists: fs(TECH_DAIKU) }) === resolve(TECH)
  );
  check(
    'Claude Code: and it comes out resolved, whatever spelling the host used',
    projectRoot({ env: { CLAUDE_PROJECT_DIR: 'C:/dev/project/src/' }, cwd: 'C:/elsewhere', run: git(REPO), exists: fs(TECH_DAIKU) }) ===
      resolve(TECH)
  );

  // --- the climb: the technical root of a monorepo, inside a subfolder ---------
  check(
    'Codex: a cwd inside the technical root finds it, not the git root',
    projectRoot({ env: {}, cwd: TECH, run: git(REPO), exists: fs(TECH_DAIKU) }) === resolve(TECH)
  );
  check(
    'Codex: a cwd deeper inside climbs to the technical root',
    projectRoot({ env: {}, cwd: `${TECH}/apps/backend/app`, run: git(REPO), exists: fs(TECH_DAIKU) }) === resolve(TECH)
  );
  check(
    'Claude Code with a declared root carrying no parameters still climbs',
    projectRoot({ env: { CLAUDE_PROJECT_DIR: REPO }, cwd: `${TECH}/apps`, run: git(REPO), exists: fs(TECH_DAIKU) }) ===
      resolve(TECH)
  );

  // --- the climb is bounded, and the nearest parameters win --------------------
  check(
    'the climb stops at the git root: parameters above it are not picked up',
    projectRoot({ env: {}, cwd: `${TECH}/apps`, run: git(REPO), exists: fs('C:/dev/.daiku/project.json') }) === resolve(REPO)
  );
  check(
    'the nearest parameters win over the outer ones',
    projectRoot({
      env: {},
      cwd: `${TECH}/apps/nested`,
      run: git(REPO),
      exists: fs(TECH_DAIKU, `${TECH}/apps/.daiku/project.json`),
    }) === resolve(`${TECH}/apps`)
  );

  // --- a linked worktree: the parameters stand in the main tree -----------------
  const WT = 'C:/dev/project/.claude/worktrees/agent-tree-1';
  const WT_GIT = 'C:/dev/project/.git';

  check(
    'a worktree without parameters reads them from the main tree, at the same place',
    projectRoot({ env: {}, cwd: `${WT}/src`, run: git(WT, WT_GIT), exists: fs(TECH_DAIKU) }) === resolve(TECH)
  );
  check(
    'a worktree deeper inside carries the position onto the main tree',
    projectRoot({ env: {}, cwd: `${WT}/src/apps/backend`, run: git(WT, WT_GIT), exists: fs(TECH_DAIKU) }) === resolve(TECH)
  );
  check(
    'a worktree of a project whose technical root is the repository root',
    projectRoot({ env: {}, cwd: `${WT}/apps`, run: git(WT, WT_GIT), exists: fs(`${REPO}/.daiku/project.json`) }) ===
      resolve(REPO)
  );
  check(
    'the worktree root maps to the main tree root',
    projectRoot({ env: {}, cwd: WT, run: git(WT, WT_GIT), exists: fs(`${REPO}/.daiku/project.json`) }) === resolve(REPO)
  );
  check(
    'a worktree whose main tree has no parameters either stays where it is',
    projectRoot({ env: {}, cwd: `${WT}/src`, run: git(WT, WT_GIT), exists: fs() }) === resolve(WT)
  );
  check(
    'a worktree carrying its own parameters uses them, not the main tree',
    projectRoot({
      env: {},
      cwd: `${WT}/src`,
      run: git(WT, WT_GIT),
      exists: fs(`${WT}/src/.daiku/project.json`, TECH_DAIKU),
    }) === resolve(`${WT}/src`)
  );
  check(
    'a cwd outside the git root carries no position: the main tree is not searched',
    projectRoot({ env: {}, cwd: 'C:/elsewhere', run: git(WT, WT_GIT), exists: fs(TECH_DAIKU) }) === resolve(WT)
  );

  // --- the degradation ladder --------------------------------------------------
  check(
    'no parameters anywhere: the git root',
    projectRoot({ env: {}, cwd: `${TECH}/apps`, run: git(REPO), exists: fs() }) === resolve(REPO)
  );
  check(
    'no parameters and no git: the cwd',
    projectRoot({ env: {}, cwd: `${TECH}/apps`, run: git(null), exists: fs() }) === resolve(`${TECH}/apps`)
  );
  check(
    'no parameters, no git, and a declared root: the declared root',
    projectRoot({ env: { CLAUDE_PROJECT_DIR: TECH }, cwd: `${TECH}/apps`, run: git(null), exists: fs() }) === resolve(TECH)
  );
  check(
    'a project that never opened Daiku is not given one',
    projectRoot({ env: {}, cwd: REPO, run: git(REPO), exists: fs() }) === resolve(REPO)
  );

  // --- the climb stops at the filesystem root, and never loops -----------------
  check(
    'climbing from a directory with no parameters above it ends, and answers',
    projectRoot({ env: {}, cwd: 'C:/dev/a/b/c/d', run: git(null), exists: fs() }) === resolve('C:/dev/a/b/c/d')
  );

  process.stdout.write(JSON.stringify({ checks: ran, passed: ran - failed.length, failed }, null, 2) + '\n');
  return failed.length ? 1 : 0;
}

if (invokedDirectly(import.meta.url) && process.argv.includes('--self-check')) {
  process.exit(selfCheck());
}
