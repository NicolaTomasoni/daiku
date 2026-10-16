# ARCHITECTURE

> **Cosa va qui.** La struttura e le decisioni tecniche chiave, ciascuna con la ragione per cui è
> stata presa e quanto costa se si rivela sbagliata: i livelli e i loro confini, e chi può conoscere
> cosa. È ciò contro cui si misura una modifica prima di farla — le entità sono in `DOMAIN.md` e
> gli strumenti in `STACK.md`. Leggilo quando una decisione sembra ovvia: quella ovvia è di solito
> quella già presa, o già rifiutata, qui.

## Indice

1. Struttura
2. Confini e livelli
3. Decisioni tecniche chiave e il loro perché
4. Su cosa poggia

## 1. Struttura

Il sistema ha due lati, e il confine fra loro è un ramo di git.

**Il prodotto** — ciò che l'host installa, e che vive in un solo albero:

- **i contratti del metodo** — un file per passo, con dentro *cosa* si fa e *in quale ordine*;
- **i due contratti trasversali** — come si delega il lavoro e chi lo esegue, e cosa il progetto
  dichiara dei propri valori;
- **gli agenti** — il subagente a toolset ristretto di cui i passi di sola lettura si servono;
- **gli hook** — i controlli che sorvegliano i gesti dell'agente mentre lavora;
- **i programmi deterministici** — il motore che risponde sull'ordine della catena, e gli strumenti
  lato disco che leggono Git per conto della review, del pool dei worktree, della riconciliazione,
  della release e della misura del costo;
- **lo specchio dei blocchi di ritorno** — la forma controllabile delle risposte che i nodi si
  scambiano, mentre la prosa del nodo resta quella normativa;
- **gli scheletri** — i file che finiscono nel progetto ospite: la cartella dei parametri, il file
  di istruzioni, il task dell'editor, e i cinque documenti fondativi.

**Il progetto ospite** — ciò che Daiku deposita dove lavora: la cartella `.daiku/` con i parametri,
le regole di dominio e le policies, e sotto di sé le sedi dei lavori; il file di istruzioni; i
documenti fondativi; la memoria.

Il repository che ospita il prodotto porta anche il cantiere che lo costruisce: le istruzioni di
sviluppo, i pochi comandi che il prodotto non ha, i parametri del cantiere, la memoria e gli
strumenti di verifica. Il cantiere non si pubblica.

## 2. Confini e livelli

- **Il metodo non porta valori.** I file del pacchetto sono identici su ogni progetto: dicono cosa
  si fa e in che ordine, mai con quali path, quali comandi, quale versione. I valori stanno un
  livello più in basso, nel progetto.
- **Un contratto non è una skill.** Ciò che le skill aprono per path — i due contratti trasversali —
  sta fuori dalla cartella delle skill, perché l'host scandisce quella cartella e ne farebbe una
  skill rotta.
- **Il pacchetto non scrive nel progetto.** L'host non lo permette: tutto ciò che deve vivere nel
  progetto ospite sta fra gli scheletri, e a copiarlo è un comando che l'utente lancia.
- **Le guardie nascono spente.** Il pacchetto è installato su ogni repository che l'host apre, ma
  non nega niente dove il progetto non ha dichiarato di aver aperto Daiku: la dichiarazione è la
  cartella dei parametri, ed è lei ad accendere i controlli.
- **Gli hook tacciono davanti a un guasto**, e i programmi deterministici non sono hook: nessun
  `hooks.json` li nomina, li invoca l'agente.
- **Il confine della pubblicazione è il ramo.** Il *contenuto* della cartella di prodotto è la radice
  del ramo di produzione: nel prodotto è inglese tutto, cantiere compreso il contrario.
- **La produzione non è un'avanzata dello sviluppo.** Il ramo di produzione non è antenato di quello
  di sviluppo, e niente di una release torna indietro.

## 3. Decisioni tecniche chiave e il loro perché

- **Un motore deterministico possiede l'ordine della catena.** Il programma che sa quali passi
  restano, dato il punto d'ingresso e ciò che sta su disco, e il suo verdetto vincola. *Perché:*
  un agente può saltare una fase o dichiararla finita da sé, e nessuna prosa glielo impedisce.
  *Se è sbagliata:* il motore diventa un collo di bottiglia e un punto di guasto unico — per questo
  il suo banco di prova è l'unica difesa.
- **Le skill sono comportamento, mai valori.** *Perché:* lo stesso Daiku funziona su qualunque
  stack senza che una riga del metodo venga toccata. *Se è sbagliata:* il metodo e i parametri sono
  due livelli da tenere allineati, e un valore che scivola nel metodo lo rende non più universale.
- **Ogni divieto che conta vive in due sedi: il testo che dice cosa fare e un controllo che lo
  impone.** *Perché:* un'istruzione scritta in una skill non è un vincolo — un agente può ignorarla
  o non caricarla affatto. *Se è sbagliata:* si mantiene più codice, e ogni controllo vuole il suo
  banco, perché un controllo rotto e silenzioso è indistinguibile dal silenzio.
- **Gli hook sono fail-open.** *Perché:* un hook che va in errore e blocca il turno costa più di
  quanto protegga, e il rischio che copre è raro. *Se è sbagliata:* un hook rotto tace, quindi non
  lo si nota — la contromisura è che ognuno abbia il suo banco di prova.
- **Rami separati invece di un filtro sui file.** *Perché:* chi aggiunge il marketplace riceve un clone
  dell'intero repository, non solo della cartella di prodotto, quindi il filtro non può stare in un
  `.gitignore`. *Se è sbagliata:* ogni release deve costruire l'albero di produzione, invece di
  essere un semplice avanzamento.
- **La memoria vive nel repository, versionata.** *Perché:* un lavoro vive in file, non nella
  memoria della chat: si interrompe, si chiude tutto e si riprende. *Se è sbagliata:* il repository
  porta anche il corpus di quello che il lavoro ha insegnato, e va tenuto onesto a ogni commit.
- **Ogni lavoro si esegue in un worktree separato, preso da un pool.** *Perché:* il repository
  principale resta intatto mentre la catena gira, e più lavori non si pestano i piedi. *Se è
  sbagliata:* il pool è uno stato in più da riconciliare, e un worktree riusabile solo se è pulito
  e nessuna consegna lo tiene.
- **Due host: Claude Code e opencode.** *Perché:* il pacchetto ne serve due — opencode legge le sue
  estensioni dal progetto e non da un marketplace, quindi richiede un deposito che l'installazione
  non copre — e il costo è quello che questo lavoro paga: due rami di delega, due rese di ruolo, due
  file di istruzioni, due vie di installazione. *Se è sbagliata:* la superficie dei parametri è una
  mappa per host con **due** voci, e ogni host in più è un punto di adattamento da tenere allineato —
  non un collasso rimandato.

## 4. Su cosa poggia

- `plugins/daiku/contracts/project-contract.md` e `contracts/orchestration.md` — le regole dei
  parametri, dei ruoli e della delega;
- `CLAUDE.md`, le istruzioni del cantiere — la collocazione di ogni cosa e i rami;
- la memoria del progetto, in `.docs/memory/`, per il perché delle decisioni qui riassunte.
