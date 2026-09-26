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
 * and, **in verdict mode, it opens no file of the project** — everything it needs to
 * know about the disk the agent passes it, because the agent already holds it. The one
 * file it does open is the package's own `schemas/blocks.json`, and only for the
 * `block` and `handoff` questions: that is not the project's disk, it is the contract it checks against. The price is
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
 *       the bench. Counted JSON `{checks, passed, failed[], never_red[]}` on stdout, exit 1
 *       on the first red or on a rule no fixture turned red. `hooks/self-check.mjs`
 *       launches it, so the release verification stays a single command.
 *
 * **The root always arrives as an argument**, in both modes, and is never derived
 * from this file's position on disk: a program that deduces its own root is correct
 * until the first move of the tree and wrong in silence. Verdict mode reads the root only
 * for the `block` and `handoff` questions; it requires it on every question all the same, because a
 * single invocation form is one thing to get wrong once. The bench uses it to read the
 * contracts it compares itself against.
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
 * none of the ten questions: `rounds` as a count (the rounds themselves live in the
 * ledger, and the ledger is what this program reads), `disciplines_round_1`,
 * `independence`, `applied`, `severe`, `on_previous_fix`, `discarded`, `coverage` **of
 * the review block** (the ledger's is read, by the resumption and the readable-ledger
 * condition), `ledger` **of the review block** (the one handed over beside it is read,
 * by the `order`, the closing and the resumption), `blocking` **as the block's own count**
 * (of each item it is read, by the blocking condition), `commit_sha` (the resumption reads
 * `commit` alone, to know whether the cycle had closed), `report`. Not reading a field is
 * also why a missing one among these changes no verdict. Of the brief and execute blocks
 * the `handoff` question holds together, the content of `brief_path`, `note_review_path`,
 * `verify_detail` and `detail` is not read either — the prose of a step, not its evidence —
 * but their presence is: it is the form the `block` question checks before `handoff` reads.
 * Of each round of the ledger, the trees are read only as present — the `round` question
 * refuses a round after one without them — and the fast check only by its `status`; `cost`,
 * `deviations`, the fast check's `detail` and `files`, the trees' values themselves are not
 * read: they are what `architect/ledger.mjs` measured, for the reader and for the next range.
 *
 * **A case the bench does not cover is a delivery that stops**, not a wrong verdict:
 * the verdict binds, and the bench is the only defence. That is the reason the bench
 * below counts one proof for every row of every table the ten questions copy, every
 * entry point, every case of the ambiguity rule, and every row of the topology table.
 */

import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const MERITS = ['continue', 'stop'];
/** The quick checks of `skills/execute/SKILL.md` § *Principles* 8; the bench holds it equal to `schemas/blocks.json`. */
const PREFLIGHT_STEPS = ['check_fast', 'lint_fix', 'test_targeted', 'layers'];
/** The outcome of the fast check `skills/review/SKILL.md` § *Applier* runs after each applier. */
const CHECKS = ['green', 'red', 'skipped'];

/** The guardrail `skills/review/SKILL.md` § *Exits* sets when no `--rounds N` was passed. */
const ROUNDS_GUARDRAIL = 6;

/* ------------------------------------------------------------------------- *
 * Input validation — it fails loudly, never an implicit false
 * ------------------------------------------------------------------------- */

class BadInput extends Error {}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * A rule a verdict can fail on, evaluated so the bench can see it fail. `rule(id, holds)`
 * returns `holds` and records, per `id`, whether it was ever seen holding and ever seen
 * failing. The bench reads every literal id this file passes to it and every row of `REQUIRES`, and
 * a rule no fixture ever turned red is itself a red — `never_red` — because a check nobody
 * saw fail is indistinguishable from one that cannot. Rules added after this convention go
 * through it; the ones written before it are covered by their own cases.
 */
const SEEN = new Map();
function rule(id, holds) {
  const seen = SEEN.get(id) || { held: false, failed: false };
  if (holds) seen.held = true;
  else seen.failed = true;
  SEEN.set(id, seen);
  return holds;
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

/** Every answer carries all ten fields; what a question does not use is `null` or empty. */
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
    violations: [],
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
 * The ten questions
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

/* ------------------------------------------------------------------------- *
 * 7. The round verdict — `skills/review/SKILL.md` § *When to run another round*, § *Exits*
 * ------------------------------------------------------------------------- */

/** An anchor is compared as the ledger defines it: text normalised to single spaces. */
function anchorOf(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function roundsOf(ledger) {
  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) {
    throw new BadInput('ledger is required: the ledger of this review, with the round just closed as its last');
  }
  const rounds = ledger.rounds;
  if (!Array.isArray(rounds) || !rounds.length) {
    throw new BadInput('ledger.rounds is required and must hold at least the round just closed');
  }
  rounds.forEach((round, index) => {
    if (!round || typeof round !== 'object') throw new BadInput(`ledger.rounds[${index}] is not a round`);
    if (round.n !== index + 1) {
      throw new BadInput(`ledger.rounds[${index}].n must be ${index + 1}, got ${JSON.stringify(round.n)}: rounds are numbered in order, without gaps`);
    }
    for (const key of ['applied', 'oscillation']) {
      if (!Array.isArray(round[key])) throw new BadInput(`ledger.rounds[${index}].${key} is required and must be an array`);
    }
    // A round after the first judges the delta of the round before it, and that delta is the
    // pair of trees the ledger recorded around its applier: without them it does not exist.
    if (index > 0) {
      for (const key of ['pre_apply_tree', 'post_apply_tree']) {
        if (!rule('round.previous-trees', nonEmpty(rounds[index - 1][key]))) {
          throw new BadInput(
            `ledger.rounds[${index - 1}].${key} is required: round ${index + 1} judges the delta between the two trees of the round before it`
          );
        }
      }
    }
    if (round.check_fast !== undefined) {
      if (!rule('round.check-fast-list', Array.isArray(round.check_fast))) {
        throw new BadInput(`ledger.rounds[${index}].check_fast must be an array`);
      }
      round.check_fast.forEach((entry, at) => {
        if (!rule('round.check-fast-entry', !!entry && nonEmpty(entry.area) && CHECKS.includes(entry.status))) {
          throw new BadInput(`ledger.rounds[${index}].check_fast[${at}] must be {"area", "status": ${CHECKS.join('|')}}`);
        }
      });
    }
    round.applied.forEach((fix, at) => {
      if (!fix || !nonEmpty(fix.file) || typeof fix.symbol !== 'string' || !nonEmpty(fix.anchor)) {
        throw new BadInput(`ledger.rounds[${index}].applied[${at}] needs file, symbol and anchor: a fix is identified by them`);
      }
      if (index === rounds.length - 1 && (typeof fix.severe !== 'boolean' || typeof fix.on_previous_fix !== 'boolean')) {
        throw new BadInput(`ledger.rounds[${index}].applied[${at}] needs severe and on_previous_fix as booleans: the verdict of the round reads them`);
      }
    });
  });
  return rounds;
}

/**
 * The oscillation, measured on the ledger and never taken from the applier's word: a fix of
 * the last round — applied, or suppressed by the applier and listed in its `oscillation`
 * field — whose anchor coincides with one recorded for the same `file` and `symbol` in a
 * round earlier than the one of the last fix on that site.
 */
function oscillationsOf(rounds) {
  const last = rounds.length - 1;
  const candidates = [
    ...rounds[last].applied.map((fix) => ({ file: fix.file, symbol: fix.symbol, anchor: anchorOf(fix.anchor) })),
    ...rounds[last].oscillation.map((item) => ({ file: item && item.file, symbol: item && item.symbol, anchor: anchorOf(item && item.current_anchor) })),
  ];
  const found = [];
  for (const candidate of candidates) {
    if (!candidate.anchor) continue;
    const prior = [];
    rounds.slice(0, last).forEach((round, index) => {
      for (const fix of round.applied) {
        if (fix.file === candidate.file && fix.symbol === candidate.symbol) prior.push({ index, anchor: anchorOf(fix.anchor) });
      }
    });
    if (!prior.length) continue;
    const lastFixRound = Math.max(...prior.map((fix) => fix.index));
    if (prior.some((fix) => fix.index < lastFixRound && fix.anchor === candidate.anchor)) {
      found.push(`${candidate.file} ${candidate.symbol}: "${candidate.anchor}"`);
    }
  }
  return [...new Set(found)];
}

function askRound(input) {
  const rounds = roundsOf(input.ledger);
  if (!Object.prototype.hasOwnProperty.call(input, 'rounds_cap')) {
    throw new BadInput('rounds_cap is required: the N of an explicit --rounds N, or null');
  }
  const cap = input.rounds_cap;
  if (cap !== null && !(Number.isInteger(cap) && cap > 0)) {
    throw new BadInput(`rounds_cap must be null or a positive integer, got ${JSON.stringify(cap)}`);
  }
  const merit = input.merit === undefined ? null : input.merit;
  if (merit !== null && !MERITS.includes(merit)) {
    throw new BadInput(`merit must be null or one of ${MERITS.join('|')}, got ${JSON.stringify(merit)}`);
  }
  const n = rounds.length;
  const current = rounds[n - 1];
  const declared = current.oscillation.length;

  // Rule 0 comes before all: a suppressed oscillating fix drops the applied to zero, and
  // rule 1 would otherwise call a bouncing cycle a fixed point.
  const oscillations = oscillationsOf(rounds);
  if (oscillations.length) {
    return block({
      verdict: 'oscillation',
      blockers: oscillations,
      detail:
        `rule 0: round ${n} brings back an anchor a later fix on the same site had replaced — ${oscillations.length} ` +
        `measured on the ledger, ${declared} declared by the applier. Exit oscillation.`,
    });
  }
  const divergence = declared ? ` The applier declared ${declared} oscillations the ledger does not confirm: annotate the deviation.` : '';
  if (!current.applied.length) {
    return block({ verdict: 'fixed-point', detail: `rule 1: round ${n} applied zero fixes. Exit fixed-point.${divergence}` });
  }

  const severe = current.applied.filter((fix) => fix.severe).length;
  const regressing = current.applied.filter((fix) => fix.on_previous_fix).length;
  // A fix the fast check rejects is code that does not pass the gate either: the round that
  // wrote it cannot be the last one, whatever else it applied.
  const red = (current.check_fast || []).filter((entry) => entry.status === 'red').map((entry) => entry.area);
  let why;
  if (severe >= 3) why = `rule 2: ${severe} severe fixes in round ${n}`;
  else if (!rule('round.fast-check-green', !red.length)) why = `rule 2: the fast check is red on ${red.join(', ')} after round ${n}`;
  else if (regressing) why = `rule 3: ${regressing} fixes rewrite a previous fix (on_previous_fix)`;
  else if (merit === null) {
    return block({
      verdict: 'merit',
      detail:
        `rule 3: round ${n} applied ${current.applied.length} fixes, ${severe} severe, none on a previous fix — the ` +
        'mechanical rules do not decide. Weigh what was applied, write the motivated line in the ledger, and ask again ' +
        `with merit "continue" or "stop".${divergence}`,
    });
  } else if (merit === 'stop') {
    return block({ verdict: 'diminishing-returns', detail: `rule 3: merit verdict stop on round ${n}. Exit diminishing-returns.${divergence}` });
  } else why = `rule 3: merit verdict continue on round ${n}`;

  if (cap !== null && n >= cap) {
    return block({ verdict: 'rounds-truncated', detail: `${why}, but the explicit cap of ${cap} rounds is reached. Exit rounds-truncated.${divergence}` });
  }
  if (cap === null && n >= ROUNDS_GUARDRAIL) {
    return block({
      verdict: 'rounds-exhausted',
      detail: `${why}, but the guardrail of ${ROUNDS_GUARDRAIL} rounds is reached without an explicit cap. Exit rounds-exhausted: an anomaly, not a budget.${divergence}`,
    });
  }
  return block({ verdict: 'continue', detail: `${why}: another round.${divergence}` });
}

/* ------------------------------------------------------------------------- *
 * 8. The `layers:` check — `skills/arch-check/SKILL.md` § *How you verify*
 * ------------------------------------------------------------------------- */

/** The pattern form of `paths` and `folders`: `**` crosses folders, `*` and `?` do not. */
function globToRegExp(pattern) {
  let out = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      i += 1;
      if (pattern[i + 1] === '/') {
        i += 1;
        out += '(?:.*/)?';
      } else out += '.*';
    } else if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`);
}

/** A `deny_imports` fragment is a path substring: trailing wildcards say "under here", nothing more. */
function fragmentOf(value) {
  return typeof value === 'string' ? value.split('\\').join('/').replace(/(\/?\*+)+$/, '').trim() : '';
}

function slashed(path) {
  return path.split('\\').join('/');
}

function askLayers(input) {
  if (!Array.isArray(input.layers)) {
    throw new BadInput('layers is required: the layers: blocks of the opened policies, each with its policy file');
  }
  if (!Array.isArray(input.added)) {
    throw new BadInput('added is required: the added lines of the scope, as {"file", "line", "text"}');
  }
  input.added.forEach((row, at) => {
    if (!row || !nonEmpty(row.file) || !Number.isInteger(row.line) || typeof row.text !== 'string') {
      throw new BadInput(`added[${at}] must be {"file": <path>, "line": <integer>, "text": <string>}`);
    }
  });
  const malformed = [];
  const violations = [];
  input.layers.forEach((layer, at) => {
    const label = layer && nonEmpty(layer.policy) ? `${layer.policy}#${nonEmpty(layer.name) ? layer.name : '?'}` : `layers[${at}]`;
    const folders = layer && Array.isArray(layer.folders) ? layer.folders.filter(nonEmpty) : [];
    const fragments = layer && Array.isArray(layer.deny_imports) ? layer.deny_imports.map(fragmentOf).filter(Boolean) : [];
    if (!layer || !nonEmpty(layer.policy) || !nonEmpty(layer.name) || !folders.length || !fragments.length) {
      malformed.push(`${label}: malformed — policy, name, folders and deny_imports are all required; verify its prose instead`);
      return;
    }
    const scopes = folders.map((folder) => globToRegExp(slashed(folder)));
    for (const row of input.added) {
      const file = slashed(row.file);
      if (!scopes.some((scope) => scope.test(file))) continue;
      const fragment = fragments.find((candidate) => row.text.includes(candidate));
      if (fragment) violations.push({ file, line: row.line, policy: layer.policy, layer: layer.name, fragment, text: row.text });
    }
  });
  return block({
    verdict: violations.length ? 'violations' : 'clean',
    blockers: malformed,
    violations,
    detail:
      `${violations.length} added lines carry a fragment their layer denies` +
      (malformed.length ? `; ${malformed.length} layers are malformed and fall back to the prose.` : '.'),
  });
}

