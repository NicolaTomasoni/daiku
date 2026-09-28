---
name: pubblicazione-su-github
description: "daiku-workspace tiene affiancati lo sviluppo (daiku-dev su GitLab) e il checkout della pubblicazione (daiku su GitHub, privato finché il prodotto non è pronto) — script e cosa ricontrollare prima di aprire"
metadata:
  node_type: memory
  type: project
  originSessionId: 69438169-0316-47c8-a4e8-3365650ee2cf
  modified: 2026-09-28T17:55:39.472Z
---

Su questa macchina sviluppo e pubblicazione stanno affiancati in `C:\dev\daiku-workspace\`,
che non è un repository git: `daiku-dev` è questo repository, `daiku` è il checkout di
servizio della pubblicazione (vedi [[si-pubblica-solo-il-prodotto]]).

- Lo **sviluppo** è `tomasoni.nicola/daiku-dev` su GitLab, privato per sempre.
- La **pubblicazione** è `NicolaTomasoni/daiku` su GitHub, privato
  finché Daiku non è pronto per il pubblico. Lo alimenta
  `.docs/tools/pubblica-dist.ps1` (task VS Code «Daiku: pubblica dist»).
  Un collega si invita lì come collaborator, mai sullo sviluppo.

**Why:** per Daiku conta la forma breve `owner/repo`, che entrambi gli host accettano solo per
GitHub — `/plugin marketplace add owner/repo` su Claude Code, `codex plugin marketplace add
owner/repo` su Codex. Un GitLab richiederebbe l'URL git completo su tutti e due, e allungherebbe
le istruzioni di installazione senza dare nulla in cambio. La pubblicazione sta su GitHub
per questo; lo sviluppo sta su GitLab, dove la forma breve non serve.

**How to apply:** il riversamento semplice va col task «Daiku: pubblica dist»; il rilascio
versionato guidato è `.claude/commands/rilascia-daiku.md`: verifiche verdi, numeri dallo script
(`rilascia-daiku.mjs --solo-file`), prosa AI (voce di changelog e messaggio `release X.Y.Z`),
pubblicazione con `pubblica-dist.ps1` in UN commit. I tre task «Daiku: rilascio major/minor/patch»
restano per il lancio senza agente: stesso script in modo intero, note headless con `--notes auto`
o forzate con testo. Lo script esegue a ogni rilascio il gate stretto (path di questa macchina,
nome utente, segnaposto non sostituiti, nome del repo di sviluppo). Il gate largo resta
**prima** dell'apertura al pubblico, perché da quel momento ciò che sta sotto `plugins/` esce
com'è scritto: `grep -rin "reforgia\|<username>\|c:/dev/" plugins/daiku/`
e ogni occorrenza va guardata — un path di questa macchina finito in un template, in un banco
di prova o in una fixture è esattamente ciò che il gate esiste per fermare.

Nota pratica: installare Daiku da un repository privato richiede credenziali git sulla macchina
di chi installa. Per provare il pacchetto in locale conviene un marketplace da path, che non
passa da git.
