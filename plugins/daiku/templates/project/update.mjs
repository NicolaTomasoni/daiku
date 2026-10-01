#!/usr/bin/env node
/**
 * Updates Daiku on Claude Code: it shows the version in place, asks, and on a yes refreshes the
 * `daiku` marketplace and updates the `daiku@daiku` plugin. Run it from VS Code with the
 * `daiku: update` task, or by hand with `node .daiku/update.mjs`.
 *
 * **It asks before writing anything.** The two commands replace the package the project runs on,
 * and the version that arrives is not visible before the fact — so the run says which one is in
 * place and waits. Arrows and Enter; `Not now` is one keystroke away.
 *
 * **A terminal is required, and that is why the task is a `shell` task.** A `process` task runs
 * the command without a terminal, `process.stdin.isTTY` is then false, and the question could
 * never be asked. Where there is no terminal anyway — a pipe, an automated runner — this script
 * does not decide in your place: it prints the version and the two commands, and stops.
 *
 * **The version comes from the host**, `claude plugin list --json`, not from a file of ours: that
 * is the official answer, and it holds on a machine whose cache folder this script never saw.
 * Where the host does not answer, the version is unknown — said, not guessed — and the run goes on.
 *
 * It stops at the first command that fails, with its exit code.
 *
 * Written by Daiku's init. It is yours now: init never rewrites it.
 */

import { spawnSync } from 'node:child_process';

/** The two lines of the update, in order: without the first, the second has nothing new to take. */
const STEPS = ['claude plugin marketplace update daiku', 'claude plugin update daiku@daiku'];

/** One line through the shell, its output kept: the only way the version is read back. */
function capture(line) {
  return spawnSync(line, { shell: true, encoding: 'utf-8' });
}

/**
 * The version in place right now, or `null` where the host does not answer. The listing arrives
 * as a bare array, and as an object carrying `installed` once more is asked of it — both shapes
 * are read here, because the one this script meets is the host's to choose, not ours.
 */
function installed() {
  const answer = capture('claude plugin list --json');
  if (answer.error || answer.status !== 0 || !answer.stdout) return null;
  let listing;
  try {
    listing = JSON.parse(answer.stdout);
  } catch {
    return null;
  }
  const plugins = Array.isArray(listing)
    ? listing
    : listing && Array.isArray(listing.installed)
      ? listing.installed
      : [];
  const entry = plugins.find((plugin) => plugin && plugin.id === 'daiku@daiku');
  return entry && typeof entry.version === 'string' && entry.version ? entry.version : null;
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
        stdout.write(`${erase}${position === index ? '>' : ' '} ${option}\n`);
      });
      painted = true;
    };

    const leave = (answer) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onKey);
      stdout.write(`\u001b[${drawn}A`);
      stdout.write(`${erase}${question} ${options[index]}\n`);
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
      ? `Daiku ${before} is installed.\n\n`
      : 'Daiku is installed, but the host did not say which version: `claude plugin list` gave no answer.\n\n'
  );

  if (!process.stdin.isTTY) {
    process.stdout.write(
      'No terminal here, so the question cannot be asked — and nothing is changed without it.\n' +
        'Run these two lines by hand:\n' +
        STEPS.map((step) => `  ${step}\n`).join('')
    );
    return;
  }

  const answer = await choose('? Update Daiku now?  (up/down, then Enter)', [
    'Update Daiku',
    'Not now',
  ]);
  process.stdout.write('\n');
  if (answer !== 0) {
    process.stdout.write('Nothing changed.\n');
    return;
  }

  for (const step of STEPS) {
    process.stdout.write(`> ${step}\n`);
    const outcome = spawnSync(step, { shell: true, stdio: 'inherit' });
    if (outcome.error) {
      process.stderr.write(`${step}: ${outcome.error.message}\n`);
      process.exit(1);
    }
    if (outcome.status !== 0) process.exit(outcome.status ?? 1);
  }

  const after = installed();
  const landed = after && before && after !== before ? `${before} -> ${after}` : after;
  process.stdout.write(
    landed
      ? `Daiku ${landed}. Open a new Claude Code session to load it.\n`
      : 'Daiku is up to date. Open a new Claude Code session to load it.\n'
  );
}

main().catch((error) => {
  process.stderr.write(`${error && error.message ? error.message : error}\n`);
  process.exit(1);
});
