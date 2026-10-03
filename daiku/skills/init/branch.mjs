#!/usr/bin/env node
/**
 * The development branch of this project: create it if it is not there, and stand on it.
 *
 * `init` asks the name of the development branch and writes it in `channels.development`
 * (`.daiku/project.json`). The gesture that makes the key true — the branch exists, and the
 * working copy stands on it — is **this step**, deterministic and idempotent, which `init`
 * launches right after it writes the parameters. It exists because a branch cannot be created
 * by prose: either the ref is there or it is not, and the answer must be the same on every
 * relaunch.
 *
 * Three cases, and no fourth:
 *
 *  - **the branch does not exist** — the tree must be **clean**, then it is created from the
 *    production branch where that stands and is known, otherwise from the current `HEAD`, and
 *    checked out. A dirty tree here fails: the owner asked the creation to fail rather than carry
 *    uncommitted work onto a branch that is meant to be identical to production;
 *  - **the branch exists** — it is checked out. This is the idempotent relaunch, and it does
 *    **not** fail on a dirty tree: `init` is relaunchable, and a working repository is normally
 *    dirty. What happens to the working tree is Git's to say, not this step's;
 *  - **the branch is the production branch** — nothing to do: the two channels coincide, and the
 *    project has declared a single branch. No branch is created.
 *
 * It stops and declares, without inventing, on a repository with **no commit yet**: there
 * `production` does not exist and a development branch cannot be made «identical to» anything.
 * The run reports it as a step that did not go through; the project stays open.
 *
 *   node <package-root>/skills/init/branch.mjs <technical-root> <development> [<production>]
 *       one JSON object on stdout — `{ok, action, branch, detail}` — and exit 0.
 *       `action` is one of: `created`, `checked-out`, `skip`, `dirty`, `no-commits`,
 *       `not-a-repo`, `error`. Bad arguments: exit 2.
 *
 *   node <package-root>/skills/init/branch.mjs --self-check
 *       the bench, on throwaway repositories under the system temp directory: counted JSON
 *       `{checks, passed, failed[]}`, exit 1 on the first red. `hooks/self-check.mjs` launches it.
 *       It wants `git` on the `PATH`.
 *
 * It writes no file, and it never commits, merges or pushes: the only things it writes are a
 * branch and the checked-out position.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** One Git line in `root`, output kept. The only door to the world, so the bench can replace it
 * with a real (throwaway) repository and nothing else. */
function git(root, args) {
  return spawnSync('git', ['-C', root, ...args], { encoding: 'utf-8' });
}

/**
 * The decision, on the repository at `root`. Pure of process exit, so the bench calls it directly.
 */
export function run(root, development, production = null, gitRun = git) {
  const dev = typeof development === 'string' ? development.trim() : '';
  const prod = typeof production === 'string' ? production.trim() : '';
  if (!root || !dev) return { ok: false, action: 'error', branch: null, detail: 'a technical root and a development branch name are required' };

  const inside = gitRun(root, ['rev-parse', '--is-inside-work-tree']);
  if (inside.error || inside.status !== 0 || (inside.stdout || '').trim() !== 'true') {
    return { ok: false, action: 'not-a-repo', branch: null, detail: `${root} is not inside a Git working tree` };
  }

  const head = gitRun(root, ['rev-parse', '--verify', '--quiet', 'HEAD']);
  if (head.error || head.status !== 0) {
    return { ok: false, action: 'no-commits', branch: null, detail: 'the repository has no commit yet: there is no production branch to be identical to' };
  }

  if (prod && dev === prod) {
    return { ok: true, action: 'skip', branch: dev, detail: `the development branch is the production branch (${dev}): nothing to create` };
  }

  const exists = gitRun(root, ['show-ref', '--verify', '--quiet', `refs/heads/${dev}`]);
  if (!exists.error && exists.status === 0) {
    const out = gitRun(root, ['checkout', dev]);
    if (out.error || out.status !== 0) {
      return { ok: false, action: 'error', branch: dev, detail: `\`git checkout ${dev}\` failed: ${(out.stderr || '').trim() || 'unknown error'}` };
    }
    return { ok: true, action: 'checked-out', branch: dev, detail: `the working copy stands on ${dev}` };
  }

  const status = gitRun(root, ['status', '--porcelain']);
  if (status.error || status.status !== 0) {
    return { ok: false, action: 'error', branch: null, detail: `\`git status\` failed: ${(status.stderr || '').trim() || 'unknown error'}` };
  }
  if ((status.stdout || '').trim() !== '') {
    return { ok: false, action: 'dirty', branch: null, detail: `the working tree is dirty: ${dev} is created identical to production, and uncommitted work is not carried onto it. Commit or stash, then relaunch` };
  }

  // Identical to production where production stands and is known; otherwise to the current HEAD.
  const hasProd = prod ? gitRun(root, ['show-ref', '--verify', '--quiet', `refs/heads/${prod}`]) : null;
  const start = prod && hasProd && hasProd.status === 0 ? prod : 'HEAD';
  const created = gitRun(root, ['checkout', '-b', dev, ...(start === 'HEAD' ? [] : [start])]);
  if (created.error || created.status !== 0) {
    return { ok: false, action: 'error', branch: null, detail: `\`git checkout -b ${dev}\` failed: ${(created.stderr || '').trim() || 'unknown error'}` };
  }
  return { ok: true, action: 'created', branch: dev, detail: `${dev} created and checked out` };
}

