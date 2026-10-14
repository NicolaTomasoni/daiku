# DOMAIN

> **Cosa va qui.** Il mondo di cui il sistema parla: le entità che conosce e cosa porta ciascuna, i
> confini che espone e consuma, e i termini che questo progetto usa con un significato proprio. È
> scritto in termini di comportamento, non come uno schema — la struttura sta in `ARCHITECTURE.md` e
> le tecnologie in `STACK.md`. Leggilo prima di nominare qualcosa, perché una parola non venga a
> significare due cose.

## Indice

1. Entità e dati
2. Interfacce
3. Vocabolario
4. Su cosa poggia

## 1. Entità e dati

- **Il progetto** — il repository su cui Daiku lavora. Porta i suoi **parametri**: dove sta il
  codice, quali sono le aree e con quale comando si verificano, dove vive la memoria e il suo
  indice, come si scrivono i messaggi di commit, quali sono i due rami. Porta anche le sue **regole
  locali**: le convenzioni e i criteri che hanno bisogno di un *perché*, e le regole architetturali
  valide solo per certi path.
- **Il lavoro** — un problema in lavorazione, con la sua cartella di documenti numerati: il
  problema, lo studio strategico o il documento di decisione, il brief di esecuzione, le note di
  review, il report di consegna. È lo stato del lavoro: chi riprende legge i documenti e sa dove la
  catena si era fermata.
- **Il nodo** — un passo del metodo, con il suo contratto: cosa si fa e in che ordine. Alcuni nodi
  sono **punti d'ingresso** e si lanciano a mano; tutti gli altri sono **contratti interni**,
  raggiungibili solo da chi li chiama.
- **L'area** — una parte del progetto con un suo gate; porta i path che le appartengono e il comando
  esatto che la verifica.
- **Il ciclo di review** — i giri con cui un diff viene potato: i revisori, le correzioni, la
  rilettura, finché il codice smette di cambiare.
- **Il ledger** — il registro di quello che un ciclo di review ha già giudicato: serve perché un
  rilievo già valutato non venga rialzato, e perché un ciclo interrotto riparta da dove era.
- **Il worktree** — un albero di lavoro separato in cui un lavoro viene eseguito, così il repository
  principale non viene toccato mentre la catena gira. I worktree disponibili stanno in un **pool**,
  con un registro che dice quali sono liberi.
- **La memoria** — il corpus versionato dei fatti del progetto: quello che l'agente non può dedurre
  dal codice, richiamato per rilevanza. Ha un **indice**, che è la prima cosa che si legge.
- **Il documento fondativo** — uno dei cinque documenti che descrivono il sistema per un lettore
  umano: l'offerta, l'identità, il dominio, lo stack, l'architettura. Questo è il secondo.
- **La release** — la promozione del ramo di sviluppo su quello di produzione: porta la versione e
  la sezione di changelog, costruita dai messaggi dei commit accumulati.
- **Il handoff** — il documento con cui un lavoro fermato a metà viene passato a un altro agente:
  il problema, cosa è stato fatto, cosa manca e le prove, scritte dentro il file.

## 2. Interfacce

- **L'host** — Claude Code. Daiku gli si presenta come un pacchetto: le skill, che l'agente legge
  come contratti; gli hook, che sorvegliano i gesti; i subagenti, a cui i passi vengono delegati. È
  l'unico host che Daiku dichiara.
- **Git** — il sistema di controllo versione. Attraverso di esso passano i due rami, i commit, i
  worktree dei lavori, e lo stash in cui viene riposto un file del progetto che un documento nuovo
  assorbe.
- **Il marketplace** — il canale con cui il pacchetto arriva e si aggiorna: installazione,
  aggiornamento, versione in essere.
- **Il filesystem del progetto** — le **sedi** in cui il metodo scrive: la cartella dei parametri,
  quella della memoria, quelle dei lavori, il file di istruzioni, i documenti fondativi.
- **I registri su disco** — il ledger delle review e il registro del pool dei worktree, che vivono
  dentro l'albero del repository ma fuori dal controllo di versione.
- **La rete** — attraversata solo quando un lavoro ha bisogno di note su una tecnologia che il
  modello non conosce abbastanza: la raccolta legge le fonti reali e deposita un file.

## 3. Vocabolario

- **Contratto** — un file che dice *cosa* si fa e *in quale ordine*, mai con quali valori: è la
  forma che rende lo stesso Daiku valido su qualunque progetto. Vive in due modi: contratto del
  pacchetto, identico ovunque, e contratto del progetto.
- **Parametro** (o **chiave**) — un valore del progetto, che nei contratti si cita fra graffe e si
  risolve sui file dei parametri, mai a memoria. Una chiave non dichiarata non si inventa: il passo
  che ne aveva bisogno viene saltato e lo dichiara.
- **Nodo** — un passo del metodo con il suo contratto. Un nodo può *delegare* a un altro nodo, e chi
  riceve un incarico riceve un **ruolo**, non un modello.
- **Punto d'ingresso** — un nodo che si lancia a mano. Sono nove, e il numero non cresce da solo:
  chi sta in mezzo a una catena viene raggiunto da chi l'ha aperta.
- **Contratto interno** — un nodo che nessuno lancia a mano: un subagente lo riceve come *path da
  leggere*. Non chiede niente all'owner e non ha un `argument-hint`.
- **Ruolo** — chi esegue un passo: **giudice**, se il passo decide o sintetizza; **lavoratore**, se
  esegue o ispeziona un perimetro già delimitato.
- **Gate** — il comando esatto che verifica un'area: la riga da eseguire più la cartella da cui
  eseguirla, mai una descrizione. Un gate dichiarato ma indovinato è peggio di un gate assente,
  perché fallisce e sembra un problema del progetto.
- **Guardia** — un controllo deterministico che *nega* un gesto (un push, un commit fuori dal ciclo,
  una scrittura in un file appena scritto). Nasce spenta: non nega niente dove il progetto non ha
  dichiarato di aver aperto Daiku.
- **Verdetto** — la risposta del motore deterministico a una domanda meccanica sulla catena. Vincola:
  se il motore non risponde, la consegna si ferma invece di degradare in silenzio.
- **Fail-open** — la proprietà di un controllo che, davanti a un guasto, tace e lascia passare. Gli
  hook del pacchetto sono tutti così: un hook rotto non deve costare il turno.
- **Sede** — un posto dichiarato in cui il metodo scrive. Fuori dalle sedi dichiarate non entra un
  file nuovo.
- **Blocco di ritorno** — la risposta strutturata che un nodo restituisce a chi l'ha chiamato: un
  oggetto con campi fissi, che il chiamante legge senza ricostruirlo dalla prosa.
- **Canale** — uno dei due rami del progetto: **sviluppo**, dove ogni commit atterra, e
  **produzione**, che avanza solo con una release e su cui il lavoro non committa.
- **Giro** — un passaggio del ciclo di review, o più in generale una tornata di lavoro completa fino
  al commit.

## 4. Su cosa poggia

- `plugins/daiku/contracts/project-contract.md` — i parametri, le sedi, la lingua, il versionamento;
- `plugins/daiku/contracts/orchestration.md` — i ruoli, i punti d'ingresso, la delega, la topologia;
- `.daiku/README.md` — i quattro livelli in cui vivono i valori, e i nomi di ciò che resta nel
  repository.
