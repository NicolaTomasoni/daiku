---
name: punti-ingresso-prodotto
description: "I dieci entry point di Daiku in due gruppi, e tutto il resto che è contratto interno"
metadata:
  node_type: memory
  type: project
  originSessionId: 38efe876-5b85-4605-8e0f-a47275150768
  modified: 2026-10-08T17:16:44.000Z
---

Daiku ha **dieci entry point** — le sole skill che si lanciano a mano. Stanno in `contracts/orchestration.md` §3, e il README del prodotto li racconta dal più semplice al più grande. Tutto il resto sotto `skills/` è **contratto interno**: lo riceve un subagent come path da leggere, non si invoca.

**Il metodo — il lavoro di ogni giorno (7):**

- `new-feature` — da un'idea al commit, orchestrando tutto il resto; con `--stop-at-brief` si ferma al brief
- `research` — studia una tecnologia dalle fonti vere, deposita gli appunti e si ferma
- `review` — controlla un diff a giri, con finder indipendenti e applicatore
- `code-review` — il ciclo solo-bug sullo scope detto a mano: giri, fix e gate come `review`, ma si ferma al report senza committare
- `commit` — allinea memoria e documenti con `update-memory`, poi chiude in commit separati
- `handoff` — a metà di un lavoro lo lasci a un altro agente: scrive il documento che porta il problema, cosa è stato fatto e cosa manca, con le prove inline, e si ferma — non apre nessuna catena e non consegna niente
- `release` — il progetto che ha dichiarato i canali: chiede la versione una volta sul blocco di commit accumulati sul ramo di sviluppo e sposta la produzione sulla sua punta con un fast-forward locale, senza mai pushare

**L'installazione — una volta per progetto (3):**

- `init` — apre `.daiku/` su un progetto che non ce l'ha; finché non gira, niente altro ha i valori per lavorare
- `sync-host` — solo su Codex: `init` lo lancia come ultimo passo, e si rilancia dopo ogni aggiornamento; riallinea guardrail e ruoli in `.codex/`
- `new-project` — dopo `init`, scrive i cinque documenti fondativi del progetto (prodotto, identità, dominio, stack, architettura) dagli scheletri del pacchetto ai path dichiarati in `documents.*`; rilanciabile per riallinearli, senza sovrascrivere il lavoro a mano

Interni, mai a mano: `decision-doc`, `blueprint`, `ship-feature`, `execute`, `finder-prompt`, `applier`, `arch-check`, `perf`, `dead-code`, `test-coverage`, `study`, `update-memory`, `reconcile`. `research` è entrambi: entry point a mano, e figlio interno di `new-feature`. `ship-feature` è **solo interno**: è la consegna, e la apre `new-feature`; una cartella già decisa si consegna da lì, riprendendo la catena dal punto in cui i documenti si fermano. `blueprint` è solo interno: lo aprono `ship-feature` come fase 1 e `new-feature` per il fermarsi al brief. Anche `sync-host` è entrambi: entry point a mano, e figlio di `init` su Codex.

**Marchio dell'invocabilità a mano è l'`argument-hint`**: le dieci che l'hanno sono le dieci della tabella, e nessun'altra skill ne porta uno. `ship-feature` non ne ha più uno, perché non è più un entry point.

**Why:** se un contratto interno diventa lanciabile a mano si apre un secondo modo di arrivarci, con scope e permessi diversi da mantenere allineati per sempre. Per questo il numero non cresce da solo: sono dieci — sette nel metodo, dove `release` è il gesto di promozione fra due rami che nessun altro nodo compie; tre nell'installazione, l'ultimo è `new-project`, che scrive i documenti fondativi le cui sedi `init` ha solo assegnato.

**E `new-feature` si apre solo su richiesta dell'owner.** È la sola skill di cui nessun altro nodo è chiamante: il `GRAPH` dichiara `owner`, e `owner` è l'umano che chiede, non la sessione che giudica un lavoro meritevole della catena. Un lavoro che merita una feature è una riga che lo propone. Vedi [[corpus-di-sviluppo]].

**How to apply:** prima di aggiungere un `argument-hint` o un pointer a un contratto interno, rileggere orchestration §3; per un **ingresso della catena** la sede è `ENTRIES` di `architect/architect.mjs`, che rifiuta ogni altro nome — e il banco lo prova, perché un nome che non è un ingresso lì dentro muore come input malformato. Vedi [[alberatura-pacchetto]] e [[corpus-di-sviluppo]].
