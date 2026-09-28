#!/usr/bin/env node
/**
 * Stop notice — Stop.
 *
 * It says at session end the one thing whoever stops **cannot see from the
 * transcript tail**: a review ledger left open. A cycle interrupted with
 * `outcome` still `null` restarts from zero unless the ledger is handed over —
 * and with the anchors of the applied gone, `on_previous_fix` and `oscillation`
 * run against another feature's history. The notice lists the open ledgers with
 * their `base` and `item`, so the next session resumes from there instead of
 * reopening the diff blind.
 *
 * What counts as open is defined once, in `skills/review/SKILL.md`
 * § *Baseline and ledger*: a ledger whose `outcome` is `null`. This hook reads
 * that definition and nothing else — it does not decide what a review is.
 *
 * The ledgers live where the project says, via `{paths.review_state}` in
 * `.daiku/project.json`: the same key the review writes them under. When it is
 * not declared, this notice does not exist — §6 of `contracts/project-contract.md`,
 * *what the JSON does not declare does not exist*. Better to stay silent than to
 * rummage through a folder picked from memory.
 *
 * Contract: **fail-open and silent**. Nothing open, unreadable file, missing
 * folder, any error → prints nothing and exits 0. It never blocks a stop, and
 * never speaks just to say every ledger landed: a notice that arrives every
 * time stops being read.
 *
 * Test bench: `node stop-advice.mjs --self-check`. It runs on a simulated
 * filesystem and touches nothing; the total is **counted**, not hard-coded.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { invokedDirectly, projectRoot } from './project-root.mjs';
import { REAL_READS, loadContext, fakeContext } from './daiku-config.mjs';

const ROOT = projectRoot();

const REAL_ENV = {
  exists: (path) => existsSync(path),
  read: (path) => readFileSync(path, 'utf-8'),
  list: (path) => {
    try {
      return readdirSync(path);
    } catch {
      return [];
    }
  },
};

/** Ledgers left open: `outcome` still `null`, with their blocking count. */
export function openLedgers(reviewState, env) {
  const open = [];
  let names;
  try {
    names = env.list(reviewState);
  } catch {
    return open; // missing folder: stay silent
  }
  for (const name of [...names].sort()) {
    if (!name.endsWith('.json')) continue;
    let ledger;
    try {
      ledger = JSON.parse(env.read(join(reviewState, name)));
    } catch {
      continue; // an unreadable ledger is not ours to judge
    }
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) continue;
    if (ledger.outcome !== null && ledger.outcome !== undefined) continue;
    const items = Array.isArray(ledger.to_confirm) ? ledger.to_confirm : [];
    open.push({
      file: name,
      base: typeof ledger.base === 'string' && ledger.base ? ledger.base : '?',
      item: typeof ledger.item === 'string' && ledger.item ? ledger.item : '?',
      blocking: items.filter((entry) => entry && entry.blocking === true).length,
    });
  }
  return open;
}

export function advice(root, env, ctx) {
  if (!ctx || !ctx.present || !ctx.reviewState) return null;
  const open = openLedgers(ctx.reviewState, env);
  if (!open.length) return null;

  const listing = open
    .map(
      (entry) =>
        `- \`${entry.item}\` (base \`${entry.base}\`, ledger \`${entry.file}\`)` +
        (entry.blocking ? ` — ${entry.blocking} blocking item${entry.blocking === 1 ? '' : 's'}` : '')
    )
    .join('\n');
  const single = open.length === 1;
  return (
    `${single ? 'One review ledger is' : `${open.length} review ledgers are`} still open: the ` +
    `cycle stopped before writing its outcome.\n\n${listing}\n\n` +
    `**Resume from the ledger, not from zero.** Hand its path back to the review with the ` +
    `same base and item; reopening the diff without it loses the anchors every later ` +
    `signal is measured on. If the work is dead instead, remove the ledger — while it ` +
    `stays, this warning returns at every stop.`
  );
}

// --- test bench -----------------------------------------------------------

/** A simulated environment: a path → content map, files only. */
function fakeEnv(files) {
  const key = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const map = new Map(Object.entries(files).map(([k, v]) => [key(k), v]));
  return {
    exists: (p) => map.has(key(p)) || [...map.keys()].some((path) => path.startsWith(key(p) + '/')),
    read: (p) => {
      if (!map.has(key(p))) throw new Error(`ENOENT ${p}`);
      return map.get(key(p));
    },
    list: (p) => {
      const base = key(p) + '/';
      const names = new Set();
      for (const path of map.keys()) {
        if (!path.startsWith(base)) continue;
        const rest = path.slice(base.length);
        if (rest && !rest.includes('/')) names.add(rest);
      }
      return [...names];
    },
  };
}

