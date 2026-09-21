---
name: punti-ingresso-prodotto
description: "I sette entry point di Daiku in due gruppi, e tutto il resto che è contratto interno"
metadata:
  type: project
---

Daiku ha **sette entry point** — le sole skill che si lanciano a mano. Stanno in `contracts/orchestration.md` §3, e il README del prodotto li racconta dal più semplice al più grande. Tutto il resto sotto `skills/` è **contratto interno**: lo riceve un subagent come path da leggere, non si invoca.

**Il metodo — il lavoro di ogni giorno (5):**

- `new-feature` — da un'idea al commit, orchestrando tutto il resto
- `research` — studia una tecnologia dalle fonti vere, deposita gli appunti e si ferma
- `review` — controlla un diff a giri, con finder indipendenti e applicatore
- `code-review` — un passaggio solo-bug sullo scope detto a mano, senza giri né fix
- `commit` — allinea memoria e documenti con `update-memory`, poi chiude in commit separati

**L'installazione — una volta per progetto (2):**

- `init` — apre `.daiku/` su un progetto che non ce l'ha; finché non gira, niente altro ha i valori per lavorare
- `sync-host` — solo su Codex, dopo ogni aggiornamento: riallinea guardrail e ruoli in `.codex/`

Interni, mai a mano: `decision-doc`, `develop-feature`, `blueprint`, `execute`, `finder-prompt`, `applier`, `arch-check`, `perf`, `test-coverage`, `study`, `update-memory`. `research` è entrambi: entry point a mano, figlio interno di `new-feature`.

**Why:** se un contratto interno diventa lanciabile a mano si apre un secondo modo di arrivarci, con scope e permessi diversi da mantenere allineati per sempre. Per questo il numero non cresce da solo.

**How to apply:** prima di aggiungere un `argument-hint` o un pointer a un contratto interno, rileggere orchestration §3. Vedi [[alberatura-pacchetto]] e [[corpus-di-sviluppo]].
