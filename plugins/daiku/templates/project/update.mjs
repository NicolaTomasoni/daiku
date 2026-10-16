#!/usr/bin/env node
// daiku:script <version> — the Daiku version that wrote this file. `init` fills the version in
// when it copies the skeleton, and recreates the file whole whenever the package moves past it.
/**
 * Updates Daiku on the host this project runs on: it reads the version in place, draws what is
 * arriving beside it, and asks before installing. Run it from VS Code with the `daiku: update`
 * task, or by hand with `node .daiku/update.mjs`.
 *
 * **The host is read, never guessed.** `.daiku/environment.json` declares `default_host`; where it
 * does not answer — no file, no key, a JSON that does not parse — the branch is `claude`, the
 * fallback. Two flows follow, and only their mechanics live here: the method carries no version,
 * the project carries its own host.
 *
 * **The Claude Code branch** refreshes the marketplace catalogue, reads the version in place from
 * `claude plugin list`, reads the arriving version out of the refreshed catalogue clone, draws the
 * delta as `1.0.6 >>> 1.0.7`, names the channel the marketplace is on and asks before it leaves
 * edge for main, and asks before running the two update commands in order.
 *
 * **The opencode branch** talks to the plugin channel of that host: `opencode plugin list` for the
 * version in place, `opencode debug paths cache` plus the npm cache layout for the root of the
 * installed package (verified by the `name` in its `package.json` — a root that does not resolve
 * is *not answered*, never guessed), `opencode plugin check` for whether an update is available,
 * and — only after the question is answered yes — `opencode plugin update`. Then it runs the two
 * deterministic programs of `init` from that root — `depth.mjs` (the nesting key) and
 * `scan.mjs … --host opencode` — prints every entry the scan still lists, one per line, and hands
 * the prose that remains to `/daiku:init`.
 *
 * **A terminal is required to ask, and that is why the task is a `shell` task.** A `process` task
 * runs the command without a terminal, `process.stdin.isTTY` is then false, and the question could
 * never be asked. Where there is no terminal anyway — a pipe, an automated runner — this script
 * does not decide in your place: it prints what the host said and the commands to run by hand, and
 * changes nothing. The same is true wherever a host does not answer or the package root cannot be
 * resolved: commands on screen, nothing written, no value guessed.
 *
 * **And it is the only place that says whether the project itself needs anything.** Updating the
 * package realigns nothing inside the project: the copies, the versioned scripts, the seats an
 * older Daiku left behind and the keys the contract no longer names are `/daiku:init`'s to bring
 * up. On Claude Code the marker at the top of this file is the version the project is aligned to —
 * `init` rewrites it every time it realigns — so comparing it with the version that arrived says
 * which of the two cases it is. On opencode the scan read after the update says it outright, entry
 * by entry.
 *
 * It stops at the first command that fails, with the exit code it gave.
 *
 * Written by Daiku's init, which recreates it whole when the package moves past the version in
 * the `daiku:script` line at the top. It is a package artefact standing under `.daiku/`, not a
 * file of the project's own, and that line is what lets an update reach it.
 *
 *   node .daiku/update.mjs --self-check
 *       the bench, on fake hosts and throwaway caches — never a real host: counted JSON
 *       `{checks, passed, failed[]}`, exit 1 on the first red.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** This script's own folder: `.daiku/` in a project, `templates/project/` in the package. */
const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The version this script was written by — the `daiku:script` marker of its own first lines, which
 * `init` fills every time it realigns the project to a package. It is therefore not a fact about
 * this file: it is **the version the project is aligned to**, and the one to compare with what
 * arrives. `null` where the marker was never filled, and then nothing is said about alignment.
 */
const ALIGNED = (() => {
  try {
    const found = readFileSync(fileURLToPath(import.meta.url), 'utf-8').match(/^\/\/ daiku:script\s+(\S+)/m);
    return found ? found[1] : null;
  } catch {
    return null;
  }
})();

/** The technical root the project sits at: two levels above this file — `<script>/../..`, never
 * the cwd. In a project this script stands at `.daiku/update.mjs`, so the answer is the root. */
export const TECHNICAL_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');

/** The two lines of the Claude update, in order: without the first, the second has nothing new to
 * take. The second is read back as JSON, which is how the version that arrived is known for
 * certain. */
const STEPS = ['claude plugin marketplace update daiku', 'claude plugin update daiku@daiku --json'];

/** The same two as somebody types them by hand: the fallback prints these, where a `--json` would
 * answer with a machine line instead of a sentence. */
const BY_HAND = ['claude plugin marketplace update daiku', 'claude plugin update daiku@daiku'];

/** The opencode commands, by hand: the check says whether an update is available, the update pulls
 * it. Printed wherever the branch cannot run — no terminal, no answer, no root. */
const OPENCODE_BY_HAND = ['opencode plugin check', 'opencode plugin update'];

/** The name of the marketplace, and of the plugin inside it, as the host knows them. */
const MARKETPLACE = 'daiku';

/** The plugin id `opencode plugin list` shows for this package — the entrypoint's own id. */
const OPENCODE_ID = 'daiku';

/** Colour, where a terminal carries it and nothing asked for none: the only ink of this script.
 *  The escape is built from its code so this file stays plain ASCII with no control bytes. */
