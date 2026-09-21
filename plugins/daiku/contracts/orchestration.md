# Orchestrazione delle skill — contratto unico

Questo file è il **punto unico di modifica** per come le skill del progetto delegano lavoro e
quale ruolo gira su ogni passo. Le skill in `skills/` descrivono *cosa* va fatto e
*in che ordine*; qui sta *chi* lo fa e *come* lo si lancia sull'host corrente.

## Parametri

Ogni chiave fra graffe di questo contratto si risolve sui file di parametri del progetto, mai a
memoria e mai per assunzione: le regole sono nella §5 di `contracts/project-contract.md`, che dice
anche in quale lingua scrivere e cosa fare quando una chiave non c'è. Le chiavi che questo file
consuma sono quelle della §7 qui sotto, e vivono in `environment.json` — in `~/.daiku/`, salvo
l'override di progetto che la §8 di quel contratto dichiara.

Vale per ogni host dichiarato in `{hosts}`. Il contratto canonico di una skill sta sempre in
`skills/<nome>/SKILL.md`; un host che per invocarla richiede un pointer lo trova sotto
`{hosts.<host>.skill_pointers}`. Nessuna skill duplica questo contratto e nessuna skill nomina
un modello.

## 1. Ruoli

Due soli ruoli, anonimi per costruzione. Una skill dichiara il ruolo di un passo, mai il modello.

| Ruolo | Quando si usa | Esempi di passo |
|---|---|---|
| **judge** | il passo *decide* o *sintetizza*: produce lavoro nuovo a partire da input eterogenei, oppure riconcilia rilievi di più fonti dove sbagliare costa caro | brief di esecuzione, aggiornamento memoria/documentazione, riconciliazione di una review del corpus |
| **worker** | il passo *esegue* o *ispeziona* un perimetro già delimitato: applica un piano, cerca rilievi in un diff, esegue comandi noti e ne riporta l'esito | esecuzione del brief, finder di review, scope, gate, inventario, comandi Git, log e report |

Un passo puramente meccanico (una riga di log, un `git add` di file già elencati, l'append di un
report) resta un **worker**: non merita un ruolo terzo.

## 2. Il modello di un ruolo

Il modello di un passo è `{hosts.<host>.models.<role>}`, dove `<host>` è l'host corrente e
`<role>` è quello che la skill ha dichiarato per quel passo. È l'unica risoluzione ammessa, e
avviene qui: la skill dichiara il ruolo e si ferma lì.

**Risoluzione dell'host.** L'host è quello su cui stai girando, e lo sai da dove stai girando: non
chiederlo. Su un host che richiede un pointer, è il pointer che ti ha invocato — il file sotto
`{hosts.<host>.skill_pointers}` — a nominarlo. Se non lo sai in nessuno dei due modi, vale
`{default_host}`, e nessuno degli host dichiarati oggi nello scheletro richiede un pointer.

**Backend alternativi.** Se la sessione gira su un backend switchato — uno di `{backends}` che non
è quello nativo dell'host — i nomi di modello di `{hosts.<host>.models}` restano gli alias di tier
da dichiarare: è l'env dello switcher a rimapparli sul modello reale del backend. Non c'è nulla da
cambiare qui, e nessuna skill deve conoscere quel mapping: l'unica cosa che cambia per davvero è
la concorrenza (§5).

Se l'host non permette di scegliere il modello di un subagent, il ruolo resta comunque
dichiarato nel prompt e il passo gira sul modello di default: la sequenza e i contratti non
cambiano.

## 3. Skill invocabili e contratti interni

Ogni contratto sotto `skills/` è, prima di tutto, un **path che un subagent riceve e
legge**: è la forma che li fa funzionare identici su ogni host, senza un pointer per ciascuno.
Alcuni, in più, **si lanciano a mano**. Le due cose non si escludono, perché non descrivono il
file ma l'invocazione: lo stesso contratto è un **entry point** quando lo lanci tu ed è un
**contratto interno** quando è una catena a delegarlo. `research` è la raccolta che
`new-feature` si procura quando le serve, con il riordino delegato a `study`, e insieme il comando con cui chiedi gli appunti tu.

