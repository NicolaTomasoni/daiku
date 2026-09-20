---
name: init
description: 'Apre Daiku su un progetto che non lo ha ancora: scrive `.daiku/` — `project.json`, `domain/`, `policies/` — l''`environment.json` dell''owner e il file di istruzioni del progetto, partendo dagli scheletri del pacchetto e compilandoli con quello che legge nel repository. Idempotente: non sovrascrive mai un file che esiste. Si lancia una volta per progetto, e di nuovo quando il pacchetto porta uno scheletro nuovo.'
argument-hint: '[radice tecnica, opzionale — default: la directory corrente]'
---

Sei il passo che rende un progetto **utilizzabile da Daiku**. Nessuno dei due host lascia che un
pacchetto scriva dentro il progetto dell'utente: i livelli Parametri e Dominio non possono essere
consegnati dall'installazione, possono solo essere **generati** da un comando che l'utente lancia.
Quel comando sei tu, e sei l'unica via ammessa.

Scrivi poco e dichiari molto. Il tuo esito non è «fatto»: è l'elenco di cosa hai scritto, di cosa
hai lasciato vuoto perché non avevi il diritto di indovinarlo, e di cosa resta da compilare a mano
prima che le skill funzionino davvero.

## Non hai parametri di progetto, e sei l'unico

Ogni altro contratto apre `.daiku/project.json` prima di agire. Tu no: giri **prima** che quel
file esista, ed è tuo compito scriverlo. Non cercarlo, non fermarti perché manca, non dedurre
valori da un altro progetto. Quello che ti serve lo ricavi dal repository che hai davanti, e ciò
che il repository non dice resta non dichiarato.

La forma di ciò che scrivi è in `contracts/project-contract.md`, e le chiavi che consuma
l'orchestrazione sono nella §7 di `contracts/orchestration.md`. Quei due file sono la tua
specifica: se divergono da questo, valgono loro.

## Input: la radice tecnica

Argomenti: `$ARGUMENTS` — `[radice tecnica]`.

La **radice tecnica** è la directory da cui le skill girano, quella che porta il file di
istruzioni del progetto — `CLAUDE.md` su Claude Code, `AGENTS.md` su Codex. Non è sempre la root
del repository: un monorepo può avere il codice sotto una sottocartella e la radice tecnica lì
dentro.

- Con un argomento, è quella. Verifica che esista e che sia dentro un repository Git.
- Senza argomento, è la directory corrente. Se non è dentro un repository Git, fermati e dillo:
  non inizializzi un repository al posto dell'utente.
- Se `.daiku/` esiste già, non è un errore: prosegui in modalità **completamento** (vedi
  *Idempotenza*).

## Dove stanno gli scheletri

Sotto `templates/`, nella radice del pacchetto — la cartella che contiene `skills/`, `contracts/`
e `templates/`, due livelli sopra questo file. È un path **relativo al pacchetto**, non al
progetto: vale su entrambi gli host, mentre una variabile d'ambiente di path esiste solo su uno
dei due.

| Scheletro | Dove lo scrivi | Cosa ne fai |
|---|---|---|
| `templates/project/project.json` | `.daiku/project.json` | lo **compili**: vedi *Passo 3* |
| `templates/project/domain/` | `.daiku/domain/` | ne copi **tutti** i file com'è: vedi *Passo 5* |
| `templates/project/policies/` | `.daiku/policies/` | ne copi **tutti** i file com'è: vedi *Passo 5* |
| `templates/project/instructions.md` | il file di istruzioni, nella radice tecnica | lo **riempi**: vedi *Passo 6* |
| `templates/owner/environment.json` | `~/.daiku/environment.json` | lo **svuoti e ricompili**: vedi *Passo 4* |

**Tutto ciò che scrivi è in inglese**, qualunque lingua l'utente abbia scelto al *Passo 0*. Quelle
due chiavi dicono in che lingua le skill parleranno all'utente e scriveranno i commit; non dicono
in che lingua è fatto Daiku. Gli scheletri arrivano in inglese e li compili in inglese: un file di
istruzioni mezzo tradotto è la forma peggiore delle due, e un corpus in una lingua sola è l'unica
cosa che resta leggibile quando il progetto passa di mano.

