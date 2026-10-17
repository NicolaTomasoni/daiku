#!/usr/bin/env node
/**
 * The disk side of one question about a chain: has this folder already been delivered?
 *
 * A folder's state is the artefacts it carries, and the chain orders itself on them (`question:
 * "order"`). But the artefacts that prove the delivery — `3. memory-report.md`, `4.
 * review-notes.md`, `5. review-report.md` — are written in the main tree and **committed by
 * nobody**: the three groups of the commit convention are code, memory/documentation and version,
 * and the feature folder is in none of them, so those files live as untracked work that a stash, a
 * `clean` or a checkout takes away without a trace. When they go, the folder reads again as «the
 * problem is written, the decisions are taken, the brief is written, nothing was ever executed»,
 * and a resume orders `execute` on work that is already integrated. That is how a feature came to
 * be built twice — once on 3 October, and again on the 16th on a second, independent
 * implementation of the same thing.
 *
 * The proof that the first of the two landed was in Git the whole time, and nobody asked for it:
 * § *6b. Merge* of `skills/ship-feature/SKILL.md` merges with `-m "merge: <folder>"`, so the
 * integration branch carries a commit whose **subject names the folder**. This program is what
 * reads it. It is a program and not a line of prose because a measurement an agent performs and
 * reports is a declaration, while one a program performs is a measurement — and the failure this
 * closes is precisely an agent that did not look.
 *
 * **It measures, and it decides nothing.** It returns the sha of that merge; what the chain does
 * with it is `question: "order"`'s business, and `order` stops where this program found one.
 *
 *   node <package-root>/architect/delivered.mjs <package-root>
 *       one JSON object on stdin — `action` (`"delivered"`), `work_root`, `folder` and
 *       `integration` — one on stdout, exit 0:
 *       `{"ok": true, "delivered": "<sha>" | null, "folder": "<slug>", "integration": "<ref>",
 *       "detail": "<what was read>"}`.
 *
 *   node <package-root>/architect/delivered.mjs --self-check <package-root>
 *       the bench, on throwaway Git repositories under the system temp directory. Counted JSON
 *       `{checks, passed, failed[]}` on stdout, exit 1 on the first red. `hooks/self-check.mjs`
 *       launches it.
 *
 * Like the other programs of `architect/` it **fails loudly**: a missing or malformed input, or an
 * `integration` ref that does not resolve, is an error and exit 2, never a silent `null` — because
 * «the folder never landed» and «the ref could not be read» are the same answer only if nobody is
 * told which one it was, and reading the second as the first is what lets a resume redo the work.
 *
 * **The limit this reading declares.** It matches the *subject* of a commit and not the shape of
 * the commit: a commit that is not a merge carrying exactly that subject would be read as a
 * delivery. The subject is the product's own convention and nothing else writes it, so the reading
 * is taken for what it is worth — and it errs the other way, which is the direction that costs: a
 * merge written with another subject is not found, and a chain that does not stop is a chain that
 * re-executes. The chain's own answer to a folder the owner meant to reopen is a new folder.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

/* ------------------------------------------------------------------------- *
 * Input
 * ------------------------------------------------------------------------- */

class BadInput extends Error {}

function fail(message) {
  throw new BadInput(message);
}

const slashed = (path) => String(path).split('\\').join('/');

function text(input, key) {
  const value = input[key];
  if (typeof value !== 'string' || !value.trim()) fail(`${key} is required and must be a non-empty string`);
  return value.trim();
}

/** The work root, absolute and present on disk: the Git commands of the measure run there. */
function workRootOf(input, root) {
  const cleaned = text(input, 'work_root').replace(/\\/g, '/');
  const absolute = /^[A-Za-z]:/.test(cleaned) || cleaned.startsWith('/') ? resolve(cleaned) : resolve(root, cleaned);
  if (!existsSync(absolute)) fail(`work_root does not resolve on disk: ${slashed(absolute)}`);
  return absolute;
}