**Gli entry point sono sette, e non è un numero che cresce da solo.** Un contratto si lancia a
mano solo se è il **punto d'ingresso di una catena**, mai perché è comodo averlo sotto mano:
ciò che sta in mezzo a una catena lo raggiunge chi l'ha aperta, e aggiungerlo qui significa
aprire un secondo modo di arrivarci, con scope e permessi diversi da mantenere allineati per
sempre. I sette stanno in due gruppi, che non si usano negli stessi momenti.

**Il metodo — sono questi cinque, e sono tutto il lavoro di ogni giorno:**

| Entry point | Perché |
|---|---|
| `new-feature` | si parte da un'idea e non c'è ancora niente sul disco: dalla descrizione fino al commit, in un'unica esecuzione. Dentro ci sono lo studio, le decisioni e la consegna, che per questo non si lanciano da sé |
| `research` | gli appunti su una tecnologia valgono anche da soli, prima che esista una consegna che li consumi. Lanciato così **deposita il file riordinato e si ferma**: non apre niente a valle |
| `review` | la review vive anche da sola, su un diff scritto a mano |
| `code-review` | un passaggio solo-bug sullo scope che gli dici, senza giri né fix: occhi sul codice senza aprire un ciclo |
| `commit` | chiude una review lanciata con `--no-commit`, o un diff scritto fuori da una review |

**L'installazione — due comandi che si lanciano una volta per progetto**, e che nessuna catena
può raggiungere perché girano *prima* che ci sia una catena:

| Entry point | Perché |
|---|---|
| `init` | è il primo di tutti: apre `.daiku/` su un progetto che non ce l'ha, e finché non gira nessun altro contratto ha i valori con cui lavorare |
| `sync-host` | porta guardrail e ruoli di subagent nello strato dell'host che non sa riceverli dal pacchetto, e si rilancia a ogni aggiornamento |

Tutto il resto — `decision-doc`, `develop-feature`, `update-memory`, `blueprint`, `execute`,
`finder-prompt`, `applier`, `arch-check`, `perf`, `test-coverage`, `study` — è **contratto interno**: un
subagent lo riceve come *path da leggere*, non come skill da invocare. I primi tre lo sono
diventati il 19 settembre 2026, e ciascuno ha già chi lo apre: `decision-doc` e `develop-feature`
li apre `new-feature`, `update-memory` lo apre `commit`, a ogni invocazione. `study` lo è diventato
con la scissione da `research`, che lo apre a ogni invocazione per il riordino. Un contratto interno
**non chiede niente all'owner** e non ha `argument-hint`: una scelta vera la restituisce nel
proprio blocco, e chi l'ha chiamato la porta in chat (§ *Domandare all'owner*).

Che un host esponga per nome anche un contratto non dichiarato qui è una comodità di quell'host,
non un'invocabilità dichiarata: dichiarata è questa sezione.

Su un host che dichiara `{hosts.<host>.skill_pointers}` una skill di queste due tabelle si lancia
solo se lì ha il proprio pointer, e non tutte ce l'hanno: quelle che non ce l'hanno restano
raggiungibili dagli host che quella chiave non la dichiarano, e che caricano i contratti
direttamente da `skills/`. Aggiungere il pointer che manca, o quello di un contratto
interno che serve lanciare a mano, è dodici righe — non un'altra copia del contratto.

### Un contratto raggiungibile in più di un modo dichiara le proprie modalità in casa

