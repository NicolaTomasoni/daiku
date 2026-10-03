# rtk-ai/rtk — proxy CLI in Rust che comprime l'output dei comandi prima che raggiunga l'agente

- **URL:** https://github.com/rtk-ai/rtk
- **Licenza:** Apache-2.0
- **Ultimo commit:** 2026-10-03
- **Stelle:** 82292
- **Archivio:** no
- **Letto via:** api

## Cosa fa, e come lo fa

rtk (Rust Token Killer) è un proxy CLI in Rust, binario singolo e zero dipendenze, che si mette fra
l'agente e la shell: intercetta un comando (p.es. `git status`) e lo riscrive nel suo equivalente
filtrato (`rtk git status`), oppure esegue il comando e comprime l'output prima che l'agente lo
legga. Dichiara 100+ comandi coperti e meno di 10ms di overhead per comando.

**Dove vive lo stato.** I filtri built-in sono file `src/filters/*.toml` concatenati a compile-time
da `build.rs` e embeddati nel binario; a runtime la ricerca è a tre livelli, primo che vince:
`.rtk/filters.toml` (progetto, richiede `rtk trust`) → `~/.config/rtk/filters.toml` (utente) →
built-in → passthrough (`src/filters/README.md`). Il registro delle regole di riscrittura sta in
`src/discover/rules.rs` (regex, `rtk_cmd`, prefissi da sostituire, metadati), compilato una volta
con `RegexSet` in `src/discover/registry.rs`, che è l'unica fonte di verità: gli hook esterni
chiamano `rtk rewrite` invece di duplicare logica. Contabilità token e archivio di recupero vivono
in SQLite sotto la home dell'utente (`src/core/tracking.rs`, `src/core/retriever.rs`), mai nel
progetto.

**Chi lo muove.** `rtk rewrite`, invocato su una stringa di comando, è il cuore: un lexer proprio
(`src/discover/lexer.rs`) tokenizza la shell rispettando quoting e redirect, i comandi composti si
spezzano su `&&`, `|`, `;`, ogni segmento si classifica contro 60+ regex e si riscrive il prefisso.
Gli hook dei 13 agenti supportati sono delegati sottili: lo shell hook di Claude Code
(`hooks/claude/rtk-rewrite.sh`) legge il JSON `PreToolUse`, estrae `tool_input.command`, chiama
`rtk rewrite` e risponde con `updatedInput` più `permissionDecision`. Il protocollo di uscita ha
quattro casi: `0` riscritto e auto-allow, `1` nessun equivalente (passthrough), `2` deny, `3`
riscrivi ma lascia il prompt all'utente.

**Cosa lo impone.** Quattro strategie per tipo di comando — filtro intelligente, raggruppamento,
troncamento, deduplicazione. Lungo il percorso, guardie: salta l'output strutturato (`gh` con
`--json`/`--jq`/`--template`), salta `cat` con flag diversi da `-n` e ogni `cat`/`head`/`tail` con
redirect, `RTK_DISABLED=1` disattiva, `hooks.exclude_commands` esclude, `sudo` non è mai riscritto.
È **fail-open per costruzione**: senza `jq`, senza `rtk`, o con versione inferiore a 0.23.0 lo
shell hook esce `0` in silenzio. Due reti rendono accettabile il filtro: (1) ogni riga tolta è
recuperabile — l'output completo è archiviato content-addressed (SHA-256, gzip) e l'output filtrato
dichiara la riga di recupero `[full output: rtk recall ...]`, col segnaposto dell'hash al posto del
valore (`src/core/retriever.rs`); (2) i filtri definiti dall'utente non si applicano finché non li
si fida, con fiducia legata a un hash del contenuto.

**Limite dichiarato.** Il filtro copre solo il tool `Bash`: `Read`, `Grep` e `Glob` di Claude Code
non passano dall'hook e non vengono riscritti. Le percentuali sono riduzioni di **byte di output
bash**, non di fattura, e i token sono stimati `bytes / 4` perché rtk non imbarca alcun tokenizer:
i numeri assoluti sono approssimativi.

## Asse A — Daiku lo fa già, e loro lo fanno meglio?

Nessuna.

## Asse B — Daiku non lo fa, e si potrebbe aggiungere?

### B1 — Riscrittura dei comandi e compressione dell'output per famiglia

- **Capacità:** Daiku non tocca mai l'output di un comando prima che raggiunga il contesto. I suoi
  hook usano `PreToolUse` su `Bash|PowerShell` solo per negare gesti (`command-guard.mjs`) e
  `PostToolUse` solo su `Edit|Write`; nessun hook legge o riscrive ciò che `Bash` restituisce
  (`plugins/daiku/hooks/hooks.json`). Un giro di `/review` con build e test paga il log intero.
