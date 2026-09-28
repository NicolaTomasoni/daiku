---
name: pubblicazione-su-github
description: "Lo sviluppo privato è daiku-dev su GitLab, la pubblicazione è daiku su GitHub (privato finché il prodotto non è pronto) — checkout, script e cosa ricontrollare prima di aprire"
metadata:
  node_type: memory
  type: project
  originSessionId: 69438169-0316-47c8-a4e8-3365650ee2cf
  modified: 2026-09-28T15:10:40.933Z
---

Sviluppo e pubblicazione stanno su **GitHub** (vedi [[si-pubblica-solo-il-prodotto]]).

- Lo **sviluppo** è `tomasoni.nicola/daiku-dev` su GitLab, privato per sempre. Dal
  28 settembre 2026 sta lì; prima stava su GitHub (`daiku-kaji-dev`, poi `daiku-dev`).
  Il vecchio progetto `tomasoni.nicola/daiku` resta schedulato per la cancellazione.
- La **pubblicazione** è `NicolaTomasoni/daiku`, creato il 28 settembre 2026 e privato
  finché Daiku non è pronto per il pubblico. Il checkout di servizio è `C:\dev\daiku-dist`
  (col suffisso perché su Windows `daiku` e `Daiku` collidono); lo alimenta
  `.docs/tools/pubblica-dist.ps1` (task VS Code «Daiku: pubblica dist»).
  Un collega si invita lì come collaborator, mai sullo sviluppo.

**Why:** per Daiku conta la forma breve `owner/repo`, che entrambi gli host accettano solo per
GitHub — `/plugin marketplace add owner/repo` su Claude Code, `codex plugin marketplace add
owner/repo` su Codex. Un GitLab richiederebbe l'URL git completo su tutti e due, e allungherebbe
le istruzioni di installazione senza dare nulla in cambio. La pubblicazione sta su GitHub
per questo; lo sviluppo sta su GitLab, dove la forma breve non serve.

**How to apply:** lo script esegue a ogni rilascio il gate stretto (path di questa macchina,
nome utente, segnaposto non sostituiti, nome del repo di sviluppo). Il gate largo resta
**prima** dell'apertura al pubblico, perché da quel momento ciò che sta sotto `plugins/` esce
com'è scritto: `grep -rin "reforgia\|<username>\|c:/dev/" plugins/daiku/`
e ogni occorrenza va guardata — un path di questa macchina finito in un template, in un banco
di prova o in una fixture è esattamente ciò che il gate esiste per fermare.

Nota pratica: installare Daiku da un repository privato richiede credenziali git sulla macchina
di chi installa. Per provare il pacchetto in locale conviene un marketplace da path, che non
passa da git.
