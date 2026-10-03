# Orchestrazione dei comandi di Daiku — contratto unico

Questo file è il **punto unico di modifica** per come i comandi di `.claude/commands/` delegano
lavoro e quale ruolo gira su ogni passo. I comandi dicono *cosa* va fatto e *in che ordine*; qui
sta *chi* lo fa e *come* lo si lancia.

## Questo corpus non è il prodotto

In `.claude/commands/` stanno **solo i comandi che il prodotto non ha**: come si sviluppa Daiku e
come lo si pubblica non è una capacità che Daiku offra a un progetto, quindi non vive nel pacchetto.
Tutto il resto del metodo — aprire una feature, consegnarla, il ciclo di review, il commit,
l'allineamento della memoria — **sono le skill di Daiku stesso**, installate dal marketplace e
invocate come `daiku:*` (`new-feature`, `ship-feature`, `review`, `commit`, `update-memory`,
`research`, …). Un comando che ha il suo gemello là non vive anche qui.

Nessuno dei due alberi aggiorna l'altro: il prodotto si modifica solo sotto `plugins/daiku/`, che è
l'unico albero distribuito, e questo corpus non si allinea a lui per copia (`CLAUDE.md`, § *Prodotto
e cantiere*).

**Due differenze di forma rispetto al prodotto, decise per questo repo e non negoziabili qui:**

- **Niente parametri.** I contratti di questo corpus non leggono un file di parametri: ogni path,
  ogni comando e ogni modello sono **scritti per esteso** dentro il contratto che li usa. Una graffa
  in un contratto di questo corpus è un refuso.
- **Niente worktree.** Il prodotto consegna ogni feature su un worktree di un pool. Qui si lavora
  sul **branch corrente dell'albero principale**: è l'owner ad aprire un branch, se vuole isolare
  una consegna. **La regola non ha una motivazione scritta**, ed è dichiarato qui perché non la si
  scambi per una dimenticanza: a un worktree di questo repository non mancherebbe niente —
  conterrebbe anche `CLAUDE.md`, `.docs/` e questo corpus, che il repository traccia come il
  prodotto. La decisione è dell'owner.

## Le sedi di questo progetto

Ogni path è **relativo alla radice del repository** (`C:/dev/daiku-workspace/daiku-dev`), con separatori `/`.

| Sede | Cosa c'è |
|---|---|
| `plugins/daiku/` | **il prodotto** — l'unico perimetro di codice, e l'unico albero che viene pubblicato |
| `CLAUDE.md` | gli invarianti di chi sviluppa Daiku |
| `.claude/orchestration.md` | questo file |
| `.claude/commands/<nome>.md` | i contratti di sviluppo che il prodotto non ha; un subagent ne riceve il **path**, non il nome |
| `.daiku/` | i parametri del cantiere, e il gate delle guardie di Daiku su questo repository |
| `PUNTI-APERTI.md` | le decisioni ancora da prendere |
| `.docs/memory/` + `.docs/memory/MEMORY.md` | la memoria persistente e il suo indice |
| `.daiku/features/<slug>/` | la cartella di un lavoro, con i file numerati `0.`–`5.` |
| `.daiku/features/<corsa>/` | le feature proposte da una corsa di `studia-repository`, un file per feature ◦ |
| `.daiku/studies/<slug>.md` | gli appunti che `daiku:research` deposita ◦ |
| `.daiku/studies/<corsa>/` | la cartella di una corsa di `studia-repository`: `corsa.json`, `appunti/`, `sintesi.md` ◦ |
| `.docs/runtime/review/` | i ledger dei giri di `daiku:review`, uno per ciclo |
| `.docs/esempi/reforgia/` | dominio e politiche di ReforgIA, come esempio compilato |
| `.docs/tools/` | gli strumenti di chi sviluppa: `check-topology.mjs`, `check-corpus.mjs`, `studia-repository/` |
| `.docs/audit/` | i report del prompt audit, con il diff che propongono ◦ |

