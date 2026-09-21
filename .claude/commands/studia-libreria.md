---
description: 'Studia una libreria, una tecnologia o un host dalle fonti reali e produce un md di appunti operativi in sviluppo/appunti-lib'
argument-hint: '[nome libreria/tecnologia/host]'
---

Studia in autonomia una libreria, una tecnologia o un host dalle **fonti reali** (specifiche di
prima parte su disco, docs ufficiali, repo, package registry) e produci un **unico file markdown di
appunti operativi** in `sviluppo/appunti-lib/`. Lavora in **due passaggi**: prima raccogli in
append, poi riorganizzi.

Serve a colmare i buchi di conoscenza del modello — cutoff, tecnologie giovani, API in evoluzione —
con fatti verificabili, non con memoria. Per Daiku il caso tipico non è una libreria: sono i due
host, `claude` e `codex`, i cui meccanismi di estensione si muovono più in fretta di qualunque
cutoff.

## Input: cosa studiare

Argomenti: `$ARGUMENTS`

L'argomento è il **nome** di ciò che va studiato (es. `codex plugin`, `claude code hooks`,
`pyyaml`, `semver`). Può includere un linguaggio o una versione.

- Se `$ARGUMENTS` è vuoto, **chiedi** cosa studiare e fermati finché non lo ricevi.
- Deriva uno **slug** kebab-case dal nome (es. `codex plugin` → `codex-plugin`). Il file target è
  `sviluppo/appunti-lib/<slug>.md`. **Un solo md per tecnologia.**
- Se `sviluppo/appunti-lib/<slug>.md` **esiste già**, non ripartire da zero: leggilo, tratta il
  lavoro come un **aggiornamento/estensione** (colma i buchi, aggiorna la versione, aggiungi ciò
  che manca) e poi riorganizza. Non duplicare ciò che c'è già.
- Crea la cartella `sviluppo/appunti-lib/` se non esiste.

## La regola che vale solo qui: la prima parte batte il web

Per tutto ciò che riguarda **Claude Code e Codex**, la fonte autoritativa non è la
documentazione web: sono i file che l'host esegue, che stanno su questa macchina.

- **Codex** porta con sé le skill di sistema in `~/.codex/skills/.system/`. Fra queste,
  `plugin-creator` contiene lo schema e il **validatore reale**
  (`scripts/validate_plugin.py`), che per sua stessa dichiarazione «rispecchia lo schema di
  ingestione dei plugin del workspace»; ci sono anche `skill-creator` e `skill-installer`.
  `codex features list` dice quali feature sono attive, rimosse o dietro gate.
- **Claude Code** valida con `claude plugin validate <path>`, e lo schema delle impostazioni sta
  su `https://json.schemastore.org/claude-code-settings.json`.
- La documentazione Codex **non** sta più su `developers.openai.com/codex`: quegli URL fanno
  308-redirect verso `learn.chatgpt.com/docs/*`, e i `docs/*.md` nel repo `openai/codex` sono
  ormai stub. L'indice è `https://learn.chatgpt.com/llms.txt`.

Quando una pagina web e un validatore su disco dicono cose diverse, **ha ragione il validatore**,
e il disallineamento si scrive negli appunti: è successo già una volta, con la sezione «Field
guide» che mostrava `"hooks": "./hooks.json"` in un manifest che il validatore rifiuta.

Prima di aprire il browser, guarda se `sviluppo/RICOGNIZIONE.md` risponde già: il capitolo 3
raccoglie prove eseguite sui validatori reali di entrambi gli host, con la data. Se risponde e ti
sembra superato, verificalo — non riscriverlo a memoria.

## Obiettivo del contenuto

Appunti **operativi per sviluppare**, non marketing. Priorità, in ordine:

1. **Firme, schemi e campi esatti** — chiavi ammesse in un manifest, decoratori, classi, funzioni,
   parametri nominali con i loro default, import esatti, tipi. Copiati **verbatim** dalle fonti,
   mai parafrasati.