const R = 'C:/dev/project';
const STATE = `${R}/.daiku/review-state`;
const CTX = () => fakeContext({ reviewState: STATE });
const CTX_ABSENT = fakeContext({ present: false });
const CTX_NO_STATE = fakeContext({ reviewState: null });

const OPEN_LEDGER = JSON.stringify({
  base: 'abc1234',
  item: 'docs/new-developments/gamma',
  rounds: [],
  outcome: null,
  coverage: null,
  gate: null,
  gate_detail: null,
  to_confirm: [
    { file: 'src/a.ts', blocking: true },
    { file: 'src/b.ts', blocking: false },
  ],
});
const CLOSED_LEDGER = JSON.stringify({
  base: 'abc1234',
  item: 'docs/new-developments/alfa',
  rounds: [],
  outcome: 'fixed-point',
  coverage: 'tests-written',
  gate: 'green',
  gate_detail: 'ok',
  to_confirm: [],
});

function selfCheck() {
  const failed = [];
  let ran = 0;
  const check = (name, condition) => {
    ran += 1;
    if (!condition) failed.push(name);
  };

  check('project without Daiku: silence', advice(R, fakeEnv({}), CTX_ABSENT) === null);
  check('context missing entirely: silence', advice(R, fakeEnv({}), undefined) === null);
  check('no review state declared: silence', advice(R, fakeEnv({}), CTX_NO_STATE) === null);
  check('missing state folder: silence', advice(R, fakeEnv({}), CTX()) === null);

  const closed = { [`${STATE}/review-ledger-abc1234-120000.json`]: CLOSED_LEDGER };
  check('landed ledger: silence', advice(R, fakeEnv(closed), CTX()) === null);

  const open = { [`${STATE}/review-ledger-abc1234-120000.json`]: OPEN_LEDGER };
  const textOpen = advice(R, fakeEnv(open), CTX());
  check('open ledger: warning', !!textOpen && textOpen.includes('gamma'));
  check('the warning names base and ledger file', !!textOpen && textOpen.includes('abc1234') && textOpen.includes('review-ledger-abc1234-120000.json'));
  check('the warning counts the blocking items', !!textOpen && textOpen.includes('1 blocking item'));
  check('the warning says to resume from the ledger', !!textOpen && textOpen.includes('not from zero'));
  check('the warning says how to stop it', !!textOpen && textOpen.includes('remove the ledger'));
  check('a single ledger agrees in the singular', !!textOpen && textOpen.includes('One review ledger is'));

  const two = {
    [`${STATE}/review-ledger-abc1234-120000.json`]: OPEN_LEDGER,
    [`${STATE}/review-ledger-def5678-121500.json`]: OPEN_LEDGER.replace('abc1234', 'def5678').replace('gamma', 'delta'),
  };
  const textTwo = advice(R, fakeEnv(two), CTX());
  check('two ledgers: both listed', !!textTwo && textTwo.includes('gamma') && textTwo.includes('delta'));
  check('two ledgers agree in the plural', !!textTwo && textTwo.includes('2 review ledgers are'));

  const malformed = { [`${STATE}/review-ledger-abc1234-120000.json`]: '{not json' };
  check('an unreadable ledger is skipped in silence', advice(R, fakeEnv(malformed), CTX()) === null);

  const noOutcome = { [`${STATE}/review-ledger-abc1234-120000.json`]: JSON.stringify({ base: 'abc1234', item: 'x' }) };
  const textNoOutcome = advice(R, fakeEnv(noOutcome), CTX());
  check('a ledger that never wrote its tail is open', !!textNoOutcome && textNoOutcome.includes('x'));

  const nonJson = { [`${STATE}/notes.txt`]: 'hello' };
  check('non-ledger files are ignored', advice(R, fakeEnv(nonJson), CTX()) === null);

  process.stdout.write(
    JSON.stringify({ checks: ran, passed: ran - failed.length, failed }, null, 2) + '\n'
  );
  return failed.length ? 1 : 0;
}

function main() {
  const text = advice(ROOT, REAL_ENV, loadContext(ROOT, REAL_READS));
  if (!text) return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'Stop', additionalContext: text },
    })
  );
}

if (invokedDirectly(import.meta.url)) {
  if (process.argv.includes('--self-check')) {
    process.exit(selfCheck());
  }
  try {
    main();
  } catch {
    /* fail-open: never block a stop */
  }
  process.exit(0);
}