Lo stesso file è entry point e contratto interno, e le due invocazioni non hanno lo stesso scope
né gli stessi permessi: `research` deposita gli appunti e si ferma quando lo lanci tu, e
alimenta la catena quando è `new-feature` a procurarselo. Quella differenza **si dichiara nel nodo**, una sezione per
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
| `init` | owner | radice tecnica, o niente e vale la directory corrente | il referto di § *Referto* del suo file: scritto, lasciato com'era, da compilare | no |
| `sync-host` | owner | radice tecnica, o niente e vale la directory corrente | il referto di § *Referto* del suo file: copiato, agganciato, non agganciato, ruoli scritti, e i gesti che restano all'utente | no |
| `new-feature` | owner | descrizione della feature o del problema, in linguaggio naturale | § *Esito* del suo file: la cartella aperta, i documenti che la catena ha prodotto e l'esito della consegna | sì — indagine per area, `research`, `decision-doc` due volte, e `develop-feature` come figlio orchestrante |
| `decision-doc` | `new-feature` § *Lo studio delle decisioni* e § *Il recepimento* | cartella del problema, eventuale sottoinsieme da analizzare, il documento già scritto, i path degli appunti di `research` e delle memorie pertinenti, e al recepimento le risposte dell'owner per numero | `0.5. studio-strategico.md` o `1. decision-doc.md` sul disco, con `0. problem.md` rifinito, e il blocco di § *Il blocco che restituisci* del suo file | no |
| `research` | owner, `new-feature` § *La conoscenza che ti manca* | nome della tecnologia; da `new-feature` anche la versione in uso nel progetto e le domande a cui gli appunti devono rispondere | path del file in `{paths.lib_notes}/`, in entrambe le modalità, niente altro | sì — fan-out per blocco tematico (foglie) + `study` come figlio foglia |
| `study` | `research` § *Passaggio 2* soltanto | path del file sporco, tecnologia, versione studiata e ultima con date | file riordinato in `{paths.lib_notes}/` + il blocco di § *Il blocco che restituisci* del suo file | no — foglia |
| `blueprint` | `develop-feature` fase 1 | cartella con `1. decision-doc.md`, soluzione scelta verbatim, memorie pertinenti | § *Cosa restituisci* del suo file | no |
| `execute` | `develop-feature` fase 2 | cartella con `2. blueprint.md`, memorie pertinenti | § *Cosa restituisci* del suo file | no |
| `develop-feature` | `new-feature` § *La consegna* | cartella e soluzione scelta | § *Esito* del suo file | sì — le sue fasi, e `review` come figlio orchestrante |
| `review` | owner, `develop-feature` fase 3 | base-ref o path di `4. review-notes.md`, ledger da riaprire (scelto su `base` **e** `item`), `--no-commit` da chi committa da sé, effort, `--backend` quando la sessione gira lì, radici di lavoro e artefatti quando gira su un worktree | § *Esito* del suo file | sì — finder, applicatore, copertura, gate, `commit` |
| il finder di un giro (`finder-prompt`) | `review` § *Finder* | disciplina e contratto, `BASE` e file del giro, effort, applicati e scartati dal ledger | § *Il blocco che restituisci* del suo file | no |
| `code-review` | owner, `review` come finder `bug` | scope detto a mano **oppure** scope del giro | report in chat **oppure** § *Il blocco che restituisci* di `finder-prompt`, con la scala di `confidence` che il suo file dichiara | **no** |
| `arch-check` | `review` come finder `arch` | scope del giro | il blocco di `finder-prompt` § *Il blocco che restituisci*; scope e permessi li dichiara il suo file | no |
| `perf` | `review` come finder `perf` | scope **oppure** scope del giro | il blocco di `finder-prompt` § *Il blocco che restituisci*; scope e permessi li dichiara la sua § *Modalità finder* | no |
| `test-coverage` | `review` § *Copertura* con `--auto` | macrocategoria **oppure** diff finale del ciclo e memorie pertinenti | § *Modalità automatica* del suo file | no |
| `applier` | `review` § *Applicatore* | rilievi di tutti i finder del giro, applicati dei giri precedenti, scope e `BASE`, memorie pertinenti, e la **modalità** quando è il giro di chiusura sui test | § *Il blocco che restituisci* del suo file | no |
| `commit` | owner, `review` § *Chiusura* (sempre, salvo `--no-commit`) | perimetro del gruppo codice; memoria/doc e versione/changelog li partiziona da sé (§ *Procedura* 3 del suo file) | § *Procedura* 8 del suo file, in chat | sì — `update-memory`, **sempre e senza eccezioni** |
| `update-memory` | `develop-feature` fase 5b, `commit` § *Allineamento* (**sempre**, a ogni invocazione di `commit`) | diff in index, cartella della feature dove depositare il proprio artefatto (da `develop-feature`), **permesso di commit del proprio gruppo** | § *Procedura* 7 del suo file | no |

