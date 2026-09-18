---
name: 'nightly-orchestrator'
description: 'Control plane della run notturna — legge la coda docs/nightly/nightly-run.json, fa il pre-flight sull''ambiente e consegna ogni item in sequenza eseguendo il contratto /deliver-feature (brief -> esecuzione -> review -> aggiornamento memoria/documentazione -> commit condizionale -> report). Non scrive codice applicativo: scandisce la notte.'
argument-hint: '[path a nightly-run.json, opzionale — default docs/nightly/nightly-run.json]'
---

Sei il **control plane** della run notturna: pre-flight sull'ambiente, poi un ciclo
**sequenziale** sugli item della coda. La consegna di ogni singola feature non è tua: è il
contratto di `/deliver-feature`, la stessa unità atomica che gira anche per una feature isolata
in chat. Tu decidi *l'ordine della notte*, non *come si consegna una feature*.

Non c'è utente presente: da qui in poi non si chiede più nulla. Tutto ciò che andava chiesto è
stato chiesto da `/nightly-plan`.

## Parametri di progetto

Leggi `.claude/project.json` prima di agire: è la sola fonte dei valori specifici di questo
progetto. Le chiavi citate in questo contratto fra graffe e apici inversi si risolvono da lì,
mai a memoria e mai per assunzione. Se una chiave citata non c'è, quella cosa **non esiste in
questo progetto**: salta la parte che la usa, dichiaralo nell'esito, non inventarla e non
chiederla. La forma del file è in `.claude/project-contract.md`.

## Parametri di ambiente

Leggi `.claude/environment.json` prima di agire: è la sola fonte dei valori di ambiente di questo
host e di questa macchina. Le chiavi citate in questo contratto fra graffe e apici inversi si
risolvono da lì, mai a memoria e mai per assunzione. Se una chiave citata non c'è, quella cosa
**non esiste in questo ambiente**: salta la parte che la usa, dichiaralo nell'esito, non
inventarla e non chiederla. La forma del file è in `.claude/project-contract.md`; le sue chiavi
sono nella §7 di `.claude/orchestration.md`.

## Input: la coda

Argomenti: `$ARGUMENTS` — il path a `nightly-run.json`, **opzionale**: nell'uso normale c'è una
sola coda attiva, quindi lancia `/nightly-orchestrator` senza argomenti e leggi
`docs/nightly/nightly-run.json`. Un path esplicito è solo un override per una coda altrove.

- Se il file non esiste, fermati e indica di generarlo prima con `/nightly-plan`.
- **Leggi il file per intero e parsalo come JSON.** Schema atteso (scritto da `/nightly-plan`):
  `run_id`, `created_at`, `backend`, `commit_policy`, `items[]` — ciascuno con `id`, `folder`,
  `decision_doc`, `selected_solution`. Non contiene stato di avanzamento.

## Prima di iniziare

Leggi `.claude/orchestration.md`: ruoli, host, delega, concorrenza. Il campo `backend` della
coda **non** sceglie modelli — quelli vengono dai ruoli dichiarati da ogni skill — ma dichiara
l'ambiente su cui la notte deve girare: serve al pre-flight e alla concorrenza del fan-out di
review (§5).

## La sequenza

### 1. Pre-flight — ruolo **worker**

Un subagent verifica che l'ambiente attivo coincida con il `backend` dichiarato dalla coda. Non
ha un contratto proprio da leggere, quindi nel prompt gli passi **già risolti** il `backend`
dichiarato dalla coda, l'host corrente, i valori delle chiavi che il confronto usa e il blocco da
restituire: un subagent in contesto fresco non sa quale coda stai girando né su quale host
(§4.1 di `.claude/orchestration.md`). Il confronto che deve fare è questo: legge
il file dichiarato da `{hosts.<host>.settings_file}` per l'host corrente, ne prende il blocco
`env` e lì la variabile `{hosts.<host>.base_url_env}`, e confronta quel valore con
`{backends.<backend>.base_url}` di ogni backend dichiarato in `{backends}`. L'ambiente attivo è
il backend il cui `base_url` coincide; se la variabile c'è ma il suo valore non è eguagliato da
**nessun** `base_url` dichiarato, l'esito è **discordante** (`match: false`) — un ambiente che
punta altrove è l'anomalia che questo passo esiste per fermare, non un ritorno al nativo.
Variabile assente, o blocco `env` assente, significa che l'host non è switchato e l'ambiente
attivo è `{hosts.<host>.native_backend}`. Un host che non dichiara
`{hosts.<host>.settings_file}` non tiene quella configurazione in un file: lì il backend non si
switcha, l'ambiente attivo è il suo `{hosts.<host>.native_backend}` e non c'è niente da
confrontare. In `detail` riporta il valore letto così com'è — anche quando non corrisponde a
nessun `base_url` dichiarato — o la sua assenza; in quel caso `detected_backend` è `null`,
perché quel campo porta il nome di un backend e lì non ce n'è uno da nominare.

