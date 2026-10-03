# alexgreensh/token-optimizer — plugin di ottimizzazione del contesto per agenti di coding: compressione deterministica, checkpoint attorno alla compaction e punteggio di qualità, tutto in locale

- **URL:** https://github.com/alexgreensh/token-optimizer
- **Licenza:** PolyForm Noncommercial 1.0.0 (con permesso aggiuntivo small business) — non open source
- **Ultimo commit:** 2026-09-30
- **Stelle:** 2479
- **Archivio:** no
- **Letto via:** api

## Cosa fa, e come lo fa

Un plugin per host di coding (Claude Code, Codex, Cursor, Copilot, OpenCode, OpenClaw, Hermes, Pi, Antigravity, Grok) che riduce il consumo di contesto e ne misura il costo, senza mai chiamare la rete. La radice del repository è insieme vetrina e pacchetto: le due vetrine (`plugins/.claude-plugin/marketplace.json`, `plugins/.agents/plugins/marketplace.json`) puntano a `plugins/token-optimizer/`, che è l'albero installato; l'albero canonico dei sorgenti è quello di radice (`skills/`, `hooks/`, `commands/`), mentre `cowork/`, `openclaw/`, `opencode/`, `pi/`, `vscode-extension/` sono adattatori per i singoli host.

Il meccanismo vive nei **hook** (`hooks/hooks.json`) e in un corpus di script Python. Su ogni tool call l'host dispatcha `hooks/run.py` (solo stdlib, esce sempre `0`, nessun `shell=True`, gate di consenso inline). I hook registrati: `PreToolUse` su `Read` verso `read_cache.py`; su `Bash` verso `bash_hook.py`, che riscrive il comando verso `bash_compress.py`; `PreCompact` verso `measure.py compact-capture` più `dynamic-compact-instructions` più `read_cache.py --clear`; `SessionStart` verso `sessionstart_runner.py`, che fa il restore dopo compact; `Stop` e `StopFailure` verso il checkpoint; `PostToolUse` verso `archive_result.py`, `context_intel.py` e l'invalidazione della cache; `UserPromptSubmit` verso continuità e quality cache. Lo stato vive in un SQLite per sessione (`session_store.py`: tabelle `file_reads`, `tool_outputs` con indice FTS5 esterno-contenuto, `cached_content`, `session_meta`, `activity_log`; WAL, cap 50 MB) e in file JSON di cache qualità sotto la home dell'host.

Le nove funzioni di compressione: delta mode (rilettura di file cambiati, servita come diff unificato, `delta_diff.py`), structure map (scheletro di firme e import di un file codice, `structure_map.py`, in v2 con PageRank su un grafo di riferimenti), compressione dell'output Bash su famiglie di comandi con whitelist di sola lettura (`bash_whitelist.py`, `command_filters.py`), compressione dei risultati di ricerca, archiviazione dei risultati grandi con recupero su richiesta (`archive_result.py`), lean-output nudge, quality nudge, loop detection, activity mode con decision extraction. La compaction è protetta su entrambi i lati: cattura del checkpoint prima (`PreCompact`, `Stop`, `StopFailure`, più la milestone `pre-fanout`) e restore dopo (`SessionStart` con trigger `compact`; hint per parole chiave su sessione fresca). I checkpoint sono progressivi a soglie di riempimento e di qualità, e le istruzioni di compact sono dinamiche (mode-aware, PRESERVE e DROP).

Il costo è misurato, non stimato: `measure.py` prezza ogni sessione dal transcript, scompone per componente (file di istruzioni, memoria, skill, comandi, MCP, hook, settings) e distingue tre livelli — misurato, stimato, opportunità (`docs/METHODOLOGY.md`). Zero telemetria e zero chiamate di rete: lo dichiara il README e lo conferma l'analisi della superficie in `HOOKS.md`, con l'unica eccezione del server della dashboard, legato a localhost.

## Asse A — Daiku lo fa già, e loro lo fanno meglio?

Nessuna.

## Asse B — Daiku non lo fa, e si potrebbe aggiungere?

### B1 — Compressione deterministica dell'output dei comandi Bash

