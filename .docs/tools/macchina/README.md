# Le guardie di macchina

Sorgenti delle guardie di Claude Code su questa macchina. Non fanno parte di Daiku e non vengono
pubblicate: lo script di pubblicazione copia il solo contenuto di `plugins/`.

**Qui c'è il sorgente, non ciò che gira.** Ciò che gira sta in `C:\Program Files\ClaudeCode\`, dove
scrivono solo gli amministratori: un agente non può spegnerlo, riscriverlo né cambiarne la
configurazione, perché glielo impedisce Windows e non un controllo sul testo dei comandi. Da qui a
lì si passa solo dallo strumento installato, che mostra il diff e aspetta la conferma dell'owner.

## Cosa gira, e dove

| In `C:\Program Files\ClaudeCode\` | Cosa fa | Sorgente |
|---|---|---|
| `managed-settings.json` | radici di lavoro, lista `deny` di macchina, il blocco `hooks` che registra recinto e presidio | nessuno: lo cambiano lo strumento e le correzioni |
| `recinto-letture.mjs` | il recinto sulle letture: nega letture e scritture fuori dalle radici di lavoro | nessuno: si cambia con una correzione |
| `guardia-target.mjs` | il presidio del target | `guardia-target.mjs` |
| `guardia-target.json` | la configurazione del presidio e il suo interruttore `enabled` | `guardia-target.json` |
| `guardie-accese.json` | ciò che "tutto spento" ha tolto dai managed settings, pronto per "tutto acceso" | nessuno: lo scrive lo strumento |
| `tools\gestisci-guardie.ps1` | lo strumento da amministratore | `gestisci-guardie.ps1` |
| `tools\sorgente.txt` | la cartella da cui lo strumento prende gli aggiornamenti: questa | nessuno: lo scrive lo strumento |

Lo strumento si lancia dal task di VS Code **"Daiku: gestisci guardie (amministratore)"**, che
punta alla copia installata in Program Files, mai al sorgente. Il task sta in `tasks.json`, nel
repository: un agente potrebbe farlo puntare a un altro file. È un rischio accettato, dentro il
modello di minaccia di queste guardie (vedi *Limiti*).

## Lo strumento

Dal task **"Daiku: gestisci guardie (amministratore)"**. Si eleva da solo; frecce su/giù, INVIO,
ESC.

- **Tutto spento** — interruttore del presidio a `false`, e dai managed settings tolti il blocco
  `hooks` (recinto e presidio) e la lista `deny`, che finiscono in `guardie-accese.json`.
- **Tutto acceso** — il contrario. Il presidio entra nel blocco `hooks` anche se la copia rimessa
  non lo conteneva.
- **Aggiorna da repository** — copia i sorgenti di questa cartella in `tools\in-arrivo\`, sotto
  Program Files, mostra il diff rispetto a ciò che è installato e installa **quella copia** solo
  dopo la conferma: una modifica al repository fatta nel frattempo non entra. L'interruttore
  installato non cambia.
- **Esegui correzione dal repository** — copia `correzione-macchina.ps1` sotto Program Files, la
  mostra per intero e la esegue da amministratore solo dopo la conferma.

Claude Code legge gli hook all'avvio: dopo ogni cambio le sessioni vanno riavviate.

**Il diff è l'unica barriera.** Ciò che confermi diventa codice da amministratore o una guardia di
macchina. Se un aggiornamento o una correzione non li hai letti, annulla.

## Il presidio del target

Tre regole, per un guardrail contro la distrazione:

1. **L'esecuzione del target**, in ogni progetto: un repository di terzi preso in analisi da
   `studia-repository` si legge, si indicizza e si cita, non si esegue. Nega i comandi che eseguono
   dentro una `radici_non_eseguibili` o che girano con il cwd già lì; lascia passare i
   `programmi_permessi_sulle_radici` (`graphify`, `opensrc`, le letture), purché non concatenino
   un secondo comando.

   Il programma di una riga è il primo **dopo** l'ambiente con cui la si lancia: un'assegnazione in
   testa — `OPENSRC_HOME="…" opensrc path zod`, `NODE_ENV=production npm ci` — non è il gesto. Vale
   nei due versi, ed è il punto: il ramo profondo di `studia-repository` invoca `opensrc` proprio
   con l'ambiente in testa, e una lista dei programmi permessi che leggesse lì il nome del programma
   negherebbe l'unico attrezzo che deve poter leggere la radice.
2. **Le installazioni di pacchetti**, nei `progetti` dichiarati: `npm install`, `pip install`,
   `uv tool install`, `winget install` e le altre famiglie, comprese quelle dei prerequisiti.
3. **I gesti che nei `progetti` dichiarati non servono mai**: `npm test`, `npm run`, `yarn`, `pnpm`,
   `make`, `cargo`.

L'**interruttore** (`enabled`) spegne le regole 1 e 2: è la via per un'installazione che serve
davvero — si spegne, si installa a mano, si riaccende. La regola 3 non si spegne: si toglie
cambiando il sorgente.

La regola 3 sta nel presidio e non nella lista `deny` perché i managed settings valgono per ogni
progetto, e quei gesti vanno negati solo qui. Nel `.claude/settings.json` di un progetto una lista
`deny` non servirebbe: con `allowManagedPermissionRulesOnly: true` Claude Code la ignora.

Il presidio è **fail-open**: davanti a un guasto tace ed esce `0`, e lo dichiara su stdout.

**Il gate del ramo profondo lo interroga.** `check-toolchain.mjs` di `studia-repository` non si
accontenta di sapere che `opensrc` risponde a `--version`: importa la `valuta()` della copia
**installata** e le pone due domande — la forma con cui il contratto invoca `opensrc` passa? una
esecuzione dentro la radice è ancora negata? Se il presidio che gira è più vecchio del sorgente che
sa leggere quella forma, il gate è rosso e rimanda ad «Aggiorna da repository». La seconda domanda è
il verso che impedisce alla prima di mentire: un presidio che lascia passare tutto direbbe «sì» alla
forma documentata senza essere più una guardia.

## Prima installazione

Una volta sola, da un PowerShell qualunque, con il percorso completo (una finestra elevata parte
in `C:\Windows\system32`, e un percorso relativo lì non si trova):

```powershell
powershell -ExecutionPolicy Bypass -File "C:\dev\daiku-workspace\daiku-dev\.docs\tools\macchina\gestisci-guardie.ps1"
```

Chiede l'elevazione, mostra i file che installerà e aspetta la conferma. Rileggili prima: da lì in
avanti uno gira come amministratore e uno come guardia di macchina. Dopo l'installazione, la copia
del repository lanciata così rifiuta e rimanda al task.

## I banchi

```bash
node .docs/tools/macchina/guardia-target.mjs --self-check
node "C:/Program Files/ClaudeCode/guardia-target.mjs" --self-check
powershell -NoProfile -ExecutionPolicy Bypass -File .docs/tools/macchina/prova-gestisci-guardie.ps1
```

Il primo prova il sorgente del presidio contro il config di questa cartella, il secondo la copia
installata contro il config installato. Entrambi segnalano come caso rosso un config disallineato
dal banco. Il terzo prova lo strumento su una Program Files finta in una cartella temporanea,
senza amministratore, e controlla che i `.ps1` di questa cartella siano solo ASCII. Tutti stampano
il totale contato ed escono `1` al primo rosso. Si lanciano dopo ogni modifica, prima di
aggiornare la copia installata.

## Limiti, detti senza fingere

- **Il task di VS Code è scrivibile da un agente.** Punta alla copia installata, ma `tasks.json`
  sta nel repository: un agente che lo facesse puntare a un altro file si farebbe eseguire come
  amministratore alla prossima conferma dell'UAC.
- **Contro un agente che sbaglia, non contro uno malevolo.** Il tuo account è amministratore e
  l'UAC è al livello predefinito: a quel livello esistono tecniche note per elevarsi senza
  finestra, e Microsoft non tratta l'UAC come un confine di sicurezza. Il confine vero sarebbe un
  account standard per il lavoro quotidiano.
- **`node` sta in `C:\nvm4w\nodejs\`, scrivibile dal tuo utente.** Recinto e presidio girano con
  quel `node`: chi lo sostituisce li spegne entrambi.
- **Il presidio fa match sul testo del comando**: un binario rinominato o un path costruito a
  runtime gli sfuggono. Un hook in timeout non blocca.
- **I `progetti` sono path**: se il repository si sposta, le regole 2 e 3 smettono di valere senza
  avvisare. Il banco della copia installata controlla solo che la lista non sia vuota.
