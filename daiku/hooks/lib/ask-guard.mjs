#!/usr/bin/env node
/**
 * The ask's boundary — `PreToolUse` on `AskUserQuestion` and on the subagent launch,
 * `PostToolUse` on `AskUserQuestion`, `UserPromptSubmit`.
 *
 * `new-feature` is the only node that asks the owner a **list** of decisions, and the list does not
 * fit in the tool that asks it: `AskUserQuestion` carries **at most four questions per call**. A
 * list of six is therefore asked in two calls, and nothing in the method made the second one
 * obligatory. The prose of `contracts/orchestration.md` § *Ask the owner* said "make more calls in
 * sequence", and a written instruction is not a constraint: a run that asks four of six and carries
 * on answers the remaining two **in the owner's place**, silently, and the owner never learns the
 * list had six. The loss is invisible from every angle — the form looked complete, the block came
 * back well formed, the document is written — which is exactly why it cannot be left to prose.
 *
 * **The list is numbered, and the number is what makes the loop decidable.** Every question of a
 * decision ask opens with its place in the list — `k/N`, its own place and the length of the list —
 * and this hook is the seat that holds the run to it. Four rules, and they are all mechanical:
 *
 *  - **A decision ask without a place is refused** (`PreToolUse`). The place is not a courtesy: it
 *    is the only thing that says how long the list is, and a list whose length nobody wrote down is
 *    a list nobody can check for completeness. A call that omits it goes out again with it.
 *  - **A batch continues the list it belongs to** — the same `N`, contiguous `k`, opening where the
 *    previous batch stopped. A first batch opens at `1/N`; a batch outside that shape is refused,
 *    and the refusal names the cards that remain.
 *  - **A list a folder already began opens where it stopped.** `new-feature` accepts a folder
 *    already opened, and there it resumes instead of starting again: it asks the cards the decision
 *    document left **without an answer**, and those cards keep the place they have in that
 *    document's list — so on a resume the first batch opens above `1/N`, and nowhere else does. The
 *    prompt is where this is read, because it is the only moment the folder is named.
 *  - **The launch of a subagent is refused while the ask is open.** That is the gesture that carries
 *    the run past the ask — incorporation, brief, delivery are all subagents — so the run cannot
 *    reach the work that answers the decisions while cards of the list are unasked. This is the
 *    whole enforcement, and it denies **no file**: the write guard of the package is gone and stays
 *    gone, and what is denied here is a delegation, which no work needs while the owner is being
 *    asked.
 *  - **A message of the owner closes the ask.** The state is dropped at `UserPromptSubmit`: the
 *    owner may always answer outside the options, and a free answer prevails — so their word
 *    releases the launch, and the run continues on what they said (§ *Ask the owner*).
 *
 * **How a decision ask is told apart.** Not by the session, and not by a guess at the prose: by the
 * form the contract fixes for it — every option's label opening with its id (`A — <text>`, in order,
 * no letter skipped) and the label of `A` closing with `(recommended)`. That is what
 * § *Ask the owner* mandates for a decision and for nothing else, so the asks of another node —
 * `init`'s two languages, `new-project`'s interview, the confirmation of a folder that already
 * exists — pass through untouched. And the run itself is told apart by the mark `run-advice.mjs`
 * already writes when the session opens a `new-feature` run: **outside that mark this hook is
 * silent**, because outside a run there is no list to keep whole. A second mark would be a second
 * answer to the same question, so it is read from there and not written again here.
 *
 * **What the place cannot do, declared because a guard silent about its own holes is read as
 * covering them.**
 *
 *  - **The length of the list is declared by the ask itself.** This hook holds a batch to the list
 *    it continues, and refuses a batch incoherent with it; it cannot know that `N` is the length of
 *    the list the block returned — the list is not on the disk in a form a program reads, and the
 *    block lives in the conversation. A question that lies about `N` closes nothing worse than it
 *    can see. What the place buys is not infallibility but **visibility**: a list declared six is
 *    asked to its sixth card, and the owner reads `3/6` in the form they are answering.
 *  - **A free answer in chat and a silent omission look alike.** The owner's message releases the
 *    launch, by rule above, and whether it answered the cards is judged in the conversation and not
 *    here.
 *  - **An ask that never came back arms nothing.** The state settles at `PostToolUse`: a call that
 *    failed leaves the run where it was. The failure is loud on the host's side — the model sees the
 *    error and asks again — which is the difference from a batch quietly not asked.
 *  - **A resume is read from the prompt, and only there.** A run resumed without naming the folder —
 *    the owner describing the problem, the slug derived from prose — is not seen as one, and its
 *    first batch is held to `1/N`. That the folder already exists is no proof: pointing at it is
 *    what tells a resume from an opening.
 *  - **Codex** has no `AskUserQuestion`: there this hook runs wired to nothing, and the rule's only
 *    seat is the contract. Same on a project without `.daiku/project.json`: the gate of §6 of
 *    `contracts/project-contract.md` comes before everything else, and without it this hook does not
 *    even read the mark.
 *
 * Contract: **fail-open** on everything but its own two verdicts. Malformed stdin, unreadable state,
 * unreachable filesystem, any exception → silence and exit 0. The two verdicts are the refusals of a
 * malformed ask and of a launch with the ask open, and they are refusals of a **gesture**: they
 * carry the reason, name the cards that remain, and close the moment the list does.
 *
 * Test bench: `node ask-guard.mjs --self-check`, from the folder it lives in. It builds its events
 * and a simulated session filesystem in memory and touches nothing of the project's; the total is
 * **counted**, not hard-coded.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { invokedDirectly, projectRoot } from './project-root.mjs';
import { REAL_READS, loadContext, fakeContext, isInside } from './daiku-config.mjs';
import { isMarked, markPath } from './run-advice.mjs';

// --- the form of a decision ask ------------------------------------------------

/**
 * The prompt that opens a run: the skill, with or without the namespace its host gives it
 * (`/new-feature`, `/daiku:new-feature`). Anchored, because a prompt that merely *mentions* the
 * skill opens nothing — the same reading `run-advice.mjs` makes of the same prompt.
 */
