#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Applica a mano, fuori dalla sessione agente, cio' che il presidio non lascia fare a un agente.

.DESCRIPTION
  1. Installa il guardiano corretto del presidio (.claude/hooks/guardia-target.mjs) dalla copia
     in .docs/nuovi-sviluppi/repo-intelligence/allegati/, e lo verifica col suo banco: se il banco
     non e' verde, rimette l'originale.
  2. Toglie da .claude/settings.json la chiave spuria `_perche_il_deny` (Difetti aperti, punto 2,
     di .claude/hooks/README.md).
  3. Punta `autoMemoryDirectory` di .claude/settings.local.json su <repo>\.docs\memory.
  4. Trova il hook del perimetro nei managed settings e ne stampa la posizione. Non lo modifica:
     il suo codice non e' mai stato letto, e una correzione scritta alla cieca non si applica.

  Ogni file toccato viene prima copiato in una cartella di backup sotto %TEMP%, stampata alla fine.
  Con -DryRun dice cosa farebbe senza scrivere niente.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File C:\dev\Daiku\.docs\scripts\applica-presidi.ps1
#>
param(
  [string]$Repo = 'C:\dev\Daiku',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Passo([string]$t) { Write-Host "`n== $t" -ForegroundColor Cyan }
function Ok([string]$t) { Write-Host "   ok    $t" -ForegroundColor Green }
function Info([string]$t) { Write-Host "   --    $t" }
function Rosso([string]$t) { Write-Host "   ROSSO $t" -ForegroundColor Red }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'node non trovato nel PATH: serve per il banco e per scrivere i JSON.' }
if (-not (Test-Path (Join-Path $Repo 'CLAUDE.md'))) { throw "Non sembra la radice del repository: $Repo" }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $env:TEMP "daiku-presidi-$stamp"
if (-not $DryRun) { New-Item -ItemType Directory -Path $backup | Out-Null }
$esiti = @()

function Salva([string]$path) {
  if ($DryRun -or -not (Test-Path $path)) { return }
  Copy-Item $path (Join-Path $backup (Split-Path $path -Leaf)) -Force
}

# Un editor JSON minimo in Node: toglie una chiave o ne fissa il valore, senza toccare il resto.
$editor = Join-Path $env:TEMP "daiku-json-edit-$stamp.mjs"
$js = @'
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
// Il flag viene per secondo: PowerShell 5.1 scarta un argomento vuoto passato a un eseguibile
// nativo, e tutto cio' che lo segue scivolerebbe di un posto.
const [file, dry, op, key, value] = process.argv.slice(2);
const text = existsSync(file) ? readFileSync(file, 'utf8').replace(/^\uFEFF/, '') : '{}';
const obj = JSON.parse(text);
if (op === 'del') {
  if (!(key in obj)) { console.log('assente, niente da fare'); process.exit(0); }
  delete obj[key];
} else {
  if (obj[key] === value) { console.log(`gia' a posto: ${value}`); process.exit(0); }
  obj[key] = value;
}
if (dry === '1') { console.log('da scrivere (dry-run)'); process.exit(0); }
writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
console.log('scritto');
'@
[IO.File]::WriteAllText($editor, $js, (New-Object Text.UTF8Encoding($false)))
$dryFlag = if ($DryRun) { '1' } else { '0' }

# --- 1. il guardiano corretto -----------------------------------------------------------------
Passo '1. Guardiano del presidio'
$src = Join-Path $Repo '.docs\nuovi-sviluppi\repo-intelligence\allegati\guardia-target-corretto.mjs'
$dst = Join-Path $Repo '.claude\hooks\guardia-target.mjs'
if (-not (Test-Path $src)) {
  Rosso "manca la copia corretta: $src"; $esiti += 'guardiano: ROSSO (copia mancante)'
} elseif ((Test-Path $dst) -and ((Get-FileHash $src).Hash -eq (Get-FileHash $dst).Hash)) {
  Ok 'gia'' installato'; $esiti += 'guardiano: gia'' a posto'
} elseif ($DryRun) {
  Info "copierei $src -> $dst e lancerei il banco"; $esiti += 'guardiano: da installare'
} else {
  Salva $dst
  Copy-Item $src $dst -Force
  $out = & node $dst --self-check 2>&1 | Out-String
  if ($LASTEXITCODE -eq 0) {
    Ok ("installato; banco: " + (($out -replace '\s+', ' ').Trim()))
    $esiti += 'guardiano: installato, banco verde'
  } else {
    Copy-Item (Join-Path $backup 'guardia-target.mjs') $dst -Force
    Rosso "banco rosso, rimesso l'originale:`n$out"
    $esiti += 'guardiano: ROSSO, originale ripristinato'
  }
}

# --- 2. la chiave spuria in settings.json -----------------------------------------------------
Passo '2. settings.json: chiave _perche_il_deny'
$settings = Join-Path $Repo '.claude\settings.json'
Salva $settings
$r = & node $editor $settings $dryFlag del '_perche_il_deny'
if ($LASTEXITCODE -ne 0) { Rosso $r; $esiti += 'settings.json: ROSSO' } else { Ok $r; $esiti += "settings.json: $r" }

# --- 3. autoMemoryDirectory -------------------------------------------------------------------
Passo '3. settings.local.json: autoMemoryDirectory'
$local = Join-Path $Repo '.claude\settings.local.json'
$memoria = Join-Path $Repo '.docs\memory'
if (-not (Test-Path (Join-Path $memoria 'MEMORY.md'))) {
  Rosso "in $memoria non c'e' MEMORY.md: non punto la memoria su una cartella vuota"
  $esiti += 'autoMemoryDirectory: ROSSO (cartella senza MEMORY.md)'
} else {
  Salva $local
  $r = & node $editor $local $dryFlag set 'autoMemoryDirectory' $memoria
  if ($LASTEXITCODE -ne 0) { Rosso $r; $esiti += 'autoMemoryDirectory: ROSSO' } else { Ok $r; $esiti += "autoMemoryDirectory: $r" }
}

# --- 4. il hook del perimetro nei managed settings: solo dove sta ------------------------------
Passo '4. Hook del perimetro (managed settings) - sola localizzazione'
$candidati = @(
  (Join-Path $env:ProgramFiles 'ClaudeCode\managed-settings.json'),
  (Join-Path $env:ProgramData 'ClaudeCode\managed-settings.json')
)
$trovato = $false
foreach ($m in $candidati) {
  if (-not (Test-Path $m)) { continue }
  $trovato = $true
  Info "managed settings: $m"
  $righe = Select-String -Path $m -Pattern '"command"\s*:' | ForEach-Object { $_.Line.Trim() }
  foreach ($l in $righe) { Info "hook: $l" }
}
$drop = Join-Path (Split-Path $candidati[0]) 'managed-settings.d'
if (Test-Path $drop) { Get-ChildItem $drop -Filter *.json | ForEach-Object { Info "drop-in: $($_.FullName)" } }
if ($trovato) {
  $esiti += 'hook del perimetro: localizzato, NON modificato'
} else {
  Rosso 'nessun managed-settings.json nei due percorsi noti'
  $esiti += 'hook del perimetro: non trovato'
}

Remove-Item $editor -Force -ErrorAction SilentlyContinue

Passo 'Esito'
$esiti | ForEach-Object { Write-Host "   $_" }
if (-not $DryRun) { Write-Host "`n   backup dei file toccati: $backup" }
Write-Host "`n   Riavvia la sessione di Claude Code: settings e memoria si leggono all'avvio."
