---
name: fatti-verificati-in-memoria
description: "I fatti verificati sugli host vivono nelle memorie, non in un documento di ricognizione: perché quel documento non si ricrea"
metadata:
  type: feedback
---

**Un fatto verificato va in una memoria di `.docs/memory/`, con il comando eseguito e la data. Non
esiste un documento di ricognizione che li raccolga.** Deciso dall'owner il 29 settembre 2026: i
fatti sui due host da quel giorno stanno nelle memorie — [[cosa-i-due-host-accettano]],
[[cosa-codex-fa-allinstallazione]], [[installazione-e-versionamento]] e
[[come-si-provano-i-fatti-sugli-host]] — e le sedi che li nominano sono `CLAUDE.md` e
`.claude/commands/update-memory.md`.

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
