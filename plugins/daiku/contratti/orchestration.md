# Orchestrazione delle skill — contratto unico

Questo file è il **punto unico di modifica** per come le skill del progetto delegano lavoro e
quale ruolo gira su ogni passo. Le skill in `.claude/commands/` descrivono *cosa* va fatto e
*in che ordine*; qui sta *chi* lo fa e *come* lo si lancia sull'host corrente.

## Parametri di ambiente

Leggi `.claude/environment.json` prima di agire: è la sola fonte dei valori di ambiente di questo
host e di questa macchina. Le chiavi citate in questo contratto fra graffe e apici inversi si
risolvono da lì, mai a memoria e mai per assunzione. Se una chiave citata non c'è, quella cosa
**non esiste in questo ambiente**: salta la parte che la usa, dichiaralo nell'esito, non
inventarla e non chiederla. La forma del file, e il confine con `.claude/project.json`, sono in
`.claude/project-contract.md`; le sue chiavi sono nella §7 qui sotto.

Vale per ogni host dichiarato in `{hosts}`. Il contratto canonico di una skill sta sempre in
`.claude/commands/`; un host che per invocarla richiede un pointer lo trova sotto
`{hosts.<host>.skill_pointers}`. Nessuna skill duplica questo contratto e nessuna skill nomina
un modello.

## 1. Ruoli

Due soli ruoli, anonimi per costruzione. Una skill dichiara il ruolo di un passo, mai il modello.

| Ruolo | Quando si usa | Esempi di passo |
|---|---|---|
| **giudice** | il passo *decide* o *sintetizza*: produce lavoro nuovo a partire da input eterogenei, oppure riconcilia rilievi di più fonti dove sbagliare costa caro | brief di esecuzione, aggiornamento memoria/documentazione, riconciliazione di una review del corpus |
| **worker** | il passo *esegue* o *ispeziona* un perimetro già delimitato: applica un piano, cerca rilievi in un diff, esegue comandi noti e ne riporta l'esito | esecuzione del brief, finder di review, scope, gate, inventario, comandi Git, log e report |

Un passo puramente meccanico (una riga di log, un `git add` di file già elencati, l'append di un
report) resta un **worker**: non merita un ruolo terzo.

## 2. Il modello di un ruolo

Il modello di un passo è `{hosts.<host>.models.<ruolo>}`, dove `<host>` è l'host corrente e
`<ruolo>` è quello che la skill ha dichiarato per quel passo. È l'unica risoluzione ammessa, e
avviene qui: la skill dichiara il ruolo e si ferma lì.

**Risoluzione dell'host.** Lo dichiara il pointer di skill che ti ha invocato — il file sotto
`{hosts.<host>.skill_pointers}` nomina il proprio host; in sua assenza l'host è `{default_host}`.

**Backend alternativi.** Se la sessione gira su un backend switchato — uno di `{backends}` che non
è quello nativo dell'host — i nomi di modello di `{hosts.<host>.models}` restano gli alias di tier
da dichiarare: è l'env dello switcher a rimapparli sul modello reale del backend. Non c'è nulla da
cambiare qui, e nessuna skill deve conoscere quel mapping: l'unica cosa che cambia per davvero è
la concorrenza (§5).

Se l'host non permette di scegliere il modello di un subagent, il ruolo resta comunque
dichiarato nel prompt e il passo gira sul modello di default: la sequenza e i contratti non
cambiano.

## 3. Skill invocabili e contratti interni

Ogni contratto sotto `.claude/commands/` è, prima di tutto, un **path che un subagent riceve e
legge**: è la forma che li fa funzionare identici su ogni host, senza un pointer per ciascuno.
Alcuni, in più, **si lanciano a mano**. Le due cose non si escludono, perché non descrivono il
file ma l'invocazione: lo stesso contratto è un **entry point** quando lo lanci tu ed è un
**contratto interno** quando è una catena a delegarlo. `code-review` è il finder che `/review`
delega e insieme la skill che lanci su una pull request; `update-memory` è la fase Memory di
`/deliver-feature` e insieme la skill con cui riallinei memoria e documentazione su un diff già
scritto.

