#!/usr/bin/env node
/**
 * Coarse edit-perimeter guard — PreToolUse on Edit, Write and MultiEdit
 * (plus `apply_patch` on Codex).
 *
 * **This file is not a security barrier**, same as `command-guard.mjs`: the policy
 * an agent cannot remove lives in the host's managed settings. What remains here is a
 * guardrail against **spills**: new files landing where no skill would ever look for
 * them — stray notes at the repo root, scaffolding outside the code perimeter,
 * artefacts outside their seats — while everybody keeps editing what already exists.
 *
 * The shape is **edit-allow / create-restrict**, and it exists because the hook cannot
 * tell a feature flow from the owner by hand:
 *
 *  - **editing an existing file is always allowed**, anywhere inside the repository.
 *    A naive allowlist (`{code_root}/**` plus the declared seats) would deny the
 *    owner's daily hand-edits — `README.md` at the root when it is not `{tech_doc}`,
 *    `package.json` scripts, `.gitignore`, CI files — and a guard denying those is a
 *    fault wearing a protection's looks. An agent editing a wrong *existing* file
 *    stays allowed: accepted coarse trade-off, declared here and in the footer.
 *  - **creating a new file is allowed only inside the create-seats**: `{code_root}`,
 *    the single-file seats (`{hosts.<host>.instructions_file}` — both hosts and their
 *    parked `<name>.old` copies — `{tech_doc}`, `{changelog}`,
 *    `{version.file}` and `{version.replicated_in}`), the folder seats
 *    (`{memory.root}`, `{paths.studies}`, `{paths.lib_notes}`, `{paths.features}`, `{paths.review_state}`,
 *    `.daiku/policies/`, `.daiku/domain/`, `{temp_dir}` plus the OS temp directory),
 *    the **`{write_roots}` the machine declares**, and the `.daiku/` JSON files themselves —
 *    `project.json`, `environment.json` and the machine's `environment.local.json`, which
 *    `init` writes and the user creates — the machine's `.claude/settings.local.json`, the one
 *    file `init` creates under `.claude/`, and the update task — `.daiku/update.mjs` and the
 *    `.vscode/tasks.json` that runs it — and the repository's `.gitignore`, all after
 *    `project.json` has already opened this gate. Where `{repo_root}` sits above the technical
 *    root, the repository is that whole tree: editing there passes, creating follows the same
 *    seats. Everywhere else — including outside the repository — a create is denied, except
 *    inside `{paths.review_state}`, `{temp_dir}` or the OS temp dir when those sit outside the
 *    repo, and inside `{write_roots}`: a declared write root is a **seat on both sides of the
 *    repository boundary**, so editing and creating pass there wherever it stands.
 *
 * **`{write_roots}` is the declared way out, and it is the only one.** This guard cannot tell
 * an order the owner gave from an initiative of the agent — it sees the tool call, never who
 * wanted it — so it denies the same create either way. Denying with no remedy teaches the way
 * around instead, and the way around exists, is invisible, and is declared at the bottom of
 * this file: a file built by the shell never passes through `PreToolUse` on `Edit`. So the
 * authority is written down once, by whoever has it, in the machine's own file
 * (`.daiku/environment.local.json`, taken whole — §8 of `contracts/project-contract.md`), where
 * the agent can cite it instead of hiding a workaround. Nothing about the denial moves: a path
 * that is no seat is still denied, on both sides of the boundary, and the only thing that
 * changed is that the denial now names the key that admits it.
 *
 * Layer placement *inside* `{code_root}` is deliberately not enforced here: a path
 * cannot say whether the layer is right, only the `arch` finder can, by reading the
 * policies. This guard owns the coarse perimeter; placement stays with `arch`.
 *
 * All seats resolve from **existing keys** — `.daiku/project.json` for the project
 * seats, `environment.json` for `{temp_dir}` and `{hosts.<host>.instructions_file}` — plus the `.daiku/` conventions and the
 * OS temp dir as a system fact. No new key was added, so no `contract` bump. A
 * missing key contributes nothing (§6 of `contracts/project-contract.md`, applied to
 * a hook): edits still pass, creates there are denied, nothing is invented.
 *
 * The gate stays: **without `.daiku/project.json` this project has not opened Daiku,
 * and the guard allows everything**, without even reading the path. Behind the gate,
 * an unknown base (no cwd to resolve a relative path against) also allows: same
 * doctrine as `command-guard.mjs` — no verdict is invented.
 *
 * Contract: **fail-open**. Malformed stdin, unparsable patch payload, unreachable
 * filesystem, exception → allow and exit 0. A guard breaking the turn costs more
 * than the spill it prevents.
 *
 * Test bench: `node edit-guard.mjs --self-check`, from the folder it lives in. It runs on a
 * simulated filesystem and touches nothing; the total is **counted**, not hard-coded.
 */

