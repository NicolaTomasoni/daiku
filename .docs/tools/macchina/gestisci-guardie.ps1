# Gestisce le guardie di macchina di Claude Code, da amministratore.
#
# Le guardie vivono tutte sotto C:\Program Files\ClaudeCode\, dove scrivono solo gli
# amministratori:
# - il recinto sulle letture (recinto-letture.mjs, nel blocco hooks dei managed settings);
# - il presidio del target (guardia-target.mjs, nello stesso blocco hooks);
# - l'interruttore del presidio (enabled in guardia-target.json);
# - la lista deny di macchina (permissions.deny dei managed settings).
# "Tutto spento" le toglie tutte, "tutto acceso" le rimette tutte. Cio' che si spegne va in
# guardie-accese.json, accanto ai managed settings, e da li' si rimette. Ogni scrittura fa
# prima una copia di sicurezza accanto al file.
#
# Questo file nel repository e' il SORGENTE. La copia che si lancia e' quella installata in
# C:\Program Files\ClaudeCode\tools\, dal task di VS Code "Daiku: gestisci guardie
# (amministratore)". Lanciato dal repository fa una cosa sola: la prima installazione. Dopo, rifiuta:
# un agente puo' modificare il repository, e un file che lui scrive non deve girare come
# amministratore senza che l'owner ne abbia visto il diff. Gli aggiornamenti passano dalla voce
# "Aggiorna da repository" della copia installata, che copia il sorgente in Program Files,
# mostra il diff e installa quella copia solo dopo la conferma.
#
# Claude Code legge gli hook all'avvio: dopo ogni cambio, riavvia le sessioni.
#
# Il banco: powershell -NoProfile -ExecutionPolicy Bypass -File .docs\tools\macchina\prova-gestisci-guardie.ps1
# Lo carica con -Radice rimappato su una cartella temporanea, senza amministratore.

param(
  [string]$Radice = 'C:\Program Files\ClaudeCode'
)

