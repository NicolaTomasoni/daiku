# Claude Code hooks — appunti operativi di sviluppo

> **Versione in uso: 2.1.296** — estensione VSCode `anthropic.claude-code-2.1.296-win32-x64`, il cui binario nativo è ciò che l'host esegue (il pacchetto npm `@anthropic-ai/claude-code` presente su questa macchina dichiara 2.1.276). Ultima pubblicata: **v2.1.296** (release GitHub `anthropics/claude-code`, 2026-10-09): la versione in uso **coincide con l'ultima**.
> **Il corpo si compone di due raccolte e di una sperimentazione sull'host**, e ognuna data i propri fatti. La **prima raccolta (2026-10-03)** poggia sulla versione allora in uso, la **2.1.276** (contro la 2.1.288 allora ultima); l'**estensione (2026-10-12)** poggia sulla **2.1.296** e risponde a cinque domande puntuali sulla sostituzione dell'output di un tool; la **sperimentazione (2026-10-12)** poggia anch'essa sulla **2.1.296** e risponde a cinque domande sulla consegna di `additionalContext` a un subagent, con l'esito **provato eseguendo l'host** e non leggendo la documentazione. Dove una sezione dichiara la "versione in uso", si riferisce alla versione della raccolta da cui proviene il fatto; dove il fatto appartiene a una versione diversa da quella della raccolta, la soglia è indicata.
> Modello mentale dello studio: **vince la versione in uso (2.1.296)**. La documentazione canonica (`https://code.claude.com/docs/en/hooks`) riflette **l'ultima versione**; ciò che appartiene a versioni più recenti è segnalato. Ciò che non è confermato è marcato `[to verify]` (prima raccolta) o `[non documentato]` (estensione), con cosa manca; nella sperimentazione `[provato]`/`[non provato]`, col comando e la data.
> Nota sul cutoff del modello: le firme, i nomi di campo e i JSON qui sotto sono copiati **verbatim** dalle pagine recuperate (o da artefatti di prima parte reali), mai dalla memoria del modello.
> Radice tecnica: `C:/dev/daiku-workspace/daiku-dev` → `{paths.studies}` = `.daiku/studies`.
> `documents.stack` e `documents.architecture` **non sono dichiarati** in `.daiku/project.json`: la nota non ha quindi un ancoraggio al progetto oltre a questo. Assenza dichiarata, non supplita.

## Indice

1. **Meta e sorgenti** — convenzioni della nota, fonti delle due raccolte.
2. **Concetti e modello mentale** — modello di versione, i 33 eventi, la forma JSON annidata.
3. **Setup e quickstart** — dove si configurano i hook (scope e merge), la forma JSON di base.
4. **Eventi e campi `hookSpecificOutput`** — tabella dei 33 eventi; riscrittura del contenuto.
5. **`matcher` — forma esatta** — pattern, regole, tabella per evento, esempi JSON.
6. **`additionalContext` — consegna del contesto a Claude** — eventi, punto d'inserimento, cap, persistenza.
7. **Codici d'uscita, precedenza e decisione** — exit 0/1/2, tabella per evento, precedenza, output universale.
8. **Sostituire l'output di un tool: `updatedToolOutput`** — contratto, forme per tool, interferenze, limiti.
9. **Tipi di handler e campi** — cinque tipi, campi comuni e specifici.
10. **Placeholder, variabili d'ambiente ed exec/shell form** — `${...}`, env var, le due forme.
11. **Timeout e hook asincroni** — default, comportamento allo scadere, `async`/`asyncRewake`.
12. **Input comune su stdin** — campi comuni, campi subagent, esempi (anche l'input di `PostToolUse`).
13. **`transcript_path` e la forma del transcript** — path, storage, JSONL, strutture osservate.
14. **Forme di configurazione: plugin, settings, frontmatter** — `hooks/hooks.json`, chiave `hooks` del manifest, frontmatter di skill/subagent.
15. **Sicurezza, diagnosi e validazione** — controlli amministrativi, debug, validazione del manifest.
16. **Soglie di versione e changelog** — tabelle delle raccolte 2026-10-03 e 2026-10-12.
17. **Nota di chiusura della prima raccolta (2026-10-03)**.
18. **Avvio di slash-command o skill** — le tre strade, l'assenza di un evento dedicato.
19. **Consegna di `additionalContext` a un subagent: `SubagentStart` di plugin vs `PreToolUse`** — l'esperimento sull'host, le cinque risposte, le prove.

### Mappa dei nomi

Per ogni nome ricorrente, la sezione dove sta la definizione completa.

| Nome | Definizione completa |
|---|---|
| Eventi hook (33) e campi `hookSpecificOutput` | §4 |
| `matcher` | §5 |
| `additionalContext` | §6 |
| `exit 0` / `exit 1` / `exit 2`, `continue`, `stopReason` | §7 |
| `updatedToolOutput`, `updatedMCPToolOutput`, forme d'uscita per tool | §8 |
| `type` (`command`/`http`/`mcp_tool`/`prompt`/`agent`), `if`, `statusMessage`, `once` | §9 |
| `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${user_config.*}` | §10 |
| `async`, `asyncRewake` | §11 |
| `session_id`, `prompt_id`, `cwd`, `transcript_path`, `scratchpad_dir`, `permission_mode`, `effort`, `agent_id`, `agent_type` | §12 |
| Transcript `.jsonl` | §13 |
| `hooks/hooks.json`, frontmatter di skill/subagent | §14 |
| `claude plugin validate`, `/hooks`, debug log | §15 |
| `UserPromptExpansion`, tool `Skill`, `SubagentStart` | §18 |
| `SubagentStart` di plugin: consegna del contesto, campi del payload, cap | §19 |
| `PreToolUse.additionalContext` dentro un subagent | §19 |

---

## 1. Meta e sorgenti

Convenzioni di questa nota:
- `verbatim` = copiato dalla fonte, non riscritto.
- `[to verify]` = la fonte non lo conferma, o è più recente della versione della raccolta che lo dichiara (marcatore della prima raccolta, 2026-10-03).
- `[non documentato]` = la fonte pubblica tace (marcatore dell'estensione, 2026-10-12, che risponde a cinque domande puntuali, Q1–Q5, sulla sostituzione dell'output di un tool).

Fonti primarie recuperate (2026-10-03) — prima raccolta, base **2.1.276**:
- https://code.claude.com/docs/en/hooks (riferimento; la pagina arriva troncata via fetch, dopo la sezione `InstructionsLoaded`)
- https://code.claude.com/docs/en/hooks-guide
- https://code.claude.com/docs/en/sessions (`transcript_path`, storage dei transcript)
- https://code.claude.com/docs/en/statusline
- https://code.claude.com/docs/en/agent-sdk/sessions
- https://code.claude.com/docs/en/tools-reference
- https://code.claude.com/docs/en/skills , https://code.claude.com/docs/en/sub-agents , https://code.claude.com/docs/en/slash-commands
- https://code.claude.com/docs/en/plugins , https://code.claude.com/docs/en/plugins-reference , https://code.claude.com/docs/en/settings
- Release/versione: `gh release list -R anthropics/claude-code`; changelog https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md
- Artefatto di prima parte locale: transcript `.jsonl` reali prodotti da Claude Code **2.1.276** sotto `C:\Users\tomas\.claude\projects\c--dev-daiku-workspace-daiku-dev\`
- Terza parte (usata solo dove marcato): issue https://github.com/anthropics/claude-code/issues/16538 ; mirror https://github.com/xiaolai/anthropic-docs

Fonti primarie recuperate (2026-10-12) — estensione, base **2.1.296**:
- https://code.claude.com/docs/en/hooks (pagina di riferimento, ~268k caratteri: la sezione `PostToolUse decision control` sta fra i ~100000 e i ~200000 caratteri)
- https://code.claude.com/docs/en/hooks-guide
- https://code.claude.com/docs/en/tools-reference
- https://code.claude.com/docs/en/checkpointing
- https://code.claude.com/docs/en/ide-integrations
- Changelog ufficiale: https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md
- Artefatto di prima parte su disco: `C:\Users\tomas\.vscode\extensions\anthropic.claude-code-2.1.296-win32-x64\resources\native-binary\claude.exe`
- `d.ts` di prima parte: `C:\nvm4w\nodejs\node_modules\@anthropic-ai\claude-code\sdk-tools.d.ts` (pacchetto npm **2.1.276**: indietro di 20 patch rispetto all'estensione 2.1.296 in uso — da riconfermare contro l'host che gira)
- Terza parte (usata solo dove marcato): `anthropics/claude-code` #97278 (aperta), #59160 (chiusa), #96742 (aperta)

---

## 2. Concetti e modello mentale

> Prima raccolta (2026-10-03), base **2.1.276**.

**Modello mentale applicato.** La fonte canonica riflette **l'ultima versione 2.1.288**, non la 2.1.276 allora in uso. Nelle versioni **2.1.277 → 2.1.288** non risulta introdotto alcun *nuovo* evento hook: le voci sono correzioni a hook esistenti. Le note di **2.1.277, 2.1.279 e 2.1.280 non sono state recuperate** (pagina releases troncata). Quanto segue va inteso come comportamento **atteso anche sulla 2.1.276**, ma i punti marcati `[to verify]` vanno confermati sulla versione in uso.

I hook si configurano in una struttura JSON a tre livelli di annidamento (verbatim):

> 1. Choose a hook event to respond to, like `PreToolUse` or `Stop`
> 2. Add a matcher group to filter when it fires, like "only for the Bash tool"
> 3. Define one or more hook handlers to run when matched

Plurale/singolare è significativo: la chiave evento (`PostToolUse`) contiene una lista di **matcher group**; ogni matcher group ha una chiave `hooks` che contiene la lista di **hook handler**.

### 2.1 I 33 eventi hook

La doc dichiara **33 eventi**. Da `https://code.claude.com/docs/en/hooks` (tabella "When it fires"), i **33** eventi sono, verbatim:

`SessionStart`, `Setup`, `UserPromptSubmit`, `UserPromptExpansion`, `PreToolUse`, `PermissionRequest`, `PermissionDenied`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `Notification`, `MessageDisplay`, `SubagentStart`, `SubagentStop`, `TaskCreated`, `TaskCompleted`, `Stop`, `StopFailure`, `TeammateIdle`, `InstructionsLoaded`, `ConfigChange`, `CwdChanged`, `DirectoryAdded`, `FileChanged`, `WorktreeCreate`, `WorktreeRemove`, `PreCompact`, `PostCompact`, `PreModelSwitch`, `PostModelSwitch`, `Elicitation`, `ElicitationResult`, `SessionEnd`.

Nessun nome contiene "Skill" o "Command": non esiste `SkillStart`, `SkillInvoked`, `SlashCommandStart`, `CommandStart` o simili. L'unico evento con prefisso `Start` è `SubagentStart`, ed è ristretto ai subagent. (Conseguenze per l'avvio di skill/comandi: §18.)

---

## 3. Setup e quickstart

### 3.1 Dove si configurano i hook (scope e file)

Tabella *Hook locations* (verbatim), nell'ordine in cui la pagina elenca le sedi:

| Location | Scope | Shareable |
| :- | :- | :- |
| `~/.claude/settings.json` | All your projects | No, local to your machine |
| `.claude/settings.json` | Single project | Yes, can be committed to the repo |
| `.claude/settings.local.json` | Single project | No, gitignored when Claude Code saves a setting to it |
| Managed policy settings | Organization-wide | Yes, admin-controlled |
| Plugin `hooks/hooks.json` | When plugin is enabled | Yes, bundled with the plugin |
| Skill frontmatter | The rest of the session once the skill is invoked | Yes, defined in the skill file |
| Subagent frontmatter | While that subagent is running | Yes, defined in the subagent file |

**Ordine di merge** (verbatim):

> Hook entries merge across settings levels rather than replacing each other: user, project, and local settings add their own hooks without removing managed ones, and the `disableAllHooks` setting can't disable managed hooks from outside managed settings.

> Define plugin hooks in `hooks/hooks.json` with an optional top-level `description` field. When a plugin is enabled, its hooks merge with your user and project hooks.

La precedenza dei **file di settings** (dalla più alta): Managed settings → Command line (`claude --settings`) → Project local (`.claude/settings.local.json`) → Shared project (`.claude/settings.json`) → User (`~/.claude/settings.json`). «A key set at a higher level overrides the same key set lower down» (fonte: settings).

**Gli hook non sono chiavi scalari che si sovrascrivono per precedenza** — sono liste che si **fondono**. Lo stack di precedenza generale delle impostazioni (settings, "In order, highest precedence first": Managed → Command line → Project local → Shared project → User) vale per le chiavi scalari, non per gli hook.

### 3.2 La forma JSON di base

