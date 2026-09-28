# Confronto: JuliusBrussee / caveman — primo giro

## 1. Coordinate del repo e data del confronto

- Data del confronto: 2026-09-28
- Repo: JuliusBrussee/caveman
- URL: https://github.com/JuliusBrussee/caveman
- Stelle: 108148
- Ultimo commit: 2026-09-22, SHA 2fd153c (push GitHub 2026-09-28)
- Licenza: Other (MIT + eccezioni BSL-1.1 per engine/proxy/rewriter da verificare)
- Archiviato: no
- Status: incomplete

Questo è il PRIMO giro su questo repo. La cartella `.docs/confronti/` non conteneva questo file: non esistono voci scarta da conservare da giri precedenti. La numerazione MG riparte da quella del giudice.

## 2. Assi girati

Girati tutti e quattro gli assi, ciascuno in contesti separati e con indipendenza intatta:

1. capacità
2. orchestrazione
3. enforcement
4. portabilità

## 3. Verdetti

| Asse | Verdetto | Motivazione breve dal giudice |
|---|---|---|
| capacità | Daiku | Catena di consegna vincolata contro stile di output terse: il risparmio misurato tocca solo l'output e non sposta sessioni dominate dall'input. |
| orchestrazione | Daiku | Brief, handoff, ledger e report intermedi letti da programmi e subagent contro tersezza che rischia ambiguità dove nessun umano legge. |
| enforcement | pari | Fail-closed su pass-through engine e verbs-gate contro guardrail dichiarativi più banchi deterministici: nessuno dei due copre il perimetro dell'altro. |
| portabilità | repo | Proxy e middleware installabili ovunque contro metodo eseguibile su due host con doppi manifest e template. |

Verdetto complessivo, col perimetro: Daiku sul perimetro «lavoro di sviluppo da descrizione a commit dentro vincoli di progetto dichiarati; fuori (puro risparmio token, Q&A brevi, billing per-request) non si applica e caveman può perdere».

Motivazione complessiva del giudice, riportata per intero: Daiku resta la scelta per la consegna vincolata; caveman adottabile max come stile output opzionale in chat, mai negli artefatti. 1) Fasi non lette da umano (brief, handoff, ledger, report intermedi): NO a caveman — letti da programmi/subagent, tersezza rischia ambiguità; caveman stesso prescrive prosa per code/commit/PR e abbandona su ambiguità. 2) Livello massimo: lite (solo no-filler, frasi complete), solo chat libera, mai file persistiti. 3) Risparmio: skill -8.5% solo output (JetBrains 86 task), 0% input + overhead non misurato; sessioni Daiku dominate da input → atteso ~0% totale, possibile negativo; wrap -33.2% solo tool-output benchmark (591673 vs 885793, 18/18 exact, IC 14.6-48.5%, HTML -9.9%) non produzione; Adobe CAVEWOMAN 1.4-2.4x fino 3x solo output, comprimere prompt peggiora. Casi net-negative: #145 overhead su Q&A brevi, #506 billing per-request, #550 Cursor 4.3M vs 1M wall-clock doppio. 4) Installare o copiare: entrambi a copia (caveman-init rule file idempotente --dry-run fenced; Daiku init/sync-host depositano .daiku/ e .codex/); per Daiku basta copiare solo stile terse uso chat opzionale lite, mai proxy/middleware nel loop, mai pipe-to-shell su progetti cliente.

## 4. File letti per intero

Gli elenchi seguenti vengono dai blocchi acquisizione e assi del giudice; skill e codice sono separati dalla documentazione.

### 4.1 Lato repo (~40 file)

Skill e codice:

- 21 skill: caveman, commit, review, compress più script, help, stats, cavecrew, setup, discover, learn, manage, optimize, explore, evidence-review, investigate-first, lean-build, surgical-patch, safe-refactor, migration, verify-and-stop, native-core
- agenti cavecrew
- hook di attivazione più mode-tracker (`src/hooks/caveman-activate.js`, `caveman-mode-tracker.js`)
- plugin opencode
- rewriter (`rewriter/rewriter.go`, `gate.go` con theta=500)
- engine più detect più compressors/json (`engine/engine.go`, fail-closed pass-through)
- proxy `compressRequest`, `compression_query`, `retrieve_tool`
- registry, verbs-gate più compile (`skills/verbs-gate.mjs`, fail closed su superficie vuota)
- CI sync-skill
- manifest
- `bin/install.js` (--dry-run, fenced idempotente)
- proxy `compressRequest` (byte-preserving)

