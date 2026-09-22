---
description: 'Ciclo di review su un diff di plugins/daiku — baseline congelata, giri che si fermano quando il pacchetto smette di cambiare, ledger dei rilievi già giudicati. Gate una volta all''uscita, poi il commit, che chiude sempre il ciclo salvo --no-commit.'
argument-hint: '[base-ref | path a "4. review-notes.md"] [--giri N] [--effort low|medium|high] [--no-commit]'
---

Sei il **motore di un ciclo di review** su un diff. Un giro è scope → finder → applicazione dei fix;
il ciclo decide da sé quanti giri fare, guardando cosa il giro ha appena prodotto. Poi il gate, una
volta sola. Il commit, salvo `--no-commit`. Orchestri tu, delegando ogni fase a un subagent secondo
`.claude/orchestration.md`.

Questo file è la **fonte unica** della disciplina di review dello sviluppo di Daiku:
`deliver-feature` lo esegue nella sua fase Review. Se cambia la review, si tocca qui e basta.

**Perché è un ciclo e non una passata.** I fix che l'applicatore scrive sono materiale nuovo che
nessun finder ha visto: per costruzione, un giro che applica fix si lascia dietro un perimetro non
revisionato, e il gate verifica che il pacchetto validi, non che i contratti dicano il vero. È la
classe di difetto che nessuna singola passata può trovare — una correzione che ne rompe un'altra — e
l'unico modo di vederla è rivedere i fix.

## Il perimetro di questo progetto

**Scope: `plugins/daiku/`, e nient'altro.** Nessun file esterno entra nei finder o nei fix, anche se
modificato, non tracciato o citato nelle review-notes. `CLAUDE.md`, `sviluppo/` e `.claude/` sono di
`update-memory`, che il contratto di commit delega da sé.

Cosa c'è dentro quel perimetro, perché i finder guardino la cosa giusta:

| Cosa | Dove | Che difetto ci vive |
|---|---|---|
| contratti in prosa | `skills/**/SKILL.md`, `contratti/*.md` | rimandi a file o sezioni che non esistono, due contratti che dichiarano la stessa cosa in modo diverso, uno schema di ritorno ricopiato e divergente, un modello nominato dentro una skill, frontmatter non quotato |
| manifest e vetrine | `.claude-plugin/`, `.codex-plugin/` | chiavi che un validatore rifiuta, versione fuori sync fra i due manifest, `source` che punta altrove |
| codice eseguibile | `hooks/lib/*.mjs`, `tools/*.py` | bug veri: logica, path risolti male, banchi `--self-check` che contano meno di quello che dichiarano |
| template | `templates/**` | valori di un altro progetto e path di questa macchina, che al rilascio escono così come sono |
| documentazione del prodotto | `README.md` | dice del pacchetto qualcosa che il pacchetto non fa |

## Input

Argomenti: `$ARGUMENTS`. Il primo può essere un **base-ref**, il **path a `4. review-notes.md`**
prodotto da `execute`, o vuoto.

- **Path a `4. review-notes.md`** (o alla cartella che lo contiene): verifica che esista; il
  base-ref lo dichiara quel file.
- **Base-ref** (branch, tag, SHA, es. `main`): base del diff.
- **Vuoto**: le modifiche non committate sotto `plugins/daiku/` rispetto a `HEAD`, incluse le non
  tracciate.
- **`--giri N`** (opzionale): tetto esplicito, per troncare il ciclo a mano. Senza, il numero di giri
  lo decide l'andamento e l'unico tetto è il guardrail a `6`.
- **`--effort low|medium|high`** (opzionale): profondità dei finder. Default `medium`. Su un
  perimetro puntuale `high` produce soprattutto rilievi incerti da scartare; su un diff che
  attraversa più contratti si ripaga.
- **`--no-commit`** (opzionale): sopprime il commit di chiusura, e il ciclo si ferma al report. Lo
  passa **chi committa da sé** — `deliver-feature`, che ha una fase di commit propria — non chi ha
  un dubbio sul diff.
- Se il primo argomento non risolve a un base-ref o a un path valido, chiedi — non indovinare.

## Prima di iniziare

Leggi `.claude/orchestration.md`: ruoli, delega, concorrenza, e la §7 che porta il **gate**. Ogni
fase qui sotto dichiara il proprio ruolo e tu risolvi il modello con la regola della sua §2 — mai da
qui.

Il ciclo gira sulla **working tree principale**, sul branch corrente: questo corpus non usa
worktree (`.claude/orchestration.md`, § *Questo corpus non è il prodotto*).

## Preparazione — una volta sola

### Scope — ruolo **worker**

