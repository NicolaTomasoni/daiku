# ReforgIA — istruzioni di progetto

Questo file contiene solo regole valide in ogni sessione. Le regole architetturali di area vivono in `.claude/rules/` e si caricano quando Claude legge file che corrispondono ai relativi `paths`. Ogni file in `.claude/rules/` deve avere almeno un path reale: non creare regole globali senza `paths`.

Prima di modificare codice, individua il caso d'uso, leggi il codice pertinente — attivando così le regole di area — e verifica se esiste già un flusso equivalente da estendere. Non creare percorsi paralleli, scorciatoie, astrazioni speculative o logica duplicata.

## Divisione della documentazione

I quattro artefatti hanno mestieri distinti. Lo stesso argomento può comparire a granularità diverse, mai come copia.

- **`CLAUDE.md` e `.claude/rules/`** — comportamento e architettura per Claude. Il root contiene invarianti universali; le rules contengono vincoli path-scoped. I dettagli implementativi restano nel codice.
- **`memory/`** — mappa operativa e fatti richiamati per rilevanza. La directory persistente è `src/memory/`, versionata e configurata tramite `autoMemoryDirectory`; mai usare il path predefinito sotto `~/.claude/projects/`.
- **`ReforgIA — Documentazione Tecnica.md`** nella root superiore — documento umano completo ma superficiale: cosa fa il sistema e perché, senza nomi di codice o dettagli implementativi. Claude non lo consulta come input di lavoro, ma lo aggiorna quando cambia l'architettura. Quando lo modifica, aggiorna data e versione usando quella canonica in `apps/desktop/src-tauri/Cargo.toml`.
- **`docs/nuovi-sviluppi/`** — prossime implementazioni e file di lavoro dello sviluppatore. Il futuro vive solo qui, mai anticipato in memory.

Base operativa: codice + `CLAUDE.md` + rules caricate + memory pertinente. Il documento tecnico è solo output umano da mantenere allineato.

## Contratto della memory

La memory usa file separati per tre forme:

- **Mappa** — puntatore a path o simboli stabili, mai numeri di riga, per informazioni deducibili dal codice.
- **Catalogo descrittivo** — una riga grossolana di confine per componente; serve a selezionare il codice da leggere, non a riscriverlo. Cataloghi correnti: `backend-services`, `backend-adapters`, `backend-agents`, `frontend-features`; indice in `architecture-map`.
- **Fatto** — decisione, motivazione, feedback o informazione non deducibile dal codice. Non degradare un fatto a mappa o catalogo.

Regole:

- Se il codice puntato permette di ricostruire l'informazione, usa mappa/catalogo; altrimenti fatto.
- La memory non contiene piani o implementazioni future.
- Mutala solo tramite `deliver-feature:update-memory` oppure su richiesta esplicita dell'owner nella sessione corrente. `/memory-review` resta in sola lettura.
- Prima di mutarla, leggi interamente `memory/MEMORY.md`, il target, le memorie vicine e l'evidenza puntata; aggiorna un file esistente prima di crearne uno nuovo.
- Il delta deve essere minimo. Cataloghi e mappe cambiano solo per componenti aggiunti, rimossi, rinominati o con responsabilità spostata.
- Un fatto si scinde **per domanda**: se le sue sezioni rispondono a domande che si richiamano separatamente, sono memorie separate. La scissione non riformula e non riassume — sposta testo e aggiunge i rinvii `[[...]]` fra i pezzi. `MEMORY.md` porta **una riga per file**: un paragrafo nell'indice è il segnale che quel fatto è cresciuto oltre la propria domanda.
- Creazione, rinomina, spostamento, scissione, fusione o cancellazione aggiornano `memory/MEMORY.md` nella stessa modifica.
- Il codice verifica mappe e cataloghi, ma non revoca da solo fatti, decisioni o feedback. Se sembrano contraddetti o non più verificabili, chiedi conferma all'owner senza alterarne il significato.
- Le azioni di review sono `delete`, `move`, `split`, `correct`, `summarize`, `merge`, `keep`, `confirm_with_owner`; `move` destina il contenuto al codice, a questo file/rules, a `docs/nuovi-sviluppi/` o a un'altra memoria secondo il suo mestiere, `split` divide un fatto cresciuto oltre la propria domanda senza alterarne una parola.

