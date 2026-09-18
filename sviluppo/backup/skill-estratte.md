# Ciò che è stato tolto dalle skill

Questo file raccoglie il testo rimosso da `plugins/daiku/skills/` quando il corpus è stato
separato dal progetto su cui era nato. **È solo append**: una voce nuova si accoda in fondo, non
si riscrive e non si riordina. Serve a poter rispondere, fra sei mesi, alla domanda «dove era
finita quella riga» senza doverla ricostruire dal diff.

Non è documentazione del prodotto e non sta sotto `plugins/`: è materiale di chi costruisce Daiku.

Ogni voce porta: il file e la sezione da cui viene, il testo **verbatim**, e in una riga perché è
stato tolto e cosa lo sostituisce.

Due categorie, distinte solo dal perché:

- **logica di progetto** — testo ricamato addosso alle tecnologie, ai path e alle convenzioni del
  progetto su cui Daiku è stato estratto. Sostituito da una chiave di `.daiku/project.json`, da un
  rimando a `.daiku/domain/<ruolo>.md`, o da una formulazione valida su qualunque progetto.
- **sezione ripetuta** — testo identico in più skill. Sostituito da una riga sola che rimanda al
  contratto che lo dichiara una volta.

---

## `templates/project/project.json` — l'intero file

**Categoria:** logica di progetto.
**Perché:** lo scheletro da cui `init` scrive `.daiku/project.json` su un progetto nuovo non era
uno scheletro: era la configurazione compilata del progetto di origine, con il suo nome, il path
assoluto della macchina, i suoi due gate e i suoi runner. Un `init` su un progetto qualsiasi
avrebbe propagato tutto questo.
**Sostituito da:** uno scheletro con le sole chiavi e valori segnaposto riconoscibili, nella forma
`contract: 2` della tabella §4 aggiornata.

```json
{
  "contract": 1,
  "name": "ReforgIA",
  "repo_root": "c:/dev/ReforgIA",
  "code_root": "apps/",
  "tech_doc": "../ReforgIA — Documentazione Tecnica.md",
  "changelog": "../CHANGELOG.md",
  "version": {
    "file": "apps/desktop/src-tauri/Cargo.toml",
    "field": "[package].version",
    "replicated_in": ["apps/desktop/src-tauri/Cargo.lock"]
  },
  "memory_catalogs": [
    "backend-services",
    "backend-adapters",
    "backend-agents",
    "frontend-features"
  ],
  "commit": {
    "memory_prefix": "memory:"
  },
  "worktree": {
    "pool": "../.claude/worktrees",
    "prefix": "agent-tree-",
    "max": 5,
    "branch_prefix": "worktree-"
  },
  "areas": {
    "backend": {
      "paths": ["apps/backend/"],
      "gate": {
        "cwd": "apps/backend",
        "run": ["pnpm --filter @reforgia/backend check"]
      },
      "lint_fix": {
        "cwd": "apps/backend",
        "run": ["venv/Scripts/python.exe -m ruff check --fix <FILES>"]
      },
      "test_targeted": {
        "cwd": "apps/backend",
        "run": ["venv/Scripts/python.exe -m pytest <FILES> -q"]
      },
      "coverage": {
        "cwd": "apps/backend",
        "run": [
          "venv/Scripts/python.exe -m coverage run --source=app -m pytest -q",
          "venv/Scripts/python.exe -m coverage json -o coverage.json"
        ]
      }
    },
    "frontend": {
      "paths": ["apps/desktop/"],
      "gate": {
        "cwd": "apps/desktop",
        "run": ["pnpm check"]
      },
      "test_targeted": {
        "cwd": "apps/desktop",
        "run": ["pnpm vitest run <FILES>"]
      },
      "coverage": {
        "cwd": "apps/desktop",
        "run": ["pnpm vitest run --coverage"]
      }
    }
  }
}
```

---

## `templates/owner/environment.json` — i valori dell'owner

**Categoria:** logica di progetto (qui: di macchina e di owner).
**Perché:** lo scheletro portava la directory temporanea di un utente con il suo nome dentro il
path, tre backend privati con i loro URL, e gli alias di modello di un host che valgono per chi
li ha scritti. `init` §4 dice già di non propagare valori altrui, ma lo diceva a uno scheletro che
li conteneva: la regola dipendeva da chi la eseguiva.
**Sostituito da:** la sola forma, con i due host nativi, i modelli di tier dove sono davvero alias
pubblici e segnaposto dove non lo sono, e nessun backend di terzi.