**Un arco nuovo si dichiara qui.** Collegare un nodo a un chiamante che non lo aveva significa
aggiornare la sua riga — i chiamanti, l'input che ora riceve risolto, il permesso che
l'invocazione gli passa — nella stessa modifica che scrive l'arco. Una riga non aggiornata è un
arco che esiste nel codice dei prompt e non esiste da nessuna parte che si possa leggere: è la
forma in cui il permesso di un nodo finisce per dipendere da chi lo chiama senza che nessuno
l'abbia deciso.

**E questa tabella oggi la verifica soltanto chi la rilegge.** Tre delle sue proprieta' sono
verificabili a macchina — che i nodi siano tutti e soli quelli su disco, che ogni contratto
consegnato a un subagent **come contratto da leggere** compaia fra i chiamanti della propria riga,
e che ogni rimando a sezione di una cella — «§ *X* del suo file» — trovi davvero quell'heading — ma
nessuno strumento del pacchetto le controlla. Un verificatore è esistito e **è stato rimosso il 18
settembre 2026**: risolveva la propria radice per posizione sul disco, e alla prima riorganizzazione
dell'albero ha smesso di trovare il corpus senza che l'uscita lo dicesse. Finché non ne esiste uno
che sappia dove si trova, questa riga dichiara ciò che è vero: la tabella si tiene a mano, e una
cella non aggiornata non la prende nessuno.

## 4. Delega

Una skill orchestrante lancia ogni passo come **subagent in contesto fresco**, mai eseguendolo
inline nella conversazione: è ciò che tiene la catena lunga dentro un contesto sano e ciò che
rende un passo ripetibile.

Come si lancia, per host:

- **`claude`** — tool `Agent`, con `model` risolto secondo la §2 e `subagent_type` scelto così:
  `finder` per i passi di sola analisi che riportano rilievi (i finder di una review), `Explore`
  per la sola ricerca, `general-purpose` per tutto il resto — cioè per i passi che devono
  scrivere. Più subagent indipendenti si lanciano nello **stesso** blocco di tool call per farli
  girare davvero in parallelo.

  `finder` è l'unico **ruolo del pacchetto**, definito in `agents/` nella sua radice, e lì ha un
  **toolset ristretto**: niente `Edit`, niente `Write`, nessuna delega ad altri agent. È la
  differenza fra un vincolo dichiarato nel prompt e uno vero: un finder che «corregge già che
  c'è» non compare fra gli applicati, non ha un'`anchor` nel ledger, e nessun giro successivo lo
  rivede.

  **Il confine vero è quale tool c'è, non cosa ci scrivi dentro** — e su questo ruolo passa a
  metà. L'assenza di `Edit` e `Write` è imposta davvero. `Bash` invece c'è, con gli specificatori
  `Bash(git diff:*)`, `Bash(git log:*)`, `Bash(git grep:*)`, che **non restringono** nulla: un
  finder esegue `ls`, `cat`, `grep -rn` e qualunque altra riga senza un diniego, e lo si è visto
  accadere. Per quella metà la sola lettura è prosa come su un host `prosa`, quindi **ripetigli
  nel prompt il vincolo di sola lettura** — su ogni host, non solo su quelli senza harness.
