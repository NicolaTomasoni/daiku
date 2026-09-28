---
name: 'test-coverage'
description: 'Default measures coverage by project macro-categories and waits for category + % target; in --auto mode it decides itself whether the diff introduces uncovered logic and writes tests on the diff without asking. Quality tests in the correct layer'
user-invocable: false
---

Skill for **creating unit tests** with a two-phase flow: first it measures and shows coverage by macro-category, **stops** and waits for you to choose what to work on and with which % target; then it writes the tests respecting the project conventions and quality rules.

The architectural rules stay those of the project — the invariants of `{instructions_file}` and the area rules in `.daiku/policies/`: this skill does not replace them, it also applies them to tests.

> **Parameters.** Every key in braces in this contract resolves on the project parameter files, never from memory and never by assumption: the rules are in §5 of `contracts/project-contract.md`, which also says **in which language to write** and what to do when a key is missing.

## Domain context

Read `.daiku/domain/test-strategy.md`: it carries the macro-categories of this project, how the output of its measurement commands is read and which artefacts that measurement leaves to remove, which perimeter the runner of each area truly covers, which conventions the already written tests follow and from which strength point each layer is tested. If it does not exist, report coverage by area without splitting it into macro-categories and write the tests mirroring a sibling test of the same layer, and declare it in the outcome.

## Two modes

- **Default (interactive).** The two-phase flow described below: measure → STOP → category + % target choice → write. It is the behaviour for manual invocation.
- **`--auto` (invoked by `/review`).** Scope = the diff, not a macro-category. **No Phase 1 and no STOP**: you neither measure global coverage nor ask for a target, you directly write the tests for the logic introduced by the diff. See *Automatic mode* at the bottom. The quality rules of **Phase 3** (conventions, per-layer strategy, what makes a quality test) hold identical.

## Argument

`$ARGUMENTS` is optional and is only a **suggestion** of a category to focus the table on. Even if present, Phase 1 still shows the complete table and Phase 2 **awaits confirmation**: never start writing tests without explicit input on category **and** % target.

---

## Phase 1 — Coverage map by macro-category

Goal: an honest table saying where we are, not a single number.

### 1.1 Measure each area

For each area declared in `{areas}` having `{areas.<area>.coverage}`, run those lines in order from the declared cwd. One line runs **as it is**: do not replace it with an equivalent you believe better, install nothing to make it run. If it fails because the environment is missing, **stop and report it** — it is a real outcome, not a shortcut to look for elsewhere.

Read the result those commands produce and aggregate **by summing covered and total statements** per macro-category (weighted average on statements, not average of per-file percentages — otherwise small files skew the data).

### 1.2 Macro-categories (from the project layers)

Map each measured file to its layer by path, per the taxonomy of `.daiku/domain/test-strategy.md`; the files no entry captures end up in the residual macro-category that taxonomy declares.

### 1.3 The perimeter the measurement truly covers

The command of an area can cover less than the area declaring it: a runner excludes by configuration what it does not know how to run. The line of that area carries **the coverage of the truly measured perimeter**, not that of the whole area; what stays outside the runner is declared such, not counted as uncovered and not bypassed. Install nothing and propose no scaffolding: the tooling is what the declared command uses.

### 1.4 Show the table and stop

Present:

```
| Macro-category       | Coverage | Covered/total stmts | Worst files (miss) |
|----------------------|----------|---------------------|----------------------|
| <macro-category>     |  ...%    |  .../...            | file — N uncovered lines |
| ...                  |          |                     |                      |
| TOTAL <area>         |  ...%    |  .../...            | measured perimeter — what stays outside the runner |
```

One total line for each measured area. For each category list the **2–3 worst files** by uncovered lines (total minus covered statements), not by percentage: they are the high-return candidates. Add a summary "quick win" line with the macro-categories `.daiku/domain/test-strategy.md` indicates at highest return, if they have uncovered lines (see Phase 3).

Then **STOP**. Close with an explicit question:

> On which macro-category (or specific file) do you want to work, and with which **% target**?

Do not continue until the answer arrives. Clean the artefacts the measurement left in the cwd of its commands before moving on or at skill end — they must not be committed.

---

## Phase 2 — Await the choice

