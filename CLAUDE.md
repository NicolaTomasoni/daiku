In questo repository sviluppiamo due prodotti: **Daiku**, un'estensione per Claude Code e Codex che implementa un agent loop, e **Kaji**, un'estensione VS Code che mostra quale agente, provider e modello stanno lavorando davvero e cambia ciò che il runtime permette di cambiare. Rispondi sempre in italiano nelle chat. Tutti i file del workflow devono essere in italiano, ad eccezione della cartella `plugins\daiku` che deve essere sempre in inglese insieme a tutto il suo contenuto.

## Comportamento
Non chiedere mai permessi o conferme: lavora sempre in bypass, in autonomia, senza fermarti ad approvare.

## Questo file non fa parte dei prodotti

`CLAUDE.md` è come si **sviluppano** Daiku e Kaji, non è nessuno dei due. Lo stesso vale per
`.claude/`, `.vscode/` e tutto ciò che sta sotto `sviluppo/`. Restano in radice perché gli host
li cercano lì, non perché appartengano a un prodotto.

**I prodotti sono `plugins/daiku/` ed `extensions/kaji/`, e nient'altro.** Sono gli unici due
alberi che vengono distribuiti e installati; i due `marketplace.json` in radice sono la vetrina che
indirizza Daiku.

| Sede | Cos'è |
|---|---|
| `plugins/daiku/` | **il prodotto Daiku** — l'unica cosa che l'utente di Daiku riceve |
| `.claude-plugin/marketplace.json` | vetrina Claude Code, punta a `./plugins/daiku` |
| `.agents/plugins/marketplace.json` | vetrina Codex, stessa destinazione |
| `extensions/kaji/` | **il prodotto Kaji** — la radice del suo repository pubblico: `package.json`, `src/`, `test/` |
| `sviluppo/` | ricognizione, punti aperti, memoria, esempi — di entrambi |
| `sviluppo/kaji/` | i documenti di progetto di Kaji: prodotto, tech stack, branding |
| `CLAUDE.md`, `.claude/`, `.vscode/` | sviluppo, obbligati in radice dagli host |

Prima di aggiungere un file, decidi a quale metà appartiene, e se è prodotto a quale dei due. Se
serve a chi *usa* Daiku va sotto `plugins/daiku/`, se serve a chi usa Kaji sotto
`extensions/kaji/`; se serve a chi li *costruisce*, in nessuno dei due.

## Due prodotti autonomi, sviluppati insieme

Daiku e Kaji si sviluppano nello stesso repository perché si parlano: Kaji mostra gli agenti che
Daiku orchestra, e Daiku dichiara i modelli per alias di livello che uno switcher come Kaji
rimappa sul backend reale. Ma sono **prodotti autonomi**: ciascuno si installa, funziona e si
pubblica senza l'altro.

Ne segue una regola sola, che non ha eccezioni: **nessuno dei due alberi legge, importa o copia
un file dell'altro.** Quello che devono condividere — un formato di eventi, un nome di file, una
variabile d'ambiente — è un contratto versionato che ciascuno porta dentro di sé e che l'altro
rispetta; se manca, il prodotto che lo cerca degrada in silenzio, non si rompe. Una funzione di
Kaji che richiede Daiku installato è un difetto, e lo stesso vale all'inverso.

**Le skill si modificano solo in `plugins/daiku/skills/`.** Quelle sotto `.claude/skills/` sono il
cantiere con cui Daiku si sviluppa: si leggono e si eseguono, non si toccano. Anche una modifica
che varrebbe per entrambi i corpus si scrive **solo** nel contratto del prodotto, che è l'unico
albero pubblicato; riportarla nel cantiere è una decisione a parte, che chiedi invece di prendere.
Vale allo stesso modo per `.claude/orchestration.md` e `.claude/agents/`.

## Tre repository: qui si sviluppa, altrove si pubblica

Questo repository è lo **sviluppo**: `NicolaTomasoni/daiku-kaji-dev` su GitHub, privato, e con
dentro tutto — i due prodotti, ricognizione, punti aperti, memoria, esempi, istruzioni. Non
diventa mai pubblico, e la sua storia non si ripulisce: porta `CLAUDE.md` nel commit iniziale.

La **pubblicazione** sono due repository pubblici su GitHub, uno per prodotto, che non sono branch
di questo né fork: sono alberi generati. A ogni rilascio uno script per prodotto copia lì i soli
path ammessi e committa. Là dentro non si lavora mai.

