#!/usr/bin/env node
/**
 * What `init` already did on this project, measured on the disk before `init` does anything.
 *
 * `init` is idempotent by prose: it never overwrites a file it finds. But a relaunch still read
 * the whole repository, asked the two languages again and reported a finished job over a project
 * that was already open. This program answers the one question a relaunch needs first — **what is
 * missing?** — without an agent deciding it: every piece `init` lays down that the disk can
 * vouch for is checked here, and `skills/init/SKILL.md` § *Scan first* acts on the list.
 *
 * What it checks — each a piece `init` writes and a file on disk proves:
 *
 *  - `.daiku/project.json`: absent, the project was never opened (`fresh`), and nothing else
 *    is checked — the whole procedure runs;
 *  - the environment file (`.daiku/environment.local.json` or `.daiku/environment.json`);
 *  - the README of `.daiku/domain/` and `.daiku/policies/`, and every domain default the package
 *    carries in `templates/project/domain/` — present as the default or as a pointer, same name;
 *  - `.daiku/update.mjs` — present, and carrying the `daiku:script <version>` marker with the
 *    version of the package doing the scan: a script written by an older Daiku, or by one that
 *    left no marker, is old and `init` recreates it whole — and a `daiku: update` task in
 *    `.vscode/tasks.json`;
 *  - `.daiku/README.md`, Daiku's own documentation, written beside the parameters;
 *  - the host's instructions file, carrying the marker line `init` leaves in it — the name comes
 *    from `{hosts.<host>.instructions_file}` of the host `init` runs on, never from the order the
 *    `hosts` keys happen to stand in;
 *  - `{memory.root}` and its index;
 *  - the two memory keys in `.claude/settings.local.json`, and no memory file left in the host's
 *    default folder under `~/.claude/projects/` — a seat Claude Code alone has, so on opencode
 *    neither the seat nor the folder is expected;
 *  - **the nesting key of an opencode project**: on that host the method's chains need
 *    `experimental.subagent_depth` in the project's own `opencode.json`, and this program lists it
 *    under step `4-bis` when the key is absent — under any value the project declares it is
 *    present, and a file that does not parse as JSON is never listed (a relaunch that cannot write
 *    it must not stay "not everything ready" forever); on Claude Code the step does not exist;
 *  - the `.gitignore` lines: the machine's files, `{paths.review_state}` and — where it stands
 *    inside the repository — `{worktree.pool}`, ignored by **the repository's own** `.gitignore`
 *    — a global excludes file or `.git/info/exclude` is one machine's, and a clone carries none of
 *    it — and `.daiku/` and the memory corpus not ignored.
 *
 * **And two lists beside `missing`, because a piece that has stood there since an older Daiku is
 * as much an artefact behind as a piece that is not there at all** — and no eye tells an old file
 * from a right one. This is what a relaunch after a package update reads to know what to correct,
 * and it is the reason the answer is not a single list:
 *
 *  - `legacy`: the seats Daiku wrote **before** `.daiku/` and does not write any more, plus the
 *    entries of a settings file still pointing at one of them — removing the file without that
 *    line would leave a hook that starts nothing.
 *  - `params`: a key of `.daiku/project.json` or of an environment file that the contract no
 *    longer names, read against the two lists the package keeps in `schemas/blocks.json`. Only
 *    the **first** segment of each entry is compared: it is the only level a project file can be
 *    asked about, and `areas.<area>.paths` asks about `areas`.
 *
 * What it does not check: the domain roles the project may answer in a file written after the
 * first run. Telling that needs reading the repository, and this program reads only what `init`
 * wrote.
 *
 *   node <package-root>/skills/init/scan.mjs <technical-root> [--host <name>]
 *       one JSON object on stdout — `{fresh, missing: [...], legacy: [...], params: [...]}`,
 *       every entry `{id, step, detail}` — exit 0.
 *       Bad arguments: exit 2.
 *
 *   node <package-root>/skills/init/scan.mjs --self-check
 *       the bench, on a simulated disk. Counted JSON `{checks, passed, failed[]}`, exit 1 on
 *       the first red. `hooks/self-check.mjs` launches it.
 *
 * It **fails open** where the disk does not answer: an unreadable folder or a Git that does not
 * run reports nothing missing for that piece, because a relaunch that rewrites nothing is the
 * safe side of a wrong answer. It writes nothing, ever.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE = join(HERE, '..', '..');

/** The marker `templates/project/instructions.md` leaves at the bottom of the file. */
const MARKER = '<!-- daiku:instructions';
/** The marker `init` leaves at the top of every script it writes, holding the package version
 * that wrote it. The skeletons carry it with `<version>`, which `init` fills on the copy. */
const SCRIPT_MARKER = /^\s*\/\/\s*daiku:script\s+(\S+)/m;
const TASK_LABEL = 'daiku: update';
const DEFAULT_INSTRUCTIONS = 'CLAUDE.md';
/** The `init` step that declares the nesting depth in an opencode project's `opencode.json`,
 * where the key it lists belongs. On Claude Code there is no such step and no such key. */
const DEPTH_STEP = '4-bis';

/** The seats Daiku wrote before it moved under `.daiku/`, and does not write any more: the
 * parameter pair a reader may still open, and the script a settings entry may still start. `init`
 * retires them, and the settings files below are read for the entries still pointing at one.
 *
 * **A seat in this list is retired by the name standing there, never by reading the file, and what
 * earns a seat its place in the list is the kind of thing that stands there.** A parameter pair is
 * machinery a reader opens and a script is machinery a settings entry starts; a copy of a contract
 * is a document, and a document carries no mark of who wrote it — at `.claude/<name>.md` a file the
 * project wrote for itself is, to any program, the same file as a copy Daiku left behind, and
 * retiring that path on its own name would stash the project's document. That is why the document
 * seats are not in the list. */
