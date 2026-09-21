---
name: 'review'
description: 'Ciclo di review su un diff — baseline congelata, giri che si fermano quando il codice smette di cambiare, ledger dei rilievi già giudicati. Il giro 1 fa il fan-out dei finder (bug sempre, arch/perf dallo scope), i giri successivi rivedono i soli fix appena scritti. Gate una volta all''uscita, poi il commit, che chiude sempre il ciclo salvo --no-commit. Orchestrata da te, delegando ogni fase a un subagent. Stessa disciplina che /develop-feature esegue nella sua fase Review.'
argument-hint: '[file... | base-ref | path a "4. review-notes.md"] [--rounds N] [--effort low|medium|high] [--with arch-check,perf,test-coverage] [--no-commit] [--backend <nome> se la sessione gira lì]'
---

Sei il **motore di un ciclo di review** su un diff. Un giro è scope → finder → applicazione dei fix; il ciclo decide da sé quanti giri fare, guardando cosa il giro ha appena prodotto. Poi il gate, una volta sola. Infine il commit, che chiude sempre il ciclo salvo `--no-commit`. Orchestri tu, delegando ogni fase a un subagent secondo `contracts/orchestration.md`.

Questo file è la **fonte unica** della disciplina di review del progetto: `develop-feature` lo esegue nella sua fase Review. Se cambia la review, si tocca qui e basta.

**Perché è un ciclo e non una passata.** I fix che l'applicatore scrive sono codice nuovo che nessun finder ha visto: per costruzione, un giro che applica fix si lascia dietro un perimetro non revisionato, e il gate verifica che compili, non che sia corretto. È la classe di difetto che nessuna singola passata può trovare — una correzione che ne rompe un'altra — e l'unico modo di vederla è rivedere i fix.

> **Parametri.** Ogni chiave fra graffe di questo contratto si risolve sui file di parametri del progetto, mai a memoria e mai per assunzione: le regole sono nella §5 di `contracts/project-contract.md`, che dice anche **in quale lingua scrivere** e cosa fare quando una chiave non c'è.

## Quando usarla

- **Il diff di una feature**, consegnato da `execute` o scritto a mano, quando vuoi la sola review senza l'intera catena `develop-feature`.
- **Le modifiche puntuali stratificate in chat**, una serie di richieste che a fine giornata si sono accumulate su molti file e vanno confermate prima di consegnarle.

Cambia solo l'ampiezza del giro 1, che è il ciclo stesso a decidere leggendo il diff. Non c'è una modalità da dichiarare.

## Input

Argomenti: `$ARGUMENTS`. **Il default è il caso normale, e non richiede argomenti**: senza niente rivedi ciò che hai in mano, cioè le modifiche non committate sotto `{code_root}` rispetto a `HEAD`, incluse le non tracciate. Gli argomenti servono a dire qualcosa di diverso da quello.

- **Vuoto** — il default: `git diff HEAD -- {code_root}` più i file non tracciati, cioè il lavoro corrente dentro il perimetro in cui vive l'applicazione. Nient'altro entra nello scope, nemmeno se è cambiato.
- **Uno o più path** (file o cartelle, separati da spazio): la baseline resta `HEAD` e lo scope è il diff **limitato a quei path**, intersecato comunque con `{code_root}`. È la forma per rivedere una parte di ciò che hai in mano invece di tutto: un path che non ha modifiche non aggiunge niente allo scope, e se nessuno dei path ne ha, fermati e dillo invece di rivedere tutto il resto.
- **Base-ref** (branch, tag, SHA, per esempio `main`): base del diff. Si riconosce perché `git rev-parse --verify` lo risolve e sul filesystem non esiste un path con quel nome; nel dubbio — un branch che si chiama come una cartella — vale il **path**, ed è il caso in cui lo dichiari nell'esito invece di sceglierlo in silenzio.
- **Path a `4. review-notes.md`** (o alla cartella che lo contiene): verifica che esista; il base-ref lo dichiara quel file.
- **`--rounds N`** (opzionale): tetto esplicito, per troncare il ciclo a mano. Senza, il numero di giri lo decide l'andamento (§ *Quando fare un altro giro*) e l'unico tetto è il guardrail a `6`.
- **`--effort low|medium|high`** (opzionale): profondità dei finder. Default `medium`. Su un perimetro davvero puntuale — una manciata di file — `high` produce soprattutto rilievi incerti da scartare a mano; su un perimetro largo, decine di file e più layer, si ripaga: è la profondità alla quale i giri continuano a trovare difetti reali invece di rumore.
- **`--with arch-check,perf,test-coverage`** (opzionale): sono i **valori** a decidere cosa forzare. `arch-check` e `perf` forzano la disciplina attiva al giro 1, a prescindere da cosa deciderebbe lo scope; `test-coverage` forza la fase Copertura dopo il ciclo (§ *Copertura*), togliendo al worker la facoltà di saltarla. Override manuale esplicito, mai una disattivazione.
- **`--no-commit`** (opzionale): sopprime il commit di chiusura, e il ciclo si ferma al report. Lo passa **chi committa da sé** — `develop-feature`, che ha una fase di commit propria — non chi ha un dubbio sul diff: un ciclo che arriva in fondo con gate green e nessuna voce bloccante ha già deciso, e le condizioni di § *Chiusura* sono lì proprio per fermare tutto il resto.
- **`--backend <nome>`** (opzionale): il nome del backend su cui la sessione gira, da dichiarare solo se non è quello nativo dell'host; incide unicamente sulla concorrenza del fan-out, ed è `contracts/orchestration.md` §5 a dire se quel backend la sequenzializza.
- Se il primo argomento non risolve a un base-ref o a un path valido, chiedi — non indovinare.

**Vincolo hard di scope:** la review copre sempre e soltanto file sotto `{code_root}`. Nessun file esterno entra nei finder o nei fix, anche se modificato, non tracciato o citato nelle review-notes. Tutto ciò che non sta sotto `{code_root}` — documentazione, memoria, contratti delle skill — è competenza di `update-memory`, che il contratto di commit delega da sé. Il changelog no: lo rivendica `skills/commit/SKILL.md` nella propria § *Bump di versione e changelog* e lo scrive direttamente, senza passare da `update-memory`.

## Prima di iniziare

Leggi `contracts/orchestration.md`: ruoli, host, delega, concorrenza. Ogni fase dichiara il proprio ruolo e tu risolvi il modello con la regola della sua §2 — mai da qui.

### Quando la review gira su un worktree

