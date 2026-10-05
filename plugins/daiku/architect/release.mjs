#!/usr/bin/env node
/**
 * The disk side of Daiku's release.
 *
 * The `release` skill decides **what** a release contains — the version the owner chose and the
 * changelog section built from the block's own messages — and this program does **where** it goes:
 * it builds the production tree out of the development tree, writes the version and the changelog
 * into it, and moves the production ref. Everything of it is a measurement or a write on the disk,
 * and nothing of it is a judgement.
 *
 * **It never stands on production.** Production is where releases live, and the branch guard
 * denies `git commit` and `git merge` there — so the release does not check it out, does not
 * touch the working tree and does not touch the real index. It builds the commit with Git's
 * plumbing on a throwaway index (`GIT_INDEX_FILE`), exactly as `ledger.mjs` photographs a tree,
 * and moves the ref with `update-ref`. A release that wrote work on production is not something
 * this program can be made to do: the mechanism is not there.
 *
 * That is also why it can release a project whose production tree is a **subfolder** of the
 * development one — `source` re-roots the tree, and the paths of the release's own files
 * (`version_file`, `version_replicated_in`, `changelog`) are resolved on production by stripping
 * that same prefix. It is the shape of Daiku's own repository, where the product lives under
 * `plugins/` and the marketplace repository is its content at the root.
 *
 * **Accumulation.** A release that has not been pushed is a draft: the owner has not decided it
 * exists yet. So when production's tip is a release commit that no remote carries, the new release
 * **replaces** it — same parent, new tree, new message — instead of opening a version on top. The
 * block of commits a release covers therefore starts at the development sha the *previous* release
 * published, which this program records in the commit itself as a `Development:` trailer and hands
 * back on the `status` action.
 *
 * Like the evaluator and the ledger it **fails loudly**: a missing or malformed input is an error
 * and exit 2, never a silent success.
 *
 *   node <package-root>/architect/release.mjs <package-root>
 *       one JSON object on stdin — `action` plus that action's keys — one on stdout, exit 0.
 *
 *   node <package-root>/architect/release.mjs --self-check <package-root>
 *       the bench, on throwaway Git repositories under the system temp directory. Counted JSON
 *       `{checks, passed, failed[]}` on stdout, exit 1 on the first red. `hooks/self-check.mjs`
 *       launches it.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/* ------------------------------------------------------------------------- *
 * Input
 * ------------------------------------------------------------------------- */

class BadInput extends Error {}

function fail(message) {
  throw new BadInput(message);
}

const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value) => typeof value === 'string' && value.trim() !== '';
const slashed = (path) => String(path).split('\\').join('/');

function text(input, key) {
  if (!nonEmpty(input[key])) fail(`${key} is required and must be a non-empty string`);
  return input[key];
}

