---
name: sede-del-report-del-fermo
description: "La fase di report di `ship-feature` scrive su due sedi: `5. review-report.md` quando la review è girata, `5. delivery-report.md` quando la consegna si ferma prima — perché il nome di un artefatto è la prova di una fase e l'evaluatore legge i nomi"
metadata:
  node_type: memory
  type: project
  modified: 2026-10-15T17:08:43.354Z
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
lega ogni fase al file su disco che la prova, e `5. review-report.md` è la prova di `review`. Prima
il fermo raccontava lì la sua storia, e la cartella restava con `1. decision-doc.md` e
`5. review-report.md` insieme: `MUTUALLY_EXCLUSIVE` legge quella coppia come una contraddizione — un
lavoro non può essere insieme prima e dopo la consegna — e `order` risponde `stop`. La ripresa che
`ship-feature` § *Input* dichiara su una consegna interrotta a metà non era più ordinabile, e
l'unica uscita era rinominare a mano l'artefatto, distruggendo la traccia del fermo.

**E l'evaluatore non poteva imparare la differenza.** Non apre nessun file del progetto — è il suo
contratto, quello che sa del disco glielo passa chi lo chiama — quindi non può leggere dentro il
report per vedere se porta una review; distinguere i due casi avrebbe voluto una chiave nuova in
`question: "order"` e un chiamante tenuto a passarla giusta. Spostare la sede ripristina invece
l'invariante su cui l'evaluatore è costruito — un nome di fase, un artefatto che la prova — senza
toccarne una riga di codice.

**How to apply:** il ramo sta in `skills/ship-feature/SKILL.md` § *7. Report*, la sede in
§ *Early block* e in § *2b. No-review stop*, e i due casi di banco
`order:the-early-block-reports-on-its-own-seat` e `order:the-no-review-stop-resumes-at-the-review` in
`architect/architect.mjs` ordinano la ripresa da `review` su una cartella ferma — il banco è la sede
deterministica, e un caso che non lo copre è una consegna che si ferma. Dopo una ripresa che
arriva in fondo i due nomi convivono: la traccia del fermo non si cancella. Vedi
[[valutatore-deterministico]] e [[ripresa-del-giro]].
