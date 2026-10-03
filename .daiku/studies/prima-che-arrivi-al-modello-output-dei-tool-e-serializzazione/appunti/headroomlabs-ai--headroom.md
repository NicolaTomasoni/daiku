# headroomlabs-ai/headroom — comprime output dei tool, log, file e chunk RAG prima che raggiungano il modello, con originale locale recuperabile

- **URL:** https://github.com/headroomlabs-ai/headroom
- **Licenza:** Apache-2.0
- **Ultimo commit:** 2026-10-03
- **Stelle:** 74329
- **Archivio:** no
- **Letto via:** api

## Cosa fa, e come lo fa

Headroom è un livello di compressione del contesto per agenti di coding. Si usa in quattro modi,
tutti dichiarati nel README e in `llms.txt`: una **libreria** (`from headroom import compress` in
Python, `import { compress } from 'headroom-ai'` in TypeScript); un **proxy** locale
(`headroom proxy --port 8787`, si punta `ANTHROPIC_BASE_URL`/`OPENAI_BASE_URL` lì e passa tutto);
un **server MCP** (`headroom_compress`, `headroom_retrieve`, `headroom_stats`); e un **wrap** di
agenti (`headroom wrap claude|codex|cursor|copilot|aider|opencode|…`, che avvia il proxy e riscrive
la configurazione dell'agente perché ci passi attraverso; `headroom unwrap` seguito dal nome dello
strumento disfa).

Il meccanismo è una pipeline a stadi, descritta in `docs/content/docs/how-compression-works.mdx`.
La **CacheAligner** è spenta di default ed è **solo un rilevatore**: ispeziona il prefisso e segnala
contenuto volatile che farebbe saltare la KV-cache del provider, ma **non riscrive mai i messaggi**
(`docs/content/docs/agent-orchestration.mdx`). Il **ContentRouter** rileva il tipo di contenuto e lo
instrada al riduttore giusto: JSON → SmartCrusher, codice → CodeCompressor (AST), log →
LogCompressor, risultati di ricerca `file:line:content` → SearchCompressor, diff unificati →
DiffCompressor, HTML, tabelle, config, prosa → Kompress-v2 (un modello HuggingFace addestrato su
tracce agentiche). I riduttori strutturali sono **algoritmi deterministici**, non un riassunto a
modello: SmartCrusher conserva al 100% gli elementi d'errore, tutte le anomalie oltre 2 deviazioni
standard, i primi e gli ultimi item e i punti di cambiamento, deduplica gli identici e prova prima una
piega *lossless* (ri-codifica tabellare ogni item) che scarta solo se non risparmia almeno il 30% dei
byte (`docs/content/docs/smart-crusher.mdx`).

Il pezzo caratteristico è **CCR (Compress-Cache-Retrieve)**: la compressione è reversibile. In
`docs/content/docs/ccr.mdx` l'originale è salvato localmente con chiave hash (di norma in un SQLite
`ccr_store.db` nella workspace, quindi sopravvive a un riavvio del proxy), al contenuto ridotto si
aggiunge un marker `[1000 items compressed to 20. Retrieve more: hash=abc123]`, nella richiesta viene
**iniettato un tool `headroom_retrieve`**, e quando il modello lo chiama l'originale è restituito e la
chiamata risolta in modo trasparente sul percorso proxy (il client non la vede). Il **Context
Management** (`docs/content/docs/context-management.mdx`) comprime **solo la live zone** — l'ultimo
messaggio utente e l'ultimo output di tool: «the cache hot zone — the system prompt, tool definitions,
and older turns — is never mutated», e «Headroom never drops messages».

Lo stato vive per intero fuori dal progetto: due radici canoniche sotto la home
(`HEADROOM_CONFIG_DIR` = `~/.headroom/config`, `HEADROOM_WORKSPACE_DIR` = `~/.headroom`) per config,
cache, memoria SQLite, telemetria, log e store CCR (`docs/content/docs/filesystem-contract.mdx`).
Alcuni percorsi sono però deliberatamente project-local (`.headroom/` relativo alla cwd) per la
memoria e per gli artefatti del wrap: è una scelta dichiarata, non una svista.