Le sedi marcate **◦ non esistono ancora**: le crea il contratto che le usa, al primo uso. Non sono
un'omissione da riparare a mano — una cartella vuota non dice niente a nessuno, e un registro vuoto
si legge come un registro di zero consegne invece che come un registro mai aperto.

**Questo repository versiona tutto**: prodotto, ricognizione, punti aperti, memoria, esempi e
istruzioni. Il `.gitignore` non filtra niente — esclude soltanto `.claude/settings.local.json`, che
non deve stare in nessun git — e il gruppo memoria/documentazione **si committa** come gli altri (§
*Il gruppo memoria/doc*).

Il confine di ciò che esce si è spostato altrove: sta nella lista di copia dello script di
pubblicazione, che copia i soli path ammessi in un **secondo** repository su GitHub. Nessun
contratto di questo corpus tocca quello script né quel repo.

## 1. Ruoli

Due soli ruoli, anonimi per costruzione. Una skill dichiara il ruolo di un passo, mai il modello.

| Ruolo | Quando si usa | Esempi di passo |
|---|---|---|
| **giudice** | il passo *decide* o *sintetizza*: produce lavoro nuovo a partire da input eterogenei, oppure riconcilia rilievi di più fonti dove sbagliare costa caro | decisione su un problema, sintesi di una corsa di studio, correzione di una skill |
| **worker** | il passo *esegue* o *ispeziona* un perimetro già delimitato: applica un piano, cerca rilievi in un diff, esegue comandi noti e ne riporta l'esito | esecuzione di un passo di studio, gate, inventario, comandi Git, report |

Un passo puramente meccanico (una riga di log, un `git add` di file già elencati, l'append a un
report) resta un **worker**: non merita un ruolo terzo.

## 2. Il modello di un ruolo

| Ruolo | Modello |
|---|---|
| **giudice** | `opus` |
| **worker** | `sonnet` |

È l'unica risoluzione ammessa, e avviene qui: la skill dichiara il ruolo e si ferma lì. Se
un giorno questo corpus dovesse girare su un host che non permette di scegliere il modello di un
subagent, il ruolo resta comunque dichiarato nel prompt, il passo gira sul modello di default, e
lo si dichiara nell'esito: la sequenza e i contratti non cambiano.

## 3. Come si lancia un subagent

Host: **Claude Code**. Si delega con il tool `Agent`, con `model` risolto secondo la §2 e
`subagent_type` scelto così:

- **`Explore`** per la sola ricerca.
- **`general-purpose`** per tutto il resto, cioè per i passi che devono scrivere.

Il ruolo a toolset ristretto — chi legge e riporta senza poter scrivere né delegare — **è del
prodotto** (`plugins/daiku/agents/finder.md`), e lo usa il ciclo di `daiku:review`: nessun comando
di questo corpus lo invoca.

Più subagent indipendenti si lanciano nello **stesso** blocco di tool call, altrimenti non girano
davvero in parallelo.

**Il confine vero è quale tool c'è, non cosa ci scrivi dentro.** L'harness di Claude Code impone
tre cose e solo quelle: il `deny` delle permission rule, gli hook, e la **lista** dei tool che un
agent dichiara. Non impone il **contenuto** di un comando Bash: uno specificatore come
`Bash(git diff:*)` descrive un'intenzione e non la restringe, e chi ha `Bash` ha `Bash` intero — può
eseguire `ls`, `cat`, `sed -i` e qualunque altra riga senza un diniego.

Ne segue una regola sola: **un vincolo che non sia l'assenza di un tool si ripete nel prompt del
subagent**, a partire dalla sola lettura di chi ha `Bash`.

## 4. Delega

Una skill orchestrante lancia ogni passo come **subagent in contesto fresco**, mai eseguendolo
inline nella conversazione: è ciò che tiene la catena lunga dentro un contesto sano e ciò che
rende un passo ripetibile.

