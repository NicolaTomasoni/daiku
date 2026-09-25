# Il presidio del target

Documentazione del presidio di **questo cantiere** (`.claude/`). Non fa parte di Daiku e non viene
pubblicato: lo script di pubblicazione copia il solo contenuto di `plugins/`, e `.claude/` sta
fuori.

Serve a una cosa sola: **impedire che un agente esegua il codice di un repository target**, cioè di
un repo di terzi preso in analisi da `repo-intelligence`. Un repository di terzi si legge, si
indicizza e si cita: non si esegue. È l'unico divieto che protegge da un effetto **fuori** dalla
sessione — uno script di terzi scrive sul filesystem, apre connessioni, lancia altro.

> **Questo file non è protetto** dal presidio: un agente può riscriverlo. La configurazione, il
> guardiano e il wiring sì. La documentazione non è normativa: se questo file dice una cosa e
> `settings.json` ne fa un'altra, vale `settings.json`.

## I tre file

| File | Cosa fa |
|---|---|
| `guardia-target.json` | l'**interruttore** (`enabled`) e la configurazione: `radici_non_eseguibili`, `programmi_permessi_sulle_radici`, `file_protetti` |
| `hooks/guardia-target.mjs` | il guardiano `PreToolUse`, con il banco `--self-check` |
| `settings.json` (in `.claude/`) | il wiring: gli hook e il blocco `permissions.deny` |

## Perché due presidi e non uno

Il repository usa già questa dottrina, scritta in `plugins/daiku/hooks/lib/command-guard.mjs`, prima
che il problema esistesse:

> *Where the host has a system `deny`, that stays the real door: absolute, and no source below can
> remove it. The two branches here close the shapes prefix matching does not see.*

- **Il `deny`** delle permission rule è la porta vera: blocca **in ogni modalità**, `bypassPermissions`
  e `--dangerously-skip-permissions` compresi, un `allow` non può scavarne un'eccezione, e **vale
  anche per i subagent**. Ma fa match **solo sul testo del comando e non vede la directory**.
- **Il guardiano** `PreToolUse` copre ciò che il `deny` non può esprimere: il **bersaglio**. Un
  `PreToolUse` che risponde `permissionDecision: "deny"` blocca anche in `bypassPermissions`, e gli
  hook di `settings.json` girano anche dentro i subagent.

**Il confine non è solo il gesto: è anche il bersaglio.** Il `deny` copre i gesti che in questo
cantiere non servono mai, con una regola assoluta. Il guardiano copre le due cose che una lista
statica non può esprimere: il **bersaglio** (eseguire dentro la radice del target) e i gesti che
vanno **accesi e spenti** (le installazioni).

## Cosa sta nel `deny`, e perché

`npm test`, `npm run`, `yarn`, `pnpm`, `make`, `cargo` (per `Bash` **e** per `PowerShell`: sono tool
distinti, e una regola `Bash` non copre PowerShell). Sono i gesti che in questo cantiere non servono
mai — è fatto di markdown e Node senza dipendenze — e negarli è gratis.

**Restano fuori** di proposito: `npm test`, `npm run`, `yarn`, `pnpm`, `make`, `cargo` coprono i
gesti che qui non servono mai, e il `deny` li blocca in modo assoluto. Tutto ciò che riguarda
**installare pacchetti** — e che quindi va poter essere acceso e spento — sta invece nel guardiano:
vedi § *Le installazioni*.

## Cosa fa il guardiano, in tre regole

1. **L'esecuzione del target.** Nega un comando di shell che esegue qualcosa dentro una
   `radici_non_eseguibili`, o che gira con il cwd già lì. Conosce le forme che la shell accetta:
   `cd` iniziale, quote attorno al nome, wrapper (`bash -c`, `cmd /c`, `powershell -Command`), path in
   stile MSYS che Git Bash produce (`/c/Users/...`).
2. **Le installazioni.** Vedi sotto.
3. **Sé stesso.** Nega la scrittura di `.claude/settings.json`, `.claude/hooks/guardia-target.mjs` e
   `guardia-target.json` — sia dai tool di scrittura, sia da un comando di shell.

### Le installazioni

