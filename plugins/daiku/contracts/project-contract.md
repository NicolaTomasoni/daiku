# Parametri di progetto — contratto unico

Questo file è il **punto unico di modifica** per come una skill ricava i valori specifici del
progetto su cui gira. Le skill in `skills/` dicono *cosa* va fatto e *in che ordine*;
`.daiku/project.json` dice *con quali valori*; i file di `.daiku/domain/` portano il dominio e
il giudizio locali.

Il criterio che regge tutto è uno solo: **il file di una skill è identico byte per byte in ogni
progetto**. Qualunque valore specifico scritto dentro una skill distrugge quell'atomicità e va
spostato di livello. Se ti trovi a personalizzare una skill, il posto giusto è qui sotto.

`contracts/orchestration.md` resta il contratto di *chi* esegue un passo e come lo si delega: è
ortogonale a questo file e non lo tocca. I valori che consuma non stanno qui ma in
`.daiku/environment.json`, il secondo livello di parametri: il confine fra i due è nella §8.

## 1. I quattro livelli

| Livello | Sede | Contiene | Si esporta con la skill |
|---|---|---|---|
| **Metodo** | `skills/**` | cosa va fatto, in che ordine, con quali vincoli | sì, byte-identico |
| **Ambiente** | `.daiku/environment.json` | host, modello per ruolo, backend, path di macchina | sì, si copia identico (§8) |
| **Parametri** | `.daiku/project.json` | path, comandi letterali, nomi di file, aree esistenti | no, uno per progetto |
| **Dominio** | `.daiku/domain/*.md` | liste, tassonomie, criteri di giudizio locali | sì, come **scheletro che si sovrascrive** (§5.4) |

## 2. Cosa può stare in `project.json`

Solo ciò che una skill **sostituisce dentro una frase**: un path, un comando letterale, il nome
di un file, la presenza o assenza di un'area. Tre divieti, in ordine di gravità:

- **Niente descrizioni al posto dei comandi.** Un comando è la stringa esatta da eseguire più la
  cwd da cui eseguirla. «Il gate del backend» non è un valore; la riga che lo esegue lo è. Una
  skill che riceve una descrizione invece di un comando diventa vaga, e questo è il modo
  principale in cui la parametrizzazione può peggiorare il risultato invece di conservarlo.
- **Niente chiave che richieda una spiegazione per essere capita.** Se per usare un valore serve
  sapere *perché* esiste, quella è conoscenza di dominio e va in `.daiku/domain/`.
- **Niente duplicazione di `CLAUDE.md` o `.daiku/policies/`.** Il JSON non contiene invarianti,
  confini fra layer, convenzioni di stile o criteri architetturali: hanno già la loro sede, e la
  skill li legge da lì. È il modo in cui questo file smette di essere un file di parametri.

## 3. Convenzioni di forma

- **Ogni path è relativo alla radice tecnica** (la directory da cui le skill girano), tranne
  `repo_root` che è assoluto. I separatori sono `/`: funzionano sia in PowerShell sia in shell
  POSIX, e i path che Git restituisce hanno già quella forma. Quelli che puntano **fuori** dalla
  radice tecnica la risalgono con `../`, e Git li accetta in quella forma sia come pathspec sia
  come argomento di `git add`: si usano come sono, senza riscriverli.
- **Ogni comando è un oggetto `{ "cwd": <path>, "run": [<riga>, …] }`**: le righe di `run` si
  eseguono in ordine, ciascuna dalla cwd dichiarata. Una riga è una stringa eseguibile così
  com'è, non un modello da completare.
- **Segnaposto `<FILES>`**: se una riga di `run` lo contiene, la skill lo sostituisce con
  l'elenco dei file su cui sta lavorando, separati da spazio. È l'unico segnaposto ammesso
  dentro un comando.
- **Un'area è una parte del progetto con un gate proprio.** Il nome dell'area è la sua chiave
  sotto `areas`; una skill itera su quelle dichiarate e non conosce nomi di area a priori.

## 4. Le chiavi

