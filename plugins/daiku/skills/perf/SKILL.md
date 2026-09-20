---
name: perf
description: 'Investiga uno scope per colli di bottiglia di performance (CPU, GPU, I/O, rete, rendering); default propone quick win senza toccare codice, come finder di /review restituisce rilievi in sola lettura sul diff'
---

# Obiettivo

Investiga lo scope indicato e individua cosa rende l'applicativo pesante, lento o eccessivamente costoso in risorse. **Nella modalità di default non modificare codice, configurazioni o test:** è un'indagine, non un fix.

> **Parametri.** Ogni chiave fra graffe di questo contratto si risolve sui file di parametri del
> progetto, mai a memoria e mai per assunzione: le regole sono nella §5 di
> `contracts/project-contract.md`, che dice anche **in quale lingua scrivere** e cosa fare quando
> una chiave non c'è.

## Due modalità

- **Default (indagine).** Investighi e proponi quick win in chat, senza toccare nulla. È il comportamento descritto in tutto il resto di questo file.
- **Finder (invocata da `/review`).** Scope = il diff passato dal chiamante, non una cartella. **Sola analisi**: nessuna modifica a file, nessun fix, nessun commit. Restituisci il blocco JSON del chiamante invece del report in chat. Vedi *Modalità finder* qui sotto; tutto il resto del file (cosa cercare, criteri di classificazione) resta valido, cambia solo la forma dell'esito.

## Il dominio di questo progetto

Leggi `.daiku/domain/perf.md`: porta quali tecnologie occupano i tre livelli che questa skill ispeziona e dove ciascuna paga davvero, quali tool esterni entrano nel costo di un flusso, quali costi si manifestano a riposo, come si risolve il nome breve di un'unità nella sua cartella e come si osserva il runtime. Se non esiste, ricostruisci lo stack leggendo il repository, accetta come scope solo path espliciti, limitati alla valutazione statica, e dichiaralo nell'esito.

Il focus è ridurre:

* utilizzo CPU e GPU;
* lavoro inutile in runtime (rendering, polling, loop, retry, ricalcoli);
* carichi eccessivi su memoria, I/O, rete o processi esterni.

## Argomento: scope

Argomento: `$ARGUMENTS`

Risolvi lo scope prima di fare qualsiasi altra cosa:

