#!/usr/bin/env node
/**
 * Daiku's deterministic evaluator.
 *
 * It is **not a hook**. No `hooks.json` names it and no hook launches it: a hook
 * starts by itself on every repository and must stay silent, while this one starts
 * on invocation and its verdict binds. So the rule here is the opposite of the
 * guards — **it fails loudly**. A missing or malformed input is an error, never an
 * implicit `false`, and there is no fallback `process.exit(0)` anywhere below.
 *
 * It does three things and nothing else: it starts no process, it talks to no model
 * and, **in verdict mode, it opens no file** — everything it needs to know about the
 * disk the agent passes it, because the agent already holds it. The price is
 * declared: a wrong list gives a wrong verdict. It is accepted because a list passed
 * in the clear *ends up in the outcome* and can be inspected, while a `stat` made
 * inside a process leaves no trace.
 *
 * Two modes, one shape of invocation:
 *
 *   node <package-root>/architect/architect.mjs <package-root>
 *       reads one JSON object on stdin, writes one JSON object on stdout, exits 0.
 *
 *   node <package-root>/architect/architect.mjs --self-check <package-root>
 *       the bench. Counted JSON `{checks, passed, failed[]}` on stdout, exit 1 on the
 *       first red. `hooks/self-check.mjs` launches it, so the release verification
 *       stays a single command.
 *
 * **The root always arrives as an argument**, in both modes, and is never derived
 * from this file's position on disk: a program that deduces its own root is correct
 * until the first move of the tree and wrong in silence. Verdict mode does not read the root;
 * it requires it all the same, because a single invocation form is one thing to get
 * wrong once. It is the bench that uses it, to read the contracts it compares itself
 * against.
 *
 * The prose of what it answers and the block it returns live in the skill hosting it —
 * `skills/develop-feature/SKILL.md § The evaluator` — because the evaluator has no
 * `SKILL.md` of its own to declare them in. The fields it deliberately ignores, instead,
 * are declared just below: that declaration belongs to whoever consumes the block, and
 * there is no other consumer.
 * The machine-readable form of the block is `schemas/blocks.json` § *architect*; on
 * divergence the prose of the node holds, as the `$comment` of that file and §4 of
 * `contracts/orchestration.md` both say.
 *
 * **Fields of the blocks it consumes that it deliberately does not read**, declared as
 * §4 point 2 of `contracts/orchestration.md` requires, each standing on the road of
 * none of the six questions: `rounds` as a count (the rounds themselves live in the
 * ledger, and the ledger is what this program reads), `disciplines_round_1`,
 * `independence`, `applied`, `severe`, `on_previous_fix`, `discarded`, `coverage` **of
 * the review block** (the ledger's is read, by the resumption and the readable-ledger
 * condition), `ledger` **of the review block** (the one handed over beside it is read,
 * by the `order`, the closing and the resumption), `blocking` **as the block's own count**
 * (of each item it is read, by the blocking condition), `commit_sha` (the resumption reads
 * `commit` alone, to know whether the cycle had closed), `report`. Not reading a field is
 * also why a missing one among these changes no verdict.
 *
 * **A case the bench does not cover is a delivery that stops**, not a wrong verdict:
 * the verdict binds, and the bench is the only defence. That is the reason the bench
 * below counts one proof for every row of every table the six questions copy, every
 * entry point, every case of the ambiguity rule, and every row of the topology table.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* ------------------------------------------------------------------------- *
 * The order this program owns; the table of §3 is its reflection
 * ------------------------------------------------------------------------- */

/**
 * `contracts/orchestration.md` §3, node by node and in the shape the table names
 * them: the node and **who invokes it**. `owner` stands for the human, and is the
 * only caller that is not a node.
 *
 * This constant is the seat of the order: the table of §3 *shows* the graph to whoever
 * reads a contract, but does not declare it — §3 calls itself its reflection. The bench refuses a divergence in either direction — a node
 * the script does not carry, a row with no node, a caller on one side and not on the
 * other.
 */
const GRAPH = {
  init: ['owner'],
  'sync-host': ['owner'],
  'new-feature': ['owner'],
  'decision-doc': ['new-feature'],
  research: ['owner', 'new-feature'],
  study: ['research'],
  blueprint: ['develop-feature'],
  execute: ['develop-feature'],
  'develop-feature': ['new-feature'],
  review: ['owner', 'develop-feature'],
  'finder-prompt': ['review'],
  'code-review': ['owner', 'review'],
  'arch-check': ['review'],
  perf: ['review'],
  'test-coverage': ['review'],
  applier: ['review'],
  commit: ['owner', 'review'],
  'update-memory': ['develop-feature', 'commit'],
};

/**
 * The chain, in order, each phase with the contract that declares it and the artefact
 * on disk that proves it was done. The names are taken from the contracts, never
 * invented: `problem` and `decisions` from `skills/new-feature/SKILL.md` § *The
 * sequence*, everything else from `skills/develop-feature/SKILL.md` § *The sequence*.
 *
 * A phase with no artefact is one nothing on disk proves: it is not pruned by
 * `present`, and the chain is cut at the furthest **proven** phase rather than at the
 * last one named.
 */
const PHASES = [
  { name: 'problem', cites: { file: 'skills/new-feature/SKILL.md', section: '3. First draft of `0. problem.md`' }, artifact: '0. problem.md' },
  { name: 'decisions', cites: { file: 'skills/new-feature/SKILL.md', section: '6. The study of decisions' }, artifact: '1. decision-doc.md' },
  { name: 'acquisition', cites: { file: 'skills/develop-feature/SKILL.md', section: '0. Acquisition' }, artifact: null },
  { name: 'brief', cites: { file: 'skills/develop-feature/SKILL.md', section: '1. Brief' }, artifact: '2. blueprint.md' },
  { name: 'execute', cites: { file: 'skills/develop-feature/SKILL.md', section: '2. Execute' }, artifact: '4. review-notes.md' },
  { name: 'review', cites: { file: 'skills/develop-feature/SKILL.md', section: '3. Review' }, artifact: '5. review-report.md' },
  { name: 'decision', cites: { file: 'skills/develop-feature/SKILL.md', section: '4. Decision' }, artifact: null },
  { name: 'memory', cites: { file: 'skills/develop-feature/SKILL.md', section: '5. Memory' }, artifact: '3. memory-report.md' },
  { name: 'commit', cites: { file: 'skills/develop-feature/SKILL.md', section: '6. Commit' }, artifact: null },
  { name: 'merge', cites: { file: 'skills/develop-feature/SKILL.md', section: '6b. Merge' }, artifact: null },
  { name: 'cleanup', cites: { file: 'skills/develop-feature/SKILL.md', section: '6c. Cleanup' }, artifact: null },
  { name: 'report', cites: { file: 'skills/develop-feature/SKILL.md', section: '7. Report' }, artifact: null },
];

