---
description: 'Studia un problema di Daiku, valuta se serve ancora pensiero strategico ad alto livello o solo chiudere i dettagli tecnici, e produce o aggiorna 0.5. studio-strategico.md oppure 1. decision-doc.md di conseguenza, rifinendo 0. problem.md'
argument-hint: '[cartella] [analizza solo: <sottoinsieme>]'
---

Ricevi una cartella che contiene il materiale di un problema (note, documenti, requisiti, vincoli,
ed eventualmente `0. problem.md` e/o `1. decision-doc.md` da run precedenti). Il tuo compito è
duplice:

1. **Capire a che stadio di maturità è il problema** — mancano ancora decisioni strategiche ad alto
   livello (cosa fare, con quale perimetro, se farlo), o la direzione è chiara e restano solo i
   dettagli tecnici da chiudere prima di eseguire?
2. **Agire di conseguenza** — o rifinisci `0. problem.md` con una revisione scettica e deponi le
   decisioni strategiche numerate in `0.5. studio-strategico.md`, o produci/aggiorni
   `1. decision-doc.md` con le decision card tecniche pronte per il brief di esecuzione.

**Ogni stadio lascia un documento.** Uno studio che si ferma alla direzione non è uno studio a
metà: è il lavoro di quel livello, e vale quanto quello tecnico. Finché viveva solo in chat moriva
con la sessione, e la cartella restava senza traccia del giudizio che l'aveva fermata lì.

Il senso della skill: tu ragioni come un senior scettico ed esaustivo; l'owner legge in cima
decisioni astratte con pro e contro e decide senza dover entrare nei dettagli.

## Modalità di invocazione

Lo stesso contratto si raggiunge in due modi, e i due non hanno lo stesso canale verso l'owner.
Chi ti invoca **sceglie** la modalità; i vincoli restano scritti qui, e non si riscrivono nel
prompt di chi chiama.

### Da owner — default

È questo file letto senza altro: risolvi la cartella da `$ARGUMENTS`, chiedi quando manca o quando
un documento già editato a mano rischia di essere sovrascritto, scrivi nella cartella del problema,
e la **Fase 4** la esegui tu quando l'owner risponde alla lista di decisioni. Riepiloghi in chat.

### Da `studia-problema`

Sei un subagent in contesto fresco, lanciato quando `0. problem.md` è appena stato scritto. Valgono
tre differenze, e nient'altro cambia:

- **L'input arriva risolto** — cartella, `0. problem.md`, documenti di riferimento e path delle
  memorie pertinenti stanno nel prompt. Il punto 2 della procedura non ha quasi nulla da fare: la
  cartella porta un solo documento, già nella forma giusta. Non chiedere niente e non fermarti in
  attesa, perché non c'è nessuno che risponda.
- **La Fase 4 non gira qui.** Ti fermi alla lista di decisioni della Fase 3 e la restituisci: il
  recepimento è interattivo e appartiene a un'invocazione da owner, che arriverà con le risposte
  già in mano. Fasi 1, 2 e 3 girano per intero: lo stadio tecnico produce `1. decision-doc.md`,
  quello strategico `0.5. studio-strategico.md`. Fermarsi alla direzione non ti esonera dallo
  scrivere — è l'unico modo perché il tuo giudizio arrivi a chi decide.
- **Scrivi solo dentro la cartella del problema** che hai ricevuto. Non committi e non fai push.

**Chiudi sempre con il blocco a contratto**, così chi ti ha invocato lo legge senza interpretare la
prosa. Nessun campo si omette: a zero voci si scrive `[]`, e ciò che non si applica allo stadio
scelto è `null`.