Due cose toccano il mestiere di sviluppo. **`headroom learn`** mina le sessioni passate: gli
*scanner* per agente (`headroom/learn/plugins/claude.py`, `codex.py`, `gemini.py`, `grok.py`,
`opencode.py`) leggono i log di sessione (`~/.claude/projects/*.jsonl` su Claude Code) e producono
`ToolCall` normalizzati; un *analyzer* LLM (`headroom/learn/analyzer.py`) correla ogni fallimento con
ciò che poi ha funzionato e ricava raccomandazioni; il *writer* (`headroom/learn/writer.py`) le
scrive in un blocco delimitato dalla coppia di marcatori di commento HTML `headroom:learn:start` /
`headroom:learn:end` dentro i file di contesto dell'agente (`CLAUDE.local.md` di default, `CLAUDE.md`,
`AGENTS.md`, `GEMINI.md`), idempotente e in dry-run salvo `--apply`. Il gemello
`headroom/managed_block.py` è la sede di due garanzie: `block_pattern` chiude il blocco al **primo**
marker di fine (non ingordo), e `sanitize_block_text` neutralizza i delimitatori di commento HTML in
apertura e in chiusura nel testo derivato dalla sessione, «so content can neither close our markers
nor hide itself». Un **plugin di avvio** (`plugins/headroom-agent-hooks/`) registra per Claude Code e
GitHub Copilot CLI un hook `SessionStart` (`startup|resume`) e un `PreToolUse` su ogni
`Bash|PowerShell` che chiama `headroom init hook ensure`, e l'`init` scrive nei file di configurazione
dell'host regioni delimitati da marker (`headroom/cli/init.py`: i marker di apertura e chiusura per
provider e per feature di Codex, più il marker dell'hook di Claude), registrando il valore precedente
per poterlo ripristinare.

Il repository è Python più Rust: il core di compressione (`crates/headroom-core/`) e il proxy
(`crates/headroom-proxy/`) sono Rust, l'orchestrazione e le integrazioni sono Python, con proxy HTTP,
dashboard, benchmark e documentazione ampia. Non è un pacchetto sottile: è un prodotto grosso con un
runtime che gira a parte.

## Asse A — Daiku lo fa già, e loro lo fanno meglio?

### A1 — Hook di un pacchetto: non agire da sé, non avviare un processo esterno a ogni gesto

- **In Daiku oggi:** `plugins/daiku/hooks/lib/` — sei hook **fail-open**, con banchi di prova che
  `plugins/daiku/hooks/self-check.mjs` lancia insieme; `plugins/daiku/hooks/README.md` dichiara che
  «they write nothing in the project» e che un hook **non esegue** un file perché è comparso;
  `lib/command-guard.mjs` nega gesti distruttivi, `ask-guard.mjs` tiene intera la lista delle
  domande, e il gate è `.daiku/project.json` (senza di esso le guardie non negano nulla).
- **Nel target:** `plugins/headroom-agent-hooks/hooks/hooks.json` registra
  `headroom init hook ensure` sia su `SessionStart` (`startup|resume`) sia su **ogni** `PreToolUse`
  con matcher `Bash|PowerShell`, con timeout 60; `headroom/cli/init.py` tiene la costante del timeout
  a 60 secondi apposta perché l'hook possa avviare a freddo un proxy. Il plugin non porta banchi di
  prova: nessuna verifica deterministica del proprio comportamento.
- **Chi vince:** daiku
- **Proposta:** niente, vince Daiku. Il contrasto conferma la scelta di Daiku (guardie che non
  eseguono codice e che si provano a banco), non porta nulla da importare.

### A2 — Forma della radice pubblicata: il repository pubblicato *è* la vetrina

- **In Daiku oggi:** `plugins/` è per intero la radice del repository pubblico; la vetrina
  `plugins/.claude-plugin/marketplace.json` punta a `./daiku` e `plugins/.agents/plugins/marketplace.json`
  è la seconda; si copia tutta e sola la cartella del prodotto, quindi chi aggiunge il marketplace
  clona solo il pacchetto.
