---
name: si-pubblica-solo-il-prodotto
description: "Tre repository — sviluppo privato con tutto dentro, due pubblicazioni su GitHub (Daiku e Kaji) come alberi generati dagli script"
metadata:
  node_type: memory
  type: project
  originSessionId: 69438169-0316-47c8-a4e8-3365650ee2cf
  modified: 2026-09-25T18:08:04.491Z
---

Daiku e Kaji stanno in **tre repository** (Daiku in due dal 18 settembre 2026, Kaji aggiunto il
25 settembre 2026, vedi [[monorepo-daiku-kaji]]).

Lo **sviluppo** è questo: `NicolaTomasoni/daiku-kaji-dev`, privato, con dentro tutto —
`plugins/`, `extensions/kaji/`, `.docs/`, `CLAUDE.md`, `.claude/`, `.vscode/`. Il
`.gitignore` in radice non filtra niente dei prodotti: esclude solo `.claude/settings.local.json`,
che non deve stare in nessun git (vedi [[memoria-nel-repo]]). Gli ignore di build di Kaji stanno
in `extensions/kaji/.gitignore`, che viaggia col prodotto.

La **pubblicazione** sono due repository su GitHub, uno per prodotto, che non sono branch di
questo né fork: sono alberi **generati**. **In radice non entra nessun file di prodotto**: ogni
prodotto ha una cartella che è per intero la radice del suo repository pubblico, vetrine, README e
`.gitattributes` compresi. A ogni rilascio uno script per prodotto copia il contenuto di quella
cartella e committa. Là dentro non si lavora mai.

- **Daiku:** il contenuto di `plugins/` — le due vetrine, `daiku/`, `.gitattributes`, il README.
- **Kaji:** il contenuto di `extensions/kaji/`.

**Why:** di norma il filtro «cosa esce» non sta nel repo ma nel passo di impacchettamento — il
campo `files` di un `package.json`, `MANIFEST.in` in Python — e allora un repo solo basta. Per
Daiku quel passo **non esiste**: i marketplace di Claude Code e Codex clonano il repository invece
di installare un pacchetto (`sparsePaths`: *«If omitted, the full repository is cloned»*). Il repo
*è* l'artefatto consegnato, quindi il filtro non ha altro posto dove stare che in un secondo repo.
Kaji il passo di impacchettamento ce l'ha (il VSIX), ma il suo sorgente pubblico non può essere
un repository privato che porta dentro anche l'altro prodotto.

La storia di questo repo è comunque impubblicabile, perché `CLAUDE.md` sta nel commit iniziale
`a894d73`: una storia pubblica va rifatta da zero in ogni caso.

È il pattern *dist repo*: jQuery pubblica `jquery/jquery-dist`, Symfony ribalta il monorepo in
repo read-only con `splitsh-lite`, Google usa Copybara. Quegli strumenti qui sono fuori scala —
bastano venti righe di script per prodotto. Per Daiku `git subtree split` **non** è utilizzabile:
lavora su un prefisso solo, e la storia di sviluppo non si pubblica comunque.

**How to apply:** tre cose che ogni script deve fare, e che non vengono gratis.

Si copia **la cartella del prodotto e nient'altro**, mai «tutto il repository tranne»: un file
nato fuori da `plugins/` o da `extensions/kaji/` resta fuori dai pacchetti pubblicati. Il rovescio
va tenuto presente: un file nato dentro, esce — la cartella di prodotto non è posto per appunti,
banchi di sviluppo o strumenti, che vanno in `.docs/`.

La destinazione va **svuotata** prima di copiare (tutto tranne il suo `.git`), altrimenti i file
cancellati o rinominati nel prodotto restano nel pacchetto pubblicato. Non è teorico: il refactor
`contratti/`→`contracts/` avrebbe lasciato dietro l'intera struttura vecchia.

E il confine **non guarda dentro i file**: ciò che sta sotto `plugins/` ed `extensions/kaji/` esce
com'è scritto. Il gate prima del primo push pubblico è ancora aperto — vedi
[[pubblicazione-su-github]] per cosa ricontrollare.

Nota sul `.gitattributes`: ogni cartella di prodotto porta il suo, accanto a quello di radice che
vale per lo sviluppo. Questo repo ha
`core.autocrlf = true` nel config **locale**, quindi senza `* text=auto eol=lf` il working tree
tornerebbe CRLF a ogni checkout, e gli script — che copiano dal working tree, non da
`git archive` — riverserebbero CRLF nei pacchetti pubblicati. L'attributo tiene LF su entrambi i
lati e in tutti i repository.
