<# Porta la produzione (main) al rilascio di beta che hai testato.

Sposta il ramo locale main sul commit scelto di beta, dopo aver verificato che
la promozione sia un fast-forward: main non deve avere commit che beta non ha.
Il commit scelto si porta dietro tutte le patch che main non aveva ancora,
perche' la storia di beta e' lineare.

Non pusha mai: prepara main e si ferma, il push resta all'owner come ogni altro.

Uso:
  .\promuovi-dist.ps1                   # l'ultimo rilascio di beta, qualunque bump sia
  .\promuovi-dist.ps1 -Versione 1.0.9   # il commit 'release 1.0.9' di beta
  .\promuovi-dist.ps1 -Destinazione ... # checkout di dist (default: la macchina)

Chi decide quale bump promuove sta nel comando /rilascia-daiku: patch resta su
beta salvo ordine esplicito, minor e major promuovono da sole.
#>
param(
  [string]$Versione = "",
  [string]$Destinazione = "C:\dev\daiku-workspace\daiku"
)

$ErrorActionPreference = 'Stop'

# Un guasto si legge come una riga, non come una traccia di PowerShell.
function Fallisci($Messaggio) { Write-Host $Messaggio -ForegroundColor Red; exit 1 }

if (-not (Test-Path (Join-Path $Destinazione '.git'))) { Fallisci "Destinazione non e' un checkout git: $Destinazione" }

$Ramo = (git -C $Destinazione rev-parse --abbrev-ref HEAD).Trim()
if ($Ramo -ne 'beta') { Fallisci "Il checkout di dist sta su '$Ramo', non su 'beta': la promozione si fa dal canale beta." }

$Sporco = git -C $Destinazione status --porcelain
if ($Sporco) { Fallisci "Il dist ha modifiche non committate: committale o toglile prima di promuovere." }

git -C $Destinazione fetch origin --quiet

# Il commit da promuovere: uno nominato per versione, o l'ultimo rilascio di beta.
if ($Versione) {
  $Modello = '^release ' + $Versione.Replace('.', '\.') + '([[:space:]]|$)'
  $Commit = (git -C $Destinazione log --format=%H -n 1 -E --grep="$Modello" beta).Trim()
  if (-not $Commit) { Fallisci "Nessun commit 'release $Versione' su beta." }
} else {
  $Commit = (git -C $Destinazione rev-parse beta).Trim()
}

$Descrizione = (git -C $Destinazione log --format=%s -n 1 $Commit).Trim()

git -C $Destinazione merge-base --is-ancestor refs/remotes/origin/main $Commit 2>$null
if ($LASTEXITCODE -ne 0) {
  Fallisci "main ha commit che beta non ha: la promozione non e' un fast-forward. Allinea main prima di promuovere."
}

if ((git -C $Destinazione rev-parse refs/remotes/origin/main).Trim() -eq $Commit) {
  Write-Host "Produzione gia' a questo rilascio: niente da promuovere."
  exit 0
}

$MainLocale = (git -C $Destinazione rev-parse --verify --quiet refs/heads/main)
if ($MainLocale -and $MainLocale.Trim() -eq $Commit) {
  Write-Host "main locale era gia' a questo rilascio."
} else {
  git -C $Destinazione branch -f main $Commit
  Write-Host "Produzione preparata: main locale ora e' $Descrizione"
}

# Anche il push di beta deve essere un fast-forward: se la beta remota fosse
# avanti, il push verrebbe rifiutato e il messaggio lo direbbe solo allora.
$BetaRemota = (git -C $Destinazione rev-parse --verify --quiet refs/remotes/origin/beta)
if ($BetaRemota) {
  git -C $Destinazione merge-base --is-ancestor refs/remotes/origin/beta refs/heads/beta 2>$null
  if ($LASTEXITCODE -ne 0) { Fallisci "beta remota ha commit che questa beta non ha: allinea il checkout prima di promuovere." }
}

Write-Host "Non pushato."