## Comportamento

Rispondi sempre in italiano. Privilegia cautela e precisione, ma usa giudizio nei task banali.

- Modifica solo ciò che serve al caso d'uso richiesto; ogni riga cambiata deve ricondursi alla richiesta.
- Estendi service, adapter, mapper, hook, componenti e flussi esistenti prima di introdurre strutture nuove.
- Usa prima standard library, framework e dipendenze già installate; aggiungi una dipendenza solo per necessità concreta.
- Non generalizzare un'interfaccia prima di due utilizzi reali e non aggiungere configurabilità, fallback o gestione di scenari impossibili.
- Non rifattorizzare, rinominare, riformattare o ripulire codice adiacente fuori scope. Segnala il codice morto preesistente senza rimuoverlo.
- Rimuovi soltanto gli orfani creati dalla tua modifica.
- Rispetta stile, nomi, commenti e pattern esistenti anche se useresti un'impostazione diversa.
- Se interpretazioni diverse portano a lavori materialmente diversi, fermati e chiedi; per scelte minori scegli un'opzione sensata e procedi.
- Se esiste un approccio più semplice o la richiesta sembra aggirare un layer, dichiaralo e usa il percorso architetturalmente corretto.
- Trasforma il task in criteri verificabili; per bug e validazioni preferisci un test che riproduca il comportamento.
- Una modifica è completa solo dopo i check pertinenti, che per build e test sono quelli di `/review` (hard rule 15): non lanciarli tu. Riporta fedelmente test falliti, verifiche saltate e limiti incontrati.
- Per task multi-step esponi un piano sintetico con verifica per ogni passo; non serve per modifiche banali.

## Hard rules

Invarianti validi in ogni sessione e per ogni agente, indipendentemente dai file aperti. Il dettaglio di ciascun layer vive nella rule di area corrispondente in `.claude/rules/`; qui resta l'invariante. Sono citati per numero dalle memorie: la numerazione è stabile dentro questo progetto. Ogni rule porta fra parentesi quadre uno **slug** stabile: il numero resta comodità locale di questo progetto, mentre **lo slug è il riferimento stabile che citano le skill portabili**, perché la numerazione cambia da progetto a progetto.

