# agent-router-extension — tech stack e architettura

Documento rigenerato il **24 settembre 2026**. Accompagna `README.md`: il README definisce prodotto,
comportamento e criteri di accettazione; questo file definisce **come** costruirlo, i confini dei
moduli, i contratti e le decisioni tecniche con il loro falsificatore.

Macchina di partenza del documento originale: Node 22.23.2, npm 10.9.8, VS Code 1.139.0,
repository di sviluppo privato su GitHub, condiviso con Daiku. Il primo target resta una **VS Code
extension TypeScript impacchettata in VSIX**, senza marketplace obbligatorio.

Tutti i path di questo documento — `src/`, `test/`, `package.json` — sono relativi alla radice del
prodotto, `extensions/kaji/`, che diventa la radice del repository pubblico di Kaji.

Il cambiamento architetturale principale rispetto al progetto precedente è uno solo, ma sposta tutti
i confini:

> **il core non è Claude-specifico. Claude Code e Codex sono `RuntimeAdapter`; DeepSeek, OpenAI,
> Anthropic, GLM, MiMo ecc. sono `ProviderAdapter`. UI, catalogo, pricing, usage, cost, limits,
> change detection e preset esistono una volta sola.**

---

## 1. Decisioni prese

| | Punto | Decisione | Se sbagliamo, si paga |
|---|---|---|---|
| P1 | Architettura | **core + runtime adapters + provider adapters** | **altissimo** |
| P2 | Bundler | **esbuild** | poco |
| P3 | Bundle | **CommonJS**, `vscode` external | medio |
| P4 | TypeScript | **strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes** | medio |
| P5 | Test | **Vitest + contract fixtures**, integration harness solo con bug concreto | medio |
| P6 | Lint/format | **Biome + ESLint solo regole typed** | poco |
| P7 | File watch | **VS Code RelativePattern + rescan di riconciliazione** | alto |
| P8 | Scritture | **queue per path + atomic rename + retry** | alto |
| P9 | JSONC Claude | **jsonc-parser, surgical edits** | alto |
| P10 | TOML Codex | **parser per validazione + surgical text patch limitato** | alto |
| P11 | HTTP | **fetch globale + AbortSignal**, ETag/Last-Modified | poco |
| P12 | Scraping pricing | **parser provider-specifico, fail closed, no browser/headless** | medio |
| P13 | Storage | **product state fuori dai repo; SecretStorage master; bridge stabile su disco** | alto |
| P14 | Sidecar | **CommonJS puro, zero dipendenze, materializzato** | alto |
| P15 | Codex structured access | **app-server JSON-RPC solo dove compra un contratto stabile** | medio |
| P16 | Catalog cache | **snapshot candidate → validate → atomic promote LKG** | alto |
| P17 | Change detection | **diff semantico versionato, non diff del JSON grezzo** | medio |
| P18 | Pricing engine | **rule engine deterministico, no provider-if nel core** | alto |
| P19 | Limits | **finestre arbitrarie, mai 5h/7d hardcoded** | alto |
| P20 | Logging | **LogOutputChannel strutturato, redaction obbligatoria** | alto |
| P21 | i18n | **italiano centralizzato, nessun framework l10n iniziale** | poco |
| P22 | CI | **un job GitHub Actions: check + package + fixture tests** | poco |
| P23 | Runtime deps | **budget piccolo, ogni dipendenza con motivo** | medio |

---

## 2. P1 — L'architettura che evita la duplicazione Claude/Codex

### 2.1 I livelli

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

Il core **non importa `vscode` e non legge direttamente file di runtime**. Riceve DTO normalizzati e
restituisce decisioni pure. È la condizione che rende possibile scrivere centinaia di test rapidi.

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

`RuntimeCapabilities` dichiara la verità invece di spargere `if runtime === "codex"` nella UI:

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

Un provider può non avere `fetchPricing`: in quel caso il cost meter resta `unavailable` o usa una
tabella manuale/bundled marcata come tale.

### 2.4 Regola anti-duplicazione

Un modulo runtime **può** sapere che DeepSeek usa `base_url`; non può calcolare il prezzo DeepSeek.
Un modulo provider **può** sapere il prezzo e `/models`; non può sapere come si scrive
`.claude/settings.local.json`.

Se una feature richiede entrambe le conoscenze, è un application service che orchestra due adapter.

*Falsificato da:* una capability fondamentale che non può essere espressa senza introdurre molti
branch runtime/provider nel core. In quel caso si estende il contratto; non si copia il modulo.

---

## 3. Layout sorgente

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

Confermata la scelta del documento originale.

```text
esbuild src/extension.ts
  --bundle
  --platform=node
  --format=cjs
  --external:vscode
  --sourcemap
  --outfile=dist/extension.js
```

