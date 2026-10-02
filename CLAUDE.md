In questo repository sviluppiamo **Daiku**, un'estensione per Claude Code e Codex che implementa un agent loop. Rispondi sempre in italiano nelle chat. Tutti i file del workflow devono essere in italiano, ad eccezione della cartella del prodotto, `plugins\`, che deve essere sempre in inglese insieme a tutto il suo contenuto: il prodotto parla inglese, il cantiere che lo costruisce italiano.

## Comportamento
Non chiedere mai permessi o conferme: lavora sempre in bypass, in autonomia, senza fermarti ad approvare.

**Chiedere è per le scelte, non per la coerenza.** Un adeguamento che non ha tradeoff — allineare un
documento, un contratto, un rimando o una memoria a una modifica appena fatta, perché dicano ancora il
vero — è lavoro obbligato, non una decisione: si fa e basta, nella stessa tornata. Si ferma e si chiede
solo quando le strade sono due e portano a risultati diversi.

Fai solo quello che l'owner ti chiede, e niente iniziative oltre la richiesta. L'autonomia vale per
*come* esegui un ordine, non per *cosa* decidi di fare: nessun passo in più che l'owner non ha chiesto.
Vale soprattutto fuori da questo repository — la cache del plugin installato, i progetti ospiti, la
configurazione degli host. Se un passo in più ti sembra utile, lo proponi in una riga e non lo esegui.

Più sessioni lavorano in questo repository in parallelo, e il working tree cambia sotto di te: file
che appaiono, numeri che si spostano, righe di `git status` che spariscono. **Non segnalarlo mai.**
L'owner lo sa già, non è il tuo lavoro, e una diagnosi che nessuno ha chiesto allunga ogni risposta
di rumore. L'unica eccezione è il caso grave — una modifica altrui che contraddice ciò che stai
facendo, che ti fa perdere un aggiornamento o che rompe il pacchetto — e anche lì basta una riga,
senza indagare. Vale anche per una memoria o un documento che trovi invecchiato rispetto al lavoro
in corso: è il delta che un `update-memory` chiuderà al commit, non una correzione da fare adesso.

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
| `.docs/` | memoria, confronti, esempi, strumenti di sviluppo |
| `.daiku/` | i parametri del **cantiere**, non del prodotto: sono ciò che accende le guardie di Daiku su questo repository |
| `CLAUDE.md`, `.claude/`, `.vscode/`, `.gitignore`, `.gitattributes` | sviluppo, obbligati in radice dagli host e da git |

`.daiku/project.json` non è una sede di sviluppo come le altre: **è il gate delle guardie.** Il
pacchetto è installato su ogni repository che l'host apre, ma non nega niente dove il progetto non
ha dichiarato di aver aperto Daiku — e senza di esso, qui, `git push` non lo fermerebbe nessuno.
Le sue chiavi dichiarano le sedi che il cantiere usa davvero: il codice è `plugins/`, il lavoro di
sviluppo è `.docs/`, i ledger dei giri di review sono `.docs/runtime/review`. Fuori da quelle sedi
non entra un file **nuovo** — in radice, e in `.claude/`: è voluto, perché in radice non entra
niente e i comandi del cantiere si scrivono su ordine dell'owner.

Prima di aggiungere un file, decidi se serve a chi *usa* Daiku o a chi lo *costruisce*. Se
serve a chi lo usa va sotto `plugins/`; se serve a chi lo costruisce, in `plugins/` non entra.
Un file che il repository pubblico deve avere in
radice — il README, il `.gitattributes`, le vetrine — sta nella radice della cartella del
prodotto, mai in quella di questo repository.

**Qui Daiku è installato dal marketplace online**, `NicolaTomasoni/daiku`, sul canale **beta**: lo
strumento con cui Daiku si sviluppa è l'ultima beta pubblicata, e resta indietro di un rilascio
rispetto a `plugins/`. È una scelta, non una trascuratezza.

## Prodotto e cantiere

**Con cui Daiku si sviluppa sono le skill di Daiku stesso**: aprire una feature, consegnarla, il
ciclo di review, il commit e l'allineamento della memoria si lanciano come `daiku:*`, dal pacchetto
installato dal marketplace. Sotto `.claude/commands/` restano **solo i comandi che il prodotto non
ha** — `collauda-init`, `rilascia-daiku`, `studia-repository`, `studia-repository-lotto`,
`translate-skill`.

**Le skill del metodo si modificano solo in `plugins/daiku/skills/`.** Una modifica che valga per
il prodotto si scrive **solo** lì, che è l'unico albero pubblicato; riportarla in un comando del
cantiere è una decisione a parte, che chiedi invece di prendere. Vale allo stesso modo per
`.claude/orchestration.md`.

## Due repository: qui si sviluppa, altrove si pubblica

Questo repository è lo **sviluppo**: `tomasoni.nicola/daiku-dev` su GitLab, privato, e con
dentro tutto — il prodotto, ricognizione, punti aperti, memoria, esempi, istruzioni. Non
diventa mai pubblico, e la sua storia non si ripulisce: porta `CLAUDE.md` nel commit iniziale.