Tre livelli di annidamento (§2). Esempio completo annotato (verbatim):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(rm *)",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/block-rm.sh",
            "args": []
          }
        ]
      }
    ]
  }
}
```

Un `matcher` vuoto (`""`) fa scattare il hook su ogni occorrenza; più handler nello stesso gruppo girano in parallelo.

---

## 4. Eventi e campi `hookSpecificOutput`

La doc dichiara **33 eventi** (elenco piatto in §2.1). Qui: nome esatto, quando scatta, campi `hookSpecificOutput`, pattern di decisione. Il comportamento di `exit 2` per ciascun evento è nella tabella di §7.2.4.

| Evento | Quando scatta | `hookSpecificOutput` (campi) | Pattern di decisione |
|---|---|---|---|
| `SessionStart` | "When a session begins or resumes" | `additionalContext`, `initialUserMessage`, `sessionTitle`, `watchPaths`, `reloadSkills` | Contestuale: nessun controllo di decisione |
| `Setup` | "When you start Claude Code with `--init-only`, or with `--init` or `--maintenance` in `-p` mode" | nessuno | Nessuno (side effects) |
| `UserPromptSubmit` | "When a prompt is submitted, before Claude processes it" | `additionalContext` (non può sostituire il prompt) | Top-level `decision` (`decision:"block"`, `reason`) |
| `UserPromptExpansion` | "When a user-typed command expands into a prompt, before it reaches Claude" | `additionalContext` | Top-level `decision` |
| `PreToolUse` | "Before a tool call executes. Can block it" | `permissionDecision` (`allow`/`deny`/`ask`/`defer`), `permissionDecisionReason`, `updatedInput`, `additionalContext` | `hookSpecificOutput` |
| `PermissionRequest` | "When a tool call needs a permission decision" | `decision.behavior` (`allow`/`deny`), `decision.updatedInput` | `hookSpecificOutput` |
| `PermissionDenied` | "When auto mode denies a tool call, including denials without a classifier verdict" | `retry: true` | `hookSpecificOutput` |
| `PostToolUse` | "After a tool call succeeds" | `additionalContext`, `updatedToolOutput` | Top-level `decision` (+ rewrite) |
| `PostToolUseFailure` | "After a tool call fails" | `additionalContext` | Top-level `decision` |
| `PostToolBatch` | "After a full batch of parallel tool calls resolves, before the next model call" | `additionalContext` | Top-level `decision` |
| `Notification` | "When Claude Code sends a notification" | nessuno | Nessuno |
| `MessageDisplay` | "While assistant message text is displayed" | `displayContent` | `hookSpecificOutput` (display-only) |
| `SubagentStart` | "When a subagent is spawned" | `additionalContext` | Contestuale: nessuna decisione |
| `SubagentStop` | "When a subagent finishes" | `additionalContext` | Top-level `decision` |
| `TaskCreated` | "When a task is being created via `TaskCreate`" | nessuno (top-level `decision`) | Exit code **o** top-level `decision` |
| `TaskCompleted` | "When a task is being marked as completed" | nessuno | Exit code **o** `continue:false` |
| `Stop` | "When Claude finishes responding" | `additionalContext` | Top-level `decision` |
| `StopFailure` | "When the turn ends due to an API error" | nessuno | Nessuno |
| `TeammateIdle` | "When an agent team teammate is about to go idle" | nessuno | Exit code **o** `continue:false` |
| `InstructionsLoaded` | "When a CLAUDE.md or `.claude/rules/*.md` file is loaded into context" | nessuno | Nessuno |
| `ConfigChange` | "When a configuration file changes during a session" | nessuno (top-level `decision`) | Top-level `decision` |
| `CwdChanged` | "When the working directory changes, for example when Claude executes a `cd` command" | nessuno | Nessuno |
| `DirectoryAdded` | "When a working directory is added mid-session via `/add-dir` or the SDK `register_repo_root` control request" | nessuno | Nessuno |
| `FileChanged` | "When a watched file changes on disk. The `matcher` field specifies which filenames to watch" | nessuno | Nessuno |
| `WorktreeCreate` | "When a worktree is being created via `--worktree`, `isolation: \"worktree\"`, or for a background session" | `worktreePath` (solo HTTP hook) | Ritorno di path su stdout / `worktreePath` |
| `WorktreeRemove` | "When a worktree is being removed at session exit, when a subagent finishes, or when you delete a background session" | nessuno — "JSON output is discarded" | Solo exit code |
| `PreCompact` | "Before context compaction" | nessuno (top-level `decision`) | Top-level `decision` |
| `PostCompact` | "After context compaction completes" | nessuno | Nessuno |
| `PreModelSwitch` | "Before Claude Code applies a model switch that you or a client requested. Can block the switch" | `permissionDecision` (`allow`/`deny`/`ask`), `permissionDecisionReason` | `hookSpecificOutput` **o** top-level `decision:"block"` |
| `PostModelSwitch` | "After the session's model changes, including changes Claude Code makes on its own…" | `additionalContext` | Contestuale: nessuna decisione |
| `Elicitation` | "When an MCP server requests user input during a tool call" | `action` (`accept`/`decline`/`cancel`), `content` | `hookSpecificOutput` |
| `ElicitationResult` | "After a user responds to an MCP elicitation, before the response is sent back to the server" | `action`, `content` | `hookSpecificOutput` |
| `SessionEnd` | "When a session terminates" | nessuno | Nessuno |

### 4.1 Riscrittura del contenuto e `hookSpecificOutput`

Dettagli verbatim sulla riscrittura del contenuto — **sede canonica della lista**; §8.1 vi rimanda:

> A few events can also rewrite content rather than only allow or block it:
> * `PreToolUse`: `updatedInput` directly under `hookSpecificOutput` replaces a tool's arguments before it runs.
> * `PermissionRequest`: `updatedInput` inside the `decision` object.
> * `PostToolUse`: `updatedToolOutput` replaces the tool's result.
> * `UserPromptSubmit`: can't replace the prompt; it only injects `additionalContext` alongside it.

`hookSpecificOutput` in generale:

> `hookSpecificOutput` is a nested object for events that need richer control. It requires a `hookEventName` field set to the event name.

`[to verify]` residui, da controllare sulla **2.1.276** in uso:

- introduzione di eventuali nuovi eventi hook nelle versioni **2.1.277, 2.1.279, 2.1.280** (note non recuperate);
- che `additionalContext` su `PreToolUse` e la sua consegna "next to the tool result" siano presenti **identici** sulla 2.1.276;
- le datazioni di `StopFailure` (v2.1.78), `PermissionDenied` (v2.1.88), `TeammateIdle`/`TaskCompleted` (v2.1.33) provengono da un **changelog comunitario di terze parti**, non ufficiale: da confermare sul changelog ufficiale.

---

## 5. `matcher` — forma esatta

Tabella dei pattern, verbatim:

| Matcher value | Evaluated as | Example |
|---|---|---|
| `"*"`, `""`, or omitted | Match all | fires on every occurrence of the event |
| Only letters, digits, `_`, `-`, spaces, `,`, and `\|` | Exact string, or list of exact strings separated by `\|` or `,` with optional surrounding whitespace | `Bash` matches only the Bash tool; `Edit\|Write` and `Edit, Write` each match either tool exactly; `code-reviewer` matches only that agent type |
| Contains any other character | JavaScript regular expression, unanchored | `^Notebook` matches any tool whose name starts with `Notebook`; `mcp__memory__.*` matches every tool from the `memory` server |

> A matcher on the regular-expression path is tested with JavaScript's `RegExp.prototype.test`, which succeeds on a match anywhere in the value. `Edit.*` matches both `Edit` and `NotebookEdit`; wrap the pattern in `^` and `$`, as in `^Edit$`, when you need a whole-string match.

**Nota sui separatori:** nella forma "exact string" il set di caratteri ammette sia `|` sia `,` (con spazi bianchi opzionali attorno). Appena compare **un qualsiasi altro carattere** la stringa diventa una **RegExp non ancorata**.

Regola più stretta di `FileChanged` e `StopFailure`, verbatim:

> `FileChanged` and `StopFailure` use a narrower exact-match set of letters, digits, `_`, and `|` only. A hyphen, space, or comma in a matcher for those two events keeps it on the regular-expression path, and only `|` separates alternatives. Every other event with matcher support in the table that follows accepts `|` or `,`.
> The `FileChanged` event doesn't follow these rules when building its watch list.
> If you add a `matcher` field to an event without matcher support, it is silently ignored.

Tabella per evento, verbatim:

| Event | What the matcher filters | Example matcher values |
|---|---|---|
| `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, `PermissionDenied` | tool name | `Bash`, `Edit\|Write`, `mcp__.*` |
| `SessionStart` | how the session started | `startup`, `resume`, `clear`, `compact`, `fork` |
| `Setup` | which CLI flag triggered setup | `init`, `maintenance` |
| `SessionEnd` | why the session ended | `clear`, `resume`, `logout`, `prompt_input_exit`, `other` |
| `Notification` | notification type | `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_dialog`, `elicitation_url_dialog`, `elicitation_complete`, `elicitation_response`, `agent_needs_input`, `agent_completed`, `quota_auto_resume_fired`, `quota_auto_resume_stale`, `quota_auto_resume_disabled` |
| `SubagentStart` | agent type | `general-purpose`, `Explore`, `Plan`, custom agent names, or plugin-scoped names like `^my-plugin:reviewer$` |
| `PreCompact`, `PostCompact` | what triggered compaction | `manual`, `auto` |
| `PreModelSwitch`, `PostModelSwitch` | canonical name of the model the session switches to | `claude-opus-5`, `claude-opus-4-6\|claude-opus-5`, `.*opus.*` |
| `SubagentStop` | agent type | same values as `SubagentStart` |
| `ConfigChange` | configuration source | `user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills` |
| `CwdChanged` | no matcher support | always fires on every occurrence |
| `DirectoryAdded` | how the directory was added | `slash_command`, `register_repo_root` |
| `FileChanged` | literal filenames to watch | `.envrc\|.env` |
| `StopFailure` | error type | `rate_limit`, `overloaded`, `authentication_failed`, `oauth_org_not_allowed`, `account_on_hold`, `billing_error`, `invalid_request`, `model_not_found`, `server_error`, `max_output_tokens`, `cloud_credential_error`, `unknown` |
| `InstructionsLoaded` | load reason | `session_start`, `nested_traversal`, `path_glob_match`, `include`, `compact` |
| `UserPromptExpansion` | command name | your skill or command names |
| `Elicitation` | MCP server name | your configured MCP server names |
| `ElicitationResult` | MCP server name | same values as `Elicitation` |
| `UserPromptSubmit`, `PostToolBatch`, `Stop`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`, `WorktreeCreate`, `WorktreeRemove`, `MessageDisplay` | no matcher support | always fires on every occurrence |

`[to verify]` La voce su `StopFailure` / `cloud_credential_error` richiede **Claude Code v2.1.267 o successiva** — quindi presente sulla 2.1.276. Nota di changelog: `Matching StopFailure on cloud_credential_error requires Claude Code v2.1.267 or later, the first version that reports credential-load failures under that value rather than server_error or unknown.`

Come viene valutato il matcher, verbatim:

> For most events, Claude Code evaluates the matcher against a field from the JSON input it sends to your hook on stdin. For tool events, that field is `tool_name`. For `PreModelSwitch` and `PostModelSwitch`, Claude Code evaluates the matcher against the canonical name it derives from `to_model`.

Filtro più fine con `if`, verbatim:

> For tool events, you can filter more narrowly by setting the `if` field on individual hook handlers. `if` uses permission rule syntax to match against the tool name and arguments together, so `"Bash(git *)"` runs when any subcommand of the Bash input matches `git *` and `"Edit(*.ts)"` runs only for TypeScript files.

Tool MCP, verbatim:

> MCP server tools appear as regular tools in tool events… MCP tools follow the naming pattern `mcp__<server>__<tool>`… To match every tool from a server, append `.*` to the server prefix. **The `.*` is required**… Tools from a plugin-bundled MCP server use a scoped server segment that includes the plugin name: `mcp__plugin_<plugin-name>_<server-name>__<tool>`. A matcher written against the bare server key never fires for these tools.

Esempi JSON, verbatim.

Hook con `matcher: "Bash"` e `if: "Bash(rm *)"` (la stessa forma dell'esempio di base in §3.2):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(rm *)",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/block-rm.sh",
            "args": []
          }
        ]
      }
    ]
  }
}
```

Due tool esatti separati da `|`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/lint-check.sh"
          }
        ]
      }
    ]
  }
}
```

Due matcher RegExp su tool MCP:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "mcp__memory__.*",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Memory operation initiated' >> ~/mcp-operations.log"
          }
        ]
      },
      {
        "matcher": "mcp__.*__write.*",
        "hooks": [
          {
            "type": "command",
            "command": "/home/user/scripts/validate-mcp-write.py"
          }
        ]
      }
    ]
  }
}
```

Un esempio di hook con `matcher` nel frontmatter di una skill è in §14.3.

---

## 6. `additionalContext` — consegna del contesto a Claude

Fonte canonica: https://code.claude.com/docs/en/hooks (recuperata 2026-10-03). Modello mentale: comportamento documentato per la **2.1.276**; le differenze che appartengono a versioni più recenti (fino a 2.1.288) sono marcate.

`additionalContext` vive **dentro** l'oggetto `hookSpecificOutput` — che richiede sempre il campo `hookEventName` impostato al nome dell'evento (§4.1) — e non è un campo universale.

### 6.1 Con quali eventi è disponibile

La tabella "Decision control" divide gli eventi in due gruppi:

| Evento | Modello | Fonte |
|---|---|---|
| `SessionStart`, `SubagentStart`, `PostModelSwitch` | "Context only": `hookSpecificOutput.additionalContext` aggiunge contesto per Claude. Nessun blocco né decision control | doc, tabella Decision control |
| `UserPromptSubmit`, `UserPromptExpansion`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `Stop`, `SubagentStop` | pattern `decision` top-level, **ma** `Stop` e `SubagentStop` accettano anche `hookSpecificOutput.additionalContext` per "non-error feedback that continues the conversation" | doc, tabella Decision control |
| `PreToolUse` | usa `hookSpecificOutput` per `permissionDecision`; "You can also modify tool input before it runs or **inject additional context** for Claude" | doc, esempio PreToolUse + decision control |

Quindi, degli undici eventi elencati, **dieci sono confermati esplicitamente** come portatori di `additionalContext` attraverso la lista di consegna (§6.3). Per `PreToolUse` la doc lo conferma nella prosa ("inject additional context for Claude") e lo colloca "next to the tool result" nella lista di consegna della sezione *Add context for Claude* — confermato. Tutti e undici rispondono affermativamente.

Da non confondere: la doc elenca molti altri eventi **senza** `additionalContext` — `Setup`, `ConfigChange`, `PreCompact`, `PreModelSwitch`, `PermissionRequest`, `PermissionDenied`, `Elicitation`, `ElicitationResult`, `MessageDisplay`, `WorktreeCreate`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`, `FileChanged`, `InstructionsLoaded`, `SessionEnd`.

### 6.2 `PreToolUse` può iniettare contesto al modello?

**Sì, esplicitamente.** `PreToolUse` non si limita a decidere (`allow`/`deny`/`ask`/`defer`): **può anche iniettare contesto al modello** tramite `hookSpecificOutput.additionalContext`. Prove, dalla doc ufficiale:

1. **Tab `PreToolUse`**, verbatim:
   > Uses `hookSpecificOutput` for richer control: allow, deny, or escalate to the user. You can also modify tool input before it runs **or inject additional context for Claude**.

2. **Sezione "Add context for Claude"** — la tabella di consegna di `additionalContext` elenca `PreToolUse` fra gli eventi che lo consegnano al modello; l'elenco completo dei punti d'inserimento è in §6.3, e per `PreToolUse` la riga recita **next to the tool result** (insieme a `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`).

3. **Riga della tabella "Decision control"** per `PreToolUse`:
   > | PreToolUse | `hookSpecificOutput` | `permissionDecision` (allow/deny/ask/defer), `permissionDecisionReason` |

**Conclusione netta:** `PreToolUse` accetta in `hookSpecificOutput` **quattro** campi — `permissionDecision`, `permissionDecisionReason`, `updatedInput` **e `additionalContext`**. Quindi può fare entrambe le cose: decidere *e* iniettare contesto. Il testo iniettato arriva a Claude come *system reminder* **accanto al risultato del tool**, letto alla richiesta di modello successiva.

`[to verify]` Non c'è prova che `additionalContext` su `PreToolUse` sia stato introdotto dopo la 2.1.276: la doc è alla 2.1.288 ma nessuna voce di changelog 2.1.277–2.1.288 lo aggiunge. Da confermare sulla **2.1.276** in uso.

### 6.3 Come arriva all'agente

Testo verbatim (sezione *Add context for Claude*):

> The `additionalContext` field passes a string from your hook into Claude's context window. Claude Code wraps the string in a system reminder and inserts it into the conversation at the point where the hook fired. Claude reads the reminder on the next model request, but it doesn't appear as a chat message in the interface.

Il punto d'inserimento dipende dall'evento (verbatim):

> * `SessionStart` and `SubagentStart`: at the start of the conversation, before the first prompt
> * `UserPromptSubmit` and `UserPromptExpansion`: alongside the submitted prompt
> * `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, and `PostToolBatch`: next to the tool result
> * `Stop` and `SubagentStop`: at the end of the turn. The conversation continues so Claude can act on the feedback.
> * `PostModelSwitch`: with the next request after the switch.

Nota: su `UserPromptSubmit` l'hook **non può sostituire il prompt** — "it only injects `additionalContext` alongside it".

Inoltre quattro soli eventi aggiungono lo **stdout in chiaro** come contesto su exit 0 (non solo via JSON): `UserPromptSubmit`, `UserPromptExpansion`, `SessionStart`, `PostModelSwitch`. Per tutti gli altri lo stdout va al debug log e non entra nel transcript.

### 6.4 Più hook per lo stesso evento

Verbatim: **"When several hooks return `additionalContext` for the same event, Claude receives all of the values."**

### 6.5 Limiti (la cap di 10.000 caratteri)

Verbatim (sezione JSON output):

> A hook's `additionalContext`, `systemMessage`, and `initialUserMessage` strings, and its plain stdout, are capped at 10,000 characters:
> * **Scope**: Claude Code measures each string on its own, even when several hooks run for the same event. For JSON output, each field is measured separately; plain stdout is measured whole.
> * **Over the limit**: Claude Code saves the output to a file in the session directory and replaces it with the file path and a preview of up to the first 2,000 characters. Unlike that Bash ceiling, **this cap has no setting or environment variable to raise it**.
> * **Reading the file**: Claude Code doesn't ask Claude to read the file, so keep anything Claude must always see within the cap.

Confermato: `additionalContext`, `systemMessage`, `initialUserMessage` e stdout in chiaro sono **misurati ciascuno a parte**, non sommati. La cap **non è alzabile**. Se un valore supera i 10.000 caratteri, Claude Code scrive il testo in un file nella session directory e passa a Claude il path col preview fino ai primi 2.000 caratteri. (Applicazione a `updatedToolOutput`: §8.4.)

### 6.6 Quando viene scartato

**Timeout.** Regola generale verbatim:

> Apart from a command hook you run with `async: true`, Claude Code cancels a `command`, `http`, or `mcp_tool` hook that reaches its `timeout`, discarding the hook's output, so on most events a timed-out hook renders no decision.

Default di `timeout` e riduzioni per evento: riga del campo `timeout` in §9. I `SessionEnd` condividono un budget di 1,5 secondi (alzabile fino a 60 se il progetto imposta un `timeout` per-hook più lungo).

**`UserPromptSubmit` in timeout.** L'hook viene cancellato e il suo output **scartato**; la doc **non** afferma che il timeout blocchi il prompt, né che `additionalContext` di un hook andato in timeout arrivi comunque. L'unico evento in cui il timeout *blocca* è `PreModelSwitch`: "a hook canceled at its timeout blocks the model switch".

**`PreToolUse` in timeout.** Verbatim: "A timed-out `command`, `http`, or `mcp_tool` hook doesn't block the tool call. The call continues through the normal permission flow". Solo un *Agent SDK callback hook* che supera il timeout blocca la tool call.

**`Setup` scarta sempre `hookSpecificOutput.additionalContext`.** Verbatim: "On every exit code, Claude Code discards a Setup hook's JSON output fields, such as `systemMessage`, `continue`, and `hookSpecificOutput.additionalContext`."

**`Elicitation` / `ElicitationResult` con exit 2:** "an exit-2 hook's `hookSpecificOutput` is ignored".

**Bug noto #16538 (plugin SessionStart).** Confermato dalla fonte: issue **anthropics/claude-code#16538**, titolo *"Plugin SessionStart hooks don't surface hookSpecificOutput.additionalContext to Claude"*, aperta da christinetyip il 2026-01-07, **chiusa come "not planned"** con etichetta `stale`, **senza commenti dei maintainer**. Sintomo: un hook `SessionStart` definito in `hooks.json` di un plugin esegue e restituisce JSON valido con `hookSpecificOutput.additionalContext`, ma Claude riceve solo `"SessionStart:Callback hook success: Success"`; lo stesso hook in `~/.claude/settings.json` funziona. L'issue **non indica versioni** e non risulta risolta. `[to verify: stato su 2.1.276]`.

### 6.7 Persistenza, replay, staleness

Verbatim (sezione *Add context for Claude*):

> Claude Code saves the injected text in the session transcript. For mid-session events like `PostToolUse` or `UserPromptSubmit`, when you resume with `--continue` or `--resume`, Claude Code replays the saved text rather than re-running the hook for past turns, so values like timestamps or commit SHAs become stale. `SessionStart` hooks run again on resume with `source` set to `"resume"`, or `"fork"` if you added `--fork-session`, so they can refresh their context.

Conseguenza operativa: un `PostToolUse`/`UserPromptSubmit` che inietta un timestamp o uno SHA di commit **non** viene rieseguito al resume — il testo salvato viene rigiocato e invecchia. Solo `SessionStart` si ri-esegue (con `source: "resume"` / `"fork"`) e può rinfrescare il contesto.

### 6.8 Consiglio di stesura

Verbatim:

> Write the text as factual statements rather than imperative system instructions. Phrasing such as "The deployment target is production" or "This repo uses `bun test`" reads as project information. Text framed as out-of-band system commands can trigger Claude's prompt-injection defenses, which causes Claude to surface the text to you instead of treating it as context.

Per istruzioni che non cambiano mai, la doc preferisce `CLAUDE.md` ("It loads without running a script").

### 6.9 Note di versione

- In uso nella raccolta: **2.1.276**. Ultima pubblicata allora: **2.1.288**.
- Tra 2.1.282 e 2.1.288 il changelog cita correzioni agli hook ma **nessuna** che alteri la semantica di `additionalContext`.
- `[to verify: le versioni 2.1.276–2.1.281 non sono recuperabili dal changelog via WebFetch (troncato); non confermabile se `PostModelSwitch`, `PostToolBatch` o la cap a 10.000 caratteri esistessero già nella 2.1.276]`.

---

## 7. Codici d'uscita, precedenza e decisione

> Prima raccolta (2026-10-03). Versione in uso dichiarata: **2.1.276**. Ultima pubblicata allora: **2.1.288** (2026-10-02). Dove una regola è legata a una soglia di versione la soglia è indicata; dove una soglia supera 2.1.276 il fatto è marcato come **più recente della versione in uso**.

### 7.1 Campi universali dell'output

Campi universali (fuori da `hookSpecificOutput`), presenti su qualunque evento:

- `continue` (default `true`), `stopReason` — `{ "continue": false, "stopReason": "..." }` ferma del tutto (su `PreToolUse`/`PostToolUse` ferma anche se la tool call fallisce o Claude sta ancora streamando).
- `suppressOutput` (no effect), `systemMessage`, `terminalSequence` (allowlist OSC `0`/`1`/`2`/`9`/`99`/`777` e BEL).

Tabella *JSON output* (verbatim):

| Field | Default | Description |
| :- | :- | :- |
| `continue` | `true` | If `false`, Claude stops processing entirely after the hook runs. Takes precedence over any event-specific decision fields |
| `stopReason` | none | Message shown to the user when `continue` is `false`. It stays in the conversation, so Claude sees it if the conversation continues |

Esempio verbatim: `{ "continue": false, "stopReason": "Build failed, fix errors before continuing" }`.

### 7.2 Codici d'uscita

Regola generale, verbatim:

> The exit code from your hook command tells Claude Code whether the action should proceed, be blocked, or be ignored. The exit code doesn't act alone. Claude Code reads JSON output fields from stdout on every exit code, not just 0, and for events that use the standard decision model, a parsed object that passes schema validation takes effect alongside the code. Exit 2's block is the one outcome JSON can't override.

#### 7.2.1 `exit 0` e il parsing di stdout

Verbatim (sezione *Exit code 0*):

> * **Starts with `{` and ends with `}`**: Claude Code parses it as JSON. When the output is two or more lines that each parse as JSON on their own, and no line is a JSON output object that sets a field, Claude Code treats the whole output as plain text. When one of those lines does set a field, the whole output is a parse failure, described below.
> * **Starts with `{` but doesn't end with `}`**: Claude Code treats it as plain text.
> * **Starts with anything else**: Claude Code treats it as plain text, a JSON array or a quoted JSON string included.

Altre regole di `exit 0`:

- Per la maggior parte degli eventi Claude Code scrive stdout nel debug log e non lo mostra nel transcript. Eccezioni: `UserPromptSubmit`, `UserPromptExpansion`, `SessionStart`, `PostModelSwitch`, dove stdout in testo semplice diventa contesto che Claude vede.
- Per gli eventi con lo standard decision model, `exit 0` con un oggetto che non passa la schema validation è un **non-blocking error**: l'azione prosegue e il transcript mostra un avviso `<hook name> hook error`.
- **Prima della v2.1.248** Claude Code trattava come testo semplice lo stdout che non riusciva a parsare come JSON; soglia inferiore a 2.1.276: il comportamento attuale è quello nuovo.
- `stderr` di un hook che esce `0` va solo nel debug log, mai nel transcript, e Claude non lo vede.
- JSON con campi al livello sbagliato: `permissionDecision` e `additionalContext` vanno dentro `hookSpecificOutput`; al top level vengono ignorati senza errore.

#### 7.2.2 `exit 2` (blocco)

Verbatim (sezione *Exit code 2*):

> Exit 2 means a blocking error. On events that can block, exit 2 blocks whether or not you print JSON: even a JSON `permissionDecision` of `"allow"` can't override it. Claude Code still reads any valid JSON output on stdout. On `Elicitation` and `ElicitationResult`, an exit-2 hook's `hookSpecificOutput` is ignored.
>
> The blocking message is the reason from your JSON's blocking decision when it makes one, and your stderr text otherwise.

Nota di versione: un hook che esce 2 stampando JSON **non valido** blocca comunque. **Prima della v2.1.214** quella combinazione era non-blocking. In uso 2.1.276: comportamento attuale.

Frase-esatta sul blocco (verbatim, *Warning*):

> For most hook events, exit code 2 is the only exit code that blocks through the code alone. Without valid JSON on stdout, Claude Code treats exit code 1 as a non-blocking error and proceeds with the action, even though 1 is the conventional Unix failure code. If your hook is meant to enforce a policy, use `exit 2`. The worktree events differ: any non-zero exit code from `WorktreeCreate` aborts worktree creation, and any non-zero exit code from `WorktreeRemove` makes worktree removal fail if the directory still exists afterward.

#### 7.2.3 `exit 1` e ogni altro codice (non bloccante)

Verbatim (sezione *Other exit codes (including exit 1)*):

> Any other exit code doesn't block on its own for most hook events. What happens depends on your stdout:
>
> * With a parsed object that passes schema validation, for events that use the standard decision model, Claude Code ignores the exit code and the JSON alone decides the outcome: each field the event supports is honored, including `permissionDecision`, `additionalContext`, `updatedInput`, and `systemMessage`, and the hook isn't reported as an error.
> * With a parsed object that fails schema validation … it's the same non-blocking error as on exit 0.
> * With stdout that Claude Code tries to parse as JSON and can't … the same non-blocking error as on exit 0.
> * With stdout that Claude Code treats as plain text, or with empty stdout, it's a non-blocking error for most hook events: the action proceeds, and the transcript shows a `<hook name> hook error` notice followed by the first line of stderr, prefixed with `Failed with non-blocking status code:`.

Un hook che non riesce a partire (path inesistente o non eseguibile, shell exit 127) finisce nello stesso bucket non-bloccante.

#### 7.2.4 Tabella `exit 2` per evento (verbatim)

| Hook event | Can block? | What happens on exit 2 |
| :- | :- | :- |
| `PreToolUse` | Yes | Blocks the tool call |
| `PermissionRequest` | No | Exit code 2 isn't honored for this event and the permission flow proceeds unchanged. Deny through the `decision` object instead |
| `UserPromptSubmit` | Yes | Blocks the prompt, so it never reaches Claude |
| `UserPromptExpansion` | Yes | Blocks the expansion |
| `Stop` | Yes | Prevents Claude from stopping, continues the conversation |
| `SubagentStop` | Yes | Prevents the subagent from stopping |
| `TeammateIdle` | Yes | Prevents the teammate from going idle, so it continues working |
| `TaskCreated` | Yes | Rolls back the task creation |
| `TaskCompleted` | Yes | Prevents the task from being marked as completed |
| `ConfigChange` | Yes | Blocks the configuration change from taking effect (except `policy_settings`) |
| `StopFailure` | No | Output and exit code are ignored, except `terminalSequence` |
| `PostToolUse` | No | Shows stderr to Claude; the tool already ran |
| `PostToolUseFailure` | No | Shows stderr to Claude; the tool already failed |
| `PostToolBatch` | Yes | Stops the agentic loop before the next model call |
| `PermissionDenied` | No | Exit code and stderr are ignored because the denial already occurred. Use JSON `hookSpecificOutput.retry: true` to tell the model it may retry |
| `Notification` | No | Exit code and stderr are ignored |
| `SubagentStart` | No | Shows stderr to user only |
| `SessionStart` | No | Shows stderr to user only |
| `Setup` | No | Exit code and stderr are ignored |
| `SessionEnd` | No | Shows stderr to user only |
| `CwdChanged` | No | Shows stderr to user only |
| `DirectoryAdded` | No | Stderr goes to the debug log; the directory is already added |
| `FileChanged` | No | Shows stderr to user only |
| `PreCompact` | Yes | Blocks compaction |
| `PostCompact` | No | Shows stderr to user only |
| `PreModelSwitch` | Yes | Blocks the model switch and shows stderr to the user |
| `PostModelSwitch` | No | Shows stderr to user only; the model already switched |
| `Elicitation` | Yes | Denies the elicitation |
| `ElicitationResult` | Yes | Blocks the response (action becomes decline) |
| `WorktreeCreate` | Yes | Any non-zero exit code causes worktree creation to fail |
| `WorktreeRemove` | Yes | Any non-zero exit code causes worktree removal to fail if the directory still exists afterward |
| `InstructionsLoaded` | No | Exit code is ignored |
| `MessageDisplay` | No | The original text is displayed |

Nota: per `SessionStart`, `SubagentStart` e `PostModelSwitch` Claude Code rende lo `stderr` dell'`exit 2` nel transcript come avviso `<hook name> hook error`. Claude non lo vede e la sessione/subagent prosegue.

#### 7.2.5 HTTP hook (analogo per codice di stato)

Verbatim:

> * **2xx with an empty body**: success, equivalent to exit code 0 with no output
> * **2xx with a JSON object body**: parsed using the same JSON output schema as command hooks. A body that fails schema validation is a non-blocking error
> * **Non-2xx status**: non-blocking error, execution continues
> * **Connection failure**: non-blocking error, execution continues
> * **Timeout**: the hook is canceled
>
> Unlike command hooks, HTTP hooks can't signal a blocking error through status codes alone. To block a tool call or deny a permission, return a 2xx response with a JSON body containing the appropriate decision fields.

### 7.3 Precedenza quando più hook rispondono allo stesso evento

Merge fra livelli e scope delle sedi: **§3.1** (gli hook sono liste che si **fondono**, non chiavi scalari).

#### 7.3.1 Parallelo e deduplicazione (verbatim)

> All matching hooks run in parallel. If you define the same handler in more than one settings file, it runs once. A plugin's or skill's copy of the same handler stays separate.

`[to verify: la stringa "All matching hooks run rather than replacing one another" non compare verbatim nelle pagine recuperate; la frase equivalente presente è la precedente, più "Hook entries merge across settings levels rather than replacing each other"]`.

#### 7.3.2 Aggregazione delle decisioni (verbatim, hooks-guide)

> When multiple hooks match the same event, every hook's command runs to completion before Claude Code merges the results. One hook returning `deny` doesn't stop sibling hooks from executing. Don't rely on one hook's `deny` to suppress side effects in another hook.
>
> After all matching hooks finish, Claude Code combines their outputs. For `PreToolUse` permission decisions, the most restrictive answer applies, in the order `deny`, `defer`, `ask`, `allow`. Text from `additionalContext` is kept from every hook and passed to Claude together.

Limite non deterministico sugli input riscritti (verbatim, *Limitations*):

> When multiple `PreToolUse` hooks return `updatedInput` to rewrite a tool's arguments, the last one to finish takes effect. Since hooks run in parallel, the order is non-deterministic. Avoid having more than one hook modify the same tool's input.

Il precedente tra exit 2 e JSON: `exit 2` batte qualunque `permissionDecision`, incluso `"allow"`.

#### 7.3.3 Hook e modalità di permesso (verbatim, *Limitations*)

> `PreToolUse` hooks fire before any permission-mode check, in every permission mode, including `dontAsk`. A hook that returns `permissionDecision: "deny"` blocks the tool even in `bypassPermissions` mode or with `--dangerously-skip-permissions`.
>
> The reverse is not true: a hook returning `"allow"` doesn't bypass deny rules from settings … Hooks in settings files and in a plugin's `hooks/hooks.json` can tighten restrictions but not loosen them past what permission rules allow.

---

## 8. Sostituire l'output di un tool: `updatedToolOutput`

> Estensione (2026-10-12), base **2.1.296**. Approfondimento su cinque domande puntuali (Q1–Q5): dove la fonte pubblica tace, la risposta è `[non documentato]`. Le soglie di versione dei campi qui trattati sono tabellate in §16.2; l'input specifico di `PostToolUse` è in §12.4.

### 8.1 Il campo nel contratto pubblico (Q1)

**Sì.** `updatedToolOutput` è documentato nella pagina di riferimento degli hook, § *PostToolUse decision control*. Tabella dei campi (verbatim):

> | Field | Description |
> | :- | :- |
> | `decision` | `"block"` adds the `reason` next to the tool result. Claude still sees the original output; to replace it, use `updatedToolOutput` |
> | `reason` | Explanation shown to Claude when `decision` is `"block"` |
> | `additionalContext` | String added to Claude's context alongside the tool result. See [Add context for Claude](#add-context-for-claude) |
> | `classifierContext` | Short note about this call's result for the [auto mode] classifier rather than for Claude. … Requires Claude Code v2.1.236 or later |
> | `updatedToolOutput` | Replaces the tool's output with the provided value before it is sent to Claude. The value must match the tool's output shape |
> | `updatedMCPToolOutput` | Replaces the output for [MCP tools] only. Prefer `updatedToolOutput`, which works for all tools |

La collocazione di `updatedToolOutput` nella lista delle riscritture di contenuto è verbatim in §4.1. La guida alla redazione (verbatim):

> For redaction or transformation use cases, intercept at `PreToolUse` for outbound tool inputs and `PostToolUse` for inbound tool results.

**Cosa NON è nel contratto pubblico.** La doc nomina il campo, la sua semantica di sostituzione e il requisito «must match the tool's output shape», ma **non pubblica lo schema per-tool** (le forme di `Read`, `Grep`, `Glob`, `Edit`, `Write`: §8.2) né la regola esatta di validazione. La sostituzione e la sua validazione di forma sono quindi **documentate in prosa**, con un solo esempio (il `Bash`), mentre le forme effettive sono reperibili solo nell'artefatto di prima parte (il `d.ts` e il binario).

### 8.2 Quali tool, quali forme d'uscita, e cosa succede se la forma non combacia (Q2)

**Quali tool.** `updatedToolOutput` «works for all tools»; `updatedMCPToolOutput` è la variante **solo-MCP**, che la doc stessa sconsiglia («Prefer `updatedToolOutput`»).

**Cosa succede se la forma non combacia.** Warning verbatim dalla doc:

> `updatedToolOutput` only changes what Claude sees. The tool has already run by the time the hook fires, so any files written, commands executed, or network requests sent have already taken effect. Telemetry such as OpenTelemetry tool spans and analytics events also captures the original output before the hook runs. To prevent or modify a tool call before it runs, use a `PreToolUse` hook instead.
>
> The replacement value must match the tool's output shape. Built-in tools return structured objects rather than plain strings. For example, `Bash` returns an object with `stdout`, `stderr`, `interrupted`, and `isImage` fields. For built-in tools, a value that doesn't match the tool's output schema is ignored and the original output is used. MCP tool output is passed through without schema validation. Stripping error details that Claude needs can cause it to proceed on a false assumption.

Quindi: **tool interni** → se la forma non combacia, la sostituzione è **ignorata in silenzio** e resta l'originale; **tool MCP** → nessuna validazione di schema, il valore passa così com'è. La trappola dichiarata: togliere dettagli d'errore che servono può far procedere il modello su un'assunzione falsa.

Esempio verbatim (sostituzione di un output `Bash`, forma a quattro campi):

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "Additional information for Claude",
    "updatedToolOutput": {
      "stdout": "[redacted]",
      "stderr": "",
      "interrupted": false,
      "isImage": false
    }
  }
}
```

**Le forme effettive per-tool.** Solo `Bash` è esemplificato nella doc pubblica. Le forme qui sotto vengono dal `d.ts` di prima parte `C:\nvm4w\nodejs\node_modules\@anthropic-ai\claude-code\sdk-tools.d.ts` (pacchetto npm **2.1.276**: **indietro di 20 patch** rispetto all'estensione 2.1.296 in uso — vanno riconfermate contro l'host che gira). Non sono contratto pubblico: il `d.ts` è generato, cambia fra versioni e non nomina affatto gli hook.

| Tool | Forma dell'output (verbatim dal d.ts) | Righe |
|---|---|---|
| `Bash` | `export interface BashOutput` — `stdout: string`, `stderr: string`, `rawOutputPath?: string`, `interrupted: boolean`, più facoltativi (`isImage?`, `backgroundTaskId?`, `timedOutAfterMs?`, `persistedOutputPath?`, `persistedOutputSize?`, `returnCodeInterpretation?`, `staleReadFileStateHint?`, `gitOperation?`, …) | 3267–3372 |
| `Read` | `export type FileReadOutput =` — unione discriminata su `type`: ramo `"text"` con oggetto `file { filePath; content; numLines; startLine; totalLines; truncatedByTokenCap? }`, ramo `"image"` con `file { base64; type; originalSize; dimensions? }` | 208–… |
| `Grep` | `export interface GrepOutput { mode?; numFiles; filenames; content?; numLines?; numMatches?; totalFiles?; totalLines?; appliedLimit?; appliedOffset? }` | 3526–3537 |
| `Glob` | `export interface GlobOutput { durationMs; numFiles; filenames; truncated; totalMatches?; countIsComplete? }` — **soli metadati**: nessun testo da comprimere | 3500–3525 |
| `Edit` | `export interface FileEditOutput { filePath; oldString; newString; originalFile; structuredPatch[]; userModified; replaceAll; gitDiff?; staged? }` | 3400–3451 |
| `Write` | `export interface FileWriteOutput { type: "create" \| "update"; filePath; content; structuredPatch[]; originalFile; gitDiff?; userModified?; staged? }` | 3452–3499 |

Tipo `Bash` verbatim (estratto):

```ts
export interface BashOutput {
  /** The standard output of the command */
  stdout: string;
  /** The standard error output of the command */
  stderr: string;
  /** Path to raw output file for large MCP tool outputs */
  rawOutputPath?: string;
  /** Whether the command was interrupted */
  interrupted: boolean;
  /** Flag to indicate if stdout contains image data */
  isImage?: boolean;
  // …
  /** Path to the persisted full output in tool-results dir (set when output is too large for inline) */
  persistedOutputPath?: string;
  /** Total size of the output in bytes (set when output is too large for inline) */
  persistedOutputSize?: number;
  // …
}
```

**Corroborazione dal binario 2.1.296** (prova su disco, `grep -a` sulle stringhe di `claude.exe`): la stringa di log della validazione di forma recita «`updatedToolOutput that does not match `…`'s output shape: reason=`…` detailChars=`…» e termina «`'s output shape; using original output.`» — cioè il binario conferma il ripiego silenzioso sull'originale. Il binario porta anche lo schema Zod del campo: `updatedToolOutput:oe().optional().describe("Replaces the tool output before it is sent to the model")` e `updatedMCPToolOutput:…describe("Replaces the output for MCP tools only. Prefer updatedToolOutput, which works for all tools")`.

### 8.3 Interferenza con altre funzioni documentate (Q4)

**(a) Il tracciamento dei file cambiati che l'host deriva da `Bash`.** Esiste ed è documentato — e il nome è `bashEditDiff`. Verbatim dalla doc (§ `PostToolUse`):

> When a Bash command changes files in a Git repository, Claude Code can record what changed. It records the changes in every permission mode when the `bashEditDiffEnabled` setting turns recording on; … Otherwise it records them only in auto mode and `bypassPermissions` mode, and only when Claude Code directs Claude to edit files through Bash. Set `bashEditDiffEnabled` to `false` to turn the recording off. Background commands and read-only commands carry no diff.
>
> Your `PostToolUse` hook then receives the changed files in `tool_response.bashEditDiff`. … Requires Claude Code v2.1.269 or later.

Campi del blocco `bashEditDiff` (verbatim): `changedFiles` (path assoluti, max 200), `files` (diff di max 5 file), `moreFiles`, `unavailable`, `skipped`, `shared`. Caveat dichiarato: «The list is best effort and in public beta. Claude Code can miss a change, include a file that another process changed at the same time, or stop at its size limits. The field shape may change. Use the list to find what to review, not to enforce a policy.»
**Interferenza con la sostituzione: `[non documentato]`.** Il diff è calcolato a monte (via git) e consegnato **dentro `tool_response`**, che l'hook riceve comunque; il Warning su `updatedToolOutput` nomina solo la telemetria (OpenTelemetry/analytics), **non** `bashEditDiff`. La forma di sostituzione dichiarata per `Bash` (§8.2) non contiene alcun campo `bashEditDiff`. Che il rimpiazzo tocchi il tracciamento è `[non documentato]`.
Nota: il checkpoint/file-history **non** deriva da `Bash` — la doc `checkpointing` è esplicita («Checkpointing does not track files modified by Bash commands … Only direct file edits made through Claude's file editing tools are tracked»).

**(b) Le diagnosi dell'IDE dell'estensione VSCode.** La doc di prima parte le documenta solo come **tool MCP a richiesta** (`mcp__ide__getDiagnostics`, e dal pannello chat `mcp__claude-vscode__getDiagnostics`, «Claude Code v2.1.285 or later»), e parla in generale di «diagnostic sharing»: `https://code.claude.com/docs/en/ide-integrations`. Che vengano **iniettate automaticamente sul `PostToolUse` di `Edit`** (blocco `<ide_diagnostics>` nel tool result) è affermato **solo da issue di terze parti** (`anthropics/claude-code` #59160 chiusa, #96742 aperta), non dalla doc. **Che la sostituzione dell'output interferisca con le diagnosi iniettate è `[non documentato]`** da ogni fonte.

