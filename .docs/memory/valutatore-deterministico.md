---
name: valutatore-deterministico
description: "Il prodotto ha un valutatore deterministico che possiede l'ordine della catena e risponde a undici domande meccaniche, e accanto tre strumenti che misurano il disco — la review, il pool dei worktree e la riconciliazione del merge —: il verdetto vincola, e il banco è l'unica difesa"
metadata:
  node_type: memory
  type: project
  originSessionId: 43bcfac4-1cc3-4310-acf9-530699fcf261
  modified: 2026-10-05T07:27:54.347Z
---

**Dal 23 settembre 2026 il prodotto ha un valutatore deterministico.** È
`plugins/daiku/architect/architect.mjs`, in una cartella di primo livello nuova del pacchetto,
sorella di `skills/`, `contracts/`, `hooks/` e `schemas/`. Il nome l'ha scelto l'owner in
conversazione, al posto delle tre opzioni che erano in campo — `evaluator/`, `planner/`,
`verdicts/` — e **non si rinomina più**: è un path, e dentro le skill lo nominano da fuori (vedi
[[confine-degli-identificatori]]).

Fa due mestieri: **valuta** undici classificazioni meccaniche — la decisione finale, la chiusura del
ciclo, lo sblocco meccanico, la propagazione del fallimento, la ripresa, l'ordine, il verdetto di
giro di `review` (`round`), il controllo `layers:` di `arch-check` (`layers`), la forma di un
blocco di ritorno contro `schemas/blocks.json` (`block`, usata da `new-feature` sul blocco di
`decision-doc`, da `ship-feature` su quelli di `blueprint` ed `execute`, e sui blocchi di finder
e applicatore dallo strumento del ledger), lo slot del pool dei worktree (`pool`, chiesta da
`architect/pool.mjs`) e se le due parti di un merge ostruito toccano le stesse righe (`reconcile`,
chiesta da `architect/reconcile.mjs`) — e **possiede l'ordine della catena**: la tabella di §3 di
`contracts/orchestration.md` non lo dichiara più, ne è il riflesso, e il banco del valutatore
rifiuta la divergenza nei due versi. Gli entry che aprono **nessuna catena** — `study` lanciato a
mano, e dal 3 ottobre 2026 `release` — stanno in `ATOMIC` di `architect.mjs`: chiesti con `order`
rispondono `stop` con la loro ragione, perché non c'è una sequenza da ordinare.

Le misure sul codice si fermano al brief: `blueprint` è l'ultimo passo che guarda il codice per
costruire le sue mappe (consumatori, fatti ritirati), da `execute` in avanti nessuno rimisura sul
disco — l'esecutore lavora solo sui file che il brief cita, e se ne serve uno non citato il brief
era impreciso.

**Why:** un modello che legge una tabella di sei righe e deve applicarle tutte è un modo costoso e
non riproducibile di fare un `if`; e la sequenza era dichiarata a parole in tre contratti, quindi
ogni tabella che decide un passo la ripeteva per poter dire cosa viene dopo. Due scostamenti dal
resto del pacchetto discendono da qui, e sono la parte che conta:

- **Fallisce rumorosamente, al contrario delle guardie.** Un hook tace perché parte da solo su ogni
  repository che l'host apre; questo parte su invocazione, e il suo verdetto **vincola**: un input
  che manca o è malformato è un errore, mai un `false` implicito, e se non gira la consegna si
  ferma. Conseguenza dichiarata a chi installa: `node` che manca smette di essere un controllo che
  tace e diventa un requisito che ferma il lavoro. Vedi [[guardrail-nascono-spenti]].
- **Non apre file del progetto.** Quello che sa del disco glielo passa l'agente, in chiaro
  nell'esito; l'unico file che legge è `schemas/blocks.json` del pacchetto stesso, per `block`. Le misure sul disco della review le fa perciò un secondo programma accanto a lui,
  `architect/ledger.mjs`: legge Git, scrive il ledger — l'unico a scriverlo — e il `review-log.json`
  derivato dai ledger che gli stanno accanto, validando ciascuno contro la sua voce di
  `schemas/blocks.json` (§ *ledger*, § *review-log*) prima di ogni scrittura, e chiede i verdetti al
  valutatore importandone le domande invece di copiarle. È lui a misurare `on_previous_fix`, sui due alberi
  che fotografa attorno all'applicatore, file non tracciati compresi: una misura che un agente
  esegue e riporta è una dichiarazione, una che esegue un programma è una misura. L'oscillazione,
  che è un confronto di stringhe sul ledger, la misura il valutatore; e in `round` il verdetto di
  merito della regola 3 resta dell'agente, che lo passa come `merit` e il programma lo traduce
  nell'uscita.