Gli scheletri si leggono a ogni esecuzione, e **si copiano tutti quelli che trovi**, non un elenco
che tieni a mente: se il pacchetto ne porta uno nuovo, dev'essere sufficiente rilanciarti. Non
tenerne a mente il contenuto: se il pacchetto si aggiorna, il contenuto cambia sotto di te ed è
quello nuovo a dover uscire.

## Procedura

### 0. Chiedi le due lingue

È **l'unica cosa che chiedi**, e la chiedi perché è l'unica che il repository non può dirti con
certezza: due progetti identici possono volere lingue diverse, e sbagliare qui si vede in ogni
riga che le skill scriveranno d'ora in poi.

Sono due domande, non una, perché sono due pubblici diversi (§5.5 di
`contracts/project-contract.md`):

1. **la lingua di chat** — risposte, riepiloghi, referti e i documenti che il metodo produce;
2. **la lingua dei commit** — messaggi di commit e voci di changelog, cioè ciò che resta nella
   storia condivisa del repository.

Riguardano **il futuro**, non questa esecuzione: nessuna delle due cambia una riga di ciò che stai
per scrivere, che è in inglese comunque rispondano. Chiedile lo stesso, e prima di tutto il resto,
perché finiscono in `project.json` e perché il referto con cui chiudi è il primo testo a cui si
applicano.

**Non chiedere a freddo: proponi.** Prima guarda, in sola lettura, e porta una proposta motivata —
la lingua del `README.md` e del file di istruzioni per la chat, quella degli ultimi messaggi di
`git log --oneline -30` per i commit. Poi chiedi conferma in una domanda sola, dicendo cosa hai
osservato. Su un repository vuoto, o dove le due fonti non concordano, dillo e chiedi senza
proporre.

Se l'utente non risponde — perché stai girando dentro una catena, o perché la sessione non ha un
canale interattivo — **non inventare**: lascia le due chiavi fuori da `project.json` ed elencale
fra le cose da compilare. La §5.5 dichiara già cosa succede senza di esse, e un default silenzioso
qui è peggio della loro assenza.

### 1. Riconosci l'host

Su **Claude Code** gli hook e i subagent li porta il pacchetto e si aggiornano da soli: **non**
agganci quei tre hook una seconda volta da `.claude/settings.json`, perché li aggancia già il
pacchetto e ogni guardia girerebbe due volte. L'unica cosa che scrivi sotto `.claude/` è una
chiave sola in `settings.local.json`, ed è al *Passo 7*: serve a portare la memoria dell'host
dentro il repository, e non c'è altro modo di dirlo all'host.

Su **Codex** il manifest rifiuta `agents` e `hooks`, e `plugin_hooks` è una feature rimossa:
quello strato va scritto dentro il progetto, sotto `.codex/`. **Non lo scrivi tu**: è il mestiere
di `sync-host`, che copia i `.mjs`, li prova col loro banco e aggancia solo quelli sani, e che
genera i `.codex/agents/*.toml` dai ruoli del pacchetto. Chiudi il referto dicendo di lanciarla —
finché non gira, quel progetto non ha né guardrail né ruoli di subagent.

Non chiedere all'utente su quale host gira: lo sai da dove stai girando. L'host è l'unica cosa
che **non** chiedi; le due lingue del *Passo 0* sono l'unica che chiedi.

### 2. Leggi il repository prima di scrivere

Questa lettura serve a due cose molto diverse: i parametri del *Passo 3*, che sono valori esatti,
e il file di istruzioni del *Passo 6*, che è il ritratto di un progetto. Il secondo chiede molto
più del primo, ed è per questo che qui si legge largo.

Raccogli, in sola lettura:

- la root del repository (`git rev-parse --show-toplevel`) e la posizione della radice tecnica al
  suo interno;
- **tutti i file `.md` del repository**, esclusi quelli sotto le directory di dipendenze e di
  build (`node_modules/`, `venv/`, `target/`, `dist/` e simili). README, documento tecnico,
  decisioni architetturali, changelog, appunti: è lì che il progetto ha già scritto di sé, e non
  c'è niente che tu possa dedurre in mezz'ora che valga quanto una frase scritta da chi c'era;
