---
name: 'perf'
description: 'Investigates a scope for performance bottlenecks (CPU, GPU, I/O, network, rendering); default proposes quick wins without touching code, as a /review finder it returns read-only findings on the diff'
user-invocable: false
---

# Goal

Investigate the indicated scope and find what makes the application heavy, slow or excessively costly in resources. **In default mode do not modify code, configurations or tests:** it is an investigation, not a fix.

> **Parameters.** Every key in braces in this contract resolves on the project parameter files, never from memory and never by assumption: the rules are in §5 of `contracts/project-contract.md`, which also says **in which language to write** and what to do when a key is missing.

## Two modes

- **Default (investigation).** You investigate and propose quick wins in chat, without touching anything. It is the behaviour described in all the rest of this file.
- **Finder (invoked by `/review`).** Scope = the diff passed by the caller, not a folder. **Analysis only**: no file modification, no fix, no commit. Return the caller JSON block instead of the chat report. See *Finder mode* below; all the rest of the file (what to look for, classification criteria) stays valid, only the outcome form changes.

## The domain of this project

Read `.daiku/domain/perf.md`: it declares which technologies occupy the three levels this skill inspects and where each truly pays, which external tools enter the cost of a flow, which costs manifest at rest, how the short name of a unit resolves into its folder and how the runtime is observed. If it does not exist, rebuild the stack by reading the repository, accept as scope only explicit paths, limit yourself to static evaluation, and declare it in the outcome.

The focus is reducing:

* CPU and GPU usage;
* useless work at runtime (rendering, polling, loops, retries, recomputations);
* excessive loads on memory, I/O, network or external processes.

## Argument: scope

Argument: `$ARGUMENTS`

Resolve the scope before doing anything else:

* The argument is a **path or glob** relative to the repo root — the folder of a feature, layer or module. Use it verbatim.
* Accept also the **short name** of a project unit (frontend feature, service, adapter, flow) and resolve it into its folder, helping yourself with the catalogues the domain file indicates.
* It can also be a cross-cutting **flow** (the execution of an external tool, state polling, a processing loop): rebuild it across the layers, without assuming the whole repository is in the perimeter.
* **Without scope** → this contract is not launched by hand: the scope arrives from whoever invokes you. If it did not arrive, **stop and say so in the block**, listing the plausible areas so whoever called you can choose one. Never start on the whole repo.

If the resolved path does not exist, report it and stop.

# Working mode

First **rebuild the real flow** of the scope: entrypoint, calls, state, components, launched processes, polling, cache, queries, async jobs, rendering, involved adapters and external tools.

Then look for bottlenecks and waste, prioritising low-risk **quick wins**.

Evaluate resource usage both **idle** and **during processes**: many costs manifest at rest and not under load, and an investigation watching only load loses them all. Which they are, in this project, the domain file says.

## What to look for

**Three levels, and it is a default reading, not a law.** A project whose architecture is not divided this way declares it in `.daiku/domain/perf.md`, and then the levels it declares hold. Which technologies occupy them, and the hot spots each carries with it, the same file says: below stand the forms of waste, not the names of who produces them.

**Interface and rendering:**

* repeated renderings or components recomputing too much; absence of targeted memoisation;
* inefficient management of data subscriptions and of work tied to the lifecycle of an interface unit; too aggressive polling or without bail-out;
* duplicate fetches or queries; too wide invalidation;
* GPU kept awake by continuous animations, by surfaces redrawn every frame or by unnecessary visual effects.

**Application service:**

* frequent or unbounded loops; uncontrolled concurrency;
* data read/reloaded several times or larger than needed;
* expensive transformations in the wrong point; repeated serialisation/deserialisation;
* synchronous operations blocking the flow; files read or written uselessly;
* too verbose logs on hot paths.

**External processes and tools:**

* processes launched more often than needed or without cache;
* inefficient orchestration, retries, duplicate scans;
* suboptimal configuration or invocation.
* Always distinguish between **inevitable tool cost** and cost due to orchestration, retry/polling, missing cache or suboptimal invocation.

