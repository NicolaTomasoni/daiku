# Supporto Ant — la fase strategica che non c'è stata

> **Nota di metodo, 30/09/2026.** Scritta su richiesta dell'owner dopo la sessione
> `/daiku:new-feature` su questa cartella. **Non parla del progetto: parla di Daiku.** Serve a chi
> scrive e mantiene le skill, non a chi legge il codice di ReforgIA.
>
> L'owner l'aveva chiesta *nella root del repo*; il guardrail di scrittura la rifiuta lì — «i file
> nuovi stanno sotto `{code_root}` o in una sede dichiarata» — quindi vive qui, accanto alle prove
> di cui parla. Spostarla è un `git mv`, se si vuole altrove.
>
> **Il fatto in una riga.** La catena ha studiato per ore *come* tradurre Ant in Maven, e non ha
> mai chiesto all'owner *se* farlo — che è la domanda che l'owner ha posto al primo intervento, e
> la cui risposta ha smontato la premessa su cui poggiava tutto lo studio.

---

## Cosa è successo

1. L'owner ha aperto la feature con un brief già scritto da lui (`ANT.md`, nella root): analisi del
   progetto Ant, misure, **§5 «Punti di implementazione» P1–P8** e **§8 «Decisioni aperte» D1–D5**.
2. `new-feature` ha aperto questa cartella, lanciato **cinque fronti di investigazione** sul codice,
   **due studi** su tecnologie (`apache-ant`, `maven-pom-sintetico`), scritto `0. problem.md` e
   delegato **due volte** `decision-doc`.
3. **Entrambe le volte `decision-doc` ha restituito `stage: technical`** — la prima con otto
   decisioni, la seconda con nove. Nessuna mai posta all'owner.
4. Alla prima domanda posta in chat, l'owner si è fermato: *«fermati. perché stiamo generando dei
   pom da uno script ant? è corretto? è l'unica strada? non conosco ant, spiega»*.
5. Da quella domanda sono uscite tre verifiche sulle fonti ufficiali, una misura su un `build.xml`
   reale e una ricerca di strumenti esistenti. **La premessa centrale del brief è risultata
   falsa**, il campo si è riallargato, ed è stata valutata — e scartata dall'owner — una strada
   alternativa che lo studio non aveva mai nominato.

---

## Cosa ha deciso Daiku, senza chiedere

Nessuna di queste è mai stata presentata all'owner come opzione.

| Decisione presa in autonomia | Con che autorità |
|---|---|
| **Che la strada è tradurre lo script in descrittori Maven** | Ereditata dal brief, mai messa in discussione. `0. problem.md` ha una sezione intitolata *«Perché Ant non si provisiona»*: il documento del problema **argomentava per una soluzione** |
| **Che il canale Ant non esiste come alternativa** | Non è mai stato scritto, nemmeno per essere escluso. È comparso solo quando l'owner ha chiesto «è l'unica strada?» |
| **Che il bytecode per il grafo è fuori scopo** | Dedotto da `ANT.md` §9 |
| **Che la dashboard, la regola di conteggio e le cartelle fuori build sono fuori scopo** | Dedotto dal brief |
| **Otto decisioni, tutte della forma «A o B su una forma tecnica»** | Dove vanno i POM, un modulo o più, coordinate reali o sintetiche, packaging, quale mano per l'import morto, quanto largo il lettore… |

**Il tell più evidente, col senno di poi: zero domande della forma *se*, *per chi*, *chi decide*.**
Un elenco di otto decisioni in cui nessuna è un «whether» non è un elenco di decisioni strategiche
già chiuse — è una strategia data per scontata.

---

## Le prove emerse dopo — e che la fase strategica avrebbe dovuto pretendere prima

Tutte sono state ottenute **in ore**, con fan-out su fonti ufficiali. Erano disponibili il primo
giorno, e nessuna è stata chiesta perché nessuna serviva a *eseguire* la decisione già presa.

1. **jQAssistant non richiede Maven.** Distribuzione a riga di comando indipendente dal sistema di
   build, requisito: una JDK. Scansiona una cartella di classi con
   `jqassistant scan -f java:classpath::classes/`. E il suo goal `scan` **non compila**.
2. **Sonar non richiede Maven.** Lo shim riceve binari e librerie come proprietà da riga di
   comando e non legge nessun POM del progetto; `sonar.java.binaries` è l'**unico** parametro Java
   obbligatorio; la documentazione stessa indica la CLI per il codice costruito fuori da Maven e
   Gradle. Il POM serve al **nostro adapter**, per costruire il classpath.
3. **OpenRewrite non passa da Maven per ciò che conta.** Le sostituzioni di sorgente — la parte che
   fa compilare — **già oggi** non usano OpenRewrite: le fa un mapper testuale deterministico. Le
   uniche ricette Maven-shaped sono quelle che parlano di dipendenze, il cui oggetto *è* il POM.
4. **Da cui: la premessa del brief è falsa.** *«Tutto ciò che sta a valle parla Maven»* non regge.
   Gli strumenti chiedono **classi compilate e un classpath**. Ciò che è Maven-shaped è **il nostro
   codice**: ~16.000 righe di moduli, ~4.800 di nucleo intrecciato nel service, 7.530 righe di test
   che li nominano.
5. **E il costo dell'alternativa, misurato:** riesprimere il ciclo di riparazione su unità che Ant
   non ha costa **6–10 volte** il tradurre — ed è stato l'argomento che l'ha fatta scartare.
