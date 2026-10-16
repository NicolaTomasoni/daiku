# Claude Code hooks — appunti operativi di sviluppo

> **Versione in uso: 2.1.300** — estensione VSCode `anthropic.claude-code-2.1.300-win32-x64`, il cui binario nativo (`…/resources/native-binary/claude.exe`) è ciò che l'host esegue, e la stessa che risponde su `PATH` (`C:/nvm4w/nodejs/claude` → `2.1.300 (Claude Code)`): misurata sull'host il **2026-10-15**. Ultima pubblicata: **v2.1.300** (release GitHub `anthropics/claude-code`, 2026-10-14) — la versione in uso **coincide con l'ultima**. Le versioni intermedie **2.1.297** e **2.1.298** **non esistono**: il changelog salta da 2.1.296 a 2.1.299.
> **Il corpo si compone di tre raccolte, una sperimentazione sull'host e un aggiornamento**, e ognuna data i propri fatti. La **prima raccolta (2026-10-03)** poggia sulla versione allora in uso, la **2.1.276** (contro la 2.1.288 allora ultima); l'**estensione (2026-10-12)** poggia sulla **2.1.296** e risponde a cinque domande puntuali sulla sostituzione dell'output di un tool; la **sperimentazione (2026-10-12)** poggia anch'essa sulla **2.1.296** e risponde a cinque domande sulla consegna di `additionalContext` a un subagent, con l'esito **provato eseguendo l'host** e non leggendo la documentazione; l'**aggiornamento (2026-10-15)** poggia sulla **2.1.300** e risponde a cinque nuove domande (il changelog hook fra 2.1.297 e 2.1.300, lo stato dell'issue #16538, la consegna di `additionalContext` da un hook di **plugin** alla conversazione, le altre superfici per la prosa **generata**, cosa un plugin può scrivere). Dove una sezione dichiara la "versione in uso", si riferisce alla versione della raccolta da cui proviene il fatto; dove il fatto appartiene a una versione diversa da quella della raccolta, la soglia è indicata.
> Modello mentale dello studio: **vince la versione in uso (2.1.300)**. La documentazione canonica (`https://code.claude.com/docs/en/hooks`) riflette **l'ultima versione**; ciò che appartiene a versioni più recenti è segnalato. Ciò che non è confermato è marcato `[to verify]` (prima raccolta) o `[non documentato]` (estensione), con cosa manca; nella sperimentazione `[provato]`/`[non provato]`, col comando e la data.
> Nota sul cutoff del modello: le firme, i nomi di campo e i JSON qui sotto sono copiati **verbatim** dalle pagine recuperate (o da artefatti di prima parte reali), mai dalla memoria del modello.
> Radice tecnica: `C:/dev/daiku` (`repo_root` in `.daiku/project.json`) → `{paths.studies}` = `.daiku/studies`.
> `documents.stack` = `STACK.md` e `documents.architecture` = `ARCHITECTURE.md` sono dichiarati in `.daiku/project.json` e letti. Ancoraggio di progetto rilevante per questa nota: il prodotto è **un pacchetto di Claude Code** (JavaScript `.mjs` su Node.js 18+, distribuito via marketplace, `STACK.md` §1, §4), l'host è **uno solo — Claude Code** e **il pacchetto non scrive nel progetto ospite** (`ARCHITECTURE.md` §2, §3); gli hook del pacchetto sono **fail-open** (`ARCHITECTURE.md` §3).

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
20. **Aggiornamento (2026-10-15, base 2.1.300) — Q1** — il changelog hook fra 2.1.296 e 2.1.300: le versioni esistenti, le voci verbatim, e cosa il changelog *non* contiene.
21. **Aggiornamento (2026-10-15) — Q4** — superfici per la prosa **generata** nella conversazione principale: `outputStyle`, `MessageDisplay`/`displayContent`, `.claude/rules/*.md`, il file di istruzioni.
22. **Aggiornamento (2026-10-15) — Q5** — cosa un plugin può scrivere e cosa no; l'ordine di merge dei settings.
23. **Aggiornamento (2026-10-15) — Q2** — lo stato delle issue sul sintomo «hook di plugin non consegnano il contesto» (da #16538 alle issue recenti).
24. **Aggiornamento (2026-10-15) — Q3** — la consegna di `additionalContext` da un hook di **plugin** alla conversazione: cosa dice la doc, cosa dicono le issue, cosa resta `[non provato]`.

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

Fonti primarie recuperate (2026-10-15) — aggiornamento, base **2.1.300**:
- Changelog ufficiale: `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md` (via `gh api repos/anthropics/claude-code/contents/CHANGELOG.md`) e le release GitHub (`gh release list -R anthropics/claude-code -L 12`, `gh release view v2.1.300/v2.1.299/v2.1.296`); tag (`gh api repos/anthropics/claude-code/tags`). **Le versioni 2.1.297 e 2.1.298 non esistono**: né release né tag né sezione di changelog.
- Host: `claude --version` → **`2.1.300 (Claude Code)`** (sia l'estensione `anthropic.claude-code-2.1.300-win32-x64` sia il `claude` sul `PATH`, `C:/nvm4w/nodejs/claude`), misurato il 2026-10-15.
- Documentazione hook: `https://code.claude.com/docs/en/hooks` (sezioni *Add context for Claude*, *SessionStart decision control*, *UserPromptSubmit decision control*, *Exit code 0*, *Hook locations*, *Merge behavior*). **Nota: la doc ha riorganizzato i path** — le impostazioni stanno ora in `https://code.claude.com/docs/en/settings-reference`, e parte dei plugin sotto `https://code.claude.com/docs/en/plugins/…` (`/plugins/overview`, `/plugins/components`, `/plugins/manifest-reference`, `/plugins/install`, `/plugins/loading`, `/plugins/security`).
- Altre pagine: `https://code.claude.com/docs/en/output-styles`, `https://code.claude.com/docs/en/memory`, `https://code.claude.com/docs/en/sub-agents`.
- Terza parte (issue): `anthropics/claude-code` #16538, #40614, #73401, #88086, #75972, #12151, #16288, #83643, #92675, #94635, #95673, #96087, #96496, #100869, #101640, #100234, #96193 (stati al 2026-10-15, in §23).

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

**Bug noto #16538 (plugin SessionStart).** Confermato dalla fonte: issue **anthropics/claude-code#16538**, titolo *"Plugin SessionStart hooks don't surface hookSpecificOutput.additionalContext to Claude"*, aperta da christinetyip il 2026-01-07, **chiusa come "not planned"** con etichetta `stale`, **senza commenti dei maintainer**. Sintomo: un hook `SessionStart` definito in `hooks.json` di un plugin esegue e restituisce JSON valido con `hookSpecificOutput.additionalContext`, ma Claude riceve solo `"SessionStart:Callback hook success: Success"`; lo stesso hook in `~/.claude/settings.json` funziona. L'issue **non indica versioni** e non risulta risolta. (Stato aggiornato al **2026-10-15** in §23: `CLOSED`/`NOT_PLANNED`, auto-chiusa per inattività il 2026-05-11 e **lockata** il 2026-06-30; i commenti raccolti nominano 2.1.39–2.1.86, mai una riparazione. Il difetto è stato re-filato in #73401 e #88086, anch'essi chiusi dal bot e mai risolti.)

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

**Aggiornamento 2026-10-15 (§24).** La domanda resta aperta per la **conversazione principale**, non per il subagent: che un hook `SessionStart` o `UserPromptSubmit` **definito in un plugin** parli al modello della conversazione è `[non provato]` su **2.1.300** — la doc non distingue i due tipi di hook quanto alla consegna, le issue (§23) lo dicono rotto, e qui non è stato eseguito (la prova qui sopra riguarda solo `SubagentStart`, su 2.1.296).

---

## 20. Aggiornamento (2026-10-15), base **2.1.300** — Q1: il changelog hook fra 2.1.296 e 2.1.300

> Aggiornamento (2026-10-15), base **2.1.300**. Fonte: il changelog ufficiale (`https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`, via `gh api repos/anthropics/claude-code/contents/CHANGELOG.md`) e le release GitHub (`gh release list -R anthropics/claude-code -L 12`, `gh release view`). Le voci qui sotto sono **verbatim**.

### 20.1 Le versioni esistenti

`2.1.296` (2026-10-09) → **niente 2.1.297 né 2.1.298** → `2.1.299` (2026-10-14) → `2.1.300` (2026-10-14, l'ultima). Il changelog non ha sezioni `## 2.1.297` / `## 2.1.298`: sono numeri **mai pubblicati**. Quindi «fra la 2.1.297 e la 2.1.300» coincide, di fatto, con **2.1.296 → 2.1.299 → 2.1.300**.

### 20.2 Voci di changelog sugli hook, verbatim

**`## 2.1.300`:**

> * Fixed SessionEnd hooks sometimes not running when you exit while a background command is still running
> * Fixed plugin `WorktreeCreate` and `WorktreeRemove` hooks not running when Claude Code starts with `--worktree` (not yet with `--tmux`)
> * Fixed agent hooks ignoring their `model`: aliases like `haiku` now resolve, a subagent's model no longer overrides it, and an unavailable model falls back to the caller's instead of allowing the action
> * Changed hooks: `updatedInput` from PreToolUse and PermissionRequest hooks is now validated like Claude's own input: unknown keys are dropped, and input the tool rejects denies the call
> * Added the `prompt.change` mod hook, raised when the prompt box's text changes without a typed edit: a recalled history entry, a clear, an undo, or a plugin's fill
> * Changed `PermissionRequest` hooks in Cowork cloud sessions: a `setMode` update in a hook's allow is now ignored; the rest of the approval still applies

**`## 2.1.299`:**

> * Changed `UserPromptSubmit` hooks to run before a skill or custom slash command expands, so a hook that blocks the prompt now also stops its embedded shell commands
> * Changed a skill's own front-matter `UserPromptSubmit` hook to first run on the prompt after the one that invokes the skill
> * Fixed Edit and Retry in Cowork and claude.ai cloud sessions failing on a message stopped while its `UserPromptSubmit` or mod `prompt.submit` hooks were still running (regression in 2.1.296)
> * Windows: Fixed PreToolUse and PermissionRequest hooks that set no shell failing open when Git for Windows isn't installed; a guard that fails now blocks the call
> * Changed actions a plugin hook can block to be refused, not let through, when the hook cannot be handed them or cannot hand back its answer; a tool that already ran has its result withheld
> * Changed plugin hooks and workflow scripts to refuse values they hand back that nest deeper than 28,000 levels, with an error naming the limit (workflow scripts allowed 100,000)
> * Fixed plugin hooks being skipped when they pass a very deeply nested tool input or message on with next()
> * Fixed the `plugin_loaded` telemetry event reporting `has_hooks` as false for plugins whose hooks are a hooks module, built-in plugins included
> * Fixed a Remote Control prompt that had passed its hooks being dropped from prompt history when Stop interrupted the next queued prompt's hook
> * Improved enforcement of managed permission rules, managed hooks and organization MCP tool names against user-installed mods
> * Fixed plan mode running a write (an MCP tool's, a file's, a shell command's) that a `PreToolUse` hook or a mod's `tool.check` hook allowed

**`## 2.1.296`** (la versione della raccolta precedente, per continuità):

> * Fixed managed-settings `PreToolUse` hooks that deny a tool call with `"continue": false`, and managed `prompt` hooks that block one, refusing the call but not ending the turn
> * Fixed PostToolUse hooks in managed settings not applying `updatedMCPToolOutput` in some sessions
> * Fixed SessionStart hooks of a plugin loaded after a headless session starts being skipped when a different plugin with the same name, or another spelling of it, had already run
> * Fixed a late-loading plugin's SessionStart hook output reaching the new conversation after `/clear` in headless sessions
> * Fixed PowerShell commands not seeing variables that hooks write to CLAUDE_ENV_FILE (when the file holds only plain assignments)
> * Improved `--debug` output for hooks: command hooks on tool calls, prompts, SessionStart and Stop now log their command, plugin, outcome and duration when they finish, so a slow hook is identifiable
> * Fixed Esc or an interrupt during a `UserPromptSubmit` hook or a mod's `prompt.submit` hook ending headless sessions, clearing the typed prompt, or letting the unchecked prompt through

### 20.3 Cosa il changelog **non** contiene (risposta diretta a Q1)

Nessuna voce di **2.1.297/2.1.298/2.1.299/2.1.300** tocca:

- la **consegna di `additionalContext`** al modello (nessuna modifica alla semantica di consegna); l'unica voce che sposta *quando* gira un hook è su `UserPromptSubmit` (§20.2, 2.1.299: gira prima dell'espansione di una skill/comando);
- l'evento **`SessionStart`** (l'ultima voce che lo nomina resta quella di **2.1.296**, sullo skipping in headless);
- l'evento **`SubagentStart`** (nessuna voce);
- il **tetto dei 10.000 caratteri** su `additionalContext`/`systemMessage`/`initialUserMessage`/stdout (nessuna voce);
- il **replay del testo iniettato al resume** (`--continue`/`--resume`): nessuna voce. La descrizione di §6.7 (testo salvato nel transcript e **rigiocato** invece di rieseguire l'hook, `SessionStart` che si riesegue con `source: "resume"`/`"fork"`) resta quella della doc e non è contraddetta né aggiornata dal changelog.

Quindi, sugli oggetti che Q1 nomina, il changelog **non porta novità**: le uniche modifiche d'interesse sono di **ordine** (`UserPromptSubmit` prima dell'espansione di una skill, 2.1.299) e di **robustezza** (hook di plugin che non venivano eseguiti in casi limite, 2.1.299/2.1.300).

---

## 21. Aggiornamento (2026-10-15), base **2.1.300** — Q4: superfici per influenzare la prosa **generata** nella conversazione principale

> Aggiornamento (2026-10-15), base **2.1.300**. Fonti ufficiali recuperate: `https://code.claude.com/docs/en/settings-reference`, `https://code.claude.com/docs/en/output-styles`, `https://code.claude.com/docs/en/memory`, `https://code.claude.com/docs/en/hooks`, `https://code.claude.com/docs/en/plugins-reference`, `https://code.claude.com/docs/en/sub-agents`. Nota: la doc ha riorganizzato i path — le impostazioni stanno ora in **`/docs/en/settings-reference`** (non più solo `/settings`), e una parte dei plugin sotto `/docs/en/plugins/…`.

| superficie | cosa fa | valori | chi può scriverla | effetto: token generati o solo display | fonte |
|---|---|---|---|---|---|
| `outputStyle` in `settings.json` | Seleziona lo stile di output attivo, cioè l'insieme di istruzioni che Claude Code manda al modello a ogni richiesta | Nome di uno stile: built-in `Proactive`, `Concise`, `Explanatory`, `Learning` (case-sensitive) oppure il nome di uno stile custom; `Default` = nessuno stile. Un valore che non combacia dà il Default | Utente / progetto / progetto-locale / managed — «Any file» | **Token generati**: cambia le istruzioni di sistema inviate al modello (system prompt) | https://code.claude.com/docs/en/settings-reference ; https://code.claude.com/docs/en/output-styles |
| manifest plugin `outputStyles` | Punta ai file/cartelle di stili di output che il plugin spedisce; sostituisce la scansione predefinita di `output-styles/` | Path o array di path (`.md` o cartelle), `./`-prefissato, contenuto nel plugin root | Plugin (autore del plugin) | **Token generati** (è uno stile di output che entra nelle istruzioni della conversazione principale) | https://code.claude.com/docs/en/plugins-reference |
| cartella `output-styles/` | Sede predefinita di uno stile di output: un file `.md` con frontmatter `name`/`description`/`keep-coding-instructions`/`force-for-plugin` e le istruzioni | Utente `~/.claude/output-styles`; progetto `.claude/output-styles`; managed policy `.claude/output-styles`; plugin `output-styles/` | Utente / progetto / managed / plugin | **Token generati**: `keep-coding-instructions` decide se conservare la sezione coding del system prompt; senza di esso gli stili custom la rimuovono | https://code.claude.com/docs/en/output-styles ; https://code.claude.com/docs/en/plugins-reference |
| hook `MessageDisplay` (`displayContent`) | Sostituisce il testo mostrato a schermo mentre il messaggio dell'assistente viene emesso | Evento senza matcher; input `turn_id`, `message_id`, `index`, `final`, `delta`; output `hookSpecificOutput.displayContent`; timeout 10 s | Utente / progetto (hooks in `settings.json`); plugin (`hooks/hooks.json` o `hooks` nel manifest) | **Solo display**: non tocca transcript, non tocca ciò che Claude vede, non blocca il messaggio | https://code.claude.com/docs/en/hooks |
| `.claude/rules/*.md` | Regole modulari caricate nel contesto a ogni sessione (o quando si apre un file che combacia) | File Markdown; unico frontmatter letto è `paths` (glob); sede `~/.claude/rules/` (utente) e `.claude/rules/` (progetto) | Utente e progetto. **Non** un plugin | **Token generati**: caricate nel contesto, stessa priorità di `.claude/CLAUDE.md` | https://code.claude.com/docs/en/memory |
| file di istruzioni `CLAUDE.md` | Istruzioni persistenti lette a ogni avvio di sessione e concatenate nel contesto | Sedi: managed policy, `~/.claude/CLAUDE.md` (utente), `./CLAUDE.md` o `./.claude/CLAUDE.md` (progetto), `./CLAUDE.local.md` (locale) | Utente / progetto / locale / managed. **Non** un plugin | **Token generati**: il contenuto è iniettato nel contesto di Claude; blocchi HTML-comment sono rimossi prima dell'iniezione | https://code.claude.com/docs/en/memory ; https://code.claude.com/docs/en/plugins-reference |

Citazioni verbatim e URL:

**`outputStyle` (settings-reference)** — https://code.claude.com/docs/en/settings-reference

> | [`outputStyle`](#outputstyle) | Change Claude's role, tone, and output format with an [output style](/docs/en/output-styles) | Model and responses | Any file |

**`outputStyle` (output-styles)** — https://code.claude.com/docs/en/output-styles

> To set a style without the menu, edit the `outputStyle` field directly in a settings file:

> The value is case-sensitive, so write the built-in names as `Proactive`, `Concise`, `Explanatory`, and `Learning`. A value that doesn't match a style name exactly, such as `explanatory`, gives you the Default style. The `/output-style` command ignores case.

> To make a style your default across projects, set `outputStyle` in `~/.claude/settings.json`. A project's own settings files [take precedence](/docs/en/settings#settings-precedence) over that value.

**Sede di uno stile custom e frontmatter** — https://code.claude.com/docs/en/output-styles

> * User: `~/.claude/output-styles`
> * Project: `.claude/output-styles`
> * Managed policy: `.claude/output-styles` inside the [managed settings directory](/docs/en/managed-settings#delivery-mechanisms)
>
> Project output styles load from every `.claude/output-styles/` between the working directory and the repository root. When more than one of these nested directories defines a style with the same name, Claude Code uses the one closest to the working directory.

> | `name` | No | Name of the output style, shown in the `/config` picker. Default: the file name |
> | `description` | No | Description of the output style, shown in the `/config` picker |
> | `keep-coding-instructions` | No | Set to `true` to keep Claude Code's section of built-in software engineering instructions, which only the full system prompt includes, alongside your style. See [How output styles work](#how-output-styles-work). Default: `false` |
> | `force-for-plugin` | No | Plugin output styles only. Set to `true` to apply this style automatically whenever the plugin is enabled, without requiring users to select it. Overrides the user's `outputStyle` setting. If multiple enabled plugins set this, Claude Code uses the first one loaded. Default: `false` |

**Stile = system prompt** — https://code.claude.com/docs/en/output-styles

> An output style changes the instructions Claude Code gives Claude.

> * Claude Code sends the active style's instructions with every request.
> * On the full system prompt, custom output styles leave out Claude Code's section of built-in software engineering instructions, such as how to scope changes, write comments, and verify work, unless `keep-coding-instructions` is set to `true`.

> Output styles apply to the main conversation and to a [fork](/docs/en/sub-agents#fork-the-current-conversation), which inherits the parent's whole conversation and system prompt. Other [subagents run their own system prompt](/docs/en/sub-agents#what-loads-at-startup), so styles don't change how they respond.

**Plugin: `outputStyles`, `output-styles/`** — https://code.claude.com/docs/en/plugins-reference

> | `outputStyles` | Path, or array of paths | Output style files or directories. Replaces the default `output-styles/` scan |

> | Output styles | `output-styles/` | Output style Markdown files |

> **Replaces the default**: `commands`, `agents`, `outputStyles`, `workflows`, `experimental.themes`, `experimental.monitors`. When you set `commands`, the default `commands/` directory isn't scanned.

`force-for-plugin` è dichiarato nella tabella frontmatter di output-styles (vedi sopra). Nota sui limiti del plugin: il campo `settings` del manifest «Only `agent` and `subagentStatusLine` take effect; other keys are dropped at load», quindi un plugin **non** scrive la chiave `outputStyle` (plugins-reference). `[to verify]` se `force-for-plugin` basti a tutti gli effetti a un plugin per imporre lo stile anche fuori da un fork: la pagina output-styles dice che si applica «automatically whenever the plugin is enabled».

**`MessageDisplay`** — https://code.claude.com/docs/en/hooks

> Runs while an assistant message streams to the screen. Claude Code displays the message in increments: each time a batch of newly completed lines is ready to render, the hook runs once with those lines and Claude Code renders the hook's replacement text in their place.

> MessageDisplay is display-only: the replacement text changes only what is rendered on screen. The transcript and what Claude sees keep the original text, so Claude never sees the replacement, and verbose mode shows the original. The hook receives assistant message text only, so tool results and the text you type render unchanged.

> | `displayContent` | Text displayed in place of the delta. Omit it to display the original |

> MessageDisplay hooks have no decision control. They can't block the message or change what is stored in the transcript or sent to Claude. Claude Code acts on `displayContent` from their JSON output and discards `systemMessage` and `continue`.

> The default timeout for this event is 10 seconds

Tabella di decision control:

> | MessageDisplay | `hookSpecificOutput` | `displayContent` replaces the displayed text on screen. Display-only: the transcript and what Claude sees keep the original |

Nessun hook sostituisce il system prompt: gli hook di contesto iniettano via `additionalContext`, avvolto in un system reminder — «The `additionalContext` field passes a string from your hook into Claude's context window. Claude Code wraps the string in a [system reminder]…» (https://code.claude.com/docs/en/hooks). `[to verify]` se `MessageDisplay` giri anche per i subagenti: l'evento «fires for every assistant message that streams text» e fra i common input fields compaiono `agent_id` / `agent_type` nei contesti di subagente, ma la pagina non lo dichiara esplicitamente per questo evento (https://code.claude.com/docs/en/hooks).

**`.claude/rules/*.md`** — https://code.claude.com/docs/en/memory

> For larger projects, you can organize instructions into multiple files using the `.claude/rules/` directory. This keeps instructions modular and easier for teams to maintain. Rules can also be [scoped to specific file paths](#path-specific-rules), so they only load into context when Claude works with matching files, reducing noise and saving context space.

> Rules load into context every session or when matching files are opened.

> Rules without [`paths` frontmatter](#path-specific-rules) are loaded at launch with the same priority as `.claude/CLAUDE.md`.

> Project rules are skipped if you exclude `project` from [`--setting-sources`](/docs/en/cli-reference).

> `paths` is the only field Claude Code reads from a rule; any other field is ignored without an error. Claude Code removes the frontmatter before loading the rule into context.

> Personal rules in `~/.claude/rules/` apply to every project on your machine.

> Claude Code loads user-level rules before project rules, so a project rule appears later in Claude's context than a user rule.

**`CLAUDE.md` (file di istruzioni)** — https://code.claude.com/docs/en/memory

> CLAUDE.md files are markdown files that give Claude persistent instructions for a project, your personal workflow, or your entire organization. You write these files in plain text; Claude reads them at the start of every session.

> All discovered files are concatenated into context rather than overriding each other. Across the directory tree, content is ordered from the filesystem root down to your working directory.

> Block-level HTML comments (`<!-- maintainer notes -->`) in CLAUDE.md files are stripped before the content is injected into Claude's context.

> Settings rules are enforced by the client regardless of what Claude decides to do. CLAUDE.md instructions shape Claude's behavior but are not a hard enforcement layer.

Il plugin non entra in questa superficie — https://code.claude.com/docs/en/plugins-reference

> A `CLAUDE.md` at the plugin root isn't loaded as context, and `claude plugin validate` warns when it finds one. To include instructions that load into Claude's context, put them in a skill.

**Ambito.** La pagina sub-agents conferma che solo il **fork** eredita anche lo stile di output della conversazione principale; gli altri subagenti «run their own system prompt», quindi le superfici che stanno nel system prompt (stile di output) agiscono sulla conversazione principale e non su di essi (https://code.claude.com/docs/en/sub-agents). La pagina sub-agents **non** nomina `MessageDisplay`.

---

## 22. Aggiornamento (2026-10-15), base **2.1.300** — Q5: cosa un plugin può scrivere e cosa no; ordine di merge dei settings

> Aggiornamento (2026-10-15), base **2.1.300**. Fonti ufficiali: `plugins`, `plugins/manifest-reference` (citata anche come `plugins-reference`), `plugins/components`, `plugins/install`, `plugins/loading`, `plugins/security`, `settings`, `settings-reference`, `hooks` (tutte sotto `https://code.claude.com/docs/en/`).

### 22.1 Un plugin può depositare una chiave in `.claude/settings.json` del progetto?

**No — il meccanismo documentato non esiste.** Un plugin **applica dei default mentre è abilitato**, non scrive nelle settings del progetto. L'unico canale plugin → settings è `pluginConfigs`, e sono **le risposte che l'utente dà**, salvate nelle settings dell'**utente**.

Chiave `settings` del manifest — verbatim:

> `settings` | Object | Settings Claude Code applies while the plugin is enabled. Only `agent` and `subagentStatusLine` take effect; other keys are dropped at load. A `settings.json` at the plugin root takes precedence over this key.

`plugins/components` — sezione "Default settings":

> To set defaults that apply while the plugin is enabled, add a `settings.json` at the plugin root, or put the same object inline in the `settings` manifest key. Two keys take effect, `agent` and `subagentStatusLine`, and every other key is dropped.

> A `settings.json` at the plugin root holds settings that apply while the plugin is enabled, so a plugin can change how the session behaves and not only add components. Only two keys take effect from a plugin, `agent` and `subagentStatusLine`; every other key is dropped.

Dove finiscono davvero i valori che il plugin chiede — `plugins-reference`, "Where values are stored":

> Non-sensitive values are saved under `pluginConfigs` in the user's `settings.json`. Sensitive values go to the platform's secure credential store instead.

E la natura di `userConfig` è che è **l'utente a fornire il valore**:

> `userConfig` declares values Claude Code prompts the user for when the plugin is enabled, so users don't edit `settings.json` themselves.

`pluginConfigs` ha scope **User or managed**, non project. La pagina `settings` dice anzi chi crea i file:

> **User** and **Project local**: create them yourself, or let Claude Code create them. It writes `~/.claude/settings.json` the first time you change an option in the `/config` menu that it stores in user settings, such as the theme, and `.claude/settings.local.json` the first time you give a standing approval on a permission prompt…

`plugins/security` — "Understand what a plugin can do" elenca hooks, monitors, mods, MCP/LSP servers, `bin/`, skills/commands/agents, updates — e **non** nomina la scrittura di settings.

`[to verify]` Le pagine **non contengono una frase negativa letterale** del tipo «un plugin non può scrivere `.claude/settings.json`». Non esiste un meccanismo documentato che lo faccia, e la sola via plugin → settings è `pluginConfigs` (risposte dell'utente, settings d'utente o managed). Limite di perimetro da notare: un hook o un mod di un plugin gira **con i privilegi dell'utente** (`plugins/security`: «a plugin's mod runs JavaScript inside Claude Code with your permissions»), quindi *codice arbitrario* potrebbe editare il file — ma non è un comportamento documentato né una chiave «depositata» dal plugin. Questo ricalca l'`ARCHITECTURE.md` di progetto: «**Il pacchetto non scrive nel progetto.** L'host non lo permette».

### 22.2 Ordine di merge user / project / local / plugin / managed

`settings` — Settings precedence, verbatim:

> When the same key appears in more than one place, Claude Code uses the value from the highest level that sets it. The stack below shows the levels, highest on top; a key at a higher level overrides the same key anywhere below it.
>
> In order, highest precedence first:
>
> 1. **Managed settings**: settings your organization deploys, by a `managed-settings.json` file, an MDM policy, or server-managed settings from the claude.ai console. Nothing in your own settings files or `--settings` overrides a managed key…
> 2. **Command line**: JSON you pass with `--settings <file-or-json>` when you start `claude`, for that session only…
> 3. **Project local settings** (`.claude/settings.local.json`): your personal settings for this project.
> 4. **Shared project settings** (`.claude/settings.json`): settings your team checks into source control.
> 5. **User settings** (`~/.claude/settings.json`): your personal settings for every project.

L'`aria-label` del diagramma ripete lo stesso ordine:

> Settings precedence, highest first: managed settings, command line, project local, shared project, user. A key set at a higher level overrides the same key set lower down.

Il **plugin non è un livello di questo stack**: i suoi default stanno **sotto tutto** — `plugins/components`, "Default settings":

> * **User settings over plugin defaults**: across settings sources, plugin defaults are the lowest layer, so a user's own `agent` in `~/.claude/settings.json` overrides yours

E dove due plugin toccano la stessa chiave:

> * **Two plugins set the same key**: the value from the plugin loaded last applies, and `claude --debug` logs `overrides setting`

Le liste si combinano invece di sovrascriversi — `settings`, "Lists merge instead of overriding":

> When you set the same list key, such as `permissions.allow`, in more than one file, Claude Code combines the lists instead of picking one, so each file can add entries without removing another file's.

Nota sugli hook — `hooks`, "Merge behavior":

> Hook entries merge across settings levels rather than replacing each other: user, project, and local settings add their own hooks without removing managed ones, and the `disableAllHooks` setting can't disable managed hooks from outside managed settings.

E sulla deduplicazione degli handler — `hooks`:

> All matching hooks run in parallel. If you define the same handler in more than one settings file, it runs once. A plugin's or skill's copy of the same handler stays separate.

**Tabella — ordine di merge degli settings (generico):**

| # | Livello | File / sorgente |
| :- | :- | :- |
| 1 (massima) | Managed settings | `managed-settings.json`, policy MDM, o server-managed settings dalla console claude.ai |
| 2 | Command line | `claude --settings <file-or-json>` (una sessione) |
| 3 | Project local | `.claude/settings.local.json` |
| 4 | Shared project | `.claude/settings.json` |
| 5 (minima) | User | `~/.claude/settings.json` |
| sotto tutto | Plugin defaults | `settings.json` alla radice del plugin, o la chiave `settings` del manifest — solo `agent` e `subagentStatusLine` |

**Tabella — precedenza di `enabledPlugins`** (sei sorgenti, da minor a maggior precedenza, `plugins/loading`):

| Precedenza | Sorgente | Dove |
| :- | :- | :- |
| più bassa | `--add-dir` | `.claude/settings.json` o `.claude/settings.local.json` in una directory passata con `--add-dir` (solo sessione; solo un `true` ha effetto) |
| | `user` | `~/.claude/settings.json` |
| | `project` | `.claude/settings.json` |
| | `local` | `.claude/settings.local.json` |
| | `flag` | il valore `--settings` al lancio (solo sessione) |
| più alta | `managed` | Managed settings — `true` forza l'abilitazione, `false` blocca, nessun'altra sorgente sovrascrive |

> These sources merge key by key. For each plugin id, the value that applies is the one from the highest-precedence source that mentions the id. A source that doesn't mention the id leaves the value from the lower-precedence source in effect.

### 22.3 Il manifest ha un campo che contribuisce settings?

Sì, ma **limitato**: la chiave **`settings`** (o un `settings.json` alla radice del plugin). Solo `agent` e `subagentStatusLine` hanno effetto; ogni altra chiave è scartata al load. Un plugin quindi **non** contribuisce permessi, env, model o la chiave `outputStyle`: solo quelle due.

Chiavi top-level di `plugin.json` (solo `name` è obbligatoria): `$schema`, `name`, `displayName`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `metadata`, `icon`, `documentationUrl`, `supportUrl`, `privacyPolicyUrl`, `termsOfServiceUrl`, `defaultEnabled`, `dependencies`, `settings`, `userConfig`, `types`, `channels`, `skills`, `commands`, `agents`, `hooks`, `mcpServers`, `lspServers`, `outputStyles`, `workflows`, `experimental` (che contiene `themes`, `monitors`, `evals`).

Layout standard (posizioni di default quando il manifest non punta altrove): manifest `.claude-plugin/plugin.json`; skills `skills/`; commands `commands/`; agents `agents/`; hooks `hooks/hooks.json`; MCP `.mcp.json`; LSP `.lsp.json`; output styles `output-styles/`; workflows `workflows/`; themes `themes/`; monitors `monitors/monitors.json`; eseguibili `bin/`; settings `settings.json` (solo `agent` e `subagentStatusLine`).

### 22.4 Cosa scrivono `claude plugin install` / `marketplace add` su disco

`plugins/install`, "Choose an install scope", verbatim:

> * **User scope**: the plugin is enabled for you in every project on this machine. The entry goes in `enabledPlugins` in `~/.claude/settings.json`.
> * **Project scope**: the plugin is enabled for everyone who works in this repository. The entry goes in `.claude/settings.json`, which you commit…
> * **Local scope**: the plugin is enabled for you in this repository only. The entry goes in `.claude/settings.local.json`.
>
> When the same plugin is set at several scopes, the local setting overrides the project setting, and the project setting overrides the user setting.

> * **Scope**: user scope by default. Pass `--scope project` or `--scope local` to change it.

`plugins/loading`, "Check which stage a plugin reached":

> **Declared, in settings**: `enabledPlugins` says which plugins should be on, and `extraKnownMarketplaces` says which marketplaces should exist. When you run `claude plugin marketplace add`, Claude Code writes the marketplace to `extraKnownMarketplaces` in your user settings as well as to disk

| Azione | Chiave | File |
| :- | :- | :- |
| `claude plugin install` (user scope, default) | `enabledPlugins` | `~/.claude/settings.json` |
| `claude plugin install --scope project` | `enabledPlugins` | `.claude/settings.json` (committato) |
| `claude plugin install --scope local` | `enabledPlugins` | `.claude/settings.local.json` |
| `claude plugin marketplace add` | `extraKnownMarketplaces` | settings **utente** (`~/.claude/settings.json`) + `known_marketplaces.json` |
| record di fetch/install | — | `~/.claude/plugins/known_marketplaces.json`, `installed_plugins.json`, `cache/` |
| risposte alla config dialog del plugin | `pluginConfigs` | `~/.claude/settings.json` (o managed); valori `sensitive` nello store di credenziali |

Le tre chiavi hanno scope (`settings-reference`): `enabledPlugins` e `extraKnownMarketplaces` → **Any file**; `pluginConfigs` → **User or managed**. «Any file» = user, project, local, managed. Le organizzazioni possono mettere `enabledPlugins` in **managed settings** per forzare o bloccare un plugin.

---

## 23. Aggiornamento (2026-10-15), base **2.1.300** — Q2: stato delle issue sul sintomo «hook di plugin non consegnano il contesto»

> Aggiornamento (2026-10-15). Raccolta via `gh issue view` / `gh search issues` su `anthropics/claude-code`. Aggiorna e sostituisce la riga su #16538 di §6.6.

| numero | titolo verbatim | stato | date | sintomo | link |
|---|---|---|---|---|---|
| #16538 | `Plugin SessionStart hooks don't surface hookSpecificOutput.additionalContext to Claude` | CLOSED (NOT_PLANNED) | creata 2026-01-07 · chiusa 2026-05-11 (bot inattività) · lock 2026-06-30 | Il caso di riferimento: hook di plugin in `hooks/hooks.json` esegue e produce JSON valido con `additionalContext`, ma il modello non lo riceve; hook identico in `~/.claude/settings.json` funziona. Commenti su 2.1.39, 2.1.42→2.1.45, 2.1.75, 2.1.86; `dcadenas` (2026-03-13) riporta che i plugin hook **non eseguono affatto**, non solo che l'output è scartato | [16538](https://github.com/anthropics/claude-code/issues/16538) |
| #40614 | `[FEATURE] Hierarchical memory to prevent silent loss at 200-line MEMORY.md limit` | CLOSED (NOT_PLANNED) | creata 2026-03-29 · chiusa 2026-05-11 · aggiornata 2026-07-01 | **Non è lo stesso sintomo.** È la feature request di `j-p-c` per l'indice `MEMORY.md` gerarchico; il commento in #16538 la cita solo come "Related" perché quello strumento usa hook `SessionStart`/`PreCompact`. Nessun duplicato del difetto | [40614](https://github.com/anthropics/claude-code/issues/40614) |
| #73401 | `Windows desktop app: plugin SessionStart hook executes but its stdout is never injected into session context` | CLOSED (NOT_PLANNED) | creata 2026-07-02 · chiusa 2026-08-31 (bot inattività) | Stesso sintomo su Windows desktop: l'hook di plugin **esegue** (marker log), `${CLAUDE_PLUGIN_ROOT}` risolve, `cat` riesce, ma lo stdout non entra nel contesto. Cita esplicitamente #16538 come «the same underlying gap» | [73401](https://github.com/anthropics/claude-code/issues/73401) |
| #88086 | `VS Code extension: SessionStart plugin hook additionalContext logged as succeeded but never injected into model context` | CLOSED (NOT_PLANNED) | creata 2026-08-19 · chiusa 2026-10-03 (bot inattività) | Lo stesso sintomo nell'estensione VS Code 2.1.236: il transcript mostra `hook_success` con lo stdout completo, ma il modello non riceve nessun `system-reminder` | [88086](https://github.com/anthropics/claude-code/issues/88086) |
| #75972 | `Plugin-sourced hooks.json never fires, even though the plugin shows installed + enabled (no error, no registry entry evidence)` | OPEN | creata 2026-07-09 · aggiornata 2026-09-10 | Hook di plugin inerti del tutto (SessionStart, Stop, PreToolUse, PostToolUse). **Risposta manutentore** (`bcherny`, COLLABORATOR, 2026-08-17): un nome di evento non riconosciuto fa **rifiutare l'intero `hooks.json`**, quindi nessun hook valido parte; «That's a bug on our side… We're tracking a fix» | [75972](https://github.com/anthropics/claude-code/issues/75972) |
| #12151 | `[BUG] Plugin hook output not captured or passed to agent (UserPromptSubmit, SessionStart)` | OPEN | creata 2025-11-22 · aggiornata 2026-04-08 | La più vecchia ancora aperta con il sintomo esatto; 24 commenti | [12151](https://github.com/anthropics/claude-code/issues/12151) |
| #16288 | `Plugin hooks not loaded from external hooks.json file` | OPEN | creata 2026-01-04 · aggiornata 2026-09-27 | Hook referenziati da `plugin.json` (`"hooks": "./hooks/hooks.json"`) mai caricati; stesso hook in `~/.claude/settings.json` funziona | [16288](https://github.com/anthropics/claude-code/issues/16288) |
| #83643 | `[BUG] Desktop remote sessions: plugin sync to ~/.claude/remote/plugins/ omits hooks/, so plugin hooks never fire` | OPEN | creata 2026-08-03 · aggiornata 2026-10-08 | Causa identificata: la sync delle sessioni remote non copia `hooks/` | [83643](https://github.com/anthropics/claude-code/issues/83643) |
| #92675 | `Plugin-native PreToolUse hooks (auto-discovered via hooks/hooks.json) are not enforced in interactive sessions…` | OPEN | creata 2026-09-07 | Hook di plugin non applicati in sessioni interattive | [92675](https://github.com/anthropics/claude-code/issues/92675) |
| #94635 | `[BUG] Desktop Code tab: enabled ~/.claude plugins never load into sessions — regression 2.1.237 → 2.1.260, still broken in 2.1.270` | OPEN | creata 2026-09-16 | Plugin abilitati non caricati (hook inclusi) nella Code tab del desktop | [94635](https://github.com/anthropics/claude-code/issues/94635) |
| #95673 | `Windows: three bundled plugins' hooks never run and spawn a console window — hooks.json invokes .sh by bare path` | OPEN | creata 2026-09-20 | Su Windows gli hook di tre plugin bundled non eseguono mai | [95673](https://github.com/anthropics/claude-code/issues/95673) |
| #96087 | `[BUG] Windows desktop (MSIX): plugin hook scripts invisible to externally-spawned interpreter — every hook ENOENTs and asyncRewake Stop hooks loop forever` | OPEN | creata 2026-09-22 | Hook di plugin su Windows desktop: ENOENT sistematico | [96087](https://github.com/anthropics/claude-code/issues/96087) |
| #96496 | `[BUG] Hooks silently don't fire in Desktop app or new RC session slots (terminal & first RC session work)` | OPEN | creata 2026-09-23 · aggiornata 2026-10-01 | Hook da `.claude/settings.json` (non solo plugin) non partono nella Code tab desktop e nei nuovi slot remote-control | [96496](https://github.com/anthropics/claude-code/issues/96496) |
| #100869 | `[BUG] Plugin hooks module: classic.* events (classic.Stop, classic.PreToolUse, classic.Notification, classic.PermissionRequest) never reach the module, while settings hooks for the same events fire in the same session (2.1.295)` | OPEN | creata 2026-10-09 | API *hooks module* dei plugin (function hooks) non consegna gli eventi `classic.*` | [100869](https://github.com/anthropics/claude-code/issues/100869) |
| #101640 | `Mods (function-hook plugins) load but never run in desktop Code tab; CLAUDE_CODE_PLUGIN_DIRS ignored` | OPEN | creata 2026-10-12 | Mod/plugin con function hook caricati ma mai eseguiti nella Code tab | [101640](https://github.com/anthropics/claude-code/issues/101640) |
| #100234 | `[BUG] SessionStart hooks declared in MANAGED settings deliver no additionalContext in the desktop app on Windows; the same hook from user settings delivers…` | OPEN | creata 2026-10-07 | Stesso sintomo di mancata consegna di `additionalContext`, ma la variabile è *managed settings* + desktop Windows, non il plugin | [100234](https://github.com/anthropics/claude-code/issues/100234) |
| #96193 | `Hook JSON with top-level additionalContext is silently dropped (no warning), context never reaches the model` | OPEN | creata 2026-09-23 | `additionalContext` di primo livello scartato in silenzio (variante non-plugin) | [96193](https://github.com/anthropics/claude-code/issues/96193) |

- **Il sintomo è ancora vivo dopo il 2026-05.** Dopo la chiusura di #16538 ci sono almeno due re-file plugin-specifici dello stesso difetto, entrambi chiusi dal bot per inattività e mai risolti: #73401 (2026-07-02/2026-08-31, Windows desktop) e #88086 (2026-08-19/2026-10-03, VS Code). Nessuno dei due riporta una conferma di riparazione: sono `NOT_PLANNED` da auto-chiusura, non da verdetto.
- **L'unica risoluzione di manutentore trovata è su un altro ramo del problema.** In #75972 `bcherny` (COLLABORATOR) conferma il 2026-08-17 un bug reale — un evento non riconosciuto in `hooks.json` invalida l'intero file e spegne tutti gli hook — e dice «We're tracking a fix». Spiega il ramo «gli hook di plugin non eseguono affatto», **non** il ramo «eseguono ma l'output non arriva al modello» di #16538/#73401/#88086, che resta senza risposta.
- **Il riferimento a #40614 in #16538 non porta a un duplicato.** #40614 è una feature request sulla memoria gerarchica, chiusa `NOT_PLANNED`; il cross-link è motivato solo dall'uso di hook `SessionStart`/`PreCompact` da parte dello strumento citato. `[to verify]` che il numero citato fosse davvero quello voluto dal commentatore: nel thread non c'è altro riferimento.
- **Il pattern recente è più sui *surface* che sugli eventi.** #94635, #95673, #96087, #96496, #101640 spostano il difetto su desktop Code tab / Windows MSIX / sessioni remote; #100869 e #101640 lo spostano sull'API *hooks module* (function hooks, `classic.*`), che è un meccanismo diverso da `hooks/hooks.json` classico. Fuori dal plugin, lo stesso mancato recapito di `additionalContext` continua a essere segnalato su managed settings (#100234) e sulle forme non canoniche del payload (#96193). `[to verify]` #90296 (2026-08-28, «UserPromptSubmit hooks: two silent failure modes… additionalContext intermittently never reaches the context») è la stessa forma ma riportata su un'app di terzi («ZCode desktop»), non su Claude Code first-party: va esclusa o verificata prima di citarla come prova.

---

## 24. Aggiornamento (2026-10-15), base **2.1.300** — Q3: consegna di `additionalContext` da un hook di **plugin** alla conversazione

> Aggiornamento (2026-10-15), base **2.1.300**. Risponde a: su 2.1.300, un hook `SessionStart` **definito in un plugin** consegna `additionalContext` al modello della **conversazione**? E un `UserPromptSubmit` di plugin? La doc distingue «hook di plugin» da «hook di settings» quanto alla **consegna**? Fonti: `https://code.claude.com/docs/en/hooks`, `https://code.claude.com/docs/en/plugins/components`, `https://code.claude.com/docs/en/plugins-reference`.

### 24.1 Cosa afferma la doc

**Un hook di plugin è una sede come le altre — la doc lo dichiara, ma solo sul *merge*:**

> Define plugin hooks in `hooks/hooks.json` with an optional top-level `description` field. When a plugin is enabled, its hooks merge with your user and project hooks.

> | Plugin `hooks/hooks.json` | When plugin is enabled | Yes, bundled with the plugin |

> Save the plugin's hooks in `hooks/hooks.json` at the plugin root, under a top-level `"hooks"` key, in the same shape as the `hooks` object in `settings.json`. That lets you copy an existing settings hook in unchanged.

> `hooks` takes a `.json` file path, an inline hooks object in the same shape as `hooks` in `settings.json`, or an array mixing both. […] Claude Code merges whatever you declare with `hooks/hooks.json` when that file exists.

**La consegna di `additionalContext` è descritta per evento, mai per provenienza dell'hook:**

> The `additionalContext` field passes a string from your hook into Claude's context window. Claude Code wraps the string in a [system reminder] and inserts it into the conversation at the point where the hook fired. Claude reads the reminder on the next model request, but it doesn't appear as a chat message in the interface.
>
> * `SessionStart` and `SubagentStart`: at the start of the conversation, before the first prompt
> * `UserPromptSubmit` and `UserPromptExpansion`: alongside the submitted prompt
>
> When several hooks return `additionalContext` for the same event, Claude receives all of the values.

`SessionStart decision control`, tabella dei campi (verbatim):

> | `additionalContext` | String added to Claude's context at the start of the conversation, before the first prompt. See [Add context for Claude](#add-context-for-claude) for how the text is delivered and what to put in it |

> A hook that only adds context can print it without building JSON, because Claude Code adds a SessionStart hook's plain-text stdout to Claude's context.

`Exit code 0` (verbatim):

> For most events, Claude Code writes stdout to the debug log and doesn't show it in the transcript. The exceptions are `UserPromptSubmit`, `UserPromptExpansion`, `SessionStart`, and `PostModelSwitch`, where Claude Code adds plain-text stdout as context that Claude can see and act on.

`UserPromptSubmit decision control` (verbatim):

> There are two ways to add context to the conversation on exit code 0:
>
> * **Plain text stdout**: Claude Code adds stdout it [treats as plain text](#exit-code-0) to Claude's context
> * **JSON with `additionalContext`**: use the JSON format below for more control. The `additionalContext` field is added as context
>
> Neither channel produces a visible transcript entry. Plain stdout and the `additionalContext` value are each injected as a system reminder that starts with the hook's name; Claude reads both. To confirm delivery, check the [debug log](#debug-hooks).

**Le sole differenze che la doc nomina fra hook di plugin e hook di settings riguardano altro, non la consegna** — la deduplicazione degli handler, il trattamento di exit 2 con stderr «file mancante», la finestra d'installazione per `initialUserMessage`/`sessionTitle`, il budget di `SessionEnd`, `allowManagedHooksOnly`:

> All matching hooks run in parallel. If you define the same handler in more than one settings file, it runs once. A plugin's or skill's copy of the same handler stays separate.

> * **`Stop`, `SubagentStop`, `TaskCompleted`, and a plugin's `UserPromptSubmit` hook**: when your hook exits 2 with nothing on stdout and its stderr says a file is missing, such as `No such file or directory`, Claude Code treats the run as a non-blocking error.

> If your plugin's SessionStart hook supplies `initialUserMessage` or `sessionTitle`, install the plugin before the session starts. Claude Code ignores both fields from a plugin that finishes installing after the SessionStart hooks have run.

> * **Per-hook `timeout`**: set `timeout` in that hook's configuration. The overall budget rises automatically to match the highest per-hook `timeout` in your settings files, up to 60 seconds. […] Timeouts set on plugin-provided hooks don't raise the budget.

> * Your user, project, local, and plugin hooks are blocked. Hooks from plugins force-enabled in managed settings `enabledPlugins` are exempt

> Hooks from settings files, managed policy settings, and plugins also run inside subagents. When a subagent calls a tool, tool events such as `PreToolUse` and `PostToolUse` fire the same configured hooks as in the main conversation, and the input carries the `agent_id` and `agent_type` common input fields that identify the subagent.

### 24.2 Cosa affermano le issue (contraddicono la doc)

Le issue (§23) affermano l'opposto per gli hook di **plugin**: l'hook esegue ma `additionalContext` **non** raggiunge il modello, mentre lo stesso hook in `~/.claude/settings.json` funziona (#16538, #73401, #88086; e #75972 che il maintainer ha confermato come bug del file rifiutato intero). Nessuna di queste è risolta, e nessuna copre la **2.1.300** (nominano 2.1.39–2.1.236).

### 24.3 Cosa la doc NON afferma (resta `[to verify]`)

- Non esiste una frase che dica, con queste parole, che l'`additionalContext` di un hook `SessionStart` **o** `UserPromptSubmit` **definito in un plugin** raggiunga il modello della conversazione principale. Il fatto si **deduce** (la tabella *Hook locations* mette `hooks/hooks.json` fra le sedi, il tab *Plugin scripts* dice che si fonde con gli hook utente e di progetto, e la consegna è descritta per evento) ma non è **mai affermato per provenienza**: `[to verify]`.
- La consegna non è mai qualificata per sorgente: nessuna riga dice «gli hook di plugin consegnano (o non consegnano) `additionalContext` come quelli di settings». L'equivalenza è solo implicita: `[to verify]`.
- Il paragrafo del merge («Hook entries merge across settings levels…» — user, project, local, managed) **non nomina i plugin**: non è detto se gli hook di plugin stiano dentro quella scala. `[to verify]`.
- Nessuna riga dice se un plugin installato a metà sessione (dopo il `SessionStart`) consegni ancora il contesto; l'unico caso di plugin-installato-tardi risolto dalla doc riguarda `initialUserMessage` e `sessionTitle`, non `additionalContext`. `[to verify]`.
- Non è detto se `SessionStart` scatti anche per la sessione di un subagent e dove finirebbe lì il suo `additionalContext`; l'unica riga vicina parla dei tool event che «fire the same configured hooks as in the main conversation». `[to verify]`.
- Non è detto se il testo di un hook di plugin venga etichettato diversamente nella system reminder (la doc dice solo che la reminder «starts with the hook's name»). `[to verify]`.
- La pagina **non è vincolata a un numero di build**: porta gate per singola funzione (`v2.1.288 or later`, `v2.1.295 or later`), ma nessuna affermazione è scoped a **2.1.300** in particolare. `[to verify]`.

### 24.4 Sintesi della risposta a Q3

Sulla **2.1.300**: la **doc** non distingue i due tipi di hook quanto alla *consegna* e, descrivendo la consegna **per evento**, lascia intendere che un hook di plugin consegni come uno di settings; le **issue** affermano il contrario per `SessionStart` e `UserPromptSubmit` di plugin; il punto resta **`[non provato]`** su questa macchina e su questa versione — non c'è una riga di doc che lo garantisca né un esito di host che lo provi su 2.1.300 (la §19 prova solo `SubagentStart` di plugin su 2.1.296, che invece consegna). Chi deve decidere se appoggiarsi a un hook `SessionStart`/`UserPromptSubmit` **di plugin** per parlare alla conversazione principale lo fa **contro il rischio dichiarato dalle issue**, non contro una garanzia della doc.
