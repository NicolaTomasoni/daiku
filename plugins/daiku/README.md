# Comandi — guida alle skill

Questa cartella contiene i **contratti canonici** delle skill del progetto. Si invocano scrivendo
`/<nome>` (es. `/blueprint`); un host che per invocarle richiede un pointer lo trova sotto
`{hosts.<host>.skill_pointers}`, e quel pointer rimanda qui. Una skill, un contratto, ogni host.

## Parametri di ambiente

Leggi `.claude/environment.json` prima di agire: è la sola fonte dei valori di ambiente di questo
host e di questa macchina. Le chiavi citate in questo contratto fra graffe e apici inversi si
risolvono da lì, mai a memoria e mai per assunzione. Se una chiave citata non c'è, quella cosa
**non esiste in questo ambiente**: salta la parte che la usa, dichiaralo nell'esito, non
inventarla e non chiederla. La forma del file è in `.claude/project-contract.md`; le sue chiavi
sono nella §7 di `.claude/orchestration.md`.

## Il modello mentale

Tre idee reggono tutto.

**1. Skill atomiche + skill orchestranti.** Le skill di base fanno *una* cosa (studia, progetta,
esegui, rivedi, committa). Le skill orchestranti (`/deliver-feature`, `/review`,
`/nightly-orchestrator`, `/memory-review`) le incatenano nell'ordine giusto, delegando ogni fase
a un **subagent in contesto fresco**. L'orchestrazione è dell'agente: non c'è uno script che la
esegue al posto suo.

**2. Lo stato vive nei file, non nella chat.** Una feature nasce da una **cartella** sotto
`docs/nuovi-sviluppi/<nome>/`. Le skill leggono e scrivono file numerati dentro quella cartella,
così il lavoro sopravvive a interruzioni, compattazioni del contesto e passaggi di consegne:

| File | Cosa contiene |
|---|---|
| `0. problem.md` | il materiale grezzo del problema; se serve ancora pensiero strategico, `/decision-doc` lo rifinisce qui |
| `1.5. studio-strategico.md` | la strategia **non** è ancora chiusa: verdetto e decisioni di direzione da chiudere con l'owner, con le risposte in coda quando arrivano |
| `1. decision-doc.md` | la strategia è chiusa: il problema studiato + le opzioni tecniche con trade-off |
| `2. blueprint.md` | il brief di esecuzione (piano a task, Memoria, Diario) |
| `3. memory-report.md` | l'esito dell'allineamento di memoria e documentazione: il blocco a contratto della fase 5b — i file toccati e le voci da confermare con l'owner |
| `4. review-notes.md` | cosa è stato fatto + il base-ref per la review |
| `5. review-report.md` | l'esito della review: il blocco a contratto e il path del suo ledger |

Chi riprende un lavoro **rilegge la cartella**, non la conversazione.

**3. I modelli non si nominano nelle skill.** Ogni passo dichiara un **ruolo** — `giudice` o
`worker` — e `.claude/orchestration.md` è il punto unico che lo risolve nel modello dell'host
corrente. Cambiare quali modelli girano è una modifica a un solo file, e la tabella vive solo lì.

## Cosa lanci tu

Nell'uso normale, **due comandi**:

```text
/decision-doc <cartella>              ← finché la strategia non è chiusa (lo rilanci sulla stessa cartella)
/deliver-feature <cartella> <soluzione scelta>   ← e da lì fino al commit non tocchi più nulla
```

Tutto il resto — brief, esecuzione, review, aggiornamento memoria, commit — succede **dentro**
`/deliver-feature`, delegato a subagent. Non li lanci tu.

Gli altri comandi esistono per i casi in cui esci dal binario:

| Quando | Cosa lanci |
|---|---|
| hai un diff scritto a mano e vuoi solo la review | `/review [base-ref]` poi `/commit` |
| a fine giornata, modifiche puntuali stratificate in chat da confermare | `/review` (chiude lei, commit compreso) |
| vuoi fermarti tra uno stadio e l'altro | `/review`, `/commit` a mano |
| più feature in fila, non presidiato | `/nightly-plan "..."` poi `/nightly-orchestrator` |
| studio o manutenzione occasionale | `/studia-problema`, `/studia-libreria`, `/memory-review`, `/censisci-tecnologie` |