The user indicates **category/file** and **% target** (e.g. "<macro-category> at 95%", "<file> above 90%", "the most uncovered files of <macro-category> at 70%").

If the request is ambiguous (category without target, or "raise coverage" without scope), **ask**: a verifiable target is what makes Phase 3 autonomous (solid success criteria, not "make it work").

Immediately translate the choice into a verifiable goal, e.g. `coverage of <category path> from X% to ≥95%, remeasured with the same Phase 1 command`.

---

## Phase 3 — Write the tests (project quality)

### 3.1 Before writing

1. From the measurement result derive the **uncovered lines** of the target files. Those lines are almost always **error branches, empty branches, edge cases**: the value is there, not in the already covered happy path.
2. **Read the source** of the target files and **at least one existing sibling test** of the same layer, to mirror its style, fixtures and fakes. Do not invent a new pattern where one already exists that layer follows.
3. Order the work by **risk × uncovered lines**, not by comfort.

### 3.2 Project conventions (non-negotiable)

The concrete conventions — test framework and style, double form, comment language, where fixtures live, how the filesystem is isolated — stand in `.daiku/domain/test-strategy.md` and are mirrored to the letter: they are what the sibling files already follow. Above them still hold:

- **Explicit doubles, not opaque mocks**: for each external system inject a double, in the form the sibling uses, **scripting the outputs** and **recording the calls**. An explicit double says what happens readably; a generic mock hides the contract.
- **Filesystem only from the access point** the project rules declare — `{instructions_file}` and `.daiku/policies/` — pointed at a temporary directory; if they declare none, still isolate in temporary. **Never** real data, sandboxes or artefacts: no test writes in the user repo nor in the application runtime directories.
- **Golden fixtures** for parsing/mapping: real output of the external tool saved as a fixture file and read by the test. If a new fixture is needed, capture realistic output and put it where the others live, not giant inline strings.
- **Total determinism**: no network, no real subprocesses, no real time or random. If the code already accepts the instant as an argument, pass it instead of mocking the clock.

### 3.3 Per-layer strategy

Each layer is tested from its architectural strength point: which it is — what to assert, what to fake, what must never be truly called, and which layers return most per written line — `.daiku/domain/test-strategy.md` says. Do not deduce it from the folder name: the boundaries between layers are those of `{instructions_file}` and of the area rules in `.daiku/policies/`.

### 3.4 What makes a test "quality" here

- **Test behaviour/contract, not implementation.** Assert on what the code produces and persists, not on the fact that a mock was called with the argument you gave it (that tests the test).
- **A test must be able to fail.** Before keeping it, ask yourself: if the behaviour were broken, would this test turn red? If it passes anyway, it is not worth it. Mutation-testing mentality on the uncovered branches.
- **One concept per test**, with a descriptive and speaking name saying *which behaviour* in *which condition* ("maps 1:1 the real issues", "marks the run failed when the double raises"), in the naming convention of the sibling file.
- **Aim at the unhappy paths** the coverage hole hides: error, empty, edge, malformed external output, deletion. Do not inflate the already covered happy path to raise the number.
- **Do not chase 100%.** Skip the boilerplate (empty constructors, pure DTOs, process entry points). If you deliberately leave something uncovered, **say so** and explain why (rule: no silent cap).
- Also in tests respect the project **invariants**: filesystem only from the declared access point, no real external calls, isolated fixtures and test data.

### 3.5 Place and verify

1. Add the tests in the existing test file of the module; create a new one only if the module has none, with the name and position `.daiku/domain/test-strategy.md` declares for that layer. New fixtures where the others live.
2. Run **only** the targeted file with `{areas.<area>.test_targeted}` of the area it belongs to, replacing `<FILES>` with the file you wrote. The full suite **is not launched here**: it is the `/review` gate, running right after.
3. **Re-measure** the category coverage with `{areas.<area>.coverage}`, the same command of Phase 1, and compare with the target. Iterate on the still uncovered branches until you reach the target or the return turns marginal.
4. Clean the artefacts the measurement left.
5. **Report honestly**: coverage before → after for the category, how many tests added, what deliberately remains uncovered and why. If you do not reach the target, say so with the numbers, do not declare done.

---

## Automatic mode (`--auto`)