Subagent che calcola lo scope con Git reale. Non ha un contratto proprio da leggere: tutto ciò che
deve fare sta nel prompt, e nel prompt ci metti il **base-ref** di questa esecuzione, il pathspec
obbligatorio `plugins/daiku/`, i tre comandi qui sotto, il blocco da restituire e il vincolo di
**sola lettura**, che nessuno strato dell'harness impone a chi ha `Bash`.

I comandi:

```bash
git status --porcelain -- plugins/daiku/
git diff --stat <base> -- plugins/daiku/
git ls-files --others --exclude-standard -- plugins/daiku/
```

Mai includere file esterni a `plugins/daiku/`.

```json
{"base_ref": "<ref>", "files": ["<path>"], "nuovi": ["<path non ancora tracciato>"], "hooks_toccati": false}
```

`nuovi` sono i file che `git ls-files --others` riporta: entrano nello scope come gli altri, e
servono al gate e alla chiusura, perché un file nuovo sotto `plugins/` **si pubblica**.
`hooks_toccati` è `true` se almeno un file dello scope sta sotto `plugins/daiku/hooks/`: decide se i
tre `--self-check` entrano nel gate.

Normalizza i path con slash `/` e scarta tutto ciò che non inizia per `plugins/daiku/`. **Se non
resta alcun file, fermati**: non c'è nulla da rivedere, dillo e chiudi.

### Baseline e ledger

1. **Congela la baseline**: `git rev-parse <base-ref>` → `BASE`. Tutti i giri usano questo SHA, mai
   un `HEAD` ricalcolato. I fix che applichi entrano nel diff: se ricalcolassi la base a ogni giro,
   lo scope si sposterebbe sotto i piedi al ciclo.

