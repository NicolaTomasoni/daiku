In questo repository sviluppiamo **Daiku**, un'estensione per Claude Code e Codex che implementa un agent loop. Rispondi sempre in italiano nelle chat. Tutti i file del workflow devono essere in italiano, ad eccezione della cartella del prodotto, `plugins\`, che deve essere sempre in inglese insieme a tutto il suo contenuto: il prodotto parla inglese, il cantiere che lo costruisce italiano.

## Comportamento
Non chiedere mai permessi o conferme: lavora sempre in bypass, in autonomia, senza fermarti ad approvare.

**Chiedere è per le scelte, non per la coerenza.** Un adeguamento che non ha tradeoff — allineare un
documento, un contratto, un rimando o una memoria a una modifica appena fatta, perché dicano ancora il
vero — è lavoro obbligato, non una decisione: si fa e basta, nella stessa tornata. Si ferma e si chiede
solo quando le strade sono due e portano a risultati diversi.

**Un rimando morto si corregge, non si segnala.** Un riferimento che non risolve più — un path che non
esiste, un file rinominato o spostato, una sezione che non c'è più — si sistema sul posto, nella stessa
tornata, e nel resoconto si dice che è stato sistemato. Non è un'iniziativa oltre la richiesta: è lo
stesso lavoro obbligato di cui sopra, perché un rimando rotto non è un appunto invecchiato ma una bugia
che il prossimo agente eseguirà credendoci. Elencarlo fra le cose da fare senza averlo toccato è un
lavoro lasciato a metà travestito da rapporto. Se non si sa dove debba puntare adesso, si chiede la
destinazione — mai il permesso di sistemarlo.

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
in corso di **un'altra sessione**: è il delta che un `update-memory` chiuderà al commit, non una
correzione da fare adesso. Non vale per ciò che ha reso falso **una tua modifica**: quello si
corregge nella stessa tornata, come dice *La memoria si aggiorna nella stessa tornata*.

## Questo file non fa parte dei prodotti

`CLAUDE.md` è come si **sviluppa** Daiku, non è Daiku. Lo stesso vale per
`.claude/`, `.vscode/` e tutto ciò che sta sotto `.docs/`. Restano in radice perché gli host
li cercano lì, non perché appartengano a un prodotto.

**In radice non entra nessun file di prodotto.** Ci stanno solo le sedi di sviluppo e una
cartella, il cui **contenuto** è per intero la radice di `main`: il rilascio lo porta lì così com'è,
e nient'altro esce.

| Sede | Cos'è |
|---|---|
| `plugins/` | **Daiku** — il cui contenuto è la radice di `main`, il ramo di produzione, che è un marketplace |
| `plugins/.claude-plugin/marketplace.json` | vetrina Claude Code, punta a `./daiku` |
| `plugins/.agents/plugins/marketplace.json` | vetrina Codex, stessa destinazione |
| `plugins/daiku/` | il pacchetto Daiku — ciò che gli host installano |
| `.docs/` | memoria, confronti, esempi, strumenti di sviluppo |
| `.daiku/` | i parametri del **cantiere**, non del prodotto: le guardie di Daiku su questo repository, e sotto di sé le sedi dei lavori — `features/`, `studies/` e `handoffs/` |
| `CLAUDE.md`, `.claude/`, `.vscode/`, `.gitignore`, `.gitattributes` | sviluppo, obbligati in radice dagli host e da git |

`.daiku/project.json` non è una sede di sviluppo come le altre: **è il gate delle guardie.** Il
pacchetto è installato su ogni repository che l'host apre, ma non nega niente dove il progetto non
ha dichiarato di aver aperto Daiku — e senza di esso, qui, `git push` non lo fermerebbe nessuno.
Le sue chiavi dichiarano le sedi che il cantiere usa davvero: il codice è `plugins/`, le sedi dei
lavori sono `.daiku/features`, `.daiku/studies` e `.daiku/handoffs`, la memoria è `.docs/memory` e i ledger dei giri
di review sono `.docs/runtime/review`. Fuori da quelle sedi
non entra un file **nuovo** — in radice, e in `.claude/`: è voluto, perché in radice non entra
niente e i comandi del cantiere si scrivono su ordine dell'owner.

Prima di aggiungere un file, decidi se serve a chi *usa* Daiku o a chi lo *costruisce*. Se
serve a chi lo usa va sotto `plugins/`; se serve a chi lo costruisce, in `plugins/` non entra.
Un file che il repository pubblico deve avere in
radice — il README, il `.gitattributes`, le vetrine — sta nella radice della cartella del
prodotto, mai in quella di questo repository.

**Qui Daiku è installato dal marketplace online**, `NicolaTomasoni/daiku`, sul ramo di produzione
`main`: lo strumento con cui Daiku si sviluppa è l'ultimo rilascio pubblicato, e resta indietro
rispetto a `plugins/`. È una scelta, non una trascuratezza.