```json
{"match": true, "detected_backend": "<rilevato>", "detail": "<...>"}
```

Se `match` è `false`, **aborta la run**: nessun item lavorato, dillo in chat con dichiarato e
rilevato. Una notte intera sul backend sbagliato è il costo che questo passo evita.

### 2. Consegna degli item — ruolo **giudice**, uno alla volta

Per ogni item della coda, **nell'ordine**, un subagent che esegue il contratto di consegna: è a
sua volta un orchestratore, e i ruoli delle singole fasi li dichiara `deliver-feature.md`. Nel
prompt:

- leggi per intero `.claude/commands/deliver-feature.md` e applicalo alla lettera, orchestrando
  tu le sue fasi come quel file le descrive;
- cartella `<folder>`, soluzione scelta `<selected_solution>` verbatim, id `<id>`, e il `run_id`
  della coda: è ciò che distingue questa consegna dell'item da una sua consegna di un'altra notte,
  e il report lo apre nel proprio titolo;
- il **backend dichiarato dalla coda**, per nome, quando non è quello nativo dell'host: è il
  terzo argomento che `deliver-feature.md` § *Input* prevede, e si passa **così com'è**, non
  tradotto qui in un'istruzione. Cosa ne segua — se quel backend sequenzializza il fan-out dei
  finder — lo decide `{backends.<backend>.sequential_fanout}` a chi quel fan-out lo fa davvero
  (§5 di `.claude/orchestration.md`), e quello è due archi più in là: un'istruzione scritta qui si
  ferma alla consegna, il nome no;
- non chiedere nulla all'utente: non c'è.

L'esito atteso è il blocco che `/deliver-feature` dichiara nella propria § *Esito*, per intero e con
quei nomi di campo: leggilo da lì, non ridichiararlo qui. Se il blocco manca o è incompleto, l'item
è fallito — non ricostruirlo interpretando la prosa.

Gli item girano in **parallelo limitato dal pool**: ognuno acquisisce un worktree proprio
(`deliver-feature.md` § *Pool dei worktree* e fase 0) e lì esegue l'intera sequenza fino al
commit sul proprio branch — diff, gate e commit su checkout disgiunti non si pestano i piedi.
Il tetto è `{worktree.max}`: mai più item in volo di quanti worktree liberi, mai un sesto
worktree; un item che non trova un worktree libero esce `blocked` con quel motivo e la coda
prosegue. Il merge verso main resta in corsa fra gli item in volo: è un passo breve sul lock di
Git con retry (`deliver-feature.md` fase 6b), non un coordinamento tuo. L'ordine di append dei
report segue la fine degli item, non la coda.

Un item bloccato non ferma la coda: registri l'esito e passi al successivo.

**La pulizia degli alberi la garantiscono le fasi, non tu.** Ogni item acquisisce un worktree
libero — libero significa pulito e risincronizzato (`deliver-feature.md` fase 0) — e il merge
ricontrolla i tre gruppi di commit sull'albero principale prima di scrivere
(`deliver-feature.md` fase 6b). Il perimetro resta **tutto ciò che un item scrive**, non solo il
codice: i tre gruppi che `.claude/commands/review/commit.md` § *Procedura* 3 enumera. Li leggi
da lì, non li riscrivi qui.

Se prima di lanciare un item trovi sporco **sui tre gruppi dell'albero principale** che nessun
item ha dichiarato, **fermati e non consegnare**: non è un residuo tuo da ripulire, è lavoro di
qualcuno che nessuno ha registrato. Dillo in chat e chiudi la notte lì. Lo sporco dichiarato da
un item — il suo worktree col branch — non ti riguarda: resta confinato lì e quel worktree esce
dal pool finché l'owner non lo tratta.

Il report per item lo scrive già la consegna, in append su `docs/nightly/nightly-review.md`. Tu
non lo riscrivi.

## Esito in chat

Poche righe: per ogni item, id e stato, lo SHA se committato. Il dettaglio — gate, da
confermare, decisioni rimaste — è già in `docs/nightly/nightly-review.md`: **non ripeterlo**,
rimanda al file.

## Ripresa dopo un'interruzione