/**
 * The phases of the cycle `review` declares, in order: `skills/review/SKILL.md`
 * § *Scope*, § *Finder*, § *Applier*, § *Coverage*, § *Gate*, § *Closing*. An entry
 * from the review runs these on the scope it was given, and stops there: the delivery
 * around it belongs to whoever invoked it.
 */
const REVIEW_PHASES = [
  { name: 'scope', cites: { file: 'skills/review/SKILL.md', section: 'Scope' } },
  { name: 'finder', cites: { file: 'skills/review/SKILL.md', section: 'Finder' } },
  { name: 'applier', cites: { file: 'skills/review/SKILL.md', section: 'Applier' } },
  { name: 'coverage', cites: { file: 'skills/review/SKILL.md', section: 'Coverage' } },
  { name: 'gate', cites: { file: 'skills/review/SKILL.md', section: 'Gate' } },
  { name: 'closing', cites: { file: 'skills/review/SKILL.md', section: 'Closing' } },
];

/**
 * The four entry points `1. decision-doc.md` § *Il disegno* declares, plus the one it
 * excludes. `startsAt` is where in the chain the entry begins; `requires` are the
 * artefacts the entry declares already resolved — and the entry point that declares
 * one and does not find it is an incoherence, not a reading to pick.
 */
const ENTRIES = {
  'new-feature': { startsAt: 'problem', requires: [] },
  'decision-doc': { startsAt: 'decisions', requires: ['0. problem.md'] },
  'develop-feature': { startsAt: 'acquisition', requires: ['1. decision-doc.md'] },
  review: { startsAt: null, review: true, requires: [] },
};

/**
 * `study` launched alone is atomic: it reorders its notes and stops, it opens no
 * chain and calls the evaluator on none — so as an `entry` it is not an error, it is
 * a stop with a reason.
 */
const ATOMIC = {
  study: 'study launched alone is atomic: it reorders its notes and stops, it opens no chain and calls the evaluator on none. There is no sequence to order, so the chain stops here.',
};

/** Artefacts that exclude each other: a folder cannot be both before and after delivery. */
const MUTUALLY_EXCLUSIVE = ['1. decision-doc.md', '5. review-report.md'];

/** The verdict domains, taken verbatim from the contracts that already use them. */
const GATES = ['green', 'red'];
const EXITS = ['fixed-point', 'diminishing-returns', 'oscillation', 'rounds-truncated', 'rounds-exhausted'];
const DECISIONS = ['GREEN_COMMITTED', 'GREEN_WITH_POST_DECISIONS', 'BLOCKED_NO_COMMIT'];

/* ------------------------------------------------------------------------- *
 * Input validation — it fails loudly, never an implicit false
 * ------------------------------------------------------------------------- */

class BadInput extends Error {}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function presentOf(input) {
  const present = input.present;
  if (!Array.isArray(present) || present.some((p) => typeof p !== 'string')) {
    throw new BadInput('present is required and must be an array of file names');
  }
  return present;
}

function entryOf(input) {
  const name = input.entry;
  if (typeof name !== 'string') throw new BadInput('entry is required and must be a string');
  if (Object.prototype.hasOwnProperty.call(ATOMIC, name)) return { atomic: ATOMIC[name] };
  const entry = ENTRIES[name];
  if (!entry) {
    throw new BadInput(
      `unknown entry ${JSON.stringify(name)} — it is one of ${[...Object.keys(ENTRIES), ...Object.keys(ATOMIC)].join(', ')}`
    );
  }
  return entry;
}

/**
 * The `review_outcome` block, validated field by field. The field names are those the
 * block already declares and none of them is renamed here: `gate`, `gate_detail`,
 * `outcome`, `missing_disciplines`, `to_confirm`, `oscillation`.
 */
function reviewOutcomeOf(input, required) {
  const out = input.review_outcome;
  if (!out || typeof out !== 'object' || Array.isArray(out)) {
    throw new BadInput('review_outcome is required: the block the review declared, in full');
  }
  for (const key of required) {
    if (out[key] === undefined || out[key] === null) {
      throw new BadInput(`review_outcome.${key} is required and it is absent or null`);
    }
  }
  if (!GATES.includes(out.gate)) {
    throw new BadInput(`review_outcome.gate must be one of ${GATES.join('|')}, got ${JSON.stringify(out.gate)}`);
  }
  if (!EXITS.includes(out.outcome)) {
    throw new BadInput(`review_outcome.outcome must be one of ${EXITS.join('|')}, got ${JSON.stringify(out.outcome)}`);
  }
  if (!Array.isArray(out.missing_disciplines)) {
    throw new BadInput('review_outcome.missing_disciplines must be an array');
  }
  if (!Array.isArray(out.to_confirm)) {
    throw new BadInput('review_outcome.to_confirm must be an array');
  }
  return out;
}

function blockingItems(out) {
  return (out.to_confirm || []).filter((item) => item && item.blocking === true);
}

/* ------------------------------------------------------------------------- *
 * The answer block
 * ------------------------------------------------------------------------- */

/** Every answer carries all nine fields; what a question does not use is `null` or empty. */
function block(fields) {
  return {
    ok: true,
    verdict: null,
    remaining: [],
    resume_from: null,
    blockers: [],
    retry: null,
    fallback: null,
    readings: [],
    detail: '',
    ...fields,
  };
}

/* ------------------------------------------------------------------------- *
 * The ambiguity rule — an incoherence stops, a legitimate fork asks the owner
 * ------------------------------------------------------------------------- */

function reading(branch, remaining, why) {
  return { branch, remaining, why };
}

/**
 * The two cases the rule separates, in the order that keeps them apart: an incoherence
 * is a contradiction and never a choice, so it is looked for first, and only what
 * survives it can be a legitimate fork. No path here guesses a reading.
 */
