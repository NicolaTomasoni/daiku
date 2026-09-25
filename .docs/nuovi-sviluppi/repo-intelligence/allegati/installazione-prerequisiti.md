# Allegato — installare i prerequisiti di `repo-intelligence`

> **Allegato di riferimento.** Non si concatena in `0. problem.md`. Materiale operativo per
> `1. decision-doc.md` (card **D3**, la toolchain) e per chi eseguirà il blueprint.
> Stato: rilevazione eseguita il **23 settembre 2026** su questa macchina.

---

## 1. Lo stato reale di questa macchina, misurato

Comando eseguito il 23 settembre 2026 dalla radice del repository, esito verbatim:

```bash
for t in git rg node npm python python3 uv pipx gh opensrc graphify codex claude; do
  printf '%-10s ' "$t"; command -v "$t" 2>/dev/null || echo "MANCANTE"; done
```

| Tool | Stato | Path / versione |
|---|---|---|
| `git` | **presente** | `/mingw64/bin/git` (Git Bash) |
| `rg` | **presente** | `.../WinGet/Links/rg` (ripgrep, installato via winget) |
| `node` | **presente** | `/c/nvm4w/nodejs/node` — **v22.23.2** |
| `npm` | **presente** | `/c/nvm4w/nodejs/npm` — **10.9.8** |
| `python` | **presente** | `C:\Python313\python` — **3.13.5** |
| `python3` | **attenzione** | risolve allo stub `WindowsApps/python3` — *non* è il Python vero: lanciarlo apre il Microsoft Store. **Usare `python`.** |
| `codex` | presente | `/c/nvm4w/nodejs/codex` |
| `claude` | presente | `/c/nvm4w/nodejs/claude` |
| `uv` | **MANCANTE** | — |
| `pipx` | **MANCANTE** | — |
| `gh` | **MANCANTE** | — (gli assi GitHub degradano a WebSearch/WebFetch) |
| `opensrc` | **MANCANTE** | — |
| `graphify` | **MANCANTE** | — |

**Conseguenza secca:** il gate chiuso della card **D3** è **rosso oggi**. La forma piena
(«si fa intero») costa un'installazione manuale prima della prima corsa. Le quattro voci mancanti
sono `uv`, `opensrc`, `graphify` — più `gh`, che è opzionale.

**Python non è un problema di versione**: Graphify chiede 3.10+, e qui c'è 3.13.5. Con
`uv tool install` per giunta uv si porta il proprio interprete isolato, quindi il Python globale
non viene toccato.

---

## 2. Cosa installare, nell'ordine

> **Prima di cominciare: spegni il presidio.** Da quando esiste il presidio del target
> (`.claude/hooks/README.md`), a interruttore acceso **nessuna installazione di pacchetti passa** —
> `uv tool install`, `npm install -g`, `pip install` comprese. Si mette `enabled: false` in
> `.claude/guardia-target.json`, si installa, si rimette `true`. Il presidio serve a impedire che un
> *agente* installi ed esegua da sé: l'owner che installa a mano è esattamente il caso permesso.

### Passo 1 — `uv` (prerequisito di Graphify)

Tre vie, dalla preferita alla meno. **Non** installarlo con `pip install uv` se si può evitare:
mette un binario di servizio dentro il Python globale.

```powershell
# A — winget (stessa via già usata per ripgrep, coerente con questa macchina)
winget install --id=astral-sh.uv -e

# B — installer ufficiale Astral
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# C — ultima spiaggia, dentro il Python globale
python -m pip install uv
```

Verifica — **non si salta**:

```powershell
uv --version
```

### Passo 2 — Graphify (`graphifyy`)

Il package PyPI si chiama **`graphifyy`** (doppia `y`), il comando CLI è **`graphify`**.
`uv tool install` lo isola in un ambiente proprio, che è la ragione per cui è la via raccomandata.

```powershell
uv tool install graphifyy

# se il comando non entra subito nel PATH:
uv tool update-shell
```

I binari di `uv tool` finiscono in `%USERPROFILE%\.local\bin`. Se il PATH non si aggiorna in
questa sessione, si può invocare il path assoluto invece di riaprire il terminale.

Fallback, se `uv` non si riesce a installare:

```powershell
pipx install graphifyy
```

Verifica:

```powershell
graphify --version
```