Niente minify: il VSIX resta locale e stack trace leggibili valgono più di qualche KB.

`tsc --noEmit` è separato: esbuild transpila, non type-checka.

Nessun modulo nativo. Il runtime Node dell'Extension Host cambia con VS Code ed è inutile legarsi
all'ABI per un prodotto che può essere tutto TypeScript/JS.

---

## 5. P4 — TypeScript rigoroso

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

Questa codebase è piena di dati opzionali provenienti da versioni runtime diverse. La differenza fra
“campo assente” e “false/zero” è semantica:

- effort assente ≠ effort low;
- `rate_limits` assente ≠ 0% usato;
- price bucket assente ≠ gratis;
- `cacheWriteInput` assente ≠ 0 token scritti;
- transport assente ≠ transport non ancora verificato.

`exactOptionalPropertyTypes` è quindi più importante ora che nel disegno Claude-only.

---

## 6. P5 — Strategia di test

### 6.1 Piramide

```text
molti     pure unit tests
          fixture/contract tests
pochi     adapter filesystem tests
pochissimi F5 real-runtime smoke tests
```

### 6.2 Vitest

Vitest resta il runner: TS nativo, watch rapido, mock semplice, snapshot utili per normalized DTO e
change diff.

### 6.3 Contract fixture tests

Sono il nuovo pezzo più importante. Conserviamo fixture **redatte** di:

- payload Claude statusLine di più versioni;
- righe transcript Claude duplicate;
- rollout Codex `session_meta`, `token_count`, compact, rate limits;
- output app-server `model/list` e account limits;
- DeepSeek `/models`;
- HTML/markdown pricing DeepSeek;
- pagine pricing con struttura intenzionalmente rotta.

Ogni adapter ha una suite “old fixture still parses”. L'aggiornamento di un runtime non deve
costringerci a testare sempre contro rete reale per scoprire che un campo si è spostato.

### 6.4 No integration harness VS Code all'inizio

La decisione originale resta valida: `@vscode/test-cli` si aggiunge quando esiste un bug che unit +
F5 non riescono a coprire. L'interazione critica è con Claude/Codex installati e autenticati sulla
macchina reale; un Extension Host pulito rischia di testare la cosa sbagliata.

### 6.5 Smoke checklist automatizzabile

`npm run smoke:fixtures` non tocca runtime reali. `npm run smoke:local` può invece essere un comando
manuale che verifica presenza file, permessi, app-server e comandi senza modificare settings.

---

## 7. P6 — Biome + ESLint typed

Biome: format, import, regole generali. ESLint + typescript-eslint: solo regole che richiedono il
type checker.

Minimo:

```text
@typescript-eslint/no-floating-promises
@typescript-eslint/no-misused-promises
@typescript-eslint/await-thenable
```

È un progetto pieno di watcher, fetch, child process, code e rename: una Promise persa è un difetto
reale.

---

## 8. P7 — Watcher: eventi veloci + riconciliazione periodica

Il documento originale usava `workspace.createFileSystemWatcher` con `RelativePattern` assoluto per
file fuori dal workspace. Resta la prima scelta, ma con Codex c'è un motivo in più per non trattare
l'evento filesystem come fonte di verità: le sessioni sono in directory annidate per data e possono
essere create mentre VS Code è aperto.

### 8.1 Claude

```text
<CLAUDE_CONFIG_DIR|~/.claude>/ccr/state/*.json
<claude project sessions>/*.jsonl
```

Watcher non ricorsivo sulle directory sessione note; quando statusLine porta `transcript_path`, si
aggancia il file esatto.

### 8.2 Codex

```text
~/.codex/sessions/**/*.jsonl
```

`RelativePattern(Uri.file(codexSessions), '**/*.jsonl')` come hot path.

### 8.3 Reconciliation loop

Ogni 30–60 secondi mentre esiste una sessione attiva, un rescan leggero confronta:

- file noti;
- mtime/size;
- session IDs attive.

Questo non è polling “al posto” del watcher; è la rete di sicurezza per eventi persi su Windows,
WSL, mount o directory create dinamicamente.

Nessuna lettura completa: si conserva offset + inode/file identity dove possibile.

*Falsificato da:* carico misurabile su home con migliaia di sessioni. In quel caso si mantiene un
indice per giorno corrente e si scansionano solo directory recenti.

---

## 9. P8 — Tutte le scritture passano da fsx

### 9.1 Queue per path

```ts
Map<CanonicalPath, Promise<void>>
```

Ogni read-modify-write sullo stesso path è serializzato. Path diversi restano paralleli.

### 9.2 Atomic write

```text
same-dir temp
→ write
→ optional validate reread
→ rename
```

