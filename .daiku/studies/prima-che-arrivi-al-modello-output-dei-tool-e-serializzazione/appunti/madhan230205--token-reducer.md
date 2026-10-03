# Madhan230205/token-reducer — plugin Claude Code locale che comprime il contesto prima del modello: RAG ibrido BM25 + vettori, chunking AST e pacchetti di contesto, senza API

- **URL:** https://github.com/Madhan230205/token-reducer
- **Licenza:** MIT
- **Ultimo commit:** 2026-05-01
- **Stelle:** 48
- **Archivio:** no
- **Letto via:** api

## Cosa fa, e come lo fa

Dal punto di vista di chi lo usa: si installa come plugin di Claude Code
(`/plugin marketplace add Madhan230205/token-reducer` poi `/plugin install`), oppure si clona e si
chiama la CLI a mano. Poi si lancia il comando `/token-reducer` col suo segnaposto di obiettivo —
o direttamente il comando `run` della CLI, con `--inputs` per i path e `--query` per la domanda — e
si riceve un
**pacchetto di contesto** (`CONTEXT_PACKET_START … CONTEXT_PACKET_END`) con poche citazioni
compresse invece del testo grezzo dei file. La promessa è «compressione locale e senza API»: tutto
gira sulla macchina, nessuna chiamata di rete; `requirements-optional.txt` aggiunge solo, se
presenti, embeddings neurali e tree-sitter, e senza di essi il pipeline degrada a embedding hash e
chunking regex.

Il meccanismo. Lo **stato vive in SQLite**, nel file `index.db` della cartella del database: le tabelle `documents`, `chunks` e
l'indice virtuale `chunks_fts` (FTS5), più `chunk_embeddings`, `query_embeddings`, `query_cache`,
`symbol_index` e `file_dependencies` (`scripts/token_reducer/db.py`). **Chi lo muove** è la CLI
`scripts/token_reducer/cli.py`, con i comandi `index`, `query`, `run`, `compress-raw`, `benchmark`:
`run` chiama `index_corpus` e poi `scripts/token_reducer/pipeline.py::run_retrieval_pipeline`, che
fa FTS5/BM25 dapprima (`retriever.py::fts_retrieve`), poi il vettore solo come fallback adattivo
(`infer_retrieval_tier`, soglie 200/2000 chunk: `fts_only` / `fts_with_hash` / `full_hybrid`),
fonde con Reciprocal Rank Fusion (`reciprocal_rank_fusion`), ritaglia i top-k e comprime con
`scripts/token_reducer/compressor.py` (TextRank per la prosa, estrazione di firme e docstring per
il codice, e un *relevance floor* che interrompe il riempimento appena il punteggio scende sotto
soglia). Il chunking è AST quando tree-sitter c'è (`chunker.py::_TREE_SITTER_LANGUAGES`,
`_extract_ast_chunks`), altrimenti regex. Accanto c'è un'aggiunta Rust opzionale
(`src/lib.rs`, pyo3) che rifà in nativo `estimate_tokens`, `tokenize`, `char_ngrams` e
`chunk_text` con la stessa semantica del Python.

**Cosa lo impone** — ed è il punto che riguarda questa studio — è un solo hook,
`hooks/userprompt_guard.py`, cablato in `hooks/hooks.json` su `UserPromptSubmit`. Il suo intento
dichiarato è «Zero-Turn Auto-Compression — intercept before LLM sees the prompt»: se il prompt
supera 800 parole lo passa a `compress-raw` via `subprocess`, e riscrive il risultato in
`result["transformedPrompt"]`; oltre 3000 parole risponde con `result["rejectInput"] = True`; in
caso di guasto tronca a `prompt.split()[:800]`. Conta anche i turni (`prompt_guard_state.json`) e
suggerisce `/compact` o una chat nuova.

**Il difetto.** `transformedPrompt` e `rejectInput` **non sono campi di output che Claude Code
accetta su `UserPromptSubmit`**: l'host su quell'evento sa bloccare con `decision: "block"` e
iniettare con `hookSpecificOutput.additionalContext`, ma **non sa sostituire il prompt** («can't
replace the prompt; it only injects additionalContext alongside it»). Quindi la compressione «prima
che il modello veda» non avviene come scritto: l'unico campo valido che il target emette è
`systemMessage`, che è **rivolto all'utente**, non al modello. La compressione vera, in pratica,
gira solo quando è l'utente a lanciare il comando o la CLI. Il target non tocca mai l'output dei
tool: nessun uso di `updatedToolOutput`.

## Asse A — Daiku lo fa già, e loro lo fanno meglio?

### A1 — Avvisi al modello iniettati da un hook, prima che lavori

- **In Daiku oggi:** `plugins/daiku/hooks/lib/session-advice.mjs` (SessionStart),
  `run-advice.mjs` (UserPromptSubmit e PreToolUse sulle scritture),
  `contracts-post-edit.mjs` (PostToolUse) e `stop-advice.mjs` (Stop): tutti emettono
  `hookSpecificOutput.additionalContext`, cioè parlano **al modello**, e ognuno decide cosa dire
  guardando il disco (lavoro lasciato a metà, ledger di review aperti), non contando i turni.
