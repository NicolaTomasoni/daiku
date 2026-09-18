---
name: 'deliver-feature'
description: 'Consegna un lavoro su plugins/daiku dal decision-doc già risolto fino al commit, in un''unica invocazione — brief, esecuzione, review a giri, decisione, allineamento degli artefatti di sviluppo, commit, report. Orchestrata da te, delegando ogni fase a un subagent.'
argument-hint: '[cartella] [soluzione scelta]'
---

Sei il **motore** della consegna di un singolo lavoro sul pacchetto: la sequenza — brief →
esecuzione → review a giri → decisione → allineamento degli artefatti di sviluppo → commit → report
— la orchestri **tu**, delegando ogni fase a un subagent secondo `.claude/orchestration.md`. Non
esiste uno script che lo faccia al posto tuo.

## Dove si lavora

**Sulla working tree principale, sul branch corrente.** Questo corpus non usa worktree
(`.claude/orchestration.md`, § *Questo corpus non è il prodotto*): `git` traccia soltanto
`plugins/`, quindi un worktree nascerebbe senza `CLAUDE.md`, senza `sviluppo/` e senza i contratti
che ogni subagent deve leggere.

Conseguenze da tenere presenti, perché sono il prezzo di questa scelta:

- **Non crei e non cambi branch.** Se vuoi isolare la consegna, il branch lo apre l'owner prima di
  lanciarti. Tu lavori dove ti trovi.
- **Se la consegna esce bloccata, la working tree resta sporca**, in chiaro, sul branch corrente.
  Non si parcheggia niente, non si crea nessuna patch: le modifiche restano dove sono, e i loro path
  si dichiarano nel report e nel riepilogo. È l'owner a decidere se pulirle o portarle avanti a
  mano.
- **Una consegna alla volta.** Non c'è un pool che isoli due lavori concorrenti.

## Quando usarla

Quando hai **un** lavoro con `1. decision-doc.md` già risolto e vuoi la consegna completa senza
invocare a mano `blueprint` → `execute` → `review` → `commit` in sequenza. Se vuoi restare sui passi
atomici, per fermarti tra uno stadio e l'altro, usa quelli direttamente: questa skill non li
sostituisce, li incatena.

## Input

Argomenti: `$ARGUMENTS` — `<cartella> <soluzione scelta>`.

- **`<cartella>`** — path della cartella, relativo alla radice del repository o assoluto.
  `sviluppo/nuovi-sviluppi/<slug>` è il caso comune. Verificala sul filesystem: deve esistere e
  contenere `1. decision-doc.md`. Se manca, fermati e dillo.
- **`<soluzione scelta>`** — la passi al brief verbatim. Se è ambigua rispetto al decision-doc
  (decisione o opzione inesistente), apri il documento, mostra le opzioni e chiedi — non indovinare.
  Se non ti vengono passate le scelte dell'owner, usa quelle consigliate nel documento senza
  chiedere conferma.
- Se `$ARGUMENTS` è vuoto o incompleto, **chiedi**. Non procedere a vuoto.

## Prima di iniziare

Leggi `.claude/orchestration.md`: ruoli, delega, concorrenza, il gate della §7 e la §8 che dice
perché qui non esiste un commit per memoria e documentazione. Ogni fase dichiara il proprio ruolo
(**giudice** o **worker**) e tu risolvi il modello con la regola della sua §2 — mai da qui.

## Avanzamento e rilievi

**Non si tiene un log di avanzamento su file.** Avanzamento e rilievi vanno **in chat**, man mano:
una riga quando una fase parte e quando torna, col ruolo che la esegue, e subito ciò che hai notato
e che non entra in nessun blocco — un subagent tornato malformato, una fase più lenta del previsto,
un'evidenza che non quadra.

Lo stato che serve a **riprendere** non è quello: sono gli artefatti che le fasi depositano
(`2. blueprint.md`, `3. memory-report.md`, `4. review-notes.md`, `5. review-report.md`) e `git log`.
Quelli sono verificabili, un log scritto a mano no — e la ripresa che si fida di una riga che
nessuno garantisce sia stata scritta riparte dalla fase sbagliata.

## La sequenza

Le fasi sono ordinate e non saltabili. Ognuna è **un** subagent, con il prompt che gli dà il
contratto da leggere (il **path**, mai il nome), l'input risolto e il blocco JSON da restituire.

