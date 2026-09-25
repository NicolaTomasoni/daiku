# Kaji — tech stack and architecture

Document regenerated on **September 24, 2026**. It accompanies `README.md`: the README defines the
product, its behavior and its acceptance criteria; this file defines **how** to build it, the module
boundaries, the contracts and the technical decisions together with their falsifier.

Starting machine of the original document: Node 22.23.2, npm 10.9.8, VS Code 1.139.0, private
development repository on GitHub, shared with Daiku. The first target remains a **TypeScript VS
Code extension packaged as a VSIX**, with no mandatory marketplace.

All paths in this document — `src/`, `test/`, `package.json` — are relative to the product root,
`extensions/kaji/`, which becomes the root of Kaji's public repository.

The main architectural change compared to the previous project is a single one, but it moves every
boundary:

> **the core is not Claude-specific. Claude Code and Codex are `RuntimeAdapter`s; DeepSeek, OpenAI,
> Anthropic, GLM, MiMo etc. are `ProviderAdapter`s. UI, catalog, pricing, usage, cost, limits,
> change detection and presets exist only once.**

---

## 1. Decisions made

| | Point | Decision | If we get it wrong, the cost is |
|---|---|---|---|
| P1 | Architecture | **core + runtime adapters + provider adapters** | **very high** |
| P2 | Bundler | **esbuild** | low |
| P3 | Bundle | **CommonJS**, `vscode` external | medium |
| P4 | TypeScript | **strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes** | medium |
| P5 | Tests | **Vitest + contract fixtures**, integration harness only with a concrete bug | medium |
| P6 | Lint/format | **Biome + ESLint typed rules only** | low |
| P7 | File watch | **VS Code RelativePattern + reconciliation rescan** | high |
| P8 | Writes | **per-path queue + atomic rename + retry** | high |
| P9 | Claude JSONC | **jsonc-parser, surgical edits** | high |
| P10 | Codex TOML | **parser for validation + limited surgical text patch** | high |
| P11 | HTTP | **global fetch + AbortSignal**, ETag/Last-Modified | low |
| P12 | Pricing scraping | **provider-specific parser, fail closed, no browser/headless** | medium |
| P13 | Storage | **product state outside repos; SecretStorage master; stable bridge on disk** | high |
| P14 | Sidecar | **pure CommonJS, zero dependencies, materialized** | high |
| P15 | Codex structured access | **app-server JSON-RPC only where it buys a stable contract** | medium |
| P16 | Catalog cache | **candidate snapshot → validate → atomic promote LKG** | high |
| P17 | Change detection | **versioned semantic diff, not a raw JSON diff** | medium |
| P18 | Pricing engine | **deterministic rule engine, no provider-if in the core** | high |
| P19 | Limits | **arbitrary windows, never hardcoded 5h/7d** | high |
| P20 | Logging | **structured LogOutputChannel, mandatory redaction** | high |
| P21 | i18n | **centralized English, no initial l10n framework** | low |
| P22 | CI | **one GitHub Actions job: check + package + fixture tests** | low |
| P23 | Runtime deps | **small budget, every dependency with a reason** | medium |

---

## 2. P1 — The architecture that avoids Claude/Codex duplication

### 2.1 The layers

```text
extension.ts
   │
   ├── UI
   │    ├── statusbar
   │    ├── quickpick
   │    ├── notifications
   │    └── commands
   │
   ├── Application services
   │    ├── session-controller
   │    ├── selection-controller
   │    ├── refresh-controller
   │    └── change-controller
   │
   ├── Core (zero vscode)
   │    ├── catalog
   │    ├── pricing
   │    ├── usage
   │    ├── cost
   │    ├── limits
   │    ├── changes
   │    ├── presets
   │    └── domain types
   │
   ├── Runtime adapters
   │    ├── claude/
   │    └── codex/
   │
   └── Provider adapters
        ├── deepseek/
        ├── anthropic/
        ├── openai/
        ├── glm/
        └── ...
```

The core **does not import `vscode` and does not read runtime files directly**. It receives
normalized DTOs and returns pure decisions. This is the condition that makes it possible to write
hundreds of fast tests.

### 2.2 RuntimeAdapter

```ts
export interface RuntimeAdapter {
  readonly id: RuntimeId;

  detect(ctx: RuntimeContext): Promise<RuntimeDetection>;
  capabilities(ctx: RuntimeContext): Promise<RuntimeCapabilities>;

  readConfiguredSelection(ctx: RuntimeContext): Promise<ConfiguredSelection>;
  applySelection(
    ctx: RuntimeContext,
    request: SelectionRequest,
  ): Promise<ApplySelectionResult>;

  observe(
    ctx: RuntimeContext,
    sink: RuntimeEventSink,
  ): Promise<DisposableLike>;

  listRuntimeModels?(ctx: RuntimeContext): Promise<RuntimeModelCatalog>;
  readLimits?(ctx: RuntimeContext): Promise<LimitsSnapshot | undefined>;

  diagnose(ctx: RuntimeContext): Promise<DiagnosticResult[]>;
}
```

`RuntimeCapabilities` declares the truth instead of scattering `if runtime === "codex"` across the UI:

```ts
type RuntimeCapabilities = {
  projectScopedModel: boolean;
  projectScopedProvider: boolean;
  liveModelSwitch: boolean;
  liveEffortSwitch: boolean;
  nativeLimits: boolean;
  nativeHooks: boolean;
  nativeModelCatalog: boolean;
  nativeCostEstimate: boolean;
};
```

### 2.3 ProviderAdapter

