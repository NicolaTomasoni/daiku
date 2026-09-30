<# Riversa il prodotto nel repository di distribuzione.

Copia il contenuto di plugins/ (e nient'altro) nella radice del checkout
di distribuzione, dopo aver svuotato la destinazione (tranne .git).
Poi committa. Il filtro "cosa esce" sta tutto qui: mai "tutto
il repository tranne".

Uso: .\pubblica-dist.ps1 -Messaggio "aggiorna dist" [-Destinazione ...]
Lo chiama il comando /rilascia-daiku (.claude/commands/rilascia-daiku.md), passo 6, dopo il
commit in dev del passo 5: la copia porta plugins/ com'è, quindi dev deve essere già committato.

Non pusha mai. Il push e' un gesto manuale dell'owner, e questo script non lo fa al posto suo:
committa nel dist e si ferma, lasciando il push a chi lo decide.
#>
param(
  [string]$Messaggio = "",
  [string]$Destinazione = "C:\dev\daiku-workspace\daiku"
)

$ErrorActionPreference = 'Stop'

$Sviluppo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$Sorgente = Join-Path $Sviluppo 'plugins'

if (-not (Test-Path $Sorgente)) { throw "Sorgente assente: $Sorgente" }
if (-not (Test-Path (Join-Path $Destinazione '.git'))) { throw "Destinazione non e' un checkout git: $Destinazione" }

# Gate: perdite di questa macchina o del cantiere non escono mai.
# (I percorsi finti dei banchi di prova, tipo c:/dev/project, sono legittimi
# e restano: il controllo largo manuale e' grep -rin "reforgia|<username>|c:/dev/".)
$Residui = Get-ChildItem -Path (Join-Path $Sorgente 'daiku') -Recurse -File |
  Select-String -Pattern 'reforgia|daiku-kaji-dev|<username>|Users[/\\]tomas|daiku-dist|[Cc]:[/\\]dev[/\\][Dd]aiku(?![-_/a-zA-Z])' 2>$null
if ($Residui) {
  Write-Host 'Gate fallito: residui in plugins/daiku (voce = file:riga):'
  $Residui | ForEach-Object { Write-Host ("  {0}:{1}" -f $_.Path, $_.LineNumber) }
  exit 1
}

Get-ChildItem -Force $Destinazione -Exclude '.git' | Remove-Item -Recurse -Force
Copy-Item (Join-Path $Sorgente '*') $Destinazione -Recurse -Force

$Stato = git -C $Destinazione status --porcelain
if (-not $Stato) { Write-Host 'Dist aggiornata: niente da pubblicare.'; exit 0 }

if (-not $Messaggio) { $Messaggio = "aggiorna dist da plugins/ ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))" }
git -C $Destinazione add -A
git -C $Destinazione commit -m $Messaggio --quiet
Write-Host "Dist aggiornata: $Messaggio"
Write-Host "Non pushato: il push sul dist resta all'owner."