Ogni blocco porta il campo che dichiara l'esito della propria fase: `ok` per Brief, Execute e
Report, `gate` per Review, `staged` per lo Stage, `updated` per la Memoria, `committed` per il
Commit. **Se quel campo dice fallimento, o se il blocco non torna affatto, la consegna si ferma lì**
(vedi *Blocco anticipato*) — un blocco assente non si interpreta a intuito e non si ricostruisce
dalla prosa del subagent.

**Cosa dice fallimento, campo per campo**, perché non tutti quei campi ne dichiarano uno:
`ok: false` per Brief, Execute e Report; `staged: false` per lo Stage, che salta 5b e 6 e va al
report; `committed: false` per il Commit; e in ogni fase il **blocco assente**. Per la **Review** il
fallimento è **solo** il blocco assente, non `gate`: un `gate: "rosso"` è una misura riuscita, e la
tabella della fase 4 la classifica `BLOCCATO`. `updated: false` **non è mai un fallimento**:
`update-memory` lo dichiara l'esito atteso quando il diff non giustifica alcuna scrittura.

Le fasi che hanno un contratto proprio dichiarano il blocco **in casa loro**, e qui si cita: ogni
riscrittura locale si restringe alla prima modifica del nodo (§4.2 di `.claude/orchestration.md`).

### 1. Brief — ruolo **giudice**

Subagent che produce il brief. Nel prompt:

- leggi per intero `.claude/skills/blueprint/SKILL.md` e segui quel contratto alla lettera;
- cartella `<cartella>` (contiene `1. decision-doc.md`), soluzione scelta `<verbatim>`;
- `CLAUDE.md` e `sviluppo/RICOGNIZIONE.md`, da caricare prima di costruire il piano: gli invarianti
  di sviluppo e i fatti verificati sui due host sono ciò contro cui un task regge o non regge;
- `sviluppo/memory/MEMORY.md` e i path delle memorie che il perimetro tocca, da aprire prima di
  decidere (§4.1 di `.claude/orchestration.md`);
- se `<cartella>/2. blueprint.md` esiste già, **non** rieseguire il brief: restituisci `ok: true`
  col path esistente;
- non chiedere nulla all'owner: cartella, decision-doc e soluzione esistono già.

L'esito atteso è il blocco che `blueprint` dichiara nella propria § *Cosa restituisci*, per intero e
con quei nomi di campo. **Il campo `pubblica` guardalo subito**: elenca i file nuovi sotto
`plugins/` che il piano introduce, ed è l'unica cosa irreversibile che la catena ti dice in
anticipo. Riportalo in chat quando la fase torna, e portalo fino al report.

### 2. Execute — ruolo **worker**

Subagent esecutore. Nel prompt:

- leggi per intero `.claude/skills/execute/SKILL.md` e segui quel contratto alla lettera (autonomia
  reale, verifica osservabile, aggiorna il file mentre lavori, verifica di chiusura obbligatoria —
  **senza** lanciare il gate di pacchetto, che è della fase 3 — deposita `4. review-notes.md` col
  base-ref reale);
- applicalo alla cartella `<cartella>`; carica `CLAUDE.md`;
- il perimetro di scrittura è `plugins/daiku/`, più i soli file che il brief elenca uno per uno;
- `sviluppo/memory/MEMORY.md` e i path delle memorie pertinenti, da aprire prima di scrivere;
- non chiedere nulla all'owner; fermati solo davanti a un blocco reale (azione distruttiva non
  giustificata o contraddizione insanabile).

L'esito atteso è il blocco che `execute` dichiara nella propria § *Cosa restituisci*, per intero e
con quei nomi di campo.

### 3. Review — sempre, dentro la consegna

La review **fa parte della consegna**: non è un passo opzionale, non si rimanda all'owner, e non si
salta — è l'unico punto della catena che esegue il gate (`.claude/orchestration.md` §7), quindi
senza di lei nessuno ha provato che il pacchetto validi ancora. Senza di lei non esiste la decisione
della fase 4, quindi non esiste il commit.

**Delegala a un subagent** che esegue integralmente `.claude/skills/review/SKILL.md` sul file
`<cartella>/4. review-notes.md` (nome fisso per contratto di `execute`: non concatenare il path
restituito, il suo formato non è garantito). È la stessa disciplina che gira da `review`
standalone: una sola fonte, nessuna copia — **non riscriverla qui**.

