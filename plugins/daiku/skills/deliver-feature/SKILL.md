---
name: 'deliver-feature'
description: 'Consegna una feature dal decision-doc già risolto fino al commit in un''unica invocazione — brief -> esecuzione -> review (ciclo a giri) -> decisione -> aggiornamento memoria/documentazione sul diff staged -> commit condizionale (feature, poi doc/memoria) -> report. Orchestrata da te, delegando ogni fase a un subagent. Stessa unità atomica che /nightly-orchestrator usa per ogni item della coda.'
argument-hint: '[cartella] [soluzione scelta] [backend, opzionale — solo se la sessione gira su un backend switchato]'
---

Sei il **motore** della consegna di una singola feature: la sequenza — brief → esecuzione →
review a giri → decisione → aggiornamento memoria/documentazione → commit
condizionale (feature, poi doc/memoria) → report — la orchestri **tu**, delegando ogni fase a
un subagent secondo `contracts/orchestration.md`. Non esiste uno script che lo faccia al posto
tuo.

È la **stessa** unità atomica che `/nightly-orchestrator` esegue per ogni item della coda: se
cambia la sequenza, si tocca questo file e basta.

> **Parametri.** Ogni chiave fra graffe di questo contratto si risolve sui file di parametri del
> progetto, mai a memoria e mai per assunzione: le regole sono nella §5 di
> `contracts/project-contract.md`, che dice anche **in quale lingua scrivere** e cosa fare quando
> una chiave non c'è.

## Quando usarla

Quando hai **una** feature con `1. decision-doc.md` già risolto e vuoi la consegna completa
(fino al commit condizionale) senza invocare a mano `/blueprint` → `/execute` →
`/review` → `/commit` in sequenza. Se vuoi restare sui passi atomici singoli (per
fermarti tra uno stadio e l'altro), usa quelli direttamente: questa skill non li sostituisce,
li incatena per i casi in cui vuoi la consegna intera in un colpo solo.

## Input

Argomenti: `$ARGUMENTS` — `<cartella> <soluzione scelta> [backend]`.

- **`<cartella>`** — path della cartella (relativo alla root del repo, o assoluto), ovunque
  viva: `{paths.studies}/<nome>` è il caso comune ma non l'unico (le cartelle di studio
  prodotte da `/decision-doc`, ovunque vivano, sono altrettanto valide). Verificala sul
  filesystem: deve esistere e contenere `1. decision-doc.md`. Se manca, fermati e dillo.
- **`<soluzione scelta>`** — obbligatoria, verbatim: la passi al brief. Se ambigua rispetto al
  decision-doc (decisione o opzione inesistente), apri il documento, mostra le opzioni e
  chiedi — non indovinare. Se non ti vengono passati come argomenti le scelte dell'utente, usa quelle consigliate nel doc senza chiedere conferma.
- **`[backend]`** — opzionale, il nome del backend su cui la sessione gira: dichiaralo **solo**
  se non è quello nativo dell'host. Incide unicamente sulla concorrenza del fan-out di review,
  ed è `contracts/orchestration.md` §5 a dire se quel backend la sequenzializza. Non sceglie
  modelli: quelli vengono dai ruoli.
- Se `$ARGUMENTS` è vuoto o incompleto, **chiedi**. Non procedere a vuoto.

## Pool dei worktree

Ogni consegna lavora su un worktree del pool, mai sull'albero principale. Il pool vive in
`{worktree.pool}`, i nomi riusano `{worktree.prefix}<N>` con `N` da `1` a `{worktree.max}`, il
branch di ciascuno è `{worktree.branch_prefix}<nome>`. Mai un worktree oltre `{worktree.max}`,
mai un nome fuori convenzione: pieno è pieno.

Due radici, due mestieri, passate a ogni fase già risolte:

- **radice di lavoro** — dentro il worktree, la stessa posizione relativa che la radice tecnica
  occupa nell'albero principale: codice, diff, stage, commit, gate e fix girano qui, e da qui si
  risolvono `{code_root}` e le cwd dei comandi di `{areas}`. Non indovinarla: ricavala dal
  confronto fra `{repo_root}` e la radice da cui stai girando.
- **radice artefatti** — l'albero principale: `2. blueprint.md`, `3. memory-report.md`,
  `4. review-notes.md`, `5. review-report.md`, il ledger in `{paths.review_state}/` e l'append a
  `{paths.nightly}/nightly-review.md` vivono qui, così ripresa e report non dipendono dal worktree.

**Un worktree non è una copia inerte del progetto.** Se il progetto dichiara vincoli sul proprio
ambiente locale — dipendenze installate in un albero condiviso, link o junction fra le due copie,
strumenti che riscrivono file fuori dal checkout — quei vincoli valgono qui e li dichiara
`{instructions_file}`: leggilo prima di eseguire qualunque comando di ambiente dentro il worktree.
Non si riscrivono qui, e non si indovinano: un comando di installazione lanciato nel posto
sbagliato è il modo tipico in cui una consegna rompe l'albero principale mentre crede di lavorare
sul proprio.

## Prima di iniziare

Leggi `contracts/orchestration.md`: ruoli, host, come si lancia un subagent, concorrenza. Ogni
fase qui sotto dichiara il proprio ruolo (**giudice** o **worker**) e tu risolvi il modello con
la regola della sua §2 — mai da qui.

## Avanzamento e rilievi

**Non si tiene un log di avanzamento su file.** Avanzamento e rilievi vanno **in chat**, man mano:
una riga quando una fase parte e quando torna, col ruolo che la esegue, e subito ciò che hai notato
e che non entra in nessun blocco — un subagent tornato malformato, una fase più lenta del previsto,
un'evidenza che non quadra.

