# Kaji — product document

> **Kaji** (舵, the helm) is not only for Claude Code: it supports **Claude Code and Codex** through
> separate adapters, with a common core. The command prefix is `Kaji`.
>
> **Where it lives.** Kaji is developed in Daiku's private monorepo: the product lives in
> `extensions/kaji/`, and these documents with it. It is a standalone product — it installs,
> works and is published without Daiku, in a public repository of its own.

Document regenerated on **24 September 2026** before development began. It replaces the previous
README: it keeps the constraints already verified, incorporates the decisions that emerged later and
adds support for Codex, self-updating catalogs and pricing, change detection, cost metering,
subscription limits, subagents and notifications.

The idea in one sentence:

> **a per-project status bar that knows which agent, provider and model are actually working,
> how much they are consuming, how much they cost, which limits remain, and lets you change what the
> runtime allows to be changed without hiding the cases where a restart is needed.**

It is not an LLM proxy and does not sit in the middle of the traffic. The runtimes keep talking
directly to the providers. The extension observes and configures the runtimes through the mechanisms
they expose.

---

## 1. The problem, now more general

The starting problem comes from Claude Code: today the backend is switched with a PowerShell
script (`~/.claude/llm-switch.ps1`) that rewrites the `env` block of
`~/.claude/settings.json`. The choice is therefore global to the machine, the VS Code tasks are
copied by hand between workspaces, and moving from one project to another does not carry provider
and model along.

The product must reverse that relationship: **the project describes the intent**, while the runtime
adapter applies what the runtime allows at that scope.

With Codex the problem is similar but not identical. Codex supports `.codex/config.toml` for
project overrides, but for security reasons it ignores `model_provider` and `model_providers` at
project level: a repository cannot decide where to send credentials or prompts. Model and effort
can be project-scoped; the provider is machine-local. This difference must not be hidden behind a
false abstraction.

So the product does not promise "everything per project" in absolute terms. It promises instead:

- **per-project intent**: runtime, model, effort, fallback, presets, observability preferences;
- **application according to the runtime's real capabilities**;
- **live state separate from desired state**;
- **no silence** when desired and live diverge.

### Non-negotiable principles

1. **Runtime and provider are two different dimensions.** Claude Code and Codex are runtimes;
   Anthropic, OpenAI, DeepSeek, GLM, MiMo and others are providers.
2. **No local proxy.** If a provider speaks the protocol the runtime requires, the runtime talks to
   it directly. If it does not, the model does not appear for that runtime.
3. **Observed data beats configured data.** The status bar shows what the session is actually
   using when the runtime exposes it.
4. **Remote sources are updatable, but never authoritative without validation.** Every remote
   catalog or price list goes through schema, sanity checks, diff and last-known-good cache.
5. **Absence is a state.** Quota not available, tokens not yet known, cost estimable but not
   exact, effort not supported: they are shown as such.
6. **No secrets in the repository.** Definitions are data; credentials stay in the intended
   user/runtime storage.
7. **Change detection before destructive automation.** A model that disappears is not deleted
   from the configuration; it is marked as retired/no longer advertised.

---

## 2. Two axes: runtime and provider

### 2.1 Runtime

A runtime is the client/agent that performs the work and decides how to read configuration, models,
telemetry and credentials.

| Runtime | Project config | User config | Main telemetry | Per-project provider switch |
|---|---|---|---|---|
| **Claude Code** | `.claude/settings.local.json` / `.claude/settings.json` | `~/.claude/settings.json` | `statusLine` + transcript JSONL | **yes**, via `env`, but it requires a new process |
| **Codex** | `.codex/config.toml` in a trusted repo | `~/.codex/config.toml` | rollout JSONL + hooks; app-server where useful | **not natively**: `model_provider` and `model_providers` are machine-local |

### 2.2 Provider

A provider describes models, compatible transports, endpoints, capabilities, discovery and pricing.
The same provider can support different runtimes through different protocols.

DeepSeek example as of 24 September 2026:

```text
DeepSeek
├─ Claude Code → Anthropic API → https://api.deepseek.com/anthropic
└─ Codex       → Responses API → https://api.deepseek.com
```

DeepSeek officially documents both formats and a dedicated guide for Codex. So compatibility must
not be encoded as a property of the provider in general, but as a **transport per
runtime**.

### 2.3 The common contract

The core reasons about normalized objects:

```ts
RuntimeId = "claude" | "codex"
ProviderId = string
ModelId = string

Selection = {
  runtime,
  provider,
  model,
  effort?,
  serviceTier?
}

LiveSession = {
  runtime,
  sessionId,
  projectRoot,
  provider?,
  model,
  effort?,
  usage?,
  context?,
  limits?,
  cost?,
  subagents?,
  state: "idle" | "working" | "needs-attention" | "error"
}
```

The core does not know how Claude writes JSONC or how Codex reads TOML. The adapters do.

---

## 3. Verified facts about the runtimes

### 3.1 Claude Code

These points remain the foundation of the Claude adapter.

1. Settings have multiple scopes and project files can contain `env`; the most specific level
   wins for the keys concerned.
2. The process environment variables (`ANTHROPIC_BASE_URL`, token, default model per family)
   are essentially **set at birth**: switching provider requires a new process/session.
3. The `model` key and the effort controls are designed to change during a session; `/model`
   and `/effort` remain the native surfaces.
4. `apiKeyHelper` is the right mechanism to let Claude Code read a credential materialized
   outside the repository without putting the token in the project file.
5. `modelPicker` and the custom options make non-native IDs appear in Claude's picker;
   the extension's catalog must track only the rows it owns.
6. The `statusLine` receives JSON on stdin and today exposes much more than the minimum originally
   used: `model`, `session_id`, `session_name`, `transcript_path`, `workspace.project_dir`, session
   cost, duration, lines changed, context, usage of the last API call, live effort, rate limits,
   prompt cache statistics, PR/MR and worktree.
7. `context_window.current_usage` contains `input_tokens`, `output_tokens`,
   `cache_creation_input_tokens`, `cache_read_input_tokens`. There is no need to tokenize the text
   by hand.
8. `cost.total_cost_usd` is a **client-side estimate** at list price unless there is a
   `modelPricing` table; it is useful as a comparison, not as billing truth for third-party
   providers.
