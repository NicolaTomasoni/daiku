# Banco di gestisci-guardie.ps1: lo carica con il punto, con -Radice rimappato su una cartella
# temporanea, e ne prova le funzioni senza amministratore. Il sorgente che installa e'
# una copia di questa cartella, cosi' il banco puo' modificarlo senza toccare il repository.
# Stampa il totale contato ed esce 1 se c'e' anche un solo caso rosso.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File .docs\tools\macchina\prova-gestisci-guardie.ps1

$ErrorActionPreference = 'Stop'
$qui = $PSScriptRoot
$base = Join-Path ([IO.Path]::GetTempPath()) ('prova-guardie-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
$utf8 = New-Object System.Text.UTF8Encoding($false)

$script:casi = 0
$script:rossi = @()
function Controlla($nome, $condizione) {
  $script:casi++
  if (-not $condizione) {
    $script:rossi += $nome
    Write-Output "ROSSO $nome"
  }
}

function Scrivi-Managed($percorso, $conHooks, $conDeny) {
  $permessi = [ordered]@{ defaultMode = 'bypassPermissions'; additionalDirectories = @('C:\dev', 'C:\Users\tomas\.claude') }
  if ($conDeny) {
    $permessi.deny = @('Read(~/Desktop/**)', 'Bash(git push:*)')
  }
  $permessi.allow = @('Bash(*)')
  $m = [ordered]@{ allowManagedPermissionRulesOnly = $true; permissions = $permessi }
  if ($conHooks) {
    $m.hooks = @{ PreToolUse = @(@{ matcher = 'Bash|PowerShell|Read'; hooks = @(@{ type = 'command'; command = 'node "C:\Program Files\ClaudeCode\recinto-letture.mjs"'; timeout = 10 }) }) }
  }
  $testo = ($m | ConvertTo-Json -Depth 20)
  # Con il BOM, come puo' capitare a un file scritto a mano da PowerShell 5.1.
  [IO.File]::WriteAllBytes($percorso, [byte[]](0xEF, 0xBB, 0xBF) + $utf8.GetBytes($testo))
}

function Comandi($percorso) {
  $m = Get-Content $percorso -Raw -Encoding utf8 | ConvertFrom-Json
  return @(Comandi-Hooks $m.hooks)
}

try {
  $pf = Join-Path $base 'pf'
  $src = Join-Path $base 'sorgente'
  New-Item -ItemType Directory -Force $pf, $src | Out-Null
  Copy-Item (Join-Path $qui '*') $src
  $mf = Join-Path $pf 'managed-settings.json'
  Scrivi-Managed $mf $true $true

  . (Join-Path $qui 'gestisci-guardie.ps1') -Radice $pf

  # --- Righe-Diff
  Controlla 'diff: identici, nessuna riga' ((@(Righe-Diff @('a', 'b') @('a', 'b'))).Count -eq 0)
  $d = @(Righe-Diff @('a', 'b', 'c') @('a', 'x', 'c'))
  Controlla 'diff: una riga cambiata' (($d.Count -eq 2) -and ($d[0] -match '^\s+2 - b$') -and ($d[1] -match '^\s+2 \+ x$'))
  Controlla 'diff: da vuoto, tutto aggiunto' ((@(Righe-Diff @() @('a', 'b'))).Count -eq 2)
  $d = @(Righe-Diff @('a', 'b', 'c', 'd') @('a', 'c', 'd', 'e'))
  Controlla 'diff: tolta in mezzo, aggiunta in coda' (($d.Count -eq 2) -and ($d[0] -match ' - b$') -and ($d[1] -match ' \+ e$'))

  # --- prima installazione, a guardie accese
  $s = Leggi-Stato
  Controlla 'prima: presidio non installato' (-not $s.Installato)
  $esito = Prepara-Arrivo $src
  Controlla 'prima: tre file nuovi' (((Mostra-Arrivo $esito 6>$null)) -eq 3)
  Applica-Arrivo $esito $src 6>$null
  Controlla 'installa: strumento in tools' (Test-Path (Join-Path $pf 'tools\gestisci-guardie.ps1'))
  Controlla 'installa: presidio e config' ((Test-Path (Join-Path $pf 'guardia-target.mjs')) -and (Test-Path (Join-Path $pf 'guardia-target.json')))
  Controlla 'installa: sorgente registrato' ((Get-Content (Join-Path $pf 'tools\sorgente.txt') -Raw) -eq $src)
  Controlla 'installa: in-arrivo tolto' (-not (Test-Path (Join-Path $pf 'tools\in-arrivo')))
  Controlla 'installa: nessun collegamento creato' (@(Get-ChildItem $base -Recurse -Filter '*.lnk').Count -eq 0)
  $cmd = Comandi $mf
  Controlla 'installa: recinto e presidio nei managed' (($cmd.Count -eq 2) -and ($cmd[0] -like '*recinto-letture.mjs*') -and ($cmd[1] -eq ('node "' + (Join-Path $pf 'guardia-target.mjs') + '"')))
  $m = Get-Content $mf -Raw -Encoding utf8 | ConvertFrom-Json
  Controlla 'installa: il resto dei managed intatto' (($m.allowManagedPermissionRulesOnly -eq $true) -and (@($m.permissions.additionalDirectories).Count -eq 2) -and (@($m.permissions.deny).Count -eq 2) -and ($m.permissions.defaultMode -eq 'bypassPermissions'))
  Controlla 'installa: managed senza BOM' ([IO.File]::ReadAllBytes($mf)[0] -ne 0xEF)
  Controlla 'installa: interruttore acceso dal sorgente' ((Get-Content (Join-Path $pf 'guardia-target.json') -Raw | ConvertFrom-Json).enabled -eq $true)
  Controlla 'stato: tutto acceso dopo l''installazione' ((Mostra-Stato 6>$null) -eq $true)

  # Il presidio installato passa il suo banco, sul config installato accanto a lui.
  $nodo = (Get-Command node -ErrorAction SilentlyContinue)
  if ($null -ne $nodo) {
    & $nodo.Source (Join-Path $pf 'guardia-target.mjs') --self-check | Out-Null
    Controlla 'presidio installato: banco verde' ($LASTEXITCODE -eq 0)
  }

  Registra-Guardiano
  Controlla 'registrazione idempotente' ((Comandi $mf).Count -eq 2)
  $esito = Prepara-Arrivo $src
  Controlla 'reinstallare senza modifiche: niente da aggiornare' (((Mostra-Arrivo $esito 6>$null)) -eq 0)
  Remove-Item (Join-Path $pf 'tools\in-arrivo') -Recurse -Force

  # --- tutto spento
  Tutto-Spento 6>$null
  $m = Get-Content $mf -Raw -Encoding utf8 | ConvertFrom-Json
  Controlla 'spento: niente hooks' ($null -eq $m.hooks)
  Controlla 'spento: niente deny di macchina' ($null -eq $m.permissions.deny)
  Controlla 'spento: interruttore spento' ((Get-Content (Join-Path $pf 'guardia-target.json') -Raw | ConvertFrom-Json).enabled -eq $false)
  $a = Get-Content (Join-Path $pf 'guardie-accese.json') -Raw | ConvertFrom-Json
  Controlla 'spento: guardie-accese ha recinto, presidio e deny' ((@(Comandi-Hooks $a.hooks).Count -eq 2) -and (@($a.deny).Count -eq 2))
  Controlla 'stato: tutto spento' ((Mostra-Stato 6>$null) -eq $false)
  $copie = @(Get-ChildItem $pf -Filter 'managed-settings.json.bak-*').Count
  Start-Sleep -Milliseconds 1100
  Tutto-Spento 6>$null
  Controlla 'secondo spento: nessuna scrittura' (@(Get-ChildItem $pf -Filter 'managed-settings.json.bak-*').Count -eq $copie)

  # --- aggiornare, a guardie spente: l'interruttore installato non cambia
  Add-Content -Path (Join-Path $src 'guardia-target.mjs') -Value '// prima modifica' -Encoding ascii
  $esito = Prepara-Arrivo $src
  Controlla 'aggiorna: un file cambia' (((Mostra-Arrivo $esito 6>$null)) -eq 1)
  $voce = $esito | Where-Object { $_.Nome -eq 'guardia-target.mjs' }
  Controlla 'aggiorna: una riga aggiunta' (($voce.Diff.Count -eq 1) -and ($voce.Diff[0] -match '\+ // prima modifica$'))
  $voce = $esito | Where-Object { $_.Nome -eq 'guardia-target.json' }
  Controlla 'aggiorna: config invariato anche con l''interruttore diverso' ($voce.Diff.Count -eq 0)
  # Il repository cambia fra la preparazione e l'installazione: entra la copia vista, non l'altra.
  Add-Content -Path (Join-Path $src 'guardia-target.mjs') -Value '// seconda modifica' -Encoding ascii
  Applica-Arrivo $esito $src 6>$null
  $installato = Get-Content (Join-Path $pf 'guardia-target.mjs') -Raw
  Controlla 'aggiorna: installa la copia mostrata' (($installato -match 'prima modifica') -and ($installato -notmatch 'seconda modifica'))
  Controlla 'aggiorna: interruttore resta spento' ((Get-Content (Join-Path $pf 'guardia-target.json') -Raw | ConvertFrom-Json).enabled -eq $false)
  Controlla 'aggiorna a guardie spente: managed restano spenti' ($null -eq (Get-Content $mf -Raw | ConvertFrom-Json).hooks)

  # --- tutto acceso
  Tutto-Acceso 6>$null
  $cmd = Comandi $mf
  Controlla 'acceso: recinto e presidio, una volta sola' (($cmd.Count -eq 2) -and (@($cmd | Where-Object { $_ -like '*guardia-target.mjs*' }).Count -eq 1))
  Controlla 'acceso: deny rimesso' (@((Get-Content $mf -Raw | ConvertFrom-Json).permissions.deny).Count -eq 2)
  Controlla 'stato: tutto acceso' ((Mostra-Stato 6>$null) -eq $true)
  $prima = Get-Content $mf -Raw
  Tutto-Acceso 6>$null
  Controlla 'secondo acceso: nessuna scrittura' ((Get-Content $mf -Raw) -eq $prima)

  # --- correzione: si esegue la copia, e senza amministratore la proposta rifiuta
  $righe = Prepara-Correzione $src
  Controlla 'correzione: copiata sotto tools' ((Test-Path (Join-Path $pf 'tools\correzione-in-esame.ps1')) -and ($righe.Count -eq @(Get-Content (Join-Path $src 'correzione-macchina.ps1')).Count))
  $codice = Esegui-Correzione 6>$null
  Controlla 'correzione: senza amministratore esce 1' ($codice -eq 1)
  Controlla 'correzione: la copia si toglie dopo' (-not (Test-Path (Join-Path $pf 'tools\correzione-in-esame.ps1')))

  # --- migrazione: guardie spente prima di guardie-accese.json, il recinto sta solo in una copia
  $pf2 = Join-Path $base 'pf2'
  New-Item -ItemType Directory -Force $pf2 | Out-Null
  $mf2 = Join-Path $pf2 'managed-settings.json'
  Scrivi-Managed (Join-Path $pf2 'managed-settings.json.bak-20260101-000000') $true $true
  Scrivi-Managed $mf2 $false $true
  . (Join-Path $qui 'gestisci-guardie.ps1') -Radice $pf2
  $esito = Prepara-Arrivo $src
  Applica-Arrivo $esito $src 6>$null
  Controlla 'migrazione: installare a guardie spente non accende' ($null -eq (Get-Content $mf2 -Raw | ConvertFrom-Json).hooks)
  Tutto-Acceso 6>$null
  $cmd = Comandi $mf2
  Controlla 'migrazione: acceso rimette recinto dalla copia e aggiunge il presidio' (($cmd.Count -eq 2) -and ($cmd[0] -like '*recinto-letture.mjs*') -and ($cmd[1] -like '*guardia-target.mjs*'))

  # --- i .ps1 di questa cartella sono solo ASCII (PowerShell 5.1 li legge come ANSI)
  foreach ($f in Get-ChildItem $qui -Filter '*.ps1') {
    $byte = [IO.File]::ReadAllBytes($f.FullName)
    Controlla "ascii: $($f.Name)" (@($byte | Where-Object { $_ -gt 127 }).Count -eq 0)
  }
}
finally {
  if (Test-Path $base) {
    Remove-Item $base -Recurse -Force
  }
}

$verdi = $script:casi - $script:rossi.Count
Write-Output ("{{`"checks`": {0}, `"passed`": {1}, `"failed`": {2}}}" -f $script:casi, $verdi, $script:rossi.Count)
if ($script:rossi.Count -gt 0) {
  exit 1
}
exit 0
