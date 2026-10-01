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
 * folder, any error → prints nothing and exits 0. It never refuses a stop, and
 * never speaks just to say every ledger landed: a notice that arrives every
 * time stops being read.
 *
 * **Speaking at a stop continues the turn.** A `Stop` hook's `additionalContext` is
 * delivered at the end of the turn *and the conversation goes on* — so a notice emitted at
 * every stop restarts the turn at every stop. Measured on a project with one review in
 * flight, 30 September 2026: nine consecutive blocks before the harness overrode the hook
 * and ended the turn. Two guards answer it, each sufficient on its own:
 *
 *  - **`stop_hook_active`**, read from the input: `true` when the stop being handled is
 *    already the continuation an earlier notice caused. The hook goes silent there — it is
 *    the remedy the harness itself names when it overrides a looping hook.
 *  - **the mark of the session**: the digest of what was announced, written where the host
 *    keeps the session's own scratch files (`scratchpad_dir` of the event, or the OS
 *    temporary directory keyed by `session_id` where the host has none). The same text is
 *    never announced twice, so the notice arrives **once per session** instead of once per
 *    stop — and a host reporting `stop_hook_active` wrongly does not send it in a loop.
 *
 * The mark is the only thing this hook writes, and it is written **outside the
 * project**: a state folder of Daiku's inside the repository would be one more seat to keep.
 * The session ends and the host cleans up its own scratch; an abandoned mark in the temporary
 * directory costs one small file.
 *
 * The notice is written in **descriptive voice**, and says what it is: the same host
 * reference warns that text shaped like an out-of-band system instruction trips the reader's
 * prompt-injection defences, and a reader who takes it for the user's next message changes
 * subject on his own. It reports a state, it does not give an order.
 *
 * Test bench: `node stop-advice.mjs --self-check`. It runs on a simulated filesystem and
 * touches nothing of the project's; the one file it opens is the package's own schema, to
 * prove the form below mirrors it. The total is **counted**, not hard-coded.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
  tmpdir: () => tmpdir(),
  write: (path, text) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, 'utf-8');
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
    `${single ? 'One review ledger is' : `${open.length} review ledgers are`} still open — a ` +
    `review cycle started and stopped before writing its outcome.\n\n${listing}\n\n` +
    `A ledger is what a review resumes from: reopened from the diff alone instead of from ` +
    `the same base and item, it loses the anchors every later signal is measured on. Where ` +
    `the work is dead instead, the ledger comes off.\n\n` +
    `*Daiku status notice, written at the end of the turn — not a message from the user, and ` +
    `nothing being worked on has to change. It is delivered once per session, and returns in ` +
    `a new one while a ledger stays open.*`
  );
}

// --- the mark of the session ---------------------------------------------------

