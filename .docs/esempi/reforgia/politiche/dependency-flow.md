---
paths:
  - "apps/backend/app/api/dependency_*.py"
  - "apps/backend/app/services/dependency_*_service.py"
  - "apps/backend/app/adapters/dependency_*.py"
  - "apps/backend/app/adapters/maven_central.py"
  - "apps/backend/app/adapters/storage/dependency.py"
  - "apps/backend/app/deterministic_agents/dependency_posture_agent.py"
  - "apps/backend/app/deterministic_agents/technology_catalog.py"
  - "apps/backend/app/deterministic_agents/build_profile_agent.py"
  - "apps/backend/app/mappers/technology_inventory_card.py"
  - "apps/backend/app/agents/dependency_knowledge_agent.py"
  - "apps/backend/app/agents/dependency-knowledge/**"
  - "apps/backend/tests/test_dependency_*.py"
  - "apps/backend/tests/test_maven_central_adapter.py"
  - "apps/backend/tests/test_technology_catalog.py"
  - "apps/backend/tests/test_build_profile_agent.py"
  - "apps/backend/tests/test_technology_inventory_card.py"
---

# Flusso dependency

```text
dependency posture -> dependency knowledge -> decision card / chat context
```

- La posture è analisi deterministica su dipendenze Maven già parsate e metadata recuperati dal service tramite adapter.
- La knowledge è trasformazione agentica delle evidenze preparate; non raccoglie direttamente dati esterni e non persiste.
- Conserva il confine tra input tecnico/parsing negli adapter, analisi rule-based negli agenti deterministici e conoscenza LLM negli agenti.

## Catalogo tecnologico: criterio `area`/`primary` e semantica di `lookup`

`technology_catalog.py` è la tabella che `build_profile_agent.py` consuma e che `technology_inventory_card.py` rende leggibile. Il criterio con cui si scrive o si sposta una riga sta qui.

- `primary=True` = tecnologia che determina l'architettura o il piano di migrazione (framework, runtime, motori di persistenza e driver, crypto, logging, test). Le librerie di utility, i parser e i formati restano `False`: compaiono nel dettaglio, non nella sintesi. Anche le **API standard** restano `False` — `javax.jms`, JAXB, JAX-WS, JPA API sono contratti, e a decidere è chi li implementa (il broker, Axis2, l'ORM). **Fa eccezione la Servlet API**: lì è la versione stessa a dettare la migrazione (`javax` → `jakarta`). Le aree ammesse sono le costanti `AREA_*` del modulo: il catalogo non ne inventa altre.
- `lookup(group_id, artifact_id)` non è un `dict.get`: quando il match esatto sul groupId non trova una regola, risale i segmenti fino all'antenato noto più lungo e ritenta lo stesso percorso sul gemello `javax`↔`jakarta`. I groupId ombrello elencati in `_NON_INHERITABLE_GROUP_IDS` non fanno mai da antenato — restano raggiungibili solo per uguaglianza esatta — perché altrimenti trascinerebbero artifact scorrelati sotto un'etichetta formalmente vera e praticamente inutile, e la coordinata smetterebbe di segnalarsi come lacuna. Sono barriere, non salti: incontrarne uno **ferma** la risalita, altrimenti un antenato ancora più corto rientrerebbe dalla finestra con la stessa etichetta sbagliata; per questo un gruppo può comparire in quell'elenco anche senza avere una regola propria, come pura barriera sulla strada. Un nuovo groupId ombrello va dichiarato lì, mai lasciato ereditare per omissione.