```ts
export interface ProviderAdapter {
  readonly id: ProviderId;

  discoverModels(ctx: ProviderContext): Promise<DiscoveryResult>;
  fetchPricing(ctx: ProviderContext): Promise<PricingFetchResult>;
  probeModel?(
    ctx: ProviderContext,
    runtime: RuntimeId,
    model: ModelDescriptor,
  ): Promise<ModelProbeResult>;

  transports(): Partial<Record<RuntimeId, ProviderTransport>>;
}
```

A provider may lack `fetchPricing`: in that case the cost meter stays `unavailable` or uses a
manual/bundled table marked as such.

### 2.4 Anti-duplication rule

A runtime module **may** know that DeepSeek uses `base_url`; it cannot compute the DeepSeek price.
A provider module **may** know the price and `/models`; it cannot know how to write
`.claude/settings.local.json`.

If a feature requires both kinds of knowledge, it is an application service orchestrating two adapters.

*Falsified by:* a fundamental capability that cannot be expressed without introducing many
runtime/provider branches into the core. In that case the contract is extended; the module is not copied.

---

## 3. Source layout

```text
src/
  extension.ts

  core/
    domain.ts
    catalog/
      merge.ts
      normalize.ts
      snapshot.ts
    pricing/
      model.ts
      engine.ts
      validate.ts
    usage/
      accumulate.ts
      dedupe.ts
    limits/
      normalize.ts
      burn-rate.ts
    changes/
      diff.ts
      classify.ts
    presets/
      schema.ts
      apply.ts

  app/
    project-context.ts
    runtime-registry.ts
    provider-registry.ts
    selection-controller.ts
    session-controller.ts
    refresh-controller.ts
    change-controller.ts
    diagnostics.ts

  runtimes/
    claude/
      adapter.ts
      config.ts
      jsonc.ts
      statusline.ts
      transcript.ts
      restart.ts
      hooks.ts
    codex/
      adapter.ts
      config.ts
      toml-edit.ts
      rollout.ts
      hooks.ts
      app-server.ts
      model-list.ts
      rate-limits.ts

  providers/
    deepseek/
      adapter.ts
      models.ts
      pricing.ts
      pricing-fixture.ts
    openai/
      adapter.ts
      pricing.ts
    anthropic/
      adapter.ts
    glm/
      adapter.ts
    mimo/
      adapter.ts

  infra/
    fsx.ts
    fetchx.ts
    cache-store.ts
    secret-materializer.ts
    node-path.ts
    child-process.ts
    clock.ts
    log.ts

  ui/
    statusbar.ts
    tooltip.ts
    quickpick.ts
    notifications.ts
    commands.ts
    strings.ts

test/
  fixtures/
    claude/
    codex/
    providers/
  contract/
  unit/
```

---

## 4. P2/P3 — esbuild + CommonJS

The choice of the original document is confirmed.

```text
esbuild src/extension.ts
  --bundle
  --platform=node
  --format=cjs
  --external:vscode
  --sourcemap
  --outfile=dist/extension.js
```

No minify: the VSIX stays local, and readable stack traces are worth more than a few KB.

`tsc --noEmit` is separate: esbuild transpiles, it does not type-check.

No native modules. The Extension Host's Node runtime changes with VS Code, and there is no point in
tying ourselves to the ABI for a product that can be entirely TypeScript/JS.

---

## 5. P4 — Strict TypeScript

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "isolatedModules": true,
    "noEmit": true
  }
}
```

This codebase is full of optional data coming from different runtime versions. The difference
between “absent field” and “false/zero” is semantic:

- absent effort ≠ low effort;
- absent `rate_limits` ≠ 0% used;
- absent price bucket ≠ free;
- absent `cacheWriteInput` ≠ 0 tokens written;
- absent transport ≠ transport not yet verified.

`exactOptionalPropertyTypes` therefore matters more now than in the Claude-only design.

---

## 6. P5 — Test strategy

### 6.1 Pyramid

```text
many      pure unit tests
          fixture/contract tests
