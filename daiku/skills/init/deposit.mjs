#!/usr/bin/env node
/**
 * The package's deposit into an opencode project — the branch of `init` that serves that host.
 *
 * `init` opens a project on the host it runs on, and Claude Code is served by installation: the
 * package lands in a cache the host scans. opencode has no manifest and no marketplace — its
 * extensions are read from the **project** (`.opencode/skills/`, `.opencode/agents/`,
 * `.opencode/commands/`, `.opencode/plugins/`) — so there the package must be **deposited inside
 * the project** by a command the user launches. That command is `init`, and this program is its
 * deterministic half: it copies the corpus into the seats opencode reads and writes the two
 * declarations the review cycle needs to compose there.
 *
 * It is a sibling of `scan.mjs` and `branch.mjs` — a plain `node` program the skill launches and
 * whose one JSON object decides — and it is **measured by the scan**, which lists the deposit as
 * missing or behind and hands it to `init`'s deposit step. That is the whole reason the manifest
 * exists: no eye tells a deposit of this Daiku from one of an older one.
 *
 * What it lays down, and why each seat:
 *
 *  - **the skill entry points** — every `skills/<name>/SKILL.md` into `.opencode/skills/<name>/`,
 *    the seat opencode discovers a skill in;
 *  - **the role rendering** — every `agents/opencode/<role>.md` into `.opencode/agents/`, the seat
 *    opencode reads an agent from; the `finder` role lands here for the first time;
 *  - **the support tree** — `skills/`, `contracts/`, `architect/`, `schemas/`, `templates/`,
 *    `hooks/lib/` and `.claude-plugin/` into a sibling `.opencode/daiku/`, because a skill computes
 *    its support root from its own base directory (`.opencode/skills/<name>/` → `.opencode/daiku/`)
 *    and reaches every file it opens by path from there;
 *  - **the guard adapter** — `hooks/opencode-plugin.mjs` beside `hooks/lib/`, so its imports
 *    resolve, and the one-line skeleton `templates/opencode/plugin.js` at `.opencode/plugins/daiku.js`,
 *    which is the child opencode auto-loads;
 *  - **the manifest** — `.opencode/daiku/deposit.json`, the version of the package that wrote the
 *    deposit beside the pieces it wrote and the modules it could not hook.
 *
 * **The declaration the cycle needs.** opencode caps nesting with `experimental.subagent_depth`,
 * and the method's longest chain — `new-feature → ship-feature → review → finder`, four levels —
 * needs `3`: opencode counts the ancestors of the calling session, so a `review` at depth `2`
 * cannot launch its finder below that. The deposit writes `experimental.subagent_depth: 3`
 * **under `experimental`** in `opencode.json`, creating the file if it is missing. A value the
 * project already declares **wins** — the deposit writes `3` only where the key is absent, and
 * never in the root, where opencode discards it in silence. This is the same idempotence with
 * which `init` never rewrites a file of the project's.
 *
 * It is **idempotent and whole**: `.opencode/` is the method's seat, not the project's, so a
 * relaunch recreates it entire — the way `init` recreates the versioned script under `.daiku/` —
 * and a deposit of an older package is brought up to the version in place. Only `opencode.json` is
 * the project's, and it is touched by addition alone.
 *
 *   node <package-root>/skills/init/deposit.mjs <technical-root> <host>
 *       one JSON object on stdout — `{ok, host, wrote, declared_missing, detail}` — exit 0.
 *       Bad arguments: exit 2.
 *
 *   node <package-root>/skills/init/deposit.mjs --self-check
 *       the bench, on throwaway trees under the system temp directory: counted JSON
 *       `{checks, passed, failed[]}`, exit 1 on the first red. `hooks/self-check.mjs` launches it.
 *
 * It writes no file outside `.opencode/` and `opencode.json`, and it never commits or pushes.
 */

import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/** The package root: two levels above this file, where `skills/`, `contracts/` and `templates/` stand. */
const PACKAGE = join(HERE, '..', '..');

/** The seats of the package's own tree the corpus needs at run time, mirrored under `.opencode/daiku/`.
 * `skills/` carries the programs a skill launches by path (`skills/init/scan.mjs` and its siblings);
 * `contracts/`, `architect/`, `schemas/` and `templates/` are what the skills open by path;
 * `hooks/lib/` is what the guard adapter imports; `.claude-plugin/` is where a skill reads the
 * package version. All of them are reached from a skill's support root, so all of them travel. */
