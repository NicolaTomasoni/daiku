---
name: pubblicazione-su-github
description: "daiku-workspace tiene affiancati lo sviluppo (daiku-dev su GitLab, «dev») e il checkout della pubblicazione (NicolaTomasoni/daiku su GitHub, «prod», privato finché il prodotto non è pronto) — i due canali beta e main con la regola di promozione, gli script e cosa ricontrollare prima di aprire"
metadata:
  node_type: memory
  type: project
  originSessionId: 69438169-0316-47c8-a4e8-3365650ee2cf
  modified: 2026-09-29T19:55:46.000Z
---

Su questa macchina sviluppo e pubblicazione stanno affiancati in `C:\dev\daiku-workspace\`,
che non è un repository git: `daiku-dev` è questo repository, `daiku` è il checkout di
servizio della pubblicazione (vedi [[si-pubblica-solo-il-prodotto]]).

**«dev» è questo repository, «prod» è `NicolaTomasoni/daiku` su GitHub.** Quando l'utente
dice prod non parla di un ambiente di produzione: parla del repository pubblicato.

- Lo **sviluppo** è `tomasoni.nicola/daiku-dev` su GitLab, privato per sempre.
La storia di **prod** comincia da un **commit radice vuoto** — nessun file, nessun genitore.
Non c'è niente prima, e `main` è l'unico ref: niente tag, niente release, niente PR.

- La **pubblicazione** è `NicolaTomasoni/daiku` su GitHub, privato
  finché Daiku non è pronto per il pubblico. La alimenta
  `.docs/tools/pubblica-dist.ps1`, chiamato dal comando `/rilascia-daiku`, sul ramo **beta**.
  Un collega si invita lì come collaborator, mai sullo sviluppo.

**Due canali, un repository.** Il checkout di dist lavora stabilmente sul ramo **beta**: ogni
rilascio atterra lì. La produzione è **main**, e ci arriva solo per promozione, con
`.docs/tools/promuovi-dist.ps1`, che sposta `main` su un commit di beta dopo aver verificato che
sia un fast-forward — portandosi dietro tutte le patch arretrate, perché la storia è lineare.

| Bump | Dove va il rilascio |
|---|---|
| `patch` | solo beta, salvo l'ordine esplicito `--with-main` |
| `minor`, `major` | beta e main |

Il default branch resta `main`, verificato il 1° ottobre 2026: chi installa da `owner/repo` senza
ref prende la produzione, e il comando di installazione non cambia. L'installazione del canale
beta è in [[installazione-e-versionamento]].

**Why:** per Daiku conta la forma breve `owner/repo`, che entrambi gli host accettano solo per
GitHub — `/plugin marketplace add owner/repo` su Claude Code, `codex plugin marketplace add
owner/repo` su Codex. Un GitLab richiederebbe l'URL git completo su tutti e due, e allungherebbe
le istruzioni di installazione senza dare nulla in cambio. La pubblicazione sta su GitHub
per questo; lo sviluppo sta su GitLab, dove la forma breve non serve.

**How to apply:** il rilascio ha un percorso solo, `.claude/commands/rilascia-daiku.md`. Prima il
ciclo di **code review** sul diff del rilascio — `daiku:code-review`, in loop finché il codice
smette di cambiare — e il **commit in dev** di quello che lascia: è il default, e il comando non
chiede se committare prima. Poi le verifiche verdi — le due vetrine comprese, perché il loro guasto
si vede solo in chi installa —, la versione scritta nei due manifest e nel badge del README con la
verifica di rilettura, la prosa AI (voce di changelog e messaggio `release X.Y.Z`), l'ultimo commit
in dev con versione e changelog, e solo dopo la pubblicazione con `pubblica-dist.ps1`, che scrive
su beta in UN commit e si ferma se il checkout non sta su beta.
**Dev è la fonte, la dist è la copia:** pubblicare prima di committare lascia in dev una versione
che non esiste in nessun commit, e il rilascio successivo calcolerebbe il perimetro da un albero
sbagliato.
**Il push non è della macchina:** `pubblica-dist.ps1` committa e `promuovi-dist.ps1` prepara
`main`, e si fermano — pushava da sé fino al 30 settembre 2026, quando un rilascio uscì prima che
l'owner lo decidesse. Restano due gesti manuali: `beta` a ogni rilascio, `main` quando c'è una
promozione. In questo repository `.claude/settings.json` nega il push.
È l'unico percorso di rilascio: la versione la scrive la sessione nei tre punti.
`pubblica-dist.ps1` esegue a ogni pubblicazione il gate stretto (path di questa macchina,
nome utente, segnaposto non sostituiti, nome del repo di sviluppo). Il gate largo resta
**prima** dell'apertura al pubblico, perché da quel momento ciò che sta sotto `plugins/` esce
com'è scritto: `grep -rin "reforgia\|<username>\|c:/dev/" plugins/daiku/`
e ogni occorrenza va guardata — un path di questa macchina finito in un template, in un banco
di prova o in una fixture è esattamente ciò che il gate esiste per fermare.

Nota pratica: installare Daiku da un repository privato richiede credenziali git sulla macchina
di chi installa. Per provare il pacchetto in locale conviene un marketplace da path, che non
passa da git.