| Chiave | Mestiere |
|---|---|
| `contract` | numero intero della forma di questo file (vedi §7) |
| `name` | nome del progetto, come compare nei testi rivolti all'utente |
| `repo_root` | path assoluto della root del repository |
| `code_root` | radice del codice applicativo, con slash finale; è anche il pathspec Git con cui si delimita ogni perimetro di codice |
| `instructions_file` | file di istruzioni che l'host carica a ogni sessione e che porta gli invarianti del progetto; è `CLAUDE.md` su un host, `AGENTS.md` su un altro |
| `language.chat` | lingua di ciò che si scrive per una persona: risposte in chat, riepiloghi, referti e i documenti del metodo (§5.5) |
| `language.commit` | lingua di ciò che finisce nella storia del repository: messaggi di commit e voci di changelog (§5.5) |
| `tech_doc` | path del documento tecnico che un lettore umano apre per sapere cosa fa il sistema e perché; assente se il progetto non ne ha uno |
| `changelog` | path del registro delle versioni rilasciate |
| `version.file` | file che porta la versione canonica dell'applicazione |
| `version.field` | punto esatto del file in cui quella versione vive |
| `version.replicated_in` | altri file che portano la stessa versione e si aggiornano insieme; lista vuota o assente se non ce ne sono |
| `paths.studies` | cartella che ospita le cartelle di lavoro, una per problema, con dentro i file numerati del metodo |
| `paths.lib_notes` | cartella degli appunti su una tecnologia studiata |
| `paths.nightly` | cartella degli artefatti della catena notturna: la coda e il registro delle consegne |
| `paths.review_state` | cartella in cui vive il ledger di una review; sta **fuori** dal repository versionato ma è stabile, non a scadenza di sessione |
| `memory.root` | radice del corpus di memoria persistente |
| `memory.index` | file indice del corpus, quello che si legge per primo |
| `memory.catalogs` | nomi dei cataloghi descrittivi del corpus, senza estensione |
| `commit.memory_prefix` | prefisso del messaggio del commit di memoria e documentazione |
| `worktree.pool` | directory del pool di worktree di consegna, relativa alla radice tecnica |
| `worktree.prefix` | prefisso dei nomi dei worktree del pool, seguito dal numero (`1`..`worktree.max`) |
| `worktree.max` | numero massimo di worktree del pool: mai uno in più, mai un nome fuori convenzione |
| `worktree.branch_prefix` | prefisso del branch di ciascun worktree, seguito dal suo nome |
| `areas` | l'insieme delle aree dichiarate; si cita così quando una skill le **enumera** invece di nominarne una (§5.3) |
| `areas.<area>.paths` | i path che appartengono all'area, ciascuno usabile come pathspec Git |
| `areas.<area>.gate` | comando di gate dell'area: lint, formato, type-check, test e build di pacchetto |
| `areas.<area>.lint_fix` | comando che applica le sole correzioni di lint sicure ai file indicati |
| `areas.<area>.test_targeted` | comando che esegue i soli test indicati |
| `areas.<area>.coverage` | comandi che producono la misura di copertura dell'area |

Nessuna chiave è obbligatoria oltre a `contract`: tutto il resto è soggetto alla §6.

## 5. Come una skill lo consuma

### 5.1 La riga di apertura — una sola, identica in ogni skill parametrizzata

Va in testa al corpo della skill, subito dopo il paragrafo che ne dichiara il mestiere, e si
copia alla lettera:

```markdown
> **Parametri.** Ogni chiave fra graffe di questo contratto si risolve sui file di parametri del
> progetto, mai a memoria e mai per assunzione: le regole sono nella §5 di
> `contracts/project-contract.md`, che dice anche **in quale lingua scrivere** e cosa fare quando
> una chiave non c'è.
```

**Era un blocco di otto righe, ripetuto in ogni skill.** Si è ridotto a una riga perché otto
righe identiche in dodici file sono dodici copie che divergono alla prima modifica, e perché ciò
che dicevano è esattamente il contenuto di questa sezione: un rimando lo raggiunge senza
duplicarlo. Chi legge la skill apre un file in più; chi modifica la regola ne apre uno solo.

**Da quale dei due file si risolve una chiave**, e non serve che la skill lo dica:

- un percorso che compare nella tabella §4 → `.daiku/project.json`;
- un percorso che compare nella §7 di `contracts/orchestration.md` — `hosts`, `backends`,
  `default_host`, `temp_dir` → `.daiku/environment.json`.

Nessuna chiave sta in tutti e due (§8), quindi il percorso citato basta a dire dove guardare.

**Cosa fare quando la chiave non c'è** è la §6, e vale senza che la skill la ripeta: quella cosa
non esiste in questo progetto o in questo ambiente — si salta la parte che la usa, lo si dichiara
nell'esito, non la si inventa e non la si chiede.

### 5.2 Citare una chiave in prosa

Si cita con il **percorso puntato dalla radice del JSON, fra graffe, dentro un code span**:
`` `{code_root}` ``, `` `{version.file}` ``, `` `{areas.<area>.gate}` ``. In un'area, `<area>` è
il nome dell'area su cui si sta iterando.