```json
  "hosts": {
    "codex": {
      "models": {
        "giudice": "gpt-5.6-terra",
        "worker": "gpt-5.6-luna"
      }
    }
  },
  "backends": {
    "claude": {},
    "nim": {
      "base_url": "http://127.0.0.1:3456",
      "sequential_fanout": true,
      "caveats": [
        "niente extended thinking né prompt caching",
        "~40 RPM (per questo i finder di review girano in sequenza)",
        "free tier **non ZDR**"
      ]
    },
    "zai": {
      "base_url": "https://api.z.ai/api/anthropic",
      "sequential_fanout": true,
      "caveats": [
        "gira su GLM Coding Plan con fallback reciproco tra i due modelli in caso di overload"
      ]
    },
    "mimo": {
      "base_url": "https://token-plan-ams.xiaomimimo.com/anthropic"
    },
    "codex": {
      "base_url": "http://127.0.0.1:18765"
    }
  }
```

Il `temp_dir` non è riportato qui: era la cartella temporanea di Windows di un utente reale, con
lo username dentro il path. Non serve conservarlo — serve sapere che c'era.

---

## Il preambolo dei parametri — 12 copie in 11 skill

**Categoria:** sezione ripetuta.
**Dove era:** `applier`, `commit`, `deliver-feature`, `execute`, `finder-prompt`,
`nightly-orchestrator` (entrambe le varianti), `nightly-plan`, `review` (entrambe),
`test-coverage`, `update-memory`.
**Perché:** otto righe identiche, parola per parola, in undici file. Il contratto le prescriveva
copiate alla lettera (§5.1), e quella prescrizione produceva dodici punti in cui la stessa regola
poteva divergere senza che nessuno se ne accorgesse.
**Sostituito da:** tre righe di citazione, identiche in ogni skill, e dalla §5.1 riscritta, che
ora dice da quale dei due file si risolve una chiave e cosa fare quando manca.

Variante «progetto»:

```markdown
## Parametri di progetto

Leggi `.daiku/project.json` prima di agire: è la sola fonte dei valori specifici di questo
progetto. Le chiavi citate in questo contratto fra graffe e apici inversi si risolvono da lì,
mai a memoria e mai per assunzione. Se una chiave citata non c'è, quella cosa **non esiste in
questo progetto**: salta la parte che la usa, dichiaralo nell'esito, non inventarla e non
chiederla. La forma del file è in `contracts/project-contract.md`.
```

Variante «ambiente»:

```markdown
## Parametri di ambiente

Leggi `.daiku/environment.json` prima di agire: è la sola fonte dei valori di ambiente di questo
host e di questa macchina. Le chiavi citate in questo contratto fra graffe e apici inversi si
risolvono da lì, mai a memoria e mai per assunzione. Se una chiave citata non c'è, quella cosa
**non esiste in questo ambiente**: salta la parte che la usa, dichiaralo nell'esito, non
inventarla e non chiederla. La forma del file è in `contracts/project-contract.md`; le sue chiavi
sono nella §7 di `contracts/orchestration.md`.
```

---

## Il vincolo di codifica — 7 righe in 7 skill

**Categoria:** logica di progetto, e insieme sezione ripetuta.
**Dove era:** `arch-check`, `blueprint`, `decision-doc` (due volte), `nightly-plan`,
`study-problem`, `update-memory`.
**Perché:** prescriveva UTF-8 e nominava gli accenti di una lingua sola. Il progetto ospite può
scrivere in un'altra lingua e in un'altra codifica; l'invariante vero è che la scrittura non
degradi i caratteri che trova.
**Sostituito da:** «Salva nella codifica del progetto, senza degradare i caratteri non ASCII.»

```markdown
Salva in **UTF-8** con gli accenti italiani intatti (à è é ì ò ù).
Salva sempre in **UTF-8** con gli accenti italiani intatti (à è é ì ò ù).
Salva in **UTF-8** (accenti italiani intatti).
**salvato in UTF-8 con i caratteri italiani accentati intatti** (à è é ì ò ù)
```

---

## Gli identificativi di hard rule — 11 citazioni in 6 skill

