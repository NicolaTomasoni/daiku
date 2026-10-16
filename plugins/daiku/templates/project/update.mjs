#!/usr/bin/env node
// daiku:script <version> — the Daiku version that wrote this file. `init` fills the version in
// when it copies the skeleton, and recreates the file whole whenever the package moves past it.
/**
 * Updates Daiku on Claude Code: it reads the version in place, refreshes the marketplace catalogue,
 * draws the version that is arriving beside it, and asks before installing it. Run it from VS Code
 * with the `daiku: update` task, or by hand with `node .daiku/update.mjs`.
 *
 * **It says which channel the machine is on, and asks before it leaves edge.** The marketplace is
 * registered on the machine, not in the project, and it comes from one of two places: `main`, the
 * published release, or `edge`, the copy that follows `develop`. On `edge` the run opens with a
 * panel saying so, and asks whether to stay or to switch to `main`. Switching removes the
 * registration and adds it back on the `main` ref, because the host keeps one marketplace per name;
 * the plugin is installed again straight after.
 *
 * **It asks before the package changes, and the question carries both versions.** Refreshing the
 * catalogue is what tells the script which version the published repo is carrying: it rewrites a
 * clone of that repository, never the package this project runs on. So it comes first, under one
 * line that is replaced when it lands, and from there the delta is drawn as `1.0.6 >>> 1.0.7`.
 * Where the host does not answer, the version is unknown — said, not guessed — and the run asks
 * anyway, rather than deciding in your place.
 *
 * **A terminal is required, and that is why the task is a `shell` task.** A `process` task runs
 * the command without a terminal, `process.stdin.isTTY` is then false, and the question could
 * never be asked. Where there is no terminal anyway — a pipe, an automated runner — this script
 * does not decide in your place: it prints the channel, the version and the commands, and stops.
 *
 * Both commands are read back through `--json`, so the host's own prose stays off the screen and
 * a failure is shown in full instead of swallowed.
 *
 * **And it is the only place that says whether the project itself needs anything.** Updating the
 * package realigns nothing inside the project: the copies, the versioned scripts, the seats an
 * older Daiku left behind and the keys the contract no longer names are `/daiku:init`'s to bring
 * up. The marker at the top of this file is the version the project is aligned to — `init`
 * rewrites it every time it realigns — so comparing it with the version that arrived is what tells
 * the two cases apart, and the run closes saying which of them it is.
 *
 * It stops at the first command that fails, with the exit code it gave.
 *
 * Written by Daiku's init, which recreates it whole when the package moves past the version in
 * the `daiku:script` line at the top. It is a package artefact standing under `.daiku/`, not a
 * file of the project's own, and that line is what lets an update reach it.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

/** The two lines of the update, in order: without the first, the second has nothing new to take.
 * The second is read back as JSON, which is how the version that arrived is known for certain. */
const STEPS = ['claude plugin marketplace update daiku', 'claude plugin update daiku@daiku --json'];

/** The same two as somebody types them by hand: the fallback prints these, where a `--json` would
 * answer with a machine line instead of a sentence. */
const BY_HAND = ['claude plugin marketplace update daiku', 'claude plugin update daiku@daiku'];

/** The name of the marketplace, and of the plugin inside it, as the host knows them. */
const MARKETPLACE = 'daiku';

/** Colour, where a terminal carries it and nothing asked for none: the only ink of this script. */
const INK = !!process.stdout.isTTY && !process.env.NO_COLOR;
const tint = (code, text) => (INK ? `\u001b[${code}m${text}\u001b[0m` : text);
const dim = (text) => tint('2', text);
const bold = (text) => tint('1', text);
const red = (text) => tint('31', text);
const green = (text) => tint('32', text);
const yellow = (text) => tint('33', text);
const cyan = (text) => tint('36', text);

/** A channel as a badge: black on a coloured block, so the channel reads at a glance. */
const badge = (background, text) => tint(`30;${background}`, ` ${text} `);

/** One line through the shell, its output kept: the only way anything is read back. */
function capture(line) {
  return spawnSync(line, { shell: true, encoding: 'utf-8' });
}

/** Where a line through the shell did not succeed: it failed to start, or it exited non-zero. */
function failed(outcome) {
  return !!outcome.error || outcome.status !== 0;
}

/** The object one of those lines answers with, or `null` where it failed, was silent, or lied. */
function report(line) {
  const answer = capture(line);
  if (answer.error || answer.status !== 0 || !answer.stdout) return null;
  try {
    return JSON.parse(answer.stdout);
  } catch {
    return null;
  }
}

/**
 * The version in place right now, or `null` where the host does not answer. The listing arrives
 * as a bare array, and as an object carrying `installed` once more is asked of it — both shapes
 * are read here, because the one this script meets is the host's to choose, not ours.
 */
