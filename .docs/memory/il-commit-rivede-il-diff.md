---
name: il-commit-rivede-il-diff
description: "Il diff in index si rivede prima di essere congelato: il commit non porta in storia righe che nessuna review ha letto, e la review a mano si fa lì"
metadata:
  type: feedback
---

**Deciso dall'owner l'8 ottobre 2026.** Il diff **in index** si rivede prima di essere congelato: il
commit non porta in storia righe che nessuna review ha letto. Dove il ciclo che finisce in quel
commit ha appena rivisto lo stesso diff, quella **è** la review e non se ne fa una seconda; dove
invece il commit arriva a mano — su un diff scritto in chat che nessun ciclo ha guardato — la review
si fa lì, sul diff staged, prima del commit del codice.

**Why:** il commit a mano era l'unico punto in cui un diff poteva entrare in storia senza che
nessuno l'avesse letto. La guardia della review nega `git commit` fuori dal ciclo, ma solo dove il
progetto dichiara la sede dei ledger: fuori di lì il commit passava. È la legge di *Mai fidarsi di un
LLM* applicata al commit — dove il divieto non ha una sede deterministica, non esiste.

**How to apply:** le due sedi sono le eccezioni di commit del file di istruzioni che `init` deposita
(`plugins/daiku/templates/project/instructions.md`) e la § *Review of the diff being committed* di
`plugins/daiku/skills/commit/SKILL.md`; il controllo è la guardia della review in
`plugins/daiku/hooks/lib/command-guard.mjs`, che nega `git commit` fuori dal ciclo ed è questa
stessa regola letta dove un comando si può ancora fermare.

Vedi [[allineamento-a-ogni-modifica]] per il passo che allinea il corpus, e
[[guardrail-nascono-spenti]] per la regola delle due sedi.
