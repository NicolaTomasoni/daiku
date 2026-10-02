---
name: pool-worktree
description: "Il pool dei worktree ha un programma (architect/pool.mjs) che possiede il registro e la scelta dello slot: un albero pulito è libero e basta, e la condizione che saturava il pool non c'è più"
metadata:
  node_type: memory
  type: project
  modified: 2026-10-02T00:00:00Z
---

**Dal 2 ottobre 2026 il pool dei worktree ha il suo lato disco: `architect/pool.mjs`.** Prima la
fase 0 di `ship-feature` sceglieva lo slot a mano, con dei comandi Git scritti in prosa, e il
criterio di «libero» portava due condizioni: `git status --porcelain` vuoto **e** `rev-parse HEAD`
uguale a quello del ramo d'integrazione. La seconda era ridondante — l'azione successiva fa già
`reset --hard` allo stesso ramo — e letale: la pulizia di una consegna lascia lo slot esattamente un
commit indietro, quindi appena main avanza di un commit nessuno slot è più «libero», **per sempre**.
Il pool si riempiva di slot puliti e inutilizzabili fino al tetto, e da lì ogni nuova consegna si
fermava con `blocked`: cinque slot servivano cinque consegne, non cinque in volo.

**La regola ora è: uno slot è riusabile quando il suo albero è pulito e il suo ramo non porta
niente che il ramo d'integrazione non abbia già.** Il criterio è divenuto la domanda `pool` del
valutatore — riuso, creazione del numero libero più basso, o rifiuto a tetto raggiunto — e `pool.mjs`
la esegue: misura Git, resetta o crea, e scrive il registro. Il tetto conta gli slot **in volo**,
non le consegne accumulate.

**L'uguaglianza di HEAD è sparita, la contenzione è restata al suo posto, e non è un dettaglio.**
Togliere `HEAD == HEAD(<INT>)` e tenere la sola pulizia — come chiedeva il ticket — avrebbe fatto
riusare anche lo slot del merge andato in conflitto: lì la consegna ha **committato** il suo lavoro,
quindi l'albero è pulito e il suo HEAD non sta su main, e il `reset --hard` dell'acquisizione
avrebbe portato via quei commit. La misura che protegge è `git merge-base --is-ancestor`: uno slot
che sta solo *indietro* ha i suoi commit già su main ed è riusabile; uno che ne porta di non
integrati no.

**Il registro è l'attribuzione che Git non dà.** `{paths.review_state}/worktree-pool.json`, scritto
solo da `pool.mjs`, una riga per slot: `n`, `name`, `branch`, `state` (`in-use`, `free`,
`blocked`), `delivery`, `updated`. È ciò che fa dire a un pool pieno **di chi** è ogni slot occupato
invece di trovarsi davanti sporcizia anonima; uno slot che il registro dice `in-use` ma con l'albero
pulito è una corsa che non ha rilasciato, ed è riusabile lo stesso. La sede è quella dichiarata per
lo stato fuori dal versionamento, accanto al ledger della review (vedi [[daiku-versionato]]).

**Why:** il difetto non era una perdita rara, era il comportamento ordinario — *N* consegne riuscite
consumavano *N* slot — e la sua radice era una deduzione («questo slot è finito?») fatta da Git
invece che da un fatto registrato nel momento giusto. Mettere la scelta in un programma, col suo
banco, è la stessa mossa del ledger della review: una misura che un agente esegue e riporta è una
dichiarazione, una che esegue un programma è una misura (vedi [[valutatore-deterministico]]).

**How to apply:** il contratto è in `skills/ship-feature/SKILL.md` § *Worktree pool*, § *0.
Acquisition* e § *6c. Cleanup*; il registro in `schemas/blocks.json` § *pool*; la sede in §4 di
`contracts/project-contract.md`. Il banco si lancia con gli altri da
`node plugins/daiku/hooks/self-check.mjs` (vedi [[alberatura-pacchetto]]).
