---
name: lotto-di-studi
description: "studia-repository-lotto studia più repository in parallelo con una sessione headless per target, e applica lui le voci `allinea` — le uniche che una corsa propone e non scrive"
metadata:
  node_type: memory
  type: project
  modified: 2026-09-29
---

Dal 29 settembre 2026 il cantiere ha un comando in più, **`studia-repository-lotto`**, che studia
più repository di terzi in un colpo solo. La macchina è `.docs/tools/studia-repository/lotto.mjs`,
con tre verbi: `prepara` (piano, non scrive), `lancia` (le corse, in parallelo), `applica` (il gate
di ognuna, la raccolta, la scrittura). Il contratto è `.claude/commands/studia-repository-lotto.md`
e la riga di `.claude/orchestration.md` §5.

**Una sessione headless per target, non un subagent.** `lancia` esegue `claude -p
"/studia-repository <target> …" --permission-mode bypassPermissions` con `spawn`, fino a
`--parallelo` insieme (predefinito 3), log in `%TEMP%/daiku-lotto/<id>/`. Due ragioni, e la seconda
è una scoperta: una corsa di `studia-repository` è già un orchestratore che delega dieci passi, e
tenerla dentro la sessione madre la farebbe crescere di una corsa intera per target; e **il recinto
di macchina nega le righe di comando che contengono un token che comincia per `/`**, scambiandolo
per un path assoluto — quindi `/studia-repository …` non si può scrivere da un tool Bash, e chi lo
lancia deve essere un processo. Vale per chiunque debba invocare una skill da un attrezzo.

**Le voci `allinea` sono la sesta azione del censimento.** Una corsa **propone**, non scrive:
resta la regola che una corsa scrive solo sotto `.docs/studia-repository/`, e il gate
`check-run.mjs` la impone. Una voce `allinea` è una cosa diversa dalle altre cinque — non porta a
casa niente dal target, ripara un disallineamento del nostro corpus — e per essere applicata a
macchina deve essere una **sostituzione puntuale**: `path` sotto `plugins/`, `prima`, `dopo`,
entrambe su una riga sola. Sta in due sedi che si controllano a vicenda: la scheda `### RI-…` con
`**Azione:** allinea` e il campo `**Allineamento:**`, e la voce in `run.json.allineamenti`.

**Chi applica è il lotto, e i conflitti li decide l'owner.** `applica` rifiuta di scrivere se una
corsa del lotto è rossa al gate, applica le voci che non si toccano, e **non applica mai** due
proposte che si sovrappongono nello stesso file: quelle sono due forme diverse della stessa regola,
e vanno all'owner. Doppioni (stessa sostituzione da più corse) e voci su file diversi non sono
conflitti. Dopo la scrittura rilancia da sé le quattro verifiche di `CLAUDE.md` e, se una è rossa,
esce `1` **senza rimettere a posto i file**.

**Il perimetro delle scritture di una corsa è salito di un livello**: da `.docs/studia-repository/<slug>/`
a `.docs/studia-repository/`. Con il perimetro sulla sola cartella della corsa due corse parallele
si davano il rosso a vicenda, perché i file dell'una stanno fuori dalla cartella dell'altra e il
confronto fra due fotografie di `git status` non distingue una corsa parallela da una scrittura
fuori posto. Fuori da quella radice il controllo è quello di prima — niente sotto `plugins/`, che
ha la sua riga a sé, niente altrove — e una corsa scritta fuori dalla radice è rossa lei stessa.

**Why:** l'owner ha chiesto il 29 settembre 2026 una skill che prendesse un elenco di nomi e link e
lanciasse `studia-repository` su tutti in parallelo, e che i miglioramenti «che non richiedono
trade-off né cambio di comportamento» fossero applicati da soli invece che censiti. La sede
dell'applicazione è stata scelta da lui: **tutti propongono, l'orchestratore applica, e all'owner
va ciò che richiede una decisione** — non studia-repository dentro la corsa, che avrebbe richiesto
di rilassare il gate della corsa proprio sulla scrittura nel prodotto.

**How to apply:**
- Un lotto si lancia in **background** (`run_in_background`): decine di minuti, e in primo piano un
  timeout lo taglia. `lancia` esce `1` se una corsa è uscita non-zero — non è un motivo per
  fermarsi, quella corsa finisce fra i gap col suo log.
- Il criterio dell'allineamento è uno: **non decide, ripara.** Se per scegliere fra due forme serve
  una decisione, non è `allinea`. Se non sai scrivere `prima` e `dopo`, non è un gratuito.
- I banchi: `node .docs/tools/studia-repository/self-check.mjs` somma i tre fratelli
  (`check-toolchain.mjs`, `check-run.mjs`, `lotto.mjs`), a totale contato.
- `.docs/tools/studia-repository/` è la cartella dell'attrezzo, e `self-check.mjs` la scandisce per
  «l'attrezzo non installa»: un `.mjs` nuovo lì entra nel conteggio da solo.

Vedi anche [[catalogo-di-feature]] per l'altra metà del lavoro — i contributi che una corsa depone
in `.docs/features/` — [[guardie-di-macchina]] per il recinto che impone la sessione headless,
[[corpus-di-sviluppo]] per il comando in più nel cantiere, e [[guardrail-nascono-spenti]] per le
guardie del pacchetto, che sono un'altra cosa.