**Categoria:** logica di progetto.
**Dove era:** `blueprint`, `execute` (quattro volte), `deliver-feature`, `review` (tre volte),
`test-coverage` (quattro volte).
**Perché:** `[gate-owned-by-review]`, `[extend-before-creating]` e `[storage-single-facade]` sono
i nomi delle hard rule del progetto da cui Daiku è stato estratto. Su un progetto qualsiasi quelle
etichette non esistono, e una skill che le cita manda chi legge a cercare una regola che nessun
file dichiara. Il principio che portavano, invece, è del metodo e resta: il gate di pacchetto è di
`/review` e gira una volta sola; si estende un pattern esistente prima di inventarne uno; il
filesystem si tocca da un punto d'accesso solo.
**Sostituito da:** il principio in prosa, senza etichetta. Per il punto d'accesso al filesystem,
un rimando a ciò che il progetto dichiara in `{instructions_file}` e `.daiku/policies/`, con il
ripiego dichiarato quando non lo dichiara.

```markdown
sono di `/review` (hard rule `[gate-owned-by-review]` di `{instructions_file}`)
li esegue `/review` subito dopo di te (hard rule `[gate-owned-by-review]`)
la risorsa che `[gate-owned-by-review]` esiste per non spendere due volte
Non inventare un pattern nuovo (hard rule `[extend-before-creating]` di `{instructions_file}`).
- **Filesystem solo dalla facciata** che la hard rule `[storage-single-facade]` di
  `{instructions_file}` dichiara, puntata a una directory temporanea.
- Rispetta le **hard rule anche nei test**: filesystem solo dalla facciata di
  `[storage-single-facade]`, nessuna chiamata esterna reale, fixture/demo isolate.
```

---

## «Hard rules», il nome di una sezione — 8 citazioni in 6 skill

**Categoria:** logica di progetto.
**Dove era:** `arch-check` (quattro volte), `finder-prompt`, `study-problem`, `test-coverage`,
`update-memory`.
**Perché:** «la sezione `## Hard rules` del `CLAUDE.md`» è la struttura del file di istruzioni di
quel progetto. Un altro progetto raccoglie i propri invarianti sotto un altro titolo, o non li
raccoglie affatto sotto un titolo.
**Sostituito da:** «gli invarianti universali che `{instructions_file}` dichiara», e in
`arch-check` la riga che dice esplicitamente di leggere quel file invece di cercare un titolo a
memoria.

```markdown
1. `{instructions_file}`, sezione **`## Hard rules`**: gli invarianti universali, validi ovunque.
```

---

## `commit` § *Convenzione Commit* — la tabella dei tipi, la lingua, gli esempi

**Categoria:** logica di progetto.
**Perché:** la tabella degli undici tipi, il formato, la lingua («scrivi sempre in italiano») e gli
esempi sono le convenzioni di un progetto preciso — gli esempi nominano perfino un suo componente.
Un progetto che usa un'altra convenzione riceveva una skill che gliene imponeva un'altra senza
dirlo. Restano, perché non dipendono dal progetto, le due regole sotto: la descrizione dice cosa
cambia e non come si chiama il lavoro, il corpo elenca e non argomenta.
**Sostituito da:** un rimando a `.daiku/domain/commit-convention.md` con il ripiego dichiarato —
ricavare la convenzione dallo storico invece di importarne una.

```markdown
## Convenzione Commit

| Tipo       | Quando usarlo                                                                    |
| ---------- | -------------------------------------------------------------------------------- |
| `feat`     | Aggiunta di una nuova funzionalità                                               |
| `fix`      | Correzione di un bug                                                             |
| `chore`    | Attività tecniche o di manutenzione che non modificano il comportamento dell'app |
| `docs`     | Modifiche alla documentazione                                                    |
| `style`    | Modifiche di formattazione, spazi, lint, senza cambi logici                      |
| `refactor` | Ristrutturazione del codice senza cambiare comportamento                         |
| `test`     | Aggiunta o modifica di test                                                      |
| `perf`     | Miglioramenti di performance                                                     |
| `build`    | Modifiche a build system, dipendenze o configurazioni di packaging               |
| `ci`       | Modifiche a pipeline CI/CD                                                       |
| `revert`   | Annullamento di un commit precedente                                             |

**Formato:** `tipo(scope opzionale): descrizione breve in minuscolo, imperativo, max 72 caratteri`

**Descrizione:** descrivi solo il contenuto delle modifiche (cosa cambia), mai il nome dello sviluppo o feature. Esempi:
- ❌ `feat(gpio-bridge): aggiunge supporto PWM`
- ✅ `feat(gpio): aggiunge supporto PWM per segnali digitali`

