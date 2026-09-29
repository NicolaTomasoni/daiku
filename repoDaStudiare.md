Verificati tutti via API GitHub (esistenza reale). Esclusi i cinque già studiati.

## Harness e agent loop — stesso problema di Daiku

- [affaan-m/ECC](https://github.com/affaan-m/ECC) — il seguito/successore di everything-claude-code: harness performance system (skills, instincts, memoria, security)
- [sd0xdev/sd0x-harness](https://github.com/sd0xdev/sd0x-harness) — harness engineering: contratti al posto della coreografia, tier di regola (Anchor/Default/Guidance), guardie a livello git
- [wshobson/agents](https://github.com/wshobson/agents) — marketplace multi-harness (Claude Code, Codex, Cursor, Copilot): la forma pubblicabile più vicina a `plugins/`
- [ruvnet/ruflo](https://github.com/ruvnet/ruflo) — ex claude-flow: orchestrazione, swarm, memoria
- [gotalab/cc-sdd](https://github.com/gotalab/cc-sdd) — SDD minimalista con Agent Skills per Claude Code **e** Codex
- [modu-ai/moai-adk](https://github.com/modu-ai/moai-adk) — plan/run/sync, quality gate, routing modello+effort
- [buildermethods/agent-os](https://github.com/buildermethods/agent-os) — iniezione di standard di codebase + scrittura di spec
- [github/spec-kit](https://github.com/github/spec-kit) — toolkit SDD ufficiale GitHub
- [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done) — meta-prompting, context engineering, SDD
- [Pimzino/claude-code-spec-workflow](https://github.com/Pimzino/claude-code-spec-workflow) — Requirements → Design → Tasks → Implementation
- [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) — metodo agile a persona di agente
- [SuperClaude-Org/SuperClaude_Framework](https://github.com/SuperClaude-Org/SuperClaude_Framework) — comandi, persona cognitive, metodologie
- [eyaltoledano/claude-task-master](https://github.com/eyaltoledano/claude-task-master) — gestione task come sistema esterno
- [humanlayer/humanlayer](https://github.com/humanlayer/humanlayer) — context engineering su codebase complesse
- [davila7/claude-code-templates](https://github.com/davila7/claude-code-templates) — CLI di configurazione e monitoraggio

## Hook e guardrail — il «mai fidarsi di un LLM»

- [disler/claude-code-hooks-mastery](https://github.com/disler/claude-code-hooks-mastery) — il corpus di riferimento sugli hook
- [johnlindquist/claude-hooks](https://github.com/johnlindquist/claude-hooks) — hook tipizzati
- [ai-boost/awesome-harness-engineering](https://github.com/ai-boost/awesome-harness-engineering) — indicizzata: pattern, eval, permessi, osservabilità
- [walkinglabs/learn-harness-engineering](https://github.com/walkinglabs/learn-harness-engineering) — didattica da 0 a 1 sull'harness

## Corpus di skill e marketplace

- [anthropics/skills](https://github.com/anthropics/skills) — il repository ufficiale Agent Skills
- [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) — corpus ufficiale Vercel
- [obra/superpowers-marketplace](https://github.com/obra/superpowers-marketplace) — marketplace curato: forma di vetrina
- [mattpocock/skills](https://github.com/mattpocock/skills) — skill opinionate TS/Node dal suo `.agents/`
- [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) — 1000+ skill multi-host
- [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) — lista curata per categoria
- [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — mappa dell'ecosistema per livelli (skill, hook, workflow, CLAUDE.md)
- [travisvn/awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills)
- [BehiSecc/awesome-claude-skills](https://github.com/BehiSecc/awesome-claude-skills)
- [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills)
- [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills)
- [steipete/agent-rules](https://github.com/steipete/agent-rules) — regole e conoscenza per agenti
- [centminmod/my-claude-code-setup](https://github.com/centminmod/my-claude-code-setup) — memory bank in CLAUDE.md

## Lettura dell'host

- [openai/codex](https://github.com/openai/codex) — il secondo host di Daiku, dal sorgente
- [anthropics/claude-code](https://github.com/anthropics/claude-code) — issues e comportamento reale dell'host
- [x1xhlol/system-prompts-and-models-of-ai-tools](https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools) — system prompt reali, per capire cosa l'agente ha davvero in contesto

## Orchestrazione e runtime

- [google/ax](https://github.com/google/ax) — runtime di orchestrazione agentica distribuito: Task/Workspace/Model come manifest, skill registrate come attori isolati, harness-agnostico
- [cloudflare/cloudflare-os](https://github.com/cloudflare/cloudflare-os) — workspace per agenti su Workers: contesto e sistemi dell'azienda dentro l'ambiente dell'agente
- [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) — harness in cui tutto è un plugin: la forma estrema del confine plugin/skill
- [ringlochid/oh-my-subagents](https://github.com/ringlochid/oh-my-subagents) — orchestrazione di subagent locali per **Codex e Claude** con stato dei task persistente, team riusabili e recupero dopo interruzione
- [grandamenium/m2c1](https://github.com/grandamenium/m2c1) — orchestrazione autonoma a 12 fasi, dal brain dump al software rilasciato

## Contesto e token

- [alexgreensh/token-optimizer](https://github.com/alexgreensh/token-optimizer) — token fantasma, sopravvivenza alla compaction, degrado della qualità del contesto
- [tamaratran/fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) — plugin Claude Code che sostituisce il riassunto di compaction con decisioni Jev: ogni tool call viene valutata, la stale scartata, il resto resta verbatim
- [leonaaardob/fast-dev-compaction](https://github.com/leonaaardob/fast-dev-compaction) — la stessa idea portata sugli hook di **Codex**: il precedente per un meccanismo unico su due host
- [rtk-ai/rtk](https://github.com/rtk-ai/rtk) — proxy CLI che taglia il consumo di token sui comandi di sviluppo

## Esecuzione isolata

- [opensandbox-group/OpenSandbox](https://github.com/opensandbox-group/OpenSandbox) — runtime di sandbox per agenti
