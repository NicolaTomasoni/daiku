---
name: corpus-di-sviluppo
description: "In .claude/ vive una derivazione dei contratti del prodotto, adattata a questo repo e mai sincronizzata automaticamente"
metadata: 
  node_type: memory
  type: project
  originSessionId: 48eaa498-ed6e-4a36-847d-3f8fa95f7f21
  modified: 2026-09-20T17:22:41.439Z
---

Dal 18 settembre 2026 `.claude/` porta un **corpus di sviluppo**: `orchestration.md`, dieci
contratti in `skills/` (`studia-libreria`, `studia-problema`, `decision-doc`, `blueprint`,
`execute`, `review`, `code-review`, `commit`, `update-memory`, `deliver-feature`) e
`agents/finder.md`. Serve a sviluppare Daiku con il metodo di Daiku.

**Dal 20 settembre 2026 i nomi non si corrispondono più**, e la derivazione non si trova più per
omonimia: nel prodotto quei contratti si chiamano `research` (raccolta, con il riordino delegato
a `study`), `new-feature` e `develop-feature`, dove
il cantiere ha ancora `studia-libreria`, `studia-problema` e `deliver-feature`. I rename sono stati
scritti solo nel prodotto, che è l'unico albero pubblicato; riportarli qui è una decisione a parte,
che non è stata presa.

**Why:** è una derivazione dei contratti di `plugins/daiku/skills/`, non una copia, perché tre
scelte dell'owner le fanno divergere e non sono reversibili per copia:

- **Niente parametrizzazione.** Il prodotto tiene i valori fuori dalle skill (`project.json`,
  `environment.json`) perché deve girare su progetti diversi. Qui il progetto è uno: path, comandi e
  modelli sono scritti per esteso dentro il contratto che li usa. Una graffa `{…}` in questo corpus
  è un refuso.
- **Niente worktree.** Si lavora sul branch corrente dell'albero principale. La ragione
  originaria non vale più — nasceva dal `.gitignore` che tracciava solo `plugins/`, per cui un
  worktree si sarebbe aperto senza `CLAUDE.md`, senza `sviluppo/` e senza i contratti che ogni
  subagent deve leggere; da quando il repo versiona tutto, un worktree se li porterebbe dietro. La
  scelta resta in piedi ma **la sua giustificazione è da rifare**.
- **Il commit di memoria e documentazione qui c'è**, dal 18 settembre 2026, e prima non c'era: il
  perimetro di `update-memory` era fuori dall'indice per costruzione, quindi il suo `committed` era
  sempre `null` e `commit` partizionava in due gruppi invece che in tre. Ora `CLAUDE.md`,
  `sviluppo/` e la memoria sono versionati come il prodotto.

Il prodotto ha **diciotto** contratti, questo corpus ne ha **dieci**. Gli otto non derivati sono
`applier`, `arch-check`, `finder-prompt`, `init`, `perf`,
`research`, `sync-host`, `test-coverage`. Di questi, `finder-prompt` e `applier` sono stati **assorbiti**
dentro `review`, che quindi qui scrive in casa propria il prompt del finder e il mestiere
dell'applicatore; gli altri sei semplicemente non servono a sviluppare Daiku.

**Il decimo del cantiere non ha più un gemello nel prodotto.** `memory-review` è stata
**eliminata dal pacchetto il 19 settembre 2026**, con la ragione che segue: se il corpus avesse
bisogno di una revisione periodica, vorrebbe dire che il modo in cui cresce non funziona, e il
rimedio andrebbe messo lì. Al suo posto, `update-memory` gira a **ogni** invocazione di `/commit`,
senza eccezioni. Nel cantiere la skill resta finché qualcuno non decide di toglierla anche di qui:
è una decisione a parte, non un allineamento.

**Due nomi non coincidono più**, dopo che il prodotto li ha rinominati: il `research` del pacchetto (con `study` come foglia di riordino) è lo `studia-libreria` di qui, e il suo `new-feature` è lo `studia-problema` di qui. Cercare il
contratto corrispondente per nome non funziona su questi due.

**E dal 19 settembre 2026 diverge anche il nome di un ruolo.** Nel prodotto il ruolo che decide si
chiama `judge`, qui ancora `giudice` — 11 occorrenze in 6 file, `orchestration.md` compreso. Nel
prodotto è anche una chiave di `environment.json` (`hosts.<host>.models.judge`), e per questo la
forma di quel file è salita a `2`; qui non c'è niente da migrare, perché i modelli sono scritti per
esteso. Il nome resta disallineato finché non lo autorizzi, come tutto il resto del cantiere.

**How to apply:** dal 19 settembre 2026 `CLAUDE.md` dice che **le skill si modificano solo in
`plugins/daiku/skills/`**: quelle di qui si leggono e si eseguono, non si toccano, e vale allo
stesso modo per `.claude/orchestration.md` e `.claude/agents/`. **Deciso il 20 settembre 2026, precisato lo stesso giorno: «intoccabile» significa che il
cantiere non si aggiorna insieme a Daiku.** Quando il prodotto cambia, la
derivazione non si allinea da sé e non si propone di allinearla: il disallineamento non è una
dimenticanza da correggere, è lo stato normale. Un ordine esplicito dell'owner può toccarlo:
l'intoccabilità è contro l'allineamento automatico, non contro gli ordini. Il cantiere non è Daiku — è il tavolo su cui Daiku
si costruisce, e un tavolo non deve assomigliare al mobile. Anche una modifica che varrebbe per
entrambi i corpus si scrive solo nel prodotto e lì si ferma. Nessuno dei due alberi aggiorna l'altro, e nessuna skill di
questo corpus scrive dentro `plugins/daiku/skills/` per allinearlo a sé stessa.

**Il corpus è rimasto indietro su un punto.** Dieci contratti di qui — e `orchestration.md` fino
alla correzione del 19 settembre 2026 — sono scritti sulla premessa che tutto ciò che sta fuori da
`plugins/` sia escluso da git, quindi parlano di perimetri «fuori dall'indice per costruzione», di
un `committed` sempre `null` e di un `.gitignore` a lista di ammissione che non esiste più. È una
premessa falsa da quando il repo versiona tutto, e allinearli è un lavoro da autorizzare.

Vedi [[alberatura-pacchetto]] e [[si-pubblica-solo-il-prodotto]].
