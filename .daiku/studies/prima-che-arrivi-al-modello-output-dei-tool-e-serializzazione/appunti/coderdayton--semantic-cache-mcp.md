# CoderDayton/semantic-cache-mcp — server MCP che mette ogni operazione sui file dietro una cache, così una rilettura costa pochi token invece del file intero

- **URL:** https://github.com/CoderDayton/semantic-cache-mcp
- **Licenza:** MIT
- **Ultimo commit:** 2026-09-02
- **Stelle:** 2
- **Archivio:** no
- **Letto via:** api

## Cosa fa, e come lo fa

È un **server MCP in Python** (FastMCP 4.0+, Python 3.12+) che si installa come `mcpServer` di Claude Code e
prende il posto degli strumenti nativi di I/O: quattordici tool (`read`, `read_image`, `batch_read`,
`warm`, `write`, `edit`, `edit_preview`, `batch_edit`, `search`, `grep`, `glob`, `delete`, `clear`,
`stats`) girano sopra un'unica cache di file. Il README chiede esplicitamente all'utente di negare nelle
permission i tool nativi `Read/Edit/Write` e di scrivere in `CLAUDE.md` che non si usano. Il valore
dichiarato è ~98% di token risparmiati sulle riletture già in cache, con risposte in millisecondi.

**Dove vive lo stato.** In un piccolo SQLite **vendorizzato** con FTS5 (`storage/docstore/`), sotto la
cartella cache di piattaforma (`SEMANTIC_CACHE_DIR` per sovrascriverla). I file stanno come righe
`Document`: sotto gli 8 KB un documento unico col testo intero; da 8 KB in su un documento padre
senza testo più **chunk content-defined** (HyperCDC a finestra Gear, `core/chunking/`) come figli. Ogni
metadato porta `content_hash` (BLAKE3, consegnato sul filo come **primi 16 caratteri esadecimali**,
`core/hashing/_wire.py`), `mtime`, `tokens` (BPE o200k_base), `access_history`; l'eviction è
**W-TinyLFU** quando si superano `MAX_CACHE_ENTRIES`. Un secondo SQLite (`storage/sqlite.py`) tiene solo
le metriche di sessione. Il codice è Python e i programmi che contano sono `core/` (algoritmi puri),
`cache/` (orchestrazione) e `server/` (traduzione MCP): non esiste un `architect/` come in Daiku.

**Chi muove lo stato.** Il **client**, restituendo gli hash. Il meccanismo centrale è la *possession
gate*: una risposta `unchanged` non è mai dedotta dallo stato del server, ma solo da un `known_hash`
che il chiamante rimanda. «A warm cache proves the *server* holds the file, never that you do — the
store is on disk and outlives the process, the session, and your context window.» Dopo una compaction
basta omettere gli hash e si riceve di nuovo tutto. Una lettura a finestre (`offset`/`limit`) non vale
come prova del file, ma della finestra: restituisce un `coverage_token` firmato con una chiave
per-processo mai persistita (`server/_coverage.py`), che il chiamante rimanda e accumula — la copertura
viaggia **nel token del chiamante**, mai in stato del server, «Server-side accumulation would let a
compaction between two windows go unnoticed and certify possession of bytes the caller had already
dropped».

**Cosa impone.** Una politica di forma del filo, accesa per default (`config.py`): `TOOL_OUTPUT_MODE=compact`
toglie `ok`/`tool` dal payload; `TOOL_MAX_RESPONSE_TOKENS` (0 = spento) tronca con degradazione;
**`SCMCP_PUBLISH_OUTPUT_SCHEMA=false`** non annuncia gli output schema in `tools/list` — il README dice
che erano «11.5k of this server's 19.8k advertised tokens, paid on every request»; un middleware
(`server/_single_representation.py`) toglie il `structuredContent` duplicato, «measured at 8.8k + 8.9k
tokens for one 584-line file». E tre modi di non rimandare il file: **diff** unificato per il
cambiamento, **summary** semantico (TCRA-LLM, `core/text/_summarize.py`, con ancore `// L120-170`) per
l'over-size, **outline** (una riga per definizione, nel formato line:signature, da `core/text/_outline.py`)
come prima lettura economica di un file grande.