2. **Snippet completi** e funzionanti (import inclusi), in blocchi ` ```<lang> `.
3. **Setup**: install, versione corrente, requisiti, configurazione.
4. **Modello mentale**: cosa fa, come, cosa garantisce e cosa **no**; quando usarla e quando no.
5. **Gotcha e limiti** documentati; errori ed eccezioni tipiche, con il messaggio esatto.
6. **Novità oltre il cutoff**: changelog recente con **breaking change** segnalate esplicitamente.

## Regole di accuratezza (vincolanti)

- **Solo fonti reali.** Non scrivere nulla dalla memoria del modello: ogni fatto deve venire da una
  pagina fetchata o da un file letto su disco. Le API di tecnologie giovani sono il punto dove il
  modello allucina firme plausibili ma sbagliate.
- Ciò che le fonti non confermano si marca **`[da verificare]`** con cosa manca, invece di
  inventare.
- «verbatim» = copiato dalla fonte. Non riscrivere le firme «a senso».
- Riporta sempre la **versione** su cui stai raccogliendo e la **data**.
- Quando una prova si può eseguire su questa macchina — validare un pacchetto di banco, leggere uno
  schema, lanciare un `--help` — **eseguila**, e scrivi l'esito verbatim. Una prova vale più di una
  pagina, e questo progetto è già stato costruito così.

---

## Passaggio 1 — Ricerca con append

Obiettivo: accumulare nel file target tutta la conoscenza utile, in append, senza preoccuparti
ancora dell'ordine.

1. **Orientati e ancora la freschezza.** Individua le fonti canoniche: la specifica di prima parte
   su disco se esiste (vedi sopra), poi sito/docs ufficiali, repo GitHub, pagina sul package
   registry, guida «getting started», reference, changelog/releases. Includi l'anno corrente nelle
   query per evitare risultati stantii.

   La freschezza è un **requisito, non un dettaglio**. La versione va presa dalla fonte
   **autoritativa e non indicizzata**, non da una ricerca web:

   - **Fonte primaria: il repo GitHub ufficiale.** Individua `owner/repo` e interroga i release o i
     tag con la `gh` CLI, che è deterministica e sempre attuale:
     - `gh release list -R <owner>/<repo> -L 5`
     - se il progetto non usa le Releases: `gh api repos/<owner>/<repo>/tags --jq '.[0:5][].name'`
     - per la data: `gh release view -R <owner>/<repo> --json tagName,publishedAt`
   - **Conferma incrociata sul registry** (`pypi.org/project/<pkg>/`, `npmjs.com/package/<pkg>`):
     la versione pubblicata deve coincidere con l'ultima release. Il registry dà anche i requisiti
     di runtime.
   - **Per una CLI installata**, la fonte più autoritativa è la CLI stessa: `<cli> --version`.
   - **Sanity check di coerenza**: se le pagine docs riportano una versione più vecchia dell'ultima
     release, **fidati della release** e segnala il disallineamento nel file.
   - Registra **versione esatta + data di rilascio + data odierna di raccolta**.

2. **Crea (o apri) il file** `sviluppo/appunti-lib/<slug>.md`. Se nuovo, scrivi un header minimo:
   titolo, riga con fonte primaria + versione + data, nota sul cutoff del modello, e una sezione
   «Meta e fonti» con gli URL e i path trovati e le convenzioni (`[da verificare]`, «verbatim»).

3. **Fai fan-out di ricerca.** Suddividi la superficie in **blocchi tematici** (indicativamente:
   concetti e modello mentale · setup e quickstart · API/primitive core · configurazione e runtime ·
   estensione e integrazione · operatività e CLI · changelog e novità — adatta i blocchi al
   soggetto). Lancia **subagent worker in parallelo** (ruolo e modo di lanciarli da
   `.claude/orchestration.md`), **uno per blocco**, ciascuno con:

   - le pagine da fetchare e i file su disco da leggere per quel blocco;
   - l'istruzione di **preservare firme, chiavi e snippet verbatim** e di marcare `[da verificare]`
     ciò che non trovano;
   - il vincolo di **sola lettura**, ripetuto nel prompt: nessuno strato dell'harness lo impone a
     chi ha `Bash` (§3 di `.claude/orchestration.md`);
   - la consegna di restituire come **messaggio finale** una **sezione markdown pronta da
     incollare**, con titolo di sezione, niente preamboli.

   Lanciali in un solo messaggio (girano concorrenti). Non far scrivere il file agli agenti:
   **appendi tu** i loro risultati man mano che completano, così eviti race sul file.

4. **Appendi in coda** al file ogni sezione ricevuta, verificando solo che i blocchi di codice
   siano ben formati. Se un blocco resta scoperto o dubbio, fai tu una lettura mirata per colmarlo
   prima di chiudere il passaggio.

Al termine del passaggio 1 il file contiene tutto il materiale, eventualmente ridondante e
disordinato: va bene, lo sistemi al passaggio 2.

## Passaggio 2 — Riorganizzazione

Obiettivo: rendere il file chiaro, ordinato, senza duplicati — senza perdere un solo fatto
verbatim.

1. **Rileggi** il file intero.

2. **Riordina per gruppi logici**, non per ordine di raccolta. Struttura tipica: *Fondamenti*
   (meta e fonti · concetti · setup) → *Primitive core* → *Estensione* → *Config e lifecycle* →
   *Operatività* → *Changelog* → (se pertinente) *Note per Daiku*. Aggiungi un **indice** in cima e
   numera le sezioni.

3. **Deduplica.** Ogni firma o snippet deve avere **una sola** fonte nel documento; gli altri punti
   che la citavano diventano **cross-riferimenti** alla sezione canonica (es. «chiavi in [05]»).

4. **Migliora la leggibilità senza inventare:** tabelle per elenchi di parametri e per il
   changelog; una «symbol map» se i nomi sono sparsi; marca con ⚠️ le breaking change.

5. **Preserva** integralmente: firme verbatim, default, marcatori `[da verificare]`, URL e path
   delle fonti. La riorganizzazione tocca *ordine e duplicazione*, mai i *fatti*.

## Vincoli operativi

- Ogni accesso a file resta dentro il repository e dentro le sedi che l'host espone su questa
  macchina (`~/.codex/`, `~/.claude/`). Niente ricerche sull'intero filesystem.
- **Non scrivi mai sotto `plugins/`**: gli appunti sono materiale di sviluppo, non prodotto. Se
  quello che hai imparato cambia il pacchetto, è una consegna, non un appunto.
- **Non committare** e non fare push: il comando produce solo il file.
- Lavora in autonomia end-to-end (entrambi i passaggi) senza chiedere conferme, tranne quando
  `$ARGUMENTS` è vuoto.

## Output finale

Al termine, riferisci in sintesi: il path del file prodotto, la versione e la data di ciò che hai
studiato, i blocchi coperti, e i punti rimasti `[da verificare]` — sono i posti dove non fidarti
prima di controllare. Se hai trovato un fatto che smentisce `sviluppo/RICOGNIZIONE.md`, **dillo
esplicitamente**: quel documento è la base su cui poggiano le decisioni del pacchetto, e una sua
riga superata vale più di dieci righe di appunti nuovi.