Questi si invocano a mano:

| Entry point | Perché |
|---|---|
| `decision-doc` | si parte da lì: una cartella di materiale grezzo diventa strategia ancora da chiudere o documento di decisione |
| `deliver-feature` | la catena intera fino al commit, senza fermarsi a ogni stadio |
| `review` | la review vive anche da sola, su un diff scritto a mano |
| `commit` | chiude una review lanciata con `--no-commit`, o un diff scritto fuori da una review |
| `code-review` | è l'unico che guarda una pull request invece del working tree: il diff è già pubblicato e l'esito sono commenti sulla PR |
| `studia-libreria` | gli appunti su una tecnologia servono prima che esista una consegna, e valgono anche senza |
| `studia-problema` | apre la cartella di un problema partendo dal codice, quando non c'è ancora niente da decidere |
| `update-memory` | memoria e documentazione si riallineano anche su un diff che non è passato da una consegna |
| `memory-review` | il corpus di memoria si revisiona quando è cresciuto, non quando si consegna |
| `nightly-plan` | la coda della notte si prepara a mano, prima che la notte cominci |
| `nightly-orchestrator` | scandisce la notte: lo lanci quando la coda è pronta |
| `censisci-tecnologie` | il catalogo si allarga quando un inventario trova coordinate che non sa leggere |

Tutto il resto — brief, esecuzione, arch-check, perf, test-coverage —
resta **contratto interno**: un subagent lo riceve come *path da leggere*, non come skill da
invocare. Che un host esponga per nome anche un contratto non dichiarato qui è una comodità di
quell'host, non un'invocabilità dichiarata: dichiarata è la tabella qui sopra.

Su un host che dichiara `{hosts.<host>.skill_pointers}` una skill di questa tabella si lancia
solo se lì ha il proprio pointer, e non tutte ce l'hanno: quelle che non ce l'hanno restano
raggiungibili dagli host che quella chiave non la dichiarano, e che caricano i contratti
direttamente da `.claude/commands/`. Aggiungere il pointer che manca, o quello di un contratto
interno che serve lanciare a mano, è dodici righe — non un'altra copia del contratto.

### Un contratto raggiungibile in più di un modo dichiara le proprie modalità in casa

Lo stesso file è entry point e contratto interno, e le due invocazioni non hanno lo stesso scope
né gli stessi permessi: `code-review` commenta una pull request quando lo lanci tu e non scrive
niente quando è `/review` a invocarlo. Quella differenza **si dichiara nel nodo**, una sezione per
modalità, con scope, permessi di scrittura e blocco di ritorno. Chi invoca **sceglie** la modalità
e non riscrive i vincoli: una lista di deroghe scritta nel chiamante si erode a ogni modifica del
nodo, e nessuno se ne accorge finché il nodo non fa, in modalità finder, qualcosa che quella lista
aveva dimenticato di disattivare.

Vale per ogni nodo raggiungibile in più di un modo, compresi quelli che arriveranno da fuori: un
contratto importato arriva senza modalità, e la strada breve per chi lo invoca è sempre la stessa.
La sezione delle modalità si scrive **prima** di collegarlo, non dopo il primo incidente.

### La topologia: chi è collegato a cosa

Le regole di delega della §4 dicono *come* si lancia un passo. Questa tabella dice *cosa è
collegato a cosa*: chi può invocare un nodo, con quale input già risolto, con quale ritorno
atteso, e se quel nodo può ri-delegare. **Si legge prima di delegare**, e ogni cella è un
**rimando**, mai una copia: il contenuto vive nel file del nodo, che resta l'unico posto in cui si
modifica. Non è un motore — l'orchestrazione resta dell'agente (§6) — è la mappa che gli evita di
ricostruire il grafo dalla prosa di chi chiama.

