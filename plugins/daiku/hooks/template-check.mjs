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
 * the package file. It also checks the update task `init` lays down: the
 * `templates/vscode/tasks.json` skeleton carries one `daiku: update` shell task
 * running `.daiku/update.mjs` — a shell task because the script asks a question,
 * and a `process` task has no terminal to ask it in — and `templates/project/update.mjs`
 * reads the two versions — the one in place from the host, the one arriving out of the
 * refreshed catalogue — draws the delta, asks before it runs the two update commands in
 * order, and stays silent where there is no terminal — and that it **parses**: the substrings
 * above are searched in its text, and a text search says nothing of a file that no longer runs,
 * so `node --check` reads it as well, without executing a line of it. It checks too the marker
 * `init` fills on
 * every script it deposits — `daiku:script <version>` — which the skeleton must carry as a
 * placeholder: a literal there would be a second seat of the package version, and it is from
 * that line that a relaunched `init` recognises a script written by an older Daiku and
 * recreates it whole — and that the script reads back, to say whether the project itself is
 * aligned to the package the update just fetched. And it checks the five founding-document skeletons under
 * `templates/project/documents/` — the file is there, the `H1` is the role in uppercase, the index
 * lists exactly the numbered sections in order, and the closing section is there: that frame is
 * what tells a document of this kind from a file of the project's standing at the same seat, which
 * `new-project` closes into the git stash instead of overwriting. What it deliberately does not check:
 * key-level acceptance by
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

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

/** Entry keys the package itself uses, both of a `hooks.json` entry and of the hook object inside
 * it. An entry-level `description` is not among them: the manifests' only `description` is the
 * template's top-level note, covered by the top-level check. */
const KNOWN_ENTRY_KEYS = new Set([
  'type',
  'command',
  'timeout',
  'matcher',
  'hooks',
  'statusMessage',
]);

/** Modules of `lib/` that are imported, not hooked (sync-host step 4 knows them too). */
const NOT_HOOKS = new Set(['project-root.mjs', 'daiku-config.mjs']);

function readJson(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf-8'));
}

/**
 * Does Node parse this file? `--check` reads and parses it without running a line: a skeleton is
 * held to the same standard as the package's own modules, and the version placeholder of the
 * marker line — a comment — costs nothing. A text search cannot answer this, and it is the whole
 * reason the check is here: the substrings are all found in a file that no longer runs.
 */
