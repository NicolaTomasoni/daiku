---
description: "Studia più repository insieme: un elenco di nomi e link, una corsa di studia-repository per ciascuno in parallelo, e un solo passaggio che applica i miglioramenti gratuiti raccolti da tutte — dopo aver messo da parte i conflitti. Non decide niente da sé: quello che richiede una decisione va all'owner."
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

5. **Porta all'owner** i conflitti e le voci che richiedono una decisione — vedi §4 — e non
   committare niente. Il commit resta dell'owner.

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

## 6. Esito in chat

- **il lotto**: id, quante corse, quante uscite zero, in quanto tempo; le cartelle nuove sotto
  `.docs/studia-repository/`;
- **i gate**, uno per corsa, e i `failed` verbatim di quelli rossi;
- **cosa è stato applicato**: file per file, le sostituzioni, e l'esito delle quattro verifiche;
- **i conflitti**, ciascuno con le due forme e il file — è il blocco che chiede una risposta;
- **le rifiutate**, con il motivo;
- **il catalogo**: quali feature hanno ricevuto un contributo e da quali corse, con il path delle
  cartelle. I contributi li scrivono le corse, ognuna col proprio nome, quindi il lotto non li
  fonde: li elenca. È la parte del lotto che sopravvive alle sue corse;
- per ogni corsa, il suo verdetto complessivo e le voci per azione, gli ID `RI-*` mantenuti —
  l'esito di `studia-repository.md` § *Esito in chat*, in una riga per corsa invece che per intero;
- le `limitations` che una corsa dichiara, se ce ne sono.

Non nascondere le corse rosse dietro la media delle verdi: il lotto serve a sapere **quali** target
hanno retto, non quanti.