# Moduli solo dalle sedi di sistema: la cartella dei moduli dell'utente la scrive anche un agente,
# e un modulo con il nome giusto li' verrebbe caricato in questa sessione elevata.
$env:PSModulePath = (Join-Path $env:ProgramFiles 'WindowsPowerShell\Modules') + ';' + (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\Modules')

$ErrorActionPreference = 'Stop'

$fileMacchina = Join-Path $Radice 'managed-settings.json'
$fileAccese = Join-Path $Radice 'guardie-accese.json'
$fileInterruttore = Join-Path $Radice 'guardia-target.json'
$fileGuardiano = Join-Path $Radice 'guardia-target.mjs'
$cartellaStrumenti = Join-Path $Radice 'tools'
$fileStrumento = Join-Path $cartellaStrumenti 'gestisci-guardie.ps1'
$fileSorgente = Join-Path $cartellaStrumenti 'sorgente.txt'
$cartellaArrivo = Join-Path $cartellaStrumenti 'in-arrivo'
$fileCorrezione = Join-Path $cartellaStrumenti 'correzione-in-esame.ps1'
$powershellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

# Cosa si installa: il nome nel sorgente e dove va.
function Voci-Installazione {
  return @(
    @{ Nome = 'gestisci-guardie.ps1'; Destinazione = $fileStrumento },
    @{ Nome = 'guardia-target.mjs'; Destinazione = $fileGuardiano },
    @{ Nome = 'guardia-target.json'; Destinazione = $fileInterruttore }
  )
}

# ---------------------------------------------------------------------------
# JSON e copie di sicurezza
# ---------------------------------------------------------------------------

function Leggi-Json($percorso) {
  if (-not (Test-Path $percorso)) {
    return $null
  }
  $testo = Get-Content -Path $percorso -Raw -Encoding utf8
  if ([string]::IsNullOrWhiteSpace($testo)) {
    return $null
  }
  return $testo | ConvertFrom-Json
}

# UTF-8 senza BOM: in PowerShell 5.1 Set-Content -Encoding utf8 scrive il BOM, e un JSON.parse
# che non lo toglie tratta il file come assente.
function Salva-Testo($percorso, $testo) {
  $senzaBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($percorso, $testo, $senzaBom)
}

function Salva-Json($percorso, $oggetto) {
  Salva-Testo $percorso ($oggetto | ConvertTo-Json -Depth 20)
}

function Copia-Sicurezza($percorso) {
  if (-not (Test-Path $percorso)) {
    return
  }
  $marca = Get-Date -Format 'yyyyMMdd-HHmmss'
  Copy-Item -Path $percorso -Destination "$percorso.bak-$marca" -Force
}

# Cambia il valore sul posto se la proprieta' c'e': Add-Member -Force la sposterebbe in fondo, e
# ogni scrittura riordinerebbe le chiavi del file.
function Imposta($oggetto, $nome, $valore) {
  if ($null -ne $oggetto.PSObject.Properties[$nome]) {
    $oggetto.$nome = $valore
  }
  else {
    $oggetto | Add-Member -NotePropertyName $nome -NotePropertyValue $valore
  }
}

function Conta-Deny($impostazioni) {
  if (($null -eq $impostazioni) -or ($null -eq $impostazioni.permissions)) {
    return 0
  }
  if ($null -eq $impostazioni.permissions.deny) {
    return 0
  }
  return @($impostazioni.permissions.deny).Count
}

# ---------------------------------------------------------------------------
# Il blocco hooks: recinto e presidio
# ---------------------------------------------------------------------------

function Comandi-Hooks($hooks) {
  $fuori = @()
  if ($null -eq $hooks) {
    return $fuori
  }
  foreach ($voce in @($hooks.PreToolUse)) {
    if ($null -eq $voce) {
      continue
    }
    foreach ($h in @($voce.hooks)) {
      if (($null -ne $h) -and ($null -ne $h.command)) {
        $fuori += [string]$h.command
      }
    }
  }
  return $fuori
}

function Ha-Comando($hooks, $nomeFile) {
  return (@(Comandi-Hooks $hooks | Where-Object { $_ -like "*$nomeFile*" }).Count -gt 0)
}

function Voce-Guardiano {
  return [PSCustomObject]@{
    matcher = 'Bash|PowerShell'
    hooks = @(
      [PSCustomObject]@{
        type = 'command'
        command = 'node "' + $fileGuardiano + '"'
        timeout = 15
        statusMessage = 'Presidio del target'
      }
    )
  }
}

# Il blocco hooks con il presidio dentro, aggiunto in coda se manca.
function Con-Guardiano($hooks) {
  if ($null -eq $hooks) {
    $hooks = New-Object PSObject
  }
  if (Ha-Comando $hooks 'guardia-target.mjs') {
    return $hooks
  }
  $lista = @()
  if ($null -ne $hooks.PreToolUse) {
    $lista = @($hooks.PreToolUse)
  }
  $lista += (Voce-Guardiano)
  Imposta $hooks 'PreToolUse' $lista
  return $hooks
}

# A guardie accese, il presidio entra subito nei managed settings. A guardie spente ce lo mette
# "tutto acceso", che lo aggiunge sempre quando e' installato.
function Registra-Guardiano {
  $macchina = Leggi-Json $fileMacchina
  if (($null -eq $macchina) -or ($null -eq $macchina.hooks)) {
    return
  }
  if (Ha-Comando $macchina.hooks 'guardia-target.mjs') {
    return
  }
  Copia-Sicurezza $fileMacchina
  Imposta $macchina 'hooks' (Con-Guardiano $macchina.hooks)
  Salva-Json $fileMacchina $macchina
}

# ---------------------------------------------------------------------------
# Spegnere e accendere
# ---------------------------------------------------------------------------

# Le guardie di macchina a riposo: cio' che "tutto spento" ha tolto e "tutto acceso" rimette.
# Per un pezzo che guardie-accese.json non ha, ripiega sulla copia di sicurezza piu' recente
# dei managed settings che lo contiene.
function Leggi-Accese {
  $accese = Leggi-Json $fileAccese
  if ($null -eq $accese) {
    $accese = New-Object PSObject
  }
  if ($null -eq $accese.hooks) {
    Imposta $accese 'hooks' $null
  }
  if ($null -eq $accese.deny) {
    Imposta $accese 'deny' $null
  }
  if (($null -eq $accese.hooks) -or ($null -eq $accese.deny)) {
    $copie = @(Get-ChildItem -Path $Radice -Filter 'managed-settings.json.bak-*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending)
    foreach ($copia in $copie) {
      $vecchio = Leggi-Json $copia.FullName
      if ($null -eq $vecchio) {
        continue
      }
      if (($null -eq $accese.hooks) -and ($null -ne $vecchio.hooks)) {
        Imposta $accese 'hooks' $vecchio.hooks
      }
      if (($null -eq $accese.deny) -and ((Conta-Deny $vecchio) -gt 0)) {
        Imposta $accese 'deny' $vecchio.permissions.deny
      }
    }
  }
  return $accese
}

function Spegni-Macchina {
  $macchina = Leggi-Json $fileMacchina
  if ($null -eq $macchina) {
    Write-Host "Managed settings non trovati in $fileMacchina, niente da spegnere." -ForegroundColor Yellow
    return
  }
  $haHooks = ($null -ne $macchina.hooks)
  $haDeny = ((Conta-Deny $macchina) -gt 0)
  if ((-not $haHooks) -and (-not $haDeny)) {
    return
  }
  $accese = Leggi-Accese
  if ($haHooks) {
    Imposta $accese 'hooks' $macchina.hooks
  }
  if ($haDeny) {
    Imposta $accese 'deny' $macchina.permissions.deny
  }
  Copia-Sicurezza $fileAccese
  Salva-Json $fileAccese $accese

  Copia-Sicurezza $fileMacchina
  if ($haHooks) {
    $macchina.PSObject.Properties.Remove('hooks')
  }
  if ($haDeny) {
    $macchina.permissions.PSObject.Properties.Remove('deny')
  }
  Salva-Json $fileMacchina $macchina
}

function Accendi-Macchina {
  $macchina = Leggi-Json $fileMacchina
  if ($null -eq $macchina) {
    Write-Host "Managed settings non trovati in $fileMacchina, niente da accendere." -ForegroundColor Yellow
    return
  }
  $accese = Leggi-Accese
  $cambiato = $false
  if ($null -eq $macchina.hooks) {
    if ($null -eq $accese.hooks) {
      Write-Host 'Recinto non riattaccato: ne guardie-accese.json ne le copie lo hanno, rimettilo a mano.' -ForegroundColor Yellow
    }
    else {
      Imposta $macchina 'hooks' $accese.hooks
      $cambiato = $true
    }
  }
  if ((Conta-Deny $macchina) -eq 0) {
    if ($null -eq $accese.deny) {
      Write-Host 'Lista deny di macchina non ripristinata: ne guardie-accese.json ne le copie la hanno, rimettila a mano.' -ForegroundColor Yellow
    }
    else {
      if ($null -eq $macchina.permissions) {
        Imposta $macchina 'permissions' (New-Object PSObject)
      }
      Imposta $macchina.permissions 'deny' $accese.deny
      $cambiato = $true
    }
  }
  if ((Test-Path $fileGuardiano) -and (-not (Ha-Comando $macchina.hooks 'guardia-target.mjs'))) {
    Imposta $macchina 'hooks' (Con-Guardiano $macchina.hooks)
    $cambiato = $true
  }
  if ($cambiato) {
    Copia-Sicurezza $fileMacchina
    Salva-Json $fileMacchina $macchina
  }
}

function Imposta-Interruttore($acceso) {
  $config = Leggi-Json $fileInterruttore
  if ($null -eq $config) {
    Write-Host "Interruttore non trovato in $fileInterruttore." -ForegroundColor Yellow
    return
  }
  if ($config.enabled -eq $acceso) {
    return
  }
  Copia-Sicurezza $fileInterruttore
  Imposta $config 'enabled' $acceso
  Salva-Json $fileInterruttore $config
}

function Tutto-Spento {
  Imposta-Interruttore $false
  Spegni-Macchina
}

function Tutto-Acceso {
  Imposta-Interruttore $true
  Accendi-Macchina
}

function Leggi-Stato {
  $macchina = Leggi-Json $fileMacchina
  $config = Leggi-Json $fileInterruttore
  $hooks = $null
  if ($null -ne $macchina) {
    $hooks = $macchina.hooks
  }
  return [PSCustomObject]@{
    Macchina = ($null -ne $macchina)
    Recinto = (Ha-Comando $hooks 'recinto-letture.mjs')
    Guardiano = (Ha-Comando $hooks 'guardia-target.mjs')
    Installato = (Test-Path $fileGuardiano)
    Interruttore = (($null -ne $config) -and ($config.enabled -eq $true))
    Deny = (Conta-Deny $macchina)
  }
}

# Stampa lo stato. Ritorna $true se e' tutto acceso, $false se e' tutto spento, $null se misto.
function Mostra-Stato {
  $s = Leggi-Stato
  Write-Host ''
  Write-Host 'Stato attuale:'
  if (-not $s.Macchina) {
    Write-Host "- Managed settings: $fileMacchina non trovato" -ForegroundColor Yellow
  }
  if ($s.Recinto) {
    Write-Host '- Recinto sulle letture: GIRA' -ForegroundColor Red
  }
  else {
    Write-Host '- Recinto sulle letture: STACCATO' -ForegroundColor Green
  }
  if (-not $s.Installato) {
    Write-Host '- Presidio del target: NON INSTALLATO' -ForegroundColor Yellow
  }
  elseif ($s.Guardiano) {
    Write-Host '- Presidio del target: GIRA' -ForegroundColor Red
  }
  else {
    Write-Host '- Presidio del target: STACCATO' -ForegroundColor Green
  }
  if ($s.Interruttore) {
    Write-Host '- Interruttore del presidio (target e installazioni): ACCESO' -ForegroundColor Red
  }
  else {
    Write-Host '- Interruttore del presidio (target e installazioni): SPENTO' -ForegroundColor Green
  }
  if ($s.Deny -gt 0) {
    Write-Host "- Negati di macchina (cartelle personali, credenziali, git push): $($s.Deny) regole" -ForegroundColor Red
  }
  else {
    Write-Host '- Negati di macchina (cartelle personali, credenziali, git push): NESSUNO' -ForegroundColor Green
  }

  if ($s.Recinto -and $s.Guardiano -and $s.Interruttore -and ($s.Deny -gt 0)) {
    Write-Host '=> TUTTO ACCESO' -ForegroundColor Red
    return $true
  }
  if ((-not $s.Recinto) -and (-not $s.Guardiano) -and (-not $s.Interruttore) -and ($s.Deny -eq 0)) {
    Write-Host '=> TUTTO SPENTO' -ForegroundColor Green
    return $false
  }
  Write-Host '=> MISTO (in parte acceso, in parte spento)' -ForegroundColor Yellow
  return $null
}

# ---------------------------------------------------------------------------
# Installare e aggiornare
# ---------------------------------------------------------------------------

# Le righe tolte e aggiunte fra due versioni, con il numero di riga. Taglia prima la parte
# comune in testa e in coda, poi confronta il resto con la sottosequenza comune piu' lunga.
function Righe-Diff($vecchie, $nuove) {
  $vecchie = @($vecchie)
  $nuove = @($nuove)
  $testa = 0
  while (($testa -lt $vecchie.Count) -and ($testa -lt $nuove.Count) -and ($vecchie[$testa] -ceq $nuove[$testa])) {
    $testa++
  }
  $coda = 0
  while (($coda -lt ($vecchie.Count - $testa)) -and ($coda -lt ($nuove.Count - $testa)) -and ($vecchie[$vecchie.Count - 1 - $coda] -ceq $nuove[$nuove.Count - 1 - $coda])) {
    $coda++
  }
  $n = $vecchie.Count - $testa - $coda
  $m = $nuove.Count - $testa - $coda
  $t = New-Object 'int[,]' ($n + 1), ($m + 1)
  for ($i = $n - 1; $i -ge 0; $i--) {
    for ($j = $m - 1; $j -ge 0; $j--) {
      if ($vecchie[$testa + $i] -ceq $nuove[$testa + $j]) {
        $t[$i, $j] = $t[($i + 1), ($j + 1)] + 1
      }
      else {
        $sotto = $t[($i + 1), $j]
        $accanto = $t[$i, ($j + 1)]
        $t[$i, $j] = [Math]::Max($sotto, $accanto)
      }
    }
  }
  $fuori = New-Object System.Collections.Generic.List[string]
  $i = 0
  $j = 0
  while (($i -lt $n) -or ($j -lt $m)) {
    $togli = ($j -ge $m)
    if ((-not $togli) -and ($i -lt $n)) {
      $sotto = $t[($i + 1), $j]
      $accanto = $t[$i, ($j + 1)]
      $togli = ($sotto -ge $accanto)
    }
    if (($i -lt $n) -and ($j -lt $m) -and ($vecchie[$testa + $i] -ceq $nuove[$testa + $j])) {
      $i++
      $j++
    }
    elseif ($togli) {
      $fuori.Add(('{0,5} - {1}' -f ($testa + $i + 1), $vecchie[$testa + $i]))
      $i++
    }
    else {
      $fuori.Add(('{0,5} + {1}' -f ($testa + $j + 1), $nuove[$testa + $j]))
      $j++
    }
  }
  return $fuori.ToArray()
}

# La copia in arrivo del config tiene l'interruttore della copia installata, e passa dallo
# stesso formato che scrive questo strumento: cosi' il diff mostra solo cambi veri.
function Conserva-Interruttore($arrivo) {
  $nuovo = Leggi-Json $arrivo
  if ($null -eq $nuovo) {
    throw "Config in arrivo illeggibile: $arrivo"
  }
  $installato = Leggi-Json $fileInterruttore
  if (($null -ne $installato) -and ($installato.enabled -is [bool])) {
    Imposta $nuovo 'enabled' $installato.enabled
  }
  Salva-Json $arrivo $nuovo
}

# Copia il sorgente in in-arrivo, sotto Program Files: da qui in avanti si confronta e si
# installa questa copia, e una modifica al repository nel frattempo non entra.
function Prepara-Arrivo($cartellaSorgente) {
  if (-not (Test-Path $cartellaStrumenti)) {
    New-Item -ItemType Directory -Force $cartellaStrumenti | Out-Null
  }
  if (Test-Path $cartellaArrivo) {
    Remove-Item $cartellaArrivo -Recurse -Force
  }
  New-Item -ItemType Directory -Force $cartellaArrivo | Out-Null
  $esito = @()
  foreach ($voce in Voci-Installazione) {
    $da = Join-Path $cartellaSorgente $voce.Nome
    if (-not (Test-Path $da)) {
      throw "Manca nel sorgente: $da"
    }
    $arrivo = Join-Path $cartellaArrivo $voce.Nome
    Copy-Item -Path $da -Destination $arrivo -Force
    if ($voce.Nome -eq 'guardia-target.json') {
      Conserva-Interruttore $arrivo
    }
    $nuovo = -not (Test-Path $voce.Destinazione)
    $vecchie = @()
    if (-not $nuovo) {
      $vecchie = @(Get-Content -Path $voce.Destinazione -Encoding utf8)
    }
    $nuove = @(Get-Content -Path $arrivo -Encoding utf8)
    $esito += [PSCustomObject]@{
      Nome = $voce.Nome
      Arrivo = $arrivo
      Destinazione = $voce.Destinazione
      Nuovo = $nuovo
      Righe = $nuove.Count
      Hash = (Get-FileHash -Path $arrivo -Algorithm SHA256).Hash.Substring(0, 16)
      Diff = @(Righe-Diff $vecchie $nuove)
    }
  }
  return $esito
}

# Stampa cosa cambierebbe. Ritorna quanti file cambiano.
function Mostra-Arrivo($esito) {
  $cambiano = 0
  foreach ($voce in $esito) {
    Write-Host ''
    if ($voce.Nuovo) {
      Write-Host ("NUOVO      {0}  ({1} righe, sha256 {2}...)" -f $voce.Nome, $voce.Righe, $voce.Hash) -ForegroundColor Cyan
      $cambiano++
      continue
    }
    if ($voce.Diff.Count -eq 0) {
      Write-Host ("invariato  {0}" -f $voce.Nome) -ForegroundColor DarkGray
      continue
    }
    $cambiano++
    Write-Host ("CAMBIA     {0}  ({1} righe di diff)" -f $voce.Nome, $voce.Diff.Count) -ForegroundColor Cyan
    foreach ($riga in $voce.Diff) {
      if ($riga -match '^\s*\d+ - ') {
        Write-Host $riga -ForegroundColor Red
      }
      else {
        Write-Host $riga -ForegroundColor Green
      }
    }
  }
  return $cambiano
}

function Applica-Arrivo($esito, $cartellaSorgente) {
  foreach ($voce in $esito) {
    if ((-not $voce.Nuovo) -and ($voce.Diff.Count -eq 0)) {
      continue
    }
    Copia-Sicurezza $voce.Destinazione
    Copy-Item -Path $voce.Arrivo -Destination $voce.Destinazione -Force
  }
  Salva-Testo $fileSorgente $cartellaSorgente
  Registra-Guardiano
  Remove-Item $cartellaArrivo -Recurse -Force
}

function Leggi-Sorgente {
  if (-not (Test-Path $fileSorgente)) {
    return $null
  }
  return (Get-Content -Path $fileSorgente -Raw -Encoding utf8).Trim()
}

# ---------------------------------------------------------------------------
# Correzioni di macchina
# ---------------------------------------------------------------------------

# Copia la proposta sotto Program Files e ne ritorna le righe: si mostra e si esegue la copia,
# non il file del repository.
function Prepara-Correzione($cartellaSorgente) {
  $da = Join-Path $cartellaSorgente 'correzione-macchina.ps1'
  if (-not (Test-Path $da)) {
    throw "Manca nel sorgente: $da"
  }
  if (-not (Test-Path $cartellaStrumenti)) {
    New-Item -ItemType Directory -Force $cartellaStrumenti | Out-Null
  }
  Copy-Item -Path $da -Destination $fileCorrezione -Force
  return , @(Get-Content -Path $fileCorrezione -Encoding utf8)
}

function Esegui-Correzione {
  & $powershellExe -NoProfile -ExecutionPolicy Bypass -File $fileCorrezione
  $codice = $LASTEXITCODE
  Remove-Item $fileCorrezione -Force
  return $codice
}

# ---------------------------------------------------------------------------
# Menu
# ---------------------------------------------------------------------------

# Menu a frecce: su e giu' spostano la selezione, INVIO conferma, ESC sceglie l'ultima voce.
# Senza una console vera (input rediretto) ripiega su una scelta numerata.
function Scegli-Voce($voci, $iniziale) {
  if ([Console]::IsInputRedirected) {
    for ($i = 0; $i -lt $voci.Count; $i++) {
      Write-Host "  [$($i + 1)] $($voci[$i])"
    }
    $testo = Read-Host 'Scelta'
    $numero = 0
    if ([int]::TryParse($testo, [ref]$numero) -and ($numero -ge 1) -and ($numero -le $voci.Count)) {
      return $numero - 1
    }
    return $voci.Count - 1
  }

  Write-Host "Frecce su/giu' per scegliere, INVIO per confermare, ESC per uscire."
  $indice = $iniziale
  # Riserva le righe del menu, poi risale: cosi' lo scorrimento del buffer non sposta la cima.
  for ($i = 0; $i -lt $voci.Count; $i++) {
    Write-Host ''
  }
  $cima = [Console]::CursorTop - $voci.Count
  $larghezza = [Math]::Max(20, [Console]::WindowWidth - 1)
  try {
    [Console]::CursorVisible = $false
  }
  catch {
  }
  try {
    while ($true) {
      [Console]::SetCursorPosition(0, $cima)
      for ($i = 0; $i -lt $voci.Count; $i++) {
        if ($i -eq $indice) {
          Write-Host ("  > " + $voci[$i]).PadRight($larghezza) -ForegroundColor Black -BackgroundColor Gray
        }
        else {
          Write-Host ("    " + $voci[$i]).PadRight($larghezza)
        }
      }
      $tasto = [Console]::ReadKey($true)
      if ($tasto.Key -eq [ConsoleKey]::UpArrow) {
        $indice = ($indice - 1 + $voci.Count) % $voci.Count
      }
      elseif ($tasto.Key -eq [ConsoleKey]::DownArrow) {
        $indice = ($indice + 1) % $voci.Count
      }
      elseif ($tasto.Key -eq [ConsoleKey]::Enter) {
        return $indice
      }
      elseif ($tasto.Key -eq [ConsoleKey]::Escape) {
        return $voci.Count - 1
      }
    }
  }
  finally {
    try {
      [Console]::CursorVisible = $true
    }
    catch {
    }
  }
}

# Conferma esplicita: si parte da "Annulla", ed ESC annulla.
function Conferma($domanda) {
  Write-Host ''
  Write-Host $domanda -ForegroundColor Yellow
  return ((Scegli-Voce @('Conferma', 'Annulla') 1) -eq 0)
}

function Chiudi($codice) {
  Write-Host ''
  Write-Host 'Premi INVIO per chiudere.'
  Read-Host | Out-Null
  exit $codice
}

# Caricato con il punto dal banco: solo le funzioni, niente elevazione e niente menu.
if ($MyInvocation.InvocationName -eq '.') {
  return
}

# ---------------------------------------------------------------------------
# Ingresso
# ---------------------------------------------------------------------------

$principale = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principale.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Start-Process -FilePath $powershellExe -Verb RunAs -ArgumentList ('-NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"')
  exit
}

if (-not ($PSCommandPath -ieq $fileStrumento)) {
  if (Test-Path $fileStrumento) {
    Write-Host 'Lo strumento e'' gia'' installato. Questa e'' la copia del repository, che un agente puo'' modificare: non si usa come amministratore.' -ForegroundColor Red
    Write-Host 'Usa il task di VS Code "Daiku: gestisci guardie (amministratore)", che lancia la copia installata. Per portare li'' una modifica del repository, scegli "Aggiorna da repository".'
    Chiudi 1
  }
  Write-Host 'PRIMA INSTALLAZIONE' -ForegroundColor Cyan
  Write-Host "Sorgente:     $PSScriptRoot"
  Write-Host "Destinazione: $Radice"
  Write-Host 'Prima di confermare rileggi questi file nel repository: da ora uno gira come amministratore e uno come guardia di macchina.'
  $esito = Prepara-Arrivo $PSScriptRoot
  Mostra-Arrivo $esito | Out-Null
  if (Conferma 'Installare?') {
    Applica-Arrivo $esito $PSScriptRoot
    Write-Host ''
    Write-Host 'Installato. Da ora si usa il task di VS Code "Daiku: gestisci guardie (amministratore)".' -ForegroundColor Green
    Write-Host 'Riavvia le sessioni di Claude Code: gli hook si leggono all''avvio.'
  }
  else {
    Remove-Item $cartellaArrivo -Recurse -Force
    Write-Host 'Annullato: niente installato.' -ForegroundColor Yellow
  }
  Chiudi 0
}

$voci = @('Tutto spento', 'Tutto acceso', 'Aggiorna da repository', 'Esegui correzione dal repository', 'Esci')
while ($true) {
  $stato = Mostra-Stato
  Write-Host ''
  # Parte dalla voce che cambia qualcosa: acceso -> spegni, altrimenti accendi.
  $iniziale = 1
  if ($stato -eq $true) {
    $iniziale = 0
  }
  $scelta = Scegli-Voce $voci $iniziale
  Write-Host ''
  if ($scelta -eq 0) {
    Tutto-Spento
    Write-Host 'Tutto SPENTO. Copie di sicurezza accanto ai file. Riavvia le sessioni di Claude Code.' -ForegroundColor Green
  }
  elseif ($scelta -eq 1) {
    Tutto-Acceso
    Write-Host 'Tutto ACCESO. Copie di sicurezza accanto ai file. Riavvia le sessioni di Claude Code.' -ForegroundColor Red
  }
  elseif ($scelta -eq 2) {
    $sorgente = Leggi-Sorgente
    if ($null -eq $sorgente) {
      Write-Host "Sorgente sconosciuto: manca $fileSorgente." -ForegroundColor Yellow
      continue
    }
    Write-Host "Sorgente: $sorgente"
    $esito = Prepara-Arrivo $sorgente
    if ((Mostra-Arrivo $esito) -eq 0) {
      Remove-Item $cartellaArrivo -Recurse -Force
      Write-Host ''
      Write-Host 'Niente da aggiornare.' -ForegroundColor Green
      continue
    }
    if (Conferma 'Installare queste modifiche?') {
      Applica-Arrivo $esito $sorgente
      Write-Host ''
      Write-Host 'Aggiornato. Rilancia il task per usare la versione nuova, e riavvia le sessioni di Claude Code.' -ForegroundColor Green
      Chiudi 0
    }
    Remove-Item $cartellaArrivo -Recurse -Force
    Write-Host 'Annullato: niente installato.' -ForegroundColor Yellow
  }
  elseif ($scelta -eq 3) {
    $sorgente = Leggi-Sorgente
    if ($null -eq $sorgente) {
      Write-Host "Sorgente sconosciuto: manca $fileSorgente." -ForegroundColor Yellow
      continue
    }
    $righe = Prepara-Correzione $sorgente
    Write-Host "Correzione proposta ($sorgente\correzione-macchina.ps1), per intero:" -ForegroundColor Cyan
    for ($i = 0; $i -lt $righe.Count; $i++) {
      Write-Host ('{0,5}  {1}' -f ($i + 1), $righe[$i])
    }
    if (Conferma 'Eseguire questa correzione da amministratore?') {
      $codice = Esegui-Correzione
      Write-Host "Correzione terminata con uscita $codice." -ForegroundColor Cyan
    }
    else {
      Remove-Item $fileCorrezione -Force
      Write-Host 'Annullato: niente eseguito.' -ForegroundColor Yellow
    }
  }
  else {
    break
  }
}

Chiudi 0
