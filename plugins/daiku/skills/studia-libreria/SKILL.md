---
name: studia-libreria
description: Studia una libreria/tecnologia dalle fonti reali e produce un md di appunti operativi di sviluppo in docs/appunti-lib
argument-hint: [nome libreria/tecnologia]
original-name: studia
---

Studia in autonomia una libreria o tecnologia dalle **fonti reali** (docs ufficiali, repo, package registry, tutorial) e produci un **unico file markdown di appunti operativi di sviluppo** in `docs/appunti-lib/`. Lavora in **due passaggi**: prima raccogli in append, poi riorganizzi.

> Ogni path qui sotto è **relativo alla radice tecnica** da cui esegui, la stessa di `CLAUDE.md` (`.claude/project-contract.md` §3). Serve a colmare i buchi di conoscenza del modello (cutoff, librerie giovani/di nicchia, API in evoluzione) con fatti verificabili, non con memoria.

## Input: tecnologia da studiare

Argomenti: `$ARGUMENTS`

L'argomento è il **nome della libreria/tecnologia** (es. `DBOS`, `LangGraph`, `Tauri v2`, `TanStack Query`). Può includere un linguaggio o una versione (es. `dbos python`, `pydantic v2`).

- Se `$ARGUMENTS` è vuoto, **chiedi** quale tecnologia studiare e fermati finché non la ricevi.
- Deriva uno **slug** kebab-case dal nome (es. `TanStack Query` → `tanstack-query`, `dbos python` → `dbos-python`). Il file target è `docs/appunti-lib/<slug>.md`. **Un solo md per tecnologia.**
- Se `docs/appunti-lib/<slug>.md` **esiste già**, non ripartire da zero: leggilo, tratta il lavoro come un **aggiornamento/estensione** (colma i buchi, aggiorna la versione, aggiungi ciò che manca) e poi riorganizza. Non duplicare ciò che c'è già.
- Crea la cartella `docs/appunti-lib/` se non esiste.

## Obiettivo del contenuto

Appunti **operativi per sviluppare**, non marketing. Priorità, in ordine:

1. **Firme e API esatte** — decoratori, classi, funzioni, parametri nominali con i loro default, import esatti (`from x import y`), tipi. Copiati **verbatim** dalle fonti, mai parafrasati.
2. **Snippet completi** e funzionanti (import inclusi), in blocchi ` ```<lang> `.
3. **Setup**: install, versione corrente del pacchetto, requisiti (runtime/versione linguaggio), configurazione, connessioni.
4. **Modello mentale**: cosa fa, come, cosa garantisce e cosa **no**; quando usarla e quando no.
5. **Gotcha e limiti** documentati; errori/eccezioni tipiche.
6. **Novità oltre il cutoff**: changelog recente con **breaking change** segnalate esplicitamente.

## Regole di accuratezza (vincolanti)

- **Solo fonti reali.** Non scrivere nulla dalla memoria del modello: ogni fatto deve venire da una pagina fetchata. Le API di librerie giovani/di nicchia sono il punto dove il modello allucina firme plausibili ma sbagliate — non farlo.
- Ciò che le fonti non confermano si marca **`[da verificare]`** con cosa manca, invece di inventare.
- "verbatim" = copiato dalla fonte. Non riscrivere le firme "a senso".
- Riporta sempre la **versione** su cui stai raccogliendo e la **data**.

---

## Passaggio 1 — Ricerca con append

Obiettivo: accumulare nel file target tutta la conoscenza utile, in append, senza preoccuparti ancora dell'ordine.

1. **Orientati e ancora la freschezza.** Fai 1–2 `WebSearch` per individuare le fonti canoniche: sito/docs ufficiali, repo GitHub, pagina sul package registry (PyPI/npm/crates/pkg.go.dev), guida "getting started", reference API, changelog/releases, eventuale blog "what's new". Includi l'anno corrente nelle query (es. "libreria X changelog 2026") per evitare risultati stantii.

   La freschezza è un **requisito, non un dettaglio**: la doc deve rispecchiare l'**ultima release**. La versione va presa dalla fonte **autoritativa e non indicizzata**, non da WebSearch (US-only, dipende dall'indicizzazione: una release di pochi giorni fa può non emergere).

   - **Fonte primaria della versione: il repo GitHub ufficiale.** Praticamente ogni libreria ne ha uno. Individua `owner/repo` (dalla pagina del registry o da una WebSearch di orientamento) e interroga i **release/tag direttamente con la `gh` CLI**, che è deterministica e sempre attuale (niente cache, niente indexing):
     - `gh release list -R <owner>/<repo> -L 5`
     - se il progetto non usa le GitHub Releases, i tag: `gh api repos/<owner>/<repo>/tags --jq '.[0:5][].name'`
     - per la data: `gh release view -R <owner>/<repo> --json tagName,publishedAt` (o l'API dei tag).
     Prendi **numero di versione + data di rilascio** da qui.
   - **Conferma incrociata sul registry** (`WebFetch` di `pypi.org/project/<pkg>/`, `npmjs.com/package/<pkg>`, ecc.): la versione pubblicata deve coincidere con l'ultima release/tag. Il registry dà anche i requisiti (versione runtime/linguaggio).
   - **Preferisci la doc versionata/"latest"**: se il sito espone URL per versione o un selettore, usa quella dell'ultima release; evita pagine archiviate o mirror.
   - **Sanity check di coerenza**: se le pagine docs riportano una versione/date più vecchie dell'ultima release GitHub, **fidati di GitHub** e segnala il disallineamento nel file (le docs sono indietro). Marca `[da verificare]` le API non confermabili sulla versione più recente.
   - Registra nel file **versione esatta + data di rilascio + data odierna di raccolta**, così chi rilegge sa quanto è fresca la fonte.

   Nota: se la `gh` CLI non è disponibile o il repo non è su GitHub, ripiega su `WebFetch` della pagina releases/tags del repo e del registry — ma la via preferita resta `gh`.

2. **Crea (o apri) il file** `docs/appunti-lib/<slug>.md`. Se nuovo, scrivi un header minimo: titolo, riga con fonte primaria + versione + data, nota sul cutoff del modello, e una sezione "Meta e fonti" con gli URL trovati e le convenzioni (`[da verificare]`, "verbatim").

3. **Fai fan-out di ricerca.** Suddividi la superficie della tecnologia in **blocchi tematici** (indicativamente: concetti/modello mentale · setup & quickstart · API/primitive core · configurazione & runtime · integrazione/estensione · gestione/operatività/CLI · changelog & novità recenti — adatta i blocchi alla libreria specifica). Lancia **subagent worker in parallelo** (ruolo e modello da `.claude/orchestration.md`), **uno per blocco**, ciascuno con:
   - le pagine ufficiali da `WebFetch` per quel blocco (e libertà di seguire link utili);
   - l'istruzione di **preservare firme, import e snippet verbatim** e di marcare `[da verificare]` ciò che non trovano;
   - la consegna di restituire come **messaggio finale** una **sezione markdown pronta da incollare**, con titolo di sezione, niente preamboli.

   Lancia gli agenti in un solo messaggio (girano concorrenti). Non far scrivere il file agli agenti: **appendi tu** i loro risultati man mano che completano, così eviti race sul file.

4. **Appendi in coda** al file ogni sezione ricevuta, verificando solo che i blocchi di codice siano ben formati. Se un blocco resta scoperto o dubbio, fai tu una `WebFetch`/`WebSearch` mirata per colmarlo prima di chiudere il passaggio.

Al termine del passaggio 1 il file contiene tutto il materiale, eventualmente ridondante e disordinato: va bene, lo sistemi al passaggio 2.

## Passaggio 2 — Riorganizzazione

Obiettivo: rendere il file chiaro, ordinato, senza duplicati — senza perdere un solo fatto verbatim.

1. **Rileggi** il file intero.

2. **Riordina per gruppi logici**, non per ordine di raccolta. Struttura tipica: *Fondamenti* (meta/fonti · concetti & modello mentale · setup & quickstart) → *Primitive core* (le API principali) → *Infrastruttura/estensione* → *Config & lifecycle* → *Operatività* (gestione, CLI, recovery) → *Changelog/novità* → (se pertinente) *Note d'integrazione per il progetto*. Aggiungi un **indice** in cima e numera le sezioni.

3. **Deduplica.** Ogni firma/snippet deve avere **una sola fonte** nel documento; gli altri punti che la citavano diventano **cross-riferimenti** alla sezione canonica (es. "firme in [05]"). Fondi i concetti ripetuti in un unico elenco richiamato per riferimento. Rimuovi le ripetizioni testuali.

4. **Migliora la leggibilità senza inventare:** tabelle per elenchi di parametri e per il changelog; una "symbol map" (cosa si importa dalla libreria → in quale sezione) se i nomi sono sparsi; marca con ⚠️ le breaking change.

5. **Preserva** integralmente: tutte le firme verbatim, i default dei parametri, i marcatori `[da verificare]`, gli URL delle fonti. La riorganizzazione tocca *ordine e duplicazione*, mai i *fatti*.

## Vincoli operativi

- Rispetta le regole runtime del `CLAUDE.md`: **niente ricerche sull'intero filesystem**; ogni accesso a file resta dentro il progetto e la cartella `docs/appunti-lib/`.
- **Non committare** e non fare push: il comando produce solo il file.
- Lavora in autonomia end-to-end (entrambi i passaggi) senza chiedere conferme, tranne quando `$ARGUMENTS` è vuoto.

## Output finale

Al termine, riferisci in sintesi: il path del file prodotto, la versione/data della tecnologia studiata, i blocchi coperti, e i punti rimasti `[da verificare]` (sono i posti dove non fidarti prima di controllare).
