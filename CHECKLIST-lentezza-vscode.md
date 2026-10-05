# Checklist — VS Code e Claude Code che rallentano

File **portabile**: si copia su un'altra macchina, o in un altro progetto, e si compila.
Serve a rispondere a una domanda sola:

> il problema è di *questa* installazione, o è diffuso?

Nessun percorso di una macchina specifica, nessun nome di progetto. Tutti i comandi usano
variabili d'ambiente. Girano su PowerShell, Windows nativo.

**Come si usa.** Ogni voce ha tre parti: cosa guardare, il comando, e il criterio — che è un
numero, non un'impressione. Compila la colonna *esito*, porta il file com'è, e la diffusione
del problema si legge dal riepilogo.

## Riepilogo da compilare

| # | Controllo | Esito | Anomalo? |
|---|---|---|---|
| 1 | Sintomo quantificato (in colla, apertura) | | |
| 2 | Sessioni Claude vive vs. tab aperte | | |
| 3 | Finestre sulla stessa cartella | | |
| 4 | Riavvii dell'extension host | | |
| 5 | File sorvegliati dal watcher | | |
| 6 | Commit usato / limite | | |
| 7 | Dimensione del contenitore sessioni | | |
| 8 | Lock IDE orfani | | |
| 9 | Righe di log per sessione | | |
| 10 | Esclusioni Defender | | |

---

## 1. Il sintomo, prima di misurarlo

Non "sembra lento": quanto. Cronometra due gesti, a freddo e dopo qualche ora di lavoro.

- **Incolla** un blocco di testo lungo in un editor: `Ctrl+V` → testo comparso.
- **Apri** una nuova scheda di chat di Claude Code e scrivi il primo messaggio.

Criterio: sotto ~1 s è normale. Fra 1 e 3 s è da annotare. **Oltre 3 s è il sintomo**, e va
cronometrato due volte — a macchina appena avviata e dopo qualche ora — perché è il divario
fra i due che dice se il problema è di accumulo.

Esito: ____ / ____

## 2. Sessioni Claude vive, contro le tab che credi di avere aperte

```powershell
Get-Process claude -ErrorAction SilentlyContinue | Select-Object Id, StartTime, @{n='MB';e={[math]::Round($_.WorkingSet64/1MB,0)}}
```

Criterio: ogni processo `claude.exe` è una scheda residente, ~250 MB più un figlio `node` per
ogni server MCP. **Se i processi sono più delle tab che hai in mente, hai sessioni che credi
chiuse e non lo sono.** Confronta con `~/.claude/sessions/*.json`, che porta `status` e `cwd`.

Esito: ____

## 3. Più finestre sulla stessa cartella

È la causa più sottovalutata, e la più facile da provare. Nei log dell'extension host:

```powershell
$L = "$env:APPDATA\Code\logs"
Get-ChildItem $L | Sort-Object Name -Descending | Select-Object -First 1 |
  Select-Object -ExpandProperty FullName
# poi, dentro la sessione piu' recente:
#   Select-String -Path "<sessione>\window*\exthost\exthost.log" -Pattern 'Skipping acquiring lock'
```

Criterio: **una riga `Skipping acquiring lock for ...workspaceStorage\<hash>` significa che
un'altra finestra tiene quella cartella.** Due finestre sullo stesso progetto costano due
watcher, due estensioni Git, due server di linguaggio — e l'extension host riavvia a ogni
avvio perché non riesce a prendere il lock.

Due controlli che toglierebbero il falso positivo, prima di concluderlo. La riga compare anche
quando una finestra si ricarica mentre la precedente non ha ancora mollato il lock; e **i lock
IDE non contano le finestre** — `~/.claude/ide/*.lock` con due voci sulla stessa cartella li
scrive anche una finestra sola. Il numero di finestre lo dà solo l'elenco dei titoli:

```powershell
Get-Process Code | Where-Object { $_.MainWindowTitle } | Select-Object Id, MainWindowTitle
```

Esito: ____ occorrenze, su ____ hash distinti, su ____ finestre con un titolo

## 4. Riavvii dell'extension host

```powershell
Select-String -Path "<sessione>\window*\exthost\exthost.log" -Pattern 'Extension host with pid|terminating'
```

Criterio: una sessione di VS Code con **più di un avvio per finestra** sta instabilizzando
l'estensione sotto le dita. È il "glitcha, non carica" visto dal lato del log.

