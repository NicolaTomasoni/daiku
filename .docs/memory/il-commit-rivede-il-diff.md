---
name: il-commit-rivede-il-diff
description: "Il commit lanciato dall'owner con /daiku:commit non rilegge il diff: prima allinea memoria e documenti con la delega obbligatoria a update-memory, poi committa senza review, perché chi lo lancia l'ha già letto; la guardia lo lascia passare col segno commit-alone.json. Supera la regola dell'8 ottobre 2026"
metadata:
  node_type: memory
  type: feedback
  originSessionId: a2642d71-61f9-4f11-aa8b-a94f64886de8
  modified: 2026-10-16T18:00:33.236Z
---

**Deciso dall'owner il 16 ottobre 2026, e superata la regola dell'8 ottobre.** Il commit lanciato a mano
con `/daiku:commit` non rilegge il diff: committa tutto il perimetro senza domande e senza analisi, perché
chi lo lancia — in questa sessione o in un'altra — ha già letto il diff. Nessuna review prima. Allinea
però sempre memoria e documenti prima di congelare: dal 16 ottobre 2026 la delega a `update-memory` è
obbligatoria in ogni invocazione della skill.

**Why:** l'8 ottobre la regola chiedeva una review prima di ogni commit a mano; l'owner ha detto che il commit
lanciato da lui è già una lettura, e che fermarlo per una review è un passo in più che non vuole. La review
resta il percorso del commit dell'agente: un commit che l'agente fa da solo, fuori da un ciclo, è quello che la
guardia nega.

**How to apply:** la skill `plugins/daiku/skills/commit/SKILL.md` scrive `commit-alone.json` nella sede dei
ledger prima del commit e lo toglie dopo, anche se il commit è rifiutato; la guardia della review
(`command-guard.mjs`, `reviewGuard`) lascia passare un commit con un segno fresco, un quarto d'ora. Il segno è
una dichiarazione della skill, non una prova: la guardia non distingue chi lo ha scritto. Il file di istruzioni
che `init` deposita dice la stessa cosa (`plugins/daiku/templates/project/instructions.md`, l'eccezione
`commit`).

Vedi [[guardrail-nascono-spenti]] per la regola delle sedi, e [[allineamento-a-ogni-modifica]] per il passo che
allinea il corpus.
