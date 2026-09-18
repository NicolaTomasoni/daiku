---
name: execute
description: Esegue in autonomia il brief di esecuzione prodotto da /blueprint, seguendo il piano a task e aggiornando Memoria e Diario dentro il file; a fine lavoro deposita "4. review-notes.md" per /review
argument-hint: [cartella]
---

È il passo a valle di `/blueprint`. Ricevi la cartella che contiene il brief di esecuzione (`2. blueprint.md`) e lo **porti a termine dall'inizio alla fine in autonomia**. A differenza di `/decision-doc` e `/blueprint`, qui **esegui davvero**: modifichi il codice del progetto per realizzare la soluzione già decisa.

Il brief è già la tua consegna completa: la sezione **Mandato** ti dice come comportarti, **La soluzione scelta** cosa fare, la **Memoria** il piano a task da seguire. Questa skill non ti dà nuove istruzioni di merito — ti innesca sul file giusto e blinda le due discipline che un esecutore tradisce più spesso: **aggiornare il file mentre lavori** e **fidarti della verifica osservabile invece di autodichiararti a posto**.

> **Parametri.** Ogni chiave fra graffe di questo contratto si risolve sui file di parametri del
> progetto, mai a memoria e mai per assunzione: le regole sono nella §5 di
> `contracts/project-contract.md`, che dice anche **in quale lingua scrivere** e cosa fare quando
> una chiave non c'è.

## Input: la cartella del brief

Argomenti: `$ARGUMENTS`

L'argomento è **una sola cartella**, come path relativo dalla root del repo o assoluto.

- Se `$ARGUMENTS` è vuoto, **chiedi** all'utente quale cartella usare. Non procedere a vuoto.
- Se la cartella non esiste, segnalalo e fermati.
- Cerca il brief nella cartella: `2. blueprint.md`. Se non c'è con quel nome, cerca un file di blueprint equivalente (es. `BLUEPRINT.md`); se ne trovi più d'uno o nessuno, **chiedi** quale usare prima di procedere. Questo — insieme alla cartella mancante — è l'**unico** momento in cui è lecito chiedere: da qui in poi l'esecuzione è autonoma.

Con la cartella ricevi anche `{memory.index}` e i **path** delle memorie che il perimetro tocca, da aprire prima di scrivere: è il canale di §4.1 di `contracts/orchestration.md`. Se il chiamante non te li passa, apri l'indice e scegli tu — i vincoli e le decisioni non deducibili dal codice stanno lì, e riscoprirli a proprie spese costa un giro di review.

## Principi

1. **Il brief è la fonte di verità, e comanda lui.** Leggi `2. blueprint.md` **per intero** prima di toccare qualsiasi cosa: Mandato, Vincoli, La soluzione scelta, tutti i task, il Diario. Il Mandato scritto nel file prevale su qualsiasi tua inclinazione. Se riprendi dopo un'interruzione o una compattazione del contesto, **rileggi il file da capo**: lo stato del lavoro vive lì (task spuntati + Diario), non nella memoria di sessione.
2. **Autonomia reale.** Esegui tutti i task **nell'ordine** dato, senza chiedere nulla all'utente: ogni specifica è già nel brief e la scelta è già stata fatta. Se un dettaglio sembra mancare, deducilo dal brief e dai file di riferimento che cita — non interrompere. Fermati e chiedi **solo** davanti a un vero blocco: un'azione distruttiva o irreversibile non giustificata dal brief, o una contraddizione interna insanabile.
3. **Rispetta il perimetro.** Applica i Vincoli e i non-goals del brief alla lettera, e le regole architetturali del progetto (`{instructions_file}`): caricalo e tienilo presente. Modifiche chirurgiche, niente refactoring fuori scope, nessuna operazione Git distruttiva o remota salvo richiesta esplicita nel brief.
4. **La verifica è del controllo, non tua.** Ogni task porta un criterio di verifica **eseguibile** e *mirato al task*: i soli test che coprono ciò che hai appena cambiato, l'import del modulo toccato, un `grep`, un comando. Mai la suite intera, mai il gate di pacchetto — sono di `/review`, che li esegue sempre sul tuo diff. **Eseguila davvero** e considera il task concluso solo se il controllo passa. Mai "fatto quando sembra fatto": se la verifica fallisce, il task non è finito — correggi e riprova. Riporta l'output reale, non un riassunto ottimistico.
5. **Aggiorna il file mentre lavori, non alla fine.** Man mano che procedi, dentro `2. blueprint.md`: spunta i task (`[ ]` → `[~]` → `[x]`) e **appendi al Diario** cosa hai fatto, le decisioni prese, gli intoppi. Se l'esecuzione fa emergere fatti nuovi che rendono necessario adattare il piano (aggiungere, riordinare o sostituire task), fallo — ma **scrivi nel Diario perché**. Non saltare l'ordine per comodità. Il file deve poter far riprendere il lavoro a un altro esecutore in qualsiasi momento.
6. **La verifica di chiusura è obbligatoria, il gate non è tuo.** L'ultimo task è sempre l'auto-review del risultato contro i criteri di completamento del brief, più la prova osservabile che ciò che hai scritto si accende: importa i moduli toccati per intercettare errori a load-time, esegui i test del perimetro che hai cambiato. **Non lanciare la suite completa né il gate di pacchetto**: li esegue `/review` subito dopo di te, e ripeterli qui costa minuti e non aggiunge nulla. Non dichiarare completato il lavoro finché ogni criterio non è soddisfatto.

