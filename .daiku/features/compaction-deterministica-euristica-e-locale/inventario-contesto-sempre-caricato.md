# Inventario in token del contesto sempre-caricato di Daiku

- **Slug:** inventario-contesto-sempre-caricato
- **Cosa fa:** `init` deposita il file di istruzioni, `.daiku/` e il corpus di memoria, e il pacchetto porta venti skill; questa feature emette, dato un progetto, un inventario in token di tutto ciò che Daiku tiene sempre caricato (istruzioni, `.daiku/`, skill, memorie) e lo espone da una skill di audit, segnalando un progetto dove è gonfiato — un difetto che Daiku stesso produce.
- **Dove atterra:** un programma in `plugins/daiku/architect/` e una skill di audit sotto `plugins/daiku/skills/`; nessun hook, quindi vale su **entrambi** gli host.
- **Come si costruisce:** da alexgreensh/token-optimizer (B4) si prendono la scomposizione per componente (`measure_components`) e la presentazione con le correzioni suggerite. Deterministico e locale, non chiama un modello: è l'Asse B che più somiglia alla filosofia di Daiku.
- **Prompt per new-feature:** /daiku:new-feature Inventario in token del contesto sempre-caricato di Daiku: un programma in architect/ che, dato il progetto, scompone in token il sempre-carico (istruzioni, .daiku/, skill, memorie) e lo espone da una skill di audit su entrambi gli host, senza hook né modello (meccanismo da alexgreensh/token-optimizer)
