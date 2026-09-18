---
name: 'decision-doc'
description: 'Studia un problema, valuta se serve ancora pensiero strategico ad alto livello o solo chiudere i dettagli tecnici, e produce/aggiorna 0.5. studio-strategico.md o 1. decision-doc.md di conseguenza, rifinendo 0. problem.md'
argument-hint: '[cartella] [analizza solo: <sottoinsieme>]'
---

Ricevi una cartella che contiene il materiale di un problema (note, documenti, codice, requisiti, vincoli, ed eventualmente `0. problem.md` e/o `1. decision-doc.md` da run precedenti). Il tuo compito è duplice:

1. **Capire a che stadio di maturità è il problema** — mancano ancora decisioni strategiche ad alto livello (cosa fare, per chi, con quale perimetro), o la strategia è chiara e restano solo i dettagli tecnici da chiudere prima di eseguire?
2. **Agire di conseguenza** — o rifinisci `0. problem.md` con una revisione scettica e deponi le decisioni strategiche numerate in `0.5. studio-strategico.md`, o produci/aggiorni `1. decision-doc.md` con le decision card tecniche pronte per `/blueprint`.

**Ogni stadio lascia un documento.** Uno studio che si ferma alla direzione non è uno studio a metà: è il lavoro di quel livello, e vale quanto quello tecnico. Finché viveva solo in chat moriva con la sessione, e la cartella restava senza traccia del giudizio che l'aveva fermata lì.

Il senso della skill: tu ragioni come un senior engineer scettico ed esaustivo; l'utente legge in cima decisioni astratte con pro e contro (a qualunque stadio) e decide senza dover entrare nei dettagli.

## Modalità di invocazione

Lo stesso contratto si raggiunge in due modi, e i due non hanno lo stesso canale verso l'owner.
Chi ti invoca **sceglie** la modalità; i vincoli restano scritti qui, e non si riscrivono nel
prompt di chi chiama.

### Da owner — default

È questo file letto senza altro: risolvi la cartella da `$ARGUMENTS`, chiedi quando manca o
quando un documento già editato a mano rischia di essere sovrascritto, scrivi nella cartella del
problema, e la **Fase 4** la esegui tu quando l'owner risponde alla lista di decisioni. Riepiloghi
in chat.

### Da `studia-problema`

Sei un subagent in contesto fresco, lanciato quando `0. problem.md` è appena stato scritto sul
codice. Valgono tre differenze, e nient'altro cambia:

- **L'input arriva risolto** — cartella, `0. problem.md` e path delle memorie pertinenti stanno
  nel prompt. Il punto 2 della procedura non ha quasi nulla da fare: la cartella porta un solo
  documento, già nella forma giusta; se ne porta altri, li unisci come sempre. Non chiedere niente
  e non fermarti in attesa, perché non c'è nessuno che risponda.
- **La Fase 4 non gira qui.** Ti fermi alla lista di decisioni della Fase 3 e la restituisci: il
  recepimento è interattivo e appartiene a un'invocazione da owner, che arriverà con le risposte
  già in mano. Fasi 1, 2 e 3 girano per intero: lo stadio tecnico produce `1. decision-doc.md`,
  quello strategico `0.5. studio-strategico.md`. Fermarsi alla direzione non ti esonera dallo
  scrivere — è l'unico modo perché il tuo giudizio arrivi a chi decide.
- **Scrivi solo dentro la cartella del problema** che hai ricevuto. Non committi e non fai push.

**Chiudi sempre con il blocco a contratto**, così chi ti ha invocato lo legge senza interpretare
la prosa. Nessun campo si omette: a zero voci si scrive `[]`, e ciò che non si applica allo stadio
scelto è `null`.

```json
{
  "stadio": "strategico|tecnico",
  "perche_stadio": "<una frase sul perché quello stadio e non l'altro>",
  "file": "<path del documento prodotto o aggiornato>",
  "verdetto": "<la sintesi di apertura della revisione scettica, o null allo stadio tecnico>",
  "fix_applicati": ["<file e cosa hai corretto, uno per fix della Fase 2>"],
  "decisioni": "<la lista della Fase 3 verbatim in markdown, oppure, allo stadio tecnico, titolo e opzione consigliata di ogni decision card>",
  "aperto": ["<cosa resta da decidere, o quale dato mancava per decidere davvero>"]
}
```

