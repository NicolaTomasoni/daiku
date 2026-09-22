/**
 * The project root, for a hook running on Claude Code **or** on Codex.
 *
 * The two hosts do not hand out the same thing, and the difference is not cosmetic:
 *
 *  - **Claude Code** exports `CLAUDE_PROJECT_DIR`, which is the true root however
 *    the session was opened.
 *  - **Codex** has no equivalent. It documents `PLUGIN_ROOT` and `PLUGIN_DATA` — plus the
 *    compatibility aliases `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` — but those
 *    point at the **installed package**, not the project, and for a hook declared in
 *    `.codex/hooks.json` they are not even set. There only the session cwd remains.
 *
 * And the session cwd **is not** the root: opening Codex inside a subfolder hands it
 * over as cwd, and a hook believing it would compute wrong relative paths — with
 * the effect, for a fail-open guard, of staying silent instead of failing loudly. It is the
 * Codex documentation that says to resolve from the git root rather than trusting a path
 * relative to the cwd.
 *
 * So the order is: the host variable when present, then the git root, then the cwd as
 * last resort. None of the three steps throws: a wrong root degrades, an
 * exception here would switch the hook off.
 */

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Was this module launched as a program, or imported by someone else?
 *
 * Needed because the three hooks **export** the functions their test bench checks,
 * and a module reading stdin and exiting `0` on load alone cannot be imported:
 * anyone trying to call one of its functions from outside would see the process die in silence, which is
 * the worst way to fail in a file whose contract is "stay silent when you have nothing to
 * say".
 *
 * The comparison is between resolved paths with no case distinction, because on Windows the
 * same file is spelled several ways. If anything goes wrong the answer is **yes**: in
 * doubt a hook does its job, instead of staying silent over a string comparison.
 */
export function invokedDirectly(metaUrl) {
  try {
    const launched = process.argv[1];
    if (!launched) return true;
    return resolve(fileURLToPath(metaUrl)).toLowerCase() === resolve(launched).toLowerCase();
  } catch {
    return true;
  }
}

/** The git root starting from `from`, or `null` when git does not answer or we are outside a repo. */
export function gitRoot(from, run = spawnSync) {
  try {
    const result = run('git', ['rev-parse', '--show-toplevel'], {
      cwd: from,
      encoding: 'utf-8',
      timeout: 5000,
    });
    if (!result || result.status !== 0 || !result.stdout) return null;
    const line = String(result.stdout).trim();
    return line || null;
  } catch {
    return null;
  }
}

/**
 * The root, with the full chain. `overrides` exists for the test bench: it carries
 * the environment variables, the cwd and the launcher, keeping the function pure.
 */
export function projectRoot(overrides = {}) {
  const env = overrides.env || process.env;
  const cwd = overrides.cwd || process.cwd();
  const run = overrides.run || spawnSync;

  // Claude Code: the root declared by the host, which is always the right one.
  if (env.CLAUDE_PROJECT_DIR) return env.CLAUDE_PROJECT_DIR;

  // Codex: no project variable, climb from the cwd.
  const root = gitRoot(cwd, run);
  if (root) return root;

  // Outside a repo: the cwd remains, and that is the best that can be said.
  return cwd;
}
