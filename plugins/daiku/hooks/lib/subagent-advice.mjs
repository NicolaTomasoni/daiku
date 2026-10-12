#!/usr/bin/env node
/**
 * The two things Daiku says to and about a subagent — and neither of them denies anything.
 *
 * The cost of a run is paid mostly in its children: the head of every subagent's prompt, the
 * fan-out, the bytes a step returns, and what the project loads on every session. Two of those
 * are addressable from a hook, and this file is both addresses:
 *
 *  - **`SubagentStart` — the concision statement (card 4).** A subagent is spawned: before it
 *    answers, the host delivers this hook's `additionalContext` into its context (the fact is
 *    proven on the host — `.daiku/studies/claude-code-hooks.md` §19.2, §19.4, and the cap of
 *    10,000 characters per string holds there too, §19.5). The statement says what stays whole —
 *    the JSON block a step returns, its shape and every field — and where length is spent
 *    without being information: the prose around the block. It fires **once per child**, so
 *    there is nothing to suppress and no marker is kept.
 *  - **`PreToolUse` on the launch tools (`Agent`/`Task`) — the head's notice (card 2).** The
 *    orchestrator is about to hand a child a prompt, and this is the only point where that
 *    prompt is readable **before** the child runs. Where the project declared a
 *    `subagent.prompt_cap` and the prompt is over it, the notice says so — and changes nothing:
 *    no `permissionDecision`, no `updatedInput`, the prompt is delivered untouched. The same
 *    rule `contracts/orchestration.md` §4 states in prose — the **path**, not the transcription —
 *    now has a control that measures what it asks for.
 *
 * **Both texts are facts, not orders.** The host's reference says a notice shaped like an
 * out-of-band system instruction trips the reader's defences, and this package's own
 * `stop-advice.mjs` and `run-advice.mjs` state the same discipline: the text names what is true
 * of this child, this prompt, and stops.
 *
 * **The gate is the same as everywhere else.** Without `.daiku/project.json` this project has not
 * opened Daiku, and neither branch speaks (the head's notice never reads the cap either — §6 of
 * `contracts/project-contract.md`, applied to a hook).
 *
 * Contract: **fail-open**. Malformed stdin, an unreachable disk, any exception → silence and
 * exit 0. It emits only `hookSpecificOutput.additionalContext`: this file speaks, it never closes
 * a door.
 *
 * Test bench: `node subagent-advice.mjs --self-check`, from the folder it lives in. The total is
 * **counted**, not hard-coded. Two of its cases prove the shapes this file must never take: the
 * launch-side answer carries **no** `permissionDecision` and **no** `updatedInput`, and the
 * concision text never lets the return blocks be reduced.
 */

import { existsSync, readFileSync } from 'node:fs';
import { invokedDirectly, projectRoot } from './project-root.mjs';
import { REAL_READS, loadContext, fakeContext } from './daiku-config.mjs';

const ROOT = projectRoot();

/** The tools that launch a subagent — the delegation of §4 of `contracts/orchestration.md`. */
const LAUNCHES = ['Agent', 'Task'];

/** The cap a string delivered as `additionalContext` may reach before the host keeps only a preview. */
export const CONTEXT_CAP = 10000;

// --- the concision statement (card 4) -----------------------------------------

/**
 * What every subagent is told when it starts. A **fact** about the run and about the block it
 * returns, never an order: the block keeps its shape and every field whole, and the prose around
 * it is where a report grows without being more informative. It is the one statement of concision
 * the package makes, and `SubagentStart` fires once per child — so it lands once, and no marker
 * is kept.
 */
export function concisionText() {
  return (
    'Daiku runs its work as a chain of subagents, and each step returns a JSON block. That block is ' +
    'the contract between the step and whoever called it: it keeps its declared shape and every ' +
    'field, whole — a trimmed block is a step that did not come back. The prose written around the ' +
    'block is where a report grows without carrying more: the facts that travel downstream — what ' +
    'was read, what was run, what was concluded — are already short in the block beside it. This is ' +
    'a statement about how a Daiku run works, not a job being given.'
  );
}

