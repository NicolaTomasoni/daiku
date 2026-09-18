---
name: nightly-plan
description: Da un input testuale (cartelle target sotto docs/nuovi-sviluppi + soluzione scelta per ciascuna) genera la coda statica docs/nightly/nightly-run.json — l'input che /nightly-orchestrator consuma. È solo un generatore di coda, non esegue nulla.
argument-hint: [cartella -> soluzione scelta; cartella -> soluzione scelta; ...]
---

Trasformi l'indicazione a voce dell'utente — **quali cartelle** processare stanotte e **quale soluzione** è stata scelta per ciascuna — in un unico file di stato macchina, `docs/nightly/nightly-run.json`, che `/nightly-orchestrator` legge e consuma. Questa skill **non esegue** blueprint, execute o review: prepara solo la coda, con i percorsi **hardcodati** e verificati, così la run notturna parte da zero senza doverti chiedere nulla.

`docs/nightly/` è la cartella dedicata agli artefatti della catena notturna (la coda e il deliverable append-only che `/nightly-orchestrator` scrive man mano): creala se non esiste.

Sei l'unico momento della catena notturna in cui l'utente è presente: qui **puoi e devi chiedere** se qualcosa è ambiguo (soluzione mancante, cartella inesistente, decision-doc assente). Da `/nightly-orchestrator` in poi non si chiede più.

## Parametri di ambiente

Leggi `.claude/environment.json` prima di agire: è la sola fonte dei valori di ambiente di questo
host e di questa macchina. Le chiavi citate in questo contratto fra graffe e apici inversi si
risolvono da lì, mai a memoria e mai per assunzione. Se una chiave citata non c'è, quella cosa
**non esiste in questo ambiente**: salta la parte che la usa, dichiaralo nell'esito, non
inventarla e non chiederla. La forma del file è in `.claude/project-contract.md`; le sue chiavi
sono nella §7 di `.claude/orchestration.md`.

## Input

Argomenti: `$ARGUMENTS` — testo libero in cui l'utente elenca le cartelle target e, per ciascuna, la soluzione scelta. Le cartelle sono **sempre** sotto `docs/nuovi-sviluppi/` e vanno indicate col solo nome (es. `resource-leaks`), non col path completo: il path lo **hardcodi tu** nel JSON.

L'utente può anche indicare il **backend LLM** su cui girerà la notte: uno dei nomi dichiarati in `{backends}`. Se non lo nomina, il default è `{hosts.<host>.native_backend}`: il backend attivo quando l'host non è switchato.

Forme accettate (interpretale con buon senso, non pretendere una sintassi rigida):

```text
resource-leaks -> Soluzione 1
db -> Opzione B (Postgres + AGE)
analyzer-locali -> Soluzione 2 — adapter SpotBugs
```

È accettata anche la forma a campi, con un blocco `feature:` (una cartella per riga) e il backend su `model:`:

```text
feature:
mock1 1A
mock2 1A

model: claude
```

Ogni riga sotto `feature:` è `<cartella> <riferimento>`, dove `<riferimento>` è `<numero decisione><lettera opzione>` (es. `1A` = Decisione 1, opzione A) così come numerata nel `1. decision-doc.md` di quella cartella. Non è una scorciatoia libera: **apri sempre il decision-doc e verifica che la decisione e l'opzione indicate esistano davvero** con quel numero/lettera. La `selected_solution` che scrivi in coda è il testo dell'opzione risolta (numero, lettera e contenuto), non solo il codice `1A`.

