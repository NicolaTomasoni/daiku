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
 * **Which files are ledgers is a second question, and not the same one.** The state folder is
 * a seat the project chooses, and it may well be shared: a repository that reviewed before
 * Daiku keeps its own ledger folder, carrying another tool's keys under the very same file
 * names. Read as ledgers, those files have no `outcome` — and neither has the findings file a
 * review of ours leaves beside its ledger — so the notice lists cycles that are over as
 * interrupted, at every stop, forever. A file is therefore judged only when it carries **the
 * ledger's own form** (`isLedger`, below): what is not a ledger is not ours to judge, exactly
 * like a file that does not parse.
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
 * filesystem and touches nothing of the project's; the one file it opens is the package's own
 * schema, to prove the form below mirrors it. The total is **counted**, not hard-coded.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { invokedDirectly, projectRoot } from './project-root.mjs';
import { REAL_READS, loadContext, fakeContext } from './daiku-config.mjs';

const ROOT = projectRoot();
const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * The ledger's own fields: `schemas/blocks.json` § *ledger*, `required`. `architect/ledger.mjs`
 * validates every ledger against that entry before writing it, and refuses a key the form does
 * not declare — so each file the review leaves carries **exactly** these nine, the empty ones
 * included, from the scope on: only the values change between the first round and the exit.
 *
 * They are copied here rather than read from the schema at run time because on Codex this file
 * is installed **alone** in `.codex/hooks/` (`skills/sync-host` copies `hooks/lib/`), with no
 * `schemas/` beside it: a hook that cannot recognise a ledger would stay silent forever. The
 * bench ties the copy back to the schema it mirrors.
 */
const LEDGER_FIELDS = [
  'base',
  'item',
  'scope_tree',
  'scope_files',
  'rounds',
  'outcome',
  'coverage',
  'gate',
  'gate_detail',
];

/**
 * Is this parsed file one of **our** ledgers?
 *
 * The question is not what the file says but whether the review wrote it, because the state
 * folder is shared ground: a project that reviewed before Daiku leaves its own ledgers there
 * (`base`, `item`, `gate`, `gate_detail`, and keys of its own language), and a review of ours
 * leaves the findings file of every round in the same folder, under the same extension —
 * `review-ledger-<base>-<HHMMSS>.round-1.findings.json`. Neither carries an `outcome`, and both
 * would be listed as interrupted cycles.
 *
 * The form is the whole key set, not the presence of `outcome`: the tool writes nothing the
 * schema refuses and omits nothing it requires, so a file carrying every field and no other is
 * a ledger, and one carrying another tool's keys is that tool's business. It is the judgement
 * the tool itself makes of a handed ledger (`architect/ledger.mjs`, `ledgerAt`), and the two
 * must agree: what the review would refuse to resume is not a ledger this notice may list.
 */
function isLedger(value) {
  const keys = Object.keys(value);
  return keys.length === LEDGER_FIELDS.length && LEDGER_FIELDS.every((field) => field in value);
}

/**
 * The items the last round left to confirm and marked blocking. They are what the commit stops
 * on (§ *The ledger also keeps what blocks, not only what restarts* of the review skill), and
 * they live **inside the rounds** — the tail appends the last ones to the round already there.
 */
