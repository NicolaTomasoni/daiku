---
description: "Studia più repository insieme: un elenco di nomi e link, una corsa di studia-repository per ciascuno in parallelo, e un solo passaggio che applica i miglioramenti gratuiti raccolti da tutte — dopo aver messo da parte i conflitti. Poi la sintesi: un appunto per feature in `.daiku/studies/` che fra i target studiati sceglie il migliore e ne fa un prompt pronto per `/daiku:new-feature`. Non decide niente da sé: quello che richiede una decisione va all'owner."
argument-hint: '[--lista <file>] [<target> …] [--assi <lista>] [--versione <v>] [--focus <domanda>] [--cwd <path>] [--deep | --shallow-only] [--parallelo N] [--budget <usd>] [--modello <m>] [--tempo <minuti>]'
---

Studi un **lotto** di repository di terzi: un elenco di nomi e link, una corsa di
`studia-repository` per ciascuno, tutte insieme, e un solo passaggio finale che applica i
miglioramenti gratuiti che le corse hanno raccolto. Orchestri tu; il ferro lo fa
`.docs/tools/studia-repository/lotto.mjs`.

La divisione è fissa: **la macchina prepara, lancia, chiude i gate e applica; tu leggi i conflitti,
decidi quelli che sono tuoi e porti all'owner quelli che non lo sono.** Non riscrivi a mano quello
che il lotto sa fare da sé, e non applichi una sostituzione che lui ha rifiutato: se l'ha
rifiutata, è perché non è applicabile così com'è scritta, e riscriverla a sentimento è il modo di
rompere il file a cui era destinata.

## 1. L'elenco

L'elenco arriva come un file — una riga per target, `#` apre un commento — o come target sulla riga
di comando, o tutti e due. Un target è ciò che `studia-repository` accetta: un nome, `owner/repo`,
un URL, `gitlab:`/`bitbucket:`, un pacchetto (`zod`, `pypi:requests`), un path locale.

Se **non c'è né un file né un target**, chiedilo all'owner con `AskUserQuestion` e fermati: un lotto
senza elenco non è un lotto più corto, è un'altra cosa. È l'unico momento in cui chiedi prima di
partire.

Le opzioni del lotto valgono per **tutte** le corse — `--assi`, `--versione`, `--focus`, `--cwd`,
`--deep`, `--shallow-only` — e sono quelle di `studia-repository.md` § *Input*. Un lotto in cui una
corsa debba avere opzioni diverse dalle altre si fa in due lotti.

## 2. Il giro

1. **Prepara.** Il piano, senza scrivere niente:

   ```bash
   node .docs/tools/studia-repository/lotto.mjs prepara --lista <file> [<target> …] [flag]
   ```

   Stampa i target, il numero di corse insieme, se `gh` risponde e la **riga di comando esatta** di
   ogni corsa. Leggila: è quello che sta per partire. Se un target non ti convince, si toglie
   dall'elenco adesso, non dopo.

2. **Lancia.** Le corse partono tutte insieme, fino a `--parallelo` (predefinito 3), ognuna con il
   proprio log in `%TEMP%/daiku-lotto/<id>/`, e il comando aspetta che finiscano tutte:

   ```bash
   node .docs/tools/studia-repository/lotto.mjs lancia --lista <file> [<target> …] [flag]
   ```

   **Lancialo in background** (`run_in_background`): un lotto di più corse profonde dura decine di
   minuti, e in primo piano un timeout te lo taglia a metà. Quando finisce lo sai dal suo esito, non
   da un'attesa a occhio. Esce `1` se una corsa è uscita non-zero: **non è un motivo per fermarsi** —
   le altre hanno lavorato, e il lotto si chiude comunque; quella corsa finisce fra i gap, con il
   suo log citato. `--parallelo` (predefinito 3, massimo 8) è quante corse insieme, `--tempo` (180
   minuti) quando una corsa si considera appesa e viene uccisa, `--budget` il tetto di spesa per
   corsa. I log stanno in `%TEMP%/daiku-lotto/<id>/`, fuori dal repository: sono attrezzo, non
   risultato, e non si versionano.