Non orchestrarne tu le fasi. La resa del suo giro 1 sta nell'indipendenza dei finder, e orchestrarla
da qui — dove hai in testa il brief, l'esecuzione e ciò che ti aspetti — è la passata già convinta
di sé che il fan-out esiste per evitare.

Se stai **riprendendo** un lavoro la cui review era già partita, passale il path del ledger che
trovi in `sviluppo/runtime/review/` con il `base` di questo lavoro **e** con `item` uguale a
`<cartella>`: riparte dal giro successivo invece di ripagare l'intero triage. I due campi si
guardano insieme, e **se i candidati restano più di uno, o se il ledger non porta `item`, non ne
passi nessuno**.

**`--no-commit` passaglielo sempre**, ed è obbligatorio: `review` chiude col commit per
impostazione propria, e il commit di questa consegna è la **fase 6**, dopo la decisione della fase 4
e l'allineamento della 5b. Senza quel flag la review committerebbe prima che tu abbia valutato le
sue voci aperte, la fase 6 troverebbe l'albero già pulito, e `update-memory` girerebbe due volte —
una da `commit` dentro la review, una come fase 5b — su un diff che nel frattempo è già entrato.

L'esito atteso è il blocco che `review` dichiara nella propria § *Esito*, **per intero e con quei
nomi di campo**: leggilo da lì, non ridichiararlo qui. Ti servono tutti — `uscita`,
`finder_mancati`, `indipendenza` e `file_nuovi_pubblicati` decidono quanto `gate` e `da_confermare`.

Se la review non trova alcun file sotto `plugins/daiku/` da revisionare, fermati: non c'è una
consegna da valutare.

### 4. Decision — la decidi **tu**, in chat, senza subagent

È una classificazione deterministica su dati già strutturati: non serve un secondo giudice che
ri-giudichi. L'applicatore della review ha già marcato ogni voce di `da_confermare` con
`bloccante`, perché aveva il rilievo in mano.

Descrivi ogni voce aperta come `<file>[:<riga>] <scenario>`, poi:

| Condizione | Esito |
|---|---|
| `gate` ≠ `verde` | `BLOCCATO` — blocker: `gate rosso: <gate_detail>` più tutte le voci bloccanti |
| `uscita` è `oscillazione` o `giri-esauriti` | `BLOCCATO` — blocker: il ciclo non è convergiuto, con l'uscita e i gravi dell'ultimo giro |
| `finder_mancati` diverso da zero al giro 1 | `BLOCCATO` — blocker: quella passata su questo diff non l'ha fatta nessuno |
| gate verde, almeno una voce `bloccante: true` | `BLOCCATO` — blocker: quelle voci |
| gate verde, nessuna bloccante, restano voci non bloccanti | `VERDE_CON_DECISIONI` |
| gate verde, nessuna voce aperta | `VERDE` |

Le condizioni di blocco si valutano **tutte**: un esito che ne soddisfa più di una le riporta tutte
come blocker, e la prima che si verifica non chiude la valutazione.

Le tre righe in cima sono le stesse con cui `review` si ferma da sola prima di committare, e
valgono qui per la stessa ragione: `giri-esauriti` è un'uscita per esaurimento, non per convergenza;
`oscillazione` significa due giri che si rimpallano la stessa riga; un finder mancato al giro 1 non
ha girato su questo diff e **non girerà mai più**. Senza queste righe lo stesso identico esito di
review bloccherebbe il commit lanciata a mano e lo lascerebbe passare dentro la consegna — mentre
questa skill dichiara di eseguire «la stessa disciplina».

`indipendenza: persa` **non** blocca: dice che il giro 1 è stato valutato in un contesto solo perché
la delega non era disponibile. Entra però nel report e nel riepilogo come limite dichiarato di
quella review: una consegna verde con il fan-out degradato non è la stessa cosa di una consegna
verde.

`file_nuovi_pubblicati` **non** blocca e non è un rilievo, ma si riporta **sempre**, in chat e nel
report, anche su `VERDE`: sono i file che da questo commit in poi escono a chiunque aggiunga il
marketplace, ed è l'unico effetto della consegna che non si annulla.

