# opencode — appunti operativi di sviluppo

> **Versione in uso nel progetto: 2.0.19** (`opencode --version` → `opencode v2.0.19`, 2026-10-03; pacchetto npm globale `@opencode/cli@2.0.19`).
> **Ultima pubblicata sulla stessa linea:** `@opencode/cli@2.0.22` (npm, ~2026-10-02/03). **Ultima release GitHub:** `v1.18.34` (2026-09-30) — ma è l'**altra linea** (V1), vedi §2.
> Data di raccolta: **2026-10-03**. Radice tecnica: `C:/dev/daiku-workspace/daiku-dev` → `{paths.studies}` = `.daiku/studies`.
> Nota sul cutoff del modello: firme, nomi di campo, JSON e comandi qui sotto sono copiati **verbatim** da pagine recuperate o da comandi realmente eseguiti su questa macchina, mai dalla memoria del modello. Ciò che le fonti non confermano è marcato **`[to verify]`**, con cosa manca.
> `documents.stack` e `documents.architecture` **non sono dichiarati** in `.daiku/project.json` (non esiste la chiave `documents`): la nota non ha quindi un ancoraggio al progetto oltre a questo. Assenza dichiarata, non supplita.

## Indice

1. **Meta e sorgenti** — convenzioni, fonti primarie e di terza parte.
2. **Modello di versione: le due linee V1 e V2** — qual è la versione in uso, cosa cambia nell'altra.
3. **Concetti e modello mentale** — cos'è opencode, client/server, sessioni, le quattro estensioni.
4. **Installazione e distribuzione** — come si installa, come si distribuisce un'estensione.
5. **Dove opencode scopre le cose** — percorsi e ordine per config, skill, agenti, comandi, plugin, istruzioni.
6. **Le skill (`SKILL.md`)** — frontmatter, caricamento, `permission.skill`, e l'equivalente di `${CLAUDE_PLUGIN_ROOT}`.
7. **Gli agenti (subagent)** — dichiarazione, `mode`, lancio, e quanta parte del confine è imposta.
8. **I comandi** — forma dei file e scoperta.
9. **La domanda all'utente (`question`)** — l'equivalente di `AskUserQuestion`.
10. **I plugin e l'API dei hook** — eventi, hook, registrazione, e se un plugin può negare un gesto.
11. **Configurazione, istruzioni e MCP** — `opencode.json`, file di istruzioni, server MCP.
12. **Aggiornamento e canale** — `upgrade`, `autoupdate`/`update`, cosa lo governa.
13. **CLI** — elenco dei sottocomandi.
14. **Evidenza locale** — comandi realmente eseguiti su questa macchina.
15. **Changelog e breaking changes** — V1 e il salto a V2.
16. **Sintesi delle marcature di versione e `[to verify]`**.

### Mappa dei nomi

| Nome | Dove vive la firma completa |
|---|---|
| `question` (tool) | §9 |
| `task` (tool) | §7 |
| `skill` (tool) | §6 |
| `tool()` (helper plugin) | §10 |
| `Plugin`, `PluginInput`, `Hooks` | §10 |
| `Question.Prompt` / `Option` / `Answer` / `Reply` | §9 |
| `permission` (regole `{action,resource,effect}`) | §7 |
| `agent` / `agents`, `mode` | §7 |

---

## 1. Meta e sorgenti

Convenzioni della nota:
- **verbatim** = copiato dalla fonte, non riscritto «a sentimento»;
- **`[to verify]`** = non confermato da una fonte letta o da un comando eseguito, con indicato cosa manca;
- **⚠️** = breaking change.

Fonti di **prima parte** (comandi eseguiti su questa macchina, 2026-10-03): `opencode --version`, `opencode --help`, `opencode <sottocomando> --help` per `plugin`, `models`, `run`, `session`, `debug`, `auth`, `mcp`, `upgrade`, `api`, `serve`, `acp`, `service`, `mini`, `pair`, `stats`; `opencode debug paths`, `opencode debug config`, `opencode debug agents`; `npm view` su `opencode-ai`, `@opencode-ai/plugin`, `@opencode-ai/sdk`, `@opencode/cli`; `gh release list -R sst/opencode`; `gh api repos/sst/opencode`.

Fonti **online** lette:
- Documentazione ufficiale: `https://opencode.ai/docs/` (linea V1) e `https://opencode.ai/v2/docs/` (linea V2); pagine `.md`: `/docs/{config,agents,commands,skills,permissions,plugins,cli,mcp-servers,rules,keybinds,tui,server}.md`; `https://opencode.ai/config.json`; `https://opencode.ai/install`; `https://opencode.ai/changelog`.
- Repository: `https://github.com/sst/opencode` (redirige a **`anomalyco/opencode`**; default branch `dev`, tag `v1.18.34` e tag `v2.0.16`…`v2.0.22`). File sorgente citati inline nelle sezioni.
- Terza parte: «Missing Manual» non ufficiale dei plugin, `https://github.com/joshuadavidthomas/opencode-plugins-manual` (commit `3efc95b`, **datato/invecchiato** rispetto a `dev`).

> Avvertenza sulla freschezza: `opencode.ai/docs` riflette la **V1**; `opencode.ai/v2/docs` la **V2**. La versione in uso (2.0.19) è V2, quindi la resa più fedele viene dal **binario installato** e dai **tag `v2.0.x`** del repository, non da `/docs`.

---

## 2. Modello di versione: le due linee V1 e V2

Esistono **due prodotti vivi**, con pacchetti npm, canali di rilascio e doc separati. È il fatto che condiziona tutto il resto.

| | **V1** (stabile pubblicata) | **V2** (installata qui) |
|---|---|---|
| pacchetto npm CLI | `opencode-ai` | `@opencode/cli` |
| npm `latest` | **1.18.34** (2026-09-30) | **2.0.22** |
| altri dist-tag npm | `beta`, `dev`, `next`, `tui-v2`, `latest-0`, `latest-1` | `beta`, `dev`, `reserved` |
| GitHub Release | `v1.18.34` … (unica lista) | **nessuna** — la 2.x esiste solo come **git tag** (`v2.0.16`…`v2.0.22`) |
| docs | `https://opencode.ai/docs` (banner: «New OpenCode v2 is now available») | `https://opencode.ai/v2/docs` |
| binario nativo | `opencode` | `opencode` (NON `opencode2`, come sostengono alcuni blog — smentiti dalla pagina ufficiale) |

Stato del caso:
- `npm view opencode-ai@2.0.19` → **404**; `opencode-ai` ha **zero** versioni `2.x`. La linea 2.x vive **solo** nel pacchetto `@opencode/cli`.
- `gh release list -R anomalyco/opencode -L 200` non contiene **nessuna** release `v2.*`; `releases/tags/v2.0.19` → 404. La 2.x esiste come tag git.
- La patch installata è **2.0.19**, dietro `@opencode/cli@2.0.22` (aggiornata lo stesso giorno). Nulla tra 2.0.19 e 2.0.22 è documentato in modo recuperabile. **`[to verify]`**: cosa cambia tra 2.0.19 e 2.0.22.

**Conseguenza operativa:** la versione in uso è la 2.0.19 (V2). Dove una firma qui sotto viene da sorgenti V1 (branch `dev` = 1.18.34, oppure `/docs`), è segnalato. Se si aggiorna oltre la 2.0.22 o si torna alla linea 1.18.x, le differenze sono in §15 (⚠️).

---

## 3. Concetti e modello mentale

- **Cos'è.** opencode è un agente di coding open source: un **server in background** più un client. Il binario `opencode` avvia la TUI interattiva; `opencode service` gestisce il server di background (`start`/`restart`/`status`/`stop`); `opencode serve` avvia «the v2 API and web server». `--standalone` esegue con un server privato invece che col servizio di background; `--server <url>` si connette a un server esistente.
- **Sessioni.** L'unità di conversazione è la **sessione**; `opencode session` la gestisce (`list`, `delete`, `export`, `import`). I subagent creano sessioni figlie (con `parentID`).
- **Le quattro estensioni.** opencode conosce quattro tipi di file, ciascuno con la sua cartella e il suo ordine di scoperta (§5):
  - **skill** — `SKILL.md`, caricate su richiesta dal modello tramite il tool `skill` (§6);
  - **agenti** — `.md` con frontmatter, primari o subagent, lanciati col tool `task` (§7);
  - **comandi** — `.md` che diventano slash-command (§8);
  - **plugin** — moduli TypeScript/JavaScript che si agganciano ai hook del server (§10).
- **Modello/fornitore.** Il modello si indica come `provider/model-id` (con `#variant` opzionale solo per alcuni contesti). I fornitori e i modelli si elencano con `opencode models`.

---

## 4. Installazione e distribuzione

**Non esiste** un «manifest» di opencode, né un marketplace, né un comando `opencode install`. La distribuzione è: script di installazione, package manager, binario diretto.

### 4.1 Installare opencode

**Linea V2** (quella in uso), verbatim dalla pagina `/v2/docs/`:

```bash
curl -fsSL https://opencode.ai/v2/install | bash
```

```bash
brew install anomalyco/tap/opencode-v2
npm install -g @opencode/cli
bun install -g --trust @opencode/cli
pnpm add -g --allow-build=@opencode/cli @opencode/cli
yarn global add @opencode/cli
vp install -g @opencode/cli
paru -S opencode-beta
```