- **la struttura del repository per intero** — l'albero delle directory, non il solo primo
  livello. Ti serve per riconoscere le aree, per proporre i `paths`, e perché la forma di un
  progetto dichiara la sua architettura prima di qualunque documento;
- **l'inventario tecnologico**: i manifest di build presenti (`package.json`, `pyproject.toml`,
  `Cargo.toml`, `go.mod`, `pom.xml` e simili) con le dipendenze e gli script che dichiarano, i
  file di lock per le versioni davvero installate, e i file di configurazione di runner, linter,
  type-checker, formatter, CI, container e orchestrazione. Ne ricavi linguaggi e versioni,
  package manager, framework, database e storage, catena di build e di test, e come la cosa si
  avvia in locale — porte comprese;
- il file di istruzioni del progetto, se c'è, e ogni altro file che l'host carica da sé.

Il limite è uno solo, ed è dove passa il confine fra leggere e indovinare: **raccogli ciò che il
repository dichiara di sé.** Un `package.json` dice quale runner di test c'è, e quello lo scrivi;
non dice quanto quel runner copra, e quello non lo scrivi. Non serve aprire il codice applicativo
file per file — non stai facendo una review, stai compilando una scheda — ma aprire il sorgente di
un punto d'ingresso per capire come una cosa si avvia è lettura legittima, non analisi.

### 3. Scrivi `.daiku/project.json`

Parti dallo scheletro, **svuotalo di ogni valore che non riguarda questo progetto** e ricompilalo
chiave per chiave con la tabella §4 di `contracts/project-contract.md` sotto gli occhi. Tre regole,
e sono le stesse che reggono tutto il resto del metodo:

- **Un comando è la riga esatta da eseguire più la cwd da cui eseguirla.** Se nel repository
  quella riga non è dichiarata da nessuna parte, la chiave **non si scrive**. Un gate indovinato è
  peggio di un gate assente: assente fa saltare un passo e lo dichiara, indovinato fa fallire un
  passo e sembra un problema del progetto.
- **Ciò che non è dichiarato non esiste.** Un progetto senza frontend non ha un'area frontend
  vuota: non ha la chiave. Vale per `worktree`, per `coverage`, per `tech_doc`, per tutto.
- **`memory.root` e `memory.index` sono l'eccezione, e si scrivono sempre.** Non sono il rilievo
  di qualcosa che il repository ha già: sono la sede che stai assegnando a un corpus che il metodo
  scriverà comunque, perché `update-memory` gira a **ogni** commit. Se il repository ha già una
  cartella di memoria, è quella; se non ce l'ha, proponi `.daiku/memory/` con `MEMORY.md` dentro,
  e dillo nel referto. Su Claude Code quella cartella diventa anche dove l'host scrive la propria
  memoria (*Passo 7*), e allora dichiararla non è più una scelta: è il presupposto del passo.
- **`contract` si copia dallo scheletro**, non lo inventi e non lo incrementi.

Per le aree: il nome dell'area è una tua scelta di nomenclatura, i suoi `paths` no — sono i path
reali che le appartengono, usabili come pathspec Git. Dichiara un'area solo se ha davvero un gate
proprio; due cartelle che passano dallo stesso comando sono una sola area.

Le due chiavi di **lingua** sono l'eccezione alla prima regola, e solo perché le hai chieste: le
scrivi con le risposte del *Passo 0*, verbatim. Se non hai avuto risposta, non le scrivi.

Le quattro chiavi di `paths` — dove vivono le cartelle di lavoro, gli appunti, la coda notturna e
il ledger di review — le **proponi** guardando cosa il repository ha già: una cartella di studi che
esiste vale più di un nome inventato. Se non c'è nulla di simile, scegli tu un percorso coerente
con la struttura che hai davanti e **dillo nel referto**, perché quelle cartelle le creeranno le
skill al primo uso ed è bene che l'utente sappia dove.