**Su un host che dichiara `{hosts.<host>.skill_pointers}`** sono invocabili le skill che hanno lì
il proprio pointer, e quali siano lo dichiara la tabella di `.claude/orchestration.md` §3; un host
che non dichiara quella chiave carica i contratti direttamente da questa cartella. Gli altri
contratti restano file che i subagent leggono, identici su ogni host. Se un giorno serve
lanciarne uno in più a mano, si aggiunge il pointer: dodici righe.

## Catene

### A. Ciclo di vita di una feature (passo-passo)

È la catena naturale, dallo studio al commit. Puoi fermarti a ogni stadio.

```text
/decision-doc → /blueprint → /execute → /review → /commit
```

| Step | Cosa fa | Output |
|---|---|---|
| `/decision-doc` | valuta lo stadio: se manca ancora strategia, revisione scettica su `0. problem.md` + decisioni numerate; se la strategia è chiusa, studio tecnico approfondito | `1.5. studio-strategico.md` oppure `1. decision-doc.md`, con `0. problem.md` rifinito |
| `/blueprint` | trasforma decisione + soluzione in brief | `2. blueprint.md` |
| `/execute` | scrive il codice dal brief | `4. review-notes.md` |
| `/review` | qualità sul diff: giri di finder e fix finché converge → gate | — |
| `/commit` | allinea memoria/doc sul diff staged, poi committa | un commit per gruppo non vuoto, in ordine: codice, memoria/doc, versione/changelog |

- **`/decision-doc <cartella>`** accorpa i file di riferimento in `0. problem.md`, poi decide lo
  stadio: se restano decisioni strategiche aperte fa da senior scettico (rilievi citati +
  decisioni numerate a cui rispondi `1A, 2B…`) e le deposita in `1.5. studio-strategico.md`,
  fermandosi lì; se la strategia è già chiusa produce `1. decision-doc.md` con le opzioni
  tecniche in cima. Richiamalo sulla stessa cartella finché non arriva allo stadio tecnico: le
  risposte che dai si chiudono nel documento, accanto alla decisione che le ha chieste.
- **`/blueprint <cartella> <soluzione scelta>`** produce `2. blueprint.md` e **si ferma lì**.
- **`/execute <cartella>`** esegue il brief in autonomia con verifiche mirate al perimetro
  toccato, deposita `4. review-notes.md`; il gate di build e test è di `/review`.
- **`/review <base-ref | 4. review-notes.md> [--with …]`** decide da sé, leggendo il diff, se
  arch-check/perf sono pertinenti: se il diff sono tanti file ma solo fix puntuali, quei finder
  non vengono nemmeno lanciati. La copertura la decide un worker dedicato dopo il ciclo, sul diff
  finale. Il finder bug gira sempre.
  Poi **itera**: i fix appena scritti sono codice che nessun finder ha visto, quindi il giro
  successivo li rivede, e il ciclo si ferma quando smette di trovarne. Il gate gira sempre, una
  volta all'uscita, e **il commit chiude il ciclo** salvo `--no-commit`.
- **`/commit`** allinea prima memoria e documentazione al diff staged — delegando **sempre** a
  `update-memory`, che è quello che decide se c'è qualcosa da scrivere — poi committa **un gruppo per commit**, in
  quest'ordine: il codice con il tipo appropriato, gli artefatti non-codice, e per ultimo versione e
  changelog quando il bump li tocca. Un gruppo vuoto non produce alcun commit.

Ogni step è **atomico e sequenziale**: nessuna scorciatoia che ne incateni due in un colpo solo.

### B. Consegna di una feature in un colpo — `/deliver-feature`

Quando hai **una** feature con decision-doc già risolto e vuoi la catena intera senza fermarti a
ogni stadio:

```text
/deliver-feature <cartella> <soluzione scelta>
   → Brief → Execute → Review (il contratto di /review, per intero)
     → Decision → Memory (stage + update-memory) → Commit condizionale → Report
```

La fase **Review** non è una copia: è `.claude/commands/review.md` eseguito integralmente,
la stessa disciplina che gira da `/review` standalone (con `--no-commit`: qui il commit è una
fase successiva della consegna). Il commit è condizionale: solo a
gate verde e senza rilievi bloccanti, e in **commit distinti**, uno per gruppo non vuoto: prima il
codice, poi doc e memoria, per ultimo — solo se toccati — versione e changelog. È la **stessa unità
atomica** che la run notturna invoca per ogni item della coda.