Lo stato che serve a **riprendere** non è quello: sono gli artefatti che le fasi depositano
(`2. blueprint.md`, `3. memory-report.md`, `4. review-notes.md`, `5. review-report.md`) e
`git log`. Quelli sono verificabili, un log scritto a mano no — e la ripresa che si fida di una
riga che nessuno garantisce sia stata scritta riparte dalla fase sbagliata. Il numero `3` è
dell'esito della fase 5b — i file che ha toccato e le voci da confermare all'owner — che senza un
artefatto sarebbe l'unica fase a non lasciare niente dietro di sé. **Non è un diario**: dice cosa
quella fase ha lasciato, mai come ci è arrivata.

## La sequenza

Le fasi sono ordinate e non saltabili. Ognuna è **un** subagent, con il prompt che gli dà il
contratto da leggere, l'input risolto e il blocco JSON da restituire.

Ogni blocco porta il campo che dichiara l'esito della propria fase: `ok` per Brief, Execute e
Report, `gate` per Review, `staged` per lo Stage, `updated` per la Memoria, `committed` per il
Commit. **Se quel campo dice fallimento, o se il blocco non torna affatto, la consegna si ferma
lì** (vedi *Blocco anticipato*) — un blocco assente non si interpreta a intuito e non si ricostruisce
dalla prosa del subagent.

**Cosa dice fallimento, campo per campo**, perché non tutti quei campi ne dichiarano uno: `ok: false`
per Brief, Execute e Report; `staged: false` per lo Stage, che salta 5b e 6 e va al report come la
fase stessa prescrive; `committed: false` per il Commit; e in ogni fase il **blocco assente**. Per la
**Review** il fallimento è **solo** il blocco assente, non `gate`: un `gate: "rosso"` è una misura
riuscita, e la tabella della fase 4 la classifica `BLOCKED_NO_COMMIT` — fermarsi qui la
appiattirebbe su `blocked`, che significa «si è rotto il brief», e la notte perderebbe la differenza
fra un item che non compila e uno che non è mai partito. `updated: false` **non è mai un
fallimento**: `skills/update-memory/SKILL.md` lo dichiara «l'esito atteso, non un fallimento» quando il diff non
giustifica alcuna scrittura, e la fase 6 prevede già quel caso per iscritto («Se 5b non ha scritto
nulla, questo commit **non esiste**»).

Le fasi che hanno un contratto proprio dichiarano il blocco **in casa loro**, e qui si cita: ogni
riscrittura locale si restringe alla prima modifica del nodo (§4.2 di `contracts/orchestration.md`).

### 0. Acquisizione — ruolo **worker**

Un subagent che assegna il worktree. Nel prompt: il pool `{worktree.pool}`, il prefisso
`{worktree.prefix}`, il tetto `{worktree.max}`, il prefisso di branch `{worktree.branch_prefix}`,
e il blocco da restituire. Esegue solo questi comandi Git, in ordine, senza chiedere conferma.

Il **branch di integrazione** è quello su cui l'albero principale è posizionato adesso —
`git rev-parse --abbrev-ref HEAD` da lì, una volta sola — e nei comandi qui sotto sta scritto
`<INT>`. Non lo si assume: una consegna si integra dove l'owner sta lavorando, e un nome
cablato la farebbe finire altrove nel progetto che non usa quel nome.

1. `git worktree list --porcelain` e `git rev-parse <INT>` dall'albero principale: i worktree
   registrati e l'HEAD di riferimento.
2. Libero = registrato, con `git -C <pool>/<nome> status --porcelain` vuoto e
   `git -C <pool>/<nome> rev-parse HEAD` uguale all'HEAD di `<INT>`. Il primo libero in ordine di
   numero è il tuo.
3. Se c'è: `git -C <pool>/<nome> reset --hard <INT>` (albero pulito: sicuro) e usalo.
4. Se non c'è e i registrati sono meno di `{worktree.max}`:
   `git worktree add <pool>/{worktree.prefix}<M> -b {worktree.branch_prefix}{worktree.prefix}<M> <INT>`,
   col minore `M` libero.
5. Se non c'è e sono già `{worktree.max}`: non creare niente e non riusare uno sporco —
   restituisci `ok: false`.

```json
{"ok": true, "worktree": "<nome>", "worktree_root": "<path di <pool>/<nome>/src>", "detail": "<se ok=false, perché>"}
```

`ok: false` ferma la consegna come il *Blocco anticipato*: report `blocked`, niente stage, niente
commit. Uno sporco non è un tuo residuo da ripulire: è lavoro di un'altra consegna che nessuno ha
registrato. Da qui in poi ogni fase riceve già risolti il `<nome>`, la radice di lavoro e la
radice artefatti.

### 1. Brief — ruolo **giudice**

Subagent che produce il brief. Nel prompt:

- leggi per intero `skills/blueprint/SKILL.md` e segui quel contratto alla
  lettera;
- cartella `<cartella>` (contiene `1. decision-doc.md`), soluzione scelta `<verbatim>`;
- carica `{instructions_file}` e, per ogni area che il brief tocca, apri la rule pertinente in
  `.daiku/policies/` leggendo i loro `paths`: decidi la collocazione dei layer **prima** di aprire
  codice, non contare sul caricamento automatico delle rule;
- `{memory.index}` e i path delle memorie che il perimetro tocca, da aprire prima di decidere
  (§4.1 di `contracts/orchestration.md`): le decisioni già prese e i vincoli non deducibili dal
  codice stanno lì, e un brief che li ignora li fa riscoprire all'esecutore a sue spese;