3. **Applica.** Il gate di ogni corsa del lotto — quelle nate durante il lotto e quelle che il lotto
   ha riscritto, perché un secondo studio sullo stesso target riusa la cartella di prima — la
   raccolta delle voci `allinea` e l'applicazione di quelle che non si toccano:

   ```bash
   node .docs/tools/studia-repository/lotto.mjs applica [--lotto <id>] [--dry-run]
   ```

   `--dry-run` non scrive: mostra cosa applicherebbe e cosa no. Senza `--lotto` prende l'ultimo
   lotto. **Una corsa rossa al gate ferma l'applicazione**: un censimento che non passa il proprio
   gate non è affidabile, e le sue proposte non si applicano — si sistema la corsa, poi si riprova.
   Quando applica, il comando rilancia da sé le quattro verifiche di `CLAUDE.md` § *Verificare il
   pacchetto* e esce `1` se una è rossa, **senza rimettere a posto i file**: un rosso dopo una
   scrittura è un albero da sistemare a mano.

4. **Leggi l'esito.** Il comando stampa: i gate delle corse, il **catalogo** delle feature che hanno
   ricevuto un contributo, i doppioni (la stessa proposta arrivata da più corse — è una sola
   sostituzione), le **rifiutate** col motivo, i **conflitti**, i file scritti e l'esito delle
   quattro verifiche. I conflitti e le rifiutate sono la tua parte.

5. **Sintesi.** Il confronto che vale non è per repo: le corse hanno depositato i contributi in
   `.daiku/features/<feature>/`, e questo è il passo che li legge tutti insieme e ne trae **una
   sola** proposta — vedi §6.

   ```bash
   node .docs/tools/studia-repository/lotto.mjs sintesi [--feature <slug>]
   ```

6. **Porta all'owner** i conflitti, le voci che richiedono una decisione — vedi §4 — e quello che la
   sintesi lascia aperto, e non committare niente. Il commit resta dell'owner.

## 3. Chi applica, e perché non lo fa la corsa

Una corsa scrive **solo** sotto `.docs/studia-repository/` e non tocca il prodotto: il gate
`check-run.mjs` lo impone, ed è ciò che rende innocue due corse parallele. Le voci `allinea` — i
miglioramenti che non cambiano né il comportamento di Daiku né ciò che Daiku decide — restano
dunque **proposte** nel censimento, e le applica `lotto.mjs` dopo, una volta sola.

Applicare una voce `allinea` non è una decisione: è una **sostituzione puntuale** — un file sotto
`plugins/`, la riga esatta che c'è, la riga esatta che ci va — e per questo la fa la macchina, che
non interpreta niente. `applica` la esegue solo se regge: il file c'è, `prima` vi compare una volta
sola, `prima` e `dopo` sono diversi e stanno su una riga. Una che non regge è **rifiutata**, e il
motivo è stampato: quasi sempre è una voce scritta male, e si corregge nella corsa, non qui.

## 4. I conflitti: chi decide

Un **conflitto** è questo, e solo questo: due voci propongono due testi diversi che si
sovrappongono **nello stesso file** — due corse hanno guardato la stessa regola e ne propongono due
forme. Non è un caso da arbitrare in fretta: è la prova che su quella regola due studi non hanno
visto la stessa cosa.

- Il comando **non applica nessuna delle due**. Mai.
- Se le due forme dicono la stessa cosa a parole diverse, l'owner sceglie quale resta.
- Se dicono cose diverse, è una decisione sul metodo, e va all'owner con le due forme citate
  verbatim e il file che le contiene.

Le altre differenze **non sono conflitti** e non si portano a nessuno: due proposte identiche sono
un doppione (si applica una volta), due proposte sullo stesso file in punti diversi si applicano
entrambe, e due proposte su file diversi non si incontrano.

## 5. Quando fermarsi e chiedere

Ti fermi **solo** qui:

1. **Manca l'elenco** (§1).
2. **Un conflitto vero**, quello di §4: due forme diverse della stessa riga.
3. **Una voce rifiutata da `applica`** che non sai correggere: se il motivo non ti dice quale riga
   della corsa è sbagliata, dillo invece di provare a caso.
4. **Una verifica rossa dopo l'applicazione.** Si riporta l'esito reale e i file toccati: non si
   sistema a mano ciò che il lotto ha scritto, e non si rilancia `applica` sopra un albero sporco.
5. **Il lotto ha prodotto più di quanto l'owner possa leggere**: molte corse rosse al gate, o un
   censimento intero da buttare. Porta i conti e fermati.

In tutti gli altri casi **non ti fermi**: lanci, leggi, riporti.

## 6. La sintesi

Il censimento vale per un repo; la cosa che vale per tutti è un'altra, ed è il confronto **fra repo
che portano la stessa cosa**: tre progetti hanno risolto lo stesso problema in tre modi, e qualcuno
deve leggere i tre e dire quale vince, e cosa si prende da chi. È la sintesi, ed è **una per
feature** — non una per repo.

