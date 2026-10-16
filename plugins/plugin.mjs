#!/usr/bin/env node
/**
 * The opencode entrypoint of the package.
 *
 * Claude Code serves the package by installation: the marketplace carries it, the host reads
 * `skills/`, `agents/` and `hooks/hooks.json` from where the package stands. opencode has no such
 * scan — an installed package yields **only** its plugin module — so everything the package must
 * contribute there has to be **registered in code**, and this file is the one place that does it.
 * The descriptor beside it (`package.json`) resolves to this module; the module computes its own
 * folder with `import.meta.url` (opencode interpolates no variable a file could use) and reads
 * every registration from `daiku/` at load time: the corpus stays the single source, nothing of
 * the method is transcribed into this module.
 *
 * The guards arrive first, imported from the adapter that carries them onto opencode's domains —
 * one plugin, one seat, no second wiring: `setup` below calls the adapter's own `setup` and keeps
 * the inventory it returns (`{ hooked, missing }`), which is what the adapter's bench and this
 * module's both hold to. Then the extension surface follows: **skills** registered as
 * `Skill.Info` read from every `skills/<nome>/SKILL.md`; **agents** created through the editor's
 * `update` from every `agents/opencode/<role>.md` — description, mode, body and permissions,
 * each where the host reads them; and **slash commands** — one `CommandDefinition` per SKILL.md
 * whose frontmatter carries `argument-hint` (the nine entry skills, no list in this module),
 * name and description read from the same file, `execute` activating the registered skill with
 * `session.prompt({ skills: [{ id }] })` and the typed arguments. The command is a handle, the
 * skill is the body.
 *
 *   node plugins/plugin.mjs --self-check
 *       the bench, on a fake `ctx` against the real corpus of the package: counted JSON
 *       `{checks, passed, failed[]}`, exit 1 on the first red. `daiku/hooks/self-check.mjs`
 *       launches it beside the others.
 *
 * The module is a plugin, not a program: run as a program it only answers `--self-check`.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { setup as guards } from './daiku/hooks/opencode-plugin.mjs';
import { frontmatter } from './daiku/hooks/lib/contracts-post-edit.mjs';

/** This entrypoint's folder — the folder the descriptor beside it describes. */
export const ROOT = dirname(fileURLToPath(import.meta.url));

/** The package folder beside the descriptor: the corpus every registration below reads. */
export const PACKAGE = join(ROOT, 'daiku');

/** The plugin id — the row `opencode plugin list` shows for it. */
export const ID = 'daiku';

/**
 * The five dependency manifests a dependency-bearing `package.json` would carry, named here for
 * the descriptor check of the bench: this descriptor must declare none of them, ever.
 */
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'bundledDependencies'];

/**
 * One scalar of a frontmatter block: `key: value`, or `key:` folded onto the following
 * indented lines. Quotes stripped, a trailing `# comment` dropped — the same reading order
 * `yamlItem` of `contracts-post-edit.mjs` uses. `undefined` when the key is absent or empty.
 */
function scalar(block, key) {
  if (block === null || block === undefined) return undefined;
  const lines = block.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const match = new RegExp(`^${key}\\s*:\\s*(.*)$`).exec(lines[i]);
    if (!match) continue;
    const inline = match[1].trim();
    if (inline) return yamlScalar(inline);
    const parts = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (/^[ \t]+\S/.test(lines[j])) parts.push(lines[j].trim());
      else break;
    }
    return parts.length ? parts.join(' ') || undefined : undefined;
  }
  return undefined;
}

