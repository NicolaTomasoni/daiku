#!/usr/bin/env node
/**
 * The run's boundary in the conversation — `UserPromptSubmit`, and `PreToolUse` on
 * `Edit`/`Write`/`MultiEdit`.
 *
 * `new-feature` is the only entry point that **converses** with the owner before the delivery: it
 * opens the folder, it asks the decisions and it waits. Every other node is launched with its input
 * already resolved and asks nothing. That conversation carries one rule the conversation itself is
 * the only place able to break: **a turn that asks for work is work, and work is a subagent** —
 * `skills/new-feature/SKILL.md` § *7. Decisions are asked in chat*. Written in prose alone the rule
 * holds exactly as long as the model remembers it, and its failure is silent: the window quietly
 * fills with the work itself, which is the one thing the chain exists to prevent.
 *
 * So the boundary is made of two gestures, and this file is both. **Neither of them blocks
 * anything**, and that is a decision, not an omission:
 *
 *  - **`UserPromptSubmit`** — the prompt that opens a run (`/…new-feature`) **marks the session**,
 *    and the rule is stated once, there, where it is about to matter. The mark is what makes the
 *    scope of the rule decidable: *this* conversation opened a run, and a conversation that did not
 *    owes the rule nothing. Once per session, never repeated — a notice that arrives every time
 *    stops being read. **And that same moment carries the second thing it says**: where the project
 *    declares `prompt_dump_chars` and the opening prompt is longer than it, the notice also names
 *    the size and the seats that exist for a payload that large — a file and its path, or
 *    `research`. The text still enters the context whole: the notice truncates nothing and blocks
 *    nothing, because moving a dump is the owner's gesture and not the hook's.
 *  - **`PreToolUse` on the write tools** — while a marked session writes **from the conversation
 *    itself**, outside the seats the run owns (`{paths.features}`, `{paths.studies}`,
 *    `{paths.handoffs}` and the `{write_roots}` the machine declares), the write is **reminded of
 *    the rule** and goes through.
 *    It is the moment the model is about to do the work in the wrong window, and the reminder lands
 *    next to the tool result.
 *
 * **Why it reminds instead of denying** (owner's decision, 30 September 2026). The rule is a
 * default of a run, not a prohibition on a gesture: the same conversation does other jobs where
 * writing is its own — `/commit` updates the changelog and the version by hand, by contract, and a
 * flat denial would stop the node that was asked for. And a denial here would have no remedy worth
 * naming: "delegate, or declare the folder, or open another session" are three different answers to
 * a gesture that is not always the same mistake. The reminder says the rule to whoever is about to
 * break it, and leaves the judgement where the contract already put it.
 *
 * **A subagent is told apart by the absence of `agent_id`, and it is not a guess.** The hook input
 * carries `agent_id` **only when the hook fires inside a subagent call** — the host's own reference
 * says so in as many words, and `agent_type` is the wrong field to test because a session started
 * with `--agent` carries it too (verified on the host reference, 2026-09-30). Absent, the call is
 * the conversation's; present, it is a child's, and a child doing the work is the whole point. A
 * host that carries no such field is a host where this notice never fires.
 *
 * **The mark never lands in the repository.** It goes where the session keeps its own scratch — the
 * `scratchpad_dir` of the event, or the OS temporary directory keyed by `session_id` where the host
 * gives none — exactly as `stop-advice.mjs` keeps its own. A state folder of Daiku's inside the
 * project would be one more seat to keep, and a notice writing where it speaks is a notice that has
 * to be guarded itself.
 *
 * The gate is the same as everywhere else: **without `.daiku/project.json` this project has not
 * opened Daiku**, and the notice stays silent without even reading the path. A project without
 * `{paths.features}` declared has no seat to measure against, and the notice stays silent rather than
 * inventing one (§6 of `contracts/project-contract.md`, applied to a hook).
 *
 * **What it does not see**, declared because a notice silent about what it does not see makes
 * readers believe it covers it:
 *
 *  - **A target built by the shell** — `cat > file`, a heredoc, `git apply` — which `PreToolUse` on
 *    the write tools never sees: the hook sees the write tool, and this is the shape that is not one.
 *  - **The degradation of §4 point 4** of `contracts/orchestration.md`: where delegation is
 *    unavailable a chain runs its steps inline, and a step running inline *is* the conversation
 *    writing. There the reminder is the only thing speaking, which is what a reminder is for.
 *  - **Codex**, whose template wires neither of the two events and whose write event carries no
 *    `agent_id`: there nothing is marked and nothing is said, and the rule's only seat is
 *    `skills/new-feature/SKILL.md`.
 *
 * **The text is written as a fact, not as an order** — the host's reference says a notice shaped
 * like an out-of-band system instruction trips the reader's defences, and this package's own
 * `stop-advice.mjs` states the same discipline.
 *
 * Contract: **fail-open**. Malformed stdin, unreadable mark, unreachable filesystem, any exception →
 * silence and exit 0.
 *
 * Test bench: `node run-advice.mjs --self-check`, from the folder it lives in. It runs on a
 * simulated filesystem and touches nothing of the project's; the total is **counted**, not
 * hard-coded. One of its cases proves the shape this file must never take: the write-side answer
 * carries a `text` and **no field a host could read as a decision**.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { invokedDirectly, projectRoot } from './project-root.mjs';
import { REAL_READS, loadContext, fakeContext, isInside } from './daiku-config.mjs';

const ROOT = projectRoot();

/**
 * The prompt that opens a run: the skill, with or without the namespace its host gives it
 * (`/new-feature`, `/daiku:new-feature`). Anchored, because a prompt that merely *mentions* the
 * skill opens nothing.
 */
