# Orchestrazione dei comandi di Daiku — contratto unico

Questo file è il **punto unico di modifica** per come i comandi di `.claude/commands/` delegano
lavoro e quale ruolo gira su ogni passo. I comandi dicono *cosa* va fatto e *in che ordine*; qui
sta *chi* lo fa e *come* lo si lancia.

## Questo corpus non è il prodotto

I comandi in `.claude/commands/` servono a **sviluppare** Daiku. Sono una derivazione dei contratti
che stanno in `plugins/daiku/skills/`, adattata a questo repository e a nient'altro. Non si
esportano, non si pubblicano, non tornano indietro nel pacchetto per copia: se una modifica qui
vale anche per il prodotto, la si riporta a mano nel contratto corrispondente sotto
`plugins/daiku/`, che è l'unico albero distribuito (`CLAUDE.md`, § *Questo file non fa parte di
Daiku*).

**Due differenze di forma rispetto al prodotto, decise per questo repo e non negoziabili qui:**

- **Niente parametri.** Il prodotto tiene i valori di progetto fuori dalle skill, in
  `project.json` ed `environment.json`, perché lo stesso contratto deve girare su progetti
  diversi. Qui il progetto è uno solo: ogni path, ogni comando e ogni modello sono **scritti per
  esteso** dentro il contratto che li usa. Non esiste un file di parametri da leggere, e una
  graffa in un contratto di questo corpus è un refuso.
- **Niente worktree.** Il prodotto consegna ogni feature su un worktree di un pool. Qui si lavora
  sul **branch corrente dell'albero principale**: `git` traccia soltanto `plugins/`, quindi un
  worktree nascerebbe senza `CLAUDE.md`, senza `sviluppo/` e senza questo corpus — cioè senza il
  contesto che ogni subagent deve leggere.

## Le sedi di questo progetto

Ogni path è **relativo alla radice del repository** (`C:/dev/Daiku`), con separatori `/`.

| Sede | Cosa c'è |
|---|---|
| `plugins/daiku/` | **il prodotto** — l'unico perimetro di codice, e l'unico albero che viene pubblicato |
| `CLAUDE.md` | gli invarianti di chi sviluppa Daiku |
| `.claude/orchestration.md` | questo file |
| `.claude/commands/<nome>.md` | i contratti di sviluppo; un subagent ne riceve il **path**, non il nome |
| `.claude/agents/finder.md` | il subagent a toolset ristretto dei finder di `/review` |
| `sviluppo/RICOGNIZIONE.md` | il documento di riferimento: i due host, cosa manca, perché ogni file sta dove sta |
| `sviluppo/PUNTI-APERTI.md` | le decisioni ancora da prendere |
| `sviluppo/memory/` + `sviluppo/memory/MEMORY.md` | la memoria persistente e il suo indice |
| `sviluppo/nuovi-sviluppi/<slug>/` | la cartella di un lavoro, con i file numerati `0.`–`5.` ◦ |
| `sviluppo/appunti-lib/<slug>.md` | gli appunti che `studia-libreria` deposita ◦ |
| `sviluppo/consegne.md` | il registro append-only delle consegne di `deliver-feature` ◦ |
| `sviluppo/runtime/review/` | i ledger dei giri di `review`, uno per ciclo ◦ |
| `sviluppo/esempi/reforgia/` | dominio e politiche di ReforgIA, come esempio compilato |

Le sedi marcate **◦ non esistono ancora**: le crea il contratto che le usa, al primo uso. Non sono
un'omissione da riparare a mano — una cartella vuota non dice niente a nessuno, e un registro vuoto
si legge come un registro di zero consegne invece che come un registro mai aperto.

**Questo repository versiona tutto**: prodotto, ricognizione, punti aperti, memoria, esempi e
istruzioni. Il `.gitignore` non filtra più niente — esclude soltanto `.claude/settings.local.json`,
che non deve stare in nessun git. Fino al 18 settembre 2026 era il contrario, e la differenza conta
qui perché il gruppo memoria/documentazione **adesso si committa** (§ *Il gruppo memoria/doc*).

