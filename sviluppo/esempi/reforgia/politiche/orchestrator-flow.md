---
paths:
  - "apps/backend/app/api/orchestrator.py"
  - "apps/backend/app/services/orchestrator_service.py"
  - "apps/backend/app/adapters/storage/orchestration_db.py"
  - "apps/backend/app/adapters/storage/orchestrator_runs.py"
  - "apps/backend/app/deterministic_agents/convergence_agent.py"
  - "apps/backend/app/deterministic_agents/worker_quality_gate.py"
  - "apps/backend/app/deterministic_agents/subagent_admission.py"
  - "apps/backend/app/mappers/orchestrator_task_output.py"
  - "apps/backend/app/mappers/worker_output.py"
  - "apps/backend/app/agents/orchestrator/**"
  - "apps/backend/app/agents/worker/**"
  - "apps/backend/app/agents/community_summary/**"
  - "apps/backend/tests/test_orchestrat*.py"
  - "apps/backend/tests/test_subagent_*.py"
  - "apps/backend/tests/test_step_*.py"
  - "apps/backend/tests/test_generate_orchestrator_tasks.py"
  - "apps/backend/tests/test_generate_community_summary.py"
---

# Orchestrazione durevole

```text
orchestrator/java genera task
  -> fan-out worker verificati da WorkerQualityGate
  -> roll-up + community summary
  -> ConvergenceAgent
  -> audit e nuova decisione finché converge
```

- Il motore di durabilità è DBOS tramite `@DBOS.workflow` e `@DBOS.step`.
- I checkpoint risiedono nel system DB locale per PC, mai nel Postgres centrale: il codice cliente non deve attraversare quel canale laterale.
- Nel corpo di un workflow DBOS, orologio, random, I/O e chiamate ad adapter esterni devono stare dentro un `@DBOS.step`.
- La messa in coda dei figli, invece, sta **solo** nel corpo del workflow: DBOS vieta di mettere in coda un workflow da dentro uno step, e l'handle di un lavoro in coda non è un valore che uno step possa restituire.
- Le API DBOS invocate dal bootstrap d'avvio vogliono la variante `_async`: quel codice gira nel lifespan ASGI, dove un event loop è attivo e `check_async` fa sollevare le varianti sincrone, impedendo l'avvio del backend. Non basta ispezionare il corpo della funzione chiamata: `cancel_workflow` non contiene `check_async` ma delega a `cancel_workflows`, che lo contiene. Fuori dal lifespan il vincolo non morde — le route sono `def` e girano nel threadpool, dove le API sincrone restano legittime.
- Nei test, un `MagicMock` nudo al posto di `DBOS` non riproduce quel vincolo e lascia passare una chiamata sincrona con la suite verde: il double deve montare il `check_async` reale sulle varianti sincrone.
- Violare il determinismo può corrompere il replay producendo stato o decisioni errate su una run già pagata in token, anche senza crash.
