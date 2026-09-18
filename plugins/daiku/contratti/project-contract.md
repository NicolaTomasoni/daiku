# Parametri di progetto — contratto unico

Questo file è il **punto unico di modifica** per come una skill ricava i valori specifici del
progetto su cui gira. Le skill in `.claude/commands/` dicono *cosa* va fatto e *in che ordine*;
`.claude/project.json` dice *con quali valori*; i file di `.claude/context/` portano il dominio e
il giudizio locali.

Il criterio che regge tutto è uno solo: **il file di una skill è identico byte per byte in ogni
progetto**. Qualunque valore specifico scritto dentro una skill distrugge quell'atomicità e va
spostato di livello. Se ti trovi a personalizzare una skill, il posto giusto è qui sotto.

`.claude/orchestration.md` resta il contratto di *chi* esegue un passo e come lo si delega: è
ortogonale a questo file e non lo tocca. I valori che consuma non stanno qui ma in
`.claude/environment.json`, il secondo livello di parametri: il confine fra i due è nella §8.

## 1. I quattro livelli

| Livello | Sede | Contiene | Si esporta con la skill |
|---|---|---|---|
| **Metodo** | `.claude/commands/**` | cosa va fatto, in che ordine, con quali vincoli | sì, byte-identico |
| **Ambiente** | `.claude/environment.json` | host, modello per ruolo, backend, path di macchina | sì, si copia identico (§8) |
| **Parametri** | `.claude/project.json` | path, comandi letterali, nomi di file, aree esistenti | no, uno per progetto |
| **Dominio** | `.claude/context/*.md` | liste, tassonomie, criteri di giudizio locali | mai |

## 2. Cosa può stare in `project.json`

Solo ciò che una skill **sostituisce dentro una frase**: un path, un comando letterale, il nome
di un file, la presenza o assenza di un'area. Tre divieti, in ordine di gravità:

- **Niente descrizioni al posto dei comandi.** Un comando è la stringa esatta da eseguire più la
  cwd da cui eseguirla. «Il gate del backend» non è un valore; la riga che lo esegue lo è. Una
  skill che riceve una descrizione invece di un comando diventa vaga, e questo è il modo
  principale in cui la parametrizzazione può peggiorare il risultato invece di conservarlo.
- **Niente chiave che richieda una spiegazione per essere capita.** Se per usare un valore serve
  sapere *perché* esiste, quella è conoscenza di dominio e va in `.claude/context/`.
- **Niente duplicazione di `CLAUDE.md` o `.claude/rules/`.** Il JSON non contiene invarianti,
  confini fra layer, convenzioni di stile o criteri architetturali: hanno già la loro sede, e la
  skill li legge da lì. È il modo in cui questo file smette di essere un file di parametri.

## 3. Convenzioni di forma

- **Ogni path è relativo alla radice tecnica** (la directory da cui le skill girano), tranne
  `repo_root` che è assoluto. I separatori sono `/`: funzionano sia in PowerShell sia in shell
  POSIX, e i path che Git restituisce hanno già quella forma.
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
| `tech_doc` | path del documento tecnico umano che `CLAUDE.md` dichiara nella *Divisione della documentazione* |
| `changelog` | path del registro delle versioni rilasciate |
| `version.file` | file che porta la versione canonica dell'applicazione |
| `version.field` | punto esatto del file in cui quella versione vive |
| `version.replicated_in` | altri file che portano la stessa versione e si aggiornano insieme; lista vuota o assente se non ce ne sono |
| `memory_catalogs` | nomi dei cataloghi descrittivi di `memory/`, senza estensione |
| `commit.memory_prefix` | prefisso del messaggio del commit di memoria e documentazione |
| `worktree.pool` | directory del pool di worktree di consegna, relativa alla radice tecnica |
| `worktree.prefix` | prefisso dei nomi dei worktree del pool, seguito dal numero (`1`..`worktree.max`) |
| `worktree.max` | numero massimo di worktree del pool: mai uno in più, mai un nome fuori convenzione |
| `worktree.branch_prefix` | prefisso del branch di ciascun worktree, seguito dal suo nome |
| `areas.<area>.paths` | i path che appartengono all'area, ciascuno usabile come pathspec Git |
| `areas.<area>.gate` | comando di gate dell'area: lint, formato, type-check, test e build di pacchetto |
| `areas.<area>.lint_fix` | comando che applica le sole correzioni di lint sicure ai file indicati |
| `areas.<area>.test_targeted` | comando che esegue i soli test indicati |
| `areas.<area>.coverage` | comandi che producono la misura di copertura dell'area |