- **Nel target:** un hook `PreToolUse` riscrive `git status` → `rtk git status` e un filtro per
  famiglia comprime l'output (git, test, build, lint, container, cloud…), con quattro strategie, una
  DSL TOML a 8 stadi più filtri Rust nativi, e le guardie già citate (salto dell'output strutturato,
  dei redirect, `exclude_commands`, fail-open).
- **Proposta:** è la feature `compressione-output-comandi` già abbozzata nel cantiere, e rtk ne è
  un'istanza in produzione. Atterra in `plugins/daiku/hooks/lib/*.mjs` più una voce
  `PreToolUse`/`PostToolUse` su `Bash` in `plugins/daiku/hooks/hooks.json`, col banco in
  `hooks/self-check.mjs`. Da rtk portare: (a) il **registro unico di regole** — gli hook delegati,
  una sola fonte (`rules.rs`); (b) la **tabella di famiglie** con le quattro strategie; (c) le
  **guardie** — salto dell'output strutturato e dei redirect, whitelist di sola lettura,
  `RTK_DISABLED`, `exclude_commands`, `sudo` mai riscritto; (d) il **fail-open** che esce `0` senza
  le sue dipendenze. Costo alto (tabella famiglie + registro + guardie + banco); vale solo su Claude
  Code, perché su Codex gli hook di pacchetto non partono.

### B2 — Recupero dell'output completo: niente riga è persa

- **Capacità:** Daiku non ha alcun meccanismo che archivi l'output integrale di un comando
  filtrato; se un hook comprimesse, l'agente non avrebbe come rileggere ciò che è stato tolto.
- **Nel target:** store content-addressed in SQLite (`src/core/retriever.rs`): chiave SHA-256, blob
  gzip, tetto 200 voci FIFO, retention 30 giorni, soglia minima 500 byte, solo sui fallimenti (o
  anche sui successi in modalità tee). L'output filtrato dichiara la riga di recupero col segnaposto
  dell'hash.
