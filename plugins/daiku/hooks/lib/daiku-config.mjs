/**
 * Daiku's context on this project, read from `.daiku/project.json`.
 *
 * It exists because five of the six hooks need the same two facts — **did this
 * project open Daiku?** and **what did it declare?** — and because the answer cannot
 * sit hard-wired inside a hook: a package installed on a host runs on *every*
 * repository that host opens, including ones Daiku has never seen.
 *
 * Hence the rule governing four of the six hooks — `session-advice` excepted, which reports a
 * `.daiku/` left halfway:
 *
 * > **Without `.daiku/project.json` the guards stay silent.** Not a degradation: the
 * > boundary. A project that has not opened Daiku asked Daiku for nothing, and a
 * > guardrail denying a command to someone who has not installed it is a fault, not protection.
 *
 * This is the same §6 of `contracts/project-contract.md` — *what the JSON does not declare does
 * not exist* — applied to a hook instead of a skill: no fallback value, no heuristics, no
 * guessed perimeter.
 *
 * Fail-open like the rest: missing file, broken JSON, unreachable disk → missing
 * context, hence silence.
 */

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

/** The empty context: what is read when there is nothing to read. */
const ABSENT = Object.freeze({
  present: false,
  pool: null,
  studies: [],
  guardrails: Object.freeze({}),
  libNotes: null,
  reviewState: null,
  codeRoot: null,
  memoryRoot: null,
  writeRoots: Object.freeze([]),
  promptDumpChars: null,
  channels: null,
});

/** A path from the JSON, resolved against the technical root (§3 of the contract). */
function resolvePath(value, root) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const cleaned = value.trim().replace(/\\/g, '/');
  return isAbsolute(cleaned) || /^[A-Za-z]:/.test(cleaned) ? resolve(cleaned) : resolve(root, cleaned);
}

/**
 * What this project declared. `reads` carries the reads, so each hook's test bench
 * can build a context without touching the disk.
 *
 * The context carries what the hooks read and nothing else: the switch and the pool of the
 * command guard, `paths.features` — the working folders, the seat the run works in — and
 * `paths.studies` — the notes on a technology — for the two hooks that speak about the run's
 * seats, with the machine's `write_roots` for the reminder,
 * `paths.review_state` for the ledger notice of `stop-advice`, `code_root` and `memory.root` for
 * the notice it gives when a session changed code and left the corpus untouched, and the
 * environment file for the two keys of `run-advice`: `write_roots`, the folders this machine
 * admits, and `prompt_dump_chars`, the size above which the notice that opens a run calls a
 * prompt a raw dump (§7 of `contracts/orchestration.md`). Every path comes from a key of
 * `.daiku/project.json` (§4 of the contract); the environment's two come from the file of §8 —
 * the machine's local one first, **taken whole**, never merged. A missing or unresolvable key
 * contributes `null`, never a guessed path and never a guessed number: §6 of the contract,
 * applied to a hook. Nothing is read outside the project: no seat of Daiku lives in the user
 * home.
 */
