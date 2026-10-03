# Hook di Codex CLI — eventi, schema, decisioni, fiducia, sessioni e plugin

Appunti operativi raccolti da fonti reali. Oggetto: il **contratto degli hook dell'host Codex CLI** (OpenAI Codex CLI), cioè come un progetto cabla gli hook in `.codex/hooks.json`, cosa ogni evento può restituire, come si approvano, dove vive il transcript e se un pacchetto (plugin) può portarne di propri.

- **Versione in uso nel progetto**: **0.155.0** — `codex-cli 0.155.0` (npm `@openai/codex@0.155.0`), release `rust-v0.155.0` pubblicata il **2026-09-17** (fonte: `gh release view -R openai/codex rust-v0.155.0`).
- **Ultima versione stabile**: **0.160.0** — `rust-v0.160.0`, pubblicata il **2026-10-01** (`gh release view`). Fuori vista: pre-release `rust-v0.162.0-alpha.*` al 2026-10-03.
- **Data di raccolta**: 2026-10-03.
- **Nota sul cutoff del modello**: le fonti sono state lette on-line alla data di raccolta; ciò che non è stato confermato da una pagina letta o da un comando locale eseguito è marcato `[to verify]`.
- **Copertura della versione**: si documenta **la versione in uso, 0.155.0**. La differenza verso la 0.160.0 è dichiarata nella §6.1.
- **Contesto del progetto**: `.daiku/project.json` **non** dichiara `documents.stack` né `documents.architecture`: l'assenza è visibile qui e non è stata inventata.

## Indice