| Nodo | Chi lo invoca | Riceve già risolto | Restituisce | Ri-delega |
|---|---|---|---|---|
| `decision-doc` | owner, `studia-problema` § *Passa il testimone* | cartella del problema, eventuale sottoinsieme da analizzare; da `studia-problema` anche il documento già scritto e le memorie pertinenti | `1.5. studio-strategico.md` o `1. decision-doc.md` sul disco, con `0. problem.md` rifinito, e come figlio il blocco di § *Modalità di invocazione* del suo file | no |
| `studia-problema` | owner | descrizione del problema | `0. problem.md` in `docs/nuovi-sviluppi/<nome>/` | sì — ricerca per area, foglie, e `decision-doc` alla chiusura |
| `studia-libreria` | owner | nome della tecnologia | appunti in `docs/appunti-lib/` | sì — ricerca per blocco tematico, foglie |
| `blueprint` | `deliver-feature` fase 1 | cartella con `1. decision-doc.md`, soluzione scelta verbatim, memorie pertinenti | § *Cosa restituisci* del suo file | no |
| `execute` | `deliver-feature` fase 2 | cartella con `2. blueprint.md`, memorie pertinenti | § *Cosa restituisci* del suo file | no |
| `deliver-feature` | owner, `nightly-orchestrator` §2 | cartella, soluzione scelta, id dell'item, `run_id` e backend della coda | § *Esito* del suo file | sì — le sue fasi, e `review` come figlio orchestrante |
| `review` | owner, `deliver-feature` fase 3 | base-ref o path di `4. review-notes.md`, ledger da riaprire (scelto su `base` **e** `item`), `--no-commit` da chi committa da sé, effort, backend della coda, radici di lavoro e artefatti quando gira su un worktree | § *Esito* del suo file | sì — finder, applicatore, copertura, gate, `commit` |
| il finder di un giro (`finder-prompt`) | `review` § *Finder* | disciplina e contratto, `BASE` e file del giro, effort, applicati e scartati dal ledger | § *Il blocco che restituisci* del suo file | no |
| `code-review` | owner (su PR), `review` come finder `bug` | PR **oppure** scope del giro | § *Modalità finder* del suo file | sì su PR, **no** come finder |
| `arch-check` | `review` come finder `arch` | cartella **oppure** scope del giro | § *Modalità finder* del suo file | no |
| `perf` | `review` come finder `perf` | scope **oppure** scope del giro | § *Modalità finder* del suo file | no |
| `test-coverage` | `review` § *Copertura* con `--auto` | macrocategoria **oppure** diff finale del ciclo e memorie pertinenti | § *Modalità automatica* del suo file | no |
| `applicatore` | `review` § *Applicatore* | rilievi di tutti i finder del giro, applicati dei giri precedenti, scope e `BASE`, memorie pertinenti, e la **modalità** quando è il giro di chiusura sui test | § *Il blocco che restituisci* del suo file | no |
| `commit` | owner, `review` § *Chiusura* (sempre, salvo `--no-commit`) | perimetro del gruppo codice; memoria/doc e versione/changelog li partiziona da sé (§ *Procedura* 3 del suo file) | § *Procedura* 8 del suo file, in chat | sì — `update-memory` |
| `update-memory` | owner, `deliver-feature` fase 5b, `commit` § *Allineamento* | diff in index, cartella dell'item dove depositare il proprio artefatto (da `deliver-feature`), **permesso di commit del proprio gruppo** | § *Procedura* 7 del suo file | no |
| `memory-review` | owner | niente: inventario e auditor enumerano da sé | § 4 *Riconciliazione* del suo file | sì — inventario, tre auditor, reconciler, foglie |
| `nightly-plan` | owner | le voci della coda, in chat | `docs/nightly/nightly-run.json` | no |
| `nightly-orchestrator` | owner | la coda `nightly-run.json` | riepilogo in chat, un item per riga | sì — pre-flight, e `deliver-feature` per item |
| `censisci-tecnologie` | owner | progetti da censire | report in chat (*Passo 8* del suo file) | no |

**Un arco nuovo si dichiara qui.** Collegare un nodo a un chiamante che non lo aveva significa
aggiornare la sua riga — i chiamanti, l'input che ora riceve risolto, il permesso che
l'invocazione gli passa — nella stessa modifica che scrive l'arco. Una riga non aggiornata è un
arco che esiste nel codice dei prompt e non esiste da nessuna parte che si possa leggere: è la
forma in cui il permesso di un nodo finisce per dipendere da chi lo chiama senza che nessuno
l'abbia deciso.