La forma vale **solo** dentro un code span: graffe in prosa nuda, o dentro un esempio JSON di
output della skill, non sono citazioni. Il percorso citato deve esistere nella tabella §4: se
serve un valore che lì non c'è, si aggiunge la chiave qui — non si scrive il valore nella skill.

Una frase con una chiave si legge come se il valore fosse già dentro:

> Calcola lo scope con `git diff <BASE> -- {code_root}`, poi esegui `{areas.<area>.gate}`.

### 5.3 Una parte che vale solo per certe aree

**La forma normale è l'iterazione, non la sezione condizionale.** Una skill non conosce i nomi
delle aree: le enumera da `{areas}`, le filtra su `{areas.<area>.paths}` e lavora su quelle che
restano. Così la stessa frase copre un progetto con una sola area e uno con cinque:

> Per ogni area dichiarata in `{areas}` che il perimetro tocca, esegui `{areas.<area>.gate}` e
> riporta l'esito reale dei comandi. Un'area che il perimetro non tocca non si gira.

Quando una parte dipende davvero dall'**esistenza di una chiave** e non si può scrivere per
iterazione, si apre la sezione con una guardia, prima riga, in grassetto:

> **Vale solo se `{areas.<area>.coverage}` è dichiarata.**

La guardia non spiega cosa fare se la chiave manca: lo dice già il blocco §5.1, una volta per
tutta la skill. Nominare un'area precisa dentro una skill è invece un'eccezione da giustificare:
il nome di un'area è un valore, e un valore dentro una skill rompe l'atomicità.

### 5.4 Rimandare a un file di dominio

Un file di dominio si trova per **ruolo**, con la convenzione `.daiku/domain/<ruolo>.md`. La
skill dichiara **quale domanda quel file risponde**, mai la risposta: se scrive cosa ci
troverà, ha riportato dentro di sé il dominio che stava spostando fuori.

Forma:

> Leggi `.daiku/domain/<ruolo>.md`: porta <la domanda a cui risponde>. Se non esiste,
> <comportamento senza di esso>, e dichiaralo nell'esito.

Per esempio, una skill di copertura scrive «porta le macrocategorie di questo progetto e da quale
punto di forza si testa ciascun layer», non l'elenco delle macrocategorie.

#### Un ruolo può viaggiare con uno scheletro già scritto

Il pacchetto **può** portare un file di dominio di default, sotto
`templates/project/domain/<lingua>/<ruolo>.md`. `init` lo deposita in `.daiku/domain/<ruolo>.md`
la prima volta e **non lo tocca mai più**: da quel momento è dell'utente, che lo riscrive come gli
pare senza che nessun aggiornamento glielo porti via.

È la scelta opposta a quella ovvia, e la ragione è pratica: un ruolo senza default costringe ogni
progetto a scriverselo da zero prima di ottenere il comportamento pieno, e nel frattempo la skill
degrada in silenzio. Meglio una risposta di default dichiarata, che si vede e si cambia, di un
file assente che nessuno sa di dover scrivere.

**Il default resta dominio, non diventa metodo.** La skill continua a porre la domanda e a non
conoscere la risposta: se cancelli il file, vale la degradazione della §6 esattamente come prima.
Ciò che viaggia è una risposta *plausibile*, non una risposta *vincolante*.

**Un default esiste solo dove è sensato.** Un ruolo la cui risposta dipende dallo stack o
dall'architettura — le macrocategorie di test, i punti caldi di performance — non ne ha e non deve
averne uno: lì un default è un'invenzione travestita da regola. Un ruolo la cui risposta è una
convenzione, che va bene finché non ti dà fastidio, sì.

### 5.5 La lingua — si legge qui una volta, non si ripete in ogni skill

Le skill di questo pacchetto sono scritte in italiano, ma **la lingua in cui una skill scrive non
è quella in cui è scritta**: è quella che il progetto dichiara. Sono due chiavi perché sono due
pubblici diversi, e su molti progetti non coincidono.

- **`{language.chat}`** — tutto ciò che legge una persona: la risposta in chat, il riepilogo di
  fine skill, il referto, e i documenti che il metodo produce (`0. problem.md`,
  `1. decision-doc.md`, `2. blueprint.md`, le note di review, il report della notte).
- **`{language.commit}`** — tutto ciò che resta nella storia condivisa del repository: il
  messaggio di commit e la voce di changelog. È separata perché un progetto con interfaccia in
  una lingua ha spesso una storia Git in un'altra, e chi legge `git log` fra due anni non è chi
  sta guardando questa chat adesso.

