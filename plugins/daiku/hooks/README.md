# I tre guardrail

Daiku porta tre hook. Fanno due mestieri diversi: uno **ferma un gesto** prima che accada, gli
altri due non fermano mai niente e si limitano a dire quello che sanno.

| Hook | Evento | Cosa fa |
|---|---|---|
| `lib/command-guard.mjs` | `PreToolUse` su `Bash`/`PowerShell` | nega quattro gesti distruttivi, e solo quelli che il progetto dichiara |
| `lib/contracts-post-edit.mjs` | `PostToolUse` su `Edit`/`Write` | dopo una scrittura sul corpus, segnala i guasti che non fallirebbero da soli |
| `lib/session-advice.mjs` | `SessionStart` | all'avvio, dice se Daiku è aperto a metà e se un lavoro è rimasto in volo |

Accanto stanno due moduli che hook non sono: `lib/project-root.mjs` trova la radice del
progetto sui due host, `lib/daiku-config.mjs` legge `.daiku/project.json`. Non hanno un banco
proprio: sono provati dai banchi dei tre che li importano.

## Non sono una barriera di sicurezza

La policy che un agente non può togliersi vive nei **managed settings** dell'host: stanno sopra
ogni altra sorgente, e un processo non elevato non li scrive. Un hook non li scavalca — la
documentazione lo dice esplicitamente: la decisione di un hook non annulla una permission rule.

Questi tre stanno sotto quella linea e coprono un'altra cosa: la **distrazione**. I gesti che
costano lavoro perso e che nessuna regola per prefisso sa riconoscere, perché quella regola
combacia sull'inizio di una riga e non entra dentro `sh -c`.

La divisione va tenuta: **i permessi stanno nei managed settings, i guardrail di dominio stanno
qui.** Che questi file restino scrivibili non toglie niente alla policy.

## Niente si accende da solo

Un pacchetto si installa una volta ed è attivo su **ogni** repository che l'host apre, compresi
quelli che Daiku non l'hanno mai visto. Perciò la prima domanda di `command-guard` non è «questo
comando è pericoloso?» ma «questo progetto mi ha chiesto qualcosa?».

1. **Senza `.daiku/project.json` non nega niente**, mai, senza nemmeno leggere la riga.
2. **Ogni ramo ha il proprio interruttore** nel JSON, e un interruttore assente è un ramo spento.

| Ramo | Acceso da | Cosa nega |
|---|---|---|
| link di Windows | *nessun interruttore*: basta `.daiku/` | una rimozione ricorsiva che attraversa una junction e svuota la directory reale dall'altra parte |
| pool di worktree | `worktree.pool` | rimozioni dentro un worktree del pool, e `pnpm install` lanciato da lì |
| `--no-verify` | `guardrails.deny_no_verify` | `git commit` con `-n` o `--no-verify`, in qualunque posizione stia il flag |
| push | `guardrails.deny_push` | `git push`, anche dentro un wrapper o in coda a un altro comando; `--dry-run` no |

Il primo ramo non ha interruttore perché non è una policy: che `rm -rf` entri in una junction e
distrugga quello che sta dall'altra parte è un fatto del sistema operativo, vero in ogni
progetto, e una junction non si vede leggendo la riga di comando.

Gli altri tre sono decisioni di chi tiene il repository, e Daiku non le presume. È la §6 di
`contracts/project-contract.md` — *ciò che il JSON non dichiara non esiste* — applicata a un
hook invece che a una skill.

Un esempio completo, in `.daiku/project.json`:

```json
{
  "worktree": { "pool": "../wt", "prefix": "wt-", "max": 3 },
  "guardrails": { "deny_push": true, "deny_no_verify": true }
}
```

`session-advice` segue la stessa regola: cerca i lavori lasciati a metà solo dentro la cartella
che `paths.studies` dichiara. Nessuna dichiarazione, nessun avviso.

`contracts-post-edit` no, e la differenza è voluta: quell'hook **non nega niente a nessuno**, e
un frontmatter YAML che si svuota in silenzio è un guasto anche per chi Daiku non ce l'ha.

## Degradano aperto, e per questo hanno un banco

Tutti e tre **fail-open**: stdin malformato, file sparito, disco irraggiungibile, eccezione →
tacciono ed escono `0`. Una guardia che rompe il turno costa più di quanto protegga.

Il prezzo è dichiarato: **un hook guasto è indistinguibile da uno che non ha niente da dire.**
Per questo ciascuno porta un banco di prova che gira su un filesystem simulato, non tocca
niente, e stampa un totale contato:

```bash
node hooks/self-check.mjs          # i tre banchi in un colpo, col totale sommato
node hooks/lib/command-guard.mjs --self-check   # uno solo, come lo lancia sync-host
```

Il primo esce `1` al primo rosso: è il comando da mettere in una CI e da lanciare prima di un
rilascio, accanto ai due validatori di pacchetto.

## Cosa non fanno

- **Non eseguono niente che non fosse già in esecuzione.** In particolare `contracts-post-edit`
  *ricorda* di lanciare il banco di una guardia riscritta, e non lo lancia: far partire un file
  perché è appena comparso significherebbe eseguire codice che nessuno ha ancora guardato,
  scavalcando sia la conferma che l'host chiede per un comando, sia l'approvazione per hash che
  Codex pretende proprio per gli hook.
- **Non scrivono mai sul disco.** Leggono, e rispondono all'host.
- **Non parlano per dire che va tutto bene.** Un avviso che arriva sempre smette di essere letto.

## Servono Node e nient'altro

I tre hook sono `.mjs` lanciati con `node`, senza dipendenze: nessun `package.json`, nessun
modulo da installare. Su un progetto dove `node` non è nel `PATH` non partono — e siccome
l'host non ferma un turno per un hook che fallisce, il risultato è che tacciono. Se un progetto
non ha Node, questi guardrail non ci sono: è un requisito, non una degradazione elegante.

## Sui due host non arrivano per la stessa strada

Su **Claude Code** li porta il pacchetto: `plugin.json` dichiara `hooks`, e `hooks/hooks.json`
li aggancia con `${CLAUDE_PLUGIN_ROOT}`. Si aggiornano quando si aggiorna il pacchetto, e nel
progetto non compare niente.

Su **Codex** no: `plugin_hooks` è una feature **rimossa** e il validatore rifiuta la chiave
`hooks` nel manifest. Lì gli hook vivono in `<repo>/.codex/hooks.json`, fuori dal pacchetto, e
ce li porta `/sync-host` copiando `lib/` in `.codex/hooks/` e scrivendo il manifesto dal modello
in `templates/codex/hooks.json`. I path lì dentro sono **assoluti**, perché un hook di Codex non
riceve nessuna variabile che punti al progetto; vanno riscritti se il repository si sposta, e si
riscrivono rilanciando `/sync-host`.

Dopo ogni aggiornamento, su Codex, gli hook cambiati tornano a chiedere l'approvazione con
`/hooks`: la fiducia è registrata sull'hash del file, e finché non la dai vengono saltati.
