---
name: pubblicazione-su-github
description: Il repo pubblico di Daiku va su GitHub e non su GitLab, e non esiste ancora — cosa ripulire prima di crearlo
metadata:
  type: project
---

Il repository di sviluppo **resta privato per sempre**, su GitLab. Quello di pubblicazione — un
secondo repository, generato, vedi [[si-pubblica-solo-il-prodotto]] — va su **GitHub** e non su
GitLab (deciso il 18 settembre 2026). Al 18 settembre 2026 non esiste ancora: il pacchetto non è
pronto.

**Why:** entrambi gli host accettano la forma breve `owner/repo` solo per GitHub —
`/plugin marketplace add owner/repo` su Claude Code, `codex plugin marketplace add owner/repo`
su Codex. Un GitLab richiederebbe l'URL git completo su tutti e due, e allungherebbe le
istruzioni di installazione senza dare nulla in cambio.

**How to apply:** il gate resta **prima** del primo push pubblico, perché da quel momento
`plugins/` esce com'è scritto. Il censimento del 18 settembre 2026 elencava tre residui — lo
username `ntomason` in `templates/owner/environment.json`, la configurazione ReforgIA intera in
`templates/project/project.json`, e 35 occorrenze di `C:/dev/ReforgIA/src` nei banchi `--self-check`
degli hook. **Sono stati ripuliti tutti e tre**, verificato il 19 settembre 2026: i due template
portano segnaposto, e i banchi girano su un `c:/dev/progetto` inventato.

Il gate quindi non è più una lista di cose da fare ma un **controllo da rifare**, perché un residuo
nuovo entra con qualunque consegna: `grep -rin "reforgia\|<username>\|c:/dev/" plugins/daiku/`
prima di pubblicare, e ogni occorrenza va guardata — un path di questa macchina finito in un
template o in un banco di prova è esattamente ciò che il gate esiste per fermare.

Nota pratica finché il pacchetto vive solo qui: installare da un repository privato richiede
credenziali git sulla macchina di chi installa. Per provare il pacchetto in locale conviene un marketplace da
path, che non passa da git.
