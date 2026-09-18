---
name: init
description: 'Apre Daiku su un progetto che non lo ha ancora: scrive `.daiku/` — `project.json`, `domain/`, `policies/` — e l''`environment.json` dell''owner, partendo dagli scheletri del pacchetto e compilandoli con quello che legge nel repository. Idempotente: non sovrascrive mai un file che esiste. Si lancia una volta per progetto, e di nuovo quando il pacchetto porta uno scheletro nuovo.'
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
istruzioni del progetto — `CLAUDE.md` su Claude Code, `AGENTS.md` su Codex. Non è sempre la root del repository: un monorepo può avere il codice sotto una
sottocartella e la radice tecnica lì dentro.

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
| `templates/project/domain/<lingua>/` | `.daiku/domain/` | ne copi **tutti** i file com'è: vedi *Passo 5* |
| `templates/project/policies/<lingua>/` | `.daiku/policies/` | ne copi **tutti** i file com'è: vedi *Passo 5* |
| `templates/owner/environment.json` | `.daiku/environment.json` | lo **svuoti e ricompili**: vedi *Passo 4* |

`<lingua>` è la cartella che corrisponde alla lingua di chat scelta al *Passo 0*. Se per quella
lingua il pacchetto non ha una cartella, usa `en` e dillo nel referto: meglio uno scheletro in una
lingua che non è la tua di nessuno scheletro.

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

Su **Claude Code** gli hook e i subagent li porta il pacchetto e si aggiornano da soli: non scrivi
niente in `.claude/`, e in particolare **non** copi `templates/claude/settings.json`, che
aggancerebbe hook per una via che qui non serve.

Su **Codex** il manifest rifiuta `agents` e `hooks`, e `plugin_hooks` è una feature rimossa:
quello strato va scritto dentro il progetto, sotto `.codex/`. **Non lo scrivi tu**: è il mestiere
di `sync-hooks`, che copia i `.mjs`, li prova col loro banco e aggancia solo quelli sani. Chiudi
il referto dicendo di lanciarla.

Restano fuori i **subagent** a toolset ristretto: su Codex vivono in `.codex/agents/*.toml`, il
pacchetto non li trasporta e oggi non c'è uno scheletro da cui scriverli. **Dichiaralo nel
referto** come limite noto, non come guasto: le skill funzionano lo stesso, e ciò che manca è la
delega a un agent con meno strumenti.

Non chiedere all'utente su quale host gira: lo sai da dove stai girando. L'host è l'unica cosa
che **non** chiedi; le due lingue del *Passo 0* sono l'unica che chiedi.

### 2. Leggi il repository prima di scrivere

Raccogli, in sola lettura, quello che ti serve per compilare i parametri:

- la root del repository (`git rev-parse --show-toplevel`) e la posizione della radice tecnica al
  suo interno;