- `@opencode/cli` richiede il **postinstall** per scegliere il binario di piattaforma (Bun/pnpm vogliono il permesso esplicito sugli script; Vite+ no).
- **I package manager Windows non sono supportati** (binari standalone/desktop scaricabili a parte).

**Linea V1** (per riferimento), dallo script `https://opencode.ai/install` — opzioni verbatim da `usage()`:

```
Usage: install.sh [options]
    -h, --help              Display this help message
    -v, --version <version> Install a specific version (e.g., 1.0.180)
    -b, --binary <path>     Install from a local binary instead of downloading
        --no-modify-path    Don't modify shell config files (.zshrc, .bashrc, etc.)
```

```bash
curl -fsSL https://opencode.ai/install | bash
curl -fsSL https://opencode.ai/install | bash -s -- --version 1.0.180
```

Lo script V1 installa in `INSTALL_DIR=$HOME/.opencode/bin` e scarica da `https://github.com/anomalyco/opencode/releases/latest/download/$filename` (o `…/download/v${requested_version}/$filename`); asset `opencode-<os>-<arch>[-baseline][-musl].<ext>` (`.zip` darwin/windows, `.tar.gz` linux; combo: `linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `windows-x64`). Package manager V1: `npm install -g opencode-ai`, `brew install anomalyco/tap/opencode`, `choco install opencode`, `scoop install opencode`, `docker run -it --rm ghcr.io/anomalyco/opencode`.

### 4.2 Distribuire un'estensione riusabile

Non c'è **registry né marketplace**. L'estensione è un **plugin**, dichiarato in uno dei due modi:

1. **File locale**, auto-caricato all'avvio: `.opencode/plugins/` (progetto) o `~/.config/opencode/plugins/` (globale). Percorsi e glob in §5.5.
2. **Pacchetto npm**, elencato nella chiave `plugin` (`plugins` in V2) di `opencode.json`. Forma verbatim:

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-helicone-session", "opencode-wakatime", "@my-org/custom-plugin"]
}
```

Il tipo di configurazione ammette anche una **tupla** `[pacchetto, opzioni]` (V2, `plugin`/`plugins`):

```typescript
export const Options = Schema.Record(Schema.String, Schema.Unknown)
export const Spec = Schema.Union([Schema.String, Schema.mutable(Schema.Tuple([Schema.String, Options]))])
```

I plugin npm sono «installed automatically using Bun at startup», con cache in `~/.cache/opencode/node_modules/`. Per usare dipendenze npm da un plugin locale serve un `package.json` nella cartella di configurazione (opencode esegue `bun install` all'avvio).

Comandi CLI (installati, v2.0.19, verificati live):

```
opencode plugin list      (--builtin  Include built-in server plugins)
opencode plugin add <package>     # "Install a plugin and add it to the global configuration"
                                  # ARGUMENTS: package = "npm registry or Git package specifier"
opencode plugin check [<target>]  # "Check package plugins for updates"
opencode plugin update [<target>] # "Update package plugins"
opencode plugin remove <package>  # "Remove a plugin from global configuration"
```

- `[to verify]`: la sintassi esatta dello **specifier Git** accettato da `plugin add` (l'help dice «npm registry or Git package specifier» ma non ne mostra il formato; la pagina `/docs/plugins` non lo nomina).
- I pacchetti npm che accompagnano la linea installata sono `@opencode-ai/plugin` (API dei plugin) e `@opencode-ai/sdk`, ma la loro `latest` è `1.18.34` (linea V1). **`[to verify]`**: quale pacchetto tipi usare per scrivere un plugin sulla 2.0.19 (vedi §15, ⚠️ API dei plugin riscritta in V2).

---

## 5. Dove opencode scopre le cose

Tutta questa sezione è letta dal sorgente al **tag `v2.0.19`** (la versione in uso); i file sono citati inline. Dove il sorgente contraddice la doc, prevale il sorgente (e la contraddizione è segnalata).

### 5.0 Radici

- `config` = `process.env.OPENCODE_CONFIG_DIR ?? path.join(XDG_CONFIG_HOME || ~/.config, "opencode")` → su questa macchina `C:\Users\tomas\.config\opencode` (confermato da `opencode debug paths`).
- `home` = `os.homedir()` (override `OPENCODE_TEST_HOME`).
- Le altre radici da `opencode debug paths`: `data` = `~/.local/share/opencode`, `cache` = `~/.cache/opencode`, `state` = `~/.local/state/opencode`, `tmp` = `%TEMP%\opencode`.

### 5.1 La risalita dal progetto

`packages/core/src/config/discovery.ts` (v2.0.19):
- nomi file: `export const names = ["opencode.json", "opencode.jsonc"]`;
- `globalRoots = [global.config, ~/.claude, ~/.agents]`;
- risalita: `fs.up({ targets: ["."], start: directory })` **senza `stop`** → dalla cwd **fino alla radice del filesystem** (V2). Per **ogni** directory antenata prova, in quest'ordine: `[".claude", ".agents", ".opencode", "opencode.jsonc", "opencode.json"]`.
  - Contraddizione: `skills.mdx`/`agents.mdx` dicono «from the current directory up to the project root», mentre il sorgente e `config.mdx` dicono «to the filesystem root». **`[to verify]`** quale limite vinca per skill/agenti.
- **`.claude` e `.agents` non sono voci di configurazione**: sono esposti solo via `compatibility()`, consumato dal solo plugin di compatibilità, **che gestisce solo le skill**. Conseguenza: **agenti, comandi e plugin non vengono mai letti da `.claude/…` né da `.agents/…` in V2.**

Ordine di merge della configurazione (basso→alto), `config.ts` `load()`:

```
1. wellknown (remoto ".well-known/opencode")
2. global config dir (~/.config/opencode) — il suo opencode.json(c) + la dir stessa
3. explicit file (OPENCODE_CONFIG)
4. direct project files opencode.json(c), dir più lontana → più vicina
5. project ".opencode" dirs (loro opencode.json(c) + la dir), più lontana → più vicina
6. inline content (OPENCODE_CONFIG_CONTENT)
```

`config.mdx` (V2): «every discovered `.opencode` config overrides every direct config».

### 5.2 Skill

`packages/core/src/config/plugin/skill.ts` (v2.0.19): per **ogni voce di directory** (`~/.config/opencode` e ogni `.opencode` di progetto) aggiunge `path.join(directory, "skill")` **e** `path.join(directory, "skills")`, con glob `{*.md,**/SKILL.md}`. Più la chiave `skills` (array di config: directory relative→cwd, `~/`→home, assolute; o URL `http(s)`).

Compatibilità: `config/plugin/compatibility.ts` — `[...roots.claude, ...roots.agents].map(root => path.join(root, "skills"))`.

| Ambito | Percorsi scanditi (verbatim) | Fonte |
|---|---|---|
| Globale (V2 nativo) | `~/.config/opencode/skills` (e `…/skill`) | skill.ts |
| Globale compat | `~/.claude/skills`, `~/.agents/skills` | compatibility.ts |
| Progetto (V2 nativo) | `<ancestor>/.opencode/skills` (e `…/skill`) | skill.ts |
| Progetto compat | `<ancestor>/.claude/skills`, `<ancestor>/.agents/skills` | compatibility.ts |
| Array di config | `skills: ["./team-skills","~/shared/opencode-skills","/opt/company-skills","https://example.com/opencode/skills/"]` | skill.ts / docs |
| Built-in | skill spedite col pacchetto | docs |

Forme di file accettate: `skills/review.md` (piatto, solo radice) **oppure** `skills/<id>/SKILL.md` (`SKILL.md` case esatto, a qualsiasi profondità).

Precedenza (basso→alto), `skills.mdx` (v2.0.19): `1. Built-in skills` → `2. .claude/skills` (globale, poi antenati lontani→corrente) → `3. .agents/skills` (idem) → `4. ~/.config/opencode/skills` → `5. Project .opencode/skills` (radice progetto→corrente) → `6. voci esplicite della config `skills``. Selezione per ID; vince la fonte più alta.

### 5.3 Agenti

`packages/core/src/config/plugin/agent.ts` (v2.0.19), per ogni voce di directory:
- `legacySources = [{ pattern: "{agent,agents}/**/*.md", primary: false }, { pattern: "{mode,modes}/*.md", primary: true }]`
- `sourceDirectories = ["agent", "agents", "mode", "modes"]`
- id agente = percorso relativo, con `replace(/^(agent|agents|mode|modes)\//, "").replace(/\.md$/, "")` (annidato → `team/reviewer`).

| Ambito | Percorsi (verbatim) |
|---|---|
| Globale | `~/.config/opencode/agents/<name>.md` (anche `agent/`) |
| Progetto | `.opencode/agents/<name>.md` (anche `agent/`; legacy `mode/`, `modes/`) |
| `.claude/agents`, `.agents/agents` | **non letti** |

Merge: «Later scalar values replace earlier values, request maps merge by key, and permission rules append» (`agents.mdx`). L'agente a livello più alto prevale.

### 5.4 Comandi

`packages/core/src/config/plugin/command.ts` (v2.0.19): pattern `{command,commands}/**/*.md`; nome = percorso relativo con prefisso `command(s)/` e `.md` rimossi (annidato → `/team/review`).

| Ambito | Percorsi (verbatim) |
|---|---|
| Globale | `~/.config/opencode/commands/<name>.md` |
| Progetto | `.opencode/commands/<name>.md` |
| `.claude/commands` | **non letti** |

Precedenza (`commands.mdx`): «Project sources take precedence over global sources, and nearer project sources take precedence over ancestor sources. A custom definition can also replace an earlier built-in command.»

### 5.5 Plugin (file locali)

`packages/core/src/plugin/source-directory.ts` (v2.0.19): `export const names = ["plugin", "plugins"]`. Un plugin locale è ogni figlio immediato `.ts`/`.js` o una directory/symlink (dir → entrypoint `package.json`). L'array `plugins` di config (pacchetti npm, `file://`, `./rel`, `-name` per rimuovere) è applicato **per ultimo**.

| Ambito | Percorsi (verbatim) |
|---|---|
| Globale | `~/.config/opencode/plugins/`, `~/.config/opencode/plugin/` |
| Progetto | `.opencode/plugins/`, `.opencode/plugin/` |
| `.claude` / `.agents` | **non letti** |

Glob sorgente V1 (per confronto), `packages/opencode/src/config/plugin.ts`: `Glob.scan("{plugin,plugins}/*.{ts,js}", …)` — solo `*.ts`/`*.js` di primo livello (niente `.mjs`, niente sottocartelle).

### 5.6 File di istruzioni

`packages/core/src/config/plugin/instruction.ts` (v2.0.19) legge **solo `AGENTS.md`**:
- globale: `~/.config/opencode/AGENTS.md`;
- progetto: risalita `targets: ["AGENTS.md"]` **limitata alla radice del progetto**;
- **nessun `CLAUDE.md`** — `instructions.mdx` (V2) è esplicito: «OpenCode V2 recognizes `AGENTS.md` only. It does not use `CLAUDE.md` as a fallback.» L'array `instructions` è accettato dallo schema ma **non risolto** in V2.

**V1** invece: risale per `AGENTS.md` e `CLAUDE.md` (vince `AGENTS.md`), più `~/.config/opencode/AGENTS.md` e i fallback `~/.claude/CLAUDE.md`, `~/.claude/skills/`; disattivabili con `OPENCODE_DISABLE_CLAUDE_CODE=1`, `OPENCODE_DISABLE_CLAUDE_CODE_PROMPT=1`, `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS=1`. Vedi §15 (⚠️).

### 5.7 Nomi singolari/plurali

Entrambi supportati ovunque; **il plurale è il default documentato**, il singolare è compatibilità. Costanti confermate dal sorgente: agenti `{agent,agents}` + `{mode,modes}`; comandi `{command,commands}`; plugin `["plugin","plugins"]`; skill `skill` **e** `skills`.

### 5.8 Riepilogo: cosa opencode legge da `.claude`/`.agents` (V2.0.19)

| Tipo | `.claude/…` | `~/.claude/…` | `.agents/…` | `~/.agents/…` |
|---|---|---|---|---|
| Skill | sì (`skills/`) | sì (`skills/`) | sì (`skills/`) | sì (`skills/`) |
| Agenti | no | no | no | no |
| Comandi | no | no | no | no |
| Plugin | no | no | no | no |
| Istruzioni | **no `CLAUDE.md`** | **no `CLAUDE.md`** | — | — |

---

## 6. Le skill (`SKILL.md`)

### 6.1 Frontmatter

Doc (`skills.mdx`): «Only these fields are recognized»:

- `name` (**required**)
- `description` (**required**)
- `license` (opzionale)
- `compatibility` (opzionale)
- `metadata` (opzionale, mappa stringa→stringa)

«Unknown frontmatter fields are ignored.» Esempio verbatim:

```markdown
---
name: git-release
description: Create consistent releases and changelogs
license: MIT
compatibility: opencode
metadata:
  audience: maintainers
  workflow: github
---

## What I do

- Draft release notes from merged PRs
- Propose a version bump
- Provide a copy-pasteable `gh release create` command

## When to use me

Use this when you are preparing a tagged release.
Ask clarifying questions if the target versioning scheme is unclear.
```

**Cosa il sorgente parsa davvero** (divergenza dalla doc):
- V1, `packages/opencode/src/skill/index.ts`: `isSkillFrontmatter` accetta solo `{ name: string; description?: string }`; `license`, `compatibility`, `metadata` **ignorati dal loader**. `description` è **opzionale nel codice** (la doc dice required) ma le skill **senza** description sono scartate dalla lista mostrata al modello.
- V2, `packages/core/src/skill.ts`: `Frontmatter = { name?: string; description?: string; slash?: boolean }` — `slash` è un campo riconosciuto (**non documentato**); `name` è opzionale con fallback al basename per un `<name>.md` piatto alla radice.

Regole sul nome (doc, verbatim):
- 1–64 caratteri;
- alfanumerico minuscolo con separatore di un solo trattino;
- non inizia/finisce con `-`; niente `--` consecutivi;
- **uguale al nome della cartella** che contiene `SKILL.md`.

Regex equivalente:

```text
^[a-z0-9]+(-[a-z0-9]+)*$
```

`description`: 1–1024 caratteri.

Divergenza nota: **il loader non confronta nome e cartella** — al tag `v1.18.34` `NameMismatchError` è dichiarato ma costruito **solo nei test**, non lanciato dal loader; il loader V2 nemmeno confronta. **`[to verify]`** se un altro percorso (es. indici da URL) imponga la corrispondenza.

### 6.2 Scoperta e caricamento

Percorsi (doc, verbatim): `.opencode/skills/<name>/SKILL.md`, `~/.config/opencode/skills/<name>/SKILL.md`, `.claude/skills/<name>/SKILL.md`, `~/.claude/skills/<name>/SKILL.md`, `.agents/skills/<name>/SKILL.md`, `~/.agents/skills/<name>/SKILL.md` (la tabella completa in §5.2).

Il modello carica una skill con il tool nativo `skill`, il cui input è un solo campo stringa:

```typescript
Input = { name: string }   // skill({ name: "git-release" })
```

La lista delle skill disponibili è resa come blocco `available_skills`. Doc, verbatim:

```xml
<available_skills>
  <skill>
    <name>git-release</name>
    <description>Create consistent releases and changelogs</description>
  </skill>
</available_skills>
```

**Divergenza su dove vive la lista:** la doc dice che opencode elenca le skill «in the `skill` tool description»; il sorgente V2 la inietta come **blocco di system prompt** (chiave `core/skill-guidance`, `packages/core/src/skill/guidance.ts`), mentre la descrizione statica del tool V1 (`packages/opencode/src/tool/skill.txt`) rimanda al system prompt.

Al caricamento, l'output del tool **inietta la directory della skill** (verbatim dal sorgente):

```
<skill_content name="...">
# Skill: ...
<content>
Base directory for this skill: <abs dir of SKILL.md>
Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.
Note: file list is sampled.
<skill_files>
<file>...</file>   (fino a 10 file sotto la dir della skill, SKILL.md escluso; v1 → path assoluti)
</skill_files>
</skill_content>
```

### 6.3 `permission.skill`

Forma JSON (doc, verbatim):

```json
{
  "permission": {
    "skill": {
      "*": "allow",
      "pr-review": "allow",
      "internal-*": "deny",
      "experimental-*": "ask"
    }
  }
}
```

| Permesso | Comportamento |
|---|---|
| `allow` | la skill si carica subito |
| `deny` | la skill è **nascosta** all'agente, accesso rifiutato |
| `ask` | l'utente è invitato ad approvare prima del caricamento |

Pattern con wildcard (`internal-*`); il match è sul **nome della skill**. Override per-agente:
- agente custom, frontmatter:
  ```yaml
  ---
  permission:
    skill:
      "documents-*": "allow"
  ---
  ```
- agente built-in, `opencode.json`:
  ```json
  { "agent": { "plan": { "permission": { "skill": { "internal-*": "allow" } } } } }
  ```

Disabilitare il tool: agente custom `tools:\n  skill: false`; built-in `agent.<name>.tools.skill: false`. «When disabled, the `<available_skills>` section is omitted entirely.»

### 6.4 DECISIVO: esiste un equivalente di `${CLAUDE_PLUGIN_ROOT}`? — **No.**

- `CLAUDE_PLUGIN_ROOT` **non esiste** in `anomalyco/opencode`: ricerca codice GitHub = `0` risultati (su `dev` e `v1.18.34`); assente dalle pagine di doc.
- L'unico identificatore simile è un campo minuscolo `plugin_root` in `packages/opencode/src/plugin/tui/runtime.ts` — bookkeeping interno dei temi TUI, **non esposto alle skill**.
- **Nessuna interpolazione di variabili nel contenuto di `SKILL.md`**: entrambi i loader salvano `markdown.content` verbatim. La sostituzione `{env:VAR}` esiste **solo** nei valori di `opencode.json`.

Cosa può usare davvero una skill per raggiungere i file che spedisce:
- **la base directory iniettata** — al caricamento il modello riceve `Base directory for this skill: <abs dir containing SKILL.md>` e l'istruzione che i path relativi (`scripts/`, `reference/`) sono relativi a quella base. Quindi una `SKILL.md` riferisce i propri file con path **relativi**; l'ancora assoluta la fornisce l'host;
- **la lista campionata** dei file (fino a 10) sotto la dir della skill;
- **path relativi al progetto e cwd** (i tool girano sul progetto);
- **variabili d'ambiente** solo quelle del processo opencode (`OPENCODE_CONFIG`, `OPENCODE_CONFIG_DIR`, `OPENCODE_CONFIG_CONTENT`, `OPENCODE_PERMISSION`, `OPENCODE_DISABLE_PROJECT_CONFIG`, …): configurano l'host, **non** puntano alla radice del pacchetto di una skill né di un plugin.

Come un **plugin** spedisce skill (dato che non c'è la variabile di root): **non** droppando file nel pacchetto (i file di un plugin non sono scanditi per `SKILL.md`), ma **registrando in codice una sorgente** con l'API V2 — hook `ctx.skill.transform` + `ctx.skill.reload`. Il tipo `SkillV2Source` (`packages/schema/src/skill.ts`):

```typescript
{ type: "directory", path: AbsolutePath }
{ type: "url", url: string }
{ type: "embedded", skill: { name, description?, slash?, location: AbsolutePath, content: string } }
```

Un plugin che spedisce una skill deve calcolare da sé la propria directory (es. `import.meta.url`) e registrare una sorgente `directory`, oppure incorporare il contenuto come `embedded`. **`[to verify]`**: se l'API plugin V1 (non-effect) esponga un hook per le skill — una ricerca di `skill` in `packages/plugin/src/index.ts` a `v1.18.34` non ne trova.

---

## 7. Gli agenti (subagent)

### 7.1 Dichiarazione

Due modi, stessa schema (`ConfigAgentV1.Info`).

**A. File Markdown.** Il nome file = nome agente (`review.md` → `review`); il corpo è il system prompt (`prompt: md.content.trim()`); il frontmatter è la config. Percorsi di scoperta in §5.3.

Esempio verbatim (doc):

```markdown
---
description: Reviews code for quality and best practices
mode: subagent
model: anthropic/claude-sonnet-4-20250514
temperature: 0.1
permission:
  edit: deny
  bash: deny
---

You are in code review mode. ...
```

Esempio reale col `tools` deprecato, da `.opencode/agent/triage.md` del repo:

```yaml
---
mode: primary
hidden: true
model: opencode/gpt-6-luna
color: "#44BA81"
tools:
  "*": false
  "github-triage": true
---
```

**B. `opencode.json`, chiave `agent` (singolare, non `agents`).**

```json
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "code-reviewer": {
      "description": "Reviews code for best practices and potential issues",
      "mode": "subagent",
      "model": "anthropic/claude-sonnet-4-20250514",
      "prompt": "You are a code reviewer. ...",
      "permission": { "edit": "deny" }
    }
  }
}
```

Campi dello schema (verbatim, `packages/core/src/v1/config/agent.ts`):

```
model:     optional String
variant:   optional String   // "Default model variant for this agent (applies only when using the agent's configured model)."
temperature: optional Finite
top_p:     optional Finite
prompt:    optional String
tools:     optional Record<String, Boolean>   // "@deprecated Use 'permission' field instead"
disable:   optional Boolean
description: optional String   // "Description of when to use the agent"
mode:      optional Literals(["subagent", "primary", "all"])
hidden:    optional Boolean    // "Hide this subagent from the @ autocomplete menu (default: false, only applies to mode: subagent)"
options:   optional Record<String, Any>
color:     optional (hex "#RRGGBB" o uno di primary|secondary|accent|success|warning|error|info)
steps:     optional PositiveInt   // "Maximum number of agentic iterations before forcing text-only response"
maxSteps:  optional PositiveInt   // "@deprecated Use 'steps' field instead."
permission: optional ConfigPermissionV1.Info
// ogni chiave sconosciuta finisce in `options`
```

### 7.2 `mode`: valori e default reale

Enum esatto: `["subagent", "primary", "all"]`.

**Default reale quando `mode` è omesso: `"all"`** — non `subagent`. Sorgente `agent.ts`:

```js
item = agents[key] = { name: key, mode: "all", permission: Permission.merge(defaults, user), options: {}, native: false }
...
item.mode = value.mode ?? item.mode
```

Quindi un agente markdown/JSON **senza `mode`** è `all` = selezionabile come primario **e** invocabile come subagent. Per renderlo solo-subagent serve `mode: subagent` esplicito.

- **`primary`** — agente principale (ciclo Tab), non invocabile come subagent.
- **`subagent`** — invocabile solo via tool `task` / menzione `@`.
- **`all`** — entrambi.

Altri campi:
- **`hidden`** — nasconde il subagent dal menu `@` (default `false`, solo per `mode: subagent`); blocca anche l'uso come `default_agent`.
- **`model`** — `provider/model-id`. Se omesso: i primari usano il modello globale; **i subagent ereditano il modello del primario che li invoca**.
- **`variant`** — variante del modello; «applies only when using the agent's configured model».
- **`steps`** — iterazioni agentiche massime (lascito `maxSteps` normalizzato); al limite parte un prompt forzato text-only.
- **`permission`** — §7.4.
- **`prompt`** — stringa inline, o `{file:./path}` relativo al file di config; per markdown, il corpo.
- **`disable`** (`disabled` in V2) — `true` elimina l'agente.
- **`tools`** — **deprecato**; `true` ≡ `{"*": "allow"}`, `false` ≡ `{"*": "deny"}`.
- **`reasoningEffort`** — **non è un campo agente**: si imposta via `options` (es. `"options": { "reasoningEffort": "high" }`) o scegliendo una `variant`. **`[to verify]`**: nessuna chiave `reasoningEffort` a livello agente nello schema parsato.

### 7.3 Come il padre lancia un subagent

Tool **`task`** (`packages/opencode/src/tool/task.ts`). Parametri verbatim:

```
description:   String   // "A short (3-5 words) description of the task"
prompt:        String   // "The task for the agent to perform"
subagent_type: String   // "The type of specialized agent to use for this task"
task_id:       optional String  // resume a previous subagent session
command:       optional String
background:    optional Boolean  // experimental; requires OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true
```

`execute` risolve l'agente per nome, crea una sessione figlia (`parentID`, `agent: next.name`), passa il ruleset di permessi risolto. Il risultato torna avvolto in `<task id=… state=…><task_result>…</task_result></task>`.

**La menzione `@nome`** è un secondo punto d'ingresso ma **non** un percorso separato: in `session/prompt.ts` un token `@x` che non è un file ma corrisponde a un agente diventa `{ type: "agent", name }` e il resolver inietta un testo sintetico: «Use the above message and context to generate a prompt and call the task tool with subagent: <name>». Quindi **`@nome` è prosa**: chiede al modello di chiamare `task`; solo il modello obbedisce.

### 7.4 DECISIVO: quanta parte del confine è imposta dal codice

**Verdetto: i confini che contano sono imposti dal codice, non dal prompt. Un subagent read-only è un confine reale.** Meccanica, con prove.

Modello dei permessi: un ruleset è un array di regole `{ action, resource, effect }` con `effect ∈ {"allow","ask","deny"}`. Risoluzione **last-match-wins** (`packages/opencode/src/permission/index.ts`):

```ts
rulesets.flat().findLast(rule => Wildcard.match(permission, rule.permission) && Wildcard.match(pattern, rule.pattern))
  ?? { action: "ask", permission, pattern: "*" }
```

Default permissivi; `doom_loop` ed `external_directory` default `"ask"`; `--auto` auto-approva gli `ask` ma «Explicit deny rules are still enforced».

Tre livelli di imposizione, tutti nel codice:
1. **Rimozione del tool.** `session/llm/request.ts` `resolveTools()` toglie dalla lista dei tool del modello qualunque tool la cui regola sia `pattern === "*"` con `action === "deny"`. Quindi `edit: deny` significa che `edit`/`write`/`apply_patch` **non vengono mai dati al modello**. Limite: la rimozione scatta solo per un deny a pattern esattamente `*`; un deny **granulare** (es. `read: {"*.env.*": "deny"}`) mantiene il tool e impone al momento della chiamata.
2. **Assert a runtime.** Ogni tool sostanziale chiama `ctx.ask({ permission, patterns, … })` prima di agire; un `deny` lancia `PermissionDeniedError`.
3. **Gating della delega.** Il tool `task` chiama `ctx.ask({ permission: "task"|"subagent", patterns: [subagent_type] })`; un deny lancia. `ToolRegistry.describeTask` filtra i subagent negati dalla descrizione del tool.

**Chiavi dei permessi** (doc `/docs/permissions`): `read`, `edit`, `glob`, `grep`, `list`, `bash`, `task` (→ **`subagent`** in v2.0.19), `skill`, `lsp`, `question`, `webfetch`, `websearch`, `external_directory`, `doom_loop`. **Azioni** (V1, `packages/core/src/v1/config/permission.ts`):

```ts
Action = Literals(["ask", "allow", "deny"])
```

**Nome dell'azione di delega — divergenza.** La doc e il sorgente corrente (`dev`) usano **`task`**; l'installato **v2.0.19** usa **`subagent`** (provato da `opencode debug agents`: `explore` e `general` portano `{ "action": "subagent", "resource": "*", "effect": "deny" }`). Scrivere **`subagent`** su 2.0.19, `task` sulla linea V1.

**Enforcement del «leaf» (subagent annidati).** `packages/opencode/src/agent/subagent-permissions.ts` costruisce il ruleset della sessione figlia aggiungendo per default `{ permission: "task"|"subagent", pattern: "*", action: "deny" }` (e `todowrite` deny) **a meno che** il subagent non permetta già `task`. Risultato: un subagent non può generare nipoti se non gli è esplicitamente concesso.

**`subagent_depth` è reale.** Chiave di config (V1), default `1`. Imposto in `task.ts` risalendo la catena `parentID`: `if (depth >= (cfg.subagent_depth ?? 1)) fail("Subagent depth limit reached …")`. `0` vieta ogni lancio, `2` consente un livello di annidamento. **`[to verify]`** in V2: la migrazione dichiara `subagent_depth` «accepted but ignored with warning».

**Cosa è prosa, non confine:** la menzione `@nome`; la guida del tool `task` («launch multiple agents concurrently»); la visibilità `hidden`; le descrizioni. `permission.task` **sì** controlla quali subagent possono essere invocati (non è solo una lista).

**Evidenza locale (v2.0.19, `opencode debug agents`):**
- `plan` (primario, read-only): `{action:"edit",resource:"*",effect:"deny"}` + `{action:"edit",resource:"C:\\Users\\tomas\\.opencode\\plan\\*",effect:"allow"}`; `question` allow.
- `explore` (subagent): `{"*","*",deny}` poi riabilita `grep`,`glob`,`webfetch`,`websearch`,`read`, più `{action:"subagent",resource:"*",effect:"deny"}` → leaf, non edita, non esegue bash.
- `general` (subagent): `{action:"question",deny}` e `{action:"subagent",deny}` → leaf che non può chiedere all'utente.
- `build` (primario): `{action:"question",allow}`.

**Divergenze V2 sull'agente:** `explore` in v2.0.19 è più chiuso che in `dev` (che riabilita anche `bash`/`list`); `scout` è documentato ma **assente** in v2.0.19 (`debug agents` elenca solo `explore` e `general`). **`[to verify]`**: se `scout` esista sulla linea V1 o solo su build più nuove.

---

## 8. I comandi

Comandi come file `.md` sotto `.opencode/commands/` o `~/.config/opencode/commands/` (scoperta in §5.4). Frontmatter (doc): `description`, `model`, ecc.; opencode risolve i comandi **per nome file a runtime**. Il segnaposto **`$ARGUMENTS`** abilita comandi parametrizzati. I comandi marcati `disableModelInvocation: true` sono saltati in conversione. In alternativa, la chiave `command`/`commands` in `opencode.json`.

---

## 9. La domanda all'utente (`question`)

**Risposta: SÌ.** opencode ha un tool strutturato di domande, chiamato **`question`**. Non è solo chat.

- Registrato come `"question"` (`Tool.define<...>("question", …)` in V1; `export const name = "question"` in V2).
- Il modello lo emette come **normale tool call** del provider, con argomenti JSON. Il server la trasforma in un evento `question.asked`/`question.v2.asked` e attende; il client risponde fuori banda via HTTP. Il tool restituisce al modello (verbatim): `User has answered your questions: "Q1"="A1", "Q2"="A2". You can now continue with the user's answers in mind.`
- Schema parametri verbatim (identico nelle due linee):

```ts
export const Parameters = Schema.Struct({
  questions: Schema.mutable(Schema.Array(Question.Prompt)).annotate({ description: "Questions to ask" }),
})
```

```ts
export const Option = Schema.Struct({
  label: Schema.String.annotate({ description: "Display text (1-5 words, concise)" }),
  description: Schema.String.annotate({ description: "Explanation of choice" }),
})

const base = {
  question: Schema.String.annotate({ description: "Complete question" }),
  header: Schema.String.annotate({ description: "Very short label (max 30 chars)" }),
  options: Schema.Array(Option).annotate({ description: "Available choices" }),
  multiple: Schema.Boolean.pipe(optional).annotate({ description: "Allow selecting multiple choices" }),
}

export const Prompt = Schema.Struct(base)
export const Answer = Schema.Array(Schema.String)
export const Reply = Schema.Struct({
  answers: Schema.Array(Answer).annotate({
    description: "User answers in order of questions (each answer is an array of selected labels)",
  }),
})
```

JSON che il modello invia:

```json
{
  "questions": [
    {
      "question": "Which database should the feature use?",
      "header": "Database",
      "options": [
        { "label": "SQLite (Recommended)", "description": "Zero-config, embeds in the repo" },
        { "label": "Postgres", "description": "Server-based, needs a running service" }
      ],
      "multiple": false
    }
  ]
}
```

Note dal sorgente: `question`, `header`, `options` **richiesti**; `multiple` opzionale (assente/false = singola scelta); `label` e `description` **richiesti**; **nessun min/max di schema** sul numero di domande/opzioni (contrariamente ad `AskUserQuestion` di Claude Code, che impone 1–4 domande e 2–4 opzioni — **da verificare** se la TUI ponga cap propri); `header` max 30 caratteri; le risposte tornano sempre come **array di label**. Il campo interno `custom` («Allow typing a custom answer (default: true)») **non è esposto** allo schema del modello; la descrizione del tool dice che con `custom` attivo viene aggiunta una voce «Type your own answer» e invita a mettere `(Recommended)` in coda all'etichetta dell'opzione consigliata.

**Permesso che lo governa:** azione **`question`**, valori `allow`/`ask`/`deny` (shorthand only, nessun oggetto per-path). Config:

```json
{ "$schema": "https://opencode.ai/config.json", "permission": { "question": "ask" } }
```

Significato: `allow` = nessuna approvazione, la domanda strutturata si mostra subito; `ask` = prima un prompt di approvazione permesso (`once`/`always`/`reject`), poi la domanda; `deny` = azione bloccata (in V2 la call fallisce con `ToolFailure: Permission denied: question`) e il modello deve ripiegare sulla chat. Default built-in (confermato da sorgente e da `debug agents`): `build → allow`, `plan → allow`, `general → deny`.

**Superficie HTTP** (per far rispondere qualsiasi client): V2 `GET /api/question/request`, `GET /api/session/:sessionID/question`, `POST /api/session/:sessionID/question/:requestID/reply` (body `{ "answers": [["label"], ...] }`, `204`), `POST /api/session/:sessionID/question/:requestID/reject` (`204`). Non esiste un sottocomando CLI per chiedere: è solo un tool a runtime.

---

## 10. I plugin e l'API dei hook

> Scritto per chi scrive un plugin sull'**API piatta `@opencode-ai/plugin`** (export `Plugin` + oggetto hook) — la linea che le fonti lette documentano. La V2 ha una **seconda architettura plugin, diversa e non pubblicata**, vedi §15 ⚠️.

### 10.1 Registrazione

Due percorsi (doc):
1. **File locali**, auto-caricati all'avvio: `.opencode/plugins/` (progetto) o `~/.config/opencode/plugins/` (globale); percorsi e glob in §5.5.
2. **Pacchetti npm** elencati nella chiave `plugin` (`plugins` in V2) di `opencode.json` (forma in §4.2).

**Ordine di caricamento** (doc, verbatim): `1.` config globale → `2.` config di progetto → `3.` dir plugin globale → `4.` dir plugin di progetto. I hook girano in sequenza; pacchetti npm identici (nome+versione) caricano una volta; un plugin locale e uno npm con nome simile caricano entrambi.

Dipendenze: un plugin locale che importa pacchetti npm richiede un `package.json` nella dir di config (opencode esegue `bun install` all'avvio).

### 10.2 Modulo e contesto

`packages/plugin/src/index.ts` (verbatim):

```typescript
export type PluginInput = {
  client: ReturnType<typeof createOpencodeClient>
  project: Project
  directory: string
  worktree: string
  experimental_workspace: {
    register(type: string, adapter: WorkspaceAdapter): void
  }
  serverUrl: URL
  $: BunShell
}

export type PluginOptions = Record<string, unknown>

export type Plugin = (input: PluginInput, options?: PluginOptions) => Promise<Hooks>

export type PluginModule = {
  id?: string
  server: Plugin
  tui?: never
}
```

Uso (doc, verbatim):

```typescript
import type { Plugin } from "@opencode-ai/plugin"

export const MyPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  return {
    // Type-safe hook implementations
  }
}
```

Nota: la doc nomina solo `{ project, client, $, directory, worktree }`; il `PluginInput` reale porta anche `serverUrl: URL` e `experimental_workspace`. Log strutturato: `await client.app.log({ body: { service, level, message, extra } })`, livelli `debug|info|warn|error`.

### 10.3 Elenco completo dei hook

Verbatim dall'interfaccia `Hooks`, `packages/plugin/src/index.ts` (dev):

```typescript
export interface Hooks {
  dispose?: () => Promise<void>
  event?: (input: { event: Event }) => Promise<void>
  config?: (input: Config) => Promise<void>
  tool?: {
    [key: string]: ToolDefinition
  }
  auth?: AuthHook
  provider?: ProviderHook
  /** Called when a new message is received */
  "chat.message"?: (
    input: {
      sessionID: string
      agent?: string
      model?: { providerID: string; modelID: string }
      messageID?: string
      variant?: string
    },
    output: { message: UserMessage; parts: Part[] },
  ) => Promise<void>
  /** Modify parameters sent to LLM */
  "chat.params"?: (
    input: { sessionID: string; agent: string; model: Model; provider: ProviderContext; message: UserMessage },
    output: {
      temperature: number
      topP: number
      topK: number
      maxOutputTokens: number | undefined
      options: Record<string, any>
    },
  ) => Promise<void>
  "chat.headers"?: (
    input: { sessionID: string; agent: string; model: Model; provider: ProviderContext; message: UserMessage },
    output: { headers: Record<string, string> },
  ) => Promise<void>
  "permission.ask"?: (input: Permission, output: { status: "ask" | "deny" | "allow" }) => Promise<void>
  "command.execute.before"?: (
    input: { command: string; sessionID: string; arguments: string },
    output: { parts: Part[] },
  ) => Promise<void>
  "tool.execute.before"?: (
    input: { tool: string; sessionID: string; callID: string },
    output: { args: any },
  ) => Promise<void>
  "shell.env"?: (
    input: { cwd: string; sessionID?: string; callID?: string },
    output: { env: Record<string, string> },
  ) => Promise<void>
  "tool.execute.after"?: (
    input: { tool: string; sessionID: string; callID: string; args: any },
    output: { title: string; output: string; metadata: any },
  ) => Promise<void>
  "experimental.chat.messages.transform"?: (
    input: {},
    output: { messages: { info: Message; parts: Part[] }[] },
  ) => Promise<void>
  "experimental.chat.system.transform"?: (
    input: { sessionID?: string; model: Model },
    output: { system: string[] },
  ) => Promise<void>
  "experimental.provider.small_model"?: (input: { provider: ProviderV2 }, output: { model?: ModelV2 }) => Promise<void>
  "experimental.session.compacting"?: (
    input: { sessionID: string },
    output: { context: string[]; prompt?: string },
  ) => Promise<void>
  "experimental.compaction.autocontinue"?: (
    input: { sessionID: string; agent: string; model: Model; provider: ProviderContext; message: UserMessage; overflow: boolean },
    output: { enabled: boolean },
  ) => Promise<void>
  "experimental.text.complete"?: (
    input: { sessionID: string; messageID: string; partID: string },
    output: { text: string },
  ) => Promise<void>
  /** Modify tool definitions (description and parameters) sent to LLM */
  "tool.definition"?: (input: { toolID: string }, output: { description: string; parameters: any }) => Promise<void>
}
```

Per categoria:

| Categoria | Hook |
|---|---|
| config | `config` |
| tool | `tool` (tool custom), `tool.execute.before`, `tool.execute.after`, `tool.definition` |
| chat | `chat.message`, `chat.params`, `chat.headers` |
| command | `command.execute.before` |
| permission | `permission.ask` (**dichiarato, non cablato** — §10.5) |
| event | `event` |
| shell | `shell.env` |
| experimental | `experimental.chat.messages.transform`, `experimental.chat.system.transform`, `experimental.provider.small_model`, `experimental.session.compacting`, `experimental.compaction.autocontinue`, `experimental.text.complete` |
| lifecycle/auth/provider | `dispose`, `auth`, `provider` |
| tui | **nessun hook `tui`** in questa interfaccia: la TUI è un'API a parte (`packages/plugin/src/tui.ts`) |

### 10.4 Elenco completo degli eventi

Un plugin si iscrive col solo hook `event` e filtra su `event.type`. Il runtime consegna `{ event: { id, type, properties } }`.

**Eventi legacy V1** (i nomi che la doc ufficiale elenca):

```
command.executed
message.part.delta
message.part.removed
message.part.updated
message.removed
message.updated
permission.asked
permission.replied
question.asked
question.rejected
question.replied
session.created
session.deleted
session.diff
session.error
session.updated
```

**Eventi V2 / correnti:**

```
catalog.updated
file.edited
file.watcher.updated
global.disposed
ide.installed
installation.updated
integration.connection.updated
integration.updated
lsp.updated
mcp.browser.open.failed
mcp.tools.changed
permission.v2.asked
permission.v2.replied
plugin.added
project.directories.updated
project.updated
pty.created
pty.deleted
pty.exited
pty.updated
question.v2.asked
question.v2.rejected
question.v2.replied
reference.updated
server.connected
session.compacted
session.idle
session.next.agent.switched
session.next.compaction.delta
session.next.compaction.ended
session.next.compaction.started
session.next.context.updated
session.next.model.switched
session.next.moved
session.next.prompt.admitted
session.next.prompted
session.next.reasoning.delta
session.next.reasoning.ended
session.next.reasoning.started
session.next.retried
session.next.revert.cleared
session.next.revert.committed
session.next.revert.staged
session.next.shell.ended
session.next.shell.started
session.next.step.ended
session.next.step.failed
session.next.step.started
session.next.synthetic
session.next.text.delta
session.next.text.ended
session.next.text.started
session.next.tool.called
session.next.tool.failed
session.next.tool.input.delta
session.next.tool.input.ended
session.next.tool.input.started
session.next.tool.progress
session.next.tool.success
session.status
todo.updated
tui.command.execute
tui.prompt.append
tui.session.select
tui.toast.show
vcs.branch.updated
workspace.failed
workspace.ready
workspace.status
worktree.failed
worktree.ready
```

Payload letti verbatim (dev):
- `file.edited` → `{ file: string }`;
- `file.watcher.updated` → `{ file: string, event: "add" | "change" | "unlink" }`;
- `lsp.updated` → `{}` — **`lsp.client.diagnostics` non esiste in dev**; la lista LSP della doc ufficiale è invecchiata;
- `permission.asked` → `{ id, sessionID, permission, patterns, metadata, always, tool? }`; `permission.replied` → `{ sessionID, requestID, reply: "once"|"always"|"reject" }`.

**Attenzione:** la doc ufficiale mette `shell.env`, `tool.execute.before`, `tool.execute.after` sotto «Events» — sono **hook, non eventi**; non iscriversi a essi via `event`. **`[to verify]`**: se 1.18.34 emetta ancora `lsp.client.diagnostics`; e gli schemi esatti degli eventi `session.next.*`, `workspace.*`, `worktree.*`, `mcp.*`, `catalog.*`, `integration.*`, `question.*`.

### 10.5 DECISIVO: un plugin può negare un gesto?

**Sì — un plugin può bloccare una tool call e un comando, ma solo LANCIANDO un'eccezione. Non c'è un campo di ritorno né un «deny» su quegli hook.**

**`tool.execute.before` blocca lanciando.** Firma (verbatim): `(input, output) => Promise<void>` con `output: { args: any }`; **nessun campo deny**. Esempio dalla doc:

```javascript
export const EnvProtection = async ({ project, client, $, directory, worktree }) => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool === "read" && output.args.filePath.includes(".env")) {
        throw new Error("Do not read .env files")
      }
    },
  }
}
```

Meccanismo, dal sorgente: `plugin.trigger("tool.execute.before", …, { args })` eseguito senza try/catch → un throw **aborta il generatore prima di `item.execute`**; la Promise viene rigettata e la tool call fallisce con il messaggio d'errore, che il modello vede. **Il tool non esegue; la sessione sopravvive; `tool.execute.after` non scatta** per quella chiamata. La classe d'errore è **`Error` semplice** — nessuna classe speciale richiesta.

**`command.execute.before` — idem, blocca lanciando.** Triggerato appena prima di eseguire il comando; un throw annulla la sottomissione. `output` è `{ parts: Part[] }` (si possono invece *riscrivere* i parts senza lanciare).

**`permission.ask` — dichiarato ma NON cablato; un plugin non può fissare l'esito qui.** Nel sorgente corrente la stringa `"permission.ask"` compare **solo** nella dichiarazione del tipo; `packages/opencode/src/permission/index.ts` fa solo valutazione di ruleset e **non** chiama mai `plugin.trigger("permission.ask", …)`. Conclusione: **`output.status` non ha effetto a questo commit. Non basarci il gating — blocca in `tool.execute.before` lanciando.** Il tipo `Permission` (SDK) **non ha `tool`/`args`**, contrariamente all'esempio del Missing Manual (invecchiato).

**Isolamento degli errori:** `plugin.trigger` non ha try/catch per-hook, quindi un throw in **qualsiasi** hook trigger-based (`tool.execute.before`, `chat.message`, `chat.params`, `chat.headers`, `shell.env`, `command.execute.before`, `experimental.*`) aborta quel flusso. Sono catturati-e-loggati solo: il **load** del plugin, l'hook **`config`**, e l'hook **`event`** (fire-and-forget). La rivendicazione del Missing Manual «Hook errors ARE caught» vale solo per `event`.

**Mappatura Claude Code → opencode** (dal manual, comportamento confermato dal sorgente):

| Claude Code | opencode |
|---|---|
| `PreToolUse` | `tool.execute.before` (deny = **throw**) |
| `PostToolUse` | `tool.execute.after` |
| `PermissionRequest` | `permission.ask` — **dichiarato ma non cablato in dev**; usare `tool.execute.before` |
| `UserPromptSubmit` | `chat.message` |
| `SessionStart` / `SessionEnd` | hook `event` + `session.created` / `session.idle` |
| `PreCompact` | `event` + `session.compacted`, o hook `experimental.session.compacting` |
| `Notification` | `event` + `tui.toast.show` |
| `Stop` / `SubagentStop` | nessun equivalente |
| `hooks.json` (comandi shell) | funzioni TypeScript |
| `${CLAUDE_PLUGIN_ROOT}` | `ctx.directory` (o `import.meta.url`) |

### 10.6 Tool custom

`packages/plugin/src/tool.ts` (verbatim):

```typescript
export function tool<Args extends z.ZodRawShape>(input: {
  description: string
  args: Args
  execute(args: z.infer<z.ZodObject<Args>>, context: ToolContext): Promise<ToolResult>
}) {
  return input
}
tool.schema = z
export type ToolDefinition = ReturnType<typeof tool>
```

`ToolContext` = `{ sessionID, messageID, agent, directory, worktree, abort: AbortSignal, metadata(...), ask(input: AskInput): Promise<void> }`. Si registra via l'hook `tool`; un tool che condivide il nome di un built-in **prevale**.

---

## 11. Configurazione, istruzioni e MCP

### 11.1 File e precedenza

**V2:** globale `~/.config/opencode/opencode.json(c)`; progetto `<project>/opencode.json(c)` **o** `<project>/.opencode/opencode.json(c)`. JSON **e** JSONC. `$schema`: `"https://opencode.ai/config.json"`. Ordine di risalita e di merge: §5.1. Merge per chiave (non replace).

**V1** (per la doc `/docs`): stesse posizioni; env `OPENCODE_CONFIG` (file, tra globale e progetto), `OPENCODE_CONFIG_DIR`, `OPENCODE_CONFIG_CONTENT`, `OPENCODE_TUI_CONFIG`. Precedenza: `.well-known/opencode` remoto → globale → `OPENCODE_CONFIG` → progetto → `.opencode` → `OPENCODE_CONFIG_CONTENT` → file gestiti (`%ProgramData%\opencode` su Windows) → MDM macOS.

### 11.2 Chiavi (V2, dalla pagina `/v2/docs/config` + tabella di migrazione)

`shell` · `model` (`provider/model`) · `default_agent` · `update` (`"disable"|"notify"|"auto"`, default `"notify"`, solo globale) · `share` (`"manual"|"auto"|"disabled"`) · `username` · `permissions` (array ordinato di `{action, resource, effect}`) · `agents` (mappa: `description`, `mode`, `system`, `permissions`) · `snapshots` · `watcher` (`{ignore:[...]}`) · `formatter` (bool) · `media.image` · `tool_output` · `websearch` · `mcp.servers` · `compaction` · `warming` · `skills` (array dir/URL) · `commands` · `instructions` · `references` · `worktree.directory` · `plugins` (array di `string` o `{package, options}`) · `providers` · `experimental.policies`.

**Chiavi V1** (per la linea `/docs`): `mcp` (server direttamente sotto `mcp`), `permission` + `tools`, `plugin` (array di nomi npm), `instructions` (array **caricato**), `skills: {paths, urls}`, `subagent_depth` (default 1), `share`, `autoupdate`, `compaction: {auto, prune, reserved}`, `provider.<id>.options`, `formatter`/`lsp` (bool o oggetto).

**⚠️ Rinomine V1→V2** (da `migrate-v1`): `plugin`→`plugins`, `provider`→`providers`, `agent`/`mode`→`agents`, `command`→`commands`, `reference`→`references`, `snapshot`→`snapshots`, `attachment`→`media`, `autoshare`→`share`, `permission`+`tools`→un array ordinato `permissions`, `autoupdate`→`update`, `small_model`→`agents.title.model`; campi `prompt`→`system`, `disable`→`disabled`, `maxSteps`→`steps`, `subtask`→`subagent`; azioni `bash`→`shell`, `task`→`subagent`, `write`/`patch`→`edit`; MCP sotto `mcp.servers` con `enabled`→`disabled`; skill `paths`/`urls`→un array; provider `npm`→`package`, `api`→`settings.baseURL`. **Accettate ma ignorate con warning:** `logLevel`, `server`, `subagent_depth` top-level, `compaction.tail_turns`/`prune`, agente `name`, e sperimentali `batch_tool`/`openTelemetry`/`primary_tools`/`continue_loop_on_deny`. `lsp` è accettato ma **i language server non girano in V2**.

`[to verify]`: `https://opencode.ai/config.json` è di forma **V1** dove letto (chiavi top-level `subagent_depth`, `mcp`, `plugin`, `provider`, `autoupdate`, `skills` oggetto) — **non** contiene `plugins`/`providers`/`mcp.servers`. Se esista uno schema V2 separato; la pagina V2 punta comunque a questo URL in `$schema`.

**TUI:** V1 `tui.json(c)` (chiavi `theme`, `keybinds`, `leader_timeout`, `scroll_speed`, `diff_style`, `cursor`, `mouse`, `attention`; keybind di default come `leader` = `ctrl+x`, `command_list` = `ctrl+p`, `session_new` = `<leader>n`, `agent_cycle` = `tab`). **V2:** `tui.json(c)` a strati → **un solo file globale `~/.config/opencode/cli.json`**, auto-migrato al primo avvio; la config client di progetto **non** è migrata. `[to verify]`: contenuto/forma di `cli.json` (pagina `/v2/docs/tui` non raggiungibile).

### 11.3 File di istruzioni

Vedi §5.6 (*File di istruzioni*).

### 11.4 MCP

**V2** (`/v2/docs/mcp-servers`): server sotto `mcp.servers` («V2 does not place server names directly under `mcp`»):

```jsonc
{ "mcp": { "servers": { "my-server": {
  "type": "local", "command": ["npx", "-y", "example-mcp-server"] } } } }
```

```jsonc
{ "mcp": { "servers": { "context7": {
  "type": "remote", "url": "https://mcp.context7.com/mcp" } } } }
```

- Local: `command` (array) richiesto; opzionali `cwd`, `environment`, `disabled`, `codemode`, `timeout`, `protocol`.
- Remote: `url` assoluto richiesto; opzionali `headers`, `oauth`, `disabled`, `codemode`, `timeout`, `protocol`.
- Disattivare con `"disabled": true` («Use `disabled`, not an `enabled` field»). Sostituzione env `{env:NAME}` (non `$NAME`). Un server con lo stesso nome a precedenza più alta **sostituisce l'intero oggetto**.

CLI V2: `opencode mcp add <name> --url <url>` · `--global` · `opencode mcp add everything -- npx -y @modelcontextprotocol/server-everything` · `opencode mcp list` · `opencode mcp auth <name>` · `opencode mcp logout <name>` (flag `--url`, `--header k=v`, `--env k=v`, `--global`).

**V1:** server **direttamente sotto `mcp`**, `"type":"local"` + `command` (`cwd`,`environment`,`enabled`,`timeout`) o `"type":"remote"` + `url` (`headers`,`oauth`,`enabled`,`timeout`); comandi `auth/list/logout/debug`.

---

## 12. Aggiornamento e canale

```
opencode upgrade [flags] [<target>]
  target string    Version to upgrade to (with or without a leading v) (optional)
  --method, -m choice    Installation method to use
                         (choices: curl, npm, pnpm, bun, yarn, vp, brew)
```

Esempi dalla doc: `opencode upgrade` (ultima), `opencode upgrade v0.1.48` (specifica). La doc V1 elenca solo `curl, npm, pnpm, bun, brew` (senza `yarn`/`vp`): il binario installato è più avanti della doc.

Cosa governa l'aggiornamento, per via d'installazione:
- **script di installazione** → una GitHub Release (lo script risolve «latest» da `https://api.github.com/repos/anomalyco/opencode/releases/latest` e scarica `releases/download/v<version>/…`); `--method curl`.
- **npm/pnpm/bun/yarn** → il package manager / dist-tag.
- **Homebrew** → `--method brew`.

Configurazione:
- **V2**: chiave `update` = `"disable" | "notify" | "auto"` (default `"notify"`, solo globale).
- **V1**: chiave `autoupdate`, descrizione schema verbatim: «Automatically update to the latest version. Set to true to auto-update, false to disable, or 'notify' to show update notifications» (tipo `boolean` o `"notify"`; `"notify"` «only works if it was not installed using a package manager such as Homebrew»). Env `OPENCODE_DISABLE_AUTOUPDATE` (booleano). Non esiste una chiave `version`/`install`.

`[to verify]`: nessuna pagina descrive un **canale** selezionabile (stable/beta/nightly). npm porta dist-tag `beta`/`dev`/`next`, ma nessuna fonte letta documenta come optarvi via `opencode upgrade`. **`[to verify]`**: su un'installazione 2.x, come `opencode upgrade` risolva il target, dato che GitHub Releases non ha release 2.x.

---

## 13. CLI

Sottocomandi del binario installato (v2.0.19, verbatim da `opencode <sub> --help`). Flag globali su ogni comando: `--help,-h` · `--version,-v` · `--wizard` · `--completions <bash|zsh|fish|sh>` · `--log-level <…>` · `--print-logs`. Flag top-level: `--standalone`, `--server <url>`, `--auto`, `--continue,-c`, `--session,-s <id>`, `--prompt`.

| Sottocomando | Scopo |
|---|---|
| `upgrade, update` | Aggiorna opencode (ultima o una versione; `--method curl\|npm\|pnpm\|bun\|yarn\|vp\|brew`) |
| `uninstall` | Disinstalla e rimuove i file collegati (`--keep-config/-c`, `--keep-data/-d`, `--dry-run`, `--force/-f`) |
| `acp` | Avvia un server Agent Client Protocol |
| `api` | Esegue una richiesta al server in esecuzione (`--data/-d`, `--header/-H`, `--param k=v`) |
| `debug` | Strumenti di debug: `agents`, `config`, `paths` |
| `auth` | Gestisce integrazioni e credenziali: `list`, `login`, `logout`, `switch` |
| `mcp` | Gestisce i server MCP: `list`, `add`, `auth`, `logout` |
| `plugin` | Gestisce i plugin: `list`, `add`, `check`, `update`, `remove` |
| `models` | Elenca i modelli disponibili |
| `stats` | Statistiche d'uso condivisibili (`--days`, `--year`, `--all`, `--project`, `--models`, `--tools`, `--cost`, `--full`, `--limit`, `--json`) |
| `mini` | Avvia l'interfaccia interattiva minimale |
| `run` | Esegue con un messaggio (`--format default\|json`, `--file/-f`, `--title`, `--thinking`, `--fork`) |
| `session` | Gestisce le sessioni: `list`, `delete`, `export`, `import` |
| `service` | Gestisce il server di background: `start`, `restart`, `status`, `stop`, `get`, `set`, `unset` |
| `reload` | Ricarica la configurazione |
| `pair` | Stampa link one-time per collegare browser/app (`--url`) |
| `serve` | Avvia «the v2 API and web server» (`--hostname`, `--port`, `--cors`, `--service`, `--stdio`) |

**Differenze vs la doc V1** (`/docs/cli`): la V1 elenca anche `agent`, `attach`, `github`, `pr <n>`, `db`, `web`, `export`/`import`. La V2 **aggiunge** `mini`, `pair`, `service`, `reload`, `api`, `serve` (web fuso in serve) e trasforma `plugin`/`auth`/`session`/`debug`/`mcp` in comandi-padre con sottocomandi. **`[to verify]`**: nessuna pagina V2 enumera la CLI come `/docs/cli` fa per la V1; la tabella è trascritta dal binario.

---

## 14. Evidenza locale (comandi eseguiti su questa macchina, 2026-10-03)

`opencode --version` → `opencode v2.0.19`.

`opencode debug paths`:

```
home       C:\Users\tomas
data       C:\Users\tomas\.local\share\opencode
cache      C:\Users\tomas\.cache\opencode
config     C:\Users\tomas\.config\opencode
state      C:\Users\tomas\.local\state\opencode
tmp        C:\Users\tomas\AppData\Local\Temp\opencode
bin        C:\Users\tomas\.cache\opencode\bin
log        C:\Users\tomas\.local\share\opencode\log
repos      C:\Users\tomas\.local\share\opencode\repos
db         C:\Users\tomas\.local\share\opencode\opencode.db
```

`opencode debug config` → `[ { "type": "directory", "path": "C:\\Users\\tomas\\.config\\opencode" } ]`.

`opencode debug agents` → agent built-in: `build` (mode `primary`, hidden `false`), `compaction` (`primary`, hidden `true`), `explore` (`subagent`, hidden `false`), `general` (`subagent`, hidden `false`), `plan` (`primary`, hidden `false`, «Read-only agent for exploring the codebase and planning work before implementation.»), `summary` (`primary`, hidden `true`), `title` (`primary`, hidden `true`). Il modello di permessi è un array di `{ "action": <string>, "resource": <glob>, "effect": "allow"|"ask"|"deny" }`; azioni osservate: `*`, `external_directory`, `read`, `question`, `grep`, `glob`, `webfetch`, `websearch`, `edit`, `subagent`.

Nota: `.config/opencode` è **fuori dal perimetro di lettura** di questa sessione (guardia dell'host), quindi il contenuto dei file di config globale non è stato letto direttamente; l'evidenza viene da `opencode debug …` e dal comando `opencode` stesso. **`[to verify]`**: contenuto reale di `~/.config/opencode/opencode.json` e degli eventuali plugin/skill/agenti globali installati.

---

## 15. Changelog e breaking changes

- Il `/changelog` pubblico è **V1**. Ultime voci:

| Versione | Data | Contenuto |
|---|---|---|
| `v1.18.34` | 2026-09-30 | header d'identità sessione/parent namespaced; ri-firma del binario macOS per macOS 27+ |
| `v1.18.33` | — | timeout Cloudflare AI Gateway; reporting dei fallimenti di lancio browser MCP; `debug` che redige le credenziali; default thinking Gemini |
| `v1.18.32` | — | — |
| `v1.18.31` | — | ripristino sessione ACP; errori auth config remota TUI |
| `v1.18.30` | — | system prompt Astra per GPT-6 |

  **Nessun breaking change** elencato; **nessuna voce 2.x**.
- La V2 ha **note di rilascio consolidate assenti**: i cambi sono sparsi (Core / TUI / Desktop / SDK / Extensions) e nella guida `/v2/docs/migrate-v1`.
- **⚠️ Le tre rotture intenzionali V1→V2:**
  1. **API dei plugin** — «V1 plugin implementations do not run in V2»: nuova forma `Plugin.define({ id, setup(ctx) })`, `ctx.subscribe`→`ctx.event.subscribe`, `chat.params` spezzato in `context`/`compaction`/`generate`/`title`, scoperta da `.opencode/plugins`. **⚠️** Un plugin scritto sull'API piatta (§10) **non gira** sulla 2.0.19.
  2. **API server e contratti client** — usare `@opencode/client`.
  3. **Config del terminale** — `tui.json(c)` → un solo `~/.config/opencode/cli.json`.
- Riscrittura dietro la V2: **Bun→Node.js**, **Tauri→Electron**, core Effect/Schema-first, server HTTP Hono/Effect con SSE, stato sessione SQLite (Drizzle). **`[to verify]`**: internals da write-up di terze parti, non da doc ufficiali.
- Modifica minore V1 confermata dai rilasci (v1.18.33): «Debug configuration output now redacts credentials» — coerente col fatto che `opencode debug config` elenca solo le **sorgenti**, non i valori.

---

## 16. Sintesi delle marcature di versione e `[to verify]`

Sintesi delle soglie di versione:

| Fatto | V1 (1.18.x) | V2 (2.0.19 in uso) |
|---|---|---|
| pacchetto npm | `opencode-ai` | `@opencode/cli` |
| GitHub Release | `v1.18.34` | **nessuna** (solo tag `v2.0.x`) |
| doc | `/docs` | `/v2/docs` |
| risalita progetto (config) | fino al git worktree | fino alla radice del filesystem |
| file di istruzioni | `AGENTS.md` + fallback `CLAUDE.md` | **solo `AGENTS.md`** |
| chiave plugin | `plugin` (flat) | `plugins` (con `{package, options}`) |
| chiave agente | `agent`/`mode` | `agents` |
| chiave permessi | `permission` + `tools` | `permissions` (array) |
| azione delega | `task` | **`subagent`** |
| azione shell | `bash` | `shell` |
| API plugin | export `Plugin` + hook piatti | `Plugin.define({ id, setup(ctx) })` (⚠️ non retrocompatibile) |
| config TUI | `tui.json(c)` a strati | `~/.config/opencode/cli.json` |

`[to verify]` raccolti in tutta la nota:
- sintassi esatta dello **specifier Git** per `opencode plugin add`;
- quale pacchetto tipi usare per un plugin sulla 2.0.19 (⚠️ API riscritta);
- cosa cambia tra 2.0.19 e `@opencode/cli@2.0.22`;
- canale (stable/beta/nightly) selezionabile via `opencode upgrade`; come `upgrade` risolva il target 2.x senza release GitHub;
- limite di risalita per skill/agenti (radice filesystem vs radice progetto);
- se un percorso imponga la corrispondenza nome-cartella di una skill;
- se `1.18.34` emetta ancora `lsp.client.diagnostics`; schemi degli eventi `session.next.*`, `workspace.*`, `worktree.*`, `mcp.*`, `catalog.*`, `integration.*`, `question.*`;
- se l'API plugin V1 esponga un hook per le skill;
- esistenza di `scout` e sua linea;
- `reasoningEffort` a livello agente (assente dallo schema letto);
- `subagent_depth` in V2 (dichiarato ignorato con warning);
- se il modello possa passare `custom` nella `question`, e cap della TUI sul numero di domande/opzioni;
- schema V2 separato (o conferma) per `config.json`; contenuto/forma di `~/.config/opencode/cli.json`;
- esistenza di `OPENCODE_CONFIG`/`OPENCODE_CONFIG_DIR` in V2;
- contenuto reale dei file di config globale su questa macchina (fuori perimetro di lettura).
