---
name: canali-e-promozione
description: "il concetto di canale di Daiku — i due rami in `channels`, la guardia che nega il lavoro su produzione, e `release` che scrive il rilascio su production senza mettercisi mai"
metadata:
  node_type: memory
  type: project
  originSessionId: f135a876-1ccd-4db0-99e7-6c7abee5c262
  modified: 2026-10-05T00:00:00.000Z
---

**Il prodotto ha il concetto di canale** (dal 3 ottobre 2026, ridisegnato il 5). Un progetto che lo
adotta tiene **un solo repository e due rami**: il lavoro vive sul **ramo di sviluppo**, la
produzione è una **linea di rilasci**. I due nomi stanno in `.daiku/project.json`, nel gruppo
`channels` — `channels.development` e `channels.production` — con la loro riga nella tabella §4 di
`contracts/project-contract.md` e lo specchio `schemas/blocks.json` § `params`. Niente di tutto ciò
esiste dove il progetto non li dichiara: §6, e il flusso a un ramo resta quello di prima.

**Il ramo nasce in `init`.** Una terza domanda di *Step 0* — il nome, **proposto `develop`** — e un
passo deterministico, `skills/init/branch.mjs`, che `init` lancia a *Step 3-bis*: crea il ramo se
non c'è e ci si sposta, è **idempotente**, e fallisce per **albero sporco solo alla creazione**. Su
un repository **senza commit** si ferma e dichiara. `channels.production` è il ramo su cui `init`
gira. Porta un banco suo, aggiunto a `hooks/self-check.mjs`.

**La guardia del ramo** è il sesto ramo di `hooks/lib/command-guard.mjs`: acceso da
`channels.production` (quindi **nasce spento**, vedi [[guardrail-nascono-spenti]]), legge il ramo
**solo sulle righe che nominano `git`**, e nega `git commit` e `git merge` mentre è attivo il ramo
di produzione e `git checkout`/`git switch` **verso** di esso. Ogni altro ramo — sviluppo e rami del
pool `{worktree.branch_prefix}*` — resta legittimo, quindi la consegna di `ship-feature` non è
ostacolata: i suoi commit nascono sui rami del pool e arrivano su sviluppo per fusione.

**Il rilascio non ha bisogno che la guardia si allenti, e non la allenta.** Production avanza per
rilascio, e il rilascio *scrive* lì: se scrivere volesse dire starci, il divieto lo renderebbe
impossibile. Non è così. `architect/release.mjs` costruisce il commit su un **indice usa-e-getta** e
muove il ref con `update-ref`: `git commit` non gira mai su production e il ramo non viene mai
check-out-ato. La guardia resta intera e il rilascio è una scrittura di cui non ha niente da dire.
È la stessa tecnica con cui `ledger.mjs` fotografa un albero.

**`release` è l'entry point che rilascia.** Chiede la versione **una volta sola**, major/minor/patch,
sul **blocco** dei commit accumulati dall'ultimo rilascio **pubblicato**; il blocco parte
dall'ancora che il rilascio precedente ha registrato come trailer `Development:` nell'atto stesso di
scriverlo. Poi costruisce l'albero di production — sviluppo ri-radicato a `{release.source}`, più
versione e changelog — e lo scrive lì. Finché il commit in testa a production è una **bozza** (un
rilascio che nessun upstream porta) il rilascio lo **sostituisce**: i commit nuovi si aggiungono a
quella versione invece di aprirne una. `action: "dry"` fa tutto tranne muovere il ref. Non pusha
mai: [[push-solo-manuale]].

**`commit` non scrive più versione né changelog dove i canali sono dichiarati.** Non è una
conseguenza automatica della chiave: è che su `develop` non esistono — i manifest stanno al
segnaposto `0.0.0` e `{changelog}` non è un file di sviluppo, perché una sezione nasce al rilascio e
non torna indietro. Dove `channels.production` non è dichiarato non c'è rilascio, e `commit` resta
l'unico che possa muovere il numero: continua a fare com'era.

**Punti non provati.** Su **Codex** la guardia del ramo è una promessa: resta `[to verify]` se un
hook di pacchetto giri davvero a runtime (`.daiku/studies/codex-hooks.md`). E va verificato che
`init` e i suoi rilanci lascino sempre la copia principale sul ramo di sviluppo.

Vedi [[punti-ingresso-prodotto]], [[guardrail-nascono-spenti]], [[valutatore-deterministico]] per
gli altri programmi di `architect/`, e [[tre-livelli-di-parametro]] per la sede del valore.
