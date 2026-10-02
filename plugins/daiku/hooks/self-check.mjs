#!/usr/bin/env node
/**
 * The test benches of the five hooks, of the two programs in `architect/` and of `init`'s scan
 * (`skills/init/scan.mjs`), in a single shot.
 *
 * `node hooks/self-check.mjs` from the package root. Exits `0` if every case is
 * green, `1` on the first red, and prints the **counted** total — the sum of what the ten
 * benches really ran, not a number written here.
 *
 * It exists because five fail-open hooks are five ways of staying silent, and a fault in
 * one of the five is indistinguishable from silence until somebody runs its bench. A single
 * command makes that move repeatable before a release, in a CI, or after touching a file
 * that all five import.
 *
 * One of them is `architect/architect.mjs`, and it is the opposite kind of program: it
 * does not fail open, it fails loudly, and its verdict binds — so a case it does not cover
 * is a delivery that stops, not a wrong verdict. That is why it is launched here too and
 * not only by hand: the promise «the benches run together» is worth more, not less, for the
 * one program whose silence stops work. The other is `architect/ledger.mjs`, the review's disk
 * side, which fails loudly for the same reason and whose bench runs real Git on throwaway
 * repositories under the system temp directory.
 *
 * **A check nobody saw fail counts as red.** A bench whose rules can be enumerated reports,
 * beside `{checks, passed, failed}`, a `never_red` list: the rules no fixture of its own ever
 * turned red. A rule that has only ever passed is indistinguishable from one that cannot fail,
 * so a non-empty `never_red` turns that bench red here even when `failed` is empty. The
 * evaluator's bench reports it; a bench that does not is read as before.
 *
 * Those two benches live beside their programs, in `architect/`, and are **not** replicated under `hooks/lib/`:
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
 * The root is needed by the two benches of `architect/`, which take it by argument.
 */
const ROOT = join(HERE, '..');

/**
 * Modules of `lib/` that are imported, not hooked, and carry no bench of their own: the only ones
 * for which an empty stdout with exit 0 is honestly "no bench". Every other module of `lib/` — every
 * hook — that exits 0 having printed nothing has lost its bench, which is the fault this file exists
 * to make visible, and calling it "no bench" would hide it.
 */
const NOT_HOOKS = new Set(['project-root.mjs', 'daiku-config.mjs']);

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
  for (const program of ['architect.mjs', 'ledger.mjs']) {
    const file = join(ROOT, 'architect', program);
    try {
      readFileSync(file);
      found.push({ label: `architect/${program}`, file, args: ['--self-check', ROOT] });
    } catch (error) {
      process.stderr.write(`cannot read ${file}: ${error.message}\n`);
    }
  }
  // `init`'s scan lives beside the skill that runs it, and reads the disk like the ledger does.
  try {
    const file = join(ROOT, 'skills', 'init', 'scan.mjs');
    readFileSync(file);
    found.push({ label: 'skills/init/scan.mjs', file, args: ['--self-check'] });
  } catch (error) {
    process.stderr.write(`cannot read skills/init/scan.mjs: ${error.message}\n`);
  }
  // The host manifests have a bench of their own, beside this file: like the
  // evaluator it is not a hook, so discovery by folder would never list it.
  try {
    const file = join(HERE, 'template-check.mjs');
    readFileSync(file);
    found.push({ label: 'hooks/template-check.mjs', file, args: ['--self-check'] });
  } catch (error) {
    process.stderr.write(`cannot read template-check.mjs: ${error.message}\n`);
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
    // No output. Only the imported pair may be declared "no bench": any other module that
    // exited 0 having printed nothing is a hook whose bench stopped running, and is read red.
    const noBench = outcome.status === 0 && NOT_HOOKS.has(bench.label);
    return { name: bench.label, status: noBench ? 'no bench' : 'silent', detail: (outcome.stderr || '').trim() };
  }

  let report;
  try {
    report = JSON.parse(outcome.stdout);
  } catch {
    return { name: bench.label, status: 'unreadable', detail: outcome.stdout.slice(0, 200) };
  }
  const neverRed = Array.isArray(report.never_red) ? report.never_red : [];
  return {
    name: bench.label,
    status: (report.failed || []).length || neverRed.length ? 'red' : 'green',
    checks: report.checks || 0,
    failed: [...(report.failed || []), ...neverRed.map((rule) => `never_red: ${rule} — no fixture turns it red`)],
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
