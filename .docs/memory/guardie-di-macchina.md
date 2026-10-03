---
name: guardie-di-macchina
description: "tutte le guardie di Claude Code vivono sotto Program Files e le gestisce solo lo strumento installato, dal task di VS Code; il repository tiene i sorgenti in .docs/tools/macchina/; le trappole di PowerShell 5.1 (BOM, ASCII, Add-Member)"
metadata:
  node_type: memory
  type: project
  originSessionId: ee20b3af-d265-472f-b977-e23331cb8231
  modified: 2026-09-29T17:00:53.378Z
---

**Tutte le guardie di Claude Code su questa macchina vivono in `C:\Program Files\ClaudeCode\`**,
dove scrivono solo gli amministratori: il recinto sulle letture (`recinto-letture.mjs`), il
presidio del target (`guardia-target.mjs` con la sua configurazione e l'interruttore `enabled` in
`guardia-target.json`), la lista `deny` di macchina e le radici di lavoro nei `managed-settings.json`.
Recinto e presidio sono registrati nel blocco `hooks` dei managed settings. In questo repository non
gira nessuna guardia **di macchina**, ma dal 30 settembre 2026 girano quelle **del pacchetto**: il
cantiere ha il suo `.daiku/project.json`, che accende il gate di Daiku — quindi il command-guard
nega qui `git push`, `--no-verify` e le firme dell'agente. Accanto sta `.claude/settings.json`, con la lista `permissions.deny` su
`git push`: è la porta che l'hook non chiude, perché una permission rule dell'host sta sopra ogni
altra regola e non la si aggira con un wrapper. Provata col dry-run, che è stato negato.

**Il repository tiene i sorgenti**, in `.docs/tools/macchina/` (README lì): il presidio, la sua
configurazione, lo strumento `gestisci-guardie.ps1`, la proposta `correzione-macchina.ps1` e i due
banchi. Il recinto non ha sorgente: si cambia solo con una correzione.

**Si gestiscono solo dallo strumento installato**, lanciato dal task di VS Code «Daiku: gestisci
guardie (amministratore)», che punta alla copia in Program Files: tutto spento, tutto acceso,
aggiorna da repository, esegui correzione dal repository. Aggiornamento e correzione copiano prima
il file sotto Program Files, mostrano il diff o il testo intero, e installano o eseguono **quella
copia** dopo la conferma dell'owner. Lanciato dal repository, lo strumento fa solo la prima
installazione; dopo rifiuta. Il task e non un collegamento nel menu Start è scelta dell'owner: il
rischio che un agente riscriva `tasks.json` è accettato dentro il modello di minaccia qui sotto.

**Why:** l'owner ha chiesto il 29 settembre 2026 che le guardie si possano spegnere solo da
amministratore. Un file che l'utente può scrivere, un agente lo può spegnere; e uno script che
l'utente lancia elevato, se sta nel repository, un agente lo può riscrivere e farsi eseguire come
amministratore. Il modello di minaccia scelto è **l'agente che sbaglia, non quello malevolo**:
l'account dell'owner è amministratore con UAC predefinito, che non è un confine di sicurezza, e
`node` sta in `C:\nvm4w\nodejs\`, scrivibile dall'utente.

**How to apply:**
- Una modifica a presidio o strumento si scrive nel sorgente, si lanciano i due banchi
  (`node .docs/tools/macchina/guardia-target.mjs --self-check` e
  `.docs/tools/macchina/prova-gestisci-guardie.ps1`), e poi l'owner la porta dentro con «Aggiorna
  da repository». Dire sempre all'owner che il passo è suo.
- Una correzione a managed settings o recinto si scrive nel blocco CORREZIONE di
  `correzione-macchina.ps1`, provata prima senza amministratore su una copia nello scratchpad
  rimappando `$cartella`; la esegue l'owner dallo strumento. Finita, il blocco torna vuoto.
- Un blocco del recinto o del presidio che sembra sbagliato non si aggira: si diagnostica e si
  propone la correzione.
- Il presidio salta l'**ambiente in testa** alla riga prima di decidere qual è il programma:
  `NODE_ENV=x npm ci` è `npm ci`, non `x`. Senza questo, un comando legittimo con una variabile in
  testa sarebbe letto come un programma che non esiste.
- Il recinto fa un'espansione testuale delle variabili: `$NOME` diventa la variabile d'ambiente
  omonima (`$_` escluso). Un falso positivo su un path che «non esiste» va cercato lì per primo.
  Scatta anche sulle **scritture**, e legge come path le opzioni `//FI` di `tasklist` e `//v` di
  `reg query` in Git Bash.
- Una regola `Read(...)` nella `deny` di macchina blocca anche le scritture. Con
  `allowManagedPermissionRulesOnly: true` Claude Code ignora ogni `allow`, `ask` o `deny` di utente
  e progetto: una lista di permessi in `.claude/settings.json` non serve.
- **Il recinto legge come path ogni token che comincia per `/`**, anche quando è il nome di un
  comando: `claude -p "/studia-repository …"` è negato con «Lettura fuori dal perimetro:
  `C:\studia-repository`». Non è un falso positivo da aggirare con un'altra forma della stessa
  riga: è il motivo per cui una skill che ne lancia un'altra headless lo fa da un processo, non da
  una riga di Bash — vedi [[lotto-di-studi]].

**Trappole di PowerShell 5.1** per chi tocca lo strumento o scrive una correzione:
- **Il BOM spegne un hook in silenzio.** `Set-Content -Encoding utf8` scrive il BOM, e un
  `JSON.parse` che non lo toglie tratta il file come assente. Si scrive con
  `[IO.File]::WriteAllText(..., New-Object System.Text.UTF8Encoding($false))`.
- **Nei `.ps1` solo ASCII**: PowerShell 5.1 legge come ANSI un `.ps1` UTF-8 senza BOM. Il banco
  dello strumento lo controlla.
- **`Add-Member -Force` su una proprietà esistente la sposta in fondo**: ogni scrittura
  riordinerebbe le chiavi del JSON. Si cambia il valore sul posto.
- **Una virgola dentro gli argomenti di un metodo divide gli argomenti**, anche dentro un indice:
  `[Math]::Max($t[$i, $j], ...)` non si analizza. L'indice va in una variabile.
- **`return , $array` più `@()` di chi chiama annida l'array.** Si emette l'array normalmente.

Vedi anche [[guardrail-nascono-spenti]] per le guardie del *pacchetto* Daiku, che sono un'altra
cosa.
