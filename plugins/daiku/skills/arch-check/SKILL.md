---
name: arch-check
description: Scansiona uno scope per violazioni delle regole architetturali del progetto (gli invarianti del file di istruzioni + le rule di area in .daiku/policies/); di default scansiona una cartella e applica le correzioni a soluzione unica, come finder di /review restituisce rilievi in sola lettura sul diff
---

Scansiona lo scope indicato per violazioni architetturali rispetto alle regole del progetto: gli **invarianti universali** che `{instructions_file}` dichiara e le regole di area in `.daiku/policies/`. Le regole **non** sono replicate qui: vengono lette da quei file a ogni esecuzione, così questa skill resta allineata quando l'architettura cambia.

> **Parametri.** Ogni chiave fra graffe di questo contratto si risolve sui file di parametri del
> progetto, mai a memoria e mai per assunzione: le regole sono nella §5 di
> `contracts/project-contract.md`, che dice anche **in quale lingua scrivere** e cosa fare quando
> una chiave non c'è.

## Due modalità

- **Default (scansione di una cartella).** Risolvi lo scope da `$ARGUMENTS`, scansiona, riporta le violazioni e **applica** le correzioni a soluzione unica. È il comportamento descritto in tutto il resto di questo file.
- **Finder (invocata da `/review`).** Scope = il diff passato dal chiamante, non una cartella. **Sola analisi**: nessuna modifica a file, nessun fix, nessun file nuovo, nessun commit — il passo 7 della *Procedura* **non si esegue**. Restituisci il blocco JSON del chiamante invece del report in chat. Vedi *Modalità finder* in fondo; tutto il resto del file — da dove vengono le regole, come si traduce una regola in un controllo, cosa conta come violazione — resta valido, cambia solo il perimetro e la forma dell'esito.

## Input: scope da analizzare

Argomenti: `$ARGUMENTS`

L'argomento è **una sola cartella** del repository da analizzare, come path relativo dalla root. Accetta anche il nome breve di un'unità del repo (app, package, modulo) e risolvilo nel path corrispondente.

- Lo scope te lo passa **chi ti invoca**, e questo contratto non si lancia a mano: se non ti è arrivato, **fermati e dillo nel blocco** invece di sceglierlo tu. Non scansionare mai l'intero repo di tua iniziativa.
- Se `$ARGUMENTS` non corrisponde a una cartella esistente, segnalalo e fermati.
- Tutta la scansione è confinata allo scope risolto: i file bersaglio, i grep e le violazioni riguardano solo quella cartella. Ignora il resto del repo.
- Considera **solo** le regole pertinenti a quella cartella. Salta in silenzio le regole che riguardano altre aree.

## Fonte delle regole

Le regole vivono in due posti e **vanno lette entrambe a ogni esecuzione**:

1. `{instructions_file}`: gli invarianti universali che dichiara, validi ovunque. La sezione che li raccoglie ha il nome che quel file le dà — leggilo, non cercare un titolo a memoria.
2. `.daiku/policies/`: le regole di area. Elenca la cartella, leggi il frontmatter `paths` di ogni file e **apri quelli i cui pattern coprono la cartella sotto scansione**. Non contare sul caricamento automatico: scatta solo quando apri un file che matcha, e la scansione lavora anche per grep.

Da ciascun file, le regole da verificare sono gli elenchi espliciti di vincoli e gli invarianti annotati nei diagrammi a strati (es. «il layer X non importa mai Y»).

Tratta ogni regola come un invariante verificabile. Se il testo cambia, cambia anche cosa verifichi — non fidarti di una lista memorizzata.

## Procedura

0. **Risolvi la cartella** da `$ARGUMENTS` (vedi *Input*). Verifica che esista. Da qui in poi tutto è confinato a quella cartella.

1. **Leggi** gli invarianti di `{instructions_file}` e le rule di `.daiku/policies/` che coprono la cartella scelta (vedi *Fonte delle regole*), ed estrai la lista corrente di regole, **tenendo solo** quelle pertinenti.

2. Per ogni regola pertinente, **traducila in un controllo** su file + pattern, sempre dentro lo scope:
   - Identifica i file bersaglio dal diagramma a strati o dal testo della regola (estensione, suffisso, cartella del layer).
   - Deriva il pattern di violazione dal testo della regola (es. «il layer X non importa Y» → grep sugli import di Y nei file del layer X).