**Corpo (opzionale):** elenca solo *cosa* è stato fatto (bullet brevi). Niente prosa o motivazioni.

Scrivi sempre in italiano, con parole chiave in inglese quando necessario.
```

---

## `commit` § *Bump di versione e changelog* — la politica di incremento

**Categoria:** logica di progetto.
**Perché:** «solo il minor», l'esempio numerico e l'elenco delle capacità che meritano un bump
(«una sorgente di import nuova, una capacità di analisi o di abilitazione nuova, un motore
sostituito») descrivono un'applicazione precisa e il suo schema di versione. Il criterio
dell'importanza resta; quale cifra si possa muovere no.
**Sostituito da:** un rimando a `.daiku/domain/commit-convention.md`, con un ripiego che è il solo
sicuro: se il progetto non dichiara quale incremento è concesso, **non si bumpa affatto** e lo si
dichiara.

```markdown
**Perimetro consentito: solo il minor.** `0.11.0 → 0.12.0`, con la patch riportata a `0`. Mai
toccare il major — è una decisione dell'owner — e mai incrementare la patch, che resta ai flussi
di packaging. Al massimo **un bump per invocazione** di questa skill.

- **Bump** quando la feature … cambia ciò che l'utente può fare con l'applicazione: un flusso o
  una schermata nuova, una sorgente di import nuova, una capacità di analisi o di abilitazione
  nuova, un motore sostituito.
```

Insieme a questa sono cadute le due forme di messaggio cablate sui tipi di quella convenzione:

```markdown
- **con bump**: `build(<scope>): porta la versione dell'applicazione a X.Y.0` …
- **senza bump**: `docs(changelog): registra <capacità> tra le modifiche non rilasciate`.
```

---

## `commit` — il paragrafo sui path relativi

**Categoria:** sezione ripetuta (verso il contratto, non verso un'altra skill).
**Perché:** diceva una regola di forma dei parametri dentro una skill. È la §3 del contratto, che
ora la porta per intero.
**Sostituito da:** niente, nella skill. La frase è stata aggiunta alla §3 di
`contracts/project-contract.md`.

```markdown
I path che quel file dichiara sono relativi alla radice tecnica da cui esegui i comandi Git;
quelli che puntano fuori da essa la risalgono con `../`, e Git li accetta in quella forma sia
come pathspec sia come argomento di `git add`. Usali come sono, senza riscriverli.
```

---

## Il contratto della memoria citato per nome di sezione — 11 citazioni in 3 skill

**Categoria:** logica di progetto.
**Dove era:** `update-memory` (cinque volte), `memory-review` (cinque), `decision-doc` (una).
**Perché:** «`CLAUDE.md`, sezioni "Divisione della documentazione" e "Contratto della memory"» è
l'indice del file di istruzioni di un progetto preciso. Le regole che quelle sezioni portano —
quali forme può avere una memoria, come si muta il corpus, quando si aggiorna l'indice — sono
dominio, e la loro sede è `.daiku/domain/memory-contract.md`. Le otto azioni di review, invece,
sono del metodo e restano scritte in `memory-review`.
**Sostituito da:** un rimando al file di dominio con doppio ripiego dichiarato — `{instructions_file}`
se il file di dominio non c'è, e per `memory-review` **fermarsi** se non c'è nemmeno lì, perché un
audit senza regola canonica misura il proprio gusto.

```markdown
Non replichi le regole: la fonte canonica resta `CLAUDE.md`, sezioni "Divisione della
documentazione" — a quale artefatto tocca cosa — e "Contratto della memory" — le forme, le regole
di mutazione e le azioni di review —, che ogni subagent rilegge a ogni esecuzione.

Le otto azioni ammesse (tassonomia canonica di `CLAUDE.md`, § *Contratto della memory*):

