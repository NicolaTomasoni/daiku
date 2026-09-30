# Confronto: WorldFlowAI / everything-claude-code — primo giro

## 1. Coordinate del repo e data del confronto

- Data del confronto: 2026-09-26
- Repo: WorldFlowAI/everything-claude-code
- URL: https://github.com/WorldFlowAI/everything-claude-code
- Stelle: 3625
- Ultimo commit: 2026-01-23, SHA 432485ba
- Licenza: non dichiarata
- Archiviato: no
- Linguaggio prevalente: JS

Nota sui tempi: pushedAt di GitHub risulta 2026-01-23, mentre updatedAt restituito dalla search risulta 2026-09-26. La differenza è attività sulle issue, non push di codice. Il repo è un fork WorldFlowAI di affaan-m; il badge upstream non è stato risolto offline.

Questo è il PRIMO giro su questo repo. La cartella `.docs/confronti/` era vuota: non esistono voci scarta da conservare da giri precedenti. La numerazione MG riparte da quella del giudice.

## 2. Assi girati

Girati tutti e quattro gli assi, ciascuno con `coverage_complete: true`, in contesti separati e con indipendenza intatta:

1. capacità
2. orchestrazione
3. enforcement
4. portabilità

## 3. Verdetti

| Asse | Verdetto | Motivazione breve dal giudice |
|---|---|---|
| capacità | Daiku | Catena idea-commit con ruoli e handoff espliciti contro raccolta di skill e comandi giustapposti; la review misurata su disco resta il discrimine. |
| orchestrazione | Daiku, con conferma umana pari | Daiku vince per brief, Journal e ledger che rendono la catena ripresa e verificabile; la conferma umana è pari fra i due. |
| enforcement | Daiku | Guardrail negati solo su dichiarazione del progetto più banchi deterministici (self-check, valutatore, ledger) contro hook fail-open e controlli convenzionali. |
| portabilità | Daiku, con docs d'uso al repo | Daiku vince per metodo eseguibile su due host con doppi manifest e template; le docs d'uso vanno al repo confrontato. |

Verdetto complessivo, col perimetro: sul perimetro «metodo di consegna idea-commit con review misurata, eseguibile su due host», Daiku vince 4 assi su 4, con due pareggi parziali interni: conferma umana pari in orchestrazione e docs d'uso al repo in portabilità.

## 4. File letti per intero

### 4.1 Lato repo (clone, 81 file)

Skill e codice:

- 11 SKILL: verification-loop, continuous-learning, strategic-compact, eval-harness, tdd-workflow, security-review, coding-standards, backend-patterns, frontend-patterns, clickhouse-io, project-guidelines-example
- 14 comandi dichiarati dagli assi, 15 trovati nel clone e letti: orchestrate, plan, tdd, e2e, verify, checkpoint, learn, eval, build-fix, code-review, refactor-clean, setup-pm, test-coverage, update-codemaps, update-docs. Uno in più di quanto gli assi dichiaravano: il conteggio corretto è 15, non 14.
- 9 agenti: planner, architect, tdd-guide, code-reviewer, security-reviewer, build-error-resolver, e2e-runner, refactor-cleaner, doc-updater
- hooks.json più script in scripts/hooks/*.js più lib
- test: run-all, utils, package-manager, hooks

Documentazione:

- README.md, WORLDFLOWAI.md, CONTRIBUTING.md, plugins/README.md
- examples/CLAUDE.md, user-CLAUDE.md
- sessions/*.tmp, rules/*.md, contexts/*.md, mcp-servers.json

### 4.2 Lato Daiku (70 file, inventario §3)

- 18 skill
- contracts/orchestration.md più project-contract.md
- agents/finder.md
- 4 hook lib più self-check
- architect.mjs più ledger.mjs
- template
- doppi manifest
- README di 193 righe più orchestration, riletti dagli assi. In orchestrazione la review SKILL è stata letta righe 1-130/318 e new-feature 1-120/208 in lettura parziale; il giudice ha compensato con rilettura integrale di review e grep package-wide.

### 4.3 Correzioni del giudice da conservare

- I tre principi e la sezione modello mentale NON esistono in nessun file Daiku: la skill li presupponeva nel README, ma non ci sono.
- test-strategy.md esiste già come ruolo facoltativo del template domain: non è un buco, è già coperto come slot facoltativo.

## 5. Pareri online

- Issue #6 — 11 comandi più 3 skill senza frontmatter risultano invisibili: https://github.com/WorldFlowAI/everything-claude-code/issues/6
- Issue #13 — warning su hooks.json per chiavi sconosciute: https://github.com/WorldFlowAI/everything-claude-code/issues/13
- Issue #3 — loop-design-check assente, problemi di parsing YAML: https://github.com/WorldFlowAI/everything-claude-code/issues/3
- Issue #12 — OrcaRouter chiesto, non verificato localmente: https://github.com/WorldFlowAI/everything-claude-code/issues/12
- Issue #9 — supporto cross-platform chiesto: https://github.com/WorldFlowAI/everything-claude-code/issues/9

## 6. Censimento

Primo giro: 13 voci totali dal giudice, 13 nuove, 0 conservate, 0 già in Daiku.

| ID | Titolo | Asse | Azione | Priorità | Sede | Path |
|---|---|---|---|---|---|---|
| MG-001 | Journey E2E con quarantena flaky | capacità | adatta | media | skill test-coverage | plugins/daiku/skills/test-coverage/SKILL.md |
| MG-002 | Classi di sicurezza in code-review | enforcement | adatta | media | skill code-review | plugins/daiku/skills/code-review/SKILL.md |
| MG-003 | Dead-code in skill più orchestration più architect.mjs | capacità | adatta | bassa | skill più orchestration più valutatore | plugins/daiku/skills/*, plugins/daiku/contracts/orchestration.md, plugins/daiku/architect/architect.mjs |
| MG-004 | Mappe codice | orchestrazione | ispira | bassa | memoria | .docs/memory/ |
| MG-005 | Quando compattare execute più ship-feature | orchestrazione | adatta | bassa | skill execute e ship-feature | plugins/daiku/skills/execute/SKILL.md, plugins/daiku/skills/ship-feature/SKILL.md |
| MG-006 | Igiene sorgente report-only in contracts-post-edit più policies | enforcement | adatta | media | contracts-post-edit più policies | plugins/daiku/contracts/post-edit.md, plugins/daiku/templates/policies/ |
| MG-007 | Avviso ledger aperti in stop-advice più review più template Codex | orchestrazione | adatta | bassa | hook stop-advice più skill review più template Codex | plugins/daiku/hooks/stop-advice.mjs, plugins/daiku/skills/review/SKILL.md, plugins/daiku/templates/codex/ |
| MG-008 | Banco chiavi ignote in self-check più template Codex | enforcement | adatta | media | self-check più template Codex | plugins/daiku/hooks/self-check.mjs, plugins/daiku/templates/codex/ |
| MG-009 | Checkpoint | orchestrazione | scarta | — | — | — |
| MG-010 | Learn dei pattern | orchestrazione | scarta | — | — | — |
| MG-011 | Riporto parametri di init | capacità | scarta | — | — | — |
| MG-012 | Rotte del README | portabilità | scarta | — | — | — |
| MG-013 | Catalogo backend | capacità | scarta | — | — | — |

### MG-001 — Journey E2E con quarantena flaky

- Evidenza: comandi `e2e` e `test-coverage` del clone, in `commands/e2e.md` e `commands/test-coverage.md`; estratto: journey end-to-end con marcatura dei test instabili da mettere in quarantena invece di bloccare la catena.
- Proposta: adattare la journey E2E con quarantena dei flaky nella skill test-coverage di Daiku.
- Sedi, col perché: `plugins/daiku/skills/test-coverage/SKILL.md`, perché è la sede dove Daiku misura la copertura e chiede le prove; la quarantena è una regola di quella misura, non un nuovo entry point.
- su_codex: sì, la regola di quarantena vale su entrambi gli host perché sta nella skill, non nell'hook.
- Costo: medio.
- Rischio: basso; la quarantena non allenta il gate, lo rende ripetibile.
- Confidenza: media.

### MG-002 — Classi di sicurezza in code-review

- Evidenza: skill `security-review` e comando `code-review` del clone, in `skills/security-review/SKILL.md`; estratto: elenco di classi di vulnerabilità da cercare in review.
- Proposta: adattare le classi di sicurezza dentro la skill code-review di Daiku.
- Sedi, col perché: `plugins/daiku/skills/code-review/SKILL.md`, perché Daiku cerca difetti introdotti dal diff e le classi sono il checklist di quella ricerca.
- su_codex: sì, testo di skill, eseguibile su entrambi gli host.
- Costo: basso.
- Rischio: basso.
- Confidenza: high.

### MG-003 — Dead-code in skill più orchestration più architect.mjs

- Evidenza: comando `refactor-clean` e agente `refactor-cleaner` del clone; estratto: passaggio di pulizia del codice morto a fine catena.
- Proposta: adattare la pulizia del dead-code su tre sedi: skill, orchestration e valutatore deterministico.
- Sedi, col perché: skill interessata più `plugins/daiku/contracts/orchestration.md` (dove sta l'ordine della catena) più `plugins/daiku/architect/architect.mjs` (che possiede quell'ordine e lo valuta), perché il divieto senza sede deterministica non esiste.
- su_codex: sì per la parte skill e orchestration; il valutatore gira comunque prima del rilascio.
- Costo: alto.
- Rischio: medio; toccare il valutatore richiede banco verde.
- Confidenza: media.

### MG-004 — Mappe codice

- Evidenza: comando `update-codemaps` del clone; estratto: rigenerazione delle mappe del codice a corredo del repo.
- Proposta: ispirare, non adattare: valutare se le mappe servono alla ricognizione.
- Sedi, col perché: `.docs/memory/` come appunto da studiare, perché non è ancora una regola di prodotto ma un'idea.
- su_codex: non applicabile.
- Costo: basso come studio.
- Rischio: basso.
- Confidenza: media.

### MG-005 — Quando compattare execute più ship-feature

- Evidenza: skill `strategic-compact` del clone; estratto: regola su quando compattare il contesto a metà catena.
- Proposta: adattare il «quando compattare» in execute più ship-feature.
- Sedi, col perché: `plugins/daiku/skills/execute/SKILL.md` e `plugins/daiku/skills/ship-feature/SKILL.md`, perché la compattazione interrompe la catena e solo quelle due sedi sanno dove è sicuro farlo.
- su_codex: sì, regola di metodo.
- Costo: basso.
- Rischio: basso.
- Confidenza: high.

### MG-006 — Igiene sorgente report-only in contracts-post-edit più policies

- Evidenza: hook e script in `scripts/hooks/*.js` del clone; estratto: controlli di igiene del sorgente che segnalano senza bloccare.
- Proposta: adattare l'igiene sorgente come report-only in contracts-post-edit più policies.
- Sedi, col perché: contratto post-edit più template delle policies, perché i guardrail Daiku nascono spenti e negano solo ciò che il progetto dichiara: un controllo globale bloccante violerebbe quella regola, uno report-only la rispetta.
- su_codex: da verificare in sede di adozione, perché su Codex gli hook vivono fuori pacchetto.
- Costo: medio.
- Rischio: basso come report-only.
- Confidenza: media.

### MG-007 — Avviso ledger aperti in stop-advice più review più template Codex

- Evidenza: assenza nel clone di un avviso sui rilievi ancora aperti a fine ciclo; la review Daiku chiude invece con ledger dei rilievi già giudicati.
- Proposta: adattare un avviso sui ledger aperti in stop-advice più review più template Codex.
- Sedi, col perché: `plugins/daiku/hooks/stop-advice.mjs` (avviso deterministico) più `plugins/daiku/skills/review/SKILL.md` (testo che lo spiega) più template Codex (dove l'hook non viaggia col pacchetto), perché il divieto vive in due sedi: testo e controllo.
- su_codex: sì, ed è proprio il template Codex a renderlo efficace lì.
- Costo: basso.
- Rischio: basso.
- Confidenza: media.

### MG-008 — Banco chiavi ignote in self-check più template Codex

- Evidenza: issue #13 del clone, warning su hooks.json per chiavi sconosciute; in Daiku manca il banco corrispondente.
- Proposta: adattare un banco chiavi ignote nel self-check più template Codex.
- Sedi, col perché: `plugins/daiku/hooks/self-check.mjs` (banco deterministico) più template Codex, perché su Codex il manifest degli hook sta fuori pacchetto e il controllo deve coprire anche quella copia.
- su_codex: sì, esplicitamente.
- Costo: medio.
- Rischio: basso.
- Confidenza: media.

### MG-009 — Checkpoint [scarta]

- Evidenza: comando `checkpoint` del clone.
- perché_no: coperto da brief più Journal più ledger di Daiku; importarlo duplicherebbe tre meccanismi esistenti.
- Proposta: nessuna.
- Sedi: nessuna.
- Costo: zero.
- Rischio: nessuno.
- Confidenza: high.

### MG-010 — Learn dei pattern [scarta]

- Evidenza: comando `learn` e skill `continuous-learning` del clone.
- perché_no: coperto da update-memory di Daiku; un secondo canale di apprendimento creerebbe due memorie in concorrenza.
- Proposta: nessuna.
- Sedi: nessuna.
- Costo: zero.
- Rischio: nessuno.
- Confidenza: high.

### MG-011 — Riporto parametri di init [scarta]

- Evidenza: flussi di init del clone che riportano i parametri raccolti.
- perché_no: coperto da outcome più «To fill in» di init Daiku; il riporto esiste già nella forma del file di istruzioni.
- Proposta: nessuna.
- Sedi: nessuna.
- Costo: zero.
- Rischio: nessuno.
- Confidenza: high.

### MG-012 — Rotte del README [scarta]

- Evidenza: README e WORLDFLOWAI.md del clone come porte d'ingresso alla docs.
- perché_no: la sezione How to start di Daiku esiste già e fa quel lavoro.
- Proposta: nessuna.
- Sedi: nessuna.
- Costo: zero.
- Rischio: nessuno.
- Confidenza: media.

### MG-013 — Catalogo backend [scarta]

- Evidenza: skill `backend-patterns` del clone come catalogo di soluzioni.
- perché_no: lo slot di esempio del template Daiku esiste già e copre quel bisogno senza un catalogo precotto.
- Proposta: nessuna.
- Sedi: nessuna.
- Costo: zero.
- Rischio: nessuno.
- Confidenza: media.

## 7. Limitations del giudice

1. Clone intero invece di --no-clone, ma perimetro intatto: l'acquisizione ha clonato tutto il repo invece di limitarsi allo stretto necessario, senza però allargare il perimetro del confronto.
2. OrcaRouter non verificato: chiesto nella issue #12, non verificato localmente.
3. Ridenominazione del fork non risolta: fork WorldFlowAI di affaan-m con badge upstream non risolto offline.
4. Conteggio comandi corretto a 15 contro 14: gli assi dichiaravano 14 comandi, il clone ne porta 15; il conteggio giusto è 15.
5. Letture parziali compensate: review SKILL righe 1-130/318 e new-feature 1-120/208 lette in parziale, compensate dal giudice con rilettura integrale di review e grep package-wide.
