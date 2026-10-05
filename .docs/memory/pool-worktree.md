---
name: pool-worktree
description: "Il pool dei worktree ha un programma (architect/pool.mjs) che possiede il registro, il possesso e la scelta dello slot: riusabile è l'albero pulito che nessuna consegna tiene, e la scelta si fa sotto un lock"
metadata:
  node_type: memory
  type: project
  modified: 2026-10-05T07:27:41.418Z
  originSessionId: cec12c3d-2221-4725-9514-9c0a02b67757
---

**Dal 2 ottobre 2026 il pool dei worktree ha il suo lato disco: `architect/pool.mjs`.** Prima la
fase 0 di `ship-feature` sceglieva lo slot a mano, con dei comandi Git scritti in prosa, e il
criterio di «libero» portava due condizioni: `git status --porcelain` vuoto **e** `rev-parse HEAD`
uguale a quello del ramo d'integrazione. La seconda era ridondante — l'azione successiva fa già
`reset --hard` allo stesso ramo — e letale: la pulizia di una consegna lascia lo slot esattamente un
commit indietro, quindi appena main avanza di un commit nessuno slot è più «libero», **per sempre**.
Il pool si riempiva di slot puliti e inutilizzabili fino al tetto, e da lì ogni nuova consegna si
fermava con `blocked`: cinque slot servivano cinque consegne, non cinque in volo.

**La regola è: uno slot è riusabile quando il suo albero è pulito, il suo ramo non porta niente che
il ramo d'integrazione non abbia già, e nessuna consegna lo tiene.** Il criterio è la domanda `pool`
del valutatore — riuso, creazione del numero libero più basso, presa in carico del proprio slot, o
rifiuto a tetto raggiunto — e `pool.mjs` la esegue: misura Git, resetta, crea o riprende, e scrive il
registro. Il tetto conta gli slot **in volo**, non le consegne accumulate.

**Il possesso è la metà che mancava, e sta nel registro.** Uno slot appena acquisito ha l'albero
pulito e non porta commit fuori dall'integrazione: è esattamente la forma di uno riusabile, quindi una
scelta che legge solo l'albero lo offre alla consegna successiva, che ci si siede sopra. Non è un
incastro raro — è ciò che accade a ogni lancio di due consegne insieme, ed è come tre feature sono
finite a scrivere sullo stesso albero. Perciò uno slot che il registro dice `in-use` non si offre a
nessun altro, e uno slot tenuto dalla consegna che sta chiedendo — una ripresa, o la stessa cartella
rilanciata — si riprende **com'è**: nessun reset, nessun secondo slot, e ciò che quella consegna vi
aveva lasciato sopravvive.

**L'altra metà è il lock: il registro si legge e si scrive sotto un lock esclusivo.** `pool.mjs`
prende un file di lock accanto al registro (`worktree-pool.json.lock`) per l'intero tratto
leggi-misura-scegli-scrivi, e lo toglie quando l'azione finisce, comunque finisca; una seconda
acquisizione aspetta, e poi sceglie su ciò che la prima ha scritto. Senza, due acquisizioni che
leggono il registro prima che l'altra scriva scelgono lo stesso slot, e il possesso non ha niente da
pesare. Un lock lasciato da un processo morto viene rubato — un processo ucciso a metà non deve
fermare il pool per sempre — mentre uno tenuto da un processo vivo fa fallire l'acquisizione,
rumorosamente e senza scrivere niente.

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
invece di trovarsi davanti sporcizia anonima: `in-use` è una consegna che ci sta lavorando, e nessuno
lo riusa. Se quella corsa è morta senza rilasciare, lo slot esce dal pool lo stesso —
l'acquisizione si ferma e lo nomina, e l'owner lo rilascia — perché l'alternativa è offrire un albero
su cui un'altra corsa può ancora stare scrivendo. La sede è quella dichiarata per lo stato fuori dal
versionamento, accanto al ledger della review (vedi [[daiku-versionato]]).

**Why:** il difetto non era una perdita rara, era il comportamento ordinario — *N* consegne riuscite
consumavano *N* slot — e la sua radice era una deduzione («questo slot è finito?») fatta da Git
invece che da un fatto registrato nel momento giusto. Mettere la scelta in un programma, col suo
banco, è la stessa mossa del ledger della review: una misura che un agente esegue e riporta è una
dichiarazione, una che esegue un programma è una misura (vedi [[valutatore-deterministico]]).

**How to apply:** il contratto è in `skills/ship-feature/SKILL.md` § *Worktree pool*, § *0.
Acquisition* e § *6c. Cleanup*; il registro in `schemas/blocks.json` § *pool*; la sede in §4 di
`contracts/project-contract.md`. Il banco si lancia con gli altri da
`node plugins/daiku/hooks/self-check.mjs` (vedi [[alberatura-pacchetto]]).
