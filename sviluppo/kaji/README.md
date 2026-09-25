# agent-router-extension — documento di prodotto

> **Nome di lavoro.** Il prodotto si chiama **Kaji** finché non ha un nome definitivo, e non è solo
> per Claude Code: supporta **Claude Code e Codex** attraverso adapter separati, con un core comune.
> Prima del primo release pubblico va deciso il nome definitivo (vedi `BRANDING.md`); fino ad allora
> `CCR` resta il prefisso dei comandi per non introdurre un rename cosmetico mentre l'architettura è
> ancora in costruzione.
>
> **Dove vive.** Kaji si sviluppa nel monorepo privato di Daiku: il prodotto sta in
> `extensions/kaji/`, questi documenti in `sviluppo/kaji/`. È un prodotto autonomo — si installa,
> funziona e si pubblica senza Daiku, in un repository pubblico suo.

Documento rigenerato il **24 settembre 2026** prima di iniziare lo sviluppo. Sostituisce il README
precedente: conserva i vincoli già verificati, incorpora le decisioni emerse successivamente e
aggiunge il supporto a Codex, cataloghi e prezzi auto-aggiornanti, change detection, cost metering,
limiti di abbonamento, subagenti e notifiche.

L'idea in una frase:

> **una status bar per progetto che sa quale agente, provider e modello stanno lavorando davvero,
> quanto stanno consumando, quanto costano, quali limiti restano, e consente di cambiare ciò che il
> runtime permette di cambiare senza nascondere i casi in cui serve un riavvio.**

Non è un proxy LLM e non sta in mezzo al traffico. I runtime continuano a parlare direttamente con
i provider. L'estensione osserva e configura i runtime attraverso i meccanismi che essi espongono.

---

## 1. Il problema, ora più generale

Il problema di partenza nasce da Claude Code: oggi il backend viene cambiato con uno script
PowerShell (`~/.claude/llm-switch.ps1`) che riscrive il blocco `env` di
`~/.claude/settings.json`. La scelta è quindi globale alla macchina, i task VS Code sono copiati a
mano fra workspace e il passaggio da un progetto all'altro non porta con sé provider e modello.

Il prodotto deve ribaltare quel rapporto: **il progetto descrive l'intenzione**, mentre il runtime
adapter applica ciò che il runtime consente a quello scope.

Con Codex il problema è simile ma non identico. Codex supporta `.codex/config.toml` per override di
progetto, ma per motivi di sicurezza ignora a livello progetto `model_provider` e
`model_providers`: un repository non può decidere dove spedire credenziali o prompt. Il modello e
l'effort possono essere project-scoped; il provider è machine-local. Questa differenza non va
nascosta dietro un'astrazione falsa.

Quindi il prodotto non promette “ogni cosa per progetto” in assoluto. Promette invece:

- **intenzione per progetto**: runtime, modello, effort, fallback, preset, preferenze di osservabilità;
- **applicazione secondo le capability reali del runtime**;
- **stato vivo separato dallo stato desiderato**;
- **nessun silenzio** quando desiderato e vivo divergono.

### Principi non negoziabili

1. **Runtime e provider sono due dimensioni diverse.** Claude Code e Codex sono runtime; Anthropic,
   OpenAI, DeepSeek, GLM, MiMo e altri sono provider.
2. **Nessun proxy locale.** Se un provider parla il protocollo richiesto dal runtime, il runtime gli
   parla direttamente. Se non lo parla, il modello non compare per quel runtime.
3. **I dati osservati battono i dati configurati.** La status bar mostra ciò che la sessione sta
   davvero usando quando il runtime lo espone.
4. **Le fonti remote sono aggiornabili, ma mai autoritative senza validazione.** Ogni catalogo o
   tariffario remoto passa per schema, sanity check, diff e cache last-known-good.
5. **L'assenza è uno stato.** Quota non disponibile, token non ancora noti, costo stimabile ma non
   esatto, effort non supportato: si mostrano come tali.
6. **Nessun segreto nel repository.** Le definizioni sono dati; le credenziali restano nello storage
   utente/runtime previsto.
7. **Change detection prima dell'automazione distruttiva.** Un modello che sparisce non viene
   cancellato dalla configurazione; viene marcato come ritirato/non più pubblicizzato.

---

## 2. Due assi: runtime e provider

### 2.1 Runtime

Un runtime è il client/agente che esegue il lavoro e decide come leggere configurazione, modelli,
telemetria e credenziali.

| Runtime | Config progetto | Config utente | Telemetria principale | Cambio provider per progetto |
|---|---|---|---|---|
| **Claude Code** | `.claude/settings.local.json` / `.claude/settings.json` | `~/.claude/settings.json` | `statusLine` + transcript JSONL | **sì**, tramite `env`, ma richiede un processo nuovo |
| **Codex** | `.codex/config.toml` in repo trusted | `~/.codex/config.toml` | rollout JSONL + hooks; app-server dove utile | **no nativamente**: `model_provider` e `model_providers` sono machine-local |

### 2.2 Provider

Un provider descrive modelli, trasporti compatibili, endpoint, capability, discovery e pricing. Lo
stesso provider può supportare runtime diversi attraverso protocolli diversi.

Esempio DeepSeek al 24/09/2026:

```text
DeepSeek
├─ Claude Code → Anthropic API → https://api.deepseek.com/anthropic
└─ Codex       → Responses API → https://api.deepseek.com
```

DeepSeek documenta ufficialmente entrambi i formati e una guida dedicata a Codex. Quindi la
compatibilità non va codificata come proprietà del provider in generale, ma come **transport per
runtime**.

### 2.3 Il contratto comune

Il core ragiona su oggetti normalizzati:

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

Il core non sa come Claude scrive JSONC o come Codex legge TOML. Gli adapter sì.

---

## 3. Fatti verificati sui runtime

### 3.1 Claude Code

Questi punti restano il fondamento dell'adapter Claude.

1. I settings hanno più scope e i file di progetto possono contenere `env`; il livello più
   specifico vince per le chiavi interessate.
2. Le variabili di ambiente del processo (`ANTHROPIC_BASE_URL`, token, default model per famiglie)
   sono sostanzialmente **di nascita**: cambiare provider richiede un nuovo processo/sessione.
3. La chiave `model` e i controlli di effort sono pensati per cambiare durante una sessione; `/model`
   e `/effort` restano le superfici native.
4. `apiKeyHelper` è il meccanismo adatto a far leggere a Claude Code una credenziale materializzata
   fuori dal repository senza mettere il token nel file di progetto.