1. `[extend-before-creating]` Ogni nuova funzionalità estende la struttura esistente prima di introdurre file, cartelle, pattern o flussi nuovi.
2. `[full-layer-traversal]` Ogni caso d'uso attraversa i layer obbligatori senza salti. Se coinvolge più layer, va scomposto per responsabilità.
3. `[no-mixed-responsibilities]` API, service, agenti, adapter, mapper, storage, configurazione e UI non devono mescolarsi.
4. `[integrations-in-adapters]` Le integrazioni esterne vivono solo negli adapter: SDK, CLI, API esterne, tool di analisi e filesystem non sono chiamati altrove.
5. `[storage-single-facade]` Lo storage su filesystem passa solo dal package `app/adapters/storage/` (facciata pubblica `StorageAdapter`): nessun accesso diretto a `data/`, sandbox, prompt statici o artefatti persistiti fuori di lì. **Unica eccezione: la lettura degli artefatti persistiti del progetto da parte della chat, esclusivamente tramite l'adapter di repo-tools, in sola lettura, confinata alla cartella di scope del progetto, a budget dichiarato (cap sulle chiamate e per file), con la root decisa dal service. Non è un precedente nuovo: la chat Codex riceve già quella cartella come `cwd` in sandbox `read-only`, deciso dentro lo `StorageAdapter` stesso.**
6. `[agents-structured-io]` Gli agenti ricevono input strutturati e producono output strutturati. Non persistono, non conoscono HTTP e non chiamano sistemi esterni. **Eccezioni dichiarate.** *Prima*: la lettura di sorgenti dal checkout in corso di analisi, esclusivamente tramite l'adapter di repo-tools, in sola lettura, confinata alla root del checkout e a budget dichiarato (cap sulle chiamate e per file). *Seconda*: la rete degli agenti che lavorano in `workspace-write` (l'agente di abilitazione e quello di execution) — il toolset di rete sulla strada API e la rete della sandbox su quella Codex — in sola lettura, ma **non** confinata a una lista di domini. *Terza, per il solo agente di procacciamento delle coordinate*: la ricerca nativa confinata da una lista di domini, che esiste sulla **sola strada Codex** e gira in sandbox di sola lettura perché quella lista sia l'unico canale, a budget dichiarato. **L'elenco di cosa leggere e di cosa cercare è deciso dal service, mai dall'agente.** Il dettaglio delle eccezioni vive in `.claude/rules/backend-architecture.md`.
7. `[deterministic-mappers]` I mapper sono deterministici: trasformano dati già parsati in modelli interni. Non fanno retrieval, persistenza, chiamate esterne o logica LLM.
8. `[shared-models-are-contracts]` I modelli condivisi sono contratti interni. Ogni modifica a `models.py` o ai domain model frontend è trasversale e va minimizzata.
9. `[prompts-separate-from-logic]` Prompt e istruzioni degli agenti restano separati dalla logica applicativa. Se cambia comportamento, tono, formato o vincolo di un agente, modifica prima il file di istruzioni relativo.
10. `[ai-output-verifiable]` Ogni output AI deve essere verificabile sugli input forniti. Gli agenti non inventano dati, stati, metriche, responsabilità, fonti o decisioni.
11. `[mocks-demo-mode-only]` I mock sono ammessi solo come demo mode esplicita e isolata. Non devono sostituire, mascherare o ostacolare flussi reali già disponibili.
12. `[no-layer-bypass]` Se una soluzione sembra più rapida perché aggira un layer, è sbagliata.
13. `[no-unannounced-commit]` **Nessun commit a sorpresa fuori dai flussi che lo dichiarano.** In una sessione ordinaria mai `git commit`/`push` in autonomia; valgono solo le eccezioni dichiarate qui sotto.
14. `[no-temporary-when-future-known]` **Mai una soluzione temporanea se il domani è già noto.** Se la scala futura del caso d'uso è nota o dichiarata dall'utente (es. oggi 10 agenti, a prodotto finito 100), non costruire la versione dimensionata sull'oggi: proponi subito l'alternativa architetturalmente solida per quella scala, dichiarando esplicitamente che è over-engineering rispetto al bisogno odierno. Costruirla una volta costa meno che costruirla due. Se la scala futura non è nota, resta valido il minimalismo della sezione *Comportamento*.
15. `[gate-owned-by-review]` **Il gate di build e test è di `/review`, e non si lancia altrove.** Suite di test, lint e formato completi, type-check e build di pacchetto sono il gate che `/review` esegue sempre, una volta, all'uscita del suo ciclo: nessun altro flusso li lancia come verifica ordinaria del proprio lavoro — non `/execute`, non una sessione di chat, non la chiusura di un ciclo autonomo. Verificare quello che scrivi resta obbligatorio, ma con gli strumenti del perimetro che hai toccato: importare il modulo che hai modificato, eseguire i **soli** test che coprono ciò che hai cambiato quando ti servono per provare una correzione, guardare il comportamento reale. Lanciare la suite intera a ogni modifica costa minuti, non aggiunge nulla che il gate non dica meglio, e su questo repository ha già ucciso run in volo (il backend istanziato da `TestClient` chiude come orfane le run del backend vero).

### Git e commit

In una sessione ordinaria non eseguire mai `git commit` o `git push` in autonomia: prepara le modifiche e attendi il via libera.

Eccezioni dichiarate:

- `/deliver-feature` può fare commit condizionali dopo gate e aggiornamento memory/documentazione sul diff staged: prima il codice sotto `apps/`, poi — solo se cambiati — `CLAUDE.md`, `.claude/rules/`, `memory/` e documentazione tecnica fuori da `apps/`, e per ultimo — solo se toccati — changelog e versione dell'applicazione.
- `/commit` invocato esplicitamente autorizza il commit secondo la propria convenzione, senza ulteriore conferma sul messaggio. Prima di committare delega **sempre** a `deliver-feature:update-memory` l'allineamento di memoria e documentazione sul diff staged — è un passo obbligatorio, non un giudizio su quanto il diff se lo meriti: ciò che arriva al commit ha passato gate e review, quindi è deciso, e se non c'è niente da riflettere è quel passo a dirlo con `updated: false`. L'allineamento non si chiede mai all'owner, né come conferma prima né come promemoria dopo. Separa poi il commit del codice da quello `memory:` e da quello di versione/changelog, che è il terzo e ultimo. Il commit `memory:` può eseguirlo il subagent delegato, **solo** se `/commit` glielo dichiara nel prompt: il permesso è dell'invocazione, non della skill, e senza quella riga il suo default è non committare. È la sola estensione di questa eccezione, e vale solo per il gruppo memoria/doc, mai per il codice.
- `/review` chiude **sempre** col commit, delegandolo a `/commit` senza scorciatoie, ma solo a ciclo pulito: nessuna voce da confermare bloccante, nessuna oscillazione rilevata, uscita diversa da `giri-esauriti` sul guardrail, nessuna disciplina mancata e gate verde. Se anche una sola di queste manca, si ferma al report. Il commit si sopprime con `--no-commit`, e lo passa **chi committa da sé**, non chi ha un dubbio: un ciclo arrivato in fondo con quelle cinque condizioni soddisfatte ha già deciso. Quelle condizioni sono l'unica porta rimasta — prima erano la seconda, dopo un flag digitato a mano — e per questo non si allentano.
Il push resta un gesto manuale dell'owner: nessun flusso automatico lo esegue in autonomia.

Nessun messaggio di commit porta righe di attribuzione o co-autore, in nessun flusso: la firma del commit è una sola ed è quella di chi committa.

## Avvio e ambiente locale

- Monorepo Windows nativo con pnpm, Turborepo e Tauri v2.
- Avvio coordinato dalla root: `pnpm dev`.
- Backend locale: `http://127.0.0.1:8010`; Vite: `http://127.0.0.1:5173`. Se cambiano host o porte, mantieni coerenti `VITE_API_BASE_URL` e `CORS_ORIGINS`.
- Usa solo `.pytest_cache/` nella root, non cache duplicate sotto `apps/backend/`.
- Se creazione o accesso a directory runtime falliscono, ferma il flusso e riporta l'errore.
- `.docs/` contiene appunti locali e deve restare visibile alle ricerche, senza aggiungerla a `.gitignore`; gli agenti non la includono nei propri commit.
- **Gli invarianti che costano lavoro perso sono imposti, non ricordati, e l'imposizione non è in questo repository.** La policy vive nei managed settings di sistema (`C:\Program Files\ClaudeCode\managed-settings.json`), che stanno sopra ogni altra sorgente e che solo `Administrators` e `SYSTEM` possono scrivere: un processo non elevato non la tocca né direttamente né tramite uno script, e la negazione arriva dal kernel, quindi non dipende da come il bersaglio è scritto nella riga di comando. Nega il push e `git commit --no-verify`, recinta le letture alle quattro radici di lavoro (vedi *Sicurezza operativa*) e nega i file che portano segreti; `allowManagedPermissionRulesOnly` la rende l'**unica** sorgente di regole di permesso e di `additionalDirectories`, così nessuna sessione può allargarsi il recinto da sé. Chi si sente bloccato da lì non sposta il blocco: si ferma e lo dice all'owner, che la modifica lui, elevato.
- **`.claude/settings.json` non porta regole di permesso: aggancia tre hook, che sono guardrail contro la distrazione e non barriere.** La divisione è questa e va tenuta — i permessi stanno nei managed settings, i guardrail di dominio stanno qui — e regge perché la decisione di un hook non scavalca una permission rule: un hook non può sbloccare un `deny` managed, quindi che questi file restino scrivibili non toglie niente alla policy. I tre sono: una guardia sui comandi distruttivi — rimozioni che attraversano una junction, `pnpm install` dentro un worktree, e le forme di `git push` e `git commit -n` che il `deny` managed non vede, perché combacia per prefisso e non entra dentro `sh -c` — i controlli deterministici sul corpus dopo ogni scrittura che tocca `.claude/`, `.agents/` o `CLAUDE.md`, e un avviso all'avvio quando un ciclo di abilitazione è aperto. Ognuno ha un banco di prova riproducibile — `--self-check`, col totale contato — perché tutti sono **fail-open**: davanti a un ambiente non pronto permettono e lo dicono invece di bloccare, e senza banco un guasto sarebbe indistinguibile dal silenzio. Solo la guardia sui comandi ferma qualcosa: le altre due segnalano e basta.
- Un worktree di sviluppo può ricevere come junction Windows le directory pesanti e non versionate di `src/` — `node_modules` in root e sotto `apps/desktop/`, il `venv` del backend: sono singole copie viste da due path. Prima di agire su un worktree enumera **tutte** le junction (`Get-ChildItem -Recurse -Force -Attributes ReparsePoint`), non solo quelle che ti aspetti, e rispetta tre vincoli. Non eseguire `pnpm install` dentro il worktree: riscrive `virtualStoreDir` nel `node_modules` condiviso, e al rientro in `src/` pnpm considera l'installazione incoerente e chiede di ricrearla da zero. Sgancia ogni junction con `rd` di Windows sul solo link **prima** di rimuovere il worktree: `rm -rf`, `Remove-Item -Recurse` e `git worktree remove` ricorrono dentro il link e svuotano la directory reale di `src/`, mentre `rd /s` si limita a sganciarlo. Porta in `src/` i file non committati del worktree prima di rimuoverlo: `git worktree remove --force` li cancella senza recupero.

