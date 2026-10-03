# Mibayy/token-savior — server MCP che naviga il codice per simboli, tiene memoria persistente e riscrive i comandi Bash prima che girino

- **URL:** https://github.com/Mibayy/token-savior
- **Licenza:** MIT
- **Ultimo commit:** 2026-08-10
- **Stelle:** 1159
- **Archivio:** no
- **Letto via:** api

## Cosa fa, e come lo fa

Token Savior è un **server MCP** (più una CLI `ts` per gli host senza MCP) che sta davanti a un agente di codice su tre assi: navigazione del codice per simboli (`find_symbol`, `get_function_source`, `get_full_context`, `search_codebase`), un motore di **memoria persistente** su SQLite WAL + FTS5 + embedding, e un terzo asse aggiunto in v4.1 — la **compressione dell'output dei tool**, che è l'asse di questo studio. Lo stato vive fuori dal progetto: database in `~/.local/share/token-savior`, sandbox degli output in una tabella `tool_captures`, cache su disco per gli embedding. Non scrive nel progetto dell'utente: indicizza una copia di lavoro e risponde via MCP.

Il meccanismo dell'asse "output dei tool" è a **due strati, e il progetto dichiara lui stesso quale dei due taglia davvero**:

- **Prima che l'output esista** — `PreToolUse` che **riscrive la chiamata**, non la nega. `hooks/bash_rewriter_hook.py` legge l'evento, passa la stringa a `src/token_savior/bash_rewriter/rules.py` e, se una regola combacia, risponde con `permissionDecision: allow` **più un `updatedInput`** che sostituisce il comando (`git status` → `git status --porcelain=v2 --branch`, `git log` → `--oneline -n 20`, `pytest` → `-q --tb=line`, `grep` → `-m 20`, `cat file` → `head -n 400 file`). Le regole sono pure, conservative: `is_unsafe_to_rewrite` lascia passare tutto ciò che contiene un operatore di composizione (`|`, `>`, `&&`, `;`, `` ` ``), il separatore `--` o un flag di verbosità. In parallelo `hooks/read_guard_hook.py` (attivo di default) inietta un `limit` in un `Read` senza `limit`/`offset` su un file di codice oltre 600 righe. La base misurata è `scripts/audit_budget.py`: su 400 transcritti, le uscite di comando pesano il 30,0% dei token resi al modello e le letture di codice il 26,5%.
- **Dopo che l'output è tornato** — `PostToolUse` che **compatta e mette in sandbox**. `hooks/tool_capture_hook.py` fa passare l'output di shell (34 compactors famiglia per famiglia, `src/token_savior/compactors/`) e, se il risultato supera `TS_CAPTURE_THRESHOLD_BYTES`, salva l'originale integrale in `tool_captures` e appende un puntatore `ts://capture/{id}` con gli strumenti `capture_get/search/aggregate` per rileggerlo dopo una compaction. **Ma il progetto avverte, in chiaro, che questo strato non riduce il turno corrente:** un hook `PostToolUse` può solo *aggiungere* contesto, perché quando parte l'output è già stato mandato al modello. Il testo lo dice testualmente (`README.md`): «These run in PostToolUse, so they do not shrink the current turn... For an actual reduction of what reaches the model, use the PreToolUse rewriter». Ciò che lo strato `PostToolUse` compra davvero è la **persistenza**: l'output pieno sopravvive a una compaction e resta interrogabile invece di dover essere rieseguito.

Accanto, sul confine della **serializzazione**, due pezzi minori ma netti: `src/token_savior/truncation.py` appende una nota dichiarativa quando una collezione resa coincide *esattamente* con la sua borne («una risposta di esattamente `max_results` elementi è indiscernibile da una completa»), tenuto da un test di copertura che fallisce se un tool introduce una nuova borne sotto un nome non conosciuto; e `src/token_savior/tool_annotations.py` classifica ogni tool read-only/distruttivo/idempotente, con la motivazione che i default MCP sono ostili (`readOnlyHint` a false) e che un test deve fallire se un tool non è classificato.

Infine le **guardie che impongono l'uso**: `hooks/ts_discipline_guard.py` (opt-in, `TS_DISCIPLINE_GUARD=1`) nega `Edit`/`Write`/`Read`/`Grep`/`Bash` nativi su sorgente indicizzato, ma con due scelte notevoli — un **rifiuto che insegna una volta sola** (la prima chiamata è negata, la seconda identica passa: «il primo appel est refuse et enseigne, le second passe») e un **giornale dei rifiuti attivo di default**, perché «un garde-fou dont personne ne compte les refus derive sans que ca se voie». E la misura che giustifica tutto: la prima versione della regola 5, rigiocata su 9054 chiamate reali, produsse 1036 rifiuti di cui **710 falsi positivi, il 68,5%**.

**L'avvertenza sui numeri — è la parte da riportare, ed è il progetto stesso a scriverla.** La pagina vende in testa «97.9% on tsbench at -80% tokens», ma lo stesso README, poche righe sotto, la disarma: (1) l'harness che ha prodotto quei numeri non è pubblico, quindi «take the figures as reported rather than as independently verifiable»; (2) una **ri-misura pubblicata il 2026-08-09 è stata ritirata il 2026-08-10** perché non misurava affatto questo server — su 143 sessioni di bench **una sola** aveva chiamato un tool Token Savior (il client aveva il caricamento differito dei tool MCP attivo, così i 18 tool restavano dietro un `ToolSearch` e il modello tornava a `Grep`/`Read`: 66 grep, 30 read, una chiamata MCP); (3) la conclusione: «The headline figures above therefore stand as reported and unverified... Re-measuring them properly is open work», e la lezione che ne traggono — «a benchmark of an MCP server must assert that its tools were actually called». Va letto alla lettera: i numeri di risparmio sono **dichiarati, non verificabili** da qui, e il progetto non finge il contrario.

## Asse A — Daiku lo fa già, e loro lo fanno meglio?

### A1 — Dichiarare il taglio di un risultato limitato invece di tacerlo

- **In Daiku oggi:** il principio esiste già, ma in un solo punto. `plugins/daiku/architect/architect.mjs` ha un'uscita dedicata `rounds-truncated`: quando il ciclo di review tocca il tetto esplicito di giri con il codice ancora in movimento, **dichiara che è stato tagliato** invece di fingere di aver finito (`skills/review/SKILL.md`, § *Exits*); e `hooks/README.md` porta la regola `never_red`, cioè che un controllo mai visto rosso va comunque considerato rosso. Daiku sa quindi che un'operazione limitata deve dire di esserlo — ma solo per i giri di review, non per le collezioni che i suoi blocchi di ritorno serializzano.
- **Nel target:** `src/token_savior/truncation.py` generalizza il principio a **ogni risultato limitato**: `notice_de_troncazione(arguments, result)` confronta la lista resa più lunga con la borne richiesta e, se coincidono, appende «[tronque] N element(s)... rendus, soit exactement la borne demandee — il en reste probablement». La lista dei nomi di borne è tenuta da un test (`test_truncation::test_bornes_couvrent_les_schemas`) che **fallisce quando un tool introduce una borne sotto un nome sconosciuto**: la copertura non è affidata alla memoria di chi scrive.
- **Chi vince:** target — non per l'idea, che Daiku ha, ma perché la generalizza a *ogni* collezione limitata e la tiene con un test di copertura invece che con un'uscita cablata in un punto solo.
- **Proposta:** portare la dichiarazione generalizzata nella serializzazione dei blocchi di Daiku. Concretamente: aggiungere a `plugins/daiku/schemas/blocks.json` un campo d'esito per i blocchi che portano collezioni (`truncated`/`has_more`, opzionale ma richiesto quando un campo-borne è presente), scrivere la regola in `contracts/orchestration.md` §4 (*Validation*), e — sul modello del test del target — far fallire il banco del valutatore quando compare una nuova chiave di borne non coperta. Costo: una riga di schema, una di contratto, un caso di banco; nessun modulo nuovo.

## Asse B — Daiku non lo fa, e si potrebbe aggiungere?

### B1 — Delimitare l'output *prima* che sia prodotto, riscrivendo la chiamata invece di negarla

- **Capacità:** Daiku non ha nulla che riduca l'output di un tool. I suoi hook `PreToolUse` o **negano** un gesto (`command-guard.mjs` su push/`--no-verify`/firma dell'agente; `ask-guard.mjs` sulla delega) o **avvisano** (`run-advice.mjs`), ma non toccano mai l'input del tool: non esiste, in `plugins/daiku/hooks/hooks.json`, un solo ramo che risponda con `updatedInput`. Il posto dove Daiku *parla* dell'output è la prosa delle skill, cioè il punto debole che la sua stessa dottrina («mai fidarsi di un LLM») dichiara insufficiente.
- **Nel target:** `hooks/bash_rewriter_hook.py` + `src/token_savior/bash_rewriter/rules.py` riscrivono la chiamata con `updatedInput` (allow, non deny) prima che produca output; `hooks/read_guard_hook.py` inietta `limit` su una `Read` non delimitata di un file lungo. Regole conservative e pure, che lasciano passare pipe, redirect, sostituzioni e flag di verbosità; base misurata in `scripts/audit_budget.py`. Il progetto nota da sé che il solo strato che riduce il turno è questo, e che il `PostToolUse` non ci riesce.
- **Proposta:** un hook nuovo in `plugins/daiku/hooks/lib/` (per esempio `output-bound.mjs`) sul `PreToolUse` di `Bash|Read`, agganciato in `hooks/hooks.json` e — lato Codex — in `templates/codex/hooks.json` via `sync-host`; gated su `.daiku/project.json` come gli altri, fail-open come gli altri, con un insieme di regole piccolo e un **banco contato** accanto (`--self-check`), una riga nella tabella di `hooks/README.md`. Il vantaggio è che atterra nel livello che Daiku già possiede (gli hook), non tocca il progetto, e aggiunge una capacità che oggi non ha: quello che atterra al modello è più piccolo perché la chiamata è stata stretta, non perché il modello si è ricordato di stringerla. Costo: un modulo dipendente da `node` (~150-250 righe), il suo banco, una riga di README, una voce nel template Codex.

