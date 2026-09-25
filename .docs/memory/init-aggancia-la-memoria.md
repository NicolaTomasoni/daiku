---
name: init-aggancia-la-memoria
description: init porta la memoria dell'host dentro il repo del progetto ospite, su Claude Code soltanto — un corpus solo, due scrittori
metadata:
  type: project
---

Dal 19 settembre 2026 `init`, **su Claude Code soltanto**, porta la memoria dell'host dentro il
repository del progetto ospite: crea `{memory.root}` con il suo indice, ci **sposta** i file che
l'agente aveva già scritto sotto `~/.claude/projects/<progetto>/memory/`, e scrive
`autoMemoryEnabled` e `autoMemoryDirectory` in `.claude/settings.local.json`. Su **Codex non fa
nulla**: lì la memoria è `~/.codex/memories_1.sqlite`, un database consolidato dalle sessioni, e
nessuna chiave ne sposta la sede.

**Why:** la sede è **una sola** — `{memory.root}` — e da quel momento ha due scrittori che non si
coordinano: l'host di sua iniziativa e `update-memory` a ogni commit. È la scelta dell'owner fra
le due che erano sul tavolo, contro due cartelle separate nello stesso repo. Per la stessa ragione
i file si **spostano** e non si copiano: due corpus che divergono senza che nessuno dei due
dichiari di essere quello buono sono peggio del problema che risolvevano.

**How to apply:** tre conseguenze che stanno in piedi solo insieme.

- **`memory.root` e `memory.index` sono le uniche chiavi che `init` scrive sempre**, anche su un
  progetto che non aveva nessun corpus: lì la cartella non si rileva, si assegna. La §6 del
  contratto (ciò che il JSON non dichiara non esiste) non le copre — la sede della deroga è la
  §4.2 di `plugins/daiku/contracts/project-contract.md`.
- **Il puntamento non si committa**, e il perché del vincolo è in [[memoria-nel-repo]]: vale
  identico sul progetto ospite. Chi clona si ritrova il corpus versionato e l'host che riscrive
  nel default in silenzio, finché non rilancia `/init` su quella macchina. Nessuna skill se ne
  accorge, perché il corpus lo aprono per path e lo trovano dov'era.
- **`memory-contract.md` è diventato il secondo scheletro di dominio con un default** (l'altro è
  `commit-convention.md`), e non per comodità: due scrittori sulla stessa cartella senza una forma
  dichiarata non restano indeterminati, diventano due forme nella stessa cartella.

Vedi [[init-scrive-le-istruzioni]] per il resto di ciò che `init` deposita, e
[[tre-livelli-di-parametro]] per dove atterra un valore.