- il brief legge `1. decision-doc.md` e scrive `2. blueprint.md` nella **radice artefatti**
  (l'albero principale): il codice lo ancora leggendolo lì — il worktree è una copia
  sincronizzata all'acquisizione;
- se `<cartella>/2. blueprint.md` esiste già, **non** rieseguire il brief: restituisci
  `ok: true` col path esistente;
- non chiedere nulla all'utente: cartella, decision-doc e soluzione esistono già.

L'esito atteso è il blocco che `skills/blueprint/SKILL.md` dichiara nella propria § *Cosa restituisci*, per
intero e con quei nomi di campo.

### 2. Execute — ruolo **worker**

Subagent esecutore. Nel prompt:

- leggi per intero `skills/execute/SKILL.md` e segui quel contratto alla
  lettera (autonomia reale, verifica osservabile, aggiorna il file mentre lavori, verifica di chiusura
  obbligatoria — **senza** lanciare la suite o il gate di pacchetto, che sono della fase 3 —
  deposita `4. review-notes.md` col base-ref reale);
- applicalo alla cartella `<cartella>`; carica `{instructions_file}`; le regole di area entrano da sole
  quando apri i file che coprono, ma se tocchi un'area senza averne letto un file, aprila tu;
- codice e comandi Git nella **radice di lavoro** del worktree; `4. review-notes.md` nella
  **radice artefatti**, e il base-ref che vi depositi è lo SHA dell'HEAD della radice di lavoro
  a inizio esecuzione (`git -C <worktree_root> rev-parse HEAD`);
- `{memory.index}` e i path delle memorie pertinenti al perimetro, da aprire prima di scrivere
  (§4.1 di `contracts/orchestration.md`);
- non chiedere nulla all'utente; fermati solo davanti a un blocco reale (azione distruttiva non
  giustificata o contraddizione insanabile).

L'esito atteso è il blocco che `skills/execute/SKILL.md` dichiara nella propria § *Cosa restituisci*, per intero
e con quei nomi di campo.

### 3. Review — `/review`, sempre, dentro la consegna

La review **fa parte della consegna**: non è un passo opzionale, non si rimanda all'utente, e
non si salta — è l'unico punto della catena che esegue il gate di build e test, quindi senza di lei nessuno ha provato che la
feature compili. Senza di lei non esiste la decisione della fase 4, quindi non esiste il commit.

Esegui integralmente `skills/review/SKILL.md` — scope → giri di finder e fix, finché il
ciclo converge → gate — sul file `<cartella>/4. review-notes.md` nella **radice artefatti**
(nome fisso per
contratto di `/execute`: non concatenare il path restituito, il suo formato non è garantito).
È la stessa disciplina che gira da `/review` standalone: una sola fonte, nessuna copia
— **non riscriverla qui**. Nel prompt passale anche la radice di lavoro del worktree e la
radice artefatti: diff, fix, copertura e gate girano nella prima, ledger e `5. review-report.md`
nella seconda (`skills/review/SKILL.md`, § *Quando la review gira su un worktree*).

**Delegala a un subagent** che esegue quel contratto: non orchestrarne tu le fasi. La resa del suo
giro 1 sta nell'indipendenza dei finder, e orchestrarla da qui — dove hai in testa il brief,
l'esecuzione e ciò che ti aspetti — è la passata già convinta di sé che il fan-out esiste per
evitare (§4 di `contracts/orchestration.md`, *Profondità e degradazione*). Se stai **riprendendo**
un item la cui review era già partita, passale il path del ledger che trovi in
`{paths.review_state}/` con il `base` di questo item **e** con `item` uguale a `<cartella>`: riparte
dal giro successivo invece di ripagare l'intero triage. I due campi si guardano insieme perché la
baseline da sola non identifica una review — dentro una coda notturna i `base` coincidono per
costruzione — e **se i candidati restano più di uno, o se il ledger non porta `item`, non ne passi
nessuno**: il triage si ripaga, mentre il ledger di un'altra feature spegne in silenzio
`su_fix_precedente` e `oscillazione`. **Se hai ricevuto un `[backend]`, passaglielo come `--backend <nome>`**: è l'unico argomento
della consegna che serve a lei e non a te. Il fan-out dei finder è suo, e la §5 di
`contracts/orchestration.md` decide sul nome se sequenzializzarlo; senza questa riga il parametro
muore qui — la coda lo dichiara, tu lo ricevi, e l'unico passo che deve rispettarlo non lo vede,
finché i finder del giro 1 partono in parallelo contro il limite che quel flag esiste per
rispettare. `--with` non si usa qui: le discipline condizionali le decide lo scope dal diff.

**`--no-commit` invece passaglielo sempre**, ed è obbligatorio: `/review` chiude col commit per
impostazione propria (§ *Chiusura* del suo file), e il commit di questa consegna è la **fase 6**,
dopo la decisione della fase 4 e l'allineamento della 5b. Senza quel flag la review committerebbe
il codice prima che tu abbia valutato le sue voci aperte, la fase 6 troverebbe l'albero già
pulito, e `update-memory` girerebbe due volte — una da `/commit` dentro la review, una come fase
5b — su un diff che nel frattempo è già entrato.

L'esito atteso è il blocco che `skills/review/SKILL.md` dichiara nella propria § *Esito*, **per intero e con
quei nomi di campo**: leggilo da lì, non ridichiararlo qui. Ti servono tutti — `uscita`,
`discipline_mancate` e `indipendenza` decidono quanto `gate` e `da_confermare` (fase 4), e un
blocco ricopiato più stretto è esattamente il modo in cui smettono di arrivare.