/** The characters a slug is made of: the merge subject carries the folder's last segment. */
const SLUG = /^[A-Za-z0-9._-]+$/;

/**
 * The slug a folder is searched by — the last segment of whatever form the caller handed over: a
 * path `.daiku/features/<slug>`, an absolute one, or the slug alone. It is the segment the merge
 * subject carries, and reading it there is what makes the search independent of how the folder was
 * spelled.
 */
function slugOf(value) {
  if (typeof value !== 'string' || !value.trim()) fail('folder is required: the feature folder, or its slug');
  const cleaned = value.trim().replace(/\\/g, '/').replace(/\/+$/, '');
  const slug = cleaned.split('/').filter(Boolean).pop();
  if (!slug || !SLUG.test(slug)) fail(`folder does not name a slug this program can search for: ${JSON.stringify(value)}`);
  return slug;
}

/** The slug as a literal inside the pattern: of the characters a slug admits, only `.` is a metacharacter. */
const literal = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function git(cwd, args) {
  const run = spawnSync('git', ['-c', 'core.quotePath=false', ...args], {
    cwd,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (run.error) {
    fail(`git cannot start (${run.error.message}): this tool reads the disk through git, which must be on the PATH`);
  }
  return {
    status: typeof run.status === 'number' ? run.status : 1,
    out: (run.stdout || '').trim(),
    err: (run.stderr || '').trim(),
  };
}

/* ------------------------------------------------------------------------- *
 * The measure
 * ------------------------------------------------------------------------- */

/** The separator between the two fields of the format: no commit message carries it. */
const SEP = '\u001f';

/**
 * The merge that already carries `slug` on `integration`, or `null`.
 *
 * The ref is resolved first, and one that does not resolve is a loud failure: the two readings this
 * program can give must never collapse into the same answer. The search is line-anchored, so the
 * subject is matched whole — a longer folder name is not this folder — and `-1` takes the most
 * recent, which is the delivery that landed last.
 */
function delivered(input, root) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('the input must be a JSON object');
  if (input.action !== 'delivered') {
    fail(`action is required and must be "delivered", got ${JSON.stringify(input.action)}`);
  }
  const workRoot = workRootOf(input, root);
  const slug = slugOf(input.folder);
  const integration = text(input, 'integration');

  const ref = git(workRoot, ['rev-parse', '--verify', '--quiet', `${integration}^{commit}`]);
  if (ref.status !== 0 || !ref.out) {
    fail(
      `integration does not resolve to a commit in ${slashed(workRoot)}: ${JSON.stringify(integration)}` +
        `${ref.err ? ` (${ref.err})` : ''}`
    );
  }

  const found = git(workRoot, [
    'log',
    '-1',
    `--format=%H${SEP}%s`,
    '--extended-regexp',
    `--grep=^merge: (.+/)?${literal(slug)}$`,
    ref.out,
  ]);
  if (!found.out) {
    return {
      ok: true,
      delivered: null,
      folder: slug,
      integration,
      detail:
        `no commit on ${integration} carries "merge: ${slug}" as its subject: nothing on that branch says this ` +
        'folder has already landed, and this program stops no chain.',
    };
  }
  const [sha, subject] = found.out.split(SEP);
  return {
    ok: true,
    delivered: sha,
    folder: slug,
    integration,
    detail: `the folder ${slug} already landed on ${integration} at ${String(sha).slice(0, 7)}: "${subject}".`,
  };
}

/* ------------------------------------------------------------------------- *
 * Test bench
 * ------------------------------------------------------------------------- */

const ROOT = 'C:/pkg';

function report(checks, failed) {
  process.stdout.write(JSON.stringify({ checks: checks.length, passed: checks.length - failed.length, failed }, null, 2) + '\n');
  return failed.length ? 1 : 0;
}

function selfCheck() {
  const checks = [];
  const failed = [];
  const check = (name, condition, detail) => {
    checks.push(name);
    if (!condition) failed.push(detail ? `${name}: ${detail}` : name);
  };
  const call = (input) => delivered(JSON.parse(JSON.stringify(input)), ROOT);
  const refused = (name, input, because) => {
    try {
      call(input);
      check(name, false, 'it answered instead of failing loudly');
    } catch (error) {
      const ok = error instanceof BadInput && String(error.message).includes(because);
      check(name, ok, ok ? '' : `refused for another reason: ${error.message}`);
    }
  };

  const gitOk = spawnSync('git', ['--version'], { encoding: 'utf-8' });
  if (gitOk.error || gitOk.status !== 0) {
    check('bench:git-on-the-path', false, 'git is not on the PATH: this bench runs real Git on throwaway repositories');
    return report(checks, failed);
  }

  const home = mkdtempSync(join(tmpdir(), 'daiku-delivered-bench-'));
  const sh = (cwd, args) => {
    const run = spawnSync('git', ['-c', 'core.quotePath=false', ...args], { cwd, encoding: 'utf-8' });
    if (run.status !== 0) throw new Error(`git ${args.join(' ')}: ${(run.stderr || '').trim()}`);
    return (run.stdout || '').trim();
  };
  const put = (file, content) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content, 'utf-8');
  };

  /** A repository on `main`, and the one way a delivery writes a merge: `-m "merge: <folder>"`. */
  const repo = (name) => {
    const dir = join(home, name);
    mkdirSync(dir, { recursive: true });
    sh(dir, ['init', '-q', '-b', 'main']);
    sh(dir, ['config', 'user.email', 'bench@example.invalid']);
    sh(dir, ['config', 'user.name', 'bench']);
    sh(dir, ['config', 'commit.gpgsign', 'false']);
    put(join(dir, 'a.txt'), 'a\n');
    sh(dir, ['add', '-A']);
    sh(dir, ['commit', '-q', '-m', 'base']);
    return {
      dir,
      /** One commit on a fresh branch, merged into `onto` with `subject`: the delivery's merge, and its sha. */
      mergeWith: (subject, onto = 'main') => {
        const branch = `b${Math.random().toString(36).slice(2, 10)}`;
        sh(dir, ['checkout', '-q', '-b', branch]);
        put(join(dir, 'a.txt'), `${branch}\n`);
        sh(dir, ['add', '-A']);
        sh(dir, ['commit', '-q', '-m', 'work']);
        sh(dir, ['checkout', '-q', onto]);
        sh(dir, ['merge', '-q', '--no-ff', '-m', subject, branch]);
        return sh(dir, ['rev-parse', 'HEAD']);
      },
      sha: () => sh(dir, ['rev-parse', 'HEAD']),
    };
  };

  try {
    /* --- the merge the delivery writes is found, however the folder is spelled --- */
    const one = repo('one');
    const sha = one.mergeWith('merge: .daiku/features/rosso-del-gate');
    const found = call({ action: 'delivered', work_root: one.dir, folder: '.daiku/features/rosso-del-gate', integration: 'main' });
    check('the merge naming the folder is found', found.delivered === sha, `got ${JSON.stringify(found.delivered)}`);
    check('and the answer names the slug it searched', found.folder === 'rosso-del-gate');
    check('and the answer says which branch it read', found.integration === 'main');
    check('and the detail names the subject it read', String(found.detail).includes('merge: .daiku/features/rosso-del-gate'));
    check('the slug alone finds the same merge', call({ action: 'delivered', work_root: one.dir, folder: 'rosso-del-gate', integration: 'main' }).delivered === sha);
    check('a trailing separator does not hide it', call({ action: 'delivered', work_root: one.dir, folder: '.daiku/features/rosso-del-gate/', integration: 'main' }).delivered === sha);
    check('a backslash spelling does not hide it', call({ action: 'delivered', work_root: one.dir, folder: '.daiku\\features\\rosso-del-gate', integration: 'main' }).delivered === sha);

    /* --- a folder that never landed, and the subject matched whole --- */
    const other = call({ action: 'delivered', work_root: one.dir, folder: '.daiku/features/altro-lavoro', integration: 'main' });
    check('another folder is not found', other.delivered === null);
    check('and the answer still says what it searched', String(other.detail).includes('altro-lavoro'));
    const longer = repo('longer');
    longer.mergeWith('merge: .daiku/features/rosso-del-gate-e-ancora');
    check(
      'a longer name is not read as this folder',
      call({ action: 'delivered', work_root: longer.dir, folder: '.daiku/features/rosso-del-gate', integration: 'main' }).delivered === null
    );
    const bare = repo('bare');
    bare.mergeWith('merge: rosso-del-gate');
    check(
      'a merge whose subject carries the slug alone is found',
      call({ action: 'delivered', work_root: bare.dir, folder: '.daiku/features/rosso-del-gate', integration: 'main' }).delivered === bare.sha()
    );
    const plain = repo('plain');
    check(
      'a repository with no merge at all answers null',
      call({ action: 'delivered', work_root: plain.dir, folder: 'qualsiasi', integration: 'main' }).delivered === null
    );

    /* --- a merge standing on another branch is not landed on this one --- */
    const sideways = repo('sideways');
    sh(sideways.dir, ['checkout', '-q', '-b', 'side']);
    const sideSha = sideways.mergeWith('merge: .daiku/features/rosso-del-gate', 'side');
    check(
      'a merge standing on another branch is not read as landed here',
      call({ action: 'delivered', work_root: sideways.dir, folder: 'rosso-del-gate', integration: 'main' }).delivered === null
    );
    check(
      'and the branch that carries it is read',
      call({ action: 'delivered', work_root: sideways.dir, folder: 'rosso-del-gate', integration: 'side' }).delivered === sideSha
    );

    /* --- fail loudly: never a silent null where the reading failed --- */
    refused(
      'an integration ref that does not resolve is refused',
      { action: 'delivered', work_root: one.dir, folder: 'rosso-del-gate', integration: 'ghost' },
      'integration does not resolve'
    );
    refused('a work root that does not exist is refused', { action: 'delivered', work_root: join(home, 'ghost'), folder: 'x', integration: 'main' }, 'work_root does not resolve');
    refused('a missing folder is refused', { action: 'delivered', work_root: one.dir, integration: 'main' }, 'folder is required');
    refused('an unknown action is refused', { action: 'invented', work_root: one.dir, folder: 'x', integration: 'main' }, 'action is required');
    refused('a non-object input is refused', null, 'the input must be a JSON object');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }

  return report(checks, failed);
}