9. `rate_limits` is present for claude.ai Pro/Max subscriptions or gateways that expose a spend
   limit, after the first response. Each window can be missing independently.
10. `prompt_cache` includes warm state, hit ratio, requests, misses, cache write tokens, miss causes
    and TTL. It is an excellent source for "cache health", not only for cost.
11. The transcript remains the source for the sequence of responses and per-turn usage. Rows
    can be re-persisted: the sum must deduplicate by response identity, never by
    plain row count.
12. `claudeCode.claudeProcessWrapper` remains a lever to try, not a requirement: it can inject
    environment before the process is born, but on its own it does not solve credential storage.

Main sources: Claude Code documentation for `settings`, `model-config`, `authentication`,
`statusline`, `corporate-launcher`, rechecked on 24 September 2026.

### 3.2 Codex

Codex carries the same concepts, but with different contracts.

1. CLI and IDE extension share the configuration layers: `~/.codex/config.toml` and the
   `.codex/config.toml` of a trusted project.
2. The documented precedence puts CLI overrides above project files, then profile, user,
   managed and system.
3. For security the project layer **cannot override** `model_provider`, `model_providers`,
   sensitive base URLs, notifications/telemetry and a few other keys. The open source code has an
   explicit denylist.
4. The project can still set `model`, `model_reasoning_effort` and other non-denied
   preferences: so per-project model switching is supportable without inventing a proxy.
5. Custom providers speak `wire_api = "responses"`: Responses is the protocol supported for
   custom providers.
6. DeepSeek natively supports the Responses API and exposes an official Codex guide; so
   DeepSeek is supportable by both Claude and Codex with the same `ProviderDescriptor`, but two
   transports.
7. Codex sessions are rollout JSONL files under `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`.
   `session_meta` includes at least `session_id`, `cwd`, `source`, `cli_version`, `model_provider`
   and other metadata; this allows associating the session with the project.
8. The `token_count` events expose cumulative and last-turn usage: input, cached input,
   cache-write input in current versions, output, reasoning output, total, context window and
   rate limits when present.
9. Codex rate limits are already structured in `primary`/`secondary` windows with `used_percent`,
   duration and `resets_at`; there may also be credits, spend controls, additional limits and
   `plan_type`.
10. Rollouts are an excellent local source for the HUD, but must not be elevated to a stable API for
    invasive operations. When a structured contract is needed, the app-server exposes schemas and
    RPCs such as `model/list` and rate limit reading.
11. Codex has native hooks for `SessionStart`, `SessionEnd`, `PermissionRequest`,
    `SubagentStart`, `SubagentStop`, `Stop`, `Interrupt`, tool use and compact. This makes the
    "needs you / finished" notifications more robust than the heuristic on the transcript.
12. The Codex model manager has a catalog, cache and refresh. The app-server `model/list` returns
    display name, reasoning efforts, service tiers, input modalities, visibility, upgrade and
    retirement date when available.
13. It is not advisable to parse `codex debug models` automatically: the command can print very
    bulky internal fields and the catalog format can change between client versions. Prefer
    `model/list`/a cache compatible with the client.

### 3.3 An important consequence

**"Provider per project" cannot be a uniform feature.**

- Claude: possible, but some variables require a new process.
- Codex: model provider deliberately machine-local; the project can choose model/effort, not
  redefine where credentials go.

The QuickPick must therefore show capabilities, not fake symmetry:

```text
Codex · project X
Provider: DeepSeek        [machine]
Model:    deepseek-flash  [project]
Effort:   high            [project]
```

If the user asks "switch Codex from OpenAI to DeepSeek", the extension modifies the user layer with
explicit consent and flags that the change affects **Codex on the machine**, not only that repo.

---

## 4. The definitive features

The features are divided into **Core**, **Live data**, **Automation** and **Convenience**. All use
the same normalized model; only the runtime adapter changes.

### F1 — Agent-aware status bar

A single status bar follows the active project/folder and shows the runtime actually observed.
Default format, compact:

```text
◉ Claude · DeepSeek Flash · high · 42 tok/s
◉ Codex  · GPT-6 Astra · xhigh · 118K/272K
```

Optional configurable elements: session cost, most critical quota, cache state. There is no attempt
to put everything in the line; the tooltip is the rich surface.

**Acceptance:** with several windows/projects open you can tell at a glance who is working,
with which model and whether there is a mismatch.

### F2 — Tooltip as "Agent HUD"

The tooltip unifies, when available:

- runtime, provider, model ID and display name;
- declared and live effort;
- context used / window;
- last-turn and cumulative session tokens;
- prompt cache hit ratio / warm / expiry;
- model throughput and turn throughput;
- session cost and origin of the calculation;
- rate-limit / subscription windows with reset;
- active subagents;
- desired vs live when they diverge;
- timestamp of the last catalog and pricing refresh.

### F3 — Runtime → provider → model picker

Clicking the status bar opens a QuickPick consistent with the capabilities:

1. runtime active or to be configured (`Claude Code`, `Codex`);
2. providers compatible with that runtime;
3. models available per provider and runtime;
4. effort/service tier when the runtime exposes them.

The menu also shows `New`, `Deprecated`, `Unverified`, `Requires restart`, `Machine only`.

**Acceptance:** an automatically discovered model appears without a new release of the extension.

### F4 — Model switch with minimal impact

The runtime adapter exposes `applySelection()` and returns one of these outcomes:

```ts
"live" | "session-restart" | "window-reload" | "machine-scope" | "unsupported"
```

Claude: intra-provider model switch preferably live; provider switch requires a new session
for the birth variables. Codex: model/effort via project config where supported; provider via
user config with a machine-scope warning.

**Acceptance:** the UI never declares "applied" before the live state confirms the selection.

### F5 — Credential management

Claude: master in VS Code `SecretStorage`, materialization outside the repo for `apiKeyHelper`.
Codex: prefer the native authentication mechanism of the provider/runtime; for custom providers
the extension can configure the variable name (`env_key`) but does not write secrets into the
project TOML.

Common rule: **no secrets in the repository and no catalog containing tokens.**

### F6 — Throughput