- **Nel target:** `hooks/userprompt_guard.py` emette `systemMessage` (campo **per l'utente**) e
  tenta `transformedPrompt`/`rejectInput`, campi che l'host non accetta su quell'evento; non usa
  mai `additionalContext`. La sua logica è un contatore di turni con soglie fisse
  (`promptGuard.autoCompactTurn`, `reminderTurns`) lette da `settings.json`.
- **Chi vince:** daiku
- **Proposta:** niente, vince Daiku — e il target serve semmai da contro-esempio: i campi di output
  di un hook sono specifici dell'evento e dell'host, e sbagliarli produce un hook che «passa» in
  silenzio senza fare ciò che dichiara.

### A2 — I valori tunabili tenuti fuori dai file di comportamento

- **In Daiku oggi:** `plugins/daiku/contracts/orchestration.md` §7 e
  `plugins/daiku/contracts/project-contract.md` §5–§6: i valori si risolvono per **progetto** da
  `.daiku/environment.json` (con override `.daiku/environment.local.json`), e una chiave assente
  degrada invece di rompere.
- **Nel target:** `settings.json`, letto a runtime da
  `scripts/token_reducer/plugin_settings.py` cercando `CLAUDE_PLUGIN_ROOT/settings.json` o la
  radice del checkout; quaranta e più chiavi sotto `tokenReducer`, ma **per installazione**, non
  per progetto, e con default sparsi anche in `config.py`.
- **Chi vince:** pari
- **Proposta:** niente. Daiku è più forte sul per-progetto e sulla degradazione; il target non
  offre nulla in più su questo fronte.

## Asse B — Daiku non lo fa, e si potrebbe aggiungere?

### B1 — Ridurre l'output di un tool prima che raggiunga il modello (`updatedToolOutput`)

- **Capacità:** Daiku sa **iniettare** contesto (`additionalContext`) ma non ha nessun meccanismo
  che riduca o riscriva il **risultato di un tool**: l'output grezzo di `Read`/`Bash`/`Grep` entra
  nel contesto così com'è. L'host invece lo permette: su `PostToolUse`,
  `hookSpecificOutput.updatedToolOutput` **sostituisce** il risultato del tool. Daiku non lo usa
  (nessun `updatedToolOutput` nei suoi hook) — ed è esattamente il tema di questo studio.
- **Nel target:** il proposto è «comprimere prima che il modello veda» (README: «Cut Claude token
  usage by 90%+», `userprompt_guard.py`), ma lo aggancia a `UserPromptSubmit` con campi che l'host
  non ha, quindi non avviene; e non tocca mai gli output dei tool. Il pezzo riusabile non è la sua
  integrazione (sbagliata), ma il **motore di compressione locale** che sta dietro:
  `compressor.py::extract_code_signatures` (firme e docstring per il codice),
  `textrank_score_sentences` (per la prosa) e il *relevance floor* che interrompe la raccolta
  invece di riempire fino al budget.
- **Proposta:** un hook `PostToolUse` nuovo in `plugins/daiku/hooks/lib/` (es. `tool-output-shaper.mjs`)
  che, quando il risultato di un tool di lettura supera una soglia, lo sostituisca con un estratto
  **deterministico** (firme/docstring o prime N righe, come fa `compressor.py`) **più il rimando a
  una copia integrale scritta fuori dal progetto** — nella cartella scratch di sessione, dove già
  scrivono `run-advice`/`stop-advice` — così nulla è perso. Mai troncamento cieco. Atterra in:
  `hooks/lib/` (nuovo modulo), una riga di `PostToolUse` in `hooks/hooks.json`, una riga nella
  tabella di `hooks/README.md`, un caso nel banco di `hooks/self-check.mjs`; la soglia dichiarata in
  `.daiku/project.json` se la si vuole per-progetto. Costo: medio; il rischio è la perdita di
  informazione, per cui la copia recuperabile è obbligatoria. Solo Claude Code: il template Codex
  non cabla `PostToolUse`.

### B2 — Un tetto dichiarato al prompt grezzo, con instradamento invece che troncamento

- **Capacità:** Daiku non guarda la dimensione del prompt dell'owner e non instrada altrove un dump
  grezzo incollato in chat: se l'owner apre un giro incollando un file intero, quel testo entra nel
  contesto intero.
- **Nel target:** `hooks/userprompt_guard.py` blocca il prompt oltre 3000 parole, avverte oltre 900,
  e — quando la compressione fallisce — **tronca** a `prompt.split()[:800]` perdendo la coda in modo
  irreversibile. Il proposito (non far entrare il dump grezzo) è sensato; il troncamento no.
- **Proposta:** estendere `plugins/daiku/hooks/lib/run-advice.mjs` perché, quando il prompt
  d'apertura di un giro porta un dump grezzo oltre la soglia, risponda con `additionalContext` —
  **non** un blocco, coerente con «un avviso che arriva ogni volta smette di essere letto» e con la
  voce descrittiva degli hook di Daiku — indicando la sede giusta: metterlo in un file e passarne
  il path, o `/research`. Atterra in: `run-advice.mjs`, una chiave in `.daiku/environment.json` (o
  `project.json`), un caso nel banco, una riga nel README degli hook. Costo: piccolo.

## Evidenza

| path nel target | estratto |
|---|---|
| `hooks/userprompt_guard.py` | `result["transformedPrompt"] = compressed_packet.strip()`; `result["rejectInput"] = True` |
| `hooks/hooks.json` | un solo hook: `UserPromptSubmit` → `python ${CLAUDE_PLUGIN_ROOT}/hooks/userprompt_guard.py` |
| `hooks/userprompt_guard.py` | «intercept before LLM sees the prompt»; `truncated_words = prompt.split()[:HARD_TRUNCATE_WORDS]` |
| `settings.json` | `"defaultTopK": 3`, `"relevanceFloor": 0.18`, `promptGuard.autoCompactTurn` |
| `skills/token-reducer/SKILL.md` | «Do not paste large code or logs into chat»; `allowed-tools: [Read, Glob, Grep, Bash, Task]` |
| `commands/token-reducer.md` | `context_pipeline.py run --inputs . --query "$ARGUMENTS" --top-k 3` |
| `.claude-plugin/plugin.json` | `"name": "claude-token-reducer"`, `"version": "1.4.0"`; **nessun** campo `hooks`/`agents`/`commands` |
| `.claude-plugin/marketplace.json` | `"source": "./"` |
| `scripts/token_reducer/compressor.py` | `extract_code_signatures`; `textrank_score_sentences`; `candidate.final_score` sotto `relevance_floor` interrompe la raccolta |
| `scripts/token_reducer/pipeline.py` | `run_retrieval_pipeline`; chiama `fts_retrieve`, `rerank_candidates`, `compress_candidates` |
| `scripts/token_reducer/retriever.py` | `reciprocal_rank_fusion`; `infer_retrieval_tier` (soglie 200/2000) |
| `scripts/token_reducer/chunker.py` | `_TREE_SITTER_LANGUAGES`; `_extract_ast_chunks` |
| `scripts/token_reducer/db.py` | `chunks_fts USING fts5`; `symbol_index`; `file_dependencies` |
| `scripts/apply_diff.py` | marcatori del protocollo: SEARCH dopo quattro segni minore, REPLACE dopo quattro segni uguale, quattro segni maggiore a chiudere; «the entire file transaction is rolled back» |
| `agents/hybrid-retriever.md` | `tools: Read, Glob, Grep` |
| `src/lib.rs` | pyo3 `estimate_tokens` — «Matches Python: max(1, int(len(text.split()) * 1.3))» |
| `BENCHMARK.md` | «98.9% token reduction», «27.1 ms (average)» |
| https://code.claude.com/docs/en/hooks | `UserPromptSubmit` «can't replace the prompt»; `PostToolUse.updatedToolOutput` «Replaces the tool's result» |
| `plugins/daiku/hooks/hooks.json` e `hooks/lib/*.mjs` | Daiku usa `additionalContext`; nessun `updatedToolOutput` |

## Domande aperte

- Il verdetto sui campi dell'host (`transformedPrompt`/`rejectInput` non validi su
  `UserPromptSubmit`; `updatedToolOutput` valido su `PostToolUse`) poggia su una lettura via
  WebFetch di `https://code.claude.com/docs/en/hooks`, che è un riassunto e si dichiara troncato
  prima della sezione `UserPromptSubmit`: va riconfermato sulla specifica di prima parte prima di
  costruirvi sopra un divieto o un hook.
- Non ho potuto stabilire se il target sia mai stato esercitato davvero su Claude Code: nessuna
  prova nel repository che l'hook produca la compressione che dichiara. Le cifre di `BENCHMARK.md`
  (98.9%) riguardano la CLI, non l'integrazione con l'host.
- Restano fuori dalla lettura integrale: `cli.py` oltre le prime ~400 righe (~40 KB in tutto),
  `db.py` oltre lo schema iniziale (~32 KB), `apply_diff.py` oltre le prime ~240 righe,
  `benchmark.py` (~24 KB), `PLAN_phase1_perf_overhaul.md` (~17 KB), `tests/*`, `.github/workflows/*`,
  `contribute.md`, `hooks/userprompt_guard.py` (letto per intero), `ann.py`, `embeddings.py`. Il
  giudizio sul motore di compressione si fonda su `compressor.py`, `pipeline.py`, `retriever.py` e
  `chunker.py`, letti per intero.
- La riga dell'elenco («reranking») è confermata: il reranking esiste (`rerank_candidates` + RRF);
  la riga però non dice la cosa che conta per questo studio — che l'aggancio al modello è un solo
  hook, e sbagliato.
