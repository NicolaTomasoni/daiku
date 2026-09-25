---
description: 'Esegue in autonomia il brief prodotto da blueprint, seguendo il piano a task e aggiornando Memoria e Diario dentro il file; a fine lavoro deposita 4. review-notes.md per review'
argument-hint: '[cartella]'
---

È il passo a valle di `blueprint`. Ricevi la cartella che contiene il brief di esecuzione
(`2. blueprint.md`) e lo **porti a termine dall'inizio alla fine in autonomia**. A differenza di
`decision-doc` e `blueprint`, qui **esegui davvero**: modifichi `plugins/daiku/` per realizzare la
soluzione già decisa.

Il brief è già la tua consegna completa: la sezione **Mandato** ti dice come comportarti, **La
soluzione scelta** cosa fare, la **Memoria** il piano a task da seguire. Questa skill non ti dà
nuove istruzioni di merito — ti innesca sul file giusto e blinda le due discipline che un esecutore
tradisce più spesso: **aggiornare il file mentre lavori** e **fidarti della verifica osservabile
invece di autodichiararti a posto**.

## Input: la cartella del brief

Argomenti: `$ARGUMENTS`

- Se `$ARGUMENTS` è vuoto, **chiedi** quale cartella usare. Non procedere a vuoto.
- Se la cartella non esiste, segnalalo e fermati.
- Cerca `2. blueprint.md` nella cartella. Se non c'è con quel nome, cerca un equivalente; se ne
  trovi più d'uno o nessuno, **chiedi** quale usare. Questo — insieme alla cartella mancante — è
  l'**unico** momento in cui è lecito chiedere: da qui in poi l'esecuzione è autonoma.
- Con la cartella ricevi anche `.docs/memory/MEMORY.md` e i **path** delle memorie che il
  perimetro tocca, da aprire prima di scrivere (§4.1 di `.claude/orchestration.md`). Se il chiamante
  non te li passa, apri l'indice e scegli tu.

## Il perimetro

**Scrivi solo sotto `plugins/daiku/`**, salvo i file che il brief elenca uno per uno nella propria
sezione *Vincoli e perimetro*. Fuori da lì non si tocca niente «già che ci sono»: `CLAUDE.md`,
`.docs/` e `.claude/` sono di altri passi, e `.claude/commands/` in particolare è una derivazione
di questo corpus che non si riallinea da sola.

Due fatti del repository che valgono a ogni task:

- **Un file nuovo sotto `plugins/` si pubblica, e non c'è niente da aggiornare per farlo.** Il
  `.gitignore` esclude soltanto `.claude/settings.local.json` e **non è il confine di ciò che
  esce**: il confine sta nella lista di copia dello script di pubblicazione, che prende `plugins/`
  in blocco (`CLAUDE.md`, § *Due repository*): un file nuovo lì
  dentro esce al primo commit che lo contiene, e non si torna indietro. Se il brief lo prevede,
  fallo; se non lo prevede e ti accorgi che serve, è un fatto nuovo: annotalo nel Diario e dillo
  nell'esito, non deciderlo di slancio.
- **Quotare `description` e `argument-hint`** nel frontmatter di ogni `SKILL.md` che tocchi, con
  apice singolo e apice interno raddoppiato. Il guasto è silenzioso: la skill si carica con i
  metadati vuoti.

## Principi

1. **Il brief è la fonte di verità, e comanda lui.** Leggi `2. blueprint.md` **per intero** prima di
   toccare qualsiasi cosa: Mandato, Vincoli, La soluzione scelta, tutti i task, il Diario. Il
   Mandato scritto nel file prevale su qualsiasi tua inclinazione. Se riprendi dopo un'interruzione
   o una compattazione del contesto, **rileggi il file da capo**: lo stato del lavoro vive lì (task
   spuntati + Diario), non nella memoria di sessione.
2. **Autonomia reale.** Esegui tutti i task **nell'ordine** dato, senza chiedere nulla: ogni
   specifica è già nel brief e la scelta è già stata fatta. Se un dettaglio sembra mancare, deducilo
   dal brief e dai file che cita — non interrompere. Fermati e chiedi **solo** davanti a un vero
   blocco: un'azione distruttiva o irreversibile non giustificata dal brief, o una contraddizione
   interna insanabile.
3. **Rispetta il perimetro.** Applica i Vincoli e i non-goals del brief alla lettera, e gli
   invarianti di `CLAUDE.md`: caricalo e tienilo presente. Modifiche chirurgiche, nessuna
   operazione Git distruttiva o remota.
