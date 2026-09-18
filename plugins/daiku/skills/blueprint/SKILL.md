---
name: 'blueprint'
description: 'Dal documento di decisione e dalla soluzione scelta produce un brief di esecuzione autonoma (2. blueprint.md) e si ferma lì, senza eseguire; per eseguirlo usa /execute'
argument-hint: '[cartella] [soluzione scelta]'
---

È il passo a valle di `/decision-doc`. Ricevi la cartella che contiene il documento di decisione (`1. decision-doc.md`) e l'indicazione della **soluzione scelta** dall'utente. Produci **un solo file**, `2. blueprint.md`, che è un **brief di esecuzione autonoma**: contiene **solo** le informazioni necessarie alla soluzione scelta, e una **sezione Memoria** con un **piano di implementazione pre-fatto, diviso in task ordinati**. Ti **fermi al brief**: non esegui il piano e non lanci nessun esecutore. L'esecuzione è un passo separato e atomico (`/execute`).

Il file generato serve a un *futuro* esecutore, che non sa nulla di come è nato: deve istruirlo a portare a termine il lavoro **dall'inizio alla fine in autonomia, senza chiedere altro all'utente** — perché ogni specifica è già definita nel documento e la preferenza dell'utente è già stata espressa — e a **compilare la Memoria man mano** che esegue i task, prendendo nota e rispettando l'ordine prestabilito.

Tu, qui, **non esegui** il piano: lo **prepari** soltanto. Il file resta la fonte di verità — proprio perché è autosufficiente è la consegna perfetta per un esecutore (`/execute`) che parte da zero e non sa nulla di come è nato.

> **Parametri.** Ogni chiave fra graffe di questo contratto si risolve sui file di parametri del
> progetto, mai a memoria e mai per assunzione: le regole sono nella §5 di
> `contracts/project-contract.md`, che dice anche **in quale lingua scrivere** e cosa fare quando
> una chiave non c'è.

## Input: cartella e soluzione scelta

Argomenti: `$ARGUMENTS`

L'argomento indica la **cartella** (dove vive `1. decision-doc.md`) e **quale soluzione** è stata scelta.

- Se manca la cartella, **chiedila**. Se non esiste, segnalalo e fermati.
- Cerca `1. decision-doc.md` nella cartella. Se non c'è, chiedi quale documento usare (potrebbe avere un altro nome) prima di procedere.
- **Identifica la soluzione scelta** confrontando l'indicazione dell'utente con le decisioni del documento. Se l'indicazione è ambigua o assente, **chiedi all'utente quale opzione ha scelto**, elencando le decisioni e le opzioni trovate nel documento. Questo — insieme alla cartella mancante, al documento di decisione non trovato e alle scelte reciprocamente incompatibili: i quattro casi elencati in questa sezione, e nessun altro — è l'**unico** momento in cui è lecito chiedere: qui l'utente è presente. Il brief che produci, invece, deve rendere l'esecuzione successiva autonoma.
- Se le decisioni nel documento sono più d'una, raccogli **tutte** le scelte dell'utente (una per decisione) prima di generare il brief.
- Con la cartella ricevi anche `{memory.index}` e i **path** delle memorie che il perimetro tocca, da aprire prima di decidere: è il canale di §4.1 di `contracts/orchestration.md`. Se il chiamante non te li passa, apri l'indice e scegli tu — un brief che ignora una decisione già presa la fa riscoprire all'esecutore a sue spese.
- Con più scelte, **verifica che siano reciprocamente coerenti** (l'opzione scelta per una decisione non deve contraddire quella di un'altra). Se sono incompatibili, segnalalo e chiedi all'utente come risolvere prima di generare il brief.

## Principi