Retry bounded su `EPERM`, `EBUSY`, `EACCES`: 25/50/100/200 ms. Errori strutturali come `ENOSPC`,
`EXDEV`, `EISDIR` non vengono mascherati.

### 9.3 File aperto in VS Code

Se un file utente è aperto in editor, preferire `workspace.applyEdit` quando è sicuro farlo, così
l'utente vede la modifica e può fare undo. Le cache interne non passano da editor.

---

## 10. P9 — Claude JSONC

`jsonc-parser` resta dipendenza runtime necessaria. Nessun `JSON.stringify` sui settings utente.

Invarianti:

1. parse originale;
2. `modify()` una proprietà per volta;
3. apply sul testo corretto;
4. preservare commenti e formatting;
5. scrittura atomica;
6. test con commenti di riga, blocco, trailing e chiavi sconosciute.

Moduli diversi **non** scrivono lo stesso JSONC: `claude/config.ts` possiede i settings Claude.

---

## 11. P10 — Codex TOML senza distruggere il file

La difficoltà nuova è che TOML non ha un equivalente piccolo e maturo di `jsonc-parser` che faccia
surgical edit preservando ogni commento e layout con l'API che ci serve.

Decisione: separare **parse/validate** da **edit**.

### 11.1 Parser

Una piccola libreria TOML runtime serve per validare il documento prima e dopo la patch. La scelta
concreta viene pin-nata nel `package-lock`; il requisito è:

- puro JS, bundlabile;
- zero moduli nativi;
- TOML 1.0;
- parse affidabile;
- dimensione accettabile.

La libreria **non** viene usata per riserializzare il file.

### 11.2 Editor chirurgico

`codex/toml-edit.ts` supporta inizialmente solo le operazioni che il prodotto necessita:

```text
set top-level scalar: model
set top-level scalar: model_reasoning_effort
set top-level scalar: service_tier
set/remove top-level scalar: model_provider   [solo user config]
insert/remove managed provider block          [solo se posseduto da noi]
```

Per chiavi preesistenti cerca la definizione top-level reale ignorando commenti/stringhe e sostituisce
solo il value span. Per strutture che non sa editare con certezza, **rifiuta** e apre il file con un
messaggio, non riserializza.

### 11.3 Blocchi posseduti

Configurazioni provider generate dall'estensione usano marker commentati:

```toml
# agent-router:begin provider deepseek
[model_providers.deepseek]
name = "DeepSeek"
base_url = "https://api.deepseek.com"
wire_api = "responses"
# ...
# agent-router:end provider deepseek
```

Prima di crearli:

- parse TOML;
- verificare che `model_providers.deepseek` non esista già fuori dal blocco;
- se esiste, **non prendere possesso**: usare la configurazione utente e mostrarla come unmanaged.

Dopo ogni patch: parse di nuovo. Se non valida, non promuovere il temp file.

### 11.4 Project denylist Codex

`model_provider` e `model_providers` non vengono mai scritti in `.codex/config.toml`; Codex li
ignora per sicurezza. Solo user-level `~/.codex/config.toml`, con conferma esplicita dello scope.

---

## 12. P11 — fetchx: una sola rete per cataloghi e pricing

Node 22 fornisce `fetch`; nessuna dipendenza HTTP.

Wrapper comune:

```ts
fetchJson(url, {
  timeoutMs,
  etag?,
  lastModified?,
  maxBytes,
  headers,
})
```

Caratteristiche:

- `AbortSignal.timeout()`;
- size limit prima del parse;
- `If-None-Match` / `If-Modified-Since`;
- status/body limitati nei log;
- nessun retry per credential/model probes che devono fallire in fretta;
- retry con jitter solo per catalog/pricing refresh idempotenti;
- redirect limitato;
- HTTPS richiesto salvo endpoint custom esplicitamente localhost/private.

Mai loggare Authorization o URL con query secret.

---

## 13. P12 — Pricing scraping senza browser

Niente Playwright, Puppeteer o webview nascosta. Sarebbe una build pipeline sproporzionata.

### 13.1 Provider-specific parser

```ts
interface PricingSourceParser {
  canParse(contentType: string, body: string): boolean;
  parse(body: string, fetchedAt: Instant): PricingSnapshot;
}
```

Per DeepSeek il parser cerca la tabella ufficiale e normalizza:

- model ID;
- unità 1M token;
- cache hit;
- cache miss;
- output;
- peak/off-peak;
- schedule UTC.

### 13.2 Nessun DOM dependency all'inizio

Il primo parser lavora sul testo server-rendered con un estrattore HTML piccolo e fixture reali.
Poiché la pipeline è fail-closed e conserva last-known-good, una modifica HTML produce “refresh
failed”, non prezzi sbagliati.

`cheerio`/parser DOM diventa dipendenza pre-approvata **solo** se le fixture dimostrano che l'HTML è
troppo instabile per il parser piccolo.

