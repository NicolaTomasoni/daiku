---
name: mod-in-sviluppo
description: "Le mod scritte in `dev-mods/<id-sessione>` vivono e muoiono con quella sessione: per averle sempre vanno in una cartella stabile nominata in `CLAUDE_CODE_PLUGIN_DIRS`, e il sintomo del contrario è una mod che «smette di funzionare»"
metadata:
  node_type: memory
  type: project
  originSessionId: 1690075d-19b2-4591-9675-e2e0cec00bd7
  modified: 2026-10-14T19:14:06.881Z
---

Una mod in sviluppo (un plugin di function hooks) si scrive in
`~/.claude/dev-mods/<id-sessione>/<nome>/`, e **quella cartella è di una sessione sola**:
l'engine pretende che il path sia esattamente `dev-mods/<id-sessione-corrente>`
(`ZPn` nell'eseguibile), la voce non si eredita, e la pulizia periodica spazza le cartelle
delle altre sessioni dopo qualche giorno. Una mod scritta lì è invisibile a ogni sessione
successiva: **il sintomo è una mod che «smette di funzionare»** quando si riapre il terminale.

La prova sta nel file di sessione (`~/.claude/projects/<progetto>/<id>.jsonl`): la voce
`{"type":"dev-mods","folder":…,"sessionId":…}` compare solo quando la persona risponde
«Enable for this session» alla domanda che l'engine fa a fine turno, e il transcript nomina
`<mod>: loaded`. Nessuna voce, nessuna mod. Si legge l'`id` della sessione corrente da
`CLAUDE_CODE_SESSION_ID`.

**Per una mod che deve valere sempre**: una cartella stabile fuori da `dev-mods/`
(qui `~/.claude/mods/<nome>`) e quel path nominato in `CLAUDE_CODE_PLUGIN_DIRS` — più path
separati dal separatore di lista del sistema — nell'ambiente o nel blocco `env` di
`~/.claude/settings.json`, **mai** nei settings di progetto. Il valore si legge all'avvio:
la sessione va riavviata. La cartella poi è guardata, e salvare un file ricarica il modulo.

Due trappole verificate il 14 ottobre 2026:

- **Un modulo mancante non fa rumore.** `claude --plugin-dir <cartella>` con un `hooks.json`
  che nomina un file inesistente non dice niente: il sistema è fail-open. Per provare che una
  mod si carica davvero le si fa fare qualcosa di osservabile — una mod di prova il cui hook
  riscriveva il prompt ha risposto `PONG` in `claude -p`, ed è quella la prova che il percorso
  carica.
- `CLAUDE_CODE_PLUGIN_DIRS` è fra le chiavi che l'engine **scarta** dai settings personali
  quando `CLAUDE_CODE_RESTRICT_PERSONAL_CONFIG` è acceso: su una macchina con quel flag il
  blocco `env` non basta e il valore va nell'ambiente del processo.

Vedi [[come-si-provano-i-fatti-su-claude-code]] e [[fatti-verificati-in-memoria]].