For Claude we keep using the real usage from the transcript and, when available,
`cost.total_api_duration_ms` as the API denominator. For Codex we use the rollout's token
snapshots with the turn timestamp.

Two metrics are distinguished:

- **model throughput:** output tokens / API time, when the runtime provides a suitable denominator;
- **turn throughput:** output tokens / wall-clock time of the turn.

The tooltip says which one is being shown. Exponential smoothing on the displayed value.

### F7 — Real token usage, not a tokenizer estimate

The product does not reconstruct tokens from the text when the runtime already has the API usage.

Common schema:

```ts
type Usage = {
  input: number;
  cachedInput?: number;
  cacheWriteInput?: number;
  output: number;
  reasoningOutput?: number;
  total?: number;
};
```

Claude maps `input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`,
`output_tokens`. Codex maps the `TokenUsage` fields of the rollout/app-server.

**Acceptance:** the session total comes from deduplicated/cumulative snapshots, not from the naive
sum of JSONL rows.

### F8 — Context & cache health

The context uses the runtime's live value, not a window hardcoded in the catalog when runtime
telemetry is available. The catalog remains the fallback and the source for third-party models
before the first turn.

Claude adds a particular advantage: `prompt_cache` can show hit ratio, warm state, TTL,
misses and miss cause. The tooltip can therefore say:

```text
Context        118K / 1.0M
Prompt cache   91% hit · warm · expires in 34m
Last miss      tools_changed (+2 tool)
```

### F9 — Unified subscription / account limits

Limits are not modeled as hardcoded "5h + 7d". Arbitrary windows are normalized:

```ts
type LimitWindow = {
  id: string;
  label?: string;
  usedPercent: number;
  windowMinutes?: number;
  resetsAt?: number;
  kind: "rate" | "spend" | "credits" | "other";
};
```

Claude can provide `five_hour`, `seven_day` and `spend_limit`. Codex can provide primary,
secondary, additional rate limits, credits and spend control, as well as the plan type.

The UI does not infer the duration from the name: it uses the real `windowMinutes`/`resetsAt` when
present.

**Acceptance:** if the backend changes the duration of a window or introduces a new limit, the
parser shows it without requiring a release.

### F10 — Alerts and burn rate

Configurable thresholds, visual-only by default; opt-in notifications:

- warning at 75%;
- critical at 90%;
- countdown to reset;
- burn rate: "at this pace the window runs out in ~40 min".

The projection is explicitly marked as an estimate. No "token → subscription %" equivalence:
providers may apply non-public weights and the runtime counters remain the authoritative source.

### F11 — Reactive and preventive fallback

Two modes:

- **reactive:** 401/402/429/timeout or a runtime declaring the quota exhausted;
- **preventive:** quota/burn rate threshold exceeded before a new operation.

Per-project policy:

```text
manual            → only warns
ask-before-limit  → proposes the next provider/model
automatic         → switches if the runtime capability allows it and the policy authorizes it
```

On Codex the provider switch is machine-scope: automatic cross-provider fallback is therefore
**disabled by default** until a safe per-thread/per-project mechanism exists. Automatic fallback can
instead switch model within the same provider.

### F12 — Live model catalog

This is a central feature, not an accessory manual command.

Each provider/runtime can have a chain of sources:

```text
ModelSource
1. official structured API/catalog
2. runtime-native catalog
3. official page parser
4. bundled catalog
5. last-known-good cache
```

Rules:

- prefer structured APIs to scraping;
- fetch with ETag/Last-Modified when available;
- configurable TTL (default 6h);
- refresh on activation only if the cache is stale;
- manual refresh always available;
- no new model becomes "verified" without a probe compatible with the runtime;
- a model that disappears becomes `deprecated/missing`, it is not removed from configurations.

**DeepSeek:** `GET /models` is the primary source and today returns `deepseek-flash` and
`deepseek-v4-pro`. The static catalog serves only as bootstrap/fallback.

**Codex/OpenAI:** prefer the app-server's `model/list` / the client's model manager, because it
contains reasoning efforts, service tiers, availability, upgrade/retirement and reflects the
client/account.

### F13 — Pricing auto-update

Pricing is a source separate from the model catalog.

```ts
type PricingSnapshot = {
  provider: string;
  model: string;
  currency: string;
  unit: number;
  rules: PricingRule[];
  fetchedAt: string;
  effectiveFrom?: string;
  source: string;
  confidence: "structured" | "parsed-official-page" | "manual";
};
```

If there is no pricing API, **only the official page** may be parsed, with a provider-specific
parser. Generic scraping of third-party sites does not enter the product.

DeepSeek shows why rules are needed, not four numbers: today it distinguishes cache hit, cache
miss, output and peak/off-peak bands. OpenAI can distinguish input, cached input, cache writes,
output, short/long context and service tier. The engine must therefore receive usage + timestamp +
context + service tier.

### F14 — Cost meter

Cost is calculated per turn and per session when the data are sufficient.

Possible states:

```text
exact-from-observed-usage-and-current-rate
estimated-missing-dimension
runtime-reported-estimate
unavailable
subscription-not-dollar-metered
```

For API keys/pay-as-you-go providers the calculated cost is shown. For Codex/Claude sessions
included in a subscription, tokens are not artificially converted into "dollars spent from the
subscription": quota, credits and/or API cost are shown only if semantically correct.

In the development tooltip the calculated cost can be compared with the runtime-reported cost to
uncover wrong mappings.

### F15 — "Cache saved"

When the provider publishes distinct prices for cache hit/read input and normal input, the engine
can also calculate:

```text
actual input cost
hypothetical cost without cache
cache savings = hypothetical - actual
```

It is presented as an **estimate of savings at list price**, not as an actual credit on the invoice.

### F16 — Change detection

Every refresh produces a diff against the last valid snapshot. Types of change:

```text
model.added
model.removed
model.alias-changed
model.capability-changed
model.context-changed
model.retirement-announced
pricing.changed
pricing.schedule-changed
subscription.window-changed
subscription.new-limit
subscription.plan-changed
```

The UI shows a discreet badge in the picker:

```text
✨ 2 updates
DeepSeek V5 Pro       new model
GPT-6 Astra           xhigh → max available
DeepSeek Flash        output -12%
Codex weekly          reset/window changed
```

