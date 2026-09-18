---
paths:
  - "apps/backend/app/api/migration.py"
  - "apps/backend/app/api/execution.py"
  - "apps/backend/app/services/migration_service.py"
  - "apps/backend/app/services/execution_service.py"
  - "apps/backend/app/services/executor_api_port.py"
  - "apps/backend/app/services/workspace_service.py"
  - "apps/backend/app/services/model_routing.py"
  - "apps/backend/app/adapters/git.py"
  - "apps/backend/app/adapters/maven_test.py"
  - "apps/backend/app/adapters/repo_read.py"
  - "apps/backend/app/adapters/repo_write.py"
  - "apps/backend/app/adapters/codex.py"
  - "apps/backend/app/adapters/codex_pool.py"
  - "apps/backend/app/adapters/llm.py"
  - "apps/backend/app/adapters/storage/decision.py"
  - "apps/backend/app/adapters/storage/execution.py"
  - "apps/backend/app/agents/decision/**"
  - "apps/backend/app/agents/execution/**"
  - "apps/backend/app/agents/code-review/**"
  - "apps/backend/tests/test_execution*.py"
  - "apps/backend/tests/test_executor_api_port.py"
  - "apps/backend/tests/test_workspace_service.py"
  - "apps/backend/tests/test_migration*.py"
---

# Decision ed execution

## Decision card

```text
finding documentato in KB + metadata indice
  -> decision agent
  -> decision card con N soluzioni
  -> per soluzione: markdown editabile + codex_prompt operativo
  -> execution
```

- Il nodo iniziale è un finding già validato e documentato.
- L'agente non legge codice e non persiste: il service prepara input e persistenza.
- La run segue il pattern asincrono condiviso.

## Execution

```text
soluzione scelta -> worktree del finding
  -> execution agent scrive il fix
  -> ReforgIA risolve i moduli e avvia i test Maven (coda build: 1)
  -> test rossi: esito alla stessa sessione, entro il cap
  -> test verdi: code review sul diff non committato
  -> review rejected: rilievi alla stessa sessione, entro il cap
  -> review approved: commit del fix e finding risolto
```

- Il verdetto è di ReforgIA, non dell'agente di coding.
- Coding e review seguono la sorgente modello del progetto.
- Sulla strada Codex usano conversazioni distinte nello stesso processo; sulla strada API, coding usa tool confinati di scrittura e review una porta separata con soli tool di lettura, alimentata dal diff preparato da ReforgIA.
- Il commit avviene solo dopo review approvata.
- Il consolidamento nella baseline (`merge_resolved_finding`) è successivo e on-demand: è sola consolidazione Git e non ripete la build.
- La semantica completa di commit, merge, scarto e cancellazione record vive nel fatto `execution-semantics` in memory.