4. **La verifica è del controllo, non tua.** Ogni task porta un criterio di verifica **eseguibile**
   e *mirato al task*: il validatore su ciò che hai appena toccato, il `--self-check` dell'hook che
   hai modificato, un `grep` su un rimando, un `git check-ignore` su un file nuovo. **Eseguila
   davvero** e considera il task concluso solo se il controllo passa. Mai «fatto quando sembra
   fatto»: se la verifica fallisce, il task non è finito — correggi e riprova. Riporta l'output
   reale, non un riassunto ottimistico.
5. **Aggiorna il file mentre lavori, non alla fine.** Man mano che procedi, dentro
   `2. blueprint.md`: spunta i task (`[ ]` → `[~]` → `[x]`) e **appendi al Diario** cosa hai fatto,
   le decisioni prese, gli intoppi. Se l'esecuzione fa emergere fatti nuovi che rendono necessario
   adattare il piano, fallo — ma **scrivi nel Diario perché**. Il file deve poter far riprendere il
   lavoro a un altro esecutore in qualsiasi momento.
6. **La verifica di chiusura è obbligatoria, il gate non è tuo.** L'ultimo task è sempre
   l'auto-review del risultato contro i criteri di completamento del brief, più la prova osservabile
   che ciò che hai scritto regge sul perimetro toccato. **Non lanciare il gate di pacchetto**: lo
   esegue `review` subito dopo di te (`.claude/orchestration.md` §7), una volta sola e su tutto il
   diff. Ripeterlo qui costa e non aggiunge nulla.

   Il confine è netto e conviene saperlo: se hai toccato **una** skill, verifichi quella; il
   `claude plugin validate` sull'albero intero, il validatore Codex e i tre `--self-check` sono del
   gate.
7. **Consegna la passata di review.** A lavoro finito, prima di chiudere, deposita nella cartella
   del brief il file `4. review-notes.md`: è il ponte verso `review`. Non è un riassunto per l'owner
   — è un input operativo per chi eseguirà la review: gli dai il base-ref e ciò che hai notato.
   Vedi *Il file di consegna*. Non esegui tu la review: prepari solo la sua consegna.

## Auto-inganni (fermali prima che ti fermino)

Sei un esecutore autonomo: nessuno ti controlla mentre lavori, quindi l'unico modo di sbagliare è
**assolverti da solo**.

| Se ti stai dicendo… | La verità |
|---|---|
| «La verifica fallisce ma il testo è giusto, vado avanti» | Il task **non è finito**. Il verdetto è del controllo, non tuo. Correggi e riesegui. |
| «Rileggere il brief da capo dopo l'interruzione è uno spreco» | Dopo una compattazione lo stato vive **solo** nel file (task + Diario). Rileggilo per intero. |
| «Questo dettaglio manca, chiedo» | Deducilo dal brief e dai file che cita. Si chiede **solo** davanti a un blocco reale. |
| «Già che ci sono allineo anche `.claude/commands/`» | Fuori perimetro. Quel corpus è una derivazione dei contratti del prodotto e si riallinea a mano, quando lo si decide. |
| «Aggiungo il file nuovo al `.gitignore`, così non esce» | Non funziona: il `.gitignore` non è il confine, e quel file uscirebbe lo stesso. L'unico modo di non pubblicarlo è **non metterlo** sotto `plugins/`. Se il brief non lo prevede, è un fatto nuovo: annota e dichiara. |
| «Salto questo task, lo faccio dopo» | Segui l'ordine dato. Adattarlo è lecito solo se emergono fatti nuovi, e va motivato nel Diario. |
| «La verifica la salto, ho già visto che funziona» | «Ho visto» non è evidenza osservabile: la verifica di chiusura è obbligatoria. |
| «Lancio tutto il gate, così sono sicuro» | Non è tuo: `review` lo esegue sempre sul tuo diff, subito dopo. Qui verifichi il perimetro che hai toccato. |
| «Aggiorno il Diario alla fine, ora corro» | Se ti interrompi ora, il lavoro riparte da zero. Aggiorna il file **mentre** lavori. |

## Segnali di allarme

Se noti uno di questi mentre esegui, ti sei già incamminato nella direzione sbagliata:

- Stai modificando un file che **nessun task** del brief menziona.
- Stai scrivendo **fuori da `plugins/daiku/`** senza che il brief lo elenchi.
- Sei a metà lavoro e il **Diario è ancora vuoto** o fermo al primo task.
- Hai segnato un task `[x]` **senza** aver eseguito il suo controllo di verifica.
- Stai per dichiarare il lavoro finito **senza** aver eseguito le prove mirate del perimetro
  toccato.
- Ti stai preparando a `git commit`/`git push`: non è compito tuo.
- Stai riscrivendo o riassumendo la decisione invece di **eseguirla**.

## Procedura

1. **Risolvi la cartella** da `$ARGUMENTS` e trova il brief.

