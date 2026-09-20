---
name: guardrail-nascono-spenti
description: "i tre hook del pacchetto non negano nulla che il progetto non abbia dichiarato, e nessuno di loro esegue un file perché è appena comparso"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7f30fa0d-9a97-482d-ba1b-c32231e0c9e1
  modified: 2026-09-19T18:51:47.622Z
---

**Deciso il 19 settembre 2026, preparando gli hook per la distribuzione.** Un pacchetto si
installa una volta ed è attivo su **ogni** repository che l'host apre. Da lì discendono due regole
che valgono per qualunque hook Daiku porti, oggi e in futuro.

**Primo: niente si accende da solo.** Senza `.daiku/project.json` la guardia sui comandi non nega
niente e non legge nemmeno la riga; con quel file, ogni ramo resta spento finché una chiave non lo
accende — `guardrails.deny_push`, `guardrails.deny_no_verify`, e `worktree.pool` per le rimozioni
dentro i worktree di consegna. L'unica eccezione è la rimozione ricorsiva che attraversa una
junction di Windows: quello non è una policy ma un fatto del sistema operativo, vero in ogni
progetto e invisibile leggendo la riga di comando.

**Secondo: un hook non esegue un file perché è comparso.** Il controllo post-scrittura *ricorda* di
lanciare il banco di prova di una guardia riscritta, e non lo lancia.

**Why:** fino a quel giorno `command-guard.mjs` era la guardia di ReforgIA trapiantata nel
pacchetto — negava `git push` a chiunque, su qualunque repository, rimandando a sezioni di un
`CLAUDE.md` che nel progetto ospite non esistono. Un diniego che compare senza essere stato chiesto
è il motivo per cui un pacchetto si disinstalla, e la sua utilità non compensa mai quel primo
istante. Sull'esecuzione: il post-edit lanciava `node <file> --self-check` sul `.mjs` appena
scritto, cioè faceva partire codice che nessuno aveva ancora guardato, scavalcando sia la conferma
che l'host chiede prima di un comando sia l'approvazione per hash che Codex pretende proprio per
gli hook. Un hook che dice «lancia il banco» e uno che lo lancia da solo hanno lo stesso valore
diagnostico e un rischio molto diverso.

**How to apply:** un ramo nuovo nasce **spento**, con la sua chiave nel JSON (dichiarata nella §4.1
di `contracts/project-contract.md`, che non fa salire `contract` perché è una chiave opzionale), la
sua riga nella tabella di `plugins/daiku/hooks/README.md`, e nel banco un caso che prova che da
spento **non** nega — è quel caso, non l'altro, a dire che il gate tiene. I tre banchi si lanciano
insieme con `node plugins/daiku/hooks/self-check.mjs`, che somma i controlli e esce `1` al primo
rosso: va aggiunto a ogni verifica di rilascio accanto ai due validatori.

Vedi [[tre-livelli-di-parametro]] per dove va un valore, e [[alberatura-pacchetto]] per la sede.