### 13.3 Non seguire marketing text come fonte primaria

Se la pagina ha JSON embedded o tabella strutturata stabile, preferire quella. Mai estrarre un prezzo
da un paragrafo casuale quando esiste una tabella.

---

## 14. P13 — Layout su disco

Serve distinguere dati del prodotto da dati dei runtime.

### 14.1 Product state

Percorso stabile indipendente dal runtime:

```text
~/.agent-router/
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

Il nome definitivo della directory segue il nome definitivo del prodotto; finché non viene deciso,
il codice deve centralizzarlo in una sola costante e supportare migrazione.

### 14.2 Runtime-owned integration state

Solo ciò che il runtime richiede nel proprio config root:

```text
<CLAUDE_CONFIG_DIR|~/.claude>/ccr/
  statusline-wrap.json
  state/<session>.json

~/.codex/
  # config.toml resta di Codex; nessun secondo database nostro qui
```

Il bridge eseguibile può vivere in `~/.agent-router/bridge`; i settings runtime puntano a un path
assoluto.

### 14.3 SecretStorage e materializzazione

`context.secrets` è il master per segreti gestiti dall'estensione. Se un runtime deve leggerli da un
processo esterno, si materializzano in `~/.agent-router/materialized-keys/<provider>` con permessi
più restrittivi possibile.

Direzione one-way:

```text
SecretStorage → materialized file
```

Se SecretStorage è vuoto e il file esiste, non importare/sovrascrivere automaticamente: proporre
import esplicito.

### 14.4 Codex native auth

Se l'utente ha già configurato l'autenticazione Codex nativa, non duplicare il segreto. Il provider
adapter marca credential ownership:

```text
runtime-native
extension-managed
external-env
unknown
```

`extension-managed` è l'unico caso in cui usiamo il nostro key-helper/materialization.

---

## 15. P14 — Sidecar

Due classi:

### 15.1 `key-helper.js`

- CommonJS puro;
- zero dipendenze;
- legge un solo file locale;
- stampa token e nient'altro;
- timeout non necessario perché non fa rete;
- exit non-zero su file mancante/permessi;
- nessun log stdout.

Claude lo usa via `apiKeyHelper`; Codex può usarlo tramite `model_providers.<id>.auth.command` quando
scegliamo di gestire la credenziale con SecretStorage.

Questa è una delle riduzioni di duplicazione più utili: **lo stesso helper serve entrambi i runtime**.

### 15.2 `event-sink.js`

Hook/runtime sidecar opzionale che riceve JSON su stdin e lo scrive in una coda/file state del
prodotto. Deve essere genericissimo:

```text
stdin bytes → envelope(runtime,event,timestamp) → atomic append/write
```

Niente parsing business, niente rete, niente dipendenze.

### 15.3 Node path

Il path assoluto di `node` viene risolto all'attivazione. Non assumere che il processo runtime abbia
lo stesso PATH della shell da cui è partito VS Code.

---

## 16. Adapter Claude

### 16.1 Fonti

Priorità osservativa:

```text
statusLine state → transcript → config fallback
```

### 16.2 Tee statusLine

Opt-in esplicito. Sequenza installazione:

1. leggere comando originale;
2. salvare backup verbatim;
3. materializzare tee;
4. scrivere wrapper;
5. test di roundtrip;
6. solo allora segnare “linked”.

Disinstallazione inversa; il backup è l'ultima cosa cancellata.

Il tee:

- legge stdin una volta;
- salva payload per session ID;
- passa lo stesso stdin al comando originale;
- propaga stdout/stderr/exit code secondo contratto;
- non interpreta cost/pricing/usage.

### 16.3 Transcript

Reader incrementale con offset e dedupe `message.id`/fingerprint. Non somma ogni riga assistant.

### 16.4 Config

`claude/config.ts` espone operazioni semantiche:

```ts
setProjectProviderTransport(...)
setProjectModel(...)
setApiKeyHelper(...)
updateOwnedPickerRows(...)
restoreNoOverride(...)
```

Nessun altro modulo manipola JSONC.

### 16.5 Restart ladder

1. comando runtime discoverable se affidabile;
2. restart session via meccanismo ufficiale disponibile;
3. `workbench.action.reloadWindow` solo come fallback grosso;
4. badge `da riavviare`.

Gli ID comando non sono hardcoded senza discovery/test.

---

## 17. Adapter Codex

### 17.1 Fonti

```text
hooks/app-server structured event   [quando installato/attivo]
→ rollout JSONL
→ config
```

### 17.2 Session matching

Il file rollout ha `session_meta.payload.cwd`. L'adapter normalizza path/case/symlink con cautela e
associa la sessione alla workspace folder più specifica.

Non usare `state_5.sqlite` come fonte primaria: esistono bug in cui indice e rollout divergono,
specialmente WSL. Il transcript/rollout è il record osservato; il DB può essere diagnostica.

### 17.3 TokenCount accumulator

Preferire `total_token_usage` cumulativo:

```ts
delta = currentTotal - previousTotal
```

Se uguale: nessun nuovo consumo anche se l'evento è nuovo. Se minore:

- nuovo segmento/reset/resume;
- non sottrarre dal totale già accumulato;
- log debug con session/version.

`last_token_usage` serve al tooltip “ultimo turno”, non al totale sessione.

### 17.4 Rate limits

Normalizzazione di:

- primary;
- secondary;
- additional limit IDs;
- credits;
- individual spend control;
- plan type.

Il parser deve tollerare campi nuovi. Unknown limit → `kind: other`, non errore.

### 17.5 Hooks

Installazione opt-in nel primo milestone delle notifiche. Hook interessati:

```text
SessionStart
SessionEnd
PermissionRequest
SubagentStart
SubagentStop
Stop
Interrupt
```

Gli hook scrivono solo eventi nel nostro sink; **non** approvano/negano permission. La feature è
osservativa, non policy engine.

### 17.6 app-server

Usarlo per operazioni dove il contratto strutturato giustifica il subprocess:

- `model/list`;
- account/rate limits on-demand/refresh lento;
- eventuali future API session-safe.

Wrapper JSON-RPC:

```text
spawn codex app-server
→ initialize
→ request
→ timeout
→ graceful shutdown
→ kill bounded se non esce
```

Non tenere un daemon permanente nel primo release. Cache risultato; un `model/list` non giustifica
un processo sempre vivo.

### 17.7 Provider scope

`model_provider`/`model_providers` solo user config. L'UI deve chiamare l'operazione
`applyMachineProvider`, non `applyProjectProvider`: il nome del metodo impedisce di dimenticare lo
scope.

---

## 18. Provider DeepSeek

È il provider di riferimento perché esercita quasi tutte le capability.

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

Il supporto Codex/Responses è documentato ufficialmente da DeepSeek.

### 18.2 Model discovery

`GET https://api.deepseek.com/models` con Bearer. Response limit piccolo, schema:

```ts
{ object: "list", data: [{ id, object: "model", owned_by }] }
```

Discovery non riempie da sola context/vision/effort; questi metadata vengono mergeati dal catalogo
bundled o da fonti ufficiali e marcati con source distinta.

### 18.3 Probe

Per verificare runtime compatibility:

- Claude transport: richiesta Anthropic minima;
- Codex transport: Responses API minima.

Il probe non parte automaticamente per ogni refresh se costa: nuovi modelli entrano come
`candidate`, il probe viene schedulato solo secondo preferenza/consenso.

### 18.4 Pricing

Parser official page. Snapshot attuale usato soltanto come fixture test, non come hardcode runtime.
La fixture contiene anche il schedule peak/off-peak per testare il rule engine.

---

## 19. Provider OpenAI / runtime Codex

Distinguere due casi:

### 19.1 ChatGPT-authenticated Codex

Il costo API non rappresenta il “costo dell'abbonamento”. Mostrare:

- token;
- context;
- primary/secondary limits;
- credits/spend controls se esposti;
- plan type se esposto.

Non trasformare token in dollari salvo una voce esplicita “equivalente API list price” disabilitata
di default, perché semanticamente può confondere.

### 19.2 API-key OpenAI/custom Responses

Qui il pricing API può produrre un costo. Il rule engine deve supportare:

- cached input;
- cache writes;
- output;
- soglie di contesto quando il modello le prevede;
- service tier.

Se la versione Codex non persiste una dimensione tariffata, confidence = `estimated`.

---

## 20. P16 — Cache/snapshot store

Ogni risorsa remota è un envelope:

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

File:

```text
current.json          last-known-good
candidate.tmp         mai letto dalla UI
history/<hash>.json   bounded
```

Promotion atomica solo dopo:

```text
network ok
parse ok
schema ok
semantic validation ok
```

304 aggiorna `fetchedAt` metadata senza creare change event semantico.

---

## 21. P17 — Change detection semantico

Non confrontare JSON stringificato. Normalizzare, ordinare e confrontare chiavi significative.

### 21.1 Modelli

Identity: `(provider, model.id)`.

Diff:

```ts
ModelChange =
  | { type: "added"; after }
  | { type: "removed"; before }
  | { type: "metadata"; field; before; after }
  | { type: "retirement"; before?; after? };
```

Label/order changes non devono sembrare model add/remove.

### 21.2 Pricing

Le tariffe diventano canonical rules ordinate. Diff rilevante:

- rate changed;
- bucket added/removed;
- schedule changed;
- currency/unit changed;
- effective date changed.