function incoherence(input, question) {
  const present = presentOf(input);
  if (MUTUALLY_EXCLUSIVE.every((artifact) => present.includes(artifact))) {
    return block({
      verdict: 'stop',
      detail:
        `input and the artefacts present disagree: ${MUTUALLY_EXCLUSIVE.join(' and ')} stand together in the ` +
        'same folder, and they exclude each other — the work cannot be both before the delivery and after it. ' +
        'No reading is guessed: the chain stops.',
    });
  }
  const entry = ENTRIES[input.entry];
  if (entry) {
    const missing = (entry.requires || []).filter((artifact) => !present.includes(artifact));
    if (missing.length) {
      return block({
        verdict: 'stop',
        detail:
          `input and the artefacts present disagree: entry "${input.entry}" declares ${missing.join(', ')} ` +
          'already resolved — the phases before it were done separately — and that artefact is not there. ' +
          'The entry declares a phase and the proof of it is missing: the chain stops.',
      });
    }
  }
  // The fork is about the delivery chain — reopen the review or redo the delivery from its
  // first phase — and entry `review` opens the cycle on a scope instead: there are no
  // delivery phases to weigh, and the answer is `restart` when no ledger was handed over.
  if (
    input.entry !== 'review' &&
    present.includes('4. review-notes.md') &&
    !present.includes('2. blueprint.md') &&
    !input.ledger
  ) {
    return block({
      verdict: 'stop',
      readings: [
        reading(
          'resume-from-review',
          ['review', 'decision', 'memory', 'commit', 'merge', 'cleanup', 'report'],
          '4. review-notes.md declares its own baseline, so the review can be reopened from it and the phases after it follow.'
        ),
        reading(
          'restart-from-brief',
          ['acquisition', 'brief', 'execute', 'review', 'decision', 'memory', 'commit', 'merge', 'cleanup', 'report'],
          'with 2. blueprint.md absent and no ledger on disk, nothing proves the brief was ever written, and the delivery can be redone from its first phase.'
        ),
      ],
      detail:
        'two readings and both are defensible: the artefacts present admit resuming from the review or redoing the ' +
        'delivery from its first phase. The choice is the owner\'s, in conversation — the program does not guess it.',
    });
  }
  return null;
}

/* ------------------------------------------------------------------------- *
 * The six questions
 * ------------------------------------------------------------------------- */

/** Where in the chain the entry starts, cut at the furthest phase the artefacts prove. */
function furthestProven(input) {
  const present = presentOf(input);
  let last = -1;
  PHASES.forEach((phase, index) => {
    if (phase.artifact && present.includes(phase.artifact)) last = Math.max(last, index);
  });
  return last;
}

/** 6. The order — `skills/develop-feature/SKILL.md` § *The sequence*. */
function askOrder(input) {
  const entry = entryOf(input);
  if (entry.atomic) return block({ verdict: 'stop', detail: entry.atomic });
  const contradiction = incoherence(input, 'order');
  if (contradiction) return contradiction;
  if (entry.review) {
    return block({
      verdict: 'proceed',
      remaining: REVIEW_PHASES.map((phase) => phase.name),
      detail:
        `entry "review" runs the cycle on the scope it was given: ${REVIEW_PHASES.length} phases remain, from ` +
        '"scope" to "closing".',
    });
  }
  const chain = PHASES.map((phase) => phase.name);
  const from = chain.indexOf(entry.startsAt);
  const proven = furthestProven(input);
  const remaining = chain.slice(Math.max(from, proven + 1));
  return block({
    verdict: 'proceed',
    remaining,
    detail:
      `entry "${input.entry}" starts at "${entry.startsAt}", and the artefacts present prove the chain up to ` +
      `"${proven < 0 ? 'nothing' : chain[proven]}": ${remaining.length} phases remain.`,
  });
}

/** 1. The final decision — `skills/develop-feature/SKILL.md` § *4. Decision*, its six rows. */
function askDecision(input) {
  const out = reviewOutcomeOf(input, ['gate', 'outcome', 'missing_disciplines', 'to_confirm']);
  const blockers = [];
  if (out.gate !== 'green') blockers.push(`gate red: ${out.gate_detail === undefined || out.gate_detail === null ? 'no detail declared' : out.gate_detail}`);
  if (out.outcome === 'oscillation' || out.outcome === 'rounds-exhausted') {
    blockers.push(`the cycle did not converge, it exited by ${out.outcome}`);
  }
  if (out.missing_disciplines.length) {
    blockers.push(`disciplines that did not run on this diff: ${out.missing_disciplines.join(', ')}`);
  }
  const blocking = blockingItems(out);
  if (blocking.length) {
    blockers.push(
      `blocking items: ${blocking
        .map((item) => (item.file ? `${item.file}${item.line ? `:${item.line}` : ''} [${item.class || '?'}]` : 'an item with no file'))
        .join('; ')}`
    );
  }
  // Every blocking condition is evaluated: the first occurring does not close the
  // evaluation, and an outcome satisfying more than one reports them all.
  let verdict;
  if (blockers.length) verdict = 'BLOCKED_NO_COMMIT';
  else if (out.to_confirm.length) verdict = 'GREEN_WITH_POST_DECISIONS';
  else verdict = 'GREEN_COMMITTED';
  return block({
    verdict,
    blockers,
    detail:
      verdict === 'BLOCKED_NO_COMMIT'
        ? 'BLOCKED_NO_COMMIT: the delivery stops there — nothing is staged, memory is not aligned, nothing is committed, and the worktree stays dirty on purpose.'
        : verdict === 'GREEN_WITH_POST_DECISIONS'
          ? 'GREEN_WITH_POST_DECISIONS: the commit runs, and the non-blocking items stay in the report as post-commit decisions.'
          : 'GREEN_COMMITTED: green gate and no open item — the normal outcome of a healthy delivery.',
  });
}

/** 2. The closing of the cycle — `skills/review/SKILL.md` § *Closing*, its six conditions. */
function readableLedger(ledger) {
  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) return false;
  if (!nonEmpty(ledger.base) || !nonEmpty(ledger.item)) return false;
  if (!Array.isArray(ledger.rounds)) return false;
  if (!ledger.rounds.every((round) => round && Array.isArray(round.missing_disciplines))) return false;
  return ['outcome', 'coverage', 'gate', 'gate_detail'].every((key) => ledger[key] !== undefined && ledger[key] !== null);
}

function askClosing(input) {
  const out = reviewOutcomeOf(input, ['gate', 'outcome', 'missing_disciplines', 'to_confirm', 'oscillation']);
  const conditions = [
    ['to_confirm items with blocking: true', blockingItems(out).length === 0],
    ['a detected oscillation', (out.oscillation || 0) === 0],
    ['an exit by rounds-exhausted', out.outcome !== 'rounds-exhausted'],
    ['missing disciplines', out.missing_disciplines.length === 0],
    ['a green gate', out.gate === 'green'],
    ['a ledger the commit can read', readableLedger(input.ledger)],
  ];
  const blockers = conditions.filter(([, holds]) => !holds).map(([name]) => name);
  return block({
    verdict: blockers.length ? 'stop' : 'commit',
    blockers,
    detail: blockers.length
      ? `the commit does not run: ${blockers.join(', ')}.`
      : 'all six conditions hold: the commit runs and closes the cycle.',
  });
}

