#!/usr/bin/env node
/**
 * The disk side of Daiku's merge reconciliation.
 *
 * `architect/architect.mjs` answers and opens no file of the project: everything it needs to
 * know about the disk the agent hands it. This program is the other half, and that is why it is
 * a separate file: it **reads Git, writes the patch artefact and lands the merge**, which the
 * evaluator by principle never does. What it measures — the merge base, the obstructed paths,
 * the lines each side changes, the working tree's uncommitted work — it measures on the disk;
 * the one verdict it returns, whether the two sides can be kept together, it asks of the
 * evaluator in-process, through the same entry the evaluator's own command uses, importing it
 * instead of copying it.
 *
 * It exists because the reconciliation of a merge obstructed by another session's uncommitted
 * work — or gone into conflict — was prose no step could perform: the delivery only knew how to
 * abort. A measurement an agent performs and reports is a declaration; one a program performs
 * is a measurement.
 *
 * Like the evaluator it **fails loudly**: a missing or malformed input is an error and exit 2,
 * never a silent success, and it lands a merge only when the measure holds — a union of two
 * sides that touch the same lines is a choice with tradeoff, and it is not taken here.
 *
 *   node <package-root>/architect/reconcile.mjs <package-root>
 *       one JSON object on stdin — `action` plus that action's keys — one on stdout, exit 0.
 *
 *   node <package-root>/architect/reconcile.mjs --self-check <package-root>
 *       the bench, on throwaway Git repositories under the system temp directory. Counted JSON
 *       `{checks, passed, failed[]}` on stdout, exit 1 on the first red. `hooks/self-check.mjs`
 *       launches it.
 *
 * What it writes, and nothing else: the patch artefact in the file the caller names, written
 * through a throwaway index (`GIT_INDEX_FILE`) seeded from the real one, so the real index and
 * the working tree are never touched; the merge it lands, on the branch; and Git objects.
 *
 * The prose of its actions — when each is called, what it takes and what it returns — lives in
 * the skill hosting it, `skills/reconcile/SKILL.md`.
 */

import { spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { BadInput, dispatch as ask } from './architect.mjs';

/* ------------------------------------------------------------------------- *
 * Input
 * ------------------------------------------------------------------------- */

const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value) => typeof value === 'string' && value.trim() !== '';
const slashed = (path) => path.split('\\').join('/');
const lines = (text) => text.split(/\r?\n/).filter((line) => line !== '');

function fail(message) {
  throw new BadInput(message);
}

function text(input, key) {
  if (!nonEmpty(input[key])) fail(`${key} is required and must be a non-empty string`);
  return input[key];
}

function workRootOf(input) {
  const root = resolve(text(input, 'work_root'));
  if (!existsSync(root)) fail(`work_root ${JSON.stringify(input.work_root)} does not exist`);
  return root;
}

/* ------------------------------------------------------------------------- *
 * Git — every read of the disk goes through here
 * ------------------------------------------------------------------------- */

function git(cwd, args, env) {
  const run = spawnSync('git', ['-c', 'core.quotePath=false', ...args], {
    cwd, encoding: 'utf-8', env: env || process.env, maxBuffer: 512 * 1024 * 1024,
  });
  if (run.error) fail(`git cannot start (${run.error.message}): this tool reads the disk through git, which must be on the PATH`);
  if (run.status !== 0) fail(`git ${args.join(' ')} failed in ${slashed(cwd)}: ${(run.stderr || '').trim()}`);
  return run.stdout;
}

/** Git prints paths from the repository root; the contracts speak from the technical root. */
function localizer(cwd) {
  const prefix = git(cwd, ['rev-parse', '--show-prefix']).trim();
  const depth = prefix.split('/').filter(Boolean).length;
  return (path) => (path.startsWith(prefix) ? path.slice(prefix.length) : `${'../'.repeat(depth)}${path}`);
}

/** The `.git` path of `MERGE_HEAD`, resolved against the technical root: present means a merge is under way. */
function mergeHeadPath(cwd) {
  return resolve(cwd, git(cwd, ['rev-parse', '--git-path', 'MERGE_HEAD']).trim());
}