For subscription limits change detection is **descriptive**; it does not interpret a single jump in
percentage as a contractual change. It distinguishes:

- **schema/policy change:** window duration, new bucket, new plan type, new spend control;
- **usage update:** used percentage varying normally;
- **anomaly candidate:** reset timestamp jumping backwards or an inconsistent counter; log and
  tooltip, no conclusions about the cause.

### F17 — Subagent observability

Unification of Claude's `subagentStatusLine`/available telemetry and Codex's `SubagentStart` /
`SubagentStop` hooks.

Status bar: `⛓ 3` when there are active subagents. Tooltip per agent:

```text
researcher   GPT-6 Astra · high · 18K tok · running
reviewer     DeepSeek Flash · high · 31K tok · done
```

Cost per subagent only when usage can be reliably attributed; otherwise the total is shown and it
is stated that it cannot be separated.

**The contract with Daiku.** Daiku orchestrates subagents and knows what Kaji does not see — role
and phase of the chain — while Kaji knows model, tokens and cost. F17 is the point where the two
views meet, and the first contract between the two products is the schema of these events. It
remains to be decided who owns it and how it is kept aligned, under a constraint that is not
negotiable: neither product reads a file of the other, so each carries its own versioned copy. Kaji
works in full without Daiku; if Daiku is there, F17 also shows role and phase, otherwise it degrades
silently to the runtime's view.

### F18 — Attention notifications

Normalized events:

```ts
"turn-started"
"turn-completed"
"permission-required"
"blocked"
"subagent-started"
"subagent-stopped"
"error"
```

Codex uses native hooks (`PermissionRequest`, `Stop`, `SubagentStart/Stop`). Claude first uses
hooks or official signals if available in the build; transcript/statusLine remain the observational
fallback.

Desktop/VS Code notifications opt-in and deduplicated. No popup for every turn by default.

### F19 — Named presets and onboarding

A preset is portable and **secret-free**:

```json
{
  "name": "Coding cheap",
  "runtime": "claude",
  "provider": "deepseek",
  "model": "deepseek-flash",
  "effort": "high",
  "fallback": ["glm"],
  "alerts": { "warn": 75, "critical": 90 }
}
```

Commands: create, apply, export, import. On first activation in a project without configuration,
the extension offers presets or "follow current runtime", without writing anything until the user
chooses.

### F20 — Session browser (post-MVP)

A real demand, but not necessary for the first milestone. The two runtimes have transcripts/session
stores sufficient to show recent sessions per project with title, model, date, tokens and cost.
Resume, however, must use a command/API supported by the runtime; DBs or index files are not
manipulated directly to open sessions.

---

## 5. Catalog: data, not code

The bundled catalog is the **bootstrap**, not the eternal truth.

```jsonc
{
  "id": "deepseek",
  "label": "DeepSeek",
  "modelsSource": {
    "kind": "openai-models-api",
    "url": "https://api.deepseek.com/models",
    "auth": "provider"
  },
  "pricingSource": {
    "kind": "official-page-parser",
    "url": "https://api-docs.deepseek.com/quick_start/pricing/"
  },
  "transports": {
    "claude": {
      "protocol": "anthropic",
      "baseUrl": "https://api.deepseek.com/anthropic"
    },
    "codex": {
      "protocol": "responses",
      "baseUrl": "https://api.deepseek.com"
    }
  },
  "models": []
}
```

### 5.1 Normalized ModelDescriptor

```ts
type ModelDescriptor = {
  id: string;
  label: string;
  aliases?: string[];
  contextWindow?: number;
  maxOutput?: number;
  modalities?: ("text" | "image" | "audio")[];
  reasoningEfforts?: string[];
  defaultEffort?: string;
  serviceTiers?: { id: string; label: string }[];
  supportsTools?: boolean;
  supportsVision?: boolean;
  supportsReasoning?: boolean;
  runtimeCompat: Record<RuntimeId, "verified" | "candidate" | "unsupported">;
  retirementAt?: number;
  source: CatalogSourceRef;
};
```

The catalog does not invent missing capabilities. An unknown field stays `undefined`, not `false`.

### 5.2 Merge

Order of precedence:

```text
explicit user override
→ remote verified current snapshot
→ bundled catalog
→ historical last-known-good (only for vanished objects, marked stale)
```

User overrides can rename labels/colors, add private providers and correct metadata, but they do
not automatically turn an unverified transport into a verified one.

### 5.3 Discovery and probe

A new model ID goes through states:

```text
discovered → metadata-partial → probe-pending → verified
                               ↘ probe-failed → visible with warning / hidden according to policy
```

The probe must be minimal and respect costs: prefer metadata/capability endpoints when they
exist; a real 1-token message only when necessary and with consent if it incurs spending.

---

## 6. Auto-update without auto-corruption

### 6.1 Scheduling

Default:

- on activation: use the cache immediately;
- after activation: refresh only if cache > 6h;
- optional periodic refresh during long sessions: 6h;
- manual refresh: always;
- backoff on network; no aggressive retry.

### 6.2 Pipeline

```text
fetch
→ response size limit
→ parse
→ schema validation
→ sanity checks
→ normalize
→ diff against current snapshot
→ persist snapshot candidate
→ atomically promote to last-known-good
→ emit change events
```

Any failure before promotion leaves the previous snapshot intact.

### 6.3 Pricing sanity checks

Examples:

- positive unit and known currency;
- no negative price;
- no jump >100× without requiring confirmation/a high-severity log;
- all time bands cover or declare the default;
- `effectiveFrom` is not invented if the page does not expose it;
- an HTML parser that finds zero rows = failure, not "all prices are zero".

### 6.4 Local history

Keep the last N compact snapshots (default 20) per provider, without secrets. It serves to:

- explain "what changed";
- diagnostic rollback;
- not show the same badge again at every startup;
- distinguish a temporary variation from a persistent change.

---

## 7. Tokens, cost and pricing: the correct semantics

### 7.1 Live tokens vs cumulative tokens

They are two different numbers:

```text
context current usage  → what occupies the context right now
session cumulative     → what has been billed/consumed over time
```

After compact, resume or cache, they do not coincide. The UI must name them correctly.