Active when `/review` invokes you, on exit of its cycle, on the final diff under `{code_root}`. **You skip Phase 1 and Phase 2**: no global table, no STOP, no question on category/%. The scope is not a macro-category but the **feature diff** the caller passes you.

The caller also passes you `{memory.index}` and the **paths** of the memories the diff touches, to open before writing: it is the channel of §4.1 of `contracts/orchestration.md`. If it does not pass them, open the index and choose yourself — a test crystallising a behaviour a memory declares wrong is a test no round will ever review again. The keys it passes already resolved you use as passed, and a key it did not pass you resolve on §5 of `contracts/project-contract.md` (§4 point 1 of `contracts/orchestration.md`). It launches you only when at least one area the diff touches declares `{areas.<area>.test_targeted}`, or when `--with test-coverage` forces the phase.

**You decide** whether the diff introduces new logic uncovered by tests: if not, you come back without writing anything and declare it in the return block (`skipped: true` with why). If the caller passed `--with test-coverage`, you lose the faculty of skipping: write for each new testable branch.

Goal: cover with tests **the logic introduced or changed by the diff**, not raising a number.

- **Journeys.** If the diff touches a complete user flow — files across two or more layers serving one user-visible behaviour — the flow is a journey, not a set of units: run it with the touched area's declared commands (`{areas.<area>.test_targeted}` or whichever command of that area drives it). If no touched area declares a runner able to drive it, do not invent one: declare the missing journey in `to_confirm` with `class: "test-coverage"`, `blocking: false`, `file` the flow's entry file and `scenario` the journey in one line. What the JSON does not declare does not exist (§6 of `contracts/project-contract.md`).
- **Flaky tests go to quarantine, never to silence.** A test failing intermittently with no code change between runs is flaky: mark it with the layer's skip marker, as the sibling tests and `.daiku/domain/test-strategy.md` declare it — never invent the marker — and record it in `written_tests` with `covers` carrying `quarantined:` and the evidence (pass rate, failure). A quarantined test is declared in the block, so the gate does not go red on it and the next session finds it.

- **Scope = the diff files** in the layers `.daiku/domain/test-strategy.md` declares testable, in every `{areas}` area the diff touches. Outside stay the boilerplate (pure DTOs, empty constructors) and what the runner of an area does not cover (§1.3). For each new or modified function/branch, ask yourself: *if this behaviour broke, would a test catch it?* If not, it is a candidate.
- **Write the tests for what you can assert with certainty** from the contract and the code: happy path of the new behaviour, error branches, edge/empty, malformed external output. Here "medium-high confidence" means: *I know what the correct expected behaviour is*.
- **Report, do not fabricate.** Where the expected behaviour is **ambiguous** (unclear from the contract whether the current code is right), do **not** write an assertion that would crystallise a possible bug: annotate it as *To confirm* with the concrete uncovered case. A test asserting "it does what it does today" without knowing whether it is right is a test that cannot fail — forbidden (§3.4). Mark `blocking: true` when the ambiguity casts doubt on the correctness of the delivered code (unclear whether the current behaviour is right), `false` when the code stays correct whatever the answer — same rule as the `/review` applier.
- **Unchanged Phase-3 quality**: §3.2 conventions, §3.3 per-layer strategy and §3.4 criteria, all as `.daiku/domain/test-strategy.md` lays them out for this project. Extend the existing test file next to the module, do not create parallel ones.
- **Verify**: run **only** the targeted file with `{areas.<area>.test_targeted}` of the area it belongs to, `<FILES>` replaced by the written file; the tests must pass. The full suite is the `/review` gate, running right after you: do not launch it. You do not measure global coverage (not the task in this mode); still clean any measurement artefacts.
- **No stop, no tabular output.** The return is **a contract JSON block** `/review` reads without interpreting the prose:
  ```json
  {"written_tests": [{"file": "<path>", "covers": "<what it covers, one line>"}], "to_confirm": [{"file": "<path>", "line": 0, "scenario": "<the fork in simple words: what is at stake, the roads, what changes>", "class": "test-coverage", "blocking": true}], "skipped": false, "why": "<if skipped: why there is no new uncovered logic; otherwise empty>"}
  ```
No field is omitted: with zero items write `[]`. The suite is run by the `/review` Gate right after.