3. **Salta le regole inattive.** Una regola è inattiva se il layer o il file che presuppone non esiste ancora (cartella assente o vuota, solo placeholder). Verifica l'esistenza prima di greppare.

4. **Grep in parallelo** per tutte le regole attive.

5. **Raccogli le violazioni.** Per ciascuna mostra:
   - **Regola:** il testo esatto della regola, col file da cui viene (`{instructions_file}` o la rule di area)
   - **File:** percorso relativo dalla root del repo
   - **Riga:** numero e contenuto della riga incriminata
   - **Perché è una violazione:** una frase
   - **Correzione proposta:** cosa fare concretamente (sposta import, crea wrapper, ecc.)

6. Se una regola attiva non produce violazioni, scrivilo esplicitamente — non saltarla in silenzio. Se una regola è inattiva, dillo e indica perché.

7. **Applica le correzioni a soluzione unica.** *(Solo in modalità default: in modalità finder questo passo non si esegue — vedi in fondo.)* Se una violazione ha **una sola** correzione ragionevole senza trade-off significativi, applicala direttamente — **anche se non banale**. Lascia non applicata, elencandola sotto **Da confermare** con le opzioni, **solo** una correzione per cui esistono **due o più** implementazioni possibili tra cui scegliere.
   - Applica una correzione alla volta.
   - Se serve un nuovo file (es. un wrapper richiesto da una regola), crea il minimo necessario senza logica speculativa.
   - Dopo ogni modifica, verifica che il file sia sintatticamente valido e **salvato nella codifica del progetto**, senza degradare i caratteri non ASCII.

## Modalità finder (invocata da `/review`)

Attiva quando `/review` ti invoca. Non è una scansione di cartella da riportare in chat: è un canale
di analisi sul diff, come `bug`/`perf` — ma **solo analisi**: nessuna modifica a file,
nessun fix, nessun file nuovo, nessun commit.

- **Scope = il diff**, non una cartella. Il chiamante ti passa `BASE` e i file del giro: le regole si
  verificano **sulle righe aggiunte** e su ciò che quelle righe implicano. Un file aperto per capire
  un chiamante è contesto lecito; una violazione preesistente fuori dal diff non è un rilievo di
  questo giro.
- **Le regole si leggono lo stesso, e allo stesso modo.** La sezione *Fonte delle regole* vale
  identica: gli invarianti di `{instructions_file}` più i file di `.daiku/policies/` i cui `paths` coprono i file
  dello scope. Elencali e **aprili**: il caricamento automatico scatta aprendo un file che matcha,
  non ispezionando un diff.
- **Confidenza alta:** la regola nomina il vincolo e il diff lo esibisce — un import che il layer non
  può fare, una chiamata a un sistema esterno fuori dagli adapter, un accesso al filesystem fuori
  dalla facciata. Citi la regola e la riga. `cambiamento` riporta la correzione concreta.
- **Confidenza media:** violazione che dipende da come si legge il confine fra due layer, o da una
  responsabilità che il file assume solo in un ramo — nomina nella `descrizione` la lettura che la
  rende una violazione. `cambiamento` riporta comunque la correzione.
- **Confidenza bassa:** sospetto che per confermarsi richiede di aprire il chiamante o di ricostruire
  un flusso che il diff non mostra — nessun `cambiamento`; la `descrizione` dice cosa andrebbe
  verificato.
- **Le regole inattive e quelle senza violazioni non si riportano.** In modalità default vanno
  dichiarate esplicitamente; qui il ritorno è un elenco di rilievi, e un elenco vuoto è una risposta
  valida.
- **Non applichi nulla.** La decisione di applicare o scartare ogni rilievo è dell'applicatore di
  `/review`, che lo riverifica.
- **Nessun report in chat**: restituisci il blocco dichiarato da `skills/finder-prompt/SKILL.md`
  § *Il blocco che restituisci*, per intero e con quei nomi di campo: leggilo da lì, qui non è
  ricopiato. Per questa disciplina `simbolo` è la classe, la funzione o il modulo che porta la
  violazione, `cambiamento` è la correzione concreta, e `descrizione` porta la regola violata col
  file da cui viene, l'evidenza sulla riga, e per la confidenza bassa cosa resta da verificare.