6. **Misura su un `build.xml` reale:** il lettore esistente restituisce **zero su ogni campo** —
   jar, source root, classpath — e **nessun errore**.
7. **Ricerca sugli strumenti esistenti:** non esiste, in open source, niente di utilizzabile.

Le voci 1–4 valgono da sole la fase strategica: **la decisione «tradurre in POM» poggiava su una
ragione sola, e quella ragione era falsa.**

---

## Gli indizi, col senno di poi

Ognuno era **sotto gli occhi** nella prima ora.

1. **Il brief dell'owner era già un piano di implementazione.** `ANT.md` arrivava con §5 «Punti di
   implementazione» e §8 «Decisioni aperte» — tutte quante sul *come*. La catena ha letto
   quell'impianto come direzione stabilita, invece di trattarlo come **input da interrogare**. Un
   owner che scrive otto punti di implementazione ha già deciso: è esattamente il momento in cui la
   fase strategica serve, non in cui è superflua.
2. **Il precedente era in repo, e diceva il contrario.**
   `docs/nuovi-sviluppi/0. Strategico/produttori-ant-nel-workspace/` registra che l'owner il
   **05/09/2026 aveva rinunciato ad Ant**, con l'indicazione di riusare la logica di esclusione
   invece di costruire il supporto. Lo studio l'ha citato in una riga, come *«precedente dichiarato,
   oggi superato da questa richiesta»* — **una decisione di tre settimane prima superata per
   deduzione, senza chiedere.** Che la richiesta nuova superi la vecchia è plausibile; che lo si
   decida da soli no.
3. **Il documento del problema argomentava.** Una sezione intitolata *«Perché Ant non si
   provisiona»* dentro `0. problem.md` è una tesi, non una descrizione. Un documento che spiega
   perché l'alternativa non va bene **ha già scelto**, e chi lo legge dopo non vede più
   l'alternativa.
4. **La `stage_why` si autogiustificava.** Entrambe le volte: *«la strategia è già assestata in
   `0. problem.md`»*. Ma `0. problem.md` era stato scritto dalla stessa catena, un'ora prima. **Un
   documento non può validare la propria premessa**, e citarlo come prova che la strategia è chiusa
   è un ragionamento circolare.
5. **La premessa centrale non è mai stata testata.** *«Tutto ciò che sta a valle parla Maven»* era
   nel brief, ed è stata accettata come fatto. Era verificabile in un'ora, e la verifica l'ha
   smentita. **La catena ha verificato il codice riga per riga e non ha verificato l'assunto** —
   cioè ha speso il massimo sull'eseguibile e zero sul decidibile.
6. **Il confine di scopo l'ha tracciato lo studio.** Che la dashboard, la metrica e il canale Ant
   stessero fuori è stato messo per iscritto *nello studio*, e l'owner l'ha letto solo a cose fatte.
   Un confine di scopo è una decisione di direzione: va tracciato dall'owner, o quantomeno mostrato.
7. **Le domande irrisolte c'erano, ma erano marcate come tecniche.** Gli `open_items` contenevano
   questioni vere — la transitività dello scope `system`, la deprecazione, la JDK per l'oracolo — e
   tutte presupponevano la strada già scelta. Nessuno diceva *«l'owner vuole ancora questo?»*,
   benché il repository contenesse un documento che diceva di no.

---

## Perché il giudizio è fallito

La skill chiede al nodo di distinguere due casi: il problema «ha ancora bisogno di pensiero
strategico» oppure «restano solo i dettagli tecnici da chiudere». Il nodo ha posto la domanda
sbagliata:

> Ha guardato **«esiste già una direzione?»** e, trovandone una scritta nel brief, ha risposto
> *tecnico*. La domanda giusta era **«la direzione è dell'owner, ed è stata messa alla prova?»**.

Le due domande coincidono solo se il brief dell'owner è un oracolo. **Non lo è: è il primo input.**
Un owner che apre una feature con un'analisi e un piano non ha chiuso la strategia — l'ha
*proposta*, ed è il momento in cui va interrogata, non trascritta.

Il costo dell'errore non è stato il lavoro sprecato: le note, le misure e i fronti di
investigazione servivano comunque, e hanno reso la discussione possibile. **Il costo è che la
domanda è arrivata dall'owner invece che dalla catena** — cioè la catena ha speso il suo sforzo per
rendere eseguibile una decisione che spettava a un altro, e quella decisione era sbagliata.

---

## Cosa lo avrebbe intercettato

Tre segnali, tutti meccanici, tutti disponibili prima di scrivere una riga di `1. decision-doc.md`:

1. **Se l'elenco delle decisioni non contiene almeno una domanda di direzione — *se*, *per chi*,
   *chi decide* — la fase non è tecnica.** Un elenco tutto di «come» è un sintomo, non una prova di
   maturità.
2. **Se il problema ha un precedente in repo che dice l'opposto, quel precedente è una domanda.**
   Non una nota a piè di pagina: *«avevi rinunciato a questo; cosa è cambiato?»*.
3. **Se la strategia è dichiarata «già assestata» citando un documento prodotto dalla stessa
   catena, non è assestata.** La direzione è assestata quando l'ha detta l'owner, non quando l'ha
   scritta lo studio.

E uno, non meccanico, che vale più degli altri tre: **la premessa su cui poggia la soluzione va
verificata come si verifica un'asserzione sul codice.** In questa sessione la catena ha verificato
decine di `file:riga` e non ha verificato la frase da cui dipendeva tutto — la quale, verificata, è
caduta.
