#!/usr/bin/env node
/**
 * Stop notice — Stop.
 *
 * It says at session end the two things whoever stops **cannot see from the
 * transcript tail**: a review cycle that died with its ledger open, and a session that changed
 * code and left the memory corpus untouched.
 *
 * **The first — a cycle left open.** A cycle
 * interrupted with `outcome` still `null` restarts from zero unless the ledger is
 * handed over — and with the anchors of the applied gone, `on_previous_fix` and
 * `oscillation` run against another feature's history. This notice lists those
 * ledgers with their `base` and `item`, so the session resumes from there instead
 * of reopening the diff blind.
 *
 * What counts as open is defined once, in `skills/review/SKILL.md`
 * § *Baseline and ledger*: a ledger whose `outcome` is `null`, and which no
 * `<ledger>.abandoned` beside it has set aside. This hook reads that definition and
 * nothing else — it does not decide what a review is.
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
 * **An open ledger is not a stopped cycle, and a stopped cycle is not this session's.**
 * `outcome: null` is the state of *every* cycle in flight — `outcome`, `coverage`, `gate` and
 * `gate_detail` stay `null` until the step that writes them, and that step is the exit — and
 * the state folder of a project is shared by every session open in it. Three questions decide
 * what this session hears, and each of them is asked of a different seat.
 *
 *  - **Is it still running?** A cycle writes nothing between one step and the next: the round
 *    of 2 October 2026 — four finders and an applier on a whole diff — took twenty-three
 *    minutes without a single write, and the ledger is rewritten only when the round closes.
 *    A ledger is **quiet** when neither it nor a round file beside it has been written for
 *    `QUIET_MS`, and only a quiet ledger is one the cycle left behind. A running cycle is not
 *    announced at all: there is nothing to tell a reader about work somebody is doing.
 *  - **Can this session act on it?** The trace the host hands the event (`transcript_path`) is
 *    read for the work the session really did: only its `tool_use` blocks, and inside them
 *    only the keys that carry a path. A trace quotes far more than that — file contents, tool
 *    results, the `git status` of the project at session start — and a folder named inside a
 *    document the session wrote is not a folder the session worked in. A ledger is this
 *    session's when the session touched its `item` or, on a review launched by hand on a bare
 *    base-ref where `item` is `null`, one of its `scope_files`.
 *  - **What if there is no trace?** Some hosts hand the hook none. The notice is then
 *    **silent**: which session a ledger belongs to would be a guess, and a guess is worth
 *    less than silence, exactly as an undeclared state folder is.
 *
 * **A dead ledger has a resting place, and it is not the bin.** Where the work is dead, the
 * ledger is set aside: an empty file named `<ledger>.abandoned`, beside it in the state
 * folder, keeps the ledger readable as evidence and takes it off the open roll. Deleting it
 * throws away the anchors the next review would have read; the marker keeps them and stops
 * the notice.
 *
 * **The second — a corpus left behind.** It speaks when the session **changed code and never
 * touched the memory**: at least one write under `{code_root}`, none under `{memory.root}`, and no
 * `git commit` run in the session. The memory is written by the session that changes something,
 * not only by the commit that closes it, and a modification that ends before the corpus has been
 * realigned is a modification not finished — so an omission nobody can see from the tail is
 * exactly what a stop has to say.
 *
 * It is a **state report and not an accusation**: it says the pass has not run here, not that the
 * corpus is wrong, and it carries how it is answered — where nothing the corpus holds has become
 * false, there is nothing to write and the pass is a look that confirms it.
 *
 * A commit silences it, and that is no loophole: in a project that declared `{paths.review_state}`
 * the guard admits `git commit` only inside a review cycle, and the cycle delegates
 * `update-memory` on the same diff — where it writes, the corpus moves and this notice is silent
 * by its own reading. Two perimeters keep it honest, and both are declarations of the project:
 * **writes under `.daiku/` are not code** — the working folders, the studies, the policies and the
 * domain files are the method's seats, and a session that wrote them has changed no product — and
 * **only a write counts, never a read**: the four tools that change a file are `Edit`, `Write`,
 * `MultiEdit` and `NotebookEdit`, and a path quoted inside a document the session read is not a
 * path it touched. Undeclared `{code_root}` or `{memory.root}`: no notice, as everywhere else —
 * §6 of `contracts/project-contract.md`.
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
 *  - **the mark of the session**: the set announced — the ledgers, and whether the corpus notice
 *    went out — reduced to a comparison and written where the host keeps the session's own scratch
 *    files (`scratchpad_dir` of the event, or the OS temporary directory keyed by `session_id`
 *    where the host has none). The same set is never announced twice, so a notice arrives **once
 *    per session** instead of once per stop — and a host reporting `stop_hook_active` wrongly does
 *    not send it in a loop. The mark is the **set**, never the text: the text carries how long ago
 *    the ledger was last written, and a mark carrying it would call every passing hour a piece of
 *    news.
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
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { invokedDirectly, projectRoot } from './project-root.mjs';
import { REAL_READS, loadContext, fakeContext, isInside } from './daiku-config.mjs';

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
 * How still a ledger must stand before the cycle that opened it is read as gone.
 *
 * Two hours is a ceiling, not a guess: a cycle writes at the close of every step, and the
 * longest step measured — a whole-diff round, four finders and an applier, on 2 October 2026 —
 * took twenty-three minutes. A window an order of magnitude above that is a cycle nobody is
 * running, and erring long costs nothing here: the notice is about work to hand over, not an
 * alarm to answer now.
 */