A presidio acceso **non passa nessuna installazione di pacchetti**: `npm install`, `npm ci`, `pip
install`, `python -m pip install`, `uv tool install`, `pipx install`, `cargo install`, `winget
install` e le altre famiglie — **comprese quelle che servono ai prerequisiti**
(`uv tool install graphifyy`, `npm install -g opensrc`, `python -m pip install pyyaml`).

**L'interruttore è la via per permetterle**: si spegne, si installa a mano, si riaccende.

Stanno qui e non nel `deny` per una ragione precisa: **il `deny` è statico e l'interruttore non lo
tocca**. Un gesto che va acceso e spento non può vivere in una lista di permessi.

Le regex sono ancorate all'inizio del segmento di comando, quindi `rg "npm install" docs/` è una
ricerca e **non** viene negata.

### Le due esenzioni strette della terza regola

Default-deny, con due sole eccezioni:

- **i comandi di sola lettura** (`cat`, `head`, `rg`, `ls`, …), purché non concatenati e senza
  ridirezione — leggere il presidio è legittimo;
- **l'invocazione del banco di questo file** (`node … guardia-target.mjs --self-check`), purché sia il
  comando intero.

Senza la seconda il presidio negherebbe il proprio banco, e un presidio che non si può provare non è
un presidio. La versione con questa correzione è in
`.docs/nuovi-sviluppi/repo-intelligence/allegati/guardia-target-corretto.mjs`; va copiata a mano
(vedi § *Difetti aperti*).

## Il banco

```
node .claude/hooks/guardia-target.mjs --self-check
```

Stampa `{"checks":N,"passed":N,"failed":[]}` ed esce `1` al primo rosso. Si lancia **dopo ogni
modifica al guardiano o alla configurazione**: un banco che non gira esce verde come uno che gira, e
il verde da solo non distingue i due casi — il numero sì.

Il banco contiene anche un controllo di **disallineamento**: prova su una copia della configurazione,
e se la copia diverge dal file vero su `programmi_permessi_sulle_radici` o `file_protetti`, il caso è
rosso. È il modo in cui un banco invecchia in silenzio.

## L'interruttore

`enabled: false` in `guardia-target.json` spegne **il ramo dell'esecuzione del target**. Tutto passa.

**Cosa non spegne:** la protezione dei tre file del presidio. Se bastasse spegnere l'interruttore per
aprirli, un agente lo spegnerebbe per riscriverli. Per far evolvere il presidio: lo modifichi a mano,
oppure togli temporaneamente il blocco `hooks` da `settings.json`.

## Difetti aperti

1. **Il banco non è lanciabile nella versione in esercizio.** `node … guardia-target.mjs --self-check`
   viene negato, perché il comando nomina un file protetto. Correzione pronta e verificata (`41/41`)
   in `allegati/guardia-target-corretto.mjs`. Da applicare **fuori dalla sessione agente**:

   ```powershell
   Copy-Item .docs/nuovi-sviluppi/repo-intelligence/allegati/guardia-target-corretto.mjs .claude/hooks/guardia-target.mjs -Force
   node .claude/hooks/guardia-target.mjs --self-check
   ```

2. **La chiave `_perche_il_deny` in `settings.json`** è una chiave non riconosciuta in un file di
   configurazione dell'host. Claude Code la tollera, ma è spuria: si toglie a mano. La spiegazione
   che conteneva è nel § *Cosa sta nel `deny`, e perché* di questo file.

## Limiti, detti senza fingere

Il match è **sul testo del comando**: un binario rinominato, un path costruito a runtime, un `/bin/rm`
esplicito possono sfuggire. Un hook in timeout **non blocca**. Il guardiano è **fail-open**: davanti a
un guasto tace ed esce `0`, e in quel caso lo dichiara su stdout, perché un presidio silenzioso e uno
spento si leggono uguali.

La garanzia che non dipende dal testo del comando sarebbe la **sandbox** del filesystem — e qui non si
applica, perché `graphify` deve leggere il target per indicizzarlo.

È un guardrail contro la distrazione, non un confine contro un attaccante. La stessa dichiarazione che
apre `command-guard.mjs` del pacchetto.
