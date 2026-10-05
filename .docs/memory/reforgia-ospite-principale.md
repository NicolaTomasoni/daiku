---
name: reforgia-ospite-principale
description: "Reforgia è il principale utilizzatore di Daiku e vive in C:/dev/reforgia: è il progetto ospite dove una modifica al pacchetto si misura per prima"
metadata:
  node_type: memory
  type: project
  originSessionId: 1636b5ef-acf4-4dce-b1c4-2bba37fec933
  modified: 2026-10-05T18:20:00.000Z
---

**Reforgia vive in `C:/dev/reforgia`**, ed è il **principale utilizzatore di Daiku**: il progetto
ospite più grande e più completo, quello su cui il metodo gira davvero. Non è una sede di questo
repository e non ne fa parte: sta fuori, come Kaji, e Daiku non lo tocca — vedi
[[kaji-fuori-dal-monorepo]].

**Why:** è il progetto da cui Daiku è stato estratto, quindi è anche quello in cui le conseguenze di
una modifica al pacchetto si vedono per prime. Un cambio di forma del prodotto che qui sembra
innocuo atterra là come un guasto, e leggerlo là è il modo più corto di sapere se il cambio regge.

**How to apply:**
- Dopo una modifica al pacchetto, Reforgia è il primo posto da guardare, non l'ultimo: le sue
  `.daiku/` portano i marker `daiku:script`, i suoi script sono quelli che `init` ha depositato, e
  il suo `daiku: update` è quello che parla per primo.
- Un allarme là non si ripara da qui: `C:/dev/reforgia` è fuori da questo repository, e il passo —
  rilanciare `/daiku:init` là, o cambiare il pacchetto — è dell'owner.
- La sua radice tecnica è `C:/dev/reforgia`, e il gate è quello che il suo
  `.daiku/project.json` dichiara, diverso da questo.

Vedi [[alberatura-pacchetto]] per le sedi di questo repository e [[pubblicazione-su-github]] per
come il pacchetto arriva ai progetti ospiti.