- **`codex`** — subagent nativo dell'host, con il modello risolto secondo la §2.

  **Il ruolo si chiama qui come là.** `finder` esiste anche su Codex, come
  `.codex/agents/finder.toml`, se `sync-host` è passata su questo progetto: stesso nome, stesso
  contratto, resa diversa. Se non è passata, non c'è un ruolo da nominare — il passo parte
  senza, e lo dichiari nell'esito.

  **Nominarlo non impone niente, però.** Su questo host non c'è una lista di tool da restringere, e
  `sandbox_mode` dentro un file di ruolo **non restringe nulla**: un subagent che lo porta scrive
  lo stesso. Il ruolo serve a far arrivare il contratto al figlio senza che tu lo ricopi, non a
  chiudergli una porta. L'unico confine vero dell'host è la sandbox di **sessione**, che chi lancia
  Codex sceglie all'avvio e non è tua da scegliere.

  Il runtime vuole il modello in due gesti diversi, ed è una proprietà dell'host, non della skill
  che lo incontra: un passo risolto a `{hosts.<host>.models.worker}` si lancia **senza passare
  `model`**, così eredita quel modello dal parent; un passo risolto a
  `{hosts.<host>.models.judge}` quel modello lo passa esplicitamente. Perché l'eredità valga, **il parent deve già girare su
  `{hosts.<host>.models.worker}`**: se non ci gira, fermati e chiedi di selezionarlo per questa
  sessione, senza fallback — un judge ereditato al posto di un worker esce a contratto identico a
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
   `{memory.index}` e i **path** delle memorie che il suo perimetro tocca — quelle che hai già
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
sono i nodi orchestranti che la §3 dichiara raggiungibili anche come figli — `develop-feature`
(che orchestra le proprie fasi), `review` (finder, applicatore, gate, commit) e `commit` (che
delega l'allineamento a `update-memory`) — **più `research`, che come figlio di `new-feature`
orchestra il proprio fan-out di raccolta e ne delega il riordino a `study`, foglia**. Ogni altro
passo delegato è una **foglia**, e il cammino più lungo del grafo resta di quattro livelli,
`new-feature → develop-feature → review → finder`, con la catena di raccolta a tre livelli
`new-feature → research → study`. Un nodo che si accorge di voler delegare, e non è uno dei quattro, sta eseguendo il
lavoro di qualcun altro: torna a contratto e lascia decidere a chi l'ha chiamato.

**La degradazione ha due gradini, non uno.** Un passo la cui resa dipende dall'**indipendenza**
dei figli — i finder di un giro di `/review` — non degrada a
*inline*: degrada prima a **subagent sequenziali**, che è già il caso normale sui backend con
`{backends.<backend>.sequential_fanout}` (§5) e in cui la cecità reciproca resta intatta perché
ogni contesto è comunque fresco. Solo se nemmeno quello è possibile si esegue in linea.

E allora **lo si dichiara nel blocco di ritorno** (`"indipendenza": "persa"`, o fra le
`limitations` se il blocco ne ha), perché ordine, perimetro e formato sopravvivono alla
degradazione ma la cecità no: tre discipline valutate nello stesso contesto *sono* la singola
passata già convinta di sé che il fan-out esiste per evitare. Senza quel campo l'esito esce
identico a quello di un fan-out cieco, e nulla a valle può distinguerli.

### Domandare all'owner

**Un subagent non ha un canale verso l'owner.** Parte da zero, scrive il suo blocco e muore:
nessuno legge una sua domanda, e una domanda posta lì dentro si trasforma in un'assunzione presa
in silenzio o in un passo che resta appeso. Quindi **chiede solo chi gira nella conversazione** —
il nodo che l'owner ha invocato — e un passo delegato che si trova davanti a una scelta vera la
**restituisce** nel proprio blocco invece di risolverla: è chi l'ha chiamato a portarla in chat.

Le decisioni si pongono come **domanda strutturata**: un titolo, due-quattro opzioni mutuamente
esclusive con id stabile `A`, `B` (, `C`, `D`), ciascuna con una riga su cosa comporta, e quella
consigliata per prima e dichiarata tale. Quale sia la consigliata non si inferisce dalla prosa:
la dice `recommended_id` nel blocco che la porta — per contratto di `decision-doc` è sempre `"A"`,
già per prima — e chi domanda la riporta senza riordinare. Come si renda quella forma è una proprietà dell'host, non della skill — che dichiara di
voler domandare e si ferma lì, come dichiara un ruolo senza nominare un modello:

- **`claude`** — tool `AskUserQuestion`, una domanda per decisione, **al massimo quattro per
  chiamata**: se le decisioni sono di più, si fanno più chiamate in sequenza, in ordine di gravità.
  L'opzione `A` va per prima, con `(consigliata)` in coda alla label. L'owner può sempre
  rispondere fuori dalle opzioni, e quella risposta libera **prevale**.
- **`codex`**, e ogni host senza un tool di domanda strutturata — la stessa lista, numerata, in
  chat, con le opzioni come lettere (`A` per prima, dichiarata consigliata) e l'invito a rispondere in forma compatta (`1A, 2B, …`). Il
  contenuto è identico: cambia solo il modo in cui arriva.

**Chi domanda non si ferma a domandare.** Una skill che pone decisioni e poi lascia all'owner il
compito di rilanciarla a mano con le risposte gli sta chiedendo di fare l'orchestratore al posto
suo. Le risposte tornano dentro la stessa esecuzione, e la catena prosegue da lì fino a dove il
suo contratto dichiara di arrivare.

## 5. Concorrenza

Il **fan-out parallelo** è il default: i passi indipendenti (i finder di una review, gli auditor
di un audit) girano insieme.

Eccezione: i backend che dichiarano `{backends.<backend>.sequential_fanout}` girano i passi
indipendenti **in sequenza**. Se l'invocazione dichiara uno di quei backend (`review` con
`--backend`), sequenzializza il fan-out; in ogni altro caso resta parallelo.

