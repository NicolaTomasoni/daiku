#!/usr/bin/env node
/**
 * The disk side of Daiku's worktree pool.
 *
 * `architect/architect.mjs` answers and opens no file of the project: everything it needs to
 * know about the disk the agent hands it. This program is the other half, and that is why it is
 * a separate file: it **reads Git, writes the registry and touches the pool**, which the
 * evaluator by principle never does. What it measures — which slots are registered, which of
 * them carry a clean tree, what the integration branch is — it measures on the disk; the one
 * verdict it returns, which slot a delivery takes, it asks of the evaluator in-process, through
 * the same entry the evaluator's own command uses, importing it instead of copying it.
 *
 * It exists because the pool was prose an agent followed by hand, and the prose carried a second
 * condition for «free» — the slot's HEAD equal to the integration branch's — that no slot ever
 * met: the cleanup leaves it exactly one commit behind, so the pool filled with clean, unusable
 * slots until the cap was reached and every new delivery stopped. A rule a program enforces is
 * the same rule every run; the registry it writes is the attribution the agent cannot re-derive
 * from Git — who took which slot, and whether that work ended.
 *
 * Like the evaluator it **fails loudly**: a missing or malformed input is an error and exit 2,
 * never a silent success, and it never writes a registry `schemas/blocks.json` § *pool* refuses.
 *
 *   node <package-root>/architect/pool.mjs <package-root>
 *       one JSON object on stdin — `action` plus that action's keys — one on stdout, exit 0.
 *
 *   node <package-root>/architect/pool.mjs --self-check <package-root>
 *       the bench, on throwaway Git repositories under the system temp directory. Counted JSON
 *       `{checks, passed, failed[]}` on stdout, exit 1 on the first red. `hooks/self-check.mjs`
 *       launches it.
 *
 * What it writes, and nothing else: the registry, in the file the caller names (`{paths.review_state}/worktree-pool.json`
 * by the skill's convention), the pool worktree Git creates or resets, and Git objects.
 *
 * The prose of its actions — when each is called, what it takes and what it returns — lives in
 * the skill hosting it, `skills/ship-feature/SKILL.md` § *Worktree pool*.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { BadInput, dispatch as ask } from './architect.mjs';

/* ------------------------------------------------------------------------- *
 * Input
 * ------------------------------------------------------------------------- */

const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value) => typeof value === 'string' && value.trim() !== '';
const slashed = (path) => path.split('\\').join('/');

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

/** Two paths name the same place: on win32 the comparison is case-insensitive. */
function samePath(one, other) {
  const a = slashed(resolve(one));
  const b = slashed(resolve(other));
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The moment the registry is stamped: ISO, to the second, in UTC. */
function iso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/* ------------------------------------------------------------------------- *
 * Git — every read of the disk goes through here
 * ------------------------------------------------------------------------- */

function git(cwd, args) {
  const run = spawnSync('git', ['-c', 'core.quotePath=false', ...args], {
    cwd, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024,
  });
  if (run.error) fail(`git cannot start (${run.error.message}): this tool reads the disk through git, which must be on the PATH`);
  if (run.status !== 0) fail(`git ${args.join(' ')} failed in ${slashed(cwd)}: ${(run.stderr || '').trim()}`);
  return run.stdout;
}

/**
 * The registered worktrees, each with the branch it holds, in the order Git lists them.
 * A detached worktree carries no branch and is listed all the same: it is registered.
 */
function worktreesOf(cwd) {
  const out = git(cwd, ['worktree', 'list', '--porcelain']);
  const found = [];
  let current = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current) found.push(current);
      current = { path: line.slice('worktree '.length).trim(), branch: '' };
    } else if (line.startsWith('branch ') && current) {
      current.branch = line.slice('branch '.length).trim();
    }
  }
  if (current) found.push(current);
  return found;
}

/**
 * The registered worktrees that are slots of this pool, in number order. `present` says
 * whether the directory is really there: a registration survives its directory — someone
 * deleting a slot by hand, to free space, leaves git listing it as `prunable` — and a slot
 * with no working tree is not one git can be asked anything about.
 */