const OPENER = /^\s*\/(?:[A-Za-z0-9_-]+:)?new-feature\b/;

/** Does this prompt open a run? The only question the mark rests on. */
export function opensRun(text) {
  return typeof text === 'string' && OPENER.test(text);
}

// --- the mark of the session --------------------------------------------------

/**
 * Where the mark goes: the session's own scratch directory, or, where the host gives none, the OS
 * temporary directory under the `session_id`. `null` when the event carries neither, and then
 * nothing is written and nothing is said — silence is the fallback, never a guess at a shared path.
 */
export function markPath(event, env) {
  const scratchpad = typeof event.scratchpad_dir === 'string' ? event.scratchpad_dir.trim() : '';
  if (scratchpad) return join(scratchpad, 'daiku-run.json');
  const session = typeof event.session_id === 'string' ? event.session_id.trim() : '';
  if (!session) return null;
  let base;
  try {
    base = env.tmpdir();
  } catch {
    return null; // no temporary directory: no mark, and the run goes unspoken
  }
  if (!base) return null;
  return join(base, 'daiku-run', `${session.replace(/[^A-Za-z0-9._-]/g, '_')}.json`);
}

/** Did this session open a run? An unreadable mark counts as no mark. */
export function isMarked(env, path) {
  if (!path) return false;
  try {
    const mark = JSON.parse(env.read(path));
    return !!mark && typeof mark === 'object' && mark.run === true;
  } catch {
    return false;
  }
}

/** Writes the mark, and stays silent if it cannot: the notice is worth more than the mark. */
function setMark(env, path) {
  if (!path) return;
  try {
    env.write(path, JSON.stringify({ run: true }));
  } catch {
    /* fail-open: the notice goes out anyway */
  }
}

// --- what the run's own window may write, and what it is told about the rest ---

/** The seats of the run: the working folders, the notes, and whatever folder the machine admits. */
function runSeats(ctx, root) {
  const seats = [];
  for (const site of ctx.features || []) {
    if (typeof site !== 'string' || !site.trim()) continue;
    const cleaned = site.trim().replace(/\\/g, '/');
    try {
      seats.push(isAbsolute(cleaned) || /^[A-Za-z]:/.test(cleaned) ? resolve(cleaned) : resolve(root, cleaned));
    } catch {
      /* an unresolvable site contributes nothing */
    }
  }
  if (ctx.studies) seats.push(ctx.studies);
  if (ctx.handoffs) seats.push(ctx.handoffs);
  for (const site of ctx.writeRoots || []) seats.push(site);
  return seats;
}