### 7.2 Claude deduplication

The transcript may re-persist the same message with identical usage. Preferred identifier:
`message.id` + any request/prompt identity. If missing, a stable fingerprint of the relevant record.
The read offset avoids re-reads, but does not replace semantic deduplication.

### 7.3 Codex cumulatives

When Codex provides `total_token_usage`, that is preferable to summing events. Events may be
re-emitted together with rate-limit updates. The adapter keeps the last total per session and
computes monotonic deltas; a regression of the total opens a new segment (resume/reset/version
change), it does not produce negative tokens.

### 7.4 Pricing engine

The engine contains no `if provider === ...` in the core. Rules are provider-specific
data/expressions compiled into a common form.

Calculation input:

```ts
{
  model,
  timestamp,
  usage,
  contextInputTokens?,
  serviceTier?,
  region?,
  runtime?,
  providerMetadata?
}
```

Output:

```ts
{
  amount,
  currency,
  confidence,
  components: [
    { kind: "input", tokens, rate, amount },
    { kind: "cache-read", tokens, rate, amount },
    { kind: "cache-write", tokens, rate, amount },
    { kind: "output", tokens, rate, amount }
  ],
  assumptions: string[]
}
```

### 7.5 “Exact” means exact with respect to the observed data

The product may call a cost `exact` only if:

- all billed buckets are observable;
- the price list applicable at the timestamp is known;
- any tier/context thresholds are known;
- the runtime/provider does not hide relevant surcharges.

Otherwise `estimated`. This matters for OpenAI/Codex: the evolution of the cache-write and
service tier fields must be tracked, and old runtime versions may not persist every dimension.

---

## 8. Subscription limits and change detection

### 8.1 Do not hardcode Plus/Pro/Max

The extension does not maintain a table like “Plus = X prompts”. Real limits may depend on
model, period, account, workspace, promotions and server-side policy. It shows the counters the
runtime returns.

### 8.2 Snapshot

```ts
type LimitsSnapshot = {
  runtime: RuntimeId;
  accountHint?: string; // never email/token; only a non-sensitive label if already exposed by the runtime
  planType?: string;
  windows: LimitWindow[];
  credits?: { balance?: string; unlimited?: boolean };
  capturedAt: number;
};
```

### 8.3 Limit change detection

The diff ignores normal variations of `usedPercent`. It notifies only structural mutations:

- different `windowMinutes` duration;
- reset policy changing persistently;
- secondary window appears/disappears;
- new limit ID;
- `planType` changes;
- spend control / credits appear;
- a limit's label changes.

A reset timestamp that changes on its own may be a normal update or an upstream bug: it is
recorded as `anomalyCandidate`, not as “OpenAI/Anthropic changed the contract”.

### 8.4 Thresholds

Alerts are computed on the live snapshot, not on the change history. If the runtime does not return
rate limits, the extension does not try to reconstruct them from tokens.

---

## 9. State, desired state and conflicts

For each project there are three conceptual levels:

```text
DesiredSelection   → what the project/preset asks for
ConfiguredState    → what the runtime files say
ObservedSession    → what the session is actually using
```

The status bar uses `ObservedSession` when present. If it differs:

```text
$(debug-restart) Codex · GPT-6 Luna → desired Astra
```

The tooltip explains the cause: file modified but thread not restarted, machine-scope provider,
session resume keeping the previous model, etc.

---

## 10. Security and privacy

- No prompt or transcript is sent to the extension's servers: there is no server.
- The catalog/pricing refresh calls only configured/official provider endpoints and sends no
  conversation content.
- The pricing parsers read public pages without keys when possible.
- Keys never enter logs, tooltips, snapshots or change history.
- Transcripts are read locally and incrementally.
- Runtime files are not re-serialized destroying comments or formatting when a suitable
  structural editor exists.
- Machine-scope changes (e.g. Codex provider) require explicit confirmation and an indication of the
  scope.
- No fallback automation crosses accounts/providers with different secrets without an explicit
  user policy.

---

## 11. What is not built

1. **Generic proxy/translator.** A model incompatible with the runtime's protocol stays out.
2. **Webview dashboard in the first milestone.** Status bar + tooltip + QuickPick + Output Channel are
   enough; a webview is justified only if the history/change timeline becomes too rich.
3. **Billing reconciliation.** Cost is local observability, not an accounting invoice.
4. **Arbitrary web scraping.** Only APIs or official pages with a versioned parser.
5. **Automatic Claude multi-account** until the panel/runtime exposes a reliable lever.
6. **Direct manipulation of the Codex DB to change or resume threads.** Files/DB may be read
   for diagnostics only where necessary; actions go through supported config/API/commands.
7. **Mandatory Marketplace.** The first cycle stays a local VSIX; publishing is a separate
   decision.

---

## 12. Milestones

### M0 — Blocking tests, before the product

1. Claude: is `.claude/settings.local.json` honored by the VS Code panel?
2. Claude: does `model` really change hot without `ANTHROPIC_MODEL` overriding it?
3. Claude: does `apiKeyHelper` work with Bearer on third-party providers?
4. Claude: does the VS Code panel run the statusLine? If not, what data remain available via
   transcript/hooks?
5. Claude: does the statusLine tee preserve stdout, exit code, colors and multi-line output of the original
   command?
6. Claude: identify the cleanest command to restart a session, without hardcoded IDs.
7. Claude: verify `claudeProcessWrapper` on the current Windows build.
8. Claude: verify current merge/scope of `modelPicker`, `modelSettings` and effort on third-party models.
9. Codex: is `.codex/config.toml` written by the extension applied by the panel/IDE to the new
   session, and how does it behave on an already open thread?
10. Codex: confirm path/session matching `cwd` and the `token_count` format on the installed build.
11. Codex: try the `PermissionRequest`, `Stop`, `SubagentStart/Stop` hooks from the IDE extension.
12. Codex: try `app-server model/list` and account rate limits without leaving orphan processes.
13. Codex: DeepSeek provider via Responses API using the official configuration.
14. Catalog: DeepSeek `GET /models` + diff + new fake model in a fixture.
15. Pricing: DeepSeek parser with a saved HTML fixture and fail closed when the structure changes.
16. Cost: compare Kaji usage/cost with runtime/provider cost over at least 20 turns.
17. Limits: verify Codex primary/secondary and Claude five_hour/seven_day on real sessions.
18. Notifications: a done/permission event produces a single notification, not duplicates.

