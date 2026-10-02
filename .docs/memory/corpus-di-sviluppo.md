---
name: corpus-di-sviluppo
description: "In .claude/commands/ restano solo i comandi che il prodotto non ha: con cui Daiku si sviluppa sono le skill daiku:* del pacchetto, e lo strumento resta indietro per scelta"
metadata: 
  node_type: memory
  type: project
  originSessionId: 48eaa498-ed6e-4a36-847d-3f8fa95f7f21
  modified: 2026-10-02T09:23:40.000Z
---

Dal 2 ottobre 2026 `.claude/` **contiene solo i comandi che il prodotto non ha.**

**Con cui Daiku si sviluppa sono le skill di Daiku stesso.** Il pacchetto è installato dal
marketplace online — `NicolaTomasoni/daiku`, canale `beta` — e aprire una feature, consegnarla, il
ciclo di review, il commit e l'allineamento della memoria sono le sue skill, invocate come `daiku:*`
(`new-feature`, `ship-feature`, `review`, `code-review`, `commit`, `update-memory`, `research`,
`blueprint`, `execute`, `decision-doc`). Un comando che ha il suo gemello là non vive anche qui.

**I cinque comandi che restano** coprono ciò che Daiku non fa per un progetto, perché riguarda il
costruire e il pubblicare Daiku stesso: `collauda-init`, `rilascia-daiku`, `studia-repository`,
`studia-repository-lotto`, `translate-skill`. Il contratto che li lega è `.claude/orchestration.md`,
potato con loro: i due ruoli e i loro modelli, come si lancia un subagent, la delega, la topologia
dei cinque, il gate del repository, i tre gruppi di commit. Valori scritti per esteso e niente
worktree, come prima.

**Lo strumento resta indietro rispetto all'albero, ed è voluto.** L'ultima beta pubblicata è la
versione di Daiku che sviluppa Daiku: una modifica a una skill del pacchetto non cambia lo
strumento finché non si rilascia. È la scelta dell'owner, non una dimenticanza da riparare. Vedi
[[cantiere-mai-nominarlo]].

**Why:** un comando che il prodotto già offre, riscritto qui, è una seconda copia del metodo da
tenere allineata a mano: le due divergono al primo cambiamento e quella del cantiere resta indietro
in silenzio. Il cantiere tiene solo ciò che Daiku non fa — costruirlo e pubblicarlo — perché quello
non è una capacità che Daiku offra a un progetto, e non ha dove stare nel pacchetto.

**How to apply:** quando serve un comando di sviluppo la prima domanda è se il prodotto ne ha già
uno: se sì si lancia quello, e non si scrive niente qui. Un comando nuovo entra in
`.claude/commands/` solo se nessuna skill di Daiku lo copre, e allora il suo nodo si dichiara in
`.claude/orchestration.md` §5.

Vedi [[alberatura-pacchetto]], [[installazione-e-versionamento]] e [[si-pubblica-solo-il-prodotto]].