function insideAny(absolute, seats) {
  return seats.some((seat) => isInside(absolute, seat));
}

/** `/c/dev/x` is the path Git Bash produces and Windows `resolve` gets wrong. */
function normalizeMsys(path) {
  const match = /^\/([A-Za-z])(\/.*)?$/.exec(path);
  return match ? `${match[1]}:${match[2] || '/'}` : path;
}

/** The written path, resolved. `null` when there is no base to resolve a relative one against. */
function resolveTarget(target, base) {
  if (typeof target !== 'string' || !target.trim()) return null;
  const cleaned = normalizeMsys(target.replace(/\\/g, '/'));
  try {
    if (isAbsolute(cleaned) || /^[A-Za-z]:/.test(cleaned)) return resolve(cleaned);
    if (!base) return null; // unknown base: no verdict invented
    return resolve(base, cleaned);
  } catch {
    return null;
  }
}

/**
 * Was this hook call made **inside a subagent**? The field is present only there, and an empty
 * string is not a field: it is the shape a host that always sends the key would give to a call made
 * from the conversation.
 */
export function fromSubagent(event) {
  return typeof event.agent_id === 'string' && event.agent_id.trim() !== '';
}

/** The path an `Edit`/`Write`/`MultiEdit` call writes. `apply_patch` shapes are not read: fail-open. */
function writtenPath(input) {
  if (!input || typeof input !== 'object') return null;
  for (const key of ['file_path', 'path', 'file']) {
    if (typeof input[key] === 'string' && input[key].trim()) return input[key];
  }
  return null;
}

// --- the two things it says ---------------------------------------------------

/**
 * What the prompt event answers: the notice, once per session, or `null` for silence. `marked` says
 * whether a mark was written, so the bench can see both halves.
 */
export function promptDecision(event, root, env, ctx) {
  const prompt = typeof event.prompt === 'string' ? event.prompt : '';
  if (!opensRun(prompt)) return null;
  if (!ctx || !ctx.present) return null; // a project that never opened Daiku is not spoken to

  const path = markPath(event, env);
  // No session and no scratchpad: no mark can be kept, so nothing can be said once. Speaking anyway
  // would repeat the rule at every prompt, and a notice that arrives every time stops being read.
  if (!path) return null;

  if (isMarked(env, path)) return { text: null, marked: true }; // this session already heard it
  setMark(env, path);
  return { text: openingText(prompt, ctx), marked: true };
}

/**
 * What the notice says, and it can be two things at once: the rule, always, and — where the project
 * declared a threshold and this prompt is over it — the fact that what was pasted is a raw dump,
 * with the seats that exist for it. The second is **added, never substituted**: the rule of the run
 * is due in every session, dumped prompt or not.
 */
function openingText(prompt, ctx) {
  const threshold = typeof ctx.promptDumpChars === 'number' ? ctx.promptDumpChars : null;
  if (!threshold || prompt.length <= threshold) return notice();
  return `${notice()}\n\n${dumpNotice(prompt.length, threshold)}`;
}

/**
 * What the write event answers: the reminder, or `null` for silence. The returned object carries a
 * **`text` and nothing else** — no `decision`, no `reason`, no field a host could read as one — and
 * the bench holds it to exactly that shape: this file speaks, it never closes a door.
 *
 * Everything it needs to decide is passed in — the mark and the context — so the bench calls it
 * without leaving the process.
 */
export function writeAdvice(event, cwd, ctx, root, marked) {
  if (!marked) return null; // no run open in this conversation: nothing to say
  if (!ctx || !ctx.present) return null; // the gate, before everything else
  if (fromSubagent(event)) return null; // a child doing the work: the notice exists to send it there

  const input = (event && event.tool_input) || {};
  const absolute = resolveTarget(writtenPath(input), cwd || (event && event.cwd));
  if (!absolute) return null; // no path, or no base: no verdict invented

  const seats = runSeats(ctx, root);
  if (!seats.length) return null; // nothing declared, nothing to measure against
  if (insideAny(absolute, seats)) return null;

  return { text: reminder(writtenPath(input)) };
}