/** A path as the caller wrote it: `/` separators, no leading `./`, no trailing `/`. */
function cleanPath(raw) {
  const p = slashed(raw).replace(/^\.\//, '').replace(/\/+$/, '');
  return p === '.' ? '' : p;
}

/** `source`, the prefix re-rooted onto production: `plugins` → `plugins/`, `` → ``. */
function sourceOf(input) {
  const raw = has(input, 'source') ? input.source : '';
  if (raw === null || raw === '') return '';
  if (!nonEmpty(raw)) fail('source must be a non-empty string, or absent for the whole tree');
  return `${cleanPath(raw)}/`;
}

/** A path of the project, as it stands on development. */
function devPath(input, key) {
  return cleanPath(text(input, key));
}

/** The same path as it stands on production: the `source` prefix taken off the front. */
function prodPath(source, path) {
  if (!source) return path;
  if (path.startsWith(source)) return path.slice(source.length);
  return null; // outside the published subtree: it does not exist on production at all
}

function answer(value) {
  return value;
}

/* ------------------------------------------------------------------------- *
 * Git — every read and every write of the repository goes through here
 * ------------------------------------------------------------------------- */

function git(cwd, args, extra = {}) {
  const outcome = spawnSync('git', args, Object.assign({ cwd, encoding: 'utf-8' }, extra));
  if (outcome.error) fail(`git ${args.join(' ')} did not start: ${outcome.error.message}`);
  if (outcome.status !== 0) {
    const detail = (outcome.stderr || outcome.stdout || '').trim().split('\n')[0];
    fail(`git ${args.join(' ')} failed in ${cwd}: ${detail}`);
  }
  return outcome.stdout;
}

/** The same, where a non-zero exit is the answer rather than a fault. */
function gitTry(cwd, args, extra = {}) {
  const outcome = spawnSync('git', args, Object.assign({ cwd, encoding: 'utf-8' }, extra));
  if (outcome.error) fail(`git ${args.join(' ')} did not start: ${outcome.error.message}`);
  return outcome.status === 0 ? outcome.stdout.trim() : null;
}

const revOf = (cwd, ref) => gitTry(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
const treeOf = (cwd, ref) => git(cwd, ['rev-parse', '--verify', `${ref}^{tree}`]).trim();

/** The file at `path` in `ref`, or `null` where the ref or the path is not there. */
function fileAt(cwd, ref, path) {
  const outcome = spawnSync('git', ['show', `${ref}:${path}`], { cwd, encoding: 'utf-8' });
  if (outcome.status !== 0) return null;
  return outcome.stdout;
}

/* ------------------------------------------------------------------------- *
 * The release commit's own data
 * ------------------------------------------------------------------------- */

const TRAILER = 'Development';

/** The sha the release carried, read back from the commit it wrote. */
function anchorOf(cwd, ref) {
  if (!ref) return null;
  const body = gitTry(cwd, ['log', '-1', '--format=%B', ref]);
  if (body === null) return null;
  const line = body.split('\n').map((l) => l.trim()).find((l) => l.startsWith(`${TRAILER}:`));
  if (!line) return null;
  const sha = line.slice(TRAILER.length + 1).trim();
  return /^[0-9a-f]{7,40}$/.test(sha) ? sha : null;
}

/** A production commit this program wrote: `release <version>` as the subject. */
const isReleaseCommit = (cwd, ref) => {
  if (!ref) return false;
  const subject = gitTry(cwd, ['log', '-1', '--format=%s', ref]);
  return !!subject && /^release \d+\.\d+\.\d+/.test(subject);
};

/**
 * Where the next release's block of commits starts: the development sha the last **published**
 * release carried.
 *
 * When production's tip is a draft it is the trailer of the draft's *parent* — the draft will be
 * replaced, so the release that replaces it must cover the whole span the draft was covering too,
 * not only what arrived after it. When the tip is published the next release is a new commit on
 * top, and the span starts where that release left off.
 */
function anchorFor(cwd, productionSha, draft) {
  if (!productionSha) return null;
  if (!draft) return anchorOf(cwd, productionSha);
  const parent = gitTry(cwd, ['rev-parse', '--verify', '--quiet', `${productionSha}^`]);
  return parent ? anchorOf(cwd, parent) : null;
}

/**
 * Whether a release standing on production has been carried by a remote, and the branch's upstream
 * is the only place that question is asked. Where there is no upstream there is no push to have
 * happened: nothing on that branch is a draft, and a release is never replaced. Rewriting the
 * history of a branch nobody publishes is a surprise, not an accumulation.
 */
function pushed(cwd, ref) {
  const upstream = gitTry(cwd, ['rev-parse', '--verify', '--quiet', `${ref}@{upstream}`]);
  if (!upstream) return true;
  return spawnSync('git', ['merge-base', '--is-ancestor', ref, upstream], { cwd }).status === 0;
}

/** Every worktree where `<branch>` is the checked-out branch. */
function worktreesOn(cwd, branch) {
  const out = git(cwd, ['worktree', 'list', '--porcelain']);
  const found = [];
  let path = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) path = line.slice('worktree '.length).trim();
    else if (line.startsWith('branch ') && line.slice('branch '.length).trim() === `refs/heads/${branch}` && path) {
      found.push(slashed(path));
    }
  }
  return found;
}

/* ------------------------------------------------------------------------- *
 * Building the production tree
 * ------------------------------------------------------------------------- */

/** The indentation of a JSON file, so the write keeps the file's own hand. */
function indentOf(text) {
  const line = text.split('\n').find((l) => /^\s+\S/.test(l));
  if (!line) return 2;
  const spaces = line.match(/^ */)[0].length;
  return spaces > 0 ? spaces : 2;
}

/** `{version_file}`: the field set, in the file's own indentation and with its trailing newline. */
function versionedFile(text, field, version) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    fail(`the version file is not valid JSON (${error.message})`);
  }
  parsed[field] = version;
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const written = JSON.stringify(parsed, null, indentOf(text)).split('\n').join(eol);
  return written.endsWith(eol) ? written : `${written}${eol}`;
}

/** A file of `{version.replicated_in}`: every occurrence of the old number becomes the new one. */
function replicatedFile(text, oldVersion, version) {
  if (!oldVersion) fail('a release needs the version production carries now, and it has none');
  return text.split(oldVersion).join(version);
}

/**
 * The changelog with the new section in it: inserted after the title line and its blank line, so
 * the newest release is the first thing below the heading. The section's own prose — its heading,
 * its date, its bullets, its rule — is the caller's, and this program only places it.
 */
function changelogWith(text, section, version) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const title = lines.findIndex((l) => /^#\s/.test(l));
  if (title < 0) fail('the changelog on production has no `# ...` title line to insert below');
  const before = lines.slice(0, title + 1);
  let at = title + 1;
  while (at < lines.length && lines[at].trim() === '') at += 1;
  const after = lines.slice(at);
  // One blank line on either side and no more: the section is written as its own paragraphs, and
  // the caller's text is not trusted to end without one — the release's spacing is this program's.
  return [...before, '', ...section.trim().split(eol), '', ...after].join(eol);
}

/** The `Development:` trailer, appended to the caller's message. */
function messageWith(message, developmentSha) {
  const body = message.replace(/\s+$/, '');
  return `${body}\n\n${TRAILER}: ${developmentSha}\n`;
}