## Prodotto e cantiere

**Con cui Daiku si sviluppa sono le skill di Daiku stesso**: aprire una feature, consegnarla, il
ciclo di review, il commit e l'allineamento della memoria si lanciano come `daiku:*`, dal pacchetto
installato dal marketplace — **quando è l'owner a chiederlo**. `new-feature` apre una feature **solo
su richiesta esplicita dell'owner**: un lavoro che a te sembra meritare la catena è una riga che lo
propone, mai un giro avviato al posto suo. Sotto `.claude/commands/` restano **solo i comandi che il prodotto non
ha** — `studia-repository`, `translate-skill`. Il rilascio non è fra loro: lo fa `release`, che è
una skill del pacchetto come le altre.

**Nessun commit fuori dal ciclo di review.** `commit` non si lancia da solo: il commit è l'ultimo
passo di `review` — o della fase Review di `ship-feature`, che è lo stesso ciclo — ed è il ciclo a
trovare quello che un controllo non vede. Che il pacchetto passi i suoi banchi dice che compila, non
che è giusto: fra i due c'è di mezzo il codice appena scritto, che nessun finder ha ancora letto. Un
commit diretto non accorcia la strada, la copre: mette in storia un diff che nessuno rileggerà. Vale
anche per un file solo, e vale coi banchi verdi. **La seconda sede del divieto è la guardia**: in
`plugins/daiku/hooks/lib/command-guard.mjs` il ramo `reviewGuard` nega `git commit` quando nella
sede dei ledger non c'è nessun ciclo in volo né un ciclo appena uscito con un gate che il commit può
chiudere — verde, o rosso solo per una causa fuori dal diff (`gate_origin: "pre-existing"`) — il
testo dice cosa fare, il controllo lo impone.

**Le skill del metodo si modificano solo in `plugins/daiku/skills/`.** Una modifica che valga per
il prodotto si scrive **solo** lì, che è l'unico albero pubblicato; riportarla in un comando del
cantiere è una decisione a parte, che chiedi invece di prendere. Vale allo stesso modo per
`.claude/orchestration.md`.

## Un repository, due rami: `develop` e `main`

Il repository è **uno solo**: `NicolaTomasoni/daiku` su GitHub, privato finché Daiku non è pronto per
il pubblico. Il cantiere e il prodotto sono i suoi due rami, e la copia di lavoro è
`C:\dev\daiku`, che li tiene entrambi.

**`develop` è il cantiere.** Porta tutto — il prodotto sotto `plugins/`, la ricognizione, i punti
aperti, la memoria, gli esempi, queste istruzioni — ed è il ramo su cui si lavora. **Porta una
versione, ed è una beta**: i due manifest dichiarano la versione di `main` col patch alzato di uno
più un contatore — `1.1.4-b.1` — scritto dopo un punto, perché `b10` verrebbe prima di `b9`. Non è
un rilascio e nessun rilascio la legge: il numero di un rilascio si deriva da `main` e si scrive su
`main`, dove questa viene sovrascritta. Serve perché il pacchetto si installa anche dall'albero di
sviluppo, e perché è quella dichiarazione a far muovere la copia installata; sale quando sale la
**forma** del pacchetto, cioè quando `init` avrebbe qualcosa da riportare nei progetti ospiti.
`plugins/CHANGELOG.md` qui non esiste.

**`main` è la produzione, ed è una linea di rilasci.** Ogni rilascio è un commit che porta il
contenuto di `plugins/` alla radice del repository — le due vetrine, `daiku/`, il README, il
`.gitattributes` — con la versione nei tre punti e la voce di changelog costruita dai messaggi del
blocco. `main` **non è antenata di `develop`**, e niente di un rilascio torna indietro: un numero o
una sezione di changelog che ricompaiano su `develop` sono un guasto, non un allineamento.

**I rilasci li fa Daiku stesso**, con la skill `release` del pacchetto — non un comando del cantiere e
due script, che non esistono più. Legge `develop`, costruisce il commit di produzione con la plumbing
di git e muove il ref **senza mettersi mai su `main`**: la guardia del ramo resta intera, e il
rilascio non può scriverci lavoro per costruzione. Finché un rilascio non è pushato è una **bozza**, e
i commit che arrivano nel frattempo si aggiungono a lui invece di aprire una versione nuova. Un
rilascio si chiude col push, che resta il gesto manuale dell'owner.

Il confine fra cantiere e prodotto è il ramo, e dentro `plugins/` è inglese tutto: il prodotto parla
inglese, il cantiere italiano.

Perché due rami e non un `.gitignore`: chi aggiunge il marketplace riceve un clone dell'**intero**
repository, non solo di `plugins/daiku/` — lo schema di Claude Code lo dice alla voce `sparsePaths`,
«If omitted, the full repository is cloned». Il repo *è* l'artefatto consegnato: non c'è un passo di
impacchettamento dove mettere il filtro, come farebbe il campo `files` di un `package.json`.

