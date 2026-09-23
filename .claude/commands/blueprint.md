---
description: 'Dal documento di decisione e dalla soluzione scelta produce un brief di esecuzione autonoma (2. blueprint.md) e si ferma lì, senza eseguire'
argument-hint: '[cartella] [soluzione scelta]'
---

È il passo a valle di `decision-doc`. Ricevi la cartella che contiene il documento di decisione
(`1. decision-doc.md`) e l'indicazione della **soluzione scelta**. Produci **un solo file**,
`2. blueprint.md`, che è un **brief di esecuzione autonoma**: contiene **solo** le informazioni
necessarie alla soluzione scelta, e una **sezione Memoria** con un piano di implementazione
pre-fatto, diviso in task ordinati. Ti **fermi al brief**: non esegui il piano e non lanci nessun
esecutore.

Il file serve a un *futuro* esecutore, che non sa nulla di come è nato: deve istruirlo a portare a
termine il lavoro **dall'inizio alla fine in autonomia, senza chiedere altro all'owner** — perché
ogni specifica è già definita nel documento e la preferenza è già stata espressa — e a **compilare
la Memoria man mano** che esegue i task.

## Input: cartella e soluzione scelta

Argomenti: `$ARGUMENTS`

- Se manca la cartella, **chiedila**. Se non esiste, segnalalo e fermati.
- Cerca `1. decision-doc.md` nella cartella. Se non c'è, chiedi quale documento usare prima di
  procedere.
- **Identifica la soluzione scelta** confrontando l'indicazione ricevuta con le decisioni del
  documento. Se l'indicazione è ambigua o assente, **chiedi quale opzione è stata scelta**,
  elencando le decisioni e le opzioni trovate. Questo — insieme alla cartella mancante, al documento
  non trovato e alle scelte reciprocamente incompatibili: i quattro casi elencati in questa sezione,
  e nessun altro — è l'**unico** momento in cui è lecito chiedere. Il brief che produci deve invece
  rendere l'esecuzione successiva autonoma.
- Se le decisioni nel documento sono più d'una, raccogli **tutte** le scelte (una per decisione)
  prima di generare il brief, e **verifica che siano reciprocamente coerenti**. Se sono
  incompatibili, segnalalo e chiedi come risolvere.
- Con la cartella ricevi anche `sviluppo/memory/MEMORY.md` e i **path** delle memorie che il
  perimetro tocca, da aprire prima di decidere (§4.1 di `.claude/orchestration.md`). Se il chiamante
  non te li passa, apri l'indice e scegli tu: un brief che ignora un fatto già accertato lo fa
  riscoprire all'esecutore a sue spese.

## Il terreno su cui il piano va ancorato

Il perimetro di lavoro è **`plugins/daiku/`**, e nient'altro. Prima di congelare il piano, leggi
questi, perché un brief che non li ha letti produce task che non reggono:

- **`CLAUDE.md`** — gli invarianti di sviluppo. Due contano sempre: il prodotto è
  `plugins/daiku/` e nient'altro, e un file nuovo lì dentro **si pubblica** — il `.gitignore` non è
  più il confine e non c'è nessuna lista di ammissione da aggiornare. Un task che crea un file fuori
  da `plugins/` va detto esplicitamente; un task che ne crea uno dentro **pubblica**, e il brief deve
  dirlo.
- **`sviluppo/RICOGNIZIONE.md`** — i fatti verificati sui due host. Se il piano tocca manifest,
  marketplace, frontmatter di una skill o collocazione di un file, il capitolo 3 dice già cosa i
  validatori accettano e rifiutano.
- **I file che la soluzione tocca**, letti davvero. Il documento di decisione è ad alta astrazione
  e può non riflettere lo stato attuale del pacchetto.

**Tre fatti di questo repository che un piano dimentica volentieri:**