5. `modelPicker` e le opzioni custom permettono di far comparire ID non nativi nel picker di Claude;
   il catalogo dell'estensione deve tracciare solo le righe che possiede.
6. La `statusLine` riceve JSON su stdin e oggi espone molto più del minimo originariamente usato:
   `model`, `session_id`, `session_name`, `transcript_path`, `workspace.project_dir`, costo sessione,
   durata, linee modificate, contesto, usage dell'ultima API call, effort vivo, rate limits,
   statistiche della prompt cache, PR/MR e worktree.
7. `context_window.current_usage` contiene `input_tokens`, `output_tokens`,
   `cache_creation_input_tokens`, `cache_read_input_tokens`. Non serve tokenizzare il testo a mano.
8. `cost.total_cost_usd` è una **stima client-side** a list price salvo una tabella `modelPricing`;
   è utile come confronto, non come verità di fatturazione per provider terzi.
9. `rate_limits` è presente per abbonamenti claude.ai Pro/Max o gateway che espongono spend limit,
   dopo la prima risposta. Ogni finestra può mancare indipendentemente.
10. `prompt_cache` include stato warm, hit ratio, richieste, miss, cache write token, cause dei miss e
    TTL. È un'ottima fonte per “cache health”, non solo per il costo.
11. Il transcript resta la sorgente per la sequenza delle risposte e l'usage per turno. Le righe
    possono essere ripersistite: la somma deve deduplicare per identità della risposta, mai per
    semplice numero di righe.
12. `claudeCode.claudeProcessWrapper` resta una leva da provare, non un requisito: può iniettare
    ambiente prima della nascita del processo, ma non risolve da solo lo storage delle credenziali.

Fonti principali: documentazione `settings`, `model-config`, `authentication`, `statusline`,
`corporate-launcher` di Claude Code, ricontrollate il 24/09/2026.

### 3.2 Codex

Codex porta gli stessi concetti, ma con contratti diversi.

1. CLI e IDE extension condividono i layer di configurazione: `~/.codex/config.toml` e
   `.codex/config.toml` di progetto trusted.
2. La precedenza documentata mette gli override CLI sopra i file progetto, poi profilo, utente,
   managed e sistema.
3. Per sicurezza il layer progetto **non può sovrascrivere** `model_provider`, `model_providers`,
   base URL sensibili, notifiche/telemetria e alcune altre chiavi. Il codice open source ha una
   denylist esplicita.
4. Il progetto può comunque impostare `model`, `model_reasoning_effort` e altre preferenze non
   negate: quindi il cambio modello per progetto è supportabile senza inventare un proxy.
5. I provider custom parlano `wire_api = "responses"`: Responses è il protocollo supportato per i
   custom provider.
6. DeepSeek supporta nativamente Responses API ed espone una guida Codex ufficiale; quindi
   DeepSeek è supportabile sia da Claude sia da Codex con lo stesso `ProviderDescriptor`, ma due
   transports.
7. Le sessioni Codex sono rollout JSONL sotto `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`.
   `session_meta` include almeno `session_id`, `cwd`, `source`, `cli_version`, `model_provider` e
   altri metadati; questo consente di associare la sessione al progetto.
8. Gli eventi `token_count` espongono usage cumulativo e dell'ultimo turno: input, cached input,
   cache-write input nelle versioni correnti, output, reasoning output, total, context window e
   rate limits quando presenti.
9. I rate limits Codex sono già strutturati in finestre `primary`/`secondary` con `used_percent`,
   durata e `resets_at`; possono inoltre esistere credits, spend controls, limiti addizionali e
   `plan_type`.
10. I rollout sono ottimi come sorgente locale per l'HUD, ma non vanno elevati a API stabile per
    operazioni invasive. Quando serve un contratto strutturato, l'app-server espone schemi e RPC
    come `model/list` e lettura dei rate limits.
11. Codex dispone di hook nativi per `SessionStart`, `SessionEnd`, `PermissionRequest`,
    `SubagentStart`, `SubagentStop`, `Stop`, `Interrupt`, tool use e compact. Questo rende le
    notifiche “ha bisogno di te / ha finito” più robuste dell'euristica sul transcript.
12. Il model manager Codex ha catalogo, cache e refresh. L'app-server `model/list` restituisce
    display name, reasoning efforts, service tiers, input modalities, visibilità, upgrade e data di
    retirement quando disponibile.
13. Non conviene parsare automaticamente `codex debug models`: il comando può stampare campi
    interni molto voluminosi e il formato del catalogo può cambiare fra versioni client. Preferire
    `model/list`/cache compatibile col client.

### 3.3 Una conseguenza importante

**“Provider per progetto” non può essere una feature uniforme.**

- Claude: possibile, ma alcune variabili richiedono un processo nuovo.
- Codex: model provider volutamente machine-local; il progetto può scegliere modello/effort, non
  ridefinire la destinazione delle credenziali.

Il QuickPick deve quindi mostrare capability, non fingere simmetria:

```text
Codex · progetto X
Provider: DeepSeek        [macchina]
Model:    deepseek-flash  [progetto]
Effort:   high            [progetto]
```

Se l'utente chiede “passa Codex da OpenAI a DeepSeek”, l'estensione modifica il layer utente con
consenso esplicito e segnala che il cambio interessa **Codex sulla macchina**, non solo quel repo.

---

## 4. Le feature definitive

Le feature sono divise in **Core**, **Live data**, **Automation** e **Convenience**. Tutte usano lo
stesso modello normalizzato; solo l'adapter runtime cambia.

### F1 — Status bar agent-aware

Una sola status bar segue il progetto/cartella attiva e mostra il runtime realmente osservato.
Formato di default, compatto:

```text
◉ Claude · DeepSeek Flash · high · 42 tok/s
◉ Codex  · GPT-6 Astra · xhigh · 118K/272K
```

Elementi opzionali configurabili: costo sessione, quota più critica, cache state. Non si tenta di
mettere tutto nella riga; il tooltip è la superficie ricca.

**Accettazione:** con più finestre/progetti aperti si capisce a colpo d'occhio chi sta lavorando,
con quale modello e se c'è un disallineamento.

### F2 — Tooltip come “Agent HUD”

Il tooltip unifica, quando disponibili:

- runtime, provider, model ID e display name;
- effort dichiarato e vivo;
- context used / window;
- token dell'ultimo turno e cumulativi di sessione;
- prompt cache hit ratio / warm / expiry;
- throughput modello e throughput turno;
- costo sessione e origine del calcolo;
- rate-limit / subscription windows con reset;
- subagenti attivi;
- desired vs live quando divergono;
- timestamp dell'ultimo refresh di catalogo e pricing.

