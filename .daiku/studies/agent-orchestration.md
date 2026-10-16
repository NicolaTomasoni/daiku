# Agent orchestration — opencode `experimental.subagent_depth` vs agent-orchestration frameworks

> **Fonte primaria.** opencode, repository `anomalyco/opencode` (alias storico `sst/opencode`), tag
> **`v2.0.29`** — commit `042d0832f5f3a73eaa039a58a7d565776f6d4290`, datato **2026-10-14**. Versione
> **in uso su questa macchina**: `opencode --version` → `opencode v2.0.29` (riverificato 2026-10-15).
> Tag più recente della linea V2: **`v2.0.29`**.
> **Raccolta:** 2026-10-15.
>
> **Perché questa nota.** Daiku è host-agnostico e si appoggia a subagenti in contesto fresco per
> orchestrare la sua catena (`new-feature → ship-feature → review → finder`, `review → finder`,
> `research → study`, `new-feature → decision-doc`). Il contratto
> `plugins/daiku/contracts/orchestration.md` §4 (*Depth and degradation*) dichiara che
> `opencode` limita l'annidamento con la chiave sperimentale `experimental.subagent_depth`
> (default `1`) e che `review → finder` chiede `2`. Questa nota verifica quel numero **dal sorgente
> della versione in uso** e confronta la via «alzare la chiave dell'host» con la via «un framework di
> orchestrazione che possiede fan-out e annidamento al posto di Daiku».
>
> **Cutoff del modello.** Le versioni di opencode qui trattate (linea V2) e i framework di
> orchestrazione sono più giovani del cutoff: tutto ciò che segue è copiato dalle fonti citate al
> momento della raccolta, non da memoria.

## Indice

1. **Fondamenti**
   - 1.1 Meta e convenzioni
   - 1.2 Il terreno per cui questa nota è scritta
2. **Superficie opencode: il tool `subagent`**
   - 2.1 Nome esportato
   - 2.2 Parametri di input e output
   - 2.3 I controlli prima del lancio, in ordine
   - 2.4 Come si dichiara un agente e dove vive il file
3. **La chiave `experimental.subagent_depth`**
   - 3.1 Lo schema dichiara un solo fatto: un intero non negativo, default 1
   - 3.2 `normalize.ts`: la chiave vive solo sotto `experimental`, in radice è scartata
   - 3.3 Il calcolo della profondità (sorgente canonico)
   - 3.4 Frasi esatte della doc e discrepanza con la sorgente
4. **Comportamento della chiave**
   - 4.1 Q1 — `subagent_depth` limita i round del ciclo, o solo la profondità di annidamento?
   - 4.2 Q2 — Il default `1`: una review lanciata a mano compone, e cosa fallisce sulla catena lunga
5. **Il numero del contratto** (`review → finder` chiede `2`) — Q3
6. **Framework di orchestrazione**
   - 6.1 Q4 (a) — Framework di orchestrazione in Python
   - 6.2 Q4 (b) — Framework di orchestrazione in JavaScript/TypeScript
   - 6.3 Q4 (a-bis) — pydantic-ai: trattamento completo
7. **Q5** — Alternative che non chiedono né framework né un cambio di metodo
8. **Q6** — Cosa servirebbe a rendere la chiave dell'host affidabile

---

## 1. Fondamenti

### 1.1 Meta e convenzioni

- **`[to verify]`** marca un fatto che le fonti non confermano: non è un'ipotesi da riempire a
  memoria, è il margine che resta sotto le decisioni.
- **"verbatim"** = copiato dalla fonte, senza riscrivere «a sentimento».
- **Ancore primarie lette al tag `v2.0.29`** (raw.githubusercontent.com, 2026-10-15):
  - `packages/core/src/tool/plugin/subagent.ts` — il tool `subagent` e il calcolo del tetto;
  - `packages/schema/src/config/experimental.ts` — lo schema della chiave;
  - `packages/core/src/config/normalize.ts` — come la chiave viene normalizzata (e la trappola della
    sede);
  - `packages/web/src/content/docs/config.mdx` — la documentazione pubblica della chiave;
  - `packages/web/src/content/docs/agents.mdx` — agenti, primari e subagenti.
- **Repository dei candidati framework** (documentazione ufficiale corrente) — vedi §6.

### 1.2 Il terreno per cui questa nota è scritta

Daiku è un pacchetto host-agnostico che **non orchestra nulla da sé**: il loop dell'agente lo esegue
l'host, e il pacchetto è prosa (i contratti) più programmi `node`/`git`. Le sue catene delegano però a
subagenti dell'host, e il metodo dichiara chi può ri-delegare (`plugins/daiku/contracts/orchestration.md`
§4, *Depth and degradation*): `ship-feature`, `review`, `commit`, `handoff`, `research`, con il
percorso più lungo a quattro livelli `new-feature → ship-feature → review → finder`.

`STACK.md` fissa i vincoli che ogni decisione qui deve rispettare:

- **§1 — Linguaggi e runtime.** «**JavaScript**, in moduli ES, nei file `.mjs`. Il runtime è **Node.js
  18 o superiore**» ; «Non c'è nessun linguaggio compilato, nessun transpiler e nessun bundler: i file
  `.mjs` sono il codice che gira.»
- **§2 — Framework e librerie.** «**Nessuna dipendenza esterna.** Il pacchetto non dichiara alcun
  manifesto di **dipendenze** né alcun lockfile: un `package.json` descrittore del plugin è
  ammesso; tutto è scritto sulla libreria standard di Node e sulle
  API dell'host.»
- **§3 — Strumenti e catena di build e prova.** «**Non c'è una build**: ciò che si scrive è ciò che si
  esegue.»

`ARCHITECTURE.md` §3 fissa la decisione gemella: **«Un motore deterministico possiede l'ordine della
catena»** e, lato orchestrazione, il contratto §6: **«il `Workflow` tool non è il motore di nessuna
skill: l'orchestrazione appartiene all'agente, che delega a subagenti»**. Una framework che eseguisse
il loop al posto dell'agente urterebbe questa decisione come urta §1.

---

## 2. Superficie opencode: il tool `subagent`

Fonte: `packages/core/src/tool/plugin/subagent.ts`, `packages/web/src/content/docs/agents.mdx`,
`packages/web/src/content/docs/config.mdx` al tag `v2.0.29` (commit
`042d0832f5f3a73eaa039a58a7d565776f6d4290`).

### 2.1 Nome esportato

```ts
export const name = "subagent"
```

Il plugin si registra con `id: "opencode.tool.subagent"` e aggiunge il tool via `editor.add({ name, ... })`.

Il tool che lancia un subagente si chiama **`subagent`** (`export const name = "subagent"` in
`packages/core/src/tool/plugin/subagent.ts`), benché la documentazione `config.mdx` lo chiami ancora
«Task tool» e la chiave di permesso sia `task`. **`[to verify]`:** l'allineamento `task`/`subagent`.

### 2.2 Parametri di input e output

#### Parametri di input (schema verbatim)

```ts
export const Input = Schema.Struct({
  agent: Schema.String.annotate({
    description:
      "The type of specialized agent to use for this task. If the user asks for a subagent by a name that is not one of the available subagents, they most likely mean a model: pick a suitable agent and pass the name through the model parameter instead.",
  }),
  description: Schema.String.annotate({ description: "A short 3-5 word label for the task, displayed to the user" }),
  prompt: Schema.String.annotate({ description: "The task for the subagent to perform" }),
  model: Schema.optionalKey(Schema.String).annotate({
    description:
      'NEVER set this unless the user explicitly asks for a particular model or variant. The value is written as "providerID/modelID", or "providerID/modelID#variant" to include a variant. Do not guess the ID: look the model up with the models tool, filtering to your own provider first.',
  }),
  sessionID: Schema.optionalKey(SessionSchema.ID).annotate({
    description:
      "Continue a specific previous subagent conversation by passing its sessionID. Calls without a sessionID start a new conversation.",
  }),
  background: Schema.optionalKey(Schema.Boolean).annotate({
    description:
      "Run the subagent in the background and return immediately. You will be notified when it completes. DO NOT sleep, poll, or proactively check on its progress.",
  }),
})
```

| Parametro | Obbligatorietà | Ruolo |
|---|---|---|
| `agent` | obbligatorio | il tipo di agente specializzato da usare |
| `description` | obbligatorio | etichetta breve (3-5 parole) mostrata all'utente |
| `prompt` | obbligatorio | il compito del subagente |
| `model` | opzionale | override di modello, `"providerID/modelID"` o `…/…#variant` |
| `sessionID` | opzionale | riprende una conversazione di subagente precedente |
| `background` | opzionale | esegue in background e torna subito |

Obbligatori: `agent`, `description`, `prompt`. Opzionali: `model`, `sessionID`, `background`.

Output (schema verbatim):

```ts
export const Output = Schema.Struct({
  sessionID: SessionSchema.ID,
  status: Schema.Literals(["completed", "running"]),
  output: Schema.String,
})
```

### 2.3 I controlli prima del lancio, in ordine (verbatim)

1. **Sessione padre** — `sessions.get(context.sessionID)`; errore `Parent session not found: ${context.sessionID}`.
2. **Profondità** — risale i `parentID` contando `depth` (snippet canonico in §3.3).
3. **Limite di profondità** — letto sotto `experimental`; errore `Subagent depth limit reached (${limit}). ...`.
4. **Risoluzione dell'agente** — `agents.resolve(input.agent)`; se `undefined`: `Unknown agent: ${input.agent}`.
5. **Rifiuto di `mode: "primary"`**:
   ```ts
   if (agent.mode === "primary")
     return yield* new ToolFailure({ message: `Agent ${input.agent} cannot run as a subagent` })
   ```
6. **Assert di permesso** — `permission.assert(...)`, errore `Subagent denied: ${agent.id}`.
7. **Sessione esistente** (solo con `input.sessionID`): `Subagent session not found: ${input.sessionID}`,
   poi `Session ${existing.id} is not a child of the current session`.
8. **Override del modello** (solo con `input.model`) — `resolveModel`, con `Invalid model "${input}"…`,
   `Model "${ref.providerID}/${ref.id}" is not available…`, e i casi variante.

