#!/usr/bin/env node
// daiku:script <version> — the Daiku version that wrote this file. `init` fills the version in
// when it copies the skeleton, and recreates the file whole whenever the package moves past it.
/**
 * Updates Daiku on Claude Code: it reads the version in place, refreshes the marketplace catalogue,
 * draws the version that is arriving beside it, and asks before installing it. Run it from VS Code
 * with the `daiku: update` task, or by hand with `node .daiku/update.mjs`.
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
 * does not decide in your place: it prints the version and the two commands, and stops.
 *
 * Both commands are read back through `--json`, so the host's own prose stays off the screen and
 * a failure is shown in full instead of swallowed.
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
const cyan = (text) => tint('36', text);

/** One line through the shell, its output kept: the only way anything is read back. */
function capture(line) {
  return spawnSync(line, { shell: true, encoding: 'utf-8' });
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

/**
 * The version the catalogue is carrying now, or `null` where it cannot be read. The refresh has
 * just left a clone of the published repo in the host's cache: the catalogue inside it says where
 * the package sits, and the manifest there declares the version the host would install. It is read
 * from that clone and not from a file of ours, which would only say what we shipped, not what is out
 * there — and never before the refresh, which is what makes the answer current.
 */
function arriving() {
  const listing = report('claude plugin marketplace list --json');
  const market = (Array.isArray(listing) ? listing : []).find(
    (entry) => entry && entry.name === MARKETPLACE
  );
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
        stdout.write(`${erase}${position === index ? cyan(`> ${bold(option)}`) : `  ${option}`}\n`);
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

async function main() {
  const before = installed();
  process.stdout.write(
    before
      ? `Daiku ${bold(before)} is installed.\n`
      : 'Daiku is installed, but the host did not say which version: `claude plugin list` gave no answer.\n'
  );

  if (!process.stdin.isTTY) {
    process.stdout.write(
      '\nNo terminal here, so the question cannot be asked — and nothing is changed without one.\n' +
        'Run these two lines by hand:\n' +
        BY_HAND.map((step) => `  ${step}\n`).join('')
    );
    return;
  }

  const line = 'Refreshing the catalogue...';
  process.stdout.write(dim(`${line} `));
  const refresh = capture(STEPS[0]);
  process.stdout.write('\u001b[2K\r');
  if (refresh.error || refresh.status !== 0) {
    process.stdout.write(`${red('x')} the catalogue did not refresh.\n`);
    process.stdout.write(`${refresh.stdout || ''}${refresh.stderr || ''}`);
    process.exit(refresh.status || 1);
  }
  process.stdout.write(`${dim(line)} ${green('done')}\n`);

  const after = arriving();
  if (after && before && after === before) {
    process.stdout.write(`Daiku ${bold(before)} is already the latest.\n`);
    return;
  }
  process.stdout.write(`\n  ${delta(before, after)}\n\n`);

  const answer = await choose(`? Update Daiku now?  ${dim('(up/down, then Enter)')}`, [
    'Update Daiku',
    'Not now',
  ]);
  if (answer !== 0) {
    process.stdout.write('Nothing changed.\n');
    return;
  }

  const outcome = capture(STEPS[1]);
  let result = null;
  try {
    result = JSON.parse(outcome.stdout);
  } catch {
    result = null;
  }
  if (outcome.error || outcome.status !== 0) {
    process.stdout.write(`${red('x')} the update did not go through.\n`);
    process.stdout.write(`${outcome.stdout || ''}${outcome.stderr || ''}`);
    process.exit(outcome.status || 1);
  }

  const was = result && typeof result.oldVersion === 'string' ? result.oldVersion : null;
  const now = result && typeof result.newVersion === 'string' ? result.newVersion : null;
  if (was && now && was !== now) {
    process.stdout.write(`${green('Daiku')} updated  ${delta(was, now)}\n`);
  } else if (now) {
    process.stdout.write(`Daiku ${bold(now)} is already the latest.\n`);
  } else {
    process.stdout.write(`${green('Daiku')} updated.\n`);
  }
  process.stdout.write('Open a new Claude Code session to load it.\n');
}

main().catch((error) => {
  process.stderr.write(`${error && error.message ? error.message : error}\n`);
  process.exit(1);
});
