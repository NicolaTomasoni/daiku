# STACK

> **Cosa va qui.** Ciò con cui il sistema è costruito: linguaggi e versioni, framework e librerie,
> la catena di build e di prova, gli strumenti, dove gira e come si distribuisce. È l'inventario da
> cui si prepara una macchina nuova e la lista con cui si giudica una dipendenza — nessuna struttura
> o confine (quelli sono in `ARCHITECTURE.md`) e nessuna offerta (quella è `PRODUCT.md`). Ogni riga
> è qualcosa che il progetto dichiara da qualche parte.

## Indice

1. Linguaggi e runtime
2. Framework e librerie
3. Strumenti e catena di build e prova
4. Dove gira e come si distribuisce
5. Su cosa poggia

## 1. Linguaggi e runtime

**JavaScript**, in moduli ES, nei file `.mjs`. Il runtime è **Node.js 18 o superiore**: sotto quella
versione gli hook tacciono e il motore deterministico non parte affatto — e poiché il suo verdetto
vincola, una consegna si ferma invece di degradare.

Non c'è nessun linguaggio compilato, nessun transpiler e nessun bundler: i file `.mjs` sono il
codice che gira.

## 2. Framework e librerie

**Nessuna dipendenza esterna.** Il pacchetto non dichiara alcun manifesto di dipendenze né alcun
lockfile: tutto è scritto sulla libreria standard di Node e sulle API dell'host. È una scelta
coerente con la natura del prodotto — un corpus di contratti più i programmi che lo sorvegliano —
e con il fatto che un pacchetto installato in ogni progetto che l'host apre non deve trascinarsi
dietro un albero di dipendenze.

## 3. Strumenti e catena di build e prova

**Non c'è una build**: ciò che si scrive è ciò che si esegue.

I banchi di prova del pacchetto si lanciano tutti insieme con un comando, che conta il totale e
esce in errore al primo caso rosso. Accanto, dal cantiere, i controlli che guardano il corpus e la
vetrina:

```bash
node plugins/daiku/hooks/self-check.mjs          # i banchi di hook, programmi e scansione di init
node .docs/tools/check-corpus.mjs plugins/daiku  # le invarianti del corpus
node .docs/tools/check-topology.mjs plugins/daiku # la topologia: nodi, handoff, rimandi
```

La validazione del pacchetto e della vetrina è quella dell'host:

```bash
claude plugin validate plugins/daiku  # il pacchetto
claude plugin validate plugins        # la vetrina del marketplace
```

E un ultimo controllo riguarda il cantiere invece del pacchetto: che nessuno script invochi un push.

```bash
node .docs/tools/check-no-push.mjs
```

I banchi che lavorano su Git vero — il ledger della review e il rilascio — girano su repository usa
e getta nella cartella temporanea di sistema, e vogliono `git` nel `PATH`.

Il sistema non ha linter, formattatore né coverage configurati: la verifica è quella dei banchi e
dei controlli qui sopra.

## 4. Dove gira e come si distribuisce

Il sistema **non è ospitato da nessuna parte**: gira dove gira l'agente, sulla macchina di chi
lavora, dentro il repository del progetto.

Si distribuisce come **pacchetto di Claude Code attraverso un marketplace**, che è il repository
pubblico `NicolaTomasoni/daiku` su GitHub. L'installazione è di due comandi, una volta per macchina:

```text
claude plugin marketplace add NicolaTomasoni/daiku
claude plugin install daiku@daiku
```

L'aggiornamento lo porta lo script che `init` deposita nel progetto, con il task `daiku: update`
nell'editor che mostra la versione in essere accanto a quella che arriva e chiede prima di procedere.

Una modifica raggiunge la produzione con la **release**, che promuove il ramo di sviluppo su quello
di produzione: legge il blocco di commit accumulati, chiede la versione una volta sola e la scrive
su produzione con la sua sezione di changelog. Il push resta un gesto manuale dell'owner — la
release si ferma al ref locale.

## 5. Su cosa poggia

- `plugins/README.md` — il requisito di Node e i due comandi di installazione;
- `.daiku/README.md` — l'aggiornamento del pacchetto e ciò che resta nel repository;
- i controlli stessi, in `plugins/daiku/hooks/self-check.mjs` e in `.docs/tools/`.