Le voci **non** bloccanti sono decisioni post-commit: non fermano il commit, restano nel report.
Sono **bivi veri** — due strade difendibili in cui la scelta cambia il risultato in modo materiale —
perché tutto il resto la review lo ha già risolto da sé. Non promuovere a decisione post-commit ciò
che non è un bivio: lavoro lasciato a metà, pulizia opzionale e cose fuori dal perimetro del brief
non entrano qui, e `VERDE` resta l'esito normale di una consegna sana. I bivi che restano non li
risolvi tu e non li rigiudichi: li riporti.

### Sblocco meccanico — quando il solo blocker è il gate rosso

Se la classificazione è `BLOCCATO` per la sola prima riga della tabella — cioè uscita convergiuta
(`punto-fisso`), nessun finder mancato, nessuna voce `bloccante: true` e `da_confermare` vuoto — non
fermarti: il ciclo ha già detto tutto ciò che sapeva dire, resta solo lavoro meccanico.

Delega **un** subagent worker che corregga solo i rilievi del gate sulle righe del diff con fix a
singola soluzione ovvia — un frontmatter da quotare, una chiave di manifest che un validatore
rifiuta, una versione da riallineare fra i due `plugin.json` — rilanci i comandi del gate che il
perimetro richiede (§7 di `.claude/orchestration.md`, che gli copi nel prompt) e restituisca
`gate`/`gate_detail`/`serve_scelta`. Vincoli: **nessun cambio di ciò che il pacchetto dice o fa**,
nessun file fuori dai segnalati, mai stage o commit, e se anche un solo fix ammette due strade
difendibili il subagent lo lascia stare e lo dichiara in `serve_scelta` invece di indovinare.

- Se torna `gate: verde` e `serve_scelta` vuoto: riclassifica con la tabella (l'esito tipico è
  `VERDE`) e prosegui dalle fasi 5 in poi; il report racconta lo sblocco in un paragrafo.
- Altrimenti: resta `BLOCCATO` con quei blocker, e vale il paragrafo qui sotto.

**Un caso che qui non si sblocca così.** Se il gate è rosso perché il validatore Codex non parte —
`ModuleNotFoundError: No module named 'yaml'` — non è un difetto del diff e nessun fix lo chiude:
manca `pyyaml` sulla macchina. Resta `BLOCCATO`, e il report lo dice con quelle parole, perché è un
blocco dell'ambiente e si risolve con un'installazione, non con una consegna.

Un solo tentativo per consegna: se il gate resta rosso non rilanciare il fix — la seconda passata è
lavoro che oscilla, e l'oscillazione si dichiara, non si ripete. Questa è l'unica strada che riapre
un `BLOCCATO` dentro la stessa consegna: voci bloccanti, bivi e finder mancati non si sbloccano mai
così.

Su `BLOCCATO` non si stagea, non si allinea niente e non si committa — e **la working tree resta
sporca di proposito**. Prima del report elenca lo sporco
(`git status --porcelain -- plugins/daiku/`) e dichiarane i path nel report e nel riepilogo.

### 5. Memory — solo se l'esito **non** è `BLOCCATO`

Due subagent in sequenza, **entrambi prima del commit**.

**5a. Stage — ruolo worker.** Lo stage è separato dal commit perché il passo 5b deve leggere il diff
**integrale** — file nuovi compresi, che `git diff` non mostra finché non sono in index. Nel prompt:
esegui solo questi comandi Git, in ordine, senza chiedere conferma —

```bash
git status --porcelain -- plugins/daiku/
git add <i file individuati, elencati singolarmente>
git status --porcelain -- plugins/daiku/
```

Mai `-A`, mai `.`. Ignora sempre qualunque file esterno a `plugins/`, anche se modificato. Mai
`git commit`, mai `git push` in questo passo.

```json
{"staged": true, "files": ["<path>"], "detail": "<se staged=false, perché>"}
```

Se `staged` è `false`, non c'è nulla da consegnare: salta 5b e 6, vai al report.

**5b. Allineamento degli artefatti di sviluppo — ruolo giudice.** Nel prompt:

