---
name: init-aggancia-la-memoria
description: "init crea la sede della memoria in ogni progetto e vi porta dentro la memoria dell'host — un corpus solo, due scrittori"
metadata:
  node_type: memory
  type: project
  originSessionId: 33614099-e150-45f7-99eb-7fe0113b9450
  modified: 2026-10-12T12:12:55.466Z
---

Dal 19 settembre 2026 `init` **porta la memoria dell'host dentro il repository** del progetto ospite:
ci apre `{memory.root}` con il suo indice, **sposta** lì i file che
l'agente aveva già scritto sotto `~/.claude/projects/<progetto>/memory/`, e scrive
`autoMemoryEnabled` e `autoMemoryDirectory` in `.claude/settings.local.json`. **Dal 2 ottobre 2026 la
sede del corpus, invece, `init` la crea su qualunque progetto che non ce l'ha**: il corpus è del
metodo, e `update-memory` lo scrive a ogni commit. **Su opencode quella sede dell'host non esiste** —
l'host non ha una cartella di memoria né legge un file di impostazioni: `init` non porta niente e lo
**dichiara** in una riga, e lì il corpus resta con un solo scrittore, `update-memory`
([[canale-opencode]], [[due-host]]).

**Why:** la sede è **una sola** — `{memory.root}` — e da quel momento ha due scrittori che non si
coordinano: l'host di sua iniziativa e `update-memory` a ogni commit. È la scelta dell'owner fra
le due che erano sul tavolo, contro due cartelle separate nello stesso repo. Per la stessa ragione
i file si **spostano** e non si copiano: due corpus che divergono senza che nessuno dei due
dichiari di essere quello buono sono peggio del problema che risolvevano. Dal 7 ottobre 2026 la
scrittura dell'host non è più solo d'iniziativa: l'allineamento è dovuto a ogni modifica, e il
commit è l'ultima delle sue sedi invece dell'unica ([[allineamento-a-ogni-modifica]]).

**How to apply:** tre conseguenze che stanno in piedi solo insieme.

- **`memory.root` e `memory.index` sono le uniche chiavi che `init` scrive sempre**, anche su un
  progetto che non aveva nessun corpus: lì la cartella non si rileva, si
  assegna. La §6 del contratto (ciò che il JSON non dichiara non esiste) non le copre — la sede della
  deroga è la §4.2 di `plugins/daiku/contracts/project-contract.md`.
- **Il puntamento non si committa**, e il perché del vincolo è in [[memoria-nel-repo]]: vale
  identico sul progetto ospite. Chi clona si ritrova il corpus versionato e l'host che riscrive
  nel default in silenzio, finché non rilancia `/init` su quella macchina. Nessuna skill se ne
  accorge, perché il corpus lo aprono per path e lo trovano dov'era.
- **`memory-contract.md` è diventato il secondo scheletro di dominio con un default** (l'altro è
  `commit-convention.md`), e non per comodità: due scrittori sulla stessa cartella senza una forma
  dichiarata non restano indeterminati, diventano due forme nella stessa cartella.

Vedi [[init-scrive-le-istruzioni]] per il resto di ciò che `init` deposita, e
[[tre-livelli-di-parametro]] per dove atterra un valore.