1. **Leggi il contratto**: `CLAUDE.md`, sezione "Divisione della documentazione" (i quattro
   artefatti e il mestiere di ciascuno) e sezione "Contratto della memory" (le tre forme, le
   regole con cui la memoria si muta e quando si aggiorna l'indice).
```

Con esse sono cadute le forme cablate del corpus di quel progetto: `memory/`, `MEMORY.md` e
`memory/memory-content-conventions.md` come path letterali, il frontmatter `metadata.type` come
nome di campo, e le tre forme «mappa / descrizione / fatto» nominate dentro la skill invece che
lette dal contratto.

```markdown
3. Per ciascuna modifica staged, verificala contro la sezione "Contratto della memory"
   di `CLAUDE.md` e contro `memory/memory-content-conventions.md` (…, mai fondere `type:` diversi,
   …, indice `MEMORY.md` coerente con i file).
   - un file con `metadata.type` in frontmatter incoerente col contenuto …
```

E un esempio di dominio in `update-memory`, che nominava un comportamento di quell'applicazione:

```markdown
(es. un'azione che prima eliminava un dato e ora lo riporta a uno stato precedente, o un nuovo
default di configurazione)
```

---

## `deliver-feature` § *Pool dei worktree* — l'ambiente locale di quel progetto

**Categoria:** logica di progetto.
**Perché:** la radice di lavoro era `<pool>/<nome>/src`, cioè il layout di quel repository; e il
rimando ai vincoli di ambiente nominava una sezione del suo `CLAUDE.md` e due gesti della sua
toolchain — `pnpm install` e lo sgancio di una junction con `rd`. Su un progetto Python, Rust o Go
quelle righe non dicono niente, ma il pericolo che descrivono — un comando di ambiente lanciato
dentro il worktree che riscrive l'albero condiviso — esiste ovunque.
**Sostituito da:** la radice di lavoro ricavata dalla posizione relativa della radice tecnica, e il
pericolo descritto in forma generale con l'obbligo di leggere `{instructions_file}` prima di
eseguire comandi di ambiente nel worktree.

```markdown
- **radice di lavoro** — `<pool>/<nome>/src`: codice, diff, stage, commit, gate e fix girano
  qui. `{code_root}` e le cwd dei comandi di `{areas}` si risolvono da qui.

Sulle operazioni che toccano un worktree valgono i vincoli di `CLAUDE.md`, § *Avvio e ambiente
locale* (junction da sganciare con `rd` sul solo link, mai `pnpm install` dentro il worktree):
non si riscrivono qui.
```

---

## `deliver-feature` e `nightly-orchestrator` — il branch `main` cablato

**Categoria:** logica di progetto.
**Perché:** l'acquisizione del worktree, il reset, la creazione e il merge nominavano `main` come
branch di integrazione. Un progetto che lo chiama `master`, `trunk` o `develop` avrebbe visto la
consegna reimpostare i worktree su un riferimento inesistente — e, peggio, una consegna lanciata
da un branch di lavoro sarebbe stata integrata altrove senza dirlo.
**Sostituito da:** `<INT>`, il branch su cui l'albero principale è posizionato quando la consegna
parte, risolto una volta sola con `git rev-parse --abbrev-ref HEAD`. Non serve una chiave di
parametro: la risposta giusta è osservabile.

```markdown
1. `git worktree list --porcelain` e `git rev-parse main` dall'albero principale …
3. Se c'è: `git -C <pool>/<nome> reset --hard main` (albero pulito: sicuro) e usalo.
4. … `git worktree add <pool>/{worktree.prefix}<M> -b {worktree.branch_prefix}{worktree.prefix}<M> main`
```

---

## `deliver-feature` — le date delle decisioni owner

**Categoria:** logica di progetto.
**Perché:** cinque righe datavano una regola a una decisione presa dall'owner di quel progetto
(«decisione owner 18/09/2026», «dal 17/09/2026 la consegna non parcheggia più»). Sono la storia di
come la regola è nata, non la regola: chi riceve il pacchetto non ha quella storia e non ha quel
owner, e una data senza contesto fa sembrare provvisorio un vincolo che non lo è.
**Sostituito da:** la regola, senza la data.

```markdown
resta solo lavoro meccanico (decisione owner 18/09/2026).
il worktree resta sporco di proposito**: dal 17/09/2026 (decisione owner) la consegna non crea mai
Eccezione al punto 4 (decisione owner 18/09/2026): il conflitto sul solo `{changelog}` …
il worktree resta sporco per decisione owner);
`blocked_patch` sempre `null` …: dal 17/09/2026 la consegna non parcheggia più per decisione owner
```

E la convenzione di commit ricopiata dentro la fase 6, con la lingua dentro:

```markdown
Messaggio conforme a `.claude/commands/review/commit.md` (tipo(scope): descrizione, corpo asciutto,
italiano).
```

---

## `study-problem` § *Indaga sul codice* — l'architettura di quel progetto

**Categoria:** logica di progetto.
**Perché:** i quattro fronti d'indagine erano l'architettura di un'applicazione precisa, elencata
per componenti («services, adapters, models, API routes», «features, components, API client,
domain models»). Su un progetto con un'altra forma quella lista fa partire quattro subagent su
cartelle che non esistono. Restano validi i due fronti trasversali — configurazione e avvio,
architettura — perché li ha qualunque sistema.
**Sostituito da:** i fronti ricavati dalle aree che `{areas}` dichiara, più i due trasversali
nominati per il loro mestiere e non per le cartelle di un progetto.

```markdown
- **Backend:** services, adapters, models, API routes
- **Frontend:** features, components, API client, domain models
- **Config/runtime:** settings, environment, startup
- **Architettura:** flussi, hard rules, layer coinvolti
```

Con essi sono caduti gli esempi di dominio che nominavano fornitori e componenti di quel progetto:

```markdown
- una domanda concreta (es. "come abilitiamo una chiave API nvidia nim che punta a GM 5.2?")
   - l'area tecnica coinvolta (backend, frontend, adapter, service, UI)
   - un nome slug kebab-case per la cartella (es. `nvidia-nim-api-switch`, `subagent-fanout-codex`)
   - qual è l'area coinvolta (backend/frontend/integrazione/architettura)
