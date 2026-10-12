---
name: init-riconciliazione
description: "init non scrive solo ciò che manca: la scansione risponde con più liste e il rilancio ritira le sedi del layout vecchio e le chiavi che il contratto non nomina più"
metadata:
  node_type: memory
  type: project
  originSessionId: 77ada92a-4f7c-494a-b72f-d27ca84e5cc7
  modified: 2026-10-12T12:10:54.240Z
---

Dal 4 ottobre 2026 la scansione di `init` (`skills/init/scan.mjs`) non risponde più con la sola
`missing`: accanto le stanno `legacy` e `params`, che non nominano cose da
**creare** ma cose da **correggere**. La decisione sotto è una sola: **un pezzo che sta lì da una
Daiku più vecchia è indietro quanto un pezzo che non c'è**, e nessun occhio distingue un file vecchio
da uno giusto. Un rilancio che leggesse solo `missing` chiamerebbe «tutto pronto» un progetto dentro
cui stanno ancora sedi che nessuno legge.

- **`legacy`** — le sedi che Daiku scriveva **prima** di `.daiku/` (`.claude/project.json`,
  `.claude/environment.json`, `.claude/orchestration.md`, `.claude/project-contract.md`,
  `.claude/hooks/contratti-post-edit.mjs`), più le voci di un settings file che puntano ancora a una
  di esse.
- **`params`** — una chiave di `.daiku/project.json` o di un file d'ambiente che il contratto non
  nomina più, letta contro le due liste che il pacchetto tiene in `schemas/blocks.json`.

**Step 9-bis è la fase che corregge.** Una sede del vecchio layout si chiude in uno stash git
esattamente come il file di istruzioni trovato ([[init-scrive-le-istruzioni]]) — `git stash push -u
-m "daiku: retired — <path> at the seat Daiku no longer writes" -- "<path>"`, col pathspec e `-u`
obbligatori e mai un `pop` — e poi si toglie dall'albero di lavoro. La **voce di un settings file**
che punta a una di esse si toglie da sola, come testo, lasciando ogni altra chiave e ogni fine di
riga com'erano: un hook su un path che non c'è più è fail-open, non parte e non dice niente, e una
guardia che sembra esistere non nega niente. **Una chiave che il contratto non nomina più** si toglie
dal file di parametri, sempre come testo: è il residuo di un valore, non un valore che qualcuno ha
scelto.

**Why:** l'idempotenza di `init` non è immobilità. Un rilancio non scrive solo il mancante — corregge
ciò che è indietro — e qui si separa dalla regola che protegge i file **del progetto**. Quella difende
la scelta dell'owner: un valore che qualcuno ha messo resta dove sta. Una sede che una Daiku vecchia
ha lasciato e una chiave che il contratto non nomina più non sono scelte di nessuno, e restano solo
per inerzia.

**How to apply:** tutto questo arriva al primo `/init` dopo l'aggiornamento del pacchetto, e
`update.mjs` è il solo che dice che serve ([[script-versionati]]).