Le `decisioni` tornano **verbatim**: chi ti ha chiamato le riporta all'owner senza riscriverle, e
una lista riassunta è una lista a cui l'owner risponde con meno di quanto hai scritto.

## Input: la cartella del problema

Argomenti: `$ARGUMENTS`

Il primo argomento è **una sola cartella**, come path relativo dalla root del repo o assoluto. Può seguire una clausola tipo «analizza solo <sottoinsieme>».

- Se `$ARGUMENTS` è vuoto, **chiedi** all'utente quale cartella usare. Non procedere a vuoto.
- Se la cartella non esiste, segnalalo e fermati.
- Se compare «analizza solo <sottoinsieme>», **leggi integralmente tutto** per contesto ma **produci rilievi/decisioni solo** sul sottoinsieme indicato. Senza clausola, l'analisi copre tutto.
- **Unisci prima, leggi dopo.** I file di riferimento nella cartella vanno prima concatenati in un unico file di descrizione del problema (vedi procedura, punto 2), poi letti da lì. Sono il materiale del problema, non un contesto opzionale: non saltare nulla in silenzio.
- **Lettura integrale, mai a campione**: ogni file va letto per intero prima di scrivere un solo rilievo o una sola decisione.
- Se un documento dichiara i propri fatti «verificati contro» una fonte presente nel repo (appunti, adapter, codice), **verifica a campione i claim portanti** contro quella fonte — un claim portante senza riscontro è un rilievo, non una nota.
- Apri `memory/MEMORY.md` e le memorie che l'area del problema tocca prima di analizzare: è il canale di §4.1 di `.claude/orchestration.md`. Se il chiamante non te li passa, apri l'indice e scegli tu — sei il nodo che apre la catena, quindi quei path non te li passa nessuno, e una decisione già chiusa che non hai letto la riapri senza accorgertene.
- Rispetta i punti che documenti o memoria dichiarano **già decisi/accertati/da assumere veri**: non risollevarli; segnalali **solo** se trovi un passaggio che li contraddice.

## I due stadi

- **Stadio strategico** (`0. problem.md`): il problema stesso non è ancora ben definito — mancano decisioni su cosa fare, per chi, con quale perimetro, o esistono contraddizioni/vuoti che nessuna quantità di dettaglio tecnico risolverebbe da sola. Qui si applica la **modalità revisione scettica**: rilievi citati, fix automatici dei banali, lista di decisioni strategiche numerate.
- **Stadio tecnico** (`1. decision-doc.md`): la strategia è chiara; restano da chiudere le decisioni di implementazione (tecnologie, approcci, trade-off). Qui si applica la **modalità studio approfondito**: nodo per nodo, opzioni motivate, raccomandazione, distillate in decision card leggibili in cima.

**Come si sceglie lo stadio:** leggi tutto il materiale disponibile nella cartella (`0. problem.md` se esiste, `1. decision-doc.md` se esiste, i file di riferimento) e valuta se le domande aperte sono di natura strategica (direzione, perimetro, se farlo o no) o tecnica (come farlo). Se convivono entrambe, tratta prima le strategiche: non ha senso motivare trade-off tecnici su un problema ancora mal definito — resta allo stadio strategico e fermati lì, senza produrre ancora `1. decision-doc.md`. **Dichiara sempre in chat quale stadio hai scelto e perché**, prima di procedere: non è una scelta silenziosa.

## Procedura

1. **Risolvi la cartella** da `$ARGUMENTS` e verifica che esista. Elenca i file che contiene.

2. **Unisci i file di riferimento nel problema base** (solo se non già fatto). Concatena in ordine tutti i file preesistenti nella cartella — **sola concatenazione**, senza riscrivere o riassumere il contenuto — in un unico file `0. problem.md`, ed elimina gli originali che hai accorpato (escludi dall'operazione l'eventuale `1. decision-doc.md` di una run precedente e lo stesso `0. problem.md` se già esiste). Se nella cartella c'è un solo file di riferimento, limitati a rinominarlo `0. problem.md`.