1. **Prompt autosufficiente.** Il subagent parte da zero: nel prompt gli dai il **contratto da
   leggere** (il path del contratto — un comando sotto `.claude/commands/`, o una skill del
   prodotto sotto `plugins/daiku/skills/<nome>/SKILL.md` — mai il suo nome), l'input risolto
   (cartella, scope, base-ref) e il formato di ritorno. Non contare su nulla che sia solo nella
   tua conversazione.

   **Memoria pertinente.** A un passo che scrive, o che decide cosa scrivere, passi anche
   `.docs/memory/MEMORY.md` e i **path** delle memorie che il suo perimetro tocca — quelle che
   hai già in mano, scelte sull'indice — con l'istruzione di aprirle prima di lavorare. Non
   riassumerle nel prompt: un fatto riassunto diverge dal suo file al primo aggiornamento. Se
   nessuna memoria è pertinente, passi solo l'indice. È il canale per cui i fatti non deducibili
   dal repository raggiungono chi parte da zero.

   **Documenti di riferimento.** Per un lavoro che tocca la forma del pacchetto, i due host o la
   collocazione di un file, al prompt si aggiungono i path delle memorie che raccolgono i fatti sui
   due host — `.docs/memory/cosa-i-due-host-accettano.md`, `.docs/memory/cosa-codex-fa-allinstallazione.md`,
   `.docs/memory/installazione-e-versionamento.md`, `.docs/memory/come-si-provano-i-fatti-sugli-host.md` — e
   `PUNTI-APERTI.md` quando il lavoro rischia di decidere per conto proprio qualcosa che
   è già in quella lista. Un subagent che non li ha riscopre a sue spese prove già eseguite sui
   validatori reali, e nel caso peggiore chiude da solo una decisione che è dell'owner.

2. **Ritorno a contratto.** Ogni passo che alimenta una decisione a valle restituisce un blocco
   JSON con i campi che il **nodo** dichiara: si legge quello, non la prosa. Se il blocco manca o
   è incompleto, il passo è fallito — non interpretarlo a intuito.

   **E un passo fallito ha un tetto.** Si rilancia **una volta sola**, con lo stesso identico
   prompt; se non torna neanche allora, cosa ne segue lo dichiara la skill che lo ospita, e deve
   dichiararlo per iscritto. Senza quel tetto lo stesso silenzio produce comportamenti tutti
   difendibili e incomparabili fra esecuzioni — rilanciare a oltranza, saltare il passo, chiudere
   il ciclo — e nel resoconto le esecuzioni si leggono uguali. Un orchestratore che rilancia finché
   non ottiene la risposta che vuole non sta orchestrando.

   **Lo schema lo dichiara il nodo, una volta sola.** Il blocco di ritorno di un passo si scrive
   nel file del nodo che lo produce. Chi lo consuma lo **cita** — «il blocco che *quel file*
   dichiara, per intero» — e non lo ricopia; se ne legge di proposito solo un sottoinsieme,
   dichiara quali campi ignora e perché. Uno schema ricopiato dal chiamante si restringe
   attraversando l'arco: nasce identico, poi il nodo aggiunge un campo e il chiamante no, e quel
   campo semplicemente non arriva al decisore — che continua a decidere, con meno informazione di
   quanta ne esista, senza che niente segnali la perdita.

3. **Un passo, un subagent.** Non accorpare due fasi in un solo subagent per risparmiare un giro:
   la sequenza dichiarata dalla skill è il contratto.