Nessuna chiave è obbligatoria oltre a `contract`: tutto il resto è soggetto alla §6.

## 5. Come una skill lo consuma

### 5.1 Il blocco di apertura — identico in ogni skill parametrizzata

Va in testa al corpo della skill, subito dopo il paragrafo che ne dichiara il mestiere, e si
copia alla lettera:

```markdown
## Parametri di progetto

Leggi `.claude/project.json` prima di agire: è la sola fonte dei valori specifici di questo
progetto. Le chiavi citate in questo contratto fra graffe e apici inversi si risolvono da lì,
mai a memoria e mai per assunzione. Se una chiave citata non c'è, quella cosa **non esiste in
questo progetto**: salta la parte che la usa, dichiaralo nell'esito, non inventarla e non
chiederla. La forma del file è in `.claude/project-contract.md`.
```

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

Un file di dominio si trova per **ruolo**, con la convenzione `.claude/context/<ruolo>.md`. La
skill dichiara **quale domanda quel file risponde**, mai la risposta: se scrive cosa ci
troverà, ha riportato dentro di sé il dominio che stava spostando fuori.

Forma:

> Leggi `.claude/context/<ruolo>.md`: porta <la domanda a cui risponde>. Se non esiste,
> <comportamento senza di esso>, e dichiaralo nell'esito.

Per esempio, una skill di copertura scrive «porta le macrocategorie di questo progetto e da quale
punto di forza si testa ciascun layer», non l'elenco delle macrocategorie.

## 6. Degradazione — ciò che il JSON non dichiara non esiste

Una chiave assente non è un errore da segnalare all'utente né una domanda da fare: è
l'affermazione che quella cosa, in questo progetto, non c'è.

- **Manca una chiave che serve a un passo**: il passo si salta, e l'esito lo dichiara in una
  riga. Nessun valore di ripiego, nessuna euristica, nessun comando indovinato.
- **Manca un'area**: la parte di lavoro che la riguarda non esiste. Un progetto senza frontend
  non produce un gate frontend rosso: non produce niente, e lo dice.
- **Manca `.claude/project.json`**: la skill non è parametrizzabile su questo progetto. Fermati e
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

## 8. Progetto o ambiente — in quale dei due file

I file di parametri sono due, e la domanda che li separa è una sola: **quel valore cambia da
progetto a progetto, o resta lo stesso su tutti i progetti dello stesso owner?**

- **Varia per progetto** → `.claude/project.json`, con le chiavi della §4.
- **È costante per l'owner, e varia semmai per macchina o per host** → `.claude/environment.json`,
  con le chiavi dichiarate in `.claude/orchestration.md` §7, che di quei valori è il consumatore
  principale.

I due file hanno la **stessa forma**: `contract` in testa (§7), valori letterali e mai
descrizioni (§2), stessa convenzione di citazione fra graffe dentro un code span (§5.2), stesso
blocco di apertura (§5.1, con il nome del file cambiato) e stessa degradazione (§6). Quelle
regole si leggono qui una volta e valgono per entrambi: non si riscrivono altrove. Cambia solo la
radice del percorso citato e il file che la skill apre.

**Quando un valore sembra stare in tutti e due**, decide chi lo aggiornerebbe al prossimo
cambiamento: se metterlo in `project.json` costringesse a ripetere la stessa identica modifica in
N progetti, è di ambiente. Un valore di ambiente non si duplica mai in `project.json`, nemmeno
"per averlo sotto mano": la duplicazione ricrea un livello più in là esattamente il problema che
l'atomicità chiude.