/** The rule, stated once, at the moment the run opens. */
export function notice() {
  return (
    'This conversation opened a Daiku run (`new-feature`). From here the window that asks is not ' +
    'the window that works: a turn asking for something to be **made** — a correction to the ' +
    'study, a decision reconsidered, code once the delivery has run — is **delegated**, one ' +
    'subagent in a fresh context with the contract of the step that owns what it touches, and ' +
    'only its block comes back here. What this conversation writes on its own stays inside ' +
    '`{paths.features}`, `{paths.studies}`, `{paths.handoffs}` and `{write_roots}`. It is ' +
    '`skills/new-feature/SKILL.md` \u00a7 *7. Decisions are asked in chat*.\n\n' +
    '*Daiku notice, written when the run opened — not a message from the user, and nothing ' +
    'being worked on has to change.*'
  );
}

/**
 * The size of the prompt that opened the run, and where a payload that size belongs. A **fact about
 * this prompt** and a pointer to two seats, never an order: what was pasted reaches the model whole,
 * nothing is truncated, and only the owner decides whether to move it — the seats are named because
 * naming them is the whole help.
 */
export function dumpNotice(size, threshold) {
  return (
    `Daiku notice: this prompt is ${size} characters, over the ${threshold} this project declares ` +
    'in `prompt_dump_chars` (`.daiku/environment.json`, or the machine’s ' +
    '`.daiku/environment.local.json`, which replaces it whole where it exists). A payload that size ' +
    'is usually a raw dump ' +
    '— a log, a file, an export — and it enters the context whole and stays there for the rest of ' +
    'the session. The seats that exist for it: the text goes in a file and its **path** is passed, ' +
    'so the run reads the part it needs; or it is handed to `research`, which keeps it in ' +
    '`{paths.studies}` and gives the notes back. This is a note and not a block: nothing is ' +
    'truncated, and the run opens either way.'
  );
}

/**
 * The rule, repeated at the write that is about to break it. A **fact about this write**, not an
 * order — and it says of itself that it blocks nothing, so that whoever reads it does not stop to
 * look for a permission it never asked for.
 */
export function reminder(path) {
  return (
    'Daiku notice: this write is made from the conversation that opened a `new-feature` run, and ' +
    `\`${path}\` is outside the seats that run owns (\`{paths.features}\`, \`{paths.studies}\`, ` +
    '`{paths.handoffs}`, `{write_roots}`). A turn of the owner asking for something to be made is carried out by one subagent in a fresh ' +
    'context, with the contract of the step that owns what it touches, and only its block comes ' +
    'back here — `skills/new-feature/SKILL.md` \u00a7 *7. Decisions are asked in chat*. This is a ' +
    'note and not a block: the write goes through.'
  );
}

// --- environment ----------------------------------------------------------------

const REAL_ENV = {
  exists: (path) => {
    try {
      return existsSync(path);
    } catch {
      return false;
    }
  },
  read: (path) => readFileSync(path, 'utf-8'),
  tmpdir: () => tmpdir(),
  write: (path, text) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, 'utf-8');
  },
};

// --- test bench -------------------------------------------------------------

const R = 'C:/dev/project';
const WT = 'C:/dev/wt/wt-1';

/** A simulated filesystem: a path → content map. What the notice writes lands in the same map. */
function fakeEnv(files = {}, tmp = 'C:/Temp/daiku') {
  const key = (p) => String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  const map = new Map(Object.entries(files).map(([k, v]) => [key(k), v]));
  return {
    tmpdir: () => tmp,
    exists: (p) => map.has(key(p)),
    read: (p) => {
      if (!map.has(key(p))) throw new Error(`ENOENT ${p}`);
      return map.get(key(p));
    },
    write: (p, text) => {
      map.set(key(p), text);
    },
    has: (p) => map.has(key(p)),
  };
}