- **Nel target:** `.claude-plugin/marketplace.json` sta nella **radice** del repository di prodotto e
  punta a `"source": "./plugins/headroom-agent-hooks"`; ma la radice porta anche l'intero prodotto —
  `crates/` (Rust), `headroom/` (Python), `docs/`, benchmark e GIF pesanti. Chi aggiunge il
  marketplace per un plugin di soli hook clona tutto questo.
- **Chi vince:** daiku
- **Proposta:** niente, vince Daiku. È la stessa lezione che la memoria `si-pubblica-solo-il-prodotto`
  registra: il repo *è* l'artefatto consegnato, e la radice pubblicata non deve contenere ciò che il
  plugin non è.

### A3 — Seam di estensione opt-in e dispatch fail-open

- **In Daiku oggi:** tutti gli hook di `plugins/daiku/hooks/lib/` sono fail-open davanti a un guasto;
  l'unico ramo che nasce **spento** e dipende da una chiave del progetto è il pool dei worktree, con
  `{worktree.pool}` in `.daiku/project.json`; il resto delle guardie è determinato dalla presenza di
  `.daiku/project.json`.
- **Nel target:** `headroom/pipeline.py` — `discover_pipeline_extensions` carica solo le estensioni
  nominate dall'operatore (variabile d'ambiente `HEADROOM_PIPELINE_EXTENSIONS`), con la motivazione
  scritta: «Merely installing a package — as a transitive dependency, say — must not silently start
  rewriting requests»; e il dispatch delle estensioni cattura l'eccezione e continua, preservando il
  comportamento fail-open. `headroom/hooks.py` mantiene i quattro hook di pipeline
  (`pre_compress`, `compute_biases`, `protect_messages`, `post_compress`) con default no-op.
- **Chi vince:** pari
- **Proposta:** niente. È lo stesso principio di Daiku, in un runtime diverso: non porta un meccanismo
  nuovo, ma è la prova che la scelta di Daiku regge anche in un prodotto di questa taglia.

### A4 — Scritture reversibili nei file della macchina: regioni a marker e valore precedente registrato

- **In Daiku oggi:** `plugins/daiku/skills/init/SKILL.md` tocca file che non ha scritto —
  `.claude/settings.local.json` (§7, due chiavi), `.vscode/tasks.json` (§5-bis, un task), `.gitignore`
  (§8, righe aggiunte) — **solo per aggiunta**, e non registra da nessuna parte ciò che c'era prima,
  così una disinstallazione lascia le tracce. Sul file di istruzioni l'unico ritorno è il `git stash`
  della §6, e il file nuovo porta in fondo un marker di rivendicazione (quello chiamato
  `daiku:instructions` in `templates/project/instructions.md`).
- **Nel target:** `headroom/managed_block.py` definisce il blocco gestito: due marker HTML, match al
  **primo** marker di fine, e `sanitize_block_text` che impedisce a contenuto generato di chiudere il
  blocco o di nascondersi; `headroom/learn/writer.py` lo scrive nei file di contesto dell'agente,
  sostituendo **solo** il contenuto fra i marker a ogni riesecuzione; `headroom/cli/init.py` scrive
  regioni a marker anche nei file di configurazione dell'host; `headroom/providers/claude/install.py`
  registra una mutazione gestita con i valori precedenti e li ripristina in `revert_provider_scope`,
  perché «the install env is headroom-managed and reverted on uninstall».
- **Chi vince:** target
- **Proposta:** portare le due tecniche dove Daiku già scrive dentro file che non ha scritto. (a) Un
  **sanitizzatore + blocco a marker dal primo token di fine** per qualunque contenuto generato che una
  skill depositi nel file di istruzioni o in memoria: atterra come regola in
  `plugins/daiku/contracts/project-contract.md` più un piccolo modulo con banco accanto a
  `plugins/daiku/architect/` (non come hook: un hook non deve trasformare file). (b) La
  **registrazione del valore precedente** per le aggiunte di `init` a `.claude/settings.local.json` e
  `.vscode/tasks.json`, con un comando `daiku: remove` che le ripristina: atterra in
  `plugins/daiku/skills/init/SKILL.md` e nel task sotto `templates/`. Costo: medio; il pezzo (a) vale
  di più quanto più Daiku genererà contenuto (vedi B3), il pezzo (b) è piccolo e chiude una asimmetria
  già oggi.

