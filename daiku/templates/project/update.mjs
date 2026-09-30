#!/usr/bin/env node
/**
 * Updates Daiku on Claude Code: refreshes the `daiku` marketplace, then updates the
 * `daiku@daiku` plugin. Run it from VS Code with the `daiku: update` task, or by hand with
 * `node .daiku/update.mjs`. It stops at the first command that fails, with its exit code.
 *
 * Written by Daiku's init. It is yours now: init never rewrites it.
 */

import { spawnSync } from 'node:child_process';

const STEPS = ['claude plugin marketplace update daiku', 'claude plugin update daiku@daiku'];

for (const step of STEPS) {
  process.stdout.write(`> ${step}\n`);
  const outcome = spawnSync(step, { shell: true, stdio: 'inherit' });
  if (outcome.error) {
    process.stderr.write(`${step}: ${outcome.error.message}\n`);
    process.exit(1);
  }
  if (outcome.status !== 0) process.exit(outcome.status ?? 1);
}

process.stdout.write('Daiku is up to date. Open a new Claude Code session to load it.\n');