- Se `$ARGUMENTS` è vuoto, **chiedi** all'utente l'elenco. Non generare una coda vuota.
- Per ogni voce estrai la coppia **(nome cartella, soluzione scelta)**. La soluzione scelta è la stringa che passerai poi a `/blueprint` come argomento "soluzione scelta": tienila fedele a come l'utente l'ha espressa (nella forma a campi, al testo dell'opzione risolta dal decision-doc).
- Un riferimento che non trova corrispondenza nel decision-doc (decisione o opzione inesistente) → **fermati e chiedi**, non indovinare la più vicina. Vale anche se in una cartella ci sono più decisioni e l'utente ne ha risolta solo una: le altre restano ambigue, chiedi.
- `model:` è il `backend` della coda, verbatim: vale solo un nome dichiarato in `{backends}`. Un valore che lì non compare → **fermati e chiedi**, non indovinare né normalizzare.

## Principi

1. **Percorsi hardcodati e verificati, non indovinati.** Per ogni cartella componi il path `docs/nuovi-sviluppi/<nome>` e **verificalo sul filesystem**: la cartella deve esistere e contenere `1. decision-doc.md`. Se la cartella non esiste o il decision-doc manca, **fermati e chiedi** — non mettere in coda un item che l'orchestratore non potrà lavorare.
2. **La soluzione scelta è obbligatoria.** L'orchestratore gira senza utente: `/blueprint` non potrà chiedere quale opzione. Se per una cartella la soluzione manca o è ambigua rispetto alle decisioni del suo `1. decision-doc.md`, **apri il documento, elenca le decisioni/opzioni e chiedi ora**. Non inventare una scelta.
3. **Ancora al reale, non al desiderio.** Non aggiungere in coda cartelle che l'utente non ha nominato, non riordinare per tua iniziativa, non arricchire con item speculativi. La coda contiene solo ciò che l'utente ha chiesto, nell'ordine in cui l'ha chiesto.
4. **Input strutturato, non prosa.** Il file è JSON perché `/nightly-orchestrator` lo legge e lo consuma come coda — ed è **statico**: la ripresa dopo un'interruzione non passa da qui, si ricostruisce dallo stato osservabile (vedi quella skill). Non aggiungere campi non previsti dallo schema; non usare commenti (JSON non li ammette).

## Procedura

1. **Parsa `$ARGUMENTS`** in una lista ordinata di coppie (nome, soluzione). Se vuoto o incompleto, chiedi.

2. **Verifica ogni cartella.** Per ciascun nome: controlla che `docs/nuovi-sviluppi/<nome>/` esista e contenga `1. decision-doc.md`. Se manca qualcosa, chiedi e correggi prima di procedere. Se la soluzione scelta è ambigua, apri il decision-doc, mostra le opzioni e chiedi.

3. **Ricava il `run_id`** dalla data odierna reale (`Get-Date -Format yyyy-MM-dd` in PowerShell), nel formato `nightly-<YYYY-MM-DD>`. Se una coda con lo stesso `run_id` esiste già in `docs/nightly/nightly-run.json`, **segnalalo** e chiedi se sovrascriverla o accodare un suffisso (`-2`) al `run_id`.

   **Fissa il `backend`**, uno dei nomi dichiarati in `{backends}`. Dichiara
   l'**ambiente** su cui girerà la notte, non i modelli: quelli li sceglie ogni skill dal ruolo
   dichiarato per il passo, secondo `.claude/orchestration.md`. È a livello di run, non
   per-item: lo switch tra backend cambia le env var di `{hosts.<host>.settings_file}` a livello
   di processo e richiede un reload window, quindi non è cambiabile a metà run — una notte, un
   backend.

   Serve a due cose sole, entrambe di `/nightly-orchestrator`: il **pre-flight** (l'ambiente
   attivo deve coincidere con quello dichiarato, altrimenti la run aborta) e la **concorrenza**
   del fan-out di review. Del backend che hai fissato riporta in riepilogo i
   `{backends.<backend>.caveats}`, uno per riga, senza interpretarli e senza aggiungerne di
   propri; se quel backend non li dichiara, il riepilogo lo dice in una riga — hai guardato e
   non c'è nulla da avvisare — invece di tacere.

   Non derivare campi di modalità (`subagent_mode`, `mode` o simili): la concorrenza è una
   regola sola, scritta in `.claude/orchestration.md` §5, e una copia qui si disallineerebbe al
   primo cambiamento.

4. **Scrivi `docs/nightly/nightly-run.json`** con lo schema sotto. È **solo l'input statico**
   della run: nessun campo di stato/avanzamento (niente `status`, `current_phase`,
   `commit_sha`, `blockers`, `log` — lo stato reale è osservabile da
   `docs/nightly/nightly-review.md`, dagli artefatti numerati nella cartella di ciascun item e da
   `git log`, non da questo file).
   Salva in **UTF-8** (accenti italiani intatti).

5. **Riepiloga in chat** in poche righe: `run_id`, numero di item, e per ciascuno cartella + soluzione scelta. Chiudi indicando il passo successivo: `/nightly-orchestrator docs/nightly/nightly-run.json` per avviare la run (idealmente dal terminale integrato, per una sessione lunga).

## Schema di `docs/nightly/nightly-run.json`

```json
{
  "run_id": "nightly-2026-07-10",
  "created_at": "2026-07-10",
  "backend": "claude",
  "commit_policy": "commit_if_green_and_no_blockers",
  "items": [
    {
      "id": "resource-leaks",
      "folder": "docs/nuovi-sviluppi/resource-leaks",
      "decision_doc": "1. decision-doc.md",
      "selected_solution": "Soluzione 1 — try-with-resources"
    }
  ]
}
```

Semantica dei campi (input statico: tu li scrivi una volta, nessuno li muta più a run in corso):

- **`run_id`** — identificativo della run, dalla data (`nightly-<YYYY-MM-DD>`). Serve all'uomo per riconoscere la notte, e ai titoli del riepilogo.
- **`backend`** — ambiente LLM della run: un nome dichiarato in `{backends}`, di default `{hosts.<host>.native_backend}`. `/nightly-orchestrator` lo usa per il pre-flight e per la concorrenza del fan-out di review; **non** per scegliere i modelli, che vengono dai ruoli (`.claude/orchestration.md`). A livello di run, immutabile a metà run.
- **`commit_policy`** — `"commit_if_green_and_no_blockers"`: si committa solo a gate verde e senza blocker (documentativo: la policy è comunque scritta in `deliver-feature.md`).
- **`id`** — slug breve dell'item (di norma il nome cartella).
- **`folder`** — path **hardcodato e verificato** `docs/nuovi-sviluppi/<nome>`.
- **`decision_doc`** — nome del documento di decisione dentro la cartella (default `1. decision-doc.md`).
- **`selected_solution`** — la soluzione scelta, verbatim, che la consegna passa al brief.

Non esistono campi di stato/avanzamento (`status`, `current_phase`, `commit_sha`, `blockers`,
`post_commit_decisions`, `log`): la ripresa di una run interrotta si ricostruisce dallo stato
osservabile — `docs/nightly/nightly-review.md`, gli artefatti numerati nella cartella di ciascun item e
`git log` — non dalla rilettura di questo file. Vedi
`.claude/commands/nightly-orchestrator.md`, *Ripresa dopo un'interruzione*.

## Regola di taglio

Il tuo unico output è `docs/nightly/nightly-run.json` più il riepilogo. Non lanci blueprint, non leggi codice applicativo, non generi il deliverable notturno: quello è compito di `/nightly-orchestrator`. Se ti accorgi di star ragionando su *come* si esegue un item, ti sei allontanato dallo scopo — tu prepari solo la coda.
