---
name: init-riconciliazione
description: "init non scrive solo ciò che manca: la scansione risponde con più liste e il rilancio ritira le sedi del layout vecchio e le chiavi che il contratto non nomina più"
metadata:
  node_type: memory
  type: project
  originSessionId: 77ada92a-4f7c-494a-b72f-d27ca84e5cc7
  modified: 2026-10-15T10:55:59.127Z
---

Dal 4 ottobre 2026 la scansione di `init` (`skills/init/scan.mjs`) non risponde più con la sola
`missing`: accanto le stanno `legacy` e `params`, che non nominano cose da
**creare** ma cose da **correggere**. La decisione sotto è una sola: **un pezzo che sta lì da una
Daiku più vecchia è indietro quanto un pezzo che non c'è**, e nessun occhio distingue un file vecchio
da uno giusto. Un rilancio che leggesse solo `missing` chiamerebbe «tutto pronto» un progetto dentro
cui stanno ancora sedi che nessuno legge.

- **`legacy`** — le sedi che Daiku scriveva **prima** di `.daiku/` e di cui riconosce la **forma**
  (`.claude/project.json`, `.claude/environment.json`, `.claude/hooks/contratti-post-edit.mjs`), più
  le voci di un settings file che puntano ancora a una di esse.
- **`params`** — una chiave di `.daiku/project.json` o di un file d'ambiente che il contratto non
  nomina più, letta contro le due liste che il pacchetto tiene in `schemas/blocks.json`.

**Il criterio di `legacy` è la forma, non il path.** Un path non è un'impronta: un documento non
porta nessun segno di chi l'ha scritto, e a `.claude/<nome>.md` il file che un progetto si è scritto
è, per qualunque programma, lo stesso file di una copia lasciata da Daiku. Perciò la lista tiene la
coppia di parametri che uno schema descrive e lo script che una voce di settings avvia — macchinari,
non documenti — e ritirare un path sul suo solo nome metterebbe nello stash il documento del
progetto. Il cantiere di Daiku è il caso che l'ha reso visibile: il suo `.claude/orchestration.md` è
un contratto suo, vivo e citato da `CLAUDE.md` e da `.claude/commands/studia-repository.md`, e
l'elenco per path lo chiamava residuo.

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