**(c) Il path dell'output grezzo che un esito di `Bash` può portarsi dietro.** Il **comportamento** è documentato (doc `tools-reference`, § *Output limits*): quando l'output supera la soglia inline, «past that, the path of a file saved to the session directory and truncated past 64 MiB, plus a preview of up to the first 2,000 characters, and Claude reads or searches the file when it needs the rest». Ma **il nome di un campo che porti quel path non è documentato**: nella forma d'uscita di `Bash` dichiarata per gli hook (`stdout`, `stderr`, `interrupted`, `isImage`, §8.2) il path **non c'è** — è **testo dentro l'output**. Il `d.ts` lo espone come `rawOutputPath?` (commento: «Path to raw output file for large MCP tool outputs») e come `persistedOutputPath?`+`persistedOutputSize?` («set when output is too large for inline»): **campi dell'artefatto di prima parte, non del contratto pubblico** → `[non documentato]` nella doc.
Conseguenza operativa: una sostituzione `Bash` con la forma a quattro campi **sopprime** il riferimento al file grezzo; non esiste un campo strutturato documentato da preservare al suo posto.

### 8.4 Limiti dichiarati: dimensione, timeout, comando fallito (Q5)

**Dimensione.** La cap documentata è: «A hook's `additionalContext`, `systemMessage`, and `initialUserMessage` strings, and its plain stdout, are capped at 10,000 characters», con ricaduta su file + preview quando la si supera, e «this cap has no setting or environment variable to raise it» (§6.5). **`updatedToolOutput` NON è nominato in quella cap** → nessun limite di dimensione **documentato** sulla stringa sostitutiva; il vincolo dichiarato resta **la forma** (§8.2). Se una sostituzione enorme sia comunque limitata è `[non documentato]`.