Se la review non trova alcun file sotto `{code_root}` da revisionare, fermati: non c'è una
consegna da valutare.

### 4. Decision — la decidi **tu**, in chat, senza subagent

È una classificazione deterministica su dati già strutturati: non serve un secondo giudice che
ri-giudichi. L'applicatore della review ha già marcato ogni voce di `da_confermare` con
`bloccante`, perché aveva il rilievo in mano.

Descrivi ogni voce aperta come `<file>[:<riga>] [<classe>] <scenario>`, poi:

| Condizione | Esito |
|---|---|
| `gate` ≠ `verde` | `BLOCKED_NO_COMMIT` — blocker: `gate rosso: <gate_detail>` più tutte le voci bloccanti |
| `uscita` è `oscillazione` o `giri-esauriti` | `BLOCKED_NO_COMMIT` — blocker: il ciclo non è convergiuto, con l'uscita e i gravi dell'ultimo giro |
| `discipline_mancate` non è vuoto | `BLOCKED_NO_COMMIT` — blocker: le discipline che su questo diff non hanno girato |
| gate verde, almeno una voce `bloccante: true` | `BLOCKED_NO_COMMIT` — blocker: quelle voci |
| gate verde, nessuna bloccante, restano voci non bloccanti | `GREEN_WITH_POST_DECISIONS` |
| gate verde, nessuna voce aperta | `GREEN_COMMITTED` |

Le condizioni di blocco si valutano **tutte**: un esito che ne soddisfa più di una le riporta tutte
come blocker, e la prima che si verifica non chiude la valutazione.

Le tre righe in cima sono le stesse con cui `/review` si ferma da sola prima di committare (§ *Chiusura* del
suo file), e valgono qui per la stessa ragione: `giri-esauriti` è un'uscita per esaurimento, non
per convergenza — il ciclo stava ancora correggendo difetti quando gli è finito lo spazio;
`oscillazione` significa due giri che si rimpallano la stessa riga; una disciplina mancata non ha
girato su questo diff e **non girerà mai più**, perché `arch` e `perf` si fanno una
volta sola sul diff completo. Senza queste righe lo stesso identico esito di review bloccherebbe il
commit lanciata a mano e lo lascerebbe passare dentro la consegna — mentre questa skill dichiara
di eseguire «la stessa disciplina».

`indipendenza: persa` **non** blocca: dice che il giro 1 è stato valutato in un contesto solo
perché la delega non era disponibile, e un host senza delega resta un host su cui si consegna.
Entra però nel report e nel riepilogo in chat come limite dichiarato di quella review, perché una
consegna verde con il fan-out degradato non è la stessa cosa di una consegna verde.

Le voci **non** bloccanti sono `post_commit_decisions`: non fermano il commit, restano nel
report. Sono **bivi veri** — due strade difendibili in cui la scelta cambia il risultato in modo
materiale — perché tutto il resto la review lo ha già risolto da sé (`skills/applier/SKILL.md`, § *Il blocco che restituisci*).
Non promuovere a decisione post-commit ciò che non è un bivio: lavoro lasciato a metà, pulizia
opzionale, dubbi già sciolti o cose fuori dal perimetro del brief non entrano qui, e
`GREEN_COMMITTED` resta l'esito normale di una consegna sana. I bivi che restano non li risolvi
tu e non li rigiudichi: li riporti.

### Sblocco meccanico — quando il solo blocker è il gate rosso

Se la classificazione è `BLOCKED_NO_COMMIT` per la sola prima riga della tabella (`gate` ≠ `verde`) —
cioè uscita convergiuta (`punto-fisso`), `discipline_mancate` vuoto, nessuna voce `bloccante: true` e
`da_confermare` vuoto — non fermarti: il ciclo ha già detto tutto ciò che sapeva dire, resta solo
lavoro meccanico. Delega **un** subagent worker che, nella radice di
lavoro, corregga solo i rilievi del gate sulle righe del diff con fix a singola soluzione ovvia
(lint, formato, type meccanici), rilanci il gate dell'area toccata e restituisca
`gate`/`gate_detail`/`needs_tradeoff`. Vincoli: nessun cambio di comportamento, nessun file fuori
dai segnalati, mai stage/commit, e se anche un solo fix ammette due strade difendibili il subagent
lo lascia stare e lo dichiara in `needs_tradeoff` invece di indovinare.

- Se torna `gate: verde` e `needs_tradeoff` vuoto: riclassifica con la tabella (l'esito tipico è
  `GREEN_COMMITTED`) e prosegui dalle fasi 5 in poi; il report racconta lo sblocco in un paragrafo.
- Altrimenti (`gate` ancora rosso, o `needs_tradeoff` non vuoto): resta `BLOCKED_NO_COMMIT` con quei
  blocker, e da qui in poi vale il paragrafo qui sotto (niente stage/memoria/commit, worktree sporco
  e dichiarato).

Un solo tentativo per consegna: se il gate resta rosso non rilanciare il fix — la seconda passata è
lavoro che oscilla, e l'oscillazione si dichiara, non si ripete. Questa è l'unica strada che riapre
un `BLOCKED_NO_COMMIT` dentro la stessa consegna: voci bloccanti, bivi e discipline mancate non si
sbloccano mai così.

