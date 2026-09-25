---
name: pubblicazione-su-github
description: "Tutti e tre i repository stanno su GitHub — lo sviluppo privato come daiku-kaji-dev, i due pubblici non esistono ancora — e cosa ricontrollare prima di crearli"
metadata:
  node_type: memory
  type: project
  originSessionId: 69438169-0316-47c8-a4e8-3365650ee2cf
  modified: 2026-09-25T18:08:12.897Z
---

Tutti e tre i repository stanno su **GitHub** (vedi [[si-pubblica-solo-il-prodotto]]).

- Lo **sviluppo** è `NicolaTomasoni/daiku-kaji-dev`, privato per sempre. È stato spostato da
  GitLab il 25 settembre 2026, quando Kaji è entrato nel monorepo ([[monorepo-daiku-kaji]]).
  Il progetto GitLab `tomasoni.nicola/daiku` e quello di Kaji (`claude-code-router-extension`)
  non sono più remote di niente.
- Le due **pubblicazioni**, una per Daiku e una per Kaji, al 25 settembre 2026 non esistono
  ancora: nessuno dei due prodotti è pronto.

**Why:** per Daiku conta la forma breve `owner/repo`, che entrambi gli host accettano solo per
GitHub — `/plugin marketplace add owner/repo` su Claude Code, `codex plugin marketplace add
owner/repo` su Codex. Un GitLab richiederebbe l'URL git completo su tutti e due, e allungherebbe
le istruzioni di installazione senza dare nulla in cambio. Lo sviluppo non ha bisogno della forma
breve: sta su GitHub per avere una sede sola. Il suo nome non è `daiku` perché quel nome spetta al
repository pubblico dello stesso account.

**How to apply:** il gate resta **prima** del primo push pubblico di ciascun prodotto, perché da
quel momento ciò che sta sotto `plugins/` o `extensions/kaji/` esce com'è scritto. Il gate non è
una lista di cose da fare ma un **controllo da rifare**, perché un residuo nuovo entra con
qualunque consegna: `grep -rin "reforgia\|<username>\|c:/dev/" plugins/daiku/` (e lo stesso su
`extensions/kaji/`) prima di pubblicare, e ogni occorrenza va guardata — un path di questa
macchina finito in un template, in un banco di prova o in una fixture è esattamente ciò che il
gate esiste per fermare. Per Kaji vale in più: le fixture di `test/fixtures/` nascono da file
reali di Claude e Codex, e vanno redatte prima di entrare.

Nota pratica finché i prodotti vivono solo qui: installare Daiku da un repository privato richiede
credenziali git sulla macchina di chi installa. Per provare il pacchetto in locale conviene un
marketplace da path, che non passa da git.
