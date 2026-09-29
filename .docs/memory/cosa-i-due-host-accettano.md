---
name: cosa-i-due-host-accettano
description: "I due manifest e le due vetrine, i campi che Codex rifiuta, la via di fuga di agents/openai.yaml e il confine che vale su entrambi — nessun pacchetto scrive nel progetto"
metadata:
  type: project
---

`skills/<nome>/SKILL.md` è **l'unico primato che i due host leggono identico**, stesso layout su
entrambi: è la ragione per cui i contratti di Daiku sono skill e non comandi, e per cui `skills/`
non annida. Tutto il resto diverge, e il pacchetto lo assorbe con due file per host: due manifest,
`.claude-plugin/plugin.json` e `.codex-plugin/plugin.json`, e due vetrine,
`.claude-plugin/marketplace.json` e `.agents/plugins/marketplace.json` — che Codex legge **anche**
quando è quella di Claude. Non sono ridondanza evitabile: sono i quattro file che i due host
cercano, e vanno tenuti allineati. Dove stanno è in [[alberatura-pacchetto]].

**Le chiavi che il manifest Codex accetta sono tredici**: `id`, `name`, `version`, `description`,
`skills`, `apps`, `mcpServers`, `interface`, `author`, `homepage`, `repository`, `license`,
`keywords`. Il 18 settembre 2026 un pacchetto di prova con i campi contestati è stato passato al
validatore di prima parte — `~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py`,
che per sua stessa dichiarazione rispecchia lo schema di ingestione del workspace — e la risposta è
stata, verbatim:

```text
- plugin.json field `agents` is not accepted by plugin validation
- plugin.json field `commands` is not accepted by plugin validation
- plugin.json field `hooks` is not accepted by plugin validation
- skill `orchestration` frontmatter field `disable-model-invocation` must be false
```

**Ma il divieto è sul dichiararli, non sull'esistere.** Un albero che porta `agents/`, `commands/` e
`hooks/` presenti e **non dichiarati** passa la validazione Codex *e* quella di Claude Code: cosa
farne lo decidono i due host. È la forma che Daiku ha scelto, e la ragione per cui un pacchetto solo
gira su due host con due gradi di automazione diversi.

**`disable-model-invocation: true` su Codex è rifiutato**, e l'equivalente sta fuori dal frontmatter:
`skills/<nome>/agents/openai.yaml` con `policy.allow_implicit_invocation: false`. Con `false` la
skill non viene iniettata nel contesto del modello, ma resta invocabile a mano. Il prezzo sono due
campi diventati obbligatori, `display_name` e `short_description`. Verificato: il pacchetto di prova
con quel file passa la validazione di **entrambi** gli host. Serve sui contratti interni — senza,
finirebbero tutti nel contesto di ogni sessione Codex, e i contratti interni sono la maggioranza
(vedi [[punti-ingresso-prodotto]]).

Il manifest chiede inoltre, con validazione stretta, `name`, `version` in **semver stretto**,
`description`, `author.name` e un oggetto `interface` completo — `displayName`,
`shortDescription`, `longDescription`, `developerName`, `category`, `capabilities` (array di
stringhe) e `defaultPrompt`. Nessuno di questi è facoltativo.

**Un rimando dentro il pacchetto non è mai un path assoluto.** `${CLAUDE_PLUGIN_ROOT}` cambia a ogni
aggiornamento, e su Codex l'host passa alla skill il path assoluto del suo `SKILL.md` e nient'altro.
Restano due forme: il nome con lo slash per una skill (`/review`, `/commit`), e il path **relativo
alla radice del pacchetto** per un contratto di riferimento (`contracts/orchestration.md`). Le
variabili che i due host espongono le dichiara `skills/sync-host/SKILL.md`, che è la sede normativa:
qui non si ricopiano.

**E vale su entrambi un confine che non si aggira: nessun pacchetto scrive nel progetto
dell'utente.** Su Claude Code è un confine di sicurezza dichiarato — path traversal fuori dalla
radice rifiutato, symlink verso l'esterno saltati — e il pacchetto è solo *letto da dove sta
installato*. Ne segue che i livelli parametri e dominio non si consegnano: li **genera** un comando
che lancia l'utente, ed è il mestiere di `init` (vedi [[init-scrive-le-istruzioni]] e
[[tre-livelli-di-parametro]]). Un pacchetto che provò a ignorarlo impacchettando il solo livello
Metodo è stato rimosso il 18 settembre 2026 insieme alla sua versione orfana in cache.

**How to apply:** prima di aggiungere una cartella al pacchetto, chiedersi chi la legge. Se la legge
un host solo, va bene — purché non la si dichiari nel manifest Codex. Se non la legge nessuno dei
due, va in `contracts/` o fuori dal pacchetto.

Vedi [[cosa-codex-fa-allinstallazione]], [[installazione-e-versionamento]] e
[[subagent-codex-nessun-confine]].
