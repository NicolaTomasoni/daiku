# Compaction deterministica — euristica e locale

- **Corsa:** compaction-deterministica-euristica-e-locale
- **Data:** 2026-10-03
- **Target studiati:** 2
- **Esito:** feature

## Cosa hanno portato i target

- alexgreensh/token-optimizer — un plugin di ottimizzazione del contesto per host di coding con il meccanismo **interamente nell'albero**: hook su `Read`, `Bash`, `PreCompact`, `SessionStart`, `Stop`, e uno stato per sessione in SQLite; zero chiamate di rete. L'Asse A è vuoto (niente che Daiku già faccia e questo target faccia meglio), ma l'Asse B porta cinque capacità determinstiche distinte. Licenza PolyForm Noncommercial: non open source.
- philipppohlmann/compaction — un pacchetto npm che si mette **sotto** Claude Code, Codex e Cursor e riduce i token che raggiungono il provider, con due leve etichettate: shaping dell'output (attivo) e riduzione dell'input (chiusa in un motore consegnato a parte). Ogni mutazione conserva l'originale recuperabile byte per byte, governata da una boundary a sette cancelli e fail-open su ogni errore. Batte Daiku su un punto dell'Asse A — il controllo deterministico della veridicità della prosa — e sull'Asse B porta tre capacità.

## Interventi approvati

Nessuno.

## Dove i target divergono, e chi vince

### D1 — Dove si riducono i token di output

- **Le soluzioni:** philipppohlmann/compaction aggancia un'istruzione di concisione **prima** della generazione, per ridurre la prosa che il modello scrive; alexgreensh/token-optimizer comprime **dopo**, in modo deterministico, l'output che i comandi producono.
- **Chi vince:** ibrido
- **Perché:** le due leve agiscono su superfici che non si sovrappongono: nessuna comprime l'output dei comandi (che è deterministico, non generato) e nessuna tocca la prosa generata (che il post-processing non riduce). Si prendono entrambe — la compressione deterministica dei comandi da token-optimizer, lo shaping della prosa da compaction — perché sceglierne una sola lascerebbe scoperta metà della superficie.

### D2 — Come Daiku affronta la compaction

- **Le soluzioni:** alexgreensh/token-optimizer fa **sopravvivere** la conversazione alla compaction con un checkpoint prima e un restore dopo, tutto dentro l'albero (hook, programma, SQLite); philipppohlmann/compaction punta a **ridurre l'input** prima che raggiunga il provider, con un motore adattivo consegnato a parte come artefatto firmato, raggiunto solo via `import()` dinamico, più la conservazione byte-esatta degli originali.
- **Chi vince:** alexgreensh/token-optimizer
- **Perché:** Daiku può adottare solo ciò che riesce a leggere, eseguire e mettere sotto banco; il meccanismo di token-optimizer è interamente nell'albero e deterministico, mentre il motore di compaction non è nell'albero — l'appunto dichiara di non averlo potuto leggere — e un artefatto chiuso contraddice il metodo di Daiku, che non si fida di ciò che non controlla. La sopravvivenza alla compaction si prende da token-optimizer; la riduzione dell'input a motore chiuso resta fuori (vedi *Cosa resta aperto*).

### D3 — Dove vive lo stato locale

- **Le soluzioni:** alexgreensh/token-optimizer tiene lo stato di sessione in SQLite e in cache JSON **sotto la home dell'host**, fuori dal progetto; philipppohlmann/compaction tiene gli originali recuperabili **dentro la cartella di lavoro** dell'utente (`.compaction/gateway/recovery/`), con un `.gitignore` che si scrive da sé.
- **Chi vince:** alexgreensh/token-optimizer
- **Perché:** il confine di Daiku è che nulla del pacchetto scrive dentro il progetto dell'utente; scrivere la propria cache nella cartella di lavoro, per quanto protetta da un `.gitignore` auto-scritto, attraversa quel confine. Le feature che toccano il contesto tengono quindi il loro stato fuori dal progetto.

## Cosa resta aperto

- **Cursor come terzo host.** philipppohlmann/compaction copre Cursor a livello di sessione, e a Daiku — due host dichiarati in `{hosts}` — mancherebbe. Non è un intervento né una feature da costruire in autonomia: è una scelta di prodotto (tocca lo scheletro di un contratto e tre skill, e va verificato cosa Cursor accetti davvero, cosa che questa corsa non ha provato), e l'appunto stesso la rimanda all'owner.
- **Assumere o no un motore di riduzione dell'input chiuso.** La leva dell'input di philipppohlmann/compaction è il cuore della sua proposta, ma è un artefatto firmato fuori dall'albero: adottarla significherebbe rinunciare all'ispezionabilità e al banco. Se Daiku debba mai accettare un motore che non può leggere è una decisione di prodotto, non una sintesi.
- **Licenza di alexgreensh/token-optimizer.** Il target è PolyForm Noncommercial (non open source): se ne prendono meccanismi e idee, non codice. Quanto prestito ammetta il prodotto — che va verso il pubblico — è una conferma dell'owner.

## Limiti

- Nessun target è rimasto senza appunto: due su due hanno scritto il loro.
- alexgreensh/token-optimizer: `measure.py` (oltre 51.000 righe) non è stato letto per intero; gli adattatori per host diversi da Claude Code solo di sfuggita; le tre copie speculari dell'albero non sono state confrontate byte a byte; e le cifre di risparmio (564→115 token, 720 KB→250, 2000→50) sono dichiarazioni del target, non verificate qui.
- philipppohlmann/compaction: il motore adattivo non è nell'albero (consegnato a parte), quindi il giudizio su come riduce l'input poggia sulla sola boundary pubblica; `init.ts`, `tool-shim.ts`, `hooks.ts` e `server.ts` (da 25 a 151 KB) letti in parte, non riga per riga; la copertura di Cursor è dichiarata ma non provata; le cifre di risparmio (−14% input, −25% output) sono dichiarazioni del target, non verificate qui.