/**
 * The method's own footprint, and it is not the project's to decide: these are the seats Daiku
 * deposits in every project it opens, and **production is not their place**. A release that
 * published them would ship the workshop — the parameters, the memory of the agent, the hooks and
 * the roles — to whoever installs the product, and nothing downstream would ever notice.
 *
 * The file of instructions is the fourth, and it is not here because its name is a host parameter:
 * the caller passes `instructions_file`. `never` carries what the project itself adds, which is
 * the extension `new-project` asks it for.
 */
const METHOD_FOOTPRINT = ['.daiku', '.claude', '.codex'];

/**
 * The paths that never reach the published tree, as paths of the published tree — the `source`
 * prefix taken off, and the entries standing outside it dropped, because nothing outside it is
 * published anyway.
 */
function neverPublished(input, source) {
  const dev = [...METHOD_FOOTPRINT];
  if (has(input, 'instructions_file') && nonEmpty(input.instructions_file)) {
    dev.push(cleanPath(input.instructions_file));
  }
  if (has(input, 'never')) {
    if (!Array.isArray(input.never) || !input.never.every(nonEmpty)) {
      fail('never must be a list of paths, the project\'s own exclusions');
    }
    for (const raw of input.never) dev.push(cleanPath(raw));
  }
  const out = new Set();
  for (const path of dev) {
    const mapped = prodPath(source, path);
    if (mapped) out.add(mapped.replace(/\/+$/, ''));
  }
  return [...out];
}

/** Whether a file of the tree stands under one of the paths that never reach production. */
const isNever = (file, never) => never.some((path) => file === path || file.startsWith(`${path}/`));

/** The number production carries now, read from its own version file — the one being replaced. */
function readVersion(cwd, production, path, field) {
  if (!path) return null;
  const raw = fileAt(cwd, production, path);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw)[field];
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------------- *
 * The two actions
 * ------------------------------------------------------------------------- */

function settings(input) {
  const cwd = resolve(text(input, 'work_root'));
  if (!existsSync(cwd)) fail(`work_root ${JSON.stringify(input.work_root)} does not exist`);
  const development = text(input, 'development');
  const production = text(input, 'production');
  return { cwd, development, production, source: sourceOf(input) };
}