/* ------------------------------------------------------------------------- *
 * Invocation
 * ------------------------------------------------------------------------- */

function die(reason) {
  process.stderr.write(`delivered: ${reason}\n`);
  process.stderr.write(
    '  If this line is here, node ran: the input is malformed — the message above names which.\n' +
      '  If instead no line ever arrives, node is not on the PATH. This program exits non-zero and\n' +
      '  never falls back to a silent success.\n'
  );
  process.exit(2);
}

function main() {
  const argv = process.argv.slice(2);
  const bench = argv[0] === '--self-check';
  const root = bench ? argv[1] : argv[0];
  if (!root) {
    process.stderr.write('usage: node delivered.mjs <package-root>\n');
    process.stderr.write('       node delivered.mjs --self-check <package-root>\n');
    process.exit(2);
  }
  if (bench) process.exit(selfCheck());
  let result;
  try {
    const raw = readFileSync(0, 'utf-8');
    if (!raw.trim()) fail('stdin is empty: one JSON object is required');
    let input;
    try {
      input = JSON.parse(raw);
    } catch (error) {
      fail(`stdin is not valid JSON (${error.message})`);
    }
    result = delivered(input, resolve(root));
  } catch (error) {
    die(error && error.message ? error.message : String(error));
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(0);
}

main();