4. **Se la delega non è disponibile**, esegui il passo in linea rispettando comunque ordine,
   perimetro e formato di ritorno, e **dichiaralo nell'esito**. Per i passi che si reggono
   sull'indipendenza dei figli — i passi di una corsa di `studia-repository` — *inline* è il secondo
   gradino, non il primo: si degrada prima a **subagent sequenziali**, dove la cecità reciproca
   resta intatta perché ogni contesto è comunque fresco. Solo se nemmeno quello è possibile si
   esegue in linea, e allora lo si dichiara nel blocco di ritorno (`"indipendenza": "persa"`):
   ordine, perimetro e formato sopravvivono alla degradazione, la cecità no — due passi valutati
   nello stesso contesto *sono* la singola passata già convinta di sé che il fan-out esiste per
   evitare.

**Chi può ri-delegare.** Un passo delegato **esegue**: non delega a sua volta. L'unico nodo
orchestrante di questo corpus è `studia-repository`, ed è **entry point**: lo lanci tu, e nessuno
lo invoca come figlio. Ogni altro passo delegato è una **foglia**. `rilascia-daiku` invoca due
skill **del prodotto** (`daiku:code-review` e `daiku:commit`), e la delega di quelle la dichiarano
i contratti del prodotto, non questo file.

Un nodo che si accorge di voler delegare, e non è fra questi, sta eseguendo il lavoro di qualcun
altro: torna a contratto e lascia decidere a chi l'ha chiamato.

## 5. La topologia: chi è collegato a cosa

Le regole della §4 dicono *come* si lancia un passo. Questa tabella dice *cosa è collegato a cosa*:
chi può invocare un nodo, con quale input già risolto, con quale ritorno atteso, e se quel nodo può
ri-delegare. **Si legge prima di delegare**, e ogni cella è un **rimando**, mai una copia: il
contenuto vive nel file del nodo, che resta l'unico posto in cui si modifica.

| Nodo | Chi lo invoca | Riceve già risolto | Restituisce | Ri-delega |
|---|---|---|---|---|
| `rilascia-daiku` | owner | le opzioni del rilascio | § *Esito* del suo file | sì — `daiku:code-review` e `daiku:commit`, skill del prodotto |
| `studia-repository` | owner | l'elenco dei target (`--lista`, `--sezione`, `--nome`, o i target sulla riga di comando) | la cartella `.daiku/studies/<corsa>/` con i suoi appunti e la sintesi, le feature in `.daiku/features/<corsa>/`, i target rientrati in fondo a *Inspirations* del README di prodotto e tolti dall'elenco, e § *Esito in chat* del suo file | sì — un appunto per target e la sintesi: i primi foglie, la seconda giudice, mai un terzo livello |
| `translate-skill` | owner | il path del file di Daiku da tradurre | il file riscritto in inglese | no |

**Un arco nuovo si dichiara qui.** Collegare un nodo a un chiamante che non lo aveva significa
aggiornare la sua riga — i chiamanti, l'input che ora riceve risolto, il permesso che
l'invocazione gli passa — nella stessa modifica che scrive l'arco. Una riga non aggiornata è un
arco che esiste nel testo dei prompt e non esiste da nessuna parte che si possa leggere.

## 6. Concorrenza

Il **fan-out parallelo** è il default: i passi indipendenti di una corsa di `studia-repository`
girano insieme, lanciati nello stesso blocco di tool call.

I passi che toccano la stessa working tree — gate, commit, `git add`, calcolo di un base-ref —
sono **sempre** sequenziali: non sono serializzabili altrimenti, e qui la working tree è una sola.

## 7. Il gate di questo progetto

È l'unico posto in cui il gate di questo repository è scritto, e lo esegue **chi sta per committare
una modifica alla forma del pacchetto** — sempre `rilascia-daiku`, a ogni rilascio, e a mano prima
di una consegna che tocca manifest, contratti o hook. Il ciclo di `daiku:review` ha
il proprio gate, che è il valutatore deterministico del prodotto (`plugins/daiku/architect/`), e
non questo.

Si esegue dalla radice del repository, in quest'ordine, e si riporta l'esito **reale** di ciascun
comando:

```bash
claude plugin validate plugins/daiku
claude plugin validate plugins
python ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/daiku
node plugins/daiku/hooks/self-check.mjs
node .docs/tools/check-topology.mjs plugins/daiku
node .docs/tools/check-marketplace.mjs plugins
node .docs/tools/check-no-push.mjs --self-check
node .docs/tools/check-channel.mjs
```

Il corpus non è in questo elenco perché nessuno lo lancia a mano: lo impone il **gate dell'area
`daiku`** (`.daiku/project.json`), che la fase *Gate* di `daiku:review` esegue da sé su ogni consegna
che tocca `plugins/daiku/`, e un rosso blocca il commit.

**I due validatori vanno passati entrambi, sullo stesso albero, e la seconda riga non si salta**
(`CLAUDE.md`, § *Verificare il pacchetto*): non coprono le stesse cose — è quello di Codex a
rifiutare i campi di manifest non ammessi, ed è quello di Claude Code a segnalare le skill che si
caricherebbero con i metadati vuoti.

I banchi che `self-check.mjs` lancia sono a **totale contato**: ognuno esce con un JSON che porta
`checks`, `passed` e `failed`, e il comando somma i `checks` di tutti. **Si riporta il numero di `checks`, non solo il verde**: un
totale che cala mentre i controlli crescono è un banco che ha smesso di girare, e il verde da solo
non lo mostra.

E, **per ogni file nuovo che il diff introduce sotto `plugins/`**:

```bash
git check-ignore -v <path>
```

Un file nuovo che **non** è ignorato si pubblica al prossimo commit; uno che lo è non arriverà mai a
chi installa. Nessuno dei due è un errore in sé — è un fatto, e va riportato nell'esito del gate,
perché è l'unica cosa irreversibile di tutta la catena.

E, **per i file del diff sotto `plugins/daiku/` che arrivano al modello come testo** — ogni `.md`
(skill, contratti, README, `agents/`), gli scheletri di `templates/`, le stringhe che gli hook
restituiscono all'agente — il prompt audit della skill `claude-api`:

```text
/claude-api prompt-audit <quei file>
```

Gira in sola lettura: si chiede il report, non si applica il diff che propone. Il modello di
riferimento è quello a cui risolvono gli alias `opus`/`sonnet` del pacchetto. Al subagent si passano,
insieme al comando, le quattro regole di questo progetto che l'audit da solo non conosce:

- un divieto che ha il suo gemello deterministico (hook, validatore, banco) o che protegge git, dati o
  sicurezza **è portante**: si può chiederne una forma più piana, mai la rimozione;
- **togliere vuol dire togliere** (`CLAUDE.md`): un testo che racconta cosa c'era prima, quando è
  stato tolto o come si chiamava — date, «no longer», «used to», «as before» — è un rilievo;
- i residui di ReforgIA non si segnalano;
- gli scheletri di `templates/` sono prompt di ogni progetto utente, e si leggono come tali.

**Conta solo ciò che il diff ha scritto.** Un rilievo ad alta confidenza su righe **aggiunte o
modificate** dal diff rende il gate **rosso**, con posizione, evidenza e riscrittura proposta nel
`gate_detail`: è testo nuovo che nasce già datato, e il ciclo non si riapre per correggerlo. I
rilievi a media e bassa confidenza sulle stesse righe entrano nel `gate_detail` senza cambiare il
colore. Quelli su righe che il diff non ha toccato non sono di questo diff: se ne riporta solo il
numero.

**Quali comandi girano.** I due validatori e la topologia girano **sempre**, perché
guardano l'albero intero. Il comando dei banchi gira **solo se il perimetro tocca
`plugins/daiku/hooks/` o `plugins/daiku/architect/`**. Il `check-ignore` gira **solo se il diff ha introdotto file nuovi**.
Il prompt audit gira **solo se il diff tocca testo per il modello sotto `plugins/daiku/`**.

### Cosa questo gate non copre