/** 3. The mechanical unblock — `skills/develop-feature/SKILL.md` § *Mechanical unblock*. */
function askUnblock(input) {
  const out = reviewOutcomeOf(input, ['gate', 'outcome', 'missing_disciplines', 'to_confirm']);
  const holds = [];
  if (out.gate === 'green') holds.push('the gate is not red, so the block is not the first row of the table');
  if (out.outcome !== 'fixed-point') holds.push(`the cycle did not exit at a fixed point, it exited by ${out.outcome}`);
  if (out.missing_disciplines.length) holds.push(`disciplines that did not run on this diff: ${out.missing_disciplines.join(', ')}`);
  if (blockingItems(out).length) holds.push('a blocking item remains');
  else if (out.to_confirm.length) holds.push('items to confirm remain, so the block is wider than the gate');
  return block({
    verdict: holds.length ? 'blocked' : 'unblock',
    blockers: holds,
    detail: holds.length
      ? `the block is not only the first row of the table: ${holds.join('; ')}. It is declared, not reopened.`
      : 'the only blocker is the red gate and the cycle already said everything it knew how to say: one worker corrects the gate findings on the diff lines with a single obvious fix, relaunches the gate of the touched area, and the classification is redone. A single attempt per delivery.',
  });
}

/** 4. The propagation of a failure — `contracts/orchestration.md` §4, validation clause. */
function cameBack(blockValue) {
  return !!blockValue && typeof blockValue === 'object' && !Array.isArray(blockValue) && Object.keys(blockValue).length > 0;
}

function askPropagation(input) {
  const step = input.step;
  if (!step || typeof step !== 'object' || Array.isArray(step)) {
    throw new BadInput('step is required: {"node": <name>, "block": <block>|null, "attempt": 1|2}');
  }
  if (!nonEmpty(step.node)) throw new BadInput('step.node is required and must be a non-empty string');
  if (step.attempt !== 1 && step.attempt !== 2) {
    throw new BadInput(`step.attempt must be 1 or 2 (the ceiling is one relaunch), got ${JSON.stringify(step.attempt)}`);
  }
  if (cameBack(step.block)) {
    return block({
      verdict: null,
      detail: `${step.node} returned its block: nothing failed, so there is no failure to propagate.`,
    });
  }
  const how = step.block === null || step.block === undefined ? 'it did not come back at all' : 'what came back is not its block';
  if (step.attempt === 1) {
    return block({
      verdict: 'retry',
      retry: true,
      detail: `${step.node} failed — ${how} — and this is the first attempt: the step is relaunched exactly once, with the identical prompt.`,
    });
  }
  return block({
    verdict: 'fallback',
    fallback: true,
    detail: `${step.node} failed on the second attempt too — ${how} — and the ceiling is reached: what follows is the outcome the skill hosting that step declares for this case, and this program does not choose it in its place.`,
  });
}

/** 5. The resumption — `skills/review/SKILL.md` § *Baseline and ledger*, and the ledger's tail. */
function resumeFrom(ledger, outcome) {
  const rounds = Array.isArray(ledger.rounds) ? ledger.rounds : [];
  if (!rounds.length) return 'scope';
  const last = rounds[rounds.length - 1] || {};
  if (last.verdict !== 'stop') return 'finder';
  if (ledger.coverage === undefined || ledger.coverage === null) return 'coverage';
  if (ledger.gate === undefined || ledger.gate === null) return 'gate';
  if (outcome && outcome.commit === 'done') return 'decision';
  return 'closing';
}

function askResumption(input) {
  const entry = entryOf(input);
  if (entry.atomic) return block({ verdict: 'stop', detail: entry.atomic });
  const contradiction = incoherence(input, 'resumption');
  if (contradiction) return contradiction;
  const ledger = input.ledger;
  if (ledger === null || ledger === undefined) {
    return block({
      verdict: 'restart',
      detail: 'no ledger was handed over: the triage is run again and a new ledger is opened.',
    });
  }
  if (typeof ledger !== 'object' || Array.isArray(ledger)) {
    return block({
      verdict: 'restart',
      detail:
        `the ledger handed over is not a ledger (${typeof ledger}): a string that is not the expected block is a ` +
        'block that did not come back. A new ledger is opened — opening one costs a triage, taking the wrong one ' +
        'switches off both signals the cycle decides on.',
    });
  }
  if (!nonEmpty(ledger.base) || !nonEmpty(ledger.item)) {
    return block({
      verdict: 'restart',
      detail:
        `the ledger identifies no review: base is ${JSON.stringify(ledger.base === undefined ? null : ledger.base)} and ` +
        `item is ${JSON.stringify(ledger.item === undefined ? null : ledger.item)}. The two are watched together — a ` +
        'resumed delivery restarts from the same commit, so the baseline alone does not say whose ledger this is. A new ledger is opened.',
    });
  }
  const from = resumeFrom(ledger, input.review_outcome);
  return block({
    verdict: 'resume',
    resume_from: from,
    detail:
      `the ledger identifies this work — base ${ledger.base}, item ${ledger.item} — so this is the same interrupted ` +
      `review: it restarts at "${from}", and what the ledger already declares done is not redone.`,
  });
}

const ASKS = {
  decision: askDecision,
  closing: askClosing,
  unblock: askUnblock,
  propagation: askPropagation,
  resumption: askResumption,
  order: askOrder,
};

/* ------------------------------------------------------------------------- *
 * The bench
 * ------------------------------------------------------------------------- */

function readLines(root, rel) {
  return readFileSync(join(root, rel), 'utf-8').split(/\r?\n/);
}