- leggi per intero `.claude/skills/update-memory/SKILL.md` e segui quel contratto alla lettera;
- il diff da ispezionare è quello **in index** sotto `plugins/daiku/`
  (`git diff --cached --stat -- plugins/daiku/` e `git diff --cached -- plugins/daiku/`): è il diff
  integrale, lo stesso che il commit produrrà;
- la **cartella dell'item** è `<cartella>`: depositaci il tuo blocco di ritorno come
  `3. memory-report.md`, secondo il punto 7 della sua § *Procedura*. È la fase più vicina al limite
  di contesto — legge il diff integrale — ed è l'unica il cui esito, senza quel file, non
  sopravvive all'interruzione;
- il **vincolo di perimetro**: non toccare `plugins/`, non toccare l'indice di git, non eseguire
  alcun comando Git di scrittura.

**Non c'è nessun permesso di commit da concedere, e non c'è un commit a valle che raccolga il suo
lavoro.** In questo repository il suo perimetro è fuori da git per costruzione
(`.claude/orchestration.md` §8): scrive sul disco e basta, e il suo `committed` è `null`. Se torna
con uno SHA, ha committato qualcosa che non doveva nemmeno poter mettere in stage: verificalo con
`git log`, riportalo come anomalia in chat, e guarda **cosa** ha committato prima di proseguire.

L'esito atteso è il blocco che `update-memory` dichiara nella propria § *Procedura*, punto 7, per
intero. **Le voci di `confirm_with_owner` portale fino al report**: qui non esiste un commit dentro
cui potrebbero riemergere, quindi il report è l'unico posto dove sopravvivono.

### 6. Commit — ruolo **worker**

Un solo subagent, **due** commit al massimo e nell'ordine dichiarato, sul branch corrente. Nel
prompt: esegui solo comandi Git, in ordine, senza chiedere conferma.

**Commit 1 — il lavoro.** I file sotto `plugins/` sono **già** in index: non eseguire `git add`,
committi esattamente ciò che c'è. Messaggio conforme a `.claude/skills/commit/SKILL.md`,
§ *Convenzione* — tipo(scope): descrizione, corpo asciutto, italiano. **Mai** trailer di co-autoria
né menzioni all'agente che ha generato il lavoro. Poi `git log --oneline -1` per leggerne lo SHA.

**Commit 2 — la versione.** Solo se il diff ha toccato uno dei due `plugin.json` e solo se il primo
commit è riuscito. Ambito **esclusivo**: `plugins/daiku/.claude-plugin/plugin.json` e
`plugins/daiku/.codex-plugin/plugin.json`. Prima di committare, verifica che portino lo **stesso
numero**: due manifest con versioni diverse sono il difetto che nessuno vede finché un host aggiorna
e l'altro no. Se il gruppo è vuoto, questo commit **non esiste**.

**Non esiste un commit di memoria e documentazione.** Ciò che la fase 5b ha scritto è fuori da git
per costruzione: non tentare un `git add` su quei path, e non forzarlo con `-f`.

**Mai `git push`**, in nessuno dei due.

**Se la sequenza si ferma fra un gruppo e il successivo, dillo con i path.**

```json
{"committed": true, "commit_sha": "<sha>", "version_commit_sha": "<sha se esiste>", "detail": "<...>"}
```

### 7. Report — ruolo **worker**

Subagent che appende (creando il file se non esiste) a `sviluppo/consegne.md`, **in coda** — mai
sovrascrivere o riformattare ciò che c'è già.

È l'unica fase che deve riportare campi prodotti da **altre quattro**, e un subagent in contesto
fresco non ne ricava nessuno da solo. Nel prompt vanno quindi **già risolti**, uno per uno:
ricostruirli a memoria fa cadere per prime proprio le righe che dicono cosa la consegna **non** ha
fatto. Nel prompt:

- il path su cui appendere, `sviluppo/consegne.md`, e il vincolo dell'append in coda;
- `<cartella>` e la **soluzione consegnata**, verbatim: è lui a distillarla, non tu;
- dalla **fase 1**: il campo `pubblica` del brief;
- dalla **fase 3**: `gate` e `gate_detail`, `uscita`, `finder_mancati`, `indipendenza` e
  `file_nuovi_pubblicati`;
- dalla **fase 4**: lo `status` classificato e le voci `da_confermare` rimaste, col loro `scenario`;
- dalla **fase 5b**: `updated`, i `files` toccati **e il fatto che non siano committati**, e le voci
  `confirm_with_owner`;