Il confine di ciò che esce si è spostato altrove: sta nella lista di copia dello script di
pubblicazione, che copia i soli path ammessi in un **secondo** repository su GitHub. Nessun
contratto di questo corpus tocca quello script né quel repo.

## 1. Ruoli

Due soli ruoli, anonimi per costruzione. Una skill dichiara il ruolo di un passo, mai il modello.

| Ruolo | Quando si usa | Esempi di passo |
|---|---|---|
| **giudice** | il passo *decide* o *sintetizza*: produce lavoro nuovo a partire da input eterogenei, oppure riconcilia rilievi di più fonti dove sbagliare costa caro | brief di esecuzione, aggiornamento di memoria e documentazione, decisione su un problema |
| **worker** | il passo *esegue* o *ispeziona* un perimetro già delimitato: applica un piano, cerca rilievi in un diff, esegue comandi noti e ne riporta l'esito | esecuzione del brief, finder di review, scope, gate, inventario, comandi Git, report |

Un passo puramente meccanico (una riga di log, un `git add` di file già elencati, l'append a un
report) resta un **worker**: non merita un ruolo terzo.

## 2. Il modello di un ruolo

| Ruolo | Modello |
|---|---|
| **giudice** | `opus` |
| **worker** | `sonnet` |

È l'unica risoluzione ammessa, e avviene qui: la skill dichiara il ruolo e si ferma lì. Se
un giorno questo corpus dovesse girare su un host che non permette di scegliere il modello di un
subagent, il ruolo resta comunque dichiarato nel prompt, il passo gira sul modello di default, e
lo si dichiara nell'esito: la sequenza e i contratti non cambiano.

## 3. Come si lancia un subagent

Host: **Claude Code**. Si delega con il tool `Agent`, con `model` risolto secondo la §2 e
`subagent_type` scelto così:

- **`finder`** per i passi di sola analisi che riportano rilievi — i finder di `/review`.
  È definito in `.claude/agents/finder.md` e ha un **toolset ristretto**: non può scrivere file né
  delegare ad altri agent.
- **`Explore`** per la sola ricerca.
- **`general-purpose`** per tutto il resto, cioè per i passi che devono scrivere.

Più subagent indipendenti si lanciano nello **stesso** blocco di tool call, altrimenti non girano
davvero in parallelo.

**Il confine vero è quale tool c'è, non cosa ci scrivi dentro.** L'harness di Claude Code impone
tre cose e solo quelle: il `deny` delle permission rule, gli hook, e la **lista** dei tool che un
agent dichiara. Non impone il **contenuto** di un comando Bash: uno specificatore come
`Bash(git diff:*)` descrive un'intenzione e non la restringe, e un agent che ha `Bash` ha `Bash`
intero — un finder può eseguire `ls`, `cat`, `sed -i` e qualunque altra riga senza un diniego.

Ne segue una regola sola: **un vincolo che non sia l'assenza di un tool si ripete nel prompt del
subagent**, a partire dalla sola lettura di chi ha `Bash`.

## 4. Delega

Una skill orchestrante lancia ogni passo come **subagent in contesto fresco**, mai eseguendolo
inline nella conversazione: è ciò che tiene la catena lunga dentro un contesto sano e ciò che
rende un passo ripetibile.