/** What the `SubagentStart` event answers: the statement, or `null` where Daiku was not opened. */
export function concisionContext(ctx) {
  if (!ctx || !ctx.present) return null;
  return concisionText();
}

// --- the head's notice (card 2) -----------------------------------------------

/**
 * What the launch event answers: the notice when the prompt is over the declared cap, `null`
 * otherwise. `null` too when the project declared no cap — the notice has nothing to measure
 * against, and stays silent rather than picking a threshold (§6, applied to a hook).
 *
 * It returns the **text** alone: the caller wraps it, and the wrapper carries no field a host
 * could read as a decision.
 */
export function capNotice(event, ctx) {
  if (!ctx || !ctx.present) return null;
  const cap = typeof ctx.promptCap === 'number' && ctx.promptCap > 0 ? ctx.promptCap : null;
  if (!cap) return null;
  if (!event || !LAUNCHES.includes(event.tool_name)) return null;
  const input = event.tool_input;
  const prompt = input && typeof input === 'object' && typeof input.prompt === 'string' ? input.prompt : '';
  if (prompt.length <= cap) return null;
  return (
    `Daiku notice: the prompt about to be handed to a subagent is ${prompt.length} characters, over ` +
    `the ${cap} this project declares in \`subagent.prompt_cap\` (\`.daiku/project.json\`). Every node ` +
    'pays the head of its prompt, and a head that size is usually a transcription where a **path** ' +
    'would carry the same — `contracts/orchestration.md` §4, *Delegation*. This is a note and not a ' +
    'block: the prompt is delivered untouched, and nothing here is a decision.'
  );
}

// --- what each event answers --------------------------------------------------

/** The message a branch emits: `additionalContext` and nothing else — never a decision, never a rewrite. */
export function message(eventName, text) {
  return { hookSpecificOutput: { hookEventName: eventName, additionalContext: text } };
}

/* ------------------------------------------------------------------------- *
 * Test bench
 * ------------------------------------------------------------------------- */

const CTX = () => fakeContext({ promptCap: 4000 });
const CTX_NO_CAP = () => fakeContext({});
const CTX_ABSENT = () => fakeContext({ present: false });

const launch = (prompt, extra = {}) => ({
  hook_event_name: 'PreToolUse',
  session_id: 'sess-1',
  tool_name: 'Agent',
  tool_input: { prompt },
  ...extra,
});