**Timeout.** Default per tipo: `command`/`http`/`mcp_tool` = **600 secondi (10 minuti)**, **non ridotto** su `PostToolUse` (le riduzioni a 30s/10s riguardano `UserPromptSubmit`, `PreModelSwitch`, `PostModelSwitch`, `MessageDisplay`; default completi in §9 e §11). Regola generale allo scadere (verbatim): «Apart from a command hook you run with `async: true`, Claude Code cancels a `command`, `http`, or `mcp_tool` hook that reaches its `timeout`, discarding the hook's output, so on most events a timed-out hook renders no decision.» ⇒ un hook di sostituzione andato in timeout **non sostituisce nulla**.

**Comando fallito (uscita diversa da zero) — provato sull'host.** `PostToolUse` scatta «after a tool call **succeeds**»; `PostToolUseFailure` «after a tool call **fails**». La doc definisce il fallimento come «the tool threw an error, or an MCP tool returned an error result», lasciando ambiguo il caso di un `Bash` che esce non-zero. La prova (2026-10-12) lo scioglie: con un hook sui due eventi, matcher `Bash`, in una cartella temporanea isolata:

- comando `exit 5` → registra **`POSTTOOLUSEFAILURE`**;
- comando `echo ok` → registra **`POSTTOOLUSE`**.