### M1 — Core usable every day

F1–F9, bundled catalog, complete Claude adapter, Codex model/usage/limits, Secret handling,
status bar, picker, unit tests.

### M2 — Live catalog + cost

F12–F16: discovery, pricing refresh, cost engine, change detection, cache saved.

### M3 — Automation

F10–F11, F17–F19: alert, burn rate, fallback, subagent observability, notifications, preset.

### M4 — Convenience

Session browser, timeline of changes and possibly a webview only if really needed.

---

## 13. Expected experience

### First launch

```text
Kaji found:
✓ Claude Code
✓ Codex

This project has no Kaji preset.
[Follow current configuration] [Choose preset] [Ignore]
```

No automatic writes.

### New model discovered

```text
$(sparkle) Catalog updated · 1 new item
DeepSeek V5 Pro

Compatibility
✓ Claude Code / Anthropic
✓ Codex / Responses

[Try] [Hide new items]
```

If the probe costs money, the `Try` button asks for consent before sending the request.

### Price changed

```text
DeepSeek Flash · pricing updated
Output peak: $1.20 → $1.05 / 1M
Source: official pricing page
Valid from: not stated
```

No configuration is rewritten.

### Critical limit

```text
Codex · 5h 92% · reset in 31m
Weekly 54%

[Switch to cheaper model] [Ignore until reset]
```

Cross-provider only if the action is compatible with scope and policy.

---

## 14. Current data verified on 24 September 2026

This section is a snapshot, not a contract: it exists precisely to be superseded by the live catalog.

### DeepSeek

`GET https://api.deepseek.com/models` currently documents:

- `deepseek-flash` — DeepSeek V4.1 Flash;
- `deepseek-v4-pro` — DeepSeek V4 Pro.

The official pricing page states 1M context, 384K maximum output and support for both Anthropic API and
Responses API for both; `deepseek-flash` supports vision, V4 Pro does not. Prices distinguish cache
hit/miss/output and peak/off-peak. Peak: 01:00–04:00 and 06:00–10:00 UTC Mon–Fri; off-peak half of
peak. These values **must not be hardcoded as permanent truth**: the pricing parser and the
remote snapshot are the correct mechanism.

### DeepSeek pricing snapshot (reference only, 24 September 2026)

The values below serve as a fixture and for human verification of the parser, **not** as a hardcoded
product table. Prices per 1M tokens:

| Model | Band | Input cache hit | Input cache miss | Output |
|---|---|---:|---:|---:|
| `deepseek-flash` | off-peak | $0.003 | $0.15 | $0.60 |
| `deepseek-flash` | peak | $0.006 | $0.30 | $1.20 |
| `deepseek-v4-pro` | off-peak | $0.022 | $0.66 | $1.98 |
| `deepseek-v4-pro` | peak | $0.044 | $1.32 | $3.96 |

The parser must also extract the schedule: peak 01:00–04:00 and 06:00–10:00 UTC, Monday–Friday;
the other hours are off-peak. If DeepSeek changes this rule, `pricing.schedule-changed` must be
a change event distinct from a simple rate change.

### OpenAI pricing snapshot (example that justifies the rule engine)

As of 24 September 2026 GPT-5.6 Sol is documented at $4/1M input, $0.40/1M cached input and $20/1M output
in the base case; cache writes 1.25× the non-cached input. For prompts with more than 272K input tokens, the
model applies 2× to input and 1.5× to output for the whole request. The pricing page also exposes
short/long context columns and service/processing variants for current families.

This is exactly why `PricingRule` receives timestamp, context size and service tier:
an `{input, output}` object is no longer enough. These values too are test snapshots, not product
constants.

### Codex model catalog

The current open source catalog contains structured metadata such as context window, reasoning
levels, input modalities, service tiers, per-plan availability, upgrade and retirement. The extension
does not import the `main` file directly because schema and client may diverge: it uses the catalog
of the installed client through the model manager/app-server.

---

## 15. Migration from the current Claude setup

Only after a working M1:

1. import the keys from `~/.claude/llm-switch.secrets.json` into SecretStorage; rotate the key
   already exposed in plain text where appropriate;
2. gradually remove the global `env` block from `~/.claude/settings.json` once the important
   projects have a working local configuration;
3. stop using `llm-switch.ps1`;
4. delete the duplicate VS Code tasks last;
5. leave a `Kaji: Diagnose migration` command that detects leftovers that could still take
   precedence.

Codex does not require an initial destructive migration: the adapter starts by reading the existing layers and
writes only after explicit action.

---

## 16. References verified on 24 September 2026

### Claude Code

- Settings: https://code.claude.com/docs/en/settings
- Model configuration: https://code.claude.com/docs/en/model-config
- Authentication: https://code.claude.com/docs/en/authentication
- Status line: https://code.claude.com/docs/en/statusline
- Corporate launcher / process wrapper: https://code.claude.com/docs/en/corporate-launcher
- Environment variables: https://code.claude.com/docs/en/env-vars
- VS Code integration: https://code.claude.com/docs/en/vs-code

### Codex / OpenAI

- Config basics: https://developers.openai.com/codex/config-basic
- Config reference: https://developers.openai.com/codex/config-reference
- Hooks: https://developers.openai.com/codex/hooks
- Codex repository: https://github.com/openai/codex
- App-server model/list schema: https://github.com/openai/codex/tree/main/codex-rs/app-server-protocol/schema/json/v2
- Current bundled model catalog: https://github.com/openai/codex/blob/main/codex-rs/models-manager/models.json
- OpenAI API pricing: https://developers.openai.com/api/docs/pricing

### DeepSeek

- List models: https://api-docs.deepseek.com/api/list-models/
- Models & pricing: https://api-docs.deepseek.com/quick_start/pricing/
- Responses API: https://api-docs.deepseek.com/api/create-response/
- Codex integration: https://api-docs.deepseek.com/quick_start/agent_integrations/codex/
- Change log: https://api-docs.deepseek.com/updates/