/* ------------------------------------------------------------------------- *
 * 9. The shape of a returned block — `schemas/blocks.json`, plus what its prose adds
 * ------------------------------------------------------------------------- */

function schemaOf(root, name) {
  let schema;
  try {
    schema = JSON.parse(readFileSync(join(root, 'schemas', 'blocks.json'), 'utf-8'));
  } catch (error) {
    throw new BadInput(`schemas/blocks.json cannot be read under the root ${JSON.stringify(root)}: ${error.message}`);
  }
  const entry = schema.blocks && schema.blocks[name];
  if (!entry) throw new BadInput(`unknown block ${JSON.stringify(name)} — it is one of ${Object.keys(schema.blocks || {}).join(', ')}`);
  return entry;
}

/** The values at a dotted path; an array on the way is walked item by item. */
function valuesAt(value, path) {
  let current = [value];
  for (const key of path.split('.')) {
    current = current
      .flatMap((item) => (Array.isArray(item) ? item : [item]))
      .filter((item) => item && typeof item === 'object')
      .map((item) => item[key])
      .filter((item) => item !== undefined);
  }
  return current.flatMap((item) => (Array.isArray(item) ? item : [item]));
}

/**
 * What the prose of a producer says and `blocks.json` cannot: required keys and enums are
 * data, an order of option ids is a rule. One entry per block whose prose carries one.
 */
const SHAPES = {
  // skills/blueprint/SKILL.md § What you return: the plan as the brief froze it, the consumers of
  // every interface it touches, the facts it retires. Form, not quality: a non-empty red_if can
  // still be banal, and the prose says so.
  blueprint: (value) => {
    const keys = ['plan', 'interfaces', 'retired'];
    const wrong = [];
    for (const key of keys) {
      if (key in value && !rule('blueprint.lists', Array.isArray(value[key]))) wrong.push(`${key} is not an array — with zero items it is []`);
    }
    if (value.ok !== true || keys.some((key) => !Array.isArray(value[key]))) return wrong;
    if (!rule('blueprint.plan-not-empty', value.plan.length > 0)) {
      wrong.push('plan is empty: a brief has at least its reconnaissance and its closing task');
    }
    const ids = new Set();
    value.plan.forEach((task, at) => {
      const where = `plan[${at}]`;
      if (!rule('blueprint.plan-item', !!task && typeof task === 'object' && !Array.isArray(task))) {
        wrong.push(`${where} is not a task`);
        return;
      }
      if (!rule('blueprint.task-id', nonEmpty(task.task))) wrong.push(`${where}.task is missing or empty: it is the id the Memory numbers the task with`);
      else if (!rule('blueprint.task-id-unique', !ids.has(task.task))) wrong.push(`${where}.task ${JSON.stringify(task.task)} repeats an id`);
      else ids.add(task.task);
      if (!rule('blueprint.check', nonEmpty(task.check))) wrong.push(`${where}.check is missing or empty`);
      if (!rule('blueprint.red-if', nonEmpty(task.red_if))) {
        wrong.push(`${where}.red_if is missing or empty: a check naming no wrong state it catches is not a verification`);
      }
      if (!rule('blueprint.cases-list', Array.isArray(task.cases))) {
        wrong.push(`${where}.cases is not an array — for a task changing no behaviour it is []`);
        return;
      }
      task.cases.forEach((row, index) => {
        if (!rule('blueprint.case-row', !!row && nonEmpty(row.input) && nonEmpty(row.expected))) {
          wrong.push(`${where}.cases[${index}] needs input and expected, both non-empty`);
        }
      });
    });
    value.interfaces.forEach((item, at) => {
      if (!rule('blueprint.interface', !!item && nonEmpty(item.symbol) && nonEmpty(item.declared_in))) {
        wrong.push(`interfaces[${at}] needs symbol and declared_in, both non-empty`);
        return;
      }
      if (!rule('blueprint.consumers', Array.isArray(item.consumers) && item.consumers.every(nonEmpty))) {
        wrong.push(`interfaces[${at}].consumers must be an array of "<path:line>" strings — with none it is []`);
      }
    });
    value.retired.forEach((item, at) => {
      if (!rule('blueprint.retired', !!item && nonEmpty(item.fact) && nonEmpty(item.pattern))) {
        wrong.push(`retired[${at}] needs fact and pattern, both non-empty`);
      }
    });
    return wrong;
  },
  // skills/execute/SKILL.md § What you return: the evidence of what execute verified. Form, not
  // quality: a red proof with a non-zero exit can still exercise the wrong thing.
  execute: (value) => {
    const keys = ['checks', 'red_proofs', 'consumers_checked', 'absence', 'preflight'];
    const wrong = [];
    for (const key of keys) {
      if (key in value && !rule('execute.lists', Array.isArray(value[key]))) wrong.push(`${key} is not an array — with zero items it is []`);
    }
    if (value.ok !== true || keys.some((key) => !Array.isArray(value[key]))) return wrong;
    const tasks = new Set();
    value.checks.forEach((row, at) => {
      const where = `checks[${at}]`;
      if (!rule('execute.check-task', !!row && nonEmpty(row.task))) {
        wrong.push(`${where}.task is missing or empty`);
        return;
      }
      if (!rule('execute.check-task-unique', !tasks.has(row.task))) wrong.push(`${where}.task ${JSON.stringify(row.task)} repeats a task: one row per task`);
      tasks.add(row.task);
      if ('replaced' in row) {
        if (!rule('execute.check-replaced', nonEmpty(row.replaced))) wrong.push(`${where}.replaced is empty: a replaced task says why, as the Journal does`);
      } else if (!rule('execute.check-run', nonEmpty(row.check) && Number.isInteger(row.exit))) {
        wrong.push(`${where} needs check and an integer exit: the command rerun at closing and what it returned`);
      }
    });
    value.red_proofs.forEach((proof, at) => {
      const where = `red_proofs[${at}]`;
      if (!rule('execute.proof-names', !!proof && nonEmpty(proof.test) && nonEmpty(proof.task) && nonEmpty(proof.against))) {
        wrong.push(`${where} needs test, task and against, all non-empty`);
        return;
      }
      if (!rule('execute.proof-red', Number.isInteger(proof.exit) && proof.exit !== 0)) {
        wrong.push(`${where}.exit must be a non-zero integer: a proof of red that exited 0 is a green`);
      }
      if (!rule('execute.proof-output', nonEmpty(proof.red_output))) wrong.push(`${where}.red_output is empty: the lines showing the red are the proof`);
    });
    value.consumers_checked.forEach((row, at) => {
      if (!rule('execute.consumer', !!row && nonEmpty(row.consumer) && nonEmpty(row.check) && Number.isInteger(row.exit))) {
        wrong.push(`consumers_checked[${at}] needs consumer, check and an integer exit`);
      }
    });
    value.absence.forEach((row, at) => {
      const where = `absence[${at}]`;
      if (!rule('execute.absence-count', !!row && nonEmpty(row.pattern) && Number.isInteger(row.hits) && row.hits >= 0)) {
        wrong.push(`${where} needs pattern and hits, a count from 0 up`);
        return;
      }
      if (!rule('execute.absence-why', row.hits === 0 || nonEmpty(row.why))) {
        wrong.push(`${where} counts ${row.hits} hits and no why: every hit left is answered for`);
      }
    });
    value.preflight.forEach((row, at) => {
      const where = `preflight[${at}]`;
      if (!rule('execute.preflight-row', !!row && nonEmpty(row.step) && nonEmpty(row.outcome) && typeof row.detail === 'string')) {
        wrong.push(`${where} needs step, outcome and detail`);
        return;
      }
      if (!rule('execute.preflight-detail', row.outcome === 'green' || nonEmpty(row.detail))) {
        wrong.push(`${where} is ${row.outcome} with no detail: a red carries its output, a skip the key the project does not declare`);
      }
    });
    for (const step of PREFLIGHT_STEPS) {
      if (!rule('execute.preflight-step', value.preflight.some((row) => row && row.step === step))) {
        wrong.push(`preflight has no ${step} row: each of the four quick checks is run or declared skipped`);
      }
    }
    return wrong;
  },
  // skills/decision-doc/SKILL.md § The block you return, and skills/new-feature/SKILL.md § 7.
  'decision-doc': (value) => {
    const wrong = [];
    if (value.stage === null) wrong.push('stage is null: it is strategic or technical');
    // A missing key is already reported by the required list: only a present one is judged here.
    for (const key of ['applied_fixes', 'incorporated', 'open_items']) {
      if (key in value && !Array.isArray(value[key])) wrong.push(`${key} is not an array — with zero items it is []`);
    }
    if (!('decisions' in value) || value.decisions === null) return wrong;
    if (!Array.isArray(value.decisions)) return [...wrong, 'decisions is neither an array nor null'];
    value.decisions.forEach((decision, at) => {
      const where = `decisions[${at}]`;
      if (!decision || typeof decision !== 'object') {
        wrong.push(`${where} is not a decision`);
        return;
      }
      for (const key of ['title', 'problem', 'recommended_why']) {
        if (!nonEmpty(decision[key])) wrong.push(`${where}.${key} is missing or empty`);
      }
      if (value.stage === 'technical' && decision.classification !== null) {
        wrong.push(`${where}.classification must be null at the technical stage`);
      }
      if (value.stage === 'strategic' && decision.classification === null) {
        wrong.push(`${where}.classification is null at the strategic stage`);
      }
      const options = decision.options;
      if (!Array.isArray(options) || options.length < 2 || options.length > 4) {
        wrong.push(`${where}.options must hold 2 to 4 options`);
      } else {
        options.forEach((option, index) => {
          const id = 'ABCD'[index];
          if (!option || option.id !== id) wrong.push(`${where}.options[${index}].id must be "${id}": A, B, C, D in order, no letter skipped`);
          if (!option || !nonEmpty(option.text)) wrong.push(`${where}.options[${index}].text is missing or empty`);
        });
      }
      if (decision.recommended_id !== 'A') wrong.push(`${where}.recommended_id must be "A", got ${JSON.stringify(decision.recommended_id)}`);
    });
    return wrong;
  },
  // skills/applier/SKILL.md § The block you return: every finding handed over has exactly one
  // outcome. `finding_ids` is the list the caller numbered, and a shape without it cannot judge.
  applier: (value, input) => {
    const ids = input.finding_ids;
    if (!rule('applier.finding-ids', Array.isArray(ids) && ids.every(nonEmpty) && new Set(ids).size === ids.length)) {
      throw new BadInput('finding_ids is required for the applier block: the ids of every finding handed to it, distinct and non-empty');
    }
    const wrong = [];
    const outcomes = new Map(ids.map((id) => [id, []]));
    for (const key of ['applied', 'discarded', 'to_confirm', 'oscillation']) {
      if (!(key in value)) continue;
      if (!rule('applier.lists', Array.isArray(value[key]))) {
        wrong.push(`${key} is not an array — with zero items it is []`);
        continue;
      }
      value[key].forEach((item, at) => {
        const id = item && item.finding_id;
        if (!rule('applier.item-names-a-finding', nonEmpty(id))) wrong.push(`${key}[${at}].finding_id is missing: every item names the finding it answers`);
        else if (!rule('applier.finding-was-handed-over', outcomes.has(id))) wrong.push(`${key}[${at}].finding_id ${JSON.stringify(id)} is not a finding that was handed over`);
        else if (key !== 'oscillation') outcomes.get(id).push(key);
      });
    }
    for (const [id, seen] of outcomes) {
      const kinds = [...new Set(seen)];
      if (!rule('applier.every-finding-has-an-outcome', kinds.length > 0)) wrong.push(`finding ${id} has no outcome: it is applied, discarded or to confirm`);
      else if (!rule('applier.one-outcome', kinds.length === 1)) wrong.push(`finding ${id} has more than one outcome: ${kinds.join(', ')}`);
      else if (!rule('applier.listed-once-unless-applied', kinds[0] === 'applied' || seen.length === 1)) {
        wrong.push(`finding ${id} is listed ${seen.length} times in ${kinds[0]}`);
      }
    }
    for (const item of Array.isArray(value.oscillation) ? value.oscillation : []) {
      const id = item && item.finding_id;
      if (nonEmpty(id) && outcomes.has(id) && !rule('applier.oscillation-is-discarded', outcomes.get(id).includes('discarded'))) {
        wrong.push(`finding ${id} is in oscillation and not among the discarded: a suppressed fix is recorded there too`);
      }
    }
    return wrong;
  },
  // skills/finder-prompt/SKILL.md § The block you return: a list of findings, each on a file.
  finder: (value) => {
    if (!rule('finder.findings-list', Array.isArray(value.findings))) return ['findings is not an array — with zero findings it is []'];
    const wrong = [];
    value.findings.forEach((finding, at) => {
      if (!rule('finder.finding-on-a-file', !!finding && nonEmpty(finding.file))) wrong.push(`findings[${at}].file is missing: a finding stands on a file`);
    });
    return wrong;
  },
};

