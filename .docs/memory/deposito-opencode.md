---
name: deposito-opencode
description: "Su opencode il pacchetto non si installa: init lo deposita dentro il progetto in .opencode/, con un manifesto di versione, e le guardie le riporta un plugin-adattatore"
metadata:
  node_type: memory
  type: project
---

**Su opencode il pacchetto non si installa: si deposita dentro il progetto.** opencode non ha manifest
né marketplace e legge le sue estensioni dal **progetto** — le skill in `.opencode/skills/`, gli
agenti in `.opencode/agents/`, i comandi in `.opencode/commands/`, i plugin in `.opencode/plugins/` —
quindi il metodo deve scriverglisi dentro, e a scriverlo è `init`, un comando che l'utente lancia: il
confine «nessun pacchetto scrive nel progetto» resta, cambia la via che lo rispetta. Il deposito è il
ramo opencode di `init`, reso deterministico da `skills/init/deposit.mjs`, che `init` invoca con la
stessa forma di `scan.mjs` e `branch.mjs`. Su Claude Code non c'è niente di tutto questo.

**Cosa depone, e perché ciascuna sede.** Ogni `skills/<nome>/SKILL.md` va in
`.opencode/skills/<nome>/SKILL.md`, la sede in cui opencode scopre una skill; ogni
`agents/opencode/<ruolo>.md` va in `.opencode/agents/<ruolo>.md`, e così il `finder` arriva per la
prima volta; il **supporto** — `skills/`, `contracts/`, `architect/`, `schemas/`, `templates/`,
`hooks/lib/`, `.claude-plugin/` — va in una cartella **sorella** `.opencode/daiku/`, perché una skill
calcola la radice di supporto dalla propria base directory (`.opencode/skills/<nome>/` →
`.opencode/daiku/`) e di lì apre per path tutto il resto; lo scheletro `templates/opencode/plugin.js`
va in `.opencode/plugins/daiku.js`, la riga che opencode auto-carica. Le sedi native e la cartella
sorella vanno tenute in sincrono al deposito: è il prezzo della separazione fra ciò che opencode
scandisce e ciò che le skill aprono per path.

**Il manifesto dice la versione, e la scansione la legge.** `.opencode/daiku/deposit.json` porta
`{version, host, wrote, declared_missing}`, con la `version` presa da `.claude-plugin/plugin.json`: è
l'unica cosa che distingue un deposito di questa Daiku da uno di una più vecchia, la stessa lettura
che il marcatore `daiku:script` fa per gli script ([[script-versionati]]). `skills/init/scan.mjs`
elenca il deposito sotto il passo `4-bis` — assente quando il manifesto non c'è, **indietro** quando
la sua versione non è quella del pacchetto, o con un pezzo che il manifesto nomina e il disco non ha —
e `init` lo rifà. Il deposito è **idempotente e intero**: `.opencode/` è la sede del metodo e non del
progetto, quindi un rilancio la ricrea tutta. L'unico file **del progetto** che il deposito tocca è
`opencode.json`, e per sola aggiunta.

**Le guardie le riporta un plugin, non un `hooks.json`.** La sede viva delle guardie è l'adattatore
`hooks/opencode-plugin.mjs`, depositato accanto a `hooks/lib/`; **importa** i moduli del pacchetto e
non li riscrive, quindi la guardia che gira lì è la stessa che gira su Claude Code. Aggancia
`command-guard` e `ask-guard` a `tool.execute.before` (dove il diniego è un'**eccezione** lanciata),
`contracts-post-edit` a `tool.execute.after` (che riferisce e non nega), `run-advice` a
`session.prompt` e `session-advice` all'evento `session.created`. Due dei sette moduli — `stop-advice`
e `subagent-advice` — restano **senza evento** e si **dichiarano mancanti**, nel file e nel
`declared_missing` del manifesto.

**L'annidamento lo dichiara il deposito.** opencode limita la profondità dei subagenti con
`experimental.subagent_depth`, e la catena più lunga del metodo — `new-feature → ship-feature →
review → finder`, quattro livelli — ne chiede `3`. Il deposito scrive la chiave **sotto
`experimental`** in `opencode.json` (in radice opencode la scarta in silenzio), creando il file se
manca e **mai** sovrascrivendo un valore che il progetto dichiara.

**Why:** su Claude Code il pacchetto è servito dall'installazione — l'host lo legge da dove sta — e
quella via non esiste su opencode: senza un deposito il metodo non arriverebbe mai nel progetto, e
l'opencode dichiarato dallo scheletro resterebbe una sede senza servizio.

**How to apply:** i fatti sul **runtime** di opencode sono **letti dal sorgente**
(`.daiku/studies/opencode.md`), non passati dall'host — nessun `opencode run` è stato eseguito — e la
prova del plugin è il suo banco su un `ctx` finto: prima di scriverne uno in un contratto,
dichiararlo un'assunzione ([[come-si-provano-i-fatti-su-claude-code]]). Vedi [[due-host]] per dove i
due host si separano e [[alberatura-pacchetto]] per la mappa delle cartelle.
