---
name: cosa-claude-code-accetta
description: "Il pacchetto su Claude Code — un solo `skills/<nome>/SKILL.md` come primitivo, un manifest e una vetrina, e il confine che non si aggira: nessun pacchetto scrive nel progetto"
metadata:
  node_type: memory
  type: project
  originSessionId: 33614099-e150-45f7-99eb-7fe0113b9450
  modified: 2026-10-12T12:13:48.157Z
---

`skills/<nome>/SKILL.md` è il **primitivo** del pacchetto, ed è l'unico: non annida, ed è la ragione
per cui i contratti di Daiku sono skill e non comandi. I contratti di riferimento — `orchestration.md`,
`project-contract.md` — stanno in `contracts/`: le skill li aprono per path e non sono skill loro
stessi.

Un pacchetto ha **un manifest** e **una vetrina**: `.claude-plugin/plugin.json` dentro `daiku/`, e
`.claude-plugin/marketplace.json` nella radice di `plugins/`. Sono i due file che l'host cerca, e
vanno tenuti allineati. Dove stanno è in [[alberatura-pacchetto]].

Il manifest porta `name`, `version`, `description`, `author`, e i campi facoltativi che l'host
accetta (`license`, `keywords`). La voce della vetrina porta `name`, `owner`,
`description` e `plugins[]`, dove `source.path` è relativo alla radice della vetrina — che sta due
livelli sopra il `marketplace.json`.

**Un rimando dentro il pacchetto non è mai un path assoluto.** `${CLAUDE_PLUGIN_ROOT}` cambia a ogni
aggiornamento. Restano due forme: il nome con lo slash per una skill (`/review`, `/commit`), e il
path **relativo alla radice del pacchetto** per un contratto di riferimento
(`contracts/orchestration.md`). Le chiavi con cui l'host espone i propri valori stanno nella tabella
§7 di `contracts/orchestration.md`, che è la sede normativa: qui non si ricopiano.

**E vale un confine che non si aggira: nessun pacchetto scrive nel progetto dell'utente.** Su Claude
Code è un confine di sicurezza dichiarato — path traversal fuori dalla radice rifiutato, symlink
verso l'esterno saltati — e il pacchetto è solo *letto da dove sta installato*. Ne segue che i
livelli parametri e dominio non si consegnano: li **genera** un comando che lancia l'utente, ed è il
mestiere di `init` (vedi [[init-scrive-le-istruzioni]] e [[tre-livelli-di-parametro]]).

**How to apply:** prima di aggiungere una cartella al pacchetto, chiedersi chi la legge. Una cosa che
le skill leggono ma che skill non è va in `contracts/`, **mai** sotto `skills/`: l'host scandisce
anche le sottocartelle che iniziano col punto, quindi `skills/.contratti/` diventerebbe una skill
rotta.

Vedi [[installazione-e-versionamento]] e [[alberatura-pacchetto]].