Esito: ____ avvii, ____ terminazioni

## 5. Quanti file VS Code sta sorvegliando

Il watcher non guarda ciò che è nascosto nell'esploratore: guarda `files.watcherExclude`.

```powershell
# i file del workspace, per macrocartella
Get-ChildItem <cartella-progetto> -Recurse -File -Force -ErrorAction SilentlyContinue |
  Measure-Object | Select-Object Count
# le chiavi di esclusione del watcher
Get-Content <cartella-progetto>\.vscode\settings.json -Raw
```

Criterio: **`files.exclude` non esclude dal watcher.** I default coprono solo `node_modules`
e `.git/objects`. Se in `files.watcherExclude` non compaiono `venv`, `target` (Rust e Maven),
`__pycache__`, `.turbo`, le cache Python, e il workspace supera ~20.000 file, il watcher sta
lavorando per niente. Da correggere:

```json
"files.watcherExclude": {
  "**/venv/**": true, "**/target/**": true, "**/__pycache__/**": true,
  "**/.turbo/**": true, "**/.pytest_cache/**": true, "**/.ruff_cache/**": true,
  "**/.mypy_cache/**": true
}
```

Esito: ____ file totali, ____ glob di esclusione

## 6. Memoria: guarda il commit, non la RAM libera

```powershell
$os = Get-CimInstance Win32_OperatingSystem
"Commit usato MB: {0}" -f [math]::Round(($os.TotalVirtualMemorySize - $os.FreeVirtualMemory)/1KB, 0)
"Limite commit MB: {0}" -f [math]::Round($os.TotalVirtualMemorySize/1KB, 0)
Get-CimInstance Win32_PageFileUsage | Select-Object Name, AllocatedBaseSize, CurrentUsage
```

Criterio: **"RAM libera" non è memoria disponibile.** Con un commit oltre il ~70% del limite e
un page file piccolo sull'unità di sistema, la macchina pagina — e tutto rallenta, compreso
l'incolla, senza che la RAM fisica risulti esaurita.

Esito: ____ / ____

## 7. Il contenitore delle sessioni

```powershell
$p = "$env:USERPROFILE\.claude\projects"
Get-ChildItem $p -File -Recurse -ErrorAction SilentlyContinue | Measure-Object Length -Sum |
  ForEach-Object { "{0} file, {1:N0} MB" -f $_.Count, ($_.Sum/1MB) }
Get-ChildItem $p -Directory | ForEach-Object {
  $s = Get-ChildItem $_.FullName -File -Recurse -ErrorAction SilentlyContinue | Measure-Object Length -Sum
  [pscustomobject]@{ Progetto=$_.Name; File=$s.Count; MB=[math]::Round($s.Sum/1MB,1) }
} | Sort-Object MB -Descending | Select-Object -First 10
```

Criterio: è igiene del disco, **non la causa della lentezza** — l'extension host non sta sulla
strada dei transcript. Annotalo per la diffusione. Se decidi di toccare la ritenzione, sappi
che `cleanupPeriodDays` (default 30, minimo 1) **governa anche la rimozione dei worktree
orfani**, guarda la data dell'ultima scrittura e non quella della conversazione, e non passa
dal cestino.

Esito: ____ file, ____ MB

## 8. Lock IDE orfani

```powershell
Get-ChildItem "$env:USERPROFILE\.claude\ide\*.lock" | ForEach-Object {
  $j = Get-Content $_.FullName -Raw | ConvertFrom-Json
  "{0} pid={1} vivo={2} {3}" -f $_.Name, $j.pid,
    [bool](Get-Process -Id $j.pid -ErrorAction SilentlyContinue), ($j.workspaceFolders -join ',')
}
```

Criterio: **un lock che punta a un pid morto è causa classica del "non si aggancia".** Si
cancellano solo quelli con `vivo=False`, verificando la liveness nell'istante stesso della
cancellazione.

**Il pid vivo però non basta.** L'IDE resta aperto mentre la sessione che aveva scritto il lock
non c'è più, e il lock sopravvive. Il secondo segnale è il confronto con
`~/.claude/sessions/*.json`: nessuna sessione dietro quell'IDE, lock residuo. Il terzo è la
replica: due lock sulla stessa cartella sono un residuo, qualunque sia il pid.

Esito: ____ lock, ____ orfani

## 9. Quanto rumore scrive l'estensione

