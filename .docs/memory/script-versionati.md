---
name: script-versionati
description: "gli script che init deposita portano la versione del pacchetto che li ha scritti, e init li ricrea interi quando è vecchia: la terza lettura di uno stesso file"
metadata:
  node_type: memory
  type: project
  originSessionId: 99901030-abdd-4caa-92ce-5d7a0a1dfbc2
  modified: 2026-10-03T14:35:08.419Z
---

Dal 1 ottobre 2026 ogni script che `init` deposita — oggi solo `.daiku/update.mjs` — porta in testa
la riga `// daiku:script <version>`, **la versione del pacchetto che l'ha scritto**, riempita da
`init` copiando lo scheletro. La scansione legge quella riga e la confronta con il `version` di
`<package root>/.claude-plugin/plugin.json`: se non combaciano — o se la riga non c'è, che è come
si legge uno script depositato da un `init` più vecchio — lo script è vecchio, e `init` lo ricrea
**intero** dallo scheletro.

**Why:** senza il marcatore un aggiornamento si fermava al pacchetto e lasciava il progetto con lo
script della Daiku che non c'è più — ReforgIA ne aveva uno copiato a mano, e nessuna skill se ne
sarebbe accorta. Il marcatore è l'unica cosa che distingue le due letture dello stesso file: uno
script che questo pacchetto ha scritto, che resta, e uno che non ha scritto, che se ne va.

**How to apply:**

- **Lo script non è del progetto.** È l'unica cosa sotto `.daiku/` che `init` riscrive: dove lo
  trova con un'altra versione lo rifà intero e basta, senza chiuderlo nello stash come fa col file
  di istruzioni ([[init-scrive-le-istruzioni]]), perché una voce di stash per ogni aggiornamento
  sarebbe solo rifiuto. La regola sta in *Step 5-bis* e in §8 di `contracts/project-contract.md`.
- **La versione non si scrive in due posti.** Lo scheletro la porta come segnaposto `<version>`, e
  il rilascio continua a bumpare i soli tre punti — i due manifest e il badge: una copia letterale
  nello scheletro sarebbe una quarta sede che diverge, e `hooks/template-check.mjs` la rifiuta.
- **Un segnaposto non riempito si vede.** Resterebbe `<version>` nella riga, che non è la versione
  del pacchetto: la scansione lo segnala come script vecchio, e *Step 6-bis* lo ripesca prima di
  chiudere. La voce vive in `skills/init/scan.mjs`, con i suoi due casi rossi nel banco — uno per
  il marcatore vecchio, uno per il file che non ne ha nessuno — e il caso di fail-open per il
  pacchetto che non sa dire che versione è.
- **Il rilancio è la via dell'aggiornamento.** Il refresh dello script arriva al primo `/init`
  dopo l'aggiornamento del pacchetto: nessun hook lo ricorda, ed è dichiarato nella `description`
  della skill.