Quindi un comando `Bash` che esce **diverso da zero** viene classificato come **tool fallito**: passa da **`PostToolUseFailure`**, non da `PostToolUse`. Di conseguenza **`updatedToolOutput` non si applica a un comando fallito** (è un campo di `PostToolUse`, e `PostToolUseFailure` non lo accetta — i suoi campi `hookSpecificOutput` sono solo `additionalContext`; vedi §4 e la richiesta di feature ancora aperta `anthropics/claude-code#97278` «Let PostToolUseFailure hooks replace the error output the model sees», **terza parte**). Una build o una suite che fallisce produce quindi output **non comprimibile** con questo meccanismo: proprio il caso in cui l'output è più grande.

**Altre limitazioni dichiarate.** Dalla guida hook: «`PostToolUse` hooks can't undo actions since the tool has already executed.» E il Warning già citato (§8.2): la sostituzione cambia solo ciò che vede il modello, non ciò che è avvenuto, e la telemetria cattura l'output originale prima dell'hook.

---

## 9. Tipi di handler e campi

Cinque tipi (verbatim):

> There are five types:
> * **Command hooks** (`type: "command"`): run a shell command.
> * **HTTP hooks** (`type: "http"`): send the event's JSON input as an HTTP POST request to a URL.
> * **MCP tool hooks** (`type: "mcp_tool"`): call a tool on a configured MCP server.
> * **Prompt hooks** (`type: "prompt"`): send a prompt to a Claude model for single-turn evaluation.
> * **Agent hooks** (`type: "agent"`): spawn a subagent that can use tools like Read, Grep, and Glob to verify conditions before returning a decision. Agent hooks are experimental and may change.

**Campi comuni a ogni handler** (verbatim):

| Field | Required | Description |
| :- | :- | :- |
| `type` | yes | `"command"`, `"http"`, `"mcp_tool"`, `"prompt"`, or `"agent"` |
| `if` | no | Permission rule syntax to filter when this hook runs, such as `"Bash(git *)"` or `"Edit(*.ts)"`. … Only evaluated on tool events: `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, and `PermissionDenied`. On other events, a hook with `if` set never runs. |
| `timeout` | no | Seconds before canceling. Claude Code doesn't enforce it on a command hook you run with `async: true`. Defaults: 600 for `command`, `http`, and `mcp_tool`; 30 for `prompt`; 60 for `agent`. Claude Code lowers the `command`, `http`, and `mcp_tool` default to 30 on `UserPromptSubmit`, `PreModelSwitch`, and `PostModelSwitch`, and to 10 on `MessageDisplay`. `SessionEnd` hooks share a 1.5-second budget; if your settings set a longer per-hook `timeout`, Claude Code raises the budget to match, up to 60 seconds |
| `statusMessage` | no | Custom spinner message displayed while the hook runs |
| `once` | no | If `true`, Claude Code removes the hook after its first successful run. A run that fails, blocks with exit code 2, or times out leaves the hook in place, so it runs again on the next matching event. Only honored for hooks declared in skill frontmatter; ignored in settings files and agent frontmatter |

> The `if` field holds exactly one permission rule. There is no `&&`, `||`, or list syntax for combining rules; to apply multiple conditions, define a separate hook handler for each.

**Campi specifici di `command`** (verbatim):

| Field | Required | Description |
| :- | :- | :- |
| `command` | yes | Shell command to execute. With `args`, the executable to spawn directly. |
| `args` | no | Argument list. When present, `command` is resolved as an executable and spawned directly with `args` as the argument vector, with no shell involved |
| `async` | no | If `true`, runs in the background without blocking. |
| `asyncRewake` | no | If `true`, runs in the background and wakes Claude on exit code 2. The hook's stderr, or stdout if stderr is empty, is shown to Claude as a system reminder so it can react to a long-running background failure |
| `shell` | no | Shell to use for this hook. Accepts `"bash"` or `"powershell"`. Defaults to `"bash"`, or to `"powershell"` on Windows when Git Bash isn't installed. Ignored when `args` is set |

**Campi specifici di `http`** (verbatim): `url` (yes), `headers` (no; «Values support environment variable interpolation using `$VAR_NAME` or `${VAR_NAME}` syntax. Only variables listed in `allowedEnvVars` are resolved»), `allowedEnvVars` (no; «References to unlisted variables are replaced with empty strings. Required for any env var interpolation to work»).

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:8080/hooks/pre-tool-use",
            "timeout": 30,
            "headers": {
              "Authorization": "Bearer $MY_TOKEN"
            },
            "allowedEnvVars": ["MY_TOKEN"]
          }
        ]
      }
    ]
  }
}
```

