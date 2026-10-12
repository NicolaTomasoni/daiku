#!/usr/bin/env node
/**
 * The deterministic measure of a run's cost.
 *
 * The four entries of a run multiply each other — the head of every subagent's prompt, the
 * fan-out, the bytes a step returns, and what a project loads on every session — and none of
 * them was counted. This program counts, from the disk alone, what is countable on the machine:
 *
 *  - **head** — the bytes of the shared contract every node pays: `contracts/orchestration.md`
 *    and `contracts/project-contract.md`, read from the package root, or the paths the caller
 *    names in `contracts`.
 *  - **invocations** — how many steps a run makes: the phases the chain declares (counted in the
 *    `PHASES` array of `architect/architect.mjs`, where the run is written) plus the rounds the
 *    ledgers the caller names hold.
 *  - **return** — the bytes of the return blocks deposited on disk: the artefacts the caller
 *    passes in `artifacts`, never the prose of a session.
 *  - **always_loaded** — the bytes every session pays before it does anything: the memory index,
 *    the project's instructions file, and the frontmatter `description` of every skill the caller
 *    names. Absent, it degrades to `null` — no value invented.
 *
 * Beside the four, **tokens** are added where the host reported them: the `cost` array of the
 * ledgers the caller names (`architect/ledger.mjs` writes it, `schemas/blocks.json` § *ledger*
 * declares it). Where no ledger carries a number, `tokens` is `null` — the program never
 * estimates. It never reads the per-line schema of the transcript either: the byte counts are
 * facts of the files on disk, and the host's conversation format is not one of them.
 *
 *   node <package-root>/architect/cost.mjs <package-root>
 *       one JSON object on stdin — the paths to measure — one on stdout, exit 0.
 *
 *   node <package-root>/architect/cost.mjs --self-check <package-root>
 *       the bench, on a simulated filesystem. Counted JSON `{checks, passed, failed[]}` on
 *       stdout, exit 1 on the first red. `hooks/self-check.mjs` launches it.
 *
 * Like the evaluator it **fails loudly** on a malformed input: no argument or unparsable stdin
 * is exit 2, never a silent success. A file a path names and the disk does not hold is not a
 * fault — it contributes nothing, which is a count of zero and never a guessed number.
 *
 * Invoked by path like the other programs of `architect/`: no skill cables it into a step, and
 * it is the agent or the owner that runs it.
 */

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

/* ------------------------------------------------------------------------- *
 * Input
 * ------------------------------------------------------------------------- */

class BadInput extends Error {}

function fail(message) {
  throw new BadInput(message);
}

const slashed = (path) => String(path).split('\\').join('/');

/** A path from the input: absolute as it is, relative resolved against the root; `null` otherwise. */
function absOf(value, root) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const cleaned = value.trim().replace(/\\/g, '/');
  try {
    return isAbsolute(cleaned) || /^[A-Za-z]:/.test(cleaned) ? resolve(cleaned) : resolve(root, cleaned);
  } catch {
    return null;
  }
}

/** The bytes of a file, or `null` when the disk does not hold it. */
function bytesOf(file, reads) {
  try {
    if (!file || !reads.exists(file)) return null;
    return Buffer.byteLength(reads.read(file), 'utf-8');
  } catch {
    return null;
  }
}

