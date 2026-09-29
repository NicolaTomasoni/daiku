---
name: cosa-codex-fa-allinstallazione
description: "Cosa fa Codex quando installa un pacchetto — copia l'albero, migra i comandi storpiandoli, non fa partire gli hook di un pacchetto — e il prezzo che ne segue"
metadata:
  type: project
---

Verificato il 18 settembre 2026 installando un pacchetto di prova per davvero (`codex plugin
marketplace add`, poi `codex plugin add daiku-prova@daiku-banco`):

- **L'albero è copiato verbatim** in `~/.codex/plugins/cache/<marketplace>/<plugin>/<versione>/` —
  la stessa forma di path di Claude Code (`~/.claude/plugins/cache/...`). `agents/`, `commands/`,
  `contracts/` e `hooks/` arrivano tutti.
- **`config.toml` riceve due blocchi**: `[marketplaces.<nome>]` con `source_type` e `source`, e
  `[plugins."<plugin>@<marketplace>"]` con `enabled = true`.
- **I `commands/` vengono migrati d'ufficio in skill**, ma la migrazione **storpia il nome**:
  Codex genera `.codex-plugin/migrated-command-skills/source-command-<nome>/SKILL.md`, e il corpo
  originale finisce sotto un preambolo generato dentro una sezione `## Command Template`. Per Daiku
  è inutilizzabile — i contratti si citano fra loro per nome, e un nome riscritto rompe ogni
  rimando. Da qui la regola: **i contratti si scrivono come `skills/`, non come `commands/`**; la
  migrazione automatica è un ripiego per chi ha solo comandi.
- **Gli hook di un pacchetto non partono, e non è una svista.** `codex features list` dichiara
  verbatim `hooks stable true` e `plugin_hooks removed false`. Gli hook di Codex esistono e
  funzionano, ma solo dichiarati in `~/.codex/hooks.json` o `<repo>/.codex/hooks.json`: è il mestiere
  di `sync-host`, non del pacchetto.

**Dove vanno i contratti di riferimento.** La via di fuga di una cartella col punto —
`skills/.contratti/`, che il validatore Codex salta — **non funziona su Claude Code**, che quella
cartella la scandisce: `claude plugin validate` ha aperto `skills/.contratti/SKILL.md` e ha
segnalato il frontmatter mancante. Spostati in una cartella di primo livello, `contracts/`, i file
sono ignorati da entrambi i validatori e trasportati da entrambi gli host.

**Due trappole operative.**

**La fiducia di un hook Codex è registrata sull'hash dell'hook.** Ogni aggiornamento che ne tocchi
uno fa ri-chiedere l'approvazione con `/hooks`, e il sistema sta dietro il gate `features.hooks`.
Insieme al punto sopra, significa che su Codex gli hook sono il pezzo più caro da mantenere e il
meno automatizzabile: un hook che esiste e non parte è peggio di un hook assente, perché sembra
esistere.

**`rules/` su Codex è già un'altra cosa**: `~/.codex/rules/default.rules` sono file Starlark che
governano l'esecuzione dei comandi fuori sandbox. Il nome è stato abbandonato per il livello
Dominio, che in Daiku è `policies/`, per non collidere con un concetto di sicurezza dell'host.

Vedi [[cosa-i-due-host-accettano]], [[installazione-e-versionamento]],
[[subagent-codex-nessun-confine]] e [[guardrail-nascono-spenti]].