import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { invokedDirectly, projectRoot } from './project-root.mjs';
import { REAL_READS, loadContext, fakeContext, isInside } from './daiku-config.mjs';

const ROOT = projectRoot();

function allow() {
  process.exit(0);
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const pieces = [];
  for await (const piece of process.stdin) pieces.push(piece);
  return Buffer.concat(pieces).toString('utf-8');
}

// --- paths ------------------------------------------------------------------

/** `/c/dev/x` is the path Git Bash produces and Windows `resolve` gets wrong. */
function normalizeMsys(path) {
  const match = /^\/([A-Za-z])(\/.*)?$/.exec(path);
  return match ? `${match[1]}:${match[2] || '/'}` : path;
}

function cleanPath(path) {
  return normalizeMsys(String(path).replace(/\\/g, '/'));
}

function resolveTarget(target, base) {
  const cleaned = cleanPath(target);
  if (isAbsolute(cleaned) || /^[A-Za-z]:/.test(cleaned)) {
    try {
      return resolve(cleaned);
    } catch {
      return null;
    }
  }
  if (!base) return null; // unknown base: no verdict invented
  try {
    return resolve(base, cleaned);
  } catch {
    return null;
  }
}

/** The written path, reduced to a posix relative from the root. `null` if outside. */
function relativeToRoot(inputPath, root) {
  if (!inputPath || !root) return null;
  try {
    const rel = relative(root, inputPath).replace(/\\/g, '/');
    if (!rel || rel.startsWith('../')) return null;
    return rel;
  } catch {
    return null;
  }
}

// --- payload ----------------------------------------------------------------

/** Unified-diff `+++ b/path` lines: the only Codex shape parsed confidently. */
function diffPaths(text) {
  const found = [];
  for (const line of String(text).split('\n')) {
    const match = /^\+\+\+\s+(?:b\/)?(\S+)\s*$/.exec(line.trim());
    if (match && match[1] !== '/dev/null') found.push(match[1]);
  }
  return found;
}

/**
 * The file paths a PreToolUse Edit/Write/MultiEdit/`apply_patch` call touches.
 * Returns `{ paths, confident }`: when nothing is confidently extracted the call is
 * allowed (fail-open), and the bench proves the malformed shapes stay allowed.
 */
function collectPaths(input) {
  if (!input || typeof input !== 'object') return { paths: [], confident: false };
  if (typeof input.file_path === 'string' && input.file_path.trim()) {
    return { paths: [input.file_path], confident: true };
  }
  const candidates = [];
  if (typeof input.path === 'string' && input.path.trim()) candidates.push(input.path);
  if (typeof input.file === 'string' && input.file.trim()) candidates.push(input.file);
  if (Array.isArray(input.files)) {
    for (const f of input.files) {
      if (typeof f === 'string' && f.trim()) candidates.push(f);
      else if (f && typeof f.path === 'string' && f.path.trim()) candidates.push(f.path);
    }
  }
  if (typeof input.patch === 'string') candidates.push(...diffPaths(input.patch));
  if (typeof input.diff === 'string') candidates.push(...diffPaths(input.diff));
  if (!candidates.length) return { paths: [], confident: false };
  return { paths: candidates, confident: true };
}

// --- seats ------------------------------------------------------------------

