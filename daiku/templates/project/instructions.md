# <project name> — project instructions

This file carries **only what holds in every session**, for every agent, whatever files are open.
Rules that hold for one part of the project live in `.daiku/policies/`, each declaring the `paths`
it covers, and load when a file under those paths is read. Anything true of one function and not
of the next belongs in the code, not here.

Before changing code: identify the use case, read the code it touches — which loads the area
policies — and check whether an equivalent flow already exists to extend. Do not open parallel
paths, shortcuts, speculative abstractions or duplicated logic.

## Documentation map

Each artefact has its own job. The same subject may appear at different granularity, never as a
copy.

- **This file and `.daiku/policies/`** — behaviour and architecture for the agent. This file holds
  the universal invariants; the policies hold the path-scoped constraints. Implementation detail
  stays in the code.
- **`<memory root>`** — the operational map and the facts recalled by relevance. Its contract is
  `.daiku/domain/memory-contract.md`.
- **`<product document>`** — the offer: what the product does, for whom and why, and what it is
  not. The human document for that reader, kept aligned when the offer changes.
- **`<brand document>`** — the identity and the market: name, positioning, competition, channels.
  The human document for that reader, kept aligned when the identity changes.
- **`<domain document>`** — the entities, the data, the interfaces and the vocabulary of the
  project. The human document for that reader, kept aligned when the domain changes.
- **`<stack document>`** — what the project is built with: languages, frameworks, tooling,
  hosting. The human document for that reader, kept aligned when the stack changes.
- **`<architecture document>`** — the structure, the boundaries and the key technical decisions
  with their why. The human document for that reader, kept aligned when the architecture changes.
- **`<working folders>`** — upcoming work and the developer's working files. The future lives only
  here, and is never anticipated in memory.

Working base: the code, this file, the loaded policies and the relevant memory. The founding
documents are human output to keep aligned, not an input.

## Behaviour

Answer in the language declared by `language.chat` in `.daiku/project.json`. Prefer caution and
precision, but use judgement on trivial tasks.

- Change only what the requested use case needs; every changed line must trace back to the request.
- Extend the structures that already exist before introducing new ones.
- Reach first for the standard library, the framework and the dependencies already installed; add
  a dependency only for a concrete need.
- Do not generalise an interface before two real uses, and do not add configurability, fallbacks
  or handling for impossible scenarios.
- Do not refactor, rename, reformat or clean adjacent code out of scope. Report pre-existing dead
  code without removing it. Remove only the orphans your own change created.
- Respect the existing style, names, comments and patterns even where you would have chosen
  otherwise.
- If different readings lead to materially different work, stop and ask; for minor choices pick a
  sensible option and move on.
- Aligning what this file, a policy, the memory or a reference states to a change you just made is
  not a choice, and not something the commit will do later: the pass runs **on every
  modification**, in the same work, before you declare the work done. It is a pass and not a
  judgement — what it has to correct may be nothing, and "nothing to update" is the verdict of a
  pass that ran, never a reason to skip it.
- A reference that resolves to nothing — a path, a section, a `[[name]]` link — is corrected in the
  same work, not listed for later, and the correction is reported as done. Where you cannot tell
  where it should point now, ask for the destination, never for permission to repair it.
- If a simpler approach exists, or the request seems to bypass a layer, say so and take the
  architecturally correct path.
- Turn the task into verifiable criteria; for bugs and validations prefer a test that reproduces
  the behaviour.
- For multi-step work expose a short plan with a check per step; trivial changes need none.
- Report failing tests, skipped checks and limits you hit faithfully.

## Hard rules

Invariants valid in every session and for every agent, whatever files are open. The detail of each
layer lives in the matching area policy under `.daiku/policies/`; the invariant stays here. Each
rule carries a stable `[slug]` in square brackets: the number is local convenience, the slug is
what portable skills cite, because numbering differs from project to project.

1. `[extend-before-creating]` Every new capability extends the existing structure before
   introducing new files, folders, patterns or flows.
2. `[no-unannounced-commit]` No surprise commit outside the flows that declare one. In an ordinary
   session never run `git commit` or `git push` on your own; only the exceptions below apply.
3. `[gate-owned-by-review]` The build and test gate belongs to the review cycle and is not run
   elsewhere. Full test suite, lint and format, type-check and package build are the gate that
   `review` runs once, on the way out of its cycle: no other flow runs them as an ordinary check
   of its own work. Verifying what you write stays mandatory, but with the tools of the perimeter
   you touched — import the module you changed, run only the tests that cover what you changed,
   look at the real behaviour.
4. `[no-temporary-when-future-known]` Never a temporary solution when tomorrow is already known.
   If the future scale of the use case is known or stated by the owner, do not build the version
   sized for today: propose the solution that is sound at that scale, saying plainly that it is
   over-engineering against today's need. Building it once costs less than building it twice.
   Where the future scale is not known, the minimalism of *Behaviour* stands.
5. `[corpus-never-behind]` No modification ends with the corpus left behind. This file,
   `.daiku/policies/`, the memory corpus and the founding documents are realigned in the same work
   to whatever the change made false — never deferred to a commit that may not come, never skipped
   because the diff looks like pure implementation, never handed back to the owner as a question.
   Where the change is a delivery or a commit, the step is the one the flow declares
   (`update-memory`); anywhere else it is the work itself, and the memory corpus is written by the
   session as much as by that step. The pass runs whatever the diff: where nothing has become
   false there is nothing to write, and that is its verdict, not an exemption from running it.
6. `[feature-opened-by-the-owner]` No agent opens a feature on its own initiative. The chain that
   opens a problem folder — `/new-feature`, and with it the study, the decisions and the delivery —
   starts only when the owner asks for it in so many words. A change an agent judges worth that
   chain is a line proposing it, never a run started in their place: opening the work is the one
   gesture of this method that is not delegated.

<additional invariants observed in this repository, each with its own stable slug, and numbered on
from the project's last one where the project already numbers them>

### Git and commits

In an ordinary session never run `git commit` or `git push` on your own: stage the work and wait
for the go-ahead.

Declared exceptions:

- `ship-feature` may commit after the gate and
  after memory and documentation have been aligned to the staged diff.
- `commit`, invoked explicitly, authorises the commit under its own convention. Before committing
  it always delegates the alignment of memory and documentation to `update-memory` — a mandatory
  step, not a judgement on whether the diff deserves it.
- `review` always closes with the commit, delegating it, but only on a clean cycle. If a single
  condition is missing it stops at the report.

The push stays a manual act of the owner: no automated flow performs it.

## Stack and local environment

<the technology inventory of this repository: languages and runtimes with their versions, package
manager, frameworks, database and storage, build and test toolchain, and how the thing is started
locally — declared commands, ports, environment variables that must stay consistent>

## Operational safety

- Do not commit secrets or `.env` files.
- Do not run searches over the whole filesystem: stay inside the working roots.

<!-- daiku:instructions — this file was structured by Daiku's init skill. It is yours now: rewrite
     it as you like, init will not touch it again. Remove this line and init may restructure it. -->
