---
name: memoria-nel-repo
description: La memoria di Daiku vive in sviluppo/memory/ e va riconfigurata a mano su ogni macchina
metadata:
  type: project
---

La memoria persistente di Daiku è `sviluppo/memory/`, versionata nel repo, non il path
predefinito sotto `~/.claude/projects/<cwd>/memory/`. La punta `autoMemoryDirectory` in
`.claude/settings.local.json`.

**Why:** quel file **non si versiona** — ed è `.gitignore`-ato apposta — perché Claude Code
ignora `autoMemoryDirectory` quando arriva dal `.claude/settings.json` committato. È una misura
di sicurezza: un repo clonato non può dirottare dove l'agente scrive la memoria. Lo dice lo
schema delle impostazioni, testualmente: *«Ignored if set in projectSettings (checked-in
.claude/settings.json) for security»*.

**How to apply:** su una macchina nuova, o dopo un clone, `settings.local.json` va riscritto a
mano con il path assoluto giusto. Senza, la memoria torna al default **in silenzio**: nessun
avviso, e le memorie del repo semplicemente non vengono lette. Se in una sessione la memoria
sembra vuota, è la prima cosa da controllare.

Non è lo stesso meccanismo che ReforgIA dichiara nel proprio `CLAUDE.md`: là si dice che la
memoria sta in `src/memory/` «configurata tramite autoMemoryDirectory», ma quella chiave non è
impostata in nessun settings di quella macchina — la frase documenta un'intenzione, non una
configurazione viva. Vedi [[alberatura-pacchetto]].