```json
{
  "stadio": "strategico|tecnico",
  "perche_stadio": "<una frase sul perché quello stadio e non l'altro>",
  "file": "<path del documento prodotto o aggiornato>",
  "verdetto": "<la sintesi di apertura della revisione scettica, o null allo stadio tecnico>",
  "fix_applicati": ["<file e cosa hai corretto, uno per fix della Fase 2>"],
  "decisioni": "<la lista della Fase 3 verbatim in markdown, oppure, allo stadio tecnico, titolo e opzione consigliata di ogni decision card>",
  "punti_aperti_toccati": ["<il numero e il titolo di ogni voce di .docs/PUNTI-APERTI.md che questa cartella tocca>"],
  "aperto": ["<cosa resta da decidere, o quale dato mancava per decidere davvero>"]
}
```

Le `decisioni` tornano **verbatim**: chi ti ha chiamato le riporta all'owner senza riscriverle, e
una lista riassunta è una lista a cui l'owner risponde con meno di quanto hai scritto.

## Input: la cartella del problema

Argomenti: `$ARGUMENTS`

Il primo argomento è **una sola cartella**, come path relativo dalla radice del repository o
assoluto — normalmente `.docs/nuovi-sviluppi/<slug>/`. Può seguire una clausola tipo «analizza
solo <sottoinsieme>».

- Se `$ARGUMENTS` è vuoto, **chiedi** quale cartella usare. Non procedere a vuoto.
- Se la cartella non esiste, segnalalo e fermati.
- Se compare «analizza solo <sottoinsieme>», **leggi integralmente tutto** per contesto ma **produci
  rilievi e decisioni solo** sul sottoinsieme indicato.
- **Unisci prima, leggi dopo.** I file di riferimento nella cartella vanno prima concatenati in un
  unico documento di problema (procedura, punto 2), poi letti da lì. Sono il materiale del
  problema, non un contesto opzionale: non saltare nulla in silenzio.
- **Lettura integrale, mai a campione**: ogni file va letto per intero prima di scrivere un solo
  rilievo o una sola decisione.

## I quattro documenti che delimitano il tuo giudizio

Prima di analizzare, apri:

1. **`.docs/PUNTI-APERTI.md`** — le decisioni che l'owner non ha ancora preso. Se una decisione
   che stai per porre **è** uno di quei punti, non chiuderla: portala come decisione, con il
   riferimento al numero, e mettila in `punti_aperti_toccati`. Una decisione di quella lista chiusa
   dentro una cartella di lavoro è una decisione presa da te al posto suo.
2. **Le memorie sui due host** — `.docs/memory/cosa-i-due-host-accettano.md`,
   `cosa-codex-fa-allinstallazione.md` e `installazione-e-versionamento.md`: i fatti verificati, con
   la prova eseguita e la data. Un'opzione che quelle memorie hanno già dimostrato impossibile (un
   manifest Codex che porta `hooks`, una skill di sola consultazione dichiarata nel frontmatter) non
   è un'opzione: citala come vincolo, non come strada.
3. **`CLAUDE.md`** — gli invarianti di sviluppo: la divisione fra prodotto e sviluppo, la regola di
   pubblicazione, come si verifica il pacchetto.
4. **`.docs/memory/MEMORY.md`** e le memorie che l'area tocca. Se il chiamante non te le passa,
   apri l'indice e scegli tu — sei il nodo che apre lo stadio decisionale, quindi quei path non te
   li passa nessuno, e un fatto già accertato che non hai letto lo riapri senza accorgertene.

Rispetta i punti che documenti o memoria dichiarano **già decisi o accertati**: non risollevarli;
segnalali **solo** se trovi un passaggio che li contraddice.

## I due stadi

- **Stadio strategico** (`0. problem.md` + `0.5. studio-strategico.md`): il problema stesso non è
  ancora ben definito — mancano decisioni su cosa fare, con quale perimetro, o esistono
  contraddizioni e vuoti che nessuna quantità di dettaglio tecnico risolverebbe da sola. Qui si
  applica la **modalità revisione scettica**.