Il modello effettivo del figlio è `override ?? agent.model ?? parent.model`. Il primo prompt di una
nuova sessione viene prefissato con `"You are a subagent spawned by another session."`.

### 2.4 Come si dichiara un agente e dove vive il file

Dalla doc `agents.mdx` — due vie. JSON in `opencode.json` sotto la chiave `agent`; oppure Markdown:
«You can also define agents using markdown files. Place them in:

- Global: `~/.config/opencode/agents/`
- Per-project: `.opencode/agents/`»

«The markdown file name becomes the agent name. For example, `review.md` creates a `review` agent.»
Il comando interattivo è `opencode agent create`.

**`mode: primary` vs `mode: subagent`** (verbatim dalla doc):

- Primary: «Primary agents are the main assistants you interact with directly. You can cycle through
  them using the **Tab** key, or your configured `switch_agent` keybind. These agents handle your
  main conversation.»
- Subagents: «Subagents are specialized assistants that primary agents can invoke for specific
  tasks. You can also manually invoke them by **@ mentioning** them in your messages.»
- «The `mode` option can be set to `primary`, `subagent`, or `all`. If no `mode` is specified, it
  defaults to `all`.»

---

## 3. La chiave `experimental.subagent_depth`

### 3.1 Lo schema dichiara un solo fatto: un intero non negativo, default 1

`packages/schema/src/config/experimental.ts` (tag `v2.0.29`), verbatim:

```ts
export class Info extends Schema.Class<Info>("ConfigExperimental.Info")({
  portable_shell_scanner: Schema.Boolean.pipe(optional).annotate({
    description: "Enable the experimental portable shell permission scanner. Defaults to false.",
  }),
  subagent_depth: NonNegativeInt.pipe(optional).annotate({
    description: "Maximum subagent nesting depth. Defaults to 1.",
  }),
  policies: ConfigPolicy.Info.pipe(Schema.Array, optional).annotate({
    description: "Deprecated: use top-level policies. Ordered policies controlling access to configured resources",
  }),
}) {}
```

L'unica descrizione dello schema è «Maximum subagent nesting depth. Defaults to 1.» — parla di
**profondità di annidamento**, non di numero di delega o di round. `NonNegativeInt`: `0` è ammesso e
significa «nessun lancio».

### 3.2 `normalize.ts`: la chiave vive solo sotto `experimental`, in radice è scartata

`packages/core/src/config/normalize.ts` (tag `v2.0.29`), verbatim:

```ts
const unsupportedTopLevel = ["logLevel", "server", "subagent_depth", "layout"] as const
```

```ts
function unsupportedIfPresent(value: Record<string, unknown>, key: string, path: string[], diagnostics: Diagnostic[]) {
  if (!own(value, key)) return
  diagnostics.push({ kind: "unsupported", path, message: "omitted unsupported legacy setting" })
}
```

e il ramo che la copia nell'`experimental` normalizzato:

```ts
if (own(experimental, "subagent_depth")) {
  ...
    ConfigExperimental.Info.fields.subagent_depth,
    experimental.subagent_depth,
    ["experimental", "subagent_depth"],
  ...
  if (value !== undefined) result.subagent_depth = value
}
```

**Conseguenza operativa.** Alla `v2.0.29` la chiave in **radice** di `opencode.json` è un *legacy
setting non supportato*: viene **omessa** e produce un diagnostico `{kind: "unsupported", message:
"omitted unsupported legacy setting"}`. L'unica sede letta è **`experimental.subagent_depth`**. La
pagina `config.mdx` dello stesso tag, invece, la mostra **in radice** (`"subagent_depth": 2`) — è la
trappola: la doc pubblica è indietro rispetto al sorgente, e chi copia l'esempio scrive la chiave
dove viene scartata. **`[to verify]`:** se quel diagnostico venga stampato all'utente in `opencode run`
o resti interno — il sorgente lo raccoglie, ma non si è osservato l'output a runtime.

### 3.3 Il calcolo della profondità (sorgente canonico)

**Come si calcola `depth`** (verbatim da `packages/core/src/tool/plugin/subagent.ts`), sorgente unica
di questo snippet: le sue occorrenze in §4.1, §4.2, §5 e §6.3 sono rimandi a questa sezione.

```ts
              const parent = yield* sessions
                .get(context.sessionID)
                .pipe(
                  Effect.mapError(
                    (error) => new ToolFailure({ message: `Parent session not found: ${context.sessionID}`, error }),
                  ),
                )
              let current = parent
              let depth = 0
              while (current.parentID) {
                depth++
                current = yield* sessions
                  .get(current.parentID)
                  .pipe(
                    Effect.mapError(
                      (error) => new ToolFailure({ message: `Parent session not found: ${current.parentID}`, error }),
                    ),
                  )
              }
              const limit = Config.latest(yield* config.entries(), "experimental")?.subagent_depth ?? 1
              if (depth >= limit)
                return yield* new ToolFailure({
                  message: `Subagent depth limit reached (${limit}). Increase "experimental.subagent_depth" to allow nested subagents.`,
                })
```

**Cosa conta `depth`, esattamente.** Il `while` parte da `current = parent`, dove `parent` è la
sessione **chiamante** (`context.sessionID`), con `depth = 0`, e a ogni `current.parentID` presente
incrementa `depth` e risale al genitore. Quindi `depth` = **numero di antenati della sessione che
invoca il tool** (la sua profondità di annidamento), non il numero di figli, né di lanci: la primaria
(che non ha `parentID`) ha depth 0, la sua figlia 1, la nipote 2. Il default è nel `?? 1`; lo schema
lo dichiara (§3.1).

### 3.4 Frasi esatte della doc e discrepanza con la sorgente

Sezione `config.mdx` → **Subagent depth**:

> You can control how deeply subagents can invoke other subagents using the `subagent_depth` option.

Esempio di configurazione **della doc**:

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "subagent_depth": 2
}
```

> The default is `1`, which allows primary agents to launch subagents but prevents those subagents
> from launching additional subagents. Set it to `2` to allow one additional level of nested
> subagents, or `0` to prevent all subagent launches.

**Discrepanza verificata (fatto della sorgente):** l'esempio della doc mette `subagent_depth` **alla
radice**, ma il codice legge il valore **sotto `experimental`**, e il messaggio d'errore del tool
prescrive quella sede: `Increase "experimental.subagent_depth" to allow nested subagents.` La doc non
mostra da nessuna parte l'esempio sotto `experimental`. Quindi l'esempio a radice della sezione
«Subagent depth» **non è la chiave che la sorgente legge**. `[to verify]` se sia un refuso della doc.

La sezione `experimental` avverte: «The `experimental` key contains options that are under active
development.» e in `:::caution` «Experimental options are not stable. They may change or be removed
without notice.»

---

## 4. Comportamento della chiave

### 4.1 Q1 — `subagent_depth` limita i round del ciclo, o solo la profondità di annidamento?

**File e tag.** Tutto è citato da `anomalyco/opencode`, tag `v2.0.29` = commit
`042d0832f5f3a73eaa039a58a7d565776f6d4290`. Percorso: `packages/core/src/tool/plugin/subagent.ts`.
Il blocco che calcola il limite e quello che alza il guasto stanno in §3.3; qui se ne trae la
conseguenza.

**Conferma dal banco di prova** (`packages/core/test/tool-subagent.test.ts`, stesso tag). La sessione
chiamante è creata come figlia della radice (`parentID: root.id`), quindi con 1 antenato, e a limite
1 (default) la chiamata fallisce:

```ts
          const root = yield* sessions.create({ location })
          const parent = yield* sessions.create({ parentID: root.id, title: "parent" })
          ...
              input: { agent: "reviewer", description: "nested", prompt: "should fail" },
          ...
            error: {
              type: "tool.execution",
              message: expect.stringContaining("Subagent depth limit reached (1)"),
            },
