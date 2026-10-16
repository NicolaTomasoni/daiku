#!/usr/bin/env node
/**
 * The guard adapter — the package's hooks, carried onto opencode.
 *
 * Claude Code carries the guards by installation: `hooks.json` wires seven modules to the host's
 * events, and the host runs them. opencode has no such file — its extension point is a **plugin**,
 * a module opencode auto-loads from `.opencode/plugins/` and calls through its own V2 API. So on
 * opencode the guards must be **re-hung**, and this file is the one place that does it: it
 * **imports** the package's own modules — it never rewrites them, so the guard that runs there is
 * the same guard that runs on Claude Code — and attaches each to the opencode hook that fires
 * where its Claude Code event fires.
 *
 * **The two seats, and what could not be carried.**
 *
 * | module | opencode hook | the Claude Code event it stands for |
 * |---|---|---|
 * | `command-guard` | `tool.execute.before` (deny by **throwing**) | `PreToolUse` on the shell |
 * | `ask-guard` | `tool.execute.before` (deny by **throwing**) | `PreToolUse` on the question and the launch |
 * | `contracts-post-edit` | `tool.execute.after` (reports, never throws) | `PostToolUse` on the edit |
 * | `run-advice` | `session.prompt` | `UserPromptSubmit` |
 * | `session-advice` | `event` — `session.created` | `SessionStart` |
 *
 * **`stop-advice` and `subagent-advice` are not carried, and are declared missing.** opencode fires
 * no event for the end of a subagent (`SubagentStop` → zero occurrences) nor for the end of a turn
 * (`Stop` → no equivalent), so there is no point at which those two could be attached: the open
 * ledger notice and the subagent cap notice do not exist on this host. That is a declared gap, not
 * a silent one — the same list stands in the header of this file and in `declared_missing` of
 * `.opencode/daiku/deposit.json`, so whoever reads the deposit learns it without reading the code.
 *
 * **The tool names are opencode's, not Claude Code's** (§7.5, §11.2 of the opencode study): the
 * shell is `shell`, the write is `edit`, the delegation is `subagent`, the question is `question`.
 * The adapter maps the opencode event onto the shape the module reads, so the module itself stays
 * host-blind.
 *
 * **A deny is a throw.** opencode's `tool.execute.before` has no return field that says "deny":
 * raising an exception aborts the tool call before it runs, and the message reaches the model.
 * `tool.execute.after` cannot fail at all, so `contracts-post-edit` there can only report.
 *
 * **A hook callback returns nothing.** opencode's hook signature is `(event) => void` — the return
 * value is discarded — so a guard that "speaks" delivers its text by **mutating the event**: the
 * report of `contracts-post-edit` replaces the tool result, the notice of `run-advice` is appended
 * to the prompt, and the startup notice of `session-advice`, whose `event` stream has no channel at
 * all, goes out through the `client` the host hands `setup`.
 *
 *   node <package-root>/hooks/opencode-plugin.mjs --self-check
 *       the bench, on a fake `ctx` that records the hooks and drives them with synthetic events,
 *       against a throwaway project under the system temp directory: counted JSON
 *       `{checks, passed, failed[]}`, exit 1 on the first red. `hooks/self-check.mjs` launches it.
 *
 * The module is a plugin, not a program: run as a program it only answers `--self-check`. Its
 * `default` is the shape opencode's loader accepts — `{id, setup}`.
 */

import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluate, REAL_ENV as GUARD_ENV } from './lib/command-guard.mjs';
import { judgeAsk, questionsOf, advanceDeny, statePath, readState, writeState, settled, resumeMark } from './lib/ask-guard.mjs';
import { report, relativeToRoot } from './lib/contracts-post-edit.mjs';
import { promptDecision, isMarked, markPath, opensRun } from './lib/run-advice.mjs';
import { warnings } from './lib/session-advice.mjs';
import { loadContext, REAL_READS } from './lib/daiku-config.mjs';

/** This file's own directory, for the two checks that read a sibling file. */
const HERE = dirname(fileURLToPath(import.meta.url));

/** The plugin id opencode requires. */
export const ID = 'daiku';

/** The modules this adapter attaches to a live opencode hook — the five of § *The two seats*. */
export const HOOKED = ['command-guard', 'ask-guard', 'contracts-post-edit', 'run-advice', 'session-advice'];

/** The modules opencode has no event for, declared missing in the file and in the deposit manifest. */
export const MISSING = ['stop-advice', 'subagent-advice'];