- i manifest di build presenti (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml`
  e simili) e gli script che dichiarano;
- la struttura di primo livello del codice: quali cartelle sono aree con un gate proprio;
- il file di istruzioni del progetto, se c'è, e il `README.md`.

Questa è una lettura, non un'analisi: non aprire il codice applicativo, non profilare il progetto,
non farne l'inventario. Ti serve sapere quali comandi **sono dichiarati**, non quali sarebbero
sensati.

### 3. Scrivi `.daiku/project.json`

Parti dallo scheletro, **svuotalo di ogni valore che non riguarda questo progetto** e ricompilalo
chiave per chiave con la tabella §4 di `contracts/project-contract.md` sotto gli occhi. Tre regole,
e sono le stesse che reggono tutto il resto del metodo:

- **Un comando è la riga esatta da eseguire più la cwd da cui eseguirla.** Se nel repository
  quella riga non è dichiarata da nessuna parte, la chiave **non si scrive**. Un gate indovinato è
  peggio di un gate assente: assente fa saltare un passo e lo dichiara, indovinato fa fallire un
  passo e sembra un problema del progetto.
- **Ciò che non è dichiarato non esiste.** Un progetto senza frontend non ha un'area frontend
  vuota: non ha la chiave. Vale per `memory`, per `worktree`, per `coverage`, per `tech_doc`, per
  tutto.
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

Quando un valore è ricavabile ma non certo — un `tech_doc` plausibile, un `changelog` che potrebbe
essere quello — **non scriverlo di nascosto**: o lo confermi con quello che hai letto, o lo lasci
fuori e lo elenchi nel referto fra le cose da compilare.

### 4. Scrivi `.daiku/environment.json` se manca

È il file dell'**owner**, non del progetto: host di default, modello per ruolo, backend
disponibili, path di macchina. Cambia da persona a persona e da macchina a macchina, non da
progetto a progetto.

Se esiste già, **non toccarlo**: è la cosa che meno ti appartiene di tutte. Se manca, scrivilo
dallo scheletro svuotato di ogni valore altrui — niente base URL di un altro owner, niente
`temp_dir` di un'altra macchina — tenendo solo la forma, `contract`, e l'host da cui stai
girando come `default_host`. Il resto lo compila l'utente.

Se lo scheletro contiene ancora valori riconoscibilmente di un altro progetto o di un'altra
macchina, non li propagare: toglili e segnalalo nel referto.

### 5. Crea `domain/` e `policies/`

Copia **tutti** i file della cartella `<lingua>` di ciascuno scheletro, senza modificarli:
`templates/project/domain/<lingua>/` in `.daiku/domain/`, `templates/project/policies/<lingua>/`
in `.daiku/policies/`. Sono le uniche due cartelle che nascono non vuote.

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

### 6. Referto

Chiudi con l'elenco, in tre blocchi, senza abbellimenti:

- **Scritto** — ogni file creato, con il suo path.
- **Lasciato com'era** — ogni file che esisteva già e che non hai toccato.
- **Da compilare** — ogni chiave che non hai potuto dichiarare, con in una riga *perché* non
  l'hai dichiarata. Questo blocco è il più importante dei tre: è l'unico posto in cui l'utente
  scopre che una skill, su questo progetto, farà meno.

Se lo strato dell'host non è stato scritto (vedi *Passo 1*), dillo qui.

## Idempotenza

**Non sovrascrivi mai un file che esiste.** Né `project.json`, né i README, né
`environment.json`, né nulla di ciò che trovi sotto `.daiku/`. Se c'è, lo lasci e lo elenchi fra
le cose lasciate com'erano.

Questo ti rende rilanciabile: quando il pacchetto si aggiorna e porta uno scheletro che prima non
c'era, ti si rilancia e scrivi solo il pezzo mancante. Un progetto già inizializzato non perde
niente.

**Ed è ciò che rende sicuro far viaggiare i default di dominio.** Uno scheletro come
`commit-convention.md` arriva già scritto, ma arriva **una volta sola**: se l'utente lo ha
riscritto, un rilancio lo vede e lo lascia stare. Senza questa regola il default smetterebbe di
essere una proposta e diventerebbe una regola del pacchetto che torna a ogni aggiornamento — che è
esattamente la cosa che il livello Dominio esiste per non essere.

L'unica eccezione è la **richiesta esplicita** dell'utente su un file preciso: allora lo
riscrivi, e nel referto dichiari che cosa c'era prima.

## Cosa non fai

- **Non tocchi il codice**, mai, per nessuna ragione.
- **Non crei un repository Git**, non fai commit e non fai staging di quello che hai scritto: chi
  ha lanciato `init` guarda cosa è comparso prima di versionarlo.
- **Non scrivi il file di istruzioni** del progetto. Gli invarianti sono la cosa più di merito che un
  progetto abbia, e un file di istruzioni generato da un modello che ha letto la struttura per dieci
  minuti è esattamente il tipo di file che poi nessuno si fida di cancellare. Se manca, elencalo
  fra le cose da compilare.
- **Non installi niente** e non modifichi la configurazione dell'host fuori da quanto detto al
  *Passo 1*.
