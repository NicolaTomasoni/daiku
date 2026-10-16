---
name: alberatura-pacchetto
description: "Cosa contiene ogni cartella del repo e a cosa serve — il prodotto, lo sviluppo — con i nomi che si somigliano e non c'entrano niente"
metadata: 
  node_type: memory
  type: project
  originSessionId: 48eaa498-ed6e-4a36-847d-3f8fa95f7f21
  modified: 2026-10-16T22:20:26.094Z
---

Il repo ospita il prodotto Daiku. Il repository è **uno solo** — `NicolaTomasoni/daiku` su GitHub,
con `develop` cantiere, `main` produzione ed `edge` copia del prodotto — e la copia di lavoro sta in
`C:\dev\daiku`. **In radice non entra
nessun file di prodotto**: ci sono le sedi di sviluppo e una cartella,
il cui **contenuto** è per intero la radice di `main` — `plugins/`.

`plugins/` è **insieme marketplace e pacchetto**: la stessa alberatura porta il pacchetto e la sua
vetrina.

## 1. Il prodotto Daiku — `plugins/`

`plugins/daiku/` è il pacchetto vero e proprio: tutto ciò che un utente riceve e installa.

| Dentro il pacchetto | Cosa c'è | Chi lo legge |
|---|---|---|
| `skills/` | i **22 contratti** del metodo, uno per cartella; accanto alla `SKILL.md` di `init` stanno i suoi programmi deterministici — `scan.mjs` (misura cosa manca sul disco prima che `init` scriva), `branch.mjs` e `depth.mjs` (la chiave di annidamento di opencode, [[canale-opencode]]) — col banco che `hooks/self-check.mjs` lancia | l'host |
| `contracts/` | `orchestration.md`, `project-contract.md` | le skill li aprono per path; non sono skill loro stessi |
| `agents/` | `finder` — l'unico subagent a toolset ristretto — con **una resa per host**: la radice per Claude Code (frontmatter `name`/`description`/`tools`), `agents/opencode/` per opencode (`description`, `mode: subagent`, i permessi che negano `edit`); il controllo del corpus impone che ogni host renda **ogni** ruolo | l'host |
| `hooks/` | il wiring `hooks.json`, i **sette hook** in `lib/` e i **due moduli** che importano (`project-root.mjs`, `daiku-config.mjs`); accanto, fuori da `lib/`, `self-check.mjs`, `template-check.mjs` e `README.md`, che sono di chi sviluppa il pacchetto e non si trasportano, e **`opencode-plugin.mjs`** — l'adattatore delle guardie per opencode, che l'entrypoint del pacchetto importa ([[canale-opencode]]) | Claude Code |
| `architect/` | `architect.mjs`: il **valutatore deterministico** — risponde a undici domande meccaniche e tiene l'ordine della catena; `ledger.mjs`: lo **strumento lato disco della review** — legge Git, scrive il ledger e chiede i verdetti al valutatore; `pool.mjs`: il **lato disco del pool dei worktree**; `reconcile.mjs`: il **lato disco della riconciliazione del merge**; `release.mjs`: il **lato disco del rilascio** — costruisce l'albero di production dallo sviluppo su un indice usa-e-getta e muove il ref, senza mettersi mai su production; `cost.mjs`: la **misura deterministica del costo di un giro** — conta da disco le quattro voci (testa, invocazioni, ritorno, sempre-caricato) e vi aggiunge i token dove il ledger li riporta; `view.mjs`: la **vista ridotta deterministica** che un passo consegna a un figlio quando un path non basta — righe intere sotto il tetto dichiarato, col path dell'originale nel marker; `delivered.mjs`: il **lato disco della domanda «questa cartella è già stata consegnata?»** — legge in Git il soggetto `merge: <folder>` che la §6b scrive e ne restituisce lo sha, perché gli artefatti che provano una consegna non li committa nessuno. Ciascuno col suo banco, che `hooks/self-check.mjs` lancia (vedi [[valutatore-deterministico]], [[pool-worktree]], [[canali-e-promozione]], [[costo-di-un-giro]]) | l'agente, che li invoca: non sono hook, nessun `hooks.json` li nomina, e non si installano in un progetto |
| `schemas/` | `blocks.json`: lo specchio controllabile dei blocchi di ritorno — la prosa del nodo resta normativa | i controlli scritti a mano e gli umani che scrivono i nodi |
| `templates/` | gli scheletri che finiscono nel progetto ospite: `init` copia `project/` sotto `.daiku/` e nel file di istruzioni, e `vscode/tasks.json`, che porta il task `daiku: update`. I cinque scheletri `project/documents/` (PRODUCT, BRAND, DOMAIN, STACK, ARCHITECTURE) fanno eccezione: `new-project` li legge in place e scrive i documenti ai path dichiarati in `documents.*` | per lo più nessuno: vengono copiati, non letti in place — tranne i cinque `project/documents/`, che `new-project` legge in place |
| `.claude-plugin/` | il manifest del pacchetto | l'host, all'installazione |