## Asse B — Daiku non lo fa, e si potrebbe aggiungere?

### B1 — Riduzione reversibile dell'output con recupero su richiesta

- **Capacità:** Daiku non ha alcun modo di ridurre ciò che un passo carica in contesto. Passa lo
  **stato by path** — ledger, elenchi, artefatti — e non lo ricopia nel prompt, ma il passo che apre
  quel path lo legge **intero**: un diff enorme, un log, un esito di gate, un output di ricerca
  entrano in contesto per intero. Non esiste una vista ridotta, né un modo di recuperare l'originale
  dopo averne visto solo una parte.
- **Nel target:** `docs/content/docs/ccr.mdx` e `headroom/cache/compression_store.py` — l'originale è
  salvato locale per hash, al modello arriva un marker con l'hash e un tool `headroom_retrieve`
  iniettato; `headroom/ccr/response_handler.py` risolve la chiamata in modo trasparente. La stessa
  logica è esposta via MCP (`docs/content/docs/mcp.mdx`): `headroom_compress` restituisce `compressed`
  + `hash`, `headroom_retrieve` ripesca l'originale (locale, 1 ora), con ricerca `query` dentro
  l'originale.
- **Proposta:** una feature "vista ridotta con originale recuperabile" per i passi che leggono
  artefatti grandi. Cosa fa: quando il perimetro di un passo include un artefatto grande, il contratto
  di delega passa una **vista ridotta deterministica** — non un riassunto libero — accanto al path
  dell'artefatto integro, che resta la fonte recuperabile; il passo può chiedere l'originale o una sua
  parte invece di tenerlo tutto in contesto. Dove atterrerebbe: la regola di delega in
  `plugins/daiku/contracts/orchestration.md` §4, e il programma che produce e verifica la vista accanto
  a `plugins/daiku/architect/ledger.mjs` e `pool.mjs` (dove già vivono i lati disco deterministici),
  col suo banco in `plugins/daiku/hooks/self-check.mjs`. Gli originali devono stare **fuori dal
  progetto**, come già deciso per le feature che toccano il contesto. Costo: alto — è codice eseguito
  nuovo e tocca il contratto di metodo. Rischio: divergenza fra vista e originale, e tensione col
  principio "chi legge in pieno non sbaglia"; per questo la vista dev'essere deterministica e
  l'originale sempre recuperabile, mai un riassunto a modello.

### B2 — Policy di conservazione deterministica quando si riduce

- **Capacità:** Daiku non ha alcuna policy di riduzione, perché non riduce nulla; se adottasse B1
  avrebbe bisogno di sapere *cosa* non si può perdere. Oggi non lo dichiara da nessuna parte.
- **Nel target:** `docs/content/docs/smart-crusher.mdx` — conserva al 100% gli elementi d'errore,
  tutte le anomalie oltre 2 deviazioni standard, primi e ultimi item, i punti di cambiamento,
  deduplica gli identici, e prova prima una piega lossless (ri-codifica tabellare) scartando solo se
  non risparmia almeno il 30% dei byte; `docs/content/docs/how-compression-works.mdx` dà la tabella
  "Structure Preservation" per tipo (JSON: chiavi, parentesi, UUID; codice: import e firme; log:
  timestamp, livelli, stack trace). La scelta è statistica, non una lista di parole chiave.