Su `BLOCKED_NO_COMMIT` non si stagea, non si aggiorna la memoria e non si committa — e **il
worktree resta sporco di proposito**: la consegna non crea mai
`blocked.patch` né parcheggia in alcuna forma; le modifiche restano in chiaro sul branch del
worktree, l'albero principale non si tocca. Prima del report elenca lo sporco
(`git -C <worktree_root> status --porcelain -- {code_root}`) e dichiarane i path
nel report e nel riepilogo in chat; il campo `blocked_patch` del blocco d'uscita vale sempre
`null`.

Il caso peggiore è confinato invece che prevenuto: lo sporco bloccato resta sul branch del
suo worktree e non entra mai nel branch di integrazione, quindi l'item successivo — su un worktree libero e
risincronizzato — parte pulito. Il prezzo è il pool che si restringe: ogni worktree bloccato è
uno in meno finché l'owner non lo pulisce o lo committa a mano, e a pool esaurito la fase 0
ferma la consegna.

### 5. Memory — solo se l'esito **non** è `BLOCKED_NO_COMMIT`

Due subagent in sequenza, **entrambi prima del commit**.

**5a. Stage — ruolo worker.** Lo stage è separato dal commit perché il passo 5b deve leggere il
diff **integrale** della feature — file nuovi compresi, che `git diff` non mostra finché non
sono in index. Nel prompt: la radice di lavoro del worktree, ed esegui solo questi comandi Git
con `git -C <worktree_root>`, in ordine, senza chiedere conferma —
`git status --porcelain -- {code_root}` per individuare i file toccati (ignora sempre qualunque
file esterno a `{code_root}`, anche se modificato), `git add <i file individuati, elencati
singolarmente>` (mai `-A`, mai `.`), di nuovo `git status --porcelain -- {code_root}` per
confermare l'index. Mai `git commit`, mai `git push` in questo passo.

```json
{"staged": true, "files": ["<path>"], "detail": "<se staged=false, perché>"}
```

Se `staged` è `false`, non c'è nulla da consegnare: salta 5b e 6, vai al report.

**5b. Aggiornamento memoria/documentazione — ruolo giudice.** Nel prompt:

- leggi per intero `skills/update-memory/SKILL.md` e segui quel contratto
  alla lettera;
- il diff da ispezionare è quello **in index** sotto `{code_root}` nella **radice di lavoro**
  del worktree: `git -C <worktree_root> diff --cached --stat -- {code_root}` e
  `git -C <worktree_root> diff --cached -- {code_root}`; è il diff
  integrale della feature, lo stesso che il commit produrrà. Anche i file che scrivi
  (`{instructions_file}`, `.daiku/policies/`, `{memory.root}`, `{tech_doc}`) stanno nella radice di lavoro:
  il merge li porterà sull'albero principale insieme al codice;
- la **cartella dell'item** è `<cartella>` nella **radice artefatti**: depositaci il tuo blocco di ritorno come
  `3. memory-report.md`, secondo il punto 7 della sua § *Procedura*. È la fase più vicina al limite
  di contesto — legge il diff integrale — ed è l'unica il cui esito, senza quel file, non
  sopravvive all'interruzione: alla ripresa la memoria risulta già allineata, `files` torna vuoto e
  il commit 2 non ha più un ambito;
- **non sei autorizzato a committare il tuo gruppo**: non eseguire alcun comando Git di scrittura
  e non toccare l'index di `{code_root}`; ti limiti a modificare `{instructions_file}`, `.daiku/policies/`,
  `{memory.root}` e `{tech_doc}` — più l'artefatto qui sopra, che è la traccia della fase e non un
  aggiornamento di memoria — e restituisci `committed: null`. I commit sono la fase 6, che li fa
  nell'ordine dichiarato — prima la feature, poi doc e memoria — e quell'ordine è la ragione per
  cui il permesso qui non si concede.

Il permesso di commit è una proprietà **dell'invocazione**, non del nodo: lo stesso contratto,
invocato da `/commit`, lo riceve. Dirglielo esplicitamente nel prompt non è una ripetizione —
senza quella riga il suo default è «no», ed è il default giusto, ma è la riga che rende leggibile
perché qui sia così.

L'esito atteso è il blocco che `skills/update-memory/SKILL.md` dichiara nella propria § *Procedura*, punto 7,
per intero: `updated`, `files`, `confirm_with_owner`, `detail`, `committed`. Quest'ultimo dev'essere
`null`, come il divieto qui sopra impone; se torna con uno SHA, il subagent ha committato contro il
prompt — **non rifare quel commit** nella fase 6, verificalo con `git log`, riportalo come anomalia
in chat e prosegui col resto.

### 6. Commit — ruolo **worker**

Un solo subagent, fino a tre commit distinti e nell'ordine dichiarato, sul branch del worktree
(`{worktree.branch_prefix}<nome>`). Nel prompt: la radice di lavoro, ed esegui solo
comandi Git con `git -C <worktree_root>`, in ordine, senza chiedere conferma.

**Commit 1 — la feature.** I file sotto `{code_root}` sono **già** in index: non eseguire
`git add`, committi esattamente ciò che c'è. Messaggio conforme alla § *Convenzione di commit* di `skills/commit/SKILL.md`, che la risolve
sul progetto. **Mai** trailer di co-autoria né menzioni all'agente che ha generato il lavoro. Poi
`git log --oneline -1` per leggerne lo SHA.

