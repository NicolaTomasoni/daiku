---
name: collauda-init-trappole
description: "i due modi in cui la prova di collauda-init mente — l'harness del subagent che rifiuta i nomi che cominciano per report, e il cantiere leggibile dal subagent cieco"
metadata:
  type: project
---

Il ciclo di `collauda-init` misura due cose fragili, e sbagliarle costa un verdetto, non un fastidio.

**L'harness di un subagent rifiuta ogni file il cui basename comincia per `report`** — «Subagents
should return findings as text, not write report files» — e rifiuta quello e non il percorso né il
contenuto: `report.md` e `report-init.md` non si scrivono, `note.md` sì. Il terzo artefatto della
prova si chiama perciò **`verbale.md`**, e il nome è la correzione: un artefatto che non si può
scrivere è un asse che dà un **rosso falso** — A10 misurerebbe l'harness, non `init` — e un rosso
falso è peggio di un asse mancante, perché manda a correggere il prodotto per un guasto che non è
suo.

**Il controllo che lo impedisce sta nel banco, non nella prosa.** `collauda-init.mjs cattura` non
parte se `uscita/` non porta tutti e tre gli artefatti (`verbale.md`, `assenze.json`, `note.md`):
esce `1` e dice quale manca, invece di giudicare un giro incompleto. Chi conduce la prova che si
trova un artefatto solo nel messaggio di ritorno del subagent lo trascrive **prima** di `cattura`,
verbatim — è il passo 3 di `.claude/commands/collauda-init.md`.

**Il subagent "cieco" gira dentro il cantiere, e lo può leggere tutto.** `CLAUDE.md` di radice,
`.docs/` — memoria compresa — e `.claude/` gli stanno accanto, e il 29 settembre 2026 un giro ha
citato `.docs/memory/init-scrive-le-istruzioni.md` per decidere proprio la questione che la prova
doveva misurare: la prova ha misurato le mie note invece della skill. Da lì il **muro del cantiere**
in §4 — del repository di sviluppo il subagent legge solo `plugins/daiku/`.

**How to apply:** quando un giro esce verde o rosso, chiedersi prima se ha misurato `init`. Il
verde col report trascritto da altri, il rosso su A10 e una cattura che non parte sono i tre
sintomi; il quarto è una decisione che la skill non copre ma che l'agente argomenta bene — quasi
sempre viene da una memoria del cantiere. Vedi [[init-scrive-le-istruzioni]] e
[[valutatore-deterministico]].