const INK = !!process.stdout.isTTY && !process.env.NO_COLOR;
const ESC = String.fromCharCode(27);
const tint = (code, text) => (INK ? `${ESC}[${code}m${text}${ESC}[0m` : text);
const dim = (text) => tint('2', text);
const bold = (text) => tint('1', text);
const red = (text) => tint('31', text);
const green = (text) => tint('32', text);
const yellow = (text) => tint('33', text);
const cyan = (text) => tint('36', text);

/** A channel as a badge: black on a coloured block, so the channel reads at a glance. */
const badge = (background, text) => tint(`30;${background}`, ` ${text} `);

/* ------------------------------------------------------------------------- *
 * The ports: everything that leaves this script goes through them
 * ------------------------------------------------------------------------- */

/** One line through the shell, its output kept: the only way anything is read back. The bench
 *  replaces this with a fake that records the lines and answers from fixtures — no real host. */
export function capture(line, shell) {
  return (shell || ((command) => spawnSync(command, { shell: true, encoding: 'utf-8' })))(line);
}

/** Where a line through the shell did not succeed: it failed to start, or it exited non-zero. */
export function failed(outcome) {
  return !outcome || !!outcome.error || outcome.status !== 0;
}

/** The object one of those lines answers with, or `null` where it failed, was silent, or lied. */
export function report(line, shell) {
  const answer = capture(line, shell);
  if (failed(answer) || !answer.stdout) return null;
  try {
    return JSON.parse(answer.stdout);
  } catch {
    return null;
  }
}

/** The environment file beside this script, read through the port so the bench can answer it. */
function readEnvironment(read) {
  try {
    return read(join(HERE, 'environment.json'));
  } catch {
    return null;
  }
}

/**
 * The host this project runs on: `default_host` of `.daiku/environment.json`, and `claude`
 * wherever the file does not answer — no file, no key, a JSON that does not parse. The host is
 * named, never inferred from anything else.
 */
export function hostFrom(text) {
  if (typeof text !== 'string' || !text.trim()) return 'claude';
  try {
    const env = JSON.parse(text);
    const named = env && typeof env.default_host === 'string' ? env.default_host.trim() : '';
    return named || 'claude';
  } catch {
    return 'claude';
  }
}

/** Where a step did not go through: the message, the host's own words, the lines to run by hand
 *  where there are any, and the exit code the step gave. Returns the outcome so the flow can
 *  return it — this script never calls `process.exit` inside a flow: the bench drives it. */
function halt(write, message, outcome, hints) {
  write(`${red('x')} ${message}\n`);
  write(`${(outcome && outcome.stdout) || ''}${(outcome && outcome.stderr) || ''}`);
  if (hints.length) write(`Run by hand:\n${hints.map((hint) => `  ${hint}\n`).join('')}`);
  return { code: (outcome && outcome.status) || 1 };
}

/* ------------------------------------------------------------------------- *
 * The Claude Code branch — unchanged in behaviour, reading every line through the port
 * ------------------------------------------------------------------------- */

/**
 * The version in place right now, or `null` where the host does not answer. The listing arrives
 * as a bare array, and as an object carrying `installed` once more is asked of it — both shapes
 * are read here, because the one this script meets is the host's to choose, not ours.
 */
export function installed(shell) {
  const listing = report('claude plugin list --json', shell);
  const plugins = Array.isArray(listing)
    ? listing
    : listing && Array.isArray(listing.installed)
      ? listing.installed
      : [];
  const entry = plugins.find((plugin) => plugin && plugin.id === 'daiku@daiku');
  return entry && typeof entry.version === 'string' && entry.version ? entry.version : null;
}

/** The `daiku` entry of the marketplace listing, or `null` where the host has none. */
export function marketplace(shell) {
  const listing = report('claude plugin marketplace list --json', shell);
  return (Array.isArray(listing) ? listing : []).find((entry) => entry && entry.name === MARKETPLACE) || null;
}

/**
 * The channel the marketplace is registered on, read from the registration itself: `edge` is the
 * git ref of the copy that follows `develop`, `main` is the default branch with no ref, and anything
 * else is a folder or a ref this script does not know — named, and left alone.
 */
export function channelOf(market) {
  if (!market) return { name: 'none' };
  if (market.source === 'git' && market.ref === 'edge') return { name: 'edge', url: market.url || null };
  if (market.source === 'git' && (!market.ref || market.ref === 'main')) {
    return { name: 'main', url: market.url || null };
  }
  return { name: 'other', where: market.path || market.url || market.ref || 'unknown' };
}

/**
 * The version the catalogue is carrying now, or `null` where it cannot be read. The refresh has
 * just left a clone of the published repo in the host's cache: the catalogue inside it says where
 * the package sits, and the manifest there declares the version the host would install. It is read
 * from that clone and not from a file of ours, which would only say what we shipped, not what is out
 * there — and never before the refresh, which is what makes the answer current.
 */
export function arriving(shell, read) {
  const market = marketplace(shell);
  const root = market && typeof market.installLocation === 'string' ? market.installLocation : null;
  if (!root) return null;
  try {
    const catalogue = JSON.parse(read(join(root, '.claude-plugin', 'marketplace.json')));
    const entry = (catalogue.plugins || []).find((plugin) => plugin && plugin.name === MARKETPLACE);
    const source = entry && typeof entry.source === 'string' ? entry.source : null;
    if (!source) return null;
    const manifest = JSON.parse(read(join(root, source, '.claude-plugin', 'plugin.json')));
    return typeof manifest.version === 'string' && manifest.version ? manifest.version : null;
  } catch {
    return null;
  }
}

