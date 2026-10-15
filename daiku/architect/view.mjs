#!/usr/bin/env node
/**
 * The reduced view a step hands a child when a path is not enough.
 *
 * A step that must pass a **content** and not a path — a payload too large to inline, a set of
 * notes, a diff — does it within the `{subagent.payload_cap}` the project declares, with a
 * **deterministic reduced view** of the artefact stood next to the **path of the whole original**
 * (`contracts/orchestration.md` §4, *Delegation*). This program is what produces that view.
 *
 * It is deterministic by construction: the view is a function of the artefact and the cap alone —
 * whole lines from the head of the file, then one line that names the bytes elided and the path of
 * the original — so the same input gives byte-identical output, with no clock, no filesystem order
 * and no model in it. A summary written by a model is exactly what the rule forbids, and this
 * program never writes one.
 *
 *   node <package-root>/architect/view.mjs <package-root>
 *       one JSON object on stdin — `file` (the artefact), `cap` (the ceiling in bytes) — one on
 *       stdout, exit 0.
 *
 *   node <package-root>/architect/view.mjs --self-check <package-root>
 *       the bench. Counted JSON `{checks, passed, failed[]}` on stdout, exit 1 on the first red.
 *       `hooks/self-check.mjs` launches it.
 *
 * Like the other programs of `architect/` it **fails loudly** on a malformed input (exit 2), and
 * like the head's notice it **invents no threshold**: where the project declared no cap, it says
 * so and produces no view rather than picking a size.
 */

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

/* ------------------------------------------------------------------------- *
 * Input
 * ------------------------------------------------------------------------- */

class BadInput extends Error {}

function fail(message) {
  throw new BadInput(message);
}

const slashed = (path) => String(path).split('\\').join('/');

function absOf(value, root) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const cleaned = value.trim().replace(/\\/g, '/');
  try {
    const absolute = isAbsolute(cleaned) || /^[A-Za-z]:/.test(cleaned) ? resolve(cleaned) : resolve(root, cleaned);
    return slashed(absolute);
  } catch {
    return null;
  }
}

const countLines = (text) => (text === '' ? 0 : text.split('\n').length);

/* ------------------------------------------------------------------------- *
 * The reduced view
 * ------------------------------------------------------------------------- */

/** The line that closes a reduced view: what was elided, and where the whole original stands. */
function markerOf(elided, total, path) {
  return `… [Daiku reduced view: ${elided} bytes elided of ${total}; the whole original is at ${path}]`;
}

/**
 * The view of `text` under `cap`. A positive integer cap reduces the artefact to whole lines from
 * its head plus a marker naming the elided bytes and the original; a cap absent or invalid produces
 * no view and says so. The reduction keeps complete lines and never depends on anything but its
 * arguments — the same input gives the same output, byte for byte.
 */