export function loadContext(root, reads = REAL_READS) {
  try {
    const filePath = join(root, '.daiku', 'project.json');
    if (!reads.exists(filePath)) return ABSENT;

    let json;
    try {
      json = JSON.parse(reads.read(filePath));
    } catch {
      // Broken JSON: `session-advice` reports it at startup, and that is its job. Not here —
      // a guard denying commands over an unreadable JSON would deny at random.
      return ABSENT;
    }
    if (!json || typeof json !== 'object') return ABSENT;

    const raw = json.paths && json.paths.features;
    const features = (Array.isArray(raw) ? raw : [raw])
      .map((x) => (typeof x === 'string' ? x.trim().replace(/\\/g, '/').replace(/\/+$/, '') : null))
      .filter(Boolean);

    const declared = json.guardrails;
    const channels = json.channels && typeof json.channels === 'object' ? json.channels : null;
    const environment = readEnvironment(root, reads);
    return {
      present: true,
      pool: resolvePath(json.worktree && json.worktree.pool, root),
      features,
      studies: resolvePath(json.paths && json.paths.studies, root),
      guardrails: declared && typeof declared === 'object' ? declared : {},
      reviewState: resolvePath(json.paths && json.paths.review_state, root),
      // The two seats of the corpus notice of `stop-advice`: the code the session changed, and
      // the memory it must have aligned to it. Both are §4 keys, both degrade as absent.
      codeRoot: resolvePath(json.code_root, root),
      memoryRoot: resolvePath(json.memory && json.memory.root, root),
      writeRoots: environment.writeRoots,
      promptDumpChars: environment.promptDumpChars,
      // The two branch names of the channels group. `production` is the switch of the branch
      // guard of `command-guard.mjs`; `development` names the branch the work lives on. A group
      // absent, or a member that is not a non-empty string, contributes `null`.
      channels: channels
        ? {
            development: typeof channels.development === 'string' ? channels.development.trim() || null : null,
            production: typeof channels.production === 'string' ? channels.production.trim() || null : null,
          }
        : null,
    };
  } catch {
    return ABSENT;
  }
}

/**
 * The two keys `run-advice` reads from the environment file of §8 — the machine's local one first,
 * **taken whole**: where it exists and parses, the project one is not read. Absent is the normal
 * case for both.
 *
 * - `write_roots` — the folders the machine admits, where a write made from the conversation is
 *   not the run's own violation. A declared root that does not resolve on disk is dropped: nobody
 *   writes there, so the reminder has nothing to stay silent for.
 * - `prompt_dump_chars` — the size at which the notice opening a run calls the prompt a raw dump.
 *   A positive integer, or `null`. Zero, negative, `NaN` and a value that is not a number all read
 *   as *not declared*: §6 of the contract, applied to a hook — the notice then has no threshold to
 *   measure against, and stays silent about the size rather than picking one.
 */
function readEnvironment(root, reads) {
  for (const file of [
    join(root, '.daiku', 'environment.local.json'),
    join(root, '.daiku', 'environment.json'),
  ]) {
    let json;
    try {
      if (!reads.exists(file)) continue;
      json = JSON.parse(reads.read(file));
    } catch {
      continue;
    }
    if (!json || typeof json !== 'object') continue;
    const declared = Array.isArray(json.write_roots) ? json.write_roots : [];
    const raw = json.prompt_dump_chars;
    return {
      writeRoots: Object.freeze(declared.map((x) => resolvePath(x, root)).filter((p) => p && reads.exists(p))),
      promptDumpChars: typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : null,
    };
  }
  return { writeRoots: Object.freeze([]), promptDumpChars: null };
}

/** Is `absolute` inside `base`? Prefix comparison, insensitive to Windows case. */
export function isInside(absolute, base) {
  if (!absolute || !base) return false;
  const n = (p) => resolve(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const a = n(absolute);
  const b = n(base);
  return a === b || a.startsWith(b + '/');
}

export const REAL_READS = {
  exists: (filePath) => {
    try {
      return existsSync(filePath);
    } catch {
      return false;
    }
  },
  read: (filePath) => readFileSync(filePath, 'utf-8'),
};

/** A hand-built context: what the hooks' test benches use. A path field resolves like the pool; absent stays `null`. */
export function fakeContext(fields = {}) {
  const seat = (value) => {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      return resolve(value);
    } catch {
      return null;
    }
  };
  return {
    present: fields.present !== false,
    pool: fields.pool ? resolve(fields.pool) : null,
    features: fields.features || [],
    studies: seat(fields.studies),
    guardrails: fields.guardrails || {},
    reviewState: seat(fields.reviewState),
    codeRoot: seat(fields.codeRoot),
    memoryRoot: seat(fields.memoryRoot),
    writeRoots: Array.isArray(fields.writeRoots) ? fields.writeRoots.map(seat).filter(Boolean) : [],
    promptDumpChars: typeof fields.promptDumpChars === 'number' && fields.promptDumpChars > 0 ? Math.floor(fields.promptDumpChars) : null,
    channels: fields.channels || null,
  };
}