const OPENERS = /^\s*\/(?:[A-Za-z0-9_-]+:)?new-feature\b/;

/** An option's label opening with its id: `A — <text>`, whatever dash the host typed. */
const OPTION_ID = /^\s*([A-D])\s*[\u2014\u2013-]\s*/;

/** The label of `A` closing with the marker that says which option is recommended. */
const RECOMMENDED = /\((?:recommended|raccomandata|consigliata|raccomandato)\)\s*$/i;

/** The place of a question in its list: `k/N`, at the opening of the question. */
const PLACE = /^\s*(?:\*\*)?\s*(\d{1,3})\s*\/\s*(\d{1,3})\b/;

/** The tools that launch a subagent — the delegation of §4 of `contracts/orchestration.md`. */
const LAUNCHES = ['Agent', 'Task'];

/** The questions of an ask, or `null` when the shape is not one this hook reads. */
export function questionsOf(toolInput) {
  if (!toolInput || typeof toolInput !== 'object' || Array.isArray(toolInput)) return null;
  const questions = toolInput.questions;
  if (!Array.isArray(questions) || questions.length === 0) return null;
  return questions;
}

/**
 * Is this the ask of a decision list? The form `contracts/orchestration.md` § *Ask the owner* fixes:
 * every option of every question opens with its id, in order and without skipping letters, and the
 * label of `A` closes with the recommended marker. Anything else is another node's question, and
 * this hook has nothing to say about it.
 */
export function isDecisionAsk(questions) {
  if (!Array.isArray(questions) || questions.length === 0) return false;
  return questions.every((question) => {
    if (!question || typeof question !== 'object') return false;
    const options = question.options;
    if (!Array.isArray(options) || options.length < 2 || options.length > 4) return false;
    for (let at = 0; at < options.length; at += 1) {
      const label = options[at] && options[at].label;
      if (typeof label !== 'string') return false;
      const id = OPTION_ID.exec(label);
      if (!id || id[1] !== 'ABCD'[at]) return false;
    }
    return RECOMMENDED.test(String(options[0].label));
  });
}

/**
 * A declared seat, made absolute: the seats of `.daiku/project.json` are relative to the technical
 * root, never to the cwd — the same reading `run-advice.runSeats` makes of the same field. `null`
 * when a relative one has no root to resolve against.
 */
function absoluteSeat(site, root) {
  const cleaned = site.trim().replace(/\\/g, '/');
  try {
    if (isAbsolute(cleaned) || /^[A-Za-z]:/.test(cleaned)) return resolve(cleaned);
    return root ? resolve(root, cleaned) : null;
  } catch {
    return null;
  }
}