/** The rows of the §3 table: the first backticked token of the cell is the node. */
function tableRows(lines) {
  const rows = [];
  let inTable = false;
  for (const line of lines) {
    if (/^\|\s*Node\s*\|/.test(line)) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (!line.startsWith('|')) break;
    if (/^\|[\s:\-|]+\|$/.test(line)) continue;
    const cells = line.split('|');
    if (cells.length < 4) continue;
    const tokens = [...cells[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    if (!tokens.length) continue;
    rows.push({ node: tokens[0], callers: cells[2] });
  }
  return rows;
}

/**
 * The callers of a row: the backticked tokens that are nodes, plus `owner`, never the
 * prose of the cell. Two exclusions, both facts of the graph rather than conveniences
 * of the reading: the row's **own** node never counts — no node invokes itself, and the
 * cell "`review` as `perf` finder" names `perf` as the discipline, not as a second
 * caller — and neither does a token that is not a node, as `arch` and `bug` in the
 * neighbouring rows.
 */
function callersOf(cell, nodeNames, selfNode) {
  const names = [...cell.matchAll(/`([^`]+)`/g)]
    .map((m) => m[1])
    .filter((token) => nodeNames.has(token) && token !== selfNode);
  if (/(^|[^a-z-])owner([^a-z-]|$)/.test(cell)) names.push('owner');
  return [...new Set(names)].sort();
}

function norm(value) {
  return value
    .toLowerCase()
    .replace(/[*`"']/g, '')
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

const headingCache = {};
function headings(root, rel) {
  if (!headingCache[rel]) {
    try {
      headingCache[rel] = readLines(root, rel)
        .filter((line) => /^#{1,4}\s/.test(line))
        .map((line) => norm(line.replace(/^#{1,4}\s*/, '')));
    } catch {
      headingCache[rel] = null;
    }
  }
  return headingCache[rel];
}

function cites(root, citation) {
  const heads = headings(root, citation.file);
  if (!heads) return false;
  const want = norm(citation.section);
  return heads.some((heading) => heading === want || heading.startsWith(want));
}

function matches(got, expect) {
  return Object.entries(expect).every(([key, value]) => {
    if (key === 'blockers_include') return (got.blockers || []).some((b) => String(b).includes(value));
    if (key === 'blockers_length_at_least') return (got.blockers || []).length >= value;
    if (key === 'remaining_starts_with') return (got.remaining || [])[0] === value;
    if (key === 'readings_length') return (got.readings || []).length === value;
    return JSON.stringify(got[key]) === JSON.stringify(value);
  });
}

const GREEN = (extra = {}) => ({
  gate: 'green',
  gate_detail: 'ok',
  outcome: 'fixed-point',
  missing_disciplines: [],
  to_confirm: [],
  ...extra,
});

/**
 * Every case: the answer asked, the input, what the contract says must come back, and
 * **where that rule is written** — the citation is verified against the file, so a
 * proof cannot cite a section that does not exist.
 */
const CASES = [
  /* --- question: decision — skills/develop-feature/SKILL.md § 4. Decision --- */
  { id: 'decision:row-1-gate-red', cites: { file: 'skills/develop-feature/SKILL.md', section: '4. Decision' },
    input: { question: 'decision', review_outcome: GREEN({ gate: 'red', gate_detail: 'tsc: 2 errors' }) },
    expect: { verdict: 'BLOCKED_NO_COMMIT', blockers_include: 'gate red: tsc: 2 errors' } },
  { id: 'decision:row-2-oscillation', cites: { file: 'skills/develop-feature/SKILL.md', section: '4. Decision' },
    input: { question: 'decision', review_outcome: GREEN({ outcome: 'oscillation' }) },
    expect: { verdict: 'BLOCKED_NO_COMMIT', blockers_include: 'oscillation' } },
  { id: 'decision:row-2-rounds-exhausted', cites: { file: 'skills/develop-feature/SKILL.md', section: '4. Decision' },
    input: { question: 'decision', review_outcome: GREEN({ outcome: 'rounds-exhausted' }) },
    expect: { verdict: 'BLOCKED_NO_COMMIT', blockers_include: 'rounds-exhausted' } },
  { id: 'decision:row-3-missing-disciplines', cites: { file: 'skills/develop-feature/SKILL.md', section: '4. Decision' },
    input: { question: 'decision', review_outcome: GREEN({ missing_disciplines: ['arch'] }) },
    expect: { verdict: 'BLOCKED_NO_COMMIT', blockers_include: 'arch' } },
  { id: 'decision:row-4-blocking-item', cites: { file: 'skills/develop-feature/SKILL.md', section: '4. Decision' },
    input: { question: 'decision', review_outcome: GREEN({ to_confirm: [{ file: 'a.mjs', line: 12, class: 'bug', blocking: true, scenario: 'x' }] }) },
    expect: { verdict: 'BLOCKED_NO_COMMIT', blockers_include: 'a.mjs:12' } },
  { id: 'decision:row-5-post-decisions', cites: { file: 'skills/develop-feature/SKILL.md', section: '4. Decision' },
    input: { question: 'decision', review_outcome: GREEN({ to_confirm: [{ file: 'a.mjs', class: 'arch', blocking: false, scenario: 'x' }] }) },
    expect: { verdict: 'GREEN_WITH_POST_DECISIONS' } },
  { id: 'decision:row-6-green', cites: { file: 'skills/develop-feature/SKILL.md', section: '4. Decision' },
    input: { question: 'decision', review_outcome: GREEN() },
    expect: { verdict: 'GREEN_COMMITTED', blockers: [] } },
  { id: 'decision:every-blocking-condition', cites: { file: 'skills/develop-feature/SKILL.md', section: '4. Decision' },
    input: { question: 'decision', review_outcome: GREEN({ gate: 'red', outcome: 'oscillation', missing_disciplines: ['perf'], to_confirm: [{ file: 'a.mjs', class: 'bug', blocking: true, scenario: 'x' }] }) },
    expect: { verdict: 'BLOCKED_NO_COMMIT', blockers_length_at_least: 4 } },

  /* --- question: closing — skills/review/SKILL.md § Closing, the six conditions --- */
  { id: 'closing:all-six-hold', cites: { file: 'skills/review/SKILL.md', section: 'Closing' },
    input: { question: 'closing', review_outcome: GREEN({ oscillation: 0 }), ledger: { base: 'abc1234', item: 'x/y', rounds: [], outcome: 'fixed-point', coverage: 'no-tests-needed', gate: 'green', gate_detail: 'ok' } },
    expect: { verdict: 'commit', blockers: [] } },
  { id: 'closing:condition-blocking-item', cites: { file: 'skills/review/SKILL.md', section: 'Closing' },
    input: { question: 'closing', review_outcome: GREEN({ oscillation: 0, to_confirm: [{ file: 'a.mjs', blocking: true, scenario: 'x' }] }), ledger: { base: 'abc1234', item: 'x/y', rounds: [], outcome: 'fixed-point', coverage: 'no-tests-needed', gate: 'green', gate_detail: 'ok' } },
    expect: { verdict: 'stop', blockers_include: 'blocking' } },
  { id: 'closing:condition-oscillation', cites: { file: 'skills/review/SKILL.md', section: 'Closing' },
    input: { question: 'closing', review_outcome: GREEN({ oscillation: 1 }), ledger: { base: 'abc1234', item: 'x/y', rounds: [], outcome: 'fixed-point', coverage: 'no-tests-needed', gate: 'green', gate_detail: 'ok' } },
    expect: { verdict: 'stop', blockers_include: 'oscillation' } },
  { id: 'closing:condition-rounds-exhausted', cites: { file: 'skills/review/SKILL.md', section: 'Closing' },
    input: { question: 'closing', review_outcome: GREEN({ oscillation: 0, outcome: 'rounds-exhausted' }), ledger: { base: 'abc1234', item: 'x/y', rounds: [], outcome: 'rounds-exhausted', coverage: 'no-tests-needed', gate: 'green', gate_detail: 'ok' } },
    expect: { verdict: 'stop', blockers_include: 'rounds-exhausted' } },
  { id: 'closing:condition-missing-disciplines', cites: { file: 'skills/review/SKILL.md', section: 'Closing' },
    input: { question: 'closing', review_outcome: GREEN({ oscillation: 0, missing_disciplines: ['arch'] }), ledger: { base: 'abc1234', item: 'x/y', rounds: [], outcome: 'fixed-point', coverage: 'no-tests-needed', gate: 'green', gate_detail: 'ok' } },
    expect: { verdict: 'stop', blockers_include: 'missing disciplines' } },
  { id: 'closing:condition-gate-red', cites: { file: 'skills/review/SKILL.md', section: 'Closing' },
    input: { question: 'closing', review_outcome: GREEN({ oscillation: 0, gate: 'red', gate_detail: 'x' }), ledger: { base: 'abc1234', item: 'x/y', rounds: [], outcome: 'fixed-point', coverage: 'no-tests-needed', gate: 'red', gate_detail: 'x' } },
    expect: { verdict: 'stop', blockers_include: 'green gate' } },
  { id: 'closing:condition-unreadable-ledger', cites: { file: 'skills/review/SKILL.md', section: 'Closing' },
    input: { question: 'closing', review_outcome: GREEN({ oscillation: 0 }), ledger: null },
    expect: { verdict: 'stop', blockers_include: 'ledger' } },
  { id: 'closing:condition-ledger-without-item', cites: { file: 'skills/review/SKILL.md', section: 'Closing' },
    input: { question: 'closing', review_outcome: GREEN({ oscillation: 0 }), ledger: { base: 'abc1234', item: null, rounds: [], outcome: 'fixed-point', gate: 'green', gate_detail: 'ok' } },
    expect: { verdict: 'stop', blockers_include: 'ledger' } },
  { id: 'closing:condition-ledger-without-coverage', cites: { file: 'skills/review/SKILL.md', section: 'Closing' },
    input: { question: 'closing', review_outcome: GREEN({ oscillation: 0 }), ledger: { base: 'abc1234', item: 'x/y', rounds: [], outcome: 'fixed-point', coverage: null, gate: 'green', gate_detail: 'ok' } },
    expect: { verdict: 'stop', blockers_include: 'ledger' } },
  { id: 'closing:condition-ledger-with-a-round-without-missing-disciplines', cites: { file: 'skills/review/SKILL.md', section: 'Closing' },
    input: { question: 'closing', review_outcome: GREEN({ oscillation: 0 }), ledger: { base: 'abc1234', item: 'x/y', rounds: [{ n: 1, verdict: 'continue' }], outcome: 'fixed-point', coverage: 'no-tests-needed', gate: 'green', gate_detail: 'ok' } },
    expect: { verdict: 'stop', blockers_include: 'ledger' } },
  { id: 'closing:condition-rounds-truncated-does-not-block', cites: { file: 'skills/review/SKILL.md', section: 'Closing' },
    input: { question: 'closing', review_outcome: GREEN({ oscillation: 0, outcome: 'rounds-truncated' }), ledger: { base: 'abc1234', item: 'x/y', rounds: [], outcome: 'rounds-truncated', coverage: 'no-tests-needed', gate: 'green', gate_detail: 'ok' } },
    expect: { verdict: 'commit' } },

  /* --- question: unblock — skills/develop-feature/SKILL.md § Mechanical unblock --- */
  { id: 'unblock:only-the-gate', cites: { file: 'skills/develop-feature/SKILL.md', section: 'Mechanical unblock' },
    input: { question: 'unblock', review_outcome: GREEN({ gate: 'red', gate_detail: 'lint' }) },
    expect: { verdict: 'unblock', blockers: [] } },
  { id: 'unblock:blocking-item-holds', cites: { file: 'skills/develop-feature/SKILL.md', section: 'Mechanical unblock' },
    input: { question: 'unblock', review_outcome: GREEN({ gate: 'red', to_confirm: [{ file: 'a.mjs', blocking: true, scenario: 'x' }] }) },
    expect: { verdict: 'blocked' } },
  { id: 'unblock:non-blocking-item-holds', cites: { file: 'skills/develop-feature/SKILL.md', section: 'Mechanical unblock' },
    input: { question: 'unblock', review_outcome: GREEN({ gate: 'red', to_confirm: [{ file: 'a.mjs', blocking: false, scenario: 'x' }] }) },
    expect: { verdict: 'blocked' } },
  { id: 'unblock:not-a-fixed-point', cites: { file: 'skills/develop-feature/SKILL.md', section: 'Mechanical unblock' },
    input: { question: 'unblock', review_outcome: GREEN({ gate: 'red', outcome: 'diminishing-returns' }) },
    expect: { verdict: 'blocked' } },
  { id: 'unblock:missing-discipline-holds', cites: { file: 'skills/develop-feature/SKILL.md', section: 'Mechanical unblock' },
    input: { question: 'unblock', review_outcome: GREEN({ gate: 'red', missing_disciplines: ['perf'] }) },
    expect: { verdict: 'blocked' } },
  { id: 'unblock:green-gate-is-not-a-block', cites: { file: 'skills/develop-feature/SKILL.md', section: 'Mechanical unblock' },
    input: { question: 'unblock', review_outcome: GREEN() },
    expect: { verdict: 'blocked' } },

  /* --- question: propagation — contracts/orchestration.md §4, validation clause --- */
  { id: 'propagation:retry-once', cites: { file: 'contracts/orchestration.md', section: '4. Delegation' },
    input: { question: 'propagation', step: { node: 'brief', block: null, attempt: 1 } },
    expect: { verdict: 'retry', retry: true, fallback: null } },
  { id: 'propagation:malformed-counts-as-missing', cites: { file: 'contracts/orchestration.md', section: '4. Delegation' },
    input: { question: 'propagation', step: { node: 'brief', block: 'prose instead of JSON', attempt: 1 } },
    expect: { verdict: 'retry' } },
  { id: 'propagation:fallback-after-the-ceiling', cites: { file: 'contracts/orchestration.md', section: '4. Delegation' },
    input: { question: 'propagation', step: { node: 'execute', block: null, attempt: 2 } },
    expect: { verdict: 'fallback', fallback: true, retry: null } },
  { id: 'propagation:a-block-that-came-back', cites: { file: 'contracts/orchestration.md', section: '4. Delegation' },
    input: { question: 'propagation', step: { node: 'execute', block: { ok: true }, attempt: 1 } },
    expect: { verdict: null } },

  /* --- question: resumption — skills/review/SKILL.md § Baseline and ledger --- */
  { id: 'resumption:resume-mid-cycle', cites: { file: 'skills/review/SKILL.md', section: 'Baseline and ledger' },
    input: { question: 'resumption', entry: 'develop-feature', present: ['1. decision-doc.md'], ledger: { base: 'abc1234', item: 'x/y', rounds: [{ n: 1, verdict: 'continue' }], outcome: null, gate: null, gate_detail: null } },
    expect: { verdict: 'resume', resume_from: 'finder' } },
  { id: 'resumption:resume-at-the-scope', cites: { file: 'skills/review/SKILL.md', section: 'Baseline and ledger' },
    input: { question: 'resumption', entry: 'develop-feature', present: ['1. decision-doc.md'], ledger: { base: 'abc1234', item: 'x/y', rounds: [], outcome: null, gate: null, gate_detail: null } },
    expect: { verdict: 'resume', resume_from: 'scope' } },
  { id: 'resumption:resume-at-the-coverage', cites: { file: 'skills/review/SKILL.md', section: 'Baseline and ledger' },
    input: { question: 'resumption', entry: 'develop-feature', present: ['1. decision-doc.md'], ledger: { base: 'abc1234', item: 'x/y', rounds: [{ n: 2, verdict: 'stop' }], outcome: 'fixed-point', coverage: null, gate: null, gate_detail: null } },
    expect: { verdict: 'resume', resume_from: 'coverage' } },
  { id: 'resumption:resume-at-the-gate', cites: { file: 'skills/review/SKILL.md', section: 'Baseline and ledger' },
    input: { question: 'resumption', entry: 'develop-feature', present: ['1. decision-doc.md'], ledger: { base: 'abc1234', item: 'x/y', rounds: [{ n: 2, verdict: 'stop' }], outcome: 'fixed-point', coverage: 'no-tests-needed', gate: null, gate_detail: null } },
    expect: { verdict: 'resume', resume_from: 'gate' } },
  { id: 'resumption:resume-past-a-closed-cycle', cites: { file: 'skills/review/SKILL.md', section: 'Baseline and ledger' },
    input: { question: 'resumption', entry: 'develop-feature', present: ['1. decision-doc.md'], ledger: { base: 'abc1234', item: 'x/y', rounds: [{ n: 2, verdict: 'stop' }], outcome: 'fixed-point', coverage: 'no-tests-needed', gate: 'green', gate_detail: 'ok' }, review_outcome: { commit: 'done', commit_sha: 'deadbee' } },
    expect: { verdict: 'resume', resume_from: 'decision' } },
  { id: 'resumption:restart-without-ledger', cites: { file: 'skills/review/SKILL.md', section: 'Baseline and ledger' },
    input: { question: 'resumption', entry: 'develop-feature', present: ['1. decision-doc.md'], ledger: null },
    expect: { verdict: 'restart', resume_from: null } },
  { id: 'resumption:restart-on-the-review-entry', cites: { file: 'skills/review/SKILL.md', section: 'Baseline and ledger' },
    input: { question: 'resumption', entry: 'review', present: ['4. review-notes.md'], ledger: null },
    expect: { verdict: 'restart', resume_from: null } },
  { id: 'resumption:restart-without-item', cites: { file: 'skills/review/SKILL.md', section: 'Baseline and ledger' },
    input: { question: 'resumption', entry: 'develop-feature', present: ['1. decision-doc.md'], ledger: { base: 'abc1234', item: null, rounds: [] } },
    expect: { verdict: 'restart' } },

  /* --- question: order — skills/develop-feature/SKILL.md § The sequence --- */
  { id: 'order:proceed-from-the-start', cites: { file: 'skills/develop-feature/SKILL.md', section: 'The sequence' },
    input: { question: 'order', entry: 'new-feature', present: [] },
    expect: { verdict: 'proceed', remaining_starts_with: 'problem' } },
  { id: 'order:proceed-from-the-delivery', cites: { file: 'skills/develop-feature/SKILL.md', section: 'The sequence' },
    input: { question: 'order', entry: 'develop-feature', present: ['1. decision-doc.md'] },
    expect: { verdict: 'proceed', remaining_starts_with: 'acquisition' } },
  { id: 'order:proven-phases-are-cut', cites: { file: 'skills/develop-feature/SKILL.md', section: 'The sequence' },
    input: { question: 'order', entry: 'develop-feature', present: ['1. decision-doc.md', '2. blueprint.md'] },
    expect: { verdict: 'proceed', remaining_starts_with: 'execute' } },
  { id: 'order:review-entry', cites: { file: 'skills/review/SKILL.md', section: 'The cycle' },
    input: { question: 'order', entry: 'review', present: [] },
    expect: { verdict: 'proceed', remaining_starts_with: 'scope', remaining: ['scope', 'finder', 'applier', 'coverage', 'gate', 'closing'] } },
  { id: 'order:review-entry-on-a-review-notes', cites: { file: 'skills/review/SKILL.md', section: 'The cycle' },
    input: { question: 'order', entry: 'review', present: ['4. review-notes.md'] },
    expect: { verdict: 'proceed', remaining_starts_with: 'scope' } },

  /* --- the four entry points, plus the atomic one --- */
  { id: 'entry:new-feature', cites: { file: 'skills/new-feature/SKILL.md', section: 'The sequence' },
    input: { question: 'order', entry: 'new-feature', present: [] },
    expect: { verdict: 'proceed', remaining_starts_with: 'problem' } },
  { id: 'entry:decision-doc', cites: { file: 'skills/decision-doc/SKILL.md', section: 'Input: the problem folder' },
    input: { question: 'order', entry: 'decision-doc', present: ['0. problem.md'] },
    expect: { verdict: 'proceed', remaining_starts_with: 'decisions' } },
  { id: 'entry:develop-feature', cites: { file: 'skills/develop-feature/SKILL.md', section: 'Input' },
    input: { question: 'order', entry: 'develop-feature', present: ['1. decision-doc.md'] },
    expect: { verdict: 'proceed', remaining_starts_with: 'acquisition' } },
  { id: 'entry:review', cites: { file: 'skills/review/SKILL.md', section: 'Input' },
    input: { question: 'order', entry: 'review', present: [] },
    expect: { verdict: 'proceed', remaining_starts_with: 'scope' } },
  { id: 'entry:study', cites: { file: 'contracts/orchestration.md', section: '3. Invocable skills and internal contracts' },
    input: { question: 'order', entry: 'study', present: [] },
    expect: { verdict: 'stop' } },

  /* --- ambiguity: two incoherences and one legitimate fork --- */
  { id: 'ambiguity:incoherence-artifacts-exclude-each-other', cites: { file: 'skills/develop-feature/SKILL.md', section: 'Input' },
    input: { question: 'order', entry: 'new-feature', present: ['1. decision-doc.md', '5. review-report.md'] },
    expect: { verdict: 'stop', readings_length: 0 } },
  { id: 'ambiguity:incoherence-entry-declares-a-missing-artifact', cites: { file: 'skills/develop-feature/SKILL.md', section: 'Input' },
    input: { question: 'order', entry: 'develop-feature', present: [] },
    expect: { verdict: 'stop', readings_length: 0 } },
  { id: 'ambiguity:fork-both-readings-are-defensible', cites: { file: 'skills/review/SKILL.md', section: 'Baseline and ledger' },
    input: { question: 'order', entry: 'new-feature', present: ['4. review-notes.md'], ledger: null },
    expect: { verdict: 'stop', readings_length: 2 } },
];

/** The input that must be refused loudly. Nothing here is a verdict. */
const REJECTED = [
  { id: 'reject:unknown-question', input: { question: 'invented', entry: 'new-feature', present: [] } },
  { id: 'reject:unknown-entry', input: { question: 'order', entry: 'invented', present: [] } },
  { id: 'reject:present-not-a-list', input: { question: 'order', entry: 'new-feature', present: 'x' } },
  { id: 'reject:review-outcome-absent', input: { question: 'decision' } },
  { id: 'reject:gate-outside-its-domain', input: { question: 'decision', review_outcome: GREEN({ gate: 'yellow' }) } },
  { id: 'reject:outcome-outside-its-domain', input: { question: 'decision', review_outcome: GREEN({ outcome: 'converged' }) } },
  { id: 'reject:missing-disciplines-not-a-list', input: { question: 'decision', review_outcome: GREEN({ missing_disciplines: 'arch' }) } },
  { id: 'reject:step-absent', input: { question: 'propagation' } },
  { id: 'reject:attempt-outside-the-ceiling', input: { question: 'propagation', step: { node: 'brief', block: null, attempt: 3 } } },
];

function runBench(root) {
  const checks = [];
  const failed = [];
  const check = (name, ok, detail) => {
    checks.push(name);
    if (!ok) failed.push(detail ? `${name}: ${detail}` : name);
  };

  /* 1. The table of §3 and the graph of this program say the same thing, in both directions. */
  let rows = [];
  try {
    rows = tableRows(readLines(root, 'contracts/orchestration.md'));
  } catch (error) {
    check('orchestration:readable', false, error.message);
  }
  check('topology:rows-read', rows.length > 0, 'the §3 table has no row');
  if (rows.length) {
    const nodeNames = new Set(Object.keys(GRAPH));
    const rowNames = new Set(rows.map((row) => row.node));
    for (const row of rows) {
      if (!nodeNames.has(row.node)) {
        check(`topology:node:${row.node}`, false, 'a table row the script does not carry');
        continue;
      }
      const want = callersOf(row.callers, nodeNames, row.node);
      const have = [...GRAPH[row.node]].sort();
      check(`topology:node:${row.node}`, true, '');
      check(
        `topology:callers:${row.node}`,
        want.join(',') === have.join(','),
        `script says [${have.join(', ')}], the table says [${want.join(', ')}]`
      );
      for (const caller of want) {
        check(`topology:caller:${row.node}->${caller}`, have.includes(caller), 'caller missing from the script');
      }
    }
    for (const name of nodeNames) {
      if (!rowNames.has(name)) check(`topology:row:${name}`, false, 'a script node with no table row');
    }
  }

  /* 2. Every phase name resolves to a real section of the contract that declares it. */
  for (const phase of [...PHASES, ...REVIEW_PHASES]) {
    check(`phase:${phase.name}`, cites(root, phase.cites), `no heading for '${phase.cites.section}' in ${phase.cites.file}`);
  }

  /* 3. One proof per case, each citing the file and section its rule comes from. */
  for (const testCase of CASES) {
    check(`cites:${testCase.id}`, cites(root, testCase.cites), `no heading for '${testCase.cites.section}' in ${testCase.cites.file}`);
    let got;
    try {
      got = ASKS[testCase.input.question](testCase.input);
    } catch (error) {
      check(`case:${testCase.id}`, false, `threw ${error.message}`);
      continue;
    }
    check(`case:${testCase.id}`, matches(got, testCase.expect), `got ${JSON.stringify(got)}`);
  }

  /* 4. A malformed input is refused, never answered with a verdict. */
  for (const rejected of REJECTED) {
    let refused = false;
    try {
      const parsed = parseInput(JSON.stringify(rejected.input));
      ASKS[parsed.question](parsed);
    } catch (error) {
      refused = error instanceof BadInput;
    }
    check(`reject:${rejected.id.replace(/^reject:/, '')}`, refused, 'it answered instead of failing loudly');
  }

  process.stdout.write(JSON.stringify({ checks: checks.length, passed: checks.length - failed.length, failed }) + '\n');
  process.exit(failed.length ? 1 : 0);
}

/* ------------------------------------------------------------------------- *
 * Invocation
 * ------------------------------------------------------------------------- */

function readStdin() {
  try {
    return readFileSync(0, 'utf-8');
  } catch (error) {
    throw new BadInput(`stdin cannot be read: ${error.message}`);
  }
}

function parseInput(raw) {
  if (!raw || !raw.trim()) throw new BadInput('stdin is empty: one JSON object is required');
  let input;
  try {
    input = JSON.parse(raw);
  } catch (error) {
    throw new BadInput(`stdin is not valid JSON (${error.message})`);
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadInput(`stdin must carry one JSON object, got ${Array.isArray(input) ? 'an array' : typeof input}`);
  }
  if (typeof input.question !== 'string' || !Object.prototype.hasOwnProperty.call(ASKS, input.question)) {
    throw new BadInput(
      `question is required and must be one of ${Object.keys(ASKS).join(', ')}, got ${JSON.stringify(input.question)}`
    );
  }
  return input;
}

/**
 * The diagnosis names both causes because they read alike and they are not. If `node`
 * cannot start at all, this line never appears and that is an environment problem — the
 * fix is the user's, install Node.js. If this line appears, `node` ran: the input is
 * malformed or the case is one the bench does not cover, and that is a **package**
 * defect, a defect of Daiku, to be declared as such.
 */
function die(reason) {
  process.stderr.write(`architect: ${reason}\n`);
  process.stderr.write(
    '  Two causes read alike and are not. If this line is here, node ran: the input is malformed\n' +
      '  or the case is one the bench does not cover — a **package** defect, a defect of Daiku, to be\n' +
      '  declared as such. If instead no line ever arrives and the command does not start, that is an\n' +
      '  environment problem: node is not on the PATH, and the fix on your side is to install Node.js.\n' +
      '  In verdict mode this program exits non-zero; it never falls back to a silent success.\n'
  );
  process.exit(2);
}

function main() {
  const argv = process.argv.slice(2);
  const selfCheck = argv[0] === '--self-check';
  const root = selfCheck ? argv[1] : argv[0];
  if (!root) {
    process.stderr.write('usage: node architect.mjs <package-root>\n');
    process.stderr.write('       node architect.mjs --self-check <package-root>\n');
    process.exit(2);
  }
  if (selfCheck) {
    runBench(root);
    return;
  }
  let input;
  try {
    input = parseInput(readStdin());
  } catch (error) {
    die(error instanceof BadInput ? error.message : String(error && error.message));
  }
  let answer;
  try {
    answer = ASKS[input.question](input);
  } catch (error) {
    die(error instanceof BadInput ? error.message : String(error && error.message));
  }
  process.stdout.write(JSON.stringify(answer) + '\n');
  process.exit(0);
}

main();