3. **Leggi tutto**: `0. problem.md`, `1. decision-doc.md` se esiste, eventuali altri file rimasti.

4. **Valuta lo stadio** (vedi sopra) e dichiaralo in chat.

5. **Applica la modalità corrispondente allo stadio** (dettagli sotto):
   - stadio strategico → **Modalità revisione scettica** su `0. problem.md`;
   - stadio tecnico → **Modalità studio approfondito**, producendo/aggiornando `1. decision-doc.md`.

6. **Riepiloga in chat** in poche righe cosa hai prodotto/aggiornato e cosa resta aperto. Se hai appena chiuso `1. decision-doc.md`, indica il passo successivo: `/blueprint <cartella> <opzioni scelte>` genera il brief di esecuzione.

---

## Modalità revisione scettica (stadio strategico)

Analizza `0. problem.md` (e `1. decision-doc.md` se esiste e le contraddizioni lo coinvolgono) come farebbe un **senior scettico che deve firmare la direzione prima che si passi al dettaglio tecnico**.

### Fase 1 — Analisi

Per ogni rilievo:
- cita il **passaggio esatto** (file + frase/§) da cui nasce;
- classifica: **[bloccante | rischio serio | punto debole | miglioria]**;
- distingui se è un problema **REALE** o solo una **scelta che non condividi**.

Copri in quest'ordine di priorità:
1. **Contraddizioni** (incoerenze, decisioni che si escludono, numeri o assunzioni divergenti, stato deciso/aperto dichiarato diversamente in punti diversi).
2. **Assunzioni non dimostrate** su cui poggia il resto. Per ognuna dì se è **verificabile dai documenti** (o dalle fonti nel repo) o se resta un **atto di fede**.
3. **Cosa MANCA**: decisioni strategiche mai prese, casi non coperti, punti aperti lasciati impliciti. Distingui il fuori-scope dichiarato (non è un rilievo) dal non-trattato.
4. **Punti deboli e migliorie** sul già scritto (numeri che non tornano, link rotti, numerazione, prescrizioni non eseguibili).

Non inventare: se un'area è fuori scope, dillo invece di riempirla. Apri il report con un **verdetto di sintesi** (pronto per lo studio tecnico / pronto con correzioni / ancora da pensare, e perché in due frasi).

### Fase 2 — Fix automatici (solo banali e di puro allineamento)

Applica **subito**, con modifiche chirurgiche, i rilievi che non richiedono alcuna scelta di disegno: link e riferimenti rotti, numerazione, conteggi smentiti dai documenti stessi, allineamento di stato quando è chiaro quale versione è quella deliberata, note di raccordo di una frase. **Mai** in questa fase nulla che cambi una decisione o introduca disegno nuovo — nel dubbio, va in Fase 3. Riepiloga ogni fix applicato (file + cosa).

### Fase 3 — Lista di decisione, e il documento che la porta

Tutto ciò che resta diventa una lista numerata a cui l'utente può rispondere in forma compatta (`1A, 2B, 3C...`).

**La lista si scrive in `0.5. studio-strategico.md`, nella cartella del problema, e non solo in chat.** In chat ne va il verdetto e i titoli delle decisioni; il documento porta tutto — è lui che sopravvive alla sessione e che l'owner rilegge quando torna a decidere. Struttura in § *Struttura dei documenti prodotti*. Se il file esiste già da una run precedente, aggiornalo in place: le decisioni già chiuse restano con la loro risposta, quelle nuove si accodano con la numerazione che continua, e una decisione decaduta non si cancella — si marca decaduta col perché.

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

Regole: 2–4 opzioni per decisione, **mutuamente esclusive**, ciascuna autosufficiente in una riga (status quo alla pari quando legittimo); **una sola** opzione raccomandata per decisione; ordina per gravità (prima i bloccanti/rischi seri); chiudi invitando a rispondere nel formato `1A, 2B, ...` — ammesse risposte libere che prevalgono sulle opzioni proposte.