export const RETIRED = Object.freeze([
  ['.claude/project.json', 'the parameters, at the seat Daiku used before `.daiku/`'],
  ['.claude/environment.json', 'the environment, at the seat Daiku used before `.daiku/`'],
  ['.claude/hooks/contratti-post-edit.mjs', 'a copy of `hooks/lib/contracts-post-edit.mjs`'],
]);

/** Where a pointer at a retired file can stand. `.claude/settings.json` is the project's and
 * `settings.local.json` is the machine's: both are read, neither is a file `init` wrote. */
const SETTINGS_FILES = ['.claude/settings.json', '.claude/settings.local.json'];

/* ------------------------------------------------------------------------- *
 * The disk, behind a door the bench can replace
 * ------------------------------------------------------------------------- */

const REAL = {
  exists: (p) => {
    try {
      return existsSync(p);
    } catch {
      return false;
    }
  },
  read: (p) => readFileSync(p, 'utf-8'),
  list: (p) => readdirSync(p),
  home: () => homedir(),
  /** `git check-ignore -v --no-index` from the repository root: raw stdout, or null. */
  checkIgnore: (top, paths) => {
    const run = spawnSync('git', ['-C', top, 'check-ignore', '-v', '--no-index', '--', ...paths], {
      encoding: 'utf-8',
    });
    if (run.error || (run.status !== 0 && run.status !== 1)) return null;
    return run.stdout || '';
  },
  toplevel: (root) => {
    const run = spawnSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], { encoding: 'utf-8' });
    if (run.error || run.status !== 0) return null;
    return (run.stdout || '').trim() || null;
  },
};

function readJson(disk, p) {
  try {
    return JSON.parse(disk.read(p));
  } catch {
    return null;
  }
}

function readText(disk, p) {
  try {
    return disk.read(p);
  } catch {
    return null;
  }
}

/** The version the marker of a script declares, or `null` where the line is not there at all. */
export function markedVersion(text) {
  const found = typeof text === 'string' ? text.match(SCRIPT_MARKER) : null;
  return found ? found[1] : null;
}

/** The version this package carries, out of its own manifest: the one a script it writes must
 * declare. A package unable to say which version it is cannot call a script old, and stays silent
 * (`null`). */
export function packageVersion(disk, packageRoot) {
  const manifest = readJson(disk, join(packageRoot, '.claude-plugin', 'plugin.json'));
  const version = manifest && manifest.version;
  return typeof version === 'string' && version.trim() ? version.trim() : null;
}

/**
 * The keys a parameter file may carry, out of the package's own `schemas/blocks.json` — the file
 * that already keeps the two lists the contract's prose declares, read here instead of copied, so
 * that a key withdrawn from the contract stops being admitted by this program in the same commit.
 *
 * Only the **first** segment of each entry is kept: `areas.<area>.paths` admits `areas`, and the
 * levels below it are the ones no list can express — they are enforced where they belong, by
 * `hooks/lib/contracts-post-edit.mjs` after every write to the file. `null` where the schema does
 * not answer, and the caller then asks nothing: a package unable to say which keys exist cannot
 * call a key obsolete.
 */
export function allowedKeys(disk, packageRoot, which) {
  const schema = readJson(disk, join(packageRoot, 'schemas', 'blocks.json'));
  const list = schema && schema.params && schema.params[which];
  if (!Array.isArray(list)) return null;
  return new Set(list.map((key) => String(key).split('.')[0]));
}

/** A path of `project.json`, resolved against the technical root. */
function fromRoot(root, value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const cleaned = value.trim().replace(/\\/g, '/');
  return isAbsolute(cleaned) || /^[A-Za-z]:/.test(cleaned) ? resolve(cleaned) : resolve(root, cleaned);
}

/** The host `init` runs on, read off the environment: the name passed on the command line, else
 * `default_host`, else the single host the environment declares. `null` where none answers — the
 * environment names no host, or `default_host` names one the `hosts` object does not carry. The
 * order the keys happen to stand in is never read: the host is named, not found. */
export function resolveHost(env, host) {
  const named = typeof host === 'string' && host.trim() ? host.trim() : null;
  if (named) return named;
  const hosts = env && env.hosts && typeof env.hosts === 'object' && !Array.isArray(env.hosts) ? env.hosts : null;
  if (!hosts) return null;
  const declared = typeof env.default_host === 'string' && env.default_host.trim() ? env.default_host.trim() : null;
  if (declared && Object.prototype.hasOwnProperty.call(hosts, declared)) return declared;
  const keys = Object.keys(hosts);
  return keys.length === 1 ? keys[0] : null;
}

/** The instructions file the resolved host declares, out of `{hosts.<host>.instructions_file}`.
 * Where no host answers, `DEFAULT_INSTRUCTIONS` answers the caller. */
export function declaredInstructionsFile(env, host) {
  const hosts = env && env.hosts && typeof env.hosts === 'object' && !Array.isArray(env.hosts) ? env.hosts : null;
  const name = resolveHost(env, host);
  const entry = name && hosts ? hosts[name] : null;
  const found = entry && entry.instructions_file;
  return typeof found === 'string' && found.trim() ? found.trim() : null;
}

/** Relative to the repository root, forward slashes: the form `git check-ignore` takes. */
function toRepo(top, absolute) {
  return relative(top, absolute).replace(/\\/g, '/');
}

/* ------------------------------------------------------------------------- *
 * `.gitignore`: which file covers a path
 * ------------------------------------------------------------------------- */

/**
 * `git check-ignore -v` lines — `<source>:<line>:<pattern>\t<path>` — as a map from path to the
 * verdict that counts for a clone: `repo` when a `.gitignore` inside the repository ignores it,
 * `machine` when only a global excludes file or `.git/info/exclude` does, `none` when nothing
 * does or the last matching pattern is a negation. A path absent from the output is `none`.
 */