I passi che toccano la stessa working tree (build, test, commit, calcolo di un base-ref) sono
**sempre** sequenziali, su ogni host: non sono serializzabili altrimenti.

## 6. Divieti

- Nessuna skill nomina un modello: nomina un ruolo, e il modello lo risolve questo file
  sull'ambiente. Il ruolo è l'unica cosa che una skill ha il diritto di scrivere.
- Nessuna skill duplica questo contratto, né i valori che esso legge da
  `environment.json`, nemmeno "per comodità".
- Nessuna skill introduce un terzo ruolo o un profilo di modello proprio.
- Il tool `Workflow` non è il motore di nessuna skill: l'orchestrazione è dell'agente, che delega
  a subagent secondo questo file. Non invocarlo.

## 7. Le chiavi di `environment.json`

Il file sta in `~/.daiku/environment.json`, uno per owner e per macchina; un progetto può
sovrascriverlo per intero con un `.daiku/environment.json` proprio. Le due sedi, e l'ordine in cui
si cercano, sono la §8 di `contracts/project-contract.md`.

| Chiave | Mestiere |
|---|---|
| `contract` | numero intero della forma del file, con le regole della §7 di `contracts/project-contract.md` |
| `default_host` | host da assumere quando nulla lo dichiara |
| `hosts` | l'insieme degli host dichiarati; si cita così quando una skill li **enumera** invece di nominarne uno |
| `backends` | l'insieme dei backend dichiarati; si cita così quando una skill ne valida uno contro l'elenco |
| `hosts.<host>.models` | i modelli dichiarati per quell'host; si cita così quando conta l'insieme e non il singolo ruolo |
| `hosts.<host>.models.<role>` | il modello del ruolo che la skill ha dichiarato per quel passo (§2) |
| `hosts.<host>.models.judge` | modello con cui gira il ruolo judge su quell'host |
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
§6 di `contracts/project-contract.md`.

**La forma corrente è 2.** È salita da `1` il 19 settembre 2026, quando il ruolo che si chiamava
`giudice` è diventato `judge`: la chiave `hosts.<host>.models.giudice` non esiste più, e un file
rimasto alla forma `1` porta ancora quella — il modello del ruolo `judge` non si risolverebbe,
senza che niente lo dica. È esattamente il caso che il numero serve a rendere riconoscibile.
