---
name: punti-ingresso-prodotto
description: "I nove entry point di Daiku in due gruppi, e tutto il resto che è contratto interno"
metadata:
  node_type: memory
  type: project
  originSessionId: 38efe876-5b85-4605-8e0f-a47275150768
  modified: 2026-09-30T12:10:32.548Z
---

Daiku ha **nove entry point** — le sole skill che si lanciano a mano. Stanno in `contracts/orchestration.md` §3, e il README del prodotto li racconta dal più semplice al più grande. Tutto il resto sotto `skills/` è **contratto interno**: lo riceve un subagent come path da leggere, non si invoca.

**Il metodo — il lavoro di ogni giorno (7):**

- `new-feature` — da un'idea al commit, orchestrando tutto il resto; con `--stop-at-brief` si ferma al brief
- `research` — studia una tecnologia dalle fonti vere, deposita gli appunti e si ferma
- `review` — controlla un diff a giri, con finder indipendenti e applicatore
- `code-review` — un passaggio solo-bug sullo scope detto a mano, senza giri né fix
- `commit` — allinea memoria e documenti con `update-memory`, poi chiude in commit separati
- `blueprint` — da decision-doc risolto e soluzione scelta produce `2. blueprint.md` e si ferma: la consegna che viaggia dove l'esecuzione gira
- `develop-feature` — da una cartella esistente, col brief o senza, consegna fino al commit senza riaprire lo studio

**L'installazione — una volta per progetto (2):**

- `init` — apre `.daiku/` su un progetto che non ce l'ha; finché non gira, niente altro ha i valori per lavorare
- `sync-host` — solo su Codex: `init` lo lancia come ultimo passo, e si rilancia dopo ogni aggiornamento; riallinea guardrail e ruoli in `.codex/`

Interni, mai a mano: `decision-doc`, `execute`, `finder-prompt`, `applier`, `arch-check`, `perf`, `dead-code`, `test-coverage`, `study`, `update-memory`. `research`, `blueprint` e `develop-feature` sono entrambi: entry point a mano, figli interni di `new-feature` (il terzo, di `develop-feature` per il brief, lo apre come fase 1). Anche `sync-host` è entrambi: entry point a mano, e figlio di `init` su Codex.

**Why:** se un contratto interno diventa lanciabile a mano si apre un secondo modo di arrivarci, con scope e permessi diversi da mantenere allineati per sempre. Per questo il numero non cresce da solo: dal 28 settembre 2026 sono nove perché il flusso a due macchine — studio e brief su una, esecuzione al buio sull'altra — non si compone altrimenti, e ciascuno dei due dichiara le sue modalità in casa come già faceva `research`.

**How to apply:** prima di aggiungere un `argument-hint` o un pointer a un contratto interno, rileggere orchestration §3. Vedi [[alberatura-pacchetto]] e [[corpus-di-sviluppo]].
