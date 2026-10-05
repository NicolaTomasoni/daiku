---
name: si-pubblica-solo-il-prodotto
description: "Il confine fra cantiere e prodotto è il ramo: `develop` porta tutto, e il contenuto di `plugins/` è la radice di `main` — perché chi installa il marketplace riceve un clone dell'intero repository"
metadata:
  node_type: memory
  type: project
  originSessionId: 69438169-0316-47c8-a4e8-3365650ee2cf
  modified: 2026-10-05T15:38:17.173Z
---

**Il confine fra cantiere e prodotto è il ramo, non un secondo repository** (dal 5 ottobre 2026,
vedi [[pubblicazione-su-github]]). `develop` porta tutto — il prodotto, `.docs/`, `CLAUDE.md`,
`.claude/`, `.daiku/`, `.vscode/` — e su `main` esce **il contenuto di `plugins/`**, portato alla
radice del repository: le due vetrine, `daiku/`, il README, il `.gitattributes`, la licenza.

`plugins/` è quindi la cartella il cui **contenuto** è l'albero di `main`. Lo dichiara
`release.source` in `.daiku/project.json`, ed è per questo che le chiavi `version.*` e `changelog`
si scrivono una volta sola, nella forma del cantiere: il rilascio le risolve su production togliendo
quel prefisso.

**Perché un ramo e non un `.gitignore`.** Di norma il filtro «cosa esce» non sta nel repo ma nel
passo di impacchettamento — il campo `files` di un `package.json`, `MANIFEST.in` in Python — e
allora un repo solo basta. Per Daiku quel passo **non esiste**: i marketplace di Claude Code e Codex
clonano il repository invece di installare un pacchetto (`sparsePaths`: *«If omitted, the full
repository is cloned»*). Il repo *è* l'artefatto consegnato: il filtro non ha altro posto dove stare
che in un albero diverso da quello di sviluppo, cioè in un altro ramo.

**Il rilascio prende `plugins/` e nient'altro**, mai «tutto il repository tranne»: un file nuovo
nato fuori da `plugins/` resta fuori dal pacchetto; uno nato dentro, esce. E il confine **non guarda
dentro i file**: ciò che sta sotto `plugins/` esce com'è scritto — vedi
[[pubblicazione-su-github]] per cosa ricontrollare prima dell'apertura al pubblico.

Nota sui file di radice: la cartella di prodotto porta i suoi — `.gitattributes` e `.gitignore` —
accanto a quelli di radice che valgono per lo sviluppo. Il `.gitignore` è per `main`: è un
repository che un host apre in locale, e deve tenere fuori i file di macchina che vi nascono.

Vedi [[alberatura-pacchetto]] per le sedi, e [[corpus-di-sviluppo]] per cosa resta in `.claude/`.