const SUPPORT = ['skills', 'contracts', 'architect', 'schemas', 'templates', 'hooks/lib', '.claude-plugin'];
/** The guard adapter, deposited beside `hooks/lib/` so its relative imports resolve. */
const ADAPTER = 'hooks/opencode-plugin.mjs';
/** The one-line skeleton opencode auto-loads from `.opencode/plugins/`, and where it goes. */
const PLUGIN_SKELETON = 'templates/opencode/plugin.js';
const PLUGIN_TARGET = '.opencode/plugins/daiku.js';
/** The two guard modules with no live opencode event: deposited, but declared missing — no hook
 * fires for a subagent's end (`SubagentStop`) nor for a turn's end (`Stop`) on this host. */
const DECLARED_MISSING = ['stop-advice', 'subagent-advice'];
/** The nesting depth the method's longest chain asks for: `new-feature → ship-feature → review →
 * finder` is four levels, and opencode counts the ancestors of the calling session, so the finder
 * at the third level needs `3`. A hand-launched `review` reaches `2` in its `commit → update-memory`
 * tail, and `3` covers that too — the value is the deepest the method asks, not the shallowest. */
const SUBAGENT_DEPTH = 3;

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

/** The version this package carries, out of its own manifest. `null` where it cannot say. */
export function packageVersion(packageRoot) {
  const manifest = readJson(join(packageRoot, '.claude-plugin', 'plugin.json'));
  const version = manifest && manifest.version;
  return typeof version === 'string' && version.trim() ? version.trim() : null;
}

/** Relative to the technical root, forward slashes: the form the manifest lists and the scan reads. */
function relTo(root, path) {
  return relative(root, path).replace(/\\/g, '/');
}

/** A directory copied whole, every file recorded. `sort` makes the walk deterministic — the order
 * `readdirSync` returns is the filesystem's, and the manifest must not depend on it. */
function copyTree(src, dst, root, wrote) {
  let entries;
  try {
    entries = readdirSync(src, { withFileTypes: true });
  } catch {
    return;
  }
  mkdirSync(dst, { recursive: true });
  for (const entry of entries.slice().sort((a, b) => a.name.localeCompare(b.name))) {
    const from = join(src, entry.name);
    const to = join(dst, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to, root, wrote);
    } else if (entry.isFile()) {
      mkdirSync(dirname(to), { recursive: true });
      cpSync(from, to);
      wrote.push(relTo(root, to));
    }
  }
}

/** One file copied, recorded. Nothing happens where the source is absent — a package missing a
 * piece deposits what it has, and the scan lists the rest. */
function copyFile(from, to, root, wrote) {
  if (!existsSync(from)) return false;
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to);
  wrote.push(relTo(root, to));
  return true;
}

/**
 * `experimental.subagent_depth` in `<root>/opencode.json`, added only where the key is absent.
 *
 * The file is the project's, so it is touched by addition: an `experimental` block already there
 * keeps every other key, a `subagent_depth` the project declared **wins**, and a root-level
 * `subagent_depth` — which opencode ignores — is left exactly where it stands. A file that does
 * not parse as JSON is left as it is and said so, never rewritten from a guess.
 */
