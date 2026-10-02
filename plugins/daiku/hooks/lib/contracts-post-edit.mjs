#!/usr/bin/env node
/**
 * PostToolUse on `Edit|Write|MultiEdit` — runs deterministic checks on the gesture that
 * introduces the defect, instead of on a later gesture that may never come.
 *
 * Why here and not in a commit gate: whoever rewrites a contract **might not
 * commit at all**. A broken frontmatter stays in the working tree until somebody notices —
 * and meanwhile the skill loads with emptied metadata and nobody finds it anymore.
 *
 * It covers five things, the five that break silently in a Daiku project:
 *
 *  1. **A `SKILL.md` frontmatter.** The worst corpus fault because it does not
 *     fail: the skill *loads anyway*, with emptied metadata, so the model
 *     never finds it by relevance. Two shapes, both seen in the wild: an unquoted
 *     value containing `: ` closes the key halfway (happens in every `description`
 *     with an aside), and one starting with `[` reads as a flow sequence (happens in
 *     every `argument-hint`, which is made of `[folder] [solution]`).
 *  2. **The `.daiku/` JSON files.** `project.json`, `environment.json` and the machine's
 *     `environment.local.json` are the only source of project values: every contract
 *     opens them before acting. An unparsable JSON switches them all off together — and
 *     one key a table forbids is reported too, not only the syntax: a `base_url` on a
 *     host's native backend, which §7 of `contracts/orchestration.md` wants absent.
 *  3. **Area rules in `.daiku/policies/`.** They are selected by their frontmatter
 *     `paths`: without that key the rule exists but is never picked.
 *  4. **The guards themselves.** A rewritten guard is verified with its own test bench,
 *     not by eye — and this hook **reminds**, it does not run.
 *  5. **Source hygiene under a policy's watch.** Leftover `console.log`, secrets in
 *     clear text and the project's own smells pass silently until the review: a policy
 *     declaring `hygiene:` patterns gets the matching lines reported with file and
 *     line. The patterns are the project's judgement, read from its policies — never
 *     literals in this file — and the report decides nothing: whoever just wrote decides.
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
 * choice as the other guards, at the same price: a fault is indistinguishable from
 * silence. That is why the perimeter has a test bench.
 *
 * Test bench: `node contracts-post-edit.mjs --self-check`. The total is counted, not
 * hard-coded.
 */

import { readdirSync, readFileSync } from 'node:fs';
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

  if (rel === '.daiku/project.json' || /^\.daiku\/environment(\.[a-z]+)?\.json$/.test(rel)) {
    return [{ label: `syntax of ${rel.split('/').pop()}`, type: 'json', target: rel }];
  }

  if (/^\.daiku\/policies\/[^/]+\.md$/.test(rel) && !rel.endsWith('/README.md')) {
    return [{ label: 'area rule frontmatter', type: 'policy', target: rel }];
  }

  // Source hygiene: every other written file that is not a dotfile and not under
  // `.daiku/` is read against the policies watching it. A file no policy covers stays
  // silent — the step reads the policies, finds no `paths:` matching it, and says nothing.
  if (!rel.startsWith('.') && !rel.startsWith('.daiku/')) {
    return [{ label: `hygiene of ${rel.split('/').pop()}`, type: 'hygiene', target: rel }];
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
  const blockScalars = new Set();

  const lines = block.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    // Top-level keys only: an indented line belongs to a nested block,
    // where the quoting rules are different.
    const pair = lines[i].match(/^([A-Za-z0-9_-]+):(.*)$/);
    if (!pair) continue;
    const key = pair[1];
    const value = pair[2].trim();
    seen.set(key, value);

    if (!value) {
      // `key:` with indented children below is a YAML block scalar: the field holds a
      // populated string, and calling it empty is the false this check exists to avoid.
      const next = lines[i + 1];
      if (next !== undefined && /^[ \t]+\S/.test(next)) blockScalars.add(key);
      continue; // empty here may be a multi-line block: not judged
    }
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
    } else if (!seen.get(required) && !blockScalars.has(required)) {
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

/**
 * Findings on `environment.json` beyond its syntax. One rule, the one §7 of
 * `contracts/orchestration.md` states in a table and nothing enforced: a backend that is
 * some host's native backend carries no `base_url` — the host already points there, so a
 * URL declared on it silently points the native backend somewhere else.
 */
export function environmentFindings(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return []; // the syntax check has its own say, and a file that does not parse is judged there
  }
  const hosts = doc && typeof doc === 'object' ? doc.hosts : null;
  const backends = doc && typeof doc === 'object' ? doc.backends : null;
  if (!hosts || typeof hosts !== 'object' || !backends || typeof backends !== 'object') return [];

  const findings = [];
  const seen = new Set();
  for (const [host, entry] of Object.entries(hosts)) {
    const native = entry && typeof entry === 'object' ? entry.native_backend : null;
    if (typeof native !== 'string' || seen.has(native)) continue;
    const declared = backends[native];
    if (!declared || typeof declared !== 'object') continue;
    if (!Object.prototype.hasOwnProperty.call(declared, 'base_url')) continue;
    seen.add(native);
    findings.push(
      `\`backends.${native}.base_url\` is declared and \`${native}\` is a host's native backend ` +
        `(\`${host}\`): §7 of \`contracts/orchestration.md\` wants the key absent there. Drop it.`
    );
  }
  return findings;
}

