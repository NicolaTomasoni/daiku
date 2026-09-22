/**
 * Daiku's context on this project, read from `.daiku/project.json`.
 *
 * It exists because two of the three guards need the same two facts — **did this
 * project open Daiku?** and **what did it declare?** — and because the answer cannot
 * sit hard-wired inside a hook: a package installed on a host runs on *every*
 * repository that host opens, including ones Daiku has never seen.
 *
 * Hence the rule governing all three hooks:
 *
 * > **Without `.daiku/project.json` the guards stay silent.** Not a degradation: the
 * > boundary. A project that has not opened Daiku asked Daiku for nothing, and a
 * > guardrail denying a command to someone who has not installed it is a fault, not protection.
 *
 * This is the same §6 of `contracts/project-contract.md` — *what the JSON does not declare does not
 * exist* — applied to a hook instead of a skill: no fallback value, no
 * heuristics, no guessed perimeter.
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
    };
  } catch {
    return ABSENT;
  }
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

/** A hand-built context: what the three hooks' test benches use. */
export function fakeContext(fields = {}) {
  return {
    present: fields.present !== false,
    pool: fields.pool ? resolve(fields.pool) : null,
    studies: fields.studies || [],
    guardrails: fields.guardrails || {},
  };
}
