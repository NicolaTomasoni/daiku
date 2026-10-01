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
 *  - `.daiku/README.md`, Daiku's own documentation, deposited beside the parameters;
 *  - the host's instructions file, carrying the marker line `init` leaves in it;
 *  - `{memory.root}` and its index;
 *  - on Claude Code, the two memory keys in `.claude/settings.local.json`, and no memory file
 *    left in the host's default folder under `~/.claude/projects/`;
 *  - the `.gitignore` lines: the machine's files and `{paths.review_state}` ignored by **the
 *    repository's own** `.gitignore` — a global excludes file or `.git/info/exclude` is one
 *    machine's, and a clone carries none of it — and `.daiku/` and the memory corpus not ignored.
 *
 * What it does not check: the domain roles the project may answer in a file written after the
 * first run. Telling that needs reading the repository, and this program reads only what `init`
 * wrote.
 *
 *   node <package-root>/skills/init/scan.mjs <technical-root> <claude|codex>
 *       one JSON object on stdout — `{fresh, missing: [{id, step, detail}]}` — exit 0.
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
/** The marker `init` leaves at the top of every script it deposits, holding the package version
 * that wrote it. The skeletons carry it with `<version>`, which `init` fills on the copy. */
const SCRIPT_MARKER = /^\/\/ daiku:script\s+(\S+)/m;
const TASK_LABEL = 'daiku: update';
const DEFAULT_INSTRUCTIONS = { claude: 'CLAUDE.md', codex: 'AGENTS.md' };

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

/** The version this package carries, out of its own manifest: the one a script it deposits must
 * declare. Either host's manifest answers, and `null` where neither does — a package unable to
 * say which version it is cannot call a script old, and stays silent. */
export function packageVersion(disk, packageRoot) {
  for (const folder of ['.claude-plugin', '.codex-plugin']) {
    const manifest = readJson(disk, join(packageRoot, folder, 'plugin.json'));
    const version = manifest && manifest.version;
    if (typeof version === 'string' && version.trim()) return version.trim();
  }
  return null;
}