## Asse A — Daiku lo fa già, e loro lo fanno meglio?

Nessuna.

## Asse B — Daiku non lo fa, e si potrebbe aggiungere?

### B1 — Un payload limitato che dichiara di essere stato tagliato

- **Capacità:** Daiku non ha nessun tetto sulla dimensione di ciò che un passo consegna al chiamante.
  I contratti dicono «una riga» per `gate_detail`, ma è prosa: l'output grezzo della suite che il
  subagente della porta legge, il file dei findings e la lista `to_confirm` non hanno limite, e non
  esiste una forma che degradi tenendo gli scalari e **dichiarando** il taglio.
- **Nel target:** `TOOL_MAX_RESPONSE_TOKENS` più `_minimal_payload()` in `server/response.py`: una
  `keep_order` di chiavi (`ok`, `status`, `path`, `total_matches`, `complete`, `reason`…) resta, le
  righe dei match spariscono, e il payload porta `truncated: true`. Se anche il rifit sfora, si scende
  alla forma nuda invece di superare il tetto. `_fit_grep_files()` tiene il **prefisso che entra**
  invece di buttare tutto: «Dropping every match was a net token *loss*: the caller learns a count it
  cannot act on and runs the same grep again.»
- **Proposta:** una regola in `plugins/daiku/contracts/orchestration.md` §4.2 (*Return by contract*) e
  in `plugins/daiku/skills/review/SKILL.md` § *Gate* e `plugins/daiku/skills/execute/SKILL.md`: il
  blocco di un passo ha un tetto dichiarato e una forma degradata — gli scalari che dicono cosa è
  successo, capo e coda limitati, un campo `truncated`, e il **path del log intero** depositato nella
  sede del giro, così il dettaglio resta raggiungibile. Sede deterministica (per la regola «mai fidarsi
  di un LLM»): far catturare e misurare l'output a un programma di `plugins/daiku/architect/`, col suo
  banco. Costo: una frase in due contratti e un campo; se lo si rende deterministico, un programma
  nuovo più banco.

### B2 — Il diff che arriva ai finder è esso stesso un costo, e si può sagomare

- **Capacità:** Daiku passa un base-ref e i finder/applier calcolano `git diff` da soli
  (`plugins/daiku/skills/finder-prompt/SKILL.md` regola 3: `git diff` fra i due alberi, delimitato dai
  campi from, to e files). Nessun contratto dice quanta larghezza di contesto quel diff porti, né che
  le righe di intestazione dei file sono puro costo: ogni token del diff entra nel contesto dei finder,
  che girano a ogni round.
- **Nel target:** contesto **adattivo** — i file sotto le 100 righe usano 2 righe di contesto invece
  di 3, «where the extra line is a large share of a small payload» — e rimozione delle intestazioni di
  `difflib` perché «the path is known from the response envelope and the `@@` hunk headers carry the
  line numbers, so the headers are pure token overhead on every diff» (`core/text/_diff.py`).
- **Proposta:** `plugins/daiku/skills/review/SKILL.md` (§ *Scope*) e
  `plugins/daiku/skills/finder-prompt/SKILL.md`: il diff consegnato ai finder è calcolato con `-U2`
  per i file sotto le 100 righe e `-U3` sopra, senza intestazioni di file, con l'hunk header `@@`
  conservato perché porta i numeri di riga. Costo: una frase in due contratti, nessun programma, nessun
  banco (è una scelta di forma, non un divieto).

### B3 — Misurare il costo fisso per sessione che il pacchetto inietta