**Commit 2 — doc e memoria.** Solo se il passo 5b ha davvero scritto qualcosa e solo se il primo
commit è riuscito. Ambito **esclusivo** i file elencati da 5b, tutti fuori da `{code_root}`:
`git status --porcelain -- <ciascuno>` per confermare che risultino modificati, `git add <gli
stessi, elencati singolarmente>` (mai `-A`, mai `.`, mai file sotto `{code_root}`), commit con
messaggio che apre con `{commit.memory_prefix}`, per il resto secondo la stessa convenzione,
`git log --oneline -1` per lo SHA. Se 5b non ha scritto nulla, questo commit **non esiste**: non
toccare file fuori da `{code_root}`. Se 5b è tornato con un `committed` valorizzato — cioè ha
committato il proprio gruppo pur non essendo autorizzato — questo commit **non esiste lo stesso**:
riporta quello SHA in `memory_commit_sha` con `memory_committed: true`, e non tentare un commit
vuoto su file che nessuno ha più modificato.

**Commit 3 — versione e changelog.** Terzo gruppo: `{changelog}`, `{version.file}` e i file di
`{version.replicated_in}`. Quando la voce di changelog si scrive, quando il bump minor si fa e
cosa comporta è dichiarato in `skills/commit/SKILL.md`, § *Bump di versione e
changelog*: il subagent la legge **da lì** e la esegue, **non riscriverla qui** — è la stessa
forma con cui la fase 3 rimanda a `skills/review/SKILL.md` invece di riscriverne la disciplina. Una sola fonte
per il changelog, altrimenti le feature consegnate da qui non arrivano mai nel registro delle
versioni, mentre le stesse consegnate dal commit di chiusura di `/review` ci arrivano. Messaggio e ordine sono quelli che quella sezione
dichiara; il commit va **dopo** i primi due e non esiste se il gruppo è vuoto. Poi
`git log --oneline -1` per lo SHA.

**Mai `git push`**, in nessuno dei tre.

**Se la sequenza si ferma fra un gruppo e il successivo, dillo con i path.** Un commit 1 fallito
lascia nell'albero il gruppo memoria/doc che 5b ha appena scritto, e — se il bump l'aveva toccato —
anche versione e changelog: due gruppi che **non si parcheggiano**, perché sono artefatti da
riconciliare a mano, non codice da riapplicare con `git apply`. Elencali in `detail` e nel report
con i loro path. Il controllo di pulizia dell'item successivo li vede e ferma la notte (§2 di
`skills/nightly-orchestrator/SKILL.md`): è l'esito giusto, e dichiararli è ciò che permette a
chi legge la mattina di sapere di chi sono invece di trovarsi davanti sporco anonimo.

```json
{"committed": true, "commit_sha": "<sha>", "memory_committed": false, "memory_commit_sha": "<sha se esiste>", "version_commit_sha": "<sha se esiste>", "detail": "<...>"}
```

### 6b. Merge — ruolo **worker**, solo se l'esito non è `BLOCKED_NO_COMMIT`

Un subagent, comandi Git nell'albero principale, in ordine, senza chiedere conferma. Il merge è
l'unico passo che scrive sull'albero principale, quindi è l'unico che può correre con un'altra
consegna della notte: la concorrenza sta sul lock di Git, non su un tuo coordinamento.

1. Pulizia dei gruppi di commit sull'albero principale: `git status --porcelain` sui pathspec
   dei tre gruppi che `skills/commit/SKILL.md` § *Procedura* 3 enumera — codice,
   memoria/doc, versione/changelog — dev'essere vuoto. Gli artefatti non committati della
   consegna (`2./3./4./5.`, ledger, append al report) stanno fuori da quei pathspec e non
   contano.
2. `git merge --no-ff {worktree.branch_prefix}<nome> -m "merge: <item>"`. Mai `git push`.
3. Se Git rifiuta per lock concomitante, attendi qualche secondo e riprova, fino a tre volte;
   poi fermati e dillo nel `detail`.
4. Se il merge va in conflitto: `git merge --abort` e niente risoluzione manuale — un conflitto
   risolto qui è codice che nessun finder ha visto — e chiudi con `merged: false` e i path in
   conflitto in `conflicts`.

   Eccezione al punto 4: il conflitto sul solo `{changelog}` si
   risolve da sé per unione, ed è l'unico che si risolve dentro la consegna. Vale solo se è
   puramente additivo — entrambe le parti aggiungono voci distinte nella sezione non rilasciata,
   senza sovrapporsi sulle stesse righe né toccare header di versione: si tengono entrambe le
   voci, si tolgono i marker, si fa `git add` del solo changelog e si chiude con
   `git commit --no-edit`, verificando che il diff contenga entrambe le voci e niente altro di
   inatteso. Qualunque altro conflitto, o un changelog non puramente additivo, resta punto 4 tale
   e quale (abort + `BLOCKED_NO_COMMIT`): un'unione inventata su righe sovrapposte è una decisione
   con tradeoff, e quelle non si prendono qui.

```json
{"merged": true, "merge_sha": "<sha di HEAD dopo il merge>", "conflicts": [], "detail": "<...>"}
```

Un merge in conflitto classifica la consegna `BLOCKED_NO_COMMIT` (blocker: i path in conflitto,
branch conservato sul worktree): committato sul branch, non integrato. Il worktree resta
com'è — niente pulizia — e il report dice branch e conflitti.

### 6c. Pulizia — ruolo **worker**, solo se il merge è riuscito

Un subagent: `git -C <pool>/<nome> reset --hard <merge_sha>` e
`git -C <pool>/<nome> clean -fd` — senza `-x`: gli ignorati, dove vivono le junction pesanti,
non si toccano — poi `git -C <pool>/<nome> status --porcelain` vuoto a conferma. Il worktree
resta registrato col suo nome e il suo branch: è pronto per la prossima consegna. Su
`BLOCKED_NO_COMMIT` o `blocked` questa fase non esiste: il worktree resta sporco e dichiarato.

