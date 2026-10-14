---
name: costo-fisso-schemi-dei-tool
description: "Il costo fisso di una sessione è quasi tutto schemi di tool, non prosa: le misure del 14 ottobre 2026 e i meccanismi che li tolgono davvero — i flag `--tools`/`--disallowedTools`, le env var `CLAUDE_CODE_DISABLE_*` e le chiavi `enableArtifact`/`enableWorkflows` di `settings.json` — mentre `permissions.deny` e la chiave `disallowedTools` NON tolgono niente"
metadata:
  node_type: memory
  type: project
  originSessionId: 4380a3a1-6957-4bf5-ba20-d40d7d4d6066
  modified: 2026-10-14T17:24:58.311Z
---

Misurato il **14 ottobre 2026** su Claude Code **2.1.276**, Windows, con `claude -p "ok"
--output-format json` in una cartella **vuota** e leggendo il primo `message.usage.input_tokens`
del transcript nuovo sotto `~/.claude/projects/<slug>/*.jsonl`. Il primo request è il costo fisso:
in quel momento è stato spedito solo system prompt + schemi + contesto iniettato.

**Il pavimento è quasi tutto tool, non prosa.** Cartella vuota: **35.790–36.822** a seconda della
cartella; con `--tools ""` scende a **1.581**. La prosa del system prompt è dell'ordine di 1-2k. In
un progetto Daiku lo stesso primo request è **~49,5k** = ~35k host + ~13k progetto (`CLAUDE.md`
6,5k, lista delle skill 3,9k, indice della memoria 3,1k).

**Cosa toglie davvero gli schemi** (baseline 36.822, delta misurati):

| Meccanismo | Δ |
|---|---|
| `--tools "Bash,Read,Edit,Write,Grep,Glob,WebFetch,WebSearch,Task,TodoWrite"` | −29.973 (−81%) |
| `--disallowedTools` con nove nomi mai usati | −15.837 (−43%) |
| `{"enableArtifact": false}` in `settings.json` | −10.664 |
| env var `CLAUDE_CODE_DISABLE_ARTIFACT=1` | −10.664 (identico) |
| le quattro `DISABLE_ARTIFACT/WORKFLOWS/CRON/BACKGROUND_TASKS` | −13.005 (−36%) |
| `--safe-mode` | −2.251 |
| `--disable-slash-commands` | **niente** |

Aggiuntivi sul singolo tool: DesignSync 2.385, Cron*+ScheduleWakeup 2.437, Workflow 1.334,
EnterWorktree+ExitWorktree 1.583, Monitor 2.056, NotebookEdit 439, ReportFindings 576,
PushNotification 412, TaskStop 197, ArtifactComments+ArtifactData ~0 (differiti).

**Cosa NON toglie niente, benché la documentazione dica il contrario:**
- `permissions.deny` con nome nudo (`Bash`, `NotebookEdit`, o ventidue nomi): il primo request
  resta identico al bit. La doc ufficiale afferma «a bare tool name like `Bash` removes the tool
  from Claude's context entirely»: su questa versione la misura la smentisce.
- la chiave **`disallowedTools`** in `settings.json`: nessun effetto (nome o lista vuota, uguale).
  Esiste solo come flag della CLI.

**Il canale è dimostrato applicato, non è un artefatto**: lo stesso `--settings`, con dentro un
blocco `env` o `{"enableArtifact": false}`, **cambia** il numero.

**La trappola che mi ha quasi fatto sbagliare**, e che vale per chiunque ripeta la misura: creare
un `.claude/settings.json` dentro la cartella di prova la **inquina per sempre** — da quel momento
ogni run la carica da solo, e *ogni* variante misura lo stesso numero, anche `--settings {}`, anche
una chiave inventata. Sintomo: risultati **identici al bit** cambiando l'input. La prova va fatta in
una cartella vergine, e i file di settings passati a `--settings` vanno tenuti **fuori** da essa.

**La via per l'estensione VS Code.** `--tools` e `--disallowedTools` sono flag della CLI e
l'estensione non li espone — ma la stessa cartella dell'estensione porta
`claude-code-settings.schema.json`, lo schema delle **174 chiavi** di `settings.json`, e quelle
chiavi le legge ogni sessione, chiunque la lanci. Le utili: `enableArtifact`, `enableWorkflows` /
`disableWorkflows`, `disableBundledSkills`, `bashOutputMaxChars` (default 30.000 caratteri),
`skillListingMaxDescChars` (1536) e `skillListingBudgetFraction` (0,01), `skillOverrides`,
`outputStyle`, `autoMemoryEnabled`, `claudeMdExcludes`.

**Il TTL della cache non è una leva**: su 43.494 richieste del corpus le mancate dopo la prima
richiesta di una sessione sono **743, l'1,7%**. La cache a 5 minuti tiene.

**Applicato su questa macchina il 14 ottobre 2026**, su scelta dell'owner: `~/.claude/settings.json`
porta `"enableArtifact": false` e, dentro `env`, `"CLAUDE_CODE_DISABLE_CRON": "1"`. Scope
**macchina**: vale in ogni progetto e in ogni sessione, estensione VS Code compresa. Verificato
end-to-end — una sessione nuova in una cartella vergine è scesa da 36.822 a **24.827**. Conseguenza
da sapere prima di cercarla: il tool `Artifact` e i cron tool — quindi la skill `/loop`, i
`CronCreate`/`CronDelete`/`CronList` e `ScheduleWakeup` — **non esistono più in nessuna sessione su
questa macchina**. Si disfa togliendo le due chiavi. Il livello 2
(`--disallowedTools "DesignSync,NotebookEdit"`, −2.824) è stato **scartato**: è per invocazione, non
si persiste in nessun file.

Vedi [[come-si-provano-i-fatti-su-claude-code]] per il metodo, e [[costo-di-un-giro]] per l'altra
metà del conto — la lettura del contesto dalla cache è il 70%, l'output il 21%, il costo fisso il
17% di cui solo ~4 punti sono del progetto.