const inMerge = (cwd) => existsSync(mergeHeadPath(cwd));

/** The paths the working tree holds modified, added or untracked, as git reports them. */
function dirtyPaths(cwd) {
  return lines(git(cwd, ['status', '--porcelain', '--untracked-files=all'])).map((line) => {
    const rest = line.slice(3);
    const arrow = rest.lastIndexOf(' -> ');
    return (arrow >= 0 ? rest.slice(arrow + 4) : rest).replace(/^"|"$/g, '');
  });
}

const untrackedPaths = (cwd) =>
  lines(git(cwd, ['status', '--porcelain', '--untracked-files=all']))
    .filter((line) => line.startsWith('??'))
    .map((line) => line.slice(3).replace(/^"|"$/g, ''));

/**
 * The line intervals a `git diff -U0` changes, in the frame of its **left** side, read from the
 * hunk headers: `@@ -a,b +c,d @@` is `[a, a+b-1]` when `b > 0`. A pure insertion (`b == 0`)
 * changes no line of the left side, and is anchored to its boundary point: `[a, a]`, or `[1, 1]`
 * when the insertion is a whole new file (`a == 0`).
 *
 * An insertion carries a third element, `'insert'`, because it is not the same thing as a change
 * of the line it is anchored to: two insertions at the same boundary both survive the union — they
 * are two lines added, and keeping both loses nothing. The tag is what lets the evaluator tell the
 * two apart; without it the boundary point of an insertion and a change of that same line look
 * alike, and the answer errs toward asking the owner where there is nothing to decide.
 */
function intervalsOf(diffText) {
  const out = [];
  for (const found of diffText.matchAll(/^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/gm)) {
    const from = Number(found[1]);
    const count = found[2] === undefined ? 1 : Number(found[2]);
    if (count > 0) out.push([from, from + count - 1]);
    else out.push(from > 0 ? [from, from, 'insert'] : [1, 1, 'insert']);
  }
  return out;
}

/** The lines the working tree changes against the merge base; an untracked file is a creation. */
function oursOf(cwd, base, path, merging, untracked) {
  if (!merging && untracked) return [[1, 1]];
  const args = merging ? ['diff', '-U0', base, 'HEAD', '--', path] : ['diff', '-U0', base, '--', path];
  return intervalsOf(git(cwd, args));
}

/** The lines the branch changes against the merge base. */
function theirsOf(cwd, base, branch, path) {
  return intervalsOf(git(cwd, ['diff', '-U0', base, branch, '--', path]));
}

/**
 * The patch artefact: the working tree's uncommitted work — tracked modifications and untracked
 * files — as a patch against `HEAD`, written through a throwaway index so the real one and the
 * working tree are never touched. Same trick as `architect/ledger.mjs`: the copy keeps the real
 * index's modification time, or git would trust a stale cached stat over a fresh edit.
 */