function parses(absolute) {
  const run = spawnSync(process.execPath, ['--check', absolute], { encoding: 'utf-8' });
  return !run.error && run.status === 0;
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
        for (const key of Object.keys(entry || {})) {
          check(`${label} ${event} entry key ${key} is known`, KNOWN_ENTRY_KEYS.has(key));
        }
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

  // The update task `init` lays down: one task, the label users call it by, running the
  // script `init` copies beside it — and the script shows the version, asks, and only on a
  // yes runs the two update commands, in order.
  let tasks = null;
  try {
    tasks = readJson('templates/vscode/tasks.json');
    check('vscode tasks template parses', true);
  } catch {
    check('vscode tasks template parses', false);
  }
  const updateTasks = ((tasks && tasks.tasks) || []).filter((t) => t && t.label === 'daiku: update');
  check('vscode tasks template carries exactly one daiku: update task', updateTasks.length === 1);
  const task = updateTasks[0] || {};
  // A **shell** task, and not for style: a `process` task runs the command with no terminal,
  // and a script that asks a question could never ask it there.
  check(
    'daiku: update runs node on .daiku/update.mjs, in a shell task',
    task.type === 'shell' && task.command === 'node .daiku/update.mjs'
  );
  let script = '';
  try {
    script = readFileSync(join(ROOT, 'templates', 'project', 'update.mjs'), 'utf-8');
  } catch {
    script = '';
  }
  check('update script template exists', script !== '');
  const marketplace = script.indexOf("'claude plugin marketplace update daiku'");
  const plugin = script.indexOf("'claude plugin update daiku@daiku --json'");
  check('update script refreshes the marketplace, then updates the plugin', marketplace !== -1 && plugin > marketplace);
  // The two versions, and where they come from: the one in place asks the host, the one arriving
  // reads the catalogue clone the refresh just left — the only way `>>>` can be drawn, with what is
  // out there, before anything changes.
  check('update script reads the version in place from the host', script.includes('claude plugin list --json'));
  check(
    'update script reads the arriving version out of the refreshed catalogue',
    script.includes('claude plugin marketplace list --json') && script.includes('plugin.json')
  );
  check('update script draws the version delta', script.includes('>>>'));
  // The question, and the terminal that makes it askable: where there is none, the script says
  // so and changes nothing rather than updating on an answer nobody gave.
  check(
    'update script asks before updating',
    script.includes('Update Daiku now?') && script.includes('Not now')
  );
  check('update script asks only where there is a terminal', script.includes('process.stdin.isTTY'));
  // The marker of the version that wrote it, and the reason `init` may rewrite the file: it is a
  // package artefact, and the version in that line is the package's. It travels as a placeholder
  // because a literal here would be a second seat of the version, drifting from the manifests.
  check(
    'update script template carries the version marker as a placeholder',
    script.includes('daiku:script <version>')
  );
  check(
    'update script template carries one daiku:script marker line, and no more',
    (script.match(/^\/\/ daiku:script/gm) || []).length === 1
  );
  check(
    'update script template parses: a skeleton that does not run ships broken',
    parses(join(ROOT, 'templates', 'project', 'update.mjs'))
  );
  // The check above is worth something only if it can go red, and it is the one thing a text search
  // cannot do: a file that does not parse, written for the occasion in the system temp folder.
  const scratch = mkdtempSync(join(tmpdir(), 'daiku-parse-'));
  const broken = join(scratch, 'broken.mjs');
  writeFileSync(broken, 'const x = ;\n', 'utf-8');
  check('the parse check goes red on a file that does not parse', !parses(broken));
  check('the parse check goes red where the file is not there', !parses(join(scratch, 'absent.mjs')));
  rmSync(scratch, { recursive: true, force: true });
  // And the line closing the run, which is what tells the two cases apart after an update: the
  // project aligned to the package, or the project left behind by it.
  check(
    'update script says whether the project is aligned to the package',
    script.includes('function alignment(') && script.includes('/daiku:init')
  );

  // The five founding-document skeletons: the frame `new-project` keys on to tell a document of
  // this kind from a file of the project's at the same seat. The roles are fixed by the method and
  // `documents.<role>` resolves each by name, so what is decidable without a host is decided here.
  const ROLES = ['PRODUCT', 'BRAND', 'DOMAIN', 'STACK', 'ARCHITECTURE'];
  const documentDir = join(ROOT, 'templates', 'project', 'documents');
  let documents = [];
  try {
    documents = readdirSync(documentDir).filter((name) => name.endsWith('.md')).sort();
  } catch {
    documents = [];
  }
  check(
    'the package carries the five founding-document skeletons, and no more',
    documents.length === ROLES.length && ROLES.every((role) => documents.includes(`${role}.md`))
  );
  for (const role of ROLES) {
    let text = '';
    try {
      text = readFileSync(join(documentDir, `${role}.md`), 'utf-8');
    } catch {
      text = '';
    }
    check(`${role}.md exists`, text !== '');
    const lines = text.split(/\r?\n/);
    check(`${role}.md opens with its H1`, lines[0] === `# ${role}`);
    // The guide paragraph: it says what the document must contain and what does not belong there,
    // and it is the one part of the frame that tells whoever opens the file whether they are even in
    // the right one. A skeleton without it produces documents nobody can use correctly.
    const guide = lines.slice(1).find((line) => line.trim()) || '';
    check(
      `${role}.md carries the guide paragraph under its H1`,
      guide.startsWith('> ') && guide.includes('**What goes here.**')
    );
    const sections = lines
      .filter((line) => /^## \d+\. /.test(line))
      .map((line) => line.replace(/^## \d+\.\s+/, '').trim());
    const contents = lines.indexOf('## Contents');
    const firstSection = lines.findIndex((line) => /^## \d+\. /.test(line));
    const indexed =
      contents === -1 || firstSection === -1
        ? []
        : lines
            .slice(contents + 1, firstSection)
            .filter((line) => line.trim())
            .map((line) => line.replace(/^\d+\.\s+/, '').trim());
    check(
      `${role}.md's index lists exactly its numbered sections, in order`,
      sections.length > 0 && indexed.join('|') === sections.join('|')
    );
    check(
      `${role}.md closes with what the document rests on`,
      sections.length > 0 && sections[sections.length - 1].toLowerCase().startsWith('what this rests on')
    );
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
