---
name: prelievo-da-terzi
description: "Da un progetto di terzi sotto licenza non open source si prendono l'idea e il meccanismo, mai una riga di codice: si riscrive da zero"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 33614099-e150-45f7-99eb-7fe0113b9450
  modified: 2026-10-12T12:08:41.216Z
---

**Da un progetto di terzi non si copia codice.** Si prendono l'**idea** e il **meccanismo**, e li si
**riscrive da zero** nel pacchetto. Vale per ogni repository sotto una licenza che non sia open
source; il caso che l'ha deciso è **PolyForm Noncommercial**.

**Why:** il diritto d'autore protegge **come una cosa è scritta**, non l'idea che essa porta: leggere
un meccanismo e reimplementarlo è lecito, copiarne le righe no. E copiare vorrebbe dire portare
quella licenza dentro Daiku, che va verso il pubblico con una licenza propria — una riga di codice
di terzi non si cancella più. **Deciso dall'owner il 12 ottobre 2026.**

**How to apply:** quando un progetto di terzi fa una cosa che Daiku dovrebbe fare, se ne legge il
meccanismo, si descrive l'intervento a parole, e lo si ricostruisce con il codice di Daiku. Vale per
il confronto a mano di `.docs/confronti/` e per il comando `studia-repository`, che legge i
repository di terzi senza portarli sul disco. Vedi [[fanout-ricerca]] e [[alberatura-pacchetto]].