2. **Leggi il brief per intero** e carica `CLAUDE.md`. Ricostruisci: la soluzione da realizzare, i
   vincoli e i non-goals, i criteri di completamento, e lo **stato corrente dei task** (se alcuni
   sono già `[x]`, riparti dal primo non fatto — non rifare lavoro già verificato).

3. **Congela il base-ref**, subito, prima di scrivere una riga: `git rev-parse HEAD`. È lo SHA che
   deporrai in `4. review-notes.md`, ed è ciò da cui la review calcolerà il diff.

4. **Esegui i task in ordine.** Per ciascuno: fai il passo, poi **esegui il controllo di verifica**.
   Verde → segna `[x]` e annota nel Diario. Rosso → resta sul task, correggi, riesegui; se emerge un
   fatto che impone di adattare il piano, aggiorna i task e motiva nel Diario. Non passare al task
   successivo con la verifica del precedente ancora rossa.

5. **Chiudi con la verifica di chiusura.** Auto-review contro i criteri di completamento, più la
   prova osservabile del perimetro toccato. Il gate lo esegue `review`: non lanciarlo qui.

6. **Deposita `4. review-notes.md`** nella cartella del brief.

7. **Riepiloga** in poche righe: cosa hai realizzato, l'esito dei controlli con il loro output
   reale, le deviazioni dal piano e il perché, e che hai lasciato `4. review-notes.md`. Il dettaglio
   resta nel Diario.

## Evidenze richieste per dire «fatto»

Non dichiarare il lavoro completato finché non puoi **esibire** — nel riepilogo e nel Diario —
tutte queste evidenze concrete:

- **Ogni task `[x]`** ha accanto, nel Diario, l'esito reale del suo controllo (non «ok», ma cosa hai
  eseguito e cosa è tornato).
- **Verifica di chiusura**: l'output reale delle prove mirate sul perimetro toccato. Se non hai
  potuto eseguirle, dichiaralo come limite esplicito. Il gate di pacchetto **non si esegue qui**.
- **Auto-review** contro i criteri di completamento del brief: ognuno spuntato, con la riga che lo
  soddisfa.
- **`4. review-notes.md` depositato** con base-ref reale da Git.

## Il file di consegna (`4. review-notes.md`)

L'ultimo gesto a lavoro finito. Scritto **rivolgendosi a chi eseguirà la review**, non all'owner.
Serve a dargli il **punto da cui calcolare il diff** e a **segnalargli cosa guardare con
attenzione**. Se esiste già (ri-esecuzione), sovrascrivilo con lo stato aggiornato.

Contenuto:

- **Base-ref**: lo SHA che hai congelato al passo 3. Riporta il valore reale da Git, non a memoria.
- **Considerazioni**: ciò che hai *notato ma non era tuo compito risolvere* — un rimando che ora
  punta altrove, una sezione che due contratti dichiarano diversamente, un banco `--self-check` il
  cui totale non torna, una decisione presa sotto incertezza. Ancorale ai file (`path:riga`), non
  generiche. Descrivi *cosa hai toccato e dove*, non *quale skill deve girare*: le fasi le decide la
  review dal diff.
- **File nuovi sotto `plugins/`**, se ce ne sono: è la cosa che la review deve guardare per prima,
  perché all'uscita di questa consegna **si pubblicano** e non si torna indietro.

```markdown
# Note per la review

> Origine: 2. blueprint.md · Generato: <data> · Base-ref: <sha>

## Considerazioni
- <fatto ancorato a file:riga>
- ...

## File nuovi sotto plugins/
- <path> — si pubblica al commit di questa consegna
```

## Cosa restituisci

Invocato a mano, basta il riepilogo in chat. **Invocato dentro una catena** — la fase Execute di
`deliver-feature` — chiudi con questo blocco, che è il solo formato su cui il chiamante decide se
proseguire:

```json
{"ok": true, "note_review_path": "<path di 4. review-notes.md>", "base_ref": "<sha congelato al passo 3>", "verifica_detail": "<esito reale delle prove mirate sul perimetro toccato>", "detail": "<se ok=false, il motivo>"}
```

`verifica_detail` porta l'esito **reale** delle prove che hai eseguito, non la loro intenzione: il
gate di pacchetto non è tuo, quindi questo campo è l'unica prova che qualcosa sia stato osservato
prima della review.

Lo schema sta qui, nel file del nodo che lo produce, e chi ti invoca lo cita invece di ricopiarlo
(§4.2 di `.claude/orchestration.md`).

## Regola di taglio

Tu **esegui**, non ridiscuti la decisione. Il brief ha già scelto cosa fare e perché: il tuo compito
è realizzarlo fedelmente, verificarlo con controlli osservabili e lasciare nel file una traccia che
permetta a chiunque di riprendere. Se il brief è davvero incompleto o contraddittorio al punto da
non poter procedere, fermati e dillo — ma è l'eccezione, non la norma.
