#!/usr/bin/env node
/**
 * The test benches of the four hooks, in a single shot.
 *
 * `node hooks/self-check.mjs` from the package root. Exits `0` if every case is
 * green, `1` on the first red, and prints the **counted** total — the sum of what the four
 * benches really ran, not a number written here.
 *
 * It exists because four fail-open hooks are four ways of staying silent, and a fault in
 * one of the four is indistinguishable from silence until somebody runs its bench. A single
 * command makes that move repeatable before a release, in a CI, or after touching a file
 * that all four import.
 *
 * It is not a hook and is never installed into a project: `sync-host` copies the contents of
 * `hooks/lib/`, and this file sits one level above. Whoever tests an installed hook runs
 * its `--self-check`, which is what the post-edit report reminds them of.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB = join(dirname(fileURLToPath(import.meta.url)), 'lib');

/** A `lib/` `.mjs` is a hook if its bench answers: the other modules have none. */
function modules() {
  try {
    return readdirSync(LIB)
      .filter((name) => name.endsWith('.mjs'))
      .sort();
  } catch (error) {
    process.stderr.write(`cannot read ${LIB}: ${error.message}\n`);
    return [];
  }
}

function tryOne(name) {
  const outcome = spawnSync(process.execPath, [join(LIB, name), '--self-check'], {
    encoding: 'utf-8',
    timeout: 60000,
  });

  if (outcome.error) return { name, status: 'does not start', detail: outcome.error.message };
  if (!outcome.stdout || !outcome.stdout.trim()) {
    // No output: either the module has no bench — the case of `project-root.mjs` and
    // `daiku-config.mjs`, which are imported by the hooks and tested by their benches — or
    // it exited badly, and then the exit code says so.
    return { name, status: outcome.status === 0 ? 'no bench' : 'silent', detail: (outcome.stderr || '').trim() };
  }

  let report;
  try {
    report = JSON.parse(outcome.stdout);
  } catch {
    return { name, status: 'unreadable', detail: outcome.stdout.slice(0, 200) };
  }
  return {
    name,
    status: (report.failed || []).length ? 'red' : 'green',
    checks: report.checks || 0,
    failed: report.failed || [],
  };
}

const outcomes = modules().map(tryOne);
const tested = outcomes.filter((e) => e.status === 'green' || e.status === 'red');
const total = tested.reduce((sum, e) => sum + e.checks, 0);
const red = outcomes.filter((e) => e.status !== 'green' && e.status !== 'no bench');

for (const outcome of outcomes) {
  if (outcome.status === 'green') {
    process.stdout.write(`  ok    ${outcome.name} — ${outcome.checks} checks\n`);
  } else if (outcome.status === 'no bench') {
    process.stdout.write(`  —     ${outcome.name} — no bench: it is an imported module, not a hook\n`);
  } else if (outcome.status === 'red') {
    process.stdout.write(`  RED   ${outcome.name} — ${outcome.failed.length} cases out of ${outcome.checks}\n`);
    for (const failure of outcome.failed) process.stdout.write(`        - ${failure}\n`);
  } else {
    process.stdout.write(`  RED   ${outcome.name} — ${outcome.status}: ${outcome.detail}\n`);
  }
}

process.stdout.write(
  `\n${tested.length} benches, ${total} checks, ${red.length ? `${red.length} red` : 'all green'}\n`
);
process.exit(red.length ? 1 : 0);