- **Stadio tecnico** (`1. decision-doc.md`): la direzione è chiara; restano da chiudere le decisioni
  di realizzazione (dove va un file, quale forma prende un rimando, quale contratto assorbe cosa).
  Qui si applica la **modalità studio approfondito**.

**Come si sceglie lo stadio:** leggi tutto il materiale e valuta se le domande aperte sono di natura
strategica (direzione, perimetro, se farlo) o tecnica (come farlo). Se convivono entrambe, tratta
prima le strategiche: non ha senso motivare trade-off tecnici su un problema ancora mal definito —
resta allo stadio strategico e fermati lì, senza produrre ancora `1. decision-doc.md`. **Dichiara
sempre quale stadio hai scelto e perché**, prima di procedere: non è una scelta silenziosa.

## Procedura

1. **Risolvi la cartella** da `$ARGUMENTS` e verifica che esista. Elenca i file che contiene.

2. **Unisci i file di riferimento nel problema base** (solo se non già fatto). Concatena in ordine
   tutti i file preesistenti nella cartella — **sola concatenazione**, senza riscrivere o riassumere
   — in un unico file `0. problem.md`, ed elimina gli originali accorpati (escludi l'eventuale
   `1. decision-doc.md` di una run precedente e lo stesso `0. problem.md` se già esiste). Se nella
   cartella c'è un solo file di riferimento, limitati a rinominarlo `0. problem.md`.

3. **Leggi tutto**: `0. problem.md`, `1. decision-doc.md` se esiste, gli altri file rimasti, e i
   quattro documenti della sezione precedente.

4. **Valuta lo stadio** e dichiaralo.

5. **Applica la modalità corrispondente** (dettagli sotto).

6. **Riepiloga** in poche righe cosa hai prodotto o aggiornato e cosa resta aperto. Se hai appena
   chiuso `1. decision-doc.md`, indica il passo successivo: `/deliver-feature <cartella> <opzioni
   scelte>` consegna la feature dall'inizio al commit.

---

## Modalità revisione scettica (stadio strategico)

Analizza `0. problem.md` (e `1. decision-doc.md` se esiste e le contraddizioni lo coinvolgono) come
farebbe un **senior scettico che deve firmare la direzione prima che si passi al dettaglio**.

### Fase 1 — Analisi

Per ogni rilievo:

- cita il **passaggio esatto** (file + frase o §) da cui nasce;
- classifica: **[bloccante | rischio serio | punto debole | miglioria]**;
- distingui se è un problema **REALE** o solo una **scelta che non condividi**.

Copri in quest'ordine di priorità:

1. **Contraddizioni** (incoerenze, decisioni che si escludono, stato deciso/aperto dichiarato
   diversamente in punti diversi).
2. **Assunzioni non dimostrate** su cui poggia il resto. Per ognuna dì se è **verificabile** — e qui
   «verificabile» ha un significato forte: su questa macchina i due validatori, `codex features
   list` e le skill di sistema in `~/.codex/skills/.system/` rispondono per davvero. Un'assunzione
   sul comportamento di un host che si può provare in trenta secondi non è un atto di fede: è un
   rilievo che chiede una prova.
3. **Cosa MANCA**: decisioni mai prese, casi non coperti, punti aperti lasciati impliciti. Distingui
   il fuori-scope dichiarato (non è un rilievo) dal non-trattato.
4. **Punti deboli e migliorie** sul già scritto (numeri che non tornano, rimandi rotti, prescrizioni
   non eseguibili).

Un rilievo che vale il doppio in questo repository: **una decisione che pubblica**. Ogni file nuovo
sotto `plugins/` esce com'è scritto a chiunque aggiunga il marketplace, e nessun filtro lo trattiene:
il `.gitignore` non è il confine, e la lista di copia dello script di rilascio prende `plugins/`
in blocco. Se il problema propone di aggiungere qualcosa lì dentro, chiedersi se ci appartiene **è**
un rilievo bloccante, non una nota.

