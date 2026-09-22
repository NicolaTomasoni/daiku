---
description: 'Prende un file di Daiku in input e lo riscrive in inglese a comportamento invariato, traducendo anche i nomi interni e lasciando intatti gli identificatori di confine, sovrascrivendo il file — poi verifica che ogni placeholder sia già in inglese'
argument-hint: '[path file Daiku]'
---

Traduci i file uno alla volta e **sovrascrivi il file stesso**: nessun file nuovo, nessuna copia accanto.

## Input: quale file tradurre

Argomenti: `$ARGUMENTS`

L'argomento è il **path** del file da tradurre (es. `plugins/daiku/contracts/project-contract.md`, `plugins/daiku/hooks/lib/command-guard.mjs`, `plugins/daiku/skills/research/SKILL.md`). Si accetta anche il solo **nome** di una skill (es. `research`), che risolvi come `plugins/daiku/skills/<nome>/SKILL.md`.

- Se `$ARGUMENTS` è vuoto, **chiedi** quali file tradurre e fermati finché non li ricevi.
- Se nomina più file, traducili tutti in ordine, uno alla volta.
- Se un file non esiste, dillo e passa al successivo.
- Leggi ogni file **per intero** prima di toccarlo.

## Regola 1 — traduci prosa, commenti e nomi interni; mai gli identificatori di confine

Traduci in inglese il testo discorsivo e i commenti: paragrafi, titoli, elenchi, spiegazioni, commenti di codice (`//`, `#`, `<!-- -->`, docstring).

**Un identificatore di confine è un nome che qualcuno nomina da fuori e che non puoi aggiornare
insieme.** Non toccarlo mai, byte per byte:

- il frontmatter `name` (resta uguale alla cartella) e ogni valore che sia un identificatore;
- ogni placeholder fra graffe `{...}` (`{paths.lib_notes}`, `{language.chat}`, ...) — non rinominare, non tradurre, non riordinare;
- `$ARGUMENTS` e ogni altro `$...`;
- le **chiavi di `project.json` e di `environment.json`**: stanno compilate nei file di un utente, e rinominarle le rende illeggibili senza che nessuno se ne accorga;
- i **nomi di campo dei blocchi di ritorno** che le skill si scambiano, e i loro valori enum;
- i **nomi dei file che il metodo deposita** in un progetto (`0. problem.md`, `2. blueprint.md`, ...): sono già su disco nelle cartelle di lavoro aperte;
- path, comandi letterali, nomi di file e cartelle del pacchetto, numeri di sezione e di versione;
- struttura e ordine delle sezioni, vincoli e formato di ritorno.

**I nomi interni invece si traducono, insieme alla prosa.** Variabili, funzioni, parametri,
costanti, chiavi di oggetti che non escono dal pacchetto, nomi dei casi di prova: se vivono solo
dentro `plugins/daiku/` e puoi aggiornare ogni lettore nello stesso passaggio, portali in inglese.
Un pacchetto inglese con le variabili in italiano è tradotto a metà, e a metà è la forma peggiore:
chi lo legge non sa più quale delle due lingue sia quella che conta.

La condizione è **una sola e non si deroga: aggiorni ogni lettore nello stesso diff, e lo provi.**
Dopo una rinomina, tutte e tre queste cose devono valere:

- `grep -rn "<nome vecchio>"` su `plugins/`, `.claude/` e `.agents/` non torna niente;
- `node plugins/daiku/hooks/self-check.mjs` esce verde **con lo stesso totale di prima** — un totale che cala è un banco che ha smesso di girare, e il verde da solo non lo mostra;
- i due validatori della § *Verificare il pacchetto* di `CLAUDE.md` passano entrambi.

Se non puoi fare tutte e tre, quel nome è di confine: lascialo dov'è.

I vincoli restano vincoli: `devi` diventa `must`, `mai` diventa `never`, `sempre` diventa `always`, `solo` diventa `only` — mai forme attenuate come `should` o `can`.

La `description` del frontmatter si traduce in inglese; i valori restano quotati con apice singolo.

## Regola 2 — sovrascrivi

Scrivi il risultato **nello stesso path letto**, sovrascrivendolo. Non creare copie, backup o file `-en`. Dopo la scrittura rileggi il file e conferma che esiste e contiene la versione inglese.

## Output finale

Solo chat, in quest'ordine:

1. **file** — il path sovrascritto;
2. **variabili** — elenco di ogni `{...}` e `$...` trovato, con esito `inglese` o `da rivedere`;
3. **rinominato** — ogni nome interno che hai portato in inglese, `vecchio → nuovo`, e l'esito delle tre prove della Regola 1: il `grep` a vuoto, il totale del banco prima e dopo, i due validatori. A zero rinomine, scrivi `nessuna`;
4. **non tradotto** — una riga sugli identificatori di confine che hai lasciato identici, e perché lo sono.