1. **Fondamenti** — meta e fonti; modello mentale (eventi, schema `.codex/hooks.json`, matcher, sedi di scoperta); esempio completo; setup e quickstart
   - [1.1 Meta e fonti](#11-meta-e-fonti)
   - [1.2 I dodici eventi cablabili](#12-i-dodici-eventi-cablabili)
   - [1.3 Schema di `.codex/hooks.json`: tre livelli e handler](#13-schema-di-codexhooksjson-tre-livelli-e-handler)
   - [1.4 Il `matcher`](#14-il-matcher)
   - [1.5 Sedi di scoperta, mixing, precedenza](#15-sedi-di-scoperta-mixing-precedenza)
   - [1.6 Esempio `hooks.json` completo](#16-esempio-hooksjson-completo)
   - [1.7 Setup, quickstart e modello mentale](#17-setup-quickstart-e-modello-mentale)
2. **Primitive principali** — cosa può restituire ciascun evento (iniettare, negare, riscrivere, fermare) e codici d'uscita
   - [2.1 Capacità e forma d'uscita per evento](#21-capacità-e-forma-duscita-per-evento)
   - [2.2 Le due forme di blocco](#22-le-due-forme-di-blocco)
   - [2.3 Iniezione di contesto](#23-iniezione-di-contesto)
   - [2.4 Campi parsati ma NON supportati, per evento](#24-campi-parsati-ma-non-supportati-per-evento)
   - [2.5 Campi d'uscita comuni](#25-campi-duscita-comuni)
   - [2.6 Spilling dell'output grande e hook in background](#26-spilling-delloutput-grande-e-hook-in-background)
   - [2.7 stdin: campi comuni e per evento](#27-stdin-campi-comuni-e-per-evento)
3. **Infrastruttura: sessioni e transcript**
   - [3.1 Esiste un equivalente del transcript, leggibile da un hook?](#31-esiste-un-equivalente-del-transcript-leggibile-da-un-hook)
   - [3.2 Dove stanno le sessioni e che forma hanno](#32-dove-stanno-le-sessioni-e-che-forma-hanno)
   - [3.3 `agent_transcript_path` su `SubagentStop`](#33-agent_transcript_path-su-subagentstop)
   - [3.4 `migrate-rollouts` / sqlite — la storia si sposta dal JSONL?](#34-migrate-rollouts--sqlite--la-storia-si-sposta-dal-jsonl)
   - [3.5 Esiste uno store di sessione project-local?](#35-esiste-uno-store-di-sessione-project-local)
4. **Estensione: un pacchetto (plugin) può portare hook propri?**
   - [4.1 Cosa dicono i docs ufficiali](#41-cosa-dicono-i-docs-ufficiali)
   - [4.2 La contraddizione, risolta onestamente](#42-la-contraddizione-risolta-onestamente)
   - [4.3 Campi ammessi e rifiutati per `.codex-plugin/plugin.json`](#43-campi-ammessi-e-rifiutati-per-codex-pluginpluginjson)
   - [4.4 Dove stanno gli hook senza un pacchetto](#44-dove-stanno-gli-hook-senza-un-pacchetto)
   - [4.5 `codex plugin --help` (0.155.0)](#45-codex-plugin---help-01550)
5. **Configurazione e ciclo di vita: la fiducia**
   - [5.1 Come si approva un hook di progetto](#51-come-si-approva-un-hook-di-progetto)
   - [5.2 Dove è registrato il trust](#52-dove-è-registrato-il-trust)
   - [5.3 Cosa succede a un hook non approvato](#53-cosa-succede-a-un-hook-non-approvato)
   - [5.4 `--dangerously-bypass-hook-trust`](#54---dangerously-bypass-hook-trust)
   - [5.5 Hook gestiti (managed)](#55-hook-gestiti-managed)
   - [5.6 User vs project vs plugin](#56-user-vs-project-vs-plugin)
   - [5.7 Disabilitare gli hook (e feature flag)](#57-disabilitare-gli-hook-e-feature-flag)
6. **Novità, changelog e limiti**
   - [6.1 Finestra di versione 0.155.0 → 0.160.0](#61-finestra-di-versione-01550--01600)
   - [6.2 Timeline degli eventi (verificata)](#62-timeline-degli-eventi-verificata)
   - [6.3 Schemi generati](#63-schemi-generati)
   - [6.4 Limiti e affidabilità](#64-limiti-e-affidabilità)
7. **[Note di integrazione per il progetto (Daiku)](#7-note-di-integrazione-per-il-progetto-daiku)**

### Mappa dei nomi (dove vive la firma completa)

| Identificatore | Sezione |
|---|---|
| Eventi (`SessionStart`, `SessionEnd`, `SubagentStart`, `SubagentStop`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `UserPromptSubmit`, `Stop`, `Interrupt`) | §1.2 |
| Varianti handler (`command`, `mcp_tool`, `prompt`, `agent`) | §1.3 |
| Campi handler `command` (`command`, `commandWindows`/`command_windows`, `timeout`, `async`, `statusMessage`, `additionalContextLimit`) | §1.3 |
| Campi handler `mcp_tool` (`server`, `tool`, `input`, `timeout`, `statusMessage`) | §1.3 |
| Campi d'uscita (`hookSpecificOutput`, `additionalContext`, `decision`, `permissionDecision`, `updatedInput`, `continue`, `stopReason`, `systemMessage`, `suppressOutput`) | §2.1–§2.5 |
| Campi stdin (`session_id`, `transcript_path`, `cwd`, `hook_event_name`, `model`, `turn_id`, `permission_mode`, …) | §2.7 |
| `agent_transcript_path` | §3.3 |
| Chiavi managed (`managed_dir`, `windows_managed_dir`, `allow_managed_hooks_only`) | §5.5 |
| Env dei plugin (`PLUGIN_ROOT`, `PLUGIN_DATA`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`) | §4.1 |
| Chiavi manifest ammesse/rifiutate (`.codex-plugin/plugin.json`) | §4.3 |

---

## 1. Fondamenti

### 1.1 Meta e fonti

Fonti primarie (ufficiali):
- `https://learn.chatgpt.com/docs/hooks` — pagina canonica degli hook (Codex CLI). Redirect di `developers.openai.com/codex`.
- `https://codex-docs.com/en/docs/hooks.md` — mirror verbatim della stessa pagina.
- `https://developers.openai.com/plugins/build/plugins` — guida ufficiale al packaging dei plugin (sezione «Bundled MCP servers and lifecycle hooks»).
- Sorgente della versione in uso, tag `rust-v0.155.0`:
  - `codex-rs/config/src/hook_config.rs` (forma di configurazione degli hook).
  - `codex-rs/hooks/src/engine/discovery.rs` (scoperta e merge dei layer).
  - `codex-rs/hooks/schema/generated/<evento>.command.<input|output>.schema.json` (wire format stdin/stdout per evento).

Fonti di prima parte su questa macchina (installazione 0.155.0):
- `C:/Users/tomas/.codex/config.toml`, `C:/Users/tomas/.codex/version.json`.
- `C:/Users/tomas/.codex/skills/.system/plugin-creator/references/plugin-json-spec.md`.
- `C:/Users/tomas/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py`.
- `C:/Users/tomas/.codex/skills/.system/plugin-creator/SKILL.md`.
- `C:/Users/tomas/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`, `state_5.sqlite`, `thread_history_1.sqlite`.
- Comandi: `codex --version`, `codex --help`, `codex features list`, `codex plugin --help`, `codex migrate-rollouts --help`, `codex doctor`.

Fonte terza (usata solo per il cross-check, con errori accertati — vedi §4 e §5):
- `https://raw.githubusercontent.com/CodeAlive-AI/ai-driven-development/main/skills/hooks-management/references/codex-hooks.md`.

Convenzioni: `[to verify]` = non confermato dalle fonti; «verbatim» = copiato dalla fonte; ogni fatto tecnico porta accanto la fonte.

### 1.2 I dodici eventi cablabili

Nomi esatti (casing incluso), dai `serde(rename = …)` di `HookEventsToml` (0.155.0) e dalla tabella «Hooks run at different points in a conversation»:

| Evento | Scope | Quando scatta |
|---|---|---|
| `SessionStart` | sessione | all'avvio o alla ripresa di una sessione |
| `SessionEnd` | sessione (solo thread principale) | alla fine della sessione — «won't run for subagents» |
| `SubagentStart` | subagent | all'avvio di un subagent |
| `SubagentStop` | subagent | quando un subagent sta per fermarsi; può chiedere la continuazione |
| `PreToolUse` | turn + tool | prima che uno strumento giri (bloccabile) |
| `PermissionRequest` | turn + tool | quando Codex sta per chiedere approvazione |
| `PostToolUse` | turn + tool | dopo che uno strumento ha prodotto output |
| `PreCompact` | turn | prima della compattazione |
| `PostCompact` | turn | dopo la compattazione |
| `UserPromptSubmit` | turn | al submit di un prompt (bloccabile) |
| `Stop` | turn | alla fine del turno dell'agente |
| `Interrupt` | turn (solo thread principale) | quando interrompi un turno attivo — «doesn't run for subagents» |

### 1.3 Schema di `.codex/hooks.json`: tre livelli e handler

Fonte: pagina ufficiale + `codex-rs/config/src/hook_config.rs` al tag `rust-v0.155.0`. Nota di versione: `codex-rs/config/src/hook_config.rs` è **identico** fra `rust-v0.155.0` e `rust-v0.160.0` (diff vuoto), quindi questa forma vale per entrambe.

Un **hook event** → uno o più **matcher group** → uno o più **hook handler**.

Livello file — `HooksFile` (0.155.0), con `deny_unknown_fields`:

| Campo | Tipo | Obbligo | Default | Significato |
|---|---|---|---|---|
| `description` | string | opzionale | assente | «optional top-level metadata for a `hooks.json` file. It doesn't change which hooks run» |
| `hooks` | oggetto evento→gruppi | opzionale nel tipo; senza, non gira nulla | `{}` | mappa degli eventi |

Livello matcher group — `MatcherGroup`:

| Campo | Tipo | Obbligo | Default | Significato |
|---|---|---|---|---|
| `matcher` | string (regex) | opzionale | — | filtra quando gli hook dell'evento scattano |
| `hooks` | array di handler | opzionale | `[]` | gli handler del gruppo |

Livello handler — `HookHandlerConfig`, enum con discriminatore `type`. Quattro varianti: `command`, `mcp_tool`, `prompt`, `agent`. Solo `command` e `mcp_tool` sono eseguiti: «`command` and `mcp_tool` handlers are supported. `prompt` and `agent` handlers are parsed but skipped.» `prompt` e `agent` sono struct vuote.

Handler `command` (nomi JSON esatti dal sorgente 0.155.0):

| Campo JSON | Campo Rust | Tipo | Obbligo | Default | Significato |
|---|---|---|---|---|---|
| `type` | — | costante `"command"` | sì (discriminatore) | — | seleziona l'handler |
| `command` | `command` | string | **sì** | — | comando da eseguire; gira con la `cwd` di sessione |
| `commandWindows` (alias `command_windows`) | `command_windows` | string | opzionale | assente | override del comando solo su Windows |
| `timeout` | `timeout_sec` | number (secondi, u64) | opzionale | `600` (ma `1` per `SessionEnd`/`Interrupt`) | timeout del comando; `SessionEnd`/`Interrupt` max `3` |
| `async` | `r#async` | boolean | opzionale | `false` | `true` esegue il comando in background |
| `statusMessage` | `status_message` | string | opzionale | assente | messaggio mostrato mentre l'hook gira |
| `additionalContextLimit` | `additional_context_limit` | integer ≥ 0 (token) | opzionale | assente → soglia `2500` | soglia oltre cui l'`additionalContext` viene spillato su disco; `0` disabilita lo spilling per quell'hook |

Handler `mcp_tool`:

| Campo JSON | Tipo | Obbligo | Default | Significato |
|---|---|---|---|---|
| `type` | costante `"mcp_tool"` | sì | — | seleziona l'handler |
| `server` | string | **sì** | — | «Required name of an already-connected MCP server» |
| `tool` | string | **sì** | — | «Required name of a tool exposed by that server» |
| `input` | oggetto JSON di template | opzionale | `{}` | argomenti; supporta l'espansione `${field.nested}` |
| `timeout` | number (secondi) | opzionale | `600` | «Optional active execution timeout in seconds» |
| `statusMessage` | string | opzionale | assente | messaggio mostrato mentre l'hook gira |

Sorgente 0.155.0:

```rust
#[serde(tag = "type")]
pub enum HookHandlerConfig {
    #[serde(rename = "command")]
    Command { command: String, command_windows: Option<String>, timeout_sec: Option<u64>, r#async: bool, status_message: Option<String>, additional_context_limit: Option<usize> },
    #[serde(rename = "mcp_tool")]
    McpTool { server: String, tool: String, input: serde_json::Map<String, serde_json::Value>, timeout_sec: Option<u64>, status_message: Option<String> },
    #[serde(rename = "prompt")]
    Prompt {},
    #[serde(rename = "agent")]
    Agent {},
}
```

Espansione argomenti MCP (`input`): «Use `${field.nested}` to read a dotted field from the hook event. A placeholder that fills an entire value keeps its JSON type. A placeholder inside a larger string is rendered as text. Codex expands objects and arrays recursively.»

### 1.4 Il `matcher`

«a regex string that filters when hooks fire». Per scattare su tutto: `"*"`, `""`, oppure omettere `matcher`. Valori su cui è testata la regex, e chi la ignora:

| Evento | Il matcher filtra |
|---|---|
| `PreToolUse` | nome dello strumento |
| `PermissionRequest` | nome dello strumento (`Bash`, `apply_patch`¹, nomi MCP) |
| `PostToolUse` | nome dello strumento |
| `PreCompact` / `PostCompact` | trigger di compattazione: `manual` o `auto` |
| `SessionStart` | sorgente di avvio: `startup`, `resume`, `clear`, `compact` |
| `SessionEnd` | motivo di fine: attualmente solo `other` |
| `SubagentStart` / `SubagentStop` | tipo di subagent |
| `UserPromptSubmit` | **ignorato** — «Any configured `matcher` is ignored for this event» |
| `Stop` | **ignorato** |
| `Interrupt` | **ignorato** |

¹ Per `apply_patch`, il matcher accetta anche `Edit` o `Write`; l'input riporta comunque `tool_name: "apply_patch"`.

Esempi verbatim: `Bash`, `^apply_patch$`, `Edit|Write`, `mcp__filesystem__read_file`, `mcp__filesystem__.*`, `startup|resume|clear|compact`, `manual|auto`.

### 1.5 Sedi di scoperta, mixing, precedenza

Codex scopre gli hook «next to active config layers in either of these forms»: `hooks.json` o tabelle inline `[hooks]` dentro `config.toml`. Le quattro sedi utili:

- `~/.codex/hooks.json`
- `~/.codex/config.toml`
- `<repo>/.codex/hooks.json`
- `<repo>/.codex/config.toml`

- **Mixing nella stessa sede**: «If a single layer contains both `hooks.json` and inline `[hooks]`, Codex merges them and warns at startup. Prefer one representation per layer.» Il warning nel sorgente 0.155.0 è: `loading hooks from both <json> and <toml>; prefer a single representation for this layer`.
- **Precedenza/merge fra sedi**: nessuna sostituzione. «If more than one hook source exists, Codex loads all matching hooks. Higher-precedence config layers don't replace lower-precedence hooks.» La discovery itera `layers_low_to_high()` e accoda gli handler di ogni layer; hook corrispondenti da più file girano tutti, e i command hook concorrenti per lo stesso evento partono insieme («so one hook can't prevent another matching hook from starting»).

### 1.6 Esempio `hooks.json` completo

(verbatim dai docs)

```json
{
  "description": "Optional lifecycle hooks for this workspace.",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.codex/hooks/session_start.py",
            "statusMessage": "Loading session notes",
            "additionalContextLimit": 5000
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 ~/.codex/hooks/session_end.py",
            "timeout": 3
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/usr/bin/python3 \"$(git rev-parse --show-toplevel)/.codex/hooks/pre_tool_use_policy.py\"",
            "statusMessage": "Checking Bash command"
          }
        ]
      }
    ],
    "PermissionRequest": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/usr/bin/python3 \"$(git rev-parse --show-toplevel)/.codex/hooks/permission_request.py\"",
            "statusMessage": "Checking approval request"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "/usr/bin/python3 \"$(git rev-parse --show-toplevel)/.codex/hooks/post_tool_use_review.py\"",
            "statusMessage": "Reviewing Bash output"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/usr/bin/python3 \"$(git rev-parse --show-toplevel)/.codex/hooks/user_prompt_submit_data_flywheel.py\""
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/usr/bin/python3 \"$(git rev-parse --show-toplevel)/.codex/hooks/stop_continue.py\"",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

Equivalente inline TOML: `[[hooks.SessionStart]]` per il gruppo e `[[hooks.SessionStart.hooks]]` per gli handler. Esempio MCP verbatim:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "mcp_tool",
            "server": "scanner",
            "tool": "scan_patch",
            "input": { "patch": "${tool_input.command}" },
            "timeout": 30,
            "statusMessage": "Scanning edited files"
          }
        ]
      }
    ]
  }
}
```

### 1.7 Setup, quickstart e modello mentale

- Gli hook arrivano col CLI; nessuna installazione separata. **Gli hook sono accesi di default.**
- Per disabilitarli in locale vedi §5.7 (chiave canonica `[features] hooks = false`; `codex_hooks` è un alias deprecato).
- Controllo admin via `requirements.toml` (vedi §5.5).
- Guardrail, non confine — **verbatim**: «Some specialized tool paths can opt out of the default hook path. Treat tool hooks as a useful guardrail, not a complete enforcement boundary.» La fonte terza aggiunge: «Codex may still accomplish equivalent work via another tool path.»

---

## 2. Primitive principali: cosa può restituire ciascun evento (iniettare, negare, riscrivere, fermare) e codici d'uscita

Fonti: pagina ufficiale, mirror, e gli schemi generati (`codex-rs/hooks/schema/generated`). Gli schemi del branch `main` «may include hook fields that are not in the current release. Use this page as the release behavior reference»: i campi solo-schema sono `[to verify]`.

### 2.1 Capacità e forma d'uscita per evento

| Evento | Inietta contesto | Nega/blocca | Riscrive input | Ferma turn/subagent | Forma d'uscita |
|---|---|---|---|---|---|
| `SessionStart` | sì (stdout o `additionalContext`) | no | no | `continue: false` chiude il turno | `{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"…"}}` |
| `SessionEnd` | no — solo advisory | no | no | no | nessuno schema d'uscita («won't steer Codex or keep the thread open») |
| `SubagentStart` | sì (stdout o `additionalContext`) | no | no | `continue: false` è parsato ma **non** ferma il subagent | `{"hookSpecificOutput":{"hookEventName":"SubagentStart","additionalContext":"…"}}` |
| `UserPromptSubmit` | sì (stdout o `additionalContext`) | sì (`decision:"block"` o exit 2) | no | campi comuni | `{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"…"}}` / `{"decision":"block","reason":"…"}` |
| `PreToolUse` | `additionalContext` | sì (`deny`, legacy `block`, exit 2) | sì (`allow` + `updatedInput`) | `continue`/`stopReason` non supportati | vedi §2.2 |
| `PermissionRequest` | solo `systemMessage` | sì (`decision.behavior:"deny"`) | no | non supportato | `{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}` / `{…,"decision":{"behavior":"deny","message":"…"}}` |
| `PostToolUse` | `additionalContext` | sì (`decision:"block"` sostituisce il risultato; exit 2) | no | `continue: false` ferma l'elaborazione normale | `{"decision":"block","reason":"…","hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"…"}}` |
| `PreCompact` | solo campi comuni | no | no | `continue: false` ferma prima di compattare | output comuni |
| `PostCompact` | solo campi comuni | no | no | `continue: false` ferma dopo aver compattato | output comuni |
| `Stop` | solo campi comuni | crea un nuovo prompt di continuazione da `reason` | no | `continue: false` prevale | `{"decision":"block","reason":"…"}` |
| `Interrupt` | solo `systemMessage` | no | no | non può prevenire l'interruzione né riavviare il turno | `{"systemMessage":"…"}` |
| `SubagentStop` | solo campi comuni | continuazione via `decision:"block"` / exit 2 | no | `continue: false` prevale | `{"decision":"block","reason":"…"}` |

Note:
- `decision: "block"` su `Stop` «doesn't reject the turn; it creates a new continuation prompt as a new user prompt using `reason`». Su `PostToolUse` «doesn't undo the command; Codex records the feedback, replaces the tool result with it, and continues from that message».
- `SubagentStop`/`Stop` con `decision:"block"` richiedono `reason`, imposto «during output parsing rather than in the JSON schema».
- `PreToolUse` con `updatedInput` richiede `permissionDecision: "allow"`; per `Bash`/`apply_patch` serve una `command` stringa; per MCP e altri function tool è l'oggetto argomenti sostitutivo.

### 2.2 Le due forme di blocco

**(a) Codici d'uscita**:
- `0` senza output = successo, Codex continua.
- `2` + motivo su **`stderr`** = blocco/feedback, onorato da `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `SubagentStop`, `Stop`. Per `PermissionRequest` «exit 2 not a block mechanism».
- Altri codici: «Other exit codes aren't given blocking semantics in this page» (registrati come errore in verbose, non bloccano).
- `SubagentStop`, `Stop` e `Interrupt` «expect **JSON on `stdout`** when exiting `0`; plain text is invalid for them».

**(b) Forme JSON** (verbatim):
- `PreToolUse` deny:
```json
{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": "Destructive command blocked by hook." } }
```
- Legacy block: `{ "decision": "block", "reason": "..." }` (enum legacy `decision` = `["approve","block"]`).
- `PreToolUse` rewrite: `permissionDecision: "allow"` + `updatedInput`.
- `PermissionRequest`: `hookSpecificOutput.decision.behavior` = `["allow","deny"]` + `message`. «If multiple hooks decide, any `deny` wins; otherwise an `allow` proceeds without the approval prompt; no decision → normal approval flow.»

### 2.3 Iniezione di contesto

- `hookSpecificOutput.additionalContext` — su `SessionStart`, `SubagentStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`.
- `stdout` semplice come **developer context**: onorato da `SessionStart`, `SubagentStart`, `UserPromptSubmit`. **Ignorato** da `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`. **Non valido** (serve JSON) su `SubagentStop`, `Stop`, `Interrupt`.
- `additionalContextLimit` (firma completa in §1.3): omesso → default **`2500`**; intero positivo → soglia custom; **`0` → passa il contesto completo**. Vale «only for `additionalContext`»; ignorato, con warning di config, per gli eventi che non possono produrre additional context.

### 2.4 Campi parsati ma NON supportati, per evento

- **`PreToolUse` / `PermissionRequest`**: `permissionDecision: "ask"`, legacy `decision: "approve"`, `continue: false`, `stopReason`, `suppressOutput` → «the hook run is marked failed, the error is reported, and the tool call continues». `PermissionRequest` in più «fails closed» su `updatedInput`, `updatedPermissions`, `interrupt` (i loro schemi lo confermano: «PermissionRequest hooks currently fail closed if this field is present»).
- **`PreToolUse` / `PermissionRequest`**: `systemMessage` **è** supportato.
- **`PostToolUse`**: `updatedMCPToolOutput` e `suppressOutput` «parsed but unsupported» (hook marcato fallito, l'elaborazione normale del risultato continua). `systemMessage`, `continue: false`, `stopReason` sono supportati.
- **`SubagentStart`**: `continue: false` è parsato ma non ferma il subagent.
- Globale: `suppressOutput` è «Parsed today but not yet implemented».

### 2.5 Campi d'uscita comuni

```json
{ "continue": true, "stopReason": "optional", "systemMessage": "optional", "suppressOutput": false }
```

Supportati da `SessionStart`, `PreCompact`, `PostCompact`, `UserPromptSubmit`, `SubagentStop`, `Stop`. `continue: false` segna il run come fermato; `stopReason` è registrato; `systemMessage` emerge come warning UI/event-stream; `suppressOutput` è parsato ma non implementato.

### 2.6 Spilling dell'output grande e hook in background

- Cap visibile al modello: **~2.500 token per messaggio di hook**. L'output eccedente è spillato in **`<temp_dir>/hook_outputs/<session_id>/<uuid>.txt`**, sostituito da anteprima testa-coda più quel path. «If writing fails, a truncated preview is still delivered.» Non restituire segreti.
- Hook in background (`"async": true`): l'output «is delivered at the next safe point» (dopo la request/tool in corso, o al turno utente successivo); «finishing one doesn't start a turn». **Non possono** bloccare, approvare, riscrivere o controllare l'operazione che li ha triggerati. **Cap: 8 concorrenti per sessione**; la fine sessione cancella quelli non finiti. `SessionEnd` gira sempre sincrono anche con `async: true`.

### 2.7 stdin: campi comuni e per evento

Campi comuni a ogni command hook (un solo oggetto JSON su stdin): `session_id` (per gli hook dei subagent è l'id della sessione **padre**), `transcript_path` (`string | null`; «Path to the session transcript file, if any»), `cwd`, `hook_event_name`, `model`. Gli eventi turn-scoped aggiungono `turn_id`; diversi eventi aggiungono `permission_mode` (`default`, `acceptEdits`, `plan`, `dontAsk`, `bypassPermissions`).

| Evento | Campi extra stdin |
|---|---|
| `SessionStart` | `source` (`startup`,`resume`,`clear`,`compact`; lo schema `main` aggiunge `fork` → `[to verify: 0.155.0]`) |
| `SessionEnd` | `reason` (const `"other"`; niente `model`/`permission_mode` nello schema) |
| `SubagentStart` | `turn_id`, `agent_id`, `agent_type`, `permission_mode` |
| `SubagentStop` | `turn_id`, `agent_id`, `agent_type`, `agent_transcript_path`, `stop_hook_active`, `last_assistant_message`, `permission_mode` |
| `UserPromptSubmit` | `turn_id`, `prompt` (+ opz. `agent_id`,`agent_type`) |
| `PreToolUse` | `turn_id`, `tool_name`, `tool_use_id`, `tool_input` (+ opz. `agent_id`,`agent_type`) |
| `PermissionRequest` | `turn_id`, `tool_name`, `tool_input` (+ `tool_input.description` secondo i docs, non in `required` dello schema); opz. `agent_id`,`agent_type` |
| `PostToolUse` | `turn_id`, `tool_name`, `tool_use_id`, `tool_input`, `tool_response` |
| `PreCompact`/`PostCompact` | `turn_id`, `trigger` (`manual`,`auto`) |
| `Stop` | `turn_id`, `stop_hook_active`, `last_assistant_message` |
| `Interrupt` | `turn_id`; timeout 1–3 s |

Copertura di `PreToolUse`/`PostToolUse`: `Bash`, unified-exec `exec_command` (matchato come `Bash`), `apply_patch` (anche `Edit`/`Write`), tool MCP e altri local function tool; gli hosted tool (es. `WebSearch`) **non** passano da qui. `write_stdin` è trasporto di una sessione unified-exec già aperta e non ri-triggera `PreToolUse`.

---

## 3. Infrastruttura: sessioni e transcript

Fonti: pagina ufficiale + mirror + file locali sotto `C:/Users/tomas/.codex/` (0.155.0).

### 3.1 Esiste un equivalente del transcript, leggibile da un hook?

Sì. Campo stdin `transcript_path` (definizione in §2.7), tipizzato `string | null`, descritto «Path to the session transcript file, if any». Su `SessionEnd` i docs aggiungono: «Your hook can still read the session transcript while it runs.» Avvertenza di stabilità, verbatim: «`transcript_path` points to a chat transcript for convenience, but the transcript format isn't a stable interface for hooks and may change over time.» L'unico path d'esempio nei docs è `"transcript_path": "/workspace/.codex/rollout.jsonl"` (esempio illustrativo). La mappatura `transcript_path` → file reale su questa macchina è `[to verify]` (nessun hook eseguito qui per osservarlo).

### 3.2 Dove stanno le sessioni e che forma hanno

Le sessioni stanno sotto `C:\Users\tomas\.codex\sessions\` con alberatura per data `YYYY/MM/DD/rollout-<timestamp>-<session_id>.jsonl`. Due forme su disco:

**Forma legacy** — es. `C:\Users\tomas\.codex\sessions\2026\09\27\rollout-2026-09-27T21-55-54-01a0e470-3771-7f13-a60b-4e23a24abf77.jsonl` (9 righe, `cli_version":"0.144.6"`, `source":"vscode"`, `history_mode":"legacy"`, nessun `ordinal` per riga). Chiavi top-level per riga: `timestamp, type, payload`. Tipi di record osservati:

- `session_meta` (riga 0) — payload: `session_id, id, timestamp, cwd, originator, cli_version, source, model_provider, base_instructions, history_mode, context_window`. Verbatim (troncato):
```json
{"timestamp":"2026-09-27T19:55:55.182Z","type":"session_meta","payload":{"session_id":"01a0e470-3771-7f13-a60b-4e23a24abf77","id":"01a0e470-3771-7f13-a60b-4e23a24abf77","timestamp":"2026-09-27T19:55:54.617Z","cwd":"C:\\Users\\tomas\\AppData\\Roaming\\ReforgIA\\data\\projects\\reforgia","originator":"codex_python_sdk","cli_version":"0.144.6","source":"vscode","model_provider":"openai","base_instructions":{"text":"You are a coding agent running in the Codex CLI, …"}…
```
- `event_msg` — payload è un'unione discriminata; osservati `task_started`, `user_message`, `task_complete`. Verbatim:
```json
{"timestamp":"2026-09-27T19:55:55.183Z","type":"event_msg","payload":{"type":"task_started","turn_id":"01a0e470-3994-7071-87e2-2f2fbd91918c","started_at":1790538955,"model_context_window":258400,"collaboration_mode_kind":"default"}}
{"timestamp":"2026-09-27T19:55:55.914Z","type":"event_msg","payload":{"type":"user_message","message":"rispondi ciao","images":[],"local_images":[],"text_elements":[]}}
{"timestamp":"2026-09-27T19:55:56.515Z","type":"event_msg","payload":{"type":"task_complete","turn_id":"01a0e470-3994-7071-87e2-2f2fbd91918c","last_agent_message":null,"completed_at":1790538956,"duration_ms":1339}}
```
- `response_item` — payload: `type, role, content, internal_chat_message_metadata_passthrough`; `payload.type":"message"` con `role` ∈ {`developer`,`user`,`assistant`} e `content` array di parti (`{"type":"input_text","text":"…"}`).
- `world_state` — payload: `full, state`.
- `turn_context` — payload: `turn_id, cwd, workspace_roots, current_date, timezone, approval_policy, approvals_reviewer, sandbox_policy, permission_profile, model, personality, collaboration_mode, multi_agent_version, realtime_active, effort, summary`. Verbatim (troncato):
```json
{"timestamp":"2026-09-27T19:55:55.893Z","type":"turn_context","payload":{"turn_id":"01a0e470-3994-7071-87e2-2f2fbd91918c","cwd":"…","workspace_roots":["…"],"current_date":"2026-09-27","timezone":"Europe/Rome","approval_policy":"on-request","approvals_reviewer":"user","sandbox_policy":{"type":"read-only"},"model":"gpt-6-luna","multi_agent_version":"v1","effort":"medium","summary":"auto"}}
```

**Forma paginated** — es. `C:\Users\tomas\.codex\sessions\2026\09\19\rollout-2026-09-19T21-50-45-01a0bb38-9ec1-7223-8914-2cd28c52a22f.jsonl` (`cli_version":"0.155.0"`, `history_mode":"paginated"`). Ogni riga guadagna un top-level `ordinal` (chiavi: `timestamp, ordinal, type, payload`) e `session_meta` è più snello (payload solo `session_id, id, cwd, originator, cli_version, source, model_provider, history_mode`). Verbatim:
```json
{"timestamp":"2026-09-19T19:50:45.450Z","ordinal":0,"type":"session_meta","payload":{"session_id":"01a0bb38-9ec1-7223-8914-2cd28c52a22f","id":"01a0bb38-9ec1-7223-8914-2cd28c52a22f","cwd":"…\\scratchpad\\proj","originator":"codex_exec","cli_version":"0.155.0","source":"exec","model_provider":"openai","history_mode":"paginated"}}
{"timestamp":"2026-09-19T19:50:45.450Z","ordinal":1,"type":"event_msg","payload":{"type":"task_started","turn_id":"01a0bb38-9f77-7031-884b-7ff486d6b2c3","started_at":1789847445,"model_context_window":258400,"collaboration_mode_kind":"default"}}
```
La divisione è per **scrittore**, non per data: le sessioni 0.155.0 `exec` sono `paginated` con `ordinal`; le sessioni `vscode` scritte da `cli_version 0.144.6` sono `legacy` senza `ordinal`. `codex doctor` conferma `active rollouts … 36 files`.

### 3.3 `agent_transcript_path` su `SubagentStop`

`string | null`, «Path to the subagent transcript file, if any»: il transcript del **subagent**, distinto da quello della sessione padre. «Subagent hooks use the parent session id», quindi `session_id` resta del padre mentre `agent_transcript_path` punta al subagent. Non esiste `agent_transcript_path` documentato per `SubagentStart`.

### 3.4 `migrate-rollouts` / sqlite — la storia si sposta dal JSONL?

In parte, e il JSONL resta autorevole. Confermato localmente:
- `codex migrate-rollouts --help`: «Inspect or migrate legacy local sessions to paginated thread history», con `--apply` («Without this flag the command only reports eligible sessions»), `--thread <THREAD_ID>`, `--json`, `--max-mib-per-second`.
- `codex migrate-rollouts` (report) qui stampa: «Scanned 36 rollout(s): 8 eligible, 28 already paginated, 0 skipped (0 empty, 0 busy), 0 failed.»
- `state_5.sqlite` ha `threads` (36 righe; colonne includono `rollout_path`, `history_mode` default `'legacy'`, `cli_version`, `cwd`, `title`, `first_user_message`) più `rollout_migration_state` e `rollout_migration_skipped_rollouts`. `SELECT history_mode, count(*) FROM threads` → `legacy 8`, `paginated 28`.
- `thread_history_1.sqlite` ha `thread_items` (`item_json TEXT`, `item_type`, `rollout_ordinal`) e `thread_turns` (`rollout_byte_offset`, `rollout_end_ordinal`): una proiezione paginata sui rollout.
- Secondo le fonti esterne la migrazione è una **proiezione**, non una sostituzione: il JSONL «remains the authoritative durable storage». Confini esatti di versione oltre l'osservazione locale → `[to verify]`.

### 3.5 Esiste uno store di sessione project-local?

No (osservato): tutti i 36 rollout stanno sotto `C:\Users\tomas\.codex\sessions\`; nessun `<repo>/.codex/sessions` trovato, e `config.toml` non dichiara una directory di sessione. Se Codex possa scrivere un transcript project-local è `[to verify]`.

---

## 4. Estensione: un pacchetto (plugin) può portare hook propri? E quali campi del manifest sono rifiutati?

Fonti: docs ufficiali hook, guida ufficiale ai plugin, e i file di prima parte in `C:/Users/tomas/.codex/skills/.system/plugin-creator/` (0.155.0).

### 4.1 Cosa dicono i docs ufficiali (verbatim)

Sezione «Plugin-bundled hooks» della pagina hook:

> When a plugin is enabled, Codex can load lifecycle hooks from that plugin alongside user, project, and managed hooks.
> By default, Codex looks for `hooks/hooks.json` inside the plugin root. A plugin manifest can override that default with a `hooks` entry in `.codex-plugin/plugin.json`. The manifest entry can be a `./`-prefixed path, an array of `./`-prefixed paths, an inline hooks object, or an array of inline hooks objects.
> ```json
> { "name": "repo-policy", "hooks": "./hooks/hooks.json" }
> ```
> Manifest hook paths are resolved relative to the plugin root and must stay inside that root. If a manifest defines `hooks`, Codex uses those manifest entries instead of the default `hooks/hooks.json`.

Env passate ai comandi di hook di plugin:
- `PLUGIN_ROOT` — estensione Codex, punta alla radice del plugin installato.
- `PLUGIN_DATA` — estensione Codex, punta alla directory dati scrivibile del plugin.
- `CLAUDE_PLUGIN_ROOT` e `CLAUDE_PLUGIN_DATA` — per compatibilità.

La guida ufficiale ai plugin (`developers.openai.com/plugins/build/plugins`, sezione «Bundled MCP servers and lifecycle hooks») sposta però la chiave **fuori** da `.codex-plugin/plugin.json`:

> Codex discovers `hooks/hooks.json` by default when the selected OpenAI extension or compatibility manifest doesn't define `hooks`. To override that default, define `hooks` inside `extensions.com.openai` in root `plugin.json`. The field can be a single path, an array of paths, an inline hooks object, or an array of inline hooks objects. An explicit value replaces default-file discovery; it doesn't add to `hooks/hooks.json`.
> ```json
> { "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json", "name": "repo-policy", "extensions": { "com.openai": { "hooks": ["./hooks/session.json", "./hooks/tools.json"] } } }
> ```
> Legacy packages can declare `hooks` directly in `.codex-plugin/plugin.json`.

e sul modello overlay: «When `extensions.com.openai` is an object, it replaces the entire `.codex-plugin/plugin.json` overlay as the source of OpenAI-specific settings; the two aren't merged.»

⚠️ **Migrazione di collocazione**: la via `extensions.com.openai.hooks` in un `plugin.json` di radice sostituisce la dichiarazione di `hooks` dentro `.codex-plugin/plugin.json`, che resta solo per i «legacy packages».

**Correzione a una fonte terza**: il riferimento CodeAlive `codex-hooks.md` (401 righe) **non contiene nulla sui plugin** — `grep` per `plugin`/`PLUGIN`/`hooks/hooks.json`/`.codex-plugin` dà zero risultati. Non è la fonte per questa parte; lo sono i docs ufficiali sopra.

### 4.2 La contraddizione, risolta onestamente

Il **validatore di prima parte su questa macchina rifiuta `hooks` e `agents`**, verificato in due modi.

Testo della spec di prima parte, `plugin-json-spec.md`:
> Validation rejects unsupported manifest fields such as `hooks`, so the scaffold keeps them out of generated manifests.

`SKILL.md` (riga 189): «Omit unsupported plugin manifest fields that validation rejects, including `hooks`.»

Il validatore, `validate_plugin.py`:
```python
allowed_keys = {
    "id", "name", "version", "description", "skills", "apps",
    "mcpServers", "interface", "author", "homepage", "repository",
    "license", "keywords",
}
for key in sorted(set(manifest) - allowed_keys):
    errors.append(f"plugin.json field `{key}` is not accepted by plugin validation")
```

Prova eseguita (probe con `"hooks"` e `"agents"`), exit 1, verbatim:
```
Plugin validation failed:
- plugin.json field `agents` is not accepted by plugin validation
- plugin.json field `hooks` is not accepted by plugin validation
```
Lo stesso validatore passa il pacchetto Daiku invariato: `Plugin validation passed: C:\dev\daiku-workspace\daiku-dev\plugins\daiku`.

Feature flag a runtime (`codex features list`, 0.155.0): vedi la tabella completa in §5.7.

Risoluzione:
- **Confermato**: la chiave `hooks` (e `agents`) è **rifiutata dal validatore di prima parte nella versione su questa macchina (0.155.0)**. Nota: la spec `plugin-json-spec.md` **mostra** `"hooks": "./hooks.json"` nel campione e lo cataloga, mentre in fondo allo stesso file dice che la validazione lo rifiuta → la spec è internamente incoerente, e il validatore eseguibile è l'autorità.
- **Confermato**: a runtime Codex *può* caricare hook di plugin (docs ufficiali), e la feature `hooks` è stabile. Quindi `hooks` è una chiave riconosciuta *a runtime/ingestion*, ma non una chiave accettata di *authoring/validazione* in `.codex-plugin/plugin.json` sotto il contratto del plugin-creator su questa macchina.
- **Confermato**: la guida ufficiale corrente non siede più gli hook di plugin in `.codex-plugin/plugin.json`, ma sotto `extensions.com.openai.hooks` in un `plugin.json` portabile di radice, chiamando `.codex-plugin/plugin.json` «compatibility overlay»; dichiarare `hooks` direttamente lì è la via dei soli «legacy packages».
- `[to verify]`: se `codex plugin add`/enable di un pacchetto reale col `hooks` top-level in `.codex-plugin/plugin.json` **carichi davvero** quegli hook a runtime in 0.155.0 o ignori la chiave in silenzio (il rifiuto del validatore è un gate *pre-submission*, non prova del comportamento a runtime). `[to verify]` anche se `extensions.com.openai.hooks` sia onorato proprio in 0.155.0 (quel campo appare solo nella guida 0.160.0-era).
- Netto: **non mettere `hooks` né `agents` in un `.codex-plugin/plugin.json` destinato a passare la validazione su questa macchina.** La via futura concordata da docs e modello di ingestion è un `plugin.json` di radice con `extensions.com.openai.hooks`.

### 4.3 Campi ammessi e rifiutati per `.codex-plugin/plugin.json`

Da `validate_plugin.py` `allowed_keys` (lista eseguibile e autorevole su questa macchina). **Top-level ammessi**: `id`, `name`, `version`, `description`, `skills`, `apps`, `mcpServers`, `interface`, `author`, `homepage`, `repository`, `license`, `keywords`. (`id` è ammesso dal validatore ma non compare nel campione della spec.)

⚠️ **Top-level rifiutati**: qualunque chiave fuori dall'insieme, con errore `plugin.json field \`<key>\` is not accepted by plugin validation`. Nominati e confermati dal probe: `hooks`, `agents`, `commands`, `extensions`, `locked`, `mcp_servers`. `[to verify]` se un percorso di ingestion più nuovo accetti `extensions` nell'overlay.

**Sotto-campi `author` ammessi**: `name` (obbligatorio), `email`, `url` (https assoluto).

**Sotto-campi `interface` ammessi**: `displayName`, `shortDescription`, `longDescription`, `developerName`, `category`, `capabilities`, `websiteURL`, `privacyPolicyURL`, `termsOfServiceURL`, `brandColor`, `composerIcon`, `logo`, `logoDark`, `screenshots`, `defaultPrompt`, **e** `default_prompt` (alias snake_case). Obbligatori non vuoti: `displayName`, `shortDescription`, `longDescription`, `developerName`, `category`. Obbligatorio uno-tra: `defaultPrompt` **o** `default_prompt`. `capabilities` = array di stringhe non vuote. `brandColor` = `#RRGGBB`. Gli asset devono puntare a file reali dentro l'archivio del plugin.

Lo scaffold (`create_basic_plugin.py`) scrive esattamente: `name`, `version`, `description`, `author.name`, `skills`, `interface{…}` (+ `mcpServers` con `--with-mcp`, `apps` con `--with-apps`). Il flag `--with-hooks` crea solo una **directory** `hooks/` vuota; non scrive mai una chiave `hooks` in `plugin.json`.

### 4.4 Dove stanno gli hook senza un pacchetto

Le quattro sedi pratiche sono quelle della §1.5. Su questa macchina non esistono `C:/Users/tomas/.codex/hooks.json` né `C:/dev/daiku-workspace/daiku-dev/.codex/` (esiste `C:/Users/tomas/.codex/config.toml`). Quindi la sede di un progetto senza pacchetto è `<repo>/.codex/hooks.json` (o `[hooks]` inline in `<repo>/.codex/config.toml`); la sede utente è `~/.codex/hooks.json`.

### 4.5 `codex plugin --help` (0.155.0)

```
Manage Codex plugins
Usage: codex plugin [OPTIONS] <COMMAND>
Commands:
  add          Install a plugin from a configured or remote marketplace
  list         List plugins available from configured and remote marketplaces
  marketplace  Add, list, upgrade, or remove configured plugin marketplaces
  remove       Uninstall a plugin and remove its local cache
  help         Print this message or the help of the given subcommand(s)
```
**Nessun sottocomando `validate`**: la validazione del manifest è lo script Python `~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py <plugin-path>`, non un verbo CLI.

---

## 5. Configurazione e ciclo di vita: la fiducia

Come si approva un hook di progetto e cosa succede a un hook non approvato.
Fonti: pagina ufficiale + mirror + `config.toml`, `codex --help`, `codex features list` locali (0.155.0).

### 5.1 Come si approva un hook di progetto

Meccanismo: **comando slash `/hooks` dentro la TUI**, non un sottocomando CLI. `/hooks` serve a «inspect hook sources, review new or changed hooks, trust hooks, or disable individual non-managed hooks». Regola di fondo: «Non-managed hooks must be reviewed and trusted before they run.»

- **Nessun modo non interattivo documentato** come sottocomando dedicato. **Discrepanza accertata**: la fonte terza scrive «Use `codex trust` (or accept the trust prompt) to enable», ma su 0.155.0 **`codex trust` non è un sottocomando**: `codex trust` dà `Error: stdin is not a terminal`, `codex trust foo` dà `error: unrecognized subcommand 'foo'`. Su questa versione il trust si fa **solo** da `/hooks` interattivo. `[to verify]` se una versione successiva abbia aggiunto `codex trust`.

### 5.2 Dove è registrato il trust

- Registrato **contro l'hash del contenuto**: «Codex records trust against the hook's current hash» e «new or changed hooks are marked for review and skipped until trusted». ⚠️ Conseguenza: modificare un file di hook produce un hash nuovo → marcato "da rivedere" e **saltato** finché non lo si riapprova.
- **Ambito di memorizzazione** (per-progetto / per-utente / dove stia l'hash approvato): non dichiarato dalle fonti → `[to verify]`. Su questa macchina **nessun file di trust per hook trovato** in `C:/Users/tomas/.codex` (ricerca per nome e per stringa `hook`/`trusted_hash` nei `.sqlite`): coerente col fatto che qui non ci sono hook attivi.
- **Trust del progetto ≠ trust dell'hook**: in `config.toml` esistono voci `[projects.'...']` con `trust_level = "trusted"` (es. `[projects.'c:\dev\swain']`). È il trust del **progetto** (se caricare lo strato `.codex/` di quel progetto). Il trust dell'**hook** (hash della definizione) è un secondo cancello: un progetto trusted carica gli hook project-local, ma quegli hook devono comunque passare da `/hooks`.

### 5.3 Cosa succede a un hook non approvato (fatto operativo chiave)

- **Viene saltato: non parte.** Vale la regola di §5.1 («Non-managed hooks must be reviewed and trusted before they run.») e il fatto di §5.2 («new or changed hooks are marked for review and skipped until trusted»).
- **Avviso all'avvio**: «If hooks need review at startup, Codex prints a warning that tells you to open `/hooks`.» Il testo esatto dell'avviso non è riportato → `[to verify]`.
- Quindi il guasto silenzioso da temere: un hook aggiunto o modificato smette di girare e lo si scopre solo dall'avviso, non da un errore.

### 5.4 `--dangerously-bypass-hook-trust`

Verbatim dall'`--help` locale 0.155.0: «Run enabled hooks without requiring persisted hook trust for this invocation. DANGEROUS. Intended only for automation that already vets hook sources». Vale per **una singola invocazione** e **non** scrive il trust.

### 5.5 Hook gestiti (managed)

- Origine: «system, MDM, cloud, or `requirements.toml`»; «marked as managed, trusted by policy, and can't be disabled from the user hook browser».
- Chiavi: `managed_dir` (macOS/Linux) e `windows_managed_dir` (Windows). Codex non distribuisce quegli script: li installa il tooling aziendale, e i comandi dovrebbero usare path assoluti sotto la directory gestita.
- `allow_managed_hooks_only = true`: «skips hooks from user, project, session, and plugin sources, but still loads managed hooks from `requirements.toml` and other managed config layers».
- Attenzione: spegnere la feature a livello utente non spegne i managed hook; l'admin li forza con `[features].hooks = true` in `requirements.toml` accanto a `[hooks]`.

### 5.6 User vs project vs plugin

- **User/system**: «Codex still loads user and system hooks from their own active config layers», anche in progetti non trusted.
- **Project**: «Project-local hooks load only when the project `.codex/` layer is trusted.»
- **Plugin**: «Installing or enabling a plugin doesn't automatically trust its hooks» — confermato: Codex «skips plugin-bundled hooks until you review and trust the current hook definition».

### 5.7 Disabilitare gli hook (e feature flag)

- Chiave canonica `[features] hooks = false`:
```toml
[features]
hooks = false
```
«Use `hooks` as the canonical feature key. `codex_hooks` still works as a deprecated alias.» ⚠️ `codex_hooks` è un alias deprecato.
- Conferma locale (0.155.0), `codex features list`:

| Feature | Stato | Valore |
|---|---|---|
| `hooks` | `stable` | `true` |
| `plugin_hooks` | `removed` | `false` |
| `plugins` | `stable` | `true` |

`codex_hooks` **non compare** (alias deprecato) — stesso riferimento usato nella §4.2.
- Non confondere i due piani: feature `hooks` off ≠ trust del singolo hook. Un hook "abilitato" (feature on) può comunque essere **saltato** perché non ancora trusted.

---

## 6. Novità, changelog e limiti

Fonti: `gh release view/list -R openai/codex`, i due docs.

### 6.1 Finestra di versione 0.155.0 → 0.160.0

Tag stabili nella finestra (`gh release list`):

| Tag | publishedAt |
|---|---|
| `rust-v0.155.0` | 2026-09-17T23:14:43Z |
| `rust-v0.156.0` | 2026-09-22T19:51:01Z |
| `rust-v0.157.0` | 2026-09-25T02:31:06Z |
| `rust-v0.158.0` | 2026-09-28T05:07:23Z |
| `rust-v0.159.0` | 2026-09-29T08:05:42Z |
| `rust-v0.160.0` | 2026-10-01T20:19:13Z |

Anche patch: `rust-v0.159.1`, `rust-v0.159.2` (2026-09-29), `rust-v0.159.3` (2026-09-30).

Righe hooks nei corpi delle release (verbatim, da `grep`):
- **0.155.0**: `#43876 Detach Unix hook commands from the controlling terminal`; `#44288 Prevent command hooks from hanging on blocked stdin`; `#44297 Isolate the hook pipe I/O timeout test from shell startup files`; `#44349 Distinguish forked sessions in session-start hooks`; `#44377 Update the forked-thread hook test to use \`StartThreadOptions\``.
- **0.156.0**: `#45248 Use captured step settings for request metadata and tool hooks`; `#46029 Allow browser app cleanup hooks on interrupt`; `#47039 Preserve delivered messages through post-tool hook failures`.
- **0.157.0**: nessuna riga con "hook".
- **0.158.0**: `#47610 Use native POSIX spawning for command hooks`; `#47679 Add extension hooks for model requests and response streams` (extension hooks = sistema di estensioni, non il motore di hook di config).
- **0.159.0** e **0.160.0**: nessuna riga con "hook".

**Nessun nuovo/rimosso evento o chiave di manifest** nei sei corpi. **Nessuna breaking change trovata**; `[to verify]` perché le note sono sintetiche (solo le voci di punta hanno prosa; il resto è un changelog piatto di titoli PR). Il file `CHANGELOG.md` del repo è uno **stub** (330 byte): «The changelog can be found on the [releases page]» — la releases page *è* il changelog. Coerente con §1.3: `hook_config.rs` è identico fra 0.155.0 e 0.160.0.

### 6.2 Timeline degli eventi (verificata)

| Affermazione | Verdetto | Prova |
|---|---|---|
| SessionStart/Stop per primi | `[to verify]` | più antica PR trovata `#4238` "added hooks feature still needs testing" (2025-09-25); issue `#2109` "Event Hooks" (2025-08-09). Nessuna fonte che dica esplicitamente che SessionStart/Stop vennero per primi |
| PreToolUse/PostToolUse in v0.117.0 | **versione confermata, mese sbagliato** | `rust-v0.117.0` contiene `#15211 [hooks] add non-streaming (non-stdin style) shell-only PreToolUse support` e `#15531 … PostToolUse support`, ma è pubblicata **2026-03-26**, non febbraio |
| UserPromptSubmit PR #14626, mar 2026 | **confermato** | `gh pr view 14626` → titolo «[hooks] userpromptsubmit - hook before user's prompt is executed», merged `2026-03-18` |
| Promossi stabili in v0.124.0, apr 2026 | **confermato** | `rust-v0.124.0` (2026-04-23); corpo: «Hooks are now stable, can be configured inline in \`config.toml\` and managed \`requirements.toml\`, and can observe MCP tools as well as \`apply_patch\` and long-running Bash sessions.» (+ `#18893`, `#19012`) |

Nota: la fonte terza (~2026-06) elencava 10 eventi e diceva `SessionEnd` non disponibile — è **stale** su `SessionEnd`, che le pagine correnti elencano. `Notification` resta assente.

### 6.3 Schemi generati

Entrambe le pagine puntano a `codex-rs/hooks/schema/generated` (su `main`) con l'avvertenza: gli schemi del branch `main` «may include hook fields that are not in the current release» — la pagina è il riferimento per la release. Il tag `rust-v0.155.0` offre per tutti e dodici gli eventi `<evento>.command.input.schema.json` e `<evento>.command.output.schema.json` (`session-end` solo come input).

### 6.4 Limiti e affidabilità

- Issue di affidabilità verificata: `gh issue view 17532 -R openai/codex` → numero **17532**, **OPEN**, creata 2026-04-12, label `bug` e `hooks`, titolo verbatim «codex_hooks do not fire in interactive sessions when configured via repo-local .codex/config.toml». Correlata: `gh issue view 21639` → **OPEN**, 2026-05-08, «Hooks no longer run after Codex Desktop update». Entrambe aperte.
- Altri limiti documentati: hook concorrenti non si impediscono l'un l'altro; non-managed saltati finché non trusted; non mischiare `hooks.json` e inline `[hooks]` nella stessa sede; `prompt`/`agent` «parsed but skipped»; `suppressOutput` non implementato; `PreToolUse`/`PermissionRequest` non supportano `continue`/`stopReason`/`suppressOutput`; `PermissionRequest` non deve restituire `updatedInput`/`updatedPermissions`/`interrupt` (fail closed); `PostToolUse` non annulla effetti e `updatedMCPToolOutput` è unsupported; background hook non possono bloccare (max 8); hosted tool fuori dal percorso; spilling a `<temp_dir>/hook_outputs/...`; timeout default 600 s (`SessionEnd`/`Interrupt` 1 s, max 3 s); `transcript_path` non è interfaccia stabile.

---

## 7. Note di integrazione per il progetto (Daiku)

> Queste note sono **interne al cantiere**, non fatti sull'host: la sede normativa è `plugins/daiku/skills/sync-host/SKILL.md` e la memoria del progetto. Sono qui perché inquadrano perché si studia questo contratto.

- Il cantiere scrive gli hook di Codex con `sync-host`: copia i `.mjs` del pacchetto in `<repo>/.codex/hooks/` e genera `<repo>/.codex/hooks.json` (scheletro in `plugins/daiku/templates/codex/hooks.json`), su tre eventi — `PreToolUse` (matcher `Bash|PowerShell|shell`), `PostToolUse` (matcher `Edit|Write|MultiEdit|apply_patch`), `SessionStart`. Il template usa `type: "command"`, `command`, `timeout`, `statusMessage`, coerente con lo schema §1.3.
- **Divergenza dichiarata dal progetto**: Codex non esporta una variabile che punti al progetto (Claude Code esporta `CLAUDE_PROJECT_DIR`); i `.mjs` risalgono alla radice git con `hooks/lib/project-root.mjs`, e perciò il path in `command` dev'essere **assoluto**, scritto a install time.
- Il progetto afferma che il pacchetto su Codex **non può portare hook propri** e che il validatore rifiuta le chiavi `hooks` e `agents` nel manifest: la §4 lo conferma per l'*authoring/validazione* (validatore `validate_plugin.py`, allowed_keys senza `hooks`/`agents`), ma la §4 documenta anche che **a runtime** l'host carica hook di plugin da `hooks/hooks.json` e, nella guida 0.160.0-era, da `extensions.com.openai.hooks` in un `plugin.json` di radice. Il rifiuto del manifest e la capacità a runtime convivono: il primo è il gate di ingestion, il secondo è il comportamento del motore di hook. Resta `[to verify]` se una via di plugin sia utilizzabile in 0.155.0 senza passare dal gate di ingestion.
- Il trust per hash (§5.2) è la ragione per cui `sync-host` annota nel report quali file `.mjs` sono cambiati: sono esattamente quelli che torneranno a chiedere approvazione in `/hooks`.
