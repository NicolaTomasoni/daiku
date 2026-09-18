---
paths:
  - "apps/backend/app/**/*.py"
  - "apps/backend/tests/**/*.py"
  - "apps/backend/requirements*.txt"
  - "apps/backend/package.json"
  - "apps/backend/*.toml"
  - "apps/backend/*.ini"
---

# Architettura backend

## Flusso e layer

```text
API -> SERVICES -> (DETERMINISTIC_AGENTS + AGENTS + ADAPTERS + MAPPERS)
```

- Le API validano e serializzano HTTP, traducono errori e delegano. Non contengono business logic, prompt, filesystem o chiamate esterne.
- I service orchestrano casi d'uso, stato, run, validazioni applicative e persistenza tramite `StorageAdapter`. Non conoscono HTTP, SDK/CLI, formati tecnici esterni o path fisici.
- Gli adapter sono l'unico confine verso SDK, CLI, API esterne, tool di analisi, filesystem e parsing dei relativi formati. Codex passa da `CodexAdapter`, Sonar dall'adapter Sonar e ogni CLI dall'adapter del tool.
- `litellm` si importa solo in `app/adapters/llm.py`; il codice applicativo non istanzia client provider nativi.
- Il filesystem passa esclusivamente dal package `app/adapters/storage/`, con una sola facciata pubblica: `from app.adapters.storage import StorageAdapter`. Nessun accesso diretto a `data/`, sandbox, prompt statici o artefatti persistiti fuori da lì. I moduli interni possono essere organizzati per dominio di dato, ma il confine osservabile resta unico.
- I mapper trasformano dati già parsati in modelli canonici. Sono puri e deterministici: niente retrieval, persistenza, chiamate esterne, LLM o decisioni di business.
- Gli agenti deterministici applicano regole ripetibili a input preparati dal service. Non fanno I/O, persistenza, chiamate esterne, uso di adapter o logica LLM; il mapping uno-a-uno resta nei mapper.
- Gli agenti LLM ricevono input strutturati e producono output strutturati. Non leggono file, non persistono, non conoscono HTTP e non chiamano sistemi esterni.
  - **Eccezione già viva: la rete degli agenti che lavorano in `workspace-write`** (l'agente di abilitazione e quello di execution). Il canale è il toolset di rete sulla strada API (`build_web_toolset`, che si monta solo dove il chiamante passa `repo_tools`: l'agente di abilitazione non lo passa, quindi sulla strada API non ha nessun tool di rete) e la rete della sandbox su quella Codex, aperta da `_sandbox_config`. È rete **in sola lettura** — aprire la rete non allarga cosa l'agente può toccare — ma **non è confinata a una lista di domini**: la lista per tutti gli agenti che oggi ce l'hanno è una consegna separata, non un pezzo di questa. L'elenco di cosa leggere resta deciso dal service.
  - **Eccezione nuova, per il solo agente di procacciamento delle coordinate** (`enabling-procurement`). Perimetro: quell'agente, e nessun altro. Canale obbligato: la **ricerca nativa confinata da una lista di domini** sulla strada Codex, accesa dalle due chiavi che `WebSearchPolicy` compone nel dict di configurazione del fornitore. La lista (`ENABLING_PROCUREMENT_ALLOWED_DOMAINS` in `app/config.py`) è il confine solo insieme alla **sandbox di sola lettura**, dove `_sandbox_config` restituisce `None` e nessuna rete di sandbox si apre: l'agente che ipotizza non ha bisogno del worktree, quindi la ricerca con lista è l'**unico** canale di rete che ha. La stessa lista confina **ciò che il motore scarica**: una URL di repository proposta dall'agente la interroga il motore e ci deposita bytecode sotto le coordinate del cliente, quindi fuori lista (o non `https`) si **respinge** invece di provarla. **Budget dichiarato**: due turni per ondata — la passata senza rete e, solo su Codex, quella con la ricerca confinata —, `MAX_AGENT_HYPOTHESIS_WAVES` ondate per run, sei turni in tutto; e una sostituta ipotizzata si prova su `MAX_SUBSTITUTE_VERSION_PROBES` versioni. L'**elenco di cosa cercare è deciso dal service, mai dall'agente**: il service sceglie le coordinate da sottoporre, il package da pretendere, le versioni da provare e i domini consentiti; l'agente formula solo l'ipotesi, e la prova resta del motore.
  - La via B della ricerca confinata esiste **solo su Codex**: sulla strada API il passo esegue la sola via A, e il salto si dichiara nel referto. Il dettaglio delle due eccezioni sta nella hard rule 6 di `CLAUDE.md`; qui sta ciò che vale per un agente che scrive codice in questo repo.
- I modelli condivisi sono contratti trasversali: modificare `app/models.py` solo quando necessario e con il delta minimo.
- Configurazione runtime in `app/config.py`; dipendenze Python in `requirements.txt`.

## Prompt agentici

- Comportamento, tono, formato, vincoli e criteri di output vivono nell'`agent.md` dedicato, letto tramite `StorageAdapter`.
- L'assemblaggio del prompt finale con input strutturati è orchestrazione e può vivere nel service o nell'agente Python esistente.
- Non incorporare nei service istruzioni comportamentali inline al posto dell'`agent.md`.
- Ogni output AI deve essere verificabile sugli input forniti; niente dati, metriche, stati, fonti, responsabilità o decisioni inventate.
- La chat si basa sui documenti forniti e dichiara quando le evidenze non bastano; decision card e analisi restano tracciabili alle evidenze.

## Run lunghe

Le run lunghe seguono il pattern condiviso:

```text
start_*: valida, persiste running, ritorna 202
execute_*: esegue in background
get_*: espone lo stato al polling
```

Nessuna richiesta HTTP resta aperta durante una run lunga.

## Orientamento

Prima di creare un componente, consulta il catalogo pertinente in memory (`backend-services`, `backend-adapters`, `backend-agents`) e verifica se il caso d'uso estende quello esistente. Aggiorna il catalogo solo quando aggiungi, rinomini o rimuovi un componente oppure ne sposti la responsabilità.

## Gate

- Esegui test mirati durante l'iterazione.
- Prima di considerare completa una modifica backend, dalla root esegui `pnpm --filter @reforgia/backend check`.
- Il gate esegue Ruff lint, Ruff format check e pytest; il pytest mirato non sostituisce il gate completo.
- Se esegui pytest direttamente, usa `apps/backend/venv/Scripts/python.exe -m pytest`, non `py -m pytest` dalla root.