- **Proposta:** è il complemento che rende sicuro B1. La sede è un programma in
  `plugins/daiku/architect/` accanto a `ledger.mjs` — legge il disco, nessun LLM, banco proprio —
  che scrive l'archivio **fuori dal progetto** e restituisce l'hash da appendere all'output. Costo
  medio; atterrabile su entrambi gli host come programma (l'hook che lo chiama resta di Claude Code).

### B3 — Blocco di "awareness" nel file di istruzioni: l'output compresso va trattato come completo

- **Capacità:** `init` di Daiku scrive il file di istruzioni del progetto, ma nulla dice all'agente
  come trattare un output di comando compresso; senza questo, un agente che filtra tende a
  rieseguire i comandi "per sicurezza", annullando il guadagno.
- **Nel target:** `rtk init` inietta un blocco (`hooks/rtk-awareness.md`, tre varianti per
  `awareness.level`) nel `CLAUDE.md`/`AGENTS.md`: «treat it as the complete result», raggruppa i
  comandi correlati in una sola chiamata, usa `rtk proxy`/il recupero solo quando l'output è
  inutilizzabile (vuoto ma atteso, in contrasto con l'exit code, o illeggibile).
- **Proposta:** una riga nel blocco che `init` deposita — `plugins/daiku/templates/project/instructions.md`
  — e, se serve una sede normativa, una policy in `plugins/daiku/templates/project/policies/README.md`.
  Costo basso; va insieme a B1 e B2. Da portare anche la consegna "raggruppa comandi correlati", che
  riduce i turni.

### B4 — Fiducia e tamper-evidence sui filtri definiti dall'utente

- **Capacità:** se Daiku spedisce filtri modificabili dal progetto, non ha un modo per non applicare
  un file appena comparso o appena scritto — la memoria `guardrail-nascono-spenti` dice già «un hook
  non esegue un file perché è comparso», e lo stesso vale per un filtro che riscrive l'output.
- **Nel target:** `.rtk/filters.toml` e `~/.config/rtk/filters.toml` sono ignorati **in silenzio**
  finché non si lancia `rtk trust`; la fiducia è un SHA-256 del contenuto, quindi un'edit la
  invalida. Dichiarato esplicitamente come consenso + tamper-evidence, **non** sandbox (un attaccante
  che scrive il filtro sa scrivere anche il trust store).
- **Proposta:** un controllo deterministico in `plugins/daiku/architect/` che confronta l'hash del
  file di filtri con un registro di fiducia fuori dal progetto, chiamato dall'hook di B1 prima di
  applicare un filtro non built-in. Costo medio. Coerente col principio di Daiku «mai fidarsi di un
  LLM: dove un divieto può avere una sede deterministica, ce l'ha».

### B5 — Misura dell'adozione e delle occasioni perse

- **Capacità:** Daiku registra il `cost` (token, tool_uses, secondi) di un round di `/review` nel
  ledger, ma non misura l'adozione di una capacità né le occasioni mancate attraverso le sessioni.
- **Nel target:** un DB SQLite per comando (input/output/saved token stimati, `savings_pct`, tempo)
  e tre lettori read-only: `rtk gain` (dashboard), `rtk discover` (scansiona le trascrizioni passate
  per trovare i comandi che *potevano* essere riscritti), `rtk session` (adozione).
- **Proposta:** un programma in `plugins/daiku/architect/` che legge la trascrizione dell'host e
  riporta adozione e occasioni perse di B1, consumato da un hook esistente (`stop-advice.mjs`) o
  esposto da un comando, restando fedele alla regola di Daiku «un numero esiste solo se l'host l'ha
  riportato» (mai stimato). Costo medio. Si sovrappone alla feature già abbozzata
  `contabilita-contesto-runtime`: da rtk il delta è il `discover` sulle sessioni passate.

## Evidenza

| path nel target | estratto |
|---|---|
| `README.md` | «filters and compresses command outputs before they reach your LLM context… 100+ supported commands», meno di 10ms di overhead |
| `README.md` | «Claude Code built-in tools like `Read`, `Grep`, and `Glob` do not pass through the Bash hook» |
| `README.md` | «token counts… estimated as `bytes / 4` — RTK ships no tokenizer» |
| `hooks/claude/rtk-rewrite.sh` | protocollo a quattro esiti (0 riscrivi+allow, 1 passthrough, 2 deny, 3 riscrivi+prompt); esce 0 senza `jq`/`rtk` |
| `hooks/README.md` | «13 supported agents»; «70+ rewrite patterns»; «one source of truth» |
| `src/discover/README.md` | «`gh` with `--json`/`--jq`/`--template` → skip»; `cat`/`head`/`tail` con redirect → skip; `RTK_DISABLED=1` |
| `src/discover/registry.rs` | «`sudo` is intentionally NOT stripped here… left untouched so they pass through unchanged» |
| `src/filters/README.md` | fiducia = SHA-256 del contenuto; «untrusted… skipped silently»; «consent + tamper-evidence, not a sandbox» |
| `src/core/retriever.rs` | content-addressed (SHA-256), gzip, `max_entries 200`, `retention_days 30`, `MIN_FAILURE_BYTES 500` |
| `src/core/tee.rs` | riga di recupero col segnaposto dell'hash; store solo su fallimento in modalità sqlite |
| `hooks/rtk-awareness.md` | «Treat it as the complete result… batch related commands into one call» |
| `docs/contributing/ARCHITECTURE.md` | quattro strategie; ciclo a sei fasi; «Fail-Safe: If filtering fails, fall back to original output» |
| `.rtk/filters.toml` | filtro progetto-locale (`match_command`, `strip_lines_matching`, `max_lines`, `on_empty`) |

## Domande aperte

- Non ho letto per intero il sorgente: `src/discover/rules.rs` (192 righe fra `pattern:` e
  `rtk_cmd:`), i singoli filtri `src/cmds/*/*.rs`, la suite `tests/` e le workflow CI sono stati
  letti solo per campione o non letti. Il giudizio sul meccanismo poggia su README, guide di
  `docs/`, le README di modulo e le parti sostanziali di `registry.rs`, `retriever.rs`, `tee.rs`.
- Non ho potuto verificare il comportamento a runtime (il target non si esegue): l'accuratezza
  delle guardie di riscrittura e la tenuta del filtro su output reali restano dichiarate dal
  progetto, non provate da me.
- Non ho deciso se l'insieme delle guardie contro la corruzione dell'output strutturato sia
  completo: ne ho confermate alcune (`gh --json`, `cat` con flag, redirect), ma non tutte le 60+
  regole.
- Le 82 292 stelle sono il valore riportato dall'API al momento della lettura; non ho elementi per
  giudicarlo.
- Esiste nel cantiere una feature abbozzata (`compressione-output-comandi`) che copre già il
  meccanismo di B1 e parte di B2; non ho potuto decidere se questa corsa debba riusarla come sede o
  se il suo stato sia cambiato.