```

**Il controllo è per-invocazione, sul numero di antenati; non conta i lanci.** Il calcolo è
ricalcolato a ogni invocazione e non incrementa mai un contatore di lanci. La sessione chiamante non
cambia mai il proprio `parentID` quando lancia figli: crea sessioni **figlie** con
`parentID: context.sessionID`, lasciando intatta la propria catena di antenati. Nessun contatore
viene toccato al lancio, e nulla rifiuta dopo N lanci. Conseguenza diretta: **una stessa sessione che
lancia molti subagent in serie o in parallelo lavora sempre alla stessa `depth`** (illimitata in
ampiezza/ripetizioni).

**Nessun altro contatore limita i round o i subagent totali in `v2.0.29`.** Interrogazioni
`gh api search/code?q=<term>+repo:anomalyco/opencode`:

- `subagent_tree_limit` → **0** risultati; `subagent_task_timeout` → **0**; `max_subagent` → 0;
  `subagent_limit` → 0; `subagent_count` → 0.

**L'unica chiave è `experimental.subagent_depth`.** Lo schema in
`packages/schema/src/config/experimental.ts` (tag `v2.0.29`) dichiara, sotto `experimental`, solo
tre chiavi: `portable_shell_scanner`, `subagent_depth`, `policies` (deprecata). L'albero ricorsivo
completo del tag (`truncated: false`) contiene, in tutto ciò che riguarda i subagent, solo
`packages/core/src/session/subagent-completion.ts`, `packages/core/src/session/subagent-job.ts`,
`packages/core/src/tool/plugin/subagent.ts` e i loro test.

**Nessuna occorrenza di «round / loop / iteration / count / times» legata a `subagent_depth`.** Nei
tre punti in cui la chiave è descritta nel tag (schema, messaggio d'errore, doc) le parole usate sono
solo *deeply, invoke, launch, nested, level, depth* — mai *round*, *loop*, *iteration*, *count*,
*times*. Questa assenza è l'indicazione decisiva: il sorgente non nomina round o iterazioni per
questa chiave, perché non le governa.

**Verdetto: `experimental.subagent_depth` limita solo la profondità di annidamento — il numero di
antenati della sessione che invoca `subagent` — e viene valutato a ogni invocazione contro quel
numero, senza contare lanci o round; una singola sessione può quindi lanciare subagent all'infinito
(in serie o in parallelo) alla stessa profondità, e nel tag `v2.0.29` non esiste alcuna chiave o
contatore che limiti i round di un ciclo di review.**

### 4.2 Q2 — Il default `1`: una review lanciata a mano compone, e cosa fallisce sulla catena lunga

Il calcolo di `depth` e il significato della soglia `depth >= limit` sono in §3.3; lo schema della
chiave in §3.1. Qui se ne applicano le conseguenze.

| Lancio | Sessione che chiama il tool | depth della sessione | `depth >= 1`? | Esito |
|---|---|---|---|---|
| A) `review → finder` | `review` (top-level, senza parent) | 0 | `0 >= 1` falso | compone |
| B1) `new-feature → ship-feature` | `new-feature` (top-level) | 0 | `0 >= 1` falso | compone |
| B2) `ship-feature → review` | `ship-feature` (figlia di new-feature) | 1 | `1 >= 1` **vero** | **fallisce qui** |
| B3) `review → finder` | `review` — mai creata | — | — | non raggiunto |

**Verdetto.**

**A) Compone.** La review lanciata a mano gira come sessione primaria, depth 0; `0 >= 1` è falso,
quindi il fan-out `review → finder` parte. Al default `1` la primaria può sempre spawnare la prima
generazione.

**B) Fallisce al secondo lancio**, quando `ship-feature` prova a lanciare `review`. `ship-feature` è
figlia di `new-feature`, quindi la sua depth è 1: `1 >= 1` è vero e il tool rifiuta. L'utente vede
esattamente:

```
Subagent depth limit reached (1). Increase "experimental.subagent_depth" to allow nested subagents.
```

`new-feature → ship-feature` passa; `review` non viene mai creata, quindi `review → finder` è
irraggiungibile. Al default `1` è permessa **una sola generazione** di spawn (la primaria → i suoi
figli), non due.

**Minimo per la catena a quattro livelli:** il lancio più profondo è `review` (depth 2) → `finder`;
serve che `2 >= limit` sia falso, cioè `limit >= 3`. **`subagent_depth: 3`.** (Con `2` la catena
arriva a creare `review` ma rosseggia su `review → finder`: `2 >= 2` vero.)

**Le tre catene a due passi, al default 1:**

- `research → study`: research a depth 0, `0 >= 1` falso → **compone**.
- `commit → update-memory`: commit a depth 0, `0 >= 1` falso → **compone**.
- `new-feature → decision-doc`: new-feature a depth 0, `0 >= 1` falso → **compone**.

Ognuna compone **solo se il primo anello gira nella sessione primaria**: innestata dentro un'altra
catena (come `commit` dentro `ship-feature`) eredita la depth dell'antenato e cade come il caso B2.

**Con `subagent_depth: 0` fallisce anche il primo lancio della primaria.** `depth = 0` e `limit = 0`,
quindi `0 >= 0` è vero e il tool rifiuta prima ancora di risolvere l'agente. Non è un valore
illegale — lo schema lo tipizza `NonNegativeInt` («Maximum subagent nesting depth. Defaults to 1.») —
quindi `0` è ammesso e spegne del tutto il fan-out.

---

## 5. Il numero del contratto (`review → finder` chiede `2`) — Q3

**Le frasi del contratto da confrontare** — `plugins/daiku/contracts/orchestration.md` §4 (*Depth and
degradation*), verbatim:

> The key `experimental.subagent_depth` defaults to `1`, which lets a primary launch a subagent but
> stops that subagent from launching another — so at the default **no chain that delegates twice
> composes**: `review → finder`, `research → study`, `commit → update-memory` and `new-feature →
> decision-doc` all ask the project to raise the key to `2`, and the four-level path `new-feature →
> ship-feature → review → finder` asks for at least `3`; at `0` no launch happens at all.

> Every other delegated step is a **leaf**, and the longest path in the graph stays four levels,
> `new-feature → ship-feature → review → finder`, with the collection chain at three levels
> `new-feature → research → study`.

**La semantica della sorgente (opencode v2.0.29), verificata sui file citati.** Il blocco è quello
canonico di §3.3 (rimando, non ripetuto). `packages/core/src/tool/plugin/subagent.ts` conta gli
**antenati della sessione chiamante**, non i suoi discendenti — e rifiuta quando il **chiamante** ha
già raggiunto o superato il limite.

Una sessione **primary** non ha `parentID`, quindi il corpo del `while` non gira mai → `depth = 0`.
Una sessione con un antenato → `depth = 1`. Il lancio compone **se e solo se** `depth < limit`.

**L'aritmetica del lancio del `finder`.**

| Sessione che lancia il `finder` | Antenati | `depth` | Compone se `depth < limit` → `limit` minimo |
|---|---|---|---|
| `review` **primary** (lanciata a mano) | 0 | 0 | **1** |
| `review` **figlia** (1 antenato, es. sotto `ship-feature`) | 1 | 1 | **2** |
| `review` nel percorso a quattro livelli | 2 | 2 | **3** |

Percorso a quattro livelli passo per passo: `new-feature` è primary (depth 0) e lancia `ship-feature`
→ serve `limit ≥ 1`; `ship-feature` gira a depth 1 e lancia `review` → serve `limit ≥ 2`; `review` gira
a depth 2 e lancia `finder` → **serve `limit ≥ 3`**. Il massimo lungo la catena è 3.

**Verdetto. La frase in blocco «`review → finder` chiede `2`» è ESATTA quando la sessione `review` è
essa stessa una figlia (depth 1 → serve 2), e UNO TROPPO ALTA quando `review` è il primary lanciato a
mano (depth 0 → basta `1`).** Il contratto mette `review → finder` nello stesso gruppo di archi il
cui chiamante è *sempre* una figlia (`research → study`, `commit → update-memory`), ma `review` non lo
è sempre: `/review` è un entry point dell'owner, e la sua prima delega parte da depth 0. Il «almeno
3» del percorso a quattro livelli, invece, è **esatto e non uno troppo alto**: lì `review` siede a
depth 2 e il lancio del `finder` chiede `2 < limit`, cioè `3`.

**Cosa deve essere misurato per deciderlo.** Una sola esecuzione discriminante. La prova: opencode
v2.0.29 su un progetto con `experimental.subagent_depth: 1` in `opencode.json`, e l'owner che
**lancia `/review` a mano**, così che la sessione `review` sia il primary (depth 0); la review
raggiunge il passo *Finder* ed emette la chiamata al tool `subagent`.

- Se il `subagent` **riesce** → il conteggio è quello degli **antenati del chiamante** (`primary = 0`)
  → basta `1`, e la frase in blocco del contratto è **uno troppo alta** per la review primary.
- Se il `subagent` **fallisce** restituendo esattamente `Subagent depth limit reached (1). Increase
  "experimental.subagent_depth" to allow nested subagents.` sul lancio del finder → il lancio da una
  primary consuma già un livello, e allora `2` sarebbe giustificato **anche** per la review primary.

L'osservabile non è un numero nel contratto, ma la **presenza o assenza di quella stringa d'errore**
all'uscita del tool `subagent` al passo *Finder*, in una sessione `review` primary con
`subagent_depth: 1`. Per fissare la mappa `depth → limit` sul caso annidato — quello che regge il «3»
a quattro livelli — la stessa prova con `subagent_depth: 2` su una `review` sotto `ship-feature`: il
`finder` deve comporre a `2` e fallire a `1`.

---

## 6. Framework di orchestrazione

Candidati alternativi alzati contro la chiave dell'host. Fatti raccolti il **2026-10-15** da repo
GitHub (via `gh`), registry npm/PyPI (via `npm view`, `gh api`, PyPI) e siti di documentazione
ufficiali.

| Framework | Linguaggio | Ultima versione + data | Primitiva di fan-out/delegazione |
|---|---|---|---|
| pydantic-ai | Python `>=3.11` | `v2.56.0` — 2026-10-13 | `SubAgents` (`delegate_task`) con `max_depth` (default `3`) |
| LangGraph | Python `>=3.10` | `langgraph 1.2.15` — 2026-10-12 | `Send`, `StateGraph` (orchestrator-worker) |
| CrewAI | Python `>=3.10,<3.14` | `1.15.28` — 2026-10-14 | `Crew` / `Flow`, process *sequential*/*hierarchical* |
| OpenAI Agents SDK | Python `>=3.10` | `v0.24.0` — 2026-10-15 | agents-as-tools (`Agent.as_tool()`) / handoffs |
| Vercel AI SDK (`ai`) | TypeScript, Node `>=22` | `ai@7.0.141` — 2026-10-15 | nessuna primitiva di primo livello (solo pattern) |
| Mastra | TypeScript, Node `>=22.13.0` | `@mastra/core@1.77.0` — 2026-10-14 | Agents + Workflows (`.then()`/`.parallel()`/`.branch()`) |
| OpenAI Agents SDK for JS | TypeScript, Node 22+ | `@openai/agents@0.20.0` — 2026-10-08 | `Agent`/`handoff`/`AgentTool` |
| LangGraph.js | TypeScript, engine `>=18` (peer `@langchain/core` `>=20`) | `@langchain/langgraph@1.5.0` — 2026-10-12 | `StateGraph` + `Send`/`Command`/subgraph |

### 6.1 Q4 (a) — Framework di orchestrazione in Python

#### pydantic-ai — pydantic/pydantic-ai

- **Lingua e runtime:** Python `>=3.11`. Fonte: `pyproject.toml` (`requires-python = ">=3.11"`, letto
  con `gh api` il 2026-10-15) e PyPI.
- **Install:** `pip install pydantic-ai`; l'esempio "coding agent" del README usa
  `uv add pydantic-ai pydantic-ai-harness`.
- **Ultima versione + data:** `v2.56.0`, **2026-10-13** (`gh release list -R pydantic/pydantic-ai -L 3`;
  PyPI 2.56.0).
- **Feature list verbatim** ("Why Pydantic AI?", README, https://pydantic.dev/docs/ai/):
  > - **Any model, one Python API.** [Virtually every model and provider] (OpenAI, Anthropic, Google,
  >   Bedrock, Azure AI Foundry, Groq, Mistral, xAI, Ollama, and dozens more), swappable with a string,
  >   or through the [Pydantic AI Gateway]: one key for all of them, with failover and cost monitoring
  >   built in. No flagship feature is locked to one vendor.
  > - **Typed end to end.** [Structured outputs], typed [dependency injection], [typed tools]: your IDE,
  >   type checker, and coding agent all know what your agent returns...
  > - **Measured, not vibes.** OpenTelemetry-native [instrumentation] works with any OTel backend...
  > - **Batteries, composably.** One primitive, the [capability], bundles [tools], [instructions],
  >   [hooks], and [model settings] into reusable units...
  > - **[Every interface].** One agent definition runs as a [CLI], a [built-in web chat], or [realtime
  >   speech]...
  > - **Durable execution.** [Durable execution] on nine engines: Temporal, DBOS, Prefect, Restate, AWS
  >   Lambda, Kitaru, Airflow, Absurd, and pgtask...
  > - **Coming from another framework?** The [comparisons] show where Pydantic AI differs from
  >   LangChain, Google ADK, the Claude Agent SDK and seven more...
- **Fan-out e delegazione annidata (primitive dai docs, https://pydantic.dev/docs/ai/harness/subagents/):**
  **sì.** Il capability **`SubAgents`** «takes a sequence of `SubAgent` entries and exposes a single
  `delegate_task(agent_name, task)` tool»; ogni `SubAgent` è «One delegate: a child agent plus its
  per-delegate run controls». Annidamento: i sub-agenti «may contain their own `SubAgents`, forming a
  tree», con **`max_depth`** (default `3`); «Parallel delegations run as independent sub-agent runs».
  (Trattamento completo in §6.3.)
- **Host-agnostico o loop proprio:** richiede a Daiku di **possedere il loop**. pydantic-ai è «a typed,
  extensible agent loop» con `agent.run()`/`to_cli_sync()`, e il capability `Coder()` bundla «files,
  shell, repo context, sub-agents, context management» — un agent loop completo con client di modello
  proprio, non una delega ai subagenti dell'host.

#### LangGraph — langchain-ai/langgraph

- **Lingua e runtime:** Python `>=3.10` (`libs/langgraph/pyproject.toml`).
- **Install:** `pip install -U langgraph`.
- **Ultima versione + data:** pacchetto core **langgraph 1.2.15**, **2026-10-12**; il repo è un
  monorepo a rilasci per-sottopacchetto (`langgraph-prebuilt==1.1.1` 2026-10-15,
  `checkpoint-postgres==3.2.0` 2026-10-14, `cli==0.4.35` 2026-10-14).
- **Feature list verbatim** ("Why use LangGraph?", README, https://docs.langchain.com/oss/python/langgraph/overview):
  > - **[Durable execution]** — Build agents that persist through failures and can run for extended
  >   periods, automatically resuming from exactly where they left off.
  > - **[Human-in-the-loop]** — Seamlessly incorporate human oversight by inspecting and modifying
  >   agent state at any point during execution.
  > - **[Comprehensive memory]** — Create truly stateful agents with both short-term working memory for
  >   ongoing reasoning and long-term persistent memory across sessions.
  > - **[Debugging with LangSmith]** — Gain deep visibility into complex agent behavior with
  >   visualization tools...
  > - **[Production-ready deployment]** — Deploy sophisticated agent systems confidently...
- **Fan-out e delegazione annidata (docs, https://docs.langchain.com/oss/python/langgraph/workflows-agents):**
  **sì.** «Orchestrator-worker workflows are common and LangGraph has built-in support for them». Fan-out
  dinamico con la primitiva **`Send`**: «The `Send` API lets you dynamically create worker nodes and
  send them specific inputs»; «Each worker has its own state». Primitive nominate: `Send`, `StateGraph`,
  `add_node`, `add_edge`, `add_conditional_edges`. «subgraphs» è citato solo nella lista di
  risorse/guide; nessuna parola «subagents» nel core (Deep Agents è il pacchetto di livello superiore
  che offre «planning, subagents, filesystem tools, and context management on top of LangGraph»).
  `[to verify: pattern supervisor/swarm]`
- **Host-agnostico o loop proprio:** richiede a Daiku di **possedere il loop**. LangGraph è «a low-level
  orchestration framework and runtime», «very low-level, and focused entirely on agent orchestration»,
  che «does not abstract prompts or architecture».

#### CrewAI — crewAIInc/crewAI

- **Lingua e runtime:** Python `>=3.10,<3.14` («CrewAI requires `Python >=3.10 and <3.14`»).
- **Install:** `uv tool install crewai`.
- **Ultima versione + data:** `1.15.28`, **2026-10-14** (PyPI 1.15.28; un dev build
  `1.15.28.dev20261015` seguito il 15).
- **Feature list verbatim** ("Key Features", README, https://docs.crewai.com):
  > - **Crews for autonomy**: Model teams of specialized AI agents with roles, goals, tools, and tasks.
  > - **Flows for control**: Build event-driven workflows with state, branching, routing, and
  >   production logic.
  > - **Seamless integration**: Combine Crews and Flows to create complex, real-world automations.
  > - **Python-native customization**: Customize prompts, tools, execution paths, state, and
  >   integrations without fighting the framework.
  > - **Agent-ready capabilities**: Use tools, memory, knowledge, checkpointing, async execution, and
  >   MCP/A2A support for more capable production agents.
  > - **Production-ready patterns**: Add deterministic steps, human input, structured outputs, and
  >   checkpointing as your system grows.
  > - **Thriving community**: Backed by robust documentation and over 100,000 certified developers...
- **Fan-out e delegazione annidata (docs, https://docs.crewai.com/en/concepts/processes):** **sì,
  "process" a due valori.** *Sequential* — «Executes tasks sequentially, ensuring tasks are completed in
  an orderly progression.» *Hierarchical* — «Organizes tasks in a managerial hierarchy», dove «Tasks are
  not pre-assigned; the manager allocates tasks to agents based on their capabilities». Primitive:
  `Crew` e `Flow`.
- **Host-agnostico o loop proprio:** richiede a Daiku di **possedere il loop**. CrewAI è «an open-source
  Python framework ... for building production-ready multi-agent workflows» che esegue i propri
  agenti/managers.

#### OpenAI Agents SDK — openai/openai-agents-python

- **Lingua e runtime:** Python `>=3.10`.
- **Install:** `pip install openai-agents`.
- **Ultima versione + data:** `v0.24.0`, **2026-10-15** (PyPI 0.24.0).
- **Feature list verbatim** ("Core concepts:", README, https://openai.github.io/openai-agents-python/):
  > 1. [**Agents**]: LLMs configured with instructions, tools, guardrails, and handoffs
  > 1. [**Sandbox agents**]: Agents preconfigured to work with a container to perform work over long
  >    time horizons.
  > 1. [**Realtime agents**]: Build powerful voice agents with `gpt-realtime-2.1` and full agent features
  > 1. [**Voice agents**]: Build voice pipelines that combine speech-to-text, an agent workflow, and
  >    text-to-speech
  > 1. **[Agents as tools] / [Handoffs]**: Delegating to other agents for specific tasks
  > 1. [**Tools**]: Various Tools let agents take actions (functions, MCP, hosted tools)
  > 1. [**Guardrails**]: Configurable safety checks for input and output validation
  > 1. [**Human in the loop**]: Built-in mechanisms for involving humans across agent runs
  > 1. [**Sessions**]: Automatic conversation history management across agent runs
  > 1. [**Tracing**]: Built-in tracking of agent runs, allowing you to view, debug and optimize your
  >    workflows
- **Fan-out e delegazione annidata (docs, https://openai.github.io/openai-agents-python/multi_agent/):**
  **sì.** Due primitive: **agents as tools** — «A manager agent keeps control of the conversation and
  calls specialist agents through `Agent.as_tool()`» — e **handoffs** — «A triage agent routes the
  conversation to a specialist». Si combinano.
- **Host-agnostico o loop proprio:** richiede a Daiku di **possedere il loop**. L'SDK esegue i propri
  agenti via `Runner.run`/`Runner.run_sync`.

#### Costo rispetto a STACK.md §1–§3

I vincoli di `STACK.md` §1–§3 sono citati per intero in §1.2.

Adottare uno di questi framework costa **tutte e tre le clausole**:

- **§1 (linguaggio):** i quattro candidati sono **Python** — pydantic-ai `>=3.11`, LangGraph `>=3.10`,
  CrewAI `>=3.10,<3.14`, OpenAI Agents SDK `>=3.10`. Daiku è JavaScript `.mjs`: adottarne uno significa
  introdurre un secondo linguaggio e un secondo runtime (un interprete CPython) accanto a Node 18.
- **§2 (dipendenze):** ognuno porta un albero di dipendenze Python.
- **§3 (build):** introduce un passaggio di risoluzione/installazione dell'ambiente, che il pacchetto
  oggi non ha.

**Un framework Python può essere un candidato, data §1? No.** §1 fissa il linguaggio a JavaScript in
moduli ES: un candidato Python viola la clausola in radice, prima ancora di §2 e §3.

C'è poi un secondo costo, non di linguaggio ma di **architettura**. Tutti e quattro possiedono il
proprio agent loop e le proprie primitive di orchestrazione (graph + `Send`, `Crew`/`Flow`,
`Handoff`/`as_tool`, `SubAgents`): adottarne uno obbligherebbe Daiku a **eseguire il loop da sé** invece
di delegarlo ai subagenti dell'host. Non esiste, in questi quattro, una primitiva che deleghi
l'orchestrazione *all'host*.

Nota di merito se il vincolo di linguaggio cadesse: **pydantic-ai** è l'unico dei quattro i cui docs
nominano un tetto di profondità esplicito — **`max_depth`** (default `3`) con i sub-agenti che «form a
tree» — cioè il medesimo concetto di `subagent_depth`. Gli altri tre offrono fan-out (`Send`,
manager/hierarchical, orchestrazione one-off) ma senza un equivalente dichiarato di profondità.

### 6.2 Q4 (b) — Framework di orchestrazione in JavaScript/TypeScript

#### Vercel AI SDK (`ai`, vercel/ai)

- **Linguaggio e runtime**: TypeScript. README: «You will need Node.js 22+ and npm». `npm view ai
  engines` → `{ node: '>=22' }`.
- **Formato modulo**: `type: "module"`; `exports` espone solo `import`/`default` → **ESM-only**.
- **Install**: `npm install ai` (+ provider separati, es. `@ai-sdk/openai`).
- **Versione più recente + data**: `ai@7.0.141`, **2026-10-15T02:22:36Z** (npm).
- **Peso delle dipendenze**: nessun build/transpile richiesto (spedisce `dist`). Runtime:
  `@ai-sdk/gateway`, `@ai-sdk/provider`, `@ai-sdk/provider-utils`; peerDependency `zod`.
- **Feature list verbatim** (https://ai-sdk.dev/docs/introduction):
  > - **AI SDK Core:** A unified API for generating text, structured objects, tool calls, and building
  >   agents with LLMs.
  > - **AI SDK UI:** A set of framework-agnostic hooks for quickly building chat and generative user
  >   interfaces.
  > - **AI SDK Harnesses:** A uniform API for running established agent harnesses with `HarnessAgent`.
- **Primitive per fan-out e delegazione annidata**: **nessuna primitiva di handoff/subagent di primo
  livello**. Le primitive sono `ToolLoopAgent`, `HarnessAgent`, l'helper `tool`, i controlli `stopWhen`
  e `prepareStep`. L'orchestrazione è presentata come **pattern**, non come primitiva
  (https://ai-sdk.dev/docs/agents/workflows): «Orchestrator-Worker — A primary model (or orchestrator)
  coordinates the execution of specialized workers»; il parallelismo è mostrato solo con `Promise.all`.

#### Mastra (mastra-ai/mastra)

- **Linguaggio e runtime**: TypeScript. `npm view @mastra/core engines` → `{ node: '>=22.13.0' }`.
- **Formato modulo**: `type: "module"`; docs raccomandano `{ "type": "module" }` e tsconfig
  `"module": "ES2022"`.
- **Install**: scaffold `npm create mastra@latest`.
- **Versione più recente + data**: `@mastra/core@1.77.0`, **2026-10-14T05:31:29Z** (npm); CLI `mastra@1.34.1`.
- **Peso delle dipendenze**: albero molto grande (`hono`, `ws`, `posthog-node`, `execa`, `p-retry`,
  `re2js`, tre copie di provider AI SDK, …); nessun build del consumatore ma il flusso docs presuppone
  TS + bundler.
- **Feature list verbatim** (README, "Some highlights include:"):
  > - **Model routing**: Connect to 40+ providers through one standard interface. …
  > - **Agents**: Build autonomous agents that use LLMs and tools to solve open-ended tasks. …
  > - **Workflows**: When you need explicit control over execution, use Mastra's graph-based workflow
  >   engine to orchestrate complex multi-step processes. Mastra workflows use an intuitive syntax for
  >   control flow (`.then()`, `.branch()`, `.parallel()`).
  > - **Human-in-the-loop**: Suspend an agent or workflow and await user input or approval before
  >   resuming. …
  > - **Context management**: Give your agents the right context at the right time. …
  > - **Integrations**: …
  > - **MCP servers**: …
  > - **Production essentials**: … built-in evals and observability …
- **Primitive per fan-out e delegazione annidata**: **Agents** (`new Agent(...)`, da `@mastra/core/agent`)
  e **Workflows** (motore graph-based): `.then()`, `.parallel()`, `.branch()`, `.dountil()`, `.dowhile()`,
  `.foreach()`, oltre a «Subagents» e «Workflow State».

#### OpenAI Agents SDK for JS (`@openai/agents`, openai/openai-agents-js)

- **Linguaggio e runtime**: TypeScript. README: «Node.js 22 or later», «Deno», «Bun».
- **Formato modulo**: **duale ESM+CJS**.
- **Install**: `npm install @openai/agents zod`.
- **Versione più recente + data**: `@openai/agents@0.20.0`, **2026-10-08T23:04:37Z** (npm).
- **Peso delle dipendenze**: nessun build (spedisce `dist/`); dipendenze `openai ^7.2.0` (esso stesso
  `engines { node: '>=22.0.0' }`), `@openai/agents-core`, `-openai`, `-realtime`; peer `zod`.
- **Feature list verbatim** (README, "Core concepts"):
  > 1. [**Agents**]: LLMs configured with instructions, tools, guardrails, and handoffs
  > 1. [**Sandbox Agents**]: Agents paired with a filesystem workspace and sandbox environment for
  >    longer-running work
  > 1. [**Realtime Agents**]: Low-latency agents for spoken interactions, with tools, guardrails,
  >    handoffs, and conversation history
  > 1. **[Agents as tools] / [Handoffs]**: Delegating to other agents for specific tasks
  > 1. [**Tools**]: Various Tools let agents take actions (functions, MCP, hosted tools)
  > 1. [**Guardrails**]: Configurable safety checks for input and output validation
  > 1. [**Human in the loop**]: Built-in mechanisms for involving humans across agent runs
  > 1. [**Sessions**]: Automatic conversation history management across agent runs
  > 1. [**Tracing**]: Built-in tracking of agent runs, allowing you to view, debug and optimize your
  >    workflows
- **Primitive per fan-out e delegazione annidata**: `Agent`, il runner `run`/`Runner`, `handoff`/`Handoff`,
  **agents-as-tools** (`AgentTool`), `SandboxAgent`, guardrails, `Session`/`MemorySession`, tracing.

#### LangGraph.js (`@langchain/langgraph`, langchain-ai/langgraphjs)

- **Linguaggio e runtime**: TypeScript. `npm view @langchain/langgraph engines` → `{ node: '>=18' }`; la
  peer obbligatoria `@langchain/core` dichiara `engines { node: '>=20' }`.
- **Formato modulo**: `type: "module"` ma **duale** (`import` → `./dist/index.js`, `require` →
  `./dist/index.cjs`).
- **Install**: `npm install @langchain/langgraph @langchain/core`.
- **Versione più recente + data**: `@langchain/langgraph@1.5.0`, **2026-10-12T23:19:38Z** (npm).
- **Peso delle dipendenze**: nessun build; dipendenze `@langchain/protocol`, `@standard-schema/spec`,
  `@langchain/langgraph-sdk`, `@langchain/langgraph-checkpoint`; **peer obbligatorie** `@langchain/core`
  e `zod` (e la catena di `@langchain/core`: langsmith, js-tiktoken, mustache, …).
- **Feature list verbatim** (README, "Why use LangGraph?"):
  > - **[Durable execution]** — Build agents that persist through failures and can run for extended
  >   periods, automatically resuming from exactly where they left off.
  > - **[Human-in-the-loop]** — Seamlessly incorporate human oversight by inspecting and modifying agent
  >   state at any point during execution.
  > - **[Comprehensive memory]** — Create truly stateful agents with both short-term working memory for
  >   ongoing reasoning and long-term persistent memory across sessions.
  > - **[Debugging with LangSmith]** — Gain deep visibility into complex agent behavior with
  >   visualization tools …
  > - **[Production-ready deployment]** — Deploy sophisticated agent systems confidently …
- **Primitive per fan-out e delegazione annidata**: grafo a basso livello — `StateGraph`, `.addNode()`,
  `.addEdge()`, `START`/`END`, e **subgraph**. Architetture multi-agente documentate: **Network**,
  **Supervisor**, **Hierarchical**, **Custom multi-agent workflow**. Handoff via
  `Command({ goto, update, graph })` con `Command.PARENT`; **`Send`** per il fan-out parallelo
  (map-reduce). Pacchetti prebuilt: `@langchain/langgraph-supervisor` (`createSupervisor`) e
  `@langchain/langgraph-swarm` (`createSwarm`, `createHandoffTool`).

#### Costo rispetto a STACK.md §1–§3

| Candidato | Node richiesto | Passo di build | Albero di dipendenze | ESM |
|---|---|---|---|---|
| `ai` (Vercel) | **>=22** (engine) | no (spedisce `dist`) | sì: 3 dip. runtime + `zod` peer | ESM-only |
| `@mastra/core` / `mastra` | **>=22.13.0** | no (spedisce `dist`), ma flusso docs TS+bundler | sì: **albero molto grande** | ESM |
| `@openai/agents` | **Node 22+** (`openai` sub-dep `>=22.0.0`) | no (spedisce `dist`) | sì: `openai` + 3 `@openai/agents-*` + `zod` | duale ESM+CJS |
| `@langchain/langgraph` | engine **>=18** ma `@langchain/core` peer richiede **>=20** | no (spedisce `dist`) | sì: 4 dip. + **peer obbligatorie** `@langchain/core` e `zod` | duale ESM+CJS |

**Verdetto per candidato.**

- **Vercel AI SDK (`ai`)**: **incompatibile su due assi**. Richiede Node `>=22` (STACK dice `>=18`);
  trascina dipendenze in un pacchetto a zero dipendenze. E non offre una primitiva di handoff/subagent:
  non sostituirebbe `experimental.subagent_depth` con qualcosa di equivalente.
- **Mastra**: **il costo più alto dei quattro**. Node `>=22.13.0`, albero di dipendenze enorme, flusso
  docs che presuppone TypeScript e un bundler.
- **OpenAI Agents SDK for JS (`@openai/agents`)**: **incompatibile su Node e dipendenze**. Node 22+;
  trascina `openai` + tre `@openai/agents-*` + `zod`. Possiede le primitive di delegazione più vicine a
  ciò che Daiku delega (handoff, agents-as-tools, Agent/Runner).
- **LangGraph.js (`@langchain/langgraph`)**: **il meno costoso sui Node e sui formati**, ma **viola
  comunque "no external dependencies"**. L'engine dichiarato è `>=18` — ma la peer obbligatoria
  `@langchain/core` chiede `>=20`, quindi in pratica porta il floor a **Node >=20**, sopra il `>=18` di
  STACK. Offre le primitive di fan-out/delegazione più ricche (StateGraph + subgraph, `Command`, `Send`,
  supervisor, swarm) — è l'unico dei quattro con un vero modello di annidamento di primo livello.

**In sintesi**: nessuno dei quattro è adottabile «in place of» `experimental.subagent_depth` senza
rompere STACK.md §1–§3. Tutti trascinano un albero di dipendenze in un pacchetto che oggi non ne
dichiara nessuna; nessuno richiede un build step *del consumatore*, ma Vercel, Mastra e OpenAI alzano
il floor di Node a 22, e solo LangGraph dichiara `>=18` (con la peer `@langchain/core` che lo porta
comunque a `>=20`).

`[to verify]` — per Mastra e LangGraph.js le pagine di docs ufficiali **non dichiarano** la versione
minima di Node: il dato viene dal campo `engines` del registry npm. Per `@openai/agents` non esiste un
campo `engines`: il dato «Node 22 or later» è dal README.

### 6.3 Q4 (a-bis) — pydantic-ai: trattamento completo

> **Versione letta:** `2.56.0`, rilasciata **2026-10-13** (`gh release list -R pydantic/pydantic-ai -L 5`
> → `v2.56.0 ... 2026-10-13T23:35:15Z`; `gh api repos/pydantic/pydantic-ai/tags --jq '.[0:5][].name'`
> → `v2.56.0` in testa; confermato su PyPI, `release date: Oct 13, 2026`). **Raccolta:** 2026-10-15, dal
> sito ufficiale (migrato da `ai.pydantic.dev` a `pydantic.dev/docs/ai/`, 301) e da PyPI/`gh`.

#### 1. Che cosa è, esattamente — lingua, runtime, cosa possiede

**Lingua e runtime: Python.** PyPI dichiara `Requires-Python: >=3.11`; la pagina di install: «(Requires
Python 3.11+)». Il summary PyPI è «AI Agent Framework, the Pydantic way».

**Che cos'è, verbatim (overview, https://pydantic.dev/docs/ai/overview/):**

> **Pydantic AI** is the Python AI SDK: a typed, extensible agent loop with every model a string swap
> away.

**Cosa possiede: il proprio agent loop.** La stessa frase lo dice — «a typed, extensible **agent
loop**» — e l'overview aggiunge, sui sub-agenti:

> Pydantic AI Harness has everything an agent needs for complex, long-running work, snapped on as
> capabilities, from memory, guardrails, and **sub-agents** to planning, context management, and
> persistence, up to a complete coding agent.

Il loop è proprio e si avvia da sé: `run()`, `run_sync()`, `to_cli_sync()`. **Non costruisce sopra un
altro SDK di agenti**: costruisce sopra **Pydantic Validation** più gli SDK dei provider. Verbatim:

> Built by the [Pydantic] team: [Pydantic Validation] is the validation layer of the OpenAI SDK, the
> Anthropic SDK, the Google ADK, LangChain, and most of the AI ecosystem.

**Modello di dipendenze.** Install verbatim (https://pydantic.dev/docs/ai/overview/install/):

> This installs the `pydantic_ai` package, core dependencies, and libraries required to use the
> OpenAI, Anthropic, and Google models, plus the CLI, MCP, Evals, Web UI, and Logfire integrations.

Dai metadati PyPI (`requires_dist`): `pydantic-ai==2.56.0` dipende da
`pydantic-ai-slim[anthropic,cli,evals,google,logfire,mcp,openai,web]==2.56.0`. Il nucleo
`pydantic-ai-slim` dichiara (dipendenze senza extra): `anyio>=4.7.0`, `genai-prices>=0.1.10`,
`griffelib>=2.0`, `httpx2>=2.7`, `opentelemetry-api>=1.28.0`, `pydantic-graph==2.56.0`,
`pydantic>=2.12`, `typing-inspection>=0.4.0`. Gli SDK dei provider arrivano come extra, e **l'install
base li tira dentro tutti e tre**: `openai>=3.26.0` (+ `tiktoken>=0.12.0`), `anthropic>=1.12.1`,
`google-genai>=2.30.0`.

Possiede il loop (non è un wrapper attorno a un loop altrui), ma la comunicazione col modello passa
dagli SDK dei venditori. Il sotto-pacchetto **Pydantic AI Harness** (`pydantic-ai-harness`, separato:
«While Pydantic AI Harness is on **0.x** releases, the API may change between minor releases») è dove
vivono i sub-agenti della domanda 2.

#### 2. Il suo modello di delegazione — subagenti, annidamento, tetto di profondità

**Sì, ha subagenti e annidamento, in due livelli distinti che vanno tenuti separati.**

**Livello A — il core `pydantic-ai`: "agent delegation" a mano.** Il pattern è un agente dentro un tool
di un altro agente. Il nome `delegate_task` è del livello B, non del core. Verbatim
(https://pydantic.dev/docs/ai/guides/multi-agent-applications/, § *Agent delegation*):

> "Agent delegation" refers to the scenario where an agent delegates work to another agent, then takes
> back control when the delegate agent (the agent called from within a tool) finishes.

Esempio ufficiale **verbatim** (stesso URL; è l'«agent-in-tool»):

```python
from pydantic_ai import Agent, RunContext, UsageLimits