function askBlock(input, root) {
  if (!nonEmpty(input.name)) throw new BadInput('name is required: the block, as schemas/blocks.json names it');
  if (!Object.prototype.hasOwnProperty.call(input, 'block')) {
    throw new BadInput('block is required: what the step returned, parsed — null if nothing came back');
  }
  const schema = schemaOf(root, input.name);
  const value = input.block;
  let wrong;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    wrong = [`the step did not return a JSON object (${value === null ? 'null' : Array.isArray(value) ? 'an array' : typeof value})`];
  } else {
    wrong = (schema.required || []).filter((key) => !(key in value)).map((key) => `${key} is missing`);
    for (const [path, domain] of Object.entries(schema.enums || {})) {
      for (const got of valuesAt(value, path)) {
        if (got !== null && !domain.includes(got)) wrong.push(`${path} is ${JSON.stringify(got)}, outside ${domain.join('|')}`);
      }
    }
    if (SHAPES[input.name]) wrong.push(...SHAPES[input.name](value, input));
  }
  return block({
    verdict: wrong.length ? 'invalid' : 'valid',
    blockers: wrong,
    detail: wrong.length
      ? `the ${input.name} block is malformed — ${wrong.length} faults. A malformed block counts as a block that did not come back.`
      : `the ${input.name} block has the shape its producer declares.`,
  });
}

/* ------------------------------------------------------------------------- *
 * 10. The handoff — `skills/develop-feature/SKILL.md` § *The handoff*
 * ------------------------------------------------------------------------- */

