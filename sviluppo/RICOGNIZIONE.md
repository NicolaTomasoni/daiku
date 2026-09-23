# Daiku — ricognizione

Questo file raccoglie tutto ciò che è emerso prima di scrivere una riga del pacchetto: cosa
offrono davvero i due host, cosa c'è in `src/`, cosa manca, cosa si butta e cosa resta da
verificare. È una fotografia dello stato di conoscenza, non un progetto approvato: il capitolo 6
è una proposta, e i capitoli 1-5 sono i fatti su cui poggia.

Scritto il 18 settembre 2026. Nessun file di `src/` è stato toccato.

**Stato delle verifiche.** Il capitolo 3 non viene dalla documentazione web ma dalla **specifica
di prima parte su disco** e da **prove eseguite su entrambi gli host**: un pacchetto di banco è
stato costruito, validato da `claude plugin validate` e dal validatore Codex, installato davvero
su Codex e poi rimosso. Dove una prova è stata eseguita, il testo lo dice. Il capitolo 8 racconta
come, il capitolo 9 elenca il poco che resta.

---

## 1. Equivoci sciolti

Cinque cose che si credevano e che non sono vere. Stanno qui in testa perché il resto del
documento si legge male se si portano dietro.

**Codex non ha un sistema di estensione.** Falso. Codex ha oggi skill, plugin, marketplace con
CLI `codex plugin`, hook a dodici eventi e subagent. Ha anche compatibilità dichiarata con Claude
Code: legge `.claude-plugin/marketplace.json`, e il comando `/import` importa skill, plugin, MCP,
hook, slash command e subagent da una configurazione Claude Code esistente.

**La documentazione Codex sta su `developers.openai.com/codex`.** Non più: quegli URL fanno
308-redirect verso `learn.chatgpt.com/docs/*`. I `docs/*.md` nel repo `openai/codex` sono ormai
stub che rimandano lì. L'indice è `https://learn.chatgpt.com/llms.txt`.

**I pointer `.agents/skills/` sono il meccanismo di portabilità.** No: erano una strada
provvisoria. Otto file di una dozzina di righe che dicono «sei l'host codex, leggi il contratto
canonico in `.claude/commands/<nome>.md`». Funzionavano perché Codex e Claude giravano sullo
stesso checkout, e cadono appena il metodo diventa un pacchetto installato altrove. Vanno
ripensati con un obiettivo diverso: **i due host devono vedere gli stessi file, non due indirizzi
per lo stesso file.** Il capitolo 6 parte da qui.

**`src/` è un lavoro a metà.** No: è uno snapshot **byte-identico** di `ReforgIA/src/.claude`.
41 file su 41 identici, zero divergenze. L'unica differenza è una skill di dominio del progetto
di origine, presente lì e assente qui — e fa bene ad essere assente (§5).

**Esisteva prior art da recuperare.** `ReforgIA/src/docs/integrazione-automatica-claude-code-codex.md`
(596 righe) descriveva un'integrazione fra i due host. Era provvisoria e va scartata per intero:
non entra in questo quadro e non se ne riprende nulla.

---

## 2. Il punto di partenza

### 2.1 I quattro livelli che il metodo già dichiara

`src/project-contract.md` §1 separa il corpus in quattro livelli. Il criterio è uno solo: **il
file di una skill è identico byte per byte in ogni progetto**, e qualunque valore specifico
scritto dentro una skill va spostato di livello.

| Livello | Sede oggi | Contiene | Identico ovunque |
|---|---|---|---|
| **Metodo** | `commands/**`, `agents/**`, `orchestration.md`, `project-contract.md` | cosa va fatto, in che ordine, con quali vincoli | **sì** |
| **Ambiente** | `environment.json` | host, modello per ruolo, backend, path di macchina | per owner |
| **Parametri** | `project.json` | path, comandi letterali, aree esistenti | per progetto |
| **Dominio** | `context/*.md`, `rules/*.md` | liste, tassonomie, criteri di giudizio locali | mai |

Questa frattura è già la linea lungo cui si taglia un pacchetto distribuibile. Il §5.3
mostra che i livelli sono però cinque, non quattro.

### 2.2 Il contenuto di `src/`

- **18 contratti** in `commands/`, di cui 5 annidati sotto `deliver-feature/` e 7 sotto `review/`.
  L'annidamento è documentazione: la topologia reale — chi invoca chi, con quale input risolto,
  con quale ritorno — vive nella tabella di `orchestration.md` §3.
- **2 agent** a toolset ristretto: `finder` (analisi, niente scrittura) e `auditor-memoria`
  (sola lettura assoluta, nemmeno `Bash`).
- **3 hook** `.mjs`, tutti fail-open e tutti con banco di prova `--self-check` a totale contato:
  guardia sui comandi distruttivi (`PreToolUse`), controlli sul corpus dopo ogni scrittura
  (`PostToolUse`), avviso di ciclo aperto (`SessionStart`).
- **2 contratti di riferimento** mai invocati ma letti da tutti: `orchestration.md` (ruoli,
  delega, concorrenza, degradazione) e `project-contract.md` (la forma dei due JSON).
- **2 file di parametri** e **le cartelle di dominio**, che sono ReforgIA e basta.

---

## 3. Cosa offrono i due host

### 3.1 Il fatto che decide tutto

**`skills/<nome>/SKILL.md` è l'unico primitivo che i due host leggono nativamente, con lo stesso
identico layout.** È la risposta al problema dei pointer: un contratto messo lì è *lo stesso
file* per Claude Code e per Codex, senza indirezione, senza copia, senza un wrapper per host.

