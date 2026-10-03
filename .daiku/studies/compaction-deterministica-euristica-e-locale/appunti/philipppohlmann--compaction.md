# philipppohlmann/compaction — layer locale di ottimizzazione dei token per Claude Code, Codex e Cursor: gateway trasparente, shaping dell'output prima della generazione e ricevute content-free con recupero byte-esatto

- **URL:** https://github.com/philipppohlmann/compaction
- **Licenza:** Apache-2.0
- **Ultimo commit:** 2026-09-27
- **Stelle:** 1
- **Archivio:** no
- **Letto via:** api

## Cosa fa, e come lo fa

Un pacchetto npm (`@compaction/cli`, `package.json`, TypeScript, voce `bin: compaction`) che si mette **sotto** Claude Code, Codex e Cursor e riduce i token che raggiungono il provider, senza un editor nuovo né un modello ospitato in mezzo. Tre gesti lo legano all'host: gli **hook nativi** del tool, un **gateway locale** (proxy su `127.0.0.1`) e, per Codex e Cursor, uno **shim sul PATH** che esegue il binario vero in modo trasparente (`src/core/tool-shim.ts`: «a "connected/active" claim may rest ONLY on a resolve-check, never on the mere act of writing a file»). Due leve distinte e con etichette diverse: la **riduzione dell'output** è deterministica e attiva di default, la **riduzione dell'input** è «explicit and gated» e richiede un account gratuito più il motore adattivo consegnato a parte.

Le due leve vivono in punti diversi della catena. Lo **shaping dell'output** è un blocco di istruzioni content-free (niente prompt, niente codice) che viene agganciato **prima** della generazione (`src/core/output-shaping.ts`: politiche `concise_response`, `verbosity_budget`, `structured_output_constraints`, `redundant_chatter_suppression`, più `safe_tool_output_filtering` spenta di default), versionato con lo sha256 dei byte esatti (`outputShapingPolicyVersion`) e riconosciuto da una costante condivisa per non agganciarlo due volte (`OUTPUT_SHAPING_POLICY_MARKER`). La **riduzione dell'input** passa invece dal gateway/native hook: il corpo della richiesta viene validato forma per forma (`src/core/gateway/request-shape.ts`), e solo le forme riconosciute sono candidate — le altre «fail closed» e passano identiche.

Lo stato vive **in locale**. Il gateway conserva la richiesta originale di ogni mutazione sotto `.compaction/gateway/recovery/` nella cartella di lavoro, con permessi `0600`/`0700` e un `.compaction/.gitignore` che si scrive da sé (una riga `*`) la prima volta, perché quel contenuto non finisca mai in un commit dell'utente (`src/core/gateway/recovery.ts`); `compaction gateway recover`, con l'id della ricevuta, la restituisce byte per byte. Ogni mutazione è governata da una **boundary a sette cancelli** in ordine (`src/core/gateway/lcm-apply-boundary.ts`: `class-qualified`, `authorization-active`, `scope-match`, `source-grounded-candidate`, `content-free-evidence`, `candidate-body-present`, `original-retainable`), l'ultimo dei quali impone che l'originale sia **già stato trattenuto** prima di proporre una mutazione: «an application without a retained original never happens». Qualsiasi assenza, rifiuto, timeout o errore è **fail-open**: la richiesta originale viene inoltrata intatta.

Il progetto è **open-core e lo dichiara**: il motore adattivo vive in `src/engine/**`, consegnato come artefatto firmato fuori da npm, raggiunto solo con `import()` dinamico dietro una seam; `scripts/engine-boundary-check.mjs` (`npm run boundary:engine`) prova sul compilato che il grafo statico della CLI non tocchi `dist/engine/**` e che ogni modulo staticamente raggiunto **sia nel packlist** («an excluded STATIC dependency fails at module LOAD, before any degrade can run»). La misura è onesta per costruzione: le etichette (`local-estimate` chars/4, `provider-reported`, `token-estimated-cost`, `billing-confirmed`, `unknown`) sono una scala dichiarata (`docs/api/compaction-api-v0.md`, `evals/README.md`), e «If Compaction cannot support a number with evidence, it is shown `N/A`». Nessun contenuto lascia la macchina (`CONTRIBUTING.md`: «no feature may send trace content anywhere by default»), e la CLI deve «degrade honestly (clear message, non-zero exit where appropriate) — never fake a result».

## Asse A — Daiku lo fa già, e loro lo fanno meglio?

### A1 — Controllo deterministico sulla veridicità della prosa esposta