/** opencode's tool names, mapped to the seats the modules read. */
const SHELL_TOOLS = new Set(['shell', 'bash']);
const EDIT_TOOLS = new Set(['edit', 'write', 'patch']);
const QUESTION_TOOLS = new Set(['question']);
const LAUNCH_TOOLS = new Set(['subagent', 'task']);

/** The session's own scratch, for the mark and the ask state: the two keys `run-advice` and
 * `ask-guard` read from their environment, built here because their modules are imported, not run. */
const SESSION_ENV = {
  exists: (path) => {
    try {
      return existsSync(path);
    } catch {
      return false;
    }
  },
  read: (path) => readFileSync(path, 'utf-8'),
  tmpdir: () => tmpdir(),
  /** The subfolders of a directory, as `session-advice` reads its working folders. */
  list: (path) => {
    try {
      return readdirSync(path, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch {
      return [];
    }
  },
  write: (path, text) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, 'utf-8');
  },
};

/** The disk reads `contracts-post-edit` asks of the file just written. */
const CORPUS_ENV = {
  read: (path) => readFileSync(path, 'utf-8'),
  list: (path) => readdirSync(path),
};

/** The root opencode hands the plugin: the directory the session runs in. */
function rootOf(ctx) {
  const directory = ctx && typeof ctx.directory === 'string' && ctx.directory.trim() ? ctx.directory.trim() : null;
  return directory ? resolve(directory) : process.cwd();
}

/** The shell command inside an opencode tool input, whatever field it is written in. */
function shellLine(input) {
  if (!input || typeof input !== 'object') return '';
  for (const key of ['command', 'cmd', 'script']) {
    if (typeof input[key] === 'string' && input[key].trim()) return input[key];
  }
  return '';
}

/** The path an opencode write tool names, whatever field it is written in. */
function writtenPath(input) {
  if (!input || typeof input !== 'object') return null;
  for (const key of ['filePath', 'file_path', 'path', 'file']) {
    if (typeof input[key] === 'string' && input[key].trim()) return input[key];
  }
  return null;
}

/** The prompt text inside a `session.prompt` event, whatever shape it arrives in. */
function promptText(event) {
  const prompt = event && event.prompt;
  if (typeof prompt === 'string') return prompt;
  if (prompt && typeof prompt === 'object' && typeof prompt.text === 'string') return prompt.text;
  if (event && typeof event.text === 'string') return event.text;
  return '';
}

/** A Claude-shaped event out of an opencode one: the modules read `session_id`, not `sessionID`. */
function claudeEvent(event, scratch) {
  const session = event && (event.sessionID || event.session_id);
  const shaped = {};
  if (typeof session === 'string' && session.trim()) shaped.session_id = session;
  if (typeof scratch === 'string' && scratch.trim()) shaped.scratchpad_dir = scratch;
  return shaped;
}

/**
 * `tool.execute.before` — the two modules that **deny**, each by throwing so the tool call aborts
 * before it runs. `command-guard` decides on the shell line; `ask-guard` holds the question's form
 * and the delegation while a list of decisions is open. Both of `ask-guard`'s verdicts live inside
 * a run, so the mark gates the whole branch exactly as `askVerdict` gates it on Claude Code.
 */
export function beforeHook(event, root, scratch) {
  const tool = event && typeof event.tool === 'string' ? event.tool : '';
  const input = event && event.input && typeof event.input === 'object' ? event.input : {};
  const ctx = loadContext(root, REAL_READS);

  if (SHELL_TOOLS.has(tool)) {
    const line = shellLine(input);
    if (line.trim()) {
      const reason = evaluate(line, root, GUARD_ENV, ctx);
      if (reason) throw new Error(reason.reason);
    }
  }

  if (QUESTION_TOOLS.has(tool) || LAUNCH_TOOLS.has(tool)) {
    const shaped = claudeEvent(event, scratch);
    if (isMarked(SESSION_ENV, markPath(shaped, SESSION_ENV))) {
      const state = readState(SESSION_ENV, statePath(shaped, SESSION_ENV));
      if (QUESTION_TOOLS.has(tool)) {
        const verdict = judgeAsk(questionsOf(input), state.ask, state.resume);
        if (verdict) throw new Error(verdict);
      } else if (state.ask) {
        throw new Error(advanceDeny(state.ask));
      }
    }
  }
  return null;
}