function slotsOf(poolAbs, slotRe, worktrees) {
  const found = [];
  for (const worktree of worktrees) {
    const dir = resolve(worktree.path);
    if (!samePath(dirname(dir), poolAbs)) continue;
    const match = slotRe.exec(basename(dir));
    if (!match) continue;
    found.push({
      n: Number(match[1]), name: basename(dir), dir, present: existsSync(dir),
      branch: worktree.branch.replace(/^refs\/heads\//, ''),
    });
  }
  return found.sort((a, b) => a.n - b.n);
}

/** The tree of a slot, as git reports it: empty when nothing is modified, added or untracked. */
function cleanOf(dir) {
  return git(dir, ['status', '--porcelain']) === '';
}

/**
 * Whether `ancestor` is already contained in `descendant`: a slot whose HEAD is, holds
 * nothing the integration branch lacks. `git merge-base --is-ancestor` exits 1 — not an
 * error — when it is not, and that is the one non-zero status this program tolerates.
 */
function isAncestor(cwd, ancestor, descendant) {
  const run = spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { cwd, encoding: 'utf-8' });
  if (run.error) fail(`git cannot start (${run.error.message}): this tool reads the disk through git, which must be on the PATH`);
  if (run.status !== 0 && run.status !== 1) {
    fail(`git merge-base --is-ancestor ${ancestor} ${descendant} failed in ${slashed(cwd)}: ${(run.stderr || '').trim()}`);
  }
  return run.status === 0;
}

/* ------------------------------------------------------------------------- *
 * The registry — read, validated against schemas/blocks.json § pool, written whole
 * ------------------------------------------------------------------------- */

function schemasOf(root) {
  try {
    return JSON.parse(readFileSync(join(root, 'schemas', 'blocks.json'), 'utf-8'));
  } catch (error) {
    return fail(`schemas/blocks.json cannot be read under the root ${JSON.stringify(root)}: ${error.message}`);
  }
}

function validateRegistry(registry, schemas) {
  const spec = schemas.pool;
  if (!spec) fail('schemas/blocks.json carries no § pool: the registry has no form to be written against');
  if (!isObject(registry)) fail('the pool registry is not a JSON object');
  const wrong = [];
  for (const key of spec.required) if (!has(registry, key)) wrong.push(`${key} is missing`);
  for (const key of Object.keys(registry)) if (!spec.required.includes(key)) wrong.push(`${key} is not a field of the pool registry`);
  if (!Array.isArray(registry.slots)) wrong.push('slots must be an array');
  else {
    registry.slots.forEach((slot, at) => {
      if (!isObject(slot)) {
        wrong.push(`slots[${at}] is not a slot`);
        return;
      }
      for (const key of spec.slot_required) if (!has(slot, key)) wrong.push(`slots[${at}].${key} is missing`);
      for (const key of Object.keys(slot)) if (!spec.slot_required.includes(key)) wrong.push(`slots[${at}].${key} is not a field of a slot`);
      if (!Number.isInteger(slot.n) || slot.n < 1) wrong.push(`slots[${at}].n must be a positive integer`);
      for (const key of ['name', 'branch', 'updated']) {
        if (!nonEmpty(slot[key])) wrong.push(`slots[${at}].${key} must be a non-empty string`);
      }
      if (slot.delivery !== null && !nonEmpty(slot.delivery)) wrong.push(`slots[${at}].delivery must be a string or null`);
      const states = spec.enums['slots.state'];
      if (!states.includes(slot.state)) wrong.push(`slots[${at}].state is ${JSON.stringify(slot.state)}, outside ${states.join('|')}`);
    });
  }
  if (wrong.length) fail(`the pool registry does not match schemas/blocks.json § pool: ${wrong.join('; ')}`);
  return registry;
}

/**
 * The registry path, resolved against `work_root` exactly as `pool` is: both are paths of the
 * project's own file, `{paths.review_state}/worktree-pool.json`, and neither may depend on the
 * directory the caller happens to run from.
 */
function registryPathOf(input, workRoot) {
  return resolve(workRoot, text(input, 'registry'));
}