### F3 — Picker runtime → provider → modello

Il clic sulla status bar apre un QuickPick coerente con le capability:

1. runtime attivo o da configurare (`Claude Code`, `Codex`);
2. provider compatibili con quel runtime;
3. modelli disponibili per provider e runtime;
4. effort/service tier quando il runtime li espone.

Il menu mostra anche `Nuovo`, `Deprecated`, `Non verificato`, `Richiede restart`, `Solo macchina`.

**Accettazione:** un modello scoperto automaticamente compare senza nuova release dell'estensione.

### F4 — Cambio modello con il minimo impatto

Il runtime adapter espone `applySelection()` e restituisce uno di questi esiti:

```ts
"live" | "session-restart" | "window-reload" | "machine-scope" | "unsupported"
```

Claude: cambio modello intra-provider preferibilmente live; cambio provider richiede nuova sessione
per le variabili di nascita. Codex: modello/effort via config progetto dove supportato; provider via
config utente con avviso di scope macchina.

**Accettazione:** la UI non dichiara mai “applicato” prima che lo stato vivo confermi la selezione.

### F5 — Gestione credenziali

Claude: master nel `SecretStorage` VS Code, materializzazione fuori dal repo per `apiKeyHelper`.
Codex: preferire il meccanismo di autenticazione nativo del provider/runtime; per custom provider
l'estensione può configurare il nome della variabile (`env_key`) ma non scrive segreti nel TOML di
progetto.

Regola comune: **nessun segreto nel repository e nessun catalogo che contenga token.**

### F6 — Throughput

Per Claude si continua a usare l'usage reale del transcript e, quando disponibile,
`cost.total_api_duration_ms` come denominatore API. Per Codex si usano gli snapshot token del
rollout con timestamp del turno.

Si distinguono due metriche:

- **model throughput:** output token / tempo API, quando il runtime fornisce un denominatore adatto;
- **turn throughput:** output token / tempo di parete del turno.

Il tooltip dice quale si sta mostrando. Smoothing esponenziale sul valore visuale.

### F7 — Usage token reale, non stima da tokenizer

Il prodotto non ricostruisce i token dal testo quando il runtime ha già l'usage dell'API.

Schema comune:

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

Claude mappa `input_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`,
`output_tokens`. Codex mappa i campi `TokenUsage` del rollout/app-server.

**Accettazione:** il totale sessione viene da snapshot deduplicati/cumulativi, non dalla somma
naive delle righe JSONL.

### F8 — Context & cache health

Il contesto usa il valore vivo del runtime, non una finestra hardcoded nel catalogo quando la
telemetria runtime è disponibile. Il catalogo resta il fallback e la fonte per modelli terzi prima
del primo turno.

Claude aggiunge un vantaggio particolare: `prompt_cache` può mostrare hit ratio, warm state, TTL,
miss e causa del miss. Il tooltip può quindi dire:

```text
Context        118K / 1.0M
Prompt cache   91% hit · warm · scade tra 34m
Ultimo miss    tools_changed (+2 tool)
```

### F9 — Limiti abbonamento / account unificati

I limiti non sono modellati come “5h + 7d” hardcoded. Si normalizzano finestre arbitrarie:

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

Claude può fornire `five_hour`, `seven_day` e `spend_limit`. Codex può fornire primary, secondary,
additional rate limits, credits e spend control, oltre al plan type.

La UI non assume la durata dal nome: usa `windowMinutes`/`resetsAt` reali quando presenti.

**Accettazione:** se il backend cambia la durata di una finestra o introduce un nuovo limite, il
parser lo mostra senza richiedere una release.

### F10 — Alert e burn rate

Soglie configurabili, di default solo visive; notifiche opt-in:

- warning al 75%;
- critical al 90%;
- countdown al reset;
- burn rate: “a questo ritmo la finestra finisce tra ~40 min”.

La proiezione è marcata esplicitamente come stima. Nessuna equivalenza “token → % abbonamento”: i
provider possono applicare pesi non pubblici e i contatori runtime restano la fonte autorevole.

### F11 — Fallback reattivo e preventivo

Due modalità:

- **reattivo:** 401/402/429/timeout o runtime che dichiara quota esaurita;
- **preventivo:** soglia di quota/burn rate superata prima di una nuova operazione.

Policy per progetto:

```text
manual            → avvisa soltanto
ask-before-limit  → propone il prossimo provider/modello
automatic         → commuta se la capability runtime lo consente e la policy lo autorizza
```

Su Codex il cambio provider è machine-scope: l'automatico cross-provider è quindi **disabilitato di
default** finché non esiste un meccanismo sicuro per thread/progetto. Il fallback automatico può
invece cambiare modello entro lo stesso provider.

### F12 — Live model catalog

Questa è una feature centrale, non un comando manuale accessorio.

Ogni provider/runtime può avere una catena di sorgenti:

```text
ModelSource
1. API/catalogo strutturato ufficiale
2. runtime-native catalog
3. parser pagina ufficiale
4. catalogo bundled
5. last-known-good cache
```

Regole:

- preferire API strutturate allo scraping;
- fetch con ETag/Last-Modified quando disponibili;
- TTL configurabile (default 6h);
- refresh all'attivazione solo se cache stale;
- refresh manuale sempre disponibile;
- nessun nuovo modello diventa “verified” senza probe compatibile col runtime;
- un modello scomparso diventa `deprecated/missing`, non viene eliminato dalle configurazioni.

**DeepSeek:** `GET /models` è la fonte primaria e oggi restituisce `deepseek-flash` e
`deepseek-v4-pro`. Il catalogo statico serve solo come bootstrap/fallback.

**Codex/OpenAI:** preferire `model/list` dell'app-server / model manager del client, perché contiene
reasoning efforts, service tiers, availability, upgrade/retirement e riflette il client/account.

### F13 — Pricing auto-update

Il pricing è una sorgente separata dal catalogo modelli.

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

Se non esiste API pricing si può parsare **solo la pagina ufficiale** con parser provider-specifico.
Lo scraping generico di siti terzi non entra nel prodotto.

DeepSeek dimostra perché servono regole, non quattro numeri: oggi distingue cache hit, cache miss,
output e fasce peak/off-peak. OpenAI può distinguere input, cached input, cache writes, output,
contesto corto/lungo e service tier. Il motore deve quindi ricevere usage + timestamp + contesto +
service tier.

### F14 — Cost meter

Il costo viene calcolato per turno e per sessione quando i dati sono sufficienti.

Stati possibili:

```text
exact-from-observed-usage-and-current-rate
estimated-missing-dimension
runtime-reported-estimate
unavailable
subscription-not-dollar-metered
```

Per API key/provider a consumo si mostra il costo calcolato. Per sessioni Codex/Claude incluse in un
abbonamento non si convertono artificialmente i token in “dollari spesi dall'abbonamento”: si
mostrano quota, credits e/o costo API solo se semanticamente corretto.

Nel tooltip di sviluppo si può confrontare il costo calcolato con il costo runtime-reported per
scoprire mapping errati.

### F15 — “Cache saved”

Quando il provider pubblica prezzi distinti per input cache hit/read e input normale, il motore può
calcolare anche:

```text
costo reale input
costo ipotetico senza cache
risparmio cache = ipotetico - reale
```

Si presenta come **stima di risparmio a list price**, non come credito reale in fattura.

### F16 — Change detection

Ogni refresh produce un diff rispetto all'ultimo snapshot valido. Tipi di cambiamento:

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

La UI mostra un badge discreto nel picker:

```text
✨ 2 novità
DeepSeek V5 Pro       nuovo modello
GPT-6 Astra           xhigh → max disponibile
DeepSeek Flash        output -12%
Codex weekly          reset/window modificata
```

Per i limiti abbonamento la change detection è **descrittiva**, non interpreta un singolo salto di
percentuale come cambio contrattuale. Distingue:

- **schema/policy change:** durata finestra, nuovo bucket, nuovo plan type, nuovo spend control;
- **usage update:** used percentage che varia normalmente;
- **anomaly candidate:** reset timestamp che salta all'indietro o contatore incoerente; log e
  tooltip, non conclusioni sulla causa.

### F17 — Subagent observability

Unificazione di Claude `subagentStatusLine`/telemetria disponibile e Codex hook `SubagentStart` /
`SubagentStop`.

Status bar: `⛓ 3` quando ci sono subagenti attivi. Tooltip per agente:

```text
researcher   GPT-6 Astra · high · 18K tok · running
reviewer     DeepSeek Flash · high · 31K tok · done
```

Costo per subagente solo quando l'usage è attribuibile in modo affidabile; altrimenti si mostra il
totale e si dichiara che non è separabile.

### F18 — Attention notifications

Eventi normalizzati:

```ts
"turn-started"
"turn-completed"
"permission-required"
"blocked"
"subagent-started"
"subagent-stopped"
"error"
```

Codex usa hook nativi (`PermissionRequest`, `Stop`, `SubagentStart/Stop`). Claude usa prima hook o
segnali ufficiali se disponibili nel build; transcript/statusLine restano fallback osservativo.

Notifiche desktop/VS Code opt-in e con deduplica. Nessun popup per ogni turno di default.

### F19 — Preset nominati e onboarding

Un preset è portabile e **senza segreti**:

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

Comandi: crea, applica, esporta, importa. Alla prima attivazione in un progetto senza configurazione,
l'estensione offre preset o “segui runtime corrente”, senza scrivere nulla finché l'utente non
sceglie.

### F20 — Session browser (post-MVP)

Domanda reale, ma non necessaria al primo milestone. I due runtime hanno transcript/session store
sufficienti a mostrare sessioni recenti per progetto con titolo, modello, data, token e costo. Il
resume deve però usare un comando/API supportato dal runtime; non si manipolano direttamente DB o
file di indice per aprire sessioni.

---

## 5. Catalogo: dati, non codice

Il catalogo bundled è il **bootstrap**, non la verità eterna.

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

### 5.1 ModelDescriptor normalizzato

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

Il catalogo non inventa capability assenti. Un campo sconosciuto resta `undefined`, non `false`.

### 5.2 Merge

Ordine di precedenza:

```text
user override esplicito
→ remote verified current snapshot
→ bundled catalog
→ historical last-known-good (solo per oggetti spariti, marcati stale)
```

Gli override utente possono rinominare label/colori, aggiungere provider privati e correggere
metadata, ma non trasformano automaticamente un transport non verificato in verificato.

### 5.3 Discovery e probe

Un nuovo model ID passa per stati:

```text
discovered → metadata-partial → probe-pending → verified
                               ↘ probe-failed → visible con warning / hidden secondo policy
```

Il probe deve essere minimo e rispettare costi: preferire endpoint metadata/capability quando
esistono; un messaggio reale da 1 token solo quando necessario e con consenso se comporta spesa.

---

## 6. Auto-update senza auto-corruzione

### 6.1 Scheduling

Default:

- all'attivazione: usa cache subito;
- dopo activation: refresh solo se cache > 6h;
- refresh periodico opzionale durante sessioni lunghe: 6h;
- refresh manuale: sempre;
- backoff su rete; nessun retry aggressivo.

### 6.2 Pipeline

```text
fetch
→ limite dimensione risposta
→ parse
→ schema validation
→ sanity checks
→ normalize
→ diff contro snapshot corrente
→ persist snapshot candidate
→ atomically promote a last-known-good
→ emit change events
```

Qualunque fallimento prima della promotion lascia intatto il snapshot precedente.

### 6.3 Sanity check pricing

Esempi:

- unità positiva e valuta nota;
- nessun prezzo negativo;
- nessun salto >100× senza richiedere conferma/log high severity;
- tutte le fasce orarie coprono o dichiarano il default;
- `effectiveFrom` non viene inventato se la pagina non lo espone;
- parser HTML che trova zero righe = fallimento, non “tutti i prezzi sono zero”.

### 6.4 Cronologia locale

Conservare gli ultimi N snapshot compatti (default 20) per provider, senza segreti. Serve a:

- spiegare “cosa è cambiato”;
- rollback diagnostico;
- non ripresentare lo stesso badge ogni avvio;
- distinguere una variazione temporanea da una modifica persistente.

---

## 7. Token, costo e pricing: la semantica corretta

### 7.1 Token vivi vs token cumulativi

Sono due numeri diversi:

```text
context current usage  → cosa occupa il contesto adesso
session cumulative     → cosa è stato fatturato/consumato nel tempo
```

Dopo compact, resume o cache, non coincidono. La UI deve nominarli correttamente.

### 7.2 Deduplica Claude

Il transcript può ripersistire lo stesso messaggio con usage identico. Identificatore preferito:
`message.id` + eventuale request/prompt identity. Se manca, fingerprint stabile del record rilevante.
L'offset di lettura evita riletture, ma non sostituisce la deduplica semantica.

### 7.3 Cumulativi Codex

