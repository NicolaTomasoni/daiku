Verificati tutti via API GitHub (esistenza reale). Esclusi i già studiati.

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
- [garrytan/gstack](https://github.com/garrytan/gstack) — 23 skill-ruolo (CEO, EM, designer, QA, security, release) per 10 host, con comandi di scope-freeze (`/guard`, `/freeze`) e un apparato di **eval e gate sulle skill stesse** (`evals-*`, `quality-gate`, `version-gate`, skill generate da `.tmpl`)

## Loop autonomi a metrica — modifica, misura, tieni o scarta

- [karpathy/autoresearch](https://github.com/karpathy/autoresearch) — il riferimento: l'agente modifica `train.py`, addestra 5 minuti fissi, legge **una sola metrica meccanica** (`val_bpb`), tiene o scarta, ripete; l'umano riscrive `program.md`, cioè le istruzioni
- [uditgoenka/autoresearch](https://github.com/uditgoenka/autoresearch) — lo stesso loop portato a skill su Claude Code, Codex e OpenCode, con gli hook di guardia solo su Claude: la forma multi-host di ciò che Daiku fa a mano in `collauda-init`
- [leo-lilinxiao/codex-autoresearch](https://github.com/leo-lilinxiao/codex-autoresearch) — la variante per **Codex** del medesimo ciclo
- [webfuse-com/awesome-autoresearch](https://github.com/webfuse-com/awesome-autoresearch) — indice dei loop autonomi e dei research agent ispirati a questo schema

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
- [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) — host autonomo self-hosted: `plugins/` con loader e uno **plugin-catalog** di manifest `.yaml` a submission aperta, skill sullo standard `agentskills.io`, subagent, cron, MCP e sette backend di esecuzione — il **terzo host candidato** dopo Claude Code e Codex
- [earendil-works/pi](https://github.com/earendil-works/pi) — agent toolkit (agent loop, TUI, CLI): il **quarto host candidato**, con la sua suite di estensioni (`pi-acp`, `pi-mcp-adapter`)
- [badlogic/pi-skills](https://github.com/badlogic/pi-skills) — skill per pi **dichiarate compatibili con Claude Code e Codex CLI**: la prova che lo standard `SKILL.md` è già di tre host
- [vastsa/PI-Desktop](https://github.com/vastsa/PI-Desktop) — host desktop per pi con marketplace proprio (`catalog.json`, id reverse-DNS): i plugin sono però pannelli, widget e tool da UI, non skill di metodo

## Orchestrazione e runtime

- [google/ax](https://github.com/google/ax) — runtime di orchestrazione agentica distribuito: Task/Workspace/Model come manifest, skill registrate come attori isolati, harness-agnostico
- [cloudflare/cloudflare-os](https://github.com/cloudflare/cloudflare-os) — workspace per agenti su Workers: contesto e sistemi dell'azienda dentro l'ambiente dell'agente
- [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) — harness in cui tutto è un plugin: la forma estrema del confine plugin/skill
- [ringlochid/oh-my-subagents](https://github.com/ringlochid/oh-my-subagents) — orchestrazione di subagent locali per **Codex e Claude** con stato dei task persistente, team riusabili e recupero dopo interruzione
- [grandamenium/m2c1](https://github.com/grandamenium/m2c1) — orchestrazione autonoma a 12 fasi, dal brain dump al software rilasciato
- [musistudio/claude-code-router](https://github.com/musistudio/claude-code-router) — control plane locale per ogni agente: routing fra modelli, fusione di capacità, orchestrazione dei tool

## Contesto e token

### Compaction e finestra di contesto

- [alexgreensh/token-optimizer](https://github.com/alexgreensh/token-optimizer) — token fantasma, sopravvivenza alla compaction, degrado della qualità del contesto
- [tamaratran/fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) — plugin Claude Code che sostituisce il riassunto di compaction con decisioni Jev: ogni tool call viene valutata, la stale scartata, il resto resta verbatim
- [leonaaardob/fast-dev-compaction](https://github.com/leonaaardob/fast-dev-compaction) — la stessa idea portata sugli hook di **Codex**: il precedente per un meccanismo unico su due host
- [philipppohlmann/compaction](https://github.com/philipppohlmann/compaction) — compaction locale su Claude Code, **Codex** e Cursor, con risparmi misurati e recupero byte-exact: il terzo host nello stesso meccanismo

### Prima che arrivi al modello — output dei tool e serializzazione

- [rtk-ai/rtk](https://github.com/rtk-ai/rtk) — proxy CLI che taglia il consumo di token sui comandi di sviluppo
- [headroomlabs-ai/headroom](https://github.com/headroomlabs-ai/headroom) — comprime output dei tool, log, file e chunk RAG **prima** che arrivino al modello: libreria, proxy, server MCP
- [claudioemmanuel/squeez](https://github.com/claudioemmanuel/squeez) — compressore a hook su **sette host** (Claude Code, Copilot CLI, OpenCode, Gemini CLI, Codex CLI, Pi, Hermes): quattro stadi — rimozione di ANSI, dedup in `[×N]`, raggruppamento, troncamento — e riscrittura `PreToolUse` dei comandi sicuri
- [Mibayy/token-savior](https://github.com/Mibayy/token-savior) — server MCP che naviga il codice per simboli e riscrive i comandi Bash nel `PreToolUse`; i numeri che dichiara vanno letti con la sua stessa avvertenza
- [mksglu/context-mode](https://github.com/mksglu/context-mode) — sandbox dell'output dei tool (‑98%), memoria di sessione persistente e routing via MCP + hook su 17 piattaforme
- [Madhan230205/token-reducer](https://github.com/Madhan230205/token-reducer) — compressione di contesto locale e senza API: RAG ibrido BM25 + vettori, chunking AST, reranking
- [CoderDayton/semantic-cache-mcp](https://github.com/CoderDayton/semantic-cache-mcp) — server MCP di caching semantico dei file: diff semantici e chunking content-defined
- [toon-format/toon](https://github.com/toon-format/toon) — Token-Oriented Object Notation: serializzazione compatta e leggibile di JSON per i prompt, con SDK e benchmark
- [microsoft/LLMLingua](https://github.com/microsoft/LLMLingua) — ricerca Microsoft sulla compressione di prompt e KV-cache: fino a 20× con perdita minima

### Esplorazione delegata e budget del contesto

- [manjunathshiva/fastcontext](https://github.com/manjunathshiva/fastcontext) — il mirror MIT di un repo Microsoft **rimosso**: un subagent che esplora al posto dell'agente principale, con soli tool di lettura, e torna citazioni di file e righe — fino al 60% di token in meno sull'agente principale
- [Jakevin/fastcontext-agent-tools](https://github.com/Jakevin/fastcontext-agent-tools) — lo stesso esploratore in forma usabile: server MCP e skill **Codex**
- [ericrisco/rsc-harness](https://github.com/ericrisco/rsc-harness) — la skill `context-budget`: il contesto è RAM, non disco — offload, reduce, retrieve, isolate, e compattare presto, intorno al 60%, invece che all'80–95%
- [nicobailon/pi-subagents](https://github.com/nicobailon/pi-subagents) — budget di token e di costo dichiarato sui subagent (`usageBudget`): soft report e hard gate sul lancio successivo

### Memoria fra sessioni

- [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) — contesto persistente fra sessioni: cattura cosa fa l'agente, lo comprime e reinietta il rilevante
- [rohitg00/agentmemory](https://github.com/rohitg00/agentmemory) — substrato di memoria cross-harness per agenti di coding, non il plugin di un solo host
- [EverMind-AI/EverOS](https://github.com/EverMind-AI/EverOS) — markdown come fonte di verità e indici SQLite e LanceDB derivati: la scelta che Daiku ha già fatto, con il recupero che a Daiku manca
- [TencentCloud/TencentDB-Agent-Memory](https://github.com/TencentCloud/TencentDB-Agent-Memory) — memoria a strati (dialogo grezzo → memoria atomica → scenario → persona) con risparmi di token misurati

### Istruzioni, igiene e mappa del campo

- [drona23/claude-token-efficient](https://github.com/drona23/claude-token-efficient) — un solo `CLAUDE.md` che tiene le risposte brevi: nessun codice da cambiare
- [johnnichev/nv-context](https://github.com/johnnichev/nv-context) — analizza il progetto e **genera** configurazioni, hook, gestione di sessione e budget di token, partendo dal presupposto che il guasto dell'agente è quasi sempre un guasto di contesto
- [ppiankov/contextspectre](https://github.com/ppiankov/contextspectre) — igiene: legge i JSONL locali e mostra cosa riempie la finestra, quanto costa e cosa tagliare, con un voto A–F di rapporto segnale/rumore. È una CLI, non un plugin: non tocca l'agente
- [Meirtz/Awesome-Context-Engineering](https://github.com/Meirtz/Awesome-Context-Engineering) — la rassegna del campo: paper, framework e guide di implementazione
- [coleam00/context-engineering-intro](https://github.com/coleam00/context-engineering-intro) — l'introduzione pratica più diffusa, centrata su Claude Code

## Il codebase dentro il contesto — indicizzazione e recupero

- [oraios/serena](https://github.com/oraios/serena) — toolkit MCP di retrieval e editing semantico del codice: «l'IDE per il tuo agente»
- [yamadashy/repomix](https://github.com/yamadashy/repomix) — impacchetta l'intero repository in un unico file AI-friendly
- [zilliztech/claude-context](https://github.com/zilliztech/claude-context) — MCP di code search: l'intero codebase come contesto per qualunque agente
- [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) — grafo di conoscenza interrogabile del codebase (parsing AST deterministico, ogni arco spiegato, nessun vector store), come skill per Claude Code, Cursor, Codex e Gemini CLI
- [tirth8205/code-review-graph](https://github.com/tirth8205/code-review-graph) — grafo di code intelligence locale-first per MCP e CLI: mappa persistente del codebase, riduzioni di contesto misurate su review e repo grandi

## Misura e osservabilità

- [ccusage/ccusage](https://github.com/ccusage/ccusage) — uso e costo dei token letti dai JSONL locali
- [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud) — HUD che mostra contesto, tool attivi, agenti in corso e avanzamento dei todo

## Esecuzione isolata

- [opensandbox-group/OpenSandbox](https://github.com/opensandbox-group/OpenSandbox) — runtime di sandbox per agenti
