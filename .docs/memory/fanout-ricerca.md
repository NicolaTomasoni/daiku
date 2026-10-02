---
name: fanout-ricerca
description: "`.docs/tools/ricerca.mjs` lancia N `/daiku:research` in parallelo, uno per tecnologia, e popola `.daiku/studies/`: perché è un processo, cosa calcola prima di partire, e cosa controlla alla fine"
metadata:
  node_type: memory
  type: project
  modified: 2026-10-02
---

`.docs/tools/ricerca.mjs` è il fan-out di `daiku:research`: un elenco di **nomi di tecnologia**
(`TanStack Query`, `pydantic v2`, `DBOS`), una sessione headless per ciascuno, fino a `--parallelo`
insieme, e un file di appunti per tecnologia in `.daiku/studies/<slug>.md`. Non ha verbi: si lancia,
aspetta, e dice cosa è atterrato. È il passo 4 di `new-feature` in blocco, invece che una tecnologia
per volta.

**È un processo e non un subagent**, per la stessa ragione del lotto: il presidio di macchina nega le
righe di comando che contengono un token che comincia per `/`, quindi `/daiku:research …` non si può
scrivere da un tool Bash — e una corsa di `research` è già un orchestratore che apre i suoi subagent
per blocco tematico, quindi tenerla dentro un'altra sessione la farebbe crescere di una corsa intera
per tecnologia.

**Lo slug si calcola prima di lanciare** — minuscolo, ogni sequenza che non sia lettera o cifra
diventa un trattino — perché è l'unico modo per sapere dove guardare alla fine e per fermare due
target che collassano sullo stesso file: due corse scriverebbero lo stesso appunto, e una delle due
sparirebbe in silenzio. Un nome che contiene un carattere che la riga di comando di Windows non porta
ferma il fan-out prima di partire.

**Alla fine ogni appunto si controlla**: esiste, non è vuoto, ed è stato scritto **dopo l'avvio** —
`research` aggiorna un file che trova invece di ricrearlo, e senza la data un appunto vecchio
passerebbe per il lavoro di questa corsa. I file toccati che nessun target rivendica si stampano come
**orfani**: una corsa ha scritto con un altro nome, e si legge invece di perderla. Il costo lo dà il
codice di uscita della corsa, e le due cose restano separate: una sessione uccisa dal budget lascia
l'appunto a metà, e l'esito lo dice.

Non è il lotto e non lo sostituisce: il lotto confronta repository con Daiku e ne trae contributi e
sintesi, questo popola la sede degli appunti. Vedi [[lotto-di-studi]] e [[catalogo-di-feature]] per
l'altra metà.