```powershell
$L = "$env:APPDATA\Code\logs"
Get-ChildItem $L | Sort-Object Name -Descending | Select-Object -First 1 |
  ForEach-Object { Get-ChildItem "$($_.FullName)" -Recurse -Filter 'Claude VSCode.log' } |
  ForEach-Object {
    $f = $_
    [pscustomobject]@{
      Percorso = $f.FullName.Replace($L,'')
      Righe    = (Get-Content $f.FullName | Measure-Object).Count
      Debug    = (Select-String -Path $f.FullName -SimpleMatch 'hooks module' | Measure-Object).Count
      Warning  = (Select-String -Path $f.FullName -SimpleMatch 'not canonicalizing' | Measure-Object).Count
      Testo    = (Select-String -Path $f.FullName -SimpleMatch 'treating as plain text' | Measure-Object).Count
    }
  } | Format-Table -AutoSize
```

Criterio: tre cose da annotare, nessuna delle quali è la causa della lentezza ma tutte
indizio di configurazione:

- **`Debug`** alto → ogni riga di debug del CLI finisce in questo file. L'estensione non ha una
  voce per abbassarla: il livello è del CLI, che parte dal minimo `debug`, e si dichiara
  nell'ambiente con `CLAUDE_CODE_DEBUG_LOG_LEVEL` — da una sessione dell'estensione, in
  `claudeCode.environmentVariables`.
- **`Warning`** a ~2 per chiamata di tool → irrilevante ma gonfia il canale di output.
- **`Testo`** (`Hook output does not start with {`) → un hook emette testo invece di JSON.
  Su una macchina verificata venivano **da un modulo interno di Claude Code**
  (`cc-plugin-*@builtin`), non da hook di progetto: prima di cercare nei tuoi, escludi i tuoi.

Esito: ____ righe, ____ debug

## 10. Esclusioni Defender

```powershell
# da processo elevato: senza elevazione la lettura delle esclusioni e' negata
Get-MpPreference | Select-Object -ExpandProperty ExclusionPath
Get-MpPreference | Select-Object -ExpandProperty ExclusionProcess
```

Criterio: la protezione in tempo reale ispeziona **ogni processo che nasce**. Una macchina che
compila Rust, Java e Python insieme dovrebbe avere in `ExclusionProcess` almeno `cargo.exe`,
`rustc.exe`, `link.exe`, e in `ExclusionPath` le cartelle di lavoro più lo store dei pacchetti
(`pnpm`, `.cargo`, `.rustup`, il runtime di Node). È una riduzione di copertura: decisione
dell'owner, non un default.

Esito: ____ percorsi, ____ processi

---

## Trappole di metodo

Quattro errori fatti *davvero* durante la stesura di questa checklist. Sono la parte che si
ricommette più facilmente.

- **La media mente.** "992 ms per comando di shell" era il numero sbagliato: la mediana era
  192 ms e metà delle chiamate stava sotto i 200. Una media su 500 campioni con 27 valori
  sopra i 3 s racconta una storia che non c'è. **Guarda sempre la mediana e i quantili.**
- **Un processo che gira non è un processo che pesa.** Un renderer al 40% di un core fermo è
  anomalo; un *timestamp* che avanza non dice niente sul costo. Da soli, `Get-Process` e il
  Task Manager non attribuiscono: servono gli strumenti dell'applicazione.
- **Verifica i falsi positivi con la stessa funzione, non a occhio.** Un chip di "lettura
  fuori dal perimetro" su un'espressione regolare si spiega in una riga:

  ```powershell
  node -e 'const p=require("path"); console.log(p.resolve("C:/qualsiasi", "\\[Stall\\]"))'
  # -> C:\[Stall\]
  ```

  Su Windows `\qualcosa` è un path relativo all'unità corrente. Qualunque guardia che
  risolva token senza chiedersi se sono path **pagherà questo falso positivo** — e le
  espressioni regolari, che cominciano con un backslash, lo fanno scattare spesso.

- **Non dedurre l'emettitore dal nome.** Un hook si attribuisce leggendo se scrive
  `JSON.stringify`, non dal fatto che "sembra suo". Tre candidati su cinque sono caduti così.
  `grep -n -A2 'process.stdout.write' <hook>.mjs` lo dice in un colpo.

## Cosa riportare

Il riepilogo compilato, più — per ogni voce anomala — l'**uscita grezza** del comando. Non la
tua sintesi: il testo. Con il riepilogo di tre macchine, la diffusione si legge da sola.
