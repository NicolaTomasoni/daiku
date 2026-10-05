---
name: pubblicazione-su-github
description: "Il repository è uno solo — `NicolaTomasoni/daiku` su GitHub, con `develop` cantiere e `main` linea di rilasci: i rilasci li fa `daiku:release`, una bozza si accumula finché non è pushata, e il push resta dell'owner"
metadata:
  node_type: memory
  type: project
  originSessionId: 69438169-0316-47c8-a4e8-3365650ee2cf
  modified: 2026-10-05T00:00:00.000Z
---

**Dal 5 ottobre 2026 il repository è uno solo.** `NicolaTomasoni/daiku` su GitHub, privato finché
Daiku non è pronto per il pubblico, con **due rami**: `develop` è il cantiere, `main` è la
produzione. Non ci sono più due repository — `tomasoni.nicola/daiku-dev` su GitLab è **congelato**
dal giorno della migrazione, non riceve più push, e la sua storia è stata importata in `develop`.

La copia di lavoro è `C:\dev\daiku`, che tiene entrambi i rami, ed è la sola: il vecchio checkout di
servizio — che esisteva perché il macchinario di pubblicazione ci copiava i file dentro — è stato
**ritirato**, e quel macchinario con lui. Il rilascio non ne ha bisogno: non si mette mai su
production.

`develop` **non porta numeri di versione**: i due manifest restano al segnaposto `0.0.0` — Codex
esige strict semver, quindi la chiave non può mancare — e `plugins/CHANGELOG.md` non esiste lì.
`main` porta versione e changelog, ed è **una linea di rilasci**: non è antenata di `develop`, e
niente di un rilascio torna indietro.

**I rilasci li fa Daiku stesso**, con la skill `release` del pacchetto e il programma
`plugins/daiku/architect/release.mjs`. Il comando `/rilascia-daiku` e i due script PowerShell non
esistono più: erano il macchinario scritto perché Daiku non sapeva fare il rilascio da sé. Il
programma legge `develop`, ri-radica il contenuto di `plugins/` alla radice dell'albero di
production, ci scrive versione e changelog, e **muove il ref senza mettersi mai su `main`** — indice
usa-e-getta, `write-tree`, `commit-tree`, `update-ref`. La guardia del ramo resta intera: `git
commit` su production non gira mai.

**Una bozza si accumula.** Finché il commit in testa a `main` non è pushato è una **bozza**: il
rilascio successivo lo **sostituisce** invece di aprire una versione nuova, e i commit arrivati nel
frattempo si aggiungono a lui. La cosa si giudica dall'upstream: senza upstream un ramo non risponde
alla domanda «è pushato?» e nessun rilascio si accumula, quindi `release` lo dichiara nel `status`.
L'ancora del blocco è il trailer `Development:` che il programma scrive in ogni rilascio: la prima
1.1.3 ne è priva — l'ha scritta il macchinario vecchio — quindi il primo rilascio col macchinario
nuovo copre tutta la storia finché non ne nasce uno con il trailer.

**Il push non è della macchina.** `release` scrive il ref locale e si ferma; il push è il gesto
manuale dell'owner — vedi [[push-solo-manuale]]. Un rilascio si chiude col push, non col nodo.

**Why:** la forma breve `owner/repo` è quella che entrambi gli host accettano per un marketplace —
`/plugin marketplace add owner/repo` su Claude Code, `codex plugin marketplace add owner/repo` su
Codex — e vale solo per GitHub. Tenere due repository costringeva a copiare il prodotto da uno
all'altro a ogni rilascio, e la copia non è mai stata il problema: il problema era che Daiku non
sapeva fare il rilascio da sé. Ora lo sa, e il cantiere è la sua prima prova.

**How to apply:** il rilascio si lancia come `daiku:release`. Prima del push, `release` può girare
in `action: "dry"`: fa tutto tranne muovere il ref, e riporta il commit che scriverebbe. Il gate
largo resta **prima** dell'apertura al pubblico, perché da quel momento ciò che sta sotto `plugins/`
esce com'è scritto: `grep -rin "reforgia\|<username>\|c:/dev/" plugins/daiku/` e ogni occorrenza va
guardata.

Nota pratica: installare Daiku da un repository privato richiede credenziali git sulla macchina di
chi installa. Per provare il pacchetto in locale conviene un marketplace da path, che non passa da
git.