Quando Codex fornisce `total_token_usage`, quello è preferibile alla somma degli eventi. Gli eventi
possono essere riemessi insieme a rate-limit updates. L'adapter tiene l'ultimo totale per sessione e
calcola delta monotoni; una regressione del totale apre un nuovo segmento (resume/reset/version
change), non produce token negativi.

### 7.4 Pricing engine

Il motore non contiene `if provider === ...` nel core. Le regole sono dati/espressioni provider-
specifiche compilate in una forma comune.

Input al calcolo:

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

### 7.5 “Esatto” significa esatto rispetto ai dati osservati

Il prodotto può chiamare un costo `exact` soltanto se:

- tutti i bucket tariffati sono osservabili;
- il tariffario applicabile al timestamp è noto;
- eventuali tier/context threshold sono noti;
- il runtime/provider non nasconde surcharge rilevanti.

Altrimenti `estimated`. Questo è importante per OpenAI/Codex: l'evoluzione dei campi cache-write e
service tier va seguita, e versioni vecchie del runtime possono non persistere tutte le dimensioni.

---

## 8. Limiti abbonamento e change detection

### 8.1 Non hardcodare Plus/Pro/Max

L'estensione non mantiene una tabella tipo “Plus = X prompt”. I limiti reali possono dipendere da
modello, periodo, account, workspace, promozioni e policy server-side. Si mostrano i contatori che il
runtime restituisce.

### 8.2 Snapshot

```ts
type LimitsSnapshot = {
  runtime: RuntimeId;
  accountHint?: string; // mai email/token; solo label non sensibile se già esposta dal runtime
  planType?: string;
  windows: LimitWindow[];
  credits?: { balance?: string; unlimited?: boolean };
  capturedAt: number;
};
```

### 8.3 Change detection dei limiti

Il diff ignora le normali variazioni di `usedPercent`. Notifica solo mutazioni strutturali:

- durata `windowMinutes` diversa;
- reset policy che cambia in modo persistente;
- compare/scompare secondary window;
- nuovo limit ID;
- cambia `planType`;
- compare spend control / credits;
- label di un limit cambia.

Un reset timestamp che cambia da solo può essere un update normale o un bug upstream: viene
registrato come `anomalyCandidate`, non come “OpenAI/Anthropic ha cambiato contratto”.

### 8.4 Soglie

Gli alert si calcolano sullo snapshot vivo, non sulla change history. Se il runtime non restituisce
rate limits, l'estensione non tenta di ricostruirli dai token.

---

## 9. Stato, desired state e conflitti

Per ogni progetto esistono tre livelli concettuali:

```text
DesiredSelection   → ciò che il progetto/preset chiede
ConfiguredState    → ciò che i file runtime dicono
ObservedSession    → ciò che la sessione sta davvero usando
```

La status bar usa `ObservedSession` quando c'è. Se differisce:

```text
$(debug-restart) Codex · GPT-6 Luna → desiderato Astra
```

Il tooltip spiega la causa: file modificato ma thread non riavviato, provider machine-scope,
session resume che mantiene modello precedente, ecc.

---

## 10. Sicurezza e privacy

- Nessun prompt o transcript viene inviato ai server dell'estensione: non esiste server.
- Il refresh catalog/pricing chiama solo endpoint configurati/ufficiali del provider e non invia
  contenuto delle conversazioni.
- I parser pricing leggono pagine pubbliche senza chiavi quando possibile.
- Le chiavi non entrano in log, tooltip, snapshot o change history.
- I transcript sono letti localmente e in modo incrementale.
- I file runtime non vengono riserializzati distruggendo commenti o formattazione quando esiste un
  editor strutturale adatto.
- Le modifiche machine-scope (es. provider Codex) richiedono conferma esplicita e indicazione dello
  scope.
- Nessuna automazione di fallback attraversa account/provider con segreti diversi senza policy
  esplicita dell'utente.

---

## 11. Cosa non si costruisce

1. **Proxy/translator generico.** Un modello incompatibile col protocollo del runtime resta fuori.
2. **Webview dashboard al primo milestone.** Status bar + tooltip + QuickPick + Output Channel sono
   sufficienti; una webview si giustifica solo se la history/change timeline diventa troppo ricca.
3. **Billing reconciliation.** Il costo è osservabilità locale, non fattura contabile.
4. **Scraping arbitrario del web.** Solo API o pagine ufficiali con parser versionato.
5. **Multi-account Claude automatico** finché il pannello/runtime non espone una leva affidabile.
6. **Manipolazione diretta di DB Codex per cambiare o resumere thread.** I file/DB si possono leggere
   per diagnostica solo dove necessario; le azioni passano da config/API/comandi supportati.
7. **Marketplace obbligatorio.** Il primo ciclo resta VSIX locale; pubblicazione è una decisione
   separata.

---

## 12. Milestone

### M0 — Prove bloccanti, prima del prodotto

1. Claude: `.claude/settings.local.json` viene rispettato dal pannello VS Code?
2. Claude: `model` cambia davvero a caldo senza `ANTHROPIC_MODEL` che lo sovrascriva?
3. Claude: `apiKeyHelper` funziona con Bearer sui provider terzi?
4. Claude: il pannello VS Code esegue la statusLine? Se no, quali dati restano disponibili via
   transcript/hooks?
5. Claude: tee della statusLine conserva stdout, exit code, colori e multi-linea del comando
   originale?
6. Claude: identificare il comando più pulito per riavviare una sessione, senza ID hardcoded.
7. Claude: verificare `claudeProcessWrapper` sul build Windows attuale.
8. Claude: verificare merge/scope attuale di `modelPicker`, `modelSettings` e effort su modelli terzi.
9. Codex: `.codex/config.toml` scritto dall'estensione viene applicato dal pannello/IDE alla nuova
   sessione e come si comporta su thread già aperto?
10. Codex: confermare percorso/session matching `cwd` e formato `token_count` sul build installato.
11. Codex: provare hook `PermissionRequest`, `Stop`, `SubagentStart/Stop` dalla IDE extension.
12. Codex: provare `app-server model/list` e account rate limits senza lasciare processi orfani.
13. Codex: provider DeepSeek via Responses API usando la configurazione ufficiale.
14. Catalog: `GET /models` DeepSeek + diff + nuovo model fake in fixture.
15. Pricing: parser DeepSeek con fixture HTML salvata e fail closed quando cambia struttura.
16. Cost: confrontare usage/costo CCR con costo runtime/provider su almeno 20 turni.
17. Limits: verificare primary/secondary Codex e five_hour/seven_day Claude su sessioni reali.
18. Notifications: evento done/permission produce una sola notifica, non duplicati.