### 21.3 Limits

Due livelli separati:

```text
LimitStructureSnapshot  → per change detection
LimitUsageSnapshot      → per live UI
```

`usedPercent` non entra nella struttura. `windowMinutes`, ID, kind, credits/spend availability sì.

### 21.4 Seen state

Ogni change set ha ID hash. `changes/seen.json` registra cosa l'utente ha già visto; non usare il
solo timestamp, perché clock change e rollback non devono ripresentare spam.

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

Conditions supportano al minimo:

```text
time schedule UTC
context threshold
service tier
region
model alias/version
```

### 22.2 Determinismo

`calculateCost(snapshot, usage, facts)` è pure: nessuna rete, nessun clock globale. Il timestamp viene
passato. Testare esattamente il secondo prima/dopo una fascia peak.

### 22.3 Precisione numerica

Usare integer token counts e calcolo in micro-dollar/nano-dollar integer quando pratico, oppure una
rappresentazione decimal controllata. Non accumulare migliaia di turni in binary float senza test di
errore.

Per l'UI, arrotondare solo alla fine.

---

## 23. P19 — Limits engine

Normalizzazione:

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

Serve una serie temporale breve in memoria/disk cache:

```text
(timestamp, usedPercent, limitId)
```

Proiezione solo se:

- almeno 3 campioni;
- finestra/reset identity coerente;
- percentuale monotona nel segmento;
- slope positiva;
- nessun reset fra i campioni.

Se reset timestamp cambia, la serie si spezza.

---

## 24. Session state reducer

Gli adapter emettono eventi; la UI non legge direttamente file.

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

Un reducer produce `LiveSessionState` per workspace folder. Questo evita race fra statusLine,
transcript e watcher.

Regola timestamp/source priority:

```text
structured live runtime event
> runtime transcript event
> config observation
> catalog fallback
```

Ma un evento vecchio più autorevole non sovrascrive un evento nuovo: ogni field mantiene
`observedAt` e `source`.

---

## 25. Concorrenza

### 25.1 Refresh coalescing

Un refresh provider già in volo viene condiviso:

```ts
Map<RefreshKey, Promise<Result>>
```

Dieci finestre VS Code non devono fare dieci fetch `/models` simultanei.

### 25.2 Cross-window

Il primo milestone non implementa IPC fra extension host diversi. La cache atomica su disco + ETag
rende innocuo che due finestre facciano refresh. Promotion usa rename; history usa content hash.

### 25.3 Scritture config

Queue per path vale per tutte le finestre solo nel processo corrente; cross-process la scrittura
atomica evita file parziali ma non una lost update read-modify-write fra processi. Prima di rename si
rilegge mtime/hash: se è cambiato da quando abbiamo letto, abort + retry del merge sul nuovo testo.

Questa compare-and-retry è necessaria ora che due finestre possono gestire gli stessi config globali.

---

## 26. UI

### Status bar

Un solo `StatusBarItem` per finestra, segue editor/workspace folder attiva.

Testo generato da un pure `renderStatusbarModel(LiveSessionState, Preferences)`.

Nessuna logica filesystem nella UI.

### Tooltip

`MarkdownString`, solo dati non sensibili. Link solo verso comandi VS Code o fonti ufficiali già
note; non includere token/base URL privati completi se possono rivelare infrastruttura.

### QuickPick

`createQuickPick` quando servono refresh in place e back navigation. Ogni row porta un `action`
discriminated union, non closure anonime difficili da testare.

---

## 27. Diagnostica

Comando `CCR: Verifica installazione` restituisce una matrice:

```text
Claude Code
  installato              ✓
  config leggibile         ✓
  statusLine bridge        ✓
  transcript               ✓
  SecretStorage/material   ✓

Codex
  installato               ✓
  config layers            ✓
  rollout                  ✓
  app-server               ✓
  hooks                    non collegati

Providers
  DeepSeek /models         ✓  2 modelli
  DeepSeek pricing         ✓  aggiornato 2h fa
  OpenAI catalog           ✓  account/runtime catalog
```

Output Channel conserva dettagli. La UI mostra risultato compatto.

Mai fare probe a pagamento nel comando diagnostica senza pulsante/consenso distinto.

---

## 28. Logging e redaction

`LogOutputChannel` con livelli.

Helper obbligatorio:

```ts
redact(value)
redactHeaders(headers)
redactUrl(url)
```

Pattern sensibili:

- Authorization;
- api keys;
- materialized key path content;
- query token;
- prompt/transcript text nei log normali.

Si possono loggare IDs modello, status HTTP, byte count, source, timings, file path locali quando
necessari alla diagnostica. Un flag debug esplicito può aumentare metadata, **mai** segreti.

---

