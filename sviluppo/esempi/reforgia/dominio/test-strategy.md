# Strategia di test — ReforgIA

Risponde alle domande che `/test-coverage` pone a questo progetto: quali sono le macrocategorie, come si legge l'output dei comandi di misura e quali artefatti lasciano, quale perimetro copre davvero il runner di ciascuna area, quali convenzioni seguono i test già scritti e da quale punto di forza si testa ciascun layer.

I comandi letterali non stanno qui: sono in `.claude/project.json`, area per area. Le regole architetturali nemmeno: sono le hard rule del `CLAUDE.md` e le rule di area in `.claude/rules/`.

## Macrocategorie

Ogni file misurato si mappa al suo layer per path:

| Macrocategoria | Path |
|---|---|
| API | `app/api/` |
| Services | `app/services/` |
| Adapters | `app/adapters/` |
| Mappers | `app/mappers/` |
| Deterministic agents | `app/deterministic_agents/` |
| Agents | `app/agents/` |
| Modelli & config | `app/models.py`, `app/config.py`, `app/main.py`, `app/run_event_bus.py` e resto di `app/` non classificato |

È la tassonomia del backend, e la macrocategoria residuale è *Modelli & config*. Il frontend non si suddivide per layer: è una riga sola, quella del perimetro che il suo runner copre (sotto).

## Leggere la misura, e cosa lascia dietro

**Backend.** I due comandi di `areas.backend.coverage` producono `coverage.json` nella loro cwd (`apps/backend/`): contiene, per ogni file, `summary.num_statements` e `summary.missing_lines` / `covered_lines`. Per le sole righe scoperte di una categoria va bene anche `coverage report --show-missing` scopato alla categoria.

`coverage` è già installato nel venv; **`pytest-cov` no** — non installarlo, non serve. Non ripiegare su `py -m pytest` dalla root: è l'interprete sbagliato. Se il venv o `coverage` non ci sono, fermati e segnalalo.

Artefatti che la misura lascia da rimuovere: `coverage.json` e `.coverage` in `apps/backend/`. Non vanno committati.

**Frontend.** `areas.frontend.coverage` gira sul runner di `apps/desktop/vitest.config.ts` (`environment: "node"`, coverage provider v8, `all: true`) e stampa il reporter `text` a schermo: la misura si legge lì, non da un file, e non lascia artefatti da pulire. Non installare nulla: il tooling c'è già.

## Il perimetro che il runner copre davvero

**Backend**: tutto `app/` (`--source=app`), quindi l'intera area.

**Frontend**: il `coverage.include` del config limita il perimetro a ciò che il runner testa davvero — mapper (`src/api/mappers/*.ts`), parser (`src/api/parsers/*.ts`), domain builder (`src/domain/*-builders.ts`) — e con `all: true` i file di quel perimetro ancora senza test compaiono a 0%, numero onesto. La riga di tabella del frontend riporta **questa** copertura, non quella dell'intero frontend.

Hook con effetti, componenti renderizzati e route restano fuori dal runner (nessun setup React/Tauri): si dichiarano tali, non si contano come scoperti e non si aggirano. Nessuno scaffolding da proporre né dipendenze da aggiungere: il tooling è già a posto.

Testabile nel frontend è quindi il **modulo puro**: mapper (`src/api/mappers/`), parser (`src/api/parsers/`), builder di dominio (`src/domain/*-builders.ts`), funzioni di `lib/`, e logica pura estratta da hook e componenti in file `.ts` **senza JSX**.

## Convenzioni dei test già scritti