/** The file a reference names: `<file>::<case>` and `<path>:<line>` lose their tail, `\` becomes `/`. */
function fileOf(ref) {
  return slashed(String(ref))
    .replace(/::.*$/, '')
    .replace(/:\d+(?::\d+)?$/, '')
    .replace(/^\.\//, '');
}

/** A block handed to `handoff` is held to the form the `block` question checks, or refused loudly. */
function heldBlock(input, key, name, root) {
  const shape = askBlock({ question: 'block', name, block: input[key] }, root);
  if (shape.verdict !== 'valid') throw new BadInput(`${key} is not a valid ${name} block — ${shape.blockers.join('; ')}`);
  if (input[key].ok !== true) {
    throw new BadInput(`${key}.ok is not true: a step that failed is the propagation question, not the handoff`);
  }
  return input[key];
}

/** The caller's own read-only measurements, never the executor's word. */
function measuredOf(input) {
  const measured = input.measured;
  if (!measured || typeof measured !== 'object' || Array.isArray(measured)) {
    throw new BadInput('measured is required: {"absence", "consumers", "open_tasks"}, the caller\'s own read-only searches');
  }
  if (!Array.isArray(measured.absence) || measured.absence.some((row) => !row || !nonEmpty(row.pattern) || !Number.isInteger(row.hits) || row.hits < 0)) {
    throw new BadInput('measured.absence must be [{"pattern", "hits"}], one row per retired fact, hits counted from 0');
  }
  if (!Array.isArray(measured.consumers) || measured.consumers.some((row) => !row || !nonEmpty(row.symbol) || !Array.isArray(row.files) || !row.files.every(nonEmpty))) {
    throw new BadInput('measured.consumers must be [{"symbol", "files"}], one row per interface of the brief');
  }
  if (!Array.isArray(measured.open_tasks) || !measured.open_tasks.every((line) => typeof line === 'string')) {
    throw new BadInput('measured.open_tasks must be an array: the task lines of the brief still [ ] or [~]');
  }
  return measured;
}

function askHandoff(input, root) {
  const brief = heldBlock(input, 'brief', 'blueprint', root);
  const notes = heldBlock(input, 'notes', 'execute', root);
  if (!Array.isArray(input.diff_files) || !input.diff_files.every(nonEmpty)) {
    throw new BadInput('diff_files is required: the files of the diff as git prints them, relative to the technical root');
  }
  const measured = measuredOf(input);
  const diff = new Set(input.diff_files.map(fileOf));
  const blockers = [];
  const replaced = [];

  // 1. Every task the brief froze is answered for at closing: rerun, or replaced with a why;
  //    and every check rerun — the brief's and those execute added — is green.
  for (const task of brief.plan) {
    const row = notes.checks.find((check) => check.task === task.task);
    if (!rule('handoff.task-answered', !!row)) blockers.push(`task ${task.task}: its check was not rerun at closing, and no row says it was replaced`);
    else if ('replaced' in row) replaced.push(task.task);
  }
  for (const row of notes.checks) {
    if ('replaced' in row) continue;
    if (!rule('handoff.check-green', row.exit === 0)) blockers.push(`task ${row.task}: its check is red on the final tree (exit ${row.exit})`);
  }

  // 2. A task that changes behaviour was seen red, and every proof is on a file this diff writes.
  for (const task of brief.plan) {
    if (!task.cases.length) continue;
    if (!rule('handoff.behaviour-proven', notes.red_proofs.some((proof) => proof.task === task.task))) {
      blockers.push(`task ${task.task}: it changes behaviour and no test of it was seen red`);
    }
  }
  for (const proof of notes.red_proofs) {
    if (!rule('handoff.proof-in-diff', diff.has(fileOf(proof.test)))) {
      blockers.push(`red proof ${proof.test}: its file is not in the diff, so it is not a test this change writes`);
    }
  }

  // 3. Every consumer the brief maps is checked green, and every file naming an interface is
  //    either mapped by the brief or checked by execute.
  const checked = new Set(notes.consumers_checked.filter((row) => row.exit === 0).map((row) => fileOf(row.consumer)));
  for (const item of brief.interfaces) {
    for (const consumer of item.consumers) {
      const row = notes.consumers_checked.find((check) => check.consumer === consumer);
      if (!rule('handoff.consumer-checked', !!row)) blockers.push(`${item.symbol}: consumer ${consumer} has no check`);
      else if (!rule('handoff.consumer-green', row.exit === 0)) blockers.push(`${item.symbol}: the check of consumer ${consumer} is red (exit ${row.exit})`);
    }
    const found = measured.consumers.find((row) => row.symbol === item.symbol);
    if (!found) {
      throw new BadInput(`measured.consumers has no row for ${JSON.stringify(item.symbol)}: the search is the caller's, and a missing one is a guessed value`);
    }
    const mapped = new Set([fileOf(item.declared_in), ...item.consumers.map(fileOf)]);
    for (const file of new Set(found.files.map(fileOf))) {
      if (!rule('handoff.consumer-mapped', mapped.has(file) || checked.has(file))) {
        blockers.push(`${item.symbol}: ${file} names it, and the brief does not map it nor did execute check it`);
      }
    }
  }

  // 4. Every fact the brief retires was searched, and the count is the caller's measurement.
  for (const item of brief.retired) {
    const measure = measured.absence.find((row) => row.pattern === item.pattern);
    if (!measure) {
      throw new BadInput(`measured.absence has no row for ${JSON.stringify(item.pattern)}: the search is the caller's, and a missing one is a guessed value`);
    }
    const row = notes.absence.find((absence) => absence.pattern === item.pattern);
    if (!rule('handoff.retired-searched', !!row)) blockers.push(`retired "${item.fact}": no search recorded for ${JSON.stringify(item.pattern)}`);
    else if (!rule('handoff.retired-count', row.hits === measure.hits)) {
      blockers.push(`retired "${item.fact}": execute counted ${row.hits} hits, the search counts ${measure.hits} — the measurement holds`);
    }
  }

  // 5. No quick check is red, and 6. no task is left open in the brief.
  for (const row of notes.preflight) {
    if (!rule('handoff.preflight-green', row.outcome !== 'red')) blockers.push(`preflight ${row.step} on ${row.area || 'no area'} is red: ${row.detail}`);
  }
  if (!rule('handoff.no-open-task', measured.open_tasks.length === 0)) {
    blockers.push(...measured.open_tasks.map((line) => `task still open in the brief: ${line.trim()}`));
  }

  return block({
    verdict: blockers.length ? 'not-ready' : 'ready',
    blockers,
    detail: blockers.length
      ? `${blockers.length} pieces of evidence are missing: execute is relaunched once with them, and a second not-ready stops the delivery.`
      : 'every task of the brief is answered for, every behaviour change was seen red, every consumer checked, every retired fact searched' +
        (replaced.length ? `; replaced by the plan adaptation, with the why in the Journal: ${replaced.join(', ')}.` : '.'),
  });
}

const ASKS = {
  decision: askDecision,
  closing: askClosing,
  unblock: askUnblock,
  propagation: askPropagation,
  resumption: askResumption,
  order: askOrder,
  round: askRound,
  layers: askLayers,
  block: askBlock,
  handoff: askHandoff,
};

/**
 * The keys each question requires besides `question`, declared once. The program refuses an
 * input missing one of them before asking, and the bench refuses a call to the evaluator,
 * written in the contracts of `skills/`, whose paragraph does not name them all. A key a
 * question reads only in some cases — `merit` on the second ask of `round`, `finding_ids` for
 * the applier's block, the `commit` of `review_outcome` for `resumption` — is not here: the
 * question checks it where it reads it. A contract that changes the input of a question
 * changes its row here in the same change.
 */
const REQUIRES = {
  decision: ['review_outcome'],
  closing: ['review_outcome', 'ledger'],
  unblock: ['review_outcome'],
  propagation: ['step'],
  resumption: ['entry', 'present', 'ledger'],
  order: ['entry', 'present', 'ledger'],
  round: ['ledger', 'rounds_cap'],
  layers: ['layers', 'added'],
  block: ['name', 'block'],
  handoff: ['brief', 'notes', 'diff_files', 'measured'],
};

/** Every answer goes through here: the keys of `REQUIRES` first, then the question. */
function dispatch(input, root) {
  for (const key of REQUIRES[input.question] || []) {
    if (!rule(`requires:${input.question}.${key}`, Object.prototype.hasOwnProperty.call(input, key))) {
      throw new BadInput(`${key} is required by the ${input.question} question: a key a question needs and does not find is a loud failure, never a guessed value`);
    }
  }
  return ASKS[input.question](input, root);
}

/** The paragraph a line stands in: the run of non-blank lines around it, cut at list items and headings. */
function paragraphAt(lines, at) {
  const opens = (line) => /^\s*([-*]|\d+\.)\s/.test(line) || /^#{1,6}\s/.test(line);
  let from = at;
  while (from > 0 && lines[from - 1].trim() !== '' && !opens(lines[from - 1])) from -= 1;
  let to = at;
  while (to + 1 < lines.length && lines[to + 1].trim() !== '' && !opens(lines[to + 1])) to += 1;
  return lines.slice(from, to + 1).join(' ');
}

/**
 * What a call to the evaluator written in prose leaves unnamed: the question itself when
 * `REQUIRES` does not know it, else each key its row lists that the paragraph does not name.
 * The name counts in a code span or as a word — "the artefacts present" names `present` —
 * and never inside the `question: "…"` literal, where `block` would name itself.
 */
function unnamedKeys(paragraph, question) {
  if (!rule('doc.question-known', Object.prototype.hasOwnProperty.call(REQUIRES, question))) return ['the question itself, which REQUIRES does not know'];
  const text = paragraph.replace(/question:\s*"[^"]*"/g, ' ');
  return REQUIRES[question].filter((key) => !rule('doc.key-named', new RegExp(`\\b${key}\\b`).test(text)));
}

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
    if (key === 'violations_length') return (got.violations || []).length === value;
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

const FIX = (file, symbol, anchor, severe = false, onPreviousFix = false) => ({
  file, symbol, anchor, line: 1, what: 'x', severe, on_previous_fix: onPreviousFix,
});
const ROUND = (applied, oscillation = [], extra = {}) => ({
  applied, oscillation, discarded: [], to_confirm: [], missing_disciplines: [], pre_apply_tree: 'a1', post_apply_tree: 'b2', ...extra,
});
const OUTCOME = (id, extra = {}) => ({ finding_id: id, file: 'a.mjs', symbol: 'f', line: 1, ...extra });
const APPLIER = (extra = {}) => ({ applied: [], discarded: [], to_confirm: [], oscillation: [], ...extra });
const LEDGER = (rounds) => ({
  base: 'abc1234', item: 'x/y', rounds: rounds.map((round, index) => ({ n: index + 1, ...round })),
  outcome: null, coverage: null, gate: null, gate_detail: null,
});
const LAYER = (extra = {}) => ({
  policy: '.daiku/policies/server.md', name: 'api', folders: ['src/server/api/**'], deny_imports: ['src/server/db/**'], ...extra,
});
const DOC = (extra = {}, decision = {}) => ({
  stage: 'technical', stage_why: 'x', file: 'x/1. decision-doc.md', verdict: null, applied_fixes: [],
  decisions: [{
    n: 1, title: 't', problem: 'p', classification: null,
    options: [{ id: 'A', text: 'a' }, { id: 'B', text: 'b' }], recommended_id: 'A', recommended_why: 'w', ...decision,
  }],
  incorporated: [], open_items: [], ...extra,
});
const BP_TASK = (id, extra = {}) => ({ task: id, check: `node check-${id}.mjs`, red_if: `task ${id} left undone`, cases: [], ...extra });
const BP_BLOCK = (extra = {}) => ({
  ok: true, brief_path: 'x/2. blueprint.md',
  plan: [BP_TASK('0'), BP_TASK('1', { cases: [{ input: 'a', expected: 'b' }] }), BP_TASK('2')],
  interfaces: [{ symbol: 'red_proofs', declared_in: 'skills/execute/SKILL.md:120', consumers: ['architect/architect.mjs:900'] }],
  retired: [{ fact: 'the retired wording', pattern: 'the retired wording' }],
  detail: '', ...extra,
});
const EX_BLOCK = (extra = {}) => ({
  ok: true, note_review_path: 'x/4. review-notes.md', verify_detail: 'green',
  checks: ['0', '1', '2'].map((task) => ({ task, check: `node check-${task}.mjs`, exit: 0 })),
  red_proofs: [{ test: 'test/a.test.mjs::maps a to b', task: '1', against: 'base', exit: 1, red_output: 'expected b, got undefined' }],
  consumers_checked: [{ consumer: 'architect/architect.mjs:900', check: 'node architect/architect.mjs --self-check .', exit: 0 }],
  absence: [{ pattern: 'the retired wording', hits: 0, why: '' }],
  preflight: PREFLIGHT_STEPS.map((step) => ({ step, area: 'core', outcome: 'green', detail: '' })),
  detail: '', ...extra,
});
const HANDOFF = (extra = {}, measured = {}) => ({
  question: 'handoff', brief: BP_BLOCK(), notes: EX_BLOCK(),
  diff_files: ['test/a.test.mjs', 'architect/architect.mjs', 'skills/execute/SKILL.md'],
  measured: {
    absence: [{ pattern: 'the retired wording', hits: 0 }],
    consumers: [{ symbol: 'red_proofs', files: ['skills/execute/SKILL.md', 'architect/architect.mjs'] }],
    open_tasks: [],
    ...measured,
  },
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
    input: { question: 'order', entry: 'new-feature', present: [], ledger: null },
    expect: { verdict: 'proceed', remaining_starts_with: 'problem' } },
  { id: 'order:proceed-from-the-delivery', cites: { file: 'skills/develop-feature/SKILL.md', section: 'The sequence' },
    input: { question: 'order', entry: 'develop-feature', present: ['1. decision-doc.md'], ledger: null },
    expect: { verdict: 'proceed', remaining_starts_with: 'acquisition' } },
  { id: 'order:proven-phases-are-cut', cites: { file: 'skills/develop-feature/SKILL.md', section: 'The sequence' },
    input: { question: 'order', entry: 'develop-feature', present: ['1. decision-doc.md', '2. blueprint.md'], ledger: null },
    expect: { verdict: 'proceed', remaining_starts_with: 'execute' } },
  { id: 'order:review-entry', cites: { file: 'skills/review/SKILL.md', section: 'The cycle' },
    input: { question: 'order', entry: 'review', present: [], ledger: null },
    expect: { verdict: 'proceed', remaining_starts_with: 'scope', remaining: ['scope', 'finder', 'applier', 'coverage', 'gate', 'closing'] } },
  { id: 'order:review-entry-on-a-review-notes', cites: { file: 'skills/review/SKILL.md', section: 'The cycle' },
    input: { question: 'order', entry: 'review', present: ['4. review-notes.md'], ledger: null },
    expect: { verdict: 'proceed', remaining_starts_with: 'scope' } },

  /* --- the four entry points, plus the atomic one --- */
  { id: 'entry:new-feature', cites: { file: 'skills/new-feature/SKILL.md', section: 'The sequence' },
    input: { question: 'order', entry: 'new-feature', present: [], ledger: null },
    expect: { verdict: 'proceed', remaining_starts_with: 'problem' } },
  { id: 'entry:decision-doc', cites: { file: 'skills/decision-doc/SKILL.md', section: 'Input: the problem folder' },
    input: { question: 'order', entry: 'decision-doc', present: ['0. problem.md'], ledger: null },
    expect: { verdict: 'proceed', remaining_starts_with: 'decisions' } },
  { id: 'entry:develop-feature', cites: { file: 'skills/develop-feature/SKILL.md', section: 'Input' },
    input: { question: 'order', entry: 'develop-feature', present: ['1. decision-doc.md'], ledger: null },
    expect: { verdict: 'proceed', remaining_starts_with: 'acquisition' } },
  { id: 'entry:review', cites: { file: 'skills/review/SKILL.md', section: 'Input' },
    input: { question: 'order', entry: 'review', present: [], ledger: null },
    expect: { verdict: 'proceed', remaining_starts_with: 'scope' } },
  { id: 'entry:study', cites: { file: 'contracts/orchestration.md', section: '3. Invocable skills and internal contracts' },
    input: { question: 'order', entry: 'study', present: [], ledger: null },
    expect: { verdict: 'stop' } },

  /* --- ambiguity: two incoherences and one legitimate fork --- */
  { id: 'ambiguity:incoherence-artifacts-exclude-each-other', cites: { file: 'skills/develop-feature/SKILL.md', section: 'Input' },
    input: { question: 'order', entry: 'new-feature', present: ['1. decision-doc.md', '5. review-report.md'], ledger: null },
    expect: { verdict: 'stop', readings_length: 0 } },
  { id: 'ambiguity:incoherence-entry-declares-a-missing-artifact', cites: { file: 'skills/develop-feature/SKILL.md', section: 'Input' },
    input: { question: 'order', entry: 'develop-feature', present: [], ledger: null },
    expect: { verdict: 'stop', readings_length: 0 } },
  { id: 'ambiguity:fork-both-readings-are-defensible', cites: { file: 'skills/review/SKILL.md', section: 'Baseline and ledger' },
    input: { question: 'order', entry: 'new-feature', present: ['4. review-notes.md'], ledger: null },
    expect: { verdict: 'stop', readings_length: 2 } },
  /* --- question: round — skills/review/SKILL.md § When to run another round, § Exits --- */
  { id: 'round:rule-1-fixed-point', cites: { file: 'skills/review/SKILL.md', section: 'When to run another round' },
    input: { question: 'round', rounds_cap: null, ledger: LEDGER([ROUND([])]) },
    expect: { verdict: 'fixed-point' } },
  { id: 'round:rule-0-a-suppressed-fix-beats-the-fixed-point', cites: { file: 'skills/review/SKILL.md', section: 'When to run another round' },
    input: { question: 'round', rounds_cap: null, ledger: LEDGER([ROUND([FIX('a.mjs', 'f', 'x = 1')]), ROUND([FIX('a.mjs', 'f', 'x = 2')]), ROUND([], [{ file: 'a.mjs', symbol: 'f', current_anchor: 'x = 1', previous_anchor: 'x = 2' }])]) },
    expect: { verdict: 'oscillation', blockers_include: 'a.mjs f' } },
  { id: 'round:rule-0-an-applied-fix-that-goes-back', cites: { file: 'skills/review/SKILL.md', section: 'Exits' },
    input: { question: 'round', rounds_cap: null, ledger: LEDGER([ROUND([FIX('a.mjs', 'f', 'x = 1')]), ROUND([FIX('a.mjs', 'f', 'x = 2')]), ROUND([FIX('a.mjs', 'f', 'x = 1')])]) },
    expect: { verdict: 'oscillation' } },
  { id: 'round:rule-0-anchors-compare-normalised', cites: { file: 'skills/review/SKILL.md', section: 'How a fix is identified, between one round and the next' },
    input: { question: 'round', rounds_cap: null, ledger: LEDGER([ROUND([FIX('a.mjs', 'f', 'x  =   1')]), ROUND([FIX('a.mjs', 'f', 'x = 2')]), ROUND([FIX('a.mjs', 'f', 'x = 1')])]) },
    expect: { verdict: 'oscillation' } },
  { id: 'round:rule-0-another-symbol-is-another-site', cites: { file: 'skills/review/SKILL.md', section: 'Exits' },
    input: { question: 'round', rounds_cap: null, ledger: LEDGER([ROUND([FIX('a.mjs', 'f', 'x = 1')]), ROUND([FIX('a.mjs', 'f', 'x = 2')]), ROUND([FIX('a.mjs', 'g', 'x = 1')])]) },
    expect: { verdict: 'merit' } },
  { id: 'round:rule-0-the-same-anchor-with-no-fix-in-between-is-not-a-return', cites: { file: 'skills/review/SKILL.md', section: 'Exits' },
    input: { question: 'round', rounds_cap: null, ledger: LEDGER([ROUND([FIX('a.mjs', 'f', 'x = 1')]), ROUND([FIX('b.mjs', 'g', 'y')]), ROUND([FIX('a.mjs', 'f', 'x = 1')])]) },
    expect: { verdict: 'merit' } },
  { id: 'round:rule-0-a-declared-oscillation-the-ledger-does-not-confirm', cites: { file: 'skills/review/SKILL.md', section: 'The two signals are verified, not accepted' },
    input: { question: 'round', rounds_cap: null, ledger: LEDGER([ROUND([], [{ file: 'a.mjs', symbol: 'f', current_anchor: 'x = 1', previous_anchor: 'x = 2' }])]) },
    expect: { verdict: 'fixed-point' } },
  { id: 'round:rule-2-three-severe', cites: { file: 'skills/review/SKILL.md', section: 'When to run another round' },
    input: { question: 'round', rounds_cap: null, ledger: LEDGER([ROUND([FIX('a.mjs', 'f', '1', true), FIX('a.mjs', 'g', '2', true), FIX('b.mjs', 'h', '3', true)])]) },
    expect: { verdict: 'continue' } },
  { id: 'round:rule-3-on-a-previous-fix', cites: { file: 'skills/review/SKILL.md', section: 'When to run another round' },
    input: { question: 'round', rounds_cap: null, ledger: LEDGER([ROUND([FIX('a.mjs', 'f', '1')]), ROUND([FIX('a.mjs', 'f', '2', false, true)])]) },
    expect: { verdict: 'continue' } },
  { id: 'round:rule-3-merit-is-asked', cites: { file: 'skills/review/SKILL.md', section: 'When to run another round' },
    input: { question: 'round', rounds_cap: null, ledger: LEDGER([ROUND([FIX('a.mjs', 'f', '1', true), FIX('a.mjs', 'g', '2')])]) },
    expect: { verdict: 'merit' } },
  { id: 'round:rule-3-merit-stop', cites: { file: 'skills/review/SKILL.md', section: 'Exits' },
    input: { question: 'round', rounds_cap: null, merit: 'stop', ledger: LEDGER([ROUND([FIX('a.mjs', 'f', '1')])]) },
    expect: { verdict: 'diminishing-returns' } },
  { id: 'round:rule-3-merit-continue', cites: { file: 'skills/review/SKILL.md', section: 'When to run another round' },
    input: { question: 'round', rounds_cap: null, merit: 'continue', ledger: LEDGER([ROUND([FIX('a.mjs', 'f', '1')])]) },
    expect: { verdict: 'continue' } },
  { id: 'round:merit-does-not-override-a-mechanical-rule', cites: { file: 'skills/review/SKILL.md', section: 'When to run another round' },
    input: { question: 'round', rounds_cap: null, merit: 'stop', ledger: LEDGER([ROUND([FIX('a.mjs', 'f', '1', true), FIX('a.mjs', 'g', '2', true), FIX('b.mjs', 'h', '3', true)])]) },
    expect: { verdict: 'continue' } },
  { id: 'round:exit-rounds-truncated', cites: { file: 'skills/review/SKILL.md', section: 'Exits' },
    input: { question: 'round', rounds_cap: 2, ledger: LEDGER([ROUND([FIX('a.mjs', 'f', '1')]), ROUND([FIX('a.mjs', 'f', '2', false, true)])]) },
    expect: { verdict: 'rounds-truncated' } },
  { id: 'round:exit-rounds-exhausted', cites: { file: 'skills/review/SKILL.md', section: 'Exits' },
    input: { question: 'round', rounds_cap: null, ledger: LEDGER([1, 2, 3, 4, 5].map((i) => ROUND([FIX('a.mjs', `f${i}`, `${i}`)])).concat([ROUND([FIX('a.mjs', 'f5', '6', false, true)])])) },
    expect: { verdict: 'rounds-exhausted' } },
  { id: 'round:the-guardrail-does-not-stain-a-fixed-point', cites: { file: 'skills/review/SKILL.md', section: 'Exits' },
    input: { question: 'round', rounds_cap: null, ledger: LEDGER([1, 2, 3, 4, 5].map((i) => ROUND([FIX('a.mjs', `f${i}`, `${i}`)])).concat([ROUND([])])) },
    expect: { verdict: 'fixed-point' } },
  { id: 'round:the-guardrail-does-not-stain-a-merit-stop', cites: { file: 'skills/review/SKILL.md', section: 'Exits' },
    input: { question: 'round', rounds_cap: null, merit: 'stop', ledger: LEDGER([1, 2, 3, 4, 5, 6].map((i) => ROUND([FIX('a.mjs', `f${i}`, `${i}`)]))) },
    expect: { verdict: 'diminishing-returns' } },
  { id: 'round:a-cap-above-the-guardrail-replaces-it', cites: { file: 'skills/review/SKILL.md', section: 'Exits' },
    input: { question: 'round', rounds_cap: 8, merit: 'continue', ledger: LEDGER([1, 2, 3, 4, 5, 6].map((i) => ROUND([FIX('a.mjs', `f${i}`, `${i}`)]))) },
    expect: { verdict: 'continue' } },
  { id: 'round:rule-2-a-red-fast-check', cites: { file: 'skills/review/SKILL.md', section: 'When to run another round' },
    input: { question: 'round', rounds_cap: null, merit: 'stop', ledger: LEDGER([ROUND([FIX('a.mjs', 'f', '1')], [], { check_fast: [{ area: 'web', status: 'red', detail: 'tsc: 1 error' }] })]) },
    expect: { verdict: 'continue' } },
  { id: 'round:a-green-fast-check-leaves-the-merit', cites: { file: 'skills/review/SKILL.md', section: 'When to run another round' },
    input: { question: 'round', rounds_cap: null, ledger: LEDGER([ROUND([FIX('a.mjs', 'f', '1')], [], { check_fast: [{ area: 'web', status: 'green', detail: '' }, { area: 'api', status: 'skipped', detail: '' }] })]) },
    expect: { verdict: 'merit' } },
  { id: 'round:a-red-fast-check-at-the-cap-truncates', cites: { file: 'skills/review/SKILL.md', section: 'Exits' },
    input: { question: 'round', rounds_cap: 1, ledger: LEDGER([ROUND([FIX('a.mjs', 'f', '1')], [], { check_fast: [{ area: 'web', status: 'red', detail: 'x' }] })]) },
    expect: { verdict: 'rounds-truncated' } },
  { id: 'round:the-last-round-needs-no-trees-yet', cites: { file: 'skills/review/SKILL.md', section: 'Which disciplines run, at which round' },
    input: { question: 'round', rounds_cap: null, ledger: LEDGER([ROUND([], [], { pre_apply_tree: undefined, post_apply_tree: undefined })]) },
    expect: { verdict: 'fixed-point' } },

  /* --- question: layers — skills/arch-check/SKILL.md § How you verify --- */
  { id: 'layers:a-denied-fragment-in-the-layer', cites: { file: 'skills/arch-check/SKILL.md', section: 'How you verify' },
    input: { question: 'layers', layers: [LAYER()], added: [{ file: 'src/server/api/x.ts', line: 3, text: "import { q } from 'src/server/db/query';" }] },
    expect: { verdict: 'violations', violations_length: 1 } },
  { id: 'layers:a-clean-line', cites: { file: 'skills/arch-check/SKILL.md', section: 'How you verify' },
    input: { question: 'layers', layers: [LAYER()], added: [{ file: 'src/server/api/x.ts', line: 3, text: "import { h } from 'src/server/api/helpers';" }] },
    expect: { verdict: 'clean', violations_length: 0 } },
  { id: 'layers:outside-the-layer-folders', cites: { file: 'skills/arch-check/SKILL.md', section: 'How you verify' },
    input: { question: 'layers', layers: [LAYER()], added: [{ file: 'src/server/db/y.ts', line: 1, text: "import { q } from 'src/server/db/query';" }] },
    expect: { verdict: 'clean' } },
  { id: 'layers:a-bare-substring-counts-in-every-language', cites: { file: 'skills/arch-check/SKILL.md', section: 'How you verify' },
    input: { question: 'layers', layers: [LAYER()], added: [{ file: 'src/server/api/x.py', line: 9, text: 'from src/server/db/query import q' }] },
    expect: { verdict: 'violations', violations_length: 1 } },
  { id: 'layers:backslashes-are-normalised', cites: { file: 'skills/arch-check/SKILL.md', section: 'How you verify' },
    input: { question: 'layers', layers: [LAYER()], added: [{ file: 'src\\server\\api\\x.ts', line: 3, text: "require('src/server/db/query')" }] },
    expect: { verdict: 'violations', violations_length: 1 } },
  { id: 'layers:a-single-star-does-not-cross-folders', cites: { file: 'contracts/project-contract.md', section: 'Area policies are found by paths, and may carry layers' },
    input: { question: 'layers', layers: [LAYER({ folders: ['src/*.ts'] })], added: [{ file: 'src/a/b.ts', line: 1, text: "import 'src/server/db/x'" }] },
    expect: { verdict: 'clean' } },
  { id: 'layers:one-finding-per-violating-line', cites: { file: 'skills/arch-check/SKILL.md', section: 'How you verify' },
    input: { question: 'layers', layers: [LAYER({ deny_imports: ['src/server/db/**', 'src/server/cache'] })], added: [{ file: 'src/server/api/x.ts', line: 3, text: "import 'src/server/db/x'; import 'src/server/cache/y';" }] },
    expect: { verdict: 'violations', violations_length: 1 } },
  { id: 'layers:a-malformed-layer-falls-back-to-the-prose', cites: { file: 'skills/arch-check/SKILL.md', section: 'How you verify' },
    input: { question: 'layers', layers: [LAYER({ deny_imports: [] })], added: [{ file: 'src/server/api/x.ts', line: 3, text: "import 'src/server/db/x'" }] },
    expect: { verdict: 'clean', blockers_include: 'malformed' } },

  /* --- question: block on the brief and on execute — skills/blueprint/SKILL.md and skills/execute/SKILL.md § What you return --- */
  { id: 'block:blueprint-valid', cites: { file: 'skills/blueprint/SKILL.md', section: 'What you return' },
    input: { question: 'block', name: 'blueprint', block: BP_BLOCK() },
    expect: { verdict: 'valid', blockers: [] } },
  { id: 'block:blueprint-failed-with-empty-lists', cites: { file: 'skills/blueprint/SKILL.md', section: 'What you return' },
    input: { question: 'block', name: 'blueprint', block: BP_BLOCK({ ok: false, plan: [], interfaces: [], retired: [], detail: 'no decision-doc' }) },
    expect: { verdict: 'valid' } },
  { id: 'block:blueprint-without-its-plan', cites: { file: 'skills/blueprint/SKILL.md', section: 'What you return' },
    input: { question: 'block', name: 'blueprint', block: (() => { const value = BP_BLOCK(); delete value.plan; return value; })() },
    expect: { verdict: 'invalid', blockers_include: 'plan is missing' } },
  { id: 'block:blueprint-a-list-that-is-not-a-list', cites: { file: 'skills/blueprint/SKILL.md', section: 'What you return' },
    input: { question: 'block', name: 'blueprint', block: BP_BLOCK({ retired: 'none' }) },
    expect: { verdict: 'invalid', blockers_include: 'retired is not an array' } },
  { id: 'block:blueprint-an-empty-plan', cites: { file: 'skills/blueprint/SKILL.md', section: 'Principles' },
    input: { question: 'block', name: 'blueprint', block: BP_BLOCK({ plan: [] }) },
    expect: { verdict: 'invalid', blockers_include: 'plan is empty' } },
  { id: 'block:blueprint-a-task-that-is-not-a-task', cites: { file: 'skills/blueprint/SKILL.md', section: 'What you return' },
    input: { question: 'block', name: 'blueprint', block: BP_BLOCK({ plan: ['Task 1'] }) },
    expect: { verdict: 'invalid', blockers_include: 'plan[0] is not a task' } },
  { id: 'block:blueprint-a-task-without-its-id', cites: { file: 'skills/blueprint/SKILL.md', section: 'What you return' },
    input: { question: 'block', name: 'blueprint', block: BP_BLOCK({ plan: [BP_TASK('')] }) },
    expect: { verdict: 'invalid', blockers_include: 'plan[0].task' } },
  { id: 'block:blueprint-a-repeated-task-id', cites: { file: 'skills/blueprint/SKILL.md', section: 'What you return' },
    input: { question: 'block', name: 'blueprint', block: BP_BLOCK({ plan: [BP_TASK('1'), BP_TASK('1')] }) },
    expect: { verdict: 'invalid', blockers_include: 'repeats an id' } },
  { id: 'block:blueprint-a-task-without-its-check', cites: { file: 'skills/blueprint/SKILL.md', section: 'Principles' },
    input: { question: 'block', name: 'blueprint', block: BP_BLOCK({ plan: [BP_TASK('1', { check: ' ' })] }) },
    expect: { verdict: 'invalid', blockers_include: 'plan[0].check' } },
  { id: 'block:blueprint-a-check-that-names-no-red', cites: { file: 'skills/blueprint/SKILL.md', section: 'Principles' },
    input: { question: 'block', name: 'blueprint', block: BP_BLOCK({ plan: [BP_TASK('1', { red_if: '' })] }) },
    expect: { verdict: 'invalid', blockers_include: 'plan[0].red_if' } },
  { id: 'block:blueprint-cases-not-a-list', cites: { file: 'skills/blueprint/SKILL.md', section: 'Principles' },
    input: { question: 'block', name: 'blueprint', block: BP_BLOCK({ plan: [BP_TASK('1', { cases: 'see the table' })] }) },
    expect: { verdict: 'invalid', blockers_include: 'plan[0].cases is not an array' } },
  { id: 'block:blueprint-a-case-without-its-expected', cites: { file: 'skills/blueprint/SKILL.md', section: 'Principles' },
    input: { question: 'block', name: 'blueprint', block: BP_BLOCK({ plan: [BP_TASK('1', { cases: [{ input: 'a' }] })] }) },
    expect: { verdict: 'invalid', blockers_include: 'plan[0].cases[0]' } },
  { id: 'block:blueprint-an-interface-without-its-seat', cites: { file: 'skills/blueprint/SKILL.md', section: 'Principles' },
    input: { question: 'block', name: 'blueprint', block: BP_BLOCK({ interfaces: [{ symbol: 'x', declared_in: '', consumers: [] }] }) },
    expect: { verdict: 'invalid', blockers_include: 'interfaces[0] needs symbol and declared_in' } },
  { id: 'block:blueprint-consumers-not-strings', cites: { file: 'skills/blueprint/SKILL.md', section: 'Principles' },
    input: { question: 'block', name: 'blueprint', block: BP_BLOCK({ interfaces: [{ symbol: 'x', declared_in: 'a.mjs:1', consumers: [{ file: 'b.mjs' }] }] }) },
    expect: { verdict: 'invalid', blockers_include: 'interfaces[0].consumers' } },
  { id: 'block:blueprint-a-retired-fact-without-its-search', cites: { file: 'skills/blueprint/SKILL.md', section: 'Principles' },
    input: { question: 'block', name: 'blueprint', block: BP_BLOCK({ retired: [{ fact: 'the retired wording' }] }) },
    expect: { verdict: 'invalid', blockers_include: 'retired[0]' } },
  { id: 'block:execute-valid', cites: { file: 'skills/execute/SKILL.md', section: 'What you return' },
    input: { question: 'block', name: 'execute', block: EX_BLOCK() },
    expect: { verdict: 'valid', blockers: [] } },
  { id: 'block:execute-a-replaced-task', cites: { file: 'skills/execute/SKILL.md', section: 'What you return' },
    input: { question: 'block', name: 'execute', block: EX_BLOCK({ checks: [{ task: '0', check: 'x', exit: 0 }, { task: '1', replaced: 'the probe showed the hook already exists' }] }) },
    expect: { verdict: 'valid' } },
  { id: 'block:execute-without-its-evidence', cites: { file: 'skills/execute/SKILL.md', section: 'What you return' },
    input: { question: 'block', name: 'execute', block: { ok: true, note_review_path: 'x/4. review-notes.md', verify_detail: 'green', detail: '' } },
    expect: { verdict: 'invalid', blockers_include: 'red_proofs is missing' } },
  { id: 'block:execute-a-list-that-is-not-a-list', cites: { file: 'skills/execute/SKILL.md', section: 'What you return' },
    input: { question: 'block', name: 'execute', block: EX_BLOCK({ absence: {} }) },
    expect: { verdict: 'invalid', blockers_include: 'absence is not an array' } },
  { id: 'block:execute-a-check-row-without-its-task', cites: { file: 'skills/execute/SKILL.md', section: 'What you return' },
    input: { question: 'block', name: 'execute', block: EX_BLOCK({ checks: [{ check: 'x', exit: 0 }] }) },
    expect: { verdict: 'invalid', blockers_include: 'checks[0].task' } },
  { id: 'block:execute-a-task-rerun-twice', cites: { file: 'skills/execute/SKILL.md', section: 'What you return' },
    input: { question: 'block', name: 'execute', block: EX_BLOCK({ checks: [{ task: '1', check: 'x', exit: 0 }, { task: '1', check: 'x', exit: 0 }] }) },
    expect: { verdict: 'invalid', blockers_include: 'repeats a task' } },
  { id: 'block:execute-a-replaced-task-without-its-why', cites: { file: 'skills/execute/SKILL.md', section: 'What you return' },
    input: { question: 'block', name: 'execute', block: EX_BLOCK({ checks: [{ task: '1', replaced: '' }] }) },
    expect: { verdict: 'invalid', blockers_include: 'replaced is empty' } },
  { id: 'block:execute-a-check-without-its-exit', cites: { file: 'skills/execute/SKILL.md', section: 'What you return' },
    input: { question: 'block', name: 'execute', block: EX_BLOCK({ checks: [{ task: '1', check: 'x', exit: 'green' }] }) },
    expect: { verdict: 'invalid', blockers_include: 'integer exit' } },
  { id: 'block:execute-a-proof-without-its-test', cites: { file: 'skills/execute/SKILL.md', section: 'Principles' },
    input: { question: 'block', name: 'execute', block: EX_BLOCK({ red_proofs: [{ task: '1', against: 'base', exit: 1, red_output: 'x' }] }) },
    expect: { verdict: 'invalid', blockers_include: 'red_proofs[0] needs test' } },
  { id: 'block:execute-a-proof-that-exited-green', cites: { file: 'skills/execute/SKILL.md', section: 'Principles' },
    input: { question: 'block', name: 'execute', block: EX_BLOCK({ red_proofs: [{ test: 't::c', task: '1', against: 'base', exit: 0, red_output: 'ok' }] }) },
    expect: { verdict: 'invalid', blockers_include: 'non-zero' } },
  { id: 'block:execute-a-proof-without-its-output', cites: { file: 'skills/execute/SKILL.md', section: 'Principles' },
    input: { question: 'block', name: 'execute', block: EX_BLOCK({ red_proofs: [{ test: 't::c', task: '1', against: 'mutation', exit: 1, red_output: '' }] }) },
    expect: { verdict: 'invalid', blockers_include: 'red_output is empty' } },
  { id: 'block:execute-a-proof-against-a-guess', cites: { file: 'skills/execute/SKILL.md', section: 'What you return' },
    input: { question: 'block', name: 'execute', block: EX_BLOCK({ red_proofs: [{ test: 't::c', task: '1', against: 'imagined', exit: 1, red_output: 'x' }] }) },
    expect: { verdict: 'invalid', blockers_include: 'red_proofs.against' } },
  { id: 'block:execute-a-consumer-without-its-check', cites: { file: 'skills/execute/SKILL.md', section: 'Principles' },
    input: { question: 'block', name: 'execute', block: EX_BLOCK({ consumers_checked: [{ consumer: 'a.mjs:1', exit: 0 }] }) },
    expect: { verdict: 'invalid', blockers_include: 'consumers_checked[0]' } },
  { id: 'block:execute-a-count-that-is-not-a-count', cites: { file: 'skills/execute/SKILL.md', section: 'Principles' },
    input: { question: 'block', name: 'execute', block: EX_BLOCK({ absence: [{ pattern: 'the retired wording', hits: 'none', why: '' }] }) },
    expect: { verdict: 'invalid', blockers_include: 'absence[0] needs pattern and hits' } },
  { id: 'block:execute-hits-left-without-a-why', cites: { file: 'skills/execute/SKILL.md', section: 'Principles' },
    input: { question: 'block', name: 'execute', block: EX_BLOCK({ absence: [{ pattern: 'the retired wording', hits: 2, why: '' }] }) },
    expect: { verdict: 'invalid', blockers_include: 'every hit left is answered for' } },
  { id: 'block:execute-a-preflight-row-without-its-outcome', cites: { file: 'skills/execute/SKILL.md', section: 'Principles' },
    input: { question: 'block', name: 'execute', block: EX_BLOCK({ preflight: [...EX_BLOCK().preflight, { step: 'layers', area: 'core', detail: '' }] }) },
    expect: { verdict: 'invalid', blockers_include: 'needs step, outcome and detail' } },
  { id: 'block:execute-a-skip-that-says-nothing', cites: { file: 'skills/execute/SKILL.md', section: 'Principles' },
    input: { question: 'block', name: 'execute', block: EX_BLOCK({ preflight: EX_BLOCK().preflight.map((row) => (row.step === 'check_fast' ? { ...row, outcome: 'skipped' } : row)) }) },
    expect: { verdict: 'invalid', blockers_include: 'is skipped with no detail' } },
  { id: 'block:execute-a-quick-check-never-run', cites: { file: 'skills/execute/SKILL.md', section: 'Principles' },
    input: { question: 'block', name: 'execute', block: EX_BLOCK({ preflight: EX_BLOCK().preflight.filter((row) => row.step !== 'layers') }) },
    expect: { verdict: 'invalid', blockers_include: 'preflight has no layers row' } },

  /* --- question: handoff — skills/develop-feature/SKILL.md § The handoff --- */
  { id: 'handoff:ready', cites: { file: 'skills/develop-feature/SKILL.md', section: 'The handoff' },
    input: HANDOFF(),
    expect: { verdict: 'ready', blockers: [] } },
  { id: 'handoff:a-replaced-task-is-answered-for', cites: { file: 'skills/develop-feature/SKILL.md', section: 'The handoff' },
    input: HANDOFF({ notes: EX_BLOCK({ checks: [{ task: '0', check: 'x', exit: 0 }, { task: '1', check: 'x', exit: 0 }, { task: '2', replaced: 'merged into task 1' }] }) }),
    expect: { verdict: 'ready' } },
  { id: 'handoff:a-task-dropped-without-a-row', cites: { file: 'skills/develop-feature/SKILL.md', section: 'The handoff' },
    input: HANDOFF({ notes: EX_BLOCK({ checks: [{ task: '0', check: 'x', exit: 0 }, { task: '1', check: 'x', exit: 0 }] }) }),
    expect: { verdict: 'not-ready', blockers_include: 'task 2: its check was not rerun' } },
  { id: 'handoff:a-check-red-on-the-final-tree', cites: { file: 'skills/execute/SKILL.md', section: 'Principles' },
    input: HANDOFF({ notes: EX_BLOCK({ checks: [{ task: '0', check: 'x', exit: 0 }, { task: '1', check: 'x', exit: 0 }, { task: '2', check: 'x', exit: 0 }, { task: '3', check: 'added by execute', exit: 1 }] }) }),
    expect: { verdict: 'not-ready', blockers_include: 'task 3: its check is red' } },
  { id: 'handoff:a-behaviour-change-never-seen-red', cites: { file: 'skills/blueprint/SKILL.md', section: 'Principles' },
    input: HANDOFF({ notes: EX_BLOCK({ red_proofs: [] }) }),
    expect: { verdict: 'not-ready', blockers_include: 'task 1: it changes behaviour' } },
  { id: 'handoff:a-proof-on-a-file-the-diff-does-not-write', cites: { file: 'skills/execute/SKILL.md', section: 'Principles' },
    input: HANDOFF({ diff_files: ['architect/architect.mjs', 'skills/execute/SKILL.md'] }),
    expect: { verdict: 'not-ready', blockers_include: 'is not in the diff' } },
  { id: 'handoff:a-mapped-consumer-never-checked', cites: { file: 'skills/blueprint/SKILL.md', section: 'Principles' },
    input: HANDOFF({ notes: EX_BLOCK({ consumers_checked: [] }) }),
    expect: { verdict: 'not-ready', blockers_include: 'has no check' } },
  { id: 'handoff:a-mapped-consumer-checked-red', cites: { file: 'skills/blueprint/SKILL.md', section: 'Principles' },
    input: HANDOFF({ notes: EX_BLOCK({ consumers_checked: [{ consumer: 'architect/architect.mjs:900', check: 'x', exit: 2 }] }) }),
    expect: { verdict: 'not-ready', blockers_include: 'is red (exit 2)' } },
  { id: 'handoff:a-consumer-nobody-mapped', cites: { file: 'skills/develop-feature/SKILL.md', section: 'The handoff' },
    input: HANDOFF({}, { consumers: [{ symbol: 'red_proofs', files: ['skills/execute/SKILL.md', 'architect/architect.mjs', 'skills/review/SKILL.md'] }] }),
    expect: { verdict: 'not-ready', blockers_include: 'skills/review/SKILL.md names it' } },
  { id: 'handoff:an-unmapped-consumer-execute-checked', cites: { file: 'skills/execute/SKILL.md', section: 'Principles' },
    input: HANDOFF({ notes: EX_BLOCK({ consumers_checked: [...EX_BLOCK().consumers_checked, { consumer: 'skills/review/SKILL.md', check: 'x', exit: 0 }] }) }, { consumers: [{ symbol: 'red_proofs', files: ['skills/execute/SKILL.md', 'architect/architect.mjs', 'skills/review/SKILL.md'] }] }),
    expect: { verdict: 'ready' } },
  { id: 'handoff:a-retired-fact-never-searched', cites: { file: 'skills/blueprint/SKILL.md', section: 'Principles' },
    input: HANDOFF({ notes: EX_BLOCK({ absence: [] }) }),
    expect: { verdict: 'not-ready', blockers_include: 'no search recorded' } },
  { id: 'handoff:a-count-the-measurement-contradicts', cites: { file: 'skills/develop-feature/SKILL.md', section: 'The handoff' },
    input: HANDOFF({}, { absence: [{ pattern: 'the retired wording', hits: 2 }] }),
    expect: { verdict: 'not-ready', blockers_include: 'the measurement holds' } },
  { id: 'handoff:hits-left-and-answered-for', cites: { file: 'skills/execute/SKILL.md', section: 'Principles' },
    input: HANDOFF({ notes: EX_BLOCK({ absence: [{ pattern: 'the retired wording', hits: 1, why: 'the changelog keeps the old entry' }] }) }, { absence: [{ pattern: 'the retired wording', hits: 1 }] }),
    expect: { verdict: 'ready' } },
  { id: 'handoff:a-quick-check-red', cites: { file: 'skills/execute/SKILL.md', section: 'Principles' },
    input: HANDOFF({ notes: EX_BLOCK({ preflight: EX_BLOCK().preflight.map((row) => (row.step === 'check_fast' ? { ...row, outcome: 'red', detail: 'tsc: 1 error' } : row)) }) }),
    expect: { verdict: 'not-ready', blockers_include: 'preflight check_fast on core is red' } },
  { id: 'handoff:a-skipped-quick-check-is-not-a-block', cites: { file: 'contracts/project-contract.md', section: '6. Degradation' },
    input: HANDOFF({ notes: EX_BLOCK({ preflight: EX_BLOCK().preflight.map((row) => (row.step === 'layers' ? { ...row, outcome: 'skipped', detail: 'no policy carries layers:' } : row)) }) }),
    expect: { verdict: 'ready' } },
  { id: 'handoff:a-task-left-open', cites: { file: 'skills/develop-feature/SKILL.md', section: 'The handoff' },
    input: HANDOFF({}, { open_tasks: ['   - [~] Task 2: wire the caller'] }),
    expect: { verdict: 'not-ready', blockers_include: 'task still open in the brief: - [~] Task 2' } },
  { id: 'handoff:every-missing-piece-is-listed', cites: { file: 'skills/develop-feature/SKILL.md', section: 'The handoff' },
    input: HANDOFF({ notes: EX_BLOCK({ red_proofs: [], consumers_checked: [], absence: [] }) }, { open_tasks: ['- [ ] Task 2: x'] }),
    expect: { verdict: 'not-ready', blockers_length_at_least: 4 } },

  /* --- question: block — skills/decision-doc/SKILL.md § The block you return, skills/new-feature/SKILL.md § 7 --- */
  { id: 'block:decision-doc-technical', cites: { file: 'skills/decision-doc/SKILL.md', section: 'The block you return' },
    input: { question: 'block', name: 'decision-doc', block: DOC() },
    expect: { verdict: 'valid', blockers: [] } },
  { id: 'block:decision-doc-strategic', cites: { file: 'skills/decision-doc/SKILL.md', section: 'The block you return' },
    input: { question: 'block', name: 'decision-doc', block: DOC({ stage: 'strategic' }, { classification: 'weakness' }) },
    expect: { verdict: 'valid' } },
  { id: 'block:decision-doc-no-decision-left', cites: { file: 'skills/decision-doc/SKILL.md', section: 'The block you return' },
    input: { question: 'block', name: 'decision-doc', block: DOC({ decisions: null }) },
    expect: { verdict: 'valid' } },
  { id: 'block:decision-doc-a-missing-field', cites: { file: 'skills/decision-doc/SKILL.md', section: 'The block you return' },
    input: { question: 'block', name: 'decision-doc', block: (() => { const value = DOC(); delete value.open_items; return value; })() },
    expect: { verdict: 'invalid', blockers_include: 'open_items is missing' } },
  { id: 'block:decision-doc-recommended-is-not-a', cites: { file: 'skills/new-feature/SKILL.md', section: '7. Decisions are asked in chat' },
    input: { question: 'block', name: 'decision-doc', block: DOC({}, { recommended_id: 'B' }) },
    expect: { verdict: 'invalid', blockers_include: 'recommended_id' } },
  { id: 'block:decision-doc-a-skipped-letter', cites: { file: 'skills/new-feature/SKILL.md', section: '7. Decisions are asked in chat' },
    input: { question: 'block', name: 'decision-doc', block: DOC({}, { options: [{ id: 'A', text: 'a' }, { id: 'C', text: 'c' }] }) },
    expect: { verdict: 'invalid', blockers_include: 'options[1].id' } },
  { id: 'block:decision-doc-one-option', cites: { file: 'skills/new-feature/SKILL.md', section: '7. Decisions are asked in chat' },
    input: { question: 'block', name: 'decision-doc', block: DOC({}, { options: [{ id: 'A', text: 'a' }] }) },
    expect: { verdict: 'invalid', blockers_include: '2 to 4' } },
  { id: 'block:decision-doc-five-options', cites: { file: 'skills/new-feature/SKILL.md', section: '7. Decisions are asked in chat' },
    input: { question: 'block', name: 'decision-doc', block: DOC({}, { options: ['A', 'B', 'C', 'D', 'E'].map((id) => ({ id, text: id })) }) },
    expect: { verdict: 'invalid', blockers_include: '2 to 4' } },
  { id: 'block:decision-doc-decisions-not-a-list', cites: { file: 'skills/new-feature/SKILL.md', section: '7. Decisions are asked in chat' },
    input: { question: 'block', name: 'decision-doc', block: DOC({ decisions: 'see the document' }) },
    expect: { verdict: 'invalid', blockers_include: 'neither an array nor null' } },
  { id: 'block:decision-doc-stage-outside-its-domain', cites: { file: 'skills/decision-doc/SKILL.md', section: 'The block you return' },
    input: { question: 'block', name: 'decision-doc', block: DOC({ stage: 'tactical' }) },
    expect: { verdict: 'invalid', blockers_include: 'outside' } },
  { id: 'block:decision-doc-classification-at-the-technical-stage', cites: { file: 'skills/decision-doc/SKILL.md', section: 'The block you return' },
    input: { question: 'block', name: 'decision-doc', block: DOC({}, { classification: 'weakness' }) },
    expect: { verdict: 'invalid', blockers_include: 'technical stage' } },
  { id: 'block:decision-doc-classification-outside-its-domain', cites: { file: 'skills/decision-doc/SKILL.md', section: 'The block you return' },
    input: { question: 'block', name: 'decision-doc', block: DOC({ stage: 'strategic' }, { classification: 'nice to have' }) },
    expect: { verdict: 'invalid', blockers_include: 'outside' } },
  { id: 'block:nothing-came-back', cites: { file: 'contracts/orchestration.md', section: '4. Delegation' },
    input: { question: 'block', name: 'decision-doc', block: null },
    expect: { verdict: 'invalid', blockers_length_at_least: 1 } },
  { id: 'block:another-block-by-its-schema-alone', cites: { file: 'skills/develop-feature/SKILL.md', section: '7. Report' },
    input: { question: 'block', name: 'develop-feature-report', block: { ok: true, report_path: 'x/5. review-report.md', detail: '' } },
    expect: { verdict: 'valid' } },
  { id: 'block:an-enum-inside-a-list', cites: { file: 'skills/finder-prompt/SKILL.md', section: 'The block you return' },
    input: { question: 'block', name: 'finder', block: { findings: [{ file: 'a', line: 1, symbol: 'f', confidence: 'certain', change: '', description: '' }] } },
    expect: { verdict: 'invalid', blockers_include: 'findings.confidence' } },
  { id: 'block:applier-every-finding-has-one-outcome', cites: { file: 'skills/applier/SKILL.md', section: 'The block you return' },
    input: { question: 'block', name: 'applier', finding_ids: ['r1-bug-1', 'r1-bug-2', 'r1-arch-1'], block: APPLIER({ applied: [OUTCOME('r1-bug-1', { anchor: 'x', severe: false, on_previous_fix: false })], discarded: [OUTCOME('r1-bug-2', { why: 'not real' })], to_confirm: [OUTCOME('r1-arch-1', { class: 'arch', blocking: false, scenario: 'x' })] }) },
    expect: { verdict: 'valid', blockers: [] } },
  { id: 'block:applier-one-finding-fixed-in-several-sites', cites: { file: 'skills/applier/SKILL.md', section: 'How you work' },
    input: { question: 'block', name: 'applier', finding_ids: ['r1-bug-1'], block: APPLIER({ applied: [OUTCOME('r1-bug-1', { anchor: 'x' }), OUTCOME('r1-bug-1', { file: 'b.mjs', anchor: 'y' })] }) },
    expect: { verdict: 'valid' } },
  { id: 'block:applier-an-oscillation-recorded-as-discarded', cites: { file: 'skills/applier/SKILL.md', section: 'How you work' },
    input: { question: 'block', name: 'applier', finding_ids: ['r3-bug-1'], block: APPLIER({ discarded: [OUTCOME('r3-bug-1', { why: 'oscillation' })], oscillation: [OUTCOME('r3-bug-1', { current_anchor: 'x = 1', previous_anchor: 'x = 2' })] }) },
    expect: { verdict: 'valid' } },
  { id: 'block:applier-a-finding-with-no-outcome', cites: { file: 'skills/applier/SKILL.md', section: 'The block you return' },
    input: { question: 'block', name: 'applier', finding_ids: ['r1-bug-1', 'r1-bug-2'], block: APPLIER({ applied: [OUTCOME('r1-bug-1', { anchor: 'x' })] }) },
    expect: { verdict: 'invalid', blockers_include: 'r1-bug-2 has no outcome' } },
  { id: 'block:applier-a-finding-with-two-outcomes', cites: { file: 'skills/applier/SKILL.md', section: 'The block you return' },
    input: { question: 'block', name: 'applier', finding_ids: ['r1-bug-1'], block: APPLIER({ applied: [OUTCOME('r1-bug-1', { anchor: 'x' })], discarded: [OUTCOME('r1-bug-1', { why: 'x' })] }) },
    expect: { verdict: 'invalid', blockers_include: 'more than one outcome' } },
  { id: 'block:applier-a-finding-discarded-twice', cites: { file: 'skills/applier/SKILL.md', section: 'The block you return' },
    input: { question: 'block', name: 'applier', finding_ids: ['r1-bug-1'], block: APPLIER({ discarded: [OUTCOME('r1-bug-1', { why: 'x' }), OUTCOME('r1-bug-1', { why: 'y' })] }) },
    expect: { verdict: 'invalid', blockers_include: 'listed 2 times' } },
  { id: 'block:applier-an-invented-finding', cites: { file: 'skills/applier/SKILL.md', section: 'The block you return' },
    input: { question: 'block', name: 'applier', finding_ids: ['r1-bug-1'], block: APPLIER({ applied: [OUTCOME('r1-bug-1', { anchor: 'x' }), OUTCOME('r1-bug-9', { anchor: 'y' })] }) },
    expect: { verdict: 'invalid', blockers_include: 'not a finding that was handed over' } },
  { id: 'block:applier-an-item-that-names-no-finding', cites: { file: 'skills/applier/SKILL.md', section: 'The block you return' },
    input: { question: 'block', name: 'applier', finding_ids: ['r1-bug-1'], block: APPLIER({ applied: [OUTCOME('r1-bug-1', { anchor: 'x' })], to_confirm: [{ file: 'a.mjs', line: 1, class: 'bug', blocking: true, scenario: 'x' }] }) },
    expect: { verdict: 'invalid', blockers_include: 'to_confirm[0].finding_id is missing' } },
  { id: 'block:applier-an-oscillation-that-was-applied', cites: { file: 'skills/applier/SKILL.md', section: 'How you work' },
    input: { question: 'block', name: 'applier', finding_ids: ['r3-bug-1'], block: APPLIER({ applied: [OUTCOME('r3-bug-1', { anchor: 'x = 1' })], oscillation: [OUTCOME('r3-bug-1', { current_anchor: 'x = 1', previous_anchor: 'x = 2' })] }) },
    expect: { verdict: 'invalid', blockers_include: 'not among the discarded' } },
  { id: 'block:applier-a-list-that-is-not-a-list', cites: { file: 'skills/applier/SKILL.md', section: 'The block you return' },
    input: { question: 'block', name: 'applier', finding_ids: ['r1-bug-1'], block: APPLIER({ discarded: [OUTCOME('r1-bug-1', { why: 'x' })], to_confirm: 'none' }) },
    expect: { verdict: 'invalid', blockers_include: 'to_confirm is not an array' } },
  { id: 'block:finder-findings-not-a-list', cites: { file: 'skills/finder-prompt/SKILL.md', section: 'The block you return' },
    input: { question: 'block', name: 'finder', block: { findings: 'nothing to report' } },
    expect: { verdict: 'invalid', blockers_include: 'findings is not an array' } },
  { id: 'block:finder-a-finding-without-its-file', cites: { file: 'skills/finder-prompt/SKILL.md', section: 'The block you return' },
    input: { question: 'block', name: 'finder', block: { findings: [{ line: 3, symbol: 'f', confidence: 'high', change: 'x', description: 'y' }] } },
    expect: { verdict: 'invalid', blockers_include: 'findings[0].file' } },
];

/** The input that must be refused loudly. Nothing here is a verdict. */
const REJECTED = [
  { id: 'reject:handoff-brief-absent', input: (() => { const input = HANDOFF(); delete input.brief; return input; })() },
  { id: 'reject:handoff-brief-malformed', input: HANDOFF({ brief: BP_BLOCK({ plan: [BP_TASK('1', { red_if: '' })] }) }) },
  { id: 'reject:handoff-on-a-failed-execute', input: HANDOFF({ notes: EX_BLOCK({ ok: false, detail: 'stopped at task 2' }) }) },
  { id: 'reject:handoff-diff-files-not-a-list', input: HANDOFF({ diff_files: 'architect/architect.mjs' }) },
  { id: 'reject:handoff-measured-absent', input: (() => { const input = HANDOFF(); delete input.measured; return input; })() },
  { id: 'reject:handoff-measured-counts-not-counts', input: HANDOFF({}, { absence: [{ pattern: 'the retired wording', hits: -1 }] }) },
  { id: 'reject:handoff-measured-files-not-a-list', input: HANDOFF({}, { consumers: [{ symbol: 'red_proofs', files: 'a.mjs' }] }) },
  { id: 'reject:handoff-open-tasks-not-a-list', input: HANDOFF({}, { open_tasks: 0 }) },
  { id: 'reject:handoff-an-interface-nobody-searched', input: HANDOFF({}, { consumers: [] }) },
  { id: 'reject:handoff-a-retired-fact-nobody-searched', input: HANDOFF({}, { absence: [] }) },
  { id: 'reject:unknown-question', input: { question: 'invented', entry: 'new-feature', present: [] } },
  { id: 'reject:unknown-entry', input: { question: 'order', entry: 'invented', present: [], ledger: null } },
  { id: 'reject:present-not-a-list', input: { question: 'order', entry: 'new-feature', present: 'x', ledger: null } },
  { id: 'reject:review-outcome-absent', input: { question: 'decision' } },
  { id: 'reject:gate-outside-its-domain', input: { question: 'decision', review_outcome: GREEN({ gate: 'yellow' }) } },
  { id: 'reject:outcome-outside-its-domain', input: { question: 'decision', review_outcome: GREEN({ outcome: 'converged' }) } },
  { id: 'reject:missing-disciplines-not-a-list', input: { question: 'decision', review_outcome: GREEN({ missing_disciplines: 'arch' }) } },
  { id: 'reject:step-absent', input: { question: 'propagation' } },
  { id: 'reject:attempt-outside-the-ceiling', input: { question: 'propagation', step: { node: 'brief', block: null, attempt: 3 } } },
  { id: 'reject:round-without-ledger', input: { question: 'round', rounds_cap: null } },
  { id: 'reject:round-with-no-round', input: { question: 'round', rounds_cap: null, ledger: LEDGER([]) } },
  { id: 'reject:round-cap-absent', input: { question: 'round', ledger: LEDGER([ROUND([])]) } },
  { id: 'reject:round-cap-not-positive', input: { question: 'round', rounds_cap: 0, ledger: LEDGER([ROUND([])]) } },
  { id: 'reject:round-merit-outside-its-domain', input: { question: 'round', rounds_cap: null, merit: 'maybe', ledger: LEDGER([ROUND([])]) } },
  { id: 'reject:round-numbered-with-a-gap', input: { question: 'round', rounds_cap: null, ledger: { base: 'a', item: 'b', rounds: [{ n: 2, applied: [], oscillation: [] }] } } },
  { id: 'reject:round-fix-without-its-severity', input: { question: 'round', rounds_cap: null, ledger: LEDGER([ROUND([{ file: 'a', symbol: 'f', anchor: 'x' }])]) } },
  { id: 'reject:round-after-a-round-without-its-trees', input: { question: 'round', rounds_cap: null, ledger: LEDGER([ROUND([FIX('a.mjs', 'f', '1')], [], { pre_apply_tree: null, post_apply_tree: null }), ROUND([])]) } },
  { id: 'reject:round-after-a-round-without-its-post-tree', input: { question: 'round', rounds_cap: null, ledger: LEDGER([ROUND([FIX('a.mjs', 'f', '1')], [], { post_apply_tree: '' }), ROUND([])]) } },
  { id: 'reject:round-fast-check-outside-its-domain', input: { question: 'round', rounds_cap: null, ledger: LEDGER([ROUND([FIX('a.mjs', 'f', '1')], [], { check_fast: [{ area: 'web', status: 'yellow' }] })]) } },
  { id: 'reject:round-fast-check-not-a-list', input: { question: 'round', rounds_cap: null, ledger: LEDGER([ROUND([FIX('a.mjs', 'f', '1')], [], { check_fast: 'red' })]) } },
  { id: 'reject:block-applier-without-its-finding-ids', input: { question: 'block', name: 'applier', block: { applied: [], discarded: [], to_confirm: [], oscillation: [] } } },
  { id: 'reject:block-applier-with-repeated-finding-ids', input: { question: 'block', name: 'applier', finding_ids: ['r1-bug-1', 'r1-bug-1'], block: { applied: [], discarded: [], to_confirm: [], oscillation: [] } } },
  { id: 'reject:layers-absent', input: { question: 'layers', added: [] } },
  { id: 'reject:added-not-a-list', input: { question: 'layers', layers: [], added: 'x' } },
  { id: 'reject:added-row-without-its-line', input: { question: 'layers', layers: [], added: [{ file: 'a', text: 'x' }] } },
  { id: 'reject:block-name-absent', input: { question: 'block', block: {} } },
  { id: 'reject:block-name-unknown', input: { question: 'block', name: 'invented', block: {} } },
  { id: 'reject:block-absent', input: { question: 'block', name: 'decision-doc' } },
];

/** Calls in prose the doc-test must read right, one per way it can go: the proofs it can fail. */
const DOC_CALLS = [
  { id: 'every-key-named', question: 'round', text: 'call the evaluator with `question: "round"`, the `ledger` and `rounds_cap` (the `N`, or `null`).', unnamed: [] },
  { id: 'a-key-named-as-a-word', question: 'resumption', text: 'with `question: "resumption"`, the ledger you were handed (or `null`), the artefacts present and the entry point.', unnamed: [] },
  { id: 'a-key-left-out', question: 'order', text: 'with `question: "order"`, `entry: "new-feature"` and `present` (the artefacts already on disk).', unnamed: ['ledger'] },
  { id: 'the-question-does-not-name-its-key', question: 'block', text: 'ask it with `question: "block"` and `name: "decision-doc"` whether the shape holds.', unnamed: ['block'] },
  { id: 'an-unknown-question', question: 'invented', text: 'call the evaluator with `question: "invented"`.', unnamed: ['the question itself, which REQUIRES does not know'] },
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

  /* 2b. Every block whose prose rules live in SHAPES is a block schemas/blocks.json declares. */
  let declared = {};
  try {
    declared = JSON.parse(readFileSync(join(root, 'schemas', 'blocks.json'), 'utf-8')).blocks || {};
  } catch (error) {
    check('schemas:readable', false, error.message);
  }
  for (const name of Object.keys(SHAPES)) {
    check(`shape:${name}`, Object.prototype.hasOwnProperty.call(declared, name), 'a shape for a block schemas/blocks.json does not declare');
  }
  const verdicts = (declared.architect && declared.architect.enums && declared.architect.enums.verdict) || [];
  for (const verdict of new Set(CASES.map((testCase) => testCase.expect.verdict).filter((value) => typeof value === 'string'))) {
    check(`schema:verdict:${verdict}`, verdicts.includes(verdict), 'a verdict the program returns and schemas/blocks.json § architect does not list');
  }
  const steps = (declared.execute && declared.execute.enums && declared.execute.enums['preflight.step']) || [];
  check(
    'schema:preflight-steps',
    [...steps].sort().join(',') === [...PREFLIGHT_STEPS].sort().join(','),
    `the program requires [${PREFLIGHT_STEPS.join(', ')}], schemas/blocks.json § execute lists [${steps.join(', ')}]`
  );

  /* 3. One proof per case, each citing the file and section its rule comes from. */
  for (const testCase of CASES) {
    check(`cites:${testCase.id}`, cites(root, testCase.cites), `no heading for '${testCase.cites.section}' in ${testCase.cites.file}`);
    let got;
    try {
      got = dispatch(testCase.input, root);
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
      dispatch(parsed, root);
    } catch (error) {
      refused = error instanceof BadInput;
    }
    check(`reject:${rejected.id.replace(/^reject:/, '')}`, refused, 'it answered instead of failing loudly');
  }

  /* 4b. REQUIRES: one row per question and no other, and every key of a row refused when it is
     missing — the input of the first case asking that question, with that key taken away. */
  for (const question of new Set([...Object.keys(ASKS), ...Object.keys(REQUIRES)])) {
    check(`requires:row:${question}`, Object.prototype.hasOwnProperty.call(ASKS, question) && Object.prototype.hasOwnProperty.call(REQUIRES, question), 'a question and its REQUIRES row go together');
    const sample = CASES.find((testCase) => testCase.input.question === question);
    check(`requires:sample:${question}`, !!sample, 'no case asks this question, so no key of it can be proven required');
    if (!sample) continue;
    for (const key of REQUIRES[question] || []) {
      const input = { ...sample.input };
      delete input[key];
      let refused = false;
      try {
        dispatch(input, root);
      } catch (error) {
        refused = error instanceof BadInput;
      }
      check(`requires:${question}.${key}`, refused, 'the key was taken away and the question answered anyway');
    }
    // And the row is complete: a key the question itself refuses to go without is in its row.
    for (const key of Object.keys(sample.input).filter((name) => name !== 'question' && !(REQUIRES[question] || []).includes(name))) {
      const input = { ...sample.input };
      delete input[key];
      let refused = false;
      try {
        ASKS[question](input, root);
      } catch (error) {
        refused = error instanceof BadInput;
      }
      check(`requires:complete:${question}.${key}`, !refused, 'the question refuses an input without this key, and its REQUIRES row does not list it');
    }
  }

  /* 4c. Every call to the evaluator written in the contracts of skills/ names the keys REQUIRES
     declares for its question — the prose a caller follows is the input it builds. */
  let skillFiles = [];
  try {
    skillFiles = readdirSync(join(root, 'skills'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `skills/${entry.name}/SKILL.md`)
      .sort();
  } catch (error) {
    check('skills:readable', false, error.message);
  }
  let calls = 0;
  for (const rel of skillFiles) {
    let lines;
    try {
      lines = readLines(root, rel);
    } catch {
      continue;
    }
    lines.forEach((line, at) => {
      for (const found of line.matchAll(/question:\s*"([^"]+)"/g)) {
        calls += 1;
        const unnamed = unnamedKeys(paragraphAt(lines, at), found[1]);
        check(`doc:${rel}:${at + 1}:${found[1]}`, unnamed.length === 0, `the call does not name ${unnamed.join(', ')}`);
      }
    });
  }
  check('doc:calls-read', calls > 0, 'no call to the evaluator was found in skills/: the doc-test read nothing');
  for (const call of DOC_CALLS) {
    const got = unnamedKeys(call.text, call.question);
    check(`doc-fixture:${call.id}`, JSON.stringify(got) === JSON.stringify(call.unnamed), `got [${got.join(', ')}]`);
  }

  /* 4d. isEntry: the guard that decides whether main() runs, exercised through a fake
     `toRealPath` so no case here needs a real symlink — creating one needs privileges on
     Windows, where this package runs. */
  check(
    'entry:symlink-resolves',
    isEntry('/proj/bin/architect', '/proj/architect/architect.mjs', () => '/proj/architect/architect.mjs'),
    'a path that resolves, through a link, to this file must run main()'
  );
  check(
    'entry:other-file',
    !isEntry('/proj/bin/other.mjs', '/proj/architect/architect.mjs', (path) => path),
    'a different file must not run main()'
  );
  check(
    'entry:empty-argv',
    !isEntry('', '/proj/architect/architect.mjs', () => {
      throw new Error('toRealPath must not run when argv[1] is empty');
    }),
    'no argv[1] must not run main(), and must not touch the filesystem'
  );
  check(
    'entry:win32-case-insensitive',
    isEntry(
      'C:\\proj\\bin\\ARCHITECT.MJS',
      'C:\\proj\\architect\\architect.mjs',
      () => 'c:\\PROJ\\ARCHITECT\\architect.mjs',
      'win32'
    ),
    'win32 compares the resolved path case-insensitively'
  );
  check(
    'entry:win32-different-path',
    !isEntry(
      'C:\\proj\\bin\\other.mjs',
      'C:\\proj\\architect\\architect.mjs',
      () => 'c:\\proj\\bin\\OTHER.MJS',
      'win32'
    ),
    'a different path on win32 must not run main() even case-folded'
  );

  /* 5. never_red: every rule written through rule() was seen failing on some fixture above. A
     rule no case turns red passes on broken code too, and nothing else would say so. */
  let source = '';
  try {
    source = readFileSync(join(root, 'architect', 'architect.mjs'), 'utf-8');
  } catch (error) {
    check('source:readable', false, error.message);
  }
  const ruleIds = new Set([
    ...[...source.matchAll(/\brule\('([^']+)'/g)].map((found) => found[1]),
    ...Object.entries(REQUIRES).flatMap(([question, keys]) => keys.map((key) => `requires:${question}.${key}`)),
  ]);
  // Counted as checks, reported apart: `hooks/self-check.mjs` turns a non-empty never_red red.
  const neverRed = [];
  for (const id of [...ruleIds].sort()) {
    checks.push(`seen-red:${id}`);
    if ((SEEN.get(id) || {}).failed !== true) neverRed.push(id);
  }

  const passed = checks.length - failed.length - neverRed.length;
  process.stdout.write(JSON.stringify({ checks: checks.length, passed, failed, never_red: neverRed }) + '\n');
  process.exit(failed.length || neverRed.length ? 1 : 0);
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
    answer = dispatch(input, root);
  } catch (error) {
    die(error instanceof BadInput ? error.message : String(error && error.message));
  }
  process.stdout.write(JSON.stringify(answer) + '\n');
  process.exit(0);
}

/**
 * `architect/ledger.mjs` — the disk side of the review, which reads Git and writes the ledger —
 * imports the questions instead of launching this file: its answers are these functions, not a
 * copy of them. Only an invocation by path runs `main`; an import runs nothing.
 */
export { ASKS, BadInput, anchorOf, dispatch, globToRegExp, valuesAt };

/**
 * The guard that decides whether `main()` runs: true only when this file itself was launched —
 * by its own path or through a symlink to it — never when another module merely imports it (as
 * `ledger.mjs` does). Pure and platform-parametric so the bench can prove the symlink branch
 * without creating a real symlink: on Windows, where this package runs, that needs privileges
 * the bench must not assume. `toRealPath` does the one bit of filesystem work (`resolve` +
 * `realpathSync` in production, `main()`'s call site below wires it); the bench replaces it with
 * a fake that returns a fixed string, so no bench case here touches the disk.
 */
function isEntry(argv1, ownPath, toRealPath, platform = process.platform) {
  const invokedPath = argv1 ? toRealPath(argv1) : '';
  return platform === 'win32' ? invokedPath.toLowerCase() === ownPath.toLowerCase() : invokedPath === ownPath;
}

const ownPath = fileURLToPath(import.meta.url);
if (isEntry(process.argv[1], ownPath, (path) => realpathSync(resolve(path)))) main();
