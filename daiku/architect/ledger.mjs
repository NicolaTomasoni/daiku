#!/usr/bin/env node
/**
 * The disk side of Daiku's review cycle.
 *
 * `architect/architect.mjs` answers and opens no file of the project: everything it needs to
 * know about the disk the agent hands it. This program is the other half, and that is why it is
 * a separate file: it **reads Git and writes the ledger**, which the evaluator by principle never
 * does. What it measures — the tree around each applier, the fixes a round rewrote, the lines a
 * diff added, the areas a perimeter touches, the policies a scope activates — it measures on the
 * disk; every verdict it returns it asks of the evaluator in-process, through the same entry the
 * evaluator's own command uses — its keys checked first, then the question — importing it
 * instead of copying it.
 *
 * It exists because those measurements were prose an agent ran by hand: a `git grep` per anchor
 * that could not see an untracked file, a ledger written by hand and handed to the evaluator on
 * stdin, a list of added lines a finder transcribed into JSON. A measurement an agent performs
 * and reports is a declaration; one a program performs is a measurement.
 *
 * Like the evaluator it **fails loudly**: a missing or malformed input is an error and exit 2,
 * never a silent success, and it never writes a ledger `schemas/blocks.json` § *ledger* refuses.
 *
 *   node <package-root>/architect/ledger.mjs <package-root>
 *       one JSON object on stdin — `action` plus that action's keys — one on stdout, exit 0.
 *
 *   node <package-root>/architect/ledger.mjs --self-check <package-root>
 *       the bench, on throwaway Git repositories under the system temp directory. Counted JSON
 *       `{checks, passed, failed[]}` on stdout, exit 1 on the first red. `hooks/self-check.mjs`
 *       launches it.
 *
 * What it writes, and nothing else: the ledger and the findings files beside it, in the folder
 * the caller names (`{paths.review_state}`), and Git objects. Every tree is written through a
 * throwaway index (`GIT_INDEX_FILE`) seeded from the real one, so the working tree and the real
 * index are never touched, and an untracked file is in the tree like any other.
 *
 * The prose of its actions — when each is called, what it takes and what it returns — lives in
 * the skill hosting it, `skills/review/SKILL.md` § *The ledger tool*.
 */

import { spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, utimesSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ASKS, BadInput, anchorOf, dispatch as ask, globToRegExp, valuesAt } from './architect.mjs';

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