**E questa tabella e' verificata a macchina, non solo riletta.** `docs/scripts/check-contratti.py`
controlla che i nodi siano tutti e soli quelli su disco, che ogni contratto consegnato a un
subagent **come contratto da leggere** compaia fra i chiamanti della propria riga, e che ogni
rimando a sezione di una cella — «§ *X* del suo file» — trovi davvero quell'heading. Non copre le
forme di consegna che nessuno ha ancora scritto: le riconosciute sono elencate in
`FORME_DI_DELEGA`, e una forma nuova si aggiunge li' nella stessa modifica, altrimenti quell'arco
resta verificato da nessuno.

## 4. Delega

Una skill orchestrante lancia ogni passo come **subagent in contesto fresco**, mai eseguendolo
inline nella conversazione: è ciò che tiene la catena lunga dentro un contesto sano e ciò che
rende un passo ripetibile.

Come si lancia, per host:

- **`claude`** — tool `Agent`, con `model` risolto secondo la §2 e `subagent_type` scelto così:
  `finder` per i passi di sola analisi che riportano rilievi (i finder di una review),
  `auditor-memoria` per gli audit del corpus di memoria, `Explore` per la sola ricerca,
  `general-purpose` per tutto il resto — cioè per i passi che devono scrivere. Più subagent
  indipendenti si lanciano nello **stesso** blocco di tool call per farli girare davvero in
  parallelo.

  I primi due sono definiti in `.claude/agents/` e hanno un **toolset ristretto**: non possono
  scrivere file né delegare ad altri agent. È la differenza fra un vincolo dichiarato nel prompt e
  uno vero: un finder che «corregge già che c'è» non compare fra gli applicati, non ha un'`ancora`
  nel ledger, e nessun giro successivo lo rivede. Su un host che non sa scegliere il tipo di
  subagent il vincolo resta scritto nel prompt, e lo dichiari nell'esito.

  **Il confine vero è quale tool c'è, non cosa ci scrivi dentro.** `auditor-memoria` non ha `Bash`,
  e lì la sola lettura è vera per costruzione. `finder` ce l'ha, con gli specificatori
  `Bash(git diff:*)`, `Bash(git log:*)`, `Bash(git grep:*)` — che **non restringono** nulla: un
  finder esegue `ls`, `cat`, `grep -rn` e qualunque altra riga senza un diniego, e lo si è visto
  accadere. Per lui la sola lettura è prosa come su un host `prosa`, quindi **ripetigli nel prompt
  il vincolo di sola lettura** — su ogni host, non solo su quelli senza harness.
- **`codex`** — subagent nativo dell'host, con il modello risolto secondo la §2. Il runtime lo
  vuole in due gesti diversi, ed è una proprietà dell'host, non della skill che lo incontra: un
  passo risolto a `{hosts.<host>.models.worker}` si lancia **senza passare `model`**, così eredita
  quel modello dal parent; un passo risolto a `{hosts.<host>.models.giudice}` quel modello lo passa
  esplicitamente. Perché l'eredità valga, **il parent deve già girare su
  `{hosts.<host>.models.worker}`**: se non ci gira, fermati e chiedi di selezionarlo per questa
  sessione, senza fallback — un giudice ereditato al posto di un worker esce a contratto identico a
  un passo girato come doveva, e niente a valle distingue i due.

**L'harness non ha lo stesso spessore sui due host, e `{hosts.<host>.enforcement}` dice quale.**
`harness` significa che tre cose sono attive e impongono da sole: il `deny` delle permission rule,
gli hook, e la **lista** dei tool che un agent dichiara — un tool assente è un confine vero. Non
copre il **contenuto** di un comando Bash: uno specificatore come `Bash(git diff:*)` descrive
un'intenzione e non la impone, e un agent che ha `Bash` ha `Bash` intero. `prosa` significa che
nessuno dei tre strati esiste, e gli invarianti valgono solo perché sono scritti — lì nulla ferma
un `git push`, una rimozione che attraversa una junction o un finder che scrive.