/** A path of `project.json`, resolved against the technical root. */
function fromRoot(root, value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const cleaned = value.trim().replace(/\\/g, '/');
  return isAbsolute(cleaned) || /^[A-Za-z]:/.test(cleaned) ? resolve(cleaned) : resolve(root, cleaned);
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

export function scan(rootIn, host, disk = REAL, packageRoot = PACKAGE) {
  const root = resolve(rootIn);
  const daiku = join(root, '.daiku');
  const projectFile = join(daiku, 'project.json');
  if (!disk.exists(projectFile)) return { fresh: true, missing: [] };

  const missing = [];
  const miss = (id, step, detail) => missing.push({ id, step, detail });
  const project = readJson(disk, projectFile) || {};

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
    const current = packageVersion(disk, packageRoot);
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

  // The instructions file of this host, with the marker.
  const env = readJson(disk, disk.exists(localEnv) ? localEnv : sharedEnv) || {};
  const declared = env.hosts && env.hosts[host] && env.hosts[host].instructions_file;
  const instructionsName = typeof declared === 'string' && declared.trim() ? declared.trim() : DEFAULT_INSTRUCTIONS[host];
  const instructions = readText(disk, join(root, instructionsName));
  if (instructions === null || !instructions.includes(MARKER)) miss('instructions', '6', instructionsName);

  // The memory corpus: its folder and its index.
  const memory = project.memory && typeof project.memory === 'object' ? project.memory : {};
  const memoryRoot = fromRoot(root, memory.root);
  if (memoryRoot) {
    if (!disk.exists(memoryRoot)) miss('memory-root', '7', memory.root);
    const index = typeof memory.index === 'string' && memory.index.trim() ? memory.index.trim() : null;
    if (index) {
      const candidates = [fromRoot(root, index), join(memoryRoot, index)];
      if (!candidates.some((c) => c && disk.exists(c))) miss('memory-index', '7', index);
    }
  }

  // Claude Code only: the host memory pointed inside, and nothing left in its default folder.
  if (host === 'claude') {
    const settings = readJson(disk, join(root, '.claude', 'settings.local.json'));
    const pointed = settings && 'autoMemoryEnabled' in settings && 'autoMemoryDirectory' in settings;
    if (!pointed) miss('host-memory', '7', '.claude/settings.local.json — autoMemoryEnabled, autoMemoryDirectory');
    const leftover = leftoverHostMemory(disk, root);
    if (leftover.length) miss('memory-move', '7', `${leftover.length} file(s) in the host's default memory folder`);
  }

  // `.gitignore`: what must stay out, what must stay in.
  const top = disk.toplevel(root);
  if (top) {
    const out = [join(daiku, 'environment.local.json')];
    const review = fromRoot(root, project.paths && project.paths.review_state);
    if (review) out.push(review);
    if (host === 'claude') out.push(join(root, '.claude', 'settings.local.json'));
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

  return { fresh: false, missing };
}

/* ------------------------------------------------------------------------- *
 * The bench
 * ------------------------------------------------------------------------- */

const T = 'C:/work/repo/src';
const TOP = 'C:/work/repo';
const PKG = 'C:/pkg';
/** The version the fake package carries, and the one a script it deposited must declare. */
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

/** A project `init` fully opened, on Claude Code. */
function complete() {
  return {
    [`${PKG}/.claude-plugin/plugin.json`]: JSON.stringify({ name: 'daiku', version: VERSION }),
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
    const r = scan(T, 'claude', fakeDisk({}), PKG);
    return r.fresh === true && r.missing.length === 0;
  })());

  const full = scan(T, 'claude', fakeDisk(complete()), PKG);
  check('a fully opened project: nothing missing', full.fresh === false && full.missing.length === 0);

  const cases = [
    ['missing update script', without(complete(), `${T}/.daiku/update.mjs`), 'claude', 'update-script'],
    ['an update script written by an older package', { ...complete(), [`${T}/.daiku/update.mjs`]: '// daiku:script 1.0.7\n' }, 'claude', 'update-script'],
    ['an update script an older init left without a marker', { ...complete(), [`${T}/.daiku/update.mjs`]: '//\n' }, 'claude', 'update-script'],
    ['missing tasks.json', without(complete(), `${T}/.vscode/tasks.json`), 'claude', 'update-task'],
    ['tasks.json without the daiku task', { ...complete(), [`${T}/.vscode/tasks.json`]: '{"tasks":[{"label":"build"}]}' }, 'claude', 'update-task'],
    ['instructions without the marker', { ...complete(), [`${T}/CLAUDE.md`]: '# Project\n' }, 'claude', 'instructions'],
    ['a domain default missing', without(complete(), `${T}/.daiku/domain/memory-contract.md`), 'claude', 'domain:memory-contract.md'],
    ['policies README missing', without(complete(), `${T}/.daiku/policies/README.md`), 'claude', 'policies-readme'],
    ['Daiku\'s own README missing', without(complete(), `${T}/.daiku/README.md`), 'claude', 'daiku-readme'],
    ['environment missing', without(complete(), `${T}/.daiku/environment.json`), 'claude', 'environment'],
    ['memory index missing', { ...without(complete(), `${T}/memory/MEMORY.md`), [`${T}/memory/auth.md`]: '#' }, 'claude', 'memory-index'],
    ['host memory not pointed', without(complete(), `${T}/.claude/settings.local.json`), 'claude', 'host-memory'],
    ['host memory left in the default folder', { ...complete(), 'C:/Users/me/.claude/projects/C--work-repo-src/memory/a.md': '#' }, 'claude', 'memory-move'],
  ];
  for (const [name, files, host, id] of cases) {
    const r = scan(T, host, fakeDisk(files), PKG);
    check(`${name}: listed as ${id}`, ids(r).includes(id));
    check(`${name}: nothing else listed`, ids(r).length === 1);
  }

  const localEnv = { ...without(complete(), `${T}/.daiku/environment.json`), [`${T}/.daiku/environment.local.json`]: '{"contract":1}' };
  check('the machine environment file counts', !ids(scan(T, 'claude', fakeDisk(localEnv), PKG)).includes('environment'));

  const codex = scan(T, 'codex', fakeDisk({ ...without(complete(), `${T}/.claude/settings.local.json`), [`${T}/AGENTS.md`]: `${MARKER} -->` }), PKG);
  check('on Codex the host memory is not checked', !ids(codex).includes('host-memory'));
  check('on Codex the instructions file is AGENTS.md', !ids(codex).includes('instructions'));

  const globalOnly = fakeDisk(complete(), {
    checkIgnore: () =>
      '.gitignore:3:.daiku/environment.local.json\tsrc/.daiku/environment.local.json\n' +
      '.gitignore:4:.dev-runtime/\tsrc/.dev-runtime/review\n' +
      'C:/Users/me/.config/git/ignore:3:**/.claude/settings.local.json\tsrc/.claude/settings.local.json\n',
  });
  check('a path only the global excludes file covers is missing', ids(scan(T, 'claude', globalOnly, PKG)).includes('gitignore-out:src/.claude/settings.local.json'));

  const daikuIgnored = fakeDisk(complete(), {
    checkIgnore: (top, paths) =>
      fakeDisk({}).checkIgnore(top, paths) + '.gitignore:9:.daiku/\tsrc/.daiku/project.json\n',
  });
  check('an ignored .daiku/ is missing', ids(scan(T, 'claude', daikuIgnored, PKG)).includes('gitignore-in:src/.daiku/project.json'));

  const gitDown = fakeDisk(complete(), { checkIgnore: () => null });
  check('git that does not answer: fail-open, nothing listed', scan(T, 'claude', gitDown, PKG).missing.length === 0);

  const noManifest = scan(T, 'claude', fakeDisk(without(complete(), `${PKG}/.claude-plugin/plugin.json`)), PKG);
  check('a package that does not say which version it is: no script called old', noManifest.missing.length === 0);

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
    return realpathSync(fileURLToPath(import.meta.url)).toLowerCase() === realpathSync(launched).toLowerCase();
  } catch {
    return true;
  }
}

if (invokedDirectly()) {
  const argv = process.argv.slice(2);
  if (argv[0] === '--self-check') process.exit(selfCheck());
  const [root, host] = argv;
  if (!root || !['claude', 'codex'].includes(host)) {
    process.stderr.write('usage: node scan.mjs <technical-root> <claude|codex>\n       node scan.mjs --self-check\n');
    process.exit(2);
  }
  process.stdout.write(JSON.stringify(scan(root, host)) + '\n');
  process.exit(0);
}