export function parseCheckIgnore(stdout, top, paths) {
  const verdict = new Map(paths.map((p) => [p, 'none']));
  for (const line of String(stdout || '').split(/\r?\n/)) {
    const tab = line.indexOf('\t');
    if (tab === -1) continue;
    const head = line.slice(0, tab);
    const path = line.slice(tab + 1).replace(/^"|"$/g, '');
    const match = head.match(/^(.*):(\d+):(.*)$/);
    if (!match) continue;
    const [, source, , pattern] = match;
    if (!verdict.has(path)) continue;
    if (pattern.startsWith('!')) {
      verdict.set(path, 'none');
      continue;
    }
    const sourceAbs = isAbsolute(source) || /^[A-Za-z]:/.test(source) ? resolve(source) : resolve(top, source);
    const rel = relative(resolve(top), sourceAbs).replace(/\\/g, '/');
    const insideRepo = rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
    const repoFile = insideRepo && basename(sourceAbs) === '.gitignore' && !rel.startsWith('.git/');
    verdict.set(path, repoFile ? 'repo' : 'machine');
  }
  return verdict;
}

/* ------------------------------------------------------------------------- *
 * The host's default memory folder
 * ------------------------------------------------------------------------- */

/** Claude Code names a project folder after its path, every non-alphanumeric byte a dash. */
export function projectFolderName(root) {
  return resolve(root).replace(/[^A-Za-z0-9]/g, '-');
}