/** The two versions as one line, on the places that hold them: in place, the arrow, arriving. */
export function delta(before, after) {
  const from = before ? dim(before) : dim('version unknown');
  const to = after ? green(bold(after)) : dim('version unknown');
  return `${from} ${cyan('>>>')} ${to}`;
}

/**
 * What to say about the project once the package has moved, and it is the one thing this script
 * says about the project at all: updating the package realigns nothing inside it. The copies, the
 * versioned scripts, the seats an older Daiku left and the keys the contract no longer names are
 * `/daiku:init`'s to bring up, and a package update that said nothing would leave a project that
 * looks current standing on an older one. `null` where the two versions cannot be compared:
 * silence, never a guess.
 */
export function alignment(after) {
  if (!ALIGNED || !after) return null;
  return ALIGNED === after
    ? `project  ${green('aligned')} at ${bold(after)}`
    : `project  ${yellow('behind')} at ${bold(ALIGNED)} · run ${cyan('/daiku:init')} to bring it up`;
}

/**
 * The channel as the first thing on screen: a badge and what it means. On `edge` it is the
 * disclaimer — a pre-release copy, that moves with each push — because that is the one channel a
 * person can be on without having chosen it knowingly.
 */
export function channelPanel(channel) {
  if (channel.name === 'edge') {
    return [
      `${badge('43', 'EDGE')} ${bold('You are on edge')}`,
      dim('       A pre-release copy of Daiku that follows develop. It is not a published release,'),
      dim('       and it moves with each push of edge.'),
    ];
  }
  if (channel.name === 'main') return [`${badge('42', 'MAIN')} ${bold('You are on main')} ${dim('the published release')}`];
  if (channel.name === 'other') {
    return [`${badge('47', 'LOCAL')} ${bold('You are on a local source')} ${dim(channel.where)}`];
  }
  return [`${badge('41', 'NONE')} ${bold('No marketplace is registered for Daiku')}`];
}

/** The three lines a leave from edge to main runs, as one would type them by hand. */
export const switchSteps = (url) => [
  'claude plugin marketplace remove daiku',
  `claude plugin marketplace add "${url}#main"`,
  'claude plugin install daiku@daiku',
];

/** The catalogue refresh, drawn as one line that turns into a tick — or stops the run, loudly. */
function refresh(shell, write) {
  write(dim('Refreshing the catalogue... '));
  const outcome = capture(STEPS[0], shell);
  write(`${ESC}[2K\r`);
  if (failed(outcome)) {
    return { stopped: halt(write, 'the catalogue did not refresh.', outcome, []) };
  }
  write(`${green('✓')} ${dim('catalogue refreshed')}\n`);
  return { stopped: null };
}

/**
 * The question: the options are drawn once and redrawn on every key, and the answered one stays
 * on screen with the rest erased. Raw mode is what makes a single keystroke arrive without
 * Enter — and it is also what stops the terminal's own line editing, so every way out of here
 * puts it back.
 */
function choose(question, options) {
  return new Promise((resolveAnswer) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    const drawn = options.length + 1;
    const erase = `${ESC}[2K`;
    const up = (n) => `${ESC}[${n}A`;
    const CTRL_C = String.fromCharCode(3);
    let index = 0;
    let painted = false;

    const paint = () => {
      if (painted) stdout.write(up(drawn));
      stdout.write(`${erase}${question}\n`);
      options.forEach((option, position) => {
        stdout.write(`${erase}${position === index ? cyan(`› ${bold(option)}`) : `  ${option}`}\n`);
      });
      painted = true;
    };

    const leave = (answer) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onKey);
      stdout.write(up(drawn));
      stdout.write(`${erase}${question} ${cyan(options[index])}\n`);
      for (let line = 0; line < options.length; line += 1) stdout.write(`${erase}\n`);
      stdout.write(up(options.length));
      resolveAnswer(answer);
    };

    const onKey = (chunk) => {
      const key = String(chunk);
      if (key === CTRL_C) {
        // Ctrl-C: raw mode swallowed the signal, so the terminal is put back and the run ends.
        stdin.setRawMode(false);
        stdout.write('\n');
        process.exit(130);
      } else if (key === `${ESC}[A` || key === `${ESC}OA`) {
        index = (index + options.length - 1) % options.length;
      } else if (key === `${ESC}[B` || key === `${ESC}OB`) {
        index = (index + 1) % options.length;
      } else if (key === '\r' || key === '\n') {
        leave(index);
        return;
      } else {
        return;
      }
      paint();
    };

    stdin.setEncoding('utf8');
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onKey);
    paint();
  });
}

/**
 * Leaves edge for main. The host keeps one marketplace per name, so the registration is removed and
 * added again on the `main` ref — and removing it takes the plugin with it, so the plugin is
 * installed again straight after. Each step is read back through `--json`, and where one does not
 * go through the run stops and says what to run by hand.
 */
function switchToMain(url, { shell, write }) {
  const removed = capture('claude plugin marketplace remove daiku --json', shell);
  if (failed(removed)) return halt(write, 'could not leave edge; nothing changed.', removed, []);
  const added = capture(`claude plugin marketplace add "${url}#main" --json`, shell);
  if (failed(added)) {
    return halt(write, 'could not add main, and Daiku is not installed now.', added, [
      `claude plugin marketplace add "${url}#edge"`,
      'claude plugin install daiku@daiku',
    ]);
  }
  const plugged = capture('claude plugin install daiku@daiku --json', shell);
  if (failed(plugged)) return halt(write, 'main is registered, but Daiku did not install.', plugged, ['claude plugin install daiku@daiku']);
  const now = installed(shell);
  write(`\n${green('✓')} Daiku ${bold(now || 'installed')} is now on ${bold('main')}\n`);
  const aligned = alignment(now);
  if (aligned) write(`\n  ${aligned}\n`);
  write('\nOpen a new Claude Code session to load it.\n');
  return { code: 0 };
}