few       adapter filesystem tests
very few  F5 real-runtime smoke tests
```

### 6.2 Vitest

Vitest remains the runner: native TS, fast watch, simple mocking, useful snapshots for normalized
DTOs and change diffs.

### 6.3 Contract fixture tests

They are the most important new piece. We keep **redacted** fixtures of:

- Claude statusLine payloads from several versions;
- duplicated Claude transcript lines;
- Codex rollouts `session_meta`, `token_count`, compact, rate limits;
- app-server `model/list` output and account limits;
- DeepSeek `/models`;
- DeepSeek pricing HTML/markdown;
- pricing pages with intentionally broken structure.

Every adapter has an “old fixture still parses” suite. A runtime update must not force us to always
test against the real network to find out that a field has moved.

### 6.4 No VS Code integration harness at the start

The original decision still holds: `@vscode/test-cli` is added when there is a bug that unit + F5
cannot cover. The critical interaction is with Claude/Codex installed and authenticated on the real
machine; a clean Extension Host risks testing the wrong thing.

### 6.5 Automatable smoke checklist

`npm run smoke:fixtures` does not touch real runtimes. `npm run smoke:local`, instead, can be a
manual command that checks file presence, permissions, app-server and commands without modifying
settings.

---

## 7. P6 — Biome + typed ESLint

Biome: format, imports, general rules. ESLint + typescript-eslint: only rules that require the
type checker.

Minimum:

```text
@typescript-eslint/no-floating-promises
@typescript-eslint/no-misused-promises
@typescript-eslint/await-thenable
```

It is a project full of watchers, fetches, child processes, queues and renames: a lost Promise is a
real defect.

---

## 8. P7 — Watcher: fast events + periodic reconciliation

The original document used `workspace.createFileSystemWatcher` with an absolute `RelativePattern`
for files outside the workspace. It remains the first choice, but with Codex there is one more
reason not to treat the filesystem event as the source of truth: sessions live in directories nested
by date and can be created while VS Code is open.

### 8.1 Claude

```text
<CLAUDE_CONFIG_DIR|~/.claude>/kaji/state/*.json
<claude project sessions>/*.jsonl
```

Non-recursive watcher on the known session directories; when statusLine carries `transcript_path`,
the exact file is hooked.

### 8.2 Codex

```text
~/.codex/sessions/**/*.jsonl
```

`RelativePattern(Uri.file(codexSessions), '**/*.jsonl')` as the hot path.

### 8.3 Reconciliation loop

Every 30–60 seconds while an active session exists, a lightweight rescan compares:

- known files;
- mtime/size;
- active session IDs.

This is not polling “instead of” the watcher; it is the safety net for events lost on Windows,
WSL, mounts or dynamically created directories.

No full read: offset + inode/file identity are kept where possible.

*Falsified by:* measurable load on homes with thousands of sessions. In that case an index for the
current day is kept and only recent directories are scanned.

---

## 9. P8 — All writes go through fsx

### 9.1 Per-path queue

```ts
Map<CanonicalPath, Promise<void>>
```

Every read-modify-write on the same path is serialized. Different paths stay parallel.

### 9.2 Atomic write

```text
same-dir temp
→ write
→ optional validate reread
→ rename
```

Bounded retry on `EPERM`, `EBUSY`, `EACCES`: 25/50/100/200 ms. Structural errors such as `ENOSPC`,
`EXDEV`, `EISDIR` are not masked.

### 9.3 File open in VS Code

If a user file is open in an editor, prefer `workspace.applyEdit` when it is safe to do so, so that
the user sees the change and can undo it. Internal caches do not go through the editor.

---

## 10. P9 — Claude JSONC

`jsonc-parser` remains a necessary runtime dependency. No `JSON.stringify` on user settings.

Invariants:

1. parse the original;
2. `modify()` one property at a time;
3. apply on the correct text;
4. preserve comments and formatting;
5. atomic write;
6. tests with line, block and trailing comments and unknown keys.

Different modules do **not** write the same JSONC: `claude/config.ts` owns the Claude settings.

---

## 11. P10 — Codex TOML without destroying the file

The new difficulty is that TOML has no small, mature equivalent of `jsonc-parser` that performs
surgical edits preserving every comment and layout with the API we need.

Decision: separate **parse/validate** from **edit**.

### 11.1 Parser

A small runtime TOML library is used to validate the document before and after the patch. The
concrete choice is pinned in the `package-lock`; the requirement is:

- pure JS, bundlable;
- zero native modules;
- TOML 1.0;
- reliable parsing;
- acceptable size.

The library is **not** used to reserialize the file.

### 11.2 Surgical editor

`codex/toml-edit.ts` initially supports only the operations the product needs:

```text
set top-level scalar: model
set top-level scalar: model_reasoning_effort
set top-level scalar: service_tier
set/remove top-level scalar: model_provider   [user config only]
insert/remove managed provider block          [only if owned by us]
```

For pre-existing keys it looks for the real top-level definition, ignoring comments/strings, and
replaces only the value span. For structures it cannot edit with certainty, it **refuses** and opens
the file with a message; it does not reserialize.

### 11.3 Owned blocks

Provider configurations generated by the extension use commented markers:

```toml
# kaji:begin provider deepseek
[model_providers.deepseek]
name = "DeepSeek"
base_url = "https://api.deepseek.com"
wire_api = "responses"
# ...
# kaji:end provider deepseek
```

Before creating them:

- parse the TOML;
- verify that `model_providers.deepseek` does not already exist outside the block;
- if it exists, **do not take ownership**: use the user configuration and show it as unmanaged.

After every patch: parse again. If it is not valid, do not promote the temp file.

### 11.4 Codex project denylist

`model_provider` and `model_providers` are never written into `.codex/config.toml`; Codex ignores
them for security. Only user-level `~/.codex/config.toml`, with explicit confirmation of the scope.

---

## 12. P11 — fetchx: a single network layer for catalogs and pricing

Node 22 provides `fetch`; no HTTP dependency.

Common wrapper:

```ts
fetchJson(url, {
  timeoutMs,
  etag?,
  lastModified?,
  maxBytes,
  headers,
})
```

Characteristics:

- `AbortSignal.timeout()`;
- size limit before parsing;
- `If-None-Match` / `If-Modified-Since`;
- status/body truncated in logs;
- no retry for credential/model probes that must fail fast;
- retry with jitter only for idempotent catalog/pricing refreshes;
- limited redirects;
- HTTPS required unless the custom endpoint is explicitly localhost/private.

Never log Authorization or URLs with a secret in the query.

---

## 13. P12 — Pricing scraping without a browser

No Playwright, Puppeteer or hidden webview. It would be a disproportionate build pipeline.

### 13.1 Provider-specific parser

```ts
interface PricingSourceParser {
  canParse(contentType: string, body: string): boolean;
  parse(body: string, fetchedAt: Instant): PricingSnapshot;
}
```

For DeepSeek the parser looks for the official table and normalizes:

- model ID;
- 1M-token unit;
- cache hit;
- cache miss;
- output;
- peak/off-peak;
- UTC schedule.

### 13.2 No DOM dependency at the start

The first parser works on the server-rendered text with a small HTML extractor and real fixtures.
Since the pipeline is fail-closed and keeps last-known-good, an HTML change produces “refresh
failed”, not wrong prices.

`cheerio`/a DOM parser becomes a pre-approved dependency **only** if the fixtures prove that the HTML
is too unstable for the small parser.

### 13.3 Do not follow marketing text as the primary source

If the page has embedded JSON or a stable structured table, prefer that. Never extract a price from
a random paragraph when a table exists.

---

## 14. P13 — On-disk layout

Product data must be distinguished from runtime data.

### 14.1 Product state

Stable path independent of the runtime:

```text
~/.kaji/
  catalog/
    current.json
    history/
  pricing/
    current.json
    history/
  changes/
    seen.json
  presets/
  bridge/
    key-helper.js
    event-sink.js
  materialized-keys/
  diagnostics/