Tutto il resto diverge.

| | Claude Code | Codex |
|---|---|---|
| manifest del pacchetto | `.claude-plugin/plugin.json` | **`.codex-plugin/plugin.json`** (verificato) |
| marketplace | `.claude-plugin/marketplace.json` | `.agents/plugins/marketplace.json`; legge **anche** quello Claude |
| skill | `skills/<n>/SKILL.md` | **identico** |
| slash command | `commands/*.md` | migrati d'ufficio in skill, **col nome storpiato** (§3.4) |
| subagent | `agents/*.md` | `agents/` del pacchetto ignorata; i ruoli vivono in `.codex/agents/*.toml`, fuori dal pacchetto (§3.6) |
| hook | `hooks/hooks.json` | **`plugin_hooks` è una feature rimossa** (§3.4) |
| skill di sola consultazione | `disable-model-invocation: true` | `agents/openai.yaml` → `policy.allow_implicit_invocation: false` (§3.5) |
| invocazione di una skill | `/daiku:review` — sempre namespacizzata | `$review` — **nessun namespace** |
| configurazione | `settings.json` | `config.toml` |
| skill di progetto | `.claude/skills/` | `.agents/skills/` (repo, risalendo fino alla root) |
| skill di utente | `~/.claude/skills/` | `~/.codex/skills/` (verificato: esiste ed è in uso) |
| istruzioni canoniche | `CLAUDE.md` | `AGENTS.md` (+ `project_doc_fallback_filenames`) |
| memoria dell'agente | cartella di `.md`, sede spostabile con `autoMemoryDirectory` — ma **solo** da `settings.local.json` o dai settings utente: da un `settings.json` committato è ignorata per sicurezza | `~/.codex/memories_1.sqlite`, database consolidato dalle sessioni, feature `memories`: **nessuna chiave ne sposta la sede** (verificato: `codex features list`, schema del db) |
| dove si installa | `~/.claude/plugins/cache/<mkt>/<plugin>/<versione>/` | `~/.codex/plugins/cache/<mkt>/<plugin>/<versione>/` — stessa forma (verificato) |

### 3.2 Le variabili di path

Claude Code espone `${CLAUDE_PLUGIN_ROOT}` (la cartella d'installazione, **che cambia a ogni
aggiornamento**), `${CLAUDE_PLUGIN_DATA}` (`~/.claude/plugins/data/<id>/`, che sopravvive agli
aggiornamenti) e `${CLAUDE_PROJECT_DIR}`. Codex non ha un equivalente documentato.

Conseguenza: **un rimando fra contratti non può essere un path assoluto.** Restano due forme, e
nessuna delle due copre entrambi gli host da sola: il nome della skill — che Claude Code
namespacizza (`/daiku:review`) e Codex no (`$review`) — oppure un path **relativo alla radice del
pacchetto**, che vale ovunque ma solo per i file che skill non sono (§7.4).

### 3.3 Cosa un pacchetto Codex può davvero portare — verificato

Codex porta con sé una skill di sistema, `plugin-creator`, che contiene lo schema e il validatore
reali: `~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py`, che per sua stessa
dichiarazione *«rispecchia lo schema di ingestione dei plugin del workspace»*.

**Le sole chiavi ammesse in `.codex-plugin/plugin.json`:**

```text
id · name · version · description · skills · apps · mcpServers
interface · author · homepage · repository · license · keywords
```

Un pacchetto di prova con i campi contestati è stato validato. Esito, verbatim:

```text
- plugin.json field `agents` is not accepted by plugin validation
- plugin.json field `commands` is not accepted by plugin validation
- plugin.json field `hooks` is not accepted by plugin validation
- skill `orchestration` frontmatter field `disable-model-invocation` must be false
```

Quattro conseguenze, tutte e quattro dure:

1. **Un pacchetto Codex non trasporta hook.** La sezione «Field guide» dello stesso riferimento
   mostra `"hooks": "./hooks.json"` nel JSON d'esempio: **è sbagliata**, e le note di validazione
   in fondo allo stesso file lo dicono. Ha ragione il validatore. Gli hook su Codex esistono, ma
   si dichiarano fuori dal pacchetto — `~/.codex/hooks.json` o `<repo>/.codex/hooks.json` — e
   quindi li deve scrivere `init`, non il pacchetto.
2. **Un pacchetto Codex non trasporta subagent.** Niente `agents/`. I subagent Codex esistono, in
   `.codex/agents/*.toml`, di nuovo fuori dal pacchetto: cosa portano davvero e cosa no è in §3.6,
   provato.
3. **Un pacchetto Codex non trasporta slash command.** Confermato: i contratti diventano skill, e
   non c'è un ripiego.
4. **`disable-model-invocation: true` è rifiutato.** Su Codex *ogni* skill del pacchetto è
   invocabile dal modello, e non c'è modo di dichiararne una di sola consultazione.

**Ma il pacchetto può comunque portarsele dietro.** Il divieto è sul *dichiararle nel manifest*,
non sull'esistenza delle cartelle: un albero con `agents/`, `commands/` e `hooks/` presenti ma
non dichiarati passa la validazione Codex **e** quella Claude Code. Sono i due host a decidere
cosa farne.

### 3.4 Cosa Codex fa davvero, all'installazione — verificato

Il pacchetto di prova è stato installato per davvero:
`codex plugin marketplace add`, poi `codex plugin add daiku-prova@daiku-banco`. Esito:

- **L'albero è copiato verbatim** in `~/.codex/plugins/cache/<marketplace>/<plugin>/<versione>/` —
  la stessa forma di path di Claude Code. `agents/`, `commands/`, `contratti/` e `hooks/` ci sono
  tutti.
- **`config.toml` riceve due blocchi**: `[marketplaces.<nome>]` con `source_type` e `source`, e
  `[plugins."<plugin>@<marketplace>"]` con `enabled = true`.
- **I `commands/` vengono migrati d'ufficio in skill.** Codex genera
  `.codex-plugin/migrated-command-skills/source-command-<nome>/SKILL.md`. Ma la migrazione
  **storpia**: `gamma` diventa `source-command-gamma`, e il corpo originale finisce sotto un
  preambolo generato — *«Use this skill when the user asks to run the migrated source command
  gamma»* — dentro una sezione `## Command Template`.

  Per Daiku è inutilizzabile: i contratti si citano fra loro per nome, e un nome riscritto rompe
  ogni rimando. **I contratti si scrivono come `skills/`, non come `commands/`.** La migrazione
  automatica è un ripiego per chi ha solo comandi, non una strada.
- **Gli hook non partono, e non è una svista.** `codex features list` dichiara:

  ```text
  hooks           stable     true
  plugin_hooks    removed    false
  ```

  `plugin_hooks` è **rimossa**. Gli hook di Codex esistono e funzionano, ma solo dichiarati in
  `~/.codex/hooks.json` o `<repo>/.codex/hooks.json`. Dal pacchetto, mai.

**Dove vanno davvero i contratti di riferimento.** La via di fuga di `skills/.contratti/` —
che il validatore Codex salta — **non funziona su Claude Code**, che invece quella cartella la
scandisce: `claude plugin validate` ha aperto `skills/.contratti/SKILL.md` e ha segnalato il
frontmatter mancante. Spostati in una cartella di primo livello, `contratti/`, i file sono
**ignorati da entrambi i validatori e trasportati da entrambi gli host**. È quella la sede.

### 3.5 Il contratto di una skill

Il validatore impone, per ogni `skills/<nome>/SKILL.md`: frontmatter YAML aperto da `---\n` e
chiuso, `name` non vuoto, `description` non vuota. Opzionale `agents/openai.yaml` dentro la
cartella della skill, per dichiararne le dipendenze MCP.

Il manifest richiede invece, con validazione stretta: `name`, `version` in **semver stretto**,
`description`, `author.name`, e un oggetto `interface` completo di `displayName`,
`shortDescription`, `longDescription`, `developerName`, `category`, `capabilities` (array di
stringhe) e `defaultPrompt`. Nessuno di questi è facoltativo.

**L'equivalente Codex di `disable-model-invocation` esiste, ma sta altrove.** Non nel frontmatter
— lì è rifiutato — bensì in `skills/<nome>/agents/openai.yaml`:

```yaml
interface:
  display_name: "Review"
  short_description: "Ciclo di review su un diff"
policy:
  allow_implicit_invocation: false
```

Con `false` la skill **non viene iniettata nel contesto del modello**, ma resta invocabile
esplicitamente come `$review`. Verificato: il pacchetto di prova con questo file passa la
validazione di **entrambi** gli host.