**Cross-cutting:** dependencies with outdated versions (evaluate whether an update is recommended and at which risk), absence of debounce/cache/targeted invalidation.

# Constraints

* Respect the indicated scope: no finding or proposal outside the perimeter.
* Do not propose wide rewrites if a local optimisation exists.
* Do not propose new dependencies except on strong and motivated need.
* Do not introduce parallel architectures.
* **In default mode:** do not modify code, configurations or tests; do not run fixes; do not create commits. (In no mode is code modified; in finder mode findings are returned, see below.)
* Do not run destructive benchmarks or heavy commands without first motivating them.

# Finder mode (invoked by `/review`)

Active when `/review` invokes you. It is not an investigation to report in chat: it is an analysis channel on the diff, like arch/bug — but **analysis only**: no file modification, no fix, no commit.

- **Scope = the diff**, not a folder. Look for bottlenecks **only in the code touched by the feature**; do not widen to adjacent unmodified code: surgical modifications, no out-of-scope refactoring.
- **Confidence high:** win evident on inspection and behaviour-preserving — N+1 queries, redundant recomputation/reserialisation, missing memoisation, polling without bail-out, too wide invalidation, repeated reading of the same data. `change` carries the concrete fix.
- **Confidence medium:** likely, but with a condition to verify on the code — name it in `description`. `change` still carries the concrete fix.
- **Confidence low:** impact which to justify itself would require a measurement or benchmark (it is hypothetical impact) — no `change`; `description` carries the recommended measurement.
- **You apply nothing.** The decision to apply or discard each finding belongs to the `/review` applier, who reverifies it.
- **No interactive stop, no output in investigation format.** You do not print the `# Performance investigation outcome` report: return the block declared by `skills/finder-prompt/SKILL.md` § *The block you return*, in full and with those field names: read it from there, here it is not copied. For this discipline `symbol` is the class, function or component where the bottleneck lives, `change` is the concrete fix, and `description` carries problem and evidence, and for low confidence the recommended measurement.

If measurements are needed, privilege code reading and light commands. The domain file says how the application starts and where it responds, referring to the only source of those values: if you observe the runtime, declare what you measured. If you cannot measure, explicitly declare in the `description` of the finding that the evaluation is **static**.

# Classification criteria

Classify each finding with:

* **estimated impact:** High | Medium | Low;
* **intervention risk:** Low | Medium | High;
* **type:** CPU | GPU | memory | I/O | network | rendering | concurrency | external tool | architecture | configuration;
* **evidence:** file, function, hook, endpoint, service, adapter, command or observed flow;
* **quick win:** minimal and concrete intervention;
* **verification:** how to measure or confirm the improvement.

Distinguish between: immediate quick win · useful but not urgent optimisation · hypothesis to measure · structural intervention not suited as quick win.

# Final output

Answer in chat with this format:

```md
# Performance investigation outcome

## Analysed scope
- Received scope:
- Analysed files/flows:
- Commands or checks run:
- Analysis limits (static/measured):

## Summary
- Likely main cause:
- Most expensive area:
- Most convenient quick win:
- Overall risk of the interventions:

## Recommended quick wins

### 1. <title>
Type: CPU | GPU | memory | I/O | network | rendering | concurrency | external tool | configuration
Estimated impact: High | Medium | Low
Intervention risk: Low | Medium | High
Evidence: <file/function/flow>
Problem: <concrete description>
Quick win: <proposed minimal intervention>
Why it should help: <concise explanation>
Recommended check: <check or metric>

### 2. <title>
...

## Hypotheses to measure

### 1. <title>
Partial evidence:
Recommended measurement:
Possible intervention:

## Changes to avoid for now
- <intervention>: <reason>

## Proposed priority
1. <recommended actions, most valuable first — as many as the findings justify>
```

If you find no real quick wins, say so explicitly and indicate only the hypotheses to measure.

Do not modify files. Do not create commits.