1. **Prompt autosufficiente.** Il subagent parte da zero: nel prompt gli dai il **contratto da
   leggere** (il path del comando sotto `.claude/commands/`, mai il suo nome), l'input risolto
   (cartella, scope, base-ref) e il formato di ritorno. Non contare su nulla che sia solo nella
   tua conversazione.

   **Memoria pertinente.** A un passo che scrive, o che decide cosa scrivere, passi anche
   `sviluppo/memory/MEMORY.md` e i **path** delle memorie che il suo perimetro tocca — quelle che
   hai già in mano, scelte sull'indice — con l'istruzione di aprirle prima di lavorare. Non
   riassumerle nel prompt: un fatto riassunto diverge dal suo file al primo aggiornamento. Se
   nessuna memoria è pertinente, passi solo l'indice. È il canale per cui i fatti non deducibili
   dal repository raggiungono chi parte da zero.

   **Documenti di riferimento.** Per un lavoro che tocca la forma del pacchetto, i due host o la
   collocazione di un file, al prompt si aggiunge `sviluppo/RICOGNIZIONE.md` — e
   `sviluppo/PUNTI-APERTI.md` quando il lavoro rischia di decidere per conto proprio qualcosa che
   è già in quella lista. Un subagent che non li ha riscopre a sue spese prove già eseguite sui
   validatori reali, e nel caso peggiore chiude da solo una decisione che è dell'owner.

2. **Ritorno a contratto.** Ogni passo che alimenta una decisione a valle restituisce un blocco
   JSON con i campi che il **nodo** dichiara: si legge quello, non la prosa. Se il blocco manca o
   è incompleto, il passo è fallito — non interpretarlo a intuito.

   **E un passo fallito ha un tetto.** Si rilancia **una volta sola**, con lo stesso identico
   prompt; se non torna neanche allora, cosa ne segue lo dichiara la skill che lo ospita, e deve
   dichiararlo per iscritto. Senza quel tetto lo stesso silenzio produce comportamenti tutti
   difendibili e incomparabili fra esecuzioni — rilanciare a oltranza, saltare il passo, chiudere
   il ciclo — e nel resoconto le esecuzioni si leggono uguali. Un orchestratore che rilancia finché
   non ottiene la risposta che vuole non sta orchestrando.

   **Lo schema lo dichiara il nodo, una volta sola.** Il blocco di ritorno di un passo si scrive
   nel file del nodo che lo produce. Chi lo consuma lo **cita** — «il blocco che *quel file*
   dichiara, per intero» — e non lo ricopia; se ne legge di proposito solo un sottoinsieme,
   dichiara quali campi ignora e perché. Uno schema ricopiato dal chiamante si restringe
   attraversando l'arco: nasce identico, poi il nodo aggiunge un campo e il chiamante no, e quel
   campo semplicemente non arriva al decisore — che continua a decidere, con meno informazione di
   quanta ne esista, senza che niente segnali la perdita.

3. **Un passo, un subagent.** Non accorpare due fasi in un solo subagent per risparmiare un giro:
   la sequenza dichiarata dalla skill è il contratto.

4. **Se la delega non è disponibile**, esegui il passo in linea rispettando comunque ordine,
   perimetro e formato di ritorno, e **dichiaralo nell'esito**. Per i passi che si reggono
   sull'indipendenza dei figli — i finder di un giro di `/review` — *inline* è il secondo gradino,
   non il primo: si degrada prima a **subagent sequenziali**, dove la cecità reciproca resta
   intatta perché ogni contesto è comunque fresco. Solo se nemmeno quello è possibile si esegue in
   linea, e allora lo si dichiara nel blocco di ritorno (`"indipendenza": "persa"`): ordine,
   perimetro e formato sopravvivono alla degradazione, la cecità no — due finder valutati nello
   stesso contesto *sono* la singola passata già convinta di sé che il fan-out esiste per evitare.

**Chi può ri-delegare.** Un passo delegato **esegue**: non delega a sua volta. Le sole eccezioni
sono i due nodi che la §5 dichiara orchestranti **anche quando sono figli** — `review`, che delega
finder, applicatore, gate e commit, e `commit`, che delega l'allineamento a `update-memory`. Ogni
altro passo delegato è una **foglia**.