/** Directory seats: creating inside any of these is legitimate. */
function dirSeats(ctx, root, sysTmp) {
  const seats = [];
  const push = (value) => {
    if (value) seats.push(value);
  };
  push(ctx.codeRoot);
  push(ctx.memoryRoot);
  push(ctx.libNotes);
  push(ctx.features);
  push(ctx.reviewState);
  push(ctx.policiesDir);
  push(ctx.domainDir);
  push(ctx.tempDir);
  push(sysTmp);
  // The `write_roots` of §7: the folders the machine declares. They are a seat like the
  // others — the key says *where writing is admitted*, and a path alone cannot say on which
  // side of the repository boundary it falls.
  for (const site of ctx.writeRoots || []) push(site);
  for (const site of ctx.studies || []) {
    if (typeof site !== 'string' || !site.trim()) continue;
    const cleaned = site.trim().replace(/\\/g, '/');
    try {
      seats.push(isAbsolute(cleaned) || /^[A-Za-z]:/.test(cleaned) ? resolve(cleaned) : resolve(root, cleaned));
    } catch {
      /* an unresolvable site contributes nothing */
    }
  }
  return seats;
}

/** Single-file seats: creating exactly this file is legitimate. */
function fileSeats(ctx) {
  const seats = [
    ...(ctx.instructionsFiles || []),
    ctx.techDoc,
    ctx.changelog,
    ctx.projectJson,
    ctx.environmentFile,
    ctx.environmentLocalFile,
    ctx.hostLocalSettings,
    ctx.updateScript,
    ctx.editorTasks,
    ctx.repoGitignore,
  ];
  for (const f of ctx.versionFiles || []) seats.push(f);
  return seats.filter(Boolean);
}

function insideAny(absolute, seats) {
  return seats.some((seat) => isInside(absolute, seat));
}