- **Proposta:** la policy di conservazione come parte **dichiarata** della feature B1 — errori sempre,
  anomalie statistiche, primi/ultimi, punti di cambiamento, dedup degli identici — scritta dove
  atterra il programma (una costante nel modulo e la sua tabella nel banco), con un caso di banco per
  ciascuna regola. Costo: basso se B1 si fa, nullo da solo (senza un riduttore non c'è dove
  applicarla); la si propone come vincolo di B1, non come feature separata. Rischio: basso — è
  deterministica e verificabile a banco.

### B3 — Miniera dei fallimenti che propone correzioni

- **Capacità:** Daiku allinea memoria e documenti al **diff** (`update-memory` invocato da `commit`) e
  tiene il ledger dei giri di review; ma non guarda mai le **sessioni fallite** per ricavarne una
  correzione comportamentale. Una review chiusa con oscillazione o `rounds-exhausted` non lascia nulla
  oltre al suo report, e il contratto di memoria prevede già il tipo `feedback` («corrections and
  confirmed approaches, always with the reason») senza che nessuno lo produca dalle sessioni.
- **Nel target:** `headroom/learn/` — `plugins/claude.py` legge i log JSONL di sessione; `analyzer.py`
  correla fallimento → ciò che ha poi funzionato (es. «`FirstClassEntity` is at `axion-scala-common/`,
  not `axion-formats/`») e rileva anche i **loop** senza errori; `writer.py` scrive un blocco a marker
  dentro `CLAUDE.local.md`/`CLAUDE.md`/`AGENTS.md`/`MEMORY.md`, passando il testo per
  `sanitize_block_text`, in dry-run salvo `--apply`, con un ciclo di vita per item (`pattern-id`,
  `active_item_ids`) che fa scadere le voci vecchie.
- **Proposta:** una feature "lezione dalle sessioni" — un passo interno analizza le sessioni passate
  (o il ledger e i report dei giri chiusi male) e **propone** all'owner una correzione da depositare
  come memoria `feedback`, non la scrive da sé. Dove atterrerebbe: una sorgente in più per
  `plugins/daiku/skills/update-memory/SKILL.md`, o un contratto interno nuovo letto da `commit`; la
  proposta passa per `confirm_with_owner`, e l'artefatto atterra in `{memory.root}` (o `.daiku/policies/`).
  Costo: medio-alto. Rischio: rumore in memoria e scrittura non voluta nel progetto; per il confine di
  Daiku («nessun pacchetto scrive nel progetto») la scrittura dev'essere un comando che l'owner lancia,
  mai un effetto automatico — ed è esattamente il punto su cui `headroom learn` diverge, perché lì il
  blocco finisce nel file di istruzioni del progetto da sé.

## Evidenza

