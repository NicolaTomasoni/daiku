# toon-format/toon — una notazione di oggetti orientata ai token: ricodifica senza perdita il JSON in una forma compatta e leggibile, con SDK, CLI e banchi di misura

- **URL:** https://github.com/toon-format/toon
- **Licenza:** MIT
- **Ultimo commit:** 2026-10-03
- **Stelle:** 25452
- **Archivio:** no
- **Letto via:** api

## Cosa fa, e come lo fa

Per chi lo usa, TOON è una **seconda codifica del modello dati JSON**: tieni il JSON nel programma e lo
ricodifichi in TOON quando lo metti in un prompt. Non comprime, non perde, non manda niente in rete: è
una funzione pura `encode`/`decode` più una CLI di conversione e analisi. La promessa è «stessi oggetti,
meno token, struttura più facile da seguire per il modello». La libreria runtime non ha dipendenze
(`packages/toon/package.json`, `"files": ["dist"]`, l'unico devDependency è lo spec); la CLI ha un
`utilful/cli` e richiede Node ≥ 24 (`packages/cli/package.json`).

Il meccanismo sono **quattro forme**, scelte automaticamente dalla forma del dato
(`docs/guide/format-overview.md`, riassunte in `README.md`):

- **inline** — un array di primitivi sulla riga dell'header: `alerts[2]: frost,wind`;
- **tabolare** — array di oggetti uniformi, la lista dei campi dichiarata una volta sola nell'header e
  una riga di soli valori per elemento: `forecast[3]{day,condition,rainChance}:` poi `Mon,snow,80`;
- **keyed tabolare** — mappe di oggetti uniformi (flag, config, record per id), il `:` doppio dopo la
  lunghezza (`[2:]`) e la chiave su ogni riga: `environments[2:]{region,replicas,debug}:`;
- **lista** — tutto ciò che resta (tipi misti, oggetti non uniformi), un `- ` per elemento.

Sopra ci sta un dettaglio che è il vero contenuto del progetto: **l'header dichiara la propria forma**.
`[N]` dichiara quante righe, `{fields}` quanto è larga la riga, e un campo tabolare può portare
sotto-campi (`{name,address{city,country}}`, i *nested field groups*). Da lì discendono due cose che una
libreria di formattazione normalmente non ha:

1. **Il documento si controlla da solo.** In modalità strict (predefinita) il decoder rifiuta un numero
   di righe diverso da `[N]`, righe tabolari in più o in meno, righe vuote dentro un blocco, escaping
   sbagliato (`packages/toon/src/decode/validation.ts`, `assertExpectedCount`, `validateNoExtraTabularRows`;
   `docs/guide/llm-prompts.md` § *Validation with Strict Mode*). Il banco dei retrieval-accuracy costruisce
   cinque dataset *strutturalmente corrotti* (troncato, righe in più, larghezza sbagliata, campi mancanti)
   proprio per mostrare che quella perdita, in JSON/YAML/XML/CSV, è **invisibile** (`benchmarks/README.md`).
2. **Il modello si guida mostrando l'header.** Il consiglio d'integrazione è: mostra `users[N]{id,name,role}:`
   e il modello riempie le righe e aggiusta `[N]`, invece di ripetere le chiavi (`docs/guide/llm-prompts.md`).

Stateless per costruzione, quindi: non c'è stato da nessuna parte, lo muovono solo le opzioni di
codifica (`delimiter` `,`/tab/`|`, `indentSize`, un `replacer` con tracking del path) e gli header dentro
il testo. L'API è anche **streaming** nei due versi: `encodeLines` produce righe senza costruire la
stringa intera, `decodeStream`/`decodeFromLines` consumano righe da uno stream anche async
(`packages/toon/src/index.ts`); la CLI legge da stdin, rileva il verso dall'estensione e con `--stats`
stampa il risparmio (`packages/cli/README.md`).

Il codice che regge il tutto è un encoder/decoder TypeScript con due attenzioni dichiarate. La
**normalizzazione** mappa tipi non-JSON: `Date`→ISO, `Set`→array, `Map`→oggetto, `bigint` fuori dal range
sicuro→stringa, `-0`→`0`, i numeri non finiti→`null`, e rifiuta un surrogato spaiato invece di sostituirlo
in silenzio con U+FFFD (`packages/toon/src/encode/normalize.ts`). La **decodifica è indurita contro
l'inquinamento del prototipo**: una chiave `__proto__` resta una proprietà propria, non diventa il
prototipo (`packages/toon/test/decode-security.test.ts`); lo spec elenca la sicurezza come §15 e la
conformità come §13.

Una precisazione sulla **documentazione normativa**: lo `SPEC.md` nella radice è solo un rimando — «The
specification lives in toon-format/spec» — e lo spec vero (§1–§18, il banco di conformità Appendice C,
il media type `text/toon`) vive in un **secondo repository**, `toon-format/spec`. Il verdetto di
conformità, quindi, è fuori da questo target: `docs/reference/spec.md` ne è l'indice in-repo.

L'ecosistema è ampio e in parte è già il tema dello studio: oltre a playground, estensioni editoriali e
port in molte lingue (`docs/ecosystem/tools-and-playgrounds.md`, `docs/ecosystem/implementations.md`),
esiste **Tooner**, «an MCP proxy that converts JSON tool responses to TOON» — cioè TOON applicato proprio
all'output dei tool prima che raggiunga il modello.

**I banchi, e con quale modello sono misurati.** Due binari separati per non fare confronti sleali
(`benchmarks/README.md`): *Mixed-Structure* (dati annidati/semi-uniformi, TOON vs JSON, YAML, XML; CSV
escluso perché non può rappresentarli senza perdita) e *Flat-Only* (dati piatti, dove CSV è un concorrente
lecito). Il retrieval-accuracy: 244 domande su 13 dataset, **4 modelli** —
`claude-haiku-4-5-20251001`, `gemini-3.6-flash`, `gpt-5.4-nano`, `grok-4.5` — interrogati via Vercel AI
SDK con `reasoning: 'none'` (`grok` a `low`), 244×6 formati×4 modelli = **5.856 chiamate**
(`benchmarks/src/evaluate.ts`). Le risposte sono confrontate in modo **deterministico** (nessun giudice
LLM), con intervalli di Wilson al 95%. Il conteggio dei token è offline con `gpt-tokenizer` (`o200k_base`,
quindi il tokenizer di GPT-5) — `benchmarks/src/utils.ts`, e il README dichiara che «other providers
tokenize differently… relative differences hold directionally».

**Cosa dicono davvero i numeri.** La headline del README è «72,2% accuracy vs 71,4% di JSON, con il 42,6%
di token in meno». Letto per intero, però: il −42,6% è **contro il JSON indentato**, non contro il JSON
compatto. Nel binario misto TOON è a **+1,6% di token rispetto al JSON compatto** (264.734 contro 260.451);
nel binario piatto è a **+5,9% rispetto a CSV** (68.030 contro 64.247) e risparmia il 35,2% sul JSON
compatto solo perché lì il compatto ripete ancora le chiavi. E l'accuracy: TOON batte JSON su 3 modelli
su 4, ma su `gpt-5.4-nano` sta **sotto** JSON (57,0% contro 57,4%) e sotto XML (59,4%), e il README stesso
avverte che quando gli intervalli di confidenza si sovrappongono la differenza non è statisticamente
significativa. Il vantaggio vero e dichiarato è la **Structure Awareness** (90,3% vs 84,0%) e la
**Structural Validation** (100% vs 50%), non la comprensione generale: aggregazione e filtraggio sono al
pavimento per tutti i formati perché misurano l'aritmetica su più righe, non la forma. E il documento
teorico (`docs/reference/efficiency-formalization.md`) è onesto sui limiti: gli array di array sono l'unica
famiglia dove TOON **perde** contro JSON (≈6 byte di overhead per array interno), e l'indentazione si mangia
il vantaggio in profondità.

## Asse A — Daiku lo fa già, e loro lo fanno meglio?

### A1 — Serializzare i dati fra i passi come JSON

- **In Daiku oggi:** i blocchi di ritorno dei subagent e i verdetti del valutatore sono **JSON**, con lo
  specchio controllabile in `plugins/daiku/schemas/blocks.json` e la validazione in
  `plugins/daiku/architect/architect.mjs` `askBlock`/`SHAPES`; il ledger e i file dei findings sono JSON
  letti dai programmi (`plugins/daiku/architect/ledger.mjs`).
- **Nel target:** TOON è una codifica **senza perdita dello stesso modello dati JSON**, e in più compatta
  e con controllo di forma intrinseco (`packages/toon/src/index.ts`; `packages/toon/src/decode/validation.ts`).
- **Chi vince:** daiku
- **Proposta:** niente, vince Daiku. I blocchi di Daiku sono **oggetti singoli e piccoli con campi di
  prosa** (`description`, `scenario`, `why`) — la forma *non uniforme* dove TOON non guadagna, e con i
  campi di testo il risparmio è nullo. Il ledger, che ha array uniformi (`rounds[]`, `applied[]`), è letto
  **da programmi** con `JSON.parse` (`ledger.mjs`, `architect.mjs`): passare a TOON costringerebbe ogni
  programma a portarsi un decoder, per un guadagno che nessun prompt consuma. Il posto dove Daiku mette davvero
  un array davanti a un modello — il file dei findings letto dall'applier, `skills/review/SKILL.md` § *Applier*
  — arriva **per path**, non trascritto, quindi non è nel prompt di nessuno.

### A2 — Come far arrivare dati strutturati al modello

- **In Daiku oggi:** la regola è **passare lo stato per path, mai trascriverlo**: «What already lives in a
  file — a ledger, a list a program numbered — goes as its **path**, not as a transcription»
  (`plugins/daiku/contracts/orchestration.md` §4 punto 1), e i valori risolti vanno come `key = value`
  copiati dal file, non parafrasati.
- **Nel target:** TOON risolve il problema opposto — il caso in cui devi *mettere* il dato nel prompt — con
  una ricodifica compatta (`README.md`, `docs/guide/llm-prompts.md`).
- **Chi vince:** daiku
- **Proposta:** niente, vince Daiku. Non è lo stesso lavoro fatto peggio: Daiku **progetta via** la
  trascrizione (il figlio apre il file da sé), quindi il caso d'uso di TOON in Daiku semplicemente non si
  presenta. L'unico residuo è il valore che *non* sta in un file e va scritto in chiaro nel prompt: lì il
  costo di introdurre un formato e un decoder supera il risparmio, che su un pugno di campi è di poche unità.

## Asse B — Daiku non lo fa, e si potrebbe aggiungere?

### B1 — Lunghezza dichiarata accanto a una lista che torna da un modello

- **Capacità:** Daiku valida la **presenza e il dominio dei campi** di un blocco, ma non la **lunghezza
  delle sue liste**: `SHAPES.finder` di `architect/architect.mjs` controlla che `findings` sia un array e
  che ogni voce abbia un `file` — non che il numero di voci sia quello che il finder dichiara di aver
  prodotto. Una lista **troncata in modo semanticamente valido** (JSON corretto, una voce in meno) oggi è
  indistinguibile da «ne ho trovati meno». Daiku ha già questo meccanismo **in un solo punto**: l'applier è
  giudicato contro i `finding_ids` che il chiamante gli passa (`SHAPES.applier`), cioè una lista dichiarata
  dall'esterno — ma il finder e gli altri blocchi che portano liste non ce l'hanno.
- **Nel target:** l'header di TOON porta `[N]` accanto alle righe, e il decoder strict rifiuta un numero
  diverso (`packages/toon/src/decode/validation.ts`); il banco dei dati corrotti dimostra che in JSON
  quella troncatura è **impossibile da rilevare** (`benchmarks/README.md`, § *Structural validation datasets*).
- **Proposta:** portare solo il **meccanismo**, non il formato. Il blocco `finder` dichiara la sua lunghezza
  (`findings_count`), e `architect.mjs` la confronta con `value.findings.length` come già fa per l'applier.
  Sedime di atterraggio: `plugins/daiku/skills/finder-prompt/SKILL.md` § *The block you return* (la prosa,
  normativa), `plugins/daiku/schemas/blocks.json` § *finder* (lo specchio), `plugins/daiku/architect/architect.mjs`
  (la regola in `SHAPES.finder`). Costo: basso — una regola, una riga di prosa, una chiave nello specchio, più
  il caso nel banco (la convenzione impone che ogni regola scritta con `rule()` sia vista fallire almeno una
  volta). Il costo da dichiarare è il trade-off: un campo in più è un modo in più di sbagliarlo, e ogni blocco
  `invalid` costa un rilancio; va aggiunto dove il guadagno supera quel costo, non su ogni lista.

## Evidenza

| path nel target | estratto |
|---|---|
| `README.md` | «drop-in, lossless representation of the JSON you already have»; quattro forme; «42,6% fewer tokens» (vs JSON indentato) |
| `SPEC.md` | «The specification lives in toon-format/spec» — lo spec è in un altro repo |
| `packages/toon/src/index.ts` | `encode`, `decode`, `encodeLines`, `decodeStream` — API anche streaming |
| `packages/toon/src/decode/validation.ts` | `assertExpectedCount` … `Expected ${expected} ${itemType}, but got ${actual}` (strict) |
| `packages/toon/src/encode/normalize.ts` | `Date`→ISO, `Map`/`Set`, `bigint`, `-0`→`0`, surrogato spaiato rifiutato |
| `packages/toon/test/decode-security.test.ts` | `keeps direct __proto__ keys as own data properties` |
| `packages/cli/README.md` | `--stats`, `--delimiter`, auto-detect `.json`↔`.toon`, stdin |
| `packages/toon/package.json` | `version 4.1.1`, MIT, runtime senza dipendenze |
| `benchmarks/src/evaluate.ts` | `MODELS`: claude-haiku-4-5, gemini-3.6-flash, gpt-5.4-nano, grok-4.5; `reasoning: 'none'` |
| `benchmarks/src/utils.ts` | `tokenize` = `gpt-tokenizer` `o200k_base`; `wilsonInterval` 95% |
| `benchmarks/README.md` | due binari; cinque dataset di corruzione strutturale; validazione deterministica, nessun giudice LLM |
| `benchmarks/scripts/token-efficiency-benchmark.ts` | separa `mixedStructureDatasets` da `flatOnlyDatasets` (baseline CSV) |
| `docs/guide/llm-prompts.md` | wrap in ` ```toon `; `strict: true`; delimiter `\t` per meno token |
| `docs/reference/spec.md` | §13 conformità, §15 sicurezza, Appendice C banco di conformità — nel repo `spec` |
| `docs/reference/efficiency-formalization.md` | «arrays of arrays … TOON is less efficient»; profondità erode il vantaggio |
| `docs/ecosystem/tools-and-playgrounds.md` | «Tooner – MCP proxy that converts JSON tool responses to TOON» |
| `.github/workflows/ci.yml` | lint, typecheck, test su push/PR (Node 24) |

## Domande aperte

- Lo **spec normativo sta in `toon-format/spec`**, un secondo repository fuori dal target: ho letto l'indice
  in-repo (`docs/reference/spec.md`) e il puntatore in `SPEC.md`, non le §1–§18 né il banco di conformità.
  Un giudizio sulla *conformità* delle implementazioni resta quindi fuori da questa lettura.
- Ho letto `packages/cli/src/json-from-events.ts` solo in parte (è lungo e la coda è meccanica): la parte
  letta mostra il verso TOON→JSON event-per-event, non le opzioni finali della CLI.
- `packages/toon/src/encode/*` e `decode/*` (encoders, parser, scanner, event-builder, raw-string) li ho
  letti per comportamento dedotto dall'API, dalla validazione e dai test, non riga per riga: il giudizio sul
  codice eseguito regge, ma non è una revisione completa dell'implementazione.
- Non ho potuto verificare i numeri dei banchi in modo indipendente: vengono dal repository, misurati con il
  tokenizer di GPT-5 e quattro modelli non tutti con tokenizer comparabili — la stessa avvertenza del README.