Accanto, nella radice di `plugins/`, stanno la **vetrina** — non è il pacchetto, è il cartello che lo
indica — e il descrittore del plugin di opencode:

- `plugins/.claude-plugin/marketplace.json` — per Claude Code
- `plugins/package.json` e `plugins/plugin.mjs` — il **descrittore** e l'**entrypoint** del plugin di
  opencode: `release` li porta su production col resto, e su opencode registrano in codice skill,
  agenti, comandi e guardie ([[canale-opencode]])

Dice una cosa sola: «qui c'è un pacchetto che si chiama daiku, sta in `./daiku`». Con essa stanno il
`.gitattributes` del prodotto, il suo `.gitignore` e il README pubblico. Il marketplace locale si
registra su `<repo>/plugins`, non sulla radice del repo.

## 2. Lo sviluppo *obbligato* a stare in radice

Non si possono spostare: l'host e git li cercano lì e basta. Oltre a questi, in radice il cantiere
tiene i suoi documenti — i punti aperti, i nuovi sviluppi e i cinque documenti fondativi — e i
`.gitignore` e `.gitattributes` del repository di sviluppo.

- **`CLAUDE.md`** — le istruzioni per chi sviluppa Daiku. Non è Daiku.
- **`.claude/`** — come si lavora *su* Daiku, non come Daiku funziona. Dentro c'è:
  - `orchestration.md` + `commands/` (due comandi: `studia-repository`,
    `translate-skill`) — i soli
    contratti di sviluppo che il prodotto non ha, coi valori scritti per esteso e senza worktree.
    Il resto del metodo sono le skill di Daiku installate dal marketplace, **rilascio compreso**.
    Vedi [[corpus-di-sviluppo]].
  - `settings.local.json` — punta `autoMemoryDirectory` (vedi [[memoria-nel-repo]]).
- **`.github/`** — `workflows/edge.yml`: il workflow che alza `edge` a ogni push su `develop`. GitHub lo vuole
  in radice, ed è del cantiere, non del prodotto.
- **`.vscode/`** — `tasks.json` con gli switch fra backend LLM: tooling personale dell'owner, con
  path della sua home. Non c'entra niente con Daiku.
- **`.daiku/`** — i parametri del **cantiere**, non del prodotto, e versionati come il resto: è
  ciò che accende le guardie di Daiku su questo repository (vedi [[guardie-di-macchina]]), e tiene
  le sedi dei lavori — `features/`, `studies/` e `handoffs/`, come vuole il contratto del prodotto. Il suo
  `project.json` dichiara `plugins/` come codice, `.docs/memory` come memoria e
  `.docs/runtime/review` come ledger; fuori da lì non entra nessun file **nuovo**, in radice e in
  `.claude/` compresi. Vedi [[daiku-versionato]] per la cartella come sede del progetto ospite.

## 3. Lo sviluppo che si è potuto raccogliere

`.docs/` tiene tutto ciò che serve a costruire il prodotto e che *non* era obbligato in radice:

- `memory/` — questa memoria; è versionata come tutto il resto, ma non viene pubblicata
- `runtime/review/` — i ledger dei giri di `review`
- `confronti/` — le letture di repository di terzi fatte a mano, con le voci numerate e la loro
  sede di atterraggio
- `esempi/reforgia/` — dominio e politiche di ReforgIA, come esempio di un livello Dominio
  compilato davvero
- `backup/skill-estratte.md` — il registro ad append di ciò che è stato tolto dalle skill
- `tools/check-topology.mjs` — verifica la topologia del corpus, nel gate e a mano prima del
  rilascio; sta qui e non sotto `plugins/` così non viaggia con ciò che si pubblica
- `tools/check-corpus.mjs` — verifica le nove invarianti che il corpus dichiara in prosa senza che
  nessun controllo le imponesse (caratteri di controllo, chiavi citate e specchio
  `schemas/blocks.json`, path interni, blocchi json, modelli nominati dalle skill, riga §5.1,
  toolset degli agenti, vocabolario dei ruoli, clausola `--no-ask` che le carte lascia senza
  `Choice:`); ha il suo banco in `--self-check`, che accanto al totale elenca le regole
  `never_red`
- `tools/check-marketplace.mjs` — verifica la vetrina del repository pubblicato: che sia leggibile
  e che ogni voce risolva a una cartella vera dentro l'albero, che ne porti il manifest; ha il suo
  banco in `--self-check`. È il solo controllo che guarda la vetrina,
  e copre il punto in cui il repository di `multica-ai/andrej-karpathy-skills` è inciampato
- `tools/studia-repository/corsa.mjs` — l'attrezzo deterministico del comando
  `studia-repository`: legge l'elenco, apre la cartella della corsa e ne chiude il gate, col suo
  banco (`--self-check`)
- `tools/` — il controllo che nessuno script del cantiere invochi un push (`check-no-push.mjs`),
  accanto ai controlli del corpus e della vetrina, e `macchina/`,
  i sorgenti delle guardie di macchina (vedi [[guardie-di-macchina]]). **Niente qui pubblica,
  salvo il workflow di `edge` in radice**: il rilascio lo fa `daiku:release`, e il push di `develop` e di
  `main` resta dell'owner —
  [[push-solo-manuale]] e [[pubblicazione-su-github]]

## I nomi che si somigliano e non c'entrano niente

È la parte che tradisce: due nomi quasi identici fanno lavori diversi.

| Nome | Dov'è | Cos'è davvero |
|---|---|---|
| `.claude-plugin/` | in `plugins/` | la **vetrina** Claude Code |
| `.claude-plugin/` | in `plugins/daiku/` | il **manifest** del pacchetto |
| `.claude/` | radice del repo | come lavora l'owner, niente a che vedere col prodotto |

La regola che scioglie tutto: **in `plugins/` `.claude-plugin/` è la vetrina; dentro
`plugins/daiku/` è il pacchetto.**

## Le tre regole di collocazione

Verificate sul validatore dell'host.

- Una cosa che l'host deve vedere va in `skills/<nome>/SKILL.md`: è il primitivo, e non annida.
- Una cosa che le skill leggono ma che skill non è va in `contracts/`, **mai** sotto `skills/`:
  Claude Code scandisce anche le sottocartelle che iniziano col punto, quindi `skills/.contracts/`
  diventerebbe una skill rotta.
- Una cosa che vive nel progetto ospite va in `templates/`, perché **l'host non lascia
  che un pacchetto scriva nel progetto**: la deve scrivere un comando che l'utente lancia.

Cosa esce e cosa resta **non** lo decide il `.gitignore` — né quello di radice, che esclude i file
di macchina dello sviluppo, né quello che la cartella di prodotto porta per la radice di `main`: lo
decide il ramo. Il rilascio prende il contenuto di `plugins/` e nient'altro. Vedi
[[si-pubblica-solo-il-prodotto]] e [[pubblicazione-su-github]]. Per il difetto che
la migrazione a `skills/` ha fatto emergere, vedi [[frontmatter-skill-va-quotato]].