1. `description` e `argument-hint` nel frontmatter di una `SKILL.md` vanno **quotati con apice
   singolo** (l'apice interno si raddoppia). Senza quote il guasto è silenzioso: la skill si carica
   con i metadati vuoti e nessuno la trova più per pertinenza.
2. I contratti si citano fra loro **per path**, non per nome: i due host nominano le skill in modo
   incompatibile.
3. Il `.gitignore` esclude soltanto `.claude/settings.local.json`: **non è il confine di ciò che
   si pubblica**. Il confine è la lista di copia dello script di rilascio, che prende `plugins/` in
   blocco, quindi un file nuovo sotto il pacchetto esce al primo commit che lo contiene.

## Principi

1. **Solo ciò che serve.** Nel brief entra solo l'informazione necessaria a realizzare la soluzione
   scelta: la decisione pertinente, l'opzione scelta, la sua motivazione, i vincoli, i criteri di
   completamento. **Scarta** le opzioni non scelte e le decisioni non correlate.
2. **Niente perdita di specifiche.** Tutto ciò che serve a eseguire deve essere *dentro*
   `2. blueprint.md` (o puntare esplicitamente a un file di riferimento). L'esecutore non deve
   tornare al documento di decisione né all'owner per recuperare un dettaglio.
3. **Ancora il piano al terreno reale.** Leggi i file coinvolti e verifica che le assunzioni reggano
   (i file esistono, le sezioni sono quelle attese, il punto d'innesto è dove credi). Se la realtà
   diverge dal documento, **adatta i task** e annota la divergenza.
4. **Verifica osservabile, non auto-dichiarata.** Ogni task ha un **criterio di verifica
   eseguibile**: il controllo osservabile più forte disponibile per quel tipo di lavoro. Su questo
   repository i controlli reali sono pochi e vanno usati:
   - `claude plugin validate plugins/daiku` — per tutto ciò che tocca manifest, skill, frontmatter;
   - `python ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/daiku` — per
     le chiavi di manifest e le skill viste da Codex (richiede `pyyaml`);
   - `node plugins/daiku/hooks/lib/<hook>.mjs --self-check` — per i tre hook, con il totale contato;
   - `git check-ignore -v <path>` — per verificare che un file nuovo esca o resti fuori da git;
   - `grep`/`rg` mirato — per un rimando fra contratti, una sezione citata, una chiave.

   Mai «fatto quando sembra fatto»: il verdetto è del controllo, non dell'esecutore.
5. **Verifica di chiusura obbligatoria.** Gli ultimi task del piano sono sempre una verifica di
   chiusura **mirata al perimetro toccato** e un'auto-review del risultato contro i criteri di
   completamento iniziali. **Il gate di pacchetto non entra nel piano**: è di `review`, che lo
   esegue sempre sul diff (`.claude/orchestration.md` §7). Ripeterlo qui costa e non aggiunge nulla.
6. **Ancorato agli input.** Non inventare specifiche, vincoli o task che il documento, i file di
   riferimento e il pacchetto non giustificano. Se un dettaglio operativo manca davvero, scrivilo
   come **assunzione esplicita** dentro il brief.
7. **Tu prepari, non esegui.** Non modificare `plugins/daiku/`. Puoi e devi **leggerlo** per
   ancorare il piano (principio 3), ma il tuo unico output scritto è `2. blueprint.md`.

## Procedura

1. **Risolvi la cartella** e apri `1. decision-doc.md`. Individua le decisioni e le opzioni.
2. **Fissa le scelte** da `$ARGUMENTS` (o chiedendo, vedi *Input*).
3. **Distilla la soluzione scelta**: da cosa va fatto e perché, ai vincoli, ai criteri di
   completamento. Tieni solo il materiale dell'opzione scelta.
4. **Ancora al terreno reale** (vedi la sezione omonima). Raccogli i path e i dettagli concreti che
   serviranno all'esecutore.
5. **Costruisci il piano**: scomponi la soluzione in task ordinati e verificabili. Ogni task = un
   passo eseguibile + un **controllo osservabile** che lo dichiara concluso. **Apri** il piano con un
   task di ricognizione e **chiudilo** con la verifica di chiusura obbligatoria.
6. **Scrivi `2. blueprint.md`** nella cartella di input, con la struttura sotto. Includi la riga di
   **provenienza**. Se esiste già, **non** rieseguire il brief e non scriverne un secondo: segnalalo
   e chiudi col path esistente. Salva in **UTF-8** con gli accenti italiani intatti.
7. **Riepiloga** in poche righe: la soluzione scelta e i task del piano in ordine.
8. **Fermati qui.** Non eseguire il piano e non lanciare nessun esecutore.

## Struttura del file prodotto (`2. blueprint.md`)

Il file è scritto **rivolgendosi all'esecutore** (seconda persona, imperativo operativo).

```text
# Esecuzione: <nome della soluzione scelta>

> Origine: <documento, versione/data> · Generato: <data>

## Mandato                          ← istruzioni di autonomia per l'esecutore
- Esegui questo piano dall'inizio alla fine **in autonomia**.
- **Non chiedere informazioni all'owner**: ogni specifica è già qui e la
  scelta è già stata fatta. Se un dettaglio sembra mancare, deducilo da questo
  brief e dai file di riferimento citati, non interrompere.
- Fermati e chiedi **solo** davanti a un vero blocco (azione distruttiva o
  irreversibile non giustificata dal brief, o contraddizione interna insanabile).
- **Questo file è la fonte di verità.** Se riprendi dopo un'interruzione o una
  compattazione del contesto, **rileggilo per intero** (stato dei task + Diario)
  prima di continuare.
- Segui i task **nell'ordine** dato. Puoi **adattare il piano** solo quando
  l'esecuzione fa emergere fatti nuovi che lo rendono necessario: in tal caso
  aggiorna i task e **scrivi nel Diario perché**.
- Aggiorna la **Memoria** man mano che procedi: spunta i task, annota decisioni,
  risultati e problemi.

## Vincoli e perimetro              ← guardrail per l'esecuzione autonoma
- Il perimetro di scrittura è `plugins/daiku/`. Ogni file fuori di lì che il
  piano tocca è elencato qui sotto, uno per uno, con il perché.
- Modifiche chirurgiche: tocca solo ciò che serve alla soluzione. Niente
  riscritture o miglioramenti fuori scope.
- Rispetta `CLAUDE.md`: il prodotto è `plugins/daiku/` e nient'altro; un file
  nuovo sotto `plugins/` **si pubblica** al primo commit che lo contiene, e
  l'unico modo di non pubblicarlo è non metterlo lì.
- Niente operazioni Git distruttive o remote: nessun `push`, nessuna PR,
  nessun `reset --hard` non giustificato.
- Non fare (non-goals): <elenca ciò che è esplicitamente fuori da questa soluzione>

## La soluzione scelta              ← solo l'info necessaria, distillata
- Cosa va fatto e perché (la decisione e l'opzione scelta)
- Vincoli e specifiche rilevanti
- Cosa cambia per chi installa il pacchetto (se cambia)
- Criteri di completamento
- Assunzioni esplicite
- File di riferimento e punti del pacchetto utili (path dalla radice del repo)

## Memoria — piano e diario di esecuzione   ← piano pre-fatto, da compilare
   Stato: [ ] da fare · [~] in corso · [x] fatto

   - [ ] Task 0 — Ricognizione: verifica sul campo le assunzioni residue del
         brief (i file, le sezioni e il punto d'innesto esistono come previsto).
         Verifica: <controllo osservabile; se diverge, adatta il piano e annota>
         Note:
   - [ ] Task 1: <passo eseguibile>
         Verifica: <controllo osservabile: validate/self-check/grep/comando>
         Note: (compila durante l'esecuzione)
   - [ ] Task 2: ...
         Verifica: ...
         Note:
   ...
   - [ ] Task N — Verifica di chiusura: il controllo più forte mirato al perimetro
         toccato, e auto-review del risultato contro i criteri di completamento.
         Il gate di pacchetto non va qui: è di `review`.
         Verifica: il controllo passa; ogni criterio di completamento soddisfatto.
         Note:

   ### Diario
   (Appendi qui, in ordine, cosa hai fatto, le decisioni prese, le deviazioni dal
   piano e il perché, gli intoppi. Tieni allineato lo stato dei task qui sopra.)
```

Regola di taglio: chi legge `2. blueprint.md` deve poter eseguire l'intera soluzione **senza**
aprire altri documenti se non i file di riferimento esplicitamente citati, e **senza** chiedere
nulla all'owner.

## Cosa restituisci

Invocato a mano, basta il riepilogo in chat. **Invocato dentro una catena** — la fase Brief di
`deliver-feature` — chiudi con questo blocco, che è il solo formato su cui il chiamante decide se
proseguire:

```json
{"ok": true, "brief_path": "<path di 2. blueprint.md>", "pubblica": ["<file nuovo sotto plugins/ che il piano introduce, uno per riga>"], "detail": "<se ok=false, il motivo esatto>"}
```

`pubblica` è vuoto nel caso normale. Non è un campo di cortesia: un file nuovo sotto `plugins/` esce
a chiunque aggiunga il marketplace, e questa è l'unica fase della catena che sa in anticipo che ne
nascerà uno.

Se `2. blueprint.md` esisteva già, **non** rieseguire il brief: `ok: true` col path esistente.

Lo schema sta qui, nel file del nodo che lo produce, e chi ti invoca lo cita invece di ricopiarlo
(§4.2 di `.claude/orchestration.md`).
