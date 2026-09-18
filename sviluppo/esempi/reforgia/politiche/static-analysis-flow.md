---
paths:
  - "apps/backend/app/api/static_code_analysis.py"
  - "apps/backend/app/api/finding_validation.py"
  - "apps/backend/app/services/sonar_analysis_service.py"
  - "apps/backend/app/services/static_analysis_run_service.py"
  - "apps/backend/app/services/finding_validation_agent_service.py"
  - "apps/backend/app/adapters/sonar*.py"
  - "apps/backend/app/adapters/sonarlint.py"
  - "apps/backend/app/adapters/storage/sonar.py"
  - "apps/backend/app/adapters/storage/findings.py"
  - "apps/backend/app/mappers/sonar_finding_mapper.py"
  - "apps/backend/app/mappers/conservative_refactoring_filter.py"
  - "apps/backend/app/agents/finding-validation/**"
  - "apps/backend/app/agents/bug-documentation/**"
  - "apps/backend/app/agents/vulnerability-documentation/**"
  - "apps/backend/tests/test_sonar*.py"
  - "apps/backend/tests/test_sonarlint*.py"
  - "apps/backend/tests/test_static_code_analysis_api.py"
  - "apps/backend/tests/fixtures/sonar/**"
  - "apps/sonar-shim/**"
---

# Analisi statica e finding

```text
code smell Sonar -- coppie (package, rule) --> finding validation --> KB: Code Smell

bug / vulnerabilità Sonar --> finding validation per gravità
  --> bug-documentation / vulnerability-documentation
  --> KB: Bug / Security + documentazione regola
```

- Sonar richiede `mvn verify` e copre code smell, bug e vulnerabilità.
- Il finding validation a coppie usa come sorgente i code smell Sonar.
- Una nuova scan azzera gli artefatti finding della scan precedente secondo il fatto `scan-resets-finding-kb` in memory.

## Sorgenti

- La sorgente predefinita `sonarlint` è locale e non richiede servizi esterni; usa `apps/sonar-shim`.
- La sorgente opzionale `remote` punta a un SonarQube esterno già esistente. ReforgIA non ospita né gestisce un server SonarQube.
- In modalità `remote`, Maven esegue `mvn verify sonar:sonar` sul workspace host, il backend attende il CE task e interroga poi la REST API. La run resta asincrona.
- Configurazione in `.env`, mai committata: `SONAR_HOST_URL`, `SONAR_TOKEN` user token, `SONAR_JAVA_HOME` JDK 17+; `MAVEN_EXECUTABLE` non è più configurazione ordinaria ma lo scavalco d'ambiente del Maven gestito da ReforgIA, di norma non necessario.
- Il browser può bypassare il proxy aziendale mentre il backend deve usare l'URL realmente raggiungibile direttamente.