Quando chi ti invoca ti passa una radice di lavoro (il worktree) oltre all'albero principale: ogni comando Git, il diff, i fix, la copertura e il gate girano nella radice di lavoro; il ledger (`{paths.review_state}/`) e `5. review-report.md` si scrivono nell'albero principale. Il base-ref è lo SHA che `4. review-notes.md` dichiara: congelalo con `git rev-parse` nella radice di lavoro e non ricalcolarlo. Il commit resta regolato da `--no-commit` come sempre.

## Preparazione — una volta sola

### Scope — ruolo **worker**

Subagent che calcola lo scope con Git reale. Non ha un contratto proprio da leggere: tutto ciò che deve fare sta nel prompt, e nel prompt ci metti il **base-ref** di questa esecuzione, il pathspec obbligatorio `{code_root}`, i tre comandi qui sotto, il criterio delle due discipline condizionali e il blocco da restituire — più il vincolo di **sola lettura**, che nessuno strato dell'harness impone a chi ha `Bash` (§4 di `contracts/orchestration.md`).

I comandi: `git status --porcelain -- {code_root}`, `git diff --stat <base> -- {code_root}`, `git ls-files --others --exclude-standard -- {code_root}`. Mai includere file esterni a `{code_root}`.

Se l'invocazione ha ristretto lo scope a un **elenco di path** (§ *Input*), quei path entrano nei tre comandi come pathspec **dopo** `{code_root}`, non al suo posto: il perimetro dell'applicazione resta il confine esterno, e la restrizione lavora dentro di esso.

Decide anche le due discipline condizionali:

- **arch-check** attiva se il diff tocca un file coperto dalle regole architetturali: elenca `.daiku/policies/`, leggi il frontmatter `paths` di ogni file e verifica se almeno un pattern copre un file dello scope. L'elenco delle regole è la sola fonte: non tenere una lista di layer qui;
- **perf** attiva se il diff tocca un percorso caldo (rendering, polling, loop, query, serializzazione, flusso ad alta frequenza).

```json
{"base_ref": "<ref>", "files": ["<path>"], "arch_active": false, "perf_active": false}
```

Normalizza i path con slash `/` e scarta tutto ciò che non inizia per `{code_root}`. Applica poi gli override di `--with`. **Se non resta alcun file, fermati**: non c'è nulla da rivedere, dillo e chiudi.

### Baseline e ledger