/** `{code_root}` as a prefix: `/` separators, no leading `./`, a trailing `/` unless it is the root. */
function codeRootOf(input) {
  const raw = slashed(text(input, 'code_root')).replace(/^\.\//, '');
  if (raw === '' || raw === '.' || raw === './') return '';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

const pathspecOf = (codeRoot) => codeRoot || '.';

function under(file, prefix) {
  const p = slashed(prefix).replace(/^\.\//, '');
  if (p === '' || p === '.') return true;
  return file === p.replace(/\/$/, '') || file.startsWith(p.endsWith('/') ? p : `${p}/`);
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

/** The empty tree: the base of a review on a repository's first commit, which has no parent. */
function emptyTree(cwd) {
  const run = spawnSync('git', ['mktree'], { cwd, encoding: 'utf-8', input: '' });
  if (run.error) fail(`git cannot start (${run.error.message}): this tool reads the disk through git, which must be on the PATH`);
  if (run.status !== 0) fail(`git mktree failed in ${slashed(cwd)}: ${(run.stderr || '').trim()}`);
  return run.stdout.trim();
}

/** Git prints paths from the repository root; the contracts speak from the technical root. */
function localizer(cwd) {
  const prefix = git(cwd, ['rev-parse', '--show-prefix']).trim();
  const depth = prefix.split('/').filter(Boolean).length;
  return (path) => (path.startsWith(prefix) ? path.slice(prefix.length) : `${'../'.repeat(depth)}${path}`);
}

/**
 * The tree of `{code_root}` as it stands on disk now, untracked files included and ignored ones
 * excluded, written through a throwaway index. Same content, same tree: two snapshots of an
 * unchanged disk return the same SHA.
 *
 * The copy keeps the real index's modification time. Git trusts a file's cached stat only when
 * the file is older than the index that cached it; a copy stamped *now* would make a file edited
 * in the same second as the last index write, at the same size, look unchanged — and the tree
 * would miss the edit.
 */
function snapshot(cwd, codeRoot) {
  const dir = mkdtempSync(join(tmpdir(), 'daiku-tree-'));
  const index = join(dir, 'index');
  try {
    const real = resolve(cwd, git(cwd, ['rev-parse', '--git-path', 'index']).trim());
    if (existsSync(real)) {
      const stamp = statSync(real);
      copyFileSync(real, index);
      utimesSync(index, stamp.atime, stamp.mtime);
    }
    const env = { ...process.env, GIT_INDEX_FILE: index };
    git(cwd, ['add', '-A', '--', pathspecOf(codeRoot)], env);
    return git(cwd, ['write-tree'], env).trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function changedFiles(cwd, from, to, codeRoot, pathspecs) {
  const local = localizer(cwd);
  const out = git(cwd, ['diff', '--name-only', '-z', '--no-renames', from, to, '--', ...(pathspecs || [pathspecOf(codeRoot)])]);
  return out.split('\0').filter(Boolean).map(local).sort();
}

function unquote(path) {
  if (!path.startsWith('"')) return path;
  return path
    .slice(1, -1)
    .replace(/\\([0-7]{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
    .replace(/\\(.)/g, (_, c) => ({ t: '\t', n: '\n', '"': '"', '\\': '\\' }[c] || c));
}

function headerPath(raw) {
  const path = unquote(raw.replace(/\t.*$/, '').trim());
  if (path === '/dev/null') return null;
  return path.replace(/^[ab]\//, '');
}

/**
 * The hunks of `git diff -U0 <from> <to>`, per file: the removed lines and the added lines with
 * their number. A hunk is read by the counts of its header, so a content line that looks like a
 * file header (`--- x`) is never mistaken for one.
 */
function hunksOf(cwd, from, to, codeRoot) {
  const local = localizer(cwd);
  const out = git(cwd, ['diff', '-U0', '--no-renames', '--no-color', '--no-ext-diff', '--no-textconv', from, to, '--', pathspecOf(codeRoot)]);
  const files = new Map();
  const lines = out.split('\n');
  let oldFile = null;
  let file = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('diff --git ')) {
      oldFile = null;
      file = null;
    } else if (line.startsWith('--- ')) oldFile = headerPath(line.slice(4));
    else if (line.startsWith('+++ ')) {
      const path = headerPath(line.slice(4));
      file = local(path === null ? oldFile : path);
    } else {
      const header = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (!header || file === null) continue;
      let removed = header[2] === undefined ? 1 : Number(header[2]);
      let added = header[4] === undefined ? 1 : Number(header[4]);
      let number = Number(header[3]);
      const hunk = { removed: [], added: [] };
      while ((removed > 0 || added > 0) && i + 1 < lines.length) {
        const next = lines[i + 1];
        if (next.startsWith('\\')) {
          i += 1;
        } else if (next.startsWith('-') && removed > 0) {
          hunk.removed.push(next.slice(1).replace(/\r$/, ''));
          removed -= 1;
          i += 1;
        } else if (next.startsWith('+') && added > 0) {
          hunk.added.push({ line: number, text: next.slice(1).replace(/\r$/, '') });
          number += 1;
          added -= 1;
          i += 1;
        } else break;
      }
      if (!files.has(file)) files.set(file, []);
      files.get(file).push(hunk);
    }
  }
  return files;
}

/* ------------------------------------------------------------------------- *
 * The project's declarations: area policies and areas
 * ------------------------------------------------------------------------- */

function unquoteYaml(value) {
  const bare = value.trim().replace(/\s+#.*$/, '');
  const quoted = /^(['"])(.*)\1$/.exec(bare);
  return quoted ? quoted[2] : bare;
}

/** The `paths` of a policy's frontmatter: a block list, an inline list or a single value. */
function frontmatterPaths(content) {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (!lines.length || lines[0].trim() !== '---') return [];
  const end = lines.findIndex((line, at) => at > 0 && line.trim() === '---');
  if (end < 0) return [];
  for (let i = 1; i < end; i += 1) {
    const key = /^paths\s*:\s*(.*)$/.exec(lines[i]);
    if (!key) continue;
    const inline = key[1].trim();
    if (inline.startsWith('[')) return inline.replace(/^\[|\]$/g, '').split(',').map(unquoteYaml).filter(Boolean);
    if (inline) return [unquoteYaml(inline)];
    const out = [];
    for (let j = i + 1; j < end; j += 1) {
      const item = /^\s+-\s*(.*)$/.exec(lines[j]);
      if (item) out.push(unquoteYaml(item[1]));
      else if (lines[j].trim() && !lines[j].trim().startsWith('#')) break;
    }
    return out.filter(Boolean);
  }
  return [];
}

function covers(pattern, file) {
  const p = slashed(pattern).replace(/^\.\//, '');
  if (p.endsWith('/')) return file.startsWith(p);
  return globToRegExp(p).test(file) || (!/[*?[]/.test(p) && file.startsWith(`${p}/`));
}

function policiesOf(dir) {
  let names;
  try {
    names = readdirSync(dir).filter((name) => name.endsWith('.md')).sort();
  } catch {
    return [];
  }
  return names.map((name) => ({
    file: slashed(join(dir, name)),
    paths: frontmatterPaths(readFileSync(join(dir, name), 'utf-8')),
  }));
}

const COMMANDS = ['check_fast', 'lint_fix', 'test_targeted', 'gate', 'coverage'];

function projectOf(input) {
  const path = text(input, 'project');
  let project;
  try {
    project = JSON.parse(readFileSync(resolve(path), 'utf-8'));
  } catch (error) {
    fail(`project ${JSON.stringify(path)} cannot be read as JSON (${error.message}): without .daiku/project.json the review cannot be parameterised`);
  }
  return isObject(project.areas) ? project.areas : {};
}

/**
 * The areas a set of changed files touches, each with its files and the commands it declares.
 * An area's `paths` are Git pathspecs, so Git itself says which files stand under them.
 */
function areasOf(cwd, from, to, codeRoot, declared, files) {
  const inScope = new Set(files);
  const touched = [];
  for (const name of Object.keys(declared).sort()) {
    const area = declared[name];
    const paths = isObject(area) && Array.isArray(area.paths) ? area.paths.filter(nonEmpty) : [];
    if (!paths.length || !files.length) continue;
    const mine = changedFiles(cwd, from, to, codeRoot, paths).filter((file) => inScope.has(file));
    if (!mine.length) continue;
    const commands = {};
    for (const key of COMMANDS) if (isObject(area[key])) commands[key] = area[key];
    touched.push({ area: name, files: mine, commands });
  }
  return touched;
}

/* ------------------------------------------------------------------------- *
 * The ledger — read, validated against schemas/blocks.json § ledger, written whole
 * ------------------------------------------------------------------------- */

function schemasOf(root) {
  try {
    return JSON.parse(readFileSync(join(root, 'schemas', 'blocks.json'), 'utf-8'));
  } catch (error) {
    return fail(`schemas/blocks.json cannot be read under the root ${JSON.stringify(root)}: ${error.message}`);
  }
}

function costFaults(cost, where) {
  if (!Array.isArray(cost)) return [`${where} must be an array`];
  const wrong = [];
  cost.forEach((entry, at) => {
    if (!isObject(entry) || !nonEmpty(entry.step)) {
      wrong.push(`${where}[${at}].step is required: the step the host measured`);
      return;
    }
    const numbers = ['tokens', 'tool_uses', 'seconds'].filter((key) => entry[key] !== undefined && entry[key] !== null);
    if (!numbers.length) wrong.push(`${where}[${at}] carries no number: an entry exists only for what the host reported`);
    for (const key of numbers) {
      if (typeof entry[key] !== 'number' || !Number.isFinite(entry[key]) || entry[key] < 0) {
        wrong.push(`${where}[${at}].${key} must be a non-negative number the host reported`);
      }
    }
    for (const key of Object.keys(entry)) {
      if (!['step', 'tokens', 'tool_uses', 'seconds'].includes(key)) wrong.push(`${where}[${at}].${key} is not a field of a cost entry`);
    }
  });
  return wrong;
}

function validateLedger(ledger, schemas) {
  const spec = schemas.ledger;
  const outcomeOf = schemas.blocks['review-outcome'].enums;
  const gates = schemas.blocks.gate.enums.gate;
  if (!isObject(ledger)) fail('the ledger is not a JSON object');
  const wrong = [];
  for (const key of spec.required) if (!has(ledger, key)) wrong.push(`${key} is missing`);
  for (const key of Object.keys(ledger)) if (!spec.required.includes(key)) wrong.push(`${key} is not a field of the ledger`);
  if (!nonEmpty(ledger.base)) wrong.push('base must be the SHA of the frozen baseline');
  if (ledger.item !== null && !nonEmpty(ledger.item)) wrong.push('item must be the work folder, or null');
  if (!nonEmpty(ledger.scope_tree)) wrong.push('scope_tree must be the tree the scope photographed');
  if (!Array.isArray(ledger.scope_files) || !ledger.scope_files.every(nonEmpty)) wrong.push('scope_files must be the list of scope files');
  const tail = [['outcome', outcomeOf.outcome], ['coverage', outcomeOf.coverage], ['gate', gates]];
  for (const [key, domain] of tail) {
    if (ledger[key] !== null && ledger[key] !== undefined && !domain.includes(ledger[key])) {
      wrong.push(`${key} is ${JSON.stringify(ledger[key])}, outside ${domain.join('|')}`);
    }
  }
  if (ledger.gate_detail !== null && ledger.gate_detail !== undefined && typeof ledger.gate_detail !== 'string') wrong.push('gate_detail must be a string or null');
  if (!Array.isArray(ledger.rounds)) wrong.push('rounds must be an array');
  else {
    const fields = new Set([...spec.round_required, ...(spec.round_optional || [])]);
    ledger.rounds.forEach((round, at) => {
      if (!isObject(round)) {
        wrong.push(`rounds[${at}] is not a round`);
        return;
      }
      for (const key of spec.round_required) if (!has(round, key)) wrong.push(`rounds[${at}].${key} is missing`);
      for (const key of Object.keys(round)) if (!fields.has(key)) wrong.push(`rounds[${at}].${key} is not a field of a round`);
      if (round.n !== at + 1) wrong.push(`rounds[${at}].n must be ${at + 1}`);
      for (const key of ['disciplines', 'missing_disciplines', 'applied', 'discarded', 'to_confirm', 'oscillation', 'check_fast']) {
        if (has(round, key) && !Array.isArray(round[key])) wrong.push(`rounds[${at}].${key} must be an array`);
      }
      for (const key of ['pre_apply_tree', 'post_apply_tree']) if (!nonEmpty(round[key])) wrong.push(`rounds[${at}].${key} must be a tree`);
      if (has(round, 'cost')) wrong.push(...costFaults(round.cost, `rounds[${at}].cost`));
    });
  }
  for (const [path, domain] of Object.entries(spec.enums || {})) {
    for (const got of valuesAt(ledger, path)) if (got !== null && !domain.includes(got)) wrong.push(`${path} is ${JSON.stringify(got)}, outside ${domain.join('|')}`);
  }
  if (wrong.length) fail(`the ledger does not match schemas/blocks.json § ledger: ${wrong.join('; ')}`);
  return ledger;
}

function readJson(path, what) {
  let content;
  try {
    content = readFileSync(path, 'utf-8');
  } catch (error) {
    return fail(`${what} ${slashed(path)} cannot be read: ${error.message}`);
  }
  try {
    return JSON.parse(content);
  } catch (error) {
    return fail(`${what} ${slashed(path)} is not JSON: ${error.message}`);
  }
}

function writeJson(path, value) {
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
  renameSync(temporary, path);
}

function ledgerAt(input, schemas) {
  const path = resolve(text(input, 'ledger'));
  return { path, ledger: validateLedger(readJson(path, 'the ledger'), schemas) };
}

/** The tree the last recorded step left: the scope's before round 1, then each round's after. */
function lastTree(ledger) {
  return ledger.rounds.length ? ledger.rounds[ledger.rounds.length - 1].post_apply_tree : ledger.scope_tree;
}

function findingsPath(ledgerPath, which) {
  return `${ledgerPath.replace(/\.json$/, '')}.${which === 'tests' ? 'tests' : `round-${which}`}.findings.json`;
}

/* ------------------------------------------------------------------------- *
 * The measurement the cycle decides on: does a fix rewrite a previous one?
 * ------------------------------------------------------------------------- */

/** The anchor as the ledger compares it, with the truncation mark of a long line dropped. */
function anchorKey(anchor) {
  return anchorOf(anchor).replace(/(?:…|\.\.\.)$/, '').trim();
}

function carries(line, key) {
  if (!key) return false;
  const normal = anchorOf(line);
  return normal === key || normal.startsWith(key);
}

/**
 * `on_previous_fix`, measured on the delta the applier wrote, tree against tree: a fix of this
 * round rewrites a previous one when the anchor of a fix recorded earlier in the same file stands
 * among the lines a hunk of this round removed. The hunk is the fix's own — the one whose added
 * lines carry its anchor — and a hunk no fix of the round claims counts for every fix of that
 * file, because a rewrite nobody claims is still a rewrite.
 */
function measure(previous, applied, hunks) {
  const byFile = new Map();
  for (const fix of applied) {
    if (!byFile.has(fix.file)) byFile.set(fix.file, []);
    byFile.get(fix.file).push(fix);
  }
  const measured = new Map();
  for (const [file, fixes] of byFile) {
    const fileHunks = hunks.get(file) || [];
    const prior = previous.filter((fix) => fix.file === file).map((fix) => anchorKey(fix.anchor)).filter(Boolean);
    const rewrites = (hunk) => prior.some((key) => hunk.removed.some((line) => carries(line, key)));
    const owners = fileHunks.map((hunk) => fixes.filter((fix) => hunk.added.some((row) => carries(row.text, anchorKey(fix.anchor)))));
    const orphans = fileHunks.filter((_, at) => !owners[at].length);
    for (const fix of fixes) {
      const own = fileHunks.filter((_, at) => owners[at].includes(fix));
      measured.set(fix, own.some(rewrites) || orphans.some(rewrites));
    }
  }
  return measured;
}

/* ------------------------------------------------------------------------- *
 * The actions
 * ------------------------------------------------------------------------- */

function answer(fields) {
  return { ok: true, action: null, ledger: null, verdict: null, detail: '', ...fields };
}

function stamp(date) {
  return [date.getHours(), date.getMinutes(), date.getSeconds()].map((n) => String(n).padStart(2, '0')).join('');
}

/**
 * The base of a review on a commit already made: the first parent of the commit under review.
 *
 * The diff of this cycle always runs to the working tree, so the commit under review has to be
 * the one that tree holds: a commit standing below the tip is not in it, and reviewing it here
 * would silently review everything landed above it as well. A repository's first commit has no
 * parent, and there the base is the empty tree — the diff is the whole first commit.
 *
 * A `commit` naming a **ref** is a caller mistake and never a coincidence: a ref is the base of
 * the diff, and the two keys are the two readings of the same argument, never a choice — so the
 * refusal names the right one instead of resolving it into a review of the wrong range.
 */
function baseOfCommit(cwd, revision) {
  const commit = git(cwd, ['rev-parse', '--verify', `${revision}^{commit}`]).trim();
  if (git(cwd, ['rev-parse', '--symbolic-full-name', revision]).trim() !== '') {
    fail(`commit must be the revision of the commit under review, naming no ref: ${revision} names a ref, which is the base the diff runs from — pass it as base_ref`);
  }
  const head = git(cwd, ['rev-parse', 'HEAD']).trim();
  if (commit !== head) {
    fail(`the commit under review is not the one the working tree holds: ${revision} is ${commit.slice(0, 7)} and HEAD is ${head.slice(0, 7)}. The diff of this cycle runs to the working tree — check that commit out, or pass it as base_ref to review everything from it on`);
  }
  const parents = git(cwd, ['rev-list', '--parents', '-n', '1', commit]).trim().split(/\s+/).filter(Boolean);
  return { base: parents.length > 1 ? parents[1] : emptyTree(cwd), commit };
}

/** scope — § *Scope* and § *Baseline and ledger*: the frozen base, the photographed tree, the files, `arch`. */
function actScope(input, root) {
  const schemas = schemasOf(root);
  const cwd = workRootOf(input);
  const codeRoot = codeRootOf(input);
  const underReview = has(input, 'commit') && input.commit !== null;
  if (underReview === nonEmpty(input.base_ref)) {
    fail('pass exactly one of base_ref (the base the diff runs from) and commit (the commit under review, a revision naming no ref)');
  }
  if (underReview && !nonEmpty(input.commit)) fail('commit must be a non-empty string: the revision of the commit under review');
  if (!Array.isArray(input.paths) || !input.paths.every(nonEmpty)) fail('paths is required: the path list restricting the scope, or []');
  const policies = text(input, 'policies');
  if (!has(input, 'item') || (input.item !== null && !nonEmpty(input.item))) fail('item is required: the work folder, or null for a naked base-ref');
  if (underReview && input.item !== null) {
    fail(`commit and item are the two readings of two different inputs: a commit under review is launched by hand and carries no work folder, while a base-ref declared by a 4. review-notes.md carries the folder holding it — got item ${JSON.stringify(input.item)}`);
  }
  const handed = has(input, 'ledger') && input.ledger !== null;
  if (handed === (has(input, 'state_dir') && input.state_dir !== null)) {
    fail('pass exactly one of ledger (the handed ledger, reopened at the scope) and state_dir (the folder a new ledger opens in)');
  }

  const reviewed = underReview ? baseOfCommit(cwd, input.commit) : null;
  const base = reviewed ? reviewed.base : git(cwd, ['rev-parse', '--verify', `${input.base_ref}^{commit}`]).trim();
  const tree = snapshot(cwd, codeRoot);
  let files = changedFiles(cwd, base, tree, codeRoot);
  if (input.paths.length) files = files.filter((file) => input.paths.some((path) => under(file, path)));
  const matched = policiesOf(resolve(policies)).filter((policy) => policy.paths.some((pattern) => files.some((file) => covers(pattern, file))));
  const found = { base, tree, files, arch_active: matched.length > 0, arch_policies: matched.map((policy) => policy.file) };
  if (!files.length) {
    return answer({ action: 'scope', verdict: 'empty', ...found, detail: 'no file under code_root differs from the base: there is nothing to review, and no ledger was opened.' });
  }

  let path;
  let ledger;
  if (handed) {
    ({ path, ledger } = ledgerAt(input, schemas));
    if (ledger.base !== base || ledger.item !== input.item) {
      fail(`the handed ledger is another review's: base ${ledger.base} and item ${JSON.stringify(ledger.item)}, this one is base ${base} and item ${JSON.stringify(input.item)}`);
    }
    if (ledger.rounds.length) fail(`the handed ledger already records ${ledger.rounds.length} rounds: it resumes from the finder, not from the scope`);
    ledger.scope_tree = tree;
    ledger.scope_files = files;
  } else {
    const dir = resolve(text(input, 'state_dir'));
    mkdirSync(dir, { recursive: true });
    path = join(dir, `review-ledger-${base.slice(0, 7)}-${stamp(new Date())}.json`);
    if (existsSync(path)) fail(`${slashed(path)} already exists: a ledger is never overwritten — ask again in a second`);
    ledger = { base, item: input.item, scope_tree: tree, scope_files: files, rounds: [], outcome: null, coverage: null, gate: null, gate_detail: null };
  }
  writeJson(path, validateLedger(ledger, schemas));
  return answer({
    action: 'scope', ledger: slashed(path), verdict: 'scoped', ...found,
    detail: reviewed
      ? `review of the commit ${reviewed.commit.slice(0, 7)}: ${files.length} files differ from its first parent under code_root, untracked ones included; arch is ${matched.length ? 'active' : 'inactive'}.`
      : `${files.length} files differ from ${base.slice(0, 7)} under code_root, untracked ones included; arch is ${matched.length ? 'active' : 'inactive'}.`,
  });
}

const FINDER_KEY = /^(bug|arch|perf|dead)(\d*)$/;

/** findings — § *Finder*: every finder block validated, every finding numbered, one file per round. */
function actFindings(input, root) {
  const schemas = schemasOf(root);
  const { path, ledger } = ledgerAt(input, schemas);
  const closing = input.closing === true;
  if (closing ? ledger.outcome === null : ledger.outcome !== null) {
    fail(closing ? 'the closing round on tests runs after the cycle exited, and it has not' : `the cycle already exited by ${ledger.outcome}: no round opens after an exit`);
  }
  if (!isObject(input.blocks) || !Object.keys(input.blocks).length) fail('blocks is required: {"<discipline>[<shard>]": <the finder block, parsed, or null>}');
  const n = ledger.rounds.length + 1;
  const file = findingsPath(path, closing ? 'tests' : n);
  const state = existsSync(file) ? readJson(file, 'the findings file') : { round: closing ? 'tests' : n, keys: {}, applier_attempts: 0, findings: [] };
  for (const [key, block] of Object.entries(input.blocks)) {
    const match = FINDER_KEY.exec(key);
    if (!match) fail(`blocks.${key}: a key is a discipline — bug, arch, perf, dead — with an optional shard number`);
    if (closing && match[1] !== 'bug') fail('the closing round on tests runs the bug finder alone');
    const prior = state.keys[key];
    if (prior && prior.valid) fail(`blocks.${key} already came back valid in this round: a finder is not run twice`);
    const attempts = (prior ? prior.attempts : 0) + 1;
    if (attempts > 2) fail(`blocks.${key} failed twice already: the ceiling is one relaunch`);
    const verdict = ask({ question: 'block', name: 'finder', block }, root);
    state.keys[key] = {
      discipline: match[1], attempts, valid: verdict.verdict === 'valid', blockers: verdict.blockers,
      returned: !!block && typeof block === 'object' && !Array.isArray(block),
      findings: verdict.verdict === 'valid' ? block.findings : [],
    };
  }
  const order = (key) => `${['bug', 'arch', 'perf', 'dead'].indexOf(FINDER_KEY.exec(key)[1])}${key.padStart(8, '0')}`;
  const findings = [];
  const prefix = closing ? 't' : `r${n}`;
  for (const key of Object.keys(state.keys).sort((a, b) => order(a).localeCompare(order(b)))) {
    state.keys[key].findings.forEach((finding, at) => {
      findings.push({ finding_id: `${prefix}-${key}-${at + 1}`, discipline: state.keys[key].discipline, ...finding });
    });
  }
  if (!closing && n > 1) {
    ledger.rounds[n - 2].check_fast.filter((check) => check.status === 'red').forEach((check, at) => {
      findings.push({
        finding_id: `${prefix}-check-${at + 1}`, discipline: 'check', file: (check.files || []).join(' '), line: 0, symbol: '',
        confidence: 'high', change: '', description: `the fast check of area ${check.area} is red on the files round ${n - 1} touched: ${check.detail}`,
      });
    });
  }
  state.findings = findings;
  writeJson(file, state);
  const keys = Object.entries(state.keys);
  const relaunch = keys.filter(([, entry]) => !entry.valid && entry.attempts === 1).map(([key]) => key);
  const missing = [...new Set(keys.filter(([, entry]) => !entry.valid && entry.attempts === 2).map(([, entry]) => entry.discipline))];
  return answer({
    action: 'findings', ledger: slashed(path), verdict: relaunch.length ? 'relaunch' : 'ready',
    findings_file: slashed(file), count: findings.length, finding_ids: findings.map((finding) => finding.finding_id), relaunch, missing,
    detail: relaunch.length
      ? `relaunch ${relaunch.join(', ')} once: ${keys.filter(([k]) => relaunch.includes(k)).map(([k, e]) => (e.returned ? `${k} with what the validation said: ${e.blockers.join('; ')}` : `${k} with the identical prompt — it did not come back`)).join(' | ')}`
      : `${findings.length} findings numbered in ${slashed(file)}${missing.length ? `; missed disciplines: ${missing.join(', ')}` : ''}.`,
  });
}

/** areas — § *Coverage*, § *Gate* and the fast check: which areas a span touches, with their commands. */
function actAreas(input, root) {
  const schemas = schemasOf(root);
  const { path, ledger } = ledgerAt(input, schemas);
  const cwd = workRootOf(input);
  const codeRoot = codeRootOf(input);
  if (!['base', 'last'].includes(input.from)) fail('from is required: "base" (the whole work) or "last" (what changed after the last recorded step)');
  const from = input.from === 'base' ? ledger.base : lastTree(ledger);
  const to = snapshot(cwd, codeRoot);
  const files = changedFiles(cwd, from, to, codeRoot);
  const areas = areasOf(cwd, from, to, codeRoot, projectOf(input), files);
  const targeted = areas.some((area) => area.commands.test_targeted);
  return answer({
    action: 'areas', ledger: slashed(path), verdict: areas.length ? 'touched' : 'untouched', from, to, files, areas, test_targeted: targeted,
    detail: `${files.length} files changed from ${input.from === 'base' ? 'the base' : 'the last recorded step'}, in ${areas.length} areas; ${targeted ? 'at least one declares' : 'none declares'} test_targeted.`,
  });
}

const CHECK_OUTCOMES = ['green', 'red'];

function checksOf(input, areas) {
  const given = input.check_fast === undefined ? [] : input.check_fast;
  if (!Array.isArray(given)) fail('check_fast must be an array of {"area", "status": "green"|"red", "detail"}');
  const declaring = new Map(areas.filter((area) => area.commands.check_fast).map((area) => [area.area, area]));
  const seen = new Set();
  const out = [];
  given.forEach((entry, at) => {
    if (!isObject(entry) || !nonEmpty(entry.area) || !CHECK_OUTCOMES.includes(entry.status) || typeof entry.detail !== 'string') {
      fail(`check_fast[${at}] must be {"area", "status": "green"|"red", "detail": <the output, or "">}`);
    }
    if (!declaring.has(entry.area)) fail(`check_fast[${at}]: area ${entry.area} is not an area this round touched that declares check_fast`);
    if (seen.has(entry.area)) fail(`check_fast[${at}]: area ${entry.area} is reported twice`);
    seen.add(entry.area);
    out.push({ area: entry.area, status: entry.status, detail: entry.detail.slice(0, 2000), files: declaring.get(entry.area).files });
  });
  for (const area of areas) {
    if (area.commands.check_fast && !seen.has(area.area)) {
      fail(`check_fast declared on area ${area.area}, which this round touched: run it on ${area.files.join(' ')} and pass its status`);
    }
    if (!area.commands.check_fast) out.push({ area: area.area, status: 'skipped', detail: 'the area declares no check_fast', files: area.files });
  }
  return out;
}

/** round — § *Applier* and § *When to run another round*: the round measured, recorded and judged. */
function actRound(input, root) {
  const schemas = schemasOf(root);
  const { path, ledger } = ledgerAt(input, schemas);
  const cwd = workRootOf(input);
  const codeRoot = codeRootOf(input);
  const closing = input.closing === true;
  if (closing ? ledger.outcome === null : ledger.outcome !== null) {
    fail(closing ? 'the closing round on tests runs after the cycle exited, and it has not' : `the cycle already exited by ${ledger.outcome}: no round opens after an exit`);
  }
  const n = ledger.rounds.length + 1;
  const file = findingsPath(path, closing ? 'tests' : n);
  if (!existsSync(file)) fail(`no findings were recorded for ${closing ? 'the closing round on tests' : `round ${n}`}: the findings action comes first`);
  const state = readJson(file, 'the findings file');
  const pending = Object.entries(state.keys).filter(([, entry]) => !entry.valid && entry.attempts === 1).map(([key]) => key);
  if (pending.length) fail(`${pending.join(', ')} came back malformed once and was not relaunched: the relaunch comes before the applier`);
  const ids = state.findings.map((finding) => finding.finding_id);

  let merit = null;
  let meritWhy = '';
  if (!closing) {
    if (!has(input, 'rounds_cap') || (input.rounds_cap !== null && !(Number.isInteger(input.rounds_cap) && input.rounds_cap > 0))) {
      fail('rounds_cap is required: the N of an explicit --rounds N, or null');
    }
    if (ids.length) {
      if (!['continue', 'stop'].includes(input.merit) || !nonEmpty(input.merit_why)) {
        fail('merit ("continue"|"stop") and merit_why are required when the applier ran: rule 3 may need them, and the block is not handed over twice');
      }
      merit = input.merit;
      meritWhy = input.merit_why;
    }
    if (input.cost !== undefined) {
      const wrong = costFaults(input.cost, 'cost');
      if (wrong.length) fail(wrong.join('; '));
    }
  }

  let block;
  let failed = false;
  if (!ids.length) {
    if (input.applier !== undefined && input.applier !== null) fail('this round had no finding: the applier is not launched, and no applier block is passed');
    block = { applied: [], discarded: [], to_confirm: [], oscillation: [] };
  } else {
    if (!has(input, 'applier')) fail('applier is required: the block the applier returned, parsed, or null if nothing came back');
    const verdict = ask({ question: 'block', name: 'applier', block: input.applier, finding_ids: ids }, root);
    if (verdict.verdict === 'valid') block = input.applier;
    else {
      state.applier_attempts = (state.applier_attempts || 0) + 1;
      writeJson(file, state);
      if (state.applier_attempts < 2) {
        const returned = !!input.applier && typeof input.applier === 'object' && !Array.isArray(input.applier);
        return answer({
          action: 'round', ledger: slashed(path), verdict: 'retry', blockers: verdict.blockers,
          detail: returned
            ? `the applier block is not valid — ${verdict.blockers.join('; ')}. It came back, and this is what it came back wrong with: relaunch the applier once with these, not with the identical prompt.`
            : `the applier did not come back. Relaunch the applier once with the identical prompt.`,
        });
      }
      failed = true;
      block = {
        applied: [], discarded: [], oscillation: [],
        to_confirm: [{
          finding_id: null, file: '', line: 0, class: 'bug', blocking: true,
          scenario: `the applier did not return a valid block twice, so nobody decided these findings: ${ids.join(', ')}. Whatever it wrote is in the gate perimeter, unreviewed.`,
        }],
      };
    }
  }

  const pre = lastTree(ledger);
  const post = snapshot(cwd, codeRoot);
  const touched = changedFiles(cwd, pre, post, codeRoot);
  const declared = new Set(block.applied.map((fix) => fix.file));
  const deviations = [];
  const undeclared = touched.filter((changed) => !declared.has(changed));
  if (undeclared.length && !failed && !closing) {
    deviations.push(`changed with no applied fix naming them: ${undeclared.join(', ')} — the next round judges them, if there is one`);
  }

  if (closing) {
    const last = ledger.rounds[ledger.rounds.length - 1];
    last.to_confirm.push(...block.to_confirm);
    writeJson(path, validateLedger(ledger, schemas));
    return answer({
      action: 'round', ledger: slashed(path), verdict: failed ? 'failed' : 'recorded', from: pre, to: post, touched, deviations,
      detail: `closing round on tests: ${block.applied.length} applied, ${block.discarded.length} discarded, ${block.to_confirm.length} to confirm, recorded on round ${last.n}; it counts in no round.`,
    });
  }

  const areas = areasOf(cwd, pre, post, codeRoot, projectOf(input), touched);
  const checks = failed ? [] : checksOf(input, areas);
  const previous = ledger.rounds.flatMap((round) => round.applied);
  const applied = block.applied.map((fix) => ({ ...fix, anchor: anchorOf(fix.anchor) }));
  const measured = measure(previous, applied, touched.length ? hunksOf(cwd, pre, post, codeRoot) : new Map());
  for (const fix of applied) {
    const value = measured.get(fix) === true;
    if (fix.on_previous_fix !== value) {
      deviations.push(`${fix.file} "${fix.anchor}": the applier declared on_previous_fix ${fix.on_previous_fix}, the trees measure ${value}`);
    }
    fix.on_previous_fix = value;
  }

  const disciplines = [];
  const missing = [];
  for (const entry of Object.values(state.keys)) {
    if (!entry.valid && !missing.includes(entry.discipline)) missing.push(entry.discipline);
  }
  for (const entry of Object.values(state.keys)) {
    if (entry.valid && !missing.includes(entry.discipline) && !disciplines.includes(entry.discipline)) disciplines.push(entry.discipline);
  }
  const round = {
    n, disciplines, missing_disciplines: missing, pre_apply_tree: pre, post_apply_tree: post,
    applied, discarded: block.discarded, to_confirm: block.to_confirm, oscillation: block.oscillation, check_fast: checks,
    verdict: null, why: null,
  };
  if (input.cost !== undefined) round.cost = input.cost;
  if (deviations.length) round.deviations = deviations;
  const trial = { ...ledger, rounds: [...ledger.rounds, round] };
  let verdict = ask({ question: 'round', ledger: trial, rounds_cap: input.rounds_cap }, root);
  let why = verdict.detail;
  if (verdict.verdict === 'merit') {
    verdict = ask({ question: 'round', ledger: trial, rounds_cap: input.rounds_cap, merit }, root);
    why = `${verdict.detail} Merit: ${meritWhy}`;
  }
  if (failed) why = `the applier did not return a valid block twice: the round stops with its findings as a blocking item. ${why}`;
  round.verdict = verdict.verdict === 'continue' && !failed ? 'continue' : 'stop';
  round.why = why;
  if (round.verdict === 'stop') trial.outcome = verdict.verdict === 'continue' ? 'fixed-point' : verdict.verdict;
  writeJson(path, validateLedger(trial, schemas));
  return answer({
    action: 'round', ledger: slashed(path), verdict: round.verdict === 'continue' ? 'continue' : trial.outcome, detail: why, n,
    from: pre, to: post, touched, deviations, missing_disciplines: missing, blockers: verdict.blockers,
  });
}

const TAIL_DISCIPLINES = ['bug', 'arch', 'perf', 'dead', 'test-coverage'];

/** tail — § *The ledger also keeps what blocks*: coverage, gate and what the tail adds to the last round. */
function actTail(input, root) {
  const schemas = schemasOf(root);
  const { path, ledger } = ledgerAt(input, schemas);
  const keys = ['coverage', 'gate', 'gate_detail', 'missing', 'to_confirm'].filter((key) => has(input, key));
  if (!keys.length) fail('tail writes at least one of coverage, gate, gate_detail, missing, to_confirm');
  if (ledger.outcome === null) fail('the cycle has not exited: coverage, gate and what they add come after it');
  const last = ledger.rounds[ledger.rounds.length - 1];
  if (has(input, 'coverage')) {
    if (input.coverage === 'no-test-command') {
      const cwd = workRootOf(input);
      const codeRoot = codeRootOf(input);
      const files = changedFiles(cwd, ledger.base, snapshot(cwd, codeRoot), codeRoot);
      const areas = areasOf(cwd, ledger.base, snapshot(cwd, codeRoot), codeRoot, projectOf(input), files);
      const declaring = areas.filter((area) => area.commands.test_targeted).map((area) => area.area);
      if (declaring.length) fail(`coverage cannot be no-test-command: ${declaring.join(', ')} declare test_targeted and the diff touches them`);
    }
    ledger.coverage = input.coverage;
  }
  if (has(input, 'gate')) ledger.gate = input.gate;
  if (has(input, 'gate_detail')) ledger.gate_detail = input.gate_detail;
  if (has(input, 'missing')) {
    if (!Array.isArray(input.missing) || !input.missing.every((name) => TAIL_DISCIPLINES.includes(name))) {
      fail(`missing must be a list of ${TAIL_DISCIPLINES.join('|')}`);
    }
    for (const name of input.missing) if (!last.missing_disciplines.includes(name)) last.missing_disciplines.push(name);
  }
  if (has(input, 'to_confirm')) {
    if (!Array.isArray(input.to_confirm) || !input.to_confirm.every((item) => isObject(item) && typeof item.blocking === 'boolean' && nonEmpty(item.scenario))) {
      fail('to_confirm must be a list of items with a scenario and a boolean blocking');
    }
    last.to_confirm.push(...input.to_confirm);
  }
  writeJson(path, validateLedger(ledger, schemas));
  return answer({ action: 'tail', ledger: slashed(path), verdict: 'written', detail: `written: ${keys.join(', ')}.` });
}

/** layers — `skills/arch-check/SKILL.md` § *How you verify*: the added lines computed, the check asked. */
function actLayers(input, root) {
  const schemas = schemasOf(root);
  const { path, ledger } = ledgerAt(input, schemas);
  const cwd = workRootOf(input);
  const codeRoot = codeRootOf(input);
  if (!Array.isArray(input.layers)) fail('layers is required: the layers: blocks of the opened policies, each with its policy file');
  const scope = new Set(ledger.scope_files);
  const added = [];
  for (const [file, hunks] of hunksOf(cwd, ledger.base, ledger.scope_tree, codeRoot)) {
    if (!scope.has(file)) continue;
    for (const hunk of hunks) for (const row of hunk.added) added.push({ file, line: row.line, text: row.text });
  }
  const verdict = ask({ question: 'layers', layers: input.layers, added }, root);
  return answer({
    action: 'layers', ledger: slashed(path), verdict: verdict.verdict, answer: verdict, added: added.length,
    detail: `${added.length} added lines of the scope checked: ${verdict.detail}`,
  });
}

/** ask — any question of the evaluator that reads the ledger, with the ledger read from disk. */
function actAsk(input, root) {
  const question = input.question;
  if (!isObject(question) || !nonEmpty(question.question) || !has(ASKS, question.question)) {
    fail(`question is required: the evaluator's input, one of ${Object.keys(ASKS).join(', ')}, without its ledger`);
  }
  if (has(question, 'ledger')) fail('question.ledger is not passed: the ledger is read from the path in ledger');
  if (!has(input, 'ledger')) fail('ledger is required: the path of the ledger, or null');
  let value = null;
  let path = null;
  if (input.ledger !== null) {
    path = resolve(text(input, 'ledger'));
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf-8');
      try {
        value = JSON.parse(content);
      } catch {
        value = content;
      }
    }
  }
  const verdict = ask({ ...question, ledger: value }, root);
  return answer({ action: 'ask', ledger: path && slashed(path), verdict: verdict.verdict, answer: verdict, detail: verdict.detail });
}

const ACTIONS = {
  scope: actScope,
  findings: actFindings,
  areas: actAreas,
  round: actRound,
  tail: actTail,
  layers: actLayers,
  ask: actAsk,
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
  /** A refusal counts only for its own reason: `because` is a fragment of the message it must carry. */
  const refused = (name, input, because) => {
    try {
      call(input);
      check(name, false, 'it answered instead of failing loudly');
    } catch (error) {
      const ok = error instanceof BadInput && String(error.message).includes(because);
      check(name, ok, ok ? '' : `refused for another reason: ${error.message}`);
    }
  };
  /** A call whose failure is itself the finding: it returns the refusal instead of throwing. */
  const settle = (input) => {
    try {
      return call(input);
    } catch (error) {
      return { verdict: `refused: ${error.message}` };
    }
  };
  const attempt = (name, fn) => {
    try {
      fn();
    } catch (error) {
      check(name, false, `threw ${error && error.message}`);
    }
  };

  const gitOk = spawnSync('git', ['--version'], { encoding: 'utf-8' });
  if (gitOk.error || gitOk.status !== 0) {
    check('bench:git-on-the-path', false, 'git is not on the PATH: this bench runs real Git on throwaway repositories');
    return report(checks, failed);
  }

  const home = mkdtempSync(join(tmpdir(), 'daiku-ledger-bench-'));
  const sh = (cwd, args) => {
    const run = spawnSync('git', args, { cwd, encoding: 'utf-8' });
    if (run.status !== 0) throw new Error(`git ${args.join(' ')}: ${run.stderr}`);
    return run.stdout;
  };
  const put = (file, content) => {
    mkdirSync(resolve(file, '..'), { recursive: true });
    writeFileSync(file, content, 'utf-8');
  };

  /** A repository whose technical root is a subfolder, with code under src/ and a file outside it. */
  const fixture = (name) => {
    const dir = join(home, name);
    const repo = join(dir, 'repo');
    const cwd = join(repo, 'tech');
    mkdirSync(join(cwd, 'src'), { recursive: true });
    sh(repo, ['init', '-q']);
    sh(repo, ['config', 'user.email', 'bench@example.invalid']);
    sh(repo, ['config', 'user.name', 'bench']);
    sh(repo, ['config', 'commit.gpgsign', 'false']);
    put(join(cwd, 'src', 'a.js'), 'function f() {\n\treturn  1;\n}\n\nfunction g() {\n  return 2;\n}\n');
    put(join(cwd, 'src', 'b.js'), 'export const b = 1;\n');
    put(join(cwd, 'docs', 'x.md'), 'doc\n');
    put(join(repo, 'top.txt'), 'top\n');
    put(join(cwd, '.gitignore'), 'build/\n');
    sh(repo, ['add', '-A']);
    sh(repo, ['commit', '-q', '-m', 'init']);
    const policies = join(dir, 'policies');
    mkdirSync(policies, { recursive: true });
    put(join(dir, 'project.json'), JSON.stringify({
      contract: 1,
      areas: {
        web: { paths: ['src/'], gate: { cwd: '.', run: ['true'] }, check_fast: { cwd: '.', run: ['true <FILES>'] } },
        docs: { paths: ['docs/'], gate: { cwd: '.', run: ['true'] } },
        assets: { paths: ['src/assets/'], gate: { cwd: '.', run: ['true'] } },
      },
    }));
    return {
      dir, repo, cwd, policies, state: join(dir, 'state'), project: join(dir, 'project.json'),
      base: (extra = {}) => ({ work_root: cwd, code_root: 'src/', ...extra }),
    };
  };
  const scopeOf = (fx, extra = {}) => call({
    action: 'scope', ...fx.base(), base_ref: 'HEAD', paths: [], policies: fx.policies, item: 'studies/x', state_dir: fx.state, ...extra,
  });
  const bug = (file, line, extra = {}) => ({ file, line, symbol: 'f', confidence: 'high', change: 'x', description: 'y', ...extra });
  const fix = (id, file, anchor, extra = {}) => ({
    finding_id: id, file, symbol: 'f', anchor, line: 1, what: 'x', severe: false, on_previous_fix: false, ...extra,
  });
  const closeRound = (fx, ledger, extra = {}) => call({
    action: 'round', ledger, ...fx.base(), project: fx.project, rounds_cap: null, merit: 'stop', merit_why: 'refinements only', check_fast: [], ...extra,
  });

  try {
    /* --- scope: the untracked file, the perimeter, the restriction, arch --- */
    attempt('scope', () => {
      const fx = fixture('scope');
      put(join(fx.cwd, 'src', 'new.js'), 'export const n = 1;\n');
      put(join(fx.cwd, 'src', 'a.js'), 'function f() {\n\treturn  3;\n}\n');
      put(join(fx.cwd, 'docs', 'x.md'), 'changed\n');
      put(join(fx.cwd, 'src', 'build', 'out.js'), 'ignored\n');
      put(join(fx.policies, 'web.md'), '---\npaths:\n  - "src/**"\nlayers:\n  - name: api\n    folders: ["src/api/**"]\n    deny_imports: ["src/db"]\n---\n# Web\n');
      put(join(fx.policies, 'lib.md'), '---\npaths: ["lib/**"]\n---\n# Lib\n');
      put(join(fx.policies, 'README.md'), '# Area policies\n\n```markdown\n---\npaths:\n  - "src/**"\n---\n```\n');
      const indexBefore = readFileSync(join(fx.repo, '.git', 'index'));
      const statusBefore = sh(fx.cwd, ['status', '--porcelain']);
      const got = scopeOf(fx);
      check('scope:an-untracked-file-is-in-the-scope', got.files.includes('src/new.js'), JSON.stringify(got.files));
      check('scope:a-modified-file-is-in-the-scope', got.files.includes('src/a.js'), JSON.stringify(got.files));
      check('scope:outside-code-root-is-not-in-the-scope', !got.files.includes('docs/x.md'), JSON.stringify(got.files));
      check('scope:an-ignored-file-is-not-in-the-scope', !got.files.some((f) => f.includes('/build/')), JSON.stringify(got.files));
      check('scope:arch-active-when-a-policy-covers-a-file', got.arch_active === true && got.arch_policies.length === 1 && got.arch_policies[0].endsWith('web.md'), JSON.stringify(got.arch_policies));
      check('scope:the-real-index-is-untouched', readFileSync(join(fx.repo, '.git', 'index')).equals(indexBefore), 'the real index changed');
      check('scope:the-working-tree-is-untouched', sh(fx.cwd, ['status', '--porcelain']) === statusBefore, 'git status changed');
      const ledger = readJson(got.ledger, 'ledger');
      check('scope:the-ledger-opens-with-the-photographed-tree', ledger.scope_tree === got.tree && ledger.rounds.length === 0 && ledger.item === 'studies/x', JSON.stringify(ledger));
      check('scope:the-ledger-is-named-by-its-base', /review-ledger-[0-9a-f]{7}-\d{6}\.json$/.test(got.ledger), got.ledger);
      const restricted = scopeOf(fx, { paths: ['src/a.js'], state_dir: join(fx.dir, 'state2') });
      check('scope:the-path-list-restricts-inside-code-root', JSON.stringify(restricted.files) === '["src/a.js"]', JSON.stringify(restricted.files));
      const narrow = scopeOf(fx, { paths: ['src/b.js'], state_dir: join(fx.dir, 'state3') });
      check('scope:a-path-with-no-modification-gives-an-empty-scope', narrow.verdict === 'empty' && narrow.ledger === null && !existsSync(join(fx.dir, 'state3')), JSON.stringify(narrow));
      refused('scope:a-handed-ledger-of-another-item-is-refused', {
        action: 'scope', ...fx.base(), base_ref: 'HEAD', paths: [], policies: fx.policies, item: 'studies/other', ledger: got.ledger,
      }, 'another review\'s');
      refused('scope:ledger-and-state-dir-together-are-refused', {
        action: 'scope', ...fx.base(), base_ref: 'HEAD', paths: [], policies: fx.policies, item: 'studies/x', ledger: got.ledger, state_dir: fx.state,
      }, 'pass exactly one of ledger');
      refused('scope:a-base-ref-that-does-not-resolve-carries-the-reason', {
        action: 'scope', ...fx.base(), base_ref: 'not-a-real-ref', paths: [], policies: fx.policies, item: 'studies/bad-ref', state_dir: join(fx.dir, 'state4'),
      }, 'fatal:');
    });

    attempt('scope-arch', () => {
      const fx = fixture('scope-arch');
      put(join(fx.cwd, 'src', 'b.js'), 'export const b = 2;\n');
      put(join(fx.policies, 'lib.md'), '---\npaths: ["lib/**"]\n---\n# Lib\n');
      put(join(fx.policies, 'README.md'), '# Area policies\n\npaths:\n  - "src/**"\n\n---\n\n```markdown\n---\npaths:\n  - "src/**"\n---\n```\n');
      const got = scopeOf(fx);
      check('scope:arch-inactive-when-no-policy-covers', got.arch_active === false, JSON.stringify(got.arch_policies));
      put(join(fx.policies, 'inline.md'), '---\npaths: ["src/*.js"]\n---\n# Inline\n');
      const again = scopeOf(fx, { state_dir: join(fx.dir, 'state2') });
      check('scope:an-inline-paths-list-is-read', again.arch_active === true, JSON.stringify(again.arch_policies));
    });

    attempt('scope-commit', () => {
      const fx = fixture('scope-commit');
      put(join(fx.cwd, 'src', 'a.js'), 'function f() {\n\treturn  2;\n}\n');
      put(join(fx.cwd, 'src', 'new.js'), 'export const n = 1;\n');
      sh(fx.repo, ['add', '-A']);
      sh(fx.repo, ['commit', '-q', '-m', 'second']);
      const tip = sh(fx.cwd, ['rev-parse', 'HEAD']).trim();
      const parent = sh(fx.cwd, ['rev-parse', 'HEAD^']).trim();
      const onCommit = (extra = {}) => ({
        action: 'scope', ...fx.base(), base_ref: null, commit: tip, item: null, paths: [], policies: fx.policies, ...extra,
      });
      const got = call(onCommit({ state_dir: join(fx.dir, 'state1') }));
      check('scope:a-commit-under-review-freezes-its-first-parent-as-the-base', got.base === parent, `${got.base} against ${parent}`);
      check('scope:a-commit-under-review-scopes-its-own-files', JSON.stringify(got.files) === '["src/a.js","src/new.js"]', JSON.stringify(got.files));
      check('scope:a-commit-under-review-names-it-in-the-detail', got.detail.includes(tip.slice(0, 7)), got.detail);
      const ledger = readJson(got.ledger, 'ledger');
      check('scope:the-ledger-of-a-review-on-a-commit-carries-the-parent-as-its-base', ledger.base === parent && ledger.item === null, JSON.stringify(ledger));
      put(join(fx.cwd, 'src', 'loose.js'), 'export const l = 1;\n');
      const dirty = call(onCommit({ state_dir: join(fx.dir, 'state2') }));
      check('scope:the-uncommitted-changes-on-top-are-in-the-scope-like-any-other', dirty.files.includes('src/loose.js'), JSON.stringify(dirty.files));
      refused('scope:a-ref-is-not-a-commit-under-review', onCommit({ commit: 'HEAD', state_dir: join(fx.dir, 'state3') }), 'names a ref');
      refused('scope:a-commit-below-the-tip-is-refused', onCommit({ commit: parent, state_dir: join(fx.dir, 'state4') }), 'not the one the working tree holds');
      refused('scope:a-commit-under-review-with-a-work-folder-is-refused', onCommit({ item: 'studies/x', state_dir: join(fx.dir, 'state5') }), 'carries no work folder');
      refused('scope:base-ref-and-commit-together-are-refused', onCommit({ base_ref: 'HEAD', state_dir: join(fx.dir, 'state6') }), 'pass exactly one of base_ref');
    });

    attempt('scope-first-commit', () => {
      const fx = fixture('scope-first');
      const first = sh(fx.cwd, ['rev-parse', 'HEAD']).trim();
      const got = scopeOf(fx, { base_ref: null, commit: first, item: null, state_dir: join(fx.dir, 'state1') });
      check('scope:the-first-commit-is-reviewed-against-the-empty-tree', sh(fx.cwd, ['cat-file', '-t', got.base]).trim() === 'tree', got.base);
      check('scope:the-first-commit-scopes-every-file-under-code-root', JSON.stringify(got.files) === '["src/a.js","src/b.js"]', JSON.stringify(got.files));
      const areas = call({ action: 'areas', ledger: got.ledger, ...fx.base(), project: fx.project, from: 'base' });
      check('scope:the-first-commit-runs-the-round-against-that-base', areas.verdict === 'touched' && areas.files.includes('src/a.js'), JSON.stringify(areas.files));
    });

    /* --- the cycle: findings, round, on_previous_fix, fast check, cost --- */
    attempt('cycle', () => {
      const fx = fixture('cycle');
      put(join(fx.cwd, 'src', 'a.js'), 'function f() {\n\treturn  1;\n}\n\nfunction g() {\n  return 20;\n}\n');
      put(join(fx.cwd, 'src', 'new.js'), 'export function n() {\n    return   "first";\n}\n');
      const scope = scopeOf(fx);
      const ledger = scope.ledger;

      const findings = call({ action: 'findings', ledger, blocks: { bug: { findings: [bug('src/a.js', 2), bug('src/new.js', 2)] }, arch: 'prose instead of JSON' } });
      check('findings:a-malformed-block-asks-for-one-relaunch', findings.verdict === 'relaunch' && JSON.stringify(findings.relaunch) === '["arch"]', JSON.stringify(findings));
      check('findings:ids-are-assigned-per-discipline', JSON.stringify(findings.finding_ids) === '["r1-bug-1","r1-bug-2"]', JSON.stringify(findings.finding_ids));
      refused('round:the-applier-comes-after-the-relaunch', { action: 'round', ledger, ...fx.base(), project: fx.project, rounds_cap: null, merit: 'stop', merit_why: 'x', applier: null, check_fast: [] }, 'was not relaunched');
      const second = call({ action: 'findings', ledger, blocks: { arch: { findings: 'still prose' } } });
      check('findings:a-second-failure-is-a-missed-discipline', second.verdict === 'ready' && JSON.stringify(second.missing) === '["arch"]', JSON.stringify(second));
      refused('findings:a-third-attempt-is-refused', { action: 'findings', ledger, blocks: { arch: { findings: [] } } }, 'the ceiling is one relaunch');
      refused('findings:a-valid-finder-is-not-run-twice', { action: 'findings', ledger, blocks: { bug: { findings: [] } } }, 'a finder is not run twice');

      // Round 1: the applier corrects both lines, in a tracked and in an untracked file.
      put(join(fx.cwd, 'src', 'a.js'), 'function f() {\n\treturn  11;\n}\n\nfunction g() {\n  return 20;\n}\n');
      put(join(fx.cwd, 'src', 'new.js'), 'export function n() {\n    return   "second";\n}\n');
      const incomplete = { applied: [fix('r1-bug-1', 'src/a.js', 'return 11;')], discarded: [], to_confirm: [], oscillation: [] };
      refused('round:merit-is-required-when-the-applier-ran', { action: 'round', ledger, ...fx.base(), project: fx.project, rounds_cap: null, applier: incomplete, check_fast: [{ area: 'web', status: 'green', detail: '' }] }, 'merit_why are required');
      const retry = closeRound(fx, ledger, { applier: incomplete, check_fast: [{ area: 'web', status: 'green', detail: '' }] });
      check('round:an-applier-block-that-leaves-a-finding-without-outcome-is-retried', retry.verdict === 'retry' && retry.blockers.some((b) => b.includes('r1-bug-2')), JSON.stringify(retry));
      check('round:a-retried-round-writes-nothing', readJson(ledger, 'ledger').rounds.length === 0, 'the ledger gained a round');
      const applier1 = {
        applied: [fix('r1-bug-1', 'src/a.js', 'return 11;', { severe: true }), fix('r1-bug-2', 'src/new.js', 'return "second";')],
        discarded: [], to_confirm: [], oscillation: [],
      };
      refused('round:a-declaring-area-without-its-fast-check-is-refused', { action: 'round', ledger, ...fx.base(), project: fx.project, rounds_cap: null, merit: 'continue', merit_why: 'x', applier: applier1, check_fast: [] }, 'check_fast declared on area web');
      refused('round:a-fast-check-on-an-area-that-declares-none-is-refused', { action: 'round', ledger, ...fx.base(), project: fx.project, rounds_cap: null, merit: 'continue', merit_why: 'x', applier: applier1, check_fast: [{ area: 'web', status: 'green', detail: '' }, { area: 'docs', status: 'green', detail: '' }] }, 'area docs is not an area this round touched');
      refused('round:a-negative-cost-is-refused', { action: 'round', ledger, ...fx.base(), project: fx.project, rounds_cap: null, merit: 'continue', merit_why: 'x', applier: applier1, check_fast: [{ area: 'web', status: 'red', detail: 'e' }], cost: [{ step: 'applier', tokens: -3 }] }, 'must be a non-negative number');
      refused('round:a-cost-entry-with-no-number-is-refused', { action: 'round', ledger, ...fx.base(), project: fx.project, rounds_cap: null, merit: 'continue', merit_why: 'x', applier: applier1, check_fast: [{ area: 'web', status: 'red', detail: 'e' }], cost: [{ step: 'applier' }] }, 'carries no number');
      const round1 = closeRound(fx, ledger, {
        merit: 'stop', applier: applier1, check_fast: [{ area: 'web', status: 'red', detail: 'tsc: src/a.js(2): error' }],
        cost: [{ step: 'finder:bug', tokens: 41000, tool_uses: 12, seconds: 95 }, { step: 'applier', tokens: 38000 }],
      });
      check('round:a-red-fast-check-imposes-another-round', round1.verdict === 'continue', JSON.stringify(round1));
      check('round:the-round-range-is-the-applier-delta', JSON.stringify(round1.touched) === '["src/a.js","src/new.js"]' && round1.from === scope.tree, JSON.stringify(round1));
      const after1 = readJson(ledger, 'ledger');
      const r1 = after1.rounds[0];
      check('round:the-trees-are-recorded', r1.pre_apply_tree === scope.tree && r1.post_apply_tree === round1.to && r1.pre_apply_tree !== r1.post_apply_tree, JSON.stringify(r1));
      check('round:a-missed-discipline-is-recorded-in-its-round', JSON.stringify(r1.missing_disciplines) === '["arch"]' && JSON.stringify(r1.disciplines) === '["bug"]', JSON.stringify(r1));
      check('round:the-cost-the-host-reported-is-kept', Array.isArray(r1.cost) && r1.cost[0].tokens === 41000, JSON.stringify(r1.cost));
      check('round:an-area-without-fast-check-is-not-in-the-round', r1.check_fast.length === 1 && r1.check_fast[0].status === 'red', JSON.stringify(r1.check_fast));

      // Round 2: the red check becomes a finding; the applier rewrites both round-1 lines and
      // denies it, and touches a line of g() the round-1 fixes never wrote.
      const findings2 = call({ action: 'findings', ledger, blocks: { bug: { findings: [bug('src/a.js', 2), bug('src/new.js', 2), bug('src/a.js', 6)] } } });
      check('findings:a-red-fast-check-is-a-finding-of-the-next-round', findings2.finding_ids.includes('r2-check-1') && findings2.count === 4, JSON.stringify(findings2.finding_ids));
      put(join(fx.cwd, 'src', 'a.js'), 'function f() {\n\treturn  12;\n}\n\nfunction g() {\n  return 21;\n}\n');
      put(join(fx.cwd, 'src', 'new.js'), 'export function n() {\n    return   "third";\n}\n');
      put(join(fx.cwd, 'src', 'b.js'), 'export const b = 2;\n');
      const applier2 = {
        applied: [
          fix('r2-bug-1', 'src/a.js', 'return 12;', { on_previous_fix: false }),
          fix('r2-bug-2', 'src/new.js', 'return "third";', { on_previous_fix: false }),
          fix('r2-bug-3', 'src/a.js', 'return 21;', { on_previous_fix: true }),
        ],
        discarded: [{ finding_id: 'r2-check-1', file: 'src/a.js', symbol: 'f', line: 2, why: 'fixed by r2-bug-1' }], to_confirm: [], oscillation: [],
      };
      const round2 = closeRound(fx, ledger, { merit: 'stop', applier: applier2, check_fast: [{ area: 'web', status: 'green', detail: '' }] });
      const r2 = readJson(ledger, 'ledger').rounds[1];
      const byAnchor = Object.fromEntries(r2.applied.map((f) => [f.anchor, f.on_previous_fix]));
      check('round:on-previous-fix-is-measured-when-the-applier-denies-it', byAnchor['return 12;'] === true, JSON.stringify(r2.applied));
      check('round:on-previous-fix-is-measured-in-an-untracked-file', byAnchor['return "third";'] === true, JSON.stringify(r2.applied));
      check('round:an-anchor-with-tabs-and-spaces-is-found', byAnchor['return 12;'] === true, 'the normalised anchor did not meet the tabbed line');
      check('round:an-independent-fix-in-the-same-file-is-not-on-a-previous-fix', byAnchor['return 21;'] === false, JSON.stringify(r2.applied));
      check('round:the-deviation-is-recorded', (r2.deviations || []).filter((d) => d.includes('declared on_previous_fix')).length === 3, JSON.stringify(r2.deviations));
      check('round:an-undeclared-change-is-a-deviation', (r2.deviations || []).some((d) => d.includes('src/b.js')), JSON.stringify(r2.deviations));
      check('round:a-regressing-round-continues', round2.verdict === 'continue', JSON.stringify(round2));

      // Round 3: nothing found, nothing applied — the fixed point, and the outcome is written.
      call({ action: 'findings', ledger, blocks: { bug: { findings: [] } } });
      refused('round:no-applier-block-when-there-was-no-finding', { action: 'round', ledger, ...fx.base(), project: fx.project, rounds_cap: null, applier: { applied: [], discarded: [], to_confirm: [], oscillation: [] } }, 'no applier block is passed');
      const round3 = call({ action: 'round', ledger, ...fx.base(), project: fx.project, rounds_cap: null });
      const after3 = readJson(ledger, 'ledger');
      check('round:zero-findings-is-a-fixed-point', round3.verdict === 'fixed-point' && after3.outcome === 'fixed-point' && after3.rounds[2].verdict === 'stop', JSON.stringify(round3));
      refused('round:no-round-opens-after-an-exit', { action: 'findings', ledger, blocks: { bug: { findings: [] } } }, 'no round opens after an exit');

      // The ledger the tool wrote is the ledger the evaluator reads.
      const closing = call({ action: 'ask', ledger, question: { question: 'resumption', entry: 'review', present: ['4. review-notes.md'] } });
      check('ask:resumption-reads-the-ledger-from-disk', closing.verdict === 'resume' && closing.answer.resume_from === 'coverage', JSON.stringify(closing));
      const handed = JSON.parse(JSON.stringify(after3));
      handed.rounds[1].pre_apply_tree = '';
      writeJson(join(fx.dir, 'handed.json'), handed);
      refused('round:the-evaluator-refuses-a-round-after-one-without-its-trees', { action: 'ask', ledger: join(fx.dir, 'handed.json'), question: { question: 'round', rounds_cap: null } }, 'pre_apply_tree is required');

      // Tail: coverage and gate, in order and in their domains.
      refused('tail:coverage-outside-its-domain', { action: 'tail', ledger, coverage: 'some' }, 'coverage is "some", outside');
      refused('tail:no-test-command-while-an-area-declares-test-targeted', (() => {
        const project = readJson(fx.project, 'project');
        project.areas.web.test_targeted = { cwd: '.', run: ['true <FILES>'] };
        writeJson(fx.project, project);
        return { action: 'tail', ledger, ...fx.base(), project: fx.project, coverage: 'no-test-command' };
      })(), 'declare test_targeted');
      const areas = call({ action: 'areas', ledger, ...fx.base(), project: fx.project, from: 'base' });
      check('areas:a-touched-area-that-declares-test-targeted', areas.test_targeted === true && areas.areas.length === 1 && areas.areas[0].area === 'web', JSON.stringify(areas));
      refused('tail:a-to-confirm-item-without-a-scenario-is-refused', { action: 'tail', ledger, to_confirm: [{ blocking: true }] }, 'a scenario and a boolean blocking');
      call({ action: 'tail', ledger, coverage: 'no-tests-needed', missing: ['test-coverage'], to_confirm: [{ blocking: true, scenario: 'a test-coverage item, the only channel that reaches the ledger' }] });
      call({ action: 'tail', ledger, gate: 'green', gate_detail: 'ok' });
      const tail = readJson(ledger, 'ledger');
      check('tail:coverage-and-gate-are-written', tail.coverage === 'no-tests-needed' && tail.gate === 'green' && tail.rounds[2].missing_disciplines.includes('test-coverage'), JSON.stringify(tail));
      check(
        'tail:to-confirm-reaches-the-last-round',
        tail.rounds[2].to_confirm.some((item) => item.blocking === true && item.scenario === 'a test-coverage item, the only channel that reaches the ledger'),
        JSON.stringify(tail.rounds[2].to_confirm)
      );
      const verdict = call({
        action: 'ask', ledger,
        question: { question: 'closing', review_outcome: { gate: 'green', gate_detail: 'ok', outcome: 'fixed-point', missing_disciplines: ['arch'], to_confirm: [], oscillation: 0 } },
      });
      check('ask:closing-reads-the-ledger-from-disk', verdict.verdict === 'stop' && verdict.answer.blockers.includes('missing disciplines') && !verdict.answer.blockers.includes('a ledger the commit can read'), JSON.stringify(verdict));
    });

    /* --- on_previous_fix does not spread from a hunk a sibling fix owns to a fix that owns none --- */
    attempt('on-previous-fix-not-claimed', () => {
      const fx = fixture('on-previous-fix-not-claimed');
      put(join(fx.cwd, 'src', 'a.js'), 'function f() {\n  return 1;\n}\n');
      const { ledger } = scopeOf(fx);
      call({ action: 'findings', ledger, blocks: { bug: { findings: [bug('src/a.js', 2)] } } });
      put(join(fx.cwd, 'src', 'a.js'), 'function f() {\n  return 11;\n}\n');
      closeRound(fx, ledger, {
        merit: 'continue', merit_why: 'round 2 rewrites this fix',
        applier: { applied: [fix('r1-bug-1', 'src/a.js', 'return 11;')], discarded: [], to_confirm: [], oscillation: [] },
        check_fast: [{ area: 'web', status: 'green', detail: '' }],
      });

      // Round 2: one fix rewrites round 1's anchor in its own hunk; a second, on the same file,
      // carries an anchor this round's diff never wrote — it owns no hunk of its own, and the only
      // hunk of the file belongs entirely to the first fix.
      call({ action: 'findings', ledger, blocks: { bug: { findings: [bug('src/a.js', 2), bug('src/a.js', 2)] } } });
      put(join(fx.cwd, 'src', 'a.js'), 'function f() {\n  return 111;\n}\n');
      const applier2 = {
        applied: [
          fix('r2-bug-1', 'src/a.js', 'return 111;', { on_previous_fix: false }),
          fix('r2-bug-2', 'src/a.js', 'an anchor this round never wrote', { on_previous_fix: false }),
        ],
        discarded: [], to_confirm: [], oscillation: [],
      };
      closeRound(fx, ledger, { applier: applier2, check_fast: [{ area: 'web', status: 'green', detail: '' }] });
      const r2 = readJson(ledger, 'ledger').rounds[1];
      const byId = Object.fromEntries(r2.applied.map((entry) => [entry.finding_id, entry.on_previous_fix]));
      check('measure:the-hunk-that-rewrites-the-prior-anchor-is-on-previous-fix', byId['r2-bug-1'] === true, JSON.stringify(r2.applied));
      check('measure:a-fix-owning-no-hunk-does-not-inherit-a-siblings-rewrite', byId['r2-bug-2'] === false, JSON.stringify(r2.applied));
    });

    attempt('applier-failure', () => {
      const fx = fixture('applier-failure');
      put(join(fx.cwd, 'src', 'b.js'), 'export const b = 2;\n');
      const { ledger } = scopeOf(fx);
      call({ action: 'findings', ledger, blocks: { bug: { findings: [bug('src/b.js', 1)] } } });
      const first = closeRound(fx, ledger, { applier: null });
      const second = closeRound(fx, ledger, { applier: null });
      const round = readJson(ledger, 'ledger').rounds[0] || { to_confirm: [] };
      check('round:an-applier-that-does-not-come-back-twice-stops-the-cycle', first.verdict === 'retry' && round.verdict === 'stop' && second.verdict !== 'continue', JSON.stringify(second));
      check('round:its-findings-become-a-blocking-item', round.to_confirm.length === 1 && round.to_confirm[0].blocking === true && round.to_confirm[0].scenario.includes('r1-bug-1'), JSON.stringify(round.to_confirm));
    });

    attempt('coverage-skip', () => {
      const fx = fixture('coverage-skip');
      put(join(fx.cwd, 'src', 'b.js'), 'export const b = 2;\n');
      const { ledger } = scopeOf(fx);
      call({ action: 'findings', ledger, blocks: { bug: { findings: [] } } });
      call({ action: 'round', ledger, ...fx.base(), project: fx.project, rounds_cap: null });
      const areas = call({ action: 'areas', ledger, ...fx.base(), project: fx.project, from: 'base' });
      check('areas:no-touched-area-declares-test-targeted', areas.test_targeted === false && areas.verdict === 'touched', JSON.stringify(areas));
      const written = settle({ action: 'tail', ledger, ...fx.base(), project: fx.project, coverage: 'no-test-command' });
      check('tail:no-test-command-when-no-area-declares-test-targeted', written.verdict === 'written' && readJson(ledger, 'ledger').coverage === 'no-test-command', JSON.stringify(written));
    });

    attempt('checks-skip', () => {
      const fx = fixture('checks-skip');
      put(join(fx.cwd, 'src', 'b.js'), 'export const b = 2;\n');
      const { ledger } = scopeOf(fx);
      call({ action: 'findings', ledger, blocks: { bug: { findings: [] } } });
      put(join(fx.cwd, 'src', 'assets', 'new.js'), 'export const n = 1;\n');
      call({ action: 'round', ledger, ...fx.base(), project: fx.project, rounds_cap: null, check_fast: [{ area: 'web', status: 'green', detail: '' }] });
      const recorded = readJson(ledger, 'ledger').rounds[0].check_fast;
      check(
        'checks:an-area-touched-with-no-check-fast-is-recorded-skipped',
        recorded.some((entry) => entry.area === 'assets' && entry.status === 'skipped' && entry.detail === 'the area declares no check_fast'),
        JSON.stringify(recorded)
      );
      check('checks:a-declaring-area-still-carries-its-reported-status', recorded.some((entry) => entry.area === 'web' && entry.status === 'green'), JSON.stringify(recorded));
    });

    attempt('tail-order', () => {
      const fx = fixture('tail-order');
      put(join(fx.cwd, 'src', 'b.js'), 'export const b = 2;\n');
      const { ledger } = scopeOf(fx);
      refused('tail:coverage-before-the-cycle-exits', { action: 'tail', ledger, coverage: 'no-tests-needed' }, 'the cycle has not exited');
    });

    attempt('closing-round', () => {
      const fx = fixture('closing-round');
      put(join(fx.cwd, 'src', 'b.js'), 'export const b = 2;\n');
      const { ledger } = scopeOf(fx);
      refused('findings:the-closing-round-waits-for-the-exit', { action: 'findings', ledger, closing: true, blocks: { bug: { findings: [] } } }, 'runs after the cycle exited');
      call({ action: 'findings', ledger, blocks: { bug: { findings: [] } } });
      call({ action: 'round', ledger, ...fx.base(), project: fx.project, rounds_cap: null });
      put(join(fx.cwd, 'src', 'b.test.js'), 'test("b", () => {});\n');
      const tests = call({ action: 'findings', ledger, closing: true, blocks: { bug: { findings: [bug('src/b.test.js', 1)] } } });
      check('findings:the-closing-round-has-its-own-ids', JSON.stringify(tests.finding_ids) === '["t-bug-1"]', JSON.stringify(tests));
      const closed = settle({
        action: 'round', ledger, ...fx.base(), project: fx.project, closing: true,
        applier: { applied: [], discarded: [], oscillation: [], to_confirm: [{ finding_id: 't-bug-1', file: 'src/b.js', line: 1, scenario: 'the test shows b is wrong', class: 'test-coverage', blocking: true }] },
      });
      const after = readJson(ledger, 'ledger');
      check('round:the-closing-round-adds-no-round', after.rounds.length === 1 && closed.verdict === 'recorded', JSON.stringify(closed));
      check('round:its-blocking-item-reaches-the-ledger', after.rounds[0].to_confirm.some((item) => item.finding_id === 't-bug-1' && item.blocking), JSON.stringify(after.rounds[0].to_confirm));
    });

    /* --- layers: the added lines are the program's, untracked files included --- */
    attempt('layers', () => {
      const fx = fixture('layers');
      put(join(fx.cwd, 'src', 'api', 'h.js'), "import { q } from 'src/db/query';\n");
      put(join(fx.cwd, 'src', 'b.js'), "import { q } from 'src/db/query';\n");
      const { ledger } = scopeOf(fx);
      const layer = { policy: '.daiku/policies/web.md', name: 'api', folders: ['src/api/**'], deny_imports: ['src/db'] };
      const got = call({ action: 'layers', ledger, ...fx.base(), layers: [layer] });
      check('layers:an-added-line-of-an-untracked-file-is-checked', got.verdict === 'violations' && got.answer.violations.length === 1 && got.answer.violations[0].file === 'src/api/h.js' && got.answer.violations[0].line === 1, JSON.stringify(got));
      const clean = call({ action: 'layers', ledger, ...fx.base(), layers: [{ ...layer, folders: ['src/web/**'] }] });
      check('layers:a-scope-with-no-denied-line-is-clean', clean.verdict === 'clean', JSON.stringify(clean));
    });

    /* --- the snapshot sees an edit git can only see by content: same size, same stamp --- */
    attempt('racy', () => {
      const fx = fixture('racy');
      sh(fx.repo, ['config', 'core.trustctime', 'false']);
      const file = join(fx.cwd, 'src', 'b.js');
      const past = new Date(Date.now() - 120000);
      utimesSync(file, past, past);
      sh(fx.cwd, ['add', 'src/b.js']);
      utimesSync(join(fx.repo, '.git', 'index'), past, past);
      writeFileSync(file, 'export const b = 9;\n', 'utf-8');
      utimesSync(file, past, past);
      const tree = snapshot(fx.cwd, 'src/');
      const seen = changedFiles(fx.cwd, 'HEAD', tree, 'src/');
      const gitSees = sh(fx.cwd, ['status', '--porcelain', '--', 'src/']).includes('src/b.js');
      check('snapshot:an-edit-in-the-second-of-the-index-is-in-the-tree', gitSees && seen.includes('src/b.js'), `git sees it: ${gitSees}; the tree carries ${JSON.stringify(seen)}`);
    });

    /* --- the parser: a content line that looks like a header is content --- */
    attempt('parser', () => {
      const fx = fixture('parser');
      put(join(fx.cwd, 'src', 'b.js'), '-- a comment\n++ another\n');
      sh(fx.repo, ['add', '-A']);
      sh(fx.repo, ['commit', '-q', '-m', 'dashes']);
      put(join(fx.cwd, 'src', 'b.js'), '++ another\n--- x\n');
      const tree = snapshot(fx.cwd, 'src/');
      const hunks = hunksOf(fx.cwd, 'HEAD', tree, 'src/').get('src/b.js') || [];
      const removed = hunks.flatMap((h) => h.removed);
      const added = hunks.flatMap((h) => h.added.map((row) => row.text));
      check('parser:a-content-line-shaped-like-a-header-is-content', removed.includes('-- a comment') && added.includes('--- x'), JSON.stringify(hunks));
    });

    refused('reject:unknown-action', { action: 'invented' }, 'action is required');
    refused('reject:scope-without-its-work-root', { action: 'scope', code_root: 'src/', base_ref: 'HEAD', paths: [], policies: '.', item: null, state_dir: '.' }, 'work_root is required');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
  return report(checks, failed);
}

function report(checks, failed) {
  process.stdout.write(`${JSON.stringify({ checks: checks.length, passed: checks.length - failed.length, failed })}\n`);
  process.exit(failed.length ? 1 : 0);
}

/* ------------------------------------------------------------------------- *
 * Invocation
 * ------------------------------------------------------------------------- */

function die(reason) {
  process.stderr.write(`ledger: ${reason}\n`);
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
    process.stderr.write('usage: node ledger.mjs <package-root>\n');
    process.stderr.write('       node ledger.mjs --self-check <package-root>\n');
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