- **Capacità:** Daiku non misura quanto del contesto di ogni sessione occupano le sue stesse
  descrizioni di skill e i suoi testi iniettati (l'avviso di `SessionStart`, i frontmatter, i pointer).
  L'osservazione più sorprendente del target è che il costo **pubblicizzato a ogni richiesta** batte
  quello per chiamata: gli output schema erano 11.5k dei 19.8k token annunciati e sono spenti per
  default; il `structuredContent` che duplica il text block viene rimosso perché «a client that
  forwards both charges the model twice for every file».
- **Nel target:** `resolve_output_policy()` in `config.py` accende `STRUCTURED_CONTENT` quando si
  pubblicano gli schema («MCP requires `structuredContent` from any tool that declares an output
  schema»), e `_single_representation.py` toglie il duplicato.
- **Proposta:** una regola e un banco in `.docs/tools/check-corpus.mjs` che misurino le descrizioni
  delle 21 skill e i testi iniettati dal pacchetto, rifiutando la crescita oltre una soglia — accanto
  ai controlli che già girano prima di un rilascio. La stessa misura come invariante di prodotto, se si
  vuole che viaggi col pacchetto, accanto a `plugins/daiku/hooks/self-check.mjs`. Costo: una regola con
  il suo banco; è lavoro di cantiere finché non lo si promuove, ma il numero è già oggi non guardato da
  nessuno.

## Evidenza

| path nel target | estratto |
|---|---|
| `README.md` | «A warm cache proves the *server* holds the file, never that you do»; «after a compaction, omit the hashes and get your files back in full» |
| `README.md` | le righe di grep nel formato line:testo, «measured at 37% fewer tokens than the per-match objects it replaced, and `glob` at 50%. `output="count"` turns a 2.6k-token answer into 77» |
| `README.md` | schema annunciati «11.5k of this server's 19.8k advertised tokens, paid on every request» |
| `src/semantic_cache_mcp/config.py` | `resolve_output_policy()`, `SCMCP_PUBLISH_OUTPUT_SCHEMA` / `SCMCP_STRUCTURED_CONTENT`, `TOOL_OUTPUT_MODE=compact`; commento: «they are not published by default» |
| `src/semantic_cache_mcp/server/_single_representation.py` | «measured at 8.8k + 8.9k tokens for one 584-line file»; toglie `structuredContent` |
| `src/semantic_cache_mcp/server/response.py` | `_minimal_payload()` con `keep_order` e `truncated`; `_fit_grep_files()` «Dropping every match was a net token *loss*» |
| `src/semantic_cache_mcp/server/_coverage.py` | «Coverage is carried by the caller, never tracked server-side»; token firmato, chiave per-processo mai persistita |
| `src/semantic_cache_mcp/core/text/_outline.py` | «it is a map, and a map is never redeemable as possession» |
| `src/semantic_cache_mcp/core/text/_summarize.py` | TCRA-LLM, segmenti per posizione/densità/diversità, ancore `// L120-170` |
| `src/semantic_cache_mcp/core/text/_diff.py` | «Drop difflib's boilerplate file headers … the headers are pure token overhead on every diff» |
| `docs/architecture.md` | docstore SQLite+FTS5 vendorizzato, W-TinyLFU, chunk content-defined (documento padre e figli oltre 8 KB) |
| `scripts/agentic_workflow.py` | «once carrying every hash forward, once discarding them … reports the difference in tokens actually delivered» |

## Domande aperte

- Il «~98%» è **dichiarato dal progetto** con una sua metodologia (41 file di sorgente, 212k token) e
  non verificato qui: nessun tool del target è stato eseguito, come da divieto.
- Non letti per intero, quindi esclusi dal giudizio: `src/semantic_cache_mcp/server/tools/__init__.py`
  (≈132 KB, letto solo per le righe sulla serializzazione), i ≈60 file di `tests/`, `cache/read.py` e
  `cache/write.py`, `storage/docstore/*`, `docs/security.md`, `docs/performance.md`,
  `docs/advanced-usage.md`, `docs/env_variables.md`, `CONTRIBUTING.md`, `CHANGELOG.md`. Di
  `core/text/_outline.py`, `core/text/_summarize.py` e `server/_coverage.py` ho letto le testate (i
  docstring e le strutture), non la totalità: le affermazioni su di essi si reggono su quelle.
- L'Asse A è vuoto perché Daiku è un pacchetto di metodo e orchestrazione e **non possiede** né un
  livello di I/O dei file né un transport: il principio che più si avvicina — non mandare due volte
  gli stessi byte, e dire cosa non si è visto — Daiku lo porta già sotto altri nomi
  (`plugins/daiku/contracts/orchestration.md` §4.2: lo schema si cita, non si ricopia; l'avviso che
  tace su ciò che non vede farebbe credere che lo copra). Per la regola dell'asse, la cosa che Daiku
  ha già sotto un altro nome non è un Asse A.