| Prodotto | Repository pubblico | Lista di copia |
|---|---|---|
| Daiku | un repository `daiku` | `plugins/`, `.claude-plugin/`, `.agents/`, `README.md`, `.gitattributes` |
| Kaji | un repository proprio, col nome definitivo del prodotto | il **contenuto** di `extensions/kaji/` portato in radice, più `.gitattributes` |

*(Né gli script né i due repository pubblici esistono ancora: al 25 settembre 2026 la
pubblicazione è decisa ma non attrezzata.)*

Per Daiku serve perché chi aggiunge il marketplace riceve un clone dell'**intero** repository, non
solo di `plugins/daiku/` — lo schema di Claude Code lo dice alla voce `sparsePaths`, «If omitted,
the full repository is cloned». Il repo *è* l'artefatto consegnato: non c'è un passo di
impacchettamento dove mettere il filtro, come farebbe il campo `files` di un `package.json`. Kaji
invece un passo di impacchettamento ce l'ha — il VSIX — ma il suo sorgente pubblico non può
essere questo repository, che resta privato e porta dentro l'altro prodotto.

Il confine non sta nel `.gitignore`, che in radice esclude solo `.claude/settings.local.json`. Sta
nelle liste di copia degli script, e va tenuto nella stessa forma a lista di ammissione:
«copia questi path», mai «copia tutto tranne». Un file nuovo nasce così fuori dai pacchetti
pubblicati, ed è il contrario di una dimenticanza che pubblica.

E il confine non guarda *dentro* i file: ciò che sta sotto `plugins/` ed `extensions/kaji/` viene
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

`sviluppo/RICOGNIZIONE.md` è il documento di riferimento di Daiku: dice cosa offrono i due host,
cosa manca, cosa è stato buttato e perché ogni file sta dove sta — con le prove eseguite sui
validatori reali di Claude Code e Codex.

`sviluppo/kaji/README.md` è il documento di prodotto di Kaji — feature, principi, fatti verificati
sui runtime, milestone — e `sviluppo/kaji/TECH-STACK.md` il suo come: architettura, confini dei
moduli, decisioni tecniche con il loro falsificatore. `sviluppo/kaji/BRANDING.md` ragiona sul nome
e sul posizionamento nel Marketplace.

Le skill di `.claude/commands/` sono in comune, ma oggi sono tutte scritte sulla forma di Daiku:
leggono `plugins/daiku/`, lanciano i suoi validatori, rispettano le sue liste di copia. Portarle
anche su Kaji è una decisione a parte (vedi `sviluppo/PUNTI-APERTI.md`).

`sviluppo/memory/` è la memoria persistente del progetto, versionata. Non è il path predefinito:
lo dichiara `autoMemoryDirectory` in `.claude/settings.local.json`, che **non** si versiona
perché Claude Code ignora quella chiave quando arriva da un file committato. Su una macchina
nuova va riscritto, altrimenti la memoria torna silenziosamente sotto `~/.claude/projects/`.

## Dopo un refactor, la memoria va riletta

Un refactor non finisce quando il pacchetto è coerente: finisce quando **anche la memoria lo è**.
Ogni volta che rinomini una cartella o una skill, sposti un file, cambi cosa entra in git o
ribalti una scelta di struttura, riapri `sviluppo/memory/` e correggi ogni memoria che parla di
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

Vale in ogni sede: i contratti del prodotto, `.claude/`, i documenti di `sviluppo/`, la memoria, i
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

Nessuno dei due però guarda dentro gli hook, che sono l'unica parte eseguibile del pacchetto e
sono tutti **fail-open**: davanti a un guasto tacciono ed escono `0`, quindi rotti e silenziosi
si assomigliano. La terza verifica è la loro, e vale come le altre due:

```bash
node plugins/daiku/hooks/self-check.mjs
```

Lancia insieme i banchi di prova dei quattro hook e quello del valutatore deterministico
(`plugins/daiku/architect/`), stampa il totale contato ed esce `1` al primo caso rosso.

```bash
node sviluppo/tools/check-topology.mjs plugins/daiku
```

Verifica la topologia del corpus (nodi su disco = righe di tabella, handoff fra chiamanti,
rimandi di sezione), con totale contato ed uscita `1` al primo caso rosso. Si lancia a mano
prima di un rilascio, accanto al self-check.

## Verificare il pacchetto Kaji

Kaji non ha ancora codice. Quando nasce, la sua verifica è quella che fissa
`sviluppo/kaji/TECH-STACK.md` (§41–§42), lanciata dalla radice del prodotto:

```bash
cd extensions/kaji && npm run check && npm run package
```