Gli altri nodi che ri-delegano — `deliver-feature`, `studia-problema`, `studia-libreria` — lo fanno
solo come **entry point**, cioè quando li lanci tu: nessuno li invoca mai come figli, e la §5 lo
dichiara nella colonna *Chi lo invoca*. `code-review` è il caso che tiene insieme le due cose:
ri-delega quando lo lanci su una pull request, **non** ri-delega quando `review` lo invoca come
finder — ed è il suo file a dichiararlo, non chi lo chiama.

Il cammino più lungo del grafo è di **tre archi di delega**, e uno solo lo raggiunge:
`review` lanciata a mano → `commit` → `update-memory` è di due; `deliver-feature` → `review` →
`finder` è di due; ed è `deliver-feature` → `review` → `commit` → `update-memory` a farne tre — ma
**dentro la consegna quel cammino non esiste**, perché `deliver-feature` passa sempre `--no-commit`
alla review e si tiene il commit come fase propria. Tre livelli sono il tetto teorico; due sono la
profondità reale di ogni esecuzione.

Un nodo che si accorge di voler delegare, e non è fra questi, sta eseguendo il lavoro di qualcun
altro: torna a contratto e lascia decidere a chi l'ha chiamato.

## 5. La topologia: chi è collegato a cosa

Le regole della §4 dicono *come* si lancia un passo. Questa tabella dice *cosa è collegato a cosa*:
chi può invocare un nodo, con quale input già risolto, con quale ritorno atteso, e se quel nodo può
ri-delegare. **Si legge prima di delegare**, e ogni cella è un **rimando**, mai una copia: il
contenuto vive nel file del nodo, che resta l'unico posto in cui si modifica.

| Nodo | Chi lo invoca | Riceve già risolto | Restituisce | Ri-delega |
|---|---|---|---|---|
| `studia-libreria` | owner | nome della tecnologia | appunti in `sviluppo/appunti-lib/` | sì — ricerca per blocco tematico, foglie |
| `studia-problema` | owner | descrizione del problema | `0. problem.md` in `sviluppo/nuovi-sviluppi/<slug>/` | sì — ricerca per area, foglie, e `decision-doc` alla chiusura |
| `decision-doc` | owner, `studia-problema` § *Passa il testimone* | cartella del problema, eventuale sottoinsieme da analizzare; da `studia-problema` anche il documento già scritto e le memorie pertinenti | `0.5. studio-strategico.md` oppure `1. decision-doc.md` sul disco, e come figlio il blocco di § *Modalità di invocazione* del suo file | no |
| `blueprint` | `deliver-feature` fase 1 | cartella con `1. decision-doc.md`, soluzione scelta verbatim, memorie pertinenti | § *Cosa restituisci* del suo file | no |
| `execute` | `deliver-feature` fase 2 | cartella con `2. blueprint.md`, memorie pertinenti | § *Cosa restituisci* del suo file | no |
| `review` | owner, `deliver-feature` fase 3 | base-ref o path di `4. review-notes.md`, ledger da riaprire (scelto su `base` **e** `item`), `--no-commit` da chi committa da sé, effort | § *Esito* del suo file | sì — finder, applicatore, gate, `commit` |
| `code-review` | owner (su PR), `review` come finder `bug` | PR **oppure** scope del giro | § *Modalità finder* del suo file | sì su PR, **no** come finder |
| `update-memory` | owner, `deliver-feature` fase 5b, `commit` § *Allineamento* | diff in index, cartella dell'item dove depositare il proprio artefatto (da `deliver-feature`) | § *Procedura* 7 del suo file | no |
| `commit` | owner, `review` § *Chiusura* (sempre, salvo `--no-commit`) | perimetro del gruppo codice | § *Procedura* 8 del suo file, in chat | sì — `update-memory` |
| `deliver-feature` | owner | cartella, soluzione scelta | § *Esito* del suo file | sì — le sue fasi, e `review` come figlio orchestrante |

**Un arco nuovo si dichiara qui.** Collegare un nodo a un chiamante che non lo aveva significa
aggiornare la sua riga — i chiamanti, l'input che ora riceve risolto, il permesso che
l'invocazione gli passa — nella stessa modifica che scrive l'arco. Una riga non aggiornata è un
arco che esiste nel testo dei prompt e non esiste da nessuna parte che si possa leggere.

