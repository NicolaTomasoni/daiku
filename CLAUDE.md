In questo repository sviluppiamo **Daiku**, un'estensione per Claude Code e Codex che implementa un agent loop. Rispondi sempre in italiano nelle chat. Tutti i file del workflow devono essere in italiano, ad eccezione della cartella del prodotto, `plugins\daiku`, che deve essere sempre in inglese insieme a tutto il suo contenuto: il prodotto parla inglese, il cantiere che lo costruisce italiano.

## Comportamento
Non chiedere mai permessi o conferme: lavora sempre in bypass, in autonomia, senza fermarti ad approvare.

## Questo file non fa parte dei prodotti

`CLAUDE.md` è come si **sviluppa** Daiku, non è Daiku. Lo stesso vale per
`.claude/`, `.vscode/` e tutto ciò che sta sotto `.docs/`. Restano in radice perché gli host
li cercano lì, non perché appartengano a un prodotto.

**In radice non entra nessun file di prodotto.** Ci stanno solo le sedi di sviluppo e una
cartella, che è **per intero** la radice del repository pubblico del prodotto: si copia tutta e sola, così com'è.

| Sede | Cos'è |
|---|---|
| `plugins/` | **Daiku** — la radice del suo repository pubblico, che è un marketplace |
| `plugins/.claude-plugin/marketplace.json` | vetrina Claude Code, punta a `./daiku` |
| `plugins/.agents/plugins/marketplace.json` | vetrina Codex, stessa destinazione |
| `plugins/daiku/` | il pacchetto Daiku — ciò che gli host installano |
| `.docs/` | ricognizione, punti aperti, memoria, esempi, appunti, strumenti |
| `CLAUDE.md`, `.claude/`, `.vscode/`, `.gitignore`, `.gitattributes` | sviluppo, obbligati in radice dagli host e da git |

Prima di aggiungere un file, decidi se serve a chi *usa* Daiku o a chi lo *costruisce*. Se
serve a chi lo usa va sotto `plugins/`; se serve a chi lo costruisce, in `plugins/` non entra.
Un file che il repository pubblico deve avere in
radice — il README, il `.gitattributes`, le vetrine — sta nella radice della cartella del
prodotto, mai in quella di questo repository.

Il marketplace locale di Claude Code punta a `C:\dev\Daiku\plugins`, non alla radice: su una
macchina nuova si aggiunge con `claude plugin marketplace add <repo>/plugins`.

## Prodotto e cantiere

**Le skill si modificano solo in `plugins/daiku/skills/`.** Quelle sotto `.claude/skills/` sono il
cantiere con cui Daiku si sviluppa: si leggono e si eseguono, non si toccano. Anche una modifica
che varrebbe per entrambi i corpus si scrive **solo** nel contratto del prodotto, che è l'unico
albero pubblicato; riportarla nel cantiere è una decisione a parte, che chiedi invece di prendere.
Vale allo stesso modo per `.claude/orchestration.md` e `.claude/agents/`.

## Due repository: qui si sviluppa, altrove si pubblica

Questo repository è lo **sviluppo**: `tomasoni.nicola/daiku-dev` su GitLab, privato, e con
dentro tutto — il prodotto, ricognizione, punti aperti, memoria, esempi, istruzioni. Non
diventa mai pubblico, e la sua storia non si ripulisce: porta `CLAUDE.md` nel commit iniziale.

La **pubblicazione** è il repository `NicolaTomasoni/daiku` su GitHub, che non è un branch
di questo né un fork: è un albero generato. A ogni rilascio lo script
`.docs/tools/pubblica-dist.ps1` copia lì il contenuto di `plugins/` e committa
(task VS Code «Daiku: pubblica dist»). Là dentro non si lavora mai; il suo checkout
di servizio sta in `C:\dev\daiku-dist`.

| Prodotto | Repository di pubblicazione | Cosa si copia |
|---|---|---|
| Daiku | `NicolaTomasoni/daiku`, privato finché Daiku non è pronto per il pubblico | il contenuto di `plugins/`, portato in radice |

