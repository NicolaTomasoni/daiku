/**
 * Daiku's context on this project, read from `.daiku/project.json`.
 *
 * It exists because four of the five guards need the same two facts — **did this
 * project open Daiku?** and **what did it declare?** — and because the answer cannot
 * sit hard-wired inside a hook: a package installed on a host runs on *every*
 * repository that host opens, including ones Daiku has never seen.
 *
 * Hence the rule governing all five hooks:
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
import { homedir, tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

/** The empty context: what is read when there is nothing to read. */
const ABSENT = Object.freeze({
  present: false,
  pool: null,
  studies: [],
  guardrails: Object.freeze({}),
  codeRoot: null,
  instructionsFile: null,
  memoryRoot: null,
  techDoc: null,
  changelog: null,
  versionFiles: Object.freeze([]),
  libNotes: null,
  reviewState: null,
  policiesDir: null,
  domainDir: null,
  projectJson: null,
  tempDir: null,
});

/** A path from the JSON, resolved against the technical root (§3 of the contract). */
function resolvePath(value, root) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const cleaned = value.trim().replace(/\\/g, '/');
  return isAbsolute(cleaned) || /^[A-Za-z]:/.test(cleaned) ? resolve(cleaned) : resolve(root, cleaned);
}

/**
 * What this project declared. `reads` carries the reads, so each hook's test bench
 * can build a context without touching the disk. `opts.home` overrides the home
 * directory (the bench passes a fake one); by default it is the real home.
 *
 * Beyond the guard switches, the context carries the **write seats**: every path a
 * skill may legitimately create, resolved absolute. All come from existing keys —
 * `.daiku/project.json` (§4 of the contract) for the project seats,
 * `environment.json` (contract §8 order: project override first, then the home file,
 * taken whole, never merged) for `tempDir` — plus two constants: `.daiku/policies/`
 * and `.daiku/domain/`, which are a convention, not a key. A missing or
 * unresolvable key contributes `null`, never a guessed path: §6 of the contract,
 * applied to a hook.
 */
export function loadContext(root, reads = REAL_READS, opts = {}) {
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
    const version = json.version && typeof json.version === 'object' ? json.version : {};
    const replicated = Array.isArray(version.replicated_in) ? version.replicated_in : [];
    const versionFiles = [version.file, ...replicated]
      .filter((x) => typeof x === 'string' && x.trim())
      .map((x) => resolvePath(x, root))
      .filter(Boolean);
    return {
      present: true,
      pool: resolvePath(json.worktree && json.worktree.pool, root),
      studies,
      guardrails: declared && typeof declared === 'object' ? declared : {},
      codeRoot: resolvePath(json.code_root, root),
      instructionsFile: resolvePath(json.instructions_file, root),
      memoryRoot: resolvePath(json.memory && json.memory.root, root),
      techDoc: resolvePath(json.tech_doc, root),
      changelog: resolvePath(json.changelog, root),
      versionFiles,
      libNotes: resolvePath(json.paths && json.paths.lib_notes, root),
      reviewState: resolvePath(json.paths && json.paths.review_state, root),
      policiesDir: resolve(join(root, '.daiku', 'policies')),
      domainDir: resolve(join(root, '.daiku', 'domain')),
      projectJson: resolve(join(root, '.daiku', 'project.json')),
      tempDir: resolveTempDir(root, reads, opts.home),
    };
  } catch {
    return ABSENT;
  }
}

/** The `tempDir` seat: project override first, then the home file, whole-file-wins. */
function resolveTempDir(root, reads, home) {
  const base = home || safeHome();
  const candidates = [join(root, '.daiku', 'environment.json')];
  if (base) candidates.push(join(base, '.daiku', 'environment.json'));
  for (const file of candidates) {
    let json;
    try {
      if (!reads.exists(file)) continue;
      json = JSON.parse(reads.read(file));
    } catch {
      continue;
    }
    if (json && typeof json === 'object') {
      const resolved = resolvePath(json.temp_dir, root);
      if (resolved) return resolved;
    }
  }
  return null;
}

function safeHome() {
  try {
    return homedir();
  } catch {
    return null;
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

/** A hand-built context: what the five hooks' test benches use. Seat fields resolve like the pool; absent stays `null`. */
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
    codeRoot: seat(fields.codeRoot),
    instructionsFile: seat(fields.instructionsFile),
    memoryRoot: seat(fields.memoryRoot),
    techDoc: seat(fields.techDoc),
    changelog: seat(fields.changelog),
    versionFiles: Array.isArray(fields.versionFiles)
      ? fields.versionFiles.map(seat).filter(Boolean)
      : [],
    libNotes: seat(fields.libNotes),
    reviewState: seat(fields.reviewState),
    policiesDir: seat(fields.policiesDir),
    domainDir: seat(fields.domainDir),
    projectJson: seat(fields.projectJson),
    tempDir: seat(fields.tempDir),
  };
}