Conta per Daiku più di quanto sembri, e dal **19 settembre 2026** molto di più di prima: i
contratti sono diciotto e la §3 di `orchestration.md` ne dichiara invocabili a mano **sette**
— `new-feature`, `research`, `review`, `code-review`, `commit`, più `init` e `sync-host` per l'installazione.
(`code-review` è rientrato fra gli invocabili il 20 settembre
2026 come entry manuale solo-bug sullo scope detto, dopo l'eliminazione della sua modalità pull request.) Gli altri undici sono contratti interni,
che un subagent riceve come path da leggere. Senza questo file finirebbero tutti nel contesto di
ogni sessione Codex. Il prezzo è che `display_name` e `short_description` diventano
obbligatori per ogni skill che lo usa.

### 3.6 I subagent di Codex — verificato il 19 settembre 2026

Esistono, e si dichiarano fuori dal pacchetto: `~/.codex/agents/*.toml` per l'utente,
`<repo>/.codex/agents/*.toml` per il progetto. Un file, un ruolo. Obbligatori `name`,
`description` e `developer_instructions`; accettati anche `model`, `model_reasoning_effort`,
`mcp_servers`, `skills.config` e `sandbox_mode`.

Il banco — un repo vuoto con due ruoli, `codex exec --json -s workspace-write`, parent su
`gpt-5.6-luna` — ha dato quattro esiti:

| Prova | Esito |
|---|---|
| ruolo che vieta di scrivere **in prosa**, gli si chiede di creare un file | non scrive: «le istruzioni di sistema impongono un passo di sola analisi» |
| ruolo con `sandbox_mode = "read-only"` e **nessun divieto in prosa** | **scrive** il file |
| la stessa, con `--enable multi_agent_v2` | **scrive** lo stesso |
| sessione intera lanciata con `-s read-only` | `patch rejected: writing is blocked by read-only sandbox` |

Le due cose che contano stanno nelle ultime due righe. `sandbox_mode` **dentro un file di ruolo
non è imposto**: il subagent scrive comunque, con e senza il multi-agente nuovo. E non è che la
sandbox non funzioni su Windows — a livello di **sessione** rifiuta la scrittura come deve. È la
dichiarazione per ruolo a non arrivare da nessuna parte.

Che il file venga comunque letto è provato a parte, con una parola-spia nelle
`developer_instructions`: il subagent l'ha riportata nella stessa risposta in cui scriveva il
file. Quindi il ruolo arriva, il confine no.

**Ne segue la forma della resa Codex**, quella che `sync-host` genera dai `agents/*.md` del
pacchetto: `name`, `description` e `developer_instructions` in una stringa letterale a tre apici
(`'''`, così i backslash dei path Windows non diventano escape), **senza** `sandbox_mode` e
**senza** `model`. Provata sul banco: il `finder` reso in questo modo ha rifiutato di modificare
un README e ha riportato il rifiuto, citando il proprio perimetro.

### 3.7 Le due trappole

**`rules/` è già un'altra cosa su Codex** — verificato: `~/.codex/rules/default.rules` esiste su
questa macchina. Sono file Starlark che governano l'esecuzione dei comandi fuori sandbox. Il nome
va abbandonato per il livello Dominio, altrimenti si collide su un concetto di sicurezza dell'host.

**La fiducia di un hook Codex è registrata sull'hash dell'hook.** Ogni aggiornamento che tocchi un
hook fa ri-chiedere l'approvazione tramite `/hooks`. In più il sistema è dietro il gate
`features.hooks = true`. Combinato con §3.3 e §3.4, significa che gli hook su Codex sono il pezzo più
caro da mantenere e il meno automatizzabile.

### 3.8 Il vincolo invalicabile

**Nessuno dei due host lascia che un pacchetto scriva nel progetto dell'utente.** Su Claude Code
è un confine di sicurezza esplicito: path traversal fuori dalla root del pacchetto rifiutato,
symlink verso l'esterno saltati. Il pacchetto è solo *letto da dove sta installato*.

Ne segue che i livelli Parametri e Dominio non possono essere consegnati dal pacchetto: possono
solo esserne **generati**, da un comando che l'utente lancia e che scrive lui i file. È il
mestiere di un `init`, ed è l'unica via ammessa.

Il pacchetto orfano `0.1.0` trovato in cache — e rimosso — aveva aggirato il problema
rinunciandoci: impacchettava il solo livello Metodo e lasciava scoperti gli altri tre.

---

## 4. Distribuzione e aggiornamento

### 4.1 I comandi

```text
Claude Code    /plugin marketplace add <owner>/<repo>
               /plugin install daiku@<marketplace>
               /plugin update daiku@<marketplace>
               claude plugin install daiku@<marketplace> --yes      (non interattivo)

Codex          codex plugin marketplace add <owner>/<repo> [--ref <tag>] [--sparse <path>]
               codex plugin add daiku@<marketplace>
               codex plugin marketplace upgrade daiku
```

Verificato: `codex plugin` esiste in `codex-cli 0.155.0` con i sottocomandi `add`, `list`,
`marketplace`, `remove`. `codex plugin marketplace add <SOURCE>` accetta un path locale,
`owner/repo[@ref]`, un URL Git HTTPS o SSH, con `--ref` e `--sparse` ripetibile.

**Il marketplace personale non si registra.** `~/.agents/plugins/marketplace.json` è scoperto
implicitamente da Codex: per quel path `codex plugin marketplace add` non va usato. Si registrano
solo i marketplace non-default.

Forma verificata di una voce di marketplace — `policy.installation`, `policy.authentication` e
`category` sono tutti e tre obbligatori:

```json
{
  "name": "daiku",
  "source": { "source": "local", "path": "./plugins/daiku" },
  "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
  "category": "Productivity"
}
```

La radice porta `name`, opzionale `interface.displayName`, e `plugins[]` — il cui **ordine è
l'ordine di resa** nella UI di Codex. `source.path` è relativo alla radice del marketplace, che
sta due livelli sopra il `marketplace.json`.

### 4.2 Come si versiona

L'aggiornamento è governato dal campo `version` del manifest, in semver stretto. Si bumpa quello e
i due host tirano la versione nuova; finché non si bumpa, nessuno aggiorna. Claude Code tiene ogni
versione in una cartella propria e conserva le orfane 14 giorni.

**Su Codex, in sviluppo locale, il bump di versione non è la via.** Esiste un meccanismo dedicato,
il **cachebuster**: si sostituisce il suffisso dopo `+` nella versione del manifest e si
reinstalla.

```text
0.1.0                      → 0.1.0+codex.local-20260918-143000
0.1.0+codex.vecchio-token  → 0.1.0+codex.local-20260918-143000
```

Il suffisso si **rimpiazza**, non si accumula, e i componenti numerici non si incrementano solo
per forzare la reinstallazione. Poi `codex plugin add <nome>@<marketplace>`, e **un thread nuovo**:
è il confine oltre il quale Codex rilegge skill e tool.

Non esiste **nessun** meccanismo npm per le estensioni Codex: npm è solo il modo in cui si
distribuisce la CLI `codex` stessa.

### 4.3 Cosa non si aggiorna da solo

Quello che `init` ha scritto nel progetto ospite è dell'utente: il pacchetto non lo tocca più.
La deriva fra i template della versione installata e i file del progetto va misurata, ed è il
mestiere di un `doctor`. Il campo `contract` già presente nei due JSON è il numero su cui
quella misura si àncora — `project-contract.md` §7 dichiara già quando si incrementa e perché.

Su Codex il perimetro di ciò che non si aggiorna è più largo, perché §3.3 ne esclude tre
categorie: **hook, subagent e configurazione stanno fuori dal pacchetto**, quindi non seguono mai
l'aggiornamento e restano interamente a carico di `init` e `doctor`.

### 4.4 Un terzo canale, più semplice del pacchetto

Codex porta una skill di sistema `skill-installer` che installa skill **da un qualunque repo
GitHub** dentro `$CODEX_HOME/skills/<nome>`, con download diretto o fallback a sparse checkout,
anche da repo privati. Non richiede né manifest, né marketplace, né policy.

È la via più corta per distribuire il solo livello Metodo, e vale la pena tenerla presente come
ripiego: se la macchina del pacchetto si rivelasse troppo cara da mantenere su due host, un repo
di sole `skills/<nome>/SKILL.md` resta installabile su entrambi — Claude Code legge
`~/.claude/skills/`, Codex `~/.codex/skills/` — al prezzo di perdere versionamento,
aggiornamento comandato e tutto ciò che non è una skill.

---

## 5. Cosa manca

### 5.1 Due pezzi del metodo mai copiati in `src/`

| Manca | Righe | Perché appartiene al metodo |
|---|---|---|
| `docs/scripts/check-contratti.py` | 571 | verifica a macchina la topologia di `orchestration.md` §3: che i nodi siano tutti e soli quelli su disco, che ogni contratto consegnato a un subagent compaia fra i chiamanti della propria riga, che ogni rimando a sezione trovi l'heading. L'hook post-edit lo lancia a ogni scrittura sul corpus. |
| i pointer per il secondo host | ~25 l'uno | il meccanismo esiste (`{hosts.<host>.skill_pointers}`) ma va **ripensato**, non copiato: §1 e §3.1. Dal **19 settembre 2026 nessun host lo dichiara** nello scheletro dell'owner: il manifest Codex carica le skill da `./skills/`, quindi la chiave descriveva pointer che non esistono, e con essa dichiarati nessuna skill sarebbe risultata invocabile |

> **Aggiornamento del 18 settembre 2026.** Il verificatore è stato copiato in
> `plugins/daiku/tools/check-contratti.py` e poi **rimosso**. Risolveva la propria radice per
> posizione sul disco (`parents[2]`), quindi dopo la riorganizzazione dell'albero cercava il corpus
> in `plugins/.claude/` e contava 3 controlli su una ventina, uscendo `1` per costruzione: un
> comando rosso che non diceva niente su nulla. La proprietà che verificava resta desiderabile e non
> è verificata da nessuno — vedi §7.4 e il commento in `contratti/orchestration.md` §3.
>
> **E non tornerà in quella forma.** Dal **19 settembre 2026** nessun hook lancia più un programma:
> il post-edit *ricorda* di provare una guardia riscritta e non la esegue, perché far partire un
> file appena comparso è codice non ancora guardato che parte senza la conferma dell'host e senza
> l'approvazione per hash che Codex pretende per gli hook (§3.7). Se quella verifica di topologia
> tornerà, sarà un comando che qualcuno lancia — come `hooks/self-check.mjs` — non un hook che lo
> lancia da sé.
>
> **Tornata il 23 settembre 2026** come `sviluppo/tools/check-topology.mjs`: Node senza
> dipendenze, radice passata per argomento, esito JSON contato. Verifica proprio le tre proprietà
> sopra. Prova eseguita il 23 settembre 2026: `node sviluppo/tools/check-topology.mjs
> plugins/daiku` → `{"checks":296,"passed":296,"failed":[]}`, uscita `0`. *(Erano 283 lo stesso
> giorno, prima che il valutatore deterministico crescesse la prosa dei contratti: il totale conta
> i rimandi di sezione, e citarne di nuovi alza il numero.)*
>
> Vive fuori dal pacchetto, in `sviluppo/tools/`, così non viaggia con ciò che si pubblica.

### 5.2 Le convenzioni di progetto che il metodo presuppone

Il corpus cita 25 path che risolvono solo nella ReforgIA viva. Tolti quelli di `context/` e
`rules/` — che escono dal pacchetto — restano le convenzioni che il metodo dà per esistenti e che
`init` dovrà creare nel progetto ospite:

| Convenzione | Chi la cita | Cosa contiene |
|---|---|---|
| `CLAUDE.md` | 22 file | vedi §5.3 — è il caso grosso |
| `memory/` + `memory/MEMORY.md` | 10 file | il corpus di memoria persistente e il suo indice |
| `docs/nuovi-sviluppi/<nome>/` | tutti, implicitamente | la cartella di una feature, con i file numerati `0.`–`5.` |
| `docs/appunti-lib/` | 3 file | gli appunti che `studia-libreria` deposita |
| `.dev-runtime/review/` | 3 file | i ledger dei rilievi già giudicati, uno per ciclo di review |
| `docs/scripts/` | 2 file | dove vive il verificatore del corpus |

### 5.3 Il quinto livello: gli invarianti dentro `CLAUDE.md`

`update-memory.md` dichiara `CLAUDE.md` **fonte canonica** del contratto della memoria. Un
pacchetto che non lo porta consegna un contratto che punta al vuoto. *(Il secondo lettore di quella
fonte era `memory-review`, eliminata dal pacchetto il 19 settembre 2026.)*

Le 106 righe di quel file, sezione per sezione:

| Sezione | Natura |
|---|---|
| Divisione della documentazione | **metodo**, parametrizzabile su `{tech_doc}` e `{version.file}` |
| Contratto della memory | **metodo puro** — le tre forme (mappa, catalogo, fatto), le regole di mutazione, la tassonomia delle otto azioni di review |
| Comportamento | **metodo** — disciplina di scrittura del codice, valida ovunque |
| Hard rules 1-15 | **misto** — 11 sono architettura ReforgIA, 4 sono metodo |
| Git e commit | **metodo** quasi per intero — le eccezioni dichiarate per `/deliver-feature`, `/commit`, `/review` |
| Avvio e ambiente locale | ReforgIA |
| Sicurezza operativa | ambiente dell'owner |

Quindi i livelli sono **cinque**, e il quinto — gli **invarianti canonici** — il
`project-contract.md` non lo nomina. È metodo byte-identico, quindi appartiene al pacchetto, ma
oggi vive in un file che è del progetto ospite.

**Il meccanismo per risolverlo esiste già.** `CLAUDE.md` dichiara: *«lo slug fra parentesi quadre
è il riferimento stabile che citano le skill portabili, perché la numerazione cambia da progetto
a progetto»*. La via che il corpus suggerisce da sé: il pacchetto **dichiara** gli slug che cita,
il progetto li **definisce**, e `doctor` verifica che ogni slug citato esista. È la stessa forma
della degradazione di `project-contract.md` §6 — *ciò che il progetto non dichiara non esiste* —
applicata agli invarianti invece che ai parametri.

### 5.4 L'unica falla di atomicità nel corpus

Il corpus cita tre slug. Due sono metodo: `[gate-owned-by-review]` (9 occorrenze, in
`deliver-feature`, `review`, `blueprint`, `execute`, `test-coverage`) e `[extend-before-creating]`.

Il terzo no. **`review/test-coverage.md`, righe 97 e 112, cita `[storage-single-facade]`**, che
parla di `app/adapters/storage/`: ReforgIA dentro un contratto che dovrebbe essere identico
ovunque. È l'unica violazione trovata.

Stessa classe, più sfumata: `update-memory.md` cita `memory/memory-content-conventions.md` come
canonico, ma quel file è una memoria di tipo `feedback` di ReforgIA. Va ricondotto alla
convenzione di `project-contract.md` §5.4, che per il dominio prescrive un rimando **per ruolo**
in cui la skill dichiara la domanda e mai la risposta.

---

## 6. Cosa si butta

| Cosa | Perché |
|---|---|
| il pacchetto orfano `0.1.0` in cache | già rimosso: impacchettava un livello su quattro, nomi anglicizzati, contratti di riferimento e hook scartati |
| i pointer `.agents/skills/` | strada provvisoria: §1 |
| `docs/integrazione-automatica-claude-code-codex.md` di ReforgIA | provvisorio, non se ne riprende nulla |
| `src/context/{changelog,enabling-run,perf,test-strategy}.md` | dominio ReforgIA — restano a ReforgIA |
| `src/rules/*.md` (7 file) | dominio ReforgIA, e il nome collide con le rules di Codex (§3.3) |
| le skill di dominio del progetto di origine | curano un suo catalogo di sorgenti: sono skill *di* quel progetto, non del metodo. Restano a lui. |
| `.vscode/tasks.json` | switch dei backend LLM: ambiente dell'owner, non del metodo |

---

## 7. La disposizione proposta

### 7.1 Il repo, che è insieme marketplace e pacchetto

```text
Daiku/
├─ .claude-plugin/marketplace.json     ← marketplace Claude Code (+ compat Codex)
├─ .agents/plugins/marketplace.json    ← marketplace nativo Codex
└─ plugins/daiku/
   ├─ .codex-plugin/plugin.json        ← manifest Codex (§3.5 per i campi obbligatori)
   ├─ .claude-plugin/plugin.json       ← manifest Claude Code
   ├─ skills/                          ← IL PAYLOAD: gli stessi file per i due host
   │  ├─ <18 contratti>/
   │  │  ├─ SKILL.md                      annidamento sciolto, tutti fratelli
   │  │  └─ agents/openai.yaml            allow_implicit_invocation: false sui contratti interni
   │  ├─ init/SKILL.md                    genera l'albero 7.2
   │  └─ doctor/SKILL.md                  misura la deriva dell'albero 7.2
   ├─ contratti/                       ← NON skill: ignorati da entrambi i validatori,
   │  ├─ orchestration.md                 trasportati da entrambi gli host (§3.3)
   │  ├─ project-contract.md
   │  └─ invarianti.md                    il quinto livello (§5.3)
   ├─ agents/{finder,auditor-memoria}.md  ← la fonte dei due ruoli; su Codex li rende
   │                                         `sync-host` in `.codex/agents/*.toml` (§3.6)
   ├─ hooks/                              ← solo Claude: plugin_hooks rimossa su Codex (§3.4)
   │  ├─ hooks.json
   │  ├─ README.md                        la guida dei quattro guardrail: rami, gate, banchi
   │  ├─ self-check.mjs                   i quattro banchi in un colpo; non si installa mai
   │  └─ lib/*.mjs                        i 4 hook + `project-root` e `daiku-config`, importati
   ├─ templates/                        ← ciò che init copia; mai letto in place
   │  ├─ project/{project.json,instructions.md,domain/,policies/}  tutto in inglese (§5.6)
   │  ├─ owner/environment.json           destinazione `~/.daiku/`, non il progetto (7.4)
   │  └─ codex/hooks.json                 lo scheletro che `sync-host` compila
   └─ README.md
```

I due manifest e i due `marketplace.json` non sono ridondanza evitabile: sono i quattro file che i
due host cercano. Vanno tenuti allineati da un controllo in CI.

**Due voci di `templates/` sono cadute per strada, e vale la pena dire perché.** `claude/settings.json`
è stato scritto e poi **tolto il 19 settembre 2026**: su Claude Code gli hook li aggancia già il
pacchetto, e agganciarli una seconda volta dal progetto significava eseguire ogni guardia due volte.
`codex/{config.toml,agents/*.toml}` non sono mai nati: `sync-host` genera i `.toml` dei ruoli dai
`.md` del pacchetto, invece di trasportarne uno scheletro, e `config.toml` è dell'utente e non si
tocca — gli hook di Codex si dichiarano in un `hooks.json` a parte proprio per poterli diffare e
togliere senza toccare nient'altro.

**L'asimmetria è reale e non si chiude.** Su Claude Code il pacchetto porta hook e subagent e li
aggiorna da sé; su Codex li deve scrivere `sync-host` dentro il progetto, perché il manifest li
rifiuta. Stesso metodo, due gradi di automazione — ed è la stessa asimmetria che
`environment.json` già dichiara con `{hosts.<host>.enforcement}`: `harness` contro `prosa`. Il
pacchetto non la crea, la eredita.

E non si chiude nemmeno portando i ruoli su Codex, che pure si può fare (§3.6): là il ruolo fa
arrivare il contratto al figlio, ma non gli toglie niente di mano. Un ruolo scritto in
`.codex/agents/` risparmia al chiamante di ricopiare il contratto nel prompt; non trasforma
`prosa` in `harness`.

### 7.2 Il progetto ospite, dopo `init`

```text
progetto/
├─ .daiku/                    ← host-neutro: Parametri + Dominio
│  ├─ project.json               qui anche `guardrails`, che accende i dinieghi della guardia
│  ├─ dominio/*.md            ← l'attuale context/
│  ├─ politiche/*.md          ← l'attuale rules/, rinominato per la collisione §3.3
│  └─ skills/                 ← contratti locali al progetto
├─ .codex/                    ← solo su Codex, e lo scrive `sync-host`: su Claude Code il
│  ├─ hooks.json                 progetto non riceve niente, né in `.claude/` né altrove
│  ├─ hooks/*.mjs                (agganciare gli hook una seconda volta li farebbe girare due)
│  └─ agents/*.toml
├─ CLAUDE.md                  ← invarianti del progetto + definizione degli slug citati
└─ AGENTS.md                  ← rimanda a CLAUDE.md

~/.daiku/environment.json     ← Ambiente: per owner e macchina, non per progetto
```

### 7.3 Mappatura, file per file

| Oggi | Domani | Perché |
|---|---|---|
| `commands/*.md` (18, annidati) | `skills/<nome>/SKILL.md`, piatti | unico primitivo comune ai due host; `skills/` non annida |
| `commands/README.md` | `plugins/daiku/README.md` | è la guida del pacchetto |
| `orchestration.md` | `contratti/orchestration.md` | non è una skill; sotto `skills/` Claude Code la scandirebbe (§3.4) |
| `project-contract.md` | `contratti/project-contract.md` | idem |
| *(da `CLAUDE.md` di ReforgIA)* | `contratti/invarianti.md` | il quinto livello (§5.3) |
| `agents/*.md` | `agents/*.md`, fonte unica per i due host; su Codex `sync-host` ne genera `.codex/agents/*.toml` | Codex rifiuta `agents` nel manifest (§3.3); la resa e i suoi limiti in §3.6 |
| `hooks/*.mjs` | `hooks/lib/*.mjs` (Claude) **+** `templates/codex/` | Codex rifiuta `hooks` nel manifest (§3.3) |
| `settings.json` → blocco `hooks` | `hooks/hooks.json` (Claude) **+** `templates/codex/hooks.json` | eventi e contratto diversi (§3.7) |
| `settings.json` → `description` | `hooks/README.md` — **scritto il 19/09/2026** | è prosa, non configurazione |
| `project.json` | `templates/progetto/project.json`, svuotato | per progetto |
| `environment.json` | `templates/owner/environment.json`, svuotato | per owner |
| `context/README.md` | `templates/progetto/dominio/README.md` | scheletro |
| *(da ReforgIA)* `docs/scripts/check-contratti.py` | `sviluppo/tools/check-topology.mjs` (fuori dal pacchetto) | copiato e poi **rimosso** il 18/09/2026 perché risolveva la radice per posizione; **riscritto** il 23/09/2026 in Node senza dipendenze, con la radice per argomento — le tre proprietà di §5.1 tornano verificate (296 controlli verdi il 23/09/2026); spostato fuori da `plugins/` il 23/09/2026 perché è attrezzo di chi sviluppa, non cosa che si pubblica |

### 7.4 Le conseguenze sulla prosa dei contratti

Meccaniche ma diffuse, e sono il costo vero di questa disposizione.

1. **I rimandi cambiano forma, e non ne basta una sola.** Un rimando a una skill non può più
   essere un path, perché `${CLAUDE_PLUGIN_ROOT}` cambia a ogni aggiornamento e Codex non ha un
   equivalente (§3.2) — ma **i due host la nominano diversamente**: `/daiku:review` su Claude
   Code, che namespacizza sempre, e `$review` su Codex, che non namespacizza affatto. Il rimando
   va scritto in una forma che regga entrambi, o dichiarato una volta sola in un punto che
   `init` risolve per host. Un rimando a un contratto di riferimento — che skill non è — diventa
   invece un path **relativo alla radice del pacchetto** (`contratti/orchestration.md`).
2. **`.claude/project.json` → `.daiku/project.json`**, `.claude/context/<ruolo>.md` →
   `.daiku/dominio/<ruolo>.md`, `.claude/rules/` → `.daiku/politiche/`. Il prefisso `.claude/`
   dentro un contratto che deve girare su Codex è una bugia.
3. **`.claude/environment.json` → `~/.daiku/environment.json`.** ~~Oggi `project-contract.md` §8
   dice che quel file «si copia identico» in ogni progetto: è la duplicazione che §8 stessa
   condanna.~~ **Fatto il 19 settembre 2026**: la §8 ora dichiara la home come sede, con un override
   di progetto in `.daiku/environment.json` per chi non ha una home dell'owner — una CI, un
   container — o per il progetto che gira su un backend diverso dagli altri. Chi legge prende il
   primo dei due che trova, intero: non si fondono.

`orchestration.md` §3 regge già questa classe di verifica: la tabella della topologia è il posto
dove i nuovi indirizzi si dichiarano. **Controllarli a macchina, però, oggi non lo fa nessuno** — il
verificatore che lo faceva è stato rimosso (§5.1), e un suo successore andrebbe scritto in modo che
sappia dove si trova invece di dedurlo dalla propria posizione nell'albero. Nel frattempo quei
difetti li prende solo chi rilegge, o un finder di review istruito a cercarli.

---

## 8. Come sono state fatte le verifiche

Codex **è** installato su questa macchina — `codex-cli 0.155.0`, più un profilo attivo in
`~/.codex` con sessioni, log e memorie. Non era nel PATH; è stato aggiunto con
`npm install -g @openai/codex`.

Le prove eseguite:

1. **Lettura della specifica di prima parte.** `~/.codex/skills/.system/` contiene cinque skill di
   sistema preinstallate, fra cui `plugin-creator` (manifest e marketplace), `skill-creator` e
   `skill-installer`. Battono la documentazione web perché sono ciò che l'host esegue.
2. **Scaffold ufficiale.** `create_basic_plugin.py daiku-prova --with-skills --with-hooks
   --with-scripts` ha prodotto **solo** `.codex-plugin/plugin.json` — nessuna cartella `hooks/`,
   nessun campo `hooks` nel manifest, malgrado il flag.
3. **Validazione di un manifest mutato**, con `hooks`, `agents`, `commands` e una skill marcata
   `disable-model-invocation: true`: quattro rifiuti, citati verbatim in §3.3.
4. **Validazione del caso pulito**, con una sottocartella `skills/.contratti/` contenente un
   `SKILL.md` deliberatamente malformato: **passata**, a conferma che le cartelle col punto sono
   saltate dalla validazione.

5. **Banco di prova a due host.** Un pacchetto con manifest per entrambi, una skill, un comando,
   un subagent, un `hooks.json` e una cartella `contratti/` è stato validato da
   `claude plugin validate` **e** dal validatore Codex: **passano entrambi sullo stesso identico
   albero**. Poi è stato installato davvero su Codex e rimosso, e §3.4 riporta cosa ha fatto
   l'host.
6. **`codex features list`** ha chiuso la questione degli hook senza bisogno di una sessione.
7. **Banco sui subagent Codex**, il 19 settembre 2026 — l'unica prova che ha richiesto sessioni
   vere. Un repo vuoto, due ruoli in `.codex/agents/`, sei turni di `codex exec --json`: i quattro
   esiti sono in §3.6. Il modello è stato scelto a mano (`-m gpt-5.6-luna`) perché il `model` di
   `config.toml` resta non servibile, ed è la ragione per cui la prova mancante qui sotto non è
   più mancante.

L'ambiente è stato riportato allo stato iniziale: pacchetto e marketplace di prova rimossi,
`~/.codex/config.toml` senza una riga di residuo.

**Resta non provato**: interrogare una sessione Codex su quali skill vede. Non è più un ostacolo
tecnico — dal 19 settembre le sessioni si aprono passando il modello a mano — ma una risposta che
le skill di sistema danno già per iscritto (§3.5), e che non vale la quota.

Il `model` dichiarato in `config.toml` (`gpt-5.2`) **non è servibile da questo account**: una
sessione che parte con quello muore con `400 · The 'gpt-5.2' model is not supported when using
Codex with a ChatGPT account`. `codex debug models` elenca i validi — `gpt-5.5`, `gpt-5.6-luna`,
`gpt-5.6-sol`, `gpt-5.6-terra` — e finché quella riga resta lì va passato `-m` a ogni invocazione.

---

## 9. Quello che resta da verificare

Poco, e nulla di bloccante per decidere la disposizione.

| Da verificare | Perché conta | Come |
|---|---|---|
| quale `marketplace.json` vince su un repo che ne porta due | il banco ne aveva due e Codex ha letto il proprio (`.agents/plugins/`); non prova la precedenza, solo la convivenza | rimuoverne uno alla volta e reinstallare |
| se `skills/` annidate sono supportate da Claude Code | deciderebbe se conservare l'annidamento `deliver-feature/` invece di scioglierlo — **irrilevante se si scioglie comunque**, come già deciso | `claude plugin validate` su un albero annidato |
| se `rulesDir`/`contextDir` esistono in `plugin.json` di Claude Code | marcato incerto dalla ricerca; se non esistono, il livello Dominio passa per forza dai template — che è già la proposta | leggere lo schema, o provare e vedere se il validatore rifiuta |
| il comportamento di `${CLAUDE_PLUGIN_DATA}` fra aggiornamenti | serve solo se il metodo volesse memorizzare stato fra versioni; oggi non lo vuole | installare due versioni di fila |