- **Capacità:** Daiku non tocca l'output dei comandi. I suoi cinque hook negano o avvisano (`plugins/daiku/hooks/lib/command-guard.mjs`, `run-advice.mjs`); nessuno comprime. In una consegna lunga — i giri di `/review` con build e test — l'output verboso entra per intero nel contesto del subagent.
- **Nel target:** un hook `PreToolUse` su `Bash` riscrive il comando verso `bash_compress.py`, che lo esegue e ne comprime l'output per famiglia (git, pytest, lint, listing, log, build, json/csv, k8s, cloud) su una whitelist di sola lettura; `bash_whitelist.py` esclude ogni metacarattere di shell e i comandi non read-only, e lo scan credenziali precede la compressione. Il README misura la riduzione di una run pytest da 564 a 115 token.
- **Proposta:** una funzione di compressione d'output come **hook** in `plugins/daiku/hooks/lib/`, cablata in `hooks/hooks.json` su `PreToolUse`/`PostToolUse` per `Bash`. Atterra solo su Claude Code (su Codex i hook non esistono; `sync-host` li porterebbe in `.codex/hooks/`). Costo: una tabella di famiglie, una whitelist di sola lettura, lo scan credenziali e il banco che ogni hook di Daiku deve avere (`hooks/self-check.mjs`), perché un hook rotto e uno silenzioso sono indistinguibili. È una capacità nuova, non un allineamento.

### B2 — Checkpoint e restore attorno alla compaction

- **Capacità:** Daiku non ha alcuna difesa dalla compaction. In `review` e `ship-feature` lo stato vive in file (ledger, brief, `4. review-notes.md`), ma lo stato di conversazione di un subagent — decisioni prese, errori già diagnosticati — sparisce a un auto-compact, e il giro successivo lo ripaga.
- **Nel target:** `PreCompact` cattura un checkpoint (task attivo, decisioni, errori, stato agent, lavoro aperto) e inietta istruzioni di compact mode-aware; `SessionStart` con trigger `compact` lo ripristina. Tre trigger automatici più uno a milestone (`pre-fanout`, prima di lanciare subagent — esattamente il punto di Daiku). I checkpoint sono progressivi a soglie di riempimento, non a timer.
- **Proposta:** due hook (`PreCompact`, `SessionStart`) che catturano e ripristinano un checkpoint deterministico, con il programma che lo scrive in `plugins/daiku/architect/` accanto a `ledger.mjs` (stessa disciplina: legge il disco, nessun LLM, banco proprio). Atterra solo su Claude Code. Costo alto: legge il transcript dell'host (formato specifico), scrive fuori dal progetto, e va progettato fail-open col banco. È la capacità al centro di questa corsa.

### B3 — Read cache sulle riletture: delta e structure map

- **Capacità:** i subagent di Daiku rileggono gli stessi file più volte (contratti, memorie, sorgenti nei giri successivi di `/review`). Daiku non ha una cache di lettura: ogni rilettura paga il file intero.
- **Nel target:** `PreToolUse` su `Read` intercetta le riletture; `delta_diff.py` serve un diff unificato quando il file è cambiato poco, `structure_map.py` uno scheletro (firme, import, gerarchia) per un file codice grande. Il README dichiara la riduzione di un file da 720 KB a 250 token e di una rilettura da 2000 a circa 50. Quattro modi (`soft_block` di default, `warn`, `shadow`, `block`), con fallback al file intero quando la sostituzione potrebbe perdere informazione.
- **Proposta:** un hook `PreToolUse` su `Read` in `plugins/daiku/hooks/lib/` più un modulo deterministico in `plugins/daiku/architect/` per delta e scheletro; la cache vive in un file di sessione fuori dal progetto. Atterra solo su Claude Code. Costo medio-alto (parsing AST, allowlist di estensioni, guardie sul costo quadratico); la modalità `shadow` del target è il modo con cui si misura il guadagno prima di servire davvero la sostituzione — coerente con la disciplina di Daiku: mai fidarsi di un LLM, ma misurare.

### B4 — Misura deterministica di quanto contesto costa Daiku in un progetto

- **Capacità:** `init` deposita il file di istruzioni, `.daiku/` e il corpus di memoria, e il pacchetto porta venti skill. Daiku non misura mai quanto di quel sempre-caricato pesa in token, né segnala un progetto dove è gonfiato.
- **Nel target:** `measure_components` in `measure.py` conta, per componente, i token dell'ambiente sempre carico (file di istruzioni, memoria, skill, comandi, MCP, hook, settings) e li prezza; l'audit di `/token-optimizer` li presenta con le correzioni suggerite.
- **Proposta:** un programma in `plugins/daiku/architect/` che, dato il progetto, emetta un inventario in token del sempre-caricato di Daiku (istruzioni, `.daiku/`, skill, memorie) e lo esponga da una skill di audit — nessun hook, quindi vale su **entrambi** gli host. Costo medio (conta file e stima token, nessun modello). È l'Asse B che più somiglia alla filosofia di Daiku: deterministico, locale, e misura un difetto che Daiku stesso produce.

