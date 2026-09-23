#!/usr/bin/env node
/**
 * The test benches of the four hooks and of the evaluator, in a single shot.
 *
 * `node hooks/self-check.mjs` from the package root. Exits `0` if every case is
 * green, `1` on the first red, and prints the **counted** total — the sum of what the five
 * benches really ran, not a number written here.
 *
 * It exists because four fail-open hooks are four ways of staying silent, and a fault in
 * one of the four is indistinguishable from silence until somebody runs its bench. A single
 * command makes that move repeatable before a release, in a CI, or after touching a file
 * that all four import.
 *
 * The fifth bench is `architect/architect.mjs`, and it is the opposite kind of program: it
 * does not fail open, it fails loudly, and its verdict binds — so a case it does not cover
 * is a delivery that stops, not a wrong verdict. That is why it is launched here too and
 * not only by hand: the promise «the benches run together» is worth more, not less, for the
 * one program whose silence stops work.
 *
 * Its bench lives beside it, in `architect/`, and is **not** replicated under `hooks/lib/`:
 * that folder is copied into the user's project by `sync-host`, and a verifier replicated
 * in every project is the duplication `contracts/project-contract.md` §8 condemns.
 *
 * It is not a hook and is never installed into a project: `sync-host` copies the contents of
 * `hooks/lib/`, and this file sits one level above. Even less does the evaluator land in a
 * project. Whoever tests an installed hook runs its `--self-check`, which is what the
 * post-edit report reminds them of.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIB = join(HERE, 'lib');

/**
 * The package root, one level above this file. It is derived from this file's position
 * because this file is a development tool the package never installs: it lives beside the
 * manifest, `skills/`, `contracts/` and `architect/`, and nobody reaches it from a project.
 * The root is needed by exactly one bench, the evaluator's, which takes it by argument.
 */
const ROOT = join(HERE, '..');

/**
 * A `lib/` `.mjs` is a hook if its bench answers: the other modules have none. The
 * evaluator is not in `lib/` and is added from its own folder.
 */
function benches() {
  const found = [];
  let names;
  try {
    names = readdirSync(LIB)
      .filter((name) => name.endsWith('.mjs'))
      .sort();
  } catch (error) {
    process.stderr.write(`cannot read ${LIB}: ${error.message}\n`);
    names = [];
  }
  for (const name of names) {
    found.push({ label: name, file: join(LIB, name), args: ['--self-check'] });
  }
  const architect = join(ROOT, 'architect', 'architect.mjs');
  try {
    readFileSync(architect);
    found.push({ label: 'architect/architect.mjs', file: architect, args: ['--self-check', ROOT] });
  } catch (error) {
    process.stderr.write(`cannot read ${architect}: ${error.message}\n`);
  }
  return found;
}

function tryOne(bench) {
  const outcome = spawnSync(process.execPath, [bench.file, ...bench.args], {
    encoding: 'utf-8',
    timeout: 60000,
  });

  if (outcome.error) return { name: bench.label, status: 'does not start', detail: outcome.error.message };
  if (!outcome.stdout || !outcome.stdout.trim()) {
    // No output: either the module has no bench — the case of `project-root.mjs` and
    // `daiku-config.mjs`, imported modules with no entry point of their own — or it exited
    // badly, and then the exit code says so.
    return { name: bench.label, status: outcome.status === 0 ? 'no bench' : 'silent', detail: (outcome.stderr || '').trim() };
  }

  let report;
  try {
    report = JSON.parse(outcome.stdout);
  } catch {
    return { name: bench.label, status: 'unreadable', detail: outcome.stdout.slice(0, 200) };
  }
  return {
    name: bench.label,
    status: (report.failed || []).length ? 'red' : 'green',
    checks: report.checks || 0,
    failed: report.failed || [],
  };
}

const outcomes = benches().map(tryOne);
const tested = outcomes.filter((e) => e.status === 'green' || e.status === 'red');
const total = tested.reduce((sum, e) => sum + e.checks, 0);
const red = outcomes.filter((e) => e.status !== 'green' && e.status !== 'no bench');

for (const outcome of outcomes) {
  if (outcome.status === 'green') {
    process.stdout.write(`  ok    ${outcome.name} — ${outcome.checks} checks\n`);
  } else if (outcome.status === 'no bench') {
    process.stdout.write(`  —     ${outcome.name} — no bench: an imported module, which the hooks importing it test\n`);
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