### Issues/edge cases useful for the design

- Codex project-local provider denylist/regression reports:
  https://github.com/openai/codex/issues/21769
- Codex token/rate-limit JSONL examples:
  https://github.com/openai/codex/issues/19022
- Codex rate-limit schema/tests:
  https://github.com/openai/codex/blob/main/codex-rs/app-server/tests/suite/v2/rate_limits.rs
- Codex model catalog cross-version incompatibility:
  https://github.com/openai/codex/issues/38934
- Codex debug models exposure caveat:
  https://github.com/openai/codex/issues/43705

---

## 17. Success criterion

The product has hit the problem when, on opening a project, without reading files and without
remembering commands, these questions can be answered immediately:

1. **Which agent is working?**
2. **Where is it sending requests?**
3. **Which model/effort is it really using?**
4. **How much context and how many tokens is it consuming?**
5. **How much does it cost, when talking about cost makes sense?**
6. **How much subscription/quota is left and when does it reset?**
7. **Is the cache helping or being rebuilt?**
8. **Are there active subagents, or is the agent waiting for me?**
9. **Has a model come out, has a price or a limit policy changed, without me updating
   the extension?**
10. **If I change model/provider, what really happens and at which scope?**

If an answer is not knowable from the runtime, the extension says “not available”. That is a
reliability feature, not a shortcoming to be masked.

---

## 18. Real baseline of the machine the project originates from

This section is deliberately concrete. It comes from the document of 23 September 2026 and serves the
migration; **it is not a general product specification**.

### 18.1 Existing script

`~/.claude/llm-switch.ps1` knows four profiles and rewrites the `env` block of the user settings:

| Profile | Claude/Anthropic endpoint | Main model | Side-query/subagent |
|---|---|---|---|
| `claude` | no override | `opus[1m]` | default subscription |
| `deepseek` | `https://api.deepseek.com/anthropic` | `deepseek-flash` | `deepseek-flash` |
| `muse` | `https://api.meta.ai` | `muse-spark-1.3-contributor` | same |
| `glm` | `https://api.z.ai/api/anthropic` | `glm-5.3[1m]` | `glm-5.3-flash[1m]` |

Three properties of the old script must not be lost during the migration:

- it uses `ANTHROPIC_AUTH_TOKEN` for Bearer backends;
- it explicitly sets the real model IDs and the variables for side-queries;
- it sets the guards needed by third-party providers, including context limits and disabling
  unsupported betas when required by the provider.

The new extension does **not** blindly copy these variables: the catalog/transport descriptor
decides which are still necessary for the current provider and the current runtime.

### 18.2 Existing secrets

The legacy file `~/.claude/llm-switch.secrets.json` contains three keys (`deepseek`, `glm`, `muse`).
MiMo and OpenCode Go were candidate providers without a key at the time of the survey.

The DeepSeek token was also materialized in plain text in the user `env` block. The migration
is therefore not just “move the value”: it is the occasion to **rotate** the credential already exposed in the
file, then remove the legacy copy.

### 18.3 Claude state as of 23 September 2026

The active global profile was DeepSeek; `ANTHROPIC_MODEL` pinned `deepseek-flash`. This is
exactly the case the product must eliminate: a machine-global override that prevents the
project from expressing its own choice and can interfere with the live model change.

`effortLevel` was `xhigh` while the user `model` key still held a Claude value: another
reason to separate `ConfiguredState` and `ObservedSession`.

### 18.4 StatusLine already present

The machine already had a custom status line showing model, context usage and rate
limits. The extension's bridge must therefore prove it can **wrap an existing configuration
without altering it**, not merely work on an empty installation.

### 18.5 Transcript

Real Claude transcripts were already present under `~/.claude/projects/.../*.jsonl`, with events of
several types (`assistant`, `user`, attachment, queue operation, file-history snapshot and others). The new
reader must be tolerant: for usage purposes it selects the relevant events and ignores new types
without treating them as errors.

### 18.6 `switchModelsOnFlag`

The user settings contained `switchModelsOnFlag: false`. Its meaning had not been
verified. It remains an exploratory test, not a dependency: look for documentation/changelog of the
installed build; if there is no useful public contract, do not use it.

---

## 19. Provider baseline carried over from the previous project

The live catalog replaces the idea of maintaining a static table forever, but the bundled catalog
needs a bootstrap. This is the historical baseline to **re-verify provider by provider**
before release. Only DeepSeek was re-checked on the web on 24 September 2026 during this
rewrite.

| Provider | Claude transport | Codex transport | Bootstrap status |
|---|---|---|---|
| Anthropic/Claude | native | n/a as a project custom provider | Claude supported |
| DeepSeek | Anthropic API | Responses API | **verified 24 September** |
| GLM / Z.ai | Anthropic-compatible | Responses to be verified | Claude bootstrap |
| Muse | Anthropic-compatible per existing setup | to be verified | Claude bootstrap |
| MiMo | Anthropic-compatible; plan-dependent endpoint/region | to be verified | Claude bootstrap |
| OpenCode Go | only families served via the Anthropic route for Claude | Codex provider/route to be verified | partial |

### 19.1 MiMo

The previous document had verified an important distinction: the pay-as-you-go endpoint and the Token
Plan use different key formats, and the Token Plan is regional. The new catalog must therefore
represent **variant/region** as transport metadata, not create three providers with the same
label if the only difference is the region.

Discovery must be done from the models endpoint documented by the provider, not from a list
copied into the bundle when a structured source is available.

### 19.2 OpenCode Go

The old design filtered models by protocol: Claude Code can only use the families
that Go serves on the Anthropic route. This rule becomes general:

```text
model available on the provider
∩ transport compatible with the runtime
∩ current entitlement/account
= row shown in the picker
```

Do not show “greyed out” a model that would require a protocol translator: it is not almost
supported, it is another product.

---

## 20. “Add provider / model” wizard

This feature remains essential because the live catalog will not cover every private gateway or new
provider on day zero.

### 20.1 Entry points

- `Kaji: Add key` — known provider, missing credential;
- `Kaji: Add model` — model ID not present;
- `Kaji: Add provider` — new endpoint/private gateway.

### 20.2 Step 1 — Runtime and provider

