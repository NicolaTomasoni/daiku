# Politiche di area

Un file qui dentro porta le **regole architetturali di una parte del progetto**: i confini fra
layer, la direzione ammessa delle dipendenze, le convenzioni che una revisione deve poter
verificare. Gli invarianti universali stanno nel file di istruzioni del progetto; qui sta ciò che vale
solo per un'area.

Il nome del file è libero e descrive l'area (`backend-architecture.md`, `dependency-flow.md`).
Quello che non è libero è il frontmatter: **ogni file dichiara `paths`**, l'elenco dei pattern
che copre. È l'indirizzo con cui una skill decide se aprirlo, e un file senza `paths` non viene
aperto da nessuno.

```markdown
---
paths:
  - "<pattern che copre i sorgenti dell'area>"
  - "<pattern che copre i suoi test>"
---

# <Nome dell'area>

…
```

Una regola si scrive come **invariante verificabile**, non come consiglio: «il layer X non importa
mai Y» si traduce in un controllo, «tenere il backend pulito» no. Chi legge queste regole le
rilegge a ogni esecuzione e non si fida di una lista memorizzata: se il testo cambia, cambia anche
cosa viene verificato.

Il nome `policies/` non è un sinonimo elegante di `rules/`: su Codex `rules/` è già un concetto di
sicurezza dell'host — file Starlark che governano l'esecuzione dei comandi — e riusare quel nome
farebbe collidere due cose che non c'entrano nulla.

Forma, convenzione di citazione e regola di degradazione stanno in `contracts/project-contract.md`.