/** What the skill needs to know before it can write the notes and ask the version. */
function actStatus(input) {
  const { cwd, development, production, source } = settings(input);
  if (!revOf(cwd, development)) {
    fail(`the development branch ${development} does not exist: there is nothing to release`);
  }
  const developmentSha = revOf(cwd, development);
  const productionSha = revOf(cwd, production);
  const pending = !!productionSha && isReleaseCommit(cwd, productionSha) && !pushed(cwd, production);
  const anchor = anchorFor(cwd, productionSha, pending);
  // Whether production answers the question at all. Without an upstream the accumulation is off
  // and silent, so the caller is told: a branch nobody pushes to never reads as a draft.
  const tracking = gitTry(cwd, ['rev-parse', '--verify', '--quiet', `${production}@{upstream}`]) !== null;

  const versionField = has(input, 'version_file') ? devPath(input, 'version_file') : null;
  let versionPath = null;
  let currentVersion = null;
  if (versionField && productionSha) {
    versionPath = prodPath(source, versionField);
    currentVersion = readVersion(cwd, production, versionPath, text(input, 'version_field'));
  }
  return answer({
    ok: true,
    action: 'status',
    development,
    production,
    development_sha: developmentSha,
    production_sha: productionSha,
    pending,
    anchor,
    tracking,
    never: neverPublished(input, source),
    current_version: currentVersion,
    version_file: versionPath,
    checked_out: worktreesOn(cwd, production),
    detail: pending
      ? `production carries a release nothing has pushed: the next release replaces it, and its block starts at ${anchor || 'the history\'s root'}.`
      : productionSha
        ? `production carries no unpushed release: the next one is a new commit on top${
            tracking ? '' : `, and \`${production}\` tracks no upstream, so nothing on it will ever read as a draft`
          }.`
        : 'production does not exist yet: the first release creates it.',
  });
}

function actRelease(input, dry) {
  const { cwd, development, production, source } = settings(input);
  const version = text(input, 'version');
  if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`version must be a semantic version, got ${JSON.stringify(version)}`);
  const message = text(input, 'message');
  const section = text(input, 'section');

  // Standing on production is the one thing this program must never do, and a copy holding it is
  // the same fault seen from outside: its working tree would be left describing a commit that is
  // no longer there.
  const holdings = worktreesOn(cwd, production);
  if (holdings.length) {
    fail(
      `the production branch ${production} is checked out in ${holdings.join(', ')}: ` +
        'a release moves production, and a copy holding it would be left behind. Close it and relaunch.'
    );
  }

  const developmentSha = revOf(cwd, development);
  if (!developmentSha) fail(`the development branch ${development} does not exist: there is nothing to release`);
  const productionSha = revOf(cwd, production);
  const amend = !!productionSha && isReleaseCommit(cwd, productionSha) && !pushed(cwd, production);
  // The anchor the notes were built from, on the commit the draft replaces.
  const fromSha = amend ? anchorFor(cwd, productionSha, true) : null;

  if (has(input, 'from_sha') && input.from_sha !== null && input.from_sha !== fromSha) {
    fail(
      `from_sha is ${JSON.stringify(input.from_sha)} but the release standing on production was built from ` +
        `${JSON.stringify(fromSha)}: the notes would cover the wrong block. Read the state again.`
    );
  }

  const devTree = treeOf(cwd, development);
  // The base of the release's own files — the version, its replicas, the changelog: the last state
  // production **published**. Replacing a draft means the draft was never published, so its
  // changelog section and its number are not a base to build on but a draft of the one being
  // written now; reading them would leave the replaced section standing below the new one.
  const base = amend ? gitTry(cwd, ['rev-parse', '--verify', '--quiet', `${productionSha}^`]) : productionSha;
  const dir = mkdtempSync(join(tmpdir(), 'daiku-release-'));
  const index = join(dir, 'index');
  const env = { GIT_INDEX_FILE: index };
  try {
    // The base: the development tree, re-rooted where `source` says so. `read-tree <tree>` on a
    // subtree puts its *content* at the root, which is exactly the marketplace repository's shape.
    git(cwd, ['read-tree', source ? `${devTree}:${cleanPath(source.replace(/\/$/, ''))}` : devTree], { env });

    // The workshop comes off the tree before anything is written into it. Where the project declared
    // a `source`, nothing outside it was read in the first place and this is belt and braces; where
    // it did not — the ordinary project, whose product is the whole tree — this is the difference
    // between publishing a product and publishing the method's own seats.
    const never = neverPublished(input, source);
    if (never.length) {
      for (const file of git(cwd, ['ls-files', '-z'], { env }).split('\0')) {
        if (file && isNever(file, never)) git(cwd, ['update-index', '--force-remove', '--', file], { env });
      }
    }

    const put = (path, content) => {
      const blob = git(cwd, ['hash-object', '-w', '--stdin'], { env, input: content }).trim();
      git(cwd, ['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`], { env });
    };

    // The version, in the file and in every file that replicates it. All three come from
    // production: they are production's own state, and development carries none of it.
    if (has(input, 'version_file')) {
      const devFile = devPath(input, 'version_file');
      const path = prodPath(source, devFile);
      if (path === null) fail(`version_file ${devFile} stands outside the published subtree ${source}`);
      const field = text(input, 'version_field');
      const before = base ? fileAt(cwd, base, path) : null;
      if (!before) {
        fail(
          base
            ? `production carries no ${path}: the version cannot be written into a file that is not there`
            : 'this is the first release and production carries no version file to read the old number from'
        );
      }
      put(path, versionedFile(before, field, version));
    }

    if (has(input, 'version_replicated_in')) {
      if (!Array.isArray(input.version_replicated_in) || !input.version_replicated_in.every(nonEmpty)) {
        fail('version_replicated_in must be a list of paths');
      }
      if (!base) fail('this is the first release: there is no replicated file to carry the number over from');
      // The number being replaced is production's own, read from the file the caller declared: the
      // caller does not hand it over, because a number passed in is a number that can be wrong.
      if (!has(input, 'version_file')) {
        fail('version_replicated_in needs version_file: the number being replaced is read from production');
      }
      const field = text(input, 'version_field');
      const old = readVersion(cwd, base, prodPath(source, devPath(input, 'version_file')), field);
      if (!old) fail(`production carries no ${field} to replace in the replicated files`);
      for (const raw of input.version_replicated_in) {
        const devFile = cleanPath(raw);
        const path = prodPath(source, devFile);
        if (path === null) fail(`version_replicated_in names ${devFile}, outside the published subtree ${source}`);
        const before = fileAt(cwd, base, path);
        if (before === null) fail(`production carries no ${path}, named by version_replicated_in`);
        put(path, replicatedFile(before, old, version));
      }
    }

    // The changelog: production's own, with the new section on top. Development has none — the
    // released register lives on production, and a section is born here, at the release.
    if (has(input, 'changelog')) {
      const devFile = devPath(input, 'changelog');
      const path = prodPath(source, devFile);
      if (path === null) fail(`changelog ${devFile} stands outside the published subtree ${source}`);
      const before = (base && fileAt(cwd, base, path)) || `# Changelog\n`;
      put(path, changelogWith(before, section, version));
    }

    const tree = git(cwd, ['write-tree'], { env }).trim();
    const parent = amend ? git(cwd, ['rev-parse', '--verify', `${productionSha}^`]).trim() : productionSha;
    const commitArgs = ['commit-tree', tree, '-m', messageWith(message, developmentSha)];
    if (parent) commitArgs.push('-p', parent);
    const commit = git(cwd, commitArgs, { env }).trim();
    // The one irreversible act, and the only thing a dry run does not do. Everything above it ran
    // for real, so what the dry run reports is the release, not a description of one.
    if (!dry) git(cwd, ['update-ref', `refs/heads/${production}`, commit, ...(productionSha ? [productionSha] : [])]);

    return answer({
      ok: true,
      action: dry ? 'dry' : 'release',
      released: !dry,
      dry: !!dry,
      version,
      development_sha: developmentSha,
      production_sha: dry ? productionSha : commit,
      would_be: dry ? commit : null,
      amended: amend,
      from_sha: fromSha,
      changelog: has(input, 'changelog') ? devPath(input, 'changelog') : null,
      detail: dry
        ? `dry run: release ${version} ${amend ? `would replace the draft on ${production}` : `would be written on ${production}`} as ${commit.slice(0, 7)}, carrying ${developmentSha.slice(0, 7)}. Nothing was moved.`
        : amend
          ? `release ${version} replaced the unpublished draft on ${production}: ${commit.slice(0, 7)}, carrying ${developmentSha.slice(0, 7)}.`
          : `release ${version} written on ${production}: ${commit.slice(0, 7)}, carrying ${developmentSha.slice(0, 7)}.`,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function dispatch(input, root) {
  if (!isObject(input)) fail('stdin must be one JSON object');
  const action = input.action;
  if (action === 'status') return actStatus(input);
  if (action === 'release') return actRelease(input, false);
  if (action === 'dry') return actRelease(input, true);
  fail(`unknown action ${JSON.stringify(action)}: expected "status", "dry" or "release"`);
}

/* ------------------------------------------------------------------------- *
 * The bench — throwaway repositories, real Git, one proof per rule
 * ------------------------------------------------------------------------- */

function runBench(root) {
  const checks = [];
  const failed = [];
  const check = (name, ok, detail) => {
    checks.push(name);
    if (!ok) failed.push(`${name}${detail ? ` — ${detail}` : ''}`);
  };
  const dir = mkdtempSync(join(tmpdir(), 'daiku-release-bench-'));
  const neverRed = [];

  const sh = (cwd, args) => {
    const outcome = spawnSync('git', args, { cwd, encoding: 'utf-8' });
    return { status: outcome.status, out: `${outcome.stdout || ''}${outcome.stderr || ''}`.trim() };
  };
  const write = (path, content) => {
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, content);
  };

  /** A repository with `develop` holding a product under `plugins/` and `main` holding a release. */
  function fixture(name, { published = true } = {}) {
    const repo = join(dir, name);
    mkdirSync(repo, { recursive: true });
    sh(repo, ['init', '-q', '-b', 'develop']);
    sh(repo, ['config', 'user.email', 'bench@daiku']);
    sh(repo, ['config', 'user.name', 'bench']);
    write(join(repo, 'plugins/daiku/.claude-plugin/plugin.json'), '{\n  "name": "daiku",\n  "version": "0.0.0"\n}\n');
    write(join(repo, 'plugins/daiku/.codex-plugin/plugin.json'), '{\n  "name": "daiku",\n  "version": "0.0.0"\n}\n');
    write(join(repo, 'plugins/README.md'), '![version](https://img.shields.io/badge/version-0.0.0-blue)\n');
    write(join(repo, 'plugins/daiku/skills/release/SKILL.md'), '# release\n');
    write(join(repo, 'cantiere.md'), '# the workshop\n');
    sh(repo, ['add', '-A']);
    sh(repo, ['commit', '-qm', 'feat: the product']);
    if (published) {
      // What a release before this one left behind: production carrying 1.1.2 and a changelog.
      const subtree = sh(repo, ['rev-parse', 'develop:plugins']).out;
      const idx = join(repo, '.bench-index');
      const env = Object.assign({}, process.env, { GIT_INDEX_FILE: idx });
      spawnSync('git', ['read-tree', subtree], { cwd: repo, env });
      const blob = spawnSync('git', ['hash-object', '-w', '--stdin'], { cwd: repo, env, input: '{\n  "name": "daiku",\n  "version": "1.1.2"\n}\n', encoding: 'utf-8' }).stdout.trim();
      spawnSync('git', ['update-index', '--add', '--cacheinfo', `100644,${blob},daiku/.claude-plugin/plugin.json`], { cwd: repo, env });
      const blob2 = spawnSync('git', ['hash-object', '-w', '--stdin'], { cwd: repo, env, input: '{\n  "name": "daiku",\n  "version": "1.1.2"\n}\n', encoding: 'utf-8' }).stdout.trim();
      spawnSync('git', ['update-index', '--add', '--cacheinfo', `100644,${blob2},daiku/.codex-plugin/plugin.json`], { cwd: repo, env });
      const blob3 = spawnSync('git', ['hash-object', '-w', '--stdin'], { cwd: repo, env, input: '![version](https://img.shields.io/badge/version-1.1.2-blue)\n', encoding: 'utf-8' }).stdout.trim();
      spawnSync('git', ['update-index', '--add', '--cacheinfo', `100644,${blob3},README.md`], { cwd: repo, env });
      const blob4 = spawnSync('git', ['hash-object', '-w', '--stdin'], { cwd: repo, env, input: '# Changelog\n\n### 1.1.2 — 2026-10-01\n\n- Something.\n\n---\n', encoding: 'utf-8' }).stdout.trim();
      spawnSync('git', ['update-index', '--add', '--cacheinfo', `100644,${blob4},CHANGELOG.md`], { cwd: repo, env });
      const out = spawnSync('git', ['write-tree'], { cwd: repo, env, encoding: 'utf-8' }).stdout.trim();
      const commit = spawnSync('git', ['commit-tree', out, '-m', `release 1.1.2 — something\n\nDevelopment: ${sh(repo, ['rev-parse', 'develop']).out}\n`], { cwd: repo, env, encoding: 'utf-8' }).stdout.trim();
      spawnSync('git', ['update-ref', 'refs/heads/main', commit], { cwd: repo });
      rmSync(idx, { force: true });
      // An upstream standing at the released commit: that release has been published, so the next
      // one is a new commit on top of it. A branch with no upstream has no push to have happened
      // and nothing on it is ever read as a draft. The remote is never pushed to — the bench only
      // needs the refspec `@{upstream}` resolves through.
      const bare = join(dir, `${name}-origin.git`);
      mkdirSync(bare, { recursive: true });
      sh(dir, ['init', '-q', '--bare', bare]);
      sh(repo, ['remote', 'add', 'origin', bare]);
      sh(repo, ['config', 'branch.main.remote', 'origin']);
      sh(repo, ['config', 'branch.main.merge', 'refs/heads/main']);
      sh(repo, ['update-ref', 'refs/remotes/origin/main', commit]);
    }
    return repo;
  }

  const call = (repo, input) => {
    const outcome = spawnSync(process.execPath, [join(root, 'architect', 'release.mjs'), root], {
      cwd: repo, encoding: 'utf-8', input: JSON.stringify(input),
    });
    if (!outcome.stdout || !outcome.stdout.trim()) {
      return { ok: false, error: (outcome.stderr || '').trim().split('\n')[0] || 'no output' };
    }
    try {
      return JSON.parse(outcome.stdout);
    } catch {
      return { ok: false, error: `unreadable: ${outcome.stdout.slice(0, 120)}` };
    }
  };

  const base = (repo, extra = {}) => Object.assign({
    work_root: repo,
    development: 'develop',
    production: 'main',
    source: 'plugins',
    version_file: 'plugins/daiku/.claude-plugin/plugin.json',
    version_field: 'version',
    version_replicated_in: ['plugins/daiku/.codex-plugin/plugin.json', 'plugins/README.md'],
    changelog: 'plugins/CHANGELOG.md',
  }, extra);

  try {
    /* --- status --------------------------------------------------------- */
    {
      const repo = fixture('status');
      const got = call(repo, base(repo, { action: 'status' }));
      check('status:reads-the-number-production-carries', got.current_version === '1.1.2', JSON.stringify(got));
      check('status:no-draft-means-a-new-commit', got.pending === false, JSON.stringify(got));
      check('status:it-says-production-tracks-an-upstream', got.tracking === true, JSON.stringify(got));
      check('status:the-version-file-is-a-production-path', got.version_file === 'daiku/.claude-plugin/plugin.json', JSON.stringify(got));
    }

    /* --- a first release, and the tree it builds ------------------------ */
    {
      const repo = fixture('first');
      const section = '### 1.1.3 — 2026-10-05\n\n- The product.\n\n---';
      const got = call(repo, base(repo, { action: 'release', version: '1.1.3', section, message: 'release 1.1.3 — the product' }));
      check('release:writes-the-commit-on-production', got.released === true && !!got.production_sha, JSON.stringify(got));
      check('release:production-is-not-checked-out', sh(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).out === 'develop');
      check('release:the-working-tree-is-untouched', sh(repo, ['status', '--porcelain']).out === '');
      const tree = sh(repo, ['ls-tree', '-r', '--name-only', 'main']).out.split('\n');
      check('release:the-subtree-becomes-the-root', tree.includes('daiku/.claude-plugin/plugin.json') && !tree.some((p) => p.startsWith('plugins/')), JSON.stringify(tree));
      check('release:it-does-not-publish-the-workshop', !tree.includes('cantiere.md'), JSON.stringify(tree));
      check('release:the-number-lands-in-the-version-file', fileAt(repo, 'main', 'daiku/.claude-plugin/plugin.json').includes('"1.1.3"'));
      check('release:the-number-lands-in-the-replicated-file', fileAt(repo, 'main', 'daiku/.codex-plugin/plugin.json').includes('"1.1.3"'));
      check('release:the-number-lands-in-the-badge', fileAt(repo, 'main', 'README.md').includes('badge/version-1.1.3-'));
      const changelog = fileAt(repo, 'main', 'CHANGELOG.md');
      check('release:the-section-goes-under-the-title', changelog.indexOf('# Changelog') < changelog.indexOf('### 1.1.3'), changelog);
      check('release:the-section-is-separated-by-exactly-one-blank-line', !/\n\n\n/.test(changelog), JSON.stringify(changelog.slice(0, 200)));
      check('release:the-section-keeps-the-old-ones-below', changelog.includes('### 1.1.2'), changelog);
      check('release:sits-on-the-previous-release', sh(repo, ['log', '-1', '--format=%s', 'main^']).out.startsWith('release 1.1.2'), sh(repo, ['log', '-1', '--format=%s', 'main^']).out);
      check('release:the-anchor-is-recorded', anchorOf(repo, 'main') === sh(repo, ['rev-parse', 'develop']).out);
      check('release:a-new-release-does-not-amend', got.amended === false, JSON.stringify(got));
    }

    /* --- the accumulation ---------------------------------------------- */
    {
      const repo = fixture('accumulate');
      const first = call(repo, base(repo, { action: 'release', version: '1.1.3', section: '### 1.1.3 — 2026-10-05\n\n- One.\n\n---', message: 'release 1.1.3 — one' }));
      write(join(repo, 'plugins/daiku/skills/nuova/SKILL.md'), '# nuova\n');
      sh(repo, ['add', '-A']);
      sh(repo, ['commit', '-qm', 'feat: another']);
      const before = sh(repo, ['rev-parse', 'main']).out;
      const parentBefore = sh(repo, ['rev-parse', 'main^']).out;
      const countBefore = sh(repo, ['rev-list', '--count', 'main']).out;
      const status = call(repo, base(repo, { action: 'status' }));
      check('accumulate:an-unpushed-release-is-a-draft', status.pending === true, JSON.stringify(status));
      check('accumulate:the-anchor-reaches-back-past-the-draft-to-what-was-published', status.anchor === first.development_sha, JSON.stringify(status));
      const second = call(repo, base(repo, {
        action: 'release', version: '1.1.3', from_sha: status.anchor,
        section: '### 1.1.3 — 2026-10-05\n\n- One.\n- Two.\n\n---', message: 'release 1.1.3 — one and two',
      }));
      check('accumulate:the-draft-is-replaced', second.amended === true, JSON.stringify(second));
      check('accumulate:production-does-not-grow-a-commit', sh(repo, ['rev-parse', 'main']).out !== before && sh(repo, ['rev-list', '--count', 'main']).out === countBefore, `${sh(repo, ['rev-list', '--count', 'main']).out} vs ${countBefore}`);
      check('accumulate:the-parent-is-the-one-the-draft-had', sh(repo, ['rev-parse', 'main^']).out === parentBefore, sh(repo, ['rev-parse', 'main^']).out);
      check('accumulate:the-notes-cover-both-blocks', fileAt(repo, 'main', 'CHANGELOG.md').includes('- Two.'));
      check('accumulate:the-replaced-section-does-not-survive', (fileAt(repo, 'main', 'CHANGELOG.md').match(/### 1\.1\.3/g) || []).length === 1, fileAt(repo, 'main', 'CHANGELOG.md'));

      /* --- the dry run: everything but the ref ---------------------------------------- */
      {
        const refBefore = sh(repo, ['rev-parse', 'main']).out;
        const dry = call(repo, base(repo, {
          action: 'dry', version: '1.1.3', from_sha: status.anchor,
          section: '### 1.1.3 — 2026-10-05\n\n- One.\n- Two.\n- Three.\n\n---', message: 'release 1.1.3 — one, two and three',
        }));
        check('dry:it-reports-a-release-without-making-one', dry.ok === true && dry.released === false && dry.dry === true && !!dry.would_be, JSON.stringify(dry));
        check('dry:the-ref-does-not-move', sh(repo, ['rev-parse', 'main']).out === refBefore, sh(repo, ['rev-parse', 'main']).out);
        check('dry:the-changelog-on-production-is-untouched', !fileAt(repo, 'main', 'CHANGELOG.md').includes('- Three.'), fileAt(repo, 'main', 'CHANGELOG.md'));
        check('dry:it-predicts-the-same-amendment-the-release-would-do', dry.amended === true, JSON.stringify(dry));
      }
      check('accumulate:a-from_sha-that-does-not-match-is-refused', (() => {
        const other = fixture('accumulate-refuse');
        const a = call(other, base(other, { action: 'release', version: '1.1.3', section: '### 1.1.3 — 2026-10-05\n\n- One.\n\n---', message: 'release 1.1.3 — one' }));
        void a;
        const r = call(other, base(other, { action: 'release', version: '1.1.3', from_sha: 'deadbeef', section: '### 1.1.3 — 2026-10-05\n\n- One.\n\n---', message: 'release 1.1.3 — one' }));
        return r.ok === false && /from_sha/.test(r.error);
      })());
    }

    /* --- what it refuses ------------------------------------------------ */
    {
      const repo = fixture('refusals');
      const held = join(dir, 'held');
      sh(repo, ['worktree', 'add', '-q', held, 'main']);
      const got = call(repo, base(repo, { action: 'release', version: '1.1.3', section: '### 1.1.3\n\n- x.\n\n---', message: 'release 1.1.3 — x' }));
      check('refuse:a-checked-out-production-blocks-the-release', got.ok === false && /checked out/.test(got.error), JSON.stringify(got));
      sh(repo, ['worktree', 'remove', '--force', held]);
      const bad = call(repo, base(repo, { action: 'release', version: 'one.two', section: 'x', message: 'release x' }));
      check('refuse:a-version-that-is-not-semantic', bad.ok === false && /semantic/.test(bad.error), JSON.stringify(bad));
      const missing = call(repo, Object.assign(base(repo), { action: 'status', work_root: join(dir, 'nowhere') }));
      check('refuse:a-work-root-that-is-not-there', missing.ok === false && /does not exist/.test(missing.error), JSON.stringify(missing));
      const unknown = call(repo, base(repo, { action: 'dance' }));
      check('refuse:an-unknown-action', unknown.ok === false && /unknown action/.test(unknown.error), JSON.stringify(unknown));
      const empty = spawnSync(process.execPath, [join(root, 'architect', 'release.mjs'), root], { cwd: repo, encoding: 'utf-8', input: '' });
      check('refuse:an-empty-stdin', empty.status === 2 && /stdin is empty/.test(empty.stderr), empty.stderr);
    }

    /* --- a whole tree, no `source` -------------------------------------- */
    {
      const repo = join(dir, 'whole');
      mkdirSync(repo, { recursive: true });
      sh(repo, ['init', '-q', '-b', 'develop']);
      sh(repo, ['config', 'user.email', 'bench@daiku']);
      sh(repo, ['config', 'user.name', 'bench']);
      write(join(repo, 'package.json'), '{\n  "name": "x",\n  "version": "2.0.0"\n}\n');
      write(join(repo, 'CHANGELOG.md'), '# Changelog\n\n### 2.0.0 — 2026-09-01\n\n- Old.\n\n---\n');
      sh(repo, ['add', '-A']);
      sh(repo, ['commit', '-qm', 'release 2.0.0 — old']);
      sh(repo, ['branch', 'main']);
      write(join(repo, 'nuovo.js'), 'export const a = 1;\n');
      // The method's seats, which every project has and a product must never ship — plus one path
      // the project itself asked to keep back.
      write(join(repo, '.daiku/project.json'), '{\n  "contract": 1\n}\n');
      write(join(repo, '.daiku/features/x/0. problem.md'), '# x\n');
      write(join(repo, 'CLAUDE.md'), '# instructions\n');
      write(join(repo, '.claude/settings.json'), '{}\n');
      write(join(repo, '.codex/hooks.json'), '{}\n');
      write(join(repo, 'docs/interni.md'), '# internal\n');
      sh(repo, ['add', '-A']);
      sh(repo, ['commit', '-qm', 'feat: nuovo']);
      const got = call(repo, {
        action: 'release', work_root: repo, development: 'develop', production: 'main',
        version_file: 'package.json', version_field: 'version', changelog: 'CHANGELOG.md',
        instructions_file: 'CLAUDE.md', never: ['docs/interni.md'],
        version: '2.0.1', section: '### 2.0.1 — 2026-10-05\n\n- Nuovo.\n\n---', message: 'release 2.0.1 — nuovo',
      });
      check('whole:without-source-the-tree-is-the-project', fileAt(repo, 'main', 'nuovo.js') === 'export const a = 1;\n', JSON.stringify(got));
      check('whole:the-method-footprint-never-reaches-production', ['.daiku/project.json', '.daiku/features/x/0. problem.md', 'CLAUDE.md', '.claude/settings.json', '.codex/hooks.json'].every((p) => fileAt(repo, 'main', p) === null), sh(repo, ['ls-tree', '-r', '--name-only', 'main']).out);
      check('whole:the-projects-own-exclusion-is-honoured', fileAt(repo, 'main', 'docs/interni.md') === null);
      check('whole:the-instructions-file-is-excluded-by-its-declared-name', fileAt(repo, 'main', 'AGENTS.md') === null && fileAt(repo, 'develop', 'CLAUDE.md') === '# instructions\n');
      check('whole:the-status-says-what-will-be-kept-back', call(repo, {
        action: 'status', work_root: repo, development: 'develop', production: 'main',
        version_file: 'package.json', version_field: 'version', changelog: 'CHANGELOG.md',
        instructions_file: 'CLAUDE.md', never: ['docs/interni.md'],
      }).never.join(' ') === '.daiku .claude .codex CLAUDE.md docs/interni.md');
      check('whole:a-branch-tracking-nothing-is-declared-so', call(repo, {
        action: 'status', work_root: repo, development: 'develop', production: 'main',
        version_file: 'package.json', version_field: 'version', changelog: 'CHANGELOG.md',
      }).tracking === false);
      check('whole:the-version-is-written', fileAt(repo, 'main', 'package.json').includes('"2.0.1"'));
      check('whole:the-changelog-keeps-its-history', fileAt(repo, 'main', 'CHANGELOG.md').includes('### 2.0.0'));
    }
  } catch (error) {
    failed.push(`the bench itself broke: ${error && error.message ? error.message : String(error)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  process.stdout.write(`${JSON.stringify({ checks: checks.length, passed: checks.length - failed.length, failed, never_red: neverRed })}\n`);
  process.exit(failed.length ? 1 : 0);
}

/* ------------------------------------------------------------------------- *
 * Entry
 * ------------------------------------------------------------------------- */

function die(message) {
  process.stderr.write(`release: ${message}\n`);
  process.exit(2);
}

function main() {
  const argv = process.argv.slice(2);
  const selfCheck = argv[0] === '--self-check';
  // Resolved, because the bench launches the program with a working directory of its own: a
  // relative root would be read against the fixture and the program would not be found.
  const root = argv[selfCheck ? 1 : 0] ? resolve(argv[selfCheck ? 1 : 0]) : null;
  if (!root) {
    process.stderr.write('usage: node release.mjs <package-root>\n');
    process.stderr.write('       node release.mjs --self-check <package-root>\n');
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