### C. Run notturna — `/nightly-plan` → `/nightly-orchestrator`

Lavora **più feature in fila, non presidiato**. Due skill:

```text
/nightly-plan "resource-leaks -> Soluzione 1; db -> Opzione B; ..." → docs/nightly/nightly-run.json

/nightly-orchestrator → legge la coda, pre-flight sull'ambiente,
                        poi per ogni item in sequenza il contratto /deliver-feature
```

`docs/nightly/nightly-run.json` è **solo l'input statico** della coda: cartelle, soluzioni e
ambiente dichiarato, senza stato di avanzamento. `docs/nightly/nightly-review.md` è il
deliverable: si costruisce **per append**, un blocco per item, man mano che la coda avanza — mai
un report generato in un colpo solo a fine notte.

- **`/nightly-plan`** è l'**unico momento in cui sei presente**: qui si chiede e si verifica
  (cartelle esistono, soluzione scelta, ambiente). Produce solo la coda, non esegue nulla.
- **`/nightly-orchestrator`** fa pre-flight e loop sequenziale sugli item — mai in parallelo:
  build, test, commit e base-ref non sono serializzabili sullo stesso repo. La ripresa dopo
  un'interruzione si ricostruisce dallo stato osservabile (report, gli artefatti numerati nella
  cartella di ciascun item, `git log`).

**Il campo `backend` della coda** — uno dei backend dichiarati in `{backends}` — dichiara
l'**ambiente**, non i modelli: quelli vengono dai ruoli. Serve a due cose sole — il **pre-flight**
(l'ambiente attivo deve coincidere con quello dichiarato, altrimenti la run aborta: così non
spendi la notte sul backend sbagliato) e la **concorrenza** del fan-out di review, che diventa
sequenziale sui backend che lo dichiarano (`.claude/orchestration.md` §5).

### D. Revisione della memoria — `/memory-review`

Sull'intero corpus `memory/`: inventario → tre audit indipendenti → verifica di copertura →
riconciliazione. Rigorosamente **read-only**: restituisce finding con evidenza, confidenza,
destinazione, proposta e una scelta consigliata secondo la tassonomia canonica di `CLAUDE.md`. I
fatti non deducibili dubbi o in conflitto diventano `confirm_with_owner`, non correzioni o
cancellazioni automatiche. Non applica nulla.

## Come si orchestra (la parte che era in uno script)

Le skill orchestranti delegano ogni fase a un subagent, con cinque regole fisse
(`.claude/orchestration.md`):

| | Come funziona |
|---|---|
| **Chi decide il prossimo passo** | l'agente, turno per turno, leggendo il blocco di ritorno della fase precedente |
| **Output di un passo** | un **blocco JSON a contratto**, dichiarato nella skill: si legge quello, non la prosa. Se manca o è incompleto, il passo è fallito: si rilancia **una volta sola**, e cosa ne segue lo dichiara la skill che lo ospita |
| **Concorrenza** | fan-out parallelo di default (subagent lanciati nello stesso blocco di tool call); sequenziale sui backend a rate limit stretto, e sempre sequenziale per ciò che tocca la stessa working tree |
| **Ripresa** | dallo stato osservabile su file: artefatti numerati nella cartella, report append-only, `git log` |
| **Modello per passo** | dal ruolo dichiarato (`giudice`/`worker`), risolto in `.claude/orchestration.md` §2 |

Fino a luglio 2026 le quattro catene giravano dentro il tool `Workflow` di Claude Code: legavano
il progetto a un solo host, mentre le skill devono poter girare identiche su ogni host. Quegli
script sono stati rimossi.

## Riferimento skill (una per una)

### Studio e decisione
- **`/decision-doc [cartella] [analizza solo: <sottoinsieme>]`** — accorpa i file di riferimento
  in `0. problem.md`, poi valuta lo stadio del problema e produce `1.5. studio-strategico.md` o
  `1. decision-doc.md`. Riesegui sulla stessa cartella per far avanzare lo stadio.
- **`/studia-libreria [libreria/tecnologia]`** — studia una libreria dalle fonti reali e produce
  appunti operativi in `docs/appunti-lib`.