7. **Consegna la passata di review.** A lavoro finito, prima di chiudere, deposita nella cartella del brief il file `4. review-notes.md`: è il ponte verso `/review`, che l'utente lancerà a mano puntandolo a quel file. Non è un riassunto per l'utente — è un input operativo per chi eseguirà la review: gli dai il base-ref e ciò che hai notato, **non** l'elenco delle skill da lanciare (quello lo decide `/review` dal diff). Vedi *Il file di consegna* sotto. Non esegui tu `/review`: prepari solo la sua consegna.

## Auto-inganni (fermali prima che ti fermino)

Sei un esecutore autonomo: nessuno ti controlla mentre lavori, quindi l'unico modo di sbagliare è **assolverti da solo**. Se ti sorprendi a pensare una di queste frasi, la colonna a destra è la verità.

| Se ti stai dicendo… | La verità |
|---|---|
| «La verifica fallisce ma il codice è giusto, vado avanti» | Il task **non è finito**. Il verdetto è del controllo, non tuo (principio 4). Correggi e riesegui. |
| «Rileggere il brief da capo dopo l'interruzione è uno spreco» | Dopo una compattazione lo stato vive **solo** nel file (task + Diario), non nella tua memoria di sessione. Rileggilo per intero. |
| «Questo dettaglio manca, chiedo all'utente» | Deducilo dal brief e dai file che cita. Si chiede **solo** davanti a un blocco reale (azione distruttiva o contraddizione insanabile). |
| «Già che ci sono sistemo questo codice adiacente» | Fuori perimetro. Ogni riga che tocchi deve ricondursi a un task del brief (Vincoli, principio 3). |
| «Salto questo task, lo faccio dopo, è più comodo» | Segui l'ordine dato. Adattarlo è lecito solo se emergono fatti nuovi, e va motivato nel Diario (principio 5). |
| «La verifica la salto, ho già visto che funziona» | «Ho visto» non è evidenza osservabile: la verifica di chiusura è obbligatoria (principio 6). |
| «Lancio la suite completa, così sono sicuro» | Non è tua: `/review` la esegue sempre sul tuo diff, subito dopo. Qui verifichi il perimetro che hai toccato, non il repository. |
| «Aggiorno il Diario alla fine, ora corro» | Se ti interrompi ora, il lavoro riparte da zero. Aggiorna il file **mentre** lavori. |

## Segnali di allarme (red flags)

Se noti uno di questi mentre esegui, ti sei già incamminato nella direzione sbagliata — fermati e correggi la rotta:

