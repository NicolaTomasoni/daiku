---
name: segnaposto-gate-appunti
description: il gate di `studia-repository` è rosso su qualunque parentesi angolare nel testo di un appunto, anche dentro una citazione di codice — e il modulo d'esempio del contratto ne è pieno
metadata:
  type: project
---

`segnaposti()` in `.docs/tools/studia-repository/corsa.mjs` è cieco per scelta: qualunque
sequenza racchiusa fra parentesi angolari, lunga fino a 60 caratteri e senza `://` dentro, è un
segnaposto rimasto — anche se è una citazione del codice del target (`</llmlingua>`, `<cmd>`,
`<!-- headroom:learn:start -->`, `src/cmds/<ecosistema>/`). Lo stesso vale per la sintesi e per i
file di feature.

La trappola è che **il modulo d'esempio del contratto** (`.claude/commands/studia-repository.md`,
§ *La forma dell'appunto*) è scritto a parentesi angolari: l'agente che lo imita ne mette nel
testo e l'appunto è rosso. E il rilancio previsto dal contratto — «una volta sola, con lo stesso
identico prompt» — **non lo ripara**, perché la causa è nel prompt stesso.

Nella corsa del 3 ottobre 2026 (`prima-che-arrivi-al-modello-output-dei-tool-e-serializzazione`,
9 target) è successo su 7 appunti su 9. Il gate pieno scusa un appunto rosso **solo** se la sintesi
nomina il target in `## Limiti`: senza rimedio, la corsa avrebbe chiuso con 7 gap dichiarati e la
sintesi costruita sui 2 appunti validi. Risolto riprendendo gli stessi subagent con la loro lettura
ancora in contesto e una riga sola: nel file non entra nessuna parentesi angolare. Il gate è poi
diventato verde.

**Perché:** un rosso di forma non costa un appunto, costa la corsa — il target diventa un gap e la
sua lettura esce dal giudizio.

**How to apply:** quando lanci i subagent degli appunti, aggiungi al loro prompt la riga esplicita
sul divieto di parentesi angolari; e non contare sul rilancio identico del contratto, perché
riproduce il guasto. Vale anche per il prompt dell'orchestratore. Vedi [[fanout-ricerca]].