### M1 — Core usabile ogni giorno

F1–F9, catalogo bundled, Claude adapter completo, Codex model/usage/limits, Secret handling,
status bar, picker, test unitari.

### M2 — Live catalog + cost

F12–F16: discovery, pricing refresh, cost engine, change detection, cache saved.

### M3 — Automation

F10–F11, F17–F19: alert, burn rate, fallback, subagent observability, notifications, preset.

### M4 — Convenience

Session browser, timeline dei cambi e eventuale webview solo se serve davvero.

---

## 13. Esperienza prevista

### Primo avvio

```text
CCR ha trovato:
✓ Claude Code
✓ Codex

Questo progetto non ha un preset CCR.
[Segui configurazione corrente] [Scegli preset] [Ignora]
```

Nessuna scrittura automatica.

### Nuovo modello scoperto

```text
$(sparkle) Catalogo aggiornato · 1 novità
DeepSeek V5 Pro

Compatibilità
✓ Claude Code / Anthropic
✓ Codex / Responses

[Prova] [Nascondi novità]
```

Se il probe costa, il pulsante `Prova` chiede consenso prima di inviare la richiesta.

### Prezzo cambiato

```text
DeepSeek Flash · pricing aggiornato
Output peak: $1.20 → $1.05 / 1M
Fonte: pagina pricing ufficiale
Valido dal: non dichiarato
```

Non si riscrive alcuna configurazione.

### Limite critico

```text
Codex · 5h 92% · reset tra 31m
Weekly 54%

[Passa a modello più economico] [Ignora fino al reset]
```

Cross-provider solo se l'azione è compatibile con scope e policy.

---

## 14. Dati correnti verificati il 24 settembre 2026

Questa sezione è snapshot, non contratto: esiste proprio per essere superata dal live catalog.

### DeepSeek

`GET https://api.deepseek.com/models` documenta attualmente:

- `deepseek-flash` — DeepSeek V4.1 Flash;
- `deepseek-v4-pro` — DeepSeek V4 Pro.

La pagina pricing ufficiale dichiara 1M context, output massimo 384K e supporto sia Anthropic API sia
Responses API per entrambi; `deepseek-flash` supporta vision, V4 Pro no. I prezzi distinguono cache
hit/miss/output e peak/off-peak. Peak: 01:00–04:00 e 06:00–10:00 UTC lun–ven; off-peak metà del
peak. Questi valori **non vanno hardcodati come verità permanente**: il parser pricing e il
snapshot remoto sono il meccanismo corretto.

### Snapshot pricing DeepSeek (solo riferimento del 24/09/2026)

I valori sotto servono come fixture e verifica umana del parser, **non** come tabella hardcoded del
prodotto. Prezzi per 1M token:

| Modello | Fascia | Input cache hit | Input cache miss | Output |
|---|---|---:|---:|---:|
| `deepseek-flash` | off-peak | $0.003 | $0.15 | $0.60 |
| `deepseek-flash` | peak | $0.006 | $0.30 | $1.20 |
| `deepseek-v4-pro` | off-peak | $0.022 | $0.66 | $1.98 |
| `deepseek-v4-pro` | peak | $0.044 | $1.32 | $3.96 |

Il parser deve estrarre anche la schedule: peak 01:00–04:00 e 06:00–10:00 UTC, lunedì-venerdì;
le altre ore sono off-peak. Se DeepSeek cambia questa regola, `pricing.schedule-changed` deve essere
un change event distinto da un semplice cambio di tariffa.

### Snapshot pricing OpenAI (esempio che giustifica il rule engine)

Al 24/09/2026 GPT-5.6 Sol è documentato a $4/1M input, $0.40/1M cached input e $20/1M output
nel caso base; cache writes 1.25× l'input non cached. Per prompt con oltre 272K input token, il
modello applica 2× all'input e 1.5× all'output per l'intera richiesta. La pricing page espone inoltre
colonne short/long context e service/processing variants per famiglie attuali.

Questo è esattamente il motivo per cui `PricingRule` riceve timestamp, context size e service tier:
un oggetto `{input, output}` non basta più. Anche questi valori sono snapshot di test, non costanti
di prodotto.

### Codex model catalog

Il catalogo open source corrente contiene metadata strutturati come context window, reasoning
levels, input modalities, service tiers, availability per piano, upgrade e retirement. L'estensione
non importa il file `main` direttamente perché schema e client possono divergere: usa il catalogo
del client installato attraverso il model manager/app-server.

---

## 15. Migrazione dalla situazione attuale Claude

Solo dopo M1 funzionante:

1. importare le chiavi da `~/.claude/llm-switch.secrets.json` nel SecretStorage; ruotare la chiave
   già esposta in chiaro dove opportuno;
2. rimuovere gradualmente il blocco globale `env` da `~/.claude/settings.json` quando i progetti
   importanti hanno una configurazione locale funzionante;
3. smettere di usare `llm-switch.ps1`;
4. cancellare per ultimi i task VS Code duplicati;
5. lasciare un comando `CCR: diagnostica migrazione` che rilevi residui che potrebbero ancora avere
   precedenza.

Codex non richiede una migrazione distruttiva iniziale: l'adapter parte leggendo i layer esistenti e
scrive solo dopo azione esplicita.

---

## 16. Riferimenti verificati il 24/09/2026

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

### Issue/edge-case utili alla progettazione

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

## 17. Criterio di successo

Il prodotto ha centrato il problema quando, aprendo un progetto, senza leggere file e senza
ricordarsi comandi, si può rispondere immediatamente a queste domande:

1. **Quale agente sta lavorando?**
2. **Dove sta mandando le richieste?**
3. **Quale modello/effort sta usando davvero?**
4. **Quanto contesto e quanti token sta consumando?**
5. **Quanto costa, quando ha senso parlare di costo?**
6. **Quanto abbonamento/quota resta e quando si resetta?**
7. **La cache sta aiutando o si sta ricostruendo?**
8. **Ci sono subagenti attivi o l'agente sta aspettando me?**
9. **È uscito un modello, è cambiato un prezzo o una policy di limite senza che io aggiorni
   l'estensione?**
10. **Se cambio modello/provider, cosa succede davvero e a quale scope?**

Se una risposta non è conoscibile dal runtime, l'estensione dice “non disponibile”. Quella è una
feature di affidabilità, non una mancanza da mascherare.

---

## 18. Baseline reale della macchina da cui nasce il progetto

Questa sezione è deliberatamente concreta. Viene dal documento del 23 settembre 2026 e serve alla
migrazione; **non è una specifica generale del prodotto**.

### 18.1 Script esistente

