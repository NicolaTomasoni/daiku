#!/usr/bin/env node
/**
 * PostToolUse on `Edit|Write|MultiEdit` — runs deterministic checks on the gesture that
 * introduces the defect, instead of on a later gesture that may never come.
 *
 * Why here and not in a commit gate: whoever rewrites a contract **might not
 * commit at all**. A broken frontmatter stays in the working tree until somebody notices —
 * and meanwhile the skill loads with emptied metadata and nobody finds it anymore.
 *
 * It covers four things, the four that break silently in a Daiku project:
 *
 *  1. **A `SKILL.md` frontmatter.** The worst corpus fault because it does not
 *     fail: the skill *loads anyway*, with emptied metadata, so the model
 *     never finds it by relevance. Two shapes, both seen in the wild: an unquoted
 *     value containing `: ` closes the key halfway (happens in every `description`
 *     with an aside), and one starting with `[` reads as a flow sequence (happens in
 *     every `argument-hint`, which is made of `[folder] [solution]`).
 *  2. **The two `.daiku/` JSON files.** `project.json` and `environment.json` are the only source
 *     of project values: every contract opens them before acting. An unparsable JSON
 *     switches them all off together.
 *  3. **Area rules in `.daiku/policies/`.** They are selected by their frontmatter
 *     `paths`: without that key the rule exists but is never picked.
 *  4. **The guards themselves.** A rewritten guard is verified with its own test bench,
 *     not by eye — and this hook **reminds**, it does not run.
 *
 * **It reports, does not block.** The exit code is always `0` and there is no branch that blocks: stopping
 * the writing of a contract halfway costs more than the defect being closed. The report
 * arrives as context, and whoever just wrote decides.
 *
 * **And it runs nothing.** Point 4 does not launch `node <file> --self-check` on the freshly
 * written `.mjs`: starting a file *because it appeared* means running code nobody has reviewed yet,
 * bypassing both the confirmation the host asks before launching a command and the hash approval
 * Codex demands precisely for hooks. A hook that says "run the bench" and a hook that runs it alone
 * have the same diagnostic value and a very different risk perimeter.
 *
 * No gate on `.daiku/`, and that is deliberate: this hook denies nothing to anybody, and a
 * YAML frontmatter silently emptying is a fault even for whoever does not have Daiku.
 * The guard that **denies** has the gate, and lives in `command-guard.mjs`.
 *
 * **Fail-open and silent.** Unreadable stdin, out-of-scope path, missing file, `node`
 * not starting, unparsable output, timeout → prints nothing and exits 0. It is the same
 * choice as the other two guards, at the same price: a fault is indistinguishable from
 * silence. That is why the perimeter has a test bench.
 *
 * Test bench: `node contracts-post-edit.mjs --self-check`. The total is counted, not
 * hard-coded.
 */

import { readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { invokedDirectly, projectRoot } from './project-root.mjs';

const ROOT = projectRoot();

/** The written path, reduced to a posix relative from the root. `null` if outside. */
export function relativeToRoot(inputPath, root) {
  if (!inputPath) return null;
  const absolute = isAbsolute(inputPath) ? inputPath : join(root, inputPath);
  const rel = relative(root, absolute).replace(/\\/g, '/');
  if (!rel || rel.startsWith('../')) return null;
  return rel;
}

/**
 * What is worth checking after writing `rel`. A pure function: it is the perimeter, and
 * it is the part the test bench verifies line by line.
 */
export function plan(rel) {
  if (!rel) return [];

  // A rewritten guard is verified with its own bench: the other checks read
  // markdown and have nothing to say on a `.mjs`.
  //
  // The perimeter is **any** `hooks/` folder inside the root, with or without `lib/`,
  // because the real seats are three: `.codex/hooks/`
  // in the Codex guest project, `hooks/lib/` in a package under development,
  // `.claude/hooks/` in a project hooking the guards on its own. On Claude Code,
  // with Daiku installed as a package, the guards are not in the project at all: they run
  // from the cache, where nobody rewrites them — the case where this branch rightly stays silent.
  if (/(^|\/)hooks\/(lib\/)?[A-Za-z0-9_.-]+\.mjs$/.test(rel)) {
    return [{ label: `test bench for ${rel.split('/').pop()}`, type: 'reminder', target: rel }];
  }

  // The frontmatter of a contract, wherever it lives: the installed package, `.claude/`,
  // `.codex/`, or a project skill.
  if (/(^|\/)SKILL\.md$/.test(rel)) {
    return [{ label: 'contract frontmatter', type: 'frontmatter', target: rel }];
  }

  if (rel === '.daiku/project.json' || rel === '.daiku/environment.json') {
    return [{ label: `syntax of ${rel.split('/').pop()}`, type: 'json', target: rel }];
  }

  if (/^\.daiku\/policies\/[^/]+\.md$/.test(rel) && !rel.endsWith('/README.md')) {
    return [{ label: 'area rule frontmatter', type: 'policy', target: rel }];
  }

  return [];
}

// --- the checks --------------------------------------------------------------
//
// Each takes the text and returns the finding lines. They are pure functions: they read
// a string, do not touch the disk, and the bench tries them one by one.

/** Splits the leading YAML frontmatter. `null` when missing or unclosed. */
export function frontmatter(text) {
  const normalised = String(text).replace(/\r\n/g, '\n');
  if (!normalised.startsWith('---\n')) return null;
  const end = normalised.indexOf('\n---', 3);
  if (end === -1) return null;
  return normalised.slice(4, end + 1);
}

/**
 * Findings on a `SKILL.md` frontmatter. Looks for the two shapes that empty the metadata
 * without failing, plus the two keys the two hosts' validators demand.
 */
export function frontmatterFindings(text) {
  const block = frontmatter(text);
  if (block === null) {
    return ['frontmatter is missing or unclosed: it needs `---` as the first line and `---` to close it'];
  }

  const findings = [];
  const seen = new Map();

  for (const line of block.split('\n')) {
    // Top-level keys only: an indented line belongs to a nested block,
    // where the quoting rules are different.
    const pair = line.match(/^([A-Za-z0-9_-]+):(.*)$/);
    if (!pair) continue;
    const key = pair[1];
    const value = pair[2].trim();
    seen.set(key, value);

    if (!value) continue; // empty here may be a multi-line block: not judged
    const quoted = /^'.*'$/.test(value) || /^".*"$/.test(value);
    if (quoted) continue;

    if (value.includes(': ')) {
      findings.push(
        `\`${key}\` is unquoted and contains \`: \` — YAML closes the key halfway and ` +
          `**all** metadata is silently discarded. Quote it with single quotes.`
      );
    } else if (value.startsWith('[') || value.startsWith('{')) {
      findings.push(
        `\`${key}\` is unquoted and starts with \`${value[0]}\` — YAML reads it as a ` +
          `flow sequence, not as text. Quote it with single quotes.`
      );
    }
  }

  for (const required of ['name', 'description']) {
    if (!seen.has(required)) {
      findings.push(`missing \`${required}\`: both hosts' validators demand it`);
    } else if (!seen.get(required)) {
      findings.push(`\`${required}\` is empty: both hosts' validators reject it`);
    }
  }

  return findings;
}

/** Findings on an area rule frontmatter. */
export function policyFindings(text) {
  const block = frontmatter(text);
  if (block === null) {
    return ['frontmatter is missing or unclosed: without `paths` the rule is never selected'];
  }
  if (!/^paths:/m.test(block)) {
    return ['missing `paths`: the rule exists but no scan ever selects it'];
  }
  return [];
}

/** Findings on a parameter JSON. */
export function jsonFindings(text) {
  try {
    JSON.parse(text);
    return [];
  } catch (error) {
    return [`not valid JSON (${error.message}) — every contract opening it stops here`];
  }
}

/** Runs one step of the plan and returns the lines to report. `[]` when silent or degraded. */
function runStep(step, root, env) {
  const absolute = join(root, step.target);

  if (step.type === 'reminder') {
    return [
      `**${step.label}** — you rewrote a guard. A hook is fail-open: facing a`,
      `fault it stays silent and exits 0, so broken and silent look alike. Test it before`,
      `trusting it, and read the total:`,
      '',
      `    node ${step.target} --self-check`,
      '',
      `On Codex that file asks for approval again: trust is recorded on the hash,`,
      `and until you grant it the hook is skipped.`,
    ];
  }

  let text;
  try {
    text = env.read(absolute);
  } catch {
    return []; // the file vanished between the write and the check: stay silent
  }

  const findings =
    step.type === 'frontmatter'
      ? frontmatterFindings(text)
      : step.type === 'policy'
        ? policyFindings(text)
        : jsonFindings(text);

  if (!findings.length) return [];
  return [`**${step.label}** — ${findings.length} findings:`, ...findings.map((f) => `- ${f}`)];
}

export function report(rel, root, env) {
  const lines = [];
  for (const step of plan(rel)) lines.push(...runStep(step, root, env));
  if (!lines.length) return null;
  return (
    `The deterministic checks have something to say about what you just wrote ` +
    `(\`${rel}\`). **They block nothing**: you decide.\n\n${lines.join('\n')}`
  );
}

const REAL_ENV = {
  read: (path) => readFileSync(path, 'utf-8'),
};

// --- test bench -----------------------------------------------------------

function fakeEnv(files) {
  const key = (p) => String(p).replace(/\\/g, '/').toLowerCase();
  const map = new Map(Object.entries(files).map(([k, v]) => [key(k), v]));
  return {
    read: (p) => {
      if (!map.has(key(p))) throw new Error(`ENOENT ${p}`);
      return map.get(key(p));
    },
  };
}

const R = 'C:/dev/project';

function selfCheck() {
  const failed = [];
  let ran = 0;
  const check = (name, condition) => {
    ran += 1;
    if (!condition) failed.push(name);
  };

  // --- the perimeter: what triggers what ---------------------------------------
  const typesOf = (rel) => plan(rel).map((p) => p.type).join(',');
  check('a project SKILL.md triggers frontmatter', typesOf('.claude/skills/review/SKILL.md') === 'frontmatter');
  check('a Codex SKILL.md triggers frontmatter', typesOf('.codex/skills/review/SKILL.md') === 'frontmatter');
  check('a package SKILL.md triggers frontmatter', typesOf('plugins/daiku/skills/review/SKILL.md') === 'frontmatter');
  check('project.json triggers the JSON check', typesOf('.daiku/project.json') === 'json');
  check('environment.json triggers the JSON check', typesOf('.daiku/environment.json') === 'json');
  check('an area rule triggers its frontmatter', typesOf('.daiku/policies/backend.md') === 'policy');
  check('a Codex guard recalls its own bench', typesOf('.codex/hooks/command-guard.mjs') === 'reminder');
  check('a Claude guard recalls its own bench', typesOf('.claude/hooks/command-guard.mjs') === 'reminder');
  check('a package guard in development too', typesOf('plugins/daiku/hooks/lib/command-guard.mjs') === 'reminder');
  check('and also the module the guards import', typesOf('plugins/daiku/hooks/lib/daiku-config.mjs') === 'reminder');
  check('a guard does not also trigger the other checks', plan('.claude/hooks/command-guard.mjs').length === 1);

  // Out of scope: silence, no reads and no processes.
  for (const outside of [
    'src/index.ts',
    'README.md',
    '.daiku/domain/perf.md',
    '.daiku/policies/README.md',
    'docs/new-developments/x/0. problem.md',
    'package.json',
  ]) {
    check(`out of scope: \`${outside}\``, plan(outside).length === 0);
  }
  check('path outside the root: no plan', plan(relativeToRoot('C:/other/x.md', R)).length === 0);
  check('missing path: no plan', plan(null).length === 0);

  // --- normalization of the written path -----------------------------------
  check('normalised absolute path', relativeToRoot(`${R}/.daiku/project.json`, R) === '.daiku/project.json');
  check('normalised backslash path', relativeToRoot('C:\\dev\\project\\.daiku\\project.json', R) === '.daiku/project.json');
  check('relative path kept', relativeToRoot('.daiku/project.json', R) === '.daiku/project.json');
  check('path outside root: null', relativeToRoot('C:/dev/other/x.md', R) === null);

  // --- frontmatter: the two shapes that empty the metadata ------------------
  const healthy = "---\nname: review\ndescription: 'Review cycle on a diff'\n---\n\nBody.\n";
  check('quoted frontmatter has no findings', frontmatterFindings(healthy).length === 0);

  const unquotedColon = '---\nname: review\ndescription: Review cycle: one diff at a time\n---\n';
  check('unquoted `: ` is a finding', frontmatterFindings(unquotedColon).some((r) => r.includes('closes the key')));

  const unquotedBracket = "---\nname: review\ndescription: 'x'\nargument-hint: [folder] [solution]\n---\n";
  check('unquoted `[` is a finding', frontmatterFindings(unquotedBracket).some((r) => r.includes('flow sequence')));

  const quotedBracket = "---\nname: review\ndescription: 'x'\nargument-hint: '[folder] [solution]'\n---\n";
  check('quoted `[` is not a finding', frontmatterFindings(quotedBracket).length === 0);

  const quotedColon = "---\nname: review\ndescription: 'Review cycle: one diff at a time'\n---\n";
  check('`: ` inside quotes is not a finding', frontmatterFindings(quotedColon).length === 0);

  check('missing frontmatter is a finding', frontmatterFindings('# Prose only\n').length === 1);
  check('unclosed frontmatter is a finding', frontmatterFindings('---\nname: x\n').length === 1);
  check('missing name is a finding', frontmatterFindings("---\ndescription: 'x'\n---\n").some((r) => r.includes('missing `name`')));
  check('empty description is a finding', frontmatterFindings('---\nname: x\ndescription:\n---\n').some((r) => r.includes('`description` is empty')));
  check('CRLF does not change the verdict', frontmatterFindings(healthy.replace(/\n/g, '\r\n')).length === 0);
  check(
    'a nested key is not judged as top-level',
    frontmatterFindings("---\nname: x\ndescription: 'x'\nmetadata:\n  type: project: broken\n---\n").length === 0
  );

  // --- the other two checks ------------------------------------------------
  check('valid JSON has no findings', jsonFindings('{"a": 1}').length === 0);
  check('broken JSON is a finding', jsonFindings('{"a": 1,}').length === 1);
  check('a rule with paths has no findings', policyFindings("---\npaths: ['src/**']\n---\n").length === 0);
  check('a rule without paths is a finding', policyFindings('---\nname: x\n---\n').length === 1);
  check('a rule without frontmatter is a finding', policyFindings('# prose\n').length === 1);

  // --- the report: what it includes and what it omits -----------------------------------
  const clean = fakeEnv({ [`${R}/.claude/skills/review/SKILL.md`]: healthy });
  check('healthy contract: no report', report('.claude/skills/review/SKILL.md', R, clean) === null);

  const broken = fakeEnv({ [`${R}/.claude/skills/review/SKILL.md`]: unquotedColon });
  const text = report('.claude/skills/review/SKILL.md', R, broken);
  check('broken frontmatter reaches the report', !!text && text.includes('closes the key'));
  check('the report states it does not block', !!text && text.includes('block nothing'));
  check('the report names the written file', !!text && text.includes('review/SKILL.md'));

  // --- the guard reminder: reminds, does not run --------------------
  const withoutDisk = {
    read: () => {
      throw new Error('nobody must read a .mjs just to remember to test it');
    },
  };
  const reminder = report('.codex/hooks/command-guard.mjs', R, withoutDisk);
  check('rewriting a guard produces the reminder', !!reminder && reminder.includes('--self-check'));
  check('the reminder names the file to test', !!reminder && reminder.includes('command-guard.mjs'));
  check('the reminder says why: a broken hook stays silent', !!reminder && reminder.includes('fail-open'));
  check('the reminder recalls the Codex approval', !!reminder && reminder.includes('hash'));
  check(
    'no environment can run anything: there is no launcher',
    typeof REAL_ENV.run === 'undefined'
  );

  // --- degradations: each stays silent, none throws ------------------------
  check('missing file: no report', report('.claude/skills/review/SKILL.md', R, fakeEnv({})) === null);
  check('out of scope: no report', report('src/index.ts', R, fakeEnv({})) === null);

  process.stdout.write(
    JSON.stringify({ checks: ran, passed: ran - failed.length, failed }, null, 2) + '\n'
  );
  return failed.length ? 1 : 0;
}

function main() {
  const event = JSON.parse(readFileSync(0, 'utf-8'));
  const rel = relativeToRoot((event.tool_input || {}).file_path, ROOT);
  const text = report(rel, ROOT, REAL_ENV);
  if (!text) return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text },
    })
  );
}

if (invokedDirectly(import.meta.url)) {
  if (process.argv.includes('--self-check')) {
    process.exit(selfCheck());
  }
  try {
    main();
  } catch {
    /* fail-open: never stop a write that already happened */
  }
  process.exit(0);
}
