---
name: canale-opencode
description: "Su opencode il pacchetto si installa come plugin (`opencode plugin add`) e registra in codice skill, agenti, comandi e guardie — niente scritto nel progetto; init vi scrive solo la chiave di annidamento"
metadata:
  node_type: memory
  type: project
---

**Su opencode il pacchetto si installa come su ogni host.** Il primo gesto è `opencode plugin
add`, che prende il pacchetto dal suo descrittore e lo tiene nella cache dell'host; l'host lo carica
da lì. Il pacchetto **non scrive una riga** nel progetto, e il confine «nessun pacchetto
scrive nel progetto» resta intero su entrambi gli host ([[cosa-claude-code-accetta]]).

**Il descrittore e l'entrypoint.** `plugins/package.json` (name `daiku`, la via dell'entrypoint in
`exports` verso `./plugin.mjs`) e `plugins/plugin.mjs` stanno alla **radice di `plugins/`**, accanto
alla vetrina: `release` li porta su production col resto, ri-radicando `plugins/`. Su `develop` il
descrittore **non porta `version`** — `develop` non porta versione — e la replica la scrive `release`
col numero del manifest ([[canali-e-promozione]]). L'entrypoint calcola la propria cartella con
`import.meta.url` e registra da `<propria cartella>/daiku/`: le skill leggendo ogni
`skills/<nome>/SKILL.md`, gli agenti ogni `agents/opencode/<ruolo>.md`, i nove comandi slash
**derivandoli** dall'`argument-hint` delle nove skill d'ingresso, e le guardie invocando il `setup` di
`hooks/opencode-plugin.mjs`. La registrazione è **codice**, non testo: il metodo resta un corpus di
file identici a quelli di Claude Code.

**Le guardie le porta lo stesso plugin.** Su opencode non c'è un `hooks.json`: l'entrypoint importa
l'adattatore `plugins/daiku/hooks/opencode-plugin.mjs` e ne aggancia il `setup` ai domini vivi
dell'host (`tool.execute.before`, `tool.execute.after`, `session.prompt`, l'evento `session.created`)
— **cinque moduli su sette**, e i due senza evento (`stop-advice`, `subagent-advice`) restano
**dichiarati mancanti**, nel file e nel suo banco ([[guardrail-nascono-spenti]]).

**L'ancora è la stessa di Claude Code.** La skill è registrata dai file del pacchetto, quindi la sua
base directory è `<pkg>/daiku/skills/<nome>` e **due livelli sopra il file** — `<base directory>/../..`
— danno la radice del pacchetto: la **stessa regola di Claude Code**, senza alcun suffisso
([[due-host]]).

**L'annidamento è config di progetto.** opencode limita la profondità dei subagenti con
`experimental.subagent_depth`, e la catena più lunga del metodo — `new-feature → ship-feature →
review → finder`, quattro livelli — ne chiede `3`. Lo scrive `init` come proprio step (`4-bis`, il
programma deterministico `skills/init/depth.mjs`): **sotto `experimental`** (in radice opencode la
scarta in silenzio), **per sola aggiunta**, creando `opencode.json` se manca e **mai** sovrascrivendo
un valore che il progetto dichiara; un file che non parsifica resta intatto e detto. La scansione
elenca la chiave **mancante** sotto `4-bis` e tace sotto qualunque valore presente.

**L'aggiornamento ha un ramo per host.** `.daiku/update.mjs` legge `default_host` di
`.daiku/environment.json` (fallback `claude`): sul ramo opencode risolve la radice del pacchetto
dalla cache dell'host (`opencode debug paths cache`, col `name: "daiku"` a verificarla), disegna il
delta con `opencode plugin check`, chiede con le stesse stringhe del ramo Claude, esegue
`opencode plugin update`, poi lancia `depth.mjs` e `scan.mjs … --host opencode` dalla radice risolta.
Un host che non risponde è **detto, mai indovinato** ([[script-versionati]]).

**Why:** su Claude Code il pacchetto è servito dall'installazione; su opencode serve l'installazione
del plugin con la **registrazione in codice** del corpus, così il metodo non deve più essere scritto
dentro il progetto per esistere lì, e le sedi native e la cartella sorella non vanno tenute in
sincrono.

**How to apply:** i fatti sul **runtime** di opencode sono **letti dal sorgente**
(`.daiku/studies/opencode.md`), non passati dall'host — nessun `opencode run`, `opencode plugin add`
o `plugin list` su un host vero è stato eseguito — e la prova dei moduli è il loro banco su un `ctx`
finto: prima di scriverne uno in un contratto, dichiararlo un'assunzione
([[come-si-provano-i-fatti-su-claude-code]]). Vedi [[due-host]] per dove i due host si separano e
[[alberatura-pacchetto]] per la mappa delle cartelle.