/** The Claude Code flow, every side effect read through the ports. Returns `{code}`. */
export async function runClaude({ shell, ask = choose, write, isTTY, read } = {}) {
  const out = write || ((text) => process.stdout.write(text));
  const terminal = isTTY === undefined ? !!process.stdin.isTTY : isTTY;
  const before = installed(shell);
  const channel = channelOf(marketplace(shell));
  const title = `${bold('Daiku')} ${dim('update')}`;

  if (!terminal) {
    out(`${title}\n\n${channelPanel(channel).join('\n')}\n\n`);
    out(
      before
        ? `  Daiku ${bold(before)} is in place.\n`
        : '  The host did not say which version is in place: `claude plugin list` gave no answer.\n'
    );
    out(
      '\nNo terminal here, so nothing can be asked and nothing is changed. Run these by hand:\n' +
        BY_HAND.map((step) => `  ${step}\n`).join('')
    );
    if (channel.name === 'edge' && channel.url) {
      out(
        '\nTo leave edge for main, run these by hand instead:\n' +
          switchSteps(channel.url).map((step) => `  ${step}\n`).join('')
      );
    }
    return { code: 0 };
  }

  out(`${title}\n\n`);
  const refreshed = refresh(shell, out);
  if (refreshed.stopped) return refreshed.stopped;
  const after = arriving(shell, read);
  out(`\n${channelPanel(channel).join('\n')}\n\n`);

  const same = !!after && !!before && after === before;
  out(
    same ? `  Daiku ${bold(before)} is already the latest.\n` : `  ${delta(before, after)}\n`
  );
  const aligned = alignment(after);
  if (aligned) out(`\n  ${aligned}\n`);

  if (channel.name === 'edge' && channel.url) {
    out('\n');
    const choice = await ask('? Stay on edge, or switch to main?', ['Stay on edge', 'Switch to main']);
    if (choice === 1) return switchToMain(channel.url, { shell, write: out });
  }
  if (same) return { code: 0 };

  out('\n');
  const answer = await ask(`? Update Daiku now?  ${dim('(up/down, then Enter)')}`, [
    'Update Daiku',
    'Not now',
  ]);
  if (answer !== 0) {
    out('\nNothing changed.\n');
    return { code: 0 };
  }

  const outcome = capture(STEPS[1], shell);
  if (failed(outcome)) return halt(out, 'the update did not go through.', outcome, []);
  let result = null;
  try {
    result = JSON.parse(outcome.stdout);
  } catch {
    result = null;
  }

  const was = result && typeof result.oldVersion === 'string' ? result.oldVersion : null;
  const now = result && typeof result.newVersion === 'string' ? result.newVersion : null;
  if (was && now && was !== now) {
    out(`\n${green('✓')} Daiku updated  ${delta(was, now)}\n`);
  } else if (now) {
    out(`\nDaiku ${bold(now)} is already the latest.\n`);
  } else {
    out(`\n${green('✓')} Daiku updated.\n`);
  }
  const realign = alignment(now || after);
  if (realign) out(`\n${realign}\n`);
  out('\nOpen a new Claude Code session to load it.\n');
  return { code: 0 };
}

/* ------------------------------------------------------------------------- *
 * The opencode branch
 * ------------------------------------------------------------------------- */

/**
 * The `daiku` row of `opencode plugin list`, or `null` where the host gave no readable listing.
 * The output is a table — `ID`, `VERSION`, `SOURCE` — and for a package plugin the SOURCE is the
 * **specifier**, never a path: the root is resolved separately, from the cache, and verified
 * against the `package.json` it finds. No answer at all ("No plugins found", prose, garbage) is
 * `null`: the host did not answer, and nothing is inferred from silence.
 */
export function opencodeRow(outcome) {
  if (failed(outcome) || !outcome || typeof outcome.stdout !== 'string') return null;
  const lines = outcome.stdout.split(/\r?\n/);
  const header = lines.findIndex((line) => /^\s*ID\s+\S/.test(line));
  if (header === -1) return null;
  for (const line of lines.slice(header + 1)) {
    if (!line.trim()) continue;
    const cells = line.trim().split(/\s{2,}/);
    if (cells.length < 2) return null;
    if (cells[0] === OPENCODE_ID) {
      return { id: cells[0], version: cells[1] && cells[1] !== '-' ? cells[1] : null, source: cells[2] || null };
    }
  }
  return null;
}

/** The cache root of the host, read from `opencode debug paths cache` — the host's own answer about
 *  where it keeps things, never a path this script invents. `null` where it does not answer. */
export function opencodeCacheRoot(shell) {
  const outcome = capture('opencode debug paths cache', shell);
  if (failed(outcome) || !outcome || !outcome.stdout) return null;
  const line = outcome.stdout.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean)[0] || '';
  return line || null;
}