```

The directory name lives in a single constant in the code.

### 14.2 Runtime-owned integration state

Only what the runtime requires in its own config root:

```text
<CLAUDE_CONFIG_DIR|~/.claude>/kaji/
  statusline-wrap.json
  state/<session>.json

~/.codex/
  # config.toml remains Codex's; no second database of ours here
```

The executable bridge can live in `~/.kaji/bridge`; the runtime settings point to an absolute
path.

### 14.3 SecretStorage and materialization

`context.secrets` is the master for secrets managed by the extension. If a runtime must read them
from an external process, they are materialized in `~/.kaji/materialized-keys/<provider>` with the
most restrictive permissions possible.

One-way direction:

```text
SecretStorage → materialized file
```

If SecretStorage is empty and the file exists, do not import/overwrite automatically: offer an
explicit import.

### 14.4 Codex native auth

If the user has already configured native Codex authentication, do not duplicate the secret. The
provider adapter marks credential ownership:

```text
runtime-native
extension-managed
external-env
unknown
```

`extension-managed` is the only case in which we use our key-helper/materialization.

---

## 15. P14 — Sidecar

Two classes:

### 15.1 `key-helper.js`

- pure CommonJS;
- zero dependencies;
- reads a single local file;
- prints the token and nothing else;
- no timeout needed because it does no networking;
- non-zero exit on missing file/permissions;
- no stdout logging.

Claude uses it via `apiKeyHelper`; Codex can use it through `model_providers.<id>.auth.command` when
we choose to manage the credential with SecretStorage.

This is one of the most useful duplication reductions: **the same helper serves both runtimes**.

### 15.2 `event-sink.js`

Optional hook/runtime sidecar that receives JSON on stdin and writes it into a product queue/state
file. It must be extremely generic:

```text
stdin bytes → envelope(runtime,event,timestamp) → atomic append/write
```

No business parsing, no networking, no dependencies.

### 15.3 Node path

The absolute path of `node` is resolved at activation. Do not assume that the runtime process has
the same PATH as the shell VS Code was launched from.

---

## 16. Claude adapter

### 16.1 Sources

Observational priority:

```text
statusLine state → transcript → config fallback
```

### 16.2 statusLine tee

Explicit opt-in. Installation sequence:

1. read the original command;
2. save a verbatim backup;
3. materialize the tee;
4. write the wrapper;
5. roundtrip test;
6. only then mark it “linked”.

Uninstallation in reverse order; the backup is the last thing deleted.

The tee:

- reads stdin once;
- saves the payload per session ID;
- passes the same stdin to the original command;
- propagates stdout/stderr/exit code according to the contract;
- does not interpret cost/pricing/usage.

### 16.3 Transcript

Incremental reader with offset and `message.id`/fingerprint dedupe. It does not sum every assistant line.

### 16.4 Config

`claude/config.ts` exposes semantic operations:

```ts
setProjectProviderTransport(...)
setProjectModel(...)
setApiKeyHelper(...)
updateOwnedPickerRows(...)
restoreNoOverride(...)
```

No other module manipulates JSONC.

### 16.5 Restart ladder

1. discoverable runtime command, if reliable;
2. session restart via the available official mechanism;
3. `workbench.action.reloadWindow` only as a heavy fallback;
4. `restart needed` badge.

Command IDs are not hardcoded without discovery/tests.

---

## 17. Codex adapter

### 17.1 Sources

```text
hooks/app-server structured event   [when installed/active]
→ rollout JSONL
→ config
```

### 17.2 Session matching

The rollout file has `session_meta.payload.cwd`. The adapter normalizes path/case/symlinks with care
and associates the session with the most specific workspace folder.

Do not use `state_5.sqlite` as the primary source: there are bugs in which index and rollout
diverge, especially on WSL. The transcript/rollout is the observed record; the DB can be diagnostics.

### 17.3 TokenCount accumulator

Prefer the cumulative `total_token_usage`:

```ts
delta = currentTotal - previousTotal
```

If equal: no new consumption even if the event is new. If lower:

- new segment/reset/resume;
- do not subtract from the total already accumulated;
- debug log with session/version.

`last_token_usage` serves the “last turn” tooltip, not the session total.

### 17.4 Rate limits

Normalization of:

- primary;
- secondary;
- additional limit IDs;
- credits;
- individual spend control;
- plan type.

The parser must tolerate new fields. Unknown limit → `kind: other`, not an error.

### 17.5 Hooks

Opt-in installation in the first notifications milestone. Relevant hooks:

```text
SessionStart
SessionEnd
PermissionRequest
SubagentStart
SubagentStop
Stop
Interrupt
```

The hooks only write events into our sink; they do **not** approve/deny permissions. The feature is
observational, not a policy engine.

### 17.6 app-server

Use it for operations where the structured contract justifies the subprocess:

- `model/list`;
- account/rate limits on demand/slow refresh;
- any future session-safe APIs.

JSON-RPC wrapper:

```text
spawn codex app-server
→ initialize
→ request
→ timeout
→ graceful shutdown
→ bounded kill if it does not exit
```

Do not keep a permanent daemon in the first release. Cache the result; a `model/list` does not
justify an always-alive process.

### 17.7 Provider scope

`model_provider`/`model_providers` user config only. The UI must call the `applyMachineProvider`
operation, not `applyProjectProvider`: the method name prevents forgetting the scope.

---

## 18. DeepSeek provider

It is the reference provider because it exercises almost every capability.

### 18.1 Transports

```ts
{
  claude: {
    protocol: "anthropic",
    baseUrl: "https://api.deepseek.com/anthropic"
  },
  codex: {
    protocol: "responses",
    baseUrl: "https://api.deepseek.com"
  }
}
```

Codex/Responses support is officially documented by DeepSeek.

### 18.2 Model discovery

`GET https://api.deepseek.com/models` with Bearer. Small response, schema:

```ts
{ object: "list", data: [{ id, object: "model", owned_by }] }
```

Discovery alone does not fill in context/vision/effort; these metadata are merged from the bundled
catalog or from official sources and marked with a distinct source.

### 18.3 Probe

To verify runtime compatibility:

- Claude transport: minimal Anthropic request;
- Codex transport: minimal Responses API request.

The probe does not start automatically on every refresh if it costs money: new models come in as
`candidate`, and the probe is scheduled only according to preference/consent.

### 18.4 Pricing

Official page parser. The current snapshot is used only as a test fixture, not as a runtime hardcode.
The fixture also contains the peak/off-peak schedule to test the rule engine.

---

## 19. OpenAI provider / Codex runtime

Two cases must be distinguished:

### 19.1 ChatGPT-authenticated Codex

The API cost does not represent the "cost of the subscription". Show:

- tokens;
- context;
- primary/secondary limits;
- credits/spend controls if exposed;
- plan type if exposed.

Do not convert tokens into dollars, except for an explicit "API list price equivalent" entry disabled
by default, because semantically it can be confusing.

### 19.2 OpenAI API key/custom Responses

Here API pricing can produce a cost. The rule engine must support:

- cached input;
- cache writes;
- output;
- context thresholds when the model has them;
- service tier.

If the Codex version does not persist a billed dimension, confidence = `estimated`.

---

## 20. P16 — Cache/snapshot store

Every remote resource is an envelope:

```ts
type SnapshotEnvelope<T> = {
  schemaVersion: number;
  sourceId: string;
  fetchedAt: string;
  etag?: string;
  lastModified?: string;
  contentHash: string;
  data: T;
};
```

Files:

```text
current.json          last-known-good
candidate.tmp         never read by the UI
history/<hash>.json   bounded
```

Atomic promotion only after:

```text
network ok
parse ok
schema ok
semantic validation ok
```

304 updates the `fetchedAt` metadata without creating a semantic change event.

---

## 21. P17 — Semantic change detection

Do not compare stringified JSON. Normalize, sort and compare the meaningful keys.

### 21.1 Models

Identity: `(provider, model.id)`.

Diff:

```ts
ModelChange =
  | { type: "added"; after }
  | { type: "removed"; before }
  | { type: "metadata"; field; before; after }
  | { type: "retirement"; before?; after? };
```

Label/order changes must not look like model add/remove.

### 21.2 Pricing

Rates become sorted canonical rules. Relevant diff:

- rate changed;
- bucket added/removed;
- schedule changed;
- currency/unit changed;
- effective date changed.

### 21.3 Limits

Two separate levels:

```text
LimitStructureSnapshot  → for change detection
LimitUsageSnapshot      → for live UI
```

`usedPercent` does not go into the structure. `windowMinutes`, ID, kind, credits/spend availability do.

### 21.4 Seen state

Every change set has a hash ID. `changes/seen.json` records what the user has already seen; do not use
the timestamp alone, because clock changes and rollbacks must not bring the spam back.

---

## 22. P18 — Pricing engine

### 22.1 Rule model

```ts
type PricingRule = {
  component: "input" | "cache-read" | "cache-write" | "output" | "reasoning";
  ratePerUnit: number;
  unitTokens: number;
  when?: PricingCondition;
};
```

Conditions support at least:

```text
time schedule UTC
context threshold
service tier
region
model alias/version
```

### 22.2 Determinism

`calculateCost(snapshot, usage, facts)` is pure: no network, no global clock. The timestamp is
passed in. Test exactly the second before/after a peak window.

### 22.3 Numeric precision

Use integer token counts and computation in integer micro-dollars/nano-dollars when practical, or a
controlled decimal representation. Do not accumulate thousands of turns in binary float without error
tests.

For the UI, round only at the end.

---

## 23. P19 — Limits engine

Normalization:

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

### Burn rate

A short time series is needed in the memory/disk cache:

```text
(timestamp, usedPercent, limitId)
```

Projection only if:

- at least 3 samples;
- consistent window/reset identity;
- monotonic percentage within the segment;
- positive slope;
- no reset between samples.

If the reset timestamp changes, the series breaks.

---

## 24. Session state reducer

Adapters emit events; the UI does not read files directly.