- **In Daiku oggi:** la verifica della prosa è affidata a un giudizio, non a un controllo: `.claude/commands/rilascia-daiku.md` § *3. La prosa: note AI in inglese* e § *4* dicono che changelog e voce di rilascio «li giudichi tu». Il prodotto ha un intero corpus di prosa inglese (`plugins/daiku/skills/*/SKILL.md`, `plugins/README.md`) e nessun controllo che fallisca se una frase promette più di quanto il pacchetto fa.
- **Nel target:** due suite di test fanno da guardia alla copy, non alla prosa: `evals/README.md` le chiama «Claims guards» (`tests/security/open-basic-engine-free.test.ts`, `tests/cli/watch-tier-label-provenance.test.ts`) e `CONTRIBUTING.md` le prescrive: «Do not expand capability or savings language in user-facing output or docs — that requires maintainer review. Run `npm test -- tests/security/... tests/cli/watch-tier-label-provenance.test.ts` when changing user-facing CLI copy». È un test che **fallisce** quando la prosa si allarga, dove Daiku ha un passaggio a giudizio.
- **Chi vince:** target
- **Proposta:** portare un **controllo deterministico** che fallisca su linguaggio di capacità/risparmio non ammesso nei file di prodotto in inglese, agganciato al gate di rilascio. Atterra in un `.mjs` sotto `.docs/tools/` accanto a `check-marketplace.mjs` (stessa forma: totale contato, uscita `1` al primo rosso, banco proprio), invocato da `/rilascia-daiku` prima della pubblicazione; eventualmente riusa `plugins/daiku/hooks/lib/contracts-post-edit.mjs`, che già sorveglia il corpus dopo una scrittura, come seconda sede di avviso. Costo basso: una lista di forme vietate e il banco. È l'unico punto in cui il target batte Daiku sull'asse A, ed è un punto che Daiku stesso rivendica (CLAUDE.md, § *Mai fidarsi di un LLM*).

### A2 — Installazione dello strato host: idempotente e non distruttiva

- **In Daiku oggi:** `plugins/daiku/skills/sync-host/SKILL.md` porta i hook e i ruoli in `.codex/`; è «relaunchable by design», entra nel `hooks.json` esistente **partizionando per `command`** (le voci che puntano dentro `.codex/hooks/` sono sue e le sostituisce, tutte le altre restano), **rimuove** i `.mjs` e i `.toml` che il pacchetto non porta più, e riporta per ogni file se era assente, identico o diverso. Non fa backup perché non riscrive mai contenuto altrui.
- **Nel target:** `src/cli/commands/hooks.ts` offre `hooks install|uninstall|status`, con `--dry-run` che non scrive, e il suo docblock dichiara: «MERGES (never replaces) existing settings, is idempotent, supports `--dry-run` (writes nothing), backs up before writing the Codex/Cursor config, and only ever removes Compaction's own hook on uninstall».
- **Chi vince:** daiku
- **Proposta:** niente, vince Daiku. Daiku è più conservativo (partizione invece di backup-poi-riscrittura, rimozione degli orfani, resoconto per file) e non espone `uninstall` perché togliere la guardia non è un obiettivo. Il solo elemento assente è un `status` read-only, ma `sync-host` già riporta copiato/rimosso/hookato/ruoli: non vale un comando nuovo.

### A3 — Contabilità dei costi con la regola "solo ciò che l'host ha riportato"

- **In Daiku oggi:** `plugins/daiku/architect/ledger.mjs` (`costFaults`) ammette per ogni round una voce di costo `{ step, tokens, tool_uses, seconds }` e la valida con la regola scritta nel codice: «an entry exists only for what the host reported» — nessuna stima, nessun campo fuori elenco, nessun numero negativo. La prosa in `plugins/daiku/skills/review/SKILL.md` § *ledger* la rispecchia.
- **Nel target:** `src/core/gateway/receipt-line.ts` e `src/core/gateway/receipt.ts` costruiscono per ogni turno una ricevuta content-free con i conteggi e la loro **fonte**; la scala delle etichette (`local-estimate` / `provider-reported` / `token-estimated-cost` / `billing-confirmed` / `unknown`) è dichiarata in README § *Methodology* e in `docs/api/compaction-api-v0.md`, e il valore mancante resta `N/A` invece di essere inferito.
- **Chi vince:** pari
- **Proposta:** niente. La regola di Daiku è **più stretta** di quella del target: Daiku non ammette affatto un numero stimato, il target ammette stime purché etichettate. Il target copre una superficie più larga (ogni turno, con etichette di fonte), ma è esattamente la superficie che Daiku non ha: mutando nulla nelle richieste, non produce numeri da etichettare. L'asse A qui conferma la scelta di Daiku, non ne propone una nuova.

