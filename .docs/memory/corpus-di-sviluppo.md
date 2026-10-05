---
name: corpus-di-sviluppo
description: "In .claude/commands/ restano solo i comandi che il prodotto non ha — studia-repository e translate-skill; con cui Daiku si sviluppa, rilascio compreso, sono le skill daiku:*, e lo strumento resta indietro per scelta"
metadata:
  node_type: memory
  type: project
  originSessionId: 48eaa498-ed6e-4a36-847d-3f8fa95f7f21
  modified: 2026-10-05T00:00:00.000Z
---

`.claude/` **contiene solo i comandi che il prodotto non ha.**

**Con cui Daiku si sviluppa sono le skill di Daiku stesso.** Il pacchetto è installato dal
marketplace online — `NicolaTomasoni/daiku`, ramo di produzione `main` — e aprire una feature,
consegnarla, il ciclo di review, il commit, l'allineamento della memoria e **il rilascio** sono le
sue skill, invocate come `daiku:*` (`new-feature`, `ship-feature`, `review`, `code-review`, `commit`,
`release`, `update-memory`, `research`, `study`, `decision-doc`, `blueprint`, `execute`). Un comando
che ha il suo gemello là non vive anche qui.

**I due comandi che restano** coprono ciò che Daiku non fa per un progetto, perché riguarda il
costruire Daiku stesso: `studia-repository`, `translate-skill`. Il contratto che li lega è
`.claude/orchestration.md`, potato con loro: ruoli e modelli, come si lancia un subagent, la delega,
la topologia dei due, il gate del repository.

**Il rilascio era il terzo, e non lo è più** (dal 5 ottobre 2026). `/rilascia-daiku` e i due script
PowerShell di canale esistevano perché Daiku non sapeva fare il rilascio da sé; ora lo sa, e
l'entry point è `daiku:release` — vedi [[pubblicazione-su-github]] e [[canali-e-promozione]]. Il
comando del cantiere **si toglie**, non si tiene come scorciatoia: una seconda copia del metodo
divergerebbe al primo cambiamento.

**Lo strumento resta indietro rispetto all'albero, ed è voluto.** L'ultimo rilascio pubblicato è la
versione di Daiku che sviluppa Daiku: una modifica a una skill del pacchetto non cambia lo strumento
finché non si rilascia. È la scelta dell'owner, non una dimenticanza da riparare. Vedi
[[cantiere-mai-nominarlo]].

**Why:** un comando che il prodotto già offre, riscritto qui, è una seconda copia del metodo da
tenere allineata a mano: le due divergono al primo cambiamento e quella del cantiere resta indietro
in silenzio. Il cantiere tiene solo ciò che Daiku non fa — costruirlo — perché quello non è una
capacità che Daiku offra a un progetto, e non ha dove stare nel pacchetto.

**How to apply:** quando serve un comando di sviluppo la prima domanda è se il prodotto ne ha già
uno: se sì si lancia quello, e non si scrive niente qui. Un comando nuovo entra in
`.claude/commands/` solo se nessuna skill di Daiku lo copre, e allora il suo nodo si dichiara in
`.claude/orchestration.md` §5.

Vedi [[alberatura-pacchetto]], [[installazione-e-versionamento]] e
[[si-pubblica-solo-il-prodotto]].