> **DIVIETO.** Non eseguire **mai** `graphify install` (né `graphify claude install`,
> `graphify codex install` o qualunque variante per piattaforma). Quel comando registra la
> **skill nativa di Graphify** presso l'assistente, e questa architettura vuole **un solo
> orchestratore**: l'attrezzo `repo-intelligence`. Vedi §4 per come questo divieto vuole la sua
> seconda sede.

### Passo 3 — OpenSrc

Si installa con npm e porta un binario nativo (Rust): nessun costo di Node a ogni esecuzione.

```powershell
npm install -g opensrc
```

Verifica — due comandi, perché il primo dice la versione e il secondo che la cache risponde:

```powershell
opensrc --version
opensrc list --json
```

Cache: `~/.opensrc/`, sovrascrivibile con `OPENSRC_HOME`.

### Passo 4 — `gh` (opzionale, ma consigliato)

Non è un prerequisito della pipeline: serve agli **assi GitHub** (freschezza, ultimo push, licenza,
stelline, archiviato). Senza `gh`, quegli assi degradano al ripiego che `confronta-repo` già
dichiara (WebSearch/WebFetch, coi limiti riportati nel report) — la card **D5** lo mette fra le
`limitations`.

```powershell
winget install --id GitHub.cli -e
gh auth login
```

---

## 3. Verifica finale

Da eseguire tutta, e l'esito va **riportato**, non riassunto:

```powershell
git --version
rg --version
node --version
npm --version
python --version
uv --version
opensrc --version
graphify --version
```

Atteso dopo i passi 1–3: tutte presenti, `uv`/`opensrc`/`graphify` con versione stampata.

Un primo collaudo vero, che tocca entrambi i tool senza consumare API key (è la modalità
`--code-only`, AST locale):

```powershell
opensrc path zod
graphify --version
```

Se `opensrc path zod` stampa un path sotto `~/.opensrc/`, l'acquisizione funziona. Se
`graphify --version` risponde, il grafo si può costruire.

---

## 4. I divieti, e dove vivono

Questo allegato contiene tre divieti. Per la regola di `CLAUDE.md` — *«ogni divieto che conta vive
in due sedi: il testo della skill e un controllo che lo impone, col banco che gira davvero»* —
ognuno deve avere accanto il proprio controllo, altrimenti non esiste.

| Divieto | Testo (prima sede) | Controllo (seconda sede) |
|---|---|---|
| mai `graphify install` | qui, §2 Passo 2 | **da costruire**: il gate della toolchain verifica che il grafo sia stato prodotto da `extract --code-only`, e il contratto vieta il comando; un banco prova che l'attrezzo non lo invoca |
| mai installare le skill native dei tool (Graphify, OpenSrc, altri reverse-engineering) | qui, §2 Passo 2 | **da costruire**: controllo su `.claude/skills/` e `~/.claude/skills/` che nessuna skill nuova sia comparsa dopo una corsa |
| mai eseguire codice del target analizzato | `1. decision-doc.md` § *I divieti* | **da costruire**: banco con un target-trappola che lascia una sentinella se eseguito (vedi `1. decision-doc.md`, card D3 e § *Il divieto a sede unica*) |

Nessuno dei tre controlli esiste: sono elencati come lavoro, non come fatto.

---

## 5. Versioni: cosa registrare e cosa no

La card **D3** decide: la **presenza** blocca, la **versione** si riporta. Quindi:

- il gate controlla che `opensrc` e `graphify` esistano e siano eseguibili; se manca uno, la corsa
  non parte e stampa il comando di installazione da lanciare a mano;
- la versione trovata finisce in `toolchain.json` della corsa accanto a quella dichiarata nel
  contratto, e una differenza si **riporta** fra le `limitations` — non blocca.

Nessun pin rigido: un pin invecchierebbe da solo, e la macchina è una sola.

---

## 6. Cosa questo allegato non copre

- **Quale versione di Python** usi `uv`: è uv a risolverlo per l'ambiente isolato, non serve
  deciderlo qui.
- **L'installazione di eventuali backend LLM** di Graphify (`--backend claude`, `ollama`, …):
  fuori perimetro, perché la pipeline usa `--code-only`, che non richiede chiavi.
- **Le altre macchine**: questo documento è misurato su questa. Su un'altra macchina il §1 va
  rieseguito prima di fidarsi della tabella.
- **Il controllo di presenza**: va scritto (`check-toolchain.mjs`, card D3), e non è scritto qui —
  un allegato descrive lo stato delle cose, non consegna codice.