`~/.claude/llm-switch.ps1` conosce quattro profili e riscrive il blocco `env` dei settings utente:

| Profilo | Endpoint Claude/Anthropic | Modello principale | Side-query/subagent |
|---|---|---|---|
| `claude` | nessun override | `opus[1m]` | default subscription |
| `deepseek` | `https://api.deepseek.com/anthropic` | `deepseek-flash` | `deepseek-flash` |
| `muse` | `https://api.meta.ai` | `muse-spark-1.3-contributor` | stesso |
| `glm` | `https://api.z.ai/api/anthropic` | `glm-5.3[1m]` | `glm-5.3-flash[1m]` |

Tre proprietà del vecchio script non vanno perse durante la migrazione:

- usa `ANTHROPIC_AUTH_TOKEN` per i backend Bearer;
- imposta esplicitamente gli ID reali dei modelli e le variabili per le side-query;
- imposta le guardie necessarie ai provider terzi, inclusi i limiti di contesto e la disattivazione
  di beta non supportate quando richiesta dal provider.

La nuova estensione **non** copia ciecamente queste variabili: il catalogo/transport descriptor
decide quali sono ancora necessarie per il provider corrente e il runtime corrente.

### 18.2 Segreti esistenti

Il file legacy `~/.claude/llm-switch.secrets.json` contiene tre chiavi (`deepseek`, `glm`, `muse`).
MiMo e OpenCode Go erano provider candidati senza chiave al momento della ricognizione.

Il token DeepSeek risultava anche materializzato in chiaro nel blocco `env` utente. La migrazione
quindi non è solo “sposta il valore”: è l'occasione per **ruotare** la credenziale già esposta nel
file, poi rimuovere la copia legacy.

### 18.3 Stato Claude al 23/09/2026

Il profilo globale attivo era DeepSeek; `ANTHROPIC_MODEL` fissava `deepseek-flash`. Questo è
esattamente il caso che il prodotto deve eliminare: un override machine-global che impedisce al
progetto di esprimere la propria scelta e può interferire col cambio modello vivo.

`effortLevel` era `xhigh` mentre la chiave `model` utente conservava ancora un valore Claude: altra
ragione per separare `ConfiguredState` e `ObservedSession`.

### 18.4 StatusLine già presente

La macchina aveva già una status line personalizzata che mostrava modello, context usage e rate
limits. Il bridge dell'estensione deve quindi dimostrare di saper **avvolgere una configurazione
esistente senza alterarla**, non soltanto funzionare su un'installazione vuota.

### 18.5 Transcript

I transcript Claude reali erano già presenti sotto `~/.claude/projects/.../*.jsonl`, con eventi di
più tipi (`assistant`, `user`, attachment, queue operation, file-history snapshot e altri). Il reader
nuovo deve essere tolerant: ai fini dell'usage seleziona gli eventi rilevanti e ignora tipi nuovi
senza considerarli errori.

### 18.6 `switchModelsOnFlag`

Nel settings utente era presente `switchModelsOnFlag: false`. Il significato non era stato
verificato. Resta una prova esplorativa, non una dipendenza: cercare documentazione/changelog del
build installato; se non esiste contratto pubblico utile, non usarla.

---

## 19. Baseline provider portata dal progetto precedente

Il live catalog sostituisce l'idea di mantenere per sempre una tabella statica, ma il catalogo bundled
ha bisogno di un bootstrap. Questa è la baseline storica da **riverificare provider per provider**
prima del release. Solo DeepSeek è stato ricontrollato sul web il 24/09/2026 durante questa
riscrittura.

| Provider | Claude transport | Codex transport | Stato bootstrap |
|---|---|---|---|
| Anthropic/Claude | nativo | n/a come provider custom del progetto | supportato Claude |
| DeepSeek | Anthropic API | Responses API | **verificato 24/09** |
| GLM / Z.ai | Anthropic-compatible | da verificare Responses | bootstrap Claude |
| Muse | Anthropic-compatible secondo setup esistente | da verificare | bootstrap Claude |
| MiMo | Anthropic-compatible; endpoint/region dipendenti dal piano | da verificare | bootstrap Claude |
| OpenCode Go | solo famiglie servite via route Anthropic per Claude | provider/route Codex da verificare | parziale |

### 19.1 MiMo

Il documento precedente aveva verificato una distinzione importante: endpoint pay-as-you-go e Token
Plan usano formati di chiave diversi e il Token Plan è regionale. Il nuovo catalogo deve quindi
rappresentare **variant/region** come metadata del transport, non creare tre provider con la stessa
label se l'unica differenza è la regione.

La discovery deve essere fatta dall'endpoint modelli documentato dal provider, non da una lista
copiata nel bundle quando è disponibile una fonte strutturata.

### 19.2 OpenCode Go

Il vecchio disegno filtrava i modelli in base al protocollo: Claude Code può usare solo le famiglie
che Go serve sulla route Anthropic. Questa regola diventa generale:

```text
modello disponibile sul provider
∩ transport compatibile col runtime
∩ entitlement/account corrente
= riga mostrata nel picker
```

Non mostrare “grigio” un modello che richiederebbe un traduttore di protocollo: non è quasi
supportato, è un altro prodotto.

---

## 20. Wizard “Aggiungi provider / modello”

Questa feature resta essenziale perché il live catalog non coprirà ogni gateway privato o provider
nuovo al giorno zero.

### 20.1 Entrate

- `CCR: Aggiungi chiave` — provider noto, credenziale mancante;
- `CCR: Aggiungi modello` — model ID non presente;
- `CCR: Aggiungi provider` — endpoint nuovo/private gateway.

### 20.2 Passo 1 — Runtime e provider

Prima si sceglie dove deve funzionare:

```text
Runtime
○ Claude Code
○ Codex
○ Entrambi, se il provider ha due transport compatibili
```

Poi provider noto o `Nuovo provider…`.

Per un provider nuovo si chiedono **solo metadata non segreti**:

- label;
- transport/protocollo per runtime (`anthropic`, `responses`);
- base URL;
- auth style o meccanismo Codex;
- eventuale `/models` / model catalog endpoint;
- eventuale pagina pricing ufficiale.

### 20.3 Passo 2 — Model discovery

Se esiste una source strutturata, scaricare l'elenco e far scegliere. Se non esiste:

- model ID;
- label;
- context window se noto;
- modality/capability se documentata;
- effort support se documentato.

Un campo non noto resta “sconosciuto”; non chiedere all'utente di indovinare `vision=false`.

### 20.4 Passo 3 — Credenziale