/**
 * The root of the installed package: `<cache>/npm/<key>/…/node_modules/<folder>` wherever the
 * `package.json` found there carries `name: "daiku"` — one level (`<key>/`) or a generation
 * deeper (`<key>/<number>/`), whichever the install used. Every candidate is verified by that
 * `name`: a folder that does not name this package is not this package, however it was reached.
 * Multiple distinct keys are several installs this script cannot tell apart — it returns `null`
 * rather than picking, and the run prints commands instead of guessing a root.
 */
export function resolvePackageRoot(cacheRoot, fs = { readFileSync, readdirSync }) {
  if (!cacheRoot) return null;
  const npm = join(cacheRoot, 'npm');
  let keys = [];
  try {
    keys = fs.readdirSync(npm, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name);
  } catch {
    return null;
  }
  const bestByKey = new Map();
  for (const key of keys) {
    const bases = [{ path: join(npm, key), gen: 0 }];
    try {
      for (const name of fs.readdirSync(join(npm, key))) {
        if (/^\d+$/.test(name)) bases.push({ path: join(npm, key, name), gen: Number(name) });
      }
    } catch {
      /* the key directory does not answer: its candidates simply are not there */
    }
    for (const base of bases) {
      const shelf = join(base.path, 'node_modules');
      let folders = [];
      try {
        folders = fs.readdirSync(shelf, { withFileTypes: true })
          .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
          .map((entry) => entry.name);
      } catch {
        continue;
      }
      for (const folder of folders) {
        const root = join(shelf, folder);
        let manifest = null;
        try {
          manifest = JSON.parse(fs.readFileSync(join(root, 'package.json'), 'utf-8'));
        } catch {
          continue;
        }
        if (!manifest || manifest.name !== OPENCODE_ID) continue;
        const seen = bestByKey.get(key);
        if (!seen || base.gen > seen.gen) bestByKey.set(key, { root, gen: base.gen });
      }
    }
  }
  if (bestByKey.size !== 1) return null;
  return [...bestByKey.values()][0].root;
}

/**
 * The `daiku` status line of `opencode plugin check` — `current`, `update available` or `check
 * failed` — or `null` where the host gave no readable answer. The check says **whether** an update
 * is available, never the version arriving: that number this host does not print, and nothing here
 * invents it.
 */
export function opencodeStatus(outcome) {
  if (failed(outcome) || !outcome || typeof outcome.stdout !== 'string') return null;
  const match = new RegExp(`^\\s+${OPENCODE_ID}\\s+(\\S+)\\s+\\((current|update available|check failed)\\)`, 'm').exec(
    outcome.stdout
  );
  return match ? { version: match[1], status: match[2] } : null;
}

/** Every entry the scan still lists, from its three lists: one line each, the step in brackets. */
function scanEntries(scan) {
  const rows = [];
  for (const list of [
    scan && Array.isArray(scan.missing) ? scan.missing : [],
    scan && Array.isArray(scan.legacy) ? scan.legacy : [],
    scan && Array.isArray(scan.params) ? scan.params : [],
  ]) {
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue;
      rows.push(`  ${entry.id || '?'} [step ${entry.step || '?'}]${entry.detail ? ` — ${entry.detail}` : ''}`);
    }
  }
  return { rows, fresh: !!(scan && scan.fresh) };
}

/** The opencode flow, every side effect read through the ports. Returns `{code}`. */
export async function runOpencode({ shell, ask = choose, write, isTTY, read } = {}) {
  const out = write || ((text) => process.stdout.write(text));
  const terminal = isTTY === undefined ? !!process.stdin.isTTY : isTTY;
  const title = `${bold('Daiku')} ${dim('update')}`;
  const manual = (intro) => {
    out(`${intro}\n`);
    out('\nRun these by hand:\n' + OPENCODE_BY_HAND.map((step) => `  ${step}\n`).join(''));
    return { code: 0 };
  };

  const row = opencodeRow(capture('opencode plugin list', shell));

  if (!terminal) {
    out(`${title}\n\n`);
    out(
      row && row.version
        ? `  Daiku ${bold(row.version)} is in place.\n`
        : '  The host did not say which version is in place: `opencode plugin list` gave no answer.\n'
    );
    out(
      '\nNo terminal here, so nothing can be asked and nothing is changed. Run these by hand:\n' +
        OPENCODE_BY_HAND.map((step) => `  ${step}\n`).join('')
    );
    return { code: 0 };
  }

  out(`${title}\n\n`);
  if (!row) {
    return manual(`${red('x')} The host did not answer: \`opencode plugin list\` gave no readable listing.`);
  }

  const cacheRoot = opencodeCacheRoot(shell);
  const pkgRoot = resolvePackageRoot(cacheRoot);
  if (!pkgRoot) {
    return manual(`${red('x')} The package root could not be resolved from the host's cache: nothing is guessed.`);
  }

  const status = opencodeStatus(capture('opencode plugin check', shell));
  if (!status) {
    return manual(`${red('x')} The host did not answer: \`opencode plugin check\` gave no readable listing.`);
  }
  if (status.status === 'check failed') {
    return manual(`${red('x')} The host could not check for updates.`);
  }

  if (status.status === 'current') {
    out(`  Daiku ${bold(row.version || status.version)} is already the latest.\n`);
    return { code: 0 };
  }
  out(`  ${delta(row.version, 'update available')}\n`);

  out('\n');
  const answer = await ask(`? Update Daiku now?  ${dim('(up/down, then Enter)')}`, [
    'Update Daiku',
    'Not now',
  ]);
  if (answer !== 0) {
    out('\nNothing changed.\n');
    return { code: 0 };
  }

  const outcome = capture('opencode plugin update', shell);
  if (failed(outcome)) return halt(out, 'the update did not go through.', outcome, OPENCODE_BY_HAND.slice(1));
  out(`\n${green('✓')} ${((outcome.stdout || '').trim().split(/\r?\n/)[0]) || 'Daiku updated'}\n`);

  // The two deterministic programs of `init`, from the root the cache answered — re-resolved
  // after the update, because an update moves the generation the package stands in.
  const freshRoot = resolvePackageRoot(cacheRoot) || pkgRoot;
  const depthLine = `node "${join(freshRoot, 'daiku', 'skills', 'init', 'depth.mjs')}" "${TECHNICAL_ROOT}"`;
  const depth = capture(depthLine, shell);
  if (failed(depth)) return halt(out, 'the nesting step did not go through.', depth, [depthLine]);
  const scanLine = `node "${join(freshRoot, 'daiku', 'skills', 'init', 'scan.mjs')}" "${TECHNICAL_ROOT}" --host opencode`;
  const scanRun = capture(scanLine, shell);
  if (failed(scanRun)) return halt(out, 'the scan did not go through.', scanRun, [scanLine]);

  let scan = null;
  try {
    scan = JSON.parse(scanRun.stdout);
  } catch {
    scan = null;
  }
  if (!scan) return halt(out, 'the scan gave no answer.', scanRun, [scanLine]);

  const { rows, fresh } = scanEntries(scan);
  if (fresh) {
    out('\n  The project was never opened: no `.daiku/project.json` here.\n');
    out(`  Run ${cyan('/daiku:init')} to open it.\n`);
    return { code: 0 };
  }
  if (!rows.length) {
    out(`\n  project  ${green('aligned')} — nothing left for init to bring up.\n`);
    return { code: 0 };
  }
  out(`\n${rows.join('\n')}\n`);
  out(`\n  Run ${cyan('/daiku:init')} to finish what a program cannot: the instructions file, the seats, the keys.\n`);
  return { code: 0 };
}