joke_selection_agent = Agent(  # (1)
    'openai:gpt-5.2',
    name='joke_selection_agent',  # (2)
    instructions=(
        'Use the `joke_factory` to generate some jokes, then choose the best. '
        'You must return just a single joke.'
    ),
)
joke_generation_agent = Agent(  # (3)
    'google:gemini-3-flash-preview', name='joke_generation_agent', output_type=list[str]
)


@joke_selection_agent.tool
async def joke_factory(ctx: RunContext, count: int) -> list[str]:
    r = await joke_generation_agent.run(  # (4)
        f'Please generate {count} jokes.',
        usage=ctx.usage,  # (5)
    )
    return r.output  # (6)


result = joke_selection_agent.run_sync(
    'Tell me a joke.',
    usage_limits=UsageLimits(request_limit=5, total_tokens_limit=500),
)
print(result.output)
#> Did you hear about the toothpaste scandal? They called it Colgate.
print(result.usage)
"""
RunUsage(
    cost=Decimal('0.00051200'),
    input_tokens=165,
    output_tokens=24,
    requests=3,
    tool_calls=1,
)
"""
```

Nota vincolante, verbatim: «Delegate from an `async def` function, not a sync one … `run_sync()` and
`run_stream_sync()` cannot be used inside a tool … and raise `UserError` there.»

**Su questo livello A non c'è NESSUN tetto di profondità.** La delegazione è `await sub_agent.run(...)`
dentro un tool: è una chiamata di funzione Python, e ricorsione e profondità le decide il codice
Python, non il framework. L'unico freno documentato è il budget di richieste/token:

> You can use [`UsageLimits`] -- including `cost_limit`, `request_limit`, `total_tokens_limit`, and
> `tool_calls_limit` -- to avoid unexpected costs or runaway tool loops.

**Livello B — il Harness `SubAgents`: UN tool dedicato E un tetto di profondità.** Verbatim
(https://pydantic.dev/docs/ai/harness/subagents/):

> `SubAgents` lets an agent delegate self-contained tasks to named child agents. It takes a sequence of
> `SubAgent` entries and exposes a single `delegate_task(agent_name, task)` tool. Each delegation runs
> the chosen sub-agent in its own run -- with its own message history, so it never sees the parent
> conversation -- and returns its output to the parent.

Esempio ufficiale verbatim (stesso URL):

```python
from pydantic_ai import Agent
from pydantic_ai_harness import SubAgent, SubAgents