```ts
RuntimeEvent =
  | SessionObserved
  | SelectionObserved
  | UsageObserved
  | LimitsObserved
  | AttentionRequired
  | TurnStarted
  | TurnCompleted
  | SubagentStarted
  | SubagentStopped
  | RuntimeError;
```

A reducer produces `LiveSessionState` per workspace folder. This avoids races between statusLine,
transcript and watcher.

Timestamp/source priority rule:

```text
structured live runtime event
> runtime transcript event
> config observation
> catalog fallback
```

But an older, more authoritative event does not overwrite a newer event: every field keeps
`observedAt` and `source`.

---

## 25. Concurrency

### 25.1 Refresh coalescing

A provider refresh already in flight is shared:

```ts
Map<RefreshKey, Promise<Result>>
```

Ten VS Code windows must not make ten simultaneous `/models` fetches.

### 25.2 Cross-window

The first milestone does not implement IPC between different extension hosts. The atomic on-disk cache
+ ETag makes it harmless for two windows to refresh. Promotion uses rename; history uses content hash.

### 25.3 Config writes

The per-path queue applies to all windows only within the current process; cross-process, the atomic
write avoids partial files but not a read-modify-write lost update between processes. Before the
rename, mtime/hash is re-read: if it changed since we read it, abort + retry the merge on the new text.

This compare-and-retry is necessary now that two windows can manage the same global configs.

---

## 26. UI

### Status bar

A single `StatusBarItem` per window, following the active editor/workspace folder.

Text generated by a pure `renderStatusbarModel(LiveSessionState, Preferences)`.

No filesystem logic in the UI.

### Tooltip

`MarkdownString`, only non-sensitive data. Links only to VS Code commands or already known official
sources; do not include full private tokens/base URLs if they can reveal infrastructure.

### QuickPick

`createQuickPick` when in-place refresh and back navigation are needed. Every row carries an `action`
discriminated union, not anonymous closures that are hard to test.

---

## 27. Diagnostics

The `Kaji: Verify installation` command returns a matrix:

```text
Claude Code
  installed               ✓
  config readable          ✓
  statusLine bridge        ✓
  transcript               ✓
  SecretStorage/material   ✓

Codex
  installed                ✓
  config layers            ✓
  rollout                  ✓
  app-server               ✓
  hooks                    not linked

Providers
  DeepSeek /models         ✓  2 models
  DeepSeek pricing         ✓  updated 2h ago
  OpenAI catalog           ✓  account/runtime catalog
```

The Output Channel keeps the details. The UI shows a compact result.

Never run paid probes in the diagnostics command without a distinct button/consent.

---

## 28. Logging and redaction

`LogOutputChannel` with levels.

Mandatory helpers:

```ts
redact(value)
redactHeaders(headers)
redactUrl(url)
```

Sensitive patterns:

- Authorization;
- api keys;
- materialized key path content;
- query token;
- prompt/transcript text in normal logs.

Model IDs, HTTP status, byte count, source, timings and local file paths may be logged when needed
for diagnostics. An explicit debug flag can increase metadata, **never** secrets.

---

## 29. Runtime dependencies

### Approved

1. **`jsonc-parser`** — JSONC editing preserving comments.
2. **a pure-JS TOML parser library** — Codex config validation; final choice during bootstrap,
   with lockfile and bundle-size check.

### Not needed initially

- HTTP client: global `fetch`;
- watcher: VS Code API;
- runtime JSON schema framework: hand-written validators for small DTOs or generated lightweight;
- HTML browser parser: provider-specific parser + fixture;
- big decimal library: first try integer micro/nano-dollar helpers;
- chokidar: only if RelativePattern + reconcile loses measured events;
- cheerio: only if the DOM-less pricing parser is demonstrably fragile.

### Gate for a new dependency

Every new runtime dependency must state:

1. what code it eliminates;
2. what class of bugs it prevents;
3. bundle cost;
4. maintenance/ESM/native risk;
5. concrete proof that small internal code is not enough.

---

## 30. package.json / manifest

The product is called Kaji: `name` is `kaji`, `displayName` and `description` follow
`BRANDING.md`.

Planned contributions:

```text
commands
  kaji.openPicker
  kaji.changeModel
  kaji.changeProvider
  kaji.manageKeys
  kaji.addProvider
  kaji.refreshCatalogs
  kaji.showChanges
  kaji.managePresets
  kaji.linkClaudeStatusLine
  kaji.unlinkClaudeStatusLine
  kaji.linkCodexHooks
  kaji.unlinkCodexHooks
  kaji.verifyInstallation
  kaji.showLog

configuration
  refresh.catalogTtlHours
  refresh.pricingTtlHours
  usage.throughputMode
  usage.includeReasoningTokens
  statusbar.showCost
  statusbar.showLimit
  alerts.warnPercent
  alerts.criticalPercent
  alerts.notifications
  fallback.policy
  providers.visible
```

API keys and private provider definitions do **not** live in `contributes.configuration`.

Manifest baseline during development:

```text
engines.vscode    ^1.139.0
@types/vscode     1.139.0 exact
main              ./dist/extension.js
activationEvents  ["onStartupFinished"]
```

`publisher` is still required by `vsce package` even without a marketplace; `name` and `publisher`
follow the product name, Kaji. No marketplace token/publisher account is needed for the local VSIX.

`.vscodeignore` excludes `src/`, tests, fixtures not needed at runtime, development config and
`node_modules/` when the runtime dependencies are correctly bundled. The package is created
with `vsce package --no-dependencies`; also having `node_modules` in the VSIX would be a second copy
of the code.