**Campi specifici di `mcp_tool`** (verbatim): `server` (yes; per un server plugin-bundled è il nome scoped `plugin:<plugin-name>:<server-name>`), `tool` (yes), `input` (no; «String values support `${path}` substitution from the hook's JSON input, such as `"${tool_input.file_path}"`»).

**Campi specifici di `prompt` e `agent`** (verbatim): `prompt` (yes; «Use `$ARGUMENTS` as a placeholder for the hook input JSON»), `model` (no; default: «the model Claude Code uses for background functionality»).

Nota su `statusMessage`: è nella tabella dei **campi comuni**, quindi vale per ogni tipo. `once` è onorato **solo** nel frontmatter delle skill.

Deduplica fra settings: §7.3.1 ("All matching hooks run in parallel. If you define the same handler in more than one settings file, it runs once. A plugin's or skill's copy of the same handler stays separate.").

---

## 10. Placeholder, variabili d'ambiente ed exec/shell form

### 10.1 Placeholder di percorso

Verbatim (usabili in `command` e `args`):

> * `${CLAUDE_PROJECT_DIR}`: the project root where the session started. Claude Code also sets this variable in the environment of stdio MCP servers and plugin LSP servers.
> * `${CLAUDE_PLUGIN_ROOT}`: the plugin's installation directory, for scripts bundled with a plugin.
> * `${CLAUDE_PLUGIN_DATA}`: the plugin's persistent data directory, for dependencies and state that should survive plugin updates.

Regole collegate:
- "Prefer exec form for any hook that references a path placeholder. In shell form, wrap each placeholder in double quotes."
- Entrambe le forme esportano `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` come variabili d'ambiente sul processo lanciato.
- `${user_config.*}` (verbatim): "Plugin hooks additionally substitute `${user_config.*}` values, in exec form only … A shell-form plugin hook whose `command` references `${user_config.*}` fails with an error instead of running. To use an option value from a shell-form hook, read the `$CLAUDE_PLUGIN_OPTION_<KEY>` environment variable … **Before v2.1.207**, shell-form plugin hook commands also substituted `${user_config.*}`." (2.1.276 > 2.1.207: comportamento attuale).
- `${CLAUDE_PLUGIN_ROOT}` cambia a ogni aggiornamento del plugin, quindi non ci si scrive stato.
- `claude plugin validate` avverte se un placeholder resta fuori dalle doppie virgolette in un hook in shell form, salvo `shell: "powershell"`.

Caveat worktree (verbatim):

> * **`${CLAUDE_PROJECT_DIR}` stays put**: it still points at the project root where the session started …
> * **`cwd` follows Claude**: the `cwd` field in the hook's input JSON is the worktree root after Claude enters a worktree, and the new directory after Claude runs `cd`. …

### 10.2 Altre variabili d'ambiente

| Variabile / placeholder | Fonte / comportamento |
| :- | :- |
| `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` | esportati come env var sul processo spawnato: «a script can read `process.env.CLAUDE_PLUGIN_ROOT` regardless of how it was launched» |
| `${user_config.*}` | risolto nei hook di plugin **solo in exec form**; in shell form il riferimento fallisce e si legge `$CLAUDE_PLUGIN_OPTION_<KEY>` |
| `CLAUDE_PLUGIN_OPTION_<KEY>` | «exported to hook processes for every option, with `<KEY>` uppercased» (es. `$CLAUDE_PLUGIN_OPTION_API_TOKEN`) |
| `$CLAUDE_EFFORT` | «The level is also available to hook commands and the Bash tool as the `$CLAUDE_EFFORT` environment variable.» |
| `CLAUDE_ENV_FILE` | «available for SessionStart, Setup, CwdChanged, and FileChanged hooks. Other hook types don't have access to this variable.» |
| `$CLAUDE_CODE_REMOTE` | `"true"` in remote web environments, not set in the local CLI |
| `$CLAUDE_CODE_BRIDGE_SESSION_ID` | set to the Remote Control session ID (v2.1.199+) |
| `$CLAUDE_MODEL` | **non esiste**: «There is no `$CLAUDE_MODEL` environment variable. The hook can read `$ANTHROPIC_MODEL` if you set it in your shell, but that value doesn't change when you switch models with `/model`» |

Ambiente: «A hook process inherits the parent environment, apart from the `OTEL_*` exporter variables that Claude Code removes from every subprocess it spawns and, when `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` is set to `1`, the variables it strips.»

### 10.3 Exec form vs shell form (verbatim)

> A command hook runs as exec form when `args` is set, and shell form when `args` is omitted. Set `args` whenever the hook references a path placeholder, since each element is passed as one argument with no quoting. Omit `args` when you need shell features like pipes or `&&`, or when neither concern applies.
>
> **Exec form** runs when `args` is present. Claude Code resolves `command` as an executable on `PATH` and spawns it directly with `args` as the argument vector. There is no shell …
>
> **Shell form** runs when `args` is absent. The `command` string is passed to a shell: `sh -c` on macOS and Linux, Git Bash on Windows, or PowerShell when Git Bash isn't installed. Set the `shell` field to choose explicitly.

Campi del handler `command` (`command`, `args`, `async`, `asyncRewake`, `shell`): tabella in §9.

Esempi verbatim — exec form e shell form equivalente:

```json
{ "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/format.js", "--fix"] }
```

```json
{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}\"/scripts/format.js --fix" }
```

Trappole dichiarate: su Windows l'exec form richiede un eseguibile vero (`.exe`); gli shim `.cmd`/`.bat` di npm/npx/eslint non sono eseguibili e vanno lanciati via `node` o in shell form.

---

## 11. Timeout e hook asincroni

Default per **tipo** di handler e riduzioni per evento: riga del campo `timeout` in §9 («600 for `command`, `http`, and `mcp_tool`; 30 for `prompt`; 60 for `agent`»; ridotti a **30** su `UserPromptSubmit`, `PreModelSwitch`, `PostModelSwitch` e a **10** su `MessageDisplay`; `SessionEnd` condivide un budget di **1.5 secondi**, alzabile fino a 60 se i settings dichiarano un `timeout` per-hook più lungo).

Comportamento allo scadere (verbatim):

> Apart from a command hook you run with `async: true`, Claude Code cancels a `command`, `http`, or `mcp_tool` hook that reaches its `timeout`, discarding the hook's output, so on most events a timed-out hook renders no decision.
>
> On `PreModelSwitch`, a hook canceled at its timeout blocks the model switch. On `PreToolUse`, the two hook families differ:
>
> * A timed-out `command`, `http`, or `mcp_tool` hook doesn't block the tool call. The call continues through the normal permission flow, so don't count on a stalled hook to act as a gate.
> * An Agent SDK callback hook that exceeds its timeout blocks the tool call.

### 11.1 Hook asincroni (`async: true`)

Confermato verbatim (campi `command`, §9): `async` = «runs in the background without blocking»; `asyncRewake` = «runs in the background and wakes Claude on exit code 2. The hook's stderr, or stdout if stderr is empty, is shown to Claude as a system reminder so it can react to a long-running background failure».

Confermato: il `timeout` **non è imposto** su un command hook con `async: true` — «Claude Code doesn't enforce it on a command hook you run with `async: true`».

`[to verify]` — l'elenco esplicito di ciò che un hook asincrono **non** può fare (bloccare l'azione, modificare l'input, far valere i campi di decisione). La sezione «Run hooks in the background» del riferimento non è stata recuperata: la pagina è troncata dopo `InstructionsLoaded`. Manca la formulazione ufficiale esatta e manca il suo esempio JSON dedicato.

---

## 12. Input comune su stdin

### 12.1 Campi comuni

Ogni hook riceve su stdin i campi comuni (verbatim dalla tabella *Common input fields*):

| Field | Description |
| :- | :- |
| `session_id` | Current session identifier |
| `prompt_id` | UUID identifying the user prompt currently being processed. … Absent until the first user input. Requires Claude Code v2.1.196 or later |
| `transcript_path` | Path to conversation JSON (descrizione completa verbatim in §13.1) |
| `cwd` | Current working directory when the hook is invoked |
| `scratchpad_dir` | Path to the session's scratchpad directory … Absent when the session has no scratchpad or the temp directory is unavailable. Requires Claude Code v2.1.257 or later |
| `permission_mode` | Current permission mode: `"default"`, `"plan"`, `"acceptEdits"`, `"auto"`, `"dontAsk"`, or `"bypassPermissions"`. The mode labeled **Manual** arrives as `"default"`, never as `"manual"` … Not all events receive this field. |
| `effort` | Object with a `level` field holding the effort level in effect when the hook runs: `"low"`, `"medium"`, `"high"`, `"xhigh"`, or `"max"`. … The level is also available to hook commands and the Bash tool as the `$CLAUDE_EFFORT` environment variable. |
| `hook_event_name` | Name of the event that fired |

### 12.2 Campi in subagent / con `--agent`

Due campi in più (verbatim):

| Field | Description |
| :- | :- |
| `agent_id` | Unique identifier for the subagent. Present only when the hook fires inside a subagent call. |
| `agent_type` | Agent name (for example, `"Explore"` or `"security-reviewer"`). Present when the session uses `--agent` or the hook fires inside a subagent. |

### 12.3 Esempio di stdin per `PreToolUse`

Verbatim:

```json
{
  "session_id": "abc123",
  "prompt_id": "550e8400-e29b-41d4-a716-446655440000",
  "transcript_path": "/home/user/.claude/projects/.../transcript.jsonl",
  "cwd": "/home/user/my-project",
  "scratchpad_dir": "/tmp/claude-1000/-home-user-my-project/abc123/scratchpad",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test",
    "description": "Run test suite",
    "timeout": 120000,
    "run_in_background": false
  },
  "tool_use_id": "toolu_01ABC123..."
}
```

### 12.4 Input specifico di `PostToolUse`

**Nomi esatti documentati nell'input di `PostToolUse`:** `tool_input` (argomenti), **`tool_response` (il risultato)**, `tool_use_id`, `duration_ms`, più i campi comuni (`session_id`, `prompt_id`, `transcript_path`, `cwd`, `scratchpad_dir`, `permission_mode`, `effort`, `hook_event_name`, §12.1) e, nei subagent, `agent_id`/`agent_type` (§12.2). Esempio verbatim dell'input `PostToolUse`:

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input": { "file_path": "/path/to/file.txt", "content": "file content" },
  "tool_response": { "filePath": "/path/to/file.txt", "type": "create" },
  "tool_use_id": "toolu_01ABC123...",
  "duration_ms": 12
}
```

(Soglie di versione di questi campi — `scratchpad_dir`, `duration_ms`, `tool_response`, e l'evento `PostToolUseFailure` — in §16.2.)

### 12.5 Canali

«Command hooks receive JSON data via stdin and communicate results through exit codes, stdout, and stderr. HTTP hooks receive the same JSON as the POST request body and communicate results through the HTTP response body.»

---

## 13. `transcript_path` e la forma del transcript

### 13.1 Descrizione verbatim del campo

Dalla tabella **Common input fields** della doc hooks:

> | `transcript_path` | Path to conversation JSON. The transcript file is written asynchronously and may lag the in-memory conversation, so it may not yet include the current turn's most recent messages when a hook fires. Hooks that need the final assistant text of the current turn should use `last_assistant_message` on Stop and SubagentStop instead of reading the transcript |

Fonte: https://code.claude.com/docs/en/hooks#common-input-fields

I due avvertimenti centrali sono quindi: (a) è il **path al conversation JSON**; (b) il file è **scritto in modo asincrono** e può **restare indietro rispetto alla conversazione in memoria**, quindi al momento in cui un hook scatta può non contenere ancora i messaggi più recenti del turno corrente.

Lo status line riceve lo stesso campo con descrizione più breve:

> | `transcript_path` | Path to conversation transcript file |

Fonte: https://code.claude.com/docs/en/statusline#available-data

Il campo `transcript_path` **non è version-gated** — compare negli esempi senza annotazioni "Requires v...". Alcuni campi vicini invece lo sono (`prompt_id` richiede v2.1.196+, `scratchpad_dir` v2.1.257+).

### 13.2 Valori d'esempio (verbatim dalla doc)

- PreToolUse: `"transcript_path": "/home/user/.claude/projects/.../transcript.jsonl"`
- SessionStart / Setup: `"transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl"`
- InstructionsLoaded: `"transcript_path": "/Users/.../.claude/projects/.../transcript.jsonl"`
- Status line (full JSON schema): `"transcript_path": "/path/to/transcript.jsonl"`

Pattern ricorrente: `<home>/.claude/projects/.../<uuid>.jsonl` (oppure letteralmente `.../transcript.jsonl`).

Dove vive il file, verbatim dalla doc delle sessioni:

> By default, Claude Code stores transcripts as JSONL at `~/.claude/projects/<project>/<session-id>.jsonl`, where `<project>` is your working directory path with non-alphanumeric characters replaced by `-`.

Fonte: https://code.claude.com/docs/en/sessions#where-transcripts-are-stored. E la doc Agent SDK:

> Claude Code stores sessions under `~/.claude/projects/<encoded-cwd>/*.jsonl`.

Fonte: https://code.claude.com/docs/en/agent-sdk/sessions

### 13.3 La forma del file — la doc ufficiale NON documenta lo schema interno

Questo è il fatto chiave, **dichiarato esplicitamente dalla fonte di prima parte**. Verbatim da https://code.claude.com/docs/en/sessions#where-transcripts-are-stored:

> Each line is a JSON object for a message, tool use, or metadata entry. The entry format is internal to Claude Code and changes between versions, so scripts that parse these files directly can break on any release. To build on session data, use `/export` or the script interfaces instead.

Quindi:

- È **JSONL**, sì.
- **Una riga = un oggetto JSON**, che può essere "a message, tool use, or metadata entry".
- Ma lo **schema per-riga è interno e cambia fra versioni**: la doc **non lo documenta** e sconsiglia di parsarlo direttamente.

L'unica via di lettura "ufficiale" che la doc indica è l'Agent SDK — `listSessions()` e `getSessionMessages()` (TypeScript), `list_sessions()` e `get_session_messages()` (Python), descritte come "functions for enumerating sessions on disk and reading their messages" (https://code.claude.com/docs/en/agent-sdk/sessions).

### 13.4 Struttura delle righe — osservata su un transcript reale (2.1.276)

Poiché la doc non documenta lo schema, la migliore evidenza disponibile è un **artefatto di prima parte reale**: un file `.jsonl` prodotto dalla versione installata (2.1.276) su questa macchina, es. `C:\Users\tomas\.claude\projects\c--dev-daiku-workspace-daiku-dev\b0bf03c2-c83a-444a-ae7b-b032a206b1d5.jsonl`. È un artefatto vero ma **non** un contratto stabile: tutto ciò che segue va letto come `[to verify]` rispetto alla doc, perché "changes between versions".

**Tipi di record osservati (campo top-level `type`)**: `user`, `assistant`, `attachment`, `queue-operation`, `file-history-snapshot`, `file-history-delta`, `last-prompt`, `ai-title`, `atis-latch`, `cost-state`, `mode` — coerente col "message, tool use, or metadata entry" della doc.

**Campi d'inviluppo dei record-messaggio**:

- record `type: "user"` → `parentUuid, isSidechain, promptId, type, message, uuid, timestamp, permissionMode, origin, promptSource, turnOrigin, userType, entrypoint, cwd, sessionId, version, gitBranch, toolUseResult, sourceToolAssistantUUID, queueSkipAttachments, toolDenialKind`
- record `type: "assistant"` → `parentUuid, isSidechain, message, apiBlockIndex, type, uuid, timestamp, effort, perTurnEffort, userType, entrypoint, cwd, sessionId, version, gitBranch, wireToolInputs`

Quindi `parentUuid`, `uuid`, `timestamp`, `sessionId`, `cwd` stanno **a livello top del record**, non dentro `message`. `parentUuid` forma l'albero dei messaggi.

**Oggetto `message`**:

- `message.role: "user"` → chiavi `role, content`
- `message.role: "assistant"` → chiavi `content, id, model, role, stop_reason, stop_sequence, type, usage, stop_details`

**Blocchi di contenuto**, per tipo di blocco dentro `message.content[]`:

- `assistant/text` → `{ type, text }`
- `assistant/tool_use` → `{ id, input, name, type }`
- `assistant/redacted_thinking` → `{ data, type }`
- `user/text` → `{ type, text }`
- `user/tool_result` → `{ type, tool_use_id, content, is_error }`

I campi `type`, `message.role`, `message.content`, `parentUuid`, `uuid`, `timestamp`, `sessionId`, `cwd` **sono tutti presenti e confermati** sull'artefatto reale 2.1.276.

### 13.5 Blocchi `tool_use` e `tool_result`

Blocco `tool_use` — esempio verbatim, estratto da un record `assistant` reale (args di un `Read`):

```json
{"type":"tool_use","id":"call_01a0e979a3df735f9f75977455e51fce","name":"Read","input":{"file_path":"c:\\dev\\daiku-workspace\\daiku-dev\\plugins\\daiku\\skills\\init\\SKILL.md"}}
```

I campi sono esattamente `type`, `id`, `name`, `input`. La forma è quella dei content block della Messages API (la doc hooks ne mostra il gemello sul lato hook: `"tool_use_id": "toolu_01ABC123..."`).

`[to verify]` sul prefisso di `id`: la doc di prima parte mostra `toolu_01ABC123...`, l'artefatto locale mostra `call_01a0e...`. Non è confermato se il prefisso dipenda dal backend/modello.

Blocco `tool_result` — chiavi osservate: `type`, `tool_use_id`, `content` e, solo quando c'è errore, `is_error`:

```json
{"type":"tool_result","tool_use_id":"...","content":...,"is_error":true}
```

Il record corrispondente è di `type: "user"` e porta anche, a livello top, `toolUseResult` e `sourceToolAssistantUUID` — così il risultato si aggancia alla chiamata. La catena è: `assistant` con blocco `tool_use` di `id` X → record `user` con blocco `tool_result` di `tool_use_id` X.

### 13.6 Il transcript basta a ricostruire QUALI FILE sono stati letti, e con quale tool?

**Sì** per i tool che operano su un file esplicito, perché ogni blocco `tool_use` porta `name` (il tool) e `input` (gli argomenti). Chiavi di `input` verificate su record reali 2.1.276:

| Tool | chiavi di `input` osservate (verbatim) |
|---|---|
| `Read` | `file_path`, `offset`, `limit` |
| `Edit` | `file_path`, `old_string`, `new_string`, `replace_all` |
| `Write` | `file_path`, `content` |
| `Glob` | `pattern`, `path` |
| `Grep` | `pattern`, `path`, `output_mode`, `-n`, `head_limit`, `-C` |
| `Bash` | `command`, `description` (la doc cita anche `timeout`, `run_in_background`) |
| `Agent` | `description`, `prompt`, `subagent_type`, `model`, `run_in_background` |

Quindi per il tool `Read` l'input contiene **`file_path`** (confermato, ed è un path assoluto — `"c:\\dev\\..."`). Anche `Edit` e `Write` portano `file_path`. La doc del tools-reference conferma il comportamento che sottende a questi nomi: "The Read tool takes a file path"; l'Edit "takes an `old_string` and a `new_string`"; Grep scopa con `glob`/`type`/`multiline`/`offset` (https://code.claude.com/docs/en/tools-reference).

**Limite da segnalare**: `Glob` e `Grep` **non** espongono un `file_path` — portano `pattern` (e per Grep `path`). I file concreti che hanno matchato compaiono solo *dentro* `tool_result.content` (testo), non come campo strutturato. Quindi "quali file ho letto con `Read`" si ricostruisce con certezza dai `tool_use.input.file_path`; "quali file ha toccato un `Grep`/`Glob`" richiede di interpretare il testo del risultato.

`[to verify]` — se `tool_result.content` sia sempre una stringa o a volte un array di content block non è confermato dalla fonte di prima parte né verificato qui.

### 13.7 Cosa resta non confermato dalla fonte di prima parte

- **Lo schema per-riga non è un contratto documentato**: la doc dice che è interno e cambia fra versioni. Tutti gli elenchi di campi del §13.4–§13.6 vengono da artefatti reali 2.1.276, non da doc ufficiale → `[to verify]` la loro stabilità fra versioni.
- **Prefisso di `id`** dei blocchi `tool_use` (`toolu_` vs `call_`) → `[to verify]`.
- **Suddivisione di un messaggio assistant su più righe** → `[to verify]`.
- **`tool_result.content`: stringa o array** → `[to verify]`.
- **Enumerazione completa di `message.role`** (osservati `user`/`assistant`) → `[to verify]`.

---

## 14. Forme di configurazione: plugin, settings, frontmatter

### 14.1 Forma plugin — `hooks/hooks.json`

Verbatim:

> Define plugin hooks in `hooks/hooks.json` with an optional top-level `description` field. When a plugin is enabled, its hooks merge with your user and project hooks.

Esempio verbatim (wrapper `hooks`, `description` top-level, exec form con `args: []`):

```json
{
  "description": "Automatic code formatting",
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/format.sh",
            "args": [],
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

Da plugins/components: il file va in `hooks/hooks.json` alla radice del plugin, "under a top-level `\"hooks\"` key, in the same shape as the `hooks` object in `settings.json`. That lets you copy an existing settings hook in unchanged." Gli hook del plugin si registrano quando la sessione carica il plugin, senza attendere l'invocazione di una sua skill/comando.

Chiave `hooks` del manifest (plugins/manifest-reference): accetta un path a file `.json`, un oggetto inline, o un array che mescola i due. "A hooks file wraps the event map in a top-level `\"hooks\"` key … A file that contains only the event map, without that wrapper, fails to load. An inline object is the event map itself, with no wrapper." Claude Code fonde quanto dichiarato con `hooks/hooks.json` quando il file esiste.

### 14.2 Forma `settings.json`

In un file di impostazioni la chiave top-level è `hooks`, e dentro stanno gli eventi; tre livelli di annidamento: (1) l'[hook event], es. `PreToolUse` o `Stop`; (2) un [matcher group]; (3) uno o più [hook handler]. Esempio verbatim in §3.2.

### 14.3 Frontmatter di skill e subagent

Esempio di frontmatter di skill (verbatim):

```yaml
---
name: secure-operations
description: Perform operations with security checks
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/security-check.sh"
---
```

Riga frontmatter `hooks`, verbatim da `https://code.claude.com/docs/en/skills`:

> | `hooks` | No | Hooks that Claude Code registers when the skill is invoked and keeps running for the rest of the session. |

Note su skill/subagent (verbatim):

> **Subagent hooks**: Claude Code runs them only while that subagent is running and removes them when it finishes. Claude Code converts a `Stop` hook here to `SubagentStop`, the event it fires when a subagent completes.

> **Skill hooks**: Claude Code registers them when you or Claude invoke the skill and keeps running them for the rest of the session, on turns after the skill's own turn as well. To have Claude Code remove a hook after its first successful run instead, set `once: true` on it.

### 14.4 Cosa si fonde e cosa resta separato

- Plugin abilitato → i suoi hook si fondono con user e project hooks.
- `hooks/hooks.json` e la chiave `hooks` del manifest caricano entrambi; il manifest si fonde col file.
- Frontmatter di **agent di plugin**: `hooks`, `permissionMode`, `mcpServers`, `initialPrompt` sono **ignorati** — "An agent file can't add hooks or MCP servers on its own". Il campo `once: true` è onorato **solo** per hook dichiarati nel frontmatter di una skill, ignorato nei settings file e nel frontmatter di un agent.

---

## 15. Sicurezza, diagnosi e validazione

### 15.1 Controlli amministrativi

Avvertenza sui codici di uscita: **§7.2.2** ("If your hook is meant to enforce a policy, use `exit 2`").

Controlli amministrativi (verbatim):

- `allowManagedHooksOnly`: «Your user, project, local, and plugin hooks are blocked. Hooks from plugins force-enabled in managed settings `enabledPlugins` are exempt».
- `disableAllHooks`: rispetta la gerarchia managed; «the `disableAllHooks` setting can't disable managed hooks from outside managed settings» (merge fra livelli in §3.1).
- `allowedHttpHookUrls`: «when defined at any settings level, Claude Code runs an HTTP hook handler only if its URL matches the merged allowlist».
- `httpHookAllowedEnvVars`: «when defined, Claude Code interpolates only the environment variables on that list into hook headers».
- Workspace trust: «Frontmatter hooks in a project skill follow the workspace trust rule; project subagent frontmatter hooks run only after you accept the workspace trust dialog. A `-p` session doesn't count.»

Hooks da settings, managed policy e plugin **girano anche dentro i subagent**, con `agent_id` e `agent_type` fra i campi comuni di input (§12.2).

### 15.2 Limite d'ambiente

«On macOS and Linux, command hooks run in their own session without a controlling terminal. The hook process and any child processes can't open `/dev/tty`…». Per parlare all'utente: `systemMessage` in output JSON o `terminalSequence`.

### 15.3 Diagnosi

- `/hooks` — «Type `/hooks` in Claude Code to open a read-only browser for your configured hooks. The list labels each hook with where it comes from, such as user settings, project settings, local settings, a plugin, or the current session.» `All events` in fondo elenca anche gli eventi senza hook configurati.
- `Ctrl+O` apre la vista transcript; i hook riusciti non mostrano nulla di default.
- Debug log: `claude --debug-file /tmp/claude.log` (poi `tail -f`), oppure `claude --debug`, o `/debug` a metà sessione. Il messaggio chiave per i campi ignorati: `Hook JSON output had unrecognized keys`.
- Errori tipici: «Hook not firing» (matcher case-sensitive), «Hook error in output» (exit code inatteso, `command not found` → usare `${CLAUDE_PROJECT_DIR}` o `"args": []`), «Hook JSON has no effect» (output prima del JSON, o campo al livello sbagliato — es. `permissionDecision` va dentro `hookSpecificOutput`).
- Disattivare: `"disableAllHooks": true` nei settings (rispetta la gerarchia managed); una singola voce si rimuove solo cancellandola dal file.

### 15.4 Validazione del manifest

`claude plugin validate` è il controllo autorevole del manifest. Nota di versione: i controlli sugli entry MCP del manifest "require Claude Code v2.1.281 or later"; il controllo dei path di `outputStyles`, `lspServers`, `monitors`, `themes` "requires Claude Code v2.1.283 or later" — **più recenti della versione in uso (2.1.276)**; su 2.1.276 quegli stessi campi possono produrre un warning `Unknown field` e far fallire una run `--strict`. `[to verify: comportamento effettivo di questi due controlli sulla 2.1.276 installata, non testato qui]`.

---

## 16. Soglie di versione e changelog

### 16.1 Prima raccolta (2026-10-03), base 2.1.276

| Fatto documentato | Soglia | Stato su 2.1.276 |
|---|---|---|
| `exit 2` + JSON non valido **blocca** comunque | "Before v2.1.214" era non-bloccante | attuale |
| stdout testo semplice non aggiunto al contesto (con parse fallito) | "Before v2.1.248" era aggiunto | attuale |
| `${user_config.*}` in shell form **fallisce** invece di sostituire | "Before v2.1.207" sostituiva | attuale |
| Controlli MCP in `claude plugin validate` | "require v2.1.281 or later" | **più recente** |
| Campi directory-listing senza warning in `validate` | "v2.1.281 or later" | **più recente** |
| Controllo path `outputStyles`/`lspServers`/`monitors`/`themes` | "v2.1.283 or later" | **più recente** |

### 16.2 Estensione (2026-10-12), base 2.1.296

| Campo/evento | Versione introdotta | Fonte (verbatim) | Stato su 2.1.296 |
|---|---|---|---|
| `updatedToolOutput` | **2.1.121** (per *tutti* i tool; prima era solo-MCP) | Changelog ufficiale `## 2.1.121`: «PostToolUse hooks can now replace tool output for all tools via `hookSpecificOutput.updatedToolOutput` (previously MCP-only)» | Presente |
| `updatedMCPToolOutput` | `[non documentato]` (esisteva già prima di 2.1.121; il changelog lo cita solo come «previously MCP-only») | Changelog `## 2.1.121`; doc attuale senza soglia | Presente |
| `tool_response` (input) | `[non documentato]` — la doc lo nomina senza soglia di versione | Doc `### PostToolUse input`: «The input includes both `tool_input`, the arguments sent to the tool, and `tool_response`, the result it returned.» | Presente |
| `scratchpad_dir` (input comune) | **v2.1.257 o successiva** | Doc `### Common input fields`: «… Requires Claude Code v2.1.257 or later» | Presente |
| `classifierContext` | **v2.1.236 o successiva** | Doc `#### PostToolUse decision control`: «Requires Claude Code v2.1.236 or later» | Presente |
| `duration_ms` (input) | **2.1.119** | Changelog `## 2.1.119`: «Hooks: `PostToolUse` and `PostToolUseFailure` hook inputs now include `duration_ms` (tool execution time, excluding permission prompts and PreToolUse hooks)» | Presente |
| evento `PostToolUseFailure` | `[non documentato]` nel changelog della CLI; prima menzione ufficiale nello **SDK Python 0.1.26** (cli 2.1.27), prodotto distinto | SDK changelog `## 0.1.26`: «PostToolUseFailure hook event … Updated bundled Claude CLI to version 2.1.27» | Presente |

Punti non chiusi: `updatedMCPToolOutput` (introduzione non datata), `tool_response` (versione non dichiarata) e l'evento `PostToolUseFailure` (nessuna soglia nel changelog della CLI) → `[non documentato]`.

---

## 17. Nota di chiusura della prima raccolta (2026-10-03)

La versione **in uso in questa raccolta** (2.1.276) era **12 release indietro** rispetto all'ultima pubblicata allora (2.1.288). Emerso dalle fonti, in sintesi:

- Nessuna prova che tra 2.1.277 e 2.1.288 sia stato introdotto un **nuovo evento hook**: le voci recuperate sono correzioni.
- **Più recenti della 2.1.276**: i controlli MCP e sui path di `claude plugin validate` (v2.1.281 / v2.1.283).
- Da confermare **sulla 2.1.276** (marcature `[to verify]` sparse nella nota, raccolte da `study` nel blocco finale): esistenza/campi di `UserPromptExpansion`, consegna di `additionalContext` su `PreToolUse`, campi di `additionalContext` su `PostToolBatch`/`PostModelSwitch`, cap a 10.000 caratteri, stabilità dello schema del transcript.

---

## 18. Avvio di slash-command o skill

### 18.1 Risposta esplicita: NO

Non esiste alcun evento dedicato all'avvio di una skill o di uno slash-command. Gli eventi documentati sono la «user-typed command expansion» (`UserPromptExpansion`, il più vicino a un avvio di slash-command), l'invocazione di una skill **da parte del modello** (osservabile solo come tool call `Skill`), e l'avvio di un **subagent** (`SubagentStart`). Nessuno dei tre si chiama "start di skill/slash-command".

### 18.2 Nessun evento si chiama "skill start" o "command start"

L'elenco completo dei **33** eventi è in §2.1. Nessun nome contiene "Skill" o "Command": non esiste `SkillStart`, `SkillInvoked`, `SlashCommandStart`, `CommandStart` o simili. L'unico evento con prefisso `Start` è `SubagentStart`, ed è ristretto ai subagent.

### 18.3 `UserPromptExpansion` — il più vicino a un "avvio di slash-command"

Riga "When it fires" e campi `hookSpecificOutput` in §4; riga di `matcher` in §5 (`command name | your skill or command names`), che filtra cioè sul **nome del comando/skill** (senza `/` iniziale).

**Comportamento**: è bloccante (exit code 2 = "Blocks the expansion"), supporta `decision: "block"` + `reason`, e il suo plain-text stdout viene aggiunto come contesto che Claude vede; il suo `additionalContext` viene iniettato «alongside the submitted prompt» (§6).

**Campi ricevuti** — oltre ai campi comuni (`session_id`, `transcript_path`, `cwd`, `hook_event_name`, `permission_mode`, §12.1), riceve i campi specifici (da una copia verbatim della doc, `https://github.com/xiaolai/anthropic-docs` → `skills/claude-code/SKILL-hooks.md` — **fonte di terza parte**):

- `expansion_type` — `"slash_command"` per skill/comandi custom, oppure `"mcp_prompt"` per i prompt di un server MCP;
- `command_name` — il nome della skill/comando espanso (es. `"example-skill"`);
- `command_args` — gli argomenti digitati dopo il nome (es. `"arg1 arg2"`);
- `command_source` — dove è definito il comando: `"plugin"`, `"user"`, `"project"` o `"mcp"`;
- `prompt` — la stringa originale digitata dall'utente (es. `"/example-skill arg1 arg2"`).

`[to verify: i campi specifici di `UserPromptExpansion` provengono da un mirror di terza parte, non da code.claude.com]`.

### 18.4 Le tre strade, distinte esplicitamente

| Causa dell'avvio | Evento osservabile | Match su |
|---|---|---|
| **Slash-command / skill digitato dall'utente** | `UserPromptExpansion` | nome del comando/skill (`command_name`) |
| **Skill invocata dal modello** | `PreToolUse` / `PostToolUse` con matcher `Skill` | nome del tool (`Skill`) |
| **Subagent avviato** | `SubagentStart` | tipo di agente (`agent_type`) |

**Skill invocata dal modello → tool `Skill`.** Dalla doc `https://code.claude.com/docs/en/skills`: il modello invoca le skill per default tramite il **tool `Skill`**, deniabile con le permission rule `Skill`, `Skill(name)`, `Skill(name *)`; un grader di eval usa `tool_used: Skill`. L'unico modo di osservarne l'avvio sono quindi i hook sui tool, con matcher sul nome del tool `Skill`. La doc delle skill **non mostra un esempio esplicito** di `PreToolUse`/`PostToolUse` con matcher `"Skill"`, ma i matcher di `PreToolUse`/`PostToolUse` filtrano sul `tool_name`, e il tool si chiama `Skill`; il valore di matcher esatto da usare è `[to verify]` (manca un esempio verbatim nella doc). Una skill con `disable-model-invocation: true` non è invocabile dal modello (solo `/name` manuale), e con `user-invocable: false` è invocabile solo dal modello.

**Subagent → `SubagentStart`.** Da `https://code.claude.com/docs/en/sub-agents`, sezione "Project-level hooks for subagent events", verbatim:

> | `SubagentStart` | Agent type name | When a subagent begins execution |

Il matcher è il `name` del frontmatter dell'agente (o l'identificatore plugin-scoped `my-plugin:db-agent`); il campo che l'hook riceve è `agent_type`. I subagent sono avviati tramite il **tool `Agent`** (in v2.1.63 il Task tool è stato rinominato Agent). Non esiste alcun evento `TaskStarted`. `[to verify: la rinominazione Task→Agent in v2.1.63]`.

### 18.5 I "skill hooks" nel frontmatter NON sono un avvio

Le formule verbatim di **Subagent hooks** e **Skill hooks** sono in §14.3.

Chiarimento: qui il *momento* dell'invocazione della skill fa da **innesco per la registrazione** di hook dichiarati nella skill stessa. **Non è un hook che segnala l'avvio**: è un hook che la skill porta con sé e che poi continua a girare su eventi *successivi*. Per i subagent vale l'opposto: i loro frontmatter hook vivono solo durante l'esecuzione del subagent e uno `Stop` lì dentro diventa `SubagentStop`.

### 18.6 Conclusione

- **Nessun evento dedicato all'avvio di skill/slash-command esiste.** La lista ufficiale dei 33 eventi non ne contiene uno con nome "skill start"/"command start"; l'unico `*Start` è `SubagentStart`.
- Le alternative sono tre, e vanno scelte in base a *chi* innesca l'avvio:
  - **comando/skill digitato** → `UserPromptExpansion` (matcher = nome del comando/skill; campi `expansion_type`, `command_name`, `command_args`, `command_source`, `prompt`);
  - **skill invocata dal modello** → `PreToolUse`/`PostToolUse` con matcher sul tool `Skill`;
  - **subagent** → `SubagentStart` (matcher = `agent_type`).
- I **skill hooks** in frontmatter non colmano il vuoto: si *registrano* all'invocazione ma non emettono un evento "la skill è partita".

**Nota di versione.** `UserPromptExpansion` è documentato nella doc attuale; **non è confermato che l'evento esistesse già nella versione in uso nella prima raccolta (2.1.276)** — l'ultima pubblicata allora era 2.1.288 `[to verify: se `UserPromptExpansion` era presente ed equivalente in 2.1.276]`. Il resto (assenza di un evento skill/command-start, `SubagentStart`, `PreToolUse:Skill`, skill hooks in frontmatter) è stabile nella doc corrente.

---

## 19. Consegna di `additionalContext` a un subagent — esperimento sull'host (2026-10-12, base 2.1.296)

> Sperimentazione (2026-10-12), base **2.1.296**. Non è lettura di documentazione: ogni risposta è **provata eseguendo l'host**, col comando e la data, o dichiarata **`[non provato]`**. Chiude la domanda: per parlare a un subagent, la leva di contesto va in un hook `SubagentStart` **definito in un plugin** (sede **B**), o in una sede **provata** come `PreToolUse` (sede **A**)?

### 19.1 Montaggio — usa-e-getta, fuori dalla configurazione dell'owner

Plugin minimo (`plugin.json` + `hooks/hooks.json`) e progetto minimo in una cartella temporanea, caricati per-sessione con `--plugin-dir`; **nessuna scrittura** in `~/.claude/settings.json`, in `.claude/settings.json` del repository, nella cache dei plugin installati o nei progetti ospiti. Gli hook sono in **exec form** (`command: "node"`, `args: ["…/hook.js"]`), così da girare identici su Windows:

```json
{
  "hooks": {
    "SubagentStart": [
      { "hooks": [ { "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/hook.js"], "timeout": 15 } ] }
    ],
    "PreToolUse": [
      { "matcher": "", "hooks": [ { "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/hook.js"], "timeout": 15 } ] }
    ],
    "PostToolUse": [
      { "matcher": "", "hooks": [ { "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/hook.js"], "timeout": 15 } ] }
    ]
  }
}
```

`hook.js` appende a un log ogni input ricevuto e restituisce su stdout, per evento, un `additionalContext` distinto: `SubagentStart` → `DAIKU-SAHEAD-CANARY-ZEBRA7` + 11.000 `x` + `DAIKU-SATAIL-CANARY-MOOSE9`; `PreToolUse` → `DAIKU-PRETOOL-CANARY-OTTER3`; `PostToolUse` → `DAIKU-POSTTOOL-CANARY-LYNX5`. Il subagent (`probe`, via `--agents`) riporta ogni stringa `DAIKU-` del suo contesto **prima** di ogni tool, poi esegue una volta `bash: echo probe-done`, poi riporta di nuovo, e infine scrive il resoconto su file. Comando:

```bash
claude.exe -p "<prompt del padre che avvia il subagent probe>" \
  --plugin-dir <plugin> --agents <agents.json> \
  --permission-mode bypassPermissions --setting-sources project \
  --output-format stream-json --verbose --forward-subagent-text
```

`--setting-sources project` tiene fuori i settings utente, quindi sul corpo dell'esperimento non gira nessun hook del plugin installato dall'owner. Host: binario nativo dell'estensione in uso, **2.1.296** (`anthropic.claude-code-2.1.296-win32-x64`; `claude.exe --version` → `2.1.296`). Cartella temporanea rimossa a fine esperimento.

### 19.2 Q1 — un hook `SubagentStart` di un plugin consegna il testo al subagent? **`[provato]` Sì.**

L'issue `anthropics/claude-code#16538` (plugin `SessionStart` che non consegna `additionalContext`) **non si estende a `SubagentStart`** su questa versione. Prove (2026-10-12):

- il log dell'hook registra che `SubagentStart` è scattato, dal plugin: `SubagentStart | agent_id=afd86ebfb7affacd8 | agent_type=probe`;
- il subagent, **nel suo primissimo messaggio** — prima di qualunque tool — riporta `DAIKU-SAHEAD-CANARY-ZEBRA7` (la testa del testo iniettato). Nel **suo** transcript il testo compare come attachment `hook_additional_context` (hookName `SubagentStart`), agganciato al turno-task.

`[non provato]` che `SessionStart` da plugin resti rotto su 2.1.296: non testato qui, la domanda riguardava `SubagentStart`.

### 19.3 Q2 — una sede provata dentro un subagent, e un hook di plugin gira davvero lì? **`[provato]` Sì (entrambe).**

La premessa di Q2 («se Q1 è no») non ricorre, ma le due sotto-domande hanno risposta:

- un hook dichiarato in `hooks/hooks.json` di un plugin **gira anche dentro un subagent**, con `agent_id` e `agent_type` presenti. Log (2026-10-12): `PreToolUse | agent_id=a23f0987a87165394 | agent_type=probe | tool=Bash`, poi `PostToolUse` idem, poi `PreToolUse`/`PostToolUse | tool=Write` — tutti con lo stesso `agent_id`;
- `PreToolUse.additionalContext` **consegna al subagent** il testo accanto al risultato del tool. Nel transcript del subagent l'attachment `hook_additional_context` (hookName `PreToolUse:Bash`, contenuto `DAIKU-PRETOOL-CANARY-OTTER3`) sta **prima** del `tool_result`; il subagent lo riporta nella fase 3 della sua relazione, insieme a `DAIKU-POSTTOOL-CANARY-LYNX5`.

### 19.4 Q3 — il testo arriva prima del primo prompt del subagent?

Il testo è nel contesto del subagent **già al suo primo turno di modello**, prima che produca qualsiasi risposta `[provato]`: il suo primo messaggio lo contiene. Nel transcript, però, l'attachment del contesto è **annidato sul messaggio-task** (`user: "Begin"` → `hook_success SubagentStart` → `hook_additional_context SubagentStart`), cioè **dopo** il task, non prima. La formula della doc «at the start of the conversation, before the first prompt» va quindi letta come **«prima che il subagent risponda»**, non «prima che il task gli sia consegnato»; oltre questo, se il testo sia inserito immediatamente prima o insieme al task nel prompt di modello **non è osservabile** dall'esterno `[non provato]`.

### 19.5 Q4 — la cap di 10.000 caratteri vale anche su `SubagentStart`? **`[provato]` Sì.**

Con un `additionalContext` di ~11.000 caratteri, il subagent ha visto **solo** la testa (`DAIKU-SAHEAD-…ZEBRA7`) seguita da una lunga coda di `x`, e **nessuna** `MOOSE9` (il tail): il testo consegnato era una **preview**. Il transcript del subagent lo conferma alla lettera — il valore consegnato è stato sostituito con (verbatim):

```
<persisted-output>
Output too large (10.8KB). Full output saved to: C:\Users\…\tool-results\hook-302de950-50fb-4c61-a31c-ef62d2e53c90-1-additionalContext.txt

Preview (first 2KB):
DAIKU-SAHEAD-CANARY-ZEBRA7 xxxxxx…
```

Il file `…-additionalContext.txt` (11.054 byte) contiene il testo **intero**, tail incluso. Coerente con la §6.5: la stringa oltre i 10.000 caratteri viene scritta in un file della session directory e sostituita con il path e una preview dei primi ~2.000 caratteri. Conseguenza operativa: un contesto per il subagent va tenuto **entro i 10.000 caratteri**, o il subagent ne vede solo la preview.

### 19.6 Q5 — i campi del payload di `SubagentStart` da plugin

Un hook `SubagentStart` definito in un plugin riceve (chiavi osservate, verbatim, 2026-10-12):

```
session_id, transcript_path, cwd, prompt_id, agent_id, agent_type, hook_event_name
```

Il `session_id` è quello della sessione **padre** `[provato]`: coincide con il `session_id` della sessione principale (`3537b103-1bc5-45cc-b9ea-182dbbe42146` in entrambe le viste). `agent_id` e `agent_type` sono presenti (il tipo è il nome dell'agente, `probe`).

### 19.7 Conclusione — la sede B è utilizzabile

Un hook `SubagentStart` **definito in un plugin** consegna davvero `additionalContext` al subagent su **2.1.296** `[provato]`: la sede **B** funziona, con la stessa cap degli altri eventi (10.000 caratteri per stringa, oltre i quali scatta la persistenza su file). In alternativa, la sede **A** `PreToolUse.additionalContext` consegna anch'essa dentro un subagent — ma **dopo** la prima chiamata di tool, non prima della prima richiesta.