function leftoverHostMemory(disk, root) {
  try {
    const base = join(disk.home(), '.claude', 'projects');
    const wanted = projectFolderName(root).toLowerCase();
    const folder = disk.list(base).find((name) => name.toLowerCase() === wanted);
    if (!folder) return [];
    const memory = join(base, folder, 'memory');
    if (!disk.exists(memory)) return [];
    return disk.list(memory);
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------------- *
 * The scan
 * ------------------------------------------------------------------------- */

export function scan(rootIn, disk = REAL, packageRoot = PACKAGE, host = null) {
  const root = resolve(rootIn);
  const daiku = join(root, '.daiku');
  const projectFile = join(daiku, 'project.json');
  if (!disk.exists(projectFile)) return { fresh: true, missing: [], legacy: [], params: [] };

  const missing = [];
  const legacy = [];
  const params = [];
  const miss = (id, step, detail) => missing.push({ id, step, detail });
  const behind = (list, id, step, detail) => list.push({ id, step, detail });
  const project = readJson(disk, projectFile) || {};
  const current = packageVersion(disk, packageRoot);

  // Environment: either seat of §8 counts.
  const localEnv = join(daiku, 'environment.local.json');
  const sharedEnv = join(daiku, 'environment.json');
  if (!disk.exists(localEnv) && !disk.exists(sharedEnv)) {
    miss('environment', '4', '.daiku/environment.json');
  }

  // Domain and policies: the READMEs, and every default the package carries.
  for (const folder of ['domain', 'policies']) {
    if (!disk.exists(join(daiku, folder, 'README.md'))) miss(`${folder}-readme`, '5', `.daiku/${folder}/README.md`);
  }
  let defaults = [];
  try {
    defaults = disk.list(join(packageRoot, 'templates', 'project', 'domain')).filter((n) => n !== 'README.md');
  } catch {
    defaults = [];
  }
  for (const name of defaults) {
    if (!disk.exists(join(daiku, 'domain', name))) miss(`domain:${name}`, '5', `.daiku/domain/${name}`);
  }

  // Daiku's own documentation, beside the parameters it documents.
  if (!disk.exists(join(daiku, 'README.md'))) miss('daiku-readme', '5', '.daiku/README.md');

  // The update script, and the task running it. A script of another version is as missing as an
  // absent one: `init` recreates it whole from the skeleton, and this is what tells it to.
  const updateScript = join(daiku, 'update.mjs');
  if (!disk.exists(updateScript)) {
    miss('update-script', '5-bis', '.daiku/update.mjs');
  } else {
    const written = readText(disk, updateScript);
    const stamped = markedVersion(written);
    if (written !== null && current && stamped !== current) {
      miss(
        'update-script',
        '5-bis',
        `.daiku/update.mjs — written by ${stamped ? `Daiku ${stamped}` : 'an init that left no marker'}, this package is ${current}`
      );
    }
  }
  const tasks = readText(disk, join(root, '.vscode', 'tasks.json'));
  const labelled = new RegExp(`"label"\\s*:\\s*"${TASK_LABEL}"`);
  if (tasks === null || !labelled.test(tasks)) miss('update-task', '5-bis', `.vscode/tasks.json — task "${TASK_LABEL}"`);

  // The instructions file, with the marker. The environment pair of §8: the first file that
  // exists **and parses** wins, taken whole — a local file that does not parse is skipped and the
  // shared one is read, and the built-in default is only the fallback when neither names the key.
  const env = readJson(disk, localEnv) || readJson(disk, sharedEnv) || {};
  const resolvedHost = resolveHost(env, host);
  const instructionsName = declaredInstructionsFile(env, resolvedHost) || DEFAULT_INSTRUCTIONS;
  const instructions = readText(disk, join(root, instructionsName));
  if (instructions === null || !instructions.includes(MARKER)) miss('instructions', '6', instructionsName);

  // The memory corpus: its folder and its index.
  const memory = project.memory && typeof project.memory === 'object' ? project.memory : {};
  const memoryRoot = fromRoot(root, memory.root);
  if (memoryRoot) {
    if (!disk.exists(memoryRoot)) miss('memory-root', '3', memory.root);
    const index = typeof memory.index === 'string' && memory.index.trim() ? memory.index.trim() : null;
    if (index) {
      const candidates = [fromRoot(root, index), join(memoryRoot, index)];
      if (!candidates.some((c) => c && disk.exists(c))) miss('memory-index', '3', index);
    }
  }

  // The host memory pointed inside, and nothing left in its default folder. This is Claude Code's
  // seat and exists only there: on opencode `init` does not write `.claude/settings.local.json`,
  // so neither the seat nor the host's default folder is expected of that host.
  if (resolvedHost !== 'opencode') {
    const settings = readJson(disk, join(root, '.claude', 'settings.local.json'));
    const pointed = settings && 'autoMemoryEnabled' in settings && 'autoMemoryDirectory' in settings;
    if (!pointed) miss('host-memory', '7', '.claude/settings.local.json — autoMemoryEnabled, autoMemoryDirectory');
    const leftover = leftoverHostMemory(disk, root);
    if (leftover.length) miss('memory-move', '7', `${leftover.length} file(s) in the host's default memory folder`);
  }

  const relTo = (p) => relative(root, p).replace(/\\/g, '/');

  // The nesting declaration of an opencode project: `experimental.subagent_depth` in the
  // project's own `opencode.json`, written by `init`'s `4-bis` step and by nothing else. The
  // key counts as present under **any** value the project declares — the project's own choice
  // wins, so there is nothing left to do — and a file that does not parse as JSON is left as it
  // is and never listed: a relaunch that cannot write it must not stay "not everything ready"
  // forever. An unreadable file is fail-open like everywhere else in this program.
  if (resolvedHost === 'opencode') {
    const path = join(root, 'opencode.json');
    if (!disk.exists(path)) {
      miss('depth', DEPTH_STEP, 'opencode.json — experimental.subagent_depth');
    } else {
      const text = readText(disk, path);
      let parsed = null;
      if (text !== null) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = null;
        }
      }
      if (text !== null && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const experimental = parsed.experimental;
        const declared = experimental && typeof experimental === 'object' && !Array.isArray(experimental)
          && Object.prototype.hasOwnProperty.call(experimental, 'subagent_depth');
        if (!declared) miss('depth', DEPTH_STEP, 'opencode.json — experimental.subagent_depth');
      }
    }
  }

  // What Daiku no longer writes: the seats of the layout before `.daiku/` this list holds —
  // machinery the package owns, a parameter pair a reader opens and a script a settings entry
  // starts — and never a document the project may have written for itself.
  for (const [seat, was] of RETIRED) {
    if (disk.exists(join(root, seat))) behind(legacy, `retired:${seat}`, '9', `${seat} — ${was}`);
  }
  // And the entries still pointing at one. Removing the file without its line would leave a hook
  // configured against a path that no longer exists: fail-open, it starts nothing and says nothing,
  // and a guardrail that seems to exist denies nothing. Both files are read; neither is `init`'s,
  // so of them only that entry goes.
  for (const seat of SETTINGS_FILES) {
    const text = readText(disk, join(root, seat));
    if (text === null) continue;
    for (const [retired] of RETIRED) {
      if (text.includes(retired)) {
        behind(legacy, `retired-pointing:${seat}:${retired}`, '9', `${seat} — an entry pointing at ${retired}`);
      }
    }
  }

  // The parameters: a key the contract no longer names is an artefact behind like any other, and
  // the two lists in `schemas/blocks.json` are what names them. Every existing file is read, the
  // machine's included; they are the project's, and this program only measures them.
  for (const [file, which] of [
    [projectFile, 'project_json'],
    [join(daiku, 'environment.json'), 'environment_json'],
    [localEnv, 'environment_json'],
  ]) {
    const declared = readJson(disk, file);
    if (!declared || typeof declared !== 'object') continue;
    const allowed = allowedKeys(disk, packageRoot, which);
    if (!allowed) continue;
    for (const key of Object.keys(declared)) {
      if (!allowed.has(key)) {
        behind(params, `param:${relTo(file)}:${key}`, '9', `${relTo(file)} — ${key}, which the contract no longer names`);
      }
    }
  }

  // `.gitignore`: what must stay out, what must stay in.
  const top = disk.toplevel(root);
  if (top) {
    const out = [join(daiku, 'environment.local.json')];
    const review = fromRoot(root, project.paths && project.paths.review_state);
    if (review) out.push(review);
    // The delivery-worktree pool holds working copies of the repository: inside the tree it must be
    // ignored like the review state; declared outside it, there is nothing to ask of `.gitignore`.
    const pool = fromRoot(root, project.worktree && project.worktree.pool);
    if (pool) {
      const rel = toRepo(top, pool);
      if (rel && !rel.startsWith('..') && !isAbsolute(rel)) out.push(pool);
    }
    // The machine's settings file is Claude Code's, and only a Claude Code project carries it.
    if (resolvedHost !== 'opencode') out.push(join(root, '.claude', 'settings.local.json'));
    const keep = [projectFile];
    if (memoryRoot) keep.push(join(memoryRoot, basename(String(memory.index || 'MEMORY.md'))));
    const all = [...out, ...keep].map((p) => toRepo(top, p));
    const stdout = disk.checkIgnore(top, all);
    if (stdout !== null) {
      const verdict = parseCheckIgnore(stdout, top, all);
      out.map((p) => toRepo(top, p)).forEach((p) => {
        if (verdict.get(p) !== 'repo') miss(`gitignore-out:${p}`, '8', `${p} — not ignored by the repository's .gitignore`);
      });
      keep.map((p) => toRepo(top, p)).forEach((p) => {
        if (verdict.get(p) !== 'none') miss(`gitignore-in:${p}`, '8', `${p} — ignored, must stay versioned`);
      });
    }
  }

  return { fresh: false, missing, legacy, params };
}

/* ------------------------------------------------------------------------- *
 * The bench
 * ------------------------------------------------------------------------- */

const T = 'C:/work/repo/src';
const TOP = 'C:/work/repo';
const PKG = 'C:/pkg';
/** The version the fake package carries, and the one a script it wrote must declare. */
const VERSION = '1.0.8';

