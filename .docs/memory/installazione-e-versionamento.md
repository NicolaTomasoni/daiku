---
name: installazione-e-versionamento
description: "I comandi di installazione e aggiornamento su Claude Code, cosa governa l'aggiornamento (il `version` del manifest), da dove si legge la versione che sta arrivando senza installarla, e come si installa un ref diverso dal default"
metadata:
  node_type: memory
  type: project
  originSessionId: 74fa8bc9-dbb1-4c77-bf91-e6ec34544097
  modified: 2026-10-16T14:28:39.778Z
---

**I comandi, verificati il 18 settembre 2026.** `/plugin marketplace add <owner>/<repo>`,
`/plugin install daiku@<marketplace>`, `/plugin update daiku@<marketplace>`, e in non interattivo
`claude plugin install daiku@<marketplace> --yes`.

**Cosa governa l'aggiornamento: il campo `version` del manifest, in semver stretto.** Si bumpa
quello e l'host tira la versione nuova; finché non si bumpa, nessuno aggiorna. Una versione
**cambiata** basta a far ricopiare il plugin all'host: verificato il 5 ottobre 2026, non serve un
incremento ordinato né un numero più alto, basta che differisca da quella installata. Claude Code
tiene ogni versione in una cartella propria e conserva le orfane per 14 giorni. Un manifest senza
`version` non ferma il validatore: `claude plugin validate plugins/daiku` passa con l'avviso
`version: No version specified`, provato il 16 ottobre 2026.

**Un marketplace può vivere in una cartella locale, non solo in un repository git.** Verificato il
5 ottobre 2026 su questa macchina: in `extraKnownMarketplaces` di Claude Code la voce `daiku` ha
`source: { "source": "directory", "path": "C:\\dev\\daiku\\plugins" }`, e ciò che l'host installa è
l'albero di `develop` stesso. Nessun clone e nessun ref: è la via per provare il pacchetto in
sviluppo senza passare da git. `develop` non porta più un numero di versione (vedi
[[pubblicazione-su-github]]): quale numero l'host confronti per una cartella locale senza `version` non
è verificato; per seguire il lavoro da fuori c'è `edge` ([[edge-copia-del-prodotto]]).

**L'aggiornamento da riga di comando è in due tempi**, verificato il 30 settembre 2026 su `claude`
2.1.276 con `--help`: `claude plugin marketplace update [name]` («Update marketplace(s) from their
source»), poi `claude plugin update <plugin>` («Update a plugin to the latest version (restart
required to apply)»). Il pacchetto li porta al progetto ospite in quest'ordine, come task VS Code
`daiku: update` che `init` deposita. Che `plugin update` da solo non rinfreschi il catalogo del
marketplace è un'assunzione, non una prova.

**Le due versioni si leggono senza installare niente**, verificato il 1° ottobre 2026 su `claude`
2.1.276. Quella **in place** con `claude plugin list --json` (`id`, `version`, `installPath`).
Quella **che sta arrivando** dal catalogo: `claude plugin marketplace list --json` porta
`installLocation`, e lì dentro la copia del repo pubblicato tiene il catalogo
(`.claude-plugin/marketplace.json`, la cui voce dà il `source` del pacchetto) e il manifest
`<source>/.claude-plugin/plugin.json`, che dichiara la versione l'host installerebbe. È da lì che
`templates/project/update.mjs` disegna `1.0.6 >>> 1.0.7` prima di chiedere, e il rinfresco del
catalogo — che riscrive solo quella copia, mai il pacchetto installato — viene prima della domanda.
`claude plugin update <plugin> --json` stampa una sola riga macchina, invece del messaggio umano, con
`updateOutcome`, `oldVersion` e `newVersion`: è la versione arrivata davvero, che il solo
`plugin list` non dà nello stesso istante.

**Un ramo diverso dal default si installa con una ref, e il default resta chi era.** Verificato il
1° ottobre 2026 su `NicolaTomasoni/daiku` puntando a un branch inesistente, così il fallimento
non registra niente: `claude plugin marketplace add "https://github.com/<owner>/<repo>.git#<ref>"`
risponde «Remote branch <ref> not found in upstream origin», cioè la ref la capisce e il trasporto è
sano: manca solo il branch. La forma breve `<owner>/<repo>#<ref>` **non** va su questa macchina —
passa da SSH e muore su `No ED25519 host key is known for github.com` — mentre il marketplace già
registrato si aggiorna senza problemi (`claude plugin marketplace update daiku`). Chi installa senza
ref prende il default branch: il comando di installazione non cambia, e **oggi quel default è
`main`**, l'unico ramo da cui si installa — vedi [[pubblicazione-su-github]].

**Cambiare ref su una macchina e' remove + add + install, in quest'ordine.** Verificato il
1° ottobre 2026 su `claude`: `marketplace add "https://github.com/<owner>/<repo>.git#<ref>"` clona
e valida («Successfully added marketplace: daiku (declared in user settings)»), ma **togliere un
marketplace porta via il plugin che da li' era installato** — `plugin update daiku` risponde
«Plugin "daiku" is not installed». Quindi il giro e' `marketplace remove`, `marketplace add` con
la ref, e `plugin install daiku@daiku`. Il marketplace sta nelle impostazioni dell'utente, quindi
la scelta vale per tutta la macchina, non per un progetto.

**Su questa macchina la voce `daiku` è `#edge` dal 16 ottobre 2026**, provato con `claude` 2.1.301: `marketplace
remove daiku` (porta via `daiku@daiku`, come sopra), `marketplace add "https://github.com/NicolaTomasoni/daiku.git#edge"`,
`plugin install daiku@daiku --json`. Il plugin utente passa da cartella locale a `1.2.3-edge.5+859fe3a`, e
`C:\dev\daiku\plugins` non è più la sorgente. Per tornarci: `marketplace remove daiku`, `marketplace add
"C:\dev\daiku\plugins"`, `plugin install daiku@daiku`. È la scelta dell'owner del 16 ottobre 2026, per daiku e reforgia.

**Why:** la forma breve `owner/repo` è quella che l'host accetta per un marketplace, e vale solo per
GitHub: è ciò che tiene le istruzioni di installazione corte — vedi [[pubblicazione-su-github]].

Nota pratica: il repository è pubblico, quindi installare Daiku non richiede credenziali git. Per provare il
pacchetto in locale conviene comunque un marketplace da path, che non passa da git.

Vedi [[cosa-claude-code-accetta]].