researcher = Agent('anthropic:claude-opus-5-5', name='researcher', description='Researches a topic and reports findings')
writer = Agent('anthropic:claude-opus-5-5', name='writer', description='Turns notes into polished prose')

orchestrator = Agent(
    'anthropic:claude-opus-5-5',
    capabilities=[SubAgents(agents=[SubAgent(researcher), SubAgent(writer)])],
)

result = orchestrator.run_sync('Research the history of TLS and write a one-paragraph summary.')
print(result.output)
```

**Il tetto di profondità esiste, ed è `max_depth` (default `3`, conta il run di vertice).** Verbatim:

> **Delegation depth is capped.** The delegate carries `delegate_task` too, so `max_depth` (default
> `3`, counting the top-level run) bounds the tree: the top-level run delegates, its delegates
> delegate once more, and a run at the limit gets neither `delegate_task` nor the sub-agent listing.
> The limit applies to every delegation through `SubAgents`, including explicit rosters.

Firma verbatim: `max_depth=3,           # delegation levels, counting the top-level run`. E la nota
sulle sezioni annidate:

> Sub-agents can themselves have `SubAgents`, forming a tree. Each `SubAgents` stops offering
> delegation once the run is at its own `max_depth`, so a delegate with a higher limit can go deeper
> than its parent's. Share `usage` (the default) and set a `usage_limits` on the top-level run to
> bound the whole tree.