Ne segue una regola sola, valida ovunque: **un vincolo che non sia l'assenza di un tool si ripete
nel prompt del subagent** — su un host `prosa` tutti, su un host `harness` quelli che nessuno dei
tre strati copre, a partire dalla sola lettura di chi ha `Bash`. E **lo dichiari nell'esito**:
stesso contratto e stesse parole non sono stesse garanzie, e senza quel campo nulla a valle può
distinguere i due casi.

Regole valide su ogni host:

1. **Prompt autosufficiente.** Il subagent parte da zero: nel prompt gli dai il contratto da
   leggere (il path della skill), l'input risolto (cartella, scope, base-ref) e il formato di
   ritorno. Non contare su nulla che sia solo nella tua conversazione.

   **Memoria pertinente.** A un passo che scrive codice, o che decide cosa scriverne, passi anche
   `memory/MEMORY.md` e i **path** delle memorie che il suo perimetro tocca — quelle che hai già
   in mano, scelte sull'indice — con l'istruzione di aprirle prima di lavorare. Non riassumerle
   nel prompt: un fatto riassunto è un fatto che diverge dal suo file al primo aggiornamento. Se
   nessuna memoria è pertinente, passi solo l'indice. È il canale per cui i fatti non deducibili
   dal codice raggiungono chi parte da zero: senza, finiscono ricopiati dentro i contratti, ed è
   la copia che i subagent leggono.
2. **Ritorno a contratto.** Ogni passo che alimenta una decisione a valle restituisce un blocco
   JSON con i campi che la skill dichiara: si legge quello, non la prosa. Se il blocco manca o
   è incompleto, il passo è fallito — non interpretarlo a intuito.

   **E un passo fallito ha un tetto.** Si rilancia **una volta sola**, con lo stesso identico
   prompt; se non torna neanche allora, cosa ne segue lo dichiara la skill che lo ospita, e deve
   dichiararlo per iscritto. Senza quel tetto lo stesso silenzio produce comportamenti tutti
   difendibili e incomparabili fra esecuzioni — rilanciare a oltranza, saltare il passo, chiudere
   il ciclo — e nel resoconto le tre esecuzioni si leggono uguali. Un orchestratore che rilancia
   finché non ottiene la risposta che vuole non sta orchestrando.

   **Lo schema lo dichiara il nodo, una volta sola.** Il blocco di ritorno di un passo si scrive
   nel file del nodo che lo produce. Chi lo consuma lo **cita** — «il blocco che *quel file*
   dichiara, per intero» — e non lo ricopia; se ne legge di proposito solo un sottoinsieme,
   dichiara quali campi ignora e perché. Uno schema ricopiato dal chiamante si restringe
   attraversando l'arco: nasce identico, poi il nodo aggiunge un campo e il chiamante no, e quel
   campo semplicemente non arriva al decisore — che continua a decidere, con meno informazione di
   quanta ne esista, senza che niente segnali la perdita.
3. **Un passo, un subagent.** Non accorpare due fasi in un solo subagent per risparmiare un
   giro: la sequenza dichiarata dalla skill è il contratto.
4. **Se la delega non è disponibile** sull'host corrente, esegui il passo in linea rispettando
   comunque ordine, perimetro e formato di ritorno, e dichiaralo nell'esito. Ma prima leggi la
   sottosezione qui sotto: per i passi che si reggono sull'indipendenza dei figli, *inline* è il
   secondo gradino, non il primo.

### Profondità e degradazione

