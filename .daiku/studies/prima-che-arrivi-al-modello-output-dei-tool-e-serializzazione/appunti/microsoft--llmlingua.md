# microsoft/LLMLingua — libreria di ricerca Microsoft che rimuove i token non essenziali da un prompt (o da un JSON, chiave per chiave) prima che raggiunga il modello, con budget dichiarati e la misura del lavoro fatto

- **URL:** https://github.com/microsoft/LLMLingua
- **Licenza:** MIT
- **Ultimo commit:** 2026-09-10
- **Stelle:** 6725
- **Archivio:** no
- **Letto via:** api

## Cosa fa, e come lo fa

È una **libreria Python di ricerca**, non un agent loop. L'unico entry point pubblico è `PromptCompressor` (`llmlingua/__init__.py` esporta solo quello): l'utente la istanzia e le passa il testo (`compress_prompt`) o un oggetto JSON (`compress_json`, `structured_compress_prompt`). Restituisce un dizionario con il prompt compresso **e** la misura del lavoro fatto — `origin_tokens`, `compressed_tokens`, `ratio` (es. `"11.2x"`), `rate` (percentuale) e `saving` (stima in dollari su una tariffa fissa GPT-4, `prompt_compressor.py:715`). Chi la usa la innesta in una pipeline di prompt: RAG (il README cita le integrazioni con LangChain e LlamaIndex), riunioni, CoT, codice. Non tocca l'host, non è un proxy né un hook: è una funzione che l'utente chiama sul proprio testo **prima** di inviarlo.