```

---

## `nightly-plan` — gli esempi di coda e la data via PowerShell

**Categoria:** logica di progetto (qui anche di macchina).
**Perché:** gli esempi nominavano cartelle, opzioni e tecnologie di quel progetto
(`resource-leaks`, `Postgres + AGE`, `adapter SpotBugs`, `try-with-resources`), e il `run_id` si
ricavava con un comando PowerShell, che su una macchina POSIX non esiste. La data serve reale; la
shell da cui chiederla no.
**Sostituito da:** esempi con segnaposto, e «la data odierna reale della macchina, chiesta alla
shell e mai ricordata a memoria».

```markdown
resource-leaks -> Soluzione 1
db -> Opzione B (Postgres + AGE)
analyzer-locali -> Soluzione 2 — adapter SpotBugs

3. **Ricava il `run_id`** dalla data odierna reale (`Get-Date -Format yyyy-MM-dd` in PowerShell) …

  "run_id": "nightly-2026-07-10",
  "backend": "claude",
      "id": "resource-leaks",
      "selected_solution": "Soluzione 1 — try-with-resources"
```

---

## Righe minori, una per skill

**Categoria:** logica di progetto.

`review` — il ledger dava per scontato che il `.gitignore` di quel repository coprisse la cartella
di stato. Ora la skill lo verifica e, se non è coperta, lo dichiara in chiusura invece di
scriverci dentro comunque.

```markdown
fuori dal repository versionato (`.gitignore` copre `.dev-runtime/`) ma **stabile**, non a
scadenza di sessione.
```

`perf` — citava una sezione del file di istruzioni di quel progetto per dire una cosa che si dice
da sé.

```markdown
(sezione *Comportamento* di `CLAUDE.md`: modifiche chirurgiche, niente refactoring fuori scope)
```

`blueprint` — rimandava a un meccanismo di quel progetto che qui non esiste.

```markdown
È lo stesso principio del loop di execution del progetto.
```

`init` — quattro citazioni di `{instructions_file}` erano entrate per errore nella riscrittura:
`init` gira **prima** che `.daiku/project.json` esista, quindi è l'unica skill che quella chiave
non può risolvere. Sono tornate in prosa, con i due nomi reali degli host.

---

## Le skill che non citavano parametri e ora lo fanno

**Categoria:** sezione ripetuta.
**Perché:** `arch-check`, `blueprint`, `code-review`, `decision-doc`, `memory-review`,
`study-library` e `study-problem` nominavano `CLAUDE.md`, `memory/` e le cartelle di lavoro come
path letterali, quindi non avevano bisogno di dichiarare da dove si risolvono i parametri. Ora che
quei path sono chiavi, la riga di apertura della §5.1 serve anche a loro.
**Sostituito da:** la stessa riga di tre righe, aggiunta in testa al corpo.

---

## Cosa NON è stato tolto, e perché

Tre cose somigliano a un residuo e non lo sono. Stanno qui perché la prossima passata non le
tolga per abitudine.

- **`init` che elenca `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `pom.xml`.** Non è
  lo stack di un progetto: è l'elenco dei posti dove *qualunque* progetto dichiara i propri
  comandi, e serve a `init` per sapere dove guardare.