function selfCheck() {
  const failed = [];
  let ran = 0;
  const check = (name, condition) => {
    ran += 1;
    if (!condition) failed.push(name);
  };

  // --- card 4: the concision statement, at every child ------------------------
  const text = concisionContext(CTX());
  check('a started subagent is spoken to', typeof text === 'string' && text.length > 0);
  check('the statement names the return block as what stays whole', text.includes('JSON block') && text.includes('whole'));
  check('the statement names the prose around the block as what is spent', text.includes('prose'));
  check('the statement says it is not a job being given', text.includes('not a job being given'));
  check('the statement holds under the host cap', text.length <= CONTEXT_CAP);
  check('the statement is a fact, not an order', !/\byou must\b|\bdo not\b|\bnever\b/i.test(text));
  // `SubagentStart` fires once per child, so the text leaves every time: no marker suppresses it.
  const again = concisionContext(CTX());
  check('a second child hears it too', again === text);
  check('the message carries the event name', message('SubagentStart', text).hookSpecificOutput.hookEventName === 'SubagentStart');
  check('and only the event name and the context', Object.keys(message('SubagentStart', text).hookSpecificOutput).join(',') === 'hookEventName,additionalContext');
  check('a project without Daiku is not spoken to', concisionContext(CTX_ABSENT()) === null);
  check('no context at all: silence', concisionContext(undefined) === null);

  // --- card 2: the head's notice ----------------------------------------------
  const over = capNotice(launch('x'.repeat(4001)), CTX());
  check('a prompt over the cap is spoken to', typeof over === 'string' && over.length > 0);
  check('the notice names the characters', over.includes('4001 characters'));
  check('the notice names the cap', over.includes('over the 4000'));
  check('the notice names the key it comes from', over.includes('subagent.prompt_cap'));
  check('the notice says it blocks nothing', over.includes('not a block'));
  check('the notice is a fact, not an order', over.startsWith('Daiku notice:'));

  check('a prompt at the cap is left alone', capNotice(launch('x'.repeat(4000)), CTX()) === null);
  check('a prompt under the cap is left alone', capNotice(launch('x'.repeat(3999)), CTX()) === null);
  check('a project that declares no cap is not spoken to', capNotice(launch('x'.repeat(9999)), CTX_NO_CAP()) === null);
  check('a project without Daiku is not spoken to', capNotice(launch('x'.repeat(9999)), CTX_ABSENT()) === null);
  check('a tool that is not a launch is left alone', capNotice({ tool_name: 'Edit', tool_input: { prompt: 'x'.repeat(9999) } }, CTX()) === null);
  check('a launch without a prompt is left alone', capNotice(launch(undefined), CTX()) === null);
  check('a prompt that is not a string is left alone', capNotice({ tool_name: 'Agent', tool_input: { prompt: 42 } }, CTX()) === null);
  check('Task is a launch too', typeof capNotice({ tool_name: 'Task', tool_input: { prompt: 'x'.repeat(9000) } }, CTX()) === 'string');

  // The shape this file must never take: the answer to a launch carries no decision and no rewrite.
  const answer = message('PreToolUse', over);
  check('the launch answer names the event', answer.hookSpecificOutput.hookEventName === 'PreToolUse');
  check('the launch answer carries no permissionDecision', !('permissionDecision' in answer.hookSpecificOutput));
  check('the launch answer carries no updatedInput', !('updatedInput' in answer.hookSpecificOutput));
  check('the launch answer carries no permissionDecisionReason', !('permissionDecisionReason' in answer.hookSpecificOutput));
  check('the launch answer carries no field a host could read as a decision', Object.keys(answer.hookSpecificOutput).join(',') === 'hookEventName,additionalContext');
  check('and nothing at the top level is a decision', Object.keys(answer).join(',') === 'hookSpecificOutput');

  // --- the gate, read from the project ----------------------------------------
  check('a project with Daiku reads its caps', CTX().present === true && CTX().promptCap === 4000);
  check('a project without Daiku carries nothing', CTX_ABSENT().present === false);

  // --- fail-open --------------------------------------------------------------
  let survived = true;
  try {
    capNotice(null, null);
    concisionContext(null);
  } catch (error) {
    survived = false;
  }
  check('a missing context never throws', survived);

  process.stdout.write(JSON.stringify({ checks: ran, passed: ran - failed.length, failed }, null, 2) + '\n');
  return failed.length ? 1 : 0;
}

/* ------------------------------------------------------------------------- *
 * Invocation
 * ------------------------------------------------------------------------- */

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
  process.stdout.write(JSON.stringify(message(eventName, text)));
}

async function main() {
  const event = await readEvent();
  if (!event) return;
  const root = projectRoot({ cwd: event.cwd || ROOT });
  const ctx = loadContext(root, REAL_READS);

  if (event.hook_event_name === 'SubagentStart') {
    const text = concisionContext(ctx);
    if (text) emit('SubagentStart', text);
    return;
  }

  // The launch event: the notice rides along with the call, which goes through untouched. No
  // `permissionDecision`, no `updatedInput` — this file speaks.
  const text = capNotice(event, ctx);
  if (text) emit('PreToolUse', text);
}

if (invokedDirectly(import.meta.url)) {
  if (process.argv.includes('--self-check')) {
    process.exit(selfCheck());
  }
  main().catch(() => process.exit(0));
}