/* ------------------------------------------------------------------------- *
 * The dispatch: the host is read, the branch follows it
 * ------------------------------------------------------------------------- */

export async function run(options = {}) {
  const read = options.read || ((path) => readFileSync(path, 'utf-8'));
  const host = options.host || hostFrom(readEnvironment(read));
  if (host === 'opencode') return runOpencode({ ...options, read });
  return runClaude({ ...options, read });
}

/* ------------------------------------------------------------------------- *
 * The bench — fake hosts, throwaway caches, never a real host
 * ------------------------------------------------------------------------- */

async function selfCheck() {
  const failedCases = [];
  let ran = 0;
  const check = (name, condition, why) => {
    ran += 1;
    if (!condition) failedCases.push(why ? `${name}: ${why}` : name);
  };
  const put = (path, text) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, 'utf-8');
  };

  /** A shell that records every line and answers from a fixture table, never a real host. */
  const fakeShell = (answers, matchers) => {
    const lines = [];
    const shell = (line) => {
      lines.push(line);
      for (const [pattern, answer] of matchers || []) {
        if (pattern.test(line)) return typeof answer === 'function' ? answer(line) : answer;
      }
      return (answers && answers[line]) || { status: 1, stdout: '', stderr: `no fixture for: ${line}\n` };
    };
    return { lines, shell };
  };

  const temp = mkdtempSync(join(tmpdir(), 'daiku-update-'));
  try {
    // --- the host is read, never guessed ---------------------------------------------
    check('default_host opencode wins', hostFrom('{"default_host":"opencode"}') === 'opencode');
    check('default_host claude wins', hostFrom('{"default_host":"claude"}') === 'claude');
    check('no file: the fallback is claude', hostFrom(null) === 'claude');
    check('no key: the fallback is claude', hostFrom('{"contract":1}') === 'claude');
    check('a JSON that does not parse: the fallback is claude', hostFrom('{ oops') === 'claude');

    // --- case 1: default_host claude, the flow of before, word for word ----------------
    const marketDir = join(temp, 'market');
    put(join(marketDir, '.claude-plugin', 'marketplace.json'), JSON.stringify({ plugins: [{ name: 'daiku', source: 'daiku' }] }));
    put(join(marketDir, 'daiku', '.claude-plugin', 'plugin.json'), JSON.stringify({ version: '1.0.7' }));
    const claudeOut = [];
    const claude = fakeShell({
      'claude plugin list --json': { status: 0, stdout: JSON.stringify([{ id: 'daiku@daiku', version: '1.0.6' }]) },
      'claude plugin marketplace list --json': {
        status: 0,
        stdout: JSON.stringify([{ name: 'daiku', source: 'git', ref: 'main', url: 'https://github.com/x/y.git', installLocation: marketDir }]),
      },
      'claude plugin marketplace update daiku': { status: 0, stdout: 'ok\n' },
      'claude plugin update daiku@daiku --json': { status: 0, stdout: '{"oldVersion":"1.0.6","newVersion":"1.0.7"}' },
    });
    const asked = [];
    const claudeRun = await runClaude({
      shell: claude.shell,
      ask: async (question) => {
        asked.push(question);
        return 0;
      },
      write: (text) => claudeOut.push(text),
      isTTY: true,
      read: (path) => readFileSync(path, 'utf-8'),
    });
    const claudeText = claudeOut.join('');
    const refreshAt = claude.lines.indexOf('claude plugin marketplace update daiku');
    const updateAt = claude.lines.indexOf('claude plugin update daiku@daiku --json');
    check('the claude flow ends clean', claudeRun.code === 0, JSON.stringify(claudeRun));
    check('claude refreshes the catalogue, then updates the plugin, in order', refreshAt !== -1 && updateAt > refreshAt, claude.lines.join(' | '));
    check('claude draws the delta as before: in place, the arrow, arriving', claudeText.includes('1.0.6') && claudeText.includes('>>>') && claudeText.includes('1.0.7'), claudeText);
    check('claude asks the question of the script', asked.some((q) => q.includes('Update Daiku now?')), JSON.stringify(asked));
    check('claude never touches an opencode command', claude.lines.every((line) => !line.startsWith('opencode')), claude.lines.join(' | '));

    // --- case 2: default_host opencode, root from the cache, scan from that root -------
    const cache = join(temp, 'cache');
    const key = 'git-daiku-000000000000';
    put(join(cache, 'npm', key, '1', 'node_modules', 'daiku', 'package.json'), JSON.stringify({ name: 'daiku', version: '1.0.0-old' }));
    put(join(cache, 'npm', key, '2', 'node_modules', 'daiku', 'package.json'), JSON.stringify({ name: 'daiku', version: '1.0.9' }));
    const rootExpected = join(cache, 'npm', key, '2', 'node_modules', 'daiku');
    check('the root resolves under the highest generation', resolvePackageRoot(cache) === rootExpected, resolvePackageRoot(cache));

    const listAnswer = {
      status: 0,
      stdout: ['ID          VERSION           SOURCE', 'daiku       1.0.9+abc1234     github:owner/daiku', ''].join('\n'),
    };
    const scanPayload = JSON.stringify({
      fresh: false,
      missing: [{ id: 'instructions', step: '6', detail: 'AGENTS.md' }],
      legacy: [],
      params: [],
    });
    const openOut = [];
    const open = fakeShell(null, [
      [/^opencode plugin list$/, listAnswer],
      [/^opencode debug paths cache$/, { status: 0, stdout: `${cache}\n` }],
      [/^opencode plugin check$/, { status: 0, stdout: 'Server\n  daiku 1.0.9 (update available)\n' }],
      [/^opencode plugin update$/, { status: 0, stdout: 'Updated Server plugin "daiku"\n' }],
      [/depth\.mjs/, { status: 0, stdout: JSON.stringify({ ok: true, action: 'added', detail: '' }) }],
      [/scan\.mjs/, { status: 0, stdout: scanPayload }],
    ]);
    let openAsked = 0;
    const openRun = await runOpencode({
      shell: open.shell,
      ask: async () => {
        openAsked += 1;
        return 0;
      },
      write: (text) => openOut.push(text),
      isTTY: true,
      read: (path) => readFileSync(path, 'utf-8'),
    });
    const openText = openOut.join('');
    const depthLine = open.lines.find((line) => line.includes('depth.mjs')) || '';
    const scanLine = open.lines.find((line) => line.includes('scan.mjs')) || '';
    check('the opencode flow ends clean', openRun.code === 0, JSON.stringify(openRun));
    check('the delta says the version in place against the update being available', openText.includes('1.0.9+abc1234') && openText.includes('>>>') && openText.includes('update available'), openText);
    check('the flow asked the question once', openAsked === 1, String(openAsked));
    check('the update ran after the check', open.lines.indexOf('opencode plugin update') > open.lines.indexOf('opencode plugin check'), open.lines.join(' | '));
    check('depth.mjs runs from the resolved root', depthLine === `node "${join(rootExpected, 'daiku', 'skills', 'init', 'depth.mjs')}" "${TECHNICAL_ROOT}"`, depthLine);
    check('scan.mjs runs from the resolved root with the host', scanLine === `node "${join(rootExpected, 'daiku', 'skills', 'init', 'scan.mjs')}" "${TECHNICAL_ROOT}" --host opencode`, scanLine);
    check('the scan entry is printed on its own line', openText.includes('instructions [step 6] — AGENTS.md'), openText);
    check('and the prose that remains goes to /daiku:init', openText.includes('/daiku:init'), openText);

    // --- case 4: an empty residual says the project is aligned, with no useless referral -
    const alignedOut = [];
    const aligned = fakeShell(null, [
      [/^opencode plugin list$/, listAnswer],
      [/^opencode debug paths cache$/, { status: 0, stdout: `${cache}\n` }],
      [/^opencode plugin check$/, { status: 0, stdout: 'Server\n  daiku 1.0.9 (update available)\n' }],
      [/^opencode plugin update$/, { status: 0, stdout: 'Updated Server plugin "daiku"\n' }],
      [/depth\.mjs/, { status: 0, stdout: '{"ok":true,"action":"kept","detail":""}' }],
      [/scan\.mjs/, { status: 0, stdout: JSON.stringify({ fresh: false, missing: [], legacy: [], params: [] }) }],
    ]);
    await runOpencode({ shell: aligned.shell, ask: async () => 0, write: (text) => alignedOut.push(text), isTTY: true });
    const alignedText = alignedOut.join('');
    check('an empty residual says the project is aligned', alignedText.includes('aligned'), alignedText);
    check('and carries no /daiku:init referral', !alignedText.includes('/daiku:init'), alignedText);

    // --- case 5: an update that fails stops the run at its exit code --------------------
    const failedOut = [];
    const failing = fakeShell(null, [
      [/^opencode plugin list$/, listAnswer],
      [/^opencode debug paths cache$/, { status: 0, stdout: `${cache}\n` }],
      [/^opencode plugin check$/, { status: 0, stdout: 'Server\n  daiku 1.0.9 (update available)\n' }],
      [/^opencode plugin update$/, { status: 7, stdout: '', stderr: 'update exploded\n' }],
    ]);
    const failedRun = await runOpencode({ shell: failing.shell, ask: async () => 0, write: (text) => failedOut.push(text), isTTY: true });
    check('a failed update stops with its exit code', failedRun.code === 7, JSON.stringify(failedRun));
    check('and no step runs after it', !failing.lines.some((line) => line.includes('depth.mjs') || line.includes('scan.mjs')), failing.lines.join(' | '));

    // --- case 6: an unreadable listing is an unanswered host ---------------------------
    const noListOut = [];
    const noList = fakeShell(null, [
      [/^opencode plugin list$/, { status: 0, stdout: 'No plugins found\n' }],
      [/^opencode debug paths cache$/, { status: 0, stdout: `${cache}\n` }],
    ]);
    let askedOnNoList = 0;
    const noListRun = await runOpencode({
      shell: noList.shell,
      ask: async () => {
        askedOnNoList += 1;
        return 0;
      },
      write: (text) => noListOut.push(text),
      isTTY: true,
    });
    const noListText = noListOut.join('');
    check('an unreadable listing says the host did not answer', noListRun.code === 0 && noListText.includes('did not answer'), noListText);
    check('it prints the commands by hand', noListText.includes('opencode plugin check') && noListText.includes('opencode plugin update'));
    check('it never updates, never asks, never runs a program', noList.lines.every((line) => !line.startsWith('opencode plugin update') && !line.includes('depth.mjs')) && askedOnNoList === 0, noList.lines.join(' | '));

    // --- case 7: no terminal prints and never asks -------------------------------------
    const quietOut = [];
    const quiet = fakeShell(null, [[/^opencode plugin list$/, listAnswer]]);
    let askedQuiet = 0;
    const quietRun = await runOpencode({
      shell: quiet.shell,
      ask: async () => {
        askedQuiet += 1;
        return 0;
      },
      write: (text) => quietOut.push(text),
      isTTY: false,
    });
    const quietText = quietOut.join('');
    check('without a terminal the run ends clean and asks nothing', quietRun.code === 0 && askedQuiet === 0);
    check('it prints what the host said in place', quietText.includes('1.0.9+abc1234'), quietText);
    check('and the commands, changing nothing', quietText.includes('No terminal here') && quietText.includes('opencode plugin update') && quiet.lines.every((line) => !line.startsWith('opencode plugin update')), quiet.lines.join(' | '));

    // --- the dispatch follows the declared host ----------------------------------------
    const dispatchOut = [];
    const dispatch = fakeShell(null, [[/^opencode plugin list$/, listAnswer]]);
    await run({ host: 'opencode', shell: dispatch.shell, ask: async () => 0, write: (text) => dispatchOut.push(text), isTTY: false });
    check('the dispatch takes the opencode branch where the project declares it', dispatchOut.join('').includes('No terminal here') && dispatch.lines.every((line) => line.startsWith('opencode')), dispatch.lines.join(' | '));

    // --- an ambiguous cache is not a root: no guessing ---------------------------------
    const twoKeys = join(temp, 'cache-two');
    put(join(twoKeys, 'npm', 'git-one-111111111111', 'node_modules', 'daiku', 'package.json'), JSON.stringify({ name: 'daiku' }));
    put(join(twoKeys, 'npm', 'git-two-222222222222', 'node_modules', 'daiku', 'package.json'), JSON.stringify({ name: 'daiku' }));
    check('two installs side by side resolve to no root', resolvePackageRoot(twoKeys) === null, resolvePackageRoot(twoKeys));
    const wrongName = join(temp, 'cache-wrong');
    put(join(wrongName, 'npm', 'key', 'node_modules', 'other', 'package.json'), JSON.stringify({ name: 'other' }));
    check('a package that does not name daiku is not the root', resolvePackageRoot(wrongName) === null);

    // --- and the two parsers take the host's tables as they are ------------------------
    check('the row comes off the table', (opencodeRow({ status: 0, stdout: 'ID  VERSION  SOURCE\ndaiku  1.2.3  github:o/r\n' }) || {}).version === '1.2.3');
    check('prose is no listing', opencodeRow({ status: 0, stdout: 'No plugins found\n' }) === null);
    check('the status line is read', (opencodeStatus({ status: 0, stdout: 'Server\n  daiku 1.2.3 (current)\n' }) || {}).status === 'current');
    check('a failed check is no status', opencodeStatus({ status: 1, stdout: '' }) === null);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }

  process.stdout.write(JSON.stringify({ checks: ran, passed: ran - failedCases.length, failed: failedCases }, null, 2) + '\n');
  return failedCases.length ? 1 : 0;
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
  if (argv[0] === '--self-check') {
    selfCheck().then((code) => process.exit(code));
  } else {
    run()
      .then((result) => process.exit(result.code || 0))
      .catch((error) => {
        process.stderr.write(`${error && error.message ? error.message : error}\n`);
        process.exit(1);
      });
  }
}