export function reduce(text, cap, path) {
  const total = Buffer.byteLength(text, 'utf-8');
  if (!(typeof cap === 'number' && Number.isFinite(cap) && cap > 0)) {
    return {
      declared: false,
      path,
      view: null,
      bytes: null,
      lines: null,
      reduced: null,
      detail: 'no cap declared: the project named no `subagent.payload_cap`, so no threshold is guessed and no view is produced',
    };
  }
  if (total <= cap) {
    return {
      declared: true,
      path,
      view: text,
      bytes: total,
      lines: countLines(text),
      reduced: false,
      detail: 'the artefact is at or under the cap: the view is the whole original',
    };
  }

  // Whole lines from the head, until the marker would push the view past the cap. The reserve is
  // the marker at its longest (elided = total), so the real marker — always shorter — cannot
  // breach the cap afterwards.
  const reserve = Buffer.byteLength(markerOf(total, total, path), 'utf-8') + 1;
  const kept = [];
  let keptBytes = 0;
  for (const line of text.split('\n')) {
    const lineBytes = Buffer.byteLength(line, 'utf-8');
    const candidate = keptBytes + lineBytes + (kept.length ? 1 : 0);
    if (candidate + reserve > cap) break;
    kept.push(line);
    keptBytes = candidate;
  }
  const elided = total - keptBytes;
  let view = `${kept.join('\n')}\n${markerOf(elided, total, path)}`;
  if (Buffer.byteLength(view, 'utf-8') > cap) {
    // A cap smaller than the marker itself: keep the longest prefix that fits and ends on a
    // character boundary. Cutting raw bytes would let a split multi-byte character decode to a
    // 3-byte U+FFFD and push the view back over the cap.
    const bytes = Buffer.from(view, 'utf-8');
    let end = Math.min(cap, bytes.length);
    while (end > 0 && (bytes[end] & 0xc0) === 0x80) end -= 1;
    view = bytes.subarray(0, end).toString('utf-8');
  }
  return {
    declared: true,
    path,
    view,
    bytes: Buffer.byteLength(view, 'utf-8'),
    lines: countLines(view),
    reduced: true,
    detail: `reduced to ${kept.length} whole line(s) from the head under the ${cap}-byte cap`,
  };
}

/** The conservation rule of a view: it never exceeds the cap, and it always names the original. */
export function conserved(report) {
  if (!report || report.declared === false) return report && report.declared === false;
  if (typeof report.view !== 'string') return false;
  if (!report.path) return false;
  return report.bytes <= report.cap || report.reduced === false;
}

/** The report of one artefact, with its conservation checked against the cap that produced it. */
export function view(input, root, reads) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('the input must be a JSON object');
  const file = absOf(input.file, root);
  if (!file) fail('file is required: the artefact to reduce');
  if (!reads.exists(file)) fail(`file does not resolve on disk: ${input.file}`);
  const report = reduce(reads.read(file), input.cap, file);
  return { ...report, cap: typeof input.cap === 'number' && input.cap > 0 ? Math.floor(input.cap) : null, conserved: conserved({ ...report, cap: input.cap }) };
}

/* ------------------------------------------------------------------------- *
 * Environment
 * ------------------------------------------------------------------------- */

export const REAL_READS = {
  exists: (file) => {
    try {
      return existsSync(file);
    } catch {
      return false;
    }
  },
  read: (file) => readFileSync(file, 'utf-8'),
};

/* ------------------------------------------------------------------------- *
 * Test bench
 * ------------------------------------------------------------------------- */

const ROOT = 'C:/pkg';
const ART = `${ROOT}/notes.md`;

function fakeReads(files = {}) {
  const key = (p) => slashed(p).replace(/\/+$/, '');
  const map = new Map(Object.entries(files).map(([k, v]) => [key(k), v]));
  return {
    exists: (p) => map.has(key(p)),
    read: (p) => {
      if (!map.has(key(p))) throw new Error(`ENOENT ${p}`);
      return map.get(key(p));
    },
  };
}

const small = 'a'.repeat(200);
const big = Array.from({ length: 400 }, (_, i) => `line ${i} ${'x'.repeat(20)}`).join('\n');