### 7. Report — ruolo **worker**

Subagent che appende (creando il file se non esiste) a `{paths.nightly}/nightly-review.md`, **in
coda** — mai sovrascrivere o riformattare ciò che c'è già.

È l'unica fase che deve riportare campi prodotti da **altre quattro**, e un subagent in contesto
fresco non ne ricava nessuno da solo. Nel prompt vanno quindi **già risolti**, uno per uno (§4.1
di `contracts/orchestration.md`): ricostruirli a memoria fa cadere per prime proprio le righe che
dicono cosa la consegna **non** ha fatto, e `/nightly-orchestrator` considera chiuso ogni item che
abbia il proprio blocco in quel file — un report povero non si riapre mai. Nel prompt:

- il path su cui appendere, `{paths.nightly}/nightly-review.md`, e il vincolo dell'append in coda;
- il `run_id` della coda se chi ti ha invocato te l'ha passato, l'`<id item>` e `<cartella>`;
- la **soluzione consegnata**, verbatim: è lui a distillarla, non tu;
- dal blocco della **fase 3**: `gate` e `gate_detail`, `uscita`, `discipline_mancate` e
  `indipendenza`;
- dalla **fase 4**: lo `status` classificato e le voci `da_confermare` rimaste, col loro
  `scenario`;
- dal blocco della **fase 5b**: `updated` e le voci `confirm_with_owner`;
- dal blocco della **fase 6**: `committed` e i tre SHA — `commit_sha`, `memory_commit_sha`,
  `version_commit_sha` — più i path rimasti sporchi dichiarati dalla fase 4 (nessun parcheggio:
  il worktree resta sporco e dichiarato);
- dalla **fase 6b**: `merged`, `merge_sha` ed eventuali `conflicts`; dalla **fase 0**: il
  `<nome>` del worktree e il suo branch;
- la forma del blocco da scrivere e il blocco JSON da restituire, che sono quelli qui sotto.

Un solo blocco:

- titolo `## <run_id> · <id item>` se chi ti ha invocato ti ha passato il `run_id` della coda,
  altrimenti `## <id item>`. Il file è append-only e sopravvive alle notti: lo stesso item
  ri-accodato dopo essere uscito bloccato porta lo stesso `<id>`, e senza l'identificativo della
  coda la ripresa scambierebbe il blocco della consegna precedente per quello di questa;
- sotto, **prosa continua in paragrafi** (mai elenchi puntati, mai sotto-titoli): 2-3 frasi su
  cosa è stato consegnato (distilla la soluzione scelta al succo, non incollarla verbatim); un
  paragrafo sull'esito della review (gate e sua sintesi in una frase, più i limiti che la review
  ha dichiarato su sé stessa — discipline mancate, indipendenza persa — se ce ne sono); un paragrafo con stato
  finale e commit; se restano voci aperte — blocker, bivi post-commit, fatti di memoria da
  confermare con l'owner — un ultimo paragrafo che le riassume raggruppate per tema e scritte
  **in modo semplice**: cosa è in gioco, quali sono le strade e cosa cambia scegliendo l'una o
  l'altra, comprensibile senza aprire il codice. Se non ne restano — il caso normale, perché
  review e consegna risolvono da sé quanto sanno risolvere — ometti quel paragrafo.

Paragrafi separati da una riga vuota. Chiaro e sintetico: si deve capire lo stato in 30 secondi.

Sì, è lo stesso file della run notturna: la consegna è una sola unità e il suo report vive in un
solo posto.

```json
{"ok": true, "report_path": "{paths.nightly}/nightly-review.md", "detail": "<se ok=false, il motivo: file non scrivibile, append fallito>"}
```

È l'ultima fase e nessuno decide più niente sul suo esito, ma il blocco serve lo stesso: un report
che non è stato scritto è l'unica traccia della consegna che sparisce, e senza questo campo la sua
assenza si scopre aprendo il file. Se `ok` è `false`, riportalo in chat con il motivo — il lavoro
è committato e non si annulla, ma la consegna non è documentata.

## Blocco anticipato

Se Acquisizione, Brief o Execute falliscono, la consegna si ferma: dillo in chat, fai scrivere al report un
blocco che dice cosa doveva essere consegnato, in quale fase si è fermata e perché, e chiudi con
`status: "blocked"`. Niente stage, niente memoria, niente commit, niente merge.

**Anche qui il report è un subagent, e anche qui il prompt è l'unico canale.** Gli passi i soli
campi della fase 7 che a quel punto esistono — path del file e append in coda, `run_id` e
`<id item>`, `<cartella>` e soluzione, **quale fase si è fermata** e il `detail` del suo blocco,
`status: "blocked"`, i path rimasti sporchi sotto `{code_root}` — e gli dici esplicitamente che gli altri **non
esistono**: gate, commit e memoria non sono mai girati. Senza quella riga il report li racconta
comunque, ed è il modo in cui un item mai partito si legge come un item consegnato male.

**E anche qui il worktree resta sporco.** Se Execute ha scritto qualcosa sotto `{code_root}`,
prima del report ne elenchi i path (`git -C <worktree_root> status --porcelain -- {code_root}`) e li dichiari nel
report e in `reason`; `blocked_patch` vale `null`. Lo sporco resta confinato al suo worktree e
al suo branch — l'item successivo acquisisce un worktree libero, quindi non se lo ritrova nel
diff — ma quel worktree esce dal pool finché l'owner non lo pulisce o lo committa a mano: dillo
nel report col suo nome.