**Chi può ri-delegare.** Un passo delegato **esegue**: non delega a sua volta. Le sole eccezioni
sono i tre nodi orchestranti che la §3 dichiara raggiungibili anche come figli — `deliver-feature`
(che orchestra le proprie fasi), `review` (finder, applicatore, gate, commit) e `commit` (che
delega l'allineamento a `update-memory`). Ogni altro passo delegato è una **foglia**, e il cammino
più lungo del grafo resta quello: `nightly-orchestrator → deliver-feature → review → finder`,
quattro livelli. Un nodo che si accorge di voler delegare, e non è uno dei tre, sta eseguendo il
lavoro di qualcun altro: torna a contratto e lascia decidere a chi l'ha chiamato.

**La degradazione ha due gradini, non uno.** Un passo la cui resa dipende dall'**indipendenza**
dei figli — i finder di un giro di `/review`, i tre auditor di `/memory-review` — non degrada a
*inline*: degrada prima a **subagent sequenziali**, che è già il caso normale sui backend con
`{backends.<backend>.sequential_fanout}` (§5) e in cui la cecità reciproca resta intatta perché
ogni contesto è comunque fresco. Solo se nemmeno quello è possibile si esegue in linea.

E allora **lo si dichiara nel blocco di ritorno** (`"indipendenza": "persa"`, o fra le
`limitations` se il blocco ne ha), perché ordine, perimetro e formato sopravvivono alla
degradazione ma la cecità no: tre discipline valutate nello stesso contesto *sono* la singola
passata già convinta di sé che il fan-out esiste per evitare. Senza quel campo l'esito esce
identico a quello di un fan-out cieco, e nulla a valle può distinguerli.

## 5. Concorrenza

Il **fan-out parallelo** è il default: i passi indipendenti (i finder di una review, gli auditor
di un audit) girano insieme.

Eccezione: i backend che dichiarano `{backends.<backend>.sequential_fanout}` girano i passi
indipendenti **in sequenza**. Se la coda o l'invocazione dichiara uno di quei backend,
sequenzializza il fan-out; in ogni altro caso resta parallelo.

I passi che toccano la stessa working tree (build, test, commit, calcolo di un base-ref) sono
**sempre** sequenziali, su ogni host: non sono serializzabili altrimenti.

## 6. Divieti

- Nessuna skill nomina un modello: nomina un ruolo, e il modello lo risolve questo file
  sull'ambiente. Il ruolo è l'unica cosa che una skill ha il diritto di scrivere.
- Nessuna skill duplica questo contratto, né i valori che esso legge da
  `.claude/environment.json`, nemmeno "per comodità".
- Nessuna skill introduce un terzo ruolo o un profilo di modello proprio.
- Il tool `Workflow` non è il motore di nessuna skill: l'orchestrazione è dell'agente, che delega
  a subagent secondo questo file. Non invocarlo.

## 7. Le chiavi di `.claude/environment.json`

| Chiave | Mestiere |
|---|---|
| `contract` | numero intero della forma del file, con le regole della §7 di `.claude/project-contract.md` |
| `default_host` | host da assumere quando nulla lo dichiara |
| `hosts.<host>.models.giudice` | modello con cui gira il ruolo giudice su quell'host |
| `hosts.<host>.models.worker` | modello con cui gira il ruolo worker su quell'host |
| `hosts.<host>.skill_pointers` | cartella in cui l'host cerca i pointer delle skill invocabili; assente se l'host non ne richiede |
| `hosts.<host>.enforcement` | `harness` se l'host impone con `deny`, hook e **assenza** di un tool — mai il contenuto di un comando Bash; `prosa` se gli invarianti valgono solo perché scritti (§4) |
| `hosts.<host>.settings_file` | file in cui l'host tiene la configurazione di ambiente della sessione |
| `hosts.<host>.base_url_env` | nome della variabile con cui, in quel file, l'host punta il backend attivo; assente se l'host non switcha |
| `hosts.<host>.native_backend` | backend attivo quando l'host non è switchato |
| `backends.<backend>` | un backend LLM esistente; la chiave è il nome con cui lo si dichiara a una skill |
| `backends.<backend>.base_url` | URL a cui l'ambiente punta quando quel backend è attivo; assente sul backend nativo dell'host |
| `backends.<backend>.sequential_fanout` | dichiarata solo sui backend il cui fan-out va sequenzializzato (§5) |
| `backends.<backend>.caveats` | avvisi di quel backend da riportare in riepilogo, uno per riga; assente se non ce ne sono |
| `temp_dir` | directory temporanea della macchina, per gli artefatti che non devono finire nel repository |

Nessuna chiave è obbligatoria oltre a `contract`: per tutto il resto vale la degradazione della
§6 di `.claude/project-contract.md`.