/** One frontmatter value: trailing comment dropped, then the surrounding quotes. */
function yamlScalar(value) {
  const bare = String(value).trim().replace(/\s+#.*$/, '');
  const quoted = /^(['"])(.*)\1$/.exec(bare);
  return ((quoted ? quoted[2] : bare).trim()) || undefined;
}

/**
 * A nested frontmatter map (`permission:` alone on its line, then indented `key: value`
 * lines). `{}` when the key is absent — anything this reader does not understand yields no
 * entries rather than a registration the host would reject.
 */
function nestedMap(block, key) {
  const out = {};
  if (!block) return out;
  const lines = block.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    if (!new RegExp(`^${key}\\s*:\\s*$`).test(lines[i])) continue;
    for (let j = i + 1; j < lines.length; j += 1) {
      const item = /^\s+([A-Za-z0-9_.-]+)\s*:\s*(.+)$/.exec(lines[j]);
      if (item) out[item[1].trim()] = yamlScalar(item[2]);
      else if (!lines[j].trim()) continue;
      else break;
    }
    break;
  }
  return out;
}

/** The body of a markdown file: the text after the closing `---` of its frontmatter. */
function bodyOf(text) {
  const normalised = String(text).replace(/\r\n/g, '\n');
  if (!normalised.startsWith('---\n')) return normalised;
  const end = normalised.indexOf('\n---', 3);
  if (end === -1) return normalised;
  const rest = normalised.slice(end + 4);
  return rest.startsWith('\n') ? rest.slice(1) : rest;
}

/** The permission effects opencode's ruleset accepts — anything else is dropped. */
const EFFECTS = new Set(['allow', 'deny', 'ask']);

/**
 * The `permission:` frontmatter map as opencode's ruleset entries: each key becomes an
 * action over every resource (`{action, resource: "*", effect}`). The rules are **appended**
 * to the agent's standing ruleset, so the last match wins and a deny here beats the
 * standing allow — the same precedence the host itself applies (opencode study §13.3).
 */
function permissionRules(block) {
  return Object.entries(nestedMap(block, 'permission'))
    .filter(([, effect]) => EFFECTS.has(effect))
    .map(([action, effect]) => ({ action, resource: '*', effect }));
}

/** Every `skills/<name>/SKILL.md` of the package folder, read into `Skill.Info` shapes. */
export function readSkills(folder) {
  let entries = [];
  try {
    entries = readdirSync(folder, { withFileTypes: true });
  } catch {
    entries = [];
  }
  const skills = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = join(folder, entry.name, 'SKILL.md');
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf-8');
    const block = frontmatter(text);
    const skill = {
      id: entry.name,
      name: scalar(block, 'name') || entry.name,
      path: file,
      content: bodyOf(text),
    };
    const description = scalar(block, 'description');
    if (description) skill.description = description;
    skills.push(skill);
  }
  return skills.sort((a, b) => a.id.localeCompare(b.id));
}

/** Every `agents/opencode/<role>.md` of the package folder, read into agent registrations. */
export function readAgents(folder) {
  let names = [];
  try {
    names = readdirSync(folder).filter((name) => name.endsWith('.md'));
  } catch {
    names = [];
  }
  return names
    .sort()
    .map((name) => {
      const file = join(folder, name);
      const text = readFileSync(file, 'utf-8');
      const block = frontmatter(text);
      return {
        id: name.replace(/\.md$/, ''),
        description: scalar(block, 'description'),
        mode: scalar(block, 'mode'),
        permissions: permissionRules(block),
        system: bodyOf(text).trim(),
      };
    });
}

/**
 * Register the package's skills on opencode: one `transform` over the real folder, an
 * `add` per skill the editor does not already know (a skill of the host's own keeps its
 * seat), then `reload` so the domain rebuilds. The files are the source — nothing here
 * carries the corpus; `path` and `content` are read from disk at load time.
 */
export async function registerSkills(ctx, folder = join(PACKAGE, 'skills')) {
  const skills = readSkills(folder);
  await ctx.skill.transform((editor) => {
    for (const skill of skills) {
      if (!editor.get(skill.id)) editor.add(skill);
    }
  });
  await ctx.skill.reload();
  return skills;
}

/**
 * Register the package's opencode agents: `update` on the editor **creates** the agent when
 * the id is unknown (host behaviour, `packages/core/src/agent.ts`), so each role arrives with
 * its description, its `mode`, the body as the system prompt, and its permissions appended.
 */
export async function registerAgents(ctx, folder = join(PACKAGE, 'agents', 'opencode')) {
  const agents = readAgents(folder);
  await ctx.agent.transform((editor) => {
    for (const agent of agents) {
      editor.update(agent.id, (item) => {
        if (agent.description) item.description = agent.description;
        if (agent.mode) item.mode = agent.mode;
        if (agent.system) item.system = agent.system;
        for (const rule of agent.permissions) item.permissions.push(rule);
      });
    }
  });
  await ctx.agent.reload();
  return agents;
}

/**
 * The slash commands: every `skills/<nome>/SKILL.md` whose frontmatter carries
 * `argument-hint` — the mark of an entry skill, read from the file and never listed in
 * this module. Name and description come from the same SKILL.md the skill loads from, so
 * the command is a handle: the body stays the skill.
 */
export function readCommands(folder = join(PACKAGE, 'skills')) {
  let entries = [];
  try {
    entries = readdirSync(folder, { withFileTypes: true });
  } catch {
    entries = [];
  }
  const commands = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = join(folder, entry.name, 'SKILL.md');
    if (!existsSync(file)) continue;
    const block = frontmatter(readFileSync(file, 'utf-8'));
    if (!block || !/^argument-hint\s*:/m.test(block)) continue;
    commands.push({ name: entry.name, description: scalar(block, 'description') });
  }
  return commands.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Register the nine slash commands. Each `execute` receives the invocation (session and the
 * typed arguments, opencode splits `/nome args` before the call) and **activates the skill
 * already registered**: `session.prompt` with `skills: [{ id }]` — the same payload the API
 * documents for attaching a skill — carrying the argument text through. The command never
 * holds the skill's body; it only names it.
 */
export async function registerCommands(ctx, folder = join(PACKAGE, 'skills')) {
  const commands = readCommands(folder);
  await ctx.command.transform((editor) => {
    for (const command of commands) {
      editor.add({
        name: command.name,
        ...(command.description ? { description: command.description } : {}),
        execute: (invocation) => {
          const call = invocation && typeof invocation === 'object' ? invocation : {};
          const prompt = call.prompt && typeof call.prompt === 'object' ? call.prompt : {};
          const input = {
            sessionID: call.sessionID,
            text: typeof prompt.text === 'string' ? prompt.text : '',
            skills: [{ id: command.name }],
          };
          if (Array.isArray(prompt.files) && prompt.files.length) input.files = prompt.files;
          if (Array.isArray(prompt.agents) && prompt.agents.length) input.agents = prompt.agents;
          return ctx.session.prompt(input);
        },
      });
    }
  });
  await ctx.command.reload();
  return commands.map((command) => command.name);
}

/**
 * The plugin's setup: the adapter's guards first, then the registrations. Returns the
 * inventory of the guards — the number every bench of both files holds to. It is async
 * because the host's promise adapter awaits it (`Promise.resolve(plugin.setup(ctx))`),
 * so every `transform` and `reload` completes before the plugin is considered loaded.
 */
export async function setup(ctx) {
  const inventory = guards(ctx);
  await registerSkills(ctx);
  await registerAgents(ctx);
  await registerCommands(ctx);
  return inventory;
}

/** The definition shape opencode's loader accepts: `{id, setup}`. */
const definition = { id: ID, setup };
export default definition;

/* ------------------------------------------------------------------------- *
 * The bench — a fake ctx, the real package files, a throwaway project on disk
 * ------------------------------------------------------------------------- */

async function selfCheck() {
  const failed = [];
  let ran = 0;
  const check = (name, condition, why) => {
    ran += 1;
    if (!condition) failed.push(why ? `${name}: ${why}` : name);
  };
  const write = (path, text) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, 'utf-8');
  };
  const throws = (fn) => {
    try {
      fn();
      return null;
    } catch (error) {
      return error && error.message ? error.message : 'threw';
    }
  };

  /** A fake opencode ctx: it records every hook registration and every domain registration,
   *  with editors whose semantics mirror the host's — `skill.add`, and `agent.update` creating
   *  the unknown id from the standing default. */
  function fakeCtx(directory) {
    const hooks = { tool: {}, session: {}, events: [] };
    const state = { skills: new Map(), agents: new Map(), commands: new Map(), prompts: [], reloads: { skill: 0, agent: 0, command: 0 } };
    return {
      directory,
      hooks,
      state,
      client: { app: { log: () => Promise.resolve() } },
      tool: { hook: (name, cb) => { (hooks.tool[name] || (hooks.tool[name] = [])).push(cb); } },
      session: {
        hook: (name, cb) => { (hooks.session[name] || (hooks.session[name] = [])).push(cb); },
        prompt: (input) => { state.prompts.push(input); return Promise.resolve({}); },
      },
      event: { subscribe: (cb) => hooks.events.push(cb) },
      skill: {
        transform: (cb) => {
          cb({
            list: () => [...state.skills.values()],
            get: (id) => state.skills.get(id),
            add: (skill) => { state.skills.set(skill.id, { ...skill }); },
            update: (id, fn) => { const current = state.skills.get(id); if (current) fn(current); },
            remove: (id) => { state.skills.delete(id); },
          });
          return Promise.resolve();
        },
        reload: () => { state.reloads.skill += 1; return Promise.resolve(); },
      },
      agent: {
        transform: (cb) => {
          cb({
            list: () => [...state.agents.values()],
            get: (id) => state.agents.get(id),
            default: () => {},
            update: (id, fn) => {
              let current = state.agents.get(id);
              if (!current) {
                current = {
                  id,
                  name: id,
                  mode: 'primary',
                  hidden: false,
                  permissions: [{ action: '*', resource: '*', effect: 'allow' }],
                };
                state.agents.set(id, current);
              }
              fn(current);
              current.id = id;
            },
            remove: (id) => { state.agents.delete(id); },
          });
          return Promise.resolve();
        },
        reload: () => { state.reloads.agent += 1; return Promise.resolve(); },
      },
      command: {
        transform: (cb) => {
          cb({ add: (definition) => { state.commands.set(definition.name, definition); } });
          return Promise.resolve();
        },
        reload: () => { state.reloads.command += 1; return Promise.resolve(); },
      },
    };
  }

  const base = mkdtempSync(join(tmpdir(), 'daiku-plugin-'));
  const P = join(base, 'project');
  try {
    // A project Daiku opened: the guards switch on by the file's existence alone.
    write(join(P, '.daiku', 'project.json'), JSON.stringify({ contract: 1, paths: { review_state: '.docs/runtime/review' } }));

    const ctx = fakeCtx(P);
    const inventory = await setup(ctx);

    // --- the plugin shape and the inventory -------------------------------------------
    check('the plugin carries an id', typeof ID === 'string' && ID.trim() === 'daiku');
    check('setup is the function opencode calls', typeof setup === 'function');
    check('the default is the shape the loader accepts', definition.id === 'daiku' && typeof definition.setup === 'function');
    check(
      'setup returns the adapter inventory',
      JSON.stringify(inventory) === JSON.stringify({ hooked: ['command-guard', 'ask-guard', 'contracts-post-edit', 'run-advice', 'session-advice'], missing: ['stop-advice', 'subagent-advice'] }),
      `inventory was ${JSON.stringify(inventory)}`
    );

    // --- the four attachments pass through the entrypoint ------------------------------
    check('execute.before is hooked through the entrypoint', (ctx.hooks.tool['execute.before'] || []).length === 1);
    check('execute.after is hooked through the entrypoint', (ctx.hooks.tool['execute.after'] || []).length === 1);
    check('session.prompt is hooked through the entrypoint', (ctx.hooks.session.prompt || []).length === 1);
    check('an event subscription is registered through the entrypoint', ctx.hooks.events.length === 1);

    const before = (ctx.hooks.tool['execute.before'] || [])[0];
    check(
      'a git push on a Daiku project is still denied',
      typeof before === 'function' && !!throws(() => before({ tool: 'shell', input: { command: 'git push' }, sessionID: 's' })),
      'the push passed through the entrypoint'
    );

    // --- the guards stay dark without the project's declaration ------------------------
    const bare = fakeCtx(join(base, 'never-opened'));
    await setup(bare);
    const bareBefore = (bare.hooks.tool['execute.before'] || [])[0];
    check(
      'a project without .daiku/project.json denies nothing',
      typeof bareBefore === 'function' && throws(() => bareBefore({ tool: 'shell', input: { command: 'git push' }, sessionID: 's' })) === null,
      'a guard fired without the declaration'
    );

    // --- the descriptor: a plugin manifest, never a dependency manifest ----------------
    const descriptor = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
    check('the descriptor parses', descriptor && typeof descriptor === 'object');
    check('the descriptor names the plugin', descriptor.name === 'daiku');
    check('the descriptor declares no version on develop', !('version' in descriptor), 'version must be written by release, on production');
    for (const field of DEPENDENCY_FIELDS) {
      check(`the descriptor carries no ${field}`, !(field in descriptor), `${field} is present in plugins/package.json`);
    }
    check('the descriptor resolves the entrypoint to this file', descriptor.exports && descriptor.exports['.'] === './plugin.mjs');

    // --- skills: every folder registered, read independently by this bench --------------
    // The frontmatter below is re-read here with this bench's own regexes: a reader shared
    // with the module would only prove the module agrees with itself.
    const skillFolders = readdirSync(join(PACKAGE, 'skills'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(PACKAGE, 'skills', entry.name, 'SKILL.md')))
      .map((entry) => entry.name)
      .sort();
    const registeredSkills = [...ctx.state.skills.keys()].sort();
    check(
      'every skill folder is registered, element by element',
      JSON.stringify(registeredSkills) === JSON.stringify(skillFolders),
      `registered ${registeredSkills.length} of ${skillFolders.length}: ${registeredSkills.join(',')}`
    );
    for (const name of skillFolders) {
      const raw = readFileSync(join(PACKAGE, 'skills', name, 'SKILL.md'), 'utf-8');
      const described = /^description:\s*(.+)$/m.exec(raw);
      const expected = described ? described[1].trim().replace(/^(['"])(.*)\1$/, '$2') : undefined;
      const end = raw.indexOf('\n---', 3);
      const expectedBody = end === -1 ? raw : raw.slice(end + 4).replace(/^\n/, '');
      const skill = ctx.state.skills.get(name);
      check(`${name}: registered with the folder's name as id`, !!skill && skill.id === name);
      check(`${name}: path points at its SKILL.md`, !!skill && skill.path === join(PACKAGE, 'skills', name, 'SKILL.md'));
      check(`${name}: description comes from the frontmatter`, !!skill && skill.description === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(skill && skill.description)}`);
      check(`${name}: content is the body read from the file`, !!skill && skill.content === expectedBody);
    }
    // An unknown frontmatter key must not stop a registration: `commit` carries `allowed-tools`.
    const commit = ctx.state.skills.get('commit');
    check('a skill with unknown frontmatter keys still registers', !!commit && !!commit.description && commit.description.startsWith('Commits the working tree'));
    check('the skill domain is reloaded after registration', ctx.state.reloads.skill >= 1, `reload count ${ctx.state.reloads.skill}`);

    // No line of a SKILL.md body may live in this module: the corpus is read, never copied.
    const handoff = readFileSync(join(PACKAGE, 'skills', 'handoff', 'SKILL.md'), 'utf-8');
    const handoffEnd = handoff.indexOf('\n---', 3);
    const longestBodyLine = handoff
      .slice(handoffEnd + 4)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .reduce((best, line) => (line.length > best.length ? line : best), '');
    const ownSource = readFileSync(fileURLToPath(import.meta.url), 'utf-8');
    check(
      'no line of the handoff body is transcribed into this module',
      longestBodyLine.length > 0 && !ownSource.includes(longestBodyLine),
      `found verbatim: ${longestBodyLine.slice(0, 80)}`
    );

    // --- agents: every file registered, described by the frontmatter --------------------
    const agentIds = readdirSync(join(PACKAGE, 'agents', 'opencode'))
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.replace(/\.md$/, ''))
      .sort();
    const registeredAgents = [...ctx.state.agents.keys()].sort();
    check(
      'every agent file is registered, element by element',
      JSON.stringify(registeredAgents) === JSON.stringify(agentIds),
      `registered ${registeredAgents.join(',')} of ${agentIds.join(',')}`
    );
    for (const id of agentIds) {
      const raw = readFileSync(join(PACKAGE, 'agents', 'opencode', `${id}.md`), 'utf-8');
      const described = /^description:\s*(.+)$/m.exec(raw);
      const declaredMode = /^mode:\s*(.+)$/m.exec(raw);
      const agent = ctx.state.agents.get(id);
      check(`${id}: description comes from the frontmatter`, !!agent && agent.description === described[1].trim().replace(/^(['"])(.*)\1$/, '$2'));
      check(`${id}: mode comes from the frontmatter`, !!agent && agent.mode === declaredMode[1].trim());
      check(`${id}: the body is the system prompt`, !!agent && typeof agent.system === 'string' && agent.system.length > 0 && !agent.system.startsWith('---'));
      check(
        `${id}: permission map becomes ruleset entries`,
        !!agent && agent.permissions.some((rule) => rule.action === 'edit' && rule.effect === 'deny' && rule.resource === '*')
          && agent.permissions.some((rule) => rule.action === 'subagent' && rule.effect === 'deny' && rule.resource === '*'),
        JSON.stringify(agent && agent.permissions)
      );
      check(`${id}: created unknown, it left the standing allow in place`, !!agent && agent.permissions.some((rule) => rule.action === '*' && rule.effect === 'allow'));
    }
    check('the agent domain is reloaded after registration', ctx.state.reloads.agent >= 1, `reload count ${ctx.state.reloads.agent}`);

    // An absent (or empty) agents folder registers nothing and fails nothing: the call above
    // is the proof — it ran against a folder that does not exist and reached this line.
    const ghost = fakeCtx(P);
    await registerAgents(ghost, join(base, 'no-such-folder'));
    check('an absent agents folder registers nothing and does not fail', ghost.state.agents.size === 0);

    // --- the nine slash commands, derived here from the frontmatter too -----------------
    const NINE = ['code-review', 'commit', 'handoff', 'init', 'new-feature', 'new-project', 'release', 'research', 'review'];
    const commandNames = [...ctx.state.commands.keys()].sort();
    check(
      'exactly the nine entry skills are commands, no tenth',
      JSON.stringify(commandNames) === JSON.stringify(NINE),
      `commands were ${commandNames.join(',')}`
    );
    for (const name of NINE) {
      const raw = readFileSync(join(PACKAGE, 'skills', name, 'SKILL.md'), 'utf-8');
      const described = /^description:\s*(.+)$/m.exec(raw);
      const expected = described ? described[1].trim().replace(/^(['"])(.*)\1$/, '$2') : undefined;
      const command = ctx.state.commands.get(name);
      check(`${name}: the command carries the frontmatter description`, !!command && command.description === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(command && command.description)}`);
      check(`${name}: its id matches the skill registered`, !!command && ctx.state.skills.has(name));
      check(`${name}: derived from an argument-hint in the file`, /^argument-hint\s*:/m.test(raw));
    }
    // A skill without `argument-hint` is internal: it must never become a command.
    const blueprintRaw = readFileSync(join(PACKAGE, 'skills', 'blueprint', 'SKILL.md'), 'utf-8');
    check(
      'a skill without argument-hint becomes no command',
      !/^argument-hint\s*:/m.test(blueprintRaw) && !ctx.state.commands.has('blueprint')
    );
    check('the command domain is reloaded after registration', ctx.state.reloads.command >= 1, `reload count ${ctx.state.reloads.command}`);

    // --- execute activates the skill, forwarding what was typed -------------------------
    const newFeature = ctx.state.commands.get('new-feature');
    check('the execute hook is a function', !!newFeature && typeof newFeature.execute === 'function');
    await newFeature.execute({ sessionID: 's1', prompt: { text: 'build it' }, delivery: 'steer' });
    const first = ctx.state.prompts[ctx.state.prompts.length - 1];
    check('execute prompts the invoking session', !!first && first.sessionID === 's1', JSON.stringify(first));
    check('execute attaches the skill by id', !!first && JSON.stringify(first.skills) === JSON.stringify([{ id: 'new-feature' }]), JSON.stringify(first && first.skills));
    check('execute forwards the argument text', !!first && first.text === 'build it', JSON.stringify(first && first.text));
    await newFeature.execute({ sessionID: 's1', prompt: { text: '' }, delivery: 'steer' });
    const second = ctx.state.prompts[ctx.state.prompts.length - 1];
    check('execute with no arguments prompts empty, without throwing', !!second && second.text === '' && JSON.stringify(second.skills) === JSON.stringify([{ id: 'new-feature' }]));
  } finally {
    rmSync(base, { recursive: true, force: true });
  }

  process.stdout.write(JSON.stringify({ checks: ran, passed: ran - failed.length, failed }, null, 2) + '\n');
  return failed.length ? 1 : 0;
}

/* ------------------------------------------------------------------------- *
 * Entry
 * ------------------------------------------------------------------------- */

function invokedDirectly() {
  try {
    const launched = process.argv[1];
    if (!launched) return true;
    return resolve(fileURLToPath(import.meta.url)).toLowerCase() === resolve(launched).toLowerCase();
  } catch {
    return true;
  }
}

if (invokedDirectly() && process.argv.includes('--self-check')) {
  selfCheck().then((code) => process.exit(code));
}