PasswordInput solo quando l'estensione deve possedere la chiave. Se il runtime è già autenticato o
il provider usa una env var esterna, mostrare `Usa autenticazione esistente`.

### 20.5 Passo 4 — Verifica a due stadi

1. **auth/endpoint:** la credenziale arriva al provider;
2. **model/runtime:** l'ID scelto risponde sul transport effettivamente usato da Claude/Codex.

Una chiave valida non basta a dichiarare “configurato”: un model ID sbagliato è il fallimento più
facile da rimandare al primo prompt dell'utente.

### 20.6 Passo 5 — Materializzazione runtime

Claude:

- project selection nei settings locali;
- apiKeyHelper se extension-managed;
- picker row/native discovery quando appropriato;
- side-query model mapping solo se richiesto.

Codex:

- project `model`/effort quando possibile;
- provider definition solo user-level;
- auth command/env secondo ownership;
- model catalog compatibile col client quando necessario.

Il wizard presenta esplicitamente lo scope prima di salvare:

```text
Modello: questo progetto
Provider Codex: tutta la macchina / profilo Codex
Chiave: storage utente, mai repository
```

---

## 21. Sincronizzazione con i picker nativi

Il picker CCR deve funzionare anche quando il picker nativo del runtime non sa ancora nulla del
modello. La sincronizzazione nativa è comunque desiderabile.

### Claude Code

- usare righe `modelPicker` possedute/tracciate quando è il meccanismo più stabile;
- `ANTHROPIC_CUSTOM_MODEL_OPTION` resta utile per un singolo modello project-scoped;
- la documentazione corrente espone anche gateway model discovery da `/v1/models` quando la relativa
  opzione è abilitata: preferire discovery nativa quando il provider/gateway rientra davvero in quel
  contratto, senza forzarla su endpoint incompatibili;
- non usare `replaceBuiltInOptions` salvo richiesta esplicita: il default è append/non distruttivo.

### Codex

- per i modelli OpenAI/ChatGPT usare il model catalog del client (`model/list`), non una copia nostra;
- per provider custom seguire il formato supportato dal client installato e la configurazione
  ufficiale del provider;
- non iniettare il `models.json` di `openai/codex@main` in un Codex vecchio: schema e client possono
  divergere;
- se il native picker non è sincronizzabile in sicurezza, **CCR mostra comunque il modello nel proprio
  picker** e segnala `native picker: non sincronizzato`.

Questa distinzione evita che una feature cosmetica blocchi l'auto-discovery principale.

---

## 22. Status bar: stati e priorità visiva

La riga deve restare leggibile. Ordine di priorità:

1. stato problematico;
2. runtime/model;
3. effort;
4. una sola metrica dinamica scelta dall'utente.

Esempi:

| Stato | Esempio |
|---|---|
| attivo | `◉ Claude · DeepSeek Flash · high · 42 tok/s` |
| Codex | `◉ Codex · GPT-6 Astra · xhigh · 118K/272K` |
| chiave mancante | `$(key) DeepSeek · chiave mancante` |
| desired ≠ live | `$(debug-restart) GLM 5.3 · da riavviare` |
| permission | `$(bell) Codex · attende permesso` |
| working | `$(sync~spin) Claude · DeepSeek Flash` |
| errore | `$(error) Agent Router` |
| nessun override | `$(circle-outline) Claude · subscription` |

Per quota/costo la riga può essere configurata:

```text
... · $0.18
... · 5h 82%
... · cache 91%
```

ma il default non supera quattro segmenti. Tutto il resto va nel tooltip.

---

## 23. Credenziali: dettaglio operativo

### 23.1 Claude extension-managed

Il vecchio principio resta: `SecretStorage` è canonico, un helper esterno deve leggere una
materializzazione in chiaro perché il processo Claude non può interrogare lo storage cifrato
VS Code.

Invarianti:

- file fuori dal repo;
- permessi più stretti possibile;
- helper senza rete;
- nessun `ANTHROPIC_AUTH_TOKEN` residuo che abbia precedenza e zittisca l'helper;
- riconciliazione all'attivazione;
- delete esplicito quando si rimuove una chiave dal prodotto.

### 23.2 Codex

Non imporre SecretStorage se Codex ha già auth funzionante. L'estensione deve sapere **chi possiede la
credenziale**, altrimenti rischia di creare due fonti di verità.

Per provider custom che l'utente vuole gestire da CCR, il command-backed auth di Codex permette di
riusare lo stesso key-helper. Questo va provato end-to-end con il client installato prima di
promuoverlo a default.

### 23.3 Verifica

Salvare una nuova chiave senza provarla è vietato dal wizard, salvo `Salva senza verificare` esplicito
per endpoint offline/aziendale. In quel caso lo stato è `unverified`, non verde.

---

## 24. Prove ereditate dal vecchio piano che restano aperte

Il nuovo M0 le raggruppa, ma queste domande specifiche non vanno perse:

- rimuovere un blocco Claude `env` basta a tornare alla subscription o serve un valore vuoto in
  qualche build/provider?
- `claudeCode.environmentVariables` sulla macchina può avere precedenza e interferire?
- il pannello Claude esegue statusLine con la stessa semantica della CLI?
- `cost.total_api_duration_ms` cresce in modo abbastanza stabile per il throughput modello?
- `modelPicker` custom appare nel pannello VS Code, non solo nella CLI?
- `behavesAs`/capability metadata produce effort/capability sensati per ID terzi?
- `modelSettings` e gli effort per modello rispettano il merge/scope documentato dal build corrente?
- ogni provider terzo espone balance/credit in modo strutturato o no?
- il wrapper di processo Claude funziona sul Windows build reale?
- il provider custom Codex configurato user-level è rispettato allo stesso modo da CLI e IDE?
- il native Codex model picker segue il custom provider senza lasciare model/provider incoerenti?

Ogni risposta aggiorna il documento; niente codice “perché probabilmente funziona”.

---

## 25. Perché queste feature prima dello sviluppo

L'espansione non deve trasformarsi in scope creep. Le feature promosse ora hanno una proprietà in
comune: **cambiano i confini dei dati**, quindi costerebbero molto di più se aggiunte dopo.

- Codex cambia il confine `runtime`.
- Live catalog cambia il confine `catalogo statico vs sorgente`.
- Pricing cambia il modello dati dell'usage.
- Subscription limits impedisce di hardcodare `5h/7d`.
- Change detection richiede snapshot/history fin dall'inizio.
- Subagent/notifications richiedono un event model comune.

Il session browser invece può aspettare perché usa dati già raccolti senza cambiare i confini del
core.
