# Correzione di macchina: la proposta.
#
# Contenitore riusabile per le correzioni a cio' che vive sotto C:\Program Files\ClaudeCode\
# (managed settings, recinto sulle letture, presidio del target) o in altre cartelle di sistema.
# Qui si scrive la proposta; la esegue lo strumento installato, voce "Esegui correzione dal
# repository" del task di VS Code "Daiku: gestisci guardie (amministratore)": ne copia il testo
# sotto Program Files, lo mostra per intero e lo lancia da amministratore solo dopo la conferma
# dell'owner. Tra una correzione e l'altra il blocco CORREZIONE resta vuoto.
#
# Regole per chi ci scrive una correzione:
# - copia di sicurezza accanto al file prima di toccarlo;
# - se il testo atteso non c'e', non toccare niente e dillo;
# - se il file ha un banco di prova, lancialo dopo e, se non e' verde, rimetti la copia;
# - idempotente: un secondo giro non cambia niente;
# - provala prima senza amministratore su una copia nello scratchpad, rimappando $cartella;
# - solo ASCII: PowerShell 5.1 legge come ANSI un .ps1 UTF-8 senza BOM.

$principale = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principale.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host 'Questa proposta la lancia lo strumento installato: task di VS Code "Daiku: gestisci guardie (amministratore)", voce "Esegui correzione dal repository".' -ForegroundColor Yellow
  exit 1
}

$ErrorActionPreference = 'Stop'

$cartella = 'C:\Program Files\ClaudeCode'

# --- CORREZIONE ---------------------------------------------------------------

# Toglie il collegamento "Claude - gestisci guardie" dal menu Start di sistema: lo strumento si
# lancia dal task di VS Code. La copia di sicurezza va sotto Program Files, non nel menu Start,
# dove comparirebbe come voce.
$collegamento = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Claude - gestisci guardie.lnk'
if (Test-Path $collegamento) {
  $marca = Get-Date -Format 'yyyyMMdd-HHmmss'
  Copy-Item -Path $collegamento -Destination (Join-Path $cartella "Claude - gestisci guardie.lnk.bak-$marca") -Force
  Remove-Item -Path $collegamento -Force
  Write-Host "Tolto: $collegamento" -ForegroundColor Green
}
else {
  Write-Host "Niente da togliere: $collegamento non c'e'." -ForegroundColor Yellow
}
exit 0

# --- FINE CORREZIONE ----------------------------------------------------------