- dalla **fase 6**: `committed` e i due SHA — `commit_sha`, `version_commit_sha` — più i path
  rimasti sporchi dichiarati dalla fase 4;
- la forma del blocco da scrivere e il blocco JSON da restituire, che sono quelli qui sotto.

Un solo blocco:

- titolo `## <data> · <cartella>`;
- sotto, **prosa continua in paragrafi** (mai elenchi puntati, mai sotto-titoli): 2-3 frasi su cosa
  è stato consegnato (distilla la soluzione al succo, non incollarla verbatim); un paragrafo
  sull'esito della review (gate e sua sintesi in una frase, più i limiti che la review ha dichiarato
  su sé stessa — finder mancati, indipendenza persa — se ce ne sono); un paragrafo con stato finale
  e commit, che **nomina i file nuovi che da adesso si pubblicano** se ce ne sono, e dice quali file
  di sviluppo sono stati toccati senza entrare in un commit; se restano voci aperte — blocker, bivi
  post-commit, fatti da confermare con l'owner — un ultimo paragrafo che le riassume raggruppate per
  tema e scritte **in modo semplice**: cosa è in gioco, quali sono le strade e cosa cambia
  scegliendo l'una o l'altra. Se non ne restano, ometti quel paragrafo.

Paragrafi separati da una riga vuota. Chiaro e sintetico: si deve capire lo stato in 30 secondi.

```json
{"ok": true, "report_path": "sviluppo/consegne.md", "detail": "<se ok=false, il motivo: file non scrivibile, append fallito>"}
```

È l'ultima fase e nessuno decide più niente sul suo esito, ma il blocco serve lo stesso: un report
che non è stato scritto è l'unica traccia della consegna che sparisce — e qui più che altrove,
perché `sviluppo/consegne.md` non è committato e non ha una storia da cui recuperarlo. Se `ok` è
`false`, riportalo in chat con il motivo.

## Blocco anticipato

Se Brief o Execute falliscono, la consegna si ferma: dillo in chat, fai scrivere al report un blocco
che dice cosa doveva essere consegnato, in quale fase si è fermata e perché, e chiudi con
`status: "interrotta"`. Niente stage, niente allineamento, niente commit.

**Anche qui il report è un subagent, e anche qui il prompt è l'unico canale.** Gli passi i soli campi
della fase 7 che a quel punto esistono — path del file e append in coda, `<cartella>` e soluzione,
**quale fase si è fermata** e il `detail` del suo blocco, `status: "interrotta"`, i path rimasti
sporchi sotto `plugins/daiku/` — e gli dici esplicitamente che gli altri **non esistono**: gate,
commit e allineamento non sono mai girati. Senza quella riga il report li racconta comunque, ed è il
modo in cui un lavoro mai partito si legge come un lavoro consegnato male.

**E anche qui la working tree resta sporca.** Se Execute ha scritto qualcosa sotto `plugins/daiku/`,
prima del report ne elenchi i path (`git status --porcelain -- plugins/daiku/`) e li dichiari nel
report e in `reason`.

## Esito

1. **In chat, poche righe**: stato finale (`VERDE` | `VERDE_CON_DECISIONI` | `BLOCCATO` |
   `interrotta`), SHA se committato, i file nuovi che da adesso si pubblicano, i file di sviluppo
   toccati e non committati. Il dettaglio — gate, voci da confermare, decisioni rimaste — è già in
   `sviluppo/consegne.md`: **non ripeterlo**, rimanda al file.

