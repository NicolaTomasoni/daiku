<#
  new-project.ps1
  Crea un progetto nuovo e lo pubblica su GitLab, in un colpo solo.

  Cosa fa, in ordine:
    1. chiede il nome del progetto (o lo prende dal parametro -Name)
    2. controlla che la cartella non esista gia'
    3. si assicura che glab ci sia e che l'utente sia autenticato;
       se non lo e', apre il browser e fa fare login
    4. crea la cartella sotto C:\dev, ci scrive un README col solo nome del progetto
    5. git init + primo commit
    6. crea il progetto su GitLab e lo collega come origin
    7. pusha

  Due cose imparate sul campo, che qui sono risolte e non vanno disfatte:

  - Il PATH viene rinfrescato a inizio script se glab non si trova. Subito dopo
    un'installazione, la sessione in corso (VS Code compreso) ha ancora il PATH
    vecchio e glab risulta "non installato" pur essendolo.
  - Il remote viene forzato a HTTPS e l'helper credential locale viene puntato a
    `glab auth git-credential`. Git Credential Manager non ha credenziali per
    gitlab.com, quindi un push HTTPS chiederebbe username e password; glab invece
    il token ce l'ha, nel keyring di sistema. L'helper e' configurato a livello
    LOCALE del repo nuovo, non globale: non tocca la config git della macchina.

  Uso:
    powershell -ExecutionPolicy Bypass -File new-project.ps1
    powershell -ExecutionPolicy Bypass -File new-project.ps1 -Name mio-progetto
    powershell -ExecutionPolicy Bypass -File new-project.ps1 -Name mio-progetto -Public
#>
param(
  [string]$Name,
  [string]$DevRoot = 'C:\dev',
  [string]$Hostname = 'gitlab.com',
  [switch]$Public
)

# Niente $ErrorActionPreference = 'Stop': su PowerShell 5.1 un eseguibile nativo che
# scrive su stderr viene trasformato in un errore terminante, e glab scrive su stderr
# anche quando tutto va bene. Il giudizio sta su $LASTEXITCODE, controllato a ogni passo.
$ErrorActionPreference = 'Continue'

function Write-Step([string]$text) {
  Write-Host ''
  Write-Host "== $text" -ForegroundColor Cyan
}

function Fail([string]$text) {
  Write-Host ''
  Write-Host "STOP: $text" -ForegroundColor Red
  exit 1
}

# ---------------------------------------------------------------------------
# 0. glab deve esserci e deve essere raggiungibile
# ---------------------------------------------------------------------------

if (-not (Get-Command glab -ErrorAction SilentlyContinue)) {
  # Ricarica il PATH dalle variabili di macchina e utente: capita subito dopo
  # un'installazione fatta mentre la sessione era gia' aperta.
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
              [Environment]::GetEnvironmentVariable('Path', 'User')
}

if (-not (Get-Command glab -ErrorAction SilentlyContinue)) {
  Fail @'
glab (GitLab CLI) non e' installato. Si installa cosi':

    winget install --id GLab.GLab --accept-source-agreements --accept-package-agreements

Poi riapri il terminale e rilancia questo script.
'@
}

# ---------------------------------------------------------------------------
# 1. Il nome del progetto
# ---------------------------------------------------------------------------

while ([string]::IsNullOrWhiteSpace($Name)) {
  $Name = Read-Host 'Nome del progetto'
}

$Name = $Name.Trim()

if ($Name -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*$') {
  Fail "Nome non valido: '$Name'. Ammessi lettere, cifre, punto, trattino e underscore; deve iniziare con lettera o cifra."
}

$projectPath = Join-Path $DevRoot $Name

if (Test-Path $projectPath) {
  Fail "La cartella esiste gia': $projectPath`nNon la tocco. Scegli un altro nome o sposta quella."
}

if (-not (Test-Path $DevRoot)) {
  Fail "La cartella radice non esiste: $DevRoot"
}

# ---------------------------------------------------------------------------
# 2. Login su GitLab, se serve
# ---------------------------------------------------------------------------

Write-Step "Verifico l'accesso a $Hostname"

glab auth status --hostname $Hostname

if ($LASTEXITCODE -ne 0) {
  Write-Host "Non sei autenticato su $Hostname. Apro il browser: autorizza e torna qui." -ForegroundColor Yellow
  glab auth login --hostname $Hostname --web
  if ($LASTEXITCODE -ne 0) { Fail "Login non riuscito." }

  glab auth status --hostname $Hostname
  if ($LASTEXITCODE -ne 0) { Fail "Login non riuscito: risulti ancora non autenticato." }
}

# ---------------------------------------------------------------------------
# 3. Cartella e README
# ---------------------------------------------------------------------------

Write-Step "Creo $projectPath"

New-Item -ItemType Directory -Path $projectPath -Force | Out-Null

$readmePath = Join-Path $projectPath 'README.md'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($readmePath, "# $Name`n", $utf8NoBom)

Write-Host "README.md scritto."

# ---------------------------------------------------------------------------
# 4. Repository locale e primo commit
# ---------------------------------------------------------------------------

Write-Step 'Inizializzo il repository'

Push-Location $projectPath
try {
  git init -b main
  if ($LASTEXITCODE -ne 0) { Fail 'git init non riuscito.' }

  git add -A
  if ($LASTEXITCODE -ne 0) { Fail 'git add non riuscito.' }

  git commit -q -m 'chore: inizializza il progetto'
  if ($LASTEXITCODE -ne 0) { Fail 'git commit non riuscito.' }

  # -------------------------------------------------------------------------
  # 5. Progetto su GitLab + origin
  # -------------------------------------------------------------------------

  Write-Step "Creo il progetto su $Hostname"

  $visibility = if ($Public) { '--public' } else { '--private' }
  glab repo create $Name $visibility --name $Name
  if ($LASTEXITCODE -ne 0) {
    Fail "Creazione del progetto su $Hostname non riuscita. Se il nome e' gia' occupato, scegline un altro."
  }

  # glab puo' lasciare il remote in SSH, a seconda di come e' configurato. Qui si
  # pusha in HTTPS con il token di glab, quindi il remote va normalizzato.
  $remoteUrl = git remote get-url origin
  if ($LASTEXITCODE -ne 0) { Fail 'origin non configurato da glab.' }

  if ($remoteUrl -like "git@${Hostname}:*") {
    $httpsUrl = "https://$Hostname/" + ($remoteUrl -replace "^git@$([regex]::Escape($Hostname)):", '')
    git remote set-url origin $httpsUrl
    if ($LASTEXITCODE -ne 0) { Fail 'Impossibile convertire origin in HTTPS.' }
    Write-Host "origin convertito in HTTPS: $httpsUrl"
  }

  # Il token di glab, per questo repo soltanto (config locale).
  git config --local "credential.https://$Hostname.helper" '!glab auth git-credential'
  if ($LASTEXITCODE -ne 0) { Fail 'Impossibile configurare il credential helper.' }

  # -------------------------------------------------------------------------
  # 6. Push
  # -------------------------------------------------------------------------

  Write-Step 'Pusho'

  git push -u origin main
  if ($LASTEXITCODE -ne 0) { Fail 'Push non riuscito.' }

  $url = git remote get-url origin
  Write-Host ''
  Write-Host "Fatto: $Name" -ForegroundColor Green
  Write-Host "  locale:  $projectPath"
  Write-Host "  remoto:  $url"
}
finally {
  Pop-Location
}
