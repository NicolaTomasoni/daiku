---
name: pubblicazione-su-github
description: "daiku-workspace tiene affiancati lo sviluppo (daiku-dev su GitLab, «dev») e il checkout della pubblicazione (NicolaTomasoni/daiku su GitHub, «prod», privato finché il prodotto non è pronto) — script e cosa ricontrollare prima di aprire"
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
  finché Daiku non è pronto per il pubblico. Lo alimenta
  `.docs/tools/pubblica-dist.ps1`, chiamato dal comando `/rilascia-daiku`.
  Un collega si invita lì come collaborator, mai sullo sviluppo.

**Why:** per Daiku conta la forma breve `owner/repo`, che entrambi gli host accettano solo per
GitHub — `/plugin marketplace add owner/repo` su Claude Code, `codex plugin marketplace add
owner/repo` su Codex. Un GitLab richiederebbe l'URL git completo su tutti e due, e allungherebbe
le istruzioni di installazione senza dare nulla in cambio. La pubblicazione sta su GitHub
per questo; lo sviluppo sta su GitLab, dove la forma breve non serve.

**How to apply:** il rilascio ha un percorso solo, `.claude/commands/rilascia-daiku.md`: verifiche
verdi — le due vetrine comprese, perché il loro guasto si vede solo in chi installa —, versione
scritta nei due manifest e nel badge del README con la verifica di rilettura, prosa AI (voce di
changelog e messaggio `release X.Y.Z`), pubblicazione con `pubblica-dist.ps1` in UN commit.
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