**Cosa succede quando un delegato vuole delegare a sua volta.** Al livello B, il delegato riceve anche
lui `delegate_task` (stessa capability), e la catena si ferma quando un run ha raggiunto il proprio
`max_depth`: a quel livello spariscono sia il tool sia la lista dei delegati. Al livello A non c'è
nessun meccanismo: il codice Python può annidare quanto vuole.

**Fan-out: nessun limite di ampiezza.** Verbatim: «Delegations the model issues in parallel run as
independent sub-agent runs.» I controlli per-delegato sono **budget**, non un tetto di profondità:
`usage_limits`, `timeout_seconds` («A wall-clock budget for one delegation»), `max_calls` («The maximum
number of delegations to this sub-agent per parent run»).

**In sintesi:** nel core `pydantic-ai` **non esiste alcun tetto di profondità né di fan-out**;
l'annidamento lo governa il codice Python del chiamante. Il **Harness `SubAgents`** aggiunge **un**
tetto di profondità, `max_depth`, default **3**, e **nessun** tetto di fan-out.

#### 3. Daiku potrebbe adottarlo — il costo rispetto a `STACK.md` §1–§3

I vincoli di `STACK.md` §1–§3 sono citati per intero in §1.2.

**Risposta secca: pydantic-ai NON è utilizzabile da quel pacchetto, in nessuna forma.** Non c'è un
percorso per importare una libreria Python `>=3.11` da un file `.mjs` su Node 18. Non è una questione
di "quanto costa": il pacchetto è JavaScript e pydantic-ai è Python, quindi **l'adozione non è
un'importazione, è un secondo programma**. Daiku dovrebbe **scrivere la propria orchestrazione in
Python dentro un processo separato**, avviato accanto all'host — e a quel punto pydantic-ai possiede il
loop (è «a typed, extensible agent loop»), cioè farebbe il mestiere che oggi fa l'host. Urta anche
`ARCHITECTURE.md` §3 (l'orchestrazione appartiene all'agente, non a un framework che esegue il loop al
posto suo).

