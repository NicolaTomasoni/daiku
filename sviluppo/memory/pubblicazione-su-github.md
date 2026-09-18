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

**How to apply:** finché il repo pubblico non esiste, che i file del prodotto portino con sé
valori di ReforgIA e path di questa macchina non è un problema — l'owner l'ha deciso
esplicitamente. Diventa un gate **prima** del primo push pubblico, perché da quel momento
`plugins/` esce com'è scritto. Da ripulire, censito il 18 settembre 2026:

- `templates/owner/environment.json` — `temp_dir` con lo username `ntomason`
- `templates/project/project.json` — la configurazione ReforgIA intera: nome, `repo_root`,
  documento tecnico, `pnpm --filter @reforgia/backend`
- `hooks/lib/*.mjs` — 35 occorrenze di `C:/dev/ReforgIA/src` nei banchi di prova `--self-check`

Nota pratica finché il pacchetto vive solo qui: installare da un repository privato richiede
credenziali git sulla macchina di chi installa. Per provare il pacchetto in locale conviene un marketplace da
path, che non passa da git.