Documentazione:

- README, INSTALL, CONTRIBUTING, SECURITY, ANNOUNCEMENT
- `docs/` più `technical/*`
- `docs/HONEST-NUMBERS.md` (Input reduction skill 0%, overhead non misurato; 65% storico ritirato; #550 4.3M vs 1M)
- `docs/WRAP-BENCHMARK.md` (-33.2% input provider 591673 vs 885793, 18/18, IC 14.6-48.5%)
- evals e browse README

Nota del giudice: discrepanza nel conteggio, 71 contro 59 rimisurati (limitation).

### 4.2 Lato Daiku

- 19 SKILL.md: blueprint, code-review, decision-doc, develop-feature, execute, finder-prompt, init, new-feature, review, sync-host, test-coverage più le restanti
- 2 contratti: `plugins/daiku/contracts/orchestration.md` più `project-contract.md`
- `agents/finder.md`
- hook: command-guard, edit-guard, contracts-post-edit, session-advice, stop-advice, self-check (`hooks/lib/command-guard.mjs` fail-open)
- `architect/architect.mjs` (valutatore deterministico) più `architect/ledger.mjs`
- template: project.json, instructions, domain/*, policies/README, environment.json, codex/hooks.json
- 2 manifest
- README

## 5. Pareri online

Sintesi dai link documentati dal giudice, non riverificati: l'avvertenza è che WebSearch era rotto in sessione, quindi i pareri vengono solo dai link documentati e vanno presi come tali.

- JetBrains — speak-to-ai-agents-like-cavemen-to-save-tokens (-8.5% output su 86 task, motivò il proxy): https://blog.jetbrains.com/ai/2026/07/speak-to-ai-agents-like-cavemen-tosave-tokens/
- HN — thread #1, 904 punti e 366 commenti: https://news.ycombinator.com/item?id=47647455
- Adobe — CAVEWOMAN 1.4-2.4x fino a 3x solo output; comprimere il prompt peggiora: https://arxiv.org/abs/2606.24083
- TheNewStack — critica ai risparmi della skill (link dal README del repo)
- Issue #550 — A/B su Cursor 4.3M contro 1M con wall-clock doppio: https://github.com/JuliusBrussee/caveman/issues/550
- Issue #145 — perdita netta su Q&A brevi (da HONEST-NUMBERS)
- Issue #506 — billing per-request (da HONEST-NUMBERS)

## 6. Censimento

Primo giro: 13 voci totali dal giudice, 13 nuove, 0 conservate, 0 già in Daiku. Nessun confirm_with_owner separato: le voci ispira contengono già le domande aperte.

| ID | Titolo | Asse | Azione | Priorità | Sede | Path |
|---|---|---|---|---|---|---|
| MG-001 | Ipotesi rankate | capacità | scarta | — | — | — |
| MG-002 | Proof set minimo | capacità | scarta | — | — | — |
| MG-003 | Stile terse nelle fasi non lette da umano | capacità | scarta | — | — | — |
| MG-004 | Chaining nominati | orchestrazione | scarta | — | — | — |
| MG-005 | Entry/stop declarative | orchestrazione | scarta | — | — | — |
| MG-007 | Path:line negli handoff | orchestrazione | scarta | — | — | — |
| MG-010 | Tavola provider-discovery | portabilità | scarta | — | — | — |
| MG-011 | Dry-run di init | capacità | adatta | media | skill init | plugins/daiku/skills/init/SKILL.md |
| MG-012 | Nota Windows/PowerShell | portabilità | adatta | media | README | plugins/daiku/README.md |
| MG-006 | Oversize-con-split | orchestrazione | ispira | bassa | orchestration.md o review | plugins/daiku/contracts/orchestration.md |
| MG-008 | Fail-closed su project.json illeggibile | enforcement | ispira | bassa | project-contract | plugins/daiku/contracts/project-contract.md |
| MG-009 | Scansione source-derived dei riferimenti | enforcement | ispira | bassa | self-check | plugins/daiku/hooks/self-check.mjs |
| MG-013 | Integrità della pubblicazione | portabilità | ispira | bassa | nessuna sede oggi | — |

### MG-001 — Ipotesi rankate [scarta]

- Evidenza: meccanismo di ipotesi rankate del repo osservato.
- perché_no: duplicato della revisione scettica di decision-doc fasi 1-3; sede `decision-doc/SKILL.md` con copertura presente.
- Proposta: nessuna.
- Sedi: nessuna.
- Costo: zero.
- Rischio: nessuno.
- Confidenza: high.

### MG-002 — Proof set minimo [scarta]

- Evidenza: meccanismo di proof set minimo del repo osservato.
- perché_no: coperto da blueprint principio 4/7 più execute principio 5 più new-feature sezione 4 sul riuso.
- Proposta: nessuna.
- Sedi: nessuna.
- Costo: zero.
- Rischio: nessuno.
- Confidenza: high.

### MG-003 — Stile terse nelle fasi non lette da umano [scarta]

- Evidenza: `skills/caveman/SKILL.md` (drop di articoli e filler; «Persisted outside chat: write normal prose»); `docs/HONEST-NUMBERS.md` (Input reduction della skill 0%, overhead non misurato).
- perché_no: falso positivo. I contratti Daiku sono input a ogni run e la tersezza risparmierebbe solo output già minimo; caveman stesso vieta il terse sui persistiti e prescrive prosa per code, commit e PR.
- Proposta: nessuna.
- Sedi: nessuna.
- Costo: zero.
- Rischio: nessuno.
- Confidenza: high.

### MG-004 — Chaining nominati [scarta]

- Evidenza: meccanismo di chaining nominato del repo osservato.
- perché_no: coperto da tabella topologia più regole di delega e concorrenza; vige reference-never-copy.
- Proposta: nessuna.
- Sedi: nessuna.
- Costo: zero.
- Rischio: nessuno.
- Confidenza: high.

### MG-005 — Entry/stop declarative [scarta]

- Evidenza: voci entry/stop declarative del repo osservate.
- perché_no: duplicherebbe nodi contro la cut rule.
- Proposta: nessuna.
- Sedi: nessuna.
- Costo: zero.
- Rischio: nessuno.
- Confidenza: media.

### MG-007 — Path:line negli handoff [scarta]

- Evidenza: formato path:line negli handoff del repo osservato.
- perché_no: coperto — file:line in 0.problem, path:line via git grep nel brief, Considerations ancorate; stato-by-path.
- Proposta: nessuna.
- Sedi: nessuna.
- Costo: zero.
- Rischio: nessuno.
- Confidenza: high.

### MG-010 — Tavola provider-discovery [scarta]

- Evidenza: tavola di provider-discovery del repo osservata.
- perché_no: nessun valore — due host più backend per nome, nessun parco da scoprire.
- Proposta: nessuna.
- Sedi: nessuna.
- Costo: zero.
- Rischio: nessuno.
- Confidenza: media.

### MG-011 — Dry-run di init

- Evidenza: `bin/install.js` del repo (--dry-run, fenced idempotente: rule file idempotente con anteprima).
- Proposta: adattare un dry-run in init — anteprima would-write/would-leave/to-fill-in con lo stesso percorso decisionale della scrittura, senza fenced.
- Sedi, col perché: `plugins/daiku/skills/init/SKILL.md`, perché è la sede dove init decide cosa scrivere e l'anteprima deve seguire le stesse decisioni senza duplicarle.
- su_codex: sì, testo di skill, vale su entrambi gli host.
- Costo: medio.
- Rischio: divergenza fra anteprima e scrittura.
- Confidenza: media.
- Priorità: media.

### MG-012 — Nota Windows/PowerShell

- Evidenza: assenza in Daiku di una nota sulle shell supportate, emersa dal confronto col repo.
- Proposta: adattare una nota su shell supportate, path con `/` ed env del backend.
- Sedi, col perché: `plugins/daiku/README.md` in inglese, perché è la porta d'ingresso del pacchetto e la nota serve a chi installa prima ancora di aprire una skill.
- su_codex: sì, nota di README, valida per entrambi gli host.
- Costo: basso.
- Rischio: nullo.
- Confidenza: high.
- Priorità: media.

### MG-006 — Oversize-con-split

- Evidenza: meccanismo di oversize-con-split del repo osservato.
- Proposta: ispirare, non adattare: valutare dove spezzare un lavoro oversize senza rompere ledger e blindness.
- Sedi, col perché: `orchestration.md` (sezioni Depth e degradation) o review Scope, perché solo lì si decide quanto può crescere un passo prima di degradare.
- Domanda aperta: quale misura definisce oversize, dove spezzare, chi decide senza rompere ledger e blindness.
- su_codex: sì, regola di metodo da testo.
- Costo: medio.
- Rischio: alto se fatto male.
- Confidenza: low.
- Priorità: bassa.

### MG-008 — Fail-closed su project.json illeggibile

- Evidenza: `engine/engine.go` del repo (fail-closed pass-through) contro `hooks/lib/command-guard.mjs` di Daiku (fail-open).
- Proposta: ispirare, non adattare: valutare quali illegibilità di project.json fermano il run e quali degradano.
- Sedi, col perché: `project-contract.md` sezione 6, perché è la sede che definisce cosa il progetto dichiara e cosa succede quando manca.
- Domanda aperta: quali illegibilità fermano contro quali degradano, senza ribaltare la direzione «incompleto fa di meno».
- su_codex: sì, regola di contratto da testo.
- Costo: medio.
- Rischio: alto.
- Confidenza: media.
- Priorità: bassa (non assegnata dal giudice, default delle ispira).

### MG-009 — Scansione source-derived dei riferimenti

- Evidenza: `rewriter/rewriter.go` più `gate.go` (theta=500, non riverificato) e `skills/verbs-gate.mjs` (fail closed su superficie vuota) del repo; superfici Daiku da GRAPH, topologia e `schemas/blocks.json`.
- Proposta: ispirare, non adattare: valutare una scansione dei riferimenti source-derived come banco della macchina di sviluppo.
- Sedi, col perché: `self-check.mjs` come banco della macchina di sviluppo, perché il controllo gira prima del rilascio e non nel progetto utente.
- Domanda aperta: perimetro da decidere — superfici da GRAPH, topologia e blocks.json; fail-closed solo sui code span.
- su_codex: nota Codex — il banco gira sulla macchina di sviluppo, nulla atterra nel progetto; nessun atterraggio agente o hook su Codex.
- Costo: alto.
- Rischio: falsi positivi sulla prosa.
- Confidenza: media.
- Priorità: bassa (non assegnata dal giudice, default delle ispira).

### MG-013 — Integrità della pubblicazione

- Evidenza: assenza in Daiku di una sede per l'integrità della pubblicazione, emersa dal confronto col repo.
- Proposta: ispirare, non adattare: pin della release immutabile più hash quando lo script di pubblicazione esisterà.
- Sedi, col perché: nessuna sede oggi — lo script di pubblicazione è inesistente; la sede nascerà con lo script.
- Domanda aperta: disegno del pin e dell'hash rimandato all'attrezzatura della pubblicazione.
- su_codex: non applicabile.
- Costo: medio.
- Rischio: basso come disegno futuro.
- Confidenza: media.
- Priorità: bassa (non assegnata dal giudice, default delle ispira).

## 7. Limitations del giudice

1. Hook config, parse e stats non letti.
2. `caveman-init.js` e MCP non letti.
3. `agents/*.mjs` non letti.
4. Resto della CLI oltre head non letto.
5. 14/15 compressori, pixel, contextwindow, rewriter gate+provider non letti.
6. Proxy e providers oltre head non letti.
7. mem, shrink, browse, extension, agent-sdk-middleware non letti.
8. Benchmark, evals e tests non letti.
9. Wiki e tutorial esterni non verificati.
10. WebSearch rotto: pareri online non riverificati, solo da link documentati.
11. Theta=500 e sync byte-identico non riverificati.
12. Conteggio file controverso: 71 contro 59 rimisurati.
13. Tre principi verbatim non ritrovati.
14. README di caveman letto solo in parziale.
15. Clone al 2026-09-22 contro push del 2026-09-28: delta non ispezionato.
16. Licenza da testa: MIT più BSL da verificare.
17. Commit, ledger e check-topology di Daiku non riletti in sessione.