1. **Solo ciò che serve.** Nel brief entra solo l'informazione necessaria a realizzare la soluzione scelta: la decisione pertinente, l'opzione scelta, la sua motivazione, i vincoli e le specifiche rilevanti, i criteri di completamento. **Scarta** le opzioni non scelte e le decisioni non correlate — non devono distrarre l'esecutore.
2. **Niente perdita di specifiche.** Tutto ciò che serve a eseguire deve essere *dentro* `2. blueprint.md` (o puntare esplicitamente a un file di riferimento nella cartella). L'esecutore non deve tornare al documento di decisione né all'utente per recuperare un dettaglio.
3. **Ancora il piano al codice reale, non solo al documento.** Il documento di decisione è ad alta astrazione e può non riflettere lo stato attuale del codice. Prima di congelare il piano, **leggi il codice e i file coinvolti** e verifica che le assunzioni reggano (i file esistono, le firme sono quelle attese, il punto d'innesto è dove credi). Se la realtà diverge dal documento, **adatta i task** e annota la divergenza. Un piano costruito senza guardare il terreno è la prima causa di errore.
4. **Verifica osservabile, non auto-dichiarata.** Ogni task ha un **criterio di verifica eseguibile**: il controllo osservabile più forte disponibile per quel tipo di lavoro — build, test, `grep`, un comando per il codice; un controllo concreto equivalente quando il lavoro non è codice (un file prodotto nella forma attesa, un output confrontabile). Mai "fatto quando sembra fatto": il verdetto è del controllo, non dell'esecutore. Niente task vaghi.
5. **Verifica di chiusura obbligatoria.** Gli ultimi task del piano sono sempre una verifica di chiusura: il controllo più forte **mirato al perimetro toccato** (per il codice: import dei moduli toccati e i soli test che coprono ciò che è cambiato; altrimenti il controllo concreto equivalente) e una auto-review del risultato contro i criteri di completamento iniziali. Senza questo, l'autonomia produce risultati sbagliati con sicurezza. Il gate di pacchetto — suite completa, lint, type-check, build — **non entra nel piano**: è di `/review`, che lo esegue sempre sul diff.
6. **Ancorato agli input.** Non inventare specifiche, vincoli o task che il documento, i file di riferimento e il codice non giustificano. Se un dettaglio operativo manca davvero, scrivilo come **assunzione esplicita** dentro il brief, così l'esecutore procede con consapevolezza invece di fermarsi.
7. **Tu prepari, non esegui.** Non modificare il codice del progetto. Puoi e devi **leggerlo** per ancorare il piano (principio 3), ma il tuo unico output scritto è `2. blueprint.md`.

## Procedura

1. **Risolvi la cartella** e apri `1. decision-doc.md`. Individua le decisioni e le opzioni.

2. **Fissa la/le scelta/e** dell'utente da `$ARGUMENTS` (o chiedendo, vedi *Input*).

3. **Distilla la soluzione scelta**: da cosa va fatto e perché, ai vincoli e alle specifiche, ai criteri di completamento. Tieni solo il materiale dell'opzione scelta.

4. **Ancora al codice reale.** Leggi i file e i punti del codice che la soluzione tocca. Verifica che le assunzioni del documento reggano e raccogli i path e i dettagli concreti che serviranno all'esecutore. Dove la realtà diverge dal documento, adatta di conseguenza il piano del passo successivo.

5. **Costruisci il piano di implementazione**: scomponi la soluzione in task ordinati e verificabili. Ogni task = un passo eseguibile + un **controllo osservabile** che lo dichiara concluso. Se un task ne presuppone un altro, mettilo dopo. **Apri** il piano con un task di ricognizione (verifica sul campo le assunzioni residue) e **chiudilo** con la verifica di chiusura obbligatoria (il controllo più forte mirato al perimetro — import e test del codice toccato — + auto-review contro i criteri di completamento).

6. **Scrivi `2. blueprint.md`** nella cartella di input, con la struttura sotto. Includi la riga di **provenienza** (da quale documento e versione/data nasce il brief). Se esiste già, **non** rieseguire il brief e non scriverne un secondo: segnalalo e chiudi col path esistente (vedi § *Cosa restituisci*). Salva nella codifica del progetto, senza degradare i caratteri non ASCII.

7. **Riepiloga in chat** in poche righe: la soluzione scelta e i task del piano in ordine. Il dettaglio sta nel file.

8. **Fermati qui.** `/blueprint` è atomico: non eseguire il piano e non lanciare nessun esecutore. Chiudi indicando il passo successivo — `/execute <cartella>` per eseguire il brief.

## Struttura del file prodotto (`2. blueprint.md`)

Il file è scritto **rivolgendosi all'esecutore** (seconda persona, imperativo operativo).

```text
# Esecuzione: <nome della soluzione scelta>

> Origine: <documento, versione/data> · Generato: <data>

## Mandato                          ← istruzioni di autonomia per l'esecutore
- Esegui questo piano dall'inizio alla fine **in autonomia**.
- **Non chiedere informazioni all'utente**: ogni specifica è già qui e la
  scelta è già stata fatta. Se un dettaglio sembra mancare, deducilo da questo
  brief e dai file di riferimento citati, non interrompere.
- Fermati e chiedi **solo** davanti a un vero blocco (azione distruttiva o
  irreversibile non giustificata dal brief, o contraddizione interna insanabile).
- **Questo file è la fonte di verità.** Se riprendi dopo un'interruzione o una
  compattazione del contesto, **rileggilo per intero** (stato dei task + Diario)
  prima di continuare: lo stato del lavoro vive qui, non nella memoria di sessione.
- Segui i task **nell'ordine** dato. Puoi **adattare il piano** (aggiungere,
  riordinare o sostituire task) solo quando l'esecuzione fa emergere fatti nuovi
  che lo rendono necessario: in tal caso aggiorna i task e **scrivi nel Diario
  perché**. Non saltare l'ordine per comodità.
- Aggiorna la **Memoria** man mano che procedi: spunta i task, annota decisioni,
  risultati e problemi.

## Vincoli e perimetro              ← guardrail per l'esecuzione autonoma
- Modifiche chirurgiche: tocca solo ciò che serve alla soluzione. Niente
  refactoring o miglioramenti fuori scope.
- Rispetta le regole architetturali del progetto (`{instructions_file}` e
  `.daiku/policies/`).
- Niente operazioni Git distruttive o remote (no reset --hard non giustificato,
  no push, no PR) salvo richiesta esplicita nel brief.
- Non fare (non-goals): <elenca ciò che è esplicitamente fuori da questa soluzione>

## La soluzione scelta              ← solo l'info necessaria, distillata
- Cosa va fatto e perché (la decisione e l'opzione scelta)
- Vincoli e specifiche rilevanti
- Criteri di completamento / quality gate
- Assunzioni esplicite (se qualche dettaglio operativo non era nel documento)
- File di riferimento e punti del codice utili (path nella cartella e nel repo)

## Memoria — piano e diario di esecuzione   ← piano pre-fatto, da compilare
   Stato: [ ] da fare · [~] in corso · [x] fatto

   - [ ] Task 0 — Ricognizione: verifica sul campo le assunzioni residue del
         brief (file/firme/punto d'innesto esistono come previsto).
         Verifica: <controllo osservabile; se diverge, adatta il piano e annota>
         Note:
   - [ ] Task 1: <passo eseguibile>
         Verifica: <controllo osservabile: build/test/grep/comando>
         Note: (compila durante l'esecuzione)
   - [ ] Task 2: ...
         Verifica: ...
         Note:
   ...
   - [ ] Task N — Verifica di chiusura: il controllo più forte mirato al perimetro
         (codice: import dei moduli toccati e i soli test che li coprono; altrimenti
         il controllo concreto equivalente) e auto-review del risultato contro i
         criteri di completamento. Il gate di pacchetto non va qui: è di `/review`.
         Verifica: il controllo passa; ogni criterio di completamento soddisfatto.
         Note:

   ### Diario
   (Appendi qui, in ordine, cosa hai fatto, le decisioni prese, le deviazioni dal
   piano e il perché, gli intoppi. Tieni allineato lo stato dei task qui sopra.)
```

Regola di taglio: chi legge `2. blueprint.md` deve poter eseguire l'intera soluzione **senza** aprire altri documenti se non i file di riferimento esplicitamente citati, e **senza** chiedere nulla all'utente.

## Dopo il brief

`/blueprint` finisce qui: il tuo unico output è `2. blueprint.md` e il riepilogo in chat. Non eseguire il piano nel tuo contesto e non lanciare esecutori. L'esecuzione è la skill separata `/execute` (che può girare in questo contesto o dentro un subagent) — atomica e sequenziale, invocata a mano dall'utente dopo il brief.

## Cosa restituisci

Invocato a mano, basta il riepilogo in chat. **Invocato dentro una catena** — la fase Brief di
`/deliver-feature` — chiudi con questo blocco, che è il solo formato su cui il chiamante decide se
proseguire:

```json
{"ok": true, "brief_path": "<path di 2. blueprint.md>", "detail": "<se ok=false, il motivo esatto>"}
```

Se `2. blueprint.md` esisteva già, **non** rieseguire il brief: `ok: true` col path esistente.

Lo schema sta qui, nel file del nodo che lo produce, e chi ti invoca lo cita invece di ricopiarlo
(§4.2 di `contracts/orchestration.md`): un blocco riscritto nel chiamante diverge da questo alla
prima modifica, e a divergere per prima è sempre la riga che qualcuno ha aggiunto dopo.