**Vale per ogni contratto del pacchetto, senza che nessuno la ripeta.** Ogni skill parametrizzata
porta in testa la riga della §5.1, che rimanda a questa §5: quella riga basta, e una skill che
riscrivesse la regola qui sopra la farebbe divergere alla prima modifica.

Se una delle due chiavi non c'è, la §6 dice che quella cosa non esiste — e qui significa una cosa
precisa: **rispecchia la lingua di ciò che hai davanti**. Per la chat, la lingua in cui l'utente ti
ha scritto; per un commit, quella dei messaggi già nello storico. Non è un ripiego elegante, ma è
l'unico che non impone una scelta che nessuno ha fatto.

## 6. Degradazione — ciò che il JSON non dichiara non esiste

Una chiave assente non è un errore da segnalare all'utente né una domanda da fare: è
l'affermazione che quella cosa, in questo progetto, non c'è.

- **Manca una chiave che serve a un passo**: il passo si salta, e l'esito lo dichiara in una
  riga. Nessun valore di ripiego, nessuna euristica, nessun comando indovinato.
- **Manca un'area**: la parte di lavoro che la riguarda non esiste. Un progetto senza frontend
  non produce un gate frontend rosso: non produce niente, e lo dice.
- **Manca `.daiku/project.json`**: la skill non è parametrizzabile su questo progetto. Fermati e
  dillo, invece di ricadere sui valori di un altro progetto.
- **Un comando dichiarato fallisce**: è un esito reale, non una chiave mancante. Si riporta
  l'output, non si cerca un comando alternativo.

Il prezzo di questa regola è dichiarato: un JSON incompleto produce una skill che fa meno, non
una skill che sbaglia. È la direzione voluta.

## 7. Versione del contratto

`contract` è un intero che identifica la **forma** del file, non il suo contenuto.

- **Si incrementa** solo quando la forma cambia in modo che una skill scritta sulla forma
  precedente leggerebbe male: una chiave rinominata o rimossa, un tipo che cambia, un
  significato che si sposta.
- **Non si incrementa** per una chiave nuova e opzionale: una skill che non la conosce la ignora,
  una skill che la vuole e non la trova ricade sulla §6. È il caso normale.
- **Le skill non si ramificano su `contract`**: la §6 copre già ogni chiave mancante. Il numero
  serve a rendere riconoscibile un JSON rimasto indietro, quindi una skill che degrada per una
  chiave assente riporta anche il `contract` che ha letto.
- **Incrementarlo è un lavoro coordinato**: si aggiorna questo file, poi il `project.json` di
  ogni progetto, poi le skill che leggono la forma nuova. Finché quel giro non è chiuso,
  l'aggiornamento delle skill non è più atomico — che è la ragione per cui il numero esiste.

La forma corrente è **2**. È salita da `1` quando `memory_catalogs` è diventato `memory.catalogs`,
accanto a `memory.root` e `memory.index` che prima non esistevano: una skill scritta sulla forma
`1` cercherebbe la chiave vecchia e non la troverebbe, che è esattamente il caso che il numero
serve a rendere riconoscibile.

## 8. Progetto o ambiente — in quale dei due file

I file di parametri sono due, e la domanda che li separa è una sola: **quel valore cambia da
progetto a progetto, o resta lo stesso su tutti i progetti dello stesso owner?**

- **Varia per progetto** → `.daiku/project.json`, con le chiavi della §4.
- **È costante per l'owner, e varia semmai per macchina o per host** → `.daiku/environment.json`,
  con le chiavi dichiarate in `contracts/orchestration.md` §7, che di quei valori è il consumatore
  principale.

I due file hanno la **stessa forma**: `contract` in testa (§7), valori letterali e mai
descrizioni (§2), stessa convenzione di citazione fra graffe dentro un code span (§5.2), stessa
riga di apertura (§5.1, che li copre entrambi) e stessa degradazione (§6). Quelle regole si
leggono qui una volta e valgono per entrambi: non si riscrivono altrove. Cambia solo la radice
del percorso citato e il file che la skill apre.

**Quando un valore sembra stare in tutti e due**, decide chi lo aggiornerebbe al prossimo
cambiamento: se metterlo in `project.json` costringesse a ripetere la stessa identica modifica in
N progetti, è di ambiente. Un valore di ambiente non si duplica mai in `project.json`, nemmeno
"per averlo sotto mano": la duplicazione ricrea un livello più in là esattamente il problema che
l'atomicità chiude.