First you choose where it must work:

```text
Runtime
○ Claude Code
○ Codex
○ Both, if the provider has two compatible transports
```

Then a known provider or `New provider…`.

For a new provider **only non-secret metadata** is asked:

- label;
- transport/protocol per runtime (`anthropic`, `responses`);
- base URL;
- auth style or Codex mechanism;
- any `/models` / model catalog endpoint;
- any official pricing page.

### 20.3 Step 2 — Model discovery

If a structured source exists, download the list and let the user choose. If it does not:

- model ID;
- label;
- context window if known;
- modality/capability if documented;
- effort support if documented.

An unknown field stays “unknown”; do not ask the user to guess `vision=false`.

### 20.4 Step 3 — Credential

PasswordInput only when the extension must own the key. If the runtime is already authenticated or
the provider uses an external env var, show `Use existing authentication`.

### 20.5 Step 4 — Two-stage verification

1. **auth/endpoint:** the credential reaches the provider;
2. **model/runtime:** the chosen ID responds on the transport actually used by Claude/Codex.

A valid key is not enough to declare “configured”: a wrong model ID is the failure most
easily deferred to the user's first prompt.

### 20.6 Step 5 — Runtime materialization

Claude:

- project selection in the local settings;
- apiKeyHelper if extension-managed;
- picker row/native discovery when appropriate;
- side-query model mapping only if required.

Codex:

- project `model`/effort when possible;
- provider definition user-level only;
- auth command/env according to ownership;
- model catalog compatible with the client when necessary.

The wizard explicitly presents the scope before saving:

```text
Model: this project
Codex provider: the whole machine / Codex profile
Key: user storage, never the repository
```

---

## 21. Synchronization with the native pickers

The Kaji picker must work even when the runtime's native picker does not yet know anything about the
model. Native synchronization is still desirable.

### Claude Code

- use owned/tracked `modelPicker` rows when that is the most stable mechanism;
- `ANTHROPIC_CUSTOM_MODEL_OPTION` remains useful for a single project-scoped model;
- the current documentation also exposes gateway model discovery from `/v1/models` when the related
  option is enabled: prefer native discovery when the provider/gateway truly falls within that
  contract, without forcing it on incompatible endpoints;
- do not use `replaceBuiltInOptions` unless explicitly requested: the default is append/non-destructive.

### Codex

- for OpenAI/ChatGPT models use the client's model catalog (`model/list`), not our own copy;
- for custom providers follow the format supported by the installed client and the provider's official
  configuration;
- do not inject the `models.json` of `openai/codex@main` into an old Codex: schema and client may
  diverge;
- if the native picker cannot be synchronized safely, **Kaji still shows the model in its own
  picker** and reports `native picker: not synchronized`.

This distinction prevents a cosmetic feature from blocking the main auto-discovery.

---

## 22. Status bar: states and visual priority

The line must stay readable. Priority order:

1. problem state;
2. runtime/model;
3. effort;
4. a single dynamic metric chosen by the user.

Examples:

| State | Example |
|---|---|
| active | `◉ Claude · DeepSeek Flash · high · 42 tok/s` |
| Codex | `◉ Codex · GPT-6 Astra · xhigh · 118K/272K` |
| missing key | `$(key) DeepSeek · missing key` |
| desired ≠ live | `$(debug-restart) GLM 5.3 · restart needed` |
| permission | `$(bell) Codex · awaiting permission` |
| working | `$(sync~spin) Claude · DeepSeek Flash` |
| error | `$(error) Agent Router` |
| no override | `$(circle-outline) Claude · subscription` |

For quota/cost the line can be configured:

```text
... · $0.18
... · 5h 82%
... · cache 91%
```

but the default does not exceed four segments. Everything else goes in the tooltip.

---

## 23. Credentials: operational detail

### 23.1 Claude extension-managed

The old principle stands: `SecretStorage` is canonical, an external helper must read a
plain-text materialization because the Claude process cannot query VS Code's encrypted
storage.

Invariants:

- file outside the repo;
- permissions as tight as possible;
- helper without network;
- no leftover `ANTHROPIC_AUTH_TOKEN` taking precedence and silencing the helper;
- reconciliation on activation;
- explicit delete when a key is removed from the product.

### 23.2 Codex

Do not impose SecretStorage if Codex already has working auth. The extension must know **who owns the
credential**, otherwise it risks creating two sources of truth.

For custom providers the user wants to manage from Kaji, Codex's command-backed auth allows
reusing the same key-helper. This must be tested end-to-end with the installed client before
promoting it to default.

### 23.3 Verification

Saving a new key without testing it is forbidden by the wizard, except for an explicit `Save without verifying`
for offline/corporate endpoints. In that case the state is `unverified`, not green.

---

## 24. Tests inherited from the old plan that remain open

The new M0 groups them, but these specific questions must not be lost:

- is removing a Claude `env` block enough to go back to the subscription, or is an empty value needed in
  some build/provider?
- can `claudeCode.environmentVariables` on the machine take precedence and interfere?
- does the Claude panel run statusLine with the same semantics as the CLI?
- does `cost.total_api_duration_ms` grow stably enough for model throughput?
- does a custom `modelPicker` appear in the VS Code panel, not only in the CLI?
- does `behavesAs`/capability metadata produce sensible effort/capability for third-party IDs?
- do `modelSettings` and per-model efforts honor the merge/scope documented by the current build?
- does each third-party provider expose balance/credit in a structured way or not?
- does the Claude process wrapper work on the real Windows build?
- is the user-level Codex custom provider honored in the same way by CLI and IDE?
- does the native Codex model picker follow the custom provider without leaving model/provider inconsistent?

Every answer updates the document; no code “because it probably works”.

---

## 25. Why these features before development

The expansion must not turn into scope creep. The features promoted now share one
property: **they change the data boundaries**, so they would cost much more if added later.

- Codex changes the `runtime` boundary.
- Live catalog changes the `static catalog vs source` boundary.
- Pricing changes the usage data model.
- Subscription limits prevent hardcoding `5h/7d`.
- Change detection requires snapshot/history from the start.
- Subagent/notifications require a common event model.

The session browser, on the other hand, can wait because it uses data already collected without changing the
core's boundaries.