/**
 * Does this prompt open a run **on a folder already there**? A run resumed on its folder asks the
 * cards the decision document left without an answer, so its first batch carries the place those
 * cards have in that list and not `1/N` — the only place the opening rule bends. Read from the
 * prompt because it is the only moment the folder is named: nothing later says where the run came
 * from. Any token of the argument may name it — a bare slug, a path under the working folders — and
 * a token that resolves to nothing is not one: fail-open, the strict rule holds.
 */
export function namesAFolder(prompt, ctx, root, env) {
  if (typeof prompt !== 'string' || !OPENERS.test(prompt)) return false;
  const seats = ((ctx && ctx.features) || [])
    .filter((site) => typeof site === 'string' && site.trim())
    .map((site) => absoluteSeat(site, root))
    .filter(Boolean);
  if (!seats.length) return false;
  const argument = prompt.replace(OPENERS, '');
  for (const raw of argument.split(/\s+/)) {
    const token = raw.replace(/^["']|["']$/g, '');
    if (!token || token.startsWith('-')) continue;
    const cleaned = token.replace(/\\/g, '/');
    const msys = /^\/([A-Za-z])(\/.*)?$/.exec(cleaned);
    const path = msys ? `${msys[1]}:${msys[2] || '/'}` : cleaned;
    const absolute = isAbsolute(path) || /^[A-Za-z]:/.test(path);
    const candidates = [];
    for (const seat of seats) {
      try {
        candidates.push(absolute ? resolve(path) : resolve(seat, path));
        if (!absolute && root) candidates.push(resolve(root, path));
      } catch {
        /* an unresolvable token names nothing */
      }
    }
    const inside = (candidate) => seats.some((seat) => isInside(candidate, seat));
    try {
      if (candidates.some((candidate) => inside(candidate) && env.exists(candidate))) return true;
    } catch {
      return false; // a filesystem that cannot answer: no resume claimed
    }
  }
  return false;
}

/** Where each question says it stands: `{k, n}`, or `null` for a question that carries no place. */
export function placesOf(questions) {
  return (Array.isArray(questions) ? questions : []).map((question) => {
    const text = question && typeof question.question === 'string' ? question.question : '';
    const found = PLACE.exec(text);
    if (!found) return null;
    const k = Number(found[1]);
    const n = Number(found[2]);
    if (k < 1 || n < 1 || k > n) return null;
    return { k, n };
  });
}

// --- the state of an open ask ----------------------------------------------------

/**
 * Where the state goes: the session's own scratch directory, or, where the host gives none, the OS
 * temporary directory under the `session_id` — the same seat `run-advice.mjs` keeps its mark in, and
 * for the same reason: a notice writing in the project would be one more seat to guard.
 */
export function statePath(event, env) {
  const scratchpad = typeof event.scratchpad_dir === 'string' ? event.scratchpad_dir.trim() : '';
  if (scratchpad) return join(scratchpad, 'daiku-ask.json');
  const session = typeof event.session_id === 'string' ? event.session_id.trim() : '';
  if (!session) return null;
  let base;
  try {
    base = env.tmpdir();
  } catch {
    return null;
  }
  if (!base) return null;
  return join(base, 'daiku-ask', `${session.replace(/[^A-Za-z0-9._-]/g, '_')}.json`);
}

/** An ask off its own domain is no ask: a total of nothing, a card past its own end. */
function askOf(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { total, next } = value;
  if (!Number.isInteger(total) || total < 1 || total > 999) return null;
  if (!Number.isInteger(next) || next < 1 || next > total) return null;
  return { total, next };
}

/** What this session carries: the ask left open, and whether the run resumed a folder. */
export function readState(env, path) {
  const nothing = { ask: null, resume: false };
  if (!path) return nothing;
  try {
    const value = JSON.parse(env.read(path));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return nothing;
    return { ask: askOf(value.ask), resume: value.resume === true };
  } catch {
    return nothing; // unreadable, absent, or another tool's file: no ask, and nothing is refused
  }
}

/** The open ask of this session: `{total, next}`, or `null` when the list is closed. */
export function readAsk(env, path) {
  return readState(env, path).ask;
}

export function writeState(env, path, state) {
  if (!path) return;
  try {
    env.write(path, JSON.stringify({ ask: askOf(state && state.ask), resume: !!(state && state.resume) }));
  } catch {
    /* fail-open: a state that cannot be kept refuses nothing */
  }
}

/** The state after an answered batch: the next card or nothing, the resume mark kept. */
export function writeAsk(env, path, ask) {
  writeState(env, path, { ask, resume: readState(env, path).resume });
}

export function clearAsk(env, path) {
  writeState(env, path, { ask: null, resume: readState(env, path).resume });
}

/** What an answered batch leaves open: `{total, next}`, or `null` when the list is complete. */
export function askAfter(questions) {
  const places = placesOf(questions);
  if (!places.length || places.some((place) => !place)) return null;
  const total = places[0].n;
  const last = places[places.length - 1].k;
  return last < total ? { total, next: last + 1 } : null;
}

// --- the two verdicts ---------------------------------------------------------------

/** The cards a state has left, named the way the refusal names them: `cards 5\u20136 of 6`. */
const where = (ask) => `cards ${ask.next}\u2013${ask.total} of ${ask.total}`;

/**
 * The refusal of a decision ask that is not a window on its own list, or `null` to let it pass.
 * `resumed` says the run was opened on a folder already there: the list began in a previous
 * session, and its first batch opens at the first card the document left open, not at `1/N`.
 */
export function judgeAsk(questions, open, resumed = false) {
  if (!Array.isArray(questions) || questions.length === 0) return null;
  if (!isDecisionAsk(questions)) return null; // another node's question: not this hook's business

  const places = placesOf(questions);
  if (places.some((place) => !place)) {
    return (
      'Daiku: this call asks the decisions of a run and its questions carry no place in the list. ' +
      'Every question of a decision ask opens with `k/N` \u2014 its own place and the length of the list ' +
      '\u2014 because four questions per call is a property of the tool and not of the list: a list longer ' +
      'than four is asked in consecutive calls, from `1/N` to `N/N`, and the ask is closed only when the ' +
      'last card has been asked. The ask goes out again with the place in it, unchanged otherwise. It is ' +
      '`contracts/orchestration.md` \u00a7 *Ask the owner*.'
    );
  }

  const total = places[0].n;
  if (places.some((place) => place.n !== total)) {
    return (
      'Daiku: the questions of one call declare two different lengths for the list ' +
      `(${places.map((place) => `${place.k}/${place.n}`).join(', ')}). One call is one window on one ` +
      'list: every question of a batch carries the same `N`.'
    );
  }
  if (places.length > 4) {
    return (
      `Daiku: the call carries ${places.length} questions and the tool carries at most four. Split the ` +
      'batch, in the order of the list.'
    );
  }
  for (let at = 1; at < places.length; at += 1) {
    if (places[at].k !== places[at - 1].k + 1) {
      return (
        `Daiku: the place jumps inside the call (${places.map((place) => place.k).join(', ')}): the ` +
        'questions of one batch are consecutive cards of the list, in its order.'
      );
    }
  }
  if (places[places.length - 1].k > total) {
    return `Daiku: the call asks past the end of the list \u2014 a card after ${total}/${total}.`;
  }

  if (open) {
    if (total !== open.total) {
      return (
        `Daiku: the ask is open on a list of ${open.total} and this call declares ${total}. A batch ` +
        'continues the list it belongs to; a list the owner has not finished seeing is not replaced ' +
        'halfway.'
      );
    }
    if (places[0].k !== open.next) {
      return (
        `Daiku: the ask is open and ${where(open)} are still unasked \u2014 this call opens at ` +
        `${places[0].k}/${open.total}, and the batch opens at \`${open.next}/${open.total}\`. The ask ` +
        `closes when \`${open.total}/${open.total}\` has been asked.`
      );
    }
    return null;
  }

  if (places[0].k !== 1 && !resumed) {
    return (
      `Daiku: the list is asked from its first card and this call opens at ${places[0].k}/${total}: ` +
      'the cards before it would be answered without ever being put to the owner. Open the ask at ' +
      `\`1/${total}\`.`
    );
  }
  return null;
}

/** The refusal of the launch while the ask is open, or `null` to let it pass. */
export function advanceDeny(open) {
  return (
    `Daiku: the decision ask is open \u2014 ${where(open)} are unasked \u2014 and this call launches a ` +
    'subagent, which is how the run reaches the work that answers the decisions (incorporation, brief, ' +
    'delivery). Nothing is wrong with the work being delegated: what is missing is the rest of the list, ' +
    'and it is asked before the run goes on with it. The cards that remain go out in a batch opening at ' +
    `\`${open.next}/${open.total}\`; a message of the owner closes the ask too, and their free answer ` +
    'prevails \u2014 `contracts/orchestration.md` \u00a7 *Ask the owner*.'
  );
}

/** Does this tool call launch a subagent? */
export function isLaunch(toolName) {
  return typeof toolName === 'string' && LAUNCHES.includes(toolName);
}

// --- what each event answers -----------------------------------------------------------

/**
 * `PreToolUse` on `AskUserQuestion`: the verdict on the ask, or `null` for silence. `marked` is the
 * run's mark and `open` the state read from it, both passed in so the bench calls this without
 * touching a disk.
 */
export function askVerdict(event, marked, open, resumed = false) {
  if (!marked) return null; // outside a run there is no list to keep whole
  if (isLaunch(event && event.tool_name)) {
    return open ? advanceDeny(open) : null;
  }
  if (event && event.tool_name !== 'AskUserQuestion') return null;
  return judgeAsk(questionsOf(event && event.tool_input), open, resumed);
}

/**
 * `PostToolUse` on `AskUserQuestion`: what the answered batch leaves behind. Returns the state to
 * keep — `{total, next}` or `null` — and `false` when this was not an ask of a list, so the caller
 * leaves the state exactly as it was.
 */
export function settled(questions) {
  if (!isDecisionAsk(questions)) return false;
  return askAfter(questions);
}

// --- environment -------------------------------------------------------------------------

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

// --- test bench ---------------------------------------------------------------------------

/** A simulated filesystem: a path → content map. What the state writes lands in the same map. */
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

const R = 'C:/dev/project';
const CTX = () => fakeContext({ features: ['docs/features'] });
const CTX_ABSENT = () => fakeContext({ present: false });

/** One decision question, in the form § *Ask the owner* fixes, at the place told. */
function decision(place, title = 'Where the work lives', letters = ['A', 'B', 'C']) {
  return {
    question: `${place} \u2014 ${title}: which one holds?`,
    header: title,
    options: letters.map((letter, at) => ({
      label: `${letter} \u2014 option ${at}${at === 0 ? ' (recommended)' : ''}`,
      description: `what option ${at} entails`,
    })),
    multiSelect: false,
  };
}

const ask = (questions) => ({ hook_event_name: 'PreToolUse', session_id: 'sess-1', tool_name: 'AskUserQuestion', tool_input: { questions } });
const launch = (extra = {}) => ({ hook_event_name: 'PreToolUse', session_id: 'sess-1', tool_name: 'Agent', tool_input: { prompt: 'go' }, ...extra });
const prompt = (extra = {}) => ({ hook_event_name: 'UserPromptSubmit', session_id: 'sess-1', ...extra });

function selfCheck() {
  const failed = [];
  let ran = 0;
  const check = (name, condition) => {
    ran += 1;
    if (!condition) failed.push(name);
  };

  // --- the form of a decision ask --------------------------------------------
  check('a list of decisions is read as one', isDecisionAsk([decision('1/3'), decision('2/3')]));
  check('one card alone is a list too', isDecisionAsk([decision('4/4')]));
  check('the dash of the id is free', isDecisionAsk([{ ...decision('1/1'), options: [{ label: 'A - one (recommended)' }, { label: 'B - two' }] }]));
  check('a question without the recommended marker is another node\u2019s ask', !isDecisionAsk([{ ...decision('1/2'), options: [{ label: 'A \u2014 one' }, { label: 'B \u2014 two' }] }]));
  check('a question with no id in the labels is another node\u2019s ask', !isDecisionAsk([{ ...decision('1/2'), options: [{ label: 'Proceed (recommended)' }, { label: 'Cancel' }] }]));
  check('an id out of order is not the form', !isDecisionAsk([{ ...decision('1/2'), options: [{ label: 'B \u2014 one (recommended)' }, { label: 'A \u2014 two' }] }]));
  check('a single option is not the form', !isDecisionAsk([{ ...decision('1/2'), options: [{ label: 'A \u2014 one (recommended)' }] }]));
  check('an empty ask is not a list', !isDecisionAsk([]));
  check('a question that is not an object is not the form', !isDecisionAsk([null]));
  check('an ask with no questions is not read', questionsOf({}) === null);
  check('an ask whose questions are not an array is not read', questionsOf({ questions: 'x' }) === null);
  check('a tool_input that is not an object is not read', questionsOf('x') === null);
  check('the questions of an ask are read whole', (questionsOf({ questions: [decision('1/2')] }) || []).length === 1);

  // --- the place in the list ---------------------------------------------------
  const places = placesOf([decision('1/3'), decision('2/3')]);
  check('the place of a question is read', !!places[0] && places[0].k === 1 && places[0].n === 3);
  check('the place of the second question too', !!places[1] && places[1].k === 2 && places[1].n === 3);
  check('a question with no place has none', placesOf([decision('nothing')])[0] === null);
  check('markdown around the place is tolerated', placesOf([{ question: '**3/7** \u2014 a title' }])[0].k === 3);
  check('a place past its own length is no place', placesOf([{ question: '5/3 \u2014 a title' }])[0] === null);
  check('a place that is not a place is no place', placesOf([{ question: 'see 2 of 3 \u2014 a title' }])[0] === null);

  // --- the ask is refused when it is not a window on its list -------------------
  check('a full batch of a long list passes', judgeAsk([decision('1/6'), decision('2/6'), decision('3/6'), decision('4/6')], null) === null);
  check('a list asked whole passes', judgeAsk([decision('1/2'), decision('2/2')], null) === null);
  check('an ask without a place is refused', !!judgeAsk([decision('1/3'), decision('nothing')], null));
  check('the refusal of a place names the contract', judgeAsk([decision('nothing')], null).includes('contracts/orchestration.md'));
  check('the refusal of a place says the form', judgeAsk([decision('nothing')], null).includes('k/N'));
  check('two lengths in one call are refused', !!judgeAsk([decision('1/5'), decision('2/6')], null));
  check('a jump inside the call is refused', !!judgeAsk([decision('1/5'), decision('3/5')], null));
  check('a batch past the ceiling of four is refused', !!judgeAsk([decision('1/9'), decision('2/9'), decision('3/9'), decision('4/9'), decision('5/9')], null));
  check('a card past the end of the list is refused', !!judgeAsk([decision('3/3'), decision('4/3')], null));
  check('a first batch not opening at 1 is refused', !!judgeAsk([decision('2/5')], null));
  check('the refusal says where the ask opens', judgeAsk([decision('2/5')], null).includes('`1/5`'));
  check('another node\u2019s ask passes untouched', judgeAsk([{ question: 'Which language?', options: [{ label: 'Italiano (recommended)' }, { label: 'English' }] }], null) === null);
  check('an ask with no questions passes in silence', judgeAsk([], null) === null);

  // --- and it continues the list it belongs to ----------------------------------
  const open = { total: 6, next: 5 };
  check('the batch that closes the list passes', judgeAsk([decision('5/6'), decision('6/6')], open) === null);
  check('a batch reopening the list is refused', !!judgeAsk([decision('1/6')], open));
  check('the refusal of a reopen says what remains', judgeAsk([decision('1/6')], open).includes('cards 5\u20136 of 6'));
  check('a batch skipping a card is refused', !!judgeAsk([decision('6/6')], open));
  check('a batch declaring another length is refused', !!judgeAsk([decision('5/7')], open));
  check('the refusal names the card the batch opens at', judgeAsk([decision('6/6')], open).includes('`5/6`'));

  // --- what an answered batch leaves open ---------------------------------------
  const left = askAfter([decision('1/6'), decision('2/6'), decision('3/6'), decision('4/6')]);
  check('a batch under the end leaves the ask open', !!left && left.total === 6 && left.next === 5);
  check('a batch closing the list leaves nothing open', askAfter([decision('5/6'), decision('6/6')]) === null);
  check('a list asked whole leaves nothing open', askAfter([decision('1/2'), decision('2/2')]) === null);
  check('a batch with no place leaves nothing', askAfter([decision('nothing')]) === null);

  // --- the launch, refused while the ask is open ---------------------------------
  check('the launch with the ask open is refused', !!advanceDeny(open));
  check('the refusal names the cards that remain', advanceDeny(open).includes('cards 5\u20136 of 6'));
  check('the refusal names the batch that closes it', advanceDeny(open).includes('`5/6`'));
  check('the refusal says the owner\u2019s word closes the ask', advanceDeny(open).includes('a message of the owner'));
  check('a launch is a launch', isLaunch('Agent') && isLaunch('Task'));
  check('a write is not a launch', !isLaunch('Edit') && !isLaunch('Bash') && !isLaunch(undefined));

  // --- the resume: a list the folder already began --------------------------------
  check('a resumed list opens where it stopped', judgeAsk([decision('5/6'), decision('6/6')], null, true) === null);
  check('an opening list above the first card is still refused without a resume', !!judgeAsk([decision('5/6')], null, false));
  check('a resume does not excuse a jump inside the call', !!judgeAsk([decision('5/6'), decision('7/6')], null, true));
  check('a resume does not excuse a missing place', !!judgeAsk([decision('5/6'), decision('nothing')], null, true));
  check('a resume still continues the list once it is open', judgeAsk([decision('5/6'), decision('6/6')], { total: 6, next: 5 }, true) === null);
  check('a resume still refuses a batch that skips', !!judgeAsk([decision('6/6')], { total: 6, next: 5 }, true));

  const seat = 'C:/dev/project/.daiku/features';
  const seated = () => fakeContext({ features: [seat] });
  const folder = (name, extra = {}) => fakeEnv({ [`${seat}/${name}`]: '', ...extra });
  check('a bare slug of a folder already there is a resume', namesAFolder('/daiku:new-feature prova', seated(), R, folder('prova')));
  check('a path to the folder is a resume too', namesAFolder('/new-feature .daiku/features/prova', seated(), R, folder('prova')));
  check('the folder may come after other words', namesAFolder('/new-feature riprendi su .daiku/features/prova', seated(), R, folder('prova')));
  check('quote around the folder do not stop it', namesAFolder('/new-feature "prova"', seated(), R, folder('prova')));
  check('a flag is not a folder', namesAFolder('/new-feature --stop-at-brief prova', seated(), R, folder('prova')));
  check('a description naming no folder is not a resume', namesAFolder('/new-feature the wiring between X and Y is missing', seated(), R, folder('prova')) === false);
  check('a folder that is not there is not a resume', namesAFolder('/new-feature assente', seated(), R, folder('prova')) === false);
  check('a folder outside the seats is not a resume', namesAFolder('/new-feature C:/dev/altro/prova', seated(), R, folder('prova', { 'C:/dev/altro/prova': '' })) === false);
  check('a prompt that opens nothing is not a resume', namesAFolder('ok, /new-feature prova is nice', seated(), R, folder('prova')) === false);
  check('without a declared seat there is no resume', namesAFolder('/new-feature prova', fakeContext({}), R, folder('prova')) === false);
  check('an unreadable filesystem claims no resume', namesAFolder('/new-feature prova', seated(), R, {
    exists: () => {
      throw new Error('unreachable');
    },
  }) === false);
  const kept = fakeEnv();
  writeState(kept, statePath({ session_id: 'sess-1' }, kept), { ask: { total: 6, next: 5 }, resume: true });
  check('the resume mark survives the other writes', readState(kept, statePath({ session_id: 'sess-1' }, kept)).resume === true);
  writeAsk(kept, statePath({ session_id: 'sess-1' }, kept), null);
  check('closing the ask keeps the resume mark', readState(kept, statePath({ session_id: 'sess-1' }, kept)).resume === true);
  check('the ask closed is no ask', readAsk(kept, statePath({ session_id: 'sess-1' }, kept)) === null);

  // --- what each event answers ----------------------------------------------------
  check('a marked session asking out of form is refused', !!askVerdict(ask([decision('nothing')]), true, null));
  check('a marked session asking in form is left alone', askVerdict(ask([decision('1/2')]), true, null) === null);
  check('an unmarked session is not spoken to', askVerdict(ask([decision('nothing')]), false, null) === null);
  check('an unmarked session\u2019s launch is left alone', askVerdict(launch(), false, open) === null);
  check('a marked launch with the ask open is refused', !!askVerdict(launch(), true, open));
  check('a marked launch with the list closed is left alone', askVerdict(launch(), true, null) === null);
  check('a marked write is left alone', askVerdict({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: 'x' } }, true, open) === null);
  check('a covered ask settles the state', settled([decision('1/2'), decision('2/2')]) === null);
  check('a partial ask leaves the next card', settled([decision('1/4')]).next === 2);
  check('an ask of another node settles nothing', settled([{ question: 'q', options: [{ label: 'a' }, { label: 'b' }] }]) === false);
  check('a call with no questions settles nothing', settled(null) === false);

  // --- the state on disk ------------------------------------------------------------
  const env = fakeEnv();
  const path = statePath({ session_id: 'sess-1' }, env);
  check('the state is keyed by session', path === join('C:/Temp/daiku', 'daiku-ask', 'sess-1.json'));
  check('the scratchpad wins over the temporary directory', statePath({ session_id: 's', scratchpad_dir: 'C:/Temp/scratch' }, env) === join('C:/Temp/scratch', 'daiku-ask.json'));
  check('without a session there is no state to keep', statePath({ hook_event_name: 'PreToolUse' }, env) === null);
  check('no state on disk is no open ask', readAsk(env, path) === null);
  writeAsk(env, path, { total: 6, next: 5 });
  check('a state written is a state read', readAsk(env, path).next === 5);
  clearAsk(env, path);
  check('a cleared state is no open ask', readAsk(env, path) === null);
  check('a state of another tool is not ours', readAsk(fakeEnv({ 'C:/Temp/daiku/daiku-ask/sess-1.json': '{"other":1}' }), path) === null);
  check('an unreadable state is no open ask', readAsk(fakeEnv(), path) === null);
  check('a state with no session is not read', readAsk(env, null) === null);
  const hostile = fakeEnv({ 'C:/Temp/daiku/daiku-ask/sess-1.json': '{"ask":{"total":0,"next":1}}' });
  check('a state off its own domain is no open ask', readAsk(hostile, path) === null);
  const past = fakeEnv({ 'C:/Temp/daiku/daiku-ask/sess-1.json': '{"ask":{"total":4,"next":9}}' });
  check('a state opening past the end is no open ask', readAsk(past, path) === null);
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
    writeAsk(broken, 'C:/x.json', { total: 2, next: 1 });
    clearAsk(broken, 'C:/x.json');
    readAsk(broken, 'C:/x.json');
    statePath({ session_id: 's' }, broken);
  } catch (error) {
    survived = false;
  }
  check('a broken filesystem never throws', survived);
  check('a broken filesystem says nothing', readAsk(broken, 'C:/x.json') === null);

  // --- the gate, read from the project ------------------------------------------------
  check('a project without Daiku is not spoken to', CTX_ABSENT().present === false);
  check('a project with Daiku carries its seats', CTX().present === true);

  process.stdout.write(JSON.stringify({ checks: ran, passed: ran - failed.length, failed }, null, 2) + '\n');
  return failed.length ? 1 : 0;
}