function writePatch(cwd, patchPath) {
  const dir = mkdtempSync(join(tmpdir(), 'daiku-reconcile-index-'));
  const index = join(dir, 'index');
  try {
    const real = resolve(cwd, git(cwd, ['rev-parse', '--git-path', 'index']).trim());
    if (existsSync(real)) {
      const stamp = statSync(real);
      copyFileSync(real, index);
      utimesSync(index, stamp.atime, stamp.mtime);
    }
    const env = { ...process.env, GIT_INDEX_FILE: index };
    git(cwd, ['add', '-A', '--', '.'], env);
    const diff = git(cwd, ['diff', '--cached', '--binary', 'HEAD', '--', '.'], env);
    mkdirSync(dirname(patchPath), { recursive: true });
    writeFileSync(patchPath, diff, 'utf-8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The obstructed set: the unmerged paths of a merge in progress, or the dirty paths the branch also touches. */
function obstructedOf(cwd, base, branch, merging, local) {
  if (merging) {
    return lines(git(cwd, ['diff', '--name-only', '--diff-filter=U'])).map(local).sort();
  }
  const byBranch = new Set(lines(git(cwd, ['diff', '--name-only', `${base}..${branch}`])).map(local));
  const dirty = new Set(dirtyPaths(cwd).map(local));
  return [...byBranch].filter((path) => dirty.has(path)).sort();
}

/* ------------------------------------------------------------------------- *
 * The actions
 * ------------------------------------------------------------------------- */

/** `measure` — § *How you verify*: save the work, measure the overlap, return the evaluator's verdict. */
function actMeasure(input, root) {
  const workRoot = workRootOf(input);
  const branch = text(input, 'branch');
  const patchPath = resolve(workRoot, text(input, 'patch'));
  git(workRoot, ['rev-parse', '--verify', `${branch}^{commit}`]); // a branch that does not resolve is a loud failure
  const head = git(workRoot, ['rev-parse', 'HEAD']).trim();
  const base = git(workRoot, ['merge-base', 'HEAD', branch]).trim();
  const merging = inMerge(workRoot);
  const local = localizer(workRoot);

  const obstructed = obstructedOf(workRoot, base, branch, merging, local);
  writePatch(workRoot, patchPath);

  const untracked = new Set(untrackedPaths(workRoot).map(local));
  const paths = obstructed.map((file) => ({
    file,
    ours: oursOf(workRoot, base, file, merging, untracked.has(file)),
    theirs: theirsOf(workRoot, base, branch, file),
  }));
  const verdict = ask({ question: 'reconcile', paths }, root);
  const overlap = verdict.blockers;
  const overlapSet = new Set(overlap);
  return {
    ok: true,
    verdict: verdict.verdict,
    overlap,
    disjoint: paths.map((entry) => entry.file).filter((file) => !overlapSet.has(file)),
    patch: slashed(patchPath),
    branch,
    base,
    commit: head,
    detail: verdict.detail,
  };
}

/** The content of an index stage, or the empty string when the stage does not exist (an add/add has no base). */
function stageOf(cwd, spec) {
  const run = spawnSync('git', ['-c', 'core.quotePath=false', 'show', spec], { cwd, encoding: 'utf-8', maxBuffer: 512 * 1024 * 1024 });
  return run.status === 0 ? run.stdout : '';
}

/** The paths git left unmerged in the index, whichever step left them. */
const unmergedOf = (cwd) =>
  lines(git(cwd, ['diff', '--name-only', '--diff-filter=U'])).map(localizer(cwd));

/**
 * The two sides of an unmerged path, read from its index stages: `:1:` is the base, `:2:` the
 * current side, `:3:` the side being brought in. The intervals are measured against the base file
 * itself, which is the frame the evaluator's rule is written in — the same measurement whether the
 * conflict came from a merge in progress or from an autostash reapplied on top of it.
 */
function writeStages(workRoot, file, dir) {
  const at = (name) => join(dir, name);
  writeFileSync(at('base'), stageOf(workRoot, `:1:./${file}`), 'utf-8');
  writeFileSync(at('ours'), stageOf(workRoot, `:2:./${file}`), 'utf-8');
  writeFileSync(at('theirs'), stageOf(workRoot, `:3:./${file}`), 'utf-8');
  return at;
}

function sidesOf(workRoot, file, dir) {
  const at = writeStages(workRoot, file, dir);
  const between = (a, b) => {
    const run = spawnSync('git', ['diff', '--no-index', '-U0', '--', a, b], { encoding: 'utf-8', maxBuffer: 512 * 1024 * 1024 });
    return run.stdout || '';
  };
  return {
    ours: intervalsOf(between(at('base'), at('ours'))),
    theirs: intervalsOf(between(at('base'), at('theirs'))),
  };
}

/**
 * Resolve the unmerged paths by composing each as the **union** of its two disjoint sides, and
 * `git commit --no-edit` when a merge is in progress. It re-asks the evaluator before writing: a
 * file whose two sides touch the same lines is a choice with tradeoff, and this program never
 * takes it — it fails loudly and leaves the decision to the owner.
 *
 * It composes whatever is unmerged, not only a merge in progress: a `--autostash` whose reapply
 * conflicts leaves the merge committed and the working tree's work conflicted on top of it, with
 * no `MERGE_HEAD` — and that is the ordinary case of two sides that add distinct lines, which both
 * have to survive. Composing is the whole point: the delivery never stops on it, and reports it.
 */
function composeUnmerged(workRoot, root, commit) {
  const unmerged = unmergedOf(workRoot);
  const dir = mkdtempSync(join(tmpdir(), 'daiku-reconcile-merge-'));
  try {
    const paths = unmerged.map((file) => ({ file, ...sidesOf(workRoot, file, dir) }));
    const verdict = ask({ question: 'reconcile', paths }, root);
    if (verdict.verdict !== 'reconcile') {
      fail(
        `the measure does not hold: ${verdict.blockers.join(', ') || 'a conflicted path'} is changed on the same lines ` +
          'by both sides, and a union there would be a choice with tradeoff — this program stops and the owner decides'
      );
    }
    for (const file of unmerged) {
      const at = writeStages(workRoot, file, dir);
      const union = spawnSync('git', ['merge-file', '-p', '--union', at('ours'), at('base'), at('theirs')], {
        encoding: 'utf-8', maxBuffer: 512 * 1024 * 1024,
      });
      if (union.error || union.status !== 0) {
        fail(`git merge-file --union failed on ${file}: ${(union.stderr || '').trim()}`);
      }
      const target = resolve(workRoot, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, union.stdout, 'utf-8');
      git(workRoot, ['add', '--', file]);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  if (commit) {
    const done = spawnSync('git', ['-c', 'core.quotePath=false', 'commit', '--no-edit'], { cwd: workRoot, encoding: 'utf-8' });
    if (done.error || done.status !== 0) fail(`git commit --no-edit failed composing the merge: ${(done.stderr || '').trim()}`);
  }
  return unmerged;
}

/** `merge` — § *What it does*: land the merge keeping both sides, on a dirty tree or a merge in progress. */
function actMerge(input, root) {
  const workRoot = workRootOf(input);
  const branch = text(input, 'branch');
  const message = text(input, 'message');
  git(workRoot, ['rev-parse', '--verify', `${branch}^{commit}`]);

  if (inMerge(workRoot)) {
    composeUnmerged(workRoot, root, true);
    const sha = git(workRoot, ['rev-parse', 'HEAD']).trim();
    return { ok: true, merged: true, merge_sha: sha, detail: `the obstructed merge was reconciled keeping both sides: ${sha.slice(0, 7)}.` };
  }

  const run = spawnSync('git', ['-c', 'core.quotePath=false', 'merge', '--no-ff', '--autostash', branch, '-m', message], {
    cwd: workRoot, encoding: 'utf-8', maxBuffer: 512 * 1024 * 1024,
  });
  if (run.error) fail(`git cannot start (${run.error.message}): this tool reads the disk through git, which must be on the PATH`);
  if (run.status === 0) {
    const sha = git(workRoot, ['rev-parse', 'HEAD']).trim();
    // `git merge` exits 0 even when the autostash came back conflicted: the merge landed and what is
    // left unmerged is the working tree's own work, waiting to be kept. That is not a failure and not
    // a stop — it is the ordinary case of two sides that added distinct lines, and it is composed here.
    if (unmergedOf(workRoot).length) {
      const composed = composeUnmerged(workRoot, root, false);
      return {
        ok: true, merged: true, merge_sha: sha,
        detail: `merged with --no-ff --autostash: the branch is integrated (${sha.slice(0, 7)}) and the working tree's ` +
          `work conflicted on top of it, then was composed keeping both sides and left uncommitted: ${composed.join(', ')}.`,
      };
    }
    return {
      ok: true, merged: true, merge_sha: sha,
      detail: `merged with --no-ff --autostash: the branch is integrated and the working tree's work is re-applied uncommitted (${sha.slice(0, 7)}).`,
    };
  }
  if (inMerge(workRoot)) {
    composeUnmerged(workRoot, root, true);
    const sha = git(workRoot, ['rev-parse', 'HEAD']).trim();
    return { ok: true, merged: true, merge_sha: sha, detail: `the merge conflicted although the measure held, and was composed keeping both sides: ${sha.slice(0, 7)}.` };
  }
  // The merge landed and what is left unmerged is the working tree's own work, whose reapplication
  // on top of it conflicted — the ordinary case of two sides that add distinct lines. It is composed
  // and left in the tree uncommitted, exactly as it was: the merge is done, nothing of the other
  // session's work is committed, and it is git's own autostash entry that still holds the copy.
  if (unmergedOf(workRoot).length) {
    const composed = composeUnmerged(workRoot, root, false);
    const sha = git(workRoot, ['rev-parse', 'HEAD']).trim();
    return {
      ok: true, merged: true, merge_sha: sha,
      detail: `merged with --no-ff --autostash: the branch is integrated (${sha.slice(0, 7)}) and the working tree's work ` +
        `was composed keeping both sides, left uncommitted: ${composed.join(', ')}.`,
    };
  }
  fail(`git merge of ${branch} failed and left no merge in progress: ${(run.stderr || '').trim()}`);
}

const ACTIONS = {
  measure: actMeasure,
  merge: actMerge,
};

function dispatch(input, root) {
  if (!isObject(input)) fail('stdin must carry one JSON object');
  if (!nonEmpty(input.action) || !has(ACTIONS, input.action)) {
    fail(`action is required and must be one of ${Object.keys(ACTIONS).join(', ')}, got ${JSON.stringify(input.action)}`);
  }
  return ACTIONS[input.action](input, root);
}

/* ------------------------------------------------------------------------- *
 * The bench — throwaway repositories, real Git, one proof per rule
 * ------------------------------------------------------------------------- */

const TEN = '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n';
/** The ten lines with the given (0-based) lines replaced. */
function ten(at) {
  const body = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  for (const [index, value] of Object.entries(at)) body[Number(index)] = value;
  return `${body.join('\n')}\n`;
}

function runBench(root) {
  const checks = [];
  const failed = [];
  const check = (name, ok, detail) => {
    checks.push(name);
    if (!ok) failed.push(detail ? `${name}: ${detail}` : name);
  };
  const call = (input) => dispatch(JSON.parse(JSON.stringify(input)), root);
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

  const home = mkdtempSync(join(tmpdir(), 'daiku-reconcile-bench-'));
  const sh = (cwd, args) => {
    const run = spawnSync('git', ['-c', 'core.quotePath=false', ...args], { cwd, encoding: 'utf-8' });
    if (run.status !== 0) throw new Error(`git ${args.join(' ')}: ${(run.stderr || '').trim()}`);
    return run.stdout;
  };
  const put = (file, content) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content, 'utf-8');
  };
  const readText = (file) => readFileSync(file, 'utf-8');

  /**
   * A repository whose technical root is its own root, with a `feature` branch to merge. The
   * fixture lines a side up: `base` on main, then a change committed on `feature`, then (per the
   * scenario) a change committed on main — a content conflict — or left uncommitted — a dirty tree.
   */
  const fixture = (name) => {
    const dir = join(home, name);
    const repo = join(dir, 'repo');
    mkdirSync(repo, { recursive: true });
    sh(repo, ['init', '-q', '-b', 'main']);
    sh(repo, ['config', 'user.email', 'bench@example.invalid']);
    sh(repo, ['config', 'user.name', 'bench']);
    sh(repo, ['config', 'commit.gpgsign', 'false']);
    put(join(repo, 'a.txt'), TEN);
    sh(repo, ['add', '-A']);
    sh(repo, ['commit', '-q', '-m', 'base']);
    sh(repo, ['branch', 'feature']);
    return {
      dir, repo,
      patch: join(dir, 'main-tree.patch'),
      head: () => sh(repo, ['rev-parse', 'HEAD']).trim(),
      read: (rel) => readText(join(repo, rel)),
      status: () => sh(repo, ['status', '--porcelain']),
      onFeature: (content) => {
        sh(repo, ['checkout', '-q', 'feature']);
        put(join(repo, 'a.txt'), content);
        sh(repo, ['add', '-A']);
        sh(repo, ['commit', '-q', '-m', 'feature']);
        sh(repo, ['checkout', '-q', 'main']);
      },
      /** A change committed on main, then the merge started: it goes into conflict if the sides overlap. */
      mainCommits: (content) => {
        put(join(repo, 'a.txt'), content);
        sh(repo, ['add', '-A']);
        sh(repo, ['commit', '-q', '-m', 'main']);
      },
      measure: (extra = {}) => call({ action: 'measure', work_root: repo, branch: 'feature', patch: join(dir, 'main-tree.patch'), ...extra }),
      merge: (extra = {}) => call({ action: 'merge', work_root: repo, branch: 'feature', message: 'merge: feature', ...extra }),
      startMerge: () => spawnSync('git', ['merge', '--no-ff', 'feature'], { cwd: repo, encoding: 'utf-8' }),
    };
  };

  try {
    /* --- measure: the dirty tree, disjoint or on the same line --- */
    attempt('measure-dirty-disjoint', () => {
      const fx = fixture('measure-dirty-disjoint');
      fx.onFeature(ten({ 1: '2F' })); // feature changed line 2
      put(join(fx.repo, 'a.txt'), ten({ 7: '8M' })); // main changed line 8, uncommitted
      const got = fx.measure();
      check('measure:a-dirty-tree-disjoint-is-reconcileable', got.ok === true && got.verdict === 'reconcile', JSON.stringify(got));
      check('measure:the-disjoint-paths-are-named', got.disjoint.includes('a.txt') && got.overlap.length === 0, JSON.stringify(got));
      check('measure:the-patch-artefact-is-written', existsSync(fx.patch) && readText(fx.patch).includes('8M'), 'the patch does not carry the working tree change');
    });

    attempt('measure-dirty-same-line', () => {
      const fx = fixture('measure-dirty-same-line');
      fx.onFeature(ten({ 4: '5F' })); // feature changed line 5
      put(join(fx.repo, 'a.txt'), ten({ 4: '5M' })); // main changed line 5, uncommitted
      const got = fx.measure();
      check('measure:a-dirty-tree-on-the-same-line-stops', got.verdict === 'stop', JSON.stringify(got));
      check('measure:the-overlap-names-the-file', got.overlap.includes('a.txt'), JSON.stringify(got));
    });

    attempt('measure-untracked-created-by-the-branch', () => {
      const fx = fixture('measure-untracked-created-by-the-branch');
      // the branch adds b.txt, and the working tree holds an untracked b.txt: an add/add
      sh(fx.repo, ['checkout', '-q', 'feature']);
      put(join(fx.repo, 'b.txt'), 'from the branch\n');
      sh(fx.repo, ['add', '-A']);
      sh(fx.repo, ['commit', '-q', '-m', 'feature adds b']);
      sh(fx.repo, ['checkout', '-q', 'main']);
      put(join(fx.repo, 'b.txt'), 'from the working tree\n');
      const got = fx.measure();
      check('measure:an-untracked-file-the-merge-would-create-is-obstructed', got.overlap.includes('b.txt'), JSON.stringify(got));
      check('measure:the-untracked-file-is-in-the-patch', readText(fx.patch).includes('from the working tree'), 'the patch does not carry the untracked file');
    });

    attempt('patch-real-index-untouched', () => {
      const fx = fixture('patch-real-index-untouched');
      fx.onFeature(ten({ 1: '2F' }));
      put(join(fx.repo, 'a.txt'), ten({ 7: '8M' })); // tracked modification
      put(join(fx.repo, 'new.txt'), 'brand new\n'); // untracked
      const index = resolve(fx.repo, sh(fx.repo, ['rev-parse', '--git-path', 'index']).trim());
      const before = readFileSync(index);
      fx.measure();
      const after = readFileSync(index);
      check('patch:helds-the-tracked-modification', readText(fx.patch).includes('+8M'), 'the tracked change is not in the patch');
      check('patch:helds-the-untracked-file', readText(fx.patch).includes('brand new'), 'the untracked file is not in the patch');
      check('patch:the-real-index-is-untouched', before.equals(after), 'the real index changed');
    });

    /* --- measure and merge: the conflict already in progress --- */
    attempt('conflict-disjoint', () => {
      const fx = fixture('conflict-disjoint');
      fx.onFeature(ten({ 2: '3F' })); // feature changed line 3
      fx.mainCommits(ten({ 3: '4M' })); // main changed the adjacent line 4 -> a real conflict, disjoint
      fx.startMerge();
      check('conflict:the-merge-is-in-progress', existsSync(mergeHeadPath(fx.repo)), 'the merge did not conflict');
      const got = fx.measure();
      check('conflict:disjoint-inside-the-conflict-is-reconcileable', got.verdict === 'reconcile', JSON.stringify(got));
      const landed = fx.merge();
      check('conflict:the-merge-completes', landed.ok === true && landed.merged === true && /^[0-9a-f]{40}$/.test(landed.merge_sha || ''), JSON.stringify(landed));
      check('conflict:both-sides-are-kept', fx.read('a.txt').includes('3F') && fx.read('a.txt').includes('4M'), fx.read('a.txt'));
      check('conflict:no-merge-is-left-in-progress', !existsSync(mergeHeadPath(fx.repo)), 'MERGE_HEAD is still there');
    });

    attempt('conflict-same-line', () => {
      const fx = fixture('conflict-same-line');
      fx.onFeature(ten({ 4: '5F' }));
      fx.mainCommits(ten({ 4: '5M' }));
      fx.startMerge();
      const got = fx.measure();
      check('conflict:the-same-line-on-both-sides-stops', got.verdict === 'stop', JSON.stringify(got));
      check('conflict:the-overlap-names-the-file', got.overlap.includes('a.txt'), JSON.stringify(got));
    });

    /* --- merge: --autostash keeps the working tree's work --- */
    attempt('merge-autostash', () => {
      const fx = fixture('merge-autostash');
      fx.onFeature(ten({ 1: '2F' }));
      put(join(fx.repo, 'a.txt'), ten({ 7: '8M' })); // ours, uncommitted
      const landed = fx.merge();
      check('autostash:the-merge-lands', landed.merged === true, JSON.stringify(landed));
      check('autostash:the-working-tree-work-survives-as-uncommitted', fx.read('a.txt').includes('2F') && fx.read('a.txt').includes('8M'), fx.read('a.txt'));
      check('autostash:our-change-is-still-uncommitted', fx.status().includes('a.txt'), fx.status());
    });

    /* --- refusals --- */
    refused('reject:measure-without-work-root', { action: 'measure', branch: 'feature', patch: 'p' }, 'work_root is required');
    refused('reject:measure-without-branch', { action: 'measure', work_root: '.', patch: 'p' }, 'branch is required');
    refused('reject:measure-without-patch', { action: 'measure', work_root: '.', branch: 'feature' }, 'patch is required');
    refused('reject:merge-without-message', { action: 'merge', work_root: '.', branch: 'feature' }, 'message is required');
    refused('reject:unknown-action', { action: 'invented' }, 'action is required');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
  return report(checks, failed);

  function attempt(name, fn) {
    try {
      fn();
    } catch (error) {
      check(name, false, `threw ${error && error.message}`);
    }
  }
}

function report(checks, failed) {
  process.stdout.write(`${JSON.stringify({ checks: checks.length, passed: checks.length - failed.length, failed })}\n`);
  process.exit(failed.length ? 1 : 0);
}

/* ------------------------------------------------------------------------- *
 * Invocation
 * ------------------------------------------------------------------------- */

function die(reason) {
  process.stderr.write(`reconcile: ${reason}\n`);
  process.stderr.write(
    '  If this line is here, node ran: the input is malformed, git refused a command, or the case is one\n' +
      '  the bench does not cover — the message above names which. If instead no line ever arrives, node\n' +
      '  is not on the PATH. This program exits non-zero and never falls back to a silent success.\n'
  );
  process.exit(2);
}

function main() {
  const argv = process.argv.slice(2);
  const selfCheck = argv[0] === '--self-check';
  const root = selfCheck ? argv[1] : argv[0];
  if (!root) {
    process.stderr.write('usage: node reconcile.mjs <package-root>\n');
    process.stderr.write('       node reconcile.mjs --self-check <package-root>\n');
    process.exit(2);
  }
  if (selfCheck) {
    runBench(root);
    return;
  }
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
    result = dispatch(input, root);
  } catch (error) {
    die(error && error.message ? error.message : String(error));
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(0);
}

main();
