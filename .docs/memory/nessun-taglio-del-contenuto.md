---
name: nessun-taglio-del-contenuto
description: "Un passo non taglia né riassume il contenuto che consegna a un figlio per risparmiare token: il path resta la via, e la misura `payload` misura senza tagliare"
metadata:
  node_type: memory
  type: feedback
  originSessionId: a7373564-457c-438a-8cb2-d46d04a9fd26
  modified: 2026-10-17T13:32:40.470Z
---

Un passo che deve consegnare contenuto a un figlio non lo taglia a un tetto e non lo riassume: non
esistono né una vista ridotta né un troncamento. Vale per ogni proposta di risparmio di token che
passi da un taglio del contenuto, anche se deterministico.

**Why:** l'owner non vuole la logica di taglio («non mi piace», 17 ottobre 2026). Nella prova della
stessa sessione una vista che teneva solo la testa di un log da 92 KB perdeva l'errore in coda: la
riga decisiva spariva e il marker diceva soltanto quanti byte mancavano.

**How to apply:** per ridurre i token di un passo si usa il path, non la trascrizione
(`contracts/orchestration.md` §4). La misura di quanto attraversa resta il campo `payload`
(`{bytes, lines}`), che misura e non taglia. Se un'idea di risparmio richiede di troncare o
riassumere un contenuto, non la si propone come soluzione: si ricorda che il path è già la via. Vedi
[[costo-di-un-giro]].