function blockingItems(ledger) {
  const rounds = Array.isArray(ledger.rounds) ? ledger.rounds : [];
  const last = rounds.length ? rounds[rounds.length - 1] : null;
  const items = last && Array.isArray(last.to_confirm) ? last.to_confirm : [];
  return items.filter((entry) => entry && entry.blocking === true).length;
}

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
    if (!isLedger(ledger)) continue; // another tool's file, or a findings file: not a ledger
    if (ledger.outcome !== null) continue;
    open.push({
      file: name,
      base: typeof ledger.base === 'string' && ledger.base ? ledger.base : '?',
      item: typeof ledger.item === 'string' && ledger.item ? ledger.item : '?',
      blocking: blockingItems(ledger),
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

const TREE = '4f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c';

/** A round as the tool records it, with the one field this hook reads. */
const round = (toConfirm) => ({
  n: 1,
  disciplines: ['bug'],
  missing_disciplines: [],
  pre_apply_tree: TREE,
  post_apply_tree: TREE,
  applied: [],
  discarded: [],
  to_confirm: toConfirm,
  oscillation: [],
  check_fast: { status: 'green', detail: 'ok' },
  verdict: 'continue',
  why: 'nothing to fix',
});

/** A ledger in the form of `schemas/blocks.json` § *ledger*, the one the tool writes. */
const ledger = (item, outcome, toConfirm = []) =>
  JSON.stringify({
    base: 'abc1234',
    item,
    scope_tree: TREE,
    scope_files: ['src/a.ts'],
    rounds: [round(toConfirm)],
    outcome,
    coverage: outcome === null ? null : 'tests-written',
    gate: outcome === null ? null : 'green',
    gate_detail: outcome === null ? null : 'ok',
  });

/** A ledger the scope just opened: no round yet, the four tail fields still empty. */
const FRESH_LEDGER = JSON.stringify({
  base: 'abc1234',
  item: 'docs/new-developments/beta',
  scope_tree: TREE,
  scope_files: ['src/a.ts'],
  rounds: [],
  outcome: null,
  coverage: null,
  gate: null,
  gate_detail: null,
});

const OPEN_LEDGER = ledger('docs/new-developments/gamma', null, [
  { scenario: 'the fix left a hole', blocking: true },
  { scenario: 'a style nit', blocking: false },
]);
const CLOSED_LEDGER = ledger('docs/new-developments/alfa', 'fixed-point');

/**
 * What a project that reviewed before Daiku leaves in the folder it declared: another tool's
 * keys — in Italian, in the case measured — under the same file name pattern as ours.
 */
const FOREIGN_LEDGER = JSON.stringify({
  base: '035f906',
  copertura: 'test-scritti',
  gate: 'verde',
  gate_detail: 'ok',
  giri: [],
  item: 'docs/nuovi-sviluppi/2. enabling-skew',
  uscita: 'punto-fisso',
});

/** A findings file of ours: same folder, same extension, no `outcome`, not a ledger. */
const FINDINGS = JSON.stringify({ round: 1, keys: {}, applier_attempts: 0, findings: [] });

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

  const fresh = { [`${STATE}/review-ledger-abc1234-120000.json`]: FRESH_LEDGER };
  const textFresh = advice(R, fakeEnv(fresh), CTX());
  check('a ledger just opened by the scope is open', !!textFresh && textFresh.includes('beta'));

  const nonJson = { [`${STATE}/notes.txt`]: 'hello' };
  check('non-ledger files are ignored', advice(R, fakeEnv(nonJson), CTX()) === null);

  // --- the files that are not ours -------------------------------------------
  // `init` proposes `paths.review_state` from what the repository already keeps, and a project
  // that reviewed before Daiku has its own ledger folder: another tool's keys, the same file
  // names. Those files came back as open cycles at every stop, and the notice spoke forever.
  const foreign = { [`${STATE}/review-ledger-035f906-203614.json`]: FOREIGN_LEDGER };
  check("another tool's ledger is not ours to judge", advice(R, fakeEnv(foreign), CTX()) === null);

  const findings = { [`${STATE}/review-ledger-abc1234-120000.round-1.findings.json`]: FINDINGS };
  check('a findings file is not a ledger', advice(R, fakeEnv(findings), CTX()) === null);

  // A closed review leaves its ledger *and* its findings files behind for good: neither may
  // reopen the notice.
  const spent = {
    [`${STATE}/review-ledger-abc1234-120000.json`]: CLOSED_LEDGER,
    [`${STATE}/review-ledger-abc1234-120000.round-1.findings.json`]: FINDINGS,
  };
  check('a review that landed leaves nothing open', advice(R, fakeEnv(spent), CTX()) === null);

  // An interrupted one leaves both open files: only the ledger is listed, once.
  const interrupted = {
    [`${STATE}/review-ledger-abc1234-120000.json`]: OPEN_LEDGER,
    [`${STATE}/review-ledger-abc1234-120000.round-1.findings.json`]: FINDINGS,
  };
  const textInterrupted = advice(R, fakeEnv(interrupted), CTX());
  check('an interrupted review is listed once, its findings file beside it', !!textInterrupted && textInterrupted.includes('One review ledger is'));

  // --- the form the hook recognises mirrors the schema -------------------------
  // The one read this bench makes on disk: `schemas/blocks.json` is the seat declaring the
  // ledger's form, and the list copied in this file must move with it. It is not reachable from
  // an installed copy — on Codex `sync-host` carries `hooks/lib/` alone — and the case is then
  // red on purpose: a bench that cannot tie the form to its schema is not checking it.
  let mirrored = null;
  try {
    mirrored = JSON.parse(readFileSync(join(HERE, '..', '..', 'schemas', 'blocks.json'), 'utf-8')).ledger.required;
  } catch {
    /* reported by the check below */
  }
  check(
    'the ledger form is the one schemas/blocks.json § ledger declares (unrunnable where the schema is not beside this file)',
    Array.isArray(mirrored) && mirrored.length === LEDGER_FIELDS.length && LEDGER_FIELDS.every((field) => mirrored.includes(field))
  );

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