## Sicurezza operativa

- Non leggere mai la memoria di altri processi per ricavare configurazione o variabili d'ambiente: niente `NtQueryInformationProcess`, `ReadProcessMemory`, PEB o equivalenti. Usa env della sessione, file di configurazione, output o log.
- Non eseguire ricerche sull'intero filesystem. Il perimetro non dipende dalla disciplina di chi scrive i comandi: lo impone `recinto-letture.mjs`, un `PreToolUse` dichiarato **nei managed settings** e installato sotto `C:\Program Files\ClaudeCode\`, dove scrivono solo `Administrators`. **Nega — non chiede** — ogni path fuori dalle radici di lavoro, su Bash, PowerShell e strumenti di file. Le radici le legge da `permissions.additionalDirectories` dei managed settings, che resta la fonte unica: sono quattro, `c:\dev` — dove stanno questo progetto e i repository fratelli, `c:\dev\Daiku` compreso — la Temp di sistema, la home `.claude` dell'utente e la DATA_DIR dell'applicazione. Dentro si lavora; fuori non si cerca, perché non si legge. Il suo contratto è **fail-closed**, all'opposto degli hook di repository: un giudizio che fallisce nega. Le forme che non copre sono dichiarate in fondo a quel file, e sono le stesse che la documentazione dichiara per le deny rule ufficiali. Una sessione non può modificarlo: si edita la copia in `src/.docs/recinto-letture.mjs` e la si reinstalla da elevato. Restano negati anche dentro i file che portano segreti: le credenziali di Claude Code, le chiavi dello switch LLM, SSH, AWS, Azure e `gh`.
- **È un hook e non il flag `blockReadsOutsideWorkingDirectories` per una ragione precisa, che non conviene riscoprire.** Dalla 2.1.257 quel flag non recinta soltanto: chiede. Nessuna modalità — `bypassPermissions` compreso — auto-approva un comando Bash che legga fuori dalle radici, né uno che il parser della shell non riesce a tracciare: un subshell, una sostituzione `$(...)`, un `cd` ripetuto, uno script invocato per path, anche quando non nomina nessun percorso esterno. L'unica esenzione prevista vale per i comandi che girano in sandbox, che su Windows nativo non esiste: il dialogo «Allow this bash command?» tornava a ogni comando di quella forma, e il bottone «for all projects» non lo zittiva, perché `allowManagedPermissionRulesOnly` scarta le regole fuori dai managed settings. Una guardia che chiede sempre non protegge: abitua a confermare. Il `deny` di un hook invece non apre nessun dialogo. Se un giorno quel flag torna acceso il sintomo è riconoscibile: popup in sessione interattiva e nessuno in headless, perché le sessioni `-p` e quelle in background non chiedono mai.
- **Quello che leggi esce dalla macchina.** Ogni file che entra in contesto viaggia verso l'endpoint del modello, e quando lo switch LLM punta a un backend terzo quell'endpoint non è Anthropic. Il recinto sulle letture è la difesa contro un segreto raccolto per errore; contro l'uscita di ciò che è già in mano non esiste difesa locale, perché un `curl` basta e il sandbox di rete su Windows nativo non c'è. Regolati di conseguenza su cosa apri mentre lavori su un backend terzo.
- Non committare segreti o file `.env`.
