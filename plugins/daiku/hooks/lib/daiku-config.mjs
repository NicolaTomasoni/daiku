/**
 * Daiku's context on this project, read from `.daiku/project.json`.
 *
 * It exists because four of the five hooks need the same two facts — **did this
 * project open Daiku?** and **what did it declare?** — and because the answer cannot
 * sit hard-wired inside a hook: a package installed on a host runs on *every*
 * repository that host opens, including ones Daiku has never seen.
 *
 * Hence the rule governing three of the five hooks — `session-advice` excepted, which reports a
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
  writeRoots: Object.freeze([]),
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
 * command guard, `paths.studies` for the two hooks that speak about the run's seats,
 * `paths.lib_notes` and the machine's `write_roots` for the reminder, and
 * `paths.review_state` for the ledger notice of `stop-advice`. Every path comes from a key of
 * `.daiku/project.json` (§4 of the contract), except `write_roots`, which belongs to the
 * environment file of §8 — the machine's local file first, **taken whole**, never merged. A
 * missing or unresolvable key contributes `null`, never a guessed path: §6 of the contract,
 * applied to a hook. Nothing is read outside the project: no seat of Daiku lives in the user home.
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

    const raw = json.paths && json.paths.studies;
    const studies = (Array.isArray(raw) ? raw : [raw])
      .map((x) => (typeof x === 'string' ? x.trim().replace(/\\/g, '/').replace(/\/+$/, '') : null))
      .filter(Boolean);

    const declared = json.guardrails;
    return {
      present: true,
      pool: resolvePath(json.worktree && json.worktree.pool, root),
      studies,
      guardrails: declared && typeof declared === 'object' ? declared : {},
      libNotes: resolvePath(json.paths && json.paths.lib_notes, root),
      reviewState: resolvePath(json.paths && json.paths.review_state, root),
      writeRoots: resolveWriteRoots(root, reads),
    };
  } catch {
    return ABSENT;
  }
}

/**
 * The `writeRoots` of the run's reminder: the folders the machine admits, where a write made
 * from the conversation is not the run's own violation. The environment file of §8 — the
 * machine's local one first, **taken whole**: where it exists and parses, the project one is not
 * read. Absent is the normal case, and reads as no root at all.
 */
function resolveWriteRoots(root, reads) {
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
    return Object.freeze(declared.map((x) => resolvePath(x, root)).filter(Boolean));
  }
  return Object.freeze([]);
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
    studies: fields.studies || [],
    guardrails: fields.guardrails || {},
    libNotes: seat(fields.libNotes),
    reviewState: seat(fields.reviewState),
    writeRoots: Array.isArray(fields.writeRoots) ? fields.writeRoots.map(seat).filter(Boolean) : [],
  };
}