/**
 * `tool.execute.after` — `contracts-post-edit`, which **reports and never denies**, plus the state
 * `ask-guard` keeps after an answered batch. The callback returns nothing to the host, so the report
 * reaches the model by **replacing the tool result** — the only channel `execute.after` has.
 */
export function afterHook(event, root, scratch) {
  const tool = event && typeof event.tool === 'string' ? event.tool : '';
  const input = event && event.input && typeof event.input === 'object' ? event.input : {};

  // `ask-guard`'s `PostToolUse`: a batch of a decision list that stopped short of the last card
  // leaves its next card open, so a launch is refused until the list closes. Written inside a run
  // only, and only for the question tool — the same gate and the same seat as the Claude Code guard.
  if (QUESTION_TOOLS.has(tool)) {
    const shaped = claudeEvent(event, scratch);
    if (isMarked(SESSION_ENV, markPath(shaped, SESSION_ENV))) {
      const path = statePath(shaped, SESSION_ENV);
      const left = settled(questionsOf(input));
      if (left !== false) writeState(SESSION_ENV, path, { ask: left, resume: readState(SESSION_ENV, path).resume });
    }
  }

  const rel = relativeToRoot(writtenPath(input), root);
  if (!rel) return null;
  const text = report(rel, root, CORPUS_ENV) || null;
  if (text && event && event.result && typeof event.result === 'object') {
    const previous = typeof event.result.output === 'string' ? event.result.output : '';
    event.result.output = previous ? `${previous}\n\n${text}` : text;
  }
  return null;
}

/**
 * `session.prompt` — `run-advice`, which **speaks and never denies**, and the `UserPromptSubmit`
 * branch of `ask-guard`: a message of the owner closes the ask, and a prompt that opens a run
 * recomputes the resume mark. The notice reaches the model by **appending it to the prompt** the
 * host persists as the user input — a returned string is discarded by the host.
 */
export function promptHook(event, root, scratch) {
  const ctx = loadContext(root, REAL_READS);
  const shaped = claudeEvent(event, scratch);
  const text = promptText(event);

  const path = statePath(shaped, SESSION_ENV);
  const marked = isMarked(SESSION_ENV, markPath(shaped, SESSION_ENV));
  const opens = opensRun(text);
  if (opens || marked) {
    const resume = opens ? resumeMark(text, ctx, root, SESSION_ENV) : readState(SESSION_ENV, path).resume;
    writeState(SESSION_ENV, path, { ask: null, resume });
  }

  const answered = promptDecision({ ...shaped, hook_event_name: 'UserPromptSubmit', prompt: text }, root, SESSION_ENV, ctx);
  if (answered && answered.text && event && typeof event === 'object') {
    const target = event.prompt && typeof event.prompt === 'object' ? event.prompt : event;
    const previous = typeof target.text === 'string' ? target.text : '';
    target.text = previous ? `${previous}\n\n${answered.text}` : answered.text;
  }
  return null;
}

/**
 * The `event` subscription — `session-advice` on `session.created`, the host's `SessionStart`. The
 * stream is read-only and has no return channel, so the startup notice is delivered through the
 * `client` the host hands `setup` — the channel opencode's own plugins log on.
 */
export function eventHook(event, root, client) {
  if (!event || event.type !== 'session.created') return null;
  const ctx = loadContext(root, REAL_READS);
  const notices = warnings(root, SESSION_ENV, ctx);
  const text = notices.length ? notices.join('\n\n---\n\n') : null;
  if (text && client && client.app && typeof client.app.log === 'function') {
    try {
      Promise.resolve(client.app.log({ body: { service: 'daiku', level: 'info', message: text } })).catch(() => {});
    } catch {
      /* fail-open: a notice that cannot be delivered denies nothing */
    }
  }
  return null;
}

/**
 * The plugin's setup: attach the five modules to the live domains and return the inventory. The
 * shape is opencode's V2 promise API (`@opencode/plugin`) — `ctx.tool.hook`, `ctx.session.hook`,
 * `ctx.event.subscribe` — and the module count it reports is what the bench and the deposit
 * manifest both hold to.
 */
export function setup(ctx) {
  const root = rootOf(ctx);
  const scratch = ctx && typeof ctx.scratchpad_dir === 'string' ? ctx.scratchpad_dir : null;
  const client = ctx && ctx.client ? ctx.client : null;
  ctx.tool.hook('execute.before', (event) => beforeHook(event, root, scratch));
  ctx.tool.hook('execute.after', (event) => afterHook(event, root, scratch));
  ctx.session.hook('prompt', (event) => promptHook(event, root, scratch));
  ctx.event.subscribe((event) => eventHook(event, root, client));
  return { hooked: HOOKED.slice(), missing: MISSING.slice() };
}