const CTX = () =>
  fakeContext({
    features: ['docs/features'],
    studies: `${R}/docs/studies`,
    handoffs: `${R}/docs/handoffs`,
    reviewState: `${R}/.daiku/review-state`,
  });
const CTX_NO_SEAT = () => fakeContext({});
const CTX_ABSENT = () => fakeContext({ present: false });

const session = (extra = {}) => ({ hook_event_name: 'UserPromptSubmit', session_id: 'sess-1', ...extra });
const write = (file, extra = {}) => ({
  hook_event_name: 'PreToolUse',
  session_id: 'sess-1',
  cwd: R,
  tool_name: 'Write',
  tool_input: { file_path: file },
  ...extra,
});

function selfCheck() {
  const failed = [];
  let ran = 0;
  const check = (name, condition) => {
    ran += 1;
    if (!condition) failed.push(name);
  };

  // --- the prompt that opens a run -------------------------------------------
  check('`/daiku:new-feature` opens', opensRun('/daiku:new-feature a feature to build'));
  check('`/new-feature` opens', opensRun('/new-feature x'));
  check('a leading space does not close the door', opensRun('  /daiku:new-feature --stop-at-brief'));
  check('a mention in the middle opens nothing', !opensRun('ok, /new-feature is nice'));
  check('naming the skill without invoking it opens nothing', !opensRun('leggi new-feature'));
  check('an empty prompt opens nothing', !opensRun(''));
  check('a missing prompt opens nothing', !opensRun(undefined));

  const opening = promptDecision(session({ prompt: '/daiku:new-feature build it' }), R, fakeEnv(), CTX());
  check('the opening prompt answers', !!opening);
  check('the opening prompt writes the mark', !!opening && opening.marked);
  check('the opening prompt says the rule', !!opening && opening.text.includes('delegated'));
  check(
    'the notice says the conversation\u2019s writes are bounded',
    !!opening && opening.text.includes('{paths.features}') && opening.text.includes('{paths.studies}')
  );
  check(
    'the notice says it is not a message from the user',
    !!opening && opening.text.includes('not a message from the user')
  );
  check(
    'the notice cites the node that declares the rule',
    !!opening && opening.text.includes('skills/new-feature/SKILL.md')
  );

  check('another prompt answers nothing', promptDecision(session({ prompt: 'fix the build' }), R, fakeEnv(), CTX()) === null);
  check(
    'a project without Daiku is not spoken to',
    promptDecision(session({ prompt: '/daiku:new-feature' }), R, fakeEnv(), CTX_ABSENT()) === null
  );
  check(
    'no context at all: silence',
    promptDecision(session({ prompt: '/daiku:new-feature' }), R, fakeEnv(), undefined) === null
  );
  const absentEnv = fakeEnv();
  promptDecision(session({ prompt: '/daiku:new-feature' }), R, absentEnv, CTX_ABSENT());
  check('and no mark is written either', !absentEnv.has('C:/Temp/daiku/daiku-run/sess-1.json'));

  // --- once per session, and never on a prompt that opens nothing -------------
  const once = fakeEnv();
  const first = promptDecision(session({ prompt: '/daiku:new-feature' }), R, once, CTX());
  const second = promptDecision(session({ prompt: '/new-feature again' }), R, once, CTX());
  check('the first prompt of the session speaks', !!first && !!first.text);
  check('the second prompt of the same session stays silent', !!second && second.text === null);
  check('and the mark is still there', once.has('C:/Temp/daiku/daiku-run/sess-1.json'));
  check(
    'another session hears it again',
    !!promptDecision(session({ session_id: 'sess-2', prompt: '/new-feature' }), R, once, CTX()).text
  );

  // --- the size of the prompt that opened the run -----------------------------
  const DUMP = () => fakeContext({ features: ['docs/features'], promptDumpChars: 40 });
  const long = `/new-feature ${'x'.repeat(200)}`;
  const big = promptDecision(session({ prompt: long }), R, fakeEnv(), DUMP());
  check('a prompt over the declared size is called by its size', !!big && big.text.includes(`${long.length} characters`));
  check('and it names the declared threshold', !!big && big.text.includes('over the 40'));
  check('and the key it comes from', !!big && big.text.includes('prompt_dump_chars'));
  check(
    'and it names both environment files, not only the shared one',
    !!big && big.text.includes('.daiku/environment.json') && big.text.includes('.daiku/environment.local.json')
  );
  check(
    'and the seats that exist for a payload that size',
    !!big && big.text.includes('research') && big.text.includes('{paths.studies}')
  );
  check('and it says it blocks nothing', !!big && big.text.includes('not a block'));
  check('and the rule of the run is still stated with it', !!big && big.text.includes('delegated'));
  const small = promptDecision(session({ prompt: '/new-feature a short description' }), R, fakeEnv(), DUMP());
  check('under the declared size the notice is the rule and nothing else', !!small && !small.text.includes('prompt_dump_chars'));
  const noKey = promptDecision(session({ prompt: long }), R, fakeEnv(), CTX());
  check('a project that declares no size is not spoken to about it', !!noKey && !noKey.text.includes('prompt_dump_chars'));
  check('the size notice is a fact, not an order', dumpNotice(200, 40).startsWith('Daiku notice:'));
  check('and it truncates nothing', dumpNotice(200, 40).includes('nothing is truncated'));

  check(
    'the scratchpad of the event is where the mark goes',
    !!promptDecision(session({ prompt: '/new-feature', scratchpad_dir: 'C:/Temp/scratch' }), R, fakeEnv(), CTX())
  );
  check(
    'the mark is keyed by session without a scratchpad',
    markPath(session(), fakeEnv()) === join('C:/Temp/daiku', 'daiku-run', 'sess-1.json')
  );
  check(
    'the scratchpad wins over the temporary directory',
    markPath(session({ scratchpad_dir: 'C:/Temp/scratch' }), fakeEnv()) === join('C:/Temp/scratch', 'daiku-run.json')
  );
  check('without a session there is no mark to keep', markPath({ hook_event_name: 'UserPromptSubmit' }, fakeEnv()) === null);
  // No session: nothing can be said once, so the rule is not repeated at every prompt.
  check(
    'with no session to mark, the opening prompt stays silent',
    promptDecision({ hook_event_name: 'UserPromptSubmit', prompt: '/new-feature' }, R, fakeEnv(), CTX()) === null
  );

  // --- the write the run's window is reminded about ---------------------------
  const said = writeAdvice(write(`${R}/src/a.ts`), R, CTX(), R, true);
  check('a marked conversation writing code is spoken to', !!said && !!said.text);
  check(
    'the reminder carries a text and no field a host could read as a decision',
    !!said && Object.keys(said).join(',') === 'text'
  );
  check('the reminder names the write', !!said && said.text.includes(`${R}/src/a.ts`));
  check('the reminder names the run it is inside', !!said && said.text.includes('`new-feature`'));
  check('the reminder names the seats', !!said && said.text.includes('{paths.features}') && said.text.includes('{paths.studies}') && said.text.includes('{paths.handoffs}'));
  check('the reminder says it blocks nothing', !!said && said.text.includes('not a block'));
  check('the reminder is a fact, not an order', !!said && said.text.startsWith('Daiku notice:'));

  check('the working folders are the run\u2019s own seat', writeAdvice(write(`${R}/docs/features/x/0. problem.md`), R, CTX(), R, true) === null);
  check('the notes are the run\u2019s own seat', writeAdvice(write(`${R}/docs/studies/pg.md`), R, CTX(), R, true) === null);
  check('the handoffs are the run\u2019s own seat', writeAdvice(write(`${R}/docs/handoffs/x.md`), R, CTX(), R, true) === null);
  check('an existing file outside them is spoken to too', !!writeAdvice(write('README.md'), R, CTX(), R, true));

  // --- what is left alone, and why --------------------------------------------
  check(
    'a subagent writing code is left alone',
    writeAdvice(write(`${R}/src/a.ts`, { agent_id: 'agent-7', agent_type: 'general-purpose' }), R, CTX(), R, true) === null
  );
  check(
    'an empty agent_id is a conversation, not a child',
    !!writeAdvice(write(`${R}/src/a.ts`, { agent_id: '  ' }), R, CTX(), R, true)
  );
  check('an unmarked conversation writes without a word', writeAdvice(write(`${R}/src/a.ts`), R, CTX(), R, false) === null);
  check('a project without Daiku is not spoken to', writeAdvice(write(`${R}/src/a.ts`), R, CTX_ABSENT(), R, true) === null);
  check('a project without a declared seat is not spoken to', writeAdvice(write(`${R}/src/a.ts`), R, CTX_NO_SEAT(), R, true) === null);
  check(
    'a declared write root is a seat here too',
    writeAdvice(write('C:/dev/work/x.md'), R, fakeContext({ features: ['docs/features'], writeRoots: ['C:/dev/work'] }), R, true) === null
  );
  // `write_roots` comes from the machine's environment file, taken whole: this is the only
  // reader of that file left in the package, so its resolution is proved here.
  const readers = (files) => ({
    exists: (p) => Object.prototype.hasOwnProperty.call(files, String(p).replace(/\\/g, '/')),
    read: (p) => {
      const key = String(p).replace(/\\/g, '/');
      if (!Object.prototype.hasOwnProperty.call(files, key)) throw new Error('ENOENT');
      return files[key];
    },
  });
  const machineFile = loadContext(R, readers({
    [`${R}/.daiku/project.json`]: '{"contract": 1}',
    [`${R}/.daiku/environment.local.json`]: '{"contract": 1, "write_roots": ["C:/dev/work"]}',
    'C:/dev/work': '',
  }));
  check(
    'write_roots resolves from the machine local file',
    (machineFile.writeRoots || []).some((r) => isInside('C:/dev/work/x.md', r))
  );
  const wholeFile = loadContext(R, readers({
    [`${R}/.daiku/project.json`]: '{"contract": 1}',
    [`${R}/.daiku/environment.local.json`]: '{"contract": 1}',
    [`${R}/.daiku/environment.json`]: '{"contract": 1, "write_roots": ["C:/dev/work"]}',
    'C:/dev/work': '',
  }));
  check('the machine local file is taken whole, not merged', (wholeFile.writeRoots || []).length === 0);
  // The pair of §8 reads the same way here: a local file that does not parse is skipped and the
  // shared one is read, taken whole.
  const unreadableLocal = loadContext(R, readers({
    [`${R}/.daiku/project.json`]: '{"contract": 1}',
    [`${R}/.daiku/environment.local.json`]: '{ not json',
    [`${R}/.daiku/environment.json`]: '{"contract": 1, "write_roots": ["C:/dev/work"]}',
    'C:/dev/work': '',
  }));
  check(
    'a local file that does not parse is skipped: the roots come from the shared file',
    (unreadableLocal.writeRoots || []).some((r) => isInside('C:/dev/work/x.md', r))
  );
  // A declared root that is not on disk is dropped: the reminder never stays silent for a folder
  // nobody will write to.
  const missingRoot = loadContext(R, readers({
    [`${R}/.daiku/project.json`]: '{"contract": 1}',
    [`${R}/.daiku/environment.local.json`]: '{"contract": 1, "write_roots": ["C:/dev/ghost"]}',
  }));
  check('a declared root that does not resolve on disk is dropped', (missingRoot.writeRoots || []).length === 0);
  const noEnvironment = loadContext(R, readers({ [`${R}/.daiku/project.json`]: '{"contract": 1}' }));
  check('an absent environment file reads as no write root', (noEnvironment.writeRoots || []).length === 0);
  check(
    'a worktree root is measured like the main tree',
    !!writeAdvice(write('src/a.ts', { cwd: WT }), WT, fakeContext({ features: [`${WT}/docs/features`] }), WT, true)
  );
  check('a relative path with no base is left alone', writeAdvice({ tool_input: { file_path: 'src/a.ts' } }, null, CTX(), R, true) === null);
  check('a call with no path is left alone', writeAdvice({ tool_input: {} }, R, CTX(), R, true) === null);
  check('an unparsable tool_input is left alone', writeAdvice({ tool_input: 'x' }, R, CTX(), R, true) === null);

  // --- fail-open --------------------------------------------------------------
  const broken = {
    exists: () => {
      throw new Error('unreachable');
    },
    read: () => {
      throw new Error('unreachable');
    },
    write: () => {
      throw new Error('read-only');
    },
    tmpdir: () => {
      throw new Error('unreachable');
    },
  };
  let survived = true;
  try {
    promptDecision(session({ prompt: '/new-feature' }), R, broken, CTX());
    writeAdvice(write(`${R}/src/a.ts`), R, CTX(), R, true);
  } catch (error) {
    survived = false;
  }
  check('a broken filesystem never throws', survived);
  check('a broken filesystem says nothing', promptDecision(session({ prompt: '/new-feature' }), R, broken, CTX()) === null);
  // A mark that cannot be *written* is a different case from one that cannot be located: the session
  // has a scratch directory, and the notice is worth more than the mark.
  const readOnly = {
    ...broken,
    tmpdir: () => 'C:/Temp/daiku',
    write: () => {
      throw new Error('read-only');
    },
    read: () => {
      throw new Error('unreadable');
    },
  };
  check('an unwritable mark still lets the notice out', !!promptDecision(session({ prompt: '/new-feature' }), R, readOnly, CTX()));
  check('an unreadable mark says nothing', writeAdvice(write(`${R}/src/a.ts`), R, CTX(), R, false) === null);

  // --- the mark is read, not presumed ----------------------------------------
  const empty = fakeEnv();
  check('no mark on disk: nothing is marked', isMarked(empty, markPath(session(), empty)) === false);
  const foreign = '{"other":1}';
  check(
    'a mark written by another tool is not ours',
    isMarked(fakeEnv({ 'C:/Temp/daiku/daiku-run/sess-1.json': foreign }), markPath(session(), fakeEnv({ 'C:/Temp/daiku/daiku-run/sess-1.json': foreign }))) === false
  );
  check('an unreadable mark is no mark', isMarked(fakeEnv(), 'C:/nope.json') === false);

  process.stdout.write(
    JSON.stringify({ checks: ran, passed: ran - failed.length, failed }, null, 2) + '\n'
  );
  return failed.length ? 1 : 0;
}

