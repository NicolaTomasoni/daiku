---
name: sede-del-report-del-fermo
description: "La fase di report di `ship-feature` scrive su due sedi: `5. review-report.md` quando la review è girata, `5. delivery-report.md` quando la consegna si ferma prima — perché il nome di un artefatto è la prova di una fase e l'evaluatore legge i nomi"
metadata:
  node_type: memory
  type: project
  modified: 2026-10-09
---

**Dal 9 ottobre 2026 la fase di report di `ship-feature` scrive su due sedi, e quale dipende
dall'unica cosa che quella fase non può dedurre da sola: se la fase 3 è girata.** Con la review
girata appende in coda a `<folder>/5. review-report.md`; senza — il fermo di Acquisition, Brief o
Execute, § *Early block* — scrive `<folder>/5. delivery-report.md`, intero e dalla prima riga.
`5. review-report.md` è la prova che la review è girata, e non lo scrive nessun altro.

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
§ *Early block*, e il caso di banco `order:the-early-block-reports-on-its-own-seat` in
`architect/architect.mjs` ordina la ripresa da `review` su una cartella ferma. Dopo una ripresa che
arriva in fondo i due nomi convivono: la traccia del fermo non si cancella. Vedi
[[valutatore-deterministico]] e [[ripresa-del-giro]].