**Dove vive.** In `.daiku/studies/<feature>.md`, la sede degli appunti — quella che il contratto del
prodotto descrive come «un file per tecnologia». La sintesi è la stessa specie di documento: un
appunto per soggetto, vivo, che ogni lotto riscrive. **Non** nel catalogo delle feature: lì stanno i
contributi, uno per corsa e mai riscritti, ed è il gate `check-run.mjs` a imporlo.

**La forma è fissa**, e la stampa `sintesi`: quattro campi — `Feature` uguale alla cartella, `Lotto`
l'id di questo lotto, `Corse` le corse del lotto che hanno contribuito, `Esito` una delle azioni del
censimento meno `allinea` — e cinque sezioni in quest'ordine: *Cosa portano i target* (una voce per
repo, il suo approccio in due righe), *Quale approccio vince, e perché* (il confronto, col criterio,
e cosa si prende da chi), *La feature proposta* (una sola: cosa fa, dove atterra in Daiku, cosa
tocca, a che costo), *Cosa resta aperto* (le decisioni dell'owner, o `Nessuna`), *Prompt per
new-feature*.

**Il prompt è la parte che si usa.** Comincia col comando, prosegue con la descrizione, e **nomina la
cartella `.daiku/features/<feature>/`**: `new-feature` deriva lo slug dalla descrizione, e senza
quella riga aprirebbe una cartella nuova accanto ai contributi invece di lavorare dentro. Con quella
riga la corsa sa che la cartella esiste già, e non chiede conferma.

**La scrivi tu, non un subagent.** È un giudizio sul metodo, non un riassunto: un subagent
riceverebbe i contributi senza il resto — i tre principi, l'albero del prodotto, i divieti — e
sceglierebbe male con la stessa sicurezza. Le corse hanno già lavorato; qui si sceglie fra loro.

**La verifica è a macchina**, e si lancia dopo aver scritto: è l'unica difesa contro una sintesi
copiata dallo scheletro e mai riempita.

```bash
node .docs/tools/studia-repository/lotto.mjs sintesi --verifica
```

Controlla i quattro campi, le cinque sezioni in ordine, i corpi non vuoti, l'assenza di segnaposto
`<…>`, e che il prompt cominci col comando e nomini la cartella. Rossa: si corregge la sintesi e si
rilancia, non si aggira. Un esito `scarta` non vuole il prompt — la sua ultima sezione dice perché
non c'è niente da costruire — e resta come traccia che quella cosa è stata studiata e scartata.

Un lotto che non ha depositato contributi non ha niente da sintetizzare: il comando lo dice, e il
passo si salta. Non si inventa una sintesi per riempire il vuoto.

La sintesi si scrive **dopo** `applica`, e da lì quel lotto è chiuso: rilanciare `applica` su di lui
lo trova rosso, perché il gate confronta la fotografia di ogni corsa con l'albero di adesso, e la
sintesi è una scrittura fuori dalla radice delle corse. Non è un guasto da riparare — è il lotto che
ha finito, e un lotto nuovo rifà le sue corse.

## 7. Esito in chat

- **il lotto**: id, quante corse, quante uscite zero, in quanto tempo; le cartelle nuove sotto
  `.docs/studia-repository/`;
- **i gate**, uno per corsa, e i `failed` verbatim di quelli rossi;
- **cosa è stato applicato**: file per file, le sostituzioni, e l'esito delle quattro verifiche;
- **i conflitti**, ciascuno con le due forme e il file — è il blocco che chiede una risposta;
- **le rifiutate**, con il motivo;
- **il catalogo**: quali feature hanno ricevuto un contributo e da quali corse, con il path delle
  cartelle. I contributi li scrivono le corse, ognuna col proprio nome, quindi il lotto non li
  fonde: li elenca. È la parte del lotto che sopravvive alle sue corse;
- **la sintesi**: la feature, l'esito, il file scritto in `.daiku/studies/`, l'esito di `--verifica`
  e il prompt per `/daiku:new-feature` — o il motivo, se l'esito è `scarta`;
- per ogni corsa, il suo verdetto complessivo e le voci per azione, gli ID `RI-*` mantenuti —
  l'esito di `studia-repository.md` § *Esito in chat*, in una riga per corsa invece che per intero;
- le `limitations` che una corsa dichiara, se ce ne sono.

Non nascondere le corse rosse dietro la media delle verdi: il lotto serve a sapere **quali** target
hanno retto, non quanti.
