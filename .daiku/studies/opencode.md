# opencode — appunti operativi di sviluppo

> **Versione in uso nel progetto: 2.0.29** (`opencode --version` → `opencode v2.0.29`, riverificato 2026-10-14; pacchetto npm globale `@opencode/cli@2.0.29`).
> **Ultima pubblicata sulla stessa linea:** `@opencode/cli@2.0.29` — **è la stessa in uso** (npm `latest`, tag git `v2.0.29`, publish 2026-10-14T09:03:04Z). **Ultima release GitHub:** `v1.19.0` (2026-10-11) — ma è l'**altra linea** (V1), vedi §2.
> Data di raccolta: **2026-10-03** per le fondamenta lette sulla 2.0.19, **2026-10-13** per la linea V2 e il multi-agente, **2026-10-14** per la lettura rinnovata al tag `v2.0.29` — che corregge le precedenti e, dove serve, è dichiarata come tale. Radice tecnica: `C:/dev/daiku` → `{paths.studies}` = `.daiku/studies`.
> Nota sul cutoff del modello: firme, nomi di campo, JSON e comandi qui sotto sono copiati **verbatim** da pagine recuperate o da comandi realmente eseguiti su questa macchina, mai dalla memoria del modello. Ciò che le fonti non confermano è marcato **`[to verify]`**, con cosa manca.
> `.daiku/project.json` **dichiara la chiave `documents`** (`stack` = `STACK.md`, `architecture` = `ARCHITECTURE.md`, entrambi in radice): l'ancoraggio al progetto è in §20.

## Indice

**Fondamenta**
1. **Meta e sorgenti** — convenzioni, fonti primarie e di terza parte.
2. **Modello di versione: le due linee V1 e V2** — versione in uso e freschezza dei tag, cosa cambia nell'altra linea, soglie V1/V2 e i `[to verify]` raccolti.
3. **Concetti e modello mentale** — cos'è opencode, client/server, sessioni, le quattro estensioni.
4. **Installazione e distribuzione** — come si installa, come si distribuisce un'estensione (anche multi-file).

**Primitive**
5. **Dove opencode scopre le cose** — percorsi e ordine per config, skill, agenti, comandi, plugin, istruzioni.
6. **Le skill (`SKILL.md`)** — frontmatter, caricamento, `permission.skill`, l'equivalente di `${CLAUDE_PLUGIN_ROOT}`, e una skill in una corsa non interattiva.
7. **Gli agenti (subagent)** — dichiarazione, `mode`, lancio col tool `subagent`, parallelismo, `subagent_depth` imposto, ciclo di vita senza hook.
8. **I comandi** — forma dei file e scoperta.
9. **La domanda all'utente (`question`)** — l'equivalente di `AskUserQuestion`.

**Estensioni**
10. **I plugin e l'API dei hook** — la forma viva di un plugin, i domini con hook, cosa un plugin può avviare e cosa può negare.

**Configurazione e ciclo di vita**
11. **Configurazione, istruzioni e MCP** — `opencode.json`, file di istruzioni, server MCP.
12. **Provider, modelli e tool calling** — config provider V1/V2, `tool_call` per modello, i tetti dei tier gratuiti, l'attrito dell'agent loop.
13. **I permessi in una corsa non interattiva** — `--auto`, il modello dei permessi, cosa resta negato per costruzione.

**Operazioni**
14. **`opencode run`: una corsa non interattiva e parsabile** — flag, prompt da stdin/`--file`, NDJSON, codici d'uscita.
15. **Corse parallele, sessioni e `experimental.subagent_depth`** — cosa si contendono due corse, i flag di sessione, il tetto di concorrenza.
16. **Aggiornamento e canale** — `upgrade`, `autoupdate`/`update`, cosa lo governa.
17. **CLI** — elenco dei sottocomandi.
18. **Evidenza locale** — comandi realmente eseguiti su questa macchina.

**Changelog**
19. **Changelog e breaking changes** — il changelog V2 su `/changelog`, il changelog V1, il salto a V2.

**Integrazione**
20. **Il terreno di questa nota (ancoraggio al progetto)** — cosa `STACK.md`/`ARCHITECTURE.md` vincolano, stato del cantiere verso opencode.
21. **Cosa resta scoperto, in sintesi** — domande chiuse, la meno chiusa, le prove non eseguite.

### Mappa dei nomi

| Nome | Dove vive la firma completa |
|---|---|
| `question` (tool) | §9 |
| `subagent` (tool; `task` è la forma V1) | §7 |
| `skill` (tool) | §6 |
| `tool()` (helper plugin) | §10 |
| `Plugin`, `PluginInput`, `Hooks` | §10 |
| `SessionHooks`, `ToolHooks` (API V2 per dominio) | §10 |
| `Question.Prompt` / `Option` / `Answer` / `Reply` | §9 |
| `permission` (regole `{action,resource,effect}`) | §7 |
| `agent` / `agents`, `mode` | §7 |
| `subagent_depth` | §7 |
| `provider` / `providers` | §12 |

---

## 1. Meta e sorgenti

Convenzioni della nota:
- **verbatim** = copiato dalla fonte, non riscritto «a sentimento»;
- **`[to verify]`** = non confermato da una fonte letta o da un comando eseguito, con indicato cosa manca;
- **⚠️** = breaking change.

Fonti di **prima parte** (comandi eseguiti su questa macchina, 2026-10-03): `opencode --version`, `opencode --help`, `opencode <sottocomando> --help` per `plugin`, `models`, `run`, `session`, `debug`, `auth`, `mcp`, `upgrade`, `api`, `serve`, `acp`, `service`, `mini`, `pair`, `stats`; `opencode debug paths`, `opencode debug config`, `opencode debug agents`; `npm view` su `opencode-ai`, `@opencode-ai/plugin`, `@opencode-ai/sdk`, `@opencode/cli`; `gh release list -R sst/opencode`; `gh api repos/sst/opencode`.

Fonti **online** lette:
- Documentazione ufficiale: `https://opencode.ai/docs/` (linea V1) e `https://opencode.ai/v2/docs/` (linea V2); pagine `.md`: `/docs/{config,agents,commands,skills,permissions,plugins,cli,mcp-servers,rules,keybinds,tui,server}.md`; `https://opencode.ai/config.json`; `https://opencode.ai/install`; `https://opencode.ai/changelog`.
- Repository: `https://github.com/sst/opencode` (redirige a **`anomalyco/opencode`**; default branch `dev`, tag `v1.18.34` e tag `v2.0.16`…`v2.0.29`). File sorgente citati inline nelle sezioni.
- Terza parte: «Missing Manual» non ufficiale dei plugin, `https://github.com/joshuadavidthomas/opencode-plugins-manual` (commit `3efc95b`, **datato/invecchiato** rispetto a `dev`).

> Avvertenza sulla freschezza: `opencode.ai/docs` riflette la **V1**; `opencode.ai/v2/docs` la **V2**. La versione in uso (2.0.29) è V2, quindi la resa più fedele viene dal **binario installato** e dai **tag `v2.0.x`** del repository, non da `/docs`.

> Avvertenza sulla V2: `https://opencode.ai/v2/docs/agents.md` → **HTTP 404** (2026-10-13). La fonte primaria della V2 è il **repo** (`services/www/src/docs/content/`), non `/v2/docs`. **`[to verify]`**

---

## 2. Modello di versione: le due linee V1 e V2

Esistono **due prodotti vivi**, con pacchetti npm, canali di rilascio e doc separati. È il fatto che condiziona tutto il resto.

| | **V1** (stabile pubblicata) | **V2** (installata qui) |
|---|---|---|
| pacchetto npm CLI | `opencode-ai` | `@opencode/cli` |
| npm `latest` | **1.18.34** (2026-09-30) | **2.0.29** (2026-10-14) |
| altri dist-tag npm | `beta`, `dev`, `next`, `tui-v2`, `latest-0`, `latest-1` | `beta`, `dev`, `reserved` (il `dist-tags` completo letto il 2026-10-14 è `{ latest: "2.0.29", beta: "0.0.0-beta-19507", dev: "0.0.0-dev-20957", reserved: "0.0.0-reserved" }`) |
| GitHub Release | `v1.18.34` … (unica lista) | **nessuna** — la 2.x esiste solo come **git tag** (`v2.0.16`…`v2.0.29`) |
| docs | `https://opencode.ai/docs` (banner: «New OpenCode v2 is now available») | `https://opencode.ai/v2/docs` |
| binario nativo | `opencode` | `opencode` (NON `opencode2`, come sostengono alcuni blog — smentiti dalla pagina ufficiale) |

Stato del caso:
- `npm view opencode-ai@2.0.19` → **404**; `opencode-ai` ha **zero** versioni `2.x`. La linea 2.x vive **solo** nel pacchetto `@opencode/cli`.
- `gh release list -R anomalyco/opencode -L 200` non contiene **nessuna** release `v2.*`; `releases/tags/v2.0.19` → 404. La 2.x esiste come tag git.
- La patch in uso è **2.0.29** — è l'ultima (tabella delle patch più sotto). **`[to verify]`**: il dettaglio di cosa cambia in **ogni** patch fra 2.0.19 e 2.0.29; solo le ultime quattro hanno una voce recuperabile (§19), le altre si leggono per file e per tag.

**Freschezza dei tag V2:** le date di publish della linea stanno nella tabella delle patch più sotto (lettura rinnovata).

**I tag non stanno su una linea unica.** `compare/v2.0.22...v2.0.28` = **1796 commit** con date dal 2026-06-26, mentre `compare/v2.0.27...v2.0.28` = 60; il 2026-10-10 c'è `chore: promote v2 to dev`. La ricognizione affidabile è **per file**, mai per intervallo di tag.

**Conseguenza operativa:** la versione in uso è la 2.0.29 (V2). Dove una firma qui sotto viene da sorgenti V1 (branch `dev` = 1.18.34, oppure `/docs`), è segnalato. Se si aggiorna oltre la 2.0.29 o si torna alla linea 1.18.x, le differenze sono in §19 (⚠️).

**Lettura rinnovata al tag `v2.0.29` (2026-10-14): versione in uso e freschezza.**

**Versione in uso, provata su questa macchina (2026-10-14):**

```text
$ opencode --version
opencode v2.0.29
```

**Ultima pubblicata — tre fonti concordi (2026-10-14):**

| Fonte | Comando | Esito |
|---|---|---|
| binario | `opencode --version` | `opencode v2.0.29` |
| npm dist-tag | `npm view @opencode/cli dist-tags --json` | `{ latest: "2.0.29", beta: "0.0.0-beta-19507", dev: "0.0.0-dev-20957", reserved: "0.0.0-reserved" }` |
| tag git | `gh api repos/anomalyco/opencode/commits/042d0832f5f3a73eaa039a58a7d565776f6d4290` | commit `042d0832f5f3a73eaa039a58a7d565776f6d4290`, data `2026-10-14T09:03:17Z`, messaggio `release: v2.0.29` |

Publish npm della 2.0.29: `2026-10-14T09:03:04.814Z`.

**In uso = ultima.** Sulla linea V2 non c'è ritardo: la regola «la versione in uso vince sull'ultima» qui non ha delta da dichiarare, e nulla va marcato come «cambia se aggiorni». Il delta che conta in questa nota è l'altro: **le patch dalla 2.0.19 alla 2.0.29**, cioè le dieci patch che la raccolta precedente non copriva.