/** The digest of what was announced: the text itself, reduced to a comparison. */
function digest(text) {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Where the mark goes: the session's own scratch directory — the `scratchpad_dir` the host
 * gives the event, or, where it gives none, the OS temporary directory under the
 * `session_id`. `null` when the event carries neither, and then the mark is simply not
 * written: silence is the fallback, never a guess at a shared path.
 *
 * **Never the project.** The five hooks write nothing inside the repository; a folder of
 * Daiku's own there would be one more seat to keep, and a hook that writes where it guards
 * is a hook that has to be guarded itself.
 */
export function markPath(event, env) {
  const scratchpad = typeof event.scratchpad_dir === 'string' ? event.scratchpad_dir.trim() : '';
  if (scratchpad) return join(scratchpad, 'daiku-stop-advice.json');
  const session = typeof event.session_id === 'string' ? event.session_id.trim() : '';
  if (!session) return null;
  let base;
  try {
    base = env.tmpdir();
  } catch {
    return null; // no temporary directory: no mark, and the notice still speaks
  }
  if (!base) return null;
  return join(base, 'daiku-stop-advice', `${session.replace(/[^A-Za-z0-9._-]/g, '_')}.json`);
}

/** What this session already heard, or `null`. An unreadable mark counts as no mark. */
function announced(env, path) {
  if (!path) return null;
  try {
    const mark = JSON.parse(env.read(path));
    return mark && typeof mark === 'object' && typeof mark.announced === 'string'
      ? mark.announced
      : null;
  } catch {
    return null;
  }
}

/** Writes the mark, and stays silent if it cannot: the notice is worth more than the mark. */
function markAnnounced(env, path, fingerprint) {
  if (!path) return;
  try {
    env.write(path, JSON.stringify({ announced: fingerprint }));
  } catch {
    /* fail-open: the notice goes out anyway, and the next stop repeats it at worst */
  }
}

/**
 * What one stop event answers: the notice, or `null` for silence. This is the whole
 * decision — reading the input, the `stop_hook_active` guard, the mark of the session —
 * and it lives here, without leaving the process, so the bench calls it.
 */
export function notice(event, root, env, ctx) {
  if (event && event.stop_hook_active === true) return null; // already a continuation: silence
  const text = advice(root, env, ctx);
  if (!text) return null;
  const path = markPath(event || {}, env);
  const fingerprint = digest(text);
  if (announced(env, path) === fingerprint) return null; // this session already heard this
  markAnnounced(env, path, fingerprint);
  return text;
}

// --- test bench -----------------------------------------------------------

/**
 * A simulated environment: a path → content map, files only. What the hook writes lands in
 * the same map, so a second call sees the mark the first one left.
 */
function fakeEnv(files, tmp = 'C:/Temp/daiku') {
  const key = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const map = new Map(Object.entries(files).map(([k, v]) => [key(k), v]));
  return {
    tmpdir: () => tmp,
    write: (p, text) => {
      map.set(key(p), text);
    },
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
  check('the warning says a review resumes from the ledger', !!textOpen && textOpen.includes('resumes from'));
  check('the warning says how to close it', !!textOpen && textOpen.includes('comes off'));
  check('a single ledger agrees in the singular', !!textOpen && textOpen.includes('One review ledger is'));
  // The reader took the notice for the user's next message once, and changed subject on his
  // own. A status line says what it is, and does not read as an order.
  check(
    'the notice says it is not a message from the user',
    !!textOpen && textOpen.includes('not a message from the user')
  );
  check(
    'the notice says it comes once per session',
    !!textOpen && textOpen.includes('once per session')
  );

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

  // --- one notice per session, and never on a continuation ---------------------
  // Speaking at a stop continues the turn: the same notice at every stop loops until the
  // harness overrides the hook. These are the two guards, and each one alone is enough.
  const stop = (extra = {}) => ({ hook_event_name: 'Stop', session_id: 'sess-1', ...extra });

  check(
    'a stop the hook itself caused: silence',
    notice(stop({ stop_hook_active: true }), R, fakeEnv(open), CTX()) === null
  );
  check(
    '`stop_hook_active: false` is a fresh stop, not a continuation',
    !!notice(stop({ stop_hook_active: false }), R, fakeEnv(open), CTX())
  );

  const session = fakeEnv(open);
  check('the first stop of a session speaks', !!notice(stop(), R, session, CTX()));
  check('the same session hears it once', notice(stop(), R, session, CTX()) === null);
  check('a third stop stays silent too', notice(stop(), R, session, CTX()) === null);
  check(
    'another session hears it again',
    !!notice(stop({ session_id: 'sess-2' }), R, session, CTX())
  );

  // The mark is the digest of the text, so a set that moved is said again: a review that
  // lands while another stays open is news, and stays news once.
  const moving = fakeEnv(two);
  check('a first set speaks', !!notice(stop(), R, moving, CTX()));
  check('the same set does not repeat', notice(stop(), R, moving, CTX()) === null);
  moving.write(`${STATE}/review-ledger-abc1234-120000.json`, CLOSED_LEDGER);
  const afterOneLanded = notice(stop(), R, moving, CTX());
  check(
    'a set that changed speaks again',
    !!afterOneLanded && afterOneLanded.includes('One review ledger is')
  );
  check('and the new set is not repeated either', notice(stop(), R, moving, CTX()) === null);

  // No session to mark: the notice is not silenced across sessions by a shared path, and
  // `stop_hook_active` stays the only guard there.
  const anonymous = fakeEnv(open);
  check('without a session there is no mark to keep', markPath({ hook_event_name: 'Stop' }, anonymous) === null);
  check('an event without a session still speaks', !!notice({ hook_event_name: 'Stop' }, R, anonymous, CTX()));

  // The host's own scratch directory wins over the temporary one, and the two paths differ.
  check(
    'the scratchpad of the event is where the mark goes',
    markPath(stop({ scratchpad_dir: 'C:/Temp/scratch' }), session) === join('C:/Temp/scratch', 'daiku-stop-advice.json')
  );
  check(
    'without a scratchpad the mark is keyed by the session id',
    markPath(stop(), session) === join('C:/Temp/daiku', 'daiku-stop-advice', 'sess-1.json')
  );

  // A mark that cannot be written or read never silences the notice.
  const brokenMark = fakeEnv(open);
  const readable = brokenMark.read;
  brokenMark.write = () => {
    throw new Error('read-only');
  };
  brokenMark.read = (p) => {
    if (String(p).includes('daiku-stop-advice')) throw new Error('unreadable mark');
    return readable(p);
  };
  check('an unwritable mark still lets the notice out', !!notice(stop(), R, brokenMark, CTX()));

  // A closed ledger is no notice, mark or no mark: nothing is announced, so nothing is remembered.
  const noLedger = fakeEnv({ [`${STATE}/review-ledger-abc1234-120000.json`]: CLOSED_LEDGER });
  check('nothing open: silence', notice(stop(), R, noLedger, CTX()) === null);
  check(
    'nothing open: no mark written either',
    noLedger.exists(join('C:/Temp/daiku', 'daiku-stop-advice', 'sess-1.json')) === false
  );

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

/** The event on stdin, or `null` when there is none to read. */
async function readEvent() {
  if (process.stdin.isTTY) return null;
  const pieces = [];
  for await (const piece of process.stdin) pieces.push(piece);
  const raw = Buffer.concat(pieces).toString('utf-8');
  if (!raw.trim()) return null;
  try {
    const event = JSON.parse(raw);
    return event && typeof event === 'object' && !Array.isArray(event) ? event : null;
  } catch {
    return null;
  }
}

async function main() {
  // No parsable event, no notice: without the input this hook cannot know whether the stop
  // it is handling is already a continuation, and guessing there is what loops.
  const event = await readEvent();
  if (!event) return;
  const text = notice(event, ROOT, REAL_ENV, loadContext(ROOT, REAL_READS));
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
  main().catch(() => process.exit(0));
}
