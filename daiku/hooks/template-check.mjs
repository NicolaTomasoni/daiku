#!/usr/bin/env node
/**
 * The bench of the host manifests: the package `hooks/hooks.json` and the
 * `templates/codex/hooks.json` skeleton `sync-host` writes from.
 *
 * It exists because of a fault seen in the wild: a manifest carrying keys its
 * host does not know — a `$schema` at the top, a `description` on an entry —
 * warns on every start, and a hook wired in `lib/` but forgotten in the manifest
 * never runs, which on a fail-open hook is indistinguishable from silence. Both
 * stay invisible until somebody runs the real validators before a release, so
 * this bench checks beforehand what is decidable without them.
 *
 * What it checks, on both files: they parse; their top-level keys are the ones
 * the host reads; no event list is empty; every `command` resolves to a `.mjs`
 * the package really carries; every hook of `lib/` with a bench is hooked in
 * the package file. What it deliberately does not check: key-level acceptance by
 * the hosts — neither real validator looks inside these files (verified with
 * `validate_plugin.py`, which is silent on hooks, on 2026-09-26), so `description`
 * stays in the Codex template until a validator rejects it for real. The day a
 * validator checks, its version goes in the comment below and the sets follow it.
 *
 * Test bench: `node template-check.mjs --self-check`. Counted JSON
 * `{checks, passed, failed[]}`, exit 1 on the first red. `hooks/self-check.mjs`
 * launches it with the other benches. It is not a hook and is never installed
 * into a project: it lives beside `self-check.mjs`, which `sync-host` does not copy.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { invokedDirectly } from './lib/project-root.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/** Event names the two hosts document for these manifests, as of 2026-09-26. */
const KNOWN_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'SessionStart',
  'SessionEnd',
  'Stop',
  'Notification',
  'UserPromptSubmit',
  'SubagentStop',
  'PreCompact',
];

/** Entry keys the package itself uses, plus `description`: the template's only
 * annotation, which the Codex validator does not reject (verified 2026-09-26). */
const KNOWN_ENTRY_KEYS = new Set([
  'type',
  'command',
  'timeout',
  'matcher',
  'hooks',
  'description',
  'statusMessage',
]);

/** Modules of `lib/` that are imported, not hooked (sync-host step 4 knows them too). */
const NOT_HOOKS = new Set(['project-root.mjs', 'daiku-config.mjs']);

function readJson(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf-8'));
}

/** The lib file a `command` points at, or `null` when the shape is unknown. */
function targetOf(command) {
  if (typeof command !== 'string') return null;
  const cleaned = command.replace(/"+$/, '');
  const slash = cleaned.lastIndexOf('/');
  if (slash === -1) return null;
  const name = cleaned.slice(slash + 1);
  return name.endsWith('.mjs') ? name : null;
}

function selfCheck() {
  const failed = [];
  let ran = 0;
  const check = (name, condition) => {
    ran += 1;
    if (!condition) failed.push(name);
  };

  let pkg = null;
  let template = null;
  try {
    pkg = readJson('hooks/hooks.json');
    check('package hooks.json parses', true);
  } catch {
    check('package hooks.json parses', false);
  }
  try {
    template = readJson('templates/codex/hooks.json');
    check('codex template hooks.json parses', true);
  } catch {
    check('codex template hooks.json parses', false);
  }
  if (!pkg || !template) {
    process.stdout.write(JSON.stringify({ checks: ran, passed: ran - failed.length, failed }, null, 2) + '\n');
    return 1;
  }

  // Top-level keys: the hosts read `hooks` (and the template's own note). A `$schema`
  // smuggled here is the warning-on-every-start seen in the wild.
  check('package top level carries only hooks', Object.keys(pkg).join(',') === 'hooks');
  const topKeys = Object.keys(template).sort().join(',');
  check('template top level carries only hooks and its note', topKeys === 'description,hooks' || topKeys === 'hooks');

  for (const [label, manifest, placeholder] of [
    ['package', pkg.hooks, null],
    ['template', template.hooks, '<REPO_ROOT>'],
  ]) {
    const events = manifest && typeof manifest === 'object' ? manifest : {};
    for (const [event, entries] of Object.entries(events)) {
      check(`${label} event ${event} is known`, KNOWN_EVENTS.includes(event));
      check(`${label} event ${event} is not empty`, Array.isArray(entries) && entries.length > 0);
      for (const entry of entries || []) {
        const hooks = entry && Array.isArray(entry.hooks) ? entry.hooks : [];
        for (const hook of hooks) {
          for (const key of Object.keys(hook || {})) {
            check(`${label} ${event} entry key ${key} is known`, KNOWN_ENTRY_KEYS.has(key));
          }
          const target = targetOf(hook && hook.command);
          check(
            `${label} ${event} command resolves to a lib file`,
            !!target && target.endsWith('.mjs')
          );
          if (target && target.endsWith('.mjs')) {
            let exists = false;
            try {
              readFileSync(join(ROOT, 'hooks', 'lib', target.replace(/^.*\//, '')));
              exists = true;
            } catch {
              exists = false;
            }
            check(`${label} ${event} target ${target} exists in lib/`, exists);
          }
          if (placeholder) {
            check(
              `${label} ${event} command carries the placeholder, not a machine path`,
              typeof hook.command === 'string' && hook.command.includes(placeholder)
            );
          } else {
            check(
              `${label} ${event} command carries no placeholder`,
              typeof hook.command !== 'string' || !hook.command.includes('<REPO_ROOT>')
            );
          }
        }
      }
    }
  }

  // Every hook of lib/ with a bench is hooked in the package file: a wired file
  // forgotten here never runs, and on a fail-open hook nobody notices.
  let lib = [];
  try {
    lib = readdirSync(join(ROOT, 'hooks', 'lib'))
      .filter((name) => name.endsWith('.mjs') && !NOT_HOOKS.has(name))
      .sort();
  } catch {
    lib = [];
  }
  const hooked = new Set();
  for (const entries of Object.values(pkg.hooks || {})) {
    for (const entry of entries || []) {
      for (const hook of (entry && entry.hooks) || []) {
        const target = targetOf(hook && hook.command);
        if (target) hooked.add(target.replace(/^.*\//, ''));
      }
    }
  }
  for (const name of lib) {
    check(`lib hook ${name} is hooked in the package manifest`, hooked.has(name));
  }

  process.stdout.write(JSON.stringify({ checks: ran, passed: ran - failed.length, failed }, null, 2) + '\n');
  return failed.length ? 1 : 0;
}

if (invokedDirectly(import.meta.url)) {
  if (process.argv.includes('--self-check')) {
    process.exit(selfCheck());
  }
  process.exit(0);
}
