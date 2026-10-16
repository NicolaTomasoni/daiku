#!/usr/bin/env node
/**
 * The nesting declaration of an opencode project — the `4-bis` step of `init`.
 *
 * opencode caps subagent nesting with `experimental.subagent_depth`, and the method's longest
 * chain — `new-feature → ship-feature → review → finder`, four levels — needs `3`: the host counts
 * the ancestors of the calling session, so a `review` at depth `2` cannot launch its finder below
 * that. The key lives **under `experimental`** (in the root opencode discards it in silence) and
 * belongs to the **project**: this program writes it the way `init` touches a project file — by
 * addition, never overwriting. A value the project already declares wins, whatever it is; a root
 * level `subagent_depth` stands where it is, and the key is added under `experimental` beside it;
 * a file that does not parse as JSON is left exactly as it is and said so — the project's file is
 * never rewritten from a guess.
 *
 * It is a sibling of `scan.mjs` and `branch.mjs` — a plain `node` program the skill launches and
 * whose one JSON object decides — and it is **measured by the scan**, which lists the missing key
 * under step `4-bis` and hands the write back to `init`; that key is the whole of what that step
 * writes.
 *
 *   node <package-root>/skills/init/depth.mjs <technical-root>
 *       one JSON object on stdout — `{ok, action, detail}` — exit 0.
 *       Bad arguments: exit 2.
 *
 *   node <package-root>/skills/init/depth.mjs --self-check
 *       the bench, on throwaway projects under the system temp directory: counted JSON
 *       `{checks, passed, failed[]}`, exit 1 on the first red. `hooks/self-check.mjs` launches it.
 *
 * It writes only `opencode.json`, only by addition, and it never commits or pushes.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scan } from './scan.mjs';

/** The nesting depth the method's longest chain asks for: `new-feature → ship-feature → review →
 * finder` is four levels, and opencode counts the ancestors of the calling session, so the finder
 * at the third level needs `3`. A hand-launched `review` reaches `2` in its `commit → update-memory`
 * tail, and `3` covers that too — the value is the deepest the method asks, not the shallowest. */
export const SUBAGENT_DEPTH = 3;

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * `experimental.subagent_depth` in `<root>/opencode.json`, added only where the key is absent.
 *
 * The file is the project's, so it is touched by addition: an `experimental` block already there
 * keeps every other key, a `subagent_depth` the project declared **wins**, and a root-level
 * `subagent_depth` — which opencode ignores — is left exactly where it stands. A file that does
 * not parse as JSON is left as it is and said so, never rewritten from a guess.
 *
 * Returns the action — `created`, `added`, `kept`, `untouched` — pushing the reasons it did not
 * write into `detail`.
 */
export function ensureDepth(root, detail = []) {
  const path = join(root, 'opencode.json');
  if (!existsSync(path)) {
    const fresh = { $schema: 'https://opencode.ai/config.json', experimental: { subagent_depth: SUBAGENT_DEPTH } };
    mkdirSync(root, { recursive: true });
    writeFileSync(path, JSON.stringify(fresh, null, 2) + '\n', 'utf-8');
    return 'created';
  }
  const json = readJson(path);
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    detail.push('opencode.json left as it is: it does not parse as JSON');
    return 'untouched';
  }
  const experimental =
    json.experimental && typeof json.experimental === 'object' && !Array.isArray(json.experimental)
      ? json.experimental
      : null;
  if (experimental && Object.prototype.hasOwnProperty.call(experimental, 'subagent_depth')) {
    detail.push('experimental.subagent_depth: kept');
    return 'kept';
  }
  if (experimental) {
    experimental.subagent_depth = SUBAGENT_DEPTH;
  } else {
    json.experimental = { subagent_depth: SUBAGENT_DEPTH };
  }
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n', 'utf-8');
  return 'added';
}

/**
 * The step, on the project at `rootIn`. Pure of process exit, so the bench calls it directly.
 * Returns the block `init` reads: `{ok, action, detail}`.
 */
export function depth(rootIn) {
  const root = resolve(rootIn);
  const detail = [];
  const action = ensureDepth(root, detail);
  return { ok: true, action, detail: detail.join('; ') };
}

/* ------------------------------------------------------------------------- *
 * The bench — throwaway projects under the system temp directory
 * ------------------------------------------------------------------------- */