- **Stile backend**: `unittest.TestCase` con `assertEqual`/`assertRaises`/`assertIn`, eseguito con `pytest`. È lo stile dominante — usalo, non introdurre fixture pytest o `parametrize` se il file fratello non li usa.
- **Fake scritti a mano, non `MagicMock`**: lo stile dominante sono decine di classi `Fake*` esplicite; `MagicMock` sopravvive in una minoranza di file e non è il modello da imitare. Per ogni sistema esterno inietta un fake esplicito (`FakeCodexAdapter`, `FakeGitAdapter`, `FakeMavenTestAdapter`, `FakeWorkspaceService`…) che **scripta gli output** e **registra le chiamate**. Un fake dice cosa succede in modo leggibile; un mock nasconde il contratto.
- **Commenti in italiano** che spiegano il comportamento del fake e l'intento del test, come nei file esistenti.
- **Filesystem solo via `StorageAdapter` su temp**: `with TemporaryDirectory() as d: storage = StorageAdapter(Path(d) / "projects")`. **Mai** toccare `data/`, `%APPDATA%\ReforgIA`, sandbox o artefatti reali. Nessun test scrive nel repo dell'utente.
- **Golden fixture** per parsing/mapping: output reale del tool esterno salvato in `tests/fixtures/<tool>/*.json`, letto dal test. Se serve una fixture nuova, cattura output realistico e mettilo lì, non stringhe inline gigantesche.
- **Determinismo totale**: niente rete, subprocess reali (mvn/git/codex/jQAssistant), tempo reale o random. I timestamp si **passano come argomento** (il codice già lo fa: `timestamp=...`) — rispecchia quel pattern invece di mockare l'orologio.
- **Stile frontend**: Vitest con `describe/it/expect`, nomi dei casi in italiano, payload costruiti da helper locali (`function payload(overrides = {}) {...}`) con override per variante; nessun mock di modulo se il file fratello non lo usa. Fratelli di riferimento: `src/api/mappers/run-mappers.test.ts`, `src/features/projects/lib/git-host.test.ts`.

### Dove va un test nuovo

- **Backend**: nel file `tests/test_<module>.py` esistente del modulo; creane uno nuovo solo se il modulo non ne ha. Fixture nuove sotto `tests/fixtures/<tool>/`.
- **Frontend**: file `<modulo>.test.ts` accanto al modulo.

## Strategia per layer

Ogni layer si testa dal suo punto di forza architetturale:

- **Mappers** (`app/mappers/`) — puri e deterministici. Golden fixture in → modello canonico out, asserzione **campo per campo 1:1**. Zero mock. Massimo ROI, i più facili: partire da qui se la categoria lo permette.
- **Deterministic agents** (`app/deterministic_agents/`) — puri, nessun I/O. Input strutturato già preparato → asserisci classificazione/priorità/payload. Zero mock.
- **Adapters** (`app/adapters/`) — confine con l'esterno. Testa la **metà di parsing** (output registrato del tool → record) contro fixture; per la metà che lancia processi/HTTP asserisci **come costruisce comando/URL/args** con un runner o transport finto, senza eseguire nulla di reale. Tipizza e verifica gli errori dedicati (es. `JQAssistantScanError`, `GitError`), non `RuntimeError` generico.
- **Services** (`app/services/`) — orchestrazione. Inietta fake adapter + `StorageAdapter(temp)` reale. Copri: **macchina a stati** delle run asincrone (`running → completed | failed` con `reason`), **persistenza** (rileggi l'artefatto dallo storage e verificalo), semantica di **pulizia KB**/registry, propagazione errori (adapter solleva → run `failed` motivata), input **vuoti/edge** e **cancel/timeout**. Asserisci su **output e stato persistito**, non su quali metodi privati sono stati chiamati.
- **Agents** (`app/agents/`) — assemblaggio prompt + parsing dell'output strutturato. Verifica che il prompt includa gli input richiesti e che un **JSON malformato dell'LLM** sia gestito. Non chiamare Codex.
- **API** (`app/api/`) — endpoint sottili. FastAPI `TestClient`: status code, validazione (422 su input errato), **delega** al service (service finto), traduzione errori. Non ri-testare qui la business logic: quella sta nei test del service.
- **Frontend puro** — mapper/parser/builder di dominio: DTO in → dominio out con asserzioni **campo per campo**, incluse le normalizzazioni (trim, `null` → `undefined`) e gli input malformati. Funzioni di `lib/` e logica pura estratta da hook/componenti: input → output, edge e vuoti.

## Ordine di ritorno

Mapper e deterministic agent scoperti sono il quick win: puri, zero mock, il ritorno più alto per riga scritta — è da lì che si parte quando la categoria lo permette.
