---
name: canali-e-promozione
description: "il concetto di canale di Daiku — i due rami in `channels`, la guardia che nega il lavoro su produzione, `release` che promuove — e la degradazione §6 per il progetto che non li dichiara"
metadata:
  node_type: memory
  type: project
  originSessionId: f135a876-1ccd-4db0-99e7-6c7abee5c262
  modified: 2026-10-03T17:38:24.082Z
---

**Dal 3 ottobre 2026 il prodotto ha il concetto di canale.** Un progetto che lo adotta tiene **un
solo repository e due rami**: il lavoro vive sul **ramo di sviluppo**, la produzione avanza solo con
un gesto esplicito. I due nomi stanno in `.daiku/project.json`, nel gruppo `channels` — `channels.development`
e `channels.production` — con la loro riga nella tabella §4 di `contracts/project-contract.md` e lo
specchio `schemas/blocks.json` § `params`. Niente di tutto ciò esiste dove il progetto non li
dichiara: §6, e il flusso a un ramo resta quello di prima.

**Il ramo nasce in `init`.** Una terza domanda di *Step 0* — il nome, **proposto `develop`** — e un
passo deterministico, `skills/init/branch.mjs`, che `init` lancia a *Step 3-bis*: crea il ramo se
non c'è e ci si sposta, è **idempotente** (se il ramo c'è lo fa solo checkout), e fallisce per
**albero sporco solo alla creazione** — il rilancio su un repository di lavoro è la norma. Su un
repository **senza commit** si ferma e dichiara: non crea un ramo dal nulla. `channels.production`
è il ramo su cui `init` gira. Porta un banco suo (Git vero su repository usa e getta), aggiunto a
`hooks/self-check.mjs`.

**La guardia del ramo** è il sesto ramo di `hooks/lib/command-guard.mjs`: acceso da
`channels.production` (quindi **nasce spento**, vedi [[guardrail-nascono-spenti]]), legge il ramo
**solo sulle righe che nominano `git`** e per il resto non chiede niente al disco, e nega `git
commit` e `git merge` mentre è attivo il ramo di produzione e `git checkout`/`git switch` **verso**
di esso. Ogni altro ramo — sviluppo e rami del pool `{worktree.branch_prefix}*` — resta legittimo,
quindi la consegna di `ship-feature` non è ostacolata: i suoi commit nascono sui rami del pool e
arrivano su sviluppo per fusione. Il contesto lo porta `loadContext` di `daiku-config.mjs`, che legge
`json.channels`.

**`release` è l'entry point che promuove.** Chiede la versione **una volta sola**, major/minor/patch,
sul **blocco** dei commit accumulati su sviluppo (`git log <prod>..<dev>`), scrive versione e
changelog come **ultimo commit sul ramo di sviluppo** (così la guardia non vede mai un commit sul
ramo di produzione), poi **sposta il ref della produzione** sulla punta dello sviluppo con un
fast-forward locale (`git branch -f`), verificando prima l'antenanza con `merge-base --is-ancestor`:
se la produzione porta commit che lo sviluppo non ha, **fallisce rumorosamente** invece di fondere.
Non pusha mai: il push resta dell'owner ([[push-solo-manuale]]). Il suo blocco di ritorno sta in
`schemas/blocks.json` § `release`.

**`commit` non è toccato** (scheda 9, scelta C). La chiave `channels` è **ortogonale** alla
scrittura di changelog e bump: che il ramo di sviluppo abbia o no un changelog è scelta del
**progetto** — la sua `.daiku/domain/commit-convention.md`, o l'assenza di `{changelog}` — non un
effetto della chiave. Con la convenzione di default («no bump») «sviluppo = main + x commit non
rilasciati» è già vero.

**Punti non provati.** Su **Codex** la guardia del ramo è una promessa: resta `[to verify]` se un
hook di pacchetto giri davvero a runtime (`.daiku/studies/codex-hooks.md`). E va verificato che
`init` e i suoi rilanci lascino sempre la copia principale sul ramo di sviluppo, così che la
fusione della fase 6b non venga negata dalla guardia accesa.

Vedi [[punti-ingresso-prodotto]] per l'undicesimo entry point, [[guardrail-nascono-spenti]] per i
rami accesi e spenti, e [[tre-livelli-di-parametro]] per la sede del valore.