function fakeDisk(files, extra = {}) {
  const spell = (p) => resolve(String(p)).replace(/\\/g, '/');
  const entries = Object.entries(files).map(([k, v]) => [spell(k), v]);
  const same = (a, b) => a.toLowerCase() === b.toLowerCase();
  const under = (file, dir) => file.toLowerCase().startsWith(`${dir.toLowerCase()}/`);
  return {
    exists: (p) => entries.some(([k]) => same(k, spell(p)) || under(k, spell(p))),
    read: (p) => {
      const hit = entries.find(([k]) => same(k, spell(p)));
      if (!hit) throw new Error('ENOENT');
      return hit[1];
    },
    list: (p) => {
      const dir = spell(p);
      const names = new Set(entries.filter(([k]) => under(k, dir)).map(([k]) => k.slice(dir.length + 1).split('/')[0]));
      if (!names.size) throw new Error('ENOENT');
      return [...names];
    },
    home: () => 'C:/Users/me',
    toplevel: () => TOP,
    checkIgnore: () =>
      '.gitignore:3:.daiku/environment.local.json\tsrc/.daiku/environment.local.json\n' +
      '.gitignore:4:.dev-runtime/\tsrc/.dev-runtime/review\n' +
      '.gitignore:5:.claude/settings.local.json\tsrc/.claude/settings.local.json\n',
    ...extra,
  };
}

/** A project `init` fully opened. */
function complete() {
  return {
    [`${PKG}/.claude-plugin/plugin.json`]: JSON.stringify({ name: 'daiku', version: VERSION }),
    // The two key lists the params check reads. Small on purpose: what the bench exercises is the
    // comparison against them, not the keys the real package happens to name today.
    [`${PKG}/schemas/blocks.json`]: JSON.stringify({
      params: {
        project_json: ['contract', 'name', 'memory.root', 'memory.index', 'paths.review_state'],
        environment_json: ['contract', 'default_host', 'hosts', 'hosts.<host>.instructions_file'],
      },
    }),
    [`${PKG}/templates/project/domain/README.md`]: '#',
    [`${PKG}/templates/project/domain/commit-convention.md`]: '#',
    [`${PKG}/templates/project/domain/memory-contract.md`]: '#',
    [`${T}/.daiku/project.json`]: JSON.stringify({
      contract: 1,
      memory: { root: 'memory', index: 'memory/MEMORY.md' },
      paths: { review_state: '.dev-runtime/review' },
    }),
    [`${T}/.daiku/environment.json`]: JSON.stringify({ contract: 1, hosts: { claude: { instructions_file: 'CLAUDE.md' } } }),
    [`${T}/.daiku/domain/README.md`]: '#',
    [`${T}/.daiku/domain/commit-convention.md`]: '#',
    [`${T}/.daiku/domain/memory-contract.md`]: '#',
    [`${T}/.daiku/policies/README.md`]: '#',
    [`${T}/.daiku/README.md`]: '# Daiku',
    [`${T}/.daiku/update.mjs`]: `// daiku:script ${VERSION}\n`,
    [`${T}/.vscode/tasks.json`]: '{ // tasks\n "tasks": [ { "label": "daiku: update" } ] }',
    [`${T}/CLAUDE.md`]: `# Project\n\n${MARKER} — structured -->\n`,
    [`${T}/memory/MEMORY.md`]: '# Memory',
    [`${T}/.claude/settings.local.json`]: JSON.stringify({ autoMemoryEnabled: true, autoMemoryDirectory: `${T}/memory` }),
  };
}

function without(files, ...keys) {
  const copy = { ...files };
  for (const k of keys) delete copy[k];
  return copy;
}