function installed() {
  const listing = report('claude plugin list --json');
  const plugins = Array.isArray(listing)
    ? listing
    : listing && Array.isArray(listing.installed)
      ? listing.installed
      : [];
  const entry = plugins.find((plugin) => plugin && plugin.id === 'daiku@daiku');
  return entry && typeof entry.version === 'string' && entry.version ? entry.version : null;
}

/** The `daiku` entry of the marketplace listing, or `null` where the host has none. */
function marketplace() {
  const listing = report('claude plugin marketplace list --json');
  return (Array.isArray(listing) ? listing : []).find((entry) => entry && entry.name === MARKETPLACE) || null;
}

/**
 * The channel the marketplace is registered on, read from the registration itself: `edge` is the
 * git ref of the copy that follows `develop`, `main` is the default branch — an absent ref or the
 * branch named — recorded either as a URL (`source: "git"`) or as the `owner/repo` shorthand the
 * host stores as `source: "github"` with no `url`, and anything else is a folder or a ref this
 * script does not know — named, and left alone.
 */
function channelOf(market) {
  if (!market) return { name: 'none' };
  const remote = market.source === 'git' || market.source === 'github';
  const url =
    market.url || (market.source === 'github' && market.repo ? `https://github.com/${market.repo}` : null);
  if (remote && market.ref === 'edge') return { name: 'edge', url };
  if (remote && (!market.ref || market.ref === 'main')) return { name: 'main', url };
  return { name: 'other', where: market.path || market.url || market.repo || market.ref || 'unknown' };
}

/**
 * The version the catalogue is carrying now, or `null` where it cannot be read. The refresh has
 * just left a clone of the published repo in the host's cache: the catalogue inside it says where
 * the package sits, and the manifest there declares the version the host would install. It is read
 * from that clone and not from a file of ours, which would only say what we shipped, not what is out
 * there — and never before the refresh, which is what makes the answer current.
 */
function arriving() {
  const market = marketplace();
  const root = market && typeof market.installLocation === 'string' ? market.installLocation : null;
  if (!root) return null;
  try {
    const catalogue = JSON.parse(
      readFileSync(join(root, '.claude-plugin', 'marketplace.json'), 'utf-8')
    );
    const entry = (catalogue.plugins || []).find((plugin) => plugin && plugin.name === MARKETPLACE);
    const source = entry && typeof entry.source === 'string' ? entry.source : null;
    if (!source) return null;
    const manifest = JSON.parse(
      readFileSync(join(root, source, '.claude-plugin', 'plugin.json'), 'utf-8')
    );
    return typeof manifest.version === 'string' && manifest.version ? manifest.version : null;
  } catch {
    return null;
  }
}