**Il costo, nominato per esteso — sono tre canali nuovi, non uno:**

1. **Un secondo runtime.** Un interprete CPython `>=3.11` accanto a Node 18, su **ogni** macchina.
2. **Un secondo canale di distribuzione.** pydantic-ai vive su **PyPI**; Daiku si distribuisce via
   **marketplace di Claude Code**. Servirebbe un pacchetto PyPI da pubblicare, versionare e mantenere.
3. **Un secondo percorso di installazione su ogni host.** Un venv/`pip install pydantic-ai` (con
   l'albero di dipendenze Python) da creare, aggiornare e diagnosticare — esattamente l'«albero di
   dipendenze» che §2 esiste per evitare.

Nessuno dei tre è aggirabile: sono i tre pilastri che §1, §2 e §3 dichiarano.

#### 4. La domanda che porta il peso — toglierebbe la dipendenza da `opencode.experimental.subagent_depth`?

**Risposta: no, non la toglie. pydantic-ai è un framework Python in-process; la sua "delegazione" resta
dentro UN processo e non ha nulla a che vedere con l'annidamento di sessioni dell'host.**

Il tetto di opencode conta **sessioni figlie** annidate: risale la catena `parentID` e conta gli
antenati (`packages/core/src/tool/plugin/subagent.ts`: `while (current.parentID) { depth++ ... }`,
`limit = … "experimental"?.subagent_depth ?? 1`; sorgente in §3.3). È un tetto sulle **sessioni host
annidate**.

La "delegazione" di pydantic-ai **non crea sessioni host**: è `await sub_agent.run(...)` — una chiamata
di funzione nello stesso processo Python (livello A), oppure `delegate_task`, che «runs the chosen
sub-agent in its own **run** -- with its own message history» (livello B, `run` interno, non
`session` dell'host). Non tocca mai `parentID`, quindi non compare in nessuna catena che opencode possa
contare. **Le due cose stanno su piani diversi.**

Due esiti, entrambi da dire:

- **Se pydantic-ai stesse *sopra* l'host** (il codice di Daiku usasse comunque il tool `subagent` di
  opencode per lanciare i figli, e pydantic-ai solo per "pensare"), **il tetto dell'host si applica
  identico**: contano le sessioni, non chi le ha decise. Non c'è nessuna integrazione documentata
  pydantic-ai ↔ opencode/Claude Code che lo aggiri — `[to verify]`.
- **Se pydantic-ai *sostituisse* l'host** (Daiku gira il proprio loop Python in un processo separato),
  il tetto di opencode diventa irrilevante — **ma solo perché Daiku avrebbe smesso di esistere come
  plugin dell'host**: non ci sarebbero più sessioni host annidate da contare. Non è "togliere un limite
  stando dentro l'host": è "cambiare prodotto e uscire dall'host".

Terzo fatto, la stessa trappola sotto un altro nome: **anche pydantic-ai porta un proprio tetto di
profondità.** Al livello Harness è `max_depth`, default `3`. Non si passa da un mondo "senza tetti" a
uno "con tetti": si passerebbe dal tetto **dell'host** (una chiave di sessione) al tetto **del
framework** (una `kwarg` di un suo programma Python). Si sposta il tetto, non lo si abolisce — pagando i
tre costi della domanda 3.

**`[to verify]`** — la doc ufficiale di pydantic-ai, alla data di raccolta (2026-10-15), **non nomina**
né opencode né `subagent_depth` né l'annidamento di sessioni di un host. Tutto ciò che si può
affermare con prove è strutturale: il framework è in-process, la sua delega è una chiamata Python,
quindi è **ortogonale** all'annidamento di sessioni dell'host — non un modo di governarlo né di
alzarlo.

#### 5. Il verdetto onesto

pydantic-ai **non risolve il problema di Daiku** — non la dipendenza da
`opencode.experimental.subagent_depth`, e nemmeno un pezzo di essa — perché il problema di Daiku vive
nel **livello host** (quante sessioni annidate un host concede), mentre pydantic-ai vive in un
**livello diverso e ortogonale** (un loop Python in un processo). Non è "stare sopra l'host e alzare il
tetto": per toccare quel tetto bisogna o alzare la chiave dell'host (la via che il metodo già discute)
o **smettere di essere un plugin dell'host**; pydantic-ai copre la seconda solo al prezzo di riscrivere
Daiku in Python — un secondo runtime, un secondo canale PyPI e un secondo install su ogni host, cioè
violando §1, §2 e §3 in radice — e portandosi comunque dietro il proprio `max_depth` (default 3). A
tutto questo si aggiunge che Daiku oggi **non orchestra nulla da sé** (il loop lo esegue l'host):
adottarlo significherebbe far eseguire il loop a un secondo motore, che non è la dipendenza da
rimuovere ma un cambio di architettura.

**Per che cosa sarebbe invece buono:** pydantic-ai è un ottimo framework **per chi costruisce un agente
nuovo in Python** — typed end to end, un loop proprio, capability componibili (`Coder()` che bundle
«files, shell, repo context, sub-agents, context management»), `SubAgents` con `max_depth`/budget
per-delegato, durable execution su nove motori, OTel nativo. È la scelta giusta per un prodotto che
possiede il proprio loop in Python e vuole, al suo interno, un albero di sub-agenti con un tetto di
profondità dichiarato. Non è la scelta per un pacchetto `.mjs` che si appoggia al loop di un host.

**Fonti pydantic-ai (URL e data).**

- `gh release list -R pydantic/pydantic-ai -L 5` → `v2.56.0 (2026-10-13) Latest` (letto 2026-10-15);
  `gh api repos/pydantic/pydantic-ai/tags` → `v2.56.0 v2.55.0 v2.54.0 v2.53.0 v2.52.0`.
- PyPI: https://pypi.org/project/pydantic-ai/ e `https://pypi.org/pypi/pydantic-ai/json` — versione
  `2.56.0`, `Requires-Python: >=3.11`, `release date: Oct 13, 2026`, summary «AI Agent Framework, the
  Pydantic way», `requires_dist: pydantic-ai-slim[anthropic,cli,evals,google,logfire,mcp,openai,web]==2.56.0`.
- PyPI `pydantic-ai-slim` (metadati) — dipendenze core `anyio, genai-prices, griffelib, httpx2,
  opentelemetry-api, pydantic-graph, pydantic, typing-inspection`; extra `openai>=3.26.0`,
  `anthropic>=1.12.1`, `google-genai>=2.30.0`.
- Overview: `https://pydantic.dev/docs/ai/overview/`.
- Install: `https://pydantic.dev/docs/ai/overview/install/`.
- Multi-agent: `https://pydantic.dev/docs/ai/guides/multi-agent-applications/`.
- Subagents (Harness): `https://pydantic.dev/docs/ai/harness/subagents/`.
- Indice doc: `https://pydantic.dev/docs/ai/llms.txt`.

---

## 7. Q5 — Alternative che non chiedono né framework né un cambio di metodo

### Premessa: dove il ciclo tocca davvero la profondità

Da `plugins/daiku/skills/review/SKILL.md`:

- **Il fan-out è uno solo, ed è il round 1.** «One subagent per active discipline of the round» (§
  *Finder*): `bug` sempre, `arch` se lo scope lo attiva, più il passo `form` (`perf`+`dead`). Dai round
  ≥2 gira **solo** `bug`, sul solo delta `pre_apply_tree → post_apply_tree`: nessun fan-out.
- **I finder possono girare in sequenza.** § *Finder*: «Launch them in the **same** tool-call block to
  truly run them in parallel — in sequence only on backends `contracts/orchestration.md` §5
  sequentialises.»
- Ogni round lancia comunque almeno un figlio (il finder). Applier, coverage e gate sono un singolo
  subagent ciascuno. Il **commit** è un worker che a sua volta **delega `update-memory`**. Quindi il
  tetto morde due volte dentro `review`: sul primo figlio qualunque quando `review` è essa stessa un
  figlio, e di nuovo su `commit → update-memory`. Una `review` **primaria** tocca invece un solo livello.

### A — Fan-out sequenziale (una delega alla volta)

**Cambia la profondità di annidamento? No.** La profondità è una proprietà dell'albero delle sessioni
(chi lancia chi), non di quante deleghe stanno nello stesso blocco di tool-call. I finder di `review`
sono figli di `review` sia lanciati in parallelo sia uno per volta: la sequenza non li sposta di un
livello, quindi **non alza né abbassa il tetto**. Il contratto lo dice nel posto giusto: §5 tratta la
sequenza come vincolo di **concorrenza**, non di profondità.

**Cosa resta intatto.** Ordine, perimetro, formato e — la parte che conta — l'**indipendenza**:

> it degrades first to **sequential subagents**, which is already the normal case on backends with
> `{backends.<backend>.sequential_fanout}` (§5) and in which mutual blindness stays intact because
> each context is still fresh.

**Cosa si perde.** Il parallelismo — il round 1 con due finder dura il doppio — e la proprietà
«lanciati nello stesso blocco per girare *davvero* insieme». Nulla che tocchi il tetto.

**Framework? No. Cambio di metodo? No** (è già scritto, §5). **Fitness per il tetto: nulla** — non
compone un caso che il tetto blocca.

### B — Degradazione dichiarata a inline con `independence: "lost"`

La via che il contratto già dichiara come **ultimo** gradino:

> **Degradation has two rungs, not one.** A step whose yield depends on the children's
> **independence** — the finders of a `/review` round — does not degrade to *inline*: it degrades
> first to **sequential subagents** […] Only if even that is impossible do you run inline.

> And then **you declare it in the return block** (`"independence": "lost"`, or among the
> `limitations` if the block has them), because order, perimeter and format survive degradation but
> blindness does not: three disciplines evaluated in the same context *are* the single pass already
> convinced of itself that fan-out exists to avoid.

**Cosa costa / cosa perde.** Compone **ovunque**, a qualunque tetto (nessuna delega), ma butta via
l'unica cosa che il fan-out esiste per avere: l'indipendenza dei finder. Il campo `independence`
esiste **solo** in `review-outcome` (`schemas/blocks.json`): le altre tre catene che chiedono
profondità 2 degradano **in silenzio**.

**Framework? No. Cambio di metodo? No** (già dichiarato in §4 e nel blocco d'esito). **Costo: il
rendimento della review.**

### C — Lanciare `review` (o ogni passo) come agente PRIMARIO, così i figli stanno a profondità 0

Le catene che **si possono re-radicare senza cambio di metodo** sono quelle il cui nodo che delega
**è già un punto d'ingresso** (§3 del contratto): l'owner le lancia a mano, quindi girano nella
sessione **primaria** a profondità 0, e i loro figli stanno a profondità 1 — **dentro il default 1**.

| Catena (arco) | Nodo re-radicabile? | Compone a default 1? |
|---|---|---|
| `review → finder` | **sì** — entry point | **sì**: primario 0 → finder 1 |
| `code-review → bug/applier/gate` | **sì** — entry point | **sì** |
| `research → study` (+ fan-out dei blocchi) | **sì** — entry point | **sì** |
| `commit → update-memory` | **sì** — entry point | **sì** |
| `new-feature → decision-doc` | **sì** — `new-feature` è entry point | **sì** |
| `new-feature → research → study` | parziale | **no**: `research` è figlio a 1, i suoi figli a 2 |
| `new-feature → ship-feature → review → finder` | **no** | **no** |

**Ciò che non si re-radica: la consegna.** `ship-feature` **non è un punto d'ingresso**: il contratto
lo dichiara interno — «it is opened by `new-feature` § *Delivery*, never on its own». Di conseguenza la
catena a quattro livelli resta annidata per costruzione: `new-feature` (0) → `ship-feature` (1) →
`review` (2) → `finder` (3), e il lancio del finder parte da una sessione a profondità 2 → serve
**almeno 3**.

**Framework? No. Cambio di metodo? No.** È la sola via che **compone davvero** (l'arco
`review → finder` a mano) senza perdere niente — ma non copre la consegna in-chain, dove `review` è un
figlio.

### D — Le altre vie che il contratto stesso già offre

- **`{backends.<backend>.sequential_fanout}`** (§5, §7): la seconda sede del gradino sequenziale,
  dichiarata sul backend. Come A: tocca la concorrenza, non la profondità.
- **§4 punto 4 — inline generalizzato.** «**If delegation is unavailable** on the current host, run the
  step inline while still respecting order, perimeter and return format, and declare it in the
  outcome.» Vale per ogni passo: le foglie (`decision-doc`, `study`, `update-memory`) possono girare
  inline senza perdere nulla di prezioso.
- **La chiave stessa come «valore nei parametri».** Il contratto: «its depth is a value in the
  parameters, not a rule rewritten here». Alzare la chiave **non cambia il metodo** — una riga nel
  progetto ospite — ma è la via che la domanda esclude, ed è una dipendenza da una chiave
  `experimental` di un progetto d'altri.
- **Il padre esterno / plugin dentro l'host.** È l'unica via che chiede sia un framework sia un cambio
  di metodo: §6 vieta il tool `Workflow` («the orchestration belongs to the agent […] Do not invoke
  it»).

### Classifica

1. **C — re-radicare come primario** ciò che è già entry point (`review`, `code-review`, `research`,
   `commit`). Nessun framework, nessun metodo, **e compone davvero** l'arco `review → finder` a default
   1 con indipendenza intatta. Limite: non copre la consegna in-chain (`ship-feature`).
2. **C+D — §4.4 inline per i passi che non si possono re-radicare** (foglie; e, in extremis, i finder).
3. **B — degradazione dichiarata a inline con `independence: "lost"`.** Compone ovunque ma scambia il
   rendimento della review con la composizione.
4. **A / D-`sequential_fanout` — fan-out sequenziale.** Indipendenza intatta, ma **non cambia la
   profondità**, quindi non compone nulla che il tetto blocchi.

---

## 8. Q6 — Cosa servirebbe a rendere la chiave dell'host affidabile

### Il fatto da stabilire

Tre premesse sono ancora da verificare (`daiku-non-gira-su-opencode/0.5. strategic-study.md`):

1. **Il tetto limita i *round* o l'*annidamento*?** La lettura del sorgente dice «conta gli antenati»;
   la differenza cambia tutto.
2. **Una `review` lanciata a mano compone a default 1?** Se `review` gira a profondità 0, i suoi finder
   stanno a 1 → il default dovrebbe bastare.
3. **Il `2` del contratto è giusto?** Vale per `review → finder` quando `review` è a sua volta un
   figlio; per la `review` a mano sembrerebbe `1`.

**Il confondimento da controllare prima di misurare.** Ci sono **due** barriere, non una:

- il **contatore di profondità** (`subagent.ts`), che rifiuta con `Subagent depth limit reached (N)…`;
- il **default «foglia» dei permessi**: `subagent-permissions.ts` aggiunge al figlio
  `{ permission: "task"|"subagent", pattern: "*", action: "deny" }` **a meno che** il figlio permetta
  già la delega (`.daiku/studies/opencode.md` §7.5). Un esperimento ingenuo — un figlio che lancia un
  nipote — **sbatte sul permesso, non sul tetto**, e l'errore è un altro. Per isolare il contatore,
  l'agente-figlio deve portare `subagent: allow` esplicito.

### L'esperimento minimo (piano, non eseguito)

**Configurazione.** Cartella usa-e-getta fuori dal repository. Un `opencode.json` con la chiave nella
**sede giusta** — sotto `experimental`, mai in radice, che `normalize.ts` scarta in silenzio
(`unsupportedTopLevel`):

```json
{ "$schema": "https://opencode.ai/config.json",
  "experimental": { "subagent_depth": V } }
```

con `V` in `{0, 1, 2}` fra le corse — sempre con `experimental` *e* `subagent_depth` insieme, per non
incappare nella trappola nota (una config che definisce `experimental` senza `subagent_depth` **non**
fa scendere la lettura alla globale).

**Agenti.** In `.opencode/agents/` (o `~/.config/opencode/agents/`), tre file con `mode: subagent`:
`A` (specchio di `review`, `subagent: allow`), `B` (specchio di un passo che delega, `subagent:
allow`), `C` (specchio della foglia, nessuna delega).

**Lancio.** `opencode run` con l'agente scelto da `--agent`, prompt da `stdin`/`--file`, output
`--format json` (NDJSON) e server `--standalone`, così non si tocca il servizio di background:

```
opencode run --agent A --format json --standalone -- "<prompt che chiede ad A di lanciare B, e a B di lanciare C>"
```

**Cosa guardare nell'output.** Nel flusso NDJSON, la stringa esatta `Subagent depth limit reached (`
— e il numero fra parentesi — oppure l'assenza della sessione/nipote di `C`; e se compare `omitted
unsupported legacy setting` (il warning di una dichiarazione in radice, oggi letto e non visto
stampato). E l'exit code vero della corsa.

### Cosa proverebbe

- **`V = 0`** — nessun lancio parte, nemmeno `A → B`: conferma che il contatore parte dalla profondità
  della sessione chiamante e che `0` vieta tutto.
- **`V = 1`** — `A → B` riesce **due volte** (round separati), ma `B → C` è rifiutato con il messaggio
  esatto. Se i due lanci di `A → B` passano, il tetto **non** è un contatore di lanci/round; se `B → C`
  è rifiutato, è un contatore di **livelli** → **Q1 risolta**.
- **Q2** — con il **default**, far lanciare ad `A`, in un solo messaggio, **due figli insieme**: se
  entrambi tornano, una sessione primaria fa fan-out a default 1 → **una `review` lanciata a mano
  compone**.
- **Q3** — `A` (**primario**) → `B` (**review**) e far lanciare a `B` un figlio: a `V = 1` rifiutato, a
  `V = 2` riuscito → **il `2` del contratto è il minimo giusto per una `review` che è essa stessa un
  figlio**, e per estensione il percorso a quattro livelli ne chiede `3`.

### Cosa resterebbe aperto

- **Il contatore sì, il cablaggio di Daiku no.** L'esperimento prova il contatore con agenti sintetici.
  Nella catena reale agiscono anche i **permessi** degli agenti veri: il `finder` di Daiku ha la delega
  negata a `*`; va stabilito **quale** permesso `subagent` porta la resa opencode del nodo che delega.
- **Nessuna catena intera osservata.** Un arco misurato non è una catena composta.
- **L'albero npm ↔ tag.** L'esecuzione gira sulla copia installata (`2.0.29`), ogni citazione di
  sorgente è al tag `v2.0.29`: la corrispondenza resta un `[to verify]`.
- **La persistenza della chiave** è `experimental`: una misura di oggi non promette che la chiave
  esista domani, né che il default resti `1`.
- **La forma del warning** di una dichiarazione in radice: oggi letta (`Diagnostic`,
  `kind:"unsupported"`), non vista stampata.

**Fuori perimetro di questa sessione.** Eseguire l'esperimento toccherebbe `opencode debug agents` e/o
il servizio di background dell'owner. Va **descritto come piano**, non eseguito: la corsa usa
`--standalone` proprio per non avviare il servizio, ma resta una corsa reale su un host ospite che oggi
**non esiste** in questo repository (niente `opencode.json`, niente `.opencode/`, niente `AGENTS.md`).