### B2 — Conservare l'output grande oltre la compaction, con un puntatore stabile

- **Capacità:** Daiku non ha nessun luogo dove un output di tool sopravviva a una compaction. Tutto ciò che resta è ciò che una skill ha scritto su disco (`.daiku/`, `.docs/`); un output di shell pesante, una volta compattato il contesto, o è già nel transcript o è perso, e va rieseguito.
- **Nel target:** `hooks/tool_capture_hook.py` (`PostToolUse`) salva l'output sopra soglia in `tool_captures` e appende un puntatore `ts://capture/{id}`; `capture_get/search/aggregate` lo rileggono per `range='preview'|'head'|'tail'|'all'|'line:N-M'`, con TTL e GC. È lo stesso progetto a dichiarare che questo **non** riduce il turno: compra la persistenza, non il risparmio.
- **Proposta:** una versione sobria, perché Daiku non ha un demone né un database e non deve inventarseli. Sempre nel livello hook: un `PostToolUse` che, oltre una soglia, scrive l'output in un file nella cartella temporanea della sessione (**fuori dal progetto**, come già fanno `stop-advice`/`run-advice` con il loro segno) e appende in `additionalContext` un puntatore di path; il modello lo rilegge con gli strumenti nativi se serve. Costo: un modulo e il suo banco. Il beneficio è reale ma stretto — vale solo per l'output che va *ritrovato dopo una compaction*, e va pesato contro la rilettura a pieno costo; per questo la voce esiste separata dalla B1, che è quella che taglia davvero.