### Un contratto raggiungibile in più di un modo dichiara le proprie modalità in casa

Lo stesso file è entry point e contratto interno, e le due invocazioni non hanno lo stesso scope
né gli stessi permessi: `code-review` commenta una pull request quando lo lanci tu e non scrive
niente quando è `/review` a invocarlo; `decision-doc` chiede all'owner quando lo lanci tu e non
chiede niente quando arriva da `/studia-problema`. Quella differenza **si dichiara nel nodo**, una
sezione per modalità, con scope, permessi di scrittura e blocco di ritorno. Chi invoca **sceglie**
la modalità e non riscrive i vincoli: una lista di deroghe scritta nel chiamante si erode a ogni
modifica del nodo, e nessuno se ne accorge finché il nodo non fa, in modalità finder, qualcosa che
quella lista aveva dimenticato di disattivare.

## 6. Concorrenza

Il **fan-out parallelo** è il default: i passi indipendenti (i due finder del giro 1 di una
review) girano insieme, lanciati nello stesso blocco di tool call.

I passi che toccano la stessa working tree — gate, commit, `git add`, calcolo di un base-ref —
sono **sempre** sequenziali: non sono serializzabili altrimenti, e qui la working tree è una sola.

## 7. Il gate di questo progetto

È l'unico posto in cui il gate è scritto. Chi lo esegue è `/review`, una volta sola, all'uscita del
ciclo (§ *Gate* del suo file): `/execute` non lo lancia e le sessioni di chat nemmeno. Su un dato
diff, se non gira lì non gira da nessuna parte.

Si esegue dalla radice del repository, in quest'ordine, e si riporta l'esito **reale** di ciascun
comando:

```bash
claude plugin validate plugins/daiku
python ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/daiku
node plugins/daiku/hooks/lib/guardia-comandi.mjs --self-check
node plugins/daiku/hooks/lib/contratti-post-edit.mjs --self-check
node plugins/daiku/hooks/lib/ciclo-aperto.mjs --self-check
```

**I due validatori vanno passati entrambi, sullo stesso albero, e la seconda riga non si salta**
(`CLAUDE.md`, § *Verificare il pacchetto*): non coprono le stesse cose — è quello di Codex a
rifiutare i campi di manifest non ammessi, ed è quello di Claude Code a segnalare le skill che si
caricherebbero con i metadati vuoti.

I tre `--self-check` sono banchi di prova a **totale contato**: escono con un JSON che porta
`controlli`, `passati` e `falliti`. **Si riporta il numero di `controlli`, non solo il verde**: un
totale che cala mentre i controlli crescono è un banco che ha smesso di girare, e il verde da solo
non lo mostra.

E, **per ogni file nuovo che il diff introduce sotto `plugins/`**:

```bash
git check-ignore -v <path>
```

Un file nuovo che **non** è ignorato si pubblica al prossimo commit; uno che lo è non arriverà mai a
chi installa. Nessuno dei due è un errore in sé — è un fatto, e va riportato nell'esito del gate,
perché è l'unica cosa irreversibile di tutta la catena.

**Quali comandi girano.** I due validatori girano **sempre**, perché guardano l'albero intero. I tre
`--self-check` girano **solo se il perimetro tocca `plugins/daiku/hooks/`**. Il `check-ignore` gira
**solo se il diff ha introdotto file nuovi**.

### Cosa questo gate non copre

Si dichiara qui perché un controllo assente e un controllo passato si leggono uguali in un esito, e
questa è l'unica riga che li distingue.