## Esito

1. **In chat, poche righe**: stato finale (`GREEN_COMMITTED` | `GREEN_WITH_POST_DECISIONS` |
   `BLOCKED_NO_COMMIT` | `blocked`), worktree usato, SHA se committato e SHA del merge,
   se la memoria è stata aggiornata e il suo
   SHA (assente se non c'era nulla da aggiornare). Il dettaglio — gate, da confermare, decisioni
   rimaste — è già in `{paths.nightly}/nightly-review.md`: **non ripeterlo**, rimanda al file.

2. **Chiudi sempre con il blocco a contratto**, così chi ti ha invocata — l'utente o
   `/nightly-orchestrator` — lo legge senza interpretare la prosa. Nessun campo si omette: a valore
   assente si scrive `null`.

   ```json
   {
     "item": "<id della coda, o la cartella se invocata a mano>",
     "status": "GREEN_COMMITTED|GREEN_WITH_POST_DECISIONS|BLOCKED_NO_COMMIT|blocked",
     "worktree": "<nome del worktree, o null se l'acquisizione è fallita>",
     "commit_sha": "<sha o null>",
     "merge_sha": "<sha del merge nel branch di integrazione, o null>",
     "memory_updated": false,
     "memory_committed": false,
     "memory_commit_sha": "<sha o null>",
     "report_path": "{paths.nightly}/nightly-review.md",
     "blocked_patch": null,
     "reason": "<solo se blocked: il motivo esatto>"
   }
   ```

   Ogni campo viene da una fase, e si riporta **verbatim** da lì — non si ricalcola a memoria:
   `status` dalla fase 4 (un merge in conflitto della fase 6b lo riclassifica
   `BLOCKED_NO_COMMIT`); `worktree` dalla fase 0 (`null` se non ha acquisito niente);
   `commit_sha` da `committed`/`commit_sha` della fase 6; `merge_sha` dalla fase 6b (`null` se il
   merge non è partito o è andato in conflitto); `memory_updated` dal
   campo `updated` della fase 5b (`false` se la fase non è stata eseguita); `memory_committed` e
   `memory_commit_sha` dalla fase 6; `reason` dal `detail` della fase che ha bloccato;
   `blocked_patch` sempre `null` (campo conservato per compatibilità): la consegna non parcheggia
   — su `BLOCKED_NO_COMMIT` e su `blocked` il worktree resta sporco e i path si dichiarano nel
   report e in `reason`.

## Auto-inganni (fermali prima che ti fermino)

| Se ti stai dicendo… | La verità |
|---|---|
| «Faccio io il brief/l'esecuzione qui in chat, è più veloce» | Ogni fase è un subagent in contesto fresco (`contracts/orchestration.md` §4). In chat ti porti dietro tutto il contesto delle fasi precedenti e la catena degenera. |
| «Riscrivo qui la disciplina di review, così è tutto in un posto» | No: la fonte è `skills/review/SKILL.md`. Copiarla qui la fa divergere alla prima modifica. |
| «Il gate è rosso ma il codice è chiaramente giusto, committo» | Gate rosso = `BLOCKED_NO_COMMIT`. La classificazione è deterministica, non un giudizio. |
| «Questa la lascio come decisione post-commit, così decide l'utente» | Le decisioni post-commit sono bivi veri, non ciò che nessuno ha voluto risolvere. Se una strada è chiaramente la giusta, si risolve dove il rilievo nasce. |
| «Committo prima e aggiorno la memoria dopo» | L'ordine è dichiarato: stage → memoria → commit feature → commit doc/memoria → commit versione/changelog. Nessuna feature si congela senza che gli artefatti siano riallineati sullo **stesso** diff. |
| «Aggiungo `-A` allo stage, è più comodo» | Mai: lo scope è `{code_root}` e i file si elencano singolarmente. Il secondo commit ha l'ambito opposto ed è esclusivo. |
| «Lavoro sull'albero principale, è già lì» | Il codice vive nel worktree acquisito alla fase 0. Sull'albero principale scrivono solo il merge (6b) e gli artefatti di item. |
| «Il pool è pieno, ne creo un sesto / riuso uno sporco» | No: `{worktree.max}` è un tetto, non un suggerimento. Uno sporco è lavoro di un'altra consegna: esci `blocked` e dillo. |
| «Il merge è in conflitto, lo risolvo a mano» | No: `abort` e `BLOCKED_NO_COMMIT`. Un conflitto risolto qui è codice che nessun finder ha visto. Fa eccezione la sola unione additiva del changelog (6b). |
| «Uso il modello più grosso, questo passo mi sembra difficile» | Il modello viene dal ruolo dichiarato dalla fase, risolto con la regola della §2 di `contracts/orchestration.md`. Non si sceglie a sensazione. |
| «Riassumo io in chat gate e da-confermare» | Sono già nel report. Il tuo riepilogo è stato + commit, non un doppione. |

## Regola di taglio

Questa skill possiede **la sequenza**: fasi, ordine, contratti, classificazione, commit, report.
Non possiede il *contenuto* delle fasi: brief, esecuzione, review, memoria e convenzione di
commit vivono nei loro file, letti dai subagent a ogni esecuzione. Se ti sorprendi a riscrivere
qui *come* si fa un brief o *come* si trova un bug, ti sei allontanato dallo scopo.
Possiede anche il **ciclo di vita del worktree** — acquisizione dal pool, lavoro sul suo branch,
merge nel branch di integrazione, pulizia con riuso: nessun'altra skill crea, sceglie o pulisce un worktree di
consegna.