- **`study-library` che cita `DBOS`, `LangGraph`, `Tauri v2`, `TanStack Query`.** Sono esempi della
  *forma* dell'argomento — nome, nome con versione, nome con linguaggio — e servono a mostrare come
  se ne ricava lo slug. Che due di esse fossero nello stack del progetto di origine è un caso.
- **Le otto azioni di `memory-review`** (`delete`, `move`, `correct`, `split`, `summarize`,
  `merge`, `keep`, `confirm_with_owner`). Sembrano dominio perché il file le chiamava «tassonomia
  canonica del `CLAUDE.md`», ma sono la tassonomia del **metodo**: è questa skill a deciderle, e
  spostarle in un file di dominio significherebbe che un progetto può inventarne una nona.

Resta fuori dal perimetro di questa passata, e va guardato a parte:

- **`hooks/lib/`** porta gli stessi residui delle skill — `pnpm`, `venv`, `node_modules/.pnpm`, i
  path `docs/nuovi-sviluppi/` e `sviluppo/nuovi-sviluppi/` cablati in `session-advice.mjs`, e i
  banchi di self-check costruiti su quel layout. È codice eseguibile con i propri test: la
  separazione va fatta lì insieme ai banchi, non riscrivendo le stringhe.

---

## Correzione di rotta: il dominio ora viaggia

**Decisione dell'owner, stessa sessione.** Il livello Dominio era dichiarato «non si esporta mai»:
`.daiku/domain/` nasceva vuoto e chi installava Daiku doveva scriverselo da zero prima di ottenere
il comportamento pieno. Il criterio è stato ribaltato: **il pacchetto porta i default, e se
all'utente non piacciono li cambia.** L'idempotenza di `init` garantisce che un default arrivi una
volta sola e non torni più a ogni aggiornamento, quindi resta una proposta e non diventa una regola
del pacchetto.

Conseguenza per questo file: **la convenzione di commit tolta da `commit/SKILL.md` è in parte
tornata**, ma a un livello diverso. Non è più dentro la skill — quella resta byte-identica ovunque —
è uno scheletro sovrascrivibile in
`templates/project/domain/<lingua>/commit-convention.md`. Chi legge la voce «§ *Convenzione
Commit*» più sopra e conclude che quella conoscenza è stata buttata, sbaglia: è stata spostata due
volte, prima fuori dalla skill e poi dentro un default che viaggia.

Quello che **non** è tornato è ciò che la rendeva di un progetto solo: la lingua italiana cablata,
gli esempi che nominavano un suo componente, e «solo il minor» come politica di versione. Il
default che viaggia adesso dice **nessun bump**, ed è il conservativo: concedere un incremento è
una riga che l'utente scrive.

Sono nate due chiavi per la lingua, `language.chat` e `language.commit`, perché il default di
dominio non poteva dichiararla senza tornare a essere la convenzione di qualcuno. `init` le chiede
— sono **le uniche due cose che chiede**, e le propone guardando `README.md` e `git log`.

---

## `README.md` del pacchetto — `/censisci-tecnologie`

**Categoria:** logica di progetto.
**Perché:** il README elencava fra le skill un comando che nel pacchetto **non esiste**. Era una
skill di sviluppo del progetto di origine: nominava un suo file sorgente, una sua cartella di
studio e una sua decisione numerata. Chi avesse letto la guida avrebbe cercato un comando che
l'host non espone.
**Sostituito da:** niente. Rimossa dall'elenco e dalla tabella dei casi d'uso.

```markdown
- **`/censisci-tecnologie [progetto, ...]`** — misura le coordinate che l'inventario tecnologico
  di un progetto non sa interpretare, ne risolve i metadati dalle fonti pubbliche e le censisce in
  `technology_catalog.py` con nome, area e portanza curati; test di invariante inclusi, il gate è
  di `/review`. È la decisione 3 di `copertura-catalogo-tecnologico`: la curatela è di sviluppo,
  non dell'utente. Non committa.
```

Insieme a essa, dal README è caduto il preambolo di ambiente di otto righe — la dodicesima copia
dello stesso blocco, che nessuno aveva contato perché non stava in una skill.
