---
name: fatti-verificati-in-memoria
description: "I fatti verificati sull'host vivono nelle memorie, non in un documento di ricognizione: perché quel documento non si ricrea"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 33614099-e150-45f7-99eb-7fe0113b9450
  modified: 2026-10-12T12:13:15.944Z
---

**Un fatto verificato va in una memoria di `.docs/memory/`, con il comando eseguito e la data. Non
esiste un documento di ricognizione che li raccolga.** Deciso dall'owner il 29 settembre 2026: i
fatti sull'host da quel giorno stanno nelle memorie — [[cosa-claude-code-accetta]],
[[installazione-e-versionamento]] e [[come-si-provano-i-fatti-su-claude-code]] — e le sedi che li
nominano sono `CLAUDE.md` e `plugins/daiku/skills/update-memory/SKILL.md`.

**Why:** un documento unico che tiene insieme il verbale di ciò che si sapeva e i fatti del presente
invecchia in metà, e chi lo cita lo cita per i fatti: si porta dietro le righe dell'altra metà — una
violazione che il corpus non ha più, un programma promesso e mai costruito, un conteggio vecchio di
una consegna. Una memoria ha un confine piccolo per costruzione: un file, un fatto, un indice che la
nomina, e una riga sbagliata si corregge dove sta.

**How to apply:** quando una prova conferma o **smentisce** un fatto su un host, si aggiorna la
memoria che lo dichiara — o se ne crea una, se nessuna lo copre — e si aggiorna `MEMORY.md` nella
stessa modifica. Vale la stessa disciplina di sempre: l'esito verbatim e la data, perché sono ciò
che rende la riga ripetibile e smentibile. Un documento nuovo che raccolga i fatti «in ordine»
sarebbe di nuovo due mestieri in un file: se serve una mappa, la fa [[alberatura-pacchetto]].