/** The `description` of a markdown frontmatter, unquoted, or `null` when there is none. */
function descriptionOf(text) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!block) return null;
  const found = block[1].match(/^\s*description:\s*(.*)$/m);
  if (!found) return null;
  return found[1].trim().replace(/^['"]|['"]$/g, '');
}

/** The entries of the chain, counted in the `PHASES` array of `architect/architect.mjs`; `null` otherwise. */
function chainPhases(root, reads) {
  const file = join(root, 'architect', 'architect.mjs');
  if (!reads.exists(file)) return null;
  const text = reads.read(file);
  const start = text.indexOf('const PHASES = [');
  if (start < 0) return null;
  const end = text.indexOf('\n];', start);
  const body = text.slice(start, end < 0 ? undefined : end);
  const matches = body.match(/\bname:\s*'/g);
  return matches ? matches.length : null;
}

/** The rounds a ledger holds, and the tokens its `cost` entries reported. `null` for a ledger the disk cannot read. */
function ledgerFacts(file, reads) {
  try {
    if (!reads.exists(file)) return null;
    const json = JSON.parse(reads.read(file));
    const rounds = Array.isArray(json.rounds) ? json.rounds : [];
    let tokens = null;
    for (const round of rounds) {
      const cost = round && Array.isArray(round.cost) ? round.cost : [];
      for (const entry of cost) {
        if (entry && typeof entry.tokens === 'number' && Number.isFinite(entry.tokens) && entry.tokens >= 0) {
          tokens = (tokens === null ? 0 : tokens) + entry.tokens;
        }
      }
    }
    return { rounds: rounds.length, tokens };
  } catch {
    return null;
  }
}

function listOf(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : [];
}

/* ------------------------------------------------------------------------- *
 * Measure — the four entries and the tokens
 * ------------------------------------------------------------------------- */

export function measure(input, root, reads) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('the input must be a JSON object');

  const report = { head: null, invocations: null, return: 0, always_loaded: null, tokens: null };

  // head — the shared contract every node pays.
  const named = listOf(input.contracts).map((p) => absOf(p, root)).filter(Boolean);
  const contracts = named.length
    ? named
    : [join(root, 'contracts', 'orchestration.md'), join(root, 'contracts', 'project-contract.md')];
  let head = 0;
  let headSeen = false;
  for (const file of contracts) {
    const size = bytesOf(file, reads);
    if (size !== null) {
      head += size;
      headSeen = true;
    }
  }
  report.head = headSeen ? head : null;

  // invocations — the run's steps: the chain phases plus the ledger rounds.
  const phases = chainPhases(root, reads);
  let rounds = 0;
  for (const ledger of listOf(input.ledgers).map((p) => absOf(p, root)).filter(Boolean)) {
    const facts = ledgerFacts(ledger, reads);
    if (facts) rounds += facts.rounds;
  }
  report.invocations = (phases === null ? 0 : phases) + rounds;

  // return — the bytes of the return blocks deposited on disk.
  let returns = 0;
  for (const file of listOf(input.artifacts).map((p) => absOf(p, root)).filter(Boolean)) {
    const size = bytesOf(file, reads);
    if (size !== null) returns += size;
  }
  report.return = returns;

  // always_loaded — what every session pays before it does anything.
  const seats = [];
  const index = absOf(input.memory_index, root);
  if (index) seats.push(index);
  const instructions = absOf(input.instructions_file, root);
  if (instructions) seats.push(instructions);
  const skills = listOf(input.skills).map((p) => absOf(p, root)).filter(Boolean);
  let loaded = 0;
  let loadedSeen = false;
  for (const file of seats) {
    const size = bytesOf(file, reads);
    if (size !== null) {
      loaded += size;
      loadedSeen = true;
    }
  }
  for (const file of skills) {
    try {
      if (!reads.exists(file)) continue;
      const description = descriptionOf(reads.read(file));
      if (description === null) continue;
      loaded += Buffer.byteLength(description, 'utf-8');
      loadedSeen = true;
    } catch {
      /* a skill the disk cannot read contributes nothing */
    }
  }
  report.always_loaded = loadedSeen ? loaded : null;

  // tokens — only where the host reported them.
  let tokens = null;
  for (const ledger of listOf(input.ledgers).map((p) => absOf(p, root)).filter(Boolean)) {
    const facts = ledgerFacts(ledger, reads);
    if (facts && facts.tokens !== null) tokens = (tokens === null ? 0 : tokens) + facts.tokens;
  }
  report.tokens = tokens;

  return report;
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

/** A simulated filesystem: a path → content map. */
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

const ARCHITECT = [
  'const PHASES = [',
  "  { name: 'problem', cites: { file: 'a', section: 'x' }, artifact: '0. problem.md' },",
  "  { name: 'brief', cites: { file: 'b', section: 'y' }, artifact: '2. blueprint.md' },",
  '];',
  '',
  "const REVIEW_PHASES = [{ name: 'scope', cites: {} }];",
].join('\n');

function tree(extra = {}) {
  return {
    [`${ROOT}/contracts/orchestration.md`]: 'x'.repeat(100),
    [`${ROOT}/contracts/project-contract.md`]: 'y'.repeat(50),
    [`${ROOT}/architect/architect.mjs`]: ARCHITECT,
    [`${ROOT}/.docs/memory/MEMORY.md`]: 'm'.repeat(30),
    [`${ROOT}/CLAUDE.md`]: 'i'.repeat(20),
    [`${ROOT}/skills/a/SKILL.md`]: "---\nname: a\ndescription: 'alpha'\n---\n\nbody\n",
    ...extra,
  };
}

function selfCheck() {
  const failed = [];
  let ran = 0;
  const check = (name, condition) => {
    ran += 1;
    if (!condition) failed.push(name);
  };

  const base = {
    memory_index: '.docs/memory/MEMORY.md',
    instructions_file: 'CLAUDE.md',
    skills: ['skills/a/SKILL.md'],
  };

  // --- the four entries, without a ledger ------------------------------------
  const plain = measure(base, ROOT, fakeReads(tree()));
  check('the four entries are all there', ['head', 'invocations', 'return', 'always_loaded'].every((k) => k in plain));
  check('head counts the shared contract', plain.head === 150);
  check('invocations counts the chain phases', plain.invocations === 2);
  check('return is zero when nothing was deposited', plain.return === 0);
  check('always_loaded counts the index, the instructions and the skill description', plain.always_loaded === 30 + 20 + 5);
  check('without a ledger the tokens are null', plain.tokens === null);

  // --- the tokens come from the ledger, where the host reported them ----------
  const withLedger = measure(
    { ...base, ledgers: ['.docs/runtime/review/l.json'] },
    ROOT,
    fakeReads(tree({
      [`${ROOT}/.docs/runtime/review/l.json`]: JSON.stringify({
        rounds: [
          { n: 1, cost: [{ step: 'finder', tokens: 1200, tool_uses: 3 }] },
          { n: 2, cost: [{ step: 'applier', tokens: 800 }] },
        ],
      }),
    }))
  );
  check('a ledger values the tokens with the reported numbers', withLedger.tokens === 2000);
  check('the four entries do not move with a ledger', withLedger.head === 150 && withLedger.return === 0);
  check('the rounds of the ledger count as invocations', withLedger.invocations === 2 + 2);

  const noNumbers = measure(
    { ...base, ledgers: ['.docs/runtime/review/l.json'] },
    ROOT,
    fakeReads(tree({
      [`${ROOT}/.docs/runtime/review/l.json`]: JSON.stringify({
        rounds: [{ n: 1, cost: [{ step: 'finder', tool_uses: 3 }] }],
      }),
    }))
  );
  check('a cost entry without a token number invents no token', noNumbers.tokens === null);
  check('and it still counts its round', noNumbers.invocations === 2 + 1);

  const halfNumbers = measure(
    { ...base, ledgers: ['.docs/runtime/review/l.json'] },
    ROOT,
    fakeReads(tree({
      [`${ROOT}/.docs/runtime/review/l.json`]: JSON.stringify({
        rounds: [{ n: 1, cost: [{ step: 'finder', tokens: 500 }, { step: 'applier', seconds: 4 }] }],
      }),
    }))
  );
  check('a number reported once is summed once', halfNumbers.tokens === 500);

  // --- an always-loaded file absent degrades to null -------------------------
  const missing = measure(
    { memory_index: '.docs/memory/MEMORY.md', instructions_file: 'nope.md', skills: [] },
    ROOT,
    fakeReads(tree())
  );
  check('a resolved always-loaded seat is still counted', missing.always_loaded === 30);
  const none = measure({ instructions_file: 'nope.md', skills: ['skills/ghost/SKILL.md'] }, ROOT, fakeReads(tree()));
  check('with nothing resolvable the always-loaded degrades to null', none.always_loaded === null);
  check('and it is null, not zero', none.always_loaded !== 0);

  // --- the return bytes come from the artefacts, never the prose -------------
  const withReturn = measure(
    { ...base, artifacts: ['2. blueprint.md', '4. review-notes.md'] },
    ROOT,
    fakeReads(tree({
      [`${ROOT}/2. blueprint.md`]: 'r'.repeat(40),
      [`${ROOT}/4. review-notes.md`]: 's'.repeat(10),
    }))
  );
  check('the return counts the bytes of the deposited blocks', withReturn.return === 50);

  // --- the head is the shared contract, not the whole corpus -----------------
  check('the head does not read the transcript', plain.head === 150 && !('transcript' in plain));
  const namedContracts = measure({ contracts: ['contracts/orchestration.md'] }, ROOT, fakeReads(tree()));
  check('the contracts may be named', namedContracts.head === 100);
  const goneHead = measure({ contracts: ['contracts/ghost.md'] }, ROOT, fakeReads(tree()));
  check('a head no file resolves is null', goneHead.head === null);

  // --- fail loudly on a malformed input --------------------------------------
  let threw = false;
  try {
    measure(null, ROOT, fakeReads(tree()));
  } catch (error) {
    threw = error instanceof BadInput;
  }
  check('a non-object input is refused', threw);
  let threwArray = false;
  try {
    measure([], ROOT, fakeReads(tree()));
  } catch (error) {
    threwArray = error instanceof BadInput;
  }
  check('an array is not an input object', threwArray);

  process.stdout.write(JSON.stringify({ checks: ran, passed: ran - failed.length, failed }, null, 2) + '\n');
  return failed.length ? 1 : 0;
}

/* ------------------------------------------------------------------------- *
 * Invocation
 * ------------------------------------------------------------------------- */

function die(reason) {
  process.stderr.write(`cost: ${reason}\n`);
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
    process.stderr.write('usage: node cost.mjs <package-root>\n');
    process.stderr.write('       node cost.mjs --self-check <package-root>\n');
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
    result = measure(input, resolve(root), REAL_READS);
  } catch (error) {
    die(error && error.message ? error.message : String(error));
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(0);
}

main();