export function ensureDepth(root, detail = []) {
  const path = join(root, 'opencode.json');
  if (!existsSync(path)) {
    const fresh = { $schema: 'https://opencode.ai/config.json', experimental: { subagent_depth: SUBAGENT_DEPTH } };
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
  if (experimental && Object.prototype.hasOwnProperty.call(experimental, 'subagent_depth')) return 'kept';
  if (experimental) {
    experimental.subagent_depth = SUBAGENT_DEPTH;
  } else {
    json.experimental = { subagent_depth: SUBAGENT_DEPTH };
  }
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n', 'utf-8');
  return 'added';
}

/**
 * The deposit, on the project at `rootIn`. Pure of process exit, so the bench calls it directly.
 * Returns the block `init` reads: `{ok, host, wrote, declared_missing, detail}`.
 */
export function deposit(rootIn, host, packageRoot = PACKAGE) {
  const root = resolve(rootIn);
  const detail = [];
  const wrote = [];

  // The skill entry points: `.opencode/skills/<name>/SKILL.md`, the seat opencode discovers.
  let skillDirs = [];
  try {
    skillDirs = readdirSync(join(packageRoot, 'skills'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    skillDirs = [];
  }
  for (const name of skillDirs) {
    copyFile(join(packageRoot, 'skills', name, 'SKILL.md'), join(root, '.opencode', 'skills', name, 'SKILL.md'), root, wrote);
  }

  // The role rendering: `.opencode/agents/<role>.md`, the seat opencode reads an agent from.
  let roles = [];
  try {
    roles = readdirSync(join(packageRoot, 'agents', 'opencode'))
      .filter((name) => name.endsWith('.md'))
      .sort();
  } catch {
    roles = [];
  }
  for (const role of roles) {
    copyFile(join(packageRoot, 'agents', 'opencode', role), join(root, '.opencode', 'agents', role), root, wrote);
  }

  // The support tree, beside the skills: `.opencode/daiku/…`, the root every skill computes.
  for (const entry of SUPPORT) {
    copyTree(join(packageRoot, entry), join(root, '.opencode', 'daiku', entry), root, wrote);
  }
  // The adapter, beside the modules it imports.
  copyFile(join(packageRoot, ADAPTER), join(root, '.opencode', 'daiku', ADAPTER), root, wrote);
  // The skeleton opencode auto-loads.
  copyFile(join(packageRoot, PLUGIN_SKELETON), join(root, PLUGIN_TARGET), root, wrote);

  // The declaration the cycle needs, added to the project's own file only where it is absent.
  const depth = ensureDepth(root, detail);
  if (depth === 'kept' || depth === 'untouched') detail.push(`experimental.subagent_depth: ${depth}`);

  // The manifest: the version of the package that wrote the deposit, beside what it wrote.
  const manifest = {
    version: packageVersion(packageRoot),
    host,
    wrote: wrote.slice().sort(),
    declared_missing: DECLARED_MISSING.slice(),
  };
  const manifestPath = join(root, '.opencode', 'daiku', 'deposit.json');
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

  return { ok: true, host, wrote: manifest.wrote, declared_missing: manifest.declared_missing, detail: detail.join('; ') };
}

/* ------------------------------------------------------------------------- *
 * The bench — throwaway trees under the system temp directory
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
  const has = (path) => existsSync(path);

  const base = mkdtempSync(join(tmpdir(), 'daiku-deposit-'));
  const PKG = join(base, 'pkg');
  const R = join(base, 'project');

  try {
    // A package with one of each kind of piece the deposit carries.
    write(join(PKG, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'daiku', version: '9.9.9' }));
    write(join(PKG, 'skills', 'review', 'SKILL.md'), "---\nname: 'review'\n---\n\nbody\n");
    write(join(PKG, 'skills', 'init', 'scan.mjs'), '// scan\n');
    write(join(PKG, 'agents', 'opencode', 'finder.md'), '---\nmode: subagent\n---\n');
    write(join(PKG, 'contracts', 'orchestration.md'), '# o\n');
    write(join(PKG, 'architect', 'architect.mjs'), '// a\n');
    write(join(PKG, 'schemas', 'blocks.json'), '{"params":{}}\n');
    write(join(PKG, 'templates', 'project', 'instructions.md'), '# instr\n');
    write(join(PKG, 'hooks', 'lib', 'command-guard.mjs'), '// cg\n');
    write(join(PKG, 'hooks', 'opencode-plugin.mjs'), '// adapter\n');
    write(join(PKG, 'templates', 'opencode', 'plugin.js'), 'export { default } from "../daiku/hooks/opencode-plugin.mjs"\n');
    mkdirSync(R, { recursive: true });

    const out = deposit(R, 'opencode', PKG);
    check('the deposit answers ok', out.ok === true, JSON.stringify(out));
    check('the host travels back', out.host === 'opencode');

    // Every enumerated seat.
    check('a skill entry point lands at .opencode/skills/<name>/SKILL.md', has(join(R, '.opencode/skills/review/SKILL.md')));
    check('the role rendering lands at .opencode/agents/<role>.md', has(join(R, '.opencode/agents/finder.md')));
    check(
      'the support tree lands under .opencode/daiku/',
      ['contracts', 'architect', 'schemas', 'templates', 'hooks/lib', 'skills', '.claude-plugin'].every((d) =>
        has(join(R, '.opencode/daiku', d))
      ),
      'a support seat is absent'
    );
    check('the support program travels too (skills/init/scan.mjs)', has(join(R, '.opencode/daiku/skills/init/scan.mjs')));
    check('the adapter lands beside hooks/lib/', has(join(R, '.opencode/daiku/hooks/opencode-plugin.mjs')));
    check('the plugin skeleton lands at .opencode/plugins/daiku.js', has(join(R, '.opencode/plugins/daiku.js')));
    check('the content is copied, not only the name', read(join(R, '.opencode/agents/finder.md')).includes('mode: subagent'));

    // The manifest.
    check('the manifest is written', has(join(R, '.opencode/daiku/deposit.json')));
    const manifest = JSON.parse(read(join(R, '.opencode/daiku/deposit.json')));
    check('the manifest carries the package version', manifest.version === '9.9.9');
    check('the manifest carries the host', manifest.host === 'opencode');
    check('the manifest declares the two missing modules', manifest.declared_missing.join(',') === 'stop-advice,subagent-advice');
    check('the manifest enumerates the skill entry point', manifest.wrote.includes('.opencode/skills/review/SKILL.md'));
    check('the manifest enumerates the adapter', manifest.wrote.includes('.opencode/daiku/hooks/opencode-plugin.mjs'));
    check('every written seat really exists', manifest.wrote.every((rel) => has(join(R, rel))), 'a listed seat is absent');
    check('the manifest does not list itself', !manifest.wrote.includes('.opencode/daiku/deposit.json'));

    // --- opencode.json, the project's file, touched by addition alone ------------------
    const fresh = join(base, 'fresh');
    mkdirSync(fresh, { recursive: true });
    deposit(fresh, 'opencode', PKG);
    const created = JSON.parse(read(join(fresh, 'opencode.json')));
    check('no opencode.json: one is written with experimental.subagent_depth 3', created.experimental && created.experimental.subagent_depth === 3);
    check('the key is never written in the root', !('subagent_depth' in created));

    const noExperimental = join(base, 'no-exp');
    write(join(noExperimental, 'opencode.json'), JSON.stringify({ $schema: 'x', model: 'a/b' }));
    deposit(noExperimental, 'opencode', PKG);
    const added = JSON.parse(read(join(noExperimental, 'opencode.json')));
    check('an opencode.json without experimental gains the block', added.experimental && added.experimental.subagent_depth === 3);
    check('and keeps its other keys', added.model === 'a/b' && added.$schema === 'x');

    const noDepth = join(base, 'no-depth');
    write(join(noDepth, 'opencode.json'), JSON.stringify({ experimental: { policies: true } }));
    deposit(noDepth, 'opencode', PKG);
    const underExperimental = JSON.parse(read(join(noDepth, 'opencode.json')));
    check('an experimental block without the key gains it', underExperimental.experimental.subagent_depth === 3);
    check('and keeps the rest of the block', underExperimental.experimental.policies === true);

    const declared = join(base, 'declared');
    write(join(declared, 'opencode.json'), JSON.stringify({ experimental: { subagent_depth: 3 } }));
    deposit(declared, 'opencode', PKG);
    const kept = JSON.parse(read(join(declared, 'opencode.json')));
    check('a value the project declares wins: 3 stays', kept.experimental.subagent_depth === 3);

    const rootKey = join(base, 'root-key');
    write(join(rootKey, 'opencode.json'), JSON.stringify({ subagent_depth: 5 }));
    deposit(rootKey, 'opencode', PKG);
    const both = JSON.parse(read(join(rootKey, 'opencode.json')));
    check('a root-level key is left where it stands', both.subagent_depth === 5);
    check('and the key is written under experimental, where opencode reads it', both.experimental.subagent_depth === 3);

    const broken = join(base, 'broken');
    write(join(broken, 'opencode.json'), '{ // comment\n "experimental": {} }');
    const brokenOut = deposit(broken, 'opencode', PKG);
    check('an unparsable opencode.json is left as it is', read(join(broken, 'opencode.json')).includes('comment'));
    check('and the deposit still answers ok', brokenOut.ok === true);

    // --- idempotence and the missing manifest -----------------------------------------
    const again = deposit(R, 'opencode', PKG);
    check('a relaunch is idempotent: the same seats', again.wrote.length === out.wrote.length && again.wrote.every((rel, i) => rel === out.wrote[i]));
    check('a relaunch realigns the manifest to the package', JSON.parse(read(join(R, '.opencode/daiku/deposit.json'))).version === '9.9.9');

    const noManifestPkg = join(base, 'pkg-no-manifest');
    write(join(noManifestPkg, 'skills', 'review', 'SKILL.md'), 'x\n');
    const noVersion = deposit(join(base, 'no-version'), 'opencode', noManifestPkg);
    check('a package without a manifest: no version, no exception', noVersion.ok === true && JSON.parse(read(join(base, 'no-version/.opencode/daiku/deposit.json'))).version === null);
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
  const [root, host] = argv;
  if (!root || !host) {
    process.stderr.write('usage: node deposit.mjs <technical-root> <host>\n       node deposit.mjs --self-check\n');
    process.exit(2);
  }
  let out;
  try {
    out = deposit(root, host);
  } catch (error) {
    out = { ok: false, host, wrote: [], declared_missing: [], detail: error && error.message ? error.message : 'unknown error' };
  }
  process.stdout.write(JSON.stringify(out) + '\n');
  process.exit(0);
}