function readRegistry(path, schemas) {
  if (!existsSync(path)) return { slots: [] };
  let content;
  try {
    content = readFileSync(path, 'utf-8');
  } catch (error) {
    return fail(`the pool registry ${slashed(path)} cannot be read: ${error.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    return fail(`the pool registry ${slashed(path)} is not JSON: ${error.message}`);
  }
  return validateRegistry(parsed, schemas);
}

function writeRegistry(path, registry) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(registry, null, 2)}\n`, 'utf-8');
  renameSync(temporary, path);
}

/** The row a slot carries, or a fresh one when it was never taken by this registry. */
function rowOf(registry, n, name, branch) {
  return registry.slots.find((slot) => slot.name === name) || { n, name, branch, state: 'free', delivery: null, updated: iso() };
}

function putRow(registry, row) {
  registry.slots = registry.slots.filter((slot) => slot.name !== row.name);
  registry.slots.push(row);
  registry.slots.sort((a, b) => a.n - b.n);
}

/* ------------------------------------------------------------------------- *
 * The actions
 * ------------------------------------------------------------------------- */

/**
 * Each action's answer carries the fields its block declares and nothing else — `acquire` the
 * `worktree_root` and `branch`, `release` the `state` — so what the program prints is what
 * `skills/ship-feature/SKILL.md` says it returns, with no field the contract does not name.
 */
function answer(fields) {
  return { ok: true, worktree: null, detail: '', ...fields };
}

/** `acquire` — § *0. Acquisition*: the slot the delivery takes, cleaned, and the row that names it. */
function actAcquire(input, root) {
  const schemas = schemasOf(root);
  const workRoot = workRootOf(input);
  const prefix = text(input, 'prefix');
  const branchPrefix = text(input, 'branch_prefix');
  const delivery = text(input, 'delivery');
  if (!Number.isInteger(input.max) || input.max < 1) {
    fail(`max is required: the cap, a positive integer, got ${JSON.stringify(input.max)}`);
  }
  const poolAbs = resolve(workRoot, text(input, 'pool'));
  const registryPath = registryPathOf(input, workRoot);
  const slotRe = new RegExp(`^${escapeRe(prefix)}(\\d+)$`);

  const head = git(workRoot, ['rev-parse', 'HEAD']).trim();
  let registered = slotsOf(poolAbs, slotRe, worktreesOf(workRoot));
  if (registered.some((slot) => !slot.present)) {
    // A slot whose directory is gone is a registration git keeps until it is pruned: it holds
    // its number and nothing can be measured in it. The prune frees the name — git drops only
    // the administrative entry of a worktree that no longer exists — and the list is read again.
    git(workRoot, ['worktree', 'prune']);
    registered = slotsOf(poolAbs, slotRe, worktreesOf(workRoot));
  }
  const measured = registered.filter((slot) => slot.present).map((slot) => ({
    ...slot,
    clean: cleanOf(slot.dir),
    merged: isAncestor(workRoot, git(slot.dir, ['rev-parse', 'HEAD']).trim(), head),
  }));
  const registry = readRegistry(registryPath, schemas);
  const verdict = ask({ question: 'pool', slots: measured.map((slot) => ({ n: slot.n, clean: slot.clean, merged: slot.merged })), max: input.max }, root);

  if (verdict.verdict === 'blocked') {
    const who = measured
      .map((slot) => {
        const row = rowOf(registry, slot.n, slot.name, slot.branch);
        return `${slot.name} (${row.state}${row.delivery ? `, ${row.delivery}` : ''})`;
      })
      .join(', ');
    return answer({
      ok: false,
      worktree_root: null,
      detail: `${verdict.detail}${who ? ` Occupied slots: ${who}.` : ''} A dirty slot is not this delivery's residue to clean: the registry names the delivery that left it, and the owner decides.`,
    });
  }

  const name = `${prefix}${verdict.slot}`;
  const dir = join(poolAbs, name);
  mkdirSync(poolAbs, { recursive: true });
  if (verdict.verdict === 'reuse') {
    git(dir, ['reset', '--hard', head]);
  } else {
    // `-B` and not `-b`: a branch left behind by a worktree removed by hand still carries the
    // name this slot wants, and `-b` would refuse it. `-B` creates it, or resets it to the
    // integration branch when it is there.
    git(workRoot, ['worktree', 'add', '-B', `${branchPrefix}${name}`, slashed(dir), head]);
  }

  const branch = `${branchPrefix}${name}`;
  putRow(registry, { n: verdict.slot, name, branch, state: 'in-use', delivery, updated: iso() });
  writeRegistry(registryPath, validateRegistry(registry, schemas));

  const prefixInRepo = git(workRoot, ['rev-parse', '--show-prefix']).trim();
  const worktreeRoot = prefixInRepo ? resolve(dir, prefixInRepo) : dir;
  return answer({
    worktree: name,
    branch,
    worktree_root: slashed(worktreeRoot),
    detail: `${verdict.verdict === 'reuse' ? 'reused' : 'created'} slot ${name} at ${head.slice(0, 7)}; its row is ${slashed(registryPath)}.`,
  });
}

/** `release` — § *6c. Cleanup* and the blocked branches: how the delivery left the slot. */
function actRelease(input, root) {
  const schemas = schemasOf(root);
  const workRoot = workRootOf(input);
  const poolAbs = resolve(workRoot, text(input, 'pool'));
  const name = text(input, 'name');
  if (!['free', 'blocked'].includes(input.state)) {
    fail(`state is required: "free" (the merge landed and the slot is cleaned) or "blocked" (the delivery stopped with the tree dirty), got ${JSON.stringify(input.state)}`);
  }
  const registryPath = registryPathOf(input, workRoot);
  const registry = readRegistry(registryPath, schemas);
  const row = registry.slots.find((slot) => slot.name === name);
  if (!row) fail(`slot ${JSON.stringify(name)} is not in the registry ${slashed(registryPath)}: acquire writes the row, release updates it`);
  const dir = join(poolAbs, name);
  if (!existsSync(dir)) fail(`the worktree ${slashed(dir)} does not exist`);

  if (input.state === 'free') {
    if (!nonEmpty(input.ref)) fail('ref is required when state is "free": the merge SHA the slot is reset to');
    git(dir, ['reset', '--hard', input.ref]);
    git(dir, ['clean', '-fd']);
    if (!cleanOf(dir)) fail(`the slot ${name} is not clean after reset --hard and clean -fd: ${slashed(dir)} still carries modifications`);
  }

  const delivery = nonEmpty(input.delivery) ? input.delivery : row.delivery;
  putRow(registry, { n: row.n, name, branch: row.branch, state: input.state, delivery, updated: iso() });
  writeRegistry(registryPath, validateRegistry(registry, schemas));
  return answer({
    worktree: name,
    state: input.state,
    detail: input.state === 'free'
      ? `slot ${name} is clean and free again: it is reusable by the next delivery whatever the integration branch does.`
      : `slot ${name} is declared blocked: its tree stays dirty on purpose, and the registry names ${delivery || 'the delivery'} so the owner knows whose it is.`,
  });
}

const ACTIONS = {
  acquire: actAcquire,
  release: actRelease,
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

  const home = mkdtempSync(join(tmpdir(), 'daiku-pool-bench-'));
  const sh = (cwd, args) => {
    const run = spawnSync('git', args, { cwd, encoding: 'utf-8' });
    if (run.status !== 0) throw new Error(`git ${args.join(' ')}: ${run.stderr}`);
    return run.stdout;
  };
  const put = (file, content) => {
    mkdirSync(resolve(file, '..'), { recursive: true });
    writeFileSync(file, content, 'utf-8');
  };
  const readJson = (path) => JSON.parse(readFileSync(path, 'utf-8'));

  /** A repository whose technical root is a subfolder, and a pool outside it, the real case. */
  const fixture = (name) => {
    const dir = join(home, name);
    const repo = join(dir, 'repo');
    const cwd = join(repo, 'tech');
    mkdirSync(join(cwd, 'src'), { recursive: true });
    sh(repo, ['init', '-q', '-b', 'main']);
    sh(repo, ['config', 'user.email', 'bench@example.invalid']);
    sh(repo, ['config', 'user.name', 'bench']);
    sh(repo, ['config', 'commit.gpgsign', 'false']);
    put(join(cwd, 'src', 'a.js'), 'export const a = 1;\n');
    sh(repo, ['add', '-A']);
    sh(repo, ['commit', '-q', '-m', 'init']);
    return {
      dir, repo, cwd,
      pool: join(dir, 'pool'),
      registry: join(dir, 'state', 'worktree-pool.json'),
      head: () => sh(cwd, ['rev-parse', 'HEAD']).trim(),
      advance: () => {
        put(join(cwd, 'src', 'b.js'), `export const b = ${Date.now()};\n`);
        sh(repo, ['add', '-A']);
        sh(repo, ['commit', '-q', '-m', 'advance']);
        return sh(cwd, ['rev-parse', 'HEAD']).trim();
      },
      acquire: (extra = {}) => call({
        action: 'acquire', work_root: cwd, pool: join(dir, 'pool'), prefix: 'agent-tree-',
        branch_prefix: 'worktree-', max: 5, delivery: 'feature/x', registry: join(dir, 'state', 'worktree-pool.json'), ...extra,
      }),
      release: (extra = {}) => call({
        action: 'release', work_root: cwd, pool: join(dir, 'pool'), name: 'agent-tree-1',
        registry: join(dir, 'state', 'worktree-pool.json'), ...extra,
      }),
      slot: (n) => join(dir, 'pool', `agent-tree-${n}`),
      dirty: (n, file = 'wip.txt', content = 'work in progress\n') => put(join(dir, 'pool', `agent-tree-${n}`, file), content),
    };
  };

  try {
    /* --- acquire: the empty pool, the reuse that the old criterion forbade, the cap --- */
    attempt('acquire-creates', () => {
      const fx = fixture('acquire-creates');
      const got = fx.acquire();
      check('acquire:the-first-slot-is-created', got.ok === true && got.worktree === 'agent-tree-1', JSON.stringify(got));
      check('acquire:the-work-root-lands-in-the-technical-root', got.worktree_root === slashed(join(fx.slot(1), 'tech')), got.worktree_root);
      check('acquire:the-registry-records-the-taker', readJson(fx.registry).slots[0].state === 'in-use' && readJson(fx.registry).slots[0].delivery === 'feature/x', JSON.stringify(readJson(fx.registry)));
      check('acquire:git-carries-the-new-worktree', sh(fx.cwd, ['worktree', 'list', '--porcelain']).includes(slashed(fx.slot(1))), 'the worktree is not registered');
    });

    attempt('reuse', () => {
      const fx = fixture('reuse');
      fx.acquire();
      // The delivery succeeds and the slot is released clean; the integration branch moves on,
      // which is exactly the state the old «free» criterion read as occupied forever.
      fx.release({ state: 'free', ref: fx.head() });
      fx.advance();
      const again = fx.acquire();
      check('reuse:a-clean-slot-is-reused-although-its-head-is-behind', again.ok === true && again.worktree === 'agent-tree-1', JSON.stringify(again));
      check('reuse:no-second-slot-is-created', !existsSync(fx.slot(2)), 'a slot was created while a clean one stood free');
      check('reuse:the-slot-sits-on-the-moved-integration-branch', sh(fx.slot(1), ['rev-parse', 'HEAD']).trim() === fx.head(), 'the reused slot was not reset to the integration branch');
    });

    attempt('dirty', () => {
      const fx = fixture('dirty');
      fx.acquire();
      fx.dirty(1);
      const next = fx.acquire();
      check('dirty:a-dirty-slot-is-never-reused', next.ok === true && next.worktree === 'agent-tree-2', JSON.stringify(next));
    });

    attempt('unmerged', () => {
      const fx = fixture('unmerged');
      fx.acquire();
      // The delivery committed its work and the merge went into conflict: the slot is clean,
      // but its branch holds a commit the integration branch does not, so it is not reusable —
      // a reset would take that commit away, and this is why the criterion is not «clean» alone.
      put(join(fx.slot(1), 'tech', 'src', 'c.js'), 'export const c = 1;\n');
      sh(fx.slot(1), ['add', '-A']);
      sh(fx.slot(1), ['commit', '-q', '-m', 'the delivery, unmerged']);
      const next = fx.acquire();
      check('unmerged:a-clean-slot-with-unmerged-commits-is-not-reused', next.ok === true && next.worktree === 'agent-tree-2', JSON.stringify(next));
    });

    attempt('stale', () => {
      const fx = fixture('stale');
      fx.acquire();
      // Someone deletes the slot's directory by hand: git keeps the registration as `prunable`,
      // and a program that ran git inside it would die on every later acquisition. The pool
      // prunes the stale entry — dropping the name back into the pool — and goes on.
      rmSync(fx.slot(1), { recursive: true, force: true });
      const next = fx.acquire();
      check('stale:a-registration-whose-directory-is-gone-does-not-stop-the-pool', next.ok === true && next.worktree === 'agent-tree-1', JSON.stringify(next));
      check('stale:the-name-comes-back-to-the-pool', existsSync(fx.slot(1)), 'the slot was not created again');
    });

    attempt('numbering', () => {
      const fx = fixture('numbering');
      mkdirSync(fx.pool, { recursive: true });
      sh(fx.cwd, ['worktree', 'add', slashed(fx.slot(1)), '-b', 'worktree-agent-tree-1', fx.head()]);
      sh(fx.cwd, ['worktree', 'add', slashed(fx.slot(3)), '-b', 'worktree-agent-tree-3', fx.head()]);
      fx.dirty(1);
      fx.dirty(3);
      const got = fx.acquire();
      check('numbering:the-smallest-free-number-is-created', got.worktree === 'agent-tree-2', JSON.stringify(got));
    });

    attempt('full', () => {
      const fx = fixture('full');
      fx.acquire({ max: 1 });
      fx.dirty(1);
      const blocked = fx.acquire({ max: 1 });
      check('full:a-pool-all-dirty-stops-the-delivery', blocked.ok === false && blocked.worktree === null, JSON.stringify(blocked));
      check('full:the-blocked-detail-names-who-left-the-slot', blocked.detail.includes('agent-tree-1') && blocked.detail.includes('in-use'), blocked.detail);
      check('full:no-slot-beyond-the-cap-is-created', !existsSync(fx.slot(2)), 'the cap was crossed');
    });

    /* --- release: the two outcomes one records --- */
    attempt('release', () => {
      const fx = fixture('release');
      fx.acquire();
      const merge = fx.head();
      fx.dirty(1, 'junk.txt');
      const freed = fx.release({ state: 'free', ref: merge });
      check('release:free-cleans-the-slot', freed.state === 'free' && sh(fx.slot(1), ['status', '--porcelain']) === '', JSON.stringify(freed));
      check('release:free-marks-the-row-free', readJson(fx.registry).slots[0].state === 'free', JSON.stringify(readJson(fx.registry)));

      fx.dirty(1, 'left.txt');
      const blocked = fx.release({ state: 'blocked' });
      check('release:blocked-keeps-the-tree-dirty', sh(fx.slot(1), ['status', '--porcelain']).includes('left.txt'), 'the blocked slot was cleaned');
      check('release:blocked-marks-the-row-blocked', readJson(fx.registry).slots[0].state === 'blocked' && readJson(fx.registry).slots[0].delivery === 'feature/x', JSON.stringify(readJson(fx.registry)));
    });

    attempt('round-trip', () => {
      const fx = fixture('round-trip');
      fx.acquire();
      fx.release({ state: 'free', ref: fx.head() });
      fx.advance();
      fx.acquire();
      fx.release({ state: 'free', ref: fx.head() });
      fx.advance();
      const third = fx.acquire();
      check('round-trip:one-slot-serves-three-deliveries', third.worktree === 'agent-tree-1' && !existsSync(fx.slot(2)), JSON.stringify(third));
      check('round-trip:the-registry-holds-one-row', readJson(fx.registry).slots.length === 1, JSON.stringify(readJson(fx.registry)));
    });

    /* --- refusals --- */
    refused('reject:acquire-without-work-root', { action: 'acquire', pool: 'p', prefix: 'a-', branch_prefix: 'w-', max: 5, delivery: 'x', registry: 'r' }, 'work_root is required');
    refused('reject:acquire-without-the-cap', { action: 'acquire', work_root: '.', pool: 'p', prefix: 'a-', branch_prefix: 'w-', delivery: 'x', registry: 'r' }, 'max is required');
    refused('reject:release-with-an-unknown-state', { action: 'release', work_root: '.', pool: 'p', name: 'agent-tree-1', registry: 'r', state: 'maybe' }, 'state is required');
    refused('reject:unknown-action', { action: 'invented' }, 'action is required');

    const fx = fixture('refusals');
    fx.acquire();
    refused('reject:release-free-without-its-ref', { action: 'release', work_root: fx.cwd, pool: fx.pool, name: 'agent-tree-1', registry: fx.registry, state: 'free' }, 'ref is required');
    refused('reject:release-of-a-slot-the-registry-does-not-know', { action: 'release', work_root: fx.cwd, pool: fx.pool, name: 'agent-tree-9', registry: fx.registry, state: 'blocked' }, 'is not in the registry');
    put(fx.registry, '{"slots": [{"n": 1, "name": "agent-tree-1", "branch": "b", "state": "invented", "delivery": null, "updated": "x"}]}');
    refused('reject:a-registry-outside-its-form', { action: 'acquire', work_root: fx.cwd, pool: fx.pool, prefix: 'agent-tree-', branch_prefix: 'worktree-', max: 5, delivery: 'x', registry: fx.registry }, 'outside free|in-use|blocked');
    put(fx.registry, 'not json');
    refused('reject:a-registry-that-is-not-json', { action: 'acquire', work_root: fx.cwd, pool: fx.pool, prefix: 'agent-tree-', branch_prefix: 'worktree-', max: 5, delivery: 'x', registry: fx.registry }, 'is not JSON');
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
  process.stderr.write(`pool: ${reason}\n`);
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
    process.stderr.write('usage: node pool.mjs <package-root>\n');
    process.stderr.write('       node pool.mjs --self-check <package-root>\n');
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