const QUIET_MS = 2 * 60 * 60 * 1000;

/** What a ledger is set aside under: an empty `<ledger>.json.abandoned` beside it. */
const ABANDONED = '.abandoned';

/**
 * Where a `tool_use` block keeps the paths it touches. Only these keys are read, and only on
 * the session's own acts: the rest of a trace is quotation — file contents, tool results, the
 * project's `git status` at session start — and a path quoted in it was not worked in.
 * `command` is the shell's own text, so it matches where a path is named inside the command.
 */
const TOUCHED_KEYS = ['file_path', 'notebook_path', 'path', 'command'];

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

/** A path as it is compared: Windows and JSON escaping out of the way, case folded. */
function norm(value) {
  return String(value).replace(/\\+/g, '/').toLowerCase();
}

/** When the file was written, or `null` where there is no clock to ask. */
function seenAt(env, path) {
  try {
    const seen = typeof env.stat === 'function' ? env.stat(path) : null;
    return seen && typeof seen.mtimeMs === 'number' ? seen.mtimeMs : null;
  } catch {
    return null;
  }
}

/**
 * The cycle's last sign of life: the newest write among the ledger and the arithmetical files
 * sharing its stem. The ledger itself is rewritten only when a step closes, so a round in
 * flight leaves its own file beside it — `findingsPath` of `architect/ledger.mjs` — and the
 * ledger alone would read as still for as long as the longest step runs.
 */
function lastWrite(reviewState, name, names, env) {
  const stem = name.slice(0, -'.json'.length);
  let newest = null;
  for (const other of names) {
    if (other !== name && !other.startsWith(`${stem}.`)) continue;
    const mtime = seenAt(env, join(reviewState, other));
    if (mtime !== null && (newest === null || mtime > newest)) newest = mtime;
  }
  return newest;
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
  stat: (path) => {
    try {
      return { mtimeMs: statSync(path).mtimeMs };
    } catch {
      return null;
    }
  },
  tmpdir: () => tmpdir(),
  now: () => Date.now(),
  write: (path, text) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, 'utf-8');
  },
};

/**
 * The ledgers in the state folder: every file carrying the ledger's own form, with the work it
 * names, its blocking count, the instant it last moved, and the two fields saying where the cycle
 * stood when it stopped — `outcome`, and the gate it reached.
 *
 * Exported because two readers ask different questions of the same files and must agree on what a
 * ledger **is**: the Stop notice wants the ones still open, and the review guard of
 * `command-guard.mjs` wants the ones a commit may close — which include a cycle that has just
 * exited with a green gate, the exact state in which the review's own commit runs. `openLedgers`
 * below is the first of the two questions, and nothing else.
 *
 * **A seat that does not answer is left to the caller.** Where the state folder cannot be read
 * this **throws**, and each reader answers it in its own way: the Stop notice stays silent, its
 * contract being fail-open *and* silent, and the review guard allows the commit. Folding the
 * non-answer into the empty list would tell the guard that a seat it could not read holds no
 * cycle — and a commit would be denied over a folder nobody could open.
 */
export function ledgers(reviewState, env) {
  const found = [];
  const names = env.list(reviewState); // a seat that does not answer throws: see above
  const sorted = [...names].sort();
  for (const name of sorted) {
    if (!name.endsWith('.json')) continue;
    let ledger;
    try {
      ledger = JSON.parse(env.read(join(reviewState, name)));
    } catch {
      continue; // an unreadable ledger is not ours to judge
    }
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) continue;
    if (!isLedger(ledger)) continue; // another tool's file, or a findings file: not a ledger
    try {
      if (env.exists(join(reviewState, name + ABANDONED))) continue; // set aside: not a cycle
    } catch {
      /* an unanswerable seat is not a declaration: the ledger stays */
    }
    const item = typeof ledger.item === 'string' && ledger.item.trim() ? ledger.item.trim() : null;
    const files = Array.isArray(ledger.scope_files)
      ? ledger.scope_files.filter((file) => typeof file === 'string' && file.trim())
      : [];
    found.push({
      file: name,
      base: typeof ledger.base === 'string' && ledger.base ? ledger.base : '?',
      item: item || '?',
      work: item,
      scope_files: files,
      blocking: blockingItems(ledger),
      outcome: typeof ledger.outcome === 'string' ? ledger.outcome : null,
      gate: typeof ledger.gate === 'string' ? ledger.gate : null,
      lastWrite: lastWrite(reviewState, name, sorted, env),
    });
  }
  return found;
}

/**
 * Ledgers left open: `outcome` still `null`, no `.abandoned` beside them, each with the work it
 * names, its blocking count and the instant it last moved.
 */
export function openLedgers(reviewState, env) {
  return ledgers(reviewState, env).filter((entry) => entry.outcome === null);
}

/** Is the cycle still at work? A write inside the quiet window — or no clock to say it is not.
 *
 * Exported, and with the window as an argument, because the review guard of `command-guard.mjs`
 * asks two questions of the same ledgers and they are not the same question: whether a cycle is
 * **alive** (the quiet window, the Stop notice's question too) and whether a commit standing here
 * is the one a cycle that has just exited decided on (a much shorter one). One function, two
 * windows, and `QUIET_MS` stays the default. */
export function running(entry, now, window = QUIET_MS) {
  return entry.lastWrite !== null && now - entry.lastWrite < window;
}