function selfCheck() {
  const failed = [];
  let ran = 0;
  const check = (name, condition) => {
    ran += 1;
    if (!condition) failed.push(name);
  };
  const ids = (result) => result.missing.map((m) => m.id);

  check('no project.json: fresh, nothing listed', (() => {
    const r = scan(T, fakeDisk({}), PKG);
    return r.fresh === true && r.missing.length === 0;
  })());

  const full = scan(T, fakeDisk(complete()), PKG);
  check('a fully opened project: nothing missing', full.fresh === false && full.missing.length === 0);
  check(
    'a fully opened project: nothing behind either',
    full.legacy.length === 0 && full.params.length === 0
  );

  const cases = [
    ['missing update script', without(complete(), `${T}/.daiku/update.mjs`), 'update-script'],
    ['an update script written by an older package', { ...complete(), [`${T}/.daiku/update.mjs`]: '// daiku:script 1.0.7\n' }, 'update-script'],
    ['an update script an older init left without a marker', { ...complete(), [`${T}/.daiku/update.mjs`]: '//\n' }, 'update-script'],
    ['missing tasks.json', without(complete(), `${T}/.vscode/tasks.json`), 'update-task'],
    ['tasks.json without the daiku task', { ...complete(), [`${T}/.vscode/tasks.json`]: '{"tasks":[{"label":"build"}]}' }, 'update-task'],
    ['instructions without the marker', { ...complete(), [`${T}/CLAUDE.md`]: '# Project\n' }, 'instructions'],
    ['a domain default missing', without(complete(), `${T}/.daiku/domain/memory-contract.md`), 'domain:memory-contract.md'],
    ['policies README missing', without(complete(), `${T}/.daiku/policies/README.md`), 'policies-readme'],
    ['Daiku\'s own README missing', without(complete(), `${T}/.daiku/README.md`), 'daiku-readme'],
    ['environment missing', without(complete(), `${T}/.daiku/environment.json`), 'environment'],
    ['memory index missing', { ...without(complete(), `${T}/memory/MEMORY.md`), [`${T}/memory/auth.md`]: '#' }, 'memory-index'],
    ['host memory not pointed', without(complete(), `${T}/.claude/settings.local.json`), 'host-memory'],
    ['host memory left in the default folder', { ...complete(), 'C:/Users/me/.claude/projects/C--work-repo-src/memory/a.md': '#' }, 'memory-move'],
  ];
  for (const [name, files, id] of cases) {
    const r = scan(T, fakeDisk(files), PKG);
    check(`${name}: listed as ${id}`, ids(r).includes(id));
    check(`${name}: nothing else listed`, ids(r).length === 1);
  }

  const localEnv = { ...without(complete(), `${T}/.daiku/environment.json`), [`${T}/.daiku/environment.local.json`]: '{"contract":1}' };
  check('the machine environment file counts', !ids(scan(T, fakeDisk(localEnv), PKG)).includes('environment'));

  // --- the host is resolved, and the instructions file follows it ------------------
  //
  // The environment names two hosts, and the file `init` expects must be the one of the host it
  // runs on — never the one that happens to stand first in the object. The cases below put the
  // host that must win *second* on purpose: a scan that reads the first entry answers `AGENTS.md`
  // and reports `instructions` missing, which is the defect these cases hold.
  const twoHosts = (order, defaultHost, extra = {}) => {
    const hosts = {};
    for (const name of order) hosts[name] = { instructions_file: name === 'opencode' ? 'AGENTS.md' : 'CLAUDE.md' };
    const env = { contract: 1, hosts };
    if (defaultHost) env.default_host = defaultHost;
    return {
      ...without(complete(), `${T}/CLAUDE.md`),
      [`${T}/.daiku/environment.json`]: JSON.stringify(env),
      [`${T}/CLAUDE.md`]: `# Project\n\n${MARKER} -->\n`,
      ...extra,
    };
  };
  check('two hosts, default_host claude: CLAUDE.md is the file expected', !ids(scan(T, fakeDisk(twoHosts(['claude', 'opencode'], 'claude')), PKG)).includes('instructions'));
  check('two hosts, opencode written first, default_host claude: still CLAUDE.md', !ids(scan(T, fakeDisk(twoHosts(['opencode', 'claude'], 'claude')), PKG)).includes('instructions'));

  const opencodeEnv = {
    ...without(complete(), `${T}/CLAUDE.md`),
    [`${T}/.daiku/environment.json`]: JSON.stringify({ contract: 1, default_host: 'opencode', hosts: { claude: { instructions_file: 'CLAUDE.md' }, opencode: { instructions_file: 'AGENTS.md' } } }),
    [`${T}/AGENTS.md`]: `# Project\n\n${MARKER} -->\n`,
  };
  check('default_host opencode: AGENTS.md is the file expected', !ids(scan(T, fakeDisk(opencodeEnv), PKG)).includes('instructions'));
  // The host named on the command line wins over `default_host`: the environment declares `claude`
  // as its default and only `AGENTS.md` is on disk, so a scan that ignored the fourth argument would
  // resolve `claude`, find `CLAUDE.md` absent, and report `instructions` missing. The case can fail
  // for the defect it names, which the previous one — `default_host` already `opencode` — could not.
  const hostArgEnv = {
    ...without(complete(), `${T}/CLAUDE.md`),
    [`${T}/.daiku/environment.json`]: JSON.stringify({ contract: 1, default_host: 'claude', hosts: { claude: { instructions_file: 'CLAUDE.md' }, opencode: { instructions_file: 'AGENTS.md' } } }),
    [`${T}/AGENTS.md`]: `# Project\n\n${MARKER} -->\n`,
  };
  check('the host named on the command line wins over default_host', !ids(scan(T, fakeDisk(hostArgEnv), PKG, 'opencode')).includes('instructions'));
  check('a single declared host answers without default_host', !ids(scan(T, fakeDisk(complete()), PKG)).includes('instructions'));
  const noHosts = { ...complete(), [`${T}/.daiku/environment.json`]: JSON.stringify({ contract: 1 }) };
  check('no hosts at all: the built-in default (CLAUDE.md)', !ids(scan(T, fakeDisk(noHosts), PKG)).includes('instructions'));

  // The seats of the host memory exist on Claude Code and nowhere else: on opencode `init` does
  // not write `.claude/settings.local.json`, so neither the seat nor the folder is expected.
  const opencodeProject = {
    ...without(complete(), `${T}/CLAUDE.md`, `${T}/.claude/settings.local.json`),
    [`${T}/.daiku/environment.json`]: JSON.stringify({ contract: 1, default_host: 'opencode', hosts: { opencode: { instructions_file: 'AGENTS.md' } } }),
    [`${T}/AGENTS.md`]: `# Project\n\n${MARKER} -->\n`,
  };
  const opencodeMissing = ids(scan(T, fakeDisk(opencodeProject), PKG));
  check('on opencode the host-memory seat is not expected', !opencodeMissing.includes('host-memory'));
  const opencodeLeftover = { ...opencodeProject, 'C:/Users/me/.claude/projects/C--work-repo-src/memory/a.md': '#' };
  check('on opencode the host default memory folder is not watched', !ids(scan(T, fakeDisk(opencodeLeftover), PKG)).includes('memory-move'));

  // --- the nesting key of an opencode project, measured where the host reads it ----------
  //
  // `init` writes `experimental.subagent_depth` into the project's own `opencode.json` as its
  // `4-bis` step; the scan lists the missing key and nothing else about that file. The cases are
  // the absence, the two shapes that leave the key out, the value the project itself declares,
  // the file that does not parse, and the same ground on Claude Code, where the step does not
  // exist at all.
  const withDepthFile = (json) => ({
    ...opencodeProject,
    [`${T}/opencode.json`]: typeof json === 'string' ? json : JSON.stringify(json),
  });

  const noKeyFile = scan(T, fakeDisk(opencodeProject), PKG);
  check(
    'no opencode.json on opencode: the key is listed at 4-bis',
    noKeyFile.missing.some((m) => m.id === 'depth' && m.step === '4-bis')
  );
  check('and it is the only thing missing', JSON.stringify(ids(noKeyFile)) === JSON.stringify(['depth']), ids(noKeyFile).join(','));

  const rootless = scan(T, fakeDisk(withDepthFile({ $schema: 'x', model: 'a/b' })), PKG);
  check(
    'an opencode.json without experimental: the key is listed',
    rootless.missing.some((m) => m.id === 'depth' && m.step === '4-bis')
  );

  const blockless = scan(T, fakeDisk(withDepthFile({ experimental: { policies: true } })), PKG);
  check(
    'an experimental block without the key: listed',
    blockless.missing.some((m) => m.id === 'depth' && m.step === '4-bis')
  );

  const declared = scan(T, fakeDisk(withDepthFile({ experimental: { subagent_depth: 1 } })), PKG);
  check('a value the project declares: the key is present', !ids(declared).includes('depth'));
  check('and nothing else is missing either', declared.missing.length === 0, ids(declared).join(','));

  const rootKey = scan(T, fakeDisk(withDepthFile({ subagent_depth: 5 })), PKG);
  check('a root-level key is not the key opencode reads: listed', ids(rootKey).includes('depth'));

  const unparsable = scan(T, fakeDisk(withDepthFile('{ // comment\n "experimental": {} }')), PKG);
  check('an unparsable opencode.json is never listed', !ids(unparsable).includes('depth'));
  check('and nothing else is missing on it', unparsable.missing.length === 0, ids(unparsable).join(','));

  // The same ground on Claude Code: no key, no step, nothing named `4-bis`.
  check('on Claude Code the nesting key is never expected', !ids(scan(T, fakeDisk(complete()), PKG)).includes('depth'));

  // The pair of §8: the first file that exists **and parses** wins, taken whole. A local file that
  // does not parse is skipped and the shared one is read — its non-standard name is honoured, and the
  // built-in default is never reached. `CLAUDE.md` is deliberately absent, so the only way `instructions`
  // stays unlisted is that `GUIDE.md` was read.
  const unreadableLocal = {
    ...without(complete(), `${T}/CLAUDE.md`),
    [`${T}/.daiku/environment.json`]: JSON.stringify({ contract: 1, hosts: { claude: { instructions_file: 'GUIDE.md' } } }),
    [`${T}/.daiku/environment.local.json`]: '{ this is not json',
    [`${T}/GUIDE.md`]: `# Project\n\n${MARKER} -->\n`,
  };
  check(
    'a local file that does not parse is skipped, the shared one names the instructions file',
    !ids(scan(T, fakeDisk(unreadableLocal), PKG)).includes('instructions')
  );

  const globalOnly = fakeDisk(complete(), {
    checkIgnore: () =>
      '.gitignore:3:.daiku/environment.local.json\tsrc/.daiku/environment.local.json\n' +
      '.gitignore:4:.dev-runtime/\tsrc/.dev-runtime/review\n' +
      'C:/Users/me/.config/git/ignore:3:**/.claude/settings.local.json\tsrc/.claude/settings.local.json\n',
  });
  check('a path only the global excludes file covers is missing', ids(scan(T, globalOnly, PKG)).includes('gitignore-out:src/.claude/settings.local.json'));

  const daikuIgnored = fakeDisk(complete(), {
    checkIgnore: (top, paths) =>
      fakeDisk({}).checkIgnore(top, paths) + '.gitignore:9:.daiku/\tsrc/.daiku/project.json\n',
  });
  check('an ignored .daiku/ is missing', ids(scan(T, daikuIgnored, PKG)).includes('gitignore-in:src/.daiku/project.json'));

  // The delivery-worktree pool: inside the repository it is ignored like the review state; declared
  // outside it, `.gitignore` is not asked about it at all.
  const withPool = (value, checkIgnore) =>
    fakeDisk(
      {
        ...complete(),
        [`${T}/.daiku/project.json`]: JSON.stringify({
          contract: 1,
          memory: { root: 'memory', index: 'memory/MEMORY.md' },
          paths: { review_state: '.dev-runtime/review' },
          worktree: { pool: value },
        }),
      },
      { checkIgnore }
    );
  const pooled = withPool(
    '.daiku-worktrees',
    () => fakeDisk({}).checkIgnore() + '.gitignore:6:.daiku-worktrees\tsrc/.daiku-worktrees\n'
  );
  check('a pool inside the repository and ignored: nothing missing', scan(T, pooled, PKG).missing.length === 0);

  const poolUnignored = withPool('.daiku-worktrees', () => fakeDisk({}).checkIgnore());
  const poolMissing = ids(scan(T, poolUnignored, PKG));
  check('a pool inside the repository and not ignored: listed', poolMissing.includes('gitignore-out:src/.daiku-worktrees'));
  check('a pool inside the repository and not ignored: nothing else listed', poolMissing.length === 1);

  const poolOutside = withPool('../../pool-outside', () => fakeDisk({}).checkIgnore());
  const outsideMissing = ids(scan(T, poolOutside, PKG));
  check('a pool outside the repository: `.gitignore` is not asked about it', outsideMissing.length === 0);
  check(
    'a pool outside the repository: nothing is listed for it',
    !outsideMissing.some((id) => id.includes('pool-outside'))
  );

  const gitDown = fakeDisk(complete(), { checkIgnore: () => null });
  check('git that does not answer: fail-open, nothing listed', scan(T, gitDown, PKG).missing.length === 0);

  const noManifest = scan(T, fakeDisk(without(complete(), `${PKG}/.claude-plugin/plugin.json`)), PKG);
  check('a package that does not say which version it is: no script called old', noManifest.missing.length === 0);

  // --- what is behind, and not only what is missing ---------------------------

  const lists = (r) => ({
    legacy: r.legacy.map((entry) => entry.id),
    params: r.params.map((entry) => entry.id),
  });

  // The seats of the layout before `.daiku/`, and the entries still pointing at one.
  const oldLayout = {
    ...complete(),
    [`${T}/.claude/project.json`]: '{}',
    [`${T}/.claude/hooks/contratti-post-edit.mjs`]: '// an old copy\n',
    [`${T}/.claude/settings.json`]:
      '{ "hooks": { "PostToolUse": [ { "command": "node .claude/hooks/contratti-post-edit.mjs" } ] } }',
  };
  const retired = lists(scan(T, fakeDisk(oldLayout), PKG));
  check('a seat of the old layout is listed', retired.legacy.includes('retired:.claude/project.json'));
  check('two seats are two entries', retired.legacy.includes('retired:.claude/hooks/contratti-post-edit.mjs'));
  check(
    'an entry pointing at a retired file is listed',
    retired.legacy.includes('retired-pointing:.claude/settings.json:.claude/hooks/contratti-post-edit.mjs')
  );
  check('a seat of the old layout is not a missing piece', scan(T, fakeDisk(oldLayout), PKG).missing.length === 0);
  check('a project of the current layout lists no retired seat', lists(scan(T, fakeDisk(complete()), PKG)).legacy.length === 0);

  // A key the contract no longer names, and one it still does.
  const withKey = (key) => ({
    ...complete(),
    [`${T}/.daiku/project.json`]: JSON.stringify({
      contract: 1,
      memory: { root: 'memory', index: 'memory/MEMORY.md' },
      paths: { review_state: '.dev-runtime/review' },
      [key]: 'x',
    }),
  });
  check(
    'a key the contract no longer names is listed',
    lists(scan(T, fakeDisk(withKey('tech_doc')), PKG)).params.includes('param:.daiku/project.json:tech_doc')
  );
  check('a key the contract still names is not', lists(scan(T, fakeDisk(withKey('name')), PKG)).params.length === 0);
  const envKey = {
    ...complete(),
    [`${T}/.daiku/environment.json`]: JSON.stringify({
      contract: 1,
      hosts: { claude: { instructions_file: 'CLAUDE.md' } },
      temp_dir: 'C:/tmp',
    }),
  };
  check(
    'the environment is asked too',
    lists(scan(T, fakeDisk(envKey), PKG)).params.includes('param:.daiku/environment.json:temp_dir')
  );

  // The two helpers alone.
  check('allowed keys: the first segment is what a file can be asked about', allowedKeys(fakeDisk(complete()), PKG, 'project_json').has('paths'));
  check('allowed keys: a list the schema does not carry asks nothing', allowedKeys(fakeDisk(complete()), PKG, 'nope') === null);
  check('allowed keys: a package without the schema asks nothing', allowedKeys(fakeDisk({}), PKG, 'project_json') === null);

  // The marker alone.
  check('marker: the version is read', markedVersion('// daiku:script 1.0.8 — note\n') === '1.0.8');
  check('marker: a file without it declares nothing', markedVersion('// hello\n') === null);
  // `init` filling the copy in badly — the placeholder left in — is caught as an old script.
  check('marker: the unfilled placeholder is not the package version', markedVersion('// daiku:script <version>\n') !== VERSION);

  // The parser alone.
  const parsed = parseCheckIgnore(
    '.gitignore:1:*.log\ta.log\n.gitignore:2:!keep.log\tkeep.log\n.git/info/exclude:1:x\tx\nsub/.gitignore:1:y\tsub/y\n',
    TOP,
    ['a.log', 'keep.log', 'x', 'sub/y', 'free']
  );
  check('parse: a repository .gitignore is repo', parsed.get('a.log') === 'repo');
  check('parse: a negation is none', parsed.get('keep.log') === 'none');
  check('parse: .git/info/exclude is machine', parsed.get('x') === 'machine');
  check('parse: a nested .gitignore is repo', parsed.get('sub/y') === 'repo');
  check('parse: an unmatched path is none', parsed.get('free') === 'none');

  check('folder name: every non-alphanumeric byte a dash', projectFolderName('C:/work/repo/src') === 'C--work-repo-src');

  // --- the command line ------------------------------------------------------------------
  const tailHost = parseArgs(['C:/work/repo', '--host', 'opencode']);
  check('--host in the tail is read', tailHost.host === 'opencode');
  check('--host in the tail leaves the root', tailHost.root === 'C:/work/repo');
  const bareHost = parseArgs(['C:/work/repo', '--host']);
  check('a --host with no value names no host', bareHost.host === null);
  check('a --host with no value leaves the root', bareHost.root === 'C:/work/repo');
  check('no --host leaves the host unnamed', parseArgs(['C:/work/repo']).host === null);
  check('no arguments: no root', parseArgs([]).root === null);

  process.stdout.write(JSON.stringify({ checks: ran, passed: ran - failed.length, failed }, null, 2) + '\n');
  return failed.length ? 1 : 0;
}

