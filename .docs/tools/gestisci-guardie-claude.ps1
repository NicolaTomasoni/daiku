# Accende o spegne tutte le guardie di Claude Code in questo cantiere.
#
# Le guardie sono tre: l'interruttore in .claude/guardia-target.json (blocca
# esecuzione del target e installazioni), il guardiano (il blocco hooks in
# .claude/settings.json, che fa girare i controlli e protegge i suoi file)
# e la lista deny in .claude/settings.json (i comandi che Claude Code nega
# sempre, anche in bypass). "Tutto spento" le toglie tutte e tre, "tutto
# acceso" le rimette tutte e tre. Ogni scrittura fa prima una copia di
# sicurezza accanto al file, cosi' si torna sempre indietro.
#
# Esecuzione: tasto destro sul file > "Esegui con PowerShell" da amministratore,
# oppure da un prompt elevato:
#   powershell -ExecutionPolicy Bypass -File .docs\tools\gestisci-guardie-claude.ps1
#
# Se lo avvii senza elevazione, si rilancia da solo come amministratore e
# la finestra non elevata si chiude.

# Se non siamo amministratori, ci rilanciamo elevati e usciamo.
$principale = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$amministratore = [Security.Principal.WindowsBuiltInRole]::Administrator
if (-not $principale.IsInRole($amministratore)) {
  $percorso = $PSCommandPath
  if ([string]::IsNullOrEmpty($percorso)) {
    $percorso = $MyInvocation.MyCommand.Path
  }
  Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$percorso`""
  exit
}

$ErrorActionPreference = 'Stop'

# La radice del cantiere sta due livelli sopra la cartella dello script.
$radice = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$fileInterruttore = Join-Path $radice '.claude\guardia-target.json'
$fileImpostazioni = Join-Path $radice '.claude\settings.json'

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

function Copia-Sicurezza($percorso) {
  $marca = Get-Date -Format 'yyyyMMdd-HHmmss'
  Copy-Item -Path $percorso -Destination "$percorso.bak-$marca" -Force
}

function Salva-Json($percorso, $oggetto) {
  $testo = $oggetto | ConvertTo-Json -Depth 10
  Set-Content -Path $percorso -Value $testo -Encoding utf8
}

# Legge lo stato e lo stampa. Ritorna $true solo se e' tutto acceso,
# $false solo se e' tutto spento, $null se e' misto.
function Mostra-Stato {
  $config = Leggi-Json $fileInterruttore
  $impostazioni = Leggi-Json $fileImpostazioni

  $bloccate = $false
  if ($null -ne $config) {
    if ($config.enabled -eq $true) {
      $bloccate = $true
    }
  }

  $gira = $false
  $negazioni = 0
  if ($null -ne $impostazioni) {
    if ($null -ne $impostazioni.hooks) {
      $gira = $true
    }
    if ($null -ne $impostazioni.permissions) {
      if ($null -ne $impostazioni.permissions.deny) {
        $negazioni = @($impostazioni.permissions.deny).Count
      }
    }
  }

  Write-Host ''
  Write-Host 'Stato attuale:'
  if ($bloccate) {
    Write-Host '- Esecuzione target e installazioni: BLOCCATE' -ForegroundColor Red
  }
  else {
    Write-Host '- Esecuzione target e installazioni: PERMESSE' -ForegroundColor Green
  }
  if ($gira) {
    Write-Host '- Guardiano (controlli e protezione dei suoi file): GIRA' -ForegroundColor Red
  }
  else {
    Write-Host '- Guardiano (controlli e protezione dei suoi file): STACCATO' -ForegroundColor Green
  }
  if ($negazioni -gt 0) {
    Write-Host "- Comandi sempre negati (lista deny): $negazioni regole" -ForegroundColor Red
  }
  else {
    Write-Host '- Comandi sempre negati (lista deny): NESSUNO' -ForegroundColor Green
  }

  if ($bloccate -and $gira -and ($negazioni -gt 0)) {
    Write-Host '=> TUTTO ACCESO' -ForegroundColor Red
    return $true
  }
  if ((-not $bloccate) -and (-not $gira) -and ($negazioni -eq 0)) {
    Write-Host '=> TUTTO SPENTO' -ForegroundColor Green
    return $false
  }
  Write-Host '=> MISTO (in parte acceso, in parte spento)' -ForegroundColor Yellow
  return $null
}

function Tutto-Spento {
  Copia-Sicurezza $fileInterruttore
  Copia-Sicurezza $fileImpostazioni

  $config = Leggi-Json $fileInterruttore
  if ($null -ne $config) {
    $config.enabled = $false
    Salva-Json $fileInterruttore $config
  }

  $impostazioni = Leggi-Json $fileImpostazioni
  if ($null -ne $impostazioni) {
    if ($null -ne $impostazioni.hooks) {
      $impostazioni.PSObject.Properties.Remove('hooks')
    }
    if ($null -ne $impostazioni.permissions) {
      if ($null -ne $impostazioni.permissions.deny) {
        $impostazioni.permissions.PSObject.Properties.Remove('deny')
      }
      if ($impostazioni.permissions.PSObject.Properties.Count -eq 0) {
        $impostazioni.PSObject.Properties.Remove('permissions')
      }
    }
    Salva-Json $fileImpostazioni $impostazioni
  }

  Write-Host 'Tutto SPENTO: nessuna guardia. Copie di sicurezza accanto ai file.' -ForegroundColor Green
}

function Tutto-Acceso {
  Copia-Sicurezza $fileInterruttore
  Copia-Sicurezza $fileImpostazioni

  $config = Leggi-Json $fileInterruttore
  if ($null -ne $config) {
    $config.enabled = $true
    Salva-Json $fileInterruttore $config
  }

  $impostazioni = Leggi-Json $fileImpostazioni
  if ($null -eq $impostazioni) {
    Write-Host 'settings.json non trovato, accendo solo l''interruttore.' -ForegroundColor Yellow
    return
  }

  # Cerca nelle copie di sicurezza i pezzi mancanti, dalla piu' recente.
  $copie = Get-ChildItem -Path (Join-Path $radice '.claude') -Filter 'settings.json.bak-*' | Sort-Object Name -Descending
  $hooksTrovati = $null
  $denyTrovato = $null
  foreach ($copia in $copie) {
    $vecchio = Leggi-Json $copia.FullName
    if ($null -eq $vecchio) {
      continue
    }
    if (($null -eq $hooksTrovati) -and ($null -ne $vecchio.hooks)) {
      $hooksTrovati = $vecchio.hooks
    }
    if (($null -eq $denyTrovato) -and ($null -ne $vecchio.permissions)) {
      if ($null -ne $vecchio.permissions.deny) {
        if (@($vecchio.permissions.deny).Count -gt 0) {
          $denyTrovato = $vecchio.permissions.deny
        }
      }
    }
  }

  if ($null -eq $impostazioni.hooks) {
    if ($null -eq $hooksTrovati) {
      Write-Host 'Guardiano non riattaccato: nessuna copia ce l''ha, rimettilo a mano.' -ForegroundColor Yellow
    }
    else {
      $impostazioni | Add-Member -NotePropertyName 'hooks' -NotePropertyValue $hooksTrovati -Force
    }
  }

  $denyQuante = 0
  if ($null -ne $impostazioni.permissions) {
    if ($null -ne $impostazioni.permissions.deny) {
      $denyQuante = @($impostazioni.permissions.deny).Count
    }
  }
  if ($denyQuante -eq 0) {
    if ($null -eq $denyTrovato) {
      Write-Host 'Lista deny non ripristinata: nessuna copia ce l''ha, rimettila a mano.' -ForegroundColor Yellow
    }
    else {
      if ($null -eq $impostazioni.permissions) {
        $impostazioni | Add-Member -NotePropertyName 'permissions' -NotePropertyValue (New-Object PSObject) -Force
      }
      $impostazioni.permissions | Add-Member -NotePropertyName 'deny' -NotePropertyValue $denyTrovato -Force
    }
  }

  Salva-Json $fileImpostazioni $impostazioni
  Write-Host 'Tutto ACCESO: tutte le guardie. Copie di sicurezza accanto ai file.' -ForegroundColor Red
}

while ($true) {
  Mostra-Stato | Out-Null
  Write-Host ''
  Write-Host '  [1] Tutto spento'
  Write-Host '  [2] Tutto acceso'
  Write-Host '  [0] Esci'
  $scelta = Read-Host 'Scelta'
  if ($scelta -eq '0') {
    break
  }
  if ($scelta -eq '1') {
    Tutto-Spento
  }
  elseif ($scelta -eq '2') {
    Tutto-Acceso
  }
  else {
    Write-Host 'Scelta non valida: premi 1, 2 o 0.' -ForegroundColor Yellow
  }
}

Write-Host 'Fatto. Premi INVIO per chiudere.'
Read-Host | Out-Null