## Asse B — Daiku non lo fa, e si potrebbe aggiungere?

### B1 — Shaping dell'output: istruzione di concisione prima della generazione

- **Capacità:** Daiku governa *cosa* fanno e *cosa* restituiscono gli agenti (i blocchi di ritorno dei contratti), non *quanto* scrivono. I suoi subagent e la conversazione possono produrre prosa lunga senza che nulla la moderi, e Daiku non ha alcun meccanismo deterministico che riduca i token di **output** del modello.
- **Nel target:** `src/core/output-shaping.ts` costruisce un blocco di istruzioni content-free agganciato **prima** della generazione (unico punto che può ridurre i token di output, perché il post-processing non li riduce), con politiche esplicite — «Answer concisely: omit preamble and restatement», «Skip boilerplate, apologies, and repetition», «Prefer a tight structured format». Il blocco è neutralizzato se già presente (`OUTPUT_SHAPING_POLICY_MARKER`) e versionato per hash, così una calibrazione vecchia non si applica a un testo nuovo.
- **Proposta:** un hook che agganci un blocco di istruzioni di concisione all'inizio di un turno, con la stessa cautela del target: marker per non agganciarlo due volte, e limite esplicito a **non** toccare i blocchi di ritorno (che sono contratto e devono restare completi). Atterra come nuovo `.mjs` in `plugins/daiku/hooks/lib/` più la sua voce in `hooks/hooks.json`, e come scheletro di policy in `plugins/daiku/templates/project/policies/README.md` (dove vive già la regola per progetto); su Codex `sync-host` lo copia come gli altri. Costo medio — un hook nuovo vuole il banco (`hooks/self-check.mjs`), perché un hook rotto e uno silenzioso sono indistinguibili. È l'unica leva di riduzione token che a Daiku resta, dato che sull'input ha già scelto di passare **path** e non trascrizioni (§4 di `contracts/orchestration.md`).

### B2 — Un terzo host: Cursor a livello di sessione

- **Capacità:** Daiku dichiara due host, Claude Code e Codex (`contracts/orchestration.md` §7, `{hosts}`); non ha alcun supporto per Cursor, che il target copre come terzo host.
- **Nel target:** la tabella *Supported tools* del README elenca Cursor con «session-level instruction» per la riduzione dell'output, e `src/core/tool-shim.ts` installa per esso uno shim su PATH (`cursor-agent`) che agisce solo sulla forma batch misurabile e lascia passare intatto ogni altro invocazione, dichiarandola non misurata invece di fingersi attivo.
- **Proposta:** aggiungere Cursor come host dichiarato, al livello più basso che il target stesso mostra (istruzione a livello di sessione, nessun hook nativo): una voce in `{hosts}` dello scheletro `plugins/daiku/templates/project/environment.json` e di `contracts/orchestration.md`, più le sedi che ne dipendono (`plugins/daiku/skills/init/SKILL.md` per il rilevamento, `sync-host` per lo strato). Costo alto: tocca lo scheletro di un contratto e tre skill, e va verificato cosa Cursor accetta davvero — cosa che qui non è stata provata. È più una scelta di prodotto che un meccanismo, e va decisa dall'owner.

### B3 — Ricevuta d'uso per l'intera consegna, content-free

- **Capacità:** Daiku registra il costo (`tokens`, `tool_uses`, `seconds`) **solo dentro i round di `/review`**, nel ledger. Le fasi di una consegna fuori dalla review — investigazione, `decision-doc`, `blueprint`, `execute` — non lasciano alcun conteggio, e non esiste una vista d'insieme del costo di una feature.
- **Nel target:** ogni turno misurabile produce una ricevuta content-free (conteggi, etichette strutturali, un breve id; mai prompt né codice), esposta inline nel workflow dove l'host lo consente — status line su Claude Code, hook post-turno su Codex — con viste storiche (`compaction activity`) e live (`compaction watch`) e la regola «we only show a number when it has evidence for it».
- **Proposta:** un hook `Stop` (e `SessionStart` per la ripresa) che legga dal transcript dell'host i conteggi riportati e li depositi in un ledger di consegna, più un aggregatore in `plugins/daiku/architect/` accanto a `ledger.mjs`, con lo stesso divieto già in vigore («un numero esiste solo se l'host l'ha riportato»). Atterra in `plugins/daiku/hooks/lib/` + `plugins/daiku/architect/`, con la sede su disco fuori dal progetto (scratch di sessione o temp). Costo medio-alto: legge il formato del transcript dell'host e vive solo su Claude Code (su Codex i hook di pacchetto non partono). Estende un'idea che Daiku già possiede — il costo per round — a tutta la catena.