## Evidenza

| path nel target | estratto |
|---|---|
| `README.md` | «take the figures as reported rather than as independently verifiable» |
| `README.md` | la ri-misura del 2026-08-09 «withdrawn on 2026-08-10»; su 143 sessioni «exactly one» chiamò un tool TS |
| `README.md` | «PostToolUse... do not shrink the current turn»; il taglio vero è `TS_BASH_REWRITE=1` |
| `src/token_savior/bash_rewriter/rules.py` | `git status --porcelain=v2 --branch`; `grep` → `-m 20`; `cat f` → `head -n 400 f` |
| `hooks/bash_rewriter_hook.py` | risponde con `permissionDecision: allow` e `updatedInput` col comando riscritto |
| `hooks/read_guard_hook.py` | inietta `limit` su una `Read` non delimitata oltre 600 righe; attivo di default |
| `hooks/tool_capture_hook.py` | sandbox dell'output → `ts://capture/{id}` (`PostToolUse`) |
| `src/token_savior/truncation.py` | «[tronque] N element(s)... soit exactement la borne demandee» |
| `hooks/ts_discipline_guard.py` | «710 were false positives, 68.5%»; «le premier appel est refuse et enseigne, le second passe» |
| `src/token_savior/tool_annotations.py` | «readOnlyHint defaults to false... a CI failure, not a silent mislabel» |
| `scripts/audit_budget.py` | «Bash (sorties de commande) 30,0 %; Read de code 26,5 %» |
| `docs/progressive-disclosure.md` | memoria a 3 livelli per costo crescente (~15 / ~60 / ~200 token a risultato) |
| `AGENTS.md` | «Hooks | Aucun standard | ... c'est la seule couche a ecrire» |

## Domande aperte

- Non ho letto l'intero albero eseguibile: restano fuori, letti solo in parte, `src/token_savior/tool_schemas.py`, `src/token_savior/server_handlers/tool_search.py` (il router `ts_search` per il manifest sottile), `src/token_savior/edit_verifier.py` (i "Proof-Carrying Edits"), `src/token_savior/memory/rules.py` e i ~300 file di `tests/`. Il giudizio poggia sull'asse del tema (hook, rewriter, compactors, capture, troncamento, guardie, gate del bench); il resto è contorno e non l'ho usato per concludere.
- I numeri di testa (97,9% / −80%) **non sono verificabili**: l'harness non è pubblico e il progetto stesso li dichiara tali e ritirati in una ri-misura. Ogni affermazione di questa nota sul *comportamento* poggia sul codice letto, non su quei numeri.
- Non ho eseguito nulla del target (niente installazione, niente script), per la regola del cantiere: il comportamento dei compactors e delle regole di rewrite è dedotto dal loro codice e dai loro test, non osservato in esecuzione.
