---
name: si-pubblica-solo-il-prodotto
description: Due repository — sviluppo privato con tutto dentro, pubblicazione su GitHub come albero generato dallo script
metadata:
  type: project
---

Daiku sta in **due repository** (deciso il 18 settembre 2026).

Lo **sviluppo** è questo: privato, con dentro tutto — `plugins/daiku/`, `sviluppo/`, `CLAUDE.md`,
`.claude/`, `.vscode/`. Il `.gitignore` non filtra più niente: esclude solo
`.claude/settings.local.json`, che non deve stare in nessun git (vedi [[memoria-nel-repo]]).

La **pubblicazione** è un secondo repository su GitHub, che non è un branch di questo né un fork:
è un albero **generato**. A ogni rilascio uno script copia lì i soli path ammessi — `plugins/`,
`.claude-plugin/`, `.agents/`, `README.md`, `.gitattributes` — e committa. Là dentro non si
lavora mai.

**Why:** di norma il filtro «cosa esce» non sta nel repo ma nel passo di impacchettamento — il
campo `files` di un `package.json`, `MANIFEST.in` in Python — e allora un repo solo basta. Qui
quel passo **non esiste**: i marketplace di Claude Code e Codex clonano il repository invece di
installare un pacchetto (`sparsePaths`: *«If omitted, the full repository is cloned»*). Il repo
*è* l'artefatto consegnato, quindi il filtro non ha altro posto dove stare che in un secondo repo.

Due ragioni hanno chiuso la questione: il corpus di sviluppo non era versionato da nessuna parte
— nessuna storia, nessun backup — e la storia di questo repo è comunque impubblicabile, perché
`CLAUDE.md` sta nel commit iniziale `a894d73`. Una storia pubblica andava rifatta da zero in ogni
caso.

È il pattern *dist repo*: jQuery pubblica `jquery/jquery-dist`, Symfony ribalta il monorepo in
repo read-only con `splitsh-lite`, Google usa Copybara. Quegli strumenti qui sono fuori scala —
per un albero da 42 file bastano venti righe di script. `git subtree split` **non** è utilizzabile:
lavora su un prefisso solo, e qui le radici da copiare sono quattro.

**How to apply:** tre cose che lo script deve fare, e che non vengono gratis.

La lista di copia va tenuta **a lista di ammissione** — «copia questi path», mai «copia tutto
tranne» — perché resti vera la proprietà che prima dava il `.gitignore`: un file nuovo nasce fuori
dal pacchetto pubblicato, e per farcelo entrare bisogna deciderlo.

La destinazione va **svuotata** prima di copiare (tutto tranne il suo `.git`), altrimenti i file
cancellati o rinominati nel prodotto restano nel pacchetto pubblicato. Non è teorico: il refactor
`contratti/`→`contracts/` avrebbe lasciato dietro l'intera struttura vecchia.

E il confine **non guarda dentro i file**: ciò che sta sotto `plugins/` esce com'è scritto. Il
gate prima del primo push pubblico è ancora aperto — vedi [[pubblicazione-su-github]] per l'elenco
di cosa ripulire.

Nota sul `.gitattributes`: sta nella lista di copia apposta. Questo repo ha `core.autocrlf = true`
nel config **locale**, quindi senza `* text=auto eol=lf` il working tree tornerebbe CRLF a ogni
checkout, e lo script — che copia dal working tree, non da `git archive` — riverserebbe CRLF nel
pacchetto pubblicato. L'attributo tiene LF su entrambi i lati e in tutti e due i repository.
