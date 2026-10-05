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
- [uditgoenka/autoresearch](https://github.com/uditgoenka/autoresearch) — lo stesso loop portato a skill su Claude Code, Codex e OpenCode, con gli hook di guardia solo su Claude
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
- [mattpocock/skills](https://github.com/mattpocock/skills) — le skill di Matt Pocock dal suo `.agents/`: 27 in tutto, divise per **chi le può invocare** (le user-invoked orchestrano, le model-invoked le raggiunge l'agente da solo; una user-invoked può chiamarne una model-invoked, mai un'altra user-invoked); nascono per correggere quattro guasti ricorrenti — disallineamento (la sessione di *grilling*), verbosità (un linguaggio condiviso), codice che non funziona (red-green-refactor) e «ball of mud» (cura del design); MIT, ~275k stelle
- [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) — l'altro corpus di metodo, di Addy Osmani: 25 skill mappate sul ciclo di vita (Define→Plan→Build→Verify→Review→Ship), 9 comandi slash, quattro persona di subagent (code-reviewer, test-engineer, security-auditor, web-performance-auditor) e un **meccanismo anti-razionalizzazione** — ogni skill elenca le scuse con cui l'agente salta i passaggi e le ribatte, e chiude con requisiti di evidenza («seems right» non basta); ~70 agenti via `npx skills`, MIT, ~100k stelle
- [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) — 1000+ skill multi-host
- [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) — lista curata per categoria
- [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — mappa dell'ecosistema per livelli (skill, hook, workflow, CLAUDE.md)
- [travisvn/awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills)
- [BehiSecc/awesome-claude-skills](https://github.com/BehiSecc/awesome-claude-skills)
- [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills)
- [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills)
- [steipete/agent-rules](https://github.com/steipete/agent-rules) — regole e conoscenza per agenti
- [centminmod/my-claude-code-setup](https://github.com/centminmod/my-claude-code-setup) — memory bank in CLAUDE.md

### Skill che cambiano l'output — come l'agente parla

- [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) — ribalta la forma della risposta: prima l'azione, passi numerati, una sola azione concreta in chiusura, stime in minuti, liste sotto le cinque voci, niente preamboli né riepiloghi («A skill to stop your coding agent from burying the answer», e non serve alcuna diagnosi); dieci regole più un controllo pre-invio; plugin su Claude Code, Codex, Cursor, OpenCode, Gemini, Qwen e Kimi; MIT, ~53k stelle
- [blader/humanizer](https://github.com/blader/humanizer) — toglie dall'output i segni del testo generato: 26 pattern numerati per forza e frequenza, presi dalla pagina di Wikipedia «Signs of AI writing» (il «non X ma Y», le chiusure a effetto, i preamboli teatrali, le massime che suonano profonde), con **voice calibration** da due o tre paragrafi dell'autore; non promette di battere i rilevatori — i detector continuano a segnalarlo — e avverte che rende il testo meno preciso, quindi vale sulla prosa, mai su codice o dati; MIT, ~54k stelle

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

### Compaction giudicata da un modello — Jev / System One

Non riassume: un modello di decisione — `jev-latest`, il «System One» di TypeSafe — riceve lo stato della conversazione e risponde a domande tipizzate (Choice, Score, Noul) su ogni chiamata di tool; ciò che resta è verbatim, ciò che non serve più viene scartato o troncato. È la forma che Daiku non ha: la compaction non è una riscrittura lossy ma una selezione.

- [tamaratran/fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) — il riferimento, e il motore di quasi tutti gli altri: accoppia ogni `tool_use` al suo `tool_result`, fissa i messaggi recenti, chiede a Jev due cose per chiamata (tenere la chiamata? tenere il risultato verbatim?) e ricostruisce la lista senza risultati orfani; MIT, 7,3k stelle, è anche libreria npm oltre che plugin Claude Code, ma vuole `TYPESAFE_API_KEY` e la feature early-access dei function hook (`CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`)
- [0x7067/claude-jev](https://github.com/0x7067/claude-jev) — la variante con gli eval, e l'unica che usa Jev anche fuori dalla compaction (controllo regole, routing dei prompt, tier del subagent): aggancia `session.compact` su `/compact`, auto-compact e riavvolgimenti, con cinque domande sì/no per riga e le ultime 150 righe valutate; negli eval un vincolo piantato sopravvive al 100% e la compaction scende da ~117s a ~1s, ma senza `TYPESAFE_API_KEY` o `OPENROUTER_API_KEY` gli hook tacciono; MIT, 21 stelle
- [duketopceo/jev-compact](https://github.com/duketopceo/jev-compact) — l'unico con uno scorer **euristico keyless**, quindi l'unico che gira davvero senza rete: segmenta il transcript in span, segue un «moving highlight» dell'intento corrente, li punteggia su `relevance_to_current` e `load_bearing` e sotto un budget sceglie cosa tenere verbatim, cosa mettere in tombstone con una ricevuta e cosa scartare; il transcript integrale resta su disco e si richiama col server MCP `context-restore`; Claude Code pronto, Codex e OpenCode annunciati; MIT, ma 0 stelle e 9 commit — acerbo
- [zaycruz/fast-jev-compaction-pi](https://github.com/zaycruz/fast-jev-compaction-pi) — il port su **pi**: conserva il transcript potato dentro `details.fastJev.messages`, così la compaction successiva ri-decide sul transcript già potato invece di riassumere un riassunto; core vendored da tamaratran, MIT, 0.6.0 del 19 settembre 2026
- [kunchenguid/compact-adviser](https://github.com/kunchenguid/compact-adviser) — la decisione complementare: non *cosa* tenere ma *quando* compattare, con due domande a Jev (unità finita? lavoro pratico o coordinamento?) prima di suggerire `/compact`; estensione pi, MIT, 0.1.12 del 2 ottobre 2026
- [leonaaardob/fast-dev-compaction](https://github.com/leonaaardob/fast-dev-compaction) — il port su **Codex**, dove gli hook non possono sostituire la storia e allora la avvolgono: `PreCompact` pota, `SessionStart` reinserisce ciò che Jev ha trattenuto come `additionalContext`; l'autore stesso scrive «I do not recommend using this», è il write-up di un'idea — vale come precedente multi-host, non come strumento; MIT, 9 stelle

### Il modello di decisione in casa — i sostituti locali di Jev

Jev è chiuso e hosted, senza pesi né modalità offline: questi sono i tentativi aperti di averlo lo stesso, o di sostituirne il mestiere, **da far girare in locale**.

- [Mushroom-Systems/lichen](https://github.com/Mushroom-Systems/lichen) — sostituto **API-compatibile**: serve lo stesso endpoint `/v1/systemone` e le stesse risposte tipizzate, così i client Jev funzionano senza modifiche; legge la probabilità del token-etichetta da modelli aperti (gemma-4-26B-A4B, Qwen) via vLLM o llama.cpp, con tecniche di prompt (stato e domanda ripetuti, opzioni in ordine ruotato, temperatura sulle due letture); su 231 item di JevBench v1.4 risponde a 204–207 contro i 200 di Jev 1.13, al costo di una GPU da 24 GB; MIT, 58 stelle
- [local-context-compiler](https://pypi.org/project/local-context-compiler/) — l'unico che lascia scegliere in un solo strumento: `lcc compact` con tre backend di scoring — `mechanical` (regole lessicali, 0 chiamate di rete, riduzione 26–70% ma nessuna garanzia semantica), `laya` (motore non autoregressivo **on-device**, 0 chiamate, conserva quasi tutto) e `jev` (il giudice remoto, il più preciso ma con chiave e contesto limitato a ~32k); MIT, 0.5.0 del 21 settembre 2026, con server MCP e plugin per Claude Code
- [kyegomez/open-jev](https://github.com/kyegomez/open-jev) — la ricostruzione **da primi principi** in PyTorch delle tre primitive (Noul, Choice, Score, loss `RLCDLoss`): serve a capire l'architettura, ma i pesi sono **casuali**, il tokenizer è un hash e non c'è addestramento — ricerca, non uno strumento; Apache 2.0, 72 stelle
- [paritok](https://pypi.org/project/paritok/) — la strada diversa: non un modello di decisione ma un **modello di compressione locale** (Paritok-4B-v1, LoRA su Qwen3-4B, code-native ed estrattivo, ogni segmento ridotto al ~26% dell'originale), che sta fra l'agente e l'API come proxy su Claude Code, Codex e Cursor; i segmenti compressi restano recuperabili byte-esatti con `read_original`; Apache 2.0, gira in locale via Ollama o vLLM

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