/** The two versions as one line, on the places that hold them: in place, the arrow, arriving. */
function delta(before, after) {
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
function alignment(after) {
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
function channelPanel(channel) {
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
const switchSteps = (url) => [
  'claude plugin marketplace remove daiku',
  `claude plugin marketplace add "${url}#main"`,
  'claude plugin install daiku@daiku',
];

/**
 * A step that did not go through: the message, the host's own words, the lines to run by hand where
 * there are any, and the exit code the step gave.
 */
function stop(message, outcome, hints) {
  process.stdout.write(`${red('x')} ${message}\n`);
  process.stdout.write(`${outcome.stdout || ''}${outcome.stderr || ''}`);
  if (hints.length) process.stdout.write(`Run by hand:\n${hints.map((hint) => `  ${hint}\n`).join('')}`);
  process.exit(outcome.status || 1);
}

/** The catalogue refresh, drawn as one line that turns into a tick — or stops the run, loudly. */
function refresh() {
  process.stdout.write(dim('Refreshing the catalogue... '));
  const outcome = capture(STEPS[0]);
  process.stdout.write('\u001b[2K\r');
  if (failed(outcome)) {
    stop('the catalogue did not refresh.', outcome, []);
    return;
  }
  process.stdout.write(`${green('✓')} ${dim('catalogue refreshed')}\n`);
}

/**
 * The question: the options are drawn once and redrawn on every key, and the answered one stays
 * on screen with the rest erased. Raw mode is what makes a single keystroke arrive without
 * Enter — and it is also what stops the terminal's own line editing, so every way out of here
 * puts it back.
 */
function choose(question, options) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    const drawn = options.length + 1;
    const erase = '\u001b[2K';
    let index = 0;
    let painted = false;

    const paint = () => {
      if (painted) stdout.write(`\u001b[${drawn}A`);
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
      stdout.write(`\u001b[${drawn}A`);
      stdout.write(`${erase}${question} ${cyan(options[index])}\n`);
      for (let line = 0; line < options.length; line += 1) stdout.write(`${erase}\n`);
      stdout.write(`\u001b[${options.length}A`);
      resolve(answer);
    };

    const onKey = (chunk) => {
      const key = String(chunk);
      if (key === '\u0003') {
        // Ctrl-C: raw mode swallowed the signal, so the terminal is put back and the run ends.
        stdin.setRawMode(false);
        stdout.write('\n');
        process.exit(130);
      } else if (key === '\u001b[A' || key === '\u001bOA') {
        index = (index + options.length - 1) % options.length;
      } else if (key === '\u001b[B' || key === '\u001bOB') {
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
function switchToMain(url) {
  const removed = capture('claude plugin marketplace remove daiku --json');
  if (failed(removed)) {
    stop('could not leave edge; nothing changed.', removed, []);
    return;
  }
  const added = capture(`claude plugin marketplace add "${url}#main" --json`);
  if (failed(added)) {
    stop('could not add main, and Daiku is not installed now.', added, [
      `claude plugin marketplace add "${url}#edge"`,
      'claude plugin install daiku@daiku',
    ]);
    return;
  }
  const plugged = capture('claude plugin install daiku@daiku --json');
  if (failed(plugged)) {
    stop('main is registered, but Daiku did not install.', plugged, ['claude plugin install daiku@daiku']);
    return;
  }
  const now = installed();
  process.stdout.write(`\n${green('✓')} Daiku ${bold(now || 'installed')} is now on ${bold('main')}\n`);
  const aligned = alignment(now);
  if (aligned) process.stdout.write(`\n  ${aligned}\n`);
  process.stdout.write('\nOpen a new Claude Code session to load it.\n');
}

async function main() {
  const before = installed();
  const channel = channelOf(marketplace());
  const title = `${bold('Daiku')} ${dim('update')}`;

  if (!process.stdin.isTTY) {
    process.stdout.write(`${title}\n\n${channelPanel(channel).join('\n')}\n\n`);
    process.stdout.write(
      before
        ? `  Daiku ${bold(before)} is in place.\n`
        : '  The host did not say which version is in place: `claude plugin list` gave no answer.\n'
    );
    process.stdout.write(
      '\nNo terminal here, so nothing can be asked and nothing is changed. Run these by hand:\n' +
        BY_HAND.map((step) => `  ${step}\n`).join('')
    );
    if (channel.name === 'edge' && channel.url) {
      process.stdout.write(
        '\nTo leave edge for main, run these by hand instead:\n' +
          switchSteps(channel.url).map((step) => `  ${step}\n`).join('')
      );
    }
    return;
  }

  process.stdout.write(`${title}\n\n`);
  refresh();
  const after = arriving();
  process.stdout.write(`\n${channelPanel(channel).join('\n')}\n\n`);

  const same = !!after && !!before && after === before;
  process.stdout.write(
    same ? `  Daiku ${bold(before)} is already the latest.\n` : `  ${delta(before, after)}\n`
  );
  const aligned = alignment(after);
  if (aligned) process.stdout.write(`\n  ${aligned}\n`);

  if (channel.name === 'edge' && channel.url) {
    process.stdout.write('\n');
    const choice = await choose('? Stay on edge, or switch to main?', ['Stay on edge', 'Switch to main']);
    if (choice === 1) {
      switchToMain(channel.url);
      return;
    }
  }
  if (same) return;

  process.stdout.write('\n');
  const answer = await choose(`? Update Daiku now?  ${dim('(up/down, then Enter)')}`, [
    'Update Daiku',
    'Not now',
  ]);
  if (answer !== 0) {
    process.stdout.write('\nNothing changed.\n');
    return;
  }

  const outcome = capture(STEPS[1]);
  if (failed(outcome)) {
    stop('the update did not go through.', outcome, []);
    return;
  }
  let result = null;
  try {
    result = JSON.parse(outcome.stdout);
  } catch {
    result = null;
  }

  const was = result && typeof result.oldVersion === 'string' ? result.oldVersion : null;
  const now = result && typeof result.newVersion === 'string' ? result.newVersion : null;
  if (was && now && was !== now) {
    process.stdout.write(`\n${green('✓')} Daiku updated  ${delta(was, now)}\n`);
  } else if (now) {
    process.stdout.write(`\nDaiku ${bold(now)} is already the latest.\n`);
  } else {
    process.stdout.write(`\n${green('✓')} Daiku updated.\n`);
  }
  const realign = alignment(now || after);
  if (realign) process.stdout.write(`\n${realign}\n`);
  process.stdout.write('\nOpen a new Claude Code session to load it.\n');
}

main().catch((error) => {
  process.stderr.write(`${error && error.message ? error.message : error}\n`);
  process.exit(1);
});