Non inventare: se un'area è fuori scope, dillo invece di riempirla. Apri il report con un **verdetto
di sintesi** (pronto per lo studio tecnico / pronto con correzioni / ancora da pensare, e perché in
due frasi).

### Fase 2 — Fix automatici (solo banali e di puro allineamento)

Applica **subito**, con modifiche chirurgiche, i rilievi che non richiedono alcuna scelta di
disegno: rimandi rotti, numerazione, conteggi smentiti dai documenti stessi, allineamento di stato
quando è chiaro quale versione è quella deliberata, note di raccordo di una frase. **Mai** in questa
fase nulla che cambi una decisione o introduca disegno nuovo — nel dubbio, va in Fase 3. Riepiloga
ogni fix applicato (file + cosa).

### Fase 3 — Lista di decisione, e il documento che la porta

Tutto ciò che resta diventa una lista numerata a cui l'owner può rispondere in forma compatta
(`1A, 2B, 3C...`).

**La lista si scrive in `0.5. studio-strategico.md`, nella cartella del problema, e non solo in
chat.** In chat ne va il verdetto e i titoli delle decisioni; il documento porta tutto — è lui che
sopravvive alla sessione. Se il file esiste già da una run precedente, aggiornalo in place: le
decisioni già chiuse restano con la loro risposta, quelle nuove si accodano con la numerazione che
continua, e una decisione decaduta non si cancella — si marca decaduta col perché.

Formato **esatto** di ogni voce, ben indentato, opzione raccomandata **in grassetto**:

```markdown
# Decisioni strategiche rimaste

**1. <Titolo breve della decisione>** — [classificazione]
   - Problema: <una riga, con la citazione (file §x) da cui nasce>
   - Opzioni:
     - A — <opzione in una riga: cosa si fa e cosa costa>
     - **B — <opzione in una riga> ← raccomandata: <perché, in una frase>**
     - C — <opzione in una riga>
```

Regole: 2–4 opzioni per decisione, **mutuamente esclusive**, ciascuna autosufficiente in una riga
(status quo alla pari quando legittimo); **una sola** opzione raccomandata per decisione; ordina per
gravità; chiudi invitando a rispondere nel formato `1A, 2B, ...` — ammesse risposte libere che
prevalgono sulle opzioni proposte.

Se una decisione coincide con un punto di `.docs/PUNTI-APERTI.md`, **dillo nella riga del
problema** con il suo numero: l'owner deve poter vedere che sta rispondendo lì a una domanda che
aveva già messo in lista, e che la risposta va riportata anche in quel file.

### Fase 4 — Recepimento

Quando l'owner risponde:

- recepisci **ogni** decisione in `0. problem.md` con modifiche chirurgiche, propagando la coerenza
  (se una decisione ribalta un'affermazione ripetuta altrove, correggi **tutte** le occorrenze);
- **chiudi ogni decisione in `0.5. studio-strategico.md`**, dove è scritta: l'opzione scelta, la
  data, e dove è stata recepita. Le opzioni scartate restano — servono a chi un domani chiede perché
  non si è fatto altrimenti;
- se una decisione chiudeva un punto di `.docs/PUNTI-APERTI.md`, **aggiorna anche quel file**:
  la voce esce dalla lista con la risposta e la data. Una lista di decisioni aperte che contiene
  decisioni già prese smette di essere letta;
- se una risposta è una direttiva libera, prevale sulle opzioni: applicala;
- se l'owner dichiara un'assunzione «vera, fidati» → non toccare il documento; portala in memoria
  seguendo il contratto che `.claude/commands/update-memory.md` dichiara nella propria
  § *La forma della memoria di questo progetto*, indice compreso; nel riepilogo dichiarala come
  punto da non risollevare;
- chiudi con un riepilogo per numero: decisione → cosa hai scritto e dove, più l'elenco di ciò che
  resta aperto.

Se dopo il recepimento il problema è ormai ben definito, passa direttamente alla **Modalità studio
approfondito** nella stessa run.

---

## Modalità studio approfondito (stadio tecnico)

### Principi (non negoziabili)

1. **Prima pensa, poi scrivi.** Identifica il problema reale e il bisogno effettivo. Se restano
   interpretazioni multiple, portale in superficie invece di sceglierne una in silenzio.
2. **Ancora tutto agli input.** Ogni affermazione su requisiti, vincoli o stato attuale deve
   poggiare sui file letti o su una prova eseguita. Non inventare requisiti, numeri o fatti sugli
   host. Quando un'informazione manca per decidere, **dichiara l'assunzione** o segnala il dato
   mancante — e se il dato si può ottenere con un comando, ottienilo.
3. **Profondità nel corpo, semplicità in cima.** Il corpo è tecnico ed esaustivo. La sezione in cima
   è ad alta astrazione: solo la scelta, cosa comporta, e perché.
4. **Trade-off onesti.** Per ogni decisione mostra il prezzo della scelta consigliata, non solo i
   vantaggi. Una decisione senza contro elencati è sospetta: o è davvero banale (dillo) o non l'hai
   approfondita abbastanza.
5. **Una raccomandazione chiara.** Per ogni decisione indica l'opzione che consigli e in una frase
   il perché. L'owner deve poter decidere leggendo solo la cima.
6. **Solo le decisioni che contano, status quo incluso.** Porta in cima **solo** le decisioni che
   richiedono un vero giudizio umano. Le scelte forzate — e in questo repository molte lo sono,
   perché un validatore le impone — non diventano card: citale nell'approfondimento come vincolo.
   Non frammentare in micro-decisioni.

### I criteri su cui si confrontano le opzioni, qui

Oltre ai soliti (complessità, costo, manutenibilità), questo progetto ne ha quattro propri, e una
decisione che non li nomina non è stata studiata:

- **Regge su entrambi gli host?** Una soluzione che funziona solo su Claude Code è legittima, ma va
  dichiarata tale, con cosa succede su Codex. `.docs/memory/cosa-i-due-host-accettano.md` dice cosa
  i due accettano.
- **Sopravvive all'installazione?** Il pacchetto viene **copiato** in una cache il cui path cambia
  a ogni aggiornamento, e nessun host lascia che un pacchetto scriva nel progetto dell'utente. Un
  rimando che è un path assoluto, o un file che il pacchetto dovrebbe depositare fuori di sé, non
  regge.
- **Resta atomico?** Il criterio che regge il metodo è che il file di un contratto sia identico in
  ogni progetto ospite. Un valore specifico dentro un contratto rompe quell'atomicità e va spostato
  di livello.
- **Cosa pubblica?** Ogni file nuovo sotto `plugins/` esce a chiunque installi. Se la soluzione ne
  aggiunge, la card deve dirlo.

### Procedura

1. **Se `0. problem.md` non è ancora stato letto**, leggilo ed estrai: qual è il problema, il bisogno
   reale, quali vincoli emergono, cosa esiste già. Se `1. decision-doc.md` esiste da una run
   precedente, usalo come base da aggiornare, non riscrivere da zero ciò che resta valido.

2. **Studia il problema in profondità.** Per ogni nodo decisionale:
   - identifica le opzioni reali, inclusa — quando è legittima — l'opzione **non cambiare**;
   - per ciascuna, motiva: perché potrebbe andare bene, cosa costa, quali rischi introduce;
   - confronta le opzioni sui criteri concreti, **compresi i quattro qui sopra**;
   - scegli quella che consigli e giustifica la scelta rispetto alle altre.

3. **Se il materiale è insufficiente per decidere davvero**, **non** produrre un documento sicuro ma
   senza base: fermati, dichiara cosa manca ed elenca le informazioni, i file o le prove che
   servirebbero.

4. **Scrivi il documento.** Scrivi **prima il corpo tecnico** (è lì che ragioni), **poi distilla la
   sezione in cima** a partire dal corpo.

5. **Salva** come `1. decision-doc.md` nella cartella di input. Se esiste già, aggiornalo in place
   (se noti modifiche manuali incompatibili con quanto stai per scrivere, segnalale invece di
   sovrascriverle). Salva in **UTF-8** con gli accenti italiani intatti.

## Struttura dei documenti prodotti

`0. problem.md` è la concatenazione dei file di riferimento, eventualmente aggiornata dalla Fase 4
con le decisioni recepite — non ha una struttura fissa oltre a questa.

`0.5. studio-strategico.md` sta fra i due numeri perché è ciò che si legge **dopo** aver visto il
problema e **prima** che esista uno studio tecnico — e perché una cartella può arrivarci dopo un
`1. decision-doc.md`, quando una domanda di direzione si riapre:

```text
# <Titolo del problema> — studio strategico

> Stato, data, e in una riga perché lo stadio è strategico e non tecnico.

## Verdetto
   La sintesi di apertura della Fase 1.

## Decisioni strategiche rimaste     ← il formato esatto della Fase 3, verbatim
   Per ognuna: classificazione, problema con la citazione da cui nasce,
   2-4 opzioni mutuamente esclusive, una sola raccomandata, e il riferimento
   al punto di PUNTI-APERTI.md se coincide con uno.
   Quando l'owner ha risposto, ogni voce porta in coda la riga
   **Scelta: <opzione> (<data>)** — e dove è stata recepita.

## Rilievi che non sono diventati decisioni
   I fix applicati in Fase 2 (file + cosa), e i rilievi giudicati scelte
   legittime di chi ha scritto: si dichiarano per non farli risollevare.

## Cosa resta fuori
   Le domande che questo stadio non ha potuto chiudere, e quale dato
   mancava per chiuderle.
```

Una decisione decaduta non si cancella: resta con la riga **Decaduta: \<perché\>**, perché la
cartella racconti anche le strade che il tempo ha chiuso.

`1. decision-doc.md`:

```text
# <Titolo del problema>

## Decisioni da prendere            ← IN CIMA, alto livello, niente tecnicismi
   Per ogni decisione, una "decision card":
   - Decisione: la domanda in una frase, in linguaggio comprensibile
   - Opzioni: A / B (/ C), descritte per cosa significano, non per come sono fatte
   - Pro e contro: in parole semplici, il prezzo di ciascuna opzione
   - Cosa pubblica: se la scelta aggiunge o cambia file sotto plugins/, dillo qui
   - Consigliato: l'opzione che suggerisci + una frase di perché
   (Ripeti per ogni decisione indipendente.)

---

## Approfondimento tecnico          ← SOTTO, denso e motivato
   - Il problema e il bisogno reale
   - Vincoli ed evidenze raccolte dai file e dalle prove eseguite
   - Per ogni decisione: opzioni candidate, motivazioni, pro/contro dettagliati,
     confronto sui criteri (compresi i quattro di questo progetto), scelta motivata
   - Le scelte forzate, con il vincolo che le forza
   - Assunzioni dichiarate e dati mancanti
```

Regola di taglio: la sezione **Decisioni da prendere** deve essere leggibile e sufficiente per
decidere **senza** scorrere l'approfondimento. L'approfondimento esiste per chi vuole verificare il
*perché*.

Salva sempre in **UTF-8** con gli accenti italiani intatti. Ogni riga modificata deve ricondursi a
un rilievo o a una decisione: niente riscritture di stile fuori scope.

## Vincoli operativi

- **Non scrivi mai sotto `plugins/`.** Studi il prodotto e decidi cosa farne; la modifica la scrive
  una consegna, dopo.
- **Non committare** e non fare push.