Si dichiara qui perché un controllo assente e un controllo passato si leggono uguali in un esito, e
questa è l'unica riga che li distingue.

**La prosa dei contratti la legge la topologia, per le tre proprietà meccaniche.** Il
verificatore `.docs/tools/check-topology.mjs` — Node senza dipendenze, radice passata per
argomento — controlla che i nodi su disco siano tutti e soli le righe della tabella di §3 di
`contracts/orchestration.md`, che ogni contratto passato a un subagent compaia fra i chiamanti
della propria riga, e che ogni rimando `§ *X*` trovi davvero la sua intestazione. Vive fuori dal
pacchetto, in `.docs/tools/`, e gira nel gate come i validatori. Ciò che non copre — un rimando
che esiste ma è attribuito al file sbagliato, uno schema di ritorno divergente fra nodo e
chiamante — lo prende il finder del ciclo di `daiku:review`, ed è il motivo per cui la prima delle
sue cinque famiglie è «rimandi che non risolvono».

**Il validatore Codex, su questa macchina, potrebbe non partire.** Se esce
`ModuleNotFoundError: No module named 'yaml'`, manca `pyyaml` (`python -m pip install pyyaml`):
il gate è **rosso**, ed è il motivo giusto perché lo sia — `CLAUDE.md` dichiara quella validazione
obbligatoria, e un gate che la salta per comodità certificherebbe un pacchetto che nessuno ha
validato per Codex. Non è però un difetto del diff, e chi legge l'esito deve poterlo distinguere:
si risolve con un'installazione, non con una consegna.

## 8. Il gruppo memoria/doc

Nel prodotto, gli artefatti non-codice — memoria, istruzioni, documento tecnico — vanno in un
commit distinto dopo quello di feature. **Qui vale lo stesso**: `CLAUDE.md`, tutto `.docs/` e la
memoria sono versionati come il prodotto, quindi c'è un indice in cui metterli e una storia da cui
recuperarli.

**I gruppi sono tre, e ognuno ha la sua sede**: codice (`plugins/`), memoria e documentazione
(`CLAUDE.md`, `.docs/**`), versione (i due `plugin.json`). Li committa `daiku:commit`, che li
risolve sulle chiavi di `.daiku/project.json` — qui `commit.memory_prefix` è `docs(memoria)`.

> **Il confine di git è questo, e non un altro.** Un contratto di questo corpus che dica che il suo
> perimetro è fuori dall'indice, o che il gruppo memoria/documentazione non si committa, è un difetto
> da correggere — non una deroga da applicare.

Il giorno in cui il repository diventa pubblico, questa sezione è una delle cose da rileggere
(`.docs/memory/pubblicazione-su-github.md`).

## 9. Divieti

- Nessuna skill nomina un modello: nomina un **ruolo**, e il modello lo risolve la §2. Il ruolo è
  l'unica cosa che una skill ha il diritto di scrivere.
- Nessuna skill duplica questo contratto, nemmeno «per comodità».
- Nessuna skill introduce un terzo ruolo o un profilo di modello proprio.
- Nessuna skill esegue `git push`, in nessuna fase e sotto nessuna autorizzazione. Il repository è
  privato fino al rilascio, e nessun contratto di questo corpus ha motivo di toccare un remoto.
- Il tool `Workflow` non è il motore di nessuna skill: l'orchestrazione è dell'agente, che delega a
  subagent secondo questo file. Non invocarlo.
- Nessuna skill di questo corpus scrive dentro `plugins/daiku/skills/` o
  `plugins/daiku/contracts/` **per allinearli a sé stessa**. Il prodotto si modifica perché lo
  decide una consegna, non perché una copia si è mossa.
- I contratti di questo corpus non si allineano da sé al prodotto: una modifica che varrebbe per
  entrambi si scrive solo nel prodotto, e toccare il cantiere è una decisione dell'owner.
