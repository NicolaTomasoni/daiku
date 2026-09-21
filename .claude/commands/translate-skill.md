---
description: 'Prende una skill di Daiku in input e la riscrive in inglese a comportamento e variabili invariati, sovrascrivendo il file — poi verifica che ogni variabile sia già in inglese'
argument-hint: '[path skill Daiku]'
---

Traduci le skill una alla volta e **sovrascrivi il file stesso**: nessun file nuovo, nessuna copia accanto.

## Input: quale skill tradurre

Argomenti: `$ARGUMENTS`

L'argomento è il **path** della `SKILL.md` da tradurre (es. `plugins/daiku/skills/research/SKILL.md`). Si accetta anche il solo **nome** (es. `research`), che risolvi come `plugins/daiku/skills/<nome>/SKILL.md`.

- Se `$ARGUMENTS` è vuoto, **chiedi** quali skill tradurre e fermati finché non le ricevi.
- Se nomina più skill, traducile tutte in ordine, una alla volta.
- Se un file non esiste, dillo e passa alla successiva.
- Leggi ogni file **per intero** prima di toccarlo.

## Regola 1 — traduci solo la prosa

Traduci in inglese **solo** il testo discorsivo: paragrafi, titoli, elenchi, spiegazioni.

Non toccare mai, byte per byte:

- il frontmatter `name` (resta uguale alla cartella);
- ogni variabile fra graffe `{...}` (`{paths.lib_notes}`, `{language.chat}`, ...) — non rinominare, non tradurre, non riordinare;
- `$ARGUMENTS` e ogni altro `$...`;
- code span, blocchi di codice, schemi JSON, nomi di chiavi JSON, path, comandi letterali, nomi di file e cartelle, numeri di sezione e di versione;
- struttura e ordine delle sezioni, vincoli e formato di ritorno.

I vincoli restano vincoli: `devi` diventa `must`, `mai` diventa `never`, `sempre` diventa `always`, `solo` diventa `only` — mai forme attenuate come `should` o `can`.

La `description` del frontmatter si traduce in inglese; i valori restano quotati con apice singolo.

## Regola 2 — sovrascrivi

Scrivi il risultato **nello stesso path letto**, sovrascrivendolo. Non creare copie, backup o file `-en`. Dopo la scrittura rileggi il file e conferma che esiste e contiene la versione inglese.

## Output finale

Solo chat, in quest'ordine:

1. **file** — il path sovrascritto;
2. **variabili** — elenco di ogni `{...}` e `$...` trovato, con esito `inglese` o `da rivedere`;
3. **non tradotto** — una riga su ciò che hai lasciato volutamente identico (codice, path, comandi, JSON).