* L'argomento è un **path o glob** relativo alla root del repo — la cartella di una feature, di un layer o di un modulo. Usalo verbatim.
* Accetta anche il **nome breve** di un'unità del progetto (feature frontend, service, adapter, flusso) e risolvilo nella sua cartella, aiutandoti con i cataloghi che il file di dominio indica.
* Può essere anche un **flusso** trasversale (l'esecuzione di un tool esterno, il polling di uno stato, un ciclo di elaborazione): ricostruiscilo attraverso i layer, senza assumere che l'intero repository sia nel perimetro.
* **Senza scope** → questo contratto non si lancia a mano: lo scope arriva da chi ti invoca. Se non è arrivato, **fermati e dillo nel blocco**, elencando le aree plausibili perché chi ti ha chiamato possa sceglierne una. Non partire mai sull'intero repo.

Se il path risolto non esiste, segnalalo e fermati.

# Modalità di lavoro

Prima **ricostruisci il flusso reale** dello scope: entrypoint, chiamate, stato, componenti, processi lanciati, polling, cache, query, job asincroni, rendering, adapter e tool esterni coinvolti.

Poi cerca colli di bottiglia e sprechi, dando priorità a **quick win a basso rischio**.

Valuta l'utilizzo di risorse sia **in idle** sia **durante i processi**: parecchi costi si manifestano a riposo e non sotto carico, e un'indagine che guarda solo il carico li perde tutti. Quali siano, in questo progetto, lo dice il file di dominio.

## Cosa cercare

**Tre livelli, ed è una lettura di default, non una legge.** Un progetto la cui architettura non si divide così lo dichiara in `.daiku/domain/perf.md`, e allora valgono i livelli che dichiara lui. Quali tecnologie li occupino, e i punti caldi che ciascuna si porta dietro, lo dice lo stesso file: qui sotto stanno le forme di spreco, non i nomi di chi le produce.

**Interfaccia e rendering:**

* rendering ripetuti o componenti che ricalcolano troppo; assenza di memoizzazione mirata;
* gestione inefficiente delle sottoscrizioni a dati e del lavoro legato al ciclo di vita di un'unità di interfaccia; polling troppo aggressivo o senza bail-out;
* fetch o query duplicati; invalidazione troppo ampia;
* GPU tenuta sveglia da animazioni continue, da superfici ridisegnate a ogni frame o da effetti visivi non necessari.

**Servizio applicativo:**

* loop frequenti o non limitati; concorrenza non controllata;
* dati letti/ricaricati più volte o più grandi del necessario;
* trasformazioni costose nel punto sbagliato; serializzazione/deserializzazione ripetuta;
* operazioni sincrone che bloccano il flusso; file letti o scritti inutilmente;
* log troppo verbosi in percorsi caldi.

**Processi e tool esterni:**

* processi lanciati più spesso del necessario o senza cache;
* orchestrazione inefficiente, retry, scansioni duplicate;
* configurazione o invocazione subottimale.
* Distingui sempre tra **costo inevitabile del tool** e costo dovuto a orchestrazione, retry/polling, mancata cache o invocazione subottimale.

**Trasversale:** dipendenze con versioni datate (valuta se un aggiornamento è consigliato e a quale rischio), assenza di debounce/cache/invalidazione mirata.

# Vincoli

* Rispetta lo scope indicato: nessun finding o proposta fuori perimetro.
* Non proporre riscritture ampie se esiste un'ottimizzazione locale.
* Non proporre nuove dipendenze salvo necessità forte e motivata.
* Non introdurre architetture parallele.
* **In modalità default:** non modificare codice, configurazioni o test; non eseguire fix; non creare commit. (In nessuna modalità si modifica codice; in modalità finder si restituiscono rilievi, vedi sotto.)
* Non fare benchmark distruttivi o comandi pesanti senza prima motivarli.

# Modalità finder (invocata da `/review`)

Attiva quando `/review` ti invoca. Non è un'indagine da riportare in chat: è un canale di analisi sul diff, come arch/bug — ma **solo analisi**: nessuna modifica a file, nessun fix, nessun commit.

- **Scope = il diff**, non una cartella. Cerca colli di bottiglia **solo nel codice toccato dalla feature**; non allargare a codice adiacente non modificato: modifiche chirurgiche, niente refactoring fuori scope.
- **Confidenza alta:** win evidente all'ispezione e behavior-preserving — N+1 query, ricalcolo/riserializzazione ridondante, memoizzazione mancante, polling senza bail-out, invalidazione troppo ampia, lettura ripetuta degli stessi dati. `cambiamento` riporta il fix concreto.
- **Confidenza media:** probabile, ma con una condizione da verificare sul codice — nominala nella `descrizione`. `cambiamento` riporta comunque il fix concreto.
- **Confidenza bassa:** impatto che per giustificarsi richiederebbe una misura o un benchmark (è impatto ipotetico) — nessun `cambiamento`; la `descrizione` porta la misura consigliata.
- **Non applichi nulla.** La decisione di applicare o scartare ogni rilievo è dell'applicatore di `/review`, che lo riverifica.
- **Nessuno stop interattivo, nessun output in formato indagine.** Non stampi il report `# Esito indagine performance`: restituisci il blocco dichiarato da `skills/finder-prompt/SKILL.md` § *Il blocco che restituisci*, per intero e con quei nomi di campo: leggilo da lì, qui non è ricopiato. Per questa disciplina `simbolo` è la classe, la funzione o il componente in cui vive il collo di bottiglia, `cambiamento` è il fix concreto, e `descrizione` porta problema ed evidenza, e per la confidenza bassa la misura consigliata.

Se servono misurazioni, privilegia lettura del codice e comandi leggeri. Come si avvia l'applicazione e dove risponde lo dice il file di dominio, che rimanda alla sola fonte di quei valori: se osservi il runtime, dichiara cosa hai misurato. Se non puoi misurare, dichiara esplicitamente nella `descrizione` del finding che la valutazione è **statica**.

# Criteri di classificazione

Classifica ogni finding con:

* **impatto stimato:** Alto | Medio | Basso;
* **rischio intervento:** Basso | Medio | Alto;
* **tipo:** CPU | GPU | memoria | I/O | rete | rendering | concorrenza | tool esterno | architettura | configurazione;
* **evidenza:** file, funzione, hook, endpoint, service, adapter, comando o flusso osservato;
* **quick win:** intervento minimo e concreto;
* **verifica:** come misurare o confermare il miglioramento.

Distingui tra: quick win immediata · ottimizzazione utile ma non urgente · ipotesi da misurare · intervento strutturale non adatto come quick win.

# Output finale

Rispondi in chat con questo formato:

```md
# Esito indagine performance

## Scope analizzato
- Scope ricevuto:
- File/flussi analizzati:
- Comandi o verifiche eseguite:
- Limiti dell'analisi (statica/misurata):

## Sintesi
- Causa principale probabile:
- Area più costosa:
- Quick win più conveniente:
- Rischio complessivo degli interventi:

## Quick win consigliate

### 1. <titolo>
Tipo: CPU | GPU | memoria | I/O | rete | rendering | concorrenza | tool esterno | configurazione
Impatto stimato: Alto | Medio | Basso
Rischio intervento: Basso | Medio | Alto
Evidenza: <file/funzione/flusso>
Problema: <descrizione concreta>
Quick win: <intervento minimo proposto>
Perché dovrebbe migliorare: <spiegazione sintetica>
Verifica consigliata: <controllo o metrica>

### 2. <titolo>
...

## Ipotesi da misurare

### 1. <titolo>
Evidenza parziale:
Misura consigliata:
Possibile intervento:

## Interventi da evitare per ora
- <intervento>: <motivo>

## Priorità proposta
1. <prima azione consigliata>
2. <seconda azione consigliata>
3. <terza azione consigliata>
```

Se non trovi quick win reali, dillo esplicitamente e indica solo le ipotesi da misurare.

Non modificare file. Non creare commit.
