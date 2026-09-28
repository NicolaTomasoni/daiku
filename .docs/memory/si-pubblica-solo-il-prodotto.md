---
name: si-pubblica-solo-il-prodotto
description: "Due repository — sviluppo privato con tutto dentro, pubblicazione di Daiku su GitHub come albero generato dallo script"
metadata:
  node_type: memory
  type: project
  originSessionId: 69438169-0316-47c8-a4e8-3365650ee2cf
  modified: 2026-09-28T17:06:26.936Z
---

Daiku sta in **due repository** (il secondo dal 18 settembre 2026). Su questa macchina
stanno affiancati in `C:\dev\daiku-workspace\`, che non è un repository git: `daiku-dev`
è lo sviluppo, `daiku` è il checkout di servizio della pubblicazione.

Lo **sviluppo** è questo: `tomasoni.nicola/daiku-dev` su GitLab, privato, con dentro tutto —
`plugins/`, `.docs/`, `CLAUDE.md`, `.claude/`, `.vscode/`. Il
`.gitignore` in radice non filtra niente del prodotto: esclude solo `.claude/settings.local.json`,
che non deve stare in nessun git (vedi [[memoria-nel-repo]]).

La **pubblicazione** è il repository `NicolaTomasoni/daiku` su GitHub, che non è un branch di
questo né un fork: è un albero **generato**. **In radice non entra nessun file di prodotto**: il
prodotto ha una cartella che è per intero la radice del suo repository di pubblicazione, vetrine,
README e `.gitattributes` compresi. A ogni rilascio `.docs/tools/pubblica-dist.ps1` copia il
contenuto di quella cartella e committa (task VS Code «Daiku: pubblica dist»). Là dentro non si
lavora mai. Il repository è privato finché Daiku non è pronto per il pubblico.

Si copia il contenuto di `plugins/` — le due vetrine, `daiku/`, `.gitattributes`, `README.md`.

**Why:** di norma il filtro «cosa esce» non sta nel repo ma nel passo di impacchettamento — il
campo `files` di un `package.json`, `MANIFEST.in` in Python — e allora un repo solo basta. Per
Daiku quel passo **non esiste**: i marketplace di Claude Code e Codex clonano il repository invece
di installare un pacchetto (`sparsePaths`: *«If omitted, the full repository is cloned»*). Il repo
*è* l'artefatto consegnato, quindi il filtro non ha altro posto dove stare che in un secondo repo.

La storia di questo repo è comunque impubblicabile, perché `CLAUDE.md` sta nel commit iniziale
`a894d73`: una storia pubblica va rifatta da zero in ogni caso.

È il pattern *dist repo*: jQuery pubblica `jquery/jquery-dist`, Symfony ribalta il monorepo in
repo read-only con `splitsh-lite`, Google usa Copybara. Quegli strumenti qui sono fuori scala —
lo script fa tre cose e bastano.

**How to apply:** tre cose che lo script fa, e che un riversamento a mano dimenticherebbe.

Copia **la cartella del prodotto e nient'altro**, mai «tutto il repository tranne»: un file
nato fuori da `plugins/` resta fuori dal pacchetto pubblicato. Il rovescio
va tenuto presente: un file nato dentro, esce — la cartella di prodotto non è posto per appunti,
banchi di sviluppo o strumenti, che vanno in `.docs/`.

La destinazione va **svuotata** prima di copiare (tutto tranne il suo `.git`), altrimenti i file
cancellati o rinominati nel prodotto restano nel pacchetto pubblicato. Non è teorico: il refactor
`contratti/`→`contracts/` avrebbe lasciato dietro l'intera struttura vecchia.

E il confine **non guarda dentro i file**: ciò che sta sotto `plugins/` esce
com'è scritto. Il gate stretto gira a ogni rilascio dentro lo script; quello largo prima
dell'apertura al pubblico — vedi [[pubblicazione-su-github]] per cosa ricontrollare.

Nota sul `.gitattributes`: la cartella di prodotto porta il suo, accanto a quello di radice che
vale per lo sviluppo. Questo repo ha
`core.autocrlf = true` nel config **locale**, quindi senza `* text=auto eol=lf` il working tree
tornerebbe CRLF a ogni checkout, e lo script — che copia dal working tree, non da
`git archive` — riverserebbe CRLF nel pacchetto pubblicato. L'attributo tiene LF su entrambi i
lati e in tutti i repository.