- **`/studia-problema <descrizione problema>`** — studia un problema tecnico/architetturale
  leggendo il codice e produce `0. problem.md` in `docs/nuovi-sviluppi/<nome>/`. Chiude
  delegando `/decision-doc` a un subagent sulla cartella appena aperta: quello che torna in chat
  è già la lista di decisioni, a cui rispondi rilanciando `/decision-doc` sulla stessa cartella.

### Progettazione ed esecuzione
- **`/blueprint [cartella] [soluzione scelta]`** — dal decision-doc + soluzione scelta produce il
  brief `2. blueprint.md` e si ferma lì.
- **`/execute [cartella]`** — esegue in autonomia il brief, aggiorna Memoria e Diario mentre
  lavora, verifica di chiusura mirata (il gate è di `/review`), deposita `4. review-notes.md`.
- **`/deliver-feature [cartella] [soluzione scelta]`** — la catena intera fino al commit
  condizionale. Stessa unità che usa `/nightly-orchestrator` per ogni item della coda.

### Qualità e manutenzione
- **`/review [base-ref | path a "4. review-notes.md"] [--giri N] [--effort …] [--with arch-check,perf,test-coverage] [--no-commit]`**
  — ciclo di review su un diff, in due velocità che decide lui. Il **giro 1** è il fan-out: bug
  sempre attivo, arch-check/perf accesi dallo scope. I **giri successivi** rivedono i soli file
  toccati dai fix, con il solo finder bug, perché quei fix sono codice che nessuno ha ancora
  letto — ed è lì che si trovano le correzioni che ne rompono un'altra. Il numero di giri lo
  decide l'andamento (tre fix gravi ne impongono un altro, sotto decide il merito), guardrail a 6,
  ledger dei rilievi già scartati. Gate sempre, una volta all'uscita, poi **committa**,
  delegandolo a `/commit`: lo sopprime `--no-commit`, che passa chi committa da sé.
- **`/code-review [numero PR] [--comment]`** — review di una pull request già pubblicata invece
  che del working tree: controlli preliminari, fan-out su bug e conformità a `CLAUDE.md`,
  validazione dei rilievi e, solo su `--comment`, commenti inline sulla PR.
- **`/arch-check [cartella]`** — scansiona una cartella per violazioni delle regole
  architetturali: Hard rule di `CLAUDE.md` e rule di area in `.claude/rules/`.
- **`/perf [path, modulo o flusso]`** — investiga uno scope per colli di bottiglia; default
  propone quick win senza toccare codice, come finder di `/review` restituisce rilievi in sola
  lettura sul diff.
- **`/test-coverage [categoria] [--auto]`** — default misura la copertura per macrocategorie;
  `--auto` decide da sé se il diff ha logica scoperta e scrive i test senza chiedere.
- **`/censisci-tecnologie [progetto, ...]`** — misura le coordinate che l'inventario tecnologico
  di un progetto non sa interpretare, ne risolve i metadati dalle fonti pubbliche e le censisce in
  `technology_catalog.py` con nome, area e portanza curati; test di invariante inclusi, il gate è di `/review`. È
  la decisione 3 di `copertura-catalogo-tecnologico`: la curatela è di sviluppo, non dell'utente.
  Non committa.
- **`/update-memory [commit o range]`** — allinea `CLAUDE.md`, `.claude/rules/`, `memory/` e il
  documento tecnico del progetto al diff della consegna. È anche la fase `Memory` di
  `/deliver-feature`.
- **`/memory-review`** — audit completo e read-only di `memory/`: inventario, tre prospettive e
  riconciliazione; ogni rilievo include la scelta consigliata secondo `CLAUDE.md`, senza
  applicarla.

### Git
- **`/commit`** — committa le modifiche fatte nella chat corrente, senza mai fare push. Decide se
  il diff staged giustifica un allineamento di memoria e documentazione e in tal caso lo delega a
  `update-memory`; codice, artefatti non-codice e versione/changelog finiscono in **commit
  distinti** — fino a tre, in quest'ordine, e solo per i gruppi non vuoti.

### Run notturna (non presidiata)
- **`/nightly-plan ["cartella -> soluzione; ..."]`** — genera la coda statica
  `docs/nightly/nightly-run.json`. Non esegue nulla.
- **`/nightly-orchestrator`** (senza argomenti; path esplicito solo come override) — pre-flight
  sull'ambiente, poi ogni item della coda consegnato in sequenza col contratto
  `/deliver-feature`. Non scrive codice applicativo.