2. **Apri il ledger**: `sviluppo/runtime/review/review-ledger-<BASE breve>-<HHMMSS di avvio>.json`
   (le prime sette cifre dello SHA, l'orario di avvio), creando la cartella se non esiste — alla
   prima review di questo repository non c'è. È il file che rende economici i giri successivi. Il nome porta baseline e orario perché più review possono girare nella stessa
   sessione. La sede è fuori da git per costruzione, ma **stabile**: non a scadenza di sessione.

   **Il ledger dichiara di chi è.** Alla riga `base` si affianca `item`: la **cartella di lavoro**,
   normalizzata con slash `/`, quando l'input era `4. review-notes.md` o la cartella che lo
   contiene; `null` su una review lanciata a mano su un base-ref nudo. La baseline **da sola non
   identifica una review**.

   **Non si riapre mai un ledger che hai trovato da solo.** Si riapre solo quello il cui path ti è
   stato consegnato nel prompt da chi ti invoca, e solo se **entrambi** i campi coincidono: il
   `base` con il `BASE` di questa esecuzione, e l'`item` con il lavoro che stai rivedendo. In quel
   caso riparti dal giro successivo all'ultimo registrato, con i suoi applicati e scartati già in
   mano. Senza quel path, ledger nuovo.

   **Se i candidati restano più di uno, non si sceglie**: ledger nuovo, e lo dichiari in chiusura.
   Vale anche quando il ledger consegnato non porta `item`. Aprirne uno nuovo costa un triage;
   prendere quello sbagliato porta ai finder gli `scartati` di un altro diff e fa girare
   `su_fix_precedente` e `oscillazione` contro le stringhe di un altro lavoro — cioè rompe in
   silenzio i due segnali su cui il ciclo decide.

   Il path del ledger entra nel blocco di ritorno (§ *Esito*): senza, una review interrotta al
   quarto giro riparte da zero.

```json
{"base": "<sha>", "item": "<cartella di lavoro, o null>", "giri": [{"n": 1, "finder_tornati": 2, "finder_mancati": 0, "applicati": [{"file": "", "simbolo": "", "ancora": "", "riga": 0, "cosa": "", "grave": true, "su_fix_precedente": false}], "scartati": [{"file": "", "simbolo": "", "riga": 0, "perche": ""}], "da_confermare": [], "oscillazione": [{"file": "", "simbolo": "", "ancora_attuale": "", "ancora_precedente": ""}], "verdetto": "continua|fermati", "perche": ""}], "uscita": null, "gate": null, "gate_detail": null}
```

### Il ledger conserva anche ciò che blocca, non solo ciò che fa ripartire

I `giri` fanno ripartire il ciclo; `uscita`, `gate`, `gate_detail` e `finder_mancati` sono ciò su cui
il **commit** si ferma. Senza di essi una ripresa li perde, e li perde in silenzio.

- **`finder_mancati` si scrive nel giro in cui è successo**, subito. Un finder che non torna è un
  finder che non ha girato su quel diff, e nessuno ci ripasserà.
- **`uscita`, `gate` e `gate_detail` si scrivono appena li hai**, non alla fine insieme al report.
  Restano `null` finché quel passo non è girato, ed è quella distinzione a rendere la ripresa
  possibile.
- **Alla ripresa non si rifà ciò che il ledger dichiara già fatto.** Se l'ultimo giro registrato
  porta `verdetto: "fermati"`, il ciclo era già uscito: non aprire un altro giro — salta al primo
  passo che nel ledger è ancora `null`, nell'ordine gate → chiusura.

### Come si identifica un fix, fra un giro e l'altro

**Mai per numero di riga.** Un fix sposta tutto ciò che sta sotto di sé: al giro 3 «la riga 88 che
avevo corretto» non è più la riga 88, e i due segnali su cui questo ciclo decide —
`su_fix_precedente` e l'uscita `oscillazione` — scatterebbero a caso o non scatterebbero mai.

Ogni fix si registra con due ancore che sopravvivono ai giri successivi:

- **`ancora`** — il testo della riga corretta dopo il fix, normalizzato agli spazi, troncato a ~80
  caratteri. È l'**identità del fix**: due fix con la stessa `ancora` nello stesso file sono lo
  stesso fix.
- **`simbolo`** — il nome qualificato del contenitore in cui il fix sta. Su codice:
  `Classe.metodo`, `funzione`, il nome della costante di modulo. **Su un contratto in prosa: il
  titolo della sezione** (`§ Chiusura`, `## Procedura`), che è l'unità di contenimento equivalente.
  Serve a **orientarsi** e a **raggruppare**, ma da solo non identifica un fix.

`riga` resta nel ledger come **indicazione per il lettore umano**, mai come identità.

### I due segnali si verificano, non si accettano

`grave` è un giudizio di merito e resta dell'applicatore: nessun altro ha in mano il contesto per
darlo. `su_fix_precedente` e `oscillazione` no — sono **misure su stringhe**, e le fai tu dopo ogni
giro, prima di emettere il verdetto. È la stessa asimmetria che regge il ciclo: chi ha scritto i fix
non è la fonte del segnale che decide se qualcuno li rileggerà.

- **`oscillazione`**: per ogni fix nuovo, l'`ancora` coincide con una già registrata per lo stesso
  `file` e `simbolo` in un giro **precedente a quello dell'ultimo fix**? È un confronto di stringhe
  sul ledger. Il confronto gira anche sulle voci del campo `oscillazione` dell'applicatore, che
  porta le due ancore di ogni fix che ha soppresso.
- **`su_fix_precedente`**: l'`ancora` di un fix di un giro precedente non compare più nel suo file
  (`git grep -F '<ancora>' -- <file>` a vuoto), oppure cade fra le righe che il fix nuovo ha
  toccato. Entrambi i casi dicono che una correzione ne ha riscritta un'altra.

Se la tua verifica e il blocco dell'applicatore divergono, **vale la tua**: annota lo scostamento
nel ledger accanto al fix.

## Il ciclo

### Chi gira, a quale giro

| Giro | Finder | Scope del giro |
|---|---|---|
| **1** | **due** finder `bug` indipendenti, in parallelo, sullo **stesso** diff | tutto il diff: `git diff <BASE> -- plugins/daiku/` |
| **≥2** | **un** finder `bug` | i soli file toccati dall'applicatore nel giro precedente |

**Perché due al giro 1 e non uno.** Il valore del giro 1 non sta nel numero di passate: sta nel fatto
che due contesti freschi e **ciechi fra loro** trovano cose diverse, mentre due passate nello stesso
contesto trovano due volte le stesse. Sono lo stesso fan-out che `code-review` prescrive in casa
propria per la revisione di una pull request (i suoi agenti 3 e 4), qui applicato al diff locale. Il
costo è un subagent in più su un diff che si legge in fretta.

Dai giri ≥2 il perimetro è una manciata di file e la cecità non compra più niente: uno basta.

### Finder — ruolo **worker**, subagent di tipo `finder`

Ciascuno riceve come contratto da leggere `.claude/commands/code-review.md`, nella sua
**modalità finder**, che dichiara cosa cerca, con quale perimetro di lettura e in che forma
restituisce i rilievi: **non ricopiarlo nel prompt** — un contratto ricopiato si erode di giro in
giro, e le righe che si perdono per prime sono quelle che tengono insieme il ciclo.

Nel prompt di ciascun finder metti **solo ciò che cambia**, già risolto:

- il path del contratto, `.claude/commands/code-review.md`, e l'istruzione di eseguirlo nella
  **modalità finder**;
- `BASE` e il comando con cui vede il proprio scope; dai giri ≥2 l'elenco dei file toccati
  dall'applicatore nel giro precedente;
- il livello di **effort** del ciclo;
- dal giro 2: **applicati** e **scartati** dei giri precedenti, letti dal ledger;
- `CLAUDE.md`, e — se il diff tocca contratti, manifest o collocazione di file —
  `sviluppo/RICOGNIZIONE.md`: sono le due fonti contro cui si misura una violazione, e un finder che
  non le ha citerà regole che non esistono;
- il vincolo di **sola lettura**, ripetuto: l'agent `finder` non ha Edit né Write, ma ha `Bash`, e
  lì il confine non è imposto da nessuno.

I due finder del giro 1 **non si vedono tra loro**: è voluto. Lanciali nello **stesso** blocco di
tool call per farli girare davvero in parallelo.

**Sharding dei diff grandi.** Al giro 1, sopra una soglia indicativa — più di duemila righe aggiunte
o più di trenta file — ciascuno dei due finder si spezza in più subagent per gruppi di file coerenti
(per natura: contratti, codice eseguibile, manifest e template), stesso prompt, ciascuno con il
proprio sottoinsieme, lanciati insieme; i findings si uniscono prima dell'applicatore. È il motivo
per cui una review che arriva con il diff di una consegna intera può ancora rispettare «leggi ogni
riga aggiunta per intero».

**Un finder che non torna è una passata mancata, non una passata vuota.** Sono due esiti che si
somigliano — meno rilievi — e non si distinguono più a valle. La regola è deterministica:

1. Un finder che non restituisce il blocco — prosa invece di JSON, blocco incompleto, subagent che
   non torna — **si rilancia una volta sola**, con lo stesso identico prompt.
2. Se non torna neanche allora, il conteggio entra in `finder_mancati` **nel ledger, nel giro in cui
   è successo**, e da lì nel blocco finale. Non si compensa lanciando qualcos'altro al suo posto.
3. Un giro con un finder mancato **prosegue** — i rilievi dell'altro valgono — ma il ciclo non può
   chiudersi in silenzio: al giro 1, `finder_mancati` diverso da zero significa che il fan-out cieco
   non c'è stato, e va dichiarato in chiusura. Se mancano **entrambi**, il giro non ha prodotto
   niente: registra `verdetto: "fermati"` col motivo, esci, e apri una voce `da_confermare` con
   `bloccante: true`.

### Applicatore — ruolo **worker**, saltato a rilievi zero

Se nessun finder ha prodotto rilievi il giro è a vuoto: al giro 1 significa che il diff era corretto
al primo colpo, ai giri successivi che hai raggiunto il punto fisso. In entrambi i casi dillo in una
riga e non lanciarlo.

Altrimenti **un solo** subagent, di tipo `general-purpose` perché deve scrivere. Non ha un contratto
proprio: quello che deve fare sta qui, e nel prompt glielo passi per intero.

**Cosa riceve, già risolto:**

- i **rilievi di tutti i finder** del giro, uniti, con `file`, `riga`, `simbolo`, `confidenza`,
  `cambiamento`, `descrizione`;
- gli **applicati dei giri precedenti** dal ledger (`file`, `simbolo`, `ancora`, `cosa`);
- lo scope del giro e la `BASE`;
- `CLAUDE.md` e `sviluppo/memory/MEMORY.md` più i path delle memorie che lo scope tocca, da aprire
  prima di decidere (§4.1 di `.claude/orchestration.md`);
- il vincolo di perimetro: **scrive solo sotto `plugins/daiku/`**, mai `git add`, mai `git commit`,
  mai `git push`.

**Come decide, rilievo per rilievo.** Ogni rilievo si **riverifica sul file** prima di toccare
qualsiasi cosa: la confidenza del finder è una stima, non un permesso. Poi uno di tre esiti, e
nessun altro:

- **Applicato** — il difetto è reale e la strada è una sola. Correggilo con una modifica
  chirurgica, e registra `cosa` (che difetto era e come l'hai chiuso), `ancora` (la riga risultante,
  normalizzata, ~80 caratteri), `simbolo`, e **`grave`**: `true` se il difetto avrebbe prodotto un
  esito sbagliato — un contratto che manda un subagent su un file che non esiste, un manifest che un
  validatore rifiuta, una logica che dà il risultato errato, un valore di un altro progetto lasciato
  in un file che si pubblica; `false` per una rifinitura.
- **Scartato** — il rilievo non regge alla riverifica, o è fuori dal diff, o è una preferenza. Non
  si applica: si registra in `scartati` con il **perché**, che è ciò che impedisce al giro
  successivo di ripagare lo stesso triage.
- **Da confermare** — resta aperto **solo** se è un **bivio vero**: due strade entrambe difendibili
  in cui la scelta cambia il risultato in modo materiale. Registralo in `da_confermare` con `file`,
  `riga`, uno `scenario` scritto in parole semplici (cosa è in gioco, quali sono le strade, cosa
  cambia scegliendo l'una o l'altra) e **`bloccante`**: `true` se consegnare senza aver scelto
  significa consegnare qualcosa che potrebbe essere sbagliato.

  **Non è la casella dei dubbi.** Se sai qual è la strada giusta, quella è già la decisione:
  prendila. Lavoro lasciato a metà, pulizia opzionale e cose fuori dal perimetro del brief non
  entrano qui.

**Prima di applicare, guarda se è già successo.** Se l'`ancora` che stai per produrre coincide con
una già registrata nel ledger per lo stesso `file` e `simbolo` in un giro precedente a quello
dell'ultimo fix, **non applicare**: registrala in `oscillazione` con le due ancore e vai avanti. Due
giri che si rimpallano la stessa riga non stanno convergendo.

**Il blocco che l'applicatore restituisce:**

```json
{
  "applicati": [{"file": "", "simbolo": "", "ancora": "", "riga": 0, "cosa": "", "grave": true, "su_fix_precedente": false}],
  "scartati": [{"file": "", "simbolo": "", "riga": 0, "perche": ""}],
  "da_confermare": [{"file": "", "riga": 0, "scenario": "", "bloccante": true}],
  "oscillazione": [{"file": "", "simbolo": "", "ancora_attuale": "", "ancora_precedente": ""}],
  "file_toccati": ["<path>"]
}
```

È l'**unico** passo del ciclo che scrive, ed è ciò che rende leggibile un giro: lo scope dei giri ≥2
sono i file che ha toccato lui (`file_toccati`), e l'identità di un fix è l'`ancora` che registra
lui. Scrivi applicati, scartati e voci aperte nel ledger prima del giro successivo.

### Un passo che non torna, quando non è un finder

La regola dei tre punti di § *Finder* è la forma generale: **ogni** passo delegato di questo ciclo
che non restituisce il proprio blocco si rilancia **una volta sola**, con lo stesso identico prompt.
Mai un terzo tentativo: un ciclo che rilancia finché ottiene una risposta non sta iterando, sta
aspettando.

Cambia solo dove finisce il secondo fallimento:

- **applicatore**: il giro non ha prodotto fix e nessuno ha deciso i rilievi. Registralo nel ledger
  con `verdetto: "fermati"` e il motivo, esci dal ciclo, e apri una voce `da_confermare` con
  `bloccante: true` che elenca i rilievi rimasti senza decisione. `git status` dice se ha fatto in
  tempo a scrivere qualcosa: se sì, quei file entrano nel perimetro del gate come gli altri.
- **gate**: `gate: "rosso"` con `gate_detail` che dice che il gate **non è tornato**, non che è
  fallito. Non è un tecnicismo: un rosso per silenzio si indaga diversamente da un rosso per
  validatore.

### Quando fare un altro giro

Il numero di giri non si decide prima di cominciare — si decide guardando cosa il giro ha appena
prodotto. Dopo ogni giro, nell'ordine:

1. **Zero fix applicati** → punto fisso, esci. È l'uscita pulita.
2. **Almeno tre fix gravi** → un altro giro, senza discutere. Un perimetro che conteneva tre difetti
   reali ne conteneva abbastanza da contenerne ancora, e hai appena scritto il materiale che li
   corregge.
3. **Altrimenti, verdetto di merito** — lo emetti tu, in una riga motivata nel ledger, e pesa
   **cosa** è stato applicato, mai quanto:
   - **continua** se anche un solo fix ha `su_fix_precedente: true`: le tue correzioni stanno
     regredendo, e un giro che si ferma qui consegna proprio quel difetto;
   - **continua** se i gravi stanno su materiale appena riscritto, o toccano un contratto che il
     giro ha modificato in più punti: è un'area ancora calda;
   - **fermati** se il giro ha prodotto solo rifiniture, o gravi isolati in aree che per il resto non
     ha toccato. Uscita `resa-decrescente`: dichiara quali fix ti hanno convinto a fermarti.

Il criterio **non** è «meno di N rilievi». Quello che si conta alla regola 2 sono i fix **applicati**
e **gravi**: difetti già verificati e già corretti. Contare le segnalazioni ti fa uscire a caso;
contare le correzioni gravi ti dice quanto era sporco il perimetro che hai appena riscritto.

### Uscite

Esci al **primo** che si verifica, e dichiara quale:

1. **`punto-fisso`** — il giro ha applicato zero fix.
2. **`resa-decrescente`** — verdetto di merito negativo alla regola 3.
3. **`oscillazione`** — l'applicatore ha rilevato, prima di applicare, che l'`ancora` in uscita per
   un fix coincide con una già registrata per lo stesso `file` e `simbolo` in un giro precedente a
   quello dell'ultimo fix, **e tu lo hai verificato sul ledger**. Non si applica oltre. Fermati e
   riporta entrambe le versioni. Da non confondere con `su_fix_precedente`, che è il caso sano — un
   fix che ne corregge un altro *avanzando*; qui invece si torna indietro.
4. **`giri-troncati`** — hai raggiunto il tetto esplicito `--giri N`. Sei tu a troncare: sai cosa
   stai consegnando, non è un'anomalia.
5. **`giri-esauriti`** — hai raggiunto, senza un `--giri N` esplicito, il guardrail a **6**. Non è un
   budget da spendere: arrivarci è un'anomalia. Riportalo come tale, con l'elenco dei gravi
   dell'ultimo giro.

Un diff corretto al primo colpo esce a `punto-fisso` dopo un giro solo.

**L'uscita dice perché il ciclo si è fermato, non che la consegna sia sana.** Se restano voci
`da_confermare` con `bloccante: true`, il lavoro ha bivi aperti anche a `punto-fisso`: riportale
insieme all'uscita, e non chiamare «pulita» quell'uscita. Il commit non parte comunque.

## Dopo il ciclo

### Gate — ruolo **worker**, sempre

Gira **sempre**, anche a zero rilievi, e **una volta sola** all'uscita: è la verifica reale che il
pacchetto validi, non un check da ripetere a ogni giro. Un subagent, che non applica modifiche di
merito e non tocca file fuori dallo scope.

Nemmeno lui ha un contratto proprio. Nel prompt gli passi `BASE`, il pathspec `plugins/daiku/`, il
modo in cui **ricalcola** da sé l'elenco dei file, il perimetro di ciò che gli è lecito correggere,
il blocco da restituire, e **i comandi del gate**.

I comandi stanno in **`.claude/orchestration.md` §7**, che ne è l'unica fonte: quali sono, in che
ordine, e quali di essi girano a seconda di ciò che il perimetro tocca. Leggili da lì e **copiali
per esteso nel prompt**, insieme alla condizione che li seleziona — il subagent parte da zero e non
ha modo di risolverli. Non riscriverli qui: un gate ricopiato in due posti diverge alla prima
modifica, e il comando che si perde per primo è quello che qualcuno ha aggiunto dopo.

Deve girare **in foreground e fino in fondo**: diglielo.

**È l'unico punto della catena che esegue il gate**: `execute` e le sessioni di chat non lo lanciano
perché lo lanci tu. Su **questo** diff, se qui non gira, non ha girato nessuno.

**Il subagent del gate gira in foreground.** Non lo metti in background, non lo sorvegli da un altro
subagent, non frapponi attese attive fra te e lui. Vale per ogni delega di questo contratto: si
attende il ritorno del figlio come fa l'host.

**L'elenco dei file non è lo scope iniziale**: ricalcolalo da
`git diff <BASE> --name-only -- plugins/daiku/` più
`git ls-files --others --exclude-standard -- plugins/daiku/`, perché i fix possono aver aggiunto
file.

Poi gira i comandi della §7 nell'ordine che quella sezione dichiara, selezionandoli con la sua
condizione: l'elenco ricalcolato dice se il perimetro tocca `plugins/daiku/hooks/` e se ci sono file
nuovi. **Riporta l'esito reale di ciascuno**, compresi i totali `checks` dei banchi e l'esito di
ogni `check-ignore`: sono le due cose che un verde nudo non dice.

**Correggi da te solo ciò che è meccanico**, dentro l'elenco ricalcolato e a significato invariato:
un frontmatter da quotare, un campo di manifest da rimuovere perché il validatore lo rifiuta, una
versione da riallineare fra i due `plugin.json`. Il gate gira dopo l'ultimo finder, quindi qualunque
cosa scriva qui è materiale che nessuno rivedrà: se per far passare un validatore servisse una
modifica che cambia cosa il pacchetto dice o fa, **non farla** — riporta `gate: "rosso"` con quel
dettaglio. Il ciclo **non si riapre** dopo il gate.

Se il rosso viene da un errore del validatore o da un `--self-check` fallito, **non inventare un
fix**: riporta `gate: "rosso"` con l'output reale.

```json
{"gate": "verde|rosso", "gate_detail": "<esito effettivo di ogni comando eseguito, con i totali dei --self-check e l'esito dei check-ignore; mai una dichiarazione non verificata>"}
```

### Chiusura — il commit chiude il ciclo

**Il commit è l'ultimo passo del ciclo, non un'opzione.** Una review che arriva qui con gate verde e
nessuna voce bloccante ha già deciso: il lavoro è consegnabile, e lasciarlo non committato non lo
rende più sicuro — lo rende solo un albero sporco che qualcun altro dovrà interpretare. Chi committa
da sé lo sopprime con `--no-commit`; in ogni altro caso parte.

Il commit parte **solo** se valgono tutte: nessuna voce `da_confermare` con `bloccante: true`,
nessuna oscillazione rilevata, uscita diversa da `giri-esauriti`, nessun finder mancato al giro 1, e
**gate verde**.

`giri-esauriti` blocca perché è un'uscita per esaurimento, non per convergenza. `giri-troncati` no:
lì sei tu a troncare con `--giri N`, e sai cosa stai consegnando. Un finder mancato al giro 1 blocca
per lo stesso argomento con cui il gate blocca: quella passata su questo diff non l'ha fatta
nessuno, e non la farà più.

Quando parte, delegalo a un subagent **giudice** che legge integralmente
`.claude/commands/commit.md` ed esegue quel contratto sul perimetro `plugins/daiku/`.
Committare da qui a mano salterebbe l'allineamento di memoria e documentazione e il controllo di
versione che vivono lì. Nessun `git push`, mai.

**Se il suo blocco non torna**, vale la regola generale: lo rilanci **una volta sola**. Se non torna
neanche allora, `commit` è `saltato` con il motivo, `commit_sha` è `null`, e **non committi tu** per
chiudere il buco.

**Lo SHA torna con lui.** Il subagent riporta lo SHA di ogni commit prodotto: quello del **codice**
finisce verbatim in `commit_sha`. Non ricavarlo da `git log -1` — dopo `commit` la working tree può
portare due commit distinti e l'ultimo non è quello del codice.

## Esito

1. **Relaziona in chat**, corto: giri eseguiti e perché ti sei fermato, quanti rilievi hanno
   prodotto i finder, cosa è stato applicato, cosa scartato e con che motivo, le voci da confermare,
   l'esito del gate e quello del commit. Se qualche fix aveva `su_fix_precedente: true`, dillo: è la
   parte del lavoro che un solo giro non avrebbe trovato. E se il giro 1 è stato meno di quello che
   doveva essere — un finder mancato, il fan-out degradato in linea — dillo **per primo**: è l'unica
   cosa che il lettore non può ricavare dal resto del riepilogo.

2. **Chiudi sempre con il blocco a contratto**, così chi ti ha invocato lo legge senza interpretare
   la prosa. Nessun campo si omette: a zero voci si scrive `[]`.

   ```json
   {
     "giri": 0,
     "uscita": "punto-fisso|resa-decrescente|oscillazione|giri-troncati|giri-esauriti",
     "finder_giro_1": 2,
     "finder_mancati": 0,
     "indipendenza": "intatta|persa",
     "applicati": 0, "gravi": 0, "su_fix_precedente": 0, "scartati": 0,
     "gate": "verde|rosso",
     "gate_detail": "<esito reale dei comandi del gate, con i totali dei --self-check>",
     "file_nuovi_pubblicati": ["<path sotto plugins/ che questo diff introduce e che git traccerà>"],
     "commit": "eseguito|parziale|non-richiesto|saltato",
     "commit_sha": "<sha del commit del codice, o null>",
     "bloccanti": 0,
     "ledger": "<path del ledger di questa review>",
     "report": "<path di 5. review-report.md, o null se la review non gira su una cartella>",
     "da_confermare": [
       {"file": "<path>", "riga": 0, "scenario": "<il bivio in parole semplici>", "bloccante": true}
     ]
   }
   ```

   `finder_giro_1` conta i finder che hanno **restituito** il blocco, non quelli che hai lanciato.

   `indipendenza` è `persa` **solo** se il fan-out del giro 1 non è girato su subagent indipendenti:
   la delega non era disponibile e hai valutato le passate in linea, nello stesso contesto. Un
   fan-out sequenziale su contesti freschi resta `intatta`. Non è un campo di modestia: è ciò che
   distingue, a valle, una review da una passata sola.

   `file_nuovi_pubblicati` viene dal `gate_detail`, ed è l'unico campo che dice qualcosa di
   irreversibile: un file che entra sotto `plugins/` ed è tracciato esce a chiunque aggiunga il
   marketplace.

3. **Memoria e documentazione non sono un tuo compito né un compito dell'owner.** Il vincolo «solo
   `plugins/daiku/`» resta: `CLAUDE.md` e `sviluppo/` sono competenza di `update-memory`, che
   `commit` delega **sempre**. Quindi **non chiudere mai con un promemoria** del tipo «ricordati di
   aggiornare la ricognizione»: una riga che gira quel lavoro a chi legge non lo rende più sicuro —
   lo rende solo probabile che non avvenga.

   Se nel ciclo hai visto un **cambiamento di ciò che il pacchetto offre a chi lo installa** — una
   skill nuova, un contratto che cambia forma, un file che comincia a pubblicarsi — nominalo nel
   report come **fatto sul diff**, al pari degli altri. Non è un rilievo e **non** entra in
   `da_confermare`.

4. **Se il commit non è partito, chiudi dicendo in una riga perché**, e distingui i due casi. Con
   `--no-commit` il commit è di chi ti ha invocato: se il gate è verde e non restano voci bloccanti,
   chiudi con **«Pronto per il commit.»** e basta. Se invece a fermarlo è stata una delle condizioni
   di § *Chiusura*, nominala.

5. **Deposita il report**, se la review gira su una cartella di lavoro (l'input era
   `4. review-notes.md`): scrivi `5. review-report.md` accanto ad esso, con il blocco a contratto e,
   in prosa, quello che hai relazionato al punto 1. È l'unico artefatto che sopravvive alla sessione.
   Su una review lanciata a mano su un base-ref nudo non c'è cartella dove scriverlo: allora
   `report` è `null` e basta il blocco in chat.

## Auto-inganni (fermali prima che ti fermino)

| Se ti stai dicendo… | La verità |
|---|---|
| «Ho applicato i fix, il gate è verde, ho finito» | Il gate dice che il pacchetto valida, non che i contratti dicano il vero. I fix sono materiale che nessun finder ha letto. |
| «Ispeziono io il diff, così risparmio i finder» | I finder sono subagent indipendenti e ciechi tra loro: è la separazione che produce rilievi diversi invece di una sola passata già convinta di sé. |
| «Due finder sullo stesso diff sono uno spreco» | Due contesti ciechi trovano cose diverse; due passate nello stesso contesto trovano due volte le stesse. Il costo è un subagent su un diff che si legge in fretta. |
| «Il giro 2 lo rifaccio su tutto il diff, così sono sicuro» | È lo spreco che il ciclo evita. I file non toccati dai fix sono già stati giudicati. |
| «Il giro ha applicato pochi fix, ho finito» | Guarda **quali**, non quanti. Tre gravi impongono un altro giro; un fix su materiale nato dal giro prima dice che le tue correzioni stanno regredendo. |
| «Sono al giro 5, mi fermo che è già tanto» | Il tetto è un guardrail, non un budget. Se il giro 5 applica tre gravi il perimetro è ancora sporco. |
| «Nessun rilievo al giro 1: salto anche il gate» | Il gate gira **sempre**. Salta il giro 2, non il gate. |
| «Il validatore Codex si pianta per `pyyaml`: lo salto» | È dichiarato obbligatorio da `CLAUDE.md`. Un gate che lo salta certifica un pacchetto che nessuno ha validato per Codex: è `gate: "rosso"` con quel motivo, finché `pyyaml` non c'è. |
| «Il `--self-check` è verde, non serve il numero» | Serve. Un totale che cala mentre i controlli crescono è un banco che ha smesso di girare, e il verde da solo non lo mostra. |
| «Il file nuovo sotto `plugins/` lo guardo dopo» | È l'unica cosa irreversibile della catena: una volta pubblicato, è uscito. Si guarda nel gate, e finisce nel blocco. |
| «Il ledger dice riga 88, vado a vedere la riga 88» | Fra un giro e l'altro le righe si spostano. L'identità di un fix è `file` + `ancora`. |
| «Questo rilievo è a bassa confidenza: lo segno da confermare» | La confidenza è la stima del finder, non un permesso. Lo verifichi e decidi: applicarlo, o scartarlo dichiarando perché. |
| «Nel dubbio lo lascio aperto, tanto poi decide l'owner» | L'owner decide i bivi, non i tuoi dubbi. Se sai qual è la strada giusta, quella è già la decisione. |
| «Questo file fuori da `plugins/daiku/` andrebbe sistemato già che ci sono» | Vincolo hard di scope. Fuori di lì non si legge come rilievo e non si tocca. |
| «Committo io con `git commit`, il contratto è lungo» | Il contratto di commit tiene insieme memoria, documentazione e versione. Il commit si delega, sempre. |
| «Il commit ormai parte sempre, quelle condizioni sono burocrazia» | Sono l'unica porta rimasta. Un gate rosso, una voce bloccante, `giri-esauriti`, un'oscillazione o un finder mancato fermano il commit — e se ne salti una consegni un diff che nessuno ha guardato per intero. |

## Regola di taglio

Un contratto orchestrante tiene solo ciò che serve a **decidere la sequenza** — quando si delega, a
chi, con quale scope, e quando ci si ferma.

Applicato qui: questa skill possiede **la disciplina di review e il criterio di iterazione** —
scope, fan-out, quanti finder a quale giro, il mestiere dell'applicatore, quando fare un altro giro,
uscite, gate, chiusura. Non possiede il merito della ricerca dei difetti, che è di
`code-review.md`; non possiede la disciplina di commit, che delega; non possiede il gate, che è
dichiarato una volta sola in `.claude/orchestration.md` §7 e da lì si copia nel prompt del subagent
che lo esegue. Se cambia la review, si tocca qui e in nessun altro posto.