- **Il pool dei worktree ha il suo lato disco.** `architect/pool.mjs` misura Git — quali slot sono
  registrati, quali hanno l'albero pulito — legge il registro del pool sotto un lock esclusivo, ne è
  l'unico a scriverlo, validandolo contro `schemas/blocks.json` § *pool*, e chiede al valutatore la
  domanda `pool`: riuso dello slot pulito che nessuna consegna tiene, presa in carico del proprio,
  creazione del numero libero più basso, o rifiuto a tetto raggiunto.
  Prima era prosa scritta a mano, e portava una condizione di «libero» — `HEAD == HEAD(<INT>)` —
  che nessuno slot soddisfaceva mai, così il pool non riciclava e si saturava. Vedi [[pool-worktree]].
- **La riconciliazione di un merge ostruito ha il suo lato disco.** `architect/reconcile.mjs` misura Git — il merge-base, i percorsi ostruiti, le righe che ciascuna parte cambia — scrive in un patch il lavoro non committato dell'albero di lavoro, e chiede al valutatore la domanda `reconcile`: `reconcile` quando le due parti sono disgiunte a riga, `stop` quando toccano le stesse righe, perché una fusione lì è una scelta con tradeoff e la prende l'owner.
- **La radice si passa per argomento, mai dedotta dalla posizione.** Un programma che deduce la
  propria radice dal posto in cui si trova è corretto fino al primo spostamento dell'albero e
  sbaglia in silenzio: è esattamente come è morto il verificatore rimosso il 18 settembre 2026.

**Il banco è l'unica difesa:** un caso che non copre non è un verdetto sbagliato, è una consegna che
si ferma. E un controllo che nessuno ha visto fallire vale come rosso: il banco del valutatore
riporta accanto al totale `never_red`, le regole che nessuna sua fixture ha mai reso rosse, e
`hooks/self-check.mjs` fa rosso quel banco anche con tutti i casi verdi, perché una regola che è
sempre passata non si distingue da una che non può fallire. I tre banchi stanno accanto ai tre
programmi e non in `hooks/lib/`, che viene copiata nel progetto dell'utente; quello di `ledger.mjs`
lavora con Git vero su repository usa e getta nella cartella temporanea di sistema. Si lanciano con
gli altri con `node plugins/daiku/hooks/self-check.mjs`.

**E c'è un campo che misura.** `architect_agreement`, nell'esito di `ship-feature`, dice se la
lettura dell'agente coincideva col verdetto: è il primo uso del valutatore per misurare Daiku
stessa, e se le due letture coincidono sempre allora il valutatore ha reso poco.

**How to apply:** si invoca con `node <radice del pacchetto>/architect/architect.mjs <radice>` — e
gli strumenti con `node <radice del pacchetto>/architect/ledger.mjs <radice>` e
`node <radice del pacchetto>/architect/pool.mjs <radice>` e
`node <radice del pacchetto>/architect/reconcile.mjs <radice>` — un oggetto JSON su
stdin e uno su stdout. Le chiavi che ogni domanda richiede sono dichiarate una volta sola, in
`REQUIRES` di `architect.mjs`, e il suo banco rifiuta una chiamata al valutatore, nei contratti di
`skills/`, il cui paragrafo non le nomina tutte. Cosa risponde e il blocco di ritorno stanno in
`skills/ship-feature/SKILL.md` § *The evaluator* e in `schemas/blocks.json` § *architect*; le
azioni dello strumento — `scope`, `findings`, `areas`, `round`, `tail`, `layers`, `ask`, `log` — in
`skills/review/SKILL.md` § *The ledger tool*: si citano, non si ricopiano. La forma del banco — `.mjs` Node senza dipendenze, radice per argomento,
`--self-check` a totale contato — è ormai la convenzione di questo repository: chi ne scrive un
altro la prende da `.docs/tools/check-topology.mjs` invece di reinventarla. Vedi
[[alberatura-pacchetto]] e [[corpus-di-sviluppo]].
