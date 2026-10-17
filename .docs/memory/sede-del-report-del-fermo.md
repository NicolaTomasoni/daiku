---
name: sede-del-report-del-fermo
description: "La fase di report di `ship-feature` scrive su due sedi: `5. review-report.md` quando la review è girata, `5. delivery-report.md` quando la consegna si ferma prima — perché il nome di un artefatto è la prova di una fase e l'evaluatore legge i nomi"
metadata:
  node_type: memory
  type: project
  modified: 2026-10-16T22:01:42.379Z
  originSessionId: c57e7b86-3c77-40c3-b20b-ea500899c0c8
---

**Dal 9 ottobre 2026 la fase di report di `ship-feature` scrive su due sedi, e quale dipende
dall'unica cosa che quella fase non può dedurre da sola: se la fase 3 è girata.** Con la review
girata appende in coda a `<folder>/5. review-report.md`; senza — il fermo di Acquisition, Brief o
Execute, § *Early block*, e dal 15 ottobre il fermo volontario di `--no-review`, § *2b. No-review
stop* — scrive `<folder>/5. delivery-report.md`, intero e dalla prima riga. `5. review-report.md` è
la prova che la review è girata, e non lo scrive nessun altro.

**Il fermo di `--no-review` non è un giudizio, ed è per questo che non è una domanda
all'evaluatore.** Il flag si legge come token di `$ARGUMENTS` e la consegna si ferma dopo
l'esecuzione, prima della review: quello che resta da decidere è solo **da dove riprende**, e da
dove riprende lo dice già `question: "order"` — `4. review-notes.md` è la fase provata più avanti,
quindi `remaining` comincia da `review` e niente prima viene rifatto. Una chiave nuova in `order`
per il flag sarebbe una seconda risposta alla stessa domanda.

**Why.** Il nome di un artefatto **è** la prova di una fase: `PHASES` di `architect/architect.mjs`
lega ogni fase al file su disco che la prova, e `5. review-report.md` è la prova di `review`.
Spostare la sede del fermo tolse di mezzo il caso peggiore: il fermo di `--no-review` scriveva su
quella prova una review che non era girata, e la cartella restava con `1. decision-doc.md` e
`5. review-report.md` insieme — `MUTUALLY_EXCLUSIVE` leggeva la coppia come una contraddizione e
`order` rispondeva `stop`.

**Ma la coppia non è una contraddizione ovunque.** L'evaluatore non apre nessun file del progetto
— quello che sa del disco glielo passa chi lo chiama — e la leggeva **sulla sola presenza**:
una consegna arrivata davvero alla sua review, e ferma fra quella e la fase dopo, restava un vicolo
cieco, e l'unica uscita era rinominare a mano un artefatto, distruggendo la prova di una fase che
era girata. **Dal 16 ottobre 2026 non gli serve leggere dentro il file**: gli bastano due fatti che
riceve già — l'artefatto di `execute` sotto il report (`4. review-notes.md`, in `present`) e il
ledger di un ciclo della cartella (`ledger`, che la domanda pretende). Dove la review che il report
annuncia è girata, `order` taglia la catena a `review` e `remaining` comincia da `decision`: la
review non si rifà, e niente prima di lei. Dove non è girata — la cartella ferma di `--no-review`
porta `4. review-notes.md` e **nessun** ledger, e quel caso è ancora rosso nel banco — la coppia
resta la contraddizione di prima.

**Il prezzo, dichiarato.** La coda di `ship-feature` — `decision`, `memory`, `commit`, `merge`,
`cleanup`, `report` — non lascia artefatti: quattro delle sue fasi hanno `artifact: null` in
`PHASES`, e nulla le prova sul disco. Quindi una consegna **ferma prima del merge** si legge come una
ferma dopo `memory`, e un rilancio sulla sua cartella ordina la coda invece di fermarsi.

**Una consegna che è atterrata, invece, si distingue — e dal 17 ottobre 2026 lo dice un verdetto.**
Il segno non sta nei suoi artefatti, che non li committa nessuno, ma in Git: la §6b mergia con
`-m "merge: <folder>"`, e `architect/delivered.mjs` legge quel soggetto e ne restituisce lo sha.
`order` lo riceve come chiave `merged` e, con un merge trovato, risponde `stop`: un rilancio su una
cartella già consegnata **ferma la catena** invece di rieseguire l'esecuzione, e il `stop` nomina lo
sha. Il caso è nato il 16 ottobre 2026, quando una feature consegnata il 3 atterrò una seconda volta
— due implementazioni indipendenti della stessa cosa su due rami — perché la cartella aveva perso gli
artefatti che provavano l'esecuzione e rileggeva come «brief scritto, mai eseguito». Vedi
[[valutatore-deterministico]].

**How to apply:** il ramo sta in `skills/ship-feature/SKILL.md` § *7. Report*, la sede in
§ *Early block* e in § *2b. No-review stop*, e il banco è la sede deterministica dei quattro casi:
`order:the-early-block-reports-on-its-own-seat` e `order:the-no-review-stop-resumes-at-the-review`
ordinano la ripresa da `review` su una cartella ferma,
`ambiguity:the-review-report-stands-over-its-own-execute` ordina da `decision` una consegna arrivata
alla review, e i due rossi della stessa coppia
(`ambiguity:the-review-report-without-the-ledger-of-its-cycle` e
`ambiguity:the-review-report-with-a-ledger-and-no-execute`) tengono chiusa la porta del fermo — un
caso che non lo copre è una consegna che si ferma. Dopo una ripresa che arriva in fondo i due nomi
convivono: la traccia del fermo non si cancella. Vedi [[valutatore-deterministico]] e
[[ripresa-del-giro]].