## 29. Dipendenze runtime

### Approvate

1. **`jsonc-parser`** — editing JSONC preserving comments.
2. **una libreria TOML parser pura JS** — validazione Codex config; scelta finale durante bootstrap,
   con lockfile e bundle-size check.

### Non necessarie inizialmente

- HTTP client: `fetch` globale;
- watcher: VS Code API;
- JSON schema runtime framework: validatori scritti per DTO piccoli o generated lightweight;
- HTML browser parser: parser provider-specifico + fixture;
- decimal big library: prima provare integer micro/nano-dollar helpers;
- chokidar: solo se RelativePattern + reconcile perde eventi misurati;
- cheerio: solo se pricing parser senza DOM è dimostrabilmente fragile.

### Gate per nuova dipendenza

Ogni nuova runtime dependency deve dire:

1. quale codice elimina;
2. quale classe di bug evita;
3. bundle cost;
4. manutenzione/ESM/native risk;
5. prova concreta che il codice piccolo interno non basta.

---

## 30. package.json / manifest

Working name ancora da decidere; non fissare definitivamente `publisher.name` finché il rename non è
scelto. Durante lo sviluppo il VSIX locale può mantenere l'identità di lavoro.

Contributions previste:

```text
commands
  ccr.openPicker
  ccr.changeModel
  ccr.changeProvider
  ccr.manageKeys
  ccr.addProvider
  ccr.refreshCatalogs
  ccr.showChanges
  ccr.managePresets
  ccr.linkClaudeStatusLine
  ccr.unlinkClaudeStatusLine
  ccr.linkCodexHooks
  ccr.unlinkCodexHooks
  ccr.verifyInstallation
  ccr.showLog

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

Le chiavi API e le definizioni provider private **non** stanno in `contributes.configuration`.

Baseline del manifest durante lo sviluppo:

```text
engines.vscode    ^1.139.0
@types/vscode     1.139.0 esatto
main              ./dist/extension.js
activationEvents  ["onStartupFinished"]
```

`publisher` resta necessario a `vsce package` anche senza marketplace: durante lo sviluppo si può
mantenere la stringa identitaria esistente e rinominarla insieme al package solo quando viene deciso
il nome definitivo. Nessun token/publisher account di marketplace è necessario per il VSIX locale.

`.vscodeignore` esclude `src/`, test, fixture non necessarie al runtime, config di sviluppo e
`node_modules/` quando le dipendenze runtime sono correttamente bundlate. Il package viene creato
con `vsce package --no-dependencies`; avere anche `node_modules` nel VSIX sarebbe una seconda copia
del codice.

`vscode:prepublish` esegue `npm run check` prima della build/package: il VSIX non deve poter essere
creato da un albero che fallisce typecheck, lint o test.

Activation: `onStartupFinished` resta ragionevole perché la status bar deve esistere presto, ma il
network refresh è deferred: activation non aspetta Internet.

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

Dopo activation, task non bloccanti:

```text
stale catalog refresh
stale pricing refresh
app-server capability probe cached
```

Target: niente fetch nella critical path visibile.

---

## 32. Auto-refresh state machine

Per ogni source:

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

Backoff, per esempio 1m → 5m → 30m → 2h, resettato da successo o refresh manuale.

La status bar non mostra errori refresh transitori. `showChanges`/diagnostics mostra “pricing stale
18h” se supera una soglia utile.

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

Fixture C rimuove `deepseek-v4-pro`:

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

## 36. Contract di compatibilità versioni

Ogni RuntimeAdapter dichiara:

```ts
supportsVersion(version: string): "supported" | "unknown-newer" | "too-old";
```

Non bloccare automaticamente `unknown-newer`: parse tolerant + diagnostics. Bloccare solo quando
manca una capability minima certa.

Snapshot/include source runtime version per poter spiegare bug dopo update.

Codex catalog: **mai** prendere `models.json` da `main` e imporlo a un client vecchio; è già
esistito un mismatch schema/client. Usare il catalogo del client installato o un formato provider
specificamente compatibile.

---

## 37. TOML/provider Codex: strategia DeepSeek

DeepSeek pubblica una configurazione Codex ufficiale che crea un model catalog JSON e provider
Responses. La nostra integrazione deve seguire quella semantica, ma con ownership esplicita.

Flusso iniziale:

1. leggere user Codex config;
2. se DeepSeek già configurato: adottare come unmanaged, non riscrivere;
3. se assente e l'utente chiede setup: creare provider block owned;
4. generare/aggiornare **solo** il catalogo DeepSeek posseduto da noi in un file dedicato;
5. puntare `model_catalog_json` solo quando la configurazione risultante è compatibile col client
   corrente;
6. dopo update Codex, `verifyInstallation` rivalida il catalogo prima di riscriverlo.

Se il client espone un remote model catalog stabile/documentato per custom provider, migrare a quello
e smettere di generare file locale. Fino ad allora non dipendere da feature `main` non documentate.

---

## 38. Fallback engine

Il core produce una proposta, non scrive file direttamente:

```ts
type FallbackDecision = {
  reason: "auth" | "quota" | "credit" | "timeout" | "manual" | "projected-limit";
  from: Selection;
  to?: Selection;
  action: "notify" | "ask" | "apply" | "none";
  constraints: string[];
};
```

Il RuntimeAdapter valida se `to` è applicabile a scope sicuro. Su Codex, cross-provider automatico
ritorna constraint `machine-scope-provider` e viene degradato ad ask/notify.

---

## 39. Preset schema

Versionato:

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

Mai base URL privati per default export; se l'utente esporta un provider custom, chiedere se
includere endpoint/metadata non segreti.

---

## 40. Sicurezza dei parser remoti

Catalog/pricing sono input non fidato anche se arrivano da sito ufficiale.

- max response bytes;
- no eval;
- no dynamic import;
- no HTML script execution;
- URL allowlist per source builtin;
- custom source richiede configurazione utente;
- strings remote non diventano Markdown trusted;
- labels escapeate in tooltip/QuickPick;
- nessun path scritto a partire da model ID senza sanitizzazione.

---

## 41. CI

`.github/workflows/kaji.yml` nel repository di sviluppo, un job iniziale con
`working-directory: extensions/kaji`, lanciato solo quando cambia qualcosa sotto quel path:

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

VSIX artifact. Nessun publish token.

In più, test deterministici devono forzare timezone UTC per pricing schedule; test UI/local time
separati.

---

## 42. Release checklist

1. check verde;
2. fixture current runtime aggiornate solo se cambiamento compreso;
3. F5 sul profilo reale;
4. Claude: model switch, statusLine bridge, key helper;
5. Codex: model switch, rollout parse, app-server read;
6. catalog refresh offline/online;
7. pricing parser su fixture + rete manuale;
8. file config comment preservation;
9. install VSIX reale;
10. uninstall/reinstall non deve lasciare settings runtime irripristinabili.

---

## 43. Le prove bloccanti prima di implementare feature ricche

Ordine consigliato:

### A. Runtime foundations

1. Claude project settings nel pannello.
2. Claude live model switch.
3. Claude statusLine nel pannello.
4. Codex project `model` nel pannello.
5. Codex rollout matching per `cwd`.
6. Codex hook Stop/PermissionRequest nella IDE extension.
7. Codex app-server model/list e rate limits.

### B. Cross-provider

8. DeepSeek Claude Anthropic.
9. DeepSeek Codex Responses.
10. una sola credenziale extension-managed usata da entrambi attraverso key-helper, se la policy
    scelta lo prevede.

### C. Live data

11. `/models` refresh e diff.
12. pricing parse e LKG.
13. cost parity su turni noti.
14. limits normalized su Claude e Codex.

### D. Failure modes

15. rete offline;
16. HTML pricing cambiato;
17. JSONL truncato mentre lo leggiamo;
18. config modificato da altra finestra durante la scrittura;
19. runtime aggiornato con campo sconosciuto;
20. sessione attiva su modello ritirato dal catalogo.

---

## 44. Definition of done per adapter

Un RuntimeAdapter non è “supportato” perché compila. È supportato quando:

- detect non modifica niente;
- config read distingue source/scope;
- apply restituisce esito verificabile;
- observe sopravvive a restart/resume;
- usage non duplica;
- limits degradano a unavailable;
- una versione runtime più nuova con campi extra non rompe il parser;
- diagnostics spiega i prerequisiti mancanti;
- uninstall bridge è reversibile.

Un ProviderAdapter non è “supportato” finché:

- almeno un transport è verificato end-to-end;
- model discovery ha fallback;
- pricing, se dichiarato, ha fixture + LKG;
- un nuovo model ID non causa crash;
- un model rimosso non cancella config utente.

---

## 45. Riferimenti tecnici verificati il 24/09/2026

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

### Edge cases che hanno influenzato il disegno

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

## 46. La regola finale

Il progetto precedente aveva una regola corretta: **leggere lo stato dal runtime invece di tenere una
copia mentale del runtime**. Con due runtime e fonti remote la regola diventa ancora più importante:

> configurazione, session state, catalogo remoto, pricing e limiti sono sorgenti esterne che possono
> cambiare indipendentemente dall'estensione. Il codice deve normalizzarle, conservarne provenance e
> timestamp, validarle e degradare esplicitamente quando non le conosce.

La cosa da evitare non è un errore visibile. È un numero molto convincente che in realtà appartiene
alla sessione, al prezzo o al limite sbagliato.