// --- main ---------------------------------------------------------------------------------

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

/** The refusal. This hook denies two gestures and nothing else. */
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
}

async function main() {
  const event = await readEvent();
  if (!event) return;
  const root = projectRoot({ cwd: event.cwd || process.cwd() });
  const ctx = loadContext(root, REAL_READS);
  if (!ctx.present) return; // the gate of §6: a project that never opened Daiku is not spoken to

  const path = statePath(event, REAL_ENV);
  const marked = isMarked(REAL_ENV, markPath(event, REAL_ENV));

  // The prompt is where the folder is named: a run opened on one already there is a resume, and its
  // list opens where the document left it. The resume is recomputed only on a prompt that opens a
  // run, so a later run on a description clears a mark that no longer holds; any other message of
  // the owner closes the ask and leaves the resume where it was. On an opening prompt the state is
  // written even when the mark is not read yet, so the two hooks of `UserPromptSubmit` need no
  // order between them — the gate of `ctx.present` already decides whether this project is spoken to.
  if (event.hook_event_name === 'UserPromptSubmit') {
    const opens = typeof event.prompt === 'string' && OPENERS.test(event.prompt);
    const resume = opens ? namesAFolder(event.prompt, ctx, root, REAL_ENV) : readState(REAL_ENV, path).resume;
    if (opens || marked) writeState(REAL_ENV, path, { ask: null, resume });
    return;
  }
  if (!marked) return; // outside a run there is no list to keep whole

  const state = readState(REAL_ENV, path);

  if (event.hook_event_name === 'PreToolUse') {
    const verdict = askVerdict(event, true, state.ask, state.resume);
    if (verdict) deny(verdict);
    return;
  }

  if (event.hook_event_name === 'PostToolUse' && event.tool_name === 'AskUserQuestion') {
    const left = settled(questionsOf(event.tool_input));
    if (left === false) return; // not an ask of a list: the state stays where it was
    writeState(REAL_ENV, path, { ask: left, resume: state.resume });
  }
}

if (invokedDirectly(import.meta.url)) {
  if (process.argv.includes('--self-check')) {
    process.exit(selfCheck());
  }
  main().catch(() => process.exit(0));
}