`vscode:prepublish` runs `npm run check` before the build/package: it must not be possible to create
the VSIX from a tree that fails typecheck, lint or tests.

Activation: `onStartupFinished` remains reasonable because the status bar must exist early, but the
network refresh is deferred: activation does not wait for the Internet.

---

## 31. Startup budget

Activation path:

```text
load preferences
→ create UI
→ load local cached snapshots
→ detect runtimes cheap
→ register watchers/commands
→ return
```

After activation, non-blocking tasks:

```text
stale catalog refresh
stale pricing refresh
app-server capability probe cached
```

Target: no fetch in the visible critical path.

---

## 32. Auto-refresh state machine

For each source:

```text
fresh
stale
refreshing
candidate-valid
candidate-invalid
backoff
```

Metadata:

```ts
{
  lastAttemptAt,
  lastSuccessAt,
  failureCount,
  nextRetryAt,
  etag,
  staleReason
}
```

Backoff, for example 1m → 5m → 30m → 2h, reset by a success or a manual refresh.

The status bar does not show transient refresh errors. `showChanges`/diagnostics shows "pricing stale
18h" if it exceeds a useful threshold.

---

## 33. DeepSeek change detection test fixture

Fixture A:

```json
{"data":[{"id":"deepseek-flash"},{"id":"deepseek-v4-pro"}]}
```

Fixture B:

```json
{"data":[{"id":"deepseek-flash"},{"id":"deepseek-v4-pro"},{"id":"deepseek-v5-pro"}]}
```

Expected:

```text
1 model.added
no deletion
new model compatibility = candidate until probe
```

Fixture C removes `deepseek-v4-pro`:

```text
model.removed/deprecated
existing project selection remains intact
picker row remains in “configured but not advertised” if currently selected
```

---

## 34. Pricing test matrix

DeepSeek fixture tests:

```text
Mon 02:00 UTC → peak
Mon 05:00 UTC → off-peak
Mon 07:00 UTC → peak
Sat 07:00 UTC → off-peak
```

Bucket tests:

```text
cache hit only
cache miss only
output only
mixed
zero
missing cache split → estimated, not exact
```

OpenAI fixture tests:

```text
short context threshold boundary
long context threshold boundary
cached input
cache write
service tier known
service tier missing → estimated if price changes by tier
```

---

## 35. Limits test matrix

Claude:

```text
no rate_limits
five_hour only
five_hour + seven_day
spend_limit only/gateway
expired reset removes window
```

Codex:

```text
primary only
primary + secondary
additional limit id
credits balance
unlimited credits
individual spend control
plan type change
same usedPercent event repeated
reset timestamp changes backwards → anomaly candidate
```

---

## 36. Version compatibility contract

Every RuntimeAdapter declares:

```ts
supportsVersion(version: string): "supported" | "unknown-newer" | "too-old";
```

Do not automatically block `unknown-newer`: tolerant parse + diagnostics. Block only when a certain
minimum capability is missing.

Snapshots include the source runtime version so that bugs after an update can be explained.

Codex catalog: **never** take `models.json` from `main` and impose it on an old client; a schema/client
mismatch has already happened. Use the installed client's catalog or a provider format that is
specifically compatible.

---

## 37. Codex TOML/provider: DeepSeek strategy

DeepSeek publishes an official Codex configuration that creates a JSON model catalog and a Responses
provider. Our integration must follow those semantics, but with explicit ownership.

Initial flow:

1. read the user Codex config;
2. if DeepSeek is already configured: adopt it as unmanaged, do not rewrite it;
3. if absent and the user asks for setup: create an owned provider block;
4. generate/update **only** the DeepSeek catalog we own, in a dedicated file;
5. point `model_catalog_json` only when the resulting configuration is compatible with the current
   client;
6. after a Codex update, `verifyInstallation` revalidates the catalog before rewriting it.

If the client exposes a stable/documented remote model catalog for custom providers, migrate to it
and stop generating the local file. Until then, do not depend on undocumented `main` features.

---

## 38. Fallback engine

The core produces a proposal, it does not write files directly:

```ts
type FallbackDecision = {
  reason: "auth" | "quota" | "credit" | "timeout" | "manual" | "projected-limit";
  from: Selection;
  to?: Selection;
  action: "notify" | "ask" | "apply" | "none";
  constraints: string[];
};
```

The RuntimeAdapter validates whether `to` is applicable to a safe scope. On Codex, automatic
cross-provider returns the `machine-scope-provider` constraint and is downgraded to ask/notify.

---

## 39. Preset schema

Versioned:

```json
{
  "schemaVersion": 1,
  "name": "Coding cheap",
  "selection": {
    "runtime": "claude",
    "provider": "deepseek",
    "model": "deepseek-flash",
    "effort": "high"
  },
  "fallback": {
    "policy": "ask-before-limit",
    "providers": ["glm"]
  },
  "alerts": {
    "warnPercent": 75,
    "criticalPercent": 90
  }
}
```

Never private base URLs in the default export; if the user exports a custom provider, ask whether to
include non-secret endpoint/metadata.

---

## 40. Remote parser security

Catalog/pricing are untrusted input even when they come from an official site.

- max response bytes;
- no eval;
- no dynamic import;
- no HTML script execution;
- URL allowlist for builtin sources;
- custom source requires user configuration;
- remote strings do not become trusted Markdown;
- labels escaped in tooltip/QuickPick;
- no path written from a model ID without sanitization.

---

## 41. CI

