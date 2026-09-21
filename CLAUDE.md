In questo progetto sviluppiamo Daiku, un'estensione per Claude Code e Codex che implementa un
agent loop.

## Comportamento
Rispondi in italiano e in modo chiaro e semplice, non dare per scontato che l'utente conosca il progetto perché cambia spesso e va rispegato.

## Questo file non fa parte di Daiku

`CLAUDE.md` è come si **sviluppa** Daiku, non è Daiku. Lo stesso vale per `.claude/`, `.vscode/`
e tutto ciò che sta sotto `sviluppo/`. Restano in radice perché gli host li cercano lì, non
perché appartengano al prodotto.

**Il prodotto è `plugins/daiku/`, e nient'altro.** È l'unico albero che viene distribuito e
installato; i due `marketplace.json` in radice sono la vetrina che lo indirizza.

| Sede | Cos'è |
|---|---|
| `plugins/daiku/` | **il prodotto** — l'unica cosa che l'utente riceve |
| `.claude-plugin/marketplace.json` | vetrina Claude Code, punta a `./plugins/daiku` |
| `.agents/plugins/marketplace.json` | vetrina Codex, stessa destinazione |
| `sviluppo/` | ricognizione, punti aperti, memoria, esempi |
| `CLAUDE.md`, `.claude/`, `.vscode/` | sviluppo, obbligati in radice dagli host |

Prima di aggiungere un file, decidi a quale delle due metà appartiene. Se serve a chi *usa*
Daiku va sotto `plugins/daiku/`; se serve a chi lo *costruisce*, no.

**Le skill si modificano solo in `plugins/daiku/skills/`.** Quelle sotto `.claude/skills/` sono il
cantiere con cui Daiku si sviluppa: si leggono e si eseguono, non si toccano. Anche una modifica
che varrebbe per entrambi i corpus si scrive **solo** nel contratto del prodotto, che è l'unico
albero pubblicato; riportarla nel cantiere è una decisione a parte, che chiedi invece di prendere.
Vale allo stesso modo per `.claude/orchestration.md` e `.claude/agents/`.

## Due repository: qui si sviluppa, altrove si pubblica

Questo repository è lo **sviluppo**: privato, e con dentro tutto — prodotto, ricognizione, punti
aperti, memoria, esempi, istruzioni. Non diventa mai pubblico, e la sua storia non si ripulisce:
porta `CLAUDE.md` nel commit iniziale.

La **pubblicazione** è un secondo repository su GitHub, che non è un branch di questo né un fork:
è un albero generato. A ogni rilascio uno script copia lì i soli path ammessi — `plugins/`,
`.claude-plugin/`, `.agents/`, `README.md`, `.gitattributes` — e committa. Là dentro non si
lavora mai. *(Lo script
non esiste ancora, e nemmeno il repository su GitHub: al 18 settembre 2026 la pubblicazione è
decisa ma non ancora attrezzata.)*

Serve perché chi aggiunge il marketplace riceve un clone dell'**intero** repository, non solo di
`plugins/daiku/` — lo schema di Claude Code lo dice alla voce `sparsePaths`, «If omitted, the
full repository is cloned». Il repo *è* l'artefatto consegnato: non c'è un passo di
impacchettamento dove mettere il filtro, come farebbe il campo `files` di un `package.json`.

Il confine quindi non sta più nel `.gitignore`, che ora esclude solo `.claude/settings.local.json`.
Sta nella lista di copia dello script, e va tenuto nella stessa forma a lista di ammissione:
«copia questi path», mai «copia tutto tranne». Un file nuovo nasce così fuori dal pacchetto
pubblicato, ed è il contrario di una dimenticanza che pubblica.

E il confine non guarda *dentro* i file: ciò che sta sotto `plugins/` viene pubblicato com'è.
Prima di un rilascio, controlla che non porti con sé valori di un progetto ospite o path di
questa macchina.

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

`sviluppo/RICOGNIZIONE.md` è il documento di riferimento: dice cosa offrono i due host, cosa
manca, cosa è stato buttato e perché ogni file sta dove sta — con le prove eseguite sui
validatori reali di Claude Code e Codex.

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

## Mai fidarsi di un LLM

Un'istruzione scritta in una skill non è un vincolo: un agente può ignorarla, fraintenderla o non
caricarla affatto. Perciò **dove possiamo aggiungere un controllo deterministico, lo aggiungiamo
sempre, by design**: ogni divieto che conta vive in due sedi — il testo della skill, che dice cosa
fare, e un controllo che lo impone — hook con banco di prova, validatore, script — e il banco si
lancia davvero (il comando sta scritto accanto al controllo, e gira prima di un rilascio). Un
controllo senza banco è indistinguibile dal silenzio. Se un divieto non ha una sede deterministica,
non esiste: o gli si costruisce, o si toglie il divieto.

## Verificare il pacchetto

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

Lancia i banchi di prova dei tre hook, stampa il totale contato ed esce `1` al primo caso rosso.