/** Every `tool_use` block of one parsed trace line, wherever it sits in it. */
function callsIn(value) {
  const found = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node.type === 'tool_use' && node.input && typeof node.input === 'object') found.push(node);
    for (const key of Object.keys(node)) walk(node[key]);
  };
  walk(value);
  return found;
}

/** Did this trace line carry a call that worked inside one of the patterns? */
function lineTouches(line, patterns) {
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    return false;
  }
  for (const call of callsIn(entry)) {
    for (const key of TOUCHED_KEYS) {
      const value = call.input[key];
      if (typeof value !== 'string' || !value.trim()) continue;
      const candidate = norm(value);
      for (const pattern of patterns) {
        if (pattern.under ? candidate.includes(pattern.value) : candidate.endsWith(pattern.value)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Did this session work on the ledger? Under `item` when the ledger names a work folder; on one
 * of the `scope_files` when it does not — a review launched by hand on a bare base-ref names no
 * folder, and its files are the only sign of whose it is. Neither: no sign at all, and no sign
 * is silence.
 */
function touched(entry, transcript) {
  const patterns = [];
  if (entry.work) {
    patterns.push({ value: norm(entry.work), under: true });
  } else {
    for (const file of entry.scope_files) patterns.push({ value: norm(file), under: false });
  }
  if (!patterns.length) return false;
  for (const line of String(transcript).split('\n')) {
    if (!line.includes('"tool_use"')) continue; // the trace's own acts, not what it quotes
    const flat = norm(line);
    if (!patterns.some((pattern) => flat.includes(pattern.value))) continue;
    if (lineTouches(line, patterns)) return true;
  }
  return false;
}

// --- the corpus, and what this session did to it -------------------------------

/**
 * The four tools that change a file. A read is not a modification, and neither is a shell line
 * that only names a path: the trace carries both, and this notice watches the first alone.
 */
const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/** The path a write call names: `file_path` for the three, `notebook_path` for a notebook. */
function writtenPath(call) {
  for (const key of ['file_path', 'notebook_path']) {
    const value = call.input[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/**
 * What the trace shows the session **modifying**: the code paths it wrote, the memory paths it
 * wrote, and whether a commit ran.
 *
 * `seats` carries the three seats resolved from `.daiku/project.json`: `codeRoot`, `memoryRoot`,
 * and `ownSeat`, the `.daiku/` folder. A write under the last one is no code: the working folders,
 * the studies, the policies and the domain files are the method's own seats, and a session that
 * wrote them has changed no product. A write under the memory is its own list, and both lists are
 * read the same way — by `isInside`, which folds the Windows separators and the case.
 */
export function modifications(transcript, seats) {
  const code = [];
  const memory = [];
  let committed = false;
  for (const line of String(transcript).split('\n')) {
    if (!line.includes('"tool_use"')) continue; // the trace's own acts, not what it quotes
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    for (const call of callsIn(entry)) {
      const name = typeof call.name === 'string' ? call.name : '';
      if (WRITE_TOOLS.has(name)) {
        const path = writtenPath(call);
        if (!path) continue;
        if (seats.memoryRoot && isInside(path, seats.memoryRoot)) memory.push(path);
        else if (
          seats.codeRoot &&
          isInside(path, seats.codeRoot) &&
          !(seats.ownSeat && isInside(path, seats.ownSeat))
        )
          code.push(path);
        continue;
      }
      const command = call.input.command;
      if (typeof command === 'string' && /\bgit\s+commit\b/.test(command)) committed = true;
    }
  }
  return { code, memory, committed };
}

/**
 * Did this session change code and leave the memory untouched? `null` when it did not — nothing
 * was written, the memory moved, or a commit ran, which in a project declaring
 * `{paths.review_state}` means the cycle delegated `update-memory` on the same diff. Otherwise the
 * number of code paths it wrote, which is what the notice's own sentence says.
 */
export function corpusBehind(transcript, seats) {
  const seen = modifications(transcript, seats);
  if (seen.committed || !seen.code.length || seen.memory.length) return null;
  return seen.code.length;
}

/** A path as the notice prints it: the separators of the JSON, in every shell. */
function slashy(path) {
  return String(path).replace(/\\/g, '/');
}

/** The corpus notice: what was seen, the rule, and how it is answered. */
function renderCorpus(count, seats) {
  const files = `${count} file${count === 1 ? '' : 's'}`;
  return (
    `The memory corpus was not touched in this session, and code was: ${files} written under ` +
    `\`${slashy(seats.codeRoot)}\`, none under \`${slashy(seats.memoryRoot)}\`.\n\n` +
    `The corpus is aligned by the work that changes something, not only by the commit that closes ` +
    `it: a memory, a policy, the instructions file or a reference that a modification has made ` +
    `false is corrected in the same work, and the alignment is not a judgement on whether the diff ` +
    `deserves it. Nothing here says the corpus is wrong — it says the pass that would know has not ` +
    `run in this session. Where nothing it holds has become false, there is nothing to write and ` +
    `this notice is already answered.\n\n` +
    `*Daiku status notice, written at the end of the turn — not a message from the user, and ` +
    `nothing being worked on has to change. It is delivered once per session, and returns in a ` +
    `later one that goes back to the same work.*`
  );
}

/**
 * The corpus notice for this stop, or `null`. Undeclared `{code_root}` or `{memory.root}`: nothing
 * to compare, and silence — §6 of `contracts/project-contract.md`. No trace, or an unreadable one:
 * silence too, as for the ledgers, because what the session did would be a guess.
 */
function corpusNotice(root, env, ctx, site) {
  if (!ctx || !ctx.present || !ctx.codeRoot || !ctx.memoryRoot) return null;
  const trace = site && typeof site.transcript === 'string' ? site.transcript : '';
  if (!trace) return null;
  let transcript;
  try {
    transcript = env.read(trace);
  } catch {
    return null;
  }
  const seats = {
    codeRoot: ctx.codeRoot,
    memoryRoot: ctx.memoryRoot,
    ownSeat: join(root, '.daiku'),
  };
  const count = corpusBehind(transcript, seats);
  return count ? renderCorpus(count, seats) : null;
}

/** The instant the notice is written at: the environment's clock, or the machine's. */
function instant(env) {
  try {
    if (typeof env.now === 'function') return env.now();
  } catch {
    /* fall through to the machine's clock */
  }
  return Date.now();
}

/**
 * The open ledgers this session may be told about: quiet, and worked in by it. Everything else
 * is silence — a cycle still running has nothing to say, and a ledger of another session is not
 * this reader's to resume or to throw away.
 */
export function announceable(root, env, ctx, site = {}) {
  if (!ctx || !ctx.present || !ctx.reviewState) return [];
  const now = instant(env);
  let quiet;
  try {
    quiet = openLedgers(ctx.reviewState, env).filter((entry) => !running(entry, now));
  } catch {
    return []; // a seat that does not answer: silence, as for a folder that is not there
  }
  if (!quiet.length) return [];
  const trace = typeof site.transcript === 'string' ? site.transcript.trim() : '';
  if (!trace) return []; // no trace: whose ledger this is would be a guess
  let transcript;
  try {
    transcript = env.read(trace);
  } catch {
    return []; // an unreadable trace is no trace
  }
  return quiet.filter((entry) => touched(entry, transcript));
}

/** How long ago, in the reader's words. */
function ago(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 120) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

/** The notice itself: the ledgers, what a ledger is for, and where a dead one is set aside. */
function render(entries, now) {
  const listing = entries
    .map((entry) => {
      const age =
        entry.lastWrite === null ? '' : `, last written ${ago(now - entry.lastWrite)} ago`;
      return (
        `- \`${entry.item}\` (base \`${entry.base}\`, ledger \`${entry.file}\`)` +
        (entry.blocking ? ` — ${entry.blocking} blocking item${entry.blocking === 1 ? '' : 's'}` : '') +
        age
      );
    })
    .join('\n');
  const single = entries.length === 1;
  return (
    `${single ? 'One review ledger is' : `${entries.length} review ledgers are`} still open — ` +
    `left by a review cycle that never wrote its outcome, and nothing has written to ` +
    `${single ? 'it' : 'them'} since.\n\n` +
    `${listing}\n\n` +
    `A ledger is what a review resumes from: reopened from the diff alone instead of from ` +
    `the same base and item, it loses the anchors every later signal is measured on. Where ` +
    `the work is dead instead, the ledger is set aside: an empty \`<ledger>.json.abandoned\` ` +
    `beside it keeps the ledger as evidence and takes it off this notice.\n\n` +
    `*Daiku status notice, written at the end of the turn — not a message from the user, and ` +
    `nothing being worked on has to change. It is delivered once per session, and returns in a ` +
    `later one that goes back to the same work while a ledger stays open.*`
  );
}

/**
 * Both notices of this stop: the text as the reader sees it, and the set it speaks about reduced
 * to the comparison the mark keeps. The two are built together because they are two views of the
 * same reading — what this session did, and what it left behind.
 */
function notices(root, env, ctx, site) {
  const entries = announceable(root, env, ctx, site);
  const corpus = corpusNotice(root, env, ctx, site);
  const parts = [];
  if (entries.length) parts.push(render(entries, instant(env)));
  if (corpus) parts.push(corpus);
  return {
    text: parts.length ? parts.join('\n\n---\n\n') : null,
    // The set, never the text: the ledger notice carries how long ago its ledger moved, so a mark
    // over the text would call each passing hour a piece of news.
    fingerprint: digest(
      [entries.length ? announcedSet(entries) : '', corpus ? 'corpus' : ''].filter(Boolean).join('\n')
    ),
  };
}

export function advice(root, env, ctx, site) {
  return notices(root, env, ctx, site).text;
}

// --- the mark of the session ---------------------------------------------------

/** The digest of what was announced: the set itself, reduced to a comparison. */
function digest(text) {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * The set announced, as the mark keeps it. Never the text: the text carries how long ago the
 * ledger was last written, so a mark over it would call each passing hour a new piece of news
 * and speak again — in the session that already heard it.
 */
function announcedSet(entries) {
  return digest(
    entries.map((entry) => `${entry.file}|${entry.base}|${entry.item}|${entry.blocking}`).join('\n')
  );
}

/**
 * Where the mark goes: the session's own scratch directory — the `scratchpad_dir` the host
 * gives the event, or, where it gives none, the OS temporary directory under the
 * `session_id`. `null` when the event carries neither, and then the mark is simply not
 * written: silence is the fallback, never a guess at a shared path.
 *
 * **Never the project.** The six hooks write nothing inside the repository; a folder of
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
 * decision — reading the input, the `stop_hook_active` guard, the trace the host hands it,
 * the mark of the session — and it lives here, without leaving the process, so the bench
 * calls it.
 */
export function notice(event, root, env, ctx) {
  if (event && event.stop_hook_active === true) return null; // already a continuation: silence
  const trace = event && typeof event.transcript_path === 'string' ? event.transcript_path.trim() : '';
  const site = { transcript: trace || null };
  const { text, fingerprint } = notices(root, env, ctx, site);
  if (!text) return null;
  const path = markPath(event || {}, env);
  if (announced(env, path) === fingerprint) return null; // this session already heard this set
  markAnnounced(env, path, fingerprint);
  return text;
}

// --- test bench -----------------------------------------------------------

/** A fixed instant, so that "quiet" is a fixture of the bench and not a reading of the clock. */
const NOW = 1_800_000_000_000;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * A simulated environment: a path → content map, files only, each with a write time. What the
 * hook writes lands in the same map, so a second call sees the mark the first one left. Files
 * are `QUIET_MS` old unless the case says otherwise — the notice's normal ground is a cycle
 * that stopped hours ago.
 */
function fakeEnv(files, options = {}) {
  const key = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const tmp = options.tmp || 'C:/Temp/daiku';
  const still = options.mtime === undefined ? NOW - 3 * HOUR : options.mtime;
  const times = new Map(Object.entries(options.times || {}).map(([k, v]) => [key(k), v]));
  const map = new Map(Object.entries(files).map(([k, v]) => [key(k), v]));
  let clock = NOW;
  return {
    tmpdir: () => tmp,
    now: () => clock,
    // Time passes inside a case, so that what the notice says about it can be watched moving.
    advance: (ms) => {
      clock += ms;
    },
    write: (p, text) => {
      map.set(key(p), text);
    },
    exists: (p) => map.has(key(p)) || [...map.keys()].some((path) => path.startsWith(key(p) + '/')),
    read: (p) => {
      if (!map.has(key(p))) throw new Error(`ENOENT ${p}`);
      return map.get(key(p));
    },
    stat: (p) => (map.has(key(p)) ? { mtimeMs: times.has(key(p)) ? times.get(key(p)) : still } : null),
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

/** A ledger of a review launched by hand on a bare base-ref: it names no work folder. */
const HAND_LEDGER = JSON.stringify({
  base: 'abc1234',
  item: null,
  scope_tree: TREE,
  scope_files: ['src/hot/query.ts'],
  rounds: [round([])],
  outcome: null,
  coverage: null,
  gate: null,
  gate_detail: null,
});

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

const TRACE = `${R}/.claude/trace.jsonl`;

/** A trace line for a call that worked on a file, as the host writes one. */
const call = (name, input) =>
  JSON.stringify({
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'tool_use', name, input }] },
  });

const read = (path) => call('Read', { file_path: `${R}/${path}` });

/** A trace line for a call that changes a file, and one for a shell line. */
const write = (path) => call('Write', { file_path: `${R}/${path}`, content: 'x' });
const shell = (command) => call('Bash', { command });

/**
 * The session's trace by default: one that worked on the three work folders the fixtures below
 * name. A case that needs another session passes its own through `transcript`.
 */
const TRACE_TEXT = [
  read('docs/new-developments/gamma/1. decision-doc.md'),
  read('docs/new-developments/delta/1. decision-doc.md'),
  read('docs/new-developments/beta/1. decision-doc.md'),
].join('\n');

/** The environment of a case: the fixtures, and the trace the host would have handed the hook. */
const env = (files = {}, options = {}) => {
  const transcript = options.transcript === undefined ? TRACE_TEXT : options.transcript;
  const seeded = transcript === null ? { ...files } : { [TRACE]: transcript, ...files };
  return fakeEnv(seeded, options);
};

/** The site of a stop: what the host hands the hook, minus the mark's own fields. */
const SITE = { transcript: TRACE };
const stop = (extra = {}) => ({
  hook_event_name: 'Stop',
  session_id: 'sess-1',
  transcript_path: TRACE,
  ...extra,
});

function selfCheck() {
  const failed = [];
  let ran = 0;
  const check = (name, condition) => {
    ran += 1;
    if (!condition) failed.push(name);
  };

  check('project without Daiku: silence', advice(R, env(), CTX_ABSENT, SITE) === null);
  check('context missing entirely: silence', advice(R, env(), undefined, SITE) === null);
  check('no review state declared: silence', advice(R, env(), CTX_NO_STATE, SITE) === null);
  check('missing state folder: silence', advice(R, env(), CTX(), SITE) === null);

  const closed = { [`${STATE}/review-ledger-abc1234-120000.json`]: CLOSED_LEDGER };
  check('landed ledger: silence', advice(R, env(closed), CTX(), SITE) === null);

  const open = { [`${STATE}/review-ledger-abc1234-120000.json`]: OPEN_LEDGER };
  const textOpen = advice(R, env(open), CTX(), SITE);
  check('open ledger: warning', !!textOpen && textOpen.includes('gamma'));
  check('the warning names base and ledger file', !!textOpen && textOpen.includes('abc1234') && textOpen.includes('review-ledger-abc1234-120000.json'));
  check('the warning counts the blocking items', !!textOpen && textOpen.includes('1 blocking item'));
  check('the warning says a review resumes from the ledger', !!textOpen && textOpen.includes('resumes from'));
  check('the warning says where a dead ledger is set aside', !!textOpen && textOpen.includes('.abandoned'));
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
  // The claim is about a cycle nobody is running, so the notice carries the evidence for it:
  // how long the ledger has stood still.
  check('the warning says how long the ledger has stood still', !!textOpen && textOpen.includes('last written 3 hours ago'));

  const two = {
    [`${STATE}/review-ledger-abc1234-120000.json`]: OPEN_LEDGER,
    [`${STATE}/review-ledger-def5678-121500.json`]: OPEN_LEDGER.replace('abc1234', 'def5678').replace('gamma', 'delta'),
  };
  const textTwo = advice(R, env(two), CTX(), SITE);
  check('two ledgers: both listed', !!textTwo && textTwo.includes('gamma') && textTwo.includes('delta'));
  check('two ledgers agree in the plural', !!textTwo && textTwo.includes('2 review ledgers are'));
  check('and the sentence after the count is plural too', !!textTwo && textTwo.includes('written to them since'));

  const malformed = { [`${STATE}/review-ledger-abc1234-120000.json`]: '{not json' };
  check('an unreadable ledger is skipped in silence', advice(R, env(malformed), CTX(), SITE) === null);

  const fresh = { [`${STATE}/review-ledger-abc1234-120000.json`]: FRESH_LEDGER };
  const textFresh = advice(R, env(fresh), CTX(), SITE);
  check('a ledger just opened by the scope is open', !!textFresh && textFresh.includes('beta'));

  const nonJson = { [`${STATE}/notes.txt`]: 'hello' };
  check('non-ledger files are ignored', advice(R, env(nonJson), CTX(), SITE) === null);

  // --- the files that are not ours -------------------------------------------
  // `init` proposes `paths.review_state` from what the repository already keeps, and a project
  // that reviewed before Daiku has its own ledger folder: another tool's keys, the same file
  // names. Those files came back as open cycles at every stop, and the notice spoke forever.
  const foreign = { [`${STATE}/review-ledger-035f906-203614.json`]: FOREIGN_LEDGER };
  check("another tool's ledger is not ours to judge", advice(R, env(foreign), CTX(), SITE) === null);

  const findings = { [`${STATE}/review-ledger-abc1234-120000.round-1.findings.json`]: FINDINGS };
  check('a findings file is not a ledger', advice(R, env(findings), CTX(), SITE) === null);

  // A closed review leaves its ledger *and* its findings files behind for good: neither may
  // reopen the notice.
  const spent = {
    [`${STATE}/review-ledger-abc1234-120000.json`]: CLOSED_LEDGER,
    [`${STATE}/review-ledger-abc1234-120000.round-1.findings.json`]: FINDINGS,
  };
  check('a review that landed leaves nothing open', advice(R, env(spent), CTX(), SITE) === null);

  // An interrupted one leaves both open files: only the ledger is listed, once.
  const interrupted = {
    [`${STATE}/review-ledger-abc1234-120000.json`]: OPEN_LEDGER,
    [`${STATE}/review-ledger-abc1234-120000.round-1.findings.json`]: FINDINGS,
  };
  const textInterrupted = advice(R, env(interrupted), CTX(), SITE);
  check('an interrupted review is listed once, its findings file beside it', !!textInterrupted && textInterrupted.includes('One review ledger is'));

  // --- a cycle that is running is not a cycle that died ------------------------
  // `outcome: null` is the state of every cycle in flight. A write inside the quiet window is a
  // cycle at work, and the notice has nothing to say about work somebody is doing.
  const runningLedger = { [`${STATE}/review-ledger-abc1234-120000.json`]: OPEN_LEDGER };
  check(
    'a ledger written a minute ago is a cycle at work: silence',
    advice(R, env(runningLedger, { mtime: NOW - MINUTE }), CTX(), SITE) === null
  );
  check(
    'a ledger standing exactly on the quiet threshold is not running',
    !!advice(R, env(runningLedger, { mtime: NOW - 2 * HOUR }), CTX(), SITE)
  );
  // The ledger is rewritten only when a step closes: a round in flight leaves its own file
  // beside it, and that file is the sign of life the ledger alone would not carry.
  check(
    'a round file written a minute ago keeps the ledger running',
    advice(
      R,
      env(
        {
          ...runningLedger,
          [`${STATE}/review-ledger-abc1234-120000.round-1.findings.json`]: FINDINGS,
        },
        { mtime: NOW - 3 * HOUR, times: { [`${STATE}/review-ledger-abc1234-120000.round-1.findings.json`]: NOW - MINUTE } }
      ),
      CTX(),
      SITE
    ) === null
  );

  // --- the ledger of another session is not this session's --------------------
  // The trace tells who worked where. A chat on another folder is not told about a ledger it
  // never touched — the case that put a running cycle in front of a reader with nothing to do
  // with it.
  check(
    'a ledger of work this session never touched: silence',
    advice(R, env(open, { transcript: read('docs/other/1. decision-doc.md') }), CTX(), SITE) === null
  );
  // What the trace *quotes* is not what the session worked in. A session that writes a document
  // naming another feature has a `tool_use` in its trace whose only path is its own file: the
  // name is in the content, and content is not a place the session worked.
  check(
    'a call that only writes a document naming the folder does not count',
    advice(
      R,
      env(open, {
        transcript: call('Write', {
          file_path: `${R}/docs/tickets/gamma-ledger.md`,
          content: 'the ledger of docs/new-developments/gamma is still open',
        }),
      }),
      CTX(),
      SITE
    ) === null
  );
  // The same call, with its path inside the folder: that is work, and the notice speaks.
  check(
    'a call that wrote inside the folder counts as working in it',
    !!advice(
      R,
      env(open, {
        transcript: call('Write', {
          file_path: `${R}/docs/new-developments/gamma/1. decision-doc.md`,
          content: 'x',
        }),
      }),
      CTX(),
      SITE
    )
  );
  // And what the host itself quotes: the git status at session start names every folder in
  // flight, in a line that is no tool call at all.
  check(
    'a trace that merely quotes the folder does not count as working in it',
    advice(
      R,
      env(open, {
        transcript: JSON.stringify({
          type: 'attachment',
          attachment: { type: 'session_context', context: { gitStatus: 'D "docs/new-developments/gamma/0. problem.md"' } },
        }),
      }),
      CTX(),
      SITE
    ) === null
  );
  // A host that hands the hook no trace leaves it unable to tell whose ledger it holds.
  check('a stop with no trace: silence', advice(R, env(open), CTX(), {}) === null);
  check('a trace that cannot be read: silence', advice(R, env(open, { transcript: null }), CTX(), SITE) === null);

  // A review launched by hand on a bare base-ref names no work folder: its files are the only
  // sign of whose it is.
  const hand = { [`${STATE}/review-ledger-abc1234-120000.json`]: HAND_LEDGER };
  check(
    'a ledger without item speaks to the session that touched its files',
    !!advice(R, env(hand, { transcript: read('src/hot/query.ts') }), CTX(), SITE)
  );
  check(
    'a ledger without item, and no file of its touched: silence',
    advice(R, env(hand, { transcript: read('docs/other/1. decision-doc.md') }), CTX(), SITE) === null
  );

  // --- the resting place of a dead ledger -------------------------------------
  // The work is dead and the ledger is worth keeping: an empty marker beside it takes it off the
  // open roll without throwing the file away.
  const laid = {
    [`${STATE}/review-ledger-abc1234-120000.json`]: OPEN_LEDGER,
    [`${STATE}/review-ledger-abc1234-120000.json.abandoned`]: '',
  };
  check('a ledger set aside is no longer open: silence', advice(R, env(laid), CTX(), SITE) === null);

  // --- one notice per session, and never on a continuation ---------------------
  // Speaking at a stop continues the turn: the same notice at every stop loops until the
  // harness overrides the hook. These are the two guards, and each one alone is enough.
  check(
    'a stop the hook itself caused: silence',
    notice(stop({ stop_hook_active: true }), R, env(open), CTX()) === null
  );
  check(
    '`stop_hook_active: false` is a fresh stop, not a continuation',
    !!notice(stop({ stop_hook_active: false }), R, env(open), CTX())
  );

  const session = env(open);
  check('the first stop of a session speaks', !!notice(stop(), R, session, CTX()));
  check('the same session hears it once', notice(stop(), R, session, CTX()) === null);
  check('a third stop stays silent too', notice(stop(), R, session, CTX()) === null);
  check(
    'another session hears it again',
    !!notice(stop({ session_id: 'sess-2' }), R, session, CTX())
  );

  // The mark is the set, so a set that moved is said again: a review that lands while another
  // stays open is news, and stays news once. The text is not the mark, so the passing of the
  // clock is not news.
  const moving = env(two);
  check('a first set speaks', !!notice(stop(), R, moving, CTX()));
  check('the same set does not repeat', notice(stop(), R, moving, CTX()) === null);
  moving.write(`${STATE}/review-ledger-abc1234-120000.json`, CLOSED_LEDGER);
  const afterOneLanded = notice(stop(), R, moving, CTX());
  check(
    'a set that changed speaks again',
    !!afterOneLanded && afterOneLanded.includes('One review ledger is')
  );
  check('and the new set is not repeated either', notice(stop(), R, moving, CTX()) === null);

  const older = env(open, { mtime: NOW - 5 * DAY });
  const textOlder = notice(stop(), R, older, CTX());
  check('a ledger that stood still for days speaks', !!textOlder && textOlder.includes('5 days ago'));
  older.advance(3 * DAY);
  check(
    'the ledger it speaks about has aged, and the notice would say so',
    !!advice(R, older, CTX(), SITE) && advice(R, older, CTX(), SITE).includes('8 days ago')
  );
  check('but the passing clock is not news: the same session stays silent', notice(stop(), R, older, CTX()) === null);

  // No session to mark: the notice is not silenced across sessions by a shared path, and
  // `stop_hook_active` stays the only guard there.
  const anonymous = env(open);
  check('without a session there is no mark to keep', markPath({ hook_event_name: 'Stop' }, anonymous) === null);
  check(
    'an event without a session still speaks',
    !!notice({ hook_event_name: 'Stop', transcript_path: TRACE }, R, anonymous, CTX())
  );

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
  const brokenMark = env(open);
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
  const noLedger = env({ [`${STATE}/review-ledger-abc1234-120000.json`]: CLOSED_LEDGER });
  check('nothing open: silence', notice(stop(), R, noLedger, CTX()) === null);
  check(
    'nothing open: no mark written either',
    noLedger.exists(join('C:/Temp/daiku', 'daiku-stop-advice', 'sess-1.json')) === false
  );

  // A ledger of another session is not announced, so nothing is remembered about it either.
  const elsewhere = env(open, { transcript: read('docs/other/1. decision-doc.md') });
  check('another session\'s cycle: no notice', notice(stop(), R, elsewhere, CTX()) === null);

  // --- the corpus notice -------------------------------------------------------
  // The second thing a stop cannot see: a session that changed code and never touched the memory.
  // The trace is the only witness, and it is read the same way as for the ledgers.
  const CORPUS = () => fakeContext({ codeRoot: `${R}/src`, memoryRoot: `${R}/memory` });
  const codeWrite = write('src/a.ts');

  const textCorpus = advice(R, env({}, { transcript: codeWrite }), CORPUS(), SITE);
  check(
    'code written, memory untouched: the corpus notice speaks',
    !!textCorpus && textCorpus.includes('memory corpus was not touched')
  );
  check(
    'the notice names the two seats as the project declared them',
    !!textCorpus && textCorpus.includes(`${R}/src`) && textCorpus.includes(`${R}/memory`)
  );
  check('the notice counts the files it saw', !!textCorpus && textCorpus.includes('1 file written'));
  check(
    'the notice says the corpus is aligned by the work, not only by the commit',
    !!textCorpus && textCorpus.includes('not only by the commit')
  );
  check('the notice says how it is answered', !!textCorpus && textCorpus.includes('already answered'));
  check(
    'the corpus notice says it is not a message from the user',
    !!textCorpus && textCorpus.includes('not a message from the user')
  );
  check(
    'the corpus notice says it comes once per session',
    !!textCorpus && textCorpus.includes('once per session')
  );

  const twoWrites = [codeWrite, write('src/b.ts')].join('\n');
  check(
    'two files agree in the plural',
    (advice(R, env({}, { transcript: twoWrites }), CORPUS(), SITE) || '').includes('2 files written')
  );

  check(
    'a write to the memory alone: silence',
    advice(R, env({}, { transcript: write('memory/note.md') }), CORPUS(), SITE) === null
  );
  check(
    'a write to the memory beside the code: silence',
    advice(R, env({}, { transcript: [codeWrite, write('memory/note.md')].join('\n') }), CORPUS(), SITE) === null
  );
  // The method's own seats live under `.daiku/`, which may well sit inside the code root: a
  // session that wrote a blueprint has changed no product. The code root here is the repository
  // root itself, so `.daiku/` does sit inside it and this write reaches the `ownSeat` exclusion:
  // were that exclusion to vanish, the write would be counted as code and the assertion would go
  // red. It has its own context because the shared `CORPUS` keeps the code root at `${R}/src`,
  // where a `.daiku/` write is discarded by the code-root test, not by the exclusion.
  check(
    'a write under `.daiku/`: silence',
    advice(
      R,
      env({}, { transcript: write('.daiku/features/x/2. blueprint.md') }),
      fakeContext({ codeRoot: R, memoryRoot: `${R}/memory` }),
      SITE
    ) === null
  );
  check(
    'a write outside the code root: silence',
    advice(R, env({}, { transcript: write('docs/notes.md') }), CORPUS(), SITE) === null
  );
  // Only the four writing tools count: a read is not a modification, and neither is a path quoted
  // inside a command.
  check(
    'a read is not a modification: silence',
    advice(R, env({}, { transcript: read('src/a.ts') }), CORPUS(), SITE) === null
  );
  // A commit means the cycle ran, and the cycle delegates `update-memory` on the same diff.
  check(
    'a commit silences it: the cycle aligned the memory',
    advice(
      R,
      env({}, { transcript: [codeWrite, shell('git commit -m "x"')].join('\n') }),
      CORPUS(),
      SITE
    ) === null
  );
  check(
    'no `{code_root}` declared: silence',
    advice(R, env({}, { transcript: codeWrite }), fakeContext({ memoryRoot: `${R}/memory` }), SITE) === null
  );
  check(
    'no `{memory.root}` declared: silence',
    advice(R, env({}, { transcript: codeWrite }), fakeContext({ codeRoot: `${R}/src` }), SITE) === null
  );
  check('a corpus stop with no trace: silence', advice(R, env({}, { transcript: null }), CORPUS(), {}) === null);

  // The two notices are independent: an open ledger and an untouched corpus stand together, and
  // each is silent where the other speaks.
  const both = advice(
    R,
    env(
      { [`${STATE}/review-ledger-abc1234-120000.json`]: OPEN_LEDGER },
      { transcript: [read('docs/new-developments/gamma/1. decision-doc.md'), codeWrite].join('\n') }
    ),
    fakeContext({ reviewState: STATE, codeRoot: `${R}/src`, memoryRoot: `${R}/memory` }),
    SITE
  );
  check(
    'a ledger and a corpus: both notices in one text',
    !!both && both.includes('gamma') && both.includes('memory corpus was not touched')
  );

  const corpusSession = env({}, { transcript: codeWrite });
  check('the corpus notice reaches a stop', !!notice(stop(), R, corpusSession, CORPUS()));
  check(
    'and the same session does not hear it twice',
    notice(stop(), R, corpusSession, CORPUS()) === null
  );
  check(
    'another session hears it again',
    !!notice(stop({ session_id: 'sess-2' }), R, corpusSession, CORPUS())
  );
  check(
    'a stop the hook itself caused says nothing about the corpus either',
    notice(stop({ stop_hook_active: true }), R, env({}, { transcript: codeWrite }), CORPUS()) === null
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
  // it is handling is already a continuation, nor whose ledger it would be speaking about,
  // and guessing there is what loops.
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