Serve perché chi aggiunge il marketplace riceve un clone dell'**intero** repository, non
solo di `plugins/daiku/` — lo schema di Claude Code lo dice alla voce `sparsePaths`, «If omitted,
the full repository is cloned». Il repo *è* l'artefatto consegnato: non c'è un passo di
impacchettamento dove mettere il filtro, come farebbe il campo `files` di un `package.json`.

Il confine non sta nel `.gitignore`, che in radice esclude solo `.claude/settings.local.json`. Sta
nel perimetro della cartella di prodotto: lo script copia quella cartella e nient'altro, mai
«tutto il repository tranne». Un file nuovo nato fuori da `plugins/` resta
fuori dai pacchetti pubblicati; uno nato dentro, esce.

E il confine non guarda *dentro* i file: ciò che sta sotto `plugins/` viene
pubblicato com'è. Prima di un rilascio, controlla che non porti con sé valori di un progetto
ospite o path di questa macchina.

**In `plugins/daiku/templates/` si scrive in inglese.** Il resto del pacchetto è in italiano ed è
giusto così: lo legge chi costruisce con Daiku. Ma gli scheletri di `templates/` non li legge lui —
li copia la skill di apertura dentro il repository di un utente qualunque, e ci restano: segnaposto,
prosa dei README, il file di istruzioni del progetto, `description` e `statusMessage` di un
`hooks.json`. **Non ci sono eccezioni.** Le cartelle di lingua `domain/it/` e `policies/it/` sono
esistite e non esistono più: la lingua che l'utente sceglie vale per la chat e per i commit, non
per il corpus che Daiku deposita in un progetto. La sede di quella regola è la §5.6 di
`plugins/daiku/contracts/project-contract.md`.

## ReforgIA non è Daiku: ignorala, sempre

Daiku nasce estraendo il metodo da **ReforgIA**, il progetto su cui è stato costruito. Nel
pacchetto sopravvivono residui di quell'estrazione: path (`apps/backend/venv`, `docs/scripts/`,
`.dev-runtime/enabling-loop`), macchinari che qui non esistono (il ciclo di abilitazione), nomi
e valori di quel dominio.

Non segnalarli a meno che non ti venda chiesto. 

## Dove sta ogni cosa

`.docs/RICOGNIZIONE.md` è il documento di riferimento di Daiku: dice cosa offrono i due host,
cosa manca, cosa è stato buttato e perché ogni file sta dove sta — con le prove eseguite sui
validatori reali di Claude Code e Codex.

Le skill di `.claude/commands/` sono scritte sulla forma di Daiku: leggono `plugins/daiku/`, lanciano i suoi validatori, rispettano le
sue liste di copia.

`.docs/memory/` è la memoria persistente del progetto, versionata. Non è il path predefinito:
lo dichiara `autoMemoryDirectory` in `.claude/settings.local.json`, che **non** si versiona
perché Claude Code ignora quella chiave quando arriva da un file committato. Su una macchina
nuova va riscritto, altrimenti la memoria torna silenziosamente sotto `~/.claude/projects/`.

## Dopo un refactor, la memoria va riletta

Un refactor non finisce quando il pacchetto è coerente: finisce quando **anche la memoria lo è**.
Ogni volta che rinomini una cartella o una skill, sposti un file, cambi cosa entra in git o
ribalti una scelta di struttura, riapri `.docs/memory/` e correggi ogni memoria che parla di
ciò che hai toccato — insieme a `RICOGNIZIONE.md` e `PUNTI-APERTI.md`, che invecchiano allo stesso
modo.

Non è pignoleria. Una memoria è una cosa che un agente legge **credendoci**, senza riaprire il
file per verificarla: finché dice `contratti/` quando la cartella è `contracts/`, o «il gruppo
memoria non si committa» quando invece si committa, non è un appunto invecchiato — è una bugia che
la prossima sessione eseguirà. E il momento in cui la correggi è questo, perché sei l'unico che
sappia ancora cosa è cambiato.