function isSameFile(absolute, seats) {
  const norm = (p) => resolve(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const a = norm(absolute);
  return seats.some((seat) => {
    try {
      return norm(seat) === a;
    } catch {
      return false;
    }
  });
}

// --- decision ---------------------------------------------------------------

/**
 * The decision, without leaving the process: what the test bench calls.
 * `env` carries the world (`exists`, `tmpdir`) so the bench swaps in fakes.
 */
function evaluate(filePath, cwd, env, ctx, root) {
  // The gate, before everything else: without `.daiku/project.json` this project has not
  // opened Daiku, and the guard has nothing to watch.
  if (!ctx || !ctx.present) return null;
  const absolute = resolveTarget(filePath, cwd);
  if (!absolute) return null; // relative path with unknown base: no verdict invented

  let sysTmp = null;
  try {
    sysTmp = env.tmpdir();
  } catch {
    sysTmp = null;
  }

  let exists;
  try {
    exists = env.exists(absolute);
  } catch {
    exists = null;
  }
  if (exists === null) return null; // unreachable disk: fail-open
  const creating = !exists;

  // The repository reaches past the technical root when `repo_root` is declared above it: the
  // root `.gitignore`, a changelog at the top of a monorepo, sit there.
  const repoRoots = [root, ctx.repoRoot].filter(Boolean);
  const inRepo = repoRoots.some((r) => isInside(absolute, r) || resolve(absolute) === resolve(r));
  const outsideSeats = [ctx.reviewState, ctx.tempDir, sysTmp, ...(ctx.writeRoots || [])].filter(Boolean);
  const outsideAllowed = insideAny(absolute, outsideSeats);

  if (!inRepo) {
    if (outsideAllowed) return null;
    return {
      reason:
        `\`${filePath}\` stands outside the repository, and it is not inside ` +
        `one of the outside seats (\`{paths.review_state}\`, \`{temp_dir}\`, OS temp, \`{write_roots}\`): ` +
        `a skill writes either under the repository root or in its declared outside seats. ` +
        `To admit the folder that holds it, declare that folder in \`write_roots\` of ` +
        `\`.daiku/environment.local.json\` — the machine's own file, which this guard reads and ` +
        `honours on both sides of the repository boundary.`,
    };
  }

  if (!creating) return null; // edit-allow: existing files are always editable

  const dirs = dirSeats(ctx, root, sysTmp);
  const files = fileSeats(ctx);
  if (insideAny(absolute, dirs) || isSameFile(absolute, files)) return null;
  const rel = relativeToRoot(absolute, root) || filePath;
  return {
    reason:
      `creating \`${rel}\` is denied: new files belong either under \`{code_root}\` or in a ` +
      `declared seat (memory, studies, notes, features, policies, changelog, version, review state, temp). ` +
      `This path is in none of them. To admit the folder that holds it, declare that folder ` +
      `in \`write_roots\` of \`.daiku/environment.local.json\` — the machine's own file, which ` +
      `this guard reads and honours on both sides of the repository boundary.`,
  };
}

function evaluatePayload(input, cwd, env, ctx, root) {
  const { paths, confident } = collectPaths(input);
  if (!confident) return null; // unparsable payload: fail-open
  for (const p of paths) {
    const outcome = evaluate(p, cwd, env, ctx, root);
    if (outcome) return outcome;
  }
  return null;
}

/** The same decision, wearing the **fail-open** contract. */
function safeDecide(input, cwd, env, ctx, root) {
  try {
    return evaluatePayload(input, cwd, env, ctx, root);
  } catch {
    return null;
  }
}

// --- environment ------------------------------------------------------------

const REAL_ENV = {
  exists: (path) => {
    try {
      return existsSync(path);
    } catch {
      return null;
    }
  },
  tmpdir: () => tmpdir(),
};

// --- test bench -------------------------------------------------------------

const R = 'C:/dev/project';
const WT = 'C:/dev/wt/wt-1';

function fakeEnv(existing = [], sysTmp = 'C:/Temp') {
  const key = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const set = new Set(existing.map(key));
  return {
    exists: (p) => set.has(key(p)),
    tmpdir: () => sysTmp,
  };
}

const CTX_FULL = fakeContext({
  codeRoot: `${R}/src`,
  instructionsFiles: [`${R}/CLAUDE.md`, `${R}/CLAUDE.old`, `${R}/AGENTS.md`, `${R}/AGENTS.old`],
  memoryRoot: `${R}/docs/memory`,
  techDoc: `${R}/docs/tech.md`,
  changelog: `${R}/CHANGELOG.md`,
  versionFiles: [`${R}/package.json`],
  studies: ['docs/studies'],
  libNotes: `${R}/docs/lib-notes`,
  features: `${R}/docs/features`,
  reviewState: 'C:/dev/review-state',
  policiesDir: `${R}/.daiku/policies`,
  domainDir: `${R}/.daiku/domain`,
  projectJson: `${R}/.daiku/project.json`,
  environmentFile: `${R}/.daiku/environment.json`,
  environmentLocalFile: `${R}/.daiku/environment.local.json`,
  hostLocalSettings: `${R}/.claude/settings.local.json`,
  updateScript: `${R}/.daiku/update.mjs`,
  editorTasks: `${R}/.vscode/tasks.json`,
  repoGitignore: `${R}/.gitignore`,
  tempDir: 'C:/dev/tmp',
});

/** A monorepo: the technical root `R` sits under the repository root `C:/dev`. */
const CTX_MONO = fakeContext({
  codeRoot: `${R}/src`,
  repoRoot: 'C:/dev',
  repoGitignore: 'C:/dev/.gitignore',
  changelog: 'C:/dev/CHANGELOG.md',
});

const CTX_ABSENT = fakeContext({ present: false });
const CTX_BARE = fakeContext({});

const CASES = [
  // --- the gate: without `.daiku/project.json` everything is allowed --------
  ['no Daiku: create at root passes', 'notes-random.md', R, 'allow', '', CTX_ABSENT, []],
  ['no Daiku: create outside passes', 'C:/other/x.md', R, 'allow', '', CTX_ABSENT, []],
  ['no Daiku: edit outside passes', 'C:/other/x.md', R, 'allow', '', CTX_ABSENT, ['C:/other/x.md']],

  // --- edit-allow: existing files pass everywhere inside the repo ------------
  ['edit README at root (not tech_doc)', 'README.md', R, 'allow', '', CTX_FULL, ['C:/dev/project/README.md']],
  ['edit package.json scripts', 'package.json', R, 'allow', '', CTX_FULL, ['C:/dev/project/package.json']],
  ['edit .gitignore', '.gitignore', R, 'allow', '', CTX_FULL, ['C:/dev/project/.gitignore']],
  ['edit CI file', '.github/workflows/ci.yml', R, 'allow', '', CTX_FULL, ['C:/dev/project/.github/workflows/ci.yml']],
  ['edit code file', 'src/server/api/users.ts', R, 'allow', '', CTX_FULL, ['C:/dev/project/src/server/api/users.ts']],
  ['edit with backslashes', 'src\\server\\api\\users.ts', R, 'allow', '', CTX_FULL, ['C:/dev/project/src/server/api/users.ts']],

  // --- create-restrict: new files only in seats -------------------------------
  ['create under code_root', 'src/server/api/orders.ts', R, 'allow', '', CTX_FULL, []],
  ['create instructions file', 'CLAUDE.md', R, 'allow', '', CTX_FULL, []],
  ["create the other host's instructions file", 'AGENTS.md', R, 'allow', '', CTX_FULL, []],
  ['create the parked previous copy', 'CLAUDE.old', R, 'allow', '', CTX_FULL, []],
  ['create a parked copy of an undeclared host', 'CODEX.old', R, 'deny', 'is denied', CTX_FULL, []],
  ['create memory file', 'docs/memory/auth.md', R, 'allow', '', CTX_FULL, []],
  ['create study file', 'docs/studies/x.md', R, 'allow', '', CTX_FULL, []],
  ['create lib note', 'docs/lib-notes/pg.md', R, 'allow', '', CTX_FULL, []],
  ['create a feature catalogue entry', 'docs/features/ui/x.md', R, 'allow', '', CTX_FULL, []],
  ['create policy', '.daiku/policies/backend.md', R, 'allow', '', CTX_FULL, []],
  ['create project.json', '.daiku/project.json', R, 'allow', '', CTX_FULL, []],
  ['create environment.json', '.daiku/environment.json', R, 'allow', '', CTX_FULL, []],
  ['create the machine local environment', '.daiku/environment.local.json', R, 'allow', '', CTX_FULL, []],
  ['create a stray file under .daiku/', '.daiku/scratch.json', R, 'deny', 'is denied', CTX_FULL, []],
  ['create the machine host settings', '.claude/settings.local.json', R, 'allow', '', CTX_FULL, []],
  ['create a stray file under .claude/', '.claude/settings.json', R, 'deny', 'is denied', CTX_FULL, []],
  ['create the update script', '.daiku/update.mjs', R, 'allow', '', CTX_FULL, []],
  ['create the editor tasks file', '.vscode/tasks.json', R, 'allow', '', CTX_FULL, []],
  ['create a stray file under .vscode/', '.vscode/settings.json', R, 'deny', 'is denied', CTX_FULL, []],
  ['monorepo: edit the root .gitignore above the technical root', 'C:/dev/.gitignore', R, 'allow', '', CTX_MONO, ['C:/dev/.gitignore']],
  ['monorepo: create the root .gitignore above the technical root', 'C:/dev/.gitignore', R, 'allow', '', CTX_MONO, []],
  ['monorepo: edit a changelog above the technical root', 'C:/dev/CHANGELOG.md', R, 'allow', '', CTX_MONO, ['C:/dev/CHANGELOG.md']],
  ['monorepo: create a stray file above the technical root', 'C:/dev/notes.md', R, 'deny', 'is denied', CTX_MONO, []],
  ['no repo_root: a file above the technical root stays outside', 'C:/dev/.gitignore', R, 'deny', 'outside the repository', CTX_FULL, ['C:/dev/.gitignore']],
  ['create the .gitignore of the technical root', '.gitignore', R, 'allow', '', CTX_FULL, []],
  ['create stray note at root', 'notes-random.md', R, 'deny', 'is denied', CTX_FULL, []],
  ['create stray doc outside seats', 'docs/scratch.md', R, 'deny', 'is denied', CTX_FULL, []],
  ['create outside the repo', 'C:/other/x.md', R, 'deny', 'outside the repository', CTX_FULL, []],
  ['create in review_state outside repo', 'C:/dev/review-state/ledger.json', R, 'allow', '', CTX_FULL, []],
  ['create in temp_dir outside repo', 'C:/dev/tmp/work.json', R, 'allow', '', CTX_FULL, []],
  ['create in OS temp', 'C:/Temp/work.json', R, 'allow', '', CTX_FULL, []],
  ['create in home', 'C:/Users/me/x.md', R, 'deny', 'outside the repository', CTX_FULL, []],
  ['edit existing outside seat file', 'C:/dev/review-state/ledger.json', R, 'allow', '', CTX_FULL, ['C:/dev/review-state/ledger.json']],
  ['create inside a write root outside repo', 'C:/dev/work/x.md', R, 'allow', '', fakeContext({ writeRoots: ['C:/dev/work'] }), []],
  ['edit inside a write root outside repo', 'C:/dev/work/x.md', R, 'allow', '', fakeContext({ writeRoots: ['C:/dev/work'] }), ['C:/dev/work/x.md']],
  ['create beside a write root, not inside', 'C:/dev/workshop/x.md', R, 'deny', 'outside the repository', fakeContext({ writeRoots: ['C:/dev/work'] }), []],
  ['no write roots: outside stays denied', 'C:/dev/work/x.md', R, 'deny', 'outside the repository', CTX_FULL, []],

  // --- the declared way out is the same key, on both sides of the boundary -----
  // A seat is declared once and holds wherever it stands: the guard reads a path, and the
  // path does not say whether it falls inside the repository.
  ['create inside a write root in the repo', 'notes-seat/x.md', R, 'allow', '', fakeContext({ writeRoots: [`${R}/notes-seat`] }), []],
  ['create beside that write root stays denied', 'notes-seat2/x.md', R, 'deny', 'is denied', fakeContext({ writeRoots: [`${R}/notes-seat`] }), []],
  ['a write root may be the technical root itself', 'notes.md', R, 'allow', '', fakeContext({ writeRoots: [R] }), []],
  ['a write root above the technical root admits the monorepo', 'C:/dev/notes.md', R, 'allow', '', fakeContext({ repoRoot: 'C:/dev', writeRoots: ['C:/dev'] }), []],
  // The denial has to say what to do: a ban with no remedy is what sends the agent to the shell.
  ['the in-repo denial names the key that admits the path', 'notes-random.md', R, 'deny', 'environment.local.json', CTX_FULL, []],
  ['the in-repo denial names `write_roots`', 'notes-random.md', R, 'deny', 'write_roots', CTX_FULL, []],
  ['the outside denial names the key that admits the path', 'C:/other/x.md', R, 'deny', 'environment.local.json', CTX_FULL, []],
  ['missing tech_doc key: create there denied', 'docs/tech.md', R, 'deny', 'is denied', CTX_BARE, []],
  ['missing keys: edit still passes', 'README.md', R, 'allow', '', CTX_BARE, ['C:/dev/project/README.md']],
  ['../ escape denied', '../evil.md', R, 'deny', 'outside the repository', CTX_FULL, []],
  ['missing cwd: relative path allows', 'notes-random.md', null, 'allow', '', CTX_FULL, []],

  // --- worktree: code_root resolves under the work root ------------------------
  ['create in worktree code', 'src/server/api/wt.ts', WT, 'allow', '', fakeContext({ codeRoot: `${WT}/src` }), [], null, WT],
  ['create at worktree root denied', 'notes.md', WT, 'deny', 'is denied', fakeContext({ codeRoot: `${WT}/src` }), [], null, WT],

  // --- apply_patch payloads ------------------------------------------------------
  ['apply_patch with file_path', null, R, 'allow', '', CTX_FULL, [], { file_path: 'src/a.ts' }],
  ['apply_patch patch creating in seat', null, R, 'allow', '', CTX_FULL, [], { patch: '--- a/dev/null\n+++ b/src/b.ts\n@@ -0,0 +1 @@\n+x\n' }],
  ['apply_patch patch creating stray', null, R, 'deny', 'is denied', CTX_FULL, [], { patch: '--- a/dev/null\n+++ b/stray.md\n@@ -0,0 +1 @@\n+x\n' }],
  ['apply_patch unparsable allows', null, R, 'allow', '', CTX_FULL, [], { opaque: 1 }],
];

function selfCheck() {
  const failed = [];
  let ran = 0;

  for (const [name, file, cwd, expected, contains, ctx, existing, input, caseRoot] of CASES) {
    ran += 1;
    let outcome;
    try {
      const env = fakeEnv(existing || []);
      const root = caseRoot || R;
      outcome = input
        ? safeDecide(input, cwd, env, ctx || CTX_FULL, root)
        : safeDecide({ file_path: file }, cwd, env, ctx || CTX_FULL, root);
    } catch (error) {
      failed.push(`${name}: exception ${error && error.message}`);
      continue;
    }
    const decision = outcome ? 'deny' : 'allow';
    if (decision !== expected) {
      failed.push(`${name}: expected ${expected}, got ${decision}${outcome ? ` (${outcome.reason.slice(0, 100)})` : ''}`);
      continue;
    }
    if (expected === 'deny' && contains && !outcome.reason.includes(contains)) {
      failed.push(`${name}: deny, but reason does not contain "${contains}"`);
    }
  }

  // Fail-open: an environment that throws on every question must allow.
  const broken = {
    exists: () => {
      throw new Error('filesystem unreachable');
    },
    tmpdir: () => {
      throw new Error('tmp unreachable');
    },
  };
  for (const file of ['notes-random.md', 'src/a.ts', 'C:/other/x.md']) {
    ran += 1;
    let decision;
    try {
      decision = safeDecide({ file_path: file }, R, broken, CTX_FULL, R);
    } catch (error) {
      failed.push(`fail-open on \`${file}\`: threw ${error && error.message}`);
      continue;
    }
    if (decision) failed.push(`broken environment on \`${file}\`: expected allow, got deny`);
  }

  // Seats really resolve from a `project.json` + `environment.json`.
  const readers = (file) => ({
    exists: (p) => Object.prototype.hasOwnProperty.call(file, String(p).replace(/\\/g, '/')),
    read: (p) => {
      const key = String(p).replace(/\\/g, '/');
      if (!Object.prototype.hasOwnProperty.call(file, key)) throw new Error('ENOENT');
      return file[key];
    },
  });
  const proj = {
    'C:/dev/project/.daiku/project.json': JSON.stringify({
      contract: 1,
      code_root: 'src/',
      memory: { root: 'docs/memory', index: 'MEMORY.md' },
      paths: { studies: 'docs/studies', lib_notes: 'docs/lib-notes' },
    }),
    'C:/dev/project/.daiku/environment.json': JSON.stringify({
      contract: 1,
      temp_dir: 'tmp-env',
      hosts: {
        claude: { instructions_file: 'CLAUDE.md' },
        codex: { instructions_file: 'AGENTS.md' },
      },
    }),
  };
  ran += 1;
  const read = loadContext('C:/dev/project', readers(proj));
  if (!read.present || !isInside('C:/dev/project/src/a.ts', read.codeRoot)) {
    failed.push('code seat does not resolve from project.json');
  }
  ran += 1;
  if (!read.tempDir || !isInside('C:/dev/project/tmp-env/x', read.tempDir)) {
    failed.push('tempDir does not resolve from the project environment file');
  }
  ran += 1;
  // Both hosts' files, each with its parked copy: the seat is per host, and `init`
  // parks the file it found before writing the new one.
  const seats = (read.instructionsFiles || []).map((p) => resolve(p).replace(/\\/g, '/'));
  for (const wanted of [
    'C:/dev/project/CLAUDE.md',
    'C:/dev/project/CLAUDE.old',
    'C:/dev/project/AGENTS.md',
    'C:/dev/project/AGENTS.old',
  ]) {
    ran += 1;
    if (!seats.includes(wanted)) failed.push(`instructions seat does not resolve: ${wanted}`);
  }
  ran += 1;
  if (read.hostLocalSettings !== resolve('C:/dev/project/.claude/settings.local.json')) {
    failed.push('host local settings seat does not resolve under the technical root');
  }
  ran += 1;
  if (read.updateScript !== resolve('C:/dev/project/.daiku/update.mjs')) {
    failed.push('update script seat does not resolve under the technical root');
  }
  ran += 1;
  if (read.editorTasks !== resolve('C:/dev/project/.vscode/tasks.json')) {
    failed.push('editor tasks seat does not resolve under the technical root');
  }
  ran += 1;
  if (read.repoRoot !== null || read.repoGitignore !== resolve('C:/dev/project/.gitignore')) {
    failed.push('without repo_root the .gitignore seat must be the technical root one');
  }
  ran += 1;
  const mono = loadContext('C:/dev/project', readers({
    'C:/dev/project/.daiku/project.json': JSON.stringify({ contract: 1, repo_root: 'C:/dev' }),
  }));
  if (mono.repoRoot !== resolve('C:/dev') || mono.repoGitignore !== resolve('C:/dev/.gitignore')) {
    failed.push('repo_root does not resolve the repository root and its .gitignore');
  }
  ran += 1;
  const localWins = loadContext('C:/dev/project', readers({
    ...proj,
    'C:/dev/project/.daiku/environment.local.json': JSON.stringify({ contract: 1, temp_dir: 'tmp-local' }),
  }));
  if (!localWins.tempDir || !isInside('C:/dev/project/tmp-local/x', localWins.tempDir)) {
    failed.push('tempDir does not let the machine local file win whole');
  }
  ran += 1;
  const rootsLocal = loadContext('C:/dev/project', readers({
    ...proj,
    'C:/dev/project/.daiku/environment.local.json': JSON.stringify({ contract: 1, write_roots: ['C:/dev/work'] }),
  }));
  if (!(rootsLocal.writeRoots || []).some((r) => isInside('C:/dev/work/x.md', r))) {
    failed.push('write_roots does not resolve from the machine local file');
  }
  ran += 1;
  const rootsWhole = loadContext('C:/dev/project', readers({
    'C:/dev/project/.daiku/project.json': '{"contract": 1}',
    'C:/dev/project/.daiku/environment.local.json': '{"contract": 1}',
    'C:/dev/project/.daiku/environment.json': JSON.stringify({ contract: 1, write_roots: ['C:/dev/work'] }),
  }));
  if ((rootsWhole.writeRoots || []).length !== 0) {
    failed.push('write_roots must take the local file whole, not fall through to the project one');
  }
  ran += 1;
  const noTemp = loadContext('C:/dev/project', readers({
    'C:/dev/project/.daiku/project.json': '{"contract": 1}',
  }));
  if (noTemp.tempDir !== null) {
    failed.push('an absent temp_dir must read as null, not as a guessed path');
  }
  ran += 1;
  const brokenJson = loadContext('C:/dev/project', readers({
    'C:/dev/project/.daiku/project.json': '{"contract": 1,}',
  }));
  if (brokenJson.present !== false) failed.push('broken JSON must read as absent');

  process.stdout.write(
    JSON.stringify({ checks: ran, passed: ran - failed.length, failed }, null, 2) + '\n'
  );
  return failed.length ? 1 : 0;
}

// --- Shapes this guard does NOT cover ---------------------------------------
//
// Declared on purpose: a guard silent about what it does not see makes readers believe it covers it.
//
//  - **A target built by the shell** (`cat > file`, `echo >> file`, pipelines,
//    heredoc bodies): `PreToolUse` on Edit never sees the line. Shell-built targets
//    belong to `command-guard.mjs`, which does not watch them either.
//  - **`powershell -EncodedCommand <base64>`** and every other obfuscated shape.
//  - **An already-written script** (`bash cleanup.sh`, `python cleanup.py`): the
//    write lives in the file, not the tool call.
//  - **Other writers**: `robocopy /MIR`, `git apply` run from the shell.
//  - **Deletions**: `rm`, `git clean`, `git reset --hard` are not this guard's
//    business; removals crossing a junction belong to `command-guard.mjs`.
//  - **An agent editing a wrong *existing* file**: edit-allow passes it. Placement
//    of edits inside `{code_root}` is judged by the `arch` finder, not denied here.
//  - **Subagents launched outside this harness**, which this guard does not see at all.
//  - **Every project that has not opened Daiku**: without `.daiku/project.json`
//    everything is allowed — the wanted boundary, not a limit.
//  - **The owner's terminal**, where this hook does not run at all.

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) allow();
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    allow();
  }
  const input = (event && event.tool_input) || {};
  const cwd = (event && event.cwd) || ROOT;
  if (!input || typeof input !== 'object') allow();
  const root = projectRoot({ cwd });
  const outcome = safeDecide(input, cwd, REAL_ENV, loadContext(root, REAL_READS), root);
  if (outcome) deny(outcome.reason);
  allow();
}

if (invokedDirectly(import.meta.url)) {
  if (process.argv.includes('--self-check')) {
    process.exit(selfCheck());
  }
  main().catch(() => process.exit(0));
}