1. **Congela la baseline**: `git rev-parse <base-ref>` → `BASE`. Tutti i giri usano questo SHA, mai un `HEAD` ricalcolato. I fix che applichi entrano nel diff: se ricalcolassi la base a ogni giro, lo scope si sposterebbe sotto i piedi al ciclo.
2. **Apri il ledger**: `{paths.review_state}/review-ledger-<BASE breve>-<HHMMSS di avvio>.json` (le prime sette cifre dello SHA, l'orario di avvio della review). È il file che rende economici i giri successivi. Il nome porta baseline e orario perché più review possono girare nella stessa sessione — e una consegna ripresa riparte dallo stesso commit — e perché un ledger di una review precedente sulla stessa baseline porterebbe ai finder gli scartati di un altro diff. Sede: `{paths.review_state}/` sotto la radice tecnica — fuori dal repository versionato — se il `.gitignore` non la copre, dillo in chiusura invece di scriverci dentro comunque — ma **stabile**, non a scadenza di sessione.

**Il ledger dichiara di chi è.** Alla riga `base` si affianca `item`: l'identità del lavoro che questa review sta rivedendo — la **cartella di lavoro**, normalizzata con slash `/`, quando l'input era `4. review-notes.md` o la cartella che lo contiene; `null` su una review lanciata a mano su un base-ref nudo. Scriverlo costa una riga e serve al passo dopo: la baseline **da sola non identifica una review** — una consegna ripresa riparte dallo stesso commit, e due review diverse possono condividere lo stesso `base`.

**Non si riapre mai un ledger che hai trovato da solo.** Si riapre solo quello il cui path ti è stato consegnato nel prompt da chi ti invoca, e solo se **entrambi** i campi coincidono: il `base` con il `BASE` di questa esecuzione, e l'`item` con il lavoro che stai rivedendo. È la ripresa della **stessa** review interrotta, non il ledger di un'altra. In quel caso riparti dal giro successivo all'ultimo registrato, con i suoi applicati e scartati già in mano. Senza quel path, ledger nuovo.

**Se i candidati restano più di uno, non si sceglie**: ledger nuovo, e lo dichiari in chiusura. Vale anche quando il ledger consegnato non porta `item` — è di prima di questa regola, e non sai di chi è. Aprirne uno nuovo costa un triage; prendere quello sbagliato porta ai finder gli `discarded` di un altro diff, all'applicatore `applied` le cui `anchor` nel suo codice non esistono, e fa girare `on_previous_fix` e `oscillation` contro le stringhe di un'altra feature — cioè rompe in silenzio i due segnali su cui il ciclo decide.

Perché serva a qualcosa, il ledger deve essere **raggiungibile**: il suo path entra nel blocco di ritorno (§ *Esito*), e senza di esso una review interrotta al quarto giro riparte da zero — si ripaga l'intero triage e, soprattutto, spariscono le `anchor` degli applicati, quindi `on_previous_fix` e `oscillation` non possono più scattare sui fix già scritti. Sono i due segnali su cui l'intero criterio di iterazione è costruito.

```json
{"base": "<sha>", "item": "<cartella di lavoro, o null>", "rounds": [{"n": 1, "disciplines": ["bug"], "missing_disciplines": [], "applied": [{"file": "", "symbol": "", "anchor": "", "line": 0, "what": "", "severe": true, "on_previous_fix": false}], "discarded": [{"file": "", "symbol": "", "line": 0, "why": ""}], "to_confirm": [], "oscillation": [{"file": "", "symbol": "", "current_anchor": "", "previous_anchor": ""}], "verdict": "continue|stop", "why": ""}], "outcome": null, "coverage": null, "gate": null, "gate_detail": null}
```

### Il ledger conserva anche ciò che blocca, non solo ciò che fa ripartire

I `rounds` fanno ripartire il ciclo; i quattro campi in coda — `outcome`, `coverage`, `gate`, `gate_detail` — e `missing_disciplines` dentro ogni giro sono ciò su cui il **commit** si ferma. Senza di essi una ripresa li perde tutti, e li perde in silenzio: nel ledger una disciplina mai tornata e una disciplina mai attivata producono la stessa identica riga.

- **`missing_disciplines` si scrive nel giro in cui la disciplina non è tornata**, subito, con lo stesso nome che userà il blocco finale. È il campo che distingue i due esiti che si somigliano (§ *Finder*). Alla ripresa, `missing_disciplines` del blocco finale è l'**unione** di quelli di tutti i giri registrati: una `arch` mancata al giro 1 blocca il commit anche se la sessione è caduta al giro 3 e la ripresa ha chiuso a `fixed-point`. `arch` e `perf` si fanno una volta sola al giro 1: quello che non hanno visto allora non lo vedrà nessuno, mai.
- **`outcome`, `coverage`, `gate` e `gate_detail` si scrivono appena li hai**, non alla fine insieme al report: `outcome` quando esci dal ciclo, `coverage` quando la fase Copertura torna, `gate` e `gate_detail` quando il gate torna. Restano `null` finché quel passo non è girato, ed è quella distinzione a rendere la ripresa possibile.
- **Alla ripresa non si rifà ciò che il ledger dichiara già fatto.** Se l'ultimo giro registrato porta `verdict: "stop"`, il ciclo era già uscito: non aprire un altro giro — salta al primo passo che nel ledger è ancora `null`, nell'ordine copertura → gate → chiusura. Un gate già verde ripagato è l'intera suite, cioè proprio la risorsa che il gate, girando una volta sola, esiste per non spendere due volte.

### Come si identifica un fix, fra un giro e l'altro

**Mai per numero di riga.** Un fix sposta tutto ciò che sta sotto di sé: al giro 3 «la riga 88 che avevo corretto» non è più la riga 88, e i due segnali su cui questo ciclo decide — `on_previous_fix` e l'uscita `oscillation` — scatterebbero a caso o non scatterebbero mai.

Ogni fix si registra con due ancore che sopravvivono ai giri successivi:

- **`anchor`** — il testo della riga corretta dopo il fix, normalizzato agli spazi, troncato a ~80 caratteri. È l'**identità del fix**: due fix con la stessa `anchor` nello stesso file sono lo stesso fix.
- **`symbol`** — il nome qualificato del contenitore in cui il fix sta: `Classe.metodo`, `funzione`, `ComponenteReact`, o il nome della costante/blocco di modulo per il codice fuori da una funzione. Serve a **orientarsi** e a **raggruppare** — è il criterio con cui l'uscita `oscillation` (§ *Uscite*) individua due fix che si rimpallano la stessa area — ma da solo non identifica un fix.

`line` resta nel ledger come **indicazione per il lettore umano**, mai come identità: non confrontarla mai fra giri diversi.

### I due segnali si verificano, non si accettano

`severe` è un giudizio di merito e resta dell'applicatore: nessun altro ha in mano il contesto per darlo. `on_previous_fix` e `oscillation` no — sono **misure su stringhe**, e le fai tu dopo ogni giro, prima di emettere il verdetto. È la stessa asimmetria che regge il ciclo: chi ha scritto i fix non è la fonte del segnale che decide se qualcuno li rileggerà.

Con il ledger in mano, entrambe costano un comando:

- **`oscillation`**: per ogni fix nuovo, l'`anchor` coincide con una già registrata per lo stesso `file` e `symbol` in un giro **precedente a quello dell'ultimo fix**? È un confronto di stringhe sul ledger, e l'identità di un fix è già definita così (§ *Come si identifica un fix*). Il confronto gira anche sulle voci del campo `oscillation` dell'applicatore, che porta le due ancore di ogni fix che ha soppresso: quei fix non sono fra gli `applied` proprio perché non sono stati applicati, e senza le loro ancore l'unica stop condition del ciclo resterebbe un'autodichiarazione del passo che verifichi. Le sue voci entrano nel ledger del giro come le altre.
- **`on_previous_fix`**: l'`anchor` di un fix di un giro precedente non compare più nel suo file (`git grep -F '<ancora>' -- <file>` a vuoto), oppure cade fra le righe che il fix nuovo ha toccato. Entrambi i casi dicono che una correzione ne ha riscritta un'altra.

Se la tua verifica e il blocco dell'applicatore divergono, **vale la tua**: annota lo scostamento nel ledger accanto al fix, perché un applicatore che sistematicamente non li vede è esso stesso un rilievo. La regola 2 di § *Quando fare un altro giro* legge i valori verificati, non quelli dichiarati.

## Il ciclo

### Quali discipline girano, a quale giro

È la regola che tiene insieme il fan-out e l'iterazione, e vale la pena capirla prima di eseguirla.

| Giro | Discipline attive | Scope del giro |
|---|---|---|
| **1** | `bug` sempre; `arch` e `perf` se lo scope li ha attivati | tutto il diff: `git diff <BASE> -- {code_root}` |
| **≥2** | `bug` soltanto | i soli file toccati dall'applicatore nel giro precedente |

Due motivi, entrambi strutturali.

`arch` e `perf` giudicano una **forma sul diff intero**: dove sta un layer, quale percorso è caldo, quale astrazione era già disponibile altrove. Rigirarle al giro 4 sui due file toccati dai fix non è una review più accurata, è una domanda mal posta. Si fanno una volta, sul diff completo, quando la forma è ancora tutta visibile.

`bug` giudica **righe**, e le righe cambiano a ogni giro. È la sola disciplina che ha senso riportare sul delta, ed è anche la sola il cui rilievo mancato costa una regressione.

Effetto sul costo: il giro 1 costa quanto una passata completa, i giri successivi quanto un finder solo su una manciata di file. La parte iterativa resta magra per costruzione, senza bisogno di spegnere niente.

### Finder — ruolo **worker**, in parallelo

Un subagent per disciplina attiva del giro. Ciascuno riceve come contratto da leggere `skills/finder-prompt/SKILL.md`, che dichiara cosa legge, su quale scope, con quale perimetro di lettura e in che forma restituisce i rilievi: **non ricopiarlo nel prompt** — un contratto ricopiato si erode di giro in giro, e le righe che si perdono per prime sono quelle che tengono insieme il ciclo.

Nel prompt di ciascun finder metti **solo ciò che cambia**, già risolto:

- il path del contratto (`skills/finder-prompt/SKILL.md`);
- la **disciplina** assegnata;
- `BASE`, e dai giri ≥2 l'elenco dei file toccati dall'applicatore nel giro precedente;
- il livello di **effort** del ciclo;
- dal giro 2: **applicati** e **scartati** dei giri precedenti, letti dal ledger;
- il **vincolo di sola lettura**, con queste parole: non modifica file e non esegue comandi che scrivono. Il suo contratto lo dichiara già, ma la §4 di `contracts/orchestration.md` chiede di ripeterlo qui lo stesso: il ruolo `finder` ha `Bash` intero, gli specificatori del suo toolset non restringono il contenuto di un comando, e un finder che «corregge già che c'è» non compare fra gli applicati e nessun giro successivo lo rivede.

I finder non si vedono tra loro: è voluto, ed è la separazione che produce rilievi diversi invece di una sola passata già convinta di sé. Lanciali nello **stesso** blocco di tool call per farli girare davvero in parallelo — in sequenza solo sui backend che `contracts/orchestration.md` §5 sequenzializza.

**Sharding dei diff grandi.** Al giro 1, sopra una soglia indicativa — più di duemila righe aggiunte o più di trenta file — il finder `bug` si spezza in più subagent per gruppi di file coerenti (per layer o per flusso), stesso prompt, ciascuno con il proprio sottoinsieme, lanciati insieme; i findings si uniscono prima dell'applicatore. `arch` e `perf` non si spezzano: giudicano la forma intera. È il motivo per cui la review di chiusura di un ciclo autonomo, che arriva con il diff di una corsa intera, può ancora rispettare «leggi ogni riga aggiunta per intero».

Ogni disciplina ha un proprio contratto, che `skills/finder-prompt/SKILL.md` indica e che dichiara **in casa** la propria modalità finder — scope, sola lettura, scala di confidenza, e quali parti del file non si eseguono qui. Quello di `bug` è il testo del plugin Claude, adattato ai ruoli del progetto e alla modalità finder: nessuna skill nativa dell'host è necessaria perché il ciclo esista.

**Un finder che non torna è una disciplina mancata, non una disciplina vuota.** Sono due esiti che si somigliano — meno rilievi — e non si distinguono più a valle, perché `arch` e `perf` si fanno **una volta sola** sul diff completo e non si rigirano mai: se qui non ha girato, su quel diff non ha girato nessuno. La regola è deterministica, e non la decidi giro per giro:

1. Un finder che non restituisce il blocco — prosa invece di JSON, blocco incompleto, subagent che non torna — **si rilancia una volta sola**, con lo stesso identico prompt.
2. Se non torna neanche allora, la sua disciplina entra in `missing_disciplines` — **nel ledger, nel giro in cui è successo**, e da lì nel blocco finale. Non entra in `disciplines_round_1`, che elenca chi ha **restituito**, e non si compensa lanciando un'altra disciplina al suo posto. Scriverla solo nel blocco finale la fa sparire alla prima interruzione, ed è la perdita che si nota meno: alla ripresa il ciclo esce pulito e il commit parte su un diff che quella disciplina non ha mai visto.
3. Un giro con una disciplina mancata **prosegue** — i rilievi degli altri finder valgono — ma il ciclo non può chiudersi in silenzio: `missing_disciplines` non vuoto blocca il commit come `rounds-exhausted` (§ *Chiusura*), e la consegna che la ospita fa lo stesso.

Il posto dove quella perdita si deposita è il blocco finale. Vale per ogni fan-out cieco: uno che non torna per intero è un fan-out parziale, e senza un campo che lo dica esce identico a uno completo.

### Applicatore — ruolo **worker**, saltato a rilievi zero

Se nessun finder ha prodotto rilievi il giro è a vuoto: al giro 1 significa che il diff era corretto al primo colpo, ai giri successivi che hai raggiunto il punto fisso. In entrambi i casi dillo in una riga e non lanciarlo.

Altrimenti **un solo** subagent, con `skills/applier/SKILL.md` come contratto da leggere: dichiara come decide ogni rilievo, come classifica ciò che applica e cosa restituisce. **Non ricopiarlo nel prompt.**

Nel prompt metti **solo ciò che cambia**, già risolto:

- il path del contratto (`skills/applier/SKILL.md`);
- i **rilievi di tutti i finder** del giro, raggruppati per disciplina;
- gli **applicati dei giri precedenti** dal ledger (`file`, `symbol`, `anchor`, `what`): servono per `on_previous_fix` e per l'oscillazione;
- lo scope del giro e la `BASE`;
- `{memory.index}` e i path delle memorie che lo scope tocca, da aprire prima di decidere (§4.1 di `contracts/orchestration.md`).

È l'**unico** passo del ciclo che scrive, ed è ciò che rende leggibile un giro: lo scope dei giri ≥2 sono i file che ha toccato lui, e l'identità di un fix è l'`anchor` che registra lui. Scrivi applicati, scartati e voci aperte nel ledger prima del giro successivo.

### Un passo che non torna, quando non è un finder

La regola dei tre punti di § *Finder* è la forma generale: **ogni** passo delegato di questo ciclo che non restituisce il proprio blocco — prosa invece di JSON, blocco incompleto, subagent che non torna — si rilancia **una volta sola**, con lo stesso identico prompt. Mai un terzo tentativo: un ciclo che rilancia finché ottiene una risposta non sta iterando, sta aspettando.

Lo **Scope** è il primo, e il più secco: se non torna neanche al rilancio, **fermati e dillo**. Senza scope non c'è un giro da fare, e ricostruirlo a intuito vuol dire rivedere un perimetro che nessuno ha delimitato.

Per gli altri cambia solo dove finisce il secondo fallimento, perché i tre passi non sono intercambiabili — e ciascuno usa un campo che già esiste, così il commit si ferma per la regola che già c'è:

- **applicatore**: il giro non ha prodotto fix e nessuno ha deciso i rilievi. Registralo nel ledger con `verdict: "stop"` e il motivo, esci dal ciclo, e apri una voce `to_confirm` con `blocking: true` che elenca i rilievi rimasti senza decisione. `git status` dice se ha fatto in tempo a scrivere qualcosa: se sì, quei file entrano nel perimetro del gate come gli altri.
- **copertura**: entra in `missing_disciplines` come `test-coverage`, ed è vero alla lettera — su quel diff la copertura non è stata valutata da nessuno, e la fase gira una volta sola dopo il ciclo. `coverage` resta `null` nel ledger.
- **gate**: `gate: "red"` con `gate_detail` che dice che il gate non è tornato, non che è fallito. Non è un tecnicismo: il campo è l'unica cosa che chi legge ha, e un rosso per silenzio si indaga diversamente da un rosso per test.

### Quando fare un altro giro

Il numero di giri non si decide prima di cominciare — si decide guardando cosa il giro ha appena prodotto. Dopo ogni giro, nell'ordine:

0. **Oscillazione rilevata** → esci, e l'uscita è `oscillation`. Viene prima di tutte perché è l'unica che può nascondersi dietro un'altra: l'applicatore sopprime il fix oscillante, gli applicati del giro scendono a zero, e la regola 1 dichiarerebbe `fixed-point` — cioè l'uscita pulita — su un ciclo che si stava rimpallando la stessa riga. Il campo `oscillation` del suo blocco la riporta, e tu la verifichi sul ledger come gli altri due segnali (§ *I due segnali si verificano, non si accettano*).
1. **Zero fix applicati** → punto fisso, esci. È l'uscita pulita.
2. **Almeno tre fix gravi** → un altro giro, senza discutere. Un perimetro che conteneva tre difetti reali ne conteneva abbastanza da contenerne ancora, e hai appena scritto il codice che li corregge.
3. **Altrimenti, verdetto di merito** — lo emetti tu, in una riga motivata nel ledger, e pesa **cosa** è stato applicato, mai quanto:
   - **continue** se anche un solo fix ha `on_previous_fix: true`: le tue correzioni stanno regredendo, e un giro che si ferma qui consegna proprio quel difetto;
   - **continue** se i gravi — uno o due — stanno su codice appena riscritto o toccano un flusso che il giro ha modificato in più punti: è un'area ancora calda;
   - **stop** se il giro ha prodotto solo rifiniture, o gravi isolati in aree che per il resto non ha toccato. Uscita `diminishing-returns`: dichiara quali fix ti hanno convinto a fermarti.

Il criterio **non** è «meno di N rilievi»: i rilievi che i finder *trovano* non scendono sotto soglia da soli — sotto una certa soglia continui a trovarne di diversi a ogni passata. Quello che si conta alla regola 2 è un'altra cosa: i fix **applicati** e **gravi**, cioè difetti già verificati sul codice e già corretti. Contare le segnalazioni ti fa uscire a caso; contare le correzioni gravi ti dice quanto era sporco il perimetro che hai appena riscritto.

### Uscite

Esci al **primo** che si verifica, e dichiara quale:

1. **`fixed-point`** — il giro ha applicato zero fix.
2. **`diminishing-returns`** — verdetto di merito negativo alla regola 3.
3. **`oscillation`** — l'applicatore ha rilevato, prima di applicare (il criterio è nel suo contratto), che l'`anchor` in uscita per un fix coincide con una già registrata nel ledger per lo stesso `file` e `symbol` in un giro precedente a quello dell'ultimo fix: il campo `oscillation` del suo JSON lo riporta con le due ancore, e **tu lo verifichi sul ledger** come gli altri due segnali (§ *I due segnali si verificano, non si accettano*) — se la tua verifica e il suo blocco divergono, vale la tua. Non si applica oltre: due giri che si rimpallano la stessa riga non stanno convergendo. Fermati e riporta entrambe le versioni. Attenzione a non confonderla con `on_previous_fix`, che è il caso sano e frequente — un fix che ne corregge un altro *avanzando*; qui invece si torna indietro.
4. **`rounds-truncated`** — hai raggiunto il tetto esplicito `--rounds N` passato a mano. Sei tu a troncare: sai cosa stai consegnando, non è un'anomalia.
5. **`rounds-exhausted`** — hai raggiunto, senza un `--rounds N` esplicito, il guardrail a **6**. Non è un budget da spendere: arrivarci è un'anomalia, perché significa che sei ancora lontano dal punto fisso su un codice che hai scritto tu. Riportalo come tale, con l'elenco dei gravi dell'ultimo giro.

Un diff corretto al primo colpo esce a `fixed-point` dopo un giro solo: il ciclo non impone un secondo giro a chi non ha nulla da correggere.

**L'uscita dice perché il ciclo si è fermato, non che la consegna sia sana.** Se restano voci `to_confirm` con `blocking: true`, il codice ha bivi aperti sulla propria correttezza anche a `fixed-point`: riportale insieme all'uscita, in prosa e nel campo `blocking` del blocco finale, e non chiamare «pulita» quell'uscita. Il commit, quando richiesto, non parte comunque (§ *Chiusura*).

## Dopo il ciclo

### Copertura — ruolo **worker**

Gira **sempre**, all'uscita del ciclo, mai dentro un giro: è il worker stesso a decidere se c'è qualcosa da scrivere. Riceve il diff finale `<BASE>..adesso` sotto `{code_root}`, `{memory.index}` e i path delle memorie che quel diff tocca (§4.1 di `contracts/orchestration.md`), ed esegue `skills/test-coverage/SKILL.md` in modalità `--auto`. I test devono coprire il codice **finale**, non quello intermedio: scriverli al giro 1 significherebbe coprire righe che i giri successivi riscrivono, e rifarli a ogni giro è lavoro buttato.

**Decide lui se il diff introduce logica nuova scoperta.** Se no, torna senza scrivere nulla, dichiarandolo nel proprio blocco, che ha due campi per questo e non uno. `--with test-coverage` gli toglie questa facoltà: forza la fase anche se altrimenti l'avrebbe saltata (§ *Input*).

Restituisce il blocco che quel contratto dichiara nella propria § *Modalità automatica*, **per intero e con quei nomi di campo**: leggilo da lì, non ridichiararlo qui.

Le sue voci `to_confirm` entrano nel ledger e nel blocco finale come le altre: è l'unica via per cui la classe `test-coverage` può comparire lì.

**Se ha scritto test, fai un giro di chiusura su di essi**: un finder `bug` sui soli file di test prodotti, e l'applicatore sui suoi rilievi. È lo stesso principio che regge tutto il ciclo — i test appena scritti sono codice che nessun finder ha visto — e costa un finder su pochi file. Un test che passa non è un test corretto: può affermare la cosa sbagliata, o non esercitare affatto il ramo che dice di coprire.

Qui l'applicatore gira nella propria § *Modalità giro di chiusura sui test*, che dichiara in casa lo scope ristretto ai file di test e cosa fare del difetto di produzione che un test rivela: **dichiaragli la modalità e non riscrivergli i vincoli nel prompt** — una lista di deroghe scritta qui si erode alla prima modifica di quel contratto, e la prima riga a cadere è quella che trasforma un difetto reale in una voce bloccante invece che in un rilievo scartato (§3 di `contracts/orchestration.md`). Questo giro non conta in `rounds` né nei contatori `applied`/`severe`/`discarded` del blocco finale: si riporta in prosa.

### Gate — ruolo **worker**, sempre

Gira **sempre**, anche a zero rilievi, e **una volta sola** all'uscita: è la verifica reale che il diff consegnato compili e passi i test, non un check da ripetere a ogni giro. Un subagent, che non applica modifiche funzionali e non tocca file fuori dallo scope.

Nemmeno lui ha un contratto proprio: quello che sa lo sa dal prompt, e nel prompt gli passi `BASE`, `{code_root}`, il modo in cui **ricalcola** da sé l'elenco dei file (qui sotto), le aree di `{areas}` con i rispettivi `{areas.<area>.paths}`, `{areas.<area>.lint_fix}` e `{areas.<area>.gate}`, il perimetro di ciò che gli è lecito correggere, e il blocco da restituire. Sul foreground vedi il capoverso qui sotto: è la riga che questa catena ha già pagato.

**È l'unico punto della catena di consegna che lancia la suite**: `execute` e le sessioni di chat non la eseguono perché la esegui tu. Su **questo** diff, se qui non gira, non ha girato nessuno. Quindi non saltarlo mai e non delegarlo a chi ti ha invocato.

**Il subagent del gate gira in foreground e fino in fondo.** Non lo metti in background, non lo sorvegli da un altro subagent, non frapponi attese attive (sleep, polling) fra te e lui: la suite dura minuti, e la catena si è già fermata una volta con tre livelli in attesa l'uno dell'altro. Vale per ogni delega di questo contratto: si attende il ritorno del figlio come fa l'host, senza attese attive.

**L'elenco dei file non è lo scope iniziale**: ricalcolalo qui da `git diff <BASE> --name-only -- {code_root}` più `git ls-files --others --exclude-standard -- {code_root}`, perché i fix e la copertura possono aver aggiunto file.

Poi gira **ogni area dichiarata in `{areas}` che il perimetro tocca**, e solo quelle: un'area la tocchi se almeno un file dell'elenco ricalcolato sta sotto uno dei suoi `{areas.<area>.paths}`. Vale anche se quei file non sono sorgenti — configurazione, dipendenze, comportamento: il gate dell'area gira comunque. Un'area che il perimetro non tocca non si gira. Per ciascuna, in quest'ordine:

1. **Vale solo se `{areas.<area>.lint_fix}` è dichiarata.** Pre-passo lint sui soli file ricalcolati: esegui `{areas.<area>.lint_fix}` sostituendo `<FILES>` con i soli file dell'elenco che stanno sotto `{areas.<area>.paths}`. Eseguilo **come dichiarato**, senza aggiungere flag: quello che quel comando non applica da sé non è sicuro qui. Risolvi i rilievi residui restando dentro l'elenco, con il consueto giudizio correzione-vs-soppressione-locale-motivata.
2. Poi il gate dell'area: esegui `{areas.<area>.gate}` e riporta l'esito reale dei comandi, caricando i moduli toccati per intercettare gli errori che si manifestano solo all'import.

Correggi da te **solo** ciò che è di natura lint/formato dentro l'elenco, e **solo a semantica invariata**: ciò che `{areas.<area>.lint_fix}` applica da sé, più una soppressione locale motivata. Il gate gira dopo l'ultimo finder, quindi qualunque cosa scriva qui è codice che nessuno rivedrà: se per far passare il lint servisse una modifica che cambia comportamento, **non farla** — riporta `gate: "red"` con quel dettaglio. Il ciclo **non si riapre** dopo il gate, che gira una volta sola: un rosso, qui, blocca il commit.

Se il rosso viene da test falliti o da un errore di compilazione/import, **non inventare un fix**: riporta `gate: "red"` con l'output reale.

```json
{"gate": "green|red", "gate_detail": "<esito effettivo dei comandi eseguiti, mai una dichiarazione non verificata>"}
```

### Chiusura — il commit chiude il ciclo

**Il commit è l'ultimo passo del ciclo, non un'opzione.** Una review che arriva qui con gate green e nessuna voce bloccante ha già deciso: il lavoro è consegnabile, e lasciarlo non committato non lo rende più sicuro — lo rende solo un albero sporco che qualcun altro dovrà interpretare. Chi committa da sé lo sopprime con `--no-commit` (§ *Input*); in ogni altro caso parte.

Il commit parte **solo** se valgono tutte: nessuna voce `to_confirm` con `blocking: true`, nessuna oscillazione rilevata, uscita diversa da `rounds-exhausted`, `missing_disciplines` vuoto, e **gate green**. In caso contrario chiudi con il report e fermati.

Queste cinque condizioni sono ciò che rende il commit automatico difendibile, ed è il motivo per cui non si allentano mai «perché tanto ormai il commit è sempre»: prima erano la seconda porta dopo un flag che l'utente digitava a mano, adesso sono **l'unica**. Un ciclo che le rispetta consegna codice che ha attraversato ogni disciplina prevista; un ciclo che ne salta una consegna un diff che nessuno ha guardato per intero, e lo fa senza che nessuno abbia premuto niente.

`rounds-exhausted` blocca il commit perché è un'uscita per esaurimento, non per convergenza: il ciclo stava ancora correggendo difetti quando gli è finito lo spazio. `rounds-truncated` no: lì sei tu a troncare con `--rounds N`, e sai cosa stai consegnando — il commit può partire.

`missing_disciplines` blocca per lo stesso argomento con cui il gate blocca: se una disciplina qui non ha girato, su quel diff non ha girato nessuno, e non girerà più. Un `independence: "lost"` invece **non** blocca — la review è comunque stata fatta, solo senza fan-out cieco — ma va detto in chiusura, perché il blocco esce altrimenti identico a quello di un giro 1 con tre finder indipendenti.

Quando parte, delegalo a un subagent **judge** che legge integralmente `skills/commit/SKILL.md` ed esegue quel contratto sul perimetro `{code_root}`. Committare da qui a mano salterebbe l'allineamento di memoria e documentazione, il bump di versione e il changelog, che vivono lì — insieme al permesso che quel nodo passa a sua volta al proprio figlio, e che non è tuo da dare. Nessun `git push`, mai.

**Se il suo blocco non torna**, vale la regola generale di § *Un passo che non torna, quando non è un finder*: lo rilanci **una volta sola**, con lo stesso identico prompt. Se non torna neanche allora, `commit` è `skipped` con il motivo, `commit_sha` è `null`, e **non committi tu** per chiudere il buco: `git log` dice cosa è già entrato, mai cosa manca, e un commit fatto qui salterebbe l'allineamento di memoria e documentazione e il bump che vivono in quel contratto.

**Lo SHA torna con lui.** Il subagent riporta lo SHA di ogni commit prodotto (§ *Procedura* 8 di `skills/commit/SKILL.md`): quello del **codice** finisce verbatim in `commit_sha`. Non ricavarlo da `git log -1` — dopo `/commit` la working tree porta due o tre commit distinti e l'ultimo non è quello del codice. Se la sequenza si ferma fra un gruppo e il successivo, `commit` è `partial`, `commit_sha` porta ciò che esiste davvero, e lo dici in chiusura.

## Esito

1. **Relaziona in chat**, corto: giri eseguiti e perché ti sei fermato — con il verdetto che ha chiuso il ciclo — quali discipline hanno girato al giro 1 e quanti rilievi hanno prodotto, cosa è stato applicato, cosa scartato e con che motivo, le voci da confermare, l'esito del gate e quello del commit. Se qualche fix aveva `on_previous_fix: true`, dillo: è la parte del lavoro che un solo giro non avrebbe trovato. E se il giro 1 è stato meno di quello che doveva essere — una disciplina mancata, il fan-out degradato in linea — dillo per primo: è l'unica cosa che il lettore non può ricavare dal resto del riepilogo.

2. **Chiudi sempre con il blocco a contratto**, così chi ti ha invocato — l'utente o `develop-feature` — lo legge senza interpretare la prosa. Nessun campo si omette: a zero voci si scrive `"to_confirm": []`. In `rounds` e nei contatori `applied`/`severe`/`discarded` conta **solo** i giri del ciclo: il giro di chiusura sui test della fase Copertura non è uno di essi, e si riporta in prosa. In `disciplines_round_1` elenca le discipline che hanno **restituito** il blocco, non quelle che hai lanciato: una disciplina lanciata e mai tornata non ha girato su quel diff, e scriverla lì la dichiarerebbe fatta — va in `missing_disciplines`, che è la sua controparte e senza la quale quella perdita non si vede più.

   ```json
   {
     "rounds": 0,
     "outcome": "fixed-point|diminishing-returns|oscillation|rounds-truncated|rounds-exhausted",
     "disciplines_round_1": ["bug"],
     "missing_disciplines": [],
     "independence": "intact|lost",
     "oscillation": 0,
     "applied": 0, "severe": 0, "on_previous_fix": 0, "discarded": 0,
     "gate": "green|red",
     "gate_detail": "<esito reale del check sulle aree toccate, una riga>",
     "commit": "done|partial|not-requested|skipped",
     "commit_sha": "<sha del commit del codice, o null>",
     "blocking": 0,
     "coverage": "tests-written|no-tests-needed",
     "ledger": "<path del ledger di questa review>",
     "report": "<path di 5. review-report.md, o null se la review non gira su una cartella>",
     "to_confirm": [ "<le voci come `skills/applier/SKILL.md` § *Il blocco che restituisci* e `skills/test-coverage/SKILL.md` § *Modalità automatica* le dichiarano, per intero e verbatim>" ]
   }
   ```

`oscillation` conta le voci che l'applicatore ha registrato in quel campo lungo tutto il ciclo, e **non** è ridondante con `outcome`: un'oscillazione rilevata all'ultimo giro esce con quel nome, ma una rilevata prima — e soppressa — lascia il ciclo proseguire, e a quel punto `outcome` porta il nome di come il ciclo è finito, non di ciò che ha incontrato. È una delle cinque condizioni che fermano il commit (§ *Chiusura*), quindi chi decide a valle deve poterla leggere anche quando non è l'uscita.

`independence` è `lost` **solo** se il fan-out del giro 1 non è girato su subagent indipendenti: la delega non era disponibile e hai valutato le discipline in linea, nello stesso contesto. Un fan-out sequenziale su un backend che lo impone resta `intact` — i contesti sono comunque freschi e ciechi fra loro (§4 di `contracts/orchestration.md`, *Profondità e degradazione*). Non è un campo di modestia: è ciò che distingue, a valle, una review da una passata sola.

3. **Memoria e documentazione non sono un tuo compito né un compito dell'utente.** Il vincolo «solo `{code_root}`» resta: `{instructions_file}`, `.daiku/policies/`, `{memory.root}` e `{tech_doc}` sono competenza di `update-memory`, che `/commit` delega **sempre**, come passo obbligatorio e non come giudizio sul diff. Quindi **non chiudere mai con un promemoria all'utente** del tipo «ricordati di riallineare il documento tecnico»: ciò che esce di qui col gate green è deciso, e un lavoro deciso si porta dietro i propri artefatti da sé. Una riga che gira quel lavoro a chi legge non lo rende più sicuro — lo rende solo probabile che non avvenga, perché il commit parte comunque e la riga resta in una chat chiusa.

Se nel ciclo hai visto un **cambiamento di comportamento visibile all'utente** (nuovo flusso, azione, default o semantica che un lettore umano dovrebbe ora leggere diversa), nominalo nel report come **fatto sul diff**, al pari degli altri: serve a chi legge per capire cosa sta consegnando, non a ingaggiarlo. Non è un rilievo di codice e **non** entra in `to_confirm`.

4. **Se il commit non è partito, chiudi dicendo in una riga perché**, e distingui i due casi, perché si leggono uguali e non lo sono. Con `--no-commit` il commit è di chi ti ha invocato: se il gate è verde e non restano voci bloccanti, chiudi con **«Pronto per il commit.»** e basta — dentro `develop-feature` nemmeno quella, lì il commit è una fase successiva della consegna. Se invece a fermarlo è stata una delle condizioni di § *Chiusura*, nominala: il gate rosso con il suo dettaglio, le voci bloccanti rimaste, l'uscita `rounds-exhausted`, l'oscillazione, o le discipline mancate.

5. **Deposita il report**, se la review gira su una cartella di lavoro (l'input era `4. review-notes.md`): scrivi `5. review-report.md` accanto ad esso, con il blocco a contratto qui sopra e, in prosa, quello che hai relazionato al punto 1. È l'unico artefatto che sopravvive alla sessione: senza, l'esito della fase più lunga della consegna vive solo in chat, e chi riprende non sa se la review è stata fatta né cosa aveva scartato. Su una review lanciata a mano su un base-ref nudo non c'è cartella dove scriverlo: allora `report` è `null` e basta il blocco in chat.

## Auto-inganni (fermali prima che ti fermino)

| Se ti stai dicendo… | La verità |
|---|---|
| «Ho applicato i fix, il gate è verde, ho finito» | Il gate dice che compila, non che è corretto. I fix sono codice che nessun finder ha letto: è esattamente il perimetro che il giro successivo esiste per rivedere. |
| «Ispeziono io il diff, così risparmio i finder» | I finder sono subagent indipendenti e ciechi tra loro: è la separazione che produce rilievi diversi invece di una sola passata già convinta di sé. |
| «Il giro 2 lo rifaccio su tutto il diff, così sono sicuro» | È lo spreco che il ciclo evita. I file non toccati dai fix sono già stati giudicati: rileggerli costa e non trova nulla di nuovo. |
| «Rilancio anche `arch` e `perf` al giro 3, male non fanno» | Giudicano una forma sul diff intero, non righe. Sui due file toccati dai fix è una domanda mal posta, e il ciclo diventa costoso per niente. Girano al giro 1. |
| «Il giro ha applicato pochi fix, ho finito» | Guarda **quali**, non quanti. Tre gravi impongono un altro giro; un fix su codice nato dal giro prima dice che le tue correzioni stanno regredendo. Il conteggio nudo dei rilievi non decide niente. |
| «Il primo giro ha trovato tanto, il secondo chiude di sicuro» | È l'assunzione che questo ciclo ha smesso di fare. Su un perimetro largo il secondo e il terzo giro trovano quanto il primo, e in parte dentro le correzioni del primo. |
| «Sono al giro 5, mi fermo che è già tanto» | Il tetto è un guardrail, non un budget. Se il giro 5 applica tre gravi il perimetro è ancora sporco: il problema non è quanti giri hai fatto, è il codice che stai per consegnare. |
| «Nessun rilievo al giro 1: salto anche il gate» | Il gate gira **sempre**. È l'unica verifica reale che il diff compili e passi i test. Salta il giro 2, non il gate. |
| «`arch` non è tornato, ma gli altri due sì: vado avanti» | Vai avanti, ma **dichiaralo**. Rilancialo una volta; se non torna, `missing_disciplines` lo registra e il commit non parte. `arch` gira una volta sola sul diff intero: quello che non ha visto adesso non lo vedrà nessuno, mai. |
| «I finder li ho girati io in sequenza nello stesso contesto, l'esito è lo stesso» | Non è lo stesso: la cecità reciproca era il valore. Se la delega non c'è, degrada prima a subagent sequenziali; se nemmeno quelli, `independence: "lost"` nel blocco. Un esito indistinguibile è peggio di un esito peggiore. |
| «Il ledger dice riga 88, vado a vedere la riga 88» | Fra un giro e l'altro le righe si spostano: il numero nel ledger è per te che leggi, non per confrontare. L'identità di un fix è `file` + `anchor`; `symbol` serve solo a orientarsi e a raggruppare. |
| «I test li ha scritti la fase copertura, quelli sono per definizione giusti» | Un test che passa può affermare la cosa sbagliata o non esercitare il ramo che dice di coprire — e nessun finder li ha letti. Per questo dopo la copertura c'è un giro di chiusura sui soli file di test. |
| «Il lint non passa, riscrivo due righe e va» | Il gate gira dopo l'ultimo finder: quello che scrivi lì non lo rivede nessuno. A semantica invariata sì; se cambia comportamento, riporta `gate: "red"` — il ciclo non si riapre per il gate, e un rosso blocca il commit. |
| «Il gate lo metto in background e intanto scrivo il report» | Il gate è l'ultima verifica reale, e chi lo invoca aspetta il suo ritorno. In background non c'è nessuno che legge il rosso. |
| «Uscita punto-fisso, consegna pulita» | L'uscita dice perché il ciclo si è fermato. Se restano voci bloccanti, il codice ha bivi aperti sulla propria correttezza: si riportano, e la consegna non è pulita. |
| «Questo rilievo l'ho scartato al giro 1, ma riproposto sembra sensato» | Il ledger dice perché l'hai scartato. Riaprilo solo con evidenza nuova, altrimenti paghi due volte lo stesso triage. |
| «Questo rilievo è a bassa confidenza: lo segno da confermare» | La confidenza è la stima del finder, non un permesso. Lo verifichi e decidi tu: applicarlo, oppure scartarlo dichiarando perché. |
| «Nel dubbio lo lascio aperto, tanto poi decide l'utente» | L'utente decide i bivi, non i tuoi dubbi. Se sai qual è la strada giusta, quella è già la decisione: prendila. |
| «Questo file fuori da `{code_root}` andrebbe sistemato già che ci sono» | Vincolo hard di scope. Fuori da `{code_root}` non si legge come rilievo e non si tocca. |
| «Il gate è rosso per un test, ci metto una pezza» | Solo lint e formato si correggono qui. Un test rosso è `gate: "red"` con l'output reale, e il commit non parte. |
| «Il fix è provato: ho scritto il test e passa» | Se il codice trasforma dati che arrivano da fuori — sorgenti di un cliente, file importati, output di uno strumento — un input scritto da te prova che il meccanismo fa quello che avevi in mente, non che **si accende ancora** su quelli veri. Il caso reale ha commenti, stringhe e forme che non avresti inventato. Prendine uno e passalo dentro: un giro di fix tutti verdi sui casi sintetici ha già reso inerte, su codice reale, la funzione che doveva riparare. |
| «Committo io con `git commit`, il contratto è lungo» | Il contratto di commit tiene insieme memoria, documentazione, changelog e versione. Saltarlo lascia il repo disallineato senza che nessuno se ne accorga. Il commit si delega a `/commit`, sempre. |
| «Il commit ormai parte sempre, quelle cinque condizioni sono burocrazia» | Erano la seconda porta dopo un flag digitato a mano; adesso sono l'unica. Un gate red, una voce bloccante, `rounds-exhausted`, un'oscillazione o una disciplina mancata fermano il commit — e se ne salti una consegni un diff che nessuno ha guardato per intero, senza che nessuno abbia premuto niente. |

## Regola di taglio

**Il criterio, valido per ogni skill orchestrante:** un contratto orchestrante tiene solo ciò che serve a **decidere la sequenza** — quando si delega, a chi, con quale scope, e quando ci si ferma. Tutto ciò che un passo delegato deve leggere per fare il proprio lavoro sta in un file suo, e il dominio — liste, tassonomie, semantiche — sta in `{memory.root}` o in `.daiku/domain/`. Un testo che finisce nel prompt di un figlio non appartiene a questo file: appartiene al contratto che quel figlio legge.

Applicato qui: questa skill possiede **la disciplina di review e il criterio di iterazione** — scope, fan-out, quali discipline a quale giro, quando fare un altro giro, uscite, copertura, gate, chiusura. Non possiede il merito delle discipline, che hanno un contratto proprio (`skills/code-review/SKILL.md`, `skills/arch-check/SKILL.md`, `skills/perf/SKILL.md`, `skills/test-coverage/SKILL.md`); non possiede il prompt dei propri figli (`skills/finder-prompt/SKILL.md`, `skills/applier/SKILL.md`), che loro leggono da sé; non possiede la disciplina di commit (`skills/commit/SKILL.md`), che delega. Se cambia la review, si tocca qui e in nessun altro posto.