## Evidenza

| path nel target | estratto |
|---|---|
| README.md | «Code blocks, commands, file paths, flags, and `file:line` references are locked byte-exact» |
| README.md | «The original request behind every mutated call is retained locally and can be restored byte-for-byte with: `compaction gateway recover`» |
| README.md | «If Compaction cannot support a number with evidence, it is shown `N/A`» |
| README.md | «input 8,388,356→7,212,095 (−14%) · output 14,393→10,795 (−25%, est.) · +~3.08m · full apply» |
| CONTRIBUTING.md | «the CLI must degrade honestly (clear message, non-zero exit where appropriate) — never fake a result» |
| CONTRIBUTING.md | «no feature may send trace content anywhere by default» |
| evals/README.md | «Claims guards ... Proves: public Open/basic and receipt-line surfaces retain their evidence labels» |
| evals/gates.md | due gate indipendenti (context-preservation, short-but-sufficient); provider-reported vs local-estimate |
| src/core/output-shaping.ts | politiche concise_response / verbosity_budget / structured_output_constraints; `OUTPUT_SHAPING_POLICY_MARKER`; `outputShapingPolicyVersion` = sha256 |
| src/core/gateway/recovery.ts | `0600`/`0700`; `ensureRecoveryDirIgnored` scrive `.compaction/.gitignore` con `*`; «no saved original ⇒ do not mutate» |
| src/core/gateway/lcm-apply-boundary.ts | sette cancelli in ordine; «an application without a retained original never happens»; fail-open su ogni errore |
| src/core/tool-shim.ts | «a "connected/active" claim may rest ONLY on a resolve-check, never on the mere act of writing a file» |
| src/core/skill-injection-detector.ts | «REPORT-ONLY ... It compacts NOTHING»; chiave di dedup exact-key per skill |
| src/core/before-call.ts | `MIN_DUPLICATE_BLOCK_CHARS = 40`; dedup di blocchi esatti, local-estimate, mai una mutazione silenziosa |
| src/cli/commands/hooks.ts | «MERGES (never replaces) ... is idempotent ... `--dry-run` (writes nothing) ... only ever removes Compaction's own hook on uninstall» |
| scripts/engine-boundary-check.mjs | «everything the CLI's static graph reaches is actually IN the packlist»; `npm run boundary:engine` |
| package.json | `files` esclude `dist/engine/**`, `dist/core/compactor.*`, `dist/core/policy-middleware.*`; bin `compaction`; Apache-2.0 |
| docs/api/compaction-api-v0.md | scala delle etichette; «NOT a savings claim»; nessun upload di contenuto senza consenso |

## Domande aperte

- Il **motore adattivo** — la parte che fa la compaction dell'input ed è il cuore della proposta — non è in questo albero: vive in `src/engine/**`, consegnato a parte come artefatto firmato, raggiunto solo via `import()` dinamico. Il giudizio su come riduce l'input poggia sulla boundary pubblica (`lcm-apply-boundary.ts`), sui documenti e sulla quota open-core, non sul motore.
- `src/cli/commands/init.ts` (151 KB), `src/core/tool-shim.ts` (46 KB), `src/cli/commands/hooks.ts` (25 KB), `src/core/gateway/server.ts` (148 KB) e le suite `tests/**` sono stati letti in parte (testate e sezioni), non riga per riga: un difetto interno a quei file non sarebbe emerso.
- Niente è stato eseguito né installato: le cifre di risparmio del README (`−14%` input, `−25%` output stimato) sono dichiarazioni del target, non verificate qui. Le stesse cifre portano l'etichetta `est.` per l'output e la scala `billing-confirmed` resta riservata.
- La copertura di **Cursor** è dichiarata «session-level instruction» e «input reduction ... not available on the current integration»: non è provato cosa Cursor accetti davvero, e B2 poggia su quella riga.
- Il target non porta `AGENTS.md` né `CLAUDE.md` nell'albero: non c'è un file di istruzioni che un agente, entrando, obbedirebbe. Nessun ordine è stato letto ed eseguito.