Le due chiavi di `guardrails` le lasci **spente**, e le elenchi nel referto fra le cose che
l'utente decide. Accendono i dinieghi della guardia sui comandi — `git push` e `git commit
--no-verify` — e non sono una preferenza da indovinare: dipendono da come quel repository è
tenuto, e un diniego comparso da solo è la cosa che fa disinstallare un pacchetto. Nel referto
dì cosa accendono e dove si accendono, in una riga.

Quando un valore è ricavabile ma non certo — un `tech_doc` plausibile, un `changelog` che potrebbe
essere quello — **non scriverlo di nascosto**: o lo confermi con quello che hai letto, o lo lasci
fuori e lo elenchi nel referto fra le cose da compilare.

### 4. Scrivi `~/.daiku/environment.json` se manca

È il file dell'**owner**, non del progetto: host di default, modello per ruolo, backend
disponibili, path di macchina. Cambia da persona a persona e da macchina a macchina, non da
progetto a progetto — e per questo **non sta nel progetto**: sta nella home, uno solo per
macchina, e vale per tutti i progetti su cui l'owner lavora.

Guarda nelle due sedi che la §8 di `contracts/project-contract.md` dichiara, nel suo ordine:
prima `.daiku/environment.json` nella radice tecnica, poi `~/.daiku/environment.json`. **Se ne
trovi uno, non toccarlo**: è la cosa che meno ti appartiene di tutte, e un override di progetto
che qualcuno ha scritto apposta lo si rispetta come il file di casa.

Se non c'è né l'uno né l'altro, scrivi quello nella **home** — mai quello di progetto, che è
un'eccezione e la sceglie l'utente. Parti dallo scheletro svuotato di ogni valore altrui — niente
base URL di un altro owner, niente `temp_dir` di un'altra macchina — tenendo solo la forma,
`contract`, e l'host da cui stai girando come `default_host`. Il resto lo compila l'utente.

**«Altrui» vuol dire di un'altra persona o di un'altra macchina, non «già scritto».** Gli alias di
tier che lo scheletro porta compilati, e i path di configurazione di un host, valgono per chiunque:
quelli restano. Si toglie ciò che identifica qualcuno.

Dichiara nel referto **il path assoluto** di quello che hai scritto: sta fuori dal repository, non
lo vedrà nel diff, e finché non lo compila nessun passo sa con quale modello girare.

Se lo scheletro contiene ancora valori riconoscibilmente di un altro progetto o di un'altra
macchina, non li propagare: toglili e segnalalo nel referto.

### 5. Crea `domain/` e `policies/`

Copia **tutti** i file di ciascuno scheletro, senza modificarli: `templates/project/domain/` in
`.daiku/domain/`, `templates/project/policies/` in `.daiku/policies/`. Sono le uniche due cartelle
che nascono non vuote, e le uniche due cose che deponi senza scrivere una riga.

Dentro ci sono due cose diverse, e vale la pena distinguerle:

- **Il README di ciascuna** è la convenzione della cartella: come si nomina un file di dominio,
  cosa deve avere nel frontmatter un file di politiche. Non è contenuto di merito.
- **Gli scheletri di dominio già scritti** — oggi `commit-convention.md`, domani forse altri —
  sono **default**, non regole del pacchetto. Li deponi e finisce lì: da quel momento sono
  dell'utente, e la tua idempotenza garantisce che nessun rilancio glieli riscriva
  (§5.4 di `contracts/project-contract.md`).

**Non inventare un file di dominio che il pacchetto non porta**, e non dedurre politiche
dall'architettura che hai intravisto. Un default scritto da chi ha costruito Daiku è una proposta
dichiarata, che si vede e si cambia; un file che scrivi tu adesso è la tua impressione di dieci
minuti travestita da regola, e nessuno saprebbe più distinguere le due cose.

### 6. Scrivi il file di istruzioni

È il file che l'host carica a ogni sessione — `CLAUDE.md` su Claude Code, `AGENTS.md` su Codex —
e va nella radice tecnica, col nome che hai dichiarato in `instructions_file`. Parti da
`templates/project/instructions.md`, che porta la struttura canonica e, dentro, due materiali che
non vanno confusi.

- **La prosa già scritta è un default del pacchetto**, come `commit-convention.md`: le sezioni
  *Behaviour* e *Git and commits*, e le quattro hard rule di serie, valgono per chiunque lavori
  con Daiku e non dipendono da questo repository. Si copiano come sono. Non riscriverle con parole
  tue: sono state scritte una volta perché fossero le stesse ovunque.
- **I segnaposto fra parentesi angolari sono il tuo lavoro**, e si compilano con quello che hai
  letto al *Passo 2* — non con quello che sarebbe sensato.

#### Cosa va nei segnaposto

La *Documentation map* elenca gli artefatti che esistono **in questo progetto**, con il mestiere di
ciascuno: una riga per artefatto reale, e la riga di uno che non c'è si toglie invece di restare
con dentro un path inventato.

Lo *Stack and local environment* è l'inventario tecnologico del *Passo 2*, scritto per intero. È
la sezione che rende quel file utile dal primo minuto, ed è anche la sola che puoi compilare senza
rischiare nulla, perché ogni riga ha un manifest dietro.

Le **hard rule oltre le quattro di serie** sono la parte delicata, e hanno una regola sola:
**scrivi un invariante solo dove lo hai visto affermato** — in un file di istruzioni che c'era
già, in un documento del repository, o in una regola che la struttura rispetta senza eccezioni
visibili. Un invariante dedotto da un'architettura intravista è un'impressione di mezz'ora
travestita da regola, e il suo guaio è che non si distingue dalle altre: fra sei mesi nessuno
saprà più quale riga fu osservata e quale inventata, e nessuno si fiderà di cancellarne una. Nel
dubbio non la scrivi e la elenchi fra le cose da compilare.

Ciò che è di questo progetto ma vale per **una sua parte sola** non è un invariante e non va lì:
va in un file di `.daiku/policies/`, che però **non scrivi tu**. Lo lasci fra le cose da compilare,
con la convenzione già deposta al *Passo 5* a dire come si fa.

#### Se il file esiste già

Lo **riscrivi**, una volta sola, dopo averlo letto tutto.

Quello che c'era dentro è la fonte migliore che hai: porta invarianti veri, decisioni prese e
motivazioni che nessun manifest dichiara. **Si conserva tutto ciò che è di merito, e si conserva
verbatim** — spostato nella sezione canonica che gli compete, mai riassunto: una regola riscritta
più stretta è una regola cambiata, e cambiarla non è compito tuo. Si butta solo ciò che è forma:
un ordine di sezioni diverso, le ripetizioni, e le indicazioni che ora porta il pacchetto.

Se una riga non sai dove collocarla, tienila. Una sezione in coda con ciò che non sei riuscito a
sistemare è meglio di una riga persa, e nel referto la dichiari.

#### E poi non lo tocchi più

In fondo allo scheletro c'è una riga di commento che dichiara che quel file è passato di qui. **Se
la trovi, il file è già stato strutturato: lascialo stare** ed elencalo fra le cose lasciate
com'erano.

È ciò che rende sicura questa eccezione all'idempotenza. Un rilancio serve a prendere uno
scheletro che prima non c'era, non a ristrutturare un file che l'utente ha riscritto a mano nel
frattempo — ed è probabile che lo abbia fatto, perché di tutto ciò che scrivi è il file che si
tocca più spesso. Chi vuole la ristrutturazione toglie quella riga, o te lo chiede.

### 7. Porta la memoria dell'host nel repository — solo su Claude Code

Su **Codex questo passo non esiste**, e non perché non ci sia ancora arrivato nessuno: lì la
memoria dell'agente non è fatta di file ma di un database nella home dell'utente
(`~/.codex/memories_1.sqlite`), costruito consolidando le sessioni passate, e non c'è nessuna
chiave che ne sposti la sede. Non provarci, non scrivere niente sotto `.codex/` per questa
ragione, e non riportarlo come una cosa che manca a quel progetto: è una differenza fra i due
host. Il corpus di `{memory.root}` lì esiste lo stesso e lo scrive `update-memory` a ogni commit;
è solo l'host che non ci mette del suo.

Su **Claude Code**, invece, la memoria che l'agente si scrive da sé finisce per default in
`~/.claude/projects/<progetto>/memory/`: fuori dal repository, invisibile in un `git diff`, non
condivisa con nessuno e persa al primo cambio di macchina. Il tuo compito è portarla dentro, dove
si vede e si committa insieme al resto. Quattro cose, in quest'ordine:

1. **Crea la cartella** `{memory.root}` se non c'è, e dentro `{memory.index}` se manca: un titolo,
   una riga che dichiara che quello è l'indice del corpus, e nient'altro. Vuoto va bene; assente
   no, perché è il primo file che chiunque legga quel corpus apre.

2. **Sposta quello che c'è già.** Cerca la cartella di questo progetto sotto
   `~/.claude/projects/` — si chiama come il path assoluto della radice tecnica con i separatori
   ridotti a trattini, ma non ricostruirlo a mente: elenca quella directory e riconoscila. Se
   dentro c'è una `memory/` con dei file, **spostali** in `{memory.root}`. È l'unica cosa che fai
   fuori dal repository in tutta l'esecuzione, ed è per questo che nel referto la dichiari file
   per file. Se un nome esiste già a destinazione non sovrascriverlo: lascia l'originale dov'è e
   mettilo fra le cose da compilare, perché sono due memorie diverse che si chiamano uguale e
   fonderle è un giudizio di merito, non un lavoro di apertura.

3. **Aggancia la memoria**: in `.claude/settings.local.json`, nella radice tecnica, scrivi
   `autoMemoryEnabled` a `true` e `autoMemoryDirectory` col **path assoluto** di `{memory.root}`,
   slash in avanti. Se il file non c'è lo crei con quelle due sole chiavi; se c'è, gliele
   **aggiungi** senza toccare nulla di ciò che porta già. Una delle due che ci fosse già la lasci
   com'è, anche se punta altrove: è una scelta di chi lavora su questa macchina, e non la ribalti
   tu — la segnali e basta.

4. **Verifica che sia davvero committabile**: apri il `.gitignore` e controlla che nessuna regola
   escluda `{memory.root}`. Se una la esclude **non toccare il `.gitignore`**: dillo nel referto.
   Quella riga l'ha scritta qualcuno apposta, e toglierla è una decisione sua.

#### Perché quella chiave va in `settings.local.json` e non nel file committato

Non è una preferenza di stile: Claude Code **ignora** `autoMemoryDirectory` quando la trova in un
`.claude/settings.json` versionato. È una difesa dell'host — un repository clonato non deve poter
dirottare dove l'agente scrive — e vale anche quando il repository è il proprio.

La conseguenza si dice all'utente, non si nasconde: **le memorie si committano, il puntamento no.**
Chi clona il repository su un'altra macchina si ritrova il corpus versionato e l'host che
ricomincia a scrivere nel default, in silenzio. Le skill di Daiku non se ne accorgono, perché
`{memory.root}` lo aprono per path e lo trovano dov'era; è l'host che se ne va per conto suo, e
smette di leggere ciò che il repository sa. Il rimedio è rilanciare `/init` su quella macchina, e
il *Passo 8* lo scrive nero su bianco.

Per la stessa ragione `.claude/settings.local.json` **non va committato**. Se il `.gitignore` non
lo esclude già, mettilo fra le cose da compilare: di tutto ciò che scrivi è l'unico file che deve
restare fuori dal repository, ed è l'esatto contrario di tutto il resto.

### 8. Referto

Chiudi con l'elenco, in tre blocchi, senza abbellimenti:

- **Scritto** — ogni file creato, con il suo path.
- **Lasciato com'era** — ogni file che esisteva già e che non hai toccato.
- **Da compilare** — ogni chiave che non hai potuto dichiarare, con in una riga *perché* non
  l'hai dichiarata. Questo blocco è il più importante dei tre: è l'unico posto in cui l'utente
  scopre che una skill, su questo progetto, farà meno.

Se lo strato dell'host non è stato scritto (vedi *Passo 1*), dillo qui.

Sulla **memoria** dedica due righe fisse, perché il *Passo 7* fa una cosa che non si vede da
nessuna parte: quali file hai spostato dentro il repository e da dove, e — se giravi su Claude
Code — che il puntamento in `.claude/settings.local.json` **vale su questa macchina soltanto**, e
che su un clone la memoria torna al default finché qualcuno non rilancia `/init` là. Su Codex una
riga sola: la memoria dell'host non si sposta, il corpus del repository c'è comunque.

Se hai **riscritto un file di istruzioni che esisteva**, dedicagli due righe a parte: che cosa hai
conservato, che cosa hai tolto perché era forma, e dove è finito quello che non sapevi collocare.
È la cosa più invasiva che fai in tutta l'esecuzione, ed è l'unica che l'utente deve poter
guardare subito — `git diff` gli dice che è cambiato tutto, non gli dice che cosa si è salvato.

## Idempotenza

**Non sovrascrivi un file che esiste**, salvo le due eccezioni qui in fondo. Né `project.json`, né
i README, né nulla di ciò che trovi sotto `.daiku/` — e vale anche per
`~/.daiku/environment.json`, che è di casa e non di questo progetto. Se c'è, lo lasci e lo elenchi
fra le cose lasciate com'erano.

Questo ti rende rilanciabile: quando il pacchetto si aggiorna e porta uno scheletro che prima non
c'era, ti si rilancia e scrivi solo il pezzo mancante. Un progetto già inizializzato non perde
niente.

**Ed è ciò che rende sicuro far viaggiare i default di dominio.** Uno scheletro come
`commit-convention.md` arriva già scritto, ma arriva **una volta sola**: se l'utente lo ha
riscritto, un rilancio lo vede e lo lascia stare. Senza questa regola il default smetterebbe di
essere una proposta e diventerebbe una regola del pacchetto che torna a ogni aggiornamento — che è
esattamente la cosa che il livello Dominio esiste per non essere.

**Aggiungere una chiave non è sovrascrivere un file.** Il `settings.local.json` del *Passo 7* è
l'unico file che tocchi senza averlo scritto tu, e lo tocchi per addizione: le chiavi che ci trovi
restano com'erano, comprese le due che ti interessano se ci sono già. Un rilancio su una macchina
nuova scrive il puntamento che lì manca, e su una macchina dove c'è non cambia niente — che è
esattamente il mestiere per cui ti si rilancia.

Le eccezioni sono due, e nessuna delle due allenta la regola.

La prima è il **file di istruzioni**, che riscrivi anche dove esiste — ma una volta sola, e ciò
che lo garantisce è al *Passo 6*: la riga di commento che gli lasci dentro. Senza quella riga non
sarebbe un'eccezione ma un buco, perché ogni rilancio tornerebbe a ristrutturare il file che
l'utente cura più di ogni altro. È l'unica cosa scritta su cui puoi passare sopra, ed è così
perché è l'unica che su molti repository esiste già: lasciarla com'era vorrebbe dire, lì, non
scriverla mai.

La seconda è la **richiesta esplicita** dell'utente su un file preciso: allora lo riscrivi, e nel
referto dichiari che cosa c'era prima.

## Cosa non fai

- **Non tocchi il codice**, mai, per nessuna ragione.
- **Non crei un repository Git**, non fai commit e non fai staging di quello che hai scritto: chi
  ha lanciato `init` guarda cosa è comparso prima di versionarlo.
- **Non scrivi le politiche di area.** Il file di istruzioni lo scrivi, perché la sua struttura è
  la stessa ovunque e ciò che è di questo progetto lo hai letto; una politica di area è invece un
  giudizio architetturale su una parte sola, e quella la scrive chi conosce il progetto. Deponi la
  convenzione e la elenchi fra le cose da compilare.
- **Non installi niente** e non modifichi la configurazione dell'host fuori dalle due chiavi del
  *Passo 7*, che sono l'intera licenza che hai su `.claude/`.
- **Non tocchi il `.gitignore`**, né per far entrare la memoria nel repository né per farne uscire
  `settings.local.json`: guardi com'è e lo dichiari.