/**
 * One item of a frontmatter list: a trailing `# comment` dropped, then the surrounding quotes.
 * The same order `unquoteYaml` of `architect/ledger.mjs` uses for a policy's `paths`.
 */
function yamlItem(value) {
  const bare = String(value).trim().replace(/\s+#.*$/, '');
  const quoted = /^(['"])(.*)\1$/.exec(bare);
  return (quoted ? quoted[2] : bare).trim();
}

/**
 * One list of a policy frontmatter, in the three shapes a YAML list admits and
 * `architect/ledger.mjs` already reads for a policy's `paths`: a block list (`- item` per
 * line), an inline list (`[a, b]`), or a single value. Anything else in the frontmatter is
 * not read here.
 */
function frontmatterList(block, name) {
  const lines = block.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const key = new RegExp(`^${name}\\s*:\\s*(.*)$`).exec(lines[i]);
    if (!key) continue;
    const inline = key[1].trim();
    if (inline.startsWith('[')) return inline.replace(/^\[|\]$/g, '').split(',').map(yamlItem).filter(Boolean);
    if (inline) return [yamlItem(inline)].filter(Boolean);
    const out = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const item = /^\s+-\s*(.*)$/.exec(lines[j]);
      if (item) out.push(yamlItem(item[1]));
      else if (lines[j].trim() && !lines[j].trim().startsWith('#')) break;
    }
    return out.filter(Boolean);
  }
  return [];
}

/**
 * The `paths:` and `hygiene:` lists of a policy frontmatter — path patterns for `paths:`,
 * text fragments for `hygiene:` — read with the same reader the rest of the product uses for a
 * policy's `paths`, so the hygiene step sees what `architect/ledger.mjs` sees: an inline list,
 * a trailing comment, a glob-free path naming a folder.
 */
export function hygieneOfPolicy(text) {
  const block = frontmatter(text);
  if (block === null) return { paths: [], patterns: [] };
  return { paths: frontmatterList(block, 'paths'), patterns: frontmatterList(block, 'hygiene') };
}

/**
 * The pattern form of `paths`: `**` crosses folders, `*` and `?` do not. A policy
 * watches the written file when one of its `paths:` patterns matches it.
 */
export function matchGlob(rel, pattern) {
  let out = '';
  const p = String(pattern).replace(/\\/g, '/').replace(/^\.\//, '');
  for (let i = 0; i < p.length; i += 1) {
    const c = p[i];
    if (c === '*' && p[i + 1] === '*') {
      i += 1;
      if (p[i + 1] === '/') {
        i += 1;
        out += '(?:.*/)?';
      } else out += '.*';
    } else if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  if (new RegExp(`^${out}$`).test(rel)) return true;
  // A glob-free path names a folder, exactly as `covers` of `architect/ledger.mjs` reads it.
  if (p.endsWith('/')) return rel.startsWith(p);
  return !/[*?[]/.test(p) && rel.startsWith(`${p}/`);
}

const HYGIENE_SHOWN = 10;

/**
 * Lines of `text` matching any of `patterns`, as `{line, fragment}` in file order.
 * `total` counts every match: the report shows the first few and says how many more.
 */
export function hygieneFindings(text, patterns) {
  const hits = [];
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  lines.forEach((content, index) => {
    const fragment = patterns.find((candidate) => candidate && content.includes(candidate));
    if (fragment) hits.push({ line: index + 1, fragment });
  });
  return { hits: hits.slice(0, HYGIENE_SHOWN), total: hits.length };
}

/** Runs the hygiene step: the policies watching `rel`, and the lines matching their patterns. `[]` when silent or degraded. */
function hygieneReport(rel, root, env) {
  let text;
  try {
    text = env.read(join(root, rel));
  } catch {
    return []; // the file vanished between the write and the check: stay silent
  }
  let names;
  try {
    names = env.list(join(root, '.daiku', 'policies'));
  } catch {
    return []; // no policies to read: stay silent
  }
  const lines = [];
  for (const name of [...names].sort()) {
    if (!name.endsWith('.md') || name === 'README.md') continue;
    let policy;
    try {
      policy = env.read(join(root, '.daiku', 'policies', name));
    } catch {
      continue; // an unreadable policy watches nothing
    }
    const { paths, patterns } = hygieneOfPolicy(policy);
    if (!patterns.length) continue;
    if (!paths.some((pattern) => matchGlob(rel, pattern))) continue;
    const { hits, total } = hygieneFindings(text, patterns);
    if (!total) continue;
    lines.push(`**hygiene (${name})** — ${total} line${total === 1 ? '' : 's'} match${total === 1 ? 'es' : ''} declared patterns:`);
    for (const hit of hits) lines.push(`- \`${rel}:${hit.line}\`: matches \`${hit.fragment}\``);
    if (total > hits.length) lines.push(`- …and ${total - hits.length} more`);
  }
  return lines;
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

  if (step.type === 'hygiene') {
    return hygieneReport(step.target, root, env);
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
        : [
            ...jsonFindings(text),
            ...(/^\.daiku\/environment(\.[a-z]+)?\.json$/.test(step.target)
              ? environmentFindings(text)
              : []),
          ];

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
  list: (path) => readdirSync(path),
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
    list: (p) => {
      const base = key(p).replace(/\/+$/, '') + '/';
      const names = new Set();
      for (const path of map.keys()) {
        if (!path.startsWith(base)) continue;
        const rest = path.slice(base.length);
        if (rest && !rest.includes('/')) names.add(rest);
      }
      if (!names.size) throw new Error(`ENOENT ${p}`);
      return [...names];
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
  check(
    'environment.local.json triggers the JSON check',
    typesOf('.daiku/environment.local.json') === 'json'
  );
  check('an area rule triggers its frontmatter', typesOf('.daiku/policies/backend.md') === 'policy');
  check('a Codex guard recalls its own bench', typesOf('.codex/hooks/command-guard.mjs') === 'reminder');
  check('a Claude guard recalls its own bench', typesOf('.claude/hooks/command-guard.mjs') === 'reminder');
  check('a package guard in development too', typesOf('plugins/daiku/hooks/lib/command-guard.mjs') === 'reminder');
  check('and also the module the guards import', typesOf('plugins/daiku/hooks/lib/daiku-config.mjs') === 'reminder');
  check('a guard does not also trigger the other checks', plan('.claude/hooks/command-guard.mjs').length === 1);

  // Corpus exclusions: silence, no reads and no processes.
  for (const outside of ['.daiku/domain/perf.md', '.daiku/policies/README.md', '.gitignore', '.env']) {
    check(`corpus exclusion: \`${outside}\``, plan(outside).length === 0);
  }

  // Hygiene perimeter: every other written file is read against the watching policies.
  const hygieneOf = (rel) => plan(rel).map((p) => p.type).join(',');
  check('a source file triggers hygiene', hygieneOf('src/index.ts') === 'hygiene');
  check('a root markdown triggers hygiene', hygieneOf('README.md') === 'hygiene');
  check('a development note triggers hygiene', hygieneOf('docs/new-developments/x/0. problem.md') === 'hygiene');
  check('a manifest triggers hygiene', hygieneOf('package.json') === 'hygiene');
  check('hygiene carries the written file as its target', plan('src/index.ts')[0].target === 'src/index.ts');
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
  check(
    'a block-scalar description is populated, not empty',
    frontmatterFindings('---\nname: review\ndescription:\n  a long description\n  on two lines\n---\n').length === 0
  );
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

  // --- environment.json: the one conditional absence ------------------------
  const nativeWithUrl = JSON.stringify({
    hosts: { claude: { native_backend: 'anthropic' } },
    backends: { anthropic: { base_url: 'https://api.example' }, other: { base_url: 'https://other' } },
  });
  check(
    '`base_url` on a native backend is a finding',
    environmentFindings(nativeWithUrl).some((r) => r.includes('`backends.anthropic.base_url`'))
  );

  const nativeWithoutUrl = JSON.stringify({
    hosts: { claude: { native_backend: 'anthropic' } },
    backends: { anthropic: {}, other: { base_url: 'https://other' } },
  });
  check('the same key on another backend is not', environmentFindings(nativeWithoutUrl).length === 0);
  check('two hosts on the same native backend report it once', environmentFindings(
    JSON.stringify({
      hosts: { claude: { native_backend: 'anthropic' }, other: { native_backend: 'anthropic' } },
      backends: { anthropic: { base_url: 'https://api.example' } },
    })
  ).length === 1);
  check('a file that does not parse is judged by the syntax check alone', environmentFindings('{').length === 0);
  check('no backends declared: nothing to say', environmentFindings('{"temp_dir": "/tmp"}').length === 0);
  check('a backend the hosts do not declare native stays silent', environmentFindings(
    JSON.stringify({ hosts: { claude: { native_backend: 'anthropic' } }, backends: { other: { base_url: 'https://other' } } })
  ).length === 0);

  const envText = report('.daiku/environment.json', R, fakeEnv({ [`${R}/.daiku/environment.json`]: nativeWithUrl }));
  check('the rule reaches the report', !!envText && envText.includes('native backend'));
  const envLocalText = report('.daiku/environment.local.json', R, fakeEnv({ [`${R}/.daiku/environment.local.json`]: nativeWithUrl }));
  check('the machine override is judged too', !!envLocalText && envLocalText.includes('native backend'));

  // --- source hygiene: policies, patterns and matches -----------------------
  const backendPolicy = '---\npaths:\n  - "src/server/**"\nhygiene:\n  - "console.log"\n  - \'sk-\'\n---\n\n# Backend\n';
  const parsed = hygieneOfPolicy(backendPolicy);
  check('hygiene lists are read', parsed.paths.join(',') === 'src/server/**' && parsed.patterns.join(',') === 'console.log,sk-');
  check('a policy without hygiene has no patterns', hygieneOfPolicy('---\npaths:\n  - "src/**"\n---\n').patterns.length === 0);
  check('a policy without frontmatter watches nothing', hygieneOfPolicy('# prose\n').patterns.length === 0);
  check('unquoted items are read too', hygieneOfPolicy('---\npaths:\n  - src/**\nhygiene:\n  - TODO\n---\n').patterns.join(',') === 'TODO');
  check('an inline `paths` list is read', hygieneOfPolicy("---\npaths: ['src/server/**']\nhygiene:\n  - 'console.log'\n---\n").paths.join(',') === 'src/server/**');
  check(
    'a trailing comment on an item is dropped',
    hygieneOfPolicy("---\npaths:\n  - 'src/server/**'  # the server\nhygiene:\n  - 'console.log'\n---\n").paths.join(',') === 'src/server/**'
  );
  check('an inline `hygiene` list is read', hygieneOfPolicy("---\npaths:\n  - 'src/**'\nhygiene: ['console.log', 'sk-']\n---\n").patterns.join(',') === 'console.log,sk-');

  check('`**` crosses folders', matchGlob('src/server/api/users.ts', 'src/server/**'));
  check('`**` does not match the folder itself', matchGlob('src/server', 'src/server/**') === false);
  check('`*` does not cross folders', !matchGlob('src/server/api/users.ts', 'src/server/*.ts'));
  check('`*` matches inside one folder', matchGlob('src/server/app.ts', 'src/server/*.ts'));
  check('`?` matches one character', matchGlob('src/a.ts', 'src/?.ts') && !matchGlob('src/ab.ts', 'src/?.ts'));
  check('a glob-free path names a folder', matchGlob('src/api/x.ts', 'src/api'));
  check('a trailing-slash path names a folder', matchGlob('src/api/x.ts', 'src/api/'));
  check('a glob-free path does not reach a sibling prefix', !matchGlob('src/apix/y.ts', 'src/api'));

  const dirty = 'import x from "./y";\nconsole.log("debug", x);\nconst key = "sk-abc123";\n';
  const found = hygieneFindings(dirty, ['console.log', 'sk-']);
  check('every matching line is found', found.total === 2 && found.hits.length === 2);
  check('hits carry line and fragment', found.hits[0].line === 2 && found.hits[0].fragment === 'console.log');
  check('clean text has no findings', hygieneFindings('const a = 1;\n', ['console.log']).total === 0);
  const many = Array.from({ length: 25 }, (_, i) => `console.log(${i});`).join('\n');
  const capped = hygieneFindings(many, ['console.log']);
  check('matches past the cap are counted, not listed', capped.total === 25 && capped.hits.length === 10);

  const watched = {
    [`${R}/src/server/app.ts`]: dirty,
    [`${R}/.daiku/policies/backend.md`]: backendPolicy,
  };
  const hygieneText = report('src/server/app.ts', R, fakeEnv(watched));
  check('a watched dirty file reaches the report', !!hygieneText && hygieneText.includes('backend.md') && hygieneText.includes('src/server/app.ts:2'));
  const inlineWatched = {
    [`${R}/src/server/app.ts`]: dirty,
    [`${R}/.daiku/policies/backend.md`]: "---\npaths: ['src/server/**']\nhygiene:\n  - 'console.log'\n---\n",
  };
  check('a policy whose `paths` is an inline list is not inert', !!report('src/server/app.ts', R, fakeEnv(inlineWatched)));
  check('the hygiene report states it does not block', !!hygieneText && hygieneText.includes('block nothing'));
  const unwatched = {
    [`${R}/src/server/app.ts`]: dirty,
    [`${R}/.daiku/policies/frontend.md`]: '---\npaths:\n  - "src/web/**"\nhygiene:\n  - "console.log"\n---\n',
  };
  check('a file no policy watches: no report', report('src/server/app.ts', R, fakeEnv(unwatched)) === null);
  const cleanSrc = {
    [`${R}/src/server/app.ts`]: 'const a = 1;\n',
    [`${R}/.daiku/policies/backend.md`]: backendPolicy,
  };
  check('a watched clean file: no report', report('src/server/app.ts', R, fakeEnv(cleanSrc)) === null);
  check('no policies on disk: no report', report('src/server/app.ts', R, fakeEnv({ [`${R}/src/server/app.ts`]: dirty })) === null);
  const brokenPolicy = {
    [`${R}/src/server/app.ts`]: dirty,
    [`${R}/.daiku/policies/backend.md`]: backendPolicy,
    [`${R}/.daiku/policies/broken.md`]: '# no frontmatter, no lists\n',
  };
  check('an unreadable policy watches nothing but breaks nothing', (report('src/server/app.ts', R, fakeEnv(brokenPolicy)) || '').includes('backend.md'));
  check('missing written file: no report', report('src/server/app.ts', R, fakeEnv({ [`${R}/.daiku/policies/backend.md`]: backendPolicy })) === null);

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