Tre cose da guardare ogni volta: i **nomi** (path, cartelle, skill, ruoli di subagent), i
**numeri** (quante skill, quanti file, quante occorrenze di qualcosa), e le **motivazioni** — una
scelta può restare giusta dopo che la ragione per cui fu presa è evaporata, e allora si riscrive
il perché invece di lasciare in piedi quello vecchio. Se una correzione cambia il metodo e non
solo un fatto, fermati e chiedi invece di deciderla da solo.

## Togliere vuol dire togliere

Quando qualcosa esce da un file — una voce, una sezione, un rimando, un'intera riga — **esce e
basta**. Non si annota che c'era. Niente «questa voce è stata chiusa», niente «il resto sta nella
storia», niente buchi nella numerazione da spiegare, niente frase che dice dove è finito. Chi legge
quel file domani non deve sapere che prima c'era dell'altro: per lui quella cosa **non è mai
esistita**.

Vale in ogni sede: i contratti del prodotto, `.claude/`, i documenti di `.docs/`, la memoria, i
commenti nel codice. Vale anche per il *perché* di una scelta: se la ragione è caduta, si riscrive
la ragione o si toglie la frase — non si racconta che una volta la ragione era un'altra. E vale
anche quando il buco è scomodo: un identificatore che si sfasa, un rimando che punta altrove. Il
rimando si sistema, non si storicizza.

**La storia non è un compito del documento.** `git log` la porta per intero, e chi la vuole la va a
leggere lì. Un file che racconta cosa è stato tolto è più lungo, più vecchio e più fragile di uno
che dice solo cosa c'è — e ogni riga su qualcosa che non c'è più è una riga che il prossimo
refactor dovrà ricordarsi di aggiornare.

## Mai fidarsi di un LLM

Un'istruzione scritta in una skill non è un vincolo: un agente può ignorarla, fraintenderla o non
caricarla affatto. Perciò **dove possiamo aggiungere un controllo deterministico, lo aggiungiamo
sempre, by design**: ogni divieto che conta vive in due sedi — il testo della skill, che dice cosa
fare, e un controllo che lo impone — hook con banco di prova, validatore, script — e il banco si
lancia davvero (il comando sta scritto accanto al controllo, e gira prima di un rilascio). Un
controllo senza banco è indistinguibile dal silenzio. Se un divieto non ha una sede deterministica,
non esiste: o gli si costruisce, o si toglie il divieto.

## Verificare il pacchetto Daiku

Le due validazioni vanno passate entrambe, sullo stesso albero:

```bash
claude plugin validate plugins/daiku
python ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/daiku
```

La seconda richiede `pyyaml`. Non saltarla: i due validatori non coprono le stesse cose — è
quello di Codex a rifiutare i campi di manifest non ammessi, ed è quello di Claude Code a
segnalare le skill che si caricherebbero con i metadati vuoti.

Nessuno dei due però guarda dentro il codice eseguibile del pacchetto: gli hook, tutti
**fail-open** — davanti a un guasto tacciono ed escono `0`, quindi rotti e silenziosi si
assomigliano — e i due programmi di `plugins/daiku/architect/`. La terza verifica è la loro, e
vale come le altre due:

```bash
node plugins/daiku/hooks/self-check.mjs
```

Lancia insieme i sei banchi di prova — i quattro hook, il valutatore deterministico
(`architect/architect.mjs`) e lo strumento del ledger della review (`architect/ledger.mjs`) —
stampa il totale contato ed esce `1` al primo caso rosso. Il banco del ledger lavora con Git vero
su repository usa e getta nella cartella temporanea di sistema: vuole `git` nel `PATH`.

```bash
node .docs/tools/check-topology.mjs plugins/daiku
```

Verifica la topologia del corpus (nodi su disco = righe di tabella, handoff fra chiamanti,
rimandi di sezione), con totale contato ed uscita `1` al primo caso rosso. Si lancia a mano
prima di un rilascio, accanto al self-check.