/* ------------------------------------------------------------------------- *
 * The bench — real Git, on throwaway repositories under the system temp dir
 * ------------------------------------------------------------------------- */

function commitAll(repo, message) {
  spawnSync('git', ['-C', repo, 'add', '-A'], { encoding: 'utf-8' });
  spawnSync('git', ['-C', repo, 'commit', '-m', message], {
    encoding: 'utf-8',
    env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@e', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@e' },
  });
}

function selfCheck() {
  const failed = [];
  let ran = 0;
  const check = (name, condition, detail) => {
    ran += 1;
    if (!condition) failed.push(detail ? `${name}: ${detail}` : name);
  };
  const base = mkdtempSync(join(tmpdir(), 'daiku-branch-'));
  const where = (name) => {
    const repo = join(base, name);
    const init = spawnSync('git', ['init', '-b', 'main', repo], { encoding: 'utf-8' });
    if (init.error || init.status !== 0) return null;
    return repo;
  };
  const currentBranch = (repo) => (spawnSync('git', ['-C', repo, 'symbolic-ref', '--short', 'HEAD'], { encoding: 'utf-8' }).stdout || '').trim();

  try {
    // No Git repository at all.
    const plain = mkdtempSync(join(base, 'plain-'));
    check('not-a-repo', run(plain, 'develop', 'main').action === 'not-a-repo');

    // A repository with no commit yet: it stops and declares.
    const empty = where('empty');
    if (!empty) {
      check('git-available', false, 'git could not create a repository');
    } else {
      check('git-available', true);
      const noc = run(empty, 'develop', 'main');
      check('no-commits: declared, not created', noc.ok === false && noc.action === 'no-commits');

      // A repository with a commit: the branch is created and checked out.
      writeFileSync(join(empty, 'a.txt'), 'a\n');
      commitAll(empty, 'first');
      const created = run(empty, 'develop', 'main');
      check('clean tree: created', created.ok === true && created.action === 'created', JSON.stringify(created));
      check('after creation the copy stands on the branch', currentBranch(empty) === 'develop');

      // Idempotent relaunch: the branch exists, it is checked out, even with a dirty tree.
      writeFileSync(join(empty, 'a.txt'), 'a changed\n');
      const again = run(empty, 'develop', 'main');
      check('relaunch with the branch there: checked out, not failed on dirt', again.ok === true && again.action === 'checked-out', JSON.stringify(again));

      // The two channels coincide: nothing to do.
      const same = run(empty, 'main', 'main');
      check('development equals production: skip', same.ok === true && same.action === 'skip', JSON.stringify(same));
    }

    // A dirty tree at creation fails.
    const dirty = where('dirty');
    if (dirty) {
      writeFileSync(join(dirty, 'a.txt'), 'a\n');
      commitAll(dirty, 'first');
      writeFileSync(join(dirty, 'a.txt'), 'changed\n');
      const out = run(dirty, 'develop', 'main');
      check('dirty tree at creation: failed, branch not created', out.action === 'dirty', JSON.stringify(out));
      check('dirty tree at creation: no branch left behind', spawnSync('git', ['-C', dirty, 'show-ref', '--verify', '--quiet', 'refs/heads/develop'], { encoding: 'utf-8' }).status !== 0);
    }

    // The base: created from production, not from whatever branch happens to be active.
    const based = where('based');
    if (based) {
      writeFileSync(join(based, 'a.txt'), 'a\n');
      commitAll(based, 'first');
      spawnSync('git', ['-C', based, 'branch', 'other'], { encoding: 'utf-8' });
      spawnSync('git', ['-C', based, 'checkout', 'other'], { encoding: 'utf-8' });
      writeFileSync(join(based, 'b.txt'), 'b\n');
      commitAll(based, 'only on other');
      const out = run(based, 'develop', 'main');
      const onProd = spawnSync('git', ['-C', based, 'rev-parse', '--verify', '--quiet', 'refs/heads/main'], { encoding: 'utf-8' }).stdout.trim();
      const onDev = spawnSync('git', ['-C', based, 'rev-parse', '--verify', '--quiet', 'refs/heads/develop'], { encoding: 'utf-8' }).stdout.trim();
      check('created from production, not from the active branch', out.action === 'created' && onDev === onProd && onDev !== '');
      check('the active branch is not carried onto the new branch', spawnSync('git', ['-C', based, 'cat-file', '-e', 'develop:b.txt'], { encoding: 'utf-8' }).status !== 0);
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }

  process.stdout.write(JSON.stringify({ checks: ran, passed: ran - failed.length, failed }, null, 2) + '\n');
  return failed.length ? 1 : 0;
}

/* ------------------------------------------------------------------------- *
 * Entry
 * ------------------------------------------------------------------------- */

function invokedDirectly() {
  try {
    const launched = process.argv[1];
    if (!launched) return true;
    return fileURLToPath(import.meta.url).toLowerCase() === launched.toLowerCase();
  } catch {
    return true;
  }
}

if (invokedDirectly()) {
  const argv = process.argv.slice(2);
  if (argv[0] === '--self-check') process.exit(selfCheck());
  const [root, development, production] = argv;
  if (!root || !development) {
    process.stderr.write('usage: node branch.mjs <technical-root> <development> [<production>]\n       node branch.mjs --self-check\n');
    process.exit(2);
  }
  process.stdout.write(JSON.stringify(run(root, development, production)) + '\n');
  process.exit(0);
}