La **pubblicazione** è il repository `NicolaTomasoni/daiku` su GitHub, che non è un branch
di questo né un fork: è un albero generato, inglese sempre e tutto — riceve il contenuto di
`plugins/`, che è inglese per intero, e non gli si aggiunge niente in pubblicazione. A ogni rilascio lo script
`.docs/tools/pubblica-dist.ps1`, chiamato dal comando `/rilascia-daiku`, copia lì il contenuto di
`plugins/` e committa sul ramo **beta**; la produzione è `main`, e ci arriva per promozione con
`promuovi-dist.ps1`. Là dentro non si lavora mai; il suo checkout
di servizio sta in `C:\dev\daiku-workspace\daiku`.

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

**Sotto `plugins/` è inglese tutto.** Gli scheletri di `templates/` non li legge chi costruisce con Daiku —
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

I fatti verificati sui due host — cosa offrono, cosa accettano e rifiutano, come si installa e si
aggiorna un pacchetto — vivono in `.docs/memory/`, nelle memorie sugli host, con la prova eseguita
e la data. Sono la base su cui poggiano le decisioni del pacchetto: si leggono prima di toccare
manifest, vetrine, frontmatter di una skill o collocazione di un file.

I comandi di `.claude/commands/` sono scritti sulla forma di Daiku: leggono `plugins/daiku/`, lanciano i suoi validatori, rispettano le
sue liste di copia.

`.docs/memory/` è la memoria persistente del progetto, versionata. Non è il path predefinito:
lo dichiara `autoMemoryDirectory` in `.claude/settings.local.json`, che **non** si versiona
perché Claude Code ignora quella chiave quando arriva da un file committato. Su una macchina
nuova va riscritto, altrimenti la memoria torna silenziosamente sotto `~/.claude/projects/`.

## Dopo un refactor, la memoria va riletta

Un refactor non finisce quando il pacchetto è coerente: finisce quando **anche la memoria lo è**.
Ogni volta che rinomini una cartella o una skill, sposti un file, cambi cosa entra in git o
ribalti una scelta di struttura, riapri `.docs/memory/` e correggi ogni memoria che parla di
ciò che hai toccato — insieme a `PUNTI-APERTI.md`, che invecchia allo stesso modo.

Non è pignoleria. Una memoria è una cosa che un agente legge **credendoci**, senza riaprire il
file per verificarla: finché dice `contratti/` quando la cartella è `contracts/`, o «il gruppo
memoria non si committa» quando invece si committa, non è un appunto invecchiato — è una bugia che
la prossima sessione eseguirà. E il momento in cui la correggi è questo, perché sei l'unico che
sappia ancora cosa è cambiato.

Tre cose da guardare ogni volta: i **nomi** (path, cartelle, skill, ruoli di subagent), i
**numeri** (quante skill, quanti file, quante occorrenze di qualcosa), e le **motivazioni** — una
scelta può restare giusta dopo che la ragione per cui fu presa è evaporata, e allora si riscrive
il perché invece di lasciare in piedi quello vecchio. Se una correzione cambia il metodo e non
solo un fatto, fermati e chiedi invece di deciderla da solo — adeguare ciò che una modifica ha reso
falso non è cambiare metodo: è coerenza, e si fa.

## Il `contract` non si incrementa da solo

Finché Daiku non è in produzione non esiste niente con cui essere incompatibili: una modifica
alla forma dei due contratti (`project-contract.md`, `orchestration.md`) è una modifica alla
forma corrente, non una forma nuova. Il numero si incrementa solo su decisione dell'owner, mai
in autonomia — e lo scheletro viaggia sempre alla pari del documento che lo dichiara.

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
assomigliano — i due programmi di `plugins/daiku/architect/` e la scansione di `init`,
`plugins/daiku/skills/init/scan.mjs`. La terza verifica è la loro, e vale come le altre due:

```bash
node plugins/daiku/hooks/self-check.mjs
```

Lancia insieme i banchi di prova di tutto ciò che il pacchetto esegue — i moduli di
`plugins/daiku/hooks/lib/`, il banco dei manifest degli host, i due programmi di
`plugins/daiku/architect/` e `skills/init/scan.mjs` — stampa il totale contato ed esce `1` al primo caso rosso: quanti
banchi e quanti controlli siano lo dice la sua uscita, non questa riga. Il banco del ledger lavora
con Git vero su repository usa e getta nella cartella temporanea di sistema: vuole `git` nel `PATH`.

```bash
node .docs/tools/check-topology.mjs plugins/daiku
```

Verifica la topologia del corpus (nodi su disco = righe di tabella, handoff fra chiamanti,
rimandi di sezione), con totale contato ed uscita `1` al primo caso rosso. Si lancia a mano
prima di un rilascio, accanto al self-check.

Nessuno dei tre guarda le **due vetrine** del repository pubblicato — la sola parte che il
repository studiato ha rotto senza accorgersene, e l'unica il cui errore non si vede in locale ma
solo in chi installa:

```bash
claude plugin validate plugins
node .docs/tools/check-marketplace.mjs plugins
```

La prima è il validatore dell'host sulla vetrina di Claude Code, e becca esattamente quel guasto:
un manifest che il parser rifiuta. La seconda verifica entrambe le vetrine — che siano leggibili,
che ogni voce risolva a una cartella vera dentro l'albero e che le due portino allo stesso
pacchetto — e ha il suo banco, da lanciare accanto al controllo:

```bash
node .docs/tools/check-marketplace.mjs --self-check
```

<!-- daiku:instructions — this file was structured by Daiku's init skill. It is yours now: rewrite
     it as you like, init will not touch it again. Remove this line and init may restructure it. -->