2. **Chiudi sempre con il blocco a contratto**, così chi ti ha invocato lo legge senza interpretare
   la prosa. Nessun campo si omette: a valore assente si scrive `null`.

   ```json
   {
     "item": "<la cartella>",
     "status": "VERDE|VERDE_CON_DECISIONI|BLOCCATO|interrotta",
     "commit_sha": "<sha o null>",
     "version_commit_sha": "<sha o null>",
     "file_nuovi_pubblicati": ["<path sotto plugins/ che questo commit rende pubblico>"],
     "sviluppo_aggiornato": false,
     "sviluppo_files": ["<path fuori da plugins/, scritti e non committati>"],
     "confirm_with_owner": ["<le voci della fase 5b, verbatim>"],
     "report_path": "sviluppo/consegne.md",
     "sporco": ["<path rimasti non committati sotto plugins/, se lo stato è BLOCCATO o interrotta>"],
     "reason": "<solo se BLOCCATO o interrotta: il motivo esatto>"
   }
   ```

   Ogni campo viene da una fase, e si riporta **verbatim** da lì — non si ricalcola a memoria:
   `status` dalla fase 4; `commit_sha` e `version_commit_sha` dalla fase 6;
   `file_nuovi_pubblicati` dalla fase 3; `sviluppo_aggiornato` e `sviluppo_files` dai campi
   `updated` e `files` della fase 5b (`false` e `[]` se la fase non è stata eseguita);
   `confirm_with_owner` dalla 5b; `reason` dal `detail` della fase che ha bloccato.

   `sviluppo_files` esiste perché quei path non compaiono in nessun `git log`: è l'unico posto in
   cui chi legge scopre che la memoria si è mossa.

## Auto-inganni (fermali prima che ti fermino)

| Se ti stai dicendo… | La verità |
|---|---|
| «Faccio io il brief o l'esecuzione qui in chat, è più veloce» | Ogni fase è un subagent in contesto fresco (§4 di `.claude/orchestration.md`). In chat ti porti dietro tutto il contesto delle fasi precedenti e la catena degenera. |
| «Riscrivo qui la disciplina di review, così è tutto in un posto» | No: la fonte è `review`. Copiarla qui la fa divergere alla prima modifica. |
| «Il gate è rosso ma il diff è chiaramente giusto, committo» | Gate rosso = `BLOCCATO`. La classificazione è deterministica, non un giudizio. |
| «Il validatore Codex non parte, lo considero verde» | È dichiarato obbligatorio da `CLAUDE.md`. Un gate che lo aggira certifica un pacchetto che nessuno ha validato per Codex: resta `BLOCCATO`, e il motivo è `pyyaml`, non il diff. |
| «Questa la lascio come decisione post-commit, così decide l'owner» | Le decisioni post-commit sono bivi veri, non ciò che nessuno ha voluto risolvere. Se una strada è chiaramente la giusta, si risolve dove il rilievo nasce. |
| «Committo prima e allineo dopo» | L'ordine è dichiarato: stage → allineamento → commit. Nessun lavoro si congela senza che ciò che lo spiega sia stato riallineato sullo **stesso** diff — e qui quell'allineamento non ha un commit che lo recuperi dopo. |
| «La memoria tanto non si committa, salto la fase 5b» | È il contrario: proprio perché non si committa, se non la scrivi adesso non la scrive nessuno mai. |
| «Aggiungo `-A` allo stage, è più comodo» | Mai: lo scope è `plugins/` e i file si elencano singolarmente. |
| «I file di sviluppo li aggiungo con `git add -f`, così sono al sicuro» | Quel `-f` **pubblica** lo sviluppo di Daiku insieme al prodotto. Il confine di git è deliberato (§8 di `.claude/orchestration.md`). |
| «Apro un branch per la consegna, è più pulito» | Il branch lo apre l'owner prima di lanciarti. Tu lavori dove ti trovi, e non cambi il contesto sotto i piedi a chi ti ha lanciato. |
| «Uso il modello più grosso, questo passo mi sembra difficile» | Il modello viene dal ruolo dichiarato dalla fase, risolto con la §2 di `.claude/orchestration.md`. Non si sceglie a sensazione. |
| «Riassumo io in chat gate e voci da confermare» | Sono già nel report. Il tuo riepilogo è stato + commit + cosa si pubblica, non un doppione. |
| «I file nuovi sotto `plugins/` li nomino solo se qualcuno chiede» | È l'unico effetto della consegna che non si annulla. Si nomina sempre, anche su `VERDE`. |

## Regola di taglio

Questa skill possiede **la sequenza**: fasi, ordine, contratti, classificazione, commit, report. Non
possiede il *contenuto* delle fasi: brief, esecuzione, review, allineamento e convenzione di commit
vivono nei loro file, letti dai subagent a ogni esecuzione. Non possiede il gate, che è dichiarato
una volta sola in `.claude/orchestration.md` §7. Se ti sorprendi a riscrivere qui *come* si fa un
brief o *come* si trova un difetto, ti sei allontanato dallo scopo.