La riga di descrizione — «fino a 20× con perdita minima» — è il numero dei paper (EMNLP'23 LLMLingua, ACL'24 LongLLMLingua, ACL'24 Findings LLMLingua-2), ripetuto nel README e nella `Transparency_FAQ.md`; i test nel repo mostrano rapporti molto più bassi (1.4×, 3.5×, 1.3×, 2.0× in `tests/test_llmlingua.py`; 2.1×–9.6× in `tests/test_llmlingua2.py`), e il Quick Start del README porta `11.2x` su un esempio GSM8K. Il «20×» non è riprodotto nel repository: è una dichiarazione di ricerca.

Il meccanismo, in tre granularità che si sommano. **Livello contesto** (`control_context_budget`, `prompt_compressor.py:1173`): i blocchi di contesto vengono ordinati per rilevanza rispetto alla domanda e tenuti fino a un budget dichiarato — `context_budget` come espressione (`"+100"`, `"*1.5"`), `target_token` (tetto assoluto, che scavalca il `rate`), `rate` (rapporto target), `force_context_ids`/`force_context_number` (blocchi forzati), `rank_method` (il default è la perplessità stessa: `"llmlingua"`). **Livello frase** (`control_sentence_budget`, `:1243`): `keep_first_sentence`, `keep_last_sentence`, `keep_sentence_number`, `high_priority_bonus`. **Livello token** (`iterative_compress_prompt`, `:1523`, per mezzo di `get_compressed_input`, `:1402`): il cuore — un LM piccolo (di default `NousResearch/Llama-2-7b-hf`, `__init__` a `:73`; oppure GPT-2, `microsoft/phi-2`) calcola la **perplessità** di ogni token dato il contesto, i token la cui perplessità supera una soglia derivata dal `rate` vengono rimossi, iterando a finestre di `iterative_size` (200) per gestire prompt lunghi. `force_tokens` e `force_reserve_digit` proteggono token e cifre. Lo stato è in memoria, non su disco: nessun file di sessione, nessun registro, nessuno stato da riprendere.

Sopra il metodo base stanno tre diramazioni, tutte nello stesso entry point. **LLMLingua-2** (`compress_prompt_llmlingua2`, `:727`, accesa con `use_llmlingua2=True`) sostituisce la perplessità con un **classificatore token-per-token distillato da GPT-4** (encoder BERT/XLM-RoBERTa, `microsoft/llmlingua-2-*-meetingbank`), dichiarato 3×–6× più veloce e addestrabile su dati propri (`experiments/llmlingua2/`). **LongLLMLingua** (`rank_method="longllmlingua"`, `condition_in_question`, `reorder_context`, `dynamic_context_compression_ratio`) riordina i documenti per combattere il «lost in the middle». **SecurityLingua** (`use_slingua=True`, `experiments/securitylingua/readme.md`) comprime il prompt per **rivelare l'intenzione malevola** di un jailbreak e la inietta in un system prompt aumentato, con la pretesa di «100x less token costs» rispetto ai guardrail LLM. C'è infine `recover(original_prompt, compressed_prompt, response)` (`:1751`), che ricostruisce dalla risposta i frammenti dell'originale che la compressione aveva tolto.

Sul tema di questo studio — **ciò che viaggia verso il modello, e la sua serializzazione** — la parte più pertinente è `compress_json(json_data, json_config)` (`:215`), retta da `utils.process_structured_json_data` / `precess_jsonKVpair`: una **config per chiave** con quattro campi — `rate` (rapporto del valore), `compress` (se comprimerlo), `value_type` (str/int/float/bool/list/dict/tuple/set), `pair_remove` (se la coppia chiave-valore può sparire del tutto). Le chiavi con `compress: false` sono avvolte fra due tag di nome `llmlingua` che portano `compress=False` (uno di apertura e uno di chiusura) e **sopravvivono intatte** (`tests/test_llmlingua.py`: `id`, `name`, `isActive`, `company` restano interi, `biography`/`skills` si accorciano). Il prompt marcato coi tag di nome `llmlingua` che portano `rate` e `compress` è la forma generalizzata dello stesso principio (`structured_compress_prompt`, `:274`): **ogni segmento dichiara se e quanto si comprime**. La compressione è quindi **lossy** (taglia token), con due reti di sicurezza: i segmenti `compress=False` e il `recover` post-risposta.

**Nota sul «KV-cache» della riga di descrizione:** la libreria comprime **token del prompt**, non gestisce cache. Il vantaggio sulla KV-cache è una conseguenza (meno token ⇒ cache più corta) e LongLLMLingua ne sfrutta l'attenzione per potare: il README lo elenca come «KV-Cache Compression: Accelerates inference process», ma non c'è in `llmlingua/` un componente che tocchi la cache.

## Asse A — Daiku lo fa già, e loro lo fanno meglio?

Nessuna.

Daiku non comprime nulla di ciò che costruisce: decide *quali* file entrano (lo scope di `/review`, i `Target paths` del brief) e *quanto in profondità* un finder legge (`--effort low|medium|high`), ma non riduce mai un payload. Le superfici che sembrano condivise non lo sono: la regola «state **by path**, not as a transcription» di `contracts/orchestration.md` §4.1 evita la compressione passando un riferimento, e non è una capacità che LLMLingua faccia meglio; il costo registrato nel ledger (`architect/ledger.mjs`) è quello **riportato dall'host**, non un taglio. Non c'è quindi una cosa che Daiku **già fa** e che il target faccia meglio: la forza di LLMLingua è una capacità che Daiku non ha affatto, e sta in Asse B.

## Asse B — Daiku non lo fa, e si potrebbe aggiungere?

### B1 — Budget dichiarato di ciò che attraversa verso un subagente, applicato in modo deterministico

- **Capacità:** Daiku non ha un tetto dichiarato sui **byte o righe** di ciò che passa a un figlio. Un front d'investigazione di `new-feature` restituisce «a markdown section ready to paste»; i worker di `research` restituiscono una sezione markdown intera che il padre accoda (`skills/research/SKILL.md` § *Step 1*); il diff di round 1 entra **intero** nel finder, e lo sharding scatta solo sopra una soglia **indicativa nella prosa** («more than two thousand added lines or more than thirty files», `skills/review/SKILL.md` § *Sharding*), non una chiave. Nessuna sede dice «questo payload attraversa al massimo X».
- **Nel target:** il budget è parametro di prima classe — `rate`, `target_token`, `context_budget` con operatori (`"+100"`, `"*1.5"`), `context_level_rate`/`context_level_target_token` — e la misura del risultato è parte del ritorno (`origin_tokens`, `compressed_tokens`, `ratio`, `rate`).
- **Proposta:** una chiave di `.daiku/project.json` — la sede esatta dei valori che una skill sostituisce dentro una frase, [`contracts/project-contract.md` §4](plugins/daiku/contracts/project-contract.md) — che dichiari un tetto di payload per i passi che ne passano uno (i front di `new-feature` §2/§4, i blocchi di ritorno di `research`/`study`, la soglia di sharding di `review` § *Sharding*, che da prosa diventa numero dichiarato). L'orchestratore lo applica **deterministicamente** prima di lanciare il figlio: partiziona (come già fa lo sharding) o tronca, **mai riassume** — `contracts/orchestration.md` §4.1 impone già «state **by path**, not as a transcription», e un riassunto è proprio la trascrizione che quel divieto esclude. Il **motore** di LLMLingua (perplessità su un LM piccolo, o classificatore distillato) non è importabile: il pacchetto è Node, a dipendenze zero e senza rete, e `CLAUDE.md` vuole il controllo deterministico dove è possibile. Si porta quindi la *dichiarazione del budget* e la sua esecuzione meccanica, non il compressore. Costa medio: una chiave nel contratto, la prosa di tre skill e il banco.

### B2 — Span protetti: la parte del payload che deve sopravvivere byte-exact

- **Capacità:** quando Daiku passa contenuto e non un path — una citazione `file:line`, una firma verbatim nelle note di `research`, un codice d'errore nel `gate_detail` — non ha un modo **dichiarato** di dire «questa parte non si tocca». La regola vive solo in prosa sparsa: `research` § *Accuracy rules* dice «verbatim», `contracts/orchestration.md` §4.1 avverte «a summarised fact is a fact that diverges from its file». Nessuna marcatura separa, dentro un payload, i fatti non perdibili da ciò che si può accorciare.
- **Nel target:** i segmenti protetti sono marcati inline da due tag di nome `llmlingua` con `compress=False` (apertura e chiusura), e per il JSON la protezione è strutturale (`utils.process_structured_json_data` / `precess_jsonKVpair`): la chiave con `compress: false` resta intera, `pair_remove: false` la rende non eliminabile, e `force_tokens`/`force_reserve_digit` proteggono token e cifre anche nel canale token-per-token.
- **Proposta:** una convenzione di **citazione protetta**, sulla forma che `project-contract.md` §5.2 già usa per le chiavi `{…}` *dentro code span*: i fatti che devono attraversare intatti (path, nomi di simbolo, `file:line`, letterali di codice) vanno in una marcatura riconoscibile, e ogni eventuale riduttore meccanico (B1) è tenuto a preservarla **byte-exact**. Atterra in `contracts/project-contract.md` §5, accanto alla citazione delle chiavi, e nella prosa di `research`/`blueprint`, che già dichiarano il «verbatim» senza un modo di imporlo. Costo basso: è una convenzione, non un programma — ma è la premessa perché una riduzione non mangi i fatti che più contano, che è la classe di perdita su cui LLMLingua ha speso due meccanismi (i tag e il `recover`).

### B3 — La misura del payload che Daiku stesso costruisce, riportata nel blocco

- **Capacità:** Daiku registra il costo **riportato dall'host** (`{ step, tokens, tool_uses, seconds }`) nei soli round di `/review`, nel ledger, con la regola «an entry exists only for what the host reported» (`architect/ledger.mjs`); non misura mai **ciò che esso stesso costruisce** e passa a un figlio. Nessun blocco dichiara quanti byte o righe sono entrati in un subagente, né — se B1 esiste — quanto un tetto ha tolto.
- **Nel target:** la misura è parte del risultato di ogni chiamata: `origin_tokens`, `compressed_tokens`, `ratio`, `rate`. Non è una stima: è il conteggio del lavoro fatto, calcolato dal tokenizer.
- **Proposta:** un campo di misura nei blocchi dei nodi che passano contenuto — i front di `new-feature`, `study`, i `red_proofs`/`consumers_checked` di `execute` — come `payload` con righe/byte attraversati e, se B1 è in vigore, quanto il tetto ha toccato. Atterra in `skills/study/SKILL.md`, `skills/execute/SKILL.md` e `skills/finder-prompt/SKILL.md` § *The block you return*, nel loro specchio `schemas/blocks.json` e nei `SHAPES` di `architect/architect.mjs`; il banco del valutatore lo copre già. Costa medio: tocca tre schemi di blocco e un valutatore, e senza un consumatore il campo è rumore — il consumatore naturale è il report di `/review`, dove un picco di payload in un round spiega un costo. È l'unica leva di *osservabilità* del tema, e non esiste in Daiku oggi.

## Evidenza

| path nel target | estratto |
|---|---|
| README.md | «up to 20x compression with minimal performance loss» (TL;DR, numero dei paper) |
| README.md | Quick Start: `ratio: '11.2x'`, `origin_tokens: 2365`, `compressed_tokens: 211` |
| llmlingua/prompt_compressor.py | `__init__(model_name="NousResearch/Llama-2-7b-hf", …)` (`:73`) |
| llmlingua/prompt_compressor.py | `compress_prompt` restituisce `origin_tokens`/`compressed_tokens`/`ratio`/`saving` (`:714`–`:721`) |
| llmlingua/prompt_compressor.py | `saving = (origin_tokens - compressed_tokens) * 0.06 / 1000` (`:715`, stima in dollari) |
| llmlingua/prompt_compressor.py | `control_context_budget` (`:1173`), `context_budget="+100"`, `rank_method`, `force_context_ids` |
| llmlingua/prompt_compressor.py | `iterative_compress_prompt` (`:1523`) → `get_compressed_input` (`:1402`): soglia di perplessità sui token |
| llmlingua/prompt_compressor.py | `iterative_size: int = 200` nelle firme di `compress_prompt`/`structured_compress_prompt` |
| llmlingua/prompt_compressor.py | `compress_json(json_data, json_config, …)` (`:215`) con `compress`/`pair_remove` per chiave |
| llmlingua/prompt_compressor.py | `recover(original_prompt, compressed_prompt, response)` (`:1751`) |
| llmlingua/utils.py | `process_structured_json_data`: due tag `llmlingua` con `compress=False` sulle chiavi non comprimibili |
| llmlingua/utils.py | `precess_jsonKVpair`: `rate==1` → `compress=False`; `force_tokens`/`force_reserve_digit` |
| tests/test_llmlingua.py | rapporti reali: `"1.4x"`, `"3.5x"`, `"1.3x"`, `"2.0x"` su `lgaalves/gpt2-dolly`, CPU |
| tests/test_llmlingua2.py | LLMLingua-2: `"2.1x"`, `"3.0x"`, `"4.5x"`, `"9.6x"` su `xlm-roberta-large-meetingbank` |
| DOCUMENT.md | «Prompt Sensitivity»: instruction/question alta sensibilità, context bassa; `rate`, `target_token` |
| Transparency_FAQ.md | «compress prompt up to 20x»; «can be used to compress KV-Cache»; limite: «may struggle … when the original prompts are already quite short» |
| experiments/securitylingua/readme.md | compressione security-aware per rivelare l'intenzione malevola (`use_slingua=True`) |
| .github/workflows/release.yml | pubblicazione su PyPI con `gh-action-pypi-publish`; unittest su Ubuntu/macOS/Windows |

## Domande aperte

- **Il «fino a 20×» non è verificato.** La riga di descrizione e il README lo attribuiscono ai paper (EMNLP'23 LLMLingua). Il repository non porta i benchmark: i test in `tests/test_llmlingua.py` mostrano 1.3×–3.5× su GSM8K e JSON strutturato con `lgaalves/gpt2-dolly` su CPU. Su quale benchmark e modello sia misurato il 20× non è stato accertato qui: sarebbe nel PDF dei paper, non nell'albero.
- **Niente è stato eseguito né scaricato**, come da divieto: i numeri sono dichiarazioni del target, non riprodotti. I modelli (`Llama-2-7b`, `phi-2`, `llmlingua-2-*`) si scaricano da Hugging Face e non sono stati toccati; la libreria vuole `torch`/`transformers` e di default `device_map="cuda"`.
- `llmlingua/prompt_compressor.py` è **2455 righe**: letto in larga parte e nelle funzioni chiave, non riga per riga. Restano poco esplorati `get_rank_results` (`:1818`, i backend di ranking: sentbert, openai, bge, cohere, voyageai, jinza), i metodi privati del cuore LLMLingua-2 e `segment_structured_context` (`:2072`).
- Gli `examples/*.ipynb` (RAG, CoT, Code, OnlineMeeting, Retrieval) sono stati letti solo in testa: l'uso pratico su output di retrieval è descritto dalla prosa, non provato.
- **Il confronto con Daiku non è like-for-like.** LLMLingua è una libreria di ricerca Python con dipendenze pesanti (`torch`, `transformers`, `tiktoken`, `nltk`, `numpy`), da eseguire su GPU o CPU; Daiku è Node a dipendenze zero, e il suo metodo rifiuta di riassumere (passa path, non trascrizioni). Per questo l'Asse A è vuoto e l'Asse B propone la *dichiarazione del budget* e la *marcatura dei fatti protetti*, non il motore a perplessità.
- L'albero è tutto codice e ricerca: **non porta `AGENTS.md` né `CLAUDE.md`**, nessuna skill, nessun comando, nessun hook. Nessun ordine scritto dentro un file è stato letto come istruzione, perché non ce n'erano.
