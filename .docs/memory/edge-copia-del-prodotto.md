---
name: edge-copia-del-prodotto
description: "il ramo edge — la copia del prodotto che segue develop, col numero `<produzione>-edge.<N>+<tip>`: come si forma N, chi lo scrive con la plumbing (bump-edge.mjs), e perché develop non porta versione"
metadata:
  node_type: memory
  type: project
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

**Chi lo scrive: `.docs/tools/bump-edge.mjs`** (task VS Code «daiku: alza il ramo edge»). Usa la plumbing:
indice usa-e-getta, `read-tree` su `develop:plugins`, `hash-object`, `update-index`, `write-tree`,
`commit-tree`, `update-ref` con il vecchio tip come controllo. Non fa checkout, non committa, non fa fetch
né push. Rifiuta un albero con modifiche tracciate, un `develop` indietro rispetto a `origin/develop`, e un
`main` senza trailer `Development:`. Se `edge` dichiara già il numero che `develop` produce, non scrive
niente. Il banco è `node .docs/tools/bump-edge.mjs --self-check`: 27 casi, dodici dei quali con Git vero
su repository usa e getta; una mutazione del numero fa scattare cinque casi e il banco esce `1`.

**How to apply:** il push resta manuale e doppio: prima `develop`, poi `edge`. Il passo prepara, l'owner spinge. Vedi
[[push-solo-manuale]].

**Why:** `develop` non porta versione. Il tentativo di installare dal ref `develop` del 16 ottobre 2026
ha dato `manifest_missing` due volte: l'host cerca la vetrina alla radice del repository, e su `develop` lì
sta il cantiere. Su `edge` la vetrina sta in radice come su `main`: è la via da provare, e la prova del giro
completo da ref `edge` non è ancora stata fatta (serve che `edge` sia su `origin`). Il manifest senza
`version` su `develop` passa il validatore con un avviso: vedi [[installazione-e-versionamento]].

**Niente di `edge` torna su `develop`**, come niente di un rilascio torna indietro. Vedi
[[canali-e-promozione]] e [[pubblicazione-su-github]].
