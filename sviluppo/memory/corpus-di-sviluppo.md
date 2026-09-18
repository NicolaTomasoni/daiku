---
name: corpus-di-sviluppo
description: "In .claude/ vive una derivazione dei contratti del prodotto, adattata a questo repo e mai sincronizzata automaticamente"
metadata: 
  node_type: memory
  type: project
  originSessionId: 48eaa498-ed6e-4a36-847d-3f8fa95f7f21
  modified: 2026-09-18T14:35:00.044Z
---

Dal 18 settembre 2026 `.claude/` porta un **corpus di sviluppo**: `orchestration.md`, dieci
contratti in `skills/` (`studia-libreria`, `studia-problema`, `decision-doc`, `blueprint`,
`execute`, `review`, `code-review`, `commit`, `update-memory`, `deliver-feature`) e
`agents/finder.md`. Serve a sviluppare Daiku con il metodo di Daiku.

**Why:** è una derivazione dei contratti di `plugins/daiku/skills/`, non una copia, perché tre
scelte dell'owner le fanno divergere e non sono reversibili per copia:

- **Niente parametrizzazione.** Il prodotto tiene i valori fuori dalle skill (`project.json`,
  `environment.json`) perché deve girare su progetti diversi. Qui il progetto è uno: path, comandi e
  modelli sono scritti per esteso dentro il contratto che li usa. Una graffa `{…}` in questo corpus
  è un refuso.
- **Niente worktree.** Il `.gitignore` traccia solo `plugins/`, quindi un worktree nascerebbe senza
  `CLAUDE.md`, senza `sviluppo/` e senza i contratti che ogni subagent deve leggere. Si lavora sul
  branch corrente dell'albero principale.
- **Niente commit per memoria e documentazione.** Stesso motivo: il perimetro di `update-memory` è
  fuori dall'indice per costruzione, quindi il suo `committed` è sempre `null` e `commit` partiziona
  in due gruppi invece che in tre. Ciò che quella fase scrive vive **solo su questa macchina**, e
  non c'è una storia da cui recuperarlo.

Cinque contratti del prodotto non sono stati derivati — `perf`, `test-coverage`, `arch-check`,
`finder-prompt`, `applicatore` — e gli ultimi due sono stati **assorbiti** dentro `review`, che
quindi qui scrive in casa propria il prompt del finder e il mestiere dell'applicatore.

**How to apply:** una modifica che vale per entrambi si riporta **a mano** nel contratto
corrispondente sotto `plugins/daiku/`, che resta l'unico albero distribuito. Nessuno dei due alberi
aggiorna l'altro, e nessuna skill di questo corpus scrive dentro `plugins/daiku/skills/` per
allinearlo a sé stessa. Vedi [[alberatura-pacchetto]] e [[si-pubblica-solo-il-prodotto]].
