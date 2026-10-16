---
name: edge-copia-del-prodotto
description: "il ramo edge — la copia del prodotto che segue develop, col numero `<produzione>-edge.<N>+<tip>`: come si forma N, e perché develop non porta versione"
metadata:
  node_type: memory
  type: project
  originSessionId: a2642d71-61f9-4f11-aa8b-a94f64886de8
  modified: 2026-10-16T15:50:38.921Z
---

**Il ramo `edge` è la copia del prodotto che segue `develop`.** Porta ciò che sta sotto `plugins/`,
ri-radicato come `main` (vetrina, `daiku/`, README), senza changelog. Lo decide l'owner il 16 ottobre
2026: `develop` non porta più nessun numero di versione, `main` tiene quelli che ha sempre tenuto, ed
`edge` porta il numero che l'host confronta per seguire `develop` da fuori.

**Il numero è `<produzione>-edge.<N>+<tip>`**, es. `1.2.3-edge.3+a1b2c3d`:
- `<produzione>`: il numero nudo che `main` porta adesso, letto dal suo manifest.
- `<N>`: `git rev-list --count <ancora>..develop`, dove `<ancora>` è il trailer `Development:` del tip di
  `main`. Ogni rilascio lo scrive, quindi `N` si conta dall'ultimo rilascio.
- `<tip>`: `git rev-parse --short develop`.

Il numero cambia a ogni tip, e l'host muove la copia ogni volta che il campo `version` differisce, senza
chiedere un incremento ordinato: per questo la forma porta il tip.

**How to apply:** nessun meccanismo alza `edge`: la derivazione del numero sopra è la formula che il
numero deve avere, non un processo che gira da solo. Vedi [[push-solo-manuale]].

**Why:** `develop` non porta versione. Il tentativo di installare dal ref `develop` del 16 ottobre 2026
ha dato `manifest_missing` due volte: l'host cerca la vetrina alla radice del repository, e su `develop` lì
sta il cantiere. Su `edge` la vetrina sta in radice come su `main`, e il giro completo da ref `edge` è provato il
16 ottobre 2026: `marketplace add "https://github.com/NicolaTomasoni/daiku.git#edge"` clona e valida, `plugin install
daiku@daiku` installa `1.2.3-edge.5+859fe3a`, identico a `edge:daiku` su 69 file (hash dei blob); il validatore
dell'host passa sul pacchetto e sulla vetrina del clone, e `hooks/self-check.mjs` sul pacchetto installato dà 20 banchi,
1938 controlli verdi. Il manifest senza `version` su `develop` passa il validatore con un avviso: vedi
[[installazione-e-versionamento]].

**Niente di `edge` torna su `develop`**, come niente di un rilascio torna indietro. Vedi
[[canali-e-promozione]] e [[pubblicazione-su-github]].