| path nel target | estratto |
|---|---|
| `README.md` | «Compress tool outputs, logs, files, and RAG chunks before they reach the LLM»; «Library, proxy, MCP server, Agent wrap» |
| `llms.txt` | «per-content-type compressors … feed into a Compress-Cache-Retrieve (CCR) store so compression stays reversible» |
| `docs/content/docs/how-compression-works.mdx` | ContentRouter per tipo (JSON, codice, log, ricerca, diff, HTML, tabelle, config, prosa); CacheAligner «never rewrites your messages» |
| `docs/content/docs/smart-crusher.mdx` | conserva errori 100%, anomalie oltre 2 deviazioni standard, primi/ultimi, change points; piega lossless se risparmia almeno il 30% |
| `docs/content/docs/ccr.mdx` | «the original data is cached locally»; marker con `hash`; tool `headroom_retrieve` iniettato; store SQLite `ccr_store.db` |
| `docs/content/docs/context-management.mdx` | «the cache hot zone … is never mutated»; «Headroom never drops messages»; solo live-zone |
| `docs/content/docs/filesystem-contract.mdx` | due radici `~/.headroom/config` e `~/.headroom`; percorsi `.headroom/` project-local intenzionali |
| `docs/content/docs/mcp.mdx` | `headroom_compress` → `compressed`+`hash`; `headroom_retrieve` con `query`; originale locale 1h |
| `docs/content/docs/failure-learning.mdx` | «correlates each failure with what eventually worked»; destinazioni `CLAUDE.local.md` (default, gitignored) / `CLAUDE.md` / `AGENTS.md` / `MEMORY.md` |
| `headroom/managed_block.py` | `sanitize_block_text` neutralizza i delimitatori di commento HTML; `block_pattern` «start marker to the **nearest** end marker» |
| `headroom/learn/writer.py` | coppia di marker `headroom:learn:start` / `end`; merge idempotente con `pattern-id` e `active_item_ids` |
| `headroom/learn/analyzer.py` | pipeline «Scanner (events) → Digest Builder → LLM → Recommendations»; rilevamento dei loop |
| `headroom/learn/plugins/claude.py` | scanner dei log di sessione Claude Code (re-export in `headroom/learn/scanner.py`) |
| `headroom/cli/init.py` | marker di apertura/chiusura per provider e feature di Codex e marker dell'hook Claude; timeout dell'hook a 60 secondi |
| `headroom/providers/claude/install.py` | mutazione gestita con i valori precedenti; `revert_provider_scope`; «headroom-managed and reverted on uninstall» |
| `headroom/pipeline.py` | estensioni opt-in: «must not silently start rewriting requests»; dispatch fail-open |
| `headroom/hooks.py` | quattro hook di pipeline, default no-op (`pre_compress`, `compute_biases`, `protect_messages`, `post_compress`) |
| `plugins/headroom-agent-hooks/hooks/hooks.json` | `SessionStart` (`startup\|resume`) e `PreToolUse` `Bash\|PowerShell` → `headroom init hook ensure`, timeout 60 |
| `plugins/headroom-agent-hooks/.claude-plugin/plugin.json` | manifest Claude Code, senza campo `hooks` |
| `plugins/headroom-agent-hooks/.github/plugin/plugin.json` | manifest GitHub Copilot CLI, con `"hooks": "./hooks"` |
| `.claude-plugin/marketplace.json` | `"source": "./plugins/headroom-agent-hooks"`, nella radice del repo di prodotto |

## Domande aperte

- **Il core della compressione non è stato letto riga per riga.** Ho letto i contratti di pipeline, le
  firme e la documentazione, ma non gli algoritmi: `crates/headroom-core/src/transforms/*`
  (SmartCrusher, CodeCompressor, LogCompressor, DiffCompressor, Kompress) e gli handler del proxy
  (`headroom/proxy/handlers/anthropic.py`, `openai.py` — centinaia di KB) non sono stati aperti. Il
  giudizio sul *come* comprimono poggia sui loro documenti e sulle firme, non sul codice.
- **Cifre di risparmio non verificate.** I numeri (20% in media sui coding agent, 57% sul caso SRE,
  60-95% sul JSON, ecc.) sono dichiarazioni del target, non misurate qui: non ho eseguito nulla, come
  da divieto.
- **Costo di esercizio non valutato.** Il prodotto richiede un runtime Rust/Python, un proxy o un
  server MCP vivi, e `headroom wrap` riscrive la configurazione dell'agente; Daiku è testo più hook
  Node. Quanto di questo sia riducibile a una feature *leggibile, eseguibile e sotto banco* dentro il
  metodo di Daiku resta la domanda vera e non è decidibile da questo appunto.
- **`headroom learn` scrive nel progetto.** Il blocco di correzioni finisce in `CLAUDE.md`/`AGENTS.md`
  del progetto: è in tensione diretta col confine di Daiku («nessun pacchetto scrive nel progetto»), e
  non ho verificato dal codice se la scrittura sia solo su comando dell'owner o anche automatica.
- **Il target non espone banchi di prova sul proprio plugin di hook.** Non ho trovato, nell'albero,
  una verifica deterministica di `plugins/headroom-agent-hooks/`: se esista altrove (CI) non è emerso
  dalla lettura.
- **Non ho potuto decidere la sede d'atterraggio di B1/B3.** Entrambe toccano il contratto di metodo
  (`contracts/orchestration.md` §3 dice che i dieci entry point non crescono da soli): se diventino
  contratti interni o entry point è una decisione dell'owner, non una conseguenza dell'appunto.