Non esiste uno stato di avanzamento su file da aggiornare, e non serve: lo stato reale è
osservabile.

1. Rileggi la coda e `docs/nightly/nightly-review.md`: gli item che hanno già un blocco
   `## <run_id> · <id>` **con il `run_id` di questa coda** sono chiusi. `nightly-review.md` è
   append-only e sopravvive alle notti: un blocco con un altro `run_id`, o col solo `<id>` perché
   scritto prima di questa regola, è di una consegna precedente dello stesso item — e un item
   ri-accodato perché era uscito bloccato porta esattamente lo stesso `<id>`. Preso per chiuso,
   quell'item non viene lavorato e la notte lo dichiara fatto.
2. Per il primo item senza blocco, guarda la sua cartella: l'evidenza è lì, e ogni artefatto
   dichiara una fase conclusa. `2. blueprint.md` presente → il brief è fatto; `4. review-notes.md`
   presente → l'esecuzione è arrivata in fondo; `5. review-report.md` presente → **anche la review
   è chiusa**, e quel file porta il suo esito e il path del ledger; `3. memory-report.md` presente
   → **la memoria è già allineata**, e non si rifà: i suoi `files` sono l'ambito del commit 2, le
   sue voci `confirm_with_owner` vanno nel report.
3. Riprendi da quell'item, saltando le fasi la cui evidenza esiste già, e verifica con
   `git log --oneline` cosa è già stato committato. Non rifare lavoro già verificato e non
   ricommittare ciò che è già in `git log`.

   Una review interrotta **a metà** non ha lasciato il report ma ha lasciato il ledger: se ne trovi
   uno in `.dev-runtime/review/` il cui `base` è quello dell'item **e** il cui `item` è la cartella
   di quell'item, passane il path alla fase Review, che riprende dal giro successivo invece di
   ripagare tutto il triage. I due campi si guardano insieme, e non è pedanteria: qui i `base`
   coincidono per costruzione — un item esce bloccato senza commit e il successivo riparte dallo
   stesso commit — quindi la baseline da sola non dice di chi è il ledger. **Se i candidati restano
   più di uno, o se il ledger che hai trovato non porta `item`, non sceglierne uno**: non passare
   alcun path, e la review ripagherà il triage. Un triage è un costo; il ledger di un altro item
   spegne in silenzio i due segnali su cui il ciclo di review decide.

## Auto-inganni (fermali prima che ti fermino)

| Se ti stai dicendo… | La verità |
|---|---|
| «Lancio più item di quanti worktree liberi» | Il tetto è `{worktree.max}`: pieno è pieno, l'item in più esce `blocked`. Mai un sesto worktree. |
| «Il merge in corsa fra due item lo coordino io» | No: è un passo breve sul lock di Git con retry, dentro la consegna. Tu non ordini i merge. |
| «Riscrivo qui la sequenza brief→esecuzione→review» | È in `deliver-feature.md`. Duplicarla qui la disallinea alla prima modifica, e la coda va fuori sincrono. |
| «Il pre-flight non torna ma è probabilmente ok, parto lo stesso» | Aborta. È l'unico passo che ti protegge da una notte intera buttata. |
| «Un item si è bloccato, fermo tutto» | No: registri l'esito e passi al successivo. Il blocco di un item non è il blocco della coda. |
| «L'albero sotto `{code_root}` è pulito, posso consegnare» | Un item scrive tre gruppi, non uno: il controllo di pulizia copre tutti e tre, e vive nelle fasi (0 e 6b), non in una tua occhiata. |
| «Ho trovato un ledger di review con il `base` giusto, lo passo» | Nella notte i `base` coincidono per costruzione. Senza l'`item`, o con più candidati, quel ledger può essere di un'altra feature: non passarne nessuno e lascia ripagare il triage. |
| «Aggiorno `nightly-run.json` con lo stato» | È solo l'input statico. Lo stato lo leggi da `nightly-review.md`, dagli artefatti numerati di ogni item e da `git log`. |
| «Riassumo io in chat gate e da-confermare di ogni item» | Sono già nel report scritto dalla consegna. Il tuo riepilogo è stato + commit per item. |

## Regola di taglio

Questa skill fa tre cose: pre-flight, ciclo sequenziale sulla coda, riepilogo. Se devi cambiare
**come si scandisce la notte** (ordine, pre-flight, ripresa), tocchi questo file; se devi
cambiare **come si consegna una feature** (fasi, contratti, gate, commit), tocchi
`deliver-feature.md`; se devi cambiare **quali modelli girano**, tocchi
`.claude/orchestration.md`.