`.github/workflows/kaji.yml` in the development repository, one initial job with
`working-directory: extensions/kaji`, run only when something under that path changes:

```text
node:22
npm ci
npm run check
npm run package
```

`npm run check`:

```text
tsc --noEmit
biome check
eslint typed
vitest run
fixture contract tests
```

`npm run package`:

```text
esbuild
vsce package --no-dependencies
```

VSIX artifact. No publish token.

In addition, deterministic tests must force the UTC timezone for the pricing schedule; UI/local time
tests are separate.

---

## 42. Release checklist

1. check green;
2. current runtime fixtures updated only if the change is understood;
3. F5 on the real profile;
4. Claude: model switch, statusLine bridge, key helper;
5. Codex: model switch, rollout parse, app-server read;
6. catalog refresh offline/online;
7. pricing parser on fixture + manual network;
8. config file comment preservation;
9. real VSIX install;
10. uninstall/reinstall must not leave unrecoverable runtime settings.

---

## 43. The blocking proofs before implementing rich features

Recommended order:

### A. Runtime foundations

1. Claude project settings in the panel.
2. Claude live model switch.
3. Claude statusLine in the panel.
4. Codex project `model` in the panel.
5. Codex rollout matching by `cwd`.
6. Codex Stop/PermissionRequest hook in the IDE extension.
7. Codex app-server model/list and rate limits.

### B. Cross-provider

8. DeepSeek Claude Anthropic.
9. DeepSeek Codex Responses.
10. a single extension-managed credential used by both through key-helper, if the chosen policy
    provides for it.

### C. Live data

11. `/models` refresh and diff.
12. pricing parse and LKG.
13. cost parity on known turns.
14. normalized limits on Claude and Codex.

### D. Failure modes

15. network offline;
16. pricing HTML changed;
17. JSONL truncated while we read it;
18. config modified by another window during the write;
19. runtime updated with an unknown field;
20. active session on a model retired from the catalog.

---

## 44. Definition of done per adapter

A RuntimeAdapter is not "supported" because it compiles. It is supported when:

- detect modifies nothing;
- config read distinguishes source/scope;
- apply returns a verifiable outcome;
- observe survives restart/resume;
- usage does not duplicate;
- limits degrade to unavailable;
- a newer runtime version with extra fields does not break the parser;
- diagnostics explains the missing prerequisites;
- uninstall bridge is reversible.

A ProviderAdapter is not "supported" until:

- at least one transport is verified end-to-end;
- model discovery has a fallback;
- pricing, if declared, has fixture + LKG;
- a new model ID does not cause a crash;
- a removed model does not delete user config.

---

## 45. Technical references verified on September 24, 2026

### VS Code / Node

- VS Code Extension API / bundling:
  https://code.visualstudio.com/api/working-with-extensions/bundling-extension
- VS Code testing:
  https://code.visualstudio.com/api/working-with-extensions/testing-extension
- `@vscode/vsce`:
  https://github.com/microsoft/vscode-vsce

### Claude Code

- Status line schema:
  https://code.claude.com/docs/en/statusline
- Model configuration:
  https://code.claude.com/docs/en/model-config
- Settings:
  https://code.claude.com/docs/en/settings
- Authentication:
  https://code.claude.com/docs/en/authentication
- Corporate launcher:
  https://code.claude.com/docs/en/corporate-launcher

### Codex

- Config basics:
  https://developers.openai.com/codex/config-basic
- Config reference:
  https://developers.openai.com/codex/config-reference
- Hooks:
  https://developers.openai.com/codex/hooks
- Open-source implementation:
  https://github.com/openai/codex
- `model/list` schema:
  https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/json/v2/ModelListResponse.json
- Rate limit implementation/tests:
  https://github.com/openai/codex/blob/main/codex-rs/codex-api/src/rate_limits.rs
  https://github.com/openai/codex/blob/main/codex-rs/app-server/tests/suite/v2/rate_limits.rs
- Rollout tests / TokenUsage examples:
  https://github.com/openai/codex/blob/main/codex-rs/app-server/tests/common/rollout.rs

### Provider/pricing

- DeepSeek model list:
  https://api-docs.deepseek.com/api/list-models/
- DeepSeek pricing:
  https://api-docs.deepseek.com/quick_start/pricing/
- DeepSeek Responses API:
  https://api-docs.deepseek.com/api/create-response/
- DeepSeek Codex integration:
  https://api-docs.deepseek.com/quick_start/agent_integrations/codex/
- OpenAI API pricing:
  https://developers.openai.com/api/docs/pricing

### Edge cases that shaped the design

- Codex project-local provider denylist:
  https://github.com/openai/codex/blob/main/codex-rs/config/src/loader/mod.rs
- Catalog schema/client mismatch:
  https://github.com/openai/codex/issues/38934
- `codex debug models` output caveat:
  https://github.com/openai/codex/issues/43705
- JSONL usage/rate-limit examples:
  https://github.com/openai/codex/issues/19022
- WSL/index-vs-rollout divergence example:
  https://github.com/openai/codex/issues/42292

---

## 46. The final rule

The previous project had a correct rule: **read the state from the runtime instead of keeping a
mental copy of the runtime**. With two runtimes and remote sources the rule becomes even more important:

> configuration, session state, remote catalog, pricing and limits are external sources that can
> change independently of the extension. The code must normalize them, keep their provenance and
> timestamp, validate them and degrade explicitly when it does not know them.

The thing to avoid is not a visible error. It is a very convincing number that actually belongs
to the wrong session, price or limit.