Il confine non guarda *dentro* i file: ciò che sta sotto `plugins/` esce com'è. Prima di un rilascio,
controlla che non porti con sé valori di un progetto ospite o path di questa macchina.

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

## La memoria si aggiorna nella stessa tornata

**Nessuna modifica finisce con la memoria lasciata indietro.** Ciò che una modifica ha reso falso —
una memoria, una policy, il file di istruzioni, un rimando, una riga dell'indice — si corregge
nella stessa tornata, non al commit. Il passo che lo cerca gira **a ogni modifica** e non è un
giudizio su quanto il diff lo meriti: che non ci sia niente da scrivere è il verdetto di un passo
che ha guardato, mai il motivo per non guardare. Una modifica senza quel passo non è finita, e non
si dichiara finita.

Il commit non è un'altra sede della stessa regola: è l'ultima. `update-memory` ripassa l'intero
perimetro sul diff che sta per essere congelato, e il ciclo di review è ciò che lo impone — la
guardia nega `git commit` fuori da lì. Fuori dal ciclo, in una chat che modifica e non committa,
l'allineamento lo fa la sessione stessa, che ha la modifica in mano.

Non si chiede all'owner e non gli si rimanda: «vuoi che aggiorni la memoria?» è la domanda che
questa regola esiste per rendere impossibile. E «non ho toccato la memoria» non è una conclusione
da mettere nel resoconto come se chiudesse il discorso: se il passo ha guardato e non c'era niente
da scrivere, si dice quello.

**Le due sedi.** Il testo sta qui, nella regola `[corpus-never-behind]` del file di istruzioni che
`init` deposita nei progetti ospiti, nel contratto della memoria e in
`plugins/daiku/skills/update-memory/SKILL.md`. Il controllo sta in
`plugins/daiku/hooks/lib/stop-advice.mjs` — il suo banco è dentro
`node plugins/daiku/hooks/self-check.mjs`: alla fine del turno dice quando la sessione ha scritto
sotto il codice e non ha toccato la memoria. Non nega niente, e non deve: al commit la guardia
della review fa già il suo; questo è l'avviso che il fondo del transcript non dà a nessuno. Vale la
legge di *Mai fidarsi di un LLM*: la regola e il controllo, sempre insieme.

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
assomigliano — i cinque programmi di `plugins/daiku/architect/` e la scansione di `init`,
`plugins/daiku/skills/init/scan.mjs`. La terza verifica è la loro, e vale come le altre due:

```bash
node plugins/daiku/hooks/self-check.mjs
```

Lancia insieme i banchi di prova di tutto ciò che il pacchetto esegue — i moduli di
`plugins/daiku/hooks/lib/`, il banco dei manifest degli host, i cinque programmi di
`plugins/daiku/architect/` e `skills/init/scan.mjs` — stampa il totale contato ed esce `1` al primo caso rosso: quanti
banchi e quanti controlli siano lo dice la sua uscita, non questa riga. I banchi del ledger e del
rilascio lavorano con Git vero su repository usa e getta nella cartella temporanea di sistema: vogliono
`git` nel `PATH`.

```bash
node .docs/tools/check-topology.mjs plugins/daiku
```

Verifica la topologia del corpus (nodi su disco = righe di tabella, handoff fra chiamanti,
rimandi di sezione), con totale contato ed uscita `1` al primo caso rosso. Si lancia a mano
prima di un rilascio, accanto al self-check.

Il corpus è verificato dal **gate dell'area `daiku`** (`.daiku/project.json`): la fase *Gate* della
skill `review` — che `ship-feature` esegue — lancia `check-corpus.mjs` da sé su ogni consegna che
tocca `plugins/daiku/`, e un rosso blocca il commit. Copre le otto invarianti che i contratti
dichiarano in prosa ma nessun altro controllo impone — nessun carattere di controllo in una riga,
ogni chiave `{…}` citata esistente con lo specchio `schemas/blocks.json` concorde con la prosa, ogni
path interno che risolve, ogni blocco json parsabile, nessuna skill che nomina un modello, la riga
d'apertura §5.1 dove serve, l'agente dal toolset ristretto, il vocabolario dei ruoli chiuso ai due
di §1 — con totale contato ed uscita `1` al primo caso rosso. Il banco del controllo si lancia con `node .docs/tools/check-corpus.mjs --self-check`.

Nessuno di questi guarda le **due vetrine** del repository pubblicato — la sola parte che il
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

Una verifica riguarda il **cantiere**, non il pacchetto: che nessuno script invochi un push — una
riga dentro un file non passa da nessuna guardia:

```bash
node .docs/tools/check-no-push.mjs --self-check
```

<!-- daiku:instructions — this file was structured by Daiku's init skill. It is yours now: rewrite
     it as you like, init will not touch it again. Remove this line and init may restructure it. -->