### B5 — Punteggio di riempimento del contesto, che smorza le proprie iniezioni

- **Capacità:** gli hook di Daiku (`run-advice`, `session-advice`, `stop-advice`) iniettano promemoria senza sapere quanto è pieno il contesto; a riempimento alto un avviso informativo è rumore che costa.
- **Nel target:** `context_pressure.py` legge un `fill_pct` e smorza le iniezioni, con soglia alta a 75 e critica a 90 e priorità `essential`/`token-saving`/`informational`; `should_inject` decide per priorità. La quality cache si ricalcola da hook e dopo la compaction.
- **Proposta:** un modulo in `plugins/daiku/architect/` che calcola un livello di pressione del contesto dal transcript dell'host, più un gate nei tre hook che parlano, così un promemoria non essenziale tace quando il contesto è pieno. Atterra solo su Claude Code (gli hook lo sono). Costo medio; il valore è rendere più credibili i promemoria di Daiku, che è la ragione per cui esistono.

## Evidenza

| path nel target | estratto |
|---|---|
| README.md | «compresses ... 111 commands across 22 pattern families, credential-safe; 564 → 115 tokens on a pytest run» |
| hooks/hooks.json | PreToolUse Read verso read_cache.py; PreCompact verso compact-capture; SessionStart; Stop |
| HOOKS.md | «run.py always exits 0 (never blocks a tool call)»; gate di consenso fail-open; «No shell execution» |
| skills/token-optimizer/scripts/bash_compress.py | «shell=True is NEVER used»; CREATE_NO_WINDOW; baseline Claude Code 30_000 e 2_206 caratteri |
| skills/token-optimizer/scripts/bash_whitelist.py | `_DANGEROUS_CHARS` esclude punto e virgola, pipe, backtick, dollaro, parentesi, graffe e redirect |
| skills/token-optimizer/scripts/delta_diff.py | `MAX_DELTA_CHARS = 1500`; `MAX_DELTA_LINES = 2000`; `CODE_EXTENSIONS` |
| skills/token-optimizer/scripts/structure_map.py | `MIN_TOKENS_FOR_STRUCTURE = 1000`; `MAX_REPLACEMENT_CHARS` con signatures 800, skeleton 2400 |
| skills/token-optimizer/scripts/read_cache.py | «soft_block (default)»; modi warn, shadow, block; delta attivo di default |
| skills/token-optimizer/scripts/session_store.py | CREATE TABLE file_reads, tool_outputs, cached_content, activity_log; «WAL mode»; «50MB cap» |
| skills/token-optimizer/scripts/context_pressure.py | `_HIGH_THRESHOLD = 75`; `_CRITICAL_THRESHOLD = 90`; priorità essential, token-saving, informational |
| skills/token-optimizer/scripts/archive_result.py | «Archives large tool results to disk so they survive compaction»; permessi 0600 |
| docs-site/src/content/docs/features/smart-compaction.mdx | checkpoint progressivi; trigger PreCompact, Stop, StopFailure, pre-fanout; PRESERVE/DROP dinamici |
| docs-site/src/content/docs/concepts/quality-scoring.mdx | Resource Health e Session Efficiency; voti da S a F; la «degradation cliff» |
| docs/METHODOLOGY.md | tre livelli measured, estimated, opportunity; prezzi per milione di token |
| docs/evals/compaction-timing-challenge-v1.md | «Sessions: 30. Checkpoints: 120»; boundary precision e recall per banda |
| LICENSE | «PolyForm Noncommercial License 1.0.0»; permesso aggiuntivo small business |
| tests/ | 279 file `tests/test_*.py` |

## Domande aperte

- `measure.py` conta oltre 51.000 righe e non è stato letto per intero: il giudizio sul motore di scoring e di prezzo poggia sulle sue testate, sui documenti e sui moduli estratti, non su una lettura riga per riga. Un difetto interno a quelle 51.000 righe non sarebbe emerso.
- Niente è stato eseguito né installato: le cifre di risparmio (564 a 115 token, 720 KB a 250, 2000 a 50) sono dichiarazioni del target, non verificate qui.
- Gli adattatori per host diversi da Claude Code (`opencode/`, `pi/`, `antigravity/`, `cowork/`, `vscode-extension/`) sono stati letti solo di sfuggita: la copertura «dieci host» non è verificata per ciascuno.
- Le tre copie speculari dell'albero (radice, `plugins/token-optimizer/`, `cowork/token-optimizer/`) non sono state confrontate byte a byte: quale sia la fonte di verità non è provato.