function selfCheck() {
  const failed = [];
  let ran = 0;
  const check = (name, condition, why) => {
    ran += 1;
    if (!condition) failed.push(why ? `${name}: ${why}` : name);
  };
  const write = (path, text) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, 'utf-8');
  };
  const read = (path) => readFileSync(path, 'utf-8');
  const parse = (path) => JSON.parse(read(path));
  /** The key as a value: `undefined` where the block or the key is not there, so a broken
   *  world fails a check instead of crashing the bench that reads it. */
  const keyOf = (json) =>
    json && json.experimental && typeof json.experimental === 'object' && !Array.isArray(json.experimental)
      ? json.experimental.subagent_depth
      : undefined;

  const base = mkdtempSync(join(tmpdir(), 'daiku-depth-'));
  try {
    // --- no opencode.json: one is created, under experimental --------------------------
    const fresh = join(base, 'fresh');
    const created = depth(fresh);
    check('a project without opencode.json answers ok', created.ok === true, JSON.stringify(created));
    check('the action is created', created.action === 'created', created.action);
    const createdJson = parse(join(fresh, 'opencode.json'));
    check('the file is created with experimental.subagent_depth 3', createdJson.experimental && createdJson.experimental.subagent_depth === 3, JSON.stringify(createdJson));
    check('the key is never written in the root', !('subagent_depth' in createdJson));

    // --- a file that exists, every shape -----------------------------------------------
    const noExperimental = join(base, 'no-exp');
    write(join(noExperimental, 'opencode.json'), JSON.stringify({ $schema: 'x', model: 'a/b' }));
    const added = depth(noExperimental);
    check('an opencode.json without experimental: action added', added.action === 'added', added.action);
    const addedJson = parse(join(noExperimental, 'opencode.json'));
    check('it gains experimental.subagent_depth 3', addedJson.experimental && addedJson.experimental.subagent_depth === 3);
    check('and keeps its other keys', addedJson.model === 'a/b' && addedJson.$schema === 'x');

    const noDepth = join(base, 'no-depth');
    write(join(noDepth, 'opencode.json'), JSON.stringify({ experimental: { policies: true } }));
    const underBlock = depth(noDepth);
    check('an experimental block without the key: action added', underBlock.action === 'added', underBlock.action);
    const underJson = parse(join(noDepth, 'opencode.json'));
    check('the key joins the block', keyOf(underJson) === 3, JSON.stringify(underJson));
    check('and the rest of the block stays', underJson.experimental.policies === true);

    // --- the project's own value wins ---------------------------------------------------
    const declared = join(base, 'declared');
    write(join(declared, 'opencode.json'), JSON.stringify({ experimental: { subagent_depth: 1 } }));
    const kept = depth(declared);
    check('a value the project declares: action kept', kept.action === 'kept', kept.action);
    check('the project value 1 is not overwritten', keyOf(parse(join(declared, 'opencode.json'))) === 1);
    check('keeping says so in detail', kept.detail.includes('kept'), kept.detail);

    // --- a root level key stands where it is, the key joins under experimental -----------
    const rootKey = join(base, 'root-key');
    write(join(rootKey, 'opencode.json'), JSON.stringify({ subagent_depth: 5 }));
    depth(rootKey);
    const bothJson = parse(join(rootKey, 'opencode.json'));
    check('a root-level key is left where it stands', bothJson.subagent_depth === 5);
    check('and the key is written under experimental, where opencode reads it', keyOf(bothJson) === 3, JSON.stringify(bothJson));

    // --- an unparsable file is untouched ------------------------------------------------
    const broken = join(base, 'broken');
    const brokenText = '{ // comment\n "experimental": {} }';
    write(join(broken, 'opencode.json'), brokenText);
    const untouched = depth(broken);
    check('an unparsable opencode.json answers ok', untouched.ok === true, JSON.stringify(untouched));
    check('the action is untouched', untouched.action === 'untouched', untouched.action);
    check('the file is left byte for byte as it was', read(join(broken, 'opencode.json')) === brokenText);
    check('and detail says why', untouched.detail.includes('does not parse'), untouched.detail);

    // --- idempotence --------------------------------------------------------------------
    const again = depth(fresh);
    check('a relaunch is idempotent: action kept', again.action === 'kept', again.action);
    check('and still 3', keyOf(parse(join(fresh, 'opencode.json'))) === 3);

    // --- and the scan agrees: step 4-bis stays silent once the key stands -----------------
    // The paired case of the brief: the step writes the key, and the scan that measures it
    // lists nothing under `4-bis` on the project the step just wrote.
    write(join(fresh, '.daiku', 'project.json'), JSON.stringify({ contract: 1 }));
    write(join(fresh, '.daiku', 'environment.json'), JSON.stringify({ contract: 1, default_host: 'opencode', hosts: { opencode: { instructions_file: 'AGENTS.md' } } }));
    const measured = scan(fresh);
    check(
      'after this step the scan lists no 4-bis entry',
      !measured.missing.some((m) => m.step === '4-bis'),
      JSON.stringify(measured.missing)
    );
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
    return resolve(fileURLToPath(import.meta.url)).toLowerCase() === resolve(launched).toLowerCase();
  } catch {
    return true;
  }
}

if (invokedDirectly()) {
  const argv = process.argv.slice(2);
  if (argv[0] === '--self-check') process.exit(selfCheck());
  const [root] = argv;
  if (!root) {
    process.stderr.write('usage: node depth.mjs <technical-root>\n       node depth.mjs --self-check\n');
    process.exit(2);
  }
  let out;
  try {
    out = depth(root);
  } catch (error) {
    out = { ok: false, action: 'failed', detail: error && error.message ? error.message : 'unknown error' };
  }
  process.stdout.write(JSON.stringify(out) + '\n');
  process.exit(0);
}