**Nessun controllo legge la prosa dei contratti.** I due validatori guardano la forma del pacchetto
— manifest, frontmatter, struttura — non cosa un contratto dice. Un rimando a un file che non
esiste, una sezione citata e mai scritta, uno schema di ritorno divergente fra nodo e chiamante:
tutto questo passa il gate. Un verificatore della topologia è esistito nel pacchetto ed è stato
**rimosso il 18 settembre 2026**, perché risolveva la propria radice per posizione sul disco e dopo
la riorganizzazione dell'albero cercava il corpus in `plugins/.claude/` — contando 3 controlli su
una ventina ed uscendo `1` per costruzione. Finché non ne esiste uno che sappia dove si trova, quei
difetti li prende **solo il finder di `review`**, ed è il motivo per cui la prima delle sue cinque
famiglie è «rimandi che non risolvono».

**Il validatore Codex, su questa macchina, potrebbe non partire.** Se esce
`ModuleNotFoundError: No module named 'yaml'`, manca `pyyaml` (`python -m pip install pyyaml`):
il gate è **rosso**, ed è il motivo giusto perché lo sia — `CLAUDE.md` dichiara quella validazione
obbligatoria, e un gate che la salta per comodità certificherebbe un pacchetto che nessuno ha
validato per Codex. Non è però un difetto del diff, e chi legge l'esito deve poterlo distinguere:
si risolve con un'installazione, non con una consegna.

## 8. Il gruppo memoria/doc

Nel prodotto, gli artefatti non-codice — memoria, istruzioni, documento tecnico — vanno in un
commit distinto dopo quello di feature. **Qui vale lo stesso**, dal 18 settembre 2026: `CLAUDE.md`,
tutto `sviluppo/` e la memoria sono versionati come il prodotto, quindi c'è un indice in cui
metterli e una storia da cui recuperarli.

Prima non era così — `git` tracciava soltanto `plugins/`, le due vetrine, `README.md` e il
`.gitignore` — e il corpus era stato scritto su quella premessa. Le conseguenze di allora, che
**non valgono più**: un `committed` sempre `null` in `update-memory`, due gruppi invece di tre in
`commit`, l'assenza di un «commit 2» in `deliver-feature`, un perimetro di review «fuori
dall'indice per costruzione».

> **Allineamento aperto.** Questa sezione è stata corretta il 19 settembre 2026; i contratti che
> dipendono da lei — `commit`, `update-memory`, `deliver-feature`, `review`, `blueprint`,
> `execute`, `decision-doc`, `studia-problema` — portano ancora la premessa vecchia, e vanno
> riletti prima di fidarsi di ciò che dicono su git. Finché non sono allineati, **vince questa
> sezione**: dove un contratto dice che il suo perimetro è fuori dall'indice, quel perimetro è
> nell'indice.

Il giorno in cui il repository diventa pubblico, questa sezione è una delle cose da rileggere
(`sviluppo/memory/pubblicazione-su-github.md`).

## 9. Divieti

- Nessuna skill nomina un modello: nomina un **ruolo**, e il modello lo risolve la §2. Il ruolo è
  l'unica cosa che una skill ha il diritto di scrivere.
- Nessuna skill duplica questo contratto, nemmeno «per comodità».
- Nessuna skill introduce un terzo ruolo o un profilo di modello proprio.
- Nessuna skill esegue `git push`, in nessuna fase e sotto nessuna autorizzazione. Il repository è
  privato fino al rilascio, e nessun contratto di questo corpus ha motivo di toccare un remoto.
- Il tool `Workflow` non è il motore di nessuna skill: l'orchestrazione è dell'agente, che delega a
  subagent secondo questo file. Non invocarlo.
- Nessuna skill di questo corpus scrive dentro `plugins/daiku/skills/` o
  `plugins/daiku/contracts/` **per allinearli a sé stessa**. Il prodotto si modifica perché lo
  decide una consegna, non perché una copia si è mossa.
- E il contrario vale ancora più stretto: i contratti di **questo** corpus — `.claude/commands/`,
  questo file, `.claude/agents/` — non si modificano affatto. Una modifica che varrebbe per
  entrambi si scrive solo nel prodotto; riportarla qui è una decisione che si chiede all'owner.