**La V1 resta viva in parallelo** (non è una versione vecchia, è l'altra linea): ultima GitHub Release `v1.19.0` (2026-10-11), pacchetto npm `opencode-ai`, docs `https://opencode.ai/docs`. Il tag `v2.0.29` **non ha GitHub Release**, solo il tag git (§2).

**Le patch della linea, in ordine:**

| versione | publish npm (UTC) | versione | publish npm (UTC) |
|---|---|---|---|
| `2.0.19` **(coperta dalla nota precedente)** | 2026-09-29T04:31:14Z | `2.0.25` | 2026-10-08T09:16:34Z |
| `2.0.20` | 2026-09-29T21:05:55Z | `2.0.26` | 2026-10-08T19:43:12Z |
| `2.0.21` | 2026-09-30T23:01:48Z | `2.0.27` | 2026-10-12T04:15:00Z |
| `2.0.22` | 2026-10-02T04:21:16Z | `2.0.28` | 2026-10-13T08:16:38Z |
| `2.0.23` | 2026-10-05T05:26:06Z | `2.0.29` **(in uso = ultima)** | 2026-10-14T09:03:04Z |
| `2.0.24` | 2026-10-06T03:01:58Z | | |

**Sintesi delle soglie di versione V1/V2 e dei `[to verify]` raccolti.**

**Ultima della linea V2: `2.0.29` (2026-10-14).** Versione in uso: **2.0.29** (2026-10-14) — in uso = ultima.

Sintesi delle soglie di versione:

| Fatto | V1 (1.18.x) | V2 (2.0.29 in uso) |
|---|---|---|
| pacchetto npm | `opencode-ai` | `@opencode/cli` |
| GitHub Release | `v1.18.34` | **nessuna** (solo tag `v2.0.x`) |
| doc | `/docs` | `/v2/docs` |
| risalita progetto (config) | fino al git worktree | fino alla radice del filesystem |
| file di istruzioni | `AGENTS.md` + fallback `CLAUDE.md` | **solo `AGENTS.md`** |
| chiave plugin | `plugin` (flat) | `plugins` (con `{package, options}`) |
| chiave agente | `agent`/`mode` | `agents` |
| chiave permessi | `permission` + `tools` | `permissions` (array) |
| tool di delega | `task` (`subagent_type`/`task_id`/`command`) | **`subagent`** (`agent`/`sessionID`/`model`) |
| azione delega | `task` | **`subagent`** |
| azione shell | `bash` | `shell` |
| `subagent_depth` | chiave top-level, default 1 | `experimental.subagent_depth`, default 1, **imposto** |
| API plugin | export `Plugin` + hook piatti | per dominio (`Plugin.define({ id, setup(ctx) })`; `ctx.tool.hook("execute.before")`, `session.hook(...)`, `ctx.permission.hook("evaluate")`) (⚠️ non retrocompatibile) |
| config TUI | `tui.json(c)` a strati | `~/.config/opencode/cli.json` |

`[to verify]` raccolti in tutta la nota:
- sintassi esatta dello **specifier Git** per `opencode plugin add`;
- quale pacchetto tipi usare per un plugin sulla 2.0.29 (⚠️ API riscritta);
- cosa cambia in ogni patch tra 2.0.19 e `@opencode/cli@2.0.29`;
- canale (stable/beta/nightly) selezionabile via `opencode upgrade`; come `upgrade` risolva il target 2.x senza release GitHub;
- limite di risalita per skill/agenti (radice filesystem vs radice progetto);
- se un percorso imponga la corrispondenza nome-cartella di una skill;
- se `1.18.34` emetta ancora `lsp.client.diagnostics`; schemi degli eventi `session.next.*`, `workspace.*`, `worktree.*`, `mcp.*`, `catalog.*`, `integration.*`, `question.*`;
- se l'API plugin V1 esponga un hook per le skill;
- esistenza di `scout` e sua linea;
- `reasoningEffort` a livello agente (assente dallo schema letto);
- nessun tetto di concorrenza dichiarato per i subagent (fork per tool-call + `Fiber.awaitAll`);
- se il modello possa passare `custom` nella `question`, e cap della TUI sul numero di domande/opzioni;
- schema V2 separato (o conferma) per `config.json`; contenuto/forma di `~/.config/opencode/cli.json`;
- esistenza di `OPENCODE_CONFIG`/`OPENCODE_CONFIG_DIR` in V2;
- autenticazione provider in V2 (il comando letterale `opencode auth login` non compare nelle pagine lette);
- pagina dei tier gratuiti di Mistral (404); esistenza di una lista ufficiale di modelli adatti all'agent loop;
- `https://opencode.ai/v2/docs/agents.md` → 404 (fonte primaria V2 = il repo);
- contenuto reale dei file di config globale su questa macchina (fuori perimetro di lettura).

---

## 3. Concetti e modello mentale

- **Cos'è.** opencode è un agente di coding open source: un **server in background** più un client. Il binario `opencode` avvia la TUI interattiva; `opencode service` gestisce il server di background (`start`/`restart`/`status`/`stop`); `opencode serve` avvia «the v2 API and web server». `--standalone` esegue con un server privato invece che col servizio di background; `--server <url>` si connette a un server esistente.
- **Sessioni.** L'unità di conversazione è la **sessione**; `opencode session` la gestisce (`list`, `delete`, `export`, `import`). I subagent creano sessioni figlie (con `parentID`).
- **Le quattro estensioni.** opencode conosce quattro tipi di file, ciascuno con la sua cartella e il suo ordine di scoperta (§5):
  - **skill** — `SKILL.md`, caricate su richiesta dal modello tramite il tool `skill` (§6);
  - **agenti** — `.md` con frontmatter, primari o subagent, lanciati col tool `subagent` (§7);
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

- `[to verify]`: la sintassi esatta dello **specifier Git** accettato da `plugin add` (l'help dice «npm registry or Git package specifier» ma non ne mostra il formato; la pagina `/docs/plugins` non lo nomina). Vedi sotto le forme accettate.
- I pacchetti npm che accompagnano la linea installata sono `@opencode-ai/plugin` (API dei plugin) e `@opencode-ai/sdk`, ma la loro `latest` è `1.18.34` (linea V1). **`[to verify]`**: quale pacchetto tipi usare per scrivere un plugin sulla 2.0.29 (vedi §19, ⚠️ API dei plugin riscritta in V2; le due forme vive sono in §10.8).

**Manifest e marketplace: non esistono** — riconfermato il 2026-10-13. L'unico «registry» è **npm**. Non c'è un formato-pacchetto che leghi plugin + skill + agenti + comandi.

**`opencode plugin add <package>`** — help (2.0.19), verbatim:

```
DESCRIPTION  Install a plugin and add it to the global configuration
ARGUMENTS    package string    npm registry or Git package specifier
```

Sorgente a v2.0.28 (`packages/cli/src/commands/handlers/plugin/add.ts`): un **path locale non è accettato** — `Plugin target must be an npm registry package or Git package specifier`; la doc rincara: «tarball and npm alias targets are not accepted by `plugin add`. Local paths are configured directly instead.» Specifier Git verbatim: `github:acme/opencode-plugin`, `git+ssh://git@github.com/acme/opencode-plugin.git#main`, `github:acme/plugins#main::path:packages/opencode-plugin`. Installa in `~/.cache/opencode/npm/<nome@spec>`.

**Il pacchetto installato porta SOLO il modulo plugin.** `Host.resolve` (`packages/plugin/src/host.ts`) cerca gli entrypoint ai sotto-path `"server"`, `""`, `"tui"`, `"rpc"`; il pacchetto **non viene scandito** per `skills/`, `agents/`, `commands/` — la scoperta guarda solo le directory di config, **mai `node_modules`**. Una skill dentro un pacchetto npm va **registrata in codice** (§6.4).

**Cartelle globali** sotto `~/.config/opencode/` (override `OPENCODE_CONFIG_DIR`): skill `skill` **e** `skills`; agenti `agent` e `agents`; comandi `command` e `commands`; plugin `plugin` e `plugins`; istruzioni `AGENTS.md`. Compat: `~/.claude/skills`, `~/.agents/skills` — **solo skill**: agenti, comandi e plugin non vengono mai letti da lì (dettaglio in §5).

**Path dentro una skill.** Verbatim: «Paths written inside the skill are relative to the directory containing `SKILL.md`.» · «The directory form is recommended because it gives supporting files a private base directory.» OpenCode inietta la base dir della skill e un campione di **max dieci** path di file di supporto; «Supporting file contents are not loaded automatically». **`${CLAUDE_PLUGIN_ROOT}` resta inesistente** (§6.4): l'ancora assoluta la mette l'host, non è scrivibile nel file. Un plugin deve calcolare da sé la propria directory (`import.meta.url`).

**Aggiornamento.** `opencode upgrade` aggiorna **l'host**; `opencode plugin check|update [<target>]` i pacchetti plugin. **Skill, agenti e comandi non hanno versionamento**: l'unico `version` guidato è quello dell'`index.json` di un **catalogo HTTP** di skill, che serve a invalidare la cache, non a gestire rilasci.

---

## 5. Dove opencode scopre le cose

Tutta questa sezione è letta dal sorgente al **tag `v2.0.19`** (la versione della lettura precedente; la lettura rinnovata al tag `v2.0.29` non ha ripassato la scoperta); i file sono citati inline. Dove il sorgente contraddice la doc, prevale il sorgente (e la contraddizione è segnalata).

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

**V1** invece: risale per `AGENTS.md` e `CLAUDE.md` (vince `AGENTS.md`), più `~/.config/opencode/AGENTS.md` e i fallback `~/.claude/CLAUDE.md`, `~/.claude/skills/`; disattivabili con `OPENCODE_DISABLE_CLAUDE_CODE=1`, `OPENCODE_DISABLE_CLAUDE_CODE_PROMPT=1`, `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS=1`. Vedi §19 (⚠️).

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
- V2, al tag `v2.0.29` (`packages/core/src/config/plugin/skill-file.ts`): il parser legge **quattro** campi — `name`, `description`, `metadata`, `"disable-model-invocation"` (§6.8); `name` è opzionale con fallback al basename per un `<name>.md` piatto alla radice. **Nessun campo `slash`** (il vecchio `Frontmatter = { name?, description?, slash? }` non regge: `opencode/slash` non è letto da nessun file — §6.8).

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

La parte seguente (6.5-6.11) è letta al tag `v2.0.29`: come una skill entra in una **corsa non interattiva** (`opencode run`).

> Letto al tag **`v2.0.29`**. Eseguito (nessun prompt inviato, nessun credito speso): `opencode --version`, `opencode --help`, `opencode run --help`, `opencode session --help`, `opencode debug --help`, `opencode api --help`.

### 6.5 La risposta breve

Sì: una skill si può far entrare in una corsa **senza** che sia il modello a sceglierla, ma **non dalla riga di comando `opencode run`** — che non ha nessun flag, né una forma slash, per agganciare una skill. Le due vie reali sono **API/SDK**:

- il payload di `session.prompt` porta `skills: [{ id }]` e la skill viene iniettata **come testo del messaggio utente, prima del prompt**;
- oppure l'endpoint `session.skill`: «appends a skill message and resuming execution».

Il permesso `permission.skill` governa **solo la chiamata del modello al tool `skill`**: con `ask`, in `opencode run` senza `--auto`, la richiesta viene **auto-rigettata** (nessuno può rispondere) e la corsa prosegue senza la skill. L'attivazione via `session.skill` **non passa da nessun controllo di permesso**.

### 6.6 Come si carica una skill

**(a) Il tool `skill`, scelto dal modello.** `packages/core/src/tool/plugin/skill.ts`:

```ts
export const name = "skill"

export const Input = Schema.Struct({
  id: Skill.ID.annotate({ description: "The ID of an available skill or a skill explicitly referenced by the user" }),
})
```

Il campo è **`id`**, non `name`. (La doc `packages/web/src/content/docs/skills.mdx` allo stesso tag mostra ancora `skill({ name: "git-release" })` e un `<available_skills>` senza `<id>`: divergenza doc↔codice, non comportamento.)

L'elenco delle skill arriva al modello come sezione di guidance, `packages/core/src/skill/instructions.ts`:

```ts
const render = (skills: ReadonlyArray<Summary>) =>
  [
    "Skills provide specialized instructions and workflows for specific tasks.",
    "Use the skill tool to load a skill when a task matches its description.",
    "The user may also invoke a skill directly. When that happens, its instructions appear in the conversation as a <skill_content> block, the same shape the skill tool returns. A skill that is already present this way does not need to be invoked again.",
    ...(skills.length === 0
      ? ["No skills are currently available."]
      : ["<available_skills>", ...entries(skills), "</available_skills>"]),
  ].join("\n")
```

con `entries` = `<skill><id>…</id><name>…</name><description>…</description></skill>`, e le skill con `autoinvoke === false` (o `description` assente) **escluse dall'elenco** ma ancora caricabili per id:

```ts
        const available = Skill.available(yield* skills.list(), permissions)
          .flatMap((skill) =>
            skill.description === undefined || skill.autoinvoke === false
              ? []
              : [{ id: skill.id, name: skill.name, description: skill.description }],
          )
```

**(b) Skill già caricata in partenza (percorso API).** `packages/schema/src/prompt-input.ts`:

```ts
export interface SkillAttachment extends Schema.Schema.Type<typeof SkillAttachment> {}
export const SkillAttachment = Schema.Struct({
  id: Skill.ID,
  mention: PromptMention.pipe(optional),
}).annotate({ identifier: "PromptInput.SkillAttachment" })

export const Prompt = Schema.Struct({
  text: Schema.String,
  files: Schema.Array(FileAttachment).pipe(optional),
  agents: Schema.Array(AgentAttachment).pipe(optional),
  skills: Schema.Array(SkillAttachment).pipe(optional),
})
```

L'endpoint lo accetta (`packages/protocol/src/groups/session.ts`):

```ts
      HttpApiEndpoint.post("session.prompt", "/api/session/:sessionID/prompt", {
        params: { sessionID: Session.ID },
        payload: Schema.Struct({
          id: SessionMessage.ID.pipe(Schema.optional),
          ...PromptInput.Prompt.fields,
          metadata: SessionInbox.UserPayload.fields.metadata,
          delivery: SessionInbox.Delivery.pipe(Schema.optional),
          resume: Schema.Boolean.pipe(Schema.optional),
        }),
```

e `packages/core/src/session/prompt.ts` risolve l'attachment in contenuto già pronto, chiamando la stessa preparazione del tool:

```ts
    const requested = input.skills
    const selected = yield* Effect.gen(function* () {
      if (!requested?.length) return undefined
      const skillService = yield* Skill.Service
      const prepared = new Map<Skill.ID, Skill.Name>()
      return yield* Effect.forEach(requested, (attachment) =>
        Effect.gen(function* () {
          const name = prepared.get(attachment.id)
          if (name !== undefined) return { id: attachment.id, name, mention: attachment.mention }
          const skill = yield* skillService.get(attachment.id)
          if (!skill) return yield* new SkillNotFoundError({ skill: attachment.id })
          prepared.set(skill.id, skill.name)
          return {
            id: skill.id,
            name: skill.name,
            text: (yield* Skill.prepare(fs, skill).pipe(Effect.orDie)).output,
            mention: attachment.mention,
          }
```

Il testo della skill atterra **prima** del prompt dell'utente, come parti di testo separate (`packages/core/src/session/runner/to-llm-message.ts`):

```ts
    case "user":
      const content = [
        ...(message.skills ?? []).flatMap((skill) => (skill.text === undefined ? [] : [Message.text(skill.text)])),
        ...(message.text === "" ? [] : [Message.text(message.text)]),
        ...userAttachmentContent(message.files ?? []),
      ]
```

Confermato dal banco `packages/core/test/session-runner-message.test.ts`, e dal caso «does not inject skill content for reference-only attachments»: un attachment **senza** `text` non inietta nulla, resta solo il riferimento testuale.

**(c) Attivazione su una sessione, con ripresa.** `packages/core/src/session/session.ts`:

```ts
  const skill = Effect.fn("Session.skill")(function* (
    sessionID: SessionSchema.ID,
    input: { messageID?: SessionMessage.ID; skill: Skill.ID; resume?: boolean },
  ) {
    const session = yield* get(sessionID)
    const skill = yield* SessionSkill.get({ session, skill: input.skill }).pipe(
      Effect.provideService(Instance.Service, instances),
    )
    yield* bus.publish(
      SessionEvent.Skill.Activated,
      {
        sessionID,
        id: skill.id,
        name: skill.name,
        text: skill.content,
      },
```

esposto come `POST /api/experimental/session/:sessionID/skill` («Activate a skill for a session by appending a skill message and resuming execution», payload `{ id: Skill.ID, resume?: boolean }`), e proiettato in un messaggio di tipo `skill` (`packages/core/src/session/message-updater.ts`):

```ts
      "session.skill.activated": (event) => {
        return adapter.appendMessage(
          SessionMessage.Skill.make({
            id: SessionMessage.ID.fromEvent(event.id),
            type: "skill",
            skill: event.data.id,
            name: event.data.name,
            text: event.data.text,
```

**Cosa NON esiste.** `opencode run` non porta nessuna skill: la spec dei flag non ne ha (`packages/cli/src/commands/commands.ts`) e il payload che la CLI costruisce è solo testo + file (`packages/cli/src/run/noninteractive.ts`):

```ts
      .prompt(
        {
          sessionID: input.sessionID,
          id: messageID,
          text: [input.message, ...prepared.flatMap((file) => (file.text ? [file.text] : []))].join("\n\n"),
          files: prepared.flatMap((file) => (file.attachment ? [file.attachment] : [])),
          delivery: "steer",
        },
```

In `commands.ts` solo `yolo` e `dangerously-skip-permissions` sono `Flag.withHidden`: nessun flag di skill, nemmeno nascosto.

### 6.7 `permission.skill` e cosa succede con `ask` in una corsa non interattiva

Il tool chiede il permesso sull'azione `skill`, con la risorsa = id della skill (`packages/core/src/tool/plugin/skill.ts`):

```ts
                yield* permission.assert({
                  action: name,
                  resources: [skill.id],
                  save: [skill.id],
                  sessionID: context.sessionID,
                  agent: context.agent,
                  source: { type: "tool", messageID: context.messageID, id: context.id },
                })
```

Default **allow**: l'agente di default dichiara `{ action: "*", resource: "*", effect: "allow" }` (`packages/schema/src/agent.ts`, `Agent.Info.default`), e la valutazione prende l'**ultima** regola che combacia (`packages/core/src/permission.ts`):

```ts
export function evaluate(action: string, resource: string, ...rulesets: Permission.Ruleset[]): Permission.Rule {
  return (
    rulesets
      .flat()
      .findLast((rule) => Wildcard.match(action, rule.action) && Wildcard.match(resource, rule.resource)) ?? {
      action,
      resource: "*",
      effect: "ask",
    }
  )
}
```

Le regole di configurazione sono **appese in coda** ai permessi di ogni agente (`packages/core/src/config/plugin/agent.ts`), quindi vincono:

```ts
      const permissions = expandPermissions(
        loaded.documents.flatMap((document) => document.info.permissions ?? []),
        global.home,
      )
      ...
      for (const current of editor.list()) {
        editor.update(current.id, (agent) => agent.permissions.push(...permissions))
      }
```

La chiave della V2 è **`permissions`** (lista di regole). Il blocco `"permission": { "skill": { "*": "allow", "internal-*": "deny" } }` della doc è la **forma V1**, migrata (`packages/core/src/config/normalize.ts`):

```ts
    return Object.entries(raw).flatMap(([resource, effect], index) => {
      const decoded = decodeValue(ConfigPermissionV1.Action, effect, ["permission", action, String(index)], diagnostics)
      return decoded === undefined
        ? []
        : [{ action: ConfigMigrateV1.normalizeAction(action), resource, effect: decoded }]
```

`deny` **toglie la skill anche dall'elenco di guidance** (`Skill.available`: `skills.filter((skill) => Permission.evaluate("skill", skill.id, permissions).effect !== "deny")`); e se il modello la chiama comunque l'esito è `BlockedError`, che il tool converte in un fallimento visibile: `new ToolFailure({ message: \`Unable to load skill ${name}\`, error })`.

**Con `ask` in `opencode run`, nessuno risponde: la richiesta si auto-rigetta.** `packages/cli/src/run/noninteractive.ts`:

```ts
const PERMISSION_REJECTED_FEEDBACK =
  "This non-interactive run cannot ask the user for permission, so the request was rejected. Continue without this action."
```

```ts
  const replyPermission = async (request: {
    id: string
    sessionID: string
    action: string
    resources: ReadonlyArray<string>
  }) => {
    // Nobody can approve here. Outside V1 compatibility, reject with feedback so the tool fails
    // as ordinary model-visible output and the model continues without the action.
    const continuing = !input.auto && input.compatibility !== "v1"
    if (!input.auto) {
      if (!continuing) permissionRejected = true
      UI.println(
        UI.Style.TEXT_WARNING_BOLD + "!",
        UI.Style.TEXT_NORMAL +
          `permission requested: ${request.action} (${request.resources.join(", ")}); auto-rejecting`,
      )
    }
    await input.client.permission
      .reply({
        sessionID: request.sessionID,
        requestID: request.id,
        decision: input.auto ? "once" : "reject",
        ...(continuing ? { message: PERMISSION_REJECTED_FEEDBACK } : {}),
      })
```

Quindi: **senza `--auto`** la skill con `ask` è rifiutata, il tool fallisce come normale output del modello e **la corsa continua senza di essa**; **con `--auto`** risponde `decision: "once"`, cioè approva. `--auto` è dichiarato: `Flag.Boolean("auto").pipe(Flag.withDescription("Auto-approve permissions that are not explicitly denied"), Flag.withDefault(false))`, e `run` lo accende anche con gli alias **nascosti** `--yolo` / `--dangerously-skip-permissions` (`auto: input.auto || input.yolo || input.dangerouslySkipPermissions`).

Fuori dalla CLI (server/SDK), con `ask` la corsa **resta appesa**: `Permission.assert` crea il pending e `Deferred.await` finché qualcuno non risponde.

**Fuori dal permesso.** `Session.skill` (l'attivazione via API) **non chiama `permission.assert`**: `permission.skill` a v2.0.29 governa la chiamata del modello al tool `skill` (e l'elenco di guidance), **non** l'attivazione a livello di sessione.

### 6.8 Invocazione per nome: non c'è una forma slash per skill

Al tag v2.0.29 **non esiste** un comando `/skill-name`, e **il campo `opencode/slash`** citato dalla doc **non è letto da nessun file**: l'unico file che la ricerca restituisce per `opencode/slash` è `packages/web/src/content/docs/skills.mdx`. Il parser del frontmatter legge solo quattro campi (`packages/core/src/config/plugin/skill-file.ts`):

```ts
const Frontmatter = Schema.Struct({
  name: Schema.String.pipe(Schema.optional),
  description: Schema.String.pipe(Schema.optional),
  metadata: Schema.Unknown.pipe(Schema.optional),
  "disable-model-invocation": Schema.Unknown.pipe(Schema.optional),
})
```

```ts
  const opencodeAutoinvoke = metadataBoolean(frontmatter.metadata, "opencode/autoinvoke")
  const disableModelInvocation = booleanValue(frontmatter["disable-model-invocation"])
  const autoinvoke = opencodeAutoinvoke ?? (disableModelInvocation ? false : undefined)
```

e `Skill.Info` non ha nessun campo `slash` (`packages/schema/src/skill.ts`: `id`, `name`, `description`, `autoinvoke`, `path`, `content`).

Quello che esiste è **un solo** comando in TUI, `/skills`, che apre un dialogo e inserisce la skill come **mention** nell'input — non è un percorso per la corsa non interattiva (`packages/tui/src/component/prompt/index.tsx`):

```ts
      {
        title: "Skills",
        name: "prompt.skills",
        category: "Prompt",
        slash: { name: "skills" },
        run: () => {
          dialog.replace(() => (
            <DialogSkill
              location={currentLocation.ref}
              onSelect={(skill) => {
                if (store.prompt.skills?.some((item) => item.id === skill)) return
                const text = `@${skill}`
                ...
                    skills.push({
                      id: Skill.ID.make(skill),
                      mention: { start, end: start + promptOffsetWidth(text), text },
                    })
```

Il testo `@<id>` è solo l'eco visibile: ciò che conta è l'attachment `skills` prodotto qui (e dal composer dell'app). **`opencode run` non parsa slash né mention**: passa il messaggio a `session.prompt`. L'unico aggancio testuale è quello che la descrizione del tool dichiara — il modello può chiamare `skill` con l'id che l'utente ha nominato nel testo.

### 6.9 La forma di ciò che il modello riceve

Costruita in `packages/core/src/skill.ts` (usata sia dal tool sia dall'iniezione in un prompt):

```ts
export const toModelOutput = (skill: Info, files: ReadonlyArray<string>) => {
  const directory = path.dirname(skill.path)
  return [
    `<skill_content name="${skill.name}">`,
    `# Skill: ${skill.name}`,
    "",
    skill.content.trim(),
    "",
    `Base directory for this skill: ${directory}`,
    "Relative paths in this skill (e.g., scripts/, reference/) are relative to this base directory.",
    "Note: file list is sampled.",
    "",
    "<skill_files>",
    ...files.map((file) => `<file>${file}</file>`),
    "</skill_files>",
    "</skill_content>",
  ].join("\n")
}
```

con il campione di file (al massimo **10**, `SKILL.md` escluso):

```ts
export const prepare = Effect.fn("Skill.prepare")(function* (fs: FSUtil.Interface, skill: Info) {
  const directory = path.dirname(skill.path)
  const files =
    path.basename(skill.path) === "SKILL.md"
      ? (yield* fs.scan("**/*", { cwd: directory, absolute: true, include: "file", dot: true }))
          .filter((file) => path.basename(file) !== "SKILL.md")
          .toSorted()
          .slice(0, 10)
      : []
  return {
    directory,
    output: toModelOutput(skill, files),
  }
})
```

**Divergenza fra le due vie:** quando la skill è attivata con `Session.skill`, il testo del messaggio è `skill.content` **grezzo** (senza wrapper `<skill_content>` né base directory; `to-llm-message.ts`, case `"skill"`, lo passa così com'è). La frase della guidance — «its instructions appear in the conversation as a `<skill_content>` block» — descrive quindi **una sola** delle due vie.

### 6.10 Un pacchetto esterno può consegnare skill — in tre modi

**(a) Chiave `skills` della configurazione** — percorsi o URL (`packages/schema/src/config.ts`):

```ts
  skills: Schema.String.pipe(Schema.Array, optional).annotate({
    description: "Additional paths or URLs to discover skills from",
  }),
```

letta in `packages/core/src/config/plugin/skill.ts`, che aggiunge anche `<dir>/skill` e `<dir>/skills` di ogni directory di configurazione:

```ts
      const directories = loaded.entries.flatMap((entry) => (entry.type === "directory" ? [entry.path] : []))
      const items = loaded.entries.flatMap((entry) => (entry.type === "document" ? (entry.info.skills ?? []) : []))
      for (const directory of directories) {
        add(Skill.DirectorySource.make({ type: "directory", path: AbsolutePath.make(path.join(directory, "skill")) }))
        add(Skill.DirectorySource.make({ type: "directory", path: AbsolutePath.make(path.join(directory, "skills")) }))
      }
      for (const item of items) {
        if (URL.canParse(item) && /^(https?:)$/.test(new URL(item).protocol)) {
          add(Skill.UrlSource.make({ type: "url", url: item }))
          continue
        }
```

Una sorgente **URL** non è un repo ma un **`index.json`** su HTTP(S) (`packages/core/src/skill/discovery.ts`):

```ts
class IndexSkill extends Schema.Class<IndexSkill>("SkillDiscovery.IndexSkill")({
  name: Schema.String,
  version: Schema.optional(Schema.String),
  files: Schema.Array(Schema.String),
}) {}
```

```ts
        const sourceRoot = path.resolve(global.cache, "skills", Hash.fast(base))
```

cioè: catalogata in cache sotto `Hash.fast(base)`, con `version` per il refresh, e il file `SKILL.md` (o `<nome>.md`) deve comparire in `files`. I tipi delle sorgenti sono in `packages/schema/src/skill.ts`:

```ts
export type Source = DirectorySource | UrlSource | EmbeddedSource
```

**(b) Un plugin che registra skill da sé** — l'API `ctx.skill` (`packages/plugin/src/effect/skill.ts`):

```ts
export interface SkillEditor {
  list(): readonly Types.DeepMutable<Skill.Info>[]
  get(id: string): Types.DeepMutable<Skill.Info> | undefined
  add(skill: Skill.Info): void
  update(id: string, update: (skill: Types.DeepMutable<Skill.Info>) => void): void
  remove(id: string): void
}

export interface SkillDomain extends SkillApi<unknown> {
  readonly transform: Transform<SkillEditor>
  readonly reload: () => Effect.Effect<void>
}
```

Esempio reale in-tree, il plugin Figma che consegna 14 skill ufficiali (`packages/plugins/figma/index.ts`):

```ts
    await ctx.skill.transform((editor) => {
      skills.forEach((skill) => {
        if (!editor.get(skill.id)) editor.add(skill)
      })
    })
```

con `Skill.Info.make({ id, name, description, autoinvoke: markdown.data["disable-model-invocation"] !== true, path, content: markdown.content })`. Lo stesso meccanismo interno registra le due skill incorporate (`opencode`, `report`) in `packages/core/src/plugin/skill.ts`.

**(c) La via dell'utente dentro il progetto**: `.opencode/skills/<nome>/SKILL.md` (o `.claude/skills/…`, `.agents/skills/…`), con l'`id` uguale al nome della cartella (`skill-file.ts`: `path.basename(path.dirname(filepath))`) e `disable-model-invocation` accettato.

### 6.11 Cosa resta scoperto sulla Q2

- **`[to verify]`** se `opencode/slash` sia davvero inerte: la doc lo dichiara, il parser al tag non lo legge e `Skill.Info` non ha il campo, ma la code-search restituisce **solo** `skills.mdx`. Serve un grep locale su un checkout del tag.
- **`[to verify]`** un `@<id>` scritto **a mano** nel messaggio di una corsa non interattiva: dal codice letto non viene trasformato in attachment; che il modello lo interpreti come «riferimento esplicito dell'utente» e chiami il tool è da provare a runtime.
- **`[to verify]`** se esista un timeout per un `ask` che nessuno risponde in una sessione server (`Permission.assert` → `Deferred.await` senza timeout nel percorso letto).

---

## 7. Gli agenti (subagent)

Sul tag **v2.0.19** (e fino a **v2.0.28**) la superficie del multi-agente è **quasi immutata dal 2026-09-29**: `packages/core/src/tool/plugin/subagent.ts` è byte-identico fra v2.0.19, v2.0.22 e v2.0.28 tranne **una riga** (73: `SubagentJob.make` → `SubagentJob.Service`); `packages/plugin/src/effect/session.ts` e `.../tool.ts` hanno diff **vuoto** fra v2.0.22 e v2.0.28 — nessun hook o evento nuovo.

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
- **`subagent`** — invocabile solo via tool `subagent` / menzione `@`. Doc V2 (`agents.mdx`): «Runs only in a child session through the `subagent` tool.»
- **`all`** — entrambi.

Altri campi:
- **`hidden`** — nasconde il subagent dal menu `@` (default `false`, solo per `mode: subagent`); blocca anche l'uso come `default_agent`.
- **`model`** — `provider/model-id`. Se omesso: i primari usano il modello globale; **i subagent ereditano il modello del primario che li invoca**.
- **`variant`** — variante del modello; «applies only when using the agent's configured model».
- **`steps`** — iterazioni agentiche massime (lascito `maxSteps` normalizzato); al limite parte un prompt forzato text-only.
- **`permission`** — §7.5.
- **`prompt`** — stringa inline, o `{file:./path}` relativo al file di config; per markdown, il corpo.
- **`disable`** (`disabled` in V2) — `true` elimina l'agente.
- **`tools`** — **deprecato**; `true` ≡ `{"*": "allow"}`, `false` ≡ `{"*": "deny"}`.
- **`reasoningEffort`** — **non è un campo agente**: si imposta via `options` (es. `"options": { "reasoningEffort": "high" }`) o scegliendo una `variant`. **`[to verify]`**: nessuna chiave `reasoningEffort` a livello agente nello schema parsato.

### 7.3 Come il padre lancia un subagent

Sul tag **v2.0.19** (e fino a **v2.0.28**) il tool di delega è **`subagent`**, con parametri `agent`, `sessionID`, `model`. La forma **`task`** con `subagent_type`/`task_id`/`command` è la **linea V1** (docs di `packages/web`, `v1-migration`, TUI).

Descrizione del tool, verbatim (v2.0.28):

```
Spawns an agent in a child session to work on the specified task.
The output includes a sessionID you can pass back later to continue that specific conversation with the subagent.
New child sessions start with fresh context, so include all relevant context and instructions when you don't pass a sessionID.
Foreground (default) runs the subagent to completion and returns its final response.
Background mode (background=true) launches it asynchronously and returns immediately; you are notified when it finishes.
Use background only for independent work that can run while you continue elsewhere.
```

`Output = { sessionID, status: "completed" | "running", output }`; il risultato completato è avvolto in `<subagent sessionID="…" state="completed">…</subagent>`.

**`background` non è più sperimentale.** `search/code?q=EXPERIMENTAL_BACKGROUND_SUBAGENTS` → **0 risultati**; è uno `Schema.optionalKey(Schema.Boolean)` normale (sulla linea V1 era dietro la variabile d'ambiente `OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS=true`).

`execute` risolve l'agente per nome, crea una sessione figlia (`parentID`, `agent: next.name`), passa il ruleset di permessi risolto.

**La menzione `@nome`** è un secondo punto d'ingresso ma **non** un percorso separato: in `session/prompt.ts` un token `@x` che non è un file ma corrisponde a un agente diventa `{ type: "agent", name }` e il resolver inietta un testo sintetico: «Use the above message and context to generate a prompt and call the task tool with subagent: <name>». Quindi **`@nome` è prosa**: chiede al modello di chiamare il tool di delega; solo il modello obbedisce.

### 7.4 Il parallelismo è reale — e sta nel codice, non nella doc

La doc V2 **non afferma mai** che più subagent girano insieme. È il sorgente a farlo: `packages/core/src/session/runner/step.ts` crea una fiber per **ogni** evento `tool-call` dello stream del provider, e le attende tutte insieme:

```ts
toolRuns.push({
  call: event,
  fiber: yield* Effect.uninterruptibleMask((restore) =>
    restore(executeTool(event)).pipe(
      Effect.flatMap(toolOutput.truncate), …),
  ).pipe(Effect.forkScoped),
})
const joined = yield* restore(Fiber.awaitAll(toolRuns.map((run) => run.fiber)))
```

Commento nel sorgente: «Provider and tool fibers retain per-source order without a shared writer queue.» → **più chiamate `subagent` nello stesso messaggio girano in concorrenza**, con fork immediato, non in serie.

**Nessun tetto di concorrenza dichiarato** trovato in `subagent.ts`, `session/runner/step.ts`, `job.ts`. **`[to verify]`**

Storico: `fix(core): run command subagents in the background (#47081)`, 2026-09-03; `feat(core): let subagents pick a model and expose models tool (#49194)`, 2026-09-16; `fix(core): preserve subagent notifications across location eviction (#54072)`, 2026-10-09.

### 7.5 DECISIVO: quanta parte del confine è imposta dal codice

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
3. **Gating della delega.** Il tool di delega (`task` in V1, `subagent` in V2) chiama `ctx.ask({ permission: "task"|"subagent", patterns: [<agente>] })`; un deny lancia. `ToolRegistry.describeTask` filtra i subagent negati dalla descrizione del tool.

**Chiavi dei permessi** (doc `/docs/permissions`): `read`, `edit`, `glob`, `grep`, `list`, `bash`, `task` (→ **`subagent`** in v2.0.19), `skill`, `lsp`, `question`, `webfetch`, `websearch`, `external_directory`, `doom_loop`. **Azioni** (V1, `packages/core/src/v1/config/permission.ts`):

```ts
Action = Literals(["ask", "allow", "deny"])
```

**Nome dell'azione di delega — divergenza.** La doc e il sorgente corrente (`dev`) usano **`task`**; l'installato **v2.0.19** usa **`subagent`** (provato da `opencode debug agents`: `explore` e `general` portano `{ "action": "subagent", "resource": "*", "effect": "deny" }`). Scrivere **`subagent`** su 2.0.19, `task` sulla linea V1. Doc V2 (`agents.mdx`): azione permesso `subagent` = «Child agents», risorsa = «Target agent ID».

**Enforcement del «leaf» (subagent annidati).** `packages/opencode/src/agent/subagent-permissions.ts` costruisce il ruleset della sessione figlia aggiungendo per default `{ permission: "task"|"subagent", pattern: "*", action: "deny" }` (e `todowrite` deny) **a meno che** il subagent non permetta già il tool di delega. Risultato: un subagent non può generare nipoti se non gli è esplicitamente concesso. Doc V2 (`agents.mdx`), builtin **General**: «Handles research and multi-step work with broad tool access, but **cannot launch more subagents**.»

**`subagent_depth` è imposto.** `packages/core/src/tool/plugin/subagent.ts` (v2.0.28), verbatim:

```ts
const limit = Config.latest(yield* config.entries(), "experimental")?.subagent_depth ?? 1
if (depth >= limit)
  return yield* new ToolFailure({
    message: `Subagent depth limit reached (${limit}). Increase "experimental.subagent_depth" to allow nested subagents.`,
  })
```

`depth` si conta risalendo la catena `parentID`. Schema in `packages/schema/src/config/experimental.ts`: `subagent_depth: NonNegativeInt.pipe(optional)`, annotato «Maximum subagent nesting depth. Defaults to 1.»; `packages/core/src/config/normalize.ts` lo accetta **solo** sotto `experimental` — la doc lo mostra invece a top-level (incoerenza doc/`normalize`). Doc V2, verbatim: «The default is `1`, which allows primary agents to launch subagents but prevents those subagents from launching additional subagents. Set it to `2` to allow one additional level of nested subagents, or `0` to prevent all subagent launches.» (`tools.mdx`: «Only subagent-mode agents can be used, and the default nesting depth is one.») `0` vieta ogni lancio, `2` consente un livello di annidamento.

**Conseguenza operativa.** Al default **nessuna catena che deleghi due volte si compone**: `research → study`, `review → finder`, `commit → update-memory`, `new-feature → decision-doc` chiedono `experimental.subagent_depth: 2`; la catena a quattro livelli di Daiku ne chiede almeno tre. La chiave è **sperimentale**.

**Cosa è prosa, non confine:** la menzione `@nome`; la visibilità `hidden`; le descrizioni. La guida del tool di delega nomina il lancio concorrente, ma sulla V2 il parallelismo **reale** è nel **codice** (§7.4), non nella doc. `permission.task`/`permission.subagent` **sì** controlla quali subagent possono essere invocati (non è solo una lista).

**Evidenza locale (v2.0.19, `opencode debug agents`):**
- `plan` (primario, read-only): `{action:"edit",resource:"*",effect:"deny"}` + `{action:"edit",resource:"C:\\Users\\tomas\\.opencode\\plan\\*",effect:"allow"}`; `question` allow.
- `explore` (subagent): `{"*","*",deny}` poi riabilita `grep`,`glob`,`webfetch`,`websearch`,`read`, più `{action:"subagent",resource:"*",effect:"deny"}` → leaf, non edita, non esegue bash.
- `general` (subagent): `{action:"question",deny}` e `{action:"subagent",deny}` → leaf che non può chiedere all'utente.
- `build` (primario): `{action:"question",allow}`.

**Divergenze V2 sull'agente:** `explore` in v2.0.19 è più chiuso che in `dev` (che riabilita anche `bash`/`list`); `scout` è documentato ma **assente** in v2.0.19 (`debug agents` elenca solo `explore` e `general`). Doc V2 (`agents.mdx`): «V2 has no built-in `scout` agent.» **`[to verify]`**: se `scout` esista sulla linea V1 o solo su build più nuove.

### 7.6 Ciclo di vita dei subagenti: nessun hook

`search/code` → `SubagentStop`: **0**, `SubagentStart`: **0**, `"session.subagent"`: **0**, `"subagent.stop"`: **0**. In `packages/schema/src/session-event.ts` nessun tipo con `subagent`/`child`; `session.idle` è marcato `// deprecated` (sostituito da `session.status`, con `idle|retry|busy`). Il completamento di un subagent arriva come **messaggio sintetico** dell'utente (`sessions.synthetic`, `metadata: { source: "subagent", childID, agent, state }`), non come evento dedicato — quindi **nessun punto deterministico in cui un plugin possa osservare un figlio che finisce**.

Issue **#20387** («Plugin hooks should support reactive sub-agent spawning», 2026-04-01) dichiara che gli hook opencode «can only react (block/allow/modify), never analyze and advise»; **chiusa dal proponente**, non risolta.

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

> **Due API, non una.** Le §10.1-10.6 descrivono l'**API piatta `@opencode-ai/plugin`** (export `Plugin` + oggetto hook), che è l'API della **linea V1**. Sulla **V2** (installata qui) l'API è **per dominio** e **non retrocompatibile**: un plugin scritto sull'API piatta **non gira** sulla 2.0.29 (§10.7, §10.8, §19 ⚠️). **Ciò che regge di entrambe:** un plugin **nega un gesto solo lanciando un'eccezione**, mai con un campo di ritorno (§10.5).

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

**Sì — un plugin può bloccare una tool call e un comando, ma solo LANCIANDO un'eccezione. Non c'è un campo di ritorno né un «deny» su quegli hook.** (Vale identico sulla V2: `ctx.tool.hook("execute.before")` è l'unico hook tool che può fallire — §10.7.)

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

### 10.7 ⚠️ L'API dei hook V2 è per dominio (non piatta)

L'API piatta delle §10.3 (`tool.execute.before`, `chat.message`, `chat.params`, `chat.headers`, `config`, `event`) è **V1**. Sulla V2 l'API è **per dominio** (invariata fra 2.0.22 e 2.0.28):

- `SessionHooks`: `prompt`, `context`, `compaction`, `generate`, `title`, `model.request`, `http.request`, `http.response`, `retry`, `experimental.ws.handshake|send|receive`
- `ToolHooks`: `execute.before`, `execute.after` — **solo `execute.before` può fallire**
- `ctx.shell.hook("create.before")`, `ctx.permission.hook("evaluate")`, `ctx.aisdk.hook("sdk"|"language")`, transform per dominio (`agent`, `command`, `integration`, `mcp`, `model`, `provider`, `reference`, `skill`, `tool`, `vcs`, `websearch`), `ctx.event.subscribe()`

Tabella di migrazione, verbatim: `chat.message → session.hook("prompt")`, `chat.params → "context"`, `chat.headers → "model.request"|"http.request"`, `config → transforms`, `tool.execute.before → ctx.tool.hook("execute.before")`, `experimental.session.compacting → session.hook("compaction")`.

**Ciò che della §10 regge:** il diniego passa **solo lanciando un'eccezione** da `execute.before`; non c'è campo di ritorno che dica «nega». Un plugin scritto sull'API piatta **non gira** sulla 2.0.29 (§19 ⚠️).

La parte seguente (10.8-10.14) è letta al tag `v2.0.29`: la forma viva di un plugin, i domini con hook, e cosa un plugin può avviare o negare.

> Tutto letto al tag **`v2.0.29`** (`raw.githubusercontent.com` e `gh api`). Niente da memoria.

### 10.8 La forma viva di un plugin (la doc V1 non vale più)

Il loader accetta **solo due forme**, entrambe con `id` obbligatorio — `packages/core/src/plugin/module.ts`:

```ts
const Module = Schema.Struct({
  default: Schema.Union([
    Schema.Struct({
      id: Schema.String,
      effect: Schema.declare<Plugin["effect"]>((input): input is Plugin["effect"] => typeof input === "function"),
    }),
    Schema.Struct({
      id: Schema.String,
      setup: Schema.declare<Parameters<typeof PluginPromise.fromPromise>[0]["setup"]>(
        (input): input is Parameters<typeof PluginPromise.fromPromise>[0]["setup"] => typeof input === "function",
      ),
    }),
  ]),
})
```

```ts
  const plugin = "effect" in value ? value : PluginPromise.fromPromise(value)
```

Messaggio d'errore verbatim: `"Plugin must export a default definition with an id and an effect or setup function."`

Le due forme sono `@opencode/plugin/effect` (`Plugin.define({ id, effect })`, `packages/plugin/src/effect/plugin.ts`) e `@opencode/plugin` (`Plugin.define({ id, setup })`, `packages/plugin/src/promise/plugin.ts`), dichiarate in `packages/plugin/package.json`:

```json
  "exports": {
    ".": "./src/promise/index.ts",
    "./effect": "./src/effect/index.ts",
```

**La forma V1 (funzione che ritorna un oggetto di hook a chiave stringa) non si carica più.** La doc che la descrive — `packages/web/src/content/docs/plugins.mdx`, con `export const MyPlugin = async ({ project, client, $, directory, worktree }) => { return { "tool.execute.before": ... } }` — è doc **V1**. La V2 lo dice esplicito in `services/www/src/docs/content/build/plugins/migrate-v1.mdx`: «V1 plugin implementations do not run in V2. Moving a file or renaming its config entry does not add up.» La doc V2 vive sotto `services/www/src/docs/content/build/plugins/`.

### 10.9 L'elenco chiuso dei domini con hook

`packages/core/src/plugin/hooks.ts`:

```ts
export interface Domains {
  readonly aisdk: AISDKHooks
  readonly session: SessionHooks
  readonly permission: PermissionHooks
  readonly shell: ShellHooks
  readonly tool: ToolHooks
}
```

**`tool`** — `packages/plugin/src/effect/tool.ts`:

```ts
export interface ToolHooks {
  readonly "execute.before": { tool: string; readonly sessionID: Session.ID; readonly agent: Agent.ID; readonly messageID: SessionMessage.ID; readonly id: Tool.CallID; input: unknown }
  readonly "execute.after": { readonly tool: string; readonly sessionID: Session.ID; readonly agent: Agent.ID; readonly messageID: SessionMessage.ID; readonly id: Tool.CallID; readonly input: unknown } & (
    | { readonly status: "completed"; result: Tool.Result }
    | { readonly status: "error"; error: Tool.Error }
  )
}
```

**`session`** — `packages/plugin/src/effect/session.ts` (12 hook):

```ts
export interface SessionHooks {
  readonly prompt: SessionPrompt
  readonly context: SessionContext
  readonly compaction: SessionCompaction
  readonly generate: SessionGenerate
  readonly title: SessionTitle
  readonly "model.request": SessionModelRequest
  readonly "http.request": SessionHttpRequest
  readonly "http.response": SessionHttpResponse
  readonly "experimental.ws.handshake": SessionWebSocketHandshake
  readonly "experimental.ws.send": SessionWebSocketSend
  readonly "experimental.ws.receive": SessionWebSocketReceive
  readonly retry: SessionRetry
}
```

**`permission`** — un solo hook, `evaluate` (`packages/plugin/src/effect/permission.ts`). **`shell`** — un solo hook, `"create.before"` (`packages/plugin/src/effect/shell.ts`). **`aisdk`** — `sdk` e `language` (`packages/plugin/src/effect/aisdk.ts`).

**Tutto il resto non è un hook: sono `transform`** (ricostruzione di stato, callback sincrona) — `packages/plugin/src/effect/README.md` elenca `ctx.agent.transform`, `command`, `integration`, `mcp`, `model`, `provider`, `reference`, `skill`, `tool`, `vcs`, `websearch`, col rispettivo `.reload()`. Verificato per file: `grep hook` su `rpc.ts`, `integration.ts`, `mcp.ts`, `model.ts`, `provider.ts`, `reference.ts`, `vcs.ts`, `websearch.ts`, `storage.ts`, `worktree.ts` non trova nessuna proprietà `hook`; `effect/agent.ts` e `effect/command.ts` hanno `transform` + `reload` e nessun hook.

La differenza sta nei tipi, `packages/plugin/src/effect/registration.ts`:

```ts
export type Transform<Input> = (callback: (input: Input) => void) => Effect.Effect<Registration, never, Scope.Scope>
```

```ts
export type Hooks<Spec, Failures extends Record<keyof Spec, unknown> = Record<keyof Spec, never>> = <Name extends keyof Spec>(
  name: Name,
  callback: (input: Spec[Name]) => Effect.Effect<void, Failures[Name]>,
) => Effect.Effect<Registration, never, Scope.Scope>
```

`ctx.event.subscribe(...)` **non è un hook**: è uno stream in sola lettura (`packages/plugin/src/effect/event.ts` è solo `Pick<EventApi<unknown>, "subscribe">`).

### 10.10 DECISIVO: sì, un plugin **avvia** — non solo reagisce

Il contesto **è** il client, e il dominio `session` espone gli atti di avvio. `packages/plugin/src/effect/session.ts`:

```ts
export type SessionDomain = Pick<
  SessionApi<unknown>,
  | "create" | "get" | "remove" | "switchAgent" | "switchModel" | "prompt" | "generate"
  | "command" | "compact" | "synthetic" | "interrupt" | "update" | "move" | "wait" | "context"
> & {
  readonly hook: ModelHooks<SessionHooks>
}
```

e in `packages/core/src/plugin/host.ts` ogni voce è cablata su un servizio vero:

```ts
      prompt: sessions.prompt,
      generate: (input) => sessions.generate(input).pipe(Effect.map((text) => ({ text }))),
      command: (input) => sessions.command({ ...input, command: input.name }),
```

La doc V2 (`services/www/src/docs/content/build/plugins/effect.mdx`, § Sessions) lo mostra in chiaro:

```ts
    const created = yield* session.create({ title: "Automation" }).pipe(Effect.orDie)
    yield* session.prompt({ sessionID: created.id, text: "Review the current changes" }).pipe(Effect.orDie)
    const summary = yield* session
      .generate({ sessionID: created.id, prompt: "Summarize this project" })
      .pipe(Effect.orDie)
    yield* session.command({ sessionID: created.id, command: "review", arguments: "--staged" }).pipe(Effect.orDie)
```

Concretamente:

- **Creare una sessione**: `ctx.session.create(input?)`; `SessionCreateInput` (`packages/client/src/effect/api/api.ts`) ha `id`, `parentID`, `title`, `agent`, `model`, `location`, `metadata`, `permissions`.
- **Lanciare un subagent**: sì, via `parentID` + `agent` su `create` — `host.ts` passa `parentID` alla `sessions.create` reale (`...(input?.parentID === undefined ? { location: ... } : { parentID: input.parentID })`). Su opencode un subagent **è** una sessione figlia. **`[to verify]`**: se esista un subagent *in background* fuori da `parentID` — il dominio del plugin non espone `sessions.background`, che invece sta in `SessionApi`.
- **Mandare un prompt**: `ctx.session.prompt({ sessionID, text, files?, agents?, skills?, metadata?, delivery?, resume? })`; output `SessionInbox.User`.
- **Eseguire un comando**: `ctx.session.command({ sessionID, name, text, ... })`.
- **Generazione transitoria fuori sessione**: `ctx.generate.text({ prompt, model? })` → `{ text }`.
- **Definire un comando con proprio `execute`**: `packages/plugin/src/effect/command.ts` — `CommandDefinition { name, description?, execute: (input: CommandInvocation) => Effect.Effect<void, unknown> }`, registrato via `ctx.command.transform((editor) => editor.add(...))`; l'`execute` del plugin gira quando **l'utente** lancia quel nome.
- `ctx.session.synthetic`, `compact`, `interrupt`, `wait`, `move`, `update`, `switchAgent`, `switchModel` sono parimenti disponibili.

**Verdetto.** Gli **hook** sono intercettazioni; il **contesto** no. Un plugin può essere il **primo motore** di una corsa (crea sessione → prompt → attende), non solo il suo spettatore.

### 10.11 Cosa un plugin può negare — e cosa no

**a. Il diniego per eccezione esiste in un solo punto: `tool.hook("execute.before")`.** `packages/plugin/src/effect/tool.ts`:

```ts
// Only execute.before may fail: a Tool.Error rejects the call before the tool runs.
export interface ToolFailures extends Record<keyof ToolHooks, unknown> {
  readonly "execute.before": Tool.Error
  readonly "execute.after": never
}
```

e il core concorda, `packages/core/src/plugin/hooks.ts`:

```ts
// Failure channel for each hook event. Only tool execute.before may fail: a Tool.Error rejects the call before it runs.
interface Failures extends Record<keyof Domains, unknown> {
  readonly aisdk: NoFailures<AISDKHooks>
  readonly session: NoFailures<SessionHooks>
  readonly permission: NoFailures<PermissionHooks>
  readonly shell: NoFailures<ShellHooks>
  readonly tool: ToolFailures
}
```

Cioè: `session.*`, `permission.evaluate`, `shell.create.before` e `aisdk.*` hanno canale d'errore `never` — **non possono far fallire l'operazione**. Il `trigger` di `packages/core/src/plugin/hooks.ts` fa `yield* result` per ogni callback e ritorna l'evento: mutano l'evento, non lo respingono. Nella API Promise il gesto è il `throw` (esempio V2 in `migrate-v1.mdx`: `throw new Error("Do not read .env files")` dentro `ctx.tool.hook("execute.before", ...)`).

**b. Il diniego senza eccezione: `permission.hook("evaluate")`.** L'evento è mutabile in `effect` e `message` (`packages/plugin/src/effect/permission.ts`):

```ts
export interface PermissionEvaluation {
  readonly sessionID: Session.ID
  readonly agent?: Agent.ID
  readonly action: string
  readonly resources: ReadonlyArray<string>
  readonly metadata?: Record<string, unknown>
  readonly source?: Permission.Source
  effect: Permission.Effect
  message?: string
}
```

`Permission.Effect` è `Schema.Literals(["allow", "deny", "ask"])` (`packages/schema/src/permission.ts`). Doc V2 (`build/plugins/index.mdx`, § Permissions), verbatim:

```text
- Hooks run for `allow` and `ask` decisions.
- An explicit configured `deny` is final and does not invoke the hook.
- A hook may change `effect` to `allow`, `ask`, or `deny`.
- `message` appears in an escalated permission request or becomes the denial reason.
```

Il core tiene la stessa regola, `packages/core/src/permission.ts`:

```ts
    const evaluateInput = Effect.fnUntraced(function* (input: AssertInput) {
      const rules = yield* configured(input.sessionID, input.agent)
      if (denied(input, rules)) return { effect: "deny" as const, rules }
      ...
      const event = yield* hooks.trigger("permission", "evaluate", { ..., effect })
      return { effect: event.effect, message: event.message, rules: all }
    })
```

e il `deny` prodotto dall'hook diventa un `BlockedError` il cui `reason` è il `message` dell'hook:

```ts
            if (result.effect === "deny") {
              return yield* new BlockedError({
                rules: relevant(input, result.rules),
                permission: input.action,
                resources: input.resources,
                reason: result.message,
              })
            }
```

**c. Cosa *non* si può intercettare:**

- Un `deny` **configurato** (regole dell'agente o della sessione) è **finale**: l'hook non viene nemmeno chiamato (la riga `if (denied(input, rules)) return ...` precede il trigger).
- `session.hook("prompt")` (l'**ammissione** del prompt utente) **non può rifiutare**: la doc dice «Prompt hooks transform input and do not expose a typed rejection API» e «Session and message IDs are readonly; a hook cannot redirect admission».
- **Non esiste** un hook sulla lettura/scrittura di file (solo via `tool.execute.before`), né su LSP, MCP, caricamento della config (la config è `transform` di dominio), ammissione in inbox, o `command.execute.before` globale — la tabella di migrazione dice: «`command.execute.before` also has no one-to-one global hook».
- `tool.execute.after` **non può fallire** (canale `never`): può solo guardare e sostituire il `result`.

### 10.12 Il commit `#54930` — «let plugins assert permissions»

Sha `6a7cedcbf1823eeb1c8dfc4baf5a7951854f578b`. File toccati:

```text
modified  packages/core/src/plugin/host.ts                              +10/-0
modified  packages/core/test/fixture/policy.ts                          +1/-0
modified  packages/core/test/plugin/host.ts                             +1/-0
added     packages/core/test/plugin/permission-assert.test.ts           +91/-0
modified  packages/plugin/src/effect/permission.ts                      +9/-0
added     packages/plugin/src/permission.ts                             +14/-0
modified  packages/plugin/src/promise/adapter.ts                        +3/-0
modified  packages/plugin/src/promise/permission.ts                     +8/-0
```

**Cos'è un "assert".** Non è un meccanismo di diniego: è un attrezzo **dal lato di chi chiama** — il plugin chiede all'host di valutare le regole di permesso della sessione e, se serve approvazione, di chiedere all'utente e attendere la risposta. Commento verbatim in `packages/plugin/src/effect/permission.ts`, aggiunto da questo commit:

```ts
  /**
   * Evaluates the session's permission rules and, when approval is required, prompts the user and
   * waits for the reply. Succeeds when allowed. A deny rule or a rejection with feedback fails with a
   * `Tool.Error` carrying the reason; a plain rejection ends the current step.
   */
  readonly assert: (input: AssertInput) => Effect.Effect<void, Tool.Error>
```

Nella API Promise (`packages/plugin/src/promise/permission.ts`):

```ts
  readonly assert: (input: typeof AssertInput.Encoded) => Promise<void>
```

**La firma dell'input** vive in un file nuovo, `packages/plugin/src/permission.ts` (14 righe, tutto il file):

```ts
import { Agent } from "@opencode/schema/agent"
import { Permission } from "@opencode/schema/permission"
import { Schema } from "effect"

export const AssertInput = Schema.Struct({
  sessionID: Permission.Request.fields.sessionID,
  agent: Agent.ID.pipe(Schema.optional),
  action: Permission.Request.fields.action,
  resources: Permission.Request.fields.resources,
  save: Permission.Request.fields.save,
  metadata: Permission.Request.fields.metadata,
  source: Permission.Request.fields.source,
})
export interface AssertInput extends Schema.Schema.Type<typeof AssertInput> {}
```

Da notare: **niente `id`**, che invece l'`AssertInput` del core in `packages/core/src/permission.ts` ha.

**Il cablaggio**, `packages/core/src/plugin/host.ts`:

```ts
      // Plain rejections stay defects, as for built-in tools, so they end the step.
      assert: (input) =>
        permission.assert(input).pipe(
          Effect.catchTags({
            "Permission.BlockedError": (error) => Effect.fail(new Tool.Error({ message: error.message, error })),
            "Permission.CorrectedError": (error) => Effect.fail(new Tool.Error({ message: error.feedback, error })),
            "Session.NotFoundError": (error) =>
              Effect.fail(new Tool.Error({ message: `Session not found: ${error.sessionID}`, error })),
          }),
        ),
```

**Il banco** (`packages/core/test/plugin/permission-assert.test.ts`) fissa i quattro esiti:

- `allow` → `assert` riesce;
- regola di deny → `Tool.Error` con `message: "Permission denied: blocked"` e `error` `Permission.BlockedError`;
- rifiuto **con** feedback → `Tool.Error` col `message` uguale al feedback (`"Use staging"`, da `CorrectedError`);
- rifiuto **secco** → `Effect.die` di `Permission.DeclinedError`, un **defect** e non un errore tipizzato: «Plain rejections stay defects ... so they end the step».

**`assert` può trasformare un permesso in `deny`? No.** `assert` *subisce* la valutazione (compreso l'hook `evaluate`); chi trasforma in `deny` è `ctx.permission.hook("evaluate")` mutando `event.effect`. `assert` è il modo con cui il plugin si mette **lui** sotto le regole della sessione prima di fare qualcosa.

**Non documentato a v2.0.29**: `assert` ha **zero occorrenze** in `services/www/src/docs/content/build/plugins/index.mdx` e `.../effect.mdx`; esiste solo nel sorgente e nel suo banco. Nota collaterale: `index.mdx` mostra `await ctx.permission.rules({ sessionID, permissions: [...] })`, ma `PermissionApi` (`packages/client/src/effect/api/api.ts`) espone `request.list`, `saved.list/remove`, `create`, `list`, `get`, `reply` — **nessun `rules`**, e il dominio del plugin ne seleziona solo `list | get | reply`. **`[to verify]`** quale sia oggi la via per sostituire le regole di permesso di sessione da un plugin.

### 10.13 Prompt e system prompt

L'equivalente di `experimental.chat.system.transform` a v2.0.29 è il hook `session` **`context`**, e i campi sono mutabili — `packages/plugin/src/effect/session.ts`:

```ts
export interface SessionRequest {
  readonly sessionID: Session.ID
  readonly model: Model.Ref
  system: Array<SystemPart>
  messages: Array<Message>
  options: SessionRequestOptions
}

export interface SessionContext extends SessionRequest {
  readonly agent: Agent.ID
  tools: Record<string, { description: string; input: JsonSchema.JsonSchema }>
}
```

Doc V2 (`build/plugins/index.mdx`):

```ts
await ctx.session.hook("context", (event) => {
  event.system.push({ type: "text", text: "Keep the review focused on correctness." })
  delete event.tools.write
  event.options.temperature = 0.2
  event.options.maxTokens = 8_000
})
```

Tabella di migrazione (`migrate-v1.mdx`), verbatim:

```text
| `experimental.chat.system.transform`   | `ctx.session.hook("context", ...)` and edit `event.system`   |
| `experimental.chat.messages.transform` | `ctx.session.hook("context", ...)` and edit `event.messages` |
| `experimental.session.compacting`      | `ctx.session.hook("compaction", ...)`                        |
```

Il nome `experimental.chat.system.transform` a v2.0.29 sopravvive **solo** in quella tabella (lato V1). Avvertenze della doc: «A hook that should apply to every request must register for each kind»; «Changes affect only the outgoing model call, not persisted history or configuration». Gli altri punti d'attacco sulla richiesta sono `context` (il loop dell'agente), `compaction`, `generate`, `title` (richieste ausiliarie; `compaction` e `title` accettano un `result` che salta la chiamata al modello), più `model.request`, `http.request`, `http.response`, i tre `experimental.ws.*` e `retry`.

Sul **prompt utente** il hook è `session.hook("prompt")`: `prompt: Types.DeepMutable<PromptInput.Prompt>`, con `metadata` e `delivery` mutabili ma `sessionID`/`messageID` readonly; le modifiche «become the canonical persisted user input». Nota: `prompt` c'è in `effect/session.ts` e in `promise/session.ts`, ma **manca** nella tabella-reference di `effect.mdx` (§ Hooks → Sessions), che elenca solo `context, compaction, generate, title, model.request, http.request, http.response, experimental.ws.*, retry`.

La **descrizione dei tool vista dal modello** si tocca in due modi: dalla callback `context` (`event.tools` è mutabile, si può cancellare una voce) e in modo durevole dal `tool.transform` (`ToolEditor.update(id, (tool) => { tool.description = ... })`).

### 10.14 Cosa resta scoperto sulla Q3

- **`[to verify]`** esiste un subagent **in background** fuori da `parentID` su `session.create`? Il dominio del plugin non espone `sessions.background` / `fork` / `shell`, che pure stanno in `SessionApi`.
- **`[to verify]`** cosa succede oggi a un plugin **V1** in 2.0.29: il loader letto accetta solo `effect`/`setup` e `migrate-v1.mdx` dice che non girano, ma il percorso che (se esiste) accetta ancora un export `server()` non è stato letto. Il commento in `module.ts` — «Legacy auto-discovery still admits standalone server sources» — riguarda le *sorgenti*, non gli hook ritornati.
- **`[to verify]`** un **defect** (throw) dentro un hook a canale `never` (`session`, `permission.evaluate`, `shell`, `aisdk`) abortisce o no l'operazione: il tipo dice `Effect.Effect<void, never>` e `trigger` fa `yield* result` senza `catchAll`, ma il call-site non è stato letto.
- **`[to verify]`** quale sia il metodo per **sostituire le regole di permesso di sessione** da plugin (§10.12).

---

## 11. Configurazione, istruzioni e MCP

### 11.1 File e precedenza

**V2:** globale `~/.config/opencode/opencode.json(c)`; progetto `<project>/opencode.json(c)` **o** `<project>/.opencode/opencode.json(c)`. JSON **e** JSONC. `$schema`: `"https://opencode.ai/config.json"`. Ordine di risalita e di merge: §5.1. Merge per chiave (non replace).

**V1** (per la doc `/docs`): stesse posizioni; env `OPENCODE_CONFIG` (file, tra globale e progetto), `OPENCODE_CONFIG_DIR`, `OPENCODE_CONFIG_CONTENT`, `OPENCODE_TUI_CONFIG`. Precedenza: `.well-known/opencode` remoto → globale → `OPENCODE_CONFIG` → progetto → `.opencode` → `OPENCODE_CONFIG_CONTENT` → file gestiti (`%ProgramData%\opencode` su Windows) → MDM macOS.

### 11.2 Chiavi (V2, dalla pagina `/v2/docs/config` + tabella di migrazione)

`shell` · `model` (`provider/model`) · `default_agent` · `update` (`"disable"|"notify"|"auto"`, default `"notify"`, solo globale) · `share` (`"manual"|"auto"|"disabled"`) · `username` · `permissions` (array ordinato di `{action, resource, effect}`) · `agents` (mappa: `description`, `mode`, `system`, `permissions`) · `snapshots` · `watcher` (`{ignore:[...]}`) · `formatter` (bool) · `media.image` · `tool_output` · `websearch` · `mcp.servers` · `compaction` · `warming` · `skills` (array dir/URL) · `commands` · `instructions` · `references` · `worktree.directory` · `plugins` (array di `string` o `{package, options}`) · `providers` · `experimental.policies`.

**Chiavi V1** (per la linea `/docs`): `mcp` (server direttamente sotto `mcp`), `permission` + `tools`, `plugin` (array di nomi npm), `instructions` (array **caricato**), `skills: {paths, urls}`, `subagent_depth` (default 1), `share`, `autoupdate`, `compaction: {auto, prune, reserved}`, `provider.<id>.options`, `formatter`/`lsp` (bool o oggetto).

**⚠️ Rinomine V1→V2** (da `migrate-v1`): `plugin`→`plugins`, `provider`→`providers`, `agent`/`mode`→`agents`, `command`→`commands`, `reference`→`references`, `snapshot`→`snapshots`, `attachment`→`media`, `autoshare`→`share`, `permission`+`tools`→un array ordinato `permissions`, `autoupdate`→`update`, `small_model`→`agents.title.model`; campi `prompt`→`system`, `disable`→`disabled`, `maxSteps`→`steps`, `subtask`→`subagent`; azioni `bash`→`shell`, `task`→`subagent`, `write`/`patch`→`edit`; MCP sotto `mcp.servers` con `enabled`→`disabled`; skill `paths`/`urls`→un array; provider `npm`→`package`, `api`→`settings.baseURL`. **Accettate ma ignorate con warning:** `logLevel`, `server`, `subagent_depth` top-level (V2: va sotto `experimental`, §7.5), `compaction.tail_turns`/`prune`, agente `name`, e sperimentali `batch_tool`/`openTelemetry`/`primary_tools`/`continue_loop_on_deny`. `lsp` è accettato ma **i language server non girano in V2**.

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

## 12. Provider, modelli e tool calling

### 12.1 ⚠️ V1 e V2 configurano i provider in modo diverso

**V2** — chiave **`providers`** (plurale), doc `https://dev.opencode.ai/v2/docs/providers/`. Verbatim: «The `providers` object is keyed by the provider ID used in model references, such as `acme/qwen3-coder`.» Chiavi per provider: `name`, `env`, `package`, `canonical`, `compatibility`, `settings`, `headers`, `body`, `models`. Esempio custom OpenAI-compatible (frammenti verbatim): `"env": ["ACME_API_KEY"]`, `"package": "@opencode/ai/providers/openai-compatible"`, `"settings": { "baseURL": "https://llm.acme.example/v1" }`. Un package AI SDK richiede il prefisso `aisdk:`.

**V1** — chiave `provider` (singolare), con `npm`, `options.baseURL`, `options.apiKey`, `options.headers`, `limit`, `blacklist`/`whitelist`.

Auth: la V2 documenta `/connect` poi `/models`; il comando letterale `opencode auth login` **non compare** nelle pagine lette. **`[to verify]`**

### 12.2 Il tool calling è una capability per modello, non un fatto del provider

`packages/core/src/models-dev.ts`: `readonly tool_call: boolean` → `tools: model.tool_call`. La migrazione lo conferma: «`tool_call` and `modalities` become `capabilities.tools`, `capabilities.input`, and `capabilities.output`».

**`models.dev` espone `"tool_call": true|false` per modello**, e dove è `false` opencode **spegne i tool** per quel modello. Avvertenze verbatim: per vLLM «its discovery cannot infer tool support, so discovered vLLM models **start with tools disabled**»; per gli endpoint custom le capability sono «fallback assumptions, not detected capabilities».

→ **Non si sceglie un provider, si sceglie un modello che dichiari `tool_call: true`.**

### 12.3 I tetti dei tier gratuiti (fonti dei provider, 2026-10-13)

| Provider | Limiti documentati | Carta di credito |
|---|---|---|
| **OpenRouter** (`:free`) | **20 RPM / 50 RPD** sotto 10 crediti comprati; 20 RPM / 1000 RPD da ≥10 crediti. «Making additional accounts or API keys will not affect your rate limits» | No |
| **Groq** | `openai/gpt-oss-120b`: 30 RPM / 1K RPD / **8K TPM** / 200K TPD | Non dichiarato |
| **Cerebras** | Free Trial: 5 RPM / 30K TPM / 1M TPD — ma senza metodo di pagamento verificato «Playground and API access remain inactive» | **Sì** |
| **Google AI Studio** | Tier Free esiste, nessun billing richiesto; **RPM/TPM/RPD non pubblicati** (solo dashboard) | No |
| **GitHub Copilot Free** | 2000 completions/mese; agent mode e MCP inclusi nel Free; terze parti no | No |
| **Ollama / LM Studio / vLLM** | Nessun tetto di rete (locale). Ollama `/v1/chat/completions` dichiara Tools ma **`tool_choice` non supportato** | No |
| **OpenCode Zen / Console** | modelli «Free» elencati (Big Pickle, Nemotron 3 Ultra Free, Ling 3.1 Flash Free, …); **nessun RPM/TPM pubblicato**; i dati dei free «may train models» | — |

Mistral: la pagina dei tier risponde **404** alla verifica. **`[to verify]`**

Utile: il router **`openrouter/free`** filtra da sé — «intelligently filters for models that support the features your request needs … such as image understanding, **tool calling**, and structured outputs».

### 12.4 L'attrito dell'agent loop su endpoint gratuiti (issue del repo)

- **#51241** (2026-09-25) «Free models fail when `shell` or `read` permissions are denied» → con permesso `deny` danno `Error: OpenCode's free tier can only be used from within OpenCode`; tornano a funzionare con `allow`. Cioè: **il tier gratuito e i permessi di Daiku si scontrano**.
- **#54997** (2026-10-13) «subagent: no way to force parent-model-only, cheap parent can escalate to paid model per call».
- **#50282** (2026-09-21) «All `opencode/*` free models return Upstream request failed: Model is unavailable (gateway-wide)».
- **#52942** «Free model usage consumed 87% of monthly subscription quota without warning».
- **#44300** i modelli free di Console falliscono con «Endpoint is unavailable» su qualunque richiesta contenente `tools`.

**Non esiste** una «lista di modelli raccomandati per l'agente» ufficiale, né un avviso «questo modello non regge l'agent loop». **`[to verify]`**

---

## 13. I permessi in una corsa non interattiva

> Letto al tag **`v2.0.29`**. `opencode run --help` **eseguito** sul binario 2.0.29 (stessa versione).

### 13.1 `--auto` non scavalca un `deny`

```text
  --auto                  Auto-approve permissions that are not explicitly denied
```

Definizione in `packages/cli/src/commands/commands.ts` (vedi §14.1 per gli alias nascosti `--yolo` e `--dangerously-skip-permissions`). **`--auto` cambia solo la risposta del client a una richiesta `ask`**: il `deny` è deciso dal server **prima** di emettere l'evento, quindi in auto mode non c'è nessuna richiesta da approvare (`packages/core/src/permission.ts`, `evaluateInput`: `if (denied(input, rules)) return { effect: "deny" as const, rules }`). La doc (`permissions.mdx`) lo dice identico: «Explicit `"deny"` rules are still enforced. Auto mode only changes requests that would otherwise ask for approval.»

### 13.2 Il modello dei permessi

**Forma della regola** — `packages/schema/src/permission.ts`:

```ts
export const Effect = Schema.Literals(["allow", "deny", "ask"]).annotate({ identifier: "Permission.Effect" })

export interface Rule extends Schema.Schema.Type<typeof Rule> {}
export const Rule = Schema.Struct({
  action: Schema.String,
  resource: Schema.String,
  effect: Effect,
}).annotate({ identifier: "Permission.Rule" })

export const Ruleset = Schema.Array(Rule).annotate({ identifier: "Permission.Ruleset" })
```

**Risoluzione: last-match su `action` *e* `resource`, default `ask`** — `packages/core/src/permission.ts`:

```ts
export function evaluate(action: string, resource: string, ...rulesets: Permission.Ruleset[]): Permission.Rule {
  return (
    rulesets
      .flat()
      .findLast((rule) => Wildcard.match(action, rule.action) && Wildcard.match(resource, rule.resource)) ?? {
      action,
      resource: "*",
      effect: "ask",
    }
  )
}
```

Nel valutare una chiamata, il `deny` vince su tutto; fra le risorse, **un solo `ask` rende la chiamata `ask`**:

```ts
      if (denied(input, rules)) return { effect: "deny" as const, rules }
      const all = [...rules, ...(yield* savedRules())]
      const effects = input.resources.map((resource) => evaluate(input.action, resource, all).effect)
      const effect: Permission.Effect = effects.includes("ask") ? "ask" : "allow"
```

Le regole «salvate» (reply `always`) sono appese **dopo** e forzano `allow`, ma il `deny` è già stato calcolato sui soli `rules`: **un `always` passato non riapre un `deny`**.

**Fail-closed quando l'agente non ha regole**: `const missingAgentPermissions: Permission.Ruleset = [{ action: "*", resource: "*", effect: "deny" }]`.

**Le azioni canoniche a v2.0.29 sono i nomi dei tool** (`packages/core/src/tool.ts`: `whollyDisabled(tool.options?.permission ?? name, rules)`):

| tool | `name` | `permission` effettivo |
|---|---|---|
| `read.ts` | `"read"` | `read` |
| `glob.ts` | `"glob"` | `glob` |
| `grep.ts` | `"grep"` | `grep` |
| `shell.ts` | `"shell"` | `shell` |
| `subagent.ts` | `"subagent"` | `subagent` |
| `skill.ts` | `"skill"` | `skill` |
| `question.ts` | `"question"` | `question` |
| `webfetch.ts` | `"webfetch"` | `webfetch` |
| `websearch.ts` | `"websearch"` | `websearch` |
| `write.ts` / `edit.ts` / `patch.ts` | `"write"` / `"edit"` / `"patch"` | `options: { codemode: false, permission: "edit" }` |

Più le azioni non-tool: `external_directory` (asserita da `packages/core/src/file-access.ts`) e `execute` (code mode). I tool di `packages/core/src/tool/plugin/opencode.ts` sono `session_rename`, `session_move`, `worktree_create`, `worktree_list`, `worktree_remove`, `models`; gli MCP espongono `list_mcp_resources` / `read_mcp_resource`.

**I nomi v1 sono ancora accettati e tradotti** — `packages/core/src/v1/config/migrate.ts`:

```ts
// Map v1 permission/tool keys onto their renamed v2 tool actions so migrated rules keep matching.
export function normalizeAction(action: string) {
  if (action === "write" || action === "patch") return "edit"
  if (action === "task") return "subagent"
  if (action === "bash") return "shell"
  return action
}
```

Quindi la tabella di `agents.mdx` (`bash`, `task`, …) è la mappa dei **nomi v1**.

**Default dell'agente** — `packages/schema/src/agent.ts`, `Agent.Info.default`:

```ts
          permissions: [
            { action: "*", resource: "*", effect: "allow" },
            { action: "read", resource: "*.env", effect: "ask" },
            { action: "read", resource: "*.env.*", effect: "ask" },
            { action: "read", resource: "*.env.example", effect: "allow" },
          ],
```

**Divergenza doc↔codice:** `permissions.mdx` dice che i file `.env` sono **denied** di default; il codice a v2.0.29 dice **`effect: "ask"`**.

**Regole e `policies` sono cose diverse.** `packages/schema/src/config/policy.ts`:

```ts
export const Info = Schema.Struct({
  action: Schema.Literals(["provider.use", "tool.use", "integration.use"]),
  resource: Schema.String,
  effect: Effect,   // Schema.Literals(["allow", "deny"])
})
```

La doc `policies.mdx` dichiara però **una sola** azione in uso: `provider.use`; `tool.use` e `integration.use` esistono nello schema. E da v2.0.29 la chiave viva è `policies` di primo livello, con `experimental.policies` tenuto per compatibilità (§19).

### 13.3 Regola per **agente** e per **tool**

Per tool, la chiave di config `permission` viene migrata in regole `{action, resource, effect}` da `packages/core/src/config/normalize.ts`, `migratePermissions`:

```ts
  return Object.entries(value).flatMap(([action, raw]) => {
    if (typeof raw === "string") {
      const effect = decodeValue(ConfigPermissionV1.Action, raw, ["permission", action], diagnostics)
      return effect === undefined ? [] : [{ action: ConfigMigrateV1.normalizeAction(action), resource: "*", effect }]
    }
    ...
    return Object.entries(raw).flatMap(([resource, effect], index) => {
      const decoded = decodeValue(ConfigPermissionV1.Action, effect, ["permission", action, String(index)], diagnostics)
      return decoded === undefined
        ? []
        : [{ action: ConfigMigrateV1.normalizeAction(action), resource, effect: decoded }]
    })
  })
```

Esempio verbatim dalla doc `permissions.mdx` (granulare per tool):

```json title="opencode.json"
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "bash": {
      "*": "ask",
      "git *": "allow",
      "npm *": "allow",
      "rm *": "deny",
      "grep *": "allow"
    },
    "edit": {
      "*": "deny",
      "packages/web/src/content/docs/*.mdx": "allow"
    },
    "webfetch": {
      "*": "ask",
      "https://en.wikipedia.org/*": "allow"
    }
  }
}
```

Per agente, la chiave nel config è `permission` (v1) che diventa `permissions` (Ruleset v2) — `packages/schema/src/config/agent.ts`: `permissions: Permission.Ruleset.pipe(optional)`. Esempi verbatim da `permissions.mdx`:

```json title="opencode.json"
{
  "permission": {
    "bash": { "*": "ask", "git *": "allow", "git commit *": "deny", "git push *": "deny", "grep *": "allow" }
  },
  "agent": {
    "build": {
      "permission": {
        "bash": { "*": "ask", "git *": "allow", "git commit *": "ask", "git push *": "deny", "grep *": "allow" }
      }
    }
  }
}
```

```markdown title="~/.config/opencode/agents/review.md"
---
description: Code review without edits
mode: subagent
permission:
  edit: deny
  bash: ask
  webfetch: deny
---
```

**Precedenza.** La doc afferma «Agent permissions are merged with the global config, and agent rules take precedence.» Nel core la fusione letta è `merge(agent?.permissions ?? missingAgentPermissions, session.permissions ?? [])` (`packages/core/src/permission.ts`): concatena, e con il last-match le regole di **sessione** vincono su quelle dell'agente. **`[to verify]`** dove sia imposta la precedenza globale↔agente.

### 13.4 DECISIVO: un `ask` in `opencode run` **non blocca** — viene rifiutato con un feedback

Questo è il punto che decide se una fase headless può esistere. Il codice (`packages/cli/src/run/noninteractive.ts`, §14 e §6.7 per le costanti) risponde **da sé** a ogni `permission.asked` della sessione che possiede:

```ts
      if (event.type === "permission.asked" && submitted && (await ownsSession(event.data.sessionID))) {
        await replyPermission(event.data)
        continue
      }
```

```ts
        decision: input.auto ? "once" : "reject",
        ...(continuing ? { message: PERMISSION_REJECTED_FEEDBACK } : {}),
```

`decision` è il campo che il server accetta (`packages/protocol/src/groups/permission.ts`), con `Permission.Reply = Schema.Literals(["once", "always", "reject"])`.

Cosa ne è, in concreto, di quel rifiuto — `packages/core/src/permission.ts`:

```ts
            return yield* restore(Deferred.await(item.deferred)).pipe(
              // Deliberate defect tunnel: leaves wrap execution in blanket `mapError`, which
              // must not convert a user's decline into model-facing tool output. The decline
              // resurfaces as a typed failure at SessionModelRequest.executeTool. A decline
              // WITH feedback (CorrectedError) intentionally stays typed so the leaf can turn
              // it into ToolFailure and the model continues.
              Effect.catchTag("Permission.DeclinedError", (error) => Effect.die(error)),
```

I tre esiti:

| caso | `decision` | esito |
|---|---|---|
| client interattivo assente (default, `--auto` spento, non-v1) | `reject` **con** `message` | il tool fallisce come output **visibile al modello** e **il modello continua** senza l'azione. La corsa non si blocca e non esce |
| `--auto` acceso | `"once"` | la richiesta è approvata, nessun messaggio |
| compatibilità v1 (`compatibility: "v1"`, da `packages/cli/src/run/v1.ts`) | `reject` senza `message` | `permissionRejected = true` e la sessione viene **interrotta**: la corsa termina con `exitCode` 1 |

Un `permission.asked` di **un'altra sessione** su un server condiviso è invece deliberatamente ignorato (`ownsSession`), per non cancellare input che non è di questa corsa — è il motivo per cui una corsa `run` può convivere con una TUI aperta.

**Conseguenza operativa:** una fase headless **non resta appesa** su un `ask`. O è rifiutata (e la fase prosegue senza quel gesto, con il modello avvertito), o è approvata con `--auto`. Non esiste il caso «aspetta per sempre».

### 13.5 Quali gesti restano negati **per costruzione**

Il filtro è lo **snapshot dei tool**: un tool con `deny` su risorsa `*` **non entra nella lista consegnata al modello**. `packages/core/src/tool.ts`:

```ts
      snapshot: Effect.fn("Tool.snapshot")((permissions) =>
        Effect.sync(() => {
          const data = state.get()
          const active = new Map<string, Tool.Info>()
          const rules = permissions ?? []
          for (const [name, tool] of data.tools) {
            if (whollyDisabled(tool.options?.permission ?? name, rules)) continue
            active.set(name, tool)
          }
```

```ts
const whollyDisabled = (action: string, rules: Permission.Ruleset) => {
  const rule = rules.findLast((rule) => Wildcard.match(action, rule.action))
  return rule?.resource === "*" && rule.effect === "deny"
}
```

Il ruleset passato è quello dell'agente **fuso** con quello di sessione — `packages/core/src/session/context.ts`:

```ts
      // Session permissions narrow discovery the same way they narrow the tool snapshot.
      const permissions = Permission.merge(agent.info.permissions, session.permissions ?? [])
      const loaded = yield* Effect.all(
        {
          tools: registry.snapshot(permissions),
          builtins: builtins.load(),
          discovery: discovery.load(),
          skills: skillInstructions.load(permissions),
          references: referenceInstructions.load(),
          mcp: mcpInstructions.load(permissions),
```

Quindi:

- **Negato per costruzione** solo il tool la cui regola **vincente** ha `resource: "*"` e `effect: "deny"`: sparisce dai `definitions`. Vale anche per il code mode (`const codeModeEnabled = !whollyDisabled("execute", rules)`).
- **Negato al momento della chiamata** tutto il resto: un `deny` su una risorsa specifica (es. `{action:"edit", resource:"*.mdx", effect:"deny"}`) **lascia il tool nella lista** e viene controllato quando il modello lo invoca. Vale anche per `read` con i default `.env` (risorsa `*.env`, non `*`): `read` resta nella lista e l'`ask` scatta alla chiamata.
- `external_directory` **non** è per costruzione: è un `permission.assert` a runtime emesso da `packages/core/src/file-access.ts`.

### 13.6 Cosa resta scoperto sulla Q6

- **`[to verify]`** l'azione `list` della doc `agents.mdx`: nessun tool con quel nome a v2.0.29 e nessuna mappatura in `normalizeAction` — manca la prova di un produttore di quella chiave nel core v2.
- **`[to verify]`** l'azione `doom_loop`: compare in `packages/core/src/v1/config/permission.ts` (`const actionOnly = new Set(["question", "websearch", "doom_loop"])`), in `packages/tui/src/util/permission.ts` e nella doc, ma non il punto del core v2 che la asserisce.
- **`[to verify]`** la precedenza fra config globale e config di agente (§13.3).

---

## 14. `opencode run`: una corsa non interattiva e parsabile

> Letto **al tag `v2.0.29`** nei file `packages/cli/src/commands/handlers/run.ts`, `packages/cli/src/run/run.ts`, `packages/cli/src/run/noninteractive.ts`, `packages/cli/src/util/io.ts`, `packages/cli/src/session-target.ts`. La forma dei flag è anche **provata** su questa macchina con `opencode run --help` (2026-10-14).

### 14.1 La forma dei flag (verbatim da `opencode run --help` sul binario 2.0.29)

```text
DESCRIPTION
  Run OpenCode with a message

USAGE
  opencode run [flags] [<message...>]

ARGUMENTS
  message... string    Message to send (optional)

FLAGS
  --standalone            Run with a private server instead of the background service
  --server string         Connect to a server URL instead of the background service
  --continue, -c          Continue the last session
  --session, -s string    Session ID to continue, or to create if it does not exist
  --fork                  Fork the session before continuing
  --model, -m string      Model to use in the format provider/model#variant
  --agent string          Agent to use
  --format choice         Output format (choices: default, json)
  --file, -f string       File to attach to the message
  --title string          Session title
  --thinking              Show thinking blocks
  --auto                  Auto-approve permissions that are not explicitly denied
```

**Non esiste nessun flag per limitare i tool.** Non c'è `--tools`, `--allowed-tools` né un `--disallowedTools`: la limitazione dei tool passa dal **config dell'agente** (permessi per agente/tool) o da una policy, non dalla riga di comando (§13). L'unico flag che tocca i permessi è `--auto`.

La definizione viva del comando sta in `packages/cli/src/commands/commands.ts` — è questa, non la doc, la fonte di questa linea. Due dettagli che l'help **non** mostra:

```ts
const PermissionParams = {
  auto: Flag.Boolean("auto").pipe(
    Flag.withDescription("Auto-approve permissions that are not explicitly denied"),
    Flag.withDefault(false),
  ),
  yolo: Flag.Boolean("yolo").pipe(Flag.withDefault(false), Flag.withHidden),
  dangerouslySkipPermissions: Flag.Boolean("dangerously-skip-permissions").pipe(
    Flag.withDefault(false),
    Flag.withHidden,
  ),
}
```

cioè **`--auto` ha due alias nascosti**, `--yolo` e `--dangerously-skip-permissions`, e l'handler li fonde (`auto: input.auto || input.yolo || input.dangerouslySkipPermissions`). E `--file` è ripetibile **fino a 100 volte**:

```ts
        file: Flag.String("file").pipe(
          Flag.withAlias("f"),
          Flag.withDescription("File to attach to the message"),
          Flag.atMost(100),
        ),
```

### 14.2 Il prompt: argomento, **stdin**, e `--file` che lo inlina

Tre vie, tutte nella stessa funzione (`packages/cli/src/run/run.ts`):

```ts
  const message = mergeInput(formatMessage(input.message), process.stdin.isTTY ? undefined : await readStdin())
  if (!message?.trim()) fail("You must provide a message")
```

```ts
export function mergeInput(message: string | undefined, piped: string | undefined) {
  if (!message) return piped || undefined
  if (!piped) return message
  return message + "\n" + piped
}
```

e `packages/cli/src/util/io.ts`:

```ts
export function readStdin() {
  return text(process.stdin)
}
```

**Conseguenza: sì, c'è una via da file, anzi due.**

1. **stdin.** Se `process.stdin` **non** è un TTY — cioè se è un pipe o una redirezione — il suo contenuto viene letto e **concatenato** al messaggio con un `"\n"`. Quindi `cat fase.md | opencode run --agent X` è una forma reale, e lo è anche `opencode run --agent X < fase.md`.
2. **`--file/-f <path>`**, che **non è un allegato qualunque**: un file riconosciuto `text/plain` viene **inlinato nel testo del prompt**. `packages/cli/src/run/noninteractive.ts`:

```ts
async function prepareFile(file: File) {
  if (file.mime !== "text/plain") {
    const uri = file.url.startsWith("data:")
      ? file.url
      : `data:${file.mime};base64,${(await readFile(new URL(file.url))).toString("base64")}`
    return { attachment: { uri, name: file.filename } }
  }
  const content = file.url.startsWith("data:")
    ? Buffer.from(file.url.slice(file.url.indexOf(",") + 1), "base64").toString("utf8")
    : await readFile(new URL(file.url), "utf8")
  return { text: `<file name="${file.filename}">\n${content}\n</file>` }
}
```

e la composizione finale del testo mandato al modello:

```ts
          text: [input.message, ...prepared.flatMap((file) => (file.text ? [file.text] : []))].join("\n\n"),
```

Il MIME lo decide il lato CLI (`packages/cli/src/run/run.ts`): un file è `text/plain` se il contenuto **non** è binario **e** il round-trip UTF-8 non lo altera — `!isBinaryContent(bytes) && Buffer.from(text, "utf8").equals(bytes)` — cioè se il file è testo valido. Un binario diventa un `attachment` (`data:<mime>;base64,…`). Il tetto è dichiarato in una costante:

```ts
const ATTACH_FILE_MAX_BYTES = 10 * 1024 * 1024
```

```ts
    if (!stat.isFile() || stat.size > ATTACH_FILE_MAX_BYTES)
      fail(`Cannot attach a directory, special file, or file larger than 10 MiB: ${input}`)
```

Attenzione: `if (!stat.isFile() …)` significa che **una directory non si allega**. E l'handler accetta `--file` **più volte** (`file: [...input.file]`), quindi si possono concatenare più documenti in un solo prompt.

**`--file` da solo non basta.** Il messaggio deve venire dall'argomento o da stdin: la guardia `if (!message?.trim()) fail("You must provide a message")` guarda **solo** `message`, e i file si aggiungono dopo. Quindi `opencode run -f prompt.txt` **fallisce** con `You must provide a message`; la forma che funziona è `opencode run --agent X -f prompt.txt "…"` oppure `cat prompt.txt | opencode run --agent X` (che è la via **da file** più pulita, perché il file diventa il messaggio).

**Il prompt arriva anche dopo un `--`**, verbatim dall'handler (`packages/cli/src/commands/handlers/run.ts`):

```ts
    const separator = process.argv.indexOf("--", 2)
    ...
        message: [...input.message, ...(separator === -1 ? [] : process.argv.slice(separator + 1))],
```

### 14.3 La scelta dell'agente

`--agent <name>` non è filtrato né interpretato dal CLI: viaggia fino alla sessione e lì **cambia l'agente attivo**.

`packages/cli/src/run/run.ts`:

```ts
  const target = await resolveSessionTarget({
    client,
    location: prepared.directory ? { directory: prepared.directory } : undefined,
    continue: input.continue,
    session: input.session,
    fork: input.fork,
    model: explicit ? { … } : undefined,
    agent: input.agent,
    environment: input.server.service ? Env.session() : undefined,
    prepare: async (next) => { … return { model, agent: next.agent } },
  })
```

e poi, all'inizio della corsa vera (`packages/cli/src/run/noninteractive.ts`):

```ts
    if (input.agent) {
      await input.client.session.switchAgent({ sessionID: input.sessionID, agent: input.agent })
    }
```

Quindi l'agente è quello **dichiarato** (file `.md` in `.opencode/agents/`, `~/.config/opencode/agents/`, o la chiave `agents` di `opencode.json`) e viene selezionato **per nome**.

**Un nome ignoto non è un errore di sintassi, ed è già risolto.** `switchAgent` non valida (`packages/core/src/session/session.ts` si limita a pubblicare l'evento); il rifiuto arriva **all'esecuzione**, in `packages/core/src/session/context.ts`:

```ts
      const agent = yield* agents.select(session.agent)
      if (!agent.info) return yield* new AgentNotFoundError({ sessionID: session.id, agent: session.agent ?? agent.id })
```

e `packages/core/src/session/error.ts`:

```ts
export class AgentNotFoundError extends Schema.TaggedError<AgentNotFoundError>()("Session.AgentNotFoundError", {
  sessionID: SessionSchema.ID,
  agent: Agent.ID,
}) {
  override get message() {
    return `Agent not found: "${this.agent}"`
  }
}
```

con il messaggio che attraversa `to-session-error.ts` come `{ type: "unknown", message: cause.message }`. Esito: un `session.execution.failed`, la riga `error` con `Agent not found: "<nome>"`, ed **exit code 1**.

**`--agent` accetta anche un agente `mode: "subagent"`.** `Agent.select` **non filtra per modo** — restituisce l'`info` per qualunque id registrato (`packages/core/src/agent.ts`: `const selected = ID.make(id); return { id: selected, info: state.get().agents.get(selected) }`). Vedi §15 per la conseguenza.

**`[to verify]`** resta solo la prova a runtime: nessun `opencode run` è stato eseguito (spenderebbe crediti), quindi questo è il percorso nel sorgente, non un campione osservato.

### 14.4 `--format json`: NDJSON, una riga per evento

L'emissione è una sola funzione, e dice tutto (`packages/cli/src/run/noninteractive.ts`):

```ts
  const emit = (type: string, timestamp: number, data: Record<string, unknown>) => {
    if (input.format !== "json") return false
    process.stdout.write(JSON.stringify({ type, timestamp, sessionID: input.sessionID, ...data }) + EOL)
    return true
  }
```

Ogni riga è quindi `{"type":…,"timestamp":…,"sessionID":…,…}` — **NDJSON**, non un documento JSON unico. I `type` emessi sono **sei**:

| `type` | payload | quando |
|---|---|---|
| `step_start` | `{ part }` con `type: "step-start"`, `snapshot` | all'inizio di un passo dell'agente |
| `text` | `{ part }` con `type: "text"`, `text`, `time: { start, end }` | al `session.text.ended` |
| `reasoning` | `{ part }` con `type: "reasoning"`, `text`, `metadata` | **solo con `--thinking`** |
| `tool_use` | `{ part }` con `type: "tool"`, `tool`, `state: { status: "completed" \| "error", input, output/error, metadata }` | al `session.tool.success` / `session.tool.failed` |
| `step_finish` | `{ part }` con `type: "step-finish"`, `reason`, `cost`, `tokens`, `snapshot` | alla fine di un passo |
| `error` | `{ error }` | su un guasto |

`step_finish` è l'evento che porta i **numeri** — è l'unica riga con `cost` e `tokens`:

```ts
        const part = {
          id: partID(event.id),
          sessionID: input.sessionID,
          messageID: event.data.assistantMessageID,
          type: "step-finish",
          reason: event.data.finish,
          snapshot: event.data.snapshot,
          cost: event.data.cost,
          tokens: event.data.tokens,
        }
        emit("step_finish", time, { part })
```

**Non c'è un evento finale unico.** La corsa finisce quando il processo esce: `session.execution.succeeded` fa `return` **senza emettere nulla**. Il flusso tipico è quindi `step_start`, (`reasoning`), (`tool_use`)… , `text`, `step_finish` — e l'ultima riga utile per un consumatore è di norma un `step_finish` (numeri) o un `text`. **Chi parsa deve quindi leggere il testo come somma dei `text` e i numeri dall'ultimo `step_finish`, non aspettarsi un oggetto riassuntivo.**

Sul **guasto** c'è invece una riga dedicata, con la stessa forma anche quando l'errore avviene *prima* che esista una sessione (`reportRunError` in `packages/cli/src/run/run.ts`):

```ts
    process.stdout.write(
      JSON.stringify({
        type: "error",
        timestamp: Date.now(),
        sessionID: sessionID ?? "",
        error: { type: "unknown", message },
      }) + "\n",
    )
```

### 14.5 Codici d'uscita

| codice | quando |
|---|---|
| `0` | fine normale (`session.execution.succeeded`) |
| `1` | `session.step.failed`, `session.execution.failed`, interruzione non-umana, o «Prompt was not promoted» — il CLI scrive anche un ultimo `error` in JSON |
| `130` | `SIGINT`, o interruzione con `reason === "user"` (`process.exitCode = 130`) |

**Dove finisce cosa.** Il JSON va su **stdout**, l'output umano su **stderr** (`packages/cli/src/run/ui.ts`: `process.stderr.write(message.join(" ") + EOL)`) — quindi con `--format json` si può redirigere `2>/dev/null` senza perdere il flusso parsabile. E `EOL` è `node:os`, cioè **`\r\n` su Windows**: chi legge le righe deve tollerarlo.

**Le due forme dei numeri in `step_finish`.** `cost` è un numero (`Money.USD = Schema.Finite.pipe(Schema.brand("Money.USD")…)`, `packages/schema/src/money.ts`); `tokens` è `{ input, output, reasoning, cache: { read, write } }` (`packages/schema/src/token-usage.ts`).

**L'ultima riga non è garantita.** Dopo la fine dell'esecuzione, `reconcile()` può emettere ancora `text` e `tool_use` per il contenuto che lo stream non aveva ancora consegnato: un consumatore non deve assumere che l'ultima riga sia `step_finish`, ma leggere i numeri **dall'ultimo `step_finish` visto** e il testo dalla somma dei `text`.

### 14.6 La doc in-tree **non** descrive questo comando

`packages/web/src/content/docs/cli.mdx`, letto **al tag `v2.0.29`**, elenca per `run` flag che **in `commands.ts` non esistono** — `--command`, `--share`, `--attach`, `--dir`, `--port`, `--password`, `--username`, `--variant` — e cita comandi assenti (`opencode agent`, `export`/`import`, `web`, `attach`, `pr`, `db`). Quei flag corrispondono a `V1RunCommandInput` in `packages/cli/src/run/v1.ts`, che è un **bridge API per chiamanti esterni** (`runV1Bridge` è esportato da `packages/cli/src/run/index.ts` e **non è registrato come comando**). Allo stesso modo `packages/web/src/content/docs/agents.mdx`, allo stesso tag, documenta `tools` come deprecato e nomina azioni `bash`/`task`/`write`: a v2.0.29 le azioni sono `shell`/`subagent`/`edit` (§13). **Per questa linea la fonte è `commands.ts` più l'help del binario, non la doc.**

### 14.7 I nomi reali dei tool a v2.0.29

Dai `export const name = …` in `packages/core/src/tool/plugin/*.ts`: `shell`, `write`, `edit`, `patch`, `read`, `glob`, `grep`, `webfetch`, `websearch`, `skill`, `question`, `subagent`. I tre tool di scrittura dichiarano l'azione di permesso comune `edit` (`options: { codemode: false, permission: "edit" }`).

### 14.8 Cosa serve davvero per comporre una fase

Per eseguire **una fase** di una catena, in modo parsabile, bastano:

```bash
cat .daiku/handoffs/la-mia-fase.md | opencode run --agent finder --format json > fase.ndjson
# oppure
opencode run --agent finder --format json --file .daiku/handoffs/la-mia-fase.md
```

Il contratto della fase è il **testo** del prompt (via stdin o via `--file`); il nome dell'agente sceglie chi lo esegue; il JSON è NDJSON e si legge riga per riga. **`--auto`** va aggiunto se la fase deve poter agire senza incontrare un rifiuto (§13).

---

## 15. Corse parallele, sessioni e `experimental.subagent_depth`

> Letto nel sorgente al tag **`v2.0.29`** (e, dove indicato, a **`v2.0.19`**). Nessun `opencode run` lanciato e nessun comando che avvia il servizio di background.

### 15.1 Cosa si contendono due corse

**Il server di background è uno solo, per canale.** `opencode run` non parte con un server proprio: `ServerConnection.resolve` risolve prima `--server`, poi `--standalone` (o `service.disabled === true`), altrimenti va sul servizio di background gestito. `packages/cli/src/services/server-connection.ts`:

```ts
  if (args.server !== undefined && args.standalone)
    return yield* Effect.fail(new Error("--server and --standalone cannot be combined"))
  if (args.server !== undefined) { … }
  if (args.standalone || (yield* ServiceConfig.read()).disabled === true) {
    return { endpoint: yield* Standalone.start() } satisfies Resolved
  }

  const mismatch = args.mismatch ?? "ignore"
  const options = yield* ServiceConfig.options({ checkVersion: mismatch !== "ignore" })
  return {
    endpoint: yield* resolveManaged({ ...options, onStart: args.onStart }, mismatch),
    service: managedService(options),
  } satisfies Resolved
```

Il servizio privato di `--standalone` è un processo figlio `serve --stdio --port 0` che muore con lo stdin del padre — `packages/cli/src/services/standalone.ts`:

```ts
  return ChildProcess.make(executable, [...args, "--stdio", "--port", "0"], {
    cwd: startupDirectory,
    // Explicit entry wins over anything inherited, so a user-exported
    // OPENCODE_PASSWORD cannot shadow the child's lease credential.
    env: { OPENCODE_PASSWORD: password },
    extendEnv: true,
    // The server treats EOF on this pipe as the end of its ownership lease.
    // The OS closes it even when the TUI is killed before Effect finalizers run.
    stdin: "pipe",
```

**Dove sta lo stato: un solo database SQLite globale**, condiviso da tutte le corse e da **tutti i progetti** — `packages/cli/src/database-path.ts`:

```ts
export function databasePath(data: string) {
  const filename =
    process.env.OPENCODE_DB ??
    (["latest", "dev", "beta", "next", "prod"].includes(OPENCODE_CHANNEL) ||
    process.env.OPENCODE_DISABLE_CHANNEL_DB === "1" ||
    process.env.OPENCODE_DISABLE_CHANNEL_DB === "true"
      ? "opencode.db"
      : `opencode-${OPENCODE_CHANNEL.replace(/[^a-zA-Z0-9._-]/g, "-")}.db`)
  return filename === ":memory:" ? filename : path.resolve(data, filename)
}
```

Il registro del servizio, che è il contratto di scoperta, sta invece nello *state*: `service.json` (o `service-<canale>.json`), `packages/cli/src/services/service-config.ts`:

```ts
export function filename(channel = OPENCODE_CHANNEL) {
  if (channel === "latest" || channel === "dev" || channel === "beta" || channel === "next") return "service.json"
  return `service-${channel.replace(/[^a-zA-Z0-9._-]/g, "-")}.json`
}

export function defaultPort(channel = OPENCODE_CHANNEL) {
  if (channel === "latest" || channel === "dev" || channel === "beta" || channel === "next") return 0xc0de
  if (channel === "local") return 0xc0df
  return 10_000 + (Number.parseInt(Hash.fast(channel).slice(0, 8), 16) % 50_000)
}
```

**Il DB serializza solo per quanto SQLite può.** `packages/core/src/database/database.ts` apre in WAL con un busy timeout:

```ts
      if (supportsTuningPragmas) {
        yield* db.run("PRAGMA journal_mode = WAL")
        yield* db.run("PRAGMA synchronous = NORMAL")
        yield* db.run("PRAGMA busy_timeout = 5000")
```

e il modulo tiene un lock **in-process per path**, non cross-process:

```ts
// Two instances over one file bootstrap the same schema, so file databases
// share a lock per path. Each in-memory database is its own connection.
const locks = new Map<string, Semaphore.Semaphore>()
```

Fuori dal processo l'unica difesa è quindi WAL + `busy_timeout = 5000`. `packages/util/src/flock.ts` esiste (lock su file sotto `state/locks`, `staleMs: 60_000`, `timeoutMs: 5 * 60_000`) ma **non compare** nel percorso della corsa letto.

**Credenziali e servizio: una sola istanza per canale.** `packages/cli/src/server-process.ts` esce subito se un incumbent risponde già su host+porta configurate:

```ts
      const findIncumbent =
        serviceOptions !== undefined && port !== undefined
          ? Service.incumbent({ ...serviceOptions, url: serviceURL(hostname, port) })
          : undefined
      if (findIncumbent !== undefined && (yield* findIncumbent) !== undefined) return
```

e, se la porta è occupata da un altro processo, fallisce con:

```text
Managed service port <port> on <hostname> is already in use by another process. Configure another port with `opencode service set port <port>` and start the service again.
```

Il servizio di background fa `chdir` nella **home**, non nel repository (`if (options.mode === "service") yield* Effect.sync(() => process.chdir(global.home))`). La password del servizio è **persistita e riusata**:

```ts
  const existing = yield* read()
  if (value === undefined && existing.password) return existing.password
  …
  // Keep one private credential across server restarts so discovered clients
  // can reconnect without exposing a password flag or environment variable.
```

Il registro è a proprietà singola e il perdente si spegne (`packages/cli/src/services/service-registration.ts`: `Effect.filterOrFail(owns)`, `Effect.repeat(Schedule.spaced("5 seconds"))`, `Effect.andThen(options.shutdown)`).

Nota per il contendente: `packages/client/src/service-contender.ts` limita a **due** i tentativi di avvio vivi per una `ensure()` (`contenders.size < 2`) — ma è un tetto sugli *avvii del server*, non sulle corse.

**Due corse che scrivono la stessa sessione.** Dentro un processo la serializzazione **c'è**, ed è per chiave, non globale — `packages/core/src/session/run-coordinator.ts`: `/** Serializes execution for each key while allowing different keys to run concurrently. */`. E `packages/core/src/session/execution.ts`: `/** Process-local execution: drains run in this process using the selected instance. */`.

Un secondo `session.prompt` sulla stessa sessione non avvia un secondo drain: viene ammesso nella inbox con consegna `"steer"` (`packages/schema/src/session-inbox.ts`: `export const Delivery = Schema.Literals(["steer", "queue"])`) e la wake viene coalesciata nella stessa busy period. Il lock della inbox è un `KeyedMutex` in memoria, una chiave per sessione (`packages/core/src/effect/keyed-mutex.ts`: `same key -> queue`, `different key -> run independently`).

Il `claim` sul DB **non è un mutex**: è il write-ahead della ripresa da crash.

```ts
    // Write-ahead claim: starting records the durable intent that a turn is in flight, in the same
    // transaction as the started event. Terminals release it — except shutdown interruption, which
    // preserves the claim so the next server start resumes the turn. A claim that survives with no
    // terminal is the signature of a process that died without teardown (crash, SIGKILL, eviction);
    // recovery is a property of the database, never of a shutdown hook that may not run.
```

**Conclusione letta dal codice (non misurata).** Con il **servizio di background** (default) due corse concorrenti sulla stessa sessione, sullo stesso host, sono **serializzate** dal coordinatore del server unico. Con **due server distinti** (`--standalone`, o `--server` verso un'altra istanza) che puntano **allo stesso file `.db`** non esiste alcun lock cross-process: coordinatore e `KeyedMutex` sono in memoria, e l'unica barriera è SQLite WAL con `busy_timeout = 5000`. **`[to verify]`** — non è stata eseguita una prova di due corse concorrenti reali.

### 15.2 Tetto di concorrenza dichiarato: **nessuno**

Non esistono semafori, massimi o code che limitino il numero di corse o sessioni concorrenti:

- il coordinatore è `Effect.gen` con una `Map` di esecuzioni per chiave e `FiberSet.makeRuntime` senza limite (`packages/core/src/session/run-coordinator.ts`);
- il lock della inbox è `KeyedMutex` «one lock per key», con `size` crescente e nessun tetto (`packages/core/src/effect/keyed-mutex.ts`);
- il carico dei contesti di sessione è dichiarato `{ concurrency: "unbounded" }` (`packages/core/src/session/context.ts`).

L'unico «due» nel percorso è `contenders.size < 2` in `service-contender.ts`, che riguarda gli **avvii del server**.

### 15.3 `--session`, `--continue`, `--fork`

Vincolo in `packages/cli/src/run/run.ts`:

```ts
  if (input.fork && !input.continue && !input.session) fail("--fork requires --continue or --session")
```

Risoluzione, `packages/cli/src/session-target.ts`:

```ts
  const explicit = input.session ? await findSession(input.client, input.session, input.signal) : undefined
  if (input.session && !explicit) {
    if (input.fork) throw new Error("Session not found")
    return { session: undefined }
  }
  if (explicit)
    return {
      session: input.fork
        ? await input.client.session
            .fork({ sessionID: explicit.id }, ...requestOptions(input.signal))
            …
        : explicit,
    }
  if (!input.continue) return { session: undefined }
```

Quindi:

| flag | cosa risolve |
|---|---|
| `--session <id>` | quella sessione, **o la crea con quell'id esatto** se non esiste (`client.session.create({ id: input.session, … })`) |
| `--continue` | l'**ultima** sessione **nella directory del progetto** (`latestSession` filtra per `location.directory`, pagine da 50) |
| `--fork` | richiede `--continue` o `--session`; **genera un id nuovo** |

**`--fork` non è una copia con lo stesso id: è una sessione figlia con id nuovo.** `packages/core/src/session.ts`:

```ts
        if (!boundary) return yield* new ForkEmptyError({ sessionID: input.sessionID })
        const sessionID = SessionSchema.ID.create()
        …
        yield* bus.publish(SessionEvent.Forked, {
          sessionID,
          parentID: parent.id,
          boundary: { type: input.before ? "before" : "through", messageID: boundary.id },
          ...inherited,
        })
```

Una sessione vuota fa `ForkEmptyError` (`Cannot fork empty session: …`).

**Conseguenza sulla Q4 — «riprendere una sessione mentre un'altra corsa la scrive è sicuro?»**: `--session <id>` **su quella sessione** no (la scrive; con il server condiviso la corsa è accodata come `steer`, con due server distinti resta solo il WAL). `--session <id> --fork` **sì**: lascia intatta la sessione sorgente e scrive su una nuova — due corse che scrivono la stessa sessione sorgente non si contendono la stessa riga, ne creano due.

### 15.4 `experimental.subagent_depth` alla 2.0.29

**Riga esatta dello schema** — `packages/schema/src/config/experimental.ts` (v2.0.29):

```ts
export class Info extends Schema.Class<Info>("ConfigExperimental.Info")({
  portable_shell_scanner: Schema.Boolean.pipe(optional).annotate({
    description: "Enable the experimental portable shell permission scanner. Defaults to false.",
  }),
  subagent_depth: NonNegativeInt.pipe(optional).annotate({
    description: "Maximum subagent nesting depth. Defaults to 1.",
  }),
  policies: ConfigPolicy.Info.pipe(Schema.Array, optional).annotate({
    description: "Deprecated: use top-level policies. Ordered policies controlling access to configured resources",
  }),
}) {}
```

**Default 1**, dal `?? 1` del punto di applicazione; il tipo è `NonNegativeInt`, quindi **`0` è ammesso**.

**Dove si dichiara: sotto `experimental`, in progetto e in globale.** Il valore in **radice è scartato** — `packages/core/src/config/normalize.ts`:

```ts
const unsupportedTopLevel = ["logLevel", "server", "subagent_depth", "layout"] as const
```

```ts
function unsupportedIfPresent(value: Record<string, unknown>, key: string, path: string[], diagnostics: Diagnostic[]) {
  if (!own(value, key)) return
  diagnostics.push({ kind: "unsupported", path, message: "omitted unsupported legacy setting" })
}
```

e l'accettazione avviene **solo** nel ramo `experimental`:

```ts
      if (own(experimental, "subagent_depth")) {
        const value = decodeEncoded(
          ConfigExperimental.Info.fields.subagent_depth,
          experimental.subagent_depth,
          ["experimental", "subagent_depth"],
          diagnostics,
        )
        if (value !== undefined) result.subagent_depth = value
      }
```

**La documentazione è in disaccordo col codice**: `packages/web/src/content/docs/config.mdx` (identico a v2.0.19 e a v2.0.29) scrive la forma **in radice** `{ "$schema": …, "subagent_depth": 2 }` — proprio quella che `unsupportedTopLevel` scarta in silenzio con un warning.

**Progetto o globale: entrambe**, e vince l'ultimo documento che definisce la chiave (`packages/core/src/config.ts`):

```ts
export function latest<K extends keyof Info>(entries: readonly Entry[], key: K): Info[K] | undefined {
  return entries.findLast((entry): entry is Document => entry.type === "document" && entry.info[key] !== undefined)
    ?.info[key]
}
```

con l'ordine di caricamento dal più basso al più alto:

```ts
        return [
          ...managedPolicies,
          ...(yield* loadWellknown().pipe(Effect.orDie)),
          ...globalSupplementary,
          ...explicit,
          ...direct,
          ...projectSupplementary,
          ...content,
          ...managedSettings,
        ]
```

(`// Global entries sit below explicit and direct files; project directories rank above them.`)

**Trappola da codice:** essendo `latest` = «ultimo documento con **`experimental`** definito» e poi `?.subagent_depth ?? 1`, una config di progetto che definisce `experimental` **senza** `subagent_depth` **non** fa scendere la lettura alla globale: il valore diventa `undefined` → default **1**.

**Il codice che lo impone** — `packages/core/src/tool/plugin/subagent.ts` (v2.0.29):

```ts
              let current = parent
              let depth = 0
              while (current.parentID) {
                depth++
                current = yield* sessions
                  .get(current.parentID)
                  .pipe(
                    Effect.mapError(
                      (error) => new ToolFailure({ message: `Parent session not found: ${current.parentID}`, error }),
                    ),
                  )
              }
              const limit = Config.latest(yield* config.entries(), "experimental")?.subagent_depth ?? 1
              if (depth >= limit)
                return yield* new ToolFailure({
                  message: `Subagent depth limit reached (${limit}). Increase "experimental.subagent_depth" to allow nested subagents.`,
                })
```

`depth` conta gli **antenati** della sessione chiamante: a profondità 0 (sessione di primo livello) il default `1` lascia partire **un** figlio; il figlio, a profondità 1, è bloccato.

**Cosa è cambiato dalla 2.0.19: niente, in quest'area.** Nei file che contano è **identico** fra i due tag:

- `packages/schema/src/config/experimental.ts` a `v2.0.19`: stessa riga, byte per byte, stesso default dichiarato. Unica differenza nel file: la `description` di `policies` (a 2.0.19 non ha il prefisso «Deprecated: use top-level policies.»).
- `packages/core/src/config/normalize.ts` a `v2.0.19`: stesso `unsupportedTopLevel` e stesso blocco di accettazione sotto `experimental` (l'unica differenza nella costante `options` è `propertyOrder: "original"`, presente a 2.0.19).
- `packages/core/src/tool/plugin/subagent.ts` a `v2.0.19`: blocco del depth check identico, riga per riga (stesse righe 114-137, stessa `limit`, stesso `if (depth >= limit)`, stesso messaggio).
- `packages/core/src/agent.ts` a `v2.0.19`: `selectable` / `resolve` / `select` identici a 2.0.29.
- `config.mdx` a `v2.0.19`: sezione `### Subagent depth` identica — la divergenza col codice c'è in **entrambi** i tag.

### 15.5 `--agent <nome>` con un agente `mode: subagent` come primario: **passa**

Il percorso è tutto **non filtrato**.

1. La CLI lo applica con `switchAgent` (`packages/cli/src/run/noninteractive.ts`) — e su una sessione nuova lo passa anche a `session.create`.
2. Il server **non valida la modalità** — `packages/core/src/session/session.ts` si limita a pubblicare `SessionEvent.AgentSelected`; `create` scrive `agent: input.agent` nell'evento `SessionEvent.Created` senza controllo.
3. La selezione del contesto usa `select` con id **esplicito**, che non filtra — `packages/core/src/session/context.ts` → `agents.select(session.agent)`. E `packages/core/src/agent.ts`:

```ts
    const selectable = (agent: Info | undefined) =>
      agent && agent.mode !== "subagent" && !agent.hidden ? agent : undefined
```

```ts
      select: Effect.fn("Agent.select")(function* (id) {
        if (id !== undefined) {
          const selected = ID.make(id)
          return { id: selected, info: state.get().agents.get(selected) }
        }
        const info = selectedDefault()
        return { id: info?.id ?? defaultID, info }
      }),
```

Il filtro `mode !== "subagent"` vale **solo per il default** (`selectedDefault`), cioè quando l'id non è dato.

**Dove invece la modalità è filtrata:** solo nel verso opposto, dentro il tool dei subagenti (`packages/core/src/tool/plugin/subagent.ts`):

```ts
              if (agent.mode === "primary")
                return yield* new ToolFailure({ message: `Agent ${input.agent} cannot run as a subagent` })
```

e la lista degli invocabili ai fini della descrizione del tool:

```ts
        const available = (yield* agents.list())
          .filter(
            (agent) =>
              agent.mode !== "primary" &&
              !agent.hidden &&
              Permission.evaluate(name, agent.id, selected.permissions).effect !== "deny",
          )
```

Un `mode: subagent` **non** è escluso dal tool, un `mode: primary` **sì**.

**Forma supportata o effetto collaterale? Effetto collaterale tollerato.** Non esiste alcun punto — né nella CLI, né in `session.create`/`switchAgent`, né in `SessionContext.select` — che accetti o rifiuti **esplicitamente** un `mode: subagent` come primario di una corsa: viene accettato perché **il filtro esiste solo nella risoluzione del default**, non nel percorso con id esplicito. La documentazione non lo copre (`cli.mdx` dice solo «Agent to use»). L'unica prosa che parla di modalità e primarietà riguarda un'altra chiave, `default_agent` — «The default agent must be a primary agent (not a subagent). … If the specified agent doesn't exist or is a subagent, OpenCode will fall back to `"build"` with a warning.» — e quella regola **vale per `default_agent`, non per `--agent`**.

### 15.6 Cosa resta scoperto sulla Q4/Q5

- **`[to verify]`** `opencode debug agents` **non è stato eseguito**: passa da `ServerConnection.resolve()` (`packages/cli/src/commands/handlers/debug/agents.ts`) e quindi **avvierebbe il servizio di background dell'owner**. Manca perciò il riscontro a runtime sulla lista degli agenti e su `--agent` con un `mode: subagent`.
- **`[to verify]`** il comportamento **osservato** di due corse concorrenti su due server `--standalone` che condividono lo stesso `.db`: si legge l'assenza di lock cross-process, non la si è misurata.
- **`[to verify]`** quale sia il warning effettivo emesso quando `subagent_depth` è scritto in radice: si legge il `Diagnostic` (`kind: "unsupported"`, `message: "omitted unsupported legacy setting"`) e la sua `Effect.logWarning`, non lo si è visto stampato.

---

## 16. Aggiornamento e canale

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

## 17. CLI

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

## 18. Evidenza locale

```text
$ opencode --version
opencode v2.0.29
```

```text
$ opencode debug paths
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

```text
$ opencode debug config
[ { "type": "directory", "path": "C:\\Users\\tomas\\.config\\opencode" } ]
```

Identici a quelli letti il 2026-10-03 sulla 2.0.19: `data`, `cache`, `state`, `tmp`, `db` non si sono spostati fra le due patch estreme della linea.

**Il pacchetto installato non è leggibile da questa sessione.** `C:\nvm4w\nodejs\node_modules\@opencode\cli` sta **fuori dal perimetro di lettura** dichiarato all'agente (il tentativo è stato rifiutato dalla guardia dell'host). L'evidenza sul comportamento del binario viene quindi da `opencode <sub> --help` e `opencode debug …`, mai dal suo sorgente installato; il sorgente che si cita qui è quello del **repository al tag `v2.0.29`**, che è la stessa versione ma non è la copia in esecuzione su questa macchina. **`[to verify]`**: l'esatta corrispondenza fra il tag `v2.0.29` e l'albero di `@opencode/cli@2.0.29` come è impacchettato su npm.

**Docs V2 online: ancora 404.** `https://opencode.ai/v2/docs/agents.md` → **HTTP 404** (riverificato 2026-10-14). La fonte primaria della V2 resta il **repository** (`packages/web/src/content/docs/*.mdx` al tag). Il `/docs` pubblico resta la V1: la pagina `https://opencode.ai/docs/cli.md` elenca `--command`, `--attach`, `github`, `pr <n>`, `db`, `web` — tutti comandi V1 assenti dal binario 2.0.29 (§17).

**Evidenza della lettura precedente (2.0.19, raccolta 2026-10-03).**

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

## 19. Changelog e breaking changes

La raccolta precedente dichiarava: «Il `/changelog` pubblico è **V1**», con l'ultima voce `v1.18.34`. **Non è più vero, ed è verificabile quando è cambiato.**

- Al tag **`v2.0.19`** né `CHANGELOG.md` né `services/changelog/` esistevano: `https://raw.githubusercontent.com/anomalyco/opencode/v2.0.19/CHANGELOG.md` → **404**, e così `…/v2.0.19/services/changelog/README.md` → **404**.
- Al tag **`v2.0.24`** e **`v2.0.25`**: `CHANGELOG.md` → **404**. Al tag **`v2.0.26`** → **200**. Il file nasce quindi con la **2.0.26** (2026-10-08), da tre commit presenti nella storia di `v2.0.29`:

```text
feat(release): write reviewed V2 release notes to CHANGELOG.md (#53964)
feat(console): render CHANGELOG.md on /changelog (#54902)
feat(changelog): serve /changelog from a standalone worker (#54906)
```

- Il README del servizio, verbatim dal tag `v2.0.29` (`services/changelog/README.md`): «The changelog Worker renders the root `CHANGELOG.md` at `https://opencode.ai/changelog`.» · «Entries split on lines matching `^## v\d`.» · «Each request reads `CHANGELOG.md` from the `dev` branch on raw GitHub through the Workers cache.»
- Verificato sulla pagina viva il 2026-10-14: elenca `v2.0.29` (2026-10-14), `v2.0.28`, `v2.0.27`, `v2.0.26`, e dichiara che «OpenCode 1 release notes are on GitHub Releases».

**Conseguenza operativa:** per sapere cosa è cambiato in una release V2 c'è ora una fonte di prima parte — `https://opencode.ai/changelog`, o direttamente `CHANGELOG.md` alla radice del repository. **Ma la finestra è corta:** il file tenuto su `dev` il 2026-10-14 conteneva solo le ultime **quattro** release (`v2.0.26`…`v2.0.29`), non uno storico. Per il passato resta la ricognizione **per file e per tag**, mai per intervallo di tag (§2): `gh api "repos/anomalyco/opencode/compare/v2.0.19...v2.0.29"` risponde `ahead_by: 1975`, `behind_by: 1` — i tag non stanno su una linea unica, ed è riconfermato.

**Le voci di changelog che toccano le domande di questa raccolta** (verbatim da `CHANGELOG.md`, 2.0.26-2.0.29, e dalla storia dei commit):

| Voce | Release | PR |
|---|---|---|
| «Add `ctx.permission.assert` for Effect and Promise plugins, allowing plugins to use configured permission rules and the native approval prompt.» | v2.0.29, *Extensions* | #54930 |
| «Stabilize access policies under the top-level `policies` configuration key while retaining compatibility with `experimental.policies`.» | v2.0.29, *Core* | #55297 |
| «Give centrally managed configuration precedence over local and user configuration.» | v2.0.29, *Core* | #55267 |
| «Automatically continue responses after an output-token limit, with bounded retries and clearer recovery for truncated tool calls.» | v2.0.29, *Core* | #53876 |
| «Converted rejected Promise-based plugin tools into normal tool failures instead of crashing their execution path.» | v2.0.28, *Extensions* | #54913 |
| `fix(cli): answer subagent asks in run and keep parallel rejections continuing` | (nella storia di v2.0.29) | #52146 |
| `feat(cli): continue run after rejecting a permission ask` | | #51968 |
| `feat(cli): create the session when --session names one that does not exist` | | #51405 |
| `feat(cli): allow disabling the background service` | | #52107 |
| `feat(core): support disable-model-invocation in skill frontmatter` | | #52747 |
| `feat(plugin): support parent session creation` | | #52359 |
| `feat(plugin): expose session compaction` / `expose session removal` | | #52385 / #52387 |
| `feat(core): enforce skill integration policies` · `feat(core): enforce managed integration and tool policies` | | #53775 |
| `fix(core): preserve subagent notifications across location eviction` | | #54072 |
| `feat(core): move worktree tools into core` | | #53981 |

Nota: la V1 ha il suo changelog dove è sempre stato — le **GitHub Releases** (`v1.19.0`, 2026-10-11).

**Il changelog V1 e le rotture del salto a V2.**

- Il changelog della **V1** vive dove è sempre stato — le **GitHub Releases** (il `/changelog` pubblico è ormai la V2, sopra). Ultime voci:

| Versione | Data | Contenuto |
|---|---|---|
| `v1.18.34` | 2026-09-30 | header d'identità sessione/parent namespaced; ri-firma del binario macOS per macOS 27+ |
| `v1.18.33` | — | timeout Cloudflare AI Gateway; reporting dei fallimenti di lancio browser MCP; `debug` che redige le credenziali; default thinking Gemini |
| `v1.18.32` | — | — |
| `v1.18.31` | — | ripristino sessione ACP; errori auth config remota TUI |
| `v1.18.30` | — | system prompt Astra per GPT-6 |

  **Nessun breaking change** elencato fra le release V1; **nessuna voce 2.x** qui (quelle vivono nel changelog V2).
- La V2 ha avuto a lungo **note di rilascio consolidate assenti** — i cambi sparsi (Core / TUI / Desktop / SDK / Extensions) e nella guida `/v2/docs/migrate-v1`; dalla **2.0.26** esiste invece un `CHANGELOG.md` (sopra).
- **⚠️ Le tre rotture intenzionali V1→V2:**
  1. **API dei plugin** — «V1 plugin implementations do not run in V2»: nuova forma `Plugin.define({ id, setup(ctx) })`, `ctx.subscribe`→`ctx.event.subscribe`, `chat.params` spezzato in `context`/`compaction`/`generate`/`title`, scoperta da `.opencode/plugins`. **⚠️** Un plugin scritto sull'API piatta (§10.3) **non gira** sulla 2.0.29.
  2. **API server e contratti client** — usare `@opencode/client`.
  3. **Config del terminale** — `tui.json(c)` → un solo `~/.config/opencode/cli.json`.
- Riscrittura dietro la V2: **Bun→Node.js**, **Tauri→Electron**, core Effect/Schema-first, server HTTP Hono/Effect con SSE, stato sessione SQLite (Drizzle). **`[to verify]`**: internals da write-up di terze parti, non da doc ufficiali.
- Modifica minore V1 confermata dai rilasci (v1.18.33): «Debug configuration output now redacts credentials» — coerente col fatto che `opencode debug config` elenca solo le **sorgenti**, non i valori.

---

## 20. Il terreno di questa nota (ancoraggio al progetto)

**Aggiornamento del 2026-10-14:** `.daiku/project.json` **dichiara ora la chiave `documents`**, con `stack` = `STACK.md` e `architecture` = `ARCHITECTURE.md`, ed entrambi i file esistono in radice. La raccolta precedente dichiarava la chiave assente e la nota priva di ancoraggio al progetto: quel vuoto è chiuso, e questo è l'ancoraggio.

Cosa i due documenti **vincolano** la nota a rispettare:

- **`STACK.md`** — JavaScript in moduli ES nei file `.mjs`; runtime **Node.js 18 o superiore**; **nessuna dipendenza esterna** («Il pacchetto non dichiara alcun manifesto di dipendenze né alcun lockfile»); **nessuna build, nessun transpiler, nessun bundler** («ciò che si scrive è ciò che si esegue»); nessun linter, formattatore o coverage configurati; la verifica sono i banchi (`node plugins/daiku/hooks/self-check.mjs`, `.docs/tools/check-corpus.mjs`, `check-topology.mjs`, `check-no-push.mjs`) e i validatori dell'host.
- **`ARCHITECTURE.md`** — il prodotto è «un corpus di contratti più i programmi che lo sorvegliano»; **«Il metodo non porta valori»** (i valori stanno nel progetto ospite); **«Il pacchetto non scrive nel progetto»** (l'host non lo permette: ciò che deve vivere nel progetto sta fra gli scheletri, e a copiarlo è un comando); **«Le guardie nascono spente»**; **«Ogni divieto che conta vive in due sedi: il testo che dice cosa fare e un controllo che lo impone»**; il confine di pubblicazione è il ramo.

**Conseguenza diretta su qualunque resa opencode:** non si aggiunge una dipendenza al pacchetto, non c'è un passo di build da mettere in catena, e ogni divieto nuovo vuole accanto il suo controllo deterministico con banco di prova.

**Stato del cantiere verso opencode** (letto dal repository, 2026-10-14 — non è una prova sull'host):
- `.daiku/project.json` dichiara `paths.studies` = `.daiku/studies`, che è dove vive questa nota; `code_root` = `plugins/`.
- `.daiku/environment.json` **del cantiere** dichiara il solo host `claude` (`models: { judge: sonnet, worker: haiku }`, `enforcement: "harness"`, `native_backend: "claude"`).
- Lo **scheletro** `templates/project/environment.json` (ciò che `init` deposita nei progetti ospiti) dichiara **due** host, `claude` e `opencode`, con `default_host: "claude"`; la voce `opencode` porta `instructions_file: "AGENTS.md"` e **nessun `enforcement`**.
- Il pacchetto rende i ruoli anche per opencode: `plugins/daiku/agents/finder.md` e `plugins/daiku/agents/opencode/finder.md`.
- In questo repository **non esistono** `opencode.json`, `opencode.jsonc`, `.opencode/` né `AGENTS.md` (verificato 2026-10-14): il cantiere non è un progetto opencode aperto, e `opencode debug config` risponde infatti con la sola sorgente globale `C:\Users\tomas\.config\opencode`.

---

## 21. Cosa resta scoperto, in sintesi

**Domande con risposta piena** (dalla lettura al tag `v2.0.29`): Q1 (`opencode run` è non interattivo e parsabile, con stdin e `--file` come vie del prompt, NDJSON a sei tipi di evento) · Q2 (una skill si carica in una corsa, ma **non** da `run`: o il modello chiama il tool, o la si aggancia via API con `skills: [{ id }]`) · Q3 (un plugin **avvia**: crea sessioni, manda prompt, esegue comandi — e nega solo lanciando da `tool.hook("execute.before")`) · Q5 (`subagent_depth` sotto `experimental`, default 1, **identico** fra 2.0.19 e 2.0.29; `--agent` accetta un `mode: subagent` come effetto collaterale tollerato) · Q6 (un `ask` **non blocca** una corsa `run`: è rifiutato con feedback, o approvato con `--auto`).

**Q4 è la meno chiusa**: la lettura dice che con il servizio di background condiviso due corse sulla stessa sessione sono serializzate dal coordinatore in-process, che **nessun tetto di concorrenza è dichiarato**, e che `--fork` è la via sicura per non contendere una sessione — ma **nessuna prova di due corse reali è stata eseguita**, e l'assenza di lock cross-process (solo WAL + `busy_timeout = 5000`) è letta dal codice, non misurata.

**Prove non eseguite, per scelta** (spenderebbero crediti dell'owner o avvierebbero il servizio di background):

- un `opencode run` vero, con qualunque prompt: quindi **la forma osservata** dello stream NDJSON, l'ordine reale delle righe e il messaggio d'errore per un agente inesistente restano letti dal sorgente;
- `opencode debug agents` (passa da `ServerConnection.resolve()` e quindi avvia il servizio): manca il riscontro a runtime sui nomi degli agenti aperti su questa macchina;
- due corse concorrenti su due server `--standalone` che condividono lo stesso `.db`.

**Il pacchetto installato resta illeggibile** (`C:\nvm4w\nodejs\node_modules\@opencode\cli` è fuori dal perimetro di lettura): ogni citazione di sorgente è al **tag `v2.0.29`** del repository, che è la stessa versione ma non la copia in esecuzione. **`[to verify]`**: che l'albero di `@opencode/cli@2.0.29` su npm corrisponda al tag.

**Divergenze doc↔codice raccolte**, tutte a vantaggio del codice: la doc in-tree `cli.mdx` descrive i flag V1 di `run` (§14.6) · `config.mdx` dichiara `subagent_depth` in radice, che `normalize.ts` scarta (§15.4) · `permissions.mdx` dice i `.env` «denied» mentre il default è `ask` (§13.2) · `skills.mdx` mostra `skill({ name })` mentre l'input è `{ id }` (§6.6) · `/v2/docs/*.md` è 404 e `/docs/cli.md` è V1 (§18).