/** The shape opencode's loader accepts: `{id, setup}`. */
export default { id: ID, setup };

/* ------------------------------------------------------------------------- *
 * The bench — a fake ctx that records the hooks, a throwaway project on disk
 * ------------------------------------------------------------------------- */

function selfCheck() {
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

  /** A fake opencode ctx: it records every hook registration and the client's log, and exposes the
   * hooks to drive. */
  function fakeCtx(directory, scratch) {
    const hooks = { tool: {}, session: {}, events: [], logs: [] };
    return {
      directory,
      scratchpad_dir: scratch,
      hooks,
      client: { app: { log: (input) => { hooks.logs.push(input); return Promise.resolve(); } } },
      tool: { hook: (name, cb) => { (hooks.tool[name] || (hooks.tool[name] = [])).push(cb); } },
      session: { hook: (name, cb) => { (hooks.session[name] || (hooks.session[name] = [])).push(cb); } },
      event: { subscribe: (cb) => hooks.events.push(cb) },
    };
  }

  const base = mkdtempSync(join(tmpdir(), 'daiku-opencode-'));
  const P = join(base, 'project');
  const scratch = join(base, 'scratch');
  try {
    // A project Daiku opened, with a working folder left halfway so `session-advice` has something
    // to say, and a review seat so the review guard is switched on.
    write(
      join(P, '.daiku', 'project.json'),
      JSON.stringify({ contract: 1, paths: { features: 'docs/features', review_state: '.docs/runtime/review' } })
    );
    write(join(P, 'docs', 'features', 'wip', '2. blueprint.md'), 'x\n');
    // A file whose frontmatter breaks, so `contracts-post-edit` has a finding to report.
    write(join(P, 'skills', 'broken', 'SKILL.md'), '---\nname: x\ndescription: a colon: here\n---\n');

    const ctx = fakeCtx(P, scratch);
    const inventory = setup(ctx);

    // --- the plugin shape and the inventory -------------------------------------------
    check('the plugin carries an id', typeof ID === 'string' && ID.trim().length > 0);
    check('setup is the function opencode calls', typeof setup === 'function');
    check('setup returns the five hooked modules', inventory.hooked.join(',') === HOOKED.join(','));
    check('the two missing modules are declared', inventory.missing.join(',') === 'stop-advice,subagent-advice');
    check('the file declares the two missing modules in its own text', (() => {
      const source = readFileSync(fileURLToPath(import.meta.url), 'utf-8');
      return source.includes('stop-advice') && source.includes('subagent-advice');
    })());
    check('the deposit manifest declares the same two modules', (() => {
      const source = readFileSync(join(HERE, '..', 'skills', 'init', 'deposit.mjs'), 'utf-8');
      return MISSING.every((name) => source.includes(name));
    })(), 'the deposit does not name the same missing modules');

    // --- the hooks are really registered ------------------------------------------------
    check('execute.before is hooked', (ctx.hooks.tool['execute.before'] || []).length === 1);
    check('execute.after is hooked', (ctx.hooks.tool['execute.after'] || []).length === 1);
    check('session.prompt is hooked', (ctx.hooks.session.prompt || []).length === 1);
    check('an event subscription is registered', ctx.hooks.events.length === 1);

    const before = ctx.hooks.tool['execute.before'][0];
    const after = ctx.hooks.tool['execute.after'][0];
    const prompt = ctx.hooks.session.prompt[0];
    const onEvent = ctx.hooks.events[0];

    // --- command-guard: deny by throwing ------------------------------------------------
    check(
      'a destructive command is denied',
      !!throws(() => before({ tool: 'shell', input: { command: 'git push' }, sessionID: 's' })),
      'the push was not denied'
    );
    check(
      'git commit outside a review cycle is denied',
      !!throws(() => before({ tool: 'shell', input: { command: 'git commit -m "x"' }, sessionID: 's' })),
      'the commit was not denied'
    );
    check(
      'a lawful command passes',
      throws(() => before({ tool: 'shell', input: { command: 'git status --short' }, sessionID: 's' })) === null,
      'a lawful command was denied'
    );

    // --- ask-guard: the ask form, inside a run ------------------------------------------
    // The mark `run-advice` writes when a session opens a run: outside it `ask-guard` is silent,
    // so the checks below stand inside a run exactly as the guard reads them.
    write(join(scratch, 'daiku-run.json'), JSON.stringify({ run: true }));
    const outOfForm = {
      questions: [{ question: 'Where the work lives', header: 'Where', options: [{ label: 'A — one (recommended)' }, { label: 'B — two' }] }],
    };
    const askMsg = throws(() => before({ tool: 'question', input: outOfForm, sessionID: 's' }));
    check('a decision ask without its place k/N is denied', !!askMsg, 'the malformed ask was not denied');
    check('the refusal is ask-guard\'s', typeof askMsg === 'string' && askMsg.includes('k/N'));
    // A question out of form, outside the run: the guard is silent, as it is on Claude Code.
    rmSync(join(scratch, 'daiku-run.json'), { force: true });
    check('outside a run the ask form is not enforced', throws(() => before({ tool: 'question', input: outOfForm, sessionID: 's' })) === null);
    write(join(scratch, 'daiku-run.json'), JSON.stringify({ run: true }));

    // The launch while the ask is open: the state a partial batch leaves, written on `execute.after`.
    const card = (k) => ({ question: `${k}/6 — Where the work lives`, options: [{ label: 'A — one (recommended)' }, { label: 'B — two' }] });
    after({ tool: 'question', input: { questions: [card(1), card(2), card(3), card(4)] }, sessionID: 's' }, P, scratch);
    const launchMsg = throws(() => before({ tool: 'subagent', input: { prompt: 'go' }, sessionID: 's' }));
    check('a launch while the ask is open is denied', !!launchMsg, 'the launch with the ask open was not denied');
    check('the refusal names the cards that remain', typeof launchMsg === 'string' && launchMsg.includes('cards 5–6 of 6'));
    after({ tool: 'question', input: { questions: [card(5), card(6)] }, sessionID: 's' }, P, scratch);
    check('the launch passes once the list closes', throws(() => before({ tool: 'subagent', input: { prompt: 'go' }, sessionID: 's' })) === null);

    // --- contracts-post-edit: report, never deny ----------------------------------------
    // The report reaches the model by replacing the tool result: the callback returns nothing.
    const reported = { tool: 'edit', input: { filePath: join(P, 'skills', 'broken', 'SKILL.md') }, sessionID: 's', result: { output: 'ok' } };
    check('a write is reported on, not denied', after(reported, P, scratch) === null && typeof reported.result.output === 'string' && reported.result.output.includes('block nothing'), 'no report came back');
    const quiet = { tool: 'edit', input: { filePath: join(P, 'docs', 'features', 'wip', '2. blueprint.md') }, sessionID: 's', result: { output: 'ok' } };
    after(quiet, P, scratch);
    check('and a write with nothing to say reports nothing', quiet.result.output === 'ok');

    // --- run-advice: the notice, never a denial -----------------------------------------
    // A session that has not heard the notice yet: the mark is cleared so the run speaks once.
    rmSync(join(scratch, 'daiku-run.json'), { force: true });
    const noticeEvent = { prompt: { text: '/daiku:new-feature build it' }, sessionID: 'sess-1' };
    prompt(noticeEvent, P, scratch);
    check('session.prompt appends the run notice to the prompt', typeof noticeEvent.prompt.text === 'string' && noticeEvent.prompt.text.includes('delegated'), 'no notice was appended');
    const quietPrompt = { prompt: { text: 'fix the build' }, sessionID: 'sess-2' };
    prompt(quietPrompt, P, scratch);
    check('an ordinary prompt says nothing', quietPrompt.prompt.text === 'fix the build');

    // --- session-advice: the startup notice, through the client --------------------------
    const startup = onEvent({ type: 'session.created', properties: {} });
    check('session.created logs the session notice', startup === null && ctx.hooks.logs.some((entry) => JSON.stringify(entry).includes('wip')), 'no notice was logged');
    check('another event says nothing', onEvent({ type: 'message.updated', properties: {} }) === null && ctx.hooks.logs.length === 1);

    // --- the failure contract: a broken world denies nothing it should not --------------
    const bare = fakeCtx(join(base, 'no-daiku'), null);
    setup(bare);
    const bareBefore = bare.hooks.tool['execute.before'][0];
    check(
      'a project that never opened Daiku is not guarded',
      throws(() => bareBefore({ tool: 'shell', input: { command: 'git push' } })) === null,
      'a guard fired on a project without Daiku'
    );
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
  process.exit(selfCheck());
}