function selfCheck() {
  const failed = [];
  let ran = 0;
  const check = (name, condition) => {
    ran += 1;
    if (!condition) failed.push(name);
  };

  // --- under the cap: the view is the whole original --------------------------
  const under = view({ file: ART, cap: 5000 }, ROOT, fakeReads({ [ART]: small }));
  check('an artefact under the cap is the whole original', under.view === small);
  check('and it is not reduced', under.reduced === false);
  check('and it carries the path of the original', under.path === ART);
  check('and its conservation holds', under.conserved === true);

  // --- over the cap: a view within it, deterministic --------------------------
  const over = view({ file: ART, cap: 500 }, ROOT, fakeReads({ [ART]: big }));
  check('an artefact over the cap is reduced', over.reduced === true);
  check('the view holds within the cap', over.bytes <= 500);
  check('the view is not the whole original', over.view !== big);
  check('the view names the path of the whole original', over.view.includes(ART));
  check('the view says how much it elided', /bytes elided of \d+/.test(over.view));
  check('the conservation holds on the reduced view', over.conserved === true);

  // --- determinism: the same input, byte for byte -----------------------------
  const again = view({ file: ART, cap: 500 }, ROOT, fakeReads({ [ART]: big }));
  check('two runs on the same input are byte-identical', JSON.stringify(again) === JSON.stringify(over));

  // --- no cap declared: no view, and it says so -------------------------------
  const none = view({ file: ART }, ROOT, fakeReads({ [ART]: big }));
  check('with no cap the program produces no view', none.view === null);
  check('and it declares that no cap was given', none.declared === false);
  check('and it invents no threshold', none.cap === null);
  check('and it still names the original', none.path === ART);
  const bad = view({ file: ART, cap: 0 }, ROOT, fakeReads({ [ART]: big }));
  check('a zero cap is *not declared* too', bad.declared === false && bad.view === null);
  const str = view({ file: ART, cap: '500' }, ROOT, fakeReads({ [ART]: big }));
  check('a non-numeric cap is *not declared*', str.declared === false);

  // --- whole lines are kept, at the head --------------------------------------
  const lines = view({ file: ART, cap: 300 }, ROOT, fakeReads({ [ART]: big }));
  check('the reduced view keeps whole lines from the head', lines.view.startsWith('line 0 '));
  check('and the last line of the view is the marker', lines.view.split('\n').pop().startsWith('… [Daiku reduced view:'));
  check('a line is never cut in the middle', !lines.view.split('\n').slice(0, 1)[0].endsWith('…'));

  // --- a cap shorter than the marker: the cut never breaches it ----------------
  const below = view({ file: ART, cap: 2 }, ROOT, fakeReads({ [ART]: big }));
  check('a cap shorter than the marker still holds within the cap', below.bytes <= 2);
  check('and its conservation holds on that cut', below.conserved === true);

  // --- fail loudly ------------------------------------------------------------
  let threw = 0;
  for (const badInput of [null, [], {}, { file: 'ghost.md', cap: 10 }]) {
    try {
      view(badInput, ROOT, fakeReads({ [ART]: small }));
    } catch (error) {
      if (error instanceof BadInput) threw += 1;
    }
  }
  check('a non-object input, a missing file and an absent file are all refused', threw === 4);

  process.stdout.write(JSON.stringify({ checks: ran, passed: ran - failed.length, failed }, null, 2) + '\n');
  return failed.length ? 1 : 0;
}

/* ------------------------------------------------------------------------- *
 * Invocation
 * ------------------------------------------------------------------------- */

function die(reason) {
  process.stderr.write(`view: ${reason}\n`);
  process.stderr.write(
    '  If this line is here, node ran: the input is malformed — the message above names which.\n' +
      '  If instead no line ever arrives, node is not on the PATH. This program exits non-zero and\n' +
      '  never falls back to a silent success.\n'
  );
  process.exit(2);
}

function main() {
  const argv = process.argv.slice(2);
  const bench = argv[0] === '--self-check';
  const root = bench ? argv[1] : argv[0];
  if (!root) {
    process.stderr.write('usage: node view.mjs <package-root>\n');
    process.stderr.write('       node view.mjs --self-check <package-root>\n');
    process.exit(2);
  }
  if (bench) {
    process.exit(selfCheck());
  }
  let result;
  try {
    const raw = readFileSync(0, 'utf-8');
    if (!raw.trim()) fail('stdin is empty: one JSON object is required');
    let input;
    try {
      input = JSON.parse(raw);
    } catch (error) {
      fail(`stdin is not valid JSON (${error.message})`);
    }
    result = view(input, resolve(root), REAL_READS);
  } catch (error) {
    die(error && error.message ? error.message : String(error));
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(0);
}

main();