- Stai modificando un file che **nessun task** del brief menziona.
- Sei a metà lavoro e il **Diario è ancora vuoto** o fermo al primo task.
- Hai segnato un task `[x]` **senza** aver eseguito il suo controllo di verifica.
- Stai per dichiarare il lavoro finito **senza** aver eseguito le prove mirate del perimetro che hai toccato (import dei moduli, i soli test che coprono ciò che è cambiato).
- Ti stai preparando a `git commit`/`git push` (non è compito tuo: il commit è un gesto dell'utente dopo la review).
- Stai riscrivendo o riassumendo la decisione invece di **eseguirla** (il brief ha già scelto).

## Procedura

1. **Risolvi la cartella** da `$ARGUMENTS` e trova il brief (`2. blueprint.md`, vedi *Input*).

2. **Leggi il brief per intero** e carica `{instructions_file}`. Ricostruisci: qual è la soluzione da realizzare, i vincoli e i non-goals, i criteri di completamento, e lo **stato corrente dei task** (se alcuni sono già `[x]`, riparti dal primo non fatto — non rifare lavoro già verificato).

3. **Esegui i task in ordine.** Per ciascuno: fai il passo, poi **esegui il controllo di verifica**. Verde → segna `[x]` e annota nel Diario. Rosso → resta sul task, correggi, riesegui; se emerge un fatto che impone di adattare il piano, aggiorna i task e motiva nel Diario. Non passare al task successivo con la verifica del precedente ancora rossa.

4. **Chiudi con la verifica di chiusura.** Auto-review contro i criteri di completamento del brief, più la prova osservabile del perimetro toccato (import dei moduli, test di quel perimetro). Il gate di build e test lo esegue `/review`: non lanciarlo qui. Se qualcosa non torna, torna indietro e sistema prima di dichiarare fatto.

5. **Deposita `4. review-notes.md`** nella cartella del brief (vedi *Il file di consegna*).

6. **Riepiloga in chat** in poche righe: cosa hai realizzato, l'esito dei controlli (con il loro output reale), le eventuali deviazioni dal piano e il perché, e che hai lasciato `4. review-notes.md` per la review. Il dettaglio resta nel Diario del file.

## Evidenze richieste per dire «fatto»

Non dichiarare il lavoro completato finché non puoi **esibire** — nel riepilogo e nel Diario — tutte queste evidenze concrete. È ciò che distingue «fatto» da «sembra fatto»:

- **Ogni task `[x]`** ha accanto, nel Diario, l'esito reale del suo controllo di verifica (non «ok», ma cosa hai eseguito e cosa è tornato).
- **Verifica di chiusura**: l'output reale delle prove mirate che hai eseguito sul perimetro toccato (import dei moduli, test di quel perimetro). Se non hai potuto eseguirle, dichiaralo come limite esplicito. Il gate di pacchetto — `{areas.<area>.gate}` delle aree toccate — **non si esegue qui**: è di `/review`.
- **Auto-review** contro i criteri di completamento del brief: ognuno spuntato, con la riga di codice/comportamento che lo soddisfa.
- **`4. review-notes.md` depositato** con base-ref reale da Git.

Se una di queste manca, il lavoro non è finito: torna indietro e completala prima di chiudere.

## Il file di consegna (`4. review-notes.md`)

L'ultimo gesto a lavoro finito. Scritto **rivolgendosi a chi eseguirà `/review`**, non all'utente. Serve a dargli il **punto da cui calcolare il diff** e a **segnalargli cosa guardare con attenzione**. Non decidi tu quali skill lancerà: `/review` stabilisce da sé le proprie fasi ispezionando il diff. Il tuo compito è fornirgli il base-ref e il contesto; lui se ne fida ma verifica. Se esiste già (ri-esecuzione), sovrascrivilo con lo stato aggiornato.

Contenuto:

- **Base-ref**: il commit/ref baseline contro cui hai lavorato, così la review calcola l'esatto diff della feature senza indovinare (es. il commit da cui è partito il branch, o `HEAD` d'inizio lavoro). Riporta il valore reale da Git, non a memoria.
- **Considerazioni**: ciò che hai *notato ma non era tuo compito risolvere* — punti perf-sensibili toccati, zone dove il comportamento atteso era ambiguo, gap di copertura, decisioni prese sotto incertezza. È il materiale che orienta le fasi di review; ancoralo ai file (`path:riga`), non generico. Descrivi *cosa hai toccato e dove* (es. "toccato il polling in `X:42`", "nuovo ramo non coperto in `Y:88`"), non *quale skill deve girare*: la scelta delle fasi è di `/review`.

```markdown
# Note per la review

> Origine: 2. blueprint.md · Generato: <data> · Base-ref: <commit/ref>

## Considerazioni
- <fatto ancorato a file:riga che orienta una fase di review>
- ...
```

## Cosa restituisci

Invocato a mano, basta il riepilogo in chat. **Invocato dentro una catena** — la fase Execute di
`/deliver-feature` — chiudi con questo blocco, che è il solo formato su cui il chiamante decide se
proseguire:

```json
{"ok": true, "note_review_path": "<path di 4. review-notes.md>", "verifica_detail": "<esito reale delle prove mirate sul perimetro toccato>", "detail": "<se ok=false, il motivo>"}
```

`verifica_detail` porta l'esito **reale** delle prove che hai eseguito sul perimetro che hai
toccato, non la loro intenzione: la suite completa e il gate di pacchetto non sono tuoi, li possiede `/review`, quindi questo campo è l'unica prova che qualcosa sia stato osservato
prima della review.

Lo schema sta qui, nel file del nodo che lo produce, e chi ti invoca lo cita invece di ricopiarlo
(§4.2 di `contracts/orchestration.md`).

## Regola di taglio

Tu **esegui**, non ridiscuti la decisione. Il brief ha già scelto cosa fare e perché: il tuo compito è realizzarlo fedelmente, verificarlo con controlli osservabili e lasciare nel file una traccia che permetta a chiunque di riprendere. Se il brief è davvero incompleto o contraddittorio al punto da non poter procedere, fermati e dillo — ma è l'eccezione, non la norma.