### Fase 4 — Recepimento

Quando l'utente risponde:
- recepisci **ogni** decisione in `0. problem.md` con modifiche chirurgiche, propagando la coerenza (se una decisione ribalta un'affermazione ripetuta altrove, correggi **tutte** le occorrenze);
- **chiudi ogni decisione in `0.5. studio-strategico.md`**, dove è scritta: l'opzione scelta, la data, e dove è stata recepita. Le opzioni scartate restano — servono a chi un domani chiede perché non si è fatto altrimenti. Se il documento non esiste perché la lista è nata prima di questo contratto, scrivilo ora con le decisioni e le risposte insieme;
- se una risposta è una direttiva libera, prevale sulle opzioni: applicala;
- se l'utente dichiara un'assunzione «vera, fidati» → non toccare il documento; portala in memoria **solo attraverso il flusso che `CLAUDE.md` § *Contratto della memory* autorizza**, che è anche ciò che le dà la forma giusta e la riga in `memory/MEMORY.md`; nel riepilogo dichiara l'assunzione come punto da non risollevare;
- chiudi con un riepilogo per numero: decisione → cosa hai scritto e dove, più l'elenco di ciò che eventualmente resta aperto.

Se dopo il recepimento il problema è ormai ben definito (nessuna decisione strategica resta aperta), passa direttamente alla **Modalità studio approfondito** nella stessa run.

---

## Modalità studio approfondito (stadio tecnico)

### Principi (non negoziabili)

1. **Prima pensa, poi scrivi.** Identifica il problema reale e il bisogno effettivo. Se restano interpretazioni multiple, portale in superficie invece di sceglierne una in silenzio.
2. **Ancora tutto agli input.** Ogni affermazione su requisiti, vincoli o stato attuale deve poggiare sui file letti o su conoscenza tecnica verificabile. Non inventare requisiti, numeri, vincoli o fatti. Quando un'informazione manca per decidere, **dichiara l'assunzione** o segnala il dato mancante.
3. **Profondità nel corpo, semplicità in cima.** Il corpo è tecnico ed esaustivo: tecnologie candidate, motivazioni, pro e contro, costi, rischi. La sezione in cima è ad alta astrazione: niente nomi di librerie buttati lì senza spiegazione, solo la scelta, cosa comporta, e perché.
4. **Trade-off onesti.** Per ogni decisione mostra il prezzo della scelta consigliata, non solo i vantaggi. Una decisione senza contro elencati è sospetta: o è davvero banale (dillo) o non l'hai approfondita abbastanza.
5. **Una raccomandazione chiara.** Per ogni decisione indica l'opzione che consigli e in una frase il perché. L'utente deve poter decidere leggendo solo la cima.
6. **Solo le decisioni che contano, status quo incluso.** Porta in cima **solo** le decisioni che richiedono un vero giudizio umano. Le scelte forzate (senza alternativa reale) non diventano card: citale nell'approfondimento e basta. Non frammentare in micro-decisioni. Quando tenere la situazione attuale è legittimo, mettila tra le opzioni alla pari.

### Procedura

1. **Se `0. problem.md` non è ancora stato letto**, leggilo ed estrai: qual è il problema, il bisogno reale, quali vincoli emergono, cosa esiste già. Se `1. decision-doc.md` esiste già da una run precedente, leggilo e usalo come base da aggiornare, non riscrivere da zero ciò che resta valido.

2. **Studia il problema in profondità.** Per ogni nodo decisionale tecnico che il problema impone:
   - identifica le opzioni tecniche reali (tecnologie, approcci, architetture), inclusa — quando è legittima — l'opzione **non cambiare / status quo**;
   - per ciascuna, motiva: perché potrebbe andare bene, cosa costa, quali rischi e quali vincoli introduce;
   - confronta le opzioni su criteri concreti (adeguatezza al bisogno, complessità, costo, maturità, manutenibilità, lock-in, impatto sull'esistente);
   - scegli quella che consigli e giustifica la scelta rispetto alle altre.
   Se il problema impone più decisioni indipendenti, trattale separatamente; ma accorpa quelle che si decidono insieme e tieni fuori dalle card quelle forzate (solo nell'approfondimento).

3. **Se il materiale è insufficiente per decidere davvero** (manca il problema, i vincoli o il contesto necessario a confrontare le opzioni), **non** produrre un documento sicuro ma senza base: fermati, dichiara cosa manca ed elenca le informazioni o i file che servirebbero.

4. **Scrivi il documento** (vedi struttura sotto). Scrivi **prima il corpo tecnico** (è lì che ragioni), **poi distilla la sezione in cima** a partire dal corpo. La cima è un riassunto decisionale del corpo, non un testo scollegato.

5. **Salva** il documento come `1. decision-doc.md` nella cartella di input. Se esiste già, aggiornalo in place (non sovrascrivere in silenzio ciò che l'utente ha già editato manualmente: se noti modifiche manuali incompatibili con quanto stai per scrivere, segnalale). Salva in **UTF-8** con gli accenti italiani intatti (à è é ì ò ù).

## Struttura dei documenti prodotti

`0. problem.md` è la concatenazione dei file di riferimento, eventualmente aggiornata dalla Fase 4 della modalità scettica con le decisioni strategiche recepite — non ha una struttura fissa oltre a questa.

`0.5. studio-strategico.md` (stadio strategico). Sta fra i due numeri perché è ciò che si legge **dopo** aver visto il problema e **prima** che esista uno studio tecnico — e perché una cartella può arrivarci dopo un `1. decision-doc.md`, quando una domanda di direzione si riapre:

```text
# <Titolo del problema> — studio strategico

> Stato, data, e in una riga perché lo stadio è strategico e non tecnico.

## Verdetto
   La sintesi di apertura della Fase 1: pronto per lo studio tecnico /
   pronto con correzioni / ancora da pensare, e perché in due frasi.

## Decisioni strategiche rimaste     ← il formato esatto della Fase 3, verbatim
   Per ognuna: classificazione, problema con la citazione da cui nasce,
   2-4 opzioni mutuamente esclusive, una sola raccomandata.
   Quando l'owner ha risposto, ogni voce porta in coda la riga
   **Scelta: <opzione> (<data>)** — e dove è stata recepita.

## Rilievi che non sono diventati decisioni
   I fix applicati in Fase 2 (file + cosa), e i rilievi giudicati scelte
   legittime di chi ha scritto: si dichiarano per non farli risollevare.

## Cosa resta fuori
   Le domande che questo stadio non ha potuto chiudere, e quale dato
   mancava per chiuderle.
```

Una decisione decaduta non si cancella: resta con la riga **Decaduta: \<perché\>**, perché la cartella racconti anche le strade che il tempo ha chiuso.

`1. decision-doc.md`:

```text
# <Titolo del problema>

## Decisioni da prendere            ← IN CIMA, alto livello, niente tecnicismi
   Per ogni decisione, una "decision card":
   - Decisione: la domanda in una frase, in linguaggio comprensibile
   - Opzioni: A / B (/ C), descritte per cosa significano, non per come sono fatte
   - Pro e contro: in parole semplici, il prezzo di ciascuna opzione
   - Consigliato: l'opzione che suggerisci + una frase di perché
   (Ripeti per ogni decisione indipendente.)

---

## Approfondimento tecnico          ← SOTTO, denso e motivato
   - Il problema e il bisogno reale (cosa serve davvero, dedotto dagli input)
   - Vincoli ed evidenze raccolte dai file di riferimento
   - Per ogni decisione: opzioni candidate, motivazioni tecniche,
     pro/contro dettagliati, costi, rischi, confronto su criteri, scelta motivata
   - Assunzioni dichiarate e dati mancanti
```

Regola di taglio: la sezione **Decisioni da prendere** deve essere leggibile e sufficiente per decidere **senza** scorrere l'approfondimento. L'approfondimento esiste per chi vuole verificare il *perché*.

Salva sempre in **UTF-8** con gli accenti italiani intatti (à è é ì ò ù). Ogni riga modificata deve ricondursi a un rilievo o a una decisione: niente riscritture di stile fuori scope.