// --- main ---------------------------------------------------------------------

/** The event on stdin, or `null` when there is none to read. */
async function readEvent() {
  if (process.stdin.isTTY) return null;
  const pieces = [];
  for await (const piece of process.stdin) pieces.push(piece);
  const raw = Buffer.concat(pieces).toString('utf-8');
  if (!raw.trim()) return null;
  try {
    const event = JSON.parse(raw);
    return event && typeof event === 'object' && !Array.isArray(event) ? event : null;
  } catch {
    return null;
  }
}

function emit(eventName, text) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: eventName, additionalContext: text } }));
}

async function main() {
  const event = await readEvent();
  if (!event) return;
  const root = projectRoot({ cwd: event.cwd || ROOT });
  const ctx = loadContext(root, REAL_READS);
  const path = markPath(event, REAL_ENV);

  if (event.hook_event_name === 'UserPromptSubmit') {
    const answered = promptDecision(event, root, REAL_ENV, ctx);
    if (answered && answered.text) emit('UserPromptSubmit', answered.text);
    return;
  }

  // The write event: the reminder rides along with the call, which goes through untouched. No
  // `permissionDecision` is ever emitted here — this file speaks.
  const outcome = writeAdvice(event, event.cwd || ROOT, ctx, root, isMarked(REAL_ENV, path));
  if (!outcome) return;
  emit('PreToolUse', outcome.text);
}

if (invokedDirectly(import.meta.url)) {
  if (process.argv.includes('--self-check')) {
    process.exit(selfCheck());
  }
  main().catch(() => process.exit(0));
}