/* ------------------------------------------------------------------------- *
 * The command line
 * ------------------------------------------------------------------------- */

/**
 * The command line, read: the technical root and the optional `--host <name>`. `--host` may stand
 * anywhere; a `--host` with no value after it names no host, and the root is the first token that is
 * not `--host` or its value. Exported so the bench exercises the parsing instead of the process.
 */
export function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const hostAt = args.indexOf('--host');
  const hasValue = hostAt !== -1 && typeof args[hostAt + 1] === 'string';
  const host = hasValue ? args[hostAt + 1] : null;
  const positional = hostAt === -1 ? args.slice() : args.filter((a, i) => i !== hostAt && i !== hostAt + 1);
  return { root: positional[0] || null, host };
}

/* ------------------------------------------------------------------------- *
 * Entry
 * ------------------------------------------------------------------------- */

function invokedDirectly() {
  try {
    const launched = process.argv[1];
    if (!launched) return true;
    return realpathSync(fileURLToPath(import.meta.url)).toLowerCase() === realpathSync(launched).toLowerCase();
  } catch {
    return true;
  }
}

if (invokedDirectly()) {
  const argv = process.argv.slice(2);
  if (argv[0] === '--self-check') process.exit(selfCheck());
  const { root, host } = parseArgs(argv);
  if (!root) {
    process.stderr.write('usage: node scan.mjs <technical-root> [--host <name>]\n       node scan.mjs --self-check\n');
    process.exit(2);
  }
  process.stdout.write(JSON.stringify(scan(root, REAL, PACKAGE, host)) + '\n');
  process.exit(0);
}
