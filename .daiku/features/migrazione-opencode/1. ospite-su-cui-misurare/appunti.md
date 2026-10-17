# Un ospite su cui misurare — appunti di lavoro

> Stato del 17 ottobre 2026. Appunti di sessione, non è un documento della catena.

## Dove siamo

- Decisioni tecniche 1, 2 e 3 incorporate in `1. decision-doc.md`, tutte sull'opzione A (raccomandata). Le righe `Choice:` sono sul disco, non committate.
- La consegna (`ship-feature`) si è fermata prima della fase 0: stage, commit e review lavorano solo su `plugins/`, e i due file di apertura (`opencode.json`, `AGENTS.md`) stanno in radice.
- Alla domanda su come consegnarli l'owner ha risposto A (allargare il perimetro). Quel cambio tocca il metodo di `ship-feature`, `commit` e `update-memory`.

## Indicazione dell'owner (ultima)

- Non cambiare il sistema automatico: il cambio di perimetro arriverà con l'installazione della nuova versione di Daiku in questo workspace.
- Per ora i passi si fanno a mano, dentro il workspace di Daiku:
  - creare `opencode.json` e `AGENTS.md` in radice;
  - installare il pacchetto da `edge` su opencode (decisione 2, opzione A);
  - controllare che l'installazione funzioni (decisione 3, opzione A: sola lettura).
- Il salvataggio nel repository non si fa: nessun commit, nessun push.

## Verificato

- `opencode --version` → `opencode v2.0.30`. Gli appunti di studio (`.daiku/studies/opencode.md`) sono sulla `2.0.29`: stessa linea, copia diversa. Divario da tenere: `[to verify]`.
- CLI in PATH: `C:\nvm4w\nodejs\opencode.cmd`.
- Radice del repository: `opencode.json` e `AGENTS.md` non esistevano prima di questa sessione (Glob, 17 ottobre 2026).
- Sintassi dello specifier Git per `opencode plugin add`: non confermata dalle fonti (`.daiku/studies/opencode.md` §4.2, `[to verify]`).

## Fatto in questa sessione (17 ottobre 2026)

- **Creati a mano in radice:** `opencode.json` (solo `$schema`, nessuna chiave di annidamento) e `AGENTS.md` (breve, rimanda a `CLAUDE.md`). Non committati.
- **Installato:** `opencode plugin add "git+https://github.com/NicolaTomasoni/daiku.git#edge"` → «installed and added to C:\Users\tomas\.config\opencode\opencode.json». Lo specifier che ha funzionato è quello qui sopra.
- **Controllo in sola lettura (decisione 3):**
  - versione: `opencode v2.0.30`;
  - `opencode plugin list --builtin` elenca `daiku`, versione `141dc6a`, sorgente `git+…#edge`; il sha coincide con la punta di `origin/edge`;
  - `opencode plugin list` senza `--builtin` dice «No plugins found»: il plugin c'è, ma quel comando non lo mostra. Da tenere come osservazione;
  - `opencode debug config` risolve il `opencode.json` globale (con il plugin) e quello di progetto in radice.
- **Osservato:** `C:\dev\daiku\.opencode\` esiste e non contiene file, ma contiene 62 cartelle vuote (`agents/`, `daiku/…`, `plugins/`, `skills/…`), non tracciate da git. Non le ho create a mano; l'origine non è verificata. Non toccate.
- **Consegna ripresa:** fermata in fase 3 (review), come prima sul perimetro: nessun file sotto `plugins/` da rivedere. Nessuno stage, commit o merge. Slot `agent-tree-2` registrato `blocked`, albero pulito. Report in `5. delivery-report.md`.

## Aperto

- Il plugin è installato e risolto, ma non è stato provato che giri dentro una sessione di opencode: questo è il lavoro della scheda 2 (prova viva), non di questa.
- `plugin list` senza `--builtin` non mostra il plugin: va capito se è il comportamento atteso.
- `experimental.subagent_depth` non viene impostato: il valore resta alla scheda 8, aperta.
- Il perimetro di consegna resta `plugins/` finché il cambio non arriva con la nuova versione: la consegna si fermerà di nuovo sullo stesso punto.
